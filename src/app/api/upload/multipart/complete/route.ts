// Multipart Upload - Complete
// Finish a multipart upload by combining all parts

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserAny } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { completeMultipartUpload, getVideoKey, type CompletedPart } from '@/lib/r2';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserAny(request);
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { videoId, uploadId, parts, durationInSecs, width, height, fps } = body;

    if (!videoId || !uploadId || !parts || !Array.isArray(parts)) {
      return NextResponse.json({ error: 'videoId, uploadId, and parts required' }, { status: 400 });
    }

    // Verify video belongs to user
    const video = await prisma.video.findFirst({
      where: {
        id: videoId,
        ownerId: user.id,
      },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Build file key
    const fileKey = getVideoKey(user.id, videoId, 'result.mp4');

    console.log(`[Multipart Complete] Completing upload ${uploadId} with ${parts.length} parts for ${fileKey}`);

    // Format parts for S3
    const formattedParts: CompletedPart[] = parts.map((part: { partNumber: number; etag: string; size?: number }) => ({
      PartNumber: part.partNumber,
      ETag: part.etag,
    }));

    // Log total size
    const totalSize = parts.reduce((acc: number, part: { size?: number }) => acc + (part.size || 0), 0);
    console.log(`[Multipart Complete] Total size: ${totalSize} bytes`);

    // Complete the multipart upload
    const result = await completeMultipartUpload(fileKey, uploadId, formattedParts);

    console.log(`[Multipart Complete] Upload completed: ${result.url}`);

    // Update video metadata
    await prisma.video.update({
      where: { id: videoId },
      data: {
        duration: durationInSecs ?? undefined,
        width: width ?? undefined,
        height: height ?? undefined,
        fps: fps ?? undefined,
      },
    });

    // Delete upload tracking (upload complete)
    await prisma.videoUpload.deleteMany({
      where: { videoId },
    });

    return NextResponse.json({
      success: true,
      fileKey,
      location: result.url,
    });
  } catch (error) {
    console.error('Error completing multipart upload:', error);
    return NextResponse.json({
      error: 'Error completing multipart upload',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
