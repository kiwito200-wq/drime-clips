import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSession, setSessionCookie } from '@/lib/auth'

/**
 * DEV LOGIN - Temporary endpoint for development/testing
 * This allows logging in with just an email while Drime CORS is being configured
 * 
 * In production, this should be disabled or protected
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }
    
    // Get or create user
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        // Just update the timestamp
      },
      create: {
        email,
        name: email.split('@')[0], // Use email prefix as name
      },
    })
    
    // Create session
    const sessionToken = await createSession(user.id)
    
    // Set session cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    })
    
    // Set cookie manually on response
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    })
    

    
    return response
  } catch (error) {
    console.error('[Dev Login] Error:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
