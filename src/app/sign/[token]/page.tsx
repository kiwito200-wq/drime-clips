'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import PDFViewer from '@/components/sign/PDFViewer'
import FieldOverlay from '@/components/sign/FieldOverlay'
import SigningBanner from '@/components/sign/SigningBanner'
import Phone2FAGate from '@/components/Phone2FAGate'
import { Field, FieldType } from '@/components/sign/types'
import { useTranslation } from '@/lib/i18n/I18nContext'

// Dynamic import of Lottie to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

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
  phone2FA: boolean
  phone2FANumber: string | null
  phone2FAVerified: boolean
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
  const { t, locale } = useTranslation()
  const token = params.token as string
  
  const [data, setData] = useState<SignerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [phone2FAVerified, setPhone2FAVerified] = useState(false)
  
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pages, setPages] = useState<{ width: number; height: number }[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  // Set initial scale based on screen width - smaller on mobile to fit the document
  const [scale, setScale] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640 ? 0.45 : 0.8
    }
    return 0.8
  })
  
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0)
  const [animationData, setAnimationData] = useState<any>(null)
  
  // Load animation data dynamically
  useEffect(() => {
    fetch('/signature-animation.json')
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(() => {
        // Fallback if animation fails to load
        setAnimationData(null)
      })
  }, [])
  
  // Check if user is authenticated
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.user) {
          setIsAuthenticated(true)
        }
      })
      .catch(() => {})
  }, [])
  
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
      
      // Check if 2FA is already verified on the server
      if (signerData.phone2FAVerified) {
        setPhone2FAVerified(true)
      }
      
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

  // Get recipient color - use Drime purple as default
  const getRecipientColor = useCallback((recipientId: string) => {
    return data?.color || '#7E33F7'
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

  // Phone 2FA verification required
  if (data?.phone2FA && !phone2FAVerified && data?.phone2FANumber) {
    return (
      <Phone2FAGate
        envelopeSlug={data.envelope.slug}
        signerEmail={data.email}
        signerName={data.name || ''}
        phone={data.phone2FANumber}
        documentName={data.envelope.name}
        onVerified={() => {
          setPhone2FAVerified(true)
          // Update server to mark as verified
          fetch(`/api/sign/${token}/verify-2fa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }).catch(console.error)
        }}
      />
    )
  }

  // Completed state
  if (completed) {
    return (
      <div className="min-h-screen bg-[#F8F7FC] flex flex-col items-center justify-center px-4">
        {/* Animated signature using Lottie - responsive */}
        <div className="relative mb-4">
          <div className="w-[300px] h-[200px] sm:w-[500px] sm:h-[350px] md:w-[700px] md:h-[500px] flex items-center justify-center">
            {animationData && (
              <Lottie
                animationData={animationData}
                loop={false}
                className="w-full h-full opacity-30"
              />
            )}
          </div>
          
          {/* Text overlay - responsive */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.4 }}
              className="text-2xl sm:text-4xl md:text-6xl font-bold text-[#7E33F7] text-center"
            >
              {t('success.signatureComplete')}
            </motion.h1>
          </div>
        </div>
        
        {/* Thank you message - responsive */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 0.4 }}
          className="text-center max-w-lg px-4"
        >
          <p className="text-gray-700 text-base sm:text-lg md:text-xl mb-2">
            {locale === 'fr' ? "Merci d'avoir signé" : 'Thank you for signing'} <strong className="text-gray-900">&ldquo;{data?.envelope.name}&rdquo;</strong>.
          </p>
          <p className="text-gray-500 text-sm sm:text-base mb-6">
            {t('success.youWillReceiveCopy')}
          </p>
          
          <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-gray-400 mb-8">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            {t('success.verifiedSignature')}
          </div>
          
          {/* Button to return to dashboard (if authenticated) */}
          {isAuthenticated && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5 }}
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 bg-[#08CF65] text-white rounded-xl font-medium hover:bg-[#07b858] transition-colors"
            >
              {t('success.backToDashboard')}
            </motion.button>
          )}
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
    <div className="min-h-screen bg-gray-100 flex flex-col pb-36 sm:pb-48">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="w-full px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          {/* Left - Logo */}
          <div className="flex items-center flex-shrink-0">
            <img src="/drime-logo.png" alt="Drime Sign" className="h-5 sm:h-6" />
          </div>
          
          {/* Center - Document name (hidden on mobile, visible on sm+) */}
          <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 max-w-[40%]">
            <p className="text-sm text-gray-600 truncate">
              <span className="font-medium">{t('signing.title')}:</span> {data?.envelope.name}
            </p>
          </div>
          
          {/* Right - Download */}
          {pdfUrl && (
            <a
              href={pdfUrl}
              download
              className="text-xs sm:text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">{t('common.download')}</span>
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

      {/* Signing Banner - fixed at bottom */}
      {internalFields.length > 0 && (
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
          isAuthenticated={isAuthenticated}
          signerId={data?.id}
          envelopeSlug={data?.envelope?.slug}
        />
      )}
    </div>
  )
}
