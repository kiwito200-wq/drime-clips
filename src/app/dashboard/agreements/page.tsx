'use client'

import { useState, useEffect, useCallback, useMemo, Suspense, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import DrimeFilePicker from '@/components/DrimeFilePicker'
import SignatureEditorModal from '@/components/SignatureEditorModal'
import Tooltip from '@/components/Tooltip'
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
  thumbnailUrl?: string
}

type FilterStatus = 'all' | 'need_to_sign' | 'in_progress' | 'completed' | 'rejected' | 'draft'
type ViewType = 'my_documents' | 'sent_to_me'

const DRIME_LOGIN_URL = 'https://front.preprod.drime.cloud/login'

// Menu Icons
const ViewIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

const AddRecipientsIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
)

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const AuditIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const RenameIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
)

const DeleteIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

// Import dropdown icons
const DeviceIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
  </svg>
)

const DrimeIcon = () => (
  <img src="/drime-icon.png" alt="Drime" className="w-5 h-5" />
)

// Convert R2 URL to proxy URL to bypass CORS
function getProxyUrl(url: string): string {
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

// SVG Icons
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

function AgreementsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, locale, setLocale } = useI18n()
  const [user, setUser] = useState<User | null>(null)
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [viewType, setViewType] = useState<ViewType>('my_documents')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [renameModalOpen, setRenameModalOpen] = useState<string | null>(null)
  const [signingOrderModal, setSigningOrderModal] = useState<Envelope | null>(null)
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<Envelope | null>(null)
  const [newName, setNewName] = useState('')
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [showSignDropdown, setShowSignDropdown] = useState(false)
  const [showDrimeFilePicker, setShowDrimeFilePicker] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSignatureEditor, setShowSignatureEditor] = useState(false)
  const [savedSignature, setSavedSignature] = useState<string | null>(null)
  const [signatureLoading, setSignatureLoading] = useState(false)
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
  const menuRef = useRef<HTMLDivElement>(null)
  const signDropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
      if (signDropdownRef.current && !signDropdownRef.current.contains(event.target as Node)) {
        setShowSignDropdown(false)
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

  // Handle URL query params for filtering
  useEffect(() => {
    const filter = searchParams.get('filter') as FilterStatus | null
    const view = searchParams.get('view')
    if (filter && ['all', 'need_to_sign', 'in_progress', 'completed', 'rejected', 'draft'].includes(filter)) {
      setFilterStatus(filter)
    }
    if (view === 'sent') {
      setViewType('sent_to_me')
    }
  }, [searchParams])

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

  const filteredEnvelopes = useMemo(() => {
    let result = envelopes

    if (viewType === 'sent_to_me') {
      result = result.filter(e => 
        e.signers.some(s => s.email === user?.email) && e.createdBy !== user?.email
      )
    } else {
      result = result.filter(e => e.createdBy === user?.email || !e.createdBy)
    }

    if (filterStatus !== 'all') {
      if (filterStatus === 'need_to_sign') {
        result = result.filter(e => 
          e.status === 'pending' && e.signers.some(s => s.email === user?.email && s.status === 'pending')
        )
      } else if (filterStatus === 'in_progress') {
        result = result.filter(e => e.status === 'pending')
      } else if (filterStatus === 'completed') {
        result = result.filter(e => e.status === 'completed')
      } else if (filterStatus === 'rejected') {
        result = result.filter(e => e.status === 'rejected')
      } else if (filterStatus === 'draft') {
        result = result.filter(e => e.status === 'draft')
      }
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(e => 
        e.name.toLowerCase().includes(query) ||
        e.signers.some(s => s.email.toLowerCase().includes(query))
      )
    }

    return result
  }, [envelopes, viewType, filterStatus, searchQuery, user?.email])

  const getStatusBadge = (status: string, signers: Signer[]) => {
    const needsMySignature = signers.some(s => s.email === user?.email && s.status === 'pending')
    
    if (status === 'pending' && needsMySignature) {
      return { 
        label: locale === 'fr' ? 'À signer' : 'Need to sign', 
        bgColor: 'bg-[#F3E8FF]',
        textColor: 'text-[#7E33F7]',
        icon: <PenIcon />
      }
    }
    
    if (status === 'completed') {
      return { 
        label: locale === 'fr' ? 'Approuvé' : 'Approved', 
        bgColor: 'bg-[#DCFCE7]',
        textColor: 'text-[#08CF65]',
        icon: <CheckIcon />
      }
    }
    
    if (status === 'pending') {
      return { 
        label: locale === 'fr' ? 'En cours' : 'In progress', 
        bgColor: 'bg-[#FFF4E5]',
        textColor: 'text-[#FFAD12]',
        icon: <ClockIcon />
      }
    }
    
    if (status === 'rejected') {
      return { 
        label: locale === 'fr' ? 'Refusé' : 'Rejected', 
        bgColor: 'bg-[#FFEEF0]',
        textColor: 'text-[#ED3757]',
        icon: <XIcon />
      }
    }
    
    return { 
      label: locale === 'fr' ? 'Brouillon' : 'Draft', 
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-600',
      icon: null
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

  const handleDocumentClick = (envelope: Envelope) => {
    if (envelope.status === 'draft') {
      router.push(`/send?slug=${envelope.slug}`)
    } else {
      router.push(`/view/${envelope.slug}`)
    }
  }

  // Menu action handlers
  const handleView = (envelope: Envelope) => {
    setOpenMenuId(null)
    router.push(`/view/${envelope.slug}`)
  }

  const handleAddRecipients = (envelope: Envelope) => {
    setOpenMenuId(null)
    router.push(`/send?slug=${envelope.slug}&step=2`)
  }

  const handleAuditTrail = (envelope: Envelope) => {
    setOpenMenuId(null)
    router.push(`/view/${envelope.slug}?tab=audit`)
  }

  const handleRename = (envelope: Envelope) => {
    setOpenMenuId(null)
    setNewName(envelope.name)
    setRenameModalOpen(envelope.slug)
  }

  const handleDelete = (envelope: Envelope) => {
    setOpenMenuId(null)
    setDeleteConfirmModal(envelope)
  }

  const confirmDelete = async () => {
    if (!deleteConfirmModal) return
    try {
      const res = await fetch(`/api/envelopes/${deleteConfirmModal.slug}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setEnvelopes(prev => prev.filter(e => e.id !== deleteConfirmModal.id))
        setDeleteConfirmModal(null)
      } else {
        alert('Failed to delete document')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete document')
    }
  }

  const submitRename = async () => {
    if (!renameModalOpen || !newName.trim()) return
    try {
      const res = await fetch(`/api/envelopes/${renameModalOpen}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
        credentials: 'include',
      })
      if (res.ok) {
        setEnvelopes(prev => prev.map(e => 
          e.slug === renameModalOpen ? { ...e, name: newName } : e
        ))
        setRenameModalOpen(null)
      } else {
        alert('Failed to rename document')
      }
    } catch (error) {
      console.error('Rename error:', error)
      alert('Failed to rename document')
    }
  }

  // Selection handlers
  const toggleDocSelection = (docId: string) => {
    setSelectedDocs(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedDocs.length === filteredEnvelopes.length) {
      setSelectedDocs([])
    } else {
      setSelectedDocs(filteredEnvelopes.map(e => e.id))
    }
  }

  const handleBulkDownload = async () => {
    if (selectedDocs.length === 1) {
      // Single file - direct download
      const envelope = envelopes.find(e => e.id === selectedDocs[0])
      if (envelope) {
        window.open(`/api/envelopes/${envelope.slug}/download`, '_blank')
      }
    } else {
      // Multiple files - create ZIP
      const slugs = selectedDocs
        .map(docId => envelopes.find(e => e.id === docId)?.slug)
        .filter(Boolean)
      
      if (slugs.length === 0) return
      
      try {
        const res = await fetch('/api/envelopes/download-zip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ slugs }),
        })
        
        if (res.ok) {
          const blob = await res.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `documents_${new Date().toISOString().split('T')[0]}.zip`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      } catch (err) {
        console.error('Failed to download ZIP:', err)
      }
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Supprimer ${selectedDocs.length} document(s) ?`)) return
    
    for (const docId of selectedDocs) {
      const envelope = envelopes.find(e => e.id === docId)
      if (envelope) {
        await fetch(`/api/envelopes/${envelope.slug}`, {
          method: 'DELETE',
          credentials: 'include',
        })
      }
    }
    setSelectedDocs([])
    fetchEnvelopes()
  }

  const getAvatarColor = (str: string) => {
    const colors = [
      'bg-[#E9D5FF]',
      'bg-[#FFE4B5]',
      'bg-[#FFD4DB]',
      'bg-[#BBFDE0]',
      'bg-[#B8E8FF]',
    ]
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  // File upload handler
  const handleFileUpload = async (file: File) => {
    if (!file || !file.type.includes('pdf')) {
      alert('Please upload a PDF file')
      return
    }

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
        router.push(`/send?slug=${data.envelope.slug}`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to upload document')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload document')
    }
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

  if (loading) {
    return (
      <div className="h-screen bg-[#F3F4F6] flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-4 pt-4 pb-3">
          <div className="flex items-center gap-4">
            <div className="w-52 flex-shrink-0 px-3">
              <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="flex-1 max-w-xl">
              <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex-1 flex gap-4 px-4 pb-4 min-h-0">
          <aside className="w-52 flex-shrink-0">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="h-10 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          </aside>
          <main className="flex-1 bg-white rounded-xl border border-gray-200 p-6">
            <div className="space-y-4">
              <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
              <div className="space-y-3 mt-8">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#F3F4F6] flex flex-col overflow-hidden">
      {/* Top bar with search */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <div className="flex items-center gap-4">
          <div className="w-52 flex-shrink-0 px-3">
            <img 
              src="/drime-logo.png" 
              alt="Drime" 
              className="h-8 w-auto"
            />
          </div>
          
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <input
                type="text"
                placeholder={locale === 'fr' ? 'Rechercher des documents...' : 'Search documents...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-[10px] text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#08CF65] focus:border-transparent transition-all"
              />
              <svg 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Right side - Notifications & Profile */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Notifications */}
            <div className="relative" ref={notificationsRef}>
              <Tooltip content={t('notifications.title')} position="bottom">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2.5 text-gray-600 hover:bg-[#ECEEF0] rounded-lg transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </button>
              </Tooltip>

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
                            <div className={`w-9 h-9 rounded-full ${getAvatarColor(user?.email || '')} flex items-center justify-center text-xs font-semibold text-gray-800 flex-shrink-0`}>
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
                    <p className="text-xs text-gray-500 mb-2">{user?.name || user?.email?.split('@')[0]} {locale === 'fr' ? 'de quota:' : 'quota:'}</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                            <svg className="w-4 h-4 text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </div>
                          <span className="text-sm text-gray-700">Sign - {locale === 'fr' ? 'Gratuit' : 'Free'}</span>
                        </div>
                        <a href="https://drime.cloud/fr/pricing" className="text-xs text-[#08CF65] hover:underline">{locale === 'fr' ? 'Mettre à niveau' : 'Upgrade'}</a>
                      </div>
                      <p className="text-xs text-gray-500 pl-8">{locale === 'fr' ? '2/5 signatures pour votre Workspace' : '2/5 signatures for your Workspace'}</p>
                    </div>
                    <a 
                      href="https://app.drime.cloud/account-settings#billing" 
                      className="block w-full mt-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-center"
                    >
                      {locale === 'fr' ? 'Voir et gérer la souscription' : 'View and manage subscription'}
                    </a>
                  </div>

                  {/* Menu items */}
                  <div className="py-2">
                    <a
                      href="https://app.drime.cloud/account-settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      {t('profile.profileSettings')}
                    </a>
                    <a
                      href="https://app.drime.cloud/account-settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
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
                            alt={t('profile.mySignature')}
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
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                      </svg>
                      {t('profile.pricingFeatures')}
                    </a>
                    <div className="border-t border-gray-100 my-1" />
                    {/* Language toggle */}
                    <button
                      onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                        </svg>
                        <span>{locale === 'fr' ? 'Langue' : 'Language'}</span>
                      </div>
                      <span className="text-gray-500">{locale === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}</span>
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={clearSessionAndRedirect}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
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
        {/* Sidebar */}
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
                <button
                  onClick={() => { setViewType('my_documents'); setFilterStatus('all') }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    viewType === 'my_documents' && filterStatus === 'all'
                      ? 'bg-[#ECEEF0] text-gray-900'
                      : 'text-gray-900 hover:bg-[#ECEEF0]'
                  }`}
                >
                  <DocumentIcon />
                  {t('agreements.title')}
                </button>
                <button
                  onClick={() => { setViewType('sent_to_me'); setFilterStatus('all') }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    viewType === 'sent_to_me'
                      ? 'bg-[#ECEEF0] text-gray-900'
                      : 'text-gray-900 hover:bg-[#ECEEF0]'
                  }`}
                >
                  <MailIcon />
                  {locale === 'fr' ? 'Reçus' : 'Sent to me'}
                </button>
              </div>
            </div>

            {/* Filtered by status */}
            <div>
              <p className="text-xs font-medium text-gray-500 px-3 mb-2">{locale === 'fr' ? 'Filtrer par statut' : 'Filtered by status'}</p>
              <div className="space-y-1">
                <button
                  onClick={() => setFilterStatus('need_to_sign')}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'need_to_sign'
                      ? 'bg-[#ECEEF0] text-gray-900'
                      : 'text-gray-900 hover:bg-[#ECEEF0]'
                  }`}
                >
                  <PenIcon />
                  {locale === 'fr' ? 'À signer' : 'Need to sign'}
                </button>
                <button
                  onClick={() => setFilterStatus('in_progress')}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'in_progress'
                      ? 'bg-[#ECEEF0] text-gray-900'
                      : 'text-gray-900 hover:bg-[#ECEEF0]'
                  }`}
                >
                  <ClockIcon />
                  {locale === 'fr' ? 'En cours' : 'In progress'}
                </button>
                <button
                  onClick={() => setFilterStatus('completed')}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'completed'
                      ? 'bg-[#ECEEF0] text-gray-900'
                      : 'text-gray-900 hover:bg-[#ECEEF0]'
                  }`}
                >
                  <CheckIcon />
                  {locale === 'fr' ? 'Approuvés' : 'Approved'}
                </button>
                <button
                  onClick={() => setFilterStatus('rejected')}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'rejected'
                      ? 'bg-[#ECEEF0] text-gray-900'
                      : 'text-gray-900 hover:bg-[#ECEEF0]'
                  }`}
                >
                  <XIcon />
                  {locale === 'fr' ? 'Refusés' : 'Rejected'}
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 bg-white rounded-xl flex flex-col min-h-0 border border-gray-200">
          {/* Header */}
          <div className="px-8 py-5 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-semibold text-gray-900">
                  {viewType === 'my_documents' ? t('agreements.title') : (locale === 'fr' ? 'Reçus' : 'Sent to me')}
                </h1>
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {locale === 'fr' ? 'Visible uniquement par vous' : 'Visible only to you'}
                </span>
              </div>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Sign securely button with dropdown */}
              <div className="relative" ref={signDropdownRef}>
                <button 
                  onClick={() => setShowSignDropdown(!showSignDropdown)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#08CF65] hover:bg-[#07B859] text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11.3987 7.5332L15.1494 12.7706C15.3994 13.1296 15.3576 13.6063 15.0492 13.907C13.9128 14.9762 11.3238 17.5818 9.91202 20.0715C9.74467 20.3634 9.45279 20.5055 9.15993 20.5055C8.85929 20.5055 8.56741 20.3634 8.40006 20.0715C6.99707 17.5818 4.39931 14.9762 3.27167 13.907C2.95351 13.6063 2.91168 13.1296 3.1627 12.7706L5.03805 10.1519" />
                    <path d="M9.1582 14.4102L9.15836 20.5118" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.5289 13.0398C10.5289 12.2819 9.91493 11.668 9.15701 11.668C8.40006 11.668 7.78516 12.2819 7.78516 13.0398C7.78516 13.7977 8.40006 14.4117 9.15701 14.4117C9.91493 14.4117 10.5289 13.7977 10.5289 13.0398Z" />
                    <path d="M12.3012 3.48828C13.1905 3.48828 13.8317 4.34058 13.5865 5.19483L13.2382 6.40517C13.0455 7.07553 12.4326 7.53671 11.735 7.53671H6.5803C5.8827 7.53671 5.26975 7.07553 5.0771 6.40517L4.72879 5.19483C4.48263 4.34058 5.12478 3.48828 6.01405 3.48828H9.15763" />
                    <path d="M12.2617 20.5137C14.446 20.5137 14.446 19.7266 16.6293 19.7266C18.8145 19.7266 18.8145 20.5137 20.9997 20.5137" />
                  </svg>
                  {locale === 'fr' ? 'Signer' : 'Sign securely'}
                  <svg className={`w-4 h-4 transition-transform ${showSignDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showSignDropdown && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-[10px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] py-2 min-w-[200px] z-10">
                    <button
                      onClick={() => {
                        setShowSignDropdown(false)
                        fileInputRef.current?.click()
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                    >
                      <DeviceIcon />
                      {t('dashboard.fromDevice')}
                    </button>
                    <button
                      onClick={() => {
                        setShowSignDropdown(false)
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
            </div>
          </div>

          {/* Column headers with integrated selection toolbar */}
          <div className="flex items-center px-8 h-14 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider flex-shrink-0">
            {/* Checkbox - only visible when selecting */}
            <div className="w-8 mr-3 flex items-center justify-center">
              {selectedDocs.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedDocs.length === filteredEnvelopes.length && filteredEnvelopes.length > 0
                      ? 'bg-[#08CF65] border-[#08CF65]' 
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                >
                  {selectedDocs.length === filteredEnvelopes.length && filteredEnvelopes.length > 0 ? (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <div className="w-2 h-0.5 bg-gray-400 rounded" />
                  )}
                </button>
              )}
            </div>
            
            {/* Show selection info or column name */}
            {selectedDocs.length > 0 ? (
              <div className="flex-1 flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 normal-case tracking-normal">
                  {selectedDocs.length} sélectionné{selectedDocs.length > 1 ? 's' : ''}
                </span>
                <button
                  onClick={handleBulkDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors normal-case tracking-normal"
                >
                  <DownloadIcon />
                  Télécharger
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors normal-case tracking-normal"
                >
                  <DeleteIcon />
                  Supprimer
                </button>
              </div>
            ) : (
              <div className="flex-1">{locale === 'fr' ? 'Nom' : 'Name'}</div>
            )}
            
            <div className="w-32">{selectedDocs.length === 0 && (locale === 'fr' ? 'Statut' : 'Status')}</div>
            <div className="w-32">{selectedDocs.length === 0 && (locale === 'fr' ? 'Destinataires' : 'Recipients')}</div>
            <div className="w-28">{selectedDocs.length === 0 && (locale === 'fr' ? 'Mis à jour' : 'Last updated')}</div>
            <div className="w-10"></div>
          </div>

          {/* Scrollable documents list */}
          <div className="flex-1 overflow-y-auto">
            {filteredEnvelopes.length === 0 ? (
              <div className="py-20 text-center px-8">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <DocumentIcon />
                </div>
                <p className="text-gray-600 mb-1">{locale === 'fr' ? 'Aucun document' : 'No documents'}</p>
                <p className="text-gray-400 text-sm mb-4">
                  {searchQuery ? (locale === 'fr' ? 'Aucun résultat trouvé' : 'No results found') : (locale === 'fr' ? 'Créez votre premier document' : 'Create your first document')}
                </p>
                {!searchQuery && (
                  <Link href="/send" className="text-[#08CF65] text-sm font-medium hover:underline">
                    + {locale === 'fr' ? 'Nouveau document' : 'New document'}
                  </Link>
                )}
              </div>
            ) : (
              <div>
                {filteredEnvelopes.map((envelope) => {
                  const statusBadge = getStatusBadge(envelope.status, envelope.signers)
                  
                  return (
                    <div
                      key={envelope.id}
                      onClick={() => handleDocumentClick(envelope)}
                      className={`flex items-center py-2.5 px-8 border-b border-gray-50 hover:bg-[#F5F5F5] cursor-pointer transition-colors group ${
                        selectedDocs.includes(envelope.id) ? 'bg-[#08CF65]/5' : ''
                      }`}
                    >
                      {/* Checkbox - visible on hover or when selected */}
                      <div className="w-8 mr-3 flex-shrink-0 flex items-center justify-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleDocSelection(envelope.id) }}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            selectedDocs.includes(envelope.id)
                              ? 'bg-[#08CF65] border-[#08CF65] opacity-100' 
                              : 'border-gray-300 bg-white hover:border-gray-400 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {selectedDocs.includes(envelope.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* Document name with thumbnail */}
                      <div className="flex-1 flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded bg-white border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {envelope.thumbnailUrl ? (
                            <img 
                              src={getProxyUrl(envelope.thumbnailUrl)} 
                              alt="" 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          ) : (
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                        </div>
                        <span className="text-[15px] text-gray-900 truncate">
                          {envelope.name}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="w-32">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.bgColor} ${statusBadge.textColor}`}>
                          {statusBadge.icon}
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* Recipients - clickable to show signing order */}
                      <div className="w-32">
                        <Tooltip content="Click to see recipient list" position="top">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSigningOrderModal(envelope) }}
                            className="flex -space-x-2 hover:opacity-80 transition-opacity"
                          >
                            {envelope.signers.slice(0, 3).map((signer, i) => (
                              <div
                                key={i}
                                className={`w-7 h-7 rounded-full ${getAvatarColor(signer.email)} flex items-center justify-center text-[10px] font-semibold text-gray-800 ring-2 ring-white`}
                              >
                                {(signer.name || signer.email).slice(0, 2).toUpperCase()}
                              </div>
                            ))}
                            {envelope.signers.length > 3 && (
                              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600 ring-2 ring-white">
                                +{envelope.signers.length - 3}
                              </div>
                            )}
                          </button>
                        </Tooltip>
                      </div>

                      {/* Date */}
                      <div className="w-28">
                        <span className="text-sm text-gray-500">
                          {formatDate(envelope.updatedAt || envelope.createdAt)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="w-10 flex justify-center relative" ref={openMenuId === envelope.id ? menuRef : null}>
                        <Tooltip content="More actions" position="top">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation()
                              setOpenMenuId(openMenuId === envelope.id ? null : envelope.id)
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-all"
                          >
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                          </button>
                        </Tooltip>
                        
                        {/* Dropdown Menu */}
                        {openMenuId === envelope.id && (
                          <div className="absolute right-0 top-8 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[220px]">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleView(envelope) }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                            >
                              <ViewIcon />
                              {locale === 'fr' ? 'Voir' : 'View'}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAddRecipients(envelope) }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                            >
                              <AddRecipientsIcon />
                              <span className="text-left whitespace-pre-line">{locale === 'fr' ? 'Ajouter des\ndestinataires' : 'Add\nrecipients'}</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAuditTrail(envelope) }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                            >
                              <AuditIcon />
                              {locale === 'fr' ? 'Historique' : 'Activity'}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRename(envelope) }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                            >
                              <RenameIcon />
                              {locale === 'fr' ? 'Renommer' : 'Rename'}
                            </button>
                            <div className="border-t border-gray-100 my-1" />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(envelope) }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <DeleteIcon />
                              {locale === 'fr' ? 'Supprimer' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Rename Modal - Transfr style with animation */}
      <AnimatePresence>
        {renameModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setRenameModalOpen(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-[10px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] w-full max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">{t('modals.renameDocument')}</h3>
                <button 
                  onClick={() => setRenameModalOpen(null)} 
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#08CF65] focus:ring-[3px] focus:ring-[#08CF65]/20"
                  placeholder="Document name"
                  autoFocus
                />
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setRenameModalOpen(null)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={submitRename}
                    className="px-4 py-2 bg-[#08CF65] hover:bg-[#07B859] text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {locale === 'fr' ? 'Renommer' : 'Rename'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Signing Order Modal - Transfr style with animation */}
      <AnimatePresence>
        {signingOrderModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setSigningOrderModal(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-[10px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] w-full max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Signing order</h3>
                <button
                  onClick={() => setSigningOrderModal(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="space-y-0">
                  {/* Sender */}
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-[#08CF65] flex items-center justify-center text-white text-sm font-medium">
                        1
                      </div>
                      <div className="w-px h-6 bg-gray-200 border-l border-dashed border-gray-300" />
                    </div>
                    <div className="flex-1 flex items-center gap-3 pb-4">
                      <span className="text-sm text-gray-600">Sender</span>
                      <Tooltip content={user?.name || user?.email || 'Sender'} position="bottom">
                        <div className={`w-9 h-9 rounded-full ${getAvatarColor(signingOrderModal.createdBy || user?.email || '')} flex items-center justify-center text-xs font-semibold text-gray-800`}>
                          {(user?.name || user?.email || 'U').slice(0, 2).toUpperCase()}
                        </div>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Signers */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                        signingOrderModal.signers.every(s => s.status === 'signed') ? 'bg-[#08CF65]' : 'bg-[#7E33F7]'
                      }`}>
                        2
                      </div>
                      <div className="w-px flex-1 min-h-[24px] border-l border-dashed border-gray-300" />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm text-gray-600">{locale === 'fr' ? 'Signataires' : 'Signers'}</span>
                        {signingOrderModal.signers.every(s => s.status === 'signed') ? (
                          <span className="flex items-center gap-1 text-xs text-[#08CF65]">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Approved
                          </span>
                        ) : signingOrderModal.signers.some(s => s.status === 'pending') ? (
                          <span className="flex items-center gap-1 text-xs text-[#FFAD12]">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                            Need to sign
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {signingOrderModal.signers.map((signer, i) => (
                          <Tooltip 
                            key={i} 
                            content={`${signer.name || signer.email}${signer.status === 'signed' ? ' - Signé ✓' : ' - En attente'}`} 
                            position="bottom"
                          >
                            <div className="relative">
                              <div
                                className={`w-9 h-9 rounded-full ${getAvatarColor(signer.email)} flex items-center justify-center text-xs font-semibold text-gray-800 ${signer.status === 'signed' ? 'ring-2 ring-[#08CF65]' : ''}`}
                              >
                                {(signer.name || signer.email).slice(0, 2).toUpperCase()}
                              </div>
                              {signer.status === 'signed' && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#08CF65] rounded-full flex items-center justify-center">
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Final status */}
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        signingOrderModal.status === 'completed' ? 'bg-[#08CF65] text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {signingOrderModal.status === 'completed' ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : '3'}
                      </div>
                    </div>
                    <div className="flex-1">
                      <span className="text-sm text-gray-600">
                        {signingOrderModal.status === 'completed' ? 'Approved' : 'In progress'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal with animation */}
      <AnimatePresence>
        {deleteConfirmModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setDeleteConfirmModal(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-[10px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] w-full max-w-lg"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">{t('modals.deleteConfirm')}</h3>
                <button 
                  onClick={() => setDeleteConfirmModal(null)} 
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-6">
                  {t('modals.deleteWarning')}
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteConfirmModal(null)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </div>
  )
}

// Wrap in Suspense to handle useSearchParams
export default function Agreements() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[#F3F4F6] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Chargement...</p>
        </div>
      </div>
    }>
      <AgreementsContent />
    </Suspense>
  )
}
