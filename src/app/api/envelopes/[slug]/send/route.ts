import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { sendSignatureRequestEmail } from '@/lib/email'
import { logAuditEvent } from '@/lib/audit'

interface Params {
  params: {
    slug: string
  }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sign.drime.cloud'

// POST /api/envelopes/[slug]/send - Send envelope for signature
export async function POST(request: NextRequest, { params }: Params) {
  try {
    let user = await getCurrentUser()
    
    // DEV MODE: Get or create dev user
    if (!user) {
      const devEmail = 'dev@drime.cloud'
      user = await prisma.user.upsert({
        where: { email: devEmail },
        update: {},
        create: {
          email: devEmail,
          name: 'Dev User',
        },
      })
    }

    const envelope = await prisma.envelope.findFirst({
      where: {
        slug: params.slug,
        userId: user.id,
      },
      include: {
        signers: true,
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

    // Parse request body for optional message
    let message: string | undefined
    try {
      const body = await request.json()
      message = body.message
    } catch {
      // No body provided, that's fine
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

    // Log audit event
    await logAuditEvent(envelope.id, 'sent', null, {
      signerCount: envelope.signers.length,
      fieldCount: envelope.fields.length,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    })

    // Send emails to all signers
    const signerLinks: { email: string; name: string | null; signUrl: string; emailSent: boolean }[] = []
    
    for (const signer of envelope.signers) {
      const signUrl = `${APP_URL}/sign/${signer.token}`
      
      // Check if this is self-signing (signer email = owner email)
      const isSelfSign = signer.email.toLowerCase() === user.email.toLowerCase()
      
      let emailSent = false
      
      if (!isSelfSign) {
        // Send email to external signer
        const emailResult = await sendSignatureRequestEmail({
          to: signer.email,
          signerName: signer.name,
          documentName: envelope.name,
          senderName: user.name || user.email,
          senderEmail: user.email,
          signingLink: signUrl,
          message,
          expiresAt: envelope.expiresAt || undefined,
        })
        
        emailSent = emailResult.success
        
        // Log email sent event
        if (emailSent) {
          await logAuditEvent(envelope.id, 'sent', signer.id, {
            email: signer.email,
          })
        }
      }
      
      signerLinks.push({
        email: signer.email,
        name: signer.name,
        signUrl,
        emailSent,
      })
    }

    // Check if this is self-signing only
    const isSelfSignOnly = envelope.signers.length === 1 && 
      envelope.signers[0].email.toLowerCase() === user.email.toLowerCase()

    return NextResponse.json({ 
      success: true,
      envelope: {
        id: envelope.id,
        slug: envelope.slug,
        status: 'pending',
      },
      signerLinks,
      isSelfSign: isSelfSignOnly,
      selfSignUrl: isSelfSignOnly ? `${APP_URL}/sign/${envelope.signers[0].token}` : undefined,
    })
  } catch (error) {
    console.error('[POST /api/envelopes/[slug]/send] Error:', error)
    return NextResponse.json({ error: 'Failed to send envelope' }, { status: 500 })
  }
}
