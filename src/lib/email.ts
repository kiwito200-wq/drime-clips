import { Resend } from 'resend'

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@sign.drime.cloud'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sign.drime.cloud'
const COMPANY_NAME = 'Drime Sign'

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
  
  const greeting = signerName ? `Bonjour ${signerName},` : 'Bonjour,'
  const expiresText = expiresAt 
    ? `<p style="color: #6B7280; font-size: 14px; margin-top: 16px;">Ce lien expire le ${expiresAt.toLocaleDateString('fr-FR')}.</p>`
    : ''
  const customMessage = message 
    ? `<div style="background-color: #F3F4F6; padding: 16px; border-radius: 8px; margin: 16px 0;"><p style="margin: 0; color: #374151;">"${message}"</p></div>`
    : ''

  try {
    const result = await resend.emails.send({
      from: `${COMPANY_NAME} <${FROM_EMAIL}>`,
      to: [to],
      replyTo: senderEmail,
      subject: `${senderName} vous invite à signer "${documentName}"`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #F9FAFB;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background-color: #08CF65; border-radius: 12px; margin-bottom: 16px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0;">${COMPANY_NAME}</h1>
    </div>
    
    <!-- Content -->
    <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">${greeting}</p>
      
      <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">
        <strong>${senderName}</strong> vous a envoyé le document <strong>"${documentName}"</strong> à signer.
      </p>
      
      ${customMessage}
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${signingLink}" style="display: inline-block; background-color: #08CF65; color: white; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px;">
          Signer le document
        </a>
      </div>
      
      ${expiresText}
      
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;">
      
      <p style="font-size: 14px; color: #6B7280; margin: 0;">
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
        <a href="${signingLink}" style="color: #08CF65; word-break: break-all;">${signingLink}</a>
      </p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px;">
      <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
        Envoyé par ${COMPANY_NAME} · Une solution <a href="https://drime.cloud" style="color: #08CF65; text-decoration: none;">Drime</a>
      </p>
      <p style="font-size: 12px; color: #9CA3AF; margin: 8px 0 0 0;">
        Cet email a été envoyé à ${to} car ${senderEmail} vous a invité à signer un document.
      </p>
    </div>
  </div>
</body>
</html>
`,
    })

    console.log('[Email] Signature request sent to:', to, result)
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
  const { to, documentName, signerName, completedAt, downloadLink, auditTrailLink } = data
  
  const greeting = signerName ? `Bonjour ${signerName},` : 'Bonjour,'

  try {
    const result = await resend.emails.send({
      from: `${COMPANY_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `✅ "${documentName}" a été signé`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #F9FAFB;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; background-color: #DCFCE7; border-radius: 50%; margin-bottom: 16px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 13L9 17L19 7" stroke="#16A34A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0;">Document signé !</h1>
    </div>
    
    <!-- Content -->
    <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">${greeting}</p>
      
      <p style="font-size: 16px; color: #374151; margin: 0 0 24px 0;">
        Le document <strong>"${documentName}"</strong> a été entièrement signé le ${completedAt.toLocaleDateString('fr-FR')} à ${completedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.
      </p>
      
      <div style="background-color: #F0FDF4; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 14px; color: #166534;">
          <strong>✓ Signature vérifiée cryptographiquement</strong><br>
          Ce document est juridiquement valide et inclut un certificat d'audit complet.
        </p>
      </div>
      
      ${downloadLink ? `
      <div style="text-align: center; margin: 24px 0;">
        <a href="${downloadLink}" style="display: inline-block; background-color: #08CF65; color: white; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px;">
          Télécharger le document
        </a>
      </div>
      ` : ''}
      
      ${auditTrailLink ? `
      <p style="text-align: center;">
        <a href="${auditTrailLink}" style="color: #6B7280; font-size: 14px; text-decoration: underline;">
          Voir le certificat d'audit
        </a>
      </p>
      ` : ''}
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px;">
      <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
        ${COMPANY_NAME} · Signature électronique sécurisée
      </p>
    </div>
  </div>
</body>
</html>
`,
    })

    console.log('[Email] Completed notification sent to:', to, result)
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
  
  const greeting = signerName ? `Bonjour ${signerName},` : 'Bonjour,'
  const urgencyText = daysRemaining <= 1 
    ? '⚠️ Ce document expire demain !' 
    : `📅 Il vous reste ${daysRemaining} jours pour signer.`

  try {
    const result = await resend.emails.send({
      from: `${COMPANY_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `Rappel: "${documentName}" attend votre signature`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #F9FAFB;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Content -->
    <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">${greeting}</p>
      
      <p style="font-size: 16px; color: #374151; margin: 0 0 8px 0;">
        Vous n'avez pas encore signé le document <strong>"${documentName}"</strong> envoyé par ${senderName}.
      </p>
      
      <p style="font-size: 14px; color: #F59E0B; font-weight: 600; margin: 0 0 24px 0;">
        ${urgencyText}
      </p>
      
      <div style="text-align: center; margin: 24px 0;">
        <a href="${signingLink}" style="display: inline-block; background-color: #08CF65; color: white; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px;">
          Signer maintenant
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px;">
      <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
        ${COMPANY_NAME} · Une solution Drime
      </p>
    </div>
  </div>
</body>
</html>
`,
    })

    console.log('[Email] Reminder sent to:', to, result)
    return { success: true, id: result.data?.id }
  } catch (error) {
    console.error('[Email] Failed to send reminder:', error)
    return { success: false, error }
  }
}
