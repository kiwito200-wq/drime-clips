'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useWebRecorder, type RecordingMode } from './useWebRecorder'
import { InProgressRecordingBar } from './InProgressRecordingBar'

interface DeviceInfo {
  deviceId: string
  label: string
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

export default function RecordPage() {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modeSelectOpen, setModeSelectOpen] = useState(false)
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('fullscreen')
  
  const [cameras, setCameras] = useState<DeviceInfo[]>([])
  const [microphones, setMicrophones] = useState<DeviceInfo[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null)
  const [selectedMic, setSelectedMic] = useState<string | null>(null)
  const [cameraSelectOpen, setCameraSelectOpen] = useState(false)
  const [micSelectOpen, setMicSelectOpen] = useState(false)
  const [rememberDevices, setRememberDevices] = useState(false)

  const [openFaq, setOpenFaq] = useState<string | null>(null)

  const handleComplete = useCallback((videoId: string, shareUrl: string) => {
    console.log('[RecordPage] Recording complete, opening share URL:', shareUrl)
    // Open share URL in new tab
    window.open(shareUrl, '_blank', 'noopener,noreferrer')
    // Close dialog and redirect
    setDialogOpen(false)
    router.push('/dashboard/clips')
  }, [router])

  const handleError = useCallback((error: Error) => {
    console.error('[RecordPage] Recording error:', error)
  }, [])

  const {
    phase,
    durationMs,
    hasAudioTrack,
    chunkUploads,
    isRecording,
    isBusy,
    lastError,
    conversionProgress,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    restartRecording,
    cancelRecording,
    resetState,
  } = useWebRecorder({
    recordingMode,
    selectedCameraId: selectedCamera,
    selectedMicId: selectedMic,
    onRecordingStart: () => {
      // Keep dialog open during recording - just log
      console.log('[RecordPage] Recording started')
    },
    onComplete: handleComplete,
    onError: handleError,
  })

  const loadDevices = useCallback(async () => {
    try {
      // Request permissions for both audio and video
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
        // Stop all tracks immediately — we only needed permission
        stream.getTracks().forEach(t => t.stop())
      }).catch(() => {
        // Try audio only if video permission fails
        return navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
          stream.getTracks().forEach(t => t.stop())
        }).catch(() => {})
      })

      const devices = await navigator.mediaDevices.enumerateDevices()
      
      const cams = devices.filter(d => d.kind === 'videoinput').map(d => ({
        deviceId: d.deviceId,
        label: d.label || `Caméra ${d.deviceId.slice(0, 5)}`,
      }))
      const mics = devices.filter(d => d.kind === 'audioinput').map(d => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${d.deviceId.slice(0, 5)}`,
      }))
      
      setCameras(cams)
      setMicrophones(mics)

      // Auto-select default microphone if none selected yet
      if (!selectedMic && mics.length > 0) {
        // Prefer "default" device, otherwise first available
        const defaultMic = mics.find(m => m.deviceId === 'default') || mics[0]
        setSelectedMic(defaultMic.deviceId)
      }
    } catch (error) {
      console.error('Error loading devices:', error)
    }
  }, [selectedMic])

  useEffect(() => {
    if (dialogOpen) loadDevices()
  }, [dialogOpen, loadDevices])

  const handleOpenChange = (open: boolean) => {
    if (!open && isBusy) return
    if (!open) {
      resetState()
      setSettingsOpen(false)
    }
    setDialogOpen(open)
  }

  const closeAllSelects = () => {
    setModeSelectOpen(false)
    setCameraSelectOpen(false)
    setMicSelectOpen(false)
  }

  const openDesktop = () => {
    window.location.href = 'drime://'
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.location.href = '/download'
      }
    }, 1500)
  }

  const currentMode = RECORDING_MODES.find(m => m.id === recordingMode)

  const faqItems = [
    { q: "Qu'est-ce qu'un Clip ?", a: "Un Clip est un enregistrement vidéo rapide de votre écran, caméra ou les deux que vous pouvez partager instantanément." },
    { q: "Comment ça marche ?", a: "L'enregistrement se fait dans votre navigateur et s'upload en temps réel. Une fois terminé, vous êtes redirigé vers votre vidéo." },
    { q: "Quels navigateurs sont recommandés ?", a: "Nous recommandons Google Chrome ou d'autres navigateurs basés sur Chromium." },
    { q: "Comment garder ma webcam visible ?", a: "En mode plein écran, votre webcam s'affiche en picture-in-picture pendant l'enregistrement." },
    { q: "Que puis-je enregistrer ?", a: "Vous pouvez enregistrer votre écran entier, une fenêtre spécifique, un onglet ou juste votre caméra." },
    { q: "Puis-je enregistrer l'audio système ?", a: "L'audio système est limité dans les navigateurs. Pour de meilleurs résultats, utilisez Drime Desktop." },
  ]

  const showRecordingBar = isRecording || phase === 'stopping' || phase === 'converting' || phase === 'uploading' || phase === 'creating' || phase === 'error'

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <p className="text-gray-500">Choisissez comment enregistrer votre Clip</p>
        </div>

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
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-[#08CF65] text-white rounded-xl hover:bg-[#07B859] transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Enregistrer dans le navigateur
          </button>
        </div>

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

      {/* Gray backdrop during recording */}
      <AnimatePresence>
        {(isRecording || isBusy) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dialogOpen && !isRecording && !isBusy && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => !isBusy && handleOpenChange(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-[320px] bg-white rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
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
                          <p className="text-xs text-gray-500 mt-0.5">Sélection automatique</p>
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
                    <div className="relative">
                      <button
                        onClick={() => { closeAllSelects(); setModeSelectOpen(!modeSelectOpen) }}
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

                    <div className="relative">
                      <button
                        onClick={() => { closeAllSelects(); setCameraSelectOpen(!cameraSelectOpen) }}
                        className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                          <span className="text-sm text-gray-700 truncate">
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

                    <div className="relative">
                      <button
                        onClick={() => { closeAllSelects(); setMicSelectOpen(!micSelectOpen) }}
                        className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                          </svg>
                          <span className="text-sm text-gray-700 truncate">
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

                    <button
                      onClick={startRecording}
                      disabled={isBusy}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-[#08CF65] text-white rounded-xl hover:bg-[#07B859] transition-colors font-medium disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Démarrer l&apos;enregistrement
                    </button>

                    <button className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Comment ça marche ?
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRecordingBar && (
          <InProgressRecordingBar
            phase={phase}
            durationMs={durationMs}
            hasAudioTrack={hasAudioTrack}
            chunkUploads={chunkUploads}
            errorMessage={lastError?.message}
            conversionProgress={conversionProgress}
            onStop={stopRecording}
            onPause={pauseRecording}
            onResume={resumeRecording}
            onRestart={restartRecording}
            onCancel={cancelRecording}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
