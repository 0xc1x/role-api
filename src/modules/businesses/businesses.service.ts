import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { toNumber, toNumberOrNull } from '../../common/utils/numeric';
import type { AuthUser } from '../../auth/auth.types';
import { BusinessesRepository } from './businesses.repository';
import type {
  BusinessDto,
  CreateBusinessDto,
  UpdateBusinessDto,
  BusinessLocationDto,
  CreateBusinessLocationDto,
  UpdateBusinessLocationDto,
  ListBusinessesQuery,
  ListBusinessLocationsQuery,
} from '@0xc1x/role-commons';

@Injectable()
export class BusinessesService {
  constructor(private readonly businessesRepository: BusinessesRepository) {}

  // Business CRUD
  async list(
    user: AuthUser,
    query: ListBusinessesQuery,
  ): Promise<{
    data: BusinessDto[];
    meta: { page: number; limit: number; total: number; total_pages: number };
  }> {
    if (user.role === 'admin') {
      return this.listAll(query);
    }

    const { items, total } = await this.businessesRepository.listForUser(
      user.id,
      query,
    );
    return {
      data: items.map((row) => this.toBusinessDto(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        total_pages: Math.ceil(total / query.limit) || 0,
      },
    };
  }

  private async listAll(query: ListBusinessesQuery) {
    // For admin, list all businesses - we'll add a separate method for this
    const { items, total } = await this.businessesRepository.listAll(query);
    return {
      data: items.map((row) => this.toBusinessDto(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        total_pages: Math.ceil(total / query.limit) || 0,
      },
    };
  }

  async getById(user: AuthUser, id: string): Promise<BusinessDto> {
    const row = await this.businessesRepository.findById(id);
    if (!row) {
      throw new NotFoundException(`Business ${id} not found`);
    }
    await this.assertCanView(user, row);
    return this.toBusinessDto(row);
  }

  async create(
    user: AuthUser,
    body: CreateBusinessDto,
  ): Promise<BusinessDto> {
    if (user.role !== 'admin') {
      // Non-admin users create business with themselves as owner
      body.owner_id = user.id;
    }

    // Check slug uniqueness
    const existing = await this.businessesRepository.findBySlug(body.slug);
    if (existing) {
      throw new BadRequestException('Slug already exists');
    }

    const created = await this.businessesRepository.transaction(async (tx) => {
      return this.businessesRepository.insert(tx, {
        owner_id: body.owner_id!,
        name: body.name,
        type: body.type ?? 'restaurant',
        slug: body.slug,
        image: body.image ?? null,
        cover_image: body.cover_image ?? null,
        description: body.description ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        website: body.website ?? null,
        commission_rate: (body.commission_rate ?? 0.1).toString(),
        is_active: body.is_active ?? true,
      });
    });

    return this.toBusinessDto(created);
  }

  async update(
    user: AuthUser,
    id: string,
    body: UpdateBusinessDto,
  ): Promise<BusinessDto> {
    const existing = await this.businessesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Business ${id} not found`);
    }
    await this.assertCanMutate(user, existing);

    if (body.slug && body.slug !== existing.slug) {
      const slugExists = await this.businessesRepository.findBySlug(body.slug);
      if (slugExists) {
        throw new BadRequestException('Slug already exists');
      }
    }

    const updated = await this.businessesRepository.transaction(async (tx) => {
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = body.name;
      if (body.type !== undefined) patch.type = body.type;
      if (body.slug !== undefined) patch.slug = body.slug;
      if (body.image !== undefined) patch.image = body.image;
      if (body.cover_image !== undefined) patch.cover_image = body.cover_image;
      if (body.description !== undefined) patch.description = body.description;
      if (body.phone !== undefined) patch.phone = body.phone;
      if (body.email !== undefined) patch.email = body.email;
      if (body.website !== undefined) patch.website = body.website;
      if (body.commission_rate !== undefined && body.commission_rate !== null)
        patch.commission_rate = body.commission_rate.toString();
      if (body.is_active !== undefined) patch.is_active = body.is_active;

      const row = await this.businessesRepository.update(tx, id, patch as any);
      if (!row) {
        throw new NotFoundException(`Business ${id} not found`);
      }
      return row;
    });

    return this.toBusinessDto(updated);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const existing = await this.businessesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Business ${id} not found`);
    }
    await this.assertCanMutate(user, existing);

    await this.businessesRepository.transaction(async (tx) => {
      await this.businessesRepository.update(tx, id, { is_active: false });
    });
  }

