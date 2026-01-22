import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { uploadPdf, uploadThumbnail } from '@/lib/storage'
import { generateSlug } from '@/lib/utils'

const WORKER_URL = process.env.THUMBNAIL_WORKER_URL

// GET /api/envelopes - List user's envelopes
export async function GET() {
  try {
    let user = await getCurrentUser()
    
    // DEV MODE: Create temporary user if not logged in
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
    
    const envelopes = await prisma.envelope.findMany({
      where: { userId: user.id },
      include: {
        signers: {
          select: { email: true, name: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    
    return NextResponse.json({ envelopes })
  } catch (error) {
    console.error('Error fetching envelopes:', error)
    return NextResponse.json({ error: 'Failed to fetch envelopes' }, { status: 500 })
  }
}

// POST /api/envelopes - Create new envelope
export async function POST(request: NextRequest) {
  try {
    let user = await getCurrentUser()
    
    // DEV MODE: Create temporary user if not logged in
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
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    const name = formData.get('name') as string
    const thumbnailBlob = formData.get('thumbnail') as Blob | null
    
    if (!file || !name) {
      return NextResponse.json({ error: 'File and name are required' }, { status: 400 })
    }
    
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
    }
    
    // Upload PDF to R2
    const buffer = Buffer.from(await file.arrayBuffer())
    const { url, hash } = await uploadPdf(buffer, file.name)
    
    // Handle thumbnail
    let thumbnailUrl: string | undefined
    
    // 1. Try client-provided thumbnail first
    if (thumbnailBlob && thumbnailBlob.size > 0) {
      try {
        const thumbnailBuffer = Buffer.from(await thumbnailBlob.arrayBuffer())
        thumbnailUrl = await uploadThumbnail(thumbnailBuffer, file.name)
        console.log('[Envelope] Used client-provided thumbnail')
      } catch (e) {
        console.error('[Envelope] Failed to upload client thumbnail:', e)
      }
    }
    
    // 2. Try worker if no client thumbnail and worker is configured
    if (!thumbnailUrl && WORKER_URL) {
      try {
        console.log('[Envelope] Generating thumbnail via worker...')
        const workerResponse = await fetch(`${WORKER_URL}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfUrl: url, width: 150 }),
        })
        
        if (workerResponse.ok) {
          const workerBlob = await workerResponse.blob()
          const workerBuffer = Buffer.from(await workerBlob.arrayBuffer())
          thumbnailUrl = await uploadThumbnail(workerBuffer, file.name)
          console.log('[Envelope] Generated thumbnail via worker')
        } else {
          const error = await workerResponse.text()
          console.error('[Envelope] Worker error:', error)
        }
      } catch (e) {
        console.error('[Envelope] Worker thumbnail failed:', e)
      }
    }
    
    // Create envelope
    const envelope = await prisma.envelope.create({
      data: {
        slug: generateSlug(),
        userId: user.id,
        name,
        pdfUrl: url,
        pdfHash: hash,
        thumbnailUrl,
      },
    })
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        envelopeId: envelope.id,
        action: 'created',
        details: JSON.stringify({ name, fileSize: file.size }),
      },
    })
    
    return NextResponse.json({ envelope })
  } catch (error) {
    console.error('Error creating envelope:', error)
    return NextResponse.json({ error: 'Failed to create envelope' }, { status: 500 })
  }
}
