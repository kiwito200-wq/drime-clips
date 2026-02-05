'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

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
  viewCount?: number
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

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

// Sharing Modal Component
function SharingModal({ 
  video, 
  isOpen, 
  onClose, 
  onUpdate 
}: { 
  video: Video
  isOpen: boolean
  onClose: () => void
  onUpdate: (video: Video) => void
}) {
  const [activeTab, setActiveTab] = useState<'share' | 'embed'>('share')
  const [isPublic, setIsPublic] = useState(video.public)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [embedCopied, setEmbedCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsPublic(video.public)
      setActiveTab('share')
    }
  }, [isOpen, video.public])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public: isPublic }),
      })
      if (res.ok) {
        onUpdate({ ...video, public: isPublic })
        onClose()
      }
    } catch (error) {
      console.error('Error updating video:', error)
    } finally {
      setSaving(false)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/v/${video.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyEmbed = () => {
    const embedCode = `<iframe src="${window.location.origin}/embed/${video.id}" frameborder="0" allowfullscreen style="width:100%;aspect-ratio:16/9;"></iframe>`
    navigator.clipboard.writeText(embedCode)
    setEmbedCopied(true)
    setTimeout(() => setEmbedCopied(false), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">Partager {video.name}</h2>
              <p className="text-sm text-gray-500">Sélectionnez comment partager cette vidéo</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('share')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'share' 
                ? 'text-gray-900 border-b-2 border-gray-900' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Partager
          </button>
          <button
            onClick={() => setActiveTab('embed')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'embed' 
                ? 'text-gray-900 border-b-2 border-gray-900' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Intégrer
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {activeTab === 'share' ? (
            <>
              {/* Public toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Tout le monde avec le lien</p>
                    <p className="text-xs text-gray-500">
                      {isPublic ? 'N\'importe qui avec le lien peut voir' : 'Seules les personnes avec accès peuvent voir'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? 'bg-[#08CF65]' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {/* Copy link */}
              {isPublic && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/v/${video.id}`}
                    className="flex-1 bg-transparent text-sm text-gray-600 outline-none truncate"
                  />
                  <button
                    onClick={copyLink}
                    className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    {copied ? 'Copié !' : 'Copier'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <code className="text-xs text-gray-600 break-all">
                  {`<iframe src="${window.location.origin}/embed/${video.id}" frameborder="0" allowfullscreen style="width:100%;aspect-ratio:16/9;"></iframe>`}
                </code>
              </div>
              <button
                onClick={copyEmbed}
                className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                {embedCopied ? 'Copié !' : 'Copier le code d\'intégration'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'share' && (
          <div className="px-5 pb-5 pt-2 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function VideoCard({ video, onDelete, onShare, onUpdate }: { 
  video: Video
  onDelete: (id: string) => void
  onShare: (video: Video) => void
  onUpdate: (video: Video) => void
}) {
  const [isHovering, setIsHovering] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleMouseEnter = () => {
    setIsHovering(true)
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
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }

  useEffect(() => {
    if (showPreview && videoRef.current) {
      videoRef.current.play().catch(() => {})
    }
  }, [showPreview])

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const url = `${window.location.origin}/v/${video.id}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div 
      className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link href={`/v/${video.id}`} className="block relative aspect-video bg-gray-100">
        {video.hasActiveUpload ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-600">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-white text-sm font-medium">
              {video.uploadProgress !== null ? `${Math.round(video.uploadProgress)}%` : 'Upload...'}
            </span>
          </div>
        ) : (
          <>
            {video.thumbnailUrl ? (
              <img 
                src={video.thumbnailUrl} 
                alt={video.name}
                className={`w-full h-full object-cover transition-opacity duration-200 ${showPreview ? 'opacity-0' : 'opacity-100'}`}
              />
            ) : (
              <div className={`absolute inset-0 flex items-center justify-center bg-gray-200 transition-opacity duration-200 ${showPreview ? 'opacity-0' : 'opacity-100'}`}>
                <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            
            {(showPreview || isHovering) && !video.hasActiveUpload && (
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
        
        {/* Duration badge - Always visible */}
        {video.duration && !video.hasActiveUpload && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/80 text-white text-xs font-medium rounded">
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Hover actions */}
        <div className={`absolute inset-0 bg-black/30 flex items-center justify-center gap-2 transition-opacity duration-200 ${isHovering && !video.hasActiveUpload ? 'opacity-100' : 'opacity-0'}`}>
          {/* Share button */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onShare(video) }}
            className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
            title="Partager"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
          </button>
          
          {/* Copy link button */}
          <button
            onClick={handleCopyLink}
            className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
            title="Copier le lien"
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
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(!showMenu) }}
              className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
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
                  onClick={(e) => { e.preventDefault(); onShare(video); setShowMenu(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                  Partager
                </button>
                <hr className="my-1 border-gray-100" />
                <button
                  onClick={(e) => { e.preventDefault(); onDelete(video.id); setShowMenu(false) }}
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

      {/* Card info */}
      <div className="p-3">
        <h3 className="font-medium text-gray-900 truncate text-sm">{video.name}</h3>
        
        {/* Status + date row */}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-2">
            {/* Shared status badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
              video.public 
                ? 'bg-green-50 text-green-700' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {video.public ? (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                  </svg>
                  Partagé
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Privé
                </>
              )}
            </span>
          </div>
          <span className="text-xs text-gray-500">{formatDate(video.createdAt)}</span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          {video.viewCount !== undefined && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {video.viewCount}
            </span>
          )}
          {video.width && video.height && (
            <span>{video.width}×{video.height}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ClipsDashboard() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sharingVideo, setSharingVideo] = useState<Video | null>(null)

  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch('/api/videos', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setVideos(data.videos || [])
      }
    } catch (error) {
      console.error('Error fetching videos:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

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

  const handleUpdateVideo = (updatedVideo: Video) => {
    setVideos(prev => prev.map(v => v.id === updatedVideo.id ? updatedVideo : v))
  }

  const filteredVideos = videos.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stats = {
    total: videos.length,
    uploading: videos.filter(v => v.hasActiveUpload).length,
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-3 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          <span className="text-gray-600">Chargement...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar with search */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Mes Clips</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {stats.total} vidéo{stats.total !== 1 ? 's' : ''}{stats.uploading > 0 && ` • ${stats.uploading} en cours d'upload`}
            </p>
          </div>

          <div className="w-72">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-gray-300 focus:ring-0 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Video grid */}
      <div className="flex-1 overflow-auto p-6">
        {filteredVideos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVideos.map(video => (
              <VideoCard 
                key={video.id} 
                video={video}
                onDelete={handleDelete}
                onShare={setSharingVideo}
                onUpdate={handleUpdateVideo}
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

      {/* Sharing Modal */}
      {sharingVideo && (
        <SharingModal
          video={sharingVideo}
          isOpen={!!sharingVideo}
          onClose={() => setSharingVideo(null)}
          onUpdate={handleUpdateVideo}
        />
      )}
    </div>
  )
}
