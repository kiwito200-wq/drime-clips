'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SignaturePad from 'signature_pad'

interface SignatureEditorModalProps {
  isOpen: boolean
  onClose: () => void
  savedSignature: string | null
  onSave: (signatureData: string | null) => void
}

export default function SignatureEditorModal({
  isOpen,
  onClose,
  savedSignature,
  onSave,
}: SignatureEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const signaturePadRef = useRef<SignaturePad | null>(null)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Initialize signature pad when modal opens
  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      canvas.getContext('2d')?.scale(ratio, ratio)
      
      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
      })
      
      signaturePadRef.current.addEventListener('endStroke', () => setHasDrawn(true))
      
      // Load saved signature if available
      if (savedSignature) {
        const img = new Image()
        img.onload = () => {
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = 'rgb(255, 255, 255)'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            
            const scale = Math.min(
              (canvas.offsetWidth * 0.9) / img.width,
              (canvas.offsetHeight * 0.9) / img.height
            )
            const x = (canvas.offsetWidth - img.width * scale) / 2
            const y = (canvas.offsetHeight - img.height * scale) / 2
            
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
            setHasDrawn(true)
          }
        }
        img.src = savedSignature
      }
    }
    
    return () => {
      signaturePadRef.current?.off()
    }
  }, [isOpen, savedSignature])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasDrawn(false)
    }
  }, [isOpen])

  const handleClear = useCallback(() => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear()
      setHasDrawn(false)
    }
  }, [])

  const handleSave = useCallback(async () => {
    if (!signaturePadRef.current || !hasDrawn) return
    
    setSaving(true)
    try {
      const signatureData = signaturePadRef.current.toDataURL('image/png')
      
      const res = await fetch('/api/user/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ signatureData }),
      })
      
      if (res.ok) {
        onSave(signatureData)
      }
    } catch (err) {
      console.error('Failed to save signature:', err)
    } finally {
      setSaving(false)
    }
  }, [hasDrawn, onSave])

  const handleDelete = useCallback(async () => {
    setDeleting(true)
    try {
      const res = await fetch('/api/user/signature', {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (res.ok) {
        onSave(null)
        handleClear()
      }
    } catch (err) {
      console.error('Failed to delete signature:', err)
    } finally {
      setDeleting(false)
    }
  }, [onSave, handleClear])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-[10px] border border-black/[0.12] shadow-[0_0_50px_rgba(0,0,0,0.25)] w-full max-w-lg"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Ma signature</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Dessinez votre signature ci-dessous
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Canvas area */}
            <div className="p-5">
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  className="w-full h-48 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 cursor-crosshair"
                  style={{ touchAction: 'none' }}
                />
                
                {/* Clear button */}
                {hasDrawn && (
                  <button
                    onClick={handleClear}
                    className="absolute top-2 right-2 w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}

                {/* Placeholder text */}
                {!hasDrawn && !savedSignature && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-gray-400 text-sm">Dessinez votre signature ici</span>
                  </div>
                )}
              </div>

              {/* Preview of saved signature */}
              {savedSignature && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Signature actuelle</span>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      {deleting ? 'Suppression...' : 'Supprimer'}
                    </button>
                  </div>
                  <img
                    src={savedSignature}
                    alt="Signature actuelle"
                    className="h-16 object-contain mx-auto"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={!hasDrawn || saving}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  hasDrawn && !saving
                    ? 'bg-[#08CF65] hover:bg-[#06B557]'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enregistrement...
                  </span>
                ) : (
                  'Enregistrer'
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
