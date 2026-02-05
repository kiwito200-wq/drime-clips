// POST /api/videos/[videoId]/transcribe
// Local transcription: FFmpeg + Whisper — no external API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVideoKey, getPresignedDownloadUrl, uploadFile, fileExists } from '@/lib/r2';
import { transcribeVideo, checkFFmpeg } from '@/lib/transcribe';

export const maxDuration = 300; // 5 minutes (for Vercel Pro / self-hosted)

export async function POST(
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
        transcriptionStatus: true,
        duration: true,
      },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Skip if already processing or complete
    if (video.transcriptionStatus === 'PROCESSING') {
      return NextResponse.json({
        success: true,
        message: 'Transcription already in progress',
        status: 'PROCESSING',
      });
    }
    if (video.transcriptionStatus === 'COMPLETE') {
      return NextResponse.json({
        success: true,
        message: 'Transcription already complete',
        status: 'COMPLETE',
      });
    }

    // Check FFmpeg is available
    const hasFFmpeg = await checkFFmpeg();
    if (!hasFFmpeg) {
      return NextResponse.json(
        {
          error: 'FFmpeg non trouvé. Installez FFmpeg sur votre machine.',
          details: 'https://ffmpeg.org/download.html',
        },
        { status: 503 }
      );
    }

    // Mark as processing
    await prisma.video.update({
      where: { id: videoId },
      data: { transcriptionStatus: 'PROCESSING' },
    });

    // Find the video file on R2 (try .webm first, then .mp4)
    let videoKey = getVideoKey(video.ownerId, videoId, 'result.webm');
    let exists = await fileExists(videoKey);

    if (!exists) {
      videoKey = getVideoKey(video.ownerId, videoId, 'result.mp4');
      exists = await fileExists(videoKey);
    }

    if (!exists) {
      await prisma.video.update({
        where: { id: videoId },
        data: { transcriptionStatus: 'FAILED' },
      });
      return NextResponse.json({ error: 'Video file not found on storage' }, { status: 404 });
    }

    // Download the video
    const videoUrl = await getPresignedDownloadUrl(videoKey, 3600);
    console.log(`[Transcribe] Downloading video ${videoId}…`);
    const videoResponse = await fetch(videoUrl);

    if (!videoResponse.ok) {
      await prisma.video.update({
        where: { id: videoId },
        data: { transcriptionStatus: 'FAILED' },
      });
      return NextResponse.json({ error: 'Failed to download video' }, { status: 500 });
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    console.log(`[Transcribe] Downloaded: ${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB`);

    // Run local transcription (FFmpeg → Whisper)
    let vttContent: string;
    try {
      vttContent = await transcribeVideo(videoBuffer);
    } catch (err) {
      console.error(`[Transcribe] Error for ${videoId}:`, err);
      await prisma.video.update({
        where: { id: videoId },
        data: { transcriptionStatus: 'FAILED' },
      });
      return NextResponse.json(
        { error: 'Transcription failed', details: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }

    // Check if any speech was detected
    const hasContent = vttContent.trim().split('\n').length > 2;

    if (!hasContent) {
      await prisma.video.update({
        where: { id: videoId },
        data: { transcriptionStatus: 'NO_AUDIO' },
      });
      return NextResponse.json({ success: true, message: 'No speech detected', status: 'NO_AUDIO' });
    }

    // Store VTT on R2
    const vttKey = `${video.ownerId}/${videoId}/transcription.vtt`;
    await uploadFile(vttKey, vttContent, 'text/vtt');
    console.log(`[Transcribe] VTT stored → ${vttKey}`);

    // Mark complete
    await prisma.video.update({
      where: { id: videoId },
      data: { transcriptionStatus: 'COMPLETE' },
    });

    console.log(`[Transcribe] ✓ Done for ${videoId}`);

    return NextResponse.json({ success: true, message: 'Transcription complete', status: 'COMPLETE' });
  } catch (error) {
    console.error('[Transcribe] Unexpected error:', error);
    try {
      await prisma.video.update({
        where: { id: params.videoId },
        data: { transcriptionStatus: 'FAILED' },
      });
    } catch {}
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
