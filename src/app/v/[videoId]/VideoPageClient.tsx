'use client';

import { useRef, useState } from 'react';
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
      name: string | null;
      email: string;
      avatarUrl: string | null;
    } | null;
    createdAt: Date;
  };
  videoUrl: string;
  thumbnailUrl: string;
}

export default function VideoPageClient({ video, videoUrl, thumbnailUrl }: VideoPageClientProps) {
  const playerRef = useRef<VideoPlayerRef>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const handleSeek = (time: number) => {
    playerRef.current?.seek(time);
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Video player */}
        <div className="bg-black rounded-xl overflow-hidden shadow-lg">
          <VideoPlayer
            ref={playerRef}
            src={videoUrl}
            poster={thumbnailUrl}
            title={video.name}
            onTimeUpdate={handleTimeUpdate}
          />
        </div>

        {/* Video info */}
        <div className="mt-6 flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-gray-900">{video.name}</h1>
            <div className="flex items-center gap-3 mt-2 text-gray-500 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#E0F5EA] flex items-center justify-center text-xs font-semibold text-[#08CF65]">
                  {video.owner?.avatarUrl ? (
                    <img src={video.owner.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    (video.owner?.name || video.owner?.email || 'U').slice(0, 2).toUpperCase()
                  )}
                </div>
                <span>{video.owner?.name || video.owner?.email?.split('@')[0]}</span>
              </div>
              <span>•</span>
              <span>{formatDate(video.createdAt)}</span>
              {video.duration && (
                <>
                  <span>•</span>
                  <span>{formatDuration(video.duration)}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Copy link button */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://clips.drime.cloud/v/${video.id}`);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#08CF65] text-white rounded-lg hover:bg-[#07B859] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Copier le lien
            </button>
            
            {/* Download button */}
            <a
              href={videoUrl}
              download={`${video.name}.mp4`}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Télécharger
            </a>
          </div>
        </div>

        {/* Video details */}
        {video.width && video.height && (
          <div className="mt-6 p-4 bg-white rounded-xl border border-gray-200">
            <h2 className="font-medium text-gray-900 mb-2">Détails</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Résolution</p>
                <p className="text-gray-900 font-medium">{video.width}×{video.height}</p>
              </div>
              {video.duration && (
                <div>
                  <p className="text-gray-500">Durée</p>
                  <p className="text-gray-900 font-medium">{formatDuration(video.duration)}</p>
                </div>
              )}
              <div>
                <p className="text-gray-500">Créé le</p>
                <p className="text-gray-900 font-medium">{formatDate(video.createdAt)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Comments panel */}
      <div className="hidden lg:block w-80 flex-shrink-0">
        <div className="sticky top-4">
          <CommentsPanel
            videoId={video.id}
            currentTime={currentTime}
            onSeek={handleSeek}
          />
        </div>
      </div>
    </div>
  );
}
