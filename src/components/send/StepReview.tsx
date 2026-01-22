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

interface StepReviewProps {
  document: DocumentData
  signers: Signer[]
  fields: SignField[]
  dueDate?: Date | null
  onBack: () => void
  onSend: (message?: string) => void
  isLoading: boolean
}

export default function StepReview({
  document,
  signers,
  fields,
  dueDate,
  onBack,
  onSend,
  isLoading,
}: StepReviewProps) {
  const [emailSubject, setEmailSubject] = useState(`Vous avez été invité à signer ${document.name}`)
  const [emailMessage, setEmailMessage] = useState('')
  const [isEmailExpanded, setIsEmailExpanded] = useState(true)

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Format due date
  const formatDueDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      month: 'short',
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
              <p className="font-medium text-gray-900">{formatDueDate(dueDate)}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Custom email */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden"
      >
        <button
          onClick={() => setIsEmailExpanded(!isEmailExpanded)}
          className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-gray-900">Email personnalisé</h2>
            <span className="text-xs px-2 py-0.5 bg-[#08CF65]/10 text-[#08CF65] rounded-full font-medium">
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
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl border border-gray-200 p-5 mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-500">Liste des destinataires</h2>
          <button className="text-sm text-[#08CF65] hover:text-[#07b858] font-medium">
            Ordre de signature
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm text-gray-600">Personnes qui doivent signer</p>
            <span className="text-xs text-gray-400">-</span>
            <p className="text-xs text-gray-400">Signent en même temps</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {signers.map((signer, index) => (
              <div
                key={signer.id}
                className="group relative"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-medium cursor-pointer transition-transform hover:scale-110"
                  style={{ backgroundColor: signer.color }}
                  title={`${signer.name || signer.email}`}
                >
                  {getInitials(signer.name, signer.email)}
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {signer.name || signer.email}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Navigation buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex items-center justify-center gap-4"
      >
        <button
          onClick={onBack}
          className="px-8 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors min-w-[140px]"
        >
          Retour
        </button>
        <button
          onClick={() => onSend(emailMessage || undefined)}
          disabled={isLoading}
          className="px-8 py-3 bg-[#08CF65] text-white rounded-xl font-medium hover:bg-[#07b858] transition-colors min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
