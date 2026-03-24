export interface User {
  id: string;
  email: string;
  name: string;
  isSubscribed?: boolean;
  subscriptionPlan?: 'monthly' | 'sixMonth' | 'yearly' | null;
  subscriptionExpiresAt?: string | null;
  freemiumExpiresAt?: string | null;
  pinCount?: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ParkingRecord {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  address: string | null;
  photoCloudStoragePath: string | null;
  photoIsPublic: boolean;
  notes: string | null;
  floor: string | null;
  section: string | null;
  spotNumber: string | null;
  parkedAt: string;
  reminderTime: string | null;
  reminderSent: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParkingListResponse {
  items: ParkingRecord[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CreateParkingDto {
  latitude: number;
  longitude: number;
  address?: string;
  photoCloudStoragePath?: string;
  photoIsPublic?: boolean;
  notes?: string;
  floor?: string;
  section?: string;
  spotNumber?: string;
  parkedAt: string;
  reminderTime?: string | null;
}

export interface UpdateParkingDto {
  latitude?: number;
  longitude?: number;
  address?: string;
  photoCloudStoragePath?: string | null;
  photoIsPublic?: boolean;
  notes?: string | null;
  floor?: string | null;
  section?: string | null;
  spotNumber?: string | null;
  reminderTime?: string | null;
  reminderSent?: boolean;
  isActive?: boolean;
}

export interface PresignedUploadResponse {
  upload_url: string;
  api_key: string;
  timestamp: number;
  signature: string;
  public_id: string;
  cloud_name: string;
}

export interface FileUploadCompleteResponse {
  id: string;
  cloud_storage_path: string;
  fileName: string;
}

export interface FileUrlResponse {
  url: string;
}
