import { NextRequest, NextResponse } from 'next/server'

const DRIME_API_URL = 'https://front.preprod.drime.cloud'

/**
 * Download a file from Drime
 * Tries multiple methods to get the file
 */
export async function POST(request: NextRequest) {
  try {
    // Get cookies from the request
    const cookieHeader = request.headers.get('cookie') || ''
    
    // Check if we have drime_session cookie
    if (!cookieHeader.includes('drime_session')) {
      return NextResponse.json({ error: 'Not authenticated with Drime' }, { status: 401 })
    }

    const { fileId, fileName } = await request.json()
    
    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
    }

    // Extract XSRF token from cookies if present
    const xsrfMatch = cookieHeader.match(/XSRF-TOKEN=([^;]+)/)
    const xsrfToken = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : ''
    
    const headers: Record<string, string> = {
      'Cookie': cookieHeader,
      'Accept': 'application/json, application/pdf, application/octet-stream, */*',
      'Origin': DRIME_API_URL,
      'Referer': `${DRIME_API_URL}/`,
    }
    
    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = xsrfToken
    }

    // First, get file info from listing to find disk_prefix/file_name
    console.log('[Drime Download] Getting file info for ID:', fileId)
    
    const listRes = await fetch(`${DRIME_API_URL}/api/v1/drive/file-entries?perPage=100`, {
      method: 'GET',
      headers: { ...headers, 'Accept': 'application/json' },
    })
    
    if (!listRes.ok) {
      console.error('[Drime Download] Failed to get file listing:', listRes.status)
      return NextResponse.json({ error: 'Failed to get file listing' }, { status: 500 })
    }
    
    const listData = await listRes.json()
    const files = listData.data || []
    const targetFile = files.find((f: { id: number | string }) => String(f.id) === String(fileId))
    
    if (!targetFile) {
      console.error('[Drime Download] File not found in listing')
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    console.log('[Drime Download] Found file:', JSON.stringify(targetFile).substring(0, 600))
    
    const diskPrefix = targetFile.disk_prefix || targetFile.file_name
    const storageName = targetFile.file_name
    
    // Try multiple download patterns used by Drime/BeDrive
    const downloadPatterns = [
      // Pattern 1: Storage endpoint with disk prefix
      `${DRIME_API_URL}/storage/${diskPrefix}`,
      // Pattern 2: Uploads endpoint
      `${DRIME_API_URL}/uploads/${diskPrefix}`,
      // Pattern 3: Storage with path
      `${DRIME_API_URL}/storage/${storageName}`,
      // Pattern 4: API download endpoint with query params
      `${DRIME_API_URL}/api/v1/drive/file-entries/download/${fileId}`,
      // Pattern 5: Drive download with file ID
      `${DRIME_API_URL}/api/v1/drive/downloads/${fileId}`,
      // Pattern 6: File entry download with query string
      `${DRIME_API_URL}/api/v1/file-entries/${fileId}?download=true`,
      // Pattern 7: Secure/signed URL pattern
      `${DRIME_API_URL}/secure/uploads/${diskPrefix}`,
      // Pattern 8: Public storage
      `${DRIME_API_URL}/storage/uploads/${diskPrefix}`,
    ]
    
    for (let i = 0; i < downloadPatterns.length; i++) {
      const url = downloadPatterns[i]
      console.log(`[Drime Download] Trying pattern ${i + 1}: ${url}`)
      
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers,
          redirect: 'follow',
        })
        
        console.log(`[Drime Download] Pattern ${i + 1} status:`, res.status, 'content-type:', res.headers.get('content-type'))
        
        if (res.ok) {
          const result = await checkAndReturnPDF(res, fileName || targetFile.name)
          if (result) {
            console.log(`[Drime Download] Success with pattern ${i + 1}!`)
            return result
          }
        }
      } catch (e) {
        console.log(`[Drime Download] Pattern ${i + 1} failed:`, e)
      }
    }
    
    // Try to get download URL from the API
    console.log('[Drime Download] Trying to get download URL from API...')
    
    // Get file entry directly to see if there's a download URL
    const entryRes = await fetch(`${DRIME_API_URL}/api/v1/drive/file-entries/${fileId}`, {
      method: 'GET',
      headers: { ...headers, 'Accept': 'application/json' },
    })
    
    if (entryRes.ok) {
      const contentType = entryRes.headers.get('content-type') || ''
      console.log('[Drime Download] Entry response content-type:', contentType)
      
      if (contentType.includes('json')) {
        const entryData = await entryRes.json()
        console.log('[Drime Download] Entry data:', JSON.stringify(entryData).substring(0, 800))
        
        const entry = entryData.fileEntry || entryData.data || entryData
        
        // Look for any URL field
        const possibleUrls = [
          entry?.url,
          entry?.download_url,
          entry?.file_url,
          entry?.src,
          entry?.preview_url,
        ].filter(Boolean) as string[]
        
        for (const rawUrl of possibleUrls) {
          // Make sure URL is absolute
          const url = rawUrl.startsWith('http') ? rawUrl : `${DRIME_API_URL}/${rawUrl.replace(/^\//, '')}`
          console.log('[Drime Download] Trying URL from entry:', url)
          
          try {
            const res = await fetch(url, { headers, redirect: 'follow' })
            if (res.ok) {
              const result = await checkAndReturnPDF(res, fileName || targetFile.name)
              if (result) return result
            }
          } catch (e) {
            console.log('[Drime Download] URL failed:', e)
          }
        }
      }
    }

    console.error('[Drime Download] All methods failed')
    return NextResponse.json({ 
      error: 'Failed to download file from Drime',
      details: 'Could not find a valid download endpoint. The file exists but cannot be downloaded.'
    }, { status: 500 })
  } catch (error) {
    console.error('[Drime Download] Error:', error)
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
}

/**
 * Check if response is a PDF and return it
 */
async function checkAndReturnPDF(response: Response, fileName: string): Promise<NextResponse | null> {
  try {
    const contentType = response.headers.get('content-type') || ''
    const arrayBuffer = await response.arrayBuffer()
    
    // Check for PDF magic bytes
    const bytes = new Uint8Array(arrayBuffer.slice(0, 5))
    const header = String.fromCharCode.apply(null, Array.from(bytes))
    
    console.log('[Drime Download] Response size:', arrayBuffer.byteLength, 'bytes, header:', header.substring(0, 10), 'content-type:', contentType)
    
    if (header.startsWith('%PDF')) {
      console.log('[Drime Download] Success! Got PDF')
      return new NextResponse(arrayBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName || 'document.pdf'}"`,
          'Content-Length': String(arrayBuffer.byteLength),
        },
      })
    }
    
    // Also accept if content-type says PDF and size is reasonable
    if ((contentType.includes('pdf') || contentType.includes('octet-stream')) && arrayBuffer.byteLength > 1000) {
      console.log('[Drime Download] Content-type indicates PDF, returning...')
      return new NextResponse(arrayBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName || 'document.pdf'}"`,
          'Content-Length': String(arrayBuffer.byteLength),
        },
      })
    }
    
    return null
  } catch (e) {
    console.log('[Drime Download] Error checking PDF:', e)
    return null
  }
}
