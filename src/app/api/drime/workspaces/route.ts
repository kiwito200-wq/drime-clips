import { NextRequest, NextResponse } from 'next/server'

const DRIME_API_URL = 'https://front.preprod.drime.cloud'

/**
 * Proxy to Drime API to get user's workspaces
 */
export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    
    const hasDrimeSession = cookieHeader.includes('drime_session')
    if (!hasDrimeSession) {
      return NextResponse.json({ error: 'Not authenticated with Drime' }, { status: 401 })
    }

    const apiUrl = `${DRIME_API_URL}/api/v1/me/workspaces`



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
      console.error('[Drime Workspaces] API error:', response.status, errorText)
      return NextResponse.json({ error: 'Failed to fetch workspaces from Drime' }, { status: response.status })
    }

    const data = await response.json()
    
    const workspaces = data.workspaces || []
    


    // Add "Personal workspace" as first option (id: 0)
    const allWorkspaces = [
      { id: 0, name: 'Personnel', avatar: null, isPersonal: true },
      ...workspaces.map((ws: any) => ({
        id: ws.id,
        name: ws.name,
        avatar: ws.avatar,
        isPersonal: false,
      }))
    ]

    return NextResponse.json({ workspaces: allWorkspaces })
  } catch (error) {
    console.error('[Drime Workspaces] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 })
  }
}
