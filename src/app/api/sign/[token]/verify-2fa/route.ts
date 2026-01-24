import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface Params {
  params: {
    token: string
  }
}

// POST /api/sign/[token]/verify-2fa - Mark phone 2FA as verified
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const signer = await prisma.signer.findUnique({
      where: { token: params.token },
    })
    
    if (!signer) {
      return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 })
    }
    
    // Update the signer to mark 2FA as verified
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
        details: JSON.stringify({ phone: signer.phone2FANumber }),
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
