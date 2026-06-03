// backend/src/cron/parking-reminder.task.ts
import { Types } from 'mongoose';
import { CronNotificationLog } from '../models/CronNotificationLog';
import { ParkingRecord } from '../parking/parking.schema';
import { User } from '../auth/user.schema';

// CronTaskResult is exported here so that scheduled-notifications.task.ts can
// re-export it once Task 4 is in place. If that file already exists, this local
// definition is kept for self-containment; reconcile the import at that point.
export interface CronTaskResult {
  ok: boolean;
  sent: number;
  skipped: number;
  failed: number;
  durationMs: number;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

type SupportedLanguage = 'tr' | 'en';

const copy: Record<SupportedLanguage, { title: (firstName: string) => string; body: string }> = {
  tr: {
    title: (firstName) => `${firstName}, araban hâlâ parkta 🚗`,
    body: "Park kaydın hâlâ açık. Eve döndüysen 'Aracı Aldım'a basmayı unutma!",
  },
  en: {
    title: (firstName) => `${firstName}, your car is still parked 🚗`,
    body: "Your parking record is still active. Tap 'Got My Car' when you're back!",
  },
};

function resolveLanguage(value: unknown): SupportedLanguage {
  if (typeof value !== 'string') return 'tr';
  return value.trim().toLowerCase().startsWith('en') ? 'en' : 'tr';
}

async function sendExpoPush(token: string, title: string, body: string): Promise<boolean> {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default', priority: 'high', channelId: 'default' }),
    });
    if (!res.ok) return false;
    const payload = await res.json().catch(() => null) as any;
    if (!payload) return true;
    const data = Array.isArray(payload.data) ? payload.data[0] : payload.data;
    return data?.status !== 'error';
  } catch {
    return false;
  }
}

export async function runParkingReminder(now: Date): Promise<CronTaskResult> {
  const startedAt = Date.now();
  let sent = 0, skipped = 0, failed = 0;

  const threshold = new Date(now.getTime() - TWENTY_FOUR_HOURS_MS);

  const activeParks = await ParkingRecord.find({
    isActive: true,
    parkedAt: { $lte: threshold },
  })
    .select('_id userId')
    .lean<Array<{ _id: Types.ObjectId; userId: Types.ObjectId }>>();

  if (activeParks.length === 0) {
    return { ok: true, sent: 0, skipped: 0, failed: 0, durationMs: Date.now() - startedAt };
  }

  const uniqueUserIds = [...new Set(activeParks.map((p) => p.userId.toString()))];
  const users = await User.find({
    _id: { $in: uniqueUserIds },
    pushToken: { $ne: null },
    marketingNotificationsEnabled: true,
  })
    .select('_id name language pushToken')
    .lean<Array<{ _id: Types.ObjectId; name: string; language?: string | null; pushToken: string | null }>>();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const parkIds = activeParks.map((p) => p._id.toString());
  const existingKeys = new Set(
    (
      await CronNotificationLog.find({
        key: { $in: parkIds.map((id) => `parking_reminder:${id}`) },
      })
        .select('key')
        .lean<Array<{ key: string }>>()
    ).map((l) => l.key),
  );

  for (const park of activeParks) {
    const parkId = park._id.toString();
    const dedupKey = `parking_reminder:${parkId}`;

    if (existingKeys.has(dedupKey)) {
      skipped++;
      continue;
    }

    const user = userMap.get(park.userId.toString());
    if (!user || !user.pushToken) {
      skipped++;
      continue;
    }

    const lang = resolveLanguage(user.language);
    const firstName = user.name.split(' ')[0] ?? user.name;
    const { title, body } = copy[lang];

    const ok = await sendExpoPush(user.pushToken, title(firstName), body);

    if (ok) {
      await CronNotificationLog.create({
        task: 'parking_24h_reminder',
        userId: user._id,
        key: dedupKey,
        sentAt: now,
      }).catch(() => {});

      existingKeys.add(dedupKey);
      sent++;
    } else {
      failed++;
    }
  }

  return { ok: true, sent, skipped, failed, durationMs: Date.now() - startedAt };
}
