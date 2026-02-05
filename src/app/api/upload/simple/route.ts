// Simple Upload API - Works for both desktop app (email) and browser (session)
// The desktop app knows the user's email (they're logged into Drime)
// The browser uses session cookies from Drime login

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import { getCurrentUser } from '@/lib/auth';
import { 
  initiateMultipartUpload, 
  getPresignedPartUrl, 
  completeMultipartUpload,
  getVideoKey,
  uploadFile,
  getThumbnailKey
} from '@/lib/r2';

// POST /api/upload/simple - Handle all upload operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, action, videoId, uploadId, userId, partNumber, parts } = body;

    console.log('[SimpleUpload] Request:', { action, email, videoId, partNumber, userId });

    // Try to get user from session first (browser recording)
    // or from email (desktop app)
    let user = await getCurrentUser().catch(() => null);
    
    if (!user && email) {
      // Desktop app path - find/create user by email
      user = await prisma.user.findUnique({
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
    }
    
    // For presign and complete actions, we can use userId from request body
    // (the client already has this from the create response)
    if (!user && userId && (action === 'presign' || action === 'complete')) {
      user = await prisma.user.findUnique({
        where: { id: userId },
      });
    }

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated. Please log in.' }, { status: 401 });
    }

    // Handle different actions
    if (action === 'create' || !action) {
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

      // Initiate multipart upload in R2 (use webm for live recordings)
      const key = getVideoKey(user.id, video.id, 'result.webm');
      const r2UploadId = await initiateMultipartUpload(key, 'video/webm');

      console.log(`[SimpleUpload] Created video ${video.id} for ${email}, uploadId: ${r2UploadId}`);

      return NextResponse.json({
        success: true,
        videoId: video.id,
        uploadId: r2UploadId,
        userId: user.id,
        shareUrl: `https://clips.drime.cloud/v/${video.id}`,
      });
    }

    if (action === 'presign' && videoId && uploadId && partNumber) {
      // Get video to find owner
      const video = await prisma.video.findUnique({
        where: { id: videoId },
        select: { ownerId: true },
      });

      if (!video) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 });
      }

      // Get presigned URL for part upload
      const key = getVideoKey(video.ownerId, videoId, 'result.webm');
      const presignedUrl = await getPresignedPartUrl(key, uploadId, partNumber);

      console.log(`[SimpleUpload] Presigned URL for part ${partNumber} of video ${videoId}`);

      return NextResponse.json({
        success: true,
        presignedUrl,
      });
    }

    if (action === 'complete' && videoId && uploadId && parts) {
      console.log(`[SimpleUpload] Completing multipart upload for video ${videoId}`);
      console.log(`[SimpleUpload] Upload ID: ${uploadId}`);
      console.log(`[SimpleUpload] Parts:`, JSON.stringify(parts));
      
      // Get metadata from request body
      const { duration, width, height, fps, thumbnail } = body;
      
      // Get video to find owner
      const video = await prisma.video.findUnique({
        where: { id: videoId },
        select: { ownerId: true },
      });

      if (!video) {
        console.error(`[SimpleUpload] Video ${videoId} not found for complete`);
        return NextResponse.json({ error: 'Video not found' }, { status: 404 });
      }

      console.log(`[SimpleUpload] Video owner: ${video.ownerId}`);

      // Complete multipart upload
      const key = getVideoKey(video.ownerId, videoId, 'result.webm');
      console.log(`[SimpleUpload] R2 key: ${key}`);
      
      try {
        await completeMultipartUpload(key, uploadId, parts);
        console.log(`[SimpleUpload] R2 multipart complete SUCCESS for key: ${key}`);
      } catch (r2Error) {
        console.error(`[SimpleUpload] R2 multipart complete FAILED:`, r2Error);
        throw r2Error;
      }

      // Upload thumbnail if provided (base64 data URL)
      if (thumbnail && thumbnail.startsWith('data:image/')) {
        try {
          // Extract base64 data from data URL
          const base64Data = thumbnail.split(',')[1];
          const thumbnailBuffer = Buffer.from(base64Data, 'base64');
          const thumbnailKey = getThumbnailKey(video.ownerId, videoId);
          
          await uploadFile(thumbnailKey, thumbnailBuffer, 'image/jpeg');
          console.log(`[SimpleUpload] Thumbnail uploaded: ${thumbnailKey}`);
        } catch (thumbError) {
          console.error(`[SimpleUpload] Thumbnail upload failed:`, thumbError);
          // Don't fail the whole upload if thumbnail fails
        }
      }

      // Remove upload tracking (video is now ready)
      const deleteResult = await prisma.videoUpload.deleteMany({
        where: { videoId },
      });
      console.log(`[SimpleUpload] Deleted ${deleteResult.count} VideoUpload records`);

      // Update video with metadata
      const updateData: any = {
        updatedAt: new Date(),
      };
      if (duration !== undefined) updateData.duration = parseFloat(duration);
      if (width !== undefined) updateData.width = parseInt(width, 10);
      if (height !== undefined) updateData.height = parseInt(height, 10);
      if (fps !== undefined) updateData.fps = parseInt(fps, 10);

      await prisma.video.update({
        where: { id: videoId },
        data: updateData,
      });
      
      console.log(`[SimpleUpload] Updated video metadata:`, updateData);

      const shareUrl = `https://clips.drime.cloud/v/${videoId}`;

      console.log(`[SimpleUpload] Completed upload for video ${videoId} - SUCCESS`);

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
