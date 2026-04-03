# ParkMark — CLAUDE.md

Arabanı park ettiğin yeri unutmaman için GPS destekli akıllı park asistanı.

---

## Proje Yapısı

```
parkmark_app/
├── frontend/          # React Native / Expo uygulaması
├── backend/           # Fastify + MongoDB API
└── docs/              # Privacy policy, hesap silme sayfaları
```

---

## Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Framework | React Native 0.81.5 + Expo 54 |
| Router | Expo Router (dosya tabanlı) |
| Dil | TypeScript (frontend + backend) |
| Backend | Fastify 5 + MongoDB / Mongoose |
| Auth | JWT (7 gün) + Google Sign-In + Apple Sign-In |
| Harita | react-native-maps (Google Maps Android, Apple Maps iOS) |
| Dosya | Cloudinary (presigned upload) |
| Abonelik | RevenueCat |
| Reklamlar | Google AdMob |
| Push Notifications | Expo Push Service |
| Lokalizasyon | i18next — TR / EN |

---

## Geliştirme Komutları

### Frontend (`/frontend`)
```bash
npx expo start              # Metro + Expo Go
npx expo start --android    # Android emulator
npx expo start --ios        # iOS simulator
npx expo prebuild           # Native klasörleri oluştur (android/ ios/)
```

### EAS Build
```bash
# Preview APK (test cihazı)
eas build --platform android --profile preview

# Production AAB (Play Store)
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production
```

### Backend (`/backend`)
```bash
npm run start:dev   # ts-node + nodemon ile geliştirme
npm run build       # TypeScript derle
node dist/main.js   # Production çalıştır
npx ts-node src/seed.ts  # Demo kullanıcı seed'le
```

---

## Ortam Değişkenleri

### Backend (`backend/.env`)
```
MONGODB_URI=
JWT_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
PORT=3000
GOOGLE_CLIENT_ID=
GOOGLE_IOS_CLIENT_ID=
GOOGLE_ANDROID_CLIENT_ID=
APPLE_BUNDLE_ID=com.parkmark.app
PUSH_API_KEY=
```

### Frontend (`frontend/.env`)
```
EXPO_PUBLIC_API_URL=https://parkmark.onrender.com
EXPO_PUBLIC_REVENUECAT_API_KEY=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_ADMOB_IOS_BANNER_ID=
EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID=
EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID=
EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID=
```

> EAS build'lerde env değerleri Expo dashboard'dan `preview` / `production` environment'larına girilmiştir.
> Firebase dosyaları (`google-services.json`, `GoogleService-Info.plist`) EAS file secrets'ta.

---

## Ekranlar

| Dosya | Ekran |
|-------|-------|
| `app/index.tsx` | Splash — auth durumuna göre yönlendirir |
| `app/auth/onboarding.tsx` | İlk kullanım tanıtımı |
| `app/auth/login.tsx` | Giriş / Kayıt (e-posta, Google, Apple, misafir) |
| `app/home/index.tsx` | Ana ekran — harita + aktif park kartı |
| `app/home/save-parking.tsx` | Yeni park kaydet (foto, not, hatırlatıcı) |
| `app/home/parking/[id].tsx` | Park detay + navigasyon + teslim al |
| `app/home/history.tsx` | Park geçmişi listesi (sayfalama + reklamlar) |
| `app/home/settings.tsx` | Ayarlar — profil, bildirimler, dil, abonelik |
| `app/home/about.tsx` | Uygulama hakkında |
| `app/home/privacy.tsx` | Gizlilik politikası |
| `app/home/terms.tsx` | Kullanım koşulları |
| `app/paywall.tsx` | Premium abonelik satın alma |

---

## API Endpoint'leri

### Kimlik Doğrulama
| Method | Path | Auth | Açıklama |
|--------|------|------|----------|
| POST | `/api/signup` | — | E-posta ile kayıt |
| POST | `/api/auth/login` | — | E-posta ile giriş |
| POST | `/api/auth/oauth` | — | Google / Apple OAuth |
| GET | `/api/auth/me` | JWT | Mevcut kullanıcı |
| POST | `/api/auth/freemium` | JWT | 24 saatlik deneme aktifleştir |
| PATCH | `/api/auth/notification-prefs` | JWT | Push token + bildirim tercihi |
| POST | `/api/push/send` | API Key | Push bildirim gönder (admin) |

### Park Kayıtları
| Method | Path | Auth | Açıklama |
|--------|------|------|----------|
| POST | `/api/parking` | JWT | Yeni park oluştur |
| GET | `/api/parking` | JWT | Kullanıcının park listesi |
| GET | `/api/parking/:id` | JWT | Tek park kaydı |
| PUT | `/api/parking/:id` | JWT | Güncelle |
| DELETE | `/api/parking/:id` | JWT | Sil |

### Dosya Yükleme
| Method | Path | Auth | Açıklama |
|--------|------|------|----------|
| POST | `/api/upload/presigned` | JWT | Cloudinary presigned URL al |
| POST | `/api/upload/complete` | JWT | Yükleme tamamla |
| GET | `/api/files/:id/url` | JWT | Dosya URL'i al (1 saat geçerli) |
| DELETE | `/api/files/:id` | JWT | Dosya sil |

