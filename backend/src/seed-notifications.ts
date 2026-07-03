import 'dotenv/config';
import mongoose from 'mongoose';
import { ScheduledNotification } from './models/ScheduledNotification';

// 28-day rotating pool of personalized daily reminders. Using recurring_day
// 1-28 (pattern: monthly) keeps every message valid in every calendar month
// (including February) and repeats the cycle roughly once a month.
const DAILY_ROTATION: Array<{ tr: [string, string]; en: [string, string] }> = [
  { tr: ['{name}, arabanı unutma! 🚗', 'ParkMark ile park yerini bir dokunuşla kaydet.'], en: ['{name}, don’t forget your car! 🚗', 'Save your parking spot with just one tap in ParkMark.'] },
  { tr: ['Bugün nereye park ettin, {name}? 🅿️', 'Konumunu şimdi kaydet, sonra aramakla uğraşma.'], en: ['Where did you park today, {name}? 🅿️', 'Save it now so you don’t have to search for it later.'] },
  { tr: ['{name}, fotoğrafı unutma! 📸', 'Park yerinin fotoğrafını ekleyerek daha kolay bulabilirsin.'], en: ['{name}, don’t forget the photo! 📸', 'Add a photo of your spot to find it even faster.'] },
  { tr: ['Kat ve bölüm notu al, {name}! 🏢', 'AVM veya havalimanında kat/bölüm bilgisini eklemeyi unutma.'], en: ['Note the floor and section, {name}! 🏢', 'Don’t forget to add the floor/section at malls or airports.'] },
  { tr: ['{name}, arabana dönüş zamanı geldi mi? 🧭', 'ParkMark navigasyonuyla direkt arabana yönlendirilirsin.'], en: ['{name}, time to head back to your car? 🧭', 'ParkMark navigation takes you straight there.'] },
  { tr: ['Hatırlatıcı kurdun mu, {name}? ⏰', 'Park süreni unutmamak için hatırlatıcı ayarla.'], en: ['Set a reminder yet, {name}? ⏰', 'Set a reminder so you never lose track of time.'] },
  { tr: ['{name}, park geçmişini biliyor musun? 📋', 'Son 5 park kaydına Geçmiş sekmesinden ulaşabilirsin.'], en: ['{name}, know your parking history? 📋', 'Check your last 5 parking spots in the History tab.'] },
  { tr: ['Yeni bir şehirde misin, {name}? 🗺️', 'ParkMark yabancı yerlerde bile arabanı bulmanı sağlar.'], en: ['In a new city, {name}? 🗺️', 'ParkMark helps you find your car even in unfamiliar places.'] },
  { tr: ['{name}, notunu eklemeyi unutma! 📝', 'Park yerine serbest metin notu bırakabilirsin.'], en: ['{name}, don’t forget to add a note! 📝', 'Leave a free-text note about your parking spot.'] },
  { tr: ['Bugün de arabanı kaydet, {name}! 🚙', 'Tek dokunuşla GPS konumunu kaydet, unutma riski kalmasın.'], en: ['Save your car today too, {name}! 🚙', 'One tap saves your GPS location — no more forgetting.'] },
  { tr: ['{name}, park no\'yu not aldın mı? 🔢', 'Spot numarasını eklersen aramak çok daha kolay olur.'], en: ['{name}, did you note the spot number? 🔢', 'Adding the spot number makes finding it much easier.'] },
  { tr: ['ParkMark hep yanında, {name}! 🅿️', 'AVM, hastane, havalimanı... nerede olursan ol yanındayız.'], en: ['ParkMark is always with you, {name}! 🅿️', 'Malls, hospitals, airports — we’ve got you covered.'] },
  { tr: ['{name}, arabanı bir daha kaybetme! 🚗', 'Park ettiğin anda ParkMark’ı açmayı alışkanlık haline getir.'], en: ['{name}, never lose your car again! 🚗', 'Make opening ParkMark a habit the moment you park.'] },
  { tr: ['Bugünkü park yerin güvende mi, {name}? 🔒', 'Konumunu kaydettiysen arabana her zaman dönebilirsin.'], en: ['Is today’s spot safe and sound, {name}? 🔒', 'If you saved it, you can always find your way back.'] },
  { tr: ['{name}, dil ayarını biliyor musun? 🌐', 'ParkMark’ı Türkçe veya İngilizce kullanabilirsin.'], en: ['{name}, know about the language setting? 🌐', 'You can use ParkMark in Turkish or English.'] },
  { tr: ['Navigasyon bir tık uzağında, {name}! 🧭', 'Apple Maps veya Google Maps ile arabana kolayca dön.'], en: ['Navigation is one tap away, {name}! 🧭', 'Head back to your car easily with Apple or Google Maps.'] },
  { tr: ['{name}, bugün de unutmayalım! ✅', 'Park ettiğinde hemen kaydet, sonra düşünme.'], en: ['{name}, let’s not forget today! ✅', 'Save it the moment you park — no need to think later.'] },
  { tr: ['Kalabalık otoparklarda kaybolma, {name}! 🏬', 'ParkMark ile büyük AVM otoparklarında bile arabanı bul.'], en: ['Don’t get lost in crowded lots, {name}! 🏬', 'Find your car even in huge mall parking lots with ParkMark.'] },
  { tr: ['{name}, hızlı bir hatırlatma! ⚡', 'Park yerini kaydetmek sadece birkaç saniye sürer.'], en: ['{name}, a quick reminder! ⚡', 'Saving your spot only takes a few seconds.'] },
  { tr: ['Seyahatte misin, {name}? ✈️', 'Yabancı bir şehirde bile ParkMark seni yanlış yola götürmez.'], en: ['Traveling, {name}? ✈️', 'Even in an unfamiliar city, ParkMark keeps you on track.'] },
  { tr: ['{name}, bugün arabanı kaydetmeyi unutma! 🚗', 'Küçük bir alışkanlık, büyük bir zaman kazancı.'], en: ['{name}, don’t forget to save your car today! 🚗', 'A small habit that saves a lot of time.'] },
  { tr: ['Park yerini paylaşabilirsin, {name}! 📍', 'Fotoğraf ve notlarla park detaylarını kolayca hatırla.'], en: ['You can keep detailed records, {name}! 📍', 'Photos and notes help you remember every parking detail.'] },
  { tr: ['{name}, otoparkta vakit kaybetme! ⏱️', 'Arabana en kısa yoldan ParkMark navigasyonuyla ulaş.'], en: ['{name}, don’t waste time in the lot! ⏱️', 'Get to your car the fastest way with ParkMark navigation.'] },
  { tr: ['Bugünkü hatırlatman, {name}! 🔔', 'Park ettiğin yeri kaydetmeyi unutma, arabanı hemen bul.'], en: ['Your reminder for today, {name}! 🔔', 'Don’t forget to save your spot — find your car instantly.'] },
  { tr: ['{name}, ParkMark cebinde! 📱', 'Nereye park edersen et, arabana dönüş yolu hep elinde.'], en: ['{name}, ParkMark is in your pocket! 📱', 'Wherever you park, the way back is always at hand.'] },
  { tr: ['Hafızana güvenme, {name}! 🧠', 'Park yerini not almak unutma riskini sıfıra indirir.'], en: ['Don’t rely on memory, {name}! 🧠', 'Noting your spot cuts the risk of forgetting to zero.'] },
  { tr: ['{name}, bugün de kolay gelsin! 🚘', 'ParkMark ile park etmek stresten uzak, huzurlu bir deneyim.'], en: ['{name}, have an easy day! 🚘', 'With ParkMark, parking is stress-free and worry-free.'] },
  { tr: ['Son bir hatırlatma, {name}! 🅿️', 'Arabanı kaydetmeyi unutma, ParkMark hep yanında.'], en: ['One last reminder, {name}! 🅿️', 'Don’t forget to save your car — ParkMark’s always with you.'] },
];

