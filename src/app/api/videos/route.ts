// Videos API - List all videos for the current user

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getThumbnailKey, getPresignedDownloadUrl, fileExists } from '@/lib/r2';

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

    // Transform for frontend with signed thumbnail URLs
    const transformedVideos = await Promise.all(videos.map(async video => {
      // Check if thumbnail exists and get signed URL
      let thumbnailUrl: string | null = null;
      const thumbnailKey = getThumbnailKey(user.id, video.id);
      
      try {
        const exists = await fileExists(thumbnailKey);
        if (exists) {
          thumbnailUrl = await getPresignedDownloadUrl(thumbnailKey, 3600);
        }
      } catch (e) {
        // Thumbnail doesn't exist yet
      }

      return {
        id: video.id,
        name: video.name,
        duration: video.duration,
        width: video.width,
        height: video.height,
        public: video.public,
        createdAt: video.createdAt.toISOString(),
        thumbnailUrl,
        hasActiveUpload: video.upload !== null,
        uploadProgress: video.upload 
          ? (video.upload.total && video.upload.uploaded 
              ? (video.upload.uploaded / video.upload.total) * 100 
              : null)
          : null,
      };
    }));

    return NextResponse.json({ videos: transformedVideos });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
