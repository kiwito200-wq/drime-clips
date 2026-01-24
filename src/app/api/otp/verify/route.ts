import { NextResponse } from 'next/server'
import { checkVerifyOTP, formatPhoneNumber } from '@/lib/twilio'
import { cookies, headers } from 'next/headers'
import { SignJWT } from 'jose'
import { prisma } from '@/lib/prisma'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')

// Mask phone number for display (e.g., +33***7166)
function maskPhone(phone: string): string {
  const formatted = formatPhoneNumber(phone)
  if (formatted.length < 6) return formatted
  return formatted.slice(0, 3) + '***' + formatted.slice(-4)
}

export async function POST(request: Request) {
  try {
    const { phone, code, envelopeSlug, signerId, type } = await request.json()
    
    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone and code required' }, { status: 400 })
    }
    
    // Use Twilio Verify to check OTP
    const result = await checkVerifyOTP(phone, code)
    
    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Code incorrect'
      }, { status: 400 })
    }
    
    // Get IP and user agent for audit log
    const headersList = await headers()
    const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0] || 
                      headersList.get('x-real-ip') || 
                      'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'
    
    const formattedPhone = formatPhoneNumber(phone)
    const maskedPhone = maskPhone(phone)
    
    // Find envelope and signer for audit logging
    if (envelopeSlug) {
      const envelope = await prisma.envelope.findFirst({
        where: { slug: envelopeSlug },
        include: { signers: true },
      })
      
      if (envelope) {
        // Find the actual signer by email or ID
        let actualSignerId: string | null = null
        if (signerId) {
          // Check if signerId is a valid CUID (signer ID) or an email
          const isEmail = signerId.includes('@')
          if (isEmail) {
            // Find signer by email
            const signer = envelope.signers.find(s => s.email.toLowerCase() === signerId.toLowerCase())
            actualSignerId = signer?.id || null
          } else {
            // Check if it's a valid signer ID for this envelope
            const signer = envelope.signers.find(s => s.id === signerId)
            actualSignerId = signer?.id || null
          }
        }
        
        // Create audit log entry for phone verification
        await prisma.auditLog.create({
          data: {
            envelopeId: envelope.id,
            signerId: actualSignerId,
            action: 'phone_verified',
            details: JSON.stringify({
              phone: maskedPhone,
              fullPhone: formattedPhone, // Store full phone for compliance
              verificationType: type === '2fa' ? 'document_access_2fa' : 'field_verification',
              verifiedAt: new Date().toISOString(),
            }),
            ipAddress,
            userAgent,
          },
        })
        console.log(`[Audit] Phone verified: ${maskedPhone} for envelope ${envelopeSlug}`)
      }
    }
    
    // If this is 2FA verification, create a session token
    if (type === '2fa' && envelopeSlug) {
      const token = await new SignJWT({ 
        envelopeSlug, 
        signerId,
        phone: formattedPhone,
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
