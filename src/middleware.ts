import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// SECURITY: Rate limiting configuration
// Using in-memory for Edge Runtime compatibility
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMITS = {
  otp: { limit: 3, windowSec: 60 },      // 3 OTP requests per minute
  auth: { limit: 10, windowSec: 60 },    // 10 auth attempts per minute  
  api: { limit: 100, windowSec: 60 },    // 100 API requests per minute
  sign: { limit: 30, windowSec: 60 },    // 30 sign requests per minute
} as const

function checkRateLimit(key: string, config: { limit: number; windowSec: number }): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowSec * 1000 })
    return { allowed: true, remaining: config.limit - 1 }
  }
  
  if (entry.count >= config.limit) {
    return { allowed: false, remaining: 0 }
  }
  
  entry.count++
  return { allowed: true, remaining: config.limit - entry.count }
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         request.headers.get('x-real-ip') ||
         request.headers.get('cf-connecting-ip') ||
         request.ip ||
         '127.0.0.1'
}

// JWT secret for token verification
const JWT_SECRET_RAW = process.env.JWT_SECRET
const JWT_SECRET = new TextEncoder().encode(
  JWT_SECRET_RAW || 'dev-only-secret-do-not-use-in-production-32chars!'
)

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',  // Home page handles its own auth
  '/api/auth/create-session',
  '/api/auth/drime-auto-login',
  '/api/auth/dev-login',
  '/api/auth/logout',
  '/api/auth/check',
  '/api/auth/me',  // Auth check endpoint
  '/api/otp/',
  '/api/sign/',
  '/api/cron/',
  '/sign/',
  '/_next/',
  '/favicon',
  '/drime-',
  '/icons/',
  '/signature-animation.json',
]

// Routes that require authentication
const PROTECTED_API_ROUTES = [
  '/api/envelopes',
  '/api/templates',
  '/api/notifications',
  '/api/user',
  '/api/thumbnail',
  '/api/pdf',
]

const PROTECTED_PAGE_ROUTES = [
  '/dashboard',
  '/new',
  '/edit/',
  '/prepare/',
  '/send/',
  '/view/',
  '/templates',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getClientIp(request)
  
  // Skip static files and Next.js internals
  if (pathname.startsWith('/_next') || 
      pathname.includes('.') && !pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // ===========================================
  // RATE LIMITING
  // ===========================================
  
  // OTP endpoints - very strict rate limiting
  if (pathname.startsWith('/api/otp')) {
    const { allowed, remaining } = checkRateLimit(`otp:${ip}`, RATE_LIMITS.otp)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many OTP requests. Please wait before trying again.' },
        { 
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Remaining': '0',
          }
        }
      )
    }
  }
  
  // Auth endpoints
  if (pathname.startsWith('/api/auth') && !pathname.includes('/me') && !pathname.includes('/check')) {
    const { allowed } = checkRateLimit(`auth:${ip}`, RATE_LIMITS.auth)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many authentication attempts. Please wait.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }
  }
  
  // General API rate limiting
  if (pathname.startsWith('/api/')) {
    const { allowed } = checkRateLimit(`api:${ip}`, RATE_LIMITS.api)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }
  }

  // ===========================================
  // AUTHENTICATION
  // ===========================================
  
  // Check if route is public
  // Note: '/' must be an exact match, others are prefix matches
  const isPublicRoute = PUBLIC_ROUTES.some(route => {
    if (route === '/') return pathname === '/'
    return pathname.startsWith(route)
  })
  if (isPublicRoute) {
    return NextResponse.next()
  }
  
  // Check if route requires authentication
  const isProtectedApi = PROTECTED_API_ROUTES.some(route => pathname.startsWith(route))
  const isProtectedPage = PROTECTED_PAGE_ROUTES.some(route => pathname.startsWith(route))
  
  if (isProtectedApi || isProtectedPage) {
    const sessionToken = request.cookies.get('session')?.value
    
    if (!sessionToken) {
      if (isProtectedApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      // Redirect to home for protected pages
      const loginUrl = new URL('/', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    
    try {
      // Verify JWT token
      await jwtVerify(sessionToken, JWT_SECRET)
    } catch {
      // Invalid token - clear it and redirect/return error
      const response = isProtectedApi 
        ? NextResponse.json({ error: 'Session expired' }, { status: 401 })
        : NextResponse.redirect(new URL('/', request.url))
      
      response.cookies.delete('session')
      return response
    }
  }
  
  // ===========================================
  // SECURITY HEADERS
  // ===========================================
  
  const response = NextResponse.next()
  
  // Add security headers to all responses
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
