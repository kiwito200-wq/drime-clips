import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple middleware - no complex rate limiting or beta checks
export function middleware(request: NextRequest) {
  // Allow all requests to pass through
  // Authentication is handled at the API/page level
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Only match API routes that need protection
    '/api/envelopes/:path*',
    '/dashboard/:path*',
  ],
}
