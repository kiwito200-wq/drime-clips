import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface Params {
  params: {
    slug: string
  }
}

// GET /api/envelopes/[slug] - Get envelope details
export async function GET(request: NextRequest, { params }: Params) {
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
        signers: {
          orderBy: { order: 'asc' },
        },
        fields: {
          include: {
            signer: true,
          },
        },
        auditLogs: {
          orderBy: { createdAt: 'asc' },
          include: {
            signer: true,
          },
        },
      },
    })

    if (!envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 })
    }

    return NextResponse.json({ envelope })
  } catch (error) {
    console.error('[GET /api/envelopes/[slug]] Error:', error)
    return NextResponse.json({ error: 'Failed to load envelope' }, { status: 500 })
  }
}

// PATCH /api/envelopes/[slug] - Update envelope (rename, change due date)
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    let user = await getCurrentUser()
    
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

    const body = await request.json()
    const { name, dueDate } = body

    // Verify ownership
    const envelope = await prisma.envelope.findFirst({
      where: {
        slug: params.slug,
        userId: user.id,
      },
    })

    if (!envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 })
    }

    // Build update data
    const updateData: { name?: string; expiresAt?: Date } = {}
    if (name !== undefined) updateData.name = name
    if (dueDate !== undefined) updateData.expiresAt = new Date(dueDate)

    const updatedEnvelope = await prisma.envelope.update({
      where: { id: envelope.id },
      data: updateData,
    })

    // Log the action
    await prisma.auditLog.create({
      data: {
        envelopeId: envelope.id,
        action: name !== undefined ? 'renamed' : 'due_date_changed',
        details: JSON.stringify(updateData),
      },
    })

    return NextResponse.json({ envelope: updatedEnvelope })
  } catch (error) {
    console.error('[PATCH /api/envelopes/[slug]] Error:', error)
    return NextResponse.json({ error: 'Failed to update envelope' }, { status: 500 })
  }
}

// DELETE /api/envelopes/[slug] - Delete envelope
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    let user = await getCurrentUser()
    
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

    // Verify ownership
    const envelope = await prisma.envelope.findFirst({
      where: {
        slug: params.slug,
        userId: user.id,
      },
    })

    if (!envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 })
    }

    // Delete related records first (cascade)
    await prisma.auditLog.deleteMany({ where: { envelopeId: envelope.id } })
    await prisma.field.deleteMany({ where: { envelopeId: envelope.id } })
    await prisma.signer.deleteMany({ where: { envelopeId: envelope.id } })
    
    // Delete the envelope
    await prisma.envelope.delete({ where: { id: envelope.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/envelopes/[slug]] Error:', error)
    return NextResponse.json({ error: 'Failed to delete envelope' }, { status: 500 })
  }
}
