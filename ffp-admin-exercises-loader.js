/* FFP Admin — Exercise Library loader (v1)
   Lazy-loaded panel (registered in ffp-admin-dashboard.html _panelScript as 'panel-exercises').
   Curates the shared exercise_library (FFP-official global rows). Uses the shared
   openModal/closeModal/showToast/escHtml helpers + window.supabase (JWT-scoped, is_admin()). */
(function () {
  var AdminExercises = {
    ALL: [],
    MUSCLES: ['Chest', 'Back', 'Legs', 'Glutes', 'Shoulders', 'Arms', 'Core', 'Full body', 'Cardio'],
    EQUIP: ['Barbell', 'Dumbbell', 'Kettlebell', 'Bodyweight', 'Machine', 'Cable', 'Band', 'None'],
    MODES: [['weights', 'Reps & weight'], ['time', 'Time / hold'], ['distance', 'Distance']],
    _q: '', _muscle: '', _groupBy: 'muscle',
    render: function () {
      var host = document.getElementById('panel-exercises'); if (!host) return;
      host.innerHTML =
        '<div class="panel-head"><h1 style="color:var(--text);">Exercise Library</h1><div class="panel-head-actions"><button class="btn btn-primary" onclick="AdminExercises.openForm(null)"><span class="material-icons">add</span> Add exercise</button></div></div>' +
        '<div class="section"><div class="section-body padded">' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px;">' +
            '<input class="field-input" id="exl-q" placeholder="Search exercises…" oninput="AdminExercises._onSearch(this.value)" style="flex:1;min-width:180px;">' +
            '<select class="field-input" id="exl-muscle" onchange="AdminExercises._onMuscle(this.value)" style="max-width:180px;"><option value="">All muscles</option>' + this.MUSCLES.map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select>' +
            '<span style="font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--muted);">Group by</span>' +
            '<button id="exg-muscle" class="btn btn-primary btn-sm" onclick="AdminExercises._setGroup(\'muscle\')">Muscle</button>' +
            '<button id="exg-equip" class="btn btn-outline btn-sm" onclick="AdminExercises._setGroup(\'equipment\')">Equipment</button>' +
          '</div>' +
          '<div id="exl-count" style="color:var(--muted);font-size:12px;margin-bottom:8px;"></div>' +
          '<div id="exl-list"><div style="color:var(--muted);padding:12px 0;">Loading…</div></div>' +
        '</div></div>';
      this.fetch();
    },
    fetch: function () {
      var self = this;
      return window.supabase.rpc('exercise_library_admin_list').then(function (r) {
        if (r && r.error) throw r.error;
        self.ALL = (r && r.data) || [];
        self.renderList();
      }).catch(function (e) {
        console.error('[exlib admin]', e);
        var l = document.getElementById('exl-list'); if (l) l.innerHTML = '<div style="color:var(--red);padding:12px 0;">Could not load — admin access required.</div>';
      });
    },
    _modeLbl: function (m) { return ({ weights: 'Reps & weight', time: 'Time', distance: 'Distance' })[m] || m || '—'; },
    renderList: function () {
      var l = document.getElementById('exl-list'); if (!l) return;
      var q = (this._q || '').toLowerCase(), mus = this._muscle || '';
      var rows = this.ALL.filter(function (x) { return (!q || (x.name || '').toLowerCase().indexOf(q) > -1) && (!mus || x.muscle_group === mus); });
      var c = document.getElementById('exl-count'); if (c) c.textContent = rows.length + ' of ' + this.ALL.length + ' exercises';
      if (!rows.length) { l.innerHTML = '<div style="color:var(--muted);padding:12px 0;">No exercises match.</div>'; return; }
      var self = this, gb = this._groupBy || 'muscle';
      var groups = {};
      rows.forEach(function (x) { var k = (gb === 'equipment' ? x.equipment : x.muscle_group) || 'Other'; (groups[k] = groups[k] || []).push(x); });
      var keys = Object.keys(groups).sort();
      var rowHtml = function (x) {
        return '<tr>' +
          '<td style="font-weight:700;padding-left:26px;">' + escHtml(x.name || '') + (x.default_cue ? ('<div style="color:var(--muted);font-weight:400;font-size:12px;margin-top:2px;">' + escHtml(x.default_cue) + '</div>') : '') + '</td>' +
          '<td>' + escHtml(x.muscle_group || '—') + '</td>' +
          '<td>' + escHtml(x.equipment || '—') + '</td>' +
          '<td>' + escHtml(self._modeLbl(x.default_mode)) + '</td>' +
          '<td>' + (x.demo_url ? '<span class="material-icons" style="color:var(--green);font-size:19px;vertical-align:-4px;">check_circle</span>' : '<span class="material-icons" style="color:var(--muted);font-size:19px;vertical-align:-4px;">remove</span>') + '</td>' +
          '<td>' + (x.active ? '<span style="color:var(--green);">Active</span>' : '<span style="color:var(--muted);">Hidden</span>') + '</td>' +
          '<td class="table-actions"><button class="btn btn-outline btn-sm" onclick="AdminExercises.openForm(\'' + x.id + '\')"><span class="material-icons">edit</span></button></td>' +
        '</tr>';
      };
      l.innerHTML = '<table class="table"><thead><tr><th>Exercise</th><th>Muscle</th><th>Equipment</th><th>Mode</th><th>Demo</th><th>Status</th><th></th></tr></thead><tbody>' +
        keys.map(function (k) {
          return '<tr><td colspan="7" style="background:var(--bg-3);font-weight:800;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--yellow);padding:9px 14px;">' + escHtml(k) + ' · ' + groups[k].length + '</td></tr>' +
            groups[k].sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); }).map(rowHtml).join('');
        }).join('') + '</tbody></table>';
    },
    _setGroup: function (g) {
      this._groupBy = g;
      try {
        var a = document.getElementById('exg-muscle'), b = document.getElementById('exg-equip');
        if (a && b) {
          a.className = 'btn btn-sm ' + (g === 'muscle' ? 'btn-primary' : 'btn-outline');
          b.className = 'btn btn-sm ' + (g === 'equipment' ? 'btn-primary' : 'btn-outline');
        }
      } catch (e) {}
      this.renderList();
    },
    _onSearch: function (v) { this._q = v || ''; this.renderList(); },
    _onMuscle: function (v) { this._muscle = v || ''; this.renderList(); },
    openForm: function (id) {
      var x = id ? this.ALL.filter(function (e) { return String(e.id) === String(id); })[0] : null; x = x || {};
      var opt = function (list, sel) { return list.map(function (o) { return '<option' + (sel === o ? ' selected' : '') + '>' + o + '</option>'; }).join(''); };
      var modeOpt = this.MODES.map(function (m) { return '<option value="' + m[0] + '"' + (((x.default_mode || 'weights') === m[0]) ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('');
      var body =
        '<div class="field"><div class="field-label">Exercise name</div><input class="field-input" id="exf-name" value="' + escHtml(x.name || '') + '" placeholder="e.g. Barbell bench press"></div>' +
        '<div class="field-row"><div class="field"><div class="field-label">Muscle group</div><select class="field-input" id="exf-muscle"><option value="">—</option>' + opt(this.MUSCLES, x.muscle_group) + '</select></div>' +
          '<div class="field"><div class="field-label">Equipment</div><select class="field-input" id="exf-equip"><option value="">—</option>' + opt(this.EQUIP, x.equipment) + '</select></div></div>' +
        '<div class="field-row"><div class="field"><div class="field-label">Default mode</div><select class="field-input" id="exf-mode">' + modeOpt + '</select></div>' +
          '<div class="field"><div class="field-label">Difficulty</div><select class="field-input" id="exf-diff"><option value="">—</option>' + opt(['Beginner', 'Intermediate', 'Advanced'], x.difficulty) + '</select></div></div>' +
        '<div class="field"><div class="field-label">Demo video link</div><input class="field-input" id="exf-demo" value="' + escHtml(x.demo_url || '') + '" placeholder="YouTube / Vimeo / MP4 link"></div>' +
        '<div class="field"><div class="field-label">…or upload an FFP clip (mp4 / webm — overrides the link)</div><input class="field-input" id="exf-file" type="file" accept="video/*"></div>' +
        '<div class="field"><div class="field-label">Poster image (optional)</div><input class="field-input" id="exf-poster" type="file" accept="image/*"></div>' +
        '<div class="field"><div class="field-label">Coaching cue</div><input class="field-input" id="exf-cue" value="' + escHtml(x.default_cue || '') + '" placeholder="e.g. Shoulder blades back, no bounce"></div>' +
        '<div class="field-row"><div class="field"><div class="field-label">Sort order</div><input class="field-input" id="exf-sort" type="number" value="' + (x.sort_order != null ? x.sort_order : 0) + '"></div>' +
          '<div class="field"><div class="field-label">Status</div><select class="field-input" id="exf-active"><option value="1"' + ((x.active === false) ? '' : ' selected') + '>Active</option><option value="0"' + ((x.active === false) ? ' selected' : '') + '>Hidden</option></select></div></div>';
      var foot = '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="AdminExercises.save(' + (id ? ('\'' + id + '\'') : 'null') + ')"><span class="material-icons">check</span> Save</button>';
      openModal(id ? 'Edit exercise' : 'Add exercise', body, foot);
    },
    save: function (id) {
      var self = this;
      var g = function (i) { var el = document.getElementById(i); return el ? el.value : ''; };
      var fileOf = function (i) { var el = document.getElementById(i); return (el && el.files && el.files[0]) || null; };
      var name = (g('exf-name') || '').trim(); if (!name) { showToast('Name the exercise', 'error'); return; }
      var existing = id ? (this.ALL.filter(function (e) { return String(e.id) === String(id); })[0] || {}) : {};
      var demoUrl = (g('exf-demo') || '').trim() || null;
      var thumbUrl = existing.thumb_url || null;
      var vid = fileOf('exf-file'), post = fileOf('exf-poster');
      var slug = (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'exercise');
      var up = function (file, kind) {
        if (!file) return Promise.resolve(null);
        var ext = ((file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')) || (kind === 'clip' ? 'mp4' : 'jpg');
        var path = 'official/' + slug + '-' + kind + '-' + Date.now() + '.' + ext;
        return window.supabase.storage.from('exercise-demos').upload(path, file, { upsert: true, contentType: file.type || undefined }).then(function (r) {
          if (r && r.error) throw r.error;
          return window.supabase.storage.from('exercise-demos').getPublicUrl(path).data.publicUrl;
        });
      };
      showToast((vid || post) ? 'Uploading…' : 'Saving…');
      up(vid, 'clip').then(function (u) { if (u) demoUrl = u; return up(post, 'poster'); }).then(function (u) {
        if (u) thumbUrl = u;
        var payload = {
          p_id: id || null, p_name: name, p_muscle_group: g('exf-muscle') || null, p_equipment: g('exf-equip') || null,
          p_difficulty: g('exf-diff') || null, p_default_mode: g('exf-mode') || 'weights', p_demo_url: demoUrl,
          p_thumb_url: thumbUrl, p_default_cue: g('exf-cue') || null, p_aliases: null, p_sort_order: parseInt(g('exf-sort'), 10) || 0, p_active: (g('exf-active') === '1')
        };
        return window.supabase.rpc('exercise_library_admin_save', payload);
      }).then(function (r) {
        if (r && r.error) throw r.error; var d = (r && r.data) || {}; if (!d.ok) throw new Error(d.error || 'save_failed');
        closeModal(); showToast(id ? 'Saved' : 'Exercise added'); self.fetch();
      }).catch(function (e) { console.error('[exlib admin save]', e); showToast('Could not save' + (e && e.message ? ': ' + e.message : ''), 'error'); });
    }
  };
  window.AdminExercises = AdminExercises;

  // Self-boot: _lazyInit injects this script on the panel's first open. Wait for the
  // shared client + panel node + admin session, then render once.
  (function boot() {
    if (!(window.supabase && document.getElementById('panel-exercises') && window.FFP_ADMIN)) { return setTimeout(boot, 60); }
    try { if (window.App && App.panelNames) App.panelNames['panel-exercises'] = 'Exercise Library'; } catch (e) {}
    AdminExercises.render();
  })();
})();
