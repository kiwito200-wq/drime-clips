import { NextRequest, NextResponse } from 'next/server'

// Drime API configuration - use staging like auth
const DRIME_API_URL = 'https://front.preprod.drime.cloud'

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
    // Don't filter by type - let the API return everything and we filter PDFs

    console.log('[Drime Files] Fetching from:', apiUrl)

    // Extract XSRF token from cookies if present
    const xsrfMatch = cookieHeader.match(/XSRF-TOKEN=([^;]+)/)
    const xsrfToken = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : ''
    
    console.log('[Drime Files] XSRF Token found:', !!xsrfToken)

    const headers: Record<string, string> = {
      'Cookie': cookieHeader,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Origin': 'https://front.preprod.drime.cloud',
      'Referer': 'https://front.preprod.drime.cloud/',
    }
    
    // Add XSRF token header if present (Laravel expects this)
    if (xsrfToken) {
      headers['X-XSRF-TOKEN'] = xsrfToken
    }

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Drime Files] API error:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch files from Drime', details: errorText }, { status: response.status })
    }

    const data = await response.json()
    
    // Debug: log raw response structure
    console.log('[Drime Files] Raw response keys:', Object.keys(data))
    console.log('[Drime Files] Raw data sample:', JSON.stringify(data).substring(0, 500))
    
    // Handle paginated response format - might be data.data or just data
    const entries = Array.isArray(data) ? data : (data.data || data.fileEntries || [])
    const pagination = data.pagination || data.meta || { currentPage: 1, lastPage: 1, total: entries.length }
    
    console.log('[Drime Files] Got', entries.length, 'total entries')
    if (entries.length > 0) {
      console.log('[Drime Files] First entry sample:', JSON.stringify(entries[0]).substring(0, 300))
    }

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
