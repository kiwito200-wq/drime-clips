'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

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
  dueDate: string | null // ISO string
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
}

const REMINDER_OPTIONS = [
  { value: '1_day', label: 'Tous les jours' },
  { value: '2_days', label: 'Tous les 2 jours' },
  { value: '3_days', label: 'Tous les 3 jours' },
  { value: '7_days', label: 'Toutes les semaines' },
]

export default function StepReview({
  document,
  signers,
  fields,
  onBack,
  onSend,
  isLoading,
}: StepReviewProps) {
  const [emailSubject, setEmailSubject] = useState(`Vous avez été invité à signer ${document.name}`)
  const [emailMessage, setEmailMessage] = useState('')
  const [isEmailExpanded, setIsEmailExpanded] = useState(false)
  
  // Settings
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(true)
  const [dueDate, setDueDate] = useState<string>('')
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderInterval, setReminderInterval] = useState('3_days')

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
            {/* Thumbnail */}
            <div className="w-12 h-14 bg-gray-100 rounded border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
              {document.thumbnailUrl ? (
                <img src={document.thumbnailUrl} alt="" className="w-full h-full object-cover" />
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
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
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
        
        {isSettingsExpanded && (
          <div className="px-5 pb-5 space-y-5">
            {/* Due date */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Date limite de signature
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={getMinDate()}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#08CF65]/20 focus:border-[#08CF65] outline-none transition-all text-gray-900"
                />
                {dueDate && (
                  <button
                    onClick={() => setDueDate('')}
                    className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Retirer
                  </button>
                )}
              </div>
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
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
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
                  <select
                    value={reminderInterval}
                    onChange={(e) => setReminderInterval(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#08CF65]/20 focus:border-[#08CF65] outline-none transition-all text-gray-900 bg-white"
                  >
                    {REMINDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Un email de rappel sera envoyé aux signataires qui n&apos;ont pas encore signé
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
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
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
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
        
        {isEmailExpanded && (
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
        )}
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
          Retour
        </button>
        <button
          onClick={handleSend}
          disabled={isLoading}
          className="px-8 py-3 bg-[#08CF65] text-white rounded-xl font-medium hover:bg-[#07b858] transition-colors min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Envoi...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Envoyer
            </>
          )}
        </button>
      </motion.div>
    </div>
  )
}
