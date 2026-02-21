import fs from "fs";
import path from "path";
import { redis } from "../config/redis";
import { CONFIG } from "../config/config";
import { logError } from "../utils/general";

/**
 * Manages Redis operations for stock and reservations.
 * Uses Pre-loaded Lua scripts for high performance.
 */
export class RedisManagerService {
    private static scriptShas: Record<string, string> = {};

    constructor() {
        this.loadScripts();
    }

    private loadScripts() {
        const scriptsDir = path.join(__dirname, "../scripts");
        const scriptFiles = ["reserve.lua", "reserve_batch.lua", "release.lua", "checkout.lua"];

        for (const file of scriptFiles) {
            const name = file.replace(".lua", "");
            if (RedisManagerService.scriptShas[name]) continue;

            const content = fs.readFileSync(path.join(scriptsDir, file), "utf-8");
            redis.script("LOAD", content).then(sha => {
                RedisManagerService.scriptShas[name] = sha as string;
            }).catch(err => logError(err, `RedisManager.loadScripts:${name}`));
        }
    }

    private async callScript(name: string, keys: string[], args: (string | number)[]) {
        const sha = RedisManagerService.scriptShas[name];
        if (sha) {
            try {
                return await redis.evalsha(sha, keys.length, ...keys, ...args) as number;
            } catch (err: any) {
                if (!err.message?.includes("NOSCRIPT")) throw err;
                // Fallback if script missing from cache
            }
        }

        // Fallback to EVAL if SHA fails or isn't loaded yet
        const content = fs.readFileSync(path.join(__dirname, "../scripts", `${name}.lua`), "utf-8");
        return await redis.eval(content, keys.length, ...keys, ...args) as number;
    }

    /* ********************************************************** */
    /* *********************** KEY HELPERS ********************** */
    /* ********************************************************** */

    static getStockKey(productId: string) {
        return `product:${productId}:stock`;
    }

    static getReservationKey(userId: string, productId: string) {
        return `reservation:${userId}:${productId}`;
    }

    /* ********************************************************** */
    /* ******************** STOCK MANAGEMENT ******************** */
    /* ********************************************************** */

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

    /* ********************************************************** */
    /* ***************** RESERVATION MANAGEMENT ***************** */
    /* ********************************************************** */

    async reserve(userId: string, productId: string, quantity: number, payload: string) {
        const keys = [
            RedisManagerService.getStockKey(productId),
            RedisManagerService.getReservationKey(userId, productId)
        ];
        const args = [quantity, CONFIG.RESERVATION.TTL_SECONDS, payload];
        return this.callScript("reserve", keys, args);
    }

    async reserveBatch(userId: string, items: { productId: string; quantity: number; payload: string }[]) {
        const keys: string[] = [];
        const args: (string | number)[] = [CONFIG.RESERVATION.TTL_SECONDS];

        for (const item of items) {
            keys.push(RedisManagerService.getStockKey(item.productId));
            keys.push(RedisManagerService.getReservationKey(userId, item.productId));
            args.push(item.quantity, item.payload);
        }

        return this.callScript("reserve_batch", keys, args);
    }

    async release(userId: string, productId: string) {
        const keys = [
            RedisManagerService.getStockKey(productId),
            RedisManagerService.getReservationKey(userId, productId)
        ];
        return this.callScript("release", keys, []);
    }

    async checkout(userId: string, productId: string) {
        const keys = [RedisManagerService.getReservationKey(userId, productId)];
        return this.callScript("checkout", keys, []);
    }

    /* ********************************************************** */
    /* ***************** SCANNERS & ANALYTICS ******************* */
    /* ********************************************************** */

    async getReservedQuantity(productId: string): Promise<number> {
        const pattern = `reservation:*:${productId}`;
        const keys = await this.scanKeys(pattern);
        if (keys.length === 0) return 0;

        const payloads = await redis.mget(...keys);
        return payloads.reduce((acc, p) => {
            if (!p) return acc;
            try {
                return acc + (JSON.parse(p) as { qty: number }).qty;
            } catch {
                return acc;
            }
        }, 0);
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
        const releaseScript = fs.readFileSync(path.join(__dirname, "../scripts", "release.lua"), "utf-8");
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