### Sistem
| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/` | Sağlık kontrolü |
| GET | `/health` | Uptime + detaylı durum |

---

## Kimlik Doğrulama Akışı

```
Kayıt/Giriş → Backend JWT üretir (7 gün)
    ↓
Frontend SecureStore'a kaydeder (web: localStorage)
    ↓
AuthContext token'ı yükler, kullanıcıyı çeker
    ↓
API isteklerinde Authorization: Bearer <token>
    ↓
401 gelirse → token silinir, login'e yönlendirilir
```

**Misafir modu:** `continueAsGuest()` → `isGuest=true`, token yok.
Korumalı aksiyonlarda `useAuthGuard` hook'u Alert gösterir → login'e yönlendirir.

---

## Park Kaydı Kuralları

- Kullanıcı başına **aynı anda yalnızca 1 aktif park** (yeni eklenince eskisi deaktive edilir)
- Ücretsiz kullanıcı: **5 park** limiti
- Aktif abonelik veya freemium (24s): **sınırsız**
- `pinCount` her kayıt eklendiğinde backend'de artar

---

## Dosya Yükleme Akışı

```
Frontend → POST /api/upload/presigned → Cloudinary imzası
    ↓
Frontend doğrudan Cloudinary'ye yükler (sunucu yükü yok)
    ↓
Frontend → POST /api/upload/complete → Backend DB'ye kaydeder
    ↓
Görüntülenirken → GET /api/files/:id/url → 1 saatlik güvenli URL
```

---

## Bildirimler

| Tür | Altyapı | Açıklama |
|-----|---------|----------|
| Park hatırlatıcı | Yerel (expo-notifications) | Kaydederken ayarlanır, internet gerekmez |
| Uygulama bildirimleri | Expo Push Service | Backend gönderiyor, pazarlama/duyurular |

- Push token sadece gerçek cihazdan alınır (simülatörde null döner)
- Kullanıcı Ayarlar'dan her birini ayrı ayrı kapatabilir
- `registerPushToken()` login sonrası çağrılır, token değişmedikçe tekrar gönderilmez

---

## Önemli Servisler

| Dosya | Görev |
|-------|-------|
| `services/api.ts` | Tüm backend iletişimi (Axios tabanlı) |
| `services/social-auth.ts` | Google/Apple OAuth (Expo Go'da lazy require) |
| `services/purchases.ts` | RevenueCat abonelik işlemleri |
| `services/ads.ts` | AdMob banner + rewarded |
| `utils/notifications.ts` | İzin, push token, yerel bildirim |
| `utils/location.ts` | GPS konum alma, reverse geocode, harita açma |
| `utils/permissions.ts` | Konum, kamera, galeri izinleri |
| `contexts/AuthContext.tsx` | Global auth state |
| `hooks/useAuthGuard.ts` | Misafir koruması için `requireAuth()` |

---

## Tasarım Sistemi (`constants/theme.ts`)

```typescript
Colors.primary      // #FFC107 — sarı (ana renk)
Colors.accent       // #2196F3 — mavi
Colors.bgDeep       // #0d1520 — koyu arka plan
Colors.bgPrimary    // #1a2130 — kart arka planı
Colors.textPrimary  // #FFFFFF
Colors.textSecondary // #8899AA
```

---

## Platform Notları

- **Expo Go:** Native modüller çalışmaz (Google Sign-In, AdMob). `isExpoGo` kontrolü ile susturulur.
- **Android:** Google Maps için `PROVIDER_GOOGLE` ve Maps SDK API key gerekli.
- **iOS:** Apple Sign-In yalnızca iOS'ta görünür (`isAppleSignInAvailable()` kontrolü).
- **Reklamlar:** Yalnızca `!isSubscribed` kullanıcılara gösterilir.

---

## Demo Hesap (Store Review)

```
E-posta : demo@parkmark.app
Şifre   : Demo1234!
```

Seed komutu: `cd backend && npx ts-node src/seed.ts`
4 örnek park kaydı (1'i aktif), premium abonelikli.

---

## Deployment

| Bileşen | Platform | URL |
|---------|----------|-----|
| Backend | Render.com (free tier) | https://parkmark.onrender.com |
| Android AAB | EAS Build → Google Play | Internal testing |
| iOS | EAS Build → App Store Connect | — |
| Gizlilik politikası | Google Sites / docs/ | docs/privacy-policy.html |
| Hesap silme | Google Sites / docs/ | docs/delete-account.html |

> Render free tier uyku moduna girer. cron-job.org ile her 10 dakikada `/health` endpoint'i ping'leniyor.

---

## Git Yapısı

`.gitignore`'da hariç tutulanlar:
- `frontend/android/` ve `frontend/ios/` — EAS build oluşturur
- `frontend/.env` — EAS environment variables
- `google-services.json` ve `GoogleService-Info.plist` — EAS file secrets
- `node_modules/`

EAS keystore SHA-1 (Firebase'e eklenmiş):
`32:A2:F9:77:D9:43:85:CC:AC:F1:51:A6:4B:B1:8C:00:A1:E2:E3:4C`
