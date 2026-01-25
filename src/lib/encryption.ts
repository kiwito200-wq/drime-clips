/**
 * SECURITY: Encryption Module
 * 
 * Provides encryption/decryption for sensitive data stored in the database.
 * Uses AES-256-GCM for authenticated encryption.
 */

import crypto from 'crypto'

// Encryption key from environment (must be 32 bytes for AES-256)
const ENCRYPTION_KEY_RAW = process.env.ENCRYPTION_KEY

function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY_RAW) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: ENCRYPTION_KEY environment variable is required in production')
    }
    console.warn('⚠️ WARNING: ENCRYPTION_KEY not set - using insecure development key')
    // Development-only fallback (32 bytes)
    return Buffer.from('dev-encryption-key-32-bytes-long')
  }
  
  // If key is hex-encoded, decode it
  if (ENCRYPTION_KEY_RAW.length === 64 && /^[a-f0-9]+$/i.test(ENCRYPTION_KEY_RAW)) {
    return Buffer.from(ENCRYPTION_KEY_RAW, 'hex')
  }
  
  // If key is base64-encoded, decode it
  if (ENCRYPTION_KEY_RAW.length === 44 && ENCRYPTION_KEY_RAW.endsWith('=')) {
    return Buffer.from(ENCRYPTION_KEY_RAW, 'base64')
  }
  
  // Otherwise, hash the key to ensure it's exactly 32 bytes
  return crypto.createHash('sha256').update(ENCRYPTION_KEY_RAW).digest()
}

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM standard
const AUTH_TAG_LENGTH = 16

/**
 * Encrypt a string value
 * @param plaintext - The value to encrypt
 * @returns Encrypted value as base64 string (IV + ciphertext + authTag)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let ciphertext = cipher.update(plaintext, 'utf8')
  ciphertext = Buffer.concat([ciphertext, cipher.final()])
  
  const authTag = cipher.getAuthTag()
  
  // Combine IV + ciphertext + authTag
  const combined = Buffer.concat([iv, ciphertext, authTag])
  
  return combined.toString('base64')
}

/**
 * Decrypt an encrypted string
 * @param encryptedData - Base64 encoded encrypted data (IV + ciphertext + authTag)
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedData, 'base64')
  
  // Extract IV, ciphertext, and authTag
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH)
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  
  let plaintext = decipher.update(ciphertext)
  plaintext = Buffer.concat([plaintext, decipher.final()])
  
  return plaintext.toString('utf8')
}

/**
 * Check if a value is encrypted (starts with base64 pattern from our encryption)
 */
export function isEncrypted(value: string): boolean {
  // Our encrypted values are base64 and at least IV_LENGTH + AUTH_TAG_LENGTH bytes
  if (!value || value.length < 40) return false
  
  try {
    const decoded = Buffer.from(value, 'base64')
    return decoded.length >= IV_LENGTH + AUTH_TAG_LENGTH
  } catch {
    return false
  }
}

/**
 * Safely decrypt a value, returning the original if not encrypted or decryption fails
 */
export function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null
  
  // Check if it looks encrypted
  if (!isEncrypted(value)) {
    return value
  }
  
  try {
    return decrypt(value)
  } catch {
    // If decryption fails, return the original value
    // This handles migration cases where old data isn't encrypted
    return value
  }
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Hash a value with HMAC-SHA256
 */
export function hmacHash(value: string): string {
  const key = getEncryptionKey()
  return crypto.createHmac('sha256', key).update(value).digest('hex')
}

/**
 * Verify an HMAC hash
 */
export function verifyHmac(value: string, hash: string): boolean {
  const computed = hmacHash(value)
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash))
}
