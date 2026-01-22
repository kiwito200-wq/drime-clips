import { prisma } from './prisma'

export type NotificationType = 'invitation' | 'signed' | 'completed' | 'reminder' | 'rejected'

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message?: string
  envelopeId?: string
  envelopeSlug?: string
  senderEmail?: string
  senderName?: string
}

/**
 * Create a notification for a user
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        envelopeId: params.envelopeId,
        envelopeSlug: params.envelopeSlug,
        senderEmail: params.senderEmail,
        senderName: params.senderName,
      },
    })
    console.log(`[Notification] Created ${params.type} notification for user ${params.userId}`)
    return notification
  } catch (error) {
    console.error('[Notification] Failed to create notification:', error)
    return null
  }
}

/**
 * Create invitation notification when a document is sent to someone
 */
export async function notifyInvitation(
  recipientEmail: string,
  envelopeId: string,
  envelopeSlug: string,
  documentName: string,
  senderEmail: string,
  senderName?: string
) {
  // Find user by email
  const user = await prisma.user.findUnique({ where: { email: recipientEmail } })
  if (!user) {
    console.log(`[Notification] No user found for ${recipientEmail}, skipping notification`)
    return null
  }

  return createNotification({
    userId: user.id,
    type: 'invitation',
    title: documentName,
    message: `${senderName || senderEmail} vous invite à signer ce document`,
    envelopeId,
    envelopeSlug,
    senderEmail,
    senderName,
  })
}

/**
 * Create signed notification when someone signs a document
 */
export async function notifySigned(
  ownerUserId: string,
  envelopeId: string,
  envelopeSlug: string,
  documentName: string,
  signerEmail: string,
  signerName?: string
) {
  return createNotification({
    userId: ownerUserId,
    type: 'signed',
    title: documentName,
    message: `${signerName || signerEmail} a signé le document`,
    envelopeId,
    envelopeSlug,
    senderEmail: signerEmail,
    senderName: signerName,
  })
}

/**
 * Create completed notification when a document is fully signed
 */
export async function notifyCompleted(
  userIds: string[],
  envelopeId: string,
  envelopeSlug: string,
  documentName: string
) {
  const notifications = await Promise.all(
    userIds.map(userId =>
      createNotification({
        userId,
        type: 'completed',
        title: documentName,
        message: 'Le document a été signé par tous les signataires',
        envelopeId,
        envelopeSlug,
      })
    )
  )
  return notifications
}

/**
 * Create rejected notification when someone declines to sign
 */
export async function notifyRejected(
  ownerUserId: string,
  envelopeId: string,
  envelopeSlug: string,
  documentName: string,
  signerEmail: string,
  signerName?: string,
  reason?: string
) {
  return createNotification({
    userId: ownerUserId,
    type: 'rejected',
    title: documentName,
    message: reason 
      ? `${signerName || signerEmail} a refusé de signer: "${reason}"`
      : `${signerName || signerEmail} a refusé de signer`,
    envelopeId,
    envelopeSlug,
    senderEmail: signerEmail,
    senderName: signerName,
  })
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(userId: string, options?: { unreadOnly?: boolean; limit?: number }) {
  return prisma.notification.findMany({
    where: {
      userId,
      ...(options?.unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
  })
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId, // Ensure user owns the notification
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  })
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  })
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: {
      userId,
      read: false,
    },
  })
}
