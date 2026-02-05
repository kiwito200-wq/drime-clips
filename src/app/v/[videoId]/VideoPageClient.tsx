'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import CommentsPanel from './CommentsPanel';

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

  // Toolbar state
  const [sendingReaction, setSendingReaction] = useState<string | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());
  const visitorId = useMemo(() => getVisitorId(), []);

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

  // Copy link
  const copyLink = () => {
    navigator.clipboard.writeText(`https://clips.drime.cloud/v/${video.id}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
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

  // Fetch reaction counts
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
      // Revert optimistic update on error
      fetchReactionCounts();
    } finally {
      setSendingReaction(null);
    }
  }, [video.id, currentTime, visitorId, fetchReactionCounts]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* LEFT: Video section - Takes most of the space */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Title bar - like Cap.so */}
        <div className="flex items-center justify-between mb-3">
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

          {/* Actions - like Cap.so */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Short link badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-600">
              <span className="font-mono">clips.drime.cloud/v/{video.id.slice(0, 8)}</span>
              <button
                onClick={copyLink}
                className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                title="Copier le lien"
              >
                {linkCopied ? (
                  <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Copy link button (mobile) */}
            <button
              onClick={copyLink}
              className="sm:hidden flex items-center gap-2 px-3 py-2 bg-[#08CF65] text-white rounded-lg hover:bg-[#07B859] transition-colors text-sm font-medium"
            >
              {linkCopied ? 'Copié !' : 'Copier'}
            </button>
          </div>
        </div>

        {/* Video player - full width, no extra card wrapper */}
        <div className="flex-1 rounded-xl overflow-hidden bg-black">
          <VideoPlayer
            ref={playerRef}
            src={videoUrl}
            poster={thumbnailUrl}
            title={title}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={handleDurationChange}
          />
        </div>

        {/* ─── Reaction Toolbar (Cap-style) ─── */}
        <div className="mt-4 flex justify-center">
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

      {/* RIGHT: Comments panel - Fixed width like Cap.so */}
      <div className="lg:w-[320px] xl:w-[360px] flex-shrink-0">
        <CommentsPanel
          videoId={video.id}
          currentTime={currentTime}
          duration={videoDuration}
          onSeek={handleSeek}
          refreshTrigger={refreshTrigger}
        />
      </div>
    </div>
  );
}
