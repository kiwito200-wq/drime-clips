import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getSignedDownloadUrl } from '@/lib/storage'

interface Params {
  params: {
    slug: string
  }
}

// GET /api/envelopes/[slug]/download - Download the PDF
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    
    // SECURITY: Require authentication - no exceptions
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const envelope = await prisma.envelope.findFirst({
      where: {
        slug: params.slug,
        userId: user.id,
      },
    })

    if (!envelope) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 })
    }

    // Use final PDF if available, otherwise use original
    const pdfUrl = envelope.finalPdfUrl || envelope.pdfUrl
    
    if (!pdfUrl) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }

    // Extract key from URL and generate signed URL for download
    let downloadUrl = pdfUrl
    
    // If it's a Cloudflare R2 URL, generate a signed URL
    if (pdfUrl.includes('r2.cloudflarestorage.com')) {
      const urlParts = new URL(pdfUrl)
      const key = urlParts.pathname.replace(/^\/[^/]+\//, '') // Remove bucket name
      downloadUrl = await getSignedDownloadUrl(key)
    }

    // Fetch the PDF
    const pdfResponse = await fetch(downloadUrl)
    
    if (!pdfResponse.ok) {
      console.error('[Download] Failed to fetch PDF:', pdfResponse.status)
      return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 500 })
    }

    const pdfBuffer = await pdfResponse.arrayBuffer()
    
    // Create filename from envelope name
    const filename = `${envelope.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`

    // Return the PDF as a download
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.byteLength),
      },
    })
  } catch (error) {
    console.error('[GET /api/envelopes/[slug]/download] Error:', error)
    return NextResponse.json({ error: 'Failed to download PDF' }, { status: 500 })
  }
}
