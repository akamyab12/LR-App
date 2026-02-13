# Lead Intel Scan - Project Summary

## Overview
Lead Intel Scan is an Expo Router mobile app prototype focused on conference lead capture and prioritization.  
It includes a camera-based capture flow, lead list/detail views, an AI-priority view, and a settings page.

## Implemented Navigation
- Bottom tabs: `Capture`, `Leads`, `Priority`, `Settings`
- Leads tab uses a nested stack:
  - `LeadsList` -> `LeadDetail`

## Implemented Screens
- **Capture**
  - Camera permission request (`expo-camera`)
  - Live camera preview
  - QR scan handling with decoded value toast/card
  - Flash toggle
  - Audio note recording (`expo-av`) with mic permission and saved recording URI display
- **Leads**
  - Search input UI
  - Stat cards (Total Leads, Hot Leads)
  - Lead cards with score, stars, badges, follow-up date
  - Tap to open lead detail
- **Lead Detail**
  - Header with back, lead identity, hot badge, star rating
  - Quick tags (toggle-only UI)
  - Follow-up row (UI)
  - Conversation notes card (UI)
  - AI Insights section (mock content)
  - Priority score card and save button (UI)
- **Priority**
  - Ranked lead cards with score, stars, and highlights
- **Settings**
  - Account/user card
  - Edit Profile and Sign Out rows (no-op)
  - Current Event summary card

## Data and Types
- `lib/types.ts` defines lead-related types (`Lead`, `LeadTag`, `PriorityLead`, etc.)
- `lib/api.ts` provides placeholder async fetchers returning hardcoded mock data
- No Supabase auth/backend wiring yet (intentionally deferred)

## Key Files
- Navigation:
  - `app/_layout.tsx`
  - `app/(tabs)/_layout.tsx`
  - `app/(tabs)/leads/_layout.tsx`
- Screens:
  - `screens/CaptureScreen.tsx`
  - `screens/LeadsScreen.tsx`
  - `screens/LeadDetailScreen.tsx`
  - `screens/PriorityScreen.tsx`
  - `screens/SettingsScreen.tsx`
- Shared:
  - `components/StarRating.tsx`
  - `lib/types.ts`
  - `lib/api.ts`

## Run and Verify
- Start app: `npx expo start`
- Type check: `npx tsc --noEmit`
