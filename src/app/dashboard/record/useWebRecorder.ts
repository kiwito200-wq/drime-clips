'use client'

import { useCallback, useRef, useState } from 'react'
import { InstantUploader, initializeUpload } from './instant-uploader'
import { captureThumbnail, convertToMp4 } from './recording-conversion'

export type RecordingMode = 'fullscreen' | 'window' | 'tab' | 'camera'
export type RecorderPhase = 
  | 'idle' 
  | 'creating'      // Creating video entry
  | 'recording' 
  | 'paused' 
  | 'stopping'      // MediaRecorder stopping
  | 'converting'    // Converting WebM to MP4
  | 'uploading'     // Finalizing upload
  | 'completed' 
  | 'error'

export interface ChunkUploadState {
  partNumber: number
  status: 'queued' | 'uploading' | 'complete' | 'error'
  sizeBytes: number
  uploadedBytes: number
  progress: number
}

export interface RecorderError {
  message: string
  code?: string
  recoverable?: boolean
}

interface UseWebRecorderOptions {
  recordingMode: RecordingMode
  selectedCameraId: string | null
  selectedMicId: string | null
  onRecordingStart?: () => void
  onRecordingStop?: () => void
  onComplete?: (videoId: string, shareUrl: string) => void
  onError?: (error: Error) => void
}

// Order matters - try most compatible first
const SUPPORTED_MIME_TYPES = [
  'video/webm',  // Most basic, usually works
  'video/webm;codecs=vp8',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp9,opus',
  'video/mp4',
  'video/mp4;codecs=avc1',
  'video/mp4;codecs=avc1.42E01E',
]

function getSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  
  for (const mimeType of SUPPORTED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType
    }
  }
  
  return undefined
}

