// Multipart Upload - Presign Part
// Get a presigned URL for uploading a single part

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserAny } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPresignedPartUrl, getVideoKey } from '@/lib/r2';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserAny(request);
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { videoId, uploadId, partNumber } = body;

    if (!videoId || !uploadId || !partNumber) {
      return NextResponse.json({ error: 'videoId, uploadId, and partNumber required' }, { status: 400 });
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

    console.log(`[Multipart Presign] Getting presigned URL for part ${partNumber} of upload ${uploadId}`);

    // Get presigned URL for this part
    const presignedUrl = await getPresignedPartUrl(fileKey, uploadId, partNumber, 3600); // 1 hour

    return NextResponse.json({ presignedUrl });
  } catch (error) {
    console.error('Error creating presigned URL for part:', error);
    return NextResponse.json({
      error: 'Error creating presigned URL for part',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
