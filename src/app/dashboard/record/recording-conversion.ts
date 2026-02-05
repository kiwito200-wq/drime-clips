'use client'

const MAX_THUMBNAIL_WIDTH = 1280
const MAX_THUMBNAIL_HEIGHT = 720
const JPEG_QUALITY = 0.7
const THUMBNAIL_TIMEOUT_MS = 15000

export interface ThumbnailResult {
  dataUrl: string
  width: number
  height: number
}

export const captureThumbnail = (
  source: Blob,
  dimensions?: { width?: number; height?: number }
): Promise<ThumbnailResult | null> =>
  new Promise((resolve) => {
    const video = document.createElement('video')
    const objectUrl = URL.createObjectURL(source)
    video.src = objectUrl
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'

    let timeoutId: ReturnType<typeof setTimeout>
    let resolved = false

    const cleanup = () => {
      if (resolved) return
      resolved = true
      clearTimeout(timeoutId)
      video.pause()
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(objectUrl)
    }

    const finalize = (result: ThumbnailResult | null) => {
      cleanup()
      resolve(result)
    }

    timeoutId = setTimeout(() => {
      console.warn('[Thumbnail] Generation timed out after', THUMBNAIL_TIMEOUT_MS, 'ms')
      finalize(null)
    }, THUMBNAIL_TIMEOUT_MS)

    video.addEventListener('error', (e) => {
      console.error('[Thumbnail] Video error:', e)
      finalize(null)
    }, { once: true })

    video.addEventListener('loadedmetadata', () => {
      try {
        const duration = Number.isFinite(video.duration) ? video.duration : 0
        const targetTime = duration > 0 ? Math.min(1, duration / 4) : 0
        console.log('[Thumbnail] Video duration:', duration, 'seeking to:', targetTime)
        video.currentTime = targetTime
      } catch (err) {
        console.error('[Thumbnail] Error seeking:', err)
        finalize(null)
      }
    }, { once: true })

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas')
        const sourceWidth = video.videoWidth || dimensions?.width || 1280
        const sourceHeight = video.videoHeight || dimensions?.height || 720

        if (sourceWidth === 0 || sourceHeight === 0) {
          console.warn('[Thumbnail] Invalid video dimensions:', sourceWidth, 'x', sourceHeight)
          finalize(null)
          return
        }

        const scale = Math.min(
          MAX_THUMBNAIL_WIDTH / sourceWidth,
          MAX_THUMBNAIL_HEIGHT / sourceHeight,
          1
        )
        const width = Math.round(sourceWidth * scale)
        const height = Math.round(sourceHeight * scale)

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          console.error('[Thumbnail] Could not get canvas context')
          finalize(null)
          return
        }

        ctx.drawImage(video, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
        
        console.log('[Thumbnail] Generated successfully:', width, 'x', height, 'size:', dataUrl.length)
        finalize({ dataUrl, width, height })
      } catch (err) {
        console.error('[Thumbnail] Error drawing to canvas:', err)
        finalize(null)
      }
    }, { once: true })
  })

export const convertToMp4 = async (
  blob: Blob,
  hasAudio: boolean,
  onProgress?: (progress: number) => void
): Promise<File> => {
  const file = new File([blob], 'recording.webm', { type: blob.type })
  
  try {
    const { convertMedia } = await import('@remotion/webcodecs')

    const result = await convertMedia({
      src: file,
      container: 'mp4',
      videoCodec: 'h264',
      ...(hasAudio ? { audioCodec: 'aac' as const } : {}),
      onProgress: ({ overallProgress }) => {
        if (overallProgress !== null) {
          const percent = Math.min(100, Math.max(0, overallProgress * 100))
          onProgress?.(percent)
        }
      },
    })

    const savedFile = await result.save()
    
    if (savedFile.size === 0) {
      throw new Error('Conversion produced empty file')
    }
    
    if (savedFile.type !== 'video/mp4') {
      return new File([savedFile], 'result.mp4', { type: 'video/mp4' })
    }
    
    return savedFile as File
  } catch (err) {
    console.error('[Conversion] WebCodecs conversion failed:', err)
    console.log('[Conversion] Falling back to original blob')
    return file
  }
}
