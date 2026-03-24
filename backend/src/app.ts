import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { connectDB } from './lib/mongoose';
import { authRoutes } from './auth/auth.routes';
import { parkingRoutes } from './parking/parking.routes';
import { uploadRoutes } from './upload/upload.routes';
import { filesRoutes } from './files/files.routes';
import { webhookRoutes } from './webhook/webhook.routes';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true, credentials: true });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
  });

  await app.register(swagger, {
    openapi: {
      info: { title: 'ParkMark API', description: 'ParkMark parking location tracker', version: '1.0.0' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });

  await app.register(swaggerUi, { routePrefix: '/docs' });

  await connectDB();

  app.get('/', async () => ({ message: 'Hello World!' }));

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  await app.register(authRoutes, { prefix: '/api' });
  await app.register(parkingRoutes, { prefix: '/api/parking' });
  await app.register(uploadRoutes, { prefix: '/api/upload' });
  await app.register(filesRoutes, { prefix: '/api/files' });
  await app.register(webhookRoutes, { prefix: '/api/webhook' });

  return app;
}
