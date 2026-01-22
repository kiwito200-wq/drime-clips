import { NextRequest, NextResponse } from 'next/server'

// Drime API configuration
const DRIME_API_URL = process.env.DRIME_API_URL || 'https://app.drime.cloud'
// API token that bypasses auth - set in environment
const DRIME_API_TOKEN = process.env.DRIME_API_TOKEN || '3XFfG4YzBC\\BGP_Ha\\cE-KY3lDWRHzx'

/**
 * Proxy to Drime API to get user's files
 * Uses Bearer token for authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Get query params for filtering
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folderId') || ''

    // Build Drime API URL
    let apiUrl = `${DRIME_API_URL}/api/v1/drive/file-entries?perPage=100`
    if (folderId) {
      apiUrl += `&folderId=${folderId}`
    }

    console.log('[Drime Files] Fetching from:', apiUrl)

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DRIME_API_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Drime Files] API error:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch files from Drime', details: errorText }, { status: response.status })
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
