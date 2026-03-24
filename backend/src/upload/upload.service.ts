import { Types } from 'mongoose';
import { cloudinary } from '../lib/cloudinary';
import { FileRecord } from '../files/file.schema';

export async function generateUploadSignature(
  userId: string,
  data: { fileName: string; contentType: string; isPublic?: boolean },
) {
  const timestamp = Math.round(Date.now() / 1000);
  const folder = data.isPublic ? 'public/uploads' : 'uploads';
  const sanitizedName = data.fileName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  const publicId = `${folder}/${userId}/${timestamp}-${sanitizedName}`;

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, public_id: publicId },
    process.env.CLOUDINARY_API_SECRET!,
  );

  return {
    upload_url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
    api_key: process.env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    public_id: publicId,
    cloud_storage_path: publicId,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  };
}

export async function completeUpload(
  userId: string,
  data: { cloud_storage_path: string; fileName: string; contentType: string; isPublic?: boolean },
) {
  const file = await FileRecord.create({
    userId: new Types.ObjectId(userId),
    fileName: data.fileName,
    cloud_storage_path: data.cloud_storage_path,
    isPublic: data.isPublic ?? false,
    contentType: data.contentType,
  });

  return { id: file._id, cloud_storage_path: file.cloud_storage_path, fileName: file.fileName };
}
