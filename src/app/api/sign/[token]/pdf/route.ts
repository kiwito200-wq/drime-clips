import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { prisma } from '@/lib/prisma'

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

interface Params {
  params: {
    token: string
  }
}

// GET /api/sign/[token]/pdf - Get signed URL for PDF
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const signer = await prisma.signer.findUnique({
      where: { token: params.token },
      include: {
        envelope: {
          select: {
            pdfUrl: true,
          },
        },
      },
    })

    if (!signer || !signer.envelope.pdfUrl) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Extract key from URL
    let key: string
    try {
      const url = new URL(signer.envelope.pdfUrl)
      key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname
      const bucketName = process.env.R2_BUCKET_NAME || 'drimesign'
      if (key.startsWith(bucketName + '/')) {
        key = key.slice(bucketName.length + 1)
      }
      key = decodeURIComponent(key)
    } catch {
      key = signer.envelope.pdfUrl
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
    console.error('[Sign PDF] Error:', error)
    return NextResponse.json({ error: 'Failed to get PDF' }, { status: 500 })
  }
}
