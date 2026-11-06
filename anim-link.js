// anim-link.js — เมนู "โรงงานตัวละคร 🎞" (anim.html) + "สตูดิโอ AI 🎬" (studio.html)
// โหลดเป็นไฟล์สุดท้ายใน index.html · วิธียกเลิก: ลบ <script src="anim-link.js">
(function () {
  if (typeof M === 'undefined' || typeof go !== 'function') return;
  var PAGES = { anim: 'anim.html', studio: 'studio.html' };
  if (!M.some(function (m) { return m.id === 'anim'; })) M.push({ id: 'anim', i: 'sliders', t: 'model 3d 🎞' });
  if (!M.some(function (m) { return m.id === 'studio'; })) M.push({ id: 'studio', i: 'chat', t: 'สตูดิโอ AI 🎬' });
  var origGo = go;
  go = function (id) {
    if (PAGES[id]) { location.href = PAGES[id]; return; }
    return origGo.apply(this, arguments);
  };
  try { if (typeof render === 'function') render(); } catch (e) {}
})();
