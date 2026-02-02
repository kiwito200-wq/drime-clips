import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const cookieStore = cookies()
    const sessionToken = cookieStore.get('session')?.value

    // Delete session from database
    if (sessionToken) {
      await prisma.session.deleteMany({
        where: { token: sessionToken }
      })
    }

    // Clear the session cookie
    cookieStore.delete('session')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ success: true }) // Still return success to clear client
  }
}

export async function GET() {
  // Also support GET for simple redirects
  const cookieStore = cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (sessionToken) {
    try {
      await prisma.session.deleteMany({
        where: { token: sessionToken }
      })
    } catch (e) {
      console.error('Failed to delete session:', e)
    }
  }

  cookieStore.delete('session')

  // Redirect to Drime login
  return NextResponse.redirect('https://app.drime.cloud/login')
}
