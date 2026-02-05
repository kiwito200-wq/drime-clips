// Presigned URL Upload API
// For single-part uploads

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPresignedUploadUrl, getVideoKey } from '@/lib/r2';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { videoId, subpath, durationInSecs, width, height, fps, method = 'put' } = body;

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
    const fileKey = getVideoKey(user.id, videoId, subpath || 'result.mp4');

    // Determine content type
    const contentType = fileKey.endsWith('.aac')
      ? 'audio/aac'
      : fileKey.endsWith('.webm')
        ? 'audio/webm'
        : fileKey.endsWith('.mp4')
          ? 'video/mp4'
          : fileKey.endsWith('.mp3')
            ? 'audio/mpeg'
            : fileKey.endsWith('.m3u8')
              ? 'application/x-mpegURL'
              : 'video/mp2t';

    // Get presigned URL
    const presignedUrl = await getPresignedUploadUrl(fileKey, contentType, 1800); // 30 minutes

    // Update video metadata if provided
    if (durationInSecs || width || height || fps) {
      await prisma.video.update({
        where: { id: videoId },
        data: {
          duration: durationInSecs ?? undefined,
          width: width ?? undefined,
          height: height ?? undefined,
          fps: fps ?? undefined,
        },
      });
    }

    // Update upload mode
    if (fileKey.endsWith('result.mp4')) {
      await prisma.videoUpload.updateMany({
        where: { videoId },
        data: { mode: 'singlepart' },
      });
    }

    console.log(`[Upload Signed] Generated presigned URL for ${fileKey}`);

    if (method === 'post') {
      return NextResponse.json({
        presignedPostData: {
          url: presignedUrl,
          fields: {},
        },
      });
    } else {
      return NextResponse.json({
        presignedPutData: {
          url: presignedUrl,
          fields: {},
        },
      });
    }
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
