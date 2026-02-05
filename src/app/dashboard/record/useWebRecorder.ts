'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type RecordingMode = 'fullscreen' | 'window' | 'tab' | 'camera'
export type RecorderPhase = 'idle' | 'recording' | 'paused' | 'creating' | 'uploading' | 'completed' | 'error'

export interface ChunkUploadState {
  partNumber: number
  status: 'queued' | 'uploading' | 'complete' | 'error'
  sizeBytes: number
  uploadedBytes: number
  progress: number
}

interface UploadState {
  videoId: string | null
  uploadId: string | null
  userId: string | null
  partNumber: number
  parts: { PartNumber: number; ETag: string }[]
  uploading: boolean
  uploadedBytes: number
  totalBytes: number
  shareUrl: string | null
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

export interface RecorderError {
  message: string
  code?: string
}

const MIN_CHUNK_SIZE = 5 * 1024 * 1024

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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const pendingChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedDurationRef = useRef<number>(0)
  const pauseStartRef = useRef<number | null>(null)
  
  const uploadStateRef = useRef<UploadState>({
    videoId: null,
    uploadId: null,
    userId: null,
    partNumber: 1,
    parts: [],
    uploading: false,
    uploadedBytes: 0,
    totalBytes: 0,
    shareUrl: null,
  })

