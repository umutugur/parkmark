# ParkMark Database Schema

## Entity: User

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK, auto-generated (default uuid) |
| email | String | Unique, required, indexed |
| password | String | Required, bcrypt hashed |
| name | String | Required |
| createdAt | DateTime | Auto (default now) |
| updatedAt | DateTime | Auto (updatedAt) |

## Entity: ParkingRecord

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK, auto-generated (default uuid) |
| userId | UUID | FK → User.id, required, indexed, onDelete: CASCADE |
| latitude | Float | Required |
| longitude | Float | Required |
| address | String? | Optional |
| photoCloudStoragePath | String? | Optional |
| photoIsPublic | Boolean | Default false |
| notes | String? | Optional (text/long string) |
| floor | String? | Optional |
| section | String? | Optional |
| spotNumber | String? | Optional |
| parkedAt | DateTime | Required |
| reminderTime | DateTime? | Optional |
| reminderSent | Boolean | Default false |
| isActive | Boolean | Default true, indexed |
| createdAt | DateTime | Auto (default now) |
| updatedAt | DateTime | Auto (updatedAt) |

### Indexes
- `userId` — for filtering by user
- `userId, isActive` — composite index for quickly finding active parking
- `reminderTime, reminderSent` — composite index for reminder job queries

## Entity: File

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUID | PK, auto-generated (default uuid) |
| userId | UUID | FK → User.id, required, indexed, onDelete: CASCADE |
| fileName | String | Required, original file name |
| cloud_storage_path | String | Required, unique |
| isPublic | Boolean | Default false |
| contentType | String | Required, MIME type |
| createdAt | DateTime | Auto (default now) |

## Relationships

- **User** 1 → N **ParkingRecord**: A user has many parking records
- **User** 1 → N **File**: A user has many uploaded files

## Prisma Schema Notes

```prisma
model User {
  id             String          @id @default(uuid())
  email          String          @unique
  password       String
  name           String
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  parkingRecords ParkingRecord[]
  files          File[]
}

model ParkingRecord {
  id                    String    @id @default(uuid())
  userId                String
  latitude              Float
  longitude             Float
  address               String?
  photoCloudStoragePath String?
  photoIsPublic         Boolean   @default(false)
  notes                 String?
  floor                 String?
  section               String?
  spotNumber            String?
  parkedAt              DateTime
  reminderTime          DateTime?
  reminderSent          Boolean   @default(false)
  isActive              Boolean   @default(true)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, isActive])
  @@index([reminderTime, reminderSent])
}

model File {
  id                 String   @id @default(uuid())
  userId             String
  fileName           String
  cloud_storage_path String   @unique
  isPublic           Boolean  @default(false)
  contentType        String
  createdAt          DateTime @default(now())
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```
