'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Tooltip from '@/components/Tooltip'
import DrimeFilePicker from '@/components/DrimeFilePicker'
import { useI18n } from '@/lib/i18n/I18nContext'
import { SecureThumbnailCard } from '@/components/SecureThumbnail'

interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
}

interface Template {
  id: string
  slug: string
  name: string
  description: string | null
  pdfUrl: string
  thumbnailUrl: string | null
  createdAt: string
  updatedAt: string
}

// Sidebar Icons
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

const DeviceIcon = () => (
  <img src="/icons/device.svg" alt="" className="w-5 h-5" />
)

const DrimeIcon = () => (
  <img src="/drime-icon.png" alt="Drime" className="w-5 h-5" />
)

export default function TemplatesPage() {
  const router = useRouter()
  const { t, locale } = useI18n()
  const [user, setUser] = useState<User | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [envelopes, setEnvelopes] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [archived, setArchived] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showImportDropdown, setShowImportDropdown] = useState(false)
  const [showDrimeFilePicker, setShowDrimeFilePicker] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [notificationTab, setNotificationTab] = useState<'general' | 'invitations' | 'requests'>('general')
  const [readNotifications, setReadNotifications] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('readNotifications')
      return stored ? JSON.parse(stored) : []
    }
    return []
  })
  
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
  
  const notificationsRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const importDropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText: string
    cancelText: string
    onConfirm: () => void
    isDanger?: boolean
  } | null>(null)

  // Load user
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user)
        }
      })
      .catch(() => {})
  }, [])

  // Load templates
  useEffect(() => {
    loadTemplates()
  }, [archived])

  // Load envelopes for notifications
  useEffect(() => {
    if (user) {
      fetch('/api/envelopes', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.envelopes) {
            setEnvelopes(data.envelopes)
          }
        })
        .catch(() => {})
    }
  }, [user])

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
    }
  }, [user])

  // Persist read notifications
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('readNotifications', JSON.stringify(readNotifications))
    }
  }, [readNotifications])

  const loadTemplates = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/templates?archived=${archived}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseTemplate = (templateId: string) => {
    router.push(`/send?template=${templateId}`)
  }

  const handleArchiveTemplate = (templateId: string) => {
    setConfirmModal({
      isOpen: true,
      title: locale === 'fr' ? 'Archiver le template' : 'Archive template',
      message: locale === 'fr' ? 'Voulez-vous archiver ce template ? Vous pourrez le retrouver dans les templates archivés.' : 'Do you want to archive this template? You can find it in archived templates.',
      confirmText: locale === 'fr' ? 'Archiver' : 'Archive',
      cancelText: locale === 'fr' ? 'Annuler' : 'Cancel',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/templates/${templateId}?action=archive`, {
            method: 'DELETE',
            credentials: 'include',
          })
          if (res.ok) {
            loadTemplates()
          }
        } catch (error) {
          console.error('Failed to archive template:', error)
        }
        setConfirmModal(null)
      },
    })
  }

  const handleUnarchiveTemplate = (templateId: string) => {
    setConfirmModal({
      isOpen: true,
      title: locale === 'fr' ? 'Désarchiver le template' : 'Unarchive template',
      message: locale === 'fr' ? 'Voulez-vous désarchiver ce template ? Il sera de nouveau visible dans vos templates actifs.' : 'Do you want to unarchive this template? It will be visible again in your active templates.',
      confirmText: locale === 'fr' ? 'Désarchiver' : 'Unarchive',
      cancelText: locale === 'fr' ? 'Annuler' : 'Cancel',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/templates/${templateId}?action=unarchive`, {
            method: 'DELETE',
            credentials: 'include',
          })
          if (res.ok) {
            loadTemplates()
          }
        } catch (error) {
          console.error('Failed to unarchive template:', error)
        }
        setConfirmModal(null)
      },
    })
  }

  const handleDeleteTemplatePermanently = (templateId: string) => {
    setConfirmModal({
      isOpen: true,
      title: locale === 'fr' ? 'Supprimer définitivement' : 'Delete permanently',
      message: locale === 'fr' ? 'Êtes-vous sûr de vouloir supprimer définitivement ce template ? Cette action est irréversible.' : 'Are you sure you want to permanently delete this template? This action cannot be undone.',
      confirmText: locale === 'fr' ? 'Supprimer' : 'Delete',
      cancelText: locale === 'fr' ? 'Annuler' : 'Cancel',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/templates/${templateId}?permanently=true`, {
            method: 'DELETE',
            credentials: 'include',
          })
          if (res.ok) {
            loadTemplates()
          }
        } catch (error) {
          console.error('Failed to delete template:', error)
        }
        setConfirmModal(null)
      },
    })
  }

  // Convert R2 URL to proxy URL to bypass CORS
  const getProxyUrl = (url: string | null | undefined): string => {
    if (!url) return ''
    if (url.startsWith('/')) return url
    try {
      const urlObj = new URL(url)
      const path = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname
      return `/api/files/${path}`
    } catch {
      return url
    }
  }

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr))
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

  const getAvatarColor = (email: string) => {
    const colors = [
      'bg-[#E0F5EA] text-[#08CF65]',
      'bg-[#F3E8FF] text-[#7E33F7]',
      'bg-[#FFF4E6] text-[#FFAD12]',
      'bg-[#FFE5E5] text-[#ED3757]',
      'bg-[#E0F2FE] text-[#00B7FF]',
      'bg-[#E0E7FF] text-[#4F46E5]',
    ]
    let hash = 0
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
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

    envelopes.forEach((envelope: any) => {
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
      envelope.signers?.forEach((signer: any) => {
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
      if (envelope.signers?.some((s: any) => s.email === user?.email && s.status === 'pending') && envelope.createdBy !== user?.email) {
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
      alert(locale === 'fr' ? 'Veuillez uploader un fichier PDF' : 'Please upload a PDF file')
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
        router.push(`/templates/new?slug=${data.envelope.slug}`)
      } else {
        const error = await response.json()
        alert(error.error || (locale === 'fr' ? 'Échec de l\'upload' : 'Failed to upload'))
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert(locale === 'fr' ? 'Échec de l\'upload' : 'Failed to upload')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleDrimeFileSelect = async (drimeFile: any, blob: Blob) => {
    const file = new File([blob], drimeFile.name || drimeFile.file_name || 'document.pdf', { type: 'application/pdf' })
    await handleFileUpload(file)
  }

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
      if (importDropdownRef.current && !importDropdownRef.current.contains(event.target as Node)) {
        setShowImportDropdown(false)
      }
    }
    window.document.addEventListener('mousedown', handleClickOutside)
    return () => window.document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const clearSessionAndRedirect = useCallback(() => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .finally(() => {
        window.location.href = 'https://front.preprod.drime.cloud/login'
      })
  }, [])

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
              <Tooltip content={t('notifications.title')} position="bottom">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowNotifications(!showNotifications)
                  }}
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
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowProfileMenu(!showProfileMenu)
                }}
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
        {/* Sidebar - Full navigation */}
        <aside className="w-52 flex-shrink-0 flex flex-col">
          <div className="space-y-6">
            {/* Main navigation */}
            <div>
              <div className="space-y-1">
                <Link
                  href="/dashboard"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
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
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <DocumentIcon />
                  {t('agreements.title')}
                </Link>
                <Link
                  href="/dashboard/agreements?view=sent"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <MailIcon />
                  {locale === 'fr' ? 'Reçus' : 'Sent to me'}
                </Link>
                <Link
                  href="/templates"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-[#ECEEF0] text-gray-900 font-medium"
                >
                  <img src="/icons/bookmark.svg" alt="" className="w-5 h-5" style={{ filter: 'brightness(0)' }} />
                  {locale === 'fr' ? 'Templates' : 'Templates'}
                </Link>
              </div>
            </div>

            {/* Filtered by status */}
            <div>
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
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {locale === 'fr' ? 'Mes templates' : 'My Templates'}
              </h1>
              <p className="text-gray-500 mt-1">
                {locale === 'fr' ? 'Réutilisez vos documents et champs de signature' : 'Reuse your documents and signature fields'}
              </p>
            </div>
            {/* Import button with dropdown */}
            <div className="relative" ref={importDropdownRef}>
              <button 
                onClick={() => setShowImportDropdown(!showImportDropdown)}
                disabled={isUploading}
                className="px-6 py-2.5 bg-[#08CF65] hover:bg-[#07B859] text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <img src="/icons/upload.svg" alt="" className="w-5 h-5 invert" />
                {locale === 'fr' ? 'Créer un document' : 'Create document'}
                <svg className={`w-4 h-4 transition-transform ${showImportDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showImportDropdown && (
                <div className="absolute top-full right-0 mt-2 bg-white rounded-[10px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] py-2 min-w-[200px] z-10">
                  <button
                    onClick={() => {
                      setShowImportDropdown(false)
                      fileInputRef.current?.click()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                  >
                    <DeviceIcon />
                    {locale === 'fr' ? 'Depuis mon appareil' : 'From my device'}
                  </button>
                  <button
                    onClick={() => {
                      setShowImportDropdown(false)
                      setShowDrimeFilePicker(true)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                  >
                    <DrimeIcon />
                    {locale === 'fr' ? 'Depuis Drime' : 'From Drime'}
                  </button>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Content */}
          <div className="flex-1 px-8 py-6">
            {/* Tabs */}
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setArchived(false)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  !archived
                    ? 'bg-[#08CF65] text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {locale === 'fr' ? 'Actifs' : 'Active'}
              </button>
              <button
                onClick={() => setArchived(true)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  archived
                    ? 'bg-[#08CF65] text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {locale === 'fr' ? 'Archivés' : 'Archived'}
              </button>
            </div>

            {/* Templates Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-20">
                <img
                  src="/icons/bookmark.svg"
                  alt=""
                  className="w-16 h-16 mx-auto mb-4"
                  style={{ filter: 'brightness(0)', opacity: 0.4 }}
                />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {archived 
                    ? (locale === 'fr' ? 'Aucun template archivé' : 'No archived templates')
                    : (locale === 'fr' ? 'Aucun template' : 'No templates')
                  }
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  {archived
                    ? (locale === 'fr' ? 'Vous n\'avez pas encore archivé de templates' : 'You haven\'t archived any templates yet')
                    : (locale === 'fr' ? 'Créez votre premier template en sauvegardant un document depuis l\'étape de révision' : 'Create your first template by saving a document from the review step')
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {templates.map((template) => (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {/* Thumbnail - SECURITY: Use SecureThumbnail for authenticated access */}
                    <div className="aspect-[3/4] bg-white border-b border-gray-100 relative overflow-hidden flex items-center justify-center">
                      <SecureThumbnailCard slug={template.slug} alt={template.name} />
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-1 truncate">
                        {template.name}
                      </h3>
                      {template.description && (
                        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mb-4">
                        {locale === 'fr' ? 'Créé le' : 'Created on'} {formatDate(template.createdAt)}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUseTemplate(template.id)}
                          className="flex-1 px-3 py-2 bg-[#08CF65] text-white text-sm font-medium rounded-lg hover:bg-[#07b858] transition-colors"
                        >
                          {locale === 'fr' ? 'Utiliser' : 'Use'}
                        </button>
                        {archived ? (
                          <>
                            <Tooltip content={locale === 'fr' ? 'Désarchiver' : 'Unarchive'} position="top">
                              <button
                                onClick={() => handleUnarchiveTemplate(template.id)}
                                className="p-2 text-gray-400 hover:text-[#08CF65] hover:bg-[#08CF65]/10 rounded-lg transition-colors"
                              >
                                <img src="/icons/unarchive.svg" alt="" className="w-5 h-5" />
                              </button>
                            </Tooltip>
                            <Tooltip content={locale === 'fr' ? 'Supprimer définitivement' : 'Delete permanently'} position="top">
                              <button
                                onClick={() => handleDeleteTemplatePermanently(template.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <img src="/icons/delete.svg" alt="" className="w-5 h-5" />
                              </button>
                            </Tooltip>
                          </>
                        ) : (
                          <Tooltip content={locale === 'fr' ? 'Archiver' : 'Archive'} position="top">
                            <button
                              onClick={() => handleArchiveTemplate(template.id)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <img src="/icons/archive.svg" alt="" className="w-5 h-5" />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Drime File Picker Modal */}
      <DrimeFilePicker
        isOpen={showDrimeFilePicker}
        onClose={() => setShowDrimeFilePicker(false)}
        onSelect={handleDrimeFileSelect}
      />

      {/* Confirmation Modal */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden"
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {confirmModal.title}
              </h3>
              <p className="text-gray-600">
                {confirmModal.message}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {confirmModal.cancelText}
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  confirmModal.isDanger
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[#08CF65] hover:bg-[#07B859]'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
