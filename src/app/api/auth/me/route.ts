import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, DRIME_LOGIN_URL } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth'

const DRIME_API_URL = 'https://front.preprod.drime.cloud'

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
    
    console.log('[Auth] Cookies received from browser:', cookieHeader?.substring(0, 200))
    
    if (cookieHeader) {
      // Check if we have drime_session cookie
      const hasDrimeSession = cookieHeader.includes('drime_session')
      console.log('[Auth] Has drime_session cookie:', hasDrimeSession)
      
      if (hasDrimeSession) {
        // Forward cookies to Drime
        console.log('[Auth] Forwarding cookies to Drime...')
        
        const drimeRes = await fetch(`${DRIME_API_URL}/api/v1/auth/external/me`, {
          method: 'GET',
          headers: {
            'Cookie': cookieHeader,
            'Accept': 'application/json',
          },
        })
        
        console.log('[Auth] Drime response status:', drimeRes.status)
        
        if (drimeRes.ok) {
          const drimeData = await drimeRes.json()
          console.log('[Auth] Drime full response:', JSON.stringify(drimeData).substring(0, 500))
          
          if (drimeData.user) {
            // Log all user fields to find the avatar
            console.log('[Auth] Drime user fields:', Object.keys(drimeData.user))
            
            // Extract avatar URL - same logic as Transfr
            let avatarUrl = drimeData.user.avatar_url || drimeData.user.avatar || null
            
            // If avatar is a relative path, prepend the Drime API URL
            if (avatarUrl && !avatarUrl.startsWith('http')) {
              avatarUrl = `${DRIME_API_URL}/${avatarUrl.replace(/^\//, '')}`
            }
            
            console.log('[Auth] Avatar URL found:', avatarUrl)
            
            // Create local user and session
            const user = await prisma.user.upsert({
              where: { email: drimeData.user.email },
              update: {
                name: drimeData.user.name || drimeData.user.display_name,
                avatarUrl: avatarUrl,
                drimeUserId: String(drimeData.user.id),
              },
              create: {
                email: drimeData.user.email,
                name: drimeData.user.name || drimeData.user.display_name,
                avatarUrl: avatarUrl,
                drimeUserId: String(drimeData.user.id),
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
            
            console.log('[Auth] Local session created for:', user.email)
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
