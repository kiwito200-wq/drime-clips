import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSession, setSessionCookie } from '@/lib/auth'

// POST /api/auth/create-session
// Called from client after successful Drime auth
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name, id, avatar } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Create or update user in local DB
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        drimeUserId: id ? String(id) : undefined,
        name: name || undefined,
        avatarUrl: avatar || undefined,
      },
      create: {
        email,
        drimeUserId: id ? String(id) : null,
        name: name || null,
        avatarUrl: avatar || null,
      },
    })

    // Create local session
    const sessionToken = await createSession(user.id)
    
    // Set session cookie
    await setSessionCookie(sessionToken)



    return NextResponse.json({ 
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      }
    })
  } catch (error) {
    console.error('[Create Session] Error:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
