import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET = process.env.R2_BUCKET_NAME || 'drime-sign'

export async function uploadPdf(
  buffer: Buffer,
  filename: string
): Promise<{ url: string; hash: string }> {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')
  const key = `pdfs/${Date.now()}-${filename}`
  
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
    })
  )
  
  const url = `${process.env.R2_PUBLIC_URL}/${key}`
  
  return { url, hash }
}

export async function getSignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })
  
  return getSignedUrl(s3Client, command, { expiresIn: 3600 })
}

export function calculateHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}
