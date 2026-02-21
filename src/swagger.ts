import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Flash Deal Reservation API",
            version: "1.0.0",
            description:
                "Backend API for managing limited-stock product reservations during flash sales. " +
                "Uses Redis atomic locks to prevent overselling and PostgreSQL for permanent order records.",
            contact: {
                name: "Flash Deal API",
            },
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT || 3000}`,
                description: "Development server",
            },
        ],
        tags: [
            {
                name: "Products",
                description: "Product management and stock status",
            },
            {
                name: "Reservations",
                description: "Cart reservation, checkout, and cancellation",
            },
        ],
        components: {
            schemas: {
                Error: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: false },
                        message: { type: "string" },
                    },
                },
                ValidationError: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: false },
                        message: { type: "string", example: "Validation failed" },
                        errors: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    field: { type: "string" },
                                    message: { type: "string" },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    apis: ["./src/routes/*.ts"],
};

export function setupSwagger(app: Express): void {
    const spec = swaggerJsdoc(options);
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(spec, {
        customCss: ".swagger-ui .topbar { display: none }",
        customSiteTitle: "Flash Deal API Docs",
    }));
    app.get("/api-docs.json", (_req, res) => res.json(spec));
    console.log("📄 Swagger UI available at http://localhost:" + (process.env.PORT || 3000) + "/api-docs");
}
