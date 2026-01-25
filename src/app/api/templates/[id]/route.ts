import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface Params {
  params: {
    id: string
  }
}

// GET /api/templates/[id] - Get template details
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const template = await prisma.template.findFirst({
      where: {
        id: params.id,
        userId: user.id,
        archivedAt: null,
      },
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Parse JSON fields
    const templateData = {
      ...template,
      schema: JSON.parse(template.schema),
      fields: JSON.parse(template.fields),
      submitters: JSON.parse(template.submitters),
    }

    return NextResponse.json({ template: templateData })
  } catch (error) {
    console.error('[GET /api/templates/[id]] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    )
  }
}

// DELETE /api/templates/[id] - Archive or delete template
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const permanently = searchParams.get('permanently') === 'true'
    const action = searchParams.get('action') // 'archive' | 'unarchive' | null

    const template = await prisma.template.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    if (permanently) {
      await prisma.template.delete({
        where: { id: params.id },
      })
    } else if (action === 'unarchive') {
      await prisma.template.update({
        where: { id: params.id },
        data: { archivedAt: null },
      })
    } else {
      // Default: archive
      await prisma.template.update({
        where: { id: params.id },
        data: { archivedAt: new Date() },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/templates/[id]] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
