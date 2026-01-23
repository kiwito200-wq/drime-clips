import { NextRequest, NextResponse } from 'next/server'
import { attemptDrimeAutoLogin } from '@/lib/drime-auth'

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const result = await attemptDrimeAutoLogin(request)
    
    if (result.user) {
      return NextResponse.json({ 
        success: true,
        user: result.user,
        redirectTo: '/dashboard'
      })
    }
    
    return NextResponse.json({ 
      success: false,
      error: 'Not logged in on Drime',
      redirectTo: 'https://front.preprod.drime.cloud/login?redirect=https://sign.drime.cloud/dashboard'
    }, { status: 401 })
  } catch (error) {
    console.error('Drime auto-login error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Auto-login failed'
    }, { status: 500 })
  }
}
