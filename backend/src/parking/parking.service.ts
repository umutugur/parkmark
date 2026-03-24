import { Types } from 'mongoose';
import { ParkingRecord } from './parking.schema';
import { User } from '../auth/user.schema';

export async function create(userId: string, data: any) {
  const user = await User.findById(userId);
  if (!user) throw { statusCode: 404, message: 'User not found' };

  const now = new Date();
  const hasActiveSubscription = user.isSubscribed && user.subscriptionExpiresAt != null && user.subscriptionExpiresAt > now;
  const hasActiveFreemium = user.freemiumExpiresAt != null && user.freemiumExpiresAt > now;

  if (!hasActiveSubscription && !hasActiveFreemium && user.pinCount >= 5) {
    throw { statusCode: 403, message: 'PIN_LIMIT_REACHED' };
  }

  // Deactivate all previous active records for this user
  await ParkingRecord.updateMany(
    { userId: new Types.ObjectId(userId), isActive: true },
    { isActive: false },
  );

  const parking = await ParkingRecord.create({
    userId: new Types.ObjectId(userId),
    latitude: data.latitude,
    longitude: data.longitude,
    address: data.address,
    photoCloudStoragePath: data.photoCloudStoragePath,
    photoIsPublic: data.photoIsPublic ?? false,
    notes: data.notes,
    floor: data.floor,
    section: data.section,
    spotNumber: data.spotNumber,
    parkedAt: new Date(data.parkedAt),
    reminderTime: data.reminderTime ? new Date(data.reminderTime) : null,
    reminderSent: data.reminderSent ?? false,
    isActive: true,
  });

  user.pinCount = (user.pinCount ?? 0) + 1;
  await user.save();

  console.log(`Parking record created for user ${userId}: ${parking._id}`);
  return parking;
}

export async function findAll(userId: string, query: any) {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const skip = (page - 1) * limit;

  const filter: any = { userId: new Types.ObjectId(userId) };
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true';
  }

  const [items, total] = await Promise.all([
    ParkingRecord.find(filter).sort({ parkedAt: -1 }).skip(skip).limit(limit),
    ParkingRecord.countDocuments(filter),
  ]);

  return { items, total, page, totalPages: Math.ceil(total / limit) };
}

export async function findOne(userId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw { statusCode: 404, message: 'Parking record not found' };
  }

  const parking = await ParkingRecord.findById(id);
  if (!parking) {
    throw { statusCode: 404, message: 'Parking record not found' };
  }
  if (parking.userId.toString() !== userId) {
    throw { statusCode: 403, message: 'You do not have access to this parking record' };
  }

  return parking;
}

export async function update(userId: string, id: string, data: any) {
  const parking = await findOne(userId, id);

  const updates: any = {};
  const fields = [
    'latitude', 'longitude', 'address', 'photoCloudStoragePath', 'photoIsPublic',
    'notes', 'floor', 'section', 'spotNumber', 'reminderSent', 'isActive',
  ];
  for (const field of fields) {
    if (data[field] !== undefined) updates[field] = data[field];
  }
  if (data.parkedAt !== undefined) updates.parkedAt = new Date(data.parkedAt);
  if (data.reminderTime !== undefined) {
    updates.reminderTime = data.reminderTime ? new Date(data.reminderTime) : null;
  }

  Object.assign(parking, updates);
  await parking.save();

  console.log(`Parking record updated: ${id}`);
  return parking;
}

export async function remove(userId: string, id: string) {
  const parking = await findOne(userId, id);
  await parking.deleteOne();
  console.log(`Parking record deleted: ${id}`);
  return { success: true };
}
