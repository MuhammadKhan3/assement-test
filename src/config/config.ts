/**
 * Application-wide configuration and constants.
 */

export const CONFIG = {
    RESERVATION: {
        // Time-to-live for a reservation in seconds (default: 600s / 10m)
        TTL_SECONDS: parseInt(process.env.RESERVATION_TTL_SECONDS || "600", 10),
    },
    REDIS: {
        URL: process.env.REDIS_URL || "redis://localhost:6379",
    },
    DATABASE: {
        URL: process.env.DATABASE_URL,
    }
};
