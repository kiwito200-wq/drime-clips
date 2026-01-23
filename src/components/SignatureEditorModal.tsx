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

const TABS: { mode: SignatureMode; label: string }[] = [
  { mode: 'draw', label: 'Draw' },
  { mode: 'type', label: 'Type' },
  { mode: 'upload', label: 'Upload' },
  { mode: 'saved', label: 'Saved' },
]

const TAB_ICONS: Record<SignatureMode, React.ReactNode> = {
  draw: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  type: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h18M3 12h18M3 16h18" />
    </svg>
  ),
  upload: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  saved: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
}

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
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([])
  
  const [mode, setMode] = useState<SignatureMode>('draw')
  const [hasDrawn, setHasDrawn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [canvasKey, setCanvasKey] = useState(0) // Force canvas re-render
  
  // Type mode state
  const [typedName, setTypedName] = useState('')
  const [selectedFont, setSelectedFont] = useState(0)
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  
  // Upload mode state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  
  // Saved signatures state
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>([])
  const [currentSavedIndex, setCurrentSavedIndex] = useState(0)
  
  // Tab underline position
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 })

  // Update underline position when tab changes
  useEffect(() => {
    const activeIndex = TABS.findIndex(t => t.mode === mode)
    const activeTab = tabsRef.current[activeIndex]
    if (activeTab) {
      const tabsContainer = activeTab.parentElement
      if (tabsContainer) {
        const containerRect = tabsContainer.getBoundingClientRect()
        const tabRect = activeTab.getBoundingClientRect()
        setUnderlineStyle({
          left: tabRect.left - containerRect.left,
          width: tabRect.width,
        })
      }
    }
  }, [mode, isOpen])

  // Load saved signatures when modal opens
  useEffect(() => {
    if (isOpen && savedSignature) {
      setSavedSignatures(prev => {
        // Don't add duplicate
        if (prev.some(s => s.data === savedSignature)) return prev
        return [{ id: `saved-${Date.now()}`, data: savedSignature, createdAt: new Date().toISOString() }, ...prev]
      })
    }
  }, [isOpen, savedSignature])

  // Initialize draw signature pad
  useEffect(() => {
    if (!isOpen || mode !== 'draw') return
    
    // Small delay to ensure canvas is rendered
    const timeout = setTimeout(() => {
      if (!canvasRef.current) return
      
      const canvas = canvasRef.current
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(ratio, ratio)
        ctx.fillStyle = 'rgb(255, 255, 255)'
        ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)
      }
      
      // Clean up old instance
      if (signaturePadRef.current) {
        signaturePadRef.current.off()
      }
      
      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)',
      })
      
      signaturePadRef.current.addEventListener('endStroke', () => setHasDrawn(true))
    }, 50)
    
    return () => {
      clearTimeout(timeout)
      if (signaturePadRef.current) {
        signaturePadRef.current.off()
        signaturePadRef.current = null
      }
    }
  }, [isOpen, mode, canvasKey])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasDrawn(false)
      setTypedName('')
      setUploadedImage(null)
      setMode('draw')
      setCurrentSavedIndex(0)
      setShowFontDropdown(false)
      setCanvasKey(0)
      if (signaturePadRef.current) {
        signaturePadRef.current.off()
        signaturePadRef.current = null
      }
    }
  }, [isOpen])

  const handleModeChange = (newMode: SignatureMode) => {
    if (newMode === mode) return
    setMode(newMode)
    if (newMode === 'draw') {
      setCanvasKey(prev => prev + 1) // Force canvas re-render
    }
  }

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
        // Add to saved signatures if it's a new one (not from saved tab)
        if (mode !== 'saved') {
          setSavedSignatures(prev => {
            if (prev.some(s => s.data === signatureData)) return prev
            return [{ id: `saved-${Date.now()}`, data: signatureData, createdAt: new Date().toISOString() }, ...prev]
          })
        }
        onSave(signatureData)
      }
    } catch (err) {
      console.error('Failed to save signature:', err)
    } finally {
      setSaving(false)
    }
  }, [getSignatureData, onSave, mode])

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
              <div className="flex">
                {TABS.map((tab, index) => (
                  <button
                    key={tab.mode}
                    ref={el => { tabsRef.current[index] = el }}
                    onClick={() => handleModeChange(tab.mode)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                      mode === tab.mode ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {TAB_ICONS[tab.mode]}
                    {tab.label}
                  </button>
                ))}
              </div>
              
              {/* Animated underline */}
              <motion.div
                className="absolute bottom-0 h-0.5 bg-[#08CF65]"
                initial={false}
                animate={{
                  left: underlineStyle.left,
                  width: underlineStyle.width,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            </div>

            {/* Content area - FIXED HEIGHT */}
            <div className="p-5 h-[280px]">
              {/* Draw mode */}
              {mode === 'draw' && (
                <div className="relative h-full">
                  <canvas
                    key={canvasKey}
                    ref={canvasRef}
                    className="w-full h-full bg-white rounded-xl border border-gray-200 cursor-crosshair"
                    style={{ touchAction: 'none' }}
                  />
                  
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

                  {!hasDrawn && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-gray-400 text-sm">Draw your signature here</span>
                    </div>
                  )}
                </div>
              )}

              {/* Type mode */}
              {mode === 'type' && (
                <div className="h-full flex flex-col">
                  <div 
                    className="relative flex-1 bg-gray-50 rounded-xl border-2 border-[#08CF65] flex items-center justify-center cursor-text"
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
                  
                  <div className="flex items-center gap-2 mt-3">
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
                </div>
              )}

              {/* Upload mode */}
              {mode === 'upload' && (
                <div className="h-full">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  {uploadedImage ? (
                    <div className="relative h-full bg-white rounded-xl border border-gray-200 flex items-center justify-center p-4">
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
                      className="w-full h-full border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-[#08CF65] hover:bg-[#08CF65]/5 transition-colors"
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
                </div>
              )}

              {/* Saved signatures mode */}
              {mode === 'saved' && (
                <div className="h-full flex flex-col">
                  {savedSignatures.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-500">
                          {currentSavedIndex + 1}/{savedSignatures.length} saved signature{savedSignatures.length > 1 ? 's' : ''}
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
                      
                      <div className="relative flex-1 bg-white rounded-xl border border-gray-200 flex items-center justify-center">
                        {/* Previous button - always show if more than 1 */}
                        <button
                          onClick={() => setCurrentSavedIndex(prev => (prev - 1 + savedSignatures.length) % savedSignatures.length)}
                          className={`absolute left-2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors ${savedSignatures.length <= 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                          disabled={savedSignatures.length <= 1}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        
                        <img
                          src={savedSignatures[currentSavedIndex].data}
                          alt="Saved signature"
                          className="max-w-[70%] max-h-[80%] object-contain"
                        />
                        
                        {/* Next button - always show if more than 1 */}
                        <button
                          onClick={() => setCurrentSavedIndex(prev => (prev + 1) % savedSignatures.length)}
                          className={`absolute right-2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors ${savedSignatures.length <= 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                          disabled={savedSignatures.length <= 1}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm text-gray-500">No saved signatures yet</p>
                      <p className="text-xs text-gray-400 mt-1">Draw, type or upload a signature to save it</p>
                    </div>
                  )}
                </div>
              )}
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
