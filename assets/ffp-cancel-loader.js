/* FFP Cancel Membership flow (window.FFPCancel) — v2 (2026-07-09)
   Self-serve cancellation: REASON → last-chance 14-DAY save offer → cancel AT PERIOD END (keeps access).
   Full-bleed overlay (NO modal box), Apple/WHOOP standard: hairlines + type, NO pills, NO scrollbars.
   Backend: POST /api/billing/extend {member_id} · POST /api/billing/cancel {member_id, reason, feedback}. */
(function () {
  'use strict';
  var W = window, BACKEND = 'https://ffp-passport-backend.vercel.app';
  function memberId() { try { if (W.FFPAuth && FFPAuth.getMember) { var m = FFPAuth.getMember(); if (m && m.id) return m.id; } } catch (e) {} try { return (JSON.parse(localStorage.getItem('ffp_member') || '{}')).id || ''; } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function fmt(iso) { if (!iso) return null; try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return null; } }
  var S = (W._ffpCancel = W._ffpCancel || {});

  function styles() {
    if (document.getElementById('ffp-cx-css')) return;
    var st = document.createElement('style'); st.id = 'ffp-cx-css';
    st.textContent =
      '#ffp-cx-ov{position:fixed;inset:0;z-index:6200;background:#0a1825;display:none;flex-direction:column;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;}' +
      '#ffp-cx-ov.on{display:flex;}#ffp-cx-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}' +
      '#ffp-cx-body::-webkit-scrollbar{display:none;width:0;height:0;}' +
      '.cx-wrap{max-width:560px;margin:0 auto;width:100%;box-sizing:border-box;padding:0 22px 28px;}' +
      '.cx-btn{width:100%;box-sizing:border-box;border:none;border-radius:13px;padding:15px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;margin-top:12px;}' +
      '.cx-pri{background:#FFCC00;color:#3a2e00;}.cx-ghost{background:transparent;border:1px solid #294257;color:#a9c2d4;}' +
      '.cx-reason{display:flex;align-items:center;gap:12px;padding:15px 2px;border-bottom:1px solid rgba(255,255,255,.08);cursor:pointer;font-size:14.5px;color:#eaf2f8;}' +
      '.cx-reason .rk{width:20px;height:20px;border-radius:50%;border:2px solid #3a5064;flex:0 0 auto;}' +
      '.cx-reason.on .rk{border-color:#FFCC00;background:#FFCC00;box-shadow:inset 0 0 0 4px #0a1825;}' +
      '.cx-ta{width:100%;box-sizing:border-box;margin-top:14px;background:#0f2334;border:1px solid #1c3c58;border-radius:12px;color:#eaf2f8;font-size:14px;font-family:inherit;padding:12px;resize:vertical;}';
    document.head.appendChild(st);
  }
  function ensure() {
    var ov = document.getElementById('ffp-cx-ov');
    if (!ov) { ov = document.createElement('div'); ov.id = 'ffp-cx-ov'; ov.innerHTML = '<div id="ffp-cx-body"></div>'; document.body.appendChild(ov); }
    return ov;
  }
  function head(title, sub) {
    return '<div style="padding:20px 0 8px;display:flex;justify-content:space-between;align-items:flex-start;"><div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#7fa0b8;font-weight:600;">Membership</div>' +
      '<span onclick="FFPCancel.close()" style="cursor:pointer;color:#9fc0d4;font-size:24px;line-height:1;">&times;</span></div>' +
      '<div style="font-size:26px;font-weight:600;color:#f2f7fb;letter-spacing:-.4px;line-height:1.1;">' + esc(title) + '</div>' +
      (sub ? '<div style="font-size:14px;color:#a9c2d4;margin-top:10px;line-height:1.5;">' + esc(sub) + '</div>' : '');
  }
  function paint(html) { var b = document.getElementById('ffp-cx-body'); if (b) { b.innerHTML = '<div class="cx-wrap">' + html + '</div>'; b.scrollTop = 0; } }

  W.FFPCancel = {
    open: function () { styles(); ensure().classList.add('on'); S.reason = null; S.note = ''; renderReason(); },
    close: function () { var ov = document.getElementById('ffp-cx-ov'); if (ov) ov.classList.remove('on'); },
    keep14: async function () { await doExtend(); },
    toOffer: function () { var ta = document.getElementById('cx-note'); S.note = ta ? ta.value : ''; renderOffer(); },
    pick: function (r) { S.reason = r; renderReason(); },
    doCancel: async function () { await doCancel(); }
  };

  // Step 1 — reason (why are you leaving). Continue → last-chance offer.
  var REASONS = ['Too expensive', 'Not using it enough', 'Missing something I need', 'Just taking a break', 'Something else'];
  function renderReason() {
    var rows = REASONS.map(function (r) {
      return '<div class="cx-reason' + (S.reason === r ? ' on' : '') + '" onclick="FFPCancel.pick(\'' + esc(r).replace(/'/g, '') + '\')"><span class="rk"></span><span>' + esc(r) + '</span></div>';
    }).join('');
    paint(head('Sorry to see you go', 'Before you cancel — what made you decide to leave? It genuinely helps us improve.') +
      '<div style="margin-top:20px;">' + rows + '</div>' +
      '<textarea class="cx-ta" id="cx-note" rows="3" placeholder="Anything else you\'d tell us? (optional)">' + esc(S.note || '') + '</textarea>' +
      '<button class="cx-btn cx-pri" style="margin-top:22px;" onclick="FFPCancel.toOffer()">Continue</button>' +
      '<button class="cx-btn cx-ghost" onclick="FFPCancel.close()">Never mind, keep my membership</button>');
  }

  // Step 2 — last-chance save offer (14 more days). Decline → cancel at period end.
  function renderOffer() {
    paint(head('Wait — 14 more days, on us?', 'We know life gets busy. Take another two weeks free before anything is charged — nothing to do, your Passport just keeps working.') +
      '<div style="margin-top:26px;">' +
        '<button class="cx-btn cx-pri" onclick="FFPCancel.keep14()">Keep my 14 free days</button>' +
        '<button class="cx-btn cx-ghost" onclick="FFPCancel.doCancel()">No thanks, cancel my membership</button>' +
      '</div>');
  }

  function busy(msg) { paint('<div style="padding:60px 0;text-align:center;color:#9fc0d4;font-weight:600;">' + esc(msg) + '</div>'); }

  async function doExtend() {
    var me = memberId(); if (!me) { renderError(); return; }
    busy('Adding your 14 days…');
    try {
      var r = await fetch(BACKEND + '/api/billing/extend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_id: me }) });
      var j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'failed');
      paint(head('You\'re all set', 'We\'ve added 14 more days — free. ' + (fmt(j.until) ? 'Your next charge is now ' + fmt(j.until) + '.' : '')) +
        '<button class="cx-btn cx-pri" style="margin-top:26px;" onclick="FFPCancel.close()">Back to my Passport</button>');
    } catch (e) { renderError('We couldn\'t add the days just now.'); }
  }

  async function doCancel() {
    var me = memberId(); if (!me) { renderError(); return; }
    busy('Cancelling your membership…');
    try {
      var r = await fetch(BACKEND + '/api/billing/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_id: me, reason: S.reason || null, feedback: S.note || null }) });
      var j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'failed');
      var when = fmt(j.access_until);
      paint(head('Your membership is cancelled', 'You won\'t be charged again.' + (when ? ' You\'ll keep full access until ' + when + ', then your Passport moves to the free tier.' : '')) +
        '<div style="font-size:13px;color:#7fa0b8;margin-top:14px;line-height:1.6;">Your activity, connections and history stay on your account — come back anytime and pick up where you left off.</div>' +
        '<button class="cx-btn cx-pri" style="margin-top:24px;" onclick="FFPCancel.close()">Done</button>');
    } catch (e) { renderError('We couldn\'t cancel just now.'); }
  }

  function renderError(msg) {
    paint(head('Something went wrong', (msg || 'Please try again.') + ' If it keeps happening, email support@findfitpeople.com and we\'ll sort it out.') +
      '<button class="cx-btn cx-ghost" style="margin-top:24px;" onclick="FFPCancel.close()">Close</button>');
  }
})();
