/* FFP Constants - v1 (2026-05-31)
   SINGLE SOURCE OF TRUTH for cross-platform taxonomy + config. Load this BEFORE any
   dashboard logic so forms and calculations read window.FFP_CONST instead of each file
   keeping its own (drifting) copy.

   Money is USD member-facing (membership, referral earnings, payouts). Provider billing
   is AED elsewhere; FX below converts when needed. Referral reward = pct of membership.
*/
(function () {
  'use strict';
  window.FFP_CONST = {
    currency: 'USD',
    membershipUsd: 99,        // what a member pays
    minPayoutUsd: 250,        // minimum balance to request a payout
    referralPct: { member: 5, supporter: 10, ambassador: 20 }, // % of membershipUsd per tier
    fxAed: 3.6725,            // 1 USD -> AED (provider billing / conversions)

    // Canonical PROVIDER BUSINESS categories — used in apply + provider profile + admin.
    // (Activity/sport types for events/experiences are a separate list — not this one.)
    providerCategories: [
      'Fitness',
      'Wellness',
      'Padel',
      'Yoga & Pilates',
      'Climbing',
      'Combat sports',
      'Recovery',
      'Adventure',
      'Nutrition',
      'Coaching',
      'Retail',
      'Other'
    ]
  };

  // Helper: USD referral reward for a tier
  window.FFP_CONST.referralUsd = function (tier) {
    var pct = (window.FFP_CONST.referralPct[tier] || 0);
    return Math.round(window.FFP_CONST.membershipUsd * pct / 100 * 100) / 100;
  };
})();
