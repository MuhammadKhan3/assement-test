# Flash Deal Reservation API 🚀

A production-ready backend REST API that allows users to reserve limited-stock products during flash sale events — **without overselling**, even under high concurrency.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js + TypeScript | Type safety, performance |
| Framework | Express.js | Minimal, battle-tested |
| Database | **PostgreSQL** via Prisma ORM | Relational, ACID transactions, permanent records |
| Cache / Locks | **Redis** (ioredis) | Sub-millisecond atomic operations via Lua scripts |
| Validation | Zod | Schema-first, compile-time safe |
| API Docs | Swagger UI | Auto-generated from JSDoc |
| Rate Limiting | express-rate-limit | Abuse prevention |
| Dev Infra | Docker Compose | Zero-friction local setup |

---

## How to Start the Project

### Prerequisites
- [Docker](https://docker.com) & Docker Compose
- Node.js 18+

### Quick Start

```bash
# 1. Clone the repo & install dependencies
npm install

# 2. Copy env file
cp .env.example .env

# 3. Start PostgreSQL + Redis containers
docker compose up -d

# 4. Generate Prisma client & push DB schema
npx prisma generate
npx prisma db push

# 5. Start the development server
npm run dev
```

The API is now running at **http://localhost:3000**  
Swagger Docs: **http://localhost:3000/api-docs**

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with hot-reload (ts-node-dev) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled build |
| `npm run db:push` | Sync Prisma schema to DB |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |
| `npm run stress-test` | Run concurrency stress test |

---

## How the Reservation Lock Works

```
User → POST /api/reservations/reserve
         │
         ▼
  ┌──────────────────────────────────────┐
  │  Redis Lua Script (ATOMIC)           │
  │                                      │
  │  1. GET product:{id}:stock           │
  │  2. IF stock >= qty THEN             │
  │     DECRBY product:{id}:stock qty    │
  │     SET reservation:{userId}:{pid}   │
  │         <payload> EX 600             │
  │  3. ELSE return -1 (out of stock)    │
  └──────────────────────────────────────┘
         │
         ▼
  Prisma: INSERT Reservation (status=ACTIVE)
```

Because the Lua script executes **atomically** in Redis (single-threaded), two concurrent users can never both pass the stock check for the same units. This **completely prevents overselling** even under thousands of simultaneous requests.

### Multi-SKU Reservation with Rollback

When reserving multiple products in one request, the service iterates through items and runs the atomic Lua script per item. If *any* item fails (e.g., insufficient stock for item 3), all previously locked items are released using a compensating `releaseLua` script — like a distributed rollback.

---

## How Expiry Works

Redis keys have a **600-second (10 minute) TTL** set at reservation time:

```
reservation:{userId}:{productId}  →  expires in 600s
```

When a key expires:
1. Redis emits a **keyspace notification** on the `__keyevent@0__:expired` channel
2. Our subscriber listens, parses the expired key name to extract `userId` and `productId`
3. The `handleReservationExpiry()` function:
   - Restores the quantity to the Redis stock key (`INCRBY`)
   - Updates the DB `Reservation` record to `status = EXPIRED`

This means **no background job / cron is needed** — Redis itself triggers the expiry logic.

> For testing, set `RESERVATION_TTL_SECONDS=30` in `.env` to use a 30-second TTL.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/products` | Create product with initial stock |
| `GET` | `/api/products/:id/status` | Get total / reserved / available stock |
| `POST` | `/api/reservations/reserve` | Reserve 1+ items (10-min lock) |
| `POST` | `/api/reservations/checkout` | Finalize purchase → permanent DB order |
| `DELETE` | `/api/reservations/:productId` | Cancel reservation early |
| `GET` | `/health` | Health check |
| `GET` | `/api-docs` | Swagger UI |

---

## Example: Happy Path

```bash
# 1. Create product (100 units at $49.99)
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Flash Sneakers","totalStock":100,"price":49.99}'

# 2. Reserve 3 units for user alice
curl -X POST http://localhost:3000/api/reservations/reserve \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice","items":[{"productId":"<id>","quantity":3}]}'

# 3. Check stock → available: 97, reserved: 3
curl http://localhost:3000/api/products/<id>/status

# 4. Checkout
curl -X POST http://localhost:3000/api/reservations/checkout \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice","items":[{"productId":"<id>","quantity":3}]}'

# 5. Cancel a reservation (before checkout)
curl -X DELETE http://localhost:3000/api/reservations/<productId> \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice"}'
```

---

## Concurrency Stress Test

```bash
npm run stress-test
```

Creates a product with **5 units**, fires **50 concurrent** reservation requests, and asserts exactly 5 succeed (45 fail with `409 Insufficient stock`).

---

## Project Structure

```
src/
├── config/          # prisma.ts, redis.ts — singleton clients
├── controllers/     # Thin HTTP layer only — no business logic
├── services/        # All business logic (product + reservation)
├── routes/          # Express routers with Swagger JSDoc
├── middlewares/     # validate.ts, errorHandler.ts, rateLimiter.ts
├── validators/      # Zod schemas
├── scripts/         # Lua scripts (reserve.lua, release.lua, checkout.lua)
└── index.ts         # App entry point
prisma/
└── schema.prisma    # DB models: Product, Order, Reservation
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `RESERVATION_TTL_SECONDS` | `600` | Reservation lock duration (seconds) |
| `RATE_LIMIT_MAX_REQUESTS` | `60` | Max requests per window per IP |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
# assement-test
