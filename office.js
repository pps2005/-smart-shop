/* SMART SHOP add-on: office.js
   หน้า AI = "ห้องทำงาน" ของทีมผู้ช่วย AI (ตัวละครนั่งโต๊ะแต่ละฝ่าย)
   กดโต๊ะ -> เปิดรายงานย่อของฝ่ายนั้น (บัญชี / สินค้า / อสังหา) ข้อมูลจริงจากระบบ ไม่เรียก AI API ไม่มีค่าใช้จ่าย
   Load LAST in index.html:  <script src="office.js"></script>
   To undo: delete that one line from index.html. */
(function () {
  var css = document.createElement('style');
  css.textContent = [
    '#office{margin:10px 0 14px;border-radius:16px;overflow:hidden;border:2px solid var(--line);background:#e9d7b5}',
    '#office svg{width:100%;height:auto;display:block;image-rendering:pixelated}',
    '#office [data-a]{cursor:pointer}',
    '#office .ob{animation:obob 1.1s ease-in-out infinite alternate}',
    '#office .ob2{animation-delay:.35s}#office .ob3{animation-delay:.7s}#office .ob4{animation-delay:.2s}',
    '@keyframes obob{from{transform:translateY(0)}to{transform:translateY(-1px)}}',
    '#office .blk{animation:oblk 1s steps(1) infinite}',
    '@keyframes oblk{50%{opacity:0}}',
    '#office .zh:active{opacity:.7}',
    '.ofn{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}',
    '.ofn button{padding:10px 4px;border-radius:12px;background:var(--card);border:1px solid var(--line);font-size:.85rem;font-weight:700;text-align:center}',
    '.ofn span{display:block;font-size:1.4rem;line-height:1.2}'
  ].join('');
  document.head.appendChild(css);

  var OF = { d: null, busy: false, err: '' };

  function F(n) { return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 }); }
  function SG(n) { return (n > 0 ? '+' : n < 0 ? '-' : '') + F(Math.abs(n)); }
  function bkk(d) { return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); }
  function kv(a, b) { return '<div class="kv"><span>' + a + '</span><b>' + b + '</b></div>'; }
  function col(n) { return n >= 0 ? 'ovp' : 'ovm'; }
  function thr() { try { return parseInt(localStorage.getItem('ss_low')) || 3; } catch (e) { return 3; } }
  function mlabel(ym) {
    var a = ym.split('-');
    return new Date(Date.UTC(+a[0], +a[1] - 1, 1)).toLocaleDateString('th-TH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  /* ---------- วาดห้องทำงาน (พิกเซลอาร์ต SVG) ---------- */
  function R(x, y, w, h, f, extra) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '"' + (extra ? ' ' + extra : '') + '/>';
  }
  function person(x, y, shirt, hair, robot) {
    if (robot) {
      return R(x + 2, y - 3, 1, 3, '#64748b') + R(x + 1, y - 4, 3, 1, '#ef4444') +
        R(x, y, 6, 5, '#cbd5e1') + R(x + 1, y + 1, 1, 2, '#2563eb') + R(x + 4, y + 1, 1, 2, '#2563eb') +
        R(x + 1, y + 4, 4, 1, '#94a3b8') + R(x, y + 5, 6, 4, '#64748b') + R(x + 2, y + 6, 2, 2, '#38bdf8');
    }
    return R(x + 1, y, 4, 2, hair) + R(x, y + 1, 1, 2, hair) + R(x + 5, y + 1, 1, 2, hair) +
      R(x + 1, y + 2, 4, 3, '#f2c9a0') + R(x + 2, y + 3, 1, 1, '#1f2937') + R(x + 4, y + 3, 1, 1, '#1f2937') +
      R(x - 1, y + 5, 8, 4, shirt) + R(x + 1, y + 5, 4, 1, 'rgba(255,255,255,.35)');
  }
  function bubble(id, x, y, txt) {
    return '<g id="ob-' + id + '"><rect x="' + x + '" y="' + y + '" width="34" height="8" fill="#fff" stroke="#111" stroke-width=".6"/>' +
      '<polygon points="' + (x + 14) + ',' + (y + 8) + ' ' + (x + 20) + ',' + (y + 8) + ' ' + (x + 17) + ',' + (y + 11) + '" fill="#fff" stroke="#111" stroke-width=".6"/>' +
      '<rect x="' + (x + 14.4) + '" y="' + (y + 7.6) + '" width="5.2" height="1" fill="#fff"/>' +
      '<text class="ot" x="' + (x + 17) + '" y="' + (y + 5.6) + '" text-anchor="middle" font-size="4" font-weight="700" fill="#111" style="font-family:system-ui,sans-serif">' + txt + '</text>' +
      '<circle class="oalert" cx="' + (x + 34) + '" cy="' + y + '" r="2.6" fill="#ef4444" stroke="#fff" stroke-width=".6" style="display:none"/></g>';
  }
  function sign(x, y, w, t, c) {
    return R(x, y, w, 7, c, 'stroke="#111" stroke-width=".6"') +
      '<text x="' + (x + w / 2) + '" y="' + (y + 5) + '" text-anchor="middle" font-size="4" font-weight="700" fill="#fff" style="font-family:system-ui,sans-serif">' + t + '</text>';
  }
  function desk(x, y, w) {
    return R(x, y, w, 7, '#a0692f') + R(x, y + 5, w, 2, '#6b4220') + R(x + 2, y + 7, 2, 4, '#6b4220') + R(x + w - 4, y + 7, 2, 4, '#6b4220');
  }
  function monitor(x, y, sc) {
    return R(x, y, 12, 8, '#1f2937') + R(x + 1, y + 1, 10, 5, sc) + R(x + 5, y + 8, 2, 2, '#374151') + R(x + 3, y + 10, 6, 1, '#374151');
  }
  function plant(x, y) {
    return R(x + 1, y + 5, 4, 3, '#b45309') + R(x + 2, y, 2, 5, '#16a34a') + R(x, y + 1, 2, 2, '#22c55e') + R(x + 4, y + 2, 2, 2, '#22c55e');
  }

  function zoneAcc(ox, oy) {
    var bars = R(ox + 24, oy + 18, 1.5, 3, '#fff') + R(ox + 26.5, oy + 16.5, 1.5, 4.5, '#fff') + R(ox + 29, oy + 15.5, 1.5, 5.5, '#fff') + R(ox + 31.5, oy + 17, 1.5, 4, '#fff');
    return R(ox, oy, 72, 48, '#86efac', 'opacity=".38"') + sign(ox + 2, oy + 1, 29, 'ฝ่ายบัญชี', '#15803d') +
      R(ox + 58, oy + 12, 11, 20, '#9ca3af') + R(ox + 59, oy + 14, 9, 5, '#d1d5db') + R(ox + 59, oy + 21, 9, 5, '#d1d5db') + R(ox + 62, oy + 16, 3, 1, '#6b7280') + R(ox + 62, oy + 23, 3, 1, '#6b7280') +
      plant(ox + 3, oy + 24) +
      '<g class="ob">' + person(ox + 40, oy + 11, '#16a34a', '#3b2a1a') + '</g>' +
      desk(ox + 16, oy + 20, 40) + monitor(ox + 22, oy + 13, '#34d399') + bars +
      R(ox + 44, oy + 18, 6, 2, '#facc15') + R(ox + 45, oy + 16, 4, 2, '#fde047') + R(ox + 36, oy + 18, 5, 3, '#e5e7eb') + R(ox + 37, oy + 18.5, 3, 1, '#9ca3af') +
      R(ox + 18, oy + 34, 36, 8, '#bbf7d0', 'opacity=".55"');
  }
  function zoneProd(ox, oy) {
    var boxes = R(ox + 59, oy + 14, 4, 3, '#f59e0b') + R(ox + 64, oy + 14, 4, 3, '#ef4444') + R(ox + 59, oy + 21, 4, 3, '#3b82f6') + R(ox + 64, oy + 21, 4, 3, '#10b981') + R(ox + 59, oy + 28, 4, 3, '#a855f7') + R(ox + 64, oy + 28, 4, 3, '#f59e0b');
    return R(ox, oy, 72, 48, '#fdba74', 'opacity=".38"') + sign(ox + 2, oy + 1, 29, 'ฝ่ายสินค้า', '#c2410c') +
      R(ox + 57, oy + 12, 13, 22, '#8b5a2b') + R(ox + 58, oy + 13, 11, 6, '#6b4220') + R(ox + 58, oy + 20, 11, 6, '#6b4220') + R(ox + 58, oy + 27, 11, 6, '#6b4220') + boxes +
      R(ox + 4, oy + 30, 8, 6, '#d6a05c') + R(ox + 5, oy + 24, 6, 6, '#e0b070') + R(ox + 7, oy + 31, 2, 1, '#8b5a2b') +
      '<g class="ob ob2">' + person(ox + 38, oy + 11, '#ea580c', '#1f1f1f') + '</g>' +
      desk(ox + 14, oy + 20, 40) + monitor(ox + 20, oy + 13, '#fbbf24') +
      R(ox + 22, oy + 15, 8, 1, '#fff') + R(ox + 22, oy + 17, 5, 1, '#fff') +
      R(ox + 42, oy + 17, 5, 3, '#d6a05c') + R(ox + 48, oy + 18, 4, 2, '#e0b070') +
      R(ox + 16, oy + 34, 36, 8, '#fed7aa', 'opacity=".55"');
  }
  function zoneRent(ox, oy) {
    var win = '';
    [0, 1, 2].forEach(function (i) { [0, 1, 2].forEach(function (j) { win += R(ox + 49 + i * 3, oy + 8 + j * 3, 1.6, 1.6, '#fde047'); }); });
    return R(ox, oy, 72, 50, '#93c5fd', 'opacity=".38"') + sign(ox + 2, oy + 1, 32, 'ฝ่ายอสังหา', '#1d4ed8') +
      R(ox + 4, oy + 12, 9, 16, '#92400e') + R(ox + 5, oy + 13, 7, 14, '#b45309') + R(ox + 10, oy + 20, 1, 1, '#fde047') +
      R(ox + 58, oy + 14, 10, 14, '#e5e7eb') + R(ox + 59, oy + 16, 8, 8, '#bfdbfe') + R(ox + 62, oy + 24, 2, 4, '#9ca3af') +
      '<g class="ob ob3">' + person(ox + 38, oy + 13, '#2563eb', '#7c2d12') + '</g>' +
      desk(ox + 18, oy + 22, 38) + monitor(ox + 22, oy + 15, '#60a5fa') +
      R(ox + 23, oy + 17, 4, 3, '#fff') + R(ox + 28, oy + 17, 3, 3, '#fde047') +
      R(ox + 47, oy + 13, 11, 11, '#94a3b8') + R(ox + 47, oy + 13, 11, 2, '#64748b') + win +
      R(ox + 20, oy + 36, 36, 9, '#bfdbfe', 'opacity=".55"');
  }
  function zoneAi(ox, oy) {
    return R(ox, oy, 72, 50, '#c4b5fd', 'opacity=".38"') + sign(ox + 2, oy + 1, 34, 'ผู้จัดการ AI', '#6d28d9') +
      R(ox + 56, oy + 12, 12, 18, '#1f2937') + R(ox + 58, oy + 14, 8, 2, '#22c55e') + R(ox + 58, oy + 18, 8, 2, '#38bdf8') + R(ox + 58, oy + 22, 8, 2, '#f472b6') +
      '<g class="blk">' + R(ox + 64, oy + 26, 2, 2, '#22c55e') + '</g>' +
      '<g class="ob ob4">' + person(ox + 38, oy + 13, '', '', true) + '</g>' +
      desk(ox + 18, oy + 22, 38) + monitor(ox + 22, oy + 15, '#a78bfa') +
      R(ox + 24, oy + 17, 7, 1, '#fff') + R(ox + 24, oy + 19, 4, 1, '#fff') + '<g class="blk">' + R(ox + 29, oy + 19, 1, 1, '#fff') + '</g>' +
      R(ox + 6, oy + 34, 28, 8, '#15803d') + R(ox + 6, oy + 31, 28, 4, '#16a34a') + R(ox + 8, oy + 36, 24, 3, '#22c55e') +
      plant(ox + 52, oy + 36);
  }

  function officeSvg() {
    var floor = '<defs><pattern id="oflr" width="8" height="8" patternUnits="userSpaceOnUse">' + R(0, 0, 8, 8, '#ecdcb9') + R(0, 0, 4, 4, '#e4d1aa') + R(4, 4, 4, 4, '#e4d1aa') + '</pattern></defs>';
    var wall = R(0, 0, 160, 14, '#c9b48f') + R(0, 12, 160, 2, '#9c8863');
    for (var i = 0; i < 5; i++) wall += R(9 + i * 30, 2, 20, 9, '#bfe3f5', 'stroke="#7aa6bd" stroke-width=".6"') + R(18 + i * 30, 2, .8, 9, '#7aa6bd');
    var Z = [['acc', 4, 18, zoneAcc, 'ฝ่ายบัญชี'], ['prod', 84, 18, zoneProd, 'ฝ่ายสินค้า'], ['rent', 4, 70, zoneRent, 'ฝ่ายอสังหา'], ['ai', 84, 70, zoneAi, 'ผู้จัดการ AI']];
    var zs = Z.map(function (z) {
      var bx = z[1] + 38, by = z[2] + 1;
      return '<g class="zh">' + z[3](z[1], z[2]) + bubble(z[0], bx, by, '…') +
        '<rect x="' + z[1] + '" y="' + z[2] + '" width="72" height="50" fill="transparent" data-a="ofc" data-v="' + z[0] + '" aria-label="' + z[4] + '"/></g>';
    }).join('');
    return '<svg viewBox="0 0 160 124" shape-rendering="crispEdges" role="img" aria-label="ห้องทำงานทีมผู้ช่วย AI">' + floor +
      R(0, 14, 160, 110, 'url(#oflr)') + wall + zs + '</svg>';
  }

  function officeHtml() {
    return '<div id="office">' + officeSvg() + '</div>' +
      '<div class="ofn"><button data-a="ofc" data-v="acc"><span>💰</span>ฝ่ายบัญชี</button><button data-a="ofc" data-v="prod"><span>📦</span>ฝ่ายสินค้า</button><button data-a="ofc" data-v="rent"><span>🏢</span>ฝ่ายอสังหา</button></div>' +
      '<div class="note" style="margin-bottom:12px">กดที่โต๊ะของตัวละครแต่ละฝ่ายเพื่อดูรายงานย่อ · ตัวเลขในกรอบคำพูดมาจากข้อมูลจริงในระบบ จุดแดง = มีเรื่องที่ควรดู</div>';
  }

  /* ---------- ข้อมูล ---------- */
  async function all(mk) {
    var out = [];
    for (var i = 0; i < 20; i++) {
      var r = await mk().range(i * 1000, i * 1000 + 999);
      if (r.error) throw r.error;
      out = out.concat(r.data);
      if (r.data.length < 1000) break;
    }
    return out;
  }
  async function ofLoad() {
    if (OF.busy || !S.sb) return;
    OF.busy = true; OF.err = '';
    try {
      var td = bkk(new Date()), ym = td.slice(0, 7), ms = ym + '-01';
      var res = await Promise.all([
        all(function () { return S.sb.from('sales').select('qty,unit_price,unit_cost,created_at').is('voided_at', null).gte('created_at', ms + 'T00:00:00+07:00').order('created_at'); }),
        all(function () { return S.sb.from('expenses').select('kind,amount,paid_on').is('voided_at', null).gte('paid_on', ms).order('paid_on'); })
      ]);
      if (window.SSRent) { var p = window.SSRent.ensure(); if (p && p.then) await p; }
      OF.d = { td: td, ym: ym, sales: res[0], exps: res[1] };
    } catch (e) { OF.err = e.message || String(e); }
    OF.busy = false;
    paint();
  }

  /* ---------- สรุปตัวเลข ---------- */
  function accSum() {
    var D = OF.d, s = { rev: 0, cost: 0, n: 0, trev: 0, tn: 0, exp: 0, byk: {} };
    D.sales.forEach(function (x) {
      var rv = x.unit_price * x.qty;
      s.rev += rv; s.cost += x.unit_cost * x.qty; s.n += x.qty;
      if (bkk(x.created_at) === D.td) { s.trev += rv; s.tn += x.qty; }
    });
    D.exps.forEach(function (x) { s.exp += Number(x.amount); s.byk[x.kind] = (s.byk[x.kind] || 0) + Number(x.amount); });
    s.gross = s.rev - s.cost; s.net = s.gross - s.exp;
    return s;
  }
  function prodSum() {
    var P = S.prods || [], c = { green: 0, blue: 0, red: 0, black: 0 }, pcs = 0, val = 0, out = [], low = [], T = thr();
    P.forEach(function (p) {
      c[p.status] = (c[p.status] || 0) + 1;
      var q = pq(p); pcs += q; val += q * Number(p.current_cost);
      if (p.status !== 'black') { if (q < 1) out.push(p); else if (q <= T) low.push(p); }
    });
    return { n: P.length, c: c, pcs: pcs, val: val, out: out, low: low, T: T };
  }
  function rentSum() {
    var X = window.SSRent;
    if (!X) return { none: true };
    var Rr = X.R;
    if (Rr.err) return { err: Rr.err };
    if (!Rr.loaded) return { wait: true };
    var td = X.today(), ym = td.slice(0, 7), st = { occupied: 0, vacant: 0, maintenance: 0 }, vac = [];
    Rr.units.forEach(function (u) { st[u.status] = (st[u.status] || 0) + 1; if (u.status === 'vacant') vac.push(X.uname(u)); });
    var cnt = 0, paid = 0, exp = 0, got = 0, od = [], oda = 0;
    Rr.pays.forEach(function (r) {
      if (r.period.slice(0, 7) === ym) { cnt++; exp += Number(r.amount); got += r._paid || 0; if ((r._left || 0) <= 0) paid++; }
      if ((r._left || 0) > 0 && X.eff(r) < td) { od.push(r); oda += r._left; }
    });
    var inc = 0, mc = 0;
    Rr.rec.forEach(function (x) { if (x.paid_on.slice(0, 7) === ym) inc += Number(x.amount); });
    Rr.costs.forEach(function (x) { if (x.paid_on.slice(0, 7) === ym) mc += Number(x.amount); });
    return { n: Rr.units.length, st: st, vac: vac, cnt: cnt, paid: paid, exp: exp, got: got, od: od, oda: oda, inc: inc, mc: mc, ym: ym, td: td };
  }

  /* ---------- อัปเดตกรอบคำพูดบนห้องทำงาน ---------- */
  function setB(id, txt, alert) {
    var g = document.getElementById('ob-' + id);
    if (!g) return;
    g.querySelector('.ot').textContent = txt;
    g.querySelector('.oalert').style.display = alert ? 'block' : 'none';
  }
  function paint() {
    if (!$('office')) return;
    var P = prodSum();
    setB('prod', 'สต๊อก ' + F(P.pcs), P.out.length + P.low.length > 0);
    setB('ai', 'ถามฉันได้', false);
    if (OF.d) { var a = accSum(); setB('acc', 'กำไร ' + SG(a.net), a.net < 0); } else setB('acc', OF.err ? 'โหลดไม่ได้' : '…', !!OF.err);
    var r = rentSum();
    if (r.none) setB('rent', 'ไม่มีข้อมูล', false);
    else if (r.err) setB('rent', 'โหลดไม่ได้', true);
    else if (r.wait) setB('rent', '…', false);
    else setB('rent', 'ว่าง ' + r.st.vacant + ' ห้อง', r.od.length > 0);
  }

  /* ---------- รายงานย่อของแต่ละฝ่าย ---------- */
  function accSheet() {
    if (!OF.d) return openSheet(head('ฝ่ายบัญชี') + '<div class="empty">' + (OF.err ? 'โหลดข้อมูลไม่สำเร็จ: ' + esc(OF.err) : 'กำลังโหลดข้อมูล...') + '</div>');
    var a = accSum(), r = rentSum(), kinds = { rent: 'ค่าเช่า', water: 'ค่าน้ำ', electric: 'ค่าไฟ', travel: 'ค่าเดินทาง', labor: 'ค่าแรง', packaging: 'บรรจุภัณฑ์', other: 'อื่น ๆ' };
    var top = Object.keys(a.byk).sort(function (x, y) { return a.byk[y] - a.byk[x]; }).slice(0, 3);
    var h = head('💰 ฝ่ายบัญชี') + '<small>ร้านค้า · ' + mlabel(OF.d.ym) + '</small>' +
      kv('ยอดขาย (' + F(a.n) + ' ชิ้น)', '฿' + F(a.rev)) + kv('ต้นทุนขาย', '฿' + F(a.cost)) + kv('กำไรขั้นต้น', '฿' + F(a.gross)) + kv('รายจ่าย', '฿' + F(a.exp)) +
      '<div class="kv"><span><b>กำไรสุทธิ</b></span><b class="' + col(a.net) + '">฿' + SG(a.net) + '</b></div>' +
      kv('ขายวันนี้', '฿' + F(a.trev) + ' (' + F(a.tn) + ' ชิ้น)') +
      (top.length ? '<small style="display:block;margin-top:10px">รายจ่ายสูงสุดเดือนนี้</small>' + top.map(function (k) { return kv(kinds[k] || k, '฿' + F(a.byk[k])); }).join('') : '');
    if (r && !r.none && !r.err && !r.wait) {
      var rn = r.inc - r.mc;
      h += '<div class="card" style="margin-top:12px;border-left:5px solid var(--' + (rn >= 0 ? 'green' : 'red') + ')"><small>อสังหาเช่า (แยกกรอบ)</small>' +
        '<div class="kv"><span>รับค่าเช่า</span><b class="ovp">+฿' + F(r.inc) + '</b></div>' +
        '<div class="kv"><span>ค่าซ่อมบำรุง/อุปกรณ์</span><b class="ovm">-฿' + F(r.mc) + '</b></div>' +
        '<div class="kv"><span><b>รวมอสังหา</b></span><b class="' + col(rn) + '">฿' + SG(rn) + '</b></div></div>' +
        '<div class="kv"><span><b>รวมร้านค้า + อสังหา</b></span><b class="' + col(a.net + rn) + '">฿' + SG(a.net + rn) + '</b></div>';
    }
    h += '<div class="btns"><button class="btn o" data-a="go" data-v="rep">รายงานเต็ม</button><button class="btn" data-a="go" data-v="acc">บัญชีรายจ่าย</button></div>';
    openSheet(h);
  }
  function prodSheet() {
    var P = prodSum();
    var row = function (p) {
      return '<button class="row" style="width:100%;text-align:left" data-a="open" data-v="' + esc(p.code) + '"><div class="th">' + thumb(p) + '</div><div class="gr"><b>' + esc(p.code) + '</b> ' + esc(p.name) + '<br><small>เหลือ ' + pq(p) + ' ชิ้น</small></div><i class="dt" style="background:var(--' + p.status + ')"></i></button>';
    };
    var h = head('📦 ฝ่ายสินค้า') + kv('จำนวนรุ่น', F(P.n) + ' รุ่น') + kv('สินค้ารวม', F(P.pcs) + ' ชิ้น') + kv('มูลค่าต้นทุนรวม', '฿' + F(P.val)) +
      '<small style="display:block;margin-top:10px">แยกตามสถานะ</small>' +
      Object.keys(ST).map(function (k) { return '<div class="kv"><span><i class="dt" style="background:var(--' + k + ');margin-right:6px"></i>' + ST[k] + '</span><b>' + (P.c[k] || 0) + ' รุ่น</b></div>'; }).join('') +
      '<small style="display:block;margin-top:10px">หมดสต๊อก ' + P.out.length + ' รุ่น · ใกล้หมด (≤' + P.T + ' ชิ้น) ' + P.low.length + ' รุ่น</small>' +
      (P.out.slice(0, 4).concat(P.low.slice(0, 4)).map(row).join('') || '<div class="note" style="margin-top:6px">ไม่มีสินค้าหมดหรือใกล้หมด</div>') +
      '<div class="btns"><button class="btn o" data-a="go" data-v="prod">หน้าสินค้า</button><button class="btn" data-a="go" data-v="stock">หน้าคลัง</button></div>';
    openSheet(h);
  }
  function rentSheet() {
    var r = rentSum();
    if (r.none) return openSheet(head('🏢 ฝ่ายอสังหา') + '<div class="note">ยังไม่มีข้อมูลอสังหาเช่าในระบบ</div>');
    if (r.err) return openSheet(head('🏢 ฝ่ายอสังหา') + '<div class="empty">โหลดข้อมูลไม่สำเร็จ: ' + esc(r.err) + '</div>');
    if (r.wait) { ofLoad(); return openSheet(head('🏢 ฝ่ายอสังหา') + '<div class="empty">กำลังโหลดข้อมูล... แล้วกดโต๊ะอีกครั้ง</div>'); }
    var X = window.SSRent, rn = r.inc - r.mc;
    var h = head('🏢 ฝ่ายอสังหา') + '<small>' + mlabel(r.ym) + '</small>' +
      kv('ห้องทั้งหมด', r.n + ' ห้อง') + kv('มีผู้เช่า', r.st.occupied + ' ห้อง') + kv('ห้องว่าง', r.st.vacant + ' ห้อง') + kv('ซ่อมบำรุง', r.st.maintenance + ' ห้อง') +
      (r.vac.length ? '<small style="display:block;margin-top:6px">ว่าง: ' + r.vac.slice(0, 6).map(esc).join(', ') + (r.vac.length > 6 ? ' ...' : '') + '</small>' : '') +
      '<small style="display:block;margin-top:10px">ค่าเช่าเดือนนี้</small>' +
      kv('จ่ายแล้ว', r.paid + ' / ' + r.cnt + ' ห้อง') + kv('เก็บได้', '฿' + F(r.got) + ' จาก ฿' + F(r.exp)) +
      '<div class="kv"><span>ค้างเกินกำหนด</span><b class="' + (r.od.length ? 'ovm' : '') + '">' + r.od.length + ' รายการ ฿' + F(r.oda) + '</b></div>' +
      '<div class="kv"><span>รับค่าเช่าเดือนนี้</span><b class="ovp">+฿' + F(r.inc) + '</b></div>' +
      '<div class="kv"><span>ค่าซ่อมบำรุง/อุปกรณ์</span><b class="ovm">-฿' + F(r.mc) + '</b></div>' +
      '<div class="kv"><span><b>คงเหลือ</b></span><b class="' + col(rn) + '">฿' + SG(rn) + '</b></div>';
    if (r.od.length) {
      h += '<small style="display:block;margin-top:10px">ค้างจ่าย</small>' + r.od.slice(0, 5).map(function (p) {
        var l = X.R.leases.find(function (x) { return x.id === p.lease_id; }), u = l && X.unit(l.unit_id);
        return '<button class="row" style="width:100%;text-align:left"' + (u ? ' data-a="runit" data-v="' + u.id + '"' : '') + '><div class="gr"><b>' + esc(u ? X.uname(u) : 'ห้อง') + '</b><br><small>' + esc((l && l.tenants && l.tenants.name) || '') + ' · เลยกำหนด ' + (-X.diff(r.td, X.eff(p))) + ' วัน</small></div><b class="ovm">฿' + F(p._left) + '</b></button>';
      }).join('');
    }
    h += '<button class="btn" data-a="go" data-v="rent">ไปหน้าอสังหาเช่า</button>';
    openSheet(h);
  }

  A.ofc = function (k) {
    if (k === 'acc') return accSheet();
    if (k === 'prod') return prodSheet();
    if (k === 'rent') return rentSheet();
    var i = $('aiin');
    if (i) { i.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { i.focus(); }, 350); }
  };

  /* ---------- ผูกเข้ากับหน้า AI ---------- */
  var _r = render;
  render = function () {
    _r.apply(this, arguments);
    if (!(S.ready && S.cur === 'ai')) return;
    var v = $('view'), h = v && v.querySelector('h2');
    if (!h || $('office')) return;
    h.insertAdjacentHTML('afterend', officeHtml());
    paint();
    ofLoad();
  };
})();
