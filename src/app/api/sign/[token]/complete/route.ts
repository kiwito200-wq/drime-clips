import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAuditEvent, generateSignatureHash, generateSignedPdf, generateAuditTrailPdf } from '@/lib/audit'
import { sendCompletedEmail } from '@/lib/email'
import { r2 } from '@/lib/storage'
import { notifySigned, notifyCompleted } from '@/lib/notifications'
import { uploadSignedDocumentToDrime, uploadSignedDocumentForSigner } from '@/lib/drime-upload'
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
      // For checkbox, check if value is 'true'
      if (f.type === 'checkbox') {
        return value !== 'true'
      }
      // For other fields, check if value exists and is not empty
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
    
    // Notify document owner that someone signed
    await notifySigned(
      signer.envelope.userId,
      signer.envelope.id,
      signer.envelope.slug,
      signer.envelope.name,
      signer.email,
      signer.name || undefined
    )
    
    // Check if all signers have signed
    const allSigners = signer.envelope.signers
    const signedCount = allSigners.filter(s => s.id === signer.id || s.status === 'signed').length
    const allCompleted = signedCount === allSigners.length
    
    if (allCompleted) {
      // Generate signed PDF with embedded signatures
      let signedPdfBuffer: Buffer | undefined
      let auditTrailPdfBuffer: Buffer | undefined
      let finalPdfUrl: string | undefined
      
      try {
        // Generate signed PDF
        const { pdfBuffer, pdfHash: finalHash } = await generateSignedPdf(signer.envelope.id)
        signedPdfBuffer = pdfBuffer
        
        // Upload signed PDF to R2
        const signedPdfKey = `signed-pdfs/${signer.envelope.slug}-signed.pdf`
        await r2.uploadFile(signedPdfKey, pdfBuffer, 'application/pdf')
        
        const bucket = process.env.R2_BUCKET_NAME || 'drimesign'
        finalPdfUrl = `${process.env.R2_PUBLIC_URL || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}`}/${signedPdfKey}`
        
        // Generate audit trail PDF
        auditTrailPdfBuffer = await generateAuditTrailPdf(signer.envelope.id)
        
        // Upload audit trail to R2
        const auditKey = `audit-trails/${signer.envelope.slug}-audit.pdf`
        await r2.uploadFile(auditKey, auditTrailPdfBuffer, 'application/pdf')
        
        // Update envelope with final PDF details
        await prisma.envelope.update({
          where: { id: signer.envelope.id },
          data: {
            status: 'completed',
            completedAt: signedAt,
            finalPdfUrl,
            finalPdfHash: finalHash,
          },
        })
        
        await logAuditEvent(signer.envelope.id, 'completed', null, {
          finalHash,
          totalSigners: allSigners.length,
          signedPdfUrl: finalPdfUrl,
        })
        
        // Notify all signers and owner that document is complete
        const userIdsToNotify = new Set<string>()
        userIdsToNotify.add(signer.envelope.userId) // Owner
        
        // Find user IDs for signers who have accounts
        for (const s of allSigners) {
          const signerUser = await prisma.user.findUnique({ where: { email: s.email } })
          if (signerUser) {
            userIdsToNotify.add(signerUser.id)
          }
        }
        
        await notifyCompleted(
          Array.from(userIdsToNotify),
          signer.envelope.id,
          signer.envelope.slug,
          signer.envelope.name
        )
        
        // Upload signed document to Drime for document owner
        if (signedPdfBuffer) {
          try {
            await uploadSignedDocumentToDrime(
              signer.envelope.userId,
              signedPdfBuffer,
              signer.envelope.name
            )
            
            // Also upload for each signer who has a Drime account
            for (const s of allSigners) {
              // Skip if same email as owner
              if (s.email.toLowerCase() !== signer.envelope.user.email.toLowerCase()) {
                await uploadSignedDocumentForSigner(
                  s.email,
                  signedPdfBuffer,
                  signer.envelope.name
                )
              }
            }
          } catch {
            // Silent fail for Drime upload - document is still saved in R2
          }
        }
      } catch (pdfError: any) {
        // Still mark as completed even if PDF generation fails
        await prisma.envelope.update({
          where: { id: signer.envelope.id },
          data: {
            status: 'completed',
            completedAt: signedAt,
          },
        })
        
        await logAuditEvent(signer.envelope.id, 'completed', null, {
          totalSigners: allSigners.length,
          pdfGenerationError: String(pdfError?.message || pdfError),
        })
        
        // STILL send emails even without attachments - with download link
        try {
          await sendCompletedEmail({
            to: signer.envelope.user.email,
            documentName: signer.envelope.name,
            signerName: signer.envelope.user.name,
            completedAt: signedAt,
            downloadLink: `${process.env.NEXT_PUBLIC_APP_URL}/view/${signer.envelope.slug}`,
          })
        } catch {
          // Silent fail for email
        }
        
        for (let i = 0; i < allSigners.length; i++) {
          // Add delay BEFORE EACH email (including first) to avoid rate limiting
          await new Promise(r => setTimeout(r, 600))
          try {
            await sendCompletedEmail({
              to: allSigners[i].email,
              documentName: signer.envelope.name,
              signerName: allSigners[i].name,
              completedAt: signedAt,
            })
          } catch {
            // Silent fail for email
          }
        }
      }
      
      // Send completion emails to all signers and owner with attachments
      const completedAt = signedAt
      
      // Prepare attachments only if buffers exist
      const attachments = {
        signedPdf: signedPdfBuffer,
        auditTrailPdf: auditTrailPdfBuffer,
      }
      
      // Send to owner FIRST
      try {
        await sendCompletedEmail({
          to: signer.envelope.user.email,
          documentName: signer.envelope.name,
          signerName: signer.envelope.user.name,
          completedAt,
          downloadLink: `${process.env.NEXT_PUBLIC_APP_URL}/view/${signer.envelope.slug}`,
          attachments,
        })
      } catch {
        // Silent fail for email
      }
      
      // Send to all signers with delay to avoid rate limiting
      for (let i = 0; i < allSigners.length; i++) {
        const s = allSigners[i]
        
        // Add delay BEFORE EACH email (including first after owner) to avoid rate limiting
        // Resend limit: 2 requests/sec, so 600ms delay is safe
        await new Promise(resolve => setTimeout(resolve, 600))
        
        try {
          await sendCompletedEmail({
            to: s.email,
            documentName: signer.envelope.name,
            signerName: s.name,
            completedAt,
            attachments,
          })
        } catch {
          // Silent fail for email
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
