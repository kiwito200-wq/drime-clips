import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, DRIME_LOGIN_URL } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth'
import { encrypt } from '@/lib/encryption'
import { PLAN_LIMITS, PlanType } from '@/lib/subscription'

const DRIME_API_URL = 'https://app.drime.cloud'

/**
 * Extract drime_session token from cookie header
 */
function extractDrimeToken(cookieHeader: string): string | null {
  const match = cookieHeader.match(/drime_session=([^;]+)/)
  return match ? match[1] : null
}

/**
 * Sync subscription using full browser cookies
 */
async function syncSubscriptionWithBrowserCookies(
  userId: string,
  drimeUserId: string,
  cookieHeader: string
): Promise<void> {
  try {
    console.log('[Auth] Syncing subscription with browser cookies for user:', drimeUserId)
    
    const subRes = await fetch(
      `${DRIME_API_URL}/api/v1/users/${drimeUserId}?with=subscriptions.product`,
      {
        headers: {
          'Cookie': cookieHeader,
          'Accept': 'application/json',
        },
      }
    )
    
    if (!subRes.ok) {
      console.log('[Auth] Subscription fetch failed:', subRes.status)
      return
    }
    
    const subData = await subRes.json()
    console.log('[Auth] Subscription response:', JSON.stringify(subData).substring(0, 1000))
    
    const userData = subData.user || subData
    const subscriptions = userData.subscriptions || []
    console.log('[Auth] Found subscriptions:', subscriptions.length)
    
    if (subscriptions.length === 0) return
    
    const activeSubscription = subscriptions.find((sub: any) => sub.active && sub.valid)
    if (!activeSubscription?.product?.name) return
    
    const productName = activeSubscription.product.name.toLowerCase()
    console.log('[Auth] Active subscription product:', productName)
    
    let subscriptionPlan: PlanType = 'gratuit'
    
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
        console.log('[Auth] Lifetime TB:', tb)
        if (tb >= 6) subscriptionPlan = 'advanced'
        else if (tb >= 3) subscriptionPlan = 'professional'
        else subscriptionPlan = 'essentials'
      } else if (gbMatch) {
        subscriptionPlan = 'starter'
      }
    }
    
    console.log('[Auth] Mapped subscription plan:', subscriptionPlan)
    
    // Update user subscription
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionPlan: subscriptionPlan,
        subscriptionUpdatedAt: new Date(),
      },
    })
    
    console.log('[Auth] Updated subscription to:', subscriptionPlan)
  } catch (error) {
    console.error('[Auth] Subscription sync error:', error)
  }
}

// GET /api/auth/me - Check local session OR forward cookies to Drime
export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const hasDrimeSession = cookieHeader?.includes('drime_session')
    
    // 1. Check local session first
    const localUser = await getCurrentUser()
    
    if (localUser) {
      // If we have Drime cookies, sync subscription in background
      if (hasDrimeSession && localUser.drimeUserId) {
        // Sync subscription using browser cookies (non-blocking)
        syncSubscriptionWithBrowserCookies(localUser.id, localUser.drimeUserId, cookieHeader!)
          .catch(err => console.error('[Auth] Background subscription sync error:', err))
      }
      
      // Get fresh subscription info
      const dbUser = await prisma.user.findUnique({
        where: { id: localUser.id },
        select: { subscriptionPlan: true }
      })
      
      return NextResponse.json({ 
        user: {
          id: localUser.id,
          email: localUser.email,
          name: localUser.name,
          avatarUrl: localUser.avatarUrl,
          subscriptionPlan: dbUser?.subscriptionPlan || 'gratuit',
        }
      })
    }
    
    // 2. No local session - forward ALL cookies to Drime
    if (cookieHeader) {
      // Check if we have drime_session cookie

      
      if (hasDrimeSession) {
        // Extract the drime_session token for storage
        const drimeToken = extractDrimeToken(cookieHeader)
        
        // Forward cookies to Drime
        const drimeRes = await fetch(`${DRIME_API_URL}/api/v1/auth/external/me`, {
          method: 'GET',
          headers: {
            'Cookie': cookieHeader,
            'Accept': 'application/json',
          },
        })
        
        if (drimeRes.ok) {
          const drimeData = await drimeRes.json()
          console.log('[Auth] Drime /me response:', JSON.stringify(drimeData).substring(0, 500))
          
          if (drimeData.user) {
            // Extract avatar URL - same logic as Transfr
            let avatarUrl = drimeData.user.avatar_url || drimeData.user.avatar || null
            
            // If avatar is a relative path, prepend the Drime API URL
            if (avatarUrl && !avatarUrl.startsWith('http')) {
              avatarUrl = `${DRIME_API_URL}/${avatarUrl.replace(/^\//, '')}`
            }
            
            // Encrypt the Drime token before storing
            const encryptedDrimeToken = drimeToken ? encrypt(drimeToken) : null
            
            // Fetch subscription separately using full browser cookies
            let subscriptionPlan: PlanType = 'gratuit'
            try {
              const subRes = await fetch(
                `${DRIME_API_URL}/api/v1/users/${drimeData.user.id}?with=subscriptions.product`,
                {
                  headers: {
                    'Cookie': cookieHeader, // Use full browser cookies!
                    'Accept': 'application/json',
                  },
                }
              )
              
              if (subRes.ok) {
                const subData = await subRes.json()
                console.log('[Auth] Subscription response:', JSON.stringify(subData).substring(0, 1000))
                
                const userData = subData.user || subData
                const subscriptions = userData.subscriptions || []
                console.log('[Auth] Found subscriptions:', subscriptions.length)
                
                const activeSubscription = subscriptions.find((sub: any) => sub.active && sub.valid)
                if (activeSubscription?.product?.name) {
                  const productName = activeSubscription.product.name.toLowerCase()
                  console.log('[Auth] Active subscription product:', productName)
                  
                  // Map product names to plans
                  // Direct plan names
                  if (productName.includes('advanced')) {
                    subscriptionPlan = 'advanced'
                  } else if (productName.includes('professional') || productName.includes('pro')) {
                    subscriptionPlan = 'professional'
                  } else if (productName.includes('essential')) {
                    subscriptionPlan = 'essentials'
                  } else if (productName.includes('starter')) {
                    subscriptionPlan = 'starter'
                  }
                  // Lifetime subscriptions based on storage (2TB=Essentials, 3TB=Pro, 6TB+=Advanced)
                  else if (productName.includes('lifetime')) {
                    // Extract TB value from name like "Lifetime Subscription: 6TB"
                    const tbMatch = productName.match(/(\d+)\s*tb/i)
                    const gbMatch = productName.match(/(\d+)\s*gb/i)
                    
                    if (tbMatch) {
                      const tb = parseInt(tbMatch[1])
                      console.log('[Auth] Lifetime TB:', tb)
                      if (tb >= 6) {
                        subscriptionPlan = 'advanced'
                      } else if (tb >= 3) {
                        subscriptionPlan = 'professional'
                      } else {
                        subscriptionPlan = 'essentials' // 2TB and below
                      }
                    } else if (gbMatch) {
                      // 500GB = starter level
                      subscriptionPlan = 'starter'
                    }
                  }
                  console.log('[Auth] Mapped subscription plan:', subscriptionPlan)
                }
              } else {
                console.log('[Auth] Failed to fetch subscription:', subRes.status)
              }
            } catch (subError) {
              console.error('[Auth] Error fetching subscription:', subError)
            }
            
            // Create local user and session (including drimeToken and subscription!)
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
