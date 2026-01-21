'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
}

interface Envelope {
  id: string
  slug: string
  name: string
  status: string
  createdAt: string
  signers: { email: string; status: string }[]
}

const DRIME_AUTH_URL = 'https://staging.drime.cloud'

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [showDevLogin, setShowDevLogin] = useState(false)

  const fetchEnvelopes = useCallback(async () => {
    const envelopesRes = await fetch('/api/envelopes', {
      credentials: 'include',
    })
    
    if (envelopesRes.ok) {
      const data = await envelopesRes.json()
      setEnvelopes(data.envelopes || [])
    }
  }, [])

  const handleDevLogin = useCallback(async (email: string) => {
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      })
      
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setShowDevLogin(false)
        await fetchEnvelopes()
      }
    } catch (error) {
      console.error('Dev login failed:', error)
    }
  }, [fetchEnvelopes])

  const checkAuthAndFetch = useCallback(async () => {
    try {
      // STEP 1: Check if we have a local session already
      const localAuthRes = await fetch('/api/auth/me', {
        credentials: 'include',
      })
      
      if (localAuthRes.ok) {
        const localData = await localAuthRes.json()
        if (localData.user) {
          // Already have local session
          setUser(localData.user)
          await fetchEnvelopes()
          setLoading(false)
          return
        }
      }

      // STEP 2: No local session - try Drime auth from browser
      // Note: This may fail due to CORS if Drime doesn't allow sign.drime.cloud
      console.log('[Dashboard] Checking Drime session from browser...')
      
      try {
        const drimeAuthRes = await fetch(`${DRIME_AUTH_URL}/api/v1/auth/external/me`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
          },
        })
        
        console.log('[Dashboard] Drime response status:', drimeAuthRes.status)
        
        if (drimeAuthRes.ok) {
          const drimeData = await drimeAuthRes.json()
          console.log('[Dashboard] Drime data:', drimeData)
          
          if (drimeData.user) {
            // STEP 3: Drime user found - create local session
            console.log('[Dashboard] Creating local session for:', drimeData.user.email)
            
            const createSessionRes = await fetch('/api/auth/create-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                drimeUserId: drimeData.user.id,
                email: drimeData.user.email,
                name: drimeData.user.name || drimeData.user.display_name,
                avatarUrl: drimeData.user.avatar_url,
              }),
            })
            
            if (createSessionRes.ok) {
              const sessionData = await createSessionRes.json()
              setUser(sessionData.user)
              await fetchEnvelopes()
              setLoading(false)
              return
            }
          }
        }
      } catch (corsError) {
        // CORS error - Drime doesn't allow cross-origin requests with credentials
        console.log('[Dashboard] CORS error with Drime auth:', corsError)
      }

      // No auth available - show dev login option
      console.log('[Dashboard] No auth, showing dev login')
      setShowDevLogin(true)
      
    } catch (error) {
      console.error('[Dashboard] Auth error:', error)
      setAuthError(String(error))
    } finally {
      setLoading(false)
    }
  }, [fetchEnvelopes])

  useEffect(() => {
    checkAuthAndFetch()
  }, [checkAuthAndFetch])

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      pending: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      expired: 'bg-red-100 text-red-700',
    }
    return styles[status] || styles.draft
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

  if (authError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erreur d&apos;authentification</h2>
          <p className="text-gray-500 mb-4">{authError}</p>
          <button 
            onClick={() => window.location.href = `${DRIME_AUTH_URL}/login`}
            className="btn-primary"
          >
            Se connecter sur Drime
          </button>
        </div>
      </div>
    )
  }

  // Show dev login when Drime CORS blocks us
  if (showDevLogin && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="card max-w-md w-full p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#08CF65] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Drime Sign</h2>
            <p className="text-gray-500 text-sm mt-1">
              Connexion temporaire (en attendant la configuration CORS)
            </p>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            const email = formData.get('email') as string
            if (email) handleDevLogin(email)
          }}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                required
                placeholder="votre@email.com"
                className="input"
                defaultValue=""
              />
            </div>
            
            <button type="submit" className="btn-primary w-full">
              Continuer
            </button>
          </form>
          
          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-gray-400 text-center">
              ⚠️ Mode temporaire - En production, l&apos;authentification passera par Drime
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#08CF65] rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">Drime Sign</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/send" className="btn-primary flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nouveau document
            </Link>
            
            {/* User info */}
            <div className="flex items-center gap-3 pl-4 border-l">
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
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Documents</h1>

        {envelopes.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-12 text-center"
          >
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Aucun document</h2>
            <p className="text-gray-500 mb-6">Commencez par uploader votre premier document</p>
            <Link href="/send" className="btn-primary inline-flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nouveau document
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {envelopes.map((envelope, index) => (
              <motion.div
                key={envelope.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/dashboard/${envelope.slug}`} className="card p-6 block hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{envelope.name}</h3>
                        <p className="text-sm text-gray-500">
                          {new Date(envelope.createdAt).toLocaleDateString('fr-FR')}
                          {' · '}
                          {envelope.signers.length} signataire{envelope.signers.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusBadge(envelope.status)}`}>
                      {envelope.status}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
