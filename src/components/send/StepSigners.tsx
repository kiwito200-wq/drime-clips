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

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handleAddSigner = () => {
    const newErrors: { name?: string; email?: string } = {}
    
    if (!newName.trim()) newErrors.name = 'Nom requis'
    if (!newEmail.trim()) newErrors.email = 'Email requis'
    else if (!validateEmail(newEmail)) newErrors.email = 'Email invalide'
    
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
    <div className="max-w-xl mx-auto py-10 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Qui doit signer ?</h1>
        <p className="text-gray-500 mt-2">Ajoutez les personnes qui doivent signer ce document</p>
      </div>

      {/* Self-sign button */}
      <button
        onClick={onSelfSign}
        disabled={isLoading}
        className="w-full mb-6 py-3 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-700 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        Je suis le seul signataire
      </button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-gray-50 px-3 text-sm text-gray-400">ou ajouter des signataires</span>
        </div>
      </div>

      {/* Signataires existants */}
      <div className="space-y-3 mb-4">
        <AnimatePresence>
          {signers.map((signer, index) => (
            <motion.div
              key={signer.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: signer.color }}
                >
                  {index + 1}
                </div>
                <span className="text-sm font-medium text-gray-500">Signataire {index + 1}</span>
                <button
                  onClick={() => onRemoveSigner(signer.id)}
                  className="ml-auto p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={signer.name}
                  onChange={(e) => onUpdateSigner(signer.id, { name: e.target.value })}
                  placeholder="Nom"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none"
                />
                <input
                  type="email"
                  value={signer.email}
                  onChange={(e) => onUpdateSigner(signer.id, { email: e.target.value })}
                  placeholder="email@exemple.com"
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none"
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Nouveau signataire */}
      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-4">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <input
              type="text"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setErrors({}) }}
              placeholder="Nom"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSigner()}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setErrors({}) }}
              placeholder="email@exemple.com"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none ${
                errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSigner()}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
        </div>
        <button
          onClick={handleAddSigner}
          className="w-full py-2 text-sm text-[#08CF65] hover:bg-green-50 rounded-lg transition-colors flex items-center justify-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ajouter
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <button
          onClick={onBack}
          className="px-5 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          Retour
        </button>
        <button
          onClick={onNext}
          disabled={!canContinue || isLoading}
          className="px-6 py-2.5 bg-[#08CF65] text-white font-medium rounded-xl hover:bg-[#07b858] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          Continuer
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
