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
    const { envelopeId, name, description, folderName, roles } = body

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

    // Convert fields to template format
    // Map signerId to roleId for template fields
    const templateFields = envelope.fields.map((field) => {
      const signer = envelope.signers.find(s => s.id === field.signerId)
      let roleId = field.signerId
      
      // If we have roles provided, map signerId to roleId
      if (roles && Array.isArray(roles)) {
        // Find the role that matches this signer (by email pattern or ID)
        const isTemplateRole = signer?.email?.includes('@template.local')
        if (isTemplateRole && signer) {
          const extractedRoleId = signer.email.split('@')[0]
          // Find matching role by ID
          const matchingRole = roles.find(r => r.id === extractedRoleId)
          roleId = matchingRole?.id || extractedRoleId
        } else if (signer) {
          // Try to find role by matching signer email/name to role name
          const matchingRole = roles.find(r => 
            r.name.toLowerCase() === (signer.name || '').toLowerCase() ||
            r.id === signer.id
          )
          if (matchingRole) {
            roleId = matchingRole.id
          }
        }
      } else if (signer?.email?.includes('@template.local')) {
        roleId = signer.email.split('@')[0]
      }
      
      return {
        id: field.id,
        type: field.type,
        roleId: roleId, // Store roleId instead of signerId
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

    // Convert signers to template format (roles)
    // If roles are provided directly, use them; otherwise extract from signers
    let templateSubmitters
    if (roles && Array.isArray(roles)) {
      // Use provided roles directly
      templateSubmitters = roles.map((role: any, index: number) => ({
        id: role.id,
        name: role.name,
        color: role.color,
        order: index,
      }))
    } else {
      // Fallback: Extract roles from signers (for backward compatibility)
      templateSubmitters = envelope.signers.map((signer) => {
        const isTemplateRole = signer.email.includes('@template.local')
        const roleId = isTemplateRole ? signer.email.split('@')[0] : signer.id
        
        return {
          id: roleId,
          name: signer.name || signer.email.split('@')[0] || 'Role',
          email: signer.email,
          color: signer.color,
          order: signer.order,
        }
      })
    }

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
