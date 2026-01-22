/**
 * Drime PDF Thumbnail Worker
 * 
 * Generates thumbnails from PDFs using pdf.js
 * 
 * Endpoints:
 * - POST /generate : { pdfUrl: string, width?: number } → PNG image
 * - GET /health : Health check
 */

import * as pdfjsLib from 'pdfjs-dist'

// Polyfill for OffscreenCanvas if not available
declare const OffscreenCanvas: any

interface Env {
  ALLOWED_ORIGINS: string
}

// Simple canvas-like interface for pdf.js
class SimpleCanvasContext {
  private commands: any[] = []
  
  fillRect() {}
  strokeRect() {}
  clearRect() {}
  fillText() {}
  strokeText() {}
  measureText() { return { width: 0 } }
  getImageData() { return { data: new Uint8ClampedArray(0) } }
  putImageData() {}
  createImageData() { return { data: new Uint8ClampedArray(0) } }
  setTransform() {}
  resetTransform() {}
  transform() {}
  scale() {}
  rotate() {}
  translate() {}
  save() {}
  restore() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  arc() {}
  arcTo() {}
  ellipse() {}
  rect() {}
  fill() {}
  stroke() {}
  clip() {}
  isPointInPath() { return false }
  isPointInStroke() { return false }
  drawImage() {}
  createPattern() { return null }
  createLinearGradient() { return { addColorStop: () => {} } }
  createRadialGradient() { return { addColorStop: () => {} } }
  
  set fillStyle(_: any) {}
  set strokeStyle(_: any) {}
  set lineWidth(_: any) {}
  set lineCap(_: any) {}
  set lineJoin(_: any) {}
  set miterLimit(_: any) {}
  set lineDashOffset(_: any) {}
  set shadowOffsetX(_: any) {}
  set shadowOffsetY(_: any) {}
  set shadowBlur(_: any) {}
  set shadowColor(_: any) {}
  set globalAlpha(_: any) {}
  set globalCompositeOperation(_: any) {}
  set font(_: any) {}
  set textAlign(_: any) {}
  set textBaseline(_: any) {}
  set direction(_: any) {}
  
  getLineDash() { return [] }
  setLineDash() {}
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') || ''
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS.includes(origin) ? origin : env.ALLOWED_ORIGINS.split(',')[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', version: '1.0.0' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate thumbnail
    if (url.pathname === '/generate' && request.method === 'POST') {
      try {
        const body = await request.json() as { pdfUrl?: string; pdfBase64?: string; width?: number }
        const { pdfUrl, pdfBase64, width = 150 } = body

        if (!pdfUrl && !pdfBase64) {
          return new Response(JSON.stringify({ error: 'pdfUrl or pdfBase64 required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Get PDF data
        let pdfData: ArrayBuffer
        
        if (pdfBase64) {
          // Decode base64
          const binaryString = atob(pdfBase64)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          pdfData = bytes.buffer
        } else {
          // Fetch PDF from URL
          const pdfResponse = await fetch(pdfUrl!)
          if (!pdfResponse.ok) {
            return new Response(JSON.stringify({ error: 'Failed to fetch PDF' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
          pdfData = await pdfResponse.arrayBuffer()
        }

        // Check if OffscreenCanvas is available (Workers usually have it)
        let canvas: any
        let context: any
        
        if (typeof OffscreenCanvas !== 'undefined') {
          // Use OffscreenCanvas (available in Workers)
          canvas = new OffscreenCanvas(width, Math.round(width * 1.414)) // A4 ratio
          context = canvas.getContext('2d')
        } else {
          // Fallback - return a simple placeholder or error
          return new Response(JSON.stringify({ 
            error: 'OffscreenCanvas not available',
            message: 'This worker environment does not support rendering'
          }), {
            status: 501,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Disable worker for pdf.js (we ARE the worker)
        pdfjsLib.GlobalWorkerOptions.workerSrc = ''

        // Load PDF
        const loadingTask = pdfjsLib.getDocument({ data: pdfData })
        const pdfDoc = await loadingTask.promise
        const page = await pdfDoc.getPage(1)
        
        // Calculate scale
        const viewport = page.getViewport({ scale: 1 })
        const scale = width / viewport.width
        const scaledViewport = page.getViewport({ scale })
        
        // Resize canvas
        canvas.width = Math.round(scaledViewport.width)
        canvas.height = Math.round(scaledViewport.height)
        
        // White background
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        
        // Render page
        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise
        
        // Convert to blob
        const blob = await canvas.convertToBlob({ type: 'image/png', quality: 0.9 })
        
        // Return image
        return new Response(blob, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000',
          },
        })
        
      } catch (error: any) {
        console.error('Thumbnail generation error:', error)
        return new Response(JSON.stringify({ 
          error: 'Failed to generate thumbnail',
          details: error.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders })
  },
}
