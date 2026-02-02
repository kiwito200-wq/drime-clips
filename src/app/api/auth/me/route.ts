import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, DRIME_LOGIN_URL } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth'
import { encrypt } from '@/lib/encryption'
import { PlanType } from '@/lib/subscription'

const DRIME_API_URL = 'https://app.drime.cloud'

// Plan priority (higher = better)
const PLAN_PRIORITY: Record<PlanType, number> = {
  'advanced': 4,
  'professional': 3,
  'essentials': 2,
  'starter': 1,
  'gratuit': 0,
}

/**
 * Extract drime_session token from cookie header
 */
function extractDrimeToken(cookieHeader: string): string | null {
  const match = cookieHeader.match(/drime_session=([^;]+)/)
  return match ? match[1] : null
}

/**
 * Map a product name to a plan type
 */
function mapProductToPlan(productName: string): PlanType {
  const name = productName.toLowerCase()
  
  if (name.includes('advanced')) return 'advanced'
  if (name.includes('professional') || name.includes('pro')) return 'professional'
  if (name.includes('essential')) return 'essentials'
  if (name.includes('starter')) return 'starter'
  
  // Lifetime subscriptions based on storage
  if (name.includes('lifetime') || name.includes('subscription')) {
    const tbMatch = name.match(/(\d+)\s*tb/i)
    const gbMatch = name.match(/(\d+)\s*gb/i)
    
    if (tbMatch) {
      const tb = parseInt(tbMatch[1])
      if (tb >= 6) return 'advanced'
      if (tb >= 3) return 'professional'
      return 'essentials' // 2TB and below
    }
    if (gbMatch) return 'starter'
  }
  
  return 'gratuit'
}

/**
 * Get the best plan from all subscriptions
 */
function getBestPlanFromSubscriptions(subscriptions: any[]): PlanType {
  let bestPlan: PlanType = 'gratuit'
  let bestPriority = 0
  
  for (const sub of subscriptions) {
    // Only consider active and valid subscriptions
    if (!sub.active || !sub.valid) continue
    
    const productName = sub.product?.name
    if (!productName) continue
    
    const plan = mapProductToPlan(productName)
    const priority = PLAN_PRIORITY[plan]
    
    console.log(`[Auth] Subscription "${productName}" -> plan "${plan}" (priority ${priority})`)
    
    if (priority > bestPriority) {
      bestPriority = priority
      bestPlan = plan
    }
  }
  
  console.log('[Auth] Best plan selected:', bestPlan)
  return bestPlan
}

// GET /api/auth/me - Check local session OR forward cookies to Drime
export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const hasDrimeSession = cookieHeader?.includes('drime_session')
    
    // 1. Check local session first
    const localUser = await getCurrentUser()
    
    if (localUser) {
      return NextResponse.json({ 
        user: {
          id: localUser.id,
          email: localUser.email,
          name: localUser.name,
          avatarUrl: localUser.avatarUrl,
        }
      })
    }
    
    // 2. No local session - forward ALL cookies to Drime
    if (cookieHeader && hasDrimeSession) {
      const drimeToken = extractDrimeToken(cookieHeader)
      
      // Get user info from Drime
      const drimeRes = await fetch(`${DRIME_API_URL}/api/v1/auth/external/me`, {
        method: 'GET',
        headers: {
          'Cookie': cookieHeader,
          'Accept': 'application/json',
        },
      })
      
      if (drimeRes.ok) {
        const drimeData = await drimeRes.json()
        
        if (drimeData.user) {
          // Extract avatar URL
          let avatarUrl = drimeData.user.avatar_url || drimeData.user.avatar || null
          if (avatarUrl && !avatarUrl.startsWith('http')) {
            avatarUrl = `${DRIME_API_URL}/${avatarUrl.replace(/^\//, '')}`
          }
          
          // Encrypt the Drime token before storing
          const encryptedDrimeToken = drimeToken ? encrypt(drimeToken) : null
          
          // Get subscription from Drime
          let subscriptionPlan: PlanType = 'gratuit'
          try {
            const subRes = await fetch(
              `${DRIME_API_URL}/api/v1/users/${drimeData.user.id}?with=subscriptions.product,subscriptions.price`,
              {
                headers: {
                  'Cookie': cookieHeader,
                  'Accept': 'application/json',
                },
              }
            )
            
            if (subRes.ok) {
              const subData = await subRes.json()
              const userData = subData.user || subData
              const subscriptions = userData.subscriptions || []
              
              console.log('[Auth] Found', subscriptions.length, 'subscriptions')
              
              // Get the best plan from all subscriptions
              subscriptionPlan = getBestPlanFromSubscriptions(subscriptions)
            } else {
              console.log('[Auth] Subscription fetch failed:', subRes.status)
            }
          } catch (subError) {
            console.error('[Auth] Error fetching subscription:', subError)
          }
          
          // Create local user and session
          const user = await prisma.user.upsert({
            where: { email: drimeData.user.email },
            update: {
              name: drimeData.user.name || drimeData.user.display_name,
              avatarUrl: avatarUrl,
              drimeUserId: String(drimeData.user.id),
              drimeToken: encryptedDrimeToken,
              subscriptionPlan: subscriptionPlan,
              subscriptionUpdatedAt: new Date(),
            },
            create: {
              email: drimeData.user.email,
              name: drimeData.user.name || drimeData.user.display_name,
              avatarUrl: avatarUrl,
              drimeUserId: String(drimeData.user.id),
              drimeToken: encryptedDrimeToken,
              subscriptionPlan: subscriptionPlan,
              subscriptionUpdatedAt: new Date(),
            },
          })
          
          // Create session
          const sessionToken = await createSession(user.id)
          
          // Return user with session cookie
          const response = NextResponse.json({ 
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              avatarUrl: user.avatarUrl,
            }
          })
          
          response.cookies.set('session', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60,
            path: '/',
          })
          
          return response
        }
      }
    }
    
    // No valid session
    return NextResponse.json({ 
      user: null,
      loginUrl: DRIME_LOGIN_URL,
    }, { status: 401 })
  } catch (error) {
    console.error('Error in /api/auth/me:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
