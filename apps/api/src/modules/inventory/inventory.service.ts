import { Prisma, prisma } from '@innsight/database';
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  ListInventoryQuery,
  CreateStockMovementInput,
  ListStockMovementsQuery,
  PaginationMeta,
} from '@innsight/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.js';
import { toSkipTake, buildPaginationMeta } from '../../shared/http/pagination.js';
import { runSerializable } from '../../shared/db/transaction.js';

const itemInclude = { supplier: { select: { id: true, name: true } } } satisfies Prisma.InventoryItemInclude;
export type InventoryItemDTO = Prisma.InventoryItemGetPayload<{ include: typeof itemInclude }>;
export type SupplierDTO = Prisma.SupplierGetPayload<Record<string, never>>;
export type StockMovementDTO = Prisma.StockMovementGetPayload<Record<string, never>>;

export class InventoryService {
  // ─── Suppliers (tenant-scoped via hotelId) ──────────
  async listSuppliers(hotelId: string): Promise<SupplierDTO[]> {
    return prisma.supplier.findMany({ where: { hotelId }, orderBy: { name: 'asc' } });
  }

  async createSupplier(hotelId: string, input: CreateSupplierInput): Promise<SupplierDTO> {
    return prisma.supplier.create({
      data: {
        hotelId,
        name: input.name,
        contactName: input.contactName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
      },
    });
  }

  async updateSupplier(hotelId: string, id: string, input: UpdateSupplierInput): Promise<SupplierDTO> {
    const supplier = await prisma.supplier.findFirst({ where: { id, hotelId }, select: { id: true } });
    if (!supplier) throw new NotFoundError('Supplier not found');
    return prisma.supplier.update({ where: { id }, data: input });
  }

  async removeSupplier(hotelId: string, id: string): Promise<void> {
    const supplier = await prisma.supplier.findFirst({
      where: { id, hotelId },
      select: { id: true, _count: { select: { inventoryItems: true } } },
    });
    if (!supplier) throw new NotFoundError('Supplier not found');
    if (supplier._count.inventoryItems > 0) {
      throw new ConflictError('Cannot delete a supplier still linked to inventory items');
    }
    await prisma.supplier.delete({ where: { id } });
  }

  // ─── Inventory items ───────────────────────────────
  private async assertSupplier(supplierId: string): Promise<void> {
    const s = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } });
    if (!s) throw new ValidationError('Supplier does not exist');
  }

  async listItems(hotelId: string, query: ListInventoryQuery): Promise<{ items: InventoryItemDTO[]; meta: PaginationMeta }> {
    const { page, limit, search, category, lowStock, sortOrder } = query;
    const where: Prisma.InventoryItemWhereInput = {
      hotelId,
      ...(category ? { category } : {}),
      ...(search ? { name: { contains: search } } : {}),
      // Low-stock is a column-to-column comparison (currentStock <= reorderLevel) which
      // Prisma can't express in `where`; push it into the query as a raw column filter so
      // pagination and the total count stay correct.
      ...(lowStock
        ? { AND: [{ currentStock: { lte: prisma.inventoryItem.fields.reorderLevel } }] }
        : {}),
    };
    const { skip, take } = toSkipTake(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.inventoryItem.findMany({ where, include: itemInclude, orderBy: { name: sortOrder }, skip, take }),
      prisma.inventoryItem.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }

  async getItem(hotelId: string, id: string): Promise<InventoryItemDTO> {
    const item = await prisma.inventoryItem.findFirst({ where: { id, hotelId }, include: itemInclude });
    if (!item) throw new NotFoundError('Inventory item not found');
    return item;
  }

  async createItem(hotelId: string, input: CreateInventoryItemInput): Promise<InventoryItemDTO> {
    if (input.supplierId) await this.assertSupplier(input.supplierId);
    return prisma.inventoryItem.create({
      data: {
        hotelId,
        name: input.name,
        category: input.category,
        sku: input.sku ?? null,
        unit: input.unit,
        currentStock: input.currentStock,
        reorderLevel: input.reorderLevel,
        costPerUnit: input.costPerUnit != null ? new Prisma.Decimal(input.costPerUnit) : null,
        supplierId: input.supplierId ?? null,
      },
      include: itemInclude,
    });
  }

  async updateItem(hotelId: string, id: string, input: UpdateInventoryItemInput): Promise<InventoryItemDTO> {
    await this.getItem(hotelId, id);
    if (input.supplierId) await this.assertSupplier(input.supplierId);
    const data: Prisma.InventoryItemUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.category !== undefined) data.category = input.category;
    if (input.sku !== undefined) data.sku = input.sku;
    if (input.unit !== undefined) data.unit = input.unit;
    if (input.reorderLevel !== undefined) data.reorderLevel = input.reorderLevel;
    if (input.costPerUnit !== undefined)
      data.costPerUnit = input.costPerUnit === null ? null : new Prisma.Decimal(input.costPerUnit);
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.supplierId !== undefined) {
      data.supplier = input.supplierId ? { connect: { id: input.supplierId } } : { disconnect: true };
    }
    return prisma.inventoryItem.update({ where: { id }, data, include: itemInclude });
  }

  async removeItem(hotelId: string, id: string): Promise<void> {
    await this.getItem(hotelId, id);
    await prisma.inventoryItem.update({ where: { id }, data: { isActive: false } });
  }

  // ─── Stock movements ───────────────────────────────
  private nextStock(type: string, current: number, quantity: number): number {
    switch (type) {
      case 'IN':
      case 'RETURN':
        return current + quantity;
      case 'OUT':
      case 'DAMAGE':
        return current - quantity;
      case 'ADJUSTMENT':
        return quantity; // absolute set
      default:
        return current;
    }
  }

  async recordMovement(
    hotelId: string,
    itemId: string,
    actorId: string,
    input: CreateStockMovementInput,
  ): Promise<InventoryItemDTO> {
    return runSerializable(async (tx) => {
      const item = await tx.inventoryItem.findFirst({ where: { id: itemId, hotelId }, select: { id: true, currentStock: true } });
      if (!item) throw new NotFoundError('Inventory item not found');

      const newStock = this.nextStock(input.type, item.currentStock, input.quantity);
      if (newStock < 0) {
        throw new ValidationError('Movement would drive stock below zero');
      }

      await tx.stockMovement.create({
        data: {
          itemId,
          type: input.type,
          quantity: input.quantity,
          previousStock: item.currentStock,
          newStock,
          reason: input.reason ?? null,
          referenceNo: input.referenceNo ?? null,
          createdBy: actorId,
        },
      });
      await tx.inventoryItem.update({ where: { id: itemId }, data: { currentStock: newStock } });
      return tx.inventoryItem.findFirstOrThrow({ where: { id: itemId }, include: itemInclude });
    });
  }

  async listMovements(
    hotelId: string,
    itemId: string,
    query: ListStockMovementsQuery,
  ): Promise<{ items: StockMovementDTO[]; meta: PaginationMeta }> {
    await this.getItem(hotelId, itemId);
    const { page, limit, sortOrder } = query;
    const where: Prisma.StockMovementWhereInput = { itemId };
    const { skip, take } = toSkipTake(page, limit);
    const [items, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({ where, orderBy: { createdAt: sortOrder }, skip, take }),
      prisma.stockMovement.count({ where }),
    ]);
    return { items, meta: buildPaginationMeta(page, limit, total) };
  }
}

export const inventoryService = new InventoryService();
