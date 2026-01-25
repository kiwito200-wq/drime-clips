/** @type {import('next').NextConfig} */
const nextConfig = {
  // SECURITY: Configure security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // XSS Protection (legacy browsers)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Disable features we don't need
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          // HSTS - Force HTTPS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              // Default: only allow same origin
              "default-src 'self'",
              // Scripts: self, inline (for Next.js), eval (for pdf.js), and jsdelivr for pdf.js worker
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
              // Styles: self and inline (for styled components, etc.)
              "style-src 'self' 'unsafe-inline'",
              // Images: self, data URIs (for signatures), and our R2 bucket
              "img-src 'self' data: blob: https://*.r2.dev https://*.r2.cloudflarestorage.com https://*.drime.cloud",
              // Fonts: self and data URIs
              "font-src 'self' data:",
              // Connect: self, our APIs, and jsdelivr for pdf.js worker
              "connect-src 'self' https://*.drime.cloud https://*.r2.dev https://*.r2.cloudflarestorage.com https://api.resend.com https://cdn.jsdelivr.net wss:",
              // Media: self
              "media-src 'self'",
              // Objects: none (no Flash, etc.)
              "object-src 'none'",
              // Base: self
              "base-uri 'self'",
              // Forms: self
              "form-action 'self'",
              // Frame ancestors: none (prevent embedding)
              "frame-ancestors 'none'",
              // Workers: self and jsdelivr for pdf.js
              "worker-src 'self' blob: https://cdn.jsdelivr.net",
              // Block mixed content
              "block-all-mixed-content",
              // Upgrade insecure requests in production
              process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests' : '',
            ].filter(Boolean).join('; '),
          },
        ],
      },
      // Specific headers for API routes
      {
        source: '/api/:path*',
        headers: [
          // Prevent caching of sensitive data
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ]
  },
  
  // SECURITY: Disable x-powered-by header
  poweredByHeader: false,
  
  // SECURITY: Configure allowed image domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: '*.drime.cloud',
      },
    ],
  },
}

export default nextConfig
