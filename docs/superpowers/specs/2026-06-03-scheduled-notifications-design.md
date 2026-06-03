# ParkMark — Zamanlanmış Bildirimler Tasarım Dokümanı

**Tarih:** 2026-06-03  
**Durum:** Onaylandı

---

## 1. Problem

Aktif park kaydı oluşturup "Aracı Aldım" yapmayan kullanıcı oranı yüksek. Bu kullanıcılara 24 saat sonra sunucu taraflı push bildirimi gönderilmesi gerekiyor. Bunun yanı sıra kayıt sonrası karşılama, hareketsizlik ve haftalık ipuçları gibi genel pazarlama/engagement bildirimleri de eksik.

---

## 2. Genel Mimari

İki görev, tek cron endpoint'ten çalışır:

```
cron-job.org (saatlik)
      ▼
POST /api/cron/run   Authorization: Bearer <CRON_SECRET>
      ├── Task 1: runScheduledNotifications(now)
      │     DB'deki ScheduledNotification şablonları → matchesTrigger → push → NotificationLog
      └── Task 2: runParkingReminder(now)
            isActive=true + parkedAt ≤ now-24h → CronNotificationLog dedup → push
```

Yanıt formatı:
```json
{
  "ok": true,
  "ranAt": "ISO string",
  "durationMs": 1234,
  "tasks": {
    "scheduledNotifications": { "ok": true, "sent": 5, "skipped": 12, "failed": 0, "durationMs": 200 },
    "parkingReminder":        { "ok": true, "sent": 3, "skipped": 1,  "failed": 0, "durationMs": 80 }
  }
}
```

---

## 3. Veri Modelleri

### 3.1 ScheduledNotification (yeni)

```typescript
{
  title:             { tr: string, en: string }   // {name} placeholder destekli
  body:              { tr: string, en: string }   // {name} placeholder destekli
  category:          'welcome' | 'reminder' | 'tip' | 'winback' | 'seasonal'
  trigger_type:      'days_after_register' | 'days_inactive' | 'recurring' | 'fixed_date'
  trigger_value:     number | null  // days_after_register/inactive → gün sayısı; fixed_date → ayın günü (1-31)
  recurring_pattern: 'daily' | 'weekly' | 'monthly' | null
  recurring_day:     number | null  // weekly: 0-6 (0=Pazar), monthly: 1-31
  recurring_hour:    number (0-23 UTC, varsayılan 7 → TR'de sabah 10)
  is_active:         boolean
  // timestamps: createdAt, updatedAt
}
```

Index: `{ is_active: 1, trigger_type: 1 }`

### 3.2 NotificationLog (yeni)

Sistem 1 için cron run başına 1 kayıt — istatistik amaçlı.

```typescript
{
  scheduled_notification_id: ObjectId (ref: ScheduledNotification)
  sent_at:       Date
  target_count:  number
  success_count: number
  fail_count:    number
  status:        'sent' | 'partial' | 'failed'
}
```

Index: `{ scheduled_notification_id: 1, sent_at: -1 }`

### 3.3 CronNotificationLog (yeni)

Sistem 2 için park başına 1 kayıt — duplicate gönderimi önler.

```typescript
{
  task:    'parking_24h_reminder'
  userId:  ObjectId (ref: User)
  key:     string  // unique → "parking_reminder:<parkingId>"
  sentAt:  Date
}
```

Index: `{ task: 1, userId: 1, sentAt: -1 }`, `key` alanına unique index.

### 3.4 User şeması değişikliği

`language: { type: String, enum: ['tr', 'en'], default: 'tr' }` alanı eklenir.

---

## 4. Cron Task Mantığı

### 4.1 Sistem 1 — `runScheduledNotifications(now: Date)`

```
1. ScheduledNotification.find({ is_active: true })
2. currentHour = now.getUTCHours()
3. notification.recurring_hour !== currentHour → skip
4. Kullanıcıları yükle: pushToken != null AND marketingNotificationsEnabled = true
5. notifiedUserIds = new Set()  ← run içi dedup (kullanıcı başına max 1 bildirim)
6. Her notification × her kullanıcı:
   a. notifiedUserIds'de varsa → skip
   b. matchesTrigger(notification, user, now) → false ise → skip
   c. {name} → user.name.split(' ')[0]
   d. user.language → 'tr' | 'en'
   e. Push gönder
   f. notifiedUserIds.add(userId)
7. Her notification için NotificationLog kayıt
```

**matchesTrigger mantığı:**

