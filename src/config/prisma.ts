import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import type { Prisma } from "../../generated/prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;

export const PRISMA_TRANSACTION_OPTIONS = {
  maxWait: 10000,
  timeout: 5000,
} satisfies NonNullable<Prisma.PrismaClientOptions["transactionOptions"]>;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({
  adapter,
  transactionOptions: PRISMA_TRANSACTION_OPTIONS,
});

const runPrismaTransaction = async <T>(
  handler: (tx: Prisma.TransactionClient) => Promise<T>,
) => prisma.$transaction(handler, PRISMA_TRANSACTION_OPTIONS);

export { prisma, runPrismaTransaction };
