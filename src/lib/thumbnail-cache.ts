/**
 * Cache for PDF page thumbnails
 * Stores thumbnails by PDF URL and page number to avoid regenerating them
 */

interface CachedThumbnail {
  imageUrl: string
  width: number
  height: number
  timestamp: number
}

// In-memory cache with a maximum size
const MAX_CACHE_SIZE = 100 // Maximum number of thumbnails to cache
const CACHE_EXPIRY = 30 * 60 * 1000 // 30 minutes

class ThumbnailCache {
  private cache: Map<string, CachedThumbnail> = new Map()

  /**
   * Generate a cache key from PDF URL and page number
   */
  private getCacheKey(pdfUrl: string, pageNumber: number): string {
    return `${pdfUrl}|${pageNumber}`
  }

  /**
   * Get a cached thumbnail if it exists and hasn't expired
   */
  get(pdfUrl: string, pageNumber: number): CachedThumbnail | null {
    const key = this.getCacheKey(pdfUrl, pageNumber)
    const cached = this.cache.get(key)

    if (!cached) {
      return null
    }

    // Check if cache entry has expired
    const now = Date.now()
    if (now - cached.timestamp > CACHE_EXPIRY) {
      this.cache.delete(key)
      return null
    }

    return cached
  }

  /**
   * Store a thumbnail in the cache
   */
  set(pdfUrl: string, pageNumber: number, imageUrl: string, width: number, height: number): void {
    // If cache is too large, remove oldest entries
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.evictOldest()
    }

    const key = this.getCacheKey(pdfUrl, pageNumber)
    this.cache.set(key, {
      imageUrl,
      width,
      height,
      timestamp: Date.now(),
    })
  }

  /**
   * Remove the oldest cache entries when cache is full
   */
  private evictOldest(): void {
    // Remove 20% of the cache (oldest entries)
    const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.2)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, entriesToRemove)

    entries.forEach(([key]) => {
      this.cache.delete(key)
    })
  }

  /**
   * Clear all cached thumbnails
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    this.cache.forEach((cached, key) => {
      if (now - cached.timestamp > CACHE_EXPIRY) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach(key => this.cache.delete(key))
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: MAX_CACHE_SIZE,
    }
  }
}

// Export a singleton instance
export const thumbnailCache = new ThumbnailCache()

// Periodically clean up expired entries
if (typeof window !== 'undefined') {
  setInterval(() => {
    thumbnailCache.clearExpired()
  }, 5 * 60 * 1000) // Every 5 minutes
}
