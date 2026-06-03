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
    key: { type: String, required: true, trim: true, maxlength: 255, unique: true },
    sentAt: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { versionKey: false },
);

CronNotificationLogSchema.index({ task: 1, userId: 1, sentAt: -1 });

export const CronNotificationLog = mongoose.model<ICronNotificationLog>(
  'CronNotificationLog',
  CronNotificationLogSchema,
);