export const useWebRecorder = ({
  recordingMode,
  selectedCameraId,
  selectedMicId,
  onRecordingStart,
  onRecordingStop,
  onComplete,
  onError,
}: UseWebRecorderOptions) => {
  const [phase, setPhase] = useState<RecorderPhase>('idle')
  const [durationMs, setDurationMs] = useState(0)
  const [hasAudioTrack, setHasAudioTrack] = useState(false)
  const [chunkUploads, setChunkUploads] = useState<ChunkUploadState[]>([])
  const [lastError, setLastError] = useState<RecorderError | null>(null)
  const [conversionProgress, setConversionProgress] = useState(0)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedDurationRef = useRef<number>(0)
  const pauseStartRef = useRef<number | null>(null)
  const uploaderRef = useRef<InstantUploader | null>(null)
  const videoIdRef = useRef<string | null>(null)
  const totalBytesRef = useRef<number>(0)
  const stopResolverRef = useRef<((blob: Blob) => void) | null>(null)
  const stopRejecterRef = useRef<((err: Error) => void) | null>(null)
  const isStoppingRef = useRef(false)
  const liveThumbnailRef = useRef<string | null>(null)

  const isRecording = phase === 'recording' || phase === 'paused'
  const isBusy = phase !== 'idle' && phase !== 'completed' && phase !== 'error'

  // Helper to capture thumbnail from stream via video element
  const captureThumbnailFromStream = useCallback((stream: MediaStream, w: number, h: number) => {
    try {
      const video = document.createElement('video')
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      video.play().then(() => {
        setTimeout(() => {
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h)
            liveThumbnailRef.current = canvas.toDataURL('image/jpeg', 0.7)
            console.log('[WebRecorder] Live thumbnail captured via video element')
          }
          video.pause()
          video.srcObject = null
        }, 200)
      }).catch(err => {
        console.warn('[WebRecorder] Video play for thumbnail failed:', err)
      })
    } catch (err) {
      console.warn('[WebRecorder] captureThumbnailFromStream failed:', err)
    }
  }, [])

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    uploaderRef.current = null
    videoIdRef.current = null
    totalBytesRef.current = 0
    liveThumbnailRef.current = null
  }, [])

  const resetState = useCallback(() => {
    cleanup()
    setPhase('idle')
    setDurationMs(0)
    setHasAudioTrack(false)
    setChunkUploads([])
    setLastError(null)
    setConversionProgress(0)
    chunksRef.current = []
  }, [cleanup])

  const handleError = useCallback((error: Error, recoverable = false) => {
    console.error('[WebRecorder] Error:', error.message)
    setLastError({ 
      message: error.message, 
      recoverable 
    })
    setPhase('error')
    onError?.(error)
    cleanup()
  }, [cleanup, onError])

  const startRecording = useCallback(async () => {
    try {
      setPhase('creating')
      setLastError(null)
      chunksRef.current = []
      totalBytesRef.current = 0
      
      // Initialize upload
      const uploadData = await initializeUpload()
      if (!uploadData) {
        throw new Error('Connexion échouée. Vérifiez que vous êtes connecté.')
      }

      const { videoId, uploadId, userId, shareUrl } = uploadData
      videoIdRef.current = videoId

      // Get display media
      let stream: MediaStream

      if (recordingMode === 'camera') {
        stream = await navigator.mediaDevices.getUserMedia({
          video: selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true,
          audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true,
        })
      } else {
        const displayMediaOptions: DisplayMediaStreamOptions = {
          video: {
            displaySurface: recordingMode === 'window' ? 'window' : 
                           recordingMode === 'tab' ? 'browser' : 'monitor',
          },
          audio: true,
        }

        stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)

        // Add microphone if selected
        if (selectedMicId) {
          try {
            const micStream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: { exact: selectedMicId } },
            })
            micStream.getAudioTracks().forEach(track => stream.addTrack(track))
          } catch (micError) {
            console.warn('[WebRecorder] Could not add microphone:', micError)
          }
        }
      }

      streamRef.current = stream
      
      const audioTracks = stream.getAudioTracks()
      setHasAudioTrack(audioTracks.length > 0)

      // Create uploader instance
      const uploader = new InstantUploader({
        videoId,
        uploadId,
        userId,
        mimeType: 'video/webm',
        shareUrl,
        onChunkStateChange: setChunkUploads,
        onProgress: (uploaded, total) => {
          console.log(`[WebRecorder] Upload progress: ${uploaded}/${total}`)
        },
        onError: (err) => {
          console.error('[WebRecorder] Upload error:', err)
        },
      })
      uploaderRef.current = uploader

      // Setup MediaRecorder - let browser choose codec first, then try specific ones
      const videoTrack = stream.getVideoTracks()[0]
      console.log('[WebRecorder] Stream active:', stream.active)
      console.log('[WebRecorder] Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState, muted: t.muted })))
      if (videoTrack) {
        const settings = videoTrack.getSettings()
        console.log('[WebRecorder] Video settings:', { width: settings.width, height: settings.height, frameRate: settings.frameRate, displaySurface: settings.displaySurface })
      }
      
      let mediaRecorder: MediaRecorder
      let usedMimeType = ''
      
      // First try without specifying mimeType - let browser choose
      try {
        mediaRecorder = new MediaRecorder(stream)
        usedMimeType = mediaRecorder.mimeType || 'browser-default'
        console.log('[WebRecorder] MediaRecorder created with browser default, mimeType:', usedMimeType)
      } catch (e) {
        console.warn('[WebRecorder] Browser default failed, trying specific mimeTypes:', e)
        
        // Fall back to trying specific mime types
        const mimeType = getSupportedMimeType()
        console.log('[WebRecorder] Trying mimeType:', mimeType)
        
        if (mimeType) {
          try {
            mediaRecorder = new MediaRecorder(stream, { mimeType })
            usedMimeType = mimeType
          } catch (e2) {
            console.error('[WebRecorder] All mimeTypes failed:', e2)
            throw new Error('Navigateur incompatible avec l\'enregistrement')
          }
        } else {
          throw new Error('Aucun codec supporté')
        }
      }
      
      console.log('[WebRecorder] Final mimeType:', mediaRecorder.mimeType)

      mediaRecorder.ondataavailable = (e) => {
        console.log('[WebRecorder] ondataavailable fired, size:', e.data?.size || 0)
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
          totalBytesRef.current += e.data.size
          uploader.handleChunk(e.data, totalBytesRef.current)
        }
      }

      mediaRecorder.onstop = () => {
        console.log('[WebRecorder] MediaRecorder onstop fired')
        
        if (chunksRef.current.length === 0) {
          const rejecter = stopRejecterRef.current
          stopResolverRef.current = null
          stopRejecterRef.current = null
          isStoppingRef.current = false
          rejecter?.(new Error('Aucune donnée enregistrée'))
          return
        }

        const actualMimeType = mediaRecorder.mimeType || 'video/webm'
        const blob = new Blob(chunksRef.current, { type: actualMimeType })
        console.log('[WebRecorder] Created blob:', blob.size, 'bytes')
        
        const resolver = stopResolverRef.current
        stopResolverRef.current = null
        stopRejecterRef.current = null
        isStoppingRef.current = false
        resolver?.(blob)
      }

      mediaRecorder.onerror = (event) => {
        console.error('[WebRecorder] MediaRecorder error:', event)
        const rejecter = stopRejecterRef.current
        stopResolverRef.current = null
        stopRejecterRef.current = null
        isStoppingRef.current = false
        if (rejecter) {
          rejecter(new Error('Erreur MediaRecorder'))
        } else {
          handleError(new Error('Erreur d\'enregistrement'))
        }
      }

      mediaRecorderRef.current = mediaRecorder
      
      // Start recording - try with timeslice, fall back to no timeslice
      try {
        mediaRecorder.start(1000) // Chunk every second
        console.log('[WebRecorder] MediaRecorder started with timeslice=1000, state:', mediaRecorder.state)
      } catch (startErr) {
        console.warn('[WebRecorder] start(1000) failed, trying start():', startErr)
        mediaRecorder.start()
        console.log('[WebRecorder] MediaRecorder started without timeslice, state:', mediaRecorder.state)
      }

      // Start timer
      startTimeRef.current = Date.now()
      pausedDurationRef.current = 0
      pauseStartRef.current = null
      
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current - pausedDurationRef.current
        setDurationMs(elapsed)
        
        // Manual data request as fallback (some browsers need this)
        const rec = mediaRecorderRef.current
        if (rec && rec.state === 'recording' && chunksRef.current.length === 0 && elapsed > 2000) {
          console.log('[WebRecorder] No chunks yet, requesting data manually...')
          try {
            rec.requestData()
          } catch (e) {
            // Ignore
          }
        }
      }, 100)

      // Capture a live thumbnail from the stream after a short delay
      setTimeout(() => {
        try {
          const liveVideoTrack = stream.getVideoTracks()[0]
          if (liveVideoTrack) {
            const settings = liveVideoTrack.getSettings()
            const sw = settings.width || 1280
            const sh = settings.height || 720
            const scale = Math.min(1280 / sw, 720 / sh, 1)
            const cw = Math.round(sw * scale)
            const ch = Math.round(sh * scale)
            
            // Use ImageCapture API if available
            if (typeof ImageCapture !== 'undefined') {
              const imageCapture = new ImageCapture(liveVideoTrack)
              imageCapture.grabFrame().then(bitmap => {
                const canvas = document.createElement('canvas')
                canvas.width = cw
                canvas.height = ch
                const ctx = canvas.getContext('2d')
                if (ctx) {
                  ctx.drawImage(bitmap, 0, 0, cw, ch)
                  liveThumbnailRef.current = canvas.toDataURL('image/jpeg', 0.7)
                  console.log('[WebRecorder] Live thumbnail captured via ImageCapture')
                }
                bitmap.close()
              }).catch(err => {
                console.warn('[WebRecorder] ImageCapture failed, trying video element:', err)
                captureThumbnailFromStream(stream, cw, ch)
              })
            } else {
              captureThumbnailFromStream(stream, cw, ch)
            }
          }
        } catch (err) {
          console.warn('[WebRecorder] Live thumbnail capture failed:', err)
        }
      }, 1500) // Wait 1.5s for first frame to render

      // Handle stream ending (user stops sharing)
      const mainVideoTrack = stream.getVideoTracks()[0]
      if (mainVideoTrack) {
        mainVideoTrack.addEventListener('ended', () => {
          console.log('[WebRecorder] Video track ended by user')
          const rec = mediaRecorderRef.current
          if (rec && rec.state === 'recording' && !isStoppingRef.current) {
            // Don't call stopRecording directly - just stop the recorder
            // The onstop handler will take care of the rest
            try {
              rec.requestData()
              setTimeout(() => {
                if (rec.state === 'recording') {
                  rec.stop()
                }
              }, 100)
            } catch (e) {
              console.warn('[WebRecorder] Error handling track end:', e)
            }
          }
        }, { once: true })
      }

      setPhase('recording')
      onRecordingStart?.()

    } catch (error) {
      const err = error as Error
      
      // Handle specific errors
      if (err.name === 'NotAllowedError') {
        handleError(new Error('Permission refusée. Autorisez le partage d\'écran.'), true)
      } else if (err.name === 'NotFoundError') {
        handleError(new Error('Aucune source vidéo trouvée.'), true)
      } else {
        handleError(err, true)
      }
    }
  }, [recordingMode, selectedCameraId, selectedMicId, onRecordingStart, onRecordingStop, onComplete, cleanup, handleError])

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder) {
      console.log('[WebRecorder] No recorder')
      return
    }
    
    const state = recorder.state
    console.log('[WebRecorder] Stopping, current state:', state)
    
    if (state === 'inactive') {
      console.log('[WebRecorder] Already inactive')
      return
    }
    if (isStoppingRef.current) {
      console.log('[WebRecorder] Already stopping')
      return
    }

    isStoppingRef.current = true
    setPhase('stopping')
    onRecordingStop?.()

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Create promise that resolves when onstop fires (with timeout)
    const stopPromise = new Promise<Blob>((resolve, reject) => {
      stopResolverRef.current = resolve
      stopRejecterRef.current = reject
      
      // Timeout after 10s
      setTimeout(() => {
        if (stopResolverRef.current) {
          console.error('[WebRecorder] onstop timeout - creating blob manually')
          // Try to create blob from what we have
          if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' })
            stopResolverRef.current = null
            stopRejecterRef.current = null
            isStoppingRef.current = false
            resolve(blob)
          } else {
            stopResolverRef.current = null
            stopRejecterRef.current = null
            isStoppingRef.current = false
            reject(new Error('Timeout: aucune donnée'))
          }
        }
      }, 10000)
    })

    // Request final data before stopping
    try {
      if (state === 'recording') {
        recorder.requestData()
      }
    } catch (e) {
      console.warn('[WebRecorder] requestData failed:', e)
    }

    // Small delay to let requestData complete
    await new Promise(r => setTimeout(r, 100))

    // Stop the recorder
    try {
      recorder.stop()
      console.log('[WebRecorder] recorder.stop() called')
    } catch (err) {
      console.error('[WebRecorder] Error calling stop():', err)
    }

    try {
      // Wait for the blob
      console.log('[WebRecorder] Waiting for onstop...')
      const recordedBlob = await stopPromise
      console.log('[WebRecorder] Got blob:', recordedBlob.size, 'bytes')

      // NOW stop streams (after we have the blob)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      if (recordedBlob.size === 0) {
        throw new Error('Enregistrement vide')
      }

      // Use live thumbnail if available, otherwise try from blob
      setPhase('uploading')
      let thumbnailDataUrl: string | undefined
      
      if (liveThumbnailRef.current) {
        thumbnailDataUrl = liveThumbnailRef.current
        console.log('[WebRecorder] Using live thumbnail:', thumbnailDataUrl.length, 'chars')
      } else {
        console.log('[WebRecorder] No live thumbnail, trying from blob...')
        try {
          const thumbResult = await captureThumbnail(recordedBlob)
          if (thumbResult) {
            thumbnailDataUrl = thumbResult.dataUrl
            console.log('[WebRecorder] Blob thumbnail OK:', thumbnailDataUrl.length, 'chars')
          }
        } catch (thumbErr) {
          console.warn('[WebRecorder] Blob thumbnail also failed:', thumbErr)
        }
      }

      // Finalize upload
      console.log('[WebRecorder] Finalizing upload...')
      const currentUploader = uploaderRef.current
      if (!currentUploader) {
        throw new Error('Uploader indisponible')
      }
      
      const finalShareUrl = await currentUploader.finalize(recordedBlob, thumbnailDataUrl)
      console.log('[WebRecorder] Done, shareUrl:', finalShareUrl)
      
      // Save videoId before cleanup clears it
      const completedVideoId = videoIdRef.current
      
      cleanup()

      if (finalShareUrl && completedVideoId) {
        setPhase('completed')
        onComplete?.(completedVideoId, finalShareUrl)
      } else {
        throw new Error('Upload échoué')
      }
    } catch (error) {
      console.error('[WebRecorder] Stop error:', error)
      // Clean up streams on error too
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      handleError(error as Error)
    }
  }, [cleanup, handleError, onComplete, onRecordingStop])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
      pauseStartRef.current = Date.now()
      setPhase('paused')
    }
  }, [])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      if (pauseStartRef.current) {
        pausedDurationRef.current += Date.now() - pauseStartRef.current
        pauseStartRef.current = null
      }
      mediaRecorderRef.current.resume()
      setPhase('recording')
    }
  }, [])

  const restartRecording = useCallback(async () => {
    // Cancel current upload
    if (uploaderRef.current) {
      await uploaderRef.current.cancel()
    }
    
    resetState()
    await startRecording()
  }, [resetState, startRecording])

  const cancelRecording = useCallback(async () => {
    // Stop MediaRecorder without triggering onstop handler
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.onerror = null
      
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }

    // Cancel upload
    if (uploaderRef.current) {
      await uploaderRef.current.cancel()
    }

    resetState()
  }, [resetState])

  return {
    // State
    phase,
    durationMs,
    hasAudioTrack,
    chunkUploads,
    isRecording,
    isBusy,
    lastError,
    conversionProgress,
    
    // Actions
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    restartRecording,
    cancelRecording,
    resetState,
  }
}
