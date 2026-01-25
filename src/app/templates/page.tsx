'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Tooltip from '@/components/Tooltip'
import DrimeFilePicker from '@/components/DrimeFilePicker'
import { useI18n } from '@/lib/i18n/I18nContext'

interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
}

interface Template {
  id: string
  slug: string
  name: string
  description: string | null
  pdfUrl: string
  thumbnailUrl: string | null
  createdAt: string
  updatedAt: string
}

// Sidebar Icons
const HomeIcon = () => (
  <img src="/icons/home.svg" alt="" className="w-5 h-5" />
)

const DocumentIcon = () => (
  <img src="/icons/agreements.svg" alt="" className="w-5 h-5" />
)

const MailIcon = () => (
  <img src="/icons/received.svg" alt="" className="w-5 h-5" />
)

const PenIcon = () => (
  <img src="/icons/to-sign.svg" alt="" className="w-4 h-4" />
)

const ClockIcon = () => (
  <img src="/icons/clock.svg" alt="" className="w-4 h-4" />
)

const CheckIcon = () => (
  <img src="/icons/check.svg" alt="" className="w-4 h-4" />
)

const XIcon = () => (
  <img src="/icons/close.svg" alt="" className="w-4 h-4" />
)

const DeviceIcon = () => (
  <img src="/icons/device.svg" alt="" className="w-5 h-5" />
)

const DrimeIcon = () => (
  <img src="/drime-icon.png" alt="Drime" className="w-5 h-5" />
)

