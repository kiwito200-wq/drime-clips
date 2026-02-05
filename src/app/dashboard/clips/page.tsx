'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Tooltip from '@/components/Tooltip'

interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
}

interface Video {
  id: string
  name: string
  duration: number | null
  width: number | null
  height: number | null
  public: boolean
  createdAt: string
  thumbnailUrl: string | null
  hasActiveUpload: boolean
  uploadProgress: number | null
}

const DRIME_LOGIN_URL = 'https://app.drime.cloud/login'

// Format duration
function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Format date
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return "À l'instant"
  if (minutes < 60) return `Il y a ${minutes}min`
  if (hours < 24) return `Il y a ${hours}h`
  if (days < 7) return `Il y a ${days}j`
  
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// Video Card Component
function VideoCard({ video, onDelete, onCopyLink }: { 
  video: Video
  onDelete: (id: string) => void
  onCopyLink: (id: string) => void
}) {
  const [isHovering, setIsHovering] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Handle hover preview with delay
  const handleMouseEnter = () => {
    setIsHovering(true)
    // Start video preview after a small delay
    if (!video.hasActiveUpload) {
      hoverTimeoutRef.current = setTimeout(() => {
        setShowPreview(true)
      }, 300)
    }
  }

  const handleMouseLeave = () => {
    setIsHovering(false)
    setShowPreview(false)
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    // Pause and reset video
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }

  // Play video when preview is shown
  useEffect(() => {
    if (showPreview && videoRef.current) {
      videoRef.current.play().catch(() => {})
    }
  }, [showPreview])

  const handleCopyLink = () => {
    const url = `${window.location.origin}/v/${video.id}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    onCopyLink(video.id)
  }

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/v/${video.id}`

  return (
    <div 
      className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-[#08CF65] transition-all duration-200"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Thumbnail / Video Preview */}
      <Link href={`/v/${video.id}`} className="block relative aspect-video bg-gray-100">
        {video.hasActiveUpload ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/60">
            <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-white text-sm font-medium">
              {video.uploadProgress !== null ? `${Math.round(video.uploadProgress)}%` : 'Upload...'}
            </span>
          </div>
        ) : (
          <>
            {/* Thumbnail image */}
            {video.thumbnailUrl ? (
              <img 
                src={video.thumbnailUrl} 
                alt={video.name}
                className={`w-full h-full object-cover transition-opacity duration-200 ${showPreview ? 'opacity-0' : 'opacity-100'}`}
              />
            ) : (
              <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 transition-opacity duration-200 ${showPreview ? 'opacity-0' : 'opacity-100'}`}>
                <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            
            {/* Video preview on hover */}
            {(showPreview || isHovering) && (
              <video
                ref={videoRef}
                src={`/api/stream/${video.id}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${showPreview ? 'opacity-100' : 'opacity-0'}`}
                muted
                loop
                playsInline
                preload="none"
              />
            )}
          </>
        )}
        
        {/* Duration badge */}
        {video.duration && !video.hasActiveUpload && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-xs font-medium rounded">
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Hover overlay with actions */}
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center gap-3 transition-opacity duration-200 ${isHovering && !video.hasActiveUpload ? 'opacity-100' : 'opacity-0'}`}>
          {/* Copy link button */}
          <button
            onClick={(e) => { e.preventDefault(); handleCopyLink() }}
            className="p-2.5 bg-white rounded-lg hover:bg-gray-100 transition-colors"
          >
            {copied ? (
              <svg className="w-5 h-5 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            )}
          </button>
          
          {/* Menu button */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.preventDefault(); setShowMenu(!showMenu) }}
              className="p-2.5 bg-white rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[160px] z-20">
                <Link
                  href={`/v/${video.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Voir
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    handleCopyLink()
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copier le lien
                </button>
                <a
                  href={video.thumbnailUrl?.replace('thumbnail.jpg', 'result.mp4') || '#'}
                  download={`${video.name}.mp4`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Télécharger
                </a>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    onDelete(video.id)
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Supprimer
                </button>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-gray-900 truncate">{video.name}</h3>
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
          <span>{formatDate(video.createdAt)}</span>
          {video.width && video.height && (
            <>
              <span>•</span>
              <span>{video.width}×{video.height}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ClipsDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const profileMenuRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch('/api/videos', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setVideos(data.videos || [])
      }
    } catch (error) {
      console.error('Error fetching videos:', error)
    }
  }, [])

  // Auth check
  const checkAuth = useCallback(async () => {
    try {
      const authRes = await fetch('/api/auth/check', { credentials: 'include' })
      if (authRes.ok) {
        const data = await authRes.json()
        if (data.user) {
          setUser(data.user)
          await fetchVideos()
          setLoading(false)
          return
        }
      }
      window.location.href = DRIME_LOGIN_URL
    } catch (error) {
      console.error('[Dashboard] Auth error:', error)
      window.location.href = DRIME_LOGIN_URL
    }
  }, [fetchVideos])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Poll for upload progress
  useEffect(() => {
    const interval = setInterval(() => {
      if (videos.some(v => v.hasActiveUpload)) {
        fetchVideos()
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [videos, fetchVideos])

  const handleDelete = async (videoId: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cette vidéo ?')) return
    
    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setVideos(prev => prev.filter(v => v.id !== videoId))
      }
    } catch (error) {
      console.error('Error deleting video:', error)
    }
  }

  const handleCopyLink = (videoId: string) => {
    // Analytics or any other tracking
    console.log(`Copied link for video ${videoId}`)
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = DRIME_LOGIN_URL
  }

  // Filter videos by search
  const filteredVideos = videos.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Stats
  const stats = {
    total: videos.length,
    uploading: videos.filter(v => v.hasActiveUpload).length,
    public: videos.filter(v => v.public).length,
  }

  if (loading) {
    return (
      <div className="h-screen bg-[#F3F4F6] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600">Chargement...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#F3F4F6] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Tooltip content="Retour à Drime" position="right">
              <a href="https://app.drime.cloud/drive" className="block">
                <img 
                  src="/drime-logo.png" 
                  alt="Drime" 
                  className="h-8 w-auto hover:opacity-80 transition-opacity"
                />
              </a>
            </Tooltip>
            <div className="h-6 w-px bg-gray-300" />
            <span className="text-lg font-semibold text-gray-900">Clips</span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher des clips..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-lg text-sm focus:bg-white focus:border-[#08CF65] focus:ring-2 focus:ring-[#08CF65]/20 transition-all"
              />
            </div>
          </div>

          {/* Profile */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-9 h-9 rounded-full bg-[#E0F5EA] flex items-center justify-center text-sm font-semibold text-[#08CF65] hover:ring-2 hover:ring-[#08CF65]/30 transition-all overflow-hidden"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (user?.name || user?.email || 'U').slice(0, 2).toUpperCase()
              )}
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-50">
                <div className="p-4 border-b border-gray-100">
                  <p className="font-semibold text-gray-900">{user?.name || 'Utilisateur'}</p>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
                <div className="py-2">
                  <a
                    href="https://app.drime.cloud/account-settings"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Paramètres
                  </a>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                    Déconnexion
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Mes Clips
          </h1>
          <p className="text-gray-500 mt-1">
            {stats.total} vidéo{stats.total !== 1 ? 's' : ''} • {stats.uploading > 0 && `${stats.uploading} en cours d'upload`}
          </p>
        </div>

        {/* Video grid */}
        {filteredVideos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {filteredVideos.map(video => (
              <VideoCard 
                key={video.id} 
                video={video}
                onDelete={handleDelete}
                onCopyLink={handleCopyLink}
              />
            ))}
          </div>
        ) : searchQuery ? (
          <div className="flex flex-col items-center justify-center py-16">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">Aucun résultat</h3>
            <p className="text-gray-500 mt-1">Essayez avec d&apos;autres termes de recherche</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">Aucune vidéo</h3>
            <p className="text-gray-500 mt-1 text-center max-w-sm">
              Enregistrez votre premier clip avec l&apos;application Drime Desktop pour le voir ici.
            </p>
            <a
              href="https://drime.cloud/download"
              className="mt-4 px-4 py-2 bg-[#08CF65] text-white font-medium rounded-lg hover:bg-[#07B859] transition-colors"
            >
              Télécharger Drime Desktop
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
