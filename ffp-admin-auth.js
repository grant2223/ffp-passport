/* FFP Admin Auth Gate — v3
   v3 fix: Overlay attached before body content was rendered (race condition with
   DOMContentLoaded). v3 ensures overlay is attached before every render call
   and inside boot() so the spinner/form/error always show.

   Add ONE script tag to ffp-admin-dashboard.html (after ffp-api-integration.js):
     <script src="ffp-admin-auth.js"></script>

   What it does:
   - Hides the page on load
   - Shows a full-screen FFP-branded overlay with either:
       a) Loading spinner while checking session
       b) Email + OTP login flow if not signed in
       c) "Access denied" if signed in but not in admin_users
   - Verifies admin_users row via Supabase RLS (member sees only own row)
   - Once verified admin → hides overlay, reveals dashboard

   Prerequisite SQL (run once — see message).
*/
(function () {
  'use strict';

  // ─── Block the page until verified ───
  var hideStyle = document.createElement('style');
  hideStyle.id = 'ffp-admin-auth-hide';
  hideStyle.textContent =
    'body > *:not(.ffp-admin-auth-overlay){visibility:hidden !important;}' +
    'body{overflow:hidden !important;}' +
    '*::-webkit-scrollbar{display:none !important;width:0 !important;height:0 !important;}' +
    '*{-ms-overflow-style:none !important;scrollbar-width:none !important;}';
  document.head.appendChild(hideStyle);

  // ─── Overlay CSS ───
  var css = document.createElement('style');
  css.textContent = [
    '.ffp-admin-auth-overlay{position:fixed;inset:0;background:var(--bg, #081420);color:var(--text, #f5f7fa);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Montserrat,sans-serif;padding:24px;}',
    '.ffp-aa-card{width:100%;max-width:380px;background:var(--bg-2, #0f1e2e);border:1px solid var(--border-mid, rgba(43,168,224,0.30));border-radius:16px;padding:28px 24px;text-align:center;}',
    '.ffp-aa-logo{font-size:18px;font-weight:900;letter-spacing:0.3px;color:var(--text);margin-bottom:4px;}',
    '.ffp-aa-sub{font-size:12px;color:var(--muted, #8a99a8);margin-bottom:24px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;}',
    '.ffp-aa-title{font-size:20px;font-weight:800;color:var(--text);margin-bottom:8px;}',
    '.ffp-aa-msg{font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:18px;}',
    '.ffp-aa-input{width:100%;background:rgba(43,168,224,0.06);border:1px solid var(--border-mid);border-radius:10px;color:var(--text);padding:12px 14px;font-size:14px;font-weight:600;font-family:inherit;margin-bottom:10px;text-align:center;}',
    '.ffp-aa-input:focus{outline:none;border-color:var(--blue, #2ba8e0);}',
    '.ffp-aa-code-wrap{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:0 auto 12px;max-width:320px;width:100%;}',
    '.ffp-aa-code-digit{width:100%;height:56px;min-width:0;padding:0;background:rgba(43,168,224,0.06);border:1px solid var(--border-mid);border-radius:10px;color:var(--text);font-size:22px;font-weight:800;font-family:inherit;text-align:center;}',
    '.ffp-aa-code-digit:focus{outline:none;border-color:var(--blue);}',
    '@media (max-width:360px){.ffp-aa-code-wrap{gap:6px;max-width:280px;}.ffp-aa-code-digit{height:52px;font-size:20px;}}',
    '.ffp-aa-btn{width:100%;background:var(--yellow, #FFCC00);color:#082335;border:none;border-radius:10px;padding:12px 16px;font-size:14px;font-weight:800;font-family:inherit;cursor:pointer;letter-spacing:0.3px;}',
    '.ffp-aa-btn:disabled{opacity:0.5;cursor:not-allowed;}',
    '.ffp-aa-btn:hover:not(:disabled){filter:brightness(1.05);}',
    '.ffp-aa-btn-secondary{background:transparent;border:1px solid var(--border-mid);color:var(--muted);margin-top:10px;}',
    '.ffp-aa-btn-secondary:hover:not(:disabled){border-color:var(--text);color:var(--text);}',
    '.ffp-aa-error{font-size:12px;color:var(--red, #ef4444);margin-top:10px;font-weight:600;min-height:16px;}',
    '.ffp-aa-spinner{width:36px;height:36px;border:3px solid var(--border-mid);border-top-color:var(--blue);border-radius:50%;margin:0 auto;animation:ffpAaSpin 0.8s linear infinite;}',
    '@keyframes ffpAaSpin{to{transform:rotate(360deg);}}',
    '.ffp-aa-link{color:var(--blue);font-size:12px;font-weight:600;cursor:pointer;background:none;border:none;padding:0;margin-top:14px;text-decoration:underline;font-family:inherit;}'
  ].join('');
  document.head.appendChild(css);

  // ─── Overlay DOM ───
  var overlay = document.createElement('div');
  overlay.className = 'ffp-admin-auth-overlay';
  overlay.innerHTML =
    '<div class="ffp-aa-card" id="ffp-aa-card">' +
      '<div class="ffp-aa-logo">FFP Passport</div>' +
      '<div class="ffp-aa-sub">Admin Console</div>' +
      '<div id="ffp-aa-body"></div>' +
    '</div>';
  // Attach when body exists — defensive against script-loaded-before-body race
  function ensureAttached() {
    if (overlay.parentNode) return;
    if (document.body) document.body.appendChild(overlay);
  }
  if (document.body) {
    ensureAttached();
  } else {
    document.addEventListener('DOMContentLoaded', ensureAttached);
  }

  // ─── State ───
  var state = { email: '', awaitingCode: false };

  // ─── Views ───
  function showLoading(msg) {
    ensureAttached();
    var body = document.getElementById('ffp-aa-body');
    if (!body) return;
    body.innerHTML =
      '<div class="ffp-aa-spinner"></div>' +
      '<div class="ffp-aa-msg" style="margin-top:16px;">' + (msg || 'Checking access\u2026') + '</div>';
  }

  function showEmailForm(prefill) {
    ensureAttached();
    var body = document.getElementById('ffp-aa-body');
    if (!body) return;
    body.innerHTML =
      '<div class="ffp-aa-title">Sign in</div>' +
      '<div class="ffp-aa-msg">Use your admin email. A 6-digit code will be sent.</div>' +
      '<input type="email" class="ffp-aa-input" id="ffp-aa-email" placeholder="you@example.com" value="' + (prefill || '') + '" autocomplete="email">' +
      '<button class="ffp-aa-btn" id="ffp-aa-send">Send code</button>' +
      '<div class="ffp-aa-error" id="ffp-aa-err"></div>';
    var input = document.getElementById('ffp-aa-email');
    var btn = document.getElementById('ffp-aa-send');
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });
    input.focus();
    btn.addEventListener('click', sendCode);
  }

  function showCodeForm(email) {
    ensureAttached();
    var body = document.getElementById('ffp-aa-body');
    if (!body) return;
    var digits = '';
    for (var i = 0; i < 6; i++) {
      digits += '<input type="text" inputmode="numeric" maxlength="1" class="ffp-aa-code-digit" data-i="' + i + '">';
    }
    body.innerHTML =
      '<div class="ffp-aa-title">Enter code</div>' +
      '<div class="ffp-aa-msg">Sent to <b>' + escapeText(email) + '</b>. Check spam if missing.</div>' +
      '<div class="ffp-aa-code-wrap">' + digits + '</div>' +
      '<button class="ffp-aa-btn" id="ffp-aa-verify">Verify</button>' +
      '<button class="ffp-aa-btn ffp-aa-btn-secondary" id="ffp-aa-back">Use a different email</button>' +
      '<div class="ffp-aa-error" id="ffp-aa-err"></div>';

    var inputs = body.querySelectorAll('.ffp-aa-code-digit');
    inputs.forEach(function (inp, idx) {
      inp.addEventListener('input', function () {
        inp.value = inp.value.replace(/[^0-9]/g, '').slice(0, 1);
        if (inp.value && idx < inputs.length - 1) inputs[idx + 1].focus();
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !inp.value && idx > 0) inputs[idx - 1].focus();
        if (e.key === 'Enter') document.getElementById('ffp-aa-verify').click();
      });
      inp.addEventListener('paste', function (e) {
        var pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '').slice(0, 6);
        if (pasted.length > 0) {
          e.preventDefault();
          for (var i = 0; i < 6; i++) inputs[i].value = pasted[i] || '';
          if (pasted.length === 6) document.getElementById('ffp-aa-verify').click();
          else if (pasted.length < 6) inputs[pasted.length].focus();
        }
      });
    });
    inputs[0].focus();

    document.getElementById('ffp-aa-verify').addEventListener('click', verifyCode);
    document.getElementById('ffp-aa-back').addEventListener('click', function () {
      state.awaitingCode = false;
      showEmailForm(state.email);
    });
  }

  function showAccessDenied(email) {
    ensureAttached();
    var body = document.getElementById('ffp-aa-body');
    if (!body) return;
    body.innerHTML =
      '<div class="ffp-aa-title">Access denied</div>' +
      '<div class="ffp-aa-msg">This account (' + escapeText(email || '') + ') doesn\'t have admin access. Contact a super admin if you should.</div>' +
      '<button class="ffp-aa-btn ffp-aa-btn-secondary" id="ffp-aa-signout">Sign out & try another email</button>';
    document.getElementById('ffp-aa-signout').addEventListener('click', signOutAndRetry);
  }

  function showError(msg) {
    var el = document.getElementById('ffp-aa-err');
    if (el) el.textContent = msg || '';
  }

  function escapeText(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Supabase actions ───
  async function waitForSupabase() {
    var tries = 0;
    while ((!window.supabase || !window.supabase.auth) && tries < 50) {
      await new Promise(function (r) { setTimeout(r, 100); });
      tries++;
    }
    return !!(window.supabase && window.supabase.auth);
  }

  async function sendCode() {
    var input = document.getElementById('ffp-aa-email');
    var btn = document.getElementById('ffp-aa-send');
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
        // shouldCreateUser:false means new emails get an error — admins must already exist
        showError(res.error.message || 'Could not send code');
        btn.disabled = false;
        return;
      }
      state.email = email;
      state.awaitingCode = true;
      showCodeForm(email);
    } catch (e) {
      console.error('[FFP Admin Auth] send code:', e);
      showError('Network error. Try again.');
      btn.disabled = false;
    }
  }

  async function verifyCode() {
    var inputs = document.querySelectorAll('.ffp-aa-code-digit');
    var code = '';
    inputs.forEach(function (i) { code += i.value || ''; });
    if (code.length !== 6) {
      showError('Enter the 6-digit code');
      return;
    }
    var btn = document.getElementById('ffp-aa-verify');
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
      // Now check admin_users
      showLoading('Verifying admin access\u2026');
      await checkAdminAndProceed();
    } catch (e) {
      console.error('[FFP Admin Auth] verify code:', e);
      showError('Network error. Try again.');
      btn.disabled = false;
    }
  }

  async function signOutAndRetry() {
    try { await window.supabase.auth.signOut(); } catch (e) {}
    state.awaitingCode = false;
    showEmailForm('');
  }

  async function checkAdminAndProceed() {
    try {
      var userRes = await window.supabase.auth.getUser();
      if (userRes.error || !userRes.data || !userRes.data.user) {
        showEmailForm();
        return;
      }
      var user = userRes.data.user;
      var adminRes = await window.supabase
        .from('admin_users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (adminRes.error) {
        console.error('[FFP Admin Auth] admin_users read:', adminRes.error);
        showAccessDenied(user.email);
        return;
      }
      if (!adminRes.data) {
        showAccessDenied(user.email);
        return;
      }
      // Admin verified — reveal the dashboard
      grantAccess(adminRes.data.role);
    } catch (e) {
      console.error('[FFP Admin Auth] checkAdmin:', e);
      showAccessDenied('');
    }
  }

  function grantAccess(role) {
    // Tell the dashboard who's logged in (in case it wants to display it)
    window.FFP_ADMIN = { role: role };
    var hide = document.getElementById('ffp-admin-auth-hide');
    if (hide) hide.remove();
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.dispatchEvent(new CustomEvent('ffp-admin-ready', { detail: { role: role } }));
    console.log('[FFP Admin Auth] Access granted \u00b7 role: ' + role);
  }

  // ─── Boot ───
  async function boot() {
    // Wait for body to exist (script could have loaded before parser finished)
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
      await checkAdminAndProceed();
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
