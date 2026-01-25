/**
 * Generate a thumbnail from the first page of a PDF
 * Uses Cloudflare Worker if configured, otherwise falls back to client-side
 */

const WORKER_URL = process.env.NEXT_PUBLIC_THUMBNAIL_WORKER_URL

/**
 * Generate thumbnail using Cloudflare Worker (server-side, reliable)
 */
export async function generateThumbnailViaWorker(pdfUrl: string, width: number = 600): Promise<Blob | null> {
  if (!WORKER_URL) {
    console.log('[PDF Thumbnail] No worker URL configured')
    return null
  }

  try {
    const response = await fetch(`${WORKER_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfUrl, width }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      console.error('[PDF Thumbnail] Worker error:', error)
      return null
    }

    return await response.blob()
  } catch (error) {
    console.error('[PDF Thumbnail] Worker request failed:', error)
    return null
  }
}

/**
 * Generate thumbnail client-side using pdf.js
 * Fallback when worker is not available
 */
export async function generatePdfThumbnail(file: File, size: number = 600): Promise<Blob | null> {
  // Skip on server-side
  if (typeof window === 'undefined') {
    return null
  }

  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Dynamically import PDF.js
    const pdfjsLib = await import('pdfjs-dist')
    
    // Set worker using jsdelivr CDN
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
        pdfDoc.destroy()
        resolve(blob)
      }, 'image/png', 0.9)
    })
    
  } catch (error) {
    console.error('[PDF Thumbnail] Error generating thumbnail:', error)
    return null
  }
}
