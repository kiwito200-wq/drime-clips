'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Check if user is logged in (via Drime auto-login)
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include',
        })
        
        if (res.ok) {
          const data = await res.json()
          if (data.user) {
            // User is logged in, redirect to dashboard
            router.replace('/dashboard')
            return
          }
        }
        
        // Not logged in - redirect to Drime login
        window.location.href = 'https://app.drime.cloud/login?redirect=' + encodeURIComponent(window.location.origin + '/dashboard')
      } catch (error) {
        console.error('Auth check failed:', error)
        // On error, redirect to Drime login
        window.location.href = 'https://app.drime.cloud/login?redirect=' + encodeURIComponent(window.location.origin + '/dashboard')
      } finally {
        setChecking(false)
      }
    }

    checkAuth()
  }, [router])

  // Show loading while checking auth
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 bg-[#08CF65] rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-500">Connexion en cours...</p>
      </div>
    </div>
  )
}
