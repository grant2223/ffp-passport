# FFP PASSPORT — MASTER (single source of truth)

> ⚠️ COMMIT THIS FILE TO GITHUB. The repo→workspace sync wipes any local file not in GitHub
> (it already wiped this doc once). Keep memory here and push it so it survives.

## 0. OPERATING PROTOCOL (every change)
1. READ the real file before editing. 2. CROSS-REFERENCE the loader(s) for any panel. 3. VERIFY don't claim (read code / query DB / `node --check`). 4. No blind patching. 5. Validate (extract inline JS → node --check; 0 NUL bytes). 6. Deploy: present file + version; large files UPLOAD not paste. 7. State the checks done in each reply.

## 1. THE auth.uid() TRAP — affects MEMBERS *and* PROVIDERS (not just members)
- Members AND providers sign in via the custom JWT (ffp-api-integration applies it as a global Authorization header). **`auth.uid()` does NOT reliably resolve from this for members or providers.**
- Verified 2026-06-01: with `auth.uid()` null, `providers WHERE owner_user_id=auth.uid()` = 0 rows → every provider RLS-gated **INSERT/UPDATE/DELETE** on events/experiences/challenges silently affects **0 rows, no error** ("Deleted/Saved" toast but nothing changes). Reads work only because live listings are publicly readable.
- Admins use real Supabase Auth → auth.uid() works for them.
- **FIX PATTERN:** SECURITY DEFINER RPC taking the id explicitly (member id or provider id), bypassing auth.uid().

### RPCs already built (live in DB)
Member: `get_match_pool(p_me)`, `handle_connection`, `log_activity`, `host_meetup`, `join_meetup`, `rsvp_event`, `apply_experience`, `submit_feedback`.
Provider: `provider_delete_listing(p_kind,p_provider,p_id)` — DONE (delete works).
**STILL TODO (same trap, still broken):** provider **edit** (UPDATE) and **create** (INSERT) for events/experiences/challenges → need `provider_save_listing`-style RPCs. Member **payouts** (`payouts`/`transactions` inserts in earnings loader) + **fitness/calorie** writes (`profile_meta`/`activity_logs`/`food_logs`).

## 2. DEPLOY
Host: Netlify (ffppassport.com) ← github.com/grant2223/ffp-passport (`main`). Served files: `ffp-member-dashboard.html`, `ffp-provider-dashboard.html`, `ffp-admin-dashboard.html`, login/profile-complete/apply; loaders in repo root + `assets/`. Provider dashboard has a bottom-left build stamp (`FFP build vNN`) to confirm a deploy landed.
- The ZIP-download/copy sync can corrupt files (NUL-padding + truncation) in the workspace; GitHub itself was verified clean. So: trust GitHub + the DB + the browser console over raw local reads; `node --check` every JS before trusting/deploying it.

## 3. CURRENT FIXES PENDING DEPLOY (2026-06-01)
- `ffp-provider-events-loader.js`, `ffp-provider-experiences-loader.js`, `ffp-provider-challenges-loader.js` — delete now via `provider_delete_listing` RPC (fixes "delete does nothing").
- `ffp-provider-dashboard.html` v23 — notifications are a top full-width banner (was an easy-to-miss corner toast); build stamp v23.

## 4. KNOWN-BROKEN / NEXT
- Provider EDIT + CREATE (events/exp/challenges) — silent 0-row via auth.uid trap → RPCs needed.
- `ffp-provider-quests-loader.js` floods 160+ console 404s hitting `/api/quests/provider/<id>/checkins` — backend route missing (backend source in `assets/ffp-passport-backend-main`).
- Member payouts + fitness/calorie writes — auth.uid trap → RPCs.
- Notification banner should be applied to member + admin dashboards too (same corner-toast issue).

## 5. FORM STANDARDS (recreate detail later)
Activity+Level full-screen picker; Time native tap `<input type=time>`; Country→City cascade (Experiences default All countries); Age From/To; labels weight 600 (not bold); full-screen data-entry on mobile; primary CTA yellow #FFCC00; Location field + Google Maps link; notifications = top banner; money display USD.
