import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { markNotificationRead } from '@/lib/notifications'

interface Params {
  params: {
    id: string
  }
}

// POST /api/notifications/[id]/read - Mark notification as read
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await markNotificationRead(params.id, user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[POST /api/notifications/[id]/read] Error:', error)
    return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 })
  }
}