  // Business Locations CRUD
  async listLocations(
    user: AuthUser,
    businessId: string,
    query: ListBusinessLocationsQuery,
  ): Promise<{
    data: BusinessLocationDto[];
    meta: { page: number; limit: number; total: number; total_pages: number };
  }> {
    await this.assertCanViewBusiness(user, businessId);

    const { items, total } =
      await this.businessesRepository.listLocationsForBusiness(
        businessId,
        query,
      );
    return {
      data: items.map((row) => this.toLocationDto(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        total_pages: Math.ceil(total / query.limit) || 0,
      },
    };
  }

  async getLocation(
    user: AuthUser,
    businessId: string,
    locationId: string,
  ): Promise<BusinessLocationDto> {
    await this.assertCanViewBusiness(user, businessId);

    const row = await this.businessesRepository.findLocationById(locationId);
    if (!row || row.business_id !== businessId) {
      throw new NotFoundException(`Location ${locationId} not found`);
    }
    return this.toLocationDto(row);
  }

  async createLocation(
    user: AuthUser,
    businessId: string,
    body: CreateBusinessLocationDto,
  ): Promise<BusinessLocationDto> {
    await this.assertCanMutateBusiness(user, businessId);

    if (body.is_headquarter) {
      // Ensure only one headquarter per business
      // We'll handle this in the DB or here - for now let DB handle
    }

    const created = await this.businessesRepository.transaction(async (tx) => {
      return this.businessesRepository.insertLocation(tx, {
        business_id: businessId,
        name: body.name,
        address: body.address,
        phone: body.phone ?? null,
        latitude: body.latitude.toString(),
        longitude: body.longitude.toString(),
        is_active: body.is_active ?? true,
        zone: body.zone ?? null,
        is_headquarter: body.is_headquarter ?? false,
      });
    });

    return this.toLocationDto(created);
  }

  async updateLocation(
    user: AuthUser,
    businessId: string,
    locationId: string,
    body: UpdateBusinessLocationDto,
  ): Promise<BusinessLocationDto> {
    await this.assertCanMutateBusiness(user, businessId);

    const existing = await this.businessesRepository.findLocationById(locationId);
    if (!existing || existing.business_id !== businessId) {
      throw new NotFoundException(`Location ${locationId} not found`);
    }

    const updated = await this.businessesRepository.transaction(async (tx) => {
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = body.name;
      if (body.address !== undefined) patch.address = body.address;
      if (body.phone !== undefined) patch.phone = body.phone;
      if (body.latitude !== undefined)
        patch.latitude = body.latitude.toString();
      if (body.longitude !== undefined)
        patch.longitude = body.longitude.toString();
      if (body.is_active !== undefined) patch.is_active = body.is_active;
      if (body.zone !== undefined) patch.zone = body.zone;
      if (body.is_headquarter !== undefined)
        patch.is_headquarter = body.is_headquarter;

      const row = await this.businessesRepository.updateLocation(
        tx,
        locationId,
        patch as any,
      );
      if (!row) {
        throw new NotFoundException(`Location ${locationId} not found`);
      }
      return row;
    });

    return this.toLocationDto(updated);
  }

  async removeLocation(
    user: AuthUser,
    businessId: string,
    locationId: string,
  ): Promise<void> {
    await this.assertCanMutateBusiness(user, businessId);

    const existing = await this.businessesRepository.findLocationById(locationId);
    if (!existing || existing.business_id !== businessId) {
      throw new NotFoundException(`Location ${locationId} not found`);
    }

    await this.businessesRepository.transaction(async (tx) => {
      await this.businessesRepository.updateLocation(tx, locationId, {
        is_active: false,
      });
    });
  }

  private async assertCanView(
    user: AuthUser,
    business: any,
  ): Promise<void> {
    if (user.role === 'admin') return;
    const isOwner = await this.businessesRepository.isOwner(
      business.id,
      user.id,
    );
    if (!isOwner) {
      throw new ForbiddenException('You can only view businesses you own');
    }
  }

  private async assertCanViewBusiness(
    user: AuthUser,
    businessId: string,
  ): Promise<void> {
    if (user.role === 'admin') return;
    const isOwner = await this.businessesRepository.isOwner(businessId, user.id);
    if (!isOwner) {
      throw new ForbiddenException('You can only access businesses you own');
    }
  }

  private async assertCanMutate(
    user: AuthUser,
    business: any,
  ): Promise<void> {
    if (user.role === 'admin') return;
    const isOwner = await this.businessesRepository.isOwner(
      business.id,
      user.id,
    );
    if (!isOwner) {
      throw new ForbiddenException('You can only manage businesses you own');
    }
  }

  private async assertCanMutateBusiness(
    user: AuthUser,
    businessId: string,
  ): Promise<void> {
    if (user.role === 'admin') return;
    const isOwner = await this.businessesRepository.isOwner(businessId, user.id);
    if (!isOwner) {
      throw new ForbiddenException('You can only manage businesses you own');
    }
  }

  private toBusinessDto(row: any): BusinessDto {
    return {
      id: row.id,
      owner_id: row.owner_id,
      name: row.name,
      type: row.type,
      slug: row.slug,
      image: row.image,
      cover_image: row.cover_image,
      description: row.description,
      phone: row.phone,
      email: row.email,
      website: row.website,
      commission_rate: toNumberOrNull(row.commission_rate),
      balance: toNumberOrNull(row.balance),
      rating: toNumberOrNull(row.rating),
      review_count: row.review_count ?? null,
      is_active: row.is_active,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }

  private toLocationDto(row: any): BusinessLocationDto {
    return {
      id: row.id,
      business_id: row.business_id,
      name: row.name,
      address: row.address,
      phone: row.phone,
      latitude: toNumber(row.latitude),
      longitude: toNumber(row.longitude),
      is_active: row.is_active,
      zone: row.zone,
      is_headquarter: row.is_headquarter,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }
}