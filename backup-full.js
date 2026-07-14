#!/usr/bin/env node
/**
 * AerialDeck FULL Backup — database tables AND storage objects.
 *
 *   node backup-full.js              full backup (db + all storage)
 *   node backup-full.js --db-only    tables only
 *   node backup-full.js --verify     re-check the latest backup against live storage
 *
 * WHY THIS EXISTS
 * Supabase's daily backups cover the DATABASE ONLY. Files uploaded through the
 * Storage API are NOT backed up by Supabase on any plan — the database merely
 * holds metadata pointing at them. In July 2026 ten evidence files disappeared
 * from the `aerialdeck-files` bucket and were unrecoverable, because no copy
 * existed anywhere. This script closes that gap.
 *
 * Output: backups/full-YYYY-MM-DD/
 *   db/<table>.json            one file per table
 *   storage/<bucket>/<path>    every object, original folder structure
 *   manifest.json              row counts, object list, sizes, checksums
 */
require('dotenv').config();   // .env holds SUPABASE_SERVICE_KEY (gitignored)

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPABASE_URL = 'https://xvevvssehmtbpkcztzmj.supabase.co';

// Must be the service_role key. The anon key is being locked down and will not be able
// to read the tables — a backup running as anon would silently produce empty files,
// which is worse than no backup at all. Fail loudly instead.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_KEY) {
  console.error('SUPABASE_SERVICE_KEY is not set. Run: npx vercel env pull .env');
  console.error('Refusing to back up with the anon key — it would produce an empty backup.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = ['flight_plans', 'flight_logs', 'pilots', 'drones', 'batteries',
                'maintenance_logs', 'training_logs', 'incident_reports'];
const BUCKETS = ['aerialdeck-files', 'dji-uploads', 'drone-images'];

const DB_ONLY = process.argv.includes('--db-only');
const VERIFY  = process.argv.includes('--verify');
const ROOT    = path.join(__dirname, 'backups');

const sha = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
const mb  = b => (b / 1048576).toFixed(1) + ' MB';

async function fetchTable(table) {
  let rows = [], from = 0;
  for (;;) {
    const { data, error } = await supabase.from(table).select('*')
      .range(from, from + 999).order('id', { ascending: true });
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

/** Recursively walk a bucket — Storage list() is not recursive. */
async function listBucket(bucket, prefix = '') {
  const out = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
  for (const entry of data || []) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) out.push(...await listBucket(bucket, full)); // folder
    else out.push({ path: full, size: entry.metadata?.size ?? 0 });
  }
  return out;
}

async function verifyLatest() {
  const dirs = fs.readdirSync(ROOT).filter(d => d.startsWith('full-')).sort();
  if (!dirs.length) { console.error('No full-* backup found. Run without --verify first.'); process.exit(1); }
  const dir = path.join(ROOT, dirs[dirs.length - 1]);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')));
  console.log(`Verifying ${dirs[dirs.length - 1]} against live storage\n`);

  let missingLocally = 0, newRemote = 0;
  const backedUp = new Set(manifest.storage.map(o => `${o.bucket}/${o.path}`));
  for (const bucket of BUCKETS) {
    const live = await listBucket(bucket);
    for (const o of live) {
      const key = `${bucket}/${o.path}`;
      if (!backedUp.has(key)) { console.log(`  NOT IN BACKUP  ${key}`); newRemote++; }
    }
    for (const o of manifest.storage.filter(x => x.bucket === bucket)) {
      const f = path.join(dir, 'storage', bucket, o.path);
      if (!fs.existsSync(f)) { console.log(`  FILE MISSING LOCALLY  ${bucket}/${o.path}`); missingLocally++; }
    }
  }
  console.log(`\nobjects in backup: ${manifest.storage.length}`);
  console.log(`missing from local copy: ${missingLocally}`);
  console.log(`in storage but not in this backup (uploaded since): ${newRemote}`);
  process.exit(missingLocally ? 1 : 0);
}

async function main() {
  if (VERIFY) return verifyLatest();

  const date = new Date().toISOString().split('T')[0];
  const dir = path.join(ROOT, `full-${date}`);
  fs.mkdirSync(path.join(dir, 'db'), { recursive: true });

  console.log(`\nAerialDeck FULL backup — ${date}`);
  console.log(`-> ${dir}\n`);

  // ---- database ----
  const manifest = { date, timestamp: new Date().toISOString(), supabaseUrl: SUPABASE_URL, tables: {}, storage: [] };
  let totalRows = 0;
  console.log('DATABASE');
  for (const t of TABLES) {
    try {
      const rows = await fetchTable(t);
      fs.writeFileSync(path.join(dir, 'db', `${t}.json`), JSON.stringify(rows, null, 2));
      manifest.tables[t] = rows.length;
      totalRows += rows.length;
      console.log(`  ok  ${t.padEnd(18)} ${String(rows.length).padStart(5)} rows`);
    } catch (e) {
      console.error(`  ERR ${t}: ${e.message}`);
      manifest.tables[t] = { error: e.message };
    }
  }
  console.log(`  ${totalRows} rows total\n`);

  if (DB_ONLY) {
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log('--db-only: storage skipped.');
    return;
  }

  // ---- storage ----
  console.log('STORAGE');
  let bytes = 0, files = 0, errors = 0;
  for (const bucket of BUCKETS) {
    const objects = await listBucket(bucket);
    console.log(`  ${bucket}: ${objects.length} object(s)`);
    for (const o of objects) {
      const dest = path.join(dir, 'storage', bucket, o.path);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const { data, error } = await supabase.storage.from(bucket).download(o.path);
      if (error) { console.error(`    ERR ${o.path}: ${error.message}`); errors++; continue; }
      const buf = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(dest, buf);
      manifest.storage.push({ bucket, path: o.path, size: buf.length, sha256_16: sha(buf) });
      bytes += buf.length; files++;
      if (files % 25 === 0) console.log(`    ...${files} files, ${mb(bytes)}`);
    }
  }

  manifest.totalRows = totalRows;
  manifest.storageFiles = files;
  manifest.storageBytes = bytes;
  manifest.storageErrors = errors;
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Publish a status marker so the dashboard (running on Vercel) can report when
  // the last backup ran — backups happen locally, so the app cannot see them otherwise.
  try {
    const status = {
      completedAt: new Date().toISOString(),
      date,
      totalRows,
      storageFiles: files,
      storageBytes: bytes,
      storageErrors: errors,
      ok: errors === 0
    };
    const { error: sErr } = await supabase.storage.from('aerialdeck-files')
      .upload('backup-status.json', Buffer.from(JSON.stringify(status, null, 2)),
              { contentType: 'application/json', upsert: true });
    if (sErr) console.error(`  ! could not publish backup status: ${sErr.message}`);
    else console.log('  backup status published to dashboard');
  } catch (e) {
    console.error(`  ! could not publish backup status: ${e.message}`);
  }

  console.log(`\n===== DONE =====`);
  console.log(`tables : ${TABLES.length}  (${totalRows} rows)`);
  console.log(`files  : ${files}  (${mb(bytes)})${errors ? `  ERRORS: ${errors}` : ''}`);
  console.log(`saved  : ${dir}`);
  if (errors) process.exitCode = 1;
}

main().catch(e => { console.error('Backup failed:', e.message); process.exit(1); });
