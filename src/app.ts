import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import { errorHandler } from "./middlewares/errorHandler";
import { globalRateLimiter } from "./middlewares/rateLimiter";
import productRoutes from "./routes/product.routes";
import reservationRoutes from "./routes/reservation.routes";
import { setupSwagger } from "./swagger";

// Initialise Redis clients + keyspace subscriber
import "./config/redis";

const app = express();

// ── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Global Rate Limiter ──────────────────────────────────────────────────────
app.use(globalRateLimiter);

// ── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/products", productRoutes);
app.use("/api/reservations", reservationRoutes);

// ── Swagger Docs ─────────────────────────────────────────────────────────────
setupSwagger(app);

// ── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});

// ── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
