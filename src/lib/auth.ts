import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

// SECURITY: JWT_SECRET must be set in production - no fallback allowed
const JWT_SECRET_RAW = process.env.JWT_SECRET
if (!JWT_SECRET_RAW) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL: JWT_SECRET environment variable is required in production')
  }
  console.warn('⚠️ WARNING: JWT_SECRET not set - using insecure development secret')
}
const JWT_SECRET = new TextEncoder().encode(
  JWT_SECRET_RAW || 'dev-only-secret-do-not-use-in-production-32chars!'
)

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days

// Helper to ensure URL has protocol
function ensureProtocol(url: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

// Drime API URL (staging for now, will be app.drime.cloud in production)
const DRIME_API_URL = ensureProtocol(process.env.DRIME_API_URL || 'https://app.drime.cloud')
const DRIME_LOGIN_URL = ensureProtocol(process.env.DRIME_LOGIN_URL || 'https://app.drime.cloud/login')

export { DRIME_LOGIN_URL }

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION)
  
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(JWT_SECRET)
  
  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  })
  
  return token
}

// Check Drime session and get user data
export async function checkDrimeSession(cookieHeader: string | null): Promise<{
  id: string
  email: string
  name: string | null
  avatar_url: string | null
} | null> {
  if (!cookieHeader) {

    return null
  }
  
  try {
    // Use full URL for external API call
    const apiUrl = `${DRIME_API_URL}/api/v1/auth/external/me`

    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })
    

    
    // Check content-type before parsing
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {

      return null
    }
    
    if (!response.ok) {

      return null
    }
    
    const data = await response.json()
    
    if (data.user) {
      return {
        id: String(data.user.id),
        email: data.user.email,
        name: data.user.name || data.user.display_name || null,
        avatar_url: data.user.avatar_url || null,
      }
    }
    
    return null
  } catch (error) {
    console.error('[Drime Auth] Error checking session:', error)
    return null
  }
}

// Get or create user from Drime data
export async function getOrCreateUserFromDrime(drimeUser: {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
}) {
  const user = await prisma.user.upsert({
    where: { email: drimeUser.email },
    update: {
      name: drimeUser.name || undefined,
      avatarUrl: drimeUser.avatar_url || undefined,
      drimeUserId: drimeUser.id,
    },
    create: {
      email: drimeUser.email,
      name: drimeUser.name,
      avatarUrl: drimeUser.avatar_url,
      drimeUserId: drimeUser.id,
    },
  })
  
  return user
}

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value
    
    if (!token) return null
    
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const userId = payload.userId as string
    
    if (!userId) return null
    
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    })
    
    if (!session || session.expiresAt < new Date()) {
      return null
    }
    
    return session.user
  } catch {
    return null
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  
  if (token) {
    await prisma.session.deleteMany({ where: { token } })
  }
  
  cookieStore.delete('session')
}
