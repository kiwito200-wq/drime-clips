'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DrimeFilePicker from '@/components/DrimeFilePicker'
import Tooltip from '@/components/Tooltip'

interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
}

interface Signer {
  email: string
  name: string | null
  status: string
}

interface Envelope {
  id: string
  slug: string
  name: string
  status: string
  createdAt: string
  updatedAt: string
  signers: Signer[]
  createdBy?: string
}

const DRIME_LOGIN_URL = 'https://front.preprod.drime.cloud/login'

// Dropdown icons
const DeviceIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
  </svg>
)

const DrimeIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 11H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1zm-7-9L4 9h16l-8-7z"/>
  </svg>
)

// SVG Icons - Black color for sidebar
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
)

const DocumentIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const MailIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

const PenIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
)

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const UploadIcon = () => (
  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
)

// Avatar colors based on email hash
const getAvatarColor = (email: string) => {
  const colors = [
    'bg-[#E0F5EA]', // Light green
    'bg-[#E8F4FD]', // Light blue
    'bg-[#FFF4E5]', // Light orange
    'bg-[#F3E8FF]', // Light purple
    'bg-[#FFEEF0]', // Light red
    'bg-[#E0F2FE]', // Light cyan
  ]
  const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

export default function DashboardHome() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [loading, setLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showImportDropdown, setShowImportDropdown] = useState(false)
  const [showDrimeFilePicker, setShowDrimeFilePicker] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [readNotifications, setReadNotifications] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('readNotifications')
      return stored ? JSON.parse(stored) : []
    }
    return []
  })
  const [notificationTab, setNotificationTab] = useState<'general' | 'invitations' | 'requests'>('general')
  
  // Persist read notifications to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('readNotifications', JSON.stringify(readNotifications))
    }
  }, [readNotifications])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importDropdownRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importDropdownRef.current && !importDropdownRef.current.contains(event.target as Node)) {
        setShowImportDropdown(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchEnvelopes = useCallback(async () => {
    const envelopesRes = await fetch('/api/envelopes', { credentials: 'include' })
    if (envelopesRes.ok) {
      const data = await envelopesRes.json()
      setEnvelopes(data.envelopes || [])
    }
  }, [])

  const clearSessionAndRedirect = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = DRIME_LOGIN_URL
  }, [])

  const checkAuthAndFetch = useCallback(async () => {
    try {
      const authRes = await fetch('/api/auth/check', { credentials: 'include' })
      if (authRes.ok) {
        const data = await authRes.json()
        if (data.user) {
          setUser(data.user)
          await fetchEnvelopes()
          setLoading(false)
          return
        }
      }
      await clearSessionAndRedirect()
    } catch (error) {
      console.error('[Dashboard] Auth error:', error)
      await clearSessionAndRedirect()
    }
  }, [fetchEnvelopes, clearSessionAndRedirect])

  useEffect(() => {
    checkAuthAndFetch()
  }, [checkAuthAndFetch])

  // Calculate stats
  const stats = {
    waitingForOthers: envelopes.filter(e => 
      e.status === 'pending' && !e.signers.some(s => s.email === user?.email && s.status === 'pending')
    ).length,
    needToSign: envelopes.filter(e => 
      e.status === 'pending' && e.signers.some(s => s.email === user?.email && s.status === 'pending')
    ).length,
    drafts: envelopes.filter(e => e.status === 'draft').length,
    completed: envelopes.filter(e => e.status === 'completed').length,
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Generate notifications from real envelope data
  const notifications = useMemo(() => {
    const notifs: Array<{
      id: string
      type: 'general' | 'invitation'
      action: 'completed' | 'signed' | 'invited' | 'pending'
      title: string
      slug: string
      time: string
      read: boolean
      senderEmail?: string
      senderName?: string
    }> = []

    envelopes.forEach(envelope => {
      // Completed documents
      if (envelope.status === 'completed') {
        notifs.push({
          id: `completed-${envelope.id}`,
          type: 'general',
          action: 'completed',
          title: envelope.name,
          slug: envelope.slug,
          time: envelope.updatedAt,
          read: readNotifications.includes(`completed-${envelope.id}`)
        })
      }

      // Documents where someone signed
      envelope.signers.forEach(signer => {
        if (signer.status === 'signed') {
          notifs.push({
            id: `signed-${envelope.id}-${signer.email}`,
            type: 'general',
            action: 'signed',
            title: envelope.name,
            slug: envelope.slug,
            time: envelope.updatedAt,
            read: readNotifications.includes(`signed-${envelope.id}-${signer.email}`)
          })
        }
      })

      // Documents sent to me (invitations)
      if (envelope.signers.some(s => s.email === user?.email && s.status === 'pending') && envelope.createdBy !== user?.email) {
        notifs.push({
          id: `invited-${envelope.id}`,
          type: 'invitation',
          action: 'invited',
          title: envelope.name,
          slug: envelope.slug,
          time: envelope.createdAt,
          read: readNotifications.includes(`invited-${envelope.id}`),
          senderEmail: envelope.createdBy || '',
          senderName: envelope.createdBy?.split('@')[0] || ''
        })
      }
    })

    // Sort by time, most recent first
    return notifs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  }, [envelopes, readNotifications, user?.email])

  // File upload handling
  const handleFileUpload = async (file: File) => {
    if (!file || !file.type.includes('pdf')) {
      alert('Please upload a PDF file')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name.replace('.pdf', ''))

      // Generate thumbnail client-side
      try {
        const { generatePdfThumbnail } = await import('@/lib/pdf-thumbnail')
        const thumbnail = await generatePdfThumbnail(file, 128)
        if (thumbnail) {
          formData.append('thumbnail', thumbnail)
        }
      } catch (e) {
        console.error('Thumbnail generation failed:', e)
      }

      const response = await fetch('/api/envelopes', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        // Redirect to step 2 (signers) since document is already uploaded
        router.push(`/send?slug=${data.envelope.slug}`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to upload document')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload document')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
  }

  // Handle file from Drime
  const handleDrimeFileSelect = async (drimeFile: any, blob: Blob) => {
    const file = new File([blob], drimeFile.name || drimeFile.file_name || 'document.pdf', { type: 'application/pdf' })
    await handleFileUpload(file)
  }

  // Show skeleton instead of spinner for smoother transition
  if (loading) {
    return (
      <div className="h-screen bg-[#F3F4F6] flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-4 pt-4 pb-3">
          <div className="flex items-center gap-4">
            <div className="w-52 flex-shrink-0 px-3">
              <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex-1 flex gap-4 px-4 pb-4 min-h-0">
          <aside className="w-52 flex-shrink-0">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-10 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          </aside>
          <main className="flex-1 bg-white rounded-xl border border-gray-200" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#F3F4F6] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <div className="flex items-center gap-4">
          {/* Logo area */}
          <div className="w-52 flex-shrink-0 px-3">
            <img 
              src="/drime-logo.png" 
              alt="Drime" 
              className="h-8 w-auto"
            />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side - Notifications & Profile */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-[10px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] overflow-hidden z-50">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Notification</h3>
                    <Tooltip content="Marquer tout comme lu" position="left">
                      <button 
                        onClick={() => {
                          const allIds = notifications.map(n => n.id)
                          localStorage.setItem('readNotifications', JSON.stringify(allIds))
                          setReadNotifications(allIds)
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </button>
                    </Tooltip>
                  </div>

                  {/* Tabs */}
                  <div className="relative">
                    <div className="flex">
                      <button
                        onClick={() => setNotificationTab('general')}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                          notificationTab === 'general' 
                            ? 'text-gray-900' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Général
                        {notifications.filter(n => n.type === 'general' && !n.read).length > 0 && (
                          <span className="px-1.5 py-0.5 bg-[#08CF65] text-white text-xs rounded-full leading-none">
                            {notifications.filter(n => n.type === 'general' && !n.read).length}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setNotificationTab('invitations')}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                          notificationTab === 'invitations' 
                            ? 'text-gray-900' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Invitations
                        {notifications.filter(n => n.type === 'invitation' && !n.read).length > 0 && (
                          <span className="px-1.5 py-0.5 bg-[#7E33F7] text-white text-xs rounded-full leading-none">
                            {notifications.filter(n => n.type === 'invitation' && !n.read).length}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setNotificationTab('requests')}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                          notificationTab === 'requests' 
                            ? 'text-gray-900' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Demandes
                        <span className="text-gray-400">0</span>
                      </button>
                    </div>
                    {/* Sliding underline */}
                    <div className="absolute bottom-0 h-0.5 bg-[#08CF65] transition-all duration-300 ease-in-out" style={{
                      width: '33.333%',
                      left: notificationTab === 'general' ? '0%' : notificationTab === 'invitations' ? '33.333%' : '66.666%'
                    }} />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-100" />
                  </div>

                  {/* Content */}
                  <div className="max-h-80 overflow-y-auto">
                    {notificationTab === 'general' && (
                      <>
                        {notifications.filter(n => n.type === 'general').length > 0 && (
                          <p className="px-4 py-2 text-xs text-gray-500">Plus tôt</p>
                        )}
                        {notifications.filter(n => n.type === 'general').map(notification => (
                          <div 
                            key={notification.id} 
                            onClick={() => {
                              // Save to localStorage immediately before navigation
                              const newReadNotifs = [...readNotifications, notification.id]
                              localStorage.setItem('readNotifications', JSON.stringify(newReadNotifs))
                              setReadNotifications(newReadNotifs)
                              setShowNotifications(false)
                              router.push(`/view/${notification.slug}`)
                            }}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-full bg-[#E0F5EA] flex items-center justify-center text-xs font-semibold text-[#08CF65] flex-shrink-0">
                              {(user?.name || user?.email || 'U').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900">
                                <span className="font-medium">{notification.title}</span> {notification.action === 'completed' ? 'a été approuvé' : 'a été signé'}
                              </p>
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <svg className="w-3 h-3 text-[#08CF65]" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Drime Sign | {formatDateTime(notification.time)}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-[#08CF65] rounded-full flex-shrink-0 mt-2" />
                            )}
                          </div>
                        ))}
                        {notifications.filter(n => n.type === 'general').length === 0 && (
                          <p className="px-4 py-8 text-sm text-gray-500 text-center">Aucune notification</p>
                        )}
                        <p className="px-4 py-3 text-sm text-gray-400 text-center border-t border-gray-100">
                          Vous avez atteint la fin.
                        </p>
                      </>
                    )}
                    {notificationTab === 'invitations' && (
                      <>
                        {notifications.filter(n => n.type === 'invitation').length > 0 && (
                          <p className="px-4 py-2 text-xs text-gray-500">Invitations en attente</p>
                        )}
                        {notifications.filter(n => n.type === 'invitation').map(notification => (
                          <div 
                            key={notification.id} 
                            onClick={() => {
                              // Save to localStorage immediately before navigation
                              const newReadNotifs = [...readNotifications, notification.id]
                              localStorage.setItem('readNotifications', JSON.stringify(newReadNotifs))
                              setReadNotifications(newReadNotifs)
                              setShowNotifications(false)
                              router.push(`/view/${notification.slug}`)
                            }}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                          >
                            <div className={`w-9 h-9 rounded-full ${getAvatarColor(notification.senderEmail || '')} flex items-center justify-center text-xs font-semibold text-gray-800 flex-shrink-0`}>
                              {(notification.senderName || notification.senderEmail || 'U').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900">
                                <span className="font-medium">{notification.title}</span> - signature requise
                              </p>
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <svg className="w-3 h-3 text-[#08CF65]" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                Drime Sign | {formatDateTime(notification.time)}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-[#08CF65] rounded-full flex-shrink-0 mt-2" />
                            )}
                          </div>
                        ))}
                        {notifications.filter(n => n.type === 'invitation').length === 0 && (
                          <p className="px-4 py-8 text-sm text-gray-500 text-center">Aucune invitation</p>
                        )}
                      </>
                    )}
                    {notificationTab === 'requests' && (
                      <p className="px-4 py-8 text-sm text-gray-500 text-center">Aucune demande</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-9 h-9 rounded-full bg-[#E0F5EA] flex items-center justify-center text-sm font-semibold text-[#08CF65] hover:ring-2 hover:ring-[#08CF65]/30 transition-all"
              >
                {(user?.name || user?.email || 'U').slice(0, 2).toUpperCase()}
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-[10px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] overflow-hidden z-50">
                  {/* User info */}
                  <div className="p-4 flex flex-col items-center border-b border-gray-100">
                    <div className="w-14 h-14 rounded-full bg-[#E0F5EA] flex items-center justify-center text-lg font-semibold text-[#08CF65] mb-2">
                      {(user?.name || user?.email || 'U').slice(0, 2).toUpperCase()}
                    </div>
                    <p className="font-semibold text-gray-900">{user?.name || 'Utilisateur'}</p>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                  </div>

                  {/* Plan info */}
                  <div className="p-4 border-b border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">{user?.name || user?.email?.split('@')[0]} de quota:</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                            <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </div>
                          <span className="text-sm text-gray-700">Sign - Gratuit</span>
                        </div>
                        <a href="https://drime.cloud/fr/pricing" className="text-xs text-[#08CF65] hover:underline">Mettre à niveau</a>
                      </div>
                      <p className="text-xs text-gray-500 pl-8">2/5 signatures pour votre Workspace</p>
                    </div>
                    <a 
                      href="https://app.drime.cloud/account-settings#billing" 
                      className="block w-full mt-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-center"
                    >
                      Voir et gérer la souscription
                    </a>
                  </div>

                  {/* Menu items */}
                  <div className="py-2">
                    <a
                      href="https://app.drime.cloud/account-settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F5F5F5] transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      Profil
                    </a>
                    <a
                      href="https://app.drime.cloud/account-settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F5F5F5] transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Mes paramètres
                    </a>
                    <a
                      href="https://drime.cloud/fr/pricing"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#F5F5F5] transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                      </svg>
                      Prix et fonctionnalités
                    </a>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={clearSessionAndRedirect}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                      </svg>
                      Déconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex gap-4 px-4 pb-4 min-h-0">
        {/* Sidebar - Full navigation with black text/icons */}
        <aside className="w-52 flex-shrink-0 flex flex-col">
          <div className="space-y-6">
            {/* Main navigation */}
            <div>
              <div className="space-y-1">
                <Link
                  href="/dashboard"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-[#ECEEF0] text-gray-900 font-medium"
                >
                  <HomeIcon />
                  Dashboard
                </Link>
              </div>
            </div>

            {/* Agreements section */}
            <div>
              <p className="text-xs font-medium text-gray-500 px-3 mb-2">Agreements</p>
              <div className="space-y-1">
                <Link
                  href="/dashboard/agreements"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <DocumentIcon />
                  My agreements
                </Link>
                <Link
                  href="/dashboard/agreements?view=sent"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <MailIcon />
                  Sent to me
                </Link>
              </div>
            </div>

            {/* Filtered by status */}
            <div>
              <p className="text-xs font-medium text-gray-500 px-3 mb-2">Filtered by status</p>
              <div className="space-y-1">
                <Link
                  href="/dashboard/agreements?filter=need_to_sign"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <PenIcon />
                  Need to sign
                </Link>
                <Link
                  href="/dashboard/agreements?filter=in_progress"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <ClockIcon />
                  In progress
                </Link>
                <Link
                  href="/dashboard/agreements?filter=completed"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <CheckIcon />
                  Approved
                </Link>
                <Link
                  href="/dashboard/agreements?filter=rejected"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <XIcon />
                  Rejected
                </Link>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content - white container */}
        <main className="flex-1 bg-white rounded-xl flex flex-col min-h-0 border border-gray-200 overflow-auto">
          {/* Welcome header */}
          <div className="px-8 py-6">
            <h1 className="text-2xl font-semibold text-gray-900">
              Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
            </h1>
            <p className="text-gray-500 mt-1">
              Summary of your documents from the last 30 days
            </p>
          </div>

          {/* Stats - HelloSign style with vertical dividers */}
          <div className="px-8 pb-6">
            <div className="flex bg-white border-l border-gray-200">
              {/* Waiting for signature (from others) = In progress */}
              <Link 
                href="/dashboard/agreements?filter=in_progress" 
                className="flex-1 py-4 px-5 border-r border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="text-2xl font-semibold text-gray-900 mb-2">{stats.waitingForOthers}</div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#FFAD12]" />
                  <span className="text-sm text-gray-700">Waiting for signature</span>
                </div>
              </Link>

              {/* Waiting for your signature = Need to sign (purple) */}
              <Link 
                href="/dashboard/agreements?filter=need_to_sign" 
                className="flex-1 py-4 px-5 border-r border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="text-2xl font-semibold text-gray-900 mb-2">{stats.needToSign}</div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#7E33F7]" />
                  <span className="text-sm text-gray-700">Waiting for your signature</span>
                </div>
              </Link>

              {/* Drafts = gray */}
              <Link 
                href="/dashboard/agreements?filter=draft" 
                className="flex-1 py-4 px-5 border-r border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="text-2xl font-semibold text-gray-900 mb-2">{stats.drafts}</div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-gray-400" />
                  <span className="text-sm text-gray-700">Drafts</span>
                </div>
              </Link>

              {/* Signed = Approved (green) */}
              <Link 
                href="/dashboard/agreements?filter=completed" 
                className="flex-1 py-4 px-5 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="text-2xl font-semibold text-gray-900 mb-2">{stats.completed}</div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#08CF65]" />
                  <span className="text-sm text-gray-700">Signed</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Upload zone */}
          <div className="px-8 pb-8 flex-1">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-2xl h-full min-h-[280px] flex flex-col items-center justify-center transition-all
                ${isDragging 
                  ? 'border-[#08CF65] bg-[#DCFCE7]/30' 
                  : 'border-gray-300'
                }
                ${isUploading ? 'pointer-events-none opacity-50' : ''}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {isUploading ? (
                <div className="text-center">
                  <div className="w-12 h-12 border-2 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">Uploading...</p>
                </div>
              ) : (
                <>
                  {/* Upload illustration */}
                  <div className="mb-4 text-gray-400">
                    <UploadIcon />
                  </div>
                  
                  <h3 className="text-lg font-medium text-gray-800 mb-2">
                    Drop your document here to get it signed
                  </h3>
                  <p className="text-gray-500 text-sm mb-6">
                    Supported files: PDF
                  </p>
                  
                  {/* Import button with dropdown */}
                  <div className="relative" ref={importDropdownRef}>
                    <button 
                      onClick={() => setShowImportDropdown(!showImportDropdown)}
                      className="px-6 py-2.5 bg-[#08CF65] hover:bg-[#07B859] text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Import
                      <svg className={`w-4 h-4 transition-transform ${showImportDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {showImportDropdown && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-[10px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] py-2 min-w-[200px] z-10">
                        <button
                          onClick={() => {
                            setShowImportDropdown(false)
                            fileInputRef.current?.click()
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                        >
                          <DeviceIcon />
                          From my device
                        </button>
                        <button
                          onClick={() => {
                            setShowImportDropdown(false)
                            setShowDrimeFilePicker(true)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                        >
                          <span className="text-[#08CF65]"><DrimeIcon /></span>
                          From Drime
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Drime File Picker Modal */}
      <DrimeFilePicker
        isOpen={showDrimeFilePicker}
        onClose={() => setShowDrimeFilePicker(false)}
        onSelect={handleDrimeFileSelect}
      />
    </div>
  )
}
