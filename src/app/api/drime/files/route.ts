import { NextRequest, NextResponse } from 'next/server'

const DRIME_API_URL = 'https://front.preprod.drime.cloud'

/**
 * Proxy to Drime API to get user's files
 * Supports folder navigation and search
 */
export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    
    const hasDrimeSession = cookieHeader.includes('drime_session')
    if (!hasDrimeSession) {
      return NextResponse.json({ error: 'Not authenticated with Drime' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const perPage = searchParams.get('perPage') || '50'
    const folderId = searchParams.get('folderId') || ''
    const search = searchParams.get('search') || ''
    const workspaceId = searchParams.get('workspaceId') || '0'

    // Build Drime API URL
    // Include shared files by not filtering by ownership
    let apiUrl = `${DRIME_API_URL}/api/v1/drive/file-entries?page=${page}&perPage=${perPage}&workspaceId=${workspaceId}`
    
    if (folderId) {
      // Use parentIds for folder filtering - this will include files shared in the folder
      apiUrl += `&parentIds=${folderId}`
    }
    
    if (search) {
      apiUrl += `&query=${encodeURIComponent(search)}`
    }
    
    // Note: The Drime API should automatically return files that are:
    // - Owned by the user
    // - Shared with the user (even if in a folder owned by the user)
    // We don't need additional parameters as the API handles permissions



    const xsrfMatch = cookieHeader.match(/XSRF-TOKEN=([^;]+)/)
    const xsrfToken = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : ''

    const headers: Record<string, string> = {
      'Cookie': cookieHeader,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Origin': DRIME_API_URL,
      'Referer': `${DRIME_API_URL}/`,
    }
    
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
      return NextResponse.json({ error: 'Failed to fetch files from Drime' }, { status: response.status })
    }

    const data = await response.json()
    
    const entries = Array.isArray(data) ? data : (data.data || data.fileEntries || [])
    const pagination = {
      currentPage: data.current_page || 1,
      lastPage: data.last_page || 1,
      total: data.total || entries.length,
    }
    


    // Separate folders and PDF files
    const folders = entries.filter((item: any) => item.type === 'folder')
    const pdfFiles = entries.filter((item: any) => {
      if (item.type === 'folder') return false
      const ext = item.extension?.toLowerCase() || ''
      const mime = item.mime?.toLowerCase() || ''
      const name = item.name?.toLowerCase() || ''
      return ext === 'pdf' || mime === 'application/pdf' || name.endsWith('.pdf')
    })

    return NextResponse.json({ 
      folders,
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
