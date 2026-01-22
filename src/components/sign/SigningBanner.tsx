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

// Signature fonts for typed signatures
const SIGNATURE_FONTS = [
  { name: 'MonteCarlo', style: 'font-montecarlo' },
  { name: 'Dancing Script', style: 'font-dancing' },
  { name: 'Great Vibes', style: 'font-great-vibes' },
  { name: 'Allura', style: 'font-allura' },
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
  
  // Signature pad state
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const signaturePadRef = useRef<SignaturePad | null>(null)
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type' | 'upload'>('type')
  const [typedSignature, setTypedSignature] = useState(signerName)
  const [selectedFont, setSelectedFont] = useState(0)
  const [hasDrawn, setHasDrawn] = useState(false)
  
  // Text input state
  const [textValue, setTextValue] = useState('')
  
  // Date state
  const [dateValue, setDateValue] = useState('')
  
  // Initialize when field changes
  useEffect(() => {
    if (!currentField) return
    
    // Reset states when field changes
    if (currentField.type === 'signature' || currentField.type === 'initials') {
      setSignatureMode('type')
      setTypedSignature(currentField.type === 'initials' 
        ? signerName.split(' ').map(n => n[0]).join('').toUpperCase()
        : signerName)
      setHasDrawn(false)
      
      // Clear canvas if exists
      if (signaturePadRef.current) {
        signaturePadRef.current.clear()
      }
    } else if (currentField.type === 'text' || currentField.type === 'name' || currentField.type === 'email') {
      const existingValue = fieldValues[currentField.id] || ''
      if (currentField.type === 'name' && !existingValue) {
        setTextValue(signerName)
      } else if (currentField.type === 'email' && !existingValue) {
        setTextValue(signerEmail)
      } else {
        setTextValue(existingValue)
      }
    } else if (currentField.type === 'date') {
      setDateValue(fieldValues[currentField.id] || '')
    }
  }, [currentField?.id, currentField?.type, signerName, signerEmail, fieldValues])
  
  // Initialize signature pad when canvas is available
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
      
      signaturePadRef.current.addEventListener('endStroke', () => {
        setHasDrawn(true)
      })
    }
    
    return () => {
      if (signaturePadRef.current) {
        signaturePadRef.current.off()
      }
    }
  }, [signatureMode, currentField?.type])
  
  // Clear signature
  const clearSignature = useCallback(() => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear()
      setHasDrawn(false)
    }
    setTypedSignature('')
  }, [])
  
  // Handle next/submit for current field
  const handleNext = useCallback(() => {
    if (!currentField) return
    
    // Save current field value
    if (currentField.type === 'signature' || currentField.type === 'initials') {
      if (signatureMode === 'draw' && signaturePadRef.current && hasDrawn) {
        const dataUrl = signaturePadRef.current.toDataURL('image/png')
        onValueChange(currentField.id, dataUrl)
      } else if (signatureMode === 'type' && typedSignature.trim()) {
        // Create typed signature as data URL
        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 150
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, 400, 150)
          ctx.fillStyle = 'black'
          ctx.font = `italic 48px "${SIGNATURE_FONTS[selectedFont].name}", cursive`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(typedSignature, 200, 75)
          const dataUrl = canvas.toDataURL('image/png')
          onValueChange(currentField.id, dataUrl)
        }
      }
    } else if (currentField.type === 'checkbox') {
      // Toggle checkbox value
      const currentValue = fieldValues[currentField.id]
      onValueChange(currentField.id, currentValue === 'true' ? '' : 'true')
    } else if (currentField.type === 'date') {
      if (dateValue) {
        // Format date for display
        const formattedDate = new Date(dateValue).toLocaleDateString('fr-FR')
        onValueChange(currentField.id, formattedDate)
      }
    } else if (currentField.type === 'text' || currentField.type === 'name' || currentField.type === 'email') {
      onValueChange(currentField.id, textValue)
    }
    
    // Move to next field or complete
    if (currentFieldIndex < totalFields - 1) {
      onFieldChange(currentFieldIndex + 1)
    }
  }, [currentField, signatureMode, hasDrawn, typedSignature, selectedFont, dateValue, textValue, fieldValues, currentFieldIndex, totalFields, onValueChange, onFieldChange])
  
  // Handle back
  const handleBack = useCallback(() => {
    if (currentFieldIndex > 0) {
      onFieldChange(currentFieldIndex - 1)
    }
  }, [currentFieldIndex, onFieldChange])
  
  // Set date to today
  const setToday = useCallback(() => {
    const today = new Date().toISOString().split('T')[0]
    setDateValue(today)
  }, [])
  
  // Check if current field is valid
  const isCurrentFieldValid = useCallback(() => {
    if (!currentField) return false
    
    if (currentField.type === 'signature' || currentField.type === 'initials') {
      if (signatureMode === 'draw') return hasDrawn
      if (signatureMode === 'type') return typedSignature.trim() !== ''
      return false
    }
    
    if (currentField.type === 'checkbox') {
      if (!currentField.required) return true
      return fieldValues[currentField.id] === 'true'
    }
    
    if (currentField.type === 'date') {
      if (!currentField.required) return true
      return dateValue !== ''
    }
    
    if (currentField.type === 'text' || currentField.type === 'name' || currentField.type === 'email') {
      if (!currentField.required) return true
      return textValue.trim() !== ''
    }
    
    return true
  }, [currentField, signatureMode, hasDrawn, typedSignature, dateValue, textValue, fieldValues])
  
  // Check if it's the last field
  const isLastField = currentFieldIndex === totalFields - 1
  
  // Check if all required fields are filled
  const canFinalize = useCallback(() => {
    return fields.every(f => {
      if (!f.required) return true
      const value = fieldValues[f.id]
      if (f.type === 'checkbox') return value === 'true'
      return value && value.trim() !== ''
    })
  }, [fields, fieldValues])
  
  if (!currentField) {
    return null
  }
  
  // Get field label
  const getFieldLabel = (type: FieldType) => {
    const labels: Record<string, string> = {
      signature: 'Signature',
      initials: 'Initiales',
      date: 'Date',
      text: 'Texte',
      checkbox: 'Case à cocher',
      name: 'Nom',
      email: 'Email',
    }
    return labels[type] || type
  }
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Progress bar */}
      <div className="h-1 bg-gray-200">
        <div 
          className="h-full bg-[#08CF65] transition-all duration-300"
          style={{ width: `${(filledCount / totalFields) * 100}%` }}
        />
      </div>
      
      {/* Banner content */}
      <div className="bg-[#1a1a1a] text-white p-4 shadow-lg">
        <div className="max-w-2xl mx-auto">
          {/* Field label */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">
                {currentField.label || getFieldLabel(currentField.type)}
              </span>
              {currentField.required ? (
                <span className="text-xs text-amber-400">(requis)</span>
              ) : (
                <span className="text-xs text-gray-400">(optionnel)</span>
              )}
            </div>
            <span className="text-sm text-gray-400">
              {currentFieldIndex + 1} / {totalFields}
            </span>
          </div>
          
          {/* Field input based on type */}
          <div className="mb-4">
            {/* Signature / Initials */}
            {(currentField.type === 'signature' || currentField.type === 'initials') && (
              <div>
                {/* Mode selector */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setSignatureMode('type')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      signatureMode === 'type' 
                        ? 'bg-white text-gray-900' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Taper
                  </button>
                  <button
                    onClick={() => setSignatureMode('draw')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      signatureMode === 'draw' 
                        ? 'bg-white text-gray-900' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Dessiner
                  </button>
                </div>
                
                {signatureMode === 'type' ? (
                  <div>
                    {/* Typed signature preview */}
                    <div className="bg-white rounded-lg p-4 mb-3 min-h-[80px] flex items-center justify-center border-2 border-amber-400">
                      <span 
                        className="text-3xl text-gray-900 italic"
                        style={{ fontFamily: `"${SIGNATURE_FONTS[selectedFont].name}", cursive` }}
                      >
                        {typedSignature || 'Tapez ici...'}
                      </span>
                    </div>
                    
                    {/* Text input */}
                    <input
                      type="text"
                      value={typedSignature}
                      onChange={(e) => setTypedSignature(e.target.value)}
                      placeholder={currentField.type === 'initials' ? 'Vos initiales...' : 'Votre nom...'}
                      className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#08CF65] focus:border-transparent"
                    />
                    
                    {/* Font selector */}
                    <div className="flex gap-2 mt-3">
                      <span className="text-sm text-gray-400">Police:</span>
                      <select
                        value={selectedFont}
                        onChange={(e) => setSelectedFont(Number(e.target.value))}
                        className="bg-gray-700 text-white text-sm rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#08CF65]"
                      >
                        {SIGNATURE_FONTS.map((font, index) => (
                          <option key={font.name} value={index}>
                            {font.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Drawing canvas */}
                    <div className="relative">
                      <canvas
                        ref={canvasRef}
                        className="w-full h-32 bg-white rounded-lg border-2 border-amber-400 cursor-crosshair"
                        style={{ touchAction: 'none' }}
                      />
                      {hasDrawn && (
                        <button
                          onClick={clearSignature}
                          className="absolute top-2 right-2 px-2 py-1 bg-gray-800 text-white text-xs rounded hover:bg-gray-700"
                        >
                          Effacer
                        </button>
                      )}
                    </div>
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
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span className="text-gray-300">
                  {fieldValues[currentField.id] === 'true' ? 'Coché' : 'Cliquez pour cocher'}
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
                  className="flex-1 px-4 py-3 rounded-lg bg-white border-2 border-amber-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#08CF65] focus:border-transparent"
                />
                <button
                  onClick={setToday}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors whitespace-nowrap"
                >
                  Aujourd&apos;hui
                </button>
              </div>
            )}
            
            {/* Text / Name / Email */}
            {(currentField.type === 'text' || currentField.type === 'name' || currentField.type === 'email') && (
              <input
                type={currentField.type === 'email' ? 'email' : 'text'}
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder={
                  currentField.type === 'name' ? 'Votre nom complet...' :
                  currentField.type === 'email' ? 'Votre email...' :
                  'Tapez ici...'
                }
                className="w-full px-4 py-3 rounded-lg bg-white border-2 border-amber-400 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#08CF65] focus:border-transparent"
              />
            )}
          </div>
          
          {/* Navigation buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              disabled={currentFieldIndex === 0}
              className="px-4 py-2.5 rounded-lg bg-gray-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
            >
              ← Précédent
            </button>
            
            <div className="flex-1" />
            
            {isLastField ? (
              <button
                onClick={() => {
                  handleNext()
                  setTimeout(onComplete, 100)
                }}
                disabled={!isCurrentFieldValid() || isCompleting}
                className="px-6 py-2.5 rounded-lg bg-[#08CF65] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#06B557] transition-colors flex items-center gap-2"
              >
                {isCompleting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Finalisation...
                  </>
                ) : (
                  <>
                    Finaliser →
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={currentField.required && !isCurrentFieldValid()}
                className="px-6 py-2.5 rounded-lg bg-amber-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-600 transition-colors"
              >
                Suivant →
              </button>
            )}
          </div>
          
          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mt-4">
            {fields.map((field, index) => {
              const isFilled = field.type === 'checkbox' 
                ? fieldValues[field.id] === 'true'
                : fieldValues[field.id] && fieldValues[field.id].trim() !== ''
              
              return (
                <button
                  key={field.id}
                  onClick={() => onFieldChange(index)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    index === currentFieldIndex
                      ? 'bg-amber-400 scale-125'
                      : isFilled
                        ? 'bg-[#08CF65]'
                        : 'bg-gray-600 hover:bg-gray-500'
                  }`}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
