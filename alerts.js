/* SMART SHOP add-on: alerts.js
   1) ปุ่มขยาย/ปิดของ popup รวมเป็น "แคปซูลเดียว" (ไอคอนสี่เหลี่ยมมุม + ปุ่ม X)
   2) ศูนย์แจ้งเตือนบน Dashboard: ค่าเช่า สัญญา สต๊อก พยากรณ์อากาศ + ปฏิทินเหตุการณ์ 14 วัน
   Load LAST in index.html:  <script src="alerts.js"></script>
   To undo: delete that one line from index.html. */
(function () {
  var css = document.createElement('style');
  css.textContent = [
    '.pill{display:flex;align-items:center;height:40px;background:var(--bg);border:1px solid var(--line);border-radius:14px;overflow:hidden;flex:0 0 auto}',
    '.pill button{width:42px;height:40px;display:grid;place-items:center;color:var(--text);background:transparent}',
    '.pill button:active{background:var(--line)}',
    '.pill i{width:1px;height:20px;background:var(--line)}',
    '.alr{margin-bottom:14px}',
    '.alr>summary{list-style:none;display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.05rem;cursor:pointer;padding:4px 2px 10px}',
    '.alr>summary::-webkit-details-marker{display:none}',
    '.alr .cnt{background:var(--red);color:#fff;border-radius:99px;padding:2px 10px;font-size:.8rem}',
    '.alr .cnt.ok{background:var(--green)}',
    '.ai{display:flex;gap:10px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-left:5px solid var(--blue);border-radius:14px;padding:10px 12px;margin-bottom:8px;width:100%;text-align:left}',
    '.ai.r{border-left-color:var(--red)}.ai.a{border-left-color:#d97706}.ai.g{border-left-color:var(--green)}',
    '.ai b{display:block}.ai small{color:var(--mute)}',
    '.alr h4{margin:14px 2px 6px;color:var(--mute);font-size:.85rem;font-weight:700}'
  ].join('');
  document.head.appendChild(css);

  /* ===== 1) แคปซูลขยาย/ปิด ===== */
  var IC_EXP = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/></svg>';
  var IC_COL = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v4a1 1 0 0 1-1 1H4M20 9h-4a1 1 0 0 1-1-1V4M15 20v-4a1 1 0 0 1 1-1h4M4 15h4a1 1 0 0 1 1 1v4"/></svg>';
  var IC_X = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var _os = openSheet;
  openSheet = function (h) {
    _os(h);
    var b = $('sbody'), hd = b && b.querySelector('.sh');
    if (!hd || hd.querySelector('.pill')) return;
    var t = hd.querySelector('h2'), menu = t && t.textContent.trim() === 'เมนูเพิ่มเติม';
    Array.prototype.slice.call(hd.querySelectorAll('button')).forEach(function (x) { x.parentNode.removeChild(x); });
    hd.insertAdjacentHTML('beforeend', '<div class="pill">' +
      (menu ? '' : '<button data-a="expand" aria-label="ขยายหรือย่อ">' + IC_EXP + '</button><i></i>') +
      '<button data-a="close" aria-label="ปิด">' + IC_X + '</button></div>');
  };
  A.expand = function () {
    var sh = $('sheet'); sh.classList.toggle('full');
    var b = document.querySelector('.pill [data-a="expand"]');
    if (b) b.innerHTML = sh.classList.contains('full') ? IC_COL : IC_EXP;
  };

  /* ===== 2) ศูนย์แจ้งเตือน ===== */
  var W = { at: 0, data: null, err: false, busy: false };
  function fm(n) { return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 }); }
  function ymd(d) { return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); }
  function fdate(s) { return new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }); }

  function weatherLoad() {
    if (W.busy || (W.data && Date.now() - W.at < 3600000)) return Promise.resolve();
    W.busy = true;
    return fetch('https://api.open-meteo.com/v1/forecast?latitude=13.75&longitude=100.5&daily=weathercode,temperature_2m_max,precipitation_probability_max,precipitation_sum&timezone=Asia%2FBangkok&forecast_days=3')
      .then(function (r) { return r.json(); })
      .then(function (j) { W.data = j.daily; W.at = Date.now(); W.err = false; })
      .catch(function () { W.err = true; })
      .then(function () { W.busy = false; });
  }

  function build() {
    var A1 = [], ev = [], R = window.SSRent, td = ymd(new Date());
    // --- ค่าเช่า / สัญญา ---
    if (R && R.R.loaded) {
      R.R.leases.filter(function (l) { return l.status === 'active'; }).forEach(function (l) {
        var u = R.unit(l.unit_id), name = u ? R.uname(u) : 'ห้อง', c = R.cur(l), rs = R.rowsOf(l.id);
        if (c.row) {
          var n = R.diff(td, R.eff(c.row));
          var carry = c.carry > 0 ? ' (รวมค้างยกมา ฿' + fm(c.carry) + ')' : '';
          if (n < 0) A1.push({ lv: 'r', t: name + ' ค้างค่าเช่า ฿' + fm(c.pay), s: 'เลยกำหนด ' + (-n) + ' วัน' + carry + ' · ' + ((l.tenants || {}).name || ''), go: 'runit', v: u && u.id, o: 0 });
          else if (n <= 3) A1.push({ lv: 'a', t: name + ' ครบกำหนดจ่าย ' + (n === 0 ? 'วันนี้' : 'อีก ' + n + ' วัน'), s: '฿' + fm(c.pay) + carry, go: 'runit', v: u && u.id, o: 1 });
          if (n >= 0 && n <= 14) ev.push({ d: R.eff(c.row), t: 'ค่าเช่า ' + name + ' ฿' + fm(c.pay) });
        }
        if (l.term_months && rs.length) {
          var last = rs.slice().sort(function (a, b) { return a.period < b.period ? 1 : -1; })[0], k = R.diff(td, R.eff(last));
          if (k >= 0 && k <= 60) A1.push({ lv: k <= 30 ? 'a' : 'b', t: 'สัญญา ' + name + ' ใกล้ครบ', s: 'งวดสุดท้าย ' + R.fd(R.eff(last)) + ' (อีก ' + k + ' วัน)', go: 'runit', v: u && u.id, o: 2 });
          if (k >= 0 && k <= 14) ev.push({ d: R.eff(last), t: 'งวดสุดท้ายสัญญา ' + name });
        }
      });
    }
    // --- สต๊อก ---
    var P = (S.prods || []), pqty = function (p) { return (p.variants || []).reduce(function (a, v) { return a + (v.stock_levels || []).reduce(function (b, x) { return b + x.qty; }, 0); }, 0); };
    var out = P.filter(function (p) { return p.status !== 'black' && pqty(p) === 0; });
    var low = P.filter(function (p) { return p.status !== 'black' && pqty(p) > 0 && pqty(p) <= 3; });
    var bad = P.filter(function (p) { return p.status === 'red'; });
    if (out.length) A1.push({ lv: 'r', t: 'สินค้าหมดสต๊อก ' + out.length + ' รุ่น', s: out.slice(0, 3).map(function (p) { return p.code; }).join(', ') + (out.length > 3 ? ' ...' : ''), go: 'go', v: 'stock', o: 3 });
    if (low.length) A1.push({ lv: 'a', t: 'สินค้าใกล้หมด ' + low.length + ' รุ่น (เหลือไม่เกิน 3 ชิ้น)', s: low.slice(0, 3).map(function (p) { return p.code + ' เหลือ ' + pqty(p); }).join(', ') + (low.length > 3 ? ' ...' : ''), go: 'go', v: 'stock', o: 4 });
    if (bad.length) A1.push({ lv: 'a', t: 'สินค้าเสีย/มีปัญหา ' + bad.length + ' รุ่น', s: bad.slice(0, 3).map(function (p) { return p.code; }).join(', '), go: 'go', v: 'stock', o: 5 });
    A1.sort(function (a, b) { return a.o - b.o; });

    // --- อากาศ (Open-Meteo, กรุงเทพฯ) ---
    var wx = [];
    if (W.data) {
      for (var i = 0; i < W.data.time.length; i++) {
        var p = W.data.precipitation_probability_max[i], mm = W.data.precipitation_sum[i], tx = W.data.temperature_2m_max[i], cd = W.data.weathercode[i];
        var day = i === 0 ? 'วันนี้' : i === 1 ? 'พรุ่งนี้' : fdate(W.data.time[i]);
        if (cd >= 95) wx.push({ lv: 'r', t: day + ' พายุฝนฟ้าคะนอง', s: 'ควรเก็บของ/ป้องกันน้ำเข้าร้าน' });
        else if (p >= 70 || mm >= 20) wx.push({ lv: 'a', t: day + ' ฝนตกหนัก', s: 'โอกาสฝน ' + p + '% · ปริมาณ ' + Math.round(mm) + ' มม. · ลูกค้าอาจน้อยลง' });
        else if (p >= 50) wx.push({ lv: 'b', t: day + ' มีโอกาสฝน ' + p + '%', s: 'เตรียมร่ม/ถุงกันน้ำ' });
        if (tx >= 38) wx.push({ lv: 'a', t: day + ' อากาศร้อนจัด ' + Math.round(tx) + '°C', s: 'ระวังสินค้าที่ไวต่อความร้อน' });
      }
    }

    var h = '<details class="alr" open><summary>🔔 แจ้งเตือน <span class="cnt ' + (A1.length + wx.filter(function (x) { return x.lv !== 'b'; }).length ? '' : 'ok') + '">' +
      (A1.length + wx.length || 'ปกติ') + '</span></summary>';
    function item(x) {
      var inner = '<b>' + esc(x.t) + '</b><small>' + esc(x.s || '') + '</small>';
      return x.go && x.v ? '<button class="ai ' + x.lv + '" data-a="' + x.go + '" data-v="' + x.v + '"><div>' + inner + '</div></button>'
        : '<div class="ai ' + x.lv + '"><div>' + inner + '</div></div>';
    }
    if (!R || !R.R.loaded) h += '<div class="ai"><div><small>กำลังตรวจค่าเช่า...</small></div></div>';
    h += A1.length ? A1.map(item).join('') : '<div class="ai g"><div><b>ไม่มีเรื่องเร่งด่วนจากร้านและค่าเช่า</b></div></div>';
    h += '<h4>สภาพอากาศ 3 วัน (กรุงเทพฯ)</h4>';
    h += W.err ? '<div class="ai"><div><small>ดึงพยากรณ์อากาศไม่ได้ในตอนนี้</small></div></div>'
      : !W.data ? '<div class="ai"><div><small>กำลังโหลดพยากรณ์...</small></div></div>'
      : (wx.length ? wx.map(item).join('') : '<div class="ai g"><div><b>อากาศปกติ 3 วันข้างหน้า</b></div></div>');
    h += '<h4>AI วิเคราะห์ข่าวเศรษฐกิจ/เหตุการณ์สำคัญ</h4><div class="ai"><div><b>ยังไม่เชื่อมต่อ</b><small>ต้องใช้ AI API ซึ่งมีค่าใช้จ่ายตามการใช้งาน จะเปิดให้ในระยะที่ 6 หลังคุณอนุญาต</small></div></div>';
    ev.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    h += '<h4>ปฏิทินเหตุการณ์ 14 วันข้างหน้า</h4>' + (ev.length ? ev.map(function (e) {
      return '<div class="ai"><div><b>' + fdate(e.d) + '</b><small>' + esc(e.t) + '</small></div></div>';
    }).join('') : '<div class="ai"><div><small>ไม่มีรายการ</small></div></div>');
    return h + '</details>';
  }

  var _dp = dashPage;
  dashPage = function () {
    return String(_dp()).replace('<h2>ภาพรวมร้าน</h2>', '<h2>ภาพรวมร้าน</h2><div id="alrbox">' + build() + '</div>');
  };
  function refresh() { var b = $('alrbox'); if (b && S.cur === 'dash') b.innerHTML = build(); }
  var _r = render;
  render = function () {
    _r.apply(this, arguments);
    if (!(S.ready && S.cur === 'dash')) return;
    if (window.SSRent) {
      var p = window.SSRent.ensure(); if (p && p.then) p.then(refresh);
    }
    weatherLoad().then(refresh);
  };
  // รีเฟรชหลังโหลดข้อมูลค่าเช่าเสร็จ (กรณีเปิดแอปที่หน้าอื่นแล้วค่อยกลับมา)
})();
