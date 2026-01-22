'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import PDFViewer from '@/components/sign/PDFViewer'
import FieldOverlay from '@/components/sign/FieldOverlay'
import SigningBanner from '@/components/sign/SigningBanner'
import { Field, FieldType } from '@/components/sign/types'

interface FieldData {
  id: string
  type: string
  label: string | null
  page: number
  x: number
  y: number
  width: number
  height: number
  required: boolean
  value: string | null
}

interface SignerData {
  id: string
  name: string | null
  email: string
  color: string
  envelope: {
    id: string
    slug: string
    name: string
    pdfUrl: string
    status: string
  }
  fields: FieldData[]
}

export default function SignPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  
  const [data, setData] = useState<SignerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)
  
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pages, setPages] = useState<{ width: number; height: number }[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [scale, setScale] = useState(0.8)
  
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0)
  const [showWelcome, setShowWelcome] = useState(true)
  
  // Convert fields to Field format and sort by position (page first, then Y position top to bottom)
  const internalFields: Field[] = useMemo(() => {
    const fields = data?.fields.map(f => ({
      id: f.id,
      type: f.type as FieldType,
      recipientId: data.id,
      page: f.page,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      required: f.required,
      label: f.label || '',
      placeholder: '',
      value: fieldValues[f.id] || f.value || undefined,
    })) || []
    
    // Sort by page, then by Y position (top to bottom)
    return fields.sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page
      return a.y - b.y
    })
  }, [data?.fields, data?.id, fieldValues])
  
  // Fetch signer data
  const fetchSignerData = useCallback(async () => {
    try {
      const res = await fetch(`/api/sign/${token}`)
      
      if (!res.ok) {
        const errorData = await res.json()
        setError(errorData.error || 'Invalid signing link')
        return
      }
      
      const signerData = await res.json()
      setData(signerData)
      
      // Initialize field values (only pre-fill name and email, NOT date)
      const initialValues: Record<string, string> = {}
      signerData.fields.forEach((field: FieldData) => {
        if (field.value) {
          initialValues[field.id] = field.value
        } else if (field.type === 'name' && signerData.name) {
          initialValues[field.id] = signerData.name
        } else if (field.type === 'email') {
          initialValues[field.id] = signerData.email
        }
      })
      setFieldValues(initialValues)
      
      // Get signed PDF URL
      const pdfRes = await fetch(`/api/sign/${token}/pdf`)
      if (pdfRes.ok) {
        const pdfData = await pdfRes.json()
        setPdfUrl(pdfData.url)
      }
    } catch (err) {
      setError('Failed to load signing page')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchSignerData()
  }, [fetchSignerData])

  // Handle PDF pages loaded
  const handlePagesLoaded = useCallback((loadedPages: { width: number; height: number }[]) => {
    setPages(loadedPages)
  }, [])

  // Update field value
  const updateFieldValue = useCallback((fieldId: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }))
  }, [])

  // Handle field change from banner - scroll to that field
  const handleFieldChange = useCallback((index: number) => {
    setCurrentFieldIndex(index)
    const field = internalFields[index]
    if (field) {
      setCurrentPage(field.page)
      setSelectedFieldId(field.id)
      
      // Scroll to field
      setTimeout(() => {
        const fieldElement = document.querySelector(`[data-field-id="${field.id}"]`)
        if (fieldElement) {
          fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    }
  }, [internalFields])

  // Handle value change from banner
  const handleValueChange = useCallback((fieldId: string, value: string) => {
    updateFieldValue(fieldId, value)
    
    // Auto-scroll to next unfilled field after a short delay
    setTimeout(() => {
      const currentIndex = internalFields.findIndex(f => f.id === fieldId)
      if (currentIndex < internalFields.length - 1) {
        const nextField = internalFields[currentIndex + 1]
        if (nextField) {
          setCurrentPage(nextField.page)
          setSelectedFieldId(nextField.id)
          setTimeout(() => {
            const fieldElement = document.querySelector(`[data-field-id="${nextField.id}"]`)
            if (fieldElement) {
              fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }, 100)
        }
      }
    }, 200)
  }, [internalFields, updateFieldValue])

  // Handle update from FieldOverlay (for clicking on fields directly)
  const handleUpdateField = useCallback((fieldId: string, updates: Partial<Field>) => {
    if (updates.value !== undefined) {
      updateFieldValue(fieldId, String(updates.value))
    }
  }, [updateFieldValue])

  // Handle clicking on a field in the PDF - jump to that field in the banner
  const handleSignField = useCallback((fieldId: string) => {
    const index = internalFields.findIndex(f => f.id === fieldId)
    if (index !== -1) {
      setCurrentFieldIndex(index)
      setSelectedFieldId(fieldId)
    }
  }, [internalFields])

  // Complete signing
  async function handleComplete() {
    const allFilled = internalFields.every(f => {
      if (!f.required) return true
      const value = fieldValues[f.id]
      if (f.type === 'checkbox') return value === 'true'
      return value && value.trim() !== ''
    })
    
    if (!allFilled) {
      const unfilledIndex = internalFields.findIndex(f => {
        if (!f.required) return false
        const value = fieldValues[f.id]
        if (f.type === 'checkbox') return value !== 'true'
        return !value || value.trim() === ''
      })
      
      if (unfilledIndex !== -1) {
        handleFieldChange(unfilledIndex)
      }
      return
    }
    
    setSubmitting(true)
    
    try {
      const res = await fetch(`/api/sign/${token}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldValues }),
      })
      
      if (res.ok) {
        setCompleted(true)
      } else {
        const errorData = await res.json()
        alert(errorData.error || 'Failed to complete signing')
      }
    } catch (err) {
      alert('Failed to complete signing')
    } finally {
      setSubmitting(false)
    }
  }

  // Get recipient color
  const getRecipientColor = useCallback((recipientId: string) => {
    return data?.color || '#EF4444'
  }, [data])

  // Start signing - dismiss welcome
  const startSigning = useCallback(() => {
    setShowWelcome(false)
    // Scroll to first field
    if (internalFields.length > 0) {
      handleFieldChange(0)
    }
  }, [internalFields, handleFieldChange])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement du document...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Lien invalide</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  // Completed state
  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-md"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Signature complète !</h1>
          <p className="text-gray-500 mb-6">
            Merci d&apos;avoir signé <strong>&ldquo;{data?.envelope.name}&rdquo;</strong>.
            <br />Vous recevrez une copie par email une fois que tous les signataires auront signé.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Signature vérifiée cryptographiquement
          </div>
        </motion.div>
      </div>
    )
  }

  const requiredFields = internalFields.filter(f => f.required)
  const filledCount = requiredFields.filter(f => {
    const value = fieldValues[f.id]
    if (f.type === 'checkbox') return value === 'true'
    return value && value.trim() !== ''
  }).length

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-48">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-[#08CF65]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span className="font-semibold text-gray-900">Drime Sign</span>
            </div>
          </div>
          
          <div className="text-center flex-1 px-4">
            <p className="text-sm text-gray-600 truncate">
              <span className="font-medium">Signature:</span> {data?.envelope.name}
            </p>
          </div>
          
          {pdfUrl && (
            <a
              href={pdfUrl}
              download
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Télécharger
            </a>
          )}
        </div>
      </header>

      {/* Main content */}
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
            {/* Render FieldOverlay for each page */}
            {pages.map((_, pageIndex) => (
              <FieldOverlay
                key={pageIndex}
                pageIndex={pageIndex}
                fields={internalFields.filter(f => f.page === pageIndex)}
                selectedFieldId={selectedFieldId}
                onSelectField={setSelectedFieldId}
                onUpdateField={handleUpdateField}
                onDeleteField={() => {}}
                getRecipientColor={getRecipientColor}
                isPreviewMode={false}
                isSignMode={true}
                onSignField={handleSignField}
                scale={scale}
              />
            ))}
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

      {/* Welcome overlay */}
      {showWelcome && data && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm mx-4 text-center shadow-2xl"
          >
            <div className="w-14 h-14 bg-[#08CF65] rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Prêt à signer ?
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              {internalFields.length} champ{internalFields.length > 1 ? 's' : ''} à remplir
            </p>
            <button
              onClick={startSigning}
              className="w-full py-2.5 bg-[#08CF65] hover:bg-[#06B557] text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Commencer
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </motion.div>
        </div>
      )}

      {/* Signing Banner - fixed at bottom */}
      {!showWelcome && internalFields.length > 0 && (
        <SigningBanner
          fields={internalFields}
          fieldValues={fieldValues}
          currentFieldIndex={currentFieldIndex}
          onFieldChange={handleFieldChange}
          onValueChange={handleValueChange}
          onComplete={handleComplete}
          isCompleting={submitting}
          signerName={data?.name || ''}
          signerEmail={data?.email || ''}
        />
      )}
    </div>
  )
}
