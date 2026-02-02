'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/lib/i18n/I18nContext'

// Country codes with flags and example phone formats
const COUNTRIES = [
  { code: 'FR', dial: '+33', name: 'France', flag: '🇫🇷', placeholder: '6 12 34 56 78' },
  { code: 'BE', dial: '+32', name: 'Belgique', flag: '🇧🇪', placeholder: '470 12 34 56' },
  { code: 'CH', dial: '+41', name: 'Suisse', flag: '🇨🇭', placeholder: '79 123 45 67' },
  { code: 'CA', dial: '+1', name: 'Canada', flag: '🇨🇦', placeholder: '514 123 4567' },
  { code: 'US', dial: '+1', name: 'États-Unis', flag: '🇺🇸', placeholder: '202 555 0123' },
  { code: 'GB', dial: '+44', name: 'Royaume-Uni', flag: '🇬🇧', placeholder: '7911 123456' },
  { code: 'DE', dial: '+49', name: 'Allemagne', flag: '🇩🇪', placeholder: '151 12345678' },
  { code: 'ES', dial: '+34', name: 'Espagne', flag: '🇪🇸', placeholder: '612 34 56 78' },
  { code: 'IT', dial: '+39', name: 'Italie', flag: '🇮🇹', placeholder: '312 345 6789' },
  { code: 'PT', dial: '+351', name: 'Portugal', flag: '🇵🇹', placeholder: '912 345 678' },
  { code: 'NL', dial: '+31', name: 'Pays-Bas', flag: '🇳🇱', placeholder: '6 12345678' },
  { code: 'LU', dial: '+352', name: 'Luxembourg', flag: '🇱🇺', placeholder: '621 123 456' },
  { code: 'MC', dial: '+377', name: 'Monaco', flag: '🇲🇨', placeholder: '6 12 34 56 78' },
  { code: 'MA', dial: '+212', name: 'Maroc', flag: '🇲🇦', placeholder: '612 345678' },
  { code: 'TN', dial: '+216', name: 'Tunisie', flag: '🇹🇳', placeholder: '20 123 456' },
  { code: 'DZ', dial: '+213', name: 'Algérie', flag: '🇩🇿', placeholder: '551 23 45 67' },
  { code: 'SN', dial: '+221', name: 'Sénégal', flag: '🇸🇳', placeholder: '70 123 45 67' },
  { code: 'CI', dial: '+225', name: 'Côte d\'Ivoire', flag: '🇨🇮', placeholder: '01 23 45 67 89' },
  { code: 'CM', dial: '+237', name: 'Cameroun', flag: '🇨🇲', placeholder: '6 71 23 45 67' },
  { code: 'MG', dial: '+261', name: 'Madagascar', flag: '🇲🇬', placeholder: '32 12 345 67' },
  { code: 'RE', dial: '+262', name: 'La Réunion', flag: '🇷🇪', placeholder: '692 12 34 56' },
  { code: 'MQ', dial: '+596', name: 'Martinique', flag: '🇲🇶', placeholder: '696 12 34 56' },
  { code: 'GP', dial: '+590', name: 'Guadeloupe', flag: '🇬🇵', placeholder: '690 12 34 56' },
  { code: 'GF', dial: '+594', name: 'Guyane', flag: '🇬🇫', placeholder: '694 12 34 56' },
  { code: 'PF', dial: '+689', name: 'Polynésie française', flag: '🇵🇫', placeholder: '87 12 34 56' },
  { code: 'NC', dial: '+687', name: 'Nouvelle-Calédonie', flag: '🇳🇨', placeholder: '75 12 34' },
  { code: 'AT', dial: '+43', name: 'Autriche', flag: '🇦🇹', placeholder: '664 1234567' },
  { code: 'PL', dial: '+48', name: 'Pologne', flag: '🇵🇱', placeholder: '512 345 678' },
  { code: 'RO', dial: '+40', name: 'Roumanie', flag: '🇷🇴', placeholder: '712 345 678' },
  { code: 'GR', dial: '+30', name: 'Grèce', flag: '🇬🇷', placeholder: '691 234 5678' },
  { code: 'IE', dial: '+353', name: 'Irlande', flag: '🇮🇪', placeholder: '85 123 4567' },
  { code: 'SE', dial: '+46', name: 'Suède', flag: '🇸🇪', placeholder: '70 123 45 67' },
  { code: 'NO', dial: '+47', name: 'Norvège', flag: '🇳🇴', placeholder: '406 12 345' },
  { code: 'DK', dial: '+45', name: 'Danemark', flag: '🇩🇰', placeholder: '20 12 34 56' },
  { code: 'FI', dial: '+358', name: 'Finlande', flag: '🇫🇮', placeholder: '41 2345678' },
  { code: 'JP', dial: '+81', name: 'Japon', flag: '🇯🇵', placeholder: '90 1234 5678' },
  { code: 'CN', dial: '+86', name: 'Chine', flag: '🇨🇳', placeholder: '131 2345 6789' },
  { code: 'KR', dial: '+82', name: 'Corée du Sud', flag: '🇰🇷', placeholder: '10 1234 5678' },
  { code: 'IN', dial: '+91', name: 'Inde', flag: '🇮🇳', placeholder: '81234 56789' },
  { code: 'AU', dial: '+61', name: 'Australie', flag: '🇦🇺', placeholder: '412 345 678' },
  { code: 'NZ', dial: '+64', name: 'Nouvelle-Zélande', flag: '🇳🇿', placeholder: '21 123 4567' },
  { code: 'BR', dial: '+55', name: 'Brésil', flag: '🇧🇷', placeholder: '11 91234 5678' },
  { code: 'MX', dial: '+52', name: 'Mexique', flag: '🇲🇽', placeholder: '1 234 567 8901' },
  { code: 'AR', dial: '+54', name: 'Argentine', flag: '🇦🇷', placeholder: '9 11 1234 5678' },
]

