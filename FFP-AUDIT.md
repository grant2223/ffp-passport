# FFP — Live Structure Audit (2026-06-11)

> Full-stack review of the live ecosystem (DB + RPCs + storage + frontend + backend), aligned to
> `FFP-SOURCE-OF-TRUTH.md` and FFP-MASTER. Signals: Supabase security advisors (377 lints) + performance
> advisors (239 lints) + auth/idempotency paths + this session's whole-system knowledge.

## Verdict
Architecture is strong and coherent — one shared DB, a uniform SECURITY-DEFINER-RPC access model, a written
Source of Truth both platforms read. Working today with a good user feel. Gaps were a few real-but-quick
security items (now fixed), scale-readiness debt (not yet biting), and cross-platform alignment that depends on
findfitpeople.com following the contract. Nothing structural is broken.

## Security — fixed this pass
- ✅ **`event_results`** — RLS was DISABLED (anon-key readable/writable). Enabled RLS (RPC-only access; no policy
  needed — SECURITY DEFINER RPCs bypass it). Verified no page reads it directly.
- ✅ **`pr_history`** — same; RLS enabled.
- ✅ **`payout-receipts` bucket** — was `public=true` (financial receipts reachable by CDN URL, bypassing the
  authenticated-only storage policies). Flipped **private**; admin payouts loader switched `getPublicUrl` →
  `createSignedUrl` (1-yr). Admin dashboard → **v47** (lazy cache-bust v=52). 1 existing receipt's old public
  link will 404 (acceptable; re-upload if needed).

## Security — reviewed, intentionally kept (NOT bugs)
- **`professionals_public` view (SECURITY DEFINER)** — flagged ERROR by the linter, but it's the *correct*
  pattern: a curated, PII-free projection (no email/phone/member_id) of only `is_published AND approved` rows,
  exposed to anon for the public storefront. `professionals` RLS is authenticated-only, so an anon table policy
  would EXPOSE phone/email. Keep the view. (Accepted exception.)
- **`provider_applications` "always true" policy** — it's the public *apply* INSERT (an application form);
  SELECT/UPDATE are `is_admin()`-gated. Intentional. (Spam-rate-limit is a future nicety, not a leak.)
- **~346 `anon/authenticated_security_definer_function_executable` warnings** — EXPECTED for this architecture
  (members are the `anon` role; all writes go through SECURITY DEFINER RPCs). Not vulnerabilities. Sub-risk: the
  `pro_*`/`provider_*` RPCs take an explicit owner-id and trust the caller — low risk for most; the sensitive
  ones are already gated (pro health data behind an approved grant; member consent via `auth.uid()`). A
  deliberate hardening pass (derive owner from JWT on write/financial RPCs) is worthwhile, not urgent.
- **24 `rls_enabled_no_policy` (INFO)** — by design (tables accessed only via RPCs, e.g. `booking_checkins`).

## Performance — scale-readiness (not urgent at current volume; one clean-up pass before real traffic)
239 lints, all benign now: 124 `multiple_permissive_policies`, 68 `auth_rls_initplan` (wrap `auth.uid()` in a
subselect), 32 `unindexed_foreign_keys`, ~14 `unused_index`, 1 `duplicate_index`. None hurt with current data
(handful of rows). Batch-fix before scaling.

## Strengths
- One identity by email is enforced on the Passport/backend side (onboard + signup find-or-create by lowercased
  email before insert).
- Uniform RPC access model; sensitive data properly gated (pro health behind grant; consent via auth.uid()).
- Pricing & recurring referral aligned end-to-end (subscription $20/$149/trial; referral per-invoice server-side).
- Consistent check-in pattern across events / quests / bookings (scan → confirm → geo-verified write → activity log).
- Cross-platform contract is concrete: `platform_docs` (integration_contract + source_of_truth), public read.

## Alignment scorecard vs Source of Truth
| Principle | State |
| --- | --- |
| One account by email | ✅ Passport; ⚠️ depends on FFP doing the same |
| Subscription pricing ($20/$149/trial) | ✅ aligned |
| Not a discount site | ✅ corrected |
| Recurring referral | ✅ live + display fixed |
| Membership owned by Passport, read by FFP | ✅ |
| Booking on FFP, check-in shared, Passport reads | ✅ contract live; ⚠️ Passport scan UI pending |
| Docs shared via platform_docs | ✅ |

## Open items (priority order)
1. **Booking platform must find-or-create members by email** (the one alignment risk our DB can't enforce).
2. **Add `bookings.scheduled_at`** (no session date/time on the booking row → "today's booking"/roster ambiguous).
3. **Passport-side booking check-in UI** — write target + lookup exist; the scan-and-confirm screen is the
   remaining build (extend `ffp-member-checkin-loader.js`). NB `booking_checkins` is still empty — confirm the new
   QR reader is actually calling `booking_checkin` (no rows have landed yet).
4. **Scale-readiness clean-up pass** on the performance lints before real traffic.
5. **Harden explicit-id RPCs** (derive owner from JWT on write/financial RPCs).
6. **Finish member-dashboard monolith extraction** (~14k lines = the biggest fragility) + the native-dropdown purge.

## Deploy for this pass (Netlify)
`ffp-admin-dashboard.html` (v47) + `ffp-admin-payouts-loader.js`. DB + storage changes are already live.
