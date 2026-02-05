import { NextRequest } from 'next/server'
import { prisma } from './prisma'
import { createSession, setSessionCookie } from './auth'
import { encrypt } from './encryption'

// Helper to ensure URL has protocol
function ensureProtocol(url: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

const DRIME_API_URL = ensureProtocol(process.env.DRIME_API_URL || 'https://app.drime.cloud')
const DRIME_EXTERNAL_TOKEN = process.env.DRIME_EXTERNAL_TOKEN || ''

export interface DrimeUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
}

/**
 * Attempts to auto-login using Drime cookie from app.drime.cloud
 * Returns the user if successful, null otherwise
 */
export async function attemptDrimeAutoLogin(request: NextRequest): Promise<{
  user: DrimeUser | null
  sessionToken: string | null
}> {
  try {
    // Get Drime cookie from request
    // The cookie should be set on .drime.cloud domain with SameSite=None; Secure
    // Try multiple possible cookie names
    const drimeCookie = request.cookies.get('drime_session')?.value || 
                        request.cookies.get('drime_auth')?.value ||
                        request.cookies.get('auth_token')?.value ||
                        request.cookies.get('token')?.value ||
                        request.cookies.get('access_token')?.value ||
                        request.headers.get('authorization')?.replace('Bearer ', '')

    if (!drimeCookie) {

      return { user: null, sessionToken: null }
    }



    if (!DRIME_EXTERNAL_TOKEN) {
      console.error('[Drime Auto-Login] DRIME_EXTERNAL_TOKEN not set')
      return { user: null, sessionToken: null }
    }

    // Get XSRF token if available (Laravel CSRF)
    const xsrfToken = request.cookies.get('XSRF-TOKEN')?.value
    
    // Use the correct Drime endpoint: /api/v1/cli/loggedUser
    // This endpoint returns { user: auth()->user() }
    const drimeResponse = await fetch(`${DRIME_API_URL}/api/v1/cli/loggedUser`, {
      method: 'GET',
      headers: {
        'Cookie': `drime_session=${drimeCookie}${xsrfToken ? `; XSRF-TOKEN=${xsrfToken}` : ''}`,
        'X-XSRF-TOKEN': xsrfToken ? decodeURIComponent(xsrfToken) : '',
        'Accept': 'application/json',
        'Referer': 'https://sign.drime.cloud',
        'Origin': 'https://sign.drime.cloud',
      },
    })

    
    const responseText = await drimeResponse.text()
    
    if (!drimeResponse.ok) {

      return { user: null, sessionToken: null }
    }
    
    // Parse the response
    let drimeData
    try {
      drimeData = JSON.parse(responseText)
    } catch (e) {
      console.error('[Drime Auto-Login] Failed to parse JSON:', e)
      return { user: null, sessionToken: null }
    }

    const drimeUser = drimeData.user || drimeData

    if (!drimeUser || !drimeUser.email) {

      return { user: null, sessionToken: null }
    }

    // Extract user data
    const email = drimeUser.email
    const userId = drimeUser.id || drimeUser.user_id
    const accessToken = drimeCookie
    const drimeName = drimeUser.display_name || drimeUser.first_name || drimeUser.name || null
    
    // Construct avatar URL if needed
    let drimeAvatarUrl = drimeUser.avatar_url || drimeUser.avatar || null
    if (drimeAvatarUrl && !drimeAvatarUrl.startsWith('http')) {
      drimeAvatarUrl = `${DRIME_API_URL}/${drimeAvatarUrl.replace(/^\//, '')}`
    }

    // SECURITY: Encrypt the access token before storing in database
    const encryptedToken = accessToken ? encrypt(accessToken) : null
    
    // Create or update user in local DB
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        drimeToken: encryptedToken,
        drimeUserId: userId ? String(userId) : null,
        name: drimeName || undefined,
        avatarUrl: drimeAvatarUrl || undefined,
      },
      create: {
        email,
        drimeToken: encryptedToken,
        drimeUserId: userId ? String(userId) : null,
        name: drimeName,
        avatarUrl: drimeAvatarUrl,
      },
    })

    // Create local session
    const sessionToken = await createSession(user.id)
    
    // Set session cookie
    await setSessionCookie(sessionToken)



    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      sessionToken,
    }
  } catch (error) {
    console.error('[Drime Auto-Login] Error:', error)
    return { user: null, sessionToken: null }
  }
}

/**
 * Check if user is logged in on Drime (has valid cookie)
 */
export function hasDrimeCookie(request: NextRequest): boolean {
  const drimeCookie = request.cookies.get('drime_session')?.value || 
                      request.cookies.get('drime_auth')?.value ||
                      request.cookies.get('auth_token')?.value
  return !!drimeCookie
}
