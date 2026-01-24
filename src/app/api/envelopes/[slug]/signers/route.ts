import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { generateToken, getNextSignerColor } from '@/lib/utils'

interface Params {
  params: {
    slug: string
  }
}

// POST /api/envelopes/[slug]/signers - Add a signer
export async function POST(request: NextRequest, { params }: Params) {
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

    const envelope = await prisma.envelope.findFirst({
      where: {
        slug: params.slug,
        userId: user.id,
      },
      include: {
        signers: true,
      },
    })

    if (!envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 })
    }

    if (envelope.status !== 'draft') {
      return NextResponse.json({ error: 'Cannot modify sent envelope' }, { status: 400 })
    }

    const body = await request.json()
    const { email, name } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Check if signer already exists
    const existingSigner = envelope.signers.find(s => s.email.toLowerCase() === email.toLowerCase())
    if (existingSigner) {
      return NextResponse.json({ error: 'Signer with this email already exists' }, { status: 400 })
    }

    // Get next color
    const existingColors = envelope.signers.map(s => s.color)
    const color = getNextSignerColor(existingColors)

    const signer = await prisma.signer.create({
      data: {
        envelopeId: envelope.id,
        email,
        name: name || null,
        color,
        order: envelope.signers.length,
        token: generateToken(),
      },
    })

    return NextResponse.json({ signer }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/envelopes/[slug]/signers] Error:', error)
    return NextResponse.json({ error: 'Failed to add signer' }, { status: 500 })
  }
}

// PUT /api/envelopes/[slug]/signers - Update signers (batch)
export async function PUT(request: NextRequest, { params }: Params) {
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

    const envelope = await prisma.envelope.findFirst({
      where: {
        slug: params.slug,
        userId: user.id,
      },
    })

    if (!envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 })
    }

    if (envelope.status !== 'draft') {
      return NextResponse.json({ error: 'Cannot modify sent envelope' }, { status: 400 })
    }

    const body = await request.json()
    const { signers } = body

    if (!Array.isArray(signers)) {
      return NextResponse.json({ error: 'Signers must be an array' }, { status: 400 })
    }

    // Delete existing signers and recreate
    await prisma.signer.deleteMany({
      where: { envelopeId: envelope.id },
    })

    const createdSigners = await Promise.all(
      signers.map((s: { email: string; name?: string; color?: string; phone2FA?: boolean; phone2FANumber?: string }, index: number) =>
        prisma.signer.create({
          data: {
            envelopeId: envelope.id,
            email: s.email,
            name: s.name || null,
            color: s.color || getNextSignerColor(signers.slice(0, index).map((sig: { color?: string }) => sig.color || '')),
            order: index,
            token: generateToken(),
            phone2FA: s.phone2FA || false,
            phone2FANumber: s.phone2FANumber || null,
          },
        })
      )
    )

    return NextResponse.json({ signers: createdSigners })
  } catch (error) {
    console.error('[PUT /api/envelopes/[slug]/signers] Error:', error)
    return NextResponse.json({ error: 'Failed to update signers' }, { status: 500 })
  }
}

// DELETE /api/envelopes/[slug]/signers - Delete a signer
export async function DELETE(request: NextRequest, { params }: Params) {
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

    const envelope = await prisma.envelope.findFirst({
      where: {
        slug: params.slug,
        userId: user.id,
      },
    })

    if (!envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 })
    }

    if (envelope.status !== 'draft') {
      return NextResponse.json({ error: 'Cannot modify sent envelope' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const signerId = searchParams.get('id')

    if (!signerId) {
      return NextResponse.json({ error: 'Signer ID is required' }, { status: 400 })
    }

    await prisma.signer.delete({
      where: { id: signerId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/envelopes/[slug]/signers] Error:', error)
    return NextResponse.json({ error: 'Failed to delete signer' }, { status: 500 })
  }
}
