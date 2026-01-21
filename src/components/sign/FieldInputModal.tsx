'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FieldType } from './types'

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
          title: 'Select Date',
          inputType: 'date',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        }
      case 'text':
        return {
          title: 'Enter Text',
          inputType: 'text',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          ),
        }
      case 'number':
        return {
          title: 'Enter Number',
          inputType: 'number',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          ),
        }
      case 'name':
        return {
          title: 'Enter Your Name',
          inputType: 'text',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
        }
      case 'email':
        return {
          title: 'Enter Email Address',
          inputType: 'email',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
        }
      case 'phone':
        return {
          title: 'Enter Phone Number',
          inputType: 'tel',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          ),
        }
      case 'select':
        return {
          title: 'Select Option',
          inputType: 'text',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          ),
        }
      case 'image':
        return {
          title: 'Upload Image',
          inputType: 'text',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        }
      case 'file':
        return {
          title: 'Upload File',
          inputType: 'text',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          ),
        }
      default:
        return {
          title: 'Enter Value',
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
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              {config.icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{config.title}</h2>
              {placeholder && (
                <p className="text-xs text-gray-500">{placeholder}</p>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="p-5">
            <input
              ref={inputRef}
              type={config.inputType}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || `Enter ${fieldType}...`}
              className="w-full border border-gray-300 rounded-[10px] px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/20 transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-[10px] transition-colors"
            >
              Cancel
            </button>
            {hasNextField && onSaveAndNext ? (
              <button
                onClick={handleSaveAndNext}
                disabled={!value.trim()}
                className="px-5 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={!value.trim()}
                className="px-5 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
