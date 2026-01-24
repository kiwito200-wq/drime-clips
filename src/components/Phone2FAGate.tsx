'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

interface Phone2FAGateProps {
  envelopeSlug: string
  signerEmail: string
  signerName: string
  phone: string // Phone number set by admin
  onVerified: () => void
  documentName?: string
}

export default function Phone2FAGate({
  envelopeSlug,
  signerEmail,
  signerName,
  phone,
  onVerified,
  documentName,
}: Phone2FAGateProps) {
  const [step, setStep] = useState<'intro' | 'code'>('intro')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [maskedPhone, setMaskedPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([])
  
  // Mask phone number
  useEffect(() => {
    if (phone) {
      const cleaned = phone.replace(/\D/g, '')
      setMaskedPhone('***' + cleaned.slice(-4))
    }
  }, [phone])
  
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
  
  const handleSendCode = async () => {
    setLoading(true)
    setError('')
    
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          envelopeSlug,
          signerId: signerEmail,
          type: '2fa',
        }),
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
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
          phone,
          code: codeToVerify,
          envelopeSlug,
          signerId: signerEmail,
          type: '2fa',
        }),
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        onVerified()
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
  }, [code, phone, envelopeSlug, signerEmail, onVerified])
  
  const handleResend = () => {
    if (countdown > 0) return
    setCode(['', '', '', '', '', ''])
    handleSendCode()
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[20px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.15)] w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-[#08CF65]/5 to-transparent">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-[#08CF65] rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Vérification requise</h1>
              <p className="text-sm text-gray-500">Authentification à deux facteurs</p>
            </div>
          </div>
          
          {documentName && (
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Document</p>
              <p className="text-sm font-medium text-gray-900 truncate">{documentName}</p>
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-6">
          {step === 'intro' ? (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-gray-600 mb-2">
                  Bonjour <span className="font-medium">{signerName || signerEmail}</span>,
                </p>
                <p className="text-gray-500 text-sm">
                  Pour accéder à ce document, veuillez vérifier votre identité via le numéro de téléphone associé à votre compte.
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                  <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14.3527 3H9.64729C7.98076 3 6.62305 4.35779 6.62305 6.02431V17.9758C6.62305 19.6423 7.98084 21.0001 9.64736 21.0001H14.3528C16.0193 21.0001 17.377 19.6424 17.377 17.9758V6.02431C17.3769 4.35771 16.0192 3 14.3527 3Z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10.8008 5.14062H13.199" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Numéro de vérification</p>
                  <p className="font-medium text-gray-900">{maskedPhone}</p>
                </div>
              </div>
              
              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}
              
              <button
                onClick={handleSendCode}
                disabled={loading}
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
                    Envoyer le code de vérification
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto bg-[#08CF65]/10 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-[#08CF65]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                </div>
                <p className="text-gray-600 mb-1">Code envoyé au <span className="font-medium">{maskedPhone}</span></p>
                <p className="text-gray-500 text-sm">Entrez le code à 6 chiffres reçu par SMS</p>
              </div>
              
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
                  'Accéder au document'
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
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 pb-6">
          <p className="text-xs text-gray-400 text-center">
            🔒 Vos données sont protégées et sécurisées
          </p>
        </div>
      </motion.div>
    </div>
  )
}
