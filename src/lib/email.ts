import { Resend } from 'resend'

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@sign.drime.cloud'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sign.drime.cloud'
const COMPANY_NAME = 'Drime Sign'

// SECURITY: HTML escape function to prevent XSS in emails
function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// SECURITY: Validate and sanitize URLs
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Only allow https URLs
    if (parsed.protocol !== 'https:') {
      return '#'
    }
    return url
  } catch {
    return '#'
  }
}

// Email styles based on Transfr template
const emailStyles = `
#outlook a { padding:0; }
body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
p { display:block;margin:13px 0; }
body {
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
}
a[x-apple-data-detectors] {
  color: inherit !important;
  text-decoration: none !important;
}
@media only screen and (max-width:459px) {
  .emailify { height:100% !important; margin:0 !important; padding:0 !important; width:100% !important; }
  .content-wrapper { padding: 16px !important; }
  .main-card { border-radius: 16px !important; }
}
`

function getFallbackUrlHtml(url: string): string {
  return `
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%;">
<tbody>
<tr>
<td style="padding: 8px 0 0 0;">
<p style="margin: 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 11px; font-weight: 400; line-height: 150%; color: #999999; text-align: center;">
Si vous avez des difficultés à cliquer sur le bouton, copiez et collez cette URL dans votre navigateur :
</p>
<p style="margin: 4px 0 0 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 11px; font-weight: 400; line-height: 150%; color: #666666; text-align: center; word-break: break-all;">
<a href="${url}" style="color: #666666; text-decoration: underline;">${url}</a>
</p>
</td>
</tr>
</tbody>
</table>`
}

/**
 * Base email wrapper with header and footer images - Transfr style
 */
function getEmailWrapper(content: string): string {
  const headerImage = `${APP_URL}/email-header.png`
  const footerImage = `${APP_URL}/email-footer.png`
  
  const year = new Date().getFullYear()
  const copyrightText = `© ${year} Drime, All rights reserved.`
  
  return `<!doctype html>
<html lang="fr" dir="auto" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<title>${COMPANY_NAME}</title>
<!--[if !mso]><!-->
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--<![endif]-->
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<!--[if !mso]><!-->
<link href="https://fonts.googleapis.com/css?family=Schibsted+Grotesk:700,500&display=swap" rel="stylesheet" type="text/css">
<!--<![endif]-->
<style type="text/css">
${emailStyles}
</style>
</head>
<body lang="fr" class="emailify" style="mso-line-height-rule: exactly; mso-hyphenate: none; word-spacing: normal; background-color: #f0f2f5; margin: 0; padding: 0;">
<div style="background-color:#f0f2f5;" lang="fr" dir="auto">

<!-- Container -->
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; max-width: 460px; margin: 0 auto; background-color: #f0f2f5;">
<tbody>
<tr>
<td style="padding: 0 16px;">

<!-- Header Image -->
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; max-width: 428px; margin: 0 auto;">
<tbody>
<tr>
<td style="padding: 20px 0 0 0;">
<img src="${headerImage}" alt="${COMPANY_NAME}" style="width: 100%; max-width: 428px; height: auto; display: block; border-radius: 12px 12px 0 0;" />
</td>
</tr>
</tbody>
</table>

<!-- Main Card -->
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" class="main-card" style="width: 100%; max-width: 428px; margin: 0 auto; background-color: #fffffe; border-radius: 12px;">
<tbody>
<tr>
<td class="content-wrapper" style="padding: 32px 22px;">

${content}

</td>
</tr>
</tbody>
</table>

<!-- Footer Image -->
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; max-width: 428px; margin: 0 auto;">
<tbody>
<tr>
<td style="padding: 0;">
<img src="${footerImage}" alt="" style="width: 100%; max-width: 428px; height: auto; display: block; border-radius: 0 0 12px 12px;" />
</td>
</tr>
</tbody>
</table>

<!-- Copyright -->
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; max-width: 428px; margin: 0 auto;">
<tbody>
<tr>
<td style="padding: 24px 0 16px 0; text-align: center;">
<p style="margin: 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 11px; font-weight: 500; line-height: 118%; color: #aaaaaa;">
${copyrightText}
</p>
</td>
</tr>
</tbody>
</table>

</td>
</tr>
</tbody>
</table>

</div>
</body>
</html>`
}

export interface SignatureRequestEmailData {
  to: string
  signerName: string | null
  documentName: string
  senderName: string
  senderEmail: string
  signingLink: string
  message?: string
  expiresAt?: Date
}

export interface CompletedEmailData {
  to: string
  documentName: string
  signerName: string | null
  completedAt: Date
  downloadLink?: string
  auditTrailLink?: string
  attachments?: {
    signedPdf?: Buffer
    auditTrailPdf?: Buffer
  }
}

export interface ReminderEmailData {
  to: string
  signerName: string | null
  documentName: string
  senderName: string
  signingLink: string
  daysRemaining: number
}

