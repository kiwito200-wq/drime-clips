import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET = process.env.R2_BUCKET_NAME || 'drime-sign'

// Proxy API pour servir les PDFs depuis R2 (contourne CORS)
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    let key = params.path.join('/')
    
    // Strip bucket name from key if present (different URL formats)
    const bucketNames = ['drimesign', 'drime-sign', process.env.R2_BUCKET_NAME]
    for (const bucketName of bucketNames) {
      if (bucketName && key.startsWith(bucketName + '/')) {
        key = key.slice(bucketName.length + 1)
        break
      }
    }
    
    // Decode URL encoding
    key = decodeURIComponent(key)
    
    console.log('[PDF Proxy] Fetching from S3:', key, 'Bucket:', BUCKET)
    
    // Fetch directly from S3/R2 using credentials
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
    
    const response = await s3Client.send(command)
    
    if (!response.Body) {
      console.error('[PDF Proxy] No body in response')
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }
    
    // Convert stream to buffer
    const chunks: Uint8Array[] = []
    const reader = response.Body.transformToWebStream().getReader()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    
    const pdfBuffer = Buffer.concat(chunks)
    
    // Return PDF with CORS headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('[PDF Proxy] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 500 })
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
