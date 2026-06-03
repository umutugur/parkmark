# Scheduled Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ParkMark'a iki katmanlı zamanlanmış bildirim sistemi ekle: (1) admin panel üzerinden yönetilen genel pazarlama/engagement bildirimleri ve (2) 24 saat sonra hâlâ aktif olan park kayıtları için otomatik hatırlatma.

**Architecture:** Backend'de üç yeni Mongoose modeli (ScheduledNotification, NotificationLog, CronNotificationLog), iki task fonksiyonu ve tek bir `POST /api/cron/run` endpoint'i. Admin paneline tam CRUD + bulk işlemler için yeni `ScheduledNotifications` sayfası. Mobil ayarlar ekranında dil değişikliği backend'e sync edilir.

**Tech Stack:** Fastify 5 + Mongoose 8 + TypeScript (backend) · React 18 + Vite + Tailwind + Heroicons + Axios (admin) · React Native + Expo (mobile) · Expo Push API

---

## Dosya Haritası

### Yeni Dosyalar
| Dosya | Sorumluluk |
|---|---|
| `backend/src/models/ScheduledNotification.ts` | Bildirim şablonu Mongoose modeli |
| `backend/src/models/NotificationLog.ts` | Sistem 1 cron run istatistik logu |
| `backend/src/models/CronNotificationLog.ts` | Dedup logu (Sistem 2 + days_inactive) |
| `backend/src/cron/scheduled-notifications.task.ts` | Sistem 1: DB şablonları → push |
| `backend/src/cron/parking-reminder.task.ts` | Sistem 2: 24h aktif park → push |
| `backend/src/routes/cron.routes.ts` | `POST /api/cron/run` endpoint |
| `admin/src/pages/ScheduledNotifications.tsx` | Admin panel yönetim sayfası |

### Değişen Dosyalar
| Dosya | Değişiklik |
|---|---|
| `backend/src/auth/user.schema.ts` | `language: 'tr' \| 'en'` field eklenir |
| `backend/src/auth/auth.routes.ts` | notification-prefs'e `language` kabul edilir |
| `backend/src/admin/admin.routes.ts` | Scheduled notifications CRUD + bulk endpoints |
| `backend/src/app.ts` | Cron routes register edilir |
| `admin/src/App.tsx` | `/scheduled-notifications` route eklenir |
| `admin/src/components/Sidebar.tsx` | "Scheduled" nav item eklenir |
| `frontend/app/home/settings.tsx` | Dil değişince backend'e sync |
| `frontend/services/api.ts` | `updateNotificationPrefs`'e `language` eklenir |

---

## Task 1: User şemasına `language` field ekle + notification-prefs endpoint güncelle

**Files:**
- Modify: `backend/src/auth/user.schema.ts`
- Modify: `backend/src/auth/auth.routes.ts`

- [ ] **Step 1: `user.schema.ts`'e `language` field ekle**

`backend/src/auth/user.schema.ts` dosyasını aç. `IUser` interface'ine ve `UserSchema`'ya field ekle:

```typescript
// IUser interface'ine ekle (marketingNotificationsEnabled'dan sonra):
language: 'tr' | 'en';

// UserSchema'ya ekle (marketingNotificationsEnabled'dan sonra):
language: { type: String, enum: ['tr', 'en'], default: 'tr' },
```

Tam sonuç — `IUser` interface bloğu:
```typescript
export interface IUser extends Document {
  email: string;
  password: string | null;
  name: string;
  googleId: string | null;
  appleId: string | null;
  isSubscribed: boolean;
  subscriptionPlan: 'monthly' | 'sixMonth' | 'yearly' | null;
  subscriptionExpiresAt: Date | null;
  freemiumExpiresAt: Date | null;
  pinCount: number;
  pushToken: string | null;
  marketingNotificationsEnabled: boolean;
  language: 'tr' | 'en';
  banned: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

`UserSchema` içinde `marketingNotificationsEnabled` satırından sonra:
```typescript
language: { type: String, enum: ['tr', 'en'], default: 'tr' },
```

- [ ] **Step 2: `auth.routes.ts`'de notification-prefs handler'ını güncelle**

`PATCH /auth/notification-prefs` handler'ında destructuring ve updateFields bloğunu güncelle:

```typescript
// Değiştir:
const { marketingNotificationsEnabled, pushToken } = request.body as any;

// Şuna:
const { marketingNotificationsEnabled, pushToken, language } = request.body as any;
```

`updateFields` bloğuna ekle (`pushToken` bloğundan sonra):
```typescript
if (language === 'tr' || language === 'en') {
  updateFields.language = language;
}
```

- [ ] **Step 3: TypeScript derle — hata yoksa devam**

```bash
cd /Users/umutugur/parkmark_app/backend && npx tsc --noEmit
```

Beklenen çıktı: hata yok (0 exit code)

- [ ] **Step 4: Commit**

```bash
cd /Users/umutugur/parkmark_app/backend
git add src/auth/user.schema.ts src/auth/auth.routes.ts
git commit -m "feat: add language field to User schema and notification-prefs endpoint"
```

---

## Task 2: ScheduledNotification Mongoose modeli

**Files:**
- Create: `backend/src/models/ScheduledNotification.ts`

- [ ] **Step 1: Model dosyasını oluştur**

```typescript
// backend/src/models/ScheduledNotification.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IScheduledNotification extends Document {
  title: { tr: string; en: string };
  body: { tr: string; en: string };
  category: 'welcome' | 'reminder' | 'tip' | 'winback' | 'seasonal';
  trigger_type: 'days_after_register' | 'days_inactive' | 'recurring' | 'fixed_date';
  trigger_value: number | null;
  recurring_pattern: 'daily' | 'weekly' | 'monthly' | null;
  recurring_day: number | null;
  recurring_hour: number;
  is_active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const i18nField = {
  tr: { type: String, required: true, trim: true, maxlength: 500 },
  en: { type: String, required: true, trim: true, maxlength: 500 },
};

