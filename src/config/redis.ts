import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Main client for commands
export const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
});

// Dedicated subscriber client for keyspace notifications
// (a subscriber cannot issue regular commands on the same connection)
export const redisSub = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
});

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err: Error) => console.error("❌ Redis error:", err.message));

// Subscribe to keyspace expiry events on db 0
redisSub.on("ready", async () => {
    await redisSub.subscribe("__keyevent@0__:expired");
    console.log("✅ Redis keyspace subscriber listening for TTL expiry events");
});

redisSub.on("message", (_channel: string, expiredKey: string) => {
    // Keys follow: reservation:{userId}:{productId}
    if (expiredKey.startsWith("reservation:")) {
        const parts = expiredKey.split(":");
        // parts[0] = "reservation", parts[1] = userId, parts[2] = productId
        if (parts.length === 3) {
            const [, userId, productId] = parts;
            // Use dynamic import to avoid circular dependency at module load time
            import("../services/reservation.service").then(({ handleReservationExpiry }) => {
                handleReservationExpiry(userId, productId).catch((err: Error) =>
                    console.error("Error handling reservation expiry:", err.message)
                );
            }).catch((err: Error) => console.error("Import error:", err.message));
        }
    }
});

export default redis;
