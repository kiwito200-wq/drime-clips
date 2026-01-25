'use client'

import { useState, useEffect } from 'react'

interface SecureThumbnailProps {
  slug: string
  alt?: string
  className?: string
  fallbackClassName?: string
  onError?: () => void
}

/**
 * SecureThumbnail - Displays document thumbnails securely
 * 
 * SECURITY: Instead of using direct URLs, this component fetches
 * a time-limited signed URL from our API, which verifies that
 * the user has access to the document.
 */
export function SecureThumbnail({
  slug,
  alt = '',
  className = 'w-full h-full object-cover',
  fallbackClassName = 'w-4 h-4 text-gray-400',
  onError
}: SecureThumbnailProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function fetchSecureUrl() {
      try {
        const response = await fetch(`/api/secure-thumbnail/${slug}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch thumbnail')
        }

        const data = await response.json()
        
        if (isMounted) {
          setImageUrl(data.url)
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          setError(true)
          setLoading(false)
          onError?.()
        }
      }
    }

    fetchSecureUrl()

    return () => {
      isMounted = false
    }
  }, [slug, onError])

  // Loading state - show subtle pulse
  if (loading) {
    return (
      <div className={`${className} bg-gray-100 animate-pulse`} />
    )
  }

  // Error state - show document icon fallback
  if (error || !imageUrl) {
    return (
      <svg className={fallbackClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }

  // Success - show image
  return (
    <img 
      src={imageUrl} 
      alt={alt} 
      className={className}
      onError={() => {
        setError(true)
        onError?.()
      }}
    />
  )
}

// Smaller version for list views
export function SecureThumbnailSmall({
  slug,
  alt = ''
}: {
  slug: string
  alt?: string
}) {
  return (
    <SecureThumbnail
      slug={slug}
      alt={alt}
      className="w-full h-full object-cover"
      fallbackClassName="w-4 h-4 text-gray-400"
    />
  )
}

// Larger version for card views
export function SecureThumbnailCard({
  slug,
  alt = ''
}: {
  slug: string
  alt?: string
}) {
  return (
    <SecureThumbnail
      slug={slug}
      alt={alt}
      className="w-full h-full object-contain"
      fallbackClassName="w-12 h-12 text-gray-400"
    />
  )
}
