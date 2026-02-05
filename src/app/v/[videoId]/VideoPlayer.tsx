'use client'

import { useRef, useState, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react'

interface VideoPlayerProps {
  src: string
  poster?: string
  title: string
  onTimeUpdate?: (time: number) => void
  onDurationChange?: (duration: number) => void
}

export interface VideoPlayerRef {
  seek: (time: number) => void
  getCurrentTime: () => number
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

// Tooltip component for player buttons
function PlayerTooltip({ label, visible }: { label: string; visible: boolean }) {
  return (
    <div
      className={`absolute -top-10 left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg transition-all duration-150 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
      }`}
    >
      {label}
    </div>
  )
}

// Player icon button with rounded square hover + tooltip
function PlayerButton({
  onClick,
  tooltip,
  children,
  className = '',
}: {
  onClick: () => void
  tooltip: string
  children: React.ReactNode
  className?: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="relative">
      <PlayerTooltip label={tooltip} visible={hovered} />
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`relative w-9 h-9 flex items-center justify-center rounded-lg text-white transition-all duration-150 hover:bg-white/15 active:scale-95 ${className}`}
      >
        {children}
      </button>
    </div>
  )
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(function VideoPlayer(
  { src, poster, title, onTimeUpdate, onDurationChange },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [isHoveringProgress, setIsHoveringProgress] = useState(false)
  const [hoverProgressX, setHoverProgressX] = useState(0)
  const [hoverTime, setHoverTime] = useState(0)
  const [isDraggingProgress, setIsDraggingProgress] = useState(false)
  const controlsTimeout = useRef<NodeJS.Timeout>()
  const speedMenuTimeout = useRef<NodeJS.Timeout>()

  useImperativeHandle(ref, () => ({
    seek: (time: number) => {
      if (videoRef.current) videoRef.current.currentTime = time
    },
    getCurrentTime: () => currentTime,
  }))

  // Play/pause
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
      if (!hasStarted) setHasStarted(true)
    }
  }, [isPlaying, hasStarted])

  // Update progress
  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const current = videoRef.current.currentTime
    const total = videoRef.current.duration
    setCurrentTime(current)
    setProgress(total > 0 ? (current / total) * 100 : 0)
    onTimeUpdate?.(current)

    // Buffered
    if (videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1)
      setBuffered(total > 0 ? (bufferedEnd / total) * 100 : 0)
    }
  }

  // Seek from progress bar
  const seekFromEvent = useCallback((clientX: number) => {
    if (!videoRef.current || !progressBarRef.current) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const percentage = x / rect.width
    videoRef.current.currentTime = percentage * videoRef.current.duration
  }, [])

  const handleProgressMouseDown = (e: React.MouseEvent) => {
    setIsDraggingProgress(true)
    seekFromEvent(e.clientX)
  }

  useEffect(() => {
    if (!isDraggingProgress) return
    const handleMove = (e: MouseEvent) => seekFromEvent(e.clientX)
    const handleUp = () => setIsDraggingProgress(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [isDraggingProgress, seekFromEvent])

  // Progress hover time preview
  const handleProgressHover = (e: React.MouseEvent) => {
    if (!progressBarRef.current || !videoRef.current) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    setHoverProgressX(x)
    setHoverTime((x / rect.width) * (videoRef.current.duration || 0))
  }

  // Volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (videoRef.current) videoRef.current.volume = val
    setIsMuted(val === 0)
  }

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return
    if (isMuted) {
      videoRef.current.volume = volume || 1
      setIsMuted(false)
    } else {
      videoRef.current.volume = 0
      setIsMuted(true)
    }
  }, [isMuted, volume])

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (isFullscreen) {
      document.exitFullscreen?.()
    } else {
      containerRef.current.requestFullscreen?.()
    }
  }, [isFullscreen])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Playback speed
  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed)
    if (videoRef.current) videoRef.current.playbackRate = speed
    setShowSpeedMenu(false)
  }

  // Show/hide controls on mouse move
  const handleMouseMove = () => {
    setShowControls(true)
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current)
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying && !showSpeedMenu) setShowControls(false)
    }, 3000)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          if (videoRef.current) videoRef.current.currentTime -= 5
          break
        case 'ArrowRight':
          if (videoRef.current) videoRef.current.currentTime += 5
          break
        case 'ArrowUp':
          e.preventDefault()
          if (videoRef.current) {
            const v = Math.min(1, videoRef.current.volume + 0.1)
            videoRef.current.volume = v
            setVolume(v)
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (videoRef.current) {
            const v = Math.max(0, videoRef.current.volume - 0.1)
            videoRef.current.volume = v
            setVolume(v)
          }
          break
        case 'KeyM':
          toggleMute()
          break
        case 'KeyF':
          toggleFullscreen()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, toggleMute, toggleFullscreen])

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Close speed menu on outside click
  useEffect(() => {
    if (!showSpeedMenu) return
    const handler = () => setShowSpeedMenu(false)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [showSpeedMenu])

  const controlsVisible = showControls || !isPlaying || isDraggingProgress

  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-black group select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (isPlaying && !showSpeedMenu) setShowControls(false)
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        onPlay={() => { setIsPlaying(true); if (!hasStarted) setHasStarted(true) }}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            const dur = videoRef.current.duration
            if (isFinite(dur) && dur > 0) {
              setDuration(dur)
              onDurationChange?.(dur)
            }
            setIsLoading(false)
          }
        }}
        onDurationChange={() => {
          if (videoRef.current) {
            const dur = videoRef.current.duration
            if (isFinite(dur) && dur > 0 && dur !== duration) {
              setDuration(dur)
              onDurationChange?.(dur)
            }
          }
        }}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onEnded={() => {
          setIsPlaying(false)
          setShowControls(true)
        }}
        preload="metadata"
        playsInline
      />

      {/* Loading spinner */}
      {isLoading && hasStarted && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* ─── Big Play Button (Loom style) ─── */}
      {!isPlaying && !isLoading && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center group/play"
        >
          {/* Outer ring with pulse animation */}
          <div className="relative">
            {/* Pulse ring */}
            {!hasStarted && (
              <div className="absolute inset-0 w-[88px] h-[88px] -m-[4px] rounded-full border-2 border-white/30 animate-ping" style={{ animationDuration: '2s' }} />
            )}
            {/* Main button */}
            <div className="relative w-20 h-20 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-2xl ring-4 ring-white/20 group-hover/play:ring-white/40 group-hover/play:scale-110 group-active/play:scale-100 transition-all duration-300 ease-out">
              <svg className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </button>
      )}

      {/* ─── Controls overlay ─── */}
      <div
        className={`absolute inset-x-0 bottom-0 transition-all duration-300 ${
          controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        {/* Gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

        <div className="relative px-4 pb-4 pt-16">
          {/* ─── Progress bar ─── */}
          <div
            ref={progressBarRef}
            className="relative h-1.5 mb-3 cursor-pointer group/progress"
            onMouseDown={handleProgressMouseDown}
            onMouseEnter={() => setIsHoveringProgress(true)}
            onMouseLeave={() => setIsHoveringProgress(false)}
            onMouseMove={handleProgressHover}
          >
            {/* Track bg */}
            <div className="absolute inset-0 bg-white/20 rounded-full overflow-hidden">
              {/* Buffered */}
              <div className="absolute inset-y-0 left-0 bg-white/20 rounded-full transition-all" style={{ width: `${buffered}%` }} />
              {/* Progress */}
              <div className="absolute inset-y-0 left-0 bg-[#08CF65] rounded-full transition-[width] duration-75" style={{ width: `${progress}%` }} />
            </div>
            {/* Hover expand */}
            <div className={`absolute inset-0 rounded-full transition-transform duration-150 origin-bottom ${isHoveringProgress || isDraggingProgress ? 'scale-y-[2]' : 'scale-y-100'}`} />
            {/* Scrubber dot */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[#08CF65] rounded-full shadow-lg transition-all duration-150 ${
                isHoveringProgress || isDraggingProgress ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
              }`}
              style={{ left: `calc(${progress}% - 8px)` }}
            />
            {/* Hover time tooltip */}
            {isHoveringProgress && !isDraggingProgress && (
              <div
                className="absolute -top-8 pointer-events-none bg-gray-900 text-white text-xs font-medium px-2 py-1 rounded-md"
                style={{ left: hoverProgressX, transform: 'translateX(-50%)' }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>

          {/* ─── Controls row ─── */}
          <div className="flex items-center gap-1">
            {/* Play/Pause */}
            <PlayerButton onClick={togglePlay} tooltip={isPlaying ? 'Pause (Espace)' : 'Lecture (Espace)'}>
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </PlayerButton>

            {/* Volume */}
            <div className="flex items-center gap-0 group/volume">
              <PlayerButton onClick={toggleMute} tooltip={isMuted ? 'Activer le son (M)' : 'Couper le son (M)'}>
                {isMuted || volume === 0 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : volume < 0.5 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </PlayerButton>
              <div className="w-0 group-hover/volume:w-20 overflow-hidden transition-all duration-200 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="volume-slider w-full"
                />
              </div>
            </div>

            {/* Time */}
            <span className="text-white/80 text-sm font-medium tabular-nums ml-1">
              {formatTime(currentTime)}
              <span className="text-white/40 mx-1">/</span>
              {formatTime(duration)}
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Speed control */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <PlayerButton
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                tooltip="Vitesse de lecture"
              >
                <span className="text-xs font-bold">{playbackSpeed === 1 ? '1x' : `${playbackSpeed}x`}</span>
              </PlayerButton>
              {showSpeedMenu && (
                <div
                  className="absolute bottom-full mb-2 right-0 bg-gray-900/95 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl py-1.5 min-w-[120px] animate-in fade-in slide-in-from-bottom-2 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => changeSpeed(speed)}
                      className={`w-full px-4 py-2 text-sm font-medium text-left transition-colors flex items-center justify-between ${
                        playbackSpeed === speed
                          ? 'text-[#08CF65] bg-white/5'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span>{speed}x</span>
                      {playbackSpeed === speed && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Settings */}
            <PlayerButton onClick={() => {}} tooltip="Paramètres">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </PlayerButton>

            {/* PiP */}
            <PlayerButton
              onClick={() => {
                if (videoRef.current) {
                  if (document.pictureInPictureElement) {
                    document.exitPictureInPicture()
                  } else {
                    videoRef.current.requestPictureInPicture?.()
                  }
                }
              }}
              tooltip="Picture-in-Picture"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h6a2 2 0 012 2v6a2 2 0 01-2 2h-6a2 2 0 01-2-2V9a2 2 0 012-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5.5A1.5 1.5 0 014.5 4h15A1.5 1.5 0 0121 5.5v13a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5v-13z" />
              </svg>
            </PlayerButton>

            {/* Fullscreen */}
            <PlayerButton onClick={toggleFullscreen} tooltip={isFullscreen ? 'Quitter plein écran (F)' : 'Plein écran (F)'}>
              {isFullscreen ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              )}
            </PlayerButton>
          </div>
        </div>
      </div>
    </div>
  )
})

export default VideoPlayer
