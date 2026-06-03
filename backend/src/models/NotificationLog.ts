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

NotificationLogSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    (ret as any)._id = undefined;
    (ret as any).__v = undefined;
  },
});

NotificationLogSchema.index({ scheduled_notification_id: 1, sent_at: -1 });

export const NotificationLog = mongoose.model<INotificationLog>(
  'NotificationLog',
  NotificationLogSchema,
);