// Get placeholder for a dial code
const getPhonePlaceholder = (dial: string): string => {
  const country = COUNTRIES.find(c => c.dial === dial)
  return country?.placeholder || '123 456 789'
}

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
  const { t } = useTranslation()
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
        <h1 className="text-2xl font-semibold text-gray-900">{t('signers.title')}</h1>
        <p className="text-gray-500 mt-2">{t('signers.subtitle')}</p>
      </div>

      {/* Self-sign button */}
      <button
        onClick={onSelfSign}
        disabled={isLoading}
        className="w-full mb-6 py-3 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-700 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {t('signers.iAmOnlySigner')}
      </button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-gray-50 px-3 text-sm text-gray-400">{t('signers.orAddSigners')}</span>
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
                  placeholder={t('signers.name')}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none"
                />
                <input
                  type="email"
                  value={signer.email}
                  onChange={(e) => onUpdateSigner(signer.id, { email: e.target.value })}
                  placeholder={t('signers.email')}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none"
                />
              </div>
              
              {/* 2FA Option */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path fillRule="evenodd" clipRule="evenodd" d="M13.6445 16.1466C13.6445 17.0548 12.9085 17.7912 11.9995 17.7912C11.0915 17.7912 10.3555 17.0548 10.3555 16.1466C10.3555 15.2385 11.0915 14.502 11.9995 14.502C12.9085 14.502 13.6445 15.2385 13.6445 16.1466Z" />
                      <path d="M16.4497 10.4139V8.31757C16.4197 5.86047 14.4027 3.89397 11.9457 3.92417C9.53974 3.95447 7.59273 5.89267 7.55273 8.29807V10.4139" />
                      <path d="M9.30374 21.9406H14.6957C16.2907 21.9406 17.0887 21.9406 17.7047 21.645C18.3187 21.3498 18.8147 20.854 19.1097 20.2392C19.4057 19.6236 19.4057 18.8259 19.4057 17.2306V15.0987C19.4057 13.5034 19.4057 12.7058 19.1097 12.0901C18.8147 11.4754 18.3187 10.9796 17.7047 10.6844C17.0887 10.3887 16.2907 10.3887 14.6957 10.3887H9.30374C7.70874 10.3887 6.91074 10.3887 6.29474 10.6844C5.68074 10.9796 5.18474 11.4754 4.88974 12.0901C4.59374 12.7058 4.59375 13.5034 4.59375 15.0987V17.2306C4.59375 18.8259 4.59374 19.6236 4.88974 20.2392C5.18474 20.854 5.68074 21.3498 6.29474 21.645C6.91074 21.9406 7.70874 21.9406 9.30374 21.9406Z" />
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
                        placeholder={getPhonePlaceholder(signer.phoneCountry || '+33')}
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
              placeholder={t('signers.name')}
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
              placeholder={t('signers.email')}
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
          {t('signers.add')}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <button
          onClick={onBack}
          className="px-5 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          {t('signers.back')}
        </button>
        <button
          onClick={onNext}
          disabled={!canContinue || isLoading}
          className="px-6 py-2.5 bg-[#08CF65] text-white font-medium rounded-xl hover:bg-[#07b858] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {t('signers.continue')}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
