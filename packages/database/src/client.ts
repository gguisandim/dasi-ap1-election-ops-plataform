import { PrismaClient } from "@prisma/client";
import { prismaClientOptions } from "./pool";

declare global {
  var electionOpsPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.electionOpsPrisma ?? new PrismaClient(prismaClientOptions());

if (process.env.NODE_ENV !== "production")
  globalThis.electionOpsPrisma = prisma;
