/**
 * Demo kullanıcı seed scripti
 * Google/Apple review için hazır demo hesap + örnek park kayıtları oluşturur.
 *
 * Kullanım:
 *   npx ts-node src/seed.ts
 *   veya (build sonrası):
 *   node dist/seed.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './auth/user.schema';
import { ParkingRecord } from './parking/parking.schema';

const DEMO_EMAIL = 'demo@parkmark.app';
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_NAME = 'Demo User';

// İstanbul'dan örnek park noktaları
const SAMPLE_PARKING: Array<{
  latitude: number;
  longitude: number;
  address: string;
  floor?: string;
  section?: string;
  spotNumber?: string;
  notes?: string;
  isActive: boolean;
  parkedAt: Date;
}> = [
  {
    latitude: 41.0082,
    longitude: 28.9784,
    address: 'Sultanahmet Meydanı, Fatih/İstanbul',
    floor: 'B1',
    section: 'A',
    spotNumber: '42',
    notes: 'Mavi kapının yanı, asansöre yakın',
    isActive: false,
    parkedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 gün önce
  },
  {
    latitude: 41.0369,
    longitude: 28.9850,
    address: 'Taksim Meydanı, Beyoğlu/İstanbul',
    floor: 'Zemin',
    section: 'C',
    spotNumber: '17',
    notes: 'Giriş kapısının karşısı',
    isActive: false,
    parkedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 gün önce
  },
  {
    latitude: 41.0614,
    longitude: 28.9850,
    address: 'Beşiktaş Çarşısı, Beşiktaş/İstanbul',
    floor: 'B2',
    section: 'D',
    spotNumber: '88',
    isActive: false,
    parkedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 gün önce
  },
  {
    latitude: 41.0451,
    longitude: 29.0100,
    address: 'Kadıköy İskele, Kadıköy/İstanbul',
    notes: 'Sokak başı, sağ taraf',
    isActive: true, // Aktif park — haritada görünür
    parkedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 saat önce
  },
];

async function seed() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI env var bulunamadı. .env dosyasını kontrol et.');
    process.exit(1);
  }

  console.log('🔌 MongoDB\'ye bağlanılıyor...');
  await mongoose.connect(mongoUri);
  console.log('✅ Bağlantı başarılı');

  // Mevcut demo kullanıcıyı sil (idempotent)
  const existing = await User.findOne({ email: DEMO_EMAIL });
  if (existing) {
    await ParkingRecord.deleteMany({ userId: existing._id });
    await User.deleteOne({ _id: existing._id });
    console.log('♻️  Eski demo kullanıcı silindi');
  }

  // Demo kullanıcı oluştur
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
  const demoUser = await User.create({
    email: DEMO_EMAIL,
    password: hashedPassword,
    name: DEMO_NAME,
    isSubscribed: true, // Store review için premium göster
    subscriptionPlan: 'monthly',
    subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 yıl
    pinCount: SAMPLE_PARKING.length,
    marketingNotificationsEnabled: false,
  });

  console.log(`✅ Demo kullanıcı oluşturuldu: ${DEMO_EMAIL}`);

  // Örnek park kayıtları ekle
  for (const record of SAMPLE_PARKING) {
    await ParkingRecord.create({
      userId: demoUser._id,
      ...record,
    });
  }

  console.log(`✅ ${SAMPLE_PARKING.length} örnek park kaydı oluşturuldu`);

  console.log('\n─────────────────────────────────────────');
  console.log('📱 Demo hesap bilgileri (Google/Apple review için):');
  console.log(`   E-posta : ${DEMO_EMAIL}`);
  console.log(`   Şifre   : ${DEMO_PASSWORD}`);
  console.log('─────────────────────────────────────────\n');

  await mongoose.disconnect();
  console.log('🔌 Bağlantı kapatıldı');
}

seed().catch((err) => {
  console.error('❌ Seed hatası:', err);
  process.exit(1);
});
