'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/lib/i18n/I18nContext'

interface SelectModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (value: string) => void
  onSaveAndNext?: (value: string) => void
  options: string[]
  title: string
  currentValue?: string
  required?: boolean
  hasNextField?: boolean
}

export default function SelectModal({
  isOpen,
  onClose,
  onSave,
  onSaveAndNext,
  options,
  title,
  currentValue,
  required = true,
  hasNextField = false,
}: SelectModalProps) {
  const { locale } = useTranslation()
  const [selectedOption, setSelectedOption] = useState<string>(currentValue || '')

  useEffect(() => {
    if (isOpen) {
      setSelectedOption(currentValue || '')
    }
  }, [isOpen, currentValue])

  const handleSave = () => {
    if (selectedOption || !required) {
      onSave(selectedOption)
      onClose()
    }
  }

  const handleSaveAndNext = () => {
    if ((selectedOption || !required) && onSaveAndNext) {
      onSaveAndNext(selectedOption)
    }
  }

  const handleOptionClick = (option: string) => {
    setSelectedOption(option)
    // Auto-save on selection for better UX
    if (hasNextField && onSaveAndNext) {
      setTimeout(() => onSaveAndNext(option), 150)
    } else {
      setTimeout(() => {
        onSave(option)
        onClose()
      }, 150)
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

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-50 w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                    <p className="text-sm text-gray-500">Choisissez une option</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="p-6 max-h-80 overflow-y-auto">
              <div className="space-y-2">
                {options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleOptionClick(option)}
                    className={`
                      w-full p-4 text-left rounded-xl border-2 transition-all
                      ${selectedOption === option
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center
                        ${selectedOption === option ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}
                      `}>
                        {selectedOption === option && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="font-medium">{option}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                {locale === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              {hasNextField && onSaveAndNext ? (
                <button
                  onClick={handleSaveAndNext}
                  disabled={required && !selectedOption}
                  className="flex-1 px-4 py-3 text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {locale === 'fr' ? 'Suivant' : 'Next'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={required && !selectedOption}
                  className="flex-1 px-4 py-3 text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {locale === 'fr' ? 'Confirmer' : 'Confirm'}
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
