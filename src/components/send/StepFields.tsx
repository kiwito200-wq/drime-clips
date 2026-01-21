'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getPdfProxyUrl } from '@/lib/pdf-utils'

interface Signer {
  id: string
  name: string
  email: string
  color: string
}

interface SignField {
  id: string
  type: 'signature' | 'initials' | 'date' | 'text' | 'checkbox' | 'name' | 'email'
  signerId: string
  page: number
  x: number
  y: number
  width: number
  height: number
  required: boolean
  label: string
}

interface DocumentData {
  file: File | null
  name: string
  pdfUrl: string | null
  envelopeId: string | null
  slug: string | null
}

interface StepFieldsProps {
  document: DocumentData
  signers: Signer[]
  fields: SignField[]
  onAddField: (field: Omit<SignField, 'id'>) => void
  onRemoveField: (id: string) => void
  onUpdateField: (id: string, updates: Partial<SignField>) => void
  onBack: () => void
  onNext: () => void
  isLoading: boolean
}

type FieldType = SignField['type']

const FIELD_TYPES: { type: FieldType; label: string; icon: string; defaultSize: { width: number; height: number } }[] = [
  { type: 'signature', label: 'Signature', icon: '✍️', defaultSize: { width: 0.2, height: 0.06 } },
  { type: 'initials', label: 'Initiales', icon: 'AB', defaultSize: { width: 0.08, height: 0.04 } },
  { type: 'date', label: 'Date', icon: '📅', defaultSize: { width: 0.12, height: 0.035 } },
  { type: 'text', label: 'Texte', icon: '📝', defaultSize: { width: 0.15, height: 0.035 } },
  { type: 'checkbox', label: 'Case', icon: '☑️', defaultSize: { width: 0.025, height: 0.025 } },
  { type: 'name', label: 'Nom', icon: '👤', defaultSize: { width: 0.15, height: 0.035 } },
  { type: 'email', label: 'Email', icon: '📧', defaultSize: { width: 0.18, height: 0.035 } },
]

