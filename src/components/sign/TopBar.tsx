'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Recipient } from './types'

interface TopBarProps {
  documentName: string
  onDocumentNameChange: (name: string) => void
  onBack: () => void
  onSend: () => void
  onPreview: () => void
  onAutoSign: () => void
  isPreviewMode: boolean
  isSaving: boolean
  recipients: Recipient[]
  onAddRecipient: () => void
  fieldsCount: number
  signedFieldsCount: number
}

export default function TopBar({
  documentName,
  onDocumentNameChange,
  onBack,
  onSend,
  onPreview,
  onAutoSign,
  isPreviewMode,
  isSaving,
  recipients,
  onAddRecipient,
  fieldsCount,
  signedFieldsCount,
}: TopBarProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [showRecipientsDropdown, setShowRecipientsDropdown] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Focus input when editing
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowRecipientsDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNameSubmit = () => {
    setIsEditingName(false)
    if (!documentName.trim()) {
      onDocumentNameChange('Untitled Document')
    }
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
      {/* Left Section */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 flex-shrink-0" />

        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-[#08CF65] rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900 hidden sm:inline">Drime Sign</span>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 flex-shrink-0 hidden sm:block" />

        {/* Document Name */}
        <div className="min-w-0 flex-1 max-w-md hidden sm:block">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={documentName}
              onChange={(e) => onDocumentNameChange(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              className="w-full px-2 py-1 text-sm font-medium text-gray-900 border border-primary rounded focus:outline-none"
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors truncate group"
            >
              <span className="truncate">{documentName}</span>
              <svg 
                className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Center Section - Status */}
      <div className="hidden lg:flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="flex -space-x-2">
            {recipients.slice(0, 3).map((recipient, index) => (
              <div
                key={recipient.id}
                className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: recipient.color, zIndex: 3 - index }}
                title={recipient.name}
              >
                {recipient.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {recipients.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 text-xs font-medium">
                +{recipients.length - 3}
              </div>
            )}
          </div>
          <span>{recipients.length} recipient{recipients.length > 1 ? 's' : ''}</span>
        </div>
        <div className="w-px h-5 bg-gray-200" />
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span>{fieldsCount} field{fieldsCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Add Recipient Button (Mobile-friendly dropdown) */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowRecipientsDropdown(!showRecipientsDropdown)}
            className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span className="hidden sm:inline">Recipients</span>
          </button>

          <AnimatePresence>
            {showRecipientsDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
              >
                <div className="p-3 border-b border-gray-100">
                  <h3 className="font-medium text-gray-900 text-sm">Recipients</h3>
                  <p className="text-xs text-gray-500">People who will sign this document</p>
                </div>
                <div className="p-2 max-h-60 overflow-y-auto">
                  {recipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm"
                        style={{ backgroundColor: recipient.color }}
                      >
                        {recipient.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{recipient.name}</p>
                        <p className="text-xs text-gray-500 truncate">{recipient.email || 'No email yet'}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t border-gray-100">
                  <button
                    onClick={() => {
                      onAddRecipient()
                      setShowRecipientsDropdown(false)
                    }}
                    className="w-full px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Recipient
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Self Sign Button - sign the document yourself */}
        <button
          onClick={onAutoSign}
          disabled={fieldsCount === 0}
          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
            signedFieldsCount > 0 
              ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' 
              : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
          }`}
          title="Sign this document yourself"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span className="hidden sm:inline">Sign Myself</span>
          {signedFieldsCount > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              signedFieldsCount === fieldsCount 
                ? 'bg-emerald-200 text-emerald-800' 
                : 'bg-blue-200 text-blue-800'
            }`}>
              {signedFieldsCount}/{fieldsCount}
            </span>
          )}
        </button>

        {/* Preview Button */}
        <button
          onClick={onPreview}
          className={`
            px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5
            ${isPreviewMode 
              ? 'bg-gray-900 text-white' 
              : 'text-gray-700 hover:bg-gray-100'
            }
          `}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span className="hidden sm:inline">Preview</span>
        </button>

        {/* Send Button */}
        <button
          onClick={onSend}
          disabled={isSaving || fieldsCount === 0}
          className={`
            px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-1.5
            ${isSaving || fieldsCount === 0
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-primary hover:bg-primary/90'
            }
          `}
        >
          {isSaving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="hidden sm:inline">Sending...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span className="hidden sm:inline">Send for Signature</span>
              <span className="sm:hidden">Send</span>
            </>
          )}
        </button>
      </div>
    </header>
  )
}
