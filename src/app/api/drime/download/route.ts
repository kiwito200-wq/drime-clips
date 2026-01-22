import { NextRequest, NextResponse } from 'next/server'

// Use staging like auth
const DRIME_API_URL = 'https://staging.drime.cloud'

/**
 * Download a file from Drime and return it as blob
 * Forwards drime_session cookie for authentication
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

    // Get download URL from Drime
    const downloadUrl = `${DRIME_API_URL}/api/v1/drive/file-entries/${fileId}/download`
    
    console.log('[Drime Download] Downloading from:', downloadUrl)

    // Extract XSRF token from cookies if present
    const xsrfMatch = cookieHeader.match(/XSRF-TOKEN=([^;]+)/)
    const xsrfToken = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : ''
    
    const headers: Record<string, string> = {
      'Cookie': cookieHeader,
      'Accept': '*/*',
      'Origin': 'https://staging.drime.cloud',
      'Referer': 'https://staging.drime.cloud/',
    }
    
    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = xsrfToken
    }

    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers,
    })

    console.log('[Drime Download] Response status:', response.status)
    console.log('[Drime Download] Content-Type:', response.headers.get('content-type'))

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Drime Download] API error:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to download file from Drime' }, { status: response.status })
    }

    // Check content type to ensure we got a PDF
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
      console.error('[Drime Download] Unexpected content type:', contentType)
      // Try to read as text to see what we got
      const text = await response.text()
      console.error('[Drime Download] Response body:', text.substring(0, 500))
      return NextResponse.json({ error: 'Drime returned non-PDF response' }, { status: 500 })
    }

    // Get the file as arrayBuffer then blob for better handling
    const arrayBuffer = await response.arrayBuffer()
    console.log('[Drime Download] Downloaded size:', arrayBuffer.byteLength, 'bytes')
    
    // Return the file with appropriate headers
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName || 'document.pdf'}"`,
        'Content-Length': String(arrayBuffer.byteLength),
      },
    })
  } catch (error) {
    console.error('[Drime Download] Error:', error)
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
}
