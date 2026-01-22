'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

type FilterStatus = 'all' | 'need_to_sign' | 'in_progress' | 'completed' | 'rejected'
type ViewType = 'my_documents' | 'sent_to_me'

const DRIME_LOGIN_URL = 'https://staging.drime.cloud/login'

// SVG Icons
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

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [viewType, setViewType] = useState<ViewType>('my_documents')

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

  // Using Drime color palette: #FFAD12 (orange), #7E33F7 (purple), #ED3757 (red), #00B7FF (blue), #08CF65 (green)
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
      // Continue editing in the same flow as creation
      router.push(`/send?slug=${envelope.slug}`)
    } else {
      router.push(`/view/${envelope.slug}`)
    }
  }

  // Avatar colors based on initials - using Drime accent colors
  const getAvatarColor = (str: string) => {
    const colors = [
      'bg-[#E9D5FF]', // light purple from #7E33F7
      'bg-[#FFE4B5]', // light orange from #FFAD12
      'bg-[#FFD4DB]', // light red from #ED3757
      'bg-[#BBFDE0]', // light green from #08CF65
      'bg-[#B8E8FF]', // light blue from #00B7FF
    ]
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  if (loading) {
    return (
      <div className="h-screen bg-[#F3F4F6] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#F3F4F6] flex flex-col overflow-hidden">
      {/* Top bar with search - on gray background */}
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
          
          {/* Search bar - white with stroke */}
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <SearchIcon />
              </div>
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#08CF65] focus:border-transparent transition-all"
              />
            </div>
          </div>
          
          {/* Sign securely button */}
          <Link 
            href="/send" 
            className="flex items-center gap-2 px-4 py-2.5 bg-[#08CF65] hover:bg-[#07B859] text-white text-sm font-medium rounded-lg transition-colors ml-auto"
          >
            <PenIcon />
            Sign securely
          </Link>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex gap-4 px-4 pb-4 min-h-0">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 flex flex-col">
          <div className="space-y-6">
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

        {/* Main content - white container that fills height */}
        <main className="flex-1 bg-white rounded-xl flex flex-col min-h-0 border border-gray-200">
          {/* Header */}
          <div className="px-8 py-5 border-b border-gray-100 flex-shrink-0">
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
                            <img src={envelope.thumbnailUrl} alt="" className="w-full h-full object-cover" />
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
                      <div className="w-10 flex justify-center">
                        <button 
                          onClick={(e) => { e.stopPropagation() }}
                          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-gray-100 rounded-lg transition-all"
                        >
                          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
