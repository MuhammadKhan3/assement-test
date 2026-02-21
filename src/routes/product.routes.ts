import { Router } from "express";
import * as productController from "../controllers/product.controller";
import { validate } from "../middlewares/validate";
import {
    createProductSchema,
    getProductStatusSchema,
} from "../validators/product.validator";

const router = Router();

/**
 * @swagger
 * /api/products:
 *   post:
 *     tags: [Products]
 *     summary: Create a new product with initial stock
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, totalStock, price]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Limited Edition Sneakers"
 *               description:
 *                 type: string
 *                 example: "Flash sale exclusive"
 *               totalStock:
 *                 type: integer
 *                 example: 200
 *               price:
 *                 type: number
 *                 example: 149.99
 *     responses:
 *       201:
 *         description: Product created
 *       400:
 *         description: Validation error
 */
router.post("/", validate(createProductSchema), productController.createProduct);

/**
 * @swagger
 * /api/products/{id}/status:
 *   get:
 *     tags: [Products]
 *     summary: Get stock status for a product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product UUID
 *     responses:
 *       200:
 *         description: Stock status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     totalStock:
 *                       type: integer
 *                     reservedStock:
 *                       type: integer
 *                     availableStock:
 *                       type: integer
 *       404:
 *         description: Product not found
 */
router.get(
    "/:id/status",
    validate(getProductStatusSchema),
    productController.getProductStatus
);

export default router;
