# AerialDeck - Project Notes (Updated 18 Feb 2026)

## Architecture
- **Backend:** Node.js + Express 5.2.1, deployed as Vercel serverless function (60s max duration)
- **Frontend:** Single-page vanilla JS app (`public/index.html`, ~5450 lines) with Leaflet.js maps
- **Database:** Supabase PostgreSQL + Storage
- **Auth:** Cookie-session with password from env var
- **Repo:** github.com/aerialireland/AerialDeck (branch: main)
- **Live URL:** https://aerialdeck-2026.vercel.app
- **Local path:** /Users/roc/Documents/AERIAL/AerialDeck/

## Credentials
- **Supabase URL:** https://xvevvssehmtbpkcztzmj.supabase.co
- **Supabase Anon Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZXZ2c3NlaG10YnBrY3p0em1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDAxMzMsImV4cCI6MjA4NTYxNjEzM30._ed3mYbiO_9XkxFus6-c5Io_Tp3WXkc_OzvE8qWIa1c
- **GitHub Token:** stored locally in `.git/config` remote URL on Rob's Mac — regenerate at https://github.com/settings/tokens if expired
- **Vercel Project:** aerialdeck-2026 (prj_CA5iWw5mcZS9YnXSoe7IJBBk3nvV)
- **DJI API Key:** 51046734706f5acff8ffd5657bb5774 (App ID: 179118)
- **Storage Buckets:** `aerialdeck-files`, `dji-uploads`

## Key Files
- `server.js` (~1568 lines) - Express API server with all routes
- `public/index.html` (~5804 lines) - Entire frontend SPA
- `database/supabase.js` - Supabase client config
- `vercel.json` - Vercel deployment config (functions + rewrites)
- `package.json` - Dependencies (dji-log-parser-js, express, multer, csv-parse, etc.)

## Database Tables (Supabase)

### flight_plans
id, name, date, location, geozone, max_altitude, status, evidence (JSONB)

### flight_logs
id, flight_plan_id (FK), date_time_utc, air_time_minutes, pic, assistant, drone, battery, flight_mode (C/N/S), fts_activation (0/1), latitude, longitude, takeoff_landing_address, accident_or_incident, defects_or_rectification, repairs_changes, gps_track (JSONB array of {lat,lon,alt,time}), created_at

### pilots
id, code, name, role (Pilot/Chief Pilot), license_number, license_expiry, a2_cert_number, a2_cert_expiry, sts_cert_number, sts_cert_expiry, medical_expiry, active, created_at, updated_at

### drones
id, name, manufacturer, model, serial_number, registration_number, purchase_date, status (Active/Inactive/Not Purchased), notes, created_at, updated_at

### batteries
id, serial, name, drone_id (FK), purchase_date, cycles, health (0-100%), status (Active/Inactive), last_charged, notes, created_at

### maintenance_logs
id, drone_id (FK), date, type (Deep/Routine/Basic/Battery/Software Update), description, performed_by, status (Completed/Scheduled/Pending), next_due, created_at

### training_logs
id, pilot_id (FK), date, course (A1/A3/A2/STS/ERP Training etc.), provider, hours, certificate, expiry, notes, created_at

### incidents
id, flight_log_id (FK), date, type (Incident/Accident/Serious Incident), description, reported_to_iaa (0/1), iaa_reference, outcome, created_at

### incident_reports
id, date, time, location, type, description, pilot_id (FK), pilot_name, flight_plan_id (FK), severity (Minor/Serious/Accident), injuries (bool), property_damage (bool), resolution, reported_to_iaa (bool), iaa_reference, actions_taken, lessons_learned, notes

## API Routes (server.js)

### Auth
- POST /api/login, POST /api/logout, GET /api/auth/status

### Flight Plans
- GET /api/flight-plans (with stats), POST, PUT /:id, DELETE /:id

### Flight Logs
- GET /api/flight-logs?plan_id=X (strips gps_track, adds has_gps_track boolean)
- POST /api/flight-logs (manual entry)
- PUT /api/flight-logs/:id, DELETE /:id
- GET /api/flight-logs/:id/gps-track (fetch full track)
- PUT /api/flight-logs/:id/gps-track (retroactive upload)

