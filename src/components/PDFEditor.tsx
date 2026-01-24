'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib'

// Types
interface EditorElement {
  id: string
  type: 'text' | 'image' | 'rectangle' | 'highlight' | 'whiteout'
  page: number
  x: number
  y: number
  width: number
  height: number
  // Text specific
  content?: string
  fontSize?: number
  fontFamily?: string
  color?: string
  bold?: boolean
  italic?: boolean
  // Image specific
  imageData?: string
  // Shape specific
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  opacity?: number
}

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
  const [elements, setElements] = useState<EditorElement[]>([])
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  
  // Text tool options
  const [textOptions, setTextOptions] = useState({
    fontSize: 14,
    fontFamily: 'helvetica',
    color: '#000000',
    bold: false,
    italic: false,
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
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [tempElement, setTempElement] = useState<EditorElement | null>(null)
  
  // Text editing state
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)

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
          const viewport = page.getViewport({ scale: 2 }) // High quality render
          
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')!
          canvas.width = viewport.width
          canvas.height = viewport.height
          
          await page.render({ canvasContext: context, viewport }).promise
          
          loadedPages.push({
            width: viewport.width / 2, // Original size
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

  // Get selected element
  const selectedElement = elements.find(e => e.id === selectedElementId)

  // Handle canvas click for placing elements
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>, pageIndex: number) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale
    
    if (activeTool === 'text') {
      const newElement: EditorElement = {
        id: `el-${Date.now()}`,
        type: 'text',
        page: pageIndex,
        x,
        y,
        width: 200,
        height: 30,
        content: '',
        ...textOptions,
      }
      setElements(prev => [...prev, newElement])
      setSelectedElementId(newElement.id)
      setEditingTextId(newElement.id)
      setActiveTool('select')
    } else if (activeTool === 'select') {
      setSelectedElementId(null)
      setEditingTextId(null)
    }
  }, [activeTool, scale, textOptions])

  // Handle mouse down for drawing shapes
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, pageIndex: number) => {
    if (!['rectangle', 'highlight', 'whiteout'].includes(activeTool)) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale
    
    setIsDrawing(true)
    setDrawStart({ x, y })
    
    const newElement: EditorElement = {
      id: `el-${Date.now()}`,
      type: activeTool as 'rectangle' | 'highlight' | 'whiteout',
      page: pageIndex,
      x,
      y,
      width: 0,
      height: 0,
      fillColor: activeTool === 'whiteout' ? '#FFFFFF' : 
                 activeTool === 'highlight' ? '#FFFF00' : shapeOptions.fillColor,
      strokeColor: activeTool === 'whiteout' ? '#FFFFFF' : shapeOptions.strokeColor,
      strokeWidth: activeTool === 'whiteout' ? 0 : shapeOptions.strokeWidth,
      opacity: activeTool === 'highlight' ? 0.4 : activeTool === 'whiteout' ? 1 : shapeOptions.opacity,
    }
    setTempElement(newElement)
  }, [activeTool, scale, shapeOptions])

  // Handle mouse move for drawing
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart || !tempElement) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale
    
    setTempElement(prev => prev ? {
      ...prev,
      width: Math.abs(x - drawStart.x),
      height: Math.abs(y - drawStart.y),
      x: Math.min(x, drawStart.x),
      y: Math.min(y, drawStart.y),
    } : null)
  }, [isDrawing, drawStart, tempElement, scale])

  // Handle mouse up for finishing drawing
  const handleMouseUp = useCallback(() => {
    if (tempElement && tempElement.width > 5 && tempElement.height > 5) {
      setElements(prev => [...prev, tempElement])
      setSelectedElementId(tempElement.id)
    }
    setIsDrawing(false)
    setDrawStart(null)
    setTempElement(null)
    setActiveTool('select')
  }, [tempElement])

  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const newElement: EditorElement = {
          id: `el-${Date.now()}`,
          type: 'image',
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
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [currentPage])

  // Delete selected element
  const deleteSelected = useCallback(() => {
    if (selectedElementId) {
      setElements(prev => prev.filter(e => e.id !== selectedElementId))
      setSelectedElementId(null)
    }
  }, [selectedElementId])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editingTextId) return // Don't delete while editing text
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
    setElements(prev => prev.map(e => e.id === id ? { ...e, content } : e))
  }, [])

  // Export modified PDF
  const handleSave = async () => {
    if (!pdfBytesRef.current) return
    
    setIsSaving(true)
    try {
      // Load original PDF with pdf-lib
      const pdfDoc = await PDFDocument.load(pdfBytesRef.current, { ignoreEncryption: true })
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
      
      // Process each element
      for (const element of elements) {
        const page = pdfPages[element.page]
        if (!page) continue
        
        const pageHeight = page.getHeight()
        // Convert from screen coordinates to PDF coordinates (flip Y axis)
        const pdfX = element.x
        const pdfY = pageHeight - element.y - element.height
        
        if (element.type === 'text' && element.content) {
          const fontKey = element.bold ? `${element.fontFamily}-bold` : element.fontFamily || 'helvetica'
          const font = fonts[fontKey] || fonts.helvetica
          const color = hexToRgb(element.color || '#000000')
          
          page.drawText(element.content, {
            x: pdfX,
            y: pdfY + element.height - (element.fontSize || 14),
            size: element.fontSize || 14,
            font,
            color: rgb(color.r / 255, color.g / 255, color.b / 255),
          })
        }
        
        if (element.type === 'rectangle' || element.type === 'highlight' || element.type === 'whiteout') {
          const fillColor = hexToRgb(element.fillColor || '#FFFF00')
          const opacity = element.opacity ?? 1
          
          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: element.width,
            height: element.height,
            color: rgb(fillColor.r / 255, fillColor.g / 255, fillColor.b / 255),
            opacity,
          })
          
          if (element.strokeWidth && element.strokeWidth > 0 && element.type === 'rectangle') {
            const strokeColor = hexToRgb(element.strokeColor || '#000000')
            page.drawRectangle({
              x: pdfX,
              y: pdfY,
              width: element.width,
              height: element.height,
              borderColor: rgb(strokeColor.r / 255, strokeColor.g / 255, strokeColor.b / 255),
              borderWidth: element.strokeWidth,
            })
          }
        }
        
        if (element.type === 'image' && element.imageData) {
          try {
            let image
            if (element.imageData.includes('image/png')) {
              image = await pdfDoc.embedPng(element.imageData)
            } else {
              image = await pdfDoc.embedJpg(element.imageData)
            }
            
            page.drawImage(image, {
              x: pdfX,
              y: pdfY,
              width: element.width,
              height: element.height,
            })
          } catch (err) {
            console.error('Failed to embed image:', err)
          }
        }
      }
      
      // Save modified PDF
      const modifiedPdfBytes = await pdfDoc.save()
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' })
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

  // Drag element
  const [isDraggingElement, setIsDraggingElement] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const handleElementMouseDown = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation()
    const element = elements.find(el => el.id === elementId)
    if (!element) return
    
    setSelectedElementId(elementId)
    setIsDraggingElement(true)
    
    const rect = e.currentTarget.parentElement?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: (e.clientX - rect.left) / scale - element.x,
        y: (e.clientY - rect.top) / scale - element.y,
      })
    }
  }

  const handleElementDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingElement || !selectedElementId) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / scale - dragOffset.x
    const y = (e.clientY - rect.top) / scale - dragOffset.y
    
    setElements(prev => prev.map(el => 
      el.id === selectedElementId ? { ...el, x: Math.max(0, x), y: Math.max(0, y) } : el
    ))
  }, [isDraggingElement, selectedElementId, scale, dragOffset])

  const handleElementMouseUp = () => {
    setIsDraggingElement(false)
  }

  // Resize element
  const handleResize = useCallback((elementId: string, corner: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const element = elements.find(el => el.id === elementId)
    if (!element) return
    
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = element.width
    const startHeight = element.height
    const startElX = element.x
    const startElY = element.y
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / scale
      const deltaY = (moveEvent.clientY - startY) / scale
      
      let newWidth = startWidth
      let newHeight = startHeight
      let newX = startElX
      let newY = startElY
      
      if (corner.includes('e')) newWidth = Math.max(20, startWidth + deltaX)
      if (corner.includes('w')) {
        newWidth = Math.max(20, startWidth - deltaX)
        newX = startElX + deltaX
      }
      if (corner.includes('s')) newHeight = Math.max(20, startHeight + deltaY)
      if (corner.includes('n')) {
        newHeight = Math.max(20, startHeight - deltaY)
        newY = startElY + deltaY
      }
      
      setElements(prev => prev.map(el => 
        el.id === elementId ? { ...el, width: newWidth, height: newHeight, x: newX, y: newY } : el
      ))
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [elements, scale])

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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
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
          {(activeTool === 'text' || selectedElement?.type === 'text') && (
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
            onClick={(e) => handleCanvasClick(e, currentPage)}
            onMouseDown={(e) => handleMouseDown(e, currentPage)}
            onMouseMove={(e) => {
              handleMouseMove(e)
              handleElementDrag(e)
            }}
            onMouseUp={() => {
              handleMouseUp()
              handleElementMouseUp()
            }}
            onMouseLeave={() => {
              handleMouseUp()
              handleElementMouseUp()
            }}
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
                  className={`absolute cursor-move ${selectedElementId === element.id ? 'ring-2 ring-[#08CF65]' : ''}`}
                  style={{
                    left: element.x * scale,
                    top: element.y * scale,
                    width: element.width * scale,
                    height: element.height * scale,
                  }}
                  onMouseDown={(e) => handleElementMouseDown(e, element.id)}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedElementId(element.id)
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    if (element.type === 'text') {
                      setEditingTextId(element.id)
                    }
                  }}
                >
                  {/* Render element based on type */}
                  {element.type === 'text' && (
                    editingTextId === element.id ? (
                      <textarea
                        ref={textInputRef}
                        autoFocus
                        value={element.content || ''}
                        onChange={(e) => updateTextContent(element.id, e.target.value)}
                        onBlur={() => setEditingTextId(null)}
                        className="w-full h-full resize-none border-none outline-none bg-transparent p-1"
                        style={{
                          fontSize: (element.fontSize || 14) * scale,
                          fontFamily: element.fontFamily === 'times' ? 'Times New Roman' : 
                                      element.fontFamily === 'courier' ? 'Courier New' : 'Helvetica, sans-serif',
                          fontWeight: element.bold ? 'bold' : 'normal',
                          color: element.color || '#000000',
                        }}
                      />
                    ) : (
                      <div
                        className="w-full h-full p-1 whitespace-pre-wrap break-words"
                        style={{
                          fontSize: (element.fontSize || 14) * scale,
                          fontFamily: element.fontFamily === 'times' ? 'Times New Roman' : 
                                      element.fontFamily === 'courier' ? 'Courier New' : 'Helvetica, sans-serif',
                          fontWeight: element.bold ? 'bold' : 'normal',
                          color: element.color || '#000000',
                        }}
                      >
                        {element.content || 'Double-cliquez pour éditer'}
                      </div>
                    )
                  )}
                  
                  {element.type === 'image' && element.imageData && (
                    <img src={element.imageData} alt="" className="w-full h-full object-contain" draggable={false} />
                  )}
                  
                  {(element.type === 'rectangle' || element.type === 'highlight' || element.type === 'whiteout') && (
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundColor: element.fillColor,
                        opacity: element.opacity,
                        border: element.strokeWidth ? `${element.strokeWidth}px solid ${element.strokeColor}` : 'none',
                      }}
                    />
                  )}
                  
                  {/* Resize handles */}
                  {selectedElementId === element.id && (
                    <>
                      {['nw', 'ne', 'sw', 'se'].map(corner => (
                        <div
                          key={corner}
                          className="absolute w-3 h-3 bg-[#08CF65] rounded-full cursor-nwse-resize border-2 border-white"
                          style={{
                            top: corner.includes('n') ? -6 : 'auto',
                            bottom: corner.includes('s') ? -6 : 'auto',
                            left: corner.includes('w') ? -6 : 'auto',
                            right: corner.includes('e') ? -6 : 'auto',
                          }}
                          onMouseDown={(e) => handleResize(element.id, corner, e)}
                        />
                      ))}
                    </>
                  )}
                </div>
              ))}

            {/* Temp element while drawing */}
            {tempElement && (
              <div
                className="absolute pointer-events-none border-2 border-dashed border-[#08CF65]"
                style={{
                  left: tempElement.x * scale,
                  top: tempElement.y * scale,
                  width: tempElement.width * scale,
                  height: tempElement.height * scale,
                  backgroundColor: tempElement.fillColor,
                  opacity: tempElement.opacity,
                }}
              />
            )}
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
