# FFP PASSPORT — MASTER (THE single source of truth — there is only ONE)

> 🥇 THIS IS THE ONLY SOURCE OF TRUTH. Read it first, every session. If any other doc disagrees, MASTER wins.
> All other docs are reference-only and live in `/archive` (consolidated 2026-06-12 — 26 scattered docs, including
> a second file literally named "Source of Truth", were moved there so nothing competes with this file). The
> cross-app contract the booking team reads also lives in the DB `platform_docs` (key='source_of_truth'), unchanged.
> ⚠️ COMMIT THIS FILE TO GITHUB. The repo→workspace sync wipes any local file not in the repo
> (it already wiped this doc once). Memory lives here — push it so it survives. Commit the `/archive` move too.
> Last updated: 2026-06-10 (Professionals Portal: PROFESSIONS are now a DB taxonomy under the 6 STANDARD
> categories — Admin → Taxonomies → Professions; onboarding/profile use ONE searchable profession picker;
> Pro home-screen icon = real FFP emblem + "Professional" (purple FFP/PRO mark killed). See SESSION STATE 2026-06-10 below.
> Prior: 2026-06-07 Member-created Challenges live; Module pairs + cache-bust map; Calorie Tracker extracted; My Meals; Bronco/Beep records.)

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
  - provider_rankings() → json[] {provider_id, business_name, city, country, category, status, n, 4× avgs}, ordered by avg_overall desc nulls last, n desc. is_admin()-GATED (raises 'admin only' for non-admins; admins use real Supabase Auth so auth.uid()/is_admin() resolve). Now also returns p.category (for the admin filter).
