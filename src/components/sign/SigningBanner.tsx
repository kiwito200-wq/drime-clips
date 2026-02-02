'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import SignaturePad from 'signature_pad'
import { Field, FieldType } from './types'
import { useTranslation } from '@/lib/i18n/I18nContext'

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
  isAuthenticated?: boolean // If user is logged in, we can save/load signatures
  signerId?: string
  envelopeSlug?: string
}

const SIGNATURE_FONTS = [
  { name: 'MonteCarlo', label: 'MonteCarlo' },
  { name: 'Dancing Script', label: 'Dancing Script' },
  { name: 'Great Vibes', label: 'Great Vibes' },
  { name: 'Allura', label: 'Allura' },
]

// Country codes with flags
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
  { code: 'AT', dial: '+43', name: 'Autriche', flag: '🇦🇹', placeholder: '664 1234567' },
  { code: 'PL', dial: '+48', name: 'Pologne', flag: '🇵🇱', placeholder: '512 345 678' },
  { code: 'JP', dial: '+81', name: 'Japon', flag: '🇯🇵', placeholder: '90 1234 5678' },
  { code: 'AU', dial: '+61', name: 'Australie', flag: '🇦🇺', placeholder: '412 345 678' },
  { code: 'BR', dial: '+55', name: 'Brésil', flag: '🇧🇷', placeholder: '11 91234 5678' },
]

