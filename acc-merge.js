// acc-merge.js — รวม บัญชี / รายงาน / ภาษี เป็นเมนูเดียว มีแท็บสลับด้านบน
// ใช้หน้าเดิมทั้งหมด ไม่แตะสูตรคำนวณ · วิธียกเลิก: ลบ <script src="acc-merge.js"> ใน index.html
(function () {
  if (typeof M === 'undefined' || typeof S === 'undefined' || typeof render !== 'function') return;
  var TABS = [['acc', 'บัญชี'], ['rep', 'รายงาน'], ['tax', 'ภาษี']];
  var a = M.find(function (m) { return m.id === 'acc'; });
  if (a) a.t = 'บัญชี·รายงาน·ภาษี';
  var st = document.createElement('style');
  st.textContent = '[data-a="go"][data-v="rep"],[data-a="go"][data-v="tax"]{display:none!important}' +
    '#xtabs{display:none;gap:8px;padding:12px 16px 0;max-width:900px;margin:0 auto}#xtabs.on{display:flex}' +
    '#xtabs button{flex:1;min-height:46px;border-radius:14px;border:1px solid var(--line);background:var(--card);color:var(--text);font-weight:700;font-size:1rem}' +
    '#xtabs button.on{background:var(--pri);border-color:var(--pri);color:#fff}';
  document.head.appendChild(st);
  var v = document.getElementById('view'), bar = document.createElement('div');
  bar.id = 'xtabs'; v.parentNode.insertBefore(bar, v);
  var oR = render;
  render = function () {
    oR.apply(this, arguments);
    var on = TABS.some(function (t) { return t[0] === S.cur; });
    bar.className = on ? 'on' : '';
    if (!on) return;
    bar.innerHTML = TABS.map(function (t) { return '<button data-xt="' + t[0] + '" class="' + (t[0] === S.cur ? 'on' : '') + '">' + t[1] + '</button>'; }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('#side button,#bot button'), function (b) {
      if (b.dataset.a === 'go') b.classList.toggle('on', b.dataset.v === 'acc');
    });
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#xtabs button'); if (!b) return;
    S.cur = b.dataset.xt; if (typeof closeSheet === 'function') closeSheet(); render(); window.scrollTo(0, 0);
  });
})();
