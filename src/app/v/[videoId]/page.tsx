import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getPublicUrl, getVideoKey, getThumbnailKey } from '@/lib/r2';
import { notFound } from 'next/navigation';
import UploadingStatus from './UploadingStatus';
import VideoPageClient from './VideoPageClient';

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
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
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

  // Check if current user is the owner (for edit permissions)
  const { getCurrentUser } = await import('@/lib/auth');
  const currentUser = await getCurrentUser().catch(() => null);
  const canEdit = currentUser?.id === video.ownerId;

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
      <main className="max-w-7xl mx-auto px-4 py-8">
        {isUploading ? (
          <div className="max-w-5xl mx-auto">
            <div className="bg-black rounded-xl overflow-hidden shadow-lg">
              <UploadingStatus videoId={video.id} />
            </div>
          </div>
        ) : (
          <VideoPageClient
            video={{
              id: video.id,
              name: video.name,
              duration: video.duration,
              width: video.width,
              height: video.height,
              owner: video.owner,
              createdAt: video.createdAt,
            }}
            videoUrl={videoUrl}
            thumbnailUrl={thumbnailUrl}
            canEdit={canEdit}
          />
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

