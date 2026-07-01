/* ffp-streak-loader.js — v1
   Passport "daily streak" card. Lazy, self-booting. Reads member_streak_status(p_me) and renders a compact
   streak card into #ffp-streak-mount on the passport home. Streak rewards ($20 @14, $50 @30) are credited
   server-side by the activity_streak_reward trigger; this is display + daily prompt only.
   Expose window.ffpStreak.refresh() (called on load, on passport re-open, and after logging an activity). */
(function () {
  'use strict';
  function meId() { try { return (JSON.parse(localStorage.getItem('ffp_member') || '{}') || {}).id || ''; } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function render(d) {
    var m = document.getElementById('ffp-streak-mount');
    if (!m) return;
    if (!d) { m.innerHTML = ''; return; }
    var s = d.streak || 0, posted = !!d.posted_today, target = d.next_target, toNext = d.days_to_next || 0;
    var reward = target === 14 ? 20 : (target === 30 ? 50 : 0);
    var rewardLabel = target === 30 ? '$50 total' : ('$' + reward);
    var pct = target ? Math.max(4, Math.min(100, Math.round(s / target * 100))) : 100;
    var statusTxt, statusCol;
    if (posted) { statusTxt = 'Logged today ✓ — streak safe'; statusCol = '#7ee0a0'; }
    else { statusTxt = s > 0 ? 'Post today to keep your streak alive' : 'Post an activity to start your streak'; statusCol = '#ffcf8a'; }
    var head = s > 0 ? (s + '-day streak') : 'Daily streak';
    var flame = s > 0 ? '🔥' : '⚡';
    var goalLine = target ? (toNext + ' day' + (toNext === 1 ? '' : 's') + ' to ' + rewardLabel) : 'You’ve earned every streak reward — legend.';
    var html =
      '<div style="margin:0 0 16px;border-radius:16px;overflow:hidden;background:linear-gradient(150deg,rgba(43,168,224,.16),rgba(8,20,32,.5));border:1px solid rgba(255,255,255,.08);padding:16px;">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
      + '<td style="vertical-align:top;"><div style="font-size:20px;font-weight:900;color:#fff;line-height:1.15;">' + flame + ' ' + head + '</div>'
      + '<div style="font-size:12.5px;font-weight:700;color:' + statusCol + ';margin-top:3px;">' + statusTxt + '</div></td>'
      + (target ? ('<td style="text-align:right;vertical-align:top;white-space:nowrap;"><span style="display:inline-block;background:#FFCC00;color:#082335;font-size:12px;font-weight:900;padding:5px 11px;border-radius:20px;">Next: ' + rewardLabel + '</span></td>') : '')
      + '</tr></table>'
      + (target
        ? ('<div style="margin-top:13px;height:9px;border-radius:6px;background:rgba(255,255,255,.14);"><div style="height:9px;border-radius:6px;width:' + pct + '%;background:#FFCC00;"></div></div>'
          + '<div style="font-size:11.5px;color:#9dbdd0;margin-top:6px;font-weight:700;">' + esc(goalLine) + ' &middot; ' + s + '/' + target + '</div>')
        : ('<div style="font-size:12.5px;color:#cbe6d4;margin-top:10px;font-weight:700;">' + esc(goalLine) + '</div>'))
      + '</div>';
    m.innerHTML = html;
  }

  function load() {
    var id = meId();
    if (!id || !window.supabase) return;
    try {
      window.supabase.rpc('member_streak_status', { p_me: id }).then(
        function (r) { render(r && r.data ? r.data : null); },
        function () { }
      );
    } catch (e) { }
  }

  window.ffpStreak = { refresh: load };

  var tries = 0;
  (function boot() {
    if (document.getElementById('ffp-streak-mount') && window.supabase) { load(); }
    else if (tries++ < 40) { setTimeout(boot, 150); }
  })();
})();
