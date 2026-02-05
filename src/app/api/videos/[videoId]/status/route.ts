import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Check if a video upload is complete
export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { upload: true },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Video is ready if there's no upload record (it was deleted when upload completed)
    const ready = video.upload === null;

    return NextResponse.json({
      ready,
      videoId: video.id,
    });
  } catch (error) {
    console.error('Error checking video status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
