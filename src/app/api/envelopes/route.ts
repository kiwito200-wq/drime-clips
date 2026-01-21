import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { uploadPdf } from '@/lib/storage'
import { generateSlug } from '@/lib/utils'

// GET /api/envelopes - List user's envelopes
export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const envelopes = await prisma.envelope.findMany({
      where: { userId: user.id },
      include: {
        signers: {
          select: { email: true, status: true },
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
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    const name = formData.get('name') as string
    
    if (!file || !name) {
      return NextResponse.json({ error: 'File and name are required' }, { status: 400 })
    }
    
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
    }
    
    // Upload to R2
    const buffer = Buffer.from(await file.arrayBuffer())
    const { url, hash } = await uploadPdf(buffer, file.name)
    
    // Create envelope
    const envelope = await prisma.envelope.create({
      data: {
        slug: generateSlug(),
        userId: user.id,
        name,
        pdfUrl: url,
        pdfHash: hash,
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
