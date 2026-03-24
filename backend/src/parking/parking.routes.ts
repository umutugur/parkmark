import { FastifyInstance } from 'fastify';
import { authenticate } from '../lib/auth-hook';
import { create, findAll, findOne, update, remove } from './parking.service';

export async function parkingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.post('/', async (request, reply) => {
    try {
      const userId = (request as any).user.sub;
      const parking = await create(userId, request.body);
      return reply.status(201).send(parking);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });

  app.get('/', async (request, reply) => {
    try {
      const userId = (request as any).user.sub;
      const result = await findAll(userId, request.query);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });

  app.get('/:id', async (request, reply) => {
    try {
      const userId = (request as any).user.sub;
      const { id } = request.params as any;
      const parking = await findOne(userId, id);
      return reply.send(parking);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });

  app.put('/:id', async (request, reply) => {
    try {
      const userId = (request as any).user.sub;
      const { id } = request.params as any;
      const parking = await update(userId, id, request.body);
      return reply.send(parking);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });

  app.delete('/:id', async (request, reply) => {
    try {
      const userId = (request as any).user.sub;
      const { id } = request.params as any;
      const result = await remove(userId, id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });
}
