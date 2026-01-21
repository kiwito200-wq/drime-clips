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
  { id: 1, name: 'Sélectionner des documents', icon: 'document' },
  { id: 2, name: 'Ajouter des signataires', icon: 'users' },
  { id: 3, name: 'Positionner les champs', icon: 'fields' },
  { id: 4, name: 'Vérifier et envoyer', icon: 'check' },
]

const SIGNER_COLORS = [
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
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
  const [isSelfSign, setIsSelfSign] = useState(false)

  // Vérifier si on a un slug existant (document déjà uploadé)
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
        // Charger les signataires existants
        if (envelope.signers && envelope.signers.length > 0) {
          setSigners(envelope.signers.map((s: any) => ({
            id: s.id,
            name: s.name || '',
            email: s.email,
            color: s.color,
          })))
        }
        // Charger les champs existants
        if (envelope.fields && envelope.fields.length > 0) {
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
        setCurrentStep(2) // Passer à l'étape signataires
      }
    } catch (error) {
      console.error('Failed to load envelope:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Upload du document
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
        alert('Échec de l\'upload. Veuillez réessayer.')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Échec de l\'upload. Veuillez réessayer.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Self-sign (je suis le seul signataire)
  const handleSelfSign = useCallback(async () => {
    setIsSelfSign(true)
    // Récupérer l'email de l'utilisateur connecté
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        if (data.user) {
          const selfSigner: Signer = {
            id: 'self-' + Date.now(),
            name: data.user.name || 'Moi',
            email: data.user.email,
            color: SIGNER_COLORS[0],
          }
          setSigners([selfSigner])
          setCurrentStep(3)
        }
      }
    } catch {
      // Fallback: utiliser un placeholder
      const selfSigner: Signer = {
        id: 'self-' + Date.now(),
        name: 'Moi',
        email: 'dev@drime.cloud',
        color: SIGNER_COLORS[0],
      }
      setSigners([selfSigner])
      setCurrentStep(3)
    }
  }, [])

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

  // Supprimer un signataire
  const removeSigner = useCallback((id: string) => {
    setSigners(prev => prev.filter(s => s.id !== id))
    // Supprimer aussi les champs associés
    setFields(prev => prev.filter(f => f.signerId !== id))
  }, [])

  // Mettre à jour un signataire
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
        // Mettre à jour les IDs des signataires avec ceux du serveur
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

  // Ajouter un champ
  const addField = useCallback((field: Omit<SignField, 'id'>) => {
    const newField: SignField = {
      ...field,
      id: 'field-' + Date.now(),
    }
    setFields(prev => [...prev, newField])
  }, [])

  // Supprimer un champ
  const removeField = useCallback((id: string) => {
    setFields(prev => prev.filter(f => f.id !== id))
  }, [])

  // Mettre à jour un champ
  const updateField = useCallback((id: string, updates: Partial<SignField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }, [])

  // Sauvegarder les champs
  const saveFields = useCallback(async () => {
    if (!document.slug) return false
    
    setIsLoading(true)
    try {
      const res = await fetch(`/api/envelopes/${document.slug}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
        credentials: 'include',
      })
      
      return res.ok
    } catch (error) {
      console.error('Failed to save fields:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [document.slug, fields])

  // Envoyer le document
  const sendDocument = useCallback(async () => {
    if (!document.slug) return
    
    setIsLoading(true)
    try {
      // Sauvegarder les champs d'abord
      await saveFields()
      
      // Envoyer pour signature
      const res = await fetch(`/api/envelopes/${document.slug}/send`, {
        method: 'POST',
        credentials: 'include',
      })
      
      if (res.ok) {
        router.push(`/dashboard?sent=${document.slug}`)
      } else {
        alert('Échec de l\'envoi. Veuillez réessayer.')
      }
    } catch (error) {
      console.error('Send error:', error)
      alert('Échec de l\'envoi. Veuillez réessayer.')
    } finally {
      setIsLoading(false)
    }
  }, [document.slug, saveFields, router])

  // Navigation entre étapes
  const goToStep = async (step: number) => {
    // Sauvegarder avant de changer d'étape
    if (currentStep === 2 && step > 2 && signers.length > 0) {
      const saved = await saveSigners()
      if (!saved) {
        alert('Erreur lors de la sauvegarde des signataires')
        return
      }
    }
    if (currentStep === 3 && step > 3) {
      const saved = await saveFields()
      if (!saved) {
        alert('Erreur lors de la sauvegarde des champs')
        return
      }
    }
    setCurrentStep(step)
  }

  const canGoNext = () => {
    switch (currentStep) {
      case 1: return document.pdfUrl !== null
      case 2: return signers.length > 0 && signers.every(s => s.email.includes('@'))
      case 3: return fields.length > 0
      case 4: return true
      default: return false
    }
  }

  // Render step icon
  const renderStepIcon = (icon: string, isActive: boolean, isCompleted: boolean) => {
    const color = isCompleted ? 'text-white' : isActive ? 'text-[#08CF65]' : 'text-gray-400'
    
    switch (icon) {
      case 'document':
        return (
          <svg className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      case 'users':
        return (
          <svg className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        )
      case 'fields':
        return (
          <svg className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
        )
      case 'check':
        return (
          <svg className={`w-5 h-5 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header with steps */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Close button */}
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="font-medium">Envoyer pour signature</span>
            </button>

            {/* Steps indicator */}
            <div className="flex items-center gap-2">
              {STEPS.map((step, index) => {
                const isActive = currentStep === step.id
                const isCompleted = currentStep > step.id
                const isClickable = step.id < currentStep || (step.id === currentStep + 1 && canGoNext())
                
                return (
                  <div key={step.id} className="flex items-center">
                    {index > 0 && (
                      <div className={`w-12 h-0.5 mx-1 ${isCompleted ? 'bg-[#08CF65]' : 'bg-gray-200'}`} />
                    )}
                    <button
                      onClick={() => isClickable && goToStep(step.id)}
                      disabled={!isClickable}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                        isActive 
                          ? 'bg-green-50 border border-[#08CF65]' 
                          : isCompleted 
                            ? 'bg-[#08CF65] text-white' 
                            : 'text-gray-400'
                      } ${isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                        isCompleted ? 'bg-white/20' : isActive ? 'bg-[#08CF65]/10' : 'bg-gray-100'
                      }`}>
                        {renderStepIcon(step.icon, isActive, isCompleted)}
                      </div>
                      <span className={`text-sm font-medium hidden lg:block ${
                        isActive ? 'text-[#08CF65]' : isCompleted ? 'text-white' : 'text-gray-400'
                      }`}>
                        {step.name}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Help button */}
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full"
            >
              <StepUpload
                onUpload={handleDocumentUpload}
                isLoading={isLoading}
              />
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full"
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full"
            >
              <StepFields
                document={document}
                signers={signers}
                fields={fields}
                onAddField={addField}
                onRemoveField={removeField}
                onUpdateField={updateField}
                onBack={() => setCurrentStep(2)}
                onNext={async () => {
                  const saved = await saveFields()
                  if (saved) setCurrentStep(4)
                }}
                isLoading={isLoading}
              />
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full"
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
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 shadow-xl">
            <div className="w-10 h-10 border-4 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-600 mt-4">Chargement...</p>
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
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Chargement...</p>
        </div>
      </div>
    }>
      <SendPageContent />
    </Suspense>
  )
}
