import mongoose, { Document, Schema } from 'mongoose';

export interface IAppConfig extends Document {
  pinLimit: number;
  freemiumHours: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  minAppVersion: string;
  updatedAt: Date;
}

const AppConfigSchema = new Schema<IAppConfig>(
  {
    pinLimit: { type: Number, default: 5 },
    freemiumHours: { type: Number, default: 24 },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: '' },
    minAppVersion: { type: String, default: '1.0.0' },
  },
  { timestamps: true },
);

AppConfigSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    (ret as any)._id = undefined;
    (ret as any).__v = undefined;
  },
});

export const AppConfig = mongoose.model<IAppConfig>('AppConfig', AppConfigSchema);
