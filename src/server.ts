import app from '@/app.ts';
import { env } from '@/shared/config/env.ts';

app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});
