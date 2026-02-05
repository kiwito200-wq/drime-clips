'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

type RecordingMode = 'fullscreen' | 'window' | 'camera'

interface DeviceInfo {
  deviceId: string
  label: string
}

export default function RecordPage() {
  const [recorderOpen, setRecorderOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
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
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

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

  // Start recording
  const startRecording = async () => {
    try {
      let stream: MediaStream

      if (recordingMode === 'camera') {
        stream = await navigator.mediaDevices.getUserMedia({
          video: selectedCamera ? { deviceId: selectedCamera } : true,
          audio: selectedMic ? { deviceId: selectedMic } : true,
        })
      } else {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: recordingMode === 'window' ? 'window' : 'monitor' } as any,
          audio: true,
        })

        if (selectedMic) {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: selectedMic },
          })
          const audioTracks = audioStream.getAudioTracks()
          audioTracks.forEach(track => displayStream.addTrack(track))
        }

        stream = displayStream
      }

      streamRef.current = stream
      chunksRef.current = []

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
      })

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        await uploadRecording(blob)
        cleanup()
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000)

      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      stream.getTracks().forEach(track => {
        track.onended = () => stopRecording()
      })
    } catch (error) {
      console.error('Error starting recording:', error)
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
    setRecorderOpen(false)
  }

  // Upload recording
  const uploadRecording = async (blob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('file', blob, `recording-${Date.now()}.webm`)
      
      const res = await fetch('/api/upload/web-recording', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        window.location.href = `/v/${data.videoId}`
      }
    } catch (error) {
      console.error('Error uploading recording:', error)
    }
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
    {
      q: "Qu'est-ce qu'un Clip ?",
      a: "Un Clip est un enregistrement vidéo rapide de votre écran, caméra ou les deux que vous pouvez partager instantanément avec un lien.",
    },
    {
      q: "Comment ça marche ?",
      a: "L'enregistrement se fait directement dans votre navigateur. Une fois terminé, la vidéo est uploadée et vous recevez un lien de partage.",
    },
    {
      q: "Quels navigateurs sont recommandés ?",
      a: "Nous recommandons Google Chrome ou d'autres navigateurs basés sur Chromium pour la meilleure expérience.",
    },
    {
      q: "Comment garder ma webcam visible ?",
      a: "En mode plein écran, votre webcam s'affiche dans une fenêtre picture-in-picture qui reste visible pendant l'enregistrement.",
    },
    {
      q: "Que puis-je enregistrer ?",
      a: "Vous pouvez enregistrer votre écran entier, une fenêtre spécifique, un onglet ou juste votre caméra.",
    },
    {
      q: "Puis-je enregistrer l'audio système ?",
      a: "L'audio système est limité dans les navigateurs. Pour de meilleurs résultats, utilisez Drime Desktop.",
    },
    {
      q: "Dois-je installer l'application ?",
      a: "Non, vous pouvez enregistrer directement dans votre navigateur. Pour des enregistrements plus longs et des fonctionnalités avancées, utilisez Drime Desktop.",
    },
  ]

  const [openFaq, setOpenFaq] = useState<string | null>(null)

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
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[300px]"
            >
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Header with dots */}
                <div className="flex items-center justify-between p-4 pb-0">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
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
                  /* Settings Panel */
                  <div className="p-4">
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
                          <p className="text-xs text-gray-500 mt-0.5">La dernière caméra/micro sera sélectionnée automatiquement</p>
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
                  /* Main recorder UI */
                  <div className="p-4 space-y-3">
                    {/* Plan badge */}
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">Free</span>
                    </div>

                    {/* Mode selector */}
                    <button
                      className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-900">Plein écran</span>
                    </button>

                    {/* Camera selector */}
                    <div className="relative">
                      <button
                        onClick={() => { setCameraSelectOpen(!cameraSelectOpen); setMicSelectOpen(false) }}
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
                        {!selectedCamera && cameras.length > 0 && (
                          <span className="text-xs text-red-500 font-medium">Autoriser</span>
                        )}
                      </button>
                      
                      <AnimatePresence>
                        {cameraSelectOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10"
                          >
                            <button
                              onClick={() => { setSelectedCamera(null); setCameraSelectOpen(false) }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${!selectedCamera ? 'text-gray-900' : 'text-gray-600'}`}
                            >
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                                </svg>
                                Pas de caméra
                              </div>
                              {!selectedCamera && <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </button>
                            {cameras.map(cam => (
                              <button
                                key={cam.deviceId}
                                onClick={() => { setSelectedCamera(cam.deviceId); setCameraSelectOpen(false) }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${selectedCamera === cam.deviceId ? 'text-gray-900' : 'text-gray-600'}`}
                              >
                                <span className="truncate">{cam.label}</span>
                                {selectedCamera === cam.deviceId && <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Mic selector */}
                    <div className="relative">
                      <button
                        onClick={() => { setMicSelectOpen(!micSelectOpen); setCameraSelectOpen(false) }}
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
                        {!selectedMic && microphones.length > 0 && (
                          <span className="text-xs text-red-500 font-medium">Autoriser</span>
                        )}
                      </button>

                      <AnimatePresence>
                        {micSelectOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10"
                          >
                            <button
                              onClick={() => { setSelectedMic(null); setMicSelectOpen(false) }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${!selectedMic ? 'text-gray-900' : 'text-gray-600'}`}
                            >
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                                </svg>
                                Pas de micro
                              </div>
                              {!selectedMic && <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </button>
                            {microphones.map(mic => (
                              <button
                                key={mic.deviceId}
                                onClick={() => { setSelectedMic(mic.deviceId); setMicSelectOpen(false) }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 ${selectedMic === mic.deviceId ? 'text-gray-900' : 'text-gray-600'}`}
                              >
                                <span className="truncate">{mic.label}</span>
                                {selectedMic === mic.deviceId && <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
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

      {/* Recording bar */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-4 px-5 py-3 bg-gray-900 rounded-2xl shadow-2xl">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-white font-mono text-lg">{formatTime(recordingTime)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePause}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
                
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                  Arrêter
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
