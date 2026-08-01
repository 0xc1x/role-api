import { Injectable, NotFoundException } from '@nestjs/common';
import { toNumber, toNumberOrNull } from '../../common/utils/numeric';
import type { OfferListRow, OfferRow, OfferUpdate } from './offers.repository';
import { OffersRepository } from './offers.repository';
import type {
  CreateOfferDto,
  ListOffersQuery,
  OfferDto,
  UpdateOfferDto,
} from '@0xc1x/role-commons';

export type OfferResponse = {
  id: string;
  business_id: string;
  business_location_id: string;
  title: string;
  description: string | null;
  image: string | null;
  category_ids: string[];
  categories: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
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

  async create(body: CreateOfferDto): Promise<OfferDto> {
    const created = await this.offersRepository.transaction(async (tx) => {
      const offer = await this.offersRepository.insert(tx, {
        business_id: body.business_id,
        business_location_id: body.business_location_id,
        title: body.title,
        description: body.description ?? null,
        image: body.image ?? null,
        original_price: body.original_price.toString(),
        discounted_price: body.discounted_price.toString(),
        stock: body.stock ?? 1,
        initial_stock: body.initial_stock ?? 1,
        pickup_start: new Date(body.pickup_start),
        pickup_end: new Date(body.pickup_end),
        is_active: body.is_active ?? true,
        includes: body.includes ?? null,
        allergens: body.allergens ?? null,
      });

      await this.offersRepository.setCategories(
        tx,
        offer.id,
        body.category_ids,
      );

      return offer;
    });

    const category_ids = await this.offersRepository.findCategoryIds(created.id);
    return this.toOfferDto(created, category_ids);
  }

  async update(id: string, body: UpdateOfferDto): Promise<OfferDto> {
    const existing = await this.offersRepository.findDtoById(id);
    if (!existing) {
      throw new NotFoundException(`Offer ${id} not found`);
    }

    const patch: OfferUpdate = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.description !== undefined) patch.description = body.description;
    if (body.image !== undefined) patch.image = body.image;
    if (body.original_price !== undefined) patch.original_price = body.original_price.toString();
    if (body.discounted_price !== undefined) patch.discounted_price = body.discounted_price.toString();
    if (body.stock !== undefined) patch.stock = body.stock;
    if (body.initial_stock !== undefined) patch.initial_stock = body.initial_stock;
    if (body.pickup_start !== undefined) patch.pickup_start = new Date(body.pickup_start);
    if (body.pickup_end !== undefined) patch.pickup_end = new Date(body.pickup_end);
    if (body.is_active !== undefined) patch.is_active = body.is_active;
    if (body.includes !== undefined) patch.includes = body.includes;
    if (body.allergens !== undefined) patch.allergens = body.allergens;
    if (body.business_location_id !== undefined) patch.business_location_id = body.business_location_id;

    const updated = await this.offersRepository.transaction(async (tx) => {
      const row = await this.offersRepository.update(tx, id, patch);
      if (!row) {
        throw new NotFoundException(`Offer ${id} not found`);
      }

      if (body.category_ids !== undefined) {
        await this.offersRepository.setCategories(tx, id, body.category_ids);
      }

      return row;
    });

    const category_ids = await this.offersRepository.findCategoryIds(updated.id);
    return this.toOfferDto(updated, category_ids);
  }

  async remove(id: string): Promise<void> {
    await this.offersRepository.transaction(async (tx) => {
      const row = await this.offersRepository.update(tx, id, {
        is_active: false,
      });
      if (!row) {
        throw new NotFoundException(`Offer ${id} not found`);
      }
      return row;
    });
  }

  private toOfferDto(row: OfferRow, categoryIds: string[]): OfferDto {
    return {
      id: row.id,
      business_id: row.business_id,
      business_location_id: row.business_location_id,
      title: row.title,
      description: row.description,
      image: row.image,
      category_ids: categoryIds,
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
    };
  }

  private toResponse(row: OfferListRow): OfferResponse {
    return {
      id: row.id,
      business_id: row.business_id,
      business_location_id: row.business_location_id,
      title: row.title,
      description: row.description,
      image: row.image,
      category_ids: row.category_ids,
      categories: row.category_ids.map((id, i) => ({
        id,
        name: row.category_names[i],
        slug: row.category_slugs[i],
      })),
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
