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
