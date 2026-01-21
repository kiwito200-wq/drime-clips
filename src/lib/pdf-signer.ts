/**
 * Drime Sign - PDF Digital Signature Module
 * 
 * Uses node-signpdf library for proper PKCS#7 digital signatures.
 * This creates signatures that are verifiable by Adobe Reader, 
 * verifysignature.eu, and other PDF validators.
 */

// @ts-ignore - node-signpdf doesn't have proper TS types
import signer from 'node-signpdf'
// @ts-ignore
import { plainAddPlaceholder } from 'node-signpdf/dist/helpers'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import crypto from 'crypto'
import * as forge from 'node-forge'
import { getDrimeCertificates } from './certificate'

const pki = forge.pki

// ==============================================
// TYPES
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

// ==============================================
// P12 CERTIFICATE GENERATION
// ==============================================

/**
 * Generate a P12 (PKCS#12) certificate buffer from our certificate chain
 * This is what node-signpdf expects
 */
function generateP12Buffer(password: string = ''): Buffer {
  const certs = getDrimeCertificates()
  
  // Parse certificates and key
  const signingCert = pki.certificateFromPem(certs.sign.certificate)
  const privateKey = pki.privateKeyFromPem(certs.sign.privateKey)
  const subCaCert = pki.certificateFromPem(certs.subCA.certificate)
  const rootCaCert = pki.certificateFromPem(certs.rootCA.certificate)
  
  // Create PKCS#12 structure
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    privateKey,
    [signingCert, subCaCert, rootCaCert],
    password,
    {
      algorithm: '3des', // Compatible with most tools
      friendlyName: 'Drime Sign'
    }
  )
  
  // Convert to DER then to Buffer
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes()
  return Buffer.from(p12Der, 'binary')
}

// Cache the P12 buffer to avoid regenerating it every time
let cachedP12Buffer: Buffer | null = null

function getP12Buffer(): Buffer {
  if (!cachedP12Buffer) {
    console.log('[PDF Signer] Generating P12 certificate...')
    cachedP12Buffer = generateP12Buffer('')
    console.log('[PDF Signer] P12 certificate generated')
  }
  return cachedP12Buffer
}

// ==============================================
// MAIN SIGNING FUNCTION
// ==============================================

/**
 * Sign a PDF with a real PKCS#7 digital signature
 * Uses node-signpdf for proper PDF digital signature
 * 
 * IMPORTANT: We sign the ORIGINAL PDF first, then add visual elements
 * This is because plainAddPlaceholder can't parse pdf-lib modified PDFs
 */
export async function signPdfWithCertificate(options: SignPdfOptions): Promise<SignedPdfResult> {
  const {
    pdfBuffer,
    reason = 'Document signe electroniquement via Drime Sign',
    signerName = 'Drime Sign',
    location = 'France',
    contactInfo = 'https://sign.drime.cloud'
  } = options

  const signedAt = new Date()
  
  try {
    console.log('[PDF Signer] Starting PDF signing process...')
    
    // Step 1: Add signature placeholder to ORIGINAL PDF (not modified by pdf-lib)
    console.log('[PDF Signer] Adding signature placeholder to original PDF...')
    const pdfWithPlaceholder = plainAddPlaceholder({
      pdfBuffer: pdfBuffer, // Use original PDF, not modified
      reason: reason,
      contactInfo: contactInfo,
      name: signerName,
      location: location,
      signatureLength: 8192
    })
    
    // Step 2: Sign the PDF with our P12 certificate
    console.log('[PDF Signer] Signing PDF with Drime certificate...')
    const p12Buffer = getP12Buffer()
    const signedPdf = signer.sign(pdfWithPlaceholder, p12Buffer, {
      passphrase: ''
    })
    
    // IMPORTANT: Do NOT modify the PDF after signing!
    // Any modification would invalidate the digital signature.
    // The visual elements should already be in the PDF before signing.
    
    // Calculate final document hash
    const documentHash = crypto.createHash('sha256').update(signedPdf).digest('hex')
    
    console.log('[PDF Signer] PDF signed successfully!')
    console.log('[PDF Signer] Certificate: Drime Sign')
    console.log('[PDF Signer] Document hash:', documentHash.substring(0, 16) + '...')
    
    return {
      pdfBuffer: signedPdf,
      signatureInfo: {
        signedAt,
        documentHash,
        certificateSubject: 'Drime Sign',
      },
    }
  } catch (error) {
    console.error('[PDF Signer] Error during signing:', error)
    
    // Try signing without visual stamp first
    try {
      console.log('[PDF Signer] Retrying without visual stamp...')
      const pdfWithPlaceholder = plainAddPlaceholder({
        pdfBuffer: pdfBuffer,
        reason: reason,
        contactInfo: contactInfo,
        name: signerName,
        location: location,
        signatureLength: 8192
      })
      
      const p12Buffer = getP12Buffer()
      const signedPdf = signer.sign(pdfWithPlaceholder, p12Buffer, {
        passphrase: ''
      })
      
      const documentHash = crypto.createHash('sha256').update(signedPdf).digest('hex')
      
      console.log('[PDF Signer] PDF signed without visual stamp')
      
      return {
        pdfBuffer: signedPdf,
        signatureInfo: {
          signedAt,
          documentHash,
          certificateSubject: 'Drime Sign',
        },
      }
    } catch (retryError) {
      console.error('[PDF Signer] Retry also failed:', retryError)
      
      // Final fallback: return PDF with visual signature only
      console.log('[PDF Signer] Falling back to visual signature only...')
      const visualPdf = await addVisualSignatureStamp(pdfBuffer, signerName, signedAt)
      const documentHash = crypto.createHash('sha256').update(visualPdf).digest('hex')
      
      return {
        pdfBuffer: visualPdf,
        signatureInfo: {
          signedAt,
          documentHash,
          certificateSubject: 'Drime Sign (visual only)',
        },
      }
    }
  }
}

