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
  
  const filledCount = fields.filter(f => {
    const value = fieldValues[f.id]
    if (f.type === 'checkbox') return value === 'true'
    return value && value.trim() !== ''
  }).length
  
  // States
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const signaturePadRef = useRef<SignaturePad | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#1a1a1a] rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">
              {currentField.label || getFieldLabel(currentField.type)}
            </span>
            {currentField.required && <span className="text-gray-400 text-sm">(requis)</span>}
            {!currentField.required && <span className="text-gray-500 text-sm">(optionnel)</span>}
          </div>
          <span className="text-gray-400 text-sm">{currentFieldIndex + 1} / {totalFields}</span>
        </div>
        
        {/* Content */}
        <div className="px-4 pb-3">
          {/* Signature / Initials */}
          {(currentField.type === 'signature' || currentField.type === 'initials') && (
            <div>
              {signatureMode === 'type' ? (
                /* Type directly in the preview box */
                <div 
                  className="relative bg-white rounded-lg border-2 border-amber-400 h-20 flex items-center justify-center cursor-text mb-2"
                  onClick={() => inputRef.current?.focus()}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    placeholder="Tapez ici..."
                    className="absolute inset-0 w-full h-full text-center text-3xl bg-transparent border-none outline-none italic text-gray-900"
                    style={{ fontFamily: `"${SIGNATURE_FONTS[selectedFont].name}", cursive` }}
                    autoFocus
                  />
                </div>
              ) : (
                /* Draw canvas */
                <div className="relative mb-2">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-20 bg-white rounded-lg border-2 border-amber-400 cursor-crosshair"
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
              )}
              
              {/* Controls row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-xs">Police:</span>
                  <select
                    value={selectedFont}
                    onChange={(e) => setSelectedFont(Number(e.target.value))}
                    className="bg-gray-800 text-white text-xs rounded px-2 py-1 border border-gray-600"
                  >
                    {SIGNATURE_FONTS.map((font, i) => (
                      <option key={font.name} value={i}>{font.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex gap-1">
                  <button
                    onClick={() => setSignatureMode('type')}
                    className={`px-3 py-1 rounded text-xs font-medium ${
                      signatureMode === 'type' ? 'bg-white text-gray-900' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    Taper
                  </button>
                  <button
                    onClick={() => setSignatureMode('draw')}
                    className={`px-3 py-1 rounded text-xs font-medium ${
                      signatureMode === 'draw' ? 'bg-white text-gray-900' : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    Dessiner
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
                    : 'bg-white border-gray-300'
                }`}
              >
                {fieldValues[currentField.id] === 'true' && (
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span className="text-gray-300 text-sm">
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
                className="flex-1 px-3 py-2 rounded-lg bg-white border-2 border-amber-400 text-gray-900 text-sm"
              />
              <button
                onClick={() => setDateValue(new Date().toISOString().split('T')[0])}
                className="px-3 py-2 bg-gray-700 text-gray-200 text-sm rounded-lg hover:bg-gray-600"
              >
                Auj.
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
              className="w-full px-3 py-2 rounded-lg bg-white border-2 border-amber-400 text-gray-900"
              autoFocus
            />
          )}
        </div>
        
        {/* Progress bar */}
        <div className="px-4 pb-2">
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-amber-400"
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
            className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-600"
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
                        : 'bg-gray-600'
                  }`}
                />
              )
            })}
          </div>
          
          {isLastField ? (
            <button
              onClick={() => { handleNext(); setTimeout(onComplete, 100) }}
              disabled={!isValid() || isCompleting}
              className="px-4 py-2 rounded-lg bg-[#08CF65] text-white text-sm font-medium disabled:opacity-50 hover:bg-[#06B557]"
            >
              {isCompleting ? '...' : 'Finaliser →'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={currentField.required && !isValid()}
              className="px-4 py-2 rounded-lg bg-[#08CF65] text-white text-sm font-medium disabled:opacity-50 hover:bg-[#06B557]"
            >
              Suivant →
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
