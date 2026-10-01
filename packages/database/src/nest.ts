import {
  Global,
  Injectable,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        await this.$connect();
        return;
      } catch (error) {
        const retryable = error instanceof Prisma.PrismaClientInitializationError && error.errorCode === "P1001";
        if (!retryable || attempt === 4) throw error;
        await delay(attempt * 1000);
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
