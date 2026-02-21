import { Prisma, ReservationStatus } from "@prisma/client";
import Repository from "./repository";

export class ReservationRepository extends Repository {
    constructor() {
        super(Prisma.ModelName.Reservation);
    }

    /** Find the most recent ACTIVE reservation for a user/product pair */
    async findActive(userId: string, productId: string) {
        return this.get({
            where: { userId, productId, status: ReservationStatus.ACTIVE },
            orderBy: { createdAt: "desc" },
        });
    }

    /** Update all ACTIVE reservations for a user/product to a new status */
    async markStatus(userId: string, productId: string, status: ReservationStatus) {
        return this.updateMany(
            { userId, productId, status: ReservationStatus.ACTIVE },
            { status, updatedAt: new Date() }
        );
    }

    /** Update ACTIVE reservations for multiple products to a new status */
    async markStatusForMany(userId: string, productIds: string[], status: ReservationStatus) {
        return this.updateMany(
            {
                userId,
                productId: { in: productIds },
                status: ReservationStatus.ACTIVE,
            },
            { status, updatedAt: new Date() }
        );
    }
}
