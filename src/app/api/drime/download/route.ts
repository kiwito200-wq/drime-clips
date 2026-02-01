import { NextRequest, NextResponse } from 'next/server'

const DRIME_API_URL = 'https://front.preprod.drime.cloud'

/**
 * Download a file from Drime using the correct endpoint:
 * GET /api/v1/file-entries/download/{hash}
 */
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    
    if (!cookieHeader.includes('drime_session')) {
      return NextResponse.json({ error: 'Not authenticated with Drime' }, { status: 401 })
    }

    const { fileId, fileName, workspaceId = 0 } = await request.json()
    
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



    // First, get file info to get the hash (include workspace)
    const listRes = await fetch(`${DRIME_API_URL}/api/v1/drive/file-entries?perPage=100&workspaceId=${workspaceId}`, {
      method: 'GET',
      headers: { ...headers, 'Accept': 'application/json' },
    })
    
    if (!listRes.ok) {
      return NextResponse.json({ error: 'Failed to get file listing' }, { status: 500 })
    }
    
    const listData = await listRes.json()
    const files = listData.data || []
    const targetFile = files.find((f: { id: number | string }) => String(f.id) === String(fileId))
    
    if (!targetFile) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (!targetFile.hash) {
      return NextResponse.json({ error: 'File has no download hash' }, { status: 500 })
    }

    // Use the correct endpoint: GET /api/v1/file-entries/download/{hash}
    const downloadUrl = `${DRIME_API_URL}/api/v1/file-entries/download/${targetFile.hash}`

    
    const downloadRes = await fetch(downloadUrl, {
      method: 'GET',
      headers,
      redirect: 'follow',
    })
    
    if (!downloadRes.ok) {
      return NextResponse.json({ error: 'Failed to download file' }, { status: downloadRes.status })
    }
    
    const contentType = downloadRes.headers.get('content-type') || ''
    const arrayBuffer = await downloadRes.arrayBuffer()
    
    // Check for PDF magic bytes
    const bytes = new Uint8Array(arrayBuffer.slice(0, 5))
    const header = String.fromCharCode.apply(null, Array.from(bytes))
    
    if (header.startsWith('%PDF') || contentType.includes('pdf') || contentType.includes('octet-stream')) {

      return new NextResponse(arrayBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName || targetFile.name || 'document.pdf'}"`,
          'Content-Length': String(arrayBuffer.byteLength),
        },
      })
    }
    
    // If we got HTML, authentication might have failed
    if (header.startsWith('<!doc') || header.startsWith('<html')) {
      return NextResponse.json({ error: 'Authentication failed - received HTML instead of file' }, { status: 401 })
    }
    
    return NextResponse.json({ error: 'Unknown response type from Drime' }, { status: 500 })
  } catch {
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
}
