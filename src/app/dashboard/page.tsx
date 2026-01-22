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
    const envelopesRes = await fetch('/api/envelopes', {
      credentials: 'include',
    })
    
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
      const authRes = await fetch('/api/auth/check', {
        credentials: 'include',
      })
      
      if (authRes.ok) {
        const data = await authRes.json()
        if (data.user) {
          setUser(data.user)
          await fetchEnvelopes()
          setLoading(false)
          return
        }
      }

      console.log('[Dashboard] Not authenticated, redirecting to Drime login...')
      await clearSessionAndRedirect()
      
    } catch (error) {
      console.error('[Dashboard] Auth error:', error)
      await clearSessionAndRedirect()
    }
  }, [fetchEnvelopes, clearSessionAndRedirect])

  useEffect(() => {
    checkAuthAndFetch()
  }, [checkAuthAndFetch])

  // Filter and search envelopes
  const filteredEnvelopes = useMemo(() => {
    let result = envelopes

    // Filter by view type
    if (viewType === 'sent_to_me') {
      result = result.filter(e => 
        e.signers.some(s => s.email === user?.email) && e.createdBy !== user?.email
      )
    } else {
      result = result.filter(e => e.createdBy === user?.email || !e.createdBy)
    }

    // Filter by status
    if (filterStatus !== 'all') {
      if (filterStatus === 'need_to_sign') {
        result = result.filter(e => 
          e.status === 'pending' && 
          e.signers.some(s => s.email === user?.email && s.status === 'pending')
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

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(e => 
        e.name.toLowerCase().includes(query) ||
        e.signers.some(s => s.email.toLowerCase().includes(query) || s.name?.toLowerCase().includes(query))
      )
    }

    return result
  }, [envelopes, viewType, filterStatus, searchQuery, user?.email])

  // Count by status
  const statusCounts = useMemo(() => {
    const counts = {
      all: envelopes.length,
      need_to_sign: 0,
      in_progress: 0,
      completed: 0,
      draft: 0,
      rejected: 0,
    }
    
    envelopes.forEach(e => {
      if (e.status === 'pending' && e.signers.some(s => s.email === user?.email && s.status === 'pending')) {
        counts.need_to_sign++
      }
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
      return { label: 'À signer', color: 'bg-blue-50 text-blue-700 border-blue-200' }
    }
    
    const styles: Record<string, { label: string; color: string }> = {
      draft: { label: 'Brouillon', color: 'bg-gray-50 text-gray-600 border-gray-200' },
      pending: { label: 'En cours', color: 'bg-amber-50 text-amber-700 border-amber-200' },
      completed: { label: 'Complété', color: 'bg-green-50 text-green-700 border-green-200' },
      rejected: { label: 'Rejeté', color: 'bg-red-50 text-red-700 border-red-200' },
      expired: { label: 'Expiré', color: 'bg-red-50 text-red-700 border-red-200' },
    }
    return styles[status] || styles.draft
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const handleDocumentClick = (envelope: Envelope) => {
    if (envelope.status === 'draft') {
      // Edit draft
      router.push(`/edit/${envelope.slug}`)
    } else {
      // View document
      router.push(`/view/${envelope.slug}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Connexion à Drime...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[#08CF65] rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900">Drime Sign</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Documents</p>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => { setViewType('my_documents'); setFilterStatus('all') }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewType === 'my_documents' && filterStatus === 'all'
                      ? 'bg-[#08CF65]/10 text-[#08CF65]'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Mes documents
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setViewType('sent_to_me'); setFilterStatus('all') }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewType === 'sent_to_me'
                      ? 'bg-[#08CF65]/10 text-[#08CF65]'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Reçus
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Filtrer par statut</p>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => setFilterStatus('need_to_sign')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'need_to_sign'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    À signer
                  </span>
                  {statusCounts.need_to_sign > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                      {statusCounts.need_to_sign}
                    </span>
                  )}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setFilterStatus('in_progress')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'in_progress'
                      ? 'bg-amber-50 text-amber-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    En cours
                  </span>
                  {statusCounts.in_progress > 0 && (
                    <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                      {statusCounts.in_progress}
                    </span>
                  )}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setFilterStatus('completed')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'completed'
                      ? 'bg-green-50 text-green-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Complétés
                  </span>
                  {statusCounts.completed > 0 && (
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                      {statusCounts.completed}
                    </span>
                  )}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setFilterStatus('draft')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'draft'
                      ? 'bg-gray-100 text-gray-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Brouillons
                  </span>
                  {statusCounts.draft > 0 && (
                    <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                      {statusCounts.draft}
                    </span>
                  )}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setFilterStatus('rejected')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'rejected'
                      ? 'bg-red-50 text-red-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Rejetés
                  </span>
                  {statusCounts.rejected > 0 && (
                    <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                      {statusCounts.rejected}
                    </span>
                  )}
                </button>
              </li>
            </ul>
          </div>
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            {user?.avatarUrl ? (
              <img 
                src={user.avatarUrl} 
                alt={user.name || user.email} 
                className="w-9 h-9 rounded-full"
              />
            ) : (
              <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-600">
                  {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {viewType === 'my_documents' ? 'Mes documents' : 'Documents reçus'}
              </h1>
              <p className="text-sm text-gray-500">
                {filteredEnvelopes.length} document{filteredEnvelopes.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <svg 
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-64 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#08CF65] focus:border-transparent"
                />
              </div>

              {/* New Document Button */}
              <Link 
                href="/send" 
                className="flex items-center gap-2 px-4 py-2 bg-[#08CF65] hover:bg-[#06B557] text-white font-medium rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nouveau document
              </Link>
            </div>
          </div>
        </header>

        {/* Table */}
        <div className="flex-1 p-6">
          {filteredEnvelopes.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-gray-200 p-12 text-center"
            >
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Aucun document</h2>
              <p className="text-gray-500 mb-4">
                {searchQuery ? 'Aucun résultat pour cette recherche' : 'Commencez par créer votre premier document'}
              </p>
              {!searchQuery && (
                <Link href="/send" className="inline-flex items-center gap-2 px-4 py-2 bg-[#08CF65] hover:bg-[#06B557] text-white font-medium rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nouveau document
                </Link>
              )}
            </motion.div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="col-span-5">Nom</div>
                <div className="col-span-2">Statut</div>
                <div className="col-span-2">Destinataires</div>
                <div className="col-span-2">Mis à jour</div>
                <div className="col-span-1"></div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-100">
                {filteredEnvelopes.map((envelope, index) => {
                  const statusBadge = getStatusBadge(envelope.status, envelope.signers)
                  
                  return (
                    <motion.div
                      key={envelope.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleDocumentClick(envelope)}
                      className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      {/* Name */}
                      <div className="col-span-5 flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{envelope.name}</p>
                          <p className="text-sm text-gray-500">
                            {formatDate(envelope.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="col-span-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge.color}`}>
                          {statusBadge.label === 'À signer' && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          )}
                          {statusBadge.label === 'Complété' && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* Recipients */}
                      <div className="col-span-2">
                        <div className="flex -space-x-2">
                          {envelope.signers.slice(0, 3).map((signer, i) => (
                            <div
                              key={i}
                              className="w-8 h-8 rounded-full bg-gradient-to-br from-[#08CF65] to-[#06B557] flex items-center justify-center text-white text-xs font-medium border-2 border-white"
                              title={signer.name || signer.email}
                            >
                              {(signer.name || signer.email).charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {envelope.signers.length > 3 && (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-medium border-2 border-white">
                              +{envelope.signers.length - 3}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Last Updated */}
                      <div className="col-span-2">
                        <p className="text-sm text-gray-500">
                          {formatDate(envelope.updatedAt || envelope.createdAt)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="col-span-1 flex justify-end">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            // TODO: Open actions menu
                          }}
                          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
