'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to home dashboard
    router.replace('/')
  }, [router])

  // Show loading while redirecting
  return (
    <div className="h-screen bg-[#F3F4F6] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Chargement...</p>
      </div>
    </div>
  )
}
