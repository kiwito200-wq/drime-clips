import * as pdfjs from 'pdfjs-dist'

// Set worker path for PDF.js
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`
}

/**
 * Generate a thumbnail from the first page of a PDF
 * @param file - The PDF file
 * @param size - Thumbnail size (default 96px)
 * @returns A Blob containing the PNG thumbnail
 */
export async function generatePdfThumbnail(file: File, size: number = 96): Promise<Blob | null> {
  try {
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
    if (!context) return null
    
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
    console.error('Error generating PDF thumbnail:', error)
    return null
  }
}
