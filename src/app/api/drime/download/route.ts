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
      'Accept': 'application/json, application/pdf, */*',
      'Origin': 'https://front.preprod.drime.cloud',
      'Referer': 'https://front.preprod.drime.cloud/',
    }
    
    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = xsrfToken
    }

    // Method 1: Try direct download endpoint
    console.log('[Drime Download] Method 1: Trying /drive/file-entries/{id}/download')
    const downloadRes1 = await fetch(`${DRIME_API_URL}/api/v1/drive/file-entries/${fileId}/download`, {
      method: 'GET',
      headers,
      redirect: 'follow',
    })
    
    console.log('[Drime Download] Download endpoint status:', downloadRes1.status)
    
    if (downloadRes1.ok) {
      const result = await checkAndReturnPDF(downloadRes1, fileName)
      if (result) return result
    }

    // Method 2: Try preview endpoint
    console.log('[Drime Download] Method 2: Trying /drive/file-entries/{id}/preview')
    const previewRes = await fetch(`${DRIME_API_URL}/api/v1/drive/file-entries/${fileId}/preview`, {
      method: 'GET',
      headers,
      redirect: 'follow',
    })
    
    console.log('[Drime Download] Preview endpoint status:', previewRes.status)
    
    if (previewRes.ok) {
      const result = await checkAndReturnPDF(previewRes, fileName)
      if (result) return result
    }

    // Method 3: Get file entry info and look for URL
    console.log('[Drime Download] Method 3: Getting file entry info')
    const entryRes = await fetch(`${DRIME_API_URL}/api/v1/drive/file-entries/${fileId}`, {
      method: 'GET',
      headers: { ...headers, 'Accept': 'application/json' },
    })
    
    console.log('[Drime Download] File entry status:', entryRes.status)
    
    if (entryRes.ok) {
      const contentType = entryRes.headers.get('content-type') || ''
      const arrayBuffer = await entryRes.arrayBuffer()
      
      // Check if it's directly a PDF
      const bytes = new Uint8Array(arrayBuffer.slice(0, 5))
      const header = String.fromCharCode.apply(null, Array.from(bytes))
      
      if (header.startsWith('%PDF')) {
        console.log('[Drime Download] Got PDF directly from file entry!')
        return new NextResponse(arrayBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName || 'document.pdf'}"`,
            'Content-Length': String(arrayBuffer.byteLength),
          },
        })
      }
      
      // Try to parse as JSON
      if (contentType.includes('json')) {
        try {
          const text = new TextDecoder().decode(arrayBuffer)
          const data = JSON.parse(text)
          console.log('[Drime Download] File entry data:', JSON.stringify(data).substring(0, 500))
          
          const file = data.fileEntry || data.data || data.file || data
          
          // Look for any URL field
          const possibleUrls = [
            file?.url,
            file?.file_url,
            file?.download_url,
            file?.preview_url,
            file?.path ? `${DRIME_API_URL}${file.path.startsWith('/') ? '' : '/'}${file.path}` : null,
          ].filter(Boolean) as string[]
          
          console.log('[Drime Download] Possible URLs:', possibleUrls)
          
          for (const url of possibleUrls) {
            console.log('[Drime Download] Trying URL:', url)
            try {
              const directRes = await fetch(url, { 
                headers: { 'Cookie': cookieHeader },
                redirect: 'follow' 
              })
              if (directRes.ok) {
                const result = await checkAndReturnPDF(directRes, fileName)
                if (result) return result
              }
            } catch (e) {
              console.log('[Drime Download] URL failed:', url, e)
            }
          }
        } catch (e) {
          console.log('[Drime Download] Failed to parse JSON:', e)
        }
      }
    } else {
      const errorText = await entryRes.text()
      console.error('[Drime Download] File entry error:', entryRes.status, errorText.substring(0, 200))
    }

    // Method 4: Try shareable link
    console.log('[Drime Download] Method 4: Creating shareable link')
    const createLinkRes = await fetch(`${DRIME_API_URL}/api/v1/drive/shareable-link`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        entryId: fileId,
        allowDownload: true,
        allowEdit: false,
      }),
    })
    
    console.log('[Drime Download] Shareable link status:', createLinkRes.status)
    
    if (createLinkRes.ok) {
      const linkData = await createLinkRes.json()
      console.log('[Drime Download] Shareable link response:', JSON.stringify(linkData).substring(0, 300))
      
      const shareUrl = linkData.link?.url || linkData.link || linkData.url
      if (shareUrl) {
        console.log('[Drime Download] Got shareable URL:', shareUrl)
        
        // Try to download from shareable link
        const shareRes = await fetch(shareUrl, { redirect: 'follow' })
        if (shareRes.ok) {
          const result = await checkAndReturnPDF(shareRes, fileName)
          if (result) return result
        }
        
        // Try adding /download
        const shareDownloadRes = await fetch(`${shareUrl}/download`, { redirect: 'follow' })
        if (shareDownloadRes.ok) {
          const result = await checkAndReturnPDF(shareDownloadRes, fileName)
          if (result) return result
        }
      }
    }

    // Method 5: Try S3 style URL if available in file listing
    console.log('[Drime Download] Method 5: Trying to get file info from listing')
    const listRes = await fetch(`${DRIME_API_URL}/api/v1/drive/file-entries?perPage=100`, {
      method: 'GET',
      headers: { ...headers, 'Accept': 'application/json' },
    })
    
    if (listRes.ok) {
      const listData = await listRes.json()
      const files = listData.data || []
      const targetFile = files.find((f: { id: number | string }) => String(f.id) === String(fileId))
      
      if (targetFile) {
        console.log('[Drime Download] Found file in listing:', JSON.stringify(targetFile).substring(0, 500))
        
        const possibleUrls = [
          targetFile.url,
          targetFile.file_url,
          targetFile.download_url,
          targetFile.preview_url,
        ].filter(Boolean) as string[]
        
        for (const url of possibleUrls) {
          console.log('[Drime Download] Trying file URL from listing:', url)
          try {
            const directRes = await fetch(url, { redirect: 'follow' })
            if (directRes.ok) {
              const result = await checkAndReturnPDF(directRes, fileName)
              if (result) return result
            }
          } catch (e) {
            console.log('[Drime Download] URL failed:', url, e)
          }
        }
      }
    }

    console.error('[Drime Download] All methods failed')
    return NextResponse.json({ error: 'Failed to download file from Drime - no valid download method found' }, { status: 500 })
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
    const arrayBuffer = await response.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer.slice(0, 5))
    const header = String.fromCharCode.apply(null, Array.from(bytes))
    
    console.log('[Drime Download] Response size:', arrayBuffer.byteLength, 'bytes, header:', header)
    
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
    
    console.log('[Drime Download] Response is not a PDF')
    return null
  } catch (e) {
    console.log('[Drime Download] Error checking PDF:', e)
    return null
  }
}
