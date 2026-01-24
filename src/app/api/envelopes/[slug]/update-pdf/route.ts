import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { r2, calculateHash } from '@/lib/storage'
import { logAudit } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = await params

    // Get envelope
    const envelope = await prisma.envelope.findUnique({
      where: { slug },
      include: { signers: true }
    })

    if (!envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 })
    }

    if (envelope.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check envelope status - can only edit draft or pending envelopes
    if (envelope.status !== 'draft' && envelope.status !== 'pending') {
      return NextResponse.json(
        { error: 'Cannot modify a completed or expired envelope' },
        { status: 400 }
      )
    }

    // Get the uploaded file
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Verify it's a PDF
    if (!file.type.includes('pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate new hash
    const pdfHash = calculateHash(buffer)

    // Upload to R2 with a new path indicating it's modified
    const timestamp = Date.now()
    const fileName = `envelopes/${envelope.id}/modified_${timestamp}.pdf`
    await r2.uploadFile(fileName, buffer, 'application/pdf')
    
    // Build the public URL
    const pdfUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`

    // Update envelope with new PDF URL and hash
    await prisma.envelope.update({
      where: { id: envelope.id },
      data: {
        pdfUrl,
        pdfHash,
      }
    })

    // Log audit event
    await logAudit({
      envelopeId: envelope.id,
      userId: user.id,
      action: 'edited',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      details: {
        event: 'pdf_modified',
        description: 'PDF modifié avec l\'éditeur intégré',
        fileSize: buffer.length,
      }
    })

    // Return the signed URL for the new PDF
    const signedUrl = await r2.getSignedUrl(fileName)

    return NextResponse.json({
      success: true,
      url: signedUrl,
      message: 'PDF updated successfully'
    })
  } catch (error) {
    console.error('Update PDF error:', error)
    return NextResponse.json(
      { error: 'Failed to update PDF' },
      { status: 500 }
    )
  }
}
