import mongoose, { Document, Schema } from 'mongoose';

export interface IAdminLog extends Document {
  adminUser: string;
  action: string;
  targetType: 'user' | 'parking' | 'config' | 'notification' | 'webhook';
  targetId?: string;
  details: Record<string, any>;
  createdAt: Date;
}

const AdminLogSchema = new Schema<IAdminLog>(
  {
    adminUser: { type: String, required: true },
    action: { type: String, required: true },
    targetType: {
      type: String,
      enum: ['user', 'parking', 'config', 'notification', 'webhook'],
      required: true,
    },
    targetId: { type: String, default: null },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

AdminLogSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    (ret as any)._id = undefined;
    (ret as any).__v = undefined;
  },
});

AdminLogSchema.index({ createdAt: -1 });
AdminLogSchema.index({ targetType: 1 });
AdminLogSchema.index({ action: 1 });

export const AdminLog = mongoose.model<IAdminLog>('AdminLog', AdminLogSchema);
