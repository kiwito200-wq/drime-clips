import { NextResponse } from 'next/server'
import { sendVerifyOTP, formatPhoneNumber } from '@/lib/twilio'

export async function POST(request: Request) {
  try {
    const { phone } = await request.json()
    
    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }
    
    // Use Twilio Verify to send OTP
    const result = await sendVerifyOTP(phone)
    
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send SMS' }, { status: 500 })
    }
    
    // Return masked phone for display
    const maskedPhone = maskPhoneNumber(formatPhoneNumber(phone))
    
    return NextResponse.json({ 
      success: true, 
      maskedPhone,
      expiresIn: 600, // Twilio Verify codes expire in 10 minutes
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
