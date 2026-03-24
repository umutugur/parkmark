import axios, { AxiosInstance, AxiosError } from 'axios';
import Constants from 'expo-constants';
import {
  AuthResponse,
  User,
  ParkingRecord,
  ParkingListResponse,
  CreateParkingDto,
  UpdateParkingDto,
  PresignedUploadResponse,
  FileUploadCompleteResponse,
  FileUrlResponse,
} from '../types';

const getBaseUrl = () => {
  // Önce .env'deki URL'yi kullan
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Dev modda Metro host'undan türet (fallback)
  if (__DEV__) {
    const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
    return `http://${host}:3000`;
  }
  return 'https://api.parkmark.com';
};

const API_URL = getBaseUrl();

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      transformRequest: [
        (data) => {
          if (data instanceof FormData) {
            return data;
          }
          if (data && typeof data === 'object') {
            return JSON.stringify(data);
          }
          return data;
        },
      ],
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const requestUrl = error?.config?.url ?? '';
        if (error?.response?.status === 401 && !requestUrl.includes('cloudinary.com')) {
          this.setToken(null);
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common['Authorization'];
    }
  }

  // Auth endpoints
  async signup(email: string, password: string, name: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>(
      new URL('/api/signup', API_URL).toString(),
      { email, password, name }
    );
    return response?.data ?? { token: '', user: { id: '', email: '', name: '' } };
  }

  async oauthLogin(provider: 'google' | 'apple', idToken: string, name?: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>(
      new URL('/api/auth/oauth', API_URL).toString(),
      { provider, idToken, name }
    );
    return response?.data ?? { token: '', user: { id: '', email: '', name: '' } };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>(
      new URL('/api/auth/login', API_URL).toString(),
      { email, password }
    );
    return response?.data ?? { token: '', user: { id: '', email: '', name: '' } };
  }

  async getMe(): Promise<{ user: User }> {
    const response = await this.client.get<{ user: User }>(
      new URL('/api/auth/me', API_URL).toString()
    );
    return response?.data ?? { user: { id: '', email: '', name: '' } };
  }

  async updateNotificationPrefs(prefs: {
    marketingNotificationsEnabled?: boolean;
    pushToken?: string | null;
  }): Promise<{ success: boolean }> {
    const response = await this.client.patch<{ success: boolean }>(
      new URL('/api/auth/notification-prefs', API_URL).toString(),
      prefs
    );
    return response?.data ?? { success: false };
  }

  // Parking endpoints
  async createParking(data: CreateParkingDto): Promise<ParkingRecord> {
    const response = await this.client.post<ParkingRecord>(
      new URL('/api/parking', API_URL).toString(),
      data
    );
    return response?.data ?? {} as ParkingRecord;
  }

  async getParkingList(params?: {
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<ParkingListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.isActive !== undefined) queryParams.append('isActive', String(params.isActive));
    if (params?.page !== undefined) queryParams.append('page', String(params.page));
    if (params?.limit !== undefined) queryParams.append('limit', String(params.limit));

    const url = new URL('/api/parking', API_URL);
    url.search = queryParams.toString();

    const response = await this.client.get<ParkingListResponse>(url.toString());
    return response?.data ?? { items: [], total: 0, page: 1, totalPages: 0 };
  }

  async getParkingById(id: string): Promise<ParkingRecord> {
    const response = await this.client.get<ParkingRecord>(
      new URL(`/api/parking/${id}`, API_URL).toString()
    );
    return response?.data ?? {} as ParkingRecord;
  }

  async updateParking(id: string, data: UpdateParkingDto): Promise<ParkingRecord> {
    const response = await this.client.put<ParkingRecord>(
      new URL(`/api/parking/${id}`, API_URL).toString(),
      data
    );
    return response?.data ?? {} as ParkingRecord;
  }

  async deleteParking(id: string): Promise<{ success: boolean }> {
    const response = await this.client.delete<{ success: boolean }>(
      new URL(`/api/parking/${id}`, API_URL).toString()
    );
    return response?.data ?? { success: false };
  }

  // File upload endpoints
  async getPresignedUploadUrl(
    fileName: string,
    contentType: string,
    isPublic = false
  ): Promise<PresignedUploadResponse> {
    const response = await this.client.post<PresignedUploadResponse>(
      new URL('/api/upload/presigned', API_URL).toString(),
      { fileName, contentType, isPublic }
    );
    return response?.data ?? { upload_url: '', api_key: '', timestamp: 0, signature: '', public_id: '', cloud_name: '' };
  }

  async uploadFileToCloudinary(
    presignedData: PresignedUploadResponse,
    file: { uri: string; name: string },
    contentType: string
  ): Promise<{ secure_url: string }> {
    const formData = new FormData();
    formData.append('file', { uri: file.uri, type: contentType, name: file.name } as any);
    formData.append('api_key', presignedData.api_key);
    formData.append('timestamp', String(presignedData.timestamp));
    formData.append('signature', presignedData.signature);
    formData.append('public_id', presignedData.public_id);

    const response = await axios.post(presignedData.upload_url, formData);
    return { secure_url: response.data.secure_url };
  }

  async completeFileUpload(
    cloudStoragePath: string,
    fileName: string,
    contentType: string,
    isPublic = false
  ): Promise<FileUploadCompleteResponse> {
    const response = await this.client.post<FileUploadCompleteResponse>(
      new URL('/api/upload/complete', API_URL).toString(),
      { cloud_storage_path: cloudStoragePath, fileName, contentType, isPublic }
    );
    return response?.data ?? { id: '', cloud_storage_path: '', fileName: '' };
  }

  async getFileUrl(fileId: string, mode: 'view' | 'download' = 'view'): Promise<FileUrlResponse> {
    const url = new URL(`/api/files/${fileId}/url`, API_URL);
    url.searchParams.append('mode', mode);

    const response = await this.client.get<FileUrlResponse>(url.toString());
    return response?.data ?? { url: '' };
  }

  async deleteFile(fileId: string): Promise<{ success: boolean }> {
    const response = await this.client.delete<{ success: boolean }>(
      new URL(`/api/files/${fileId}`, API_URL).toString()
    );
    return response?.data ?? { success: false };
  }

  async activateFreemium(): Promise<{ success: boolean; freemiumExpiresAt: string }> {
    const response = await this.client.post<{ success: boolean; freemiumExpiresAt: string }>(
      new URL('/api/auth/freemium', API_URL).toString()
    );
    return response?.data ?? { success: false, freemiumExpiresAt: '' };
  }
}

export const apiService = new ApiService();
