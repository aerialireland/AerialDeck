# AerialDeck — U.F.101 Creator Integration Plan

**Date:** 21 July 2026
**Author:** drafted with Claude, for Rob O'Connor
**Status:** proposal — not yet implemented

---

## 0. What you asked for

Restructure AerialDeck into a portal:

```
AerialDeck (main dashboard / landing page)
├── U.F.101 Creator     ← new, ported from UF101-Console
└── Flight Plan         ← the current AerialDeck, unchanged
```

Nothing in the Flight Plan section changes. Step one is getting the U.F.101 Creator
into the AerialDeck environment.

---

## 0.5 Doing this without risking either tool

Both tools are in production use. The plan below is built so that **nothing which
currently works gets modified**. Four rules make that true:

**Rule 1 — Flight Plan doesn't move.**
`public/index.html` stays exactly where it is, at `/`, with a zero-byte diff. The portal
goes at `/home` instead. Flipping `/` to the portal is a separate, one-line, trivially
reversible change you make later once you're happy. This removes the rename risk (Vercel
routing, bookmarks, the client-side login gate) entirely rather than mitigating it.

**Rule 2 — the console is copied, never touched.**
`uf101.aerial.ie` on the Blacknight VPS keeps running throughout, unmodified. The
AerialDeck version is a parallel copy. If it misbehaves, the team just keeps using the
live one — there is no rollback to perform, because **the existing tool is the fallback**.
The two run side by side until you're satisfied.

**Rule 3 — the AerialDeck copy is read-only on flight data until you cut over.**
This is the one genuinely dangerous path. `save-flights.php` overwrites the *entire*
dataset on every save with no locking. Two apps writing to one `flights-data.json` is not
a theoretical risk — it's guaranteed silent data loss the first time someone saves in each.
So the AerialDeck copy loads and displays flights but **cannot save**, until the cutover
change disables saving on the VPS copy in the same commit. Read-only can't clobber.

**Rule 4 — everything lands on a branch first.**
AerialDeck is on GitHub (`aerialireland/AerialDeck`) and Vercel project
`aerialdeck-2026`. Vercel builds a preview URL for every branch automatically. All of this
is reviewed on a preview deployment; production only changes when you merge.

### What still carries risk

Two things this doesn't eliminate, both manageable:

- **`server.js` is shared.** Adding routes for the new pages touches the file Flight Plan
  depends on. Mitigation: the routes are purely additive, appended after the existing ones,
  and Express matches in order — no existing route changes behaviour. Small but non-zero.
- **Auth posture would get *worse* for the console.** `express.static` serves `public/`
  before the session middleware, so anything dropped in there is publicly readable. The
  console currently sits behind a real server-side PHP password gate; AerialDeck's gate is
  client-side. So `uf101-creator.html` must be served through a `requireAuth` route, not
  from `public/`. Worth doing properly rather than inheriting AerialDeck's weaker posture.

### Before starting

The working tree is dirty — `package.json` / `package-lock.json` have an uncommitted
dependency reorder, plus a lot of untracked working files (`_tmp_match/`, xlsx reviews,
`backups/`). Commit or stash that first so the integration branch has a clean, readable
diff. And take a copy of `flights-data.json` off the VPS before anything else.

---

## 1. What I found (verified against source, not just the spec)

### 1.1 AerialDeck already knows about U.F.101

This is the most useful thing I found, and the spec didn't have it. AerialDeck already
models U.F.101 in three places:

| Where | What |
|---|---|
| `server.js` evidence categories | `uf101Permission`, `uf101Application` are valid upload categories on a flight plan |
| `index.html` compliance scoring | A plan is marked non-compliant with "UF101 Perm" / "UF101 App" if those are missing |
| `index.html` flight geography map | A "UF101 Approval layer" renders the original approved KML as a dashed orange overlay, toggled in Settings |

So today the workflow is: make the form in the console → download the PDF → manually
re-upload it to AerialDeck as evidence. **The integration's real prize is closing that
loop** — the Creator writes its PDF and KML straight onto the flight plan as
`uf101Application` evidence, and the KML it exports becomes the UF101 Approval layer
automatically.

That is a much better join than the "consume flights-data.json" path the spec proposed.

### 1.2 The stacks half-match

AerialDeck already loads **Leaflet 1.9.4** and **Turf 6** from CDN — the exact versions
the console uses. Zone detection and KML export will run unmodified.

What doesn't match: the console is React 18 + Babel-standalone compiled in the browser;
AerialDeck is vanilla JS with `document.querySelector`. And `public/index.html` is already
6,810 lines. Merging the console's 1,802 lines of JSX into it would be a bad trade.

### 1.3 Corrections to the spec

Three things in the brief are wrong or overstated. They change the plan:

