'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Field, FieldType, Recipient } from './types'

interface FieldPaletteProps {
  recipients: Recipient[]
  selectedRecipientId: string
  onSelectRecipient: (id: string) => void
  onAddRecipient: () => void
  onUpdateRecipient: (id: string, updates: Partial<Recipient>) => void
  onDeleteRecipient: (id: string) => void
  selectedField: Field | null
  onUpdateField: (fieldId: string, updates: Partial<Field>) => void
  onDeleteField: (fieldId: string) => void
  onDuplicateField: (fieldId: string) => void
  drawMode: FieldType | null
  onSetDrawMode: (type: FieldType | null) => void
  onDragStart: (type: FieldType) => void
  onDragEnd: () => void
  isPreviewMode: boolean
}

const FIELD_TYPES: { type: FieldType; label: string; description: string; category: 'signature' | 'input' | 'choice' | 'advanced' }[] = [
  // Signature fields
  { type: 'signature', label: 'Signature', description: 'Full signature', category: 'signature' },
  { type: 'initials', label: 'Initials', description: 'Short initials', category: 'signature' },
  { type: 'stamp', label: 'Stamp', description: 'Company stamp', category: 'signature' },
  // Input fields
  { type: 'text', label: 'Text', description: 'Free text input', category: 'input' },
  { type: 'number', label: 'Number', description: 'Numeric value', category: 'input' },
  { type: 'date', label: 'Date', description: 'Date picker', category: 'input' },
  { type: 'name', label: 'Name', description: 'Full name field', category: 'input' },
  { type: 'email', label: 'Email', description: 'Email address', category: 'input' },
  { type: 'phone', label: 'Phone', description: 'Phone number', category: 'input' },
  // Choice fields
  { type: 'checkbox', label: 'Checkbox', description: 'Yes/No checkbox', category: 'choice' },
  { type: 'radio', label: 'Radio', description: 'Single choice', category: 'choice' },
  { type: 'select', label: 'Select', description: 'Dropdown list', category: 'choice' },
  // Advanced fields
  { type: 'image', label: 'Image', description: 'Upload image', category: 'advanced' },
  { type: 'file', label: 'File', description: 'Upload file', category: 'advanced' },
]

