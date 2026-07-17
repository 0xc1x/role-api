export * from './enums';
export * from './profiles';
export * from './businesses';
export * from './business-locations';
export * from './offers';
export * from './orders';

import { businessLocations } from './business-locations';
import { businesses } from './businesses';
import { offers } from './offers';
import { orderEvents, orders } from './orders';
import { profiles } from './profiles';

/** Schema map passed to drizzle() for typed queries. */
export const schema = {
  profiles,
  businesses,
  businessLocations,
  offers,
  orders,
  orderEvents,
};

export type DatabaseSchema = typeof schema;
