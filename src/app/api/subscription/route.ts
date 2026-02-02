import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getSubscriptionInfo, syncSubscriptionFromDrime } from '@/lib/subscription'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

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
 * Uses stored token OR current browser cookies
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
        drimeToken: true,
      }
    })

    if (!dbUser?.drimeUserId) {
      return NextResponse.json({ 
        error: 'No Drime account linked',
        plan: 'gratuit',
      }, { status: 200 })
    }

    // Try to get token: first from stored token, then from current cookies
    let token = ''
    
    // 1. Try stored token (decrypt if needed)
    if (dbUser.drimeToken) {
      token = dbUser.drimeToken
      if (token.includes(':')) {
        try {
          token = decrypt(token)
        } catch {
          // Token might not be encrypted
        }
      }
    }
    
    // 2. Fallback: try current cookies
    if (!token) {
      const cookieHeader = request.headers.get('cookie') || ''
      const drimeSessionMatch = cookieHeader.match(/drime_session=([^;]+)/)
      token = drimeSessionMatch ? drimeSessionMatch[1] : ''
    }
    
    if (!token) {
      console.log('[Subscription] No Drime token available')
      return NextResponse.json({ 
        error: 'No Drime token',
        plan: 'gratuit',
      }, { status: 200 })
    }

    console.log('[Subscription] Using token (prefix):', token.substring(0, 15) + '...')

    // Sync from Drime
    const plan = await syncSubscriptionFromDrime(user.id, dbUser.drimeUserId, token)
    
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
