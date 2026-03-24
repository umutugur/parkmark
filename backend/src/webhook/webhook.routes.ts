import { FastifyInstance } from 'fastify';
import { User } from '../auth/user.schema';

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/revenuecat', async (request, reply) => {
    try {
      const body = request.body as any;
      const event = body?.event;
      if (!event) {
        return reply.status(400).send({ statusCode: 400, message: 'Missing event' });
      }

      const appUserId: string = event.app_user_id;
      if (!appUserId) {
        return reply.status(400).send({ statusCode: 400, message: 'Missing app_user_id' });
      }

      const user = await User.findById(appUserId);
      if (!user) {
        return reply.status(404).send({ statusCode: 404, message: 'User not found' });
      }

      const eventType: string = event.type;

      if (eventType === 'INITIAL_PURCHASE' || eventType === 'RENEWAL') {
        const planMap: Record<string, 'monthly' | 'sixMonth' | 'yearly'> = {
          monthly: 'monthly',
          six_month: 'sixMonth',
          yearly: 'yearly',
        };
        const plan = planMap[event.product_id] ?? 'monthly';
        const expiresAt = event.expiration_at_ms
          ? new Date(event.expiration_at_ms)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        user.isSubscribed = true;
        user.subscriptionPlan = plan;
        user.subscriptionExpiresAt = expiresAt;
        await user.save();
      } else if (eventType === 'EXPIRATION' || eventType === 'CANCELLATION') {
        user.isSubscribed = false;
        user.subscriptionPlan = null;
        user.subscriptionExpiresAt = null;
        await user.save();
      }

      return reply.status(200).send({ received: true });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });
}
