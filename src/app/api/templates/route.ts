import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { nanoid } from 'nanoid'

// GET /api/templates - List all templates for current user
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const archived = searchParams.get('archived') === 'true'

    const templates = await prisma.template.findMany({
      where: {
        userId: user.id,
        archivedAt: archived ? { not: null } : null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('[GET /api/templates] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// POST /api/templates - Create a template from an envelope
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { envelopeId, name, description, folderName } = body

    if (!envelopeId || !name) {
      return NextResponse.json(
        { error: 'envelopeId and name are required' },
        { status: 400 }
      )
    }

    // Fetch the envelope with all its data
    const envelope = await prisma.envelope.findFirst({
      where: {
        id: envelopeId,
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
      },
    })

    if (!envelope) {
      return NextResponse.json(
        { error: 'Envelope not found' },
        { status: 404 }
      )
    }

    // Create schema (structure of pages - simplified for now)
    const schema = JSON.stringify([
      {
        attachment_uuid: envelope.id,
        page: 0,
      },
    ])

    // Convert fields to template format (include signer email for mapping)
    const templateFields = envelope.fields.map((field) => {
      const signer = envelope.signers.find(s => s.id === field.signerId)
      return {
        id: field.id,
        type: field.type,
        signerId: field.signerId,
        email: signer?.email || '', // Store email for mapping when loading template
        page: field.page,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        required: field.required,
        label: field.label || '',
        placeholder: field.placeholder || '',
      }
    })

    // Convert signers to template format
    const templateSubmitters = envelope.signers.map((signer) => ({
      id: signer.id,
      name: signer.name || signer.email,
      email: signer.email,
      color: signer.color,
      order: signer.order,
    }))

    // Generate unique slug
    const slug = nanoid(14)

    // Create template
    const template = await prisma.template.create({
      data: {
        slug,
        userId: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        pdfUrl: envelope.pdfUrl,
        pdfHash: envelope.pdfHash,
        thumbnailUrl: envelope.thumbnailUrl,
        schema,
        fields: JSON.stringify(templateFields),
        submitters: JSON.stringify(templateSubmitters),
        folderName: folderName || 'Mes templates',
      },
    })

    return NextResponse.json({ template })
  } catch (error) {
    console.error('[POST /api/templates] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}
