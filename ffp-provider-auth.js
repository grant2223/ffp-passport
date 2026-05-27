/* FFP Provider Auth Gate — v1
   Add ONE script tag to ffp-provider-dashboard.html (after ffp-api-integration.js):
     <script src="ffp-provider-auth.js"></script>

   Auth flow:
   - Hides the page on load
   - Shows FFP-themed overlay (same look as admin auth)
   - Email + OTP login (Supabase)
   - After OTP verify, checks providers table for owner_user_id = auth.uid()
   - Status handling:
       approved  → grants access, dashboard reveals
       pending   → "Your application is under review" (no access yet)
       suspended → "Account suspended" (sign-out option)
       archived  → same as suspended
       no row    → "No provider account linked" (sign-out option)

   Sets window.FFP_PROVIDER = { id, business_name, status, role } on success.
   Fires 'ffp-provider-ready' event on document.

   Prerequisite SQL (run once if not done — exposes own provider row to RLS):
     ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
     DROP POLICY IF EXISTS providers_select_own ON providers;
     CREATE POLICY providers_select_own ON providers
       FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
*/
(function () {
  'use strict';

  // ─── Block the page until verified ───
  var hideStyle = document.createElement('style');
  hideStyle.id = 'ffp-provider-auth-hide';
  hideStyle.textContent =
    'body > *:not(.ffp-provider-auth-overlay){visibility:hidden !important;}' +
    'body{overflow:hidden !important;}' +
    '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}' +
    '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}';
  document.head.appendChild(hideStyle);

  var css = document.createElement('style');
  css.textContent = [
    '.ffp-provider-auth-overlay{position:fixed;inset:0;background:#081420;color:#f5f7fa;z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Montserrat,sans-serif;padding:24px;}',
    '.ffp-pa-card{width:100%;max-width:380px;background:#0f1e2e;border:1px solid rgba(43,168,224,0.30);border-radius:16px;padding:28px 24px;text-align:center;}',
    '.ffp-pa-logo{font-size:18px;font-weight:900;letter-spacing:0.3px;color:#f5f7fa;margin-bottom:4px;}',
    '.ffp-pa-sub{font-size:12px;color:#8a99a8;margin-bottom:24px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;}',
    '.ffp-pa-title{font-size:20px;font-weight:800;color:#f5f7fa;margin-bottom:8px;}',
    '.ffp-pa-msg{font-size:13px;color:#8a99a8;line-height:1.5;margin-bottom:18px;}',
    '.ffp-pa-input{width:100%;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.30);border-radius:10px;color:#f5f7fa;padding:12px 14px;font-size:14px;font-weight:600;font-family:inherit;margin-bottom:10px;text-align:center;}',
    '.ffp-pa-input:focus{outline:none;border-color:#2ba8e0;}',
    '.ffp-pa-code-wrap{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:0 auto 12px;max-width:320px;width:100%;}',
    '.ffp-pa-code-digit{width:100%;height:56px;min-width:0;padding:0;background:rgba(43,168,224,0.06);border:1px solid rgba(43,168,224,0.30);border-radius:10px;color:#f5f7fa;font-size:22px;font-weight:800;font-family:inherit;text-align:center;}',
    '.ffp-pa-code-digit:focus{outline:none;border-color:#2ba8e0;}',
    '@media (max-width:360px){.ffp-pa-code-wrap{gap:6px;max-width:280px;}.ffp-pa-code-digit{height:52px;font-size:20px;}}',
    '.ffp-pa-btn{width:100%;background:#FFCC00;color:#082335;border:none;border-radius:10px;padding:12px 16px;font-size:14px;font-weight:800;font-family:inherit;cursor:pointer;letter-spacing:0.3px;}',
    '.ffp-pa-btn:disabled{opacity:0.5;cursor:not-allowed;}',
    '.ffp-pa-btn:hover:not(:disabled){filter:brightness(1.05);}',
    '.ffp-pa-btn-secondary{background:transparent;border:1px solid rgba(43,168,224,0.30);color:#8a99a8;margin-top:10px;}',
    '.ffp-pa-btn-secondary:hover:not(:disabled){border-color:#f5f7fa;color:#f5f7fa;}',
    '.ffp-pa-error{font-size:12px;color:#ef4444;margin-top:10px;font-weight:600;min-height:16px;}',
    '.ffp-pa-spinner{width:36px;height:36px;border:3px solid rgba(43,168,224,0.30);border-top-color:#2ba8e0;border-radius:50%;margin:0 auto;animation:ffpPaSpin 0.8s linear infinite;}',
    '@keyframes ffpPaSpin{to{transform:rotate(360deg);}}',
    '.ffp-pa-status-tag{display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:14px;}',
    '.ffp-pa-status-pending{background:rgba(255,204,0,0.15);color:#FFCC00;}',
    '.ffp-pa-status-suspended{background:rgba(239,68,68,0.15);color:#ef4444;}'
  ].join('');
  document.head.appendChild(css);

  var overlay = document.createElement('div');
  overlay.className = 'ffp-provider-auth-overlay';
  overlay.innerHTML =
    '<div class="ffp-pa-card">' +
      '<div class="ffp-pa-logo">FFP Passport</div>' +
      '<div class="ffp-pa-sub">Provider Portal</div>' +
      '<div id="ffp-pa-body"></div>' +
    '</div>';

  function ensureAttached() {
    if (overlay.parentNode) return;
    if (document.body) document.body.appendChild(overlay);
  }
  if (document.body) ensureAttached();
  else document.addEventListener('DOMContentLoaded', ensureAttached);

  var state = { email: '', awaitingCode: false };

  function escapeText(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showLoading(msg) {
    ensureAttached();
    var body = document.getElementById('ffp-pa-body');
    if (!body) return;
    body.innerHTML =
      '<div class="ffp-pa-spinner"></div>' +
      '<div class="ffp-pa-msg" style="margin-top:16px;">' + (msg || 'Checking access\u2026') + '</div>';
  }

  function showEmailForm(prefill) {
    ensureAttached();
    var body = document.getElementById('ffp-pa-body');
    if (!body) return;
    body.innerHTML =
      '<div class="ffp-pa-title">Provider sign in</div>' +
      '<div class="ffp-pa-msg">Use the email on your provider account. A 6-digit code will be sent.</div>' +
      '<input type="email" class="ffp-pa-input" id="ffp-pa-email" placeholder="you@business.com" value="' + (prefill || '') + '" autocomplete="email">' +
      '<button class="ffp-pa-btn" id="ffp-pa-send">Send code</button>' +
      '<div class="ffp-pa-error" id="ffp-pa-err"></div>';
    var input = document.getElementById('ffp-pa-email');
    var btn = document.getElementById('ffp-pa-send');
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });
    input.focus();
    btn.addEventListener('click', sendCode);
  }

  function showCodeForm(email) {
    ensureAttached();
    var body = document.getElementById('ffp-pa-body');
    if (!body) return;
    var digits = '';
    for (var i = 0; i < 6; i++) {
      digits += '<input type="text" inputmode="numeric" maxlength="1" class="ffp-pa-code-digit" data-i="' + i + '">';
    }
    body.innerHTML =
      '<div class="ffp-pa-title">Enter code</div>' +
      '<div class="ffp-pa-msg">Sent to <b>' + escapeText(email) + '</b>. Check spam if missing.</div>' +
      '<div class="ffp-pa-code-wrap">' + digits + '</div>' +
      '<button class="ffp-pa-btn" id="ffp-pa-verify">Verify</button>' +
      '<button class="ffp-pa-btn ffp-pa-btn-secondary" id="ffp-pa-back">Use a different email</button>' +
      '<div class="ffp-pa-error" id="ffp-pa-err"></div>';

    var inputs = body.querySelectorAll('.ffp-pa-code-digit');
    inputs.forEach(function (inp, idx) {
      inp.addEventListener('input', function () {
        inp.value = inp.value.replace(/[^0-9]/g, '').slice(0, 1);
        if (inp.value && idx < inputs.length - 1) inputs[idx + 1].focus();
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !inp.value && idx > 0) inputs[idx - 1].focus();
        if (e.key === 'Enter') document.getElementById('ffp-pa-verify').click();
      });
      inp.addEventListener('paste', function (e) {
        var pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '').slice(0, 6);
        if (pasted.length > 0) {
          e.preventDefault();
          for (var i = 0; i < 6; i++) inputs[i].value = pasted[i] || '';
          if (pasted.length === 6) document.getElementById('ffp-pa-verify').click();
          else if (pasted.length < 6) inputs[pasted.length].focus();
        }
      });
    });
    inputs[0].focus();

    document.getElementById('ffp-pa-verify').addEventListener('click', verifyCode);
    document.getElementById('ffp-pa-back').addEventListener('click', function () {
      state.awaitingCode = false;
      showEmailForm(state.email);
    });
  }

  function showPending(email, businessName) {
    ensureAttached();
    var body = document.getElementById('ffp-pa-body');
    if (!body) return;
    body.innerHTML =
      '<div class="ffp-pa-status-tag ffp-pa-status-pending">Pending review</div>' +
      '<div class="ffp-pa-title">' + escapeText(businessName || 'Your application') + '</div>' +
      '<div class="ffp-pa-msg">Your provider application is under review by the FFP team. You\'ll get an email once it\'s approved. Sit tight.</div>' +
      '<button class="ffp-pa-btn ffp-pa-btn-secondary" id="ffp-pa-signout">Sign out</button>';
    document.getElementById('ffp-pa-signout').addEventListener('click', signOutAndRetry);
  }

  function showSuspended(email, businessName, status) {
    ensureAttached();
    var body = document.getElementById('ffp-pa-body');
    if (!body) return;
    var label = status === 'archived' ? 'Archived' : 'Suspended';
    body.innerHTML =
      '<div class="ffp-pa-status-tag ffp-pa-status-suspended">' + label + '</div>' +
      '<div class="ffp-pa-title">Account not active</div>' +
      '<div class="ffp-pa-msg">' + escapeText(businessName || 'Your provider account') + ' is currently <b>' + label.toLowerCase() + '</b>. Contact <a style="color:#2ba8e0;" href="mailto:hello@ffppassport.com">hello@ffppassport.com</a> if you think this is wrong.</div>' +
      '<button class="ffp-pa-btn ffp-pa-btn-secondary" id="ffp-pa-signout">Sign out</button>';
    document.getElementById('ffp-pa-signout').addEventListener('click', signOutAndRetry);
  }

  function showNoProvider(email) {
    ensureAttached();
    var body = document.getElementById('ffp-pa-body');
    if (!body) return;
    body.innerHTML =
      '<div class="ffp-pa-title">No provider account</div>' +
      '<div class="ffp-pa-msg">' + escapeText(email || 'This account') + ' isn\'t linked to a provider. Apply at <a style="color:#2ba8e0;" href="https://ffppassport.com/partner.html">ffppassport.com/partner</a> or sign in with a different email.</div>' +
      '<button class="ffp-pa-btn ffp-pa-btn-secondary" id="ffp-pa-signout">Sign out & try another email</button>';
    document.getElementById('ffp-pa-signout').addEventListener('click', signOutAndRetry);
  }

  function showError(msg) {
    var el = document.getElementById('ffp-pa-err');
    if (el) el.textContent = msg || '';
  }

  async function waitForSupabase() {
    var tries = 0;
    while ((!window.supabase || !window.supabase.auth) && tries < 50) {
      await new Promise(function (r) { setTimeout(r, 100); });
      tries++;
    }
    return !!(window.supabase && window.supabase.auth);
  }

  async function sendCode() {
    var input = document.getElementById('ffp-pa-email');
    var btn = document.getElementById('ffp-pa-send');
    if (!input) return;
    var email = (input.value || '').trim().toLowerCase();
    if (!email || email.indexOf('@') === -1) {
      showError('Enter a valid email');
      return;
    }
    btn.disabled = true;
    showError('');
    try {
      var res = await window.supabase.auth.signInWithOtp({
        email: email,
        options: { shouldCreateUser: false }
      });
      if (res.error) {
        showError(res.error.message || 'Could not send code');
        btn.disabled = false;
        return;
      }
      state.email = email;
      state.awaitingCode = true;
      showCodeForm(email);
    } catch (e) {
      console.error('[FFP Provider Auth] send code:', e);
      showError('Network error. Try again.');
      btn.disabled = false;
    }
  }

  async function verifyCode() {
    var inputs = document.querySelectorAll('.ffp-pa-code-digit');
    var code = '';
    inputs.forEach(function (i) { code += i.value || ''; });
    if (code.length !== 6) {
      showError('Enter the 6-digit code');
      return;
    }
    var btn = document.getElementById('ffp-pa-verify');
    btn.disabled = true;
    showError('');
    try {
      var res = await window.supabase.auth.verifyOtp({
        email: state.email,
        token: code,
        type: 'email'
      });
      if (res.error) {
        showError(res.error.message || 'Invalid or expired code');
        btn.disabled = false;
        return;
      }
      showLoading('Verifying provider account\u2026');
      await checkProviderAndProceed();
    } catch (e) {
      console.error('[FFP Provider Auth] verify code:', e);
      showError('Network error. Try again.');
      btn.disabled = false;
    }
  }

  async function signOutAndRetry() {
    try { await window.supabase.auth.signOut(); } catch (e) {}
    state.awaitingCode = false;
    showEmailForm('');
  }

  async function checkProviderAndProceed() {
    try {
      var userRes = await window.supabase.auth.getUser();
      if (userRes.error || !userRes.data || !userRes.data.user) {
        showEmailForm();
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
        showNoProvider(user.email);
        return;
      }
      if (!provRes.data) {
        showNoProvider(user.email);
        return;
      }
      var p = provRes.data;
      if (p.status === 'approved') {
        grantAccess(p);
      } else if (p.status === 'pending') {
        showPending(user.email, p.business_name);
      } else if (p.status === 'suspended' || p.status === 'archived') {
        showSuspended(user.email, p.business_name, p.status);
      } else {
        showNoProvider(user.email);
      }
    } catch (e) {
      console.error('[FFP Provider Auth] checkProvider:', e);
      showNoProvider('');
    }
  }

  function grantAccess(provider) {
    window.FFP_PROVIDER = {
      id: provider.id,
      business_name: provider.business_name,
      status: provider.status
    };
    var hide = document.getElementById('ffp-provider-auth-hide');
    if (hide) hide.remove();
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.dispatchEvent(new CustomEvent('ffp-provider-ready', { detail: window.FFP_PROVIDER }));
    console.log('[FFP Provider Auth] Access granted \u00b7 ' + provider.business_name);
  }

  async function boot() {
    var tries = 0;
    while (!document.body && tries < 50) {
      await new Promise(function (r) { setTimeout(r, 20); });
      tries++;
    }
    ensureAttached();
    showLoading('Checking access\u2026');
    var ok = await waitForSupabase();
    if (!ok) {
      showError('Supabase SDK not loaded');
      return;
    }
    var sessRes = await window.supabase.auth.getSession();
    if (sessRes.data && sessRes.data.session) {
      await checkProviderAndProceed();
    } else {
      showEmailForm('');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
