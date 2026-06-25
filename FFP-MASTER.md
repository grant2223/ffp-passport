# FFP PASSPORT — MASTER (THE single source of truth — there is only ONE)

> 🥇 THIS IS THE ONLY SOURCE OF TRUTH. Read it first, every session. If any other doc disagrees, MASTER wins.
> All other docs are reference-only and live in `/archive` (consolidated 2026-06-12 — 26 scattered docs, including
> a second file literally named "Source of Truth", were moved there so nothing competes with this file). The
> cross-app contract the booking team reads also lives in the DB `platform_docs` (key='source_of_truth'), unchanged.
> ⚠️ COMMIT THIS FILE TO GITHUB. The repo→workspace sync wipes any local file not in the repo
> (it already wiped this doc once). Memory lives here — push it so it survives. Commit the `/archive` move too.
> Last updated: 2026-06-25 (verified MASTER against the live Supabase DB + backend API — all current. Newest handoff
> is the FORMS OVERHAUL 2026-06-21 / PRO_BUILD 62 at the top of this file. Per file/doc headers read this date: member
> app ffp-member-dashboard.html = v361 title / v362 changelog, but the live constant is `FFP_BUILD='436'` (L8236) —
> AHEAD of the changelog (reconcile, see §B); pro `PRO_BUILD='77'` (L581); admin `build v48`; backend index.js v101. Live DB confirmed:
> all forms/notes/activity RPCs + Stripe Connect health columns present on providers & professionals; Stripe connections
> 0/4 providers, 0/3 pros (none live yet). NOTE: live FRONT-END build not asserted here — the device avatar "Build N"
> stamp is the only truth for what is deployed.
> Prior 2026-06-10: Professionals Portal — PROFESSIONS are a DB taxonomy under the 6 STANDARD categories (Admin →
> Taxonomies → Professions); onboarding/profile use ONE searchable profession picker; Pro home-screen icon = real FFP
> emblem + "Professional" (purple FFP/PRO mark killed). See SESSION STATE 2026-06-10 below.
> Prior 2026-06-07: Member-created Challenges live; Module pairs + cache-bust map; Calorie Tracker extracted; My Meals; Bronco/Beep records.)

## 🚧 BOUNDARIES — DO NOT CROSS (added 2026-06-21 at Grant's explicit, repeated instruction. READ FIRST.)
1. **The PASSPORT member app (`ffp-member-dashboard.html`) is PREMIUM and SEPARATE.** It has NOTHING to do with
   professional/partner sessions, client management, forms or billing. **NEVER edit it as part of professional/partner/
   booking work** — not even a CSS tweak. If the Passport app genuinely needs a change, that is its OWN task: ask first.
2. **Client management = the professional/partner DASHBOARDS + the BOOKING platform — NOT the Passport app.**
   The member-facing side (a member adding/updating their own details, COMPLETING/SIGNING forms) is the BOOKING
   platform's job, never the Passport app.
3. **Hand BOOKING a spec — never build their side.** When the pro/partner side needs the member-facing counterpart,
   write the contract in `FFP-BOOKINGS.md` for the booking team. Never edit the booking repo directly.
4. Pulling a client's identity into a pro/partner record via `pro_client_passport` (already approved) is fine — that is
   a READ of agreed fields, not the Passport app.

## 🧱 PLATFORM STATE & STABILITY / UX ROADMAP — verified 2026-06-25 (READ AFTER BOUNDARIES · ALWAYS APPLY)

> VERIFIED snapshot (live Supabase DB + workspace files read this session) + the standing stability/reliability/UX
> plan. Durable memory: re-verify with a tool before contradicting (RULE 0); the device "Build N" stamp is the only
> truth for what is LIVE. Findings are facts read on 2026-06-25; tracking-log statuses are OPEN until a tool confirms a fix.

### A. Architecture (verified file map)
- **Frontend (Netlify · ffppassport.com · repo grant2223/ffp-passport@main):** 4 dashboards — `ffp-member-dashboard.html`
  (Passport member app, PREMIUM/SEPARATE), `ffp-provider-dashboard.html` (facility/partner), `ffp-professional-dashboard.html`
  (coach/pro), `ffp-admin-dashboard.html` (admin) — plus `login.html`, `ffp-profile-complete.html`, `provider-signup.html`,
  marketing pages (index/about/partner/privacy/terms/refund/welcome).
- **Module-pair pattern (the spine):** each big panel = a deferred CORE (`assets/ffp-<panel>-core.js`, defines `window.X`)
  + a lazy LOADER (`assets/ffp-<panel>-loader.js` or root `ffp-<role>-<panel>-loader.js`, fetched when the panel opens).
  ~63 loaders (admin ×22, provider ×17, pro ×4, member ×2, asset feature loaders ×~15). CHANGE ONE → CHECK ITS PARTNER.
- **Cache-bust:** loader change → bump the role build constant; CORE/module change → bump ITS `?v=N`. Always BOTH sides.
- **Backend (Vercel · ffp-passport-backend.vercel.app):** ONE Express file
  `assets/ffp-passport-backend-main/ffp-passport-backend-main/index.js` (v101, ~266KB) — auth/JWT mint, Resend email,
  notify, quests, Stripe Connect, agent. Root verified live 2026-06-25: `{"status":"FFP Passport API running"}`.
- **DB (Supabase `kxzyuofecmtymablnmak` "FFP Passport 2026", Postgres 17.6, ACTIVE_HEALTHY):** ONE DB shared by Passport +
  Find Fit People. **Members are the `anon` role** (anon key + custom JWT) → every member write MUST go through a
  SECURITY DEFINER RPC that asserts the caller internally (the auth.uid trap). Stripe: 0/4 providers, 0/3 pros connected.
- **Two apps, one core:** Passport = identity/loyalty/social (no paid booking here). Find Fit People = marketplace
  (book/pay, Stripe/AED). Membership fields + $99 subscription owned by Passport; per-booking payments owned by FFP.

### B. Build reality (workspace constants read 2026-06-25 — device "Build N" stamp is the ONLY live truth)
- **Member** `ffp-member-dashboard.html`: live `FFP_BUILD='436'` (L8236); header is v361 title / v362 changelog ("416→417", L4).
  ⚠️ the constant (436) is AHEAD of the documented changelog (417) — reconcile so the changelog matches the real build.
- **Pro** `ffp-professional-dashboard.html`: live `var PRO_BUILD='77'` (L581), v76 changelog. ⚠️ stale comment "PRO_BUILD='7'" at L6 — ignore it.
- **Admin** `ffp-admin-dashboard.html`: visible stamp `build v48` (L1534), v47→v48 header. OK.
- **Provider** `ffp-provider-dashboard.html`: header v67. (In-app stamp not re-grep'd this turn — verify before bumping.)

### C. DB AUDIT — live Supabase advisor findings (2026-06-25). Status OPEN unless noted. Do NOT apply blind — see §D order.
**Security (19 ERROR · 695 WARN · 39 INFO):**
- 🔴 **P0 — 11 public tables with RLS DISABLED** (directly reachable with the anon key): `provider_appointments`,
  `provider_trainer_slots`, `provider_trainer_blocks`, `provider_services`, `provider_service_coaches`, `provider_packages`,
  `provider_client_packages`, `pro_services`, `quest_tasks`, `quest_task_completions`, `feature_days`. → Enable RLS. If a
  table is only ever touched via SECURITY DEFINER RPCs, RLS-on + no-policy suffices (RPCs bypass RLS). VERIFY each table's
  access path FIRST so reads don't break.
- 🔴 **P0 — 8 SECURITY DEFINER views** run as creator, bypassing the caller's RLS: `sessions_public`, `professionals_public`,
  `provider_plans_public`, `provider_staff_public`, `session_templates_public`, `pro_packages_public`, `pro_videos_public`,
  `event_tickets_public`. → Recreate with `security_invoker=on` (PG15+) unless definer is deliberate.
- 🟠 **P1 — always-true RLS policy:** `provider_applications.provider_apps_self_insert` (INSERT WITH CHECK always true) →
  anyone can insert applications (spam vector). Scope the check.
- 🟠 **P1 — 3 public buckets allow LISTING** (`avatars`, `form-files`, `quest-images`): broad SELECT lets clients list ALL
  files; `form-files` may expose other members' signed forms. → Drop the list policy (object URLs still work).
- 🟡 **P2 — 3 functions w/ mutable search_path** (`ffp_haversine_m`, `ffp_jsonb_to_text_array`, `ffp_validate_booking_details`)
  → pin `search_path`. **Leaked-password protection DISABLED** → enable HIBP in Auth (one-click).
- ✅ **BY DESIGN (no action):** 687 "anon/authenticated can execute SECURITY DEFINER function" WARNs + 39 "RLS enabled, no
  policy" INFOs = the FFP anon-RPC model. Keep — but each such RPC MUST assert the caller internally.

**Performance (216 findings):**
- 🟠 **P1 — auth_rls_initplan ×71:** RLS policies re-evaluate `auth.<fn>()`/`current_setting()` PER ROW. Wrap as
  `(select auth.uid())` → big, safe latency win on the busiest tables (members, activity_logs, …).
- 🟠 **P1 — multiple_permissive_policies ×124:** consolidate overlapping permissive policies (each runs per row).
- 🟡 **P2 — unindexed_foreign_keys ×46:** add covering indexes (hot FKs first: activity_logs.*, bookings, pro_*).
- 🟡 **P2 — unused_index ×20 / duplicate_index ×1:** drop the duplicate on `members`
  (`members_referral_code_key` vs `members_referral_code_unique`); review "unused" before dropping (new-project low traffic).

### D. STABILITY / RELIABILITY / UX ROADMAP — so the app is QUICK, EASY, SMOOTH (do P0→P2, one change at a time, verify after each)
**P0 — correctness, security, trust:**
1. Lock down the 11 RLS-disabled tables + 8 SECURITY DEFINER views (§C). Get Grant's go; apply per-table; re-run advisors.
2. Reconcile version tracking: ONE constant per surface; the header changelog MUST equal the live constant (member 436 vs 417).
**P1 — speed the user feels:**
3. auth_rls_initplan rewrite + permissive-policy consolidation → faster reads on every authenticated query.
4. De-fragile the **1.75 MB / 13.3k-line member-dashboard monolith** by continuing panel extraction (done: Fitness Stats;
   next: Calorie Tracker). Smaller first paint, safer edits, fewer "works then breaks" regressions.
5. Remove repo footguns: stray `ffp-member-dashboard.html.bak_earnings_extract` (1.73 MB) + `versions/` dupe invite editing
   the wrong file. Keep history in git, not as live-folder duplicates.
**P2 — polish & headroom:**
6. FK covering indexes + duplicate-index cleanup; bucket-listing, search_path, and HIBP hardening.
7. Standardise loader headers so every file's `vN` is unambiguous.

### E. ISSUES & UPDATES TRACKING LOG (append newest on top — id · date · area · severity · status)
- I-008 · 2026-06-25 · DB/security · P2 · OPEN — 3 mutable-search_path fns; leaked-password protection off.
- I-007 · 2026-06-25 · DB/perf · P2 · OPEN — 46 unindexed FKs; 20 unused + 1 duplicate index (members.referral_code).
- I-006 · 2026-06-25 · DB/security · P1 · OPEN — provider_applications always-true INSERT; 3 public buckets list-exposed.
- I-005 · 2026-06-25 · structure · P1 · OPEN — member dashboard monolith 1.75 MB + 1.73 MB .bak + versions/ dupe.
- I-004 · 2026-06-25 · DB/perf · P1 · OPEN — auth_rls_initplan ×71 + multiple_permissive_policies ×124.
- I-003 · 2026-06-25 · versioning · P1 · OPEN — member FFP_BUILD 436 vs changelog 417; pro stale "='7'" comment.
- I-002 · 2026-06-25 · DB/security · P0 · OPEN — 8 SECURITY DEFINER `*_public` views bypass caller RLS.
- I-001 · 2026-06-25 · DB/security · P0 · OPEN — 11 public tables RLS-disabled (list in §C).

### F. ALWAYS APPLY (committed to memory)
1. **Verify before claiming (RULE 0)** — read the live file/DB THIS turn; the device Build stamp is the only "live" truth.
2. **One source of truth per thing** — reuse the canonical component/RPC; never reinvent; bump exactly one version constant.
3. **Member Passport app is OFF-LIMITS** for pro/partner/booking work (Boundaries). Hand BOOKING a spec; never build their side.
4. **Every member write = a SECURITY DEFINER RPC** that asserts the caller; never rely on client-side RLS for members.
5. **Root-cause, world-class, all devices — never a patch;** reproduce + verify in a render before sharing.
6. **Keep THIS section current** and append to the tracking log (§E) as issues are found/fixed.

## ⏩ HANDOFF — read first (last worked: 2026-06-21, World-class forms + prose + preview + 16px)

**FORMS OVERHAUL (2026-06-21) — DB live; deploy 4 dashboards + bump PRO_BUILD 62 + 1 small BOOKING change.**
- New read-only field type **`statement`** = written prose the client reads (intro paragraphs, legal WARNING). Default
  waivers rebuilt around it so they read like real waivers, not just checkboxes. **Facility** waiver (providers) vs
  **Professional** waiver (pros) differ in wording. Comprehensive **PAR-Q** (13 conditions + intro prose + declaration).
  Forms only ask the GAPS (emergency contact, medical, consents, signature) — name/DOB/gender/nationality/email/phone
  come from the Passport. Seeds: `seed_default_form_templates` (providers) + `seed_default_pro_form_templates` (pros)
  redefined; all existing auto-seeded templates deactivated + re-seeded (assigned forms keep their own snapshot). Verified:
  every provider/pro has a 12-field waiver (3 prose blocks) + 19-field PAR-Q.
- **PREVIEW**: both builders (partner `cpPreview`/`_ffpFormPreview` in ffp-provider-dashboard.html; pro `afPreview`/
  `_ffpFormPreview` in ffp-professional-client-loader.js) now have a Preview button that renders exactly what the member
  sees (all field types incl. statement prose + signature). Builder renders a TEXTAREA for statement fields (single-line
  inputs strip newlines); `_cpRenderForms`/`afRender` skip statements in the completed-answers view.
- **16px iOS-zoom guard:** added `input,select,textarea,.input,.select,.textarea{font-size:16px!important}` to the
  **provider, professional and admin** dashboards (the management side). The member Passport app is SEPARATE (see
  Boundaries) — its 16px is the booking/Passport team's job, specced in FFP-BOOKINGS.md, NOT done here.
- ⚠️ BOOKING (1 small change — relay to booking team; statements currently render as a text input there until done):
  in `js/forms.js` — (a) `fieldInput`: `if(f.type==="statement"||f.type==="info") return "";`  (b) `fieldBlock`: 
  `if(f.type==="statement"||f.type==="info") return '<div style="font-size:13.5px;color:#3a4a4e;line-height:1.65;white-space:pre-wrap;margin:0 0 14px;">'+esc(f.label||"")+'</div>';`  (c) submit loop: skip statements
  (don't add to responsesOut, don't validate). member_get_form already returns the fields incl. statements — no DB change.
- DEPLOY: `ffp-provider-dashboard.html`, `ffp-professional-dashboard.html`, `ffp-professional-client-loader.js`,
  `ffp-member-dashboard.html`, `ffp-admin-dashboard.html` (PRO_BUILD **62**).
- STILL TO DO (next): pro client profile redesign (passport-card flip + tap-to-email/call + 5 smaller buttons + recent
  note opposite) — task open, not started.

## ⏩ Prior handoff (2026-06-21, Stripe Connect reliability hardening)

**STRIPE CONNECT RELIABILITY (2026-06-21) — DB live; deploy backend + 2 dashboards + DO 1 Stripe-dashboard step.**
Why: status was set ONCE at onboarding return; if a connected partner later got restricted or payouts paused, we'd
still show 'connected' and keep sending customers into a checkout that fails. Now status stays truthful over time.
- DB (live, migration `connect_health_columns`): added `charges_enabled, payouts_enabled, requirements_due,
  disabled_reason, payments_updated_at` to BOTH `providers` and `professionals`.
- Backend `index.js` (deploy to Vercel): new `accountStatusPatch(acct)` (maps live Stripe account → status:
  connected / restricted [submitted but charges off] / onboarding) + `syncConnectAccount(acct)`; new webhook branch
  **`account.updated`** re-syncs the owning provider/pro; both `/connect/return` handlers now capture the full health
  (payouts + requirements), not just charges_enabled. The connected-account `checkout.session.completed` finalise
  branch already existed (idempotent, shared with /api/pay/confirm) — fulfillment no longer depends on the redirect
  **provided the webhook receives connected-account events** (see Stripe step below).
- Frontend: `ffp-provider-dashboard.html` `renderPaymentsCard()` + `ffp-professional-billing-loader.js` `_proStripeCard()`
  now render **restricted ("Action needed — payments paused", with requirement count → Resolve in Stripe)** and a
  **payouts-paused** banner on the connected state. Cache-bust **PRO_BUILD 60→61**.
- ⚠️ GRANT — ONE Stripe dashboard step (required for both reliability wins): on the webhook endpoint
  (Developers → Webhooks → your `/api/webhooks/stripe` endpoint): (1) add event **`account.updated`**, and
  (2) make sure the endpoint **listens to events on connected accounts** (the "Listen to events on Connected accounts"
  option / a Connect-type endpoint) so `checkout.session.completed` from a partner's account reaches us. Also add
  `checkout.session.completed` if not already subscribed. Without (2), redirect-independent fulfillment won't fire.
- DEPLOY: backend `index.js` (Vercel) + `ffp-provider-dashboard.html` + `ffp-professional-dashboard.html` +
  `ffp-professional-billing-loader.js` (Netlify). Verified: helper logic unit-tested (connected/restricted/onboarding/
  payouts states + requirement de-dup), both card fns parse, DB cols present.

## ⏩ Prior handoff (2026-06-21, Pro client profile + booking strap + coach notes)

**PRO CLIENT PROFILE / BOOKING STRAP / COACH NOTES (2026-06-21) — DB live; deploy 3 files (PRO_BUILD 58→59).**
- BUG FIXED: Pro dashboard → Scheduling → tap a session → "Session options" → the "Booked in" client strap did
  **nothing**. Root cause: it called `clientProfile()` behind `if(window.clientProfile)`, but that fn lives in the
  lazy `ffp-professional-client-loader.js` which only loads for the Clients panel. New `openProClientProfile(id)` in
  `ffp-professional-dashboard.html` injects that loader on demand then opens; the Scheduling strap now calls it.
- `clientProfile` REBUILT world-class (in `ffp-professional-client-loader.js`): avatar+name+status header, info as a
  2-col GRID of cards (not one row per field), and square icon TILES (Connect Passport / Packages / Forms / Notes /
  Edit) instead of full-width button rows. It now self-loads `_members` (so it works when opened from Scheduling).
- NEW threaded COACH NOTES: DB `pro_client_notes` + RPCs `pro_list_client_notes` / `pro_add_client_note` /
  `pro_delete_client_note` (all `assert_pro_owner`, live). Notes tile on the profile opens a threaded add/list/delete modal.
- v60 tweak: client info shown as clean divider rows (no boxed/"box" cells); square action buttons kept; the **latest 3
  coach notes** now render on the profile under the buttons (View all → full thread).
- DEPLOY: `ffp-professional-client-loader.js`, `ffp-professional-scheduling-loader.js`, `ffp-professional-dashboard.html`
  (PRO_BUILD **60**). Confirm avatar menu shows Build 60, then Scheduling → session → tap a booked-in client → profile opens.

## ⏩ Prior handoff (2026-06-21, Pro forms system)

**PRO FORMS (2026-06-21) — DB already LIVE; one file to deploy.**
- DB (applied, migration `pro_forms_system`): tables `pro_form_templates` + `pro_client_forms` (mirror the provider
  forms tables); RPCs `pro_list_form_templates`, `pro_save_form_template`, `pro_delete_form_template`,
  `pro_list_client_forms`, `pro_assign_form`, `pro_complete_form_upload`, `pro_delete_client_form` (all `assert_pro_owner`).
  Seed `seed_default_pro_form_templates` + AFTER-INSERT trigger `trg_seed_forms_on_professional` + backfill — every pro
  now has 2 world-class templates (Liability Waiver & Assumption of Risk 9-field; Pre-exercise readiness PAR-Q+ 11-field).
  `member_forms_list` / `member_get_form` / `member_submit_form` were rewritten to **UNION** provider + pro forms, so the
  booking `forms.html` (js/forms.js, member RPCs, renders `f.provider`) surfaces pro forms with **NO booking change**.
  Pro completion notifies the pro owner (`professionals.member_id`); assign notifies member with link
  `findfitpeople.com/forms.html?form=<id>`.
- DEPLOY: `ffp-professional-client-loader.js` (the client-record "Forms" button — was the "Assessment form" placeholder —
  now opens assign / manage-templates / builder / upload-signed-copy / remove). Cache-bust = **PRO_BUILD 57→58** in
  `ffp-professional-dashboard.html` (deploy that too). Confirm avatar menu shows **Build 58**, then open a client → Forms.

## ⏩ Prior handoff (last worked: 2026-06-18, Quests polish: card/preview height, partner filter, gender leaderboard)
**Deploy queue (Grant commits → Netlify; NOT yet confirmed live):**
1. `assets/ffp-quests-core.js` — **v9**: major (headline) card height 138px→276px (2×); Leaderboard **Filters button**
   (tune + count badge) → Location (Global/Country/City) **+ Gender (All/Men/Women)** chips that combine; CSS id
   `ffp-quests-v8-css`. ALSO NEW **qr_gps proof** (PROOF map entry + `doTask` branch: prompt code → capture GPS → complete).
2. `ffp-member-dashboard.html` — quests-core include bumped **?v=7 → ?v=9**; ALSO (a) Log Activity modal now clears
   Activity/Calories/Notes on each fresh open (bug: modal inherited the previous entry's values); (b) Challenges bottom-nav
   button hidden (`display:none`) — parked for future feature.
3. `ffp-admin-quests-loader.js` — hero-image upload preview box height 150px→300px (2×); ALSO **qr_gps proof** in builder
   (PROOFS option "Scan QR + GPS", GPS row shows for it, radius defaults 250m).
4. `ffp-admin-dashboard.html` — `_lazyInit` cache-bust **v=59 → v=61**; ALSO Challenges sidebar link greyed-out +
   non-clickable + "Soon" tag (parked for future feature).
Deploy all 4, hard-refresh (Ctrl/Cmd-Shift-R). NOTE: prior `ffp-quests-core.js` commit was mislabelled "v5" on GitHub
but live behaviour proved v7 content was deployed — use accurate commit messages so the version log stops drifting.

**Already LIVE on DB (no deploy needed):** migrations `quests_feed_partner_hide_ended` (member_quests_feed partner branch
now filters `status<>'ended'` + active_to window — stops ended/member-created quests appearing under Partner) and
`quest_leaderboard_add_gender` (dropped the 2-arg + 5-arg overloads, recreated as ONE function
`quest_leaderboard(p_quest,p_limit,p_city,p_country,p_search,p_gender)` — single fn so no PostgREST overload ambiguity;
deployed client calling without p_gender still resolves). gender values in `members.gender` are 'Male'/'Female'.
Earlier (2026-06-17) still live: `quests_headline_flag_feed`, `quest_images_storage_policies_rebuild`, `quests_feed_major_minor_partner`.

**Verify after deploy:** (a) Member Passport → Quests → Major card is now noticeably taller; tap a quest → Leaderboard tab
→ **Filters** button opens panel with Location + Gender; combining (e.g. My city + Women) filters the board; badge shows
active-filter count. (b) Admin → Quests → Edit → hero-image box is taller (300px). (c) Partner quests section should no
longer show the ended "Fitness Class Quest" (verified: feed partner count = 0 for grant@findfitpeople.com).

**Open / next:** Quests Phase 3 (auto-rule engine for `proof_type='auto'` tasks from bookings/check-ins); Phase 4 remaining
(partner-dashboard task builder + unlock/QR UI `ffp-provider-quest-create-loader.js` + partner verify queue in Check-ins);
optional gamification next (completion burst animation, streaks, city→country→global ambassador tier badges — points + 
`ffp_global_leaderboard` already exist); currency Phase 3/4/5 (tasks #69/#70). Member-created exploration-quest code is
preserved in quests-core but intentionally NOT surfaced in the new UI.

## LATEST 2026-06-21 (66b, PRO_BUILD 50→51) — Payment now truly FORCES a package
- Grant's screenshot: the no-packages fallback dropped to a free-text box (didn't force a package). Removed that fallback. `openPaymentModal` now GATES when the pro has no packages → "Create a package first" modal (→ Go to Packages, which itself gates on a service). With packages, the dropdown requires picking one (or the in-list "Other / one-off"); `savePayment` already rejects an empty selection. Editing an existing record still allowed.

## LATEST 2026-06-21 (66) — Pro package payment now GRANTS the client their credits
- Grant: "purchase reflects credits for user." PRO `savePayment` (`ffp-professional-billing-loader.js`): recording a **real package** payment (not "Other / one-off", payment mode, new record) now also calls **`pro_assign_package`** → the client receives the package's credits in one step (a CLIENT is now required for a package payment). One-off charges still just record. Toast confirms "credits added to the client" (or guides to assign from Clients if the grant fails). PRO_BUILD 49→50.
- Partner side already did this — `provider_sell_package` (Packages → Sell) creates the client package with sessions. So both pro + partner now: package purchase = payment + credits. ("Parallel manual-payment ledger" = the pro's standalone Payments tab; partner uses Sell-package instead — not adding a separate partner ledger for now.)

## LATEST 2026-06-21 (65) — Catalog flow locked: Service → Package (required) → Payment (= package)
- Grant's model: **Service** = what the client does; **Package** = what they buy (bound to a service); **Payment** = a package purchase. Enforced order Service → Package → Payment.
- **Package now REQUIRES a service** (was optional both sides): PRO `openPlanModal` (`ffp-professional-client-loader.js`) — "For which service *" required, gate "Create a service first" → Services tab when none, `savePlan` rejects empty service. PARTNER `apPackageModal` (`ffp-provider-appointments-loader.js`) — Service * required (`_apServiceOpts(...,false)` drops "Any service"), toast-gate "Add a service first" when none, `apSavePackage` rejects empty service.
- **Payment = a PACKAGE purchase** (superseding 64's service-picker): pro Record-payment/Invoice picker is now the pro's **packages** (`_ensureBillPackages` → `pro_list_packages`; option carries name+price; pick → description=package name + auto-fill amount). Kept **"Other / one-off"** escape (Grant: "package or one-off"). No-packages → hint + plain description fallback. `ffp-professional-billing-loader.js`.
- Files: `ffp-professional-client-loader.js`, `ffp-professional-billing-loader.js`, `ffp-professional-dashboard.html` (PRO_BUILD 48→49); `ffp-provider-appointments-loader.js`, `ffp-provider-dashboard.html` (appointments loader ?v=9→10). Verified edited regions `node --check` OK.

## LATEST 2026-06-21 (64) — Payment "Description" → Service/product picker (money tied to the catalog)
- Grant: the Record-payment Description should be a SERVICE the pro created (in Services tab) first, not free text. `ffp-professional-billing-loader.js`: `openPaymentModal` now loads the pro's services (`_ensureBillServices` → `pro_list_services`) and renders a **"Service / product" `<select>`** (each option carries name + price). Picking one sets the (hidden) description = service name and auto-fills Amount from the service price (editable). An **"Other / one-off…"** option reveals a free-text box for ad-hoc charges. If the pro has NO services yet → inline hint to add one in the Services tab + a plain description box fallback. `savePayment` validates a service (or Other) is chosen. Applies to both Payment + Invoice modes. PRO_BUILD 46→47.
- **(64b, PRO_BUILD 47→48) Service REQUIRED for slots.** `ffp-professional-scheduling-loader.js`: opening "New slot" with ZERO services now shows a **"Create a service first"** gate (→ Go to Services tab) instead of the form; the Service field is marked required (*); `saveSlot` rejects an empty service. A slot must reference a service (price/duration/cancellation policy come from it). Editing an existing slot still allowed.

## LATEST 2026-06-21 (63) — #42 RPC ownership hardening: Phase 0 + Phase 1 money-critical (DONE + verified)
- **KEY finding:** the "auth.uid() is always null" note in this file is STALE. `assets/ffp-api-integration.js` v12 injects the member's signed Supabase JWT on every request, so `auth.uid()` resolves to the logged-in member on ALL dashboards (member/pro/provider). Confirmed live via `whoami()` on the pro dashboard: `role:authenticated`, real `uid`, and `pro_id`/`provider_id` both resolve (professionals.member_id / providers.owner_user_id are the ownership links). → the systemic fix is small in-DB guards, NOT a backend re-route.
- **Phase 0 (live):** helpers `assert_pro_owner(p_pro)` / `assert_provider_owner(p_provider)` — raise 'forbidden' unless `auth.role()='service_role'` (backend, exempt) OR caller owns the host id (`auth.uid()`) OR `is_admin()`. Plus `whoami()` diagnostic. VERIFIED with simulated JWTs: non-owner→rejected, owner→allowed (both pro + provider).
- **Phase 1 (live) — credits & payments, the actual free-credit hole — 16 funcs guarded:** grant/sell/assign/save: `pro_assign_package`, `provider_sell_package`, `provider_assign_plan`, `pro_save_package`, `provider_save_plan`, `provider_save_package`; money-movement: `pro_refund_booking` (+resilient owner check), `provider_refund_booking` (+credit-booking guard), `provider_session_add_member` (+stamps credit_source_id), `pro_mark_paid`, `provider_mark_paid`, `pro_cancel_client_package`, `provider_cancel_member_plan`, `pro_return_credit`, `provider_return_credit`, `provider_session_remove_member`. Each now `perform assert_*_owner(...)` first.
- **Phase 2 high-value (live):** owner-guarded `pro_delete_slot`, `pro_cancel_occurrence`, `pro_reschedule_occurrence`, `provider_cancel_session`, `provider_save_session_template`, `provider_delete_session_template`; MEMBER self-booking guard added to `book_session` + `pro_book_slot` (non-service-role must have `auth.uid()=p_member`). **Total now 24 functions hardened (9 pro + 13 provider owner-guards + 2 member-self) — verified count via pg_proc.** ALL money-movement + host cancel/reschedule + member self-booking are now caller-verified.
- **STILL TO DO (lower risk — griefing/privacy, NOT money; mechanism proven):** (tasks #43–45) Phase 2 config mutations (`pro_save_slot`/`set_slot_status`, `provider_save_session`/`add_oneoff`/`delete_session`/`generate_class_sessions`/`class_session_*`, appointments book/cancel/reschedule/confirm/no_show/checkin, `*_save/delete_service`, `*_save/delete_client`/`member`, broadcasts/staff/teams/quests, `pro/provider_delete_package`, `provider_delete_plan`, `*_save/delete_payment`); CHECK-INS (analyse caller first: `pro_checkin_service` is MEMBER-initiated → guard `auth.uid()=p_me`; `pro_checkin_member`/`provider_checkin_*` are HOST-initiated → owner-guard); Phase 3 PRIVATE READS (client lists, client passports, rosters, payments, business reports) — DATA-LEAK risk. ⚠️ For reads: do NOT guard the member-facing ones the booking platform uses — build the allowlist from `FFP Booking Platform/js/ffp.js` (getProServices/getProSchedule/getProviderSessions/etc.) FIRST.
- All DB-side, live immediately, reversible. No dashboard/backend change.

## LATEST 2026-06-21 (62) — BOOKING-LOOP AUDIT (3 parallel agents) + first wave of money/comms fixes
- **Audited the whole loop** (pro/partner/client) across DB RPCs + both dashboards + the booking platform. Corrected a FALSE alarm: `mark_booking_paid`/`grant_member_plan`/`grant_pro_package` are **service_role-only** (verified grants) — NOT an anon exploit.
- **FIXED this turn (DB live):**
  1. **Credit returns went to the WRONG package/plan + weren't idempotent.** `pro_return_credit`/`provider_return_credit`/`provider_session_remove_member` ignored the booking's `credit_source_id` and credited an arbitrary package; idempotency was a free-text note. Now: return to the EXACT `credit_source_id`, `for update` lock + new typed `bookings.credit_returned_at` flag, ownership via stamped professional_id (resilient), notify member. (migration `credit_return_to_exact_source_idempotent`)
  2. **Host cancellation now auto-compensates + notifies.** `pro_cancel_occurrence` + `provider_cancel_session` previously cancelled the member's booking but returned NOTHING and sent NO notification. Now they loop affected bookings: auto-return the credit to its source plan/package (host-cancel = always compensate), and insert a member notification (credit returned / refund processing). (migration `host_cancel_autocompensate_and_notify`)
  3. **Reschedule now notifies + moves the booking.** `pro_reschedule_occurrence` was silent and left the member's booking time stale. Now it updates affected bookings' `scheduled_at` (so "my bookings" + the resilient schedule match stay correct) and notifies each member. (migration `pro_reschedule_notify_and_move_bookings`)
  4. **Member EMAILS for booking-critical events.** New `member_notify_email_payload` RPC + `trg_notification_member_email` trigger → emails the member (via `/api/notifications/email-member`, same secret/pipeline) for: Session cancelled / rescheduled / time changed / Credit returned / Booking cancelled. Backend `index.js`: `sendMemberNotifyEmail()` + endpoint added (DEPLOY with the existing `BOOKINGS_NOTIFY_SECRET`).
- **FIXED next (DB live, this session):**
  - **#39 partner template orphaning** — `provider_save_session_template`/`provider_delete_session_template` now PRESERVE any occurrence with a live booking (delete/regenerate only UNBOOKED future occurrences; insert guarded by NOT EXISTS so a preserved occurrence isn't duplicated). Members keep their seat + booking link. (migration `provider_template_preserve_booked_occurrences`)
  - **#41 race + duplicate** — `pro_book_slot` now `FOR UPDATE`-locks the slot + rejects a duplicate (same member, same occurrence); `book_session` got the same per-member duplicate guard (it already locked the occurrence). (migrations `pro_book_slot_lock_and_dup_guard`, `book_session_dup_guard`)
  - **#40 check-in double-consume** — `pro_checkin_service`/`pro_checkin_member` now consume a credit ONLY for true walk-ins: if the member already has a credit-paid booking for that pro+service within ±12h, check-in skips consumption. Also added the missing 2h re-checkin throttle to `pro_checkin_member`. Credit consumption is now exactly-once. (migration `checkin_skip_consume_when_booked`)
- **STILL OPEN — #42 (SYSTEMIC, security, needs planning):** pro/provider RPCs are anon-callable with explicit p_pro/p_provider and NO caller→owner verification (FFP uses its own JWT, so `auth.uid()` is null → RLS can't bind). Worst: `pro_assign_package`/`provider_sell_package` (anon-granted) = a client could grant themselves credits. Proper fix = route host mutations through the authenticated backend (verify FFP token → ownership) OR give hosts a real Supabase auth session. NOT a quick migration — recommend a dedicated planned pass before doing it (touches every host RPC). Do NOT attempt blind.
- Files: DB migrations (live) + `assets/ffp-passport-backend-main/.../index.js` (deploy). Email pipeline verified live earlier (200/401).

## LATEST 2026-06-21 (61) — Issue-1 traced: "auto-added as standing client" = the recurring-clients tick (now clarified)
- **Investigated the external booking platform** (`C:\Users\User\Documents\Claude\Projects\FFP Booking Platform`, now connected): it books via `FFP.bookAndPaySlot → pro_book_slot` (correct — creates a `bookings` row, NOT a standing client). DB audit: the ONLY function that inserts into `pro_slot_clients` is `pro_save_slot` (the pro's own slot form / "Add or remove people"). `pro_book_slot`'s match was a false positive (it only READS pro_slot_clients for capacity). **So no booking flow auto-adds anyone** — the only way a member becomes a STANDING (every-week) client is the pro ticking them in the slot form, which the UI didn't make obvious was recurring.
- **Cleanup:** removed Grant's stray standing-client row (was on PT 20:30 slot `61491e2a`); 0 remaining.
- **Fix (clarity, `ffp-professional-scheduling-loader.js`):** "Who's in this slot" → **"Recurring clients"** with a clear note in BOTH the slot create/edit form and the "Add or remove people" modal: ticking adds the person to EVERY week (standing/recurring); members who book a single session appear automatically and must NOT be added here. PRO_BUILD 45→46.
- Files: `ffp-professional-scheduling-loader.js` + `ffp-professional-dashboard.html` (PRO_BUILD 46). DB cleanup (1 row).
- Email pipeline VERIFIED live post-deploy: net.http_post → `/api/bookings/notify-host` returns 200 `{skipped:no_payload}` (correct secret) and 401 (wrong secret).

## LATEST 2026-06-21 (60) — Bookings made resilient (self-describing) — survive slot/session regeneration
- **World-class pattern: a booking is now an immutable record of its facts, not a fragile pointer to a slot.** Added `bookings.professional_id` + `bookings.service_id` (provider_id already existed) + indexes (`idx_bookings_professional`, `idx_bookings_provider_type`, `idx_bookings_item`). Backfilled all existing pro bookings (0 null professional_id) from the slot, with a credit-source fallback for orphaned ones.
- **Stamp at creation:** `pro_book_slot` now writes `professional_id` + `service_id` on both insert paths (credit + pending).
- **Resilient resolution (slot-id independent):**
  - `pro_week_schedule` matches member bookings by **(item_id = slot_id) OR (professional_id + occurrence date + start_time)** — so a booking still appears even after the slot is regenerated with a new id. VERIFIED: set a booking's item_id to all-zeros → it STILL shows "Grant Hermanus Goes" on the 07:00 slot.
  - `booking_host_notify_payload` now resolves the host from the **stamped `professional_id`/`provider_id`** (slot fallback only for label) → orphan-proof. This also FIXED the pro email payload that was returning null before (it depended on the now-regenerated slot). VERIFIED: returns Sunjay/PT Session/Mon 29 Jun 07:00.
- This is the permanent root-cause fix for the orphaning behind LATEST (59)/(58). Partner side: `provider_id` already stamped + `provider_session_roster` reads bookings; provider occurrence-regeneration is a lower risk (same pattern can be applied if needed).
- **All DB-side (migrations LIVE). No dashboard redeploy needed for this round.** (The booking EMAIL still needs the earlier backend deploy + `BOOKINGS_NOTIFY_SECRET` env from LATEST 58.) Open follow-up: issue-1 standing-client auto-add (likely the external findfitpeople.com booking platform).

## LATEST 2026-06-21 (59) — Pro slot delete-protection + restored Grant's orphaned booking (+ issue-1 findings)
- **(Issue 2) Pro could delete a slot members were booked into — no block, no notify → orphaned the booking.** Root cause was `pro_delete_slot` hard-deleting the slot (and the prior slot regeneration is what orphaned Grant's 29-Jun booking). **Fix (migration `pro_delete_slot_block_when_booked`):** the RPC now RETURNS FALSE (no delete) if any upcoming non-cancelled `bookings` reference the slot. Frontend `endSlot()` (ffp-professional-scheduling-loader.js) now detects `data===false` and tells the pro to "Block this date" + refund first (the proper `pro_cancel_occurrence` flow already notifies + offers refunds). `pro_set_slot_status` only does active/paused (no 'ended'), so delete was the only destructive path. PRO_BUILD 44→45.
- **Restored Grant's orphaned 29-Jun 07:00 PT booking:** its `item_id` pointed at the deleted slot `d5c5691b`; re-pointed to the live Monday-07:00 PT slot `452b4fa3`. Verified it now shows "Grant Hermanus Goes" in Sunjay's week.
- **(Issue 1 — auto-added to a slot) findings, NOT yet fixed:** Grant is a STANDING client (`pro_slot_clients`) on slot `61491e2a` (PT 20:30) that he never booked via the Passport. The pro dashboard's slot create/edit form in THIS repo pre-checks NOTHING for a new slot and only standing clients on edit — so the auto-add is NOT coming from here. Most likely the external **findfitpeople.com booking platform** (separate site, not in this repo) adds members to `pro_slot_clients` on booking instead of creating a `bookings` row — OR it was a manual add. Need the exact repro / the booking-platform code to fix. (Did NOT delete the row — may be intentional.)
- **Root cause still open (flagged earlier): slot regeneration orphans bookings.** Stamp `professional_id`/`service_id`/date on `bookings` at creation so they survive slot id changes. Recommended next.
- Files: `ffp-professional-scheduling-loader.js` + `ffp-professional-dashboard.html` (PRO_BUILD 45) + DB migration + 1 data fix.

## LATEST 2026-06-21 (58) — Booking flow: 3 money-critical bugs fixed (credit cross-service, pro/partner not notified, bookings not on dashboard)
- **(BUG 1) PT credits paid for Tabata.** Root cause: `pro_assign_package` (manual assign-to-client) inserted `pro_client_packages` WITHOUT `service_id` (grant_pro_package already copied it). NULL service = "any service" in `pro_consume_package_credit`. **Fix (migration `pro_assign_package_bind_service_and_backfill`):** assign now copies `v.service_id`; backfilled all client packages from their `package_id` template (0 left unbound). Grant's "10 PT Session" now bound to PT Session → can't pay for Tabata.
- **(BUG 2) Booking didn't show on the pro dashboard (real-time).** `pro_week_schedule` built each slot's `clients` ONLY from `pro_slot_clients` (standing) — never read `bookings`. **Fix (migration `pro_week_schedule_include_member_bookings`):** clients now UNION standing clients + member self-bookings for that occurrence (matched on the pro's tz). Verified: Grant's Mon 29 Jun 07:00 PT booking now shows "Grant Hermanus Goes". (Partner: `provider_session_roster` already reads bookings, so per-session rosters were fine.)
- **(BUG 3) Pro/partner not notified.** PRO: `pro_book_slot` now inserts a `notifications` row for the pro's `professionals.member_id` (credit + pending paths) → shows in the pro bell (it reads /api/notifications/{member_id}). PARTNER: the provider bell is client-synthesized (RSVPs/applications/approvals) and didn't read bookings — added RPC `provider_recent_session_bookings(provider)` + wired it into `ffp-provider-notifications-loader.js` (v2→3) "New booking — X booked 'Session'". Verified RPC returns Grant's Hot Yoga/Beach Workout.
- **Cleanup (migration `cleanup_grant_tabata_credit_refund`):** cancelled the wrong Tabata booking (`f7a3fb7c`), deleted its `pro_package_uses` row, returned the credit (7→**8**). Kept the legit 29 Jun PT booking.
- **EMAIL to pro/partner — BUILT (Grant approved).** Enabled `pg_net` (migration `enable_pg_net_*`). New RPC `booking_host_notify_payload(booking)` resolves host email/name + member + session label + when (pro: `pro_slots→professionals`, work_email → fallback pro's member email; partner: `providers.contact_email` → fallback `owner_user_id` member email). Trigger `trg_booking_host_email` AFTER INSERT on bookings (professional/provider_session, confirmed|pending) → `net.http_post` to backend `/api/bookings/notify-host` with `x-ffp-secret`. Backend (index.js): new `sendBookingHostEmail()` (branded) + endpoint that verifies the secret, calls the RPC, emails. **Fires at insert time (slot exists then) so it resolves even though some OLD bookings are orphaned (below).**
  - **DEPLOY:** (1) commit/deploy backend `index.js` to Vercel; (2) set Vercel env **`BOOKINGS_NOTIFY_SECRET=ffp_bkn_7Qx2Lm9Vt4Rp8Wc1Zk6Hn3Yd5Bg0Js`** (must match the trigger). DB side is LIVE.
- **⚠️ NEW ISSUE FOUND (separate, important): slot regeneration ORPHANS bookings.** Grant's 29-Jun PT booking `item_id=d5c5691b` no longer matches a live `pro_slots` row (now `452b4fa3`) — the pro's slots were regenerated with new ids, so the booking points at a dead slot. Effect: such bookings vanish from `pro_week_schedule` (matched on slot_id) AND can't resolve a host. FIX NEEDeD: stamp `professional_id`/`provider_id` + `service_id` + occurrence date on `bookings` at creation (so schedule/payload resolve without the slot), or keep slot ids stable across edits. Not yet done — flagged to Grant.
- Files: DB migrations (LIVE) + `ffp-provider-notifications-loader.js` + `ffp-provider-dashboard.html` (loader ?v=2→3) + `assets/ffp-passport-backend-main/.../index.js` (deploy + env). Pro/member dashboards need NO redeploy (DB-side).

## LATEST 2026-06-20 (57) — Log Activity photo: clearer crop + ratio picker (square/portrait/landscape/wide/free)
- Shared crop modal `assets/ffp-image-upload.js` (v7→v8). New **opt-in `pickRatio`**: shows a ratio bar (Square 1:1 / Portrait 4:5 / Landscape 4:3 / Wide 16:9 / Free) with proportional icons → `cropper.setAspectRatio`; lets the user choose orientation (the "landscape/portrait" ask). Clearer crop frame (`guides/center/highlight/modal:true` = rule-of-thirds grid + dimmed surround) + hint "Drag to reposition · scroll/pinch to zoom". On save, when `pickRatio`, output size is derived from the actual crop box (long side capped to the caller's budget) so portrait/landscape aren't squashed to a fixed box. Other callers (provider/admin uploads) unchanged — pickRatio defaults false. New `FFPUpload._ratio`.
- `ffpLogPickPhoto` now passes `pickRatio:true`, default `aspect 4/3`, `outW/outH 1280` (budget). Files: `ffp-member-dashboard.html` (FFP_BUILD 401→402, img-upload include ?v=7→8), `assets/ffp-image-upload.js`. Verified edited blocks via Read (full-file node --check is mount-truncation, RULE 3); crop UI confirmed in a render.

## LATEST 2026-06-20 (56) — Passport panel: tap card = FLIP to back; share moved to a text link
- **Tap the passport now FLIPS to the back** (was: tap = share). Wrapped the bespoke front `.pass-shell` in the canonical flip structure (`.ffp-pc-flip` > `.ffp-pc-face.ffp-pc-front` + new `.ffp-pc-back#pass-self-back`), added `.pass-container{perspective}` + `.pass-container.flipped .ffp-pc-flip{rotateY(180)}` (reuses the global `.ffp-pc-*` face/backface rules → no bleed). New `ffpFlipSelfPassport()` builds the back on each flip via **`FFPPassportCard.backShell(FFPCard.resolve(selfId))`** (activities + level + stats — same back used in the deck/match cards; RULE 5 reuse). `scalePassportCard()` now scales BOTH faces' `.pass-shell`.
- **Share moved to a link:** the grey "Tap your passport to share…" text → blue underlined link **"Tap here to share your passport with friends"** with `onclick=sharePassportCard()`. (Share still works; `prerenderPassportShare` clones the first `.pass-shell` = front, unaffected.)
- **Files:** `ffp-member-dashboard.html` only (FFP_BUILD **398→399**). Verified: flip JS `node --check` OK; flip + back + share-link confirmed in a show_widget render.
- **(56c, Build 401) FIX — skill meter bars all showed 1 line:** `FFPPassportCard.meter()` mapped an OLD taxonomy (`not tried/social/competitive/representative/professional`); the live levels are **Just started 1 / Recreational 2 / Skilled 3 / Highly skilled 4 / Professional 5**. Updated the idx to those 5 + kept legacy fallbacks (DB has a mix: social/competitive/representative still present). Shared `meter()` → fixes bars on every card. `ffp-member-dashboard.html`, FFP_BUILD 400→401.
- **(56b, Build 400) FIX — back showed "No activities logged yet":** self's skills live in `members.skills` but the anon client can't read `members` (RLS `auth.uid()=id` → null) and the boot/localStorage payload didn't carry skills, so `FFPCard.fromProfile().sports` was empty. Now `ffpEnsureSelfSkills()` fetches self through the **`members_cards(p_ids)`** SECURITY-DEFINER RPC (same one the deck/connection cards use — returns skills), maps it (`_ffpSelfCard`), syncs `MemberProfile.data.sports`, and `ffpRenderSelfBack()` renders the canonical back from it (re-renders once the fetch resolves; cached after). Verified RPC returns Grant's 5 skills+levels.

## LATEST 2026-06-20 (55) — Profile > Preferences: removed the duplicate "Notifications" checkbox
- The top **"Phone notifications" card** (Web Push, `ffpToggleNotifications`) is the single notifications control. Removed the redundant `Notifications` `pref-toggle` checkbox from the Preferences list (renderProfile). Kept Weekly Newsletter / Public Profile / Hide DOB. `d.preferences.notifications` field left in the data model (inert; no longer surfaced). `ffp-member-dashboard.html`, FFP_BUILD **397→398**.

## LATEST 2026-06-20 (54) — Calorie Tracker: bigger tabs, de-boxed chips, goal timeframe → DATE
- **Tabs 2× bigger:** `.fp-tab` 13px→20px (gap 18→26).
- **De-boxed (Grant: "no need for everything to have a box"):** `.food-picker-cat`, `.meal-type-chip`, `.goal-config-pill` → transparent, no border/radius; active = blue text + 2px underline (matches the timer-preset treatment). `.goal-config-result` → no yellow box, just a top divider.
- **Goal timeframe → target DATE (no drift):** added `profile_meta.target_date` (migration `profile_meta_add_target_date`, LIVE). Goal modal "Timeframe (weeks)" stepper replaced by an "Achieve by" `<input type=date>`. `target_date` is source of truth; `targetWeeks` derived (`_weeksUntil`) so the kcal math is unchanged (and tightens correctly as the date nears). Plan text + Today goal-pill now read "… by 14 Sep 2026". Loader loads `target_date` (falls back to deriving from legacy `target_weeks`) and saves it. `adjGoal` no longer touches the removed `gc-weeks`.
- **Files:** `ffp-member-dashboard.html` (FFP_BUILD **396→397**, core include **?v=2→3**), `ffp-calorie-tracker-core.js` (**v2→v3**: targetDate + date helpers `_isoToday/_weeksUntil/_isoFromWeeks/_goalIso/_dateLabel/setTargetDate`; openGoalConfig/adjGoal/renderGoalConfigResult/pill rewired), `ffp-calorie-tracker-loader.js` (**v7→v8**: load+save target_date). DB: `profile_meta.target_date` added. Verified: edited JS slices `node --check` OK.

## LATEST 2026-06-20 (53) — FIX: Workout Timer seconds wheels were 5s steps — now 1-second (Countdown + EMOM)
- Grant (twice) wanted 1-second increments. cdSec/emSec were still `step:5` → fixed to `step:1` (max 55→59). Interval was already 1s. `ffp-member-dashboard.html`, FFP_BUILD **395→396**.

## LATEST 2026-06-20 (52) — Calorie Tracker: smoother add-food + create-meal (decluttered the food area)
- **Grant:** add-food/add-meal wasn't smooth; too many numbers/bits around the add area. Wanted a clean button → modal to select/search food, and a modal to create meals that go to a list. Confirmed via AskUserQuestion: **one-tap add at default serving (adjust after)** + **auto-assign meal by time of day (movable)**.
- **Today screen:** removed the My Meals horizontal bucket-chip strip + the single "Log food" button → now **two clean buttons: "Add food" (opens picker) and "Create meal" (opens existing FFPMyMeals builder).** Hero ring + macros kept (the dashboard).
- **Add-food picker (one-tap):** new **Foods | My meals tabs**. Each food row has a **＋** that adds instantly at default serving into the **auto (time-of-day) bucket** and stays open (tick feedback, toast); tapping the food **name** opens the amount-adjust modal. "My meals" tab = clean vertical list of saved meals (no bucket chips), tap = log to auto bucket, small × deletes.
- **Adjust modal decluttered:** the 4-box macro grid collapsed to one line (big kcal · NpNcNf); meal chips default to the auto bucket so it's movable.
- **Reused, not reinvented (RULE 5):** create-meal = existing `mmOpenBuilder`; time-of-day = existing `mmDefaultBucket`; persistence = existing `confirmAdd` override (food_logs) + `member_meal_log`.
- **Files:** `ffp-member-dashboard.html` (FFP_BUILD **394→395**, calorie-core include **?v=1→2**), `assets/ffp-calorie-tracker-core.js` (**v1→v2**: `quickAdd/autoBucket/setPickerTab/_pickerTab`, food-row ＋, pickFood auto-bucket), `assets/ffp-calorie-tracker-loader.js` (**v6→v7**: renderMyMeals→`#fp-mymeals-list`, mmLog auto-bucket, `FFPMyMeals.refresh`). Verify: both JS slices `node --check` OK (full-file checks are mount-truncation false positives per RULE 3). No DB changes.

## LATEST 2026-06-20 (51) — Workout Timer per-mode fixes (wheel centring bug + countdown/interval/EMOM rework)
- **Wheel centring bug fixed (the "top white" Grant saw):** wheel had no padding, so the selected number sat at the TOP of the 3-row viewport, not centre. `.timer-wheel` now `box-sizing:content-box; height:44px; padding:44px 0` (border-box 132 = 3 rows) so `scrollTop = i*ROW` truly centres item i; added top/bottom **mask fade** + dimmer neighbours (#33424f) and a bigger pure-white centre (`.sel` 30px #fff). Centre selection lines moved to 18% inset.
- **Stopwatch:** new `#panel-workout-timer.mode-stopwatch .timer-display-v2{margin-top:16vh}` (class toggled in `applyMode`) — display drops toward centre since stopwatch has no setup below.
- **Countdown:** quick picks 10→**5** (30s/1m/3m/5m/10m); wheels now **single-digit** (removed `pad:true` on cdMin/cdSec).
- **Interval:** work/rest now **1-second** increments (step 5→1, max 600→300); rounds **max 30** (was 50).
- **EMOM reworked:** dropped "beep every" presets + **Reps**; now three wheels **Minutes : Seconds · Rounds**. State `emInterval/emReps` → **`emMin/emSec`** (default 1:00); `phaseDurMs = max(5, emMin*60+emSec)*1000` (0:00 guard); meta "Round X of Y · every M:SS"; removed the em-interval-presets listener in `init`. (`adj()` stepper handler now fully dead — left inert.)
- Verified: WorkoutTimer `node --check` SYNTAX OK; no live `emInterval/emReps` refs (only in dead `adj()`); wheel centring + all 4 mode layouts confirmed in show_widget render.
- Files: `ffp-member-dashboard.html` only (**FFP_BUILD 393→394**).

## LATEST 2026-06-20 (50) — Workout Timer redesign BUILT (scroll wheels, 8s get-ready, status 3×, time-as-hero, boxless)
- **In `ffp-member-dashboard.html` `WorkoutTimer` (the real object, not a mock).** Grant's 4 asks all built + verified in a render:
  1. **Status 3× larger:** `.timer-phase` 11px→**34px** (letter-spacing 2.5→1, nowrap). New `.phase-getready` (gold).
  2. **8-second GET READY lead-in** before Countdown/Interval/EMOM (NOT stopwatch). New state fields `getready/getreadyEnd/getreadyRemain/getreadyLast`; `start()` enters it when `phase==='ready' && mode!=='stopwatch'`; `tick()` counts 8→1 as the big number, beeps at 3/2/1, then `beginPhase()`. Pause mid-lead-in stores remaining; resume continues.
  3. **Scroll-wheel pickers replace ALL +/- steppers** (taps caused iOS zoom). New `buildWheels()/_wheel*` suite: snap-scroll columns, centred value = `.sel` (big), thin centre selection lines, **boxless**. Keys cdMin/cdSec/intWork/intRest/intRounds/emRounds/emReps. `this.s[key]` stays source of truth (engine unchanged downstream); presets reposition wheels via `renderAdjusters()→_wheelTo`; `applyMode()` repositions on mode switch (scrollTop needs visible element). `adj()` now dead (kept, harmless).
  4. **Time is the hero while running:** `#panel-workout-timer.timing` hides `#timer-tabs` + `#timer-config-area`; `.timing .timer-meta` 22px/900 uppercase = bigger ROUND line. Class added in `start()`, removed in `reset()`.
- Also: **boxless** `.timer-preset-btn` (transparent, active=blue underline) + `.timer-input-group` (no bg/border); **Interval summary line** `#int-summary` ("N rounds · Xs work / Ys rest"); removed the "flick each wheel" hint.
- Verified: WorkoutTimer object extracted + `node --check` = SYNTAX OK; wheel flick/snap + all 3 states confirmed in show_widget render.
- Files: `ffp-member-dashboard.html` only (**FFP_BUILD 392→393**). No DB/loader changes.

## LATEST 2026-06-20 (49) — Tier AUTO-EVALUATION wired (earn + maintain over rolling 30 days) — money/status-sensitive
- **Engine (migration `member_tier_auto_evaluate_engine`, LIVE):** `member_evaluate_tier(p_member, p_commit default true)` computes tier from `member_tier_progress` (rolling 30d): counts categories at each level (targets mirror Earnings.categories: referred 2/8, connections 2/8, meetups 1/4, providers 2/8, quest-tasks 4/10, events 1/4, activities 8/24, social 10/30) → **ambassador if ≥4 cats at amb level, supporter if ≥4 at sup level, else member.** `member_evaluate_all_tiers(p_commit)` = bulk sweep. p_commit=false = dry-run.
- **Safety / maintain rule:** qualify ≥ current → grant earned + set `tier_expires_at = greatest(existing, now()+30d)` (never shortens a longer/Founding expiry). Slip below current → KEEP until `tier_expires_at` passes (grace), then demote (member→null expiry). **Founding/manual ambassadors (future expiry) are never auto-demoted.**
- **Verified (dry-run on all):** promoted 0, demoted 0, maintained 5, grace 11 → committing now is a NO-OP (nobody yet qualifies for promotion; all 11 ambassadors future-dated Aug–Dec 2026 → grace). Baseline committed.
- **Scheduled:** pg_cron job **`ffp-member-tier-daily`** (jobid 4) `17 3 * * *` → `member_evaluate_all_tiers(true)`. Plus **on-demand**: `loadTierStats` (Earnings open) calls `member_evaluate_tier(self, true)` and persists the result so `computedTier()` shows it live. computedTier comment updated (no longer "parked").
- **Text fix:** reqLine/reqHighlight "4 of 7 categories" → **"4 of 8"**.
- Files: `assets/ffp-earnings-core.js`, `ffp-member-dashboard.html` (earnings-core **?v=2→3**, **FFP_BUILD 391→392**). DB + cron live.

## LATEST 2026-06-20 (48) — Quest task straps: fixed nested-scroll + multiple-open + no clip
- **Root cause of "straps not showing correctly":** `.q-tasklist` had `max-height:54vh; overflow:auto` — a nested scroll INSIDE the already-scrolling detail modal, cramming the tasks into a small sub-window instead of one long list. Removed it → the task list flows full-height and the modal scrolls the long list (what Grant wants).
- `toggleTask` rewritten to `row.classList.toggle('open')` — **multiple straps open at once** (was force-closing the others). All tasks shown, done stay visible (unchanged). `.q-task.open .q-task-d` max-height 360→**620px** so expanded body doesn't clip.
- Files: `assets/ffp-quests-core.js`; `ffp-member-dashboard.html` (quests-core **?v=9→10**, **FFP_BUILD 390→391**). (Existing strap styling kept; mock-style proof chips are a further optional restyle.)

## LATEST 2026-06-20 (47) — Progression: "Quest tasks" counts quest TASKS (not whole quests) + modals show current count + Earnings-log font
- **"Quest tasks" count (was wrong):** `member_tier_progress` `quests_completed` counted whole `quest_progress` (status='completed') — so finishing individual quest tasks never moved it. Now counts **`quest_task_completions`** (status in 'verified'/'completed', within 30d via `coalesce(verified_at,submitted_at,created_at)`). Both overloads, migration `tier_progress_count_quest_tasks_not_quests`, LIVE + verified (Grant shows 1). Category relabelled "Tasks completed" → **"Quest tasks"** in `ffp-earnings-core.js` (key stays `quests_completed`; thresholds 4/10).
- **Section-info modals now show current count:** new `#si-current` row in the modal; `openSectionInfo` sets "You've completed X so far — N more to reach Ambassador" for EVERY category.
- **Earnings-log font fix:** `.ffp-po-title`/`.ffp-po-subtitle` CSS was scoped only to `#ffp-payouts-section`, so the Earnings-log title/subtitle were unstyled. Broadened the selectors to `#ffp-earnings-log` too (title 14px/800; subtitle 11px muted small). `ffp-earnings-loader.js`.
- Files: `ffp-member-dashboard.html` (**FFP_BUILD 389→390**, earnings-core **?v=1→2**, `#si-current`), `assets/ffp-earnings-core.js`, `assets/ffp-earnings-loader.js`. DB live.

## LATEST 2026-06-20 (46) — Pull-to-refresh: switched member dashboard to inner-scroll so the gesture works (incl. iOS/standalone)
- **Why:** PTR (build 387) listened on the DOCUMENT scroll, but on iOS the body overscroll is owned by the OS (Safari tab) / behaved unreliably (standalone), and `overscroll-behavior` can't disable it on body. Fix = scroll an INNER container so the page never overscrolls and our handler owns the gesture.
- **Structural change (low-risk — `.content` already wraps all panels, static block):** `body { overflow:hidden }` (was overflow-x); `.content` is now the scroller — `height:100dvh; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior-y:contain` (kept its 76/80 padding + max-width 880 + margin auto, so layout unchanged; topbar/bottom-nav stay fixed over it). NOTE for future: the member app now scrolls `.content`, NOT the document.
- `_ffpInitPullToRefresh` `atTop()` now reads `.content`.scrollTop; indicator repositioned to drop below the 60px topbar (top:64, translateY -90→0). All `window.scrollTo(0,0)` (panel switches, notif routing) → `.content`.scrollTop=0.
- `ffp-member-dashboard.html` **FFP_BUILD 388→389**. (Grant uses the home-screen PWA — no native PTR there, so ours now shows.)

## LATEST 2026-06-20 (45) — FIX: Social-media-shares never logged on DESKTOP (no native share sheet)
- **Diagnosed from data:** `social_shares` had 0 rows for Grant; `member_tier_progress` social_shares=0. The RPC + `p_member` helper were already correct (verified). Root cause: on **desktop** there's no `navigator.share`, so the Share buttons fall back to **download** (activity card) / **copy-link** (passport) — and those fallback branches never called `ffpLogSocialShare`. Only the mobile native-share path logged.
- **Fix:** `ffpDoShareCard` desktop-download branch now calls `ffpLogSocialShare('activity','download')`; `sharePassportCard` desktop copy-link fallback calls `ffpLogSocialShare('passport','link')`. (Backend dedup = 1 credit per kind per calendar day, so safe.) `ffp-member-dashboard.html` **FFP_BUILD 387→388**.
- After deploy, on desktop: tap Share on an activity card (downloads + records) or tap the passport (copies link + records) → Earnings ▸ Your Progression ▸ Social media shares ticks to 1 (max 1 per type/day).

## LATEST 2026-06-20 (44) — Cancellation window + credit-return for sessions & pro (was inconsistent; money-critical)
- **Found (verified in RPCs):** `book_session` deducts a provider-plan credit at BOOKING (good, no attendance gap like pro). Classes are pay-per-booking (no plan credit, by design). `cancel_booking` enforced a refund window only for experiences/events/classes (`refund_tiers`/`free_cancellation_hours`); **provider_session + professional_session fell to a legacy 14-day fallback**, and a CREDIT booking cancelled in-window **never returned the credit**.
- **Fix (Grant: each pro/partner sets own, default 24h; auto-return credit in-window, manual override kept):**
  - Cols: `session_templates.free_cancellation_hours` + `pro_services.free_cancellation_hours` (default **24**); `bookings.credit_source_kind` ('provider_plan'|'pro_package') + `credit_source_id` (links a credit booking to the plan/package it drew from).
  - `book_session` / `pro_book_slot` now STAMP `credit_source_*` on credit bookings.
  - `cancel_booking` now reads the window for provider_session (via `session_templates`) + professional_session (via `pro_slots→pro_services`), and **auto-returns the credit** when a credit booking is cancelled inside the free window (`provider_member_plans`/`pro_client_packages` +qty; pro logs a `cancel_return` row in `pro_package_uses`). Money refunds unchanged; credit bookings set `refunded_aed=0`.
- Migrations LIVE: `cancellation_window_and_credit_source_columns`, `stamp_credit_source_on_credit_bookings`, `cancel_booking_session_pro_window_and_credit_return`. Verified: cols present, all 3 fns carry the new logic.
- **Authority UI DONE:** "Free cancellation (hrs)" field added to the partner session editor (`ffp-provider-scheduling-loader.js`, `tpl-cancel-hours` → payload `free_cancellation_hours`) and the pro services editor (`ffp-professional-services-loader.js`, `sv-free_cancellation_hours`). RPCs `provider_save_session_template`/`provider_list_session_templates` + `pro_save_service`/`pro_list_services` now persist + return the column (migration `save_list_rpcs_carry_free_cancellation_hours`). Cache-busts: provider `_provLoaderSrc scheduling ?v=20→21`; pro `PRO_BUILD 43→44`. (cancel_booking uses auth.uid() — booking-site session — unchanged.)
- DEPLOY: `ffp-provider-scheduling-loader.js` + `ffp-provider-dashboard.html` (v21); `ffp-professional-services-loader.js` + `ffp-professional-dashboard.html` (Build 44).

## LATEST 2026-06-20 (43) — 🔴→✅ PRO PACKAGE CREDITS: decrement on attendance + usage history (was BLOCKING; money-critical)
- **Root cause:** only `pro_book_slot` decremented a package credit; check-in (`pro_checkin_service`/`pro_checkin_member`) and standing-slot attendance recorded `activity_logs` but NEVER consumed a credit → coach balances stuck (e.g. Grant's "10 PT Session" still 10 after attending).
- **Single source (zero patching):** new SECURITY DEFINER `pro_consume_package_credit(p_member,p_professional,p_service,p_source,p_used_at,p_dedup)` — finds active package (service-match or agnostic), decrements, writes a `pro_package_uses` row; ±3h dedup (when p_dedup) prevents book-then-checkin / double-checkin double-charge. Execute revoked from anon/authenticated (internal only).
- **Migrations (LIVE):** `pro_package_uses_table_and_consume_helper`, `pro_credit_single_source_consume` (`pro_book_slot` REFACTORED to call the consume fn — no inline decrement), `pro_checkin_consume_credit_on_attendance` (both check-in RPCs `perform` the consume fn).
- **Ask 2 (LIVE):** table `pro_package_uses` + `member_package_uses(p_member,p_package)` → `{uses:[{used_at,service_name,source}]}` (granted anon+authenticated). For booking-site "tap a package → dated sessions". Added to FFP-BOOKINGS.md.
- **Verified non-destructively** on Grant's live package via a DO block that consumed then RAISEd (rolled back): consume=true, credits 10→9, member_package_uses returned the use; balance left untouched at 10.
- **Backfill DONE** (Grant said "all packages"): `pro_reconcile_package_credits()` (idempotent, conservative — never <0, excludes credit-booked sessions ±3h, dedups member+pro) ran → only **Grant's "10 PT Session" 10→9** (1 attended), no other package affected. Doc `FFP-PRO-PACKAGE-USAGE-ASK-FOR-PASSPORT.md` updated 🔴→✅.

## LATEST 2026-06-20 (42) — Member dashboard batch: activity→share, connect-notif routing, notif show-once + Clear all, notif drawer
- **#1 Log Activity → share card:** `saveLog` (both new `log_activity` and edit `update_activity` paths) now calls `_ffpSaveThenShare(id, act, city, entry, photo)` → sets `window._ffpActCard` + opens `_ffpOpenShareSheet` so the member lands on the shareable activity card right after saving.
- **#2 "X added your passport" notification routing:** `handle_connection` RPC (migration `handle_connection_notif_link_with_requester`, LIVE) now writes link `ffp-member-dashboard.html?connect=<requester_id>#panel-meet` (was `#connections`, which `ffpHandleNotifClick` ignored → tap did nothing). `ffpHandleNotifClick` now handles `?connect=<id>` → open Connections panel (`panel-meet`) + `MeetMove.openMemberDetail(id)` (their passport card); legacy `#connections` → open the panel.
- **#3 Notifications show-once + Clear all (BOTH):** review prompts filtered out of the list once seen (`ffp_seen_reviews`, already set on bell-open); `clearNotifs()` now PERSISTS — sets `ffp_notifs_cleared_at` (loadNotifications hides notifs ≤ that), dismisses current reviews, POSTs `/api/notifications/seen`. (Clear is per-device/localStorage — offer server-side `notifs_cleared_at` if cross-device needed.)
- **#4 Notifications drawer:** `#notif-menu` only (NOT the shared `.menu`) restyled as a right-side drawer — `50vw` (min 320 / max 480), full height (`100dvh`), slide-in, over a `#notif-scrim` at `rgba(0,0,0,.6)`. A MutationObserver mirrors the menu's `.show` onto the scrim (covers every open/close path).
- **#5 Pull-to-refresh (per active panel):** `_ffpInitPullToRefresh()` — at the top of the ACTIVE `.panel-view`, a downward pull reloads ONLY that panel via its existing reload fn (map: passport→loadJourneyLogs/ffpReloadPassport, meet→ffpReloadMeetMove+ConnFeed, meetups, quests→Quests.init, challenges, earnings, experiences, fitness-stats, calorie-tracker, profile) + `loadNotifications`. Floating spinner indicator; `overscroll-behavior-y:contain` suppresses the browser's native pull-reload; skips when a modal/drawer/map is the touch target. No full page reload.
- File: `ffp-member-dashboard.html` (**FFP_BUILD 383→387**). All frontend except the #2 DB migration (live).

## LATEST 2026-06-20 (41) — BUGFIX: Social-media-shares never recorded — `log_social_share` relied on auth.uid() (always NULL)
- **Root cause (mine, NOT a deploy issue):** `window.supabase` is the ANON client (`createClient(..., ANON_KEY, {auth:{persistSession:false}})` in `ffp-api-integration.js`); auth is a custom localStorage layer (`FFPAuth`). So `auth.uid()` is ALWAYS NULL for RPC calls — my `log_social_share` used `auth.uid()`, so it silently inserted nothing (verified: `social_shares` had 0 rows across ALL members). Every other writing RPC here passes an explicit member id; I hadn't.
- **Fix (migration `log_social_share_explicit_member`, LIVE):** dropped `log_social_share(text,text)`; recreated as **`log_social_share(p_member uuid, p_kind text, p_platform text)`** (SECURITY DEFINER, same per-kind-per-day dedup), granted to anon+authenticated. Verified end-to-end: calling it with a real member id inserted a row (self-test inserted=1, then deleted).
- **Frontend (`ffp-member-dashboard.html`, FFP_BUILD 382→**383**):** `ffpLogSocialShare` now passes `p_member: m.id` (from `FFPAuth.getMember()`).
- **Lesson reinforced:** in this app NEVER rely on `auth.uid()` — always pass the member id explicitly (the anon client carries no session).

## LATEST 2026-06-20 (40) — Meet-up GUEST-CANCEL now notifies + emails the HOST (was silent) + MeetMove already-extracted note
- **Gap found & fixed:** when a guest cancelled their spot / withdrew a request, the host got **nothing** (`leave_meetup` only set the attendee row to 'cancelled'; the loader sent no email). Now:
  - **DB (LIVE, migration `leave_meetup_notify_host`):** `leave_meetup` inserts a host `notifications` row — "Someone left your meet-up" / "Join request withdrawn" (icon `person_remove`), transactional so it always fires. Verified in pg_get_functiondef.
  - **Backend (`index.js` v99→**v100**, NEEDS VERCEL DEPLOY):** `/api/meetups/notify` now handles `{kind:'leave', meetup_id, member_id, pending}` → emails the host via new `sendMeetupLeaveEmail`. Email is best-effort; in-app notice is the RPC's job (no double-notify).
  - **Frontend (`ffp-meet-move-loader.js`, NEEDS NETLIFY DEPLOY):** after a successful `leave_meetup`, POSTs `{kind:'leave',…,pending:wasPending}` (mirrors the cancel/request POSTs). Cache-bust: dashboard **FFP_BUILD 381→382**.
- **MeetMove "extraction" — already done:** the `MeetMove` object already lives in `assets/ffp-connections-core.js` (`window.MeetMove`). The dashboard only holds a ~150-line `Object.assign(MeetMove,…)` augment tangled inside a shared IIFE (ends line 12545) — left as-is (low value, surgery risk). No re-extraction performed.
- Note: bash `node --check` on `index.js` and the loader threw FALSE truncation errors (mount cuts big files mid-line, RULE 3) — verified edited blocks in isolation + via Read instead.

## LATEST 2026-06-20 (39) — `Earnings` object EXTRACTED to its own core file (de-fragile cleanup)
- **`assets/ffp-earnings-core.js` (NEW, `?v=1`)** — the `Earnings` object (was inline in `ffp-member-dashboard.html` lines 9533–9993) + its two modal-backdrop helpers moved out **verbatim** (byte-for-byte, no retyping); `const Earnings` → **`window.Earnings`**. Loaded in `<head>` right after `ffp-quests-core.js` and AFTER `ffp-constants.js` (the object reads `window.FFP_CONST` at definition). Mirrors the proven Quests-core extraction pattern.
- Dashboard HTML now has only a pointer comment where the object was; boot still calls `Earnings.init()`; all ~20 inline `onclick="Earnings.x()"` handlers + the lazy `ffp-earnings-loader.js` resolve via the global.
- Verified this turn: 0 `const Earnings` left in HTML; 1 `window.Earnings =` in core; `node --check` core = OK; seam clean (EARNINGS header → pointer → SHARED MODAL/TOAST HELPERS). Removed region is self-balanced JS, so the remaining HTML stays balanced.
- **⚠️ DEPLOY BOTH TOGETHER:** `ffp-member-dashboard.html` (**FFP_BUILD 379→380**) AND new `assets/ffp-earnings-core.js`. Shipping the HTML without the new file = `Earnings` undefined = broken Earnings panel. (A local `ffp-member-dashboard.html.bak_earnings_extract` safety copy exists — do NOT commit it.)

## LATEST 2026-06-20 (38) — Earnings "Your Progression": Tasks + Social shares wired; build-discipline rule added
- **RULE 0.6 added to `CLAUDE.md`** (Grant logged a VIOLATION on build-number guessing): never state/bump a build from memory — READ the constant in the file THIS TURN, cite the line; the device "Build N" stamp is the ONLY live truth (`web_fetch`/raw github are cached, they lie); verify with a tool before claiming any number/state/"works". APPLY EVERY MESSAGE.
- **"Your Progression" categories** (`ffp-member-dashboard.html`, `Earnings.categories`): `quests_completed` row relabelled **"Tasks completed"** (unit 'tasks'), targets Supporter **1→4**, Ambassador **2→10**; `challenges_completed` row REPLACED by **`social_shares`** "Social media shares" (unit 'shares', icon 'share'), targets Supporter **10**, Ambassador **30**. Definitions live in the dashboard HTML `Earnings` object; the earnings loader only writes RPC counts onto `Earnings.categories` (verified — no progression labels hardcoded in the loader).
- **Social-share tracking WIRED end-to-end** (migration `social_shares_tracking_and_tier_metric`, LIVE + verified): new `social_shares` table (member_id, kind, platform, created_at; RLS select-own); `log_social_share(p_kind,p_platform)` SECURITY DEFINER, dedups to 1 credit per kind per calendar day; BOTH `member_tier_progress()` overloads now return `social_shares` = count in the 30-day window. Frontend: central `window.ffpLogSocialShare(kind,platform)` (non-blocking, refreshes `Earnings.loadTierStats`) called ONLY on genuine social shares — `sharePassportCard` (2 paths, kind 'passport') + activity-card `navigator.share` (kind 'activity'); downloads NOT logged. Verified: table=1, log_fn=1, both tier fns contain social_shares.
- Files: `ffp-member-dashboard.html` (**FFP_BUILD 377→379**), `CLAUDE.md` (RULE 0.6).
- **Caveat:** "Tasks completed" count currently sources from `quest_progress` (completed quests). If "tasks" becomes a distinct unit, the RPC needs its own count.

## LATEST 2026-06-20 (37) — GAP #3b cascade + Confirm-before-action — DB LIVE + provider/pro dashboards NEED DEPLOY
- **#3b cascade (migration `provider_cancel_session_cascade_bookings`, LIVE + verified):** `provider_cancel_session` now also `update bookings set status='cancelled', cancelled_at=now() where item_type='provider_session' and item_id=p_id and status<>'cancelled'` → the existing `trg_notify_booking_change` auto-notifies each affected member. Refund/credit return stays a SEPARATE partner-driven control (per Grant's decision) — NOT automatic.
- **NEW REQ — Confirm before assign/cancel/change/amend** (Grant: "on all options"). Added blocking `confirm()` (doesn't disrupt the open modal) to: provider scheduling `cancelOccurrence` (cancel session — warns members will be cancelled+notified, credits not auto-returned), `occRemove` (remove member), `occDoAdd` (add member, names the pay method); pro scheduling `cancelOcc` (block), `doReschedule`. Form-based actions (reschedule form Apply, add-people Save) already deliberate.
- Files: `ffp-provider-scheduling-loader.js` (v18→**v19**), `ffp-professional-scheduling-loader.js` (**PRO_BUILD 40→41**), `ffp-provider-dashboard.html`, `ffp-professional-dashboard.html`.
- **Partner refund/credit-return control — DONE (migration `partner_refund_credit_return_controls`, LIVE):** after a provider session cancel, an "Return credits / refunds" modal lists each affected member with their pay method + a discretionary action: **Return credit** (`provider_return_credit` → adds the seat back to the member's plan, idempotent via `[credit returned]` notes marker, notifies) or **Refund** (`provider_refund_booking` → sets `refunded_aed`=total + `payment_status='refunded'` + notifies → frontend calls backend `/api/pay/refund` to move the Stripe money on the connected account). `provider_session_refund_list` feeds the modal. Comp/unpaid = nothing to return. Each action behind a `confirm()`. scheduling loader v19→**v20**.
## LATEST 2026-06-20 (38) — Pro-occurrence cancel cascade + Confirm sweep — DB LIVE + pro dashboard NEEDS DEPLOY
- **Pro cascade (migration `pro_cancel_occurrence_cascade_bookings`, LIVE + verified):** `pro_cancel_occurrence` now cascade-cancels member bookings for that slot+date (`item_type='professional_session'`, `item_id=slot`, `(scheduled_at at time zone <pro tz>)::date = occ_date` — mirrors `pro_book_slot`) → `trg_notify_booking_change` auto-notifies. Provider sessions cascade was done in (37).
- **Confirm sweep extended (PRO_BUILD 41→42):** added `confirm()` to pro `pauseSlot` (pause stops bookings) + `saveSlotPeople` (change attendees). Already covered earlier: pro `cancelOcc`/`doReschedule`, provider `cancelOccurrence`/`occRemove`/`occDoAdd`; `confirmEndSlot` + the `confirmDelete*` family already use confirm modals; resume/unblock left as-is (restorative/safe).
- File: `ffp-professional-scheduling-loader.js` (+PRO_BUILD 42 in `ffp-professional-dashboard.html`).
- **PRO refund/credit-return control — DONE (migration `pro_refund_credit_return_controls`, LIVE + verified):** full parity with provider. After a pro blocks/cancels an occurrence, an "Return credits / refunds" modal lists affected members with **Return credit** (`pro_return_credit` → bridges member→pro_client by email → adds credit back to `pro_client_packages`, idempotent, notifies) or **Refund** (`pro_refund_booking` → sets refunded_aed + notifies → frontend `/api/pay/refund`, which resolves the PRO's connected account via slot→professional). `pro_occurrence_refund_list` feeds it (slot+date, pro tz). Each behind `confirm()`. PRO_BUILD 42→43.
- **BOOKING LOOP COMPLETE:** #1–#6 done; #3b done both provider + pro (cascade → notify → discretionary credit/refund); Confirm-before-action across booking management. Only #7 (Stripe test infra) remains — Grant's side.

## (prev remaining noted) 

## LATEST 2026-06-20 (36) — Booking loop GAP #2: intake display — class/session surfaces DONE — provider dashboard + 2 loaders NEED DEPLOY
- **Reusable intake renderer** for `booking_details = { guests:[{first_name,last_name,gender,age,answers:{key:val}}], booking_answers:{key:val} }` (shape confirmed via `ffp_validate_booking_details`): renders "Guest N · Name (gender, age) — Custom Q: val" + booking-level answers. Local copy in each loader (robust to lazy-load order); also exposed `window._ffpBookingIntake`.
- **Provider SESSION roster (scheduling loader v17→v18):** extended `provider_session_roster` RPC to return `details = b.booking_details` (migration `provider_session_roster_add_details`, LIVE); `occRosterRow` now shows each booker's intake under their pay/membership chips.
- **Provider TOURS/classes (classes loader v19→v20):** new "Bookings & guest details" button on each class card → modal grouping bookings by session date with each booker + intake (uses `provider_class_bookings`, which already returned `details`).
- **#2 RESOLVED for all flows that collect intake.** Verified: per-guest intake (`booking_details`) is ONLY collected by `create_booking` (experiences/trips/classes) + `book_session` (provider sessions) — both now displayed (above). **`pro_book_slot` does NOT store booking_details** (verified, `stores_details=0`) and **`book_event_order` doesn't take p_details** — so PRO sessions and EVENTS never collect guest intake; nothing to display there (not a gap). The pro side already shows each booked client via `clientProfile` (their saved details); events show ticket tiers. To get intake on pro/events would require ADDING collection (`pro_book_slot`/`book_event_order` accept `p_details` + the site collects it) — a product decision, not a display task.
- Files: `ffp-provider-scheduling-loader.js` (v18), `ffp-provider-classes-loader.js` (v20), `ffp-provider-dashboard.html` (loader versions). node --check unreliable on these (mount truncation, RULE 3) — edited blocks verified balanced via Read.

## LATEST 2026-06-20 (35) — Booking loop GAP #5: admin full pro-approval preview — admin dashboard NEEDS DEPLOY
- **Admin pro verification card → "View full profile" button** opens an in-admin modal that renders EXACTLY what publishes on Find Fit People (the public site only shows approved pros, so the old "Preview public page" link was dead for pending — removed it). Mirrors the public profile: cover + profile photo, name, headline, category + type chips, location, years experience, languages, certifications, bio, plus live **Services** (`pro_list_services`) and **Intro videos** (`pro_videos_list`) with graceful fallback, and an admin-only contact line. Built from the full `professionals` row (`professional_verification_list` returns `to_jsonb(pr)`). `_rows` cached; self-contained overlay (no dashboard modal dep). `node --check` OK.
- Files: `ffp-admin-professionals-loader.js` + `ffp-admin-dashboard.html` (lazy cache-bust **v=61→62**).
- **Still next:** #2 partner/pro intake DISPLAY across 3 surfaces (event guest list — needs paid-booking cross-ref since roster reads `rsvps`; class/session via `provider_class_bookings`; pro booked-client view), and #3b cascade.

## LATEST 2026-06-20 (34) — Booking loop GAP #4 done + GAP #2 mostly already live — DB LIVE (no deploy)
- **GAP #4 DONE:** `member_my_bookings` now returns `checked_in_at` + `checkin_verified` via a lateral join to `booking_checkins` (latest check-in for that booking+member). No new RLS surface (booking_checkins stays SECURITY-DEFINER-only). My Coaching can now show real "session used" time instead of the scheduled proxy.
- **GAP #2 — server side ALREADY LIVE (verified, no change):** (a) member read-back: `member_my_bookings` already returns `'details' = b.booking_details`. (b) required-question enforcement: BOTH `create_booking` and `book_session` already call `ffp_validate_booking_details(questions, details, qty)`. REMAINING = frontend only: surface `booking_details` on the partner & pro booking views (who's coming + sizes) — reads via `provider_class_bookings` / `member_bookings_at_venue` + dashboard render.
- **Booking-loop scoreboard:** #1 ✅ (backend v99, deploy) · #2 server ✅ / UI todo · #3 ✅ (trigger + plan/pkg) / #3b cascade todo · #4 ✅ · #5 todo (admin pro preview, frontend) · #6 ✅ verified · #7 infra (Grant: Stripe test keys + connected test acct + Connect webhook).

## LATEST 2026-06-20 (33) — Booking loop GAP #3: booking-change → member notification — DB LIVE (no deploy)
- **Single-source actor-aware trigger `trg_notify_booking_change` on `bookings`** (`ffp_notify_booking_change`, SECURITY DEFINER): on status→'cancelled' or scheduled_at change (genuine move), inserts a `notifications` row for `member_id`. Skips the member's OWN action — `bookings.member_id = auth.uid()`, so it only fires when `auth.uid() <> member_id` (partner/pro/admin). Confirmed via reschedule_class_booking that bookings.member_id IS the auth uid.
- **provider_cancel_member_plan** → notifies `member_id` (passport member) "Membership cancelled".
- **pro_cancel_client_package** → bridges `client_id → pro_clients.email = members.email` → notifies the passport member "Package cancelled" (skips if the pro's client isn't a passport member).
- notifications table = (id, audience, member_id, title, body, icon, link, created_at); member UI reads by member_id.
- **GAP FOUND (tracked as #3b):** `provider_cancel_session` / `pro_cancel_occurrence` / `provider_cancel_appointment` / reschedule-occurrence operate on `provider_sessions`/`pro_slot_exceptions`/`provider_appointments` — they DON'T update the member's `bookings` row, so cancelling a whole session neither cancels the member's booking nor notifies. Needs a behavioural decision (cascade-cancel member bookings + credit policy) before wiring — then the trigger auto-notifies.

## LATEST 2026-06-20 (32) — Cross-ecosystem booking loop: GAP #1 checkout endpoint (backend v99) + GAP #6 refund verified — backend NEEDS DEPLOY
Working through the Passport booking↔management loop doc (priority #1→#3→#2→#4→#5→#6/#7).
- **GAP #1 DONE — `POST /api/pay/booking-checkout {booking_id}` → `{url}` (backend v98→v99):** verified via DB that BOTH `create_booking` (Experiences/Trips) and `book_event_order` (paid Events) insert into the unified `bookings` table with `provider_id` + `total_aed`. So one generic endpoint = session-checkout generalised: read `booking.provider_id` → `providers.stripe_account_id` (must be `payments_status='connected'`) → `connectedCheckout` (Connect Standard, partner currency via `toMinorUnits`, zero fee) → `success_url` = `/api/pay/confirm?kind=booking&...`. Added `kind==='booking'` to `finalisePaidCheckout` (→ `mark_booking_paid` + "Payment confirmed" notify, idempotent) AND to the webhook backup array. `node --check` passes. The booking site already calls this endpoint (was falling back to "held").
- **GAP #6 VERIFIED (no change needed):** `/api/pay/refund {booking_id}` is live in backend v96 + complete — requires `status='cancelled'` (call `cancel_booking` first), refunds `refunded_aed` on the same connected account (facility via provider_id / pro via pro_slots→professional), idempotent; credit/unpaid just cancel. booking-checkout payments are refundable through it (intent stored via mark_booking_paid).
- **GAP #7 (infra, Grant):** end-to-end charge→confirm→refund test still blocked on Stripe TEST keys + ≥1 connected test account (0/4 facilities connected) + `checkout.session.completed` (incl. Connect) webhook.
- **Still OPEN (tracked):** #3 booking-change → member notification (next), #2 surface `p_details` to partners/pros + member read-back, #4 member-readable check-in time, #5 admin pro-approval preview.
- File: `assets/ffp-passport-backend-main/ffp-passport-backend-main/index.js` (v99). Grant deploys backend to Vercel.

## LATEST 2026-06-20 (31) — Provider Overview rating stars FIX — dashboard NEEDS DEPLOY
- `prStars()` renders Material Symbols `star` but base `.ms` sets `FILL 0` → "on" stars rendered as OUTLINES (looked empty, esp. after de-yellow recoloured them slate). Fixed `.pr-star.on` → `font-variation-settings:'FILL' 1` (now actually FILLED) + `color:#FFB400` (rating gold — the one place yellow is the world-class standard; de-yellowing stays everywhere else); empty stars → `var(--ffp-border-mid)` faint. File: `ffp-provider-dashboard.html`.

## LATEST 2026-06-20 (30) — Log Activity location → guarantee Country+City auto-fill (FFP_BUILD=377) — member dashboard NEEDS DEPLOY
- **Already built (verified, not rebuilt):** Log Activity's `FFPLocPick` pin / "Use my current location" reverse-geocodes the spot (`reverseCenter` sets `cur.city`/`cur.country`) and `logSetLocation()` auto-fills the Country + City selects (adds the option if missing). So on the current build it should already populate.
- **Gap found + fixed:** the reverse-geocode is debounced (450ms) + async, so tapping "Use this location" before it finishes — or a Nominatim hiccup — could hand back empty city/country. Hardened **`FFPLocPick.use()`** to be `async` and, when city/country are still empty, deterministically resolve them via the keyless **BigDataCloud** reverse-geocode (already used elsewhere in the app, line ~11147) before invoking the callback. Now Country+City fill reliably from pin/GPS. FFP_BUILD 376→377.
- File: `ffp-member-dashboard.html`. (Big file; validated the changed block via Read/Edit — bash node --check unreliable on mount truncation per RULE 3.)

## LATEST 2026-06-20 (29) — Partner MEMBERS: platform-standard modal + pull-from-passport + square photo — DB LIVE; dashboard + members loader NEED DEPLOY
- **DB (migration `provider_members_passport_fields`, LIVE):** added `given_names`, `surname`, `photo_url` to `provider_members`; `provider_save_member` stores them (+ keeps combined `full_name`); new **`provider_passport_by_email(p_provider uuid, p_email text)`** — mirrors `pro_passport_by_email`, checks `providers`, returns given/surname/full_name/gender/dob/nationality/email/combined-phone/photo_url. Verified live (returns Grant's passport row + avatar).
- **Members modal rebuilt (members loader v3→v4):** "Pull from FFP Passport" button at top (`pullMemberFromPassport()` prefills given/surname/phone/photo by email); **Given names + Surname** (→ combined `full_name` on save); **Phone = country-code select + number** (`_memPhoneFieldHtml`/`_memSplitPhone`/`_memGetPhone`, `FFP_TAX.phoneCodes`); **City = taxonomy select** flattened from `FFP_TAX.cities` (`_memCities`); **Add photo** via shared `FFPUpload` (quest-images bucket, 1:1 → `photo_url`, `pickMemberPhoto()`). Native selects (provider `openModalShell` doesn't FFPSelect-enhance).
- **Member strap:** avatar now shows the square **photo** (`m.photo_url`, else initials square); strap bg → card grey `rgba(15,37,49,.05)`; status pills recoloured for light-theme contrast.
- **Round-2 corrections to EXACT platform standard (members loader v4→v5; migration `provider_members_add_country` LIVE — added `country` col + save):**
  - **Phone** → standard `.phone-input` + `select.phone-cc` (flag+code from `FFP_TAX.phoneCodes`) + `.input.phone-num` (was a custom native select). Added a **flag webfont** (`@font-face FFPFlags`, Twemoji Country Flags woff2 from jsdelivr, `unicode-range U+1F1E6-1F1FF`) applied to `.phone-cc/.ffp-picker-*/.ffp-sel-*` so flag emoji actually render on Windows (which otherwise shows "AE").
  - **Country + City** → shared searchable **`FFPPicker.openCountry`/`openCity`** buttons (`.ffp-picker-btn`, `_memPickCountry`/`_memPickCity`; city resets on country change) — replaces the flat native city select. New `country` column stored alongside `city`.
  - **Member strap photo** → now fills the strap **edge-to-edge, full height** (`align-items:stretch`, 64px photo column, no padding gap) instead of a small floating square.
- Files: `ffp-provider-members-loader.js`, `ffp-provider-dashboard.html` (members ?v=5; + flag font). Real file intact via Read (762 lines; bash node --check unreliable on mount truncation per RULE 3).

## LATEST 2026-06-20 (28) — Partner portal post-deploy fixes (analytics empty state, calendar, card body) — NEEDS DEPLOY
Live now (Grant deployed Build with the light rebrand). Fixes:
- **Listing-card body separation:** `.listing-card` background `transparent → rgba(15,37,49,.05)` (~5% grey) so each card lifts off the white page (per Grant). Still no border, photo hero on top.
- **Analytics empty state:** scaffold sections (funnel/trend/age/gender/tier/area/sport/deals/events/peak/retention) wrapped in `#analytics-sections`; `renderAnalytics()` now hides that wrapper (engagement tracking still not wired → no data), so the panel shows ONLY the honest "No analytics yet" card instead of a stack of bare headers. NOT broken — just awaiting engagement data (future task to wire views/RSVPs/check-ins).
- **Appointments calendar (loader v8→v9):** day-view coach header cells now have `--ffp-bg-3` light-grey bg + 2px `--ffp-border-mid` divider; coach column body dividers 1px→2px (thicker separation per Grant); availability shading strengthened from faint `rgba(46,204,113,.09)` → `rgba(31,157,87,.16)` + 3px solid `#1f9d57` left bar (clearly visible). NOTE: availability is weekday-specific — Grant's is "Every Mon", so it shows on Mondays (week view Mon 15 ✓); the Saturday day-view was empty because there's no Monday availability that day, not a bug.
- **Today button:** `apToday()` resets the calendar anchor to facility-today and re-renders the current view (day/week/month) — working as intended (Grant's question was cut off; awaiting clarification).
- **Quests nav ENABLED:** removed `soon/locked` from the NAV quests item — now clickable (panel `#panel-quests` + `FFPQuestCheckins.reload()` already wired; quests-loader v5, quest-create v2).
- **Card update coverage (answer to "are events/trips/experiences cards updated?"):** YES — Events, Trips (experiences), Challenges & Deals cards are ALL built in the dashboard JS (`renderEvents/renderExperiences/renderChallenges/renderDeals`, lines ~4072/4234/4519/4832) using the shared `.listing-card`; the Experiences panel's classes-loader uses the same class. So the boxless + 5% grey-body change covers every listing panel. (Loaders only build the create/edit modals, not the cards.)
- **Box backgrounds → card grey (per Grant):** white container boxes now use the same `rgba(15,37,49,.05)` as the listing cards — `.card` and `.checkin-card` (dashboard) + `.vq-card` (venue-QR loader, bumped **v4→v5**). Borders kept (thin) for definition; inputs stay white for contrast. Covers Check-ins (QR box + session box) and any `.card` box elsewhere.
- Files: `ffp-provider-dashboard.html`, `ffp-provider-appointments-loader.js`, `ffp-provider-venue-qr-loader.js`. (Real file verified intact via Read; bash `node --check` false-failed on mount truncation per RULE 3.)

## LATEST 2026-06-20 (27) — Partner (provider) portal REBRAND: light theme + primary blue #1980AD — NEEDS DEPLOY
- **Approved concept first (mockup):** light, world-class, **boxless** — grey sidebar (`--ffp-bg #e7e8ea`), WHITE content (`--ffp-bg-2 #ffffff`), KPIs as an open stat ribbon split by hairline rules (no cards), active nav = white lozenge with blue text. Blue is **accent-only** (logo, active nav, primary buttons/links, one highlight number). Grey canvas, NOT blue-grey.
- **`ffp-provider-dashboard.html` :root remapped** dark→light: `--ffp-blue #2ba8e0→#1980AD` (blue-dark #13657f), bg/text/border tokens to light + neutral grey borders (`rgba(15,37,49,.08/.14/.24)`), shadows lightened. Structural fixes: `.sidebar` bg → `--ffp-bg` (grey); `.main` + `.topbar` + `.save-bar` + `.uploader-preview-btn` dark→white; `.modal-foot`/`.itin-day` → light grey; `.lc-cat-pill` kept as dark photo-scrim w/ white text; `.ni.active` → white lozenge + blue text; `.ffp-picker` shared component → light; `color-scheme:dark→light` (native date/time pickers); section titles + `.sb-sub` yellow→blue (yellow-on-white was unreadable).
- **All provider loaders rebranded** (single sed pass over `ffp-provider-*.js`): `#0f1e2e/#0a1825→#fff`, `#1a2f44→#d8dde2`, `#e8eef4→#0e2531`, `#0c1d2b→#fff`, option text `#f5f7fa→#0e2531`, `#2ba8e0→#1980AD`, `rgba(43,168,224,*)→rgba(25,128,173,*)`, `#8a99a8→#566069`. `var(--ffp-*,#dark)` fallbacks left as-is (resolve correctly via root). Provider billing `_metric` dark box → light grey tile + hairline border (like the pro fix). All 17 loaders pass `node --check`.
- **Cache-busts bumped** for every changed+referenced loader: map → checkins v4, scheduling v17, members v3, billing v3, staff v4, classes v19, appointments v8; tags → profile v17, events v17, experiences v15, quests v5, quest-create v2, venue-qr v4, challenges +?v=2, notifications +?v=2. (deals-loader edited but not referenced by this dashboard — no bump.)
- **Verify on device:** sidebar grey + white content; active nav = white lozenge; KPIs boxless; no dark cards/inputs anywhere; dropdowns/date pickers light; Payments tiles readable.
- **Refinement round 2 (same files):**
  - **Boxless (Option B, approved):** shared single-source classes de-boxed — `.kpi` now a divided stat ribbon (gap:0 + `kpi+kpi` left hairline, no border/bg), `.section-card` opened (transparent, no border), `.listing-card` border removed (photo hero + soft hover shadow carries it). Propagates to every panel.
  - **Yellow removed → grey/black variety:** `--ffp-yellow #FFCC00→#2b3942` (slate), `--ffp-yellow-dk→#1b252c`; added **`--ffp-warn #c9820f`**. Primary buttons (`.btn-pri`) yellow→**blue**; tab underline/active-count→slate/dark; nav `.ni-badge`→grey; bell dot, qa-icon, itin-day-num, period-chip.active, peak-cell.hot, profile extras btn→**blue**; rank-num→dark; `.label .req`→**red**; pr-star + all `rgba(255,204,0,*)` tints + bare `#FFCC00` → slate/grey (sed across dashboard + loaders). Loader `var(--ffp-yellow)` inherits the new slate automatically.
  - **Warnings solid + standout:** `.lc-status-pill.pending`→solid `--ffp-warn` white text; `.draft`→solid grey white text; dirty/unsaved + `sb-foot-tag.pending`→`--ffp-warn`; loader status/empty notes (`color:#FFCC00`)→`--ffp-warn`.
  - **Dropdowns fixed (light-blue bg + light font):** added Pro-style **FFPSelect light overrides** (`.ffp-sel-*` `!important`: white bg, `--ffp-text`, blue active) in the dashboard `<style>` — beats the shared dark `#ffp-select-css`. (Native `select`/options already light via color-scheme + earlier loader sed.)
  - **Challenges nav:** disabled (greyed, "Soon", non-clickable) and **moved directly above Deals**; badge logic now shows "Soon" for any `soon||locked` item. ALL provider loaders still pass `node --check`; zero `#FFCC00` left.

## LATEST 2026-06-19 (21) — Activity page REDESIGN (immersive, box-free) + share card PREVIEW with formats — member dashboard NEEDS DEPLOY (FFP_BUILD=368)
- **Activity page fully redesigned (`ffpRenderActivityCard`) — approved concept, no boxes:** immersive hero (full-bleed photo or rich gradient + big watermark glyph + scrim into the page), headline METRIC large (distance, else duration) with eyebrow (activity·date) + subline (time range·location); an EDITORIAL stat ribbon (hairline dividers, no tiles) carrying Duration/Pace/kcal/Avg HR; full-bleed rounded MAP strip with overlay; quote-style note (left accent bar); gradient "Share card" + connections-share + edit. Shared activities show the owner row with the high-five icon.
- **Share card = PREVIEW first + format picker (per Grant):** tapping "Share card" opens `_ffpOpenShareSheet` → shows the actual card scaled, with tabs **Square 1:1 / Portrait 4:5 / Story 9:16 (default 9:16)**, an optional "Use my photo as background" toggle (only if the activity has a photo), and Download + Share. `_ffpBuildShareCard(a,ratio,usePhoto)` builds at the chosen ratio; `html2canvas` (scale 2) → File; pre-rendered on each change so Share fires within the iOS user-activation; `ffpDoShareCard` shares the image (text+link fallback), `ffpDownloadActivityCard` saves PNG. FFP_BUILD 367→368.
- **Card tweaks (FFP_BUILD=371):** top wordmark text REPLACED with the white FFP logo, **centered at top**, sized 0.32×card width (20% smaller, so it supports not dominates). Logo lives in **Supabase storage**, not GitHub: `site-images` bucket → `https://kxzyuofecmtymablnmak.supabase.co/storage/v1/object/public/site-images/ffp-logo-white.png` (Grant uploads `assets/ffp-logo-white.png` to that bucket; html2canvas captures it via useCORS like the activity-photo bg). Default share format **Square 1:1**.
## LATEST 2026-06-20 (26) — Pro rebrand fixes + new app icon — NEEDS DEPLOY (PRO_BUILD=39)
- **Payments dark boxes:** `_metric()` in billing loader hardcoded `background:#0c1d2b` (dark) → dark text on dark. Fixed → `var(--ffp-bg-card)` + border (white card like Overview).
- **Dropdowns (shared FFPSelect, was blue tint + light text):** added Pro-SCOPED overrides in the dashboard `<style>` (`!important`, beats the injected `ffp-select-css`; provider portal untouched): `.ffp-sel-btn/.ffp-sel-menu/.ffp-sel-item/.ffp-sel-input` → white bg + `var(--ffp-text)` dark text, teal active.
- **Sign-in gate:** `.gate` background → `#0a3e44` (teal backdrop), white `.gate-card` unchanged.
- **New app icon:** generated `assets/icons/ffp-pro-{512,192,180,32}.png` = white FFP logo + "PROFESSIONAL" on `#0a3e44` (32 = logo only) from `ffp-logo-white.png` (these are SITE files → commit to repo). Manifest `theme_color`/`background_color` → `#0a3e44`, icon `?v=3`; dashboard `<meta theme-color>` → `#0a3e44`, favicon/apple-touch `?v=3`. PRO_BUILD 38→39.
- **Verify:** Payments boxes white/readable; dropdowns white w/ dark text; sign-in teal bg + white card; home-screen icon = teal FFP PROFESSIONAL.
- **Code box (PRO_BUILD=40):** sign-in 6-digit entry redesigned from 6 separate squares → ONE rounded rectangular box with 6 dot positions. `.code-row` = the box (single border+radius, focus-within teal ring); `.code-box` = transparent flex cells, `placeholder="•"` (dots when empty), teal-tint active cell. Keeps the existing 6-input JS (siCodeMove).
## (prev) LATEST 2026-06-20 (25) — Professional portal REBRAND: light theme + emblem teal #0a3e44 — PRO_BUILD=38
- **Theme = the shared CSS vars (single source).** `:root` flipped to LIGHT: bg #f4f7f8 / surfaces #fff / bg-3 #eef3f4 / card #fff; borders #e4ebec/#ccd9da; text #0f2327 / muted #5a6b6e / dim #869599. **Pro brand colour `--ffp-purple` → #0a3e44** (the emblem teal Grant gave). Blue/yellow kept.
- **Dark-theme assumptions fixed (dashboard + loaders):** all hardcoded `rgba(139,92,246,*)` → `rgba(10,62,68,*)`; `#c4b5fd` (light-purple tint text) → `#0a3e44`; `.ni.active` white-on-tint → teal text; inputs `color-scheme:dark`→`light`; `.toast` → teal bg + white text (was white text on light = invisible); rating `<b>` whites → `var(--ffp-text)`; primary-profession star → gold; empty stars `rgba(255,255,255,.18)`→`rgba(10,62,68,.16)`; loader white tints (`rgba(255,255,255,*)`)→teal tints, `#9fb0bf` muted→`#5a6b6e`. Files: `ffp-professional-dashboard.html` + client/scheduling/services loaders (billing was clean). PRO_BUILD 37→38.
- **Watch (likely minor tuning):** status pills using light blue (#6fc6ef) / yellow text on light tints may want darker shades — review on device.
- **Verify:** deploy; portal is white with deep-teal brand/buttons/active nav/toast.
## LATEST 2026-06-19 (24) — Add Client: "Pull from FFP Passport" by email — DB LIVE; pro dashboard + client loader NEEDS DEPLOY (PRO_BUILD=37)
- **DB (LIVE, migration `pro_passport_by_email`):** new RPC `pro_passport_by_email(p_pro, p_email)` (mirrors `pro_client_passport` but by email, before a client row exists; verifies caller is a professional). Returns has_account + given_names/surname/full_name/gender/date_of_birth/nationality/email/phone/passport_no/passport_active. Tested live (found + not-found).
- **`ffp-professional-client-loader.js`:** "Pull from FFP Passport" button at the TOP of the Add/Edit client modal + a hint line. `pullClientFromPassport()` reads `mm-email`, calls the RPC; on found → prefills Given names/Surname + `_phoneSet` phone, stashes `window._mmPulled`, shows "Pulled from <name>'s FFP Passport"; empty email → prompts; not found → message. `saveMember` now also sends gender/date_of_birth/nationality from `_mmPulled` (only if the email still matches), and `pro_save_client` already persists those columns. `window._mmPulled` reset on modal open. PRO_BUILD 36→37.
- **Verify:** Add client → type their email → tap Pull → name/phone fill + confirmation; Save → profile shows gender/DOB/nationality.
## (prev) LATEST 2026-06-19 (23) — Share card RIPPED OUT html2canvas → drawn on <canvas> (FFP_BUILD=376)
- **Root cause (confirmed by symptom):** html2canvas HANGS in the iOS PWA/webapp (Download froze at 92%, Share never opened). It's the unreliable dependency.
- **Rebuild (no patch):** removed html2canvas from the share card. `_ffpMakeCardCanvas(a,ratio,usePhoto)` draws the whole card with the Canvas 2D API (gradient/photo bg + scrim, logo via `drawImage` from a data-URL Image, activity/hero/sub/stats via `fillText`, divider via stroke). `_ffpLoadImg` loads the data-URL logo/photo into an Image (data: never taints → `toDataURL` always works). The **preview IS the canvas** (`_ffpRenderSharePreview` appends it) and caches `_ffpShareFile` immediately so Share/Download fire within the iOS tap (no stall). `_ffpCaptureShareCard` is now canvas→`toDataURL`→`_ffpDataUrlToFile`. Deleted `_ffpBuildShareCard`/`_ffpDrawPreview`/`_ffpPrerenderShareFile`(html2canvas path).
- **iOS Download:** `<a download>` is ignored by iOS → Download now uses `navigator.share({files})` ("Save Image") on iOS, anchor download elsewhere.
- **Validated** in isolation: preview caches file (no err), on-demand capture works, photo path works. Visual confirmed via canvas render.
- **(superseded) 22/375 — toBlob/single-div/error-surfacing on the html2canvas path** — folded into the canvas rebuild (error surfacing kept).
## (superseded) LATEST 2026-06-19 (22) — Share card image generation FIXES (iOS webapp) — FFP_BUILD=375
- **Context:** users are on the iOS **PWA/webapp**, not desktop. Three fact-based fixes to image generation:
  1. **Capture a single sized `<div>` directly** (`html2canvas(node)`), not an offscreen `position:absolute;inset:0` inner child — those render blank/0-size + stall (was the 92% freeze / Share not opening). `_ffpBuildShareCard` returns ONE styled div now.
  2. **`canvas.toDataURL('image/png')` → File** instead of `canvas.toBlob` — toBlob is unreliable on iOS Safari/WebKit; `_ffpDataUrlToFile` builds a File (Blob fallback if File ctor absent).
  3. **Surface the REAL error:** `_ffpShareErr` set in `_ffpCaptureShareCard`; Download/Share now toast `Image failed: <reason>` instead of silently failing — so we get the actual cause, no guessing.
- **Still possibly needed (iOS PWA):** `<a download>` doesn't save to camera roll on iOS — the iOS way to save is the share sheet ("Save Image"). If image now GENERATES but Download doesn't save, switch Download to share-to-save. Awaiting the real error/behaviour from device.
- **(superseded) 374 — single-div capture:** folded into above.
- **(superseded) 374 note kept below.** REAL FIX (FFP_BUILD=374) — Download stalled / Share didn't open: deep analysis — the Passport share works with the SAME html2canvas on the SAME page; the difference was the activity card captured `node.firstChild`, an **absolutely-positioned (`inset:0`) inner div on an offscreen (`left:-10000px`) parent** → html2canvas renders those blank/0-size and stalls `toBlob`. Fix: `_ffpBuildShareCard` now returns ONE sized `<div>` (bg/flex/padding on the element itself) and `_ffpCaptureShareCard` captures `html2canvas(node)` directly — the proven Passport pattern. (The 373 data-URL preload is kept and still correct.)
- **(prev) 373 — data-URL preload:** root cause = html2canvas hanging on the CROSS-ORIGIN storage logo (and would taint the canvas). Fix: preload remote images (the `site-images` logo, and the activity photo when "use my photo" is on) to **data URLs** once (`_ffpImgToDataUrl`/`_ffpEnsureLogo`/`_ffpEnsurePhoto`, cached), and the card builder uses those data URLs (text "FFP" fallback if a load fails). So the captured node has NO cross-origin images → html2canvas resolves instantly; added `imageTimeout:6000` as a safety. Logo still SOURCED from storage (fetched once, not committed to GitHub). Preview draws immediately (text logo) then upgrades when the asset is ready.
- **Download progress (FFP_BUILD=372):** the Download button now shows a filling progress bar + "Saving… N%" while the image renders, then "Saved ✓" + a toast when the file drops (no native % for a local export, so the bar animates during the html2canvas render and snaps to 100% on completion).
- **Share = IMAGE only (never a URL):** `ffpDoShareCard` now always exports the card via html2canvas and shares the file (`navigator.share{files}`) with a short caption (no link); if a device can't share images it DOWNLOADS instead of falling back to a URL. Uses the pre-rendered file when ready (iOS activation), else captures on tap.
- **Data limits:** HR-zone bars + GPS route line still need device sync (Garmin/Polar) — card built to slot them in later.
- **Verify:** open an own activity → immersive page; tap Share card → preview, switch formats, toggle photo, Download/Share.

## LATEST 2026-06-19 (20) — Pro Session-options revamp + block=grey-out — DB LIVE; pro dashboard NEEDS DEPLOY (PRO_BUILD=36)
- **DB (LIVE, migration `pro_week_blocked_and_unblock`):** `pro_week_schedule` now KEEPS 'cancelled' occurrences flagged `blocked:true` (greyed) instead of dropping them; new `pro_unblock_occurrence(pro,slot,date)` removes the cancelled exception. Tested live: block→blocked=true in week, unblock→gone.
- **`ffp-professional-scheduling-loader.js` — `openOccActions` rebuilt (now async, reads slot from cache):** (1) session **note at the top**; (2) **booked-client straps** → tap → `clientProfile(id)` (client module); (3) **Add or remove people** is now a large solid-purple `btn-pri`; (4) **Block this date** greys the session on the calendar (occCard `opacity:.5` + "Blocked" badge) and the sheet offers **Make available again** (`unblockOcc`→`pro_unblock_occurrence`). occCard passes `blocked` to `openOccActions`.
- **(5) "Edit standing slot" bug** = the earlier `pro_list_slots` `pricing_mode` error (empty cache). Fixed live; the editor now finds the slot and opens prefilled "Edit slot". PRO_BUILD 35→36.
- **Verify:** tap a session → note shows on top, booked client strap opens their profile, purple Add/remove; Block → session greys (not vanishes) → Make available again; Edit standing slot opens the existing slot prefilled.

## LATEST 2026-06-19 (19) — Connections "From your people" feed: every row taps through to its target — DB LIVE; member dashboard NEEDS DEPLOY (feed loader ?v=328)
- **Was:** feed rows were tappable but connection events ("X added your passport", a notif linked to `#connections`) had no person id, so they couldn't open the person, and notif rows only guessed a panel by keyword.
- **DB (LIVE, migration `conn_panel_connection_feed`):** `member_connections_panel` now emits a `connection` feed type from `member_connections` (recent accepted + incoming pending) carrying the person — `link:'member:<id>'`, title "X added your passport"/"X wants to connect" — and EXCLUDES the duplicate `#connections` notifs. Verified: connection rows present with `member:` links, no leftover `#connections` notifs.
- **Loader (`assets/ffp-connections-feed-loader.js`):** `tap()` → `connection` opens that person's passport (`openCard`→`CollectionView.openPerson`); `notif` now delegates to the bell router `window.ffpHandleNotifClick(link)` so a notification opens its REAL target (activity card via `?activity=`, meetup, panel, URL) instead of guessing. Activity rows already → `ffpViewSharedActivity`. Include bumped ?v=327→328.
- **Verify:** open Connections → From your people; tap "X logged an activity" → activity card; tap "X added your passport" → their passport.

## LATEST 2026-06-19 (18) — Pro scheduling flow: service-driven online booking, session note, pause/resume, tap→people — NEEDS DEPLOY (PRO_BUILD=35; DB LIVE)
- **DB (LIVE, migrations `pro_service_online_and_slot_pause` + `fix_pro_list_slots_notes_online`):** `pro_services.bookable_online` bool added; `pro_save_service`/`pro_list_services` now persist+expose it. New `pro_set_slot_status(pro,id,active|paused)` + `pro_paused_slots(pro)`. `pro_list_slots` now returns `notes` + `bookable_online` — **and dropped a stale `sv.pricing_mode` reference that was making the function ERROR at runtime** (so the slot cache had been silently empty — the real cause of past slot-edit duplicate/"couldn't load" pain). All flows tested live + cleaned up.
- **Service editor (`ffp-professional-services-loader.js`):** "Offer online" toggle → `bookable_online`.
- **Scheduling (`ffp-professional-scheduling-loader.js`):** slot editor gained a **Session note** field (`pro_slots.notes`, already persisted by `pro_save_slot`) + a read-only **online indicator** that follows the chosen service's Offer-online (via `_slUpdateOnline`, updated on service change). **Pause** button in the slot editor + a **Paused slots** strap under the schedule with **Resume** (`pauseSlot`/`resumeSlot`). Session-options sheet now has **Add or remove people** (`openSlotPeople`/`saveSlotPeople`, reuses `pro_save_slot` with only `client_ids`) and "Cancel this week" relabelled **Block this date**. PRO_BUILD 34→35.
- **Member self-booking = NOT in this repo:** booking lives on **findfitpeople.com** (separate platform). The `bookable_online` flag + active status are now ready for that platform to filter on (`service.bookable_online=true AND slot.status='active'`); wiring the member-facing self-book happens there (offer to add a `pro_bookable_slots` RPC when we touch it).

## LATEST 2026-06-19 (17) — Log Activity: tag training partners (passport connections, confirm-first) — DB LIVE; member dashboard NEEDS DEPLOY (FFP_BUILD=365)
- **Picker UX (FFP_BUILD=366):** the box IS the search input now (no separate button + search — saves the double-up). Empty/focused → dropdown of the **10 most trained-with** people (new RPC `member_frequent_partners(me,limit)` = accepted connections ranked by how often I've tagged them, then A–Z); typing filters ALL accepted connections. Suggestions drop under the input (absolute), close on outside tap, stay open for multi-add. `openLogWith`/`renderLogWithResults`/`_logRowHtml`/`_logConnById`.
- **Refinements (FFP_BUILD=365):** (a) "With" picker is now SEARCHABLE (sticky search box filters the connection list — built for 100s/1000s of connections), `renderLogWithResults(q)` filters, search/focus preserved on toggle. (b) Tagged members get a persistent "you've been tagged" strap under Log Activity (`#ffp-tagged-strap` → `openActivityTags()`, refreshed inside `loadNotifications` so it tracks pending count) — they can add tagged activities any time, not just from the bell. (c) High five moved from a full-width button to an ICON on the RIGHT of the shared-card owner row (opposite the name, under the photo): `#ffp-like-circle` (yellow when given) + count below; toggle handler updates the circle + number.
- **What:** member can add accepted connections to a logged activity; each gets a confirm/decline invite; on confirm the session shows on THEIR journey too.
- **DB (LIVE, migration `activity_partners_tagging`):** table `activity_partners(activity_id, partner_member_id, tagged_by, status pending/confirmed/declined, unique(activity,partner))`, RLS on (RPC-only). RPCs (SECURITY DEFINER): `activity_add_partners(me,activity,member_ids[])` (verifies ACCEPTED connection, inserts pending, notifies each), `activity_partner_respond(me,id,accept)` (only the tagged member; notifies tagger), `activity_pending_tags(me)`, `member_partner_activities(me)` (confirmed → journey), `activity_partners_for(activity)`. Full flow tested live (tag→pending→confirm→appears) then test data cleaned up.
- **Frontend (`ffp-member-dashboard.html`, reuses existing systems):** "Training partners (optional)" picker in Log Activity modal (multi-select from `member_connections_list`, accepted only) → on save calls `activity_add_partners` after `log_activity` returns the new id. Confirm UI = bell notification (link `#activity-tags`) → `openActivityTags()` modal (Confirm/Decline → `activity_partner_respond`). `loadJourneyLogs()` merges `member_partner_activities` into LOGS so confirmed shared sessions appear on the map/list. FFP_BUILD 363→364.
- **Reused, not reinvented:** notifications table, bell handler `ffpHandleNotifClick`, connections RPC, journey loader, `escHtml/escNotif`, `showToast`.
- **Verify:** deploy member dashboard; tag a connection on a new activity → they get a bell invite → Confirm → it appears on their journey.

## LATEST 2026-06-18 (15) — Client edit = Given+Surname; REVERTED phone patches (no-patch rule) — NEEDS DEPLOY (PRO_BUILD=28)
- **NO-PATCH violation owned + reverted.** Had added inline styles to `_phoneField` AND duplicated the phone markup inline
  in the client loader to "force" it — both patches. Reverted: phone is the ONE component `_phoneField` (clean, class-based)
  + `.phone-input`/`.phone-cc`(width:96px, flex:0 0 96px)/`.phone-num`(flex:1 1 auto). Deep-checked: only one def of each,
  no conflicting rules → no CSS bug. The phone breakage seen was a STALE/WRONG live dashboard (it served the provider
  portal earlier today), not code. Fix = deploy the current dashboard. (Added RULE 0.5 to CLAUDE.md.)
- **Client edit form now Given names + Surname** (was single Full name) — `mm-given_names`/`mm-surname`; `saveMember`
  derives `full_name=(given+' '+surname)` and sends given_names/surname (pro_save_client persists them). Edit modal splits
  an existing full_name into given/surname for prefill. Gender/DOB/Nationality stay OUT of the form (pulled from Passport).
- **Feedback widget not sending — FIXED AT ROOT (DB, live):** migration `feedback_allow_professional_source` — the
  `feedback.source` CHECK only allowed member/provider; the pro dashboard sends 'professional' → every insert rejected.
  Widened CHECK to member/provider/professional/admin. `submit_feedback` just inserts; widget already sends 'professional'.
  Works now, no deploy.
- **Avatar not filling — NO code change (already correct, single source).** Topbar `.av-btn img{object-fit:cover}` +
  profile photo/cover use `background:center/cover`; only one avatar element, no conflicting rule.

- **2026-06-18 — ROOT CAUSES FOUND (the "nothing changes for 10 rounds" saga):**
  1. **"Wrong file deployed" was WRONG — it was a stale CDN cache.** Plain `web_fetch` of the pro dashboard URL
     returned the Partners (provider) portal; a CACHE-BUSTED fetch (`?cb=...`) returned the correct FFP Professional
     coach portal, and GitHub showed `ffp-professional-dashboard.html` v8 committed. The current file IS live. (RULE 1
     caveat in action — never declare a plain web_fetch the truth; always cache-bust.)
  2. **Header scrolling on mobile = `.app{height:100vh}`.** 100vh > visible viewport on phones → whole `.app` overflows
     → page scrolls the frozen topbar off. FIXED: `.app{height:100vh;height:100dvh}` (line 89) — single source, matches
     the modal-card pattern already in the file.
  3. **Phone / Given-Surname / save "never changing" = `PRO_BUILD` was not bumped after editing the client loader.**
     Dashboard requested `ffp-professional-client-loader.js?v=28`; the browser served the CACHED old loader at that
     unchanged URL, so the loader edits never reached the device. FIXED: `PRO_BUILD=29`. RULE going forward: **bump
     PRO_BUILD on EVERY pro-loader edit, no exceptions.** Added a visible `·b29` marker to the Edit-client modal title
     so the live device can confirm the new loader actually loaded (remove once confirmed).
  4. **VERSIONING CONVENTION (so progress is always knowable):** `PRO_BUILD` (in `ffp-professional-dashboard.html`)
     is THE single version number. Bump it on EVERY change (HTML or any pro loader). It cache-busts the lazy loaders
     AND is displayed live as **"Build N"** at the bottom of the avatar menu (set in the render fn: `av-build` ←
     `'Build '+PRO_BUILD`). To know what's live: open the avatar menu on the device and read the number. No more
     parallel `v7/v8`/`·b29` markers. Currently **Build 30**.
  - **Verified live/at-root this round:** `pro_save_client` persists the exact `saveMember` payload (given/surname/
    phone/tags/notes) — tested against the live DB. `_phoneField` is a true global (top-level in the `<script>` at 501).
    Phone CSS (`.phone-cc` 96px fixed + `.phone-num` flex, lines 193-195) and `.av-btn img{object-fit:cover}` (162) are
    correct in the live file.

## LATEST 2026-06-18 (14) — Client profile shows passport fields; DON'T duplicate (pull from FFP account) — NEEDS DEPLOY (PRO_BUILD=26)
`ffp-professional-client-loader.js` `clientProfile`: now shows passport-style rows — Given name, Surname, Gender, Date of
birth, Email, Phone, Nationality — ALWAYS visible ("—" when empty); given/surname split from `full_name` for legacy
clients. Migration `pro_clients_passport_fields` added given_names/surname/gender/date_of_birth/nationality columns +
pro_save_client persists them (these are the FALLBACK for clients with NO FFP account).
- **Grant's steer: DON'T double up.** Did NOT expand the edit form to re-enter passport fields. The right fill is to PULL
  these from the client's FFP Passport/member record (single source) when they have an account.
- **PULL FROM PASSPORT — BUILT (Grant chose: auto on email match), PRO_BUILD=27.** Migration `pro_client_passport_pull`:
  `pro_client_passport(p_pro,p_client)` matches the client's email → FFP member and returns identity (given/surname/
  full_name/gender/date_of_birth/nationality/email/phone[cc+num]/passport_no/passport_active); scoped to the pro's own
  client. `clientProfile` renders local rows instantly, then async-pulls and upgrades `#cp-details` in place + shows a
  "Pulled from their FFP Passport" badge. (Identity only; health data stays behind the separate consent flow.) Verified:
  RPC returned Sunjay's full identity on email match, has_account:false otherwise (test client restored); JS isolation
  confirmed local→pulled upgrade. The pro_clients passport columns remain the fallback for clients with no FFP account.

## LATEST 2026-06-18 (13) — Pro client panel: profile view + tags/phone-CC save fixes + form display — NEEDS DEPLOY (PRO_BUILD=24)
Deploy `ffp-professional-dashboard.html` + `ffp-professional-client-loader.js` (PRO_BUILD 23→24). DB migration
`pro_save_client_persist_tags` already LIVE.
- **Add-client form display:** phone CC field short (96px, 16px font) + number fills the row (`.phone-input width:100%`,
  `.phone-cc flex:0 0 96px`, `.phone-num flex:1 1 auto`); ALL inputs `font-size:16px` (no iOS zoom) + `min-height:44px`
  (fixes the half-height "Since" date field); removed the "Preview — professional portal in testing" pill.
- **Tags weren't saving (BUG):** `pro_save_client` never wrote `tags` (INSERT/UPDATE omitted it; column existed, all null).
  Fixed RPC to persist tags. `pro_list_clients` already returns it via `to_jsonb(c)`. DB round-trip verified.
- **Phone CC reverted to UAE (BUG):** `_phoneSet` only matched codes in `FFP_TAX.phoneCodes`; a saved code not in the list
  (e.g. +93) fell back to +971. Now it extracts the leading `+code` from the stored value and adds the option if missing,
  so it ALWAYS restores. Validated (+44 known, +93 unknown→restored, empty→default).
- **Client strap:** removed email AND phone (clean strap = name + tags + status). Tapping a strap now opens a **client
  PROFILE view** (`clientProfile`) with details + actions: Connect client Passport, Packages, Assessment form, Edit
  profile, Delete (footer). Inline strap action buttons removed.
- **`clientAssessment(id)` is a PLACEHOLDER** (toast) — awaiting Grant's spec: what the assessment form should capture +
  where it's stored. Build next.
- **PRO_BUILD=25 (2026-06-18):** phone field sizing moved INLINE onto `_phoneField` markup (CC `flex:0 0 96px`, number
  `flex:1 1 auto`) so it can't be broken by a stale/overriding `.phone-cc`/`.phone-num` class rule.
- **DEPLOY NOTE / why it looked unchanged:** the client-profile view + clean strap live in the LOADER, but the loader is
  only re-fetched when `PRO_BUILD` (inside `ffp-professional-dashboard.html`) changes AND the dashboard file is deployed.
  Deploying the loader alone does nothing (live dashboard requests the old ?v=). MUST deploy BOTH
  `ffp-professional-dashboard.html` + `ffp-professional-client-loader.js`, then hard-refresh / reopen the PWA.

## LATEST 2026-06-18 (12) — Pro scheduling: slot-edit DUPLICATE fix + service autofill/refresh — NEEDS DEPLOY (PRO_BUILD=22)
`ffp-professional-scheduling-loader.js` (+ PRO_BUILD 21→22). **Confirmed real dup rows in DB** (e.g. provider a67378e3:
4 active slots all at the DEFAULT Mon 18:00 → edit modal opened in "New slot" mode because the `_proSlotsCache` lookup
missed, so save INSERTED with defaults instead of updating; also rapid-fire triples = double-submits).
- **`openSlotModal`:** if editing an id not in cache → `await _loadSlotsCache()`; if STILL missing → toast + abort (never
  fall through to a blank "New slot" that inserts a duplicate). Also `_ensureProSvc(true)` on every open so a just-added
  service appears in the picker (real-time).
- **`saveSlot`:** `_savingSlot` re-entry guard (blocks double-tap double-insert).
- **`_slSvcPick`:** now autofills duration + capacity + **location** from the chosen service (defaults).
- **"Who's in this slot":** removed the inline "Add a client by name" input — slot only SELECTS existing clients now;
  adding a client is Clients-tab only. Empty state points there.
- Validated via isolation harness (edit→reload→EDIT; truly-missing→ABORT; new→NEW; double-submit→BLOCKED; autofill OK).
- **NOTE — existing duplicate rows still in DB** (a67378e3 ×4 Mon 18:00; ff83faf4 several) — NOT auto-deleted (some may
  have clients/exceptions/bookings). Offer Grant a careful cleanup (keep the row with clients/exceptions, delete empties).
- **Still open (features, not bugs):** faster availability ("Mon–Fri 6AM–10AM" bulk setter — availability UI not yet
  located/built); slot delete control (single vs future ALREADY exists: "Cancel just this week" / "End slot"); change
  client timing (ALREADY exists: "Reschedule just this week" / "Shift this slot from now on").

## LATEST 2026-06-18 (11) — Pro Add-client modal tweaks — NEEDS DEPLOY (pro dashboard + client loader, PRO_BUILD=21)
`ffp-professional-client-loader.js` `openMemberModal`: Email + Phone fields → `.field full` (full-width rows); Notes
`rows 2→4` (double height). `ffp-professional-dashboard.html`: `.phone-cc` width `118px→92px` (+ right-pad 26→22) so the
country-code is narrower and the number (`.phone-num` flex:1) fills the rest — applies to every phone field (profile +
add-client). `PRO_BUILD 20→21` so the lazy client loader re-fetches. Deploy both files.

## LATEST 2026-06-18 (10) — Map pins enriched + social share on own activity — NEEDS DEPLOY (member dashboard)
Member dashboard inline-script changes (deploy `ffp-member-dashboard.html`, hard-refresh; no asset ?v):
- **Map pins (own activities):** popup was "venue · N days ago". Now shows **Activity (title) · Duration · Date** + an
  **"Open activity"** link → `ffpViewSharedActivity(l.id)` (opens the existing activity card). Required adding `id: r.id`
  to the LOGS objects in `loadJourneyLogs` (they had no id before).
- **Social share (own activity):** `ffpRenderActivityCard` now stores `window._ffpActCard=a` and, for the OWNER, shows a
  yellow **Share** button → new `ffpSocialShareActivity(id)` = native share sheet (`navigator.share`: WhatsApp/IG/etc.)
  with an `?activity=<id>` link + summary text; desktop fallback copies the link. Existing in-app "Share with connections"
  kept (relabelled). Validated via isolation harness.
- **Reaction is called "HIGH FIVE"** (migrations `activity_high_five_wording` + `_v2`): button = "High five" → once
  given "High five given"; `front_hand` icon, FFP-yellow when given; notification = **"X gave you a High Five"** (body
  "Nice work on your <activity> — keep moving.", icon front_hand). Internal names stay `activity_likes` /
  `member_like_activity`. (Renamed from "Like" per Grant; "congratulate" reserved for PRs.)
- **Like/High-five on OTHERS' activities — DONE (migration `activity_likes_feature`, LIVE + member dashboard JS).** New
  `activity_likes` table (RLS on, no policies — definer RPCs only). `member_like_activity(p_me,p_id)` toggles a like
  (allowed if viewer owns it OR it's shared + connected), and on a NEW like pings the owner's bell (link
  `/ffp-member-dashboard.html?activity=<id>#panel-passport`, mirroring the share notification + congratulate). Extended
  `member_activity_view` to return `like_count` + `i_liked`. `ffpRenderActivityCard` non-owner branch now shows a Like
  button (filled red when liked, with count) → `ffpToggleActivityLike`. DB round-trip verified (like→count1→unlike→count0,
  left clean); JS isolation-validated. Owners never see Like; non-owners never see Share/Edit.
- **FUTURE — Garmin/Polar route map:** when device integrations land + GPS route stored, draw a Leaflet polyline on the
  card's existing `#ffp-act-map` location map. Parked.

## LATEST 2026-06-18 (9) — Pro dashboard "redirects to passport" = WRONG FILE / stale deploy at that URL
Report: tapping the Professional webapp (PWA start_url `/ffp-professional-dashboard.html`) lands on the member
passport. Investigated end-to-end: pro dashboard `boot()` does NOT redirect to the member dashboard; shared
`ffp-api-integration.js` only guards member/provider paths; manifest start_url is correct; sw.js doesn't rewrite.
**Root cause (verified via web_fetch, twice incl. cache-bust):** the LIVE `ffp-professional-dashboard.html` returns the
**PARTNER/PROVIDER portal** content (`<title>FFP Passport — Partners Portal</title>`, "Sign in to your partner account")
— identical to local `ffp-provider-dashboard.html`. The local/workspace `ffp-professional-dashboard.html` is the CORRECT
coach portal (`<title>FFP Professional</title>`). So the wrong page is live at that filename (or a stale CDN copy — Rule 1
caveat: web_fetch can serve cached). NOT caused by this session's edits (they were on the correct coach file).
**Fix:** check GitHub `ffp-professional-dashboard.html` `<title>`: if "Partners Portal" → wrong content committed,
replace with the repo's real coach portal (title "FFP Professional") + deploy; if already "FFP Professional" → stale
Netlify/CDN cache → force fresh deploy + reinstall the webapp icon. Shared the correct file to Grant. Awaiting which title.

## LATEST 2026-06-18 (8) — Billing emails: failed-payment recovery + trial-ending reminder — NEEDS DEPLOY + STRIPE
Deploy `assets/ffp-passport-backend-main/.../index.js`. Added two branded customer emails (reuse `mailer` + `brandEmail`):
- `sendPaymentFailedEmail` — on `invoice.payment_failed` (renewal card declined). Heads-up + "Update my card" CTA. Does NOT
  change access (Stripe retries; subscription.updated/deleted handles access). Handler `onInvoicePaymentFailed` resolves
  member by stripe_customer_id → email.
- `sendTrialEndingEmail` — on `customer.subscription.trial_will_end` (3 days before convert). Says the date + what they'll
  be charged ($149/yr or $20/mo from metadata.plan) + manage/cancel note. Handler `onTrialWillEnd` resolves member by
  metadata.member_id → customer → subscription; trial date from `sub.trial_end`.
- Webhook dispatch routes both new event types. Validated (node --check + run: both emails fire; non-sub invoice ignored).
- **Stripe step:** add these 2 events to the live webhook endpoint (total 7): `invoice.payment_failed`,
  `customer.subscription.trial_will_end`. (The other 5 were added 2026-06-18.) Events do nothing until the backend deploy.

## LATEST 2026-06-18 (7) — Passport gate copy fix + CRITICAL billing bug (paying members locked out)
**(a) Gate copy fixed (deploy `ffp-member-dashboard.html`).** The subscription gate (`#ffp-pass-gate`, ~line 12783,
shown when `member_passport_active`=false) had off-brand copy. Now: headline "**The Active Lifestyle Community**"
(was "Your Passport unlocks the app"); body "**Passport holders can connect, meet up and engage with highly motivated
and active people — an environment for truly active people.**" (was the "passport & stamps, quests & challenges…" line).
Login signup screen (`login.html`) has separate copy — left as-is.
**(b) CRITICAL — valid Passport holders locked out (FIXED in DB, live).** Cause: the 7-day trial sets
`passport_expires_at` to the trial end; on trial→paid conversion that date was NOT being pushed out, so valid Passport
holders read as "expired" and got the paywall. Hit Hannah Wells (annual) + Vivian Aranha (monthly); would hit every
converting trial. (NB: a professional is just a valid Passport holder — no separate pro payment.)
- **Fix (migration `passport_active_subscription_safety_net`, LIVE):** both `member_passport_active` AND
  `pro_passport_active` now treat someone as a valid holder if expiry is current OR they have a live paid subscription
  (`stripe_subscription_id is not null and paid and membership<>'free'`). A real cancellation flips membership→'free' →
  still correctly blocked. Verified: Hannah/Vivian/Sunjay all active app+pro; 0 free members wrongly allowed. So a
  stale/late/missed renewal webhook can never again lock out a valid holder.
- **PROPER FIX (backend — deploy `assets/ffp-passport-backend-main/.../index.js`):** root cause = the conversion/renewal
  webhook events weren't extending the date (handler was correct; events likely not delivered). Three changes:
  (1) `setMemberFromSubscription` now reads `current_period_end` with a fallback to `sub.items.data[0].current_period_end`
  (newer Stripe API moved it to items) so a SDK/API bump can't silently null the expiry; (2) webhook now also handles
  `customer.subscription.created`; (3) NEW admin route **`POST /api/billing/resync`** (guard header
  `x-admin-key: <ADMIN_RESYNC_KEY>`) — loops every member with a `stripe_subscription_id`, re-reads the live Stripe sub,
  and writes the real status + period end. Validated (node --check + run: 401 w/o key, updates w/ key, item fallback works).
- **Grant's steps to fully close it:** (a) deploy the backend file; (b) set env `ADMIN_RESYNC_KEY` in Vercel;
  (c) in Stripe, ensure the webhook endpoint has `checkout.session.completed` + `invoice.paid` +
  `customer.subscription.created/updated/deleted` enabled and the signing secret matches `STRIPE_WEBHOOK_SECRET`;
  (d) run once: `curl -X POST https://ffp-passport-backend.vercel.app/api/billing/resync -H "x-admin-key: <KEY>"` →
  fixes all stuck dates from Stripe truth. AFTER dates verified correct, the RPC safety-net (migration
  `passport_active_subscription_safety_net`) can be removed if desired (it's then redundant).

## LATEST 2026-06-18 (6) — Professional profile fixes + login pathway — NEEDS DEPLOY
Deploy `ffp-member-dashboard.html` + `login.html` (inline scripts, no ?v bump). `ffp-professional-dashboard.html` was
touched then fully reverted — no net change.
- **Profession picker now full-screen** — `MemberProfile.openRolePicker()` was missing `fullBleed:true` (every other
  picker has it). Added it; retitled "Professional Role"→"Profession" + search/subtitle wording. Taxonomy + search
  already present (`FFP_PROFESSIONAL_ROLES`, grouped).
- **Profession now saves across refresh (BUG FIX).** Root cause (verified): backend PUT `/api/members/:id` (index.js
  ~line 2574) only persists a fixed field list (`preferences`, `skills`, …) and **drops a top-level `professional`**, so it
  was never stored. Frontend-only fix (no backend redeploy): `saveProfile` mirrors `professional` INTO `preferences` (which
  IS persisted), hydration reads `m.preferences.professional` as fallback. Round-trip validated.
- **Professional login pathway no longer bounced to member Passport.** `login.html` launch auto-redirect (~line 729) sent
  any existing session to the member dashboard with portal defaulting to 'member'. Now honors `?portal=professional` (or
  `#professional`): sets `selectedPortal='professional'` before the redirect → `handleAuthRedirect` routes a signed-in pro
  to `ffp-professional-dashboard.html`. Fresh Professional-tile sign-in already worked.
- **Passport requirement: NOT duplicated.** It already exists server-side — `pro_passport_active(member)` is the single
  source of truth, enforced by `professional_link` (→`passport_inactive`) and surfaced via `professional_for_member`'s
  `passport_active`/`can_access`. A client-side `_hasValidPassport` + `needpass` gate was added then REVERTED to avoid
  drift. Same email = same account across Passport / Professional dashboard / findfitpeople.com → one passport status.

## LATEST 2026-06-18 (5) — FIX: members had no route into the Professional portal (Sunjay onboarding) — NEEDS DEPLOY
Report: Sunjay (first-time pro) signed in, was NOT asked for professional setup, landed on an empty Passport.
**Diagnosed (tool-verified, not guessed):**
- Sunjay (`9d550bd3…`, sunjay@findfitpeople.com) = role `member`, `paid=true`, `membership='passport'`,
  passport_expires 2027-06-08 (ACTIVE), and **no `professionals` row**.
- `ffp-professional-dashboard.html` `boot()` (line ~1080) is CORRECT: signed-in member + `professional_for_member`
  returns null → `paintOnboard()` + `showGateState('onboard')`. So reaching that page WOULD show the setup form.
- Root cause = he never reached it. `login.html` (lines ~729-731) auto-redirects any existing session via
  `handleAuthRedirect` on load, with `selectedPortal` still defaulting to `'member'` → member dashboard. A signed-in
  member is bounced to their Passport before they can tap the Professional tile. No entry from member → pro dashboard.
- (Aside: the member profile's self-declared "professional role" picker — ffp-member-dashboard ~line 8265 — is cosmetic
  and unrelated to the real Professionals Portal / `professionals` table.)
- **Fix attempt (REMOVED 2026-06-18):** added a "Professional portal" item to the member account menu →
  `window.location.href='ffp-professional-dashboard.html'`. It didn't navigate cleanly (the user-menu's delegated
  panel-switch handler swallowed the click — it just stayed on the Passport), so per Grant it was REMOVED. The real route
  into the pro portal is the login pathway fix (LATEST (6)): `login.html?portal=professional` / Professional tile.

## LATEST 2026-06-18 (4) — QUESTS proof: audit + NEW qr_gps (Scan QR + GPS) combined proof — NEEDS DEPLOY (v9/v61)
Goal: make quest proofs actually usable. **Audit (verified this turn):** the Admin Reviews queue IS wired
(`quest_pending_completions` + `quest_verify_completion`, Approve/Reject in the Reviews tab), so pending
photo/partner/referral submissions can be signed off today. **qr / gps / photo / photo_gps all work**
(`member_quest_complete_task`). **`auto` does NOT work** — RPC returns `auto_task`; `quest_tasks.rule` jsonb exists but
nothing consumes it (auto-engine = still to build; see Open/next).
- **NEW combined `qr_gps` proof (built, LIVE DB + needs JS deploy):** member must scan the correct QR **and** be within the
  radius (defaults **250m**). Migration `quest_proof_qr_gps_combined`: `quest_save_task` now auto-gens a `qr_token` for
  `qr_gps` too; `member_quest_complete_task` has a `qr_gps` branch (bad_code → too_far(distance_m) → verified).
  Admin builder: PROOFS gained `['qr_gps','Scan QR + GPS']`, `qtProofChange` shows the GPS row for it + defaults radius 250,
  `saveTask` sends lat/lng/radius for qr_gps. Member: PROOF map `qr_gps` + `doTask` qr_gps branch (prompt code → getGeo →
  `_complete({scanned_code,lat,lng})`). Validated via isolation harness (node --check OK).
- Maps to Grant's examples: "visit a location"=gps (works), "completed task"=qr (works), "attend an event"=**qr_gps** (new).

**AUTO check-in engine — DESIGNED, awaiting Grant's go (NOT built):** two flavours requested — (a) a SPECIFIC partner
session/listing auto-completes on check-in, and (b) a GLOBAL "attend any matching space near you, anywhere" push. Plan: a
`rule` jsonb schema (match by listing_id | provider_id | activity/category | any) + an engine invoked from the existing
check-in RPCs (`venue_checkin_session`/`booking_checkin`/`member_event_checkin`/`venue_checkin_activity`/`pro_checkin_service`,
"depends on the task") that, on check-in, finds active `auto` tasks the member is enrolled in whose rule matches and inserts
a verified completion (wrapped so a quest error can NEVER block a check-in). Confirm matching granularity + which triggers
before building (touches live check-in paths).

## LATEST 2026-06-18 (3) — Challenges panel parked (hide on member, grey-out in admin) — NEEDS DEPLOY
Grant: park Challenges for a future feature. Code untouched — only entry points changed (reversible).
- **Member (`ffp-member-dashboard.html`):** bottom-nav Challenges button (`data-panel="panel-challenges"`, line ~5404)
  now `style="display:none;"`. Panel div `#panel-challenges` left intact but unreachable. Restore = remove the inline style.
- **Admin (`ffp-admin-dashboard.html`):** sidebar link (line ~1477) greyed + non-clickable — removed `onclick`, added
  `aria-disabled`, `style="opacity:.45;pointer-events:none;cursor:default;"` + a "Soon" tag. Panel/loader/panelNames
  untouched. Restore = re-add `onclick="App.go('panel-challenges')"`, drop the style + Soon tag.

## LATEST 2026-06-18 (2) — FIX: Log Activity modal inherited previous entry's input — NEEDS DEPLOY
Report (Sunjay Vyas): opening the passport-panel "Log Activity" modal for a NEW activity showed input left over from his
last upload. **Root cause (verified):** `openLogModal()` reset distance/HR/pin/photo/date/time/duration/country/city but
NOT `log-activity`, `log-calories`, `log-notes` — those are only written in edit mode (`openLogModalForEdit`), and
`saveLog()` success path just calls `closeLogModal()` (hides, no reset). So after any save, the next fresh open kept the old
Activity name, Calories and Notes.
- **Fix (`ffp-member-dashboard.html`, in `openLogModal`):** the "fresh form" block now also clears `log-activity`,
  `log-calories`, `log-notes`. Edit mode unaffected — `openLogModalForEdit` calls `openLogModal` first, then re-applies row
  values. No DB change. Inline script in the page → no asset ?v bump; deploy the HTML + hard-refresh.

## LATEST 2026-06-18 — QUESTS polish: card/preview height, partner filter, gender leaderboard — NEEDS DEPLOY (v8/v60)
Grant's 4 asks, all done & verified. **2 JS files + 2 cache-busts to deploy; 2 DB migrations already LIVE.**
- **Headline (major) card 2× taller:** `assets/ffp-quests-core.js` `_ensureCss` `.q-major min-height 138px → 276px`.
- **Admin hero-image preview 2× taller:** `ffp-admin-quests-loader.js` `#q-hero-preview` inline `height:150px → 300px`.
- **Partner section showing a stray quest — ROOT CAUSE:** `member_quests_feed` partner branch selected ANY
  `owner_type<>'ffp'` joined quest with NO status filter, so Grant's own ended, member-created "Fitness Class Quest"
  appeared under Partner. **Fix (migration `quests_feed_partner_hide_ended`, LIVE):** partner branch now also requires
  `coalesce(status,'')<>'ended'` and `(active_to is null or active_to>=now())`. Per Grant's call = "just hide ended ones"
  (live member-created quests still show). Verified: partner count for grant@findfitpeople.com = 0.
- **Gender filter in quest detail leaderboard:** Grant wanted "a filter button with all options inside" (matches the app's
  tune/Filters pattern). Board pane rebuilt: a **Filters button** (tune icon + yellow count badge) toggles `#q-board-panel`
  holding Location chips (Global/My country/My city) **+ Gender chips (All/Men/Women)**; they combine. New state
  `boardGender`; handlers `boardGenderFilter`, `toggleBoardFilters`, `_updateFilterBadge`; `boardFilter` scoped its query to
  `.q-chip[data-scope]` (was hitting all chips). `loadQuestBoard` passes `p_gender` when set. New CSS + id bumped to v8.
  - **Migration `quest_leaderboard_add_gender` (LIVE):** dropped 2-arg + 5-arg overloads, recreated as ONE
    `quest_leaderboard(p_quest,p_limit,p_city,p_country,p_search,p_gender)` (single fn → no overload ambiguity; old client
    calling without p_gender still resolves). `members.gender` = 'Male'/'Female'. All 3 call shapes tested OK.
- **Cache-busts:** member dashboard quests-core `?v=7 → ?v=8`; admin `_lazyInit v=59 → v=60`.
- Validated: edited quests-core region extracted to a standalone harness → `node --check` OK + ran (board pane returns a
  string). Admin edit was a 3-char inline height swap. (Bash mount serves STALE/truncated copies of these files —
  quests-core mount=698 lines vs host 856, admin mount cut at 274 — so full-file `node --check` over the mount is invalid;
  trusted Read/Edit + isolation harness per Rule 3.)

## LATEST 2026-06-17 (6) — MEMBER quests: gamification pass (accordion tasks, progress loop) — NEEDS DEPLOY (v7)
Grant: kill "mission" wording; major card shouldn't show "N tasks/P pts"; task list = tap-to-expand accordion; must clearly
show completion; make it addictive. Done in `assets/ffp-quests-core.js` (?v=7):
- Word "mission" GONE — section is now "More quests".
- **Major card**: no task/points stats. Not joined → "Start the quest" CTA. Joined → a filling **progress bar** + "Continue".
  Complete → "Quest complete" trophy. (Progress is the hook, not cold counts.)
- **List rows**: joined → mini progress bar + chevron (or trophy if done); not joined → social proof ("N playing") + Join.
- **Detail = the dopamine loop**: a **progress hero** (big bar that animates from 0→% on open, done/total, points climbing,
  rank to chase) + **Tasks | Leaderboard** toggle. Tasks are an **accordion** (`taskAccordion`/`toggleTask`): tap a task →
  expands to "How to complete" + the action button; only one open at a time. **Completion is obvious**: filled green check,
  row tints green, points tag turns green, progress bar advances on reload. Leaderboard tab filterable (global/country/city + search).
- Validated (edited region node-checked OK). **Deploy member dashboard + quests-core v7. DB already live.**

## LATEST 2026-06-17 (5) — MEMBER quests panel REBUILT to Major / Minor / Partner (mockup) — NEEDS DEPLOY
Killed Explore/My-quests tabs and the 2-col "giant square" cards. Member panel is now exactly: **MAJOR quest** (one
headline, compact full-width banner) → **Minor quests** ("FFP missions", compact full-width list rows) → **Partner quests**
(only shown if the member has unlocked any; compact rows w/ lock badge). Designed to scale (rows, not squares).
- **DB `member_quests_feed`** now returns `{major, minor, partner}` (was headline/explore/mine). `minor`=FFP non-headline
  public live (with joined flag + my_completed); `partner`=joined non-FFP quests (provider_name). Back-compat keys still read.
- **DB `quest_leaderboard`** extended: `(p_quest, p_limit, p_city, p_country, p_search)` — filterable Global/Country/City +
  name search, returns city too. Defaults null = old behaviour. **Both DB changes already LIVE (no deploy).**
- **Major-quest detail modal redesigned for scale:** slim cover+title, one compact stat strip (pts · rank · done — no big
  squares), a **Tasks | Leaderboard** segmented toggle. Tasks = compact rows in a **scroll container (max-h 54vh)** → handles
  100+ tasks. Leaderboard = **filter chips (Global/My country/My city) + name search + scrollable top-50** → handles 10k users.
- `assets/ffp-quests-core.js` rewritten (state major/minor/partner; renderAll/renderMajor/rowMinor/rowPartner; compact
  taskRow; questPane/boardFilter/boardSearchInput/loadQuestBoard; self-injected CSS `ffp-quests-v6-css`; removed dead
  loadBoard/renderBoard + cat/scope/tab listeners). Member-created exploration-quest code preserved but unsurfaced.
- `ffp-member-dashboard.html`: #panel-quests = `#quest-hero` (major) + `#quest-sections` (minor+partner); tabs/grid removed;
  quests-core bumped **?v=6**. Validated (edited region node-checked OK; file closes clean at 762). **Deploy member dashboard + quests-core v6.**

## LATEST 2026-06-17 (4) — QUESTS upload: RESOLVED via storage RLS policy rebuild (DB, no deploy)
Even with a valid `authenticated` admin JWT, storage kept returning 403 "new row violates RLS" on quest-images — yet
DB probes proved anon+authenticated CAN insert (RLS enforced; control test on payout-receipts correctly failed), the
bucket is public with no mime/size limit, and **quest-images already had 8 objects** (last upload Jun 16) while **avatars
got an upload today** under a STRICTER policy. Same authenticated role passing avatars' is_admin() check but failing
quest-images' looser bucket_id check ⇒ the quest-images policies were in a stale/broken state, not being evaluated by storage.
- **Fix (migration `quest_images_storage_policies_rebuild`):** dropped the 6 old "quest-images insert/update (anon|public)"
  policies and recreated clean consolidated ones — `quest_images_insert` (INSERT TO anon,authenticated check bucket_id),
  `quest_images_update` (UPDATE same), `quest_images_read` (SELECT TO public). Recreating refreshes storage's policy state.
- Re-probed after: anon_ok=t, auth_ok=t. **Server-side only — NO redeploy.** Admin just retries the upload (JS already v59).
- If it ever recurs: definitive fallback is a backend (service-role) upload endpoint that bypasses storage RLS entirely.

## LATEST 2026-06-17 (3) — QUESTS admin upload: REAL fix = auth as admin JWT, not anon — NEEDS DEPLOY (v59)
Live console (v58) finally gave the real error: `POST …/quest-images/… 400` → body
`{"statusCode":"403","error":"Unauthorized","message":"new row violates row-level security policy"}`. So it was never a
hang OR the JWT wrapper — the **anon-only** upload I'd switched to was rejected by storage RLS. DB probe (set role anon /
authenticated, insert into storage.objects bucket_id='quest-images') proved **both roles CAN insert** at the DB level, and
the hardcoded anon key matches the project's current anon key exactly — yet the live anon request still 403'd (storage role
mismatch). 
- **Fix:** `uploadHero` now sends `Authorization: Bearer <admin JWT>` via `window.FFPAuth.getJwt()` (role=authenticated —
  the same identity that loads all admin data + passes is_admin(), and how every other bucket upload in the app authenticates),
  falling back to the anon key only if no JWT. Still direct native fetch + raw file (no compress) + full breadcrumb logs incl.
  which token was used and exact HTTP status/body.
- **Cache-bust `v=58 → v=59`.** Deploy BOTH files + hard-refresh. Console should now show `auth token: admin JWT (…)` →
  `upload response status: 200` → `upload OK →`.

## LATEST 2026-06-17 (2) — QUESTS admin upload: removed canvas compression (was hanging) — NEEDS DEPLOY (v58)
Live console (Grant, incognito) confirmed `ffp-admin-quests-loader.js?v=57` IS loaded and there was **no upload error
logged** — meaning the upload wasn't erroring, it was silently never completing. Cause: `uploadHero` did
`await compressImage(file)`, and `compressImage` resolves only inside `canvas.toBlob(cb)`. That callback can **never fire**
for some images (large / HEIC / memory pressure), so the await hangs forever — dead button, stuck "Uploading…" toast, no error.
- **Fix:** `uploadHero` now uploads the **RAW file** (no canvas/compress step at all) via the same direct-REST native fetch
  + anon key. Added breadcrumb `console.log`s (uploadHero fired / file name+type+size / POST url / response status / OK or
  error) so it can NEVER be silent again — next attempt leaves a visible trail. Accept ext now includes heic/heif.
- **Cache-bust `v=57 → v=58`** in `ffp-admin-dashboard.html`. Deploy BOTH files + hard-refresh.
- If it still fails after this, the console will now show exactly where (e.g. `upload response status: 400` + body) — paste that.

## LATEST 2026-06-17 — QUESTS admin: image upload ROOT-CAUSE fix (direct REST, native fetch) — NEEDS DEPLOY
The admin quest hero image upload kept failing. **Root cause (verified, not guessed this time):** uploads went through
`window.supabase.storage`, and `window.supabase` is built in `assets/ffp-api-integration.js` with a custom `global.fetch`
wrapper that **overrides `Authorization` with `FFPAuth.getJwt()`** on every request. In the admin app that injected member
JWT is stale/wrong for Storage, so the upload was rejected and the SDK error was swallowed into a vague toast. (Bucket +
policies are fine — `quest-images` is public with INSERT policies for anon/authenticated/public; confirmed via DB.)
- **Fix in `ffp-admin-quests-loader.js`:** `uploadHero()` now uploads with **native `window.fetch` directly to the Storage
  REST endpoint** (`POST /storage/v1/object/quest-images/<path>`) using the **anon apikey for both `apikey` and
  `Authorization`** — bypassing the SDK and the JWT-injecting wrapper entirely. Anon has an INSERT policy so it always works
  regardless of session state. Public URL built directly. On failure it now surfaces the **exact HTTP status + body** in the
  toast + console (no more silent failures). compressImage still runs with raw-file fallback.
- **Cache-bust bumped `v=56 → v=57`** in `ffp-admin-dashboard.html` `_lazyInit` — **this is essential**: the loader URL only
  changes when this version bumps, so without it the browser keeps serving the cached OLD loader (a likely reason earlier
  fixes "didn't take"). Deploy BOTH `ffp-admin-quests-loader.js` + `ffp-admin-dashboard.html`.

## LATEST 2026-06-17 — QUESTS: HEADLINE/FEATURED quest on member panel (mockup match) — NEEDS DEPLOY
Member Quests panel reworked to the agreed mockup: **one big headline (flagship) FFP quest at the top**, click → modal
with all its tasks + tasks-completed + leaderboard; **minor FFP (category) quests listed below** to join. Killed the "FFP
Points" stat hero, the "Create your own quest" button, and the partner-code button from the public panel.
- **DB migration `quests_headline_flag_feed` (LIVE):** added `quests.is_headline boolean default false`. Rewrote
  **`member_quests_feed(p_me)`** → now returns `{ headline, explore, mine }`: `headline` = the single FFP public+live
  `is_headline` quest (with `my_points`/`my_completed`/`joined`/`joined_count`/`task_count`/`points_total`), `explore` =
  other FFP public+live quests not joined (headline excluded), `mine` = joined. Updated **`admin_save_quest`** for `is_headline`.
- **`assets/ffp-quests-core.js` v3 → cache-bust `?v=5`:** `load()` reads headline/explore/mine; **`renderHero()`**
  rewritten to a big clickable featured headline card (hero image/gradient bg, "Featured quest" pill, title, "N tasks · P
  pts", "N joined", Join/Continue); **`render()`** shows "More FFP quests" + minor cards (Leaderboard tab removed);
  **`openTaskDetail()`** now appends a Leaderboard section + new **`loadQuestBoard()`** (`quest_leaderboard`, medal ranks).
  Member-created exploration quests PRESERVED but no longer surfaced in Explore.
- **`ffp-member-dashboard.html`:** #panel-quests now Explore + My quests only (removed Leaderboard tab, scope-seg, cat
  row, Create + partner-code buttons); subhead reworded; `#quest-hero` renders the headline card; quests-core bumped `?v=5`.
- **`ffp-admin-quests-loader.js` v3:** full-screen editor; New-FFP-quest form has **"Headline quest" checkbox `q-headline`**;
  `save()` payload sets `is_headline` + (NOT-NULL fix) `eligibility:'all', require_distinct_venues:false`; "task" wording;
  **`uploadHero()` hardened** (raw-file fallback if canvas compress fails, real error surfaced). Inline Tasks builder + Reviews tab.
- **`ffp-admin-dashboard.html`:** `_lazyInit` global admin-loader cache-bust bumped to **`v=56`** (must deploy so new loader loads).
- Validated (mount truncates these large files → false EOF at 682/274; Read confirms whole: core 714 lines closes 712–713,
  admin 388 closes IIFE 387; changed methods isolation-parsed OK). **Deploy 4 files; then Admin → Quests, tick "Headline
  quest" on the flagship quest + set it Live so the member hero populates.**

## LATEST 2026-06-17 — QUESTS REBUILD (Phase 1 of 4: data model + RPCs) — BACKEND LIVE, verified
Rethink: quests become **points-scored mission checklists with proof**, on a **leaderboard**. Strategy locked with Grant:
**FFP quests = the public, global focus of the Passport** (acquisition engine → pulls in partners); **partner quests =
members-only, unlocked via QR/link** (retention tool), never shown in the public feed or global rankings.
Member Passport is the deliverable; **authoring stays in partner + admin dashboards** (existing builds, extended in Phase 4).
- NEW **`quest_tasks`** (missions): title, instruction, **points**, `proof_type` (auto|qr|photo|gps|photo_gps|partner|referral),
  `verifier` (auto|partner|admin), optional `provider_id`, GPS `lat/lng/radius_m`, `qr_token`, `rule` jsonb (for auto).
- NEW **`quest_task_completions`** (the proof): `proof_photo_url`, `lat/lng`, `scanned_code`, `note`, status
  (pending|verified|rejected), `points_awarded`. Unique (task, member).
- **`quests`** extended: `visibility` (public|unlock), `unlock_code` (partner QR/link), `leaderboard` (global|quest|none),
  `points_total`. Relaxed legacy NOT NULLs (stamp_id, target_count) + added `reward_type='points'` to the check. **`quest_progress`**
  gained cached `points`; status stays `in_progress`|`completed`.
- RPCs (all GRANTed): `member_quests_feed` (Explore = public FFP not-joined; Mine = joined), `member_quest_detail`
  (tasks + my_state + my_points + my_rank), `member_quest_join` (blocks unlock-only), `member_quest_unlock(code)`,
  `member_quest_complete_task(member,task,{photo_url,lat,lng,scanned_code,note})` — validates per proof type (QR token match;
  GPS within radius via `ffp_haversine_m`; photo required; partner/referral → pending), auto-verifies or queues, awards points,
  flips quest to completed when all tasks verified. Leaderboards: `quest_leaderboard(quest)` + **`ffp_global_leaderboard(city,country,limit)`**
  → **city / country / global ambassador boards** (sums points across FFP quests; members carry city+country).
- Live-tested end-to-end (QR +5 verified, photo+GPS in-range +5 verified, photo→partner pending 0, dedupe, detail, all 3
  leaderboards, feed) then cleaned up. **No deploy this phase (DB only).**
**Phase 2 (member Passport UI, NEEDS DEPLOY)** — rebuilt `assets/ffp-quests-core.js` **v3** + #panel-quests tabs:
- Tabs now **Explore / My quests / Leaderboard** (was Discover/My/Completed). Explore = public FFP quests
  (`member_quests_feed`); My quests = joined (FFP + partner + member-created); Leaderboard = **city/country/global**
  ambassador board (`ffp_global_leaderboard`, scope via the existing scope-seg, shown only on that tab). Hero shows
  the member's FFP points + global rank.
- Quest detail (`openTaskDetail` → `member_quest_detail`) = **mission checklist**; each task completed with proof via
  `member_quest_complete_task`: QR (prompt code), photo (FFPUpload), GPS (`navigator.geolocation`), photo+GPS, or
  partner/referral (submits as pending). Errors mapped (bad_code, too_far w/ distance, need_location/photo).
- **Partner quests unlock** via "Have a partner code? Unlock" button → `member_quest_unlock(code)` → opens it.
- **Preserved** member-created exploration quests verbatim: create/edit/photo/invite + old venue detail (`openMemberDetail`,
  still uses /api/quests + member_save_quest + member_quest_venues/participants). They no longer show in Explore
  (Explore = FFP only, by design) but remain in My quests once joined. JS validated (node --check, 698 lines).
- DEPLOY: `assets/ffp-quests-core.js` (v3) + `ffp-member-dashboard.html` (tabs relabel, unlock button, cache-bust ?v=3).
  Next: Phase 3 auto-rule engine, Phase 4 dashboard authoring (task builder + QR/unlock) + verify queues.
**Phase 4a (authoring + verify RPCs) — DB LIVE, verified.** (UI still to come.)
- `admin_save_quest(id,p)` upsert FFP quest (owner_type ffp, visibility public, leaderboard). `provider_quest_meta(provider,id,p)`
  sets partner quest visibility=unlock + generates `unlock_code` + leaderboard. `quest_save_task(quest,id,p)` /
  `quest_delete_task(id)` / `quest_list_tasks(quest)` — task builder (auto-generates `qr_token` for qr tasks; `_quest_recount`
  keeps points_total + legacy target_count in sync). Verify queue: `quest_pending_completions(provider|null)` (provider=their
  tasks, null=admin all) + `quest_verify_completion(id,'approve'|'reject',by)` (approve awards points + advances quest_progress).
- Live-tested: create FFP quest → add QR(+5,auto) & photo(+10,partner) tasks → points_total 15 → member submitted photo →
  pending queue showed proof → approve → +10 awarded, progress 1/2. Cleaned up. **Pending: admin task-builder UI (so Explore
  has content), partner task-builder + unlock/QR UI, verify-queue UIs.**
**Phase 4b (admin authoring UI, NEEDS DEPLOY)** — rebuilt `ffp-admin-quests-loader.js` **v3**:
- Admin Quests screen reshaped to the points/missions model. New FFP quest form (title/desc/category/scope/city-country/
  **leaderboard**/hero) writes to `quests` directly (admin RLS) as owner_type=ffp, visibility=public, reward_type=points.
- **Missions builder** (inline, appears once the quest is saved): add/edit/delete missions via `quest_save_task` /
  `quest_list_tasks` / `quest_delete_task` — each with points, proof type, verifier, optional venue, GPS lat/lng/radius;
  QR token auto-generated + shown for qr missions. List shows points_total + mission count.
- **Reviews tab** — `quest_pending_completions(null)` lists pending photo/partner submissions with the proof image →
  Approve/Reject via `quest_verify_completion`. Publish/pause/end unchanged. Dropped the old stamp/sponsor/venue form
  (legacy quests still display; admin now authors FFP points quests). JS validated (340 lines, balanced).
- DEPLOY: `ffp-admin-quests-loader.js` + `ffp-admin-dashboard.html` (global loader cache-bust v52→**v53**).
  Once deployed: New FFP quest → add missions → Publish → it appears in the member Passport Explore feed.
- Remaining Phase 4: partner task-builder + unlock/QR UI (ffp-provider-quest-create-loader.js) + partner verify queue (Check-ins).
**Phase 4b.1 (polish, NEEDS DEPLOY):** (1) **Passport nav** — un-hid the Quests bottom-nav button in `ffp-member-dashboard.html`
(was `display:none`); Quests is now reachable on the Passport. (2) Admin quest editor is now **full-screen** (`openSheet`,
not the small centered modal). (3) **Taxonomy-driven**: category from `FFP_TAX.categories` (fallback to the 6 standard);
Country + City are dependent dropdowns from `FFP_TAX.cities` (was free text). DEPLOY: `ffp-admin-quests-loader.js`
(+ admin dashboard already at loader cache-bust v53) and `ffp-member-dashboard.html` (nav).
**Phase 4b.2 (cleanup, NEEDS DEPLOY):** Member Quests panel stripped to the mockup — **removed "Create your own quest"
+ "Have a partner code? Unlock" buttons and the category row**; panel now = hero + tabs (Explore/My quests/Leaderboard)
+ FFP quest cards only. Subhead reworded. (Member-created create/invite code stays in quests-core but is no longer
surfaced; partner quests will unlock via QR/link later.) Admin editor: **full-screen** confirmed, hero image box now
**click-to-upload** (was easy to miss), and **mission→task** wording everywhere (admin + member: "Tasks", "Add task").
DEPLOY: `ffp-member-dashboard.html` + `assets/ffp-quests-core.js` (?v=**4**) + `ffp-admin-quests-loader.js` +
`ffp-admin-dashboard.html` (admin loader cache-bust v53→**v54**).
**Phase 4b.3 (bug fixes, NEEDS DEPLOY):** (1) **Quest save was failing** — `quests.eligibility` + `require_distinct_venues`
are NOT NULL and the admin insert omitted them; now sets `eligibility:'all'`, `require_distinct_venues:false` (verified a
clean insert). (2) **Hero upload hardened** — uploads the raw file (canvas compress now optional w/ fallback), surfaces the
real error string, click-to-upload box. (3) `taxCats()` pinned to the 6 DB-enforced categories (avoids category-check
violations). DEPLOY: `ffp-admin-quests-loader.js` + `ffp-admin-dashboard.html` (loader cache-bust v54→**v55**).

## LATEST 2026-06-16 — APPOINTMENTS / PT system (Phase 1 of 5: data model + config) — BACKEND LIVE
New facility-side PT/appointment system, kept **separate** from the group-class Sessions timetable. Phase 1 (DB only,
no deploy needed) is live in Supabase. Trainer profiles **reuse `provider_staff`** (no new table).
New tables + config RPCs:
- **`provider_services`** — facility services (one_on_one/group/assessment), `price_aed`, `duration_min`, `capacity`,
  **`tax_rate` (per-service %)**, status. RPCs: `provider_list_services` (includes nested `coaches`), `provider_save_service`, `provider_delete_service`.
- **`provider_service_coaches`** — coach↔service link carrying the **commission deal**: `commission_type` `percent`|`flat` +
  `commission_value`. RPCs: `provider_save_service_coach` (upsert on service+staff), `provider_delete_service_coach`.
- **`provider_trainer_slots`** — recurring weekly availability (staff, optional service, day_of_week 0-6, slot_time, duration).
  RPCs: `provider_list_trainer_slots`, `provider_save_trainer_slot`, `provider_delete_trainer_slot`.
- **`provider_packages`** — PT package catalog: N `sessions_count` of a service, `price_aed`, `tax_rate`, `validity_days`.
  RPCs: `provider_list_packages`, `provider_save_package`, `provider_delete_package`.
- All GRANTed to anon, authenticated. Live-tested create→link→list, then cleaned up.
**Phase 2 (DB only, LIVE)** — booking engine + client packages + status flow:
- **`provider_client_packages`** — a client's bought package w/ `sessions_remaining`. RPCs: `provider_sell_package`
  (assign to member, sets remaining/expiry from catalog), `provider_list_client_packages(provider[,member])`.
- **`provider_appointments`** — booked sessions. RPCs: `provider_book_appointment(provider, jsonb)` (package path
  decrements + payment_status='package'; single path cash/card/comp/unpaid; **coach overlap guard**; snapshots
  price/tax_rate/commission), `provider_reschedule_appointment`, `provider_cancel_appointment` (restores a package
  session), `provider_checkin_appointment`, `provider_trainer_complete_appointment` (→completed_pending),
  `provider_confirm_appointment` (→completed; **freezes tax_aed + commission_aed (coach payout) + payout_aed (facility
  net)** — coach only paid once facility-confirmed), `provider_appointment_no_show` (default consumes session, no
  commission), `provider_list_appointments(provider, from, to)`.
- Live-tested: 10-pack @1800 → per-session 180, tax 5% =9, commission 60% =108, **facility net 63**; sessions 10→9;
  overlap correctly blocked (coach_busy); cancel restored the session. Cleaned up. Phases left: 4 reports, 5 admin.
**Phase 3 (UI, NEEDS DEPLOY)** — new **Appointments** panel in Business nav (between Sessions & Staff).
- New file **`ffp-provider-appointments-loader.js` v1** (lazy via `_provLoaderSrc['appointments']?v=1`); `renderAppointments()`
  hook in showPanel. Trainer profiles reuse Staff. Tabs:
  - **Calendar** — week nav; appointment cards w/ status + payment chips; actions by state: Check in → Mark done
    (trainer) → **Confirm completed** (facility, shows frozen value/tax/coach/net); Reschedule, No-show, Cancel.
  - **Services & Coaches** — CRUD services (price/duration/tax%/capacity); link coaches w/ **% or flat** commission.
  - **Availability** — recurring weekly trainer slots (coach/service/day/time), grouped by coach.
  - **Packages** — package catalog CRUD + **Sell to client** + **client packages list with a sessions-remaining bar**.
  - Book modal: service→auto-duration + narrows coach list; client picker (provider_searchable_members);
    pay = package (loads that client's active packages) / cash / card / comp / unpaid.
**Phase 4 (reports, NEEDS DEPLOY)** — `provider_appointments_report(provider, from, to)` → summary (booked/completed/
pending/no-show/cancelled, gross/tax/commission/net on completed only, unpaid count+amount) + by_coach + by_service.
New **Reports** tab in the Appointments panel (range selector: this/last month, last 30, this year, all) — money KPIs,
session-count KPIs, and by-coach / by-service tables. (Same `ffp-provider-appointments-loader.js`.)
**Phase 5 (admin, NEEDS DEPLOY)** — new **Appointments** item in admin sidebar (after Payouts).
- RPCs: `admin_client_packages(q)` (every client package across facilities + sessions-remaining, searchable),
  `admin_appointments_overview(from,to)` (platform totals + by-provider), `admin_appointments_list(from,to,provider)`
  (every session detail row). New file **`ffp-admin-appointments-loader.js`** (`window.AdminAppts`, lazy via
  `_panelScript['panel-appointments']`, global `?v=52`). Tabs: **Sessions remaining** (client table w/ remaining bar) +
  **Sessions report** (KPIs + by-facility + full detail list).
- DEPLOY (all 4 + this doc): `ffp-provider-appointments-loader.js` (new), `ffp-provider-dashboard.html`,
  `ffp-admin-appointments-loader.js` (new), `ffp-admin-dashboard.html`.
**APPOINTMENTS SYSTEM COMPLETE (Phases 1–5).** Backend (Phases 1,2,4,5 RPCs) is live in Supabase; the 4 UI files need deploying.

## LATEST 2026-06-17 — Availability = WINDOWS + BLOCKS (per coach) — backend LIVE, UI needs deploy
Reworked trainer availability (per coach/trainer/teacher) from single slots to **hours windows + blocks**:
- `provider_trainer_slots` gained **start_time/end_time** (a day's available window; slot_time kept = start for compat).
  `provider_save_trainer_slot` now takes start_time/end_time (validates end>start); list returns them.
- NEW **`provider_trainer_blocks`** — unavailable periods per coach: `block_type` `recurring`(weekly, day_of_week) |
  `date`(one-off); `start_time`/`end_time` **NULL = whole day off**; reason. RPCs `provider_list/save/delete_trainer_block`.
- **`provider_book_appointment` now block-aware**: rejects (`coach_unavailable`) if the time falls in a block, compared
  in the **facility timezone** (`providers.timezone`, via `AT TIME ZONE`). Recurring matches weekday, date matches the date;
  whole-day blocks reject any time that day. Live-tested: day-off rejected, free day booked. (Coach overlap guard unchanged.)
- UI (`ffp-provider-appointments-loader.js` **v2**): Availability tab now per-coach cards showing **Available hours**
  (Day start–end) + **Blocked/unavailable** chips; modals: **Add hours** (coach/day/start/end/service/default len) and
  **Add block / day off** (coach, one-off date OR weekly, whole-day toggle or from/to, reason). Header has both buttons.
- DEPLOY: `ffp-provider-appointments-loader.js` (v2) + `ffp-provider-dashboard.html` (buttons + cache-bust v2).

## LATEST 2026-06-17 — Calendar shows OPEN SLOTS + coach filter (appointments) — UI deploy
`ffp-provider-appointments-loader.js` **v3** (cache-bust appointments?v=3):
- Calendar now renders **open availability slots** per day under each day's appointments. From each trainer's
  availability window (start–end, client-side in browser-local), it generates slots of the window's default session
  length, **hides ones already booked or inside a block**, and shows the rest as dashed "tap to book" chips
  (`apBookFromSlot` → opens the booking modal **prefilled** with coach + service + date/time + duration).
- `apBookModal(prefill)` refactored to accept `{start, staff_id, service_id, duration}` (prefilled selects;
  `_apServiceCoachOpts` narrows coach list to the service's linked coaches). Header "Book appointment" still opens blank.
- **Coach filter** on the calendar header: "All coaches" + each coach (`_apCalCoach`, `apCalCoachChange`) — filters both
  appointments and open slots to one trainer's schedule.
- Calendar iterates all 7 days of the week (shows a day if it has appts OR open slots). DEPLOY: loader v3 + dashboard (cache-bust v3).

## LATEST 2026-06-17 — Appointments calendar: Day/Week/Month time-grid — UI deploy
`ffp-provider-appointments-loader.js` **v4** (cache-bust appointments?v=4):
- Calendar rebuilt as a **time-grid** (time-of-day down Y, days across X). View toggle **Day / Week / Month**,
  default **Week** containing today; `_apAnchor` is the single source of truth, prev/next/Today shift by day/week/month.
  Today's column/cell highlighted. Coach filter retained (All coaches / one coach), filters appts + open slots.
- Week/Day: vertical hour grid; hour range auto-derived from that view's appts + availability (fallback 7:00–20:00,
  min 6h). Appointments render as positioned blocks colored by status, **lane-packed** so overlaps sit side-by-side;
  **open availability slots** render as dashed "＋time" blocks (tap → prefilled booking). Clicking an appointment block
  opens **`apApptDetail`** (info + status/payment chips + the actions: check-in / mark done / confirm / reschedule /
  no-show / cancel — each closes the modal then runs).
- Month: 6×7 grid, each day shows up to 3 appt chips + "+N more"; click a day → Day view (`apOpenDay`).
- Helpers: `_apViewDays`, `_apRangeBounds`, `_apRenderGrid`, `_apRenderMonth`, `_apLanePack`, `_apGridBlock`, `_apBlockColor`.
- DEPLOY: loader **v4** + `ffp-provider-dashboard.html` (cache-bust v4). No backend change.

## LATEST 2026-06-17 — Day view = coach columns + 30-min grid + click-to-book + one-off availability
- DB: `provider_trainer_slots` gained **`slot_date`** (one-off availability). `provider_save_trainer_slot` accepts
  either `day_of_week` (recurring weekly) OR `slot_date` (one-off; day_of_week derived); list returns slot_date. Live-tested.
- Loader **v5** (cache-bust appointments?v=5):
  - **Day view rebuilt**: a **column per coach** (name header), **time down Y in 30-min rows**, the coach's availability
    windows shown as **green shading** (no per-slot chips), appointments as blocks. **Click any open space in a coach's
    column** → booking modal prefilled (coach + date + snapped 30-min time + service/duration from the covering window).
    Appointment blocks use stopPropagation so they open detail instead of booking. Coach filter narrows to one column.
  - `_apSlotOnDate`/`_apAvailForDayCoach` make recurring + one-off availability apply correctly everywhere (Day grid,
    Week open-slots, hour-range). Week/Month unchanged otherwise.
  - **Availability modal**: new **Repeats** selector = "Every week" (Day picker) or "One-off date" (Date picker). Availability
    list labels one-offs as "<date> (one-off)" vs "Every <Day>".
- DEPLOY: loader **v5** + `ffp-provider-dashboard.html` (cache-bust v5). Backend (slot_date) already live.

## LATEST 2026-06-17 — Appointments calendar: FACILITY-timezone render + Day default + fixed coach columns
Bug: a Forge Fitness (Asia/Dubai) appointment booked at 10:00 didn't appear — it was being rendered in the **viewer's**
browser timezone, so it shifted hours/day off the visible view. Fix in `ffp-provider-appointments-loader.js` **v6**:
- New `_apFacilityTz()` / `_apLocalParts(iso)` (uses `Intl.DateTimeFormat` with the facility tz from `FFP_PROVIDER.timezone`)
  / `_apFacilityToday()`. **Every** calendar day-bucket + time position now derives from facility-local parts
  (Day grid, Week grid, Month, open-slot booked-check, appt cards, detail modal, reschedule prefill, "today" highlight).
  Verified: 06:00Z & 07:30Z → Dubai 10:00 & 11:30 on the 17th. (Booking still saves via FFPTime.toUTC, unchanged.)
- **Default view = Day** (was Week). `_apAnchor`/Today use facility today.
- **Fixed coach column width** in Day view: `repeat(N,150px)` (was minmax(120px,1fr)) — Excel-style fixed columns, horizontal scroll.
- DEPLOY: loader **v6** + `ffp-provider-dashboard.html` (cache-bust v6). No backend change.

## LATEST 2026-06-17 — Appointments: fix "booked appt not showing" + separate Date/Time + dark pickers (v7)
Root cause of the appt not appearing: `provider_list_appointments` was fetched over a window computed in the **viewer's**
tz, but appts are bucketed in **facility** tz — so a Dubai 10:00 (06:00Z) appt fell outside the queried window for
western viewers and was never loaded. (Traced: viewer UTC-7 fetched 1/2; with the fix all tz fetch 2/2.)
- **`_apRangeBounds` now pads ±1 day** so the facility-local day's appts are always within the fetched UTC window.
- Booking already re-fetches+re-renders on save (real-time show); with the wider window the new appt now appears immediately.
- **Book form: separate Date + Time fields** (`ap-bk-date` type=date, `ap-bk-time` type=time step 5min) instead of one
  datetime-local — quicker; combined to `date+'T'+time` → FFPTime.toUTC on save. Slot-click prefill splits start on 'T'.
- **Platform standard**: inject `input.input[type=date|time|datetime-local]{color-scheme:dark}` once (`_apInjectStyle`)
  so all appointment pickers match the dark theme (was missing → light native pickers).
- DEPLOY: loader **v7** + `ffp-provider-dashboard.html` (cache-bust v7). No backend change.
**MONEY MODEL (to freeze in Phase 2, per session, at facility confirmation):** base = per-session value (single = service
price; package = price_paid / sessions_total). `tax_aed = base * tax_rate/100`; commission = `percent` → `base*value/100`
else flat `value`; **facility net = base − tax − commission**. Revenue recognised **per completed session**.
**Completion flow:** scheduled → checked_in → trainer-marks-delivered (completed_pending) → **facility confirms** (completed,
unlocks payout). Phases left: 2 booking engine + client packages, 3 partner Appointments panel, 4 reports, 5 admin sessions-remaining.

## LATEST 2026-06-16 — Timetable tap → session roster + add member
Tapping a session on the Sessions → Timetable now opens **who's booked into that date**, not just coach/capacity.
- **`provider_session_roster(provider, occurrence)`** — booked members (status≠cancelled) with payment chip
  (Credit / Paid / Comp / Unpaid, derived from `bookings.notes` + `payment_status`) and membership chip
  (active / expired / none + credits_remaining, bridged via `provider_members`→`provider_member_plans` by email).
- **Add member:** `provider_searchable_members(provider, q)` lists platform members linked to the facility
  (via `provider_members` email bridge OR a prior booking) → `provider_session_add_member(provider, occurrence,
  member, pay_with)` with `pay_with` = `credit` (decrements a plan credit; errors if none) | `cash`/`paid`
  (marks paid, e.g. at the desk) | `comp` (free). Enforces capacity + blocks duplicate active bookings.
  `booking_source='partner'`, note records the method.
- **Remove:** `provider_session_remove_member(provider, booking)` cancels the booking and **refunds a credit**
  if it was credit-paid. Coach/capacity/cancel kept under "Session settings". UI: scheduling-loader **v12** (cache-bust v16).
- Live-tested add(comp)→roster→dup-guard(already_booked)→remove on a real occurrence; test rows cleaned up.

## SESSION STATE 2026-06-16 — Create-Listing excellence + Event ticketing + gallery/full-screen
**Partner "Create Listing" is now world-class across all four flows** (Sessions, Events, Trips, Experiences):
- **Consistent editor:** 2-step wizard (Experiences = full schedule), shared activity/country/city pickers,
  currency-aware pricing, **multi-image gallery** (cover badge, reorder, remove), and **full-screen modal**.
  Functional **map pin** (paste Google Maps link → `/api/geo/resolve` → `meeting_lat/lng`) on Events, Trips,
  Experiences. **Sessions have no own location** — they run at the facility venue (pin on Profile); by design.
- **Experiences (`classes`) = recurring schedule:** partner sets weekday(s) + daily times + capacity + end date
  (capped **+1 year**); `provider_generate_class_sessions(...)` makes the bookable `class_sessions`
  (status `scheduled`). Per-departure manage: cancel/reopen (`provider_set_class_session_status`), "close a day",
  delete. Idempotent. Replaces the old hand-typed dates.
- **Events = multi-tier ticketing:** `event_tickets` (name, price, own allocation, max/order, sales_end) +
  `event_tickets_public` (with `remaining`) + `book_event_order(member,event,[{ticket_id,qty}])` (free+paid mix in
  one order, enforces allocation/cap/window, one `bookings` row `item_type='event'`, breakdown in `notes`).
  Editor has a **Tickets** section; no-tier events keep the single `price_aed` + `rsvp_event`. Live-tested.
- **Shared `assets/ffp-gallery.js`** (`window.FFPGallery`); `gallery` jsonb added to `events`, `experiences`,
  `classes`, `session_templates` and threaded through `provider_save_listing` + `provider_save_session_template`.
- **Nav/UX:** Experiences moved to top of Engagement; create order = Experience, Session, Event, Trip, Challenge
  ("Tour"→"Experience", "Class"→"Session"). **Quests hidden** on member Passport + "Soon"/disabled on partner.
- **Booking contract** (`FFP-BOOKINGS.md`) updated: galleries (all types), event tickets, Experiences
  schedule/`status='cancelled'`.
- **Deploy queue (Grant commits):** `assets/ffp-gallery.js` (NEW), `ffp-provider-dashboard.html`,
  `ffp-provider-events-loader.js` v15, `ffp-provider-experiences-loader.js` v12,
  `ffp-provider-scheduling-loader.js` v14, `ffp-provider-classes-loader.js` v14, `ffp-member-dashboard.html`.
  All DB migrations already applied live.

## 📖 LISTING MODEL (locked 2026-06-12, Grant) — partner-facing tabs → tables. ONE definition for both apps.
Class and Tour are DIFFERENT things and are SEPARATE on the partner platform (Grant: lumping them confused
partners). The split:

Each partner tab is its OWN thing with its OWN table — NO crossover, NO subtype. (Grant, locked 2026-06-12.)

| Partner tab | What it is | Table(s) | Bookable via |
|---|---|---|---|
| **Tours** | one-off activity: jet ski hire, bungy jump, canyoning, guided tour/cruise | `classes` (+ `class_sessions` for the date) | `create_booking('class_session')`. NEW tours submit as **'pending' → admin approves** (admin "Tours" tab) → 'live'. No partner self-publish. |
| **Sessions** | recurring Classes: yoga, tennis lesson, group fitness (timetable + weekly + attendance) | `provider_sessions` | ⚠️ NOT yet wired in `create_booking` — booking team must wire it |
| **Trips** | retreats, camps, multi-day / sport-event trips | `experiences` | `create_booking('experience')` |
| **Events** | single-date community event members RSVP to | `events` | `create_booking('event')` |
| **Challenges** | provider challenge with results | `challenges` | n/a |

Create chooser: **Tour → Tours tab** (`openCreateClass()`→`openClassModal`), **Class → Sessions tab**
(`openCreateSession()`→`openSessionModal`), plus Trip, Event, Challenge. The booking platform reads each table and
displays it in its own section (Tours section ← `classes`; Sessions section ← `provider_sessions`).
❌ `classes.listing_subtype` and `provider_set_class_subtype` were REMOVED 2026-06-12 — they were a confusing
crossover. Tours = the whole `classes` table; Sessions = the whole `provider_sessions` table. Separate, period.

## 🟢 SESSION STATE — 2026-06-12 (LATEST-21 — Session photo)
The Create Session form now has a **photo** (shared `renderListingUploader` → new `provider_sessions.hero_image_url`;
`provider_save_session` persists it across all rows of a weekly series). Shows as a thumbnail on the session card.
Verified live (photo saved, rolled back). DEPLOY (Netlify): `ffp-provider-scheduling-loader.js` (v7),
`ffp-provider-dashboard.html` (v62, cache-bust scheduling?v=7). DB: provider_sessions.hero_image_url + RPC.

## 🟢 SESSION STATE — 2026-06-12 (LATEST-20 — FEATURED LISTINGS: apply → admin approve → homepage ($99/mo))
Partners can apply to feature a **Session / Tour / Event / Trip** on the FFP homepage; **$99/mo each**, billed
MANUALLY for now (Stripe wired later when Connect clears). DB: `feature_requests` table (item_type session|class|
experience|event, status pending/approved/declined, monthly_fee 99 USD, unique per item) + `provider_sessions.featured`
column; RPCs `provider_request_feature` / `provider_feature_requests` / `admin_list_feature_requests` /
`admin_decide_feature` (is_admin-gated; approve flips the listing's `featured` flag). All 4 listing tables now have
`featured`. **Partner UI:** shared helper in `ffp-provider-dashboard.html` (v61) — `featureBtn`/`applyFeature`/
`loadFeatureMap` → a "Feature — $99/mo" button on every Tour (classes-loader v8), Session (scheduling-loader v6),
Event + Trip card (dashboard renderEvents/renderExperiences); shows "Feature pending" then "★ Featured". **Admin:**
new `ffp-admin-featured-loader.js` + a "Featured" review queue in the admin dashboard (nav/panel/maps/global) →
Approve (sets featured=true → homepage shows it) / Decline. Verified live: apply=ok, request pending, admin queue
lists it (rolled back). **DEPLOY (Netlify):** `ffp-provider-classes-loader.js` (v8), `ffp-provider-scheduling-loader.js`
(v6), `ffp-provider-dashboard.html` (v61), `ffp-admin-featured-loader.js` (NEW — commit or 404), `ffp-admin-dashboard.html`.
DB applied. ⚠️ Not browser-tested — Grant to confirm: Feature button → admin Featured queue → Approve → ★ + homepage.

## 🟢 SESSION STATE — 2026-06-12 (LATEST-23 — SESSIONS REBUILD: partner UI built (class + weekly schedule + per-occurrence))
Built the partner UI on the LATEST-22 engine (`ffp-provider-scheduling-loader.js` v8, `ffp-provider-dashboard.html`
v63). **"New class"** opens the class-template form: class details + **Session description** + photo + Fitness level
(attendeeLevels) + **Weekly schedule rows** (Day + Time + Coach-from-staff, add/remove) → `provider_save_session_template`
(generates 12wk of occurrences). Sessions list = **one card per class** (shows its weekly schedule). **Timetable**
shows the weekly pattern (dedup by slot_id); tapping a slot opens **Manage session** for that single occurrence →
substitute coach / change capacity / **cancel that date** (provider_save_session + provider_cancel_session) without
touching the rest. Attendance + coach-bio preserved. `openCreateSession` (create chooser "Class") → `openTemplateModal`.
VERIFIED LIVE (rolled back): template→24 occurrences w/ per-slot coach; per-occurrence coach Lee→Mia + cap 8 + cancel,
other occurrences unaffected. DEPLOY (Netlify): `ffp-provider-scheduling-loader.js` (v8), `ffp-provider-dashboard.html`
(v63→v64, scheduling loader v8→v9). DB engine already applied (LATEST-22). ⚠️ Browser-test: New class → add weekly
times+coaches → Save → Timetable shows them → tap a slot → substitute/cancel.
FEATURE re-pointed (done): featuring a "session" now targets **`session_templates.featured`** (the class), not an
occurrence — `provider_request_feature`/`admin_decide_feature`/`admin_list_feature_requests` updated; Feature button
back on the class card; `provider_list_session_templates` returns `featured`. Verified live (apply=ok, admin queue
shows the class). The booking platform should read `session_templates.featured` for featured classes.

LATEST-24 (2026-06-12) — SESSIONS NOT SHOWING + TZ FIX. Bug: sessions created with the OLD create-session form
inserted straight into `provider_sessions` with `template_id=NULL`, so the rebuilt Sessions tab (lists
`session_templates`) showed "No classes yet". Found 10 orphans (Find Fit People "Beach Workout" ×8, Viking Surf
"Surf Sports" ×2). ALSO found a timezone bug: generation cast the naive slot string to timestamptz in the DB session
tz (UTC), so slot_time was stored/shown as UTC (06:00 Dubai displayed as 02:00). Fix (DB only, no loader change):
(1) `providers.timezone` column default 'Asia/Dubai'; (2) `provider_save_session_template` regen now builds occurrences
`((date||' '||slot_time)::timestamp AT TIME ZONE provider.timezone)` and uses `now() AT TIME ZONE tz` for the base
date — slot_time is now treated as FACILITY-LOCAL time; (3) backfill migration `backfill_orphan_sessions_to_templates`
created one template per (provider,title,activity), one weekly slot per distinct (local dow, local time, coach), and
linked all orphan occurrences. Verified: Find Fit People now lists Beach Workout with a Sat 06:00 (Grant Goes) slot;
0 orphans. NOTE for booking platform: facility timezone lives in `providers.timezone`; `provider_sessions.start_at`
is the absolute instant (render in local tz). Pending refinement: per-occurrence edit (`provider_save_session`) and a
provider-timezone picker in Profile (currently defaults Dubai).

LATEST-25 (2026-06-12) — FACILITY TIMEZONE, ALL LISTING TYPES. Grant: "Do the time zone picker... sorted out for
all things, trips, events, tours, sessions." Built: (1) `providers.timezone` (default Asia/Dubai, existing 4 rows
backfilled); exposed app-wide via `window.FFP_PROVIDER.timezone` (ffp-provider-auth.js, +select). (2) NEW shared
helper **assets/ffp-time.js** (`window.FFPTime`): `toUTC/toInput/toDateInput/toTimeInput/fmt/addMinutes/list` —
library-free, DST-correct via Intl offset (unit-tested: Dubai, NY/EST, London/BST all pass). Eager-loaded in
dashboard (?v=1). (3) Profile gets a **Timezone picker** — searchable IANA list; `wrapSelectAsPicker` enhanced with
a search box when options>12; loads/validates/saves `providers.timezone` via `provider_save_profile` (RPC +timezone),
updates FFP_PROVIDER on save. (4) Capture+prefill routed through FFPTime so partners enter wall-clock in THEIR
facility tz, stored UTC: Tours (classes-loader cm-sess-dt), Events (buildStartsAt + mapForUi split), Trips
(experiences start/end date = local midnight). Sessions already tz-aware server-side (LATEST-24). Versions: dashboard
v65, auth?v=6, profile?v=15, classes?v=9, events?v=11, experiences?v=8, ffp-time?v=1. Live-tested: provider_save_profile
persists timezone. NOTE booking platform: `providers.timezone` is the facility zone; all `*.starts_at/start_at` are
absolute UTC instants — render in facility tz. Minor follow-up: card-list DISPLAYS still use browser-local
toLocaleString (fine when partner=facility tz); could switch to FFPTime.fmt for multi-tz staff.

LATEST-26 (2026-06-13) — PROFESSIONAL SERVICES + service-based timetable. Grant: pros offer a SERVICE (PT session /
assessment / 12-week program), set a timetable (slots) per service, add clients or let clients book online; "these
are just the service type — user buys a service then books sessions via credits"; pricing "both, pro decides per
service". Scope locked: build PRO DASHBOARD side now + write client-booking contract (booking team builds client UI).
Built: (1) DB **pro_services** (name, service_type, duration_min, capacity, pricing_mode credit|pay_per_session,
price_aed, credits_granted, validity_days, location, status); `pro_slots.service_id` + `pro_client_packages.service_id`;
backfill of legacy orphan slots (no-op — 0 existed). RPCs: pro_list_services / pro_save_service / pro_delete_service;
pro_save_slot now takes service_id and INHERITS duration/capacity/slot_type from the service; pro_list_slots +
pro_week_schedule carry service_id/service_name. (2) NEW **ffp-professional-services-loader.js** (renderServices +
service modal with pricing-mode toggle showing credits-granted/validity only for credit mode; archive). (3) Dashboard:
new **Services** nav + #panel-services, _provLoaderSrc + renderPanel wired, PRO_BUILD 7→8. (4) Scheduling loader: slot
modal now requires a **Service** picker (gates with "add a service first" if none), autofills duration/capacity from
the service; occCard shows service name; copy updated (availability per service, client can book online). Live-tested
end-to-end (service→slot inherit→lists), rolled back; JS validated (services FULL clean; scheduling truncation-false-
positive confirmed intact). Client-facing booking = **FFP-PRO-BOOKING-CONTRACT.md** (buy-service credits / pay-per-
session via Stripe Connect Standard on the pro's account; pro_buy_service / pro_book_slot / pro_mark_booking_paid to be
built; flagged gaps: professionals has no stripe_account_id or timezone yet). Files to deploy: ffp-professional-services-
loader.js (NEW — must be committed), ffp-professional-scheduling-loader.js, ffp-professional-dashboard.html.

LATEST-27 (2026-06-13) — PRO booking decisions LOCKED + parity columns. Grant locked all 5 pro-booking decisions:
(1) bookings stored in shared `bookings` table, `item_type='pro_slot'` (constraint updated when wired); (2/3) ADDED
`professionals.stripe_account_id`, `stripe_connected_at`, `payments_status`, `timezone` (default Asia/Dubai) —
mirroring providers; FFP_PROVIDER on the pro dashboard now exposes `timezone` (line 775) so shared FFPTime works for
pros identically to facilities; (4) out-of-credits → client may pay-per-session OR re-buy the package (full price, not
a discount site) — same as facilities; (5) capacity>1 fills remaining spots online. Contract FFP-PRO-BOOKING-CONTRACT.md
§4/§6/§8 updated to reflect. Remaining Passport build (when booking team ready): pro_buy_service / pro_book_slot /
pro_mark_booking_paid (atomic credit+capacity) + add 'pro_slot' to bookings item_type constraint. Small follow-up: a
timezone picker in the pro Profile UI (pros default Asia/Dubai until then).

LATEST-28 (2026-06-13) — CORRECTED Services/Packages model + DEPLOYMENT GAP found. Grant clarified: "you buy a
session OR a package for a particular service — there is a difference." So a SERVICE = the offering + a per-session
price (single booking); a PACKAGE = a multi-session bundle FOR a service (credits). Refactored: dropped
pro_services.pricing_mode/credits_granted/validity_days (price_aed now = per-session price); added
pro_packages.service_id; pro_save_service/pro_list_services simplified; pro_save_package/pro_list_packages carry
service_id+service_name. UI: services modal now just per-session price (+ note pointing to Packages for bundles);
service card shows "AED x / session" + package_count; the Packages modal (client loader) gained a "For which service"
picker; package rows show the service. PRO_BUILD 8→9. Live-tested (service per-session 250 + 10-pack tied to service),
rolled back; JS clean. ⚠️ DEPLOYMENT GAP (Grant: "nothing different… is it live?"): the workspace folder is NOT the
git repo and NOT auto-deployed — ffppassport.com (Netlify, site e3da76a4-…) still serves the OLD professional
dashboard (verified via fetch). NOTHING in LATEST-26/27/28 is live until these files are deployed to the repo/Netlify.
PROTOCOL going forward: after any change, state clearly it is not live until deployed, and verify the live URL after
deploy. Files to deploy (complete pro-services set): ffp-professional-dashboard.html, ffp-professional-services-loader.js
(NEW), ffp-professional-scheduling-loader.js, ffp-professional-client-loader.js. DEPLOY VERIFIED LIVE (fetched
ffppassport.com — Services panel + new Scheduling/Packages copy present).

LATEST-29 (2026-06-13) — PARTNER PORTAL Sessions/Timetable rework (professionals parked). Grant: Timetable needs an
"Add session" (choose class, allocate day/time); attendance shown on the timetable thumb as 3/12 (attending/capacity);
check-in belongs in the Check-ins panel, not the Attendance tab. Built: (DB) provider_add_template_slot (adds one
weekly slot to a class template + generates 12 wks tz-aware) and provider_add_oneoff_session (single dated occurrence);
both live-tested (12 occ / one-off once), rolled back. (UI, scheduling loader v9→v10, cache-bust scheduling?v=10):
Timetable "Add session" button → openAddSession modal (pick class → weekly-recurring OR one-off date [FFPTime tz] +
optional coach); each timetable thumb shows a present/capacity badge from provider_attendance_counts; the
Scheduling→Attendance tab REMOVED from the dashboard (renderAttendance fns left dormant). Files: ffp-provider-
scheduling-loader.js, ffp-provider-dashboard.html (NOT yet deployed — must push + verify live).
PENDING (task 45) — Check-ins panel rework: Grant wants member scans QR OR staff enters member number to check into a
session. DECISION NEEDED: "member number" = platform members.access_code/passport_no (the FFP Passport identifier
their QR encodes), but provider_attendance.member_id currently references provider_members (facility-local list). So
check-in must map a platform member (by access_code) → find/create provider_members link → record attendance.
Confirm identity model before building.
RESOLVED + BUILT (LATEST-30).

LATEST-30 (2026-06-13) — CHECK-INS session check-in (code-first + fallback). Grant chose "both — code first, fallback
to list." Built: (DB) provider_checkin_session(provider, session, p{code|provider_member_id}) — code matches
members.access_code OR passport_no, auto-creates/links a provider_members row, upserts provider_attendance='present';
provider_today_sessions(provider) lists ~today's occurrences with present counts. Both live-tested (code path created
+ checked in real member "Vanshita…"; local path upsert), rolled back. (UI) Check-ins panel gains a "Check in to a
session" card (session selector + member-code input + Scan QR + My members picker + live roster). Loader
ffp-provider-checkins-loader.js v2→v3 (cache-bust checkins?v=3). NOTE: access_code is a long token (QR-friendly);
typed entry uses passport_no — both matched by the RPC. PARTNER deploy set (all DB already live): ffp-provider-
scheduling-loader.js (v10), ffp-provider-checkins-loader.js (v3), ffp-provider-dashboard.html. Not yet deployed —
push + verify live. DEPLOYED + verified live (session check-in card visible on ffppassport.com).
FOLLOW-UP (2026-06-13): removed the "Enter member claim code" (deal-redemption) card from the Check-ins panel —
Grant: redundant-looking + Deals is SOON; redemption to be designed cleanly when Deals launches. Kept the session
check-in card + "Recent check-ins" list. checkins-loader's verifyClaimCode override now a harmless no-op (no input).
Redeploy ffp-provider-dashboard.html.

LATEST-31 (2026-06-13) — POLISH + UX audit + FEATURED per-day + reviews finding. (a) UX AUDIT (FFP-UX-AUDIT-
Sessions.md): biggest gap = member booking journey not in the Passport (intentional — stays on findfitpeople.com per
Grant). (b) POLISH: NEW shared dark-select **assets/ffp-select.js** (FFPSelect.enhance) — Sessions dropdowns
(level/day/coach/add-session/occurrence) now match Profile's picker; timetable shows facility timezone + flags
one-off sessions; orphaned "Recent check-ins" hidden. scheduling loader v11, +ffp-select?v=1. (c) REVIEWS finding:
reviews are facility/venue-level (triggered by member venue self-check-in via activity_logs), NOT session/coach-level,
and NOT linked to the new session attendance. Grant: make reviews SESSION-level → task #51 (next, not yet built).
(d) FEATURED redesigned to **$99 USD/DAY** (Grant): partner requests specific days (range or multi-select), admin
confirms, partner pays upfront, admin sets live; live only on paid days. DB: feature_days table + feature_requests
(day_rate_usd, total_usd, statuses pending/approved/live/declined; dropped unique(item,type); status check widened to
include 'live'). RPCs: provider_request_feature_days, provider_feature_requests (+days), admin_list_feature_requests
(+days/total), admin_decide_feature (approve|live|decline), is_featured_today(kind,id,day). Partner UI: day-picker
modal (range+multi) w/ live $99×days total; featureBtn shows pending/approved/live. Admin queue (ffp-admin-featured-
loader v2, ?v=2): days+total+status, Approve→Set live lifecycle. PAYMENT deferred (manual for now — admin contacts
partner, partner pays, admin Set live). Homepage must read is_featured_today/feature_days (FFP-BOOKING-CONTRACT §6
updated). Live-tested per-day lifecycle (request→live→is_featured_today true on day, false off-day), rolled back; JS
clean. DEPLOY SET: assets/ffp-select.js (NEW), ffp-provider-scheduling-loader.js (v11), ffp-provider-dashboard.html
(v66), ffp-admin-featured-loader.js (v2), ffp-admin-dashboard.html (cache-bust). DB already live.

LATEST-32 (2026-06-13) — SESSION-LEVEL REVIEWS (build started). Grant's mechanism: member scans partner/pro QR →
options (what's on now) show → member picks the session they're doing → that becomes the reviewed session. FOUNDATION
built + live-tested (rolled back): (DB) activity_logs += session_id, coach; provider_reviews += session_id,
session_title, coach. RPCs: member_provider_options(provider) → today's session occurrences (now-3h..now+18h);
venue_checkin_session(me,provider,session,lat,lng) → session-linked activity_log (category 'Session') + mirrors into
provider_attendance (find/create provider_members link) so the timetable badge reflects member self-check-ins +
2h venue cooldown + geo-verify; provider_reviews_list now returns session_title + coach. Verified: options=1,
checkin ok w/ coach, review row shows "Beach Workout · Grant Goes". REMAINING PHASES (frontend, not yet built):
(1) Member dashboard — after QR scan show member_provider_options as choices → venue_checkin_session on pick;
(2) review modal session-aware (prompt names the session+coach, save provider_reviews with session_id/title/coach);
(3) partner Overview — show per-session/per-coach review context (provider_reviews_list already returns it);
(4) professional mirror (pro QR → pro services/slots) — later. No frontend files changed yet this step.

LATEST-33 (2026-06-13) — CONTEXTUAL REVIEWS foundation (Grant: "review depends on what they're doing" + comment AND
photo). Verified against LIVE code (member_pending_reviews/submit_provider_review read from DB; booking_checkin tags
activity_logs.category=initcap(item_type) → 'Experience'/'Event', venue_checkin_session sets category 'Session'+
session_id). Approved review dimensions (Overall headline + 3 specifics): SESSION = Coach·Value·Atmosphere;
EVENT = Organisation·Value·Atmosphere; TRIP/Experience = Guide/host·Value·Organisation&logistics; VENUE visit = keep
existing Experience·Service·Facilities. DB built+tested (rolled back): provider_reviews += review_kind, ratings jsonb,
photo_url (session_id/title/coach already added). member_pending_reviews now returns review_kind (session|trip|event|
venue, server-computed) + session_id/coach/category. submit_provider_review replaced (dropped old 8-arg) → accepts
p_kind, p_ratings jsonb, p_photo; pulls session_id/coach/title from the log; venue still uses the 4 category columns
so provider_rating averages don't break. provider_reviews_list returns review_kind/ratings/photo_url/session_title/
coach. Verified: pending kind='session', review stored "Beach Workout · Grant Goes" + sub-ratings + photo.
REMAINING (frontend, not built): (1) member review modal branches on review_kind → per-type star dimensions + comment
+ optional PHOTO upload (FFPUpload, quest-images), passes kind+ratings+photo to submit; (2) member scan sheet adds the
"On now — classes" session section (member_provider_options → venue_checkin_session) per the approved mockup;
(3) partner Overview shows per-type sub-ratings + coach + photo. DB only this step.

LATEST-34 (2026-06-13) — CONTEXTUAL REVIEWS frontend (all 3 phases built, world-class). (1) MEMBER review modal
(ffp-member-dashboard.html): rv-cats now rendered dynamically per review_kind via DIMS map (session=Coach/Value/
Atmosphere, event=Organisation/Value/Atmosphere, trip=Guide/Value/Logistics, venue=Experience/Service/Facilities);
header shows session+coach; added optional PHOTO (FFPUpload.pick → activity-photos bucket); submit branches — venue
passes the 4 columns, others pass p_kind + p_ratings jsonb + p_photo. (2) MEMBER scan sheet (ffp-member-checkin-
loader.js v8→v9, ?v=9): new "On now — classes" section (member_provider_options) between bookings and the Quest/Event/
Challenge row; tap → venue_checkin_session → session-linked log (+mirrors attendance) → resultMsg. (3) PARTNER Overview
(provider dashboard v67): each review row shows session·coach context, sub-rating chips (PR_RLBL labels), and the
review photo. JS validated (member checkin loader structure intact via Read; mount-truncation false positive at the
serve boundary, established pattern). NOT yet browser-tested/deployed. DEPLOY SET: ffp-member-dashboard.html,
ffp-member-checkin-loader.js (v9), ffp-provider-dashboard.html (v67). DB already live. Pending: pro mirror (pro QR →
services) later; browser test + deploy + verify live.

LATEST-35 (2026-06-13) — PROFESSIONAL REVIEW MIRROR (built + live-tested). Finding: pros had ZERO check-in/review
infra; not venues (no geo). Reused the ONE review engine. Grant locks: member scans pro QR OR pro checks member in;
member's QR = Passport access_code (created at purchase); review 90 min after check-in; pro dims = Overall·
Communication·Environment·Value. DB (live-tested, rolled back): activity_logs/provider_reviews += professional_id
(provider_id now nullable); member_pro_options(pro) → active services; pro_checkin_service(me,pro,service) (member
self-scan, no geo, 2h cooldown); pro_checkin_member(pro,service,code) (pro scans member Passport code → resolves
members.access_code/passport_no); member_pending_reviews surfaces pro logs after 90 min w/ kind='pro' + pro name/photo;
submit_provider_review accepts p_professional; pro_rating + pro_reviews_list. Verified: self check-in + pro check-in +
pending kind='pro' + rating avgs + review row. FRONTEND: member modal DIMS.pro + submit routes to p_professional;
member check-in loader v9→v10 (?v=10) handles ?pro= scan → services → pro_checkin_service (parsePro/openProContext/
proServiceCheckin + boot/pending-pro resume); professional dashboard — new **Check-in** nav+panel (service select +
member-code → pro_checkin_member) and Overview **"Your rating"** (pro_rating + pro_reviews_list w/ sub-ratings+photo).
JS: checkin loader clean (trunc false-positive); pro dashboard inline block balanced (mount-truncation blocks bash
node-check past the boundary — trusted Edit). DEPLOY SET: ffp-member-dashboard.html, ffp-member-checkin-loader.js (v10),
ffp-professional-dashboard.html. DB already live. NOTE: pro needs a QR to display (encodes ?pro=<id>) for the member-
scan path — "Show my QR" on the pro dashboard is a small follow-up. NEXT: Tours/Experiences/Events/Trips polish — NEEDS
naming decision first (Grant flagged Tours→"Experiences" but Trips already = experiences table; confirm exact labels).

LATEST-36 (2026-06-13) — RENAME Tours → "Experiences" (label-only; Trips unchanged). Grant: user sees "Experiences"
instead of "Tours"; keep "Trips". UNDERLYING UNCHANGED: classes table, panel ids (panel-classes/panel-tours),
item_type='class', nav id 'classes', RPC kinds, realtime channels, AdminTours var, console logs. Changed user-facing
labels only: provider dashboard (nav label, panel header, "New experience" button, help-strip, sessions psub
reference); admin dashboard (nav, h1, panel title map); ffp-provider-classes-loader.js (empty states, modal title
New/Edit experience, toasts, delete confirm, distance hint); ffp-admin-classes-loader.js (empty/approve/reject/preview
strings). Cache-busts: provider classes?v=10, admin classes?v=2. Both loaders validated (truncation false-positives
only). DEPLOY: ffp-provider-dashboard.html, ffp-admin-dashboard.html, ffp-provider-classes-loader.js (v10),
ffp-admin-classes-loader.js (v2). NEXT (still pending, Grant's "polish full flow"): apply shared FFPSelect dark picker
+ timezone labels + field-standard consistency to the Experiences / Events / Trips create-edit forms (like Sessions).

LATEST-37 (2026-06-13) — VERIFY-LIVE caught 2 naming clashes from the rename; fixed. (a) Live fetch confirmed the
partner portal shows "Experiences" + "New experience" ✓. (b) BUT: admin already labelled the `experiences` TABLE
"Experiences" (its Trips equivalent — has "FFP-Organized Trip"), so the admin Tours→Experiences rename created a
DUPLICATE "Experiences" in admin. FIX: aligned admin vocabulary to the partner portal — `experiences` table panel
(panel-experiences) renamed "Experiences"→"Trips" (nav flight_takeoff, h1, title map, search placeholder); the
`classes` panel (panel-tours) stays "Experiences". Net per the partner portal: Experiences = classes, Trips =
experiences table, everywhere. (c) Also fixed the partner Trips panel help-strip that read "New experiences are
reviewed…" → "New trips…". Redeploy: ffp-provider-dashboard.html, ffp-admin-dashboard.html.

LATEST-38 (2026-06-13) — Admin rename VERIFIED LIVE (screenshot: sidebar shows Trips + Experiences separately;
Experiences panel lists the rafting experience = classes table). Earlier stale fetches were CDN cache. Deploy note:
ffppassport.com = Netlify site e3da76a4 building from github.com/grant2223/ffp-passport main (Grant commits the files
shared via cards). Big files (admin dashboard 171KB) should be committed via GitHub "Upload files" not paste (a paste
once shipped an OLD copy → Netlify "all files already uploaded"). ADMIN v47→v48: sidebar section headers (Mission
Control/Approvals/Marketplace/Platform) enlarged 9px→11px + brighter (var(--text)) + COLLAPSIBLE — click a header to
toggle its links (JS walks siblings to the next header; chevron rotates; collapse state saved per-section in
localStorage). CSS .sidebar-section-label + .sec-caret + .sidebar-link.sec-hidden; inline setup() IIFE after the nav.
footer build v47→v48. Redeploy ffp-admin-dashboard.html (use Upload files for the 171KB file).

LATEST-39 (2026-06-13) — Form-consistency polish + Bookings update. POLISH: Experiences/Events/Trips create-edit
modals now enhance their native `.select`s to the shared dark picker (FFPSelect.enhance on #modal / .modal after open) —
matches Sessions/Profile; country/city stay FFPPicker buttons (untouched). Trips modal title corrected "experience"→
"trip". Cache-busts: classes?v=11, events?v=12, experiences?v=9. JS validated (truncation false-positives only).
BOOKINGS UPDATE: wrote FFP-BOOKINGS-UPDATE.md for the findfitpeople team — consolidated change list + action checklist:
(1) FEATURED now per-day → read is_featured_today/feature_days not *.featured (breaking); (2) labels Tours→Experiences
(classes), experiences table→Trips (item_type unchanged); (3) reviews contextual + pro reviews (review_kind/ratings/
photo_url/professional_id; pro_rating/pro_reviews_list; 60min venue / 90min pro trigger); (4) check-in surfaces
(member_provider_options/venue_checkin_session, member_pro_options/pro_checkin_service, pro_checkin_member); (5) pros
are a new bookable surface; (6) providers/professionals.timezone; (7) Stripe Connect Standard unchanged. Companion to
the two contracts. DEPLOY (form polish): ffp-provider-classes-loader.js (v11), ffp-provider-events-loader.js (v12),
ffp-provider-experiences-loader.js (v9), ffp-provider-dashboard.html.

LATEST-40 (2026-06-13) — Pro QR (completes the member-scan loop) + timezone hints. (a) PRO "Your check-in QR" on the
professional Check-in page: renderProQR() loads qrcodejs (CDN) and renders a QR encoding
https://ffppassport.com/ffp-member-dashboard.html?pro=<professional_id> — members scan it → openProContext (member-
checkin loader v10) → services → pro_checkin_service → 90-min review. This is what makes the member-scan pro path
usable end-to-end. (b) Timezone hints: Experiences (classes) date section + Events "When" section now show "Times
shown in <facility tz>" (FFPTime.tz()); Trips are date-only so skipped. DEPLOY: ffp-professional-dashboard.html,
ffp-provider-classes-loader.js (v11), ffp-provider-dashboard.html (events hint), ffp-provider-events-loader.js (v12),
ffp-provider-experiences-loader.js (v9). Reminder: deploy big files via GitHub Upload-files at repo root, exact name.

LATEST-41 (2026-06-13) — Pro QR "Download QR (PNG)" (parity with facility venue QR): proDownloadQR() draws the
#pro-qr-box canvas/img onto a padded white canvas → downloads FFP-Pro-QR.png. Pro QR feature now complete (display +
download). Only ffp-professional-dashboard.html changed (top-level reload). NEXT MAJOR (recommended, needs go-ahead as
it's the booking-team interface): build our committed booking RPCs per the locked contracts — facility book_session
(credit auto|credit|cash) + grant_member_plan + mark_booking_paid; pro pro_buy_service + pro_book_slot +
pro_mark_booking_paid + add 'pro_slot' to bookings item_type constraint.

LATEST-42 (2026-06-13) — BOOKING RPCs BUILT + live-tested (our side of the contracts; DB-only, booking team calls
them). FACILITY: book_session(member, occurrence(provider_sessions), qty, pay_with auto|credit|cash) — credit spends
provider_member_plans.credits_remaining (1 credit=1 seat, expiry-aware, FOR UPDATE), auto-no-credits returns
needs_payment(options pay|buy_credits), cash → unpaid booking; grant_member_plan(member,provider,plan,start);
mark_booking_paid(booking,intent,charge). PRO: grant_pro_package(member,professional,package,start) →
pro_client_packages; pro_book_slot(member,slot,occurrence_date,pay_with) — occurrence datetime in pro tz, capacity =
standing pro_slot_clients + booked-that-date, credit from pro_client_packages(service); reuse mark_booking_paid.
KEY: credits are keyed to facility-local (provider_members) / pro-local (pro_clients) members; RPCs BRIDGE the
platform members.id → local by EMAIL (find/create), same as check-in; bookings.member_id = platform member.
bookings item_type: 'provider_session' (facility), 'professional_session' (pro — already allowed; provider_id null,
pro via item_id→pro_slots). Caught live: bookings_payment_status_check rejects 'credit' → credit bookings use
payment_status='paid' (status 'confirmed'); item_type/status/payment checks all respected. Both paths verified
end-to-end, rolled back. Contracts updated with final signatures (FFP-BOOKING-CONTRACT §9, FFP-PRO-BOOKING-CONTRACT).
No frontend (booking UI is findfitpeople's). NOTE: facility "assign plan" UI assigns to provider_members (local) — same
provider_member_plans the booking RPCs draw from, so credits are unified across both paths.

LATEST-65 (2026-06-14) — FROZEN HEADER audit across ALL dashboards. Findings: MEMBER = topbar position:fixed (frozen
✓); ADMIN = CSS grid, topbar is its own grid row (frozen ✓); PROFESSIONAL = structural flex (frozen ✓, done earlier);
PROVIDER = was sticky-inside-scroller (same fragile pattern that failed on the pro PWA) → FIXED structurally:
.main is now a flex column (overflow:hidden); .topbar + .ffp-save-banner are flex:0 0 auto (the frozen header — save
banner no longer position:sticky top:62px, just a flex sibling that shows/hides); existing .panel-wrap is now the
scroll area (flex:1; min-height:0; overflow-y:auto; width:100% + its max-width:1280/margin auto keeps content centred).
Scrollbar styling moved .main→.panel-wrap. CSS-only, no JS. DEPLOY: ffp-provider-dashboard.html.

LATEST-64 (2026-06-14) — PRO VIDEOS public read (booking-team blocker). pro_videos had RLS on, 0 policies → anon
read blocked. Added: RLS SELECT policy pro_videos_public_read (anon,authenticated) gated to professionals
is_published+verification_status='approved'; AND view pro_videos_public (id,professional_id,url,kind,title,sort_order,
created_at) granted to anon,authenticated. Verified live: policy present, view returns rows (1 approved pro video
visible). Live DB change, no deploy. FFP-BOOKINGS.md updated.

LATEST-63 (2026-06-14) — SLOT CARDS: name headline + availability. occCard (Schedule) + _ovSessRow (Overview, shared
by today + day lists): headline is now "TIME · <booked person's name>" (names no longer in the grey sub); when the
spot is open the headline falls back to the session type. Availability badge: cap=1 open → "Available"; group open →
"N available"; none → "Full" (green when available — the unbooked "notification" on both Schedule and Overview).
Validated 4 cases. Date header (.sched-day-h) bumped 11px→14px to match the card time. PRO_BUILD→20. DEPLOY:
ffp-professional-dashboard.html, ffp-professional-scheduling-loader.js.

LATEST-62 (2026-06-14) — SCHEDULING tweaks. (1) NO OVERLAP: saveSlot now rejects a slot whose time range overlaps
an existing slot on the SAME weekday (client-side check vs _proSlotsCache; minute math; ignores self when editing;
adjacent times allowed). Validated 5 cases. (NB: client-side only — DB doesn't enforce; add a pro_save_slot guard if
ever needed.) (2) Date nav (arrows + range) is now its own FULL-WIDTH row (range flex:1 centered). (3) Day/Week/Month
seg is FULL-WIDTH (seg display:flex width:100% + seg-btn flex:1). (4) FIELD FONT PARITY: on mobile the FFPSelect
picker buttons + .phone-cc stayed 13px while native inputs were 16px → added .ffp-sel-btn,.phone-cc to the mobile 16px
rule so all New-slot fields match. (5) Capacity label hint → "spots available". PRO_BUILD→19. DEPLOY:
ffp-professional-dashboard.html, ffp-professional-scheduling-loader.js.

LATEST-61 (2026-06-14) — PRO profile HEADER IMAGE upload. Added a wide header/cover uploader to the profile Photo
section (pickProCover → FFPUpload.pick bucket quest-images, aspect 16/9, outW1280/outH720 → professional_save_profile
{cover_photo_url}). DB already had cover_photo_url + the RPC accepts it + professionals_public already exposes it, so
the storefront banner populates with no DB change. HTML-only (renderProfileForm markup + pickProCover) — no PRO_BUILD
bump needed. DEPLOY: ffp-professional-dashboard.html.

LATEST-60 (2026-06-14) — PRO header (real fix) + Service/Session merge + slot tweaks. (a) HEADER: the sticky-inside-
scroller kept failing on the phone PWA (known edge case). DEFINITIVE FIX: restructured .main into a flex COLUMN
(overflow:hidden) with the topbar as a flex:0 0 auto sibling (no longer sticky) + a new .main-scroll child
(flex:1;overflow-y:auto) wrapping all panels. Header physically cannot scroll now. showPanel scroll-reset now targets
.main-scroll. Horizontal padding moved to topbar + .main-scroll. (b) TIME FIELD oversized on iOS → added
.input[type=time]/[type=date]{-webkit-appearance:none}. (c) SERVICE vs SESSION TYPE: merged — removed the Session
type field from the slot form; a slot now just picks a SERVICE (full-width) and inherits its type (pro_save_slot
already does this). The Service IS the typed offering: services-loader SERVICE_TYPES now = FFP_TAX.sessionTypes (One on
One/Group/Assessment). (d) Add-client-by-name field moved ABOVE the client list in the slot modal. OPEN/offered (not
built): a map pin-drop for slot Location (currently free text) — same /api/geo/resolve pattern as the provider
profile if wanted. PRO_BUILD→18. DEPLOY: ffp-professional-dashboard.html, ffp-professional-scheduling-loader.js,
ffp-professional-services-loader.js.

LATEST-59 (2026-06-14) — NEW SLOT form cleanup. Removed the Title field (slot title defaults to service name/null in
pro_save_slot — saveSlot still sends title:'' harmlessly). Reordered the form-grid: Session type + Service (row 1),
Day + Time (row 2), Duration + Capacity (row 3, Capacity hint "spots clients can book"), Location now full-width (row
4). Fixes the misaligned time field (now a clean half-cell beside Day). MODEL (confirmed to Grant): a slot = a
recurring weekly working-time block (day+time+duration+type, optional service); capacity = total spots; trainer
assigns clients in "Who's in this slot" AND/OR leaves spots open → open spots (capacity − assigned) are bookable
online via findfitpeople; timetable shows N open / Full. PRO_BUILD→17. DEPLOY: ffp-professional-dashboard.html,
ffp-professional-scheduling-loader.js.

LATEST-58 (2026-06-14) — PRO dashboard UI POLISH round 2. (a) PROFILE: removed the section boxes (platform standard
= no boxes) — sections now separated by spacing + purple title only (#panel-profile .form-section margin only). Save
button is full-width. (b) More bottom room on every page: .main padding-bottom 120px desktop / 160px mobile so the
last fields/Save clear the bottom nav comfortably. (c) SCHEDULING: "Add session" → "Add slot" (the spot is what opens
for online booking — a slot can have someone assigned or be open) and the modal is now "New slot/Edit slot"; the
button moved ABOVE the date nav and is full-width; "Today" button removed. (d) NAV reorder to Overview · Schedule ·
Check-in · Clients · Payments (PRO_NAV; Schedule label; Services moved to PRO_NAV_EXTRA/avatar); PRO_BOTTOM matches
(overview/scheduling/checkin-center/clients/payments). PRO_BUILD→16. DEPLOY: ffp-professional-dashboard.html,
ffp-professional-scheduling-loader.js.

LATEST-57 (2026-06-14) — PRO dashboard UI POLISH. (a) HEADER frozen: removed .main top-padding (the gap that let
content show above the sticky topbar) — topbar now padding:16px 0 12px + border-bottom; truly sticky. (b) SAVE clears
nav: .main bottom-padding 80px desktop / 120px mobile (was hidden under bottom-nav + raised FAB). (c) PROFILE: email
+ phone now full-width (were cramped half-cells); Languages is now a DROPDOWN sourced from FFP_TAX.languages (25
langs; chosen → removable chips) replacing the chip-wall; "Add profession" is now a visible btn-sec (was a faint
chip); each profile section is a card (#panel-profile .form-section bg+border+radius) with a purple title — clear
separation. (d) SCHEDULING: Day | Week | Month toggle (added Day; day nav steps ±1 day); views always render even
when empty (removed the week full-screen empty-state replacement; day/month show empty states inline); "Add session"
is a full-width primary button below the toolbar; "Today" restyled to btn-sec (was a stray ghost pill). FFP_TAX gained
T.languages. Validated logic in isolation. PRO_BUILD→15, ffp-taxonomy.js→v11. DEPLOY: ffp-professional-dashboard.html,
ffp-professional-scheduling-loader.js, assets/ffp-taxonomy.js.

LATEST-56 (2026-06-14) — PRO dashboard overhaul WAVE 2 (audit fixes: phone, taxonomy, modals). (a) PHONE: added a
shared country-code picker to the pro dashboard (_phoneOptionsHtml/_phoneField/_phoneSet/_phoneGet, generic by id
prefix; .phone-input/.phone-cc/.phone-num CSS; codes from FFP_TAX.phoneCodes) — replaces the plain tel inputs on the
Profile (pf-phone) and the Client modal (mm-phone, via window._phoneField/_phoneSet/_phoneGet). Validated set/get
(AU +61, empty→+971). (b) TAXONOMY: the loaders now source their pick-lists from FFP_TAX with a local fallback —
services SERVICE_TYPES→FFP_TAX.serviceTypes, client CLIENT_STATUS/PKG_TYPES/COMMS_CHANNELS→FFP_TAX.*, billing
PAY_METHODS→FFP_TAX.payMethods (scheduling SLOT_TYPES already on FFP_TAX.sessionTypes in Wave 1). Client modal status
select now built from CLIENT_STATUS. Dead PRO_TYPE_OPTIONS removed. (c) MODALS: included assets/ffp-select.js?v=1;
openModalShell now runs FFPSelect.enhance on the modal body (all modal selects → dark searchable picker; FFPSelect
dispatches change so service/onchange handlers keep working); profile Currency select (54 options) enhanced too.
Validated client-modal block in isolation. PRO_BUILD→14. DEPLOY: ffp-professional-dashboard.html,
ffp-professional-services-loader.js, ffp-professional-client-loader.js, ffp-professional-billing-loader.js
(assets/ffp-select.js already live; assets/ffp-taxonomy.js v10 from Wave 1). Pro forms now meet the platform standard.

LATEST-55 (2026-06-14) — PRO dashboard overhaul WAVE 1 (nav + scheduling + session types). (a) NAV: removed
Scheduling + Check-in from the avatar menu (avatar = profile/services/packages/messages/signout); Check-in is now the
RAISED CENTER icon of the mobile bottom nav (PRO_BOTTOM = overview/clients/checkin/scheduling/payments; .bn-center
FAB style). (b) SCHEDULING: scrapped the weird 10-day arrow strip; rebuilt as Week | Month segmented toggle. Week =
7-day list (today highlighted) with open/full badges; Month = calendar grid (counts per day, tap a day → that week).
prev/next shifts week or month; Today resets. Per-week fetch cached (_proWeekCache), cleared on mutations
(_schedRefresh). (c) SESSION TYPES: FFP_TAX.sessionTypes = {one_to_one:'One on One', group:'Group',
assessment:'Assessment'} (+ serviceTypes/clientStatus/packageTypes/commsChannels/payMethods added to FFP_TAX for
Wave 2). Add-session modal now has a Session type select (saved as slot_type — pro_save_slot already accepts it);
Service is now OPTIONAL (removed the "add a service first" gate); modal retitled "session". Validated week/month +
session-type logic in isolation. PRO_BUILD→13, ffp-taxonomy.js→v10 (pro dashboard). DEPLOY: ffp-professional-
dashboard.html, ffp-professional-scheduling-loader.js, assets/ffp-taxonomy.js. WAVE 2 TODO (audit fixes): phone
country-code picker (profile + client modal), source the 6 pick-lists from FFP_TAX in the loaders + drop dead
PRO_TYPE_OPTIONS, FFPSelect.enhance on pro modals (esp. currency).

LATEST-54 (2026-06-14) — PRO dashboard: avatar menu + SCHEDULING REDESIGN. (1) Avatar dropdown now includes
Scheduling + Services + Check-in (were unreachable on mobile — bottom nav only has 4). (2) ffp-professional-
scheduling-loader.js rebuilt from a Mon–Sun week grid to a DATE-SCROLL timetable: horizontal date strip (10 days,
prev/next arrows shift ±7, dots mark days with sessions, Today/Yesterday/Tomorrow labels), tap a date → that day's
sessions; each session card shows an availability badge ("N open" green / "Full") = capacity − booked, tap → existing
openOccActions (reschedule/shift/cancel/edit). "Add session" (openSlotModal) still creates a regular weekly standing
slot. Week occurrences fetched via pro_week_schedule per selected week + cached (_proWeekCache); cache cleared on any
mutation (_schedRefresh). Panel markup: #pro-datestrip + #pro-sched-rangelbl replace the week-nav; CSS injected by the
loader. Validated logic in isolation (open-badge math, day filter, relative labels). PRO_BUILD→12. DEPLOY:
ffp-professional-dashboard.html, ffp-professional-scheduling-loader.js.

LATEST-53 (2026-06-14) — MULTI-CURRENCY: bookings.currency stamping + provider listing displays. DB: book_session +
pro_book_slot now stamp bookings.currency = the provider/professional currency (was hardcoded 'AED' in all 4 inserts)
— so refund (toMinorUnits(refunded_aed,bk.currency)) + the paid-confirmation message show the right currency. NEW
helpers in ffp-currency.js (v=2): FFPCurrency.providerCode() + formatProvider(amount) (uses FFP_PROVIDER.currency).
Swapped hardcoded "AED" in the provider listing loaders to the partner currency: classes-loader (card per-person +
"Price per person (CCY)"), members-loader (plan meta + "Price (CCY)"), scheduling-loader (session meta + "(CCY, 0 =
free)" hint), experiences-loader (Trips currency dropdown expanded from 8 → full 54-list, defaulting to partner
currency). Validated helper block (formatProvider AUD/AED). Cache-busts bumped: ffp-currency.js v2 (both dashboards),
classes v12, scheduling v12, members v2, experiences v10. DEPLOY: assets/ffp-currency.js, ffp-provider-dashboard.html,
ffp-professional-dashboard.html, ffp-provider-classes-loader.js, ffp-provider-members-loader.js,
ffp-provider-scheduling-loader.js, ffp-provider-experiences-loader.js. STILL TODO: member/booking-side price display
+ admin earnings/payouts display; AUD end-to-end test once a partner connects Stripe.

LATEST-52 (2026-06-14) — MULTI-CURRENCY phase 2: PRO portal UI wired. professional_for_member returns to_jsonb(pr)
so _pro.currency comes through automatically (no RPC change). ffp-professional-dashboard.html: includes
ffp-currency.js?v=1; FFP_PROVIDER.currency=(_pro.currency||'AED'); Currency <select> in the profile form (native
grouped optgroups via FFPCurrency.optionsHtml); saveProfile payload sends currency; the overview aed() formatter now
uses FFP_PROVIDER.currency; PRO_BUILD→11. Loaders made currency-aware (FFP_PROVIDER.currency + FFPCurrency.format):
ffp-professional-billing-loader.js (_money + "Amount (CCY)"), ffp-professional-client-loader.js (_money2 + package
"Price (CCY)"), ffp-professional-services-loader.js (service price display + "Price per session (CCY)"). Validated:
edited blocks node --check OK + runtime confirmed (AUD 150 / AED 75); full-file checks are the known mount-truncation
false EOF. DEPLOY: ffp-professional-dashboard.html, ffp-professional-billing-loader.js, ffp-professional-client-loader.js,
ffp-professional-services-loader.js. STILL TODO: provider listing LOADER price displays (events/experiences/classes/
sessions/plans cards), bookings.currency stamping in book_session/pro_book_slot (so refund/confirm show the right ccy),
member/booking-side + admin display, AUD end-to-end test.

LATEST-51 (2026-06-14) — MULTI-CURRENCY phase 2: PROVIDER portal UI wired. ffp-provider-auth.js (v7) exposes
FFP_PROVIDER.currency (providers.currency). ffp-provider-profile-loader.js (v16): Currency selector (54-currency
grouped picker via FFPCurrency.optionsHtml, searchable) next to the Timezone picker — loads/saves providers.currency
through provider_save_profile; updates FFP_PROVIDER.currency on save. ffp-provider-dashboard.html: includes
ffp-currency.js?v=1, new #pf-currency field markup, loadProfile populates+sets it, _provCcy()/_provMoney() helpers,
and the listing price LABELS now use the partner currency (event "Price (CCY)", trip "Price per person (CCY)", trip
card "CCY n" per-person). ffp-provider-billing-loader.js (v2): _money() now formats in FFP_PROVIDER.currency; payment
amount label "Amount (CCY)". Cache-busts bumped. Validated (billing-loader full node --check OK; auth + profile-loader
edited blocks node --check OK in isolation — full-file checks are the known mount-truncation false EOF). DEPLOY:
ffp-provider-auth.js, ffp-provider-profile-loader.js, ffp-provider-billing-loader.js, ffp-provider-dashboard.html.
STILL TODO: PRO portal (professional dashboard profile selector + aed() formatter + billing/client loaders), provider
listing LOADERS' price displays (events/experiences/classes/sessions/plans), bookings.currency stamping in
book_session/pro_book_slot, member/admin display, AUD end-to-end test.

LATEST-50 (2026-06-14) — MULTI-CURRENCY: comprehensive currency list + save RPCs. NEW assets/ffp-currency.js
(window.FFPCurrency: 54 currencies across ME/Europe/Americas/Asia-Pacific/Africa, each {code,name,symbol,region,
decimals}; .format(amount,code) → "AUD 150", .optionsHtml(sel) grouped <optgroup>s, .byCode/.symbol). Validated
(54 entries; format + CHF/EUR/NOK present). Backend toMinorUnits extended to 3-decimal (KWD/BHD/OMR/JOD/TND →
×1000 rounded to mult of 10) so Gulf currencies are safe too (still v98). provider_save_profile +
professional_save_profile now accept 'currency' (mirrors timezone handling). Live-tested pro currency round-trip
(AUD set + restored to AED). DEPLOY: assets/ffp-currency.js (NEW), backend index.js v98. STILL TODO (UI wiring):
include ffp-currency.js in the dashboards; currency selector in provider/pro profile (FFP_PROVIDER.currency via
ffp-provider-auth.js + profile loaders); swap the hardcoded "AED" formatters in listing forms + billing loaders to
FFPCurrency.format(amount, partnerCurrency); stamp bookings.currency in book_session/pro_book_slot.

LATEST-49 (2026-06-14) — MULTI-CURRENCY minor-units (backend v98). Target markets = sports/fitness/wellness/
adventure tourist hotspots: AED, AUD, NZD, USD, GBP, EUR, THB, IDR, SGD, MYR, VND, PHP, LKR, INR, JPY, CHF, CAD,
ZAR, MXN, CRC, SAR, QAR, MAD, BRL. Added toMinorUnits(amount,currency): zero-decimal currencies (JPY/VND/KRW/… full
Stripe set) charge ×1, all others ×100 — replaced the hardcoded ×100 in all 4 charge endpoints + the refund. Refund
response now returns native amount + currency. Verified behaviourally (AED→×100, JPY/VND→×1). 3-decimal currencies
(BHD/KWD/OMR) deliberately EXCLUDED from the supported set. DEPLOY: backend index.js v98. STILL TODO: frontend
currency selector + label sweep (phase 2), bookings.currency stamping in book_session/pro_book_slot.

LATEST-48 (2026-06-14) — MULTI-CURRENCY build, PHASE 0 + 1 (foundation + backend). Model = per-partner NATIVE
currency (Connect Standard settles in the partner's own currency; no FX in the core flow). Kept the *_aed columns
(now hold the partner's native amount) + added a currency field. DONE: (0) providers.currency + professionals.currency
(text not null default 'AED'); backfilled (4 providers + 1 pro = AED); professionals_public exposes currency;
provider_plans_public + pro_packages_public now also expose the partner currency (joined from providers/professionals)
so the booking site can render the right symbol; member_my_bookings already returns bookings.currency. (1) backend
v97: connectedCheckout charges in String(o.currency||'AED').toLowerCase() instead of hardcoded 'aed'; the 4
/api/pay/* charge endpoints read providers.currency/professionals.currency and pass it. Validated connectedCheckout
in isolation (node --check OK). DEPLOY: backend index.js v97. STILL TODO (phases 2-5, frontend): currency selector in
provider/pro profile + swap hardcoded "AED" labels across listing forms + billing loaders (money helper takes a
currency code); member/admin price displays use listing currency; book_session/pro_book_slot should stamp
bookings.currency = partner currency; AUD end-to-end test once a connected AUD account exists.

LATEST-47 (2026-06-14) — PRO PUBLIC PROFILE fields for booking. Added to professionals_public:
verification_status + languages (columns already existed). Then NEW columns certifications text[] + years_experience
int on professionals; professional_save_profile extended to persist them (certifications mirrors languages array;
years_experience nullable int); both surfaced in professionals_public. Pro dashboard profile form (ffp-professional-
dashboard.html) gained a "Years of experience" number field + "Certifications (one per line)" textarea, saved via the
existing saveProfile payload. LIVE-TESTED the save RPC round-trip on a real pro (certs array + years stored), then
restored to null. saveProfile block node --check OK. Verification stays ADMIN-GATED (view filters
verification_status='approved'; publish→pending→admin approves) — same as partners. OPEN (not changed): editing certs
on an already-APPROVED pro does NOT currently re-trigger pending review (RPC only re-triggers from unlisted/rejected).
Migrations: professionals_public_add_verification_languages, professionals_add_certifications_years_experience. DB is
live (no deploy); DEPLOY only ffp-professional-dashboard.html (form fields).

LATEST-46 (2026-06-14) — BOOKING GAPS #3 + #5 built in BACKEND (index.js v96). #3 REFUND: POST /api/pay/refund
{booking_id} — issues Stripe refund on the SAME connected account as the charge (refund payment_intent/charge with
{stripeAccount}), amount = cancel_booking's computed refunded_aed (fils), idempotencyKey='refund_'+id. Resolves
acct: facility via providers.stripe_account_id, pro via item_id->pro_slots.professional_id->professionals. Guards:
booking must be cancelled + payment_status in (refunded,partially_refunded) + has a PI/charge. Flow = booking site
calls cancel_booking (member-gated) THEN /api/pay/refund. #5 PAID MESSAGE: finalisePaidCheckout now fires
notifyMember (bell+push) once on first paid transition (guarded by reading payment_status before mark, and by the
existing stripe_session_id check for plan/package) — Passport owns the paid message; booking site sends only
"booking received". Block node --check OK in isolation (mount truncates full file). DEPLOY: backend index.js v96
(Vercel). No new env. FFP-BOOKINGS.md updated (#3/#5 now built).

LATEST-45 (2026-06-14) — BOOKING-TEAM GAPS 1/2/4/6 built + live-tested (DB only, no frontend). All verified
against live schema first (RLS, columns, bridges). (1) member_my_credits(p_member) — SECURITY DEFINER; bridges
platform members.id → email → provider_members/pro_clients → active provider_member_plans + pro_client_packages;
returns {facility_plans[],pro_packages[]}. NOTE: those tables are EMPTY in live (0 provider_members/plans/packages)
so only the empty path could be exercised; logic mirrors grant_member_plan's proven email bridge. (2) recreated
professionals_public WITH timezone + payments_status (providers already exposes both via providers_public_read).
(4) member_my_bookings(p_member) — enriched read across all 5 surfaces (experience/event/class_session/
provider_session/professional_session); resolves title + counterparty name + when_at + tz; keyed on bookings.member_id
(platform id, no bridge). TESTED on real data: 6 bookings returned correctly enriched. (6) pro_packages_public view
(active) mirroring provider_plans_public; granted to anon,authenticated. Migrations:
booking_member_credit_reads_and_public_views, booking_member_my_bookings_enriched. FFP-BOOKINGS.md updated with all
signatures. PENDING (need Grant's decision, not built): #3 refund — cancel_booking() exists + computes refund_pct/
refunded_aed but the Stripe money-back must be a backend POST /api/pay/refund on the connected account; #5 who fires
the "payment confirmed" email/bell (avoid double-send with the booking-placed email). These are DB objects (live) —
no file to deploy; backend refund endpoint is the only code item once approved.

LATEST-44 (2026-06-14) — LOGIN "Resend code" FIX. Bug: on the sign-in CODE screen, "Get new code" called
goTo('screen-reset') → bounced the user back to a re-enter-email screen → loop. Fixed across the REAL login
paths: (a) login.html (member + admin) — signin & signup code screens now resend IN PLACE via resendCode(flow)
(re-calls FFPApi.requestCode with the email already on screen, no navigation) + a 60s cooldown
(startResendCooldown) that disables the link and counts down "available in Ns"; cooldown auto-starts when a code
screen is shown. Added a separate "Use a different email" link so changing email is still possible. (b)
ffp-professional-dashboard.html inline gate — ADDED a "Resend code" link (it had none) with the same 60s
cooldown (proResendCode/proStartCooldown). Both blocks node --check clean in isolation.
COVERAGE (verified): member, admin AND PROVIDER all sign in via login.html → so the login.html fix covers all
three. CORRECTION of an earlier wrong note: the provider dashboard's inline #auth-screen (submitEmail/verifyCode
"any 6 digits") is DEAD LEGACY code — ffp-provider-auth.js v5 hides it on load (CSS #auth-screen{display:none})
and, if there's no signed-in ffp_member, redirects to /login (login.html). Provider auth = unified /login flow
(its own header: "All sign-in for ALL roles member/provider/admin goes through /login → Get My Code → 6-digit").
So NO provider-side change is needed. Professional dashboard is the only portal with its own inline gate (fixed).
DEPLOY: login.html, ffp-professional-dashboard.html.

LATEST-43 (2026-06-13) — STRIPE CHARGE LAYER built in the BACKEND (assets/ffp-passport-backend-main/.../index.js v95).
CORRECTION: I wrongly told the booking team the charge layer didn't exist — facility Connect ONBOARDING was already
wired (v94: /api/facility/connect/start|return|refresh, account links; payments_status not_connected→onboarding→
connected). What was missing = the CHARGE endpoints + pro onboarding. Built (v95): (a) PRO onboarding /api/pro/connect/
start|return|refresh (mirror facility, professionals.stripe_account_id, owner=professionals.member_id, redirects to
PRO_DASH_URL?panel=checkin). (b) CONNECTED-ACCOUNT charges via stripe.checkout.sessions.create(params,{stripeAccount})
— direct charge, zero application fee: /api/pay/session-checkout {booking_id}, /api/pay/pro-session-checkout
{booking_id}, /api/pay/buy-plan {member_id,provider_id,plan_id}, /api/pay/buy-pro-package {member_id,professional_id,
package_id} → return Checkout {url}; success_url→/api/pay/confirm (retrieves session on connected acct, idempotent
finalise) → redirect to BOOKINGS_URL. (c) finalisePaidCheckout shared by confirm + webhook branch (mode='payment' +
metadata.kind) → mark_booking_paid / grant_member_plan / grant_pro_package. Idempotency: provider_member_plans /
pro_client_packages += stripe_session_id (unique). AED, fils. Backend validated (node --check of the inserted block =
clean; full-file error is the mount truncation boundary). Env needed: BOOKINGS_URL, PRO_DASH_URL (opt); platform
webhook must include checkout.session.completed (+ Connect events) for the backup path. NEEDS Stripe test keys + a
connected test account to verify end-to-end before live (can't test charges from here). FFP-BOOKINGS.md updated.
DEPLOY: the backend (Vercel) index.js v95.

## 🟢 SESSION STATE — 2026-06-12 (LATEST-22 — SESSIONS REBUILD: class-template engine (DB) built + tested)
The Sessions model now matches reality. NEW DB engine (applied + live-tested, rolled back):
- **`session_templates`** = the CLASS TYPE (title, activity, description, capacity, price_aed, duration_min,
  hero_image_url, fitness_level, status).
- **`session_slots`** = weekly slots for a template (`day_of_week` 0=Sun..6=Sat, `slot_time`, `coach`).
- **`provider_sessions`** gains `template_id` + `slot_id` = the generated OCCURRENCES (inherit template fields +
  the slot's coach; per-occurrence `coach`/`capacity`/`status` are overridable = substitute/cancel/resize one date).
- RPCs: **`provider_save_session_template`** (upsert template + replace slots + (re)generate next 12 weeks of
  occurrences), **`provider_list_session_templates`** (templates + slots), **`provider_delete_session_template`**
  (archive + remove future occurrences), **`provider_cancel_session`** (cancel ONE occurrence).
  Live test: 2 slots → 24 occurrences (12wk), coaches per slot, correct days, capacity from template. ✅
- ⚠️ v1 regenerates ALL future occurrences on template save (safe now — credit bookings not wired). When credit
  booking lands, regeneration MUST preserve booked/overridden occurrences. TZ of slot_time stored via session tz
  (UTC) — refine if local-time drift appears.
NEXT (building): partner UI (Step1 class + Step2 weekly schedule form; list = one card per class template;
per-occurrence manage: swap coach / change capacity / cancel a single date). Then booking-team builds credit
booking + facility page (see brief below).

### 🅿️ PARKED — credit-based booking + facility page (booking team)
Members book classes against **`provider_member_plans.credits_remaining`** (plans defined in `provider_plans`:
name/plan_type/price_aed/**credits**/period_days). Booking a class = deduct a credit; buying a package = create/
top-up a `provider_member_plan`. Entry point = a **facility page** (provider storefront) listing all the facility's
classes (session occurrences) + packages, with a direct shareable link (main-marketplace routing is clunky). FFP
(Passport) builds the partner side + exposes the data; the booking team builds the member booking + facility page.

## 🟢 SESSION STATE — 2026-06-12 (LATEST-19 — Profile: partner type simplified + discount hidden)
Profile (`ffp-provider-dashboard.html` v60): **Partner type** stays TAXONOMY-DRIVEN (reads `FFP_TAX.providerTypes`
← `taxonomy_items` list_key='provider_type', Admin-editable) — its VALUES were changed (DB + `ffp-taxonomy.js` v11)
to **Single location / Remote / Event organizer** (was the business-type list Gym/Studio/…). **Passport member
discount** field HIDDEN (display:none; FFP is NOT a discount site — kept in DOM so save logic doesn't break).
Deploy: `ffp-provider-dashboard.html` (v60, taxonomy?v=11), `assets/ffp-taxonomy.js` (v11). DB: provider_type rows replaced.
NEXT (Grant): FEATURED LISTINGS — partners apply to feature a Session/Tour/Event/Trip on the homepage, $99/mo each
(billing mechanics to confirm: manual invoice vs Stripe self-serve). `experiences.featured` already exists; admin
can already feature experiences. Need a partner-facing "Apply to feature" flow + homepage surface.

## 🟢 SESSION STATE — 2026-06-12 (LATEST-18 — Sessions = one strap per session + weekly Timetable tab)
The Sessions list was showing one row per weekly occurrence (a series spammed the list). Now: **one strap per
session** — weekly recurrences grouped by `series_id` (`_dedupeSessions`; earliest occurrence represents the
series; the strap reads "Saturdays · 06:00 · Weekly"). New **"Timetable" tab** (`renderTimetable`) = a Mon–Sun
weekly grid placing each session in its day/time slot (tap a slot → edit). Sessions panel tabs are now
Sessions | Timetable | Attendance. DEPLOY (Netlify): `ffp-provider-scheduling-loader.js` (v5),
`ffp-provider-dashboard.html` (v59, cache-bust scheduling?v=5). No DB change.

## 🟢 SESSION STATE — 2026-06-12 (LATEST-17 — Coach PHOTO + bio popup on sessions)
Grant's staff/coach work: a coach **photo + short bio**, captured when the facility adds staff, shown on the
sessions that coach runs (people book for the coach). DB: `provider_staff.bio` + `provider_staff.photo_url` columns;
`provider_save_staff` persists both (provider_list_staff returns them via to_jsonb). **Staff form**
(`ffp-provider-staff-loader.js` v3): "Short bio" field + photo upload (`pickStaffPhoto` → shared FFPUpload,
quest-images bucket). **Sessions** (`ffp-provider-scheduling-loader.js` v4): coach shows a small photo avatar + is
tappable → popup with the coach's photo + bio + role (fetched via provider_list_staff into `_coachBios`).
DEPLOY (Netlify): `ffp-provider-staff-loader.js` (v3), `ffp-provider-scheduling-loader.js` (v4),
`ffp-provider-dashboard.html` (v58, cache-busts staff?v=3 + scheduling?v=4). DB applied (bio + photo_url columns + RPC).
Also: staff **Phone** now uses the standard country-code component (`.phone-cc` from `FFP_TAX.phoneCodes` +
`.phone-num`) — was a plain box (Grant caught it). ROOT-CAUSE FIX: added a **FORM FIELD STANDARDS checklist** to
the build protocol above (phone/activity/city/level/coach/photo/map/number/select each → their required shared
component) + a SECOND-PASS RULE (re-read every form field-by-field against it before "done"). This is to stop the
recurring "hand-rolled field" misses. Audited the 3 forms touched this session — all compliant.
STILL TO COME (Grant, later): link to the coach's FFP Passport, free FFP referral assistance.

## 🟢 SESSION STATE — 2026-06-12 (LATEST-16 — SESSIONS form rebuilt to world-class standard)
The "New session" form (Sessions tab, `provider_sessions`) was raw free-text + native inputs (Grant: "pathetic").
Rebuilt to platform standard (`ffp-provider-scheduling-loader.js` v2): **Activity** + **City** now use the shared
searchable taxonomy picker (`window.FFPPicker`, same as the listing forms — no free text); **Coach** is a dropdown
of the provider's own staff (`provider_list_staff`); **Location** is a Google Maps **URL**; **Price** labelled
"per person · per session"; **Capacity** has min=1 and is validated ≥1 (was allowing negatives). Required: Title,
Activity, Date, Capacity≥1. DEPLOY (Netlify): `ffp-provider-scheduling-loader.js` (v2), `ffp-provider-dashboard.html`
(v56, cache-bust ?v=2). No DB change.
NEXT (Grant request, not yet built): Staff get a **photo** (shows on the session — people book for the coach), a
**bio/link**, a **link to their FFP Passport**, and **free FFP referral assistance** — needs the passport-link +
referral mechanics defined before building.

## 🟢 SESSION STATE — 2026-06-12 (LATEST-15 — clean separation + Tours require admin approval)
Final cleanup (Grant: "Tours and Sessions are two separate things, period"; "Tours need to be approved"):
- **Removed the crossover:** dropped `classes.listing_subtype` + `provider_set_class_subtype`. Tours = the whole
  `classes` table; Sessions = the whole `provider_sessions` table. No subtype, no shared toggle.
- **Tours tab** (id `classes`) = one-off Tours only. ONE "New tour" button (no Tours/Classes toggle, no "New class").
- **Sessions tab** (id `scheduling`, `provider_sessions`) stays on the left menu, switched ON, label "Sessions".
- **Create chooser:** Tour → `openCreateClass()` (Tours); Class → `openCreateSession()` (Sessions).
- **TOURS NEED APPROVAL:** new tour submits as **'pending'** (provider_set_listing_status now allows 'pending');
  partner self-publish removed; card shows "Pending admin review"; modal button "Submit for review"; panel shows a
  "reviewed by admin within 24 hours" strip. **NEW admin Tours review:** `ffp-admin-classes-loader.js` (mirrors the
  experiences admin loader) + admin nav "Tours" + `#panel-tours` + `AdminTours` global + lazy/title map entries.
  Approve → `classes.status='live'`; Reject → 'archived'.
- **DEPLOY (Netlify):** `ffp-provider-classes-loader.js` (v7), `ffp-provider-dashboard.html` (v55),
  `ffp-admin-classes-loader.js` (NEW — must be committed or 404), `ffp-admin-dashboard.html` (Tours panel/nav/maps).
  DB: dropped listing_subtype + provider_set_class_subtype; provider_set_listing_status allows 'pending';
  **classes_status_check expanded to allow 'pending' + 'archived'** (the old check blocked submit-for-review —
  caught by a live test). FULL LOOP VERIFIED LIVE (rolled back): submit=pending → approve=live (bookable=t,
  session scheduled) → reject=archived. ✅
  ⚠️ Front-end not browser-tested — Grant to confirm: New tour → Submit for review → admin Tours (Pending) → Approve → live.
  NOTE for Bookings: Tours from `classes`(+class_sessions) — unchanged contract; subtype field is GONE (ignore it).

## 🟢 SESSION STATE — 2026-06-12 (LATEST-13 — Tours & Classes are now actually BOOKABLE; one model, settled)
Settled the model after confirming with Bookings: **bookings only work via `class_sessions` (+`classes`),
`item_type='class_session'`** — `provider_sessions` is NOT bookable (no link to classes/bookings, create_booking
doesn't know it). So both Tours and Classes live in **`classes` + `class_sessions`**, split by `listing_subtype`
('tour' | 'class'). **The missing piece (why nothing was bookable): the form never created a `class_sessions`
date.** Fixed: new owner-checked RPCs `provider_save_class_session` / `provider_list_class_sessions` /
`provider_delete_class_session`; the listing form now has a **Date(s) section** (Tour = 1 date, Class = add many),
creates/updates/deletes class_sessions on save, and pre-loads them on edit. Proven live (create→date→go-live):
`session_status=scheduled, class_status=live, bookable=t` (rolled back). **Partner UI:** the listings panel is
"Tours & Classes" with a Tours/Classes view toggle (`setClassView`) + "New tour"/"New class" buttons; both create
via this bookable form. Create chooser routes Tour & Class here. The `provider_sessions` "Scheduling" tab is
re-parked (`soon:true`) — it's a separate non-bookable internal tool, NOT the marketplace path. **DEPLOY (Netlify):**
`ffp-provider-classes-loader.js` (v5), `ffp-provider-dashboard.html` (v53). DB: 3 class_session RPCs applied.
Bookings brief already sent (class_sessions canonical; subtype 'tour'/'class'; Tour date = one class_sessions row).
⚠️ Not browser-tested here — Grant to confirm: New tour/class → add a date → Go live → it shows + books.

ALL FOUR LISTING TYPES — booking path verified live 2026-06-12 (each create→live, rolled back):
- **Tours** (`classes` subtype 'tour') — self-publish; bookable via a `class_sessions` date. ✓
- **Classes** (`classes` subtype 'class') — self-publish; bookable via recurring `class_sessions` dates. ✓
- **Events** (`events`) — date on the row; `create_booking('event')`. Inserts as **'pending' → needs ADMIN approval** to reach 'live' before it's bookable/shown. ✓
- **Trips** (`experiences`) — start/end dates on the row; `create_booking('experience')`. Also **'pending' → ADMIN approval** → 'live'. ✓
(Tours/Classes self-publish; Events/Trips require admin approval — that's the intended gate. Confirm the admin
approve flow works if you want the full Events/Trips loop verified.)

## 🟢 SESSION STATE — 2026-06-12 (LATEST-12 — SEPARATE Tours vs Classes on the partner platform)
Partners were confused by "Experiences" doing double duty. Split them (Grant): **"Experiences" tab → "Tours"**
(id stays `classes`; one-off activities — jet ski/bungy/canyoning) and **"Scheduling" tab → "Sessions"**, which is
now **switched ON** (was `soon:true`) — recurring **Classes** live here (the existing `provider_sessions` system:
session types incl. class, weekly recurrence, attendance). Nav relabelled; "Coming soon" strips removed from the
Sessions panel; panel headers/copy reworded; the Tours module is tour-only (default `listing_subtype='tour'`, all
copy says "tour"). **Create chooser** now routes: Class→`openCreateSession()` (Sessions tab, waits for the lazy
scheduling loader then `openSessionModal`), Tour→`openCreateClass('tour')` (Tours tab), plus Trip/Event/Challenge.
Overview "New experience" quick action relabelled "New trip" (it opens the Trips modal). **DEPLOY (Netlify):**
`ffp-provider-dashboard.html` (v52), `ffp-provider-classes-loader.js` (v4). DB: `classes.listing_subtype` +
`provider_set_class_subtype` already applied (LATEST-11/earlier). ⚠️ Not browser-tested here — Grant to confirm:
Tours tab + "New tour" works, Sessions tab opens and "New session" creates a class, and the create chooser routes
both correctly.

## 🟢 SESSION STATE — 2026-06-12 (LATEST-11 — CREATE-EXPERIENCE BUGFIX: the real "classes never saved" cause)
Found and fixed why partners couldn't create an Experience/class (the Viking "classes never wrote to DB" symptom).
ROOT CAUSE: the classes loader is the ONE listing loader that's **lazy-loaded**; "Create → Experience"
(`openCreatePicker`) and the panel's "New experience" button ran `showPanel('classes'); openClassModal()` — but
`showPanel` only *starts* fetching the loader script (async), so `openClassModal()` on the next line was undefined
on first use and **silently did nothing** → no modal, no insert. FIX: new `openCreateClass()` in
`ffp-provider-dashboard.html` (v50) loads the loader then opens the modal once `openClassModal` is registered;
both create entry points route through it. BACKEND VERIFIED LIVE (insert→publish→rolled back): `provider_save_listing`
kind=class returns a real id and persists all fields incl `fitness_level`/`city`; `provider_set_listing_status`
draft→live returns 'ok' and the row goes `status='live'`. So save/publish was always fine — the break was purely
this front-end race. **DEPLOY (Netlify):** `ffp-provider-dashboard.html` (v50). DB unchanged.

## 🟢 SESSION STATE — 2026-06-12 (LATEST-10 — PROFILE COMPLETION + "listings hidden until complete" notice)
Made profile completion meaningful and tied it to whether listings show. **(1) Completion reworked to the real
storefront ESSENTIALS:** business name, category, city, about (≥40 chars), logo, hero photo, and ≥1 activity —
`computeProfileCompletion` + new `profileEssentials()`/`profileMissingEssentials()`/`profileIsComplete()` in
`ffp-provider-dashboard.html`. The OLD calc required `website` + all 7 days of hours, so 100% was unreachable
(those are now non-blocking "recommended extras"). **(2) Notification:** the completion card now says "your
listings won't appear on Find Fit People until your profile is complete" + lists exactly what's missing; and a
yellow warning banner (`renderListingGate` in `showPanel`, hidden once complete) appears at the top of every
listing panel (Events/Experiences/Trips/Challenges/Deals) with the missing items + a "Complete profile" button.
Gated on `providerProfile.status` so it never flashes before data loads. **(3) Live activity sync:** profile
loader (`ffp-provider-profile-loader.js` v14) now keeps `providerProfile.activities` current as chips are
added/removed and re-renders completion + the banner immediately (was only read at load). **DEPLOY (Netlify):**
`ffp-provider-dashboard.html` (v49, loads profile loader ?v=14), `ffp-provider-profile-loader.js` (v14). DB
unchanged. ⚠️ Not browser-tested from here — Grant to confirm: incomplete profile shows the banner on listing
panels + the % card lists missing items; completing all essentials clears it. NEXT: the create-listing flow
itself end-to-end (the original "partners can actually list" goal).

## 🟢 SESSION STATE — 2026-06-12 (LATEST-9 — UNIFIED LISTING FIELDS: one taxonomy, one level scale, one city picker)
Unified the partner listing forms so they're consistent and world-class (NOT a platform change — just unifying
what exists, so partners can create proper listings). **(1) Killed the Trips hardcoded city list** —
`ffp-provider-experiences-loader.js` had a dead, corrupted `FFP_CITIES` object (541 cities, with stray markdown/doc
text pasted into the Turkey array); removed it — country/city already came from the shared `window.FFP_TAX.cities`
via the searchable pickers. **(2) ONE connected LEVEL scale** — a member's own ability AND a listing's required
level now use the SAME vocabulary: `FFP_TAX.fitnessLevels` = Not Tried/Social/Competitive/Representative/
Professional; new `FFP_TAX.attendeeLevels` = those + "All Levels" (the listing "who can attend?" question),
**derived from fitnessLevels so they can't drift** (rebuilt on DB hydration). Trips + Events + Experiences level
fields all read `attendeeLevels`; killed the per-form hardcoded lists (Trips `FITNESS_LEVELS`, Events copy, and the
Experiences orphan "Difficulty" Beginner/Intermediate/Advanced box — replaced with "Fitness level required" saving
to `fitness_level`; verified `provider_save_listing` class branch persists it). Default level = "All Levels".
**(3) ONE city picker** — Events + Experiences country/city converted from native `<select>` to the shared
searchable picker (`window.FFPPicker.openCountry/openCity`), the SAME component as Trips + the activity field — no
more native dropdowns. **DEPLOY (Netlify):** `assets/ffp-taxonomy.js` (v10), `ffp-provider-experiences-loader.js`
(v7), `ffp-provider-events-loader.js` (v10), `ffp-provider-classes-loader.js` (v2), `ffp-provider-dashboard.html`
(cache-busts: taxonomy ?v=10, experiences ?v=7, events ?v=10, classes ?v=2; + Events "Level" select now reads
attendeeLevels). DB unchanged (verified only). ⚠️ Not browser-tested from here — Grant to open each form once and
confirm the level dropdown + city picker render and a listing saves. NEXT: same picker/level unification on the
remaining forms (Profile/Quests/Challenges) if wanted; then the broader "partners can list" flow.


Started the facility-payments build (let facilities collect real card payments — memberships/packs/drop-ins — via
**Stripe Connect Standard**, money → facility's own Stripe → their bank, **zero FFP per-transaction fee**; FFP
monetizes later via a flat monthly SaaS fee, §9 of spec). Today's facility billing was **record-keeping only**
(`provider_payments` logs amounts, no card charge) — this is the gap. **Phase 1 (onboarding) built:** DB
`providers + stripe_account_id/stripe_connected_at/payments_status`; backend **index.js v93** `POST
/api/facility/connect/start` (refresh-token auth → owner check → Stripe OAuth URL, signed 10-min state) + `GET
/api/facility/connect/callback` (oauth.token swap → save account id → bounce to Billing); portal
**ffp-provider-dashboard.html v47** "Connect Stripe" card in Billing + `?stripe=` bounce-back. Platform acct =
Find Fit People LLC FZ (`acct_1Le2g8BnpbSTlIOB`). **Grant must:** Stripe dashboard Connect setup + set backend env
`STRIPE_CONNECT_CLIENT_ID` / `STRIPE_CONNECT_REDIRECT_URI` (+ optional `PROVIDER_DASH_URL`). **Deploy:** backend →
Vercel, dashboard → Netlify; DB live. Full plan + remaining phases (2 plans→Stripe, 3 enrolment+card capture, 4
webhooks/freeze/dunning, 5 member self-serve, 6 FFP SaaS fee): **FFP-FACILITY-PAYMENTS-SPEC.md**.

## 🟢 SESSION STATE — 2026-06-12 (LATEST-7 — partner listing forms + new Experiences module + Duplicate)
Wired the GYG-parity fields into the partner portal and built the missing module. **Save engine:**
`provider_save_listing` extended to persist all new fields on event/experience + a NEW `class` branch (native
classes insert as `draft`); helper `ffp_jsonb_to_text_array`; `meeting_point` added to events/experiences.
**Trips form** (`ffp-provider-experiences-loader.js` v6): + Highlights + "Good to know" (Languages, Min age,
Not-allowed, Meeting point + coords, Accessibility, Cancellation). **Events form** (`ffp-provider-events-loader.js`
v9): DOM-injected "Good to know" section with the same fields + Includes/Not-included. **NEW Experiences module**
(= `classes` table, customer-facing "Experiences" = classes/tours): `ffp-provider-classes-loader.js` v1 (list +
full create/edit modal + self-publish draft→live via `provider_set_listing_status` + delete + duplicate) wired
into `ffp-provider-dashboard.html` v46 (nav item, #panel-classes, _provLoaderSrc lazy-load, showPanel dispatch,
create-listing chooser). Renamed existing listings "Experiences"→"Trips". **DUPLICATE** on every listing card →
`duplicateListing()` → `provider_duplicate_listing` (deep-copies all fields + clones listing_media) → reloads via
`window.FFPReload[kind]` + opens the "(Copy)" draft to edit. New DB RPCs: `provider_duplicate_listing`,
`provider_set_listing_status`; `provider_delete_listing` gained a class branch. All verified live (create/edit/
publish/duplicate, rolled back). **Member-facing detail display = findfitpeople.com (booking team)** per spec —
not a Passport build. **Deploy (Netlify):** ffp-provider-classes-loader.js (new), ffp-provider-dashboard.html,
ffp-provider-experiences-loader.js, ffp-provider-events-loader.js. DB already live.

## 🟢 SESSION STATE — 2026-06-12 (LATEST-6 — listing detail fields, GYG parity)
Benchmarked the partner listing forms against GetYourGuide (Grant's reference). Finding: media gallery
(`listing_media`) + reviews (`item_reviews`) already cover those GYG blocks for all three types; the gaps were the
**standardised structured-text sections + filterable attributes**. Naming locked: **Experience=`classes`
(classes/tours), Events=`events` (paid/free), Trip=`experiences` (retreats/camps/sports-event trips)**. Added the
shared DB columns (migration `listing_detail_fields_gyg_parity`, additive/idempotent): `classes` got the full
19-field set (highlights, what_included/what_not_included, meeting_point+lat/lng, what_to_bring, not_allowed,
know_before, languages, min_age, difficulty, fitness_level, wheelchair_accessible, accessibility_notes,
free_cancellation_hours, cancellation_policy, itinerary, distance_km); `events` + `experiences` got their
gap-fillers (highlights, meeting coords, not_allowed, languages, min_age, accessibility, cancellation; events also
what_included/what_not_included/know_before). Bullet fields = `text[]`. Verified all live. **Remaining = booking
team**: wire the inputs into the 3 create/edit forms + render the standard section stack on the detail page. Spec
+ per-form field list + display guidance: **FFP-LISTING-FIELDS-SPEC.md**.

## 🟢 SESSION STATE — 2026-06-11 (LATEST-5 — Passport booking check-in + shared check-in modes)
Built the **Passport booking-scan UI** (audit open item #3 → BUILT). `ffp-member-checkin-loader.js` **v8**: after a
venue scan, the member's bookings there (via `member_bookings_at_venue`, time-aware) surface as "Your booking(s)
here" → tap → `booking_checkin` (geo-verified ≤250m, idempotent/day, logs `activity_logs` → passport stamp/stats).
Verified live RPC shapes match the UI: `member_bookings_at_venue` returns `booking_id/title/scheduled_at/checked_in_today`;
`booking_checkin` returns `{ok,verified,title}` + errors `not_your_booking`/`booking_cancelled`/`booking_refunded` —
all handled. **NEW shared MODE flag** so the FFP Booking platform reuses the SAME file: `data-mode="booking"` (or
`window.FFP_CHECKIN_MODE='booking'`) renders **bookings + events ONLY** (no quests/challenges/meetups/visit-logging,
per Grant); default `passport` mode = full. Member dashboard → **v359** (loader `?v=8`). ⚠️ `booking_checkins`
still = 0 rows → confirm FFP Booking QR reader calls `booking_checkin`; the 2 existing bookings have
`scheduled_at=NULL` (always shown — fine for testing; booking team to confirm new bookings set it).
**Deploy (Netlify):** `ffp-member-checkin-loader.js` + `ffp-member-dashboard.html`. DB unchanged (RPCs already live).

## 🟢 SESSION STATE — 2026-06-11 (LATEST-4 — full audit + security pass) → see FFP-AUDIT.md
Reviewed the live structure (Supabase security advisors 377 lints + performance 239 + auth paths). Verdict: strong
architecture, a few quick security fixes (done), scale-readiness debt (deferred). **Fixed:** `event_results` +
`pr_history` had RLS DISABLED (anon-key exposed) → RLS enabled (RPC-only; verified the Results tab + Connections
feed RPCs still work post-RLS). `payout-receipts` bucket was PUBLIC (financial docs via CDN) → flipped PRIVATE +
admin payouts loader now uses `createSignedUrl` (1yr); admin dashboard **v47** (lazy cache-bust v=52). **Reviewed,
intentionally kept:** `professionals_public` SECURITY DEFINER view (correct curated PII-free public projection;
an anon table policy would EXPOSE phone/email), `provider_applications` open INSERT (public apply form; reads
admin-gated), the ~346 anon-executable definer-function warnings (the architecture — members are anon). Open items
(priority): ✅ #1 find-or-create-by-email CLOSED (booking team's shared `ensure_member()` RPC); ✅ #2
`bookings.scheduled_at` CLOSED (added + wired → I made `member_bookings_at_venue` TIME-AWARE, sessions around now;
`cancel_booking` live, status='cancelled'+14-day refund, check-in RPCs already refuse cancelled/refunded). STILL
OPEN: build Passport booking-scan UI (booking_checkins still empty — confirm the new QR reader calls
`booking_checkin`); perf clean-up before traffic; harden explicit-id RPCs; finish member-dashboard monolith
extraction. Full report: **FFP-AUDIT.md**.

## 🟢 SESSION STATE — 2026-06-11 (LATEST-3 — SOURCE OF TRUTH: pricing, referral=recurring, ownership doc)
⚠️ **SUPERSEDES the old membership doctrine below** ($99/yr and "10% discount" are DEAD). Canonical now:
**`FFP-SOURCE-OF-TRUTH.md`** + DB `platform_docs` key='source_of_truth' (public read — the booking platform reads it).
- **Pricing = SUBSCRIPTION: 7-day trial · $20/mo · $149/yr.** Backend (index.js v80) + login v13 + homepage +
  member gate v340 already wired ($PRICE_MONTHLY/$PRICE_ANNUAL, trial_period_days:7, /api/billing/checkout). Verified.
- **NOT a discount site** — Passport gives NO booking discount. Value = identity/loyalty/progress.
- **Referral = RECURRING:** referrer earns tier% (5/10/20) of EACH paid Stripe invoice, for the life of the
  referred member's subscription (backend `creditReferralForInvoice`, already live — v64/v46). FRONTEND was stale
  ("% of $99" one-time) → FIXED: `ffp-constants.js` v2 (membershipUsd 99→149 + recurring note); member dashboard
  **v358** referral display now shows the **tier %** + "recurring" (earn-refer-rate/rm-rate), copy reframed, dead
  **JOIN_URL** ($99 one-time link) removed. Backend correct, no backend change needed.
- **One identity, two surfaces** (email = identity; idempotent find-or-create by email on BOTH platforms; guest
  checkout; upgrade flips membership flag — no second account). **Booking management = findfitpeople.com only;**
  Passport shows read-only "My bookings" + check-in. **Check-in = free-account action (facility QR or email),**
  reusing the venue-scan pattern; Passport adds stamp/stats on top. All locked in the source-of-truth doc.
- DEPLOY (Netlify): `assets/ffp-constants.js` (v2), `ffp-member-dashboard.html` (v358). DB: platform_docs upserted.
- **BOOKING CHECK-IN CONTRACT — LIVE (shared write target for both surfaces).** Table **`booking_checkins`**
  (booking_id, member_id, provider_id, occurrence_date, lat/lng, verified; unique(booking_id, occurrence_date)).
  RPCs: **`member_bookings_at_venue(p_member,p_provider)`** ("which booking are you here for?" — title/status/
  checked_in_today/is_returning) + **`booking_checkin(p_member,p_booking,p_lat,p_lng)`** (geo-verify ≤250m like
  member_event_checkin, idempotent per booking+day, logs an activity_logs row for stamps). Facility QR encodes
  **provider_id** (venue=provider; no venue table yet). Marketplace booking check-in is NEW (the venue scan only
  covered quests/challenges/events; bookings had no check-in field). Passport scan = TODO (extend
  ffp-member-checkin-loader.js to surface member_bookings_at_venue → confirm → booking_checkin → stamp). Booking
  platform owns the write from its free-account check-in. Contract in FFP-SOURCE-OF-TRUTH.md §6 + platform_docs.
  Recommended to the booking team: add `bookings.scheduled_at` (no session date/time on the booking row today).

## 🟢 SESSION STATE — 2026-06-11 (LATEST-2 — pro portal polish + photo-save bugfix)
- **Modals → FULL-BLEED** on the professional dashboard (platform standard; `openModalShell` no longer caps
  width) + the member data-sharing modal (`ffp-pro-access-loader.js` v2). **OVERVIEW shows TODAY's sessions
  only**; yesterday/tomorrow/week stay in Scheduling.
- 🐞 **PROFILE-PHOTO SAVE BUG FIXED:** the photo uploaded fine (blob in quest-images) but `profile_photo_url`
  stayed null because the save RPC was called **un-awaited** — supabase-js v2 query builders are LAZY and only
  fire on await/then. `pickProPhoto` now awaits the save + handles errors. (Backfilled Grant's existing photo.)
  ⚠️ LESSON: any `supabase.rpc()`/`.from()` whose result you don't use STILL must be awaited or it never runs.
- **LANGUAGES spoken** added to the profile (`professionals.languages text[]`, toggle chips + Other) — in
  `professional_save_profile`. **PHONE** field already added (`professionals.phone`).
- **Scheduling: 'Initial / assessment' slot type** (SLOT_TYPES in the scheduling loader; `pro_slots.slot_type`
  is free-text so no DB constraint change; capacity treated as single like 1-to-1 via SLOT_SINGLE).
- Pro lazy loaders cache-bust via **PRO_BUILD='7'**. Pro dashboard → **v7**. Member dashboard pacc ref → `?v=2`.
- DEPLOY (Netlify): ffp-professional-dashboard.html (v7), ffp-professional-scheduling-loader.js,
  ffp-professional-client-loader.js, assets/ffp-pro-access-loader.js (v2), ffp-member-dashboard.html. DB live.

## 🟢 SESSION STATE — 2026-06-11 (Pro ↔ client READ-ONLY DATA SHARING, member-permissioned)
A professional can view a client's **Calorie Tracker + Fitness Stats READ-ONLY, only with the member's
approval**. Consent flow (locked w/ Grant): pro requests → member approves in Passport → pro views →
member can revoke; **client must hold an active FFP Passport** (matched by email); access lasts **until revoked**.
- **DB `pro_client_access`** (professional_id, member_id, client_id, status pending/approved/declined/revoked,
  unique pro+member). RPCs: **`pro_request_data_access`**(p_pro,p_client → match client email→member, require
  `member_passport_active`, upsert pending, notify member), **`pro_client_access_status`**(for the client screen),
  **`member_pro_access_list`** + **`member_respond_pro_access`** (approve/decline/revoke; **hardened with
  `auth.uid()`** — members' auth.uid()=member id; approve notifies the pro's bell), **`pro_client_data`**
  (STRICTLY gated by an approved grant → read-only snapshot from `food_logs`+`profile_meta`+`activity_logs`).
  Verified live: refuses without grant; with an approved grant returns member + fitness PRs + activities + calories.
- **Pro side** (`ffp-professional-client-loader.js`): each client row has a Health-data button →
  `openClientHealth` (request / pending / approved→read-only Calorie+Fitness view). Pro loaders now cache-busted
  via **`PRO_BUILD`** in the dashboard (`ensureProviderLoader` appends `?v=`).
- **Member side**: new **`assets/ffp-pro-access-loader.js`** (deferred, `window.FFPProAccess.open()`, self-contained
  modal) + a **"Data sharing"** item in the member user-menu + **auto-opens on `?proaccess=1`** (the notification
  deep-link). Member approves/declines/revokes here. Member dashboard → **v357**.
- **DEPLOY — Netlify:** `ffp-professional-dashboard.html` (v6) + `ffp-professional-client-loader.js` +
  `assets/ffp-pro-access-loader.js` (NEW) + `ffp-member-dashboard.html` (v357). DB live. No backend change.
- 💡 **PARKED IDEA (Grant 2026-06-11):** session **check-in via the pro's QR** (or pro checks the client in) →
  **90 min after check-in, prompt the client to REVIEW the session** → review posts to the **public storefront**.
  Ties into the existing venue check-in pattern + the professional verification/storefront. Scope before building.

## 🟢 SESSION STATE — 2026-06-10 (Professionals Portal v5: + frozen header, notifications, feedback, phone)
**v5 polish (on top of v4 below):** topbar is now a FROZEN sticky header with a NOTIFICATIONS bell
(reuses member `/api/notifications/{id}` — a pro is a member; `professional_set_verification` posts an
approve/reject notification to that bell) + the FEEDBACK widget (`ffp-feedback-widget.js`,
data-source=professional). Primary nav trimmed to **Overview/Clients/Scheduling/Payments**; **Profile +
Packages + Messages moved into the avatar menu** (`PRO_NAV_EXTRA`). Added **`professionals.phone`** + a
Phone field on the profile. DB: `professionals.phone` + phone in `professional_save_profile` +
verification-notification insert in `professional_set_verification` (all live). Deploy = the same
`ffp-professional-dashboard.html` (now **v5**) + `ffp-admin-dashboard.html` (v46) + the new admin loader.
PARKED (Grant "not sure yet"): trainer-sees-client calorie/fitness-stats vs. trainer↔client messaging — decide before building.

**Built "all seven" in dependency order (DB → shell → overview → storefront → verification).**
- **Pro dashboard `ffp-professional-dashboard.html` v4** — MOBILE-FIRST, Passport-style. Bottom tab nav on
  phones (`.bottom-nav`, `PRO_BOTTOM`=overview/clients/scheduling/packages/payments) + sidebar collapses
  `@media(max-width:859px)`. Topbar **AVATAR menu** (`#av-menu`: My profile + Sign out) — sign-out now under
  the avatar like other dashboards. `PRO_NAV` gained **overview** (first) + keeps profile last.
- **OVERVIEW = default landing** (`showPanel('overview')` in enterDashboard). `renderOverview()` reuses
  **`pro_business_report`** (collected_month / clients_active / outstanding_total / standing_slots) + slices
  **`pro_week_schedule`** for yesterday/today/tomorrow sessions (fetches adjacent weeks at week boundaries).
- **PWA opens straight to an INLINE professional sign-in** (`#gate-signin`, purple) — boot() shows it instead
  of `location.href='/login'`, so the FFP Professional icon never shows the portal picker. Uses
  `FFPApi.requestCode/verifyCode('signin')` (already stores ffp_member) → `boot()`. (Grant: "the only option
  should be sign in to Professional portal".)
- **STOREFRONT (profile editor):** profile **PHOTO** upload (`FFPUpload.pick` → bucket **`quest-images`** key
  `pro-profile-{id}`, aspect 1 — reuses the allowed member-upload bucket so NO backend/bucket change; needs
  `assets/ffp-image-upload.js?v=6` + cropperjs, now loaded in the head). **Up to 4 PROFESSIONS** — the same
  searchable picker in multi-select mode (`_pfProfs`, target `'pfmulti'`, first = primary → drives category).
  **VIDEO links** (YouTube/Vimeo/IG) via `pro_videos` table + `pro_videos_list/_save/_delete` RPCs.
- **VERIFICATION (public listing needs approval):** `professionals.verification_status`
  (unlisted→pending→approved/rejected) + `verification_note/verified_at/by`. Ticking "List me on Find Fit
  People" → `professional_save_profile` flips it to **pending** (publish→pending logic in the RPC); pro sees a
  review banner (`renderVerifBanner`). **Admin → Professionals** (`#panel-professionals` + new
  **`ffp-admin-professionals-loader.js` v1**, lazy ?v=51) lists pending pros with Approve & publish / Reject
  (note) via **`professional_set_verification`** (is_admin-gated) + **`professional_verification_list`**.
  Public visibility = `is_published AND verification_status='approved'`.
- **DEPLOY — Netlify:** `ffp-professional-dashboard.html` (v4) + `ffp-admin-dashboard.html` (v46) +
  `ffp-admin-professionals-loader.js` (NEW — must be committed or 404). **DB live** (pro_videos + verification
  columns + 5 RPCs + extended professional_save_profile). No backend/Vercel change. ffp-image-upload.js + cropperjs already deployed.

## 🟢 SESSION STATE — 2026-06-10 (Professionals Portal: professions taxonomy + picker + emblem icon)
**Context: Grant flagged 3 problems with the professional onboarding I'd shipped — fixed all + logged (Issue P1 below).**
- **PROFESSIONS ARE NOW A DB TAXONOMY (Admin-editable).** New `taxonomy_items` list_key **`professional_role`** — 178
  service-professional roles, each row's **`parent` = one of the 6 STANDARD FFP categories** (Sports · Fitness ·
  Wellness · Recovery · Adventure · Health food). Manage in **Admin → Taxonomies → Professions** (new list in
  `ffp-admin-taxonomies-loader.js` **v6**, with a per-row **Category** selector mirroring the category→passport cell;
  reuses `setCatPassport` since both write `parent`). Service pros ONLY — business owners / athletes / creators dropped.
- **`assets/ffp-taxonomy.js` v9:** `professionalRoles` regrouped under the 6 categories (was made-up headings like
  "Strength & Body Composition") + **DB-hydrated** from list_key='professional_role' (group by parent, canonical
  category order, admin-added categories appended). New helpers `T.professionalCategories`, `T.professionalRolesFlat()`
  (flat [{name,category}] A–Z), `T.categoryOfRole(role)`. Referenced `?v=9` on admin + professional + profile-complete
  pages; **member/provider/signup left at `?v=8` on purpose** (they don't consume professionalRoles → no behaviour
  change; avoids risky edits to the huge member/provider files). They'll pick up v9 on their next own change.
- **ONE searchable Profession picker** (FFP standard: tap-to-open + search at top, modeled on profile-complete's sport
  picker). `ffp-professional-dashboard.html` **v3**: onboarding + profile editor both use it (hidden input
  `ob-/pf-profession` + button + `openProfPicker`/`renderProfPickList`/`pickProfession`). Category is **auto-derived**
  from the chosen profession (no separate category step) and stored on **`professionals.category`** (new column; both
  `professional_link` + `professional_save_profile` RPCs now persist it). Removed the old category→profession cascade
  + `EXCLUDED_PRO_CATS` hack.
- **Pro home-screen icon = REAL FFP EMBLEM + "PROFESSIONAL"** underneath, on white (same family as the Passport icon).
  Regenerated `assets/icons/ffp-pro-{32,180,192,512}.png` from `assets/ffp-emblem.png` (32px = emblem only). **The
  purple "FFP/PRO" mark is gone.** `ffp-pro.webmanifest` icons set to purpose **"any"** (was "any maskable") so the
  edge-reaching wordmark isn't clipped by Android's circular maskable crop. Sidebar brand also changed from text
  "FFP PRO" → emblem + "FFP **Professional**".
- **DEPLOY — Netlify:** `ffp-admin-dashboard.html` (v45) + `ffp-admin-taxonomies-loader.js` (v6) + `assets/ffp-taxonomy.js`
  (v9) + `ffp-profile-complete.html` (taxonomy ?v=9 bump) + `ffp-professional-dashboard.html` (v3) + `ffp-pro.webmanifest`
  + the 4 `assets/icons/ffp-pro-*.png`. **DB live** (taxonomy rows + professionals.category + 2 RPCs). No backend/Vercel change.

### 🐞 ISSUE P1 (2026-06-10) — professional onboarding shipped sub-standard; Grant caught it
Three faults in the professional onboarding I'd built, all now fixed: (1) **invented categories** — I grouped
professions under made-up headings ("Strength & Body Composition" etc.) AND hardcoded them in JS instead of using
the 6 standard categories + Admin Taxonomy. (2) **purple FFP/PRO logo** — off-brand; the FFP emblem is essential.
(3) **profession was a 2-step native-select cascade** — should be ONE searchable picker (the FFP standard). Root
cause: built on assumptions without locking the spec to FFP's existing standards (categories, brand emblem, picker
pattern). Lesson re-banked: reuse the proven platform pattern + the real brand assets; don't invent taxonomy or art.

## 🧭 BUILD PROTOCOL & CONVENTIONS — READ FIRST, FOLLOW EVERY TASK
_The operating manual. If a change skips a step here, it's wrong. (Reinforced 2026-06-05 after a session that thrashed by skipping these — the protocol existing isn't enough; it has to be followed.)_

### The 10 rules
1. **READ THIS FILE FIRST** — every session, every task.
2. **LOCK THE SPEC before code.** Anything subjective (UX / gamification / "feels right") → restate it in one line, get a yes, THEN build. No building on a guess.
3. **REUSE THE PROVEN PATTERN** (see §0a REUSE RULE below). Find how it's already done here and copy it. Any taxonomy/list field (activity, country, city, level) = the shared SEARCHABLE PICKER `window.FFPPicker` reading `window.FFP_TAX` — NOT a native `<select>` (raw native dropdowns look amateur; the listing forms were unified onto the picker 2026-06-12). Native `<input>` is fine for free text. A feature module = the existing `assets/ffp-*-loader.js` shape. No bespoke widget when a platform pattern exists.
4. **ONE CHANGE AT A TIME** — make it → verify it → next. No stacking unverified edits.
5. **VERIFY AGAINST TRUTH** — real code / DB / live behaviour; quote the exact line. Never theorise a cause.
6. **VALIDATE BEFORE "DONE"** — isolation-test the changed logic; `node -c` new modules. NOTE: the sandbox shell serves a stale/truncated view of big files, so its `node -c` on them gives false EOF errors — validate the changed logic in isolation instead, and trust the Read/Edit tools as canonical.
7. **VERSION + CACHE-BUST EVERY CHANGE** (see the vN rule above) — and **one version lineage per file** (no double-numbering).
8. **SHARE EVERY CHANGED FILE — ALWAYS, in the SAME message as the change.** Attach the actual file(s) via the file cards. NEVER name, describe, or say "deploy X" without attaching X — a change isn't delivered until the file is shared (Grant can't pull it from thin air). If 3 files changed, all 3 get attached together. Keep version notes in the file header, not chat. _(Non-negotiable — repeatedly missed 2026-06-05.)_
9. **IF IT BREAKS: REVERT FIRST**, diagnose second — get back to known-good, then investigate.
10. **WORLD-CLASS UX, ALWAYS.** Every screen, field and flow is designed to a best-in-class standard — nothing ships that looks or feels amateur. Consistent shared components, the searchable pickers (never raw native dropdowns), clean layout, sensible defaults, clear labels, no dead/duplicate options. If it wouldn't sit comfortably next to the best apps in the category, it's not done. _(Added 2026-06-12 — Grant: "We create and design based on BEST WORLD CLASS user experience.")_

### 📋 FORM FIELD STANDARDS — CHECK EVERY FIELD AGAINST THIS BEFORE BUILDING/EDITING ANY FORM
_(Added 2026-06-12 — Grant kept having to catch hand-rolled fields. This is the cure: NEVER hand-roll a field
that already has a shared component. Before writing a form, open an existing standard form (provider profile /
a listing form) and COPY the component. Then check each field below.)_

| Field | REQUIRED component (copy it) | Never |
|---|---|---|
| **Phone** | `.phone-input` → `<select class="phone-cc">` (filled from `FFP_TAX.phoneCodes`) + `<input class="phone-num">` | a plain text phone box |
| **Activity / Category** | `window.FFPPicker.openActivity` (searchable taxonomy) | free text or native `<select>` |
| **Country / City** | `window.FFPPicker.openCountry/openCity` (or `FFPLocation`) ← `FFP_TAX.cities` | free text or a hardcoded list |
| **Level / Difficulty / "who can attend"** | `FFP_TAX.attendeeLevels` / `FFP_TAX.fitnessLevels` (the one shared scale) | a per-form hardcoded list |
| **Coach / staff person** | dropdown from `provider_list_staff` | free text |
| **Photo / logo / hero / avatar** | shared uploader `FFPUpload.pick({bucket:'quest-images',…})` | a raw URL text field for an image |
| **Map / location** | a URL field (Google Maps link), `type="url"` | a vague free-text "location" |
| **Number (capacity/age/price)** | `type="number"` with sensible `min` (capacity `min="1"`) + validate | unbounded (lets users enter -1) |
| **Fixed enum (status/type)** | the platform `.select` styled class | a raw/unstyled `<select>` |
| **Price** | label the UNIT explicitly (per person / per session) | an ambiguous "Price" |
SECOND-PASS RULE: when adding any form, immediately re-read it field-by-field against this table BEFORE saying "done".

### ⚡ Performance conventions (permanent — learned 2026-06-06)
- **Scripts load `defer` (or lazy) — never a plain synchronous `<script src>`.** A sync external script mid-document blocks the HTML parser until it downloads; two of them buried ~10.5k lines into the member dashboard stalled boot (Bio felt 7–8s). Feature/panel/core scripts get `defer` — they still run before DOMContentLoaded, and the boot `init()` is DOMContentLoaded-gated, so `window.X` is defined in time.
- **Repeated heavy SVG is deduped with `<use>`.** Define a heavy shape ONCE (in `<defs>` as `<g id>`/`<symbol>`) and `<use>` it per instance — never redraw it N times. The laurel wreath was ~28 gradient leaves on EVERY badge (×100+ on a big ladder); deduping to one `<use>` per badge fixed the slow Milestones render.
- **De-fragile the member dashboard by extraction.** `ffp-member-dashboard.html` is a ~14k-line monolith (all panels inline) — the root of its fragility. Standard: pull each panel into its own module (core `assets/ffp-<panel>-core.js` deferred + lazy `assets/ffp-<panel>-loader.js` for data), leaving the dashboard a thin shell (skeleton + nav + auth/boot + panel-loader map). Done: Fitness Stats. Next: Calorie Tracker (+ My Meals), then Passport/Connections, Quests, Profile.

### 🎨 DESIGN — no amateur "boxes"
- **No decorative background / opacity boxes or "cards" as containers** — they make the platform look amateur (Grant, 2026-06-06). Use clean spacing, hairline dividers and typography instead; reserve filled surfaces for genuinely interactive chips/buttons. Legacy boxy UI gets stripped when you touch that screen.
- **Standard action button = YELLOW** (`var(--yellow)` / `#FFCC00`, dark text), e.g. the calorie "Log food" / "New meal" / "Save". Blue is secondary.
- **Time entry = single-tap SCROLL WHEEL** (`window.FFPDurationPicker`, H/M/S) — never `+/-` steppers or digit boxes. Wired into the Records time editor (Bronco, 5K/10K/Half/Marathon, Swim) and Log Activity duration.
- **NO native / "apple" dropdowns** (`<select>` incl. `.ffp-select`) — Grant HATES them, off-brand (2026-06-07). For a small fixed set of choices use an FFP **segmented toggle** (`.chal-seg` pattern: row of pill buttons, selected = yellow). For larger lists use a custom tap-to-open sheet. Existing `<select>`s get replaced when you touch that screen (backlog: purge platform-wide). **Also NO native date / time / datetime inputs** (`<input type="date|time|datetime-local">`) — Grant hates these too (2026-06-07). Use the FFP wheel pickers: `window.FFPDurationPicker` (H/M/S) for durations, `window.FFPDateTimePicker.open(startIso, maxDays, cb)` (Date/Hour/Min wheels, in ffp-member-discovery-loader.js) for date+time. Native date/time inputs are still scattered across provider/admin/log-activity/meetup forms — same backlog purge. Photo input = square tap-to-add tile, no label text.

### ⛔ NEVER bash/Python-rewrite the big files
The sandbox Linux mount serves a TRUNCATED copy of large files (e.g. ffp-member-dashboard.html ~12k lines) — a Python/bash read-modify-write writes the truncated copy back and SILENTLY LOPS OFF THE TAIL (lost the gate + `</body></html>` on 2026-06-07, recovered by hand). Use the **Edit tool only** (canonical) for the dashboard + any large file. Bash is fine for `node --check` of small NEW files, but treat its reads of big/edited files as unreliable (stitch-verify). Header/changelog trims on big files = Edit tool, not Python.

### ⭐ BRAND — who we are
FFP / Find Fit People is the **world-leading active-lifestyle community of ATHLETES**. Everything we ship pushes members toward GREATNESS — it is NOT built for lazy people. Tone, copy, gamification and especially the milestone system must feel ambitious, athlete-grade and aspirational.

### 🏅 MILESTONE SYSTEM DOCTRINE (Milestones tab) — LAW, READ BEFORE TOUCHING LADDERS
**RULE #1 — FREQUENT WINS, ALWAYS.** (Said dozens of times. Stop breaking it.) The gap between consecutive milestones NEVER balloons — from the first badge to the last. A member must ALWAYS have a near-term next badge in reach. You reach big aspirational tops by adding MORE stages, **never** by widening the gap. Early gaps tiny (1, 2, 3…); later gaps grow only gently and stay capped. A giant late jump (e.g. 3200 → 4000) is WRONG and means the ladder failed this rule.
- **5-YEAR PLAN:** each journey's top (Legend) ≈ a serious athlete's ~5-year grind — earned, not handed out.
- **Structure:** 8 JOURNEYS, each its own object badge, recolouring across 8 LEVELS (Bronze → Silver → Gold → Emerald → Sapphire → Amethyst → Ruby → Legend). The tab shows ONE badge tile per journey (member's current level colour + earned/total); tapping a tile opens that journey's FULL ladder. Earned = level colour, locked = grey.
- **The journeys (badge) — each metric is its OWN journey/tile; do NOT collapse lifts or run distances into one:** Activities Logged (medallion + number) · Deadlift / Back Squat / Bench Press (weight plate — ×bodyweight, 0.1 steps) · Sports Variety (ball — count of unique sports) · 5K / 10K / Half Marathon / Marathon (stopwatch — DROPPING TIME per distance, many sub-time tiers; **NOT hours**) · VO₂ Max (heart) · Cities (skyline — to ~200) · Body Fat (scales — % dropping 34→8) · Quests (map) · Meetups (wreath + 4 people) · Connections (wreath + 2 people). More distances/lifts/metrics can be added as their own journeys anytime.
- **Code:** ladders + badge art live in `assets/ffp-milestone-badges.js` (`window.FFPMSBadges`). The lazy loader `assets/ffp-fitness-stats-loader.js` ONLY gathers the member's numbers and calls `FFPMSBadges.render(values, gridEl)`. Ladders are built by a capped-gap generator so "frequent wins" is enforced in code, not by hand. Dashboard includes the module via `<script src="assets/ffp-milestone-badges.js?v=N">` — bump that `?v` on every badge change.
- **Data sources:** Activities, lifts (deadlift/squat/bench), runs (5K/10K/Half/Marathon PRs), VO₂, Cities, Body Fat = Fitness Stats / Records; Meetups = `member_meets`, Connections = `member_connections_count`, Quests = `member_quests_completed` (RPC: count of `quest_progress` rows with `status='completed'`). TODO: Endurance ultra tiers need ultra-distance tracking; run/lift/VO₂ journeys only fill once the member logs those PRs on the Records tab.

### File map (what's what)
- **Frontend (Netlify · ffppassport.com):** `ffp-member-dashboard.html` (its `FFP_BUILD` cache-busts the lazy loaders), `ffp-provider-dashboard.html`, `ffp-admin-dashboard.html`, `login.html`, `ffp-profile-complete.html`, `provider-signup.html`. Feature modules are lazy-loaded from `assets/ffp-*-loader.js` (cache-busted via `FFP_BUILD` / `?v=`).
  - **MODULE PAIRS — change one, CHECK ITS PARTNER (this is where fuck-ups happen):** each big panel = a deferred CORE (the engine: object + render, `assets/ffp-<panel>-core.js`, loaded `<script defer src=...?v=N>` in the dashboard so `window.X` exists before the DOMContentLoaded-gated boot `if (window.X) X.init()`) PLUS a lazy LOADER (`assets/ffp-<panel>-loader.js`, fetched only when the panel opens, busted by `FFP_BUILD`) that wires it to Supabase by overriding core methods by name.
    - **Fitness Stats:** `ffp-fitness-stats-core.js` (deferred `?v=`) + `ffp-fitness-stats-loader.js` (lazy, `FFP_BUILD`). The loader also owns the **Records model** (`METRICS` + `PR_MAP`) and the **milestone wiring** (`renderMilestones` → `FFPMSBadges`).
    - **Calorie Tracker:** `ffp-calorie-tracker-core.js` (deferred `?v=`) + `ffp-calorie-tracker-loader.js` (lazy, `FFP_BUILD`). The loader owns **My Meals** + all Supabase writes.
    - **Connections:** `ffp-connections-core.js` (`window.MeetMove` matches/discover/meetups + `window.CollectionView`) + `ffp-meet-move-loader.js` (lazy, Supabase data). ⚠️ The core is a **CLASSIC (non-defer) `<script src=…?v=>`** loaded right BEFORE the Matches-deck IIFE — because that IIFE does `Object.assign(MeetMove,…)` at PARSE time, so a deferred core would be too late and the deck would silently not wire. Boot calls it guarded: `if(window.MeetMove) MeetMove.init()`. Extracted from the dashboard 2026-06-07 (v323) to de-bloat (~852 lines out). Bump the core's own `?v=` on change.
    - **Connections FEED (v324):** `ffp-connections-feed-loader.js` (deferred, `window.FFPConnFeed`) renders `#conn-panel-root` in `#panel-meet` — discovery strap (→ `MeetMove.openMatchesGrid`), "My connections" most-active circles (→ `CollectionView.openPerson` / See all → `CollectionView.open`), and a "From your people" feed. Data: one RPC **`member_connections_panel(p_me)`** → `{connections:[id,name,photo,city,active,act_count], feed:[{type,actor_id,name,photo,title,sub,icon,link,when}]}`. Feed = notifications-to-me (pre-formatted) + connections' upcoming meetups + live-challenge joins + `activity_logs` (14d) + birthdays (`members.date_of_birth`). Tap routes by `type`: meetup→meetups panel+`openMeetupDetail`, challenge→challenges panel+`Challenges.openDetail`, activity/birthday→`openCard`, **pr→`congratulate`** (`member_congratulate` RPC → bell notification), notif→its link. Renders eagerly on load (loader v2+) so it never sticks on the skeleton. Bump feed loader `?v=` + `FFP_BUILD` on change.
    - **PR history → congratulate (v326, was #85):** `pr_history` table + **trigger `trg_log_pr_history` on `profile_meta`** (`log_pr_history()`) — logs one row whenever a PERFORMANCE PR column improves (bench/squat/deadlift/5k/10k/21k/marathon/swim1k/bronco/beep/vo2; higher-or-lower aware; going forward only, no backfill). `member_connections_panel` surfaces connections' `pr_history` (14d) as `type:'pr'` feed items; feed loader taps → `member_congratulate(p_me,p_to,p_metric)`. To celebrate more metrics, add the col to the trigger's VALUES map.
    - ⚠️ **MEMBERS ARE THE `anon` ROLE to Supabase** (anon key + custom JWT; SUPABASE_JWT_SECRET path doesn't make them `authenticated`). So: member writes MUST go through SECURITY DEFINER RPCs (granted to `anon,authenticated`) — direct table writes under `authenticated`-only RLS will fail for members. **Storage**: member uploads need an **`anon` policy** on the bucket (e.g. `quest-images insert/update anon`) — `authenticated`-only storage policies (avatars, ffp_media_*) block members. This is why provider uploads work (providers authenticate) but member challenge photos were RLS-blocked until the anon policy was added.
    - **RACE RESUME — event results (v327):** `event_results` table + RPCs (`member_event_result_save`/`_delete`/`member_event_results` → results + stats Events/Podiums/Top10 [podium/top10 = best of overall OR age-group placing] + milestone counts). UI = **`ffp-event-results-loader.js`** injects a **Results tab** into Fitness Stats `#fs-tabs` (+ `#fs-results-view`) — self-contained (own delegated tab handler), doesn't touch the fitness-stats core. Log form: Individual/Team (team name + teammates), overall + age-group placings, FFP **past-date** wheel (`DatePicker`, Day/Month/Year), optional photo (`quest-images`). Results post to the Connections feed (type 'pr' → congratulate). **Event list = admin-managed taxonomy `event_catalog`** (public-read; `admin_event_catalog_save/_delete/_list` guarded by `is_admin()`); loader reads it (fallback list if unread). **DONE:** Events is now an admin **taxonomy** (`taxonomy_items` list_key='event'; manage in Admin → Taxonomies → Events; the old `event_catalog` table was dropped). **DONE:** 2 milestone journeys — **Competitions** (medallion) + **Running Races** (stopwatch) in `ffp-milestone-badges.js` v6, fed by `member_event_results` milestone counts via `ffp-fitness-stats-loader.js` v32 (`fetchMsSocial` → `values.comps`/`values.runRaces`). Fitness Stats tab order: Activity · Bio Age · Records · Results · Milestones. STILL TO DO: remove dormant `#panel-events` from the Passport (Events now lives on findfitpeople.com).
    - **Milestone badges:** `ffp-milestone-badges.js` (deferred `?v=`, `window.FFPMSBadges`) = badge art + ladders; CONSUMED by `ffp-fitness-stats-loader.js`. Change a badge/ladder → bump its `?v=` in the dashboard tag.
  - **CACHE-BUST — always do BOTH sides:** a LOADER change → bump `FFP_BUILD` (busts every lazy loader). A deferred CORE/module change (`*-core.js`, `ffp-milestone-badges.js`) → bump ITS `?v=N` on the dashboard `<script>` tag (own version lineage). Every changed file ALSO bumps its own header `vN` + changelog (rule #7). **Deploy a core/module + the dashboard together.**
  - **CORRESPONDING DATA CHAINS — change one, change ALL:**
    - **New Record (PR) — FIVE places, ALL required (learned the hard way 2026-06-06):** in `ffp-fitness-stats-core.js`: (1) `prDefs` (drives the EDITOR + card — miss it and the card shows but **won't open**) AND (2) `_prCol` (+ `_prInt` if integer) — the SAVE key→column map; **miss it and Save silently does nothing** (this is what broke Bronco even after prDefs+RPC). In `ffp-fitness-stats-loader.js`: (3) `METRICS` + (4) `PR_MAP` (leaderboard + load-back). DB: (5) a `profile_meta` column **AND** add it to the `member_profile_meta_save` RPC whitelist (miss the RPC → won't persist). Then bump the core `?v=`. e.g. Bronco=`pr_bronco_sec` (int), Beep Test=`beep_test_level` (numeric).
    - **New milestone journey:** ladder/badge in `ffp-milestone-badges.js` + feed its number from `ffp-fitness-stats-loader.js` (`renderMilestones` values) + a data source (a Fitness Stats field or an RPC).
    - **My Meals:** `member_meals` table + the 4 `member_meal_*` RPCs + the `ffp-calorie-tracker-loader.js` UI; `member_meal_log` writes a `food_logs` row.
    - **Member-created Challenges (2026-06-07) — see FFP-SCOPE-member-challenges.md:** DB (`challenges.score_direction`, `challenge_entries.proof_url`, unique idx `challenge_entries_uniq_member`, + RPCs `member_challenge_create` / `_submit_score` / `_verify_entry` / `_leaderboard`) ⇄ member UI in **`ffp-member-discovery-loader.js`** (overrides the inline `Challenges` demo; `FFP_BUILD` on the dashboard busts it) ⇄ admin take-down in **`ffp-admin-challenges-loader.js`** (`?v=` on admin dashboard `_lazyInit`). RULES: member challenges go LIVE on create, **30-day cap** (clamped in RPC), **NO prize** (leaderboard only: podium top-3 + top-10), **honor-system scores**, **host** sets a verified badge, submitter adds **photo proof** (reuses public bucket `quest-images`). GOTCHAS (real constraints): `challenges.verification` CHECK allows only `peer`/`none` (member create uses `peer`); `status` allows `pending/live/closed/past/archived` → **take-down reuses `archived`** (no new status); member discovery loader must fetch **`status='live'` only** (else pending/archived leak into the member "Past" tab); active/past derived by `ends_at`, not status. The whole leaderboard was demo-only before this (loader hardcoded empty) — submit + leaderboard are now real via the RPCs.
  - **Scope docs:** `FFP-SCOPE-calorie-tracker-mymeals.md`, `FFP-SCOPE-event-attendance.md`, `FFP-SCOPE-*` — read the matching scope before touching that feature.
- **Backend (Vercel · ffp-passport-backend.vercel.app):** `assets/ffp-passport-backend-main/ffp-passport-backend-main/index.js` — auth/JWT, Resend email, notify endpoints, quests API.
- **DB (Supabase `kxzyuofecmtymablnmak`):** shared by Passport + Find Fit People; schema/RPCs applied live via MCP.
- **Shared spec:** Integration Contract — canonical in `platform_docs`, mirror `FFP-INTEGRATION-CONTRACT.md`.

### Who writes what (one shared DB)
Membership fields + the $99 subscription = **Passport only**. Per-booking payments + member discount = **Find Fit People**. Providers / listings / taxonomy / storage / auth = **shared**. (Full table: Integration Contract → "Ownership at a glance".)

### Deploy
- **Frontend** change → push to GitHub → Netlify. Bump the page's `vN` + `FFP_BUILD` / `?v=` so loaders re-fetch.
- **Backend** change → push → Vercel. Bump the `vNN` marker.
- **DB** change → applied live via MCP (no deploy).
- After any deploy, smoke-test the critical flows: **login · check-in · log activity · booking-notify**.

## 🎟️ EVENT ATTENDANCE FLOW (2026-06-04) — see FFP-SCOPE-event-attendance.md
**Model:** open RSVP → member's Passport on the guest list → at the venue, scan the VENUE QR → tap the event → check in (auto-attended) → counts toward "events attended". NO provider pre-approval.
- ✅ **Check-in → attended ALREADY existed & verified:** venue scan surfaces events (`venue_active_programs`), tapping → `member_event_checkin` writes `event_checkins` (idempotent, geo-verified ≤250m) AND logs an 'Event' activity. No build needed.
- ✅ **RSVP email trail BUILT + verified (DEPLOY PENDING):**
  - DB `rsvp_event` now drops an in-app notification on the provider's bell ("X is coming to your event"). Live-tested (Grant→Forge → provider 7b0307bf got the notif; test rows cleaned).
  - **backend index.js v73** (Vercel): new `POST /api/events/notify {kind:'rsvp'}` → emails the MEMBER ("You're confirmed to attend …") + the PROVIDER ("X RSVP'd …"). New `sendEventRsvpMemberEmail`/`sendEventRsvpProviderEmail`. node-checked (additions ~L1043-1095 parse clean).
  - **discovery-loader v6** (lazy via FFP_BUILD): after `rsvp_event`, POSTs `/api/events/notify`; toast → "check in with your Passport on the day".
  - **member dashboard v284** (FFP_BUILD=284): RSVP-confirm copy fixed (dropped misleading "organiser manages the guest list").
  - **DEPLOY:** DB live → Vercel (index.js v73) → Netlify (dashboard v284 + discovery loader). 
- ✅ **PROVIDER GUEST LIST BUILT (DEPLOY PENDING):** `provider_event_roster(p_me,p_event)` owner-gated SECURITY DEFINER RPC (returns RSVP'd members' passport info + `checked_in`). **provider-events-loader v7** injects a "Guest list" section into the event modal (photo + name + city, "Going"/"Checked in" badge, "N going · M checked in" header). **provider dashboard v31** loads it at `?v=7`. node-checked + roster RPC live-tested (owner sees roster, non-owner sees nothing). DEPLOY: DB live → Netlify (provider dashboard v31 + loader).
- ⏭️ STILL OPEN: **"Events attended" stat** — data ready (event_checkins + 'Event' activity logs); needs a PLACEMENT decision because `.hero-stats` is a fixed 4-col × 2-row grid (8 tiles full). Options: add a 9th tile (uneven 3rd row), swap one, or make the grid auto-fit. Ask Grant.

## ⛔ NON-NEGOTIABLE RULE — BUMP vN ON EVERY CHANGE (Grant, 2026-06-04)
**Every time ANY file is edited, bump its version number — no exceptions, however small the change.**
- HTML pages: bump the version in the file's header comment (e.g. login.html v7→v8, profile-complete v32→v33, member dashboard vN) AND `FFP_BUILD` where present (member dashboard) so loaders re-fetch.
- Loader/asset JS: bump the `vN` in the file's top comment AND the `?v=N` cache-bust everywhere it's referenced — they move TOGETHER (cache-bust drift = stale file served; see Issues #5/#8).
- Backend index.js: bump the `vNN` marker in the touched section.
- This applies to tiny CSS/one-line fixes too. If a file changed, its version changed.

## 🟢 SESSION STATE — 2026-06-05 (LATEST — current versions + cross-project build)
- **LOGIN LOCKOUT FIXED (email case).** Sign-in matched email **case-sensitively** while stored emails are
  lowercase, so a capitalized email (autocapitalized first letter) made `/api/auth/reset` return `exists:false`
  → the v8 login `exists` gate showed "account does not exist" and blocked login. Fix: **backend v75** normalizes
  email to `.trim().toLowerCase()` at every member-touch point (`/api/auth/signin`, `/reset`, `/signup`, the
  Stripe webhook, `/api/onboard/from-stripe`); **login.html v9** lowercases client-side too. Verified all 9
  stored emails were already lowercase (matches every account, breaks none). _Immediate unblock: type email
  lowercase._ DEPLOY: login.html→Netlify, index.js→Vercel.
- **FORM-CONTROL STYLING — REVERTED to the proven native pattern (lesson learned).** I built a custom JS dropdown/
  date/time widget (member v300/v301, provider/admin v43, profile v35, signup v3). It replaced the native
  `<select>`/`<input>` with a `<button>`+panel that did NOT inherit each page's field CSS, so dropdowns rendered
  BLANK on every page (Grant deployed member v300 and hit it live). Per protocol (§0a REUSE RULE — reuse the proven
  pattern, don't invent), the widget was **fully removed** from all 5 pages. Dropdowns/date/time are now plain native
  fields styled by the existing CSS (`.ffp-select`, `select{}`, etc.) — exactly like every other field. Member
  dashboard is now **v302** (FFP_BUILD 302, native fields); the other 4 reverted to their prior versions (provider
  v42, admin v42, profile v34, signup v3). `assets/ffp-fields.js` is a dead tombstone (safe to delete). Member
  dashboard v299 also relabeled Log Activity "Time" → "Time Of Day" (kept). **RULE REINFORCED: a styled field = a
  native `<select>`/`<input>` + CSS. Do NOT build bespoke control widgets.**
- **Member dashboard v296** (FFP_BUILD 296): NAV refocused → **Passport · Connections · Meetups · Quests ·
  Challenges** (Events/Experiences tabs removed = Find Fit People marketplace; Check-in = the Scan QR button on
  the Passport home; Meetups split out of Connections into `#panel-meetups`). MEMBERSHIP GATE (v294: free/lapsed
  members → "Join Passport $99/yr" screen, fail-open, via `member_passport_active`; `JOIN_URL` (dashboard v320)
  → the LIVE Stripe Payment Link `https://buy.stripe.com/00w5kCgHcejw9c003F3Nm0s` — the SAME $99 checkout used
  at signup in login.html that paying members go through; Stripe collects email → `/api/onboard/from-stripe`
  upgrades them to passport). MY COLLECTION rebuilt (search + tap → flippable passport card + **Recommend**
  (`member_recommend_passport` → bell notification) + **Remove** (`member_connection_remove`)).
- **Provider dashboard v42** + profile loader v13: Passport-member **DISCOUNT** field
  (`providers.passport_discount_pct`; Business Details; blank = platform default 10%; booking reads it). Plus
  the image-storage wiring (logo/hero/listing covers → Storage).
- **Backend index.js v74** (Vercel, DEPLOY PENDING): **POST /api/notify/member** `{to_member_id,subject,heading,body}`
  (shared member email via Resend; Find Fit People calls it for booking confirmations + pairs with a
  `notifications` insert for the bell). NOTE the file header was stale at v70 — v71 (auth refresh), v72 (meetup
  approval emails), v73 (event RSVP emails) were already in the code; marker now reconciled to v74.
- **DB live:** membership model (`members.membership` default 'free' + `passport_expires_at`; `member_passport_active`
  gate); `providers.passport_discount_pct` + updated `provider_save_profile`; `member_connection_remove` +
  `member_recommend_passport`; **`platform_docs`** (canonical Integration Contract row `key='integration_contract'`,
  public read, `platform_doc_get`).
- **DEPLOY PENDING — Netlify:** member dashboard v296, provider dashboard v42, profile loader v13,
  `assets/ffp-image-upload.js`, `ffp-provider-venue-qr-loader.js?v=2`. **Vercel:** backend v74.
- See **FFP-INTEGRATION-CONTRACT.md** (synced mirror) + the `platform_docs` DB row for the Passport⇄FFP spec.

## 🟢 SESSION STATE — 2026-06-05 (image storage)
### IMAGE STORAGE STANDARDISATION — base64-in-DB → Supabase Storage (in progress)
- Shared uploader **assets/ffp-image-upload.js** = `window.FFPUpload` (pick / cropFile / uploadFile / uploadBlob): pick → optional crop (Cropper) → resize → Storage → returns public URL (+`?v=` cache-bust so re-uploads to a stable path actually refresh). **Owner id comes from the JWT `sub` (=auth.uid), NOT the record id** — the provider RECORD id ≠ the owner's auth id, which caused the storage 400. Referenced at **?v=6** by provider + member dashboards → bump `?v=` in BOTH when this file changes (manifest rule).
- Buckets (all public; owner-keyed RLS: folder = auth.uid, admin override): provider-logos, provider-heroes, event-covers, meetup-covers, experience-covers, **listing-covers** (all provider listing heroes). `avatars` (existing, flat `{id}.jpg`) unchanged.
- ✅ DONE: provider **logo+hero** (crop: logo 1:1, hero 16:9; provider dashboard `handleUpload('logo'|'hero')`); provider **listing covers** — events/experiences/challenges/deals/quests all share `handleUpload('listing:…')`+`#listing-photo-slot` → one fix → `listing-covers`; member **meetup cover** (`pmfPickCover` → `meetup-covers`).
- ✅ DONE: **profile-complete avatar** (v34) — photo is picked BEFORE the member exists, so onboard now sends `photo_url:null` and the avatar uploads to `avatars` AFTER onboard (member.id + JWT live → auth.uid passes RLS), reusing ffp-photo-upload.js's exact path + PUT `/api/members/:id`. NON-BLOCKING (a photo error never blocks signup). So ALL upload surfaces are now Storage-backed (feedback widget stays base64 by design, §6t).
- ✅ MIGRATION DONE (2026-06-05): ran server-side via a one-time secret-guarded edge function `ffp-migrate-base64` (service-role auto-injected — never handled the key client-side). Converted **all 12 remaining base64 rows** → Storage: members.photo_url ×5 → avatars/{id}.jpg; events ×3 + experiences ×2 → listing-covers/{owner}/…; meetups ×2 → meetup-covers/{host}/…. Verified: **0 base64 rows left** platform-wide, bytes present in Storage (avatars 7, listing-covers 5, meetup-covers 2). The function was then **decommissioned** (redeployed as an inert 410; delete it from the Supabase dashboard at leisure). `scripts/migrate-base64-images.mjs` kept as a local-run reference but no longer needed.
- VERSIONS: provider dashboard **v41**, member dashboard **v292** (FFP_BUILD 292). Also fixed: dead `<script>` ref to `ffp-provider-quest-analytics-loader.js` (file doesn't exist) removed; `ffp-provider-venue-qr-loader.js` (no `?v=` → was stale, still selected non-existent providers.passport_no = the console 400) now busted `?v=2`. **DEPLOY all together; assets/ffp-image-upload.js is a NEW file — it MUST be committed to the repo or it 404s → returns HTML → FFPUpload never loads → uploads break.**

## 🧭 PRODUCT BOUNDARY — TWO APPS, ONE CORE (LOCKED by Grant 2026-06-05)
Two products on ONE shared Supabase DB (members, providers, listings, stamps, payments, the 6 categories, Storage):
- **FFP Passport** (this member app) = identity / loyalty / social. Owns: passport + stamps, member-to-member
  (Connections/Matches + **Meetups / Meet & Move — PASSPORT ONLY, member-to-member, free**), venue **check-in**
  (collect stamps), Quests, Fitness stats, Earnings. Members do **NOT** book paid stuff here — they **link out to
  Find Fit People**, book there, then **check in with their Passport** to mark it + collect the stamp.
- **Find Fit People** (findfitpeople.netlify.app) = the **MARKETPLACE**: discover / book / pay — **Experiences**
  (classes/sessions/padel courts), **Trips** (retreats/camps/adventures), **Events**. Stripe/AED, partners keep 85%.
- **Events = provider/partner-created ONLY** → live on Find Fit People. NOT member-created. In Passport, events are
  read-only "what I've booked / checked into," never a browse-or-create surface.
- **ONE provider portal** (the provider dashboard) → evolving into a **FACILITY MANAGEMENT SYSTEM**: partners manage
  listings (sold on FFP), venue/QR check-ins, members, quests, hours — one place, serves both products. Don't split
  provider features across two apps.
- **CLEANUP for Passport:** strip the marketplace bleed (experiences/events/deals discovery+booking) out of the
  member app → replace with link-outs to Find Fit People; keep Passport focused on identity / connect / meetups /
  check-in / quests / fitness.

## 🔗 SHARED DOCS — canonical in the DB (2026-06-05)
The cross-project **Integration Contract** (Passport ⇄ Find Fit People) is stored canonically in the SHARED DB:
`platform_docs` row `key='integration_contract'` (public read; helper `platform_doc_get('integration_contract')`).
Both projects READ the DB row = one source, no drift. Passport MAINTAINS it — `FFP-INTEGRATION-CONTRACT.md` is the
editing surface; **on every contract change, re-run the `platform_docs` upsert so the DB row matches the file.**
`platform_docs` is admin-write / public-read. (FFP-MASTER stays Passport-internal; not shared.)

## 💳 MEMBERSHIP MODEL — ONE IDENTITY, TWO TIERS (LOCKED + APPLIED 2026-06-05)
$99/yr Passport is a **paid status on a shared account**, NOT a separate login. Find Fit People bookings are
open to anyone (free account via email+code, or guest checkout).
- `members.membership` text NOT NULL default **'free'** (check free|passport). Every booking-site signup is a
  free booker automatically.
- `members.passport_expires_at` timestamptz — the $99 buys 12 months. **Separate from `tier`/`tier_expires_at`**
  (that's the loyalty/ambassador tier — do NOT conflate).
- **CANONICAL GATE — both apps call this, never re-implement:** `member_passport_active(p_id uuid) -> bool` =
  `membership='passport' AND coalesce(passport_expires_at,'infinity') > now()`. SECURITY DEFINER, granted
  anon+authenticated. NULL expiry = active (fail-open, no accidental lockout). Verified live (Grant = true).
- Backfill done: **7 paid members → 'passport'** + expiry = created_at+1yr (all active); **2 → 'free'**.
- OWNERSHIP: **Passport project OWNS/WRITES these fields; Find Fit People only READS them** (one writer = no
  duplicate-column drift — the booking project flagged this risk and we agreed the split).
- DECISIONS (Grant + booking project): (1) bookers = free account (live on FFP) + guest checkout; (2) $99/yr =
  auto-renewing Stripe **subscription** (Passport build); (3) member perk = **10% discount at checkout** — lives
  on the BOOKING site, reads `membership`; (4) stamps stay members-only (the upgrade hook).
- STILL TO BUILD — **Passport side:** app GATING (login → free/lapsed user → "join/renew Passport" screen, not
  the full member app) via member_passport_active; the $99 Stripe subscription + expiry/renewal + reminders.
  **Booking side:** guest checkout + the 10% member-discount-at-checkout (reads membership).

## 🟢 SESSION STATE — 2026-06-04 (read this first when resuming / new chat)

### 📱 TODO on next touch — iOS input-zoom fix (per PAGE, not per loader)
iOS Safari auto-zooms the whole page when you focus an input with `font-size < 16px`. Fix = a page-level CSS
rule forcing inputs to 16px on mobile. **DONE on the member dashboard (v280):**
`@media (max-width:768px){ input,textarea,select,.pm-form-input,.pm-form-textarea,.ffp-select{font-size:16px!important;} }`
This rule is page-wide, so it ALSO covers every loader-injected form on the member dashboard — loaders need NO change.
**Still to add (drop the same block into each page's `<style>` on its next update):**
- [ ] `ffp-provider-dashboard.html` (covers all provider loaders' forms) — only if providers use it on mobile
- [ ] `ffp-admin-dashboard.html`
- [x] `login.html` — DONE: `.field-input` 15→16px (OTP `.code-digit` left at 24px). Page already had `maximum-scale=1`.
- [x] `ffp-profile-complete.html` — DONE: `.field-input,.field-select` 15→16px.
NOTE: don't blanket-force `input{font-size:16px}` where a field is intentionally LARGE (e.g. login's 24px OTP boxes) — that would shrink it. Bump only the sub-16px field classes, or exclude the large ones.
Caveat: a loader that sets input `font-size` with its OWN `!important` would override the page rule — fix that loader's value to 16px if so. Otherwise no loader edits needed.


**ALL FILES DEPLOYED + LIVE as of 2026-06-04** (Grant confirmed pushed; Netlify + Vercel). Current live versions (verified 2026-06-04: backend path-route live, admin footer "build v41", member features present):
- 🤝 **MEETUP REQUEST→HOST APPROVAL (2026-06-04, built — DEPLOY PENDING)** — see FFP-SCOPE-meetup-approval.md. Fixes the bug where joining a meetup auto-confirmed + emailed instantly (no host step).
  - **DB (live now)**: `meetup_attendees` status check now allows **`pending`**; `join_meetup` inserts `pending` (was `joined`) + notifies the host; new **`host_approve_attendee(p_host,p_meetup,p_member)`** (host-check, capacity = approved+host < max, set `joined`, notify member). Verified live: request→pending(+host notif), non-host→forbidden, approve→joined(+member notif), re-approve→already, test rows cleaned.
  - **backend index.js v72** (Vercel): `/api/meetups/notify` new **`kind='request'`** emails the HOST (`sendMeetupRequestEmail`); `kind='confirm'` now fired on APPROVAL, not on join.
  - **meet-move loader v24** (Netlify): `requestJoin` → pending + host `request` email (no auto-confirm); fetches member's pending (`pendingByMe`) + host pending queue (`pendingRequests`); host detail modal shows **"Requests to join (N)"** with Approve → `host_approve_attendee` → member `confirm` email. node-checked.
  - **member dashboard v278** (FFP_BUILD→278): amber **"Requested"** card badge + disabled "Requested ✓ — awaiting host" detail button.
  - **DEPLOY**: DB already live → Vercel (index.js) → Netlify (loader + dashboard). Rollback = deploy history.
  - ✅ Follow-ups BUILT (dashboard v279 + loader v24, DEPLOY PENDING): (a) **attendee cancel** — `leave_meetup(p_me,p_meetup)` RPC (cancel anytime BEFORE start → frees a spot; 'started' guard) + "Cancel my spot"/"Cancel request" button in detail; dropped the "12h" promise. Tested live (future→left, past→started, Grant's RSVP restored). (b) **host meetup photo** — `meetups.cover_url` column + host_meetup/update_meetup pass it through; photo field in the post/edit form (downscaled ≤1200px JPEG data-URL via pmfPickCover) → loader shows `img = cover_url || category image`. All new JS node-checked. DEPLOY: DB live → Netlify (dashboard v279 + loader). NOTE: cover stored as data-URL per "how our site stores images" (Storage migration still a future task).
- 🔐 **KEEP-MEMBERS-SIGNED-IN (2026-06-04, built — DEPLOY PENDING)** — see FFP-SCOPE-keep-signed-in.md.
  - **assets/ffp-api-integration.js v12**: ONE Supabase client (dynamic per-request JWT header → kills the `Multiple GoTrueClient` warning, refreshed JWT applies instantly); "Keep me signed in" storage toggle (localStorage=persist / sessionStorage=session-only); silent `refreshSession()` on boot + once on 401 (fail-safe — a refresh miss never logs anyone out). Validated: full-file node --check CLEAN + storage behaviour tested (existing localStorage sessions are NOT logged out by the upgrade).
  - **backend index.js v71** (Vercel): access JWT 30d→**7d**; new `mintRefreshToken`/`verifyRefreshToken` (HMAC, 365d, stateless — same pattern as provider token); signin + onboard return `refresh`; **new `POST /api/auth/refresh`** (verify refresh → re-mint jwt+refresh; requires member active). Refresh logic unit-tested (roundtrip/tamper/forge/expiry/garbage all correct).
  - **login.html**: "Keep me signed in on this device" checkbox (default ON) → `FFPAuth.setPersist()` before tokens are stored.
  - **Cache-bust**: all 5 pages now load `ffp-api-integration.js?v=12` (login, member v277, provider, admin, profile-complete) — was un-busted.
  - **Verified no breakage**: NO code anywhere uses GoTrue sessions (`signInWithPassword`/`setSession` absent project-wide); all `supabase.auth.getUser/getSession` calls already fell back to FFPAuth, so `persistSession:false` changes nothing for them. Admin + provider auth don't touch `supabase.auth`.
  - **DEPLOY ORDER**: Vercel (index.js) first, then Netlify (the 5 HTML + ffp-api-integration.js). Client refresh is fail-safe so order isn't fragile. Rollback = Netlify/Vercel deploy history.
- ffp-member-dashboard.html **v277** (FFP_BUILD=276; loads ffp-api-integration.js?v=12) · assets/ffp-meet-move-loader.js **v23** · ffp-member-checkin-loader.js **v7** (ref ?v=7)
  - v276 + loader v23: FIX Discover "No meetups match those filters". Console truth: the deployed meet-move LOADER (`?v=275`) threw `SyntaxError: Unexpected identifier 'the' (line 2)` → never ran → MeetMove.data empty. DB/RLS/filter/container all verified fine; only the loader failed to parse. Republished clean loader v23 + bumped FFP_BUILD→276 so browsers fetch `?v=276` fresh. **⚠️ MUST DEPLOY BOTH dashboard v276 AND assets/ffp-meet-move-loader.js — deploying only the dashboard re-fetches the same broken loader.** See FFP-ISSUES-LOG #8. (Note: sandbox mount has a hard ~32KB file-read cap → can't node-check large files there; verified via partial-parse + file-tool tail read.)
  - v275: 🔴 CRITICAL FIX — the WHOLE dashboard was dead ("not responding"). Console truth: `Uncaught SyntaxError: Identifier '_nowTs' has already been declared (line 12577)`. The v273 Past-tab edit added `const _nowTs` at the top of MeetMove.filtered() while the Discover branch already had `var _nowTs` — duplicate declaration = parse error = entire `<script>` dead (so v274 never even ran). Fix: Discover reuses the top-level `_nowTs`. Verified: node --check of the full visible script body = clean; all added identifiers unique. **See FFP-ISSUES-LOG #7. Rollback safety net = Netlify "Publish deploy" on the last good deploy.**
  - v274: FIX passport panel FROZEN / "not responding" on refresh (FFP-ISSUES-LOG #6). Root cause: prerenderPassportShare() runs html2canvas (heavily synchronous) and was auto-fired EAGERLY on load (1.5s) + every panel-show (450ms) → blocked the main thread 1-3s right after refresh on the default passport panel. Now deferred via requestIdleCallback (schedulePassportPrerender) so it never blocks first paint/interaction; coalesces to one; re-arms after share. html2canvas scale 2→1.5. **DEPLOY RULE: bump FFP_BUILD.**
  - v273: Meet & Move PAST tab (was hard-coded `items=[]`) now shows your past meetups (joined or hosted); Going/Hosting are UPCOMING-only (past ones move to Past, clean split, no overlap). Discover already shows only upcoming. NOTE: 2 upcoming meetups exist (Town Square Loop, Morning run) — if Discover is empty for the user they're not yet on v271 (country filter) + v272 (loader cache-bust).
  - v272: PERMANENT FIX for lazy loaders disappearing after deploys (FFP-ISSUES-LOG #5). All panel loaders now share ONE cache-bust **FFP_BUILD** (= the dashboard build number; bump together) — no per-loader ?v=N drift, no un-busted loaders. ensurePanelLoader RETRIES on failure (3x backoff) + marks done only on onload. **⚠️ DEPLOY RULE: bump FFP_BUILD (in setupPanelNav) every deploy — it cache-busts every lazy loader.** This removes the per-loader ?v refs (earnings/fitness/meet) from _panelLoaderSrc.
  - v271: (a) FIX RECURRING "no meetups on Discover" — the Discover country filter checked m.city against FFP_TAX.cities[country] (hid ALL meetups when taxonomy unhydrated or city missing from list). Now matches on m.country directly. (b) FIX day-streak: daysAgo now CALENDAR-day diff (was elapsed-hours → same day split into 2 buckets); streak no longer resets when today isn't logged yet (today-grace). **NEW: FFP-ISSUES-LOG.md** — running record of prod bugs + root cause + fix; review before changing shared surfaces.
  - v270: REAL FIX for passport card HUGE on refresh — root cause was prerenderPassportShare() (the iOS share pre-render, added v256) setting the LIVE .pass-shell transform to 'none' for the html2canvas capture → on-screen card flashed full 540px for 1-3s on every panel-show/load. Now renders an OFFSCREEN CLONE; visible card never touched. (v269's ResizeObserver re-scale kept as backup.) Plus Connections panel: My Collection card DARK GREEN; create-quest + collection modals padded (.cv-wrap/.qcreate); host-CTA card replaced with a single full-width yellow "Post a Meetup" button.
  - v269: (a) FIX passport card huge-on-refresh — scalePassportCard ran on fixed timeouts before layout settled (measured container too wide); now a ResizeObserver re-scales when the container reaches its real width (+ double-rAF, 0-width guard). (b) CONNECTIONS panel redesign: two entry cards **Matches** (People you might click with) + **My Collection (N)** (new CollectionView modal — lists collected passports from member_connections_list, tagged Connected/Added, tap → openMemberDetail), Post-a-Meetup CTA stays standalone below. collection-count badge updated in loadConnectionsCount.
  - v268 + DB: passport stat fixes. **Connections** (was 0): member_connections_count/list now use COLLECTION semantics — `(requester=me, not rejected) OR (addressee=me AND accepted)` — so it grows when you add someone (was accepted-only). DB-ONLY (RPCs live now, no deploy needed). **Meets** (was always 0): the /api/members/:id/meetups-attended endpoint loadMeets() fetched NEVER EXISTED → built `member_meets(p_me)` RPC (a Meet = completed [meets_at<now] + not cancelled + >=2 people [host + joined] + you hosted/joined); loadMeets() now calls it (needs dashboard deploy). Verified: Grant conns 3, meets 0 (no qualifying meet yet); synthetic completed 2-person meet → both host+joiner get +1.
  - v267 + meet-move loader **v22** (ref ?v=22): FIX Who's-going host/attendee passports invisible to NON-ADMIN members. **Root cause:** members RLS = `(auth.uid()=id) OR is_admin()` (self/admin only); the loader fetched host+attendee profiles via direct `from('members').select` → regular members got nothing (admins saw everyone, masking it). Now via new **members_cards(p_ids uuid[])** SECURITY DEFINER RPC (public passport fields only — no email/phone/dob; mirrors get_match_pool). Verified RPC returns host+attendee with photos. ⚠️ Other direct member fetches by non-admins would have the same RLS issue — watch for it.
  - v266: FIX (§3c resolved) Who's-going OWN passport card showed no details. FFPCard.resolve routed self → fromProfile() and discarded the loader-fetched attendee row, so an un-hydrated MemberProfile.data blanked the card. resolve now MERGES (prefers profile/cache non-empty fields, falls back to the passed row) via FFPCard._merge — no card renders blank when data exists anywhere. Reconciles the who's-going count too (own card renders → 2/8). Dashboard-only. Verified blank-profile self-resolve now returns real data.
  - v265: Meet & Move Discover hides PAST meetups (filters MeetMove.filtered() discover branch on m._ts >= now-3h grace; Discover had no date check so open meetups lingered forever). Dashboard-only. Follow-up: daily cron to mark past 'open' meetups 'ended' + populate the empty Past tab. · assets/ffp-earnings-loader.js **v18** (lazy ref ?v=18) · assets/ffp-feedback-widget.js **v5** (member+provider ref ?v=5)
  - v263: FIX passport-holder PHOTO missing on matches deck + who's-going. ROOT CAUSE (not patchwork): FFPPassportCard.frontShell (the ONE canonical card, used by both surfaces) built the photo div as `style='...url('...')...'` — single-quoted style attr + single-quoted url() → the quote after `url(` closed the attribute early so background-image never applied (any photo). Fixed by double-quoting the style attribute. Verified rendered HTML now contains the full image URL inside the attribute. Likely also helps §3c (who's-going own-card). ⚠️ FOLLOW-UP: photos are ~140KB base64 data: URLs in members.photo_url; get_match_pool ships them inline (80 rows → multi-MB; will fail at scale) — migrate to Supabase Storage + short public URLs.
  - v262 (P2b member-created quests UI): "Create your own quest" button + form (title/category/optional activity/country+city/target) → member_save_quest; quest detail join box (join count + Join → member_quest_join). Check-in loader v7 (ref bumped ?v=6→?v=7): after a verified check-in calls member_quest_progress_checkin to auto-advance joined quests + surfaces "explorer badge earned". Needs backend v70 (joined_count). DEPLOY together: member v262 + checkin loader v7 (Netlify) + backend v70 (Vercel). Verified end-to-end (engine + UI RPC payloads incl. rule_activity).
  - v261: quest detail shows provider's prize (prize_text) — pairs with backend v69 (member quest discovery endpoints) so the member Quests panel loads quests (incl. provider venue quests) for the FIRST time. v260: Challenges moved from bottom nav → avatar menu. v259: Log Activity duration is a SINGLE-TAP H/M/S wheel (window.FFPDurationPicker, reusable) — replaced v257's 3 number boxes per Grant ("single tap, platform standard, same across the platform"). Still stores duration_min + duration_sec.
  - ⚠️ DEPLOY PENDING (built 2026-06-04, push → Netlify): ffp-member-dashboard.html **v258** + assets/ffp-earnings-loader.js **v18**. Cumulative v255→v258: v255 passport-card share copy; v256 iOS share fix (pre-render image → instant navigator.share within user activation); v257 Log Activity duration = Hours/Minutes/Seconds inputs (was a clock picker; removed unused time-of-day field) + profile phone country-code picker full-bleed, UAE-first, defaults to +971; **v258 = #28 step 4** — earnings-loader **v18** (lazy ref bumped ?v=17→**?v=18**): 'quoted' payout row shows the admin's quote (local amount/net/fee/rate) + Accept (member_accept_payout) / Cancel (member_cancel_payout); both payout row renderers now share buildPayoutRow(). v257 also needs **backend index.js v68** (duration_sec in activity-logs) + the DB migration (already applied).
- ffp-admin-dashboard.html **v42** (lazy-loader cache-bust **v=47**; footer "build v42") · ffp-admin-payouts-loader.js **v9** · ffp-admin-referrals-loader.js **v4**
  - ⚠️ DEPLOY PENDING (built 2026-06-04, not yet pushed → Netlify): admin-dashboard **v42** + ffp-admin-payouts-loader.js **v9** (cache-bust **v=47**) = #28 step 3 payout QUOTE UI. The supporting RPCs were already live and were re-verified end-to-end this session (quote→quoted with fields set; reject→rejected + hold txn deleted; bad_status guard). Until pushed, the served admin build stays v41.
- assets/ffp-meet-move-loader.js **v22** (lazy ref ?v=22) · ffp-provider-dashboard.html **v30** (feedback ref ?v=5) + **ffp-provider-quest-create-loader.js v1** (ref ?v=1)
  - v21 FIX (2026-06-04): member-hosted meetups never showed on the Meet & Move **Discover** tab. The mapped meetup carried `area: m.city` but NOT `city`; MeetMove.filtered() filters by `m.city`, and with the location filter defaulting to country=UAE, `cc.indexOf(undefined)` excluded EVERY meetup on Discover (host only saw their own via Hosting/Joined; "All countries" was an accidental workaround). Now maps `city`+`country`. Verified. Deploy: meet-move loader v21 + member dashboard v264 (ref ?v=21).
  - ⚠️ DEPLOY PENDING (built 2026-06-04 → Netlify): ffp-provider-dashboard.html **v30** + ffp-provider-quest-create-loader.js **v1** = #quests P1 provider create-quest UI ("Your quests" card at top of the Quests panel: create/edit/pause → provider_save_quest). DB already live + verified.
- backend index.js **v70** (⚠️ DEPLOY PENDING → Vercel; live is v67) + vercel.json (crons: sunday-summary, meetup-reminders). v70 = /api/quests + /api/quests/:id also return **joined_count** (member-quest social hook). v69 = **MEMBER QUEST DISCOVERY**: GET /api/quests + GET /api/quests/:id (never existed before; members saw NO quests). v68 = activity-logs returns duration_sec. v67 verified live.
- (stable, earlier) ffp-taxonomy.js v7, ffp-profile-complete.html v32, ffp-admin-auth.js v7, admin loaders, checkin loader v6, passport cover PNGs, public.foods.
- ENV required on Vercel: **SUPABASE_JWT_SECRET** (auth/RLS — §1), **CRON_SECRET** (crons). Sub-daily crons need Vercel Pro.
- LIVE DB (no deploy): notifications system (table + create_notification/member_notifications/seen-via members.notifs_seen_at), #2 handle_connection + #3 host_meetup notification triggers, admin_verify/invalidate/leaderboard referral RPCs, payout workflow RPCs (admin_quote_payout / member_accept_payout / member_cancel_payout / admin_reject_payout) + payouts schema (§1d). USD-only wallet (§1c). **NEW 2026-06-04:** activity_logs.duration_sec (smallint 0-59) + log_activity RPC now 9-arg (added p_duration_sec; old 8-arg dropped) — Log Activity stores H/M/S; verified (90min/45s) then cleaned.
- **PROVIDER QUESTS P1 — DB LIVE (2026-06-04):** `quests` + `provider_id`, `owner_type` (default 'admin'), `prize_text`; quest `scope` check now allows **'venue'**. New RPC **`provider_save_quest(p_provider, p_id, p jsonb)`** (SECURITY DEFINER, trusts p_provider like provider_save_listing, granted anon+authenticated): creates a venue stamp (stamps = name+icon+color; default icon 'storefront', color '#2BA8E0'), inserts the quest (scope='venue', owner_type='provider', status='live' = quick-launch, require_distinct_venues=false, target_count 1-50, category lowercased to the allowed set fitness/sports/wellness/recovery/adventure/food), links it via `quest_venues`. Completion unchanged: member_quest_submit → provider_quest_approve → member_stamps. **Verified end-to-end live** (create→submit→approve→stamp awarded + progress 'completed') then cleaned. ✅ **Provider create-quest UI BUILT** (ffp-provider-quest-create-loader.js v1 + provider dashboard v30, deploy pending): "Your quests" card at top of #panel-quests with Create/Edit/Pause; create→live, pause='draft', remove='ended'. Verified RPC edit + pause + stamp-name sync + wrong-provider→null. ✅ **Member discovery DONE** (backend v69 /api/quests + /api/quests/:id; member v261 shows prize_text). ✅ **QR→signup→join at venue: ALREADY WIRED (verified 2026-06-04, no build needed)** — `venue_active_programs(p_provider)` already returns the provider's live quests via quest_venues, so scanning the venue QR shows a "Quest" button → member_quest_submit; the dashboard head-script stashes ?venue= → login.html signup → returns to dashboard → checkin boot() resumes the venue. Provider quests flow through this automatically. ✅ **P2 member-quest ENGINE — DB LIVE + verified (2026-06-04):** quests + `visibility`, `eligibility` ('venues'|'rule'), `rule_activity`. RPCs (SECURITY DEFINER, anon+authenticated): **`member_save_quest(p_me,p_id,p)`** (rule-based exploration quest: owner_type='member', scope='city', eligibility='rule', require_distinct_venues=true, creates an EXPLORER stamp [icon 'explore', color '#a855f7'], creator auto-joins); **`member_quest_join(p_me,p_quest)`** (progress row + returns join count); **`member_quest_progress_checkin(p_me,p_provider)`** (auto-counts the member's joined rule-quests on a VERIFIED venue check-in — match = city + optional rule_activity in providers.activities, country lenient when provider.country null; distinct venues via quest_checkins; awards badge at target — NO provider approval). Verified end-to-end (create→2 distinct check-ins→badge; dup check-in idempotent; join count=2) then cleaned. ⬜ NEXT (P2b): member UI — "Create a quest" form (activity+city rule) + Join button + join counts + my-quests; hook member_quest_progress_checkin into the check-in loader after a verified check-in; surface join count in /api/quests. Optional: venue-aware welcome on signup screen.
- ⬜ REMAINING: #28 — ✅ step 3 admin quote+reject UI BUILT; ✅ step 4 member Accept/Cancel UI BUILT (both deploy-pending, above); ⬜ step 5 the 4 payout emails (request confirm, quote→member, completed, cancelled/refunded) (§1d). Plus: broadcast email-send + audience targeting; #3 sport/city match-filter; rank-up notifications.
- 📄 See **FFP-DEV-RETROSPECTIVE.md** — root-cause analysis of recurring mistakes + the correct-build playbook/checklist (read before making changes).

KEY LIVE THIS SESSION (2026-06-03→04): mintSupabaseJwt → signin/onboard return a real Supabase JWT so auth.uid() resolves (§1, fixed admin + member RLS). USD-ONLY wallet — transactions/referrals/payouts/members/content_submissions `*_aed` columns now HOLD USD (values converted once; no peg/conversion in code anywhere; §1c). Referral AUTO-credit on paid signup = **tier% × actual amount paid** (Stripe amount_total, after discount), not list price; admin Referrals = record + Invalid clawback. RPCs live: admin_verify_referral, admin_invalidate_referral, admin_referral_leaderboard. Meet & Move emails (confirm/cancel event-driven, reminder cron; meetup_attendees.reminder_sent_at). Grant = members.role super_admin + admin_users row.

### 🔧 NEW BUILD QUEUE — Grant 2026-06-04 (RULES: deep structure check + ALL related files FIRST; no guessing; work from CURRENT LIVE files; NO patching — rewrite correctly)
1. **Feedback widget not opening (member dashboard)** — ffp-feedback-widget.js v4; window.FFPFeedback.open() invoked by topbar button. Find the real cause (build() defines FFPFeedback at its END — anything throwing earlier leaves it undefined → silent no-op). Fix at root.
2. **Notify holder when someone adds their passport to a collection** — NOTE: no "passport collection" table/feature exists yet (verified) — scope the collect feature OR clarify what "collection" means before building the notification.
3. **Notify followers/connections when a holder posts a MATCHING meet-up** — connections exist (handle_connection, member_connections_list); no "followers" table — confirm followers == connections. Match = same sport/city/etc.
4. **Admin Broadcast Center** — compose + send email AND in-app notification to targeted audience (status/tier/city/active). (= tasks #29 notifications-system, #30 broadcast.)
PROGRESS 2026-06-04: ✅ Step 1 backend notif endpoints (index.js **v65**: GET /api/notifications, POST /seen, POST /api/admin/broadcast; members.notifs_seen_at col). ✅ #2 handle_connection notifies the holder ("X added your passport"). ✅ #3 host_meetup notifies followers ("X is hosting…"). All LIVE on Supabase + verified with real records then cleaned. ✅ #4 admin Broadcast Center built — ffp-admin-dashboard **v40** (new "Broadcast" sidebar item + panel-broadcast → AdminBroadcast.send() → POST /api/admin/broadcast). NOTIFICATIONS FEATURE SET COMPLETE (in-app). ⚠️ DEPLOY: index.js **v65** → Vercel (endpoints; bell + broadcast need it) and ffp-admin-dashboard.html **v40** → Netlify. Remaining future: email send + audience targeting on broadcast; sport/city match-filter on #3; rank-up notifications.

NOTIFICATIONS — ACCURATE STRUCTURE (checked 2026-06-04, corrects an earlier wrong "no system" note):
- `public.notifications` TABLE EXISTS: id, audience (default 'all'), member_id (NULL = broadcast to everyone), title, body, icon (default 'campaign'), link, created_at. RLS: read where member_id=auth.uid() OR member_id IS NULL OR is_admin(); admin write (is_admin). **No read_at / type / data columns.**
- MEMBER BELL UI EXISTS (ffp-member-dashboard ~line 7695-7771): fetches `FFP_API_NOTIF (=ffp-passport-backend.vercel.app)/api/notifications` (expects {notifications:[], unread:N}) + POSTs `/api/notifications/seen`. Renders icon/title/body/time + a badge. Also merges in-app review prompts.
- **GAP: backend index.js (v64) has NO /api/notifications or /seen route** → the bell's fetch 404s (caught) → only review prompts show. So the system is HALF-built: table + bell exist, backend endpoints missing, and nothing inserts targeted rows.
- FOLLOW model = "Add passport" in Matches deck → `handle_connection` RPC (persists the connection). connectViaRpc already TOASTS "you'll be notified when they host a meet & move" — promise currently undelivered.
BUILD PLAN (proper, in order): (1) backend GET /api/notifications?member_id (broadcast + targeted + unread via a members.notifs_seen_at or per-member seen) + POST /api/notifications/seen + POST /api/admin/broadcast; add read/seen tracking column. (2) #2 — handle_connection inserts a targeted notification to the added member ("X added your passport"). (3) #3 — host_meetup inserts targeted notifications to the host's followers/connections on a matching meet-up. (4) #2-future — rank-up notifications. (5) #4 — admin Broadcast Center UI → /api/admin/broadcast (in-app row + optional email to audience). (6) passport "collection" = the existing follow; no new table needed unless a separate favourites list is wanted.

PROVIDER REVIEW → PROVIDER RANKINGS — ✅ BUILT 2026-06-03 (see full spec §6v):
✅ DECISIONS CONFIRMED by Grant ("go with your rec"): 1(a) IN-APP card on next visit for check-ins >1h old & unreviewed (no email/cron); 2(a) Overall + Experience + Service + Facilities stars + comment (Overall drives ranking); 3 ALL three surfaces — provider dashboard, member-facing discovery (public stars + sort by rating), admin leaderboard.
✅ DONE: table public.provider_reviews (LIVE). All 5 RPCs LIVE + tested: submit_provider_review, member_pending_reviews, provider_rating, provider_reviews_list, provider_rankings (admin, now also returns category). Member UI (v236): prompt card + star modal. Provider UI (v28): "Your rating" block. Admin UI (v31): Provider Rankings leaderboard tab + Country/City/Category filters.
⬜ STILL TODO (Grant, 2026-06-03): MEMBER-FACING DISCOVERY (public stars + sort by rating) — DEFERRED: there is no member-facing provider directory in the app yet, so there's nothing to attach public stars to. provider_rating() is live + public + ready to plug in once that surface is designed. (Grant: "more thought needs to go into how providers are discoverable… a to-do later.") Possible future: show a provider their RANK vs others inside the provider dashboard (would need to expose a non-admin ranking RPC).
--- original spec ---
Spec (Grant): ~1 hour after a member checks in to a facility, they get a "review your session" prompt — rate out of 5 stars across Experience, Service, Facilities, plus a comment. Reviews feed PROVIDER RANKINGS.
OPEN QUESTIONS to confirm before building (the AskUserQuestion tool kept failing — ask in plain text):
  1. Prompt delivery: (a) in-app card on next visit for check-ins >1h old & unreviewed [recommended, no new infra]; (b) email ~1h after [needs email+cron pipeline]; (c) both.
  2. Rating fields: (a) Overall + Experience/Service/Facilities stars + comment [matches spec]; (b) 3 categories only, Overall = their average; (c) single overall star + comment.
  3. Where ratings/rankings show (multi): provider dashboard (own rating + comments); member-facing discovery (public stars + sort by rating); admin leaderboard (ranking table + moderate).
Likely build once decided: new `provider_reviews` table (member_id, provider_id, activity_log_id, stars_overall/experience/service/facilities, comment, created_at) + submit RPC + "pending reviews" RPC (check-ins ≥1h old w/o review) + member prompt UI + provider/admin rating displays. Tie rating to a real check-in (activity_logs row) to keep reviews honest.


## ⚠️ 0-CRITICAL — TOOL TRAP THAT CAUSED THE "works then breaks" LOOP (2026-06-01)
The Edit/Write/Read FILE TOOLS and the bash shell see DIFFERENT copies of workspace files. **The file that actually persists + deploys is the one the FILE TOOLS write.** A bash `python open(w)` write or `node --check` runs on a SEPARATE sandbox copy and can show "OK" while the real file is unchanged/broken — this is why repairs seemed to land then "break."
RULE: edit workspace files ONLY with Edit/Write; verify by re-reading with the Read tool. Use bash `node --check` only as a secondary signal, never as the source of truth. (Confirmed: events loader was COMPLETE via Read tool while bash showed it truncated.)
- 2026-06-01 reconfirmed: bash's mount serves a TRUNCATED copy of the larger provider loaders (e.g. challenges loader cut at ~line 358 mid-statement) even though the canonical file-tool/Read view is complete & ends with `})();`. So `node --check` via bash is UNRELIABLE for ffp-provider-*-loader.js — validate their structure by reading the head + tail with the Read tool instead. The Read/Write view is what the user deploys.

### LIVE DB FIXES (no upload needed)
- 2026-06-01: `activity_types` RLS only allowed `authenticated`; provider session reads as `anon` → activity picker empty ("No matches", 379 placeholder). FIXED: added policy `activity_types_anon_read` (SELECT TO anon USING active=true). anon now sees 379. Provider New-event activity picker works on reload.
- 2026-06-01: EVENTS NOT SAVING root cause (from postgres logs): `events_fitness_level_check` only allowed Beginner/Intermediate/Advanced/Elite/Professional/All, but the form sends FFP taxonomy levels (Not Tried/Social/Competitive/Representative/Professional) → 400 on provider_save_listing. FIXED: widened the check to accept BOTH vocabularies + NULL. Verified insert with 'Social' succeeds. (LEVEL VOCAB still split 3 ways across forms — to unify in the rebuild.) Also seen in logs: `column providers.passport_no does not exist` — some provider query selects a non-existent column (separate console error, investigate later).

## 0. OPERATING PROTOCOL (every change)
0. **UNDERSTAND THE FULL STRUCTURE BEFORE FIXING (Grant, 2026-06-03).** Before touching anything, map the WHOLE chain for the feature: the dashboard HTML + EVERY loader it pulls (panels are loaded by separate `assets/ffp-*-loader.js` files — a panel can look "empty" because of its loader, not the HTML) + the backend route + the RPC/RLS + the auth/JWT path end-to-end. When two+ things show "no data," find the ONE shared invariant first (e.g. "does `auth.uid()` actually resolve in the browser?") instead of patching each symptom. Do NOT trust code comments that assert something works — verify the runtime contract (e.g. that signin actually returns a `jwt`). The v57 auth bug + multi-round earnings/admin debug happened because symptoms were patched before the shared root cause (no JWT issued → auth.uid() null) was found. (See §1.)
1. READ the real file before editing. 2. CROSS-REFERENCE the loader(s) for any panel touched. 3. VERIFY, don't claim (read code / query DB / `node --check`). 4. No blind patching. 5. Validate: extract inline JS → `node --check`; 0 NUL bytes; unique string match on edits. 6. Deploy: present file + bump the version stamp; large files UPLOAD, never paste (paste truncates). 7. State the checks done in each reply.

### 0a-1. FFPPicker is now DASHBOARD-OWNED (decoupled, 2026-06-01)
The activity/country/city picker (`window.FFPPicker`) is defined in an inline `<script>` in ffp-provider-dashboard.html (build v25, before the loader script tags). Events + Challenges activity pickers use it and NO LONGER depend on the experiences loader being deployed/correct. The experiences loader still defines its own FFPPicker (harmless redundant overwrite when it's the correct file). Dashboard deploys reliably → activity picker always works. (Was the cause of repeated "Activity picker not ready".)

### 0a. THE REUSE RULE (confirmed by Grant 2026-06-01 — keep as protocol)
If a similar component already WORKS somewhere, rebuild the broken one on that exact same system — do NOT patch the broken one with parallel/legacy code or media-query hacks. Same modal mechanics, same classes, same render path.
- Win: Log Activity modal was full-screen-broken on the legacy `.modal` + media-query patch. Rebuilt on Post-a-Meetup's `.detail-backdrop`/`.detail-modal`/`.pm-form` system (shared `#…-backdrop` full-screen rule) → worked first try (v207).
- Corollary: render content as a BUILT-IN part of the component, not injected cross-file via setTimeout (fragile, silently vanishes). E.g. "Who's going" moved from a loader setTimeout-injection to an inline section in the modal body (v208).

### 0b. MEET & MOVE — "Who's going" MUST always show the HOST, listed FIRST (committed per Grant, repeatedly)
The meetup detail modal's "Who's going" list ALWAYS includes the host as the first person, so members can see everyone attending. Do not let this depend on the loader having put the host into `m.attendees`. `MeetMove.whosGoingInline(m)` guarantees it: if no entry has `isHost`, it prepends a host entry built from the meetup's own fields (`m.host`, `m.host_member_id`, etc.); if a host entry exists but isn't first, it's moved to first. Host badged "HOST". (v209)

## 1. THE auth.uid() TRAP — ROOT CAUSE FOUND + FIXED (backend v57, 2026-06-03)
**The real story (corrected — earlier notes here were WRONG and cost a multi-round debug):**
`auth.uid()` did **not** resolve client-side for ANYONE — members, providers, OR admins — because **the backend never sent the client a JWT.** `/api/auth/signin` returned `{token, member}` with **no `jwt` field**, so `ffp-api-integration.js` (which only applies a session `if (res.jwt)`) left `window.supabase` running as pure **anon** for every user. The `ffp_jwt`/`applySupabaseSession()` machinery was fully built on the client but the server half was never finished. Several files *asserted* the JWT was applied (api-integration "Supabase-compatible HS256 JWT for RLS auth.uid()"; earnings loader v11 "client already carries the JWT") — those comments were aspirational, not true. The honest signal was the feedback widget's SECURITY DEFINER workaround ("custom-JWT members don't resolve auth.uid()").
- Symptom: any `supabase.from(x)` read/insert/update/delete gated by RLS like `(... = auth.uid())` silently returns/affects **0 rows, no error**. This is why **admin dashboard panels AND the member earnings panel** (balance/transactions/referrals/payouts, all RLS table reads) were blank — same single root cause.
- §6p was "verified" only by manually `set_config`'ing `request.jwt.claims` in a SQL test — that simulated the claim, it never proved the *browser* sends a valid JWT. Don't verify a runtime contract with a SQL simulation.

**THE FIX (v57):** `/api/auth/signin` and `/api/onboard/from-stripe` now return `jwt: mintSupabaseJwt(member)` — a real HS256 token signed with the project JWT secret (`sub=member.id`, `role`/`aud`='authenticated', 30-day exp). The anon key is HS256, so the project validates HS256 against the legacy JWT secret → `auth.uid()` now resolves to `member.id` in RLS for everyone. **Requires Vercel env `SUPABASE_JWT_SECRET`** (Supabase → Settings → API → JWT Secret). Missing env → `mintSupabaseJwt()` returns null = safe no-op. After deploy, users must do a clean sign-out + sign-in to mint the token. **Verified live: admin dashboard populated 2026-06-03.**
- ADMIN identity must align: the member's `id` must exist in `admin_users` AND `members.role` ∈ admin/super_admin. (Grant: members.role='super_admin' + admin_users row added 2026-06-03.) `is_admin()` = `exists(admin_users where id=auth.uid())`.
- **FIX PATTERN (still valid for anon-safe RPCs):** a SECURITY DEFINER RPC taking the id explicitly (member id from `FFPAuth.getMember().id`, provider id from `FFP_PROVIDER.id`), `GRANT EXECUTE TO anon, authenticated`. Now that auth.uid() resolves, new code can rely on RLS directly, but the RPC pattern remains the most robust.

### RPCs live in DB
Member: `get_match_pool(p_me)`, `handle_connection`, `log_activity`, `host_meetup`, `join_meetup`, `rsvp_event`, `apply_experience`, `submit_feedback`.
Provider: `provider_delete_listing(p_kind,p_provider,p_id)` — delete confirmed working.

## 1c. REFERRAL + EARNINGS MODEL — LOCKED (Grant, 2026-06-03)
- **Currency:** the PLATFORM displays in **USD** everywhere (balance, earnings log, referral rewards, admin reward column, payout minimum). Stored money columns are still `*_aed`; convert at the boundary (aedToUsd for display, usdToAed when writing). ONLY payouts are shown/disbursed in the member's **local currency** (AED for UAE) — the payout list/records stay AED. Peg 3.6725.
- **Referral crediting = AUTOMATED, not admin-gated** (Grant: "I want things automated, not waiting for admin"). On a CONFIRMED paid signup via a referral link, backend `/api/onboard/from-stripe` (v61) sets the referral `paid`, inserts an `in` wallet transaction (category 'referrals', status 'paid'), and emails the holder "new referral — +$X added — balance $Y · payout at $250". Reward = tier% (5/10/20) × $99 membership.
- **Balance** = sum(`in`.paid) − sum(`out` in paid/pending). Payout writes an `out` row on execution. Min payout **$250 USD**.
- **Admin Referrals panel** = a record + an **Invalid (claw back)** action (`admin_invalidate_referral` removes the credit). `admin_verify_referral` still exists for any edge 'pending' row but the normal path is auto-credit. (History: v59 auto-credited but I'd NOT checked the admin verify panel first; v60 reverted to admin-gated; v61 = automated per Grant's decision — this is the final model.)
- RPCs live: `admin_verify_referral(p_admin,p_referral)`, `admin_invalidate_referral(p_admin,p_referral)` (SECURITY DEFINER, admin-gated, granted anon+authenticated).
- Deploy set (2026-06-03 late): backend **index.js v61** (Vercel; needs `SUPABASE_JWT_SECRET` env — see §1), **ffp-member-dashboard.html v246**, **assets/ffp-earnings-loader.js v14** (lazy ref ?v=14), **ffp-admin-dashboard.html v39** (footer build v39), **ffp-admin-referrals-loader.js v2**, backend **index.js v58** Sunday Summary dark rebuild (same file).

## 1d. PAYOUT WORKFLOW (#28) — request→quote→accept/cancel (2026-06-04)
Model (USD platform): member REQUESTS (existing submitPayout: payouts row 'pending' + an 'out'/'pending' transaction = the balance HOLD) → ADMIN quotes bank rate+fee (`admin_quote_payout` → status 'quoted', sets local_currency/local_amount/bank_rate/fee_usd/net_usd) → MEMBER accepts (`member_accept_payout` → 'paid', hold txn → 'paid') OR cancels (`member_cancel_payout` → 'cancelled', DELETES the hold txn = balance returns); ADMIN can `admin_reject_payout` (releases hold). All 4 RPCs SECURITY DEFINER, granted anon+authenticated, LIVE + tested (quote+cancel verified, balance restored).
- payouts schema added: local_currency, local_amount, bank_rate, fee_usd, net_usd, quoted_at, accepted_at, cancelled_at. status check now allows pending/quoted/approved/paid/rejected/cancelled. amount_aed CHECK fixed >=500 (was AED-era, read as $500) → **>=250** (USD min).
- ✅ DONE: step 1 schema, step 2 RPCs, **step 3 admin quote+reject UI** (ffp-admin-payouts-loader.js v9 + admin-dashboard v42, deploy pending). Step-3 build: Payouts panel pending row action is now **Quote** (modal: local currency [default AED], bank rate [1 USD =], fee USD, auto-computed/editable local amount, live preview) → `admin_quote_payout` → status 'quoted'; new **Quoted** tab (shows local amount + "awaiting member"); **Reject** now calls `admin_reject_payout` (server-side deletes the 'out' hold txn = balance returns) and stores the member-facing reason; view modal shows a Quote details block + Re-quote. Amounts shown in USD ($) — corrected stale "AED" modal labels (the `.aed` CSS class already renders $). p_admin = window.FFP_ADMIN.id. Legacy approve→Mark-Paid path kept for any pre-existing 'approved' rows. ✅ **step 4 member Accept/Cancel UI** (earnings-loader v18, deploy pending): 'quoted' payout row shows the quote + Accept (member_accept_payout → paid, hold txn → paid) / Cancel (member_cancel_payout → cancelled, hold txn deleted = balance returns). Verified end-to-end live this session (accept→paid + txn paid; cancel→cancelled + txn deleted) then cleaned. ⬜ REMAINING: step 5 emails (requested confirm, quoted→member, completed, cancelled/refunded).

## 2. DEPLOY FACTS
Host: Netlify (ffppassport.com) ← github.com/grant2223/ffp-passport (`main`, auto-publish). Backend: Express on ffp-passport-backend.vercel.app. DB: Supabase `kxzyuofecmtymablnmak`.
Served pages: `ffp-member-dashboard.html`, `ffp-provider-dashboard.html`, `ffp-admin-dashboard.html`, login / profile-complete / apply; loaders in repo root + `assets/`.
- Provider dashboard has a bottom-left build stamp (`FFP build vNN`) to confirm a deploy landed; member uses a version comment at the top of the file.
- Admin dashboard: the sidebar FOOTER shows a VISIBLE build stamp (`build vNN · FFP Admin`, line ~1396). It was hardcoded "v1.0" forever (never updated) → confusing. As of v32 it tracks the real version. **MUST bump this footer string in lockstep with the top version comment on every admin change** so the on-screen version matches the deployed file.
- The download/copy sync can corrupt files in the workspace (NUL-padding + truncation); GitHub itself is clean. Trust GitHub + DB + browser console over raw local reads; `node --check` before trusting/deploying any JS.
### ⚠️ WORKSPACE FILE INTEGRITY MAP (full sweep 2026-06-01 via `node --check` on every JS + every HTML inline script)
The download/copy sync TRUNCATED 10 loader files in this workspace (they end mid-statement). LIVE/GitHub copies are complete (live dashboards work). DO NOT upload any file in the CORRUPT list from the workspace — re-pull it clean from GitHub first, then edit + `node --check`.

CLEAN (valid, safe to edit/ship): ALL 15 HTML pages (member/provider/admin dashboards, login, apply, profile-complete, my-passport, etc.); ALL `assets/*.js` (incl. ffp-meet-move-loader.js, ffp-taxonomy.js, ffp-api-integration.js, ffp-realtime.js, all member loaders); and root JS: ffp-admin-{auth,analytics,content,deals,feedback,meetups,members,overview,quests,referrals}-loader.js, ffp-provider-{auth,deals,notifications,profile,quests,venue-qr}-loader.js, ffp-member-quest-scan-loader.js.

RECOVERED + REPAIRED from session transcript (now COMPLETE + valid + RPC-wired, safe to ship) 2026-06-01:
- ffp-provider-events-loader.js (403 lines), ffp-provider-experiences-loader.js (800), ffp-provider-challenges-loader.js (379) — truncated tails restored with EXACT transcript bytes (verified every tail identifier is defined in the head); all node --check OK, provider_save_listing ×2 + provider_delete_listing ×1 each.

STILL CORRUPT — TRUNCATED (7 files; recover same way from transcript if needed — NOT blocking provider onboarding):
- ffp-provider-checkins-loader.js
- ffp-admin-applications-loader.js, ffp-admin-challenges-loader.js, ffp-admin-events-loader.js, ffp-admin-experiences-loader.js, ffp-admin-payouts-loader.js, ffp-admin-providers-loader.js

RECOVERY METHOD (use this, don't ask Grant to re-pull): the full session transcript .jsonl under `.claude/projects/.../<id>.jsonl` contains every file's intact content from earlier turns. Extract the authoritative tail/file, verify referenced identifiers exist in the head, splice, `node --check`.

CORRECTION: I earlier wrongly flagged `assets/ffp-meet-move-loader.js` as pre-corrupted — that failure was from MY edits; after reverting, it passes node --check. It is CLEAN.

### 0c. ONE passport-card resolver — window.FFPCard (member dashboard, v211)
Single canonical card data resolver keyed by member id (members.id uuid). `FFPCard.mapRow(row)` = the ONE snake/camel-tolerant mapper; `.register(row)` feeds a cache; `.resolve(idOrObj)` returns the card object (self → MemberProfile.data, minus DOB). Data sources register (get_match_pool rows do; the meet-move loader SHOULD once it's de-corrupted). Renderers (Who's going) resolve by id — no surface hand-builds its own member object. Card NATIONALITY reads m.nationality (falls back to country). Still to route through it later: matches deck custom markup + the static own-passport mappers + loader registration.

## 3. STATUS BOARD

### 3a. Live versions  (snapshot 2026-06-01, late session)
| File | Live | Local ahead? | Notes |
|---|---|---|---|
| ffp-member-dashboard.html | ~v202–v206 (Grant deploying iteratively) | **v212 (local, NOT fully confirmed live)** | v203 full-screen modals + top banner; v204 log date/time overlap; v205 meetup-modal-open fix; v206 min-height:100vh full-screen; v207 Log Activity rebuilt on detail-backdrop system; v208–209 Who's going host-first; v210 real passport details; v211 FFPCard resolver; v212 Who's going CAROUSEL + Level/Gender/Capacity one line |
| ffp-provider-dashboard.html | v23 | v23 | delete via RPC + top banner — LIVE (delete confirmed) |
| ffp-provider-{events,experiences,challenges}-loader.js | RPC delete LIVE | **edit/create being wired to provider_save_listing RPC NOW** | |
| assets/ffp-meet-move-loader.js | v16 (live, works) | ⚠️ workspace copy CORRUPTED — DO NOT upload (see §2) | |
| ffp-admin-dashboard.html | — | — | still corner toast (banner not applied) |

### 3b. Deploy queue (changed locally, awaiting upload)
- **ffp-member-dashboard.html v212** — UPLOAD (~1.7MB, don't paste). Cumulative v203→v212: full-screen modals + top banner; Log Activity rebuilt on the Post-a-Meetup `.detail-backdrop` modal system (Activity top, profile-default city, native date/time, 3-col duration); Post-a-Meetup form fixes; FFPCard resolver (§0c); Who's going = host-first CAROUSEL with ‹ › arrows; meetup Details on one line.
- (Pending) provider loaders + dashboard once `provider_save_listing` is wired (see §5).

### 3c. PARKED (revisit later, per Grant)
- **Who's going — the member's OWN passport card still not displaying correctly** even after v210–v212 (resolver + carousel + host-first + self-from-MemberProfile). Grant said park it and move on. Likely needs live debugging of FFPCard.fromProfile output / MemberProfile.data hydration timing on the live build. Resume after providers are onboarded.

### 3d. Broken / known issues (root cause)
- **Provider EDIT + CREATE listings** — auth.uid trap → silent 0-row update/insert. FIX IN PROGRESS via `provider_save_listing` RPC (§5).
- **Quests loader 404 flood** — `/api/quests/provider/<id>/checkins` backend route missing.
- **Member payouts + fitness/calorie writes** — same auth.uid trap → need RPCs.
- **Admin notifications** — still corner toast.

### 3e. Next up (priority order)
1. **Provider edit + create RPC (`provider_save_listing`)** — IN PROGRESS (unblocks onboarding providers for real-world testing). ← ACTIVE NOW
2. Deploy member v212 (upload) + commit FFP-MASTER.md to GitHub.
3. Un-park Who's going own-card; admin top-banner; quests-404 route; member payouts/fitness RPCs.

## 5. PROVIDER edit/create fix — `provider_save_listing` (build spec, 2026-06-01)
Root cause: each provider loader does `supabase.from(table).update(payload).eq('id',id)` and `.insert(payload)` directly → RLS auth.uid trap → silent 0 rows. Same fix as delete: SECURITY DEFINER RPC.
- Save call sites: events-loader L311(update)/318(insert); experiences-loader L705/713; challenges-loader L297/306. Provider id = `window.FFP_PROVIDER.id`. id present = edit; absent = create (status 'pending').
- Payload columns (exact, per loader):
  - events: title, description, about, activity, category, fitness_level, starts_at(tstz, NOT NULL), venue, city, area, setting, capacity(int), cost, parking, facilities, bring, hero_image_url.
  - experiences: title, description, overview, activity, category, exp_type, fitness_level, starts_at(date), ends_at(date), duration_days(int), country, destination, price_aed(numeric), capacity(int), what_included, what_not_included, accommodation, flights_info, travel_reqs, fitness_reqs, itinerary(jsonb), hero_image_url. (+featured=false on insert)
  - challenges: title, description, activity, category, metric, venue, prize_description, starts_at(tstz), ends_at(tstz), hero_image_url. (+challenge_type='provider', featured=false on insert)
- RPC: `provider_save_listing(p_kind text, p_provider uuid, p_id uuid, p jsonb) RETURNS uuid` — insert when p_id null (sets provider_id, status='pending'); else UPDATE ... WHERE id=p_id AND provider_id=p_provider; RETURNS the row id (NULL = not found / not permitted / unknown kind). GRANT EXECUTE anon, authenticated. Same trust model as provider_delete_listing (trusts client-supplied p_provider).
- ✅ RPC `provider_save_listing` is LIVE + TESTED in DB (insert ✓, update ✓, wrong-provider returns NULL ✓; UPDATE only touches keys present in payload via `p ? 'key'` so partial payloads don't wipe). No deploy needed for the RPC.
- ✅ Loader wiring DONE 2026-06-01: events/experiences/challenges loaders recovered from transcript + wired to provider_save_listing (save) — complete, node --check OK, ready to UPLOAD. Provider create + edit now functional end-to-end. Reference (the swap that was applied):
  - EDIT branch: replace `var upd = await supabase.from('<table>').update(payload).eq('id',id); if(upd.error) throw upd.error;` with `var upd = await supabase.rpc('provider_save_listing',{p_kind:'<kind>',p_provider:(window.FFP_PROVIDER||{}).id,p_id:id,p:payload}); if(upd.error) throw upd.error; if(!upd.data) throw new Error('Update failed — not found or not permitted');`
  - CREATE branch: delete the `payload.provider_id=...; payload.status='pending'; (payload.featured/challenge_type)` lines, and replace `var ins = await supabase.from('<table>').insert(payload).select().single(); if(ins.error) throw ins.error;` with `var ins = await supabase.rpc('provider_save_listing',{p_kind:'<kind>',p_provider:(window.FFP_PROVIDER||{}).id,p_id:null,p:payload}); if(ins.error) throw ins.error; if(!ins.data) throw new Error('Submit failed — please try again');`
  - kinds: events→'event', experiences→'experience', challenges→'challenge'. (RPC sets provider_id/status/challenge_type server-side.)

## 6e. ACTIVITY DATA LOSS — ROOT CAUSE + FIX (2026-06-02) — CRITICAL
SYMPTOM (Grant): "every time I update the members dashboard I lose my activity data." Data was NOT actually deleted (activity_logs is insert-only; deploys don't touch the DB; grant's saved logs were present). ROOT CAUSE: `saveLog()` pushed the entry to the map + toasted "Logged ✓" IMMEDIATELY (optimistic), THEN attempted the DB write only `if (member && member.id && window.supabase)` with errors swallowed to console. So if the member session wasn't ready (or the RPC errored), the activity was NEVER persisted but still appeared logged → it vanished on the next load/deploy = perceived data loss. FIX: saveLog now PERSISTS FIRST (await log_activity RPC), and only on success pushes to the map + shows success; if no session or the RPC errors, it shows a clear error and does NOT claim success / does NOT add to the map. An activity is only ever shown as logged if it reached activity_logs. (loadJourneyLogs already rebuilds the map from the DB on sign-in, so the displayed map = the DB.) DEPLOY ffp-member-dashboard.html. Same persist-then-confirm pattern already used by the venue check-in (FFPCheckin) + provider RPC saves.

## 6l. PASSPORT "YOUR JOURNEY" MAP → LEAFLET (2026-06-02) — Grant redesign
Replaced the hand-rolled SVG world map + Favorites/Wish List with a Leaflet map (dark CARTO tiles, CDN) on the member passport. window.JourneyMap (in the main dashboard script) does a World › Country › City drill-down: breadcrumb (#jm-crumb) + country/city chips (#jm-chips) + #ffp-jmap. World = a blue pin per active city (centroid via CITY_COORDS/estimateCityCoords), sized by count; tap a country chip → fits to country + its city pins; tap a city (pin or chip) → flies in + shows YELLOW pins at exact venue checkin_lat/lng (city centroid fallback if none). Selecting country/city sets state.selectedCountry/selectedCity → renderAll → the Top Activities / Top Venues / stats below all re-scope (getFilteredLogs now filters selectedCountry too). renderAll calls JourneyMap.render() (replaced renderCities()+renderMapPins()). Legacy setupMap()/loadWorldMap() early-return if #world-svg absent; add-city/city-search wiring guarded. Needs backend v53 (checkin_lat/lng added to /api/members/:id/activity-logs) for exact venue pins — without it, city scope shows the city centroid. node --check: both inline script blocks valid. SELECTION: Country + City dropdowns (#jm-country-sel/#jm-city-sel via JourneyMap._onCountry/_onCity) zoom in, plus tappable pins + breadcrumb. STYLING: tiles desaturated to neutral grey (#ffp-jmap .leaflet-tile{filter:grayscale(1) brightness(1.05) contrast(.92)}) — softer than CARTO's brown; map section is box-free (.jm-section, no card border) and FULL-BLEED on mobile (≤640px: .jm-map-wrap negative 20px margins = content padding, #ffp-jmap radius 0). DEPLOY: ffp-member-dashboard.html v220 (+ Leaflet CDN already in <head>) + backend index.js v53 (Vercel).

## 6i.1 FITNESS STATS — THE REAL BUG WAS READ-BACK, NOT SAVE (2026-06-02)
After many "not saving" reports: confirmed via SQL that records DO save (Grant's profile_meta: pr_bench_kg=90, squat 90, vo2 43, body_fat 14, resting_hr 48, weight 86, height 172, pr_dates all set). The save (member_profile_meta_save RPC from the CORE, v229) works. The bug: the Records tab READ profile_meta from a backend GET /api/members/:id/profile-meta endpoint that NEVER EXISTED in index.js (404) → FitnessStats.records stayed empty → "No record yet" even though the value was in the DB + showing on the leaderboard (which reads get_ranking_pool, a different working path). FIX: new SECURITY DEFINER RPC member_profile_meta_get(p_me) → to_json(profile_meta row); loader v18 reads via window.supabase.rpc('member_profile_meta_get') instead of the dead fetch. Verified anon-callable (returns bench 90). So save + read BOTH now on the proven RPC path, zero backend dependency. Also: whole "My PR" card is tappable (opens the full-screen editor), not just the small button. DEPLOY: ffp-member-dashboard.html v231 + assets/ffp-fitness-stats-loader.js v18 (?v=19). RPC live.

## 6o.1 PHONE-QR CHECK-IN — RESUME AFTER LOGIN (2026-06-03)
Symptom (Grant): phone-camera QR scan → "asks for sign in, then doesn't go to the provider page." ROOT CAUSE: the provider QR encodes ffppassport.com/ffp-member-dashboard.html?venue=<id> (ffp-provider-venue-qr-loader.js). On an unauthenticated phone, ffp-api-integration.js autoInit redirects the member dashboard to login.html and DROPS the ?venue= query; login.html then returns to ffp-member-dashboard.html (no query) → checkin boot() finds no venue → nothing opens. FIX (no shared-file change): a tiny <head> script in ffp-member-dashboard.html (BEFORE all other scripts, so it beats the auth redirect) stashes ?venue=<id> → localStorage 'ffp_pending_venue'. ffp-member-checkin-loader.js v6 boot() now reads venue from the URL param OR the stash; if signed in → openContext()+clear; if not → keep stashed (resumes after login). Signed-in / in-app scans unchanged. DEPLOY: ffp-member-dashboard.html v233 (checkin ref ?v=6) + ffp-member-checkin-loader.js v6. Edge: non-members who scan then never sign up leave a harmless stale pending_venue; profile-incomplete members resume when they next reach the dashboard.

## 6o. CHECK-IN 2-HOUR PER-VENUE COOLDOWN (2026-06-03)
Prevents farming multiple quick check-ins at the SAME provider. Enforced SERVER-SIDE inside venue_checkin_activity (BOTH overloads — with/without p_calories): before inserting, `select max(logged_at) from activity_logs where member_id=p_me and provider_id=p_provider and logged_at > now()-interval '2 hours'`; if found, RETURNS json {blocked:true, minutes_left, venue, message} INSTEAD of inserting (no exception — so the client can show a friendly sheet). Window is PER-PROVIDER: a check-in at a DIFFERENT venue is unaffected (the natural reading of "check-in at a provider should have a 2 hour timeout"). ONE check-in path only: ffp-member-checkin-loader.js (v5, doSave honours {blocked}). Verified live: 1st call inserts, 2nd call returns blocked "2h 0m"; test rows cleaned up. DEPLOY: ffp-member-dashboard.html v232 (checkin ref ?v=5) + ffp-member-checkin-loader.js v5. RPC already live.
CLEANUP (2026-06-03): DELETED the orphan ffp-member-quest-scan-loader.js from the workspace folder — it was dead code (zero HTML references), superseded long ago by ffp-member-checkin-loader.js which handles QR camera + ?venue= link + activity list + GPS verify + quest/challenge/event sub-flows. ALL scans go through that single file. (Remove it from the GitHub repo on next push too if still present there.)

## 6p. ADMIN UNIFIED LOGIN — no more double login (2026-06-03)
ROOT CAUSE: login.html is a unified portal (member/provider/admin) that authenticates via the backend (/api/auth/signin → {token, member, jwt}) and redirects by role. But the admin DASHBOARD ran its OWN separate Supabase-Auth OTP gate (old ffp-admin-auth.js v4, signInWithOtp/verifyOtp) — a parallel auth system — so after logging in at /login the admin was forced to log in AGAIN. The provider gate was already converted to the lightweight pattern; admin never was.
FIX (clean, not patch): admin now rides the SAME session as members/providers.
  - admin's identity aligns: admin@findfitpeople.com has the SAME id (cc66c82c-f44e-4101-838f-30a25f36bc1e) in members(role=admin) AND admin_users AND auth.users. So the backend-minted JWT (sub=member.id) makes auth.uid()=cc66c82c and is_admin() returns TRUE (verified via set_config request.jwt.claims → is_admin()=true).
  - ffp-admin-dashboard.html now loads assets/ffp-api-integration.js (builds the Supabase client + applies the member JWT via Authorization header on autoInit) — REPLACING the old inline clean-anon-client block + the v25 decision to exclude it. That exclusion was only needed back when admin used a Supabase-Auth SESSION; now admin uses the same JWT-header bridge as everyone, so no conflict.
  - ffp-admin-auth.js REWRITTEN v7: tiny role gate mirroring ffp-provider-auth.js v5 — reads ffp_member from localStorage; no member → /login; role not admin/super → bounce to matching dashboard; else reveal + set window.FFP_ADMIN. NO OTP. Client gate is UX-only; real access enforced server-side by is_admin()+RLS on the JWT (tampered localStorage role can't read admin data without a valid admin JWT). ffpLogout now comes from ffp-api-integration (clear → login.html).
DEPLOY: ffp-admin-dashboard.html v23 + ffp-admin-auth.js v7 (+ ffp-api-integration.js already exists). Safety: gate always bounces to /login on failure (never a dead-end) — worst case = one login at /login, same as today.

## 6q. ADMIN ANALYTICS COUNTRY/CITY FILTER (2026-06-03)
Two dropdowns (Country, City) in the Analytics panel header (#analytics-country / #analytics-city) scope the WHOLE panel: KPIs (new/paid members, engagement), growth, tiers, demographics, categories, engagement chart, top providers, AND Community Health. members.city is the source of truth; there is NO country column — Country is DERIVED from the shared taxonomy window.FFP_TAX.cities (country→[cities]); members whose city isn't in the taxonomy bucket under "Other". Engagement/category/provider tables are scoped by the set of member-ids whose city matches (analytics loader now fetches member_id on activity_logs/claims/rsvps/meetup_attendees, referrer_id on referrals). Community Health scoped SERVER-SIDE: community_health_stats now takes p_cities text[] DEFAULT NULL (dropped the old zero-arg overload to avoid ambiguity); loader passes selectedCities() (city → [city]; country → all that country's member-cities; all → null/no arg). Revenue stays platform-wide (transactions carry no location). Selection persists across period/compare changes; CH result cached by city-key so period changes don't refetch. Files: ffp-admin-dashboard.html v24 (analytics loader lazy cache-bust → v=38) + ffp-admin-analytics-loader.js v4 + RPC live. Verified: all=2, Dubai=2, Brisbane=0.
STANDARDIZED TO TAXONOMY (v5, 2026-06-03): the filter's Country grouping is keyed to the LOCKED taxonomy. The canonical taxonomy lives in DB table taxonomy_items (list_key: country=58, city=541 with parent=country, activity=97, category=12, nationality=60, fitness_level=5, age_group=5, gender=3, experience_type=6). NOTE the standalone `cities` table is EMPTY/unused — taxonomy_items is the source. ffp-taxonomy.js hydrates window.FFP_TAX.cities (country→[cities]) from it via FFP_TAX_READY (anon-readable), with its hardcoded 58-country map as fallback only until that resolves. Analytics loader v5: _ensure awaits FFP_TAX_READY then clears its city→country cache so it keys off the LIVE DB taxonomy not the JS fallback; also re-renders on the 'ffp-tax-ready' event (so admin taxonomy edits reflect). Member cities not present in the taxonomy bucket under "Other" (signals a data-quality issue rather than silently mis-grouping). Files now: ffp-admin-dashboard.html v25 (cache-bust v=39) + ffp-admin-analytics-loader.js v5.

## 6z++. SUNDAY SUMMARY — rebuilt around FFP's 3 PILLARS (2026-06-03, backend v56)
Grant's framing: the email must reflect what FFP stands for, not a generic 8-box grid. Three pillars:
1. YOUR FITNESS vs the community — a RADAR chart scored from the member's OWN values vs healthy ranges (vo2 30–60, bench 40–140, 5km 18:00–40:00 inverted, bio age 25–55 inv, body fat 8–35 inv, active 0–420min) so it VARIES by their real stats + is meaningful even when they're the only member; below it, their PRs with community rank (#x of y once cohort ≥3, else "your best"). ss_score() does the scaling; SS_SCALE holds ranges.
2. YOUR WORLD — places & people: cities + partner venues they've been active in (member_places(p_me) RPC: cities_total/venues_total + _new this week) + connections (total + new). 3 stat cards.
3. PASSPORT STATUS — real progress to next tier using the EARNINGS model: member_tier_progress(p_me) (service-role variant; 8 sections over 30 days) vs SS_TARGETS (each section's Supporter/Ambassador target) and the 4-of-8 rule. Shows current tier, a progress bar (met/4 toward next tier), and the closest 1–2 sections ("1 more provider visit · 1 more quest"). Ambassadors get a "maintain" message.
Inactive members still get the email (nudge copy, not skipped). Dropped the old 8-box glance grid + macros/active bars. New RPCs LIVE: member_tier_progress(uuid), member_places(uuid); member_stat_rankings now returns key+value. Cron fetches digest+rankings+places+tier_progress + member.tier. DEPLOY: backend index.js v56 (Vercel). TEST: ?secret=…&only=YOUR_EMAIL.

## 6z+. EMAILS — charts, send-all, signup + referral (2026-06-03, backend v55)
- REAL CHARTS in the Sunday Summary (Grant: "use real graphs not progress bars"). Email can't run JS/SVG, so charts are QuickChart-rendered PNGs embedded as <img> (display everywhere). renderSundaySummary builds, per member: (1) horizontal bar "Where you rank in <city>" — standing/percentile per tangible PR from d.rankings (100=top); (2) bar "Active minutes vs people like you" (you/city/gender/age from benchmarks.active_minutes); (3) doughnut "Your macros" (protein/carbs/fat from food). Each chart only renders when its data exists; charts REPLACED the rank number cards. Helper qc(config,w,h) → quickchart.io URL (+ optional env QUICKCHART_KEY for rate limits at volume). ssH()/ssImg() helpers.
- SEND TO EVERYONE (Grant): the cron no longer skips zero-activity members — inactive members get an encouraging nudge ("A fresh week starts today — now is the perfect time to get moving", greeting "Hey, <name>", + a prompt to add their records) instead of being skipped. didStuff flag drives active-vs-nudge copy.
- NEW-SIGNUP + REFERRAL emails (Grant): wired into /api/onboard/from-stripe. (1) sendAdminNewSignupEmail → ADMIN_EMAIL (env, default grant@findfitpeople.com) on every new member (name/email/city/referrer). (2) sendReferralEmail → the referrer ("You have a new referral") when a new member signs up via their referral_code. Both use the light brandEmail() shell + existing Resend mailer; non-blocking.
- DESIGN: emails are now LIGHT (white card, navy text, brand accents, FFP logo header — passport-cover header optional once ffp-passport-cover.png is committed), NO emojis, dates formatted (28 May). Mockup FFP-EMAIL-STANDARD.html shows: Example 0 (real charts), the transactional + digest examples.
- DEPLOY (one push): backend index.js v55 + vercel.json (Vercel) + env CRON_SECRET (set) + optional ADMIN_EMAIL/QUICKCHART_KEY + commit ffp-passport-cover.png to assets/ (website) if using the cover header. TEST: /api/cron/sunday-summary?secret=…&only=YOUR_EMAIL.

## 6z. SUNDAY SUMMARY — weekly digest email (2026-06-03) — FIRST P3 email, BUILT
The flagship weekly email (Grant: "Sunday Summary — start the week stronger"), one per active member, covering ALL 8 areas: Food, Activity, Earnings, Meet-ups, Connections, Quests, Events, Challenges — with City/Gender/Age-group benchmarks on the headline Activity stat. No emojis (per standard).
- RANKINGS (LIVE, Grant: "people want tangible rankings — VO2, bench, bio age, 5km, active time"): RPC `member_stat_rankings(p_me)` ranks the member vs their CITY cohort on real PRs from profile_meta (VO2 max, bench, 5km, bio age, body fat, weekly active time — only metrics they have), returns [{label,display,rank,total,better}]. The Sunday Summary now LEADS with these as a 2-col card grid ("#2 of 18 in Dubai" when total≥3, else "Your current best") instead of the abstract activities-count comparison. Empty state prompts members to add their records. The cron route fetches it (d.rankings) + renderSundaySummary renders it (ss_rankCard).
- DATA (LIVE): RPC `member_weekly_digest(p_me)` → JSON {week_start/end, group, activity, food, earnings, meetups, connections, quests, events, challenges, benchmarks{activities,active_minutes,avg_kcal each with you/city/gender/age}}. SECURITY DEFINER, GRANT anon/authenticated. Tested on Grant (7 sessions/252min, benchmarks compute). Age band derived from date_of_birth; cohort = members role='member' sharing city / gender / age band. Migration member_weekly_digest LIVE.
- SEND (backend v54, awaiting Vercel deploy): GET /api/cron/sunday-summary — secured by env CRON_SECRET (Vercel Cron sends Authorization: Bearer; ?secret= for manual test). Loops active+profile_complete members, calls the RPC, renders renderSundaySummary() (matches FFP-EMAIL-STANDARD Example 5), sends via the existing Resend mailer. SKIPS opted-out (members.preferences.no_weekly_email===true) + members with zero activity that week. Returns {sent,skipped,total}.
- SCHEDULE: vercel.json crons → '0 4 * * 0' (Sun 04:00 UTC = 08:00 UAE). ⚠️ Weekly cron needs Vercel PRO (Hobby = daily only). Set env CRON_SECRET before deploy.
- EMAIL TEMPLATE: FFP-EMAIL-STANDARD.html Example 5 (the render mirrors it).
- CAVEAT: sends sequentially in one invocation — fine at current scale; batch/queue if the member base grows large (Vercel function timeout). TEST: deploy, then GET /api/cron/sunday-summary?secret=<CRON_SECRET> to fire a manual run.
DEPLOY: backend index.js v54 + vercel.json (Vercel) + env CRON_SECRET. RPC already LIVE.
TODO (next emails, same pattern): listing-approval, new-review→provider, meetup join/cancel (event-driven via DB webhook → backend route). ADMIN BROADCAST panel (compose → in-app notification + optional Resend email → all/segment by city/gender/age/role/tier) — requested by Grant, NOT built yet.

## 6y. ALPHABETICAL LISTS + FOODS DB + EMAIL STANDARD (2026-06-03)
- ALPHABETICAL (Grant, confirmed): ffp-taxonomy.js v7 sorts NAME lists A–Z at the source — activity, nationality, country, city (A–Z within each country), category, provider_type — so every form on every dashboard inherits it. ORDINAL lists keep their meaningful order: fitness_level (Not Tried→Professional), age_group, gym_size, gender, experience_type, passport. One lever (the hydrator's vals() + the city/country block); no per-form edits needed.
- FOODS DB (Grant: "200+, grouped, with weight/protein/carbs/fat/calories; will grow to 500+"): NEW table public.foods (id, name, category, serving, unit, kcal, protein_g, carbs_g, fat_g, sort_order, active; RLS anon-read active + admin-all). Seeded 237 foods across 14 groups (Protein, Seafood, Dairy & Eggs, Grains & Carbs, Legumes, Vegetables, Fruit, Nuts & Seeds, Fats & Oils, Snacks, Drinks, Fast Food, Condiments, Breakfast & Bakery). Member dashboard v242: FOOD_DB (was a 32-item hardcoded const) is now `let` + hydrates IN PLACE from the table on load (hardcoded list kept as fallback); FOOD_CATS rebuilds from the live groups; the food-picker chips rebuild via CalorieTracker._renderFoodCats() (called in init + openFoodPicker + after hydrate). Add rows to grow to 500+; foods carry macros so they live in their OWN table, NOT taxonomy_items. TODO: a dedicated admin Foods editor (CRUD with macro fields) — for now foods are DB/SQL-editable.
- EMAIL STANDARD (REDESIGNED 2026-06-03, Grant: "more modern/professional, less dark, include logo"): now LIGHT — white card on soft-grey page (#dfe6ed), a NAVY (#0f2c47) header band with the white FFP logo (https://ffppassport.com/assets/ffp-logo.png; swap to ffp-emblem.png for the badge), dark-navy headings (#0f2c47), grey body (#44586a), light stat cards (#f1f7fc/#fff8e1/#f7fafc), accent #2ba8e0, above/below = #1f8fd0/#d65a5a, CTA still yellow #FFCC00 with navy text. The backend renderSundaySummary() was updated to MATCH this light design (so sent emails == the mockup). FFP-EMAIL-STANDARD.html (in repo) — email-client-safe (table + inline styles) template + spec + 4 example renders (meet-up confirmation, cancellation, weekly STATS digest, weekly NUTRITION digest). Use it as the template for all P3 emails. Brand: card #081420, accent #2ba8e0, CTA #FFCC00, from noreply@ffppassport.com (Resend). RULES (Grant): **NO emojis anywhere — ever** (brand standard); every digest stat shows the member's value benchmarked vs their **City, Gender, Age Group** averages (above = blue, below = soft red, shown as %, no arrows) + a "View all stats" / "View all nutrition" CTA. Same pattern for logged food. DATA: a digest RPC (member_weekly_digest(p_me)) must return the member's figures + the three group averages (City=members.city, Gender=members.gender, Age Group=DOB→age_group band) — build alongside the digest emails in P3. NOTE confirmed: existing welcome/code/verify emails already send via Resend (nodemailer → Resend SMTP gateway, port 465, from noreply@ffppassport.com).
DEPLOY: ffp-member-dashboard.html v242 + assets/ffp-taxonomy.js v7 (foods table migrations already LIVE). FFP-EMAIL-STANDARD.html is a reference doc (no deploy needed, but commit it).

## 6x. TAXONOMY AUDIT — FIXES (2026-06-03) — see FFP-TAXONOMY-AUDIT.md for the full assessment
Full field-by-field audit lives in `FFP-TAXONOMY-AUDIT.md` (committed to the repo). Fixes done:
- **P1 — provider_type unified (Grant: "they're the same thing").** Was a conflict: provider profile saved a *business structure* (Single location/Mobile/Coach) while the admin rankings classifier saved a *facility type* (Gym/Studio) into the SAME `providers.provider_type` column → mutual overwrite. RESOLVED into ONE concept. taxonomy_items list_key='provider_type' reseeded (value==label) to: Gym, Studio, Yoga Studio, Pilates Studio, CrossFit Box, Sports Club / Team, Adventure Provider, Wellness Centre, Recovery Studio, Health Food Cafe, Coaching / PT, Event Organizer, Other. The short-lived `business_structure` column + taxonomy list were DROPPED (Find Fit People's "Event organizer" migrated → provider_type "Event Organizer"). provider_save_profile writes provider_type again (guarded). The provider profile "Provider type" field (pf-type) + the admin rankings per-row Type select + filter all read this one list. ffp-taxonomy.js v6 exposes FFP_TAX.providerTypes + gymSizes (hydrate from DB).
- **P2 — killed hardcoded listing-form lists.** Provider event "Level" (em-intensity) + experience "Fitness level" (xm-fitness-level) now read FFP_TAX.fitnessLevels; experience "Type" (xm-type) reads FFP_TAX.experienceTypes (with fallbacks). Admin Taxonomy edits to those lists now propagate to provider forms.
DEPLOY: ffp-provider-dashboard.html v29 + assets/ffp-taxonomy.js v6 (DB migrations provider_business_structure_split + unify_provider_type already LIVE). admin rankings/taxonomies loaders unchanged (already read provider_type live).
- **P3 — EMAIL notifications: STILL TODO (architecture decision needed).** Audit §5 maps where emails should fire (listing approval — the provider banner PROMISES this but none sends; new-review→provider; meetup join/cancel; RSVP/application; new-provider→admin). Backend SMTP/nodemailer infra EXISTS (sendCodeEmail/sendWelcomeEmail/sendProviderVerifyEmail in index.js). BUT the trigger points are Supabase-direct (RPCs/RLS updates), not Express routes — so emailing them needs either (a) an `email_outbox` table the RPCs insert into + a Supabase Edge Function/cron that sends, or (b) RPCs calling a backend endpoint via pg_net. Recommend (a). NOT built yet — confirm the mechanism with Grant before building (also note the admin content loaders that do approvals are flagged corrupt in §2).

## 6w. WORLD MAP — FILTERS BUTTON + FULL-SCREEN FILTER MODAL (2026-06-03) — ffp-member-dashboard.html v237→v240
v240 (Grant fixes — ROOT CAUSE, no patches):
- Removed the location/passport "tags" summary strip above the map (#jm-active-summary deleted + its CSS; updateMapFilterUI now only drives the Filters-button count badge).
- Passport picker default card: the generic FFP cover (assets/ffp-passport-cover.png) is the first card = "All / Worldwide" (tap to clear the lens). So 6 cover cards in the 3-col grid (3+3). Pure images, no overlay text; coloured-label fallback only if an image 404s.
- ROOT-CAUSE FIX — Country/City dropdowns vanished when a passport was selected: the dropdowns were built from passport-FILTERED cities (render() → renderChips(cities) where cities came from logsInRange() which applies the passport filter). The passport is a MAP LENS only. Added logsInRange(ignorePassport); renderChips now builds Country/City from logsInRange(true) (all logged locations, time-scoped) so the dropdowns never disappear regardless of passport.
- ROOT-CAUSE FIX — headline journey stats went blank on passport select: renderAll passed getFilteredLogs() (location + passport) to renderStats, so picking a passport whose mapping didn't match the member's logged categories collapsed the set to empty → tiles read 0. renderAll now feeds renderStats() with getLocationLogs() (location only); map pins + Top Activities/Places keep the lens via getFilteredLogs(). Stat tiles reflect the member's journey and never zero-out from a theme. (The deeper taxonomy issue — many activity_logs categories not mapped to a passport via category.parent — still means a selected passport may show few map pins/Top items; that's a Taxonomies data task, set category→passport parents in admin.)
Earlier history below.
## 6w-prev. WORLD MAP — FILTERS BUTTON + FULL-SCREEN FILTER MODAL (v237/v238)
⚠️ v238 HOTFIX (read this): v237 shipped broken — renderPassportPicker() + updateMapFilterUI() are TOP-LEVEL functions but called `esc()`, which is NOT a global in this file (each IIFE defines its own local `esc`; the global escaper is `escHtml()`, ~L11262). The ReferenceError threw on renderPassportPicker(), which is the FIRST call in renderAll() → renderAll aborted → the entire passport panel (card data, stats, Top Activities/Places/Connections, map) rendered nothing. Grant's report: "no data being pulled into the passport panel." FIX: the 4 calls now use escHtml(). LESSON: top-level member-dashboard code must use the global escHtml(), never esc() (esc is IIFE-local only).
Grant redesign: the passport pills + Country/City dropdowns no longer sit above the map (decluttered). Instead a "Filters" button sits opposite the "World Map" title → opens a full-bleed modal (#map-filter-backdrop, .detail-backdrop dm-full) holding, top→bottom: Country select + City select (#jm-chips, populated by renderChips as before) then the 5 passport-type cards (#jm-passports). Below the title a compact #jm-active-summary shows the current scope (location pill + passport pill); the Filters button carries an active-count badge (passport + country + city). PASSPORT CARDS are now IMAGE cards (renderPassportPicker rewritten): each uses assets/<id>-passport.png — sports/fitness/wellness/adventure + health-food-passport.png — as a cover with a dark scrim + label + per-passport activity count + a check badge when selected; an "All passports" full-width card leads. If an image 404s, onerror hides it and the .jm-pcard-fallback colour (passport colour) shows behind the label, so it never looks broken. Selection still flows through the SAME state (state.selectedPassport via setPassport; Country/City via JourneyMap._onCountry/_onCity) → renderAll; the modal stays open while selecting and updates in place. New fns: openMapFilters / closeMapFilters / clearMapFilters / updateMapFilterUI. The old .jm-pass* pill CSS + .jm-pass-label remain defined but unused (harmless). DEPLOY: ffp-member-dashboard.html v237 + the 5 passport PNGs in assets/ (Grant committed them to GitHub). No DB/RPC change.

## 6v. PROVIDER REVIEW → PROVIDER RANKINGS (2026-06-03) — BUILT end-to-end
Spec (Grant, confirmed): ~1h after a member checks in at a provider venue, an IN-APP prompt invites them to rate the session (Overall + Experience + Service + Facilities stars + comment). Overall drives ranking. Surfaces: provider dashboard (own rating), admin leaderboard, + member-facing discovery (deferred — no provider directory yet). Every review is tied to a REAL activity_logs check-in to keep it honest.

DB: table `public.provider_reviews` (id, member_id, provider_id, activity_log_id, stars_overall/experience/service/facilities, comment, created_at; unique index `provider_reviews_member_log_uq` on (member_id, activity_log_id) WHERE activity_log_id NOT NULL; RLS on, admin-all policy; member/provider access via SECURITY DEFINER RPCs). All RPCs SECURITY DEFINER, GRANT anon/authenticated, trust client-supplied ids (same model as venue_checkin_activity / provider_save_listing). Migrations: `provider_reviews_rpcs`, `provider_rankings_add_category`. All LIVE — no deploy needed for RPCs.
RPCs (LIVE + TESTED on Grant's real check-ins, then test review row deleted — activity_logs untouched):
  - submit_provider_review(p_me,p_provider,p_log,p_overall,p_experience,p_service,p_facilities,p_comment) → uuid. Validates the log row belongs to (member, provider); requires overall 1–5 (categories optional, 1–5 when present); UPSERTs on the (member,log) unique index (re-rating the same check-in updates, no dupes). Returns NULL if the log isn't that member's check-in at that provider (verified: wrong-provider → null; upsert kept row_count=1).
  - member_pending_reviews(p_me) → json[]: activity_logs with provider_id, logged_at < now()-1h, no review yet → {id, provider_id, venue (coalesce log.venue, providers.business_name), activity, logged_at}.
  - provider_rating(p_provider) → json {provider_id, n, avg_overall, avg_experience, avg_service, avg_facilities} (rounded 2dp). PUBLIC — ready for the future discovery surface.
  - provider_reviews_list(p_provider, p_limit=50) → json[] {id, 4× stars, comment, created_at, member_name, member_photo}.
  - provider_rankings() → json[] {provider_id, business_name, city, country, category, status, n, 4× avgs}, ordered by avg_overall desc nulls last, n desc. is_admin()-GATED (raises 'admin only' for n
## (67) PHASE 2 — OWNER-GUARD ON CONFIG MUTATIONS (2026-06-21) — DB ONLY, LIVE
Security hardening continued from Phase 0/1 (24 money fns already guarded). Migration
`phase2_owner_guard_config_mutations` injected `perform assert_pro_owner(p_pro)` /
`perform assert_provider_owner(p_provider)` as the FIRST statement after the outer BEGIN of
40 host-initiated config-mutation RPCs (idempotent: skips any already containing the guard;
matched the first \mBEGIN\M only, so nested blocks untouched).
GUARDED (40): pro_save_slot, pro_set_slot_status, pro_save_service, pro_delete_service,
pro_save_client, pro_delete_client, pro_save_payment, pro_delete_payment, pro_delete_package,
pro_save_broadcast, pro_delete_broadcast, pro_request_data_access; provider_save_session,
provider_delete_session, provider_generate_class_sessions, provider_book_appointment,
provider_cancel_appointment, provider_confirm_appointment, provider_reschedule_appointment,
provider_appointment_no_show, provider_save_service, provider_delete_service, provider_save_member,
provider_delete_member, provider_save_payment, provider_delete_payment, provider_delete_package,
provider_delete_plan, provider_save_broadcast, provider_delete_broadcast, provider_save_staff,
provider_delete_staff, provider_save_team, provider_delete_team, provider_save_team_roster,
provider_set_booking_questions, provider_save_quest, provider_quest_meta, provider_request_feature,
provider_request_feature_days.
SAFETY: built the member-facing allowlist from FFP Booking Platform/js/* first — members use
create_booking/book_event_order/cancel_booking/reschedule_class_booking + member_* reads; NONE of
the 40 are called member-side (grep confirmed appointment writes absent from booking platform), so
owner-only guards cannot break member self-booking. assert_* returns early for service_role so the
Vercel backend is unaffected.
VERIFIED (simulated request.jwt.claims): pro non-owner → blocked:forbidden; provider non-owner →
blocked:forbidden; provider OWNER → passed; service_role → passed. Audit: 40/40 guarded, guard is
first executable statement in 40/40.
NO DEPLOY — RPCs are live in Supabase (not in the GitHub repo). Remaining backlog: #44 check-ins
guard-by-caller, #45 Phase 3 private reads (must preserve the member-facing allowlist above).

## (68) PHASE 2b — CHECK-INS: GUARD BY CORRECT CALLER (2026-06-21) — DB ONLY, LIVE
Migration `phase2_owner_guard_host_checkins`. The original #44 plan assumed member check-ins
should guard on `auth.uid() = p_me`. INVESTIGATION KILLED THAT ASSUMPTION:
- members link to auth ONLY by email (no user_id col); members.id = auth.uid for just 2/16, and
  only 5/16 members have ANY auth.users row at all. The other 11 operate via the access_code/custom
  path with NO Supabase Auth session → auth.uid() is null for them. A hard self-guard on
  member-initiated check-ins (venue_checkin_*, booking_checkin, pro_checkin_service,
  member_event_checkin, member_quest_progress_checkin) would LOCK OUT the majority of members.
  => DID NOT guard member check-ins. They remain SECURITY DEFINER + client-supplied p_me (documented
     trust model). Proper fix = unify member auth (give every member a Supabase Auth session / a
     members.user_id link) BEFORE any member-side self-guard. Logged as residual risk / future task.
HOST check-ins guarded (called ONLY from pro/provider dashboards, grep-confirmed not in booking
platform; same reliable-auth.uid() context as the 40 Phase 2 fns):
  - pro_checkin_member           -> perform assert_pro_owner(p_professional)
  - provider_checkin_appointment -> perform assert_provider_owner(p_provider)
  - provider_checkin_session     -> perform assert_provider_owner(p_provider)
VERIFIED: random authenticated non-owner -> all three raise 'forbidden' at the guard (before any
mutation). Static: 3/3 guarded, guard is first statement. NO DEPLOY (RPCs live in Supabase).
The two provider_*_checkins SQL functions (provider_event_checkins, provider_quest_checkins) are
READS -> deferred to #45 (Phase 3 private reads).

## (69) PHASE 3 — OWNER-GUARD ON HOST-PRIVATE READS (2026-06-21) — DB ONLY, LIVE
Migration `phase3_owner_guard_host_private_reads`. Guarded 54 host-only read RPCs (p_provider/p_pro
first arg, read-only = body has no insert/update/delete) so one pro/provider can't read another's
clients, payments, packages, rosters, reports, attendance, broadcasts, staff, teams, etc.
INJECTION (two languages):
  - plpgsql reads: `perform assert_{pro,provider}_owner(p_{pro,provider})` as first stmt after BEGIN.
  - sql reads: a LEADING `select assert_{pro,provider}_owner(...);` before the original final SELECT
    (SQL fn returns the LAST statement's result, so return type is preserved; verified live).
ALLOWLIST — 5 reads DELIBERATELY LEFT OPEN (member-facing / public discovery), built by grepping
ALL member surfaces (booking platform js/* AND every ffp-member-* loader, incl. the venue-QR
ffp-member-checkin-loader.js which I'd initially missed):
  pro_week_schedule, provider_rating, provider_reviews_list  (booking platform discovery/booking),
  member_provider_options, venue_active_programs               (member venue check-in loader).
VERIFIED (simulated request.jwt.claims): pro_list_services(sql) & provider_list_services(sql) &
pro_client_data(plpgsql) -> OWNER returns data, non-owner -> forbidden; the 2 open reads
(pro_week_schedule, provider_rating) -> still pass for a non-owner. Coverage audit: 54 guarded /
5 open, and the 5 open are EXACTLY the allowlist. NO DEPLOY (RPCs live in Supabase).
SECURITY BACKLOG (Phases 0-3) NOW COMPLETE: 24 money fns (P0/P1) + 40 config mutations (P2) +
3 host check-ins (P2b) + 54 host reads (P3) = 121 RPCs owner-guarded. Residual risk still open:
member auth is fragmented (only 5/16 members have a Supabase Auth session; rest use access_code/
no JWT) -> member-initiated writes still trust client-supplied p_me. See member-auth unification plan.

## (70) MEMBER-AUTH UNIFICATION — PHASE 1 (2026-06-21) — DB ONLY, NON-BREAKING, LIVE
Goal: kill the member-auth fragmentation (dashboard mints custom JWT sub=members.id via
/api/auth/signin; booking platform uses native Supabase OTP → auth.users.id linked by email only;
11/16 members have NO auth.users row). Decided end-state (Grant: build for 1M users, reliable):
converge members onto NATIVE Supabase Auth as the single identity, migrated dual-track with zero
lockout. Phase 1 lays the safe substrate, enforcing nothing.
Migration `auth_p1_members_user_id_link_and_self_guard`:
  - members.user_id uuid NULL, FK -> auth.users(id) ON DELETE SET NULL, partial-unique
    (members_user_id_uq where user_id is not null).
  - Backfill: user_id=id where members.id is an auth.users id (2); else user_id=auth.users.id by
    lower(email) match. Result: 5/16 linked, 0 bad links.
  - assert_member_self(p_me) [NOT wired into any RPC yet] — DUAL-BRIDGE so it's correct before AND
    after the native migration: pass if service_role; OR p_me=auth.uid() (custom-JWT/dashboard);
    OR members.user_id=auth.uid() for p_me (native/booking); OR is_admin(); else raise forbidden.
VERIFIED (simulated claims): dashboard member (sub=members.id) -> passed; native member
(sub=auth.uid, via user_id) -> passed; service_role -> passed; stranger -> forbidden. col/fk/uniq
all present.
NO DEPLOY (DB only). NEXT — Phase 2 (#47): link-on-login — backend sets members.user_id=auth.uid()
on every member auth (OTP verify + /api/auth/signin) matched by email (REQUIRES backend deploy).
Then P3 dashboard login -> native auth (parallel), P4 enforce assert_member_self on member writes +
retire access_code/custom JWT.

## (71) MEMBER-AUTH UNIFICATION — PHASE 2: LINK-ON-LOGIN (2026-06-21) — DB ONLY, LIVE
Root gap found in ensure_member(): the OLD version RETURNED EARLY when a member already existed by
email ("email already claimed") WITHOUT linking the native auth.uid() → that's why booking-platform
logins never linked existing dashboard/Stripe members (only 5/16 linked). It's a DB RPC (called by
the booking platform right after verifyOtp, so auth.uid() inside = the native auth.users.id) → NO
Vercel deploy needed.
Migration `auth_p2_ensure_member_links_user_id` rewrote ensure_member() to link at every branch:
  A) member row already keyed by this native id → set user_id=id (self-link);
  B) existing member owns this email → set members.user_id=auth.uid() (THE FIX; was skipped);
  C) brand-new → insert + link.
All link UPDATEs guarded by `not exists (… user_id=v_id …)` so they can never violate the
members_user_id_uq partial-unique index or break login. Preserves original insert/return behavior.
VERIFIED live (branch B): temp-unlinked a real email-linked member (before=null) → simulated their
native OTP session (sub=their real auth.users id + email claim) → ensure_member relinked to the exact
original user_id (relinked_correctly=true), so data self-restored. Integrity after: 5/16 linked,
0 bad links, 0 dup user_ids. Going forward every booking-platform login auto-links its member.
NEXT — P3 (#48): move the dashboard login to native Supabase Auth (parallel, prove-in-test), which
is what raises the linked count for dashboard-only members; then P4 enforce assert_member_self on
member writes + retire access_code/custom JWT.

## (72) MEMBER-AUTH UNIFICATION — PHASE 3 (HYBRID) — BACKEND FOUNDATION (2026-06-21)
DECISION (after verifying the blast radius): a straight "dashboard → native Supabase Auth" swap is
NOT viable — ~30 member RLS policies are built on auth.uid()=members.id (activity_logs, bookings,
food_logs, transactions, payouts, member_connections, meetups, quest_checkins, members(id=auth.uid),
etc.) + the dashboard reads members/foods/providers directly. Native auth makes auth.uid()=auth.users.id
≠ members.id → every one of those breaks. So we use the HYBRID: native Supabase Auth for the LOGIN
(OTP/magic-link, rate-limited, MFA-capable, no stored 6-digit code) → backend EXCHANGES the verified
native session for the SAME short app-JWT (sub=members.id) the app already uses → RLS layer 100%
unchanged, no id re-key, no policy rewrite.
BACKEND (assets/.../index.js) — added endpoint `POST /api/auth/exchange` (v96), placed right before
/api/auth/reset. Body {access_token} (native Supabase session token). Steps: validate via
supabase.auth.getUser(token) → resolve member by members.user_id link, else by email (link on first
use via members.user_id), else create (user_id set) → status check → return {jwt:mintSupabaseJwt,
refresh:mintRefreshToken, member, redirect} — REUSES the existing mint fns, mirrors /api/auth/signin's
response shape exactly. Runs in PARALLEL with the legacy access_code /api/auth/signin (nothing removed).
VALIDATION: my inserted block passed node --check in isolation. NOTE: full-file `node --check` throws a
FALSE error at the last line via the shell mount (RULE 3 truncation) — the Read tool shows the file is
complete and line 3132 is well-formed; do not trust the shell's full-file parse here.
DEPLOY: Grant commits index.js → Vercel. Additive new route; cannot affect existing flows.
NEXT (still #48): after deploy + smoke-test of /api/auth/exchange, wire the dashboard login UI to the
native OTP → exchange flow (parallel with access_code), prove end-to-end, then P4 enforce
assert_member_self + retire access_code/custom JWT.

## (73) AUTH P3 — DASHBOARD LOGIN WIRED TO HYBRID (member portal) — 2026-06-21
Front half of the hybrid. login.html v20: MEMBER-portal Sign In now uses native Supabase OTP then the
exchange endpoint, instead of the legacy access_code. Reuses the SHARED window.supabase client (built by
ffp-api-integration v12 with the anon key + persistSession:false) → signInWithOtp/verifyOtp return the
session token in-response without persisting; we POST it to /api/auth/exchange and store the returned
app-JWT/refresh/member exactly like FFPApi.verifyCode. handleAuthRedirect unchanged → same dashboards.
SCOPE + SAFETY:
  - Gated by ffpUseNative(flow) = FFP_NATIVE_MEMBER_AUTH && flow==='signin' && selectedPortal==='member'.
    Partner/Professional/Admin sign-in UNTOUCHED (legacy /api/auth/signin). One-line revert: set
    FFP_NATIVE_MEMBER_AUTH=false.
  - Branches added to requestCode (send OTP), resendCode (resend OTP), verifyCode (verifyOtp→exchange→store→redirect).
  - allow_create:false sent on sign-in → backend exchange now returns 404 {no_account} for an unknown email
    instead of creating one (keeps the Become-A-Member funnel). Backend index.js exchange updated for allow_create.
UX: identical (email → 6-digit code), but the code is a SINGLE-USE Supabase OTP, not the permanent
access_code. Existing members: first native sign-in creates+links their auth.users row by email (P2 ensure_member
+ exchange), so members.user_id populates organically as members sign in.
VALIDATION: backend exchange region node --check OK in isolation; login.html main script could not be
full-parsed via the shell (RULE 3 mount truncation — shell sees 779 of ~860 lines); verifyCode native branch
confirmed well-formed via the Read tool (balanced, returns on all paths, legacy fallthrough intact).
DEPLOY (both, backend first): index.js → Vercel (v96 exchange + allow_create); login.html v20 → GitHub→Netlify.
TEST: live login at ffppassport.com → Member → email → native code → lands in member dashboard. Partners/pros/
admins verify still log in as before. NEXT: once members are proven, extend hybrid to the other portals, then
P4 (enforce assert_member_self on member writes + retire access_code/custom JWT).

## (74) AUTH P3 — HYBRID EXTENDED TO ALL PORTALS (2026-06-21)
Member-portal hybrid PROVEN LIVE (GoTrue recorded grant@findfitpeople.com sign-in 13:17Z; Grant
confirmed "tested and working"). Verified provider/pro/admin dashboards all read the SAME session:
ffp-provider-auth.js reads localStorage 'ffp_member' (set by login verifyCode→FFPAuth) and queries
providers by owner_user_id=auth.uid()=members.id via the app-JWT — identical to the member dashboard.
So the native login is transparent to them (only the code SOURCE changes; stored app-JWT/refresh/member
is identical). login.html v21: ffpUseNative() no longer restricts to selectedPortal==='member' → native
OTP→exchange now covers Member/Partner/Professional/Admin sign-in. Flag renamed FFP_NATIVE_MEMBER_AUTH→
FFP_NATIVE_AUTH (one-line revert all portals). Signup (Stripe) + reset screens unchanged. Backend
unchanged (exchange already deployed). DEPLOY: login.html only → GitHub→Netlify. TEST: sign in via
Partner + Professional + Admin portals on ffppassport.com — each should send a code and land on its
dashboard as before. NEXT: P4 (#49) — enforce assert_member_self on member-initiated writes once the
active base has signed in at least once (user_id links accrue per login), then retire access_code +
custom-JWT mint. Members linked will climb from 5/16 as users sign in natively.

## (75) AUTH P4 — ENFORCE MEMBER SELF-GUARD ON WRITES + CLOSE FREE-GRANT HOLES (2026-06-21) — DB ONLY, LIVE
Grant chose to flip P4 on now (small known userbase; tell others to sign back in). Safe because the
exchange app-JWT has sub=members.id → a logged-in member always satisfies clause 1 of the dual-bridge
(p_me=auth.uid()); booking-platform native users satisfy clause 2 (members.user_id=auth.uid()) once
linked (P2, on login). Only UNLINKED booking-platform members are blocked until they re-sign-in.
Migration `auth_p4_enforce_member_self_on_writes`: injected `perform assert_member_self(p_me|p_member)`
as the FIRST statement of 47 member-initiated WRITE RPCs (first arg p_me/p_member, has insert/update/
delete, plpgsql, NO existing auth.uid() check, not a host/grant fn). Covers check-ins (venue/booking/
event/quest/pro), activity/meal logs, quests, meetups, connections, challenges, reviews, payouts
(accept/cancel), rsvp, likes, profile_meta, recommend, congratulate, etc.
EXCLUDED (deliberate): book_session/pro_book_slot/create_booking/member_respond_pro_access (already have
their own auth.uid() guards from #41); pro_consume_package_credit (service_role-only, not member-callable).
SECURITY HOLE FOUND + CLOSED (migration `auth_p4b_close_free_grant_holes`): grant_member_plan,
grant_pro_package, professional_link were PUBLIC-EXECUTE (anon+authenticated) with NO auth check — a member
could self-grant a paid plan/package or link anyone as a pro. Guards added: grant_member_plan→
assert_provider_owner(p_provider); grant_pro_package→assert_pro_owner(p_professional) (both called ONLY by
the backend post-Stripe = service_role → payment flow intact, grep-confirmed no client caller);
professional_link→assert_member_self(p_member) (called client-side by a member self-linking as a pro).
VERIFIED: 47/47 self-guarded with guard as first statement; stranger→forbidden on member_like_activity/
rsvp_event/booking_checkin; service_role passes. Free-grant: member→forbidden on all three; service_role/
owner→passes.
DEFERRED (NOT a hole): retire access_code + /api/auth/signin. The app-JWT mint (mintSupabaseJwt) STAYS —
it's the core of the hybrid. /api/auth/signin is kept as the FFP_NATIVE_AUTH=false rollback fallback;
retire it only once native is fully trusted in production. NO DEPLOY (all DB).

## (76) BOOKING MGMT — CANONICAL MEMBER IDENTITY ACROSS SURFACES (2026-06-21) — DB ONLY, LIVE
Root issue (latent, would break as the userbase grows past the id-matched testers): create_booking stamped
bookings.member_id = auth.uid(), which is members.id on the dashboard but auth.users.id on the booking
platform (native). So an email-linked member (id<>user_id) booking on one surface couldn't view/cancel/
reschedule on the other (member_my_bookings/cancel_booking/reschedule_class_booking authorize via auth.uid()).
Migration `booking_canonical_member_identity`:
  - NEW helper current_member_id() = members.id for the caller (id=auth.uid() OR user_id=auth.uid()) — the
    same dual-bridge as assert_member_self, returns the canonical platform id on BOTH surfaces.
  - create_booking / cancel_booking / reschedule_class_booking: identity line `v_member := auth.uid()` →
    `:= current_member_id()` (ONLY the identity changes; all capacity/refund/credit-return logic byte-identical).
  - member_my_bookings(p_member): WHERE now bridges (b.member_id = the members.id resolved from p_member as
    id-or-user_id) so it returns the member's bookings whichever id the client passes.
  - Backfilled any booking stamped with a user_id → canonical members.id (0 now; defensive).
VERIFIED: 3/3 fns use current_member_id(), none use raw auth.uid() for identity; resolver returns members.id
for both native(sub=user_id) and dashboard(sub=members.id) sessions; member_my_bookings(user_id)==
member_my_bookings(members.id). Covers all 5 item types for view/cancel (cancel_booking is type-agnostic with
per-type refund policy). NO DEPLOY.
FOLLOW-UPS: (a) booking_checkin stamps bc.member_id from client p_member — canonicalize for the checkin-display
join robustness (#51). (b) member reschedule is class_session-only by design; other types reschedule host-side.
NEXT BIG WORKSTREAM (Grant's real-world req): partner payment MODES — default model #1 (manual/credits always
on; Stripe adds on-system checkout; member always books, charged online only when partner Stripe-connected +
item set pay-online) with per-item option to REQUIRE Stripe (#3). Most infra exists (facility+pro Stripe Connect
LIVE; provider_payments/pro manual ledger w/ method; Service→Package→Payment→credits). Gap = explicit per-item
payment requirement driving the member booking screen + cancel/refund branching by pay method.

## (77) PARTNER PAYMENT MODES — FOUNDATION (per-item requirement + resolver) (2026-06-21) — DB ONLY, LIVE
Grant's model: #1 default (manual/credits always on; Stripe adds on-system checkout; member always books,
charged online only if partner Stripe-connected + item set pay-online) with per-item option to REQUIRE
Stripe (#3). "Partner decides" — per item.
Migration `booking_pay_requirement_field`: added `pay_requirement text not null default 'optional'
check in ('free','optional','required')` to the 7 bookable/sellable tables: experiences, events, classes,
provider_sessions, pro_services, pro_packages, provider_plans. Default 'optional' = ZERO behaviour change
until a partner sets it.
Migration `booking_payment_plan_resolver`: new SECURITY DEFINER fn booking_payment_plan(p_item_type,
p_item_id) (granted anon+authenticated) → {ok, price_aed, pay_requirement, partner_kind (facility|
professional), partner_id, partner_has_stripe, action}. ACTION = the booking screen's instruction:
  price=0 or 'free' -> 'free'; 'required' -> 'pay_online' if partner payments_status='connected' else
  'blocked_no_stripe'; 'optional' -> 'pay_online' if connected else 'book_offsystem'. Handles all 5 member
  item types (professional_session p_item_id = pro_slot id → pro_services + professionals.payments_status).
VERIFIED live on real items: class AED75/optional/no-stripe→book_offsystem; provider_session AED110→
book_offsystem; event AED0→free; experience AED7500→book_offsystem; pro_slot AED500 (pro not connected)→
book_offsystem. NO DEPLOY (DB only).
REMAINING SLICES (client, need deploys): (a) PARTNER UI — a per-item "How is this paid?" control
(Free / Pay online if available / Online payment required) on the service/class/event/experience/package
editors in the provider + pro dashboards, writing pay_requirement. (b) MEMBER BOOKING SCREEN — call
booking_payment_plan on the listing, branch: free→book; pay_online→Stripe checkout (existing
session-checkout endpoints); book_offsystem→book now + "pay at venue / partner will arrange";
blocked_no_stripe→hide/disable online booking. (c) CANCEL/REFUND — branch by how it was paid (Stripe refund
vs existing credit-return). Booking identity (#76) already makes member cancel/reschedule work cross-surface.

## (78) PARTNER PAYMENT MODES — PARTNER UI slice 1 (PRO services + packages) (2026-06-21)
Migration `pro_save_service_package_pay_requirement`: pro_save_service + pro_save_package now persist
p->>'pay_requirement' (insert: coalesce(...,'optional'); update: case when p ? 'pay_requirement' …);
assert_pro_owner guard preserved. CLIENT: added a "How is this paid?" <select> (Free / Pay online if
available / Online payment required) to the pro SERVICE editor (ffp-professional-services-loader.js:
openServiceModal default+field, saveService payload) and the pro PACKAGE editor
(ffp-professional-client-loader.js: openPlanModal default+field, savePlan payload). Default 'optional'.
PRO_BUILD 52→53. VALIDATION: openServiceModal + openPlanModal pass isolated node --check (full-file
parse is a RULE 3 mount-truncation false positive — files confirmed intact via Read tool).
DEPLOY: ffp-professional-services-loader.js + ffp-professional-client-loader.js + ffp-professional-
dashboard.html → GitHub→Netlify. Backend unchanged (persistence is in the DB RPCs, already live).
NEXT: provider (facility) editors — classes / events / experiences / provider_sessions(session_templates)
/ provider_plans save RPCs + their loaders (same pattern). Then member booking screen branches on
booking_payment_plan.action; then cancel/refund branch by pay method.

## (78b) FIX — pay_requirement read-back (2026-06-21) — DB ONLY, LIVE
Grant: "did not remember my choice." Root cause: pro_save_service/pro_save_package PERSIST pay_requirement
(verified: a pro_service row already = 'free'), but pro_list_services/pro_list_packages build an explicit
jsonb that OMITTED pay_requirement → editor read editing.pay_requirement = undefined → dropdown fell back to
'optional'. Migration `pro_list_services_packages_return_pay_requirement`: added 'pay_requirement' to both
list jsonb objects (assert_pro_owner guard preserved). Verified pro_list_services now returns
["free","optional",...]. NO redeploy (client already reads the field) — just reload.
LESSON for the facility slice: every *_list_* RPC builds a fixed jsonb — must add the new column to the
READ side too, not only the save RPC.

## (79) PRO CATALOG — TYPE-OR-SPECIFIC PACKAGE BINDING + service↔packages view (2026-06-21)
Grant's confirmed model (most was ALREADY there from #29 credit-binding; this adds the TYPE layer):
Service (One-on-One/Group/Assessment, service_type) is NOT purchased; PACKAGE is purchased (carries price +
pay_requirement), grants credits, and binds to a specific service OR a service TYPE OR any. Booking spends a
covering credit; no covering credit → buy a matching package.
Migration `pro_package_service_type_binding` (DELTA): added service_type to pro_packages + pro_client_packages;
pro_save_package persists service_type; grant_pro_package + pro_assign_package COPY service_type to the client
package instance (alongside the existing service_id copy); pro_consume_package_credit now matches
service_id=service (specific) OR (service_id null & service_type=booked type) OR (service_id null & service_type
null = generic), ordered specific→type→generic then soonest expiry (burns least-flexible credit first);
pro_list_packages returns service_type. All assert_pro_owner guards preserved.
CLIENT: package editor (ffp-professional-client-loader.js) "For which service" → "Works for" <select> grouped:
specific services / "Any <Type> service" / Any service; savePlan parses (type: prefix / 'any' / id) into
service_id+service_type. Service editor (ffp-professional-services-loader.js) now fetches pro_list_packages and
shows "Packages that book this service" (specific + type + generic) or a "Create a package" hint. Service
"How is this paid?" was REVERTED (payment lives on the package, not the service). PRO_BUILD 53→54.
booking_payment_plan resolver: professional_session branch replaced by pro_package + provider_plan (payment =
package PURCHASE, not slot booking).
VALIDATION: openServiceModal + openPlanModal + savePlan pass isolated node --check (full-file = RULE 3 mount
truncation). DEPLOY: ffp-professional-client-loader.js + ffp-professional-services-loader.js + ffp-professional-
dashboard.html → GitHub→Netlify (Build 54). Backend unchanged. DB delta already live.

## (79b) CORRECTION — package binds to a PRO-SELECTED SET OF SERVICES (multi-select) (2026-06-21)
Grant: the professional must pick WHICH of THEIR services a package works with — no invented type/"any"
options. Superseded the service_type approach (79) with a multi-service set the pro builds themselves.
Migration `pro_package_multi_service_binding`: pro_packages.service_ids uuid[] + pro_client_packages.service_ids
uuid[] (backfilled from service_id). pro_save_package writes service_ids from p->'service_ids' (jsonb array;
service_id kept = first, for legacy name). grant_pro_package + pro_assign_package snapshot service_ids onto the
client package. pro_consume_package_credit: covers the service iff p_service = any(cp.service_ids), OR the set is
empty/null (= any) — restricted packages preferred over generic, then soonest expiry. pro_list_packages returns
service_ids + service_names[]. service_type columns left dormant (unused). All assert_pro_owner guards preserved.
CLIENT: package editor "Works for which services?" = CHECKBOXES of the pro's own services (pl-works-cb),
pre-checked from service_ids; savePlan collects checked → service_ids[] (requires >=1). Service editor "Packages
that book this service" filter now = service in pk.service_ids (empty = any). PRO_BUILD 54.
VERIFIED (rolled-back tx): package covering only service A → book A = consumed; book B = no_active_package.
Client fns pass isolated node --check. DEPLOY: ffp-professional-client-loader.js + ffp-professional-services-
loader.js + ffp-professional-dashboard.html (Build 54) → GitHub→Netlify. DB live; backend unchanged.

## (80) FACILITY PAYMENT MODES — slice 1: PLAN "How is this paid?" (2026-06-21)
Grant: facilities do ALL — drop-in direct pay + class-packs + memberships. Started with the clearest parallel
to the pro package: the facility PLAN (membership/pack) payment control.
Migration `provider_plan_pay_requirement`: provider_save_plan + provider_list_plans now persist/return
pay_requirement (column already existed); assert_provider_owner guards preserved.
CLIENT: provider plan editor (ffp-provider-members-loader.js openPlanModal/savePlan) gained the "How is this
paid?" <select> (Free / Pay online if available / Online payment required), default 'optional'. Loader bumped
ffp-provider-members-loader.js ?v=5→6 in ffp-provider-dashboard.html _provLoaderSrc. Isolated node --check OK.
DEPLOY: ffp-provider-members-loader.js + ffp-provider-dashboard.html → GitHub→Netlify.
REMAINING FACILITY WORK (sliced to keep quality; flagged, not yet built):
  (a) Facility plan "works for which classes/services" binding — BLOCKED on tracing the facility credit-
      consumption path: provider_member_plans has NO service binding and it's unclear which fn decrements its
      credits for which bookable (create_booking creates pending/unpaid, doesn't consume). Must trace before
      building the binding so it's correct (avoid pro-side churn).
  (b) Facility LISTING "How is this paid?" (drop-in): classes/events/experiences are owner-RLS DIRECT-table
      edits (no save RPC) → add pay_requirement to those client editors' payloads; provider_sessions via
      provider_save_session + session_templates (template→session propagation needed).
  (c) MEMBER booking screen — branch on booking_payment_plan.action (free/pay_online/book_offsystem/blocked).
rch + country/city/duration/date, no provider, no GPS → log_activity RPC. These are separate by design; do not merge.
- ffp-member-checkin-loader.js **v2** (script ref `?v=2`): removed the full-taxonomy fallback in openContext (was falling back to FFP_TAX when a provider had no activities — wrong). Now: provider activities only; if none listed, shows "this venue hasn't listed its activities yet → use Log Activity" instead. Modal is now FULL-PAGE (`.ci-sheet.full`, 100dvh) with a scrollable list of TAPPABLE activity buttons (`.ci-act`, selected = yellow `.sel`) instead of a <select>; selection held in `_pickedAct`, exposed via FFPCheckin._pick. DEPLOY ffp-member-checkin-loader.js.
- PROVIDER PROFILE SAVE fixed (ffp-provider-profile-loader.js **v10**): the auth.uid() trap struck again — the old direct providers.update silently wrote 0 rows (activities/lat/lng/maps_url never saved) and provider_hours insert hard-failed RLS (42501, see Grant's screenshots). FIX: new SECURITY DEFINER RPC `provider_save_profile(p_provider uuid, p jsonb, p_hours jsonb)` (GRANT anon, authenticated) — updates providers (all profile fields incl. activities/latitude/longitude/maps_url) + replaces provider_hours in one call; returns true. Loader realSaveProfile now calls it and only confirms on data===true. VERIFIED via SQL: provider_hours got the inserted row (day 3, 08:00–20:00). DEPLOY ffp-provider-profile-loader.js.

## 6d. CHECK-IN CONSOLIDATION + NAMING (2026-06-01)
NAMING RULE (Grant): NO version suffixes in filenames anywhere (-v2 etc.). Version lives in the file header comment + the `?v=` cache-bust on the <script> tag. One clean filename per file.
- NEW single member check-in file: **ffp-member-checkin-loader.js** (v1). Self-contained (own CSS, scanner, ?venue= handler, provider-activity list, GPS verify, RPC save). Member dashboard <script> now points to `ffp-member-checkin-loader.js?v=1` (was the phantom ffp-member-quest-scan-loader-v2.js).
- DELETE FROM GITHUB (replaced, now orphaned): `ffp-member-quest-scan-loader-v2.js` (was the live one) AND `ffp-member-quest-scan-loader.js` (older non-v2). Both superseded by ffp-member-checkin-loader.js.
- TRADE-OFF: the old quest-scan loader also did scan→quest-stamp; the new checkin-loader does ACTIVITY check-in only for now. Fold quest stamping + challenge completion back into ffp-member-checkin-loader.js when building the Quests loop (#72). Provider-side quest approval (ffp-provider-quests-loader.js) is untouched.
- DATA LAYER live: providers.activities text[] (activities offered); activity_logs + verified/checkin_lat/checkin_lng; RPC venue_checkin_activity(p_me,p_provider,p_activity,p_duration_min,p_notes,p_lat,p_lng)→json{id,verified,distance_m,venue} (verified = within 250 m of provider lat/long). GRANT anon/authenticated.
- PROVIDER SETUP BUILT (ffp-provider-profile-loader.js v7): "Activities we offer" chips (→ providers.activities[]) + "Venue location" current-location capture (→ providers.latitude/longitude), injected into #panel-profile; load + save wired (rides the existing providers.update().eq('id',id) path; also fixed country missing from the select). This feeds the member check-in's activity list + GPS verification. CHECK-IN LOOP NOW COMPLETE end-to-end. Deploy ffp-provider-profile-loader.js.
- SINGLE member entry point: the yellow "Scan QR" button on the Passport panel (openScanLog → FFPCheckin.scan) + the ?venue= link.
- VENUE LOCATION = Google Maps link (Grant's call, "backend resolves any link"): provider pastes their Maps link in the profile → "Find pin" calls backend GET /api/geo/resolve?url= (backend v50: follows short-link redirect via fetch, parseLatLng from @lat,lng / !3d!4d / q= / ll= / final URL / body) → sets providers.latitude/longitude; the link itself is stored in providers.maps_url (new column) for a member "Directions" button. ffp-provider-profile-loader.js v8. parseLatLng verified on all formats; short links resolve server-side. DEPLOY: backend v50 (Vercel) + ffp-provider-profile-loader.js v8 (Netlify). CORS already '*'. The loader no longer injects a Quests-panel button.

## 6c. PROVIDER QR CHECK-IN → PASSPORT ACTIVITY (2026-06-01) — core loop live
Provider QR encodes `ffp-member-dashboard.html?venue=<provider_id>` (ffp-provider-venue-qr-loader.js — fixed: it was selecting providers.passport_no which doesn't exist → blanked the QR card; now selects business_name only). Member scan flow (ffp-member-quest-scan-loader.js): scan/paste → context sheet now leads with **"Log activity"** → activity picker (FFP_TAX.activities) + optional duration → RPC `venue_checkin_activity(p_me, p_provider, p_activity, p_duration_min, p_notes)` (SECURITY DEFINER, GRANT anon/authenticated) inserts activity_logs with provider_id + venue=business_name + city/country from the provider. TESTED ✓ (insert+cleanup). Quest check-in branch unchanged. EVENT check-in = next layer (provider as event organizer → member checks into their event → logs activity); still "Coming soon" in the sheet. DEPLOY: ffp-member-quest-scan-loader.js + ffp-provider-venue-qr-loader.js (RPC already live).

## 6b. PROVIDER/ADMIN ACCOUNTS MUST NOT APPEAR AS MEMBERS (2026-06-01)
A provider = a members row with role='provider' (needed for login). They must NEVER count/show as community members. Locked down on every surface:
- `get_match_pool` RPC (Matches deck): already had `AND m.role='member'` ✓.
- members RLS: ONLY `members_self_all` (auth.uid()=id OR is_admin()) — a member can't read other members directly; discovery only via SECURITY DEFINER RPCs (filtered). ✓.
- Admin **Members** panel (ffp-admin-members-loader.js): `.filter(m => m.role==='member')` ✓.
- `admin_overview()` RPC: members_total now `WHERE coalesce(role,'member')='member'` (providers/admin excluded from the count). Recent-activity feed KEEPS provider-role members but LABELS them "Joined as a provider contact" (vs "Signed up · paid" for members); admins hidden from the feed; provider-applications union limited to status='pending'. (Grant's call: show provider contacts, identified — don't hide.) Live in DB; Overview caches client-side so hit Refresh to see it. ✓.
- `get_ranking_pool()` RPC (leaderboards): added `AND coalesce(role,'member')='member'`. ✓.
- Admin **Analytics** (ffp-admin-analytics-loader.js): members fetch now `.eq('role','member')`. ✓.
RPCs are SECURITY DEFINER, live in DB (no deploy). Frontend to deploy: ffp-admin-analytics-loader.js (+ the earlier ffp-admin-members-loader.js / admin v36). NOT yet role-checked (low risk, provider-facing only): provider_event_rsvps / provider_experience_applications (they show members who RSVP'd/applied to a provider's own listing).

## 6. TAXONOMY → DATABASE (admin-editable, live everywhere) — ✅ BUILT 2026-06-01 (flat lists)
DONE: `public.taxonomy_items(list_key,value,label,sort_order,active)` table + RLS (anon/auth read active; admin read-all + write via is_admin). Seeded 183 items from code defaults: activity 97, nationality 60, category 12, fitness_level 5, gender 4, age_group 5. Admin **Taxonomies** panel = real CRUD via `ffp-admin-taxonomies-loader.js` v1 (add / rename / reorder / show-hide / delete per list). `assets/ffp-taxonomy.js` **v4** hydrates `FFP_TAX` (and `FFP_CONST.providerCategories`) from the table on load, mutating arrays IN PLACE; hardcoded lists remain the fallback if Supabase isn't present (fail-safe, no breakage). Exposes `window.FFP_TAX_READY` (promise) + fires `ffp-tax-ready` event. DEPLOY: admin v33 + ffp-admin-taxonomies-loader.js (new) + assets/ffp-taxonomy.js v4.
PROPAGATION CAVEAT: hydration is async — forms built on DOMContentLoaded use whatever's loaded at that moment. On pages that load supabase-js BEFORE ffp-taxonomy.js (apply, all dashboards) the fetch client exists; instant propagation to an ALREADY-rendered dropdown needs the form to await FFP_TAX_READY / listen for 'ffp-tax-ready' (wire per-form later if needed). A page refresh always shows latest.
STILL TODO: CITIES are country-nested (cascade) — NOT in this flat editor yet; activities here lose category grouping 'c' for NEW items (preserved for existing by name). Unify the split level vocab later.

### (original notes kept for reference)
GOAL: one DB-driven taxonomy that the Admin dashboard edits and EVERY form reads live, so admin changes propagate platform-wide.
CURRENT STATE (the problem): taxonomy is split + mostly hardcoded, admin can't edit.
- Hardcoded in `assets/ffp-taxonomy.js` (FFP_TAX: activities ~95, cities 58-country map, fitnessLevels, nationalities, genders, ageGroups, professionalRoles) — member side reads this.
- DB tables exist: `activity_types` (379, LIVE source for provider pickers, now anon-readable), `activities`, `cities`.
- Admin "Taxonomies" panel (`panel-taxonomies`, ffp-admin-dashboard.html ~1840) is a STUB — Activities tile = `onclick="showToast('Activities editor coming')"`, no loader, no DB write path.
- Duplicates/conflicts: events-loader `FFP_CATEGORIES` (23, unused); experiences-loader `FFP_CITIES` (dup of FFP_TAX.cities AND corrupted — doc text as fake cities under Turkey); THREE level vocabularies (FFP_TAX.fitnessLevels = Not Tried/Social/Competitive/Representative/Professional; events form same; experiences form = Beginner/Intermediate/Advanced/Elite/Professional; events DB check now accepts BOTH).
TO BUILD (all types, working):
1. Canonical DB tables (or one key/value `taxonomy` table) for: activities (use activity_types), categories, cities, fitness levels (UNIFY the 3 vocabs to one), event settings, experience types, nationalities/genders/ageGroups. Each with active + sort_order.
2. Admin Taxonomies panel = real CRUD writing to those tables (admins use real Supabase Auth → direct RLS writes OK; activity_types_admin policy already exists).
3. All consumers READ from DB: provider forms (activities already do; point category/city/level/setting/exp-type at DB), member dashboard (replace FFP_TAX reads), retire the hardcoded lists + the corrupted FFP_CITIES.
4. Fix the corrupted Turkey city list as part of migrating cities to DB.

## 4. FORM STANDARDS
Activity picker full-screen on mobile; Time = native tap `<input type=time>`; **Date = native single-tap `<input type=date>`** (meetup defaults today + min today; log-activity defaults today, past allowed); Country→City cascade defaulting to the member's profile location where relevant; Age From/To; labels weight 600 (`.pm-form-label`/`.form-label`); data-entry forms full-screen on mobile; native date/time/select inputs need `min-width:0; box-sizing:border-box` or they overshoot their grid column on iOS; primary CTA yellow `#FFCC00`; Location field + Google Maps link; notifications = top banner; money display USD.

## 7. PROVIDER SELF-SIGNUP — PHASE 1 ("Try for free") — BUILT 2026-06-01, AWAITING DEPLOY
GOAL (Grant + Phillip): let providers self-register → instant dashboard → build listings → admin approves to go LIVE. Free during preview. Phase 2 later = pay-to-publish (providers.paid_until / subscription_tier / monthly_fee_aed already exist).
### Auth model recap (confirmed)
A provider = a `members` row with `role='provider'` (status MUST be 'active' for signin) + a `providers` row linked by `owner_user_id = members.id`. Login is shared `login.html` (Member/Provider/Admin portals); providers go straight to `ffp-provider-dashboard.html` (no profile-complete). `ffp-provider-auth.js` lets a provider into the dashboard as long as a providers row exists — pending status is fine; the **listing-level** approval is the real gate. Backend mints an opaque random token at signin (NOT a JWT); no JWT lib present, only `crypto`.
### Chosen flow (Grant): EMAIL VERIFICATION
signup → verification email → click "Confirm email & log in" → backend marks verified, 302 → `login.html?verified=1&email=…` → login page (Partner portal preselected, email prefilled) → "Get My Code" (existing `/api/auth/reset`) → enter 6-digit code (`/api/auth/signin`) → provider dashboard.
### DEPLOY QUEUE — versions (Phase 1)
| File | Version | Deploy via |
|---|---|---|
| assets/ffp-passport-backend-main/.../index.js | **v47** | Vercel (backend) |
| provider-signup.html | **v1** (new) | GitHub main → Netlify |
| partner.html | **v4** | GitHub main → Netlify |
| login.html | **v6** | GitHub main → Netlify |
| index.html | **v9** | GitHub main → Netlify |
| ffp-admin-dashboard.html | **v35** | GitHub main → Netlify |
| ffp-admin-events/experiences/challenges-loader.js | render-on-load fix | GitHub main → Netlify |
| ffp-admin-settings-loader.js | **v1 (new)** | GitHub main → Netlify |
| ffp-provider-experiences-loader.js | exp-type/fitness from FFP_TAX | GitHub main → Netlify |
| assets/ffp-location-picker.js | re-init on ffp-tax-ready | GitHub main → Netlify |

### "REVERTS TO OLD VERSION" (admin Events/Experiences/Challenges) — FIXED 2026-06-01
Loaders augment the dashboard's inline demo modules but their init() never rendered → inline demo (Upcoming/Past/Cancelled) stayed on screen. FIX: each loader init() now calls refresh() after wiring overrides → renders real DB data + real tabs on load, permanently. (events→v2.)
### SETTINGS CONNECTED 2026-06-01
New public.admin_audit table + RLS. Dashboard AuditLog is DB-backed (add() persists, load() fetches last 50; demo seed removed). ffp-admin-settings-loader.js renders FFP Team from admin_users + loads audit on Settings open; wired in _panelScript. Platform Config readonly (from ffp-constants.js). admin_users has no name/email (auth.users not client-readable) → non-current admins show role+added only.
| ffp-admin-taxonomies-loader.js | **v1 (new)** | GitHub main → Netlify |
| assets/ffp-taxonomy.js | **v4** | GitHub main → Netlify |
| ffp-admin-events-loader.js | **v3** | GitHub main → Netlify |
| ffp-admin-experiences-loader.js | current | GitHub main → Netlify |
| ffp-admin-challenges-loader.js | current | GitHub main → Netlify |
| apply.html | **v4 (redirect)** | GitHub main → Netlify |
| backend index.js | **v49** | Vercel |

### MARKETPLACE APPROVAL PANELS — VERIFIED WORKING (2026-06-01), blocked only by stale deploy
Admin Events/Experiences/Challenges loaders (events v3 + exp + chal): default Pending tab, fetch real rows, sidebar pending badge, Approve → status='live' (Archive/Cancel too). All `node --check` OK. RLS verified: `*_member_read` has `OR is_admin()` (admin reads pending), `*_admin_all` (ALL, authenticated, admin_users) lets admin UPDATE (approve commits). DB has 3 pending events + 2 pending experiences + 0 challenges right now. The LIVE admin shows 0 only because it's the OLD deploy (footer "v1.0", panel defaulted to Past = inline demo module). DEPLOY admin v32 + the 3 admin loaders → panels show the real pending listings with working Approve. Closes provider-upload → admin-approve → member-discovery loop.

### PROVIDER INTAKE MODEL (2026-06-01, CORRECTED per Grant) — INSTANT, self-serve, NO account approval
DECISION (Grant, emphatic): a provider self-signs up and can **start using + uploading immediately**, with NO admin approval of their ACCOUNT. **There is NO Applications panel and NO provider-account approval queue.**
- Self-signup (backend v49) → `providers` row created **status='approved'** + approved_at=now() (member role=provider, owner_user_id set). They confirm email → log in → straight into the dashboard and build/upload listings. No gate.
- Admin **Providers** panel = a directory/management view (Approved / Featured / Suspended), NOT an approval queue. New providers appear under Approved. Admin can suspend/feature reactively.
- **Applications panel REMOVED** (admin v31): deleted the `ffp-admin-applications-loader.js` script tag + the `panel-applications` entry in `_panelScript`. apply.html / `provider_applications` is dead legacy (homepage links /partner → /provider-signup, not /apply).
- Reverted the v30 "Pending" provider tab — that wrongly implied account approval.
- LISTINGS (events/experiences/challenges) still save `status='pending'` via provider_save_listing; whether they auto-go-live or need a per-listing approval (in the content panels) is the OPEN question — confirm with Grant. The ACCOUNT itself is never gated.
- DB: test row deleted; ran `update providers set status='approved' where status='pending'`.
- apply.html RETIRED → now a redirect to /provider-signup.html (v4). It used to write `provider_applications` (orphaned once Applications panel removed). No more applications created.
- FORGE FITNESS migration (2026-06-01): "Forge Fitness + Performance" (Phil Elder, phil@forgefitness.ae) had applied via the old form → sat in provider_applications, so it never showed in the Providers panel. CONVERTED to a real provider: created member (role=provider, status active, id 7b0307bf-f43e-4817-903c-bdf4dac6171a) + providers row (id 370cb2dc-dfd0-48b3-8147-7ffdf0f9bba2, status approved). Phil logs in at /login Partner portal → enter email → "Get my code" (no password). provider_applications row marked status='approved' (constraint allows pending/approved/rejected, NOT 'converted').

### Files changed (DEPLOY these)
1. **assets/ffp-passport-backend-main/.../index.js** — added (after `/api/auth/reset`, ~L628): `signProviderToken`/`verifyProviderToken` (HMAC-SHA256 over `memberId.expiry` using server-only `SUPABASE_SERVICE_KEY`, 7-day expiry, timingSafeEqual), `sendProviderVerifyEmail`, `POST /api/provider/signup` (validates; 409 if email exists; inserts member role=provider/status=active/verified=false + providers row status=pending; rolls back member if provider insert fails; emails verify link built from `https://${req.get('host')}`), `GET /api/provider/verify` (validates token → sets members.verified=true → 302 to login). Syntax + token round-trip verified. **DEPLOY: push backend to Vercel (ffp-passport-backend.vercel.app). No new env vars required** (reuses SUPABASE_SERVICE_KEY + SMTP_*). Optional: set SITE_URL (defaults to https://ffppassport.com).
2. **provider-signup.html** (NEW) — quick signup form (business name, contact first/last, email, phone cc+num, country/city cascade, category, main activity, website, about). Posts JSON to `https://ffp-passport-backend.vercel.app/api/provider/signup`. Required: business_name, contact name, email, country, city, category. Uses ffp-constants (categories) + ffp-taxonomy (phoneCodes, activities) + ffp-location-picker (group `psignup`). Success card = "check your email" 3-step. Inline JS node --check OK.
3. **partner.html** — nav CTA "Join Now"→**"Try Free"** (/provider-signup.html); hero primary →**"Try For Free"** (/provider-signup.html), secondary now "See Partnership Options"; free-tier CTA "Start Free Listing"→**"Try For Free"** (/provider-signup.html). (bash sees partner.html as "binary"/NUL-padded in the mount — edits were made on the clean canonical copy via the Edit tool and confirmed by Read.)
4. **login.html** — DOMContentLoaded now handles `?verified=1&email=` (preselect Partner portal, prefill email, "Email confirmed" sub) and `?verify=expired|error` (fresh-code prompt).
### NOT in Phase 1 (Phase 2 / later)
Payment/pay-to-publish; admin notification when a new provider signs up (admin sees them in Providers/Applications already by status); requiring verified=true before signin (currently signin only checks status='active' — the verify click is the email-ownership proof).

## (81) FACILITY MEMBERSHIP/PACK — session binding + unlimited-vs-credit consume (2026-06-21)
Grant's facility model: term/recurring membership = UNLIMITED access to its sessions; class pack = N credits
spent per session. Partner selects WHICH sessions (session_templates) a plan covers (book_session books
provider_sessions via occ.template_id; the `classes` table is the separate Experiences product).
Migration `provider_plan_session_binding_data`: provider_plans.template_ids uuid[]; provider_member_plans
.template_ids uuid[] + plan_type text (backfilled from plan). provider_save_plan persists template_ids;
grant_member_plan + provider_assign_plan snapshot template_ids + plan_type onto the member plan; provider_list_plans
returns template_ids + session_names[]. All assert_provider_owner guards preserved.
Migration `book_session_membership_binding_consume`: rewrote book_session credit branch — picks an active plan
that COVERS the session (template_ids empty/null = all, else occ.template_id = any(template_ids)) AND is a
membership (plan_type recurring/term → UNLIMITED, no decrement) OR a pack with credits_remaining>=qty (→
decrement). Order: membership first (don't burn pack credits), then session-specific over covers-all, then
soonest expiry. paid_with='membership'|'credit'. ALSO fixed book_session identity guard auth.uid()<>p_member →
current_member_id() bridge (cross-surface, like #50/create_booking).
VERIFIED (rolled-back tx): term membership covering session → paid_with=membership, credits_left=null (no
decrement); pack covering session → credit, 5→4; pack covering a DIFFERENT session → needs_payment.
CLIENT: facility plan editor (ffp-provider-members-loader.js openPlanModal now async) fetches
provider_list_session_templates and shows "Works for which sessions?" checkboxes (pm-works-cb), pre-checked from
template_ids; savePlan collects → template_ids[] (empty = every session). Loader ?v=6→7. Isolated node --check OK.
DEPLOY: ffp-provider-members-loader.js + ffp-provider-dashboard.html → GitHub→Netlify. DB live; backend unchanged.
NOTE: pro_book_slot still has the legacy auth.uid()<>p_member guard (same native-auth issue) — fix next for
parity. Facility LISTING drop-in "How is this paid?" + member booking screen still pending.

## (82) FACILITY MANUAL PAYMENT → GRANTS PLAN + pro_book_slot identity parity (2026-06-21)
(a) Migration `pro_book_slot_identity_bridge`: pro_book_slot guard auth.uid()<>p_member → current_member_id()
    (cross-surface, parity with #50/book_session). Verified pro_book_slot now references current_member_id().
(b) Grant's reminder: facilities (like pros) must manage WITHOUT on-system payment — record manual input
    (cash/bank deposit/direct debit) that GRANTS the plan. The facility ALREADY had a manual ledger
    (provider_save_payment / provider_payments, method field) but it was free-text revenue only — no plan
    link, no credit grant. Brought to PARITY with the pro billing flow (all client, ffp-provider-billing-loader.js):
    - PAY_METHODS expanded: + bank_deposit, direct_debit, cheque (was cash/card/transfer/online/other).
    - _ensureBillPlans (provider_list_plans) + _payPlanPick (auto-fills amount/description from the chosen plan).
    - Payment modal: new "Plan purchased (optional)" picker — a plan OR "Other / one-off (no plan)" (keeps
      drop-in/misc revenue free-text). 
    - savePayment: records provider_save_payment with plan_id; if a plan + member chosen → calls
      provider_assign_plan (grants the membership/credits, snapshotting template_ids+plan_type per #81). Validates
      "choose the member who bought this plan". One toast: "Payment recorded · plan granted" / soft error if grant fails.
    Loader ffp-provider-billing-loader.js ?v=3→4. Isolated node --check OK.
DEPLOY: ffp-provider-billing-loader.js + ffp-provider-dashboard.html → GitHub→Netlify. DB live; backend unchanged.

## (83) FACILITY LISTING drop-in "How is this paid?" — slice 1: SESSIONS (2026-06-21)
Migration `session_template_pay_requirement`: added pay_requirement to session_templates (default optional);
provider_save_session_template persists it AND copies it into every generated provider_sessions row (so the
booking_payment_plan resolver, which reads provider_sessions.pay_requirement, reflects the template setting);
provider_list_session_templates returns it. assert_provider_owner guard preserved.
CLIENT: ffp-provider-scheduling-loader.js openTemplateModal + saveTemplate gained the "How is this paid?"
<select> (drop-in payment for non-members; members on a covering plan book with credits). Loader ?v=21→22.
Isolated node --check OK. DEPLOY: ffp-provider-scheduling-loader.js + ffp-provider-dashboard.html → Netlify.
REMAINING: marketplace listings classes(Experiences)/experiences(Trips)/events "How is this paid?" (columns
already exist; editors need the dropdown — check save path direct-table vs RPC); then MEMBER booking screen.

## (83b) SECURITY — provider_save_listing owner guard (2026-06-21) — DB ONLY
provider_save_listing(p_kind, p_provider, p_id, p) (unified save for event/experience/class/challenge) had
NO owner guard — anyone could INSERT a listing under any provider (updates were already p_provider-scoped).
Migration `provider_save_listing_owner_guard`: injected `perform assert_provider_owner(p_provider)` after the
null-check. Verified guarded + near top. NO DEPLOY.
DEFERRED: marketplace-listing drop-in pay_requirement (Experiences/Trips/Events) — columns exist + default
'optional' already gives correct behaviour; the 150-line provider_save_listing has 6 insert/update spots so
threading the field is higher-risk for low marginal value (these are inherently pay-to-attend). Revisit if needed.
NEXT (the big consumer payoff): MEMBER booking screen on the booking platform (FFP Booking Platform) — branch
on booking_payment_plan.action (free→book / pay_online→Stripe checkout / book_offsystem→book+settle / blocked).

## (83c) DECISION — marketplace-listing drop-in control: NOT building (2026-06-21)
Grant delegated the call ("low value, your call"). DECISION: skip. classes(Experiences)/experiences(Trips)/
events default pay_requirement='optional' which already gives correct member behaviour (pay online if partner
Stripe-connected, else book + settle off-system). Adding the toggle only enables rare 'free'/'required' edge
cases; the safe build paths (thread through 150-line provider_save_listing, or direct-table writes bypassing the
SECURITY DEFINER pattern) carry regression risk on revenue code for marginal value. Columns exist; trivial
contained follow-up if a real need surfaces. Partner payment-mode work otherwise COMPLETE (pro + facility:
services/packages/plans/sessions catalog + binding + manual-payment-grants-plan + Stripe). Member screen = Booking
team's (spec handed off: FFP Booking Platform/FFP-MEMBER-BOOKING-PAYMENT-SPEC.md).

## (84) MARKETPLACE: PAY-BEFORE-CONFIRM RULE (Experiences/Trips/Events) (2026-06-21)
Grant: paid Experience/Event/Trip can't be booked unless paid for (payment before confirmation) UNLESS the
partner explicitly allows otherwise. (Reverses the earlier "skip" — this is a real rule.)
Migration `marketplace_pay_before_confirm_default`: classes/events/experiences pay_requirement DEFAULT → 'required';
backfilled existing PAID rows optional→required (2 trips, 3 events, 6 experiences); provider_save_listing now
threads p->>'pay_requirement' (single guarded step before return; coalesce default 'required') for event/
experience/class. Resolver already turns 'required' into action pay_online (partner on Stripe) / blocked_no_stripe
(not) — so the member screen must take payment before confirming.
CLIENT (partner opt-out toggle "Allow booking without upfront payment", default OFF=required):
  - classes (Experiences) ffp-provider-classes-loader.js: select+form toggle (cm-allow-unpaid)+payload. ?v=20→21.
  - experiences (Trips) ffp-provider-experiences-loader.js: mapForUi+default+select+form toggle (xm-allow-unpaid)+
    payload. script ?v=15→16.
  - events ffp-provider-events-loader.js: mapForUi+select+payload wired (em-allow-unpaid); FORM toggle deferred
    (multi-step tier-pricing wizard) — events stay 'required' (appropriate for ticketed events). script ?v=17→18.
All 3 loaders node --check OK. provider_save_listing owner guard (83b) preserved.
Spec updated for Booking team (FFP Booking Platform/FFP-MEMBER-BOOKING-PAYMENT-SPEC.md): marketplace defaults to
'required' → don't confirm until paid.
DEPLOY: ffp-provider-classes-loader.js + ffp-provider-events-loader.js + ffp-provider-experiences-loader.js +
ffp-provider-dashboard.html → Netlify. DB live.
TODO (small): events form opt-out toggle in the Pricing step.

## (85) #1 END-TO-END BOOKING+PAYMENT VERIFICATION (2026-06-21) — all green, no deploy
Ran a full lifecycle in a ROLLED-BACK tx, ALL via a simulated NATIVE booking-platform session (claims sub=user_id)
to also prove the cross-surface identity bridge end to end. Results:
  1 facility session on TERM membership → paid_with=membership; cancel ok refund_pct=100.
  2 facility session on PACK → credit credits_left=4; cancel returns credit (back to 5) credit_returned=true.
  3 facility session no plan → needs_payment.
  4 pro slot on covering PACKAGE → credit; cancel returns credit (5) credit_returned=true.
  5 marketplace class → create_booking ok; resolver action=blocked_no_stripe (paid class, partner not on Stripe →
    not bookable online — exactly the pay-before-confirm rule); cancel ok.
  6 member_my_bookings(members.id) == member_my_bookings(user_id) → same set.
System hangs together across credit/membership/package/drop-in + cancel/credit-return + resolver + cross-surface.

## (86) #2 PUBLISH-TIME STRIPE GATE for paid marketplace listings (2026-06-21)
Rule: to LIST a paid Experience/Trip/Event the partner must connect Stripe (payment-before-confirmation needs it),
unless they explicitly allow booking without upfront payment (Experiences/Trips only; Events stay required).
- ffp-provider-auth.js: FFP_PROVIDER now carries payments_status + stripe_account_id (added to the providers
  select + the FFP_PROVIDER object). Script ?v=7→8.
- saveClass (classes/Experiences): if price>0 && !allow-unpaid && payments_status!=='connected' → block save with a
  prompt to connect Stripe or tick the allow box. ?v=21→22.
- experiences (Trips) save: same gate (xm-allow-unpaid). script ?v=16→17.
- events save: paid = price>0 OR any ticket-tier price>0; if paid && !connected → block (no allow opt-out — events
  stay payment-required). script ?v=18→19.
saveClass passes isolated node --check (full-file = RULE 3 truncation). DEPLOY: ffp-provider-auth.js +
ffp-provider-classes-loader.js + ffp-provider-events-loader.js + ffp-provider-experiences-loader.js +
ffp-provider-dashboard.html → Netlify. DB unchanged.

## (87) NOTIFICATIONS + EMAIL — FULL COVERAGE AUDIT & FIX (2026-06-21) — DB ONLY, LIVE
Audited every booking + meetup stage × party × channel. Member email = a WHITELIST of titles on the
notifications AFTER-INSERT trigger (ffp_notification_member_email → /api/notifications/email-member); hosts
link to a members.id (professionals.member_id / providers.owner_user_id) so routing host notifications through
the notifications table emails them too.
GAPS FOUND + FIXED (migration `booking_notifications_full_coverage`):
  - Marketplace bookings (class/event/experience) notified NOBODY on the host side. Facility-session bookings
    emailed the host but no in-app. Member-cancel notified NO host (in-app or email).
  - Retired the session-only host-email trigger (ffp_booking_host_email); unified on the notifications pipeline.
  - NEW trg_booking_notify (AFTER INSERT): host 'New booking' notification (provider owner, all provider-side
    types; pro slots still notified inside pro_book_slot — no double) + member 'Booking confirmed' (status=confirmed).
  - Rewrote ffp_notify_booking_change: actor now = current_member_id() (cross-surface fix; raw auth.uid() was wrong
    on the booking platform) + when the MEMBER cancels → notify the HOST.
  - Whitelist += 'New booking','Booking rescheduled' → hosts emailed on new bookings; member-cancel emails host via
    existing 'Booking cancelled'.
  VERIFIED (rolled-back): new booking → host in-app YES + member confirm YES; member cancels → host notified YES.
MEETUPS (migration `meetup_notifications_email_coverage`): in-app already covered all flows; emails were missing
(titles not whitelisted; join title was dynamic). join_meetup title → fixed 'New join request' (name in body);
whitelist += 'New join request',"You're confirmed!",'Join request withdrawn','Someone left your meet-up',
'Meet-up cancelled'. VERIFIED (rolled-back): request→host, confirm→attendee, attendee-leave→host, host-cancel→
attendee all notify + are now emailable.
NO DEPLOY (all DB; emails use the already-deployed /api/notifications/email-member). NOTE: appointments product
(provider_book_appointment / confirm / no_show / reschedule) not audited here — verify separately if it doesn't
write to the bookings table (booking triggers only cover the bookings table).

## (88) APPOINTMENTS — notification/email coverage (was ZERO) (2026-06-21) — DB ONLY, LIVE
Audit: appointments live in provider_appointments (NOT bookings; member_id=client; host-initiated via
provider_book_appointment, assert_provider_owner). ALL appointment fns (book/confirm/cancel/no_show/reschedule)
wrote NO notifications + NO email → appointments had ZERO notify coverage.
Migration `appointment_notifications_coverage`: ffp_appointment_notify() trigger on provider_appointments —
AFTER INSERT (status scheduled) → member 'New appointment'; AFTER UPDATE status→cancelled → 'Appointment
cancelled'; start_at changed (not cancelled) → 'Appointment rescheduled'. (confirm/no_show = host admin states,
no member notif.) Whitelist += 'New appointment','Appointment cancelled','Appointment rescheduled' → emailed too.
VERIFIED (rolled-back): book/reschedule/cancel → member notified YES (×3). NO DEPLOY.
NOTIFICATION/EMAIL COVERAGE NOW COMPLETE across: bookings (all 5 types, member+host), meetups (request/confirm/
leave/cancel, host+attendee), appointments (book/cancel/reschedule → member). All in-app + email via the
unified notifications→/api/notifications/email-member pipeline.

## (89) ADMIN NOTIFICATIONS + EMAIL (2026-06-21) — DB ONLY, LIVE
Admin = members role admin/super_admin; admin_users.id = members.id (1 admin: admin@findfitpeople.com).
Migration `admin_notifications_coverage`: helper ffp_notify_admins(title,body,link) inserts an audience='admin'
notification for every admin_users row (→ in-app + email via whitelist). Triggers AFTER INSERT:
provider_applications → 'New partner application'; feature_requests → 'New featured request'; payouts (status
pending) → 'New payout request'. Trigger on events/experiences/classes (INSERT/UPDATE → status 'pending', on
transition) → 'Listing to review'. Whitelist += those 4 titles → admin emailed via /api/notifications/email-member.
VERIFIED (rolled-back): notify_admins helper, payout-request, event→pending all reach the admin.
CAVEAT: admin EMAIL is reliable (whitelisted). Admin IN-APP shows only if the admin dashboard reads the
notifications table for the admin's member_id / audience='admin' (member dashboard does; admin dashboard not
verified here). Not covered (optional follow-ups): content_submissions review, member 'applications'.
NOTIFICATIONS/EMAIL now span members, professionals, partners, AND admin across bookings/meetups/appointments/
approvals/payouts/feature-requests.

## (90) LOG ACTIVITY — MULTI-PHOTO (up to 8) + GREEN SAVE-STRAP (2026-06-22)
DB migration `activity_logs_multi_photo` (LIVE): activity_logs.photos text[] added (cover stays in photo_url).
log_activity/update_activity: dropped 16-arg, recreated as 17-arg with p_photos text[] (null-filtered, trimmed,
capped 8; cover = photos[1] → photo_url). update with p_photos NULL keeps existing photos (no wipe). Read RPCs
member_activity_view + member_partner_activities now return photos. VERIFIED rolled-back: insert 3 → cover=#1;
view returns array; update→2 photos moves cover to new #1; null-photos update preserves the set.
Backend index.js v101 (NEEDS DEPLOY): GET /api/members/:id/activity-logs select += photos.
Frontend (NEEDS COMMIT):
  - ffp-member-dashboard.html v360, FFP_BUILD 402→403:
    * Log modal: single photo box → horizontal-scroll strip (#log-photos-strip), up to 8, first=COVER, ×-remove.
      window._logPhotos[]; ffpRenderLogPhotos / ffpLogPickPhoto / ffpLogRemovePhoto / ffpLogSetPhotos. saveLog
      sends p_photos + p_photo_url=cover. _ffpSaveThenShare carries photos.
    * Activity card hero → x-axis scroll-snap gallery when >1 photo; fixed caption/scrim (pointer-events:none);
      1/N counter updates on scroll. Single/zero photo = unchanged.
    * showToast(msg,type): type-based. SUCCESS = wide GREEN strap, full-width, centered text (every saved/
      confirmation message). CSS .toast-success/.toast-error/.toast-info/.toast-warning added.
    * Edit prefill Country+City via _ensureSelectOption → persist exactly as saved unless changed.
  - assets/ffp-fitness-stats-loader.js (cache-bust via FFP_BUILD 403): maps r.photos on load+reload; list
    thumbnail shows a photo_library + count badge when >1.
UPDATE = NO NOTIFICATION: confirmed — edit path never calls /api/activity/notify and activity_logs has no
notify triggers. JS validated (node --check: loader, backend, isolated dashboard funcs all pass).
DEPLOY: commit the two frontend files (Netlify) AND index.js (Vercel) — photos only appear in the LIST after the
backend deploy; the activity card + log modal work as soon as the frontend is live.

## (91) PARTNER APPOINTMENTS CALENDAR — EMPTY (DUPLICATE FN) + EMAIL DETAILS (2026-06-22)
SYMPTOM: partner booked client into coach slots (Mon 8am/11am, Grant Goes w/ Hamd Khan @ Forge Fitness);
confirmation email arrived but the booking never showed on Appointments → Calendar tab.
ROOT CAUSE (client, not data): ffp-provider-appointments-loader.js declared `_apRangeBounds` TWICE — the
calendar version (line 122, returns Date {from,to}) and a REPORTS version (line 1118, takes a key, returns
ISO strings; with no key → {from:null,to:null}). JS hoisting → the later decl wins for ALL calls, so
apRenderCalendar()'s `_apRangeBounds()` hit the reports version → null bounds → `rb.from.toISOString()` threw
→ swallowed by try/catch → _apAppts=[]. Calendar showed ZERO appointments for everyone, always (data + RPC +
owner-guard were all fine — verified the 2 rows exist, join cleanly to active staff+member, provider owner =
7b0307bf passes assert_provider_owner). FIX (RULE 0.5, no patch): renamed the reports fn → `_apReportRange`
(+ its sole caller in apRenderReports). Calendar's `_apRangeBounds` (122) is now the only one. node --check OK.
Cache-bust: appointments loader ?v=10→11 in _provLoaderSrc (provider dashboard). After apSaveBooking the code
already calls apRenderCalendar() → now shows immediately. NEEDS COMMIT: ffp-provider-appointments-loader.js +
ffp-provider-dashboard.html (Netlify).
EMAIL DETAILS: migration `appointment_notify_full_details` (LIVE) — ffp_appointment_notify() body now includes
COACH (provider_staff.full_name) + LOCATION (providers.business_name + area/city) alongside service + date/time
(facility tz). Applies to New/Rescheduled/Cancelled appointment member notifications (→ email via whitelist).
VERIFIED body: "Your Personal Training with Hamd Khan at Forge Fitness + Performance, Meydan is booked for
Mon 22 Jun, 08:00." DB-only, no deploy. (Affects future bookings; the 2 already-sent emails were the old thin
form.)

## (92) MULTI-PHOTO FIXES — STRAP HIDDEN + CARD NOT SHOWING EXTRA PHOTOS (2026-06-22)
Grant test feedback: (a) extra photos "not saving", (b) green save-strap not showing — goes straight to Share.
DIAGNOSIS (verified): photos ARE saving — latest activity_logs row had photos[2] populated, cover=photo_url.
So (a) is a DISPLAY issue: the recent-activity LIST reads the backend endpoint /api/members/:id/activity-logs;
the photos[] column only returns once index.js v101 is deployed (Vercel), and the card opened from the list used
that cached (photo-less) row → showed 1 photo. (b) the share sheet overlay is z-index 100060 but the toast was
100000 → the strap rendered BEHIND the share screen.
FIXES (frontend only, NEEDS COMMIT):
  - ffp-member-dashboard.html v361, FFP_BUILD 403→404: toast z-index 100000 → 2147483000 (strap now shows over
    the share sheet, across the top — matches "before/while going to share").
  - assets/ffp-fitness-stats-loader.js: ffpOpenActivityCard now async — when the cached row has ≤1 photo it
    fetches member_activity_view (DB source of truth) and merges photos[] before rendering, so the x-axis gallery
    shows ALL photos WITHOUT depending on the backend list deploy. Isolated node --check OK (full-file bash check
    is unreliable here — the workspace mount serves a TRUNCATED copy; Edit/Read file API is intact).
NOTE: the LIST thumbnail count badge still needs index.js v101 deployed (list comes from backend). The card
gallery + save strap work as soon as the two frontend files are live.

## (93) PRO DASHBOARD — NOTIFICATIONS DRAWER + WORKFLOW-ONLY FILTER (2026-06-22)
ffp-professional-dashboard.html, PRO_BUILD 54→55 (NEEDS COMMIT, Netlify).
LAYOUT: the small top-right .nt-menu dropdown is now a right-side DRAWER matching the member Passport —
position:fixed, width:50vw (min 320 / max 480), height:100dvh, translateX slide-in, over a 60% scrim
(.nt-scrim). Added a close (×) button in the header; scrim + outside-click close it.
TYPE STYLE: each item now renders TITLE bold (800) on its own line and BODY in regular weight (400, muted)
beneath — was one bold "title — body" line.
WORKFLOW-ONLY: a pro shares one account with their member self, so the bell feed carried member-social noise.
New _proNotifIsWorkflow(n) filters loadProNotifs + the badge to professional-workflow items only — DROPS
member-personal/social by title ('logged an activity','added your passport','high five','wants to connect',
'wants to join','recommends a connection','meet-up','congratulated','you’re confirmed','your ffp booking',
'new connection','near you') and by member deep-link (activity=, #connections, panel-passport/meetups/fitness,
meetup=, rec=). KEEPS New booking / Booking cancelled / rescheduled / appointments / data-sharing / profile
approved / packages / payments etc.
BADGE: now counts only unread WORKFLOW items, using a local seen timestamp (localStorage ffp_pro_notifs_seen,
set on open) instead of the server's all-notifications unread count — so badge ↔ panel stay consistent and the
pro badge is decoupled from the member feed. Client-only; no backend/DB change. node --check (isolated) OK.

## (94) PRO NOTIFICATIONS — LIGHT CONFIRM + #0a3e44 ICONS + CLEAR ALL (2026-06-22)
ffp-professional-dashboard.html, PRO_BUILD 55→56 (NEEDS COMMIT, Netlify).
Grant feedback on (93): wants the LIGHT theme, branded #0a3e44 icon, and Clear all at top.
- LIGHT: the drawer already uses the pro light vars (--ffp-bg-2 #fff, --ffp-text #0f2327); the earlier dark
  show_widget PREVIEW was misleading, not the code. Re-previewed light to confirm.
- ICON: notification item icon colour set explicitly to #0a3e44 (was var(--ffp-purple), which already = #0a3e44
  in :root — now hardcoded for clarity per request).
- CLEAR ALL: added to the drawer header (left of the × close). clearProNotifs() mirrors the member Passport —
  persisted localStorage marker ffp_pro_notifs_cleared_at hides everything created at/before now (new ones still
  arrive), sets seen, empties list + badge, POSTs /notifications/seen. New _proNotifVisible() applies BOTH the
  workflow filter AND the cleared-at marker in loadProNotifs + proNotifBadge. node --check (isolated) OK.

## (95) PARTNER PORTAL — COSMETIC: SIDEBAR LOGO + CALENDAR COLOURS/24h + BOOK-GATE + DETAIL (2026-06-22)
Files (NEEDS COMMIT, Netlify): ffp-provider-dashboard.html, ffp-provider-appointments-loader.js (?v 11→12),
ffp-provider-profile-loader.js (?v 17→18).
1) SIDEBAR FOOT LOGO: bottom-left mark now shows the partner's logo (providers.logo_url) when set, else the
   initial. Set on BOOT (profile loader init after fetchProfile) + on SAVE (realSaveProfile) + dashboard
   saveProfile fallback. .sb-foot-mark gets overflow:hidden.
2) APPOINTMENTS CALENDAR (day + week): full 24h always viewable (startH=0/endH=24, scrolls). Legend colours —
   AVAILABLE = yellow (#FFE8A3 band / solid open-slot chips), BOOKED = solid green #1f9d57 white text
   (_apBlockColor: all active states green; no_show red, cancelled grey), BLOCKED = dark grey #3b4750 bands
   (new _apBlocksForDayCoach renders block windows in both day + week). Day-view footer = colour legend.
3) BOOK ONLY IN AVAILABILITY: new _apWithinAvailability(coach,date,sMin,eMin) — apSaveBooking rejects times
   outside a set availability window or inside a block; apDayColClick rejects clicks outside availability
   (toast: "No availability set there — set the coach's availability first"). (Client-side gate on both entry
   points; the booking RPC itself is unchanged.)
4) BOOKING DETAIL: apApptDetail rebuilt with a solid light card (bg #eef1f3), big bold dark client name + clear
   service/coach/time lines; _apStatusChip/_apPayChip now SOLID backgrounds with white/dark legible text
   (was translucent light-on-tint, hard to read on the light theme).
Validated: profile loader node --check OK; appointments edits (258–775) node --check OK in isolation (full-file
bash check unreliable — workspace mount serves a TRUNCATED copy; Edit/Read file API intact).

## (96) WORLD-CLASS: BOOK-INTO-AVAILABILITY ENFORCED AT THE SOURCE (DB) (2026-06-22) — LIVE
Migration `book_appointment_require_availability`: provider_book_appointment already guarded coach_busy +
coach_unavailable (provider_trainer_blocks) but did NOT require the slot to be inside a SET availability
window. Added an availability guard: the [start,start+dur] must fall fully inside an active
provider_trainer_slots window for that staff on that weekday (day_of_week) or specific slot_date, in the
FACILITY timezone; else returns {ok:false,error:'no_availability'}. Now NO surface (this UI, a future one,
a direct RPC call, or a race) can create an appointment outside availability — the client-side gate (loader
v12) is just fast UX feedback; the DB is authoritative. VERIFIED (live slots, Hamd Khan Tue/Wed 09–17):
Tue 10:00→allowed, Mon 08:00→blocked, Tue 16:30 60m (overruns 17:00)→blocked, Wed 09:00→allowed. (The two
Mon 8/11am appts from entry (91) were booked pre-guard — Monday has no availability for that coach.)

## (97) BOOKER → DIRECTORY AUTO-ADD + CLIENT PROFILE (profile/notes/history) (2026-06-22)
WORLD-CLASS foundation: one canonical client directory. Migration `autoadd_provider_member_and_client_profile`:
- ffp_autoadd_provider_member() trigger on bookings + provider_appointments AFTER INSERT → upserts a
  provider_members row (by provider+email) from members (name/email/phone/city/country/photo) if absent.
  So ANY booking from the booking platform now auto-adds the member to the partner's directory. Backfilled all
  existing bookers/appointment members (Grant → Forge Fitness verified). Idempotent (email-dedup, exception-safe).
- provider_member_profile(p_provider, p_member) — accepts EITHER a provider_members.id OR a platform members.id
  (resolves both via email; plans/notes keyed on provider_members.id, appointments/packages on members.id — the
  resilient `member_id in (pmid,mid)` matches either). Returns profile (contact/photo/tags/notes) + memberships
  (provider_member_plans) + packages (provider_client_packages) + full appointment history + stats
  (total_sessions/attended/no_shows/upcoming/total_spend). VERIFIED under owner session (rolled-back): name,
  pmid, stats(8 sessions), 8 appts.
- provider_set_member_notes(p_provider,p_pmid,p_notes) — save private notes from the profile.
UI (NEEDS COMMIT, Netlify): shared window.openClientProfile(memberId) + _renderClientProfile + saveClientNotes
defined ONCE in ffp-provider-dashboard.html (uses openModalShell/escHtml — both global), so the Members loader
AND the Appointments loader both reach it. Entry points: Members list row (name block + new person button →
openClientProfile(provider_members.id)); appointment detail client NAME is now a tappable link →
openClientProfile(a.member_id). Cache-bust: members ?v 7→8, appointments ?v 12→13. JS validated in isolation
(CP block, memberRow, apApptDetail all node --check OK; full-file bash checks unreliable — truncated mount).
ALSO this turn (96): provider_book_appointment now enforces book-into-availability at the DB (source of truth).

## (98) CLIENT PROFILE — TABBED, COMPACT REDESIGN (2026-06-22)
Grant: long single-scroll + big font = weak; growing sections need their own tabs, current at top, ~12px.
Rewrote _renderClientProfile in ffp-provider-dashboard.html (NEEDS COMMIT): pinned compact header (avatar 44px,
name 15px, contact 11.5px) + 5 mini stat cells (value 14px) + SEGMENTED TABS — Sessions / Plans & packages /
Notes (new cpTab() switches panes). CURRENT-AT-TOP: Sessions pane = Upcoming (asc) above Past (desc); Plans pane
merges memberships + packages, Active group above Past, each item tagged ·Membership/·Package with status pill.
Body 12px, subheads 9.5px. Modal head title = "Client profile" (name now lives in the body header, no dup).
node --check OK. DB unchanged. (Loaders members ?v8 / appointments ?v13 from (97) still pending commit.)
## (98b) Client profile — removed boxes (2026-06-22): stat boxes → borderless editorial ribbon (divider lines); segmented pill tabs → underline tabs (platform standard). node --check OK.

## (99) CLIENT RECORD — PROFILE + PAYMENTS TABS + SEARCH (2026-06-22)
Migration `client_profile_fields_and_payments` (LIVE): provider_members += emergency_contact_name/phone,
date_of_birth, goals, health_notes. provider_member_profile extended → profile.* (those fields) + payments[]
ledger (paid sessions + package purchases + paid bookings, desc by date) + stats.total_spend now includes
paid bookings. New provider_save_member_profile(p_provider,p_pmid,p jsonb) saves the editable fields. VERIFIED
under owner session (rolled-back): profile carries emergency field, payments[] present, total_spend computed.
UI (ffp-provider-dashboard.html, NEEDS COMMIT): client record now tabbed Profile · Sessions · Plans & packages ·
Payments · Notes (underline tabs, scroll-x). PROFILE = editable partner record (given/surname, email, phone,
DOB, status, city/country, emergency contact+phone, tags, goals, health notes/injuries) → saveClientProfile().
PAYMENTS = ledger + running total. SEARCH: a search box appears on list tabs (Sessions/Plans/Payments) and
filters rows via data-cps (cpSearch). cpTab tracks _cpActive + toggles the search box. Members DIRECTORY search
already existed (#mem-search → renderMembersList). node --check OK.
NEXT (74): FORMS — partner-customizable templates from day one; member e-signs in app (digital default) +
partner upload fallback; compliance status on the profile header; Forms tab. Dedicated build.

## (100) CLIENT RECORD → FULL-SCREEN DESKTOP + THREADED NOTES + LINKED ROWS + COMPACT MEMBERS (2026-06-22)
Grant: modal must be FULL screen (world-class flow); member strap too big for 100+ (needs sort); notes must be
separate entries; each row must link/drill-in. NOTE: partner dashboards are desktop/laptop-first.
DB: provider_member_notes table (thread) + provider_add_member_note / provider_delete_member_note +
backfill legacy single notes; provider_member_profile returns member_notes[]. (LIVE, verified.)
ffp-provider-dashboard.html (NEEDS COMMIT): openClientProfile now a FULL-SCREEN overlay (#cp-overlay, esc/back/
close) with a desktop two-column layout — LEFT rail (avatar 62px, name, contact, status, stat lines, vertical
nav) + RIGHT content. Rows in Sessions/Plans/Payments are EXPANDABLE (cpToggleRow → reveals detail: service/
coach/duration/payment/price etc.) = the drill-in "link" to each item. Notes tab = THREAD: add box +
timestamped entries (cpAddNote/cpDeleteNote/_cpRenderNotes), each note separate. Profile tab editable
(saveClientProfile). Search box on list tabs (cpSearch). node --check OK (isolated; mount truncates).
ffp-provider-members-loader.js ?v 8→9 (NEEDS COMMIT): memberRow now COMPACT (34px avatar, single dense row ~50px,
whole row opens profile) — scales to 100s. renderMembersList SORT via #mem-sort: Name A–Z / Recently added /
Status. Sort dropdown added beside #mem-search in the panel.
NEXT (74): FORMS subsystem.

## (101) FORMS SUBSYSTEM (templates + e-sign + upload + compliance) + ADD PACKAGE/PAYMENT (2026-06-22)
Grant: customizable templates from day one; member e-signs in app (digital default) + partner upload fallback.
DB (LIVE, verified end-to-end in rolled-back tx): tables provider_form_templates (partner-built: title/desc/
fields jsonb/requires_signature) + provider_member_forms (assignment snapshot + responses + signature_name/
signed_at + uploaded_file_url + status outstanding|completed + source member|upload). RPCs:
provider_save_form_template / list / delete; provider_assign_form (snapshots template, resolves member_id by
email, NOTIFIES member 'New form to complete' deep-linked ?form=<id>); provider_complete_form_upload (fallback);
provider_delete_member_form; member_forms_list / member_get_form / member_submit_form (sets responses+signature,
NOTIFIES provider owner 'Form completed'). provider_member_profile now returns forms[]. Email whitelist +=
'New form to complete','Form completed'. Storage bucket 'form-files' (public) + insert/read/update policies for
authenticated. VERIFIED: template→assign→member submit (sig 'Grant Goes')→provider profile.forms shows completed.
PROVIDER UI (ffp-provider-dashboard.html, NEEDS COMMIT): client record gets a FORMS tab (assign from templates,
status pills Outstanding/Signed/Uploaded, expand to view responses+signature, upload signed copy, remove) +
a compliance strip on the header (N forms outstanding / Forms complete) + a template BUILDER (_cpDialog stacked
above the full-screen record: title/desc/require-signature + dynamic fields text/textarea/yesno/date/consent,
Start-from Waiver/PAR-Q). node --check OK (exact block, isolated).
MEMBER UI: NEW ffp-member-forms-loader.js (?v=1) — window.FFPForms.open/list; auto-opens ?form= deep link;
full-screen fill+sign screen (yes/no, consent, text/date, type-to-sign), member_submit_form. Wired into
ffp-member-dashboard.html via <script> include. node --check OK.
ADD PACKAGE/PAYMENT (Grant follow-up): client record Plans tab "Add membership / package" + Payments tab
"Sell a package / membership" → cpAddPlan dialog lists provider_list_plans/packages → cpDoAssignPlan
(provider_assign_plan) / cpDoSellPackage (provider_sell_package, payment-method picker) → refresh. node --check OK.

## (102) CORRECTION — FORMS BELONG ON BOOKING, NOT PASSPORT (2026-06-22)
MISTAKE: member-facing forms were wired into the PASSPORT (premium app). Forms/waivers are a BOOKING-PLATFORM
feature. FIX: removed the <script src="ffp-member-forms-loader.js"> include from ffp-member-dashboard.html (forms
no longer load in the Passport). The orphan loader file remains in the Passport repo, UNHOOKED (left in place;
delete was declined) — reference only, not included anywhere.
DB (LIVE): member form RPCs made AUTH-BASED so the Booking site needs no member-id handling —
member_forms_list() / member_get_form(p_form_id) / member_submit_form(p_form_id,p_responses,p_signature_name)
now resolve the member via current_member_id() (dropped the old p_me signatures). provider_assign_form
notification deep-link repointed Passport → BOOKING: https://findfitpeople.com/forms.html?form=<id>.
DO NOT TOUCH the Booking platform code (per Grant). Handoff written: FFP-FORMS-BOOKING-HANDOFF.md (in the
Passport workspace) — full spec for Booking to build forms.html + js/forms.js (auth, the 3 RPCs, field types,
submit contract, two views). Partner-side Forms (templates/assign/upload/compliance in the dashboard) stays as
built — unaffected.

## (103) MEMBER CONNECTIONS — PASSPORT SEARCH + REMOVE "FROM YOUR PEOPLE" (2026-06-22)
DB (LIVE): member_search_passport(p_me, p_q) — name search across members (excl. self), returns
{id,name,photo,city,connection: connected|requested|incoming|none}, connected-first, limit 25. VERIFIED.
ffp-connections-feed-loader.js (?v 328→329, NEEDS COMMIT): added a search box at the top of the Connections
panel (#conn-panel-root) → FFPConnFeed.search() (debounced) → member_search_passport → results rows (avatar,
name, city + status-aware connect button: Add / Accept / Requested / ✓ Connected). FFPConnFeed.connect()
mirrors MeetMove.requestConnect (insert member_connections pending, or accept incoming → accepted); row tap →
openCard (passport). REMOVED the mixed "From your people" feed section (per Grant) — a connection's activity is
seen by tapping them. node --check OK.

## (104) CONNECTIONS REFINEMENTS — MEMBERS-ONLY SEARCH + SEARCH MODAL + [NAME]'S ACTIVITIES (2026-06-22)
DB (LIVE, verified): member_search_passport now EXCLUDES admins (admin_users) + partners (providers.owner_user_id)
— only passport members (10→8 results, FFP Admin gone). New member_connection_activities(p_me,p_other,p_limit)
→ a connection's recent SHARED activities (gated: must be accepted-connected); returns id/activity/photo_url/
photos/distance/duration/city/venue/logged_at (12 for Sunjay verified).
ffp-connections-feed-loader.js (?v 329→330, NEEDS COMMIT): (1) inline search → a STRAP "Find a connection" that
opens a MODAL (openDetailModal) with the search input + results (like People You Might Click With). (2) The
"From your people" feed is now "[Name]'s activities" — tapping a connection circle selects them (yellow ring)
and renders a horizontal SLIDER of their recent activities (thumbnail/photo or icon + activity + km/min + date);
tap a card → ffpViewSharedActivity; "Passport" link opens their card. Auto-selects the most-active connection so
the slider isn't empty. New code node --check OK (full-file bash check unreliable — stale/truncated mount; real
file verified complete via Read).

## (105) PARTNER DASHBOARD — FORMS POLISH + NAV RESTRUCTURE (2026-06-22)
ffp-provider-dashboard.html (NEEDS COMMIT). DB seed (LIVE).
- "Sell a package / membership" button (Payments tab of client record) → btn-pri (blue), matching the others.
- READY-TO-SEND STARTER FORMS: migration seed_default_form_templates(p_provider) inserts full Liability Waiver
  (emergency contact + medical + 3 acknowledgement/consent statements) and PAR-Q (the standard 7 screening
  questions + details + consent). Backfilled all 4 providers + AFTER INSERT trigger on providers auto-seeds new
  ones → both appear ready in Assign form. Verified 8 templates / 4 providers.
- NAV RESTRUCTURE:
  * Memberships & Packages → its OWN top-level panel (#panel-plans, nav 'plans', icon card_membership). Moved the
    plans-list out of Members. Removed the Members "Memberships & Packages" tab.
  * Communications → "Announcements" → its OWN panel (#panel-announcements, nav 'announcements', icon campaign).
    Moved comms-list out of Members; "New announcement" compose button. Removed the Members "Communications" tab.
    (Members panel now = Directory + Teams & Rosters.)
  * Sessions panel: "Timetable" is now the FIRST/active tab (was "Sessions").
  * Wiring: _provLoaderSrc maps plans+announcements → members loader; new _callWhenReady(fn) retries until the
    lazy loader defines the render fn; showPanel hooks render renderPlans / renderComms / renderTimetable on open.
  members loader unchanged (renderPlans→#plans-list, renderComms→#comms-list — ids moved with the content). JS
  additions node --check OK (isolated; full-file bash check unreliable — truncated mount).
- (Client profile Sessions rows already expand inline to show detail — "session click shows in profile area".)
