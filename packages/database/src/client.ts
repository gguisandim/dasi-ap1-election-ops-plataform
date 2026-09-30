import { PrismaClient } from "@prisma/client";

declare global {
  var electionOpsPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.electionOpsPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production")
  globalThis.electionOpsPrisma = prisma;
