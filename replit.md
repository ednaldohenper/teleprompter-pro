# TelePrompter Pro

## Overview
Professional teleprompter application with voice recognition, script management, and PWA support for mobile use. Integrated with FOCO360 ERP for access control and usage tracking.

## Recent Changes
- 2026-03-06: Added FOCO360 integration - SSO login, direct login (email/password), usage control (check/consume on script creation), session management with PostgreSQL store, forgot/reset password, logout
- 2026-02-21: Added front-facing camera recording in teleprompter view - toggle camera, record/stop, download video
- 2026-02-21: Fixed Google Docs sync cache issue - added no-store headers and cache-busting timestamp
- 2026-02-14: Added queue/playlist feature - "Play All" button, auto-advance with 10s countdown, skip controls
- 2026-02-14: Added Google Docs integration - import docs, link scripts, auto-sync every 15s in teleprompter
- 2026-02-14: Initial MVP built with script CRUD, teleprompter view, voice recognition, PWA manifest

## Project Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + Shadcn UI
- **Backend**: Express.js with PostgreSQL (Drizzle ORM)
- **Database**: PostgreSQL with `scripts`, `user_settings`, and `session` tables
- **Auth**: FOCO360 ERP integration (SSO + direct login), express-session with connect-pg-simple
- **Routing**: Wouter (/, /teleprompter/:id)
- **State Management**: TanStack Query

## Key Features
- FOCO360 authentication (SSO via portal redirect + direct email/password login)
- Usage control: checks limits before creating scripts, consumes 1 use per creation
- Script management with numbered scripts (CRUD)
- Full-screen teleprompter with black background
- Voice recognition (Web Speech API) that follows speech pace
- Mirror mode for glass teleprompter setups
- Font size and speed controls
- File upload (.txt, .md)
- Google Docs integration (import, link, auto-sync every 15s)
- PWA support (manifest, mobile meta tags)
- Queue/playlist mode ("Play All") with 10s countdown between scripts, skip & cancel controls
- Front-facing camera recording with preview pip, record/stop, and download
- Auto-hiding controls during playback

## FOCO360 Integration
- **SSO Flow**: User clicks product in FOCO360 portal → redirected to app with `?sso_token=XXX` → token verified → session created
- **Direct Login**: Email + password form → authenticated via FOCO360 API
- **Usage Control**: Each script creation checks `/api/external/check` first, then consumes via `/api/external/consume`
- **Resource Type**: `uses` (general usage counter)
- **API Key**: Stored as `FOCO360_API_KEY` environment secret
- **Session**: PostgreSQL-backed sessions via `connect-pg-simple`, 30-day cookie

## File Structure
- `shared/schema.ts` - Database schema (scripts, userSettings)
- `server/routes.ts` - API routes (auth, scripts, settings, gdocs, usage)
- `server/foco360.ts` - FOCO360 API client (SSO, auth, check, consume, entitlements)
- `server/google-docs.ts` - Google Docs API client (auth, fetch, list)
- `server/storage.ts` - Database operations
- `client/src/pages/login-page.tsx` - Login page (email/password + forgot password)
- `client/src/pages/scripts-page.tsx` - Script management UI
- `client/src/pages/teleprompter-page.tsx` - Teleprompter view
- `client/src/hooks/use-auth.ts` - Authentication hook (login, SSO, logout, session check)
- `client/src/hooks/use-voice-scroll.ts` - Voice recognition hook
- `client/public/manifest.json` - PWA manifest

## API Endpoints
### Auth
- GET /api/auth/me - Get current session (returns 401 if not authenticated)
- POST /api/auth/sso - Verify SSO token from FOCO360 portal
- POST /api/auth/login - Direct login with email + password
- POST /api/auth/logout - End session
- POST /api/auth/forgot-password - Send password reset email
- POST /api/auth/reset-password - Reset password with token

### Usage
- GET /api/usage/check - Check if user can create (uses resourceType)
- POST /api/usage/consume - Consume a usage unit
- GET /api/usage/entitlements - Get all entitlements/limits

### Scripts (all require auth)
- GET /api/scripts - List all scripts
- GET /api/scripts/:id - Get single script
- POST /api/scripts - Create script (checks usage limit, consumes 1 use)
- PATCH /api/scripts/:id - Update script
- DELETE /api/scripts/:id - Delete script

### Settings
- GET /api/settings - Get default settings
- POST /api/settings - Update default settings

### Google Docs
- GET /api/gdocs/list - List recent Google Docs
- POST /api/gdocs/import - Import doc by URL or ID
- GET /api/gdocs/sync/:docId - Get latest doc content for live sync
