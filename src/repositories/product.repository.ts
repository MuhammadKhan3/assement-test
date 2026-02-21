import { Prisma } from "@prisma/client";
import Repository from "./repository";

export class ProductRepository extends Repository {
    constructor() {
        super(Prisma.ModelName.Product);
    }

    async findByName(name: string) {
        return this.getBy("name", name);
    }
}
