import pino from 'pino';
import { env } from '@/shared/config/env.ts';

const isDev = env.NODE_ENV === 'development';

export const logger = pino({
  level: env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),

  base: {
    env: env.NODE_ENV,
    service: env.SERVICE_NAME,
  },
  timestamp: pino.stdTimeFunctions.isoTime,

  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});
