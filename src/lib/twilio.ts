// Lazy-load Twilio to avoid initialization errors when credentials are not set
let twilioClient: ReturnType<typeof import('twilio')> | null = null

function getTwilioClient() {
  if (twilioClient) return twilioClient
  
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  
  if (!accountSid || !authToken || !accountSid.startsWith('AC')) {
    return null
  }
  
  // Dynamic import to avoid build-time errors
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const twilio = require('twilio')
  twilioClient = twilio(accountSid, authToken)
  return twilioClient
}

export async function sendSMS(to: string, message: string): Promise<boolean> {
  const client = getTwilioClient()
  const fromNumber = process.env.TWILIO_PHONE_NUMBER
  
  if (!client || !fromNumber) {
    console.log('[Twilio] Missing credentials - SMS not sent')
    // In dev/preview mode without Twilio, just log and return success for testing
    console.log(`[Twilio DEV] Would send to ${to}: ${message}`)
    return true
  }

  try {
    // Format phone number if needed
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
