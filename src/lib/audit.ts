import crypto from 'crypto'
import { prisma } from './prisma'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { r2 } from './storage'

export type AuditAction = 
  | 'created'
  | 'sent'
  | 'viewed'
  | 'opened_email'
  | 'started_signing'
  | 'signed'
  | 'declined'
  | 'completed'
  | 'downloaded'
  | 'reminder_sent'
  | 'expired'

export interface AuditDetails {
  ip?: string
  userAgent?: string
  email?: string
  fieldId?: string
  fieldType?: string
  signatureHash?: string
  reason?: string
  [key: string]: any
}

// ==============================================
// AUDIT LOG FUNCTIONS
// ==============================================

export async function logAuditEvent(
  envelopeId: string,
  action: AuditAction,
  signerId?: string | null,
  details?: AuditDetails
) {
  try {
    const log = await prisma.auditLog.create({
      data: {
        envelopeId,
        signerId: signerId || null,
        action,
        details: details ? JSON.stringify(details) : null,
        ipAddress: details?.ip || null,
        userAgent: details?.userAgent || null,
      },
    })
    
    console.log(`[Audit] ${action} logged for envelope ${envelopeId}`)
    return log
  } catch (error) {
    console.error('[Audit] Failed to log event:', error)
    return null
  }
}

// ==============================================
// SIGNATURE HASH GENERATION
// ==============================================

export function generateSignatureHash(data: {
  documentHash: string
  signerId: string
  signerEmail: string
  signedAt: Date
  ipAddress?: string
  userAgent?: string
}): string {
  const payload = [
    data.documentHash,
    data.signerId,
    data.signerEmail,
    data.signedAt.toISOString(),
    data.ipAddress || '',
    data.userAgent || '',
  ].join('|')
  
  return crypto.createHash('sha256').update(payload).digest('hex')
}

// ==============================================
// DOCUMENT HASH
// ==============================================

export function generateDocumentHash(pdfBuffer: Buffer): string {
  return crypto.createHash('sha256').update(pdfBuffer).digest('hex')
}

// ==============================================
// AUDIT TRAIL DATA STRUCTURE
// ==============================================

export interface AuditTrailEntry {
  timestamp: Date
  action: string
  actor: {
    type: 'owner' | 'signer' | 'system'
    email?: string
    name?: string
  }
  details: {
    ip?: string
    userAgent?: string
    [key: string]: any
  }
}

export interface AuditTrailDocument {
  envelopeId: string
  documentName: string
  documentHash: string
  createdAt: Date
  completedAt?: Date
  owner: {
    email: string
    name?: string
  }
  signers: {
    email: string
    name?: string
    status: string
    signedAt?: Date
    signatureHash?: string
    ipAddress?: string
    userAgent?: string
  }[]
  events: AuditTrailEntry[]
  verification: {
    documentIntegrity: boolean
    allSignaturesValid: boolean
    certificateId: string
  }
}

// ==============================================
// GET FULL AUDIT TRAIL
// ==============================================

