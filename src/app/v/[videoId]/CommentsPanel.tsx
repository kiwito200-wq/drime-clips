'use client';

import { useState, useEffect, useRef } from 'react';

interface Comment {
  id: string;
  content: string;
  timestamp: number | null;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  createdAt: string;
  replies?: Comment[];
}

interface ReactionCounts {
  [emoji: string]: {
    count: number;
    users: string[];
  };
}

interface CommentsPanelProps {
  videoId: string;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

const REACTIONS = ['😂', '😍', '🤔', '👏', '👍'];

export default function CommentsPanel({ videoId, currentTime, duration, onSeek }: CommentsPanelProps) {
  const [activeTab, setActiveTab] = useState<'comments' | 'summary' | 'transcript'>('comments');
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<ReactionCounts>({});
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await fetch(`/api/videos/${videoId}/comments`);
        const data = await response.json();
        // Ensure replies is always an array
        const commentsWithReplies = (data.comments || []).map((c: Comment) => ({
          ...c,
          replies: c.replies || [],
        }));
        setComments(commentsWithReplies);
        setReactions(data.reactions || {});
      } catch (error) {
        console.error('Failed to fetch comments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [videoId]);

  // Submit comment (timestamp always included)
  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`/api/videos/${videoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          content: newComment,
          timestamp: currentTime, // Always include timestamp
          parentCommentId: replyingTo,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newCommentData = { ...data.comment, replies: data.comment.replies || [] };

        if (replyingTo) {
          setComments(prev => prev.map(c =>
            c.id === replyingTo
              ? { ...c, replies: [...(c.replies || []), newCommentData] }
              : c
          ));
        } else {
          setComments(prev => [newCommentData, ...prev]);
        }

        setNewComment('');
        setReplyingTo(null);
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
    }
  };

  // Submit reaction
  const handleReaction = async (emoji: string) => {
    try {
      await fetch(`/api/videos/${videoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'emoji',
          content: emoji,
          timestamp: currentTime,
        }),
      });

      setReactions(prev => ({
        ...prev,
        [emoji]: {
          count: (prev[emoji]?.count || 0) + 1,
          users: [...(prev[emoji]?.users || []), 'You'],
        },
      }));
    } catch (error) {
      console.error('Failed to post reaction:', error);
    }
  };

  // Format timestamp
  const formatTimestamp = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Count all comments including replies
  const totalComments = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);
  const totalReactions = Object.values(reactions).reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="w-[340px] bg-white rounded-2xl border border-gray-200 flex flex-col h-full shadow-sm">
      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {['Comments', 'Summary', 'Transcript'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab.toLowerCase() as any)}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
              activeTab === tab.toLowerCase()
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Comments Tab */}
      {activeTab === 'comments' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Stats bar */}
          <div className="px-4 py-2.5 border-b border-gray-100 text-sm text-gray-500 flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              0
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {totalComments}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {totalReactions}
            </span>
            <a href="#" className="ml-auto text-blue-500 hover:underline text-xs font-medium">View analytics</a>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-12 px-6">
                <p className="font-semibold text-gray-900">No comments yet</p>
                <p className="text-sm text-gray-500 mt-1">Be the first to share your thoughts!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {comments.map((comment) => (
                  <div key={comment.id} className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
                    {/* Main comment */}
                    <div className="flex gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0 overflow-hidden">
                        {comment.authorAvatar ? (
                          <img src={comment.authorAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          comment.authorName?.slice(0, 2).toUpperCase() || 'AN'
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{comment.authorName || 'Anonymous'}</span>
                          <span className="text-xs text-gray-400">{formatRelativeTime(comment.createdAt)}</span>
                          {comment.timestamp !== null && (
                            <button
                              onClick={() => onSeek(comment.timestamp!)}
                              className="text-xs text-blue-500 hover:text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded"
                            >
                              {formatTimestamp(comment.timestamp)}
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mt-1 leading-relaxed">{comment.content}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <button
                            onClick={() => {
                              setReplyingTo(comment.id);
                              inputRef.current?.focus();
                            }}
                            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          </button>
                          <button className="text-xs text-gray-400 hover:text-red-500">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="ml-12 mt-3 space-y-3 border-l-2 border-gray-100 pl-3">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="flex gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                              {reply.authorName?.slice(0, 2).toUpperCase() || 'AN'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 text-sm">{reply.authorName || 'Anonymous'}</span>
                                <span className="text-xs text-gray-400">{formatRelativeTime(reply.createdAt)}</span>
                                {reply.timestamp !== null && (
                                  <button
                                    onClick={() => onSeek(reply.timestamp!)}
                                    className="text-xs text-blue-500 font-medium"
                                  >
                                    {formatTimestamp(reply.timestamp)}
                                  </button>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 mt-0.5">{reply.content}</p>
                              <div className="flex items-center gap-4 mt-1.5">
                                <button className="text-xs text-gray-400 hover:text-gray-600">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                  </svg>
                                </button>
                                <button className="text-xs text-gray-400 hover:text-red-500">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reactions bar - Like Cap.so style */}
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex items-center justify-center gap-1 bg-gray-50 rounded-full py-2 px-3">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="relative p-2 hover:bg-white rounded-full transition-all hover:scale-110 active:scale-95"
                >
                  <span className="text-2xl">{emoji}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Comment input - Like Cap.so */}
          <div className="px-4 pb-4">
            {replyingTo && (
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2 bg-blue-50 px-2 py-1 rounded">
                <span>Replying to comment...</span>
                <button onClick={() => setReplyingTo(null)} className="text-red-500 hover:underline font-medium">Cancel</button>
              </div>
            )}

            <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:border-gray-300 focus-within:ring-1 focus-within:ring-gray-200 transition-all">
              <textarea
                ref={inputRef}
                placeholder="Leave a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitComment();
                  }
                }}
                className="w-full px-3 py-2.5 text-sm resize-none focus:outline-none placeholder-gray-400"
                rows={2}
              />
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{formatTimestamp(currentTime)}</span>
                </div>
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim()}
                  className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                >
                  Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900">No summary available</p>
            <p className="text-sm text-gray-500 mt-1">AI summary will appear here when generated.</p>
          </div>
        </div>
      )}

      {/* Transcript Tab */}
      {activeTab === 'transcript' && (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900">No transcript available</p>
            <p className="text-sm text-gray-500 mt-1">Transcript will appear here when processed.</p>
          </div>
        </div>
      )}
    </div>
  );
}
