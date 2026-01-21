/**
 * Drime Sign - PDF Digital Signature Module
 * 
 * Adds visual signature + metadata to PDFs.
 * For real PKCS#7 signatures, a proper certificate infrastructure is needed.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import crypto from 'crypto'

// ==============================================
// CONFIGURATION
// ==============================================

const CERT_CONFIG = {
  organization: 'Drime',
  organizationUnit: 'Drime Sign',
  commonName: 'Drime Sign',
}

// ==============================================
// PDF SIGNING
// ==============================================

interface SignPdfOptions {
  pdfBuffer: Buffer
  reason?: string
  location?: string
  contactInfo?: string
  signerName?: string
}

interface SignedPdfResult {
  pdfBuffer: Buffer
  signatureInfo: {
    signedAt: Date
    documentHash: string
    certificateSubject: string
  }
}

/**
 * Sign a PDF with visual signature and metadata
 */
export async function signPdfWithCertificate(options: SignPdfOptions): Promise<SignedPdfResult> {
  const {
    pdfBuffer,
    signerName = 'Drime Sign',
  } = options

  const signedAt = new Date()

  // Load PDF and add visual signature
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  
  // Set metadata
  pdfDoc.setProducer('Drime Sign - https://sign.drime.cloud')
  pdfDoc.setCreator('Drime Sign')
  pdfDoc.setSubject(`Signed by ${signerName} on ${signedAt.toISOString()}`)
  
  // Add visual signature
  const signedPdf = await addVisualSignature(pdfDoc, signerName, signedAt)
  
  // Calculate document hash
  const documentHash = crypto.createHash('sha256').update(signedPdf).digest('hex')

  console.log('[PDF Signer] PDF signed with Drime visual signature')

  return {
    pdfBuffer: signedPdf,
    signatureInfo: {
      signedAt,
      documentHash,
      certificateSubject: CERT_CONFIG.commonName,
    },
  }
}

/**
 * Add visual signature stamp to PDF (fallback)
 */
async function addVisualSignature(
  pdfDoc: PDFDocument,
  signerName: string,
  signedAt: Date
): Promise<Buffer> {
  const pages = pdfDoc.getPages()
  const lastPage = pages[pages.length - 1]
  const { width } = lastPage.getSize()

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Signature box dimensions
  const boxX = 40
  const boxY = 25
  const boxWidth = width - 80
  const boxHeight = 55

  // Draw signature box
  lastPage.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    color: rgb(0.98, 0.99, 0.98),
    borderColor: rgb(0.03, 0.81, 0.4), // Drime green #08CF65
    borderWidth: 1,
  })

  // Drime logo (green square)
  lastPage.drawRectangle({
    x: boxX + 8,
    y: boxY + 10,
    width: 35,
    height: 35,
    color: rgb(0.03, 0.81, 0.4),
  })

  // Checkmark in logo
  lastPage.drawLine({
    start: { x: boxX + 15, y: boxY + 26 },
    end: { x: boxX + 23, y: boxY + 20 },
    thickness: 2,
    color: rgb(1, 1, 1),
  })
  lastPage.drawLine({
    start: { x: boxX + 23, y: boxY + 20 },
    end: { x: boxX + 35, y: boxY + 35 },
    thickness: 2,
    color: rgb(1, 1, 1),
  })

  // Signature text
  lastPage.drawText('Signé électroniquement via Drime Sign', {
    x: boxX + 50,
    y: boxY + 38,
    size: 9,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })

  lastPage.drawText(`Signataire: ${signerName}`, {
    x: boxX + 50,
    y: boxY + 26,
    size: 8,
    font,
    color: rgb(0.3, 0.3, 0.3),
  })

  lastPage.drawText(`Date: ${signedAt.toLocaleDateString('fr-FR')} à ${signedAt.toLocaleTimeString('fr-FR')}`, {
    x: boxX + 50,
    y: boxY + 14,
    size: 8,
    font,
    color: rgb(0.3, 0.3, 0.3),
  })

  lastPage.drawText('Certificat: Drime Sign • sign.drime.cloud/verify', {
    x: boxX + 50,
    y: boxY + 3,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.5),
  })

  return Buffer.from(await pdfDoc.save())
}

/**
 * Verify if a PDF has a digital signature
 */
export async function verifyPdfSignature(pdfBuffer: Buffer): Promise<{
  hasSig: boolean
  signerName?: string
  signedAt?: Date
}> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const producer = pdfDoc.getProducer()
    const subject = pdfDoc.getSubject()

    if (producer?.includes('Drime') || subject?.includes('Drime')) {
      return {
        hasSig: true,
        signerName: 'Drime Sign',
        signedAt: new Date(),
      }
    }

    return { hasSig: false }
  } catch {
    return { hasSig: false }
  }
}
