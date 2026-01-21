import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

// GET /api/auth/me - Check if user has a local session
// Note: Drime auto-login is handled client-side in the dashboard
export async function GET() {
  try {
    const user = await getCurrentUser()
    
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
