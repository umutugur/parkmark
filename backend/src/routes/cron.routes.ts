import { FastifyInstance, FastifyRequest } from 'fastify';
import { runScheduledNotifications, CronTaskResult } from '../cron/scheduled-notifications.task';
import { runParkingReminder } from '../cron/parking-reminder.task';

function requireCronAuth(request: FastifyRequest): void {
  const auth = request.headers['authorization'];
  const provided = typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '') : null;
  const expected = process.env.CRON_SECRET;

  if (!expected || !provided || provided !== expected) {
    throw { statusCode: 401, message: 'Invalid cron secret' };
  }
}

async function runTask(
  runner: () => Promise<CronTaskResult>,
): Promise<CronTaskResult> {
  try {
    return await runner();
  } catch (err: any) {
    return { ok: false, sent: 0, skipped: 0, failed: 1, durationMs: 0 };
  }
}

export async function cronRoutes(app: FastifyInstance) {
  // Override content-type parser so empty/missing body doesn't 400
  // cron-job.org sends POST with no body or Content-Type: application/json + empty body
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, _body, done) => {
    done(null, {});
  });
  app.addContentTypeParser('*', (_req, _payload, done) => {
    done(null, {});
  });

  app.post(
    '/cron/run',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      requireCronAuth(request);

      const startedAt = Date.now();
      const now = new Date();

      const [scheduledNotifications, parkingReminder] = await Promise.all([
        runTask(() => runScheduledNotifications(now)),
        runTask(() => runParkingReminder(now)),
      ]);

      return reply.send({
        ok: true,
        ranAt: now.toISOString(),
        durationMs: Date.now() - startedAt,
        tasks: {
          scheduledNotifications,
          parkingReminder,
        },
      });
    },
  );
}
