import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  sql,
  type SQL,
} from 'drizzle-orm';
import { type Database } from '../../database/database.module';
import { DRIZZLE } from '../../database/database.tokens';
import {
  businessLocations,
  businesses,
  offers,
} from '../../database/schema';
import type { ListOffersQuery } from '@0xc1x/role-commons';

export type OfferListRow = {
  id: string;
  business_id: string;
  business_location_id: string;
  title: string;
  description: string | null;
  image: string | null;
  category: string | null;
  original_price: string;
  discounted_price: string;
  discount_percentage: string | null;
  stock: number;
  initial_stock: number;
  pickup_start: Date;
  pickup_end: Date;
  is_active: boolean;
  includes: string | null;
  allergens: string | null;
  rating: string;
  review_count: number;
  created_at: Date;
  updated_at: Date;
  business_name: string;
  business_slug: string;
  business_image: string | null;
  business_rating: string | null;
  location_name: string;
  location_address: string;
  location_latitude: string;
  location_longitude: string;
  location_zone: string | null;
};

@Injectable()
export class OffersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private baseSelect() {
    return this.db
      .select({
        id: offers.id,
        business_id: offers.business_id,
        business_location_id: offers.business_location_id,
        title: offers.title,
        description: offers.description,
        image: offers.image,
        category: offers.category,
        original_price: offers.original_price,
        discounted_price: offers.discounted_price,
        discount_percentage: offers.discount_percentage,
        stock: offers.stock,
        initial_stock: offers.initial_stock,
        pickup_start: offers.pickup_start,
        pickup_end: offers.pickup_end,
        is_active: offers.is_active,
        includes: offers.includes,
        allergens: offers.allergens,
        rating: offers.rating,
        review_count: offers.review_count,
        created_at: offers.created_at,
        updated_at: offers.updated_at,
        business_name: businesses.name,
        business_slug: businesses.slug,
        business_image: businesses.image,
        business_rating: businesses.rating,
        location_name: businessLocations.name,
        location_address: businessLocations.address,
        location_latitude: businessLocations.latitude,
        location_longitude: businessLocations.longitude,
        location_zone: businessLocations.zone,
      })
      .from(offers)
      .innerJoin(businesses, eq(offers.business_id, businesses.id))
      .innerJoin(
        businessLocations,
        eq(offers.business_location_id, businessLocations.id),
      );
  }

  private buildFilters(query: ListOffersQuery): SQL[] {
    const filters: SQL[] = [];

    if (query.available_only) {
      filters.push(eq(offers.is_active, true));
      filters.push(eq(businesses.is_active, true));
      filters.push(gt(offers.stock, 0));
      filters.push(gt(offers.pickup_end, sql`now()`));
    }

    if (query.category) {
      filters.push(eq(offers.category, query.category));
    }
    if (query.business_id) {
      filters.push(eq(offers.business_id, query.business_id));
    }

    if (
      query.lat !== undefined &&
      query.lng !== undefined &&
      query.radius_km !== undefined
    ) {
      // Haversine distance in km (lat/lng stored as numeric).
      filters.push(
        sql`(
          6371 * acos(
            least(1.0, greatest(-1.0,
              cos(radians(${query.lat}))
              * cos(radians(${businessLocations.latitude}::double precision))
              * cos(radians(${businessLocations.longitude}::double precision) - radians(${query.lng}))
              + sin(radians(${query.lat}))
              * sin(radians(${businessLocations.latitude}::double precision))
            ))
          )
        ) <= ${query.radius_km}`,
      );
    }

    return filters;
  }

  async findMany(query: ListOffersQuery): Promise<{
    items: OfferListRow[];
    total: number;
  }> {
    const filters = this.buildFilters(query);
    const where = filters.length ? and(...filters) : undefined;
    const offset = (query.page - 1) * query.limit;

    const [items, totalRow] = await Promise.all([
      this.baseSelect()
        .where(where)
        .orderBy(desc(offers.pickup_end))
        .limit(query.limit)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(offers)
        .innerJoin(businesses, eq(offers.business_id, businesses.id))
        .innerJoin(
          businessLocations,
          eq(offers.business_location_id, businessLocations.id),
        )
        .where(where)
        .then((rows) => rows[0]?.value ?? 0),
    ]);

    return { items: items as OfferListRow[], total: Number(totalRow) };
  }

  async findById(id: string): Promise<OfferListRow | null> {
    const [row] = await this.baseSelect()
      .where(eq(offers.id, id))
      .limit(1);
    return (row as OfferListRow | undefined) ?? null;
  }

  async findByIdForUpdate(
    tx: Database,
    id: string,
  ): Promise<typeof offers.$inferSelect | null> {
    const [row] = await tx
      .select()
      .from(offers)
      .where(eq(offers.id, id))
      .for('update')
      .limit(1);
    return row ?? null;
  }

  async decrementStock(tx: Database, id: string, amount = 1): Promise<boolean> {
    const result = await tx
      .update(offers)
      .set({
        stock: sql`${offers.stock} - ${amount}`,
        updated_at: sql`now()`,
      })
      .where(and(eq(offers.id, id), gte(offers.stock, amount)))
      .returning({ id: offers.id });
    return result.length > 0;
  }
}
