import { NextRequest, NextResponse } from 'next/server'

// Proxy API pour servir les PDFs depuis R2 (contourne CORS)
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/')
    const pdfUrl = `${process.env.R2_PUBLIC_URL}/${path}`
    
    console.log('[PDF Proxy] Fetching:', pdfUrl)
    
    // Fetch le PDF depuis R2
    const response = await fetch(pdfUrl)
    
    if (!response.ok) {
      console.error('[PDF Proxy] Failed to fetch PDF:', response.status)
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }
    
    const pdfBuffer = await response.arrayBuffer()
    
    // Retourner le PDF avec les headers CORS appropriés
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('[PDF Proxy] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 500 })
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
