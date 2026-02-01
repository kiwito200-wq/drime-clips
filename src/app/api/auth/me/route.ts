import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, DRIME_LOGIN_URL } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth'
import { encrypt } from '@/lib/encryption'

const DRIME_API_URL = 'https://front.preprod.drime.cloud'

/**
 * Extract drime_session token from cookie header
 */
function extractDrimeToken(cookieHeader: string): string | null {
  const match = cookieHeader.match(/drime_session=([^;]+)/)
  return match ? match[1] : null
}

// GET /api/auth/me - Check local session OR forward cookies to Drime
export async function GET(request: NextRequest) {
  try {
    // 1. Check local session first
    const localUser = await getCurrentUser()
    
    if (localUser) {
      return NextResponse.json({ 
        user: {
          id: localUser.id,
          email: localUser.email,
          name: localUser.name,
          avatarUrl: localUser.avatarUrl,
        }
      })
    }
    
    // 2. No local session - forward ALL cookies to Drime
    const cookieHeader = request.headers.get('cookie')
    
    if (cookieHeader) {
      // Check if we have drime_session cookie
      const hasDrimeSession = cookieHeader.includes('drime_session')

      
      if (hasDrimeSession) {
        // Extract the drime_session token for storage
        const drimeToken = extractDrimeToken(cookieHeader)
        
        // Forward cookies to Drime
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
            // Extract avatar URL - same logic as Transfr
            let avatarUrl = drimeData.user.avatar_url || drimeData.user.avatar || null
            
            // If avatar is a relative path, prepend the Drime API URL
            if (avatarUrl && !avatarUrl.startsWith('http')) {
              avatarUrl = `${DRIME_API_URL}/${avatarUrl.replace(/^\//, '')}`
            }
            
            // Encrypt the Drime token before storing
            const encryptedDrimeToken = drimeToken ? encrypt(drimeToken) : null
            
            // Create local user and session (including drimeToken!)
            const user = await prisma.user.upsert({
              where: { email: drimeData.user.email },
              update: {
                name: drimeData.user.name || drimeData.user.display_name,
                avatarUrl: avatarUrl,
                drimeUserId: String(drimeData.user.id),
                drimeToken: encryptedDrimeToken, // Store encrypted token!
              },
              create: {
                email: drimeData.user.email,
                name: drimeData.user.name || drimeData.user.display_name,
                avatarUrl: avatarUrl,
                drimeUserId: String(drimeData.user.id),
                drimeToken: encryptedDrimeToken, // Store encrypted token!
              },
            })
            
            // Create session
            const sessionToken = await createSession(user.id)
            
            // Return user with session cookie
            const response = NextResponse.json({ 
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
              }
            })
            
            response.cookies.set('session', sessionToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 30 * 24 * 60 * 60,
              path: '/',
            })
            

            return response
          }
        }
      }
    }
    
    // No valid session
    return NextResponse.json({ 
      user: null,
      loginUrl: DRIME_LOGIN_URL,
    }, { status: 401 })
  } catch (error) {
    console.error('Error in /api/auth/me:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
