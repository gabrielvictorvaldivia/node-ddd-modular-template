import { pinoHttp } from 'pino-http';
import { logger } from '@/shared/logger/logger.ts';
import { randomUUID } from 'crypto';
import { Request } from 'express';

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => {
    return (req.headers['x-request-id'] as string) || randomUUID();
  },

  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },

  customProps: (req) => {
    return {
      requestId: (req as Request).id,
      method: req.method,
      url: req.url,
    };
  },
});