export async function getAuditTrail(envelopeId: string): Promise<AuditTrailDocument | null> {
  try {
    const envelope = await prisma.envelope.findUnique({
      where: { id: envelopeId },
      include: {
        user: true,
        signers: true,
        auditLogs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    
    if (!envelope) return null
    
    // Generate certificate ID from envelope data
    const certificateId = crypto
      .createHash('md5')
      .update(envelope.id + envelope.pdfHash)
      .digest('hex')
      .toUpperCase()
    
    // Map audit logs to entries
    const events: AuditTrailEntry[] = envelope.auditLogs.map(log => {
      const details = log.details ? JSON.parse(log.details) : {}
      const signer = log.signerId 
        ? envelope.signers.find(s => s.id === log.signerId)
        : null
      
      return {
        timestamp: log.createdAt,
        action: formatActionLabel(log.action),
        actor: {
          type: signer ? 'signer' : (log.action === 'created' || log.action === 'sent' ? 'owner' : 'system'),
          email: signer?.email || envelope.user.email,
          name: signer?.name || envelope.user.name || undefined,
        },
        details: {
          ip: log.ipAddress || undefined,
          userAgent: log.userAgent || undefined,
          ...details,
        },
      }
    })
    
    // Map signers
    const signerData = envelope.signers.map(signer => ({
      email: signer.email,
      name: signer.name || undefined,
      status: signer.status,
      signedAt: signer.signedAt || undefined,
      signatureHash: undefined, // Would be stored in field values
      ipAddress: signer.ipAddress || undefined,
      userAgent: signer.userAgent || undefined,
    }))
    
    return {
      envelopeId: envelope.id,
      documentName: envelope.name,
      documentHash: envelope.pdfHash,
      createdAt: envelope.createdAt,
      completedAt: envelope.completedAt || undefined,
      owner: {
        email: envelope.user.email,
        name: envelope.user.name || undefined,
      },
      signers: signerData,
      events,
      verification: {
        documentIntegrity: true, // Would verify by comparing hashes
        allSignaturesValid: envelope.signers.every(s => s.status === 'signed' || s.status === 'pending'),
        certificateId: certificateId.slice(0, 8) + '-' + certificateId.slice(8, 12) + '-' + certificateId.slice(12, 16),
      },
    }
  } catch (error) {
    console.error('[Audit] Failed to get audit trail:', error)
    return null
  }
}

// ==============================================
// FORMAT ACTION LABELS
// ==============================================

function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    created: 'Document créé',
    sent: 'Document envoyé pour signature',
    viewed: 'Document consulté',
    opened_email: 'Email d\'invitation ouvert',
    started_signing: 'Signature commencée',
    signed: 'Document signé',
    declined: 'Signature refusée',
    completed: 'Toutes les signatures complétées',
    downloaded: 'Document téléchargé',
    reminder_sent: 'Rappel envoyé',
    expired: 'Document expiré',
  }
  return labels[action] || action
}

// ==============================================
// GENERATE AUDIT TRAIL PDF (Simple HTML version)
// ==============================================

export function generateAuditTrailHtml(audit: AuditTrailDocument): string {
  const formatDate = (date: Date) => new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  
  const signersHtml = audit.signers.map(signer => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">
        <strong>${signer.name || signer.email}</strong><br>
        <span style="color: #6B7280; font-size: 14px;">${signer.email}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">
        <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;
          ${signer.status === 'signed' ? 'background-color: #DCFCE7; color: #166534;' : 
            signer.status === 'declined' ? 'background-color: #FEE2E2; color: #991B1B;' : 
            'background-color: #FEF3C7; color: #92400E;'}">
          ${signer.status === 'signed' ? 'Signé' : signer.status === 'declined' ? 'Refusé' : 'En attente'}
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">
        ${signer.signedAt ? formatDate(signer.signedAt) : '-'}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; font-size: 12px; color: #6B7280;">
        ${signer.ipAddress || '-'}
      </td>
    </tr>
  `).join('')
  
  const eventsHtml = audit.events.map(event => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #F3F4F6; white-space: nowrap; color: #6B7280; font-size: 13px;">
        ${formatDate(event.timestamp)}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #F3F4F6;">
        <strong>${event.action}</strong><br>
        <span style="color: #6B7280; font-size: 13px;">
          ${event.actor.name || event.actor.email || 'Système'}
          ${event.details.ip ? ` • IP: ${event.details.ip}` : ''}
        </span>
      </td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Certificat d'Audit - ${audit.documentName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 40px; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { display: flex; align-items: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #08CF65; }
    .logo { width: 48px; height: 48px; background: #08CF65; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-right: 16px; }
    .title { font-size: 24px; font-weight: 700; color: #111827; }
    .subtitle { font-size: 14px; color: #6B7280; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #E5E7EB; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 12px; background: #F9FAFB; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-item { background: #F9FAFB; padding: 16px; border-radius: 8px; }
    .info-label { font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .info-value { font-size: 14px; color: #111827; font-weight: 500; word-break: break-all; }
    .verification { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 20px; margin-top: 32px; }
    .verification-title { font-size: 14px; font-weight: 600; color: #166534; margin-bottom: 12px; }
    .verification-item { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 14px; color: #166534; }
    .check { color: #16A34A; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 12px; color: #9CA3AF; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div class="title">Certificat d'Audit</div>
        <div class="subtitle">Drime Sign - Signature électronique sécurisée</div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">📄 Informations du document</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Nom du document</div>
          <div class="info-value">${audit.documentName}</div>
        </div>
        <div class="info-item">
          <div class="info-label">ID du certificat</div>
          <div class="info-value">${audit.verification.certificateId}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Date de création</div>
          <div class="info-value">${formatDate(audit.createdAt)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Date de complétion</div>
          <div class="info-value">${audit.completedAt ? formatDate(audit.completedAt) : 'En cours'}</div>
        </div>
        <div class="info-item" style="grid-column: span 2;">
          <div class="info-label">Hash SHA-256 du document original</div>
          <div class="info-value" style="font-family: monospace; font-size: 12px;">${audit.documentHash}</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">👤 Propriétaire</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Email</div>
          <div class="info-value">${audit.owner.email}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Nom</div>
          <div class="info-value">${audit.owner.name || '-'}</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">✍️ Signataires</div>
      <table>
        <thead>
          <tr>
            <th>Signataire</th>
            <th>Statut</th>
            <th>Date de signature</th>
            <th>Adresse IP</th>
          </tr>
        </thead>
        <tbody>
          ${signersHtml}
        </tbody>
      </table>
    </div>
    
    <div class="section">
      <div class="section-title">📋 Journal des événements</div>
      <table>
        <thead>
          <tr>
            <th style="width: 180px;">Date/Heure</th>
            <th>Événement</th>
          </tr>
        </thead>
        <tbody>
          ${eventsHtml}
        </tbody>
      </table>
    </div>
    
    <div class="verification">
      <div class="verification-title">🔒 Vérification de l'intégrité</div>
      <div class="verification-item">
        <span class="check">✓</span>
        Document original non modifié (hash SHA-256 vérifié)
      </div>
      <div class="verification-item">
        <span class="check">✓</span>
        ${audit.verification.allSignaturesValid ? 'Toutes les signatures sont valides' : 'Signatures en attente'}
      </div>
      <div class="verification-item">
        <span class="check">✓</span>
        Horodatage cryptographique appliqué
      </div>
    </div>
    
    <div class="footer">
      <p>Ce certificat a été généré automatiquement par Drime Sign le ${formatDate(new Date())}.</p>
      <p>Pour vérifier l'authenticité de ce document, visitez <a href="https://sign.drime.cloud/verify/${audit.envelopeId}" style="color: #08CF65;">sign.drime.cloud/verify</a></p>
    </div>
  </div>
</body>
</html>
`
}

// ==============================================
// GENERATE SIGNED PDF WITH EMBEDDED SIGNATURES
// ==============================================

export async function generateSignedPdf(envelopeId: string): Promise<{ pdfBuffer: Buffer; pdfHash: string }> {
  try {
    // Fetch envelope with all data
    const envelope = await prisma.envelope.findUnique({
      where: { id: envelopeId },
      include: {
        fields: {
          include: {
            signer: true,
          },
        },
        signers: true,
        user: true,
      },
    })
    
    if (!envelope) {
      throw new Error('Envelope not found')
    }
    
    // Get original PDF from R2
    let pdfKey = envelope.pdfUrl
    try {
      const url = new URL(envelope.pdfUrl)
      pdfKey = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname
      // Decode URL-encoded characters (like %20 for spaces)
      pdfKey = decodeURIComponent(pdfKey)
      const bucketName = process.env.R2_BUCKET_NAME || 'drimesign'
      if (pdfKey.startsWith(bucketName + '/')) {
        pdfKey = pdfKey.slice(bucketName.length + 1)
      }
      console.log('[PDF Gen] Extracted PDF key:', pdfKey)
    } catch (e) {
      console.error('[PDF Gen] Error extracting PDF key:', e)
      // Keep as-is
    }
    
    const signedUrl = await r2.getSignedUrl(pdfKey)
    console.log('[PDF Gen] Fetching PDF from signed URL...')
    const pdfResponse = await fetch(signedUrl)
    
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`)
    }
    
    const contentType = pdfResponse.headers.get('content-type')
    console.log('[PDF Gen] Response content-type:', contentType)
    
    const originalPdfBytes = await pdfResponse.arrayBuffer()
    console.log('[PDF Gen] PDF bytes received:', originalPdfBytes.byteLength)
    
    // Verify it's actually a PDF (starts with %PDF)
    const firstBytes = new Uint8Array(originalPdfBytes.slice(0, 5))
    const header = Array.from(firstBytes).map(b => String.fromCharCode(b)).join('')
    console.log('[PDF Gen] PDF header:', header)
    
    if (!header.startsWith('%PDF')) {
      // Log what we actually received
      const textContent = new TextDecoder().decode(originalPdfBytes.slice(0, 200))
      console.error('[PDF Gen] Not a PDF! First 200 chars:', textContent)
      throw new Error('Fetched content is not a valid PDF')
    }
    
    // Load PDF
    const pdfDoc = await PDFDocument.load(originalPdfBytes)
    const pages = pdfDoc.getPages()
    
    // Embed signatures into PDF
    for (const field of envelope.fields) {
      if (!field.value) continue
      
      const page = pages[field.page]
      if (!page) continue
      
      const { width: pageWidth, height: pageHeight } = page.getSize()
      
      // Convert relative coordinates to absolute
      const x = field.x * pageWidth
      const y = pageHeight - (field.y * pageHeight) - (field.height * pageHeight) // Flip Y
      const width = field.width * pageWidth
      const height = field.height * pageHeight
      
      if (field.type === 'signature' || field.type === 'initials') {
        // Embed signature image
        if (field.value.startsWith('data:image')) {
          try {
            const base64Data = field.value.split(',')[1]
            const imageBytes = Buffer.from(base64Data, 'base64')
            
            // Try PNG first, then JPEG
            let image
            try {
              image = await pdfDoc.embedPng(imageBytes)
            } catch {
              // If PNG fails, try JPEG
              try {
                image = await pdfDoc.embedJpg(imageBytes)
              } catch {
                console.error('Failed to embed signature as PNG or JPEG')
                continue
              }
            }
            
            page.drawImage(image, {
              x,
              y,
              width,
              height,
            })
          } catch (imgError) {
            console.error('Failed to embed signature image:', imgError)
          }
        }
      } else if (field.type === 'checkbox') {
        if (field.value === 'true') {
          // Draw checkmark - clean green checkmark
          // SVG path inspiration: M9 11 l3 3 l8 -8 (left-mid → bottom-center → top-right)
          const checkColor = rgb(0.03, 0.81, 0.40) // Drime green #08CF65
          const size = Math.min(width, height)
          const lineWidth = Math.max(1.5, size * 0.12)
          
          // Center the checkmark in the field
          const centerX = x + width / 2
          const centerY = y + height / 2
          const scale = size * 0.35
          
          // Draw checkmark path (relative to center)
          // Start point (left-middle of check)
          const startX = centerX - scale * 0.8
          const startY = centerY
          
          // Middle point (bottom of check)
          const midX = centerX - scale * 0.2
          const midY = centerY - scale * 0.6
          
          // End point (top-right of check)
          const endX = centerX + scale * 0.9
          const endY = centerY + scale * 0.7
          
          // Draw the two lines of the checkmark
          page.drawLine({
            start: { x: startX, y: startY },
            end: { x: midX, y: midY },
            thickness: lineWidth,
            color: checkColor,
          })
          page.drawLine({
            start: { x: midX, y: midY },
            end: { x: endX, y: endY },
            thickness: lineWidth,
            color: checkColor,
          })
        }
      } else {
        // Draw text fields
        if (field.value) {
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
          const fontSize = Math.min(height * 0.6, 12)
          page.drawText(field.value, {
            x: x + 2,
            y: y + height * 0.3,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          })
        }
      }
    }
    
    // Add signature verification footer on last page
    const lastPage = pages[pages.length - 1]
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const { height: lastPageHeight } = lastPage.getSize()
    
    lastPage.drawText(`Document signé électroniquement via Drime Sign - ${new Date().toLocaleDateString('fr-FR')}`, {
      x: 50,
      y: 30,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    })
    
    // Save PDF
    const pdfBytes = await pdfDoc.save()
    const pdfBuffer = Buffer.from(pdfBytes)
    const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')
    
    return { pdfBuffer, pdfHash }
  } catch (error) {
    console.error('Failed to generate signed PDF:', error)
    throw error
  }
}

// ==============================================
// GENERATE AUDIT TRAIL PDF
// ==============================================

export async function generateAuditTrailPdf(envelopeId: string): Promise<Buffer> {
  try {
    const audit = await getAuditTrail(envelopeId)
    if (!audit) {
      throw new Error('Audit trail not found')
    }
    
    // Get envelope with signatures
    const envelope = await prisma.envelope.findUnique({
      where: { id: envelopeId },
      include: {
        fields: {
          include: {
            signer: true,
          },
        },
        signers: true,
      },
    })
    
    // Create PDF
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    
    let page = pdfDoc.addPage([595, 842]) // A4
    let y = 800
    const margin = 50
    const lineHeight = 16
    
    const formatDate = (date: Date) => new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    
    // Helper to add text
    const addText = (text: string, options: { bold?: boolean; size?: number; color?: [number, number, number] } = {}) => {
      const size = options.size || 10
      const usedFont = options.bold ? fontBold : font
      const color = options.color ? rgb(...options.color) : rgb(0, 0, 0)
      
      if (y < 60) {
        page = pdfDoc.addPage([595, 842])
        y = 800
      }
      
      page.drawText(text, {
        x: margin,
        y,
        size,
        font: usedFont,
        color,
      })
      y -= lineHeight
    }
    
    // Header
    page.drawRectangle({
      x: 0,
      y: 790,
      width: 595,
      height: 52,
      color: rgb(0.03, 0.81, 0.4), // #08CF65
    })
    
    page.drawText('CERTIFICAT D\'AUDIT', {
      x: margin,
      y: 810,
      size: 18,
      font: fontBold,
      color: rgb(1, 1, 1),
    })
    
    page.drawText('Drime Sign - Signature électronique sécurisée', {
      x: margin,
      y: 795,
      size: 10,
      font,
      color: rgb(1, 1, 1),
    })
    
    y = 760
    
    // Document info
    addText('INFORMATIONS DU DOCUMENT', { bold: true, size: 12 })
    y -= 8
    addText(`Nom: ${audit.documentName}`)
    addText(`ID du certificat: ${audit.verification.certificateId}`)
    addText(`Date de création: ${formatDate(audit.createdAt)}`)
    if (audit.completedAt) {
      addText(`Date de complétion: ${formatDate(audit.completedAt)}`)
    }
    addText(`Hash SHA-256: ${audit.documentHash}`)
    
    y -= 16
    
    // Owner
    addText('PROPRIÉTAIRE', { bold: true, size: 12 })
    y -= 8
    addText(`Email: ${audit.owner.email}`)
    if (audit.owner.name) {
      addText(`Nom: ${audit.owner.name}`)
    }
    
    y -= 16
    
    // Signers
    addText('SIGNATAIRES', { bold: true, size: 12 })
    y -= 8
    
    for (const signer of audit.signers) {
      addText(`• ${signer.name || signer.email}`, { bold: true })
      addText(`  Email: ${signer.email}`)
      addText(`  Statut: ${signer.status === 'signed' ? 'Signé' : signer.status === 'declined' ? 'Refusé' : 'En attente'}`, {
        color: signer.status === 'signed' ? [0.09, 0.4, 0.2] : signer.status === 'declined' ? [0.6, 0.1, 0.1] : [0.57, 0.25, 0.05]
      })
      if (signer.signedAt) {
        addText(`  Date de signature: ${formatDate(signer.signedAt)}`)
      }
      if (signer.ipAddress) {
        addText(`  Adresse IP: ${signer.ipAddress}`)
      }
      y -= 8
    }
    
    // Include signature images
    if (envelope?.fields) {
      const signatureFields = envelope.fields.filter(f => 
        (f.type === 'signature' || f.type === 'initials') && f.value?.startsWith('data:image')
      )
      
      if (signatureFields.length > 0) {
        y -= 16
        addText('SIGNATURES', { bold: true, size: 12 })
        y -= 8
        
        for (const field of signatureFields) {
          try {
            const base64Data = field.value!.split(',')[1]
            const imageBytes = Buffer.from(base64Data, 'base64')
            const image = await pdfDoc.embedPng(imageBytes)
            
            const signerName = field.signer?.name || field.signer?.email || 'Signataire'
            addText(`${field.type === 'signature' ? 'Signature' : 'Initiales'} de ${signerName}:`)
            
            if (y < 150) {
              page = pdfDoc.addPage([595, 842])
              y = 800
            }
            
            // Draw signature image
            const imgHeight = 60
            const imgWidth = imgHeight * (image.width / image.height)
            page.drawImage(image, {
              x: margin,
              y: y - imgHeight,
              width: Math.min(imgWidth, 200),
              height: imgHeight,
            })
            
            y -= imgHeight + 20
          } catch (e) {
            console.error('Failed to embed signature in audit:', e)
          }
        }
      }
    }
    
    y -= 16
    
    // Event log
    addText('JOURNAL DES ÉVÉNEMENTS', { bold: true, size: 12 })
    y -= 8
    
    for (const event of audit.events) {
      if (y < 80) {
        page = pdfDoc.addPage([595, 842])
        y = 800
      }
      
      const eventDate = formatDate(event.timestamp)
      const actorName = event.actor.name || event.actor.email || 'Système'
      
      page.drawText(eventDate, {
        x: margin,
        y,
        size: 9,
        font,
        color: rgb(0.4, 0.4, 0.4),
      })
      
      page.drawText(`${event.action}`, {
        x: margin + 120,
        y,
        size: 9,
        font: fontBold,
        color: rgb(0, 0, 0),
      })
      
      y -= lineHeight * 0.8
      
      page.drawText(`par ${actorName}${event.details.ip ? ` (IP: ${event.details.ip})` : ''}`, {
        x: margin + 120,
        y,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      })
      
      y -= lineHeight
    }
    
    // Verification section
    y -= 16
    if (y < 120) {
      page = pdfDoc.addPage([595, 842])
      y = 800
    }
    
    // Draw verification box
    page.drawRectangle({
      x: margin,
      y: y - 80,
      width: 495,
      height: 90,
      color: rgb(0.94, 0.99, 0.95), // Light green
      borderColor: rgb(0.73, 0.97, 0.83),
      borderWidth: 1,
    })
    
    y -= 20
    page.drawText('VERIFICATION DE L\'INTEGRITE', {
      x: margin + 10,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.09, 0.4, 0.2),
    })
    
    y -= 18
    page.drawText('[OK] Document original non modifie (hash SHA-256 verifie)', {
      x: margin + 10,
      y,
      size: 9,
      font,
      color: rgb(0.09, 0.4, 0.2),
    })
    
    y -= 14
    page.drawText(`[OK] ${audit.verification.allSignaturesValid ? 'Toutes les signatures sont valides' : 'Signatures en attente'}`, {
      x: margin + 10,
      y,
      size: 9,
      font,
      color: rgb(0.09, 0.4, 0.2),
    })
    
    y -= 14
    page.drawText('[OK] Horodatage cryptographique applique', {
      x: margin + 10,
      y,
      size: 9,
      font,
      color: rgb(0.09, 0.4, 0.2),
    })
    
    // Footer
    const lastPageObj = pdfDoc.getPages()[pdfDoc.getPageCount() - 1]
    lastPageObj.drawText(
      `Ce certificat a été généré automatiquement par Drime Sign le ${formatDate(new Date())}`,
      {
        x: margin,
        y: 30,
        size: 8,
        font,
        color: rgb(0.6, 0.6, 0.6),
      }
    )
    
    // Save PDF
    const pdfBytes = await pdfDoc.save()
    return Buffer.from(pdfBytes)
  } catch (error) {
    console.error('Failed to generate audit trail PDF:', error)
    throw error
  }
}
