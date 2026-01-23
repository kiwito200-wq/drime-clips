import { NextRequest, NextResponse } from 'next/server'

const DRIME_API_URL = 'https://front.preprod.drime.cloud'

/**
 * Download a file from Drime
 */
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    
    if (!cookieHeader.includes('drime_session')) {
      return NextResponse.json({ error: 'Not authenticated with Drime' }, { status: 401 })
    }

    const { fileId, fileName } = await request.json()
    
    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 })
    }

    const xsrfMatch = cookieHeader.match(/XSRF-TOKEN=([^;]+)/)
    const xsrfToken = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : ''
    
    const headers: Record<string, string> = {
      'Cookie': cookieHeader,
      'Accept': 'application/pdf, application/octet-stream, */*',
      'Origin': DRIME_API_URL,
      'Referer': `${DRIME_API_URL}/`,
    }
    
    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = xsrfToken
    }

    console.log('[Drime Download] Starting download for file ID:', fileId)

    // Get file info first
    const listRes = await fetch(`${DRIME_API_URL}/api/v1/drive/file-entries?perPage=100`, {
      method: 'GET',
      headers: { ...headers, 'Accept': 'application/json' },
    })
    
    if (!listRes.ok) {
      console.error('[Drime Download] Failed to get file listing')
      return NextResponse.json({ error: 'Failed to get file listing' }, { status: 500 })
    }
    
    const listData = await listRes.json()
    const files = listData.data || []
    const targetFile = files.find((f: { id: number | string }) => String(f.id) === String(fileId))
    
    if (!targetFile) {
      console.error('[Drime Download] File not found in listing')
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    console.log('[Drime Download] File info:', {
      id: targetFile.id,
      name: targetFile.name,
      disk_prefix: targetFile.disk_prefix,
      file_name: targetFile.file_name,
      hash: targetFile.hash,
      url: targetFile.url,
    })

    // Try POST to download endpoint (some APIs require POST)
    console.log('[Drime Download] Trying POST to download endpoint')
    const postDownloadRes = await fetch(`${DRIME_API_URL}/api/v1/drive/download`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ 
        entryIds: [fileId],
        hashes: targetFile.hash ? [targetFile.hash] : undefined,
      }),
    })
    
    console.log('[Drime Download] POST download status:', postDownloadRes.status, 'content-type:', postDownloadRes.headers.get('content-type'))
    
    if (postDownloadRes.ok) {
      const contentType = postDownloadRes.headers.get('content-type') || ''
      
      // Check if it returns a download URL in JSON
      if (contentType.includes('json')) {
        const data = await postDownloadRes.json()
        console.log('[Drime Download] POST download response:', JSON.stringify(data).substring(0, 500))
        
        // Look for download URL
        const downloadUrl = data.downloadUrl || data.url || data.link || data.signedUrl
        if (downloadUrl) {
          console.log('[Drime Download] Got download URL:', downloadUrl)
          const fileRes = await fetch(downloadUrl, { redirect: 'follow' })
          if (fileRes.ok) {
            const result = await checkAndReturnPDF(fileRes, fileName || targetFile.name)
            if (result) return result
          }
        }
      } else {
        const result = await checkAndReturnPDF(postDownloadRes, fileName || targetFile.name)
        if (result) return result
      }
    }

    // Try GET with hashes parameter
    if (targetFile.hash) {
      console.log('[Drime Download] Trying with hash:', targetFile.hash)
      const hashRes = await fetch(`${DRIME_API_URL}/api/v1/drive/download?hashes=${targetFile.hash}`, {
        method: 'GET',
        headers,
        redirect: 'follow',
      })
      
      console.log('[Drime Download] Hash download status:', hashRes.status)
      if (hashRes.ok) {
        const result = await checkAndReturnPDF(hashRes, fileName || targetFile.name)
        if (result) return result
      }
    }

    // Try entries endpoint (not file-entries)
    console.log('[Drime Download] Trying /entries/ endpoint')
    const entriesRes = await fetch(`${DRIME_API_URL}/api/v1/drive/entries/${fileId}/download`, {
      method: 'GET',
      headers,
      redirect: 'follow',
    })
    
    console.log('[Drime Download] Entries download status:', entriesRes.status)
    if (entriesRes.ok) {
      const result = await checkAndReturnPDF(entriesRes, fileName || targetFile.name)
      if (result) return result
    }

    // Try generating a signed URL
    console.log('[Drime Download] Trying to generate signed URL')
    const signedUrlRes = await fetch(`${DRIME_API_URL}/api/v1/drive/file-entries/${fileId}/signed-url`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'download' }),
    })
    
    console.log('[Drime Download] Signed URL status:', signedUrlRes.status)
    if (signedUrlRes.ok) {
      const signedData = await signedUrlRes.json()
      console.log('[Drime Download] Signed URL response:', JSON.stringify(signedData).substring(0, 300))
      
      const signedUrl = signedData.url || signedData.signedUrl || signedData.downloadUrl
      if (signedUrl) {
        const fileRes = await fetch(signedUrl, { redirect: 'follow' })
        if (fileRes.ok) {
          const result = await checkAndReturnPDF(fileRes, fileName || targetFile.name)
          if (result) return result
        }
      }
    }

    // Try direct file stream endpoint
    console.log('[Drime Download] Trying file stream endpoint')
    const streamRes = await fetch(`${DRIME_API_URL}/api/v1/drive/file-entries/${fileId}/stream`, {
      method: 'GET',
      headers,
      redirect: 'follow',
    })
    
    console.log('[Drime Download] Stream status:', streamRes.status)
    if (streamRes.ok) {
      const result = await checkAndReturnPDF(streamRes, fileName || targetFile.name)
      if (result) return result
    }

    // Last resort: try /uploads/ with the actual stored filename
    const uploadPaths = [
      `${DRIME_API_URL}/api/v1/uploads/${targetFile.disk_prefix}`,
      `${DRIME_API_URL}/api/v1/storage/${targetFile.disk_prefix}`,
    ]
    
    for (const path of uploadPaths) {
      console.log('[Drime Download] Trying:', path)
      const res = await fetch(path, { headers, redirect: 'follow' })
      console.log('[Drime Download] Status:', res.status)
      if (res.ok) {
        const result = await checkAndReturnPDF(res, fileName || targetFile.name)
        if (result) return result
      }
    }

    console.error('[Drime Download] All download methods failed')
    return NextResponse.json({ 
      error: 'Could not download file',
      message: 'Please check the Drime API documentation for the correct download endpoint'
    }, { status: 500 })
  } catch (error) {
    console.error('[Drime Download] Error:', error)
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
}

async function checkAndReturnPDF(response: Response, fileName: string): Promise<NextResponse | null> {
  try {
    const contentType = response.headers.get('content-type') || ''
    const arrayBuffer = await response.arrayBuffer()
    
    const bytes = new Uint8Array(arrayBuffer.slice(0, 5))
    const header = String.fromCharCode.apply(null, Array.from(bytes))
    
    console.log('[Drime Download] Check: size=', arrayBuffer.byteLength, 'header=', header.substring(0, 10), 'content-type=', contentType)
    
    if (header.startsWith('%PDF')) {
      console.log('[Drime Download] SUCCESS - Got PDF!')
      return new NextResponse(arrayBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName || 'document.pdf'}"`,
          'Content-Length': String(arrayBuffer.byteLength),
        },
      })
    }
    
    if ((contentType.includes('pdf') || contentType.includes('octet-stream')) && arrayBuffer.byteLength > 1000 && !header.startsWith('<!doc') && !header.startsWith('{')) {
      console.log('[Drime Download] SUCCESS - Content-type indicates PDF')
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
    console.log('[Drime Download] Check error:', e)
    return null
  }
}
