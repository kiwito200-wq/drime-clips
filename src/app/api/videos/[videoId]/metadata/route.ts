import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/videos/[videoId]/metadata - Get video metadata
export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        name: true,
        duration: true,
        width: true,
        height: true,
        fps: true,
        source: true,
        metadata: true,
        createdAt: true,
        public: true,
      },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: video.id,
      name: video.name,
      duration: video.duration,
      width: video.width,
      height: video.height,
      fps: video.fps,
      source: video.source,
      metadata: video.metadata,
      createdAt: video.createdAt,
      public: video.public,
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 });
  }
}

// PATCH /api/videos/[videoId]/metadata - Update video metadata
export async function PATCH(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;
    const body = await request.json();
    const { duration, width, height, fps, name, metadata } = body;

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, ownerId: true },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Build update data
    const updateData: any = {};
    if (duration !== undefined) updateData.duration = parseFloat(duration);
    if (width !== undefined) updateData.width = parseInt(width, 10);
    if (height !== undefined) updateData.height = parseInt(height, 10);
    if (fps !== undefined) updateData.fps = parseInt(fps, 10);
    if (name !== undefined) updateData.name = name;
    if (metadata !== undefined) {
      // Merge with existing metadata
      const existing = (video as any).metadata || {};
      updateData.metadata = { ...existing, ...metadata };
    }

    const updated = await prisma.video.update({
      where: { id: videoId },
      data: updateData,
      select: {
        id: true,
        name: true,
        duration: true,
        width: true,
        height: true,
        fps: true,
        metadata: true,
      },
    });

    console.log(`[Metadata] Updated video ${videoId}:`, updateData);

    return NextResponse.json({
      success: true,
      video: updated,
    });
  } catch (error) {
    console.error('Error updating metadata:', error);
    return NextResponse.json({ error: 'Failed to update metadata' }, { status: 500 });
  }
}
