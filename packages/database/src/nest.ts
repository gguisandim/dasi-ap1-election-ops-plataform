import {
  Global,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    const attempts = positiveInteger(process.env.DATABASE_CONNECT_RETRIES, 8);
    const baseDelayMs = positiveInteger(
      process.env.DATABASE_CONNECT_RETRY_BASE_MS,
      1_000,
    );

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await this.$connect();
        if (attempt > 1) {
          this.logger.log(`Conexão com o banco restabelecida na tentativa ${attempt}.`);
        }
        return;
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientInitializationError &&
          error.errorCode === "P1001";
        if (!retryable || attempt === attempts) throw error;

        const waitMs = Math.min(baseDelayMs * 2 ** (attempt - 1), 5_000);
        this.logger.warn(
          `Banco indisponível (P1001), tentativa ${attempt}/${attempts}. Nova tentativa em ${waitMs}ms.`,
        );
        await delay(waitMs);
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class DatabaseModule {}