MEMBER UI — UPDATED v239 (Grant): review prompts now live in the NOTIFICATIONS bell, NOT a passport-panel card. loadNotifications() prepends ReviewPrompt.pending() items as "How was your session? — <Provider> (<activity>)" rows (tap → ReviewPrompt.open → rating modal); the bell badge count = backend unread + pending reviews. ReviewPrompt.load() (still called from loadJourneyLogs on sign-in + activity-logged) now just fetches pending + refreshes the bell (no card render; dismiss feature removed). The rating modal HEADER shows the provider LOGO (logo_url) + business_name + the session/activity done — member_pending_reviews RPC extended to return provider_name + logo_url. The #review-prompts container + its CSS + the old render()/dismiss() are gone (CSS rules left as harmless no-ops). Submit/upsert/stars logic unchanged. — original v236 build: `#review-prompts` container at the top of the Passport panel; ReviewPrompt module (just after loadJourneyLogs). load() runs from loadJourneyLogs() on sign-in + the 'ffp-activity-logged' event → member_pending_reviews → renders dismissible "Rate your session at [Venue]" cards (dismiss persisted in localStorage 'ffp_dismissed_reviews'). "Rate now" → #review-modal-backdrop (.detail-backdrop system, per the REUSE rule) with 4 tappable star rows (Overall/Experience/Service/Facilities) + comment textarea → submit_provider_review; on success removes the card + toast. Overall required client-side. CSS: .review-card / .rv-row / .rv-star(.on).
PROVIDER UI — ffp-provider-dashboard.html v28: "Your rating" section-card on the Overview (after Quick actions). renderProviderRating() (called inside renderOverview()) → provider_rating + provider_reviews_list for window.FFP_PROVIDER.id → big avg overall + stars, per-category averages, and a list of recent reviews (member photo/name/date + comment). Empty state when n=0. CSS prefix .pr-*. (Version header now ALSO at the very TOP of the file, line 1, matching the member-dashboard convention — Grant asked for this; the bottom-left build stamp reads "FFP build v28".)
ADMIN UI — ffp-admin-dashboard.html v37/v38: new sidebar tab "Provider Rankings" (icon leaderboard, under Providers) + panel-rankings. AdminRankings module (inline, no external loader) → provider_rankings(); App.go renders it on open + a Refresh button. Table: rank #, provider, city, category, TYPE, GYM SIZE, overall (stars+number), reviews count, per-category averages (11 cols). Filters: Country / City / Category / Provider Type / Gym Size (City cascades by Country) filter + re-rank client-side; meta shows "X of Y providers have reviews (filtered)". Providers with 0 reviews show "no reviews" and rank "–". panelNames + sidebar link + render hook all wired.
PROVIDER CLASSIFICATION (v38, 2026-06-03, per Grant — "filter rankings by gym size / fitness-wellness type / sports club-team / adventure service"): providers gained a `size_band` column (admin-set); `provider_type` (existing text col) is now a managed value. Two admin-editable taxonomy lists seeded: list_key='provider_type' (Gym, Studio, Yoga studio, Pilates studio, CrossFit box, Sports club/team, Adventure service, Wellness centre, Recovery studio, Coaching/PT, Other) + 'gym_size' (Boutique <500 / Mid 500–2,000 / Large 2,000–7,500 / Mega 7,500+ / Not applicable) — both now appear in admin Taxonomies (loader v4). Admin sets each provider's Type + Size via inline <select>s in the Rankings table → RPC `admin_set_provider_classification(p_provider, p_type, p_size)` (SECURITY DEFINER, is_admin-gated, GRANT authenticated; sends BOTH values each save so neither is wiped). provider_rankings() now returns provider_type + size_band. The Rankings dropdown options + per-row selects read the taxonomy lists live (AdminRankings.loadLists from taxonomy_items). Legacy free-text provider_type values (e.g. Find Fit People = "Event organizer") still display, are preserved, and show as "<value> (legacy)" in the row select until reclassified. Migrations: `provider_classification`, `provider_rankings_add_category`. DECISION: classification lives on the Rankings tab (not the Providers panel) because ffp-admin-providers-loader.js is flagged corrupt/truncated in the workspace (§2) — building there was unsafe; the Rankings panel is inline dashboard code I control.
VERSIONING NOTE (RESOLVED): the live admin build + footer were v36 (June-1 line-1 lineage); a second comment block had restarted numbering at v26–v30 (June-3 work). Grant confirmed the live version is v36, so Provider Rankings continues from there → v37, then classification → v38. Top-of-file header (line 1) + the detail block + the footer stamp ALL now read v38. Keep numbering from v38 going forward; ignore the lower v26–v30 numbers (feature history only).
VERIFICATION: all 4 added JS modules (member ReviewPrompt, provider renderProviderRating, admin AdminRankings ×2 revisions) `node --check` OK in isolation (bash mount serves stale copies of the big edited files per §0-CRITICAL, so validated the authored snippets standalone + confirmed every edit landed via the Read/Grep host view). RPCs verified by live SQL.

## 6u. "PICK A PASSPORT" — WORLD MAP THEMED LENS (2026-06-03) — ffp-member-dashboard.html v234
Passport panel World Map gains a pill picker (All · Sports · Fitness · Wellness · Adventure · Health Food) that filters the map pins + Top Activities/Top Places to a themed subset and recolours pins to the passport colour. It's a LENS, not new data — same activity_logs, grouped by category. v1 uses a FIXED category→passport mapping (const PASSPORTS, each {id,label,icon,color,cats[]}); passportForLog(l)=passportForCat(l.category || catForActivity(l.activity)) — catForActivity maps activity name→category via FFP_TAX.activities, so it works whether the log carries a provider category (check-ins: Fitness/Wellness/Padel/Nutrition…) or only an activity name (manual logs, mapped via legacy category names also included in cats[]). state.selectedPassport added; getFilteredLogs + JourneyMap.logsInRange filter by it; pins use passportColor(id) (var pcol) instead of the default blue/yellow. Pills show per-passport counts from getLocationLogs() (location-scoped, all passports). UI: #jm-passports above #jm-chips; CSS .jm-pass/.jm-pass.on (per-pill --pc colour var). Health Food = Nutrition/Retail check-ins. Connections list is NOT passport-filtered (people aren't category-tagged). DONE (2026-06-03): mapping is now TAXONOMY-DRIVEN. DB: list_key='passport' (sports/fitness/wellness/adventure/food) + each category row's `parent` = its passport id. ffp-taxonomy.js v5 exposes FFP_TAX.passports + FFP_TAX.categoryPassport (hydrated from DB, with code fallbacks). Member dashboard v235: PASSPORT_META (colour/icon per passport, in code) + getPassports()/passportForCat() read FFP_TAX; legacy keyword fallback kept; rebuilds on 'ffp-tax-ready'. Admin Taxonomies v3: Provider Categories rows have a Passport <select> → writes category.parent (admin controls the mapping, no code). DEPLOY: ffp-member-dashboard.html v235 + assets/ffp-taxonomy.js v5 + ffp-admin-taxonomies-loader.js v3 + ffp-admin-dashboard.html v30 (cache-bust v=44). DB live.

