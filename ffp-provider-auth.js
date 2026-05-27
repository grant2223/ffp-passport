/* FFP Provider Auth — v3 (PROPER WIRING, not an overlay)
   Replaces the dashboard's DEMO auth functions with real Supabase OTP auth.
   Hooks into the existing #auth-screen UI — no separate overlay.

   What it does:
   1. Fixes the OTP digit-box layout (was flex:1 stretching across full card width)
   2. Removes the "Demo: enter any 6 digits" text + "Skip to dashboard" link
   3. Replaces global submitEmail()  -> real supabase.auth.signInWithOtp
   4. Replaces global verifyCode()   -> real supabase.auth.verifyOtp + providers row check
   5. Replaces global resendCode()   -> real signInWithOtp
   6. Replaces global submitApplication() -> INSERT into provider_applications
   7. On page load: if session exists + provider is approved, skip auth-screen entirely

   Required SQL (run once if not already done):
     ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
     DROP POLICY IF EXISTS providers_select_own ON providers;
     CREATE POLICY providers_select_own ON providers
       FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

   On approved access:
     window.FFP_PROVIDER = { id, business_name, status }
     enterDashboard() is called

   On not approved / no row / suspended:
     Toast + auto sign-out to the landing screen
*/
(function () {
  'use strict';

  // ─── 1. Fix OTP box layout (override the demo's flex:1 stretching) ───
  var fixCss = document.createElement('style');
  fixCss.id = 'ffp-provider-auth-css';
  fixCss.textContent = [
    /* Constrain the 6-digit row to a sensible width and center it */
    '#auth-screen .otp-boxes{display:grid !important;grid-template-columns:repeat(6,1fr);gap:10px;max-width:340px;margin:8px auto 6px;}',
    '#auth-screen .otp-box{flex:none !important;width:100% !important;min-width:0;padding:0;height:58px;font-size:22px;}',
    '@media (max-width:380px){#auth-screen .otp-boxes{max-width:280px;gap:6px;}#auth-screen .otp-box{height:52px;font-size:20px;}}',
    /* Hide the demo bypass link entirely */
    '#auth-screen .auth-skip{display:none !important;}'
  ].join('');
  if (document.head) document.head.appendChild(fixCss);

  // ─── 2. Helper: wait for Supabase to be loaded ───
  function waitForSupabase() {
    return new Promise(function (resolve) {
      var tries = 0;
      var iv = setInterval(function () {
        if (window.supabase && window.supabase.auth) {
          clearInterval(iv);
          resolve(true);
        } else if (++tries > 60) {
          clearInterval(iv);
          resolve(false);
        }
      }, 100);
    });
  }

  // ─── 3. Strip demo-only text from the code-entry sub-line ───
  function stripDemoText() {
    // The "We sent a 6-digit code to ___. Demo: enter any 6 digits." line lives in
    // #auth-signin-code .auth-sub. Replace with the non-demo wording.
    var sub = document.querySelector('#auth-signin-code .auth-sub');
    if (sub) {
      var emailB = sub.querySelector('#auth-code-email');
      var emailText = emailB ? emailB.textContent : '';
      sub.innerHTML = 'We sent a 6-digit code to <b id="auth-code-email">' +
        escapeText(emailText) + '</b>. Check spam if it doesn\'t arrive.';
    }
    var landingNote = document.querySelector('#auth-landing .auth-note');
    if (landingNote && /Demo mode/i.test(landingNote.textContent)) {
      landingNote.style.display = 'none';
    }
  }

  function escapeText(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, kind || 'info'); return; } catch (e) {}
    }
    console.log('[FFP Provider Auth]', msg);
  }

  // ─── 4. Real auth handlers ───

  async function realSubmitEmail() {
    var input = document.getElementById('auth-email-input');
    if (!input) return;
    var email = (input.value || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast('Enter a valid email', 'error');
      return;
    }
    if (!window.supabase) { toast('Auth not ready yet, try again', 'error'); return; }
    try {
      var res = await window.supabase.auth.signInWithOtp({
        email: email,
        options: { shouldCreateUser: false }
      });
      if (res.error) {
        toast(res.error.message || 'Could not send code', 'error');
        return;
      }
      window.authEmail = email;
      var emailB = document.getElementById('auth-code-email');
      if (emailB) emailB.textContent = email;
      if (typeof window.setAuthState === 'function') window.setAuthState('signin_code');
      stripDemoText();
      toast('Code sent to ' + email, 'success');
    } catch (e) {
      console.error('[FFP Provider Auth] submitEmail:', e);
      toast('Network error. Try again.', 'error');
    }
  }

  async function realResendCode() {
    if (!window.authEmail) { toast('Enter your email first', 'error'); return; }
    try {
      var res = await window.supabase.auth.signInWithOtp({
        email: window.authEmail,
        options: { shouldCreateUser: false }
      });
      if (res.error) { toast(res.error.message || 'Could not resend', 'error'); return; }
      toast('Code resent to ' + window.authEmail, 'success');
    } catch (e) {
      console.error('[FFP Provider Auth] resendCode:', e);
      toast('Network error. Try again.', 'error');
    }
  }

  async function realVerifyCode() {
    var boxes = document.querySelectorAll('#otp-boxes .otp-box');
    var code = Array.prototype.map.call(boxes, function (b) { return b.value || ''; }).join('');
    if (code.length !== 6) { toast('Enter all 6 digits', 'error'); return; }
    if (!window.authEmail) { toast('Enter your email first', 'error'); return; }
    if (!window.supabase) { toast('Auth not ready yet', 'error'); return; }
    try {
      var res = await window.supabase.auth.verifyOtp({
        email: window.authEmail,
        token: code,
        type: 'email'
      });
      if (res.error) {
        toast(res.error.message || 'Invalid or expired code', 'error');
        return;
      }
      // Verified — now check providers row
      await checkProviderAndEnter();
    } catch (e) {
      console.error('[FFP Provider Auth] verifyCode:', e);
      toast('Network error. Try again.', 'error');
    }
  }

  async function checkProviderAndEnter() {
    try {
      var userRes = await window.supabase.auth.getUser();
      if (userRes.error || !userRes.data || !userRes.data.user) {
        toast('Session error — try signing in again', 'error');
        return;
      }
      var user = userRes.data.user;
      var provRes = await window.supabase
        .from('providers')
        .select('id, business_name, status')
        .eq('owner_user_id', user.id)
        .maybeSingle();

      if (provRes.error) {
        console.error('[FFP Provider Auth] providers read:', provRes.error);
        toast('Could not load your provider account', 'error');
        await signOutAndReset();
        return;
      }
      if (!provRes.data) {
        toast('No provider account linked to this email. Apply via "Apply to join".', 'error');
        await signOutAndReset();
        return;
      }
      var p = provRes.data;
      if (p.status === 'approved') {
        window.FFP_PROVIDER = { id: p.id, business_name: p.business_name, status: p.status };
        if (typeof window.enterDashboard === 'function') {
          window.enterDashboard();
        }
        document.dispatchEvent(new CustomEvent('ffp-provider-ready', { detail: window.FFP_PROVIDER }));
        console.log('[FFP Provider Auth] Access granted \u00b7 ' + p.business_name);
      } else if (p.status === 'pending') {
        toast('Your application is under review. We\'ll email you when approved.', 'info');
        await signOutAndReset();
      } else if (p.status === 'suspended' || p.status === 'archived') {
        toast('Account ' + p.status + '. Contact hello@ffppassport.com', 'error');
        await signOutAndReset();
      } else {
        toast('Account status unrecognised — contact support', 'error');
        await signOutAndReset();
      }
    } catch (e) {
      console.error('[FFP Provider Auth] checkProvider:', e);
      toast('Could not verify your account', 'error');
    }
  }

  async function signOutAndReset() {
    try { await window.supabase.auth.signOut(); } catch (e) {}
    if (typeof window.setAuthState === 'function') window.setAuthState('landing');
  }

  // ─── 5. Real apply submission ───

  async function realSubmitApplication() {
    var get = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    var business = get('ap-business');
    var contact  = get('ap-contact');
    var email    = get('ap-email');
    var phoneNum = get('ap-phone-num');
    var phoneCc  = get('ap-phone-cc');
    var category = get('ap-category');
    var city     = get('ap-city');
    var about    = get('ap-about');
    var website  = get('ap-website');

    if (!business || !contact || !email || !phoneNum || !category || !city || !about) {
      toast('Fill all required fields', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast('Enter a valid email', 'error');
      return;
    }
    if (!window.supabase) { toast('Network not ready', 'error'); return; }

    try {
      var payload = {
        business_name: business,
        contact_name:  contact,
        email:         email.toLowerCase(),
        phone:         (phoneCc || '') + phoneNum,
        category:      category,
        city:          city,
        about:         about,
        website:       website || null,
        status:        'pending'
      };
      var res = await window.supabase.from('provider_applications').insert(payload);
      if (res.error) {
        console.error('[FFP Provider Auth] insert application:', res.error);
        toast(res.error.message || 'Could not submit application', 'error');
        return;
      }
      var emailDisplay = document.getElementById('auth-applied-email');
      if (emailDisplay) emailDisplay.textContent = email;
      if (typeof window.setAuthState === 'function') window.setAuthState('apply_submitted');
    } catch (e) {
      console.error('[FFP Provider Auth] submitApplication:', e);
      toast('Network error. Try again.', 'error');
    }
  }

  // ─── 6. Boot — replace globals, check existing session ───

  async function boot() {
    // Wait for Supabase + DOM
    if (document.readyState === 'loading') {
      await new Promise(function (r) { document.addEventListener('DOMContentLoaded', r); });
    }
    var ok = await waitForSupabase();
    if (!ok) {
      console.error('[FFP Provider Auth] Supabase did not load — falling back to demo auth');
      return;
    }

    // Patch the demo strings + hide demo skip link (already done via CSS for the skip)
    stripDemoText();

    // Replace the dashboard's global auth functions with real ones
    window.submitEmail        = realSubmitEmail;
    window.verifyCode         = realVerifyCode;
    window.resendCode         = realResendCode;
    window.submitApplication  = realSubmitApplication;
    window.bypassAuthDemo     = function () { toast('Demo bypass disabled', 'info'); };

    // Wrap signOut so it actually signs out of Supabase
    var origSignOut = window.signOut;
    window.signOut = async function () {
      try { await window.supabase.auth.signOut(); } catch (e) {}
      if (typeof origSignOut === 'function') {
        try { origSignOut(); } catch (e) {}
      } else {
        window.location.reload();
      }
    };

    // If there's already a session, try to skip auth-screen entirely
    try {
      var sess = await window.supabase.auth.getSession();
      if (sess.data && sess.data.session) {
        await checkProviderAndEnter();
      }
    } catch (e) {
      console.error('[FFP Provider Auth] session check:', e);
    }
  }

  boot();
})();
