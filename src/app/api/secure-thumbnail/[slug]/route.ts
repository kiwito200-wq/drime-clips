import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getSignedThumbnailUrl } from '@/lib/storage'

interface Params {
  params: {
    slug: string
  }
}

/**
 * GET /api/secure-thumbnail/[slug]
 * 
 * SECURITY: Returns a signed URL for the thumbnail
 * - Requires authentication
 * - Verifies user has access to the document (owner or signer)
 * - Works for both Envelopes and Templates
 * - Returns a temporary signed URL (24 hours)
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    // SECURITY: Require authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = params
    let thumbnailUrl: string | null = null

    // Try to find in Envelopes first
    const envelope = await prisma.envelope.findFirst({
      where: {
        slug,
        OR: [
          // User is the owner
          { userId: user.id },
          // User is a signer
          { signers: { some: { email: user.email } } }
        ]
      },
      select: {
        thumbnailUrl: true,
      }
    })

    if (envelope) {
      thumbnailUrl = envelope.thumbnailUrl
    } else {
      // Try to find in Templates (only owner can access)
      const template = await prisma.template.findFirst({
        where: {
          slug,
          userId: user.id, // Only owner can access template thumbnails
        },
        select: {
          thumbnailUrl: true,
        }
      })

      if (template) {
        thumbnailUrl = template.thumbnailUrl
      }
    }

    if (!thumbnailUrl) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 })
    }

    // Generate signed URL
    const signedUrl = await getSignedThumbnailUrl(thumbnailUrl)

    return NextResponse.json({ url: signedUrl })
  } catch (error) {
    console.error('[Secure Thumbnail] Error:', error)
    return NextResponse.json({ error: 'Failed to get thumbnail' }, { status: 500 })
  }
}
