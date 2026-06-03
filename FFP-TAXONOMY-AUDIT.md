# FFP Passport — Taxonomy & Notifications Audit
**Date:** 2026-06-03 · **Scope:** member, provider & admin dashboards + profile-complete + listing loaders + backend email.

---

## 1. Executive summary

The taxonomy system is in good shape at the **data layer** — there's one DB table (`public.taxonomy_items`) with 12 lists, an admin **Taxonomies** editor that does real CRUD, and a shared hydrator (`assets/ffp-taxonomy.js`) that pushes the DB lists into `FFP_TAX` on every page. Most member-facing fields (gender, nationality, country/city, activities, fitness levels) correctly read from it.

The gaps are concentrated in **provider listing forms** and a few **hardcoded fallback arrays** that have drifted from the DB. The single most important issue is a **column conflict on `providers.provider_type`** (two different vocabularies write to the same column). There are also clear **email-notification gaps** — the email pipeline exists and works, but only fires for login codes, welcome, and provider-verify; key lifecycle moments (reviews, listing approvals, meetup changes) send nothing, and one UI even *promises* an email that never sends.

Severity legend: 🔴 high (data integrity / broken promise) · 🟠 medium (drift / inconsistency) · 🟡 low (polish).

---

## 2. Taxonomy lists that exist (DB `taxonomy_items`)

| list_key | items | nested | Hydrated into `FFP_TAX` as | Admin-editable? |
|---|---|---|---|---|
| activity | 97 | — | `activities` (with category `c`) | ✅ Activities |
| category | 12 | 11 → passport | `FFP_CONST.providerCategories` + `categoryPassport` | ✅ Provider Categories |
| city | 541 | → country | `cities` (country→[city]) | ✅ Cities |
| country | 58 | — | `cities` keys | ✅ Countries |
| nationality | 60 | — | `nationalities` | ✅ Nationalities |
| fitness_level | 5 | — | `fitnessLevels` | ✅ Fitness Levels |
| gender | 3 | — | `genders` | ✅ Genders |
| age_group | 5 | — | `ageGroups` | ✅ Age Groups |
| experience_type | 6 | — | `experienceTypes` | ✅ Experience Types |
| passport | 5 | — | `passports` | (via Provider Categories parent) |
| provider_type | 11 | — | **not hydrated** (rankings reads DB directly) | ✅ Provider Types |
| gym_size | 5 | — | **not hydrated** (rankings reads DB directly) | ✅ Gym Size Bands |

**Note:** 1 of 12 categories has no passport parent (almost certainly "Other") → it won't theme on the member map. Set its passport in admin → Taxonomies → Provider Categories.

---

## 3. Field-by-field audit (data-entry fields = priority)

### ✅ Correctly taxonomy-driven
- **profile-complete.html:** gender (`f-gender`, re-hydrates on `ffp-tax-ready` 👍), nationality, country/city, activity picker, fitness levels.
- **member dashboard:** Log Activity (activity search, country/city), Post-a-Meetup (activity+level via shared FFPPicker, country/city).
- **provider dashboard:** Profile category (`pf-category` ← `FFP_CONST.providerCategories`), country/city (location picker), activities chips, phone codes; event/experience **activity** pickers (shared FFPPicker).
- **admin dashboard:** Analytics, Community Health and Rankings location/category/gender/type/size filters all read the standardized taxonomy.

### 🔴 / 🟠 Mismatches (saved-value fields)

