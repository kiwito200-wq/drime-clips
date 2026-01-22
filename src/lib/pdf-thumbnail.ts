/**
 * Generate a thumbnail from the first page of a PDF
 * Uses canvas to render the first page
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
    // Dynamically import pdfjs only when needed
    const pdfjs = await import('pdfjs-dist')
    
    // Set up worker - try multiple sources
    try {
      // Try using the bundled worker via dynamic import
      const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs')
      pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker.default
    } catch {
      // Fallback to CDN with specific version
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
    }
    
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
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
    
    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
    }).promise
    
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob)
      }, 'image/png', 0.9)
    })
  } catch (error) {
    console.error('[PDF Thumbnail] Error generating thumbnail:', error)
    // Return null instead of throwing - thumbnails are optional
    return null
  }
}
