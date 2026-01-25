'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DrimeFilePicker from '@/components/DrimeFilePicker'
import SignatureEditorModal from '@/components/SignatureEditorModal'
import Tooltip from '@/components/Tooltip'
import Onboarding from '@/components/Onboarding'
import { useI18n } from '@/lib/i18n/I18nContext'

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

// Dropdown icons - using new Iconly icons
const DeviceIcon = () => (
  <img src="/icons/device.svg" alt="" className="w-5 h-5" />
)

const DrimeIcon = () => (
  <img src="/drime-icon.png" alt="Drime" className="w-5 h-5" />
)

// Sidebar Icons - using new Iconly icons
const HomeIcon = () => (
  <img src="/icons/home.svg" alt="" className="w-5 h-5" />
)

const DocumentIcon = () => (
  <img src="/icons/agreements.svg" alt="" className="w-5 h-5" />
)

const MailIcon = () => (
  <img src="/icons/received.svg" alt="" className="w-5 h-5" />
)

const PenIcon = () => (
  <img src="/icons/to-sign.svg" alt="" className="w-4 h-4" />
)

const ClockIcon = () => (
  <img src="/icons/clock.svg" alt="" className="w-4 h-4" />
)

const CheckIcon = () => (
  <img src="/icons/check.svg" alt="" className="w-4 h-4" />
)

const XIcon = () => (
  <img src="/icons/close.svg" alt="" className="w-4 h-4" />
)

