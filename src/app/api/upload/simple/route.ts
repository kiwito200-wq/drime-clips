// Simple Upload API - No complex auth needed
// The desktop app knows the user's email (they're logged into Drime)
// We just need to associate the video with that email

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import { initiateMultipartUpload, getPresignedPartUrl, completeMultipartUpload } from '@/lib/r2';

// POST /api/upload/simple - Create video entry for upload
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, action, videoId, uploadId, partNumber, parts } = body;

    // Validate email is provided
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Find or create user by email
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Create user if they don't exist (they're authenticated via Drime desktop app)
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: email.split('@')[0], // Use email prefix as name
        },
      });
      console.log(`[SimpleUpload] Created user for email: ${email}`);
    }

    // Handle different actions
    if (action === 'create') {
      // Create video entry
      const date = new Date();
      const formattedDate = `${date.getDate()} ${date.toLocaleString('fr-FR', { month: 'long' })} ${date.getFullYear()}`;
      const videoName = name ?? `Drime Recording - ${formattedDate}`;
      const newVideoId = nanoid(12);

      const video = await prisma.video.create({
        data: {
          id: newVideoId,
          name: videoName,
          ownerId: user.id,
          source: { type: 'desktopMP4' },
          public: true,
        },
      });

      // Create upload tracking
      await prisma.videoUpload.create({
        data: {
          videoId: video.id,
          mode: 'multipart',
        },
      });

      // Initiate multipart upload in R2
      const key = `${user.id}/${video.id}/result.mp4`;
      const r2UploadId = await initiateMultipartUpload(key, 'video/mp4');

      console.log(`[SimpleUpload] Created video ${video.id} for ${email}`);

      return NextResponse.json({
        success: true,
        videoId: video.id,
        uploadId: r2UploadId,
        userId: user.id,
        shareUrl: `https://clips.drime.cloud/v/${video.id}`,
      });
    }

    if (action === 'presign' && videoId && uploadId && partNumber) {
      // Get presigned URL for part upload
      const key = `${user.id}/${videoId}/result.mp4`;
      const presignedUrl = await getPresignedPartUrl(key, uploadId, partNumber);

      return NextResponse.json({
        success: true,
        presignedUrl,
      });
    }

    if (action === 'complete' && videoId && uploadId && parts) {
      // Complete multipart upload
      const key = `${user.id}/${videoId}/result.mp4`;
      await completeMultipartUpload(key, uploadId, parts);

      // Update video as uploaded
      await prisma.videoUpload.deleteMany({
        where: { videoId },
      });

      // Update video with upload completion
      await prisma.video.update({
        where: { id: videoId },
        data: {
          updatedAt: new Date(),
        },
      });

      const shareUrl = `https://clips.drime.cloud/v/${videoId}`;

      console.log(`[SimpleUpload] Completed upload for video ${videoId}`);

      return NextResponse.json({
        success: true,
        shareUrl,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[SimpleUpload] Error:', error);
    return NextResponse.json({ 
      error: 'Upload failed', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
