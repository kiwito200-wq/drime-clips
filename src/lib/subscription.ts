/**
 * Subscription & Usage Limits Management
 * 
 * Manages signature request limits based on Drime subscription plans
 */

import { prisma } from './prisma'

// Plan limits configuration
export const PLAN_LIMITS = {
  gratuit: {
    name: 'Gratuit',
    signatureRequestsPerMonth: 3,
    unlimited: false,
  },
  starter: {
    name: 'Starter',
    signatureRequestsPerMonth: 3,
    unlimited: false,
  },
  essentials: {
    name: 'Essentials',
    signatureRequestsPerMonth: -1, // Unlimited
    unlimited: true,
  },
  professional: {
    name: 'Professional',
    signatureRequestsPerMonth: -1,
    unlimited: true,
  },
  advanced: {
    name: 'Advanced',
    signatureRequestsPerMonth: -1,
    unlimited: true,
  },
} as const

export type PlanType = keyof typeof PLAN_LIMITS

// Map Drime product names to our plan types
function mapDrimeProductToPlan(productName: string | null): PlanType {
  if (!productName) return 'gratuit'
  
  const normalized = productName.toLowerCase().trim()
  
  if (normalized.includes('advanced')) return 'advanced'
  if (normalized.includes('professional') || normalized.includes('pro')) return 'professional'
  if (normalized.includes('essential')) return 'essentials'
  if (normalized.includes('starter')) return 'starter'
  if (normalized.includes('gratuit') || normalized.includes('free')) return 'gratuit'
  
  // Default to gratuit if unknown
  return 'gratuit'
}

export interface SubscriptionInfo {
  plan: PlanType
  planName: string
  signatureRequestsUsed: number
  signatureRequestsLimit: number
  signatureRequestsRemaining: number
  isUnlimited: boolean
  canCreateSignatureRequest: boolean
  resetDate: Date | null
}

/**
 * Get the current subscription info for a user
 */
export async function getSubscriptionInfo(userId: string): Promise<SubscriptionInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionPlan: true,
      signatureRequestsThisMonth: true,
      signatureRequestsResetAt: true,
    }
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Check if we need to reset monthly counter
  const now = new Date()
  const resetAt = user.signatureRequestsResetAt
  let requestsUsed = user.signatureRequestsThisMonth

  if (!resetAt || now >= resetAt) {
    // Reset counter - it's a new month
    requestsUsed = 0
    const nextReset = getNextMonthReset()
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        signatureRequestsThisMonth: 0,
        signatureRequestsResetAt: nextReset,
      }
    })
  }

  const plan = (user.subscriptionPlan as PlanType) || 'gratuit'
  const planConfig = PLAN_LIMITS[plan] || PLAN_LIMITS.gratuit
  const isUnlimited = planConfig.unlimited
  const limit = planConfig.signatureRequestsPerMonth
  const remaining = isUnlimited ? -1 : Math.max(0, limit - requestsUsed)

  return {
    plan,
    planName: planConfig.name,
    signatureRequestsUsed: requestsUsed,
    signatureRequestsLimit: limit,
    signatureRequestsRemaining: remaining,
    isUnlimited,
    canCreateSignatureRequest: isUnlimited || remaining > 0,
    resetDate: user.signatureRequestsResetAt,
  }
}

/**
 * Increment signature request counter for a user
 * Returns false if limit reached
 */
export async function consumeSignatureRequest(userId: string): Promise<{ success: boolean; info: SubscriptionInfo }> {
  const info = await getSubscriptionInfo(userId)

  if (!info.canCreateSignatureRequest) {
    return { success: false, info }
  }

  // Increment counter (only if not unlimited)
  if (!info.isUnlimited) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        signatureRequestsThisMonth: { increment: 1 },
      }
    })
  }

  // Return updated info
  const updatedInfo = await getSubscriptionInfo(userId)
  return { success: true, info: updatedInfo }
}

/**
 * Sync subscription from Drime API
 */
export async function syncSubscriptionFromDrime(
  userId: string, 
  drimeUserId: string,
  drimeToken: string
): Promise<PlanType> {
  const DRIME_API_URL = process.env.DRIME_API_URL || 'https://api.preprod.drime.cloud'
  
  try {
    const response = await fetch(
      `${DRIME_API_URL}/api/v1/users/${drimeUserId}?with=subscriptions.product,subscriptions.price`,
      {
        headers: {
          'Authorization': `Bearer ${drimeToken}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error('[Subscription] Failed to fetch from Drime:', response.status)
      return 'gratuit'
    }

    const data = await response.json()
    const user = data.user || data

    // Find active subscription
    const subscriptions = user.subscriptions || []
    const activeSubscription = subscriptions.find((sub: any) => sub.active && sub.valid)

    let plan: PlanType = 'gratuit'
    
    if (activeSubscription?.product?.name) {
      plan = mapDrimeProductToPlan(activeSubscription.product.name)
    }

    // Update user's cached subscription
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: plan,
        subscriptionUpdatedAt: new Date(),
      }
    })


    return plan
  } catch (error) {
    console.error('[Subscription] Error syncing from Drime:', error)
    return 'gratuit'
  }
}

/**
 * Get the first day of next month for reset
 */
function getNextMonthReset(): Date {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0)
  return nextMonth
}

/**
 * Format remaining days until reset
 */
export function formatResetDate(resetDate: Date | null): string {
  if (!resetDate) return ''
  
  const now = new Date()
  const diffMs = resetDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays <= 0) return 'Aujourd\'hui'
  if (diffDays === 1) return 'Demain'
  return `Dans ${diffDays} jours`
}
