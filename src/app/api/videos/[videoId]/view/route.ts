// Video View Tracking API

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

// Simple UA parsing without external dependencies
function parseUserAgent(ua: string): { browser: string; device: string; os: string } {
  let browser = 'Unknown';
  let device = 'desktop';
  let os = 'Unknown';

  // Browser detection
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera/')) browser = 'Opera';
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  else if (ua.includes('MSIE') || ua.includes('Trident/')) browser = 'IE';

  // OS detection
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux') && !ua.includes('Android')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) os = 'iOS';
  else if (ua.includes('CrOS')) os = 'Chrome OS';

  // Device detection
  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
    device = 'mobile';
  } else if (ua.includes('iPad') || ua.includes('Tablet')) {
    device = 'tablet';
  }

  return { browser, device, os };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const headersList = headers();
    const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      headersList.get('x-real-ip') || 
                      'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';
    
    // Vercel provides country header for free (no external service needed)
    const country = headersList.get('x-vercel-ip-country') || 
                    headersList.get('cf-ipcountry') || // Cloudflare fallback
                    null;
    const city = headersList.get('x-vercel-ip-city') || null;
    const referer = headersList.get('referer') || null;

    // Parse user agent
    const { browser, device } = parseUserAgent(userAgent);

    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id: params.videoId },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Record the view with parsed data
    await prisma.videoView.create({
      data: {
        videoId: params.videoId,
        ipAddress,
        userAgent,
        country: country || undefined,
        city: city ? decodeURIComponent(city) : undefined,
        browser,
        device,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Silently fail - view tracking shouldn't block the video
    console.error('Error recording view:', error);
    return NextResponse.json({ success: false });
  }
}
