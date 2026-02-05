// Videos API - List all videos for the current user

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getPublicUrl, getThumbnailKey } from '@/lib/r2';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Fetch videos with upload status
    const videos = await prisma.video.findMany({
      where: {
        ownerId: user.id,
      },
      include: {
        upload: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform for frontend
    const transformedVideos = videos.map(video => ({
      id: video.id,
      name: video.name,
      duration: video.duration,
      width: video.width,
      height: video.height,
      public: video.public,
      createdAt: video.createdAt.toISOString(),
      thumbnailUrl: getPublicUrl(getThumbnailKey(user.id, video.id)),
      hasActiveUpload: video.upload !== null,
      uploadProgress: video.upload 
        ? (video.upload.total && video.upload.uploaded 
            ? (video.upload.uploaded / video.upload.total) * 100 
            : null)
        : null,
    }));

    return NextResponse.json({ videos: transformedVideos });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