### DJI & AirData Import
- POST /api/flight-logs/import-dji (direct upload, hits 4.5MB limit)
- POST /api/flight-logs/import-dji-storage (browser uploads to Supabase Storage first, server processes from storage path)
- POST /api/flight-logs/import-airdata (CSV parse)

### Dashboard
- GET /api/dashboard/stats, GET /api/dashboard/recent

### Equipment
- GET /api/pilots, GET /api/drones, GET /api/batteries, POST /api/batteries, PATCH /api/batteries/:id
  - POST /api/batteries: creates a new battery (fields: serial*, name, drone_id, purchase_date, status, cycles, health, notes). Returns 409 on duplicate serial.
  - PATCH /api/batteries/:id: only accepts `open_category_hours` — do NOT extend without explicit scope change

### Maintenance/Training/Incidents
- GET/POST /api/maintenance-logs, training-logs, incident-reports

### Evidence
- GET /api/flight-plans/:id/evidence
- POST /api/flight-plans/:id/evidence/planning (team info)
- POST /api/flight-plans/:id/evidence/flightGeographyData (ops params)
- POST /api/flight-plans/:id/evidence/flightGeographyMap (KML data)
- POST /api/flight-plans/:id/evidence/airspaceZones
- POST /api/flight-plans/:id/evidence/:category (file upload)
- DELETE /api/flight-plans/:id/evidence/:category/:fileId

### SORA Docs
- GET/POST/PUT/DELETE /api/sora-documents

## Key Frontend Functions

### Data & Rendering
- loadAllData() - Parallel fetch all data
- renderBentoGrid() - KPI dashboard cards
- renderFlightPlans(filter) - Plan cards with compliance bars
- showPlanDetail(planId) - Detail view with logs, evidence, map
- calculatePlanCompliance(planId) - 11-item audit score

### DJI Upload (batch support)
- importDJIFlightRecord(e) - Loops through multiple files, uploads each to Supabase Storage, calls /api/flight-logs/import-dji-storage

### GPS Tracks (multi-select)
- activeFlightTracks (Map) - logId → { layer, color }
- trackColors - 8 distinct colors for overlaid tracks
- toggleFlightTrack(logId, show) - Add/remove individual track
- toggleAllFlightTracks(checked) - Select/deselect all
- clearAllFlightTracks() - Remove all tracks from map
- fitMapToActiveTracks() - Auto-zoom to all active track bounds

### Flight Geography
- initFlightGeoMap() - Leaflet map for KML + buffer visualization
- handleKMLUpload(input) - Parse KML, draw on map
- recalculateBuffers() - Turf.js contingency volume, GRB, adjacent area

## Key Patterns

### DJI Serial Matching
- aircraft_sn (e.g. "1581F67QC234F014") matched to drones.serial_number using startsWith in both directions
- battery_sn (e.g. "4ERKKCA5G2131A") matched to batteries.serial using endsWith/includes
- Drone stored as: "DJI mavic 3 pro. 1581F67QC234F0140NMP"
- Battery stored as: "Bat-Mavic3-G2131A (G2131A)"

### File Upload Flow (Vercel)
- Small files (<4.5MB): Direct multer upload to server
- Large files (DJI): Browser → Supabase Storage bucket → server downloads, processes, deletes temp
- Evidence: Browser → Supabase Storage, server stores metadata in evidence JSONB

### Deployment
- Git push to main triggers Vercel auto-deploy (webhook reconnected 17 Feb 2026)
- Fallback: `cd /Users/roc/Documents/AERIAL/AerialDeck && npx vercel --prod`
- If git index.lock error: `rm .git/index.lock` first
- vercel.json uses `functions` + `rewrites` (NOT `builds` — they conflict)

