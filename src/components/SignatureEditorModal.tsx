'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SignaturePad from 'signature_pad'

type SignatureMode = 'draw' | 'type' | 'upload' | 'saved'

interface SavedSignature {
  id: string
  data: string
  createdAt: string
}

interface SignatureEditorModalProps {
  isOpen: boolean
  onClose: () => void
  savedSignature: string | null
  onSave: (signatureData: string | null) => void
}

// Same fonts as SigningBanner
const SIGNATURE_FONTS = [
  { name: 'MonteCarlo', label: 'MonteCarlo' },
  { name: 'Dancing Script', label: 'Dancing Script' },
  { name: 'Great Vibes', label: 'Great Vibes' },
  { name: 'Allura', label: 'Allura' },
]

const TAB_CONFIG = [
  { mode: 'draw' as const, label: 'Draw', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )},
  { mode: 'type' as const, label: 'Type', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h18M3 12h18M3 16h18" />
    </svg>
  )},
  { mode: 'upload' as const, label: 'Upload', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )},
]

export default function SignatureEditorModal({
  isOpen,
  onClose,
  savedSignature,
  onSave,
}: SignatureEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const signaturePadRef = useRef<SignaturePad | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typeInputRef = useRef<HTMLInputElement>(null)
  
  const [mode, setMode] = useState<SignatureMode>('draw')
  const [hasDrawn, setHasDrawn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  // Type mode state
  const [typedName, setTypedName] = useState('')
  const [selectedFont, setSelectedFont] = useState(0)
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  
  // Upload mode state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  
  // Saved signatures state (keeps the last saved signature)
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>([])
  const [currentSavedIndex, setCurrentSavedIndex] = useState(0)

  // Load saved signatures when modal opens
  useEffect(() => {
    if (isOpen && savedSignature) {
      setSavedSignatures([{ id: 'current', data: savedSignature, createdAt: new Date().toISOString() }])
    }
  }, [isOpen, savedSignature])

  // Initialize draw signature pad when modal opens in draw mode
  useEffect(() => {
    if (isOpen && canvasRef.current && mode === 'draw') {
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
    }
    
    return () => {
      signaturePadRef.current?.off()
    }
  }, [isOpen, mode])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasDrawn(false)
      setTypedName('')
      setUploadedImage(null)
      setMode('draw')
      setCurrentSavedIndex(0)
      setShowFontDropdown(false)
    }
  }, [isOpen])

  const handleClear = useCallback(() => {
    if (mode === 'draw' && signaturePadRef.current) {
      signaturePadRef.current.clear()
      setHasDrawn(false)
    } else if (mode === 'type') {
      setTypedName('')
    } else if (mode === 'upload') {
      setUploadedImage(null)
    }
  }, [mode])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const getSignatureData = useCallback((): string | null => {
    if (mode === 'draw' && signaturePadRef.current && hasDrawn) {
      return signaturePadRef.current.toDataURL('image/png')
    } else if (mode === 'type' && typedName.trim()) {
      // Generate signature image from typed text
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 120
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, 400, 120)
        ctx.fillStyle = 'black'
        ctx.font = `italic 42px "${SIGNATURE_FONTS[selectedFont].name}", cursive`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(typedName, 200, 60)
        return canvas.toDataURL('image/png')
      }
    } else if (mode === 'upload' && uploadedImage) {
      return uploadedImage
    } else if (mode === 'saved' && savedSignatures.length > 0) {
      return savedSignatures[currentSavedIndex].data
    }
    return null
  }, [mode, hasDrawn, typedName, selectedFont, uploadedImage, savedSignatures, currentSavedIndex])

  const canSave = useCallback(() => {
    if (mode === 'draw') return hasDrawn
    if (mode === 'type') return typedName.trim().length > 0
    if (mode === 'upload') return uploadedImage !== null
    if (mode === 'saved') return savedSignatures.length > 0
    return false
  }, [mode, hasDrawn, typedName, uploadedImage, savedSignatures])

  const handleSave = useCallback(async () => {
    const signatureData = getSignatureData()
    if (!signatureData) return
    
    setSaving(true)
    try {
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
  }, [getSignatureData, onSave])

  const handleDelete = useCallback(async () => {
    setDeleting(true)
    try {
      const res = await fetch('/api/user/signature', {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (res.ok) {
        onSave(null)
        setSavedSignatures([])
        handleClear()
      }
    } catch (err) {
      console.error('Failed to delete signature:', err)
    } finally {
      setDeleting(false)
    }
  }, [onSave, handleClear])

  // Get active tab index for animation
  const getTabIndex = (tabMode: SignatureMode) => {
    if (tabMode === 'saved') return 3
    return TAB_CONFIG.findIndex(t => t.mode === tabMode)
  }

  const activeTabIndex = getTabIndex(mode)
  const tabCount = savedSignatures.length > 0 ? 4 : 3

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
              <h2 className="text-lg font-semibold text-gray-900">Add your signature</h2>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs with sliding underline */}
            <div className="relative border-b border-gray-100">
              <div className="flex px-2">
                {TAB_CONFIG.map((tab) => (
                  <button
                    key={tab.mode}
                    onClick={() => setMode(tab.mode)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                      mode === tab.mode ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
                {savedSignatures.length > 0 && (
                  <button
                    onClick={() => setMode('saved')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                      mode === 'saved' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Saved
                  </button>
                )}
              </div>
              
              {/* Animated underline */}
              <motion.div
                className="absolute bottom-0 h-0.5 bg-[#08CF65]"
                initial={false}
                animate={{
                  left: `${(activeTabIndex / tabCount) * 100}%`,
                  width: `${100 / tabCount}%`,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            </div>

            {/* Content area */}
            <div className="p-5">
              <AnimatePresence mode="wait">
                {/* Draw mode */}
                {mode === 'draw' && (
                  <motion.div
                    key="draw"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="relative">
                      <canvas
                        ref={canvasRef}
                        className="w-full h-40 bg-white rounded-xl border border-gray-200 cursor-crosshair"
                        style={{ touchAction: 'none' }}
                      />
                      
                      {/* Clear button */}
                      {hasDrawn && (
                        <button
                          onClick={handleClear}
                          className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Clear
                        </button>
                      )}

                      {/* Placeholder text */}
                      {!hasDrawn && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-gray-400 text-sm">Draw your signature here</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Type mode - like SigningBanner */}
                {mode === 'type' && (
                  <motion.div
                    key="type"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-3"
                  >
                    {/* Signature input area */}
                    <div 
                      className="relative bg-gray-50 rounded-xl border-2 border-[#08CF65] h-40 flex items-center justify-center cursor-text"
                      onClick={() => typeInputRef.current?.focus()}
                    >
                      <input
                        ref={typeInputRef}
                        type="text"
                        value={typedName}
                        onChange={(e) => setTypedName(e.target.value)}
                        placeholder="Type your signature here..."
                        className="absolute inset-0 w-full h-full text-center text-4xl bg-transparent border-none outline-none italic text-gray-900 placeholder-gray-400"
                        style={{ fontFamily: `"${SIGNATURE_FONTS[selectedFont].name}", cursive` }}
                        autoFocus
                      />
                    </div>
                    
                    {/* Font selection - like SigningBanner */}
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs">Font:</span>
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowFontDropdown(!showFontDropdown) }}
                          className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-lg px-3 py-1.5 border border-gray-200 cursor-pointer transition-colors"
                        >
                          <span style={{ fontFamily: `"${SIGNATURE_FONTS[selectedFont].name}", cursive` }}>
                            {SIGNATURE_FONTS[selectedFont].label}
                          </span>
                          <svg 
                            className={`w-3 h-3 text-gray-400 transition-transform ${showFontDropdown ? 'rotate-180' : ''}`} 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {showFontDropdown && (
                          <div 
                            className="absolute left-0 bottom-full mb-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[160px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {SIGNATURE_FONTS.map((font, i) => (
                              <button
                                key={font.name}
                                onClick={() => { setSelectedFont(i); setShowFontDropdown(false) }}
                                className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center ${
                                  selectedFont === i ? 'bg-[#08CF65]/10' : ''
                                }`}
                              >
                                <span 
                                  className="text-base text-gray-900"
                                  style={{ fontFamily: `"${font.name}", cursive` }}
                                >
                                  {font.label}
                                </span>
                                {selectedFont === i && (
                                  <svg className="w-4 h-4 text-[#08CF65] ml-auto" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Upload mode */}
                {mode === 'upload' && (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    
                    {uploadedImage ? (
                      <div className="relative bg-white rounded-xl border border-gray-200 h-40 flex items-center justify-center p-4">
                        <img
                          src={uploadedImage}
                          alt="Uploaded signature"
                          className="max-w-full max-h-full object-contain"
                        />
                        <button
                          onClick={() => setUploadedImage(null)}
                          className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-40 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-[#08CF65] hover:bg-[#08CF65]/5 transition-colors"
                      >
                        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <div className="text-center">
                          <p className="text-sm font-medium text-gray-700">Click to upload</p>
                          <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                        </div>
                      </button>
                    )}
                  </motion.div>
                )}

                {/* Saved signatures mode */}
                {mode === 'saved' && savedSignatures.length > 0 && (
                  <motion.div
                    key="saved"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        {currentSavedIndex + 1}/{savedSignatures.length} saved signatures
                      </span>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg border border-gray-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {deleting ? 'Deleting...' : 'Clear'}
                      </button>
                    </div>
                    
                    <div className="relative bg-white rounded-xl border border-gray-200 h-40 flex items-center justify-center">
                      {/* Previous button */}
                      {savedSignatures.length > 1 && (
                        <button
                          onClick={() => setCurrentSavedIndex(prev => (prev - 1 + savedSignatures.length) % savedSignatures.length)}
                          className="absolute left-2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                      )}
                      
                      <img
                        src={savedSignatures[currentSavedIndex].data}
                        alt="Saved signature"
                        className="max-w-[80%] max-h-[80%] object-contain"
                      />
                      
                      {/* Next button */}
                      {savedSignatures.length > 1 && (
                        <button
                          onClick={() => setCurrentSavedIndex(prev => (prev + 1) % savedSignatures.length)}
                          className="absolute right-2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer with warning */}
            <div className="px-5 pb-5">
              <p className="text-xs text-gray-500 mb-4">
                I understand this is a legal representation of my signature.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canSave() || saving}
                  className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                    canSave() && !saving
                      ? 'bg-[#08CF65] hover:bg-[#06B557]'
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Insert'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
