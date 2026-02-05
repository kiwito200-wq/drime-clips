// Cloudflare R2 Storage Client
// For video uploads with multipart support

import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Environment variables
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'drime-clips';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || `https://pub-${R2_ACCOUNT_ID}.r2.dev`;

// S3 Client for R2
let s3Client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!s3Client) {
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error('Missing R2 credentials. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY');
    }
    
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

// ============================================
// SINGLE UPLOAD
// ============================================

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | ReadableStream | string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<{ key: string; url: string }> {
  const client = getR2Client();
  
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body as any,
      ContentType: contentType,
      Metadata: metadata,
      CacheControl: 'max-age=31536000',
    })
  );
  
  return {
    key,
    url: `${R2_PUBLIC_URL}/${key}`,
  };
}

// ============================================
// PRESIGNED URLS
// ============================================

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getR2Client();
  
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    CacheControl: 'max-age=31536000',
  });
  
  return getSignedUrl(client, command, { expiresIn });
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getR2Client();
  
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  
  return getSignedUrl(client, command, { expiresIn });
}

// ============================================
// MULTIPART UPLOAD (for large videos)
// ============================================

export async function initiateMultipartUpload(
  key: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<string> {
  const client = getR2Client();
  
  const response = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      Metadata: metadata,
      CacheControl: 'max-age=31536000',
    })
  );
  
  if (!response.UploadId) {
    throw new Error('Failed to initiate multipart upload');
  }
  
  return response.UploadId;
}

export async function getPresignedPartUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn: number = 3600
): Promise<string> {
  const client = getR2Client();
  
  const command = new UploadPartCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  
  return getSignedUrl(client, command, { expiresIn });
}

export interface CompletedPart {
  PartNumber: number;
  ETag: string;
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: CompletedPart[]
): Promise<{ key: string; url: string }> {
  const client = getR2Client();
  
  // Sort parts by part number
  const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
  
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts,
      },
    })
  );
  
  // Fix content type by copying object to itself
  try {
    await client.send(
      new CopyObjectCommand({
        Bucket: R2_BUCKET_NAME,
        CopySource: `${R2_BUCKET_NAME}/${key}`,
        Key: key,
        ContentType: 'video/mp4',
        MetadataDirective: 'REPLACE',
      })
    );
  } catch (error) {
    console.error('Warning: Failed to fix metadata after multipart upload:', error);
  }
  
  return {
    key,
    url: `${R2_PUBLIC_URL}/${key}`,
  };
}

export async function abortMultipartUpload(
  key: string,
  uploadId: string
): Promise<void> {
  const client = getR2Client();
  
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
    })
  );
}

// ============================================
// FILE OPERATIONS
// ============================================

export async function deleteFile(key: string): Promise<void> {
  const client = getR2Client();
  
  await client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
}

export async function deleteFiles(keys: string[]): Promise<void> {
  const client = getR2Client();
  
  // Delete files in parallel (R2 doesn't have batch delete like S3)
  await Promise.all(
    keys.map((key) =>
      client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
        })
      )
    )
  );
}

export async function listFiles(prefix: string): Promise<string[]> {
  const client = getR2Client();
  
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
    })
  );
  
  return response.Contents?.map((item) => item.Key!).filter(Boolean) || [];
}

export async function fileExists(key: string): Promise<boolean> {
  const client = getR2Client();
  
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function getFileMetadata(key: string): Promise<{
  contentType?: string;
  contentLength?: number;
  lastModified?: Date;
} | null> {
  const client = getR2Client();
  
  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    
    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
    };
  } catch {
    return null;
  }
}

// ============================================
// VIDEO-SPECIFIC HELPERS
// ============================================

export function getVideoKey(userId: string, videoId: string, filename: string = 'result.mp4'): string {
  return `${userId}/${videoId}/${filename}`;
}

export function getThumbnailKey(userId: string, videoId: string): string {
  return `${userId}/${videoId}/thumbnail.jpg`;
}

export function getPreviewGifKey(userId: string, videoId: string): string {
  return `${userId}/${videoId}/preview.gif`;
}

export function getPublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

// Export config for use in other files
export const r2Config = {
  accountId: R2_ACCOUNT_ID,
  bucketName: R2_BUCKET_NAME,
  publicUrl: R2_PUBLIC_URL,
};
