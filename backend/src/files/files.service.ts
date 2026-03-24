import { Types } from 'mongoose';
import { cloudinary } from '../lib/cloudinary';
import { FileRecord } from './file.schema';

export async function getFileUrl(userId: string, fileId: string) {
  if (!Types.ObjectId.isValid(fileId)) {
    throw { statusCode: 404, message: 'File not found' };
  }

  const file = await FileRecord.findById(fileId);
  if (!file) {
    throw { statusCode: 404, message: 'File not found' };
  }
  if (file.userId.toString() !== userId) {
    throw { statusCode: 403, message: 'You do not have access to this file' };
  }

  let url: string;
  if (file.isPublic) {
    url = cloudinary.url(file.cloud_storage_path, { resource_type: 'auto', secure: true });
  } else {
    url = cloudinary.url(file.cloud_storage_path, {
      resource_type: 'auto',
      secure: true,
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
  }

  return { url };
}

export async function deleteFile(userId: string, fileId: string) {
  if (!Types.ObjectId.isValid(fileId)) {
    throw { statusCode: 404, message: 'File not found' };
  }

  const file = await FileRecord.findById(fileId);
  if (!file) {
    throw { statusCode: 404, message: 'File not found' };
  }
  if (file.userId.toString() !== userId) {
    throw { statusCode: 403, message: 'You do not have access to this file' };
  }

  try {
    await cloudinary.uploader.destroy(file.cloud_storage_path, { resource_type: 'auto' });
  } catch (error) {
    console.error(`Failed to delete file from Cloudinary: ${file.cloud_storage_path}`, error);
  }

  await file.deleteOne();
  console.log(`File deleted: ${fileId}`);
  return { success: true };
}
