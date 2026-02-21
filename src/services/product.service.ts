import { productRepository } from "../repositories/product.repository";
import { orderRepository } from "../repositories/order.repository";
import { redisManager } from "./redis-manager.service";
import { CreateProductInput } from "../validators/product.validator";
import { NotFoundError } from "../types/errors";

export async function createProduct(data: CreateProductInput) {
    const product = await productRepository.create({
        name: data.name,
        description: data.description,
        totalStock: data.totalStock,
        price: data.price,
    });

    // Seed the available stock in Redis
    await redisManager.setStock(product.id, product.totalStock);

    return product;
}

export async function getProductStatus(productId: string) {
    const product = await productRepository.getUniqueById(productId);

    if (!product) {
        throw new NotFoundError("Product");
    }

    // Warm cache miss — seed Redis if key is absent
    let available = await redisManager.getStock(productId);
    if (available === null) {
        const soldQty = await orderRepository.sumSoldQuantity(productId);
        available = Math.max(0, product.totalStock - soldQty);
        await redisManager.setStock(productId, available);
    }

    // Aggregate reserved quantity from Redis
    const reservedQty = await redisManager.getReservedQuantity(productId);

    return {
        productId: product.id,
        name: product.name,
        price: product.price,
        totalStock: product.totalStock,
        reservedStock: reservedQty,
        availableStock: available,
    };
}
