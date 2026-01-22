import { NextRequest, NextResponse } from 'next/server'

const DRIME_API_URL = process.env.DRIME_API_URL || 'https://app.drime.cloud'

/**
 * Proxy to Drime API to get user's files
 * Uses the user's drime_session cookie for authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Forward the drime_session cookie
    const cookieHeader = request.headers.get('cookie')
    
    if (!cookieHeader?.includes('drime_session')) {
      return NextResponse.json({ error: 'Not authenticated with Drime' }, { status: 401 })
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'pdf' // Default to PDF files
    const folderId = searchParams.get('folderId') || ''

    // Build Drime API URL
    let apiUrl = `${DRIME_API_URL}/api/v1/drive/file-entries?perPage=50`
    if (type) {
      apiUrl += `&type=${type}`
    }
    if (folderId) {
      apiUrl += `&folderId=${folderId}`
    }

    console.log('[Drime Files] Fetching from:', apiUrl)

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('[Drime Files] API error:', response.status)
      return NextResponse.json({ error: 'Failed to fetch files from Drime' }, { status: response.status })
    }

    const data = await response.json()
    console.log('[Drime Files] Got', data.data?.length || 0, 'entries')

    // Filter to only return PDF files
    const pdfFiles = (data.data || []).filter((file: any) => {
      const ext = file.extension?.toLowerCase() || ''
      const mime = file.mime?.toLowerCase() || ''
      return ext === 'pdf' || mime === 'application/pdf'
    })

    return NextResponse.json({ 
      files: pdfFiles,
      total: pdfFiles.length,
    })
  } catch (error) {
    console.error('[Drime Files] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}
