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
 * NOTE: All users have unlimited signatures (Drime API sync disabled)
 */
export async function getSubscriptionInfo(userId: string): Promise<SubscriptionInfo> {
  // Everyone gets unlimited signatures - no need to check Drime API
  return {
    plan: 'advanced',
    planName: 'Advanced',
    signatureRequestsUsed: 0,
    signatureRequestsLimit: -1,
    signatureRequestsRemaining: -1,
    isUnlimited: true,
    canCreateSignatureRequest: true,
    resetDate: null,
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
 * NOTE: Disabled - all users have unlimited signatures
 */
export async function syncSubscriptionFromDrime(
  _userId: string, 
  _drimeUserId: string,
  _drimeToken: string
): Promise<PlanType> {
  // Everyone gets advanced plan with unlimited signatures
  return 'advanced'
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
