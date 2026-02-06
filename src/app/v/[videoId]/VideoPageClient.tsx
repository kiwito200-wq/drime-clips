'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import CommentsPanel from './CommentsPanel';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

// Generate or retrieve a stable visitor ID for deduplication
function getVisitorId(): string {
  const key = 'drime_visitor_id';
  let id = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  if (!id) {
    id = crypto.randomUUID();
    if (typeof window !== 'undefined') localStorage.setItem(key, id);
  }
  return id;
}

const REACTIONS = [
  { emoji: '😂', label: 'Drôle' },
  { emoji: '😍', label: 'Adore' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '🙌', label: 'Bravo' },
  { emoji: '👍', label: 'Top' },
  { emoji: '👎', label: 'Bof' },
];

// ─── Shared Dropdown (Cap.so style) ───
function SharedDropdown({
  videoId,
  viewCount,
  commentCount,
  reactionCount,
  canEdit,
  isPublic,
  onTogglePublic,
}: {
  videoId: string;
  viewCount: number;
  commentCount: number;
  reactionCount: number;
  canEdit: boolean;
  isPublic: boolean;
  onTogglePublic: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkAnimationData, setCheckAnimationData] = useState<any>(null);
  const ref = useRef<HTMLDivElement>(null);
  const shareUrl = `https://clips.drime.cloud/v/${videoId}`;

  // Load check animation
  useEffect(() => {
    fetch('/check-animation.json')
      .then(res => res.json())
      .then(setCheckAnimationData)
      .catch(() => {});
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
          open
            ? 'bg-[#E0F5EA] border-[#08CF65]/30 text-[#08CF65]'
            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 shadow-sm'
        }`}
      >
        {/* Link icon */}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span>Shared</span>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      <div
        className={`absolute right-0 top-full mt-2 w-[340px] bg-white rounded-2xl border border-gray-200 shadow-xl z-50 transition-all duration-200 origin-top-right ${
          open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.97] -translate-y-1 pointer-events-none'
        }`}
      >
        {/* Header with stats */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className="text-sm font-semibold text-gray-900">{viewCount}</span>
              <span className="text-xs text-gray-500">vues</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-sm font-semibold text-gray-900">{commentCount}</span>
              <span className="text-xs text-gray-500">commentaires</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-gray-900">{reactionCount}</span>
            </div>
          </div>
        </div>

        {/* Copy link — exact Transfr style */}
        <div className="p-4">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
            Lien de partage
          </label>
          <div
            onClick={!copied ? handleCopy : undefined}
            className={`flex items-center rounded-[10px] overflow-hidden transition-all duration-300 border-2 cursor-pointer ${
              copied
                ? 'border-[#08CF65] bg-[#08CF65]/5'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            {copied ? (
              <div className="flex-1 flex items-center justify-center gap-2 py-2.5">
                {checkAnimationData ? (
                  <div style={{ width: '20px', height: '20px', filter: 'brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%) hue-rotate(123deg) brightness(102%) contrast(101%)' }}>
                    <Lottie
                      key={copied ? 'copied-link' : 'not-copied-link'}
                      animationData={checkAnimationData}
                      loop={false}
                      autoplay={true}
                      style={{ width: '20px', height: '20px' }}
                    />
                  </div>
                ) : (
                  <svg className="w-5 h-5 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span className="text-sm font-medium text-[#08CF65]">Lien copié !</span>
              </div>
            ) : (
              <>
                <span className="flex-1 px-3 py-2.5 text-sm text-gray-600 truncate">
                  {shareUrl}
                </span>
                <div className="self-stretch w-px bg-gray-200" />
                <button
                  onClick={handleCopy}
                  className="px-3 py-2.5 flex items-center gap-2 hover:bg-gray-50 transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-[#08CF65]">Copier</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Visibility toggle (owner only) */}
        {canEdit && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2.5">
                {isPublic ? (
                  <div className="w-8 h-8 rounded-lg bg-[#E0F5EA] flex items-center justify-center">
                    <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {isPublic ? 'Public' : 'Privé'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isPublic ? 'Tout le monde peut voir' : 'Seul vous pouvez voir'}
                  </p>
                </div>
              </div>
              <button
                onClick={onTogglePublic}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  isPublic ? 'bg-[#08CF65]' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    isPublic ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface VideoPageClientProps {
  video: {
    id: string;
    name: string;
    duration: number | null;
    width: number | null;
    height: number | null;
    owner: {
      id?: string;
      name: string | null;
      email: string;
      avatarUrl: string | null;
    } | null;
    createdAt: Date;
  };
  videoUrl: string;
  thumbnailUrl: string;
  canEdit?: boolean;
}

export default function VideoPageClient({ video, videoUrl, thumbnailUrl, canEdit = false }: VideoPageClientProps) {
  const playerRef = useRef<VideoPlayerRef>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(video.duration || 0);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(video.name);
  const [tempTitle, setTempTitle] = useState(video.name);
  const [linkCopied, setLinkCopied] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isPublic, setIsPublic] = useState(true);

  // Toolbar state
  const [sendingReaction, setSendingReaction] = useState<string | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());
  const visitorId = useMemo(() => getVisitorId(), []);

  // Stats
  const [viewCount, setViewCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [totalReactions, setTotalReactions] = useState(0);

  // Lottie check animation
  const [checkAnimationData, setCheckAnimationData] = useState<any>(null);
  useEffect(() => {
    fetch('/check-animation.json')
      .then(res => res.json())
      .then(setCheckAnimationData)
      .catch(() => {});
  }, []);

  const handleSeek = (time: number) => {
    playerRef.current?.seek(time);
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handleDurationChange = (duration: number) => {
    setVideoDuration(duration);
  };

  // Handle title edit
  const startEditing = () => {
    if (!canEdit) return;
    setIsEditingTitle(true);
    setTempTitle(title);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const saveTitle = async () => {
    if (tempTitle.trim() && tempTitle !== title) {
      try {
        const res = await fetch(`/api/videos/${video.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tempTitle.trim() }),
        });
        if (res.ok) {
          setTitle(tempTitle.trim());
        }
      } catch (e) {
        console.error('Failed to update title:', e);
      }
    }
    setIsEditingTitle(false);
  };

  const cancelEditing = () => {
    setTempTitle(title);
    setIsEditingTitle(false);
  };

  // Copy link (for mobile)
  const copyLink = () => {
    navigator.clipboard.writeText(`https://clips.drime.cloud/v/${video.id}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Toggle public/private
  const togglePublic = async () => {
    const newValue = !isPublic;
    setIsPublic(newValue);
    try {
      await fetch(`/api/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public: newValue }),
      });
    } catch (e) {
      setIsPublic(!newValue); // Revert on error
      console.error('Failed to toggle visibility:', e);
    }
  };

  // Format relative time
  const formatRelativeDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return "À l'instant";
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Fetch reaction counts + stats
  const fetchReactionCounts = useCallback(async () => {
    try {
      const response = await fetch(`/api/videos/${video.id}/comments?visitorId=${encodeURIComponent(visitorId)}`);
      const data = await response.json();
      const counts: Record<string, number> = {};
      if (data.reactions) {
        Object.entries(data.reactions).forEach(([emoji, info]: [string, any]) => {
          counts[emoji] = info.count || 0;
        });
      }
      setReactionCounts(counts);
      if (data.myReactions) {
        setMyReactions(new Set(data.myReactions));
      }
      setViewCount(data.viewCount || 0);
      setCommentCount(
        (data.comments || []).reduce((sum: number, c: any) => sum + 1 + (c.replies?.length || 0), 0)
      );
      setTotalReactions(data.totalReactions || 0);
    } catch (error) {
      console.error('Failed to fetch reaction counts:', error);
    }
  }, [video.id, visitorId]);

  useEffect(() => {
    fetchReactionCounts();
  }, [fetchReactionCounts]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchReactionCounts();
    }
  }, [refreshTrigger, fetchReactionCounts]);

  // Post emoji reaction (toggle: add or remove)
  const handleEmojiReaction = useCallback(async (emoji: string) => {
    setSendingReaction(emoji);
    // Optimistic update
    setMyReactions(prev => {
      const next = new Set(prev);
      if (next.has(emoji)) {
        next.delete(emoji);
        setReactionCounts(c => ({ ...c, [emoji]: Math.max(0, (c[emoji] || 0) - 1) }));
      } else {
        next.add(emoji);
        setReactionCounts(c => ({ ...c, [emoji]: (c[emoji] || 0) + 1 }));
      }
      return next;
    });
    try {
      const response = await fetch(`/api/videos/${video.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'emoji', content: emoji, timestamp: currentTime, visitorId }),
      });
      if (response.ok) {
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to post reaction:', error);
      fetchReactionCounts();
    } finally {
      setSendingReaction(null);
    }
  }, [video.id, currentTime, visitorId, fetchReactionCounts]);

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Title bar ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-[#E0F5EA] flex items-center justify-center text-sm font-bold text-[#08CF65] flex-shrink-0 overflow-hidden">
            {video.owner?.avatarUrl ? (
              <img src={video.owner.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              (video.owner?.name || video.owner?.email || 'U').slice(0, 2).toUpperCase()
            )}
          </div>
          
          <div className="min-w-0">
            {/* Editable title */}
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle();
                  if (e.key === 'Escape') cancelEditing();
                }}
                className="text-lg font-semibold text-gray-900 bg-transparent border-b-2 border-[#08CF65] outline-none w-full"
              />
            ) : (
              <h1 
                className={`text-lg font-semibold text-gray-900 truncate ${canEdit ? 'cursor-pointer hover:text-[#08CF65] transition-colors' : ''}`}
                onClick={startEditing}
                title={canEdit ? 'Cliquer pour modifier' : title}
              >
                {title}
              </h1>
            )}
            
            {/* Meta info */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="font-medium">{video.owner?.name || video.owner?.email?.split('@')[0]}</span>
              <span>•</span>
              <span>{formatRelativeDate(video.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Quick copy link — exact Transfr style */}
          <div
            onClick={!linkCopied ? copyLink : undefined}
            className={`hidden sm:flex items-center rounded-[10px] overflow-hidden transition-all duration-300 border-2 cursor-pointer ${
              linkCopied
                ? 'border-[#08CF65] bg-[#08CF65]/5'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            {linkCopied ? (
              <div className="flex items-center justify-center gap-2 px-4 py-2">
                {checkAnimationData ? (
                  <div style={{ width: '20px', height: '20px', filter: 'brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%) hue-rotate(123deg) brightness(102%) contrast(101%)' }}>
                    <Lottie
                      key={linkCopied ? 'copied-quick' : 'not-copied-quick'}
                      animationData={checkAnimationData}
                      loop={false}
                      autoplay={true}
                      style={{ width: '20px', height: '20px' }}
                    />
                  </div>
                ) : (
                  <svg className="w-5 h-5 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span className="text-sm font-medium text-[#08CF65]">Lien copié !</span>
              </div>
            ) : (
              <>
                <span className="px-3 py-2 text-sm text-gray-600 truncate max-w-[240px]">
                  clips.drime.cloud/v/{video.id.slice(0, 8)}...
                </span>
                <div className="self-stretch w-px bg-gray-200" />
                <button
                  onClick={copyLink}
                  className="px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-[#08CF65]">Copier</span>
                </button>
              </>
            )}
          </div>

          {/* Mobile copy link — same Transfr style */}
          <div
            onClick={!linkCopied ? copyLink : undefined}
            className={`sm:hidden flex items-center rounded-[10px] overflow-hidden transition-all duration-300 border-2 cursor-pointer ${
              linkCopied
                ? 'border-[#08CF65] bg-[#08CF65]/5'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            {linkCopied ? (
              <div className="flex items-center justify-center gap-2 px-3 py-2">
                {checkAnimationData ? (
                  <div style={{ width: '18px', height: '18px', filter: 'brightness(0) saturate(100%) invert(48%) sepia(79%) saturate(2476%) hue-rotate(123deg) brightness(102%) contrast(101%)' }}>
                    <Lottie
                      key={linkCopied ? 'copied-mobile' : 'not-copied-mobile'}
                      animationData={checkAnimationData}
                      loop={false}
                      autoplay={true}
                      style={{ width: '18px', height: '18px' }}
                    />
                  </div>
                ) : (
                  <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span className="text-sm font-medium text-[#08CF65]">Copié !</span>
              </div>
            ) : (
              <button
                onClick={copyLink}
                className="px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-[#08CF65]">Copier</span>
              </button>
            )}
          </div>

          {/* Shared dropdown (owner only) */}
          {canEdit && (
            <SharedDropdown
              videoId={video.id}
              viewCount={viewCount}
              commentCount={commentCount}
              reactionCount={totalReactions}
              canEdit={canEdit}
              isPublic={isPublic}
              onTogglePublic={togglePublic}
            />
          )}
        </div>
      </div>

      {/* ─── Video + Comments row (share same height) ─── */}
      <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-14rem)]">
        {/* Video player */}
        <div className="flex-1 min-w-0 min-h-0 rounded-xl overflow-hidden bg-black">
          <VideoPlayer
            ref={playerRef}
            src={videoUrl}
            poster={thumbnailUrl}
            title={title}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
          />
        </div>

        {/* Comments panel - same height as player */}
        <div className="lg:w-[320px] xl:w-[360px] flex-shrink-0 lg:h-full lg:min-h-0">
          <CommentsPanel
            videoId={video.id}
            currentTime={currentTime}
            duration={videoDuration}
            onSeek={handleSeek}
            refreshTrigger={refreshTrigger}
            visitorId={visitorId}
          />
        </div>
      </div>

      {/* ─── Reaction Toolbar (below both player & comments) ─── */}
      <div className="flex justify-center">
        <div className="inline-flex p-2 bg-white rounded-full border border-gray-200 shadow-sm">
          <div className="flex items-center gap-1">
            {REACTIONS.map((reaction) => {
              const count = reactionCounts[reaction.emoji] || 0;
              const hasReacted = myReactions.has(reaction.emoji);
              return (
                <div key={reaction.emoji} className="relative group">
                  <button
                    onClick={() => handleEmojiReaction(reaction.emoji)}
                    disabled={sendingReaction === reaction.emoji}
                    className={`relative inline-flex justify-center items-center w-10 h-10 text-xl rounded-full transition-all duration-150 active:scale-90 ${
                      sendingReaction === reaction.emoji ? 'opacity-50 scale-90' : ''
                    } ${hasReacted ? 'bg-[#E0F5EA] ring-1 ring-[#08CF65]/30' : 'hover:bg-gray-100'}`}
                  >
                    <span className="select-none">{reaction.emoji}</span>
                  </button>
                  {/* Tooltip with label + count */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                    <div className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                      {reaction.label}{count > 0 ? ` · ${count}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
