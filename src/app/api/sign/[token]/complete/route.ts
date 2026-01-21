import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface Params {
  params: {
    token: string
  }
}

// POST /api/sign/[token]/complete - Complete signing
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const signer = await prisma.signer.findUnique({
      where: { token: params.token },
      include: {
        envelope: {
          include: {
            signers: true,
          },
        },
        fields: true,
      },
    })
    
    if (!signer) {
      return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 })
    }
    
    if (signer.status === 'signed') {
      return NextResponse.json({ error: 'Already signed' }, { status: 400 })
    }
    
    // Check required fields
    const requiredFields = signer.fields.filter(f => !f.value)
    if (requiredFields.length > 0) {
      return NextResponse.json({ 
        error: 'Please complete all required fields',
        unfilledFields: requiredFields.map(f => f.id),
      }, { status: 400 })
    }
    
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    
    // Update signer status
    await prisma.signer.update({
      where: { id: signer.id },
      data: {
        status: 'signed',
        signedAt: new Date(),
        ipAddress,
        userAgent,
      },
    })
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        envelopeId: signer.envelope.id,
        signerId: signer.id,
        action: 'signed',
        ipAddress,
        userAgent,
      },
    })
    
    // Check if all signers have signed
    const allSigners = signer.envelope.signers
    const signedCount = allSigners.filter(s => s.id === signer.id || s.status === 'signed').length
    
    if (signedCount === allSigners.length) {
      // All signed - complete envelope
      await prisma.envelope.update({
        where: { id: signer.envelope.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      })
      
      await prisma.auditLog.create({
        data: {
          envelopeId: signer.envelope.id,
          action: 'completed',
        },
      })
    }
    
    return NextResponse.json({ 
      success: true,
      allCompleted: signedCount === allSigners.length,
    })
  } catch (error) {
    console.error('Error completing signing:', error)
    return NextResponse.json({ error: 'Failed to complete signing' }, { status: 500 })
  }
}
