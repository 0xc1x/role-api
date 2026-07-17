import {
  canActorTransition,
  isTransitionAllowed,
  ORDER_TRANSITIONS,
} from './order-status.machine';

describe('order status machine', () => {
  it('allows pending → confirmed', () => {
    expect(isTransitionAllowed('pending', 'confirmed')).toBe(true);
  });

  it('rejects completed → pending', () => {
    expect(isTransitionAllowed('completed', 'pending')).toBe(false);
  });

  it('has no transitions out of terminal states', () => {
    expect(ORDER_TRANSITIONS.completed).toEqual([]);
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
    expect(ORDER_TRANSITIONS.expired).toEqual([]);
  });

  it('lets consumer cancel early orders', () => {
    expect(
      canActorTransition('user', 'pending', 'cancelled', {
        isOrderOwner: true,
        isBusinessOwner: false,
      }),
    ).toBe(true);
  });

  it('blocks consumer from confirming', () => {
    expect(
      canActorTransition('user', 'pending', 'confirmed', {
        isOrderOwner: true,
        isBusinessOwner: false,
      }),
    ).toBe(false);
  });

  it('lets business owner advance to ready_for_pickup', () => {
    expect(
      canActorTransition('business', 'confirmed', 'ready_for_pickup', {
        isOrderOwner: false,
        isBusinessOwner: true,
      }),
    ).toBe(true);
  });

  it('lets admin do anything allowed by graph', () => {
    expect(
      canActorTransition('admin', 'picked_up', 'completed', {
        isOrderOwner: false,
        isBusinessOwner: false,
      }),
    ).toBe(true);
  });
});
