// Multipart Upload - Abort
// Cancel a multipart upload

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { abortMultipartUpload, getVideoKey } from '@/lib/r2';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { videoId, uploadId } = body;

    if (!videoId || !uploadId) {
      return NextResponse.json({ error: 'videoId and uploadId required' }, { status: 400 });
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

    console.log(`[Multipart Abort] Aborting upload ${uploadId} for ${fileKey}`);

    // Abort the multipart upload
    await abortMultipartUpload(fileKey, uploadId);

    // Delete upload tracking
    await prisma.videoUpload.deleteMany({
      where: { videoId },
    });

    return NextResponse.json({ success: true, fileKey, uploadId });
  } catch (error) {
    console.error('Error aborting multipart upload:', error);
    return NextResponse.json({
      error: 'Error aborting multipart upload',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
