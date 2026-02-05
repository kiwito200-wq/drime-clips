// Video API - Get/Delete single video

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { deleteFiles, listFiles, getPublicUrl, getVideoKey, getThumbnailKey } from '@/lib/r2';

// GET /api/videos/[videoId] - Get video details
export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const video = await prisma.video.findFirst({
      where: {
        id: params.videoId,
        ownerId: user.id,
      },
      include: {
        upload: true,
      },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: video.id,
      name: video.name,
      description: video.description,
      duration: video.duration,
      width: video.width,
      height: video.height,
      public: video.public,
      createdAt: video.createdAt.toISOString(),
      videoUrl: getPublicUrl(getVideoKey(user.id, video.id, 'result.mp4')),
      thumbnailUrl: getPublicUrl(getThumbnailKey(user.id, video.id)),
      hasActiveUpload: video.upload !== null,
    });
  } catch (error) {
    console.error('Error fetching video:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/videos/[videoId] - Delete video
export async function DELETE(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const video = await prisma.video.findFirst({
      where: {
        id: params.videoId,
        ownerId: user.id,
      },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Delete upload tracking
    await prisma.videoUpload.deleteMany({
      where: { videoId: params.videoId },
    });

    // Delete video views
    await prisma.videoView.deleteMany({
      where: { videoId: params.videoId },
    });

    // Delete video from database
    await prisma.video.delete({
      where: { id: params.videoId },
    });

    // Delete files from R2
    try {
      const prefix = `${user.id}/${params.videoId}/`;
      const files = await listFiles(prefix);
      if (files.length > 0) {
        await deleteFiles(files);
      }
    } catch (error) {
      console.error('Error deleting files from R2:', error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting video:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/videos/[videoId] - Update video
export async function PATCH(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, public: isPublic } = body;

    const video = await prisma.video.findFirst({
      where: {
        id: params.videoId,
        ownerId: user.id,
      },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const updated = await prisma.video.update({
      where: { id: params.videoId },
      data: {
        name: name ?? undefined,
        description: description ?? undefined,
        public: isPublic ?? undefined,
      },
    });

    return NextResponse.json({ video: updated });
  } catch (error) {
    console.error('Error updating video:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
