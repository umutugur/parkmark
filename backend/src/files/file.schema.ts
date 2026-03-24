import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFile extends Document {
  userId: Types.ObjectId;
  fileName: string;
  cloud_storage_path: string;
  isPublic: boolean;
  contentType: string;
  createdAt: Date;
  updatedAt: Date;
}

const FileSchema = new Schema<IFile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fileName: { type: String, required: true },
    cloud_storage_path: { type: String, required: true, unique: true },
    isPublic: { type: Boolean, default: false },
    contentType: { type: String, required: true },
  },
  { timestamps: true },
);

FileSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString();
    (ret as any)._id = undefined;
    (ret as any).__v = undefined;
  },
});

FileSchema.index({ userId: 1 });

export const FileRecord = mongoose.model<IFile>('File', FileSchema);
