/**
 * Generate a thumbnail from the first page of a PDF
 * Uses pdfjs-dist without worker for maximum compatibility
 * @param file - The PDF file
 * @param size - Thumbnail size (default 150px)
 * @returns A Blob containing the PNG thumbnail, or null if failed
 */
export async function generatePdfThumbnail(file: File, size: number = 150): Promise<Blob | null> {
  // Skip thumbnail generation on server-side
  if (typeof window === 'undefined') {
    console.log('[PDF Thumbnail] Skipping - server side')
    return null
  }

  try {
    // Dynamically import pdfjs
    const pdfjs = await import('pdfjs-dist')
    
    // Disable worker for maximum compatibility (works for small-medium PDFs)
    pdfjs.GlobalWorkerOptions.workerSrc = ''
    
    const arrayBuffer = await file.arrayBuffer()
    
    // Use getDocument with disableWorker option
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      // @ts-ignore - disableWorker exists but might not be in types
      disableWorker: true,
      // @ts-ignore
      isEvalSupported: false,
    })
    
    const pdf = await loadingTask.promise
    const page = await pdf.getPage(1)
    
    const viewport = page.getViewport({ scale: 1 })
    const scale = size / Math.min(viewport.width, viewport.height)
    const scaledViewport = page.getViewport({ scale })
    
    const canvas = document.createElement('canvas')
    canvas.width = scaledViewport.width
    canvas.height = scaledViewport.height
    
    const context = canvas.getContext('2d')
    if (!context) {
      console.log('[PDF Thumbnail] Failed to get canvas context')
      return null
    }
    
    // Fill with white background
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
    }).promise
    
    // Cleanup
    page.cleanup()
    pdf.destroy()
    
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob)
      }, 'image/png', 0.85)
    })
  } catch (error) {
    console.error('[PDF Thumbnail] Error generating thumbnail:', error)
    return null
  }
}
