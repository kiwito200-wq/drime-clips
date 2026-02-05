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
  replies: Comment[];
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
  onSeek: (time: number) => void;
}

const REACTIONS = ['😂', '😍', '😮', '👏', '👍', '👎'];

export default function CommentsPanel({ videoId, currentTime, onSeek }: CommentsPanelProps) {
  const [activeTab, setActiveTab] = useState<'comments' | 'summary' | 'transcript'>('comments');
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<ReactionCounts>({});
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await fetch(`/api/videos/${videoId}/comments`);
        const data = await response.json();
        setComments(data.comments || []);
        setReactions(data.reactions || {});
      } catch (error) {
        console.error('Failed to fetch comments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [videoId]);

  // Submit comment
  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    const name = authorName.trim() || 'Anonymous';
    
    try {
      const response = await fetch(`/api/videos/${videoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          content: newComment,
          timestamp: includeTimestamp ? currentTime : null,
          authorName: name,
          parentCommentId: replyingTo,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (replyingTo) {
          // Add reply to parent comment
          setComments(prev => prev.map(c => 
            c.id === replyingTo 
              ? { ...c, replies: [...c.replies, data.comment] }
              : c
          ));
        } else {
          // Add new comment
          setComments(prev => [data.comment, ...prev]);
        }
        
        setNewComment('');
        setReplyingTo(null);
        
        // Save author name for next comment
        if (name !== 'Anonymous') {
          localStorage.setItem('drime-clips-author-name', name);
        }
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
          authorName: authorName || 'Anonymous',
        }),
      });

      // Update local state
      setReactions(prev => ({
        ...prev,
        [emoji]: {
          count: (prev[emoji]?.count || 0) + 1,
          users: [...(prev[emoji]?.users || []), authorName || 'Anonymous'],
        },
      }));
    } catch (error) {
      console.error('Failed to post reaction:', error);
    }
  };

  // Load saved author name
  useEffect(() => {
    const savedName = localStorage.getItem('drime-clips-author-name');
    if (savedName) setAuthorName(savedName);
  }, []);

  // Format timestamp
  const formatTimestamp = (seconds: number) => {
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
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  return (
    <div className="w-80 bg-white rounded-xl border border-gray-200 flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {['comments', 'summary', 'transcript'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-gray-900 border-b-2 border-[#08CF65]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Comments Tab */}
      {activeTab === 'comments' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Stats */}
          <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-500 flex items-center gap-4">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {comments.length}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {Object.values(reactions).reduce((sum, r) => sum + r.count, 0)}
            </span>
            <a href="#" className="ml-auto text-[#08CF65] hover:underline text-xs">View analytics</a>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="font-medium">No comments yet</p>
                <p className="text-sm mt-1">Be the first to share your thoughts!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="space-y-2">
                  {/* Main comment */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                      {comment.authorAvatar ? (
                        <img src={comment.authorAvatar} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        comment.authorName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{comment.authorName}</span>
                        {comment.timestamp !== null && (
                          <button
                            onClick={() => onSeek(comment.timestamp!)}
                            className="text-xs text-[#08CF65] hover:underline font-medium"
                          >
                            {formatTimestamp(comment.timestamp)}
                          </button>
                        )}
                        <span className="text-xs text-gray-400">{formatRelativeTime(comment.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1 break-words">{comment.content}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => {
                            setReplyingTo(comment.id);
                            inputRef.current?.focus();
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Replies */}
                  {comment.replies.length > 0 && (
                    <div className="ml-11 space-y-2">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                            {reply.authorName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 text-sm">{reply.authorName}</span>
                              <span className="text-xs text-gray-400">{formatRelativeTime(reply.createdAt)}</span>
                            </div>
                            <p className="text-sm text-gray-700 mt-0.5 break-words">{reply.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Reactions bar */}
          <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-center gap-2">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="relative p-2 hover:bg-gray-100 rounded-full transition-colors group"
                title={reactions[emoji] ? `${reactions[emoji].count} reactions` : 'Add reaction'}
              >
                <span className="text-xl">{emoji}</span>
                {reactions[emoji]?.count > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#08CF65] text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                    {reactions[emoji].count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Comment input */}
          <div className="p-4 border-t border-gray-200">
            {replyingTo && (
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span>Replying to comment...</span>
                <button onClick={() => setReplyingTo(null)} className="text-red-500 hover:underline">Cancel</button>
              </div>
            )}
            
            {/* Author name input */}
            <input
              type="text"
              placeholder="Your name (optional)"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-[#08CF65]/20 focus:border-[#08CF65]"
            />

            {/* Comment input */}
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
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#08CF65]/20 focus:border-[#08CF65]"
              rows={2}
            />

            {/* Options and submit */}
            <div className="flex items-center justify-between mt-2">
              <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTimestamp}
                  onChange={(e) => setIncludeTimestamp(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#08CF65] focus:ring-[#08CF65]"
                />
                Include timestamp ({formatTimestamp(currentTime)})
              </label>
              <button
                onClick={handleSubmitComment}
                disabled={!newComment.trim()}
                className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
              >
                Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-medium">No summary available</p>
            <p className="text-sm mt-1">AI summary will appear here when generated.</p>
          </div>
        </div>
      )}

      {/* Transcript Tab */}
      {activeTab === 'transcript' && (
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <p className="font-medium">No transcript available</p>
            <p className="text-sm mt-1">Transcript will appear here when processed.</p>
          </div>
        </div>
      )}
    </div>
  );
}
