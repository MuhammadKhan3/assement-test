import { ReservationStatus, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { ProductRepository } from "../repositories/product.repository";
import { ReservationRepository } from "../repositories/reservation.repository";
import { RedisManagerService } from "./redis-manager.service";
import { NotFoundError, ConflictError, BadRequestError } from "../types/errors";
import { CONFIG } from "../config/config";

interface ReservationItem {
    productId: string;
    quantity: number;
}

export class ReservationService {
    private readonly productRepository = new ProductRepository();
    private readonly reservationRepository = new ReservationRepository();
    private readonly redisManager = new RedisManagerService();

    /**
     * Reserve one or more products atomically.
     */
    async reserveItems(userId: string, items: ReservationItem[]) {
        const productIds = items.map(i => i.productId);
        const products = await this.productRepository.getAllByIds(productIds);

        this.validateProductsExist(productIds, products);
        await this.redisManager.ensureStockKeys(products);

        const ttl = CONFIG.RESERVATION.TTL_SECONDS;
        const expiresAt = new Date(Date.now() + ttl * 1000);
        const batchData = this.prepareRedisBatch(userId, items, expiresAt);

        const result = await this.redisManager.reserveBatch(userId, batchData);
        this.handleRedisReservationResult(result);

        await this.reservationRepository.createMany(
            items.map(item => ({
                userId,
                productId: item.productId,
                quantity: item.quantity,
                status: ReservationStatus.ACTIVE,
                expiresAt,
            }))
        );

        return {
            userId,
            items,
            expiresAt,
            ttlSeconds: ttl,
            message: `${items.length} item(s) reserved for ${ttl / 60} minutes.`,
        };
    }

    /**
     * Cancel a reservation early.
     */
    async cancelReservation(userId: string, productId: string) {
        const product = await this.productRepository.getUniqueById(productId);
        if (!product) throw new NotFoundError("Product");

        const restoredQty = await this.redisManager.release(userId, productId);
        if (restoredQty === 0) {
            throw new NotFoundError("Active reservation for this product");
        }

        await this.reservationRepository.markStatus(userId, productId, ReservationStatus.CANCELLED);

        return {
            message: `Reservation cancelled. ${restoredQty} unit(s) returned to stock.`,
            restoredQuantity: restoredQty,
        };
    }

    /**
     * Checkout reserved items.
     */
    async checkout(userId: string, items: ReservationItem[]) {
        const results = await prisma.$transaction(async (tx) => {
            const processedItems = [];

            for (const item of items) {
                const result = await this.processCheckoutItem(tx, userId, item);
                processedItems.push(result);
            }

            return processedItems;
        });

        return {
            message: "Checkout successful. Order placed.",
            userId,
            items: results,
            grandTotal: parseFloat(results.reduce((sum, i) => sum + i.totalPrice, 0).toFixed(2)),
            orderedAt: new Date().toISOString(),
        };
    }

    /**
     * Handles reservation expiration (called by Redis listener).
     */
    async handleReservationExpiry(userId: string, productId: string) {
        console.log(`🕐 Reservation expired: user=${userId} product=${productId}`);

        const reservation = await this.reservationRepository.findActive(userId, productId);
        if (reservation) {
            await this.redisManager.incrStock(productId, reservation.quantity);
            console.log(`♻️  Restored ${reservation.quantity} units to product ${productId}`);
        }

        await this.reservationRepository.markStatus(userId, productId, ReservationStatus.EXPIRED);
    }

    /* ********************************************************** */
    /* ********************* PRIVATE HELPERS ******************** */
    /* ********************************************************** */

    private validateProductsExist(requestedIds: string[], foundProducts: any[]) {
        if (foundProducts.length === requestedIds.length) return;

        const foundIds = new Set(foundProducts.map(p => p.id));
        const missing = requestedIds.filter(id => !foundIds.has(id));
        throw new NotFoundError(`Products not found: ${missing.join(", ")}`);
    }

    private prepareRedisBatch(userId: string, items: ReservationItem[], expiresAt: Date) {
        return items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            payload: JSON.stringify({
                userId,
                productId: item.productId,
                qty: item.quantity,
                expiresAt: expiresAt.toISOString(),
            }),
        }));
    }

    private handleRedisReservationResult(result: number) {
        if (result === -2) {
            throw new ConflictError("One or more products already have an active reservation for this user.");
        }
        if (result === -1) {
            throw new ConflictError("Insufficient stock for one or more products.");
        }
    }

    private async processCheckoutItem(tx: Prisma.TransactionClient, userId: string, item: ReservationItem) {
        const reservedQty = await this.redisManager.checkout(userId, item.productId);

        if (reservedQty === 0) {
            throw new BadRequestError(`No active reservation for product ${item.productId}.`);
        }

        if (reservedQty !== item.quantity) {
            // Revert Redis stock if check-out fails due to quantity mismatch
            await this.redisManager.incrStock(item.productId, reservedQty);
            throw new BadRequestError(`Quantity mismatch for product ${item.productId}.`);
        }

        const product = await tx.product.update({
            where: { id: item.productId },
            data: { totalStock: { decrement: item.quantity } },
        });

        const totalPrice = Number(product.price) * item.quantity;

        await tx.order.create({
            data: { userId, productId: item.productId, quantity: item.quantity, totalPrice },
        });

        await tx.reservation.updateMany({
            where: { userId, productId: item.productId, status: ReservationStatus.ACTIVE },
            data: { status: ReservationStatus.COMPLETED, updatedAt: new Date() },
        });

        return { productId: item.productId, quantity: item.quantity, totalPrice };
    }
}
