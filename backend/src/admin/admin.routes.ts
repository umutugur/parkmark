import { FastifyInstance } from 'fastify';
import { adminAuthenticate, signAdminJwt } from './admin.middleware';
import { AppConfig } from './appconfig.schema';
import { AdminLog, IAdminLog } from './adminlog.schema';
import { User } from '../auth/user.schema';
import { ParkingRecord } from '../parking/parking.schema';
import { FileRecord } from '../files/file.schema';
import { ScheduledNotification } from '../models/ScheduledNotification';

async function logAction(
  adminUser: string,
  action: string,
  targetType: IAdminLog['targetType'],
  targetId?: string,
  details?: Record<string, any>,
) {
  try {
    await AdminLog.create({ adminUser, action, targetType, targetId, details: details ?? {} });
  } catch {
    // non-blocking
  }
}

export async function adminRoutes(app: FastifyInstance) {
  // ─── Login ───────────────────────────────────────────────────────────────
  app.post('/auth/login', async (request, reply) => {
    const { username, password } = request.body as any;
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const secret = process.env.ADMIN_SECRET;

    if (!secret) {
      return reply.status(500).send({ statusCode: 500, message: 'ADMIN_SECRET not configured' });
    }

    if (username !== adminUser || password !== adminPassword) {
      return reply.status(401).send({ statusCode: 401, message: 'Invalid credentials' });
    }

    const token = signAdminJwt({ username, role: 'admin' }, secret, 8 * 3600);
    return reply.send({ token, username });
  });

  // ─── All routes below require admin auth ─────────────────────────────────
  app.addHook('preHandler', async (request, reply) => {
    if (request.routeOptions?.url?.endsWith('/auth/login')) return;
    await adminAuthenticate(request, reply);
  });

  // ─── Stats ────────────────────────────────────────────────────────────────
  app.get('/stats', async (request, reply) => {
    try {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      const startOfMonth = new Date(now);
      startOfMonth.setDate(now.getDate() - 30);

      const [
        totalUsers,
        totalParkings,
        activeParkings,
        totalFiles,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        premiumUsers,
        freemiumUsers,
      ] = await Promise.all([
        User.countDocuments(),
        ParkingRecord.countDocuments(),
        ParkingRecord.countDocuments({ isActive: true }),
        FileRecord.countDocuments(),
        User.countDocuments({ createdAt: { $gte: startOfToday } }),
        User.countDocuments({ createdAt: { $gte: startOfWeek } }),
        User.countDocuments({ createdAt: { $gte: startOfMonth } }),
        User.countDocuments({ isSubscribed: true }),
        User.countDocuments({ freemiumExpiresAt: { $gt: now } }),
      ]);

      const freeUsers = totalUsers - premiumUsers - freemiumUsers;

      // User growth last 30 days
      const growthAgg = await User.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const userGrowth = growthAgg.map((g) => ({ date: g._id, count: g.count }));

      // Recent activity from AdminLog
      const recentLogs = await AdminLog.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      const recentActivity = recentLogs.map((log) => ({
        type: log.action,
        user: log.adminUser,
        detail: JSON.stringify(log.details),
        createdAt: log.createdAt,
      }));

      return reply.send({
        totalUsers,
        totalParkings,
        activeParkings,
        totalFiles,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        premiumUsers,
        freeUsers: Math.max(0, freeUsers),
        freemiumUsers,
        userGrowth,
        recentActivity,
      });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Users List ──────────────────────────────────────────────────────────
  app.get('/users', async (request, reply) => {
    try {
      const { plan, search, page = '1', limit = '20' } = request.query as any;
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;

      const query: Record<string, any> = {};
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }
      if (plan === 'premium') query.isSubscribed = true;
      else if (plan === 'free') {
        query.isSubscribed = false;
        query.freemiumExpiresAt = { $not: { $gt: new Date() } };
      } else if (plan === 'freemium') {
        query.freemiumExpiresAt = { $gt: new Date() };
      }

      const [users, total] = await Promise.all([
        User.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .select('-password')
          .lean(),
        User.countDocuments(query),
      ]);

      // Attach parking count per user
      const userIds = users.map((u: any) => u._id);
      const parkingCounts = await ParkingRecord.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } },
      ]);
      const countMap: Record<string, number> = {};
      for (const pc of parkingCounts) {
        countMap[pc._id.toString()] = pc.count;
      }

      const enriched = users.map((u: any) => ({
        ...u,
        id: u._id.toString(),
        parkingCount: countMap[u._id.toString()] ?? 0,
      }));

      return reply.send({ users: enriched, total, page: pageNum, limit: limitNum });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── User Detail ─────────────────────────────────────────────────────────
  app.get('/users/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const user = await User.findById(id).select('-password').lean();
      if (!user) return reply.status(404).send({ statusCode: 404, message: 'User not found' });

      const parkings = await ParkingRecord.find({ userId: id }).sort({ createdAt: -1 }).lean();

      return reply.send({ user: { ...user, id: (user as any)._id.toString() }, parkings });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Update User ─────────────────────────────────────────────────────────
  app.patch('/users/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const adminUser = (request as any).adminUser;
      const { isSubscribed, plan, expiresAt, banned } = request.body as any;

      const updateFields: Record<string, any> = {};
      if (typeof isSubscribed === 'boolean') updateFields.isSubscribed = isSubscribed;
      if (plan !== undefined) updateFields.subscriptionPlan = plan;
      if (expiresAt !== undefined)
        updateFields.subscriptionExpiresAt = expiresAt ? new Date(expiresAt) : null;
      if (typeof banned === 'boolean') updateFields.banned = banned;

      const user = await User.findByIdAndUpdate(id, { $set: updateFields }, { new: true }).select(
        '-password',
      );
      if (!user) return reply.status(404).send({ statusCode: 404, message: 'User not found' });

      await logAction(adminUser, 'update_user', 'user', id, updateFields);
      return reply.send({ user: { ...user.toJSON(), id } });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Delete User ─────────────────────────────────────────────────────────
  app.delete('/users/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const adminUser = (request as any).adminUser;

      const user = await User.findById(id);
      if (!user) return reply.status(404).send({ statusCode: 404, message: 'User not found' });

      await Promise.all([
        ParkingRecord.deleteMany({ userId: id }),
        FileRecord.deleteMany({ userId: id }),
        User.findByIdAndDelete(id),
      ]);

      await logAction(adminUser, 'delete_user', 'user', id, { email: user.email });
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Parkings List ───────────────────────────────────────────────────────
  app.get('/parkings', async (request, reply) => {
    try {
      const { userId, isActive, dateFrom, dateTo, page = '1', limit = '20' } = request.query as any;
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;

      const query: Record<string, any> = {};
      if (userId) query.userId = userId;
      if (isActive === 'true') query.isActive = true;
      else if (isActive === 'false') query.isActive = false;
      if (dateFrom || dateTo) {
        query.parkedAt = {};
        if (dateFrom) query.parkedAt.$gte = new Date(dateFrom);
        if (dateTo) query.parkedAt.$lte = new Date(dateTo);
      }

      const [parkings, total] = await Promise.all([
        ParkingRecord.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .populate('userId', 'name email')
          .lean(),
        ParkingRecord.countDocuments(query),
      ]);

      const enriched = parkings.map((p: any) => ({
        ...p,
        id: p._id.toString(),
        user: p.userId,
        userId: p.userId?._id?.toString() ?? p.userId?.toString(),
      }));

      return reply.send({ parkings: enriched, total, page: pageNum, limit: limitNum });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Delete Parking ──────────────────────────────────────────────────────
  app.delete('/parkings/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const adminUser = (request as any).adminUser;

      const parking = await ParkingRecord.findByIdAndDelete(id);
      if (!parking) return reply.status(404).send({ statusCode: 404, message: 'Parking not found' });

      await logAction(adminUser, 'delete_parking', 'parking', id, {
        address: parking.address,
        userId: parking.userId.toString(),
      });
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Revenue Stats ───────────────────────────────────────────────────────
  app.get('/revenue', async (request, reply) => {
    try {
      const [monthly, sixMonth, yearly] = await Promise.all([
        User.countDocuments({ isSubscribed: true, subscriptionPlan: 'monthly' }),
        User.countDocuments({ isSubscribed: true, subscriptionPlan: 'sixMonth' }),
        User.countDocuments({ isSubscribed: true, subscriptionPlan: 'yearly' }),
      ]);

      const mrrEstimate =
        monthly * 2.99 + (sixMonth * 12.99) / 6 + (yearly * 19.99) / 12;

      const planBreakdown = [
        { plan: 'monthly', count: monthly, price: 2.99 },
        { plan: 'sixMonth', count: sixMonth, price: 12.99 },
        { plan: 'yearly', count: yearly, price: 19.99 },
      ];

      // Webhook events for subscription trend
      const webhookEvents = await AdminLog.find({ targetType: 'webhook' })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      // Recent subscription events from webhook logs
      const recentEvents = webhookEvents.map((e) => ({
        id: (e as any)._id.toString(),
        eventType: e.action,
        userId: e.targetId,
        details: e.details,
        createdAt: e.createdAt,
      }));

      return reply.send({
        mrrEstimate: Math.round(mrrEstimate * 100) / 100,
        totalSubscribers: monthly + sixMonth + yearly,
        planBreakdown,
        recentEvents,
      });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Send Push Notification ──────────────────────────────────────────────
  app.post('/push/send', async (request, reply) => {
    try {
      const adminUser = (request as any).adminUser;
      const { title, body, target = 'all', userId } = request.body as any;

      if (!title || !body) {
        return reply.status(400).send({ statusCode: 400, message: 'title and body are required' });
      }

      const query: Record<string, any> = { pushToken: { $ne: null } };
      if (target === 'premium') query.isSubscribed = true;
      else if (target === 'free') {
        query.isSubscribed = false;
        query.freemiumExpiresAt = { $not: { $gt: new Date() } };
      } else if (target === 'user' && userId) {
        query._id = userId;
      }

      const users = await User.find(query).select('pushToken').lean();
      const tokens = users.map((u: any) => u.pushToken).filter(Boolean) as string[];

      let totalSent = 0;
      for (let i = 0; i < tokens.length; i += 100) {
        const chunk = tokens.slice(i, i + 100);
        const messages = chunk.map((token) => ({
          to: token,
          title,
          body,
          sound: 'default',
        }));

        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(messages),
        });

        if (res.ok) totalSent += chunk.length;
      }

      await logAction(adminUser, 'send_push', 'notification', undefined, {
        title,
        body,
        target,
        userId: userId ?? null,
        sent: totalSent,
        total: tokens.length,
      });

      return reply.send({ success: true, sent: totalSent, total: tokens.length });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Notification History ─────────────────────────────────────────────────
  app.get('/notifications/history', async (request, reply) => {
    try {
      const logs = await AdminLog.find({ targetType: 'notification' })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      return reply.send({ notifications: logs.map((l) => ({ ...l, id: (l as any)._id.toString() })) });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── App Config ──────────────────────────────────────────────────────────
  app.get('/config', async (_request, reply) => {
    try {
      let config = await AppConfig.findOne();
      if (!config) config = await AppConfig.create({});
      return reply.send({ config });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  app.patch('/config', async (request, reply) => {
    try {
      const adminUser = (request as any).adminUser;
      const { pinLimit, freemiumHours, maintenanceMode, maintenanceMessage, minAppVersion } =
        request.body as any;

      const updateFields: Record<string, any> = {};
      if (pinLimit !== undefined) updateFields.pinLimit = pinLimit;
      if (freemiumHours !== undefined) updateFields.freemiumHours = freemiumHours;
      if (typeof maintenanceMode === 'boolean') updateFields.maintenanceMode = maintenanceMode;
      if (maintenanceMessage !== undefined) updateFields.maintenanceMessage = maintenanceMessage;
      if (minAppVersion !== undefined) updateFields.minAppVersion = minAppVersion;

      const config = await AppConfig.findOneAndUpdate(
        {},
        { $set: updateFields },
        { new: true, upsert: true },
      );

      await logAction(adminUser, 'update_config', 'config', undefined, updateFields);
      return reply.send({ config });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Audit Logs ──────────────────────────────────────────────────────────
  app.get('/logs', async (request, reply) => {
    try {
      const { action, page = '1', limit = '20' } = request.query as any;
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;

      const query: Record<string, any> = {};
      if (action) query.action = action;

      const [logs, total] = await Promise.all([
        AdminLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        AdminLog.countDocuments(query),
      ]);

      return reply.send({
        logs: logs.map((l) => ({ ...l, id: (l as any)._id.toString() })),
        total,
        page: pageNum,
        limit: limitNum,
      });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Webhook Events ──────────────────────────────────────────────────────
  app.get('/webhook-events', async (_request, reply) => {
    try {
      const events = await AdminLog.find({ targetType: 'webhook' })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      return reply.send({ events: events.map((e) => ({ ...e, id: (e as any)._id.toString() })) });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Map Data ────────────────────────────────────────────────────────────
  app.get('/map-data', async (_request, reply) => {
    try {
      const parkings = await ParkingRecord.find({ isActive: true })
        .select('latitude longitude address userId parkedAt')
        .populate('userId', 'name email')
        .lean();

      const data = parkings.map((p: any) => ({
        id: p._id.toString(),
        latitude: p.latitude,
        longitude: p.longitude,
        address: p.address,
        parkedAt: p.parkedAt,
        user: p.userId,
      }));

      return reply.send({ parkings: data });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Scheduled Notifications — List ───────────────────────────────────────
  app.get('/scheduled-notifications', async (request, reply) => {
    try {
      const { page = '1', limit = '25' } = request.query as any;
      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      const [items, total] = await Promise.all([
        ScheduledNotification.find().sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        ScheduledNotification.countDocuments(),
      ]);

      return reply.send({
        items: items.map((i: any) => ({ ...i, id: i._id.toString() })),
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Scheduled Notifications — Bulk Create ────────────────────────────────
  app.post('/scheduled-notifications/bulk', async (request, reply) => {
    try {
      const items = request.body as any[];
      if (!Array.isArray(items)) {
        return reply.status(400).send({ statusCode: 400, message: 'Body must be a JSON array' });
      }

      const validCategories = ['welcome', 'reminder', 'tip', 'winback', 'seasonal'];
      const validTriggers = ['days_after_register', 'days_inactive', 'recurring', 'fixed_date'];
      let created = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const [index, item] of items.entries()) {
        const rowNum = index + 1;
        if (!item?.title?.tr || !item?.title?.en) {
          errors.push(`Item ${rowNum}: title.tr and title.en required`);
          skipped++;
          continue;
        }
        if (!item?.body?.tr || !item?.body?.en) {
          errors.push(`Item ${rowNum}: body.tr and body.en required`);
          skipped++;
          continue;
        }
        if (!validCategories.includes(item.category)) {
          errors.push(`Item ${rowNum}: invalid category "${item.category}"`);
          skipped++;
          continue;
        }
        if (!validTriggers.includes(item.trigger_type)) {
          errors.push(`Item ${rowNum}: invalid trigger_type "${item.trigger_type}"`);
          skipped++;
          continue;
        }

        await ScheduledNotification.create({
          title: item.title,
          body: item.body,
          category: item.category,
          trigger_type: item.trigger_type,
          trigger_value: item.trigger_value ?? null,
          recurring_pattern: item.recurring_pattern ?? null,
          recurring_day: item.recurring_day ?? null,
          recurring_hour: item.recurring_hour ?? 7,
          is_active: item.is_active !== false,
        });
        created++;
      }

      return reply.send({ created, skipped, errors });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Scheduled Notifications — Bulk Delete ────────────────────────────────
  app.delete('/scheduled-notifications/bulk', async (request, reply) => {
    try {
      const { ids } = request.body as { ids: string[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({ statusCode: 400, message: 'ids array required' });
      }
      const result = await ScheduledNotification.deleteMany({ _id: { $in: ids } });
      return reply.send({ deleted: result.deletedCount });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Scheduled Notifications — Create ─────────────────────────────────────
  app.post('/scheduled-notifications', async (request, reply) => {
    try {
      const {
        title, body, category, trigger_type,
        trigger_value = null, recurring_pattern = null,
        recurring_day = null, recurring_hour = 7, is_active = true,
      } = request.body as any;

      if (!title?.tr || !title?.en) {
        return reply.status(400).send({ statusCode: 400, message: 'title.tr and title.en are required' });
      }
      if (!body?.tr || !body?.en) {
        return reply.status(400).send({ statusCode: 400, message: 'body.tr and body.en are required' });
      }
      const validCategories = ['welcome', 'reminder', 'tip', 'winback', 'seasonal'];
      const validTriggers = ['days_after_register', 'days_inactive', 'recurring', 'fixed_date'];
      if (!validCategories.includes(category)) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid category' });
      }
      if (!validTriggers.includes(trigger_type)) {
        return reply.status(400).send({ statusCode: 400, message: 'Invalid trigger_type' });
      }

      const doc = await ScheduledNotification.create({
        title, body, category, trigger_type,
        trigger_value, recurring_pattern, recurring_day,
        recurring_hour: Math.min(23, Math.max(0, parseInt(recurring_hour, 10) || 7)),
        is_active,
      });

      return reply.status(201).send({ ...doc.toJSON(), id: doc._id.toString() });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Scheduled Notifications — Update ─────────────────────────────────────
  app.patch('/scheduled-notifications/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const updates = request.body as any;
      const allowed = [
        'title', 'body', 'category', 'trigger_type', 'trigger_value',
        'recurring_pattern', 'recurring_day', 'recurring_hour', 'is_active',
      ];
      const updateFields: Record<string, any> = {};
      for (const key of allowed) {
        if (updates[key] !== undefined) updateFields[key] = updates[key];
      }
      if (Object.keys(updateFields).length === 0) {
        return reply.status(400).send({ statusCode: 400, message: 'No valid fields to update' });
      }

      const doc = await ScheduledNotification.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true },
      );
      if (!doc) return reply.status(404).send({ statusCode: 404, message: 'Not found' });

      return reply.send({ ...doc.toJSON(), id: doc._id.toString() });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });

  // ─── Scheduled Notifications — Delete ─────────────────────────────────────
  app.delete('/scheduled-notifications/:id', async (request, reply) => {
    try {
      const { id } = request.params as any;
      const doc = await ScheduledNotification.findByIdAndDelete(id);
      if (!doc) return reply.status(404).send({ statusCode: 404, message: 'Not found' });
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ statusCode: 500, message: err.message });
    }
  });
}
