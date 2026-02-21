import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

/**
 * Generic Zod validation middleware factory.
 * Pass a Zod object schema that validates { body, params, query }.
 */
export const validate =
    (schema: ZodSchema) =>
        (req: Request, res: Response, next: NextFunction): void => {
            const result = schema.safeParse({
                body: req.body,
                params: req.params,
                query: req.query,
            });

            if (!result.success) {
                const zodError = result.error;
                res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: zodError.issues.map((issue) => ({
                        field: issue.path.slice(1).join("."), // strip leading "body"/"params" prefix
                        message: issue.message,
                    })),
                });
                return;
            }

            // Attach parsed (coerced) values back onto the request
            const parsed = result.data as { body?: unknown; params?: unknown; query?: unknown };
            if (parsed.body !== undefined) req.body = parsed.body;
            if (parsed.params !== undefined) req.params = parsed.params as Record<string, string>;

            next();
        };
