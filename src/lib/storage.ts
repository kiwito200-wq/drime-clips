import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl as getPresignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'

// SECURITY: Validate R2 credentials are configured
function getS3Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 storage credentials not configured')
  }
  
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  })
}

const BUCKET = process.env.R2_BUCKET_NAME || 'drimesign'

// SECURITY: Default URL expiration times
const PDF_URL_EXPIRY = 3600      // 1 hour for PDFs
const THUMBNAIL_URL_EXPIRY = 86400  // 24 hours for thumbnails (less sensitive)

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
): Promise<{ url: string; key: string; hash: string }> {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')
  // SECURITY: Sanitize filename to prevent path traversal
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  const key = `pdfs/${Date.now()}-${safeFilename}`
  
  await r2.uploadFile(key, buffer, 'application/pdf')
  
  // Store the public URL for internal use (worker needs it)
  // User-facing access should use getSignedPdfUrl() for security
  const publicUrl = process.env.R2_PUBLIC_URL 
    ? `${process.env.R2_PUBLIC_URL}/${key}`
    : key // Fallback to key if no public URL configured
  
  return { url: publicUrl, key, hash }
}

export async function uploadThumbnail(
  buffer: Buffer,
  filename: string
): Promise<string> {
  // SECURITY: Sanitize filename
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  const key = `thumbnails/${Date.now()}-${safeFilename}.png`
  
  await r2.uploadFile(key, buffer, 'image/png')
  
  // SECURITY: Return only the key, not a public URL
  // Use getSignedThumbnailUrl() to generate authenticated access URLs
  return key
}

export async function getSignedDownloadUrl(key: string, expiresIn: number = PDF_URL_EXPIRY): Promise<string> {
  return r2.getSignedUrl(key, expiresIn)
}

/**
 * SECURITY: Generate a signed URL for a PDF key
 * Always use this instead of exposing public URLs
 */
export async function getSignedPdfUrl(keyOrUrl: string): Promise<string> {
  // Extract key from URL if full URL is passed
  let key = keyOrUrl
  if (keyOrUrl.startsWith('http')) {
    try {
      const url = new URL(keyOrUrl)
      key = decodeURIComponent(url.pathname)
      key = key.startsWith('/') ? key.slice(1) : key
      // Remove bucket name if present
      const bucketName = process.env.R2_BUCKET_NAME || 'drimesign'
      if (key.startsWith(bucketName + '/')) {
        key = key.slice(bucketName.length + 1)
      }
    } catch {
      key = keyOrUrl
    }
  }
  
  return r2.getSignedUrl(key, PDF_URL_EXPIRY)
}

/**
 * SECURITY: Generate a signed URL for a thumbnail key
 */
export async function getSignedThumbnailUrl(keyOrUrl: string): Promise<string> {
  let key = keyOrUrl
  if (keyOrUrl.startsWith('http')) {
    try {
      const url = new URL(keyOrUrl)
      key = decodeURIComponent(url.pathname)
      key = key.startsWith('/') ? key.slice(1) : key
      const bucketName = process.env.R2_BUCKET_NAME || 'drimesign'
      if (key.startsWith(bucketName + '/')) {
        key = key.slice(bucketName.length + 1)
      }
    } catch {
      key = keyOrUrl
    }
  }
  
  return r2.getSignedUrl(key, THUMBNAIL_URL_EXPIRY)
}

export function calculateHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}
