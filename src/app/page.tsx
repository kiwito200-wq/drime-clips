'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/I18nContext'

const DRIME_LOGIN_URL = 'https://app.drime.cloud/login'

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { locale } = useTranslation()
  const [isChecking, setIsChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkAuth() {
      try {
        // Check if user is authenticated
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        const data = await res.json()

        if (data.user) {
          // User is authenticated, redirect to dashboard or requested page
          const redirect = searchParams.get('redirect') || '/dashboard'
          router.replace(redirect)
        } else {
          // Not authenticated - redirect to Drime login
          const currentUrl = window.location.origin + (searchParams.get('redirect') || '/dashboard')
          const drimeLoginUrl = `${DRIME_LOGIN_URL}?redirect=${encodeURIComponent(currentUrl)}`
          window.location.href = drimeLoginUrl
        }
      } catch (err) {
        console.error('Auth check failed:', err)
        setError(locale === 'fr' ? 'Erreur de connexion. Veuillez réessayer.' : 'Connection error. Please try again.')
        setIsChecking(false)
      }
    }

    checkAuth()
  }, [router, searchParams])

  // Loading state while checking auth
  if (isChecking && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="flex items-center justify-center gap-3">
          <svg className="animate-spin h-5 w-5 text-[#08CF65]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-600">{locale === 'fr' ? 'Connexion en cours...' : 'Connecting...'}</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{error}</h2>
            <p className="text-gray-500 mb-6">
              Impossible de vérifier votre session. Veuillez vous reconnecter via Drime.
            </p>
            
            <a
              href={DRIME_LOGIN_URL}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#08CF65] text-white font-medium rounded-lg hover:bg-[#07b85a] transition-colors"
            >
              Se connecter avec Drime
            </a>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// Loading fallback for Suspense
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="flex items-center justify-center gap-3">
        <svg className="animate-spin h-5 w-5 text-[#08CF65]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-gray-600">Chargement...</span>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomeContent />
    </Suspense>
  )
}
