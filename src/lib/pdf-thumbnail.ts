/**
 * Generate a thumbnail from the first page of a PDF
 * @param file - The PDF file
 * @param size - Thumbnail size (default 150px)
 * @returns A Blob containing the PNG thumbnail, or null if failed
 */
export async function generatePdfThumbnail(file: File, size: number = 150): Promise<Blob | null> {
  // Skip on server-side
  if (typeof window === 'undefined') {
    return null
  }

  return new Promise(async (resolve) => {
    try {
      // Load PDF.js from CDN dynamically
      const pdfjsLib = await loadPdfJs()
      if (!pdfjsLib) {
        console.error('[PDF Thumbnail] Failed to load PDF.js')
        resolve(null)
        return
      }

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const page = await pdf.getPage(1)
      
      const viewport = page.getViewport({ scale: 1 })
      const scale = size / Math.min(viewport.width, viewport.height)
      const scaledViewport = page.getViewport({ scale })
      
      const canvas = document.createElement('canvas')
      canvas.width = scaledViewport.width
      canvas.height = scaledViewport.height
      
      const context = canvas.getContext('2d')
      if (!context) {
        resolve(null)
        return
      }
      
      // White background
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      
      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
      }).promise
      
      canvas.toBlob((blob) => {
        resolve(blob)
      }, 'image/png', 0.85)
      
    } catch (error) {
      console.error('[PDF Thumbnail] Error:', error)
      resolve(null)
    }
  })
}

// Load PDF.js from CDN
async function loadPdfJs(): Promise<any> {
  // Check if already loaded
  if ((window as any).pdfjsLib) {
    return (window as any).pdfjsLib
  }

  return new Promise((resolve) => {
    // Create script element for PDF.js
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib
      if (pdfjsLib) {
        // Set worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        resolve(pdfjsLib)
      } else {
        resolve(null)
      }
    }
    script.onerror = () => {
      console.error('[PDF Thumbnail] Failed to load PDF.js script')
      resolve(null)
    }
    document.head.appendChild(script)
  })
}
