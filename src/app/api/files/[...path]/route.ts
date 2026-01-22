import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET = process.env.R2_BUCKET_NAME || 'drimesign'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    let key = params.path.join('/')
    
    // Remove bucket name from path if present
    if (key.startsWith(BUCKET + '/')) {
      key = key.slice(BUCKET.length + 1)
    }
    // Also check for common bucket name variations
    if (key.startsWith('drimesign/')) {
      key = key.slice('drimesign/'.length)
    }
    if (key.startsWith('drime-sign/')) {
      key = key.slice('drime-sign/'.length)
    }
    
    console.log('[Files Proxy] Fetching:', key)

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })

    const response = await s3Client.send(command)
    
    if (!response.Body) {
      return new NextResponse('File not found', { status: 404 })
    }

    const chunks: Uint8Array[] = []
    // @ts-ignore - response.Body is a readable stream
    for await (const chunk of response.Body) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    // Determine content type
    let contentType = response.ContentType || 'application/octet-stream'
    if (key.endsWith('.png')) {
      contentType = 'image/png'
    } else if (key.endsWith('.pdf')) {
      contentType = 'application/pdf'
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error: any) {
    console.error('[Files Proxy] Error:', error)
    return new NextResponse(error.message || 'Internal error', { status: 500 })
  }
}
