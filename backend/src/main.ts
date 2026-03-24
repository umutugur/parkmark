import 'dotenv/config';
import { buildApp } from './app';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function bootstrap() {
  const app = await buildApp();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`ParkMark backend running on port ${PORT}`);
  console.log(`API docs available at http://localhost:${PORT}/docs`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
