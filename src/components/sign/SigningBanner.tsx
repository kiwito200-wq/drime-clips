'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import SignaturePad from 'signature_pad'
import { Field, FieldType } from './types'

interface SigningBannerProps {
  fields: Field[]
  fieldValues: Record<string, string>
  currentFieldIndex: number
  onFieldChange: (index: number) => void
  onValueChange: (fieldId: string, value: string) => void
  onComplete: () => void
  isCompleting: boolean
  signerName?: string
  signerEmail?: string
}

const SIGNATURE_FONTS = [
  { name: 'MonteCarlo', label: 'MonteCarlo' },
  { name: 'Dancing Script', label: 'Dancing Script' },
  { name: 'Great Vibes', label: 'Great Vibes' },
  { name: 'Allura', label: 'Allura' },
]

export default function SigningBanner({
  fields,
  fieldValues,
  currentFieldIndex,
  onFieldChange,
  onValueChange,
  onComplete,
  isCompleting,
  signerName = '',
  signerEmail = '',
}: SigningBannerProps) {
  const currentField = fields[currentFieldIndex]
  const totalFields = fields.length
  const [hasStarted, setHasStarted] = useState(false)
  
  const filledCount = fields.filter(f => {
    const value = fieldValues[f.id]
    if (f.type === 'checkbox') return value === 'true'
    return value && value.trim() !== ''
  }).length
  
  // States
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const signaturePadRef = useRef<SignaturePad | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [signatureMode, setSignatureMode] = useState<'type' | 'draw' | 'upload'>('type')
  const [typedSignature, setTypedSignature] = useState(signerName)
  const [selectedFont, setSelectedFont] = useState(0)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [textValue, setTextValue] = useState('')
  const [dateValue, setDateValue] = useState('')
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  
  // Reset when field changes
  useEffect(() => {
    if (!currentField) return
    
    if (currentField.type === 'signature' || currentField.type === 'initials') {
      setSignatureMode('type')
      setTypedSignature(currentField.type === 'initials' 
        ? signerName.split(' ').map(n => n[0] || '').join('').toUpperCase()
        : signerName)
      setHasDrawn(false)
      setUploadedImage(null)
      if (signaturePadRef.current) signaturePadRef.current.clear()
    } else if (currentField.type === 'text' || currentField.type === 'name' || currentField.type === 'email') {
      const existing = fieldValues[currentField.id] || ''
      if (currentField.type === 'name' && !existing) setTextValue(signerName)
      else if (currentField.type === 'email' && !existing) setTextValue(signerEmail)
      else setTextValue(existing)
    } else if (currentField.type === 'date') {
      setDateValue(fieldValues[currentField.id] || '')
    }
  }, [currentField?.id, currentField?.type, signerName, signerEmail, fieldValues])
  
  // Close font dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowFontDropdown(false)
    if (showFontDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showFontDropdown])
  
  // Initialize signature pad
  useEffect(() => {
    if (canvasRef.current && signatureMode === 'draw' && (currentField?.type === 'signature' || currentField?.type === 'initials')) {
      const canvas = canvasRef.current
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      canvas.getContext('2d')?.scale(ratio, ratio)
      
      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
      })
      
      signaturePadRef.current.addEventListener('endStroke', () => setHasDrawn(true))
    }
    
    return () => { signaturePadRef.current?.off() }
  }, [signatureMode, currentField?.type])
  
  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setUploadedImage(dataUrl)
    }
    reader.readAsDataURL(file)
  }, [])
  
  const handleNext = useCallback(() => {
    if (!currentField) return
    
    if (currentField.type === 'signature' || currentField.type === 'initials') {
      if (signatureMode === 'draw' && signaturePadRef.current && hasDrawn) {
        onValueChange(currentField.id, signaturePadRef.current.toDataURL('image/png'))
      } else if (signatureMode === 'upload' && uploadedImage) {
        onValueChange(currentField.id, uploadedImage)
      } else if (signatureMode === 'type' && typedSignature.trim()) {
        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 120
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, 400, 120)
          ctx.fillStyle = 'black'
          ctx.font = `italic 42px "${SIGNATURE_FONTS[selectedFont].name}", cursive`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(typedSignature, 200, 60)
          onValueChange(currentField.id, canvas.toDataURL('image/png'))
        }
      }
    } else if (currentField.type === 'checkbox') {
      onValueChange(currentField.id, fieldValues[currentField.id] === 'true' ? '' : 'true')
    } else if (currentField.type === 'date' && dateValue) {
      onValueChange(currentField.id, new Date(dateValue).toLocaleDateString('fr-FR'))
    } else if (['text', 'name', 'email'].includes(currentField.type)) {
      onValueChange(currentField.id, textValue)
    }
    
    if (currentFieldIndex < totalFields - 1) {
      onFieldChange(currentFieldIndex + 1)
    }
  }, [currentField, signatureMode, hasDrawn, uploadedImage, typedSignature, selectedFont, dateValue, textValue, fieldValues, currentFieldIndex, totalFields, onValueChange, onFieldChange])
  
  const handleBack = () => {
    if (currentFieldIndex > 0) onFieldChange(currentFieldIndex - 1)
  }
  
  const isLastField = currentFieldIndex === totalFields - 1
  
  const isValid = useCallback(() => {
    if (!currentField) return false
    if (currentField.type === 'signature' || currentField.type === 'initials') {
      if (signatureMode === 'draw') return hasDrawn
      if (signatureMode === 'upload') return !!uploadedImage
      return typedSignature.trim() !== ''
    }
    if (currentField.type === 'checkbox') return !currentField.required || fieldValues[currentField.id] === 'true'
    if (currentField.type === 'date') return !currentField.required || dateValue !== ''
    if (['text', 'name', 'email'].includes(currentField.type)) return !currentField.required || textValue.trim() !== ''
    return true
  }, [currentField, signatureMode, hasDrawn, uploadedImage, typedSignature, dateValue, textValue, fieldValues])
  
  const getFieldLabel = (type: FieldType) => {
    const labels: Record<string, string> = {
      signature: 'Signature', initials: 'Initiales', date: 'Date',
      text: 'Texte', checkbox: 'Case à cocher', name: 'Nom', email: 'Email',
    }
    return labels[type] || type
  }
  
  if (!currentField) return null
  
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl border border-gray-200"
      >
        {/* Welcome state */}
        {!hasStarted ? (
          <div className="p-5 text-center">
            <div className="w-12 h-12 bg-[#08CF65] rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Prêt à signer ?</h3>
            <p className="text-gray-500 text-sm mb-4">{totalFields} champ{totalFields > 1 ? 's' : ''} à remplir</p>
            <button
              onClick={() => setHasStarted(true)}
              className="w-full py-2.5 bg-[#08CF65] hover:bg-[#06B557] text-white font-medium rounded-xl transition-colors"
            >
              Commencer →
            </button>
          </div>
        ) : showConfirmation ? (
          <>
            {/* Confirmation step - styled like a field */}
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-900">Confirmation</span>
              <span className="text-xs text-gray-400">Dernière étape</span>
            </div>
            
            {/* Content */}
            <div className="px-4 py-4">
              <p className="text-sm text-gray-700 mb-4 text-center">
                Confirmez votre signature pour la rendre officielle
              </p>
              
              {/* Modern toggle checkbox like Transfr */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <button
                  type="button"
                  onClick={() => setAgreedToTerms(!agreedToTerms)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    agreedToTerms ? 'bg-[#08CF65]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                      agreedToTerms ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-600 leading-tight">
                  J&apos;accepte les{' '}
                  <a href="https://drime.cloud/terms-of-services" target="_blank" rel="noopener noreferrer" className="text-[#7E33F7] hover:underline">
                    CGU
                  </a>
                  {' '}et la{' '}
                  <a href="https://drime.cloud/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#7E33F7] hover:underline">
                    Politique de confidentialité
                  </a>
                </span>
              </label>
            </div>
            
            {/* Navigation */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <button
                onClick={() => { setShowConfirmation(false); setAgreedToTerms(false) }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Retour
              </button>
              
              <button
                onClick={() => { if (agreedToTerms) onComplete() }}
                disabled={!agreedToTerms || isCompleting}
                className="px-4 py-2 rounded-xl bg-[#08CF65] text-white text-sm font-medium disabled:opacity-50 hover:bg-[#06B557] transition-colors disabled:cursor-not-allowed"
              >
                {isCompleting ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signature...
                  </span>
                ) : (
                  'Confirmer →'
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {currentField.label || getFieldLabel(currentField.type)}
                </span>
                {currentField.required && <span className="text-gray-400 text-sm">(requis)</span>}
                {!currentField.required && <span className="text-gray-400 text-sm">(optionnel)</span>}
              </div>
              <span className="text-gray-400 text-sm">{currentFieldIndex + 1} / {totalFields}</span>
            </div>
            
            {/* Content */}
            <div className="px-4 py-3">
              {/* Signature / Initials */}
              {(currentField.type === 'signature' || currentField.type === 'initials') && (
                <div>
                  {signatureMode === 'type' ? (
                    <div 
                      className="relative bg-gray-50 rounded-xl border-2 border-[#08CF65] h-20 flex items-center justify-center cursor-text mb-3"
                      onClick={() => inputRef.current?.focus()}
                    >
                      <input
                        ref={inputRef}
                        type="text"
                        value={typedSignature}
                        onChange={(e) => setTypedSignature(e.target.value)}
                        placeholder="Tapez ici..."
                        className="absolute inset-0 w-full h-full text-center text-3xl bg-transparent border-none outline-none italic text-gray-900 placeholder-gray-400"
                        style={{ fontFamily: `"${SIGNATURE_FONTS[selectedFont].name}", cursive` }}
                        autoFocus
                      />
                    </div>
                  ) : signatureMode === 'draw' ? (
                    <div className="relative mb-3">
                      <canvas
                        ref={canvasRef}
                        className="w-full h-20 bg-gray-50 rounded-xl border-2 border-[#08CF65] cursor-crosshair"
                        style={{ touchAction: 'none' }}
                      />
                      {hasDrawn && (
                        <button
                          onClick={() => { signaturePadRef.current?.clear(); setHasDrawn(false) }}
                          className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full shadow flex items-center justify-center text-gray-500 hover:text-gray-700"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Upload mode */
                    <div className="mb-3">
                      {uploadedImage ? (
                        <div className="relative bg-gray-50 rounded-xl border-2 border-[#08CF65] h-20 flex items-center justify-center">
                          <img src={uploadedImage} alt="Signature" className="max-h-16 max-w-full object-contain" />
                          <button
                            onClick={() => setUploadedImage(null)}
                            className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full shadow flex items-center justify-center text-gray-500 hover:text-gray-700"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <label className="block bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 h-20 flex items-center justify-center cursor-pointer hover:border-[#08CF65] transition-colors">
                          <div className="text-center">
                            <svg className="w-6 h-6 text-gray-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm text-gray-500">Cliquez pour uploader</span>
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  )}
                  
                  {/* Controls row */}
                  <div className="flex items-center justify-between gap-2">
                    {signatureMode === 'type' && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">Police:</span>
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowFontDropdown(!showFontDropdown) }}
                            className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-lg px-3 py-1.5 border border-gray-200 cursor-pointer transition-colors"
                          >
                            <span style={{ fontFamily: `"${SIGNATURE_FONTS[selectedFont].name}", cursive` }}>
                              {SIGNATURE_FONTS[selectedFont].label}
                            </span>
                            <svg 
                              className={`w-3 h-3 text-gray-400 transition-transform ${showFontDropdown ? 'rotate-180' : ''}`} 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {showFontDropdown && (
                            <div 
                              className="absolute left-0 bottom-full mb-2 bg-white rounded-xl border border-gray-200 shadow-xl py-1.5 min-w-[160px] z-[99999]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {SIGNATURE_FONTS.map((font, i) => (
                                <button
                                  key={font.name}
                                  onClick={() => { setSelectedFont(i); setShowFontDropdown(false) }}
                                  className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center ${
                                    selectedFont === i ? 'bg-[#08CF65]/10' : ''
                                  }`}
                                >
                                  <span 
                                    className="text-base text-gray-900"
                                    style={{ fontFamily: `"${font.name}", cursive` }}
                                  >
                                    {font.label}
                                  </span>
                                  {selectedFont === i && (
                                    <svg className="w-4 h-4 ml-auto text-[#08CF65]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {signatureMode !== 'type' && <div />}
                    
                    <div className="flex gap-1">
                      <button
                        onClick={() => setSignatureMode('type')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          signatureMode === 'type' ? 'bg-[#08CF65] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Taper
                      </button>
                      <button
                        onClick={() => setSignatureMode('draw')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          signatureMode === 'draw' ? 'bg-[#08CF65] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Dessiner
                      </button>
                      <button
                        onClick={() => setSignatureMode('upload')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          signatureMode === 'upload' ? 'bg-[#08CF65] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Upload
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Checkbox */}
              {currentField.type === 'checkbox' && (
                <div className="flex items-center gap-3 py-2">
                  <button
                    onClick={() => onValueChange(currentField.id, fieldValues[currentField.id] === 'true' ? '' : 'true')}
                    className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                      fieldValues[currentField.id] === 'true'
                        ? 'bg-[#08CF65] border-[#08CF65]'
                        : 'bg-white border-gray-300 hover:border-[#08CF65]'
                    }`}
                  >
                    {fieldValues[currentField.id] === 'true' && (
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className="text-gray-600 text-sm">
                    Cliquez pour {fieldValues[currentField.id] === 'true' ? 'décocher' : 'cocher'}
                  </span>
                </div>
              )}
              
              {/* Date */}
              {currentField.type === 'date' && (
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateValue}
                    onChange={(e) => setDateValue(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-gray-50 border-2 border-[#08CF65] text-gray-900 text-sm focus:outline-none"
                  />
                  <button
                    onClick={() => setDateValue(new Date().toISOString().split('T')[0])}
                    className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Aujourd&apos;hui
                  </button>
                </div>
              )}
              
              {/* Text / Name / Email */}
              {['text', 'name', 'email'].includes(currentField.type) && (
                <input
                  type={currentField.type === 'email' ? 'email' : 'text'}
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder={
                    currentField.type === 'name' ? 'Votre nom complet' :
                    currentField.type === 'email' ? 'votre@email.com' : 'Tapez ici...'
                  }
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border-2 border-[#08CF65] text-gray-900 focus:outline-none"
                  autoFocus
                />
              )}
            </div>
            
            {/* Progress bar */}
            <div className="px-4 pb-2">
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-[#08CF65]"
                  initial={{ width: 0 }}
                  animate={{ width: `${(filledCount / totalFields) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
            
            {/* Navigation */}
            <div className="px-4 pb-3 flex items-center justify-between">
              <button
                onClick={handleBack}
                disabled={currentFieldIndex === 0}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
              >
                ← Précédent
              </button>
              
              {/* Progress dots */}
              <div className="flex gap-1">
                {fields.map((f, i) => {
                  const isFilled = f.type === 'checkbox' 
                    ? fieldValues[f.id] === 'true'
                    : fieldValues[f.id] && fieldValues[f.id].trim() !== ''
                  
                  return (
                    <button
                      key={f.id}
                      onClick={() => onFieldChange(i)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === currentFieldIndex
                          ? 'bg-[#08CF65] scale-125'
                          : isFilled
                            ? 'bg-[#08CF65]/60'
                            : 'bg-gray-300'
                      }`}
                    />
                  )
                })}
              </div>
              
              {isLastField ? (
                <button
                  onClick={() => { handleNext(); setShowConfirmation(true) }}
                  disabled={!isValid() || isCompleting}
                  className="px-4 py-2 rounded-xl bg-[#08CF65] text-white text-sm font-medium disabled:opacity-50 hover:bg-[#06B557] transition-colors"
                >
                  {isCompleting ? '...' : 'Finaliser →'}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={currentField.required && !isValid()}
                  className="px-4 py-2 rounded-xl bg-[#08CF65] text-white text-sm font-medium disabled:opacity-50 hover:bg-[#06B557] transition-colors"
                >
                  Suivant →
                </button>
              )}
            </div>
          </>
        )}
        
      </motion.div>
    </div>
  )
}
