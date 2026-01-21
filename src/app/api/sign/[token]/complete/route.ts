import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAuditEvent, generateSignatureHash } from '@/lib/audit'
import { sendCompletedEmail } from '@/lib/email'
import crypto from 'crypto'

interface Params {
  params: {
    token: string
  }
}

// POST /api/sign/[token]/complete - Complete signing
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const body = await request.json()
    const { fieldValues } = body
    
    const signer = await prisma.signer.findUnique({
      where: { token: params.token },
      include: {
        envelope: {
          include: {
            signers: true,
            user: true,
          },
        },
        fields: true,
      },
    })
    
    if (!signer) {
      return NextResponse.json({ error: 'Lien de signature invalide' }, { status: 404 })
    }
    
    if (signer.status === 'signed') {
      return NextResponse.json({ error: 'Vous avez déjà signé ce document' }, { status: 400 })
    }
    
    // Check required fields
    const requiredFields = signer.fields.filter(f => f.required)
    const unfilledFields = requiredFields.filter(f => {
      const value = fieldValues?.[f.id]
      return !value || value.trim() === ''
    })
    
    if (unfilledFields.length > 0) {
      return NextResponse.json({ 
        error: `Veuillez remplir tous les champs requis (${unfilledFields.length} restants)`,
        unfilledFields: unfilledFields.map(f => f.id),
      }, { status: 400 })
    }
    
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      request.headers.get('x-real-ip') || 
                      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const signedAt = new Date()
    
    // Generate signature hash for cryptographic verification
    const signatureHash = generateSignatureHash({
      documentHash: signer.envelope.pdfHash,
      signerId: signer.id,
      signerEmail: signer.email,
      signedAt,
      ipAddress,
      userAgent,
    })
    
    // Update all field values
    if (fieldValues) {
      await Promise.all(
        Object.entries(fieldValues).map(([fieldId, value]) =>
          prisma.field.update({
            where: { id: fieldId },
            data: {
              value: value as string,
              filledAt: new Date(),
            },
          })
        )
      )
    }
    
    // Update signer status with signature hash
    await prisma.signer.update({
      where: { id: signer.id },
      data: {
        status: 'signed',
        signedAt,
        ipAddress,
        userAgent,
      },
    })
    
    // Log audit event with signature details
    await logAuditEvent(signer.envelope.id, 'signed', signer.id, {
      ip: ipAddress,
      userAgent,
      signatureHash,
      email: signer.email,
      fieldsCount: Object.keys(fieldValues || {}).length,
    })
    
    // Check if all signers have signed
    const allSigners = signer.envelope.signers
    const signedCount = allSigners.filter(s => s.id === signer.id || s.status === 'signed').length
    const allCompleted = signedCount === allSigners.length
    
    if (allCompleted) {
      // Generate final document hash (would include all signatures in a real implementation)
      const finalHash = crypto
        .createHash('sha256')
        .update(signer.envelope.pdfHash + signatureHash + signedAt.toISOString())
        .digest('hex')
      
      // All signed - complete envelope
      await prisma.envelope.update({
        where: { id: signer.envelope.id },
        data: {
          status: 'completed',
          completedAt: signedAt,
          finalPdfHash: finalHash,
        },
      })
      
      await logAuditEvent(signer.envelope.id, 'completed', null, {
        finalHash,
        totalSigners: allSigners.length,
      })
      
      // Send completion emails to all signers and owner
      const completedAt = signedAt
      
      // Send to owner
      try {
        await sendCompletedEmail({
          to: signer.envelope.user.email,
          documentName: signer.envelope.name,
          signerName: signer.envelope.user.name,
          completedAt,
          downloadLink: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${signer.envelope.slug}`,
        })
      } catch (e) {
        console.error('Failed to send completion email to owner:', e)
      }
      
      // Send to all signers
      for (const s of allSigners) {
        try {
          await sendCompletedEmail({
            to: s.email,
            documentName: signer.envelope.name,
            signerName: s.name,
            completedAt,
          })
        } catch (e) {
          console.error('Failed to send completion email to signer:', s.email, e)
        }
      }
    }
    
    return NextResponse.json({ 
      success: true,
      allCompleted,
      signatureHash,
    })
  } catch (error) {
    console.error('Error completing signing:', error)
    return NextResponse.json({ error: 'Échec de la signature' }, { status: 500 })
  }
}
