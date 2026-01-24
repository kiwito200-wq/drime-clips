import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface Params {
  params: {
    token: string
  }
}

// GET /api/sign/[token] - Get signer data for signing page
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const signer = await prisma.signer.findUnique({
      where: { token: params.token },
      include: {
        envelope: {
          select: {
            id: true,
            slug: true,
            name: true,
            pdfUrl: true,
            status: true,
          },
        },
        fields: true,
      },
    })
    
    if (!signer) {
      return NextResponse.json({ error: 'Invalid or expired signing link' }, { status: 404 })
    }
    
    if (signer.status === 'signed') {
      return NextResponse.json({ error: 'You have already signed this document' }, { status: 400 })
    }
    
    if (signer.envelope.status === 'expired') {
      return NextResponse.json({ error: 'This document has expired' }, { status: 400 })
    }
    
    if (signer.envelope.status === 'cancelled') {
      return NextResponse.json({ error: 'This document has been cancelled' }, { status: 400 })
    }
    
    // Update viewed status
    if (!signer.viewedAt) {
      await prisma.signer.update({
        where: { id: signer.id },
        data: {
          status: 'viewed',
          viewedAt: new Date(),
        },
      })
      
      // Create audit log
      await prisma.auditLog.create({
        data: {
          envelopeId: signer.envelope.id,
          signerId: signer.id,
          action: 'viewed',
          ipAddress: request.headers.get('x-forwarded-for') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
        },
      })
    }
    
    return NextResponse.json({
      id: signer.id,
      name: signer.name,
      email: signer.email,
      color: signer.color,
      phone2FA: signer.phone2FA,
      phone2FANumber: signer.phone2FANumber,
      phone2FAVerified: signer.phone2FAVerified,
      envelope: signer.envelope,
      fields: signer.fields,
    })
  } catch (error) {
    console.error('Error fetching signer data:', error)
    return NextResponse.json({ error: 'Failed to load signing page' }, { status: 500 })
  }
}
