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

const FIELD_TYPES: { type: FieldType; label: string; icon: string; size: { w: number; h: number } }[] = [
  { type: 'signature', label: 'Signature', icon: '✍️', size: { w: 0.2, h: 0.06 } },
  { type: 'initials', label: 'Initiales', icon: 'AB', size: { w: 0.08, h: 0.04 } },
  { type: 'date', label: 'Date', icon: '📅', size: { w: 0.12, h: 0.035 } },
  { type: 'text', label: 'Texte', icon: '📝', size: { w: 0.15, h: 0.035 } },
  { type: 'checkbox', label: 'Case', icon: '☑️', size: { w: 0.025, h: 0.025 } },
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
  const [scale, setScale] = useState(0.8)

  // Load PDF
  useEffect(() => {
    if (!document.pdfUrl) return

    const loadPdf = async () => {
      try {
        setPdfLoading(true)
        setPdfError(null)

        // Use proxy URL
        const proxyUrl = getPdfProxyUrl(document.pdfUrl!)
        console.log('[StepFields] Loading PDF from:', proxyUrl)
        
        const response = await fetch(proxyUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status}`)
        }
        
        const arrayBuffer = await response.arrayBuffer()
        console.log('[StepFields] PDF fetched, size:', arrayBuffer.byteLength)
        
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const loadedPages: { width: number; height: number; imageUrl: string }[] = []

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i)
          const viewport = page.getViewport({ scale: 1.5 })
          const canvas = globalThis.document.createElement('canvas')
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
        console.error('[StepFields] PDF load error:', error)
        setPdfError('Impossible de charger le PDF')
        setPdfLoading(false)
      }
    }

    loadPdf()
  }, [document.pdfUrl])

  // Handle click to add field
  const handlePageClick = useCallback((e: React.MouseEvent, pageIndex: number) => {
    if (!selectedSignerId) return

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    const fieldConfig = FIELD_TYPES.find(f => f.type === selectedFieldType)!
    
    onAddField({
      type: selectedFieldType,
      signerId: selectedSignerId,
      page: pageIndex,
      x: Math.max(0, Math.min(x - fieldConfig.size.w / 2, 1 - fieldConfig.size.w)),
      y: Math.max(0, Math.min(y - fieldConfig.size.h / 2, 1 - fieldConfig.size.h)),
      width: fieldConfig.size.w,
      height: fieldConfig.size.h,
      required: true,
      label: '',
    })
  }, [selectedSignerId, selectedFieldType, onAddField])

  const getSignerById = (id: string) => signers.find(s => s.id === id)

  if (pdfLoading) {
    return (
      <div className="h-[calc(100vh-80px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Chargement du document...</p>
        </div>
      </div>
    )
  }

  if (pdfError) {
    return (
      <div className="h-[calc(100vh-80px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-600 font-medium">{pdfError}</p>
          <button onClick={onBack} className="mt-4 text-sm text-gray-500 hover:text-gray-700">
            Retour
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-80px)] flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r flex flex-col">
        {/* Signers */}
        <div className="p-3 border-b">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Signataire</p>
          <div className="space-y-1">
            {signers.map((signer, i) => (
              <button
                key={signer.id}
                onClick={() => setSelectedSignerId(signer.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all ${
                  selectedSignerId === signer.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: signer.color }}
                >
                  {i + 1}
                </div>
                <span className="truncate text-gray-700">{signer.name || signer.email}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Field types */}
        <div className="p-3 flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Champs</p>
          <div className="grid grid-cols-2 gap-1.5">
            {FIELD_TYPES.map(ft => (
              <button
                key={ft.type}
                onClick={() => setSelectedFieldType(ft.type)}
                className={`p-2 rounded-lg border text-center transition-all ${
                  selectedFieldType === ft.type
                    ? 'border-[#08CF65] bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-lg">{ft.icon}</span>
                <p className="text-xs text-gray-600 mt-0.5">{ft.label}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            Cliquez sur le document pour ajouter
          </p>
        </div>

        {/* Navigation */}
        <div className="p-3 border-t">
          <div className="flex gap-2">
            <button
              onClick={onBack}
              className="flex-1 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Retour
            </button>
            <button
              onClick={onNext}
              disabled={fields.length === 0 || isLoading}
              className="flex-1 py-2 bg-[#08CF65] text-white text-sm font-medium rounded-lg hover:bg-[#07b858] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continuer
            </button>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 bg-gray-100 overflow-auto">
        {/* Zoom */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-500">{fields.length} champ{fields.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1.5 hover:bg-gray-100 rounded">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-xs text-gray-600 w-12 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(1.5, s + 0.1))} className="p-1.5 hover:bg-gray-100 rounded">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <span className="text-xs text-gray-500">{pages.length} page{pages.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Pages */}
        <div className="p-4 flex flex-col items-center gap-4">
          {pages.map((page, pageIndex) => (
            <div
              key={pageIndex}
              className="relative bg-white shadow-md cursor-crosshair"
              style={{ width: page.width * scale, height: page.height * scale }}
              onClick={(e) => handlePageClick(e, pageIndex)}
            >
              <img
                src={page.imageUrl}
                alt={`Page ${pageIndex + 1}`}
                className="w-full h-full pointer-events-none"
                draggable={false}
              />
              
              {/* Fields */}
              {fields.filter(f => f.page === pageIndex).map(field => {
                const signer = getSignerById(field.signerId)
                const isSelected = selectedFieldId === field.id
                
                return (
                  <motion.div
                    key={field.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`absolute border-2 rounded flex items-center justify-center text-xs cursor-pointer transition-shadow ${
                      isSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'
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
                      setSelectedFieldId(isSelected ? null : field.id)
                    }}
                  >
                    <span className="truncate px-1 font-medium">
                      {FIELD_TYPES.find(f => f.type === field.type)?.icon}
                    </span>
                    
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
              })}

              {/* Page number */}
              <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                {pageIndex + 1}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
