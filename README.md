# Role API

NestJS backend for **Role** — a Too Good To Go–style surplus food marketplace.

The mobile app currently talks to Supabase directly. This API is the BFF that will own business rules (stock, order lifecycle, payments later) while Supabase remains the source of truth for Postgres schema and Auth.

## Stack

- **NestJS 11** (Express)
- **Drizzle ORM** + `postgres` (Supabase pooler, `prepare: false`)
- **Supabase Auth** JWT verification (`jose`)
- **Zod** validation (+ shared types from `@0xc1x/role-commons`)
- **Scalar** OpenAPI UI at `/docs`

## Quick start

```bash
# 1) Build shared package (sibling repo)
cd ../role-commons && bun run build

# 2) Install API deps
cd ../role-api && npm install

# 3) Configure env
cp .env.example .env
# fill DATABASE_URL, SUPABASE_URL, SUPABASE_JWT_SECRET

# 4) Run
npm run start:dev
```

- Health: `GET http://localhost:3000/api/v1/health`
- Docs: `http://localhost:3000/docs`

## Environment

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default `3000`) |
| `DATABASE_URL` | Postgres URL (prefer Supabase **Transaction** pooler `:6543`) |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase → Project Settings → API |
| `CORS_ORIGINS` | `*` or comma-separated origins |

Schema ownership: **Supabase**. Do not push Drizzle migrations from this repo in v1. Hand-written Drizzle tables mirror `public` for offers/orders/profiles/businesses. Optional:

```bash
npm run db:pull    # introspect remote (review before overwriting)
npm run db:studio
```

## Auth

Send Supabase access tokens:

```http
Authorization: Bearer <supabase_access_token>
```

- JWT verified with `SUPABASE_JWT_SECRET` (HS256)
- `role` loaded from `public.profiles` (not from client `user_metadata`)
- `@Public()` routes: health + offer list/detail
- Orders require authentication

## API surface (v1)

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| `GET` | `/api/v1/health` | public | DB ping |
| `GET` | `/api/v1/offers` | public | Filters: category, geo, pagination |
| `GET` | `/api/v1/offers/:id` | public | Detail + business/location |
| `POST` | `/api/v1/orders` | user | `{ offer_id }` — stock transaction |
| `GET` | `/api/v1/orders` | user | My orders |
| `GET` | `/api/v1/orders/:id` | owner / business / admin | |
| `PATCH` | `/api/v1/orders/:id/status` | role rules | State machine |

### Order status machine

```
pending → confirmed | cancelled | expired
confirmed → ready_for_pickup | cancelled
ready_for_pickup → picked_up | cancelled | expired
picked_up → completed
```

Each transition writes `order_events`.

## Project layout

```
src/
  auth/           # JWT guard, roles guard
  common/         # filters, pipes, decorators
  config/         # Zod env validation
  database/       # Drizzle module + schema
  modules/
    health/
    offers/
    orders/
  main.ts
  app.module.ts
```

## Shared package

```json
"@0xc1x/role-commons": "file:../role-commons"
```

Rebuild commons after type changes:

```bash
cd ../role-commons && bun run build
# if npm link cache is stale: cd ../role-api && npm install
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run start:dev` | Watch mode |
| `npm run build` | Compile |
| `npm test` | Unit tests (incl. order state machine) |
| `npm run lint` | ESLint |

## Security notes

- Never expose the Supabase **service_role** key to the mobile app.
- The API uses a privileged DB connection; **authorization is enforced in Nest** (owner / business owner / admin checks).
- Do not trust `user_metadata` for roles.

## Roadmap (next waves)

- Business portal: manage offers, hours, locations
- Favorites, reviews, saved addresses
- Payments / coupons / payouts
- Notifications & device tokens
- Point mobile clients at this API
