import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import type { OrderStatus } from '@0xc1x/role-commons';
import { type Database } from '../../database/database.module';
import { DRIZZLE } from '../../database/database.tokens';
import { businesses, orderEvents, orders } from '../../database/schema';

@Injectable()
export class OrdersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  get dbClient(): Database {
    return this.db;
  }

  async insertOrder(
    tx: Database,
    values: typeof orders.$inferInsert,
  ): Promise<typeof orders.$inferSelect> {
    const [row] = await tx.insert(orders).values(values).returning();
    if (!row) throw new Error('Failed to insert order');
    return row;
  }

  async insertEvent(
    tx: Database,
    values: typeof orderEvents.$inferInsert,
  ): Promise<void> {
    await tx.insert(orderEvents).values(values);
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);
    return row ?? null;
  }

  async findByIdWithBusinessOwner(id: string) {
    const [row] = await this.db
      .select({
        order: orders,
        business_owner_id: businesses.owner_id,
      })
      .from(orders)
      .innerJoin(businesses, eq(orders.business_id, businesses.id))
      .where(eq(orders.id, id))
      .limit(1);
    return row ?? null;
  }

  async listForUser(
    userId: string,
    opts: { status?: OrderStatus; page: number; limit: number },
  ) {
    const filters: SQL[] = [eq(orders.user_id, userId)];
    if (opts.status) filters.push(eq(orders.status, opts.status));
    const where = and(...filters);
    const offset = (opts.page - 1) * opts.limit;

    const [items, totalRow] = await Promise.all([
      this.db
        .select()
        .from(orders)
        .where(where)
        .orderBy(desc(orders.created_at))
        .limit(opts.limit)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(orders)
        .where(where)
        .then((rows) => rows[0]?.value ?? 0),
    ]);

    return { items, total: Number(totalRow) };
  }

  async updateStatus(
    tx: Database,
    id: string,
    status: OrderStatus,
  ): Promise<typeof orders.$inferSelect | null> {
    const [row] = await tx
      .update(orders)
      .set({ status, updated_at: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return row ?? null;
  }

  async isBusinessOwner(businessId: string, userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: businesses.id })
      .from(businesses)
      .where(and(eq(businesses.id, businessId), eq(businesses.owner_id, userId)))
      .limit(1);
    return Boolean(row);
  }
}
