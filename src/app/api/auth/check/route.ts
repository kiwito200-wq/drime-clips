import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
)

const DRIME_API_URL = process.env.DRIME_API_URL || 'https://app.drime.cloud'

/**
 * Check authentication by verifying with Drime
 * This ensures the local session matches the current Drime user
 */
export async function GET(request: NextRequest) {
  const cookieStore = cookies()
  const localSessionToken = cookieStore.get('session')?.value

  // Get all cookies to forward to Drime
  const cookieHeader = request.headers.get('cookie')

  console.log('[Auth Check] Starting auth verification...')
  console.log('[Auth Check] Has local session:', !!localSessionToken)
  console.log('[Auth Check] Has drime_session cookie:', cookieHeader?.includes('drime_session'))

  // Try to get current Drime user
  let drimeUser = null
  if (cookieHeader?.includes('drime_session')) {
    try {
      console.log('[Auth Check] Checking Drime session...')
      const drimeRes = await fetch(`${DRIME_API_URL}/api/v1/auth/external/me`, {
        method: 'GET',
        headers: {
          'Cookie': cookieHeader,
          'Accept': 'application/json',
        },
      })

      if (drimeRes.ok) {
        const drimeData = await drimeRes.json()
        if (drimeData.user) {
          drimeUser = {
            id: String(drimeData.user.id),
            email: drimeData.user.email,
            name: drimeData.user.name || drimeData.user.display_name || null,
            avatarUrl: drimeData.user.avatar_url || null,
          }
          console.log('[Auth Check] Drime user found:', drimeUser.email)
        }
      }
    } catch (error) {
      console.error('[Auth Check] Error checking Drime:', error)
    }
  }

  // If we have a local session, verify it
  if (localSessionToken) {
    try {
      const { payload } = await jwtVerify(localSessionToken, JWT_SECRET)
      const userId = payload.userId as string

      const session = await prisma.session.findUnique({
        where: { token: localSessionToken },
        include: { user: true },
      })

      if (session && session.expiresAt > new Date()) {
        const localUser = session.user

        // If we have a Drime user, check if it matches
        if (drimeUser) {
          // Check if emails match
          if (localUser.email !== drimeUser.email) {
            console.log('[Auth Check] User mismatch! Local:', localUser.email, 'Drime:', drimeUser.email)
            
            // Clear the old session
            await prisma.session.deleteMany({ where: { token: localSessionToken } })
            cookieStore.delete('session')

            // Create new session for Drime user
            const newUser = await prisma.user.upsert({
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

            // Create new session
            const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            const newToken = await new SignJWT({ userId: newUser.id })
              .setProtectedHeader({ alg: 'HS256' })
              .setIssuedAt()
              .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
              .sign(JWT_SECRET)

            await prisma.session.create({
              data: {
                userId: newUser.id,
                token: newToken,
                expiresAt,
              },
            })

            // Set new session cookie
            cookieStore.set('session', newToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 30 * 24 * 60 * 60,
              path: '/',
            })

            console.log('[Auth Check] Switched to new user:', drimeUser.email)
            
            return NextResponse.json({
              user: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
                avatarUrl: newUser.avatarUrl,
              }
            })
          }
        }

        // User matches or no Drime session - return local user
        console.log('[Auth Check] Returning local user:', localUser.email)
        return NextResponse.json({
          user: {
            id: localUser.id,
            email: localUser.email,
            name: localUser.name,
            avatarUrl: localUser.avatarUrl,
          }
        })
      }
    } catch (error) {
      console.error('[Auth Check] Session verification error:', error)
    }
  }

  // No valid local session - try to create one from Drime
  if (drimeUser) {
    console.log('[Auth Check] Creating new session from Drime user:', drimeUser.email)
    
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

  // No session at all
  console.log('[Auth Check] No valid session found')
  return NextResponse.json({ user: null }, { status: 401 })
}
