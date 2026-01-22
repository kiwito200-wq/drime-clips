'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

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

type FilterStatus = 'all' | 'need_to_sign' | 'in_progress' | 'completed' | 'draft' | 'rejected'
type ViewType = 'my_documents' | 'sent_to_me'

const DRIME_LOGIN_URL = 'https://staging.drime.cloud/login'

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

  // Filter envelopes
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
      } else if (filterStatus === 'draft') {
        result = result.filter(e => e.status === 'draft')
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

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = { all: envelopes.length, need_to_sign: 0, in_progress: 0, completed: 0, draft: 0, rejected: 0 }
    envelopes.forEach(e => {
      if (e.status === 'pending' && e.signers.some(s => s.email === user?.email && s.status === 'pending')) counts.need_to_sign++
      if (e.status === 'pending') counts.in_progress++
      if (e.status === 'completed') counts.completed++
      if (e.status === 'draft') counts.draft++
      if (e.status === 'rejected') counts.rejected++
    })
    return counts
  }, [envelopes, user?.email])

  const getStatusBadge = (status: string, signers: Signer[]) => {
    const needsMySignature = signers.some(s => s.email === user?.email && s.status === 'pending')
    
    if (status === 'pending' && needsMySignature) {
      return { label: 'À signer', color: 'bg-[#7C5CFF] text-white', icon: '✍️' }
    }
    
    const styles: Record<string, { label: string; color: string; icon: string }> = {
      draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-600', icon: '' },
      pending: { label: 'En cours', color: 'bg-[#F5A623]/15 text-[#D4920E]', icon: '' },
      completed: { label: 'Approuvé', color: 'bg-[#08CF65]/15 text-[#08CF65]', icon: '✓' },
      rejected: { label: 'Rejeté', color: 'bg-[#E53935]/15 text-[#E53935]', icon: '✗' },
    }
    return styles[status] || styles.draft
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-xs">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <aside className="w-52 border-r border-gray-100 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#08CF65] rounded-lg flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">Drime Sign</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Agreements</p>
          <ul className="space-y-0.5">
            <li>
              <button
                onClick={() => { setViewType('my_documents'); setFilterStatus('all') }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewType === 'my_documents' && filterStatus === 'all'
                    ? 'bg-[#08CF65] text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                My agreements
              </button>
            </li>
            <li>
              <button
                onClick={() => { setViewType('sent_to_me'); setFilterStatus('all') }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewType === 'sent_to_me'
                    ? 'bg-[#08CF65] text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Sent to me
              </button>
            </li>
          </ul>

          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mt-5 mb-2">Filtered by status</p>
          <ul className="space-y-0.5">
            {[
              { key: 'need_to_sign', label: 'Need to sign', icon: '✍️' },
              { key: 'in_progress', label: 'In progress', icon: '⏳' },
              { key: 'completed', label: 'Approved', icon: '✓' },
              { key: 'rejected', label: 'Rejected', icon: '✗' },
            ].map(item => (
              <li key={item.key}>
                <button
                  onClick={() => setFilterStatus(item.key as FilterStatus)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${
                    filterStatus === item.key
                      ? 'text-gray-900 bg-gray-50 font-medium'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 text-center text-[10px]">{item.icon}</span>
                    {item.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-semibold text-gray-900">
                {viewType === 'my_documents' ? 'My agreements' : 'Sent to me'}
              </h1>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Visible only to you
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 w-44 bg-gray-50 border-0 rounded-md text-xs placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-200"
                />
              </div>
              
              <Link 
                href="/send" 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium rounded-md transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Sign securely
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {filteredEnvelopes.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm mb-1">No documents</p>
              <p className="text-gray-400 text-xs mb-3">
                {searchQuery ? 'No results found' : 'Create your first document'}
              </p>
              {!searchQuery && (
                <Link href="/send" className="text-[#08CF65] text-xs font-medium hover:underline">
                  + New document
                </Link>
              )}
            </motion.div>
          ) : (
            <div className="px-6 py-3">
              {/* Column headers */}
              <div className="flex items-center px-2 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider border-b border-gray-50">
                <div className="flex-1 pl-11">Name</div>
                <div className="w-24 text-center">Status</div>
                <div className="w-24 text-center">Recipients</div>
                <div className="w-28 text-right">Last updated</div>
                <div className="w-8"></div>
              </div>

              {/* Documents */}
              <div className="divide-y divide-gray-50">
                {filteredEnvelopes.map((envelope, index) => {
                  const statusBadge = getStatusBadge(envelope.status, envelope.signers)
                  
                  return (
                    <motion.div
                      key={envelope.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.015 }}
                      onClick={() => handleDocumentClick(envelope)}
                      className="flex items-center px-2 py-2.5 hover:bg-gray-50/50 cursor-pointer transition-colors group"
                    >
                      {/* Document preview & name */}
                      <div className="flex-1 flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-10 bg-gray-50 rounded flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100">
                          {envelope.thumbnailUrl ? (
                            <img src={envelope.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                        </div>
                        <span className="text-xs text-gray-800 truncate group-hover:text-[#08CF65] transition-colors">
                          {envelope.name}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="w-24 flex justify-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${statusBadge.color}`}>
                          {statusBadge.icon && <span>{statusBadge.icon}</span>}
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* Recipients */}
                      <div className="w-24 flex justify-center">
                        <div className="flex -space-x-1">
                          {envelope.signers.slice(0, 2).map((signer, i) => (
                            <div
                              key={i}
                              className="w-6 h-6 rounded-full bg-[#7C5CFF] flex items-center justify-center text-white text-[9px] font-medium border-2 border-white"
                              title={signer.name || signer.email}
                            >
                              {(signer.name || signer.email).charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {envelope.signers.length > 2 && (
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-[9px] font-medium border-2 border-white">
                              +{envelope.signers.length - 2}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Date */}
                      <div className="w-28 text-right">
                        <span className="text-[11px] text-gray-400">
                          {formatDate(envelope.updatedAt || envelope.createdAt)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="w-8 flex justify-end">
                        <button 
                          onClick={(e) => { e.stopPropagation() }}
                          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-100 rounded transition-all"
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