## 6t. FEEDBACK WIDGET — PHOTO ATTACHMENT (2026-06-03)
Members/providers can attach a screenshot to feedback. DB: feedback.photo_url text added; submit_feedback DROPPED the 7-arg and recreated as 8-arg (…, p_photo_url text DEFAULT NULL), GRANT anon/authenticated. STORAGE DECISION: NO bucket — image is compressed client-side (canvas, max 1200px long edge, JPEG q0.7) to a small data URL stored INLINE in photo_url. Rationale: avoids storage RLS wrangling with the custom-JWT members; feedback is low-volume. Widget ffp-feedback-widget.js v4: "Add photo" button → file input (accept image/*) → compressImage() → applyPhoto() thumbnail preview + remove (×); submit passes p_photo_url; clearPhoto on success. Loaded WITH cache-bust now: member + provider dashboards reference ffp-feedback-widget.js?v=4. Admin ffp-admin-feedback-loader.js v2: select adds photo_url; renders a thumbnail in the message cell; AdminFeedback.zoom(img) opens a full-screen lightbox (click to close). DEPLOY: assets/ffp-feedback-widget.js v4 (+?v=4 refs in ffp-member-dashboard.html & ffp-provider-dashboard.html) + ffp-admin-feedback-loader.js v2 + ffp-admin-dashboard.html v29 (cache-bust v=43). RPC live + verified (insert with photo_url OK).

## 6s.1 GENDER 'NON-BINARY' REMOVED AT SOURCE (2026-06-03)
Grant: ensure Non-binary never shows + control gender from Taxonomy. Genders ARE admin-editable: admin Taxonomies panel (ffp-admin-taxonomies-loader.js LISTS includes {key:'gender',name:'Genders'}) writes taxonomy_items(list_key='gender'). The DB already had only Male/Female/Prefer not to say. The ONLY hardcoded 'Non-binary' was the STATIC fallback in assets/ffp-taxonomy.js line ~190 (T.genders) that renders before FFP_TAX_READY hydrates. FIX: assets/ffp-taxonomy.js v4 — fallback now ['Male','Female','Prefer not to say'] (matches DB). So DB taxonomy is the single source; add/remove a gender in admin Taxonomies → every form follows (all consumers hydrate via FFP_TAX_READY or read taxonomy_items directly). DEPLOY: assets/ffp-taxonomy.js (loaded WITHOUT ?v= on pages → may need a hard refresh / cache expiry to pick up; live behaviour already mostly correct since DB is authoritative + consumers re-hydrate). To control gender going forward: admin → Taxonomies → Genders.

## 6s. PROFILE-COMPLETE FIXES (2026-06-03) — ffp-profile-complete.html v31
(1) GENDER not updating from taxonomy: the gender <select id=f-gender> was filled ONCE at script-load from the static FFP_TAX.genders (incl. legacy 'Non-binary' not in DB) → admin taxonomy edits never showed. FIX: fillGenders() now runs at load AND on FFP_TAX_READY.then AND on 'ffp-tax-ready' (re-fills from the DB-hydrated FFP_TAX.genders, preserving the 'Select' placeholder + current value). (2) Step 2 retitled: "Select a few of your interests" → "Choose Interests"; helper → "Let us know which are your favorite activities." (3) Activity picker (renderActivities) now ALWAYS sorts A→Z by name (list.sort localeCompare) after filters — ascending alphabetical (Grant wrote "descending" but A→Z is the standard read; flag to confirm). (4) Activity icons REMOVED from the picker rows (many mismatched the activity) — name + category only. NOTE: only this page's activity list was sorted/de-iconed; other activity lists (member dashboard Log Activity, provider forms) untouched — extend if "ALL LISTS" means site-wide. Activities source = FFP_TAX.activities; sorting at that source would hit every consumer but breaks category grouping order, so done per-list instead.

## 6r. COMMUNITY HEALTH → OWN ADMIN TAB (2026-06-03)
Per Grant: health/fitness stats are a different CLASS of data from member/provider/revenue/engagement, so they get their own tab — NOT buried in business Analytics. Moved the whole Community Health section OUT of panel-analytics into a NEW sidebar tab + panel: panel-community-health (sidebar link 'favorite' icon, right under Analytics; panelNames + _panelScript registered → ffp-admin-health-loader.js; lazy onload calls CommunityHealth.render()). The new panel has its OWN Country/City location filter (#ch-country/#ch-city) keyed to the standardized taxonomy, sourced from the RPC's by_city (only cities/countries WITH health data appear). NEW FILE ffp-admin-health-loader.js v1 owns window.CommunityHealth: fetches community_health_stats() once (baseline for dropdowns) + community_health_stats(p_cities) on filter change; renders the same tiles/fit-levels/body-comp/by-city table into #ch-kpis/#ch-fitlevels/#ch-bodyfat/#ch-city-tbody/#ch-meta; awaits FFP_TAX_READY + re-renders on 'ffp-tax-ready'. ffp-admin-analytics-loader.js v6 = business-only now (renderCommunityHealth/_renderCH removed; its Country/City filter still scopes the business stats). DEPLOY: ffp-admin-dashboard.html v26 (cache-bust v=40) + ffp-admin-health-loader.js v1 + ffp-admin-analytics-loader.js v6. RPC unchanged.
GENDER FILTER (2026-06-03): Community Health panel gained a 3rd filter — Gender (#ch-gender, options from standardized FFP_TAX.genders = Male/Female/Non-binary/Prefer not to say). RPC signature changed: DROPPED community_health_stats(text[]) and created community_health_stats(p_cities text[] DEFAULT NULL, p_gender text DEFAULT NULL) — filters meta by members.gender. All CH stats (KPIs, fit-levels, body-comp, by-city) respect it. health loader v2 passes {p_cities?, p_gender?} (omits absent args). Verified: all=2, Male=2, Female=0, Dubai+Male=2.
GENDER DROPDOWN FIX (v3, 2026-06-03): the dropdown was showing a phantom 'Non-binary' — that value lives ONLY in the ffp-taxonomy.js STATIC fallback (T.genders = Male/Female/Non-binary/Prefer not to say) but is NOT in the DB taxonomy (taxonomy_items list_key='gender' = Male/Female/Prefer not to say, no Non-binary). When FFP_TAX hadn't hydrated from the DB yet, the loader fell back to that static list. FIX: health loader v3 reads the gender list AUTHORITATIVELY straight from taxonomy_items (loadGenders() → .from('taxonomy_items').eq('list_key','gender').eq('active',true).order('sort_order')), so it's always exactly the standardized DB list; FFP_TAX.genders + a DB-matching basic list are fallbacks only. DEPLOY: ffp-admin-dashboard.html v28 (cache-bust v=42) + ffp-admin-health-loader.js v3. NOTE the platform-wide ffp-taxonomy.js static T.genders still lists 'Non-binary' (line ~190) — out of sync with the DB; worth reconciling later for other forms that read FFP_TAX.genders before hydration.

## 6n. ADMIN COMMUNITY HEALTH (2026-06-03) — fitness aggregates in Analytics (SUPERSEDED by 6r — now its own tab)
New section inside the admin Analytics panel (after Audience Demographics, before Top Providers). Shows community-wide fitness from profile_meta: avg body fat, VO2 max, resting HR, weight, HRV, visceral, waist, bio age (tiles only render for metrics with ≥1 reading, sublabel "N members logged"); a VO2 fit-level distribution (Elite 50+/Excellent 43-49/Good 36-42/Fair 30-35/Building <30); a body-composition distribution (Lean <15/Fit 15-21/Average 22-29/High 30+); and a per-city/emirate table (members, body fat, VO2, resting HR, weight). City is the geo field — there is NO emirate column on members. Source: RPC `community_health_stats()` (SECURITY DEFINER, GRANT anon/authenticated) → JSON {community, fit_levels, body_fat_bands, by_city}; joins profile_meta→members WHERE role='member'; verified returns real data (Dubai: bf 14, vo2 43, rhr 48, wt 86). Rendered by ffp-admin-analytics-loader.js v3 method renderCommunityHealth (fetches once, snapshot — not period-filtered), into #ch-kpis/#ch-fitlevels/#ch-bodyfat/#ch-city-tbody/#ch-meta. DEPLOY: ffp-admin-dashboard.html v22 (lazy cache-bust v=37) + ffp-admin-analytics-loader.js v3. RPC already live. NOTE: admin loaders live in repo ROOT, not assets/.

## 6m.1 MAP BASEMAP → CUSTOM VECTOR (2026-06-02) — English labels + FFP look
Grant wants English labels everywhere (Voyager raster showed Arabic in UAE) + dark land + FFP-blue water. Raster can't recolour per-feature or force language → switched to VECTOR: MapLibre GL (cdnjs maplibre-gl@3.6.2) + leaflet-maplibre-gl bridge (@0.0.22) so all existing Leaflet code (markers/flyTo/picker) stays; only the tile layer changed. ffpVectorBasemap(leafletMap) adds L.maplibreGL({style:'https://tiles.openfreemap.org/styles/liberty'}) (OpenFreeMap, NO KEY) then on style 'load' iterates layers: background→#1d2832, water fills/lines→#2391c9 (FFP blue), other fills→#212c36 (strong dark land), buildings #243038, roads #394754, boundaries #42525f, and every symbol text-field→['coalesce',name:en,name:latin,name] with light text + dark halo. Wrapped in try/catch + a `typeof L.maplibreGL!=='function'` guard → FALLS BACK to Voyager raster if MapLibre/plugin fails (so the map never blanks). Used by JourneyMap.init + FFPLocPick.init; container bg #1d2832. NOT runtime-verified from here (can't see render) — colours/label-language likely need a live tweak. Decision: OpenFreeMap (no key) over MapTiler (free key). DEPLOY: ffp-member-dashboard.html v228 (+ MapLibre CDN in <head>).

## 6m. POST-A-MEETUP — map location picker + form tweaks (2026-06-02) — Grant
This is a key first-use feature (members hosting meet-ups). LOCATION is now a MAP PICKER, not typed text/pasted link: "Add location" → FFPLocPick modal (Leaflet + CARTO Voyager tiles + OpenStreetMap/Nominatim search + a fixed centre ball-pin you drag the map under; tap a search result to fly there). On "Use this location" it stores venue NAME (reverse-geocoded or search label) + lat + lng + maps_url (google.com/maps?q=lat,lng) into hidden inputs pmf-venue/pmf-lat/pmf-lng/pmf-maps via pmfSetLocation(). FFPLocPick is a standalone IIFE in a <script> just before the checkin-loader tag. DB: meetups gained latitude, longitude, maps_url; host_meetup RPC now writes them (payload maps_url/latitude/longitude). The meetup DETAIL location is a tappable link → maps_url (opens the spot in the member's maps app); meet-move loader v18 carries m.maps_url into MeetMove.data. Other form tweaks: Date + Time side by side (Capacity on its own row); age range default 18→99. NOMINATIM usage is low-volume/manual + debounced (search 500ms, reverse 450ms) — fine for now; swap to a keyed geocoder if volume grows. DEPLOY: ffp-member-dashboard.html v226 + assets/ffp-meet-move-loader.js v18 (?v=18). RPC + columns already live.

## 6l.1 JOURNEY MAP — selectors, grey tiles, 3 lists (2026-06-02)
Map heading = "World Map". SELECTION via Country + City dropdowns + tappable pins + breadcrumb. Tiles desaturated to neutral grey. Map box-free + full-bleed on mobile. THREE lists below the map, all scoped by the map selection (world/country/city): Top Activities, Top Places (renamed from Top Venues — same renderVenues/#venues-* ids, just relabelled), Top Connections (NEW, #connections-list). Top Connections = accepted member_connections people via member_connections_list(p_me) RPC (SECURITY DEFINER, returns id/name/photo/city/country), stored in CONNECTIONS[], filtered by selectedCountry/selectedCity (the person's location), rendered by renderConnections() in renderAll; rows tap → MeetMove.openMemberDetail. loadConnectionsCount() now fetches the LIST (sets CONNECTIONS + MEMBER_CONN_COUNT). RPCs member_connections_count + member_connections_list both live.

## 6k.1 PROVIDER SAVE BANNER (2026-06-02)
Grant: saving needs to be the obvious convenient place. Added a big GREEN sticky banner (#ffp-save-banner) directly under the topbar (sticky top:62px, z-index:19 under the topbar's 20) — "You have unsaved changes" + a big "Save changes" button → saveProfile(). Shown ONLY on #panel-profile when dirty (setSaveBar toggles .show with an onProfile guard); hidden on successful save (setSaveBar(false)) and whenever you navigate off Profile (showPanel). Bottom save-bar kept too. Dashboard v27. Member-dashboard equivalent not added (member saves are per-modal); revisit if Grant wants the same there.

## 6k. MEETUPS — hosting count, cancel, who's-going card (2026-06-02)
(1) HOSTING COUNT was always 0: cnt-meet-hosting used MeetMove.hostingIds.size but hostingIds is never populated (list showed hosted items via m.isHostedByMe). Fixed: count = data.filter(isHostedByMe || hostingIds.has). Also a meetup you host no longer double-counts/shows under Joined (joined filter + count now exclude isHostedByMe). Dashboard v218.
(2) HOST CANCEL: new SECURITY DEFINER RPC cancel_meetup(p_me,p_meetup) — host-only guard; sets meetups.status='cancelled', sets joined/attended meetup_attendees to 'cancelled', and inserts a notifications row (audience 'member', icon event_busy) for every joined attendee (not the host); returns {ok,notified}. Cancelled meetups drop out of the open/full query so they vanish. ffp-meet-move-loader.js v17: host detail-modal footer button → red "Cancel this meet-up" → MeetMove.cancelMeetup() (confirm → RPC → toast "n notified" → ffpReloadMeetMove). GRANT anon/authenticated; verified anon-callable pattern.
(3) WHO'S-GOING CARD: loader now registers each fetched attendee/host into window.FFPCard (#62) so passports resolve to full data (photo/sports/passport#) instead of a bare fallback. Self still resolves via FFPCard.fromProfile (MemberProfile.data). If a specific self-card symptom remains, capture it.
DEPLOY: ffp-member-dashboard.html v218 + assets/ffp-meet-move-loader.js v17 (lazy ref ?v=17). RPC live.

## 6j.1 PROFILE TABS — order + activities dropdown (2026-06-02)
Tab order now Business Details · Activities · Branding (default Business Details); "Business info" relabelled "Business Details" (dashboard v26). Activities input: replaced the native <datalist> (rendered an ugly full-height list on the right) with our own styled dropdown under the field — filtered list of FFP_TAX.activities + an "Add '<custom>'" option; click adds a chip; outside-click/Esc closes (profile loader v12, eager ref ?v=12). DEPLOY: ffp-provider-dashboard.html v26 + ffp-provider-profile-loader.js v12.

## 6j. PROVIDER PORTAL RESTRUCTURE (2026-06-02) — Grant
Goal: stop the provider profile + check-ins from clashing; keep things focused + separated.
PROFILE TABS (ffp-provider-dashboard.html v25 + ffp-provider-profile-loader.js v11): #panel-profile split into 3 tabs via showProfileTab() — Branding (business name, logo, hero), Business info (category, provider type, country/city/area/address, Google Maps venue pin, hours, phone, website, about), Activities (the activities-offered chips). Profile loader v11 now injects the Activities field into #pf-activities-host (Activities tab) and the Maps-link field after #pf-address (Business info); falls back to old after-Address layout if the host div is absent. All field ids unchanged so load/saveProfile + completion calc are unaffected.
CHECK-INS SPLIT (ffp-provider-quests-loader.js v4, ref ?v=4): the combined console (was all in #panel-checkins) now distributes one data load into THREE panels — Quest check-ins → new #panel-quests (new "Quests" nav item, operations section); Challenge results (verify) → #panel-challenges (#ffp-q-challenges, inserted before #ch-tabs); Event check-ins → #panel-checkins (#ffp-q-events, before "Recent check-ins"). showPanel reloads FFPQuestCheckins on quests/challenges/checkins open. Member check-in flow + RPCs unchanged.
DEALS: "Deals" nav item back (listings section) + #panel-deals is a dormant "Coming soon" placeholder (no creation; nothing reaches members). Old deals grid/New-deal button + renderDeals hook removed from the panel; inline deal stub fns left harmless. Re-enable later (member-side still hidden per #74). DEPLOY: ffp-provider-dashboard.html v25 + ffp-provider-quests-loader.js v4 + ffp-provider-profile-loader.js v11 (Netlify). No DB/backend change.

## 6i. FITNESS STATS — SAVE FIX + MODAL FULL-SCREEN (2026-06-02)
TWO bugs reported (records/BioAge not saving; weight/sleep modals not full-screen).
SAVE: ffp-fitness-stats-loader.js reads via the BACKEND (service-role) but WROTE via window.supabase.from('profile_meta').upsert() directly → member custom JWT hits the auth.uid() trap → 0 rows, nothing persisted. BioAge is derived from the health records, so it stayed empty too. FIX: SECURITY DEFINER RPC `member_profile_meta_save(p_me, p_patch jsonb, p_pr_date_key, p_pr_date_val)` (whitelisted columns incl. all PR cols + vo2/bodyfat/visceral/rhr/hrv/grip/muscle/waist/current_weight_kg/target_*/height_cm/chrono_age/bio_age/sleep_logs; merges pr_dates; GRANT anon/authenticated). Loader v15 savePr/clearPr/saveSleepLog now call it. Verified persist+clear on Forge. (Weight = openPrEdit('weight') → savePr, so covered. BioAge derived, not separately stored.)
MODALS: PR-edit (#pr-edit-backdrop) + Sleep (#sleep-log-backdrop) use .detail-backdrop/.detail-modal — same as challenges/meets — but had INLINE style="max-width:380px/400px" on .detail-modal, which overrode the mobile full-screen rule (@media max-width:640px → .detail-backdrop:not(#confirm-backdrop) > .detail-modal full-screen). Removed the inline caps → now full-screen on mobile like the others. DEPLOY: ffp-member-dashboard.html v216 + ffp-fitness-stats-loader.js v15 (lazy ref ?v=15). RPC already live.

## 6h. LOGIN — UNREGISTERED EMAIL (2026-06-02)
Sign-in calls FFPApi.requestCode→/api/auth/reset, which (anti-enumeration) returned success even for unknown emails → UI advanced to the code screen for emails with no account. FIX: backend v52 /api/auth/reset now returns `exists` boolean (code still only sent if the account exists). login.html v7 requestCode(): on flow==='signin' with res.exists===false → showError(signin-email-err, "We couldn’t find an account…") + red border + focus, and DOES NOT advance. NOTE: only fully active once backend v52 is deployed to Vercel (until then res.exists is undefined → old behaviour, no regression). Reset flow left as-is (still anti-enumeration). DEPLOY: login.html (Netlify) + index.js v52 (Vercel).

## 6g. QUESTS + CHALLENGES + EVENTS CHECK-IN LOOP (2026-06-02) — full loop live, end-to-end TESTED
DESIGN (Grant): at venue check-in, a provider's ACTIVE programs pin to the TOP of the sheet (yellow), only when live.
  • Quest  → member taps, submits the completed task → PENDING until the provider approves → stamps the step; on reaching target_count, quest completes + the quest's stamp is awarded.
  • Challenge → member enters their scorecard result → PENDING until the provider verifies.
  • Event → member taps an active event → AUTO on-site check-in (GPS-verified) → logged to the passport + shows on the provider console.
NO Express endpoints — the old ffp-provider-quests-loader.js called /api/quests/... which NEVER existed (the source of the pending/approved 404s). The whole loop is now Supabase SECURITY DEFINER RPCs (GRANT anon, authenticated), consistent with venue_checkin_activity / provider_save_profile.
DB (migration checkin_programs_loop): new table `event_checkins` (event_id, member_id, provider_id, checked_in_at, lat, lng, verified; unique(event_id,member_id); RLS on, no policies → RPC-only). RPCs:
  - venue_active_programs(p_provider) → {quests,challenges,events} live + in-window (status='live'); NO hero_image_url (base64 bloat — 240KB; dropped).
  - member_quest_submit(p_me,p_quest,p_provider,p_lat,p_lng) → quest_checkins status='pending' (guards quest live + venue in quest_venues; dedupes pending).
  - member_challenge_submit(p_me,p_challenge,p_score,p_score_text) → challenge_entries verified=false.
  - member_event_checkin(p_me,p_event,p_provider,p_lat,p_lng) → event_checkins (GPS ≤250m ⇒ verified) + an activity_logs row (category 'Event') so it shows on the passport; on conflict updates.
  - provider_quest_approve(p_checkin,p_approver) → status approved; recounts approved (distinct venues if require_distinct_venues) → upserts quest_progress(completed_count,status); on completed_count≥target_count marks completed + inserts member_stamps(stamp_id,quest_id) once.
  - provider_quest_decline(p_checkin); provider_challenge_verify(p_entry,p_approver).
  - provider_quest_checkins(p_provider,p_status), provider_challenge_entries(p_provider,p_only_unverified), provider_event_checkins(p_provider) → flat JSON arrays w/ member_name/member_photo/passport_no for the console.
TESTED on Forge (provider 2fc1da8a, member Grant 5a914aa4, quest "Strength in 7" target 7, event "Epic Pickel Comp"): submit→pending→approve→progress 1/7; pushed to 7→completed + completed_at + 1 stamp; event check-in verified=true + Pickleball activity_log; provider lists correct. ALL test rows then deleted (verified 0 remaining); Grant's real Running/Walking logs untouched.
UI v4 (2026-06-02, Grant declutter): programs are now ONE 3-across button row — Quest / Event / Challenge (a type is tappable only if it has live items; >1 shows a count badge; tap → that type's list via _pickType, or straight into _program when there's only one). Removed the "just checking in — no activity" button. Check-in fields are Minutes + Calories SIDE BY SIDE (calories persisted: venue_checkin_activity gained p_calories integer default null → activity_logs.calories). Script ref ffp-member-checkin-loader.js?v=4; member dashboard v214.
FRONTEND: ffp-member-checkin-loader.js v3 (?v=3) — programsHtml() pins active programs at top (yellow .ci-prog), sub-flows _program/_questSubmit/_challengeSubmit/_eventCheckin; event success fires ffp-activity-logged. ffp-provider-quests-loader.js v3 (provider dashboard ?v=3) — rewired off Express onto the RPCs; 3 cards: Quest check-ins (approve/decline), Challenge results (verify), Event check-ins (read-only). DEPLOY: ffp-member-checkin-loader.js, ffp-member-dashboard.html, ffp-provider-quests-loader.js, ffp-provider-dashboard.html. (RPCs already live on Forge.)

## 6f. CHECK-IN ≠ LOG ACTIVITY + PROFILE SAVE RPC (2026-06-02)
TWO DISTINCT FLOWS (Grant, firm): (1) **Check-in** = "I'm physically at a provider's venue" → scan venue QR / ?venue= link → shows ONLY that provider's own activities (providers.activities), GPS-verified, RPC venue_checkin_activity. NEVER the full taxonomy. (2) **Log Activity** = "I did something anywhere" (run/swim/weights) → the dashboard's own dark "Log Activity" button → openLogModal: full FFP_TAX.activities search + country/city/duration/date, no provider, no GPS → log_activity RPC. These are separate by design; do not merge.
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
