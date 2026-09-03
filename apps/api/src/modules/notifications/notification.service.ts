import { Prisma, prisma } from '@innsight/database';
import type { CreateNotificationInput, ListNotificationsQuery, PaginationMeta } from '@innsight/shared';
import { NotFoundError, ValidationError } from '../../shared/errors/app-error.js';
import { toSkipTake, buildPaginationMeta } from '../../shared/http/pagination.js';

export type NotificationDTO = Prisma.NotificationGetPayload<Record<string, never>>;

/**
 * In-app notifications, scoped to a hotel and delivered to a specific user. Reads
 * are always constrained to the requesting user so one staff member cannot read
 * another's notifications.
 */
export class NotificationService {
  async create(hotelId: string, input: CreateNotificationInput): Promise<NotificationDTO> {
    const user = await prisma.user.findFirst({ where: { id: input.userId, hotelId }, select: { id: true } });
    if (!user) throw new ValidationError('Target user does not exist for this hotel');
    return prisma.notification.create({
      data: {
        hotelId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
      },
    });
  }

  async listForUser(
    hotelId: string,
    userId: string,
    query: ListNotificationsQuery,
  ): Promise<{ items: NotificationDTO[]; meta: PaginationMeta }> {
    const { page, limit, unreadOnly, sortOrder } = query;
    const where: Prisma.NotificationWhereInput = {
      hotelId,
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };
    const { skip, take } = toSkipTake(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.notification.findMany({ where, orderBy: { createdAt: sortOrder }, skip, take }),
      prisma.notification.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async unreadCount(hotelId: string, userId: string): Promise<number> {
    return prisma.notification.count({ where: { hotelId, userId, isRead: false } });
  }

  async markRead(hotelId: string, userId: string, id: string): Promise<NotificationDTO> {
    const notification = await prisma.notification.findFirst({ where: { id, hotelId, userId } });
    if (!notification) throw new NotFoundError('Notification not found');
    return prisma.notification.update({ where: { id }, data: { isRead: true, readAt: new Date() } });
  }

  async markAllRead(hotelId: string, userId: string): Promise<{ updated: number }> {
    const result = await prisma.notification.updateMany({
      where: { hotelId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }
}

export const notificationService = new NotificationService();
