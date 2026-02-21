import { z } from "zod";

export const createProductSchema = z.object({
    body: z.object({
        name: z
            .string()
            .trim()
            .min(2, "Name must be at least 2 characters")
            .max(200, "Name must be at most 200 characters"),
        description: z
            .string()
            .trim()
            .max(1000, "Description must be at most 1000 characters")
            .optional(),
        totalStock: z
            .number()
            .int("totalStock must be an integer")
            .positive("totalStock must be a positive integer"),
        price: z
            .number()
            .positive("price must be positive"),
    }),
});

export const getProductStatusSchema = z.object({
    params: z.object({
        id: z.string().uuid("id must be a valid UUID"),
    }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>["body"];
