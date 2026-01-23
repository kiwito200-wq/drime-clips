import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/user/signature - Get user's saved signature
export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return NextResponse.json({ 
      signatureData: user.signatureData || null 
    })
  } catch (error) {
    console.error('Error getting signature:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/user/signature - Save user's signature
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { signatureData } = await request.json()
    
    if (!signatureData || typeof signatureData !== 'string') {
      return NextResponse.json({ error: 'Invalid signature data' }, { status: 400 })
    }
    
    // Validate that it's a data URL (base64 image)
    if (!signatureData.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Invalid signature format' }, { status: 400 })
    }
    
    // Save the signature
    await prisma.user.update({
      where: { id: user.id },
      data: { signatureData },
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving signature:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/user/signature - Delete user's signature
export async function DELETE() {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    await prisma.user.update({
      where: { id: user.id },
      data: { signatureData: null },
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting signature:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
