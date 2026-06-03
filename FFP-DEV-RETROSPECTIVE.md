# FFP — Recurring Issues: Root-Cause Analysis & Correct-Build Playbook
_Last updated: 2026-06-04. Read this BEFORE making changes. Every recurring problem below traces to a small number of avoidable habits — the fixes are process rules, not code._

---

## TL;DR — the 9 habits that caused most of the rework
1. Changed a file but didn't bump its **version / cache-bust** → the fix shipped as "the same version" and never took effect.
2. **Guessed deploy/cache state** ("it's not deployed", "it's cached") instead of checking the live artifact.
3. **Patched a symptom** at the display layer before auditing the whole pipeline → missed the real root cause.
4. Built without **checking the full chain + all related files** (the caller's contract, existing conventions, what already exists).
5. **Trusted code comments** as truth instead of verifying the runtime behaviour.
6. Let the **currency model** stay mixed (AED stored, USD shown) → rounding/conversion bugs on repeat.
7. Based business logic on **assumed constants** (list price) instead of **actual data** (amount paid).
8. Tried to validate large mounted files with **bash `node --check`** (truncation trap) → false errors.
9. **Invented a parallel pattern** (a CSS hack) instead of reusing the platform's existing standard.

---

## 1. Version / cache-bust discipline  ← the single biggest time-sink
**What happened:**
- The `computeBalance` cents fix was written but left labelled **v16** (the version already deployed) → re-deploying changed nothing → balance kept showing **$40**. Only bumping to **v17 / ?v=17** shipped it.
- The admin referrals loader was bumped to **v4** but the dashboard's lazy cache-bust stayed **v=45** → the browser kept serving cached **v3** (which divided by 3.6725) → reward showed **$1.08**. Bumping to **v=46** fixed it.

**Root cause:** a content change without a new version identifier is invisible to the browser/CDN.

**Rule going forward (non-negotiable):**
- ANY change to a file → **bump that file's version stamp in the SAME edit**, and bump **every cache-bust reference** that loads it (`?v=N`, and the admin lazy-loader `v=NN` at the bottom of `App._lazyInit`).
- Never reuse a version number for changed content. The header version, the on-screen build stamp (admin footer), and the `?v=` ref must all move together.
- A fix that "didn't take" after deploy is a versioning/cache problem until proven otherwise — check the version, don't re-write the code.

---

## 2. Verify live state — never guess deploy/cache
**What happened:** repeatedly told Grant "v65 isn't deployed" / "it's cached" as assumptions. He had deployed. This eroded trust and wasted turns.

**Root cause:** asserting infra state without evidence — a direct violation of the "don't guess" rule.

**Rule going forward:**
- To check if something is live: **fetch the live artifact.** `web_fetch` a JSON endpoint (returns text) or read the on-screen build stamp. The backend route `GET /api/notifications/:id` returning data proved v67 live; the admin footer "build vNN" proves the dashboard version.
- Note the tool limits: `web_fetch` returns **rendered text for HTML** (strips `<!-- version -->` comments) and **binary for `.js`** (can't read loader version strings). So verify JS loaders by the **feature they drive**, and HTML by the **build stamp / visible feature**, not the comment.
- Each loader logs its version on load (`[FFP Earnings v17] ✓`) — that console line is the definitive runtime version check.

---

## 3. Root-cause first — audit the whole pipeline before patching
**What happened:** the "balance shows $40/$39.48/$39.60" saga. I fixed display helpers (`aedToUsd` cents, `fmtUsd`) round after round, but the real culprit — `computeBalance` doing `Math.round(bal)` (whole dollars) — sat untouched for several iterations. Same with admin + member panels both blank: I patched each separately before finding the shared cause (no JWT → `auth.uid()` null).

**Root cause:** treating each visible symptom as its own bug.

**Rule going forward:**
- When **2+ symptoms share a domain** (money display, "no data", auth), find the **one shared invariant** first and audit the **entire path end-to-end** (DB value → compute fn → formatter → DOM) before editing any single surface.
- For "money looks wrong": check storage value, the aggregate/compute function, AND the formatter together — round to cents in ALL of them.
- For "no data anywhere": check the identity/auth the server actually sees (`auth.uid()`, role, RLS) before touching loaders.

---

## 4. Check the full structure + all related files BEFORE building
**What happened:**
- Built `GET /api/notifications?member_id=` (query) while the bell calls `/api/notifications/<id>` (path) → 404 → "notification not showing".
- Built the Broadcast panel with ad-hoc inline styles instead of the admin form standard (`.field-row/.field/.field-label/.field-input`) → "alignment out".
- Initially claimed "no notifications system exists" — a `notifications` table + bell UI already existed.

**Root cause:** building against assumptions instead of the actual consumer contract + existing conventions.

**Rule going forward:**
- Before building an endpoint/component: **read the caller.** What URL shape does it call? What response keys does it read? What classes/patterns do sibling features use?
- Before "it doesn't exist, I'll build it": **grep/query first.** Tables, RPCs, components are often already there (notifications, "Add passport" follow via `handle_connection`, the `dm-full` modal system).
- Match the existing platform standard (forms, modals, pickers) — see §9.

---

## 5. Verify runtime contracts, not comments
**What happened:** `ffp-api-integration.js` and the earnings loader both *commented* that the Supabase JWT was applied and `auth.uid()` resolves. It never was — `/api/auth/signin` returned no `jwt` at all. Whole admin + RLS layer was effectively anonymous.

**Root cause:** trusting aspirational comments as fact.

**Rule going forward:** a comment describing behaviour is a claim to verify, not evidence. Confirm the runtime (does signin actually return `jwt`? does the row actually get inserted? does the route actually match?) before relying on it.

---

## 6. One canonical currency unit (USD), stored and shown consistently
**What happened:** money was stored in `*_aed` columns but the platform is USD. Converting AED→USD→AED with rounding produced $40 vs $39.48 vs $39.60, and a stale `>= 500` payout floor that silently meant $500.

**Root cause:** a mixed-unit model with conversions at multiple layers.

**Rule going forward:**
- The wallet is **USD-only**. The `*_aed` columns now **hold USD** (legacy names); there is **no conversion** anywhere in wallet code. Don't reintroduce a peg.
- Store money cents-precise; never `Math.round` to whole dollars; display with one formatter (`fmtUsd`).
- Only **payouts** convert to a member's local currency — and only at the **quote** step (`payouts.local_amount/bank_rate`), never in the balance math.

---

## 7. Base calculations on actual data, not assumed constants
**What happened:** referral reward was `tier% × $99` (list price), ignoring discount codes — members who paid $19.80 generated a $19.80 reward instead of $3.96.

**Root cause:** hardcoding a constant where real transaction data was available.

**Rule going forward:** derive money/rewards from the **actual transaction** (Stripe `session.amount_total`), not a constant. If a value can vary (discounts, tiers, currency), read it from source.

---

## 8. Validate edits safely (the bash mount truncation trap)
**What happened:** `node --check` via bash on large files (`ffp-member-dashboard.html`, big loaders, `index.js`) reported phantom "Unexpected end of input" — the bash mount serves a **truncated copy** of large files.

**Root cause:** trusting bash's view of large mounted files.

**Rule going forward:**
- Edit + read via the **file tools** (Edit/Read) — that's the canonical view that deploys.
- Validate new JS by extracting the **changed snippet into `/tmp`** and `node --check` THAT (self-contained), not the whole mounted file.
- Keep edits small and uniquely-anchored; confirm with a targeted Read.

---

## 9. Reuse the platform's existing pattern — don't invent a parallel one
**What happened:** made the Add-Skill picker "full-bleed" with a new `.picker-modal.full-bleed` CSS rule. It stayed boxed because the picker overlay has `padding:20px` + centering. The platform already has a full-bleed standard (`.detail-backdrop.dm-full`: backdrop `padding:0; align-items:stretch`, modal `width:100%; min-height:100vh; border-radius:0`). Applying that exact pattern (to the overlay) fixed it.

**Root cause:** building a one-off instead of reusing the established system.

**Rule going forward:** if the platform already does X (full-bleed modals, taxonomy pickers, form fields, auth, RPC-with-explicit-id), **reuse that exact mechanism**. A new parallel implementation will diverge and break.

---

## Pre-change checklist (run through this every time)
1. **Read the real file(s)** with the Read tool — the dashboard AND every loader/related file the feature touches.
2. **Map the full chain**: frontend caller → URL/shape → backend route → RPC/RLS → DB columns. Confirm what already exists (grep/query).
3. **Find the shared root cause** if multiple symptoms; don't patch surfaces.
4. **Reuse existing patterns** (modals, pickers, forms, RPC-with-id) — match conventions.
5. **Build** with the actual data sources (no assumed constants), USD cents-precise, no conversions.
6. **Validate** changed JS via isolated `/tmp` `node --check`; never bash-check the big mounted file.
7. **Bump the version stamp + every cache-bust ref** in the same change (file header, admin footer build, `?v=N`, admin lazy `v=NN`).
8. **State the checks done**; if unsure whether something is live, **fetch the live artifact** — don't guess.
9. **Verify the fix** against live (endpoint/console/build stamp) after deploy; "didn't take" usually = versioning/cache, not code.

---

## Deploy & versioning protocol (quick reference)
- **Netlify** (site): all `.html` + `assets/*.js`. Push to GitHub `main` → auto-publish.
- **Vercel** (backend): `index.js` + `vercel.json`. Separate repo. Needs env `SUPABASE_JWT_SECRET`, `CRON_SECRET`.
- **Supabase** (DB/RPC): applied immediately via migration — **no deploy**, but live the instant it runs (so DB changes can outrun un-deployed frontend → mind the window).
- Cache-bust map: member loaders use `?v=N` on the lazy-load refs in `ffp-member-dashboard.html`; admin loaders use the single `v=NN` in `App._lazyInit` (bump with the admin build number); shared widgets (feedback) use `?v=N` on each `<script>` include.
