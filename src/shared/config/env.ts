import 'dotenv/config';
import zod from 'zod';

const envSchema = zod.object({
  SERVICE_NAME: zod.string().default('my-service'),
  PORT: zod.coerce.number().int().positive().default(3000),
  NODE_ENV: zod
    .enum(['development', 'production', 'staging'])
    .default('development'),
  LOG_LEVEL: zod.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    'Invalid environment variables:',
    zod.treeifyError(parsedEnv.error),
  );
  process.exit(1);
}

export const env = parsedEnv.data;
