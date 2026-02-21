import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { logError, removeEmptyValues } from "../utils/general";

export interface RepositoryArgs {
    where?: Record<string, unknown>;
    select?: Record<string, unknown>;
    include?: Record<string, unknown>;
    orderBy?: Record<string, unknown> | Record<string, unknown>[];
    take?: number;
    skip?: number;
}

export class Repository {
    protected readonly model: any;

    constructor(modelName: Prisma.ModelName) {
        this.model = prisma[modelName as keyof typeof prisma];
    }

    // --- Read ---

    async get(args: RepositoryArgs = {}) {
        return this.model.findFirst(args);
    }

    async getUnique(args: RepositoryArgs = {}) {
        return this.model.findUnique(args);
    }

    async getById(id: string, args: Omit<RepositoryArgs, "where"> = {}) {
        return this.model.findUnique({ where: { id }, ...args });
    }

    async getUniqueById(id: string) {
        return this.model.findUnique({ where: { id } });
    }

    async getAll(args: RepositoryArgs = {}) {
        if (args.take || args.skip) return this.getPaginated(args);
        return this.model.findMany(args);
    }

    async getAllByIds(ids: string[]) {
        if (!ids.length) return [];
        return this.model.findMany({ where: { id: { in: ids } } });
    }

    async getPaginated(args: RepositoryArgs) {
        const { take, skip = 0, where = {}, orderBy = {}, include, select } = args;
        const cleanWhere = removeEmptyValues(where);

        try {
            const [count, data] = await prisma.$transaction([
                this.model.count({ where: cleanWhere }),
                this.model.findMany({
                    where: cleanWhere,
                    take,
                    skip,
                    orderBy,
                    ...(include ? { include } : {}),
                    ...(select && !include ? { select } : {})
                }),
            ]);

            return { data, count };
        } catch (error) {
            logError(error, "Repository.getPaginated");
            throw error;
        }
    }

    async count(where: Record<string, unknown> = {}) {
        return this.model.count({ where: removeEmptyValues(where) });
    }

    async exists(where: Record<string, unknown> = {}) {
        const count = await this.count(where);
        return count > 0;
    }

    // --- Create ---

    async create(data: unknown, args: Partial<RepositoryArgs> = {}) {
        return this.model.create({ data, ...args });
    }

    async createMany(data: unknown[]) {
        return this.model.createMany({ data, skipDuplicates: true });
    }

    // --- Update ---

    async update(id: string, data: unknown) {
        return this.model.update({ where: { id }, data });
    }

    async updateMany(where: Record<string, unknown>, data: unknown) {
        return this.model.updateMany({ where, data });
    }

    async upsert(id: string, create: unknown, update: unknown) {
        return this.model.upsert({
            where: { id },
            create,
            update
        });
    }

    // --- Delete ---

    async delete(id: string) {
        return this.model.delete({ where: { id } });
    }

    async deleteMany(where: Record<string, unknown>) {
        return this.model.deleteMany({ where });
    }

    // --- Custom ---

    async groupBy(args: any) {
        return this.model.groupBy(args);
    }
}

export default Repository;
