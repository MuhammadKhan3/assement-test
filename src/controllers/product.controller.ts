import { Request, Response, NextFunction } from "express";
import { ProductService } from "../services/product.service";

const productService = new ProductService();

/**
 * POST /api/products
 * Creates a product with initial stock.
 */
export async function createProduct(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const product = await productService.createProduct(req.body);
        res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: product,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/products/:id/status
 * Returns total, reserved, and available stock.
 */
export async function getProductStatus(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const status = await productService.getProductStatus(req.params.id as string);
        res.status(200).json({
            success: true,
            data: status,
        });
    } catch (err) {
        next(err);
    }
}
