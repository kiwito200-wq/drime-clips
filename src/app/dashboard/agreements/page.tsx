'use client'

import { useState, useEffect, useCallback, useMemo, Suspense, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import DrimeFilePicker from '@/components/DrimeFilePicker'
import SignatureEditorModal from '@/components/SignatureEditorModal'
import Tooltip from '@/components/Tooltip'
import { useI18n } from '@/lib/i18n/I18nContext'
import { SecureThumbnailSmall } from '@/components/SecureThumbnail'

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

const DRIME_LOGIN_URL = 'https://app.drime.cloud/login'

// Menu Icons - using new Iconly icons
const ViewIcon = () => (
  <img src="/icons/view.svg" alt="" className="w-5 h-5" />
)

const AddRecipientsIcon = () => (
  <img src="/icons/add-recipients.svg" alt="" className="w-5 h-5" />
)

const DownloadIcon = () => (
  <img src="/icons/download.svg" alt="" className="w-5 h-5" />
)

const AuditIcon = () => (
  <img src="/icons/clock.svg" alt="" className="w-5 h-5" />
)

const RenameIcon = () => (
  <img src="/icons/rename.svg" alt="" className="w-5 h-5" />
)

const DeleteIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.9624 3.87898L15.7806 5.66377H18.42C19.2315 5.66377 19.8894 6.32166 19.8894 7.1332V8.2214C19.8894 8.77625 19.4396 9.22605 18.8848 9.22605H5.11501C4.56015 9.22605 4.11035 8.77625 4.11035 8.2214V7.1332C4.11035 6.32166 4.76823 5.66377 5.57978 5.66377H8.2192L9.0374 3.87898C9.28294 3.34338 9.8181 3 10.4073 3H13.5925C14.1817 3 14.7168 3.34338 14.9624 3.87898Z" />
    <path d="M18.3504 9.30078V17.9865C18.3504 19.6511 17.0177 21.0005 15.3738 21.0005H8.62696C6.98305 21.0005 5.65039 19.6511 5.65039 17.9865V9.30078" />
  </svg>
)

// Import dropdown icons
const DeviceIcon = () => (
  <img src="/icons/device.svg" alt="" className="w-5 h-5" />
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

const ClockIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21C16.9709 21 21 16.9699 21 12C21 7.02908 16.9709 3 12 3C7.02908 3 3 7.02908 3 12C3 16.9699 7.02908 21 12 21Z" />
    <path d="M15.7096 12.0766L12 12.0766V6.47766" />
  </svg>
)

const CheckIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 7.1875L9.375 16.8125L5 12.4375" />
  </svg>
)

const XIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6L18 18" />
    <path d="M18 6L6 18" />
  </svg>
)

function AgreementsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
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
  const [bulkDeleteConfirmModal, setBulkDeleteConfirmModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [showSignDropdown, setShowSignDropdown] = useState(false)
  const [showEmptySignDropdown, setShowEmptySignDropdown] = useState(false)
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
  
  // Persist read notifications to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('readNotifications', JSON.stringify(readNotifications))
    }
  }, [readNotifications])
  const menuRef = useRef<HTMLDivElement>(null)
  const signDropdownRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const emptySignDropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  
  // Marquee selection refs and state
  const documentListRef = useRef<HTMLDivElement>(null)
  const documentRowRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null)
  
  // Context menu state (right-click)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; envelopeId: string; showAbove: boolean } | null>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
      if (signDropdownRef.current && !signDropdownRef.current.contains(event.target as Node)) {
        setShowSignDropdown(false)
      }
      if (emptySignDropdownRef.current && !emptySignDropdownRef.current.contains(event.target as Node)) {
        setShowEmptySignDropdown(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
      // Close context menu on click outside (but not if clicking inside it)
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, envelope: Envelope) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Calculate if menu should show above or below
    const menuHeight = 280 // Approximate menu height
    const viewportHeight = window.innerHeight
    const showAbove = e.clientY + menuHeight > viewportHeight - 20
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      envelopeId: envelope.id,
      showAbove
    })
    setOpenMenuId(null) // Close any open three-dot menu
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

  // Load subscription info
  useEffect(() => {
    if (user) {
      // Get current subscription
      fetch('/api/subscription', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setSubscription(data)
          }
        })
        .catch(() => {})
      
      // Sync from Drime (background)
      fetch('/api/subscription', { method: 'POST', credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (!data.error && data.synced) {
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

  // Marquee selection handlers
  const handleMarqueeStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only start selection on left click and on empty space (not on documents)
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    // Don't start marquee if clicking on a document row or interactive element
    if (target.closest('[data-doc-row]') || target.closest('button') || target.closest('a')) return
    
    const container = documentListRef.current
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left + container.scrollLeft
    const y = e.clientY - rect.top + container.scrollTop
    
    setSelectionStart({ x, y })
    setSelectionEnd({ x, y })
    setIsSelecting(true)
    
    // Prevent text selection
    e.preventDefault()
  }, [])

  const handleMarqueeMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !selectionStart) return
    
    const container = documentListRef.current
    if (!container) return
    
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left + container.scrollLeft
    const y = e.clientY - rect.top + container.scrollTop
    
    setSelectionEnd({ x, y })
    
    // Calculate which documents are within the selection rectangle
    const selRect = {
      left: Math.min(selectionStart.x, x),
      right: Math.max(selectionStart.x, x),
      top: Math.min(selectionStart.y, y),
      bottom: Math.max(selectionStart.y, y),
    }
    
    const selectedIds: string[] = []
    documentRowRefs.current.forEach((rowEl, docId) => {
      const rowRect = rowEl.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      
      // Convert row rect to container coordinates
      const rowTop = rowRect.top - containerRect.top + container.scrollTop
      const rowBottom = rowRect.bottom - containerRect.top + container.scrollTop
      const rowLeft = rowRect.left - containerRect.left + container.scrollLeft
      const rowRight = rowRect.right - containerRect.left + container.scrollLeft
      
      // Check if selection rectangle intersects with row
      if (
        selRect.left < rowRight &&
        selRect.right > rowLeft &&
        selRect.top < rowBottom &&
        selRect.bottom > rowTop
      ) {
        selectedIds.push(docId)
      }
    })
    
    setSelectedDocs(selectedIds)
  }, [isSelecting, selectionStart])

  const handleMarqueeEnd = useCallback(() => {
    setIsSelecting(false)
    setSelectionStart(null)
    setSelectionEnd(null)
  }, [])

  // Global mouse up handler for marquee
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSelecting) {
        handleMarqueeEnd()
      }
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [isSelecting, handleMarqueeEnd])

  // Calculate selection rectangle for rendering
  const selectionRect = useMemo(() => {
    if (!isSelecting || !selectionStart || !selectionEnd) return null
    return {
      left: Math.min(selectionStart.x, selectionEnd.x),
      top: Math.min(selectionStart.y, selectionEnd.y),
      width: Math.abs(selectionEnd.x - selectionStart.x),
      height: Math.abs(selectionEnd.y - selectionStart.y),
    }
  }, [isSelecting, selectionStart, selectionEnd])

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

  const handleBulkDelete = () => {
    setBulkDeleteConfirmModal(true)
  }

  const confirmBulkDelete = async () => {
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
    setBulkDeleteConfirmModal(false)
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
            <Tooltip content={t('nav.backToDrime')} position="right">
              <a href="https://app.drime.cloud/drive" className="block">
                <img 
                  src="/drime-logo.png" 
                  alt="Drime" 
                  className="h-8 w-auto cursor-pointer hover:opacity-80 transition-opacity"
                />
              </a>
            </Tooltip>
          </div>
          
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <input
                type="text"
                placeholder={t('agreements.searchDocuments')}
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
                          <div className="py-6 text-center">
                            <img src="/empty-notifications.png" alt="" className="w-20 h-20 mx-auto mb-2 object-contain" />
                            <p className="text-sm text-gray-500">{t('notifications.noNotifications')}</p>
                          </div>
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
                          <div className="py-6 text-center">
                            <img src="/empty-notifications.png" alt="" className="w-20 h-20 mx-auto mb-2 object-contain" />
                            <p className="text-sm text-gray-500">{t('notifications.noNotifications')}</p>
                          </div>
                        )}
                      </>
                    )}
                    {notificationTab === 'requests' && (
                      <div className="py-6 text-center">
                        <img src="/empty-notifications.png" alt="" className="w-20 h-20 mx-auto mb-2 object-contain" />
                        <p className="text-sm text-gray-500">{t('notifications.noNotifications')}</p>
                      </div>
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

                  {/* Signature section - moved up */}
                  <div className="px-4 py-3 border-b border-gray-100">
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
                  {t('agreements.received')}
                </button>
                <Link
                  href="/templates"
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === '/templates'
                      ? 'bg-[#ECEEF0] text-gray-900'
                      : 'text-gray-900 hover:bg-[#ECEEF0]'
                  }`}
                >
                  <img src="/icons/bookmark.svg" alt="" className="w-5 h-5" style={{ filter: 'brightness(0)' }} />
                  {t('agreements.templates')}
                </Link>
              </div>
            </div>

            {/* Filtered by status */}
            <div>
              <p className="text-xs font-medium text-gray-500 px-3 mb-2">{t('agreements.filterStatus')}</p>
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
                  {t('agreements.needToSign')}
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
                  {t('agreements.inProgress')}
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
                  {t('agreements.approved')}
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
                  {t('agreements.rejected')}
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
                  {viewType === 'my_documents' ? t('agreements.title') : t('agreements.received')}
                </h1>
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {t('agreements.visibleOnlyToYou')}
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
                  {t('agreements.signSecurely')}
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
                  {selectedDocs.length} {locale === 'fr' ? (selectedDocs.length > 1 ? 'sélectionnés' : 'sélectionné') : 'selected'}
                </span>
                <button
                  onClick={handleBulkDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors normal-case tracking-normal"
                >
                  <DownloadIcon />
                  {t('common.download')}
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors normal-case tracking-normal"
                >
                  <DeleteIcon />
                  {t('common.delete')}
                </button>
              </div>
            ) : (
              <div className="w-[400px] flex-shrink-0">{t('agreements.name')}</div>
            )}
            
            <div className="w-[180px] flex-shrink-0">{selectedDocs.length === 0 && t('agreements.status')}</div>
            <div className="w-[180px] flex-shrink-0">{selectedDocs.length === 0 && t('agreements.recipients')}</div>
            <div className="flex-1">{selectedDocs.length === 0 && t('agreements.lastUpdated')}</div>
            <div className="w-10"></div>
          </div>

          {/* Scrollable documents list */}
          <div 
            ref={documentListRef}
            className="flex-1 overflow-y-auto relative select-none"
            onMouseDown={handleMarqueeStart}
            onMouseMove={handleMarqueeMove}
            onMouseUp={handleMarqueeEnd}
          >
            {/* Marquee selection rectangle */}
            {selectionRect && (
              <div
                className="absolute pointer-events-none z-10"
                style={{
                  left: selectionRect.left,
                  top: selectionRect.top,
                  width: selectionRect.width,
                  height: selectionRect.height,
                  backgroundColor: 'rgba(8, 207, 101, 0.1)',
                  border: '1px solid rgba(8, 207, 101, 0.5)',
                  borderRadius: '2px',
                }}
              />
            )}
            {filteredEnvelopes.length === 0 ? (
              <div className="py-16 text-center px-8">
                <img 
                  src="/empty-documents.png" 
                  alt="" 
                  className="w-32 h-32 mx-auto mb-4 object-contain"
                />
                <p className="text-gray-900 mb-1">{t('agreements.noDocuments')}</p>
                <p className="text-gray-400 text-sm mb-4">
                  {searchQuery ? t('agreements.noResultsFound') : t('agreements.createFirstDocument')}
                </p>
                {!searchQuery && (
                  <div className="relative inline-block" ref={emptySignDropdownRef}>
                    <button 
                      onClick={() => setShowEmptySignDropdown(!showEmptySignDropdown)}
                      className="flex items-center gap-2 px-4 py-2.5 border border-[#E6E6E9] hover:bg-gray-50 text-gray-900 text-sm font-medium rounded-lg transition-colors"
                    >
                      {t('agreements.newDocument')}
                      <svg className={`w-4 h-4 transition-transform ${showEmptySignDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {showEmptySignDropdown && (
                      <div className="absolute left-1/2 transform -translate-x-1/2 top-full mt-2 bg-white rounded-[10px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] py-2 min-w-[200px] z-10">
                        <button
                          onClick={() => {
                            setShowEmptySignDropdown(false)
                            fileInputRef.current?.click()
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                        >
                          <DeviceIcon />
                          {t('dashboard.fromDevice')}
                        </button>
                        <button
                          onClick={() => {
                            setShowEmptySignDropdown(false)
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
                )}
              </div>
            ) : (
              <div>
                {filteredEnvelopes.map((envelope) => {
                  const statusBadge = getStatusBadge(envelope.status, envelope.signers)
                  
                  return (
                    <div
                      key={envelope.id}
                      data-doc-row
                      ref={(el) => {
                        if (el) {
                          documentRowRefs.current.set(envelope.id, el)
                        } else {
                          documentRowRefs.current.delete(envelope.id)
                        }
                      }}
                      onClick={() => handleDocumentClick(envelope)}
                      onContextMenu={(e) => handleContextMenu(e, envelope)}
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
                      <div className="w-[400px] flex-shrink-0 flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded bg-white border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {/* SECURITY: Use SecureThumbnail component for authenticated access */}
                          <SecureThumbnailSmall slug={envelope.slug} alt={envelope.name} />
                        </div>
                        <span className="text-[15px] text-gray-900 truncate">
                          {envelope.name}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="w-[180px] flex-shrink-0">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.bgColor} ${statusBadge.textColor}`}>
                          {statusBadge.icon}
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* Recipients - clickable to show signing order */}
                      <div className="w-[180px] flex-shrink-0">
                        <Tooltip content="Click to see recipient list" position="top">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSigningOrderModal(envelope) }}
                            className="flex -space-x-2 hover:opacity-80 transition-opacity"
                          >
                            {envelope.signers.slice(0, 3).map((signer, i) => (
                              <div
                                key={i}
                                className={`w-7 h-7 rounded-full ${signer.email === user?.email && user?.avatarUrl ? '' : getAvatarColor(signer.email)} flex items-center justify-center text-[10px] font-semibold text-gray-800 ring-2 ring-white overflow-hidden`}
                              >
                                {signer.email === user?.email && user?.avatarUrl ? (
                                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  (signer.name || signer.email).slice(0, 2).toUpperCase()
                                )}
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
                      <div className="flex-1">
                        <span className="text-sm text-gray-900">
                          {formatDate(envelope.updatedAt || envelope.createdAt)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="w-10 flex justify-center relative" ref={openMenuId === envelope.id ? menuRef : null}>
                        <Tooltip content={t('agreements.moreActions')} position="top">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation()
                              setOpenMenuId(openMenuId === envelope.id ? null : envelope.id)
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-all"
                          >
                            <svg className="w-5 h-5 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                              {t('agreements.view')}
                            </button>
                            <button
                              onClick={(e) => { 
                                e.stopPropagation()
                                window.open(`/api/envelopes/${envelope.slug}/download`, '_blank')
                                setOpenMenuId(null)
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                            >
                              <DownloadIcon />
                              {t('agreements.download')}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAddRecipients(envelope) }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                            >
                              <AddRecipientsIcon />
                              <span className="text-left whitespace-pre-line">{t('agreements.addRecipients')}</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAuditTrail(envelope) }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                            >
                              <AuditIcon />
                              {t('agreements.activity')}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRename(envelope) }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                            >
                              <RenameIcon />
                              {t('agreements.rename')}
                            </button>
                            <div className="border-t border-gray-100 my-1" />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(envelope) }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <DeleteIcon />
                              {t('agreements.delete')}
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

      {/* Context Menu (Right-click) */}
      {contextMenu && (() => {
        const envelope = envelopes.find(e => e.id === contextMenu.envelopeId)
        if (!envelope) return null
        
        return (
          <div
            ref={contextMenuRef}
            className="fixed z-[9999] bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[220px]"
            style={{
              left: contextMenu.x,
              top: contextMenu.showAbove ? 'auto' : contextMenu.y,
              bottom: contextMenu.showAbove ? `calc(100vh - ${contextMenu.y}px)` : 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => { e.stopPropagation(); handleView(envelope); setContextMenu(null) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
            >
              <ViewIcon />
              {t('agreements.view')}
            </button>
            <button
              onClick={(e) => { 
                e.stopPropagation()
                window.open(`/api/envelopes/${envelope.slug}/download`, '_blank')
                setContextMenu(null)
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
            >
              <DownloadIcon />
              {t('agreements.download')}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleAddRecipients(envelope); setContextMenu(null) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
            >
              <AddRecipientsIcon />
              <span className="text-left whitespace-pre-line">{t('agreements.addRecipients')}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleAuditTrail(envelope); setContextMenu(null) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
            >
              <AuditIcon />
              {t('agreements.activity')}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleRename(envelope); setContextMenu(null) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
            >
              <RenameIcon />
              {t('agreements.rename')}
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(envelope); setContextMenu(null) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <DeleteIcon />
              {t('agreements.delete')}
            </button>
          </div>
        )
      })()}

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
                    className="px-4 py-2 text-sm text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={submitRename}
                    className="px-4 py-2 bg-[#08CF65] hover:bg-[#07B859] text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {t('agreements.rename')}
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
                <h3 className="text-lg font-semibold text-gray-900">{t('modals.signingOrder')}</h3>
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
                      <span className="text-sm text-gray-600">{t('agreements.sender')}</span>
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
                        <span className="text-sm text-gray-600">{t('agreements.signers')}</span>
                        {signingOrderModal.signers.every(s => s.status === 'signed') ? (
                          <span className="flex items-center gap-1 text-xs text-[#08CF65]">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {t('agreements.approved')}
                          </span>
                        ) : signingOrderModal.signers.some(s => s.status === 'pending') ? (
                          <span className="flex items-center gap-1 text-xs text-[#FFAD12]">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                            {t('agreements.needToSign')}
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
                                className={`w-9 h-9 rounded-full ${signer.email === user?.email && user?.avatarUrl ? '' : getAvatarColor(signer.email)} flex items-center justify-center text-xs font-semibold text-gray-800 ${signer.status === 'signed' ? 'ring-2 ring-[#08CF65]' : ''} overflow-hidden`}
                              >
                                {signer.email === user?.email && user?.avatarUrl ? (
                                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  (signer.name || signer.email).slice(0, 2).toUpperCase()
                                )}
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
                        {signingOrderModal.status === 'completed' ? t('agreements.approved') : t('agreements.inProgress')}
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
                    className="px-4 py-2 text-sm text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
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

      {/* Bulk Delete Confirmation Modal */}
      <AnimatePresence>
        {bulkDeleteConfirmModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setBulkDeleteConfirmModal(false)}
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
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('agreements.deleteDocuments')}
                </h3>
                <button 
                  onClick={() => setBulkDeleteConfirmModal(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-6">
                  {locale === 'fr' 
                    ? `Êtes-vous sûr de vouloir supprimer ${selectedDocs.length} document(s) ? Cette action est irréversible.`
                    : `Are you sure you want to delete ${selectedDocs.length} document(s)? This action cannot be undone.`
                  }
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setBulkDeleteConfirmModal(false)}
                    className="px-4 py-2 text-sm text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={confirmBulkDelete}
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
        </div>
      </div>
    }>
      <AgreementsContent />
    </Suspense>
  )
}
