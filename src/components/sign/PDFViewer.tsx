'use client'

import { useState, useRef, useEffect, useCallback, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { thumbnailCache } from '@/lib/thumbnail-cache'

interface PDFViewerProps {
  fileUrl: string
  onPagesLoaded: (pages: { width: number; height: number; imageUrl?: string | null }[]) => void
  scale: number
  onScaleChange: (scale: number) => void
  currentPage: number
  onPageChange: (page: number) => void
  isDrawMode: boolean
  onDraw: (page: number, x: number, y: number) => void
  onDrop: (page: number, x: number, y: number) => void
  isDragging: boolean
  children: ReactNode
}

interface PDFPageData {
  pageNumber: number
  width: number
  height: number
  canvas: HTMLCanvasElement | null
  imageUrl: string | null
}

export default function PDFViewer({
  fileUrl,
  onPagesLoaded,
  scale,
  onScaleChange,
  currentPage,
  onPageChange,
  isDrawMode,
  onDraw,
  onDrop,
  isDragging,
  children,
}: PDFViewerProps) {
  const [pages, setPages] = useState<PDFPageData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<any>(null)
  
  // Load PDF using PDF.js
  useEffect(() => {
    let cancelled = false

    const loadPDF = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // First, fetch the blob URL and convert to ArrayBuffer
        const response = await fetch(fileUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF file: ${response.status} ${response.statusText}`)
        }

        const arrayBuffer = await response.arrayBuffer()


        if (cancelled) return

        // Dynamically import PDF.js
        const pdfjsLib = await import('pdfjs-dist')
        
        // Set worker using jsdelivr CDN
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

        // Load the PDF document from ArrayBuffer
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
        const pdfDoc = await loadingTask.promise
        
        if (cancelled) return
        
        pdfDocRef.current = pdfDoc
        const numPages = pdfDoc.numPages
        const loadedPages: PDFPageData[] = []

        // Load each page
        for (let i = 1; i <= numPages; i++) {
          const page = await pdfDoc.getPage(i)
          const viewport = page.getViewport({ scale: 1.5 }) // Base scale for quality
          
          // Check cache first
          const cached = thumbnailCache.get(fileUrl, i)
          if (cached) {
            loadedPages.push({
              pageNumber: i,
              width: cached.width,
              height: cached.height,
              canvas: null,
              imageUrl: cached.imageUrl,
            })
            continue
          }
          
          // Create canvas for this page
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          canvas.width = viewport.width
          canvas.height = viewport.height

          // Render page to canvas
          await page.render({
            canvasContext: context!,
            viewport: viewport,
          }).promise

          // Convert to image URL for better performance
          const imageUrl = canvas.toDataURL('image/png')
          
          // Store in cache
          thumbnailCache.set(fileUrl, i, imageUrl, viewport.width, viewport.height)

          loadedPages.push({
            pageNumber: i,
            width: viewport.width,
            height: viewport.height,
            canvas,
            imageUrl,
          })
        }

        if (cancelled) return

        setPages(loadedPages)
        onPagesLoaded(loadedPages.map(p => ({ width: p.width, height: p.height, imageUrl: p.imageUrl })))
        setIsLoading(false)
      } catch (err) {
        if (cancelled) return
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : 'Unknown error'}`)
        setIsLoading(false)
      }
    }

    loadPDF()

    return () => {
      cancelled = true
    }
  }, [fileUrl, onPagesLoaded])

  // Handle click on page (for draw mode)
  const handlePageClick = useCallback((e: React.MouseEvent, pageIndex: number) => {
    if (!isDrawMode) return

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    onDraw(pageIndex, x, y)
  }, [isDrawMode, onDraw])

  // Handle drop on page
  const handleDrop = useCallback((e: React.DragEvent, pageIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    onDrop(pageIndex, x, y)
  }, [onDrop])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // Zoom controls
  const zoomIn = useCallback(() => {
    onScaleChange(Math.min(scale + 0.25, 3))
  }, [scale, onScaleChange])

  const zoomOut = useCallback(() => {
    onScaleChange(Math.max(scale - 0.25, 0.5))
  }, [scale, onScaleChange])

  const resetZoom = useCallback(() => {
    onScaleChange(1)
  }, [onScaleChange])

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#08CF65] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading document...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      {/* Zoom Controls */}
      <div className="sticky top-0 z-10 bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Page {currentPage + 1} of {pages.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom out"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={resetZoom}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200 transition-colors min-w-[60px]"
            title="Reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={scale >= 3}
            className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom in"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div className="w-24" /> {/* Spacer */}
      </div>

      {/* Pages Container */}
      <div className="flex-1 overflow-auto p-6">
        <div className="flex flex-col items-center gap-6">
          {pages.map((page, index) => (
            <motion.div
              key={page.pageNumber}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-white shadow-lg rounded-sm overflow-hidden ${
                isDrawMode ? 'cursor-crosshair' : ''
              } ${isDragging ? 'ring-2 ring-[#08CF65] ring-opacity-50' : ''}`}
              style={{
                width: page.width * scale,
                height: page.height * scale,
              }}
              onClick={(e) => handlePageClick(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragOver={handleDragOver}
              data-page={index}
            >
              {/* PDF Page Image */}
              {page.imageUrl && (
                <img
                  src={page.imageUrl}
                  alt={`Page ${index + 1}`}
                  className="w-full h-full object-contain pointer-events-none select-none"
                  draggable={false}
                />
              )}
              
              {/* Field Overlay Container */}
              <div className="absolute inset-0">
                {Array.isArray(children) ? children[index] : null}
              </div>

              {/* Page Number Badge */}
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                {index + 1}
              </div>

              {/* Drop Indicator */}
              {isDragging && (
                <div className="absolute inset-0 bg-[#08CF65]/5 border-2 border-dashed border-[#08CF65]/30 pointer-events-none" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
