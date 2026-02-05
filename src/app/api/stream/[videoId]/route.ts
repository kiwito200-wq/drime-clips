// Stream video via signed URL (R2 buckets are private by default)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPresignedDownloadUrl, getVideoKey, fileExists } from '@/lib/r2';

export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const videoId = params.videoId;
  console.log(`[Stream] Request for video: ${videoId}`);
  
  try {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, ownerId: true, public: true },
    });

    console.log(`[Stream] Video found:`, video ? { id: video.id, ownerId: video.ownerId, public: video.public } : 'NOT FOUND');

    if (!video || !video.public) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Try different video formats (webm for live recordings, mp4 for processed)
    const formats = ['result.webm', 'result.mp4', 'video.webm', 'video.mp4'];
    let signedUrl: string | null = null;
    let foundFormat: string | null = null;

    for (const format of formats) {
      const key = getVideoKey(video.ownerId, video.id, format);
      console.log(`[Stream] Checking key: ${key}`);
      const exists = await fileExists(key);
      console.log(`[Stream] Key ${key} exists: ${exists}`);
      if (exists) {
        signedUrl = await getPresignedDownloadUrl(key, 3600);
        foundFormat = format;
        console.log(`[Stream] Found video at: ${key}, signed URL generated`);
        break;
      }
    }

    if (!signedUrl) {
      console.error(`[Stream] No video file found for ${video.id} (owner: ${video.ownerId})`);
      return NextResponse.json({ 
        error: 'Video file not found',
        videoId: video.id,
        ownerId: video.ownerId,
        checkedFormats: formats,
      }, { status: 404 });
    }

    console.log(`[Stream] Redirecting to signed URL for ${foundFormat}`);
    // Redirect to the signed URL
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error('[Stream] Error:', error);
    return NextResponse.json({ error: 'Failed to stream video' }, { status: 500 });
  }
}
