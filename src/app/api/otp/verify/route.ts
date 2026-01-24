import { NextResponse } from 'next/server'
import { verifyOTP, formatPhoneNumber } from '@/lib/twilio'
import { cookies } from 'next/headers'
import { SignJWT } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')

export async function POST(request: Request) {
  try {
    const { phone, code, envelopeSlug, signerId, type } = await request.json()
    
    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone and code required' }, { status: 400 })
    }
    
    // Create the same key used when storing
    const otpKey = `${type || 'field'}-${envelopeSlug || 'unknown'}-${signerId || 'unknown'}-${formatPhoneNumber(phone)}`
    
    // Verify OTP
    const result = verifyOTP(otpKey, code)
    
    if (!result.valid) {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 400 })
    }
    
    // If this is 2FA verification, create a session token
    if (type === '2fa' && envelopeSlug) {
      const token = await new SignJWT({ 
        envelopeSlug, 
        signerId,
        phone: formatPhoneNumber(phone),
        verified: true,
        type: '2fa'
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('24h')
        .sign(JWT_SECRET)
      
      // Set cookie for document access
      const cookieStore = await cookies()
      cookieStore.set(`otp_verified_${envelopeSlug}`, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
      })
    }
    
    return NextResponse.json({ 
      success: true,
      verified: true,
    })
  } catch (error) {
    console.error('[OTP Verify] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