  const initializeUpload = async (): Promise<UploadState> => {
    const res = await fetch('/api/upload/simple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'create' }),
    })
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      console.error('[WebRecorder] Upload init failed:', res.status, errorData)
      if (res.status === 401) {
        throw new Error('Session expirée. Veuillez vous reconnecter.')
      }
      throw new Error(errorData.error || 'Failed to initialize upload')
    }
    
    const data = await res.json()
    console.log('[WebRecorder] Upload initialized:', data.videoId)
    
    const state: UploadState = {
      videoId: data.videoId,
      uploadId: data.uploadId,
      userId: data.userId,
      partNumber: 1,
      parts: [],
      uploading: false,
      uploadedBytes: 0,
      totalBytes: 0,
      shareUrl: data.shareUrl,
    }
    uploadStateRef.current = state
    return state
  }

  const uploadChunk = async (chunk: Blob, partNumber: number) => {
    const state = uploadStateRef.current
    if (!state.videoId || !state.uploadId || !state.userId) return

    setChunkUploads(prev => {
      const existing = prev.find(c => c.partNumber === partNumber)
      if (existing) {
        return prev.map(c => c.partNumber === partNumber ? { ...c, status: 'uploading' as const } : c)
      }
      return [...prev, {
        partNumber,
        status: 'uploading' as const,
        sizeBytes: chunk.size,
        uploadedBytes: 0,
        progress: 0,
      }]
    })

    try {
      const presignRes = await fetch('/api/upload/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'presign',
          videoId: state.videoId,
          uploadId: state.uploadId,
          userId: state.userId,
          partNumber,
        }),
      })
      
      if (!presignRes.ok) throw new Error('Failed to get presigned URL')
      const { presignedUrl } = await presignRes.json()

      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        body: chunk,
        headers: { 'Content-Type': 'video/webm' },
      })

      if (!uploadRes.ok) throw new Error('Failed to upload chunk')
      
      const etag = uploadRes.headers.get('ETag') || `"part-${partNumber}"`
      
      state.parts.push({
        PartNumber: partNumber,
        ETag: etag.replace(/"/g, ''),
      })
      state.uploadedBytes += chunk.size

      setChunkUploads(prev => prev.map(c => 
        c.partNumber === partNumber 
          ? { ...c, status: 'complete' as const, uploadedBytes: chunk.size, progress: 1 }
          : c
      ))
    } catch (error) {
      console.error('Error uploading chunk:', error)
      setChunkUploads(prev => prev.map(c => 
        c.partNumber === partNumber ? { ...c, status: 'error' as const } : c
      ))
    }
  }

  const processPendingChunks = async () => {
    const state = uploadStateRef.current
    if (state.uploading) return

    state.uploading = true
    
    while (pendingChunksRef.current.length > 0) {
      const chunks = pendingChunksRef.current
      let combined = new Blob(chunks, { type: 'video/webm' })
      
      if (combined.size >= MIN_CHUNK_SIZE) {
        pendingChunksRef.current = []
        await uploadChunk(combined, state.partNumber)
        state.partNumber++
      } else {
        break
      }
    }
    
    state.uploading = false
  }

  const generateThumbnail = async (videoBlob: Blob): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.playsInline = true
      
      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration * 0.1)
      }
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const thumbnail = canvas.toDataURL('image/jpeg', 0.8)
          URL.revokeObjectURL(video.src)
          resolve(thumbnail)
        } else {
          resolve(null)
        }
      }
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src)
        resolve(null)
      }
      
      video.src = URL.createObjectURL(videoBlob)
    })
  }

  const finalizeUpload = async (): Promise<string | null> => {
    const state = uploadStateRef.current
    if (!state.videoId || !state.uploadId || !state.userId) return null

    try {
      if (pendingChunksRef.current.length > 0) {
        const remaining = new Blob(pendingChunksRef.current, { type: 'video/webm' })
        if (remaining.size > 0) {
          await uploadChunk(remaining, state.partNumber)
        }
        pendingChunksRef.current = []
      }

      let thumbnail: string | null = null
      if (chunksRef.current.length > 0) {
        const fullBlob = new Blob(chunksRef.current, { type: 'video/webm' })
        thumbnail = await generateThumbnail(fullBlob)
      }

      const res = await fetch('/api/upload/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'complete',
          videoId: state.videoId,
          uploadId: state.uploadId,
          userId: state.userId,
          parts: state.parts.sort((a, b) => a.PartNumber - b.PartNumber),
          thumbnail,
        }),
      })

      if (!res.ok) throw new Error('Failed to finalize upload')
      
      return state.shareUrl
    } catch (error) {
      console.error('Error finalizing upload:', error)
      return null
    }
  }

  const startRecording = useCallback(async () => {
    try {
      setPhase('creating')
      
      const uploadState = await initializeUpload()
      
      let stream: MediaStream

      if (recordingMode === 'camera') {
        stream = await navigator.mediaDevices.getUserMedia({
          video: selectedCameraId ? { deviceId: selectedCameraId } : true,
          audio: selectedMicId ? { deviceId: selectedMicId } : true,
        })
      } else {
        const displayMediaOptions: DisplayMediaStreamOptions = {
          video: true,
          audio: true,
        }

        if (recordingMode === 'window') {
          (displayMediaOptions.video as any) = { displaySurface: 'window' }
        } else if (recordingMode === 'tab') {
          (displayMediaOptions.video as any) = { displaySurface: 'browser' }
        }

        stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)

        if (selectedMicId) {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: selectedMicId, echoCancellation: true, noiseSuppression: true },
            })
            audioStream.getAudioTracks().forEach(track => stream.addTrack(track))
          } catch (e) {
            console.warn('Could not get microphone:', e)
          }
        }
      }

      streamRef.current = stream
      chunksRef.current = []
      pendingChunksRef.current = []

      const hasAudio = stream.getAudioTracks().length > 0
      setHasAudioTrack(hasAudio)

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
      })

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
          pendingChunksRef.current.push(e.data)
          uploadStateRef.current.totalBytes += e.data.size
          processPendingChunks()
        }
      }

      mediaRecorder.onstop = async () => {
        setPhase('uploading')
        onRecordingStop?.()
        
        const shareUrl = await finalizeUpload()
        cleanup()
        
        if (shareUrl && uploadStateRef.current.videoId) {
          setPhase('completed')
          onComplete?.(uploadStateRef.current.videoId, shareUrl)
        } else {
          setPhase('error')
          onError?.(new Error('Upload failed'))
        }
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000)

      startTimeRef.current = Date.now()
      pausedDurationRef.current = 0
      pauseStartRef.current = null
      
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current - pausedDurationRef.current
        setDurationMs(elapsed)
      }, 100)

      stream.getTracks().forEach(track => {
        track.onended = () => stopRecording()
      })

      setPhase('recording')
      onRecordingStart?.()

    } catch (error) {
      console.error('Error starting recording:', error)
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue'
      setLastError({ message: errorMessage })
      setPhase('error')
      onError?.(error as Error)
    }
  }, [recordingMode, selectedCameraId, selectedMicId, onRecordingStart, onRecordingStop, onComplete, onError])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      pauseStartRef.current = Date.now()
      setPhase('paused')
    }
  }, [])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      if (pauseStartRef.current) {
        pausedDurationRef.current += Date.now() - pauseStartRef.current
        pauseStartRef.current = null
      }
      mediaRecorderRef.current.resume()
      setPhase('recording')
    }
  }, [])

  const restartRecording = useCallback(async () => {
    cleanup()
    setPhase('idle')
    setDurationMs(0)
    setChunkUploads([])
    await startRecording()
  }, [startRecording])

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
  }, [])

  const resetState = useCallback(() => {
    cleanup()
    setPhase('idle')
    setDurationMs(0)
    setHasAudioTrack(false)
    setChunkUploads([])
    setLastError(null)
    uploadStateRef.current = {
      videoId: null,
      uploadId: null,
      userId: null,
      partNumber: 1,
      parts: [],
      uploading: false,
      uploadedBytes: 0,
      totalBytes: 0,
      shareUrl: null,
    }
  }, [cleanup])

  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  const isRecording = phase === 'recording' || phase === 'paused'
  const isBusy = phase === 'creating' || phase === 'recording' || phase === 'paused' || phase === 'uploading'

  return {
    phase,
    durationMs,
    hasAudioTrack,
    chunkUploads,
    isRecording,
    isBusy,
    lastError,
    videoId: uploadStateRef.current.videoId,
    shareUrl: uploadStateRef.current.shareUrl,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    restartRecording,
    resetState,
  }
}
