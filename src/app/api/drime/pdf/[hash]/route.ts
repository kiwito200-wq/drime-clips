import { NextRequest, NextResponse } from 'next/server'

const DRIME_API_URL = 'https://app.drime.cloud'

/**
 * Proxy endpoint to serve PDF files from Drime
 * This allows creating envelopes that reference Drime files without duplicating them
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { hash: string } }
) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    
    if (!cookieHeader.includes('drime_session')) {
      return NextResponse.json({ error: 'Not authenticated with Drime' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')
    const workspaceId = searchParams.get('workspaceId') || '0'
    const hash = params.hash

    if (!fileId || !hash) {
      return NextResponse.json({ error: 'fileId and hash are required' }, { status: 400 })
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

    // Use the Drime download endpoint
    const downloadUrl = `${DRIME_API_URL}/api/v1/file-entries/download/${hash}`
    
    const downloadRes = await fetch(downloadUrl, {
      method: 'GET',
      headers,
      redirect: 'follow',
    })

    if (!downloadRes.ok) {
      return NextResponse.json({ error: 'Failed to download file from Drime' }, { status: downloadRes.status })
    }

    const contentType = downloadRes.headers.get('content-type') || 'application/pdf'
    const arrayBuffer = await downloadRes.arrayBuffer()

    // Validate it's a PDF
    const bytes = new Uint8Array(arrayBuffer.slice(0, 5))
    const header = String.fromCharCode.apply(null, Array.from(bytes))

    if (!header.startsWith('%PDF') && !contentType.includes('pdf')) {
      console.error('[Drime PDF Proxy] File is not a PDF')
      return NextResponse.json({ error: 'File is not a PDF' }, { status: 400 })
    }

    // Return the PDF with proper headers
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="document.pdf"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('[Drime PDF Proxy] Error:', error)
    return NextResponse.json({ error: 'Failed to proxy PDF from Drime' }, { status: 500 })
  }
}