| # | Where | Field | Current source | Issue | Sev |
|---|---|---|---|---|---|
| A | Provider profile `pf-type` **vs** Admin Rankings classification | `providers.provider_type` | profile = hardcoded *business structure* (Single location / Multi-location / Mobile / Event organizer / Coach); rankings = `provider_type` taxonomy *facility type* (Gym / Studio / …) | **Same column, two vocabularies — they overwrite each other.** Admin classifying a provider wipes their profile "type" and vice-versa. | 🔴 |
| B | Provider experience modal `xm-type` | `experience_type` | hardcoded `[Fitness, Adventure, Wellness, Retreat, Sports Event, Hybrid]` | A `experience_type` taxonomy (6) exists + `FFP_TAX.experienceTypes`; this list is hardcoded and its values may not match the DB list. | 🟠 |
| C | Provider experience modal `xm-fitness-level` | `fitness_level` | hardcoded inline `[Not Tried…Professional]` | Right vocab, but not reading `FFP_TAX.fitnessLevels` → admin edits won't propagate. | 🟠 |
| D | Provider event modal `em-intensity` (UI "Level") | `events.intensity` | hardcoded inline `[Not Tried…Professional]` | Same as C; also field is named "intensity" in DB but labelled "Level" (naming drift). | 🟠 |
| E | profile-complete `CATEGORIES` | activity grouping | hardcoded 17-item array (`Running & walking`, `Cycling`, … `Multi-sport`) | A 3rd category vocabulary, separate from provider `category` (12) and from each activity's taxonomy `c`. Long-standing split. | 🟠 |
| F | Provider activity pickers | `activity` | `activity_types` table (379) for some paths vs `FFP_TAX.activities` (97) for others | Two activity vocabularies of different sizes across provider vs member surfaces. | 🟠 |
| G | Provider profile `pf-category` fallback | `category` | inline hardcoded fallback array duplicated in a `<script>` | Works, but the fallback list is a copy that can drift from the DB. | 🟡 |
| H | Member map | category→passport | 1 category unmapped | "Other" has no passport parent → no map theme. | 🟡 |
| I | Event "setting" field | `events.setting` | free-text/ad-hoc | Candidate for a small taxonomy (Indoor/Outdoor/Online/Hybrid) for filtering. | 🟡 |
| J | `provider_type` / `gym_size` | — | not in `FFP_TAX` | Fine today (only rankings uses them), but if provider self-classification is added later they should hydrate like the others. | 🟡 |

---

## 4. UX / UI observations (world-class lens)