export default function TemplatesPage() {
  const router = useRouter()
  const { t, locale } = useI18n()
  const [user, setUser] = useState<User | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [archived, setArchived] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showImportDropdown, setShowImportDropdown] = useState(false)
  const [showDrimeFilePicker, setShowDrimeFilePicker] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const importDropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load user
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user)
        }
      })
      .catch(() => {})
  }, [])

  // Load templates
  useEffect(() => {
    loadTemplates()
  }, [archived])

  const loadTemplates = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/templates?archived=${archived}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseTemplate = (templateId: string) => {
    router.push(`/send?template=${templateId}`)
  }

  const handleDeleteTemplate = async (templateId: string, permanently: boolean = false) => {
    if (!confirm(permanently ? 'Êtes-vous sûr de vouloir supprimer définitivement ce template ?' : 'Voulez-vous archiver ce template ?')) {
      return
    }

    try {
      const res = await fetch(`/api/templates/${templateId}?permanently=${permanently}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        loadTemplates()
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
      alert('Erreur lors de la suppression du template')
    }
  }

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr))
  }

  // File upload handling
  const handleFileUpload = async (file: File) => {
    if (!file || !file.type.includes('pdf')) {
      alert(locale === 'fr' ? 'Veuillez uploader un fichier PDF' : 'Please upload a PDF file')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name.replace('.pdf', ''))

      // Generate thumbnail client-side
      try {
        const { generatePdfThumbnail } = await import('@/lib/pdf-thumbnail')
        const thumbnail = await generatePdfThumbnail(file, 128)
        if (thumbnail) {
          formData.append('thumbnail', thumbnail)
        }
      } catch (e) {
        console.error('Thumbnail generation failed:', e)
      }

      const response = await fetch('/api/envelopes', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        router.push(`/templates/new?slug=${data.envelope.slug}`)
      } else {
        const error = await response.json()
        alert(error.error || (locale === 'fr' ? 'Échec de l\'upload' : 'Failed to upload'))
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert(locale === 'fr' ? 'Échec de l\'upload' : 'Failed to upload')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleDrimeFileSelect = async (drimeFile: any, blob: Blob) => {
    const file = new File([blob], drimeFile.name || drimeFile.file_name || 'document.pdf', { type: 'application/pdf' })
    await handleFileUpload(file)
  }

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
      if (importDropdownRef.current && !importDropdownRef.current.contains(event.target as Node)) {
        setShowImportDropdown(false)
      }
    }
    window.document.addEventListener('mousedown', handleClickOutside)
    return () => window.document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const clearSessionAndRedirect = useCallback(() => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .finally(() => {
        window.location.href = 'https://front.preprod.drime.cloud/login'
      })
  }, [])

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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right side - Notifications & Profile */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative" ref={notificationsRef}>
              <Tooltip content={t('notifications.title')} position="bottom">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2.5 hover:bg-[#ECEEF0] rounded-lg transition-all duration-200"
                >
                  <img src="/icons/notification.svg" alt="" className="w-6 h-6" />
                </button>
              </Tooltip>
            </div>

            {/* Profile */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-9 h-9 rounded-full bg-[#E0F5EA] flex items-center justify-center text-sm font-semibold text-[#08CF65] hover:ring-2 hover:ring-[#08CF65]/30 transition-all overflow-hidden"
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  (user?.name || user?.email || 'U').slice(0, 2).toUpperCase()
                )}
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-[10px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] overflow-hidden z-50">
                  {/* User info */}
                  <div className="p-4 flex flex-col items-center border-b border-gray-100">
                    <div className="w-14 h-14 rounded-full bg-[#E0F5EA] flex items-center justify-center text-lg font-semibold text-[#08CF65] mb-2 overflow-hidden">
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (user?.name || user?.email || 'U').slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <p className="font-semibold text-gray-900">{user?.name || (locale === 'fr' ? 'Utilisateur' : 'User')}</p>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                  </div>

                  {/* Menu items */}
                  <div className="py-2">
                    <a
                      href="https://app.drime.cloud/account-settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                    >
                      <img src="/icons/profile.svg" alt="" className="w-5 h-5" />
                      {t('profile.profileSettings')}
                    </a>
                    <a
                      href="https://app.drime.cloud/account-settings"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                    >
                      <img src="/icons/settings.svg" alt="" className="w-5 h-5" />
                      {t('profile.settings')}
                    </a>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={clearSessionAndRedirect}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.5039 11.1235V12.8763" />
                        <path d="M9.44385 18.5843V5.41567C9.44385 3.72606 10.9973 2.46304 12.6529 2.80665L17.8757 3.89066C19.113 4.14748 20 5.23688 20 6.49968V17.5003C20 18.7631 19.113 19.8525 17.8757 20.1093L12.6529 21.1933C10.9973 21.537 9.44385 20.2739 9.44385 18.5843Z" />
                        <path d="M9.30548 4.87524H6.45336C5.09841 4.87524 4 5.97283 4 7.32677V16.6731C4 18.027 5.09841 19.1246 6.45336 19.1246H9.30548" />
                      </svg>
                      {t('profile.logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
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
                  href="/dashboard"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <HomeIcon />
                  {t('nav.home')}
                </Link>
              </div>
            </div>

            {/* Agreements section */}
            <div>
              <p className="text-xs font-medium text-gray-500 px-3 mb-2">{t('nav.agreements')}</p>
              <div className="space-y-1">
                <Link
                  href="/dashboard/agreements"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <DocumentIcon />
                  {t('agreements.title')}
                </Link>
                <Link
                  href="/dashboard/agreements?view=sent"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <MailIcon />
                  {locale === 'fr' ? 'Reçus' : 'Sent to me'}
                </Link>
                <Link
                  href="/templates"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-[#ECEEF0] text-gray-900 font-medium"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  {locale === 'fr' ? 'Templates' : 'Templates'}
                </Link>
              </div>
            </div>

            {/* Filtered by status */}
            <div>
              <p className="text-xs font-medium text-gray-500 px-3 mb-2">{locale === 'fr' ? 'Filtrer par statut' : 'Filtered by status'}</p>
              <div className="space-y-1">
                <Link
                  href="/dashboard/agreements?filter=need_to_sign"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <PenIcon />
                  {locale === 'fr' ? 'À signer' : 'Need to sign'}
                </Link>
                <Link
                  href="/dashboard/agreements?filter=in_progress"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <ClockIcon />
                  {locale === 'fr' ? 'En cours' : 'In progress'}
                </Link>
                <Link
                  href="/dashboard/agreements?filter=completed"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <CheckIcon />
                  {locale === 'fr' ? 'Approuvés' : 'Approved'}
                </Link>
                <Link
                  href="/dashboard/agreements?filter=rejected"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-900 hover:bg-[#ECEEF0] transition-colors"
                >
                  <XIcon />
                  {locale === 'fr' ? 'Refusés' : 'Rejected'}
                </Link>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content - white container */}
        <main className="flex-1 bg-white rounded-xl flex flex-col min-h-0 border border-gray-200 overflow-auto">
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {locale === 'fr' ? 'Mes templates' : 'My Templates'}
              </h1>
              <p className="text-gray-500 mt-1">
                {locale === 'fr' ? 'Réutilisez vos documents et champs de signature' : 'Reuse your documents and signature fields'}
              </p>
            </div>
            {/* Import button with dropdown */}
            <div className="relative" ref={importDropdownRef}>
              <button 
                onClick={() => setShowImportDropdown(!showImportDropdown)}
                disabled={isUploading}
                className="px-6 py-2.5 bg-[#08CF65] hover:bg-[#07B859] text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <img src="/icons/upload.svg" alt="" className="w-5 h-5 invert" />
                {locale === 'fr' ? 'Créer un document' : 'Create document'}
                <svg className={`w-4 h-4 transition-transform ${showImportDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showImportDropdown && (
                <div className="absolute top-full right-0 mt-2 bg-white rounded-[10px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] py-2 min-w-[200px] z-10">
                  <button
                    onClick={() => {
                      setShowImportDropdown(false)
                      fileInputRef.current?.click()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                  >
                    <DeviceIcon />
                    {locale === 'fr' ? 'Depuis mon appareil' : 'From my device'}
                  </button>
                  <button
                    onClick={() => {
                      setShowImportDropdown(false)
                      setShowDrimeFilePicker(true)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-900 hover:bg-[#F5F5F5] transition-colors"
                  >
                    <DrimeIcon />
                    {locale === 'fr' ? 'Depuis Drime' : 'From Drime'}
                  </button>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Content */}
          <div className="flex-1 px-8 py-6">
            {/* Tabs */}
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setArchived(false)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  !archived
                    ? 'bg-[#08CF65] text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {locale === 'fr' ? 'Actifs' : 'Active'}
              </button>
              <button
                onClick={() => setArchived(true)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  archived
                    ? 'bg-[#08CF65] text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {locale === 'fr' ? 'Archivés' : 'Archived'}
              </button>
            </div>

            {/* Templates Grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-20">
                <svg
                  className="w-16 h-16 text-gray-400 mx-auto mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {archived 
                    ? (locale === 'fr' ? 'Aucun template archivé' : 'No archived templates')
                    : (locale === 'fr' ? 'Aucun template' : 'No templates')
                  }
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  {archived
                    ? (locale === 'fr' ? 'Vous n\'avez pas encore archivé de templates' : 'You haven\'t archived any templates yet')
                    : (locale === 'fr' ? 'Créez votre premier template en sauvegardant un document depuis l\'étape de révision' : 'Create your first template by saving a document from the review step')
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {templates.map((template) => (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {/* Thumbnail */}
                    <div className="aspect-[3/4] bg-gray-100 relative overflow-hidden">
                      {template.thumbnailUrl ? (
                        <img
                          src={template.thumbnailUrl}
                          alt={template.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg
                            className="w-12 h-12 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-1 truncate">
                        {template.name}
                      </h3>
                      {template.description && (
                        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mb-4">
                        {locale === 'fr' ? 'Créé le' : 'Created on'} {formatDate(template.createdAt)}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUseTemplate(template.id)}
                          className="flex-1 px-3 py-2 bg-[#08CF65] text-white text-sm font-medium rounded-lg hover:bg-[#07b858] transition-colors"
                        >
                          {locale === 'fr' ? 'Utiliser' : 'Use'}
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id, false)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={archived ? (locale === 'fr' ? 'Supprimer définitivement' : 'Delete permanently') : (locale === 'fr' ? 'Archiver' : 'Archive')}
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={archived ? 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' : 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4'}
                            />
                          </svg>
                        </button>
                        {archived && (
                          <button
                            onClick={() => handleDeleteTemplate(template.id, true)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={locale === 'fr' ? 'Supprimer définitivement' : 'Delete permanently'}
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Drime File Picker Modal */}
      <DrimeFilePicker
        isOpen={showDrimeFilePicker}
        onClose={() => setShowDrimeFilePicker(false)}
        onSelect={handleDrimeFileSelect}
      />
    </div>
  )
}
