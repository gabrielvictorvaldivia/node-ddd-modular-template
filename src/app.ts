import express from 'express';
import { httpLogger } from '@/shared/logger/httpLogger.ts';

const app = express();

app.use(httpLogger);

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

export default app;
