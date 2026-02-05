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
      
      // Use /me/workspaces endpoint - it's what the Drime desktop app uses
      // and it contains user info in the response
      const endpoint = '/api/v1/me/workspaces';
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
        console.log(`[Desktop Auth] Drime API raw response (first 500):`, responseText.substring(0, 500));
        
        if (apiRes.ok && !responseText.startsWith('<!')) {
          try {
            const data = JSON.parse(responseText);
            console.log('[Desktop Auth] Parsed response:', JSON.stringify(data).substring(0, 300));
            
            // /me/workspaces returns { status: 'success', workspaces: [...], user: {...} }
            // Or sometimes just { workspaces: [...] } with user info in workspaces[0].owner
            if (data.user) {
              drimeUser = data.user;
              console.log('[Desktop Auth] Found user in data.user');
            } else if (data.workspaces && data.workspaces.length > 0) {
              // Get user info from workspace owner
              const workspace = data.workspaces[0];
              if (workspace.owner) {
                drimeUser = workspace.owner;
                console.log('[Desktop Auth] Found user in workspace.owner');
              } else if (workspace.user) {
                drimeUser = workspace.user;
                console.log('[Desktop Auth] Found user in workspace.user');
              }
            } else if (data.data?.user) {
              drimeUser = data.data.user;
              console.log('[Desktop Auth] Found user in data.data.user');
            }
            
            // If still no user, try to get email from token payload (JWT decode)
            if (!drimeUser) {
              console.log('[Desktop Auth] No user found in workspaces response, trying to decode JWT...');
              try {
                // JWT has 3 parts: header.payload.signature
                const parts = drimeAccessToken.split('.');
                if (parts.length === 3) {
                  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                  console.log('[Desktop Auth] JWT payload:', JSON.stringify(payload));
                  if (payload.email || payload.sub) {
                    drimeUser = {
                      id: payload.sub || payload.user_id || payload.id,
                      email: payload.email,
                      name: payload.name || payload.display_name,
                    };
                    console.log('[Desktop Auth] Extracted user from JWT');
                  }
                }
              } catch (jwtError) {
                console.log('[Desktop Auth] Could not decode JWT:', jwtError);
              }
            }
          } catch (parseError) {
            console.error(`[Desktop Auth] JSON parse error:`, parseError);
          }
        } else {
          console.log('[Desktop Auth] Response is not JSON or not OK');
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
