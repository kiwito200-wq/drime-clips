'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import type { ChunkUploadState, RecorderPhase } from './useWebRecorder'

const DRAG_PADDING = 12

const clamp = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(1)} ${units[exponent]}`
}

interface InProgressRecordingBarProps {
  phase: RecorderPhase
  durationMs: number
  hasAudioTrack: boolean
  chunkUploads: ChunkUploadState[]
  onStop: () => void
  onPause?: () => void
  onResume?: () => void
  onRestart?: () => void
}

export const InProgressRecordingBar = ({
  phase,
  durationMs,
  hasAudioTrack,
  chunkUploads,
  onStop,
  onPause,
  onResume,
  onRestart,
}: InProgressRecordingBarProps) => {
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 24 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const initializedPositionRef = useRef(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (!mounted || initializedPositionRef.current) return
    if (typeof window === 'undefined') return

    const raf = window.requestAnimationFrame(() => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const maxX = window.innerWidth - rect.width - DRAG_PADDING
      initializedPositionRef.current = true
      setPosition({
        x: clamp((window.innerWidth - rect.width) / 2, DRAG_PADDING, maxX),
        y: DRAG_PADDING * 2,
      })
    })

    return () => window.cancelAnimationFrame(raf)
  }, [mounted])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      setPosition((prev) => {
        const maxX = window.innerWidth - rect.width - DRAG_PADDING
        const maxY = window.innerHeight - rect.height - DRAG_PADDING
        return {
          x: clamp(prev.x, DRAG_PADDING, maxX),
          y: clamp(prev.y, DRAG_PADDING, maxY),
        }
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handlePointerDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement)?.closest('[data-no-drag]') || event.button !== 0) {
        return
      }

      event.preventDefault()
      setIsDragging(true)
      dragOffsetRef.current = {
        x: event.clientX - position.x,
        y: event.clientY - position.y,
      }
    },
    [position]
  )

  useEffect(() => {
    if (!isDragging || typeof window === 'undefined') return

    const handleMouseMove = (event: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      const width = rect?.width ?? 360
      const height = rect?.height ?? 64
      const maxX = window.innerWidth - width - DRAG_PADDING
      const maxY = window.innerHeight - height - DRAG_PADDING

      setPosition({
        x: clamp(event.clientX - dragOffsetRef.current.x, DRAG_PADDING, maxX),
        y: clamp(event.clientY - dragOffsetRef.current.y, DRAG_PADDING, maxY),
      })
    }

    const handleMouseUp = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  if (!mounted || typeof document === 'undefined') return null

  const isPaused = phase === 'paused'
  const isErrorState = phase === 'error'
  const canStop = (phase === 'recording' || isPaused) && !isErrorState
  const showTimer = (phase === 'recording' || isPaused) && !isErrorState

  const phaseMessages: Partial<Record<RecorderPhase, string>> = {
    recording: 'Enregistrement',
    paused: 'En pause',
    creating: 'Préparation...',
    uploading: 'Upload...',
  }

  const statusText = showTimer ? formatDuration(durationMs) : (phaseMessages[phase] ?? 'Traitement...')

  const completedCount = chunkUploads.filter(c => c.status === 'complete').length
  const totalChunks = chunkUploads.length
  const totalBytes = chunkUploads.reduce((sum, c) => sum + c.sizeBytes, 0)
  const uploadedBytes = chunkUploads.reduce((sum, c) => sum + c.uploadedBytes, 0)

  return createPortal(
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`fixed z-[9999] ${isDragging ? 'cursor-grabbing' : 'cursor-move'}`}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onMouseDown={handlePointerDown}
    >
      <div className="flex items-center rounded-2xl border border-gray-700 bg-[#1a1a1a] text-white shadow-2xl min-w-[380px]">
        {isErrorState ? (
          <div className="flex flex-1 items-center justify-between gap-3 p-3" data-no-drag>
            <div className="flex flex-col text-left">
              <span className="text-sm font-semibold text-red-400">Enregistrement échoué</span>
              <span className="text-xs text-gray-400">Une erreur est survenue</span>
            </div>
            {onRestart && (
              <button
                data-no-drag
                onClick={onRestart}
                className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between flex-1 gap-2 p-1">
            <button
              type="button"
              data-no-drag
              onClick={onStop}
              disabled={!canStop}
              className="py-1.5 px-3 text-red-400 gap-2 flex items-center rounded-lg transition-opacity disabled:opacity-60 hover:bg-gray-800"
            >
              <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
              <span className="font-medium text-sm tabular-nums min-w-[48px]">{statusText}</span>
            </button>

            <div className="flex gap-1 items-center" data-no-drag>
              {totalChunks > 0 && (
                <div className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded-lg text-xs">
                  <div className="relative w-5 h-5">
                    <svg className="w-5 h-5 -rotate-90" viewBox="0 0 36 36">
                      <circle className="fill-none stroke-gray-600" strokeWidth={3} cx="18" cy="18" r="15" />
                      <circle
                        className="fill-none stroke-[#08CF65] transition-all duration-300"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeDasharray={94}
                        strokeDashoffset={94 - (94 * (totalBytes > 0 ? uploadedBytes / totalBytes : completedCount / totalChunks))}
                        cx="18"
                        cy="18"
                        r="15"
                      />
                    </svg>
                  </div>
                  <span className="text-gray-300 tabular-nums">{completedCount}/{totalChunks}</span>
                </div>
              )}

              <div className="flex items-center justify-center w-8 h-8">
                {hasAudioTrack ? (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 19L5 5m14 0v6a2 2 0 01-2 2H7m0 0v4a6 6 0 006 6m0 0a6 6 0 006-6v-1.5" />
                  </svg>
                )}
              </div>

              <button
                data-no-drag
                onClick={isPaused ? onResume : onPause}
                disabled={phase !== 'recording' && phase !== 'paused'}
                className="p-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
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
                data-no-drag
                onClick={onRestart}
                disabled={phase !== 'recording' && phase !== 'paused'}
                className="p-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center px-2 py-3 border-l border-gray-700 text-gray-500">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </div>
      </div>
    </motion.div>,
    document.body
  )
}
