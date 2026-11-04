// live-link.js — เพิ่มเมนู "AI Live" และ "แต่งตัวน้องฟ้า" เข้าเมนูเดิม (โหลดเป็นไฟล์สุดท้าย)
(function () {
  if (typeof M === 'undefined' || typeof go !== 'function') return;
  var LINKS = { live: 'ai-live.html', avatar: 'avatar-studio.html' };
  if (!M.some(function (m) { return m.id === 'live'; })) {
    M.push({ id: 'live', i: 'chat', t: 'AI Live 🎙️' });
    M.push({ id: 'avatar', i: 'sliders', t: 'แต่งตัวน้องฟ้า 👗' });
  }
  var origGo = go;
  go = function (id) {
    if (LINKS[id]) { location.href = LINKS[id]; return; }
    return origGo.apply(this, arguments);
  };
})();