const SEEDS: any[] = [
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
    recurring_hour: 7,
    is_active: true,
  },
  {
    title: { tr: '{name}, hâlâ park halindesin! 🅿️', en: 'Still parked, {name}! 🅿️' },
    body: {
      tr: 'Aktif park kaydın 24 saatten uzun süredir açık. Arabanı aldıysan kaydı kapatmayı unutma.',
      en: 'Your active parking record has been open for over 24 hours. If you already picked up your car, don’t forget to close it.',
    },
    category: 'reminder',
    trigger_type: 'active_parking_hours',
    trigger_value: 24,
    recurring_hour: 7,
    is_active: true,
  },
  ...DAILY_ROTATION.map((msg, i) => ({
    title: { tr: msg.tr[0], en: msg.en[0] },
    body: { tr: msg.tr[1], en: msg.en[1] },
    category: 'reminder',
    trigger_type: 'recurring',
    trigger_value: null,
    recurring_pattern: 'monthly',
    recurring_day: i + 1, // 1-28, covers every calendar month
    recurring_hour: 7,
    is_active: true,
  })),
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  for (const s of SEEDS) {
    const exists = await ScheduledNotification.findOne({
      'title.tr': s.title.tr,
      trigger_type: s.trigger_type,
      trigger_value: s.trigger_value ?? null,
      recurring_day: s.recurring_day ?? null,
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
