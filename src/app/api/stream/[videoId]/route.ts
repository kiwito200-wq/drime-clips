// Stream video via signed URL with Range support (R2 buckets are private by default)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPresignedDownloadUrl, getVideoKey, fileExists, getFileMetadata } from '@/lib/r2';

export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const videoId = params.videoId;
  const rangeHeader = request.headers.get('range');
  
  try {
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, ownerId: true, public: true },
    });

    if (!video || !video.public) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Try different video formats (webm for live recordings, mp4 for processed)
    const formats = ['result.webm', 'result.mp4', 'video.webm', 'video.mp4'];
    let foundKey: string | null = null;
    let foundFormat: string | null = null;

    for (const format of formats) {
      const key = getVideoKey(video.ownerId, video.id, format);
      const exists = await fileExists(key);
      if (exists) {
        foundKey = key;
        foundFormat = format;
        break;
      }
    }

    if (!foundKey) {
      return NextResponse.json({ 
        error: 'Video file not found',
        videoId: video.id,
      }, { status: 404 });
    }

    // Get file metadata for Content-Length
    const metadata = await getFileMetadata(foundKey);
    const fileSize = metadata.size;
    const contentType = foundFormat?.endsWith('.webm') ? 'video/webm' : 'video/mp4';

    // Generate signed URL that supports Range requests
    const signedUrl = await getPresignedDownloadUrl(foundKey, 3600);

    // For Range requests, we need to proxy to support seeking properly
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      // Fetch the specific range from R2
      const rangeResponse = await fetch(signedUrl, {
        headers: {
          'Range': `bytes=${start}-${end}`,
        },
      });

      if (!rangeResponse.ok && rangeResponse.status !== 206) {
        console.error(`[Stream] Range request failed: ${rangeResponse.status}`);
        return NextResponse.json({ error: 'Failed to fetch video range' }, { status: 502 });
      }

      return new NextResponse(rangeResponse.body, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(chunkSize),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // No range header - return full video or redirect
    // Redirect to signed URL (R2 handles Range requests natively)
    return NextResponse.redirect(signedUrl, { status: 302 });

  } catch (error) {
    console.error('[Stream] Error:', error);
    return NextResponse.json({ error: 'Failed to stream video' }, { status: 500 });
  }
}
