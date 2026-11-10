/* Xiress add-on 2: ตะกร้าสินค้า + หน้าประวัติการขาย + แก้ปุ่มที่กดแล้วไม่ทำงาน
   วิธีใช้: ใส่บรรทัดนี้ใน index.html ต่อจาก final.js ->  <script src="cart.js"></script>
   วิธียกเลิก: ลบบรรทัดนั้นออก */
(function () {
  'use strict';

  Object.assign(I, {
    cartplus: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/><line x1="14" y1="8" x2="14" y2="12"/><line x1="12" y1="10" x2="16" y2="10"/>'
  });
  if (!M.some(function (m) { return m.id === 'ord'; })) {
    var si = M.findIndex(function (m) { return m.id === 'sell'; });
    M.splice(si < 0 ? M.length : si + 1, 0, { id: 'ord', i: 'receipt', t: 'ประวัติการขาย' });
  }

  var css = document.createElement('style');
  css.textContent = [
    '.cfm{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px}',
    '.cfb{background:var(--card);color:var(--text);border-radius:20px;padding:20px;width:100%;max-width:380px}',
    '.cft{white-space:pre-line;font-size:1.05rem;line-height:1.6;margin-bottom:6px}',
    '.ba .ic{position:relative}',
    '.cbd,.cbd2{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;border-radius:10px;background:#ee4d2d;color:#fff;font-size:.72rem;font-style:normal;font-weight:700;display:none;place-items:center;padding:0 5px}',
    '.prc{display:flex;align-items:baseline;gap:8px;margin:12px 0 4px}.prc .rt{margin-left:auto;color:var(--mute)}',
    '.pbig{font-size:1.9rem;font-weight:800;color:var(--pri);line-height:1.1}',
    '.pchips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}',
    '.pchip{border:1px dashed var(--pri);color:var(--pri);border-radius:6px;padding:3px 8px;font-size:.8rem;display:inline-flex;align-items:center;gap:6px}',
    '.abar{position:sticky;bottom:-1px;display:flex;gap:10px;align-items:center;background:var(--card);padding:10px 0 4px;margin-top:14px;border-top:1px solid var(--line);box-shadow:0 40px 0 var(--card);z-index:3}',
    '.abi{position:relative;width:52px;height:52px;flex:0 0 52px;border-radius:14px;border:1px solid var(--line);display:grid;place-items:center;color:var(--pri)}',
    '.abb{flex:1;min-height:52px;border-radius:14px;background:linear-gradient(135deg,var(--pri),var(--pri2));color:#04210f;font-weight:800;font-size:1.05rem}',
    '.adh{display:flex;gap:12px;align-items:center;margin-bottom:6px}',
    '.adh .th{width:84px;height:84px;flex:0 0 84px}',
    '.cit{display:flex;gap:12px;padding:12px 0;border-top:1px solid var(--line)}',
    '.cit .th{width:72px;height:72px;flex:0 0 72px}.cib{flex:1;min-width:0}',
    '.cin{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.cr{display:flex;align-items:center;gap:10px;margin-top:8px}',
    '.qs2{display:flex;align-items:center;border:1px solid var(--line);border-radius:10px}',
    '.qs2 button{width:40px;height:40px;font-size:1.3rem}.qs2 b{min-width:30px;text-align:center}',
    '.cpx{display:flex;align-items:center;gap:4px;margin:0;flex:1;font-weight:700;color:var(--text)}',
    '.cpx input{margin:0!important;min-height:44px!important;padding:6px 8px!important}',
    '.cx{color:var(--red);padding:8px}',
    '.ctot{text-align:right;font-size:1.05rem;margin:10px 0}.ctot b{font-size:1.35rem}',
    '.otabs{display:flex;border-bottom:1px solid var(--line);margin-bottom:12px}',
    '.otabs button{flex:1;padding:12px 4px;color:var(--mute);font-weight:600;border-bottom:3px solid transparent}',
    '.otabs .on{color:var(--pri);border-color:var(--pri)}',
    '.oc{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px;margin-bottom:12px}',
    '.oh{display:flex;align-items:center;gap:8px;margin-bottom:10px}',
    '.obd{background:var(--pri);color:#04210f;border-radius:5px;padding:2px 7px;font-size:.75rem;font-weight:800}',
    '.ost{margin-left:auto;font-weight:700}.ost.ok{color:var(--pri)}.ost.vd{color:var(--red)}',
    '.ol{display:flex;gap:12px;margin-bottom:10px}',
    '.oth{width:84px;height:84px;flex:0 0 84px;border-radius:12px;overflow:hidden;background:var(--bg);display:grid;place-items:center}',
    '.oth img{width:100%;height:100%;object-fit:cover}.oi{flex:1;min-width:0}',
    '.on{font-size:1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ov{color:var(--mute);font-size:.85rem}',
    '.op{display:flex;justify-content:space-between;align-items:flex-end;margin-top:6px;color:var(--mute)}.op b{color:var(--text);font-size:1.05rem}',
    '.oc details>summary{text-align:center;color:var(--mute);cursor:pointer;padding:6px 0;list-style:none}',
    '.oc details>summary::-webkit-details-marker{display:none}',
    '.ot{text-align:right;font-size:1rem;margin:6px 0 10px}.ot b{font-size:1.15rem}',
    '.ob{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}',
    '.obtn{border:1.5px solid var(--pri);color:var(--pri);border-radius:10px;padding:9px 16px;font-weight:700}',
    '.obtn.f{background:var(--pri);color:#04210f}.obtn.r{border-color:var(--red);color:var(--red)}',
    '.rpt{background:rgba(52,210,123,.12);border-radius:18px;margin-bottom:14px;overflow:hidden}',
    '.rpt>div:first-child{padding:12px 14px;font-weight:800;display:flex;align-items:center;gap:8px;color:var(--pri)}',
    '.rpr{display:flex;gap:12px;align-items:center;background:var(--card);padding:12px 14px}'
  ].join('');
  document.head.appendChild(css);

  /* ---------- ตัวช่วย ---------- */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  function byCode(c) { return S.prods.find(function (p) { return p.code === c; }); }
  function prodById(id) { return S.prods.find(function (p) { return p.id === id; }); }
  function varOf(p, vid) { return p && (p.variants || []).find(function (v) { return v.id === vid; }); }
  function locName(id) { var l = S.locs.find(function (x) { return x.id === id; }); return l ? l.name : ''; }
  function kv(a, b) { return '<div class="kv"><span>' + a + '</span><b>' + b + '</b></div>'; }
  var PMN = { cash: 'เงินสด', card: 'บัตร', transfer: 'โอนเงิน', other: 'อื่น ๆ' };
  var cpay = 'cash';
  try { cpay = localStorage.getItem('pay') || 'cash'; } catch (e) {}
  if (!PMN[cpay]) cpay = 'cash';

  /* ---------- กล่องยืนยันของเราเอง (แทน confirm ของเบราว์เซอร์ที่บางแอปไม่แสดง) ---------- */
  function modal(msg) {
    return new Promise(function (res) {
      var d = document.createElement('div');
      d.className = 'cfm';
      var danger = /ลบ|ยกเลิก|ออกจากระบบ|ล้าง/.test(msg);
      d.innerHTML = '<div class="cfb"><div class="cft">' + esc(msg) + '</div><div class="btns">' +
        '<button class="btn o" data-x="0">ยกเลิก</button><button class="btn' + (danger ? ' o dng' : '') + '" data-x="1">ตกลง</button></div></div>';
      var done = function (v) { d.remove(); res(v); };
      d.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('button[data-x]');
        if (b) done(b.dataset.x === '1'); else if (e.target === d) done(false);
      });
      document.body.appendChild(d);
    });
  }
  /* ห่อทุกปุ่มเดิม: ถ้าโค้ดเดิมเรียก confirm() ให้โชว์กล่องของเราแล้วค่อยทำงานต่อ */
  function wrapA(k) {
    var f = A[k];
    if (typeof f !== 'function' || f.__w) return;
    var g = function (v, t) {
      var ok = {};
      function attempt() {
        var pend = null, saved = window.confirm, r;
        window.confirm = function (m) { m = String(m); if (ok[m]) return true; if (pend === null) pend = m; return false; };
        try { r = f(v, t); } finally { window.confirm = saved; }
        if (pend === null) return r;
        var msg = pend;
        return modal(msg).then(function (y) { if (!y) return; ok[msg] = 1; return attempt(); });
      }
      return attempt();
    };
    g.__w = 1; A[k] = g;
  }

  /* ---------- ตะกร้า ---------- */
  var CART = [];
  try { CART = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) { CART = []; }
  if (!Array.isArray(CART)) CART = [];
  function cartQty() { return CART.reduce(function (a, x) { return a + x.qty; }, 0); }
  function badge() {
    var n = cartQty();
    document.querySelectorAll('[data-cb]').forEach(function (e) { e.textContent = n > 99 ? '99+' : n; e.style.display = n ? 'grid' : 'none'; });
  }
  function saveCart() { try { localStorage.setItem('cart', JSON.stringify(CART)); } catch (e) {} badge(); }
  function cleanCart() {
    if (!S.ready) return;
    CART = CART.filter(function (it) { return varOf(prodById(it.pid), it.vid) && S.locs.some(function (l) { return l.id === it.loc; }); });
    saveCart();
  }
  function inCart(vid, loc) {
    var it = CART.find(function (x) { return x.vid === vid && x.loc === loc; });
    return it ? it.qty : 0;
  }
  function addToCart(pid, vid, loc, qty, price) {
    var p = prodById(pid), v = varOf(p, vid);
    if (!p || !v) return 'ไม่พบสินค้า';
    if (!(qty >= 1)) return 'ใส่จำนวนอย่างน้อย 1';
    if (isNaN(price) || price < 0) return 'ใส่ราคาขายจริง';
    var have = lq(v, loc), already = inCart(vid, loc);
    if (qty + already > have) return 'ที่ ' + locName(loc) + ' มีแค่ ' + have + ' ชิ้น' + (already ? ' (อยู่ในตะกร้าแล้ว ' + already + ')' : '');
    var it = CART.find(function (x) { return x.vid === vid && x.loc === loc; });
    if (it) { it.qty += qty; it.price = price; it.key = uuid(); }
    else CART.push({ key: uuid(), pid: pid, vid: vid, loc: loc, qty: qty, price: price });
    saveCart();
    return '';
  }

  var ba = document.querySelector('.ba');
  if (ba) {
    var cb = document.createElement('button');
    cb.className = 'ic'; cb.setAttribute('data-a', 'cart'); cb.setAttribute('aria-label', 'ตะกร้าสินค้า');
    cb.innerHTML = ic('cart', 20) + '<i class="cbd" data-cb></i>';
    ba.insertBefore(cb, ba.firstChild);
  }
  badge();

  /* ---------- หน้ารายละเอียดสินค้า: ราคาใหญ่ + แถบปุ่มด้านล่าง (แบบรูปที่ 3) ---------- */
  var _d = detail;
  detail = function (code) {
    _d(code);
    var p = byCode(code), b = $('sbody');
    if (!p || !b) return;
    var c = esc(code), q = b.querySelector('.qrd');
    var ph = '<div class="prc"><b class="pbig">฿' + fmt(p.base_price) + '</b><small>ราคาขายตั้งต้น</small><span class="rt">คงเหลือ ' + pq(p) + ' ชิ้น</span></div>' +
      '<div class="pchips"><span class="pchip">ต้นทุน ฿' + fmt(p.current_cost) + '</span><span class="pchip">กำไรตั้งต้น ฿' + fmt(p.base_price - p.current_cost) + '</span>' +
      '<span class="pchip"><i class="dt" style="background:var(--' + p.status + ')"></i>' + ST[p.status] + '</span></div>';
    if (q) q.insertAdjacentHTML('beforebegin', ph);
    b.insertAdjacentHTML('beforeend', '<div class="abar">' +
      '<button class="abi" data-a="cart" aria-label="ตะกร้า">' + ic('cart', 24) + '<i class="cbd2 cbd" data-cb></i></button>' +
      '<button class="abi" data-a="cadd" data-v="' + c + '" aria-label="เพิ่มลงตะกร้า">' + ic('cartplus', 24) + '</button>' +
      '<button class="abb" data-a="sale" data-v="' + c + '">ขายทันที ฿' + fmt(p.base_price) + '</button></div>');
    badge();
  };

  /* ---------- เลือกไซส์/สถานที่/จำนวน แล้วเพิ่มลงตะกร้า ---------- */
  var AD = null;
  function firstLoc(v) { var l = S.locs.find(function (x) { return lq(v, x.id) > 0; }); return (l || S.locs[0] || {}).id; }
  function adMax() { var v = varOf(prodById(AD.pid), AD.vid); return Math.max(0, lq(v, AD.loc) - inCart(AD.vid, AD.loc)); }
  function drawAdd() {
    var p = prodById(AD.pid), v = varOf(p, AD.vid), vs = p.variants || [], mx = adMax();
    if (AD.qty > mx) AD.qty = Math.max(1, mx);
    openSheet(head('เพิ่มลงตะกร้า') +
      '<div class="adh"><div class="th">' + thumb(p) + '</div><div><div class="pbig">฿' + fmt(AD.price) + '</div>' +
      '<small>' + esc(p.code + ' ' + p.name) + '</small><br><small>ต้นทุน ฿' + fmt(p.current_cost) + ' · เหลือ ' + lq(v, AD.loc) + ' ชิ้นที่ ' + esc(locName(AD.loc)) + '</small></div></div>' +
      '<div class="h3">ไซส์ / ลาย</div><div class="chips" style="flex-wrap:wrap">' + vs.map(function (x) {
        return '<button class="chip ' + (x.id === AD.vid ? 'on' : '') + '" data-a="adv" data-v="' + x.id + '">' + esc(vname(x)) + ' <small>(' + vq(x) + ')</small></button>';
      }).join('') + '</div>' +
      '<div class="h3">สถานที่</div><div class="chips" style="flex-wrap:wrap">' + S.locs.map(function (l) {
        return '<button class="chip ' + (l.id === AD.loc ? 'on' : '') + '" data-a="adl" data-v="' + l.id + '">' + esc(l.name) + ' <small>(' + lq(v, l.id) + ')</small></button>';
      }).join('') + '</div>' +
      '<div class="h3">จำนวน</div><div class="stp"><button type="button" class="sbn" data-a="stp" data-v="adq|-1" aria-label="ลด">' + ic('minus', 26) + '</button>' +
      '<input id="adq" type="number" inputmode="numeric" min="1" max="' + mx + '" value="' + AD.qty + '">' +
      '<button type="button" class="sbn" data-a="stp" data-v="adq|1" aria-label="เพิ่ม">' + ic('plus', 26) + '</button></div>' +
      '<label>ราคาขายจริง (บาท)<input id="adpx" type="number" inputmode="decimal" min="0" value="' + AD.price + '"></label>' +
      '<div class="err" id="ader">' + (mx < 1 ? 'ไซส์/ลายนี้ที่สถานที่นี้หมดสต๊อก (หรืออยู่ในตะกร้าครบแล้ว)' : '') + '</div>' +
      '<div class="btns"><button class="btn o" data-a="adadd">' + ic('cartplus', 20) + ' เพิ่มลงตะกร้า</button><button class="btn" data-a="adnow">ขายทันที</button></div>');
    $('adq').oninput = function () { AD.qty = parseInt(this.value) || 1; };
  }
  function readPrice() { var x = parseFloat($('adpx').value); if (!isNaN(x)) AD.price = x; }
  A.cadd = function (code) {
    var p = byCode(code);
    if (!p) return toast('ไม่พบสินค้า ' + code);
    var vs = p.variants || [];
    if (!vs.length) return toast('สินค้านี้ไม่มีรุ่นย่อย');
    var v = vs.find(function (x) { return vq(x) > 0; }) || vs[0];
    AD = { pid: p.id, vid: v.id, loc: firstLoc(v), qty: 1, price: Number(p.base_price) };
    drawAdd();
  };
  A.adv = function (id) { readPrice(); AD.vid = id; AD.loc = firstLoc(varOf(prodById(AD.pid), id)); AD.qty = 1; drawAdd(); };
  A.adl = function (id) { readPrice(); AD.loc = id; AD.qty = 1; drawAdd(); };
  function adCommit() {
    readPrice(); AD.qty = parseInt($('adq').value) || 0;
    var e = addToCart(AD.pid, AD.vid, AD.loc, AD.qty, AD.price);
    if (e) { $('ader').textContent = e; return false; }
    return true;
  }
  A.adadd = function () { if (adCommit()) { closeSheet(); toast('เพิ่มลงตะกร้าแล้ว'); } };
  A.adnow = function () { if (adCommit()) cartSheet(); };

  /* เพิ่มปุ่ม "เพิ่มลงตะกร้า" ในหน้าขายทันทีเดิม (ตอนสแกน QR) */
  var _sale = A.sale;
  A.sale = function (v) {
    _sale(v);
    var sf = $('sf'); if (!sf) return;
    var add = function () {
      if (!$('sgo') || $('sgo2')) return;
      $('sgo').insertAdjacentHTML('afterend', '<button class="btn o" id="sgo2" data-a="saletocart">' + ic('cartplus', 20) + ' เพิ่มลงตะกร้า (ขายหลายชิ้นพร้อมกัน)</button>');
    };
    add(); new MutationObserver(add).observe(sf, { childList: true });
  };
  A.saletocart = function () {
    var p = byCode($('sc').value);
    if (!p) return;
    var e = addToCart(p.id, $('sv2').value, $('sl').value, parseInt($('sq').value), parseFloat($('spx').value));
    if (e) { $('ser').textContent = e; return; }
    closeSheet(); toast('เพิ่มลงตะกร้าแล้ว');
  };

  /* ---------- หน้าตะกร้า ---------- */
  function totals() {
    var rev = 0, cost = 0, n = 0, below = 0;
    CART.forEach(function (it) {
      var p = prodById(it.pid); if (!p) return;
      rev += it.price * it.qty; cost += Number(p.current_cost) * it.qty; n += it.qty;
      if (it.price < Number(p.current_cost)) below++;
    });
    return { rev: rev, cost: cost, n: n, below: below };
  }
  function showTotals() {
    var t = totals(), el = $('ctot'); if (!el) return;
    el.innerHTML = 'สินค้ารวม ' + CART.length + ' รายการ (' + t.n + ' ชิ้น): <b>฿' + fmt(t.rev) + '</b><br><small>ต้นทุน ฿' + fmt(t.cost) + ' · กำไรขั้นต้น ฿' + fmt(t.rev - t.cost) + '</small>' +
      (t.below ? '<div class="lk">⚠ มี ' + t.below + ' รายการที่ราคาขายต่ำกว่าต้นทุน</div>' : '');
  }
  function cartSheet(msg) {
    cleanCart();
    if (!CART.length) {
      openSheet(head('ตะกร้าสินค้า') + (msg ? '<div class="note" style="margin-bottom:10px">' + esc(msg) + '</div>' : '') +
        '<div class="empty">ตะกร้ายังว่าง<br>กดปุ่มตะกร้าในหน้ารายละเอียดสินค้า หรือสแกน QR เพื่อเพิ่มสินค้า</div>' +
        '<button class="btn" data-a="scan">' + ic('qr', 20) + ' สแกน QR</button>');
      return;
    }
    openSheet(head('ตะกร้าสินค้า (' + cartQty() + ' ชิ้น)') +
      (msg ? '<div class="note" style="margin-bottom:10px;color:var(--red)">' + esc(msg) + '</div>' : '') +
      CART.map(function (it, i) {
        var p = prodById(it.pid), v = varOf(p, it.vid), st = lq(v, it.loc);
        return '<div class="cit"><div class="th">' + thumb(p) + '</div><div class="cib"><div class="cin">' + esc(p.code + ' ' + p.name) + '</div>' +
          '<small>' + esc(vname(v)) + ' · ' + esc(locName(it.loc)) + ' · เหลือ ' + st + '</small>' +
          (it.qty > st ? '<div class="lk">จำนวนเกินสต๊อก ลดจำนวนก่อน</div>' : '') +
          '<div class="cr"><div class="qs2"><button data-a="cq" data-v="' + i + '|-1" aria-label="ลด">−</button><b>' + it.qty + '</b><button data-a="cq" data-v="' + i + '|1" aria-label="เพิ่ม">+</button></div>' +
          '<label class="cpx">฿<input data-ci="' + i + '" type="number" inputmode="decimal" min="0" value="' + it.price + '"></label>' +
          '<button class="cx" data-a="cdel" data-v="' + i + '" aria-label="เอาออก">' + ic('x', 20) + '</button></div></div></div>';
      }).join('') +
      '<div class="h3">วิธีชำระเงิน</div><div class="chips" style="flex-wrap:wrap">' + Object.keys(PMN).map(function (k) {
        return '<button class="chip ' + (k === cpay ? 'on' : '') + '" data-a="cpay" data-v="' + k + '">' + PMN[k] + '</button>';
      }).join('') + '</div><div class="ctot" id="ctot"></div><div class="err" id="cer"></div>' +
      '<button class="btn" id="cgo" data-a="cartgo">ยืนยันขาย</button>' +
      '<button class="btn o dng" data-a="cclear">ล้างตะกร้า</button>');
    showTotals();
  }
  A.cart = function () { cartSheet(); };
  document.addEventListener('input', function (e) {
    var i = e.target && e.target.dataset && e.target.dataset.ci;
    if (i === undefined || !CART[i]) return;
    CART[i].price = parseFloat(e.target.value) || 0; CART[i].key = uuid(); saveCart(); showTotals();
  });
  A.cq = function (v) {
    var a = v.split('|'), it = CART[+a[0]]; if (!it) return;
    var st = lq(varOf(prodById(it.pid), it.vid), it.loc);
    it.qty = Math.max(1, Math.min(st, it.qty + parseInt(a[1]))); it.key = uuid(); saveCart(); cartSheet();
  };
  A.cdel = function (v) { CART.splice(+v, 1); saveCart(); cartSheet(); };
  A.cclear = function () { if (!confirm('ล้างสินค้าทั้งหมดในตะกร้า?')) return; CART = []; saveCart(); cartSheet(); };
  A.cpay = function (v) {
    cpay = v; try { localStorage.setItem('pay', v); } catch (e) {}
    document.querySelectorAll('#sbody .chips .chip[data-a="cpay"]').forEach(function (c) { c.classList.toggle('on', c.dataset.v === v); });
  };
  var cbusy = false;
  A.cartgo = async function () {
    if (cbusy || !CART.length) return;
    var er = function (m) { var e = $('cer'); if (e) e.textContent = m; };
    for (var i = 0; i < CART.length; i++) {
      var it = CART[i], v = varOf(prodById(it.pid), it.vid);
      if (!v || it.qty > lq(v, it.loc)) return er('มีรายการที่จำนวนเกินสต๊อก กรุณาแก้ไขก่อน');
      if (!(it.qty >= 1) || !(it.price >= 0)) return er('ตรวจสอบจำนวนและราคาให้ครบ');
    }
    var t0 = totals();
    if (t0.below && !(await modal('มี ' + t0.below + ' รายการที่ราคาขายต่ำกว่าต้นทุน\nยืนยันขายหรือไม่?'))) return;
    cbusy = true;
    var btn = $('cgo'); if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
    var done = [], fail = '', rev = 0, gp = 0;
    var list = CART.slice();
    for (var k = 0; k < list.length; k++) {
      var x = list[k];
      var r = await S.sb.rpc('record_sale', { p_variant_id: x.vid, p_location_id: x.loc, p_qty: x.qty, p_price: x.price, p_method: cpay, p_key: x.key });
      if (r.error) { fail = r.error.message || String(r.error); break; }
      var s = r.data || {};
      var q = s.qty || x.qty, up = Number(s.unit_price != null ? s.unit_price : x.price), uc = Number(s.unit_cost != null ? s.unit_cost : 0);
      rev += up * q; gp += (up - uc) * q;
      done.push({ pid: x.pid, vid: x.vid, q: q, up: up });
      CART = CART.filter(function (c) { return c.key !== x.key; });
      saveCart();
    }
    cbusy = false;
    await load();
    if (fail) return cartSheet('ขายสำเร็จ ' + done.length + ' รายการ แต่รายการถัดไปผิดพลาด: ' + fail + '\nรายการที่ขายแล้วถูกเอาออกจากตะกร้า ตรวจสอบแล้วกดยืนยันอีกครั้งสำหรับที่เหลือ');
    openSheet(head('ขายสำเร็จ') + '<div class="okb">' + ic('check', 44) + '</div>' +
      '<h3 style="text-align:center;margin-bottom:10px">ขายแล้ว ' + done.length + ' รายการ</h3>' +
      done.map(function (d) {
        var p = prodById(d.pid), v = varOf(p, d.vid);
        return '<div class="kv"><span>' + esc(p ? p.code + ' ' + p.name : 'สินค้า') + '<br><small>' + esc(v ? vname(v) : '') + ' ×' + d.q + '</small></span><b>฿' + fmt(d.up * d.q) + '</b></div>';
      }).join('') + kv('รายรับรวม', '฿' + fmt(rev)) + kv('กำไรขั้นต้น', '฿' + fmt(gp)) + kv('ชำระด้วย', PMN[cpay]) +
      '<div class="btns"><button class="btn o" data-a="close">เสร็จสิ้น</button><button class="btn" data-a="go" data-v="ord">ดูประวัติการขาย</button></div>');
  };

  /* ---------- หน้าประวัติการขาย (แบบรูปที่ 4) ---------- */
  var OR = { tab: 'all', groups: [] };
  function groupRows(rows) {
    var g = [], cur = null;
    rows.forEach(function (x) {
      var t = new Date(x.created_at).getTime();
      if (cur && cur.pm === x.payment_method && Math.abs(cur.t - t) <= 90000) { cur.lines.push(x); cur.t = t; }
      else { cur = { pm: x.payment_method, t: t, lines: [x] }; g.push(cur); }
    });
    return g;
  }
  function line(x) {
    var p = prodById(x.product_id), vd = !!x.voided_at;
    return '<div class="ol" style="' + (vd ? 'opacity:.55' : '') + '"><div class="oth">' + (p ? thumb(p) : '📦') + '</div><div class="oi"><div class="on">' +
      esc(p ? p.code + ' ' + p.name : 'สินค้า (ถูกลบแล้ว)') + '</div><div class="ov">' + esc(vname(x.variants || {})) + ' · ' + esc((x.locations || {}).name || '') + (vd ? ' · ยกเลิกแล้ว' : '') +
      '</div><div class="op"><span>x' + x.qty + '</span><b>' + (vd ? '<s>' : '') + '฿' + fmt(x.unit_price * x.qty) + (vd ? '</s>' : '') + '</b></div></div></div>';
  }
  async function ordPage() {
    var tabs = [['all', 'ทั้งหมด'], ['ok', 'สำเร็จ'], ['vd', 'ยกเลิกแล้ว']];
    $('view').innerHTML = '<h2>ประวัติการขาย</h2><div class="otabs">' + tabs.map(function (t) {
      return '<button data-a="ordtab" data-v="' + t[0] + '" class="' + (OR.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
    }).join('') + '</div><div id="ordb"><div class="empty">กำลังโหลด...</div></div>';
    var r = await S.sb.from('sales').select('*,variants(size,pattern),locations(name)').order('created_at', { ascending: false }).limit(300);
    if (S.cur !== 'ord' || !$('ordb')) return;
    if (r.error) { $('ordb').innerHTML = '<div class="card empty">โหลดไม่สำเร็จ: ' + esc(r.error.message) + '</div>'; return; }
    OR.groups = groupRows(r.data);
    var G = OR.groups.map(function (g, i) { g.i = i; return g; });
    var shown = G.filter(function (g) {
      var allV = g.lines.every(function (x) { return x.voided_at; }), anyV = g.lines.some(function (x) { return x.voided_at; });
      return OR.tab === 'all' || (OR.tab === 'ok' && !allV) || (OR.tab === 'vd' && anyV);
    });
    var seen = {}, rec = [];
    G.forEach(function (g) { g.lines.forEach(function (x) { if (!x.voided_at && !seen[x.product_id] && rec.length < 3 && prodById(x.product_id)) { seen[x.product_id] = 1; rec.push(prodById(x.product_id)); } }); });
    var h = rec.length && OR.tab === 'all' ? '<div class="rpt"><div>' + ic('spark', 20) + ' ขายซ้ำอีกครั้ง</div>' + rec.map(function (p) {
      return '<div class="rpr"><div class="oth" style="width:64px;height:64px;flex-basis:64px">' + thumb(p) + '</div><div class="oi"><div class="on">' + esc(p.code + ' ' + p.name) +
        '</div><b style="color:var(--pri)">฿' + fmt(p.base_price) + '</b></div><button class="obtn f" data-a="cadd" data-v="' + esc(p.code) + '">ขายอีกครั้ง</button></div>';
    }).join('') + '</div>' : '';
    h += shown.map(function (g) {
      var live = g.lines.filter(function (x) { return !x.voided_at; }), allV = !live.length;
      var tot = (allV ? g.lines : live).reduce(function (a, x) { return a + x.unit_price * x.qty; }, 0);
      var dt = new Date(g.t).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
      var first = g.lines[0], rest = g.lines.slice(1);
      return '<div class="oc"><div class="oh"><span class="obd">' + (PMN[g.pm] || 'อื่น ๆ') + '</span><small>' + dt + '</small><span class="ost ' + (allV ? 'vd' : 'ok') + '">' + (allV ? 'ยกเลิกแล้ว' : 'สำเร็จ') + '</span></div>' +
        line(first) + (rest.length ? '<details><summary>ดูเพิ่มเติม (' + rest.length + ') ⌄</summary>' + rest.map(line).join('') + '</details>' : '') +
        '<div class="ot">สินค้ารวม ' + g.lines.length + ' รายการ: <b>฿' + fmt(tot) + '</b></div><div class="ob">' +
        (allV ? '' : '<button class="obtn r" data-a="ordvoid" data-v="' + g.i + '">ยกเลิกการขาย</button>') +
        '<button class="obtn f" data-a="ordagain" data-v="' + g.i + '">ขายอีกครั้ง</button></div></div>';
    }).join('') || '<div class="empty">ยังไม่มีรายการ</div>';
    $('ordb').innerHTML = h;
  }
  var _r = render;
  render = function () {
    _r();
    if (S.ready && S.cur === 'ord') { $('sw').style.display = 'none'; ordPage(); }
  };
  A.ordtab = function (v) { OR.tab = v; ordPage(); };
  A.ordagain = function (i) {
    var g = OR.groups[+i]; if (!g) return;
    var okN = 0, err = '';
    g.lines.forEach(function (x) {
      var p = prodById(x.product_id); if (!p) return;
      var vid = x.variant_id, loc = x.location_id;
      if (!varOf(p, vid)) {
        var m = (p.variants || []).find(function (v) { return (v.size || '') === ((x.variants || {}).size || '') && (v.pattern || '') === ((x.variants || {}).pattern || ''); });
        vid = m && m.id;
      }
      if (!S.locs.some(function (l) { return l.id === loc; })) {
        var l = S.locs.find(function (z) { return z.name === (x.locations || {}).name; }); loc = l && l.id;
      }
      var e = vid && loc ? addToCart(p.id, vid, loc, x.qty, Number(x.unit_price)) : 'ไม่พบรุ่น/สถานที่เดิม';
      if (e) err = e; else okN++;
    });
    if (okN) cartSheet(err ? 'เพิ่มได้ ' + okN + ' รายการ บางรายการเพิ่มไม่ได้: ' + err : '');
    else toast('เพิ่มไม่ได้: ' + (err || 'ไม่พบสินค้า'));
  };
  var vbusy = false;
  A.ordvoid = async function (i) {
    var g = OR.groups[+i]; if (!g || vbusy) return;
    if (!confirm('ยกเลิกการขายนี้?\nสินค้าจะคืนเข้าสต๊อกที่เดิม และไม่นับเป็นยอดขาย (ยังเก็บประวัติไว้)')) return;
    vbusy = true;
    var okN = 0, err = '';
    for (var k = 0; k < g.lines.length; k++) {
      if (g.lines[k].voided_at) continue;
      var r = await S.sb.rpc('void_sale', { p_sale_id: g.lines[k].id, p_reason: 'กดผิด/ลงผิด' });
      if (r.error) { err = r.error.message; break; } okN++;
    }
    vbusy = false;
    await load();
    toast(err ? 'ยกเลิกได้ ' + okN + ' รายการ ผิดพลาด: ' + err : 'ยกเลิกการขายแล้ว คืนสินค้าเข้าสต๊อกแล้ว');
  };

  /* ---------- แทนที่ prompt() (บางแอปไม่แสดง) ด้วยหน้าต่างของเรา ---------- */
  A.catren = function (id) {
    var c = S.cats.find(function (x) { return x.id === id; }); if (!c) return;
    openSheet(head('แก้ชื่อประเภท') + '<small>รหัสสินค้าเดิม (' + esc(c.prefix) + '-xxx) จะไม่เปลี่ยน</small><label>ชื่อประเภทใหม่<input id="crn" value="' + esc(c.name) + '"></label><div class="err" id="crer"></div>' +
      '<button class="btn" data-a="catrensave" data-v="' + id + '">บันทึก</button>');
  };
  A.catrensave = async function (id) {
    var n = $('crn').value.trim();
    if (!n) { $('crer').textContent = 'ใส่ชื่อประเภท'; return; }
    var r = await S.sb.from('categories').update({ name: n }).eq('id', id);
    if (r.error) { $('crer').textContent = 'บันทึกไม่สำเร็จ: ' + r.error.message; return; }
    closeSheet(); await load(); toast('แก้ชื่อประเภทแล้ว');
  };
  A.locadd = function () {
    openSheet(head('เพิ่มสถานที่จัดเก็บ') + '<label>ชื่อสถานที่<input id="lcn" placeholder="เช่น คลังสำรอง"></label><div class="err" id="lcer"></div><button class="btn" data-a="locsave">บันทึก</button>');
  };
  A.locsave = async function () {
    var n = $('lcn').value.trim();
    if (!n) { $('lcer').textContent = 'ใส่ชื่อสถานที่'; return; }
    var r = await S.sb.from('locations').insert({ name: n });
    if (r.error) { $('lcer').textContent = 'บันทึกไม่สำเร็จ: ' + r.error.message; return; }
    closeSheet(); await load(); toast('เพิ่มสถานที่แล้ว');
  };

  /* ---------- ห่อปุ่มทั้งหมดให้ใช้กล่องยืนยันของเรา (ต้องอยู่ท้ายสุด) ---------- */
  Object.keys(A).forEach(wrapA);
  window.confirmFix = { wrapA: wrapA };
  if (S.ready) { cleanCart(); render(); }
})();
