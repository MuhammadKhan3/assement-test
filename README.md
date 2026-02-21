# Flash Deal Reservation API

Backend REST API for flash sale scenarios. It ensures atomic product reservations using Redis Lua scripts and PostgreSQL.

---

## Tech Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Runtime** | Node.js + TypeScript | Type safety and performance. |
| **Framework** | Express.js | Lightweight REST API framework. |
| **Database** | PostgreSQL via Prisma | ACID transactions for order persistence. |
| **Cache/Concurrency** | Redis (ioredis) | Atomic locks using Lua scripts. |
| **Validation** | Zod | Runtime schema validation. |
| **Documentation** | Swagger UI | API documentation interface. |
| **Security** | Helmet + Rate Limit | Protection against common vulnerabilities. |

---

## How to Start

### Prerequisites
- Docker & Docker Compose
- Node.js (v18+)

### Quick Start
1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Setup Environment**:
   ```bash
   cp .env.example .env
   ```
3. **Infrastructure**:
   ```bash
   docker compose up -d
   ```
4. **Initialize Database**:
   ```bash
   npm run setup
   ```
5. **Run**:
   ```bash
   npm run dev
   ```

API available at http://localhost:3000.

---

## Reservation Logic

When a user reserves an item:

1.  **Lua Script**: A Lua script (`reserve_batch.lua`) is called.
2.  **Checks**: Inside Redis, the script checks for active reservations and sufficient stock.
3.  **Atomic Update**: Redis decrements stock and creates a reservation key with a TTL.
4.  **Database Sync**: The service records the reservation in PostgreSQL.

This dual-layer approach ensures that **no two requests can ever claim the same unit of stock**, resolving race conditions at the cache layer.

---

## Expiration Logic

Reservations are temporary. Cleanup is handled via Redis Keyspace Notifications:

1.  **TTL Expiry**: When a reservation key expires in Redis.
2.  **Event**: Redis emits an `expired` event.
3.  **Listener**: A listener in `src/config/redis.ts` catches the event.
4.  **Restoration**: The system increments the product stock in Redis and updates the database record to `EXPIRED`.

---

## API Documentation

-   **Swagger UI**: http://localhost:3000/api-docs
-   **Health Check**: http://localhost:3000/health

### Endpoints
- `POST /api/products`: Create product and seed stock.
- `GET /api/products/:id/status`: View stock and reservation stats.
- `POST /api/reservations/reserve`: Reserve items.
- `POST /api/reservations/checkout`: Convert reservations into orders.
- `DELETE /api/reservations/:productId`: Release a reservation.

---

## Project Structure

```text
src/
├── config/       # Configuration and initializers
├── controllers/  # Request handlers
├── repositories/ # Database abstraction layer
├── services/     # Business logic
├── routes/       # Route definitions
├── scripts/      # Lua scripts
└── utils/        # General utilities
```
