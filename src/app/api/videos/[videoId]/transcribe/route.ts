// POST /api/videos/[videoId]/transcribe
// Triggers transcription via Cloudflare Worker (Workers AI Whisper)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVideoKey, fileExists, uploadFile } from '@/lib/r2';
import { transcribeViaWorker, isTranscriptionConfigured } from '@/lib/transcribe';

export const maxDuration = 300; // 5 minutes (Vercel Pro)

export async function POST(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;

    // Check transcription is configured
    if (!isTranscriptionConfigured()) {
      return NextResponse.json(
        { error: 'Transcription not configured. Set TRANSCRIBE_WORKER_URL and TRANSCRIBE_WORKER_SECRET.' },
        { status: 503 }
      );
    }

    // Find the video
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        ownerId: true,
        transcriptionStatus: true,
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

    // Call the Cloudflare Worker (which reads from R2 directly and runs Whisper)
    let vttContent: string;
    try {
      console.log(`[Transcribe] Triggering CF Worker for ${videoId} (key: ${videoKey})`);
      vttContent = await transcribeViaWorker(videoKey);
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
