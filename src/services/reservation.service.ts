import { ReservationStatus } from "@prisma/client";
import { prisma } from "../db/prisma";
import { ProductRepository } from "../repositories/product.repository";
import { ReservationRepository } from "../repositories/reservation.repository";
import { RedisManagerService } from "./redis-manager.service";
import { NotFoundError, ConflictError, BadRequestError } from "../types/errors";

interface ReservationItem {
    productId: string;
    quantity: number;
}

export class ReservationService {
    private productRepository: ProductRepository;
    private reservationRepository: ReservationRepository;
    private redisManager: RedisManagerService;

    constructor() {
        this.productRepository = new ProductRepository();
        this.reservationRepository = new ReservationRepository();
        this.redisManager = new RedisManagerService();
    }

    /**
     * Reserve one or more products atomically (multi-SKU batch).
     * Uses a single Lua script for true atomicity across all items.
     */
    async reserveItems(userId: string, items: ReservationItem[]) {
        // Validate all products exist
        const productIds = items.map((i) => i.productId);
        const products = await this.productRepository.getAllByIds(productIds);

        if (products.length !== productIds.length) {
            const foundIds = new Set(products.map((p: any) => p.id));
            const missing = productIds.filter((id) => !foundIds.has(id));
            throw new NotFoundError(`Products not found: ${missing.join(", ")}`);
        }

        // Ensure all Redis stock keys are seeded
        await this.redisManager.ensureStockKeys(products);

        const ttlSeconds = parseInt(process.env.RESERVATION_TTL_SECONDS || "600", 10);
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

        // Prepare batch data
        const batchItems = items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            payload: JSON.stringify({
                userId,
                productId: item.productId,
                qty: item.quantity,
                expiresAt: expiresAt.toISOString(),
            }),
        }));

        // Atomic batch reservation in Redis
        const result = await this.redisManager.reserveBatch(userId, batchItems);

        if (result === -2) {
            throw new ConflictError(
                "One or more products already have an active reservation for this user."
            );
        }
        if (result === -1) {
            throw new ConflictError("Insufficient stock for one or more products.");
        }

        // Bulk write audit records to DB
        await this.reservationRepository.createMany(
            items.map((item) => ({
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
            ttlSeconds,
            message: `${items.length} item(s) reserved for ${ttlSeconds / 60} minutes.`,
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
     * Checkout — finalize purchase.
     */
    async checkout(userId: string, items: ReservationItem[]) {
        const completedItems: { productId: string; quantity: number; totalPrice: number }[] = [];

        await prisma.$transaction(async (tx) => {
            for (const item of items) {
                const reservedQty = await this.redisManager.checkout(userId, item.productId);

                if (reservedQty === 0) {
                    throw new BadRequestError(
                        `No active reservation found for product ${item.productId}. It may have expired.`
                    );
                }

                if (reservedQty !== item.quantity) {
                    await this.redisManager.incrStock(item.productId, reservedQty);
                    throw new BadRequestError(
                        `Quantity mismatch for product ${item.productId}. Reserved: ${reservedQty}, requested: ${item.quantity}.`
                    );
                }

                // Permanently decrement stock in DB
                const product = await tx.product.update({
                    where: { id: item.productId },
                    data: { totalStock: { decrement: item.quantity } },
                });

                const itemTotal = Number(product.price) * item.quantity;

                await tx.order.create({
                    data: {
                        userId,
                        productId: item.productId,
                        quantity: item.quantity,
                        totalPrice: itemTotal,
                    },
                });

                await tx.reservation.updateMany({
                    where: { userId, productId: item.productId, status: ReservationStatus.ACTIVE },
                    data: { status: ReservationStatus.COMPLETED, updatedAt: new Date() },
                });

                completedItems.push({ productId: item.productId, quantity: item.quantity, totalPrice: itemTotal });
            }
        });

        const grandTotal = completedItems.reduce((sum, i) => sum + i.totalPrice, 0);

        return {
            message: "Checkout successful. Order placed.",
            userId,
            items: completedItems,
            grandTotal: parseFloat(grandTotal.toFixed(2)),
            orderedAt: new Date().toISOString(),
        };
    }

    /**
     * Expiry handler (called by Redis listener).
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
}
