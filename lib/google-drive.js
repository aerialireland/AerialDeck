/**
 * Minimal Google Drive uploader for a service account.
 *
 * Hand-rolled rather than pulling in googleapis: that package is tens of MB and
 * this needs two REST calls. Signing a JWT is ~20 lines with node:crypto.
 *
 * Requires a Shared Drive, not My Drive. A service account has no storage quota
 * of its own, so uploading into a personal My Drive folder fails with
 * "storage quota exceeded" — but files in a Shared Drive are owned by the drive,
 * so it works. aerial.ie is Workspace, so Shared Drives are available.
 *
 * Environment:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  the service account key file, as one line
 *   GDRIVE_FOLDER_ID             the target folder's id (inside a Shared Drive)
 *
 * If either is unset every call is a no-op, so nothing breaks before setup.
 */

const crypto = require('crypto');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/drive';

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const folderId = process.env.GDRIVE_FOLDER_ID;
  if (!raw || !folderId) return null;
  let key;
  try { key = JSON.parse(raw); }
  catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON'); }
  if (!key.client_email || !key.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key');
  }
  // Vercel's UI turns real newlines into \n; restore them or the key won't parse.
  key.private_key = key.private_key.replace(/\\n/g, '\n');
  return { key, folderId };
}

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function getAccessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: key.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const signature = b64url(
    crypto.createSign('RSA-SHA256').update(`${header}.${claim}`).sign(key.private_key)
  );

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${signature}`
    })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Google token request failed: ${body.error_description || body.error || res.status}`);
  return body.access_token;
}

/** Is a file with this name already in the folder? */
async function findExisting(token, folderId, name) {
  const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}` +
    '&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true';
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive search failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return (body.files || [])[0] || null;
}

/**
 * Upload text content as a file. Skips if a file of that name is already there,
 * so it is safe to run daily and safe to re-run for backfill.
 *
 * @returns {Promise<{skipped:boolean, id?:string, reason?:string}>}
 */
async function uploadIfMissing(name, text, mimeType = 'application/geo+json') {
  const creds = credentials();
  if (!creds) return { skipped: true, reason: 'Drive not configured' };

  const token = await getAccessToken(creds.key);

  const existing = await findExisting(token, creds.folderId, name);
  if (existing) return { skipped: true, id: existing.id, reason: 'already in Drive' };

  const boundary = 'aerialdeck-' + crypto.randomBytes(8).toString('hex');
  const metadata = { name, parents: [creds.folderId] };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(JSON.stringify(metadata)),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    Buffer.from(text, 'utf-8'),
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    }
  );
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status} ${await res.text()}`);
  const out = await res.json();
  return { skipped: false, id: out.id };
}

/** Does a file with this name already exist in the target folder? */
async function exists(name) {
  const creds = credentials();
  if (!creds) return false;
  const token = await getAccessToken(creds.key);
  return (await findExisting(token, creds.folderId, name)) !== null;
}

const isConfigured = () => credentials() !== null;

module.exports = { uploadIfMissing, exists, isConfigured };
