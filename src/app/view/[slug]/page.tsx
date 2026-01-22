'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PDFViewer from '@/components/sign/PDFViewer'

interface Signer {
  id: string
  email: string
  name: string | null
  status: string
  signedAt: string | null
}

interface EnvelopeDetails {
  id: string
  slug: string
  name: string
  status: string
  pdfUrl: string
  createdAt: string
  updatedAt: string
  signers: Signer[]
}

export default function ViewDocumentPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  
  const [envelope, setEnvelope] = useState<EnvelopeDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [currentPage, setCurrentPage] = useState(0)
  const [pages, setPages] = useState<{ width: number; height: number }[]>([])

  const fetchEnvelope = useCallback(async () => {
    try {
      const res = await fetch(`/api/envelopes/${slug}`)
      if (!res.ok) {
        setError('Document non trouvé')
        setLoading(false)
        return
      }
      
      const data = await res.json()
      setEnvelope(data.envelope || data)
      
      // Get PDF URL
      const pdfRes = await fetch(`/api/envelopes/${slug}/pdf-url`)
      if (pdfRes.ok) {
        const pdfData = await pdfRes.json()
        setPdfUrl(pdfData.url)
      }
      
      setLoading(false)
    } catch (err) {
      setError('Erreur lors du chargement')
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchEnvelope()
  }, [fetchEnvelope])

  const handlePagesLoaded = useCallback((loadedPages: { width: number; height: number }[]) => {
    setPages(loadedPages)
  }, [])

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { label: string; color: string }> = {
      draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700' },
      pending: { label: 'En cours', color: 'bg-amber-100 text-amber-700' },
      completed: { label: 'Complété', color: 'bg-green-100 text-green-700' },
      rejected: { label: 'Rejeté', color: 'bg-red-100 text-red-700' },
    }
    return styles[status] || styles.draft
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement du document...</p>
        </div>
      </div>
    )
  }

  if (error || !envelope) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Erreur</h1>
          <p className="text-gray-500 mb-4">{error}</p>
          <button onClick={() => router.back()} className="text-[#08CF65] hover:underline">
            Retour au dashboard
          </button>
        </div>
      </div>
    )
  }

  const statusBadge = getStatusBadge(envelope.status)

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="font-semibold text-gray-900">{envelope.name}</h1>
              <p className="text-sm text-gray-500">
                Créé le {formatDate(envelope.createdAt)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
            
            {pdfUrl && (
              <a
                href={pdfUrl}
                download={envelope.name}
                className="flex items-center gap-2 px-4 py-2 bg-[#08CF65] hover:bg-[#06B557] text-white font-medium rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Télécharger
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* PDF Viewer */}
        <div className="flex-1 overflow-auto">
          {pdfUrl ? (
            <PDFViewer
              fileUrl={pdfUrl}
              onPagesLoaded={handlePagesLoaded}
              scale={scale}
              onScaleChange={setScale}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              isDrawMode={false}
              onDraw={() => {}}
              onDrop={() => {}}
              isDragging={false}
            >
              {null}
            </PDFViewer>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Chargement du PDF...</p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Signers */}
        <aside className="w-80 bg-white border-l border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Signataires</h2>
          
          <div className="space-y-4">
            {(envelope.signers || []).map((signer, index) => (
              <div key={signer.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#08CF65] to-[#06B557] flex items-center justify-center text-white font-medium flex-shrink-0">
                  {(signer.name || signer.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {signer.name || signer.email}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{signer.email}</p>
                  <div className="mt-1">
                    {signer.status === 'signed' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Signé le {formatDate(signer.signedAt)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        En attente
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Audit Trail */}
          <div className="mt-8">
            <h2 className="font-semibold text-gray-900 mb-4">Historique</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-[#08CF65] rounded-full mt-1.5" />
                <div>
                  <p className="text-gray-900">Document créé</p>
                  <p className="text-gray-500">{formatDate(envelope.createdAt)}</p>
                </div>
              </div>
              {(envelope.signers || []).filter(s => s.status === 'signed').map(signer => (
                <div key={signer.id} className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-[#08CF65] rounded-full mt-1.5" />
                  <div>
                    <p className="text-gray-900">{signer.name || signer.email} a signé</p>
                    <p className="text-gray-500">{formatDate(signer.signedAt)}</p>
                  </div>
                </div>
              ))}
              {envelope.status === 'completed' && (
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-[#08CF65] rounded-full mt-1.5" />
                  <div>
                    <p className="text-gray-900">Document complété</p>
                    <p className="text-gray-500">{formatDate(envelope.updatedAt)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
