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
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.74026 19.3407C3.47519 19.0384 1.81771 14.9873 3.96659 12.4958C5.08661 11.1972 6.80744 10.7845 8.17508 9.83821C9.46691 8.94372 10.4756 7.5041 9.95254 5.88117C9.56096 4.669 8.43326 3.95975 7.15583 3.88489" />
            <path d="M15.1577 8.72144L19.3972 11.8369" />
            <path d="M16.2097 7.21585C17.1707 5.90967 18.5034 6.60915 19.5118 7.35106C20.5202 8.09298 21.5846 9.15716 20.6236 10.4633L14.0888 19.0127C13.7968 19.4096 13.3583 19.6735 12.8709 19.7456L10.4195 20.1085C10.0849 20.158 9.773 19.9285 9.72072 19.5943L9.33765 17.1461C9.26148 16.6592 9.38289 16.1621 9.67492 15.7652L16.2097 7.21585Z" />
          </svg>
        )
      case 'initials':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.01582 5.96647C3.01874 4.5547 4.08608 3.28888 5.47158 3.0505C5.75568 3.00088 9.08808 3.00769 10.4668 3.00866C11.8309 3.00964 12.9936 3.50001 13.9568 4.4613C16.002 6.50257 18.0452 8.5458 20.0855 10.591C21.2929 11.8004 21.3095 13.6568 20.1069 14.8701C18.3721 16.6214 16.6285 18.364 14.8782 20.0988C13.6659 21.3004 11.8095 21.2848 10.5991 20.0774C8.53544 18.0195 6.47178 15.9617 4.41688 13.8951C3.62197 13.0954 3.15301 12.1292 3.0489 10.9996C2.96522 10.0967 3.01387 6.73998 3.01582 5.96647Z" />
            <path d="M9.90712 8.31531C9.90322 9.18514 9.17642 9.90027 8.29784 9.89832C7.42509 9.89638 6.69828 9.1686 6.70315 8.30169C6.70899 7.39683 7.42509 6.69144 8.33578 6.69533C9.19977 6.69825 9.91101 7.43089 9.90712 8.31531Z" />
          </svg>
        )
      case 'checkbox':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.78216 3H16.2169C19.165 3 21 5.08119 21 8.02638V15.9736C21 18.9188 19.165 21 16.2159 21H7.78216C4.83405 21 3 18.9188 3 15.9736V8.02638C3 5.08119 4.84281 3 7.78216 3Z" />
            <path d="M8.53516 12.0003L10.845 14.3091L15.4627 9.69141" />
          </svg>
        )
      case 'date':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.98389 9.66447H20.0253" />
            <path d="M15.6388 3V5.96174" />
            <path d="M8.36832 3V5.96174" />
            <path d="M15.8145 4.42139H8.19413C5.55056 4.42139 3.90039 5.8935 3.90039 8.59935V16.7451C3.90039 19.4938 5.55056 20.9999 8.19413 20.9999H15.8067C18.4581 20.9999 20.1004 19.52 20.1004 16.8132V8.59935C20.1082 5.8935 18.4658 4.42139 15.8145 4.42139Z" />
            <path d="M14.2495 15.0766H9.74951" />
          </svg>
        )
      case 'text':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.4541 20.0781H12.6376" />
            <path d="M9.45312 3.91406H12.6366" />
            <path d="M11.0449 3.91406V20.0847" />
            <path d="M7.6021 17.3743H6.13293C4.40203 17.3743 3 15.9722 3 14.2413V9.75696C3 8.02703 4.40203 6.625 6.13293 6.625H7.6021" />
            <path d="M14.1992 6.625H17.8682C19.5982 6.625 21.0002 8.02703 21.0002 9.75793V14.2326C21.0002 15.9605 19.5865 17.3743 17.8575 17.3743H14.1992" />
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
                            <img src="/icons/rename.svg" alt="" className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteRecipient(recipient.id)
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14.9624 3.87898L15.7806 5.66377H18.42C19.2315 5.66377 19.8894 6.32166 19.8894 7.1332V8.2214C19.8894 8.77625 19.4396 9.22605 18.8848 9.22605H5.11501C4.56015 9.22605 4.11035 8.77625 4.11035 8.2214V7.1332C4.11035 6.32166 4.76823 5.66377 5.57978 5.66377H8.2192L9.0374 3.87898C9.28294 3.34338 9.8181 3 10.4073 3H13.5925C14.1817 3 14.7168 3.34338 14.9624 3.87898Z" />
                              <path d="M18.3504 9.30078V17.9865C18.3504 19.6511 17.0177 21.0005 15.3738 21.0005H8.62696C6.98305 21.0005 5.65039 19.6511 5.65039 17.9865V9.30078" />
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
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.9624 3.87898L15.7806 5.66377H18.42C19.2315 5.66377 19.8894 6.32166 19.8894 7.1332V8.2214C19.8894 8.77625 19.4396 9.22605 18.8848 9.22605H5.11501C4.56015 9.22605 4.11035 8.77625 4.11035 8.2214V7.1332C4.11035 6.32166 4.76823 5.66377 5.57978 5.66377H8.2192L9.0374 3.87898C9.28294 3.34338 9.8181 3 10.4073 3H13.5925C14.1817 3 14.7168 3.34338 14.9624 3.87898Z" />
                        <path d="M18.3504 9.30078V17.9865C18.3504 19.6511 17.0177 21.0005 15.3738 21.0005H8.62696C6.98305 21.0005 5.65039 19.6511 5.65039 17.9865V9.30078" />
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