**a) There are 5 flight records, and 2 are called "Test" and "Test 2".**
The real dataset is three flights: `D8 IMMA Arbour`, `Malahide`, `Rathgar`. Total file
size 8.9 KB. The spec frames migrating away from `flights-data.json` as a cost worth
avoiding — it isn't. Migrating three records is an afternoon, not a project. **I'd
recommend revisiting your "keep it on the VPS" decision on this basis** (see §4).

**b) "Invariant 1 — historical zone freezing" is not actually in effect.**
The spec calls `geojsonVersion` a load-bearing audit-trail invariant. The code does write
it (line 1010), but **none of the 5 saved records have the field** — they all predate the
feature. Same for `terrainElevation`. So there is no audit trail to preserve yet; there's
a feature that will start working on the next save. Worth knowing: you are not
constrained by existing data here, you're free to design the field properly.

**c) The zone dataset is 7.2 MB.** `iaa-zones.js` is 7.2 MB and `geojson-archive/` is
another 7.2 MB. The spec doesn't mention size. This matters a lot for AerialDeck, which
deploys to Vercel from git — see §3.4.

### 1.4 Current AerialDeck shell

- Single page `public/index.html`, served by `express.static` **before** the session
  middleware. The HTML is public; the login gate is client-side and the real protection
  is `requireAuth` on the 44 `/api/*` routes.
- Navigation is a flat 8-button tab strip (`.tab-btn[data-tab]`) with a `tabMap` object
  and one click handler at line ~5150. There is no router and no page abstraction.
- Deployed to Vercel; `vercel.json` rewrites everything to `server.js`.

---

## 2. Proposed structure

```
/                    Flight Plan          → current public/index.html, UNTOUCHED
/home                AerialDeck portal    → NEW views/home.html
/uf101               U.F.101 Creator      → NEW views/uf101-creator.html (copied)
```

Three separate HTML files, one shared header. Rationale:

- **Flight Plan is not modified at all** — not moved, not renamed, zero diff. See §0.5 Rule 1.
- The two new pages live in a `views/` directory served through `requireAuth`, **not** in
  `public/`, so they aren't exposed by `express.static` (§0.5, auth posture).
- The console keeps React+Babel in its own file, exactly as its editing convention requires
  ("do not split the file into modules"). No JSX ever enters AerialDeck's vanilla JS.
- No build step is introduced anywhere. Both apps stay dependency-free.

The landing page is deliberately thin: brand header, two large cards (U.F.101 Creator,
Flight Plan), and — per your note — a link through to the existing bento dashboard, which
stays where it is inside Flight Plan. The bento grid does not move.

**URL compatibility:** every existing bookmark keeps working, because `/` doesn't change.
The portal is purely additive at `/home`. Once you're happy with it, promoting the portal
to `/` is a one-line route swap you can make — and undo — in seconds.

---

## 3. Work breakdown

All phases happen on branch `feat/uf101-portal`, reviewed on the Vercel preview URL.

### Phase 0 — Housekeeping

0. Commit/stash the dirty working tree. Pull a fresh copy of `flights-data.json` off the
   VPS and keep it outside the repo.

### Phase 1 — Shell (no console code yet)

1. Add `views/home.html` — landing page, reusing AerialDeck's existing CSS variables,
   Inter font and favicons so it looks native.
2. Add `GET /home` in `server.js`, behind `requireAuth`, appended after existing routes.
3. `public/index.html` — **no change.** Flight Plan is reached from the portal by a plain
   link to `/`. No header injection, no diff.

**Deliverable:** portal live at `/home` with two cards, one of which is a placeholder.
Production `/` is bit-for-bit what it is today. Safe to merge on its own.

### Phase 2 — Console lands in AerialDeck (read-only)

4. **Get UF101-Console into git first.** The spec is right and it should happen before
   anything else — 14 timestamped HTML copies is not version control, and I'm about to
   fork the file. Its own repo, so its history stays separate from AerialDeck's.
5. Copy `uf101-creator.html` → `views/uf101-creator.html` verbatim. **The VPS original is
   never edited.** Add `GET /uf101` behind `requireAuth`. Confirm it loads and draws.
6. Decide zone-dataset hosting (§3.4) and repoint `<script src="iaa-zones.js?v=...">`.
7. **Disable saving in the AerialDeck copy** — load flights read-only from a snapshot of
   `flights-data.json`; the Save button is hidden. Per §0.5 Rule 3, this is what stops the
   two copies from clobbering each other. Saving still happens on the VPS as it does today.
8. Restyle the console's chrome to match AerialDeck — header, buttons, colour variables.
   The map, form and `generatePDF` are **not** touched.

**Deliverable:** U.F.101 Creator viewable inside AerialDeck, running alongside the live
VPS console. Same PDF output. Nobody's workflow has changed yet — they can use either.

### Phase 2b — Cutover (only when you're satisfied)

