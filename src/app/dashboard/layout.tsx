'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Tooltip from '@/components/Tooltip'

interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
}

const DRIME_LOGIN_URL = 'https://app.drime.cloud/login'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        const data = await res.json()
        
        if (data.user) {
          setUser(data.user)
          setLoading(false)
        } else {
          window.location.href = DRIME_LOGIN_URL
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        window.location.href = DRIME_LOGIN_URL
      }
    }
    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          <span className="text-gray-600">Chargement...</span>
        </div>
      </div>
    )
  }

  const navItems = [
    {
      name: 'Enregistrer',
      href: '/dashboard/record',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      ),
    },
    {
      name: 'Mes Clips',
      href: '/dashboard/clips',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ),
    },
    {
      name: 'Analytics',
      href: '/dashboard/analytics',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-52 bg-[#F3F4F6] border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-4">
          <Tooltip content="Retour à Drime" position="right">
            <a href="https://app.drime.cloud/drive" className="flex items-center gap-2">
              <img src="/drime-logo.png" alt="Drime" className="h-6" />
              <span className="text-gray-400 font-medium">|</span>
              <span className="font-semibold text-gray-900">Clips</span>
            </a>
          </Tooltip>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#ECEEF0] text-gray-900'
                    : 'text-gray-900 hover:bg-[#ECEEF0]'
                }`}
              >
                <span className="text-gray-600">
                  {item.icon}
                </span>
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-sm font-semibold text-gray-600 flex-shrink-0 overflow-hidden">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                (user?.name || user?.email || 'U').slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name || user?.email?.split('@')[0]}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-white">
        {children}
      </main>
    </div>
  )
}
