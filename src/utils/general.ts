/**
 * Logs an error with a consistent format.
 */
export function logError(error: unknown, context?: string): void {
    const prefix = context ? `[${context}]` : "[Error]";
    if (error instanceof Error) {
        console.error(`${prefix} ${error.message}`, error.stack);
    } else {
        console.error(`${prefix}`, error);
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