export default function FieldPalette({
  recipients,
  selectedRecipientId,
  onSelectRecipient,
  onAddRecipient,
  onUpdateRecipient,
  onDeleteRecipient,
  selectedField,
  onUpdateField,
  onDeleteField,
  onDuplicateField,
  drawMode,
  onSetDrawMode,
  onDragStart,
  onDragEnd,
  isPreviewMode,
}: FieldPaletteProps) {
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null)
  const [showRecipients, setShowRecipients] = useState(true)

  const selectedRecipient = recipients.find(r => r.id === selectedRecipientId)

  // Get field icon
  const getFieldIcon = (type: FieldType) => {
    switch (type) {
      case 'signature':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        )
      case 'initials':
        return <span className="text-sm font-bold">AB</span>
      case 'stamp':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        )
      case 'checkbox':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'radio':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
            <circle cx="12" cy="12" r="4" fill="currentColor" />
          </svg>
        )
      case 'select':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        )
      case 'date':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )
      case 'text':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        )
      case 'number':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        )
      case 'name':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )
      case 'email':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )
      case 'phone':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        )
      case 'image':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )
      case 'file':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        )
      default:
        return null
    }
  }

  const handleDragStart = useCallback((e: React.DragEvent, type: FieldType) => {
    e.dataTransfer.setData('fieldType', type)
    onDragStart(type)
  }, [onDragStart])

  const handleDragEnd = useCallback(() => {
    onDragEnd()
  }, [onDragEnd])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Document Builder</h2>
        <p className="text-xs text-gray-500 mt-1">Drag fields onto the document or click to draw</p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Recipients Section */}
        <div className="border-b border-gray-200">
          <button
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            onClick={() => setShowRecipients(!showRecipients)}
          >
            <span className="font-medium text-gray-700 text-sm">Recipients</span>
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform ${showRecipients ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <AnimatePresence>
            {showRecipients && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-2">
                  {recipients.map((recipient, index) => (
                    <div
                      key={recipient.id}
                      className={`
                        p-3 rounded-lg border-2 cursor-pointer transition-all
                        ${selectedRecipientId === recipient.id
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300'
                        }
                      `}
                      onClick={() => onSelectRecipient(recipient.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm"
                          style={{ backgroundColor: recipient.color }}
                        >
                          {index + 1}
                        </div>
                        {editingRecipientId === recipient.id ? (
                          <input
                            type="text"
                            value={recipient.name}
                            onChange={(e) => onUpdateRecipient(recipient.id, { name: e.target.value })}
                            onBlur={() => setEditingRecipientId(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingRecipientId(null)}
                            autoFocus
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-primary"
                          />
                        ) : (
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{recipient.name}</p>
                            <p className="text-xs text-gray-500 truncate">{recipient.email || 'No email'}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingRecipientId(recipient.id)
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          {recipients.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteRecipient(recipient.id)
                              }}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={onAddRecipient}
                    className="w-full p-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-gray-300 hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
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

        {/* Fields Section */}
        <div className="p-4">
          <h3 className="font-medium text-gray-700 text-sm mb-3">Fields</h3>
          <p className="text-xs text-gray-400 mb-3">
            Adding fields for: <span className="font-medium" style={{ color: selectedRecipient?.color }}>{selectedRecipient?.name}</span>
          </p>
          
          <div className="grid grid-cols-3 gap-2">
            {FIELD_TYPES.map((fieldType) => (
              <button
                key={fieldType.type}
                className={`
                  p-2 rounded-lg border transition-all flex flex-col items-center justify-center gap-1
                  ${drawMode === fieldType.type
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
                draggable
                onDragStart={(e) => handleDragStart(e, fieldType.type)}
                onDragEnd={handleDragEnd}
                onClick={() => onSetDrawMode(drawMode === fieldType.type ? null : fieldType.type)}
                title={fieldType.description}
              >
                <div
                  className="text-gray-500"
                  style={{ color: drawMode === fieldType.type ? '#08CF65' : undefined }}
                >
                  {getFieldIcon(fieldType.type)}
                </div>
                <span className="text-xs text-gray-700 text-center">{fieldType.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Field Settings */}
        <AnimatePresence>
          {selectedField && !isPreviewMode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gray-200 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-700 text-sm">Field Settings</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onDuplicateField(selectedField.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded"
                      title="Duplicate"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDeleteField(selectedField.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Label */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                    <input
                      type="text"
                      value={selectedField.label || ''}
                      onChange={(e) => onUpdateField(selectedField.id, { label: e.target.value })}
                      placeholder={selectedField.placeholder || 'Enter label'}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Required Toggle */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-600">Required</label>
                    <button
                      onClick={() => onUpdateField(selectedField.id, { required: !selectedField.required })}
                      className={`
                        w-10 h-6 rounded-full transition-colors relative
                        ${selectedField.required ? 'bg-primary' : 'bg-gray-200'}
                      `}
                    >
                      <div
                        className={`
                          absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform
                          ${selectedField.required ? 'translate-x-5' : 'translate-x-1'}
                        `}
                      />
                    </button>
                  </div>

                  {/* Recipient */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Assigned to</label>
                    <select
                      value={selectedField.recipientId}
                      onChange={(e) => onUpdateField(selectedField.id, { recipientId: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary bg-white"
                    >
                      {recipients.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Font Size (for text fields) */}
                  {(selectedField.type === 'text' || selectedField.type === 'name' || selectedField.type === 'email' || selectedField.type === 'phone' || selectedField.type === 'number') && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Font Size</label>
                      <select
                        value={selectedField.fontSize || 12}
                        onChange={(e) => onUpdateField(selectedField.id, { fontSize: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary bg-white"
                      >
                        <option value={10}>Small (10px)</option>
                        <option value={12}>Medium (12px)</option>
                        <option value={14}>Large (14px)</option>
                        <option value={16}>Extra Large (16px)</option>
                      </select>
                    </div>
                  )}

                  {/* Options (for select and radio fields) */}
                  {(selectedField.type === 'select' || selectedField.type === 'radio') && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Options</label>
                      <textarea
                        value={(selectedField.options || []).join('\n')}
                        onChange={(e) => onUpdateField(selectedField.id, { options: e.target.value.split('\n').filter(o => o.trim()) })}
                        placeholder="One option per line"
                        rows={4}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary resize-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">Enter one option per line</p>
                    </div>
                  )}

                  {/* Min/Max (for number fields) */}
                  {selectedField.type === 'number' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Min</label>
                        <input
                          type="number"
                          value={selectedField.min ?? ''}
                          onChange={(e) => onUpdateField(selectedField.id, { min: e.target.value ? parseFloat(e.target.value) : undefined })}
                          placeholder="Min"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Max</label>
                        <input
                          type="number"
                          value={selectedField.max ?? ''}
                          onChange={(e) => onUpdateField(selectedField.id, { max: e.target.value ? parseFloat(e.target.value) : undefined })}
                          placeholder="Max"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-400 text-center">
          Tip: Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Delete</kbd> to remove selected field
        </p>
      </div>
    </div>
  )
}
