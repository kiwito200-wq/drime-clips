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

const LOOM_SPEEDS = [0.8, 1, 1.2, 1.5, 1.7, 2, 2.5]

// Tooltip with smart edge-aware positioning
function PlayerTooltip({ label, visible, align = 'center' }: { label: string; visible: boolean; align?: 'left' | 'center' | 'right' }) {
  const positionClass = align === 'left' ? 'left-0' : align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'
  return (
    <div
      className={`absolute -top-10 ${positionClass} pointer-events-none whitespace-nowrap bg-black text-white text-[11px] font-medium px-2.5 py-1.5 rounded-md shadow-lg transition-all duration-150 z-50 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
      }`}
    >
      {label}
    </div>
  )
}

// Player button with rounded square hover + tooltip
function PlayerButton({
  onClick,
  tooltip,
  tooltipAlign = 'center',
  children,
  className = '',
}: {
  onClick: () => void
  tooltip: string
  tooltipAlign?: 'left' | 'center' | 'right'
  children: React.ReactNode
  className?: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="relative">
      <PlayerTooltip label={tooltip} visible={hovered} align={tooltipAlign} />
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

// Format seconds to human-readable duration
function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0 sec'
  if (seconds < 60) return `${Math.round(seconds)} sec`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins} min`
  const hours = Math.floor(mins / 60)
  const remainMins = mins % 60
  return `${hours}h ${remainMins}m`
}

// Speed emoji based on speed
function getSpeedEmoji(speed: number): string {
  if (speed <= 0.8) return '🐢'
  if (speed <= 1) return ''
  if (speed <= 1.5) return '⚡'
  if (speed <= 2) return '🔥'
  return '🚀'
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
  const [prevSpeed, setPrevSpeed] = useState(1)
  const [speedAnimating, setSpeedAnimating] = useState(false)
  const [isHoveringProgress, setIsHoveringProgress] = useState(false)
  const [hoverProgressX, setHoverProgressX] = useState(0)
  const [hoverTime, setHoverTime] = useState(0)
  const [isDraggingProgress, setIsDraggingProgress] = useState(false)
  const [isHoveringCenter, setIsHoveringCenter] = useState(false)
  const controlsTimeout = useRef<NodeJS.Timeout>()

  useImperativeHandle(ref, () => ({
    seek: (time: number) => {
      if (videoRef.current) videoRef.current.currentTime = time
    },
    getCurrentTime: () => currentTime,
  }))

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
      if (!hasStarted) setHasStarted(true)
    }
  }, [isPlaying, hasStarted])

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const current = videoRef.current.currentTime
    const total = videoRef.current.duration
    setCurrentTime(current)
    setProgress(total > 0 ? (current / total) * 100 : 0)
    onTimeUpdate?.(current)
    if (videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1)
      setBuffered(total > 0 ? (bufferedEnd / total) * 100 : 0)
    }
  }

  const seekFromEvent = useCallback((clientX: number) => {
    if (!videoRef.current || !progressBarRef.current) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    videoRef.current.currentTime = (x / rect.width) * videoRef.current.duration
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
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp) }
  }, [isDraggingProgress, seekFromEvent])

  const handleProgressHover = (e: React.MouseEvent) => {
    if (!progressBarRef.current || !videoRef.current) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    setHoverProgressX(x)
    setHoverTime((x / rect.width) * (videoRef.current.duration || 0))
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (videoRef.current) videoRef.current.volume = val
    setIsMuted(val === 0)
  }

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return
    if (isMuted) { videoRef.current.volume = volume || 1; setIsMuted(false) }
    else { videoRef.current.volume = 0; setIsMuted(true) }
  }, [isMuted, volume])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (isFullscreen) document.exitFullscreen?.()
    else containerRef.current.requestFullscreen?.()
  }, [isFullscreen])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const changeSpeed = (speed: number) => {
    if (speed === playbackSpeed) return
    setPrevSpeed(playbackSpeed)
    setPlaybackSpeed(speed)
    setSpeedAnimating(true)
    if (videoRef.current) videoRef.current.playbackRate = speed
    setTimeout(() => setSpeedAnimating(false), 600)
  }

  const handleMouseMove = () => {
    setShowControls(true)
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current)
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 3000)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.code) {
        case 'Space': e.preventDefault(); togglePlay(); break
        case 'ArrowLeft': if (videoRef.current) videoRef.current.currentTime -= 5; break
        case 'ArrowRight': if (videoRef.current) videoRef.current.currentTime += 5; break
        case 'ArrowUp': e.preventDefault(); if (videoRef.current) { const v = Math.min(1, videoRef.current.volume + 0.1); videoRef.current.volume = v; setVolume(v) }; break
        case 'ArrowDown': e.preventDefault(); if (videoRef.current) { const v = Math.max(0, videoRef.current.volume - 0.1); videoRef.current.volume = v; setVolume(v) }; break
        case 'KeyM': toggleMute(); break
        case 'KeyF': toggleFullscreen(); break
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

  const controlsVisible = showControls || !isPlaying || isDraggingProgress

  // Effective duration at current speed
  const effectiveDuration = duration > 0 ? duration / playbackSpeed : 0
  const prevEffectiveDuration = duration > 0 ? duration / prevSpeed : 0
  const speedEmoji = getSpeedEmoji(playbackSpeed)

  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-black group select-none overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { if (isPlaying) setShowControls(false) }}
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
            if (isFinite(dur) && dur > 0) { setDuration(dur); onDurationChange?.(dur) }
            setIsLoading(false)
          }
        }}
        onDurationChange={() => {
          if (videoRef.current) {
            const dur = videoRef.current.duration
            if (isFinite(dur) && dur > 0 && dur !== duration) { setDuration(dur); onDurationChange?.(dur) }
          }
        }}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onEnded={() => { setIsPlaying(false); setShowControls(true) }}
        preload="metadata"
        playsInline
      />

      {/* Loading spinner */}
      {isLoading && hasStarted && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* ─── Center overlay: Play + Speed + Duration (Loom style) ─── */}
      {!isPlaying && !isLoading && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          onMouseEnter={() => setIsHoveringCenter(true)}
          onMouseLeave={() => setIsHoveringCenter(false)}
        >
          {/* Play button */}
          <button onClick={togglePlay} className="group/play mb-5 relative">
            {!hasStarted && (
              <div className="absolute inset-[-6px] rounded-full border-2 border-white/25 animate-ping" style={{ animationDuration: '2s' }} />
            )}
            <div className="relative w-20 h-20 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-2xl ring-[3px] ring-white/20 group-hover/play:ring-white/40 group-hover/play:scale-110 group-active/play:scale-95 transition-all duration-300 ease-out">
              <svg className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </button>

          {/* Speed selector row */}
          <div
            className={`flex items-center gap-1 bg-black/60 backdrop-blur-md rounded-full px-3 py-2 transition-all duration-300 ${
              isHoveringCenter ? 'opacity-100 translate-y-0' : 'opacity-90 translate-y-0'
            }`}
          >
            {LOOM_SPEEDS.map((speed) => (
              <button
                key={speed}
                onClick={(e) => { e.stopPropagation(); changeSpeed(speed) }}
                className="relative px-1 py-0.5 transition-all duration-200 group/speed"
              >
                <span
                  className={`text-sm tabular-nums transition-all duration-200 ${
                    playbackSpeed === speed
                      ? 'text-white font-bold text-base'
                      : 'text-white/50 font-medium hover:text-white/80'
                  }`}
                >
                  {speed === 1 ? '1x' : `${speed}x`}
                </span>
              </button>
            ))}
          </div>

          {/* Duration display with speed animation */}
          <div className="mt-2.5 flex items-center justify-center gap-2 bg-black/60 backdrop-blur-md rounded-full px-4 py-1.5 min-w-[100px]">
            {speedAnimating && playbackSpeed !== 1 ? (
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-sm line-through tabular-nums">
                  {formatDuration(prevEffectiveDuration)}
                </span>
                {speedEmoji && <span className="text-sm">{speedEmoji}</span>}
                <span className="text-white text-sm font-semibold tabular-nums animate-pulse">
                  {formatDuration(effectiveDuration)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {playbackSpeed !== 1 && speedEmoji && <span className="text-sm">{speedEmoji}</span>}
                <span className="text-white text-sm font-medium tabular-nums">
                  {formatDuration(effectiveDuration)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Bottom Controls overlay ─── */}
      <div
        className={`absolute inset-x-0 bottom-0 transition-all duration-300 ${
          controlsVisible && hasStarted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

        <div className="relative px-4 pb-3 pt-14">
          {/* Progress bar */}
          <div
            ref={progressBarRef}
            className="relative h-1 mb-3 cursor-pointer group/progress"
            onMouseDown={handleProgressMouseDown}
            onMouseEnter={() => setIsHoveringProgress(true)}
            onMouseLeave={() => setIsHoveringProgress(false)}
            onMouseMove={handleProgressHover}
          >
            <div className={`absolute inset-0 bg-white/20 rounded-full overflow-hidden transition-transform duration-150 origin-bottom ${isHoveringProgress || isDraggingProgress ? 'scale-y-[2.5]' : ''}`}>
              <div className="absolute inset-y-0 left-0 bg-white/15 rounded-full" style={{ width: `${buffered}%` }} />
              <div className="absolute inset-y-0 left-0 bg-[#08CF65] rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-[#08CF65] rounded-full shadow-lg transition-all duration-100 ${
                isHoveringProgress || isDraggingProgress ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              }`}
              style={{ left: `calc(${progress}% - 7px)` }}
            />
            {isHoveringProgress && !isDraggingProgress && (
              <div
                className="absolute -top-8 pointer-events-none bg-black text-white text-[11px] font-medium px-2 py-1 rounded-md"
                style={{ left: hoverProgressX, transform: 'translateX(-50%)' }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-0.5">
            <PlayerButton onClick={togglePlay} tooltip={isPlaying ? 'Pause (Espace)' : 'Lecture (Espace)'} tooltipAlign="left">
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </PlayerButton>

            {/* Volume */}
            <div className="flex items-center gap-0 group/volume">
              <PlayerButton onClick={toggleMute} tooltip={isMuted ? 'Activer le son (M)' : 'Couper le son (M)'}>
                {isMuted || volume === 0 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                ) : volume < 0.5 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                )}
              </PlayerButton>
              <div className="w-0 group-hover/volume:w-20 overflow-hidden transition-all duration-200 flex items-center">
                <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="volume-slider w-full" />
              </div>
            </div>

            {/* Time */}
            <span className="text-white/80 text-[13px] font-medium tabular-nums ml-1">
              {formatTime(currentTime)}
              <span className="text-white/35 mx-0.5">/</span>
              {formatTime(duration)}
            </span>

            <div className="flex-1" />

            {/* Speed indicator in bar */}
            <PlayerButton onClick={() => {
              const currentIdx = LOOM_SPEEDS.indexOf(playbackSpeed)
              const nextIdx = (currentIdx + 1) % LOOM_SPEEDS.length
              changeSpeed(LOOM_SPEEDS[nextIdx])
            }} tooltip={`Vitesse: ${playbackSpeed}x`}>
              <span className={`text-xs font-bold ${playbackSpeed !== 1 ? 'text-[#08CF65]' : ''}`}>
                {playbackSpeed}x
              </span>
            </PlayerButton>

            {/* PiP */}
            <PlayerButton
              onClick={() => {
                if (videoRef.current) {
                  if (document.pictureInPictureElement) document.exitPictureInPicture()
                  else videoRef.current.requestPictureInPicture?.()
                }
              }}
              tooltip="Picture-in-Picture"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <rect x="11" y="8" width="9" height="7" rx="1.5" fill="currentColor" opacity="0.3" />
              </svg>
            </PlayerButton>

            {/* Fullscreen */}
            <PlayerButton onClick={toggleFullscreen} tooltip={isFullscreen ? 'Quitter plein écran (F)' : 'Plein écran (F)'} tooltipAlign="right">
              {isFullscreen ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
              )}
            </PlayerButton>
          </div>
        </div>
      </div>
    </div>
  )
})

export default VideoPlayer
