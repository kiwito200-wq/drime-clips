import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/videos/[videoId]/comments - Get all comments for a video
export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;
    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type'); // 'text' or 'emoji' filter

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, public: true },
    });

    if (!video || !video.public) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const whereClause: any = {
      videoId,
      parentCommentId: null, // Only get top-level comments
    };

    if (type) {
      whereClause.type = type;
    }

    const comments = await prisma.videoComment.findMany({
      where: whereClause,
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        replies: {
          include: {
            author: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [
        { timestamp: 'asc' }, // Sort by timestamp first if it exists
        { createdAt: 'desc' }, // Then by creation time
      ],
    });

    // Separate text comments and emoji reactions
    const textComments = comments.filter(c => c.type === 'text');
    const reactions = comments.filter(c => c.type === 'emoji');

    // Group reactions by emoji
    const reactionCounts: Record<string, { count: number; users: string[] }> = {};
    reactions.forEach(r => {
      if (!reactionCounts[r.content]) {
        reactionCounts[r.content] = { count: 0, users: [] };
      }
      reactionCounts[r.content].count++;
      if (r.authorName || r.author?.name) {
        reactionCounts[r.content].users.push(r.authorName || r.author?.name || 'Anonymous');
      }
    });

    // Get view count
    const viewCount = await prisma.videoView.count({
      where: { videoId },
    });

    return NextResponse.json({
      comments: textComments.map(c => ({
        id: c.id,
        content: c.content,
        timestamp: c.timestamp,
        authorId: c.authorId,
        authorName: c.authorName || c.author?.name || c.author?.email?.split('@')[0] || 'Anonymous',
        authorAvatar: c.author?.avatarUrl,
        createdAt: c.createdAt,
        replies: c.replies.map(r => ({
          id: r.id,
          content: r.content,
          authorId: r.authorId,
          authorName: r.authorName || r.author?.name || r.author?.email?.split('@')[0] || 'Anonymous',
          authorAvatar: r.author?.avatarUrl,
          createdAt: r.createdAt,
        })),
      })),
      reactions: reactionCounts,
      totalComments: textComments.length,
      totalReactions: reactions.length,
      viewCount,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST /api/videos/[videoId]/comments - Add a new comment or reaction
export async function POST(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;
    const body = await request.json();
    const { 
      type = 'text', 
      content, 
      timestamp, 
      authorName, 
      authorEmail,
      parentCommentId,
    } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Validate type
    if (!['text', 'emoji'].includes(type)) {
      return NextResponse.json({ error: 'Invalid comment type' }, { status: 400 });
    }

    // Check video exists and is public
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, public: true, ownerId: true, settings: true },
    });

    if (!video || !video.public) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Check if comments are disabled
    const settings = video.settings as any;
    if (settings?.disableComments) {
      return NextResponse.json({ error: 'Comments are disabled for this video' }, { status: 403 });
    }

    // Validate parent comment if replying
    if (parentCommentId) {
      const parentComment = await prisma.videoComment.findUnique({
        where: { id: parentCommentId, videoId },
      });
      if (!parentComment) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
      }
    }

    // Create comment (anonymous - no auth required)
    const comment = await prisma.videoComment.create({
      data: {
        videoId,
        type,
        content,
        timestamp: timestamp ? parseFloat(timestamp) : null,
        authorName: authorName || 'Anonymous',
        authorEmail,
        parentCommentId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({
      comment: {
        id: comment.id,
        type: comment.type,
        content: comment.content,
        timestamp: comment.timestamp,
        authorId: comment.authorId,
        authorName: comment.authorName || comment.author?.name || 'Anonymous',
        authorAvatar: comment.author?.avatarUrl,
        createdAt: comment.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}

// DELETE /api/videos/[videoId]/comments - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const { videoId } = params;
    const { searchParams } = request.nextUrl;
    const commentId = searchParams.get('commentId');

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
    }

    // Find the comment
    const comment = await prisma.videoComment.findUnique({
      where: { id: commentId, videoId },
      include: {
        video: { select: { ownerId: true } },
      },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Delete the comment (and cascade to replies)
    await prisma.videoComment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
