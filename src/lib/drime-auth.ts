import { NextRequest } from 'next/server'
import { prisma } from './prisma'
import { createSession, setSessionCookie } from './auth'

const DRIME_API_URL = process.env.DRIME_API_URL || 'https://app.drime.cloud'
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

    // Log all cookies for debugging
    const allCookies = request.cookies.getAll()
    console.log('[Drime Auto-Login] Available cookies:', allCookies.map(c => c.name))

    if (!drimeCookie) {
      console.log('[Drime Auto-Login] No Drime cookie found')
      return { user: null, sessionToken: null }
    }

    console.log('[Drime Auto-Login] Found cookie, validating with Drime API...')

    if (!DRIME_EXTERNAL_TOKEN) {
      console.error('[Drime Auto-Login] DRIME_EXTERNAL_TOKEN not set')
      return { user: null, sessionToken: null }
    }

    // Get XSRF token if available (Laravel CSRF)
    const xsrfToken = request.cookies.get('XSRF-TOKEN')?.value
    
    // Try to validate session by calling Drime API with cookies
    // Method 1: Send session cookie to /api/user (Laravel will auto-auth from session)
    let drimeResponse = await fetch(`${DRIME_API_URL}/api/user`, {
      method: 'GET',
      headers: {
        'Cookie': `drime_session=${drimeCookie}${xsrfToken ? `; XSRF-TOKEN=${xsrfToken}` : ''}`,
        'X-XSRF-TOKEN': xsrfToken ? decodeURIComponent(xsrfToken) : '',
        'Accept': 'application/json',
        'Referer': 'https://sign.drime.cloud',
        'Origin': 'https://sign.drime.cloud',
      },
      credentials: 'include',
    })
    console.log('[Drime Auto-Login] /api/user with cookie status:', drimeResponse.status)
    
    if (!drimeResponse.ok) {
      // Method 2: Try /api/v1/user
      drimeResponse = await fetch(`${DRIME_API_URL}/api/v1/user`, {
        method: 'GET',
        headers: {
          'Cookie': `drime_session=${drimeCookie}${xsrfToken ? `; XSRF-TOKEN=${xsrfToken}` : ''}`,
          'X-XSRF-TOKEN': xsrfToken ? decodeURIComponent(xsrfToken) : '',
          'Accept': 'application/json',
          'Referer': 'https://sign.drime.cloud',
        },
      })
      console.log('[Drime Auto-Login] /api/v1/user with cookie status:', drimeResponse.status)
    }
    
    if (!drimeResponse.ok) {
      // Method 3: Try with Bearer token (in case it's a JWT/token)
      drimeResponse = await fetch(`${DRIME_API_URL}/api/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${drimeCookie}`,
          'Accept': 'application/json',
        },
      })
      console.log('[Drime Auto-Login] /api/user with Bearer status:', drimeResponse.status)
    }
    
    if (!drimeResponse.ok) {
      // Method 4: Try /api/v1/auth/external/me with Access-External-Token
      drimeResponse = await fetch(`${DRIME_API_URL}/api/v1/auth/external/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${drimeCookie}`,
          'Access-External-Token': DRIME_EXTERNAL_TOKEN,
          'Accept': 'application/json',
        },
      })
      console.log('[Drime Auto-Login] /api/v1/auth/external/me status:', drimeResponse.status)
    }

    if (!drimeResponse.ok) {
      console.log('[Drime Auto-Login] Invalid Drime cookie')
      return { user: null, sessionToken: null }
    }

    const drimeData = await drimeResponse.json()
    const drimeUser = drimeData.user || drimeData

    if (!drimeUser || !drimeUser.email) {
      console.log('[Drime Auto-Login] No user data in response')
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

    // Create or update user in local DB
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        drimeToken: accessToken,
        drimeUserId: userId ? String(userId) : null,
        name: drimeName || undefined,
        avatarUrl: drimeAvatarUrl || undefined,
      },
      create: {
        email,
        drimeToken: accessToken,
        drimeUserId: userId ? String(userId) : null,
        name: drimeName,
        avatarUrl: drimeAvatarUrl,
      },
    })

    // Create local session
    const sessionToken = await createSession(user.id)
    
    // Set session cookie
    await setSessionCookie(sessionToken)

    console.log('[Drime Auto-Login] Success for user:', email)

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
