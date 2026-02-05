// GET /api/videos/[videoId]/transcript - Get the transcription for a video

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPresignedDownloadUrl, fileExists } from '@/lib/r2';
import { parseWebVTT } from '@/lib/transcribe';

export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;

    // Find the video
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        ownerId: true,
        public: true,
        transcriptionStatus: true,
      },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Return status if not complete
    if (video.transcriptionStatus !== 'COMPLETE') {
      return NextResponse.json({
        status: video.transcriptionStatus || null,
        transcript: null,
      });
    }

    // Fetch VTT from R2
    const vttKey = `${video.ownerId}/${videoId}/transcription.vtt`;
    const exists = await fileExists(vttKey);

    if (!exists) {
      return NextResponse.json({
        status: 'FAILED',
        transcript: null,
        error: 'Transcript file not found',
      });
    }

    const vttUrl = await getPresignedDownloadUrl(vttKey, 3600);
    const vttResponse = await fetch(vttUrl);

    if (!vttResponse.ok) {
      return NextResponse.json({
        status: 'FAILED',
        transcript: null,
        error: 'Failed to fetch transcript file',
      });
    }

    const vttContent = await vttResponse.text();

    // Parse VTT into structured entries for the frontend
    const entries = parseWebVTT(vttContent);

    return NextResponse.json({
      status: 'COMPLETE',
      transcript: entries,
    });
  } catch (error) {
    console.error('[Transcript] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
