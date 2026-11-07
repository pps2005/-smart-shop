// anim-link.js — เมนู "สตูดิโอ AI 🎬" (studio.html)
// (หน้า model 3d / anim.html ถูกลบแล้ว — เจนภาพทำในสตูดิโอ AI แท็บ "เจนภาพ" ผ่านบอท Flux)
// โหลดเป็นไฟล์สุดท้ายใน index.html · วิธียกเลิก: ลบ <script src="anim-link.js">
(function () {
  if (typeof M === 'undefined' || typeof go !== 'function') return;
  var PAGES = { studio: 'studio.html' };
  for (var i = M.length - 1; i >= 0; i--) if (M[i].id === 'anim') M.splice(i, 1);
  if (!M.some(function (m) { return m.id === 'studio'; })) M.push({ id: 'studio', i: 'chat', t: 'สตูดิโอ AI 🎬' });
  var origGo = go;
  go = function (id) {
    if (id === 'anim') id = 'studio';
    if (PAGES[id]) { location.href = PAGES[id]; return; }
    return origGo.apply(this, arguments);
  };
  try { if (typeof render === 'function') render(); } catch (e) {}
})();
