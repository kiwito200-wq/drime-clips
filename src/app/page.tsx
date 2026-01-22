'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
}

const DRIME_LOGIN_URL = 'https://staging.drime.cloud/login'

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

const UploadIcon = () => (
  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
)

export default function DashboardHome() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [loading, setLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

      const response = await fetch('/api/envelopes', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        router.push(`/send?slug=${data.slug}`)
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
                  href="/"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-[#DCFCE7] text-[#08CF65] font-medium"
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
                  href="/dashboard"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-white transition-colors"
                >
                  <DocumentIcon />
                  My agreements
                </Link>
                <Link
                  href="/dashboard?view=sent"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-white transition-colors"
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
                  href="/dashboard?filter=need_to_sign"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-white transition-colors"
                >
                  <PenIcon />
                  Need to sign
                </Link>
                <Link
                  href="/dashboard?filter=in_progress"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-white transition-colors"
                >
                  <ClockIcon />
                  In progress
                </Link>
                <Link
                  href="/dashboard?filter=completed"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-white transition-colors"
                >
                  <CheckIcon />
                  Approved
                </Link>
                <Link
                  href="/dashboard?filter=rejected"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-white transition-colors"
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
            <div className="flex bg-white">
              {/* Waiting for signature (from others) */}
              <Link 
                href="/dashboard?filter=in_progress" 
                className="flex-1 py-4 px-4 border-l border-gray-200 first:border-l-0 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="text-2xl font-semibold text-gray-900 mb-2">{stats.waitingForOthers}</div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#FFAD12]" />
                  <span className="text-sm text-gray-700">Waiting for signature</span>
                </div>
              </Link>

              {/* Waiting for your signature */}
              <Link 
                href="/dashboard?filter=need_to_sign" 
                className="flex-1 py-4 px-4 border-l border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="text-2xl font-semibold text-gray-900 mb-2">{stats.needToSign}</div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#FFAD12]" />
                  <span className="text-sm text-gray-700">Waiting for your signature</span>
                </div>
              </Link>

              {/* Drafts */}
              <Link 
                href="/dashboard?filter=draft" 
                className="flex-1 py-4 px-4 border-l border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="text-2xl font-semibold text-gray-900 mb-2">{stats.drafts}</div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#ADB5BD]" />
                  <span className="text-sm text-gray-700">Drafts</span>
                </div>
              </Link>

              {/* Signed */}
              <Link 
                href="/dashboard?filter=completed" 
                className="flex-1 py-4 px-4 border-l border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="text-2xl font-semibold text-gray-900 mb-2">{stats.completed}</div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#51D474]" />
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
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-2xl h-full min-h-[280px] flex flex-col items-center justify-center cursor-pointer transition-all
                ${isDragging 
                  ? 'border-[#08CF65] bg-[#DCFCE7]/30' 
                  : 'border-gray-300 hover:border-[#08CF65] hover:bg-gray-50'
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
                  
                  <button className="px-6 py-2.5 bg-[#08CF65] hover:bg-[#07B859] text-white font-medium rounded-lg transition-colors flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Import
                  </button>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
