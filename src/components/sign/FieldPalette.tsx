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

const FIELD_TYPES: { type: FieldType; label: string; description: string }[] = [
  { type: 'signature', label: 'Signature', description: 'Full signature' },
  { type: 'initials', label: 'Initiales', description: 'Short initials' },
  { type: 'date', label: 'Date', description: 'Date picker' },
  { type: 'text', label: 'Texte', description: 'Free text input' },
  { type: 'checkbox', label: 'Case', description: 'Yes/No checkbox' },
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
        return <img src="/icons/signature.svg" alt="" className="w-5 h-5" />
      case 'initials':
        return <img src="/icons/initials.svg" alt="" className="w-5 h-5" />
      case 'checkbox':
        return <img src="/icons/checkbox.svg" alt="" className="w-5 h-5" />
      case 'date':
        return <img src="/icons/date.svg" alt="" className="w-5 h-5" />
      case 'text':
        return <img src="/icons/text.svg" alt="" className="w-5 h-5" />
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
        <h2 className="font-semibold text-gray-900">Champs</h2>
        <p className="text-xs text-gray-500 mt-1">Glissez les champs sur le document ou cliquez pour placer</p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Recipients Section */}
        <div className="border-b border-gray-200">
          <button
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            onClick={() => setShowRecipients(!showRecipients)}
          >
            <span className="font-medium text-gray-700 text-sm">Signataires</span>
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
                          ? 'bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300'
                        }
                      `}
                      style={selectedRecipientId === recipient.id ? { borderColor: recipient.color } : undefined}
                      onClick={() => onSelectRecipient(recipient.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0"
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
                            className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#08CF65]"
                          />
                        ) : (
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{recipient.name}</p>
                            <p className="text-xs text-gray-500 truncate">{recipient.email || 'Pas d\'email'}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-1 flex-shrink-0">
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
                    Ajouter un signataire
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Fields Section */}
        <div className="p-4">
          <h3 className="font-medium text-gray-700 text-sm mb-3">Champs</h3>
          <p className="text-xs text-gray-400 mb-3">
            Ajouter des champs pour: <span className="font-medium" style={{ color: selectedRecipient?.color }}>{selectedRecipient?.name}</span>
          </p>
          
          <div className="grid grid-cols-3 gap-2">
            {FIELD_TYPES.map((fieldType) => (
              <button
                key={fieldType.type}
                className={`
                  p-2 rounded-lg border transition-all flex flex-col items-center justify-center gap-1
                  ${drawMode === fieldType.type
                    ? 'border-[#08CF65] bg-[#08CF65]/5'
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
                  <h3 className="font-medium text-gray-700 text-sm">Paramètres du champ</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onDuplicateField(selectedField.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded"
                      title="Dupliquer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDeleteField(selectedField.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
                      title="Supprimer"
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
                      placeholder={selectedField.placeholder || 'Entrer un label'}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#08CF65]"
                    />
                  </div>

                  {/* Required Toggle */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-600">Requis</label>
                    <button
                      onClick={() => onUpdateField(selectedField.id, { required: !selectedField.required })}
                      className={`
                        w-10 h-6 rounded-full transition-colors relative
                        ${selectedField.required ? 'bg-[#08CF65]' : 'bg-gray-200'}
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">Assigné à</label>
                    <select
                      value={selectedField.recipientId}
                      onChange={(e) => onUpdateField(selectedField.id, { recipientId: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#08CF65] bg-white"
                    >
                      {recipients.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-400 text-center">
          Tip: Appuyez sur <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Suppr</kbd> pour supprimer
        </p>
      </div>
    </div>
  )
}
