'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import StepSigners from '@/components/send/StepSigners'
import StepFields from '@/components/send/StepFields'
import StepReview from '@/components/send/StepReview'
import { useTranslation } from '@/lib/i18n/I18nContext'

// Types
export interface Signer {
  id: string
  name: string
  email: string
  color: string
  phone2FA?: boolean
  phone2FANumber?: string
  phoneCountry?: string
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

// Step labels will be translated dynamically
const getSteps = (locale: string) => [
  { id: 1, label: locale === 'fr' ? 'Document' : 'Document' },
  { id: 2, label: locale === 'fr' ? 'Signataires' : 'Signers' },
  { id: 3, label: locale === 'fr' ? 'Champs' : 'Fields' },
  { id: 4, label: locale === 'fr' ? 'Envoyer' : 'Send' },
]

// Drime official accent colors
const SIGNER_COLORS = [
  '#7E33F7', // Purple
  '#FFAD12', // Orange
  '#ED3757', // Red/Pink
  '#08CF65', // Green
  '#4F46E5', // Blue/Indigo
  '#00B7FF', // Cyan
]

function SendPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { locale } = useTranslation()
  
  const STEPS = getSteps(locale)
  
  const [currentStep, setCurrentStep] = useState(2) // Start at signers step (Document handled by dashboard)
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
  const [isSelfSignMode, setIsSelfSignMode] = useState(false) // Track if user chose "Je suis le seul signataire"

  // Vérifier si on a un slug existant ou un template
  useEffect(() => {
    const slug = searchParams.get('slug')
    const templateId = searchParams.get('template')
    
    if (templateId) {
      loadTemplate(templateId)
    } else if (slug) {
      loadExistingEnvelope(slug)
    }
  }, [searchParams])

  const loadTemplate = async (templateId: string) => {
    try {
      setIsLoading(true)
      
      const res = await fetch(`/api/templates/${templateId}`, {
        credentials: 'include',
      })
      
      if (res.ok) {
        const data = await res.json()
        const template = data.template
        
        // Create a new envelope from template
        const createRes = await fetch('/api/envelopes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: template.name + ' (copie)',
            pdfUrl: template.pdfUrl,
            pdfHash: template.pdfHash,
            thumbnailUrl: template.thumbnailUrl,
          }),
        })
        
