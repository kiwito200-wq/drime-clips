'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import PDFViewer from '@/components/sign/PDFViewer'
import FieldOverlay from '@/components/sign/FieldOverlay'
import SignaturePad from '@/components/sign/SignaturePad'
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
  const [signaturePadOpen, setSignaturePadOpen] = useState(false)
  const [signaturePadType, setSignaturePadType] = useState<'signature' | 'initials'>('signature')
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0)
  
  // Convert fields to Field format
  const internalFields: Field[] = data?.fields.map(f => ({
    id: f.id,
    type: f.type as FieldType,
    recipientId: data.id, // Use signer ID as recipient ID
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
      
      // Initialize field values
      const initialValues: Record<string, string> = {}
      signerData.fields.forEach((field: FieldData) => {
        if (field.value) {
          initialValues[field.id] = field.value
        } else if (field.type === 'date') {
          initialValues[field.id] = new Date().toLocaleDateString('fr-FR')
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
    setSelectedFieldId(null)
  }, [])

  // Handle field sign
  const handleSignField = useCallback((fieldId: string) => {
    const field = internalFields.find(f => f.id === fieldId)
    if (!field) return
    
    if (field.type === 'signature' || field.type === 'initials') {
      setSelectedFieldId(fieldId)
      setSignaturePadType(field.type as 'signature' | 'initials')
      setSignaturePadOpen(true)
    }
  }, [internalFields])

  // Handle signature save
  const handleSignatureSave = useCallback((dataUrl: string) => {
    if (selectedFieldId) {
      updateFieldValue(selectedFieldId, dataUrl)
      // Auto-scroll to next field
      scrollToNextField(selectedFieldId)
    }
    setSignaturePadOpen(false)
    setSelectedFieldId(null)
  }, [selectedFieldId, updateFieldValue])

  // Scroll to next unfilled field
  const scrollToNextField = useCallback((currentFieldId: string, currentFieldValues?: Record<string, string>) => {
    const values = currentFieldValues || fieldValues
    const currentIndex = internalFields.findIndex(f => f.id === currentFieldId)
    if (currentIndex === -1) return
    
    // Find next unfilled required field
    const nextField = internalFields.slice(currentIndex + 1).find(f => {
      if (!f.required) return false
      const value = values[f.id] || f.value
      return !value || value.trim() === ''
    })
    
    if (nextField) {
      setCurrentPage(nextField.page)
      setSelectedFieldId(nextField.id)
      // Scroll to field after a short delay
      setTimeout(() => {
        const fieldElement = document.querySelector(`[data-field-id="${nextField.id}"]`)
        if (fieldElement) {
          fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)
    }
  }, [internalFields, fieldValues])

  // Handle field update (for checkboxes, text fields, etc.)
  const handleUpdateField = useCallback((fieldId: string, updates: Partial<Field>) => {
    if (updates.value !== undefined) {
      const newValue = String(updates.value)
      updateFieldValue(fieldId, newValue)
      // If checkbox was checked, scroll to next field
      if (updates.value === 'true') {
        setTimeout(() => {
          const updatedValues = { ...fieldValues, [fieldId]: newValue }
          scrollToNextField(fieldId, updatedValues)
        }, 300)
      }
    }
  }, [updateFieldValue, scrollToNextField, fieldValues])

  // Check if all required fields are filled
  const allRequiredFieldsFilled = useCallback(() => {
    if (!data) return false
    return data.fields.every(field => {
      if (!field.required) return true
      const value = fieldValues[field.id]
      return value && value.trim() !== ''
    })
  }, [data, fieldValues])

  // Get unfilled required fields
  const unfilledRequiredFields = useCallback(() => {
    if (!data) return []
    return data.fields.filter(field => {
      if (!field.required) return false
      const value = fieldValues[field.id]
      return !value || value.trim() === ''
    })
  }, [data, fieldValues])

  // Complete signing
  async function handleComplete() {
    if (!allRequiredFieldsFilled()) {
      const unfilled = unfilledRequiredFields()
      alert(`Veuillez remplir tous les champs requis (${unfilled.length} restants)`)
      // Scroll to first unfilled field
      if (unfilled.length > 0) {
        setCurrentPage(unfilled[0].page)
        setTimeout(() => {
          const fieldElement = document.querySelector(`[data-field-id="${unfilled[0].id}"]`)
          if (fieldElement) {
            fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 300)
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

  // Get recipient color (for FieldOverlay)
  const getRecipientColor = useCallback((recipientId: string) => {
    return data?.color || '#EF4444'
  }, [data])

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

  const unfilledCount = unfilledRequiredFields().length
  const totalRequired = data?.fields.filter(f => f.required).length || 0
  const filledCount = totalRequired - unfilledCount

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#08CF65] rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">{data?.envelope.name}</h1>
              <p className="text-sm text-gray-500">Veuillez signer le document</p>
            </div>
          </div>
          
          {/* Progress */}
          <div className="hidden md:flex items-center gap-4">
            <div className="text-sm text-gray-500">
              {filledCount}/{totalRequired} champs complétés
            </div>
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#08CF65] transition-all duration-300"
                style={{ width: `${totalRequired > 0 ? (filledCount / totalRequired) * 100 : 0}%` }}
              />
            </div>
          </div>
          
          <button
            onClick={handleComplete}
            disabled={submitting || !allRequiredFieldsFilled()}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            Terminer la signature
          </button>
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
              {/* Render FieldOverlay for each page */}
              {pages.map((_, pageIndex) => (
                <FieldOverlay
                  key={pageIndex}
                  pageIndex={pageIndex}
                  fields={internalFields.filter(f => f.page === pageIndex)}
                  selectedFieldId={selectedFieldId}
                  onSelectField={setSelectedFieldId}
                  onUpdateField={handleUpdateField}
                  onDeleteField={() => {}} // Not deletable in sign mode
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

        {/* Right sidebar - Field list */}
        <div className="w-80 bg-white border-l overflow-y-auto hidden lg:block">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Champs à remplir</h2>
            <p className="text-sm text-gray-500 mt-1">
              {unfilledCount > 0 ? `${unfilledCount} champ${unfilledCount > 1 ? 's' : ''} restant${unfilledCount > 1 ? 's' : ''}` : 'Tous les champs sont remplis !'}
            </p>
          </div>
          
          <div className="p-4 space-y-3">
            {data?.fields.map((field, index) => {
              const value = fieldValues[field.id]
              const isFilled = value && value.trim() !== ''
              
              return (
                <button
                  key={field.id}
                  onClick={() => {
                    setCurrentPage(field.page)
                    setSelectedFieldId(field.id)
                    if (field.type === 'signature' || field.type === 'initials') {
                      handleSignField(field.id)
                    }
                    // Scroll to field
                    setTimeout(() => {
                      const fieldElement = document.querySelector(`[data-field-id="${field.id}"]`)
                      if (fieldElement) {
                        fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                    }, 300)
                  }}
                  className={`w-full p-3 rounded-xl border text-left transition-all ${
                    isFilled 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isFilled ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {isFilled ? (
                          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-sm font-medium text-gray-500">{index + 1}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {field.label || getFieldLabel(field.type)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Page {field.page + 1} {field.required && '• Requis'}
                        </p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Signature Pad Modal */}
      <AnimatePresence>
        {signaturePadOpen && (
          <SignaturePad
            isOpen={signaturePadOpen}
            onClose={() => setSignaturePadOpen(false)}
            onSave={handleSignatureSave}
            title={signaturePadType === 'initials' ? 'Ajoutez vos initiales' : 'Ajoutez votre signature'}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Get field label
function getFieldLabel(type: string): string {
  const labels: Record<string, string> = {
    signature: 'Signature',
    initials: 'Initiales',
    date: 'Date',
    text: 'Texte',
    checkbox: 'Case',
    name: 'Nom',
    email: 'Email',
  }
  return labels[type] || type
}
