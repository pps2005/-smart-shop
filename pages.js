/* Xiress add-on: pages.js  (รายงาน / AI Assistant / ตั้งค่า / ปัดซ้ายหน้าอสังหาเช่า)
   Load LAST in index.html:  <script src="pages.js"></script>
   To undo: delete that one line from index.html. */
(function () {
  var css = document.createElement('style');
  css.textContent = [
    '.swp-w>.rc{position:relative;z-index:1;margin:0;touch-action:pan-y;user-select:none;-webkit-user-select:none;transition:transform .2s}',
    '.swp-w.rw{margin-bottom:10px;border-radius:16px}',
    '.pgh{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}',
    '.ans{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin-bottom:10px}',
    '.ans h3{margin:0 0 6px}.ans .q{color:var(--mute);font-size:.85rem;margin-bottom:6px}',
    '.ans li{margin:4px 0}.ans ul{padding-left:18px;margin:6px 0}',
    '.set-i{width:100%;padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--text);margin:6px 0}',
    '.rbar{height:8px;border-radius:99px;background:var(--line);overflow:hidden;margin-top:4px}.rbar>i{display:block;height:100%;background:var(--pri2)}'
  ].join('');
  document.head.appendChild(css);

  /* ---------- helpers ---------- */
  var EXK = { rent: 'ค่าเช่า', water: 'ค่าน้ำ', electric: 'ค่าไฟ', travel: 'ค่าเดินทาง', labor: 'ค่าแรง', packaging: 'บรรจุภัณฑ์', other: 'อื่น ๆ' };
  var PMT = { cash: 'เงินสด', card: 'บัตร', transfer: 'โอนเงิน', other: 'อื่น ๆ' };
  function F(n) { return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 }); }
  function SG(n) { return (n > 0 ? '+' : n < 0 ? '-' : '') + F(Math.abs(n)); }
  function bkk(d) { return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); }
  function todayS() { return bkk(new Date()); }
  function dm(s) { var a = s.split('-'); return Date.UTC(+a[0], +a[1] - 1, +a[2]); }
  function ds(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function addD(s, n) { return ds(dm(s) + n * 86400000); }
  function thd(s) { return new Date(dm(s)).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
  function pqty(p) { return (p.variants || []).reduce(function (a, v) { return a + (v.stock_levels || []).reduce(function (b, x) { return b + x.qty; }, 0); }, 0); }
  function prod(id) { return (S.prods || []).find(function (p) { return p.id === id; }); }
  function pname(id) { var p = prod(id); return p ? p.code + ' ' + p.name : 'สินค้า'; }
  function thr() { try { return parseInt(localStorage.getItem('ss_low')) || 3; } catch (e) { return 3; } }

  // ดึงข้อมูลทีละ 1000 แถว (Supabase จำกัดต่อครั้ง)
  async function all(mk) {
    var out = [];
    for (var i = 0; i < 30; i++) {
      var r = await mk().range(i * 1000, i * 1000 + 999);
      if (r.error) throw r.error;
      out = out.concat(r.data);
      if (r.data.length < 1000) break;
    }
    return out;
  }
  function csvText(head, rows) {
    var q = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return '\ufeff' + [head].concat(rows).map(function (r) { return r.map(q).join(','); }).join('\r\n');
  }
  function download(name, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  /* ---------- ปัดซ้ายหน้าอสังหาเช่า ---------- */
  var W = 160, openW = null;
  function closeSw() { if (openW) { openW.style.transform = ''; openW = null; } }
  function bind(c) {
    var sx = 0, sy = 0, base = 0, pos = 0, lock = null, down = false, moved = false;
    c.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = true; lock = null; moved = false; sx = e.clientX; sy = e.clientY;
      base = openW === c ? -W : 0; pos = base;
      if (openW && openW !== c) closeSw();
    });
    c.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (lock === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (lock === 'x') { try { c.setPointerCapture(e.pointerId); } catch (_) {} c.style.transition = 'none'; }
      }
      if (lock !== 'x') return;
      moved = true; pos = Math.max(-W, Math.min(0, base + dx)); c.style.transform = 'translateX(' + pos + 'px)';
    });
    function end() {
      if (!down) return; down = false;
      if (lock !== 'x') return;
      c.style.transition = '';
      if (pos < -W / 2) { c.style.transform = 'translateX(-' + W + 'px)'; if (openW && openW !== c) closeSw(); openW = c; }
      else { c.style.transform = ''; if (openW === c) openW = null; }
    }
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    c.addEventListener('click', function (e) {
      if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; return; }
      if (openW === c) { e.stopPropagation(); e.preventDefault(); closeSw(); }
    }, true);
  }
  function swipeRent() {
    var v = $('view'); if (!v) return;
    openW = null;
    Array.prototype.forEach.call(v.querySelectorAll('.rc[data-a="runit"]'), function (c) {
      if (c.parentNode.classList.contains('swp-w')) return;
      var id = c.dataset.v, w = document.createElement('div');
      w.className = 'swp-w rw';
      w.innerHTML = '<div class="swp-a"><button type="button" class="swp-e" data-a="rswe" data-v="' + id + '">' + ic('edit', 22) + '<span>แก้ไข</span></button>' +
        '<button type="button" class="swp-d" data-a="rswd" data-v="' + id + '">' + ic('trash', 22) + '<span>ลบ</span></button></div>';
      c.parentNode.insertBefore(w, c); w.appendChild(c); bind(c);
    });
    var ch = v.querySelector('.chips');
    if (ch && !v.querySelector('#swh')) ch.insertAdjacentHTML('beforebegin', '<small id="swh" style="display:block;color:var(--mute);margin:4px 2px">ปัดการ์ดห้องไปทางซ้ายเพื่อแก้ไขหรือลบ</small>');
  }
  document.addEventListener('pointerdown', function (e) { if (openW && !openW.parentNode.contains(e.target)) closeSw(); }, true);
  A.rswe = function (id) { closeSw(); A.redu(id); };
  A.rswd = function (id) { closeSw(); if (A.dunit) A.dunit(id); else toast('ลบห้องไม่ได้'); };

  /* ---------- รายงาน ---------- */
  var RP = { tab: 'month', off: 0, tok: 0, data: null };
  function rng() {
    var t = todayS(), s, e, label;
    if (RP.tab === 'day') { s = addD(t, RP.off); e = addD(s, 1); label = thd(s); }
    else if (RP.tab === 'week') {
      var d = new Date(dm(t)), mon = ds(dm(t) - ((d.getUTCDay() + 6) % 7) * 86400000);
      s = addD(mon, RP.off * 7); e = addD(s, 7); label = thd(s) + ' – ' + thd(addD(e, -1));
    } else if (RP.tab === 'month') {
      var a = t.split('-'), y = +a[0], m = +a[1] - 1 + RP.off; var s0 = new Date(Date.UTC(y, m, 1));
      s = ds(s0.getTime()); e = ds(Date.UTC(s0.getUTCFullYear(), s0.getUTCMonth() + 1, 1));
      label = s0.toLocaleDateString('th-TH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    } else {
      var y2 = +t.slice(0, 4) + RP.off; s = y2 + '-01-01'; e = (y2 + 1) + '-01-01';
      label = 'ปี ' + (y2 + 543);
    }
    return { s: s, e: e, label: label };
  }
  function repShell() {
    var tabs = [['day', 'วัน'], ['week', 'สัปดาห์'], ['month', 'เดือน'], ['year', 'ปี']];
    return '<h2>รายงาน</h2><div class="seg">' + tabs.map(function (x) {
      return '<button data-a="rptab" data-v="' + x[0] + '" class="' + (RP.tab === x[0] ? 'on' : '') + '">' + x[1] + '</button>';
    }).join('') + '</div><div class="ovn"><button data-a="rpprev" aria-label="ก่อนหน้า">‹</button><b id="rpl"></b><button data-a="rpnext" aria-label="ถัดไป">›</button></div><div id="rpb"><div class="empty">กำลังโหลด...</div></div>';
  }
  async function repLoad() {
    var tok = ++RP.tok, r = rng(); if (!$('rpb')) return;
    $('rpl').textContent = r.label;
    try {
      var a = r.s + 'T00:00:00+07:00', b = r.e + 'T00:00:00+07:00';
      var res = await Promise.all([
        all(function () { return S.sb.from('sales').select('product_id,qty,unit_price,unit_cost,payment_method,created_at').is('voided_at', null).gte('created_at', a).lt('created_at', b).order('created_at'); }),
        all(function () { return S.sb.from('expenses').select('kind,amount,paid_on,payment_method,note').is('voided_at', null).gte('paid_on', r.s).lt('paid_on', r.e).order('paid_on'); }),
        all(function () { return S.sb.from('rent_receipts').select('amount,paid_on,method').eq('cancelled', false).gte('paid_on', r.s).lt('paid_on', r.e).order('paid_on'); }),
        all(function () { return S.sb.from('unit_costs').select('amount,paid_on,kind').gte('paid_on', r.s).lt('paid_on', r.e).order('paid_on'); })
      ]);
      if (tok !== RP.tok || !$('rpb')) return;
      RP.data = { r: r, sales: res[0], exps: res[1], rec: res[2], mc: res[3] };
      repDraw();
    } catch (ex) { if ($('rpb')) $('rpb').innerHTML = '<div class="card empty">โหลดรายงานไม่สำเร็จ: ' + esc(ex.message || ex) + '</div>'; }
  }
  function bars(rows, total) {
    return rows.map(function (x) {
      return '<div style="margin:8px 0"><div class="kv" style="margin:0"><span>' + esc(x[0]) + '</span><b>฿' + F(x[1]) + '</b></div><div class="rbar"><i style="width:' + (total > 0 ? Math.max(2, x[1] / total * 100) : 0) + '%"></i></div></div>';
    }).join('');
  }
  function repDraw() {
    var D = RP.data, rev = 0, cost = 0, n = 0, bypm = {}, bycat = {}, byp = {};
    D.sales.forEach(function (x) {
      var rv = x.unit_price * x.qty, c = x.unit_cost * x.qty, p = prod(x.product_id), cn = p && p.categories ? p.categories.name : 'อื่น ๆ';
      rev += rv; cost += c; n += x.qty;
      bypm[x.payment_method] = (bypm[x.payment_method] || 0) + rv;
      bycat[cn] = (bycat[cn] || 0) + rv;
      var o = byp[x.product_id] || (byp[x.product_id] = { q: 0, rev: 0, g: 0 }); o.q += x.qty; o.rev += rv; o.g += rv - c;
    });
    var gross = rev - cost, exp = D.exps.reduce(function (a, x) { return a + Number(x.amount); }, 0), net = gross - exp;
    var rent = D.rec.reduce(function (a, x) { return a + Number(x.amount); }, 0), mc = D.mc.reduce(function (a, x) { return a + Number(x.amount); }, 0);
    var byk = {}; D.exps.forEach(function (x) { byk[x.kind] = (byk[x.kind] || 0) + Number(x.amount); });
    var top = Object.keys(byp).sort(function (a, b) { return byp[b].q - byp[a].q; }).slice(0, 10);
    var h = '<div class="grid">' +
      '<div class="card"><small>ยอดขาย (' + F(n) + ' ชิ้น)</small><b class="v">฿' + F(rev) + '</b></div>' +
      '<div class="card"><small>ต้นทุนขาย</small><b class="v">฿' + F(cost) + '</b></div>' +
      '<div class="card"><small>กำไรขั้นต้น</small><b class="v">฿' + F(gross) + '</b></div>' +
      '<div class="card"><small>รายจ่าย</small><b class="v">฿' + F(exp) + '</b></div></div>' +
      '<div class="card"><small>กำไรหลังหักรายจ่าย (ร้านค้า)</small><b class="v ' + (net >= 0 ? 'ovp' : 'ovm') + '">฿' + SG(net) + '</b></div>';
    if (!D.sales.length && !D.exps.length) h += '<div class="note">ยังไม่มีรายการขายหรือรายจ่ายในช่วงนี้</div>';
    h += '<details class="ovd" open><summary>แยกวิธีชำระเงิน</summary>' + (Object.keys(bypm).length ? bars(Object.keys(bypm).map(function (k) { return [PMT[k] || k, bypm[k]]; }), rev) : '<small>ไม่มีข้อมูล</small>') + '</details>';
    h += '<details class="ovd"><summary>แยกตามประเภทสินค้า</summary>' + (Object.keys(bycat).length ? bars(Object.keys(bycat).sort(function (a, b) { return bycat[b] - bycat[a]; }).map(function (k) { return [k, bycat[k]]; }), rev) : '<small>ไม่มีข้อมูล</small>') + '</details>';
    h += '<details class="ovd"><summary>สินค้าขายดี (รุ่น)</summary>' + (top.length ? top.map(function (id) {
      var o = byp[id], p = prod(id);
      return '<button class="row" style="width:100%;text-align:left" ' + (p ? 'data-a="open" data-v="' + esc(p.code) + '"' : '') + '><div class="gr">' + esc(pname(id)) + '<br><small>ขาย ' + o.q + ' ชิ้น · ฿' + F(o.rev) + '</small></div><b class="' + (o.g >= 0 ? 'ovp' : 'ovm') + '">กำไร ' + SG(o.g) + '</b></button>';
    }).join('') : '<small>ไม่มีข้อมูล</small>') + '</details>';
    h += '<details class="ovd"><summary>รายจ่ายแยกประเภท</summary>' + (Object.keys(byk).length ? bars(Object.keys(byk).sort(function (a, b) { return byk[b] - byk[a]; }).map(function (k) { return [EXK[k] || k, byk[k]]; }), exp) : '<small>ไม่มีข้อมูล</small>') + '</details>';
    h += '<details class="ovd"><summary>อสังหาเช่า (แยกจากร้านค้า)</summary>' +
      '<div class="kv"><span>รับค่าเช่า</span><b>฿' + F(rent) + '</b></div><div class="kv"><span>ค่าซ่อมบำรุง/อุปกรณ์</span><b>฿' + F(mc) + '</b></div>' +
      '<div class="kv"><span>คงเหลือจากค่าเช่า</span><b class="' + (rent - mc >= 0 ? 'ovp' : 'ovm') + '">฿' + SG(rent - mc) + '</b></div></details>';
    h += '<button class="btn o" data-a="rpcsv">ดาวน์โหลดรายการขายช่วงนี้ (CSV)</button>';
    $('rpb').innerHTML = h;
  }
  A.rptab = function (v) { RP.tab = v; RP.off = 0; render(); };
  A.rpprev = function () { RP.off--; repLoad(); };
  A.rpnext = function () { RP.off++; repLoad(); };
  A.rpcsv = function () {
    var D = RP.data; if (!D) return;
    download('sales_' + D.r.s + '_' + addD(D.r.e, -1) + '.csv', csvText(['วันที่เวลา', 'สินค้า', 'จำนวน', 'ราคาขาย', 'ต้นทุน', 'ชำระด้วย'],
      D.sales.map(function (x) { return [new Date(x.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }), pname(x.product_id), x.qty, x.unit_price, x.unit_cost, PMT[x.payment_method] || x.payment_method]; })));
  };

  /* ---------- AI Assistant (ตอบจากฐานข้อมูลจริง ไม่เรียก AI API) ---------- */
  var QS = [
    ['sales', 'วันนี้ขายได้เท่าไหร่?'], ['profit', 'วันนี้กำไรเท่าไหร่?'], ['best', 'สินค้าไหนขายดีที่สุด?'], ['restock', 'ควรเติมสินค้าอะไร?'],
    ['dead', 'สินค้าอะไรค้างสต๊อก?'], ['abn', 'มีรายจ่ายอะไรผิดปกติ?'], ['price', 'ควรปรับราคาอะไร?'], ['cost', 'มีวิธีลดต้นทุนไหม?']
  ];
  var AI = { ans: [], busy: false, cache: null, at: 0 };
  async function aiData() {
    if (AI.cache && Date.now() - AI.at < 60000) return AI.cache;
    var t = todayS();
    var r = await Promise.all([
      all(function () { return S.sb.from('sales').select('product_id,qty,unit_price,unit_cost,created_at').is('voided_at', null).gte('created_at', addD(t, -90) + 'T00:00:00+07:00').order('created_at'); }),
      all(function () { return S.sb.from('expenses').select('kind,amount,paid_on').is('voided_at', null).gte('paid_on', addD(t, -120)).order('paid_on'); })
    ]);
    AI.cache = { sales: r[0], exps: r[1], t: t }; AI.at = Date.now(); return AI.cache;
  }
  function li(a) { return '<ul>' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; }
  function answer(k, D) {
    var t = D.t, sl = D.sales, ex = D.exps, T = thr();
    var since = function (n) { return sl.filter(function (x) { return bkk(x.created_at) > addD(t, -n); }); };
    var sum = function (a, f) { return a.reduce(function (s, x) { return s + f(x); }, 0); };
    var rv = function (x) { return x.unit_price * x.qty; }, gp = function (x) { return (x.unit_price - x.unit_cost) * x.qty; };
    if (k === 'sales' || k === 'profit') {
      var td = sl.filter(function (x) { return bkk(x.created_at) === t; }), te = ex.filter(function (x) { return x.paid_on === t; });
      if (!td.length && !te.length) return ['ข้อมูลวันที่ ' + thd(t), 'วันนี้ยังไม่มีรายการขายหรือรายจ่ายในระบบ'];
      var g = sum(td, gp), e = sum(te, function (x) { return Number(x.amount); });
      return k === 'sales'
        ? ['ข้อมูลวันที่ ' + thd(t), li(['ยอดขาย ฿' + F(sum(td, rv)) + ' (' + F(sum(td, function (x) { return x.qty; })) + ' ชิ้น, ' + td.length + ' รายการ)'])]
        : ['ข้อมูลวันที่ ' + thd(t), li(['กำไรขั้นต้น ฿' + F(g), 'รายจ่ายวันนี้ ฿' + F(e), '<b>กำไรหลังหักรายจ่าย ฿' + SG(g - e) + '</b>'])];
    }
    if (k === 'best') {
      var s30 = since(30), m = {}; s30.forEach(function (x) { var o = m[x.product_id] || (m[x.product_id] = { q: 0, r: 0, g: 0 }); o.q += x.qty; o.r += rv(x); o.g += gp(x); });
      var ids = Object.keys(m).sort(function (a, b) { return m[b].q - m[a].q; }).slice(0, 5);
      if (!ids.length) return ['ข้อมูล 30 วันล่าสุด', 'ยังไม่มียอดขายในช่วงนี้ ข้อมูลไม่เพียงพอ'];
      return ['ข้อมูล 30 วันล่าสุด (' + thd(addD(t, -29)) + ' – ' + thd(t) + ')', li(ids.map(function (id) { return esc(pname(id)) + ' ขาย ' + m[id].q + ' ชิ้น · ฿' + F(m[id].r) + ' · กำไร ฿' + F(m[id].g); }))];
    }
    if (k === 'restock') {
      var s3 = since(30), q = {}; s3.forEach(function (x) { q[x.product_id] = (q[x.product_id] || 0) + x.qty; });
      var c = (S.prods || []).filter(function (p) { return p.status !== 'black' && q[p.id] && pqty(p) <= Math.max(T, Math.ceil(q[p.id] / 30 * 7)); })
        .sort(function (a, b) { return (pqty(a) / q[a.id]) - (pqty(b) / q[b.id]); }).slice(0, 8);
      if (!c.length) return ['ข้อมูลขาย 30 วันล่าสุด · เกณฑ์ใกล้หมด ≤ ' + T + ' ชิ้นหรือพอขายไม่ถึง 7 วัน', 'ไม่มีสินค้าที่ขายอยู่และใกล้หมดตอนนี้'];
      return ['ข้อมูลขาย 30 วันล่าสุด · เกณฑ์ใกล้หมด ≤ ' + T + ' ชิ้นหรือพอขายไม่ถึง 7 วัน', li(c.map(function (p) { var d = pqty(p) / (q[p.id] / 30); return esc(p.code + ' ' + p.name) + ' เหลือ ' + pqty(p) + ' ชิ้น · ขาย ' + q[p.id] + ' ชิ้น/30 วัน · พอขายราว ' + (d < 1 ? '<1' : Math.floor(d)) + ' วัน'; }))];
    }
    if (k === 'dead') {
      var sold = {}; since(60).forEach(function (x) { sold[x.product_id] = 1; });
      var d = (S.prods || []).filter(function (p) { return p.status !== 'black' && pqty(p) > 0 && !sold[p.id] && bkk(p.created_at) <= addD(t, -60); })
        .sort(function (a, b) { return pqty(b) * b.current_cost - pqty(a) * a.current_cost; });
      if (!d.length) return ['ข้อมูลขาย 60 ล่าสุด · เฉพาะสินค้าที่เพิ่มมาเกิน 60 วัน', 'ไม่พบสินค้าที่ค้างสต๊อกนานเกิน 60 วัน'];
      return ['ข้อมูลขาย 60 วันล่าสุด · สินค้าที่ไม่มียอดขายเลย', li(['รวมทุนจม ฿' + F(sum(d, function (p) { return pqty(p) * p.current_cost; })) + ' จาก ' + d.length + ' รุ่น'].concat(d.slice(0, 6).map(function (p) { return esc(p.code + ' ' + p.name) + ' ' + pqty(p) + ' ชิ้น · ทุน ฿' + F(pqty(p) * p.current_cost); })))];
    }
    if (k === 'abn') {
      var ym = t.slice(0, 7), by = {}; ex.forEach(function (x) { var mo = x.paid_on.slice(0, 7); (by[x.kind] = by[x.kind] || {})[mo] = ((by[x.kind] || {})[mo] || 0) + Number(x.amount); });
      var months = {}; ex.forEach(function (x) { months[x.paid_on.slice(0, 7)] = 1; });
      var prev = Object.keys(months).filter(function (mo) { return mo < ym; });
      if (prev.length < 2) return ['ข้อมูลรายจ่าย 120 วันล่าสุด', 'ข้อมูลรายจ่ายย้อนหลังยังไม่ถึง 2 เดือน ไม่เพียงพอจะบอกว่าผิดปกติ'];
      var out = [];
      Object.keys(by).forEach(function (kd) {
        var avg = sum(prev, function (mo) { return by[kd][mo] || 0; }) / prev.length, cur = by[kd][ym] || 0;
        if (avg > 0 && cur > avg * 1.5 && cur - avg >= 500) out.push((EXK[kd] || kd) + ' เดือนนี้ ฿' + F(cur) + ' สูงกว่าค่าเฉลี่ย ฿' + F(avg) + ' (' + Math.round(cur / avg * 100 - 100) + '%)');
      });
      return ['เทียบเดือนนี้กับค่าเฉลี่ย ' + prev.length + ' เดือนก่อนหน้า', out.length ? li(out) : 'ไม่พบรายจ่ายที่สูงผิดปกติ'];
    }
    if (k === 'price') {
      var s2 = since(30), m2 = {}; s2.forEach(function (x) { var o = m2[x.product_id] || (m2[x.product_id] = { q: 0, r: 0, c: 0 }); o.q += x.qty; o.r += rv(x); o.c += x.unit_cost * x.qty; });
      var res = [];
      Object.keys(m2).forEach(function (id) {
        var o = m2[id], p = prod(id), mg = o.r > 0 ? (o.r - o.c) / o.r : 0, avgp = o.r / o.q;
        if (mg < 0) res.push([mg, esc(pname(id)) + ' ขาดทุน (ราคาขายจริงเฉลี่ย ฿' + F(avgp) + ' ต่ำกว่าทุน)']);
        else if (mg < 0.15) res.push([mg, esc(pname(id)) + ' กำไรเพียง ' + Math.round(mg * 100) + '% (ขายเฉลี่ย ฿' + F(avgp) + ')']);
        else if (p && p.base_price > 0 && avgp < p.base_price * 0.85) res.push([mg + 1, esc(pname(id)) + ' ขายจริงเฉลี่ยต่ำกว่าราคาตั้งต้น ' + Math.round((1 - avgp / p.base_price) * 100) + '%']);
      });
      res.sort(function (a, b) { return a[0] - b[0]; });
      if (!s2.length) return ['ข้อมูลขาย 30 วันล่าสุด', 'ยังไม่มียอดขาย ข้อมูลไม่เพียงพอ'];
      return ['ข้อมูลขาย 30 วันล่าสุด · เป็นข้อสังเกต ไม่ได้ปรับราคาให้', res.length ? li(res.slice(0, 8).map(function (x) { return x[1]; })) : 'ราคาขายจริงอยู่ในเกณฑ์ปกติ ไม่พบรุ่นที่น่าห่วง'];
    }
    if (k === 'cost') {
      var e90 = ex.filter(function (x) { return x.paid_on > addD(t, -90); }), byk = {}; e90.forEach(function (x) { byk[x.kind] = (byk[x.kind] || 0) + Number(x.amount); });
      var tot = sum(e90, function (x) { return Number(x.amount); }), ks = Object.keys(byk).sort(function (a, b) { return byk[b] - byk[a]; });
      var tips = [];
      if (ks.length) tips.push('รายจ่ายสูงสุด 90 วัน: ' + ks.slice(0, 3).map(function (kd) { return (EXK[kd] || kd) + ' ฿' + F(byk[kd]) + ' (' + Math.round(byk[kd] / tot * 100) + '%)'; }).join(', '));
      var m3 = {}; since(90).forEach(function (x) { var o = m3[x.product_id] || (m3[x.product_id] = { r: 0, c: 0 }); o.r += rv(x); o.c += x.unit_cost * x.qty; });
      var lm = Object.keys(m3).filter(function (id) { return m3[id].r > 0 && (m3[id].r - m3[id].c) / m3[id].r < 0.2; }).slice(0, 4);
      if (lm.length) tips.push('รุ่นที่กำไรต่ำกว่า 20% ควรต่อรองต้นทุนหรือทบทวนราคา: ' + lm.map(function (id) { return esc(pname(id)); }).join(', '));
      if (!tips.length) return ['ข้อมูล 90 วันล่าสุด', 'ข้อมูลยังไม่เพียงพอจะแนะนำ'];
      return ['ข้อมูล 90 วันล่าสุด', li(tips)];
    }
    return ['', ''];
  }
  function aiShell() {
    return '<h2>AI Assistant</h2><div class="note">ผู้ช่วยนี้คำนวณจากข้อมูลจริงในระบบ ไม่ได้เรียก AI API จึงไม่มีค่าใช้จ่าย และไม่แก้ไขสินค้า ราคา สต๊อก หรือบัญชีให้เอง</div>' +
      '<div class="pgh">' + QS.map(function (q) { return '<button class="chip" data-a="aiq" data-v="' + q[0] + '">' + q[1] + '</button>'; }).join('') + '</div>' +
      '<div style="display:flex;gap:8px;margin:10px 0"><input id="aiin" class="set-i" style="margin:0" placeholder="พิมพ์คำถาม เช่น วันนี้กำไรเท่าไหร่"><button class="btn" style="margin:0;width:auto;padding:0 18px" data-a="aisend">ถาม</button></div>' +
      '<div id="aiout"></div>';
  }
  function aiDraw() {
    var o = $('aiout'); if (!o) return;
    o.innerHTML = AI.ans.length ? AI.ans.map(function (a) { return '<div class="ans"><div class="q">' + esc(a.q) + '</div><small>' + a.meta + '</small>' + a.body + '</div>'; }).join('') : '<div class="empty">เลือกคำถามด้านบน</div>';
  }
  async function aiAsk(k, label) {
    if (AI.busy) return; AI.busy = true;
    AI.ans.unshift({ q: label, meta: '', body: '<p>กำลังวิเคราะห์...</p>' }); aiDraw();
    try { var D = await aiData(), r = answer(k, D); AI.ans[0] = { q: label, meta: r[0], body: typeof r[1] === 'string' && r[1].indexOf('<') !== 0 ? '<p>' + r[1] + '</p>' : r[1] }; }
    catch (ex) { AI.ans[0] = { q: label, meta: '', body: '<p>โหลดข้อมูลไม่สำเร็จ: ' + esc(ex.message || ex) + '</p>' }; }
    AI.ans = AI.ans.slice(0, 6); AI.busy = false; aiDraw();
  }
  A.aiq = function (k) { var q = QS.find(function (x) { return x[0] === k; }); aiAsk(k, q[1]); };
  A.aisend = function () {
    var v = ($('aiin').value || '').trim(); if (!v) return;
    var k = null, td = /วันนี้/.test(v);
    if (td && /กำไร/.test(v)) k = 'profit'; else if (td && /ขาย|ยอด/.test(v)) k = 'sales';
    else if (/ขายดี/.test(v)) k = 'best'; else if (/เติม|สั่ง|ใกล้หมด/.test(v)) k = 'restock';
    else if (/ค้าง|ไม่ขยับ|ขายไม่ออก/.test(v)) k = 'dead'; else if (/ผิดปกติ/.test(v)) k = 'abn';
    else if (/ราคา/.test(v)) k = 'price'; else if (/ลดต้นทุน|ต้นทุน|ประหยัด/.test(v)) k = 'cost';
    $('aiin').value = '';
    if (!k) { AI.ans.unshift({ q: v, meta: '', body: '<p>ยังตอบได้เฉพาะหัวข้อในปุ่มด้านบน ลองกดปุ่มหรือพิมพ์ให้ใกล้เคียงครับ</p>' }); return aiDraw(); }
    aiAsk(k, v);
  };

  /* ---------- ตั้งค่า ---------- */
  var CITY = { 'กรุงเทพฯ': [13.75, 100.5], 'เชียงใหม่': [18.79, 98.98], 'ขอนแก่น': [16.44, 102.83], 'นครราชสีมา': [14.97, 102.1], 'ชลบุรี': [13.36, 100.98], 'ภูเก็ต': [7.88, 98.39], 'หาดใหญ่': [7.01, 100.47], 'อุดรธานี': [17.41, 102.79] };
  function getCity() { try { return localStorage.getItem('ss_city') || 'กรุงเทพฯ'; } catch (e) { return 'กรุงเทพฯ'; } }
  function setPage() {
    var dark = document.documentElement.dataset.theme === 'dark';
    return '<h2>ตั้งค่า</h2>' +
      '<div class="card"><h3>หน้าตา</h3><div class="kv"><span>ธีม</span><button class="chip on" data-a="setTheme">' + (dark ? 'มืด · แตะเพื่อเปลี่ยนเป็นสว่าง' : 'สว่าง · แตะเพื่อเปลี่ยนเป็นมืด') + '</button></div></div>' +
      '<div class="card"><h3>แจ้งเตือน</h3><label>เตือนสินค้าใกล้หมดเมื่อเหลือไม่เกิน (ชิ้น)<input id="stlow" class="set-i" type="number" inputmode="numeric" min="1" max="99" value="' + thr() + '"></label>' +
      '<label>เมืองสำหรับพยากรณ์อากาศ<select id="stcity" class="set-i">' + Object.keys(CITY).map(function (c) { return '<option' + (c === getCity() ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn" data-a="setSave">บันทึกการตั้งค่า</button><small>ค่านี้เก็บในเครื่องนี้เท่านั้น ถ้าเปลี่ยนเครื่องต้องตั้งใหม่</small></div>' +
      '<div class="card"><h3>ประเภทสินค้า</h3>' + S.cats.map(function (c) { return '<div class="row"><div class="gr"><b>' + esc(c.name) + '</b> <small>' + esc(c.prefix) + '-001</small></div><button class="dsm" style="color:var(--text);border-color:var(--line)" data-a="catren" data-v="' + c.id + '">แก้ชื่อ</button><button class="dsm" style="color:var(--text);border-color:var(--line)" data-a="catqr" data-v="' + c.id + '">QR</button></div>'; }).join('') + '<button class="btn o" data-a="catadd">+ เพิ่มประเภทสินค้า</button></div>' +
      '<div class="card"><h3>สถานที่จัดเก็บ</h3>' + S.locs.map(function (l) { return '<div class="kv"><span>' + esc(l.name) + '</span></div>'; }).join('') + '<button class="btn o" data-a="locadd">+ เพิ่มสถานที่</button></div>' +
      '<div class="card"><h3>สำรอง / ส่งออกข้อมูล (CSV)</h3><div class="btns"><button class="btn o" data-a="setExp" data-v="products">สินค้า</button><button class="btn o" data-a="setExp" data-v="sales">ประวัติขาย</button></div>' +
      '<div class="btns"><button class="btn o" data-a="setExp" data-v="expenses">รายจ่าย</button><button class="btn o" data-a="setExp" data-v="rent">รับค่าเช่า</button></div><div id="exmsg" class="err"></div></div>' +
      '<div class="card"><h3>บัญชีผู้ใช้</h3><div class="kv"><span>อีเมล</span><b id="stmail">...</b></div>' +
      '<label>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)<input id="stp1" class="set-i" type="password" autocomplete="new-password"></label>' +
      '<label>ยืนยันรหัสผ่านใหม่<input id="stp2" class="set-i" type="password" autocomplete="new-password"></label>' +
      '<div class="err" id="sterr"></div><button class="btn" data-a="setPw">เปลี่ยนรหัสผ่าน</button><button class="btn o" data-a="logout">ออกจากระบบ</button></div>' +
      '<div class="note">Xiress · ข้อมูลเก็บใน Supabase ไม่หายเมื่อเปลี่ยนเครื่อง</div>';
  }
  A.setTheme = function () { A.theme(); render(); };
  A.setSave = function () {
    var v = parseInt($('stlow').value);
    if (!(v >= 1)) return toast('ใส่จำนวนอย่างน้อย 1');
    try { localStorage.setItem('ss_low', String(v)); localStorage.setItem('ss_city', $('stcity').value); } catch (e) { return toast('บันทึกไม่ได้'); }
    if (window.SSAlerts) window.SSAlerts.resetWeather();
    toast('บันทึกแล้ว');
  };
  A.setPw = async function () {
    var a = $('stp1').value, b = $('stp2').value, er = $('sterr');
    if (a.length < 8) { er.textContent = 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว'; return; }
    if (a !== b) { er.textContent = 'รหัสผ่านสองช่องไม่ตรงกัน'; return; }
    er.textContent = '';
    var r = await S.sb.auth.updateUser({ password: a });
    if (r.error) { er.textContent = 'เปลี่ยนไม่สำเร็จ: ' + r.error.message; return; }
    $('stp1').value = ''; $('stp2').value = ''; toast('เปลี่ยนรหัสผ่านแล้ว');
  };
  A.setExp = async function (k) {
    var m = $('exmsg'); m.textContent = 'กำลังเตรียมไฟล์...';
    try {
      var d = todayS();
      if (k === 'products') {
        download('products_' + d + '.csv', csvText(['รหัส', 'ชื่อ', 'ประเภท', 'ต้นทุน', 'ราคาตั้งต้น', 'สถานะ', 'จำนวนรวม'],
          S.prods.map(function (p) { return [p.code, p.name, p.categories ? p.categories.name : '', p.current_cost, p.base_price, p.status, pqty(p)]; })));
      } else if (k === 'sales') {
        var s = await all(function () { return S.sb.from('sales').select('product_id,qty,unit_price,unit_cost,payment_method,created_at,voided_at').order('created_at'); });
        download('sales_' + d + '.csv', csvText(['วันที่เวลา', 'สินค้า', 'จำนวน', 'ราคาขาย', 'ต้นทุน', 'ชำระด้วย', 'ยกเลิก'],
          s.map(function (x) { return [new Date(x.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }), pname(x.product_id), x.qty, x.unit_price, x.unit_cost, PMT[x.payment_method] || x.payment_method, x.voided_at ? 'ใช่' : '']; })));
      } else if (k === 'expenses') {
        var e = await all(function () { return S.sb.from('expenses').select('kind,amount,paid_on,payment_method,note,voided_at').order('paid_on'); });
        download('expenses_' + d + '.csv', csvText(['วันที่', 'ประเภท', 'จำนวน', 'ชำระด้วย', 'หมายเหตุ', 'ยกเลิก'],
          e.map(function (x) { return [x.paid_on, EXK[x.kind] || x.kind, x.amount, PMT[x.payment_method] || x.payment_method || '', x.note || '', x.voided_at ? 'ใช่' : '']; })));
      } else {
        var r = await all(function () { return S.sb.from('rent_receipts').select('lease_id,amount,paid_on,method,note,cancelled').order('paid_on'); });
        download('rent_receipts_' + d + '.csv', csvText(['วันที่รับ', 'จำนวน', 'วิธี', 'หมายเหตุ', 'ลบแล้ว'],
          r.map(function (x) { return [x.paid_on, x.amount, PMT[x.method] || x.method || '', x.note || '', x.cancelled ? 'ใช่' : '']; })));
      }
      m.textContent = '';
    } catch (ex) { m.textContent = 'ส่งออกไม่สำเร็จ: ' + (ex.message || ex); }
  };

  /* ---------- ต่อเข้ากับ render ---------- */
  var _r = render;
  render = function () {
    _r.apply(this, arguments);
    if (!S.ready) return;
    var v = $('view');
    if (S.cur === 'rent') swipeRent();
    else if (S.cur === 'rep') { v.innerHTML = repShell(); repLoad(); }
    else if (S.cur === 'ai') { v.innerHTML = aiShell(); aiDraw(); }
    else if (S.cur === 'set') {
      v.innerHTML = setPage();
      S.sb.auth.getUser().then(function (r) { var m = $('stmail'); if (m) m.textContent = (r.data && r.data.user && r.data.user.email) || '-'; });
    }
  };
})();