1. **The provider_type conflict (A) is the headline UX bug** — a provider sets "Mobile / Online" and later an admin tags them "Gym"; the profile silently flips. Two concepts need two fields.
2. **Hardcoded option lists in listing forms (B, C, D)** break the platform's promise that "edit a list in Taxonomies → every form follows." Today an admin can rename a fitness level and the provider event/experience forms won't change.
3. **Vocabulary fragmentation for "category/level"** (E, F) — members see one activity-category list, providers another, and the map a third. World-class UX wants one canonical activity taxonomy with one category grouping, surfaced consistently.
4. **Naming drift** — "intensity" vs "Level", "category" `<select>` labelled "Activity" in the event modal. Confusing for future maintainers; consider aligning column names with labels.
5. **Filter dropdowns** generally hydrate well, but any built at `DOMContentLoaded` should also listen for `ffp-tax-ready` (profile-complete's gender field is the model to copy — it re-fills on the event).
6. **Positive patterns already in place** to standardise on: the styled activity dropdown (replaced the native datalist), gender re-hydration, and the admin filters reading the DB taxonomy.

---

## 5. Email notifications — where they *should* fire

**Infra (exists & works):** backend `nodemailer` + SMTP, with senders `sendCodeEmail` (login), `sendWelcomeEmail` (profile-complete), `sendProviderVerifyEmail` (provider signup). In-app notifications (the bell) come from `/api/notifications/:id`.

| Lifecycle event | Email today? | Should email? | Notes / Sev |
|---|---|---|---|
| Listing approved / rejected by admin | ❌ | ✅ | **The provider Overview banner literally says "You'll get an email when each one goes live" — promised but not sent.** 🔴 |
| New review submitted → provider | ❌ | ✅ | "You got a new 5★ review at [Venue]." Drives engagement. 🟠 |
| Review prompt ~1h after check-in → member | ❌ (in-app only, by design) | optional | You chose in-app; email needs a cron. Revisit if in-app conversion is low. 🟡 |
| Meetup: someone joins your meet-up → host | ❌ (in-app row only) | ✅ | 🟠 |
| Meetup cancelled → joined attendees | ❌ (in-app row only) | ✅ | Cancellation is high-value to email. 🟠 |
| Event RSVP / Experience application | ❌ | ✅ | Confirmation to member + alert to provider. 🟠 |
| New provider signs up → admin | ❌ | ✅ | Ops awareness. 🟡 |
| Quest completed / stamp awarded → member | ❌ | optional | Delight moment. 🟡 |
| Payout processed → provider | ❌ | ✅ (when payouts go live) | 🟡 |
| Welcome / login code / provider verify | ✅ | ✅ | Already covered. |

---

## 6. Recommended fix plan (prioritised)

**P1 — data integrity (do first)**
1. **Resolve the `provider_type` conflict (A).** Recommended: keep `providers.provider_type` for the *facility type* taxonomy (Gym/Studio/… — what rankings/discovery filter on), and move the profile's *business structure* to a new field (e.g. `business_structure`, optionally its own taxonomy list `business_structure`). Then point the profile `pf-type` `<select>` at whichever taxonomy it should own. **Needs your decision on which concept `provider_type` keeps.**
2. Map the one unmapped category to a passport (H) — 1-minute admin edit.

**P2 — kill hardcoded lists (make Taxonomies authoritative)**
3. Point `xm-type` at `FFP_TAX.experienceTypes` (B), `xm-fitness-level` (C) and `em-intensity` (D) at `FFP_TAX.fitnessLevels`; have them re-fill on `ffp-tax-ready`.
4. Replace profile-complete's hardcoded `CATEGORIES` (E) with the activity taxonomy's category grouping; converge the member/provider activity sources (F) onto one list.

**P3 — email pipeline**
5. Add a small `notify(member_id, {title, body, email?})` path so DB notification rows can optionally also email. Wire it to: listing approval (closes the broken promise), new review→provider, meetup join/cancel, RSVP/application.

**P4 — polish**
6. Add an `event setting` taxonomy (I); hydrate `provider_type`/`gym_size` into `FFP_TAX` if provider self-classification is added (J); align column names with labels (intensity/Level).

---

---

## 7. Status of fixes (updated 2026-06-03)

- ✅ **P1 DONE** — `provider_type` unified into ONE concept per Grant ("they're the same thing"). List reseeded: Gym, Studio, Yoga Studio, Pilates Studio, CrossFit Box, Sports Club / Team, Adventure Provider, Wellness Centre, Recovery Studio, Health Food Cafe, Coaching / PT, Event Organizer, Other. The `business_structure` detour was dropped. Provider profile field + admin rankings now share this one taxonomy list. (DB migrations live; ffp-taxonomy.js v6; provider dashboard v29.)
- ✅ **P1 (orphan category)** — note: "Other" is intentionally left without a passport parent (catch-all); map it in admin if you want it themed.
- ✅ **P2 DONE** — experience Type, experience Fitness level, and event Level selects now read `FFP_TAX` (experienceTypes / fitnessLevels) instead of hardcoded arrays. Remaining P2 polish (converge the profile-complete `CATEGORIES` grouping + activity_types(379) vs FFP_TAX.activities(97)) is a larger data-convergence task — deferred, flagged here.
- ⏳ **P3 EMAIL — not built yet.** Needs a mechanism decision: recommended = an `email_outbox` table that RPCs insert into + a Supabase Edge Function (or cron) that sends via the existing SMTP. Confirm and I'll build it (and wire listing-approval first, to close the broken promise).

*Deploy for P1+P2: `ffp-provider-dashboard.html` v29 + `assets/ffp-taxonomy.js` v6 (DB already live).*
