import { ProductRepository } from "../repositories/product.repository";
import { OrderRepository } from "../repositories/order.repository";
import { RedisManagerService } from "./redis-manager.service";
import { CreateProductInput } from "../validators/product.validator";
import { NotFoundError } from "../types/errors";

export class ProductService {
    private readonly productRepository = new ProductRepository();
    private readonly orderRepository = new OrderRepository();
    private readonly redisManager = new RedisManagerService();

    /**
     * Creates a new product and seeds its stock in the cache.
     */
    async createProduct(data: CreateProductInput) {
        const product = await this.productRepository.create({
            name: data.name,
            description: data.description,
            totalStock: data.totalStock,
            price: data.price,
        });

        await this.redisManager.setStock(product.id, product.totalStock);
        return product;
    }

    /**
     * Gets the full availability status of a product (DB + Cache).
     */
    async getProductStatus(productId: string) {
        const product = await this.productRepository.getUniqueById(productId);
        if (!product) throw new NotFoundError("Product");

        const available = await this.ensureAvailableStockCached(productId, product.totalStock);
        const reserved = await this.redisManager.getReservedQuantity(productId);

        return {
            productId: product.id,
            name: product.name,
            price: product.price,
            totalStock: product.totalStock,
            reservedStock: reserved,
            availableStock: available,
        };
    }

    /**
     * Ensures stock is in Redis; if not, calculates from DB and seeds.
     */
    private async ensureAvailableStockCached(productId: string, totalStock: number): Promise<number> {
        let available = await this.redisManager.getStock(productId);

        if (available === null) {
            const soldQty = await this.orderRepository.sumSoldQuantity(productId);
            available = Math.max(0, totalStock - soldQty);
            await this.redisManager.setStock(productId, available);
        }

        return available;
    }
}
