import { FastifyInstance } from 'fastify';
import { authenticate } from '../lib/auth-hook';
import { generateUploadSignature, completeUpload } from './upload.service';

export async function uploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.post('/presigned', async (request, reply) => {
    const { fileName, contentType, isPublic } = request.body as any;

    if (!fileName || !contentType) {
      return reply.status(400).send({ statusCode: 400, message: 'fileName and contentType are required' });
    }

    try {
      const userId = (request as any).user.sub;
      const result = await generateUploadSignature(userId, { fileName, contentType, isPublic });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });

  app.post('/complete', async (request, reply) => {
    const { cloud_storage_path, fileName, contentType, isPublic } = request.body as any;

    if (!cloud_storage_path || !fileName || !contentType) {
      return reply.status(400).send({
        statusCode: 400,
        message: 'cloud_storage_path, fileName, and contentType are required',
      });
    }

    try {
      const userId = (request as any).user.sub;
      const file = await completeUpload(userId, { cloud_storage_path, fileName, contentType, isPublic });
      return reply.status(201).send(file);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });
}