## Recent Changes (8 Apr 2026)
- **Battery creation:** added POST /api/batteries endpoint and "+ Add Battery" button/modal in the Batteries tab. PATCH /api/batteries/:id was intentionally left untouched (it only supports open_category_hours and is used by the inline editor).
- **Flight Logs tab titles:** cards in the top-level Flight Logs tab now show a unique per-log title (`DD Mon YYYY HH:MM · Pilot · Drone`) instead of the flight plan title. Plan name relocated to a small 📋 subtitle underneath. Only `renderAllFlightLogs()` in public/index.html was touched — backend, detail view, edit modal, stats/compliance logic all unchanged.
- **Security hardening:** dropped 6 permissive `USING(true)/WITH CHECK(true)` RLS policies on `incident_reports`, `maintenance_logs`, `training_logs` (the anon UPDATE and DELETE policies on each). Anon SELECT/INSERT still work; audit tables can no longer be mutated/deleted via the anon key. See `SECURITY_REVIEW_2026-04-08.md` for the full audit.
- **Data backup:** full snapshot of all 8 Supabase tables saved to `backups/data-2026-04-08/` (168 rows total). See `_backup_summary.json`.
- **GitHub PAT rotated:** old classic token expired, new one stored in line 15 above.

## Recent Changes (17 Feb 2026)
- Fixed vercel.json (removed conflicting builds/functions properties)
- Battery display format: now stores "Name (SerialNumber)" instead of just serial
- Batch DJI upload: file input accepts multiple, loops through all files
- Multi-select GPS tracks: checkboxes with color-coded tracks, select all toggle
- Reconnected Vercel-GitHub webhook (was broken from API pushes)
- Supabase Storage upload flow for DJI files (bypasses Vercel 4.5MB limit)
- Filename sanitization for storage keys (removes brackets etc.)
- Editable flight geography polygons (Leaflet.Editable)
- Dark mode support with toggle in settings
- Settings panel (dark mode, map tile layer, default units)
- DJI flight record file preservation (raw .txt stored in Supabase Storage `dji-uploads` bucket)
- `dji_file_path` column on flight_logs (needs manual add in Supabase dashboard)

## SORA Compliance Review (18 Feb 2026)
- Reviewed all 22 SORA documents against AerialDeck data capture
- Full gap analysis: `Current SORA Documents Feb 2026/GAP_ANALYSIS_AerialDeck_vs_SORA.md`
- Evidence requirements summary: `Current SORA Documents Feb 2026/EVIDENCE_REQUIREMENTS_SUMMARY.md`
- **Conclusion:** AerialDeck captures all mandatory per-flight evidence from DJI files (date/time, duration, location, drone serial, battery serial, GPS track, max height)
- Pre/post-flight checklists and briefings handled on paper
- Weather and NOTAM evidence handled via file uploads
- No code changes required — current system meets SORA evidence requirements

## DJI Flight Record Data
### Metadata (no API key needed — from `details`):
startTime, totalTime, maxHeight, maxHorizontalSpeed, maxVerticalSpeed, latitude, longitude, totalDistance, productType, aircraftSn, batterySn, cameraSn, rcSn, appVersion, takeOffAltitude, captureNum, videoTime

### We extract and store:
startTime → date_time_utc, totalTime → air_time_minutes, maxHeight → max_altitude_ft, maxHorizontalSpeed → max_speed_mph, latitude, longitude, productType → drone, aircraftSn → drone match, batterySn → battery match

### Decrypted frames (needs DJI API key):
Each frame (~10Hz) contains: osd (lat/lon/alt/speed/attitude/gpsLevel), battery (chargeLevel/voltage/current/temp/cellVoltages), gimbal (pitch/roll/yaw), camera (isPhoto/isVideo/sdCard), rc (stick positions), home (lat/lon/goHomeHeight/heightLimit)
We sample ~500 frames for GPS track: {lat, lon, alt, time}

## Data Backup
- **Script:** `node backup-data.js` (run from AerialDeck directory)
- Exports all 9 Supabase tables to JSON files in `backups/data-YYYY-MM-DD/`
- Handles pagination (1000+ rows)
- Creates a `_backup_summary.json` with row counts and timestamp
- **⚠️ REMINDER: Ask Rob if he has run a recent data backup. Suggest running `node backup-data.js` regularly (after each batch of flights or at least weekly).**
