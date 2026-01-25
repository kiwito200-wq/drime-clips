'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'

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

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [archived, setArchived] = useState(false)

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mes templates</h1>
              <p className="text-sm text-gray-500 mt-1">
                Réutilisez vos documents et champs de signature
              </p>
            </div>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Retour au tableau de bord
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            Actifs
          </button>
          <button
            onClick={() => setArchived(true)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              archived
                ? 'bg-[#08CF65] text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Archivés
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
              {archived ? 'Aucun template archivé' : 'Aucun template'}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {archived
                ? 'Vous n\'avez pas encore archivé de templates'
                : 'Créez votre premier template en sauvegardant un document depuis l\'étape de révision'}
            </p>
            {!archived && (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#08CF65] text-white font-medium rounded-lg hover:bg-[#07b858] transition-colors"
              >
                Créer un document
              </Link>
            )}
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
                    Créé le {formatDate(template.createdAt)}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUseTemplate(template.id)}
                      className="flex-1 px-3 py-2 bg-[#08CF65] text-white text-sm font-medium rounded-lg hover:bg-[#07b858] transition-colors"
                    >
                      Utiliser
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id, false)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title={archived ? 'Supprimer définitivement' : 'Archiver'}
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
                        title="Supprimer définitivement"
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
    </div>
  )
}