| trigger_type | Koşul |
|---|---|
| `days_after_register` | Bugün === kayıt tarihi + N gün (isSameDay UTC) |
| `days_inactive` | (bugün - user.updatedAt) >= N gün **VE** son 7 günde aynı bildirim bu kullanıcıya gönderilmemiş |
| `fixed_date` | today.getUTCDate() === trigger_value |
| `recurring daily` | Her zaman true |
| `recurring weekly` | today.getUTCDay() === recurring_day |
| `recurring monthly` | today.getUTCDate() === recurring_day |

> **Önemli — `days_inactive` dedup:** Bu trigger `diffDays >= N` koşulu olduğundan kullanıcı uzun süre hareketsiz kalırsa her gün tetiklenir. Bunu engellemek için `CronNotificationLog`'a bu trigger için de kayıt düşülür: `key = "scheduled:<notifId>:<userId>"`. Gönderimden önce son 7 günde bu key ile kayıt var mı kontrol edilir; varsa skip.

### 4.2 Sistem 2 — `runParkingReminder(now: Date)`

```
1. threshold = now - 24 saat
2. ParkingRecord.find({ isActive: true, parkedAt: { $lte: threshold } })
3. userId listesinden User'ları yükle (pushToken, marketingNotificationsEnabled, name, language)
4. Her park için:
   a. Kullanıcıda pushToken yoksa veya marketingNotificationsEnabled=false → skip
   b. CronNotificationLog.findOne({ key: "parking_reminder:<parkingId>" }) → varsa → skip
   c. {firstName} = user.name.split(' ')[0]
   d. Dile göre başlık + body seç
   e. Push gönder (Expo Push API)
   f. CronNotificationLog.create({ task, userId, key, sentAt })
```

**Bildirim metni:**

```
TR başlık: "{firstName}, araban hâlâ parkta 🚗"
TR body:   "Park kaydın hâlâ açık. Eve döndüysen 'Aracı Aldım'a basmayı unutma!"

EN başlık: "{firstName}, your car is still parked 🚗"
EN body:   "Your parking record is still active. Tap 'Got My Car' when you're back!"
```

Dedup key: `"parking_reminder:<parkingId>"` → unique constraint → aynı park için hayatı boyunca 1 kez gönderilir.

---

## 5. Yeni / Değişen Backend Dosyaları

| Dosya | İşlem | Açıklama |
|---|---|---|
| `src/models/ScheduledNotification.ts` | Yeni | Şablon model |
| `src/models/NotificationLog.ts` | Yeni | Sistem 1 run logu |
| `src/models/CronNotificationLog.ts` | Yeni | Sistem 2 dedup logu |
| `src/cron/scheduled-notifications.task.ts` | Yeni | Sistem 1 task fonksiyonu |
| `src/cron/parking-reminder.task.ts` | Yeni | Sistem 2 task fonksiyonu |
| `src/routes/cron.routes.ts` | Yeni | `POST /api/cron/run` endpoint |
| `src/auth/user.schema.ts` | Güncelle | `language` field ekle |
| `src/auth/auth.routes.ts` | Güncelle | notification-prefs'e `language` ekle |
| `src/admin/admin.routes.ts` | Güncelle | Scheduled notifications CRUD + bulk |
| `src/app.ts` | Güncelle | Cron routes register |

---

## 6. Admin API Endpoint'leri (yeni)

Tümü `Authorization: Bearer <admin_token>` gerektirir.

```
GET    /api/admin/scheduled-notifications          → sayfalı liste
POST   /api/admin/scheduled-notifications          → tek ekle
PATCH  /api/admin/scheduled-notifications/:id      → güncelle (is_active toggle dahil)
DELETE /api/admin/scheduled-notifications/:id      → tek sil
POST   /api/admin/scheduled-notifications/bulk     → JSON array ile toplu ekle
DELETE /api/admin/scheduled-notifications/bulk     → { ids: string[] } ile toplu sil
```

`GET` yanıtı:
```json
{
  "items": [...],
  "total": 42,
  "page": 1,
  "limit": 25,
  "totalPages": 2
}
```

`POST /bulk` yanıtı:
```json
{ "created": 5, "skipped": 1, "errors": ["Item 3: title.tr required"] }
```

---

## 7. Cron Endpoint

```
POST /api/cron/run
Authorization: Bearer <CRON_SECRET>
Content-Type: application/json (body boş olabilir)
```

- `CRON_SECRET` `.env`'e eklenir
- Rate limit: 10 istek / dakika
- cron-job.org her saat başı çalıştırır
- Content-Type parser body olmasa da 400 vermez (Montly paterni)

---

## 8. Admin Panel — Yeni Sayfa: Scheduled Notifications

### Rota

`/scheduled-notifications` → `ScheduledNotifications.tsx`

