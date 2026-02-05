import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getVideoKey, uploadFile } from '@/lib/r2';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Create video record
    const video = await prisma.video.create({
      data: {
        ownerId: user.id,
        name: `Drime Recording - ${new Date().toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}`,
        public: true,
      },
    });

    // Upload to R2
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = getVideoKey(user.id, video.id);
    
    await uploadFile(key, buffer, 'video/webm');

    // Trigger transcription in the background
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      fetch(`${baseUrl}/api/videos/${video.id}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(err => console.error(`[WebRecording] Background transcription trigger failed:`, err));
    } catch (e) {
      console.error(`[WebRecording] Failed to trigger transcription:`, e);
    }

    return NextResponse.json({
      success: true,
      videoId: video.id,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/v/${video.id}`,
    });
  } catch (error) {
    console.error('Error uploading web recording:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
