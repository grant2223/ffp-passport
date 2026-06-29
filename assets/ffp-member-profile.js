// FFP Member — PROFILE EDITOR module. Extracted from ffp-member-dashboard.html (Module 3, build 485).
// Defines window.MemberProfile (profile panel data + editor). Loaded via <script defer> so it is defined
// BEFORE the boot init() (registered on DOMContentLoaded). Boot calls are guarded. No behaviour change — verbatim move.
// Depends on shared globals: Picker/openPicker, NATIONALITY_ISO, FFPLocPick, FFPSelect, openModalShell, showToast, FFPAuth.
window.MemberProfile = {
  data: {
    // Identity (shared with passport card)
    givenNames: '',
    surname: '',
    photo: '',          // data URL or remote URL for the passport photo
    
    // Contact
    email: '',
    phoneCountryCode: '',
    phoneNumber: '',
    
    // DOB
    dobDay: '',
    dobMonth: '',
    dobYear: '',
    
    gender: '',
    height: '',   // cm — set-once physical attribute (drives waist-to-height + muscle index)

    // Location
    country: '',  // where you LIVE
    city: '',
    nationality: '',     // passport country (demonym)
    
    // Account meta
    tier: '',
    memberSince: '',
    passportNumber: '',
    issueDate: '',
    expiryDate: '',
    hasPin: false,
    
    // VERIFICATION (admin-set in production — read-only on this profile)
    //   verified            : true once admin confirms this is a real person
    //   professional.roles  : array of { role, verified }
    //                         Each role independently verified by admin.
    //                         null/empty → not a professional profile
    verified: false,
    professional: {
      roles: []
    },
    
    sports: [],
    
    preferences: {
      notifications: false,
      newsletter: false,
      publicProfile: false,
      hideDob: false        // v164: hide Date of Birth on the passport card
    }
  },
  
  // ===== HELPERS =====
  escape(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  },
  
  getInitials() {
    const g = (this.data.givenNames || '').trim().charAt(0).toUpperCase();
    const s = (this.data.surname || '').trim().charAt(0).toUpperCase();
    return (g + s) || 'M';
  },
  
  getFullName() {
    return `${this.data.givenNames} ${this.data.surname}`.trim();
  },
  
  formatDOB() {
    const m = MONTHS.find(x => x.num === this.data.dobMonth);
    return `${this.data.dobDay || ''} ${m ? m.short : ''} ${this.data.dobYear || ''}`.trim();
  },
  
  dobAsISO() {
    if (!this.data.dobYear || !this.data.dobMonth || !this.data.dobDay) return '';
    return `${this.data.dobYear}-${this.data.dobMonth}-${this.data.dobDay.padStart(2,'0')}`;
  },
  
  dobMaxDate() {
    const t = new Date(); t.setFullYear(t.getFullYear() - 13);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  },
  
  // Render the Verified badge in the profile header — ONLY if the member is
  // actually admin-verified. No professional role badges here (those live in the
  // Professional Profile section). No fallback "Member" badge.
  renderBadges() {
    if (!this.data.verified) return '';
    return `<span class="ph-badge ph-badge-verified">
      <span class="material-icons">verified</span>Verified
    </span>`;
  },
  
  // Render the Professional Profile section.
  // - If no roles: prompt to add one
  // - If 1+ roles: list each as its own card with a remove X
  //   Each role has its own verified status (admin-set per role).
  //   "Add role" button to declare another. To clear all roles, pick
  //   "Non-professional" from the picker — no separate clear link.
  renderProfessionalCard() {
    const roles = (this.data.professional && this.data.professional.roles) || [];
    
    if (roles.length === 0) {
      return `
        <div class="security-card field-card-picker" onclick="MemberProfile.openRolePicker()">
          <div class="security-card-info">
            <div class="security-card-label">Non-professional member</div>
            <div class="security-card-status">Tap to add a professional role (Powerlifting Coach, Nutritionist, etc.)</div>
          </div>
          <span class="material-icons pt-chevron">arrow_drop_down</span>
        </div>
      `;
    }
    
    const roleCards = roles.map((r, i) => {
      const statusText = r.verified ? 'Verified by FFP admin' : 'Pending verification';
      const statusCls  = r.verified ? 'set' : '';
      return `
        <div class="security-card" style="position:relative;">
          <div class="security-card-info" style="padding-right:24px;">
            <div class="security-card-label">${this.escape(r.role)}</div>
            <div class="security-card-status ${statusCls}">${statusText}</div>
          </div>
          <button class="role-remove" data-role-index="${i}" aria-label="Remove ${this.escape(r.role)}" title="Remove">
            <span class="material-icons">close</span>
          </button>
        </div>
      `;
    }).join('');
    
    return `
      <div class="role-list">${roleCards}</div>
      <button class="role-add-btn" onclick="MemberProfile.openRolePicker()">
        <span class="material-icons">add_circle</span>
        Add another role
      </button>
    `;
  },
  
  // =====================================================================
  // SYNC TO PASSPORT CARD
  // Profile data → memberPassport object → applyPassportData() + renderQR()
  // Called after every profile data change so the passport card reflects edits.
  // =====================================================================
  syncToPassport() {
    if (typeof memberPassport === 'undefined') return;
    memberPassport.surname        = this.data.surname.toUpperCase();
    memberPassport.givenNames     = this.data.givenNames.toUpperCase();
    memberPassport.initials       = this.getInitials();
    memberPassport.nationality    = this.data.nationality.toUpperCase();
    memberPassport.countryCode    = NATIONALITY_ISO[this.data.nationality] || 'XXX';
    memberPassport.gender         = this.data.gender.toUpperCase();
    memberPassport.genderCode     = (this.data.gender.charAt(0) || 'X').toUpperCase();
    memberPassport.dob            = this.formatDOB();
    memberPassport.dobMRZ         = (this.data.dobYear || '').slice(2) + (this.data.dobMonth || '') + (this.data.dobDay || '').padStart(2,'0');
    memberPassport.issueDate      = this.data.issueDate;
    memberPassport.expiryDate     = this.data.expiryDate;
    memberPassport.passportNumber = this.data.passportNumber;
    // v103: TYPE shows as single letter — M / S / A (Member / Supporter / Ambassador).
    // Any unknown / blank tier defaults to 'M'.
    var t = (this.data.tier || 'Member').toString().trim().toLowerCase();
    memberPassport.type = (t === 'supporter') ? 'S' : (t === 'ambassador') ? 'A' : 'M';
    memberPassport.passportCountry = this.data.country || '—';                     // v104: member's listed country
    memberPassport.photo           = this.data.photo || '';                        // v162
    
    if (typeof applyPassportData === 'function') applyPassportData();
    if (typeof renderQR === 'function')          renderQR();
    // Refresh the passport card BACK so skill/level/grade edits show immediately (it reads live profile skills).
    if (typeof ffpRenderSelfBack === 'function') ffpRenderSelfBack();
  },
  
  // ===== RENDER =====
  render() {
    const body = document.getElementById('profile-body');
    if (!body) return;
    const d = this.data;
    
    body.innerHTML = `
      <div class="profile-menu">
        <!-- HEADER -->
        <div class="profile-header">
          <div class="ph-avatar"${this.data.photo ? ` style="background-image:url('${this.data.photo}');background-size:cover;background-position:center;color:transparent;"` : ''}>
            ${this.data.photo ? '' : this.getInitials()}
            <button class="ph-avatar-edit" onclick="MemberProfile.changeAvatar()" title="Change photo">
              <span class="material-icons">photo_camera</span>
            </button>
          </div>
          <div class="ph-info">
            <div class="ph-name">${this.escape(this.getFullName())}</div>
            ${this.renderBadges() ? `<div class="ph-badges">${this.renderBadges()}</div>` : ''}
            <div class="ph-meta">Member since ${this.escape(d.memberSince)} &middot; ${this.escape(d.passportNumber)}</div>
          </div>
        </div>

        <!-- PERSONAL INFORMATION
             Order: Name (2-col) | Email (full) | Phone (full) | DOB+Gender (2-col)
             Names sync into the passport card surname / given names. -->
        <div class="profile-section-title">Personal Information</div>
        <div class="fields-grid">
          ${this.renderTextCard('givenNames', 'Given Names', d.givenNames)}
          ${this.renderTextCard('surname',    'Surname',     d.surname)}
        </div>
        <div class="fields-grid" style="margin-top:10px;">
          ${this.renderEmailCard()}
          ${this.renderPhoneCard()}
        </div>
        <div style="margin-top:8px;">
          <button type="button" onclick="var p=document.getElementById('mp-contact-priv');if(p)p.style.display=(p.style.display==='none'||!p.style.display)?'block':'none';" style="background:none;border:none;color:#2ba8e0;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;padding:0;"><span class="material-icons" style="font-size:16px;">info</span> Why we ask for your email &amp; phone</button>
          <div id="mp-contact-priv" style="display:none;font-size:11.5px;line-height:1.5;color:#6b8298;background:rgba(43,168,224,.08);border:1px solid rgba(43,168,224,.22);border-radius:10px;padding:9px 11px;margin-top:6px;">Your email and phone number are used only to verify your account and send you essential notifications. They are never shown on your Passport, made public, or shared with other members or partners without your consent.</div>
        </div>
        <div class="fields-grid" style="margin-top:10px;">
          ${this.renderDOBCard()}
          ${this.renderPickerCard('gender', 'Gender', d.gender)}
        </div>
        <div class="fields-grid" style="margin-top:10px;">
          ${this.renderPickerCard('height', 'Height', d.height ? d.height + ' cm' : '')}
        </div>

        <!-- LOCATION — Country + City on one row (2-col), Nationality on its own row -->
        <div class="profile-section-title">Location</div>
        <div class="fields-grid">
          ${this.renderLocationCard(d)}
        </div>
        <div class="fields-grid" style="margin-top:10px;">
          ${this.renderPickerCard('nationality', 'Nationality', d.nationality, true)}
        </div>

        <!-- Auto-save: every change saves automatically; this line shows status -->
        <div style="margin-top:18px;text-align:center;">
          <div id="profile-save-status" style="font-size:12px;color:#6b8298;min-height:18px;">Changes save automatically</div>
        </div>

        <!-- Connected devices + Google Calendar moved to avatar menu › Settings › Connected apps -->

        <!-- PROFESSIONAL PROFILE — member self-declares role; admin verifies separately -->
        <div class="profile-section-title">Professional Profile</div>
        ${this.renderProfessionalCard()}

        <!-- SKILLS & LEVELS — used by Meet & Move for matching -->
        <div class="profile-section-title">
          Skills &amp; Levels
          <button class="section-action" onclick="MemberProfile.addSportFlow()">
            <span class="material-icons">add_circle</span>
            Add skill
          </button>
        </div>
        <div class="sports-grid">
          ${d.sports.length === 0
            ? '<div style="color:var(--muted); font-size:12px; padding:12px;">No skills added yet. Tap &quot;Add skill&quot; to start.</div>'
            : d.sports.map((s, i) => `
              <div class="sport-card">
                <button class="sport-card-remove"
                        data-skill-index="${i}"
                        aria-label="Remove ${this.escape(s.name)}"
                        title="Remove ${this.escape(s.name)}">
                  <span class="material-icons">close</span>
                </button>
                <div class="sport-card-name">${this.escape(s.name)}</div>
                <div class="sport-card-level" onclick="MemberProfile.editSportLevel(${i})" style="cursor:pointer;" title="Tap to change level">${this.escape(s.level)} <span class="material-icons" style="font-size:13px;vertical-align:-2px;opacity:.55;">edit</span></div>
                <input class="field-card-input-flat sport-card-grade" type="text"
                       value="${this.escape(s.grade || '')}"
                       placeholder="Grade — e.g. 5:30 pace, 17, B grade"
                       onclick="event.stopPropagation()"
                       onchange="MemberProfile.setSportGrade(${i}, this.value)">
              </div>
            `).join('')}
        </div>

        <!-- PREFERENCES -->
        <div class="profile-section-title">Preferences</div>
        <div class="profile-preferences">
          <label class="pref-toggle">
            <span>Weekly Newsletter</span>
            <input type="checkbox" ${d.preferences.newsletter ? 'checked' : ''} onchange="MemberProfile.setPref('newsletter', this.checked)">
          </label>
          <label class="pref-toggle">
            <span>Public Profile (Connections)</span>
            <input type="checkbox" ${d.preferences.publicProfile ? 'checked' : ''} onchange="MemberProfile.setPref('publicProfile', this.checked)">
          </label>
          <label class="pref-toggle">
            <span>Hide date of birth on passport</span>
            <input type="checkbox" ${d.preferences.hideDob ? 'checked' : ''} onchange="MemberProfile.setPref('hideDob', this.checked)">
          </label>
        </div>
      </div>
    `;
    
    // Keep passport card in sync after every render
    this.syncToPassport();
    
    // Wire role-remove buttons (event delegation, since they appear/disappear)
    document.querySelectorAll('.role-remove[data-role-index]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = parseInt(btn.getAttribute('data-role-index'), 10);
        if (!isNaN(i)) MemberProfile.removeRole(i);
      });
    });
    
    // Wire skill-remove buttons (no confirm — just removes, easy to re-add from picker)
    document.querySelectorAll('.sport-card-remove[data-skill-index]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = parseInt(btn.getAttribute('data-skill-index'), 10);
        if (!isNaN(i)) MemberProfile.removeSport(i);
      });
    });
  },
  
  // ===== CARD RENDERERS =====
  
  // Generic text field — flat input that looks like display text, edits on focus
  renderTextCard(field, label, value, autocomplete) {
    return `
      <div class="field-card">
        <div class="field-card-label-top">${label}</div>
        <input type="text"
               class="field-card-input-flat"
               value="${this.escape(value)}"
               autocomplete="${autocomplete || 'off'}"
               oninput="MemberProfile.data['${field}'] = this.value"
               onblur="MemberProfile.commit('${field}', this.value)"
               onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">
      </div>
    `;
  },
  
  renderEmailCard() {
    var ver = this.data.verified
      ? '<div style="display:flex;align-items:center;gap:5px;margin-top:7px;font-size:11.5px;font-weight:700;color:#4ade80;"><span class="material-icons" style="font-size:15px;">verified</span>Verified</div>'
      : '<div style="display:flex;align-items:center;gap:5px;margin-top:7px;font-size:11.5px;font-weight:700;color:var(--muted);"><span class="material-icons" style="font-size:15px;">schedule</span>Not yet verified — sign in with an email code to verify</div>';
    return `
      <div class="field-card full-width">
        <div class="field-card-label-top">Email</div>
        <input type="email"
               class="field-card-input-flat"
               value="${this.escape(this.data.email)}"
               autocomplete="email"
               inputmode="email"
               placeholder="your@email.com"
               oninput="MemberProfile.data.email = this.value"
               onblur="MemberProfile.commit('email', this.value)"
               onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">
        ${ver}
      </div>
    `;
  },
  
  renderPhoneCard() {
    // Default the country code to UAE (+971) so the phone always carries a code.
    if (!this.data.phoneCountryCode) this.data.phoneCountryCode = '+971';
    return `
      <div class="field-card full-width field-card-phone">
        <div class="field-card-label-top">Phone</div>
        <div class="field-card-row">
          <button class="phone-cc" onclick="MemberProfile.pickPhoneCC()">
            <span>${this.escape(this.phoneCcDisplay())}</span>
            <span class="material-icons">arrow_drop_down</span>
          </button>
          <input type="tel"
                 class="field-card-input-flat phone-num"
                 value="${this.escape(this.data.phoneNumber)}"
                 autocomplete="tel-national"
                 inputmode="tel"
                 placeholder="5x xxx xxxx"
                 oninput="MemberProfile.data.phoneNumber = this.value"
                 onblur="MemberProfile.commit('phoneNumber', this.value)"
                 onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">
        </div>
      </div>
    `;
  },
  
  renderDOBCard() {
    // v101: 3 dropdowns (Day/Month/Year) instead of native date input — mirrors
    // profile-complete v11. Direct writes to MemberProfile.data.dob{Day,Month,Year}.
    const d = this.data;
    const dayOpts   = `<option value="01">01</option><option value="02">02</option><option value="03">03</option><option value="04">04</option><option value="05">05</option><option value="06">06</option><option value="07">07</option><option value="08">08</option><option value="09">09</option><option value="10">10</option><option value="11">11</option><option value="12">12</option><option value="13">13</option><option value="14">14</option><option value="15">15</option><option value="16">16</option><option value="17">17</option><option value="18">18</option><option value="19">19</option><option value="20">20</option><option value="21">21</option><option value="22">22</option><option value="23">23</option><option value="24">24</option><option value="25">25</option><option value="26">26</option><option value="27">27</option><option value="28">28</option><option value="29">29</option><option value="30">30</option><option value="31">31</option>`;
    const monthOpts = `<option value="01">JAN</option><option value="02">FEB</option><option value="03">MAR</option><option value="04">APR</option><option value="05">MAY</option><option value="06">JUN</option><option value="07">JUL</option><option value="08">AUG</option><option value="09">SEP</option><option value="10">OCT</option><option value="11">NOV</option><option value="12">DEC</option>`;
    const yearOpts  = `<option value="2010">2010</option><option value="2009">2009</option><option value="2008">2008</option><option value="2007">2007</option><option value="2006">2006</option><option value="2005">2005</option><option value="2004">2004</option><option value="2003">2003</option><option value="2002">2002</option><option value="2001">2001</option><option value="2000">2000</option><option value="1999">1999</option><option value="1998">1998</option><option value="1997">1997</option><option value="1996">1996</option><option value="1995">1995</option><option value="1994">1994</option><option value="1993">1993</option><option value="1992">1992</option><option value="1991">1991</option><option value="1990">1990</option><option value="1989">1989</option><option value="1988">1988</option><option value="1987">1987</option><option value="1986">1986</option><option value="1985">1985</option><option value="1984">1984</option><option value="1983">1983</option><option value="1982">1982</option><option value="1981">1981</option><option value="1980">1980</option><option value="1979">1979</option><option value="1978">1978</option><option value="1977">1977</option><option value="1976">1976</option><option value="1975">1975</option><option value="1974">1974</option><option value="1973">1973</option><option value="1972">1972</option><option value="1971">1971</option><option value="1970">1970</option><option value="1969">1969</option><option value="1968">1968</option><option value="1967">1967</option><option value="1966">1966</option><option value="1965">1965</option><option value="1964">1964</option><option value="1963">1963</option><option value="1962">1962</option><option value="1961">1961</option><option value="1960">1960</option><option value="1959">1959</option><option value="1958">1958</option><option value="1957">1957</option><option value="1956">1956</option><option value="1955">1955</option><option value="1954">1954</option><option value="1953">1953</option><option value="1952">1952</option><option value="1951">1951</option><option value="1950">1950</option><option value="1949">1949</option><option value="1948">1948</option><option value="1947">1947</option><option value="1946">1946</option><option value="1945">1945</option><option value="1944">1944</option><option value="1943">1943</option><option value="1942">1942</option><option value="1941">1941</option><option value="1940">1940</option><option value="1939">1939</option><option value="1938">1938</option><option value="1937">1937</option><option value="1936">1936</option><option value="1935">1935</option><option value="1934">1934</option><option value="1933">1933</option><option value="1932">1932</option><option value="1931">1931</option><option value="1930">1930</option><option value="1929">1929</option><option value="1928">1928</option><option value="1927">1927</option><option value="1926">1926</option><option value="1925">1925</option>`;
    function selected(opts, val) {
      if (!val) return opts;
      return opts.replace(`value="${val}"`, `value="${val}" selected`);
    }
    return `
      <div class="field-card field-card-dob">
        <div class="field-card-label-top">Date of Birth</div>
        <div style="display:grid;grid-template-columns:1fr 1.4fr 1.2fr;gap:6px;margin-top:6px;">
          <select class="field-card-input-flat" onchange="MemberProfile.data.dobDay = this.value; MemberProfile.render(); MemberProfile.autoSave();">
            <option value="">Day</option>${selected(dayOpts, d.dobDay)}
          </select>
          <select class="field-card-input-flat" onchange="MemberProfile.data.dobMonth = this.value; MemberProfile.render(); MemberProfile.autoSave();">
            <option value="">Month</option>${selected(monthOpts, d.dobMonth)}
          </select>
          <select class="field-card-input-flat" onchange="MemberProfile.data.dobYear = this.value; MemberProfile.render(); MemberProfile.autoSave();">
            <option value="">Year</option>${selected(yearOpts, d.dobYear)}
          </select>
        </div>
      </div>
    `;
  },
  
  renderPickerCard(field, label, value, fullWidth) {
    const isEmpty = !value;
    return `
      <div class="field-card field-card-picker${fullWidth ? ' full-width' : ''}" onclick="MemberProfile.openFieldPicker('${field}')">
        <div class="field-card-label-top">${label}</div>
        <div class="field-card-row">
          <span class="field-card-display ${isEmpty ? 'muted' : ''}">${this.escape(value || 'Tap to choose')}</span>
          <span class="material-icons pt-chevron">arrow_drop_down</span>
        </div>
      </div>
    `;
  },

  // v480: WORLD-CLASS LOCATION — one card, the shared Places picker (FFPLocPick). Stores the full
  // structured geocode (country/region/city/area/lat-lng/place_id) so existing members get the same
  // accurate, suburb-level location as new signups. Replaces the old country + city dropdowns.
  renderLocationCard(d) {
    var display = [d.area, d.city, d.region, d.country].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') || (d.location_label || '');
    var isEmpty = !display;
    return `
      <div class="field-card field-card-picker full-width" onclick="MemberProfile.openLocationPicker()">
        <div class="field-card-label-top">Where you're based</div>
        <div class="field-card-row">
          <span class="field-card-display ${isEmpty ? 'muted' : ''}">${this.escape(display || 'Tap to set your location')}</span>
          <span class="material-icons pt-chevron">place</span>
        </div>
      </div>
    `;
  },
  
  // ===== v101: SAVE PROFILE — PUTs all editable fields to backend /api/members/:id =====
  autoSave() {
    clearTimeout(this._saveTimer);
    var statusEl = document.getElementById('profile-save-status');
    if (statusEl) { statusEl.innerHTML = 'Saving\u2026'; statusEl.style.color = '#9dbdd0'; }
    var self = this;
    this._saveTimer = setTimeout(function () { self.saveProfile(); }, 600);
  },

  async saveProfile(btn, opts) {
    const statusEl = (opts && opts.silent) ? null : document.getElementById('profile-save-status');
    if (statusEl) { statusEl.textContent = 'Saving...'; statusEl.style.color = '#9dbdd0'; }
    if (btn) btn.disabled = true;
    try {
      const stored = (function () {
        try { return JSON.parse(localStorage.getItem('ffp_member') || '{}'); } catch (e) { return {}; }
      })();
      if (!stored.id) {
        if (statusEl) { statusEl.textContent = 'Not signed in'; statusEl.style.color = '#ef4444'; }
        if (btn) btn.disabled = false;
        return;
      }
      const d = this.data;
      const dobISO = (d.dobYear && d.dobMonth && d.dobDay) ? (d.dobYear + '-' + d.dobMonth + '-' + d.dobDay) : null;
      const payload = {
        given_names:        d.givenNames || null,
        surname:            d.surname || null,
        full_name:          ((d.givenNames || '') + ' ' + (d.surname || '')).trim() || null,
        email:              d.email || null,
        phone:              d.phoneNumber || null,
        phone_country_code: d.phoneCountryCode || null,
        date_of_birth:      dobISO,
        gender:             d.gender || null,
        height_cm:          d.height ? Number(d.height) : null,
        nationality:        d.nationality || null,
        country:            d.country || null,
        city:               d.city || null,
        region:             d.region || null,
        area:               d.area || null,
        country_code:       d.country_code || null,
        lat:                (d.lat != null && d.lat !== '') ? Number(d.lat) : null,
        lng:                (d.lng != null && d.lng !== '') ? Number(d.lng) : null,
        place_id:           d.place_id || null,
        location_label:     d.location_label || null,
        skills:             Array.isArray(d.sports) ? d.sports : [],
        // Mirror professional into preferences — the backend PUT persists `preferences` (jsonb) but
        // drops a top-level `professional`, so without this the profession is lost on refresh.
        preferences:        Object.assign({}, d.preferences || {}, { professional: (this.data.professional || null) }),
        professional:       (this.data.professional !== undefined ? this.data.professional : null)
      };
      const res = await fetch('https://ffp-passport-backend.vercel.app/api/members/' + stored.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.success) {
        if (statusEl) { statusEl.textContent = 'Save failed: ' + (json.error || 'unknown'); statusEl.style.color = '#ef4444'; }
        if (btn) btn.disabled = false;
        return;
      }
      // Update localStorage with server-confirmed member object so reload reflects saved state
      if (json.member) {
        try { localStorage.setItem('ffp_member', JSON.stringify(json.member)); } catch (e) {}
      }
      // Sync to passport card if it derives from MemberProfile.data
      if (typeof this.syncToPassport === 'function') this.syncToPassport();
      if (typeof applyPassportData === 'function') applyPassportData();
      if (statusEl) { statusEl.textContent = 'Saved \u2713'; statusEl.style.color = '#22c55e'; }
    } catch (e) {
      console.error('[FFP] saveProfile failed:', e);
      if (statusEl) { statusEl.textContent = 'Network error \u2014 try again'; statusEl.style.color = '#ef4444'; }
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  // ===== COMMITS (flat inputs save on blur/Enter) =====
  commit(field, value) {
    const trimmed = (value || '').trim();
    if (!trimmed) { this.render(); return; }    // revert empty
    if (this.data[field] === trimmed) return;   // no change
    this.data[field] = trimmed;
    this.render();
    this.autoSave();
  },
  
  // ===== PHONE COUNTRY CODE =====
  // Uniform phone code display: flag + + + digits (e.g. "🇦🇪 +971"), from shared taxonomy.
  phoneCcDisplay() {
    var cc = this.data.phoneCountryCode || '';
    try { var e = COUNTRY_CODES.find(function (x) { return x.code === cc; }); if (e && e.flag) return e.flag + ' ' + e.code; } catch (err) {}
    return cc;
  },
  pickPhoneCC() {
    // UAE first (primary market), then the rest alphabetically by country name.
    var list = (COUNTRY_CODES || []).slice().sort(function (a, b) {
      if (a.code === '+971') return -1;
      if (b.code === '+971') return 1;
      return (a.country || '').localeCompare(b.country || '');
    });
    openPicker({
      title: 'Country Code',
      searchPlaceholder: 'Search countries or codes...',
      fullBleed: true,   // full-screen modal (matches the platform full-bleed picker standard)
      options: list.map(c => ({ value: c.code, label: (c.flag ? c.flag + ' ' : '') + c.code, sub: c.country })),
      current: this.data.phoneCountryCode,
      onPick: (val) => { this.data.phoneCountryCode = val; this.render(); this.autoSave(); }
    });
  },
  
  // ===== PROFESSIONAL ROLES =====
  // Multiple roles supported. Each has its own admin-set verified flag.
  // Picker always has "Non-professional" as the first option — picking it clears ALL roles.
  // Picking any specific role ADDS it to the array (no duplicates).
  openRolePicker() {
    // Build options: special "Non-professional" entry first, then full taxonomy grouped
    const currentRoles = (this.data.professional && this.data.professional.roles) || [];
    const currentRoleNames = currentRoles.map(r => r.role);
    
    // Wrap the grouped taxonomy with a synthetic "Status" group at the top
    const groupedOptions = { 'Status': ['Non-professional'] };
    Object.keys(FFP_PROFESSIONAL_ROLES).forEach(cat => {
      groupedOptions[cat] = FFP_PROFESSIONAL_ROLES[cat];
    });
    
    openPicker({
      title: 'Profession',
      subtitle: currentRoles.length > 0
        ? 'Pick another profession to add, or "Non-professional" to clear all'
        : 'Pick your profession — admin will verify credentials separately',
      searchPlaceholder: 'Search professions...',
      options: groupedOptions,
      grouped: true,
      fullBleed: true,
      current: null,
      onPick: (val) => {
        if (val === 'Non-professional') {
          // Clear all roles
          this.data.professional = null;
          // PRODUCTION: PATCH /api/members/me { professional: null }
        } else {
          // Add this role if not already present
          if (currentRoleNames.includes(val)) {
            alert(`${val} is already in your professional profile.`);
            return;
          }
          if (!this.data.professional) this.data.professional = { roles: [] };
          this.data.professional.roles.push({ role: val, verified: false });
        }
        this.render();
        this.autoSave();
      }
    });
  },
  
  // Remove a single role by its index in professional.roles
  removeRole(index) {
    if (!this.data.professional || !this.data.professional.roles) return;
    this.data.professional.roles.splice(index, 1);
    if (this.data.professional.roles.length === 0) {
      this.data.professional = null;
    }
    this.render();
    this.autoSave();
  },
  
  // ===== DOB (native date picker) =====
  setDOBFromNative(iso) {
    if (!iso) return;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return;
    this.data.dobYear  = m[1];
    this.data.dobMonth = m[2];
    this.data.dobDay   = m[3];
    this.render();
  },
  
  // ===== PICKER FIELDS =====
  openFieldPicker(field) {
    const cfg = this.pickerConfigFor(field);
    if (!cfg) return;
    openPicker({
      title: cfg.title,
      subtitle: cfg.subtitle || '',
      searchPlaceholder: cfg.searchPlaceholder || 'Search...',
      options: cfg.options,
      grouped: !!cfg.grouped,
      fullBleed: true,   // full-screen modal (platform standard) — height/gender/country/city/nationality
      current: this.data[field],
      onPick: (val) => {
        // Handle country change: if current city isn't valid for new country, clear it
        if (field === 'country' && this.data.country !== val) {
          const cities = CITIES_DB[val] || [];
          if (!cities.includes(this.data.city)) this.data.city = '';
        }
        this.data[field] = val;
        this.render();
        this.autoSave();
      }
    });
  },
  
  openLocationPicker() {
    var self = this;
    if (!window.FFPLocPick || !FFPLocPick.open) return;
    FFPLocPick.open(function (loc) {
      if (!loc) return;
      self.data.country      = loc.country || self.data.country || '';
      self.data.city         = loc.city || '';
      self.data.region       = loc.region || '';
      self.data.area         = loc.area || '';
      self.data.country_code = loc.country_code || '';
      self.data.lat          = (loc.lat != null ? loc.lat : '');
      self.data.lng          = (loc.lng != null ? loc.lng : '');
      self.data.place_id     = loc.place_id || '';
      self.data.location_label = [loc.area, loc.city, loc.region, loc.country].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ');
      self.render();
      self.autoSave();
    });
  },

  pickerConfigFor(field) {
    if (field === 'height') {
      const heights = [];
      for (let cm = 120; cm <= 220; cm++) heights.push({ value: String(cm), label: cm + ' cm' });
      return { title: 'Height', subtitle: 'Set once', options: heights, searchPlaceholder: 'Search cm...' };
    }
    if (field === 'gender')      return { title: 'Gender',      options: GENDERS,                searchPlaceholder: 'Search...' };
    if (field === 'nationality') return { title: 'Nationality', options: NATIONALITIES,          searchPlaceholder: 'Search nationalities...' };
    if (field === 'country')     return { title: 'Country',     options: Object.keys(CITIES_DB), searchPlaceholder: 'Search countries...' };
    if (field === 'city') {
      // City picker is filtered by the currently-selected country
      const cities = CITIES_DB[this.data.country] || [];
      return cities.length === 0
        ? { title: 'City', subtitle: 'Pick a country first', options: [], searchPlaceholder: 'No cities — pick a country first' }
        : { title: `City — ${this.data.country}`, subtitle: 'Filtered by your country', options: cities, searchPlaceholder: 'Search cities...' };
    }
    return null;
  },
  
  // ===== AVATAR =====
  changeAvatar() {
    var inp = document.getElementById('ffp-avatar-input');
    if (!inp) {
      inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*';
      inp.id = 'ffp-avatar-input'; inp.style.display = 'none';
      inp.addEventListener('change', function () {
        var file = inp.files && inp.files[0]; if (!file) return;
        ffpDownscaleImage(file, function (durl) {
          if (!durl) return;
          MemberProfile.data.photo = durl;
          MemberProfile.syncToPassport();
          MemberProfile.render();
          MemberProfile.persistPhoto(durl);
        });
        inp.value = '';
      });
      document.body.appendChild(inp);
    }
    inp.click();
  },
  persistPhoto(durl) {
    try {
      var stored = JSON.parse(localStorage.getItem('ffp_member') || '{}');
      stored.photo_url = durl;
      localStorage.setItem('ffp_member', JSON.stringify(stored));
      if (stored.id) {
        fetch('https://ffp-passport-backend.vercel.app/api/members/' + stored.id, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo_url: durl })
        }).catch(function(){});
      }
    } catch (e) {}
  },
  
  // ===== PIN =====
  openPinModal() {
    document.getElementById('pin-modal-title').textContent = this.data.hasPin ? 'Change 6-digit PIN' : 'Set 6-digit PIN';
    document.querySelectorAll('#pin-modal input').forEach(i => i.value = '');
    document.getElementById('pin-error').textContent = '';
    document.getElementById('pin-modal').classList.add('show');
    setTimeout(() => {
      const first = document.querySelector('#pin-row-1 input[data-pin="1"]');
      if (first) first.focus();
    }, 50);
  },
  savePin() {
    const pin1 = Array.from(document.querySelectorAll('#pin-row-1 input')).map(i => i.value).join('');
    const pin2 = Array.from(document.querySelectorAll('#pin-row-2 input')).map(i => i.value).join('');
    const err  = document.getElementById('pin-error');
    if (pin1.length !== 6 || !/^\d{6}$/.test(pin1)) { err.textContent = 'PIN must be 6 digits.'; return; }
    if (pin1 !== pin2)                               { err.textContent = 'PINs do not match.'; return; }
    this.data.hasPin = true;
    closePinModal();
    this.render();
  },
  
  // ===== ADD SPORT — chained pickers =====
  addSportFlow() {
    const grouped = {};
    ACTIVITIES_DB.forEach(a => { if (!grouped[a.c]) grouped[a.c] = []; grouped[a.c].push(a.n); });
    openPicker({
      title: 'Add a Skill',
      subtitle: 'Step 1 of 2 — Pick from the FFP activity taxonomy',
      searchPlaceholder: 'Search skills...',
      options: grouped,
      grouped: true,
      fullBleed: true,
      onPick: (sportName) => {
        if (this.data.sports.some(s => s.name.toLowerCase() === sportName.toLowerCase())) {
          alert(`${sportName} is already in your profile.`);
          return;
        }
        setTimeout(() => {
          openPicker({
            title: `Skill Level — ${sportName}`,
            subtitle: 'Step 2 of 2 — FFP fitness level',
            searchPlaceholder: 'Search levels...',
            options: FFP_FITNESS_LEVELS,
            fullBleed: true,
            onPick: (level) => {
              this.data.sports.push({ name: sportName, level, grade: '' });
              this.render();
              this.autoSave();
            }
          });
        }, 80);
      }
    });
  },
  
  removeSport(index) {
    const sport = this.data.sports[index];
    if (!sport) return;
    // No confirm — easy to re-add via the picker if removed by mistake.
    this.data.sports.splice(index, 1);
    this.render();
    this.autoSave();
  },

  // Per-sport GRADE (free text, sport-specific: pace / handicap / padel grade). Edited inline on the sport card.
  setSportGrade(index, val) {
    const sp = this.data.sports[index];
    if (!sp) return;
    sp.grade = String(val == null ? '' : val).trim();
    this.autoSave();
    this.syncToPassport();   // passport card back shows name · level · grade
  },

  // Edit an existing skill's LEVEL in place (re-pick from the FFP fitness levels) — no delete + re-add.
  editSportLevel(index) {
    const sp = this.data.sports[index];
    if (!sp) return;
    openPicker({
      title: `Skill Level — ${sp.name}`,
      subtitle: 'Change the FFP fitness level',
      searchPlaceholder: 'Search levels...',
      options: FFP_FITNESS_LEVELS,
      fullBleed: true,
      onPick: (level) => {
        this.data.sports[index].level = level;
        this.render();        // re-renders cards + syncToPassport (card back updates)
        this.autoSave();
      }
    });
  },
  
  // ===== PREFERENCES =====
  setPref(key, value) {
    this.data.preferences[key] = value;
    if (key === 'hideDob') this.syncToPassport();   // reflect on the card immediately
    this.autoSave();
  }
};
