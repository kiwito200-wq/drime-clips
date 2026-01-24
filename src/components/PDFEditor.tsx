'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib'

interface PDFEditorProps {
  pdfUrl: string
  onSave: (modifiedPdfBlob: Blob) => void
  onCancel: () => void
}

interface TextElement {
  id: string
  page: number
  x: number
  y: number
  width: number
  height: number
  content: string
  fontSize: number
  fontFamily: string
  color: string
  bold: boolean
}

interface ImageElement {
  id: string
  page: number
  x: number
  y: number
  width: number
  height: number
  imageData: string
}

interface ShapeElement {
  id: string
  page: number
  x: number
  y: number
  width: number
  height: number
  type: 'highlight' | 'whiteout' | 'rectangle'
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
  opacity: number
}

type Element = TextElement | ImageElement | ShapeElement

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
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'image' | 'rectangle' | 'highlight' | 'whiteout'>('select')
  const [elements, setElements] = useState<Element[]>([])
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  
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
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfBytesRef = useRef<ArrayBuffer | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 })

  // Load PDF
  useEffect(() => {
    const loadPDF = async () => {
      try {
        setIsLoading(true)
        
        const response = await fetch(pdfUrl)
        const arrayBuffer = await response.arrayBuffer()
        pdfBytesRef.current = arrayBuffer
        
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

  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Don't create if clicking on an element
    if ((e.target as HTMLElement).closest('[data-element-id]')) {
      return
    }
    
    if (activeTool === 'text') {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = (e.clientX - rect.left) / scale
      const y = (e.clientY - rect.top) / scale
      
      const newElement: TextElement = {
        id: `text-${Date.now()}`,
        page: currentPage,
        x,
        y,
        width: 200,
        height: 30,
        content: 'Nouveau texte',
        ...textOptions,
      }
      setElements(prev => [...prev, newElement])
      setSelectedElementId(newElement.id)
      setEditingTextId(newElement.id)
      setActiveTool('select')
      
      setTimeout(() => {
        textInputRef.current?.focus()
        textInputRef.current?.select()
      }, 50)
    } else if (activeTool === 'select') {
      setSelectedElementId(null)
      setEditingTextId(null)
    }
  }, [activeTool, scale, currentPage, textOptions])

  // Handle element click
  const handleElementClick = useCallback((e: React.MouseEvent, elementId: string) => {
    e.stopPropagation()
    setSelectedElementId(elementId)
    
    const element = elements.find(el => el.id === elementId)
    if (element && 'content' in element) {
      setEditingTextId(elementId)
      setTimeout(() => {
        textInputRef.current?.focus()
        textInputRef.current?.select()
      }, 50)
    }
  }, [elements])

  // Handle element drag start
  const handleElementMouseDown = useCallback((e: React.MouseEvent, elementId: string) => {
    e.stopPropagation()
    const element = elements.find(el => el.id === elementId)
    if (!element) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const startLeft = element.x
    const startTop = element.y
    
    setIsDragging(true)
    setDragStart({ x: startX, y: startY })
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / scale
      const deltaY = (moveEvent.clientY - startY) / scale
      
      setElements(prev => prev.map(el => 
        el.id === elementId 
          ? { ...el, x: startLeft + deltaX, y: startTop + deltaY }
          : el
      ))
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [elements, scale])

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent, elementId: string, corner: string) => {
    e.stopPropagation()
    const element = elements.find(el => el.id === elementId)
    if (!element) return
    
    const startX = e.clientX
    const startY = e.clientY
    
    resizeStartRef.current = {
      x: startX,
      y: startY,
      width: element.width,
      height: element.height,
      left: element.x,
      top: element.y,
    }
    
    setIsResizing(true)
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / scale
      const deltaY = (moveEvent.clientY - startY) / scale
      
      let newWidth = resizeStartRef.current.width
      let newHeight = resizeStartRef.current.height
      let newX = resizeStartRef.current.left
      let newY = resizeStartRef.current.top
      
      if (corner.includes('e')) newWidth = Math.max(20, resizeStartRef.current.width + deltaX)
      if (corner.includes('w')) {
        newWidth = Math.max(20, resizeStartRef.current.width - deltaX)
        newX = resizeStartRef.current.left + deltaX
      }
      if (corner.includes('s')) newHeight = Math.max(20, resizeStartRef.current.height + deltaY)
      if (corner.includes('n')) {
        newHeight = Math.max(20, resizeStartRef.current.height - deltaY)
        newY = resizeStartRef.current.top + deltaY
      }
      
      setElements(prev => prev.map(el => 
        el.id === elementId 
          ? { ...el, width: newWidth, height: newHeight, x: newX, y: newY }
          : el
      ))
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [elements, scale])

  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const newElement: ImageElement = {
          id: `img-${Date.now()}`,
          page: currentPage,
          x: 50,
          y: 50,
          width: Math.min(img.width, 300),
          height: Math.min(img.height, 300),
          imageData: event.target?.result as string,
        }
        setElements(prev => [...prev, newElement])
        setSelectedElementId(newElement.id)
        setActiveTool('select')
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
    
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [currentPage])

  // Handle shape drawing
  const handleShapeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!['rectangle', 'highlight', 'whiteout'].includes(activeTool)) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const startX = (e.clientX - rect.left) / scale
    const startY = (e.clientY - rect.top) / scale
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentX = (moveEvent.clientX - rect.left) / scale
      const currentY = (moveEvent.clientY - rect.top) / scale
      
      const width = Math.abs(currentX - startX)
      const height = Math.abs(currentY - startY)
      
      if (width > 5 && height > 5) {
        const newElement: ShapeElement = {
          id: `shape-${Date.now()}`,
          page: currentPage,
          x: Math.min(startX, currentX),
          y: Math.min(startY, currentY),
          width,
          height,
          type: activeTool as 'rectangle' | 'highlight' | 'whiteout',
          fillColor: activeTool === 'whiteout' ? '#FFFFFF' : 
                    activeTool === 'highlight' ? '#FFFF00' : shapeOptions.fillColor,
          strokeColor: activeTool === 'whiteout' ? undefined : shapeOptions.strokeColor,
          strokeWidth: activeTool === 'whiteout' ? 0 : shapeOptions.strokeWidth,
          opacity: activeTool === 'highlight' ? 0.4 : activeTool === 'whiteout' ? 1 : shapeOptions.opacity,
        }
        
        // Update or create temp element
        setElements(prev => {
          const existing = prev.find(el => el.id.startsWith('temp-'))
          if (existing) {
            return prev.map(el => el.id.startsWith('temp-') ? newElement : el)
          }
          return [...prev, { ...newElement, id: `temp-${Date.now()}` }]
        })
      }
    }
    
    const handleMouseUp = () => {
      setElements(prev => prev.map(el => 
        el.id.startsWith('temp-') 
          ? { ...el, id: el.id.replace('temp-', 'shape-') }
          : el
      ))
      setActiveTool('select')
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [activeTool, scale, currentPage, shapeOptions])

  // Delete selected
  const deleteSelected = useCallback(() => {
    if (selectedElementId) {
      setElements(prev => prev.filter(el => el.id !== selectedElementId))
      setSelectedElementId(null)
      setEditingTextId(null)
    }
  }, [selectedElementId])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editingTextId) return
        deleteSelected()
      }
      if (e.key === 'Escape') {
        setActiveTool('select')
        setSelectedElementId(null)
        setEditingTextId(null)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelected, editingTextId])

  // Update text content
  const updateTextContent = useCallback((id: string, content: string) => {
    setElements(prev => prev.map(el => 
      el.id === id && 'content' in el 
        ? { ...el, content }
        : el
    ))
  }, [])

  // Export modified PDF
  const handleSave = async () => {
    if (!pdfBytesRef.current) return
    
    setIsSaving(true)
    try {
      const bufferCopy = pdfBytesRef.current.slice(0)
      const pdfDoc = await PDFDocument.load(bufferCopy, { ignoreEncryption: true })
      const pdfPages = pdfDoc.getPages()
      
      const fonts: Record<string, PDFFont> = {
        helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
        'helvetica-bold': await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        times: await pdfDoc.embedFont(StandardFonts.TimesRoman),
        'times-bold': await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
        courier: await pdfDoc.embedFont(StandardFonts.Courier),
        'courier-bold': await pdfDoc.embedFont(StandardFonts.CourierBold),
      }
      
      for (const element of elements) {
        const page = pdfPages[element.page]
        if (!page) continue
        
        const pageHeight = page.getHeight()
        const pdfX = element.x
        const pdfY = pageHeight - element.y - element.height
        
        if ('content' in element) {
          const textEl = element as TextElement
          const fontKey = textEl.bold ? `${textEl.fontFamily}-bold` : textEl.fontFamily || 'helvetica'
          const font = fonts[fontKey] || fonts.helvetica
          const color = hexToRgb(textEl.color || '#000000')
          
          page.drawText(textEl.content, {
            x: pdfX,
            y: pdfY + textEl.height - textEl.fontSize,
            size: textEl.fontSize,
            font,
            color: rgb(color.r / 255, color.g / 255, color.b / 255),
          })
        }
        
        if ('type' in element) {
          const shapeEl = element as ShapeElement
          const fillColor = hexToRgb(shapeEl.fillColor || '#FFFF00')
          
          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: shapeEl.width,
            height: shapeEl.height,
            color: rgb(fillColor.r / 255, fillColor.g / 255, fillColor.b / 255),
            opacity: shapeEl.opacity,
          })
          
          if (shapeEl.strokeWidth && shapeEl.strokeWidth > 0 && shapeEl.strokeColor) {
            const strokeColor = hexToRgb(shapeEl.strokeColor)
            page.drawRectangle({
              x: pdfX,
              y: pdfY,
              width: shapeEl.width,
              height: shapeEl.height,
              borderColor: rgb(strokeColor.r / 255, strokeColor.g / 255, strokeColor.b / 255),
              borderWidth: shapeEl.strokeWidth,
            })
          }
        }
        
        if ('imageData' in element) {
          const imgEl = element as ImageElement
          try {
            let image
            if (imgEl.imageData.includes('image/png')) {
              image = await pdfDoc.embedPng(imgEl.imageData)
            } else {
              image = await pdfDoc.embedJpg(imgEl.imageData)
            }
            
            page.drawImage(image, {
              x: pdfX,
              y: pdfY,
              width: imgEl.width,
              height: imgEl.height,
            })
          } catch (err) {
            console.error('Failed to embed image:', err)
          }
        }
      }
      
      const modifiedPdfBytes = await pdfDoc.save()
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

  const selectedElement = elements.find(el => el.id === selectedElementId)
  const isTextSelected = selectedElement && 'content' in selectedElement

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
        
        {/* Delete button */}
        {selectedElementId && (
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
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-700 p-8 flex justify-center"
        >
          <div
            className="relative bg-white shadow-2xl"
            style={{
              width: pages[currentPage]?.width * scale,
              height: pages[currentPage]?.height * scale,
            }}
            onClick={activeTool === 'text' ? handleCanvasClick : undefined}
            onMouseDown={['rectangle', 'highlight', 'whiteout'].includes(activeTool) ? handleShapeMouseDown : undefined}
          >
            {/* PDF Page */}
            <img
              src={pages[currentPage]?.imageUrl}
              alt={`Page ${currentPage + 1}`}
              className="w-full h-full pointer-events-none select-none"
              draggable={false}
            />

            {/* Elements overlay */}
            {elements
              .filter(el => el.page === currentPage)
              .map(element => (
                <div
                  key={element.id}
                  data-element-id={element.id}
                  className={`absolute ${selectedElementId === element.id ? 'ring-2 ring-[#08CF65]' : ''}`}
                  style={{
                    left: element.x * scale,
                    top: element.y * scale,
                    width: element.width * scale,
                    height: element.height * scale,
                    cursor: selectedElementId === element.id ? 'move' : 'pointer',
                  }}
                  onClick={(e) => handleElementClick(e, element.id)}
                  onMouseDown={(e) => {
                    if (activeTool === 'select') {
                      handleElementMouseDown(e, element.id)
                    }
                  }}
                >
                  {/* Render element based on type */}
                  {'content' in element && (
                    editingTextId === element.id ? (
                      <textarea
                        ref={textInputRef}
                        autoFocus
                        value={element.content}
                        onChange={(e) => updateTextContent(element.id, e.target.value)}
                        onBlur={() => setEditingTextId(null)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full h-full resize-none border-none outline-none bg-transparent p-1"
                        style={{
                          fontSize: element.fontSize * scale,
                          fontFamily: element.fontFamily === 'times' ? 'Times New Roman' : 
                                      element.fontFamily === 'courier' ? 'Courier New' : 'Helvetica, sans-serif',
                          fontWeight: element.bold ? 'bold' : 'normal',
                          color: element.color,
                        }}
                      />
                    ) : (
                      <div
                        className="w-full h-full p-1 whitespace-pre-wrap break-words cursor-text"
                        style={{
                          fontSize: element.fontSize * scale,
                          fontFamily: element.fontFamily === 'times' ? 'Times New Roman' : 
                                      element.fontFamily === 'courier' ? 'Courier New' : 'Helvetica, sans-serif',
                          fontWeight: element.bold ? 'bold' : 'normal',
                          color: element.color,
                        }}
                      >
                        {element.content || 'Cliquez pour éditer'}
                      </div>
                    )
                  )}
                  
                  {'imageData' in element && (
                    <img src={element.imageData} alt="" className="w-full h-full object-contain" draggable={false} />
                  )}
                  
                  {'type' in element && (
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundColor: element.fillColor,
                        opacity: element.opacity,
                        border: element.strokeWidth ? `${element.strokeWidth}px solid ${element.strokeColor || '#000000'}` : 'none',
                      }}
                    />
                  )}
                  
                  {/* Resize handles */}
                  {selectedElementId === element.id && (
                    <>
                      {['nw', 'ne', 'sw', 'se'].map(corner => (
                        <div
                          key={corner}
                          className="absolute w-3 h-3 bg-[#08CF65] rounded-full cursor-nwse-resize border-2 border-white z-10"
                          style={{
                            top: corner.includes('n') ? -6 : 'auto',
                            bottom: corner.includes('s') ? -6 : 'auto',
                            left: corner.includes('w') ? -6 : 'auto',
                            right: corner.includes('e') ? -6 : 'auto',
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleResizeStart(e, element.id, corner)
                          }}
                        />
                      ))}
                    </>
                  )}
                </div>
              ))}
          </div>
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
