// Desktop App Video API
// Create, delete, and track progress of videos

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserAny } from '@/lib/auth';
import { nanoid } from 'nanoid';
import { deleteFiles, listFiles, getVideoKey } from '@/lib/r2';

// GET /api/desktop/video/create - Create a new video
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserAny(request);
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recordingMode = searchParams.get('recordingMode') as 'hls' | 'desktopMP4' | null;
    const isScreenshot = searchParams.get('isScreenshot') === 'true';
    const existingVideoId = searchParams.get('videoId');
    const name = searchParams.get('name');
    const durationInSecs = searchParams.get('durationInSecs') ? parseFloat(searchParams.get('durationInSecs')!) : undefined;
    const width = searchParams.get('width') ? parseInt(searchParams.get('width')!) : undefined;
    const height = searchParams.get('height') ? parseInt(searchParams.get('height')!) : undefined;
    const fps = searchParams.get('fps') ? parseInt(searchParams.get('fps')!) : undefined;

    // Check if video already exists
    if (existingVideoId) {
      const existingVideo = await prisma.video.findUnique({
        where: { id: existingVideoId },
      });
      
      if (existingVideo) {
        return NextResponse.json({
          id: existingVideo.id,
          user_id: user.id,
        });
      }
    }

    // Generate video name
    const date = new Date();
    const formattedDate = `${date.getDate()} ${date.toLocaleString('fr-FR', { month: 'long' })} ${date.getFullYear()}`;
    const videoName = name ?? `Drime ${isScreenshot ? 'Capture' : 'Recording'} - ${formattedDate}`;

    // Create video ID
    const videoId = nanoid(12);

    // Determine source type
    let source: { type: string } | undefined;
    if (recordingMode === 'hls') {
      source = { type: 'local' };
    } else if (recordingMode === 'desktopMP4') {
      source = { type: 'desktopMP4' };
    }

    // Create video in database
    const video = await prisma.video.create({
      data: {
        id: videoId,
        name: videoName,
        ownerId: user.id,
        source: source,
        isScreenshot,
        public: true, // Default to public
        duration: durationInSecs,
        width,
        height,
        fps,
      },
    });

    // Create upload tracking record
    await prisma.videoUpload.create({
      data: {
        videoId: video.id,
      },
    });

    console.log(`[Video Create] Created video ${video.id} for user ${user.id}`);

    return NextResponse.json({
      id: video.id,
      user_id: user.id,
    });
  } catch (error) {
    console.error('Error creating video:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/desktop/video/delete - Delete a video
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUserAny(request);
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json({ error: 'videoId required' }, { status: 400 });
    }

    // Check if video exists and belongs to user
    const video = await prisma.video.findFirst({
      where: {
        id: videoId,
        ownerId: user.id,
      },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Delete upload tracking
    await prisma.videoUpload.deleteMany({
      where: { videoId },
    });

    // Delete video views
    await prisma.videoView.deleteMany({
      where: { videoId },
    });

    // Delete video from database
    await prisma.video.delete({
      where: { id: videoId },
    });

    // Delete files from R2
    try {
      const prefix = `${user.id}/${videoId}/`;
      const files = await listFiles(prefix);
      if (files.length > 0) {
        await deleteFiles(files);
      }
    } catch (error) {
      console.error('Error deleting files from R2:', error);
      // Continue even if R2 deletion fails
    }

    console.log(`[Video Delete] Deleted video ${videoId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting video:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/desktop/video/progress - Update upload progress
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserAny(request);
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { videoId, uploaded, total, updatedAt: updatedAtStr } = body;

    if (!videoId || uploaded === undefined || total === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const updatedAt = updatedAtStr ? new Date(updatedAtStr) : new Date();

    // Check if video exists and belongs to user
    const video = await prisma.video.findFirst({
      where: {
        id: videoId,
        ownerId: user.id,
      },
      include: {
        upload: true,
      },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Prevent maths breaking
    const uploadedClamped = Math.min(uploaded, total);

    if (video.upload) {
      // Upload complete for singlepart - delete tracking
      if (uploadedClamped === total && video.upload.mode === 'singlepart') {
        await prisma.videoUpload.delete({
          where: { videoId },
        });
      } else {
        // Update progress (only if newer)
        const existingUpdatedAt = video.upload.updatedAt;
        if (!existingUpdatedAt || updatedAt >= existingUpdatedAt) {
          await prisma.videoUpload.update({
            where: { videoId },
            data: {
              uploaded: uploadedClamped,
              total,
              updatedAt,
            },
          });
        }
      }
    } else {
      // Create new upload tracking
      await prisma.videoUpload.create({
        data: {
          videoId,
          uploaded: uploadedClamped,
          total,
          updatedAt,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating upload progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
