'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface OTPVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  onVerified: (phone: string) => void
  phone?: string // Pre-filled phone for 2FA mode
  envelopeSlug?: string
  signerId?: string
  type: 'field' | '2fa'
  title?: string
  subtitle?: string
}

export default function OTPVerificationModal({
  isOpen,
  onClose,
  onVerified,
  phone: initialPhone = '',
  envelopeSlug,
  signerId,
  type,
  title = 'Vérification du téléphone',
  subtitle = 'Entrez votre numéro pour recevoir un code de vérification',
}: OTPVerificationModalProps) {
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState(initialPhone)
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [maskedPhone, setMaskedPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([])
  
  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (initialPhone) {
        setPhone(initialPhone)
        setStep('phone')
      } else {
        setPhone('')
        setStep('phone')
      }
      setCode(['', '', '', '', '', ''])
      setError('')
      setCountdown(0)
    }
  }, [isOpen, initialPhone])
  
  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])
  
  // Auto-focus first code input when moving to code step
  useEffect(() => {
    if (step === 'code' && codeInputRefs.current[0]) {
      codeInputRefs.current[0].focus()
    }
  }, [step])
  
  const formatPhoneDisplay = (value: string) => {
    // Format as user types: 06 12 34 56 78
    const cleaned = value.replace(/\D/g, '')
    const match = cleaned.match(/^(\d{0,2})(\d{0,2})(\d{0,2})(\d{0,2})(\d{0,2})$/)
    if (match) {
      return [match[1], match[2], match[3], match[4], match[5]].filter(Boolean).join(' ')
    }
    return value
  }
  
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhone(raw)
    setError('')
  }
  
  const handleSendCode = async () => {
    if (!phone || phone.length < 10) {
      setError('Veuillez entrer un numéro de téléphone valide')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.startsWith('0') ? phone : '0' + phone,
          envelopeSlug,
          signerId,
          type,
        }),
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        setMaskedPhone(data.maskedPhone)
        setStep('code')
        setCountdown(60)
      } else {
        setError(data.error || 'Erreur lors de l\'envoi du code')
      }
    } catch {
      setError('Erreur de connexion. Réessayez.')
    } finally {
      setLoading(false)
    }
  }
  
  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    
    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)
    setError('')
    
    // Auto-focus next input
    if (digit && index < 5) {
      codeInputRefs.current[index + 1]?.focus()
    }
    
    // Auto-submit when all digits entered
    if (digit && index === 5) {
      const fullCode = newCode.join('')
      if (fullCode.length === 6) {
        handleVerifyCode(fullCode)
      }
    }
  }
  
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus()
    }
  }
  
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newCode = [...code]
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i]
    }
    setCode(newCode)
    
    if (pasted.length === 6) {
      handleVerifyCode(pasted)
    } else {
      codeInputRefs.current[pasted.length]?.focus()
    }
  }
  
  const handleVerifyCode = useCallback(async (fullCode?: string) => {
    const codeToVerify = fullCode || code.join('')
    
    if (codeToVerify.length !== 6) {
      setError('Veuillez entrer le code complet')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.startsWith('0') ? phone : '0' + phone,
          code: codeToVerify,
          envelopeSlug,
          signerId,
          type,
        }),
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        onVerified(phone.startsWith('0') ? phone : '0' + phone)
        onClose()
      } else {
        setError(data.error || 'Code incorrect')
        setCode(['', '', '', '', '', ''])
        codeInputRefs.current[0]?.focus()
      }
    } catch {
      setError('Erreur de connexion. Réessayez.')
    } finally {
      setLoading(false)
    }
  }, [code, phone, envelopeSlug, signerId, type, onVerified, onClose])
  
  const handleResend = () => {
    if (countdown > 0) return
    setCode(['', '', '', '', '', ''])
    handleSendCode()
  }
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-[20px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {step === 'phone' ? subtitle : `Code envoyé au ${maskedPhone}`}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {step === 'phone' ? (
                <div className="space-y-4">
                  {/* Phone icon */}
                  <div className="w-16 h-16 mx-auto bg-[#08CF65]/10 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#08CF65]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14.3527 3H9.64729C7.98076 3 6.62305 4.35779 6.62305 6.02431V17.9758C6.62305 19.6423 7.98084 21.0001 9.64736 21.0001H14.3528C16.0193 21.0001 17.377 19.6424 17.377 17.9758V6.02431C17.3769 4.35771 16.0192 3 14.3527 3Z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10.8008 5.14062H13.199" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Numéro de téléphone
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">+33</span>
                      <input
                        type="tel"
                        value={formatPhoneDisplay(phone)}
                        onChange={handlePhoneChange}
                        placeholder="06 12 34 56 78"
                        className="w-full pl-14 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#08CF65] focus:ring-2 focus:ring-[#08CF65]/20 outline-none transition-all text-lg"
                        autoFocus
                      />
                    </div>
                  </div>
                  
                  {error && (
                    <p className="text-red-500 text-sm text-center">{error}</p>
                  )}
                  
                  <button
                    onClick={handleSendCode}
                    disabled={loading || phone.length < 10}
                    className="w-full py-3 bg-[#08CF65] hover:bg-[#06B557] disabled:bg-gray-300 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                        Envoyer le code
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Code icon */}
                  <div className="w-16 h-16 mx-auto bg-[#08CF65]/10 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#08CF65]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                    </svg>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                      Entrez le code à 6 chiffres
                    </label>
                    <div className="flex justify-center gap-2" onPaste={handlePaste}>
                      {code.map((digit, index) => (
                        <input
                          key={index}
                          ref={el => { codeInputRefs.current[index] = el }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={e => handleCodeChange(index, e.target.value)}
                          onKeyDown={e => handleKeyDown(index, e)}
                          className="w-12 h-14 text-center text-2xl font-semibold rounded-xl border border-gray-200 focus:border-[#08CF65] focus:ring-2 focus:ring-[#08CF65]/20 outline-none transition-all"
                        />
                      ))}
                    </div>
                  </div>
                  
                  {error && (
                    <p className="text-red-500 text-sm text-center">{error}</p>
                  )}
                  
                  <button
                    onClick={() => handleVerifyCode()}
                    disabled={loading || code.join('').length !== 6}
                    className="w-full py-3 bg-[#08CF65] hover:bg-[#06B557] disabled:bg-gray-300 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Vérification...
                      </>
                    ) : (
                      'Vérifier'
                    )}
                  </button>
                  
                  {/* Resend button */}
                  <div className="text-center">
                    <button
                      onClick={handleResend}
                      disabled={countdown > 0}
                      className="text-sm text-gray-500 hover:text-gray-700 disabled:text-gray-400 transition-colors"
                    >
                      {countdown > 0 
                        ? `Renvoyer le code dans ${countdown}s` 
                        : 'Renvoyer le code'
                      }
                    </button>
                  </div>
                  
                  {/* Back button */}
                  <button
                    onClick={() => { setStep('phone'); setError('') }}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    ← Modifier le numéro
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
