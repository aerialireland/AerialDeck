# AerialDeck Project Notes - February 2, 2026

## Overview
AerialDeck is an IAA (Irish Aviation Authority) compliance dashboard for drone operations. It helps track flight plans, flight logs, evidence, maintenance, training, and incidents.

## Deployment
- **Live URL**: https://aerialdeck-2026.vercel.app
- **Hosting**: Vercel (serverless)
- **Database**: Supabase (PostgreSQL + Storage)
- **Repository**: GitHub

## Current Usage (Supabase Free Tier)
- Database: 26 MB of 500 MB (~5%)
- Storage: 23 MB of 1 GB (~2%)
- Bandwidth: 15 MB of 2 GB (<1%)
- **No cost concerns** - plenty of headroom

## Key Features Implemented

### Homepage Dashboard (Bento Grid)
- Total Flights, Flight Plans, Flight Hours stats
- Pilots list with flight counts
- Drones list
- Interactive map showing flight locations
- Pilot Flight Hours bar chart
- **Audit Buster** - Overall compliance progress bar with color coding
- Flight Modes breakdown (Cine, Normal, Sports)
- Average Flight Time
- Battery Usage (cycles)
- **Days Since Last Audit** - Counter since June 5th, 2025

### Compliance System
- 11 compliance items per flight plan:
  1. Flight Logs (at least 1)
  2. Crew Assignment (Pilot in Command)
  3. Airspace Zones
  4. Operation Map
  5. Flight Parameters (lat/long + max height)
  6. Emergency Response Plan
  7. Weather
  8. Nearby Events
  9. NOTAMs
  10. UF101 Permission
  11. UF101 Application

- **Compliance Progress Bars** on:
  - Homepage flight plan rows (replaces "Complete" status)
  - Flight plan detail page header
  - Audit Buster (overall compliance)

- **Color Coding**:
  - Red (pastel): < 33%
  - Orange (pastel): 33-66%
  - Green (main site green): > 66%
  - Gold (shiny shimmer): 100%

### Flight Plan Detail Pages
- Header shows: Name, Date, Location (from Flight Parameters), Max Altitude, Flight Logs count, Total Time
- Compliance Score progress bar in top right
- Flight logs table
- Evidence sections for all 11 compliance categories
- File upload to Supabase Storage

### Data Persistence
- All data stored in Supabase (migrated from in-memory storage)
- Evidence stored as JSONB in flight_plans table
- Files uploaded to Supabase Storage buckets
- Maintenance logs, training logs, incident reports in separate tables

### Authentication
- Cookie-based session (cookie-session package)
- Password protected dashboard
- Session properly clears on logout (fixed: req.session = null)

## File Structure
```
AerialDeck/
├── server.js              # Express server with Supabase integration
├── public/
│   └── index.html         # Single-page application (all frontend code)
├── backups/
│   ├── index-backup-20260202-final.html
│   ├── server-backup-20260202-final.js
│   └── ... (other backups)
├── package.json
├── vercel.json
└── PROJECT-NOTES-20260202.md (this file)
```

## Environment Variables (Vercel)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `DASHBOARD_PASSWORD` - Login password
- `SESSION_SECRET` - Cookie session secret

## Recent Changes (This Session)
1. Fixed data persistence - migrated to Supabase
2. Added evidence JSONB column to flight_plans
3. Created maintenance_logs, training_logs, incident_reports tables
4. Updated header to show lat/long and max altitude from Flight Parameters
5. Removed MAX ALT and MAX SPEED columns from flight log table
6. Replaced FTS Tests card with Audit Buster
7. Added compliance progress bars to flight plan rows
8. Added "Days Since Last Audit" card
9. Fixed logout session clearing
10. Updated colors to pastel shades for red/orange

## Supabase Tables
- `flight_plans` - Flight plan data + evidence JSONB
- `flight_logs` - Individual flight records
- `maintenance_logs` - Drone maintenance records
- `training_logs` - Pilot training records
- `incident_reports` - Incident/accident reports
- `pilots` - Pilot information
- `drones` - Drone fleet information
- `batteries` - Battery inventory

## Notes
- Last audit date: June 5th, 2025 (hardcoded in Days Since Last Audit card)
- Clongriffin 120225 flight plan has full evidence uploaded (100% compliant)
- Most other flight plans are at 9% (only have flight logs)
