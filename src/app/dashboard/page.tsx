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

  const getStatusBadge = (status: string, signers: Signer[]) => {
    const needsMySignature = signers.some(s => s.email === user?.email && s.status === 'pending')
    
    if (status === 'pending' && needsMySignature) {
      return { 
        label: 'Need to sign', 
        bgColor: 'bg-[#E3E0FF]',
        textColor: 'text-[#160F57]',
        icon: <PenIcon />
      }
    }
    
    if (status === 'completed') {
      return { 
        label: 'Approved', 
        bgColor: 'bg-[#F2FCEE]',
        textColor: 'text-[#0B200B]',
        icon: <CheckIcon />
      }
    }
    
    if (status === 'pending') {
      return { 
        label: 'In progress', 
        bgColor: 'bg-[#FFF5E6]',
        textColor: 'text-[#663D00]',
        icon: <ClockIcon />
      }
    }
    
    if (status === 'rejected') {
      return { 
        label: 'Rejected', 
        bgColor: 'bg-[#FFEDED]',
        textColor: 'text-[#BF0B00]',
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
      router.push(`/prepare/${envelope.slug}`)
    } else {
      router.push(`/view/${envelope.slug}`)
    }
  }

  // Avatar colors based on initials
  const getAvatarColor = (str: string) => {
    const colors = [
      'bg-[#C8F2FF]', // light blue
      'bg-[#C9C8FF]', // light purple  
      'bg-[#FFE0C8]', // light orange
      'bg-[#C8FFD4]', // light green
      'bg-[#FFC8E8]', // light pink
    ]
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] p-4">
      <div className="flex gap-4">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0">
          <div className="space-y-6">
            {/* Agreements section */}
            <div>
              <p className="text-xs font-medium text-gray-500 px-3 mb-2">Agreements</p>
              <div className="space-y-1">
                <button
                  onClick={() => { setViewType('my_documents'); setFilterStatus('all') }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    viewType === 'my_documents' && filterStatus === 'all'
                      ? 'bg-[#E1DFFF] text-gray-900 font-medium'
                      : 'text-gray-900 hover:bg-white'
                  }`}
                >
                  <DocumentIcon />
                  My agreements
                </button>
                <button
                  onClick={() => { setViewType('sent_to_me'); setFilterStatus('all') }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    viewType === 'sent_to_me'
                      ? 'bg-[#E1DFFF] text-gray-900 font-medium'
                      : 'text-gray-900 hover:bg-white'
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
                      ? 'bg-white text-gray-900 font-medium'
                      : 'text-gray-900 hover:bg-white'
                  }`}
                >
                  <PenIcon />
                  Need to sign
                </button>
                <button
                  onClick={() => setFilterStatus('in_progress')}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    filterStatus === 'in_progress'
                      ? 'bg-white text-gray-900 font-medium'
                      : 'text-gray-900 hover:bg-white'
                  }`}
                >
                  <ClockIcon />
                  In progress
                </button>
                <button
                  onClick={() => setFilterStatus('completed')}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    filterStatus === 'completed'
                      ? 'bg-white text-gray-900 font-medium'
                      : 'text-gray-900 hover:bg-white'
                  }`}
                >
                  <CheckIcon />
                  Approved
                </button>
                <button
                  onClick={() => setFilterStatus('rejected')}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    filterStatus === 'rejected'
                      ? 'bg-white text-gray-900 font-medium'
                      : 'text-gray-900 hover:bg-white'
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
        <main className="flex-1 bg-white rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-10 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold text-gray-900">
                {viewType === 'my_documents' ? 'My agreements' : 'Sent to me'}
              </h1>
              <span className="text-sm text-gray-500 flex items-center gap-1.5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Visible only to you
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Link 
                href="/send" 
                className="flex items-center gap-2 px-4 py-2 bg-[#1C333D] hover:bg-[#152830] text-white text-sm font-medium rounded-lg transition-colors"
              >
                <PenIcon />
                Sign securely
              </Link>
            </div>
          </div>

          {/* List container */}
          <div className="px-10">
            {/* Column headers */}
            <div className="flex items-center py-2.5 border-b border-gray-200 text-sm text-gray-600">
              <div className="flex-1 pl-2">Name</div>
              <div className="w-32">Status</div>
              <div className="w-32">Recipients</div>
              <div className="w-28">Last updated</div>
              <div className="w-10"></div>
            </div>

            {/* Documents */}
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
                      className="flex items-center py-3 border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer transition-colors group"
                    >
                      {/* Document name with thumbnail */}
                      <div className="flex-1 flex items-center gap-2 min-w-0 pl-2">
                        <div className="w-6 h-6 rounded bg-white border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {envelope.thumbnailUrl ? (
                            <img src={envelope.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${statusBadge.bgColor} ${statusBadge.textColor}`}>
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
                              className={`w-6 h-6 rounded-full ${getAvatarColor(signer.email)} flex items-center justify-center text-[10px] font-medium text-gray-900 ring-1 ring-gray-200`}
                              title={signer.name || signer.email}
                            >
                              {(signer.name || signer.email).slice(0, 2).toUpperCase()}
                            </div>
                          ))}
                          {envelope.signers.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-600 ring-1 ring-gray-200">
                              +{envelope.signers.length - 3}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Date */}
                      <div className="w-28">
                        <span className="text-sm text-gray-600">
                          {formatDate(envelope.updatedAt || envelope.createdAt)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="w-10 flex justify-center">
                        <button 
                          onClick={(e) => { e.stopPropagation() }}
                          className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-gray-100 rounded-lg transition-all"
                        >
                          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
