import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

interface Props {
  params: { videoId: string; commentId: string };
}

// DELETE /api/videos/[videoId]/comments/[commentId] - Delete a comment
export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const user = await getCurrentUser();
    
    // Find the comment
    const comment = await prisma.videoComment.findUnique({
      where: { id: params.commentId },
      include: { video: true },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Check permission: user must be comment author or video owner
    const isAuthor = user && comment.authorId === user.id;
    const isVideoOwner = user && comment.video.ownerId === user.id;

    if (!isAuthor && !isVideoOwner) {
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
