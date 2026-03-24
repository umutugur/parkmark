# ParkMark UX Specification

## Design Direction

### Theme
Dark theme with parking-inspired palette:
- **Background**: Dark asphalt grays `#1A1F2E` (primary bg), `#232A3B` (card bg), `#0F1320` (deepest bg)
- **Primary**: Parking Yellow `#FFC107` — used for CTAs, active states, pin markers
- **Accent**: Signal Blue `#2196F3` — used for links, secondary actions, navigation elements
- **Surface**: `#2C3E50` — cards, elevated surfaces
- **Text Primary**: `#F5F5F5` (not pure white)
- **Text Secondary**: `#94A3B8`
- **Success**: `#4CAF50` — active parking indicator
- **Error/Delete**: `#EF4444`

### Color Application
- Gradient buttons: `[#FFC107, #FFD54F]` for primary actions, `[#2196F3, #42A5F5]` for secondary
- Glass-effect cards with `rgba(44, 62, 80, 0.6)` + backdrop blur
- Map overlay elements use semi-transparent dark backgrounds
- Yellow accent pin icon on map for saved parking

### Typography
- **Display/Heading**: `Poppins` (Google Fonts) — Bold/SemiBold
- **Body**: `Nunito Sans` (Google Fonts) — Regular/Medium
- Display: 32px, Heading: 22px, Subheading: 18px, Body: 16px, Caption: 13px

### Backgrounds
- Main screens: subtle gradient from `#0F1320` to `#1A1F2E`
- Cards: frosted glass with `#232A3B` at 70% opacity

---

## Screens

### 1. Splash Screen
- **Purpose**: Brand introduction on app launch
- **Layout**: Centered vertically
  - ParkMark logo: stylized "P" with a map pin integrated, yellow `#FFC107` on dark bg
  - App name "ParkMark" in Poppins Bold 36px, yellow
  - Tagline below in Nunito Sans 14px, `#94A3B8`: localized "Never lose your car again" / "Arabanızı bir daha kaybetmeyin"
- **Animation**: Logo scales from 0.5→1.0 with spring, then subtle pulse. Fade to next screen after 2s.
- **Logic**: Check auth token → if valid, navigate to Home; if first launch, navigate to Onboarding; else navigate to Login.

### 2. Onboarding Screen
- **Purpose**: First-launch tutorial (3 slides)
- **Layout**: Full-screen swipeable pages with dot indicators at bottom
  - **Slide 1**: Map pin illustration + "Save your parking spot instantly" / "Park yerinizi anında kaydedin"
  - **Slide 2**: Camera illustration + "Add photos and notes" / "Fotoğraf ve not ekleyin"
  - **Slide 3**: Bell illustration + "Set reminders so you never forget" / "Hatırlatıcı kurun, asla unutmayın"
- **Elements**:
  - Each slide: illustration (Lottie or static SVG), title (Poppins SemiBold 24px), subtitle (Nunito 16px `#94A3B8`)
  - Skip button top-right (text button, `#94A3B8`)
  - Next button bottom (yellow gradient pill)
  - Last slide: "Get Started" / "Başla" button → navigates to Login
- **Animation**: Horizontal slide transitions, dot indicator animates width on active

### 3. Login / Signup Screen
- **Purpose**: Email/password authentication
- **Layout**: Single screen with toggle between Login and Signup tabs
  - Top: ParkMark logo small (48px) + app name
  - Tab bar: "Login" / "Sign Up" with yellow underline indicator
  - **Login tab**: Email input, Password input, "Login" / "Giriş Yap" gradient yellow button, forgot password text link
  - **Signup tab**: Name input, Email input, Password input, Confirm Password input, "Sign Up" / "Kayıt Ol" gradient yellow button
  - Bottom: language toggle mini-button (🇹🇷/🇬🇧 flag icons)
- **Inputs**: Floating labels, dark surface `#232A3B` fill, yellow border on focus, error shake + red border on validation fail
- **Actions**: On success → navigate to Home. On signup success → auto-login → Home.
- **States**: Button shows loading spinner when submitting. Error toast on failure.

