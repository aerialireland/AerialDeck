# AerialDeck Deployment Status
**Date:** February 2, 2026

## Live URL
**https://aerialdeck-2026.vercel.app**
- Password: `Drone0n!`

## GitHub Repository
**https://github.com/aerialireland/AerialDeck**
- Branch: `main`
- Latest commit: `b9dec59` - "Fix: Use cookie-session for Vercel serverless compatibility"

## Database
**Supabase** - https://supabase.com/dashboard/project/xvevvssehmtbpkcztzmj
- Project: AerialDeck
- Region: AWS eu-west-1

### Tables:
| Table | Records | Description |
|-------|---------|-------------|
| flight_plans | 18 | Flight operations with locations, dates |
| flight_logs | 81 | Individual flight records with telemetry |
| pilots | 3 | Rob O'Connor (ROC), Tony Kinlan (TK), Fergal McCarthy (FM) |
| drones | 4 | Mavic 3 Pro, Pro Cine, Thermal, Enterprise |
| batteries | 7 | Battery inventory with cycle counts |

## Vercel Configuration
- Project: `aerialdeck-2026`
- Team: `robs-projects-4019be61`
- Environment Variables:
  - `SUPABASE_KEY` - Supabase anon key
  - `DASHBOARD_PASSWORD` - `Drone0n!`
  - `SESSION_SECRET` - Session encryption key

## Key Technical Decisions

### 1. Cookie-Session for Serverless
Changed from `express-session` to `cookie-session` because Vercel serverless functions are stateless - sessions don't persist between invocations with MemoryStore.

### 2. File Uploads on Vercel
- Evidence file uploads use memory storage on Vercel (filesystem is read-only)
- Local development uses disk storage
- `/tmp` directory available but ephemeral

### 3. Supabase Connection
- Hardcoded Supabase URL in `/database/supabase.js`
- API key from environment variable `SUPABASE_KEY`

## Dashboard Features Working
- Total Flights: 81
- Flight Plans: 18
- Flight Hours: 17h 35m
- Pilots (3) with flight counts and hours
- Drones (4) listing
- Batteries (7) with cycle tracking
- FTS Tests: 13
- Flight Modes breakdown (Cine/Normal/Sports)
- Average Flight Time
- Map with flight locations
- Flight Plans list with status
- All tabs: Flight Plans, Flight Logs, Drones, Batteries, Maintenance, Training, Incidents

## Features Added This Session
1. New Flight Plan creation UI
2. AirData CSV import for flight logs
3. Vercel deployment with serverless functions
4. Cookie-session authentication fix

## Known Limitations
1. Evidence file uploads won't persist on Vercel (serverless filesystem is ephemeral)
2. Maintenance, Training, Incidents use local in-memory data (not in Supabase yet)
3. Flight logs need to be manually associated with flight plans via `flight_plan_id`

## File Structure
```
AerialDeck/
├── server.js           # Express server with Supabase integration
├── package.json        # Dependencies including cookie-session
├── vercel.json         # Vercel deployment config
├── database/
│   ├── supabase.js     # Supabase client
│   └── local-data.js   # In-memory data for maintenance/training/incidents
└── public/
    └── index.html      # Frontend dashboard
```

## Next Steps (Future)
- Migrate maintenance, training, incidents to Supabase
- Add evidence file storage (Supabase Storage or S3)
- Custom domain setup
- Add more flight plan details/locations
