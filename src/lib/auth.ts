import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
)

const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days

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
