import { Request, Response, NextFunction } from "express";
import { AppError } from "../types/errors";

export const errorHandler = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
        });
        return;
    }

    // Prisma known errors
    if ((err as any).code === "P2002") {
        res.status(409).json({
            success: false,
            message: "A record with this data already exists (unique constraint violated)",
        });
        return;
    }

    if ((err as any).code === "P2025") {
        res.status(404).json({
            success: false,
            message: "Record not found",
        });
        return;
    }

    // Unknown errors
    console.error("Unhandled error:", err);
    res.status(500).json({
        success: false,
        message:
            process.env.NODE_ENV === "production"
                ? "Internal server error"
                : err.message,
    });
};
