import { Request, Response, NextFunction } from "express";
import { ReservationService } from "../services/reservation.service";

const reservationService = new ReservationService();

/**
 * POST /api/reservations/reserve
 * Reserve one or more products for a user.
 */
export async function reserve(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { userId, items } = req.body;
        const result = await reservationService.reserveItems(userId, items);
        res.status(201).json({
            success: true,
            message: result.message,
            data: result,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/reservations/checkout
 * Finalize purchase for one or more reserved items.
 */
export async function checkout(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { userId, items } = req.body;
        const result = await reservationService.checkout(userId, items);
        res.status(200).json({
            success: true,
            message: result.message,
            data: result,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/reservations/:productId
 * Cancel a user's reservation for a specific product.
 */
export async function cancelReservation(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const productId = req.params.productId as string;
        const { userId } = req.body;
        const result = await reservationService.cancelReservation(userId, productId);
        res.status(200).json({
            success: true,
            message: result.message,
            data: result,
        });
    } catch (err) {
        next(err);
    }
}
