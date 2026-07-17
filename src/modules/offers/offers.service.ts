import { Injectable, NotFoundException } from '@nestjs/common';
import { toNumber, toNumberOrNull } from '../../common/utils/numeric';
import type { OfferListRow } from './offers.repository';
import { OffersRepository } from './offers.repository';
import type { ListOffersQuery } from '@0xc1x/role-commons';

export type OfferResponse = {
  id: string;
  business_id: string;
  business_location_id: string;
  title: string;
  description: string | null;
  image: string | null;
  category: string | null;
  original_price: number;
  discounted_price: number;
  discount_percentage: number | null;
  stock: number;
  initial_stock: number;
  pickup_start: string;
  pickup_end: string;
  is_active: boolean;
  includes: string | null;
  allergens: string | null;
  rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
  business: {
    id: string;
    name: string;
    slug: string;
    image: string | null;
    rating: number | null;
  };
  location: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    zone: string | null;
  };
};

@Injectable()
export class OffersService {
  constructor(private readonly offersRepository: OffersRepository) {}

  async list(query: ListOffersQuery) {
    const { items, total } = await this.offersRepository.findMany(query);
    return {
      data: items.map((row) => this.toResponse(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        total_pages: Math.ceil(total / query.limit) || 0,
      },
    };
  }

  async getById(id: string): Promise<OfferResponse> {
    const row = await this.offersRepository.findById(id);
    if (!row) {
      throw new NotFoundException(`Offer ${id} not found`);
    }
    return this.toResponse(row);
  }

  private toResponse(row: OfferListRow): OfferResponse {
    return {
      id: row.id,
      business_id: row.business_id,
      business_location_id: row.business_location_id,
      title: row.title,
      description: row.description,
      image: row.image,
      category: row.category,
      original_price: toNumber(row.original_price),
      discounted_price: toNumber(row.discounted_price),
      discount_percentage: toNumberOrNull(row.discount_percentage),
      stock: row.stock,
      initial_stock: row.initial_stock,
      pickup_start: row.pickup_start.toISOString(),
      pickup_end: row.pickup_end.toISOString(),
      is_active: row.is_active,
      includes: row.includes,
      allergens: row.allergens,
      rating: toNumber(row.rating),
      review_count: row.review_count,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      business: {
        id: row.business_id,
        name: row.business_name,
        slug: row.business_slug,
        image: row.business_image,
        rating: toNumberOrNull(row.business_rating),
      },
      location: {
        id: row.business_location_id,
        name: row.location_name,
        address: row.location_address,
        latitude: toNumber(row.location_latitude),
        longitude: toNumber(row.location_longitude),
        zone: row.location_zone,
      },
    };
  }
}
