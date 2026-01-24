import { NextResponse } from 'next/server'
import { sendSMS, generateOTP, storeOTP, formatPhoneNumber } from '@/lib/twilio'

export async function POST(request: Request) {
  try {
    const { phone, envelopeSlug, signerId, type } = await request.json()
    
    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }
    
    // Generate OTP
    const otp = generateOTP()
    
    // Create unique key for this OTP request
    // type can be 'field' (phone field verification) or '2fa' (document access)
    const otpKey = `${type || 'field'}-${envelopeSlug || 'unknown'}-${signerId || 'unknown'}-${formatPhoneNumber(phone)}`
    
    // Store OTP with 5 minute expiry
    storeOTP(otpKey, otp, 5)
    
    // Send SMS
    const message = `Votre code de vérification Drime Sign: ${otp}\n\nCe code expire dans 5 minutes.`
    const sent = await sendSMS(phone, message)
    
    if (!sent) {
      return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 })
    }
    
    // Return masked phone for display
    const maskedPhone = maskPhoneNumber(phone)
    
    return NextResponse.json({ 
      success: true, 
      maskedPhone,
      expiresIn: 300, // 5 minutes in seconds
    })
  } catch (error) {
    console.error('[OTP Send] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function maskPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length < 4) return '***'
  return '***' + cleaned.slice(-4)
}
