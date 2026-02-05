// Video View Tracking API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const headersList = headers();
    const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0] || 
                      headersList.get('x-real-ip') || 
                      'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id: params.videoId },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Record the view
    await prisma.videoView.create({
      data: {
        videoId: params.videoId,
        ipAddress,
        userAgent,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Silently fail - view tracking shouldn't block the video
    console.error('Error recording view:', error);
    return NextResponse.json({ success: false });
  }
}