// ==============================================
// SIGNATURE REQUEST EMAIL
// ==============================================
export async function sendSignatureRequestEmail(data: SignatureRequestEmailData) {
  const { to, signerName, documentName, senderName, senderEmail, signingLink, message, expiresAt } = data
  
  // SECURITY: Escape all user-provided content to prevent XSS
  const safeSignerName = escapeHtml(signerName)
  const safeDocumentName = escapeHtml(documentName)
  const safeSenderName = escapeHtml(senderName)
  const safeSenderEmail = escapeHtml(senderEmail)
  const safeMessage = escapeHtml(message)
  const safeSigningLink = sanitizeUrl(signingLink)
  
  const greeting = safeSignerName ? `Bonjour ${safeSignerName},` : 'Bonjour,'
  const expiresText = expiresAt 
    ? `Ce lien expire le ${expiresAt.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}.`
    : ''

  const htmlContent = `
<!-- Greeting -->
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%;">
<tbody>
<tr>
<td style="padding-bottom: 16px;">
<p style="margin: 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 18px; font-weight: 700; line-height: 122%; color: #000000;">
${greeting}
</p>
</td>
</tr>
<tr>
<td style="padding-bottom: 16px;">
<p style="margin: 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 16px; font-weight: 500; line-height: 150%; color: #000000;">
<strong>${safeSenderName}</strong> vous a envoyé le document <strong>"${safeDocumentName}"</strong> à signer.
</p>
${safeMessage ? `<p style="margin: 16px 0 0 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 14px; font-weight: 400; line-height: 150%; color: #666666; font-style: italic;">"${safeMessage}"</p>` : ''}
</td>
</tr>
</tbody>
</table>

<!-- Button -->
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; margin: 16px 0;">
<tbody>
<tr>
<td align="center">
<a href="${safeSigningLink}" style="display: inline-block; background-color: #08CF65; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 14px; font-weight: 600;">
Signer le document
</a>
</td>
</tr>
</tbody>
</table>

<!-- Fallback URL -->
${getFallbackUrlHtml(safeSigningLink)}

<!-- Expires Text -->
${expiresText ? `
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%;">
<tbody>
<tr>
<td style="padding: 8px 0;">
<p style="margin: 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 14px; font-weight: 500; line-height: 150%; color: #f59e0b; text-align: center;">
${expiresText}
</p>
</td>
</tr>
</tbody>
</table>
` : ''}

<!-- Signature -->
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%;">
<tbody>
<tr>
<td style="padding: 16px 0;">
<p style="margin: 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 16px; font-weight: 500; line-height: 150%; color: #000000;">
Cordialement,<br>${COMPANY_NAME}
</p>
</td>
</tr>
</tbody>
</table>

<!-- Footer Info -->
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%;">
<tbody>
<tr>
<td style="padding-top: 16px; text-align: center;">
<p style="margin: 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 12px; font-weight: 500; line-height: 150%; color: #474747;">
Cet email a été envoyé à ${escapeHtml(to)} car ${safeSenderEmail} vous a invité à signer un document.
</p>
</td>
</tr>
</tbody>
</table>
`

  try {
    const result = await resend.emails.send({
      from: `${COMPANY_NAME} <${FROM_EMAIL}>`,
      to: [to],
      reply_to: senderEmail,
      subject: `${safeSenderName} vous invite à signer "${safeDocumentName}"`,
      html: getEmailWrapper(htmlContent),
    })


    
    if (result.error) {
      console.error('[Email] API error for', to, ':', result.error)
      return { success: false, error: result.error }
    }
    
    return { success: true, id: result.data?.id }
  } catch (error) {
    console.error('[Email] Failed to send signature request:', error)
    return { success: false, error }
  }
}

