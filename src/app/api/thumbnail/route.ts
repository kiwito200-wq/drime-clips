import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadThumbnail } from '@/lib/storage'

const WORKER_URL = process.env.THUMBNAIL_WORKER_URL

/**
 * POST /api/thumbnail
 * Generate and save thumbnail for an envelope
 * Body: { envelopeId: string }
 */
export async function POST(request: NextRequest) {
  try {
    if (!WORKER_URL) {
      return NextResponse.json(
        { error: 'Thumbnail worker not configured' },
        { status: 501 }
      )
    }

    const { envelopeId } = await request.json()

    if (!envelopeId) {
      return NextResponse.json(
        { error: 'envelopeId is required' },
        { status: 400 }
      )
    }

    // Get envelope
    const envelope = await prisma.envelope.findUnique({
      where: { id: envelopeId },
    })

    if (!envelope) {
      return NextResponse.json(
        { error: 'Envelope not found' },
        { status: 404 }
      )
    }

    if (!envelope.pdfUrl) {
      return NextResponse.json(
        { error: 'Envelope has no PDF' },
        { status: 400 }
      )
    }

    // Call worker to generate thumbnail
    const workerResponse = await fetch(`${WORKER_URL}/generate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': process.env.THUMBNAIL_WORKER_API_KEY || '',
      },
      body: JSON.stringify({ pdfUrl: envelope.pdfUrl, width: 150 }),
    })

    if (!workerResponse.ok) {
      const error = await workerResponse.json().catch(() => ({ error: 'Unknown error' }))
      console.error('[Thumbnail API] Worker error:', error)
      return NextResponse.json(
        { error: 'Failed to generate thumbnail', details: error },
        { status: 500 }
      )
    }

    // Get thumbnail blob
    const thumbnailBlob = await workerResponse.blob()
    const thumbnailBuffer = Buffer.from(await thumbnailBlob.arrayBuffer())

    // Upload to R2
    const thumbnailUrl = await uploadThumbnail(thumbnailBuffer, `${envelope.slug}.png`)

    // Update envelope
    await prisma.envelope.update({
      where: { id: envelopeId },
      data: { thumbnailUrl },
    })

    return NextResponse.json({ success: true, thumbnailUrl })
  } catch (error) {
    console.error('[Thumbnail API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate thumbnail' },
      { status: 500 }
    )
  }
}
