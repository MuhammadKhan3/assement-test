/**
 * Logs an error with a consistent, structured format.
 */
export function logError(error: unknown, context?: string): void {
    const timestamp = new Date().toISOString();
    const prefix = context ? `[${context}]` : "[ERROR]";

    if (error instanceof Error) {
        console.error(`\n--- ${timestamp} ${prefix} ---\nMessage: ${error.message}\nStack: ${error.stack}\n`);
    } else {
        console.error(`\n--- ${timestamp} ${prefix} ---\nDetails:`, error, "\n");
    }
}

/**
 * Removes keys from an object where the value is null, undefined, or empty string.
 * Useful for cleaning Prisma where clauses before querying.
 */
export function removeEmptyValues<T extends Record<string, unknown>>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(
            ([, v]) => v !== null && v !== undefined && v !== ""
        )
    ) as Partial<T>;
}
