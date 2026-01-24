'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib'
import { fabric } from 'fabric'

interface PDFEditorProps {
  pdfUrl: string
  onSave: (modifiedPdfBlob: Blob) => void
  onCancel: () => void
}

type Tool = 'select' | 'text' | 'image' | 'rectangle' | 'highlight' | 'whiteout'

const FONTS = [
  { id: 'helvetica', name: 'Helvetica', pdfFont: StandardFonts.Helvetica },
  { id: 'times', name: 'Times New Roman', pdfFont: StandardFonts.TimesRoman },
  { id: 'courier', name: 'Courier', pdfFont: StandardFonts.Courier },
]

const COLORS = [
  '#000000', '#374151', '#6B7280', '#DC2626', '#EA580C', 
  '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6',
]

export default function PDFEditor({ pdfUrl, onSave, onCancel }: PDFEditorProps) {
  // State
  const [pages, setPages] = useState<{ width: number; height: number; imageUrl: string }[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [scale, setScale] = useState(0.8)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Tools
  const [activeTool, setActiveTool] = useState<Tool>('select')
  
  // Text tool options
  const [textOptions, setTextOptions] = useState({
    fontSize: 14,
    fontFamily: 'helvetica',
    color: '#000000',
    bold: false,
  })
  
  // Shape tool options
  const [shapeOptions, setShapeOptions] = useState({
    fillColor: '#FFFF00',
    strokeColor: '#000000',
    strokeWidth: 2,
    opacity: 0.5,
  })
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  const pdfBytesRef = useRef<ArrayBuffer | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pdfImageRef = useRef<fabric.Image | null>(null)

  // Load PDF
  useEffect(() => {
    const loadPDF = async () => {
      try {
        setIsLoading(true)
        
        // Fetch PDF
        const response = await fetch(pdfUrl)
        const arrayBuffer = await response.arrayBuffer()
        pdfBytesRef.current = arrayBuffer
        
        // Load with PDF.js for display
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
        
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const loadedPages: { width: number; height: number; imageUrl: string }[] = []
        
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i)
          const viewport = page.getViewport({ scale: 2 })
          
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')!
          canvas.width = viewport.width
          canvas.height = viewport.height
          
          await page.render({ canvasContext: context, viewport }).promise
          
          loadedPages.push({
            width: viewport.width / 2,
            height: viewport.height / 2,
            imageUrl: canvas.toDataURL('image/png'),
          })
        }
        
        setPages(loadedPages)
      } catch (error) {
        console.error('Failed to load PDF:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadPDF()
  }, [pdfUrl])

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || !pages[currentPage] || isLoading) return

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: pages[currentPage].width * scale,
      height: pages[currentPage].height * scale,
      selection: activeTool === 'select',
    })

    fabricCanvasRef.current = canvas

    // Load PDF page as background image
    fabric.Image.fromURL(pages[currentPage].imageUrl, (img) => {
      img.set({
        left: 0,
        top: 0,
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
      })
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas))
      pdfImageRef.current = img
    })

    // Handle canvas click for adding elements
    canvas.on('mouse:down', (e) => {
      if (activeTool === 'text' && e.target === null) {
        const pointer = canvas.getPointer(e.e)
        const text = new fabric.IText('Nouveau texte', {
          left: pointer.x,
          top: pointer.y,
          fontSize: textOptions.fontSize,
          fontFamily: textOptions.fontFamily === 'times' ? 'Times New Roman' : 
                     textOptions.fontFamily === 'courier' ? 'Courier New' : 'Arial',
          fill: textOptions.color,
          fontWeight: textOptions.bold ? 'bold' : 'normal',
        })
        canvas.add(text)
        canvas.setActiveObject(text)
        text.enterEditing()
        setActiveTool('select')
      } else if (activeTool === 'rectangle' && e.target === null) {
        const pointer = canvas.getPointer(e.e)
        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 100,
          height: 50,
          fill: shapeOptions.fillColor,
          stroke: shapeOptions.strokeColor,
          strokeWidth: shapeOptions.strokeWidth,
          opacity: shapeOptions.opacity,
        })
        canvas.add(rect)
        canvas.setActiveObject(rect)
        setActiveTool('select')
      } else if (activeTool === 'highlight' && e.target === null) {
        const pointer = canvas.getPointer(e.e)
        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 100,
          height: 30,
          fill: '#FFFF00',
          opacity: 0.4,
          selectable: true,
        })
        canvas.add(rect)
        canvas.setActiveObject(rect)
        setActiveTool('select')
      } else if (activeTool === 'whiteout' && e.target === null) {
        const pointer = canvas.getPointer(e.e)
        const rect = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 100,
          height: 30,
          fill: '#FFFFFF',
          opacity: 1,
          selectable: true,
        })
        canvas.add(rect)
        canvas.setActiveObject(rect)
        setActiveTool('select')
      }
    })

    // Update selection
    canvas.on('selection:created', () => {
      const activeObj = canvas.getActiveObject()
      if (activeObj && activeObj.type === 'i-text') {
        const textObj = activeObj as fabric.IText
        setTextOptions({
          fontSize: textObj.fontSize || 14,
          fontFamily: textObj.fontFamily === 'Times New Roman' ? 'times' : 
                     textObj.fontFamily === 'Courier New' ? 'courier' : 'helvetica',
          color: textObj.fill as string || '#000000',
          bold: textObj.fontWeight === 'bold',
        })
      }
    })

    return () => {
      canvas.dispose()
    }
  }, [pages, currentPage, scale, isLoading, activeTool, textOptions, shapeOptions])

  // Update canvas when scale changes
  useEffect(() => {
    if (!fabricCanvasRef.current || !pages[currentPage]) return
    
    const canvas = fabricCanvasRef.current
    canvas.setDimensions({
      width: pages[currentPage].width * scale,
      height: pages[currentPage].height * scale,
    })
    
    if (pdfImageRef.current) {
      pdfImageRef.current.set({
        scaleX: scale,
        scaleY: scale,
      })
      canvas.renderAll()
    }
  }, [scale, currentPage, pages])

  // Update canvas selection mode
  useEffect(() => {
    if (!fabricCanvasRef.current) return
    fabricCanvasRef.current.selection = activeTool === 'select'
  }, [activeTool])

  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !fabricCanvasRef.current) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      fabric.Image.fromURL(event.target?.result as string, (img) => {
        img.set({
          left: 50,
          top: 50,
          scaleX: 0.5,
          scaleY: 0.5,
        })
        fabricCanvasRef.current?.add(img)
        fabricCanvasRef.current?.setActiveObject(img)
        setActiveTool('select')
      })
    }
    reader.readAsDataURL(file)
    
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // Delete selected object
  const deleteSelected = useCallback(() => {
    if (!fabricCanvasRef.current) return
    const activeObj = fabricCanvasRef.current.getActiveObject()
    if (activeObj) {
      fabricCanvasRef.current.remove(activeObj)
      fabricCanvasRef.current.discardActiveObject()
      fabricCanvasRef.current.renderAll()
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected()
      }
      if (e.key === 'Escape') {
        setActiveTool('select')
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.discardActiveObject()
          fabricCanvasRef.current.renderAll()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelected])

  // Update text properties when options change
  useEffect(() => {
    if (!fabricCanvasRef.current) return
    const activeObj = fabricCanvasRef.current.getActiveObject()
    if (activeObj && activeObj.type === 'i-text') {
      const textObj = activeObj as fabric.IText
      textObj.set({
        fontSize: textOptions.fontSize,
        fontFamily: textOptions.fontFamily === 'times' ? 'Times New Roman' : 
                   textOptions.fontFamily === 'courier' ? 'Courier New' : 'Arial',
        fill: textOptions.color,
        fontWeight: textOptions.bold ? 'bold' : 'normal',
      })
      fabricCanvasRef.current.renderAll()
    }
  }, [textOptions])

  // Export modified PDF
  const handleSave = async () => {
    if (!pdfBytesRef.current || !fabricCanvasRef.current) return
    
    setIsSaving(true)
    try {
      // Copy ArrayBuffer to avoid detached buffer error
      const bufferCopy = pdfBytesRef.current.slice(0)
      
      // Load original PDF with pdf-lib
      const pdfDoc = await PDFDocument.load(bufferCopy, { ignoreEncryption: true })
      const pdfPages = pdfDoc.getPages()
      
      // Embed fonts
      const fonts: Record<string, PDFFont> = {
        helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
        'helvetica-bold': await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        times: await pdfDoc.embedFont(StandardFonts.TimesRoman),
        'times-bold': await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
        courier: await pdfDoc.embedFont(StandardFonts.Courier),
        'courier-bold': await pdfDoc.embedFont(StandardFonts.CourierBold),
      }
      
      // Get all objects from Fabric canvas
      const objects = fabricCanvasRef.current.getObjects().filter(obj => obj !== pdfImageRef.current)
      
      // Process each object
      for (const obj of objects) {
        const page = pdfPages[currentPage]
        if (!page) continue
        
        const pageHeight = page.getHeight()
        // Convert from canvas coordinates to PDF coordinates (flip Y axis)
        const pdfX = obj.left! / scale
        const pdfY = pageHeight - (obj.top! / scale) - (obj.height! * (obj.scaleY || 1) / scale)
        
        if (obj.type === 'i-text') {
          const textObj = obj as fabric.IText
          const fontKey = textObj.fontWeight === 'bold' 
            ? `${textOptions.fontFamily}-bold` 
            : textOptions.fontFamily || 'helvetica'
          const font = fonts[fontKey] || fonts.helvetica
          const color = hexToRgb(textObj.fill as string || '#000000')
          
          page.drawText(textObj.text || '', {
            x: pdfX,
            y: pdfY + (textObj.fontSize || 14),
            size: textObj.fontSize || 14,
            font,
            color: rgb(color.r / 255, color.g / 255, color.b / 255),
          })
        }
        
        if (obj.type === 'rect') {
          const rectObj = obj as fabric.Rect
          const fillColor = hexToRgb(rectObj.fill as string || '#FFFF00')
          const opacity = rectObj.opacity ?? 1
          
          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: (rectObj.width! * (rectObj.scaleX || 1)) / scale,
            height: (rectObj.height! * (rectObj.scaleY || 1)) / scale,
            color: rgb(fillColor.r / 255, fillColor.g / 255, fillColor.b / 255),
            opacity,
          })
          
          if (rectObj.strokeWidth && rectObj.strokeWidth > 0) {
            const strokeColor = hexToRgb(rectObj.stroke as string || '#000000')
            page.drawRectangle({
              x: pdfX,
              y: pdfY,
              width: (rectObj.width! * (rectObj.scaleX || 1)) / scale,
              height: (rectObj.height! * (rectObj.scaleY || 1)) / scale,
              borderColor: rgb(strokeColor.r / 255, strokeColor.g / 255, strokeColor.b / 255),
              borderWidth: rectObj.strokeWidth / scale,
            })
          }
        }
        
        if (obj.type === 'image') {
          const imgObj = obj as fabric.Image
          try {
            const imgData = imgObj.toDataURL()
            let image
            if (imgData.includes('image/png')) {
              image = await pdfDoc.embedPng(imgData)
            } else {
              image = await pdfDoc.embedJpg(imgData)
            }
            
            page.drawImage(image, {
              x: pdfX,
              y: pdfY,
              width: (imgObj.width! * (imgObj.scaleX || 1)) / scale,
              height: (imgObj.height! * (imgObj.scaleY || 1)) / scale,
            })
          } catch (err) {
            console.error('Failed to embed image:', err)
          }
        }
      }
      
      // Save modified PDF
      const modifiedPdfBytes = await pdfDoc.save()
      // Create a new Uint8Array from the bytes to avoid detached buffer issues
      const bytesArray = Array.from(modifiedPdfBytes)
      const blob = new Blob([new Uint8Array(bytesArray)], { type: 'application/pdf' })
      onSave(blob)
    } catch (error) {
      console.error('Failed to save PDF:', error)
      alert('Erreur lors de la sauvegarde du PDF')
    } finally {
      setIsSaving(false)
    }
  }

  // Helper to convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 0, g: 0, b: 0 }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white mt-4">Chargement du PDF...</p>
        </div>
      </div>
    )
  }

  const selectedObj = fabricCanvasRef.current?.getActiveObject()
  const isTextSelected = selectedObj?.type === 'i-text'

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col z-50">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h1 className="text-white font-medium">Modifier le PDF</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 bg-[#08CF65] text-white rounded-lg font-medium hover:bg-[#07b858] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Appliquer les modifications
              </>
            )}
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-2">
        {/* Tools */}
        <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
          <ToolButton
            active={activeTool === 'select'}
            onClick={() => setActiveTool('select')}
            title="Sélectionner (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </ToolButton>
          
          <ToolButton
            active={activeTool === 'text'}
            onClick={() => setActiveTool('text')}
            title="Ajouter du texte"
          >
            <span className="text-lg font-bold">T</span>
          </ToolButton>
          
          <ToolButton
            active={activeTool === 'image'}
            onClick={() => {
              setActiveTool('image')
              fileInputRef.current?.click()
            }}
            title="Ajouter une image"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </ToolButton>
          
          <div className="w-px h-6 bg-gray-600 mx-1" />
          
          <ToolButton
            active={activeTool === 'rectangle'}
            onClick={() => setActiveTool('rectangle')}
            title="Rectangle"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
            </svg>
          </ToolButton>
          
          <ToolButton
            active={activeTool === 'highlight'}
            onClick={() => setActiveTool('highlight')}
            title="Surligner"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.243 4.515l-6.738 6.737-.707 2.121-1.04 1.041 2.828 2.829 1.04-1.041 2.122-.707 6.737-6.738-4.242-4.242zm6.364 3.536a1 1 0 010 1.414l-7.778 7.778-2.122.707-1.414 1.414a1 1 0 01-1.414 0l-4.243-4.243a1 1 0 010-1.414l1.414-1.414.707-2.121 7.778-7.778a1 1 0 011.414 0l5.658 5.657z"/>
            </svg>
          </ToolButton>
          
          <ToolButton
            active={activeTool === 'whiteout'}
            onClick={() => setActiveTool('whiteout')}
            title="Masquer (Whiteout)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" fill="white" />
            </svg>
          </ToolButton>
        </div>
        
        {/* Text options */}
        <AnimatePresence>
          {(activeTool === 'text' || isTextSelected) && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2 ml-4"
            >
              <select
                value={textOptions.fontFamily}
                onChange={(e) => setTextOptions(prev => ({ ...prev, fontFamily: e.target.value }))}
                className="bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 outline-none focus:border-[#08CF65]"
              >
                {FONTS.map(font => (
                  <option key={font.id} value={font.id}>{font.name}</option>
                ))}
              </select>
              
              <input
                type="number"
                value={textOptions.fontSize}
                onChange={(e) => setTextOptions(prev => ({ ...prev, fontSize: parseInt(e.target.value) || 14 }))}
                className="w-16 bg-gray-700 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-600 outline-none focus:border-[#08CF65]"
                min={8}
                max={72}
              />
              
              <div className="flex items-center gap-1">
                {COLORS.slice(0, 6).map(color => (
                  <button
                    key={color}
                    onClick={() => setTextOptions(prev => ({ ...prev, color }))}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${textOptions.color === color ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              
              <button
                onClick={() => setTextOptions(prev => ({ ...prev, bold: !prev.bold }))}
                className={`w-8 h-8 rounded flex items-center justify-center font-bold text-sm ${textOptions.bold ? 'bg-[#08CF65] text-white' : 'bg-gray-700 text-gray-300'}`}
              >
                B
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Shape options */}
        <AnimatePresence>
          {activeTool === 'rectangle' && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2 ml-4"
            >
              <span className="text-gray-400 text-sm">Remplissage:</span>
              <div className="flex items-center gap-1">
                {COLORS.slice(0, 6).map(color => (
                  <button
                    key={color}
                    onClick={() => setShapeOptions(prev => ({ ...prev, fillColor: color }))}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${shapeOptions.fillColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Delete button */}
        {selectedObj && (
          <button
            onClick={deleteSelected}
            className="ml-auto px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Supprimer
          </button>
        )}
        
        {/* Zoom */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setScale(s => Math.max(0.3, s - 0.1))}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white bg-gray-700 rounded-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-gray-400 text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(s => Math.min(2, s + 0.1))}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white bg-gray-700 rounded-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Page thumbnails */}
        <div className="w-24 bg-gray-800 border-r border-gray-700 overflow-y-auto p-2 space-y-2">
          {pages.map((page, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`w-full aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all ${
                currentPage === index ? 'border-[#08CF65]' : 'border-transparent hover:border-gray-600'
              }`}
            >
              <img src={page.imageUrl} alt={`Page ${index + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>

        {/* PDF Canvas */}
        <div 
          className="flex-1 overflow-auto bg-gray-700 p-8 flex justify-center"
        >
          <canvas
            ref={canvasRef}
            className="bg-white shadow-2xl"
          />
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
    </div>
  )
}

// Tool button component
function ToolButton({ 
  children, 
  active, 
  onClick, 
  title 
}: { 
  children: React.ReactNode
  active: boolean
  onClick: () => void
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
        active ? 'bg-[#08CF65] text-white' : 'text-gray-400 hover:text-white hover:bg-gray-600'
      }`}
    >
      {children}
    </button>
  )
}
