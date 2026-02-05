'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UploadingStatusProps {
  videoId: string;
}

export default function UploadingStatus({ videoId }: UploadingStatusProps) {
  const router = useRouter();
  const [checkCount, setCheckCount] = useState(0);

  useEffect(() => {
    // Check every 2 seconds if upload is complete
    const checkUploadStatus = async () => {
      try {
        const response = await fetch(`/api/videos/${videoId}/status`);
        const data = await response.json();
        
        if (data.ready) {
          // Refresh the page to show the video
          router.refresh();
        }
      } catch (error) {
        console.error('Failed to check upload status:', error);
      }
      setCheckCount(prev => prev + 1);
    };

    // Start checking immediately, then every 2 seconds
    checkUploadStatus();
    const interval = setInterval(checkUploadStatus, 2000);

    return () => clearInterval(interval);
  }, [videoId, router]);

  return (
    <div className="aspect-video flex flex-col items-center justify-center text-white bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="w-16 h-16 border-4 border-[#08CF65] border-t-transparent rounded-full animate-spin mb-6" />
      <p className="text-xl font-medium">Upload en cours...</p>
      <p className="text-gray-400 text-sm mt-2">La vidéo sera bientôt disponible</p>
      <p className="text-gray-500 text-xs mt-4">
        {checkCount > 0 && `Vérification ${checkCount}...`}
      </p>
    </div>
  );
}
