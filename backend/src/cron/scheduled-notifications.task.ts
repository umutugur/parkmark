// backend/src/cron/scheduled-notifications.task.ts
import { Types } from 'mongoose';
import { IScheduledNotification, ScheduledNotification } from '../models/ScheduledNotification';
import { NotificationLog } from '../models/NotificationLog';
import { CronNotificationLog } from '../models/CronNotificationLog';
import { User } from '../auth/user.schema';
import { resolveLanguage, sendExpoPush } from './push';

export interface CronTaskResult {
  ok: boolean;
  sent: number;
  skipped: number;
  failed: number;
  durationMs: number;
}

interface UserSnapshot {
  _id: Types.ObjectId;
  name: string;
  language?: string | null;
  pushToken: string | null;
  marketingNotificationsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function isSameUTCDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function diffDays(a: Date, b: Date): number {
  const msPerDay = 86400000;
  const aDay = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bDay = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.floor((bDay - aDay) / msPerDay);
}

function matchesTrigger(
  notif: IScheduledNotification,
  user: UserSnapshot,
  now: Date,
  inactiveDedupSet: Set<string>,
): boolean {
  switch (notif.trigger_type) {
    case 'days_after_register': {
      if (notif.trigger_value == null) return false;
      const targetDay = new Date(user.createdAt.getTime() + notif.trigger_value * 86400000);
      return isSameUTCDay(targetDay, now);
    }
    case 'days_inactive': {
      if (notif.trigger_value == null) return false;
      const days = diffDays(user.updatedAt, now);
      if (days < notif.trigger_value) return false;
      const dedupKey = `${(notif as any)._id.toString()}:${user._id.toString()}`;
      return !inactiveDedupSet.has(dedupKey);
    }
    case 'fixed_date': {
      if (notif.trigger_value == null) return false;
      return now.getUTCDate() === notif.trigger_value;
    }
    case 'recurring': {
      if (!notif.recurring_pattern) return false;
      if (notif.recurring_pattern === 'daily') return true;
      if (notif.recurring_pattern === 'weekly') {
        return notif.recurring_day != null && now.getUTCDay() === notif.recurring_day;
      }
      if (notif.recurring_pattern === 'monthly') {
        return notif.recurring_day != null && now.getUTCDate() === notif.recurring_day;
      }
      return false;
    }
    default:
      return false;
  }
}

export async function runScheduledNotifications(now: Date): Promise<CronTaskResult> {
  const startedAt = Date.now();
  let sent = 0, skipped = 0, failed = 0;

  const currentHour = now.getUTCHours();

  const notifications = await ScheduledNotification.find({ is_active: true }).lean<IScheduledNotification[]>();

  const hourNotifications = notifications.filter((n) => n.recurring_hour === currentHour);
  if (hourNotifications.length === 0) {
    return { ok: true, sent: 0, skipped: 0, failed: 0, durationMs: Date.now() - startedAt };
  }

  const users = await User.find({
    pushToken: { $ne: null },
    marketingNotificationsEnabled: true,
  })
    .select('_id name language pushToken marketingNotificationsEnabled createdAt updatedAt')
    .lean<UserSnapshot[]>();

  if (users.length === 0) {
    return { ok: true, sent: 0, skipped: 0, failed: 0, durationMs: Date.now() - startedAt };
  }

  // days_inactive dedup: load users notified in past 7 days for inactive notifications
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const inactiveNotifIds = hourNotifications
    .filter((n) => n.trigger_type === 'days_inactive')
    .map((n) => (n as any)._id.toString());

  const inactiveDedupSet = new Set<string>();
  if (inactiveNotifIds.length > 0) {
    const recentLogs = await CronNotificationLog.find({
      task: { $in: inactiveNotifIds.map((id) => `scheduled_inactive:${id}`) },
      sentAt: { $gte: sevenDaysAgo },
    })
      .select('task userId')
      .lean<Array<{ task: string; userId: Types.ObjectId }>>();

    for (const log of recentLogs) {
      const notifId = log.task.replace('scheduled_inactive:', '');
      inactiveDedupSet.add(`${notifId}:${log.userId.toString()}`);
    }
  }

  const notifiedUserIds = new Set<string>();

  for (const notif of hourNotifications) {
    const notifId = (notif as any)._id.toString();
    let notifSent = 0, notifSkipped = 0, notifFailed = 0;

    for (const user of users) {
      const userId = user._id.toString();

      if (notifiedUserIds.has(userId)) {
        notifSkipped++;
        continue;
      }

      if (!matchesTrigger(notif, user, now, inactiveDedupSet)) {
        notifSkipped++;
        continue;
      }

      const lang = resolveLanguage(user.language);
      const firstName = user.name.split(' ')[0] ?? user.name;
      const title = notif.title[lang].replace(/\{name\}/g, firstName);
      const body = notif.body[lang].replace(/\{name\}/g, firstName);

      const ok = await sendExpoPush(user.pushToken!, title, body);

      if (ok) {
        notifiedUserIds.add(userId);
        notifSent++;
        sent++;

        if (notif.trigger_type === 'days_inactive') {
          const weekBucket = Math.floor(now.getTime() / (7 * 86400000));
          await CronNotificationLog.create({
            task: `scheduled_inactive:${notifId}`,
            userId: user._id,
            key: `scheduled_inactive:${notifId}:${userId}:${weekBucket}`,
            sentAt: now,
          }).catch(() => {});
        }
      } else {
        notifFailed++;
        failed++;
      }
    }

    skipped += notifSkipped;

    const status: 'sent' | 'partial' | 'failed' =
      notifSent === 0 && notifFailed > 0
        ? 'failed'
        : notifFailed > 0
        ? 'partial'
        : 'sent';

    if (notifSent + notifFailed > 0) {
      await NotificationLog.create({
        scheduled_notification_id: (notif as any)._id,
        sent_at: now,
        target_count: notifSent + notifFailed,
        success_count: notifSent,
        fail_count: notifFailed,
        status,
      }).catch(() => {});
    }
  }

  return { ok: true, sent, skipped, failed, durationMs: Date.now() - startedAt };
}
