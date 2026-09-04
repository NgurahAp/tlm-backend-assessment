import { registerAs } from '@nestjs/config';
import type { LevelWithSilent } from 'pino';

export interface LoggingConfiguration {
  level: LevelWithSilent;
  file: string;
  pretty: boolean;
}

const loggingConfig = registerAs('logging', (): LoggingConfiguration => ({
  level: (process.env.LOG_LEVEL ?? 'debug') as LevelWithSilent,
  file: process.env.LOG_FILE ?? 'logs/debug.log',
  pretty: process.env.LOG_PRETTY !== 'false',
}));

export default loggingConfig;
