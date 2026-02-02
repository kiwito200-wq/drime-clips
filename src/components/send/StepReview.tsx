'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import CustomDatePicker from '@/components/CustomDatePicker'
import { SecureThumbnail } from '@/components/SecureThumbnail'
import { useTranslation } from '@/lib/i18n/I18nContext'

interface Signer {
  id: string
  name: string
  email: string
  color: string
}

interface SignField {
  id: string
  type: 'signature' | 'initials' | 'date' | 'text' | 'checkbox' | 'name' | 'email'
  signerId: string
  page: number
  x: number
  y: number
  width: number
  height: number
  required: boolean
  label: string
}

interface DocumentData {
  file: File | null
  name: string
  pdfUrl: string | null
  envelopeId: string | null
  slug: string | null
  thumbnailUrl?: string | null
}

interface SendSettings {
  dueDate: string | null
  reminderEnabled: boolean
  reminderInterval: string
}

interface StepReviewProps {
  document: DocumentData
  signers: Signer[]
  fields: SignField[]
  onBack: () => void
  onSend: (message?: string, settings?: SendSettings) => void
  isLoading: boolean
  isTemplateMode?: boolean
  onSaveTemplate?: () => void
}

const REMINDER_OPTIONS = [
  { value: '1_day', label: 'Tous les jours' },
  { value: '2_days', label: 'Tous les 2 jours' },
  { value: '3_days', label: 'Tous les 3 jours' },
  { value: '7_days', label: 'Toutes les semaines' },
]

// Settings Icon
const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19.5 6.99l.58 1.01v.01c.49.85.2 1.94-.63 2.43-.27.16-.5.38-.65.66l-.01.02c-.49.85-.19 1.94.63 2.43l.02.01c.85.5 1.13 1.59.64 2.43l-.62 1.03c-.49.85-1.59 1.14-2.44.67-.26-.15-.56-.23-.86-.24h-.02c-.98.01-1.77.8-1.77 1.78c-.01.99-.81 1.79-1.79 1.79h-1.17c-.99 0-1.79-.8-1.79-1.79-.01-.3-.09-.6-.24-.87l-.01-.02c-.49-.85-1.58-1.14-2.43-.65l-.01.01c-.87.48-1.96.16-2.44-.69l-.59-1.02-.01-.01c-.49-.85-.19-1.94.63-2.43.55-.32.9-.91.9-1.55s-.34-1.23-.9-1.55c-.85-.49-1.14-1.59-.63-2.43l.63-1.03c.49-.85 1.59-1.15 2.44-.67.26.15.56.23.86.24c.98 0 1.78-.79 1.79-1.77v-.01c0-.98.8-1.78 1.78-1.78h1.17c.02 0 .04 0 .06.01.99.03 1.76.86 1.74 1.85 0 .3.08.6.24.86l.01.01c.5.85 1.59 1.13 2.44.62.86-.49 1.97-.15 2.44.66z" />
    <path d="M14.47 12a2.47 2.47 0 1 1-4.94 0 2.47 2.47 0 0 1 4.94 0z" />
  </svg>
)

// Calendar Icon
const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3.09" y1="9.4" x2="20.92" y2="9.4" />
    <line x1="16.44" y1="13.31" x2="16.45" y2="13.31" />
    <line x1="12" y1="13.31" x2="12.01" y2="13.31" />
    <line x1="7.56" y1="13.31" x2="7.57" y2="13.31" />
    <line x1="16.44" y1="17.2" x2="16.45" y2="17.2" />
    <line x1="12" y1="17.2" x2="12.01" y2="17.2" />
    <line x1="7.56" y1="17.2" x2="7.57" y2="17.2" />
    <line x1="16.04" y1="2" x2="16.04" y2="5.29" />
    <line x1="7.97" y1="2" x2="7.97" y2="5.29" />
    <path d="M16.24,3.58H7.77C4.83,3.58,3,5.21,3,8.22V15.27C3,18.33,4.83,20,7.77,20H16.23C19.17,20,21,18.35,21,15.35V8.22C21.01,5.21,19.18,3.58,16.24,3.58Z" />
  </svg>
)

// Notification/Reminder Icon
const ReminderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 17.85c5.64 0 8.25-.72 8.5-3.63 0-2.9-1.82-2.71-1.82-6.28C18.68 5.16 16.04 2 12 2S5.32 5.16 5.32 7.94c0 3.57-1.82 3.38-1.82 6.28.25 2.91 2.86 3.63 8.5 3.63z" />
    <path d="M14.39 20.86c-1.36 1.51-3.49 1.53-4.87 0" />
  </svg>
)

