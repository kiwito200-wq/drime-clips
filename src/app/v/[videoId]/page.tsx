import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getPublicUrl, getVideoKey, getThumbnailKey } from '@/lib/r2';
import VideoPlayer from './VideoPlayer';
import CopyLinkButton from './CopyLinkButton';
import { notFound } from 'next/navigation';
import UploadingStatus from './UploadingStatus';

interface Props {
  params: { videoId: string };
}

// Generate metadata for SEO and social sharing
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const video = await prisma.video.findUnique({
    where: { id: params.videoId },
    include: { owner: { select: { name: true, email: true } } },
  });

  if (!video || !video.public) {
    return {
      title: 'Vidéo non trouvée - Drime Clips',
    };
  }

  const thumbnailUrl = getPublicUrl(getThumbnailKey(video.ownerId, video.id));
  const videoUrl = `https://clips.drime.cloud/api/stream/${video.id}`;
  const title = video.name;
  const description = `Regardez "${video.name}" partagé via Drime Clips`;

  return {
    title: `${title} - Drime Clips`,
    description,
    openGraph: {
      title,
      description,
      type: 'video.other',
      url: `https://clips.drime.cloud/v/${video.id}`,
      images: [
        {
          url: thumbnailUrl,
          width: video.width || 1920,
          height: video.height || 1080,
          alt: title,
        },
      ],
      videos: [
        {
          url: videoUrl,
          width: video.width || 1920,
          height: video.height || 1080,
          type: 'video/mp4',
        },
      ],
    },
    twitter: {
      card: 'player',
      title,
      description,
      images: [thumbnailUrl],
      players: [
        {
          playerUrl: `https://clips.drime.cloud/embed/${video.id}`,
          streamUrl: videoUrl,
          width: video.width || 1920,
          height: video.height || 1080,
        },
      ],
    },
  };
}

export default async function VideoPage({ params }: Props) {
  const video = await prisma.video.findUnique({
    where: { id: params.videoId },
    include: {
      owner: { select: { name: true, email: true, avatarUrl: true } },
      upload: true,
    },
  });

  if (!video) {
    notFound();
  }

  // Check if video is public
  if (!video.public) {
    notFound();
  }

  // Use streaming API instead of public URL (R2 buckets are private by default)
  const videoUrl = `/api/stream/${video.id}`;
  const thumbnailUrl = getPublicUrl(getThumbnailKey(video.ownerId, video.id));
  const isUploading = video.upload !== null;

  // Record view (async, don't wait)
  recordView(video.id);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="https://clips.drime.cloud" className="flex items-center gap-2">
            <img src="/drime-logo.png" alt="Drime" className="h-7" />
            <span className="font-semibold text-gray-900">Clips</span>
          </a>
          
          <div className="flex items-center gap-3">
            <a
              href="https://drime.cloud/download"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Télécharger l&apos;app
            </a>
            <a
              href="https://app.drime.cloud/login"
              className="px-4 py-2 bg-[#08CF65] text-white text-sm font-medium rounded-lg hover:bg-[#07B859] transition-colors"
            >
              Se connecter
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Video player */}
        <div className="bg-black rounded-xl overflow-hidden shadow-lg">
          {isUploading ? (
            <UploadingStatus videoId={video.id} />
          ) : (
            <VideoPlayer
              src={videoUrl}
              poster={thumbnailUrl}
              title={video.name}
            />
          )}
        </div>

        {/* Video info */}
        <div className="mt-6 flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-gray-900">{video.name}</h1>
            <div className="flex items-center gap-3 mt-2 text-gray-500 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#E0F5EA] flex items-center justify-center text-xs font-semibold text-[#08CF65]">
                  {(video.owner?.name || video.owner?.email || 'U').slice(0, 2).toUpperCase()}
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
            <CopyLinkButton videoId={video.id} />
            
            {/* Download button */}
            {!isUploading && (
              <a
                href={`/api/stream/${video.id}`}
                download={`${video.name}.mp4`}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Télécharger
              </a>
            )}
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
              {video.fps && (
                <div>
                  <p className="text-gray-500">FPS</p>
                  <p className="text-gray-900 font-medium">{video.fps}</p>
                </div>
              )}
              {video.duration && (
                <div>
                  <p className="text-gray-500">Durée</p>
                  <p className="text-gray-900 font-medium">{formatDuration(video.duration)}</p>
                </div>
              )}
              <div>
                <p className="text-gray-500">Créé le</p>
                <p className="text-gray-900 font-medium">{formatFullDate(video.createdAt)}</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            Partagé avec{' '}
            <a href="https://drime.cloud" className="text-[#08CF65] hover:underline">
              Drime Clips
            </a>
            {' '}— L&apos;outil d&apos;enregistrement d&apos;écran le plus simple
          </p>
        </div>
      </footer>
    </div>
  );
}

// Helper functions
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Record view (fire and forget)
async function recordView(videoId: string) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/videos/${videoId}/view`, {
      method: 'POST',
    });
  } catch (e) {
    // Ignore errors
  }
}

