import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, checkDrimeSession, getOrCreateUserFromDrime, createSession, setSessionCookie, DRIME_LOGIN_URL } from '@/lib/auth'

// GET /api/auth/me - Check local session OR Drime session
export async function GET(request: NextRequest) {
  try {
    // First check if we have a local session
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
    
    // No local session - check Drime session
    const cookieHeader = request.headers.get('cookie')
    const drimeUser = await checkDrimeSession(cookieHeader)
    
    if (drimeUser) {
      // Create local user and session from Drime data
      const user = await getOrCreateUserFromDrime(drimeUser)
      const sessionToken = await createSession(user.id)
      await setSessionCookie(sessionToken)
      
      return NextResponse.json({ 
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        }
      })
    }
    
    // No session at all - return login URL for redirect
    return NextResponse.json({ 
      user: null,
      loginUrl: DRIME_LOGIN_URL,
    }, { status: 401 })
  } catch (error) {
    console.error('Error in /api/auth/me:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
