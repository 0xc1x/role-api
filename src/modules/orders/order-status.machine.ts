import type { AppRole, OrderStatus } from '@0xc1x/role-commons';

/** Allowed next statuses from a given status. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['picked_up', 'cancelled', 'expired'],
  picked_up: ['completed'],
  completed: [],
  cancelled: [],
  expired: [],
};

/** Who may perform a transition to the target status. */
export function canActorTransition(
  actorRole: AppRole,
  from: OrderStatus,
  to: OrderStatus,
  opts: { isOrderOwner: boolean; isBusinessOwner: boolean },
): boolean {
  if (actorRole === 'admin') return true;

  if (to === 'cancelled') {
    // Consumer can cancel early; business can cancel operationally.
    if (opts.isOrderOwner && (from === 'pending' || from === 'confirmed')) {
      return true;
    }
    if (
      opts.isBusinessOwner &&
      (from === 'pending' ||
        from === 'confirmed' ||
        from === 'ready_for_pickup')
    ) {
      return true;
    }
    return false;
  }

  if (to === 'expired') {
    // System/admin primarily; business can mark expired on ready/pending.
    return opts.isBusinessOwner || actorRole === 'business';
  }

  // Forward progress is business-side.
  if (
    (to === 'confirmed' ||
      to === 'ready_for_pickup' ||
      to === 'picked_up' ||
      to === 'completed') &&
    (opts.isBusinessOwner || actorRole === 'business')
  ) {
    return true;
  }

  return false;
}

export function isTransitionAllowed(from: OrderStatus, to: OrderStatus): boolean {
  return (ORDER_TRANSITIONS[from] as readonly string[]).includes(to);
}
