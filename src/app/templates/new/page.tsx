'use client'

import { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import StepRoles from '@/components/templates/StepRoles'
import StepFields from '@/components/send/StepFields'
import { useTranslation } from '@/lib/i18n/I18nContext'

// Types
export interface TemplateField {
  id: string
  type: 'signature' | 'initials' | 'date' | 'text' | 'checkbox' | 'name' | 'email'
  role: string // Role ID
  page: number
  x: number
  y: number
  width: number
  height: number
  required: boolean
  label: string
}

export interface Role {
  id: string
  name: string
  color: string
}

export interface DocumentData {
  file: File | null
  name: string
  pdfUrl: string | null
  envelopeId: string | null
  slug: string | null
  thumbnailUrl?: string | null
}

const ROLE_COLORS = [
  '#7E33F7', // Purple
  '#FFAD12', // Orange
  '#ED3757', // Red/Pink
  '#08CF65', // Green
  '#4F46E5', // Blue/Indigo
  '#00B7FF', // Cyan
]

function NewTemplatePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { locale } = useTranslation()
  
  const [currentStep, setCurrentStep] = useState(1) // 1 = Roles, 2 = Fields, 3 = Review
  const [document, setDocument] = useState<DocumentData>({
    file: null,
    name: '',
    pdfUrl: null,
    envelopeId: null,
    slug: null,
  })
  const [roles, setRoles] = useState<Role[]>([])
  const [fields, setFields] = useState<TemplateField[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState('')

  // Load envelope from slug
  useEffect(() => {
    const slug = searchParams.get('slug')
    if (slug) {
      loadEnvelope(slug)
    }
  }, [searchParams])

  const loadEnvelope = async (slug: string) => {
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
          thumbnailUrl: envelope.thumbnailUrl,
        })
        setCurrentStep(1)
      }
    } catch (error) {
      console.error('Failed to load envelope:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Update document name
  const updateDocumentName = useCallback(async (newName: string) => {
    if (!document.slug || !newName.trim()) return false
    
    setIsLoading(true)
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
      return false
    } catch (error) {
      console.error('Failed to update name:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [document.slug])

  // Roles management
  const addRole = useCallback((name: string) => {
    const newRole: Role = {
      id: `role-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      color: ROLE_COLORS[roles.length % ROLE_COLORS.length],
    }
    setRoles(prev => [...prev, newRole])
    if (!selectedRoleId) {
      setSelectedRoleId(newRole.id)
    }
  }, [roles.length, selectedRoleId])

  const removeRole = useCallback((id: string) => {
    setRoles(prev => prev.filter(r => r.id !== id))
    setFields(prev => prev.filter(f => f.role !== id))
    if (selectedRoleId === id) {
      const remaining = roles.filter(r => r.id !== id)
      setSelectedRoleId(remaining[0]?.id || '')
    }
  }, [roles, selectedRoleId])

  const updateRole = useCallback((id: string, name: string) => {
    setRoles(prev => prev.map(r => r.id === id ? { ...r, name: name.trim() } : r))
  }, [])

  // Fields management
  const addField = useCallback((field: Omit<TemplateField, 'id'>) => {
    setFields(prev => [...prev, { ...field, id: 'field-' + Date.now() }])
  }, [])

  const removeField = useCallback((id: string) => {
    setFields(prev => prev.filter(f => f.id !== id))
  }, [])

  const updateField = useCallback((id: string, updates: Partial<TemplateField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }, [])

  // Save template
  const saveTemplate = useCallback(async (name: string, description?: string) => {
    if (!document.envelopeId || !name.trim()) return false
    
    setIsLoading(true)
    try {
      // First, save fields to the envelope (convert template fields to envelope fields)
      // We need to create temporary signers for each role (all at once)
      const roleToSignerMap: Record<string, string> = {}
      
      // Create all signers for all roles in one call
      const templateSigners = roles.map(role => ({
        name: role.name,
        email: `${role.id}@template.local`, // Template email pattern
        color: role.color,
      }))
      
      const signersRes = await fetch(`/api/envelopes/${document.slug}/signers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signers: templateSigners }),
        credentials: 'include',
      })
      
      if (signersRes.ok) {
        const signersData = await signersRes.json()
        if (signersData.signers) {
          // Map role IDs to signer IDs (by matching email pattern)
          signersData.signers.forEach((signer: any) => {
            const roleId = signer.email.split('@')[0]
            if (roleId) {
              roleToSignerMap[roleId] = signer.id
            }
          })
        }
      }

      // Convert template fields to envelope fields
      const envelopeFields = fields.map(field => ({
        type: field.type,
        signerId: roleToSignerMap[field.role] || roleToSignerMap[roles[0].id],
        page: field.page,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        required: field.required,
        label: field.label || '',
      }))

      // Save fields
      await fetch(`/api/envelopes/${document.slug}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: envelopeFields }),
        credentials: 'include',
      })

      // Now create the template with roles
      const templateRes = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          envelopeId: document.envelopeId,
          name: name.trim(),
          description: description?.trim() || undefined,
          roles: roles.map(r => ({
            id: r.id,
            name: r.name,
            color: r.color,
          })),
        }),
      })

      if (templateRes.ok) {
        const data = await templateRes.json()
        router.push(`/templates/${data.template.id}/done`)
        return true
      } else {
        const error = await templateRes.json()
        alert(error.error || (locale === 'fr' ? 'Erreur lors de la sauvegarde du template' : 'Failed to save template'))
        return false
      }
    } catch (error) {
      console.error('Failed to save template:', error)
      alert(locale === 'fr' ? 'Erreur lors de la sauvegarde du template' : 'Failed to save template')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [document.envelopeId, document.slug, fields, roles, router])

  // Convert template fields to StepFields format (for compatibility)
  // Map each field's role to the corresponding signer ID
  const fieldsForStepFields = fields.map(f => {
    const role = roles.find(r => r.id === f.role)
    const roleSignerId = role?.id || roles[0]?.id || ''
    return {
      id: f.id,
      type: f.type,
      signerId: roleSignerId, // Map role to signerId for display
      page: f.page,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      required: f.required,
      label: f.label,
    }
  })

  // Convert roles to signers format (for compatibility with StepFields)
  const signersForStepFields = roles.map(r => ({
    id: r.id,
    name: r.name,
    email: `${r.id}@template.local`,
    color: r.color,
  }))

  if (isLoading && !document.slug) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="px-4 py-3 relative">
          <button
            onClick={() => router.push('/templates')}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Steps */}
          <div className="flex items-center justify-center gap-1">
            <div className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  currentStep >= 1 
                    ? 'bg-[#08CF65] text-white' 
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {currentStep > 1 ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    '1'
                  )}
                </div>
                <span className={`text-xs mt-1 ${currentStep >= 1 ? 'text-gray-700' : 'text-gray-400'}`}>
                  {locale === 'fr' ? 'Rôles' : 'Roles'}
                </span>
              </div>
            </div>
            <div className={`w-8 h-px mx-1 ${currentStep >= 2 ? 'bg-[#08CF65]' : 'bg-gray-200'}`} />
            <div className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  currentStep >= 2 
                    ? 'bg-[#08CF65] text-white' 
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {currentStep > 2 ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    '2'
                  )}
                </div>
                <span className={`text-xs mt-1 ${currentStep >= 2 ? 'text-gray-700' : 'text-gray-400'}`}>
                  {locale === 'fr' ? 'Champs' : 'Fields'}
                </span>
              </div>
            </div>
            <div className={`w-8 h-px mx-1 ${currentStep >= 3 ? 'bg-[#08CF65]' : 'bg-gray-200'}`} />
            <div className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  currentStep >= 3 
                    ? 'bg-[#08CF65] text-white' 
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  3
                </div>
                <span className={`text-xs mt-1 ${currentStep >= 3 ? 'text-gray-700' : 'text-gray-400'}`}>
                  {locale === 'fr' ? 'Terminé' : 'Done'}
                </span>
              </div>
            </div>
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
              <StepRoles
                roles={roles}
                onAddRole={addRole}
                onRemoveRole={removeRole}
                onUpdateRole={updateRole}
                onBack={() => router.push('/templates')}
                onNext={() => {
                  if (roles.length > 0) {
                    setSelectedRoleId(roles[0].id)
                    setCurrentStep(2)
                  }
                }}
                isLoading={isLoading}
              />
            </motion.div>
          )}

          {currentStep === 2 && document.slug && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <StepFields
                documentData={document}
                signers={signersForStepFields}
                fields={fieldsForStepFields}
                onAddField={(field) => {
                  // Map signerId back to role
                  const roleId = field.signerId || selectedRoleId
                  addField({
                    type: field.type,
                    role: roleId,
                    page: field.page,
                    x: field.x,
                    y: field.y,
                    width: field.width,
                    height: field.height,
                    required: field.required,
                    label: field.label || '',
                  })
                }}
                onRemoveField={removeField}
                onUpdateField={(id, updates) => {
                  // If signerId is updated, map it to role
                  const field = fields.find(f => f.id === id)
                  if (field && updates.signerId) {
                    updateField(id, { ...updates, role: updates.signerId } as Partial<TemplateField>)
                  } else {
                    updateField(id, updates as Partial<TemplateField>)
                  }
                }}
                onUpdateDocumentName={updateDocumentName}
                onBack={() => setCurrentStep(1)}
                onNext={() => setCurrentStep(3)}
                isLoading={isLoading}
                isTemplateMode={true}
              />
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <TemplateReviewStep
                document={document}
                fields={fields}
                roles={roles}
                onBack={() => setCurrentStep(2)}
                onSave={saveTemplate}
                isLoading={isLoading}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

// Template Review Step Component
interface TemplateReviewStepProps {
  document: DocumentData
  fields: TemplateField[]
  roles: Role[]
  onBack: () => void
  onSave: (name: string, description?: string) => Promise<boolean>
  isLoading: boolean
}

function TemplateReviewStep({
  document,
  fields,
  roles,
  onBack,
  onSave,
  isLoading,
}: TemplateReviewStepProps) {
  const { locale } = useTranslation()
  const [templateName, setTemplateName] = useState(document.name || '')
  const [templateDescription, setTemplateDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!templateName.trim()) {
      alert(locale === 'fr' ? 'Veuillez entrer un nom pour le template' : 'Please enter a template name')
      return
    }

    setIsSaving(true)
    try {
      await onSave(templateName.trim(), templateDescription.trim() || undefined)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-200 p-6 mb-6"
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {locale === 'fr' ? 'Sauvegarder comme template' : 'Save as template'}
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {locale === 'fr' ? 'Nom du template *' : 'Template name *'}
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={locale === 'fr' ? 'Ex: Contrat de travail' : 'E.g.: Employment contract'}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#08CF65]/20 focus:border-[#08CF65] outline-none"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {locale === 'fr' ? 'Description (optionnel)' : 'Description (optional)'}
            </label>
            <textarea
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder={locale === 'fr' ? 'Décrivez ce template...' : 'Describe this template...'}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#08CF65]/20 focus:border-[#08CF65] outline-none resize-none"
            />
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-2">
              <strong>{fields.length}</strong> champ{fields.length !== 1 ? 's' : ''} configuré{fields.length !== 1 ? 's' : ''}
            </p>
            <p className="text-sm text-gray-600">
              <strong>{roles.length}</strong> rôle{roles.length !== 1 ? 's' : ''} défini{roles.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onBack}
          className="px-8 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors min-w-[140px]"
        >
          {locale === 'fr' ? 'Retour' : 'Back'}
        </button>
        <button
          onClick={handleSave}
          disabled={isLoading || isSaving || !templateName.trim()}
          className="px-8 py-3 bg-[#08CF65] text-white rounded-xl font-medium hover:bg-[#07b858] transition-colors min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSaving || isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {locale === 'fr' ? 'Sauvegarde...' : 'Saving...'}
            </>
          ) : (
            <>
              {locale === 'fr' ? 'Sauvegarder le template' : 'Save template'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default function NewTemplatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <NewTemplatePageContent />
    </Suspense>
  )
}
