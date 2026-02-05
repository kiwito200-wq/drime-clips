// Multipart Upload - Initiate
// Start a multipart upload for large files (upload during recording)

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { initiateMultipartUpload, getVideoKey } from '@/lib/r2';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { videoId, contentType = 'video/mp4' } = body;

    if (!videoId) {
      return NextResponse.json({ error: 'videoId required' }, { status: 400 });
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

    console.log(`[Multipart Initiate] Starting upload for ${fileKey}, content-type: ${contentType}`);

    // Initiate multipart upload
    const uploadId = await initiateMultipartUpload(fileKey, contentType, {
      userId: user.id,
      source: 'drime-clips-multipart',
    });

    console.log(`[Multipart Initiate] Upload ID: ${uploadId}`);

    // Update upload mode
    await prisma.videoUpload.updateMany({
      where: { videoId },
      data: { mode: 'multipart' },
    });

    return NextResponse.json({ uploadId });
  } catch (error) {
    console.error('Error initiating multipart upload:', error);
    return NextResponse.json({
      error: 'Error initiating multipart upload',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