const getPhonePlaceholder = (dial: string): string => {
  const country = COUNTRIES.find(c => c.dial === dial)
  return country?.placeholder || '123 456 789'
}

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
  isAuthenticated = false,
  signerId,
  envelopeSlug,
}: SigningBannerProps) {
  const { t, locale } = useTranslation()
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
  const [signatureMode, setSignatureMode] = useState<'type' | 'draw' | 'upload'>('draw') // Default to draw if saved signature exists
  const [typedSignature, setTypedSignature] = useState(signerName)
  const [selectedFont, setSelectedFont] = useState(0)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [textValue, setTextValue] = useState('')
  const [dateValue, setDateValue] = useState('')
  const [phoneValue, setPhoneValue] = useState('')
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [savedSignature, setSavedSignature] = useState<string | null>(null)
  const [signatureLoaded, setSignatureLoaded] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [phoneCountry, setPhoneCountry] = useState('+33')
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const countryDropdownRef = useRef<HTMLDivElement>(null)
  const [countrySearch, setCountrySearch] = useState('')
  
  // Inline OTP states
  const [otpStep, setOtpStep] = useState<'input' | 'code'>('input')
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [otpCountdown, setOtpCountdown] = useState(0)
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])
  
  // Track the last field index that entered confirmation mode
  const confirmationFieldIndexRef = useRef<number | null>(null)
  
  // Load saved signature on mount - always try to load even if not authenticated
  useEffect(() => {
    if (!signatureLoaded) {
      fetch('/api/user/signature', { credentials: 'include' })
        .then(res => {
          if (res.ok) return res.json()
          throw new Error('Not authenticated')
        })
        .then(data => {

          if (data.signatureData) {
            setSavedSignature(data.signatureData)
            setSignatureMode('draw') // Show draw mode with saved signature
            setHasDrawn(true) // Mark as already drawn
          } else {
            setSignatureMode('type')
          }
          setSignatureLoaded(true)
        })
        .catch(() => {

          setSignatureMode('type')
          setSignatureLoaded(true)
        })
    }
  }, [signatureLoaded])
  
  // Reset confirmation screen when user clicks on a different field (e.g., clicking directly on PDF)
  // This effect watches for currentFieldIndex changes - when user clicks on a field in PDF,
  // the parent updates currentFieldIndex, and we should exit confirmation mode to show that field
  useEffect(() => {
    // If we're in confirmation mode and the field index changed from when we entered confirmation,
    // that means the user clicked on a different field - exit confirmation to show that field
    if (showConfirmation && confirmationFieldIndexRef.current !== null && confirmationFieldIndexRef.current !== currentFieldIndex) {

      setShowConfirmation(false)
      setAgreedToTerms(false)
      confirmationFieldIndexRef.current = null
    }
  }, [currentFieldIndex, showConfirmation])
  
  // Save signature after completing (only if authenticated and in draw mode with a new signature)
  const saveSignatureToUser = useCallback(async (signatureDataUrl: string) => {
    if (!isAuthenticated) return
    try {
      await fetch('/api/user/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ signatureData: signatureDataUrl }),
      })
    } catch (err) {
      console.error('Failed to save signature:', err)
    }
  }, [isAuthenticated])
  
  // OTP countdown timer
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [otpCountdown])
  
  // Reset when field changes
  useEffect(() => {
    if (!currentField) return
    
    if (currentField.type === 'signature' || currentField.type === 'initials') {
      // If we have a saved signature, default to draw mode and pre-fill it
      if (savedSignature && currentField.type === 'signature') {
        setSignatureMode('draw')
        setHasDrawn(true) // Treat saved signature as already drawn
      } else {
        setSignatureMode('type')
      }
      setTypedSignature(currentField.type === 'initials' 
        ? signerName.split(' ').map(n => n[0] || '').join('').toUpperCase()
        : signerName)
      setUploadedImage(null)
    } else if (currentField.type === 'text' || currentField.type === 'name' || currentField.type === 'email') {
      const existing = fieldValues[currentField.id] || ''
      if (currentField.type === 'name' && !existing) setTextValue(signerName)
      else if (currentField.type === 'email' && !existing) setTextValue(signerEmail)
      else setTextValue(existing)
    } else if (currentField.type === 'date') {
      setDateValue(fieldValues[currentField.id] || '')
    } else if (currentField.type === 'phone') {
      setPhoneValue(fieldValues[currentField.id] || '')
      setPhoneVerified(!!fieldValues[currentField.id])
      setOtpStep('input')
      setOtpCode(['', '', '', '', '', ''])
      setOtpError('')
    }
  }, [currentField?.id, currentField?.type, signerName, signerEmail, fieldValues, savedSignature])
  
  // Close font dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowFontDropdown(false)
    if (showFontDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showFontDropdown])
  
  // Close country dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setShowCountryDropdown(false)
        setCountrySearch('')
      }
    }
    if (showCountryDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCountryDropdown])
  
  // Initialize signature pad
  useEffect(() => {
    if (canvasRef.current && signatureMode === 'draw' && (currentField?.type === 'signature' || currentField?.type === 'initials')) {
      const canvas = canvasRef.current
      // Use at least 2x scale for better quality signatures
      const ratio = Math.max(window.devicePixelRatio || 2, 2)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      canvas.getContext('2d')?.scale(ratio, ratio)
      
      // Fill canvas with white background first
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'rgb(255, 255, 255)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      
      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
      })
      
      signaturePadRef.current.addEventListener('endStroke', () => setHasDrawn(true))
      
      // Load saved signature into canvas if available (only for signature type, not initials)
      if (savedSignature && currentField?.type === 'signature') {

        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            // Clear and fill with white background
            ctx.fillStyle = 'rgb(255, 255, 255)'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            
            // Calculate scaling to fit the signature
            const scale = Math.min(
              (canvas.offsetWidth * 0.9) / img.width,
              (canvas.offsetHeight * 0.9) / img.height
            )
            const x = (canvas.offsetWidth - img.width * scale) / 2
            const y = (canvas.offsetHeight - img.height * scale) / 2
            
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
            setHasDrawn(true)

          }
        }
        img.onerror = (e) => {
          console.error('[SigningBanner] Failed to load saved signature:', e)
        }
        img.src = savedSignature
      }
    }
    
    return () => { signaturePadRef.current?.off() }
  }, [signatureMode, currentField?.type, savedSignature, hasStarted])
  
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
  
  // Send OTP for phone verification (inline)
  // Build full phone number with country code
  const getFullPhoneNumber = useCallback(() => {
    return phoneCountry + phoneValue
  }, [phoneCountry, phoneValue])
  
  const handleSendOTP = useCallback(async () => {
    if (phoneValue.length < 6) return
    
    setOtpSending(true)
    setOtpError('')
    
    const fullPhone = getFullPhoneNumber()
    
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: fullPhone,
          envelopeSlug,
          signerId,
          type: 'field',
        }),
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        setOtpStep('code')
        setOtpCountdown(60)
        // Auto-focus first OTP input
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100)
      } else {
        setOtpError(data.error || 'Erreur lors de l\'envoi')
      }
    } catch {
      setOtpError('Erreur de connexion')
    } finally {
      setOtpSending(false)
    }
  }, [phoneValue, phoneCountry, envelopeSlug, signerId, getFullPhoneNumber])
  
  // Handle OTP code input
  const handleOtpCodeChange = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const newCode = [...otpCode]
    newCode[index] = digit
    setOtpCode(newCode)
    setOtpError('')
    
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
    
    // Auto-verify when all digits entered
    if (digit && index === 5) {
      const fullCode = newCode.join('')
      if (fullCode.length === 6) {
        handleVerifyOTP(fullCode)
      }
    }
  }, [otpCode])
  
  // Handle OTP keydown for backspace
  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }, [otpCode])
  
  // Verify OTP code
  const handleVerifyOTP = useCallback(async (fullCode?: string) => {
    const codeToVerify = fullCode || otpCode.join('')
    if (codeToVerify.length !== 6) return
    
    setOtpVerifying(true)
    setOtpError('')
    
    const fullPhone = getFullPhoneNumber()
    
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: fullPhone,
          code: codeToVerify,
          envelopeSlug,
          signerId,
          type: 'field',
        }),
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        setPhoneVerified(true)
        if (currentField?.type === 'phone') {
          // Save full phone number with country code
          onValueChange(currentField.id, fullPhone)
        }
      } else {
        setOtpError(data.error || 'Code incorrect')
        setOtpCode(['', '', '', '', '', ''])
        otpInputRefs.current[0]?.focus()
      }
    } catch {
      setOtpError('Erreur de connexion')
    } finally {
      setOtpVerifying(false)
    }
  }, [otpCode, phoneValue, phoneCountry, envelopeSlug, signerId, currentField, onValueChange, getFullPhoneNumber])
  
  const handleNext = useCallback(() => {
    if (!currentField) return
    
    if (currentField.type === 'signature' || currentField.type === 'initials') {
      let signatureDataUrl: string | null = null
      
      if (signatureMode === 'draw' && signaturePadRef.current && hasDrawn) {
        // Create a new canvas with white background to ensure no transparency
        const originalCanvas = canvasRef.current
        if (originalCanvas) {
          const exportCanvas = document.createElement('canvas')
          exportCanvas.width = originalCanvas.width
          exportCanvas.height = originalCanvas.height
          const exportCtx = exportCanvas.getContext('2d')
          if (exportCtx) {
            // Fill with white background
            exportCtx.fillStyle = 'rgb(255, 255, 255)'
            exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
            // Draw the signature on top
            exportCtx.drawImage(originalCanvas, 0, 0)
            signatureDataUrl = exportCanvas.toDataURL('image/png')
          }
        }
        if (!signatureDataUrl) {
          signatureDataUrl = signaturePadRef.current.toDataURL('image/png')
        }
        onValueChange(currentField.id, signatureDataUrl)
        // Save signature for future use (only for signature type, not initials)
        if (currentField.type === 'signature' && isAuthenticated) {
          saveSignatureToUser(signatureDataUrl)
        }
      } else if (signatureMode === 'upload' && uploadedImage) {
        onValueChange(currentField.id, uploadedImage)
        // Save uploaded signature for future use
        if (currentField.type === 'signature' && isAuthenticated) {
          saveSignatureToUser(uploadedImage)
        }
      } else if (signatureMode === 'type' && typedSignature.trim()) {
        // Use high resolution canvas for better quality (3x scale)
        const scale = 3
        const baseWidth = 400
        const baseHeight = 120
        const canvas = document.createElement('canvas')
        canvas.width = baseWidth * scale
        canvas.height = baseHeight * scale
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.scale(scale, scale)
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, baseWidth, baseHeight)
          ctx.fillStyle = 'black'
          ctx.font = `italic 42px "${SIGNATURE_FONTS[selectedFont].name}", cursive`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(typedSignature, baseWidth / 2, baseHeight / 2)
          signatureDataUrl = canvas.toDataURL('image/png')
          onValueChange(currentField.id, signatureDataUrl)
          // Save typed signature for future use
          if (currentField.type === 'signature' && isAuthenticated) {
            saveSignatureToUser(signatureDataUrl)
          }
        }
      }
    } else if (currentField.type === 'checkbox') {
      // Checkbox value is already set when user clicks on it, don't toggle here
      // Just proceed to next field
    } else if (currentField.type === 'phone') {
      // Phone field requires OTP verification
      if (!phoneVerified && phoneValue.length >= 6) {
        if (otpStep === 'input') {
          // Send OTP
          handleSendOTP()
          return // Don't proceed, wait for code entry
        }
        return // Still waiting for verification
      }
      if (phoneVerified) {
        onValueChange(currentField.id, getFullPhoneNumber())
      }
    } else if (currentField.type === 'date' && dateValue) {
      onValueChange(currentField.id, new Date(dateValue).toLocaleDateString('fr-FR'))
    } else if (['text', 'name', 'email'].includes(currentField.type)) {
      onValueChange(currentField.id, textValue)
    }
    
    if (currentFieldIndex < totalFields - 1) {
      onFieldChange(currentFieldIndex + 1)
    }
  }, [currentField, signatureMode, hasDrawn, uploadedImage, typedSignature, selectedFont, dateValue, textValue, phoneValue, phoneVerified, fieldValues, currentFieldIndex, totalFields, onValueChange, onFieldChange, isAuthenticated, saveSignatureToUser, getFullPhoneNumber, handleSendOTP, otpStep])
  
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
    if (currentField.type === 'phone') {
      if (!currentField.required && !phoneValue) return true
      // Allow clicking "Suivant" to trigger OTP verification when phone is filled
      // The actual verification check happens in handleNext()
      return phoneValue.length >= 6
    }
    if (['text', 'name', 'email'].includes(currentField.type)) return !currentField.required || textValue.trim() !== ''
    return true
  }, [currentField, signatureMode, hasDrawn, uploadedImage, typedSignature, dateValue, textValue, phoneValue, phoneVerified, fieldValues])
  
  const getFieldLabel = (type: FieldType) => {
    const labelsFr: Record<string, string> = {
      signature: 'Signature', initials: 'Initiales', date: 'Date',
      text: 'Texte', checkbox: 'Case à cocher', name: 'Nom', email: 'Email',
      phone: 'Téléphone',
    }
    const labelsEn: Record<string, string> = {
      signature: 'Signature', initials: 'Initials', date: 'Date',
      text: 'Text', checkbox: 'Checkbox', name: 'Name', email: 'Email',
      phone: 'Phone',
    }
    const labels = locale === 'fr' ? labelsFr : labelsEn
    return labels[type] || type
  }
  
  if (!currentField) return null
  
  return (
    <div className="fixed bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-[calc(100%-0.5rem)] sm:max-w-md px-1 sm:px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-200"
      >
        {/* Welcome state */}
        {!hasStarted ? (
          <div className="p-4 sm:p-5 text-center">
            <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{locale === 'fr' ? 'Prêt à signer ?' : 'Ready to sign?'}</h3>
            <p className="text-gray-500 text-xs sm:text-sm mb-3 sm:mb-4">{totalFields} {locale === 'fr' ? (totalFields > 1 ? 'champs à remplir' : 'champ à remplir') : (totalFields > 1 ? 'fields to fill' : 'field to fill')}</p>
            <button
              onClick={() => setHasStarted(true)}
              className="w-full py-2 sm:py-2.5 bg-[#08CF65] hover:bg-[#06B557] text-white font-medium rounded-xl transition-colors text-sm sm:text-base"
            >
              {locale === 'fr' ? 'Commencer →' : 'Start →'}
            </button>
          </div>
        ) : showConfirmation ? (
          <>
            {/* Confirmation step - styled like a field */}
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-900">{locale === 'fr' ? 'Confirmation' : 'Confirmation'}</span>
              <span className="text-xs text-gray-400">{locale === 'fr' ? 'Dernière étape' : 'Last step'}</span>
            </div>
            
            {/* Content */}
            <div className="px-4 py-4">
              <p className="text-sm text-gray-700 mb-4 text-center">
                {t('signing.confirmSignature')}
              </p>
              
              {/* Styled checkbox like Drime/Transfr login */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <button
                  type="button"
                  onClick={() => setAgreedToTerms(!agreedToTerms)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                    agreedToTerms 
                      ? 'bg-[#08CF65] border-[#08CF65]' 
                      : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {agreedToTerms && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span className="text-sm text-gray-600 leading-tight">
                  {t('signing.agreeToTerms')}{' '}
                  <a href="https://drime.cloud/terms-of-services" target="_blank" rel="noopener noreferrer" className="text-[#08CF65] hover:underline">
                    {t('signing.termsOfService')}
                  </a>
                  {' '}{locale === 'fr' ? 'et la' : 'and'}{' '}
                  <a href="https://drime.cloud/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#08CF65] hover:underline">
                    {t('signing.privacyPolicy')}
                  </a>
                </span>
              </label>
            </div>
            
            {/* Navigation */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-t border-gray-100">
              <button
                onClick={() => { setShowConfirmation(false); setAgreedToTerms(false) }}
                className="text-xs sm:text-sm text-gray-500 hover:text-gray-700"
              >
                ← {t('common.back')}
              </button>
              
              <button
                onClick={() => { if (agreedToTerms) onComplete() }}
                disabled={!agreedToTerms || isCompleting}
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#08CF65] text-white text-xs sm:text-sm font-medium disabled:opacity-50 hover:bg-[#06B557] transition-colors disabled:cursor-not-allowed"
              >
                {isCompleting ? (
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {locale === 'fr' ? 'Signature...' : 'Signing...'}
                  </span>
                ) : (
                  `${t('common.confirm')} →`
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="px-3 sm:px-4 pt-2 sm:pt-3 pb-2 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                <span className="font-medium text-gray-900 text-sm sm:text-base truncate">
                  {currentField.label || getFieldLabel(currentField.type)}
                </span>
                {currentField.required && <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">({locale === 'fr' ? 'requis' : 'required'})</span>}
                {!currentField.required && <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">({locale === 'fr' ? 'optionnel' : 'optional'})</span>}
              </div>
              <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">{currentFieldIndex + 1} / {totalFields}</span>
            </div>
            
            {/* Content */}
            <div className="px-3 sm:px-4 py-2 sm:py-3">
              {/* Signature / Initials */}
              {(currentField.type === 'signature' || currentField.type === 'initials') && (
                <div>
                  {signatureMode === 'type' ? (
                    <div 
                      className="relative bg-gray-50 rounded-xl border-2 border-[#08CF65] h-20 sm:h-24 flex items-center justify-center cursor-text mb-2 sm:mb-3"
                      onClick={() => inputRef.current?.focus()}
                    >
                      <input
                        ref={inputRef}
                        type="text"
                        value={typedSignature}
                        onChange={(e) => setTypedSignature(e.target.value)}
                        placeholder={locale === 'fr' ? 'Tapez ici...' : 'Type here...'}
                        className="absolute inset-0 w-full h-full text-center text-3xl bg-transparent border-none outline-none italic text-gray-900 placeholder-gray-400"
                        style={{ fontFamily: `"${SIGNATURE_FONTS[selectedFont].name}", cursive` }}
                        autoFocus
                      />
                    </div>
                  ) : signatureMode === 'draw' ? (
                    <div className="relative mb-3">
                      <canvas
                        ref={canvasRef}
                        className="w-full h-20 sm:h-24 bg-gray-50 rounded-xl border-2 border-[#08CF65] cursor-crosshair"
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
                    <div className="mb-2 sm:mb-3">
                      {uploadedImage ? (
                        <div className="relative bg-gray-50 rounded-xl border-2 border-[#08CF65] h-20 sm:h-24 flex items-center justify-center">
                          <img src={uploadedImage} alt="Signature" className="max-h-16 sm:max-h-20 max-w-full object-contain" />
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
                        <label className="block bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 h-20 sm:h-24 flex items-center justify-center cursor-pointer hover:border-[#08CF65] transition-colors">
                          <div className="text-center">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs sm:text-sm text-gray-500">{locale === 'fr' ? 'Cliquez pour uploader' : 'Click to upload'}</span>
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
                        <span className="text-gray-500 text-xs">{locale === 'fr' ? 'Police:' : 'Font:'}</span>
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
                        className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-colors ${
                          signatureMode === 'type' ? 'bg-[#08CF65] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {t('signing.typeSignature')}
                      </button>
                      <button
                        onClick={() => setSignatureMode('draw')}
                        className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-colors ${
                          signatureMode === 'draw' ? 'bg-[#08CF65] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {t('signing.drawSignature')}
                      </button>
                      <button
                        onClick={() => setSignatureMode('upload')}
                        className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-colors ${
                          signatureMode === 'upload' ? 'bg-[#08CF65] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {t('signing.uploadSignature')}
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
                    {locale === 'fr' ? `Cliquez pour ${fieldValues[currentField.id] === 'true' ? 'décocher' : 'cocher'}` : `Click to ${fieldValues[currentField.id] === 'true' ? 'uncheck' : 'check'}`}
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
                    {locale === 'fr' ? "Aujourd'hui" : 'Today'}
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
                    currentField.type === 'name' ? (locale === 'fr' ? 'Votre nom complet' : 'Your full name') :
                    currentField.type === 'email' ? (locale === 'fr' ? 'votre@email.com' : 'your@email.com') : (locale === 'fr' ? 'Tapez ici...' : 'Type here...')
                  }
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border-2 border-[#08CF65] text-gray-900 focus:outline-none"
                  autoFocus
                />
              )}
              
              {/* Phone field with inline OTP verification */}
              {currentField.type === 'phone' && (
                <div className="space-y-3">
                  {otpStep === 'input' && !phoneVerified ? (
                    <>
                      {/* Phone number input with country selector */}
                      <div className="flex gap-2 w-full">
                        {/* Country dropdown */}
                        <div className="relative flex-shrink-0" ref={countryDropdownRef}>
                          <button
                            type="button"
                            onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                            className="flex items-center gap-1 px-2 py-2 rounded-xl bg-gray-50 border-2 border-gray-200 hover:border-gray-300 transition-colors"
                          >
                            <span className="text-base">{COUNTRIES.find(c => c.dial === phoneCountry)?.flag || '🌍'}</span>
                            <span className="text-sm text-gray-600">{phoneCountry}</span>
                            <svg className={`w-3 h-3 text-gray-400 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          {showCountryDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="absolute bottom-full left-0 mb-1 w-56 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden"
                            >
                              <div className="p-2 border-b border-gray-100">
                                <div className="relative">
                                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                  <input
                                    type="text"
                                    value={countrySearch}
                                    onChange={(e) => setCountrySearch(e.target.value)}
                                    placeholder="Rechercher..."
                                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none"
                                    autoFocus
                                  />
                                </div>
                              </div>
                              <div className="max-h-40 overflow-y-auto">
                                {COUNTRIES.filter(c => 
                                  c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                  c.dial.includes(countrySearch)
                                ).map((country) => (
                                  <button
                                    key={country.code}
                                    type="button"
                                    onClick={() => {
                                      setPhoneCountry(country.dial)
                                      setShowCountryDropdown(false)
                                      setCountrySearch('')
                                      setPhoneValue('') // Reset phone when changing country
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                                      country.dial === phoneCountry ? 'bg-[#08CF65]/5 text-[#08CF65]' : 'text-gray-700'
                                    }`}
                                  >
                                    <span className="text-lg">{country.flag}</span>
                                    <span className="flex-1 text-left truncate">{country.name}</span>
                                    <span className="text-gray-400 text-xs">{country.dial}</span>
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </div>
                        
                        {/* Phone input */}
                        <input
                          type="tel"
                          value={phoneValue}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '').slice(0, 15)
                            setPhoneValue(raw)
                            setPhoneVerified(false)
                          }}
                          placeholder={getPhonePlaceholder(phoneCountry)}
                          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-gray-50 border-2 border-gray-200 focus:border-[#08CF65] text-gray-900 focus:outline-none text-sm"
                          autoFocus
                        />
                      </div>
                      {otpError && (
                        <p className="text-xs text-red-500">{otpError}</p>
                      )}
                      {phoneValue.length >= 6 && (
                        <p className="text-xs text-gray-500">
                          {locale === 'fr' ? 'Cliquez sur Vérifier pour recevoir un code SMS' : 'Click Verify to receive an SMS code'}
                        </p>
                      )}
                    </>
                  ) : otpStep === 'code' && !phoneVerified ? (
                    <>
                      {/* OTP code input inline */}
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-3">
                          {locale === 'fr' ? 'Code envoyé au' : 'Code sent to'} <span className="font-medium">{phoneCountry}***{phoneValue.slice(-4)}</span>
                        </p>
                        <div className="flex justify-center gap-1.5 sm:gap-2">
                          {otpCode.map((digit, index) => (
                            <input
                              key={index}
                              ref={el => { otpInputRefs.current[index] = el }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={e => handleOtpCodeChange(index, e.target.value)}
                              onKeyDown={e => handleOtpKeyDown(index, e)}
                              className="w-8 h-10 sm:w-10 sm:h-12 text-center text-lg sm:text-xl font-semibold rounded-lg sm:rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:border-[#08CF65] outline-none transition-all"
                            />
                          ))}
                        </div>
                        {otpError && (
                          <p className="text-xs text-red-500 mt-2">{otpError}</p>
                        )}
                        <button
                          onClick={() => {
                            if (otpCountdown > 0) return
                            setOtpCode(['', '', '', '', '', ''])
                            handleSendOTP()
                          }}
                          disabled={otpCountdown > 0}
                          className="text-xs text-gray-500 hover:text-[#08CF65] mt-3 disabled:text-gray-300"
                        >
                          {otpCountdown > 0 ? `Renvoyer dans ${otpCountdown}s` : 'Renvoyer le code'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Phone verified */}
                      <div className="flex gap-2">
                        <div className="flex items-center gap-1 px-2 py-2 rounded-xl bg-gray-50 border-2 border-[#08CF65] min-w-[80px]">
                          <span className="text-lg">{COUNTRIES.find(c => c.dial === phoneCountry)?.flag || '🌍'}</span>
                          <span className="text-sm text-gray-600">{phoneCountry}</span>
                        </div>
                        <div className="relative flex-1">
                          <input
                            type="tel"
                            value={phoneValue}
                            className="w-full px-3 py-2 pr-10 rounded-xl bg-gray-50 border-2 border-[#08CF65] text-gray-900 focus:outline-none"
                            disabled
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2">
                            <svg className="w-5 h-5 text-[#08CF65]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-[#08CF65] flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Numéro vérifié par SMS
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Progress bar */}
            <div className="px-3 sm:px-4 pb-1.5 sm:pb-2">
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
            <div className="px-3 sm:px-4 pb-2 sm:pb-3 flex items-center justify-between">
              <button
                onClick={handleBack}
                disabled={currentFieldIndex === 0}
                className="px-3 sm:px-4 py-2 sm:py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
              >
                <span className="hidden sm:inline">{locale === 'fr' ? '← Précédent' : '← Previous'}</span>
                <span className="sm:hidden">←</span>
              </button>
              
              {/* Progress dots - hidden on very small screens, show fewer */}
              <div className="hidden xs:flex gap-1">
                {fields.map((f, i) => {
                  const isFilled = f.type === 'checkbox' 
                    ? fieldValues[f.id] === 'true'
                    : fieldValues[f.id] && fieldValues[f.id].trim() !== ''
                  
                  return (
                    <button
                      key={f.id}
                      onClick={() => onFieldChange(i)}
                      className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all ${
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
              
              {isLastField && (currentField.type !== 'phone' || phoneVerified) ? (
                <button
                  onClick={() => { 
                    handleNext(); 
                    setShowConfirmation(true);
                    confirmationFieldIndexRef.current = currentFieldIndex; // Track which field triggered confirmation
                  }}
                  disabled={!isValid() || isCompleting}
                  className="px-4 py-2 rounded-xl bg-[#08CF65] text-white text-sm font-medium disabled:opacity-50 hover:bg-[#06B557] transition-colors"
                >
                  {isCompleting ? '...' : (locale === 'fr' ? 'Finaliser →' : 'Finalize →')}
                </button>
              ) : (
                <button
                  onClick={currentField.type === 'phone' && otpStep === 'code' && !phoneVerified ? () => handleVerifyOTP() : handleNext}
                  disabled={
                    (currentField.required && !isValid()) || 
                    otpSending || 
                    otpVerifying ||
                    (currentField.type === 'phone' && otpStep === 'code' && otpCode.join('').length !== 6)
                  }
                  className="px-4 py-2 rounded-xl bg-[#08CF65] text-white text-sm font-medium disabled:opacity-50 hover:bg-[#06B557] transition-colors"
                >
                  {otpSending ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Envoi...
                    </span>
                  ) : otpVerifying ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Vérif...
                    </span>
                  ) : currentField.type === 'phone' && !phoneVerified ? (
                    otpStep === 'code' ? 'Valider →' : 'Vérifier →'
                  ) : (
                    `${t('common.next')} →`
                  )}
                </button>
              )}
            </div>
          </>
        )}
        
      </motion.div>
    </div>
  )
}
