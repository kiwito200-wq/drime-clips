'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  { name: 'MonteCarlo', label: 'Élégant' },
  { name: 'Dancing Script', label: 'Classique' },
  { name: 'Great Vibes', label: 'Cursif' },
  { name: 'Allura', label: 'Fluide' },
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
  
  const filledCount = fields.filter(f => {
    const value = fieldValues[f.id]
    if (f.type === 'checkbox') return value === 'true'
    return value && value.trim() !== ''
  }).length
  
  // States
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const signaturePadRef = useRef<SignaturePad | null>(null)
  const [signatureMode, setSignatureMode] = useState<'type' | 'draw'>('type')
  const [typedSignature, setTypedSignature] = useState(signerName)
  const [selectedFont, setSelectedFont] = useState(0)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [textValue, setTextValue] = useState('')
  const [dateValue, setDateValue] = useState('')
  
  // Reset when field changes
  useEffect(() => {
    if (!currentField) return
    
    if (currentField.type === 'signature' || currentField.type === 'initials') {
      setSignatureMode('type')
      setTypedSignature(currentField.type === 'initials' 
        ? signerName.split(' ').map(n => n[0] || '').join('').toUpperCase()
        : signerName)
      setHasDrawn(false)
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
  
  const handleNext = useCallback(() => {
    if (!currentField) return
    
    if (currentField.type === 'signature' || currentField.type === 'initials') {
      if (signatureMode === 'draw' && signaturePadRef.current && hasDrawn) {
        onValueChange(currentField.id, signaturePadRef.current.toDataURL('image/png'))
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
  }, [currentField, signatureMode, hasDrawn, typedSignature, selectedFont, dateValue, textValue, fieldValues, currentFieldIndex, totalFields, onValueChange, onFieldChange])
  
  const handleBack = () => {
    if (currentFieldIndex > 0) onFieldChange(currentFieldIndex - 1)
  }
  
  const isLastField = currentFieldIndex === totalFields - 1
  
  const isValid = useCallback(() => {
    if (!currentField) return false
    if (currentField.type === 'signature' || currentField.type === 'initials') {
      return signatureMode === 'draw' ? hasDrawn : typedSignature.trim() !== ''
    }
    if (currentField.type === 'checkbox') return !currentField.required || fieldValues[currentField.id] === 'true'
    if (currentField.type === 'date') return !currentField.required || dateValue !== ''
    if (['text', 'name', 'email'].includes(currentField.type)) return !currentField.required || textValue.trim() !== ''
    return true
  }, [currentField, signatureMode, hasDrawn, typedSignature, dateValue, textValue, fieldValues])
  
  const getFieldLabel = (type: FieldType) => {
    const labels: Record<string, string> = {
      signature: 'Signature', initials: 'Initiales', date: 'Date',
      text: 'Texte', checkbox: 'Case à cocher', name: 'Nom', email: 'Email',
    }
    return labels[type] || type
  }
  
  if (!currentField) return null
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200">
        <motion.div 
          className="h-full bg-[#08CF65]"
          initial={{ width: 0 }}
          animate={{ width: `${(filledCount / totalFields) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      
      {/* Banner */}
      <div className="bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-2xl mx-auto p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-semibold text-gray-900">
                {currentField.label || getFieldLabel(currentField.type)}
              </span>
              {currentField.required && <span className="text-red-500 ml-1">*</span>}
              {!currentField.required && <span className="text-gray-400 text-sm ml-2">(optionnel)</span>}
            </div>
            <span className="text-sm text-gray-500">{currentFieldIndex + 1} / {totalFields}</span>
          </div>
          
          {/* Field input */}
          <div className="mb-4">
            {/* Signature / Initials */}
            {(currentField.type === 'signature' || currentField.type === 'initials') && (
              <div>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setSignatureMode('type')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      signatureMode === 'type' ? 'bg-[#08CF65] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Taper
                  </button>
                  <button
                    onClick={() => setSignatureMode('draw')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      signatureMode === 'draw' ? 'bg-[#08CF65] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Dessiner
                  </button>
                </div>
                
                {signatureMode === 'type' ? (
                  <>
                    <div className="bg-white rounded-xl p-4 mb-3 h-20 flex items-center justify-center border-2 border-[#08CF65]">
                      <span 
                        className="text-3xl text-gray-900 italic"
                        style={{ fontFamily: `"${SIGNATURE_FONTS[selectedFont].name}", cursive` }}
                      >
                        {typedSignature || 'Tapez ici...'}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={typedSignature}
                      onChange={(e) => setTypedSignature(e.target.value)}
                      placeholder={currentField.type === 'initials' ? 'Vos initiales' : 'Votre nom complet'}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 mb-2 focus:outline-none focus:ring-2 focus:ring-[#08CF65] focus:border-transparent"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <span className="text-sm text-gray-500 py-1">Police :</span>
                      {SIGNATURE_FONTS.map((font, i) => (
                        <button
                          key={font.name}
                          onClick={() => setSelectedFont(i)}
                          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                            selectedFont === i ? 'bg-[#08CF65] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {font.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="relative">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-28 bg-white rounded-xl border-2 border-[#08CF65] cursor-crosshair"
                      style={{ touchAction: 'none' }}
                    />
                    {hasDrawn && (
                      <button
                        onClick={() => { signaturePadRef.current?.clear(); setHasDrawn(false) }}
                        className="absolute top-2 right-2 px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
                      >
                        Effacer
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Checkbox */}
            {currentField.type === 'checkbox' && (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => onValueChange(currentField.id, fieldValues[currentField.id] === 'true' ? '' : 'true')}
                  className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all ${
                    fieldValues[currentField.id] === 'true'
                      ? 'bg-[#08CF65] border-[#08CF65]'
                      : 'bg-white border-gray-300 hover:border-[#08CF65]'
                  }`}
                >
                  {fieldValues[currentField.id] === 'true' && (
                    <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span className="text-gray-600">
                  Cliquez pour {fieldValues[currentField.id] === 'true' ? 'décocher' : 'cocher'}
                </span>
              </div>
            )}
            
            {/* Date */}
            {currentField.type === 'date' && (
              <div className="flex gap-3">
                <input
                  type="date"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-lg border-2 border-[#08CF65] focus:outline-none focus:ring-2 focus:ring-[#08CF65]/30"
                />
                <button
                  onClick={() => setDateValue(new Date().toISOString().split('T')[0])}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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
                  currentField.type === 'email' ? 'votre@email.com' :
                  'Tapez ici...'
                }
                className="w-full px-4 py-2.5 rounded-lg border-2 border-[#08CF65] focus:outline-none focus:ring-2 focus:ring-[#08CF65]/30"
                autoFocus
              />
            )}
          </div>
          
          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentFieldIndex === 0}
              className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
            >
              ← Précédent
            </button>
            
            {/* Progress dots */}
            <div className="flex gap-1.5">
              {fields.map((f, i) => {
                const isFilled = f.type === 'checkbox' 
                  ? fieldValues[f.id] === 'true'
                  : fieldValues[f.id] && fieldValues[f.id].trim() !== ''
                
                return (
                  <button
                    key={f.id}
                    onClick={() => onFieldChange(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      i === currentFieldIndex
                        ? 'bg-[#08CF65] scale-125'
                        : isFilled
                          ? 'bg-[#08CF65]/50'
                          : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                )
              })}
            </div>
            
            {isLastField ? (
              <button
                onClick={() => { handleNext(); setTimeout(onComplete, 100) }}
                disabled={!isValid() || isCompleting}
                className="px-5 py-2.5 rounded-lg bg-[#08CF65] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#06B557] transition-colors flex items-center gap-2"
              >
                {isCompleting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Finaliser →'
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={currentField.required && !isValid()}
                className="px-5 py-2.5 rounded-lg bg-[#08CF65] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#06B557] transition-colors"
              >
                Suivant →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
