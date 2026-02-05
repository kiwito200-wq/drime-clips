'use client';

import { useRef, useState, useEffect } from 'react';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import CommentsPanel from './CommentsPanel';

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

  // Format date
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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
    return formatDate(date);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header with title */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
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
                className="text-2xl font-semibold text-gray-900 bg-transparent border-b-2 border-[#08CF65] outline-none w-full"
              />
            ) : (
              <h1 
                className={`text-2xl font-semibold text-gray-900 ${canEdit ? 'cursor-pointer hover:text-[#08CF65] transition-colors' : ''}`}
                onClick={startEditing}
                title={canEdit ? 'Cliquer pour modifier' : undefined}
              >
                {title}
              </h1>
            )}
            
            {/* Meta info */}
            <div className="flex items-center gap-3 mt-2 text-gray-500 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#E0F5EA] flex items-center justify-center text-xs font-semibold text-[#08CF65]">
                  {video.owner?.avatarUrl ? (
                    <img src={video.owner.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                  ) : (
                    (video.owner?.name || video.owner?.email || 'U').slice(0, 2).toUpperCase()
                  )}
                </div>
                <span className="font-medium text-gray-700">{video.owner?.name || video.owner?.email?.split('@')[0]}</span>
              </div>
              <span className="text-gray-300">•</span>
              <span>{formatRelativeDate(video.createdAt)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-4 py-2 bg-[#08CF65] text-white rounded-full hover:bg-[#07B859] transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {linkCopied ? 'Copié !' : 'Copier le lien'}
            </button>
          </div>
        </div>
      </div>

      {/* Main content: Video + Comments side by side */}
      <div className="flex gap-4 items-stretch">
        {/* Video section */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm h-full">
            <div className="rounded-xl overflow-hidden aspect-video">
              <VideoPlayer
                ref={playerRef}
                src={videoUrl}
                poster={thumbnailUrl}
                title={title}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={handleDurationChange}
              />
            </div>
          </div>
        </div>

        {/* Comments panel - stretches to match video height */}
        <div className="hidden lg:flex w-[340px] flex-shrink-0">
          <div className="w-full">
            <CommentsPanel
              videoId={video.id}
              currentTime={currentTime}
              duration={videoDuration}
              onSeek={handleSeek}
            />
          </div>
        </div>
      </div>


      {/* Video details (mobile) */}
      <div className="lg:hidden mt-4">
        <CommentsPanel
          videoId={video.id}
          currentTime={currentTime}
          duration={videoDuration}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}
