#!/usr/bin/env node
/**
 * Checks the IAA for a new UAS Geographical Zones release and archives it.
 *
 * The IAA publishes one GeoJSON, linked from
 *   https://www.iaa.ie/general-aviation/drones/uas-geographic-zones
 * with the version baked into the filename, e.g.
 *   20260714_uas_zones_ireland_v1.geojson
 * There is no API and no stable URL, so this reads the page and follows
 * whichever link is on it.
 *
 * WHY IT ARCHIVES ON CHANGE, NOT BLINDLY EVERY DAY
 * The dataset changes a handful of times a year. Storing 7.2MB every day would
 * be ~2.6GB a year of near-identical copies. This keeps every *version* — which
 * is what the audit trail actually needs, since each saved U.F.101 flight
 * references the dataset it was validated against — and logs every check so you
 * can prove the check ran on a given day.
 *
 * Usage:
 *   node scripts/fetch-iaa-zones.mjs            # check, archive if new
 *   node scripts/fetch-iaa-zones.mjs --dry-run  # report only, write nothing
 *   node scripts/fetch-iaa-zones.mjs --dir PATH # also drop a copy in PATH
 *                                               # (e.g. a Google Drive folder)
 * Exit codes: 0 no change / archived, 1 error.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const PAGE = 'https://www.iaa.ie/general-aviation/drones/uas-geographic-zones';
const ORIGIN = 'https://www.iaa.ie';
const BUCKET = 'aerialdeck-files';
const ARCHIVE_PREFIX = 'geozones/archive';
const LOG_PATH = 'geozones/check-log.json';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dirIdx = args.indexOf('--dir');
const copyDir = dirIdx > -1 ? args[dirIdx + 1] : null;

const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
if (!key) { console.error('No SUPABASE_SERVICE_KEY in the environment.'); process.exit(1); }
const sb = createClient('https://xvevvssehmtbpkcztzmj.supabase.co', key);

const log = (...a) => console.log(new Date().toISOString().slice(0, 19), ...a);
const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';

// ---- 1. find the current file -------------------------------------------
log('checking', PAGE);
const pageRes = await fetch(PAGE, { headers: { 'User-Agent': 'AerialDeck zone checker' } });
if (!pageRes.ok) { console.error(`page returned ${pageRes.status}`); process.exit(1); }
const html = await pageRes.text();

// One link on the page points at the dataset. Match the href, ignore any
// ?sfvrsn= cache-buster Sitefinity appends.
const m = html.match(/href="([^"]*?\.geojson[^"]*?)"/i);
if (!m) {
  console.error('No .geojson link found on the page — the IAA may have changed its layout.');
  console.error('Nothing was written. Check the page by hand.');
  process.exit(1);
}
const fileUrl = m[1].startsWith('http') ? m[1] : ORIGIN + m[1];
const baseName = decodeURIComponent(fileUrl.split('?')[0].split('/').pop());

// 20260714_uas_zones_ireland_v1.geojson -> 20260714V1
const idMatch = baseName.match(/(\d{8})_.*?_v(\d+)/i);
const versionId = idMatch ? `${idMatch[1]}V${idMatch[2]}` : baseName.replace(/\.geojson$/i, '');
log('published version:', versionId, `(${baseName})`);

// ---- 2. already archived? -------------------------------------------------
const archiveKey = `${ARCHIVE_PREFIX}/${versionId}.geojson`;
const { data: listed } = await sb.storage.from(BUCKET).list(ARCHIVE_PREFIX, { limit: 200 });
const known = (listed || []).map(f => f.name);
const alreadyHave = known.includes(`${versionId}.geojson`);

log('archived versions:', known.length ? known.join(', ') : '(none yet)');

// ---- 3. download and validate --------------------------------------------
log('downloading', fileUrl.split('?')[0]);
const fileRes = await fetch(fileUrl, { headers: { 'User-Agent': 'AerialDeck zone checker' } });
if (!fileRes.ok) { console.error(`download returned ${fileRes.status}`); process.exit(1); }
const text = await fileRes.text();

let geo;
try { geo = JSON.parse(text); }
catch { console.error('Downloaded file is not valid JSON — refusing to archive it.'); process.exit(1); }

if (geo.type !== 'FeatureCollection' || !Array.isArray(geo.features)) {
  console.error('Not a GeoJSON FeatureCollection — refusing to archive it.');
  process.exit(1);
}
if (geo.features.length < 50) {
  console.error(`Only ${geo.features.length} features — implausibly few, refusing to archive.`);
  console.error('The IAA dataset has had 80+ zones; this looks like an error page or a partial download.');
  process.exit(1);
}
log('validated:', geo.features.length, 'zones,', mb(text.length));

// ---- 4. record the check --------------------------------------------------
async function appendLog(entry) {
  if (dryRun) return;
  let entries = [];
  try {
    const { data } = await sb.storage.from(BUCKET).download(LOG_PATH);
    if (data) entries = JSON.parse(await data.text());
  } catch { /* first run */ }
  if (!Array.isArray(entries)) entries = [];
  entries.unshift(entry);
  await sb.storage.from(BUCKET).upload(
    LOG_PATH,
    Buffer.from(JSON.stringify(entries.slice(0, 400), null, 2), 'utf-8'),
    { contentType: 'application/json', upsert: true, cacheControl: '0' }
  );
}

const entry = {
  checkedAt: new Date().toISOString(),
  versionId,
  fileName: baseName,
  features: geo.features.length,
  bytes: text.length,
  action: alreadyHave ? 'no-change' : 'archived'
};

if (alreadyHave) {
  log(`${versionId} is already archived — nothing to do.`);
  await appendLog(entry);
  process.exit(0);
}

// ---- 5. archive the new version ------------------------------------------
if (dryRun) {
  log(`DRY RUN: would archive ${versionId} to ${BUCKET}/${archiveKey}`);
  process.exit(0);
}

const body = Buffer.from(text, 'utf-8');
const { error: upErr } = await sb.storage.from(BUCKET).upload(body.length ? archiveKey : archiveKey, body, {
  contentType: 'application/geo+json', upsert: true, cacheControl: '31536000'
});
if (upErr) { console.error('archive upload failed:', upErr.message); process.exit(1); }
log(`archived ${archiveKey} (${mb(body.length)})`);

// Optional local copy — point --dir at a Google Drive / Dropbox synced folder
// and the sync client does the offsite part.
if (copyDir) {
  try {
    fs.mkdirSync(copyDir, { recursive: true });
    const dest = path.join(copyDir, `${versionId}.geojson`);
    fs.writeFileSync(dest, text, 'utf-8');
    log('copied to', dest);
  } catch (err) {
    console.error('local copy failed:', err.message);   // non-fatal: the archive succeeded
  }
}

await appendLog(entry);

console.log('');
console.log(`NEW VERSION ${versionId} archived. The live copies still need updating:`);
console.log('  - UF101 Creator : scripts/upload-uf101-assets.mjs regenerates uf101/iaa-zones.js');
console.log('  - Flight Planner: POST /api/geozone-versions to add it to the manifest');
process.exit(0);
