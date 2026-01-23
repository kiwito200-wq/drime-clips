import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getSignedDownloadUrl } from '@/lib/storage'
import JSZip from 'jszip'

// POST /api/envelopes/download-zip - Download multiple PDFs as ZIP
export async function POST(request: NextRequest) {
  try {
    let user = await getCurrentUser()
    
    if (!user) {
      const devEmail = 'dev@drime.cloud'
      user = await prisma.user.upsert({
        where: { email: devEmail },
        update: {},
        create: {
          email: devEmail,
          name: 'Dev User',
        },
      })
    }

    const { slugs } = await request.json()
    
    if (!slugs || !Array.isArray(slugs) || slugs.length === 0) {
      return NextResponse.json({ error: 'No documents specified' }, { status: 400 })
    }

    // Get all envelopes
    const envelopes = await prisma.envelope.findMany({
      where: {
        slug: { in: slugs },
        userId: user.id,
      },
    })

    if (envelopes.length === 0) {
      return NextResponse.json({ error: 'No documents found' }, { status: 404 })
    }

    // Create ZIP
    const zip = new JSZip()
    
    for (const envelope of envelopes) {
      const pdfUrl = envelope.finalPdfUrl || envelope.pdfUrl
      if (!pdfUrl) continue
      
      let downloadUrl = pdfUrl
      
      // Generate signed URL if needed
      if (pdfUrl.includes('r2.cloudflarestorage.com')) {
        const urlParts = new URL(pdfUrl)
        const key = urlParts.pathname.replace(/^\/[^/]+\//, '')
        downloadUrl = await getSignedDownloadUrl(key)
      }

      try {
        const pdfResponse = await fetch(downloadUrl)
        if (pdfResponse.ok) {
          const pdfBuffer = await pdfResponse.arrayBuffer()
          const filename = `${envelope.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
          zip.file(filename, pdfBuffer)
        }
      } catch (err) {
        console.error(`Failed to fetch PDF for ${envelope.slug}:`, err)
      }
    }

    // Generate ZIP
    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })
    
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const zipFilename = `documents_${dateStr}.zip`

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': String(zipBuffer.byteLength),
      },
    })
  } catch (error) {
    console.error('[POST /api/envelopes/download-zip] Error:', error)
    return NextResponse.json({ error: 'Failed to create ZIP' }, { status: 500 })
  }
}
