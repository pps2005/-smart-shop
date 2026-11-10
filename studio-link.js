/* ============================================================
   studio-link.js — ปุ่ม 🎬 ไปแมพสตูดิโอ (studio.html)
   - เพิ่มปุ่มในแถบควบคุมขวาของแมพ (#wctl) ใต้ปุ่ม 🌏
   - น้องฟ้ารับคำว่า "สตูดิโอ" / "ทีม AI" แล้วพาไป
   ============================================================ */
(function () {
  'use strict';
  function go() { location.href = 'studio.html'; }
  function add() {
    var ctl = document.querySelector('#wd #wctl');
    if (!ctl) return false;
    if (document.getElementById('wstudio')) return true;
    var b = document.createElement('button');
    b.id = 'wstudio'; b.type = 'button';
    b.setAttribute('aria-label', 'ไปสตูดิโอทีม AI');
    b.title = 'สตูดิโอทีม AI';
    b.textContent = '🎬';
    b.style.fontSize = '1.15rem';
    b.addEventListener('click', function (e) { e.stopPropagation(); go(); });
    ctl.appendChild(b);
    if (!document.getElementById('wscenepick')) {
      var c = document.createElement('button');
      c.id = 'wscenepick'; c.type = 'button';
      c.setAttribute('aria-label', 'เลือกฉากทำตอน + ล็อกหน้า');
      c.title = 'เลือกฉากทำตอน';
      c.textContent = '🔒';
      c.style.fontSize = '1.15rem';
      c.addEventListener('click', function (e) { e.stopPropagation(); location.href = 'anime-core.html'; });
      ctl.appendChild(c);
    }
    return true;
  }
  var t = setInterval(function () { if (add()) clearInterval(t); }, 300);
  setTimeout(function () { clearInterval(t); }, 60000);

  /* พิมพ์ในแชทน้องฟ้าว่า สตูดิโอ / ทีม AI / ทำคลิป → ไปหน้า studio */
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (!t || t.id !== 'wcin' || e.key !== 'Enter') return;
    var v = (t.value || '').trim();
    if (/^(ไป)?(สตูดิโอ|studio|ทีม ?ai|ทีมเอไอ|ทำคลิป)$/i.test(v)) { e.preventDefault(); e.stopImmediatePropagation(); go(); }
  }, true);
})();
