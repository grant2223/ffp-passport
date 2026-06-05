/* FFP Image Upload — shared uploader (v1, 2026-06-05)
   ONE reusable image pipeline for every upload surface: pick → (optional crop) → resize → JPEG →
   Supabase Storage → return the public URL. Replaces the base64-in-DB pattern everywhere.

   WHY: user-uploaded images must live in Supabase Storage (CDN-served public URLs), NOT as base64 in
   Postgres columns. This module is the single source of truth for that. The existing avatar uploader
   (ffp-photo-upload.js) already does this for the `avatars` bucket; this generalises it for all other
   surfaces (provider logos/heroes, event/meetup/experience covers).

   STORAGE CONVENTION (matches the RLS on the new buckets):
     path = "{ownerUserId}/{key}.jpg"  where ownerUserId = the logged-in member id (auth.uid()).
     RLS lets a user write ONLY under their own "{auth.uid()}/" folder (admins can write anywhere).
     The caller is responsible for persisting the returned URL to its own table/column.

   PUBLIC API:
     window.FFPUpload.pick({ bucket, key, aspect, outW, outH, title, onDone(url), onError(e) })
        - opens the native file picker, crops to `aspect` (if Cropper.js is present), resizes to
          outW×outH (defaults 800×800), uploads, calls onDone(publicUrl).
        - aspect: number (w/h). 1 = square (logos/avatars), 16/9 ≈ 1.78 (cover banner), etc. Omit = free.
     await window.FFPUpload.uploadBlob(bucket, key, blob)  -> publicUrl   (low-level, no UI)

   PREREQS on the page (same as the avatar uploader):
     @supabase/supabase-js, assets/ffp-api-integration.js (JWT bridge → auth.uid()),
     and — only if you want cropping — cropperjs CSS+JS. Without Cropper, it resizes without cropping.
*/
(function () {
  'use strict';

  var cropper = null;
  var pending = null; // { bucket, key, outW, outH, aspect, onDone, onError }

  function ownerId() {
    // The storage RLS requires the file's folder to equal auth.uid() — which is the `sub` claim of the
    // login JWT. Read it straight from the token so the folder ALWAYS matches the policy (members and
    // providers can have a record id that differs from their auth id, which caused a 400 on upload).
    try {
      var tok = window.FFPAuth && window.FFPAuth.getToken && window.FFPAuth.getToken();
      if (tok) {
        var parts = tok.split('.');
        if (parts.length === 3) {
          var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          while (b64.length % 4) b64 += '=';
          var payload = JSON.parse(atob(b64));
          if (payload && payload.sub) return String(payload.sub);
        }
      }
    } catch (e) { /* fall through to member id */ }
    try {
      var m = window.FFPAuth && window.FFPAuth.getMember && window.FFPAuth.getMember();
      return (m && m.id) || null;
    } catch (e2) { return null; }
  }

  // ── Low-level: upload a Blob to {ownerId}/{key}.jpg and return the public URL ──
  async function uploadBlob(bucket, key, blob) {
    if (!window.supabase) throw new Error('Storage client not ready');
    var oid = ownerId();
    if (!oid) throw new Error('Please sign in again');
    if (!bucket || !key) throw new Error('bucket and key are required');
    var path = oid + '/' + String(key).replace(/[^a-zA-Z0-9._-]/g, '_') + '.jpg';
    var up = await window.supabase.storage.from(bucket).upload(path, blob, {
      contentType: 'image/jpeg', upsert: true, cacheControl: '3600'
    });
    if (up.error) throw up.error;
    var pub = window.supabase.storage.from(bucket).getPublicUrl(path);
    var url = (pub && pub.data && pub.data.publicUrl) || null;
    // Files upsert to a STABLE path (one per entity), so the URL string is unchanged across re-uploads.
    // Append a version param so the new image actually shows (and the saved URL differs) — busts browser/CDN
    // cache. Supabase serves the object regardless of the extra query param.
    return url ? (url + '?v=' + Date.now()) : null;
  }

  // ── Resize an image source (data URL) to fit within maxW×maxH, return a JPEG blob ──
  function resizeToBlob(srcDataUrl, maxW, maxH) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, maxW / w, maxH / h);
        var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
        var c = document.createElement('canvas'); c.width = cw; c.height = ch;
        var ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#0f1e2e'; ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Could not encode image')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { reject(new Error('Could not read that image')); };
      img.src = srcDataUrl;
    });
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function (e) { resolve(e.target.result); };
      r.onerror = function () { reject(new Error('Could not read that file')); };
      r.readAsDataURL(file);
    });
  }

  // ── No-UI helper: take a File (from an <input> or drag-drop), resize, upload, return URL ──
  // For surfaces that already have their own file input/drag-drop and don't need a crop step.
  async function uploadFile(bucket, key, file, opts) {
    opts = opts || {};
    if (!file || !/^image\//.test(file.type || '')) throw new Error('Please pick an image');
    var dataUrl = await fileToDataUrl(file);
    var blob = await resizeToBlob(dataUrl, opts.maxW || 1280, opts.maxH || 1280);
    return uploadBlob(bucket, key, blob);
  }

  // ── Crop modal (built once, reused), parametrised by aspect ──
  function ensureModal() {
    if (document.getElementById('ffp-imgup-modal')) return;
    var style = document.createElement('style');
    style.id = 'ffp-imgup-styles';
    style.textContent = [
      '#ffp-imgup-modal{display:none;position:fixed;inset:0;background:rgba(8,20,32,0.96);z-index:10000;flex-direction:column;}',
      '#ffp-imgup-modal.open{display:flex;}',
      '#ffp-imgup-modal .iu-header{padding:14px 18px;border-bottom:1px solid rgba(43,168,224,0.2);display:flex;justify-content:space-between;align-items:center;color:#fff;}',
      '#ffp-imgup-modal .iu-title{font-size:16px;font-weight:700;}',
      '#ffp-imgup-modal .iu-close{background:transparent;border:none;color:#fff;font-size:28px;cursor:pointer;padding:0 8px;line-height:1;}',
      '#ffp-imgup-modal .iu-body{flex:1;display:flex;align-items:center;justify-content:center;padding:16px;overflow:hidden;min-height:0;}',
      '#ffp-imgup-img{display:block;max-width:100%;max-height:62vh;}',
      '#ffp-imgup-modal .iu-footer{padding:14px 18px;border-top:1px solid rgba(43,168,224,0.2);display:flex;gap:10px;justify-content:flex-end;}',
      '#ffp-imgup-modal .iu-btn{padding:11px 22px;border-radius:8px;border:1px solid rgba(43,168,224,0.4);background:transparent;color:#fff;font-size:14px;font-weight:600;cursor:pointer;min-width:96px;}',
      '#ffp-imgup-modal .iu-btn-primary{background:#2ba8e0;border-color:#2ba8e0;}',
      '#ffp-imgup-modal .iu-btn:disabled{opacity:0.55;cursor:not-allowed;}',
      '@media (max-width:600px){#ffp-imgup-modal .iu-btn{flex:1;min-width:0;}#ffp-imgup-img{max-height:70vh;}}'
    ].join('\n');
    document.head.appendChild(style);
    var modal = document.createElement('div');
    modal.id = 'ffp-imgup-modal';
    modal.innerHTML = [
      '<div class="iu-header"><div class="iu-title" id="ffp-imgup-title">Crop image</div>',
      '<button class="iu-close" aria-label="Close" onclick="window.FFPUpload._close()">&times;</button></div>',
      '<div class="iu-body"><img id="ffp-imgup-img" alt=""></div>',
      '<div class="iu-footer"><button class="iu-btn" onclick="window.FFPUpload._close()">Cancel</button>',
      '<button id="ffp-imgup-save" class="iu-btn iu-btn-primary" onclick="window.FFPUpload._save()">Save</button></div>'
    ].join('\n');
    document.body.appendChild(modal);
  }

  function openCrop(dataUrl) {
    ensureModal();
    var modal = document.getElementById('ffp-imgup-modal');
    var img = document.getElementById('ffp-imgup-img');
    var titleEl = document.getElementById('ffp-imgup-title');
    if (titleEl && pending && pending.title) titleEl.textContent = pending.title;
    if (window.Cropper) {
      img.onload = function () {
        if (cropper) { cropper.destroy(); cropper = null; }
        cropper = new Cropper(img, {
          aspectRatio: (pending && pending.aspect) || NaN,
          viewMode: 1, autoCropArea: 0.9, dragMode: 'move',
          background: false, zoomable: true, wheelZoomRatio: 0.15, guides: false
        });
      };
      img.src = dataUrl;
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    } else {
      // No Cropper on this page → skip crop, resize the raw image directly
      finish(dataUrl);
    }
  }

  function closeModal() {
    var modal = document.getElementById('ffp-imgup-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    if (cropper) { cropper.destroy(); cropper = null; }
  }

  async function saveCrop() {
    if (!pending) return;
    var btn = document.getElementById('ffp-imgup-save');
    var orig = btn ? btn.textContent : '';
    if (btn) { btn.textContent = 'Uploading…'; btn.disabled = true; }
    try {
      if (!cropper) throw new Error('Crop not ready — close and try again');
      var canvas = cropper.getCroppedCanvas({
        width: pending.outW, height: pending.outH,
        imageSmoothingEnabled: true, imageSmoothingQuality: 'high', fillColor: '#0f1e2e'
      });
      if (!canvas) throw new Error('Could not read the crop area');
      // Get the JPEG blob DIRECTLY off the cropped canvas — no dataURL round-trip (that re-decode
      // could stall and leave the upload hanging, which looked like "crop won't save").
      var blob = await new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('Could not create the image')); }, 'image/jpeg', 0.85);
      });
      await uploadAndDone(blob);
      closeModal();
    } catch (e) {
      if (btn) { btn.textContent = orig; btn.disabled = false; }
      if (pending && pending.onError) pending.onError(e);
      else alert('Upload failed: ' + (e.message || 'unknown error'));
    }
  }

  async function uploadAndDone(blob) {
    if (!blob) throw new Error('Could not create the image');
    if (blob.size > 3 * 1024 * 1024) throw new Error('Image too large after compression — try a smaller one.');
    var url = await uploadBlob(pending.bucket, pending.key, blob);
    if (pending.onDone) pending.onDone(url);
  }

  // No-crop fallback (only used when Cropper.js isn't on the page): resize the raw image, then upload.
  async function finish(dataUrl) {
    var blob = await resizeToBlob(dataUrl, pending.outW, pending.outH);
    await uploadAndDone(blob);
  }

  function handleFile(file) {
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) { alert('Please pick a JPEG, PNG, or WebP image.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('Image too large. Pick one under 10MB.'); return; }
    var reader = new FileReader();
    reader.onload = function (ev) { openCrop(ev.target.result); };
    reader.onerror = function () { alert('Could not read that file.'); };
    reader.readAsDataURL(file);
  }

  // ── High-level entry: open picker for a given target ──
  function pick(opts) {
    opts = opts || {};
    if (!opts.bucket || !opts.key) { (opts.onError || function () {})(new Error('bucket and key required')); return; }
    if (!ownerId()) { (opts.onError || function (e) { alert(e.message); })(new Error('Please sign in again')); return; }
    pending = {
      bucket: opts.bucket, key: String(opts.key),
      aspect: opts.aspect || NaN,
      outW: opts.outW || 800, outH: opts.outH || 800,
      title: opts.title || 'Crop image',
      onDone: opts.onDone, onError: opts.onError
    };
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
    input.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) handleFile(f);
      if (e.target.parentNode) e.target.parentNode.removeChild(e.target);
    });
    document.body.appendChild(input);
    input.click();
  }

  // ── Crop a file the caller already has (e.g. from drag-drop) — opens the crop modal ──
  function cropFile(file, opts) {
    opts = opts || {};
    if (!opts.bucket || !opts.key) { (opts.onError || function () {})(new Error('bucket and key required')); return; }
    if (!ownerId()) { (opts.onError || function (e) { alert(e.message); })(new Error('Please sign in again')); return; }
    if (!file || !/^image\//.test(file.type || '')) { (opts.onError || function () {})(new Error('Please pick an image')); return; }
    pending = {
      bucket: opts.bucket, key: String(opts.key), aspect: opts.aspect || NaN,
      outW: opts.outW || 800, outH: opts.outH || 800, title: opts.title || 'Crop image',
      onDone: opts.onDone, onError: opts.onError
    };
    handleFile(file);
  }

  window.FFPUpload = {
    pick: pick,
    cropFile: cropFile,
    uploadFile: uploadFile,
    uploadBlob: uploadBlob,
    _close: closeModal,
    _save: saveCrop
  };
})();
