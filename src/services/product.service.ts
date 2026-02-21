import { ProductRepository } from "../repositories/product.repository";
import { OrderRepository } from "../repositories/order.repository";
import { RedisManagerService } from "./redis-manager.service";
import { CreateProductInput } from "../validators/product.validator";
import { NotFoundError } from "../types/errors";

export class ProductService {
    private productRepository: ProductRepository;
    private orderRepository: OrderRepository;
    private redisManager: RedisManagerService;

    constructor() {
        this.productRepository = new ProductRepository();
        this.orderRepository = new OrderRepository();
        this.redisManager = new RedisManagerService();
    }

    async createProduct(data: CreateProductInput) {
        const product = await this.productRepository.create({
            name: data.name,
            description: data.description,
            totalStock: data.totalStock,
            price: data.price,
        });

        // Seed the available stock in Redis
        await this.redisManager.setStock(product.id, product.totalStock);

        return product;
    }

    async getProductStatus(productId: string) {
        const product = await this.productRepository.getUniqueById(productId);

        if (!product) {
            throw new NotFoundError("Product");
        }

        // Warm cache miss — seed Redis if key is absent
        let available = await this.redisManager.getStock(productId);
        if (available === null) {
            const soldQty = await this.orderRepository.sumSoldQuantity(productId);
            available = Math.max(0, product.totalStock - soldQty);
            await this.redisManager.setStock(productId, available);
        }

        // Aggregate reserved quantity from Redis
        const reservedQty = await this.redisManager.getReservedQuantity(productId);

        return {
            productId: product.id,
            name: product.name,
            price: product.price,
            totalStock: product.totalStock,
            reservedStock: reservedQty,
            availableStock: available,
        };
    }
}
