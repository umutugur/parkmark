import { FastifyInstance } from 'fastify';
import { authenticate } from '../lib/auth-hook';
import { signup, login, getMe, oauthLogin } from './auth.service';

export async function authRoutes(app: FastifyInstance) {
  app.post('/signup', async (request, reply) => {
    const { email, password, name } = request.body as any;

    if (!email || !password || !name) {
      return reply.status(400).send({ statusCode: 400, message: 'email, password, and name are required' });
    }
    if (password.length < 6) {
      return reply.status(400).send({ statusCode: 400, message: 'Password must be at least 6 characters' });
    }

    try {
      const result = await signup(app, { email, password, name });
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ statusCode: 400, message: 'email and password are required' });
    }

    try {
      const result = await login(app, { email, password });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });

  app.post('/auth/oauth', async (request, reply) => {
    const { provider, idToken, name } = request.body as any;

    if (!provider || !idToken) {
      return reply.status(400).send({ statusCode: 400, message: 'provider and idToken are required' });
    }
    if (provider !== 'google' && provider !== 'apple') {
      return reply.status(400).send({ statusCode: 400, message: 'provider must be google or apple' });
    }

    try {
      const result = await oauthLogin(app, { provider, idToken, name });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });

  app.get('/auth/me', { preHandler: authenticate }, async (request, reply) => {
    try {
      const payload = (request as any).user;
      const result = await getMe(payload.sub);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });

  // Satın alma sonrası RC customerInfo'dan subscription durumunu senkronize et
  app.post('/auth/sync-subscription', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { User } = await import('./user.schema');
      const payload = (request as any).user;
      const { isSubscribed, plan, expiresAt } = request.body as any;

      const user = await User.findById(payload.sub);
      if (!user) {
        return reply.status(404).send({ statusCode: 404, message: 'User not found' });
      }

      user.isSubscribed = isSubscribed === true;
      user.subscriptionPlan = isSubscribed ? (plan ?? null) : null;
      user.subscriptionExpiresAt = isSubscribed && expiresAt ? new Date(expiresAt) : null;
      await user.save();

      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });

  app.post('/auth/freemium', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { User } = await import('./user.schema');
      const payload = (request as any).user;
      const user = await User.findById(payload.sub);
      if (!user) {
        return reply.status(404).send({ statusCode: 404, message: 'User not found' });
      }
      user.freemiumExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save();
      return reply.send({ success: true, freemiumExpiresAt: user.freemiumExpiresAt });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });

  // Bildirim tercihlerini ve push token'ı güncelle
  app.patch('/auth/notification-prefs', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { User } = await import('./user.schema');
      const payload = (request as any).user;
      const { marketingNotificationsEnabled, pushToken } = request.body as any;

      const updateFields: Record<string, any> = {};
      if (typeof marketingNotificationsEnabled === 'boolean') {
        updateFields.marketingNotificationsEnabled = marketingNotificationsEnabled;
      }
      if (pushToken !== undefined) {
        updateFields.pushToken = pushToken; // null göndererek temizlenebilir
      }

      if (Object.keys(updateFields).length === 0) {
        return reply.status(400).send({ statusCode: 400, message: 'No valid fields to update' });
      }

      const user = await User.findByIdAndUpdate(
        payload.sub,
        { $set: updateFields },
        { new: true }
      );
      if (!user) {
        return reply.status(404).send({ statusCode: 404, message: 'User not found' });
      }

      return reply.send({
        success: true,
        marketingNotificationsEnabled: user.marketingNotificationsEnabled,
        pushToken: user.pushToken,
      });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });

  // Hesabı ve tüm verileri kalıcı olarak sil
  app.delete('/api/auth/me', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { ParkingRecord } = await import('../parking/parking.schema');
      const { FileRecord } = await import('../files/file.schema');
      const { User } = await import('./user.schema');
      const payload = (request as any).user;
      const userId = payload.sub;

      await Promise.all([
        ParkingRecord.deleteMany({ userId }),
        FileRecord.deleteMany({ userId }),
        User.findByIdAndDelete(userId),
      ]);

      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });

  // Manuel push bildirimi gönder (sadece admin/backend kullanımı için — API key ile koruyun)
  // Kullanım: POST /api/push/send { title, body, userIds?: string[], onlyMarketing?: boolean }
  app.post('/api/push/send', async (request, reply) => {
    try {
      // Basit API key koruması — env'den alınır
      const apiKey = (request.headers['x-api-key'] as string) ?? '';
      if (!process.env.PUSH_API_KEY || apiKey !== process.env.PUSH_API_KEY) {
        return reply.status(401).send({ statusCode: 401, message: 'Unauthorized' });
      }

      const { User } = await import('./user.schema');
      const { title, body, userIds, onlyMarketing = true, data } = request.body as any;

      if (!title || !body) {
        return reply.status(400).send({ statusCode: 400, message: 'title and body are required' });
      }

      // Token listesini belirle
      const query: Record<string, any> = { pushToken: { $ne: null } };
      if (onlyMarketing) query.marketingNotificationsEnabled = true;
      if (userIds?.length) query._id = { $in: userIds };

      const users = await User.find(query).select('pushToken').lean();
      const tokens = users.map((u: any) => u.pushToken).filter(Boolean) as string[];

      if (tokens.length === 0) {
        return reply.send({ success: true, sent: 0, message: 'No eligible recipients' });
      }

      // Expo Push API — 100'erli batch
      const chunks: string[][] = [];
      for (let i = 0; i < tokens.length; i += 100) {
        chunks.push(tokens.slice(i, i + 100));
      }

      let totalSent = 0;
      for (const chunk of chunks) {
        const messages = chunk.map(token => ({
          to: token,
          title,
          body,
          data: data ?? {},
          sound: 'default',
        }));

        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(messages),
        });

        if (res.ok) totalSent += chunk.length;
      }

      return reply.send({ success: true, sent: totalSent, total: tokens.length });
    } catch (err: any) {
      return reply.status(err.statusCode || 500).send({ statusCode: err.statusCode || 500, message: err.message });
    }
  });
}
