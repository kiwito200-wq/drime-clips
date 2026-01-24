import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { sendSignatureRequestEmail } from '@/lib/email'
import { logAuditEvent } from '@/lib/audit'
import { notifyInvitation } from '@/lib/notifications'

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

    // Parse request body for optional message, isSelfSign flag, and settings
    let message: string | undefined
    let clientSelfSign = false
    let dueDate: string | null = null
    let reminderEnabled = true
    let reminderInterval = '3_days'
    
    try {
      const body = await request.json()
      message = body.message
      clientSelfSign = body.isSelfSign === true
      dueDate = body.dueDate || null
      reminderEnabled = body.reminderEnabled !== false
      reminderInterval = body.reminderInterval || '3_days'
    } catch {
      // No body provided, that's fine
    }

    // Update envelope status to pending and save settings
    await prisma.envelope.update({
      where: { id: envelope.id },
      data: { 
        status: 'pending',
        expiresAt: dueDate ? new Date(dueDate) : null,
        reminderEnabled,
        reminderInterval,
      },
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

    // Send emails to all signers SEQUENTIALLY with delay to avoid rate limiting
    // Resend allows only 2 requests per second
    console.log(`[SEND] Sending emails to ${envelope.signers.length} signers (sequential with delay)`)
    
    const signerLinks: { email: string; name: string | null; signUrl: string; emailSent: boolean }[] = []
    
    for (let i = 0; i < envelope.signers.length; i++) {
      const signer = envelope.signers[i]
      const signUrl = `${APP_URL}/sign/${signer.token}`
      
      // Check if this is self-signing (signer email = owner email)
      const isSelfSign = signer.email.toLowerCase() === user.email.toLowerCase()
      
      let emailSent = false
      
      if (!isSelfSign) {
        try {
          // Add delay between emails to avoid rate limiting (600ms = safe for 2/sec limit)
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 600))
          }
          
          console.log(`[SEND] Sending email to: ${signer.email}`)
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
          console.log(`[SEND] Email to ${signer.email}: ${emailSent ? 'SUCCESS' : 'FAILED'}`, emailResult.error ? `- Error: ${JSON.stringify(emailResult.error)}` : '')
          
          // Log email sent event
          if (emailSent) {
            await logAuditEvent(envelope.id, 'sent', signer.id, {
              email: signer.email,
            })
          }
        } catch (emailError) {
          console.error(`[SEND] Failed to send email to ${signer.email}:`, emailError)
        }
      } else {
        console.log(`[SEND] Skipping self-sign email for: ${signer.email}`)
      }
      
      signerLinks.push({
        email: signer.email,
        name: signer.name,
        signUrl,
        emailSent,
      })
      
      // Create notification for invited user (if they have an account)
      if (!isSelfSign) {
        await notifyInvitation(
          signer.email,
          envelope.id,
          envelope.slug,
          envelope.name,
          user.email,
          user.name || undefined
        )
      }
    }
    
    console.log(`[SEND] Completed sending emails. Results:`, signerLinks.map(s => ({ email: s.email, sent: s.emailSent })))

    // Check if this is self-signing only
    // ONLY use client flag when explicitly set, or check if single signer matches user email
    const emailMatch = envelope.signers.length === 1 && 
      envelope.signers[0].email.toLowerCase() === user.email.toLowerCase()
    // IMPORTANT: Only redirect to sign if clientSelfSign is explicitly true OR email matches
    // Do NOT redirect just because there's only 1 signer (could be sending to someone else)
    const isSelfSignOnly = clientSelfSign === true || emailMatch

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
