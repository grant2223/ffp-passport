/* FFP ACTIVITY-CARD LOADER (ffp-activity-card-loader.js) — extracted from ffp-member-dashboard.html (2026-07-18, TOP-PRIORITY shrink).
   The PNG share-card engine + share sheet: build the <canvas> card, preview, options checklist, share/download,
   referral copy. Lazy-loaded the first time a member taps "Share card". Internal helpers stay private in this
   IIFE; the window.* entry points below replace the shell's lazy stubs on load. Cache-bust via this file's own
   ?v= on the <script> tag in the shell.
   Shell must expose (all optional/guarded except _ppRefLink which is guarded here):
     window.showToast, window.escHtml, window._ppRefLink, window._ffpActCard, window.ffpHrZones,
     window.ffpLogSocialShare, window.FFPAuth.
   Exposes for the shell activity-detail renderer: window._ffpLocLine. */
(function () {
function _ffpCardDims(r) { var w = 540; return { w: w, h: r === '1:1' ? w : r === '4:5' ? Math.round(w * 5 / 4) : Math.round(w * 16 / 9) }; }
function _ffpDurStr(a) { var min = Math.max(0, Math.round(a.duration_min || 0)); var h = Math.floor(min / 60), m = min % 60; return (h ? h + 'h ' : '') + m + 'm' + (a.duration_sec ? (' ' + a.duration_sec + 's') : ''); }
// Ordered catalog of shareable fields for one activity. Each: {key,label,val,unit,avail,kind}.
// kind: 'sub' = date/location line · 'stat' = grid cell · 'zones' = HR-zone bar.
// Values/format REUSE the activity-detail ribbon logic (pace, steps k, metrics.max_hr/strain/hr_zones_ms).
// Location line "Place, Area, CODE" is owned by the SHELL (window._ffpLocLine) so the non-lazy activity-detail
// card and this share card read identically — single source (RULE 5). Fallback keeps the card working if the
// shell helper somehow isn't present.
function _ffpShareFields(a) {
  a = a || {};
  var m = a.metrics || {};
  var hasDist = (a.distance_km != null && a.distance_km > 0);
  var tm = (a.duration_min || 0) + (a.duration_sec || 0) / 60;   // minutes (float)
  var hasTime = tm > 0;
  var pace = '';
  if (hasDist && hasTime) { var pm = tm / a.distance_km, pmi = Math.floor(pm), ps = Math.round((pm - pmi) * 60); if (ps === 60) { pmi++; ps = 0; } pace = pmi + ':' + ('0' + ps).slice(-2); }
  var spd = (hasDist && hasTime) ? (Math.round(a.distance_km / (tm / 60) * 10) / 10) : null;   // km/h
  var dateStr = a.logged_at ? new Date(a.logged_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  var locStr = (window._ffpLocLine ? window._ffpLocLine(a) : '');   // Place, Area, CODE (shell single-source)
  var scoreStr = (a.score != null && String(a.score).trim() !== '') ? String(a.score).trim() : '';
  var stepStr = a.steps ? (Number(a.steps) >= 1000 ? (Math.round(a.steps / 100) / 10) + 'k' : String(a.steps)) : '';
  var z = m.hr_zones_ms || null;
  var zt = z ? ((z.zone_zero_milli || 0) + (z.zone_one_milli || 0) + (z.zone_two_milli || 0) + (z.zone_three_milli || 0) + (z.zone_four_milli || 0) + (z.zone_five_milli || 0)) : 0;
  return [
    { key: 'date', label: 'Date', kind: 'sub', avail: !!dateStr, val: dateStr },
    { key: 'location', label: 'Location', kind: 'sub', avail: !!locStr, val: locStr },
    { key: 'score', label: 'Score', kind: 'stat', avail: !!scoreStr, val: scoreStr },
    { key: 'time', label: 'Time', kind: 'stat', avail: hasTime, val: _ffpDurStr(a) },
    { key: 'pace', label: 'Pace', unit: '/km', kind: 'stat', avail: !!pace, val: pace },
    { key: 'speed', label: 'Speed', unit: 'km/h', kind: 'stat', avail: spd != null, val: (spd != null ? String(spd) : '') },
    { key: 'avghr', label: 'Avg HR', unit: 'bpm', kind: 'stat', avail: !!a.avg_heart_rate, val: String(a.avg_heart_rate || '') },
    { key: 'maxhr', label: 'Max HR', unit: 'bpm', kind: 'stat', avail: !!m.max_hr, val: String(m.max_hr || '') },
    { key: 'calories', label: 'Calories', unit: 'kcal', kind: 'stat', avail: !!a.calories, val: String(a.calories || '') },
    { key: 'steps', label: 'Steps', kind: 'stat', avail: !!a.steps, val: stepStr },
    { key: 'strain', label: 'Strain', kind: 'stat', avail: m.strain != null, val: (m.strain != null ? String(m.strain) : '') },
    // HR zones are ALWAYS offerable when there's ANY heart-rate signal (Grant 2026-07-18): time-in-zone data
    // OR just an average HR (then we draw the zone bands + where the avg HR sits). Was gated on zt>0 only.
    { key: 'hrzones', label: 'HR zones', kind: 'zones', avail: (zt > 0 || !!a.avg_heart_rate), val: '' }
  ];
}
function _ffpRoundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
// Headline candidates for the share card — the member picks which becomes the big number. The activity NAME is
// automatic (always the small title above), so it's NOT listed here. Distance is the natural default; only logged metrics appear.
function _ffpHeadlineList(a) {
  a = a || {};
  var flds = _ffpShareFields(a), F = {}; flds.forEach(function (f) { F[f.key] = f; });
  var out = [];
  if (a.distance_km != null && a.distance_km > 0) out.push({ key: 'distance', label: 'Distance', val: String(Math.round(a.distance_km * 100) / 100), unit: ' km' });
  if (F.time && F.time.avail) out.push({ key: 'time', label: 'Duration', val: F.time.val, unit: '' });
  ['calories', 'pace', 'speed', 'avghr', 'maxhr', 'steps', 'strain'].forEach(function (k) { var f = F[k]; if (f && f.avail) out.push({ key: k, label: f.label, val: f.val, unit: f.unit ? (' ' + f.unit) : '' }); });
  return out;
}
// HR-zone stacked bar on the card — same zone keys/colours as the activity-detail view (Rule 5). Height ~ W*0.12.
// Self-contained rgba (the shell's _rgba is not in this module's scope).
function _ffpZoneRgba(hex, al) { try { var h = String(hex).replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; var n = parseInt(h, 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + al + ')'; } catch (e) { return hex; } }
function _ffpDrawZones(ctx, a, pad, y, W, U, fam) {
  U = U || W;
  var COL = ['#3aa0e6', '#16a34a', '#eab308', '#d9531e', '#dc2626'];
  var z = (a.metrics && a.metrics.hr_zones_ms) || null;
  var zs = z ? [['Z1', z.zone_one_milli || 0, COL[0]], ['Z2', z.zone_two_milli || 0, COL[1]], ['Z3', z.zone_three_milli || 0, COL[2]], ['Z4', z.zone_four_milli || 0, COL[3]], ['Z5', z.zone_five_milli || 0, COL[4]]] : null;
  if (zs && z.zone_zero_milli) zs.unshift(['Z0', z.zone_zero_milli, '#6b7a88']);
  var tot = zs ? zs.reduce(function (s, q) { return s + (q[1] || 0); }, 0) : 0;
  ctx.textAlign = 'left'; ctx.fillStyle = '#9fc4e0'; ctx.font = '800 ' + Math.round(U * 0.021) + 'px ' + fam;
  ctx.fillText('HEART-RATE ZONES', pad, y + U * 0.018);
  var barY = y + U * 0.034, barH = U * 0.058, bx = pad, bw = W - 2 * pad, r = barH / 2;

  if (zs && tot > 0) {
    // Time-in-zone (WHOOP / entered minutes): proportional stacked bar + % inside each segment.
    ctx.save(); _ffpRoundRect(ctx, bx, barY, bw, barH, r); ctx.clip();
    var cx = bx; zs.forEach(function (q) { var w = bw * (q[1] / tot); if (w > 0) { ctx.fillStyle = q[2]; ctx.fillRect(cx, barY, w + 0.6, barH); cx += w; } });
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = Math.max(1, U * 0.005);
    var stp = Math.max(6, U * 0.018);
    for (var sx = bx - barH; sx < bx + bw; sx += stp * 2) { ctx.beginPath(); ctx.moveTo(sx, barY + barH); ctx.lineTo(sx + barH, barY); ctx.stroke(); }
    ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 ' + Math.round(U * 0.021) + 'px ' + fam;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = Math.round(U * 0.006);
    var lx = bx;
    zs.forEach(function (q) { var w = bw * (q[1] / tot); if (w > W * 0.045) { ctx.fillStyle = '#fff'; ctx.fillText(Math.round(q[1] / tot * 100) + '%', lx + w / 2, barY + barH / 2 + 0.5); } lx += w; });
    ctx.restore(); ctx.textBaseline = 'alphabetic';
    return;
  }

  // Fallback (Grant 2026-07-18): no time-in-zone data → show the 5 zone BANDS and highlight where the
  // member's AVERAGE HR sat, so an HR-zone graphic is ALWAYS available with any heart-rate signal.
  var avg = a.avg_heart_rate ? Math.round(a.avg_heart_rate) : 0;
  if (!avg) return;
  var zr = (window.ffpHrZones ? window.ffpHrZones() : null);
  var inZone = 3;
  if (zr && zr.length) {
    inZone = 0;
    for (var i = 0; i < zr.length; i++) { if (avg >= zr[i].lo && (i === zr.length - 1 || avg <= zr[i].hi)) { inZone = i + 1; break; } }
    if (!inZone) inZone = (avg < zr[0].lo) ? 1 : zr.length;
  }
  ctx.save(); _ffpRoundRect(ctx, bx, barY, bw, barH, r); ctx.clip();
  var segW = bw / 5;
  for (var s = 0; s < 5; s++) { ctx.fillStyle = (s + 1 === inZone) ? COL[s] : _ffpZoneRgba(COL[s], 0.30); ctx.fillRect(bx + s * segW, barY, segW + 0.6, barH); }
  ctx.restore();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 ' + Math.round(U * 0.02) + 'px ' + fam;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = Math.round(U * 0.006);
  for (var s2 = 0; s2 < 5; s2++) { ctx.fillStyle = (s2 + 1 === inZone) ? '#fff' : 'rgba(255,255,255,0.55)'; ctx.fillText('Z' + (s2 + 1), bx + segW * (s2 + 0.5), barY + barH / 2 + 0.5); }
  ctx.restore(); ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left'; ctx.fillStyle = '#9fc4e0'; ctx.font = '700 ' + Math.round(U * 0.02) + 'px ' + fam;
  ctx.fillText('Avg HR ' + avg + ' bpm · Zone ' + inZone, pad, barY + barH + U * 0.032);
}
// Preload remote images to DATA URLs so html2canvas never has a cross-origin image to hang/taint on.
var _ffpLogoUrl = 'https://kxzyuofecmtymablnmak.supabase.co/storage/v1/object/public/site-images/ffp-logo-white.png';
var _ffpLogoData = null;            // null = not tried, '' = failed (use text fallback), else dataURL
var _ffpPhotoData = '', _ffpPhotoSrc = null;
function _ffpImgToDataUrl(url) {
  return new Promise(function (res) {
    var done = false, to = null; function fin(v) { if (!done) { done = true; if (to) clearTimeout(to); res(v); } }
    if (!url) { fin(''); return; }
    to = setTimeout(function () { fin(''); }, 8000);
    // Build 531: fetch → blob → dataURL FIRST. The old path (crossOrigin Image → canvas → toDataURL) silently
    // failed for activity photos: the card draws the SAME photo as a plain background beforehand, caching it
    // WITHOUT CORS headers; the later crossOrigin request is served that cached non-CORS copy → the canvas is
    // TAINTED → toDataURL throws → the "Use my photo" background dropped to the gradient. A blob dataURL never
    // taints. `cache:'reload'` forces a fresh CORS response (bypassing the poisoned cache). Image path kept as fallback.
    try {
      fetch(url, { mode: 'cors', cache: 'reload' }).then(function (r) {
        if (!r || !r.ok) throw new Error('http'); return r.blob();
      }).then(function (b) {
        var fr = new FileReader();
        fr.onload = function () { fin(fr.result || ''); };
        fr.onerror = function () { throw new Error('read'); };
        fr.readAsDataURL(b);
      }).catch(function () {
        try { var img = new Image(); img.crossOrigin = 'anonymous';
          img.onload = function () { try { var c = document.createElement('canvas'); c.width = img.naturalWidth || 600; c.height = img.naturalHeight || 600; c.getContext('2d').drawImage(img, 0, 0); fin(c.toDataURL('image/png')); } catch (e) { fin(''); } };
          img.onerror = function () { fin(''); };
          img.src = url + (url.indexOf('?') > -1 ? '&' : '?') + '_ffpc=1';   // unique-ish param → skip the poisoned cache entry
        } catch (e) { fin(''); }
      });
    } catch (e) { fin(''); }
  });
}
async function _ffpEnsureLogo() { if (_ffpLogoData === null) { _ffpLogoData = await _ffpImgToDataUrl(_ffpLogoUrl); } return _ffpLogoData; }
async function _ffpEnsurePhoto(src) { if (!src) return ''; if (_ffpPhotoSrc !== src) { _ffpPhotoSrc = src; _ffpPhotoData = await _ffpImgToDataUrl(src); } return _ffpPhotoData || ''; }
// Load a data-URL into an Image (cached). data: URLs never taint the canvas → toDataURL always works.
var _ffpImgCache = {};
function _ffpLoadImg(dataUrl) { return new Promise(function (res) { if (!dataUrl) { res(null); return; } if (_ffpImgCache[dataUrl]) { res(_ffpImgCache[dataUrl]); return; } var im = new Image(); im.onload = function () { _ffpImgCache[dataUrl] = im; res(im); }; im.onerror = function () { res(null); }; im.src = dataUrl; }); }
// Draw the share card DIRECTLY to a <canvas> with the 2D API — no html2canvas (which hangs in the iOS webapp). Returns the canvas.
// sticker=true → TRANSPARENT overlay (see-through corners + frosted panel) so it can be saved and dropped over any photo.
async function _ffpMakeCardCanvas(a, ratio, usePhoto, sticker) {
  var d = _ffpCardDims(ratio), W = d.w, H = d.h, S = 2, pad = Math.round(W * 0.075);
  var fam = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  var cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
  var ctx = cv.getContext('2d'); ctx.scale(S, S);
  var logo = null, photo = null;
  try { await _ffpEnsureLogo(); if (_ffpLogoData) logo = await _ffpLoadImg(_ffpLogoData); } catch (e) {}
  var _bgSrc = a.photo_url || (a.photos && a.photos.length ? a.photos[0] : '');   // primary photo may live in photos[]
  if (usePhoto && _bgSrc && !sticker) { try { await _ffpEnsurePhoto(_bgSrc); if (_ffpPhotoData) photo = await _ffpLoadImg(_ffpPhotoData); } catch (e) {} }
  if (sticker) {
    // TRULY TRANSPARENT — NO panel/background at all (see-through everywhere). A strong dark halo-shadow on every
    // element drawn below is the EDGE that keeps the white type legible on ANY photo, light or dark.
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = Math.round(W * 0.026); ctx.shadowOffsetX = 0; ctx.shadowOffsetY = Math.round(W * 0.006);
  } else if (photo && photo.width) {
    var ir = photo.width / photo.height, cr = W / H, dw, dh; if (ir > cr) { dh = H; dw = H * ir; } else { dw = W; dh = W / ir; }
    ctx.drawImage(photo, (W - dw) / 2, (H - dh) / 2, dw, dh);
    var sg = ctx.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, 'rgba(5,12,20,0.35)'); sg.addColorStop(0.5, 'rgba(5,12,20,0.5)'); sg.addColorStop(1, 'rgba(5,12,20,0.85)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  } else {
    var bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#11436c'); bg.addColorStop(0.52, '#0a2740'); bg.addColorStop(1, '#06121f'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  }
  ctx.textAlign = 'center';
  var loH;
  if (logo && logo.width) { var lw = Math.round(W * 0.30), lh = Math.round(lw * (logo.height / logo.width)); ctx.drawImage(logo, (W - lw) / 2, pad, lw, lh); loH = lh; }
  else { ctx.fillStyle = '#fff'; ctx.font = '900 italic ' + Math.round(W * 0.07) + 'px ' + fam; ctx.fillText('FFP', W / 2, pad + Math.round(W * 0.075)); loH = Math.round(W * 0.09); }
  // Slogan under the logo
  ctx.textAlign = 'center'; ctx.fillStyle = '#bcd5e8'; ctx.font = '700 ' + Math.round(W * 0.028) + 'px ' + fam;
  ctx.fillText('Active Lifestyle Community', W / 2, pad + loH + Math.round(W * 0.048));
  loH += Math.round(W * 0.066);
  // Which fields to render — driven by the Options checklist (_ffpShareCfg.show). No cfg → all-available.
  var show = _ffpShareCfg.show || null;
  var on = function (k) { return !show || !!show[k]; };
  var flds = _ffpShareFields(a), F = {}; flds.forEach(function (f) { F[f.key] = f; });
  var hasDist = (a.distance_km != null && a.distance_km > 0);
  // Headline = the member's chosen metric (Options → Headline). Falls back to distance, then time.
  var _hl = _ffpHeadlineList(a);
  var _hlSel = _hl.filter(function (h) { return h.key === _ffpShareCfg.headline; })[0] || _hl[0] || { key: (hasDist ? 'distance' : 'time'), val: (hasDist ? String(Math.round(a.distance_km * 100) / 100) : _ffpDurStr(a)), unit: (hasDist ? ' km' : '') };
  var heroKey = _hlSel.key;
  var cells = flds.filter(function (f) { return f.kind === 'stat' && f.avail && on(f.key) && f.key !== heroKey; });
  var showZones = !!(F.hrzones && F.hrzones.avail && on('hrzones'));
  var subParts = [];
  if (F.date && F.date.avail && on('date')) subParts.push(F.date.val);
  if (F.location && F.location.avail && on('location')) subParts.push(F.location.val);
  var subStr = subParts.join('   ·   ');
  // Block heights → flow the stack (any count of fields) and centre it between the logo and the footer.
  var G = W * 0.030;
  var ncol = Math.min(3, Math.max(1, cells.length));
  var statRows = cells.length ? Math.ceil(cells.length / ncol) : 0;
  var rowH = W * 0.098;
  var hMap = { title: W * 0.075, hero: W * 0.175, sub: subStr ? W * 0.042 : 0, zones: showZones ? W * 0.11 : 0, stats: statRows ? (statRows * rowH + W * 0.028) : 0 };
  var order = ['title', 'hero']; if (hMap.sub) order.push('sub'); if (hMap.zones) order.push('zones'); if (hMap.stats) order.push('stats');
  var top = pad + loH + W * 0.05, footTop = H - W * 0.085, region = footTop - top;
  var rawH = order.reduce(function (s, k) { return s + hMap[k]; }, 0) + G * (order.length - 1);
  var q = Math.min(1, region / rawH);   // squeeze to fit when many fields are ticked (never overflow the footer)
  var U = W * q;                        // scaled unit for every font + inner offset; horizontal positions stay on W
  G *= q; rowH *= q; order.forEach(function (k) { hMap[k] *= q; });
  var totalH = rawH * q;
  var y = top + Math.max(0, (region - totalH) / 2);
  order.forEach(function (blk) {
    if (blk === 'title') {
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '900 ' + Math.round(U * 0.068) + 'px ' + fam;
      ctx.fillText(a.activity || 'Activity', W / 2, y + U * 0.055);
    } else if (blk === 'hero') {
      var heroVal = _hlSel.val, heroUnit = _hlSel.unit || '';
      var hs = Math.round(U * 0.155), us = Math.round(U * 0.048), baseY = y + U * 0.14;
      ctx.textAlign = 'left';
      ctx.font = '900 ' + hs + 'px ' + fam; var hwid = ctx.measureText(heroVal).width;
      ctx.font = '800 ' + us + 'px ' + fam; var uwid = heroUnit ? ctx.measureText(heroUnit).width : 0;
      var startX = W / 2 - (hwid + uwid) / 2;
      ctx.font = '900 ' + hs + 'px ' + fam; ctx.fillStyle = '#fff'; ctx.fillText(heroVal, startX, baseY);
      if (heroUnit) { ctx.font = '800 ' + us + 'px ' + fam; ctx.fillStyle = '#FFCC00'; ctx.fillText(heroUnit, startX + hwid, baseY); }
      ctx.textAlign = 'center';
    } else if (blk === 'sub') {
      ctx.textAlign = 'center'; ctx.fillStyle = '#bcd5e8'; ctx.font = '700 ' + Math.round(U * 0.028) + 'px ' + fam;
      ctx.fillText(subStr, W / 2, y + U * 0.03);
    } else if (blk === 'zones') {
      _ffpDrawZones(ctx, a, pad, y, W, U, fam);
    } else if (blk === 'stats') {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
      var gy = y + U * 0.028, colW = (W - 2 * pad) / ncol;
      cells.forEach(function (c, i) {
        var col = i % ncol, rw = Math.floor(i / ncol), cx = pad + colW * (col + 0.5), ry = gy + rw * rowH + U * 0.045;
        ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '900 ' + Math.round(U * 0.05) + 'px ' + fam;
        ctx.fillText(c.val, cx, ry);
        ctx.fillStyle = '#9fc4e0'; ctx.font = '700 ' + Math.round(U * 0.021) + 'px ' + fam;
        ctx.fillText((c.label + (c.unit ? ' ' + c.unit : '')).toUpperCase(), cx, ry + U * 0.032);
      });
    }
    y += hMap[blk] + G;
  });
  ctx.textAlign = 'center'; ctx.fillStyle = '#9ec0db'; ctx.font = '800 ' + Math.round(W * 0.021) + 'px ' + fam; ctx.fillText('TRACKED ON FFP PASSPORT', W / 2, H - Math.round(W * 0.04));
  ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;   // clear any sticker legibility shadow
  cv.style.width = W + 'px'; cv.style.height = H + 'px';   // backing store is 2×; display at design size
  return cv;
}
var _ffpShareCfg = { ratio: '1:1', usePhoto: false, id: null, headline: null };
var _ffpShareFile = null, _ffpShareKey = null, _ffpShareRendering = false, _ffpShareErr = '';
function _ffpCurKey() { var s = _ffpShareCfg.show ? Object.keys(_ffpShareCfg.show).filter(function (k) { return _ffpShareCfg.show[k]; }).sort().join(',') : ''; return (_ffpShareCfg.id || '') + '|' + _ffpShareCfg.ratio + '|' + (_ffpShareCfg.usePhoto ? 1 : 0) + '|' + (_ffpShareCfg.sticker ? 1 : 0) + '|' + (_ffpShareCfg.headline || '') + '|' + s; }
// Default the Options checklist to every field the activity actually has (Grant: "tick anything you logged — it all goes on").
function _ffpDefaultShow(a) { var s = {}; _ffpShareFields(a).forEach(function (f) { s[f.key] = !!f.avail; }); return s; }
// Toggle a field on the share card from the Options checklist, then re-render the preview.
window.ffpShareToggleField = function (key, el) {
  if (!_ffpShareCfg.show) _ffpShareCfg.show = {};
  var nv = !_ffpShareCfg.show[key]; _ffpShareCfg.show[key] = nv;
  var cb = el && el.querySelector('.ffp-sc-cb');
  if (cb) { cb.style.background = nv ? '#2ba8e0' : 'transparent'; cb.style.border = nv ? 'none' : '2px solid #3a4654'; cb.textContent = nv ? '✓' : ''; }
  _ffpRenderSharePreview();
};
// Show/hide the Options checklist panel.
window.ffpShareToggleOptions = function (btn) {
  var p = document.getElementById('ffp-sc-opts'); if (!p) return;
  var openNow = (p.style.display === 'none' || !p.style.display);
  p.style.display = openNow ? 'block' : 'none';
  if (btn) btn.style.background = openNow ? 'rgba(43,168,224,0.12)' : '#111a26';
  if (openNow) { try { p.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {} }
};
function _ffpDataUrlToFile(dataUrl, name) {
  var parts = dataUrl.split(','); var bin = atob(parts[1]); var len = bin.length; var arr = new Uint8Array(len);
  for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  var blob = new Blob([arr], { type: 'image/png' });
  try { return new File([blob], name, { type: 'image/png' }); } catch (e) { try { blob.name = name; } catch (e2) {} return blob; }
}
async function _ffpCaptureShareCard() {
  _ffpShareErr = '';
  try {
    var a = window._ffpActCard || {};
    var cv = await _ffpMakeCardCanvas(a, _ffpShareCfg.ratio, _ffpShareCfg.usePhoto, _ffpShareCfg.sticker);
    var dataUrl = cv.toDataURL('image/png');
    if (!dataUrl || dataUrl.length < 100) { _ffpShareErr = 'empty canvas'; return null; }
    var nm = (a.activity || 'activity').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'activity';
    return _ffpDataUrlToFile(dataUrl, 'ffp-' + nm + (_ffpShareCfg.sticker ? '-sticker' : '') + '.png');
  } catch (e) { _ffpShareErr = (e && (e.message || e.name)) || ('' + e); return null; }
}
async function _ffpRenderSharePreview() {
  var host = document.getElementById('ffp-sc-preview'); if (!host) return;
  var a = window._ffpActCard || {}; var d = _ffpCardDims(_ffpShareCfg.ratio);
  ['1:1', '4:5', '9:16'].forEach(function (r) { var t = document.getElementById('ffp-sc-tab-' + r.replace(':', '-')); if (t) { var on = (r === _ffpShareCfg.ratio); t.style.background = on ? '#2ba8e0' : 'transparent'; t.style.color = on ? '#fff' : '#8a99a8'; } });
  var maxH = Math.min((window.innerHeight || 700) * 0.5, 540), maxW = host.clientWidth || 300;
  var scale = Math.min(maxW / d.w, maxH / d.h); if (!(scale > 0)) scale = 0.5;
  host.style.height = Math.round(d.h * scale) + 'px';
  host.style.background = _ffpShareCfg.sticker ? 'repeating-conic-gradient(#2a3642 0% 25%, #1c2630 0% 50%) 50% / 20px 20px' : '';
  host.style.borderRadius = '10px';
  var cv = await _ffpMakeCardCanvas(a, _ffpShareCfg.ratio, _ffpShareCfg.usePhoto, _ffpShareCfg.sticker);
  cv.style.position = 'absolute'; cv.style.left = '50%'; cv.style.top = '0'; cv.style.transformOrigin = 'top center'; cv.style.transform = 'translateX(-50%) scale(' + scale + ')';
  host.innerHTML = ''; host.appendChild(cv);
  // The preview canvas IS the export — cache the file now so Share/Download fire instantly (within the iOS tap).
  _ffpShareFile = null; _ffpShareKey = null;
  try { var nm = (a.activity || 'activity').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'activity'; _ffpShareFile = _ffpDataUrlToFile(cv.toDataURL('image/png'), 'ffp-' + nm + (_ffpShareCfg.sticker ? '-sticker' : '') + '.png'); _ffpShareKey = _ffpCurKey(); } catch (e) { _ffpShareErr = (e && (e.message || e.name)) || ('' + e); }
}
window.ffpShareSetRatio = function (r) { _ffpShareCfg.ratio = r; _ffpRenderSharePreview(); };
// Headline picker (Options → Headline, horizontal scroll) — set which metric is the big number, then re-render.
window.ffpShareSetHeadline = function (k) {
  _ffpShareCfg.headline = k;
  try {
    var row = document.getElementById('ffp-sc-headline');
    if (row) Array.prototype.forEach.call(row.querySelectorAll('[data-hl]'), function (el) {
      var on = (el.getAttribute('data-hl') === k);
      el.style.color = on ? '#fff' : '#7fa0b8'; el.style.fontWeight = on ? '700' : '400'; el.style.borderBottom = '2px solid ' + (on ? '#FFCC00' : 'transparent');
    });
  } catch (e) {}
  _ffpRenderSharePreview();
};
window.ffpShareTogglePhoto = function (el) { _ffpShareCfg.usePhoto = !_ffpShareCfg.usePhoto; if (el) { el.style.background = _ffpShareCfg.usePhoto ? '#2ba8e0' : '#3a4654'; var k = el.firstChild; if (k) k.style.right = _ffpShareCfg.usePhoto ? '2px' : '20px'; } _ffpRenderSharePreview(); };
window.ffpShareToggleSticker = function (el) { _ffpShareCfg.sticker = !_ffpShareCfg.sticker; if (el) { el.style.background = _ffpShareCfg.sticker ? '#2ba8e0' : '#3a4654'; var k = el.firstChild; if (k) k.style.right = _ffpShareCfg.sticker ? '2px' : '20px'; } if (_ffpShareCfg.sticker && _ffpShareCfg.usePhoto) { _ffpShareCfg.usePhoto = false; var pt = document.querySelector('#ffp-sc-ov [onclick^="ffpShareTogglePhoto"]'); if (pt) { pt.style.background = '#3a4654'; var pk = pt.firstChild; if (pk) pk.style.right = '20px'; } } _ffpRenderSharePreview(); };
window.ffpCloseShareSheet = function () { var o = document.getElementById('ffp-sc-ov'); if (o && o.parentNode) o.parentNode.removeChild(o); };
// Tap "Share card" → open the PREVIEW first (pick format, then Share / Download).
window.ffpSocialShareActivity = function (id) { _ffpOpenShareSheet(id); };
function _ffpOpenShareSheet(id) {
  var a = window._ffpActCard || {}; _ffpShareCfg = { ratio: '1:1', usePhoto: false, sticker: false, id: id, show: _ffpDefaultShow(a), headline: (_ffpHeadlineList(a)[0] || {}).key || null }; _ffpShareFile = null; _ffpShareKey = null;
  var esc = (window.escHtml ? window.escHtml : function (s) { return String(s == null ? '' : s); });
  var hasPhoto = !!(a.photo_url || (a.photos && a.photos.length));   // primary photo may live in photos[]
  // Options checklist rows — one per field the activity actually has (Rule 0: availability from _ffpShareFields).
  // Build 535: always offer "HR zones" as a share option even when this activity has none (shown disabled with a
  // hint), so it's never invisible/confusing. All other fields still appear only when the activity has the data.
  var _optFlds = _ffpShareFields(a).filter(function (f) { return f.avail || f.key === 'hrzones'; });
  var _cbRow = function (f) {
    if (!f.avail) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 2px;border-bottom:1px solid rgba(255,255,255,0.06);opacity:0.5;">' +
        '<span style="font-size:14px;color:#e6edf3;font-weight:700;">' + esc(f.label) + '<span style="color:#8a99a8;font-weight:600;font-size:11px;"> · no heart-rate zone data on this activity</span></span>' +
        '<span class="material-icons" style="font-size:18px;color:#5a7186;">block</span></div>';
    }
    var onNow = !!_ffpShareCfg.show[f.key];
    return '<label onclick="ffpShareToggleField(\'' + f.key + '\',this)" style="display:flex;align-items:center;justify-content:space-between;padding:12px 2px;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer;">' +
      '<span style="font-size:14px;color:#e6edf3;font-weight:700;">' + esc(f.label) + (f.unit ? ' <span style="color:#8a99a8;font-weight:600;">' + esc(f.unit) + '</span>' : '') + '</span>' +
      '<span class="ffp-sc-cb" style="width:24px;height:24px;border-radius:7px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:#fff;' + (onNow ? 'background:#2ba8e0;' : 'background:transparent;border:2px solid #3a4654;') + '">' + (onNow ? '✓' : '') + '</span></label>';
  };
  var _hlScroll = _ffpHeadlineList(a).map(function (h) {
    var on = (h.key === _ffpShareCfg.headline);
    return '<span data-hl="' + h.key + '" onclick="ffpShareSetHeadline(\'' + h.key + '\')" style="flex:0 0 auto;font-size:15px;font-weight:' + (on ? '700' : '400') + ';color:' + (on ? '#fff' : '#7fa0b8') + ';padding-bottom:4px;border-bottom:2px solid ' + (on ? '#FFCC00' : 'transparent') + ';cursor:pointer;">' + esc(h.label) + '</span>';
  }).join('');
  var _optsPanel = '<div id="ffp-sc-opts" style="display:none;margin-top:10px;background:#0c1521;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:6px 14px 12px;">' +
    '<style>#ffp-sc-headline::-webkit-scrollbar{display:none;height:0;}</style>' +
    '<div style="font-size:10px;font-weight:900;letter-spacing:1px;color:#6a8398;text-transform:uppercase;margin:12px 0 8px;">Headline</div>' +
    '<div id="ffp-sc-headline" style="display:flex;gap:22px;overflow-x:auto;padding:0 0 4px;scrollbar-width:none;-webkit-overflow-scrolling:touch;">' + _hlScroll + '</div>' +
    '<div style="font-size:10px;font-weight:900;letter-spacing:1px;color:#6a8398;text-transform:uppercase;margin:16px 0 2px;">Details</div>' +
    _optFlds.map(_cbRow).join('') +
    '<div style="font-size:11px;color:#6a8398;margin-top:10px;line-height:1.4;">Only fields you logged appear here. Everything ticked shows on the card.</div>' +
  '</div>';
  // Member's referral LINK → shown at the foot of the share sheet (copyable) + appended to the share caption.
  // Reuses window._ppRefLink() (https://ffppassport.com/join?ref=CODE) so a new signup is auto-credited — the
  // recipient just clicks the link, there's no code to type anywhere.
  var _scMem = (window.FFPAuth && FFPAuth.getMember && FFPAuth.getMember()) || (function () { try { return JSON.parse(localStorage.getItem('ffp_member') || 'null'); } catch (e) { return null; } })();
  var _scCode = (_scMem && _scMem.referral_code) ? String(_scMem.referral_code) : '';
  var _scRefLink = _scCode ? ((window._ppRefLink ? window._ppRefLink() : '')) : '';
  window._ffpShareRef = _scRefLink;
  var tab = function (r, lbl) { return '<div id="ffp-sc-tab-' + r.replace(':', '-') + '" onclick="ffpShareSetRatio(\'' + r + '\')" style="flex:1;text-align:center;padding:9px;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;color:#8a99a8;">' + lbl + '</div>'; };
  var ov = document.createElement('div'); ov.id = 'ffp-sc-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:100060;background:rgba(4,9,15,0.94);display:flex;flex-direction:column;font-family:inherit;';
  ov.innerHTML = '<div style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:16px 16px calc(22px + env(safe-area-inset-bottom));max-width:480px;width:100%;margin:0 auto;box-sizing:border-box;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;"><div style="font-size:17px;font-weight:800;color:#fff;">Share your ' + esc((a.activity || 'activity')).toLowerCase() + '</div><span onclick="ffpCloseShareSheet()" class="material-icons" style="color:#8a99a8;cursor:pointer;">close</span></div>' +
    '<div style="display:flex;gap:6px;background:#111a26;border-radius:11px;padding:4px;margin-bottom:16px;">' + tab('1:1', 'Square 1:1') + tab('4:5', 'Portrait 4:5') + tab('9:16', 'Story 9:16') + '</div>' +
    '<div id="ffp-sc-preview" style="position:relative;width:100%;"></div>' +
    (hasPhoto ? '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;background:#111a26;border-radius:11px;padding:11px 14px;"><span style="font-size:13px;font-weight:700;color:#cfe0ee;">Use my photo as background</span><span onclick="ffpShareTogglePhoto(this)" style="width:40px;height:22px;border-radius:20px;background:#3a4654;position:relative;cursor:pointer;display:inline-block;flex:0 0 auto;"><span style="position:absolute;right:20px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:right .15s;"></span></span></div>' : '') +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;background:#111a26;border-radius:11px;padding:11px 14px;"><span style="font-size:13px;font-weight:700;color:#cfe0ee;">Transparent sticker <span style="color:#8a99a8;font-weight:600;">— save &amp; overlay on any photo</span></span><span onclick="ffpShareToggleSticker(this)" style="width:40px;height:22px;border-radius:20px;background:#3a4654;position:relative;cursor:pointer;display:inline-block;flex:0 0 auto;"><span style="position:absolute;right:20px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:right .15s;"></span></span></div>' +
    '<button onclick="ffpShareToggleOptions(this)" style="width:100%;margin-top:10px;padding:12px;border:1px solid rgba(255,255,255,0.14);border-radius:11px;background:#111a26;color:#fff;font-weight:800;font-size:13.5px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:7px;"><span class="material-icons" style="font-size:17px;">tune</span> Options &mdash; choose what shows</button>' +
    _optsPanel +
    '<div style="display:flex;gap:10px;margin-top:16px;"><button id="ffp-sc-dl-btn" onclick="ffpDownloadActivityCard()" style="position:relative;overflow:hidden;flex:1;padding:14px;border:1px solid rgba(255,255,255,0.18);border-radius:13px;background:rgba(255,255,255,0.05);color:#cfe0ee;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit;"><span id="ffp-sc-dl-fill" style="position:absolute;left:0;top:0;bottom:0;width:0%;background:rgba(43,168,224,0.32);transition:width .12s linear;z-index:0;"></span><span id="ffp-sc-dl-lbl" style="position:relative;z-index:1;"><span class="material-icons" style="font-size:16px;vertical-align:-3px;">download</span> Download</span></button><button onclick="ffpDoShareCard()" style="flex:2;padding:14px;border:none;border-radius:13px;background:linear-gradient(135deg,#2ba8e0,#1d7fb0);color:#fff;font-weight:900;font-size:14px;cursor:pointer;font-family:inherit;"><span class="material-icons" style="font-size:16px;vertical-align:-3px;">ios_share</span> Share</button></div>' +
    (_scCode ? '<div style="margin-top:18px;background:#111a26;border:1px solid rgba(43,168,224,0.22);border-radius:12px;padding:13px 14px;">' +
      '<div style="font-size:10.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#8a99a8;margin-bottom:8px;">Your invite link</div>' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<div style="flex:1;min-width:0;font-size:12.5px;font-weight:700;color:#cfe0ee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(_scRefLink) + '</div>' +
        '<button data-code="' + esc(_scRefLink) + '" onclick="ffpCopyReferral(this)" style="flex:0 0 auto;padding:9px 16px;border:none;border-radius:10px;background:#FFCC00;color:#081420;font-weight:900;font-size:13px;cursor:pointer;font-family:inherit;"><span class="material-icons" style="font-size:15px;vertical-align:-3px;">content_copy</span> Copy link</button>' +
      '</div>' +
      '<div style="font-size:11px;color:#8a99a8;margin-top:8px;line-height:1.4;">Share this link in your post — anyone who joins through it is automatically credited to you (no code to type).</div>' +
    '</div>' : '') +
  '</div>';
  document.body.appendChild(ov);
  _ffpRenderSharePreview();
}
// Copy the referral code to the clipboard (with a textarea fallback for older / iOS in-app webviews).
window.ffpCopyReferral = function (btn) {
  var code = (btn && btn.getAttribute('data-code')) || '';
  if (!code) return;
  var done = function () {
    var o = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons" style="font-size:15px;vertical-align:-3px;">check</span> Copied';
    setTimeout(function () { btn.innerHTML = o; }, 1600);
    if (window.showToast) showToast('Invite link copied', 'success');
  };
  var fallback = function () { try { var t = document.createElement('textarea'); t.value = code; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.focus(); t.select(); document.execCommand('copy'); document.body.removeChild(t); } catch (e) {} };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(code).then(done, function () { fallback(); done(); }); }
    else { fallback(); done(); }
  } catch (e) { fallback(); done(); }
};
window.ffpDoShareCard = async function () {
  var a = window._ffpActCard || {};
  var bits = [a.activity || 'My activity']; if (a.distance_km != null && a.distance_km > 0) bits.push((Math.round(a.distance_km * 100) / 100) + ' km'); var mins = Math.round(a.duration_min || 0); if (mins || a.duration_sec) bits.push(mins + ' min');
  var caption = bits.join(' · ') + ' — FFP Passport' + (window._ffpShareRef ? ('\nJoin me on FFP Passport: ' + window._ffpShareRef) : '');
  function cancel(e) { return e && (e.name === 'AbortError' || /abort|cancel|dismiss/i.test(e.message || '')); }
  // ROOT-CAUSE FIX: count the share the moment they tap Share — BEFORE rendering the card image.
  // Previously this was logged AFTER the image export, but the export's early `return` (below) on any
  // render hiccup skipped it entirely, so members whose card didn't render got NO share points. Log first.
  if (window.ffpLogSocialShare) ffpLogSocialShare('activity');
  // ALWAYS share the IMAGE (never a URL/link). Use the pre-rendered file if ready, else make it now.
  var f = (_ffpShareFile && _ffpShareKey === _ffpCurKey()) ? _ffpShareFile : null;
  if (!f) { f = await _ffpCaptureShareCard(); if (f) { _ffpShareFile = f; _ffpShareKey = _ffpCurKey(); } }
  if (!f) { if (typeof showToast === 'function') showToast('Image failed: ' + (_ffpShareErr || 'unknown'), 'error'); return; }
  try {
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], text: caption }); return; }
    // Device can't share images (most desktop browsers) → download it instead of sharing a link.
    if (typeof showToast === 'function') showToast('Image sharing isn’t supported here — downloaded instead', 'info');
    var u = URL.createObjectURL(f); var aTag = document.createElement('a'); aTag.href = u; aTag.download = f.name; document.body.appendChild(aTag); aTag.click(); setTimeout(function () { URL.revokeObjectURL(u); aTag.remove(); }, 500);
  } catch (e) { if (cancel(e)) return; if (typeof showToast === 'function') showToast('Could not share', 'error'); }
};
window.ffpDownloadActivityCard = async function () {
  var btn = document.getElementById('ffp-sc-dl-btn'), fill = document.getElementById('ffp-sc-dl-fill'), lbl = document.getElementById('ffp-sc-dl-lbl');
  var pct = 0, timer = null;
  var ic = function (n) { return '<span class="material-icons" style="font-size:16px;vertical-align:-3px;">' + n + '</span> '; };
  function paint(p) { pct = Math.max(0, Math.min(100, Math.round(p))); if (fill) fill.style.width = pct + '%'; if (lbl) lbl.innerHTML = (pct >= 100 ? ic('check_circle') + 'Saved' : ic('download') + 'Saving… ' + pct + '%'); }
  function reset() { if (fill) fill.style.width = '0%'; if (lbl) lbl.innerHTML = ic('download') + 'Download'; }
  if (btn) btn.disabled = true;
  var ready = (_ffpShareFile && _ffpShareKey === _ffpCurKey());
  paint(ready ? 65 : 8);
  timer = setInterval(function () { if (pct < 92) paint(pct + (ready ? 14 : 6)); }, 110);   // animate while the image renders (no native progress events for a local export)
  var f = ready ? _ffpShareFile : await _ffpCaptureShareCard();
  if (timer) clearInterval(timer);
  if (!f) { if (btn) btn.disabled = false; reset(); if (typeof showToast === 'function') showToast('Image failed: ' + (_ffpShareErr || 'unknown'), 'error'); return; }
  paint(100);
  var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  try {
    if (iOS && navigator.canShare && navigator.canShare({ files: [f] })) {
      await navigator.share({ files: [f] });   // iOS ignores <a download>; saving to the camera roll is "Save Image" in the share sheet
    } else {
      var u = URL.createObjectURL(f); var aTag = document.createElement('a'); aTag.href = u; aTag.download = f.name; document.body.appendChild(aTag); aTag.click(); setTimeout(function () { URL.revokeObjectURL(u); aTag.remove(); }, 500);
      if (typeof showToast === 'function') showToast('Saved to your device', 'success');
    }
  } catch (e) { if (!(e && e.name === 'AbortError') && typeof showToast === 'function') showToast('Could not save', 'error'); }
  if (btn) btn.disabled = false;
  setTimeout(reset, 1800);
};
})();
