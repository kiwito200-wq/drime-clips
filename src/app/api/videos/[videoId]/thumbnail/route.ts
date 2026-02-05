import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPresignedDownloadUrl, fileExists } from '@/lib/r2';

// GET /api/videos/[videoId]/thumbnail - Get thumbnail for a video
export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;
    const { searchParams } = request.nextUrl;
    const timestamp = parseFloat(searchParams.get('t') || '0');

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, ownerId: true, public: true, duration: true },
    });

    if (!video || !video.public) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Check if we have a cached thumbnail for this timestamp
    const thumbnailKey = `${video.ownerId}/${video.id}/thumbnails/t_${timestamp.toFixed(1)}.jpg`;
    const exists = await fileExists(thumbnailKey);

    if (exists) {
      const url = await getPresignedDownloadUrl(thumbnailKey, 3600);
      return NextResponse.json({ url, cached: true });
    }

    // Check for default thumbnail (screen-capture.jpg or thumbnail.jpg)
    const defaultThumbnails = ['screen-capture.jpg', 'thumbnail.jpg'];
    for (const thumbName of defaultThumbnails) {
      const defaultKey = `${video.ownerId}/${video.id}/${thumbName}`;
      if (await fileExists(defaultKey)) {
        const url = await getPresignedDownloadUrl(defaultKey, 3600);
        return NextResponse.json({ url, cached: true, isDefault: true });
      }
    }

    // No thumbnail found
    return NextResponse.json({ 
      url: null, 
      message: 'No thumbnail available. Generate one with POST request.',
    });
  } catch (error) {
    console.error('Error getting thumbnail:', error);
    return NextResponse.json({ error: 'Failed to get thumbnail' }, { status: 500 });
  }
}

// POST /api/videos/[videoId]/thumbnail - Request thumbnail generation
// This would typically trigger a background job to generate thumbnails
export async function POST(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;
    const body = await request.json().catch(() => ({}));
    const { timestamps = [0] } = body;

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, ownerId: true, public: true, duration: true },
    });

    if (!video || !video.public) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // For now, just return presigned URLs for where the thumbnails would be stored
    // In production, this would trigger a background job with FFmpeg
    const results = timestamps.map((t: number) => ({
      timestamp: t,
      key: `${video.ownerId}/${video.id}/thumbnails/t_${t.toFixed(1)}.jpg`,
      status: 'pending',
    }));

    return NextResponse.json({
      videoId,
      thumbnails: results,
      message: 'Thumbnail generation queued. Use GET to check status.',
    });
  } catch (error) {
    console.error('Error requesting thumbnails:', error);
    return NextResponse.json({ error: 'Failed to request thumbnails' }, { status: 500 });
  }
}