### 4. Home Screen (Map View)
- **Purpose**: Primary screen showing map with current location and active parking marker
- **Layout**:
  - **Full-screen map** (react-native-maps) as background
  - **Top bar** (glass effect): ParkMark logo left, settings gear icon right
  - **Current location**: Blue dot (default map behavior)
  - **Active parking marker**: Custom yellow pin with car icon, pulsing ring animation if active parking exists
  - **Bottom floating card** (glass effect, rounded 20px top):
    - If active parking exists:
      - "Your Car is Parked" / "Arabanız Park Edildi" title
      - Address text (truncated)
      - Timer showing elapsed time since parkedAt
      - Two buttons: "Navigate" / "Yol Tarifi" (blue gradient) and "Details" / "Detaylar" (outline yellow)
    - If no active parking:
      - "No active parking" / "Aktif park yok" message
      - Large "Park Here" / "Buraya Park Et" yellow gradient button (full width, 56px height)
  - **FAB** (bottom-right, above card): History icon → navigates to Parking History
- **Actions**:
  - Tap "Park Here" → navigate to Save Parking Screen
  - Tap "Navigate" → open device map app with coordinates (Google Maps / Apple Maps intent)
  - Tap "Details" → navigate to Parking Detail for active record
  - Tap parking marker on map → show info popup with quick actions
  - Tap settings icon → navigate to Settings
  - Tap history FAB → navigate to Parking History
- **Animation**: Bottom card slides up on load. Marker drops with bounce.

### 5. Save Parking Screen
- **Purpose**: Capture parking location with optional photo, notes, and reminder
- **Layout**: Scrollable screen with sections
  - **Header**: Back arrow + "Save Parking" / "Park Kaydet" title
  - **Mini map** (200px height, rounded 16px): Shows current GPS location with draggable pin. Address text below auto-resolved.
  - **Photo section**:
    - Horizontal area: tap to add photo (camera icon + "Add Photo" / "Fotoğraf Ekle")
    - Options: Take Photo or Choose from Gallery (bottom sheet picker)
    - Photo preview thumbnail (120x120, rounded 12px) with X to remove
  - **Details section** (glass card):
    - Floor input (text, optional): floating label "Floor" / "Kat"
    - Section input (text, optional): floating label "Section" / "Bölüm"
    - Spot Number input (text, optional): floating label "Spot #" / "Park No"
    - Notes input (multiline, 3 rows, optional): floating label "Notes" / "Notlar"
  - **Reminder section** (glass card):
    - Toggle: "Set Reminder" / "Hatırlatıcı Kur" with switch
    - When enabled: duration picker (preset chips: 30min, 1h, 2h, 4h, Custom)
    - Custom opens time picker
  - **Save button**: Full-width yellow gradient, "Save Parking" / "Parkı Kaydet", 56px height
- **Actions**:
  - Save: upload photo if present (presigned URL flow), then POST parking record, navigate to Home
  - Back: confirm discard if form has data
- **Animation**: Sections stagger fade-in on mount

### 6. Parking History Screen
- **Purpose**: List of all past and current parking records
- **Layout**:
  - **Header**: Back arrow + "Parking History" / "Park Geçmişi" title
  - **Filter chips**: "All" / "Active" / "Past" horizontal scroll
  - **List** (@shopify/flash-list):
    - Each item: glass card with:
      - Left: photo thumbnail (60x60 rounded 10px) or car icon placeholder
      - Center: address (1 line truncated), date+time (caption), floor/section if present
      - Right: yellow dot if active, chevron
    - Swipe left to delete (red background with trash icon)
  - **Empty state**: Car illustration + "No parking records yet" / "Henüz park kaydı yok" + "Park your car to get started" subtitle
- **Actions**: Tap item → navigate to Parking Detail. Swipe delete → confirm dialog → DELETE.
- **Animation**: Staggered fade-in for list items. Swipe-to-delete with haptic.

