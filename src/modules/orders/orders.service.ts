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
  canViewPickupCode,
  isTransitionAllowed,
  shouldRestockOnTransition,
  type OrderEventSource,
} from './order-status.machine';
import { OrdersRepository } from './orders.repository';
import type {
  CreateOrderRequest,
  ListBusinessOrdersQuery,
  ListOrdersQuery,
  UpdateOrderStatusRequest,
} from '@0xc1x/role-commons';
import type { orders as ordersTable } from '../../database/schema';

type OrderRow = typeof ordersTable.$inferSelect;

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
        const existing = await this.ordersRepository.findActiveByUserAndOffer(
          tx,
          user.id,
          body.offer_id,
        );
        if (existing) {
          throw new ConflictException(
            'You already have an active order for this offer',
          );
        }

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
          metadata: { source: 'api' satisfies OrderEventSource },
        });

        return order;
      },
    );

    return this.toResponse(created, {
      isOrderOwner: true,
      isBusinessOwner: false,
      isAdmin: user.role === 'admin',
    });
  }

  async listMine(user: AuthUser, query: ListOrdersQuery) {
    const { items, total } = await this.ordersRepository.listForUser(user.id, {
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
    return {
      data: items.map((row) =>
        this.toResponse(row, {
          isOrderOwner: true,
          isBusinessOwner: false,
          isAdmin: user.role === 'admin',
        }),
      ),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        total_pages: Math.ceil(total / query.limit) || 0,
      },
    };
  }

  async listForBusiness(user: AuthUser, query: ListBusinessOrdersQuery) {
    let businessId = query.business_id;

    if (!businessId) {
      // Default to first owned business when not specified.
      const owned = await this.offersRepository.findBusinessIdsOwnedBy(user.id);
      if (owned.length === 0 && user.role !== 'admin') {
        throw new ForbiddenException('You do not own any business');
      }
      if (owned.length === 0) {
        return {
          data: [],
          meta: {
            page: query.page,
            limit: query.limit,
            total: 0,
            total_pages: 0,
          },
        };
      }
      if (owned.length > 1 && user.role !== 'admin') {
        throw new UnprocessableEntityException(
          'business_id is required when you own multiple businesses',
        );
      }
      businessId = owned[0];
    } else if (user.role !== 'admin') {
      const isOwner = await this.ordersRepository.isBusinessOwner(
        businessId,
        user.id,
      );
      if (!isOwner) {
        throw new ForbiddenException('You do not own this business');
      }
    }

    const { items, total } = await this.ordersRepository.listForBusiness(
      businessId,
      {
        status: query.status,
        page: query.page,
        limit: query.limit,
      },
    );

    return {
      data: items.map((row) =>
        this.toResponse(row, {
          isOrderOwner: row.user_id === user.id,
          isBusinessOwner: true,
          isAdmin: user.role === 'admin',
        }),
      ),
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

    return this.toResponse(row.order, {
      isOrderOwner: isOwner,
      isBusinessOwner,
      isAdmin: user.role === 'admin',
    });
  }

  async updateStatus(
    user: AuthUser,
    id: string,
    body: UpdateOrderStatusRequest,
  ) {
    const updated = await this.ordersRepository.dbClient.transaction(
      async (tx) => {
        const locked = await this.ordersRepository.findByIdForUpdate(tx, id);
        if (!locked) {
          throw new NotFoundException(`Order ${id} not found`);
        }

        const current = locked.order.status as OrderStatus;
        const next = body.status;

        if (current === next) {
          return locked.order;
        }

        if (!isTransitionAllowed(current, next)) {
          throw new UnprocessableEntityException(
            `Cannot transition order from '${current}' to '${next}'`,
          );
        }

        const isOrderOwner = locked.order.user_id === user.id;
        const isBusinessOwner = locked.business_owner_id === user.id;

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

        const order = await this.ordersRepository.updateStatus(
          tx,
          id,
          next,
          current,
        );
        if (!order) {
          throw new ConflictException(
            'Order status changed concurrently; retry the request',
          );
        }

        if (shouldRestockOnTransition(current, next)) {
          await this.offersRepository.incrementStock(
            tx,
            locked.order.offer_id,
            1,
          );
        }

        const source: OrderEventSource =
          user.role === 'admin' ? 'admin' : 'api';

        await this.ordersRepository.insertEvent(tx, {
          order_id: id,
          status: next,
          previous_status: current,
          changed_by: user.id,
          reason: body.reason ?? null,
          metadata: { source },
        });

        return order;
      },
    );

    const isOrderOwner = updated.user_id === user.id;
    const isBusinessOwner = await this.ordersRepository.isBusinessOwner(
      updated.business_id,
      user.id,
    );

    return this.toResponse(updated, {
      isOrderOwner,
      isBusinessOwner,
      isAdmin: user.role === 'admin',
    });
  }

  /**
   * System job: expire pending/ready_for_pickup orders whose offer pickup_end has passed.
   * Restores stock in the same transaction per order.
   */
  async expireStaleOrders(): Promise<{ expired: number }> {
    const now = new Date();
    const candidates =
      await this.offersRepository.findOrderCandidatesToExpire(now);

    let expired = 0;

    for (const candidate of candidates) {
      await this.ordersRepository.dbClient.transaction(async (tx) => {
        const locked = await this.ordersRepository.findByIdForUpdate(
          tx,
          candidate.orderId,
        );
        if (!locked) return;

        const current = locked.order.status as OrderStatus;
        if (current !== 'pending' && current !== 'ready_for_pickup') {
          return;
        }
        if (!isTransitionAllowed(current, 'expired')) {
          return;
        }

        const order = await this.ordersRepository.updateStatus(
          tx,
          candidate.orderId,
          'expired',
          current,
        );
        if (!order) return;

        if (shouldRestockOnTransition(current, 'expired')) {
          await this.offersRepository.incrementStock(
            tx,
            locked.order.offer_id,
            1,
          );
        }

        await this.ordersRepository.insertEvent(tx, {
          order_id: candidate.orderId,
          status: 'expired',
          previous_status: current,
          changed_by: null,
          reason: 'Pickup window ended',
          metadata: { source: 'cron' satisfies OrderEventSource },
        });

        expired += 1;
      });
    }

    return { expired };
  }

  private toResponse(
    row: OrderRow,
    viewer: {
      isOrderOwner: boolean;
      isBusinessOwner: boolean;
      isAdmin: boolean;
    },
  ) {
    const status = row.status as OrderStatus;
    const showPickupCode = canViewPickupCode({
      status,
      isOrderOwner: viewer.isOrderOwner,
      isBusinessOwner: viewer.isBusinessOwner,
      isAdmin: viewer.isAdmin,
    });

    return {
      id: row.id,
      user_id: row.user_id,
      offer_id: row.offer_id,
      business_id: row.business_id,
      order_number: row.order_number,
      status: row.status,
      price: toNumber(row.price),
      original_price: toNumber(row.original_price),
      pickup_code: showPickupCode ? row.pickup_code : null,
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
