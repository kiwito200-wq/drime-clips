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
}

interface StepReviewProps {
  document: DocumentData
  signers: Signer[]
  fields: SignField[]
  onBack: () => void
  onSend: () => void
  isLoading: boolean
}

const FIELD_LABELS: Record<string, string> = {
  signature: 'Signature',
  initials: 'Initiales',
  date: 'Date',
  text: 'Texte',
  checkbox: 'Case à cocher',
  name: 'Nom',
  email: 'Email',
}

export default function StepReview({
  document,
  signers,
  fields,
  onBack,
  onSend,
  isLoading,
}: StepReviewProps) {
  const [message, setMessage] = useState('')
  const [sendCopy, setSendCopy] = useState(true)

  // Get fields by signer
  const getFieldsBySigner = (signerId: string) => fields.filter(f => f.signerId === signerId)

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Vérifier et envoyer
        </h1>
        <p className="text-gray-500">
          Vérifiez les détails avant d'envoyer le document
        </p>
      </motion.div>

      {/* Document summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl border border-gray-200 p-6 mb-6"
      >
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Document
        </h2>
        <div className="flex items-center gap-4">
          <div className="w-14 h-16 bg-red-100 rounded-lg flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
            </svg>
          </div>
          <div>
            <p className="font-medium text-gray-900">{document.name}</p>
            <p className="text-sm text-gray-500">{fields.length} champ{fields.length !== 1 ? 's' : ''} à remplir</p>
          </div>
        </div>
      </motion.div>

      {/* Signers summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl border border-gray-200 p-6 mb-6"
      >
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          Signataires ({signers.length})
        </h2>
        <div className="space-y-4">
          {signers.map((signer, index) => {
            const signerFields = getFieldsBySigner(signer.id)
            return (
              <div key={signer.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: signer.color }}
                >
                  {(signer.name || signer.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{signer.name || 'Sans nom'}</p>
                  <p className="text-sm text-gray-500">{signer.email}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {signerFields.map(field => (
                      <span
                        key={field.id}
                        className="text-xs px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: `${signer.color}20`,
                          color: signer.color,
                        }}
                      >
                        {FIELD_LABELS[field.type] || field.type}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-sm text-gray-400">#{index + 1}</span>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Message */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl border border-gray-200 p-6 mb-6"
      >
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Message (optionnel)
        </h2>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ajoutez un message personnalisé pour les signataires..."
          rows={3}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#08CF65] focus:border-transparent outline-none resize-none"
        />
      </motion.div>

      {/* Options */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-xl border border-gray-200 p-6 mb-8"
      >
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={sendCopy}
            onChange={(e) => setSendCopy(e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-[#08CF65] focus:ring-[#08CF65]"
          />
          <div>
            <p className="font-medium text-gray-900">M'envoyer une copie</p>
            <p className="text-sm text-gray-500">Recevoir une copie du document signé par email</p>
          </div>
        </label>
      </motion.div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex items-center justify-between"
      >
        <button
          onClick={onBack}
          className="px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          Retour
        </button>
        <button
          onClick={onSend}
          disabled={isLoading}
          className="btn-primary px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Envoi en cours...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Envoyer pour signature
            </>
          )}
        </button>
      </motion.div>
    </div>
  )
}
