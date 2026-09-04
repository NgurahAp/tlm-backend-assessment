import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    config: ConfigService,
    @InjectPinoLogger(PrismaService.name)
    private readonly serviceLogger: PinoLogger,
  ) {
    const connectionString = config.getOrThrow<string>('DATABASE_URL');
    const adapter = new PrismaPg({ connectionString });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.verifyConnection();
    this.serviceLogger.info(
      { event: 'database.connected', database: 'postgresql' },
      'PostgreSQL connection verified',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.serviceLogger.info(
      { event: 'database.disconnected', database: 'postgresql' },
      'PostgreSQL connection closed',
    );
  }

  async verifyConnection(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