// Email Icon
const EmailIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15.0944C21 17.8596 19.1552 20.1072 16.4183 20.1004H7.58173C4.84476 20.1072 3 17.8596 3 15.0944V8.91315C3 6.15088 4.84476 3.90039 7.58173 3.90039H16.4183C19.1552 3.90039 21 6.15088 21 8.91315V15.0944Z" />
    <path d="M20.5874 6.87988L14.1182 12.1402C12.8999 13.1082 11.1732 13.1082 9.95494 12.1402L3.43066 6.87988" />
  </svg>
)

export default function StepReview({
  document,
  signers,
  fields,
  onBack,
  onSend,
  isLoading,
  isTemplateMode = false,
  onSaveTemplate,
}: StepReviewProps) {
  const { locale } = useTranslation()
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [isEmailExpanded, setIsEmailExpanded] = useState(false)
  
  // Settings
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(true)
  const [dueDate, setDueDate] = useState<string>('')
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderInterval, setReminderInterval] = useState('3_days')
  const [isReminderDropdownOpen, setIsReminderDropdownOpen] = useState(false)
  const [reminderDropdownPosition, setReminderDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const [mounted, setMounted] = useState(false)
  const reminderDropdownRef = useRef<HTMLDivElement>(null)
  const reminderButtonRef = useRef<HTMLButtonElement>(null)
  
  // Initialize email subject based on locale and document name
  useEffect(() => {
    if (!emailSubject) {
      setEmailSubject(locale === 'fr' 
        ? `Vous avez été invité à signer ${document.name}`
        : `You have been invited to sign ${document.name}`)
    }
  }, [locale, document.name, emailSubject])
  
  // Wait for client-side mount for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isReminderDropdownOpen && reminderButtonRef.current) {
      const rect = reminderButtonRef.current.getBoundingClientRect()
      setReminderDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }, [isReminderDropdownOpen])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (reminderDropdownRef.current && !reminderDropdownRef.current.contains(event.target as Node) &&
          reminderButtonRef.current && !reminderButtonRef.current.contains(event.target as Node)) {
        setIsReminderDropdownOpen(false)
      }
    }
    window.document.addEventListener('mousedown', handleClickOutside)
    return () => window.document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Format due date
  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date)
  }

  // Get initials from name/email
  const getInitials = (name: string, email: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ')
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
      }
      return name.slice(0, 2).toUpperCase()
    }
    return email.slice(0, 2).toUpperCase()
  }

  // Get min date (today)
  const getMinDate = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  // Handle send
  const handleSend = () => {
    onSend(emailMessage || undefined, {
      dueDate: dueDate || null,
      reminderEnabled,
      reminderInterval,
    })
  }


  const selectedReminderOption = REMINDER_OPTIONS.find(o => o.value === reminderInterval) || REMINDER_OPTIONS[2]

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Agreement info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-200 p-5 mb-4"
      >
        <h2 className="text-sm font-medium text-gray-500 mb-4">Informations</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Thumbnail - SECURITY: Use SecureThumbnail for authenticated access */}
            <div className="w-12 h-14 bg-gray-100 rounded border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
              {document.slug ? (
                <SecureThumbnail 
                  slug={document.slug} 
                  alt={document.name}
                  className="w-full h-full object-cover"
                  fallbackClassName="w-6 h-6 text-gray-400"
                />
              ) : (
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{document.name}</p>
              <p className="text-sm text-gray-500">
                {document.file ? formatFileSize(document.file.size) : 'PDF'}
              </p>
            </div>
          </div>
          {dueDate && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Date limite</p>
              <p className="font-medium text-gray-900 text-sm">{formatDueDate(dueDate)}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Settings: Due date & Reminders */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden"
      >
        <button
          onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
          className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 text-gray-500">
            <SettingsIcon />
            <h2 className="text-sm font-medium text-gray-900">Paramètres</h2>
          </div>
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${isSettingsExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <AnimatePresence>
          {isSettingsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-visible"
            >
              <div className="px-5 pb-5 space-y-5">
                {/* Due date */}
                <div className="relative">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <span className="text-gray-400"><CalendarIcon /></span>
                    Date limite de signature
                  </label>
                  <CustomDatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    min={getMinDate()}
                    language="fr"
                    placeholder="Sélectionner une date limite"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    {dueDate 
                      ? `Le document expirera le ${formatDueDate(dueDate)}`
                      : 'Optionnel - Sans date limite, le document restera valide indéfiniment'
                    }
                  </p>
                </div>

                {/* Reminders */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <span className="text-gray-400"><ReminderIcon /></span>
                      Rappels automatiques
                    </label>
                    <button
                      onClick={() => setReminderEnabled(!reminderEnabled)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        reminderEnabled ? 'bg-[#08CF65]' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          reminderEnabled ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                  
                  {reminderEnabled && (
                    <div className="ml-6">
                      {/* Custom dropdown */}
                      <div className="relative">
                        <button
                          ref={reminderButtonRef}
                          type="button"
                          onClick={() => setIsReminderDropdownOpen(!isReminderDropdownOpen)}
                          className={`w-full px-4 py-2.5 border rounded-lg text-sm text-left flex items-center justify-between transition-all ${
                            isReminderDropdownOpen 
                              ? 'border-[#08CF65] ring-2 ring-[#08CF65]/20' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="text-gray-900">{selectedReminderOption.label}</span>
                          <svg 
                            className={`w-4 h-4 text-gray-400 transition-transform ${isReminderDropdownOpen ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {/* Dropdown rendered via portal */}
                        {mounted && createPortal(
                          <AnimatePresence>
                            {isReminderDropdownOpen && (
                              <motion.div
                                ref={reminderDropdownRef}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.15 }}
                                style={{
                                  position: 'fixed',
                                  top: reminderDropdownPosition.top,
                                  left: reminderDropdownPosition.left,
                                  width: reminderDropdownPosition.width,
                                  zIndex: 99999,
                                }}
                                className="bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden"
                              >
                                {REMINDER_OPTIONS.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                      setReminderInterval(option.value)
                                      setIsReminderDropdownOpen(false)
                                    }}
                                    className={`w-full px-4 py-2.5 text-sm text-left transition-colors ${
                                      option.value === reminderInterval
                                        ? 'bg-[#08CF65]/10 text-[#08CF65] font-medium'
                                        : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>,
                          window.document.body
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">
                        Un email de rappel sera envoyé aux signataires qui n&apos;ont pas encore signé
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Custom email */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden"
      >
        <button
          onClick={() => setIsEmailExpanded(!isEmailExpanded)}
          className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-gray-400"><EmailIcon /></span>
            <h2 className="text-sm font-medium text-gray-900">Email personnalisé</h2>
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">
              Optionnel
            </span>
          </div>
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${isEmailExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <AnimatePresence>
          {isEmailExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-gray-500">Objet de l&apos;email</label>
                    <span className="text-xs text-gray-400">{emailSubject.length}/350</span>
                  </div>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value.slice(0, 350))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#08CF65]/20 focus:border-[#08CF65] outline-none transition-all text-gray-900"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-gray-500">Message</label>
                    <span className="text-xs text-gray-400">{emailMessage.length}/2000</span>
                  </div>
                  <textarea
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value.slice(0, 2000))}
                    placeholder="Ajoutez un message personnalisé..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#08CF65]/20 focus:border-[#08CF65] outline-none resize-none transition-all text-gray-900 placeholder:text-gray-400"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* List of recipients */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-xl border border-gray-200 p-5 mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-500">Liste des destinataires</h2>
          <span className="text-xs text-gray-400">{signers.length} signataire{signers.length > 1 ? 's' : ''}</span>
        </div>

        <div className="space-y-2">
          {signers.map((signer, index) => (
            <div
              key={signer.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                style={{ backgroundColor: signer.color }}
              >
                {getInitials(signer.name, signer.email)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">
                  {signer.name || signer.email}
                </p>
                {signer.name && (
                  <p className="text-xs text-gray-500 truncate">{signer.email}</p>
                )}
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">
                Signataire {index + 1}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Navigation buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-center gap-4"
      >
        <button
          onClick={onBack}
          className="px-8 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors min-w-[140px]"
        >
          {locale === 'fr' ? 'Retour' : 'Back'}
        </button>
        <button
          onClick={handleSend}
          disabled={isLoading}
          className="px-8 py-3 bg-[#08CF65] text-white rounded-xl font-medium hover:bg-[#07b858] transition-colors min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Envoi...
            </>
          ) : (
            'Envoyer'
          )}
        </button>
      </motion.div>

    </div>
  )
}
