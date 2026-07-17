import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { OrderStatus } from '@0xc1x/role-commons';
import { toNumber } from '../../common/utils/numeric';
import type { AuthUser } from '../../auth/auth.types';
import { OffersRepository } from '../offers/offers.repository';
import {
  canActorTransition,
  isTransitionAllowed,
} from './order-status.machine';
import { OrdersRepository } from './orders.repository';
import type {
  CreateOrderRequest,
  ListOrdersQuery,
  UpdateOrderStatusRequest,
} from '@0xc1x/role-commons';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly offersRepository: OffersRepository,
  ) {}

  async create(user: AuthUser, body: CreateOrderRequest) {
    // coupon_code reserved for later wave
    void body.coupon_code;

    const created = await this.ordersRepository.dbClient.transaction(
      async (tx) => {
        const offer = await this.offersRepository.findByIdForUpdate(
          tx,
          body.offer_id,
        );
        if (!offer) {
          throw new NotFoundException(`Offer ${body.offer_id} not found`);
        }

        const now = new Date();
        if (!offer.is_active) {
          throw new ConflictException('Offer is not active');
        }
        if (offer.stock < 1) {
          throw new ConflictException('Offer is out of stock');
        }
        if (offer.pickup_end <= now) {
          throw new ConflictException('Offer pickup window has ended');
        }

        const decremented = await this.offersRepository.decrementStock(
          tx,
          offer.id,
          1,
        );
        if (!decremented) {
          throw new ConflictException('Offer is out of stock');
        }

        const orderNumber = this.generateOrderNumber();
        const pickupCode = this.generatePickupCode();

        const order = await this.ordersRepository.insertOrder(tx, {
          user_id: user.id,
          offer_id: offer.id,
          business_id: offer.business_id,
          order_number: orderNumber,
          status: 'pending',
          price: offer.discounted_price,
          original_price: offer.original_price,
          pickup_code: pickupCode,
          pickup_time: offer.pickup_start,
          coupon_id: null,
        });

        await this.ordersRepository.insertEvent(tx, {
          order_id: order.id,
          status: 'pending',
          previous_status: null,
          changed_by: user.id,
          reason: 'Order created',
          metadata: { source: 'api' },
        });

        return order;
      },
    );

    return this.toResponse(created);
  }

  async listMine(user: AuthUser, query: ListOrdersQuery) {
    const { items, total } = await this.ordersRepository.listForUser(user.id, {
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
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

  async getById(user: AuthUser, id: string) {
    const row = await this.ordersRepository.findByIdWithBusinessOwner(id);
    if (!row) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    const isOwner = row.order.user_id === user.id;
    const isBusinessOwner = row.business_owner_id === user.id;
    if (!isOwner && !isBusinessOwner && user.role !== 'admin') {
      throw new ForbiddenException('You cannot access this order');
    }

    return this.toResponse(row.order);
  }

  async updateStatus(
    user: AuthUser,
    id: string,
    body: UpdateOrderStatusRequest,
  ) {
    const row = await this.ordersRepository.findByIdWithBusinessOwner(id);
    if (!row) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    const current = row.order.status as OrderStatus;
    const next = body.status;

    if (current === next) {
      return this.toResponse(row.order);
    }

    if (!isTransitionAllowed(current, next)) {
      throw new UnprocessableEntityException(
        `Cannot transition order from '${current}' to '${next}'`,
      );
    }

    const isOrderOwner = row.order.user_id === user.id;
    const isBusinessOwner = row.business_owner_id === user.id;

    if (
      !canActorTransition(user.role, current, next, {
        isOrderOwner,
        isBusinessOwner,
      })
    ) {
      throw new ForbiddenException(
        `Role '${user.role}' cannot transition order to '${next}'`,
      );
    }

    const updated = await this.ordersRepository.dbClient.transaction(
      async (tx) => {
        const order = await this.ordersRepository.updateStatus(tx, id, next);
        if (!order) {
          throw new NotFoundException(`Order ${id} not found`);
        }
        await this.ordersRepository.insertEvent(tx, {
          order_id: id,
          status: next,
          previous_status: current,
          changed_by: user.id,
          reason: body.reason ?? null,
          metadata: { source: 'api' },
        });
        return order;
      },
    );

    return this.toResponse(updated);
  }

  private toResponse(row: typeof import('../../database/schema').orders.$inferSelect) {
    return {
      id: row.id,
      user_id: row.user_id,
      offer_id: row.offer_id,
      business_id: row.business_id,
      order_number: row.order_number,
      status: row.status,
      price: toNumber(row.price),
      original_price: toNumber(row.original_price),
      pickup_code: row.pickup_code,
      pickup_time: row.pickup_time ? row.pickup_time.toISOString() : null,
      coupon_id: row.coupon_id,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const y = date.getUTCFullYear().toString().slice(-2);
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const rand = randomBytes(3).toString('hex').toUpperCase();
    return `RLE-${y}${m}${d}-${rand}`;
  }

  private generatePickupCode(): string {
    // 6-char alphanumeric, easy to read at counter
    return randomBytes(3).toString('hex').toUpperCase();
  }
}
