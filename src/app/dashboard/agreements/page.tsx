'use client'

import { useState, useEffect, useCallback, useMemo, Suspense, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

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

const DRIME_LOGIN_URL = 'https://staging.drime.cloud/login'

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

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
  const [user, setUser] = useState<User | null>(null)
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [viewType, setViewType] = useState<ViewType>('my_documents')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [renameModalOpen, setRenameModalOpen] = useState<string | null>(null)
  const [dueDateModalOpen, setDueDateModalOpen] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [selectedDueDate, setSelectedDueDate] = useState<number>(7)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
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
        label: 'Need to sign', 
        bgColor: 'bg-[#F3E8FF]',
        textColor: 'text-[#7E33F7]',
        icon: <PenIcon />
      }
    }
    
    if (status === 'completed') {
      return { 
        label: 'Approved', 
        bgColor: 'bg-[#DCFCE7]',
        textColor: 'text-[#08CF65]',
        icon: <CheckIcon />
      }
    }
    
    if (status === 'pending') {
      return { 
        label: 'In progress', 
        bgColor: 'bg-[#FFF4E5]',
        textColor: 'text-[#FFAD12]',
        icon: <ClockIcon />
      }
    }
    
    if (status === 'rejected') {
      return { 
        label: 'Rejected', 
        bgColor: 'bg-[#FFEEF0]',
        textColor: 'text-[#ED3757]',
        icon: <XIcon />
      }
    }
    
    return { 
      label: 'Draft', 
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-600',
      icon: null
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

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

  const handleChangeDueDate = (envelope: Envelope) => {
    setOpenMenuId(null)
    setDueDateModalOpen(envelope.slug)
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

  const handleDelete = async (envelope: Envelope) => {
    setOpenMenuId(null)
    if (confirm(`Are you sure you want to delete "${envelope.name}"?`)) {
      try {
        const res = await fetch(`/api/envelopes/${envelope.slug}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (res.ok) {
          setEnvelopes(prev => prev.filter(e => e.id !== envelope.id))
        } else {
          alert('Failed to delete document')
        }
      } catch (error) {
        console.error('Delete error:', error)
        alert('Failed to delete document')
      }
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

  const submitDueDate = async () => {
    if (!dueDateModalOpen) return
    try {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + selectedDueDate)
      
      const res = await fetch(`/api/envelopes/${dueDateModalOpen}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: dueDate.toISOString() }),
        credentials: 'include',
      })
      if (res.ok) {
        setDueDateModalOpen(null)
        fetchEnvelopes() // Refresh to get updated data
      } else {
        alert('Failed to update due date')
      }
    } catch (error) {
      console.error('Due date error:', error)
      alert('Failed to update due date')
    }
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
            <div className="relative flex items-center">
              <svg 
                className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#08CF65] focus:border-transparent transition-all"
              />
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
                  href="/"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-white transition-colors"
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
                <button
                  onClick={() => { setViewType('my_documents'); setFilterStatus('all') }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    viewType === 'my_documents' && filterStatus === 'all'
                      ? 'bg-[#DCFCE7] text-[#08CF65] font-medium'
                      : 'text-gray-700 hover:bg-white'
                  }`}
                >
                  <DocumentIcon />
                  My agreements
                </button>
                <button
                  onClick={() => { setViewType('sent_to_me'); setFilterStatus('all') }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    viewType === 'sent_to_me'
                      ? 'bg-[#DCFCE7] text-[#08CF65] font-medium'
                      : 'text-gray-700 hover:bg-white'
                  }`}
                >
                  <MailIcon />
                  Sent to me
                </button>
              </div>
            </div>

            {/* Filtered by status */}
            <div>
              <p className="text-xs font-medium text-gray-500 px-3 mb-2">Filtered by status</p>
              <div className="space-y-1">
                <button
                  onClick={() => setFilterStatus('need_to_sign')}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    filterStatus === 'need_to_sign'
                      ? 'bg-[#DCFCE7] text-[#08CF65] font-medium'
                      : 'text-gray-700 hover:bg-white'
                  }`}
                >
                  <PenIcon />
                  Need to sign
                </button>
                <button
                  onClick={() => setFilterStatus('in_progress')}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    filterStatus === 'in_progress'
                      ? 'bg-[#DCFCE7] text-[#08CF65] font-medium'
                      : 'text-gray-700 hover:bg-white'
                  }`}
                >
                  <ClockIcon />
                  In progress
                </button>
                <button
                  onClick={() => setFilterStatus('completed')}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    filterStatus === 'completed'
                      ? 'bg-[#DCFCE7] text-[#08CF65] font-medium'
                      : 'text-gray-700 hover:bg-white'
                  }`}
                >
                  <CheckIcon />
                  Approved
                </button>
                <button
                  onClick={() => setFilterStatus('rejected')}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    filterStatus === 'rejected'
                      ? 'bg-[#DCFCE7] text-[#08CF65] font-medium'
                      : 'text-gray-700 hover:bg-white'
                  }`}
                >
                  <XIcon />
                  Rejected
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
                  {viewType === 'my_documents' ? 'My agreements' : 'Sent to me'}
                </h1>
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Visible only to you
                </span>
              </div>
              <Link 
                href="/send" 
                className="flex items-center gap-2 px-4 py-2.5 bg-[#08CF65] hover:bg-[#07B859] text-white text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11.3987 7.5332L15.1494 12.7706C15.3994 13.1296 15.3576 13.6063 15.0492 13.907C13.9128 14.9762 11.3238 17.5818 9.91202 20.0715C9.74467 20.3634 9.45279 20.5055 9.15993 20.5055C8.85929 20.5055 8.56741 20.3634 8.40006 20.0715C6.99707 17.5818 4.39931 14.9762 3.27167 13.907C2.95351 13.6063 2.91168 13.1296 3.1627 12.7706L5.03805 10.1519" />
                  <path d="M9.1582 14.4102L9.15836 20.5118" />
                  <path fillRule="evenodd" clipRule="evenodd" d="M10.5289 13.0398C10.5289 12.2819 9.91493 11.668 9.15701 11.668C8.40006 11.668 7.78516 12.2819 7.78516 13.0398C7.78516 13.7977 8.40006 14.4117 9.15701 14.4117C9.91493 14.4117 10.5289 13.7977 10.5289 13.0398Z" />
                  <path d="M12.3012 3.48828C13.1905 3.48828 13.8317 4.34058 13.5865 5.19483L13.2382 6.40517C13.0455 7.07553 12.4326 7.53671 11.735 7.53671H6.5803C5.8827 7.53671 5.26975 7.07553 5.0771 6.40517L4.72879 5.19483C4.48263 4.34058 5.12478 3.48828 6.01405 3.48828H9.15763" />
                  <path d="M12.2617 20.5137C14.446 20.5137 14.446 19.7266 16.6293 19.7266C18.8145 19.7266 18.8145 20.5137 20.9997 20.5137" />
                </svg>
                Sign securely
              </Link>
            </div>
          </div>

          {/* Column headers */}
          <div className="flex items-center px-8 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider flex-shrink-0">
            <div className="flex-1 pl-2">Name</div>
            <div className="w-32">Status</div>
            <div className="w-32">Recipients</div>
            <div className="w-28">Last updated</div>
            <div className="w-10"></div>
          </div>

          {/* Scrollable documents list */}
          <div className="flex-1 overflow-y-auto px-8">
            {filteredEnvelopes.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <DocumentIcon />
                </div>
                <p className="text-gray-600 mb-1">No documents</p>
                <p className="text-gray-400 text-sm mb-4">
                  {searchQuery ? 'No results found' : 'Create your first document'}
                </p>
                {!searchQuery && (
                  <Link href="/send" className="text-[#08CF65] text-sm font-medium hover:underline">
                    + New document
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
                      className="flex items-center py-3.5 border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors group"
                    >
                      {/* Document name with thumbnail */}
                      <div className="flex-1 flex items-center gap-3 min-w-0 pl-2">
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
                        <span className="text-sm text-gray-900 truncate">
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

                      {/* Recipients */}
                      <div className="w-32">
                        <div className="flex -space-x-2">
                          {envelope.signers.slice(0, 3).map((signer, i) => (
                            <div
                              key={i}
                              className={`w-7 h-7 rounded-full ${getAvatarColor(signer.email)} flex items-center justify-center text-[10px] font-semibold text-gray-800 ring-2 ring-white`}
                              title={signer.name || signer.email}
                            >
                              {(signer.name || signer.email).slice(0, 2).toUpperCase()}
                            </div>
                          ))}
                          {envelope.signers.length > 3 && (
                            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-600 ring-2 ring-white">
                              +{envelope.signers.length - 3}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Date */}
                      <div className="w-28">
                        <span className="text-sm text-gray-500">
                          {formatDate(envelope.updatedAt || envelope.createdAt)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="w-10 flex justify-center relative" ref={openMenuId === envelope.id ? menuRef : null}>
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
                        
                        {/* Dropdown Menu */}
                        {openMenuId === envelope.id && (
                          <div className="absolute right-0 top-8 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px]">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleView(envelope) }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <ViewIcon />
                              View
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAddRecipients(envelope) }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <AddRecipientsIcon />
                              Add recipients
                            </button>
                            {envelope.status !== 'completed' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleChangeDueDate(envelope) }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <CalendarIcon />
                                Change due date
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAuditTrail(envelope) }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <AuditIcon />
                              Audit trail
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRename(envelope) }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <RenameIcon />
                              Rename
                            </button>
                            <div className="border-t border-gray-100 my-1" />
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(envelope) }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <DeleteIcon />
                              Delete
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

      {/* Rename Modal */}
      {renameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRenameModalOpen(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Rename document</h3>
              <button onClick={() => setRenameModalOpen(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#08CF65] focus:border-transparent"
              placeholder="Document name"
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setRenameModalOpen(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitRename}
                className="px-4 py-2 bg-[#08CF65] hover:bg-[#07B859] text-white text-sm font-medium rounded-lg transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Due Date Modal */}
      {dueDateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDueDateModalOpen(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Change due date</h3>
              <button onClick={() => setDueDateModalOpen(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Expiration</label>
            <select
              value={selectedDueDate}
              onChange={(e) => setSelectedDueDate(Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#08CF65] focus:border-transparent bg-white"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={5}>5 days</option>
              <option value={7}>7 days</option>
              <option value={15}>15 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
            </select>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setDueDateModalOpen(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitDueDate}
                className="px-4 py-2 bg-[#08CF65] hover:bg-[#07B859] text-white text-sm font-medium rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
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
