import { NextRequest, NextResponse } from 'next/server'

// Use staging like auth
const DRIME_API_URL = 'https://staging.drime.cloud'

/**
 * Download a file from Drime
 * First creates/gets a shareable link, then downloads from that URL
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
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Origin': 'https://staging.drime.cloud',
      'Referer': 'https://staging.drime.cloud/',
    }
    
    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = xsrfToken
    }

    // Step 1: Try to get existing shareable link or create one
    console.log('[Drime Download] Getting shareable link for file:', fileId)
    
    let shareableUrl: string | null = null
    
    // Try to get existing shareable link
    const getLinkRes = await fetch(`${DRIME_API_URL}/api/v1/file-entries/${fileId}/shareable-link`, {
      method: 'GET',
      headers,
    })
    
    if (getLinkRes.ok) {
      const linkData = await getLinkRes.json()
      console.log('[Drime Download] Got shareable link:', JSON.stringify(linkData).substring(0, 200))
      shareableUrl = linkData.link?.url || linkData.url || null
    } else {
      console.log('[Drime Download] No existing link, creating one...')
      // Create a new shareable link
      const createLinkRes = await fetch(`${DRIME_API_URL}/api/v1/file-entries/${fileId}/shareable-link`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ allowDownload: true }),
      })
      
      if (createLinkRes.ok) {
        const linkData = await createLinkRes.json()
        console.log('[Drime Download] Created shareable link:', JSON.stringify(linkData).substring(0, 200))
        shareableUrl = linkData.link?.url || linkData.url || null
      } else {
        const errorText = await createLinkRes.text()
        console.error('[Drime Download] Failed to create shareable link:', createLinkRes.status, errorText)
      }
    }

    // Step 2: If we have a shareable URL, download from it
    if (shareableUrl) {
      // The shareable URL might be like: https://staging.drime.cloud/drive/s/xxxxx
      // We need to get the actual file from it
      console.log('[Drime Download] Downloading from shareable URL:', shareableUrl)
      
      // Try direct download by appending /download or using the URL directly
      const downloadUrl = shareableUrl.includes('/download') ? shareableUrl : `${shareableUrl}/download`
      
      const downloadRes = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
        },
        redirect: 'follow',
      })
      
      console.log('[Drime Download] Shareable download status:', downloadRes.status)
      console.log('[Drime Download] Shareable Content-Type:', downloadRes.headers.get('content-type'))
      
      if (downloadRes.ok) {
        const contentType = downloadRes.headers.get('content-type') || ''
        if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
          const arrayBuffer = await downloadRes.arrayBuffer()
          console.log('[Drime Download] Downloaded size:', arrayBuffer.byteLength, 'bytes')
          
          return new NextResponse(arrayBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${fileName || 'document.pdf'}"`,
              'Content-Length': String(arrayBuffer.byteLength),
            },
          })
        }
      }
    }

    // Step 3: Try to get file entry directly by ID
    console.log('[Drime Download] Getting file entry by ID:', fileId)
    
    const fileEntryRes = await fetch(`${DRIME_API_URL}/api/v1/file-entries/${fileId}`, {
      method: 'GET',
      headers,
    })
    
    if (fileEntryRes.ok) {
      const fileData = await fileEntryRes.json()
      console.log('[Drime Download] File entry:', JSON.stringify(fileData).substring(0, 500))
      
      const file = fileData.fileEntry || fileData.file || fileData
      
      // Look for any URL field
      const possibleUrls = [
        file?.url,
        file?.file_url,
        file?.download_url,
        file?.path ? `${DRIME_API_URL}/storage/${file.path}` : null,
        file?.hash ? `${DRIME_API_URL}/drive/s/${file.hash}` : null,
      ].filter(Boolean)
      
      console.log('[Drime Download] Possible URLs:', possibleUrls)
      
      for (const url of possibleUrls) {
        console.log('[Drime Download] Trying URL:', url)
        const directRes = await fetch(url as string, { redirect: 'follow' })
        console.log('[Drime Download] Response:', directRes.status, directRes.headers.get('content-type'))
        
        if (directRes.ok) {
          const contentType = directRes.headers.get('content-type') || ''
          if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
            const arrayBuffer = await directRes.arrayBuffer()
            console.log('[Drime Download] Success! Size:', arrayBuffer.byteLength, 'bytes')
            
            return new NextResponse(arrayBuffer, {
              headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${fileName || 'document.pdf'}"`,
                'Content-Length': String(arrayBuffer.byteLength),
              },
            })
          }
        }
      }
    } else {
      const errorText = await fileEntryRes.text()
      console.error('[Drime Download] Failed to get file entry:', fileEntryRes.status, errorText.substring(0, 200))
    }

    // Step 4: Last resort - try preview URL pattern
    console.log('[Drime Download] Trying preview URL pattern...')
    const previewUrl = `${DRIME_API_URL}/api/v1/file-entries/${fileId}/preview`
    const previewRes = await fetch(previewUrl, { headers, redirect: 'follow' })
    console.log('[Drime Download] Preview response:', previewRes.status, previewRes.headers.get('content-type'))
    
    if (previewRes.ok) {
      const contentType = previewRes.headers.get('content-type') || ''
      if (contentType.includes('pdf') || contentType.includes('octet-stream')) {
        const arrayBuffer = await previewRes.arrayBuffer()
        console.log('[Drime Download] Preview download size:', arrayBuffer.byteLength, 'bytes')
        
        return new NextResponse(arrayBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName || 'document.pdf'}"`,
            'Content-Length': String(arrayBuffer.byteLength),
          },
        })
      }
    }

    return NextResponse.json({ error: 'Failed to download file from Drime - no valid download URL found' }, { status: 500 })
  } catch (error) {
    console.error('[Drime Download] Error:', error)
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
}
