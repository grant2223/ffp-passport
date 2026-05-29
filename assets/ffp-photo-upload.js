/* FFP Photo Upload — v2 (2026-05-29)
   v2: Switch from square crop to OFFICIAL PASSPORT RATIO 35:45 (35mm x
       45mm — the actual government passport photo standard, which is
       also what the dashboard's .pass-photo-new slot uses via
       aspect-ratio:35/45). One uploaded photo serves both displays:
         - Passport card: full 35:45 photo fills the slot perfectly.
         - Profile avatar circle: same photo, background-position:top
           center so the face shows when masked to a circle.
       Output canvas bumped to 700x900 (20x the mm dimensions) so the
       photo stays crisp on retina screens at any zoom level.

   Profile photo upload + crop + resize + Supabase Storage upload.
   - Mobile-first: native file picker (camera or library) on phone.
   - Touch-friendly Cropper.js for the square-crop step.
   - Client-side resize to max 1024x1024 + JPEG 85% so even a 10MB
     phone shot ships as ~200-400KB.
   - Upload path: avatars/{member.id}.jpg  (RLS-checked: auth.uid()
     must match the first path segment, which our JWT bridge sets to
     member.id).
   - After upload, PUTs the public URL to /api/members/:id so the
     dashboard's existing photo_url field reflects it on next load,
     and updates localStorage.ffp_member immediately so the live UI
     refreshes without reload.

   Prerequisites loaded BEFORE this script:
     <link href="https://cdn.jsdelivr.net/npm/cropperjs@1.6.1/dist/cropper.min.css" rel="stylesheet">
     <script src="https://cdn.jsdelivr.net/npm/cropperjs@1.6.1/dist/cropper.min.js"></script>
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="assets/ffp-api-integration.js"></script>   (v9+, JWT bridge)
*/
(function () {
  'use strict';

  var API_BASE = 'https://ffp-passport-backend.vercel.app';
  var BUCKET   = 'avatars';
  var cropper  = null;

  // ─── Wait for MemberProfile, supabase client, and FFPAuth to all be ready ───
  function whenReady(check, cb, retries) {
    retries = retries || 0;
    if (check()) { cb(); return; }
    if (retries > 60) {
      console.warn('[FFP Photo Upload v1] Gave up waiting for dependencies after 60 retries');
      return;
    }
    setTimeout(function () { whenReady(check, cb, retries + 1); }, 100);
  }

  whenReady(
    function () {
      return window.MemberProfile && window.supabase && window.FFPAuth && window.Cropper;
    },
    init
  );

  function init() {
    // Override the dashboard's existing stub:
    //   changeAvatar() { alert('Change avatar — wires up to image upload when built.'); }
    window.MemberProfile.changeAvatar = openPicker;

    // Make the passport card photo clickable too — same flow.
    var passPhoto = document.querySelector('[data-field="photo"]');
    if (passPhoto) {
      passPhoto.style.cursor = 'pointer';
      passPhoto.title = 'Tap to change photo';
      passPhoto.addEventListener('click', openPicker);
    }

    // Apply any existing photo_url to the displays on first paint.
    var m = window.FFPAuth.getMember();
    if (m && m.photo_url) applyPhotoToDisplays(m.photo_url);

    // Desktop drag-drop onto the profile avatar (5% of users).
    setupAvatarDragDrop();

    console.log('[FFP Photo Upload v1] Loaded — profile photo upload + crop ready');
  }

  // ─── Open native file picker (camera or library on mobile) ───────────
  function openPicker() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';           // Mobile shows native chooser
    input.style.display = 'none';
    input.addEventListener('change', onFilePicked);
    document.body.appendChild(input);
    input.click();
  }

  function onFilePicked(e) {
    var file = e && e.target && e.target.files && e.target.files[0];
    if (!file) return;
    handleFile(file);
    // Clean up the throwaway input
    if (e.target.parentNode) e.target.parentNode.removeChild(e.target);
  }

  function handleFile(file) {
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
      alert('Please pick a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Image too large. Pick one under 10MB.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (ev) { openCropModal(ev.target.result); };
    reader.onerror = function () { alert('Could not read that file.'); };
    reader.readAsDataURL(file);
  }

  // ─── Crop modal (built once, reused) ─────────────────────────────────
  function ensureModal() {
    if (document.getElementById('ffp-photo-modal')) return;

    var style = document.createElement('style');
    style.id = 'ffp-photo-upload-styles';
    style.textContent = [
      '#ffp-photo-modal { display:none; position:fixed; inset:0; background:rgba(8,20,32,0.96); z-index:9999; flex-direction:column; }',
      '#ffp-photo-modal.open { display:flex; }',
      '#ffp-photo-modal .pm-header { padding:14px 18px; border-bottom:1px solid rgba(43,168,224,0.2); display:flex; justify-content:space-between; align-items:center; color:#fff; }',
      '#ffp-photo-modal .pm-title { font-size:16px; font-weight:700; letter-spacing:0.3px; }',
      '#ffp-photo-modal .pm-close { background:transparent; border:none; color:#fff; font-size:28px; cursor:pointer; padding:0 8px; line-height:1; }',
      '#ffp-photo-modal .pm-body { flex:1; display:flex; align-items:center; justify-content:center; padding:16px; overflow:hidden; min-height:0; }',
      '#ffp-photo-modal .pm-img-wrap { max-width:100%; max-height:100%; }',
      '#ffp-photo-cropper-img { display:block; max-width:100%; max-height:60vh; }',
      '#ffp-photo-modal .pm-footer { padding:14px 18px; border-top:1px solid rgba(43,168,224,0.2); display:flex; gap:10px; justify-content:flex-end; }',
      '#ffp-photo-modal .pm-btn { padding:11px 22px; border-radius:8px; border:1px solid rgba(43,168,224,0.4); background:transparent; color:#fff; font-size:14px; font-weight:600; cursor:pointer; min-width:96px; }',
      '#ffp-photo-modal .pm-btn-primary { background:#2ba8e0; border-color:#2ba8e0; }',
      '#ffp-photo-modal .pm-btn:disabled { opacity:0.55; cursor:not-allowed; }',
      '#ffp-photo-modal .pm-hint { color:#9dbdd0; font-size:12px; padding:0 18px 8px; }',
      '@media (max-width: 600px) {',
      '  #ffp-photo-modal .pm-body { padding:8px; }',
      '  #ffp-photo-cropper-img { max-height:70vh; }',
      '  #ffp-photo-modal .pm-btn { flex:1; min-width:0; }',
      '}'
    ].join('\n');
    document.head.appendChild(style);

    var modal = document.createElement('div');
    modal.id = 'ffp-photo-modal';
    modal.innerHTML = [
      '<div class="pm-header">',
      '  <div class="pm-title">Crop Your Photo</div>',
      '  <button class="pm-close" aria-label="Close" onclick="window.FFPPhotoUpload.close()">&times;</button>',
      '</div>',
      '<div class="pm-hint">Drag to reposition · pinch to zoom · 35:45 passport crop fits your passport card + avatar</div>',
      '<div class="pm-body">',
      '  <div class="pm-img-wrap">',
      '    <img id="ffp-photo-cropper-img" alt="">',
      '  </div>',
      '</div>',
      '<div class="pm-footer">',
      '  <button class="pm-btn" onclick="window.FFPPhotoUpload.close()">Cancel</button>',
      '  <button id="ffp-photo-save-btn" class="pm-btn pm-btn-primary" onclick="window.FFPPhotoUpload.save()">Save</button>',
      '</div>'
    ].join('\n');
    document.body.appendChild(modal);
  }

  function openCropModal(imageDataUrl) {
    ensureModal();
    var modal = document.getElementById('ffp-photo-modal');
    var img   = document.getElementById('ffp-photo-cropper-img');

    // Cropper needs the image to be loaded before init.
    img.onload = function () {
      if (cropper) { cropper.destroy(); cropper = null; }
      cropper = new Cropper(img, {
        aspectRatio: 35 / 45,                 // OFFICIAL passport ratio — matches .pass-photo-new
        viewMode: 1,
        autoCropArea: 0.9,
        dragMode: 'move',
        cropBoxResizable: true,
        cropBoxMovable: true,
        toggleDragModeOnDblclick: false,
        background: false,
        zoomable: true,
        wheelZoomRatio: 0.15,
        modal: true,
        guides: false
      });
    };
    img.src = imageDataUrl;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCropModal() {
    var modal = document.getElementById('ffp-photo-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    if (cropper) { cropper.destroy(); cropper = null; }
  }

  // ─── Save: crop → resize → upload → PUT photo_url → refresh UI ────────
  async function saveCroppedPhoto() {
    if (!cropper) return;

    var member = window.FFPAuth.getMember();
    if (!member || !member.id) {
      alert('Sign in required.');
      return;
    }

    var btn      = document.getElementById('ffp-photo-save-btn');
    var origText = btn.textContent;
    btn.textContent = 'Uploading…';
    btn.disabled   = true;

    try {
      // Crop + resize to 700x900 (20x the official 35x45mm dimensions —
      // crisp on retina even at full passport-card display size).
      var canvas = cropper.getCroppedCanvas({
        width:  700,
        height: 900,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
        fillColor: '#0f5a7a'
      });

      // JPEG 85% — best size/quality balance for portraits
      var blob = await new Promise(function (resolve) {
        canvas.toBlob(resolve, 'image/jpeg', 0.85);
      });

      if (!blob) throw new Error('Could not create JPEG from crop');
      if (blob.size > 2 * 1024 * 1024) {
        throw new Error('Compressed image is over 2MB — try a smaller original.');
      }

      // Upload to Supabase Storage at avatars/{member.id}.jpg (upsert)
      var path = member.id + '.jpg';
      var up = await window.supabase.storage
        .from(BUCKET)
        .upload(path, blob, {
          contentType: 'image/jpeg',
          upsert:      true,
          cacheControl: '3600'
        });
      if (up.error) throw up.error;

      // Resolve the canonical public URL
      var publicUrl = window.supabase.storage
        .from(BUCKET)
        .getPublicUrl(path).data.publicUrl;

      // Persist photo_url to members table via existing PUT endpoint
      var token = window.FFPAuth.getToken();
      var apiRes = await fetch(API_BASE + '/api/members/' + member.id, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? 'Bearer ' + token : ''
        },
        body: JSON.stringify({ photo_url: publicUrl })
      });
      var apiData = await apiRes.json();
      if (!apiRes.ok || !apiData.success) {
        throw new Error((apiData && apiData.error) || ('HTTP ' + apiRes.status));
      }

      // Update localStorage so reloads + other tabs see the new photo
      member.photo_url = publicUrl;
      window.FFPAuth.setMember(member);

      // Immediate visual refresh (cache-buster so the upserted file
      // isn't served from browser cache)
      applyPhotoToDisplays(publicUrl + '?t=' + Date.now());

      closeCropModal();
      console.log('[FFP Photo Upload v1] Saved →', publicUrl);
    } catch (e) {
      console.error('[FFP Photo Upload v1] Upload failed:', e);
      alert('Upload failed: ' + (e.message || 'unknown error'));
      btn.textContent = origText;
      btn.disabled   = false;
    }
  }

  // ─── Refresh photo on passport card + profile header ─────────────────
  function applyPhotoToDisplays(url) {
    // Passport card photo (background-image div)
    var passPhoto = document.querySelector('[data-field="photo"]');
    if (passPhoto) {
      passPhoto.style.backgroundImage    = 'url("' + url + '")';
      passPhoto.style.backgroundSize     = 'cover';
      passPhoto.style.backgroundPosition = 'center';
      var initials = passPhoto.querySelector('[data-field="initials"]');
      if (initials) initials.style.display = 'none';
    }

    // Profile header avatar — same photo, but show the TOP portion when
    // the 35:45 portrait is masked into a circle (face is at the top of
    // a proper passport-style photo, so we anchor to top center).
    var avatar = document.querySelector('.ph-avatar');
    if (avatar) {
      avatar.style.backgroundImage    = 'url("' + url + '")';
      avatar.style.backgroundSize     = 'cover';
      avatar.style.backgroundPosition = 'top center';   // v2: face-up anchor
      // Clear the text initials (keep the edit-photo button child)
      Array.from(avatar.childNodes).forEach(function (n) {
        if (n.nodeType === 3) n.nodeValue = '';
      });
    }
  }

  // ─── Desktop drag-drop on the profile avatar ─────────────────────────
  function setupAvatarDragDrop() {
    var attempts = 0;
    function attach() {
      var avatar = document.querySelector('.ph-avatar');
      if (!avatar) {
        if (++attempts < 30) setTimeout(attach, 300);
        return;
      }
      avatar.addEventListener('dragover', function (e) {
        e.preventDefault();
        avatar.style.outline = '2px dashed #2ba8e0';
      });
      avatar.addEventListener('dragleave', function () {
        avatar.style.outline = '';
      });
      avatar.addEventListener('drop', function (e) {
        e.preventDefault();
        avatar.style.outline = '';
        var files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length) handleFile(files[0]);
      });
    }
    attach();
  }

  // Expose for inline onclick handlers in the modal
  window.FFPPhotoUpload = {
    open:  openPicker,
    close: closeCropModal,
    save:  saveCroppedPhoto
  };
})();
