import { NextRequest, NextResponse } from 'next/server'

// Use staging for auth but app.drime.cloud for files API
const DRIME_FILES_API_URL = process.env.DRIME_FILES_API_URL || 'https://app.drime.cloud'
const DRIME_AUTH_API_URL = process.env.DRIME_API_URL || 'https://staging.drime.cloud'

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
    const folderId = searchParams.get('folderId') || ''

    // Build Drime API URL - use /drive/file-entries endpoint
    // Try app.drime.cloud first (production API)
    let apiUrl = `${DRIME_FILES_API_URL}/api/v1/drive/file-entries?perPage=100`
    if (folderId) {
      apiUrl += `&folderId=${folderId}`
    }

    console.log('[Drime Files] Fetching from:', apiUrl)

    let response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'Accept': 'application/json',
      },
    })

    // If app.drime.cloud fails, try staging
    if (!response.ok && DRIME_FILES_API_URL !== DRIME_AUTH_API_URL) {
      console.log('[Drime Files] app.drime.cloud failed, trying staging...')
      apiUrl = `${DRIME_AUTH_API_URL}/api/v1/drive/file-entries?perPage=100`
      if (folderId) {
        apiUrl += `&folderId=${folderId}`
      }
      
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Cookie': cookieHeader,
          'Accept': 'application/json',
        },
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Drime Files] API error:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch files from Drime' }, { status: response.status })
    }

    const data = await response.json()
    console.log('[Drime Files] Got', data.data?.length || 0, 'entries')

    // Filter to only return PDF files
    const pdfFiles = (data.data || []).filter((file: any) => {
      const ext = file.extension?.toLowerCase() || ''
      const mime = file.mime?.toLowerCase() || ''
      const fileName = file.file_name?.toLowerCase() || file.name?.toLowerCase() || ''
      return ext === 'pdf' || mime === 'application/pdf' || fileName.endsWith('.pdf')
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
