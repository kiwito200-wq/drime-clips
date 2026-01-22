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

// Signature fonts
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
  
  // Calculate filled count
  const filledCount = fields.filter(f => {
    const value = fieldValues[f.id]
    if (f.type === 'checkbox') return value === 'true'
    return value && value.trim() !== ''
  }).length
  
  // Signature state
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const signaturePadRef = useRef<SignaturePad | null>(null)
  const [signatureMode, setSignatureMode] = useState<'type' | 'draw'>('type')
  const [typedSignature, setTypedSignature] = useState(signerName)
  const [selectedFont, setSelectedFont] = useState(0)
  const [hasDrawn, setHasDrawn] = useState(false)
  
  // Text/Date state
  const [textValue, setTextValue] = useState('')
  const [dateValue, setDateValue] = useState('')
  
  // Expanded state for signature
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Reset states when field changes
  useEffect(() => {
    if (!currentField) return
    
    setIsExpanded(false)
    
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
    if (canvasRef.current && signatureMode === 'draw' && isExpanded) {
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
  }, [signatureMode, isExpanded])
  
  // Save and go to next
  const handleNext = useCallback(() => {
    if (!currentField) return
    
    // Save value based on field type
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
      setIsExpanded(false)
    } else if (currentField.type === 'checkbox') {
      const newVal = fieldValues[currentField.id] === 'true' ? '' : 'true'
      onValueChange(currentField.id, newVal)
    } else if (currentField.type === 'date' && dateValue) {
      onValueChange(currentField.id, new Date(dateValue).toLocaleDateString('fr-FR'))
    } else if (['text', 'name', 'email'].includes(currentField.type)) {
      onValueChange(currentField.id, textValue)
    }
    
    // Go to next field
    if (currentFieldIndex < totalFields - 1) {
      onFieldChange(currentFieldIndex + 1)
    }
  }, [currentField, signatureMode, hasDrawn, typedSignature, selectedFont, dateValue, textValue, fieldValues, currentFieldIndex, totalFields, onValueChange, onFieldChange])
  
  const handleBack = () => {
    setIsExpanded(false)
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
  
  const getFieldIcon = (type: FieldType) => {
    switch (type) {
      case 'signature': return '✍️'
      case 'initials': return '🔤'
      case 'date': return '📅'
      case 'checkbox': return '☑️'
      default: return '📝'
    }
  }
  
  const getFieldLabel = (type: FieldType) => {
    const labels: Record<string, string> = {
      signature: 'Signature', initials: 'Initiales', date: 'Date',
      text: 'Texte', checkbox: 'Case', name: 'Nom', email: 'Email',
    }
    return labels[type] || type
  }
  
  if (!currentField) return null
  
  // Compact bubble style
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
      <AnimatePresence mode="wait">
        {/* Expanded signature panel */}
        {isExpanded && (currentField.type === 'signature' || currentField.type === 'initials') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl border border-gray-200 mb-3 p-4"
          >
            {/* Mode tabs */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setSignatureMode('type')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  signatureMode === 'type' ? 'bg-[#08CF65] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Taper
              </button>
              <button
                onClick={() => setSignatureMode('draw')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  signatureMode === 'draw' ? 'bg-[#08CF65] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Dessiner
              </button>
            </div>
            
            {signatureMode === 'type' ? (
              <>
                <div className="bg-gray-50 rounded-xl p-3 mb-3 min-h-[60px] flex items-center justify-center border-2 border-[#08CF65]">
                  <span 
                    className="text-2xl text-gray-900 italic"
                    style={{ fontFamily: `"${SIGNATURE_FONTS[selectedFont].name}", cursive` }}
                  >
                    {typedSignature || 'Tapez votre nom...'}
                  </span>
                </div>
                <input
                  type="text"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  placeholder={currentField.type === 'initials' ? 'Vos initiales' : 'Votre nom'}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 mb-2 focus:outline-none focus:ring-2 focus:ring-[#08CF65] focus:border-transparent"
                  autoFocus
                />
                <div className="flex gap-1.5 flex-wrap">
                  {SIGNATURE_FONTS.map((font, i) => (
                    <button
                      key={font.name}
                      onClick={() => setSelectedFont(i)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
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
                  className="w-full h-24 bg-white rounded-xl border-2 border-[#08CF65] cursor-crosshair"
                  style={{ touchAction: 'none' }}
                />
                {hasDrawn && (
                  <button
                    onClick={() => { signaturePadRef.current?.clear(); setHasDrawn(false) }}
                    className="absolute top-1 right-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200"
                  >
                    Effacer
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Main compact banner */}
      <motion.div
        layout
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <motion.div 
            className="h-full bg-[#08CF65]"
            initial={{ width: 0 }}
            animate={{ width: `${(filledCount / totalFields) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        
        <div className="p-3">
          {/* Field content based on type */}
          <div className="flex items-center gap-3">
            {/* Field icon & label */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-lg">{getFieldIcon(currentField.type)}</span>
              <div className="min-w-0">
                <div className="font-medium text-gray-900 text-sm truncate">
                  {currentField.label || getFieldLabel(currentField.type)}
                  {currentField.required && <span className="text-red-500 ml-1">*</span>}
                </div>
                <div className="text-xs text-gray-500">{currentFieldIndex + 1} sur {totalFields}</div>
              </div>
            </div>
            
            {/* Field input (compact) */}
            <div className="flex-1 max-w-[200px]">
              {/* Signature/Initials - Click to expand */}
              {(currentField.type === 'signature' || currentField.type === 'initials') && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`w-full px-3 py-2 rounded-lg border-2 text-sm transition-colors ${
                    fieldValues[currentField.id] 
                      ? 'border-[#08CF65] bg-green-50 text-[#08CF65]' 
                      : 'border-dashed border-gray-300 text-gray-500 hover:border-[#08CF65]'
                  }`}
                >
                  {fieldValues[currentField.id] ? '✓ Signé' : 'Cliquez pour signer'}
                </button>
              )}
              
              {/* Checkbox */}
              {currentField.type === 'checkbox' && (
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
              )}
              
              {/* Date */}
              {currentField.type === 'date' && (
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={dateValue}
                    onChange={(e) => setDateValue(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#08CF65] focus:border-transparent"
                  />
                  <button
                    onClick={() => setDateValue(new Date().toISOString().split('T')[0])}
                    className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200 whitespace-nowrap"
                  >
                    Auj.
                  </button>
                </div>
              )}
              
              {/* Text/Name/Email */}
              {['text', 'name', 'email'].includes(currentField.type) && (
                <input
                  type={currentField.type === 'email' ? 'email' : 'text'}
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder={currentField.type === 'name' ? 'Nom' : currentField.type === 'email' ? 'Email' : 'Texte'}
                  className="w-full px-2 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#08CF65] focus:border-transparent"
                />
              )}
            </div>
            
            {/* Navigation buttons */}
            <div className="flex gap-2">
              {currentFieldIndex > 0 && (
                <button
                  onClick={handleBack}
                  className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              
              {isLastField ? (
                <button
                  onClick={() => { handleNext(); setTimeout(onComplete, 100) }}
                  disabled={!isValid() || isCompleting}
                  className="px-4 py-2 rounded-lg bg-[#08CF65] text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#06B557] transition-colors flex items-center gap-1"
                >
                  {isCompleting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Terminer</>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={currentField.required && !isValid()}
                  className="px-4 py-2 rounded-lg bg-[#08CF65] text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#06B557] transition-colors flex items-center gap-1"
                >
                  Suivant
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          {/* Progress dots */}
          <div className="flex justify-center gap-1 mt-2">
            {fields.map((f, i) => {
              const isFilled = f.type === 'checkbox' 
                ? fieldValues[f.id] === 'true'
                : fieldValues[f.id] && fieldValues[f.id].trim() !== ''
              
              return (
                <button
                  key={f.id}
                  onClick={() => { setIsExpanded(false); onFieldChange(i) }}
                  className={`w-2 h-2 rounded-full transition-all ${
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
        </div>
      </motion.div>
    </div>
  )
}
