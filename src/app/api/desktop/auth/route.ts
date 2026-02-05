// Desktop App Authentication
// Exchange Drime token for a Clips JWT token

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
);

// Helper to ensure URL has protocol
function ensureProtocol(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

const DRIME_API_URL = ensureProtocol(process.env.DRIME_API_URL || 'https://app.drime.cloud');

export async function POST(request: NextRequest) {
  try {
    // Get Drime session or access token from request body
    const body = await request.json();
    const { drimeSession, drimeAccessToken } = body;

    if (!drimeSession && !drimeAccessToken) {
      return NextResponse.json({ error: 'drimeSession or drimeAccessToken required' }, { status: 400 });
    }

    let drimeUser: any = null;

    // Try access token first (desktop app JWT)
    if (drimeAccessToken) {
      console.log('[Desktop Auth] Trying drimeAccessToken:', drimeAccessToken.substring(0, 30) + '...');
      
      // Try the main user endpoint
      const endpoint = '/api/v1/user';
      console.log(`[Desktop Auth] Calling: ${DRIME_API_URL}${endpoint}`);
      
      try {
        const apiRes = await fetch(`${DRIME_API_URL}${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${drimeAccessToken}`,
            'Accept': 'application/json',
          },
        });
        
        console.log(`[Desktop Auth] Drime API status:`, apiRes.status);
        const responseText = await apiRes.text();
        console.log(`[Desktop Auth] Drime API raw response:`, responseText.substring(0, 500));
        
        if (apiRes.ok) {
          const data = JSON.parse(responseText);
          
          // Extract user from various response formats
          if (data.user) {
            drimeUser = data.user;
            console.log('[Desktop Auth] Found user in data.user');
          } else if (data.email) {
            drimeUser = data;
            console.log('[Desktop Auth] Found user in root');
          } else if (data.status === 'success') {
            // Might be nested differently
            drimeUser = data.data?.user || data.data || data;
            console.log('[Desktop Auth] Found user in success response');
          }
        }
      } catch (e) {
        console.error(`[Desktop Auth] Error calling Drime API:`, e);
      }
    }

    // Fallback to session cookie
    if (!drimeUser && drimeSession) {
      console.log('[Desktop Auth] Trying drimeSession cookie...');
      const drimeRes = await fetch(`${DRIME_API_URL}/api/v1/auth/external/me`, {
        method: 'GET',
        headers: {
          'Cookie': `drime_session=${drimeSession}`,
          'Accept': 'application/json',
        },
      });

      if (drimeRes.ok) {
        const drimeData = await drimeRes.json();
        drimeUser = drimeData.user;
      }
    }

    if (!drimeUser) {
      console.error('[Desktop Auth] Failed to authenticate with Drime');
      return NextResponse.json({ error: 'Invalid Drime credentials' }, { status: 401 });
    }

    // Get or create user in our database
    const user = await prisma.user.upsert({
      where: { email: drimeUser.email },
      update: {
        name: drimeUser.name || drimeUser.display_name || undefined,
        avatarUrl: drimeUser.avatar_url || undefined,
        drimeUserId: String(drimeUser.id),
      },
      create: {
        email: drimeUser.email,
        name: drimeUser.name || drimeUser.display_name || null,
        avatarUrl: drimeUser.avatar_url || null,
        drimeUserId: String(drimeUser.id),
      },
    });

    // Create a long-lived JWT for the desktop app (30 days)
    const token = await new SignJWT({ userId: user.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(JWT_SECRET);

    console.log(`[Desktop Auth] Authenticated user ${user.id} (${user.email})`);

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error('[Desktop Auth] Error:', error);
    return NextResponse.json({ 
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
