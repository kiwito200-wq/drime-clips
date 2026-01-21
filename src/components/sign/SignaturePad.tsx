'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type SignatureMode = 'draw' | 'type' | 'upload'

// Signature font options
const SIGNATURE_FONTS = [
  { name: 'Brush Script', value: '"Brush Script MT", "Segoe Script", cursive' },
  { name: 'Dancing Script', value: '"Dancing Script", cursive' },
  { name: 'Great Vibes', value: '"Great Vibes", cursive' },
  { name: 'Pacifico', value: '"Pacifico", cursive' },
  { name: 'Satisfy', value: '"Satisfy", cursive' },
]

interface SignaturePadProps {
  isOpen: boolean
  onClose: () => void
  onSave: (signatureDataUrl: string) => void
  onSaveAndNext?: (signatureDataUrl: string) => void
  hasNextField?: boolean
  title?: string
}

export default function SignaturePad({
  isOpen,
  onClose,
  onSave,
  onSaveAndNext,
  hasNextField = false,
  title = 'Add your signature',
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Mode state
  const [mode, setMode] = useState<SignatureMode>('draw')
  
  // Draw mode state
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false)
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })
  
  // Type mode state
  const [typedName, setTypedName] = useState('')
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0].value)
  
  // Upload mode state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)

  // Check if we have a valid signature based on mode
  const hasSignature = mode === 'draw' ? hasDrawnSignature : 
                       mode === 'type' ? typedName.trim().length > 0 :
                       uploadedImage !== null

  // Initialize canvas for draw mode
  useEffect(() => {
    if (!isOpen || mode !== 'draw') return
    
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2 // Retina
    canvas.height = rect.height * 2
    ctx.scale(2, 2)

    // Set drawing style
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Clear canvas
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)

    setHasDrawnSignature(false)
  }, [isOpen, mode])
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('draw')
      setTypedName('')
      setUploadedImage(null)
      setHasDrawnSignature(false)
    }
  }, [isOpen])

  // Get position from event (draw mode)
  const getPosition = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number

    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    }
  }, [])

  // Start drawing
  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const pos = getPosition(e)
    setIsDrawing(true)
    setLastPos(pos)
  }, [getPosition])

  // Draw
  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const pos = getPosition(e)

    ctx.beginPath()
    ctx.moveTo(lastPos.x, lastPos.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()

    setLastPos(pos)
    setHasDrawnSignature(true)
  }, [isDrawing, lastPos, getPosition])

  // Stop drawing
  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
  }, [])

  // Clear drawn signature
  const clearDrawnSignature = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    setHasDrawnSignature(false)
  }, [])

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  // Generate typed signature as image
  const generateTypedSignature = useCallback((): string => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 100
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Signature style text
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `italic 40px ${selectedFont}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(typedName || 'Signature', canvas.width / 2, canvas.height / 2)

    // Add a slight underline
    const textWidth = ctx.measureText(typedName || 'Signature').width
    ctx.beginPath()
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 1
    ctx.moveTo((canvas.width - textWidth) / 2 - 10, canvas.height / 2 + 18)
    ctx.lineTo((canvas.width + textWidth) / 2 + 10, canvas.height / 2 + 18)
    ctx.stroke()

    return canvas.toDataURL('image/png')
  }, [typedName, selectedFont])

  // Get signature data URL based on mode
  const getSignatureDataUrl = useCallback((): string => {
    if (!hasSignature) return ''

    if (mode === 'draw') {
      const canvas = canvasRef.current
      if (canvas) {
        return canvas.toDataURL('image/png')
      }
    } else if (mode === 'type') {
      return generateTypedSignature()
    } else if (mode === 'upload' && uploadedImage) {
      return uploadedImage
    }
    return ''
  }, [hasSignature, mode, generateTypedSignature, uploadedImage])

  // Save signature based on mode
  const handleSave = useCallback(() => {
    const dataUrl = getSignatureDataUrl()
    if (dataUrl) {
      onSave(dataUrl)
      onClose()
    }
  }, [getSignatureDataUrl, onSave, onClose])

  // Save and go to next field
  const handleSaveAndNext = useCallback(() => {
    const dataUrl = getSignatureDataUrl()
    if (dataUrl && onSaveAndNext) {
      onSaveAndNext(dataUrl)
    }
  }, [getSignatureDataUrl, onSaveAndNext])
  
  // Clear based on mode
  const handleClear = useCallback(() => {
    if (mode === 'draw') {
      clearDrawnSignature()
    } else if (mode === 'type') {
      setTypedName('')
    } else if (mode === 'upload') {
      setUploadedImage(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [mode, clearDrawnSignature])

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
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setMode('draw')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                mode === 'draw' 
                  ? 'text-primary border-b-2 border-primary bg-primary/5' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Draw
            </button>
            <button
              onClick={() => setMode('type')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                mode === 'type' 
                  ? 'text-primary border-b-2 border-primary bg-primary/5' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              Type
            </button>
            <button
              onClick={() => setMode('upload')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                mode === 'upload' 
                  ? 'text-primary border-b-2 border-primary bg-primary/5' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload
            </button>
          </div>

          {/* Content based on mode */}
          <div className="p-6">
            {/* DRAW MODE */}
            {mode === 'draw' && (
              <>
                <div className="relative border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-40 cursor-crosshair touch-none bg-white"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  {!hasDrawnSignature && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-gray-400 text-sm">Draw your signature here</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Use your mouse or finger to sign
                </p>
              </>
            )}

            {/* TYPE MODE */}
            {mode === 'type' && (
              <>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Type your name..."
                    className="w-full border border-gray-300 rounded-[10px] px-4 py-2.5 text-lg outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/20 transition-colors"
                    autoFocus
                  />
                  
                  {/* Font selector */}
                  <div className="flex flex-wrap gap-2">
                    {SIGNATURE_FONTS.map((font) => (
                      <button
                        key={font.value}
                        onClick={() => setSelectedFont(font.value)}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                          selectedFont === font.value
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        style={{ fontFamily: font.value }}
                      >
                        {font.name}
                      </button>
                    ))}
                  </div>

                  {/* Preview */}
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 bg-gray-50 min-h-[100px] flex items-center justify-center">
                    {typedName ? (
                      <span
                        className="text-4xl italic text-gray-900"
                        style={{ fontFamily: selectedFont }}
                      >
                        {typedName}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">Preview will appear here</span>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* UPLOAD MODE */}
            {mode === 'upload' && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                
                {uploadedImage ? (
                  <div className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
                    <img
                      src={uploadedImage}
                      alt="Uploaded signature"
                      className="max-w-full max-h-40 mx-auto object-contain"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center gap-3"
                  >
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">Click to upload image</p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 5MB</p>
                    </div>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
            <button
              onClick={handleClear}
              disabled={!hasSignature}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-[10px] transition-colors"
              >
                Cancel
              </button>
              {hasNextField && onSaveAndNext ? (
                <button
                  onClick={handleSaveAndNext}
                  disabled={!hasSignature}
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
                  disabled={!hasSignature}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Generate a simple auto-signature from a name
export function generateAutoSignature(name: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 100
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // White background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Signature style text
  ctx.fillStyle = '#1a1a1a'
  ctx.font = 'italic 36px "Brush Script MT", "Segoe Script", cursive'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name || 'Signature', canvas.width / 2, canvas.height / 2)

  // Add a slight underline
  const textWidth = ctx.measureText(name || 'Signature').width
  ctx.beginPath()
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 1
  ctx.moveTo((canvas.width - textWidth) / 2 - 10, canvas.height / 2 + 15)
  ctx.lineTo((canvas.width + textWidth) / 2 + 10, canvas.height / 2 + 15)
  ctx.stroke()

  return canvas.toDataURL('image/png')
}
