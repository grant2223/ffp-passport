/* FFP IMAGE OPTIMIZER — v1 (2026-07-03)
   Serves every Supabase Storage photo through the on-the-fly image CDN, sized to the element it fills,
   so grids/feeds download small thumbnails instead of full-size originals.

   HOW: rewrites public-object URLs
        https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>
     →  https://<proj>.supabase.co/storage/v1/render/image/public/<bucket>/<path>?width=W&quality=70
   for both <img src> and inline background-image, automatically (initial sweep + MutationObserver).

   DROP-IN: <script src="assets/ffp-img.js?v=FFP_BUILD"></script> — no markup changes needed.
   Idempotent, defensive, capped at 2x DPR, widths snapped to buckets to maximise CDN cache hits.
   Only touches URLs on THIS project's storage host; everything else is left untouched.
   Also exposes window.ffpImg(url, cssWidth) for explicit use. */
(function () {
  'use strict';
  var HOST = 'kxzyuofecmtymablnmak.supabase.co';
  var OBJ  = '/storage/v1/object/public/';
  var REN  = '/storage/v1/render/image/public/';
  var DPR  = Math.min(window.devicePixelRatio || 1, 2);
  var BUCKETS = [64, 96, 160, 240, 320, 480, 640, 800, 1080, 1600];

  function bucket(w) { for (var i = 0; i < BUCKETS.length; i++) { if (w <= BUCKETS[i]) return BUCKETS[i]; } return 1600; }

  // Rewrite a public-object URL → render/image URL sized for cssW. Returns null if not applicable.
  function toCdn(url, cssW) {
    if (!url) return null;
    if (url.indexOf(HOST) === -1) return null;      // not our storage
    if (url.indexOf(REN) > -1) return null;          // already transformed
    if (url.indexOf(OBJ) === -1) return null;        // not a public object
    var w = bucket(Math.round((cssW || 0) * DPR) || 480);
    var base = url.replace(OBJ, REN);
    var sep = base.indexOf('?') > -1 ? '&' : '?';    // preserve any existing ?v= cache-bust
    return base + sep + 'width=' + w + '&quality=70';
  }

  function widthOf(el) {
    var w = el.clientWidth || el.offsetWidth || 0;
    if (!w) { try { w = el.getBoundingClientRect().width; } catch (e) {} }
    return w;
  }

  function fixImg(img) {
    if (img.__ffpi) return;
    var src = img.getAttribute('src'); if (!src) return;
    if (src.indexOf(HOST) === -1 || src.indexOf(OBJ) === -1) { img.__ffpi = 1; return; }
    var w = widthOf(img); if (!w) return;            // not laid out yet — retried by observer/resize
    var cdn = toCdn(src, w); if (!cdn) { img.__ffpi = 1; return; }
    img.__ffpi = 1;
    img.setAttribute('loading', img.getAttribute('loading') || 'lazy');
    img.setAttribute('decoding', 'async');
    img.src = cdn;
  }

  function fixBg(el) {
    if (el.__ffpb) return;
    var bi = el.style && el.style.backgroundImage;
    if (!bi || bi.indexOf('url(') === -1 || bi.indexOf(HOST) === -1) { if (bi && bi.indexOf(HOST) === -1) el.__ffpb = 1; return; }
    var m = bi.match(/url\((['"]?)([^'")]+)\1\)/); if (!m) return;
    var w = widthOf(el); if (!w) return;
    var cdn = toCdn(m[2], w); if (!cdn) { el.__ffpb = 1; return; }
    el.__ffpb = 1;
    el.style.backgroundImage = "url('" + cdn + "')";
  }

  function sweep(root) {
    root = root || document;
    if (!root.querySelectorAll) return;
    try {
      var imgs = root.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) fixImg(imgs[i]);
      var bgs = root.querySelectorAll('[style*="background-image"]');
      for (var j = 0; j < bgs.length; j++) fixBg(bgs[j]);
    } catch (e) {}
  }

  // Process only NEWLY added nodes (not the whole document) so the observer stays cheap on a busy app.
  var addQ = [], queued = false;
  var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
  function flush() {
    queued = false; var q = addQ; addQ = [];
    for (var i = 0; i < q.length; i++) {
      var n = q[i]; if (!n || n.nodeType !== 1) continue;
      if (n.tagName === 'IMG') fixImg(n); else if (n.style && n.style.backgroundImage) fixBg(n);
      sweep(n);   // its descendants
    }
  }
  function queue(n) { addQ.push(n); if (!queued) { queued = true; raf(flush); } }

  function start() {
    sweep(document);
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (m.type === 'childList') { for (var k = 0; k < m.addedNodes.length; k++) queue(m.addedNodes[k]); }
          else if (m.type === 'attributes') {
            var t = m.target;
            if (t.tagName === 'IMG' && m.attributeName === 'src') { t.__ffpi = 0; fixImg(t); }
            else if (m.attributeName === 'style') { t.__ffpb = 0; fixBg(t); }
          }
        }
      }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'style'] });
    } catch (e) {}
    window.addEventListener('resize', function () { raf(function () { sweep(document); }); }, { passive: true });
    // catch panels that render/reveal after first paint (0-width when hidden, correct once shown)
    setTimeout(function () { sweep(document); }, 1200);
    setTimeout(function () { sweep(document); }, 3500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.ffpImg = function (url, cssWidth) { return toCdn(url, cssWidth || 480) || url; };
})();
