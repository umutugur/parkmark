# ParkMark API Specification

Base URL: `/api`

## Authentication

| Method | Path | Request Body | Response Body | Auth |
|--------|------|-------------|---------------|------|
| POST | /api/signup | {email: string (required), password: string (required), name: string (required)} | {token: string, user: {id: UUID, email: string, name: string}} | No |
| POST | /api/auth/login | {email: string (required), password: string (required)} | {token: string, user: {id: UUID, email: string, name: string}} | No |
| GET | /api/auth/me | — | {user: {id: UUID, email: string, name: string}} | Bearer |

## Parking Records

| Method | Path | Request Body | Response Body | Auth |
|--------|------|-------------|---------------|------|
| POST | /api/parking | {latitude: number (required), longitude: number (required), address: string (optional), photoCloudStoragePath: string (optional), photoIsPublic: boolean (optional, default false), notes: string (optional), floor: string (optional), section: string (optional), spotNumber: string (optional), parkedAt: ISO8601 (required), reminderTime: ISO8601 \| null (optional), reminderSent: boolean (optional, default false)} | {id: UUID, userId: UUID, latitude: number, longitude: number, address: string \| null, photoCloudStoragePath: string \| null, photoIsPublic: boolean, notes: string \| null, floor: string \| null, section: string \| null, spotNumber: string \| null, parkedAt: ISO8601, reminderTime: ISO8601 \| null, reminderSent: boolean, isActive: boolean, createdAt: ISO8601, updatedAt: ISO8601} | Bearer |
| GET | /api/parking | query: ?isActive=boolean&page=integer&limit=integer | {items: ParkingRecord[], total: integer, page: integer, totalPages: integer} | Bearer |
| GET | /api/parking/:id | — | {id: UUID, userId: UUID, latitude: number, longitude: number, address: string \| null, photoCloudStoragePath: string \| null, photoIsPublic: boolean, notes: string \| null, floor: string \| null, section: string \| null, spotNumber: string \| null, parkedAt: ISO8601, reminderTime: ISO8601 \| null, reminderSent: boolean, isActive: boolean, createdAt: ISO8601, updatedAt: ISO8601} | Bearer |
| PUT | /api/parking/:id | {latitude: number (optional), longitude: number (optional), address: string (optional), photoCloudStoragePath: string \| null (optional), photoIsPublic: boolean (optional), notes: string \| null (optional), floor: string \| null (optional), section: string \| null (optional), spotNumber: string \| null (optional), reminderTime: ISO8601 \| null (optional), reminderSent: boolean (optional), isActive: boolean (optional)} | {id: UUID, userId: UUID, latitude: number, longitude: number, address: string \| null, photoCloudStoragePath: string \| null, photoIsPublic: boolean, notes: string \| null, floor: string \| null, section: string \| null, spotNumber: string \| null, parkedAt: ISO8601, reminderTime: ISO8601 \| null, reminderSent: boolean, isActive: boolean, createdAt: ISO8601, updatedAt: ISO8601} | Bearer |
| DELETE | /api/parking/:id | — | {success: boolean} | Bearer |

### Notes on Parking Endpoints
- `isActive` field: when a new parking is created, `isActive` defaults to `true`. Previous active parking for the user is automatically set to `isActive: false`.
- GET /api/parking returns records sorted by `parkedAt` descending.
- Only records belonging to the authenticated user are accessible.

## File Upload (Cloud Storage)

| Method | Path | Request Body | Response Body | Auth |
|--------|------|-------------|---------------|------|
| POST | /api/upload/presigned | {fileName: string (required), contentType: string (required), isPublic: boolean (optional, default false)} | {uploadUrl: string, cloud_storage_path: string} | Bearer |
| POST | /api/upload/complete | {cloud_storage_path: string (required), fileName: string (required), contentType: string (required), isPublic: boolean (optional, default false)} | {id: UUID, cloud_storage_path: string, fileName: string} | Bearer |
| GET | /api/files/:id/url | query: ?mode=view\|download | {url: string} | Bearer |
| DELETE | /api/files/:id | — | {success: boolean} | Bearer |

## Error Responses

All endpoints return errors in format:
```json
{
  "statusCode": integer,
  "message": string,
  "error": string
}
```

Common status codes:
- 400: Validation error
- 401: Unauthorized (missing/invalid token)
- 403: Forbidden (accessing another user's resource)
- 404: Resource not found
- 500: Internal server error
