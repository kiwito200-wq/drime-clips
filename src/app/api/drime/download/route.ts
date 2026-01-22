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

    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'Accept': 'application/pdf',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Drime Download] API error:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to download file from Drime' }, { status: response.status })
    }

    // Get the file as blob
    const blob = await response.blob()
    
    // Return the file with appropriate headers
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName || 'document.pdf'}"`,
      },
    })
  } catch (error) {
    console.error('[Drime Download] Error:', error)
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
}
