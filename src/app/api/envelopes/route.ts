import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { uploadPdf, uploadThumbnail } from '@/lib/storage'
import { generateSlug } from '@/lib/utils'

const WORKER_URL = process.env.THUMBNAIL_WORKER_URL

// GET /api/envelopes - List user's envelopes
export async function GET() {
  try {
    const user = await getCurrentUser()
    
    // SECURITY: Require authentication - no exceptions
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    const user = await getCurrentUser()
    
    // SECURITY: Require authentication - no exceptions
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const contentType = request.headers.get('content-type') || ''
    
    // Check if request is JSON (for template-based envelope creation)
    if (contentType.includes('application/json')) {
      const body = await request.json()
      const { name, pdfUrl, pdfHash, thumbnailUrl } = body
      
      if (!name || !pdfUrl || !pdfHash) {
        return NextResponse.json({ error: 'Name, pdfUrl, and pdfHash are required' }, { status: 400 })
      }
      
      // Create envelope from template (no file upload needed)
      const envelope = await prisma.envelope.create({
        data: {
          slug: generateSlug(),
          userId: user.id,
          name,
          pdfUrl,
          pdfHash,
          thumbnailUrl: thumbnailUrl || null,
        },
      })
      
      // Create audit log
      await prisma.auditLog.create({
        data: {
          envelopeId: envelope.id,
          action: 'created',
          details: JSON.stringify({ name, fromTemplate: true }),
        },
      })
      
      return NextResponse.json({ envelope })
    }
    
    // Otherwise, handle multipart/form-data (file upload)
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
    
    // SECURITY: Read file into buffer for validation
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // SECURITY: Validate file size (max 50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 50MB.' }, { status: 400 })
    }
    
    // SECURITY: Validate PDF magic number (must start with %PDF-)
    const header = buffer.slice(0, 5).toString('ascii')
    if (!header.startsWith('%PDF-')) {
      return NextResponse.json({ error: 'Invalid PDF file format' }, { status: 400 })
    }
    
    // SECURITY: Check for potentially malicious content
    const content = buffer.toString('latin1').toLowerCase()
    const dangerousPatterns = [
      '/javascript',
      '/js',
      '/launch',
      '/submitform',
      '/importdata',
      '/openaction',
      '/aa',  // Automatic actions
    ]
    
    for (const pattern of dangerousPatterns) {
      if (content.includes(pattern)) {
        console.warn(`[Security] Potentially dangerous PDF pattern detected: ${pattern}`)
        // Note: We log but don't reject - some legitimate PDFs may have these
        // In production, you might want to quarantine these for review
      }
    }
    
    // Upload PDF to R2
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
          headers: { 
            'Content-Type': 'application/json',
            'X-API-Key': process.env.THUMBNAIL_WORKER_API_KEY || '',
          },
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
