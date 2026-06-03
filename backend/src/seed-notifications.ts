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
    title: { tr: "ParkMark'ı beğendin mi? ⭐", en: 'Enjoying ParkMark? ⭐' },
    body: {
      tr: "Uygulamayı beğendiysen App Store'da bize destek ol!",
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
    is_active: false, // Activate manually when ready
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  for (const s of SEEDS) {
    const exists = await ScheduledNotification.findOne({
      'title.tr': s.title.tr,
      trigger_type: s.trigger_type,
      trigger_value: s.trigger_value ?? null,
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
