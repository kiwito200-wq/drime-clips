import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
)

const DRIME_API_URL = process.env.DRIME_API_URL || 'https://front.preprod.drime.cloud'

/**
 * Check authentication by verifying with Drime
 * STRICT MODE: No drime_session = no access
 */
export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const localSessionToken = cookieStore.get('session')?.value
  const cookieHeader = request.headers.get('cookie')

  // Check if user has drime_session cookie
  const hasDrimeSession = cookieHeader?.includes('drime_session')
  
  console.log('[Auth Check] Has drime_session cookie:', hasDrimeSession)

  // STRICT: No drime_session = clear local session and deny access
  if (!hasDrimeSession) {
    console.log('[Auth Check] No drime_session cookie - clearing local session')
    
    // Clear local session if exists
    if (localSessionToken) {
      try {
        await prisma.session.deleteMany({ where: { token: localSessionToken } })
      } catch (e) {
        console.error('[Auth Check] Failed to delete session:', e)
      }
      cookieStore.delete('session')
    }
    
    return NextResponse.json({ user: null }, { status: 401 })
  }

  // Try to get current Drime user
  let drimeUser = null
  try {
    console.log('[Auth Check] Checking Drime session...')
    const drimeRes = await fetch(`${DRIME_API_URL}/api/v1/auth/external/me`, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader!,
        'Accept': 'application/json',
      },
    })

    if (drimeRes.ok) {
      const drimeData = await drimeRes.json()
      if (drimeData.user) {
        // Extract avatar URL - same logic as Transfr
        let avatarUrl = drimeData.user.avatar_url || drimeData.user.avatar || null
        
        // If avatar is a relative path, prepend the Drime API URL
        if (avatarUrl && !avatarUrl.startsWith('http')) {
          avatarUrl = `${DRIME_API_URL}/${avatarUrl.replace(/^\//, '')}`
        }
        
        drimeUser = {
          id: String(drimeData.user.id),
          email: drimeData.user.email,
          name: drimeData.user.name || drimeData.user.display_name || null,
          avatarUrl: avatarUrl,
        }
        console.log('[Auth Check] Drime user found:', drimeUser.email, 'avatar:', avatarUrl)
      } else {
        // Drime returned OK but no user = logged out
        console.log('[Auth Check] Drime returned no user - session expired')
        if (localSessionToken) {
          try {
            await prisma.session.deleteMany({ where: { token: localSessionToken } })
          } catch (e) { /* ignore */ }
          cookieStore.delete('session')
        }
        return NextResponse.json({ user: null }, { status: 401 })
      }
    } else {
      // Drime returned error
      console.log('[Auth Check] Drime returned error:', drimeRes.status)
      if (localSessionToken) {
        try {
          await prisma.session.deleteMany({ where: { token: localSessionToken } })
        } catch (e) { /* ignore */ }
        cookieStore.delete('session')
      }
      return NextResponse.json({ user: null }, { status: 401 })
    }
  } catch (error) {
    console.error('[Auth Check] Error checking Drime:', error)
    // On error, clear session to be safe
    if (localSessionToken) {
      try {
        await prisma.session.deleteMany({ where: { token: localSessionToken } })
      } catch (e) { /* ignore */ }
      cookieStore.delete('session')
    }
    return NextResponse.json({ user: null }, { status: 401 })
  }

  // We have a valid Drime user - now check/update local session
  if (localSessionToken) {
    try {
      const { payload } = await jwtVerify(localSessionToken, JWT_SECRET)
      const session = await prisma.session.findUnique({
        where: { token: localSessionToken },
        include: { user: true },
      })

      if (session && session.expiresAt > new Date()) {
        const localUser = session.user

        // Check if emails match
        if (localUser.email === drimeUser.email) {
          // Same user - update avatar if changed, then return session
          if (drimeUser.avatarUrl && drimeUser.avatarUrl !== localUser.avatarUrl) {
            await prisma.user.update({
              where: { id: localUser.id },
              data: { avatarUrl: drimeUser.avatarUrl },
            })
            localUser.avatarUrl = drimeUser.avatarUrl
          }
          
          console.log('[Auth Check] Session valid for:', localUser.email)
          return NextResponse.json({
            user: {
              id: localUser.id,
              email: localUser.email,
              name: localUser.name,
              avatarUrl: localUser.avatarUrl || drimeUser.avatarUrl,
            }
          })
        } else {
          // Different user - delete old session
          console.log('[Auth Check] User changed from', localUser.email, 'to', drimeUser.email)
          await prisma.session.deleteMany({ where: { token: localSessionToken } })
        }
      }
    } catch (error) {
      console.error('[Auth Check] Session verification error:', error)
    }
  }

  // Create new session for Drime user
  console.log('[Auth Check] Creating session for:', drimeUser.email)
  
  const user = await prisma.user.upsert({
    where: { email: drimeUser.email },
    update: {
      name: drimeUser.name,
      avatarUrl: drimeUser.avatarUrl,
      drimeUserId: drimeUser.id,
    },
    create: {
      email: drimeUser.email,
      name: drimeUser.name,
      avatarUrl: drimeUser.avatarUrl,
      drimeUserId: drimeUser.id,
    },
  })

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const token = await new SignJWT({ userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(JWT_SECRET)

  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  })

  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    }
  })
}
