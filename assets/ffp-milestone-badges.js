/* FFP Milestone Badges — v1 (2026-06-06)
   The badge ART LIBRARY + LADDERS + WALL RENDERER for the Milestones tab.
   Each metric is its own OBJECT badge (Grant's approved set), recolouring across 8 LEVELS
   (Bronze, Silver, Gold, Emerald, Sapphire, Amethyst, Ruby, Legend). Earned badges render in
   their level metal; locked badges render greyed. The milestone target is shown in a caption
   under each badge. Pure rendering — the loader passes in the member's numbers.

   window.FFPMSBadges.render(values, gridEl)
     values = { activities, strength, cities, endurance, bodyfatRank, quests, meets, connections }
   Any value left undefined simply skips that metric's wall (so we can wire metrics incrementally).
*/
(function () {
  'use strict';

  var LEVELS = [
    { name: 'BRONZE',   lite: '#f0c191', mid: '#bd7b34', dark: '#5f3413', leafL: '#e2a564', leafD: '#7a481c' },
    { name: 'SILVER',   lite: '#f3f7fb', mid: '#9aa7b6', dark: '#4d5866', leafL: '#cfd8e2', leafD: '#5d6775' },
    { name: 'GOLD',     lite: '#ffe9a3', mid: '#e0a400', dark: '#7c5800', leafL: '#ffd451', leafD: '#9a6e00' },
    { name: 'EMERALD',  lite: '#bdf5d2', mid: '#1fae6b', dark: '#0a5e38', leafL: '#62d59a', leafD: '#11774a' },
    { name: 'SAPPHIRE', lite: '#cbeeff', mid: '#2ba8e0', dark: '#0c5070', leafL: '#67c8f0', leafD: '#13658c' },
    { name: 'AMETHYST', lite: '#e6cdff', mid: '#9a52e0', dark: '#532b80', leafL: '#bd8cf0', leafD: '#6a3a9a' },
    { name: 'RUBY',     lite: '#ffccd4', mid: '#e0354f', dark: '#7c1424', leafL: '#f06c80', leafD: '#9a1e30' },
    { name: 'LEGEND',   lite: '#dfe7f2', mid: '#7f8da6', dark: '#2b3550', leafL: '#aab6cf', leafD: '#3d4a6a' }
  ];
  var GREY = { name: 'LOCKED', lite: '#48586a', mid: '#33414f', dark: '#1f2a34', leafL: '#3c4a58', leafD: '#26323c' };

  function injectDefs() {
    if (document.getElementById('ffp-msb-defs')) return;
    var sets = LEVELS.map(function (p, i) { return { k: String(i), p: p }; });
    sets.push({ k: 'g', p: GREY });
    var g = '';
    sets.forEach(function (s) {
      var p = s.p, k = s.k;
      g += '<linearGradient id="msb-mtl' + k + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + p.lite + '"/><stop offset=".3" stop-color="' + p.mid + '"/><stop offset=".8" stop-color="' + p.dark + '"/><stop offset="1" stop-color="' + p.dark + '"/></linearGradient>';
      g += '<radialGradient id="msb-shn' + k + '" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="' + p.lite + '"/><stop offset=".55" stop-color="' + p.mid + '"/><stop offset="1" stop-color="' + p.dark + '"/></radialGradient>';
      g += '<linearGradient id="msb-lf' + k + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + p.leafL + '"/><stop offset="1" stop-color="' + p.leafD + '"/></linearGradient>';
    });
    g += '<radialGradient id="msb-face" cx=".5" cy=".38" r=".75"><stop offset="0" stop-color="#163045"/><stop offset=".7" stop-color="#081420"/><stop offset="1" stop-color="#040d15"/></radialGradient>';
    g += '<radialGradient id="msb-sphere" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#8fdcff"/><stop offset=".4" stop-color="#2ba8e0"/><stop offset=".8" stop-color="#0c3a52"/><stop offset="1" stop-color="#06212e"/></radialGradient>';
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'ffp-msb-defs'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.style.position = 'absolute'; svg.innerHTML = '<defs>' + g + '</defs>';
    document.body.appendChild(svg);
  }

  function injectCss() {
    if (document.getElementById('ffp-msb-css')) return;
    var s = document.createElement('style'); s.id = 'ffp-msb-css'; s.textContent = [
      '.msb-sec{margin:22px 0 4px;display:flex;align-items:center;gap:8px;}',
      '.msb-sec-name{font-size:13px;font-weight:900;letter-spacing:.4px;color:var(--text,#e8eef4);}',
      '.msb-sec-count{font-size:11px;font-weight:800;color:var(--yellow,#FFCC00);margin-left:auto;}',
      '.msb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:14px 8px;margin-top:8px;}',
      '.msb-cell{display:flex;flex-direction:column;align-items:center;gap:4px;}',
      '.msb-cell svg{width:100%;max-width:96px;height:auto;display:block;}',
      '.msb-cap{font-size:10px;font-weight:800;text-align:center;line-height:1.25;}',
      '.msb-cap.next{color:var(--blue,#2ba8e0);}',
      '.msb-cap.locked{color:#5a6b7a;}'
    ].join(''); document.head.appendChild(s);
  }

  // ---- helpers ----
  function S(inner) { return '<svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>'; }
  function ffp(x, y, sz, col) { return '<text x="' + x + '" y="' + y + '" font-size="' + (sz || 10) + '" font-weight="800" letter-spacing="1.5" fill="' + col + '" text-anchor="middle" font-family="sans-serif">FFP</text>'; }

  // ---- badge renderers: (k, p, opts) ----
  function medallion(k, p, o) {
    var num = o.num != null ? String(o.num) : '';
    var fs = num.length >= 3 ? 40 : 48;
    var leaves = '', N = 28, R = 76, cx = 90, cy = 88;
    for (var i = 0; i < N; i++) {
      var a = (i / N) * Math.PI * 2 - Math.PI / 2, lx = cx + R * Math.cos(a), ly = cy + R * Math.sin(a), rot = (a * 180 / Math.PI) + 90 + 32;
      leaves += '<g transform="translate(' + lx.toFixed(1) + ',' + ly.toFixed(1) + ') rotate(' + rot.toFixed(1) + ')"><path d="M0,-7 C4,-3 4,3 0,7 C-4,3 -4,-3 0,-7 Z" fill="url(#msb-lf' + k + ')" stroke="' + p.dark + '" stroke-width=".5"/></g>';
    }
    return S(leaves
      + '<circle cx="90" cy="88" r="62" fill="none" stroke="url(#msb-mtl' + k + ')" stroke-width="13"/>'
      + '<circle cx="90" cy="88" r="68.5" fill="none" stroke="' + p.dark + '" stroke-width="1" opacity=".6"/>'
      + '<circle cx="90" cy="88" r="55.5" fill="none" stroke="' + p.dark + '" stroke-width="1" opacity=".6"/>'
      + '<circle cx="90" cy="88" r="50" fill="url(#msb-face)" stroke="' + p.mid + '" stroke-width="1"/>'
      + '<path d="M54,58 A62,62 0 0 1 124,44" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".3"/>'
      + ffp(90, 64, 10, p.lite)
      + '<text x="90" y="104" font-size="' + fs + '" font-weight="900" fill="#fff" text-anchor="middle" font-family="sans-serif">' + num + '</text>');
  }

  function plate(k, p) {
    return S('<circle cx="90" cy="86" r="80" fill="url(#msb-mtl' + k + ')" stroke="' + p.dark + '" stroke-width="1.5"/>'
      + '<circle cx="90" cy="86" r="72" fill="none" stroke="' + p.lite + '" stroke-width="1" opacity=".4"/>'
      + '<circle cx="90" cy="86" r="64" fill="none" stroke="' + p.dark + '" stroke-width="1" opacity=".3"/>'
      + '<circle cx="90" cy="40" r="6" fill="url(#msb-face)" stroke="' + p.dark + '" stroke-width=".8"/>'
      + '<circle cx="50" cy="112" r="6" fill="url(#msb-face)" stroke="' + p.dark + '" stroke-width=".8"/>'
      + '<circle cx="130" cy="112" r="6" fill="url(#msb-face)" stroke="' + p.dark + '" stroke-width=".8"/>'
      + '<circle cx="90" cy="86" r="38" fill="url(#msb-face)" stroke="' + p.mid + '" stroke-width="1"/>'
      + '<path d="M48,56 A80,80 0 0 1 130,40" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".3"/>'
      + ffp(90, 91, 13, p.lite));
  }

  function skyline(k, p) {
    var blds = [[20,110,22,42],[45,70,20,82],[68,92,28,60],[100,60,22,92],[125,84,22,68],[150,118,14,34]];
    var rects = '', win = '';
    blds.forEach(function (b) {
      rects += '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" fill="url(#msb-mtl' + k + ')" stroke="' + p.dark + '" stroke-width="1.2"/>';
      for (var yy = b[1] + 8; yy < b[1] + b[3] - 5; yy += 10) for (var xx = b[0] + 4; xx < b[0] + b[2] - 3; xx += 7) win += '<rect x="' + xx + '" y="' + yy + '" width="3" height="4" fill="' + p.lite + '" opacity=".5"/>';
    });
    return S('<ellipse cx="90" cy="160" rx="64" ry="6" fill="#000" opacity=".3"/>'
      + rects
      + '<polygon points="45,70 55,52 65,70" fill="url(#msb-mtl' + k + ')" stroke="' + p.dark + '" stroke-width="1.2"/>'
      + '<rect x="104" y="48" width="14" height="14" fill="url(#msb-mtl' + k + ')" stroke="' + p.dark + '" stroke-width="1.2"/>'
      + '<path d="M125,84 a11,11 0 0 1 22,0" fill="url(#msb-mtl' + k + ')" stroke="' + p.dark + '" stroke-width="1.2"/>'
      + '<line x1="111" y1="48" x2="111" y2="38" stroke="' + p.mid + '" stroke-width="2"/><circle cx="111" cy="36" r="2.5" fill="' + p.lite + '"/>'
      + '<line x1="18" y1="152" x2="164" y2="152" stroke="' + p.dark + '" stroke-width="2"/>'
      + win + ffp(82, 130, 9, p.dark));
  }

  function stopwatch(k, p) {
    var tk = '';
    for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2, x1 = 90 + 48 * Math.cos(a), y1 = 96 + 48 * Math.sin(a), x2 = 90 + 54 * Math.cos(a), y2 = 96 + 54 * Math.sin(a); tk += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + p.lite + '" stroke-width="' + (i % 3 === 0 ? 2 : 1) + '" opacity=".6"/>'; }
    return S('<rect x="82" y="6" width="16" height="12" rx="2" fill="url(#msb-mtl' + k + ')" stroke="' + p.dark + '" stroke-width="1"/>'
      + '<rect x="87" y="16" width="6" height="8" fill="url(#msb-shn' + k + ')" stroke="' + p.dark + '" stroke-width=".8"/>'
      + '<line x1="58" y1="34" x2="50" y2="26" stroke="url(#msb-mtl' + k + ')" stroke-width="5" stroke-linecap="round"/>'
      + '<circle cx="90" cy="96" r="70" fill="url(#msb-mtl' + k + ')" stroke="' + p.dark + '" stroke-width="1.5"/>'
      + '<circle cx="90" cy="96" r="62" fill="none" stroke="' + p.lite + '" stroke-width="1" opacity=".4"/>'
      + '<circle cx="90" cy="96" r="55" fill="url(#msb-face)" stroke="' + p.mid + '" stroke-width="1"/>'
      + tk
      + '<line x1="90" y1="96" x2="120" y2="66" stroke="' + p.lite + '" stroke-width="3" stroke-linecap="round"/>'
      + '<line x1="90" y1="96" x2="84" y2="108" stroke="' + p.lite + '" stroke-width="3" stroke-linecap="round"/>'
      + '<circle cx="90" cy="96" r="5" fill="' + p.lite + '"/>'
      + '<path d="M52,68 A70,70 0 0 1 124,46" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".3"/>'
      + ffp(90, 128, 10, p.lite));
  }

  function scales(k, p) {
    return S('<ellipse cx="90" cy="160" rx="46" ry="6" fill="#000" opacity=".3"/>'
      + '<path d="M64,148 L116,148 L124,164 L56,164 Z" fill="url(#msb-mtl' + k + ')" stroke="' + p.dark + '" stroke-width="1.2"/>'
      + '<rect x="86" y="58" width="8" height="92" rx="2" fill="url(#msb-shn' + k + ')" stroke="' + p.dark + '" stroke-width="1"/>'
      + '<rect x="40" y="54" width="100" height="7" rx="3.5" fill="url(#msb-mtl' + k + ')" stroke="' + p.dark + '" stroke-width="1"/>'
      + '<circle cx="90" cy="54" r="6" fill="url(#msb-shn' + k + ')" stroke="' + p.dark + '" stroke-width="1"/>'
      + '<line x1="46" y1="58" x2="34" y2="94" stroke="' + p.mid + '" stroke-width="1.4"/><line x1="46" y1="58" x2="58" y2="94" stroke="' + p.mid + '" stroke-width="1.4"/>'
      + '<path d="M32,94 Q46,110 60,94 Z" fill="url(#msb-mtl' + k + ')" stroke="' + p.dark + '" stroke-width="1"/><circle cx="46" cy="90" r="9" fill="url(#msb-shn' + k + ')" stroke="' + p.dark + '" stroke-width="1"/>'
      + '<line x1="134" y1="58" x2="122" y2="94" stroke="' + p.mid + '" stroke-width="1.4"/><line x1="134" y1="58" x2="146" y2="94" stroke="' + p.mid + '" stroke-width="1.4"/>'
      + '<path d="M120,94 Q134,110 148,94 Z" fill="url(#msb-mtl' + k + ')" stroke="' + p.dark + '" stroke-width="1"/><circle cx="134" cy="90" r="9" fill="url(#msb-shn' + k + ')" stroke="' + p.dark + '" stroke-width="1"/>'
      + ffp(90, 161, 9, p.lite));
  }

  function map(k, p) {
    var peaks = [[96,86,18,40],[54,80,12,30],[136,88,13,30],[44,126,10,17],[88,128,12,20],[130,124,11,18]], m = '';
    peaks.forEach(function (q) {
      var x = q[0], by = q[1], w = q[2], h = q[3], ay = by - h, cap = h * 0.36;
      m += '<path d="M' + (x - w) + ',' + by + ' L' + x + ',' + ay + ' L' + x + ',' + by + ' Z" fill="url(#msb-mtl' + k + ')" stroke="' + p.dark + '" stroke-width="1"/>'
        + '<path d="M' + x + ',' + ay + ' L' + (x + w) + ',' + by + ' L' + x + ',' + by + ' Z" fill="' + p.dark + '" stroke="' + p.dark + '" stroke-width="1"/>'
        + '<path d="M' + x + ',' + ay + ' L' + x + ',' + (ay + cap) + ' L' + (x - w * 0.34).toFixed(1) + ',' + (ay + cap) + ' Z" fill="' + p.lite + '"/>';
    });
    return S('<ellipse cx="90" cy="158" rx="64" ry="6" fill="#000" opacity=".3"/>'
      + '<path d="M22,44 L70,38 L114,44 L158,38 L158,136 L114,142 L70,136 L22,142 Z" fill="url(#msb-mtl' + k + ')" stroke="' + p.dark + '" stroke-width="1.5"/>'
      + '<path d="M70,38 L70,136 M114,44 L114,142" stroke="' + p.dark + '" stroke-width="1" opacity=".35"/>'
      + m
      + '<path d="M34,130 Q60,128 78,120 Q104,110 118,118 Q132,124 138,108" fill="none" stroke="' + p.lite + '" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2 5"/>'
      + '<circle cx="34" cy="130" r="4" fill="' + p.lite + '"/>'
      + '<path d="M133,103 l10,10 M143,103 l-10,10" stroke="' + p.lite + '" stroke-width="2.5" stroke-linecap="round"/>'
      + ffp(140, 138, 8, p.dark));
  }

  function person(cx, hy, s, yb, k, p) {
    var head = '<ellipse cx="' + cx + '" cy="' + hy + '" rx="' + (9 * s).toFixed(1) + '" ry="' + (11 * s).toFixed(1) + '" fill="url(#msb-shn' + k + ')" stroke="' + p.dark + '" stroke-width="1.1"/>';
    var b = 'M' + (cx - 22 * s).toFixed(1) + ',' + yb + ' C' + (cx - 22 * s).toFixed(1) + ',' + (hy + 24 * s).toFixed(1) + ' ' + (cx - 11 * s).toFixed(1) + ',' + (hy + 12 * s).toFixed(1) + ' ' + (cx - 5 * s).toFixed(1) + ',' + (hy + 10 * s).toFixed(1)
      + ' L' + (cx - 4 * s).toFixed(1) + ',' + (hy + 7 * s).toFixed(1) + ' Q' + cx + ',' + (hy + 9 * s).toFixed(1) + ' ' + (cx + 4 * s).toFixed(1) + ',' + (hy + 7 * s).toFixed(1)
      + ' L' + (cx + 5 * s).toFixed(1) + ',' + (hy + 10 * s).toFixed(1) + ' C' + (cx + 11 * s).toFixed(1) + ',' + (hy + 12 * s).toFixed(1) + ' ' + (cx + 22 * s).toFixed(1) + ',' + (hy + 24 * s).toFixed(1) + ' ' + (cx + 22 * s).toFixed(1) + ',' + yb + ' Z';
    return '<path d="' + b + '" fill="url(#msb-shn' + k + ')" stroke="' + p.dark + '" stroke-width="1.1"/>' + head;
  }
  function wreathPeople(k, p, n) {
    var leaves = '', N = 30, R = 76, cx = 90, cy = 88;
    for (var i = 0; i < N; i++) {
      var a = (i / N) * Math.PI * 2 - Math.PI / 2, lx = cx + R * Math.cos(a), ly = cy + R * Math.sin(a), rot = (a * 180 / Math.PI) + 90 + 32;
      leaves += '<g transform="translate(' + lx.toFixed(1) + ',' + ly.toFixed(1) + ') rotate(' + rot.toFixed(1) + ')"><path d="M0,-7 C4,-3 4,3 0,7 C-4,3 -4,-3 0,-7 Z" fill="url(#msb-lf' + k + ')" stroke="' + p.dark + '" stroke-width=".5"/></g>';
    }
    var ppl = n >= 4
      ? person(74, 78, 0.66, 112, k, p) + person(106, 78, 0.66, 112, k, p) + person(64, 88, 0.78, 118, k, p) + person(116, 88, 0.78, 118, k, p)
      : person(75, 82, 0.94, 118, k, p) + person(105, 82, 0.94, 118, k, p);
    return S(leaves
      + '<circle cx="90" cy="88" r="62" fill="none" stroke="url(#msb-mtl' + k + ')" stroke-width="13"/>'
      + '<circle cx="90" cy="88" r="68.5" fill="none" stroke="' + p.dark + '" stroke-width="1" opacity=".6"/>'
      + '<circle cx="90" cy="88" r="55.5" fill="none" stroke="' + p.dark + '" stroke-width="1" opacity=".6"/>'
      + '<clipPath id="msbpc' + k + n + '"><circle cx="90" cy="88" r="50"/></clipPath>'
      + '<circle cx="90" cy="88" r="50" fill="url(#msb-face)" stroke="' + p.mid + '" stroke-width="1"/>'
      + '<g clip-path="url(#msbpc' + k + n + ')">' + ppl + '</g>'
      + '<path d="M54,58 A62,62 0 0 1 124,44" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".3"/>'
      + ffp(90, 56, 10, p.lite));
  }

  function drawBadge(badge, k, p, o) {
    switch (badge) {
      case 'medallion': return medallion(k, p, o);
      case 'plate': return plate(k, p);
      case 'skyline': return skyline(k, p);
      case 'stopwatch': return stopwatch(k, p);
      case 'scales': return scales(k, p);
      case 'map': return map(k, p);
      case 'people4': return wreathPeople(k, p, 4);
      case 'people2': return wreathPeople(k, p, 2);
      default: return medallion(k, p, o);
    }
  }

  // ---- ladders ----
  var ACT = [1,2,3,4,5,6,7,8,9,10, 12,14,16,18,20,22,24,26,28,30, 34,38,42,46,50,54,58,62,66,70,
             77,84,91,98,105,112,119,126,133,140, 150,160,170,180,190,200,210,220,230,240,
             253,266,279,292,305,318,331,344,357,370, 386,402,418,434,450,466,482,498,514,530,
             550,570,590,610,630,650,670,690,710,730];

  var METRICS = [
    { key: 'activities', label: 'Activities Logged', badge: 'medallion', val: 'activities',
      vals: ACT, fmt: function (v) { return v.toLocaleString(); }, showNum: true },
    { key: 'strength', label: 'Strength', badge: 'plate', val: 'strength',
      vals: [0.5,0.6,0.75,0.9,1.0,1.15,1.3,1.5,1.7,1.9,2.1,2.3,2.5,2.75,3.0,3.5], fmt: function (v) { return v + '× bw'; } },
    { key: 'cities', label: 'Cities', badge: 'skyline', val: 'cities',
      vals: [1,2,3,4,5,6,8,10,12,15,18,22,26,30,35,40], fmt: function (v) { return v + (v === 1 ? ' city' : ' cities'); } },
    { key: 'endurance', label: 'Endurance', badge: 'stopwatch', val: 'endurance',
      vals: [60,120,240,420,600,900,1200,1800,2400,3000,4200,6000,9000,12000,18000,24000], fmt: function (v) { return Math.round(v / 60) + ' hrs'; } },
    { key: 'bodyfat', label: 'Body Fat', badge: 'scales', val: 'bodyfat', dir: 'lo',
      vals: [32,30,28,26,24,22,20,18,16,14,12,10], fmt: function (v) { return '≤' + v + '%'; } },
    { key: 'quests', label: 'Quests', badge: 'map', val: 'quests',
      vals: [1,2,3,4,6,8,10,13,16,20,25,30,40,50], fmt: function (v) { return v + (v === 1 ? ' quest' : ' quests'); } },
    { key: 'meets', label: 'Meetups', badge: 'people4', val: 'meets',
      vals: [1,2,3,4,5,7,9,12,15,20,25,30,40,50], fmt: function (v) { return v + (v === 1 ? ' meet' : ' meets'); } },
    { key: 'connections', label: 'Connections', badge: 'people2', val: 'connections',
      vals: [1,2,3,5,8,12,16,20,30,40,55,75,100,150], fmt: function (v) { return v + (v === 1 ? ' link' : ' links'); } }
  ];

  function render(values, gridEl) {
    if (!gridEl) return;
    injectCss(); injectDefs();
    values = values || {};
    var html = '';
    METRICS.forEach(function (m) {
      var mv = values[m.val];
      if (mv == null) return; // metric not wired yet — skip its wall
      var total = m.vals.length, per = Math.ceil(total / 8), earned = 0, nextFound = false;
      var cells = '';
      m.vals.forEach(function (t, i) {
        var lvl = Math.min(7, Math.floor(i / per));
        var isEarned = (m.dir === 'lo') ? (mv <= t) : (mv >= t), state;
        if (isEarned) { state = 'earned'; earned++; }
        else if (!nextFound) { state = 'next'; nextFound = true; }
        else state = 'locked';
        var k = isEarned ? String(lvl) : 'g', p = isEarned ? LEVELS[lvl] : GREY;
        var svg = drawBadge(m.badge, k, p, { num: m.showNum ? t : null });
        var cap = state === 'earned'
          ? '<div class="msb-cap" style="color:' + LEVELS[lvl].lite + '">' + m.fmt(t) + '</div>'
          : (state === 'next'
            ? '<div class="msb-cap next">' + m.fmt(t) + '</div>'
            : '<div class="msb-cap locked">' + m.fmt(t) + '</div>');
        cells += '<div class="msb-cell">' + svg + cap + '</div>';
      });
      html += '<div class="msb-sec"><span class="msb-sec-name">' + m.label + '</span><span class="msb-sec-count">' + earned + ' of ' + total + '</span></div>'
        + '<div class="msb-grid">' + cells + '</div>';
    });
    gridEl.innerHTML = html;
  }

  window.FFPMSBadges = { render: render, LEVELS: LEVELS, METRICS: METRICS };
})();