9. Enable saving in AerialDeck and disable it on the VPS **in the same change**, so there
   is never a window with two writers. Point `uf101.aerial.ie` at AerialDeck, or leave it
   up read-only as an archive.

### Phase 3 — The actual win (separate conversation)

11. Push generated PDF + KML directly onto a flight plan as `uf101Application` evidence.
12. Surface `zoneAuthority` — the dataset already carries the email, service name and
    `intervalBefore` notice period for every zone. The console detects zones but never
    tells you who to send the form to. This is cheap and high-value.
13. Link a UF.101 record to an AerialDeck flight plan (the join key the spec asks for).

### 3.4 The 7.2 MB zone dataset — decide before Phase 2

| Option | Pros | Cons |
|---|---|---|
| **Commit to AerialDeck repo** | Simplest; one deploy | +14 MB repo, and it grows every IAA release; slow clones |
| **Keep serving from the VPS** | Zero repo impact; one copy, one update procedure | Cross-origin fetch; AerialDeck now depends on the Blacknight box being up |
| **Supabase Storage** | Already in your stack; versioned; no repo bloat | Needs an upload step in the zone-update runbook |

**Recommendation: Supabase Storage.** You already use it for evidence files, it keeps the
archive versioned for the audit trail, and it removes the Blacknight dependency — which
matters if the goal is eventually to retire that VPS.

---

## 4. Data storage — worth reopening

You chose *keep `flights-data.json` on the VPS*. That's a reasonable instinct, but two
findings weaken it:

1. **It's 3 real records.** The migration cost you're avoiding is near zero.
2. **It forces an awkward architecture.** If the Creator page is served from AerialDeck
   (Vercel) but saves to `save-flights.php` (Blacknight), you get a cross-origin POST that
   the PHP session cookie won't authorise — the two apps have separate logins. I'd have to
   proxy it through `server.js` anyway, so you end up maintaining *both* servers plus a
   proxy, rather than one.

Also inherited: `save-flights.php` overwrites the entire dataset on every save with no
locking. Fine at 3 users; it's a silent data-loss bug the moment two people save at once.

**Recommendation:** a `uf101_flights` table in Supabase, migrating the 3 real records and
dropping the 2 test ones. Per-record writes, no concurrency bug, one auth system, one
server, and UF.101 records can foreign-key to flight plans — which Phase 3 needs anyway.

If you'd still rather keep the JSON, the fallback is: `server.js` gains
`GET/POST /api/uf101/flights` which reads and writes `flights-data.json` **stored in
Supabase Storage as a single blob**. Same file format, same code shape, but no VPS
dependency and no cross-origin problem. That's the smallest change that still works.

---

## 5. Proving Flight Plan didn't change

With the revised plan this is trivial, which is the point:

```bash
git diff main..feat/uf101-portal -- public/index.html    # must be empty
```

Empty diff, so there is nothing to prove behaviourally. `server.js` is the only shared
file that changes, so review that diff line by line — it should be additive only.

`_tmp_match/snapshot.mjs` is still worth running against the deployed preview as a
belt-and-braces check that the dashboard renders identical data before and after, since
`server.js` did change.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| **Two writers to one `flights-data.json`** — whole-file overwrite, no locking. Guaranteed silent data loss | The single most important control: AerialDeck copy is **read-only until cutover** (§0.5 Rule 3). Writers are swapped in one change, never overlapping |
| Console has no git history; I'd be forking a file with 14 undocumented backups | Get it into git as step 4, before touching it |
| PDF is submitted to an aviation regulator; any regression is a compliance problem | Don't touch `generatePDF`. Byte-compare generated PDFs from both copies for the same flight |
| Serving the console from `public/` would drop it behind a client-side-only gate — weaker than today's PHP gate | Serve from `views/` via `requireAuth`. Never put it in `public/` |
| Console needs live CDN + Esri tiles + AWS terrain at runtime | Unchanged from today, but now it's a dependency of AerialDeck too. Note it in the README |
| `DEPLOYMENT.md` has the VPS root password in plaintext; `index.php` has the app password | **Do not copy either file into the AerialDeck repo.** Rotate the VPS root password when the console goes into git |
| `server.js` is shared by both sections | Additive routes only, appended after existing ones; review the diff line by line |

---

## 7. Open questions for Rob

1. **Port approach** — my recommendation is *copy in as its own page, keep React*
   (Phase 2 above), restyling only the chrome. Confirm, or do you want a full vanilla-JS
   rewrite eventually?
2. **Storage** — reconsider Supabase given §4, or hold with the JSON-on-VPS decision?
   Note that read-only Phase 2 works either way, so this can be decided later.
3. **Zone dataset hosting** — Supabase Storage, VPS, or repo?
4. **VPS future** — is `uf101.aerial.ie` meant to keep running after this, or is the goal
   to retire the Blacknight box? That changes several answers above.

The `/` URL question is now closed: Flight Plan keeps `/`, portal goes to `/home`.
