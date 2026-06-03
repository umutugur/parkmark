// backend/src/cron/parking-reminder.task.ts
import { Types } from 'mongoose';
import { CronNotificationLog } from '../models/CronNotificationLog';
import { ParkingRecord } from '../parking/parking.schema';
import { User } from '../auth/user.schema';
import { CronTaskResult } from './scheduled-notifications.task';
import { SupportedLanguage, resolveLanguage, sendExpoPush } from './push';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

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
