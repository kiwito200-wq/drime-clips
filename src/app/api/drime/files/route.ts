import { NextRequest, NextResponse } from 'next/server'

// Drime API configuration - use staging like auth
const DRIME_API_URL = 'https://staging.drime.cloud'

/**
 * Proxy to Drime API to get user's files
 * Forwards drime_session cookie for authentication
 * Uses pagination (25 per page)
 */
export async function GET(request: NextRequest) {
  try {
    // Get cookies from the request
    const cookieHeader = request.headers.get('cookie') || ''
    
    // Debug: log all cookies received
    console.log('[Drime Files] Cookies received:', cookieHeader.substring(0, 500))
    
    // Check if we have drime_session cookie
    const hasDrimeSession = cookieHeader.includes('drime_session')
    console.log('[Drime Files] Has drime_session:', hasDrimeSession)
    
    if (!hasDrimeSession) {
      console.error('[Drime Files] No drime_session cookie found in:', cookieHeader.substring(0, 200))
      return NextResponse.json({ error: 'Not authenticated with Drime' }, { status: 401 })
    }

    // Get pagination params
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const perPage = searchParams.get('perPage') || '25'
    const folderId = searchParams.get('folderId') || ''

    // Build Drime API URL with pagination
    let apiUrl = `${DRIME_API_URL}/api/v1/drive/file-entries?page=${page}&perPage=${perPage}`
    if (folderId) {
      apiUrl += `&parentId=${folderId}`
    }
    // Only get files (not folders) and filter by PDF type
    apiUrl += '&type=file'

    console.log('[Drime Files] Fetching from:', apiUrl)

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Drime Files] API error:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch files from Drime', details: errorText }, { status: response.status })
    }

    const data = await response.json()
    
    // Handle paginated response format
    const entries = data.data || []
    const pagination = data.pagination || { currentPage: 1, lastPage: 1, total: entries.length }
    
    console.log('[Drime Files] Got', entries.length, 'entries, page', pagination.currentPage, 'of', pagination.lastPage)

    // Filter to only return PDF files
    const pdfFiles = entries.filter((file: any) => {
      // Skip folders
      if (file.type === 'folder') return false
      
      const ext = file.extension?.toLowerCase() || ''
      const mime = file.mime?.toLowerCase() || ''
      const fileName = file.file_name?.toLowerCase() || file.name?.toLowerCase() || ''
      return ext === 'pdf' || mime === 'application/pdf' || fileName.endsWith('.pdf')
    })

    return NextResponse.json({ 
      files: pdfFiles,
      total: pagination.total,
      currentPage: pagination.currentPage,
      lastPage: pagination.lastPage,
      hasMore: pagination.currentPage < pagination.lastPage,
    })
  } catch (error) {
    console.error('[Drime Files] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}
