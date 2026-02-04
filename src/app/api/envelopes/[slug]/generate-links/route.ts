import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAuditEvent } from '@/lib/audit'
import { getSubscriptionInfo, consumeSignatureRequest } from '@/lib/subscription'

interface Params {
  params: {
    slug: string
  }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sign.drime.cloud'

// POST /api/envelopes/[slug]/generate-links - Generate signing links without sending emails
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    
    // SECURITY: Require authentication - no exceptions
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription limits BEFORE processing
    const subscriptionInfo = await getSubscriptionInfo(user.id)
    if (!subscriptionInfo.canCreateSignatureRequest) {
      return NextResponse.json({ 
        error: 'Limite de signatures atteinte',
        errorCode: 'SIGNATURE_LIMIT_REACHED',
        subscription: {
          plan: subscriptionInfo.plan,
          planName: subscriptionInfo.planName,
          used: subscriptionInfo.signatureRequestsUsed,
          limit: subscriptionInfo.signatureRequestsLimit,
          resetDate: subscriptionInfo.resetDate?.toISOString(),
        }
      }, { status: 403 })
    }

    const envelope = await prisma.envelope.findFirst({
      where: {
        slug: params.slug,
        userId: user.id,
      },
      include: {
        signers: {
          orderBy: { order: 'asc' },
        },
        fields: true,
        user: true,
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

    // Update envelope status to pending (without settings for now)
    await prisma.envelope.update({
      where: { id: envelope.id },
      data: { 
        status: 'pending',
      },
    })

    // Update all signers to 'sent' status
    await prisma.signer.updateMany({
      where: { envelopeId: envelope.id },
      data: { status: 'sent' },
    })

    // Increment signature request counter (this counts as 1 request regardless of signers)
    await consumeSignatureRequest(user.id)

    // Log audit event
    await logAuditEvent(envelope.id, 'links_generated', null, {
      signerCount: envelope.signers.length,
      fieldCount: envelope.fields.length,
      method: 'share_link',
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    })

    // Generate links for all signers (NO EMAIL SENT)
    const signerLinks = envelope.signers.map(signer => ({
      id: signer.id,
      email: signer.email,
      name: signer.name,
      color: signer.color,
      signUrl: `${APP_URL}/sign/${signer.token}`,
    }))

    return NextResponse.json({ 
      success: true,
      envelope: {
        id: envelope.id,
        slug: envelope.slug,
        name: envelope.name,
        status: 'pending',
      },
      signerLinks,
    })
  } catch (error) {
    console.error('[POST /api/envelopes/[slug]/generate-links] Error:', error)
    return NextResponse.json({ error: 'Failed to generate links' }, { status: 500 })
  }
}