export default function StepFields({
  document,
  signers,
  fields,
  onAddField,
  onRemoveField,
  onUpdateField,
  onBack,
  onNext,
  isLoading,
}: StepFieldsProps) {
  const [pages, setPages] = useState<{ width: number; height: number; imageUrl: string }[]>([])
  const [pdfLoading, setPdfLoading] = useState(true)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [selectedSignerId, setSelectedSignerId] = useState<string>(signers[0]?.id || '')
  const [selectedFieldType, setSelectedFieldType] = useState<FieldType>('signature')
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)

  // Load PDF
  useEffect(() => {
    if (!document.pdfUrl) return

    const loadPdf = async () => {
      try {
        setPdfLoading(true)
        setPdfError(null)

        // Use proxy URL to avoid CORS
        const proxyUrl = getPdfProxyUrl(document.pdfUrl!)
        const response = await fetch(proxyUrl)
        if (!response.ok) throw new Error('Failed to fetch PDF')
        
        const arrayBuffer = await response.arrayBuffer()
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const loadedPages: { width: number; height: number; imageUrl: string }[] = []

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i)
          const viewport = page.getViewport({ scale: 1.5 })
          const canvas = window.document.createElement('canvas')
          const context = canvas.getContext('2d')!
          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvasContext: context, viewport }).promise
          
          loadedPages.push({
            width: viewport.width,
            height: viewport.height,
            imageUrl: canvas.toDataURL('image/png'),
          })
        }

        setPages(loadedPages)
        setPdfLoading(false)
      } catch (error) {
        console.error('PDF load error:', error)
        setPdfError('Impossible de charger le PDF')
        setPdfLoading(false)
      }
    }

    loadPdf()
  }, [document.pdfUrl])

  // Handle click on page to add field
  const handlePageClick = useCallback((e: React.MouseEvent, pageIndex: number) => {
    if (!selectedSignerId) return

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    const fieldTypeConfig = FIELD_TYPES.find(f => f.type === selectedFieldType)!
    
    onAddField({
      type: selectedFieldType,
      signerId: selectedSignerId,
      page: pageIndex,
      x: Math.max(0, Math.min(x - fieldTypeConfig.defaultSize.width / 2, 1 - fieldTypeConfig.defaultSize.width)),
      y: Math.max(0, Math.min(y - fieldTypeConfig.defaultSize.height / 2, 1 - fieldTypeConfig.defaultSize.height)),
      width: fieldTypeConfig.defaultSize.width,
      height: fieldTypeConfig.defaultSize.height,
      required: true,
      label: '',
    })
  }, [selectedSignerId, selectedFieldType, onAddField])

  // Get signer by ID
  const getSignerById = (id: string) => signers.find(s => s.id === id)

  // Render field on page
  const renderField = (field: SignField, pageWidth: number, pageHeight: number) => {
    const signer = getSignerById(field.signerId)
    const isSelected = selectedFieldId === field.id
    
    return (
      <motion.div
        key={field.id}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`absolute cursor-move border-2 rounded flex items-center justify-center text-xs font-medium transition-shadow ${
          isSelected ? 'ring-2 ring-offset-1 ring-blue-500 shadow-lg' : 'hover:shadow-md'
        }`}
        style={{
          left: `${field.x * 100}%`,
          top: `${field.y * 100}%`,
          width: `${field.width * 100}%`,
          height: `${field.height * 100}%`,
          backgroundColor: `${signer?.color}20`,
          borderColor: signer?.color,
          color: signer?.color,
        }}
        onClick={(e) => {
          e.stopPropagation()
          setSelectedFieldId(field.id)
        }}
        draggable
        onDragStart={() => setIsDragging(true)}
        onDragEnd={(e) => {
          setIsDragging(false)
          // Update field position would go here
        }}
      >
        <span className="truncate px-1">
          {FIELD_TYPES.find(f => f.type === field.type)?.icon} {FIELD_TYPES.find(f => f.type === field.type)?.label}
        </span>
        
        {/* Delete button */}
        {isSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemoveField(field.id)
              setSelectedFieldId(null)
            }}
            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
          >
            ×
          </button>
        )}
      </motion.div>
    )
  }

  const canContinue = fields.length > 0

  if (pdfLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement du document...</p>
        </div>
      </div>
    )
  }

  if (pdfError) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-600 font-medium">{pdfError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-120px)] flex">
      {/* Sidebar - Field palette */}
      <div className="w-80 bg-white border-r flex flex-col">
        {/* Signers selector */}
        <div className="p-4 border-b">
          <h3 className="font-medium text-gray-900 mb-3">Signataire actif</h3>
          <div className="space-y-2">
            {signers.map(signer => (
              <button
                key={signer.id}
                onClick={() => setSelectedSignerId(signer.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                  selectedSignerId === signer.id 
                    ? 'bg-gray-100 ring-2' 
                    : 'hover:bg-gray-50'
                }`}
                style={{
                  ['--tw-ring-color' as string]: selectedSignerId === signer.id ? signer.color : undefined,
                } as React.CSSProperties}
              >
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: signer.color }}
                />
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{signer.name || 'Sans nom'}</p>
                  <p className="text-xs text-gray-500 truncate">{signer.email}</p>
                </div>
                <span className="text-xs text-gray-400">
                  {fields.filter(f => f.signerId === signer.id).length} champs
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Field types */}
        <div className="p-4 flex-1 overflow-y-auto">
          <h3 className="font-medium text-gray-900 mb-3">Types de champs</h3>
          <p className="text-xs text-gray-500 mb-3">Cliquez sur le document pour ajouter</p>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_TYPES.map(fieldType => (
              <button
                key={fieldType.type}
                onClick={() => setSelectedFieldType(fieldType.type)}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  selectedFieldType === fieldType.type
                    ? 'border-[#08CF65] bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-xl block mb-1">{fieldType.icon}</span>
                <span className="text-xs font-medium text-gray-700">{fieldType.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected field info */}
        {selectedFieldId && (
          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Champ sélectionné</span>
              <button
                onClick={() => {
                  onRemoveField(selectedFieldId)
                  setSelectedFieldId(null)
                }}
                className="text-red-500 hover:text-red-600 text-sm"
              >
                Supprimer
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="p-4 border-t bg-white">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
            >
              Retour
            </button>
            <button
              onClick={onNext}
              disabled={!canContinue || isLoading}
              className="btn-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Suivant
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main - PDF Viewer */}
      <div className="flex-1 bg-gray-100 overflow-auto">
        {/* Zoom controls */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-gray-500">{pages.length} page{pages.length > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-sm font-medium w-16 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(2, s + 0.25))} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <span className="text-sm text-gray-500">{fields.length} champ{fields.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Pages */}
        <div className="p-6 flex flex-col items-center gap-6">
          {pages.map((page, pageIndex) => (
            <div
              key={pageIndex}
              className="relative bg-white shadow-lg cursor-crosshair"
              style={{
                width: page.width * scale,
                height: page.height * scale,
              }}
              onClick={(e) => handlePageClick(e, pageIndex)}
            >
              <img
                src={page.imageUrl}
                alt={`Page ${pageIndex + 1}`}
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
              
              {/* Fields overlay */}
              <div className="absolute inset-0">
                {fields
                  .filter(f => f.page === pageIndex)
                  .map(field => renderField(field, page.width * scale, page.height * scale))
                }
              </div>

              {/* Page number */}
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                {pageIndex + 1}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
