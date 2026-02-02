'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FieldType } from './types'
import { useTranslation } from '@/lib/i18n/I18nContext'

interface FieldInputModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (value: string) => void
  onSaveAndNext?: (value: string) => void
  hasNextField?: boolean
  fieldType: FieldType
  placeholder?: string
  defaultValue?: string
}

export default function FieldInputModal({
  isOpen,
  onClose,
  onSave,
  onSaveAndNext,
  hasNextField = false,
  fieldType,
  placeholder,
  defaultValue = '',
}: FieldInputModalProps) {
  const { locale } = useTranslation()
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, defaultValue])

  const handleSave = () => {
    if (value.trim()) {
      onSave(value.trim())
      onClose()
    }
  }

  const handleSaveAndNext = () => {
    if (value.trim() && onSaveAndNext) {
      onSaveAndNext(value.trim())
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

  // Get title and input type based on field type
  const getFieldConfig = () => {
    switch (fieldType) {
      case 'date':
        return {
          title: 'Date',
          inputType: 'date',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        }
      case 'text':
        return {
          title: 'Texte',
          inputType: 'text',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          ),
        }
      case 'number':
        return {
          title: 'Nombre',
          inputType: 'number',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          ),
        }
      case 'name':
        return {
          title: 'Nom',
          inputType: 'text',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
        }
      case 'email':
        return {
          title: 'Email',
          inputType: 'email',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
        }
      case 'phone':
        return {
          title: 'Téléphone',
          inputType: 'tel',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          ),
        }
      case 'select':
        return {
          title: 'Sélection',
          inputType: 'text',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          ),
        }
      case 'image':
        return {
          title: 'Image',
          inputType: 'text',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        }
      case 'file':
        return {
          title: 'Fichier',
          inputType: 'text',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          ),
        }
      default:
        return {
          title: 'Valeur',
          inputType: 'text',
          icon: null,
        }
    }
  }

  const config = getFieldConfig()

  // For date, format default to today if no value
  useEffect(() => {
    if (isOpen && fieldType === 'date' && !defaultValue) {
      const today = new Date().toISOString().split('T')[0]
      setValue(today)
    }
  }, [isOpen, fieldType, defaultValue])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden pointer-events-auto">
          {/* Header */}
          <div className="p-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{config.title}</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Input */}
          <div className="px-5 pb-5">
            <input
              ref={inputRef}
              type={config.inputType}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || config.title}
              className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:border-[#08CF65] focus:ring-2 focus:ring-[#08CF65]/20"
            />
          </div>

          {/* Actions */}
          <div className="p-5 pt-0 flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium"
            >
              {locale === 'fr' ? 'Annuler' : 'Cancel'}
            </button>
            {hasNextField && onSaveAndNext ? (
              <button
                onClick={handleSaveAndNext}
                disabled={!value.trim()}
                className="flex-1 px-4 py-3 text-white bg-[#08CF65] rounded-xl hover:bg-[#06B557] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {locale === 'fr' ? 'Suivant' : 'Next'}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={!value.trim()}
                className="flex-1 px-4 py-3 text-white bg-[#08CF65] rounded-xl hover:bg-[#06B557] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {locale === 'fr' ? 'Confirmer' : 'Confirm'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