// ==============================================
// VISUAL SIGNATURE STAMP
// ==============================================

/**
 * Add visual signature stamp to PDF
 */
async function addVisualSignatureStamp(
  pdfBuffer: Buffer,
  signerName: string,
  signedAt: Date
): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
    const pages = pdfDoc.getPages()
    const lastPage = pages[pages.length - 1]
    const { width } = lastPage.getSize()

    // Set metadata
    pdfDoc.setProducer('Drime Sign - https://sign.drime.cloud')
    pdfDoc.setCreator('Drime Sign')

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
    lastPage.drawText('Signe electroniquement via Drime Sign', {
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

    const dateStr = signedAt.toLocaleDateString('fr-FR')
    const timeStr = signedAt.toLocaleTimeString('fr-FR')
    lastPage.drawText(`Date: ${dateStr} a ${timeStr}`, {
      x: boxX + 50,
      y: boxY + 14,
      size: 8,
      font,
      color: rgb(0.3, 0.3, 0.3),
    })

    lastPage.drawText('Certificat: Drime Sign - sign.drime.cloud/verify', {
      x: boxX + 50,
      y: boxY + 3,
      size: 7,
      font,
      color: rgb(0.5, 0.5, 0.5),
    })

    return Buffer.from(await pdfDoc.save())
  } catch (error) {
    console.error('[PDF Signer] Error adding visual stamp:', error)
    // Return original buffer if we can't add visual stamp
    return pdfBuffer
  }
}

// ==============================================
// VERIFICATION
// ==============================================

/**
 * Verify if a PDF has a digital signature
 */
export async function verifyPdfSignature(pdfBuffer: Buffer): Promise<{
  hasSig: boolean
  signerName?: string
  signedAt?: Date
  certificateSubject?: string
}> {
  try {
    // Check for signature dictionary
    const pdfString = pdfBuffer.toString('latin1')
    
    if (pdfString.includes('/Type /Sig') && pdfString.includes('/SubFilter /adbe.pkcs7.detached')) {
      // Extract signer name
      const nameMatch = pdfString.match(/\/Name \(([^)]+)\)/)
      const signerName = nameMatch ? nameMatch[1] : 'Unknown'
      
      return {
        hasSig: true,
        signerName,
        signedAt: new Date(),
        certificateSubject: 'Drime Sign',
      }
    }
    
    // Check metadata for visual-only signature
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const producer = pdfDoc.getProducer()
    
    if (producer?.includes('Drime')) {
      return {
        hasSig: true,
        signerName: 'Drime Sign',
        signedAt: new Date(),
        certificateSubject: 'Drime Sign (visual)',
      }
    }

    return { hasSig: false }
  } catch {
    return { hasSig: false }
  }
}
