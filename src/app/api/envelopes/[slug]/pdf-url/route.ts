import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// Force dynamic
export const dynamic = 'force-dynamic'

function getS3Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured')
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
}

// GET /api/envelopes/[slug]/pdf-url - Get signed URL for PDF
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // SECURITY: Require authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SECURITY: Verify user owns this envelope OR is a signer
    const envelope = await prisma.envelope.findFirst({
      where: { 
        slug: params.slug,
        OR: [
          { userId: user.id },
          { signers: { some: { email: user.email } } }
        ]
      },
      select: { pdfUrl: true, finalPdfUrl: true, status: true },
    })

    if (!envelope || !envelope.pdfUrl) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 })
    }

    // Use signed PDF if available (document is completed), otherwise use original
    const pdfUrlToUse = envelope.finalPdfUrl || envelope.pdfUrl

    // Extract key from URL and decode it
    // URL format: https://pub-xxx.r2.dev/pdfs/timestamp-filename.pdf
    // or: https://xxx.r2.cloudflarestorage.com/bucket/pdfs/timestamp-filename.pdf
    let key: string
    try {
      const url = new URL(pdfUrlToUse)
      // Decode the pathname to handle %20 -> space, etc.
      key = decodeURIComponent(url.pathname)
      key = key.startsWith('/') ? key.slice(1) : key
      
      // Remove bucket name if present at start (try both with and without hyphen)
      const bucketName = process.env.R2_BUCKET_NAME || 'drimesign'
      if (key.startsWith(bucketName + '/')) {
        key = key.slice(bucketName.length + 1)
      }
      // Also try with hyphen variant
      if (key.startsWith('drime-sign/')) {
        key = key.slice('drime-sign/'.length)
      }
    } catch {
      key = decodeURIComponent(pdfUrlToUse)
    }

    const client = getS3Client()
    const bucket = process.env.R2_BUCKET_NAME || 'drimesign'
    
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseCacheControl: 'public, max-age=3600',
    })
    
    const signedUrl = await getSignedUrl(client, command, { expiresIn: 3600 })

    return NextResponse.json({ url: signedUrl })
  } catch (error) {
    console.error('[PDF URL] Error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF URL' }, { status: 500 })
  }
}
