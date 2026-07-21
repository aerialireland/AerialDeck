#!/usr/bin/env node
/**
 * CLI wrapper around lib/iaa-zones.js — checks the IAA for a new UAS
 * Geographical Zones release, archives it to Supabase, and optionally drops a
 * copy into a local folder (e.g. a Google Drive synced folder).
 *
 * Usage:
 *   node scripts/fetch-iaa-zones.js
 *   node scripts/fetch-iaa-zones.js --dry-run
 *   node scripts/fetch-iaa-zones.js --dir "/Users/roc/Library/CloudStorage/GoogleDrive-.../IAA Zones"
 *
 * Exit codes: 0 success (archived or already current), 1 error.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { checkAndArchive, syncToDrive } = require('../lib/iaa-zones.js');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dirIdx = args.indexOf('--dir');

// Google Drive for Desktop mounts as
//   ~/Library/CloudStorage/GoogleDrive-<email>/My Drive
// The account is in the folder name, so find it rather than hardcoding it —
// that also means this keeps working if the Drive account changes.
function findDriveFolder() {
  const base = path.join(process.env.HOME, 'Library', 'CloudStorage');
  if (!fs.existsSync(base)) return null;
  const mount = fs.readdirSync(base).find(d => d.startsWith('GoogleDrive-'));
  if (!mount) return null;
  const myDrive = path.join(base, mount, 'My Drive');
  if (!fs.existsSync(myDrive)) return null;
  return path.join(myDrive, 'AerialDeck', 'IAA Zones');
}

const copyDir = dirIdx > -1
  ? args[dirIdx + 1]
  : (process.env.IAA_ZONES_COPY_DIR || findDriveFolder());

const stamp = () => new Date().toISOString().slice(0, 19);
const log = (m) => console.log(stamp(), m);

(async () => {
  try {
    const result = await checkAndArchive({ dryRun, onLog: log });

    if (!result.ok) {
      console.error(stamp(), 'FAILED:', result.message);
      process.exit(1);
    }

    // A Drive copy is written for every version we hold, not only newly
    // archived ones — so pointing --dir at a fresh folder backfills it rather
    // than silently staying empty until the IAA next publishes.
    if (copyDir && !dryRun) {
      try {
        fs.mkdirSync(copyDir, { recursive: true });
        const dest = path.join(copyDir, `${result.versionId}.geojson`);
        if (fs.existsSync(dest)) {
          log(`Drive copy already present: ${path.basename(dest)}`);
        } else {
          // result.text is only returned on a fresh archive; otherwise pull the
          // copy we already hold rather than hitting the IAA a second time.
          let text = result.text;
          if (!text) {
            const { checkAndArchive: _n, BUCKET, ARCHIVE_PREFIX } = require('../lib/iaa-zones.js');
            const supabase = require('../database/supabase.js');
            const { data, error } = await supabase.storage
              .from(BUCKET).download(`${ARCHIVE_PREFIX}/${result.versionId}.geojson`);
            if (error) throw error;
            text = await data.text();
          }
          fs.writeFileSync(dest, text, 'utf-8');
          log(`copied to Drive folder: ${dest}`);
        }
      } catch (err) {
        // Non-fatal: the Supabase archive is the system of record.
        console.error(stamp(), 'Drive copy failed:', err.message);
      }
    }

    if (!dryRun) {
      const d = await syncToDrive(log);
      if (!d.configured) log('Drive: not configured (GOOGLE_SERVICE_ACCOUNT_JSON / GDRIVE_FOLDER_ID unset) — skipped');
      else log(`Drive: ${d.uploaded} uploaded, ${d.skipped} already there, ${d.failed} failed`);
    }

    log(`done — ${result.action}${result.versionId ? ' (' + result.versionId + ', ' + result.features + ' zones)' : ''}`);
    process.exit(0);
  } catch (err) {
    console.error(stamp(), 'FAILED:', err.message);
    process.exit(1);
  }
})();