### 7. Parking Detail Screen
- **Purpose**: Full details of a parking record with actions
- **Layout**: Scrollable
  - **Header**: Back arrow + "Parking Details" / "Park Detayları" + edit icon (pencil) top-right
  - **Map section** (250px, rounded 16px bottom): Shows parking pin location, non-interactive
  - **Address card** (glass): Full address text, coordinates caption
  - **Photo** (if exists): Full-width image (rounded 16px, 200px height), tap to view fullscreen
  - **Info card** (glass): Grid layout
    - Parked at: date/time
    - Duration: elapsed or total
    - Floor: value or "—"
    - Section: value or "—"
    - Spot: value or "—"
  - **Notes card** (glass, if notes exist): Notes text
  - **Reminder card** (glass, if reminder set): Reminder time, status (pending/sent)
  - **Action buttons** (bottom fixed):
    - "Navigate" / "Yol Tarifi" — blue gradient, full width
    - "Delete" / "Sil" — red outline, below navigate button
- **Edit mode**: Tap pencil → navigate to Save Parking Screen pre-filled with record data (reuse screen in edit mode)
- **Actions**: Navigate opens map app. Delete shows confirm dialog → DELETE → back to History.

### 8. Settings Screen
- **Purpose**: App preferences, language, profile, logout
- **Layout**: Scrollable list of sections
  - **Header**: Back arrow + "Settings" / "Ayarlar"
  - **Profile section** (glass card): User avatar placeholder (initials circle, yellow bg), name, email
  - **Language section** (glass card):
    - "Language" / "Dil" label
    - Two selectable rows: 🇬🇧 English (with checkmark if active), 🇹🇷 Türkçe (with checkmark if active)
    - Selecting changes app language immediately
  - **About section** (glass card):
    - App version
    - "About ParkMark" row
  - **Logout button**: Red text button at bottom, "Logout" / "Çıkış Yap"
- **Actions**: Language change updates context and persists to AsyncStorage. Logout clears token → navigate to Login.

---

## Navigation

### Structure
- **Root**: expo-router file-based
- **Unauthenticated stack** (`/auth/`):
  - `auth/onboarding` — Onboarding (shown once)
  - `auth/login` — Login/Signup
- **Authenticated stack** (`/(app)/`):
  - `(app)/index` — Home (Map View)
  - `(app)/save-parking` — Save Parking (also used for edit with `?id=<uuid>` param)
  - `(app)/history` — Parking History
  - `(app)/parking/[id]` — Parking Detail
  - `(app)/settings` — Settings
- **Auth guard**: Layout checks token in context. No token → redirect to `/auth/login`. Token present → redirect to `/(app)/`.
- **Splash logic**: In root layout, check stored token + first-launch flag.

### Transitions
- Stack push: slide from right (iOS style)
- Modal screens (none currently)
- Bottom sheets: photo picker, delete confirmation

---

## Localization
- Use `i18next` + `react-i18next` with `expo-localization` for auto-detection
- Two locale files: `en.json`, `tr.json`
- Auto-detect: check `Localization.locale` — if starts with `tr`, use Turkish; else English
- Manual override stored in AsyncStorage, applied on app start
- All visible strings must use translation keys

---

## Animation & Motion
- **Splash**: Logo scale spring + fade transition
- **Onboarding**: Horizontal page swipe with parallax on illustrations
- **Map markers**: Drop animation with bounce
- **Bottom card on Home**: Slide up with spring
- **Save button**: Scale 0.97 on press + haptic
- **List items**: Staggered fade-in (50ms delay each)
- **Loading states**: Skeleton shimmer on history list, map loading
- **Timer on Home card**: Animated counting (update every second)
- **Respect reduced motion**: Check `AccessibilityInfo.isReduceMotionEnabled`

---

## Component Standards
- All buttons: gradient fill (yellow or blue), rounded 12px, 56px height for primary, 44px for secondary
- Inputs: `#232A3B` fill, 1px border `#2C3E50`, yellow `#FFC107` on focus, rounded 12px, 52px height
- Cards: rounded 16px, glass effect `rgba(35,42,59,0.7)` + backdrop blur 20
- Touch targets: minimum 44pt
- Accessibility: all icons have accessible labels, contrast ratios verified
- 8pt spacing grid throughout
