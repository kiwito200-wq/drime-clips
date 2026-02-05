// Stream video via signed URL (R2 buckets are private by default)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPresignedDownloadUrl, getVideoKey } from '@/lib/r2';

export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const video = await prisma.video.findUnique({
      where: { id: params.videoId },
      select: { id: true, ownerId: true, public: true },
    });

    if (!video || !video.public) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Generate a signed URL valid for 1 hour
    const key = getVideoKey(video.ownerId, video.id, 'result.mp4');
    const signedUrl = await getPresignedDownloadUrl(key, 3600);

    // Redirect to the signed URL
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error('[Stream] Error:', error);
    return NextResponse.json({ error: 'Failed to stream video' }, { status: 500 });
  }
}
