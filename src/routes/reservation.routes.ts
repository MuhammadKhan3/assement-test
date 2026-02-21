import { Router } from "express";
import * as reservationController from "../controllers/reservation.controller";
import { validate } from "../middlewares/validate";
import { reservationRateLimiter } from "../middlewares/rateLimiter";
import {
    reserveSchema,
    checkoutSchema,
    cancelSchema,
} from "../validators/reservation.validator";

const router = Router();

// Apply rate limiting to all reservation operations
router.use(reservationRateLimiter);

/**
 * @swagger
 * /api/reservations/reserve:
 *   post:
 *     tags: [Reservations]
 *     summary: Reserve one or more products (adds to cart, locks stock for 10 minutes)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, items]
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "user-abc-123"
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId:
 *                       type: string
 *                       format: uuid
 *                     quantity:
 *                       type: integer
 *                       example: 2
 *     responses:
 *       201:
 *         description: Reservation created. Stock locked for 10 minutes.
 *       400:
 *         description: Validation error
 *       404:
 *         description: Product not found
 *       409:
 *         description: Insufficient stock or reservation already exists
 *       429:
 *         description: Rate limit exceeded
 */
router.post("/reserve", validate(reserveSchema), reservationController.reserve);

/**
 * @swagger
 * /api/reservations/checkout:
 *   post:
 *     tags: [Reservations]
 *     summary: Finalize purchase — convert temporary reservation to permanent order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, items]
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "user-abc-123"
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId:
 *                       type: string
 *                       format: uuid
 *                     quantity:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Order placed successfully
 *       400:
 *         description: Reservation expired or quantity mismatch
 *       429:
 *         description: Rate limit exceeded
 */
router.post(
    "/checkout",
    validate(checkoutSchema),
    reservationController.checkout
);

/**
 * @swagger
 * /api/reservations/{productId}:
 *   delete:
 *     tags: [Reservations]
 *     summary: Cancel a reservation and return stock
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "user-abc-123"
 *     responses:
 *       200:
 *         description: Reservation cancelled, stock returned
 *       404:
 *         description: No active reservation found
 *       429:
 *         description: Rate limit exceeded
 */
router.delete(
    "/:productId",
    validate(cancelSchema),
    reservationController.cancelReservation
);

export default router;
