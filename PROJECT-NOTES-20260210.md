# AerialDeck Project Notes - February 10, 2026

## Overview
AerialDeck is an IAA-compliant flight records management dashboard for drone operations in Ireland.

**Live URL:** https://aerialdeck-2026.vercel.app
**GitHub Repo:** https://github.com/aerialireland/AerialDeck
**Hosting:** Vercel (auto-deploys from main branch)
**Database:** Supabase (PostgreSQL + Storage)

---

## Session Summary - Feb 10, 2026

### New Feature: IAA Geozones for Flight Plans

Added the ability to record which IAA geographical zones a flight plan intersects with, for regulatory compliance.

#### What Was Added:

1. **GeoZone Version Selector**
   - Dropdown in Airspace Zones modal showing all IAA GeoZone versions
   - Supports historical versions so older flights can use the zones that were valid at the time
   - Current versions: 20260130V1, 20251129V2, 20250915, 20250417, 20250123

2. **Auto-Detect Button**
   - Uses Turf.js to find intersecting zones based on flight coordinates
   - Works with KML polygon (from Flight Geography Planner)
   - Falls back to point coordinates + buffer (from Flight Parameters)

3. **Zone Data Storage**
   - New format stores: `versionId`, `versionName`, `detectedZones[]`, `manualZones[]`
   - Backwards compatible with old array format
   - Zones are "frozen" at save time for compliance records

4. **PDF Export**
   - Updated to include IAA GeoZone version label
   - Lists all detected zones with their types

#### Files Changed:

- `public/index.html` - Main application (modal, JS functions, PDF export)
- `public/geozones/index.json` - Version metadata index
- `public/geozones/*.geojson` - 5 GeoJSON version files (7MB each)

#### Key Code Locations in index.html:

- **Modal HTML:** Search for `airspaceZonesModal`
- **Version loading:** `loadGeozoneVersions()` function (~line 2791)
- **Auto-detect:** `autoDetectZones()` function (~line 2816)
- **Form submission:** `submitAirspaceZonesForm()` (~line 3155)
- **Evidence rendering:** `renderEvidence()` (~line 2923)
- **PDF zones section:** Search for `AIRSPACE ZONES` in generateFlightPlanPDF

#### Data Structure:

```javascript
// New format (stored in evidence.airspaceZones)
{
  versionId: "20260130V1",
  versionName: "IAA 20260130V1",
  detectedZones: [
    { id: "UAS-GZ-001", name: "Dublin Airport", type: "Airport", selected: true }
  ],
  manualZones: ["Custom Zone Name"]
}

// Old format (still supported for backwards compatibility)
["Zone 1", "Zone 2"]
```

#### GeoJSON Versions Available:

| Version ID | Valid From | File Size |
|------------|------------|-----------|
| 20260130V1 | 2026-02-06 | 7.3 MB |
| 20251129V2 | 2025-11-29 | 7.4 MB |
| 20250915   | 2025-09-15 | 7.3 MB |
| 20250417   | 2025-05-24 | 7.2 MB |
| 20250123   | 2025-01-23 | 11.1 MB |

---

## Deployment Instructions

### To Deploy Changes:

```bash
cd /Users/roc/Documents/AERIAL/AerialDeck
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

1. **Auto-detect performance** - Large GeoJSON files (7MB+) can cause the browser to be slow during detection. Could be optimized by:
   - Pre-processing zones into a spatial index
   - Using Web Workers for detection
   - Filtering zones by bounding box first

2. **Mount stability** - The Cowork filesystem mount occasionally disconnects during long sessions

---

## Backups

| Backup File | Date | Description |
|-------------|------|-------------|
| index-backup-20260210-pre-geozones.html | Feb 10 | Before geozones feature |
| index-backup-20260210-geozones.html | Feb 10 | After geozones feature |
| server-backup-20260210-geozones.js | Feb 10 | Current server.js |

---

## Related Project: UF101-Console

The UF101-Console at https://uf101.aerial.ie also had geozones updated on the same day:
- Updated to IAA GeoZone version 20260130V1
- Added version tracking and download links
- Zones are frozen at save time (not recalculated on load)
- Files at: `/Users/roc/Documents/AERIAL/UF101-Console`

---

## Contact

Rob O'Connor - rob.oconnor@aerial.ie
