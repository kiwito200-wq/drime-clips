// Stream video via signed URL (R2 buckets are private by default)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPresignedDownloadUrl, getVideoKey, fileExists } from '@/lib/r2';

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

    // Try different video formats (webm for live recordings, mp4 for processed)
    const formats = ['result.webm', 'result.mp4', 'video.webm', 'video.mp4'];
    let signedUrl: string | null = null;

    for (const format of formats) {
      const key = getVideoKey(video.ownerId, video.id, format);
      const exists = await fileExists(key);
      if (exists) {
        signedUrl = await getPresignedDownloadUrl(key, 3600);
        console.log(`[Stream] Found video at: ${key}`);
        break;
      }
    }

    if (!signedUrl) {
      console.error(`[Stream] No video file found for ${video.id}`);
      return NextResponse.json({ error: 'Video file not found' }, { status: 404 });
    }

    // Redirect to the signed URL
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error('[Stream] Error:', error);
    return NextResponse.json({ error: 'Failed to stream video' }, { status: 500 });
  }
}
