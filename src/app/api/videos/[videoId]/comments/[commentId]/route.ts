import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Props {
  params: { videoId: string; commentId: string };
}

// DELETE /api/videos/[videoId]/comments/[commentId] - Delete a comment
export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { searchParams } = request.nextUrl;
    const visitorId = searchParams.get('visitorId');

    // Find the comment
    const comment = await prisma.videoComment.findUnique({
      where: { id: params.commentId },
      include: { video: true },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Check permission: visitorId match OR authenticated user who is author/owner
    let authorized = false;

    // Check anonymous visitor ownership
    if (visitorId && comment.visitorId && comment.visitorId === visitorId) {
      authorized = true;
    }

    // Check authenticated user ownership
    if (!authorized) {
      try {
        const { getCurrentUser } = await import('@/lib/auth');
        const user = await getCurrentUser();
        if (user) {
          const isAuthor = comment.authorId === user.id;
          const isVideoOwner = comment.video.ownerId === user.id;
          if (isAuthor || isVideoOwner) {
            authorized = true;
          }
        }
      } catch {
        // Not logged in, ignore
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete the comment (and its replies due to cascade)
    await prisma.videoComment.delete({
      where: { id: params.commentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/videos/[videoId]/comments/[commentId] - Edit a comment
export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const body = await request.json();
    const { content, visitorId } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Find the comment
    const comment = await prisma.videoComment.findUnique({
      where: { id: params.commentId, videoId: params.videoId },
      include: { video: true },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only text comments can be edited
    if (comment.type !== 'text') {
      return NextResponse.json({ error: 'Only text comments can be edited' }, { status: 400 });
    }

    // Check permission
    let authorized = false;

    if (visitorId && comment.visitorId && comment.visitorId === visitorId) {
      authorized = true;
    }

    if (!authorized) {
      try {
        const { getCurrentUser } = await import('@/lib/auth');
        const user = await getCurrentUser();
        if (user && comment.authorId === user.id) {
          authorized = true;
        }
      } catch {
        // Not logged in
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updated = await prisma.videoComment.update({
      where: { id: params.commentId },
      data: { content: content.trim() },
    });

    return NextResponse.json({
      comment: {
        id: updated.id,
        content: updated.content,
      },
    });
  } catch (error) {
    console.error('Error editing comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
