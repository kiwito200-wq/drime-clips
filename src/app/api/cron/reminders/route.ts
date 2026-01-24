import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendReminderEmail } from '@/lib/email'

// Interval mapping in milliseconds
const INTERVAL_MS: Record<string, number> = {
  '1_day': 24 * 60 * 60 * 1000,
  '2_days': 2 * 24 * 60 * 60 * 1000,
  '3_days': 3 * 24 * 60 * 60 * 1000,
  '7_days': 7 * 24 * 60 * 60 * 1000,
}

// This endpoint should be called by a cron job (e.g., Vercel Cron)
// GET /api/cron/reminders
export async function GET(request: NextRequest) {
  // Verify cron secret (optional but recommended)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    
    // Find envelopes that need reminders:
    // - Status is "pending"
    // - Reminders are enabled
    // - Has signers who haven't signed yet
    // - Last reminder was sent more than [interval] ago (or never)
    const envelopes = await prisma.envelope.findMany({
      where: {
        status: 'pending',
        reminderEnabled: true,
        // Not expired
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        signers: {
          where: {
            status: { in: ['pending', 'sent', 'viewed'] }, // Not signed or declined
          },
        },
      },
    })

    let remindersSent = 0
    const results: { envelopeId: string; signerEmail: string; success: boolean; error?: string }[] = []

    for (const envelope of envelopes) {
      // Check if it's time to send a reminder
      const intervalMs = INTERVAL_MS[envelope.reminderInterval] || INTERVAL_MS['3_days']
      const lastReminder = envelope.lastReminderAt || envelope.createdAt
      const timeSinceLastReminder = now.getTime() - lastReminder.getTime()
      
      if (timeSinceLastReminder < intervalMs) {
        continue // Too soon to send another reminder
      }

      // Calculate days remaining until expiry
      let daysRemaining: number | undefined
      if (envelope.expiresAt) {
        daysRemaining = Math.ceil((envelope.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      }

      // Send reminders to pending signers
      for (const signer of envelope.signers) {
        try {
          const signingLink = `${process.env.NEXT_PUBLIC_APP_URL}/sign/${signer.token}`
          
          await sendReminderEmail({
            to: signer.email,
            signerName: signer.name || null,
            documentName: envelope.name,
            senderName: envelope.user.name || envelope.user.email,
            signingLink,
            daysRemaining,
          })

          remindersSent++
          results.push({
            envelopeId: envelope.id,
            signerEmail: signer.email,
            success: true,
          })

          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 600))
        } catch (error) {
          results.push({
            envelopeId: envelope.id,
            signerEmail: signer.email,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      // Update last reminder timestamp
      if (envelope.signers.length > 0) {
        await prisma.envelope.update({
          where: { id: envelope.id },
          data: { lastReminderAt: now },
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${remindersSent} reminders`,
      details: results,
    })
  } catch (error) {
    console.error('[Cron] Reminder error:', error)
    return NextResponse.json(
      { error: 'Failed to process reminders' },
      { status: 500 }
    )
  }
}
