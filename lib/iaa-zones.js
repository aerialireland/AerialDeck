/**
 * Checks the IAA for a new UAS Geographical Zones release and archives it.
 *
 * Shared by the daily Vercel cron (GET /api/cron/check-iaa-zones) and the CLI
 * (scripts/fetch-iaa-zones.js), so there is one implementation rather than two
 * that can drift.
 *
 * The IAA publishes one GeoJSON, linked from the UAS Geographic Zones page,
 * with the version baked into the filename:
 *   20260714_uas_zones_ireland_v1.geojson
 * There is no API and no stable URL, so this reads the page and follows
 * whichever link is on it.
 *
 * Archives on change rather than blindly every day. The dataset moves a handful
 * of times a year, so daily copies would be ~2.6GB/year of near-identical files.
 * Every *version* is kept — which is what the audit trail needs, since each
 * saved U.F.101 flight cites the dataset it was validated against — and every
 * check is logged, so a given day's check is provable.
 */

const supabase = require('../database/supabase.js');

const PAGE = 'https://www.iaa.ie/general-aviation/drones/uas-geographic-zones';
const ORIGIN = 'https://www.iaa.ie';
const BUCKET = 'aerialdeck-files';
const ARCHIVE_PREFIX = 'geozones/archive';
const LOG_PATH = 'geozones/check-log.json';
const UA = 'AerialDeck zone checker';

// Anything below this is an error page or a truncated download, not a release.
// The dataset has carried 80+ zones for years.
const MIN_FEATURES = 50;

async function appendLog(entry) {
  let entries = [];
  try {
    const { data } = await supabase.storage.from(BUCKET).download(LOG_PATH);
    if (data) entries = JSON.parse(await data.text());
  } catch { /* first run — no log yet */ }
  if (!Array.isArray(entries)) entries = [];
  entries.unshift(entry);
  await supabase.storage.from(BUCKET).upload(
    LOG_PATH,
    Buffer.from(JSON.stringify(entries.slice(0, 400), null, 2), 'utf-8'),
    { contentType: 'application/json', upsert: true, cacheControl: '0' }
  );
}

/**
 * @param {{dryRun?: boolean, onLog?: (msg: string) => void}} opts
 * @returns {Promise<{ok: boolean, action: string, versionId?: string, features?: number, message?: string}>}
 */
async function checkAndArchive(opts = {}) {
  const { dryRun = false, onLog = () => {} } = opts;
  const say = (m) => { onLog(m); };

  // ---- find the current file ---------------------------------------------
  const pageRes = await fetch(PAGE, { headers: { 'User-Agent': UA } });
  if (!pageRes.ok) {
    return { ok: false, action: 'error', message: `IAA page returned ${pageRes.status}` };
  }
  const html = await pageRes.text();

  // Ignore any ?sfvrsn= cache-buster Sitefinity appends to the href.
  const m = html.match(/href="([^"]*?\.geojson[^"]*?)"/i);
  if (!m) {
    return {
      ok: false,
      action: 'error',
      message: 'No .geojson link on the IAA page — their layout may have changed. Nothing written.'
    };
  }
  const fileUrl = m[1].startsWith('http') ? m[1] : ORIGIN + m[1];
  const baseName = decodeURIComponent(fileUrl.split('?')[0].split('/').pop());

  // 20260714_uas_zones_ireland_v1.geojson -> 20260714V1
  const idMatch = baseName.match(/(\d{8})_.*?_v(\d+)/i);
  const versionId = idMatch ? `${idMatch[1]}V${idMatch[2]}` : baseName.replace(/\.geojson$/i, '');
  say(`published version: ${versionId} (${baseName})`);

  // ---- already archived? --------------------------------------------------
  const { data: listed } = await supabase.storage.from(BUCKET).list(ARCHIVE_PREFIX, { limit: 200 });
  const known = (listed || []).map(f => f.name);
  const alreadyHave = known.includes(`${versionId}.geojson`);
  say(`archived versions: ${known.length ? known.join(', ') : '(none yet)'}`);

  // ---- download and validate ---------------------------------------------
  const fileRes = await fetch(fileUrl, { headers: { 'User-Agent': UA } });
  if (!fileRes.ok) {
    return { ok: false, action: 'error', message: `download returned ${fileRes.status}` };
  }
  const text = await fileRes.text();

  let geo;
  try { geo = JSON.parse(text); }
  catch { return { ok: false, action: 'error', message: 'downloaded file is not valid JSON' }; }

  if (geo.type !== 'FeatureCollection' || !Array.isArray(geo.features)) {
    return { ok: false, action: 'error', message: 'not a GeoJSON FeatureCollection' };
  }
  if (geo.features.length < MIN_FEATURES) {
    return {
      ok: false,
      action: 'error',
      message: `only ${geo.features.length} features — implausibly few, refusing to archive`
    };
  }
  say(`validated: ${geo.features.length} zones, ${(text.length / 1048576).toFixed(1)} MB`);

  const entry = {
    checkedAt: new Date().toISOString(),
    versionId,
    fileName: baseName,
    features: geo.features.length,
    bytes: text.length,
    action: alreadyHave ? 'no-change' : 'archived'
  };

  if (alreadyHave) {
    if (!dryRun) await appendLog(entry);
    return { ok: true, action: 'no-change', versionId, features: geo.features.length };
  }

  if (dryRun) {
    return { ok: true, action: 'would-archive', versionId, features: geo.features.length };
  }

  const body = Buffer.from(text, 'utf-8');
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(`${ARCHIVE_PREFIX}/${versionId}.geojson`, body, {
      contentType: 'application/geo+json', upsert: true, cacheControl: '31536000'
    });
  if (upErr) return { ok: false, action: 'error', message: `archive upload failed: ${upErr.message}` };

  say(`archived ${ARCHIVE_PREFIX}/${versionId}.geojson`);
  await appendLog(entry);

  return { ok: true, action: 'archived', versionId, features: geo.features.length, text };
}

module.exports = { checkAndArchive, BUCKET, ARCHIVE_PREFIX, LOG_PATH };