Sidebar'a yeni nav item: **Scheduled** (`ClockIcon`)

### Sayfa Yapısı

```
┌─────────────────────────────────────────────────────────────┐
│  Scheduled Notifications               [+ Add]  [⬆ Import]  │
├──────────┬────────────┬────────────────────────────────────  │
│ Active   │ Total      │  (istatistik kartları)               │
├──────────┴────────────┴──────────────────────────────────── │
│ [☐]  Category   Trigger            Title (TR)   Hour Status  │
│ [☐]  welcome    Day 1 after reg    Merhaba...   07   ●       │
│ [☐]  winback    7 days inactive    {name}, ...  07   ○       │
├─────────────────────────────────────────────────────────────┤
│  Bulk: [X seçili] [Sil]                        Pagination    │
└─────────────────────────────────────────────────────────────┘
```

**Tablo kolonları:**
- Checkbox (bulk seçim)
- Category (renkli badge)
- Trigger açıklaması (okunabilir, örn. "7 gün sonra kayıt", "Her Pazartesi")
- Title TR (truncated)
- Hour (UTC)
- Status toggle (aktif/pasif)
- Actions: Düzenle (kalem ikonu) + Sil (çöp ikonu)

### Add / Edit Modal

Alanlar:
1. **Category** — dropdown (welcome / reminder / tip / winback / seasonal)
2. **Trigger Type** — dropdown, seçime göre aşağıdaki alanlar dinamik görünür:
   - `days_after_register` / `days_inactive` → **Gün Sayısı** number input
   - `recurring` → **Pattern** (daily/weekly/monthly) + **Gün** (weekly/monthly için)
   - `fixed_date` → **Ayın Günü** (1-31)
3. **Saat (UTC)** — 0-23 dropdown
4. **Title TR** + **Title EN** — text input
5. **Body TR** + **Body EN** — textarea (`{name}` placeholder hint'i gösterilir)
6. **Aktif** — toggle

### Bulk Import Modal

- JSON textarea veya dosya yükleme (`.json`)
- Önizleme: satır satır validasyon → geçerli/hatalı renk kodlu
- "X kayıt aktarılacak" özeti
- **Onayla** butonu

### Bulk Silme

- Checkbox ile çoklu seçim
- Alt action bar: "X kayıt seçili — Sil" → ConfirmModal
- Onay sonrası `DELETE /bulk` çağrısı

---

## 9. Frontend (Mobile) Değişikliği

### `frontend/app/home/settings.tsx`

Dil değiştirildiğinde mevcut `i18n.changeLanguage()` çağrısına ek olarak:

```typescript
await apiService.updateNotificationPrefs({ language: newLang });
```

### `src/services/api.ts` (veya mevcut notificationPrefs fonksiyonu)

`PATCH /api/auth/notification-prefs` isteğine `language?: 'tr' | 'en'` eklenir.

---

## 10. Ortam Değişkenleri

`backend/.env`'e eklenir:
```
CRON_SECRET=<güçlü rastgele string, en az 32 karakter>
```

---

## 11. cron-job.org Kurulumu

Mevcut health ping job'a ek **1 yeni job**:

| Alan | Değer |
|---|---|
| URL | `https://parkmark.onrender.com/api/cron/run` |
| Method | POST |
| Schedule | Her saat başı (`0 * * * *`) |
| Header | `Authorization: Bearer <CRON_SECRET>` |
| Content-Type | `application/json` |
| Body | `{}` |

---

## 12. Seed Verileri

İlk kullanım için DB'ye eklenecek örnek şablonlar (kod içi seed veya admin panel üzerinden):

| Category | Trigger | Gün | Saat UTC | Title TR |
|---|---|---|---|---|
| welcome | days_after_register | 1 | 7 | "Merhaba {name}! İlk parkını kaydettin mi? 🚗" |
| tip | days_after_register | 3 | 7 | "Navigasyon özelliğini denedin mi?" |
| tip | days_after_register | 7 | 7 | "ParkMark'ı beğendin mi? Bize destek ol ⭐" |
| winback | days_inactive | 7 | 7 | "{name}, seni özledik 👋" |
| winback | days_inactive | 14 | 10 | "2 haftadır görünmüyorsun..." |
| tip | recurring weekly | Pazartesi (1) | 7 | "Bu hafta nereye park ettin?" |

---

## 13. Kapsam Dışı

- Montly'deki `ru` (Rusça) dil desteği — ParkMark sadece TR/EN
- Admin panel'de bildirim önizlemesi ("Bu bildirimi X kişi alacak" sayısı)
- Per-user bildirim geçmişi (kimin ne aldığı)
- A/B test desteği
- Bildirim tıklama analytics'i
