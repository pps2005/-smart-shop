(function () {
  var SUPABASE_URL = 'https://tnfjosnpjjrmyxshfzlz.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_UnlipRW9A797QdkeNpixug_goq2D5-8';

  var css = document.createElement('style');
  css.textContent =
    '#lg{position:fixed;inset:0;z-index:200;background:var(--bg,#f4f6fb);color:var(--text,#0f172a);display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,-apple-system,"Noto Sans Thai",sans-serif}' +
    '#lg .bx{width:100%;max-width:380px;background:var(--card,#fff);border:1px solid var(--line,#e5e9f2);border-radius:22px;padding:26px 22px;text-align:center}' +
    '#lg h1{font-size:1.4rem;margin:6px 0 4px}#lg p{color:var(--mute,#64748b);font-size:.9rem;margin-bottom:16px}' +
    '#lg input{width:100%;padding:13px 14px;margin-bottom:10px;border-radius:12px;border:1px solid var(--line,#e5e9f2);background:var(--bg,#f4f6fb);color:inherit;font:inherit;outline:0}' +
    '#lg button{width:100%;padding:13px;border:0;border-radius:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font:inherit;font-weight:700;cursor:pointer}' +
    '#lg button:disabled{opacity:.6}#lg .er{color:#dc2626;font-size:.85rem;min-height:1.2em;margin-bottom:8px}';
  document.head.appendChild(css);

  var box = document.createElement('div');
  box.id = 'lg';
  box.innerHTML =
    '<div class="bx"><div style="font-size:2.6rem">🛍️</div><h1>SMART SHOP</h1>' +
    '<p id="lgmsg">กำลังตรวจสอบ...</p>' +
    '<div id="lgform" style="display:none"><form id="lgf">' +
    '<input id="lge" type="email" placeholder="อีเมล" autocomplete="username" required>' +
    '<input id="lgp" type="password" placeholder="รหัสผ่าน" autocomplete="current-password" required>' +
    '<div class="er" id="lger"></div><button id="lgb" type="submit">เข้าสู่ระบบ</button></form></div></div>';
  document.body.appendChild(box);

  function $(id) { return document.getElementById(id); }

  function showLogin() {
    $('lg').style.display = 'flex';
    $('lgmsg').textContent = 'เข้าสู่ระบบเพื่อใช้งานร้านของคุณ';
    $('lgform').style.display = 'block';
  }
  function showApp() { $('lg').style.display = 'none'; }

  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  s.onerror = function () { $('lgmsg').textContent = 'เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วรีเฟรชหน้า'; };
  s.onload = function () {
    var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.sb = sb;

    var tr = document.querySelector('.tr');
    if (tr) {
      var out = document.createElement('button');
      out.className = 'ic';
      out.textContent = '🚪';
      out.title = 'ออกจากระบบ';
      out.onclick = function () { sb.auth.signOut(); };
      tr.appendChild(out);
    }

    sb.auth.getSession().then(function (r) {
      if (r.data && r.data.session) showApp(); else showLogin();
    });
    sb.auth.onAuthStateChange(function (ev, session) {
      if (session) showApp(); else showLogin();
    });

    $('lgf').onsubmit = function (e) {
      e.preventDefault();
      $('lgb').disabled = true;
      $('lger').textContent = '';
      sb.auth.signInWithPassword({ email: $('lge').value.trim(), password: $('lgp').value })
        .then(function (r) {
          $('lgb').disabled = false;
          if (r.error) {
            $('lger').textContent = /invalid/i.test(r.error.message)
              ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
              : 'เข้าสู่ระบบไม่สำเร็จ: ' + r.error.message;
          } else {
            $('lgp').value = '';
          }
        });
    };
  };
  document.head.appendChild(s);
})();

