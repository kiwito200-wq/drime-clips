import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { prisma } from '@/lib/prisma'

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
    // Skip auth check for now - envelope access is validated by slug
    // TODO: Add proper auth when Drime integration is complete

    const envelope = await prisma.envelope.findFirst({
      where: { slug: params.slug },
      select: { pdfUrl: true },
    })

    if (!envelope || !envelope.pdfUrl) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 })
    }

    // Extract key from URL
    // URL format: https://pub-xxx.r2.dev/pdfs/timestamp-filename.pdf
    // or: https://xxx.r2.cloudflarestorage.com/bucket/pdfs/timestamp-filename.pdf
    let key: string
    try {
      const url = new URL(envelope.pdfUrl)
      key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname
      // Remove bucket name if present at start
      const bucketName = process.env.R2_BUCKET_NAME || 'drime-sign'
      if (key.startsWith(bucketName + '/')) {
        key = key.slice(bucketName.length + 1)
      }
    } catch {
      key = envelope.pdfUrl
    }

    console.log('[PDF URL] Generating signed URL for key:', key)

    const client = getS3Client()
    const bucket = process.env.R2_BUCKET_NAME || 'drime-sign'
    
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
