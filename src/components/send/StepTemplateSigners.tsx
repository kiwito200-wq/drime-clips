'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/lib/i18n/I18nContext'

interface Role {
  id: string
  name: string
  color: string
}

interface Signer {
  id: string
  name: string
  email: string
  color: string
  roleId: string
}

interface TemplateField {
  roleId: string
  type: string
}

interface StepTemplateSignersProps {
  roles: Role[]
  signers: Signer[]
  templateFields?: TemplateField[] // Fields from template to count per role
  onUpdateSigner: (roleId: string, name: string, email: string) => void
  onBack: () => void
  onNext: () => void
  isLoading: boolean
}

export default function StepTemplateSigners({
  roles,
  signers,
  templateFields = [],
  onUpdateSigner,
  onBack,
  onNext,
  isLoading,
}: StepTemplateSignersProps) {
  const { locale } = useTranslation()
  const [errors, setErrors] = useState<Record<string, { name?: string; email?: string }>>({})

  const validateAndNext = () => {
    const newErrors: Record<string, { name?: string; email?: string }> = {}
    let hasErrors = false

    roles.forEach(role => {
      const signer = signers.find(s => s.roleId === role.id)
      if (!signer || !signer.name?.trim()) {
        newErrors[role.id] = { ...newErrors[role.id], name: locale === 'fr' ? 'Ce champ est requis' : 'This field is required' }
        hasErrors = true
      }
      if (!signer || !signer.email?.trim()) {
        newErrors[role.id] = { ...newErrors[role.id], email: locale === 'fr' ? 'Ce champ est requis' : 'This field is required' }
        hasErrors = true
      } else if (signer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signer.email)) {
        newErrors[role.id] = { ...newErrors[role.id], email: locale === 'fr' ? 'Email invalide' : 'Invalid email' }
        hasErrors = true
      }
    })

    setErrors(newErrors)
    if (!hasErrors) {
      onNext()
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || name.slice(0, 2).toUpperCase()
  }

  // Show loading state if no roles yet
  if (roles.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-10 px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">{locale === 'fr' ? 'Qui doit signer ce document ?' : 'Who needs to sign this document?'}</h1>
          <p className="text-gray-500 mt-2">{locale === 'fr' ? 'Chargement des rôles du template...' : 'Loading template roles...'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-[#08CF65] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{locale === 'fr' ? 'Qui doit signer ce document ?' : 'Who needs to sign this document?'}</h1>
        <p className="text-gray-500 mt-2">Pour chaque rôle, indiquez le nom et l&apos;email de la personne qui signera</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-200 p-6 mb-6"
      >

        <div className="space-y-3">
          {roles.map((role, index) => {
            const signer = signers.find(s => s.roleId === role.id)
            const roleErrors = errors[role.id] || {}

            return (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 bg-white rounded-xl border border-gray-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                    style={{ backgroundColor: role.color }}
                  >
                    {getInitials(role.name)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{role.name}</p>
                    <p className="text-xs text-gray-500">
                      {(() => {
                        const fieldCount = templateFields.filter(f => f.roleId === role.id).length
                        return fieldCount > 0 
                          ? `${fieldCount} champ${fieldCount > 1 ? 's' : ''} attribué${fieldCount > 1 ? 's' : ''} à ce rôle`
                          : 'Rôle de signataire'
                      })()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Nom *
                    </label>
                    <input
                      type="text"
                      value={signer?.name || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        onUpdateSigner(role.id, value, signer?.email || '')
                        if (roleErrors.name) {
                          setErrors(prev => ({
                            ...prev,
                            [role.id]: { ...prev[role.id], name: undefined },
                          }))
                        }
                      }}
                      placeholder="Nom"
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none ${
                        roleErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                    />
                    {roleErrors.name && (
                      <p className="text-xs text-red-600 mt-1">{roleErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email *
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={signer?.email || ''}
                        onChange={(e) => {
                          const value = e.target.value
                          onUpdateSigner(role.id, signer?.name || '', value)
                          if (roleErrors.email) {
                            setErrors(prev => ({
                              ...prev,
                              [role.id]: { ...prev[role.id], email: undefined },
                            }))
                          }
                        }}
                        placeholder="email@exemple.com"
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none ${
                          roleErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-200'
                        }`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    </div>
                    {roleErrors.email && (
                      <p className="text-xs text-red-600 mt-1">{roleErrors.email}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <button
          onClick={onBack}
          className="px-5 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          {locale === 'fr' ? 'Retour' : 'Back'}
        </button>
        <button
          onClick={validateAndNext}
          disabled={isLoading}
          className="px-6 py-2.5 bg-[#08CF65] text-white font-medium rounded-xl hover:bg-[#07b858] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {locale === 'fr' ? 'Chargement...' : 'Loading...'}
            </>
          ) : (
            <>
              {locale === 'fr' ? 'Continuer' : 'Continue'}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
