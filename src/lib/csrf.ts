/**
 * SECURITY: CSRF Protection Module
 * 
 * Provides CSRF token generation and validation for state-changing operations.
 * Uses the double-submit cookie pattern with signed tokens.
 */

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Use JWT secret for CSRF token signing
const JWT_SECRET_RAW = process.env.JWT_SECRET
const CSRF_SECRET = new TextEncoder().encode(
  JWT_SECRET_RAW || 'dev-only-secret-do-not-use-in-production-32chars!'
)

const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_HEADER_NAME = 'X-CSRF-Token'
const TOKEN_EXPIRY = '1h'

/**
 * Generate a CSRF token and set it as a cookie
 */
export async function generateCsrfToken(): Promise<string> {
  const tokenId = crypto.randomBytes(16).toString('hex')
  
  const token = await new SignJWT({ tokenId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(CSRF_SECRET)
  
  const cookieStore = await cookies()
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600, // 1 hour
    path: '/',
  })
  
  return token
}

/**
 * Validate CSRF token from request
 */
export async function validateCsrfToken(request: NextRequest): Promise<boolean> {
  // Get token from header
  const headerToken = request.headers.get(CSRF_HEADER_NAME)
  
  // Get token from cookie
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  
  // Both must be present
  if (!headerToken || !cookieToken) {
    return false
  }
  
  // Tokens must match
  if (headerToken !== cookieToken) {
    return false
  }
  
  // Verify the token is valid
  try {
    await jwtVerify(cookieToken, CSRF_SECRET)
    return true
  } catch {
    return false
  }
}

/**
 * Middleware helper to check CSRF for state-changing requests
 */
export async function csrfProtect(request: NextRequest): Promise<NextResponse | null> {
  // Only check state-changing methods
  const method = request.method.toUpperCase()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null // No CSRF check needed
  }
  
  // Skip CSRF for certain safe endpoints
  const pathname = request.nextUrl.pathname
  const csrfExemptPaths = [
    '/api/auth/create-session',
    '/api/auth/drime-auto-login',
    '/api/sign/', // Sign endpoints use their own token validation
    '/api/otp/',  // OTP endpoints use their own validation
    '/api/cron/', // Cron endpoints should use secret header
  ]
  
  if (csrfExemptPaths.some(path => pathname.startsWith(path))) {
    return null
  }
  
  // Validate CSRF token
  const isValid = await validateCsrfToken(request)
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid or missing CSRF token' },
      { status: 403 }
    )
  }
  
  return null // Validation passed
}

/**
 * Get or create CSRF token for client
 */
export async function getCsrfToken(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(CSRF_COOKIE_NAME)?.value
  
  if (existing) {
    try {
      await jwtVerify(existing, CSRF_SECRET)
      return existing
    } catch {
      // Token expired or invalid, generate new one
    }
  }
  
  return generateCsrfToken()
}
