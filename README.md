# Flash Deal Reservation API 🚀

A high-concurrency backend REST API designed for flash sale scenarios. It ensures atomic product reservations using Redis Lua scripts and PostgreSQL, preventing overselling even under extreme load.

---

## 🛠 Tech Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Runtime** | Node.js + TypeScript | High performance with robust type safety. |
| **Framework** | Express.js | Lightweight and flexible for building fast REST APIs. |
| **Database** | **PostgreSQL** via Prisma | Reliable persistence with ACID transactions for orders. |
| **Cache/Concurrency** | **Redis** (ioredis) | Sub-millisecond atomic locks using optimized Lua scripts. |
| **Validation** | Zod | Runtime schema validation with compile-time type inference. |
| **Documentation** | Swagger UI | Standardized API documentation and testing interface. |
| **Security** | Helmet + Rate Limit | Protection against common web vulnerabilities and brute force. |

---

## 🚀 How to Start

### Prerequisites
- [Docker](https://www.docker.com/) & Docker Compose
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
3. **Spin up Infrastructure**:
   ```bash
   docker compose up -d
   ```
4. **Initialize Database**:
   ```bash
   npm run setup
   ```
5. **Run the App**:
   ```bash
   npm run dev
   ```

The API will be available at [http://localhost:3000](http://localhost:3000).

---

## 🔒 Reservation Lock Logic

The core of the system lies in **Atomic Operations**. When a user attempts to reserve an item:

1.  **Lua Script Execution**: A pre-loaded Lua script (`reserve_batch.lua`) is called via `EVALSHA`.
2.  **Isolated Check**: Inside Redis, the script checks if:
    -   The user already has an active reservation for that product.
    -   There is sufficient stock available in the Redis stock key.
3.  **Atomic Update**: If checks pass, Redis decrements the stock and creates a reservation key with a TTL in a single atomic step.
4.  **Database Sync**: Once Redis confirms the lock, the `ReservationService` records the active reservation in PostgreSQL for permanent tracking.

This dual-layer approach ensures that **no two requests can ever claim the same unit of stock**, resolving race conditions at the cache layer.

---

## ⏳ How Expiration Works

Reservations are temporary (default: 10 minutes). The cleanup is automated via **Redis Keyspace Notifications**:

1.  **TTL Expiry**: When a reservation key `reservation:{userId}:{productId}` expires in Redis.
2.  **Event Notification**: Redis emits an `expired` event.
3.  **Active Listener**: A dedicated listener in `src/config/redis.ts` catches the event.
4.  **Automatic Restoration**: The system automatically:
    -   Increments the product stock back in Redis.
    -   Updates the database record status to `EXPIRED`.

This eliminates the need for expensive background cron jobs or polling mechanisms.

---

## 📖 API Documentation

The API comes with built-in Swagger documentation for easy exploration and testing.

-   **Swagger UI**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
-   **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

### Key Endpoints
- `POST /api/products`: Create a product and seed its stock.
- `GET /api/products/:id/status`: View live stock and reservation stats.
- `POST /api/reservations/reserve`: Atomically reserve items.
- `POST /api/reservations/checkout`: Convert reservations into permanent orders.
- `DELETE /api/reservations/:productId`: Manually release a reservation.

---

## 📂 Project Structure

```text
src/
├── config/       # App constants and service initializers (Redis, Prisma)
├── controllers/  # Request handlers and response formatting
├── repositories/ # Standardized database abstraction layer (Prisma)
├── services/     # Core business logic and Redis management
├── routes/       # API route definitions and Swagger JSDoc
├── scripts/      # High-performance Lua scripts for Redis
└── utils/        # Generic utilities like structured logging
```
