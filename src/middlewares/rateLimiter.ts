import rateLimit from "express-rate-limit";

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);
const max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "60", 10);

export const reservationRateLimiter = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: `Too many requests. Limit: ${max} requests per ${windowMs / 1000}s.`,
    },
});

export const globalRateLimiter = rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please slow down.",
    },
});
