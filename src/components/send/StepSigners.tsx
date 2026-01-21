'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Signer {
  id: string
  name: string
  email: string
  color: string
}

interface StepSignersProps {
  signers: Signer[]
  onAddSigner: (name: string, email: string) => void
  onRemoveSigner: (id: string) => void
  onUpdateSigner: (id: string, updates: Partial<Signer>) => void
  onSelfSign: () => void
  onBack: () => void
  onNext: () => void
  isLoading: boolean
}

export default function StepSigners({
  signers,
  onAddSigner,
  onRemoveSigner,
  onUpdateSigner,
  onSelfSign,
  onBack,
  onNext,
  isLoading,
}: StepSignersProps) {
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleAddSigner = () => {
    const newErrors: { name?: string; email?: string } = {}
    
    if (!newName.trim()) {
      newErrors.name = 'Un nom de signataire est requis.'
    }
    if (!newEmail.trim()) {
      newErrors.email = 'Un email est requis.'
    } else if (!validateEmail(newEmail)) {
      newErrors.email = 'Email invalide.'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    onAddSigner(newName.trim(), newEmail.trim())
    setNewName('')
    setNewEmail('')
    setErrors({})
  }

  const canContinue = signers.length > 0 && signers.every(s => validateEmail(s.email))

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">
            Ajouter des signataires
          </h1>
          <button
            onClick={onSelfSign}
            className="flex items-center gap-2 text-gray-600 hover:text-[#08CF65] transition-colors text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Je suis le seul signataire
          </button>
        </div>
      </motion.div>

      {/* Liste des signataires */}
      <div className="space-y-4 mb-6">
        <AnimatePresence>
          {signers.map((signer, index) => (
            <motion.div
              key={signer.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: signer.color }}
                  />
                  <span className="font-medium text-gray-700">
                    Signataire {index + 1}
                  </span>
                </div>
                <button
                  onClick={() => onRemoveSigner(signer.id)}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nom</label>
                  <input
                    type="text"
                    value={signer.name}
                    onChange={(e) => onUpdateSigner(signer.id, { name: e.target.value })}
                    placeholder="Nom du Signataire"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Adresse e-mail</label>
                  <input
                    type="email"
                    value={signer.email}
                    onChange={(e) => onUpdateSigner(signer.id, { email: e.target.value })}
                    placeholder="e-mail@exemple.com"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Nouveau signataire */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-4"
        >
          <div className="flex items-start justify-between mb-3">
            <span className="font-medium text-gray-500">
              {signers.length === 0 ? 'Signataire' : 'Nouveau signataire'}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nom</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setErrors({}) }}
                placeholder="Nom du Signataire"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none transition-all ${
                  errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSigner()}
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.name}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Adresse e-mail</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); setErrors({}) }}
                placeholder="e-mail@exemple.com"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none transition-all ${
                  errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSigner()}
              />
              {errors.email && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.email}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Add signer button */}
        <button
          onClick={handleAddSigner}
          className="w-full py-3 border border-dashed border-gray-300 rounded-xl text-gray-500 hover:text-[#08CF65] hover:border-[#08CF65] transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Ajouter un signataire
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t">
        <button
          onClick={onBack}
          className="px-6 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          Retour
        </button>
        <button
          onClick={onNext}
          disabled={!canContinue || isLoading}
          className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sauvegarde...
            </>
          ) : (
            <>
              Suivant
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
