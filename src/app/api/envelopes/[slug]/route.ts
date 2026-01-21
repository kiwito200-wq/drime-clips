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
