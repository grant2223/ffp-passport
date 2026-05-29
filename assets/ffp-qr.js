/* FFP Identity QR — v1 (2026-05-29)
   Replaces the dashboard's inline renderQR() (which drew a FAKE 21x21
   random pattern that looked QR-shaped but was unscannable) with a
   real scannable QR encoding the member's verification URL:
       https://ffppassport.com/verify.html?p={passport_no}

   When a provider scans this at a venue, the URL opens a public
   verification page showing the member's name, status (active/
   expired/suspended), photo, and tier — so the provider can confirm
   the person presenting the passport is a legitimate active member.

   Library: qrcode.js (davidshimjs), loaded via cdnjs. Tiny (~5KB),
   well-supported, renders into a canvas or table inside the target
   element. We use error-correction level M (15% recovery) which
   stays scannable even if part of the code is obscured by display
   glare or smudges, while keeping the module count low enough for
   clean rendering at small sizes.

   Prereqs loaded BEFORE this script in the dashboard head:
     <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
*/
(function () {
  'use strict';

  var VERIFY_BASE = 'https://ffppassport.com/verify.html';
  var qrInstance  = null;

  function whenReady(check, cb, retries) {
    retries = retries || 0;
    if (check()) { cb(); return; }
    if (retries > 60) {
      console.warn('[FFP QR v1] Gave up waiting for dependencies after 60 retries');
      return;
    }
    setTimeout(function () { whenReady(check, cb, retries + 1); }, 100);
  }

  whenReady(
    function () {
      // MemberProfile is const-scoped (not on window), so check via typeof.
      // QRCode is the qrcode.js global.
      return (typeof memberPassport !== 'undefined')
          && (typeof renderQR        === 'function')
          && (typeof QRCode          !== 'undefined');
    },
    init
  );

  function init() {
    // Override the dashboard's fake renderQR with a real scannable one.
    window.renderQR = generateRealQR;
    // Trigger an immediate render in case the passport card already
    // mounted with the fake QR.
    generateRealQR();
    console.log('[FFP QR v1] Loaded — real scannable QR encoding verify URL');
  }

  function generateRealQR() {
    var target = document.getElementById('pass-qr');
    if (!target) return;

    // Pull the current passport number — guard against empty/blank.
    var passNo = (typeof memberPassport !== 'undefined' && memberPassport.passportNumber)
                 ? String(memberPassport.passportNumber).trim()
                 : '';

    if (!passNo) {
      // No passport number yet (probably mid-init) — clear the slot and bail.
      target.innerHTML = '';
      return;
    }

    var verifyUrl = VERIFY_BASE + '?p=' + encodeURIComponent(passNo);

    // Wipe any previous QR (qrcode.js appends, doesn't replace).
    target.innerHTML = '';

    try {
      qrInstance = new QRCode(target, {
        text:        verifyUrl,
        width:       100,
        height:      100,
        colorDark:   '#1a2937',          // matches existing pass-card ink color
        colorLight:  '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });

      // qrcode.js renders both an <img> and a <canvas> inside the target.
      // The <img> is a fallback for older browsers — modern ones use the
      // canvas. Force the canvas to scale cleanly to the slot.
      var canvas = target.querySelector('canvas');
      if (canvas) {
        canvas.style.width  = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
      }
      var img = target.querySelector('img');
      if (img) {
        img.style.width  = '100%';
        img.style.height = '100%';
        img.style.display = 'block';
      }
    } catch (e) {
      console.error('[FFP QR v1] generate failed:', e);
      target.innerHTML = '';
    }
  }

  // Expose for debug / manual regeneration if needed.
  window.FFPQR = {
    regenerate: generateRealQR
  };
})();
