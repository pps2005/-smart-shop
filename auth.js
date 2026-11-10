(function () {
  var SUPABASE_URL = 'https://tnfjosnpjjrmyxshfzlz.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_UnlipRW9A797QdkeNpixug_goq2D5-8';
  var last = '';
  try { last = localStorage.getItem('lastEmail') || ''; } catch (e) {}

  var css = document.createElement('style');
  css.textContent =
    '#lg{position:fixed;inset:0;z-index:250;background:var(--bg,#f4f6fb);color:var(--text,#0f172a);display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,-apple-system,"Noto Sans Thai",sans-serif}' +
    '#lg .bx{width:100%;max-width:380px;background:var(--card,#fff);border:1px solid var(--line,#e5e9f2);border-radius:22px;padding:26px 22px;text-align:center}' +
    '#lg h1{font-size:1.4rem;margin:6px 0 4px}#lg p{color:var(--mute,#64748b);font-size:.9rem;margin-bottom:16px}' +
    '#lg input{width:100%;padding:13px 14px;margin-bottom:10px;border-radius:12px;border:1px solid var(--line,#e5e9f2);background:var(--bg,#f4f6fb);color:inherit;font:inherit;font-size:16px;outline:0}' +
    '#lg button{width:100%;padding:13px;border:0;border-radius:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font:inherit;font-weight:700;cursor:pointer}' +
    '#lg button:disabled{opacity:.6}#lg .er{color:#dc2626;font-size:.85rem;min-height:1.2em;margin-bottom:8px}';
  document.head.appendChild(css);

  var box = document.createElement('div');
  box.id = 'lg';
  box.innerHTML =
    '<div class="bx"><div style="font-size:2.6rem;line-height:1">🛍️</div><h1>Xiress</h1>' +
    '<p id="lgmsg">กำลังตรวจสอบ...</p>' +
    '<div id="lgform" style="display:none"><form id="lgf" autocomplete="on">' +
    '<input id="lge" name="email" type="email" placeholder="อีเมล" autocomplete="username" required>' +
    '<input id="lgp" name="password" type="password" placeholder="รหัสผ่าน" autocomplete="current-password" required>' +
    '<div class="er" id="lger"></div><button id="lgb" type="submit">เข้าสู่ระบบ</button></form></div></div>';
  document.body.appendChild(box);

  function $(id) { return document.getElementById(id); }
  $('lge').value = last;

  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  s.onerror = function () { $('lgmsg').textContent = 'เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วรีเฟรชหน้า'; };
  s.onload = function () {
    var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    window.sb = sb;
    var cur = null;

    function apply(session) {
      if (session) {
        $('lg').style.display = 'none';
        if (cur !== session.user.id) {
          cur = session.user.id;
          setTimeout(function () { if (window.App) window.App.start(sb, session.user); }, 0);
        }
      } else {
        cur = null;
        $('lg').style.display = 'flex';
        $('lgmsg').textContent = 'เข้าสู่ระบบเพื่อใช้งานร้านของคุณ';
        $('lgform').style.display = 'block';
        if (window.App) window.App.stop();
      }
    }

    sb.auth.getSession().then(function (r) { apply(r.data && r.data.session); });
    sb.auth.onAuthStateChange(function (ev, session) {
      if (ev === 'INITIAL_SESSION') return;
      apply(session);
    });

    $('lgf').onsubmit = function (e) {
      e.preventDefault();
      $('lgb').disabled = true;
      $('lger').textContent = '';
      var email = $('lge').value.trim();
      sb.auth.signInWithPassword({ email: email, password: $('lgp').value }).then(function (r) {
        $('lgb').disabled = false;
        if (r.error) {
          $('lger').textContent = /invalid/i.test(r.error.message)
            ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
            : 'เข้าสู่ระบบไม่สำเร็จ: ' + r.error.message;
        } else {
          try { localStorage.setItem('lastEmail', email); } catch (x) {}
        }
      });
    };
  };
  document.head.appendChild(s);
})();