        if (createRes.ok) {
          const envelopeData = await createRes.json()
          const envelope = envelopeData.envelope
          
          setDocument({
            file: null,
            name: template.name + ' (copie)',
            pdfUrl: template.pdfUrl,
            envelopeId: envelope.id,
            slug: envelope.slug,
            thumbnailUrl: template.thumbnailUrl,
          })
          
          // Load signers from template
          const templateSubmitters = template.submitters || []
          let savedSigners: Signer[] = []
          
          if (templateSubmitters.length > 0) {
            const newSigners = templateSubmitters.map((s: any, index: number) => ({
              id: `signer-${Date.now()}-${index}`,
              name: s.name || s.email,
              email: s.email,
              color: s.color || SIGNER_COLORS[index % SIGNER_COLORS.length],
            }))
            
            // Save signers to envelope
            await fetch(`/api/envelopes/${envelope.slug}/signers`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                signers: newSigners.map((s: any) => ({
                  name: s.name,
                  email: s.email,
                  color: s.color,
                })),
              }),
              credentials: 'include',
            })
            
            // Update signers with real IDs from DB
            const signersRes = await fetch(`/api/envelopes/${envelope.slug}`, {
              credentials: 'include',
            })
            if (signersRes.ok) {
              const envelopeData = await signersRes.json()
              if (envelopeData.envelope.signers) {
                savedSigners = envelopeData.envelope.signers.map((s: any) => ({
                  id: s.id,
                  name: s.name || s.email,
                  email: s.email,
                  color: s.color,
                }))
                setSigners(savedSigners)
              }
            }
          }
          
          // Load fields from template
          const templateFields = template.fields || []
          if (templateFields.length > 0 && savedSigners.length > 0) {
            // Map template fields to saved signers by email
            const newFields = templateFields.map((f: any) => {
              // Find signer by email from template submitters
              const templateSubmitter = templateSubmitters.find((s: any) => s.email === f.email || s.id === f.signerId)
              const matchedSigner = savedSigners.find((s: any) => s.email === templateSubmitter?.email) || savedSigners[0]
              
              return {
                id: `field-${Date.now()}-${Math.random()}`,
                type: f.type,
                signerId: matchedSigner.id,
                page: f.page,
                x: f.x,
                y: f.y,
                width: f.width,
                height: f.height,
                required: f.required !== false,
                label: f.label || '',
              }
            })
            
            setFields(newFields)
            
            // Save fields to envelope
            await fetch(`/api/envelopes/${envelope.slug}/fields`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: newFields.map((f: any) => ({
                  type: f.type,
                  signerId: f.signerId,
                  page: f.page,
                  x: f.x,
                  y: f.y,
                  width: f.width,
                  height: f.height,
                  required: f.required,
                  label: f.label,
                })),
              }),
              credentials: 'include',
            })
          }
          
          // Go to appropriate step
          if (templateSubmitters.length > 0) {
            setCurrentStep(3) // Fields step
          } else {
            setCurrentStep(2) // Signers step
          }
          
          // Update URL to remove template param
          router.replace(`/send?slug=${envelope.slug}`)
        }
      } else {
        alert('Erreur lors du chargement du template')
      }
    } catch (error) {
      console.error('Failed to load template:', error)
      alert('Erreur lors du chargement du template')
    } finally {
      setIsLoading(false)
    }
  }

  const loadExistingEnvelope = async (slug: string) => {
    try {
      setIsLoading(true)
      
      // Always set the slug from URL params so we can save even if initial load fails
      setDocument(prev => ({ ...prev, slug }))
      
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
            phone2FA: s.phone2FA || false,
            phone2FANumber: s.phone2FANumber || '',
            phoneCountry: s.phoneCountryCode || '+33',
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
        // Determine which step to show based on progress
        if (envelope.signers?.length > 0) {
          // Has signers, go to fields step
          setCurrentStep(3)
        } else {
          // No signers yet, go to signers step
          setCurrentStep(2)
        }
      }
    } catch (error) {
      console.error('Failed to load envelope:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Self-sign - je suis le seul signataire
  const handleSelfSign = useCallback(async () => {
    setIsLoading(true)
    setIsSelfSignMode(true) // Mark that user explicitly chose self-sign
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

  // Update document name
  const updateDocumentName = useCallback(async (newName: string) => {
    if (!document.slug || !newName.trim()) return false
    
    try {
      const res = await fetch(`/api/envelopes/${document.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
        credentials: 'include',
      })
      
      if (res.ok) {
        setDocument(prev => ({ ...prev, name: newName.trim() }))
        return true
      }
    } catch (error) {
      console.error('Failed to update document name:', error)
    }
    return false
  }, [document.slug])

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
          // Create a map from old signer IDs to new signer IDs
          const oldToNewIdMap: Record<string, string> = {}
          signers.forEach((oldSigner, i) => {
            if (data.signers[i]) {
              oldToNewIdMap[oldSigner.id] = data.signers[i].id
            }
          })
          
          // Update signers with new IDs
          setSigners(data.signers.map((s: any, i: number) => ({
            ...signers[i],
            id: s.id,
          })))
          
          // Update fields to use new signer IDs
          setFields(prev => prev.map(field => ({
            ...field,
            signerId: oldToNewIdMap[field.signerId] || field.signerId
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

  const saveFieldsInBackground = useCallback(async () => {
    if (!document.slug || fields.length === 0) return false
    
    try {
      // Map temporary signer IDs to actual database IDs
      const fieldsWithCorrectSignerIds = fields.map(field => {
        const signer = signers.find(s => s.id === field.signerId)
        return {
          ...field,
          signerId: signer?.id || field.signerId,
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
      console.error('Failed to auto-save fields:', error)
      return false
    }
  }, [document.slug, fields, signers])

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

  // Auto-save fields when they change (debounced)
  useEffect(() => {
    if (currentStep !== 3 || !document.slug || fields.length === 0) return
    
    const timeoutId = setTimeout(() => {
      saveFieldsInBackground()
    }, 1500) // Save 1.5 seconds after last change
    
    return () => clearTimeout(timeoutId)
  }, [fields, currentStep, document.slug, saveFieldsInBackground])

  // Envoyer
  const sendDocument = useCallback(async (message?: string, settings?: { dueDate: string | null; reminderEnabled: boolean; reminderInterval: string }, forceAutoSign?: boolean) => {
    if (!document.slug) return
    
    setIsLoading(true)
    try {
      await saveFields()
      
      // Determine if this is auto-sign (ONLY if user explicitly chose self-sign mode)
      const isAutoSign = forceAutoSign || isSelfSignMode
      
      const res = await fetch(`/api/envelopes/${document.slug}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message, 
          isSelfSign: isAutoSign,
          dueDate: settings?.dueDate || null,
          reminderEnabled: settings?.reminderEnabled ?? true,
          reminderInterval: settings?.reminderInterval || '3_days',
        }),
        credentials: 'include',
      })
      
      if (res.ok) {
        const data = await res.json()
        
        // If self-sign, redirect directly to signing page (skip success screen)
        if (data.isSelfSign && data.selfSignUrl) {
          router.push(data.selfSignUrl)
        } else {
          // Otherwise show success page
          const successParams = new URLSearchParams()
          successParams.set('name', document.name)
          router.push(`/send/success?${successParams.toString()}`)
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
  }, [document.slug, saveFields, router, isSelfSignMode])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header compact style HelloSign */}
      <header className="bg-white border-b">
        <div className="px-4 py-3 relative">
          {/* Close - positioned on the left, aligned with document name below */}
          <button
            onClick={() => router.back()}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Steps - Centered in viewport */}
          <div className="flex items-center justify-center gap-1">
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
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
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
                onBack={() => router.push('/dashboard/agreements')}
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
                onRemoveSigner={removeSigner}
                onUpdateSigner={updateSigner}
                onUpdateDocumentName={updateDocumentName}
                onBack={() => setCurrentStep(2)}
                onNext={async () => {
                  const saved = await saveFields()
                  if (saved) {
                    // ONLY auto-sign if user explicitly chose "Je suis le seul signataire"
                    if (isSelfSignMode) {
                      // Auto-sign: send directly and redirect to signing page
                      await sendDocument(undefined, undefined, true)
                    } else {
                      // External signers: go to review step
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
