import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { attemptDrimeAutoLogin } from '@/lib/drime-auth'

export async function GET(request: NextRequest) {
  try {
    // First try to get existing session
    let user = await getCurrentUser()
    
    // If no local session, try Drime auto-login
    if (!user) {
      const autoLoginResult = await attemptDrimeAutoLogin(request)
      if (autoLoginResult.user) {
        return NextResponse.json({ 
          user: autoLoginResult.user,
          autoLoggedIn: true 
        })
      }
    }
    
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }
    
    return NextResponse.json({ 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      }
    })
  } catch (error) {
    console.error('Error in /api/auth/me:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
