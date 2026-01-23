'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/lib/i18n/I18nContext'

interface DateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (value: string) => void
  onSaveAndNext?: (value: string) => void
  title: string
  currentValue?: string
  required?: boolean
  hasNextField?: boolean
}

export default function DateModal({
  isOpen,
  onClose,
  onSave,
  onSaveAndNext,
  title,
  currentValue,
  required = true,
  hasNextField = false,
}: DateModalProps) {
  const { locale } = useTranslation()
  const [value, setValue] = useState(currentValue || '')

  useEffect(() => {
    if (isOpen) {
      setValue(currentValue || '')
    }
  }, [isOpen, currentValue])

  const setToday = () => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    setValue(`${yyyy}-${mm}-${dd}`)
  }

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  const handleSave = () => {
    if (value || !required) {
      onSave(value)
      onClose()
    }
  }

  const handleSaveAndNext = () => {
    if ((value || !required) && onSaveAndNext) {
      onSaveAndNext(value)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (hasNextField && onSaveAndNext) {
        handleSaveAndNext()
      } else {
        handleSave()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Modal - centered */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden pointer-events-auto">
              {/* Header */}
              <div className="p-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-5 space-y-4">
                {/* Set Today Button */}
                <button
                  onClick={setToday}
                  className="w-full px-4 py-3 bg-[#08CF65]/10 text-[#08CF65] rounded-xl hover:bg-[#08CF65]/20 transition-colors flex items-center justify-center gap-2 font-medium border border-[#08CF65]/20"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Définir à aujourd&apos;hui
                </button>

                {/* Date Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Ou choisissez une date
                  </label>
                  <input
                    type="date"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:border-[#08CF65] focus:ring-2 focus:ring-[#08CF65]/20"
                    autoFocus
                  />
                </div>

                {/* Display formatted date */}
                {value && (
                  <div className="text-center p-3 bg-[#08CF65]/5 rounded-xl border border-[#08CF65]/10">
                    <p className="text-sm text-gray-500">Date sélectionnée</p>
                    <p className="text-base font-medium text-gray-900 capitalize">
                      {formatDisplayDate(value)}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  {locale === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
                {hasNextField && onSaveAndNext ? (
                  <button
                    onClick={handleSaveAndNext}
                    disabled={required && !value}
                    className="flex-1 px-4 py-3 text-white bg-[#08CF65] rounded-xl hover:bg-[#06B557] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Suivant
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={required && !value}
                    className="flex-1 px-4 py-3 text-white bg-[#08CF65] rounded-xl hover:bg-[#06B557] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirmer
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
