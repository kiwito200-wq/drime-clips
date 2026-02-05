'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

type RecordingMode = 'fullscreen' | 'window' | 'tab' | 'camera'

interface DeviceInfo {
  deviceId: string
  label: string
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
}

const RECORDING_MODES = [
  {
    id: 'fullscreen' as RecordingMode,
    label: 'Plein écran',
    sublabel: 'Recommandé pour capturer la caméra en PiP',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'window' as RecordingMode,
    label: 'Fenêtre',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8V6a2 2 0 012-2h14a2 2 0 012 2v2M3 8v10a2 2 0 002 2h6m-8-2h18M17 16l4-4m0 0l-4-4m4 4H9" />
      </svg>
    ),
  },
  {
    id: 'tab' as RecordingMode,
    label: 'Onglet actuel',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" />
      </svg>
    ),
  },
  {
    id: 'camera' as RecordingMode,
    label: 'Caméra uniquement',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
]

const MIN_CHUNK_SIZE = 5 * 1024 * 1024 // 5MB minimum for multipart

export default function RecordPage() {
  const router = useRouter()
  const [recorderOpen, setRecorderOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modeSelectOpen, setModeSelectOpen] = useState(false)
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('fullscreen')
  
  // Devices
  const [cameras, setCameras] = useState<DeviceInfo[]>([])
  const [microphones, setMicrophones] = useState<DeviceInfo[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null)
  const [selectedMic, setSelectedMic] = useState<string | null>(null)
  const [cameraSelectOpen, setCameraSelectOpen] = useState(false)
  const [micSelectOpen, setMicSelectOpen] = useState(false)

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'recording' | 'uploading' | 'complete' | 'error'>('idle')
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const pendingChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const uploadStateRef = useRef<UploadState>({
    videoId: null,
    uploadId: null,
    userId: null,
    partNumber: 1,
    parts: [],
    uploading: false,
    uploadedBytes: 0,
    totalBytes: 0,
  })

  // Upload progress
  const [uploadProgress, setUploadProgress] = useState(0)

  // Settings
  const [rememberDevices, setRememberDevices] = useState(false)

  // Load devices
  const loadDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => {})
      const devices = await navigator.mediaDevices.enumerateDevices()
      
      const cams = devices.filter(d => d.kind === 'videoinput').map(d => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${d.deviceId.slice(0, 5)}`,
      }))
      const mics = devices.filter(d => d.kind === 'audioinput').map(d => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${d.deviceId.slice(0, 5)}`,
      }))
      
      setCameras(cams)
      setMicrophones(mics)
    } catch (error) {
      console.error('Error loading devices:', error)
    }
  }, [])

  useEffect(() => {
    if (recorderOpen) {
      loadDevices()
    }
  }, [recorderOpen, loadDevices])

  // Initialize upload
  const initializeUpload = async () => {
    try {
      const res = await fetch('/api/upload/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      })
      
      if (!res.ok) throw new Error('Failed to initialize upload')
      
      const data = await res.json()
      uploadStateRef.current = {
        ...uploadStateRef.current,
        videoId: data.videoId,
        uploadId: data.uploadId,
        userId: data.userId,
        partNumber: 1,
        parts: [],
      }
      
      return data
    } catch (error) {
      console.error('Error initializing upload:', error)
      throw error
    }
  }

  // Upload chunk
  const uploadChunk = async (chunk: Blob) => {
    const state = uploadStateRef.current
    if (!state.videoId || !state.uploadId || !state.userId) return

    try {
      // Get presigned URL
      const presignRes = await fetch('/api/upload/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'presign',
          videoId: state.videoId,
          uploadId: state.uploadId,
          userId: state.userId,
          partNumber: state.partNumber,
        }),
      })
      
      if (!presignRes.ok) throw new Error('Failed to get presigned URL')
      const { presignedUrl } = await presignRes.json()

      // Upload to R2
      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        body: chunk,
        headers: { 'Content-Type': 'video/webm' },
      })

      if (!uploadRes.ok) throw new Error('Failed to upload chunk')
      
      const etag = uploadRes.headers.get('ETag') || `"part-${state.partNumber}"`
      
      state.parts.push({
        PartNumber: state.partNumber,
        ETag: etag.replace(/"/g, ''),
      })
      state.partNumber++
      state.uploadedBytes += chunk.size
      
      setUploadProgress(Math.round((state.uploadedBytes / Math.max(state.totalBytes, state.uploadedBytes)) * 100))
    } catch (error) {
      console.error('Error uploading chunk:', error)
    }
  }

  // Process pending chunks
  const processPendingChunks = async () => {
    const state = uploadStateRef.current
    if (state.uploading || pendingChunksRef.current.length === 0) return

    state.uploading = true
    
    while (pendingChunksRef.current.length > 0) {
      const chunk = pendingChunksRef.current.shift()
      if (chunk && chunk.size >= MIN_CHUNK_SIZE) {
        await uploadChunk(chunk)
      } else if (chunk) {
        // Chunk too small, put it back for later
        pendingChunksRef.current.unshift(chunk)
        break
      }
    }
    
    state.uploading = false
  }

  // Generate thumbnail from video blob
  const generateThumbnail = async (videoBlob: Blob): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.playsInline = true
      
      video.onloadeddata = () => {
        // Seek to 1 second or 10% of the video
        const seekTime = Math.min(1, video.duration * 0.1)
        video.currentTime = seekTime
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

  // Finalize upload
  const finalizeUpload = async () => {
    const state = uploadStateRef.current
    if (!state.videoId || !state.uploadId || !state.userId) return null

    try {
      // Upload any remaining chunks
      if (pendingChunksRef.current.length > 0) {
        const remaining = new Blob(pendingChunksRef.current, { type: 'video/webm' })
        if (remaining.size > 0) {
          await uploadChunk(remaining)
        }
        pendingChunksRef.current = []
      }

      // Generate thumbnail from recorded chunks
      let thumbnail: string | null = null
      if (chunksRef.current.length > 0) {
        const fullBlob = new Blob(chunksRef.current, { type: 'video/webm' })
        thumbnail = await generateThumbnail(fullBlob)
      }

      // Complete multipart upload
      const res = await fetch('/api/upload/simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          videoId: state.videoId,
          uploadId: state.uploadId,
          userId: state.userId,
          parts: state.parts.sort((a, b) => a.PartNumber - b.PartNumber),
          thumbnail, // Include thumbnail
        }),
      })

      if (!res.ok) throw new Error('Failed to finalize upload')
      
      return state.videoId
    } catch (error) {
      console.error('Error finalizing upload:', error)
      return null
    }
  }

  // Start recording
  const startRecording = async () => {
    try {
      setPhase('recording')
      
      // Initialize upload first
      await initializeUpload()
      
      let stream: MediaStream

      if (recordingMode === 'camera') {
        stream = await navigator.mediaDevices.getUserMedia({
          video: selectedCamera ? { deviceId: selectedCamera } : true,
          audio: selectedMic ? { deviceId: selectedMic } : true,
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

        const displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)

        if (selectedMic) {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: selectedMic },
            })
            audioStream.getAudioTracks().forEach(track => displayStream.addTrack(track))
          } catch (e) {
            console.warn('Could not get microphone:', e)
          }
        }

        stream = displayStream
      }

      streamRef.current = stream
      chunksRef.current = []
      pendingChunksRef.current = []

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
        const videoId = await finalizeUpload()
        cleanup()
        
        if (videoId) {
          setPhase('complete')
          router.push(`/v/${videoId}`)
        } else {
          setPhase('error')
        }
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000) // Collect data every second

      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      // Handle stream end
      stream.getTracks().forEach(track => {
        track.onended = () => stopRecording()
      })

      // Close the dialog when recording starts
      setRecorderOpen(false)
    } catch (error) {
      console.error('Error starting recording:', error)
      setPhase('error')
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  // Pause/Resume
  const togglePause = () => {
    if (!mediaRecorderRef.current) return
    
    if (isPaused) {
      mediaRecorderRef.current.resume()
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } else {
      mediaRecorderRef.current.pause()
      if (timerRef.current) clearInterval(timerRef.current)
    }
    setIsPaused(!isPaused)
  }

  // Cleanup
  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    setIsRecording(false)
    setIsPaused(false)
    setRecordingTime(0)
    uploadStateRef.current = {
      videoId: null,
      uploadId: null,
      userId: null,
      partNumber: 1,
      parts: [],
      uploading: false,
      uploadedBytes: 0,
      totalBytes: 0,
    }
  }

  // Cancel recording
  const cancelRecording = () => {
    cleanup()
    setPhase('idle')
  }

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Open Desktop
  const openDesktop = () => {
    window.location.href = 'drime://'
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.location.href = '/download'
      }
    }, 1500)
  }

  // FAQ Items
  const faqItems = [
    { q: "Qu'est-ce qu'un Clip ?", a: "Un Clip est un enregistrement vidéo rapide de votre écran, caméra ou les deux que vous pouvez partager instantanément avec un lien." },
    { q: "Comment ça marche ?", a: "L'enregistrement se fait directement dans votre navigateur et s'upload en temps réel. Une fois terminé, vous êtes redirigé vers votre vidéo." },
    { q: "Quels navigateurs sont recommandés ?", a: "Nous recommandons Google Chrome ou d'autres navigateurs basés sur Chromium pour la meilleure expérience." },
    { q: "Comment garder ma webcam visible ?", a: "En mode plein écran, votre webcam s'affiche dans une fenêtre picture-in-picture qui reste visible pendant l'enregistrement." },
    { q: "Que puis-je enregistrer ?", a: "Vous pouvez enregistrer votre écran entier, une fenêtre spécifique, un onglet ou juste votre caméra." },
    { q: "Puis-je enregistrer l'audio système ?", a: "L'audio système est limité dans les navigateurs. Pour de meilleurs résultats, utilisez Drime Desktop." },
  ]

  const [openFaq, setOpenFaq] = useState<string | null>(null)
  const currentMode = RECORDING_MODES.find(m => m.id === recordingMode)

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-xl">
        {/* Title */}
        <div className="text-center mb-8">
          <p className="text-gray-500">Choisissez comment enregistrer votre Clip</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={openDesktop}
            className="flex items-center gap-2 px-5 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Ouvrir Drime Desktop
          </button>
          
          <span className="text-gray-400 text-sm">ou</span>
          
          <button
            onClick={() => setRecorderOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-[#08CF65] text-white rounded-xl hover:bg-[#07B859] transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Enregistrer dans le navigateur
          </button>
        </div>

        {/* FAQ */}
        <div className="mt-10">
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
            {faqItems.map((item, i) => (
              <div key={i} className="p-4">
                <button
                  onClick={() => setOpenFaq(openFaq === item.q ? null : item.q)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="text-sm font-medium text-gray-900">{item.q}</span>
                  <svg 
                    className={`w-4 h-4 text-gray-400 transition-transform ${openFaq === item.q ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <AnimatePresence>
                  {openFaq === item.q && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="pt-2 text-sm text-gray-500">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Web Recorder Dialog */}
      <AnimatePresence>
        {recorderOpen && !isRecording && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setRecorderOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[320px]"
            >
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 pb-2">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">Free</span>
                  <button
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>

                {settingsOpen ? (
                  <div className="p-4 pt-2">
                    <div className="flex items-center gap-2 mb-4">
                      <button onClick={() => setSettingsOpen(false)} className="text-[#08CF65] text-sm font-medium flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        Retour
                      </button>
                      <span className="text-sm font-medium text-gray-900">Paramètres</span>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Mémoriser les appareils</p>
                          <p className="text-xs text-gray-500 mt-0.5">Sélection automatique au prochain enregistrement</p>
                        </div>
                        <button
                          onClick={() => setRememberDevices(!rememberDevices)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${rememberDevices ? 'bg-[#08CF65]' : 'bg-gray-300'}`}
                        >
                          <motion.div 
                            animate={{ x: rememberDevices ? 20 : 2 }}
                            className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 pt-2 space-y-3">
                    {/* Mode selector */}
                    <div className="relative">
                      <button
                        onClick={() => { setModeSelectOpen(!modeSelectOpen); setCameraSelectOpen(false); setMicSelectOpen(false) }}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-gray-600">{currentMode?.icon}</span>
                          <span className="text-sm font-medium text-gray-900">{currentMode?.label}</span>
                        </div>
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${modeSelectOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      <AnimatePresence>
                        {modeSelectOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-20 overflow-hidden"
                          >
                            {RECORDING_MODES.map(mode => (
                              <button
                                key={mode.id}
                                onClick={() => { setRecordingMode(mode.id); setModeSelectOpen(false) }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 ${recordingMode === mode.id ? 'bg-gray-50' : ''}`}
                              >
                                <span className="text-gray-500">{mode.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900">{mode.label}</p>
                                  {mode.sublabel && <p className="text-xs text-gray-500">{mode.sublabel}</p>}
                                </div>
                                {recordingMode === mode.id && (
                                  <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Camera selector */}
                    <div className="relative">
                      <button
                        onClick={() => { setCameraSelectOpen(!cameraSelectOpen); setModeSelectOpen(false); setMicSelectOpen(false) }}
                        className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                          <span className="text-sm text-gray-700">
                            {selectedCamera ? cameras.find(c => c.deviceId === selectedCamera)?.label || 'Caméra' : 'Pas de caméra'}
                          </span>
                        </div>
                        {!selectedCamera && cameras.length === 0 && (
                          <span className="text-xs text-red-500 font-medium">Autoriser</span>
                        )}
                      </button>
                      
                      <AnimatePresence>
                        {cameraSelectOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10 max-h-48 overflow-auto"
                          >
                            <button
                              onClick={() => { setSelectedCamera(null); setCameraSelectOpen(false) }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${!selectedCamera ? 'text-gray-900' : 'text-gray-600'}`}
                            >
                              <span>Pas de caméra</span>
                              {!selectedCamera && <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </button>
                            {cameras.map(cam => (
                              <button
                                key={cam.deviceId}
                                onClick={() => { setSelectedCamera(cam.deviceId); setCameraSelectOpen(false) }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${selectedCamera === cam.deviceId ? 'text-gray-900' : 'text-gray-600'}`}
                              >
                                <span className="truncate pr-2">{cam.label}</span>
                                {selectedCamera === cam.deviceId && <svg className="w-4 h-4 text-[#08CF65] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Mic selector */}
                    <div className="relative">
                      <button
                        onClick={() => { setMicSelectOpen(!micSelectOpen); setModeSelectOpen(false); setCameraSelectOpen(false) }}
                        className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                          </svg>
                          <span className="text-sm text-gray-700">
                            {selectedMic ? microphones.find(m => m.deviceId === selectedMic)?.label || 'Micro' : 'Pas de micro'}
                          </span>
                        </div>
                        {!selectedMic && microphones.length === 0 && (
                          <span className="text-xs text-red-500 font-medium">Autoriser</span>
                        )}
                      </button>

                      <AnimatePresence>
                        {micSelectOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10 max-h-48 overflow-auto"
                          >
                            <button
                              onClick={() => { setSelectedMic(null); setMicSelectOpen(false) }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${!selectedMic ? 'text-gray-900' : 'text-gray-600'}`}
                            >
                              <span>Pas de micro</span>
                              {!selectedMic && <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </button>
                            {microphones.map(mic => (
                              <button
                                key={mic.deviceId}
                                onClick={() => { setSelectedMic(mic.deviceId); setMicSelectOpen(false) }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${selectedMic === mic.deviceId ? 'text-gray-900' : 'text-gray-600'}`}
                              >
                                <span className="truncate pr-2">{mic.label}</span>
                                {selectedMic === mic.deviceId && <svg className="w-4 h-4 text-[#08CF65] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Start button */}
                    <button
                      onClick={startRecording}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-[#08CF65] text-white rounded-xl hover:bg-[#07B859] transition-colors font-medium"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Démarrer l&apos;enregistrement
                    </button>

                    {/* How it works */}
                    <button className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Comment ça marche ?
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Recording bar - like drimeclient-main */}
      <AnimatePresence>
        {(isRecording || phase === 'uploading') && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1a1a] rounded-2xl shadow-2xl border border-gray-700">
              {/* Recording indicator */}
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${phase === 'uploading' ? 'bg-blue-500 animate-pulse' : isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-white font-mono text-base min-w-[52px]">{formatTime(recordingTime)}</span>
              </div>

              <div className="w-px h-6 bg-gray-600" />

              {/* Mic indicator */}
              <button className={`p-2 rounded-lg transition-colors ${selectedMic ? 'text-white hover:bg-gray-700' : 'text-gray-500'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  {selectedMic ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 19L5 5m14 0v6a2 2 0 01-2 2H7m0 0v4a6 6 0 006 6m0 0a6 6 0 006-6v-1.5" />
                  )}
                </svg>
              </button>

              {/* Pause/Resume */}
              {phase === 'recording' && (
                <button
                  onClick={togglePause}
                  className="p-2 text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {isPaused ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  )}
                </button>
              )}

              {/* Restart */}
              {phase === 'recording' && (
                <button
                  onClick={cancelRecording}
                  className="p-2 text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Annuler"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>
              )}

              <div className="w-px h-6 bg-gray-600" />

              {/* Stop / Upload status */}
              {phase === 'uploading' ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 rounded-lg">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-white text-sm font-medium">Upload {uploadProgress}%</span>
                </div>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                  Terminer
                </button>
              )}

              {/* Menu */}
              <button className="p-2 text-white hover:bg-gray-700 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>

            {/* Upload progress bar */}
            {phase === 'uploading' && (
              <div className="mt-2 w-full bg-gray-700 rounded-full h-1 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="h-full bg-[#08CF65]"
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
