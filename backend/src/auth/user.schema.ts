import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string | null;
  name: string;
  googleId: string | null;
  appleId: string | null;
  isSubscribed: boolean;
  subscriptionPlan: 'monthly' | 'sixMonth' | 'yearly' | null;
  subscriptionExpiresAt: Date | null;
  freemiumExpiresAt: Date | null;
  pinCount: number;
  pushToken: string | null;
  marketingNotificationsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    googleId: { type: String, default: null, sparse: true },
    appleId: { type: String, default: null, sparse: true },
    isSubscribed: { type: Boolean, default: false },
    subscriptionPlan: { type: String, enum: ['monthly', 'sixMonth', 'yearly'], default: null },
    subscriptionExpiresAt: { type: Date, default: null },
    freemiumExpiresAt: { type: Date, default: null },
    pinCount: { type: Number, default: 0 },
    pushToken: { type: String, default: null },
    marketingNotificationsEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

UserSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    (ret as any)._id = undefined;
    (ret as any).__v = undefined;
  },
});

UserSchema.index({ email: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