const ScheduledNotificationSchema = new Schema<IScheduledNotification>(
  {
    title: { type: i18nField, required: true },
    body: { type: i18nField, required: true },
    category: {
      type: String,
      required: true,
      enum: ['welcome', 'reminder', 'tip', 'winback', 'seasonal'],
    },
    trigger_type: {
      type: String,
      required: true,
      enum: ['days_after_register', 'days_inactive', 'recurring', 'fixed_date'],
    },
    trigger_value: { type: Number, default: null },
    recurring_pattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: null,
    },
    recurring_day: { type: Number, default: null },
    recurring_hour: { type: Number, required: true, min: 0, max: 23, default: 7 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

ScheduledNotificationSchema.index({ is_active: 1, trigger_type: 1 });

export const ScheduledNotification = mongoose.model<IScheduledNotification>(
  'ScheduledNotification',
  ScheduledNotificationSchema,
);
```

- [ ] **Step 2: TypeScript derle**

```bash
cd /Users/umutugur/parkmark_app/backend && npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 3: Commit**

```bash
git add src/models/ScheduledNotification.ts
git commit -m "feat: add ScheduledNotification model"
```

---

## Task 3: NotificationLog + CronNotificationLog modelleri

**Files:**
- Create: `backend/src/models/NotificationLog.ts`
- Create: `backend/src/models/CronNotificationLog.ts`

- [ ] **Step 1: NotificationLog modelini oluştur**

```typescript
// backend/src/models/NotificationLog.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface INotificationLog extends Document {
  scheduled_notification_id: Types.ObjectId;
  sent_at: Date;
  target_count: number;
  success_count: number;
  fail_count: number;
  status: 'sent' | 'partial' | 'failed';
}

const NotificationLogSchema = new Schema<INotificationLog>(
  {
    scheduled_notification_id: {
      type: Schema.Types.ObjectId,
      ref: 'ScheduledNotification',
      required: true,
      index: true,
    },
    sent_at: { type: Date, required: true, default: () => new Date(), index: true },
    target_count: { type: Number, required: true, default: 0 },
    success_count: { type: Number, required: true, default: 0 },
    fail_count: { type: Number, required: true, default: 0 },
    status: { type: String, required: true, enum: ['sent', 'partial', 'failed'] },
  },
  { versionKey: false },
);

NotificationLogSchema.index({ scheduled_notification_id: 1, sent_at: -1 });

export const NotificationLog = mongoose.model<INotificationLog>(
  'NotificationLog',
  NotificationLogSchema,
);
```

- [ ] **Step 2: CronNotificationLog modelini oluştur**

```typescript
// backend/src/models/CronNotificationLog.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICronNotificationLog extends Document {
  task: string;
  userId: Types.ObjectId;
  key: string;
  sentAt: Date;
}

const CronNotificationLogSchema = new Schema<ICronNotificationLog>(
  {
    task: { type: String, required: true, trim: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    key: { type: String, required: true, trim: true, maxlength: 255, unique: true, index: true },
    sentAt: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { versionKey: false },
);

CronNotificationLogSchema.index({ task: 1, userId: 1, sentAt: -1 });

export const CronNotificationLog = mongoose.model<ICronNotificationLog>(
  'CronNotificationLog',
  CronNotificationLogSchema,
);
```

- [ ] **Step 3: TypeScript derle**

```bash
cd /Users/umutugur/parkmark_app/backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/models/NotificationLog.ts src/models/CronNotificationLog.ts
git commit -m "feat: add NotificationLog and CronNotificationLog models"
```

---

## Task 4: Sistem 1 — scheduled-notifications.task.ts

**Files:**
- Create: `backend/src/cron/scheduled-notifications.task.ts`

- [ ] **Step 1: `backend/src/cron/` dizinini oluştur ve task dosyasını yaz**

```typescript
// backend/src/cron/scheduled-notifications.task.ts
import { Types } from 'mongoose';
import { IScheduledNotification, ScheduledNotification } from '../models/ScheduledNotification';
import { NotificationLog } from '../models/NotificationLog';
import { CronNotificationLog } from '../models/CronNotificationLog';
import { User } from '../auth/user.schema';

export interface CronTaskResult {
  ok: boolean;
  sent: number;
  skipped: number;
  failed: number;
  durationMs: number;
}

type SupportedLanguage = 'tr' | 'en';

interface UserSnapshot {
  _id: Types.ObjectId;
  name: string;
  language?: string | null;
  pushToken: string | null;
  marketingNotificationsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function resolveLanguage(value: unknown): SupportedLanguage {
  if (typeof value !== 'string') return 'tr';
  return value.trim().toLowerCase().startsWith('en') ? 'en' : 'tr';
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
  inactiveDedupSet: Set<string>, // "notifId:userId" keyleri
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
      // 7 günlük dedup: run öncesi yüklenen inactiveDedupSet'te varsa skip
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

export async function runScheduledNotifications(now: Date): Promise<CronTaskResult> {
  const startedAt = Date.now();
  let sent = 0, skipped = 0, failed = 0;

  const currentHour = now.getUTCHours();

  // Aktif şablonları yükle
  const notifications = await ScheduledNotification.find({ is_active: true }).lean<IScheduledNotification[]>();

  // Saate göre filtrele
  const hourNotifications = notifications.filter((n) => n.recurring_hour === currentHour);
  if (hourNotifications.length === 0) {
    return { ok: true, sent: 0, skipped: 0, failed: 0, durationMs: Date.now() - startedAt };
  }

  // Bildirim alabilecek kullanıcıları yükle
  const users = await User.find({
    pushToken: { $ne: null },
    marketingNotificationsEnabled: true,
  })
    .select('_id name language pushToken marketingNotificationsEnabled createdAt updatedAt')
    .lean<UserSnapshot[]>();

  if (users.length === 0) {
    return { ok: true, sent: 0, skipped: users.length, failed: 0, durationMs: Date.now() - startedAt };
  }

  // days_inactive dedup: son 7 günde gönderilmiş olanları yükle
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
      // task formatı: "scheduled_inactive:<notifId>"
      const notifId = log.task.replace('scheduled_inactive:', '');
      inactiveDedupSet.add(`${notifId}:${log.userId.toString()}`);
    }
  }

  // Her şablon için gönderim
  const notifiedUserIds = new Set<string>(); // run içi dedup

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

        // days_inactive için dedup kaydı oluştur
        if (notif.trigger_type === 'days_inactive') {
          await CronNotificationLog.create({
            task: `scheduled_inactive:${notifId}`,
            userId: user._id,
            key: `scheduled_inactive:${notifId}:${userId}:${Math.floor(now.getTime() / (7 * 86400000))}`,
            sentAt: now,
          }).catch(() => {}); // unique constraint hatası → zaten gönderilmiş, yok sayılır
        }
      } else {
        notifFailed++;
        failed++;
      }
    }

    notifSkipped += notifSkipped;
    skipped += notifSkipped;

    // NotificationLog kayıt
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
```

- [ ] **Step 2: TypeScript derle**

```bash
cd /Users/umutugur/parkmark_app/backend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/cron/scheduled-notifications.task.ts
git commit -m "feat: add scheduled notifications cron task (System 1)"
```

---

## Task 5: Sistem 2 — parking-reminder.task.ts

**Files:**
- Create: `backend/src/cron/parking-reminder.task.ts`

- [ ] **Step 1: Task dosyasını oluştur**

```typescript
// backend/src/cron/parking-reminder.task.ts
import { Types } from 'mongoose';
import { CronNotificationLog } from '../models/CronNotificationLog';
import { ParkingRecord } from '../parking/parking.schema';
import { User } from '../auth/user.schema';
import { CronTaskResult } from './scheduled-notifications.task';

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

  // 24 saati geçmiş aktif parkları bul
  const activeParks = await ParkingRecord.find({
    isActive: true,
    parkedAt: { $lte: threshold },
  })
    .select('_id userId')
    .lean<Array<{ _id: Types.ObjectId; userId: Types.ObjectId }>>();

  if (activeParks.length === 0) {
    return { ok: true, sent: 0, skipped: 0, failed: 0, durationMs: Date.now() - startedAt };
  }

  // Kullanıcıları yükle
  const uniqueUserIds = [...new Set(activeParks.map((p) => p.userId.toString()))];
  const users = await User.find({
    _id: { $in: uniqueUserIds },
    pushToken: { $ne: null },
    marketingNotificationsEnabled: true,
  })
    .select('_id name language pushToken')
    .lean<Array<{ _id: Types.ObjectId; name: string; language?: string | null; pushToken: string | null }>>();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  // Zaten bildirim gönderilmiş parkları bul
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
      }).catch(() => {}); // unique constraint → yok say

      existingKeys.add(dedupKey);
      sent++;
    } else {
      failed++;
    }
  }

  return { ok: true, sent, skipped, failed, durationMs: Date.now() - startedAt };
}
```

- [ ] **Step 2: TypeScript derle**

```bash
cd /Users/umutugur/parkmark_app/backend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/cron/parking-reminder.task.ts
git commit -m "feat: add 24h active parking reminder cron task (System 2)"
```

---

## Task 6: Cron endpoint — `POST /api/cron/run`

**Files:**
- Create: `backend/src/routes/cron.routes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: `cron.routes.ts` oluştur**

```typescript
// backend/src/routes/cron.routes.ts
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
```

- [ ] **Step 2: `app.ts`'e cron routes ekle**

`backend/src/app.ts` dosyasında import satırlarına ekle:
```typescript
import { cronRoutes } from './routes/cron.routes';
```

`app.register(adminRoutes, ...)` satırından sonra ekle:
```typescript
await app.register(cronRoutes, { prefix: '/api' });
```

- [ ] **Step 3: TypeScript derle**

```bash
cd /Users/umutugur/parkmark_app/backend && npx tsc --noEmit
```

- [ ] **Step 4: Lokal test (backend çalışıyorsa)**

```bash
# Önce dev server başlat (ayrı terminal):
# npm run start:dev

# Geçersiz secret → 401 beklenir:
curl -s -X POST http://localhost:3000/api/cron/run \
  -H "Authorization: Bearer wrong_secret" | python3 -m json.tool

# CRON_SECRET .env'e ekle, sonra geçerli secret ile → tasks nesnesi dön:
curl -s -X POST http://localhost:3000/api/cron/run \
  -H "Authorization: Bearer <CRON_SECRET_DEĞERI>" \
  -H "Content-Type: application/json" | python3 -m json.tool
```

Beklenen başarılı yanıt:
```json
{
  "ok": true,
  "ranAt": "...",
  "durationMs": 150,
  "tasks": {
    "scheduledNotifications": { "ok": true, "sent": 0, "skipped": 0, "failed": 0, "durationMs": 50 },
    "parkingReminder": { "ok": true, "sent": 0, "skipped": 0, "failed": 0, "durationMs": 30 }
  }
}
```

- [ ] **Step 5: `.env`'e CRON_SECRET ekle**

`backend/.env` dosyasına ekle:
```
CRON_SECRET=<en az 32 karakterlik rastgele string, örn: openssl rand -hex 32 ile üret>
```

```bash
# Güvenli secret üret:
openssl rand -hex 32
```

- [ ] **Step 6: Commit**

```bash
cd /Users/umutugur/parkmark_app/backend
git add src/routes/cron.routes.ts src/app.ts
git commit -m "feat: add POST /api/cron/run endpoint"
```

---

## Task 7: Admin backend — Scheduled Notifications CRUD endpoints

**Files:**
- Modify: `backend/src/admin/admin.routes.ts`

- [ ] **Step 1: Import ekle**

`admin.routes.ts` dosyasının başındaki import bloğuna ekle:
```typescript
import { ScheduledNotification } from '../models/ScheduledNotification';
```

- [ ] **Step 2: GET endpoint ekle**

`adminRoutes` fonksiyonunun sonuna (son `}` parantezinden önce) ekle:

```typescript
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
```

- [ ] **Step 3: POST (tek ekle) endpoint ekle**

```typescript
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
```

- [ ] **Step 4: PATCH (güncelle) endpoint ekle**

```typescript
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
```

- [ ] **Step 5: DELETE (tek sil) endpoint ekle**

```typescript
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
```

- [ ] **Step 6: POST /bulk (toplu ekle) endpoint ekle**

Bu endpoint, `/scheduled-notifications/:id` ile çakışmaması için `:id` routelarından ÖNCE tanımlanmalıdır. Adım 3'teki POST'tan hemen sonra ekle:

```typescript
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
```

- [ ] **Step 7: DELETE /bulk (toplu sil) endpoint ekle**

```typescript
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
```

> **Not:** Fastify'da route sırası önemlidir. `/bulk` path'leri, `/:id` parametrik routelarından önce tanımlanmalıdır. Yukarıdaki sıra (POST bulk → POST :id'siz, PATCH /:id, DELETE /:id, DELETE /bulk) bu sorunu önler. DELETE /bulk, Fastify'ın `/:id` ile karıştırmaması için body'den ids alır (path parametresi değil).

- [ ] **Step 8: TypeScript derle**

```bash
cd /Users/umutugur/parkmark_app/backend && npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add src/admin/admin.routes.ts src/models/ScheduledNotification.ts
git commit -m "feat: add scheduled notifications CRUD and bulk endpoints to admin routes"
```

---

## Task 8: Admin panel — `ScheduledNotifications.tsx` sayfası

**Files:**
- Create: `admin/src/pages/ScheduledNotifications.tsx`

- [ ] **Step 1: Sayfayı oluştur**

```tsx
// admin/src/pages/ScheduledNotifications.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  ClockIcon,
  PlusIcon,
  ArrowUpTrayIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../components/Toast';
import api from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'welcome' | 'reminder' | 'tip' | 'winback' | 'seasonal';
type TriggerType = 'days_after_register' | 'days_inactive' | 'recurring' | 'fixed_date';
type RecurringPattern = 'daily' | 'weekly' | 'monthly';

interface ScheduledNotification {
  id: string;
  title: { tr: string; en: string };
  body: { tr: string; en: string };
  category: Category;
  trigger_type: TriggerType;
  trigger_value: number | null;
  recurring_pattern: RecurringPattern | null;
  recurring_day: number | null;
  recurring_hour: number;
  is_active: boolean;
  createdAt: string;
}

const EMPTY_FORM: Omit<ScheduledNotification, 'id' | 'createdAt'> = {
  title: { tr: '', en: '' },
  body: { tr: '', en: '' },
  category: 'reminder',
  trigger_type: 'days_after_register',
  trigger_value: 1,
  recurring_pattern: null,
  recurring_day: null,
  recurring_hour: 7,
  is_active: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const categoryColors: Record<Category, string> = {
  welcome: 'bg-green-500/10 text-green-400 border-green-500/20',
  reminder: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  tip: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  winback: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  seasonal: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function describeTrigger(n: ScheduledNotification): string {
  switch (n.trigger_type) {
    case 'days_after_register':
      return `Day ${n.trigger_value} after register`;
    case 'days_inactive':
      return `${n.trigger_value} days inactive`;
    case 'fixed_date':
      return `Every month on day ${n.trigger_value}`;
    case 'recurring': {
      if (n.recurring_pattern === 'daily') return 'Every day';
      if (n.recurring_pattern === 'weekly')
        return `Every ${DAYS[n.recurring_day ?? 0]}`;
      if (n.recurring_pattern === 'monthly')
        return `Monthly on day ${n.recurring_day}`;
      return 'Recurring';
    }
    default:
      return '—';
  }
}

// ─── Modal Form ───────────────────────────────────────────────────────────────

interface NotifFormProps {
  initial: Omit<ScheduledNotification, 'id' | 'createdAt'>;
  onSave: (data: Omit<ScheduledNotification, 'id' | 'createdAt'>) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  title: string;
}

function NotifForm({ initial, onSave, onClose, isSaving, title }: NotifFormProps) {
  const [form, setForm] = useState(initial);

  const set = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const setTitle = (lang: 'tr' | 'en', val: string) =>
    setForm((prev) => ({ ...prev, title: { ...prev.title, [lang]: val } }));
  const setBody = (lang: 'tr' | 'en', val: string) =>
    setForm((prev) => ({ ...prev, body: { ...prev.body, [lang]: val } }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const inputCls =
    'w-full bg-bg-deep border border-white/10 rounded-xl px-3 py-2 text-sm text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-primary/40';
  const labelCls = 'block text-xs font-medium text-text-secondary mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-bg-card border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-bg-card border-b border-white/10 flex items-center justify-between px-6 py-4 z-10">
          <h2 className="text-base font-bold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Category + Trigger Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className={inputCls}
              >
                {['welcome', 'reminder', 'tip', 'winback', 'seasonal'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Trigger Type</label>
              <select
                value={form.trigger_type}
                onChange={(e) => {
                  const t = e.target.value as TriggerType;
                  set('trigger_type', t);
                  set('trigger_value', t === 'recurring' ? null : 1);
                  set('recurring_pattern', t === 'recurring' ? 'daily' : null);
                  set('recurring_day', null);
                }}
                className={inputCls}
              >
                <option value="days_after_register">Days after register</option>
                <option value="days_inactive">Days inactive</option>
                <option value="recurring">Recurring</option>
                <option value="fixed_date">Fixed date (day of month)</option>
              </select>
            </div>
          </div>

          {/* Trigger-specific fields */}
          {(form.trigger_type === 'days_after_register' ||
            form.trigger_type === 'days_inactive' ||
            form.trigger_type === 'fixed_date') && (
            <div>
              <label className={labelCls}>
                {form.trigger_type === 'fixed_date' ? 'Day of month (1-31)' : 'Number of days'}
              </label>
              <input
                type="number"
                min={1}
                max={form.trigger_type === 'fixed_date' ? 31 : 9999}
                value={form.trigger_value ?? 1}
                onChange={(e) => set('trigger_value', parseInt(e.target.value, 10) || 1)}
                className={inputCls}
                required
              />
            </div>
          )}

          {form.trigger_type === 'recurring' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Pattern</label>
                <select
                  value={form.recurring_pattern ?? 'daily'}
                  onChange={(e) => {
                    set('recurring_pattern', e.target.value);
                    set('recurring_day', null);
                  }}
                  className={inputCls}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {(form.recurring_pattern === 'weekly' ||
                form.recurring_pattern === 'monthly') && (
                <div>
                  <label className={labelCls}>
                    {form.recurring_pattern === 'weekly' ? 'Day of week (0=Sun)' : 'Day of month (1-31)'}
                  </label>
                  <input
                    type="number"
                    min={form.recurring_pattern === 'weekly' ? 0 : 1}
                    max={form.recurring_pattern === 'weekly' ? 6 : 31}
                    value={form.recurring_day ?? 1}
                    onChange={(e) => set('recurring_day', parseInt(e.target.value, 10))}
                    className={inputCls}
                    required
                  />
                </div>
              )}
            </div>
          )}

          {/* Hour */}
          <div>
            <label className={labelCls}>Hour (UTC, 0-23)</label>
            <input
              type="number"
              min={0}
              max={23}
              value={form.recurring_hour}
              onChange={(e) => set('recurring_hour', parseInt(e.target.value, 10) || 0)}
              className={inputCls}
              required
            />
            <p className="text-xs text-text-secondary mt-1">
              UTC 7 = 10:00 TR (UTC+3 summer)
            </p>
          </div>

          {/* Title TR + EN */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Title TR</label>
              <input
                type="text"
                value={form.title.tr}
                onChange={(e) => setTitle('tr', e.target.value)}
                placeholder="{name} placeholder destekli"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Title EN</label>
              <input
                type="text"
                value={form.title.en}
                onChange={(e) => setTitle('en', e.target.value)}
                placeholder="{name} placeholder supported"
                className={inputCls}
                required
              />
            </div>
          </div>

          {/* Body TR + EN */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Body TR</label>
              <textarea
                value={form.body.tr}
                onChange={(e) => setBody('tr', e.target.value)}
                placeholder="{name} ile kişiselleştir"
                rows={3}
                className={inputCls + ' resize-none'}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Body EN</label>
              <textarea
                value={form.body.en}
                onChange={(e) => setBody('en', e.target.value)}
                placeholder="Use {name} to personalise"
                rows={3}
                className={inputCls + ' resize-none'}
                required
              />
            </div>
          </div>

          {/* Hint */}
          <p className="text-xs text-text-secondary bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
            💡 <code className="text-primary">{'{name}'}</code> → kullanıcının adının ilk kelimesi ile değiştirilir
          </p>

          {/* Active */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-secondary">Active</label>
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                form.is_active ? 'bg-primary' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  form.is_active ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-text-secondary hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-bg-deep text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Bulk Import Modal ────────────────────────────────────────────────────────

function BulkImportModal({
  onImport,
  onClose,
  isImporting,
}: {
  onImport: (items: any[]) => Promise<void>;
  onClose: () => void;
  isImporting: boolean;
}) {
  const [text, setText] = useState('');
  const [parseResult, setParseResult] = useState<{
    valid: number;
    errors: string[];
    parsed: any[];
  } | null>(null);

  const handleParse = () => {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        setParseResult({ valid: 0, errors: ['Root must be a JSON array'], parsed: [] });
        return;
      }
      const errors: string[] = [];
      const validItems: any[] = [];
      const validCats = ['welcome', 'reminder', 'tip', 'winback', 'seasonal'];
      const validTriggers = ['days_after_register', 'days_inactive', 'recurring', 'fixed_date'];
      parsed.forEach((item, i) => {
        const row = i + 1;
        if (!item?.title?.tr || !item?.title?.en)
          errors.push(`Item ${row}: title.tr and title.en required`);
        else if (!item?.body?.tr || !item?.body?.en)
          errors.push(`Item ${row}: body.tr and body.en required`);
        else if (!validCats.includes(item.category))
          errors.push(`Item ${row}: invalid category`);
        else if (!validTriggers.includes(item.trigger_type))
          errors.push(`Item ${row}: invalid trigger_type`);
        else validItems.push(item);
      });
      setParseResult({ valid: validItems.length, errors, parsed: validItems });
    } catch (e: any) {
      setParseResult({ valid: 0, errors: [`JSON parse error: ${e.message}`], parsed: [] });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-bg-card border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-text-primary">Bulk Import</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setParseResult(null); }}
          placeholder={`[\n  {\n    "title": { "tr": "...", "en": "..." },\n    "body": { "tr": "...", "en": "..." },\n    "category": "welcome",\n    "trigger_type": "days_after_register",\n    "trigger_value": 1,\n    "recurring_hour": 7\n  }\n]`}
          rows={10}
          className="w-full bg-bg-deep border border-white/10 rounded-xl px-3 py-2 text-xs text-text-primary font-mono resize-none focus:outline-none focus:border-primary/40 mb-3"
        />

        {parseResult && (
          <div className="mb-3 space-y-1">
            {parseResult.errors.map((e, i) => (
              <p key={i} className="text-xs text-error">✗ {e}</p>
            ))}
            {parseResult.valid > 0 && (
              <p className="text-xs text-green-400">✓ {parseResult.valid} valid items ready to import</p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleParse}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-text-secondary hover:bg-white/5 transition-colors"
          >
            Validate
          </button>
          <button
            onClick={() => parseResult?.parsed && onImport(parseResult.parsed)}
            disabled={!parseResult || parseResult.valid === 0 || isImporting}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-bg-deep text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {isImporting ? 'Importing...' : `Import ${parseResult?.valid ?? 0} items`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScheduledNotifications() {
  const { showToast } = useToast();
  const [items, setItems] = useState<ScheduledNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editItem, setEditItem] = useState<ScheduledNotification | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id?: string; bulk?: boolean } | null>(null);

  const load = async (p = page) => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/scheduled-notifications', { params: { page: p, limit: 25 } });
      setItems(data.items);
      setTotal(data.total);
      setPage(p);
      setTotalPages(data.totalPages);
    } catch {
      showToast('Failed to load scheduled notifications', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  // Toggle select
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)));

  // Toggle active
  const handleToggleActive = async (item: ScheduledNotification) => {
    try {
      await api.patch(`/scheduled-notifications/${item.id}`, { is_active: !item.is_active });
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
    } catch {
      showToast('Failed to update', 'error');
    }
  };

  // Save (add or edit)
  const handleSave = async (form: Omit<ScheduledNotification, 'id' | 'createdAt'>) => {
    setIsSaving(true);
    try {
      if (editItem) {
        await api.patch(`/scheduled-notifications/${editItem.id}`, form);
        showToast('Updated successfully');
      } else {
        await api.post('/scheduled-notifications', form);
        showToast('Notification added');
      }
      setEditItem(null);
      setShowAdd(false);
      load(1);
    } catch {
      showToast('Failed to save', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete single
  const handleDeleteSingle = async (id: string) => {
    try {
      await api.delete(`/scheduled-notifications/${id}`);
      showToast('Deleted');
      setConfirmDelete(null);
      load(page);
    } catch {
      showToast('Failed to delete', 'error');
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    try {
      await api.delete('/scheduled-notifications/bulk', { data: { ids: [...selected] } });
      showToast(`Deleted ${selected.size} items`);
      setSelected(new Set());
      setConfirmDelete(null);
      load(1);
    } catch {
      showToast('Failed to bulk delete', 'error');
    }
  };

  // Bulk import
  const handleImport = async (items: any[]) => {
    setIsImporting(true);
    try {
      const { data } = await api.post('/scheduled-notifications/bulk', items);
      showToast(`Imported ${data.created} items${data.skipped > 0 ? `, ${data.skipped} skipped` : ''}`);
      setShowImport(false);
      load(1);
    } catch {
      showToast('Import failed', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const activeCount = items.filter((i) => i.is_active).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClockIcon className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold text-text-primary">Scheduled Notifications</h1>
            <p className="text-xs text-text-secondary">{total} total · {activeCount} active</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-sm text-text-secondary hover:bg-white/5 transition-colors"
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-bg-deep text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-error/5 border border-error/20 rounded-xl px-4 py-2.5">
          <span className="text-sm text-text-primary">{selected.size} selected</span>
          <button
            onClick={() => setConfirmDelete({ bulk: true })}
            className="flex items-center gap-1.5 text-sm text-error hover:text-error/80 transition-colors ml-auto"
          >
            <TrashIcon className="w-4 h-4" />
            Delete selected
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-text-secondary hover:text-text-primary"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selected.size === items.length}
                    onChange={toggleAll}
                    className="accent-primary"
                  />
                </th>
                {['Category', 'Trigger', 'Title (TR)', 'Hour (UTC)', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-text-secondary text-sm">
                    No scheduled notifications yet
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${categoryColors[item.category]}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{describeTrigger(item)}</td>
                    <td className="px-4 py-3 text-sm text-text-primary max-w-xs truncate" title={item.title.tr}>
                      {item.title.tr}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {String(item.recurring_hour).padStart(2, '0')}:00
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(item)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${item.is_active ? 'bg-primary' : 'bg-white/10'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${item.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditItem(item)}
                          className="p-1.5 rounded-lg hover:bg-white/5 text-text-secondary hover:text-text-primary transition-colors"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ id: item.id })}
                          className="p-1.5 rounded-lg hover:bg-error/10 text-text-secondary hover:text-error transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
            <p className="text-xs text-text-secondary">{total} total</p>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => load(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-primary text-bg-deep' : 'hover:bg-white/5 text-text-secondary'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {(showAdd || editItem) && (
        <NotifForm
          title={editItem ? 'Edit Notification' : 'Add Notification'}
          initial={editItem ? { ...editItem } : EMPTY_FORM}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditItem(null); }}
          isSaving={isSaving}
        />
      )}

      {showImport && (
        <BulkImportModal
          onImport={handleImport}
          onClose={() => setShowImport(false)}
          isImporting={isImporting}
        />
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title={confirmDelete?.bulk ? `Delete ${selected.size} notifications?` : 'Delete notification?'}
        message={confirmDelete?.bulk ? 'This will permanently delete all selected notifications.' : 'This notification will be permanently deleted.'}
        confirmLabel="Delete"
        onConfirm={() => {
          if (confirmDelete?.bulk) handleBulkDelete();
          else if (confirmDelete?.id) handleDeleteSingle(confirmDelete.id);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/umutugur/parkmark_app
git add admin/src/pages/ScheduledNotifications.tsx
git commit -m "feat: add ScheduledNotifications admin page"
```

---

## Task 9: Admin panel — Route + Sidebar

**Files:**
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/components/Sidebar.tsx`

- [ ] **Step 1: `App.tsx`'e import ve route ekle**

Import bloğuna ekle:
```tsx
import ScheduledNotifications from './pages/ScheduledNotifications';
```

`<Route path="logs" element={<Logs />} />` satırından önce ekle:
```tsx
<Route path="scheduled-notifications" element={<ScheduledNotifications />} />
```

- [ ] **Step 2: `Sidebar.tsx`'e nav item ekle**

Import satırına `ClockIcon` ekle:
```tsx
import {
  HomeIcon,
  UsersIcon,
  MapPinIcon,
  MapIcon,
  BellIcon,
  CurrencyDollarIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
```

`navItems` dizisinde `{ path: '/notifications', ... }` satırından sonra ekle:
```tsx
{ path: '/scheduled-notifications', label: 'Scheduled', icon: ClockIcon },
```

- [ ] **Step 3: Build dene**

```bash
cd /Users/umutugur/parkmark_app/admin && npm run build 2>&1 | tail -20
```

Beklenen: `dist/` oluşur, TypeScript hatası yok.

- [ ] **Step 4: Commit**

```bash
git add admin/src/App.tsx admin/src/components/Sidebar.tsx
git commit -m "feat: add Scheduled Notifications route and sidebar nav item"
```

---

## Task 10: Mobile — Dil değişikliğini backend'e sync et

**Files:**
- Modify: `frontend/services/api.ts`
- Modify: `frontend/app/home/settings.tsx`

- [ ] **Step 1: `api.ts`'de `updateNotificationPrefs` imzasını güncelle**

`updateNotificationPrefs` metodunu bul ve `language` field ekle:

```typescript
async updateNotificationPrefs(prefs: {
  marketingNotificationsEnabled?: boolean;
  pushToken?: string | null;
  language?: 'tr' | 'en';
}): Promise<{ success: boolean }> {
  const response = await this.client.patch<{ success: boolean }>(
    new URL('/api/auth/notification-prefs', API_URL).toString(),
    prefs
  );
  return response?.data ?? { success: false };
}
```

- [ ] **Step 2: `settings.tsx`'de `handleLanguageChange`'i güncelle**

Mevcut `handleLanguageChange` fonksiyonunu değiştir:

```typescript
const handleLanguageChange = async (lang: 'en' | 'tr') => {
  await changeLanguage(lang);
  // Backend'e de sync et (hata olursa sessizce devam et)
  apiService.updateNotificationPrefs({ language: lang }).catch(() => {});
};
```

- [ ] **Step 3: TypeScript kontrol**

```bash
cd /Users/umutugur/parkmark_app/frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd /Users/umutugur/parkmark_app
git add frontend/services/api.ts frontend/app/home/settings.tsx
git commit -m "feat: sync language preference to backend on language change"
```

---

## Task 11: Seed verileri — ilk bildirim şablonlarını ekle

**Files:**
- Create: `backend/src/seed-notifications.ts`

- [ ] **Step 1: Seed script oluştur**

```typescript
// backend/src/seed-notifications.ts
import 'dotenv/config';
import mongoose from 'mongoose';
import { ScheduledNotification } from './models/ScheduledNotification';

const SEEDS = [
  {
    title: { tr: 'Merhaba {name}! 🚗', en: 'Welcome {name}! 🚗' },
    body: {
      tr: 'İlk parkını kaydettin mi? ParkMark ile arabanı bir daha kaybetme!',
      en: "Have you saved your first park? Never lose your car again with ParkMark!",
    },
    category: 'welcome',
    trigger_type: 'days_after_register',
    trigger_value: 1,
    recurring_hour: 7,
    is_active: true,
  },
  {
    title: { tr: 'Navigasyonu denedin mi? 🗺️', en: 'Tried the navigation? 🗺️' },
    body: {
      tr: 'Arabana geri dönmek için ParkMark navigasyonunu kullanabilirsin.',
      en: 'Use ParkMark navigation to find your way back to your car.',
    },
    category: 'tip',
    trigger_type: 'days_after_register',
    trigger_value: 3,
    recurring_hour: 7,
    is_active: true,
  },
  {
    title: { tr: 'ParkMark\'ı beğendin mi? ⭐', en: 'Enjoying ParkMark? ⭐' },
    body: {
      tr: 'Uygulamayı beğendiysen App Store\'da bize destek ol!',
      en: "If you're enjoying the app, please rate us on the App Store!",
    },
    category: 'tip',
    trigger_type: 'days_after_register',
    trigger_value: 7,
    recurring_hour: 7,
    is_active: true,
  },
  {
    title: { tr: '{name}, seni özledik 👋', en: 'We miss you, {name} 👋' },
    body: {
      tr: '7 gündür görünmüyorsun. Arabanı nereye park ettiğini takip etmeyi unutma!',
      en: "You haven't been around for 7 days. Don't forget to track where you parked!",
    },
    category: 'winback',
    trigger_type: 'days_inactive',
    trigger_value: 7,
    recurring_hour: 7,
    is_active: true,
  },
  {
    title: { tr: 'Uzun zaman oldu... 🤔', en: "It's been a while... 🤔" },
    body: {
      tr: '2 haftadır görünmüyorsun. ParkMark hâlâ seni bekliyor!',
      en: "You've been away for 2 weeks. ParkMark is still here for you!",
    },
    category: 'winback',
    trigger_type: 'days_inactive',
    trigger_value: 14,
    recurring_hour: 10,
    is_active: true,
  },
  {
    title: { tr: 'Bu hafta nereye park ettin? 🅿️', en: 'Where did you park this week? 🅿️' },
    body: {
      tr: 'ParkMark ile park konumunu kaydet, kolayca geri dön.',
      en: 'Save your parking spot with ParkMark and find your way back easily.',
    },
    category: 'tip',
    trigger_type: 'recurring',
    trigger_value: null,
    recurring_pattern: 'weekly',
    recurring_day: 1, // Monday
    recurring_hour: 7,
    is_active: false, // İsteğe göre aktif et
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  for (const s of SEEDS) {
    const exists = await ScheduledNotification.findOne({
      'title.tr': s.title.tr,
      trigger_type: s.trigger_type,
      trigger_value: s.trigger_value,
    });
    if (exists) {
      console.log(`Skip (exists): ${s.title.tr}`);
      continue;
    }
    await ScheduledNotification.create(s);
    console.log(`Created: ${s.title.tr}`);
  }

  await mongoose.disconnect();
  console.log('Done');
}

seed().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Seed'i çalıştır**

```bash
cd /Users/umutugur/parkmark_app/backend
npx ts-node src/seed-notifications.ts
```

Beklenen çıktı:
```
Connected to MongoDB
Created: Merhaba {name}! 🚗
Created: Navigasyonu denedin mi? 🗺️
Created: ParkMark'ı beğendin mi? ⭐
Created: {name}, seni özledik 👋
Created: Uzun zaman oldu... 🤔
Created: Bu hafta nereye park ettin? 🅿️
Done
```

- [ ] **Step 3: Commit**

```bash
git add src/seed-notifications.ts
git commit -m "feat: add seed script for initial scheduled notification templates"
```

---

## Task 12: cron-job.org yapılandırması

Bu adım kod değişikliği gerektirmez — cron-job.org panelinden yapılır.

- [ ] **Step 1: CRON_SECRET'ı Render.com'a ekle**

Render.com dashboard → parkmark-backend service → Environment → `CRON_SECRET` değişkenini ekle (Task 6'da `openssl rand -hex 32` ile üretilen değer).

- [ ] **Step 2: cron-job.org'da yeni job oluştur**

[cron-job.org](https://cron-job.org) → Jobs → Create:

| Alan | Değer |
|---|---|
| Title | ParkMark Cron |
| URL | `https://parkmark.onrender.com/api/cron/run` |
| Schedule | Every hour at minute 0 |
| Request method | POST |
| Headers | `Authorization: Bearer <CRON_SECRET>` ve `Content-Type: application/json` |
| Request body | `{}` |

- [ ] **Step 3: İlk manuel çalıştırma ile test et**

cron-job.org → Job → Run now → Response body kontrol et:
```json
{ "ok": true, "ranAt": "...", "tasks": { ... } }
```

---

## Self-Review Kontrol Listesi

- [x] **Spec kapsamı:**
  - User.language field → Task 1 ✅
  - notification-prefs'e language → Task 1 ✅
  - ScheduledNotification modeli → Task 2 ✅
  - NotificationLog modeli → Task 3 ✅
  - CronNotificationLog modeli → Task 3 ✅
  - runScheduledNotifications (Sistem 1) → Task 4 ✅
  - runParkingReminder (Sistem 2) → Task 5 ✅
  - POST /api/cron/run endpoint → Task 6 ✅
  - Admin CRUD GET/POST/PATCH/DELETE → Task 7 ✅
  - Admin bulk POST/DELETE → Task 7 ✅
  - Admin panel sayfası (tablo, modal, bulk import) → Task 8 ✅
  - Sidebar + route → Task 9 ✅
  - Mobile language sync → Task 10 ✅
  - Seed verileri → Task 11 ✅
  - cron-job.org kurulum → Task 12 ✅

- [x] **Tip tutarlılığı:** `CronTaskResult` Task 4'te tanımlanır, Task 5 ve 6 import eder ✅
- [x] **days_inactive dedup:** `CronNotificationLog` task string olarak `"scheduled_inactive:<notifId>"` kullanır, key `"scheduled_inactive:<notifId>:<userId>:<weekBucket>"` ✅
- [x] **sendExpoPush:** Task 4 ve Task 5'te aynı şekilde implement edilmiş ✅
- [x] **Bulk /bulk endpoint'leri:** `/:id` routelarından önce register edilir → Fastify route order conflict yok ✅
