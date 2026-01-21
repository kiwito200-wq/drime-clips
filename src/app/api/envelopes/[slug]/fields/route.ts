import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface Params {
  params: {
    slug: string
  }
}

// POST /api/envelopes/[slug]/fields - Save fields (batch)
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
    const { fields } = body

    if (!Array.isArray(fields)) {
      return NextResponse.json({ error: 'Fields must be an array' }, { status: 400 })
    }

    // Delete existing fields
    await prisma.field.deleteMany({
      where: { envelopeId: envelope.id },
    })

    // Create new fields
    const createdFields = await Promise.all(
      fields.map((field: {
        signerId: string
        type: string
        label?: string
        placeholder?: string
        required?: boolean
        page: number
        x: number
        y: number
        width: number
        height: number
      }) =>
        prisma.field.create({
          data: {
            envelopeId: envelope.id,
            signerId: field.signerId,
            type: field.type,
            label: field.label || null,
            placeholder: field.placeholder || null,
            required: field.required !== false,
            page: field.page,
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
          },
        })
      )
    )

    return NextResponse.json({ fields: createdFields })
  } catch (error) {
    console.error('[POST /api/envelopes/[slug]/fields] Error:', error)
    return NextResponse.json({ error: 'Failed to save fields' }, { status: 500 })
  }
}

// GET /api/envelopes/[slug]/fields - Get fields
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
        fields: {
          include: {
            signer: true,
          },
        },
      },
    })

    if (!envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 })
    }

    return NextResponse.json({ fields: envelope.fields })
  } catch (error) {
    console.error('[GET /api/envelopes/[slug]/fields] Error:', error)
    return NextResponse.json({ error: 'Failed to load fields' }, { status: 500 })
  }
}
