import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl as getPresignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'

function getS3Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  })
}

const BUCKET = process.env.R2_BUCKET_NAME || 'drimesign'

// R2 Storage helper object
export const r2 = {
  get bucket(): string {
    return process.env.R2_BUCKET_NAME || 'drimesign'
  },
  
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const client = getS3Client()
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })
    return await getPresignedUrl(client, command, { expiresIn })
  },
  
  async uploadFile(key: string, body: Buffer, contentType: string): Promise<void> {
    const client = getS3Client()
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    )
  },
}

export async function uploadPdf(
  buffer: Buffer,
  filename: string
): Promise<{ url: string; hash: string }> {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')
  const key = `pdfs/${Date.now()}-${filename}`
  
  await r2.uploadFile(key, buffer, 'application/pdf')
  
  const url = `${process.env.R2_PUBLIC_URL}/${key}`
  
  return { url, hash }
}

export async function getSignedDownloadUrl(key: string): Promise<string> {
  return r2.getSignedUrl(key)
}

export function calculateHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}
