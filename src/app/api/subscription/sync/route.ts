import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PlanType } from '@/lib/subscription'

/**
 * POST /api/subscription/sync
 * Receives subscription data from frontend (which fetched it directly from Drime)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subscriptions } = body

    console.log('[Subscription Sync] Received subscriptions:', JSON.stringify(subscriptions).substring(0, 500))

    if (!subscriptions || !Array.isArray(subscriptions)) {
      return NextResponse.json({ error: 'Invalid subscriptions data' }, { status: 400 })
    }

    // Find active subscription
    const activeSubscription = subscriptions.find((sub: any) => sub.active && sub.valid)
    
    let subscriptionPlan: PlanType = 'gratuit'
    
    if (activeSubscription?.product?.name) {
      const productName = activeSubscription.product.name.toLowerCase()
      console.log('[Subscription Sync] Active product:', productName)
      
      // Map product names to plans
      if (productName.includes('advanced')) {
        subscriptionPlan = 'advanced'
      } else if (productName.includes('professional') || productName.includes('pro')) {
        subscriptionPlan = 'professional'
      } else if (productName.includes('essential')) {
        subscriptionPlan = 'essentials'
      } else if (productName.includes('starter')) {
        subscriptionPlan = 'starter'
      }
      // Lifetime subscriptions based on storage
      else if (productName.includes('lifetime')) {
        const tbMatch = productName.match(/(\d+)\s*tb/i)
        const gbMatch = productName.match(/(\d+)\s*gb/i)
        
        if (tbMatch) {
          const tb = parseInt(tbMatch[1])
          console.log('[Subscription Sync] Lifetime TB:', tb)
          if (tb >= 6) subscriptionPlan = 'advanced'
          else if (tb >= 3) subscriptionPlan = 'professional'
          else subscriptionPlan = 'essentials'
        } else if (gbMatch) {
          subscriptionPlan = 'starter'
        }
      }
    }

    console.log('[Subscription Sync] Mapped plan:', subscriptionPlan)

    // Update user subscription
    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionPlan: subscriptionPlan,
        subscriptionUpdatedAt: new Date(),
      },
    })

    console.log('[Subscription Sync] Updated user subscription to:', subscriptionPlan)

    return NextResponse.json({
      success: true,
      plan: subscriptionPlan,
    })
  } catch (error) {
    console.error('[Subscription Sync] Error:', error)
    return NextResponse.json({ error: 'Failed to sync subscription' }, { status: 500 })
  }
}
