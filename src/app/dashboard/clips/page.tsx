'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

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
  commentCount?: number
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

// Sharing Modal - Drime Notes Style
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
      setCopied(false)
      setEmbedCopied(false)
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
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', duration: 0.3 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
      >
        <div className="mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Partager</h2>
              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[260px]">{video.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex px-5 pt-3">
            {['share', 'embed'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as 'share' | 'embed')}
                className={`px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                  activeTab === tab 
                    ? 'bg-gray-100 text-gray-900' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab === 'share' ? 'Partager' : 'Intégrer'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-5">
            {activeTab === 'share' ? (
              <div className="space-y-4">
                {/* Public toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Accès public</p>
                      <p className="text-xs text-gray-500">
                        {isPublic ? 'Visible par tous' : 'Vidéo privée'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPublic(!isPublic)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? 'bg-[#08CF65]' : 'bg-gray-300'}`}
                  >
                    <motion.div 
                      animate={{ x: isPublic ? 20 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                {/* Copy link */}
                {isPublic && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-500">Lien de partage</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-600 truncate border border-gray-200 font-mono text-xs">
                        {`${window.location.origin}/v/${video.id}`}
                      </div>
                      <button
                        onClick={copyLink}
                        className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          copied 
                            ? 'bg-[#08CF65] text-white' 
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        }`}
                      >
                        {copied ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-xs font-medium text-gray-500">Code d&apos;intégration</label>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <code className="text-xs text-gray-600 break-all font-mono leading-relaxed">
                    {`<iframe src="${window.location.origin}/embed/${video.id}" frameborder="0" allowfullscreen style="width:100%;aspect-ratio:16/9;"></iframe>`}
                  </code>
                </div>
                <button
                  onClick={copyEmbed}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    embedCopied 
                      ? 'bg-[#08CF65] text-white' 
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {embedCopied ? 'Copié !' : 'Copier le code'}
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          {activeTab === 'share' && (
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm font-medium text-white bg-[#08CF65] rounded-lg hover:bg-[#07B859] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}

// Video Card Menu (three dots)
function VideoCardMenu({ 
  video, 
  onDelete, 
  onShare,
  onRename,
  onDuplicate,
}: { 
  video: Video
  onDelete: (id: string) => void
  onShare: (video: Video) => void
  onRename: (video: Video) => void
  onDuplicate: (video: Video) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(`${window.location.origin}/v/${video.id}`)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      setShowMenu(false)
    }, 1500)
  }

  const menuItems = [
    {
      label: 'Voir',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
      href: `/v/${video.id}`,
    },
    { divider: true },
    {
      label: 'Partager',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>,
      onClick: () => { onShare(video); setShowMenu(false) },
    },
    {
      label: copied ? 'Copié !' : 'Copier le lien',
      icon: copied 
        ? <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
      onClick: handleCopyLink,
    },
    {
      label: 'Renommer',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
      onClick: () => { onRename(video); setShowMenu(false) },
    },
    {
      label: 'Dupliquer',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
      onClick: () => { onDuplicate(video); setShowMenu(false) },
    },
    { divider: true },
    {
      label: 'Supprimer',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
      onClick: () => { onDelete(video.id); setShowMenu(false) },
      danger: true,
    },
  ]

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(!showMenu) }}
        className="p-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors"
      >
        <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>

      <AnimatePresence>
        {showMenu && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50 overflow-hidden"
          >
            {menuItems.map((item, i) => 
              item.divider ? (
                <hr key={i} className="my-1.5 border-gray-100" />
              ) : item.href ? (
                <Link
                  key={i}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-gray-500">{item.icon}</span>
                  {item.label}
                </Link>
              ) : (
                <button
                  key={i}
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    item.danger 
                      ? 'text-red-600 hover:bg-red-50' 
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className={item.danger ? 'text-red-500' : 'text-gray-500'}>{item.icon}</span>
                  {item.label}
                </button>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Rename Modal
function RenameModal({
  video,
  isOpen,
  onClose,
  onRename,
}: {
  video: Video | null
  isOpen: boolean
  onClose: () => void
  onRename: (id: string, name: string) => void
}) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && video) {
      setName(video.name)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, video])

  const handleSubmit = async () => {
    if (!video || !name.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (res.ok) {
        onRename(video.id, name.trim())
        onClose()
      }
    } catch (error) {
      console.error('Error renaming video:', error)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !video) return null

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm"
      >
        <div className="mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Renommer la vidéo</h3>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:border-[#08CF65] focus:ring-2 focus:ring-[#08CF65]/20 outline-none text-sm"
              placeholder="Nom de la vidéo"
            />
          </div>
          <div className="px-5 pb-5 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !name.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-[#08CF65] rounded-lg hover:bg-[#07B859] disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Renommer'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

function VideoCard({ video, onDelete, onShare, onUpdate, onRename }: { 
  video: Video
  onDelete: (id: string) => void
  onShare: (video: Video) => void
  onUpdate: (video: Video) => void
  onRename: (video: Video) => void
}) {
  const [isHovering, setIsHovering] = useState(false)

  const handleDuplicate = async (v: Video) => {
    try {
      const res = await fetch(`/api/videos/${v.id}/duplicate`, { method: 'POST' })
      if (res.ok) {
        window.location.reload()
      }
    } catch (error) {
      console.error('Error duplicating video:', error)
    }
  }

  return (
    <div 
      className={`group relative bg-white rounded-xl border-2 overflow-hidden transition-colors duration-200 ${
        isHovering ? 'border-[#08CF65]' : 'border-gray-200'
      }`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <Link href={`/v/${video.id}`} className="block relative aspect-video bg-gray-900">
        {video.hasActiveUpload ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-700">
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
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <svg className="w-12 h-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </>
        )}
        
        {/* Duration badge */}
        {video.duration && !video.hasActiveUpload && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-xs font-medium rounded">
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Hover overlay with buttons */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end justify-end p-2 gap-1.5 transition-opacity duration-200 ${isHovering && !video.hasActiveUpload ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onShare(video) }}
            className="p-2 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors"
            title="Partager"
          >
            <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
          </button>
          
          <VideoCardMenu
            video={video}
            onDelete={onDelete}
            onShare={onShare}
            onRename={onRename}
            onDuplicate={handleDuplicate}
          />
        </div>
      </Link>

      {/* Card info */}
      <div className="p-3">
        <h3 className="font-medium text-gray-900 truncate text-sm">{video.name}</h3>
        <p className="text-xs text-gray-500 mt-1">{formatDate(video.createdAt)}</p>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {video.viewCount ?? 0}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {video.commentCount ?? 0}
          </span>
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
  const [renamingVideo, setRenamingVideo] = useState<Video | null>(null)

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

  const handleRename = (id: string, name: string) => {
    setVideos(prev => prev.map(v => v.id === id ? { ...v, name } : v))
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
      {/* Top bar */}
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
                onRename={setRenamingVideo}
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
              Enregistrez votre premier clip avec Drime Desktop
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {sharingVideo && (
          <SharingModal
            video={sharingVideo}
            isOpen={!!sharingVideo}
            onClose={() => setSharingVideo(null)}
            onUpdate={handleUpdateVideo}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {renamingVideo && (
          <RenameModal
            video={renamingVideo}
            isOpen={!!renamingVideo}
            onClose={() => setRenamingVideo(null)}
            onRename={handleRename}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
