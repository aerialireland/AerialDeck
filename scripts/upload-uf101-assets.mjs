#!/usr/bin/env node
/**
 * Uploads the U.F.101 Creator's large static assets into Supabase Storage.
 *
 * Why: the IAA zone dataset is 7.5 MB and the archive of past releases is
 * another 7.2 MB. Committing those to the AerialDeck repo would add ~15 MB that
 * grows with every IAA reissue, so they live in the `aerialdeck-files` bucket
 * instead — the same bucket AerialDeck already uses for evidence and SORA files.
 *
 * The server streams them back out at /uf101/... (see server.js), so the
 * creator page fetches them from the same origin and needs no code change
 * beyond the script src.
 *
 * Re-running this is safe: uploads use upsert.
 *
 * Usage:  node scripts/upload-uf101-assets.mjs
 * Needs:  SUPABASE_SERVICE_KEY in .env, and network access to Supabase.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const CONSOLE_DIR = path.resolve(REPO, '..', 'UF101-Console');
const BUCKET = 'aerialdeck-files';
const PREFIX = 'uf101';

const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
if (!key) {
  console.error('No SUPABASE_SERVICE_KEY / SUPABASE_KEY in the environment. Aborting.');
  process.exit(1);
}

const sb = createClient('https://xvevvssehmtbpkcztzmj.supabase.co', key);

// Flights come from the LIVE console, never from the local copy.
//
// Saves go to the VPS through save-flights.php and are never written back to
// Rob's Mac, so ~/Documents/AERIAL/UF101-Console/flights-data.json is a frozen
// snapshot — it was five months stale the first time this ran, and the read-only
// copy in AerialDeck showed 5 flights instead of 26. Always pull from the server.
const LIVE_FLIGHTS_URL = 'https://uf101.aerial.ie/flights-data.json';

// [ local path relative to UF101-Console, destination key under uf101/, content type ]
const ASSETS = [
  ['iaa-zones.js', 'iaa-zones.js', 'application/javascript'],
  ['geojson-archive/20251129V2.geojson', 'geojson-archive/20251129V2.geojson', 'application/geo+json'],
  ['geojson-archive/20260130V1.geojson', 'geojson-archive/20260130V1.geojson', 'application/geo+json'],
  ['geojson-archive/20260414V1.geojson', 'geojson-archive/20260414V1.geojson', 'application/geo+json'],
  ['geojson-archive/20260525V1.geojson', 'geojson-archive/20260525V1.geojson', 'application/geo+json'],
];

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';

let uploaded = 0;
let failed = 0;

for (const [src, dest, contentType] of ASSETS) {
  const abs = path.join(CONSOLE_DIR, src);

  if (!fs.existsSync(abs)) {
    console.error(`  MISSING  ${src} — not found at ${abs}`);
    failed++;
    continue;
  }

  const body = fs.readFileSync(abs);
  const target = `${PREFIX}/${dest}`;

  const { error } = await sb.storage.from(BUCKET).upload(target, body, {
    contentType,
    upsert: true,
  });

  if (error) {
    console.error(`  FAILED   ${target} — ${error.message}`);
    failed++;
  } else {
    console.log(`  uploaded ${target}  (${mb(body.length)})`);
    uploaded++;
  }
}

// ---- Flights: fetched live, sanity-checked, then uploaded ----
try {
  const res = await fetch(LIVE_FLIGHTS_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  const flights = JSON.parse(text);          // throws on a truncated/HTML response
  if (!Array.isArray(flights)) throw new Error('not a JSON array');
  if (flights.length === 0) throw new Error('zero flights — refusing to publish an empty list');

  // Guard against publishing fewer flights than are already live. A shrinking
  // list means something went wrong upstream, and this snapshot is what the
  // AerialDeck copy shows.
  const { data: existing } = await sb.storage.from(BUCKET).download(`${PREFIX}/flights-data.json`);
  if (existing) {
    const prev = JSON.parse(await existing.text());
    if (Array.isArray(prev) && flights.length < prev.length) {
      throw new Error(`live has ${flights.length} flights but the published snapshot has ${prev.length} — aborting`);
    }
  }

  const { error } = await sb.storage.from(BUCKET).upload(
    `${PREFIX}/flights-data.json`,
    Buffer.from(text, 'utf-8'),
    {
      contentType: 'application/json',
      upsert: true,
      // Supabase Storage defaults to a one-hour CDN cache. The zone data is
      // immutable so that is fine there, but it meant a re-uploaded flight list
      // kept serving the old one for an hour. Flights change; do not cache them.
      cacheControl: '0',
    }
  );
  if (error) throw error;

  console.log(`  uploaded ${PREFIX}/flights-data.json  (${flights.length} flights, live from ${LIVE_FLIGHTS_URL})`);
  uploaded++;
} catch (err) {
  console.error(`  FAILED   ${PREFIX}/flights-data.json — ${err.message}`);
  failed++;
}

console.log(`\n${uploaded} uploaded, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
