import { Prisma, prisma } from '@innsight/database';
import type {
  CreateMenuItemInput,
  UpdateMenuItemInput,
  ListMenuQuery,
  CreateOrderInput,
  UpdateOrderStatusInput,
  ListOrdersQuery,
  PaginationMeta,
} from '@innsight/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.js';
import { toSkipTake, buildPaginationMeta } from '../../shared/http/pagination.js';
import { generateReference } from '../../shared/utils/reference.js';
import { folioService } from '../billing/folio.service.js';

type Tx = Prisma.TransactionClient;
const ZERO = new Prisma.Decimal(0);

// Terminal states an order cannot leave.
const TERMINAL: string[] = ['DELIVERED', 'CANCELLED'];

const orderInclude = {
  items: { include: { menuItem: { select: { id: true, name: true } } } },
} satisfies Prisma.OrderInclude;
export type OrderDTO = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
export type MenuItemDTO = Prisma.MenuItemGetPayload<Record<string, never>>;

export class RestaurantService {
  private async assertGuestOwned(tx: Tx, hotelId: string, guestId: string): Promise<void> {
    const guest = await tx.guest.findFirst({ where: { id: guestId, hotelId, deletedAt: null }, select: { id: true } });
    if (!guest) throw new ValidationError('Guest does not exist for this hotel');
  }
  // ─── Menu ──────────────────────────────────────────
  async listMenu(hotelId: string, query: ListMenuQuery): Promise<{ items: MenuItemDTO[]; meta: PaginationMeta }> {
    const { page, limit, search, category, isAvailable } = query;
    const where: Prisma.MenuItemWhereInput = {
      hotelId,
      ...(category ? { category } : {}),
      ...(isAvailable !== undefined ? { isAvailable } : {}),
      ...(search ? { name: { contains: search } } : {}),
    };
    const { skip, take } = toSkipTake(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.menuItem.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], skip, take }),
      prisma.menuItem.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async getMenuItem(hotelId: string, id: string): Promise<MenuItemDTO> {
    const item = await prisma.menuItem.findFirst({ where: { id, hotelId } });
    if (!item) throw new NotFoundError('Menu item not found');
    return item;
  }

  async createMenuItem(hotelId: string, input: CreateMenuItemInput): Promise<MenuItemDTO> {
    return prisma.menuItem.create({
      data: {
        hotelId,
        name: input.name,
        description: input.description ?? null,
        category: input.category,
        price: new Prisma.Decimal(input.price),
        isAvailable: input.isAvailable,
        isVegetarian: input.isVegetarian,
        allergens: JSON.stringify(input.allergens) as any,
        imageUrl: input.imageUrl ?? null,
        sortOrder: input.sortOrder,
      },
    });
  }

  async updateMenuItem(hotelId: string, id: string, input: UpdateMenuItemInput): Promise<MenuItemDTO> {
    await this.getMenuItem(hotelId, id);
    const data: Prisma.MenuItemUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.category !== undefined) data.category = input.category;
    if (input.price !== undefined) data.price = new Prisma.Decimal(input.price);
    if (input.isAvailable !== undefined) data.isAvailable = input.isAvailable;
    if (input.isVegetarian !== undefined) data.isVegetarian = input.isVegetarian;
    if (input.allergens !== undefined) data.allergens = JSON.stringify(input.allergens) as any;
    if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    return prisma.menuItem.update({ where: { id }, data });
  }

  async removeMenuItem(hotelId: string, id: string): Promise<void> {
    await this.getMenuItem(hotelId, id);
    await prisma.menuItem.delete({ where: { id } });
  }

  // ─── Orders ────────────────────────────────────────
  async listOrders(hotelId: string, query: ListOrdersQuery): Promise<{ items: OrderDTO[]; meta: PaginationMeta }> {
    const { page, limit, search, status, type, sortOrder } = query;
    const where: Prisma.OrderWhereInput = {
      hotelId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(search ? { orderNumber: { contains: search } } : {}),
    };
    const { skip, take } = toSkipTake(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.order.findMany({ where, include: orderInclude, orderBy: { orderedAt: sortOrder }, skip, take }),
      prisma.order.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async getOrder(hotelId: string, id: string): Promise<OrderDTO> {
    const order = await prisma.order.findFirst({ where: { id, hotelId }, include: orderInclude });
    if (!order) throw new NotFoundError('Order not found');
    return order;
  }

  async createOrder(hotelId: string, actorId: string, input: CreateOrderInput): Promise<OrderDTO> {
    return prisma.$transaction(async (tx) => {
      // Load & price the referenced menu items (server-side pricing, never trust client).
      const ids = input.items.map((i) => i.menuItemId);
      const menuItems = await tx.menuItem.findMany({ where: { hotelId, id: { in: ids } } });
      const byId = new Map(menuItems.map((m) => [m.id, m]));

      let subtotal = ZERO;
      const itemData = input.items.map((line) => {
        const menu = byId.get(line.menuItemId);
        if (!menu) throw new ValidationError(`Menu item ${line.menuItemId} not found`);
        if (!menu.isAvailable) throw new ValidationError(`"${menu.name}" is not available`);
        const lineTotal = menu.price.mul(line.quantity);
        subtotal = subtotal.add(lineTotal);
        return {
          menuItemId: menu.id,
          quantity: line.quantity,
          unitPrice: menu.price,
          total: lineTotal,
          notes: line.notes ?? null,
        };
      });

      if (input.guestId) await this.assertGuestOwned(tx, hotelId, input.guestId);
      const folioId = await this.resolveFolio(tx, hotelId, input);
      const taxRate = await this.taxRate(tx, hotelId);
      const taxAmount = subtotal.mul(taxRate);
      const total = subtotal.add(taxAmount);

      const order = await tx.order.create({
        data: {
          hotelId,
          orderNumber: generateReference('ORD', new Date()),
          type: input.type,
          status: 'RECEIVED',
          roomNumber: input.roomNumber ?? null,
          tableNumber: input.tableNumber ?? null,
          guestId: input.guestId ?? null,
          folioId,
          subtotal,
          taxAmount,
          total,
          specialInstructions: input.specialInstructions ?? null,
          createdBy: actorId,
          items: { create: itemData },
        },
        include: orderInclude,
      });
      return order;
    });
  }

  /** Advance order status; when delivered, post the charge to a linked folio (room service). */
  async updateOrderStatus(hotelId: string, actorId: string, id: string, input: UpdateOrderStatusInput): Promise<OrderDTO> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id, hotelId } });
      if (!order) throw new NotFoundError('Order not found');
      if (TERMINAL.includes(order.status)) {
        throw new ConflictError(`Order is already ${order.status}`);
      }

      const now = new Date();
      const data: Prisma.OrderUpdateInput = { status: input.status };
      if (input.status === 'READY') data.preparedAt = now;
      if (input.status === 'DELIVERED') data.deliveredAt = now;

      await tx.order.update({ where: { id }, data });

      if (input.status === 'DELIVERED' && order.folioId) {
        await folioService.postCharge(tx, order.folioId, {
          category: 'ROOM_SERVICE',
          description: `Order ${order.orderNumber}`,
          unitPrice: order.subtotal,
          quantity: 1,
          taxAmount: order.taxAmount,
          createdBy: actorId,
        });
      }
      return tx.order.findFirstOrThrow({ where: { id }, include: orderInclude });
    });
  }

  private async resolveFolio(tx: Tx, hotelId: string, input: CreateOrderInput): Promise<string | null> {
    if (input.folioId) {
      const folio = await tx.folio.findFirst({ where: { id: input.folioId, hotelId }, select: { id: true, closedAt: true } });
      if (!folio) throw new ValidationError('Folio does not exist for this hotel');
      if (folio.closedAt) throw new ConflictError('Cannot attach an order to a closed folio');
      return folio.id;
    }
    // Room service: attach to the open folio of the guest currently in that room.
    if (input.type === 'ROOM_SERVICE' && input.roomNumber) {
      const reservation = await tx.reservation.findFirst({
        where: { hotelId, status: 'CHECKED_IN', room: { roomNumber: input.roomNumber } },
        select: { folio: { select: { id: true, closedAt: true } } },
      });
      if (reservation?.folio && !reservation.folio.closedAt) return reservation.folio.id;
    }
    return null;
  }

  private async taxRate(tx: Tx, hotelId: string): Promise<Prisma.Decimal> {
    const settings = await tx.hotelSettings.findUnique({ where: { hotelId }, select: { defaultTaxRate: true } });
    return settings?.defaultTaxRate ?? ZERO;
  }
}

export const restaurantService = new RestaurantService();
