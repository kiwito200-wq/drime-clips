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
 * - Returns a temporary signed URL (1 hour)
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    // SECURITY: Require authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = params

    // Find the envelope and verify access
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

    if (!envelope) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 })
    }

    if (!envelope.thumbnailUrl) {
      return NextResponse.json({ error: 'No thumbnail available' }, { status: 404 })
    }

    // Generate signed URL
    const signedUrl = await getSignedThumbnailUrl(envelope.thumbnailUrl)

    return NextResponse.json({ url: signedUrl })
  } catch (error) {
    console.error('[Secure Thumbnail] Error:', error)
    return NextResponse.json({ error: 'Failed to get thumbnail' }, { status: 500 })
  }
}
