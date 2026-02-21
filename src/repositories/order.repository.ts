import { Prisma } from "@prisma/client";
import Repository from "./repository";

class OrderRepository extends Repository {
    constructor() {
        super(Prisma.ModelName.Order);
    }

    async findByUser(userId: string) {
        return this.getAll({
            where: { userId },
            orderBy: { createdAt: "desc" },
            include: { product: { select: { name: true, price: true } } },
        });
    }

    async sumSoldQuantity(productId: string): Promise<number> {
        const result = await this.groupBy({
            by: ["productId"],
            where: { productId },
            _sum: { quantity: true },
        });
        return result?.[0]?._sum?.quantity ?? 0;
    }
}

export const orderRepository = new OrderRepository();
