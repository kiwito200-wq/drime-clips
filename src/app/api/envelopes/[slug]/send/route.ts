import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface Params {
  params: {
    slug: string
  }
}

// POST /api/envelopes/[slug]/send - Send envelope for signature
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    if (!user && process.env.DEV_BYPASS_AUTH !== 'true') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const envelope = await prisma.envelope.findFirst({
      where: {
        slug: params.slug,
        userId: user?.id || undefined,
      },
      include: {
        signers: true,
        fields: true,
      },
    })

    if (!envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 })
    }

    if (envelope.status !== 'draft') {
      return NextResponse.json({ error: 'Envelope already sent' }, { status: 400 })
    }

    if (envelope.signers.length === 0) {
      return NextResponse.json({ error: 'At least one signer is required' }, { status: 400 })
    }

    if (envelope.fields.length === 0) {
      return NextResponse.json({ error: 'At least one field is required' }, { status: 400 })
    }

    // Update envelope status to pending
    await prisma.envelope.update({
      where: { id: envelope.id },
      data: { status: 'pending' },
    })

    // Update all signers to 'sent' status
    await prisma.signer.updateMany({
      where: { envelopeId: envelope.id },
      data: { status: 'sent' },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        envelopeId: envelope.id,
        action: 'sent',
        details: JSON.stringify({
          signerCount: envelope.signers.length,
          fieldCount: envelope.fields.length,
        }),
      },
    })

    // TODO: Send emails to signers with their unique signing links
    // For now, we'll just return the signer tokens
    const signerLinks = envelope.signers.map(signer => ({
      email: signer.email,
      name: signer.name,
      signUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://sign.drime.cloud'}/sign/${signer.token}`,
    }))

    return NextResponse.json({ 
      success: true,
      envelope: {
        id: envelope.id,
        slug: envelope.slug,
        status: 'pending',
      },
      signerLinks,
    })
  } catch (error) {
    console.error('[POST /api/envelopes/[slug]/send] Error:', error)
    return NextResponse.json({ error: 'Failed to send envelope' }, { status: 500 })
  }
}
