import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IParkingRecord extends Document {
  userId: Types.ObjectId;
  latitude: number;
  longitude: number;
  address?: string;
  photoCloudStoragePath?: string;
  photoIsPublic: boolean;
  notes?: string;
  floor?: string;
  section?: string;
  spotNumber?: string;
  parkedAt: Date;
  reminderTime?: Date | null;
  reminderSent: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ParkingRecordSchema = new Schema<IParkingRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, default: null },
    photoCloudStoragePath: { type: String, default: null },
    photoIsPublic: { type: Boolean, default: false },
    notes: { type: String, default: null },
    floor: { type: String, default: null },
    section: { type: String, default: null },
    spotNumber: { type: String, default: null },
    parkedAt: { type: Date, required: true },
    reminderTime: { type: Date, default: null },
    reminderSent: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

ParkingRecordSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    (ret as any)._id = undefined;
    (ret as any).__v = undefined;
  },
});

ParkingRecordSchema.index({ userId: 1 });
ParkingRecordSchema.index({ userId: 1, isActive: 1 });
ParkingRecordSchema.index({ reminderTime: 1, reminderSent: 1 });

export const ParkingRecord = mongoose.model<IParkingRecord>('ParkingRecord', ParkingRecordSchema);
