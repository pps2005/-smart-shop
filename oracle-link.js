// oracle-link.js — เมนู "คลังไพ่ออราเคิล 🔮" (oracle-cards.html · ไพ่ 78 ใบ แยกหมวดเหมือนคลังภาพ)
// โหลดเป็นไฟล์สุดท้ายใน index.html · วิธียกเลิก: ลบ <script src="oracle-link.js">
(function () {
  if (typeof M === 'undefined' || typeof go !== 'function') return;
  if (!M.some(function (m) { return m.id === 'oracle'; })) M.push({ id: 'oracle', i: 'grid', t: 'คลังไพ่ออราเคิล 🔮' });
  var origGo = go;
  go = function (id) {
    if (id === 'oracle') { location.href = 'oracle-cards.html'; return; }
    return origGo.apply(this, arguments);
  };
  try { if (typeof render === 'function') render(); } catch (e) {}
})();
