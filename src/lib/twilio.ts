// Lazy-load Twilio to avoid initialization errors when credentials are not set
// eslint-disable-next-line
let twilioClient: any = null

function getTwilioClient() {
  if (twilioClient) return twilioClient
  
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  
  if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
    return null
  }
  
  // Dynamic import to avoid build-time errors
  // eslint-disable-next-line
  const twilio = require('twilio')
  twilioClient = twilio(accountSid, authToken)
  return twilioClient
}

// Use Twilio Verify API to send OTP
export async function sendVerifyOTP(to: string): Promise<{ success: boolean; error?: string }> {
  const client = getTwilioClient()
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID
  
  if (!client || !serviceSid) {
    console.log('[Twilio Verify] Missing credentials')
    console.log(`[Twilio Verify DEV] Would send OTP to ${to}`)
    return { success: true } // Return success in dev mode for testing
  }

  try {
    const formattedNumber = formatPhoneNumber(to)
    
    await client.verify.v2
      .services(serviceSid)
      .verifications.create({
        to: formattedNumber,
        channel: 'sms',
      })
    
    console.log(`[Twilio Verify] OTP sent to ${formattedNumber}`)
    return { success: true }
  } catch (error: unknown) {
    console.error('[Twilio Verify] Failed to send OTP:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to send verification code'
    return { success: false, error: errorMessage }
  }
}

// Use Twilio Verify API to check OTP
export async function checkVerifyOTP(to: string, code: string): Promise<{ success: boolean; error?: string }> {
  const client = getTwilioClient()
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID
  
  if (!client || !serviceSid) {
    console.log('[Twilio Verify] Missing credentials - checking in dev mode')
    // In dev mode, accept any 6-digit code for testing
    if (code.length === 6) {
      return { success: true }
    }
    return { success: false, error: 'Invalid code' }
  }

  try {
    const formattedNumber = formatPhoneNumber(to)
    
    const verification = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({
        to: formattedNumber,
        code: code,
      })
    
    if (verification.status === 'approved') {
      console.log(`[Twilio Verify] OTP verified for ${formattedNumber}`)
      return { success: true }
    } else {
      console.log(`[Twilio Verify] OTP check failed: ${verification.status}`)
      return { success: false, error: 'Code incorrect ou expiré' }
    }
  } catch (error: unknown) {
    console.error('[Twilio Verify] Failed to verify OTP:', error)
    return { success: false, error: 'Code incorrect ou expiré' }
  }
}

// Legacy SMS function (kept for backwards compatibility)
export async function sendSMS(to: string, message: string): Promise<boolean> {
  const client = getTwilioClient()
  const fromNumber = process.env.TWILIO_PHONE_NUMBER
  
  if (!client || !fromNumber) {
    console.log('[Twilio] Missing credentials - SMS not sent')
    console.log(`[Twilio DEV] Would send to ${to}: ${message}`)
    return true
  }

  try {
    const formattedNumber = formatPhoneNumber(to)
    
    await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedNumber,
    })
    
    console.log(`[Twilio] SMS sent to ${formattedNumber}`)
    return true
  } catch (error) {
    console.error('[Twilio] Failed to send SMS:', error)
    return false
  }
}

export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '')
  
  // If starts with 0 (French format), replace with +33
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '33' + cleaned.slice(1)
  }
  
  // Add + if not present
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned
  }
  
  return cleaned
}

export function generateOTP(): string {
  // Generate 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// In-memory OTP storage (use Redis in production for multi-instance)
const otpStore = new Map<string, { code: string; expiresAt: number; attempts: number }>()

export function storeOTP(key: string, code: string, expiresInMinutes: number = 5): void {
  otpStore.set(key, {
    code,
    expiresAt: Date.now() + expiresInMinutes * 60 * 1000,
    attempts: 0,
  })
  
  // Clean up expired OTPs periodically
  setTimeout(() => {
    otpStore.delete(key)
  }, expiresInMinutes * 60 * 1000 + 1000)
}

export function verifyOTP(key: string, code: string): { valid: boolean; error?: string } {
  const stored = otpStore.get(key)
  
  if (!stored) {
    return { valid: false, error: 'Code expiré ou invalide' }
  }
  
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(key)
    return { valid: false, error: 'Code expiré' }
  }
  
  // Max 3 attempts
  if (stored.attempts >= 3) {
    otpStore.delete(key)
    return { valid: false, error: 'Trop de tentatives. Demandez un nouveau code.' }
  }
  
  stored.attempts++
  
  if (stored.code !== code) {
    return { valid: false, error: 'Code incorrect' }
  }
  
  // Valid! Remove from store
  otpStore.delete(key)
  return { valid: true }
}

export function hasValidOTP(key: string): boolean {
  const stored = otpStore.get(key)
  return stored !== undefined && Date.now() < stored.expiresAt
}
