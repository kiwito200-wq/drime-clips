'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

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

interface CommentsPanelProps {
  videoId: string;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  refreshTrigger?: number;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Populaires',
    emojis: ['😀', '😂', '🤣', '😍', '🥰', '😎', '🤩', '🥳', '👍', '👏', '🔥', '💯', '❤️', '💪', '🎉', '✨'],
  },
  {
    name: 'Visages',
    emojis: ['😊', '😄', '😁', '😆', '😅', '🤗', '🤔', '🤭', '😏', '😮', '😱', '😴', '🤯', '🥱', '😤', '😢'],
  },
  {
    name: 'Gestes',
    emojis: ['👋', '🤝', '✌️', '🤟', '🤙', '👌', '🙏', '💅', '👀', '🫡', '🫶', '🤌', '👎', '✊', '🤞', '🫰'],
  },
  {
    name: 'Objets',
    emojis: ['🎬', '📹', '🎮', '🎧', '💻', '📱', '🎯', '🏆', '⭐', '🌟', '💡', '🚀', '🎵', '🎶', '📸', '🖥️'],
  },
];

// Floating emoji picker rendered via portal
function FloatingEmojiPicker({
  anchorRef,
  onSelect,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement>;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const newPos = {
      top: Math.max(8, rect.top - 220),
      left: Math.max(8, Math.min(rect.left - 120, window.innerWidth - 296)),
    };
    setPos(newPos);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
  }, [anchorRef]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, anchorRef]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={pickerRef}
      className={`fixed bg-white rounded-xl border border-gray-200 shadow-xl z-[9999] w-[288px] transition-all duration-150 ease-out ${
        visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.97] translate-y-1'
      }`}
      style={{ top: pos.top, left: pos.left, transformOrigin: 'bottom center' }}
    >
      <div className="flex border-b border-gray-100 px-2 pt-2">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            onClick={() => setCategory(i)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${
              category === i ? 'text-gray-900 bg-gray-100' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {cat.emojis[0]}
          </button>
        ))}
      </div>
      <div className="p-2 max-h-[160px] overflow-y-auto">
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_CATEGORIES[category].emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSelect(emoji)}
              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded-lg transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function CommentsPanel({ videoId, currentTime, duration, onSeek, refreshTrigger = 0 }: CommentsPanelProps) {
  const [activeTab, setActiveTab] = useState<'comments' | 'summary' | 'transcript'>('comments');
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState(false);
  const mainInputRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const replyEmojiButtonRef = useRef<HTMLButtonElement>(null);

  // Stats
  const [viewCount, setViewCount] = useState(0);
  const [totalReactions, setTotalReactions] = useState(0);

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/videos/${videoId}/comments`);
      const data = await response.json();
      const commentsWithReplies = (data.comments || []).map((c: Comment) => ({
        ...c,
        replies: c.replies || [],
      }));
      setComments(commentsWithReplies);
      setViewCount(data.viewCount || 0);
      setTotalReactions(data.totalReactions || 0);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [videoId]);

  // Re-fetch when refreshTrigger changes (reaction added from toolbar)
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchComments();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    if (replyingTo && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [replyingTo]);

  const insertEmoji = (emoji: string, isReply: boolean) => {
    if (isReply) {
      setReplyContent(prev => prev + emoji);
      replyInputRef.current?.focus();
    } else {
      setNewComment(prev => prev + emoji);
      mainInputRef.current?.focus();
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    try {
      const response = await fetch(`/api/videos/${videoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', content: newComment, timestamp: currentTime }),
      });
      if (response.ok) {
        const data = await response.json();
        setComments(prev => [{ ...data.comment, replies: [] }, ...prev]);
        setNewComment('');
        setShowEmojiPicker(false);
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim()) return;
    try {
      const response = await fetch(`/api/videos/${videoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', content: replyContent, timestamp: currentTime, parentCommentId: parentId }),
      });
      if (response.ok) {
        const data = await response.json();
        setComments(prev => prev.map(c =>
          c.id === parentId ? { ...c, replies: [...(c.replies || []), { ...data.comment, replies: [] }] } : c
        ));
        setReplyContent('');
        setReplyingTo(null);
        setShowReplyEmojiPicker(false);
      }
    } catch (error) {
      console.error('Failed to post reply:', error);
    }
  };

  const handleDeleteComment = async (commentId: string, parentId?: string) => {
    setDeleting(commentId);
    try {
      const response = await fetch(`/api/videos/${videoId}/comments/${commentId}`, { method: 'DELETE' });
      if (response.ok) {
        if (parentId) {
          setComments(prev => prev.map(c => c.id === parentId ? { ...c, replies: (c.replies || []).filter(r => r.id !== commentId) } : c));
        } else {
          setComments(prev => prev.filter(c => c.id !== commentId));
        }
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
    } finally {
      setDeleting(null);
    }
  };

  const formatTimestamp = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 1) return 'à l\'instant';
    if (mins < 60) return `il y a ${mins}min`;
    if (hours < 24) return `il y a ${hours}h`;
    return `il y a ${days}j`;
  };

  const totalComments = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);

  const renderComment = (comment: Comment, isReply = false, parentId?: string) => (
    <div key={comment.id} className={`flex gap-3 ${isReply ? '' : 'px-4 py-3'}`}>
      <div className={`${isReply ? 'w-7 h-7' : 'w-9 h-9'} rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0 overflow-hidden`}>
        {comment.authorAvatar ? (
          <img src={comment.authorAvatar} alt="" className="w-full h-full object-cover" />
        ) : (
          comment.authorName?.slice(0, 2).toUpperCase() || 'AN'
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-semibold text-gray-900 ${isReply ? 'text-xs' : 'text-sm'}`}>
            {comment.authorName || 'Anonymous'}
          </span>
          <span className="text-xs text-gray-400">{formatRelativeTime(comment.createdAt)}</span>
          {comment.timestamp !== null && (
            <button
              onClick={() => onSeek(comment.timestamp!)}
              className="text-xs text-[#08CF65] hover:text-[#07B859] font-medium bg-[#E0F5EA] hover:bg-[#D0F0E0] px-1.5 py-0.5 rounded transition-colors"
            >
              {formatTimestamp(comment.timestamp)}
            </button>
          )}
        </div>
        <p className={`text-gray-700 mt-1 leading-relaxed ${isReply ? 'text-xs' : 'text-sm'}`}>{comment.content}</p>
        <div className="flex items-center gap-3 mt-2">
          {!isReply && (
            <button
              onClick={() => { setReplyingTo(replyingTo === comment.id ? null : comment.id); setReplyContent(''); setShowReplyEmojiPicker(false); }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span>Répondre</span>
            </button>
          )}
          <button
            onClick={() => handleDeleteComment(comment.id, parentId)}
            disabled={deleting === comment.id}
            className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            {deleting === comment.id ? (
              <div className="w-3.5 h-3.5 border border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-200 flex flex-col h-full min-h-[400px] shadow-sm">
      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {[
          { key: 'comments', label: 'Commentaires' },
          { key: 'summary', label: 'Résumé' },
          { key: 'transcript', label: 'Transcription' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Comments Tab */}
      {activeTab === 'comments' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Stats bar — views, comments, reactions */}
          <div className="px-4 py-2.5 border-b border-gray-100 text-sm text-gray-500 flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>{viewCount}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>{totalComments}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{totalReactions}</span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-12 px-6">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-900">Aucun commentaire</p>
                <p className="text-sm text-gray-500 mt-1">Soyez le premier à partager votre avis !</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {comments.map((comment) => (
                  <div key={comment.id}>
                    {renderComment(comment)}

                    {/* Inline reply box */}
                    {replyingTo === comment.id && (
                      <div className="px-4 pb-3 ml-12">
                        <div className="border border-gray-200 rounded-xl focus-within:border-[#08CF65] focus-within:ring-1 focus-within:ring-[#08CF65]/20 transition-all bg-gray-50">
                          <textarea
                            ref={replyInputRef}
                            placeholder="Écrire une réponse..."
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitReply(comment.id); }
                              if (e.key === 'Escape') { setReplyingTo(null); setReplyContent(''); setShowReplyEmojiPicker(false); }
                            }}
                            className="w-full px-3 py-2 text-sm resize-none focus:outline-none placeholder-gray-400 bg-transparent rounded-t-xl"
                            rows={2}
                          />
                          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-white rounded-b-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {formatTimestamp(currentTime)}
                              </span>
                              <button
                                ref={replyEmojiButtonRef}
                                onClick={() => setShowReplyEmojiPicker(!showReplyEmojiPicker)}
                                className="p-1 hover:bg-gray-100 rounded-md transition-colors text-gray-400 hover:text-gray-600"
                                title="Ajouter un emoji"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                              {showReplyEmojiPicker && (
                                <FloatingEmojiPicker
                                  anchorRef={replyEmojiButtonRef}
                                  onSelect={(emoji) => insertEmoji(emoji, true)}
                                  onClose={() => setShowReplyEmojiPicker(false)}
                                />
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => { setReplyingTo(null); setReplyContent(''); setShowReplyEmojiPicker(false); }} className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900 transition-colors">
                                Annuler
                              </button>
                              <button onClick={() => handleSubmitReply(comment.id)} disabled={!replyContent.trim()} className="px-3 py-1 bg-[#08CF65] text-white text-xs font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#07B859] transition-colors">
                                Répondre
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {comment.replies && comment.replies.length > 0 && (
                      <div className="ml-12 mr-4 pb-3 space-y-3 border-l-2 border-gray-100 pl-3">
                        {comment.replies.map((reply) => renderComment(reply, true, comment.id))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Main comment input */}
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="border border-gray-200 rounded-xl focus-within:border-[#08CF65] focus-within:ring-1 focus-within:ring-[#08CF65]/20 transition-all">
              <textarea
                ref={mainInputRef}
                placeholder="Écrire un commentaire..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); }
                }}
                className="w-full px-3 py-2.5 text-sm resize-none focus:outline-none placeholder-gray-400 rounded-t-xl"
                rows={2}
              />
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100 rounded-b-xl">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{formatTimestamp(currentTime)}</span>
                  </div>
                  <button
                    ref={emojiButtonRef}
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-1 hover:bg-gray-200 rounded-md transition-colors text-gray-400 hover:text-gray-600"
                    title="Ajouter un emoji"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  {showEmojiPicker && (
                    <FloatingEmojiPicker
                      anchorRef={emojiButtonRef}
                      onSelect={(emoji) => insertEmoji(emoji, false)}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}
                </div>
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim()}
                  className="px-4 py-1.5 bg-[#08CF65] text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#07B859] transition-colors"
                >
                  Publier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900">Pas de résumé disponible</p>
            <p className="text-sm text-gray-500 mt-1">Le résumé IA apparaîtra ici une fois généré.</p>
          </div>
        </div>
      )}

      {activeTab === 'transcript' && (
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900">Pas de transcription disponible</p>
            <p className="text-sm text-gray-500 mt-1">La transcription apparaîtra ici une fois traitée.</p>
          </div>
        </div>
      )}
    </div>
  );
}
