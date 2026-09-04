import { registerAs } from '@nestjs/config';
import type { LevelWithSilent } from 'pino';

export interface LoggingConfiguration {
  level: LevelWithSilent;
  file: string;
  pretty: boolean;
  maxSizeMb: number;
  maxFiles: number;
}

const loggingConfig = registerAs('logging', (): LoggingConfiguration => ({
  level: (process.env.LOG_LEVEL ?? 'debug') as LevelWithSilent,
  file: process.env.LOG_FILE ?? 'logs/debug.log',
  pretty: process.env.LOG_PRETTY !== 'false',
  maxSizeMb: Number(process.env.LOG_MAX_SIZE_MB ?? 10),
  maxFiles: Number(process.env.LOG_MAX_FILES ?? 5),
}));

export default loggingConfig;
