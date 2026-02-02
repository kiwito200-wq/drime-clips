import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/user/onboarding
 * Check if onboarding has been completed
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { onboardingCompletedAt: true }
    })

    return NextResponse.json({
      completed: !!dbUser?.onboardingCompletedAt,
      completedAt: dbUser?.onboardingCompletedAt?.toISOString() || null
    })
  } catch (error) {
    console.error('[Onboarding API] Error checking status:', error)
    return NextResponse.json({ error: 'Failed to check onboarding status' }, { status: 500 })
  }
}

/**
 * POST /api/user/onboarding
 * Mark onboarding as complete
 */
export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingCompletedAt: new Date() }
    })

    console.log('[Onboarding API] Marked complete for user:', user.id)

    return NextResponse.json({
      success: true,
      completedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Onboarding API] Error marking complete:', error)
    return NextResponse.json({ error: 'Failed to mark onboarding complete' }, { status: 500 })
  }
}
