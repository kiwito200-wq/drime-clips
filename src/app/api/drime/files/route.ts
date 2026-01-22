import { NextRequest, NextResponse } from 'next/server'

// Drime API configuration
const DRIME_API_URL = process.env.DRIME_API_URL || 'https://app.drime.cloud'

/**
 * Proxy to Drime API to get user's files
 * Forwards cookies for authentication (session-based)
 */
export async function GET(request: NextRequest) {
  try {
    // Get cookies from the request to forward to Drime API
    const cookieHeader = request.headers.get('cookie') || ''
    
    if (!cookieHeader) {
      console.error('[Drime Files] No cookies provided')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Use file-entriesAll endpoint to get all files at once
    const apiUrl = `${DRIME_API_URL}/api/v1/drive/file-entriesAll`

    console.log('[Drime Files] Fetching from:', apiUrl)

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Drime Files] API error:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch files from Drime', details: errorText }, { status: response.status })
    }

    const data = await response.json()
    
    // Handle different response formats
    const entries = Array.isArray(data) ? data : (data.data || [])
    console.log('[Drime Files] Got', entries.length, 'entries')

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
      total: pdfFiles.length,
    })
  } catch (error) {
    console.error('[Drime Files] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}
