import fs from "fs";
import path from "path";
import { redis } from "../config/redis";

// Reservation TTL in seconds
const RESERVATION_TTL = parseInt(process.env.RESERVATION_TTL_SECONDS || "600", 10);

// Load Lua scripts
const scriptsDir = path.join(__dirname, "../scripts");
const reserveScript = fs.readFileSync(path.join(scriptsDir, "reserve.lua"), "utf-8");
const reserveBatchScript = fs.readFileSync(path.join(scriptsDir, "reserve_batch.lua"), "utf-8");
const releaseScript = fs.readFileSync(path.join(scriptsDir, "release.lua"), "utf-8");
const checkoutScript = fs.readFileSync(path.join(scriptsDir, "checkout.lua"), "utf-8");

export class RedisManagerService {
    /**
     * Key Helpers
     */
    static getStockKey(productId: string) {
        return `product:${productId}:stock`;
    }

    static getReservationKey(userId: string, productId: string) {
        return `reservation:${userId}:${productId}`;
    }

    static getReservationPattern(productId: string) {
        return `reservation:*:${productId}`;
    }

    /**
     * Stock Management
     */
    async setStock(productId: string, quantity: number) {
        return redis.set(RedisManagerService.getStockKey(productId), quantity);
    }

    async getStock(productId: string) {
        const val = await redis.get(RedisManagerService.getStockKey(productId));
        return val !== null ? parseInt(val, 10) : null;
    }

    async incrStock(productId: string, quantity: number) {
        return redis.incrby(RedisManagerService.getStockKey(productId), quantity);
    }

    async ensureStockKeys(products: { id: string; totalStock: number }[]) {
        const pipeline = redis.pipeline();
        for (const p of products) {
            pipeline.setnx(RedisManagerService.getStockKey(p.id), p.totalStock);
        }
        await pipeline.exec();
    }

    /**
     * Reservation Management
     */
    async reserve(userId: string, productId: string, quantity: number, payload: string) {
        const sKey = RedisManagerService.getStockKey(productId);
        const rKey = RedisManagerService.getReservationKey(userId, productId);

        return redis.eval(
            reserveScript,
            2,
            sKey,
            rKey,
            quantity,
            RESERVATION_TTL,
            payload
        ) as Promise<number>;
    }

    async reserveBatch(userId: string, items: { productId: string; quantity: number; payload: string }[]) {
        const keys: string[] = [];
        const args: (string | number)[] = [RESERVATION_TTL];

        for (const item of items) {
            keys.push(RedisManagerService.getStockKey(item.productId));
            keys.push(RedisManagerService.getReservationKey(userId, item.productId));
            args.push(item.quantity);
            args.push(item.payload);
        }

        return redis.eval(reserveBatchScript, keys.length, ...keys, ...args) as Promise<number>;
    }

    async release(userId: string, productId: string) {
        const sKey = RedisManagerService.getStockKey(productId);
        const rKey = RedisManagerService.getReservationKey(userId, productId);

        return redis.eval(releaseScript, 2, sKey, rKey) as Promise<number>;
    }

    async checkout(userId: string, productId: string) {
        const rKey = RedisManagerService.getReservationKey(userId, productId);
        return redis.eval(checkoutScript, 1, rKey) as Promise<number>;
    }

    /**
     * Scanning & Aggregation
     */
    async getReservedQuantity(productId: string): Promise<number> {
        const pattern = RedisManagerService.getReservationPattern(productId);
        const keys = await this.scanKeys(pattern);

        if (keys.length === 0) return 0;

        const payloads = await redis.mget(...keys);
        let reservedQty = 0;

        for (const p of payloads) {
            if (p) {
                try {
                    const parsed = JSON.parse(p) as { qty: number };
                    reservedQty += parsed.qty;
                } catch {
                    // ignore malformed keys
                }
            }
        }

        return reservedQty;
    }

    private async scanKeys(pattern: string): Promise<string[]> {
        const keys: string[] = [];
        let cursor = "0";
        do {
            const [nextCursor, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
            keys.push(...batch);
            cursor = nextCursor;
        } while (cursor !== "0");
        return keys;
    }

    async rollback(userId: string, items: { productId: string }[]) {
        const pipeline = redis.pipeline();
        for (const item of items) {
            pipeline.eval(
                releaseScript,
                2,
                RedisManagerService.getStockKey(item.productId),
                RedisManagerService.getReservationKey(userId, item.productId)
            );
        }
        await pipeline.exec();
    }
}

export const redisManager = new RedisManagerService();
