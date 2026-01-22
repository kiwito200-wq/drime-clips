/**
 * Generate a thumbnail from the first page of a PDF
 * Uses the same approach as PDFViewer.tsx which is proven to work
 * @param file - The PDF file
 * @param size - Thumbnail width (default 150px)
 * @returns A Blob containing the PNG thumbnail, or null if failed
 */
export async function generatePdfThumbnail(file: File, size: number = 150): Promise<Blob | null> {
  // Skip on server-side
  if (typeof window === 'undefined') {
    return null
  }

  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Dynamically import PDF.js (same as PDFViewer.tsx)
    const pdfjsLib = await import('pdfjs-dist')
    
    // Set worker using jsdelivr CDN (same as PDFViewer.tsx)
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdfDoc = await loadingTask.promise
    
    // Get first page
    const page = await pdfDoc.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    
    // Calculate scale to fit thumbnail size
    const scale = size / viewport.width
    const scaledViewport = page.getViewport({ scale })
    
    // Create canvas
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    if (!context) {
      console.error('[PDF Thumbnail] Failed to get canvas context')
      return null
    }
    
    canvas.width = scaledViewport.width
    canvas.height = scaledViewport.height
    
    // White background
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    // Render page to canvas
    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
    }).promise
    
    // Convert to blob
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => {
        // Cleanup
        pdfDoc.destroy()
        resolve(blob)
      }, 'image/png', 0.9)
    })
    
  } catch (error) {
    console.error('[PDF Thumbnail] Error generating thumbnail:', error)
    return null
  }
}