// ==============================================
// DOCUMENT COMPLETED EMAIL
// ==============================================
export async function sendCompletedEmail(data: CompletedEmailData) {
  const { to, documentName, signerName, completedAt, downloadLink, auditTrailLink, attachments } = data
  
  // SECURITY: Escape all user-provided content
  const safeDocumentName = escapeHtml(documentName)
  const safeSignerName = escapeHtml(signerName)
  const safeDownloadLink = downloadLink ? sanitizeUrl(downloadLink) : undefined
  const safeAuditTrailLink = auditTrailLink ? sanitizeUrl(auditTrailLink) : undefined
  
  const greeting = safeSignerName ? `Bonjour ${safeSignerName},` : 'Bonjour,'
  const completedDate = completedAt.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
  const completedTime = completedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  // Build attachments array for Resend
  const emailAttachments: { filename: string; content: Buffer }[] = []
  
  if (attachments?.signedPdf) {
    emailAttachments.push({
      filename: `${documentName.replace(/[^a-zA-Z0-9]/g, '_')}_signe.pdf`,
      content: attachments.signedPdf,
    })
  }
  
  if (attachments?.auditTrailPdf) {
    emailAttachments.push({
      filename: `${documentName.replace(/[^a-zA-Z0-9]/g, '_')}_certificat_audit.pdf`,
      content: attachments.auditTrailPdf,
    })
  }

  const htmlContent = `
<!-- Greeting -->
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%;">
<tbody>
<tr>
<td style="padding-bottom: 16px;">
<p style="margin: 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 18px; font-weight: 700; line-height: 122%; color: #000000;">
${greeting}
</p>
</td>
</tr>
<tr>
<td style="padding-bottom: 16px;">
<p style="margin: 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 16px; font-weight: 500; line-height: 150%; color: #000000;">
Le document <strong>"${safeDocumentName}"</strong> a été entièrement signé le ${completedDate} à ${completedTime}.
</p>
</td>
</tr>
</tbody>
</table>

<!-- Success Box -->
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; margin: 16px 0;">
<tbody>
<tr>
<td align="center">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; max-width: 382px; border: 1.5px solid #08CF65; border-radius: 12px; background-color: #f0fdf4;">
<tbody>
<tr>
<td align="center" style="padding: 16px;">
<p style="margin: 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #166534; line-height: 150%;">
✓ Signature vérifiée cryptographiquement
</p>
<p style="margin: 4px 0 0 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 12px; font-weight: 400; color: #166534; line-height: 150%;">
Ce document est juridiquement valide et inclut un certificat d'audit complet.
</p>
</td>
</tr>
</tbody>
</table>
</td>
</tr>
</tbody>
</table>

${safeDownloadLink ? `
<!-- Button -->
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; margin: 16px 0;">
<tbody>
<tr>
<td align="center">
<a href="${safeDownloadLink}" style="display: inline-block; background-color: #08CF65; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 14px; font-weight: 600;">
Télécharger le document
</a>
</td>
</tr>
</tbody>
</table>

<!-- Fallback URL -->
${getFallbackUrlHtml(safeDownloadLink)}
` : ''}

${safeAuditTrailLink ? `
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%;">
<tbody>
<tr>
<td style="padding: 8px 0; text-align: center;">
<a href="${safeAuditTrailLink}" style="font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 14px; font-weight: 500; color: #666666; text-decoration: underline;">
Voir le certificat d'audit
</a>
</td>
</tr>
</tbody>
</table>
` : ''}

<!-- Signature -->
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%;">
<tbody>
<tr>
<td style="padding: 16px 0;">
<p style="margin: 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 16px; font-weight: 500; line-height: 150%; color: #000000;">
Cordialement,<br>${COMPANY_NAME}
</p>
</td>
</tr>
</tbody>
</table>
`

  try {
    const result = await resend.emails.send({
      from: `${COMPANY_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `✅ "${safeDocumentName}" a été signé`,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
      html: getEmailWrapper(htmlContent),
    })


    return { success: true, id: result.data?.id }
  } catch (error) {
    console.error('[Email] Failed to send completed email:', error)
    return { success: false, error }
  }
}

// ==============================================
// REMINDER EMAIL
// ==============================================
export async function sendReminderEmail(data: ReminderEmailData) {
  const { to, signerName, documentName, senderName, signingLink, daysRemaining } = data
  
  // SECURITY: Escape all user-provided content
  const safeSignerName = escapeHtml(signerName)
  const safeDocumentName = escapeHtml(documentName)
  const safeSenderName = escapeHtml(senderName)
  const safeSigningLink = sanitizeUrl(signingLink)
  
  const greeting = safeSignerName ? `Bonjour ${safeSignerName},` : 'Bonjour,'
  const urgencyText = daysRemaining <= 1 
    ? '⚠️ Ce document expire demain !' 
    : `📅 Il vous reste ${daysRemaining} jours pour signer.`

  const htmlContent = `
<!-- Greeting -->
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%;">
<tbody>
<tr>
<td style="padding-bottom: 16px;">
<p style="margin: 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 18px; font-weight: 700; line-height: 122%; color: #000000;">
${greeting}
</p>
</td>
</tr>
<tr>
<td style="padding-bottom: 16px;">
<p style="margin: 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 16px; font-weight: 500; line-height: 150%; color: #000000;">
Vous n'avez pas encore signé le document <strong>"${safeDocumentName}"</strong> envoyé par ${safeSenderName}.
</p>
<p style="margin: 8px 0 0 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 150%; color: #f59e0b;">
${urgencyText}
</p>
</td>
</tr>
</tbody>
</table>

<!-- Button -->
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%; margin: 16px 0;">
<tbody>
<tr>
<td align="center">
<a href="${safeSigningLink}" style="display: inline-block; background-color: #08CF65; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 14px; font-weight: 600;">
Signer maintenant
</a>
</td>
</tr>
</tbody>
</table>

<!-- Fallback URL -->
${getFallbackUrlHtml(safeSigningLink)}

<!-- Signature -->
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="width: 100%;">
<tbody>
<tr>
<td style="padding: 16px 0;">
<p style="margin: 0; font-family: 'Schibsted Grotesk', Arial, sans-serif; font-size: 16px; font-weight: 500; line-height: 150%; color: #000000;">
Cordialement,<br>${COMPANY_NAME}
</p>
</td>
</tr>
</tbody>
</table>
`

  try {
    const result = await resend.emails.send({
      from: `${COMPANY_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `Rappel: "${safeDocumentName}" attend votre signature`,
      html: getEmailWrapper(htmlContent),
    })


    return { success: true, id: result.data?.id }
  } catch (error) {
    console.error('[Email] Failed to send reminder:', error)
    return { success: false, error }
  }
}
