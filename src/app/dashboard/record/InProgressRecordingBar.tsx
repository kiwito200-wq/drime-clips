'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ChunkUploadState, RecorderPhase } from './useWebRecorder'

const DRIME_GREEN = '#08CF65'

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

interface InProgressRecordingBarProps {
  phase: RecorderPhase
  durationMs: number
  hasAudioTrack: boolean
  chunkUploads: ChunkUploadState[]
  errorMessage?: string | null
  onStop: () => void
  onPause?: () => void
  onResume?: () => void
  onRestart?: () => void
  onDelete?: () => void
}

export const InProgressRecordingBar = ({
  phase,
  durationMs,
  hasAudioTrack,
  chunkUploads,
  errorMessage,
  onStop,
  onPause,
  onResume,
  onRestart,
  onDelete,
}: InProgressRecordingBarProps) => {
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 24 })
  const [isDragging, setIsDragging] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    // Center the bar on mount
    if (typeof window !== 'undefined') {
      const timeout = setTimeout(() => {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          setPosition({
            x: (window.innerWidth - rect.width) / 2,
            y: 24,
          })
        }
      }, 50)
      return () => clearTimeout(timeout)
    }
  }, [])

  // Handle drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag from the drag handle
    if (!(e.target as HTMLElement).closest('[data-drag-handle]')) return
    
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    }
  }, [position])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const newX = e.clientX - dragStartRef.current.x
      const newY = e.clientY - dragStartRef.current.y

      setPosition({
        x: Math.max(12, Math.min(newX, window.innerWidth - rect.width - 12)),
        y: Math.max(12, Math.min(newY, window.innerHeight - rect.height - 12)),
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
  const isRecording = phase === 'recording'
  const isError = phase === 'error'
  const isUploading = phase === 'uploading' || phase === 'creating'
  
  // Show saving state when stopping
  const showSaving = isSaving || isUploading

  const handleStopClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (isSaving) return
    setIsSaving(true)
    
    try {
      onStop()
    } catch (err) {
      console.error('[RecordingBar] Error calling onStop:', err)
      setIsSaving(false)
    }
  }

  const handlePauseClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('[RecordingBar] Pause/Resume clicked, isPaused:', isPaused)
    if (isPaused) {
      onResume?.()
    } else {
      onPause?.()
    }
  }

  const handleRestartClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('[RecordingBar] Restart clicked')
    onRestart?.()
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('[RecordingBar] Delete clicked')
    onDelete?.()
  }

  // Calculate upload progress
  const completedChunks = chunkUploads.filter(c => c.status === 'complete').length
  const totalChunks = chunkUploads.length
  const hasChunks = totalChunks > 0

  return createPortal(
    <div
      ref={containerRef}
      className="fixed z-[9999] select-none"
      style={{ left: position.x, top: position.y }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-center gap-1 px-2 py-1.5 bg-white rounded-full border border-gray-200 shadow-lg">
        {showSaving ? (
          // Saving/Uploading state
          <div className="flex items-center gap-2 px-3 py-1">
            <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: DRIME_GREEN }} />
            <span className="text-sm font-semibold text-gray-600">
              {isUploading ? 'Upload...' : 'Enregistrement...'}
            </span>
            {hasChunks && (
              <span className="text-xs text-gray-400">{completedChunks}/{totalChunks}</span>
            )}
            <LoadingSpinner className="w-4 h-4 text-gray-400" />
          </div>
        ) : isError ? (
          // Error state
          <div className="flex items-center gap-2 px-3 py-1">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
            <span className="text-sm font-semibold text-red-500">Erreur</span>
            <span className="text-xs text-gray-500 max-w-[200px] truncate">{errorMessage}</span>
            {onRestart && (
              <IconButton onClick={handleRestartClick} tooltip="Réessayer">
                <RestartIcon className="w-4 h-4" />
              </IconButton>
            )}
          </div>
        ) : (
          <>
            {/* Stop button with timer */}
            <button
              type="button"
              onClick={handleStopClick}
              className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full hover:bg-red-50 transition-colors group"
            >
              {/* Recording indicator with ping animation */}
              <div className="relative flex items-center justify-center">
                {!isPaused && (
                  <span className="absolute w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75" />
                )}
                <span className={`relative w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500'}`} />
              </div>
              <span className="text-sm font-semibold text-red-500 tabular-nums min-w-[3ch]">
                {formatDuration(durationMs)}
              </span>
            </button>

            {/* Separator */}
            <div className="w-px h-5 bg-gray-200" />

            {/* Microphone indicator */}
            <div className="relative flex items-center">
              <IconButton tooltip={hasAudioTrack ? 'Micro actif' : 'Pas de micro'}>
                {hasAudioTrack ? (
                  <MicIcon className="w-4 h-4" />
                ) : (
                  <MutedIcon className="w-4 h-4" />
                )}
              </IconButton>
            </div>

            {/* Pause/Resume button */}
            <IconButton 
              onClick={handlePauseClick}
              tooltip={isPaused ? 'Reprendre' : 'Pause'}
              active={isPaused}
            >
              {isPaused ? (
                <PlayIcon className="w-4 h-4" />
              ) : (
                <PauseIcon className="w-4 h-4" />
              )}
            </IconButton>

            {/* Restart button */}
            {onRestart && (
              <IconButton onClick={handleRestartClick} tooltip="Recommencer">
                <RestartIcon className="w-4 h-4" />
              </IconButton>
            )}

            {/* Delete button */}
            {onDelete && (
              <IconButton onClick={handleDeleteClick} tooltip="Annuler" variant="danger">
                <DeleteIcon className="w-4 h-4" />
              </IconButton>
            )}

            {/* Upload progress indicator */}
            {hasChunks && (
              <>
                <div className="w-px h-5 bg-gray-200" />
                <div className="flex items-center gap-1 px-2 text-xs text-gray-500">
                  <UploadIcon className="w-3.5 h-3.5" />
                  <span className="tabular-nums">{completedChunks}/{totalChunks}</span>
                </div>
              </>
            )}

            {/* Separator */}
            <div className="w-px h-5 bg-gray-200" />

            {/* Drag handle */}
            <div
              data-drag-handle
              className={`p-1.5 rounded-full text-gray-400 transition-colors ${isDragging ? 'cursor-grabbing bg-gray-100' : 'cursor-grab hover:bg-gray-100'}`}
            >
              <DragIcon className="w-4 h-4" />
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// Icon Button Component
function IconButton({
  children,
  onClick,
  active = false,
  tooltip,
  variant = 'default',
}: {
  children: React.ReactNode
  onClick?: (e: React.MouseEvent) => void
  active?: boolean
  tooltip?: string
  variant?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      className={`p-1.5 rounded-full transition-colors ${
        variant === 'danger'
          ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
          : active
            ? 'bg-gray-100 text-gray-700'
            : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

// Icons
function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function MutedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function RestartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  )
}

function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function DragIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}
