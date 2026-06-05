/* ═══════════════════════════════════════════════════════════════
   FFP PROVIDER VENUE QR LOADER · v1
   File path: ffp-provider-venue-qr-loader.js (repo root)
   On-load log: [FFP Venue QR v1] Loaded ✓

   Shows the venue's check-in QR + FFP Passport number in the Check-ins panel,
   with a Download (PNG) button so the provider can print it and display it at
   the counter. The QR encodes the member check-in link
   (ffp-member-dashboard.html?venue=<provider_id>) — the same venue id the
   member scan flow reads. Reads providers.passport_no + business_name (RLS lets
   a provider read their own row). QR rendered client-side via qrcodejs (CDN).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MEMBER_APP = 'https://ffppassport.com/ffp-member-dashboard.html';
  var QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';

  function esc(s) {
    if (typeof window.escHtml === 'function') return window.escHtml(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function waitFor(check, ms) {
    return new Promise(function (resolve) {
      var t = 0, lim = Math.ceil((ms || 30000) / 150);
      var iv = setInterval(function () { if (check() || t++ >= lim) { clearInterval(iv); resolve(check()); } }, 150);
    });
  }
  function providerId() { return window.FFP_PROVIDER && window.FFP_PROVIDER.id; }

  var info = { passport_no: '', business_name: '' };

  function injectStyles() {
    if (document.getElementById('ffp-venue-qr-css')) return;
    var s = document.createElement('style');
    s.id = 'ffp-venue-qr-css';
    s.textContent = [
      '#ffp-venue-qr{margin-bottom:22px;}',
      '#ffp-venue-qr .vq-card{background:var(--ffp-bg-2,#0f1e2e);border:1px solid rgba(43,168,224,0.18);border-radius:14px;padding:18px;text-align:center;}',
      '#ffp-venue-qr .vq-head{display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:800;color:var(--ffp-text,#e8eef4);margin-bottom:4px;}',
      '#ffp-venue-qr .vq-head .ms{color:var(--ffp-yellow,#FFCC00);}',
      '#ffp-venue-qr .vq-sub{font-size:12px;color:var(--ffp-text-muted,#8a99a8);margin-bottom:16px;line-height:1.5;}',
      '#ffp-venue-qr .vq-qrwrap{display:inline-block;background:#fff;padding:14px;border-radius:14px;}',
      '#ffp-venue-qr #venue-qr-box img,#ffp-venue-qr #venue-qr-box canvas{display:block;}',
      '#ffp-venue-qr .vq-name{font-size:15px;font-weight:800;color:var(--ffp-text,#e8eef4);margin-top:14px;}',
      '#ffp-venue-qr .vq-pp{font-size:12px;font-weight:700;letter-spacing:1px;color:var(--ffp-yellow,#FFCC00);margin-top:3px;}',
      '#ffp-venue-qr .vq-dl{margin-top:16px;}'
    ].join('');
    document.head.appendChild(s);
  }

  function venueUrl() { return MEMBER_APP + '?venue=' + encodeURIComponent(providerId()); }

  function loadQrLib(cb) {
    if (window.QRCode) return cb();
    var s = document.createElement('script');
    s.src = QR_LIB;
    s.onload = function () { cb(); };
    s.onerror = function () { cb(new Error('qr lib failed')); };
    document.head.appendChild(s);
  }

  function ensureContainer() {
    var panel = document.getElementById('panel-checkins');
    if (!panel) return null;
    var el = document.getElementById('ffp-venue-qr');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ffp-venue-qr';
      var anchor = panel.querySelector('.psub') || panel.querySelector('.checkin-card');
      if (anchor && anchor.nextSibling) anchor.parentNode.insertBefore(el, anchor.nextSibling);
      else if (anchor) anchor.parentNode.appendChild(el);
      else panel.appendChild(el);
    }
    return el;
  }

  function render() {
    var el = ensureContainer();
    if (!el) return;
    el.innerHTML =
      '<div class="vq-card">' +
        '<div class="vq-head"><span class="ms">qr_code_2</span> Your venue check-in QR</div>' +
        '<div class="vq-sub">Print this and display it at your counter. Members scan it to check in for quests.</div>' +
        '<div class="vq-qrwrap"><div id="venue-qr-box"></div></div>' +
        '<div class="vq-name">' + esc(info.business_name || 'Your venue') + '</div>' +
        (info.passport_no ? '<div class="vq-pp">FFP Passport No. ' + esc(info.passport_no) + '</div>' : '') +
        '<div class="vq-dl"><button class="btn btn-pri" onclick="FFPVenueQR.download()"><span class="ms">download</span> Download QR (PNG)</button></div>' +
      '</div>';
    loadQrLib(function (err) {
      var box = document.getElementById('venue-qr-box');
      if (!box) return;
      box.innerHTML = '';
      if (err || !window.QRCode) { box.textContent = 'QR unavailable'; return; }
      try {
        new window.QRCode(box, {
          text: venueUrl(), width: 200, height: 200,
          colorDark: '#0a0a0a', colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M
        });
      } catch (e) { box.textContent = 'QR unavailable'; }
    });
  }

  function download() {
    var box = document.getElementById('venue-qr-box');
    if (!box) return;
    var canvas = box.querySelector('canvas');
    var img = box.querySelector('img');
    var dataUrl = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
    if (!dataUrl) { if (typeof window.showToast === 'function') window.showToast('QR not ready yet', 'error'); return; }
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'FFP-Venue-QR-' + (info.passport_no || 'venue') + '.png';
    document.body.appendChild(a); a.click(); a.remove();
  }
  window.FFPVenueQR = { download: download };

  async function fetchInfo() {
    var pid = providerId();
    if (!pid) return;
    try {
      // providers has no passport_no column (that's a members field) — selecting it 400'd the query
      // and left the QR card blank. Select only business_name.
      var res = await window.supabase.from('providers').select('business_name').eq('id', pid).maybeSingle();
      if (res.data) { info.business_name = res.data.business_name || ''; }
    } catch (e) {}
  }

  async function init() {
    var ok = await waitFor(function () {
      return window.supabase && document.getElementById('panel-checkins') && providerId();
    }, 30000);
    if (!ok) { console.warn('[FFP Venue QR] deps not ready'); return; }
    injectStyles();
    await fetchInfo();
    render();
    console.log('[FFP Venue QR v1] Loaded ✓');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
