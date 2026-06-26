import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
  },
  define: {
    'process.env.SERVICE_NAME': '"my-service"',
    'process.env.NODE_ENV': '"development"',
    'process.env.PORT': '"3000"',
    'process.env.LOG_LEVEL': '"info"',
  },
});
