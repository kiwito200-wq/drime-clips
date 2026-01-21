'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import StepUpload from '@/components/send/StepUpload'
import StepSigners from '@/components/send/StepSigners'
import StepFields from '@/components/send/StepFields'
import StepReview from '@/components/send/StepReview'

// Types
export interface Signer {
  id: string
  name: string
  email: string
  color: string
}

export interface SignField {
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

export interface DocumentData {
  file: File | null
  name: string
  pdfUrl: string | null
  envelopeId: string | null
  slug: string | null
}

const STEPS = [
  { id: 1, label: 'Document' },
  { id: 2, label: 'Signataires' },
  { id: 3, label: 'Champs' },
  { id: 4, label: 'Envoyer' },
]

const SIGNER_COLORS = [
  '#EF4444', '#3B82F6', '#10B981', '#F59E0B', 
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
]

function SendPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [currentStep, setCurrentStep] = useState(1)
  const [document, setDocument] = useState<DocumentData>({
    file: null,
    name: '',
    pdfUrl: null,
    envelopeId: null,
    slug: null,
  })
  const [signers, setSigners] = useState<Signer[]>([])
  const [fields, setFields] = useState<SignField[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Vérifier si on a un slug existant
  useEffect(() => {
    const slug = searchParams.get('slug')
    if (slug) {
      loadExistingEnvelope(slug)
    }
  }, [searchParams])

  const loadExistingEnvelope = async (slug: string) => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/envelopes/${slug}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const envelope = data.envelope
        setDocument({
          file: null,
          name: envelope.name,
          pdfUrl: envelope.pdfUrl,
          envelopeId: envelope.id,
          slug: envelope.slug,
        })
        if (envelope.signers?.length > 0) {
          setSigners(envelope.signers.map((s: any) => ({
            id: s.id,
            name: s.name || '',
            email: s.email,
            color: s.color,
          })))
        }
        if (envelope.fields?.length > 0) {
          setFields(envelope.fields.map((f: any) => ({
            id: f.id,
            type: f.type,
            signerId: f.signerId,
            page: f.page,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            required: f.required,
            label: f.label || '',
          })))
        }
        setCurrentStep(2)
      }
    } catch (error) {
      console.error('Failed to load envelope:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Upload document
  const handleDocumentUpload = useCallback(async (file: File, name: string) => {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', name)
      
      const res = await fetch('/api/envelopes', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      
      if (res.ok) {
        const data = await res.json()
        setDocument({
          file,
          name,
          pdfUrl: data.envelope.pdfUrl,
          envelopeId: data.envelope.id,
          slug: data.envelope.slug,
        })
        setCurrentStep(2)
      } else {
        alert('Échec de l\'upload')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Échec de l\'upload')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Self-sign - je suis le seul signataire
  const handleSelfSign = useCallback(async () => {
    setIsLoading(true)
    try {
      // Récupérer l'utilisateur connecté
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      let email = 'moi@drime.cloud'
      let name = 'Moi'
      
      if (res.ok) {
        const data = await res.json()
        if (data.user) {
          email = data.user.email
          name = data.user.name || 'Moi'
        }
      }

      const selfSigner: Signer = {
        id: 'self-' + Date.now(),
        name,
        email,
        color: SIGNER_COLORS[0],
      }
      setSigners([selfSigner])
      
      // Sauvegarder le signataire en base et récupérer le vrai ID
      if (document.slug) {
        const res = await fetch(`/api/envelopes/${document.slug}/signers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signers: [{ name, email, color: SIGNER_COLORS[0] }] }),
          credentials: 'include',
        })
        
        if (res.ok) {
          const data = await res.json()
          // Utiliser le vrai ID de la DB
          if (data.signers && data.signers.length > 0) {
            setSigners([{
              id: data.signers[0].id,
              name: data.signers[0].name || name,
              email: data.signers[0].email,
              color: data.signers[0].color || SIGNER_COLORS[0],
            }])
          }
        }
      }
      
      // Passer directement à l'étape des champs
      setCurrentStep(3)
    } catch (error) {
      console.error('Self-sign error:', error)
      alert('Erreur lors de la création du signataire')
      return
    } finally {
      setIsLoading(false)
    }
  }, [document.slug])

  // Ajouter un signataire
  const addSigner = useCallback((name: string, email: string) => {
    const newSigner: Signer = {
      id: 'signer-' + Date.now(),
      name,
      email,
      color: SIGNER_COLORS[signers.length % SIGNER_COLORS.length],
    }
    setSigners(prev => [...prev, newSigner])
  }, [signers.length])

  const removeSigner = useCallback((id: string) => {
    setSigners(prev => prev.filter(s => s.id !== id))
    setFields(prev => prev.filter(f => f.signerId !== id))
  }, [])

  const updateSigner = useCallback((id: string, updates: Partial<Signer>) => {
    setSigners(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }, [])

  // Sauvegarder les signataires
  const saveSigners = useCallback(async () => {
    if (!document.slug || signers.length === 0) return false
    
    setIsLoading(true)
    try {
      const res = await fetch(`/api/envelopes/${document.slug}/signers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signers }),
        credentials: 'include',
      })
      
      if (res.ok) {
        const data = await res.json()
        if (data.signers) {
          setSigners(data.signers.map((s: any, i: number) => ({
            ...signers[i],
            id: s.id,
          })))
        }
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to save signers:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [document.slug, signers])

  // Champs
  const addField = useCallback((field: Omit<SignField, 'id'>) => {
    setFields(prev => [...prev, { ...field, id: 'field-' + Date.now() }])
  }, [])

  const removeField = useCallback((id: string) => {
    setFields(prev => prev.filter(f => f.id !== id))
  }, [])

  const updateField = useCallback((id: string, updates: Partial<SignField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }, [])

  const saveFields = useCallback(async () => {
    if (!document.slug) return false
    
    setIsLoading(true)
    try {
      // Map temporary signer IDs to actual database IDs
      const fieldsWithCorrectSignerIds = fields.map(field => {
        // Find the signer in our state that matches
        const signer = signers.find(s => s.id === field.signerId)
        return {
          ...field,
          signerId: signer?.id || field.signerId, // Use actual signer ID
        }
      })
      
      const res = await fetch(`/api/envelopes/${document.slug}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fieldsWithCorrectSignerIds }),
        credentials: 'include',
      })
      return res.ok
    } catch (error) {
      console.error('Failed to save fields:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [document.slug, fields, signers])

  // Envoyer
  const sendDocument = useCallback(async (message?: string) => {
    if (!document.slug) return
    
    setIsLoading(true)
    try {
      await saveFields()
      
      const res = await fetch(`/api/envelopes/${document.slug}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        credentials: 'include',
      })
      
      if (res.ok) {
        const data = await res.json()
        
        // If self-sign, redirect to signing page instead of dashboard
        if (data.isSelfSign && data.selfSignUrl) {
          router.push(data.selfSignUrl)
        } else {
          router.push(`/dashboard?sent=${document.slug}`)
        }
      } else {
        const error = await res.json()
        alert(error.error || 'Échec de l\'envoi')
      }
    } catch (error) {
      console.error('Send error:', error)
      alert('Échec de l\'envoi')
    } finally {
      setIsLoading(false)
    }
  }, [document.slug, saveFields, router])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header compact style HelloSign */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Close */}
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Steps - Style HelloSign compact */}
            <div className="flex items-center gap-1">
              {STEPS.map((step, index) => {
                const isActive = currentStep === step.id
                const isCompleted = currentStep > step.id
                
                return (
                  <div key={step.id} className="flex items-center">
                    {index > 0 && (
                      <div className={`w-8 h-px mx-1 ${isCompleted ? 'bg-[#08CF65]' : 'bg-gray-200'}`} />
                    )}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                          isCompleted 
                            ? 'bg-[#08CF65] text-white' 
                            : isActive 
                              ? 'bg-[#08CF65] text-white ring-4 ring-[#08CF65]/20' 
                              : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {isCompleted ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          step.id
                        )}
                      </div>
                      <span className={`text-xs mt-1 ${isActive || isCompleted ? 'text-gray-700' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Spacer */}
            <div className="w-9" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <StepUpload onUpload={handleDocumentUpload} isLoading={isLoading} />
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <StepSigners
                signers={signers}
                onAddSigner={addSigner}
                onRemoveSigner={removeSigner}
                onUpdateSigner={updateSigner}
                onSelfSign={handleSelfSign}
                onBack={() => setCurrentStep(1)}
                onNext={async () => {
                  const saved = await saveSigners()
                  if (saved) setCurrentStep(3)
                }}
                isLoading={isLoading}
              />
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <StepFields
                documentData={document}
                signers={signers}
                fields={fields}
                onAddField={addField}
                onRemoveField={removeField}
                onUpdateField={updateField}
                onBack={() => setCurrentStep(2)}
                onNext={async () => {
                  const saved = await saveFields()
                  if (saved) {
                    // Check if auto-sign (single signer = current user)
                    const isAutoSign = signers.length === 1
                    if (isAutoSign) {
                      // Auto-sign: send directly and redirect to signing page
                      await sendDocument()
                    } else {
                      // Multiple signers: go to review step
                      setCurrentStep(4)
                    }
                  }
                }}
                isLoading={isLoading}
              />
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <StepReview
                document={document}
                signers={signers}
                fields={fields}
                onBack={() => setCurrentStep(3)}
                onSend={sendDocument}
                isLoading={isLoading}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-3 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 mt-3 text-sm">Chargement...</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SendPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SendPageContent />
    </Suspense>
  )
}
