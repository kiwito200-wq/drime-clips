import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getSubscriptionInfo, syncSubscriptionFromDrime } from '@/lib/subscription'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/subscription
 * Get current user's subscription info and usage
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const info = await getSubscriptionInfo(user.id)
    
    return NextResponse.json({
      plan: info.plan,
      planName: info.planName,
      signatureRequests: {
        used: info.signatureRequestsUsed,
        limit: info.signatureRequestsLimit,
        remaining: info.signatureRequestsRemaining,
        isUnlimited: info.isUnlimited,
      },
      canCreateSignatureRequest: info.canCreateSignatureRequest,
      resetDate: info.resetDate?.toISOString() || null,
    })
  } catch (error) {
    console.error('[Subscription API] Error:', error)
    return NextResponse.json({ error: 'Failed to get subscription info' }, { status: 500 })
  }
}

/**
 * POST /api/subscription/sync
 * Force sync subscription from Drime API
 * Uses current browser cookies to authenticate with Drime
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's Drime credentials
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        drimeUserId: true,
      }
    })

    if (!dbUser?.drimeUserId) {
      return NextResponse.json({ 
        error: 'No Drime account linked',
        plan: 'gratuit',
      }, { status: 200 })
    }

    // Get current cookies from the request (fresh session, not stored old token)
    const cookieHeader = request.headers.get('cookie') || ''
    
    // Extract drime_session from cookies
    const drimeSessionMatch = cookieHeader.match(/drime_session=([^;]+)/)
    const drimeSessionToken = drimeSessionMatch ? drimeSessionMatch[1] : ''
    
    if (!drimeSessionToken) {
      console.log('[Subscription] No drime_session cookie found')
      return NextResponse.json({ 
        error: 'No Drime session',
        plan: 'gratuit',
      }, { status: 200 })
    }

    // Sync from Drime using current session
    const plan = await syncSubscriptionFromDrime(user.id, dbUser.drimeUserId, drimeSessionToken)
    
    // Get updated info
    const info = await getSubscriptionInfo(user.id)

    return NextResponse.json({
      synced: true,
      plan: info.plan,
      planName: info.planName,
      signatureRequests: {
        used: info.signatureRequestsUsed,
        limit: info.signatureRequestsLimit,
        remaining: info.signatureRequestsRemaining,
        isUnlimited: info.isUnlimited,
      },
      canCreateSignatureRequest: info.canCreateSignatureRequest,
      resetDate: info.resetDate?.toISOString() || null,
    })
  } catch (error) {
    console.error('[Subscription Sync] Error:', error)
    return NextResponse.json({ error: 'Failed to sync subscription' }, { status: 500 })
  }
}
