import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'

// SECURITY: Same JWT secret as in auth.ts
const JWT_SECRET_RAW = process.env.JWT_SECRET
const JWT_SECRET = new TextEncoder().encode(
  JWT_SECRET_RAW || 'dev-only-secret-do-not-use-in-production-32chars!'
)

interface Params {
  params: {
    token: string
  }
}

// POST /api/sign/[token]/verify-2fa - Mark phone 2FA as verified
// SECURITY: This endpoint now requires a valid OTP verification token
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const signer = await prisma.signer.findUnique({
      where: { token: params.token },
      include: {
        envelope: {
          select: { slug: true }
        }
      }
    })
    
    if (!signer) {
      return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 })
    }

    // SECURITY: Verify that the OTP was actually validated
    // The OTP verification sets a cookie with a JWT token
    const cookieStore = await cookies()
    const otpToken = cookieStore.get(`otp_verified_${signer.envelope.slug}`)?.value
    
    if (!otpToken) {
      return NextResponse.json({ 
        error: 'Phone verification required. Please verify your phone number first.' 
      }, { status: 401 })
    }

    try {
      // Verify the JWT token from OTP verification
      const { payload } = await jwtVerify(otpToken, JWT_SECRET)
      
      // SECURITY: Validate that the token matches this envelope and signer
      if (payload.envelopeSlug !== signer.envelope.slug) {
        return NextResponse.json({ 
          error: 'Invalid verification token for this document' 
        }, { status: 401 })
      }
      
      // Verify the phone number matches (if stored in token)
      if (payload.phone && signer.phone2FANumber) {
        // Normalize phone numbers for comparison
        const tokenPhone = String(payload.phone).replace(/\D/g, '')
        const signerPhone = signer.phone2FANumber.replace(/\D/g, '')
        if (!tokenPhone.endsWith(signerPhone.slice(-4))) {
          return NextResponse.json({ 
            error: 'Phone number mismatch' 
          }, { status: 401 })
        }
      }
      
      if (payload.type !== '2fa' || !payload.verified) {
        return NextResponse.json({ 
          error: 'Invalid verification type' 
        }, { status: 401 })
      }
    } catch (jwtError) {
      console.error('[verify-2fa] JWT verification failed:', jwtError)
      return NextResponse.json({ 
        error: 'Verification token expired or invalid. Please verify your phone again.' 
      }, { status: 401 })
    }
    
    // Now we can safely mark 2FA as verified
    await prisma.signer.update({
      where: { id: signer.id },
      data: {
        phone2FAVerified: true,
      },
    })
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        envelopeId: signer.envelopeId,
        signerId: signer.id,
        action: 'phone_2fa_verified',
        details: JSON.stringify({ 
          phone: signer.phone2FANumber,
          verifiedVia: 'otp_jwt_token'
        }),
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[POST /api/sign/[token]/verify-2fa] Error:', error)
    return NextResponse.json({ error: 'Failed to verify 2FA' }, { status: 500 })
  }
}
