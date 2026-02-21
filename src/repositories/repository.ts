import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { logError, removeEmptyValues } from "../utils/general";

export type Args = {
    take?: number;
    skip?: number;
    include?: any;
    where?: any;
    select?: any;
    orderBy?: any;
};

type Query = {
    where?: any;
    orderBy?: any;
    include?: any;
    skip?: number;
    take?: number;
    select?: any;
};

class Repository {
    private model: any;

    constructor(model: Prisma.ModelName) {
        this.model = prisma[model as keyof typeof prisma];
    }

    /* ********************************************************** */
    /* ************************** GET *************************** */
    /* ********************************************************** */

    async get(args: Args = {}) {
        return this.model.findFirst(args);
    }

    async getUnique(args: Args = {}) {
        return this.model.findUnique(args);
    }

    async getById(id: string, args?: Omit<Args, "where">) {
        if (id) {
            if (typeof id === "object")
                return this.model.findFirst({ where: { id: { in: id } }, ...args });
            return this.model.findFirst({ where: { id }, ...args });
        }
    }

    async getBy(key: string, value: any) {
        if (key && value) return this.model.findFirst({ where: { [key]: value } });
    }

    async getUniqueById(id: string) {
        if (id) {
            if (typeof id === "object")
                return this.model.findUnique({ where: { id: { in: id } } });
            return this.model.findUnique({ where: { id } });
        }
    }

    async getUniqueBy(key: string, value: any, args?: Omit<Args, "where">) {
        return this.model.findUnique({ where: { [key]: value }, ...args });
    }

    /* ********************************************************** */
    /* ************************** GET ALL *********************** */
    /* ********************************************************** */

    async getAll(args: Args = {}, paginated = false) {
        if (paginated || args.take || args.skip) return this.getPaginated(args);
        return this.model.findMany(args);
    }

    async getAllByIds(ids: any[] = [], paginated = false) {
        if (ids.length) {
            const query = { where: { id: { in: ids } } };
            if (paginated) return this.getPaginated(query);
            return this.model.findMany(query);
        }
        return [];
    }

    async getAllBy(key: string, value: any, paginated = false) {
        if (key && (value || value === false)) {
            const query = { where: { [key]: value } };
            if (paginated) return this.getPaginated(query);
            return this.model.findMany(query);
        }
    }

    async getPaginated(args: Args) {
        const { take, include, select, skip = 0, where = {}, orderBy = {} } = args;
        const query: Query = { orderBy, skip, where: removeEmptyValues(where) };
        if (take) query.take = take;
        if (include) query.include = include;
        if (select && !include) query.select = select;
        try {
            const [count, data] = await prisma.$transaction([
                this.model.count({ where: query.where }),
                this.model.findMany(query),
            ]);

            return { data, count };
        } catch (error) {
            logError(error);
            throw error;
        }
    }

    /* ********************************************************** */
    /* ************************** GROUP BY ********************** */
    /* ********************************************************** */

    async groupBy(args: any) {
        return this.model.groupBy(args);
    }

    /* ********************************************************** */
    /* ************************** COUNT ************************* */
    /* ********************************************************** */

    async countByTable(args: Args = {}, tableName: keyof typeof prisma) {
        const model = prisma[tableName] as any;
        if (model?.count) {
            return model.count(args);
        }
        throw new Error(`Model does not support the 'count' method`);
    }

    async count(args: Args = {}) {
        return this.model.count(args);
    }

    async countBy(key: string, value: any) {
        if (key && value) return this.model.count({ where: { [key]: value } });
    }

    async exists(where: any = {}) {
        const count = await this.model.count({ where });
        return !!count;
    }

    /* ********************************************************** */
    /* ************************** CREATE ************************ */
    /* ********************************************************** */

    async create(data: any = {}, args: Partial<Args> = {}) {
        return this.model.create({ data, ...args });
    }

    async createMany(data: any[] = [], skipDuplicates = true) {
        return this.model.createMany({ data, skipDuplicates });
    }

    async createManyAndReturn(data: any[], skipDuplicates = true) {
        return this.model.createManyAndReturn({ data, skipDuplicates });
    }

    /* ********************************************************** */
    /* ************************** UPSERT ************************ */
    /* ********************************************************** */

    async createOrUpdate(id: string, data: any = {}) {
        if ("id" in data) delete data.id;

        if (id) return this.model.update({ where: { id }, data });
        return this.model.create({ data });
    }

    async createOrUpdateMany(data: any[]) {
        return Promise.all(
            data?.map(({ id, index }) =>
                this.model.update({
                    where: { id },
                    data: { index },
                })
            )
        );
    }

    async upsert({
        where,
        update,
        create,
        select,
        include,
    }: Args & { update: any; create: any }) {
        return this.model.upsert({ where, select, include, update, create });
    }

    async upsertMany(key: string, data: any) {
        const promises = data.map((item: any) => {
            return this.model.upsert({
                where: { [key]: item[key] || "" },
                update: item,
                create: item,
            });
        });
        return Promise.all(promises);
    }

    async upsertBy(key: string, value: any, data: any) {
        if (data[key]) delete data[key];

        return this.model.upsert({
            where: { [key]: value },
            update: data,
            create: data,
        });
    }

    /* ********************************************************** */
    /* ************************** UPDATE ************************ */
    /* ********************************************************** */

    async update({ where, select, include, data }: Args & { data: any }) {
        return this.model.update({ where, data, select, include });
    }

    async updateById(id: any, data: any) {
        if ("id" in data) delete data.id;
        return this.model.update({ where: { id }, data });
    }

    async updateBy(key: string, value: any, data: any) {
        return this.model.update({ where: { [key]: value }, data });
    }

    /* ********************************************************** */
    /* ************************** UPDATE ALL ******************** */
    /* ********************************************************** */

    async updateAll({ where, data }: any) {
        return this.model.updateMany({ where, data });
    }

    async updateAllByIds(ids: any[], data: any) {
        return this.model.updateMany({ where: { id: { in: ids } }, data });
    }

    async updateAllBy(key: string, value: any, data: any) {
        return this.model.updateMany({ where: { [key]: value }, data });
    }

    /* ********************************************************** */
    /* ************************** DELETE ************************ */
    /* ********************************************************** */

    async delete(args: Args) {
        return this.model.delete(args);
    }

    async deleteById(id: any) {
        return this.model.delete({ where: { id } });
    }

    async deleteBy(key: string, value: any) {
        return this.model.delete({ where: { [key]: value } });
    }

    /* ********************************************************** */
    /* ************************** DELETE ALL ******************** */
    /* ********************************************************** */

    async deleteAll(args?: Args) {
        if (args) return this.model.deleteMany(args);
        return this.model.deleteMany();
    }

    async deleteAllByIds(ids: any[]) {
        return this.model.deleteMany({ where: { id: { in: ids } } });
    }

    async deleteAllBy(key: string, value: any) {
        return this.model.deleteMany({ where: { [key]: value } });
    }
}

export default Repository;
