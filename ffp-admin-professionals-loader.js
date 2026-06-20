/* FFP Admin Professionals Loader — v1 (2026-06-10)
   The public-listing VERIFICATION QUEUE for the Professionals Portal. A professional who ticks
   "List me on Find Fit People" moves to verification_status='pending' (professional_save_profile);
   this panel lets an admin review the profile and Approve or Reject (with a note).
   Data: professional_verification_list() (is_admin-gated) → pending rows.
   Actions: professional_set_verification(p_pro, 'approved'|'rejected', note).
   Renders into #pro-verify-root inside #panel-professionals. */
(function () {
  'use strict';
  function sb() { return window.supabase; }
  function toast(m, t) { if (window.showToast) return window.showToast(m, t); if (window.toast) return window.toast(m, t); console.log('[Pros]', m); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  function injectCss() {
    if (document.getElementById('ffp-pros-css')) return;
    var s = document.createElement('style'); s.id = 'ffp-pros-css';
    s.textContent = [
      '#pro-verify-root .pv-empty{padding:30px;text-align:center;color:#8a99a8;font-size:13px;}',
      '#pro-verify-root .pv-card{display:flex;gap:14px;align-items:flex-start;border:1px solid rgba(43,168,224,.18);border-radius:14px;padding:14px 16px;margin-bottom:12px;background:#0f1e2e;}',
      '#pro-verify-root .pv-ph{width:54px;height:54px;border-radius:50%;flex:0 0 auto;background:#13283b center/cover no-repeat;display:flex;align-items:center;justify-content:center;font-weight:800;color:#7fa7c4;overflow:hidden;}',
      '#pro-verify-root .pv-name{font-size:15px;font-weight:800;color:#fff;}',
      '#pro-verify-root .pv-meta{font-size:12px;color:#9db4c7;margin-top:2px;}',
      '#pro-verify-root .pv-bio{font-size:12px;color:#c7d6e3;margin-top:8px;line-height:1.5;}',
      '#pro-verify-root .pv-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}',
      '#pro-verify-root .pv-chip{font-size:11px;font-weight:700;color:#cbd9e6;border:1px solid rgba(43,168,224,.25);border-radius:20px;padding:3px 9px;}',
      '#pro-verify-root .pv-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;}',
      '#pro-verify-root .pv-btn{border:none;border-radius:9px;padding:9px 16px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;}',
      '#pro-verify-root .pv-approve{background:#22c55e;color:#06210f;}',
      '#pro-verify-root .pv-reject{background:rgba(239,68,68,.14);color:#f07171;border:1px solid rgba(239,68,68,.4);}',
      '#pro-verify-root a.pv-link{color:#2ba8e0;font-size:12px;font-weight:700;text-decoration:none;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function initials(nm) { return (String(nm || '').split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2) || 'P').toUpperCase(); }

  function card(p) {
    var name = esc(p.display_name || ((p.given_names || '') + ' ' + (p.surname || '')).trim() || 'Professional');
    var types = (p.professional_types || []).map(function (t) { return '<span class="pv-chip">' + esc(t) + '</span>'; }).join('');
    var loc = [p.city, p.country].filter(Boolean).map(esc).join(', ');
    var ph = p.profile_photo_url
      ? '<div class="pv-ph" style="background-image:url(\'' + esc(p.profile_photo_url) + '\');"></div>'
      : '<div class="pv-ph">' + initials(name) + '</div>';
    return '<div class="pv-card" data-id="' + p.id + '">' + ph +
      '<div style="flex:1;min-width:0;">' +
        '<div class="pv-name">' + name + '</div>' +
        '<div class="pv-meta">' + (p.category ? esc(p.category) : '') + (loc ? ' · ' + loc : '') + (p.work_email ? ' · ' + esc(p.work_email) : '') + '</div>' +
        (p.headline ? '<div class="pv-meta" style="color:#cbd9e6;font-weight:600;margin-top:4px;">' + esc(p.headline) + '</div>' : '') +
        (types ? '<div class="pv-chips">' + types + '</div>' : '') +
        (p.bio ? '<div class="pv-bio">' + esc(p.bio) + '</div>' : '') +
        '<div class="pv-actions">' +
          '<button class="pv-btn pv-view" data-act="preview" style="background:#13283b;color:#cfe0ee;border:1px solid rgba(43,168,224,.3);">View full profile</button>' +
          '<button class="pv-btn pv-approve" data-act="approve">Approve &amp; publish</button>' +
          '<button class="pv-btn pv-reject" data-act="reject">Reject…</button>' +
        '</div>' +
      '</div></div>';
  }

  var _rows = [];

  // Full in-admin preview — renders exactly what publishes on Find Fit People (the public site only shows
  // approved pros, so we mirror the public profile here from the pending row + live services/intro videos).
  async function preview(id) {
    var p = _rows.find(function (x) { return x.id === id; }); if (!p) return;
    var name = esc(p.display_name || ((p.given_names || '') + ' ' + (p.surname || '')).trim() || 'Professional');
    var loc = [p.city, p.country].filter(Boolean).map(esc).join(', ');
    var types = (p.professional_types || []).map(function (t) { return '<span style="font-size:12px;font-weight:700;color:#0e5a73;background:#e3f0f7;border-radius:20px;padding:4px 11px;">' + esc(t) + '</span>'; }).join('');
    var langs = (p.languages || []).map(esc).join(', ');
    var services = [], videos = [];
    try { var rs = await sb().rpc('pro_list_services', { p_pro: id }); services = (rs && rs.data) || []; } catch (e) {}
    try { var rv = await sb().rpc('pro_videos_list', { p_pro: id }); videos = (rv && rv.data) || []; } catch (e) {}
    var cover = p.cover_photo_url
      ? '<div style="height:140px;background:#cdd7dd url(\'' + esc(p.cover_photo_url) + '\') center/cover;"></div>'
      : '<div style="height:96px;background:linear-gradient(135deg,#1980AD,#0e3e4a);"></div>';
    var photo = p.profile_photo_url
      ? '<div style="width:92px;height:92px;border-radius:50%;border:4px solid #fff;flex:0 0 auto;background:#cdd7dd url(\'' + esc(p.profile_photo_url) + '\') center/cover;margin-top:-50px;"></div>'
      : '<div style="width:92px;height:92px;border-radius:50%;border:4px solid #fff;flex:0 0 auto;background:#1980AD;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:30px;margin-top:-50px;">' + esc(name.charAt(0).toUpperCase()) + '</div>';
    var metaBits = [];
    if (p.category) metaBits.push(esc(p.category));
    if (loc) metaBits.push(loc);
    if (p.years_experience) metaBits.push(esc(String(p.years_experience)) + ' yrs experience');
    var svcHtml = services.length ? ('<div style="font-size:13px;font-weight:800;color:#0e2531;margin:18px 0 6px;">Services</div>' + services.map(function (s) {
      var price = (s.price_aed != null && s.price_aed !== '') ? ((p.currency || 'AED') + ' ' + s.price_aed) : '';
      return '<div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid #eef1f3;font-size:13px;color:#0e2531;"><span>' + esc(s.name || 'Service') + (s.duration_min ? ' · ' + s.duration_min + ' min' : '') + '</span><b>' + esc(price) + '</b></div>';
    }).join('')) : '';
    var vidHtml = videos.length ? ('<div style="font-size:13px;font-weight:800;color:#0e2531;margin:18px 0 6px;">Intro video' + (videos.length > 1 ? 's' : '') + '</div>' + videos.map(function (v) {
      return '<div style="font-size:13px;padding:6px 0;"><a href="' + esc(v.url || v.video_url || '#') + '" target="_blank" rel="noopener" style="color:#1980AD;font-weight:700;">▶ ' + esc(v.title || 'Watch intro video') + '</a></div>';
    }).join('')) : '';
    var inner = cover +
      '<div style="padding:0 22px 22px;">' +
        '<div style="display:flex;align-items:flex-end;gap:14px;">' + photo +
          '<div style="padding-bottom:6px;min-width:0;"><div style="font-size:20px;font-weight:900;color:#0e2531;">' + name + '</div>' +
          (p.headline ? '<div style="font-size:13px;color:#566069;font-weight:600;margin-top:2px;">' + esc(p.headline) + '</div>' : '') + '</div></div>' +
        (metaBits.length ? '<div style="font-size:12px;color:#8a96a1;font-weight:600;margin-top:10px;">' + metaBits.join(' · ') + '</div>' : '') +
        (types ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">' + types + '</div>' : '') +
        (p.bio ? '<div style="font-size:13px;color:#3a4a52;line-height:1.6;margin-top:14px;white-space:pre-wrap;">' + esc(p.bio) + '</div>' : '') +
        (p.certifications ? '<div style="font-size:12px;color:#566069;margin-top:12px;"><b>Certifications:</b> ' + esc(Array.isArray(p.certifications) ? p.certifications.join(', ') : p.certifications) + '</div>' : '') +
        (langs ? '<div style="font-size:12px;color:#566069;margin-top:6px;"><b>Languages:</b> ' + langs + '</div>' : '') +
        svcHtml + vidHtml +
        '<div style="font-size:12px;color:#8a96a1;margin-top:16px;border-top:1px solid #eef1f3;padding-top:12px;">Contact (admin only): ' + esc(p.work_email || '—') + (p.phone ? ' · ' + esc(p.phone) : '') + '</div>' +
      '</div>';
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(8,16,24,.62);z-index:100000;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto;';
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.innerHTML = '<div style="width:100%;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.5);font-family:-apple-system,system-ui,sans-serif;position:relative;">' +
      '<button title="Close" style="position:absolute;top:12px;right:12px;z-index:3;background:rgba(0,0,0,.45);color:#fff;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:15px;line-height:1;" onclick="var o=this.closest(\'div\').parentElement; if(o) o.remove();">✕</button>' +
      '<div style="background:#eaf0f2;padding:8px 16px;font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#566069;text-align:center;">Preview — exactly what publishes on Find Fit People</div>' +
      inner + '</div>';
    document.body.appendChild(ov);
  }

  async function load() {
    var host = document.getElementById('pro-verify-root'); if (!host) return;
    host.innerHTML = '<div class="pv-empty">Loading…</div>';
    var res;
    try { res = await sb().rpc('professional_verification_list'); } catch (e) { host.innerHTML = '<div class="pv-empty">Could not load.</div>'; return; }
    var data = res && res.data;
    if (data && data.error) { host.innerHTML = '<div class="pv-empty">' + esc(data.error === 'forbidden' ? 'Admin sign-in required.' : data.error) + '</div>'; return; }
    var rows = Array.isArray(data) ? data : [];
    _rows = rows;
    if (!rows.length) { host.innerHTML = '<div class="pv-empty">No professionals are waiting for review. 🎉</div>'; return; }
    host.innerHTML = '<p style="font-size:12px;color:#9db4c7;margin:0 0 14px;">' + rows.length + ' professional' + (rows.length === 1 ? '' : 's') + ' awaiting review. Approving makes the profile discoverable on Find Fit People.</p>' + rows.map(card).join('');
  }

  async function setStatus(id, status, note) {
    try {
      var r = await sb().rpc('professional_set_verification', { p_pro: id, p_status: status, p_note: note || null });
      if (r && r.data && r.data.error) { toast(r.data.error === 'forbidden' ? 'Admin sign-in required' : r.data.error, 'error'); return; }
      toast(status === 'approved' ? 'Approved — now live' : 'Rejected', 'success');
      load();
    } catch (e) { toast('Action failed', 'error'); }
  }

  function wire() {
    var host = document.getElementById('pro-verify-root'); if (!host || host._wired) return; host._wired = true;
    host.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.pv-btn'); if (!btn) return;
      var cardEl = btn.closest('.pv-card'); if (!cardEl) return;
      var id = cardEl.dataset.id, act = btn.dataset.act;
      if (act === 'preview') { preview(id); }
      else if (act === 'approve') { setStatus(id, 'approved'); }
      else if (act === 'reject') { var note = prompt('Reason for the professional (optional):', ''); if (note === null) return; setStatus(id, 'rejected', note); }
    });
  }

  function init() {
    if (!sb()) { setTimeout(init, 150); return; }
    injectCss(); wire(); load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
