# Google Drive setup for the daily IAA zone archive

One-off, about ten minutes. After this, every IAA zone release is copied into a
Google Drive folder automatically by Vercel — no laptop involved.

You need to do these bits yourself: they're inside your Google account and I
can't (and shouldn't) hold your admin credentials.

## Why a service account and a Shared Drive

A service account has **no storage quota of its own**. Uploading into a personal
*My Drive* folder fails with "storage quota exceeded". Files in a **Shared
Drive** are owned by the drive rather than the uploader, so it works. aerial.ie
is Google Workspace, so Shared Drives are available.

---

## 1. Create the service account

1. <https://console.cloud.google.com/> — create a project, or reuse one.
2. **APIs & Services → Library** → search **Google Drive API** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
   - Name it something like `aerialdeck-zones`.
   - No roles needed. Skip the optional steps.
4. Open the new service account → **Keys → Add key → Create new key → JSON**.
   A `.json` file downloads. **Treat it like a password.**
5. Copy the `client_email` from that file — it looks like
   `aerialdeck-zones@your-project.iam.gserviceaccount.com`.

## 2. Make the Drive folder

1. In Google Drive, left sidebar → **Shared drives** → **New**.
   Call it e.g. `Aerial Compliance`. (An existing Shared Drive is fine.)
2. Inside it, create a folder, e.g. `IAA Zones`.
3. Share that **folder** with the `client_email` from step 1, as
   **Content manager**.
4. Open the folder and copy its id from the URL — the part after `/folders/`:
   `https://drive.google.com/drive/folders/`**`1AbCdEfGh...`**

## 3. Put the credentials in Vercel

Vercel → project `aerialdeck-2026` → **Settings → Environment Variables**.
Add three, for **Production** (tick Preview too if you want previews archiving):

| Name | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | the entire contents of the JSON key file, pasted as one value |
| `GDRIVE_FOLDER_ID` | the folder id from step 2 |
| `CRON_SECRET` | any long random string — without it the cron endpoint is open to anyone who knows the path |

Redeploy (or just push) so the new variables are picked up.

## 4. Check it worked

Trigger the job by hand:

```
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://aerialdeck-2026.vercel.app/api/cron/check-iaa-zones
```

You should get back `"drive": { "configured": true, "uploaded": N, ... }` and see
the `.geojson` files appear in the Drive folder. The first run backfills every
version already archived, not just the newest.

## Notes

- **Nothing breaks before you do this.** With the variables unset, the Drive step
  logs "not configured" and skips; the Supabase archive carries on.
- **Drive is a mirror, not the record.** Supabase is the system of record. A
  Drive failure is logged but never fails the daily check.
- Re-running is safe. Files already in the folder are skipped by name, and the
  7MB body is only downloaded when Drive is actually missing that version.
- **If you ever rotate the key**, just replace `GOOGLE_SERVICE_ACCOUNT_JSON`.
  There is no browser consent and no refresh token to expire.
