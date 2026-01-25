/**
 * SECURITY: Rate Limiting Module
 * 
 * Provides rate limiting for API routes to prevent abuse.
 * Uses in-memory storage for development and can be extended to use Redis in production.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store for rate limiting (development)
// In production, use Redis: npm install @upstash/redis @upstash/ratelimit
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries every minute
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    const keysToDelete: string[] = []
    rateLimitStore.forEach((entry, key) => {
      if (entry.resetAt < now) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => rateLimitStore.delete(key))
  }, 60000)
}

export interface RateLimitConfig {
  // Maximum number of requests allowed in the window
  limit: number
  // Window size in seconds
  windowSec: number
}

// Default rate limit configs for different endpoints
export const RATE_LIMITS = {
  // OTP endpoints - very strict to prevent SMS bombing
  otp: { limit: 3, windowSec: 60 }, // 3 requests per minute
  
  // Auth endpoints - prevent brute force
  auth: { limit: 10, windowSec: 60 }, // 10 requests per minute
  
  // API endpoints - general limit
  api: { limit: 100, windowSec: 60 }, // 100 requests per minute
  
  // Upload endpoints - prevent abuse
  upload: { limit: 20, windowSec: 60 }, // 20 uploads per minute
  
  // Sign endpoints - moderate limit
  sign: { limit: 30, windowSec: 60 }, // 30 requests per minute
} as const

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number // Unix timestamp when the limit resets
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier for the client (usually IP address)
 * @param endpoint - The endpoint type for determining limits
 * @returns RateLimitResult with success=false if rate limited
 */
export function checkRateLimit(
  identifier: string,
  endpoint: keyof typeof RATE_LIMITS
): RateLimitResult {
  const config = RATE_LIMITS[endpoint]
  const key = `${endpoint}:${identifier}`
  const now = Date.now()
  
  const entry = rateLimitStore.get(key)
  
  // No existing entry or window has expired
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowSec * 1000
    rateLimitStore.set(key, { count: 1, resetAt })
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: Math.floor(resetAt / 1000),
    }
  }
  
  // Check if limit exceeded
  if (entry.count >= config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset: Math.floor(entry.resetAt / 1000),
    }
  }
  
  // Increment counter
  entry.count++
  
  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    reset: Math.floor(entry.resetAt / 1000),
  }
}

/**
 * Get client IP from request headers
 * Handles proxies and load balancers
 */
export function getClientIp(request: Request): string {
  // Check various headers in order of preference
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Take the first IP in the list (original client)
    return forwardedFor.split(',')[0].trim()
  }
  
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) {
    return cfIp.trim()
  }
  
  // Fallback
  return '127.0.0.1'
}

/**
 * Create rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  }
}
