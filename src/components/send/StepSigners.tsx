'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Country codes with flags
const COUNTRIES = [
  { code: 'FR', dial: '+33', name: 'France', flag: '🇫🇷' },
  { code: 'BE', dial: '+32', name: 'Belgique', flag: '🇧🇪' },
  { code: 'CH', dial: '+41', name: 'Suisse', flag: '🇨🇭' },
  { code: 'CA', dial: '+1', name: 'Canada', flag: '🇨🇦' },
  { code: 'US', dial: '+1', name: 'États-Unis', flag: '🇺🇸' },
  { code: 'GB', dial: '+44', name: 'Royaume-Uni', flag: '🇬🇧' },
  { code: 'DE', dial: '+49', name: 'Allemagne', flag: '🇩🇪' },
  { code: 'ES', dial: '+34', name: 'Espagne', flag: '🇪🇸' },
  { code: 'IT', dial: '+39', name: 'Italie', flag: '🇮🇹' },
  { code: 'PT', dial: '+351', name: 'Portugal', flag: '🇵🇹' },
  { code: 'NL', dial: '+31', name: 'Pays-Bas', flag: '🇳🇱' },
  { code: 'LU', dial: '+352', name: 'Luxembourg', flag: '🇱🇺' },
  { code: 'MC', dial: '+377', name: 'Monaco', flag: '🇲🇨' },
  { code: 'MA', dial: '+212', name: 'Maroc', flag: '🇲🇦' },
  { code: 'TN', dial: '+216', name: 'Tunisie', flag: '🇹🇳' },
  { code: 'DZ', dial: '+213', name: 'Algérie', flag: '🇩🇿' },
  { code: 'SN', dial: '+221', name: 'Sénégal', flag: '🇸🇳' },
  { code: 'CI', dial: '+225', name: 'Côte d\'Ivoire', flag: '🇨🇮' },
  { code: 'CM', dial: '+237', name: 'Cameroun', flag: '🇨🇲' },
  { code: 'MG', dial: '+261', name: 'Madagascar', flag: '🇲🇬' },
  { code: 'RE', dial: '+262', name: 'La Réunion', flag: '🇷🇪' },
  { code: 'MQ', dial: '+596', name: 'Martinique', flag: '🇲🇶' },
  { code: 'GP', dial: '+590', name: 'Guadeloupe', flag: '🇬🇵' },
  { code: 'GF', dial: '+594', name: 'Guyane', flag: '🇬🇫' },
  { code: 'PF', dial: '+689', name: 'Polynésie française', flag: '🇵🇫' },
  { code: 'NC', dial: '+687', name: 'Nouvelle-Calédonie', flag: '🇳🇨' },
  { code: 'AT', dial: '+43', name: 'Autriche', flag: '🇦🇹' },
  { code: 'PL', dial: '+48', name: 'Pologne', flag: '🇵🇱' },
  { code: 'RO', dial: '+40', name: 'Roumanie', flag: '🇷🇴' },
  { code: 'GR', dial: '+30', name: 'Grèce', flag: '🇬🇷' },
  { code: 'IE', dial: '+353', name: 'Irlande', flag: '🇮🇪' },
  { code: 'SE', dial: '+46', name: 'Suède', flag: '🇸🇪' },
  { code: 'NO', dial: '+47', name: 'Norvège', flag: '🇳🇴' },
  { code: 'DK', dial: '+45', name: 'Danemark', flag: '🇩🇰' },
  { code: 'FI', dial: '+358', name: 'Finlande', flag: '🇫🇮' },
  { code: 'JP', dial: '+81', name: 'Japon', flag: '🇯🇵' },
  { code: 'CN', dial: '+86', name: 'Chine', flag: '🇨🇳' },
  { code: 'KR', dial: '+82', name: 'Corée du Sud', flag: '🇰🇷' },
  { code: 'IN', dial: '+91', name: 'Inde', flag: '🇮🇳' },
  { code: 'AU', dial: '+61', name: 'Australie', flag: '🇦🇺' },
  { code: 'NZ', dial: '+64', name: 'Nouvelle-Zélande', flag: '🇳🇿' },
  { code: 'BR', dial: '+55', name: 'Brésil', flag: '🇧🇷' },
  { code: 'MX', dial: '+52', name: 'Mexique', flag: '🇲🇽' },
  { code: 'AR', dial: '+54', name: 'Argentine', flag: '🇦🇷' },
]

interface Signer {
  id: string
  name: string
  email: string
  color: string
  phone2FA?: boolean
  phone2FANumber?: string
  phoneCountry?: string
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

// Country Code Dropdown Component
function CountryCodeDropdown({ 
  value, 
  onChange,
  signerId 
}: { 
  value: string
  onChange: (dial: string) => void
  signerId: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const selectedCountry = COUNTRIES.find(c => c.dial === value) || COUNTRIES[0]
  
  const filteredCountries = COUNTRIES.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  )
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors min-w-[90px]"
      >
        <span className="text-lg">{selectedCountry.flag}</span>
        <span className="text-gray-600">{selectedCountry.dial}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden"
          >
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un pays..."
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredCountries.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                  Aucun pays trouvé
                </div>
              ) : (
                filteredCountries.map((country) => (
                  <button
                    key={`${signerId}-${country.code}`}
                    type="button"
                    onClick={() => {
                      onChange(country.dial)
                      setIsOpen(false)
                      setSearch('')
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      country.dial === value ? 'bg-[#08CF65]/5 text-[#08CF65]' : 'text-gray-700'
                    }`}
                  >
                    <span className="text-lg">{country.flag}</span>
                    <span className="flex-1 text-left">{country.name}</span>
                    <span className="text-gray-400">{country.dial}</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
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

  const validatePhone = (phone?: string) => phone && phone.replace(/\D/g, '').length >= 6
  
  const canContinue = signers.length > 0 && signers.every(s => 
    validateEmail(s.email) && (!s.phone2FA || validatePhone(s.phone2FANumber))
  )
  
  // Format phone with country code for display/storage
  const getFullPhoneNumber = (signer: Signer) => {
    const country = signer.phoneCountry || '+33'
    const number = signer.phone2FANumber || ''
    return country + number
  }

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
              
              {/* 2FA Option */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-sm text-gray-600">Vérification SMS (2FA)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateSigner(signer.id, { phone2FA: !signer.phone2FA })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      signer.phone2FA ? 'bg-[#08CF65]' : 'bg-gray-200'
                    }`}
                  >
                    <span 
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        signer.phone2FA ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </label>
                
                {signer.phone2FA && (
                  <div className="mt-2">
                    <div className="flex gap-2">
                      <CountryCodeDropdown
                        value={signer.phoneCountry || '+33'}
                        onChange={(dial) => onUpdateSigner(signer.id, { phoneCountry: dial })}
                        signerId={signer.id}
                      />
                      <input
                        type="tel"
                        value={signer.phone2FANumber || ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '').slice(0, 15)
                          onUpdateSigner(signer.id, { phone2FANumber: raw })
                        }}
                        placeholder="6 12 34 56 78"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Le signataire devra vérifier son identité par SMS avant d&apos;accéder au document
                    </p>
                  </div>
                )}
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