const UploadIcon = () => (
  <img src="/icons/upload-document.svg" alt="" className="w-12 h-12" />
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
  const { t, locale, setLocale } = useI18n()
  const [user, setUser] = useState<User | null>(null)
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [loading, setLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showImportDropdown, setShowImportDropdown] = useState(false)
  const [showDrimeFilePicker, setShowDrimeFilePicker] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSignatureEditor, setShowSignatureEditor] = useState(false)
  const [savedSignature, setSavedSignature] = useState<string | null>(null)
  const [readNotifications, setReadNotifications] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('readNotifications')
      return stored ? JSON.parse(stored) : []
    }
    return []
  })
  const [notificationTab, setNotificationTab] = useState<'general' | 'invitations' | 'requests'>('general')
  const [showOnboarding, setShowOnboarding] = useState(false)
  
  // Subscription info
  const [subscription, setSubscription] = useState<{
    plan: string
    planName: string
    signatureRequests: {
      used: number
      limit: number
      remaining: number
      isUnlimited: boolean
    }
    canCreateSignatureRequest: boolean
    resetDate: string | null
  } | null>(null)
  
  // Check if onboarding should be shown (first visit)
  useEffect(() => {
    if (typeof window !== 'undefined' && !loading && user) {
      const hasSeenOnboarding = localStorage.getItem('drime_sign_onboarding_complete')
      if (!hasSeenOnboarding) {
        // Small delay to let the UI render first
        const timer = setTimeout(() => setShowOnboarding(true), 500)
        return () => clearTimeout(timer)
      }
    }
  }, [loading, user])

  const completeOnboarding = useCallback(() => {
    localStorage.setItem('drime_sign_onboarding_complete', 'true')
    setShowOnboarding(false)
  }, [])

  // Handle keyboard for onboarding
  useEffect(() => {
    if (!showOnboarding) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        completeOnboarding()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showOnboarding, completeOnboarding])
  
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

  // Load subscription info
  useEffect(() => {
    if (user) {
      fetch('/api/subscription', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setSubscription(data)
          }
        })
        .catch(() => {})
      
      // Sync subscription from Drime (background)
      fetch('/api/subscription', { method: 'POST', credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setSubscription(data)
          }
        })
        .catch(() => {})
    }
  }, [user])

  // Load saved signature
  useEffect(() => {
    if (user) {
      fetch('/api/user/signature', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.signatureData) {
            setSavedSignature(data.signatureData)
          }
        })
        .catch(() => {})
    }
  }, [user])

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
    return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { 
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
        const thumbnail = await generatePdfThumbnail(file, 600)
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
            <div className="relative" ref={notificationsRef} data-onboarding="notifications">
              <Tooltip content={t('notifications.title')} position="bottom">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2.5 hover:bg-[#ECEEF0] rounded-lg transition-all duration-200"
                >
                  <img src="/icons/notification.svg" alt="" className="w-6 h-6" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </button>
              </Tooltip>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-[10px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] overflow-hidden z-50">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">{t('notifications.title')}</h3>
                    <Tooltip content={t('notifications.markAllRead')} position="left">
                      <button 
                        onClick={() => {
                          const allIds = notifications.map(n => n.id)
                          localStorage.setItem('readNotifications', JSON.stringify(allIds))
                          setReadNotifications(allIds)
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <img src="/icons/mark-all-read.svg" alt="" className="w-5 h-5" />
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
                        {t('notifications.general')}
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
                        {t('notifications.invitations')}
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
                        {t('notifications.requests')}
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
                          <p className="px-4 py-2 text-xs text-gray-500">{locale === 'fr' ? 'Plus tôt' : 'Earlier'}</p>
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
                                <span className="font-medium">{notification.title}</span> {notification.action === 'completed' ? (locale === 'fr' ? 'a été approuvé' : 'was approved') : (locale === 'fr' ? 'a été signé' : 'was signed')}
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
                          <div className="py-6 text-center">
                            <img src="/empty-notifications.png" alt="" className="w-20 h-20 mx-auto mb-2 object-contain" />
                            <p className="text-sm text-gray-500">{t('notifications.noNotifications')}</p>
                          </div>
                        )}
                        <p className="px-4 py-3 text-sm text-gray-400 text-center border-t border-gray-100">
                          {locale === 'fr' ? 'Vous avez atteint la fin.' : "You've reached the end."}
                        </p>
                      </>
                    )}
                    {notificationTab === 'invitations' && (
                      <>
                        {notifications.filter(n => n.type === 'invitation').length > 0 && (
                          <p className="px-4 py-2 text-xs text-gray-500">{locale === 'fr' ? 'Invitations en attente' : 'Pending invitations'}</p>
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
                                <span className="font-medium">{notification.title}</span> - {locale === 'fr' ? 'signature requise' : 'signature required'}
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
                          <div className="py-6 text-center">
                            <img src="/empty-notifications.png" alt="" className="w-20 h-20 mx-auto mb-2 object-contain" />
                            <p className="text-sm text-gray-500">{locale === 'fr' ? 'Aucune invitation' : 'No invitations'}</p>
                          </div>
                        )}
                      </>
                    )}
                    {notificationTab === 'requests' && (
                      <div className="py-6 text-center">
                        <img src="/empty-notifications.png" alt="" className="w-20 h-20 mx-auto mb-2 object-contain" />
                        <p className="text-sm text-gray-500">{locale === 'fr' ? 'Aucune demande' : 'No requests'}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative" ref={profileMenuRef} data-onboarding="profile">
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
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-[10px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] overflow-hidden z-50">
                  {/* User info */}
                  <div className="p-4 flex flex-col items-center border-b border-gray-100">
                    <div className="w-14 h-14 rounded-full bg-[#E0F5EA] flex items-center justify-center text-lg font-semibold text-[#08CF65] mb-2 overflow-hidden">
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (user?.name || user?.email || 'U').slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <p className="font-semibold text-gray-900">{user?.name || (locale === 'fr' ? 'Utilisateur' : 'User')}</p>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                  </div>

                  {/* Plan info */}
                  <div className="p-4 border-b border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">{locale === 'fr' ? 'Demandes de signature' : 'Signature requests'}:</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Sign - {subscription?.planName || (locale === 'fr' ? 'Gratuit' : 'Free')}</span>
                        {!subscription?.signatureRequests?.isUnlimited && (
                          <a href="https://drime.cloud/fr/pricing" className="text-xs text-[#08CF65] hover:underline">{locale === 'fr' ? 'Mettre à niveau' : 'Upgrade'}</a>
                        )}
                      </div>
                      {subscription?.signatureRequests?.isUnlimited ? (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <svg className="w-3 h-3 text-[#08CF65]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          {locale === 'fr' ? 'Illimité ce mois' : 'Unlimited this month'}
                        </p>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>{subscription?.signatureRequests?.used || 0}/{subscription?.signatureRequests?.limit || 3} {locale === 'fr' ? 'ce mois' : 'this month'}</span>
                            <span>{subscription?.signatureRequests?.remaining || 0} {locale === 'fr' ? 'restantes' : 'remaining'}</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                (subscription?.signatureRequests?.remaining || 0) === 0 
                                  ? 'bg-red-500' 
                                  : 'bg-[#08CF65]'
                              }`}
                              style={{ 
                                width: `${Math.min(100, ((subscription?.signatureRequests?.used || 0) / (subscription?.signatureRequests?.limit || 3)) * 100)}%` 
                              }}
                            />
                          </div>
                          {(subscription?.signatureRequests?.remaining || 0) === 0 && (
                            <p className="text-xs text-red-500 mt-1">
                              {locale === 'fr' ? 'Limite atteinte - passez à un plan supérieur' : 'Limit reached - upgrade your plan'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-2">
                    <a
                      href="https://app.drime.cloud/account-settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                    >
                      <img src="/icons/profile.svg" alt="" className="w-5 h-5" />
                      {t('profile.profileSettings')}
                    </a>
                    <a
                      href="https://app.drime.cloud/account-settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                    >
                      <img src="/icons/settings.svg" alt="" className="w-5 h-5" />
                      {t('profile.settings')}
                    </a>
                    {/* Signature section */}
                    <div className="px-4 py-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t('profile.mySignature')}</span>
                        <button
                          onClick={() => { setShowProfileMenu(false); setShowSignatureEditor(true) }}
                          className="text-xs text-[#08CF65] hover:text-[#06B557] font-medium"
                        >
                          {t('profile.editSignature')}
                        </button>
                      </div>
                      {savedSignature ? (
                        <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                          <img
                            src={savedSignature}
                            alt="Ma signature"
                            className="h-12 object-contain mx-auto"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => { setShowProfileMenu(false); setShowSignatureEditor(true) }}
                          className="w-full py-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-[#08CF65] hover:text-[#08CF65] transition-colors"
                        >
                          {t('profile.addSignature')}
                        </button>
                      )}
                    </div>
                    <a
                      href="https://drime.cloud/fr/pricing"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                    >
                      <img src="/icons/pricing.svg" alt="" className="w-5 h-5" />
                      {t('profile.pricingFeatures')}
                    </a>
                    <div className="border-t border-gray-100 my-1" />
                    {/* Language toggle */}
                    <button
                      onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <img src="/icons/language.svg" alt="" className="w-5 h-5" />
                        <span>{locale === 'fr' ? 'Langue' : 'Language'}</span>
                      </div>
                      <span className="text-gray-500">{locale === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}</span>
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={clearSessionAndRedirect}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.5039 11.1235V12.8763" />
                        <path d="M9.44385 18.5843V5.41567C9.44385 3.72606 10.9973 2.46304 12.6529 2.80665L17.8757 3.89066C19.113 4.14748 20 5.23688 20 6.49968V17.5003C20 18.7631 19.113 19.8525 17.8757 20.1093L12.6529 21.1933C10.9973 21.537 9.44385 20.2739 9.44385 18.5843Z" />
                        <path d="M9.30548 4.87524H6.45336C5.09841 4.87524 4 5.97283 4 7.32677V16.6731C4 18.027 5.09841 19.1246 6.45336 19.1246H9.30548" />
                      </svg>
                      {t('profile.logout')}
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
                  data-onboarding="home"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-[#ECEEF0] text-gray-900 font-medium"
                >
                  <HomeIcon />
                  {t('nav.home')}
                </Link>
              </div>
            </div>

            {/* Agreements section */}
            <div>
              <p className="text-xs font-medium text-gray-500 px-3 mb-2">{t('nav.agreements')}</p>
              <div className="space-y-1">
                <Link
                  href="/dashboard/agreements"
                  data-onboarding="agreements"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <DocumentIcon />
                  {t('agreements.title')}
                </Link>
                <Link
                  href="/dashboard/agreements?view=sent"
                  data-onboarding="received"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <MailIcon />
                  {locale === 'fr' ? 'Reçus' : 'Sent to me'}
                </Link>
                <Link
                  href="/templates"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <img src="/icons/bookmark.svg" alt="" className="w-5 h-5" style={{ filter: 'brightness(0)' }} />
                  {locale === 'fr' ? 'Templates' : 'Templates'}
                </Link>
              </div>
            </div>

            {/* Filtered by status */}
            <div data-onboarding="filters">
              <p className="text-xs font-medium text-gray-500 px-3 mb-2">{locale === 'fr' ? 'Filtrer par statut' : 'Filtered by status'}</p>
              <div className="space-y-1">
                <Link
                  href="/dashboard/agreements?filter=need_to_sign"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <PenIcon />
                  {locale === 'fr' ? 'À signer' : 'Need to sign'}
                </Link>
                <Link
                  href="/dashboard/agreements?filter=in_progress"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <ClockIcon />
                  {locale === 'fr' ? 'En cours' : 'In progress'}
                </Link>
                <Link
                  href="/dashboard/agreements?filter=completed"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <CheckIcon />
                  {locale === 'fr' ? 'Approuvés' : 'Approved'}
                </Link>
                <Link
                  href="/dashboard/agreements?filter=rejected"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <XIcon />
                  {locale === 'fr' ? 'Refusés' : 'Rejected'}
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
              {t('dashboard.welcome')}{user?.name ? `, ${user.name.split(' ')[0]}` : ''} !
            </h1>
            <p className="text-gray-500 mt-1">
              {locale === 'fr' ? 'Résumé de vos documents des 30 derniers jours' : 'Summary of your documents from the last 30 days'}
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
                  <span className="text-sm text-gray-700">{locale === 'fr' ? 'En attente de signature' : 'Waiting for signature'}</span>
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
                  <span className="text-sm text-gray-700">{locale === 'fr' ? 'En attente de votre signature' : 'Waiting for your signature'}</span>
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
                  <span className="text-sm text-gray-700">{locale === 'fr' ? 'Brouillons' : 'Drafts'}</span>
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
                  <span className="text-sm text-gray-700">{locale === 'fr' ? 'Signés' : 'Signed'}</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Upload zone */}
          <div className="px-8 pb-8 flex-1">
            <div
              data-onboarding="upload"
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
                  <p className="text-gray-600 font-medium">{t('dashboard.uploading')}</p>
                </div>
              ) : (
                <>
                  {/* Upload illustration */}
                  <div className="mb-4 text-gray-400">
                    <UploadIcon />
                  </div>
                  
                  <h3 className="text-lg font-medium text-gray-800 mb-2">
                    {locale === 'fr' ? 'Déposez votre document ici pour le faire signer' : 'Drop your document here to get it signed'}
                  </h3>
                  <p className="text-gray-500 text-sm mb-6">
                    {locale === 'fr' ? 'Fichiers supportés : PDF' : 'Supported files: PDF'}
                  </p>
                  
                  {/* Import button with dropdown */}
                  <div className="relative" ref={importDropdownRef}>
                    <button 
                      onClick={() => setShowImportDropdown(!showImportDropdown)}
                      className="px-6 py-2.5 bg-[#08CF65] hover:bg-[#07B859] text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <img src="/icons/upload.svg" alt="" className="w-5 h-5 invert" />
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
                          {t('dashboard.fromDevice')}
                        </button>
                        <button
                          onClick={() => {
                            setShowImportDropdown(false)
                            setShowDrimeFilePicker(true)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                        >
                          <DrimeIcon />
                          {t('dashboard.fromDrime')}
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

      {/* Signature Editor Modal */}
      <SignatureEditorModal
        isOpen={showSignatureEditor}
        onClose={() => setShowSignatureEditor(false)}
        savedSignature={savedSignature}
        onSave={(data) => {
          setSavedSignature(data)
          setShowSignatureEditor(false)
        }}
      />

      {/* Onboarding */}
      {showOnboarding && (
        <Onboarding
          locale={locale as 'fr' | 'en'}
          onComplete={completeOnboarding}
        />
      )}
    </div>
  )
}
