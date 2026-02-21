import { z } from "zod";

const reservationItemSchema = z.object({
    productId: z.string().uuid("productId must be a valid UUID"),
    quantity: z
        .number()
        .int("quantity must be an integer")
        .positive("quantity must be positive")
        .max(1000, "quantity cannot exceed 1000 per item"),
});

export const reserveSchema = z.object({
    body: z.object({
        userId: z.string().trim().min(1, "userId cannot be empty").max(100, "userId too long"),
        items: z
            .array(reservationItemSchema)
            .min(1, "At least one item must be provided")
            .max(20, "Cannot reserve more than 20 different products at once"),
    }),
});

export const checkoutSchema = z.object({
    body: z.object({
        userId: z.string().trim().min(1, "userId cannot be empty").max(100, "userId too long"),
        items: z
            .array(reservationItemSchema)
            .min(1, "At least one item must be provided")
            .max(20, "Cannot checkout more than 20 different products at once"),
    }),
});

export const cancelSchema = z.object({
    params: z.object({
        productId: z.string().uuid("productId must be a valid UUID"),
    }),
    body: z.object({
        userId: z.string().trim().min(1, "userId cannot be empty").max(100, "userId too long"),
    }),
});

export type ReserveInput = z.infer<typeof reserveSchema>["body"];
export type CheckoutInput = z.infer<typeof checkoutSchema>["body"];
export type CancelInput = z.infer<typeof cancelSchema>;
