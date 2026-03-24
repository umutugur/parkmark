import { FastifyInstance } from 'fastify';
import { authenticate } from '../lib/auth-hook';
import { getFileUrl, deleteFile } from './files.service';

export async function filesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/:id/url', async (request, reply) => {
    try {
      const userId = (request as any).user.sub;
      const { id } = request.params as any;
      const result = await getFileUrl(userId, id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });

  app.delete('/:id', async (request, reply) => {
    try {
      const userId = (request as any).user.sub;
      const { id } = request.params as any;
      const result = await deleteFile(userId, id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });
}
