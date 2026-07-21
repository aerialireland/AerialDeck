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

const crypto = require('crypto');
const supabase = require('../database/supabase.js');
const drive = require('./google-drive.js');

/**
 * What actually changed between two releases, keyed on the zone identifier.
 *
 * Geometry is compared by hash rather than deep-equality: these are MultiPolygons
 * with thousands of coordinates and we only need "did it move", not where.
 */
function diffVersions(oldGeo, newGeo) {
  const key = (f) => (f.properties && f.properties.identifier) || null;
  const geomHash = (f) =>
    crypto.createHash('sha1').update(JSON.stringify(f.geometry || null)).digest('hex').slice(0, 12);

  // Fields worth alerting on. Deliberately not every property — 'message' and
  // the like churn with wording tweaks that do not change where you may fly.
  const WATCHED = ['name', 'type', 'restrictionConditions', 'reason', 'otherReasonInfo'];

  const index = (geo) => {
    const m = new Map();
    for (const f of (geo.features || [])) {
      const k = key(f);
      if (k) m.set(k, f);
    }
    return m;
  };

  const before = index(oldGeo);
  const after = index(newGeo);

  const added = [];
  const removed = [];
  const changed = [];

  for (const [k, f] of after) {
    if (!before.has(k)) {
      added.push({ id: k, name: f.properties.name, type: f.properties.type });
    }
  }
  for (const [k, f] of before) {
    if (!after.has(k)) {
      removed.push({ id: k, name: f.properties.name, type: f.properties.type });
    }
  }
  for (const [k, newF] of after) {
    const oldF = before.get(k);
    if (!oldF) continue;
    const fields = [];
    for (const w of WATCHED) {
      const a = oldF.properties ? oldF.properties[w] : undefined;
      const b = newF.properties ? newF.properties[w] : undefined;
      if (JSON.stringify(a) !== JSON.stringify(b)) fields.push(w);
    }
    if (geomHash(oldF) !== geomHash(newF)) fields.push('geometry');

    // Time windows decide whether a zone is live for a given flight, so a change
    // here matters even though nothing else moved.
    const oldWin = JSON.stringify((oldF.properties || {}).limitedApplicability || null);
    const newWin = JSON.stringify((newF.properties || {}).limitedApplicability || null);
    if (oldWin !== newWin) fields.push('limitedApplicability');

    if (fields.length) {
      changed.push({ id: k, name: newF.properties.name, fields });
    }
  }

  return {
    added, removed, changed,
    counts: { before: before.size, after: after.size,
              added: added.length, removed: removed.length, changed: changed.length }
  };
}

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

  // Content hash, so a silent re-issue under the same version number is caught.
  // The IAA has republished without bumping the filename before; comparing only
  // the version id would miss it entirely.
  const sha = crypto.createHash('sha256').update(text).digest('hex');

  const entry = {
    checkedAt: new Date().toISOString(),
    versionId,
    fileName: baseName,
    features: geo.features.length,
    bytes: text.length,
    sha256: sha,
    action: alreadyHave ? 'no-change' : 'archived'
  };

  if (alreadyHave) {
    // Same filename — but is it the same file?
    let republished = false;
    try {
      const { data: prev } = await supabase.storage
        .from(BUCKET).download(`${ARCHIVE_PREFIX}/${versionId}.geojson`);
      if (prev) {
        const prevText = await prev.text();
        const prevSha = crypto.createHash('sha256').update(prevText).digest('hex');
        republished = prevSha !== sha;
        if (republished) {
          say(`WARNING: ${versionId} has been republished — same filename, different contents`);
          entry.action = 'republished';
          entry.diff = diffVersions(JSON.parse(prevText), geo).counts;
          if (!dryRun) {
            await supabase.storage.from(BUCKET).upload(
              `${ARCHIVE_PREFIX}/${versionId}.geojson`, Buffer.from(text, 'utf-8'),
              { contentType: 'application/geo+json', upsert: true, cacheControl: '31536000' }
            );
          }
        }
      }
    } catch { /* comparison is best-effort */ }

    if (!dryRun) await appendLog(entry);
    return {
      ok: true,
      action: republished ? 'republished' : 'no-change',
      versionId,
      features: geo.features.length,
      diff: entry.diff || null,
      text: republished ? text : undefined
    };
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

  // Diff against the most recent version we already held, so the alert says what
  // actually changed rather than just that something did.
  let diff = null, previousId = null;
  const priors = known.filter(n => n.endsWith('.geojson')).sort();
  if (priors.length) {
    previousId = priors[priors.length - 1].replace(/\.geojson$/, '');
    try {
      const { data: prev } = await supabase.storage
        .from(BUCKET).download(`${ARCHIVE_PREFIX}/${previousId}.geojson`);
      if (prev) {
        diff = diffVersions(JSON.parse(await prev.text()), geo);
        say(`vs ${previousId}: ${diff.counts.added} added, ${diff.counts.removed} removed, ${diff.counts.changed} changed`);
      }
    } catch (err) {
      say(`could not diff against ${previousId}: ${err.message}`);
    }
  }

  entry.previousId = previousId;
  if (diff) entry.diff = diff.counts;
  await appendLog(entry);

  return { ok: true, action: 'archived', versionId, features: geo.features.length, diff, previousId, text };
}

/**
 * Copy every archived version into the Google Drive folder that is not there
 * already. Runs after each check, so it both keeps up with new releases and
 * backfills the versions archived before Drive was configured.
 *
 * Never throws — the Supabase archive is the system of record, and a Drive
 * outage must not fail the daily check.
 */
async function syncToDrive(onLog = () => {}) {
  if (!drive.isConfigured()) {
    return { configured: false, uploaded: 0, skipped: 0 };
  }

  let uploaded = 0, skipped = 0, failed = 0;
  try {
    const { data: listed } = await supabase.storage.from(BUCKET).list(ARCHIVE_PREFIX, { limit: 200 });
    for (const file of (listed || [])) {
      if (!file.name.endsWith('.geojson')) continue;
      try {
        // Check first so the 7MB body is only downloaded when Drive is actually
        // missing this version.
        if (await drive.exists(file.name)) { skipped++; continue; }

        const { data, error } = await supabase.storage
          .from(BUCKET).download(`${ARCHIVE_PREFIX}/${file.name}`);
        if (error) throw error;
        const text = await data.text();

        const result = await drive.uploadIfMissing(file.name, text);
        if (result.skipped) { skipped++; } else { uploaded++; onLog(`Drive: uploaded ${file.name}`); }
      } catch (err) {
        failed++;
        onLog(`Drive: FAILED ${file.name} — ${err.message}`);
      }
    }
  } catch (err) {
    onLog(`Drive: sync aborted — ${err.message}`);
  }
  return { configured: true, uploaded, skipped, failed };
}

module.exports = { checkAndArchive, syncToDrive, diffVersions, BUCKET, ARCHIVE_PREFIX, LOG_PATH };
