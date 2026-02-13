# AerialDeck Project Notes - February 13, 2026

## Overview
AerialDeck is an IAA-compliant flight records management dashboard for drone operations in Ireland.

**Live URL:** https://aerialdeck-2026.vercel.app
**GitHub Repo:** https://github.com/aerialireland/AerialDeck
**Hosting:** Vercel (auto-deploys from main branch)
**Database:** Supabase (PostgreSQL + Storage)

---

## Session Summary - Feb 13, 2026

### Feature 1: Editable Flight Plan Title & Date

Flight plan name and date can now be edited after creation.

#### What Was Added:

1. **Edit Button** — pencil icon (✏️) next to the flight plan title in the detail header
2. **Edit Modal** — `editFlightPlanModal` with Name and Date fields, pre-populated with current values
3. **Save Handler** — `updateFlightPlan()` calls `PUT /api/flight-plans/:id` and refreshes both the detail header and the home page flight plan list

#### Key Code Locations in index.html:

- **Modal HTML:** Search for `editFlightPlanModal`
- **Edit button:** Inside `updateDetailHeader()` function, next to the `<h2>` title
- **Functions:** `showEditFlightPlanForm()` and `updateFlightPlan()`

#### Server Changes (server.js):

- `PUT /api/flight-plans/:id` — updated to only send defined fields to Supabase (previously sent all fields including undefined ones, which could wipe existing data)

---

### Feature 2: FTS Model Type Selection

Replaced the hardcoded "Zephyr CC MVC3" FTS model with a dropdown selector.

#### What Was Changed:

1. **Dropdown Selector** — `<select>` with two options:
   - Zephyr CC MVC3 PRO
   - Zephyr CC MVC3 ENTERPRISE
2. **Removed all hardcoded defaults** — old "Zephyr CC MVC3" value replaced with empty string in:
   - Initial evidence structure (index.html and server.js)
   - `showPlanningForm()` fallback
   - `submitPlanningForm()` fallback
   - Evidence rendering (now shows "Not set" if empty)
3. **PDF export** — no changes needed, already reads `ftsModel` dynamically

#### Key Code Locations in index.html:

- **Dropdown HTML:** Search for `planningFTSModel`
- **Evidence display:** Inside `renderEvidence()`, in the Crew Assignment bento card
- **Form handler:** `submitPlanningForm()` reads from dropdown

#### Backwards Compatibility:

- Existing flight plans with old "Zephyr CC MVC3" value will show "Not set" in the evidence display and a blank dropdown — user needs to re-select PRO or ENTERPRISE

---

### Feature 3: Open Category Battery Hours

Added the ability to record additional battery hours from Open Category operations (not tracked through flight logs).

#### What Was Added:

1. **Database Column** — `open_category_hours DECIMAL(10,2) DEFAULT 0` added to `batteries` table in Supabase
2. **PATCH Endpoint** — `PATCH /api/batteries/:id` to update open category hours per battery
3. **GET Response Updated** — `GET /api/batteries` now returns `specific_category_hours`, `open_category_hours`, and `total_hours` (sum of both)
4. **Battery Cards** — each card now shows:
   - Total hours prominently
   - Breakdown: Specific Category Xh / Open Category Xh
   - Number input for Open Category Hours with auto-save on change
5. **Bento Grid Bar Chart** — changed from "Battery Usage (cycles)" to "Battery Hours", showing combined total hours per battery, sorted by total hours descending
6. **Flight Hours Dashboard Panel** — shows combined total hours with Specific/Open breakdown underneath

#### Key Code Locations in index.html:

- **Battery cards:** `renderBatteries()` function
- **Auto-save handler:** `saveBatteryOpenHours()` function
- **Bar chart:** Inside `renderBentoGrid()`, search for `Battery Hours`
- **Flight Hours panel:** Inside `renderBentoGrid()`, search for `card-time`
- **Data mapping:** `batteryUsage` array in `loadAllData()`, includes `specificHours` and `openHours`

#### Key Code Locations in server.js:

- **GET /api/batteries** — returns `specific_category_hours`, `open_category_hours`, `total_hours`
- **PATCH /api/batteries/:id** — validates and updates `open_category_hours`

#### Supabase Migration Required:

```sql
ALTER TABLE batteries ADD COLUMN IF NOT EXISTS open_category_hours DECIMAL(10,2) DEFAULT 0;
```

---

## Deployment Instructions

### To Deploy Changes:

```bash
cd /Users/roc/Documents/AERIAL/AerialDeck
rm -f .git/HEAD.lock
git add .
git commit -m "Description of changes"
git push
```

Vercel automatically deploys when changes are pushed to the main branch.

### To Add New GeoJSON Version:

1. Add the new `.geojson` file to `public/geozones/`
2. Update `public/geozones/index.json` with the new version metadata:
   ```json
   {
     "id": "20260401V1",
     "name": "IAA 20260401V1",
     "fullName": "UAS Geographical Zones Ireland 20260401V1",
     "issued": "2026-04-01",
     "validFrom": "2026-04-15",
     "file": "20260401V1.geojson"
   }
   ```
3. Commit and push

---

## Known Issues / Future Improvements

1. **Auto-detect performance** - Large GeoJSON files (7MB+) can cause the browser to be slow during detection. Could be optimized by pre-processing zones into a spatial index, using Web Workers, or filtering by bounding box first.

2. **FTS backwards compatibility** - Existing flight plans with old "Zephyr CC MVC3" value need to be manually updated to PRO or ENTERPRISE.

---

## Backups

| Backup File | Date | Description |
|-------------|------|-------------|
| index-backup-20260210-pre-geozones.html | Feb 10 | Before geozones feature |
| index-backup-20260210-geozones.html | Feb 10 | After geozones feature |
| server-backup-20260210-geozones.js | Feb 10 | Server after geozones |
| index-backup-20260212-pre-edits.html | Feb 12 | Before edit/FTS/battery changes |
| index-backup-20260213-battery-hours.html | Feb 13 | After all Feb 13 changes |
| server-backup-20260213-battery-hours.js | Feb 13 | Server after all Feb 13 changes |

---

## Related Project: UF101-Console

The UF101-Console at https://uf101.aerial.ie also had geozones updated on Feb 10:
- Updated to IAA GeoZone version 20260130V1
- Added version tracking and download links
- Zones are frozen at save time (not recalculated on load)
- Files at: `/Users/roc/Documents/AERIAL/UF101-Console`

---

## Contact

Rob O'Connor - rob.oconnor@aerial.ie
