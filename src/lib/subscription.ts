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
  
  // Direct plan names
  if (normalized.includes('advanced')) return 'advanced'
  if (normalized.includes('professional') || normalized.includes('pro')) return 'professional'
  if (normalized.includes('essential')) return 'essentials'
  if (normalized.includes('starter')) return 'starter'
  if (normalized.includes('gratuit') || normalized.includes('free')) return 'gratuit'
  
  // Lifetime subscriptions based on storage (e.g. "Lifetime Subscription: 6TB")
  const tbMatch = normalized.match(/(\d+)\s*tb/i)
  if (tbMatch) {
    const tb = parseInt(tbMatch[1])
    if (tb >= 6) return 'advanced'
    if (tb >= 3) return 'professional'
    return 'essentials' // 2TB and below
  }
  
  const gbMatch = normalized.match(/(\d+)\s*gb/i)
  if (gbMatch) return 'starter'
  
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
 * Uses the user's own Drime session cookie to fetch their subscription data
 */
export async function syncSubscriptionFromDrime(
  userId: string, 
  drimeUserId: string,
  drimeSessionToken: string // User's drime_session cookie value
): Promise<PlanType> {
  const DRIME_API_URL = process.env.DRIME_API_URL || 'https://app.drime.cloud'
  
  if (!drimeSessionToken) {
    console.error('[Subscription] No Drime session token available for user:', drimeUserId)
    return 'gratuit'
  }
  
  try {
    // Use the authenticated /me endpoint with user's session cookie
    const apiUrl = `${DRIME_API_URL}/api/v1/auth/external/me?with=subscriptions.product,subscriptions.price`
    console.log('[Subscription] Syncing subscription for user:', drimeUserId)
    console.log('[Subscription] API URL:', apiUrl)
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Cookie': `drime_session=${drimeSessionToken}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Subscription] Failed to fetch from Drime:', response.status, errorText.substring(0, 500))
      return 'gratuit'
    }

    const data = await response.json()
    console.log('[Subscription] Drime response:', JSON.stringify(data).substring(0, 500))
    
    const user = data.user || data

    // Find ALL active subscriptions and get the best plan
    const subscriptions = user.subscriptions || []
    console.log('[Subscription] Found subscriptions:', subscriptions.length)
    
    // Plan priority (higher = better)
    const planPriority: Record<PlanType, number> = {
      'advanced': 4,
      'professional': 3,
      'essentials': 2,
      'starter': 1,
      'gratuit': 0,
    }
    
    let plan: PlanType = 'gratuit'
    let bestPriority = 0
    
    for (const sub of subscriptions) {
      if (!sub.active || !sub.valid) continue
      
      const productName = sub.product?.name
      if (!productName) continue
      
      const mappedPlan = mapDrimeProductToPlan(productName)
      const priority = planPriority[mappedPlan]
      
      console.log(`[Subscription] "${productName}" -> ${mappedPlan} (priority ${priority})`)
      
      if (priority > bestPriority) {
        bestPriority = priority
        plan = mappedPlan
      }
    }
    
    console.log('[Subscription] Best plan:', plan)

    // Update user's cached subscription
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: plan,
        subscriptionUpdatedAt: new Date(),
      }
    })

    console.log('[Subscription] Updated user subscription to:', plan)
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
