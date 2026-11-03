(function () {
  Object.assign(I, {
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><line x1="9" y1="6" x2="9.01" y2="6"/><line x1="15" y1="6" x2="15.01" y2="6"/><line x1="9" y1="10" x2="9.01" y2="10"/><line x1="15" y1="10" x2="15.01" y2="10"/><line x1="9" y1="14" x2="9.01" y2="14"/><line x1="15" y1="14" x2="15.01" y2="14"/>'
  });

  if (!M.some(function (m) { return m.id === 'rent'; })) {
    M.splice(3, 0, { id: 'rent', i: 'building', t: 'อสังหาเช่า' });
  }

  var css = document.createElement('style');
  css.textContent = [
    ':root{--amber:#d97706}[data-theme=dark]{--amber:#fbbf24}',
    '.rc{display:block;width:100%;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;margin-bottom:10px}',
    '.rc .t{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.rc .t b{font-size:1.1rem}',
    '.rc .s{margin-top:8px;display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:.9rem}',
    '.bd{display:inline-block;padding:4px 11px;border-radius:99px;font-size:.8rem;font-weight:700;color:#fff;white-space:nowrap}',
    '.bd.g{background:#16a34a}.bd.a{background:#d97706}.bd.r{background:#dc2626}.bd.k{background:#64748b}.bd.b{background:#2563eb}',
    '.gh{display:flex;align-items:center;gap:8px;margin:16px 0 8px;font-size:1.1rem;font-weight:800}',
    '.mth{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px}.mth .chip{flex:1 1 28%;justify-content:center}',
    '.hr{border-top:2px solid var(--line);margin:16px 0 8px}',
    '.over{color:var(--red);font-weight:700}'
  ].join('');
  document.head.appendChild(css);

  var UST = { occupied: ['มีผู้เช่า', 'g'], vacant: ['ห้องว่าง', 'a'], maintenance: ['ซ่อมบำรุง', 'k'] };
  var KIND = { repair: 'ค่าซ่อม', equipment: 'ค่าอุปกรณ์', labor: 'ค่าช่าง', other: 'อื่น ๆ' };
  var MTH = { cash: 'เงินสด', transfer: 'โอนเงิน', other: 'อื่น ๆ' };
  var R = { loaded: false, loading: false, err: '', props: [], units: [], leases: [], pays: [], costs: [], rec: [], pf: 'all', sf: 'all' };
  var busy = false, meth = 'cash', kind = 'repair', dueTouched = false;

  // ===== วันที่ =====
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() {
    var p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  }
  function ms(s) { var a = s.split('-'); return Date.UTC(+a[0], +a[1] - 1, +a[2]); }
  function diff(a, b) { return Math.round((ms(b) - ms(a)) / 86400000); }
  function addDays(s, n) { return new Date(ms(s) + n * 86400000).toISOString().slice(0, 10); }
  function fd(s) {
    if (!s) return '-';
    var a = s.split('-').map(Number);
    return new Date(a[0], a[1] - 1, a[2]).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function ml(s) {
    var a = s.split('-').map(Number);
    return new Date(a[0], a[1] - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
  }
  function addMonth(s) {
    var a = s.split('-').map(Number), y = a[0], m = a[1] + 1, d = a[2];
    if (m > 12) { m = 1; y++; }
    var last = new Date(y, m, 0).getDate();
    return y + '-' + pad(m) + '-' + pad(Math.min(d, last));
  }
  function tm() { return today().slice(0, 8) + '01'; }
  function eff(r) { return r.postponed_to || r.due_date; }
  function kv2(a, b) { return '<div class="kv"><span>' + a + '</span><b>' + b + '</b></div>'; }
  function noteBox(t) { return '<div class="note" style="margin-bottom:10px">' + esc(t) + '</div>'; }

  // ===== ข้อมูล =====
  function resetR() {
    R.loaded = false; R.loading = false; R.err = '';
    R.props = []; R.units = []; R.leases = []; R.pays = []; R.costs = []; R.rec = [];
  }
  async function loadRent() {
    if (!S.sb || R.loading) return;
    R.loading = true; R.err = '';
    try {
      var e = await S.sb.rpc('ensure_rent_rows');
      if (e.error) console.warn('ensure_rent_rows', e.error.message);
      var x = await Promise.all([
        S.sb.from('properties').select('*').order('created_at'),
        S.sb.from('units').select('*').order('name'),
        S.sb.from('leases').select('*,tenants(name,phone)'),
        S.sb.from('rent_payments').select('*').eq('cancelled', false).order('period', { ascending: false }),
        S.sb.from('unit_costs').select('*').order('paid_on', { ascending: false }).order('created_at', { ascending: false }),
        S.sb.from('rent_receipts').select('*').eq('cancelled', false).order('paid_on', { ascending: false }).order('created_at', { ascending: false })
      ]);
      for (var i = 0; i < x.length; i++) if (x[i].error) throw x[i].error;
      R.props = x[0].data; R.units = x[1].data; R.leases = x[2].data; R.pays = x[3].data; R.costs = x[4].data; R.rec = x[5].data;
      R.leases.forEach(ledger);
      R.loaded = true;
    } catch (ex) { R.err = 'โหลดข้อมูลไม่สำเร็จ: ' + (ex.message || ex); }
    R.loading = false;
    if (S.cur === 'rent') render();
  }
  function unit(id) { return R.units.find(function (u) { return u.id === id; }); }
  function uname(u) {
    var p = u && R.props.find(function (x) { return x.id === u.property_id; });
    return (p ? p.name + ' · ' : '') + (u ? u.name : '');
  }
  function leaseOf(u) { return R.leases.find(function (l) { return l.unit_id === u.id && l.status === 'active'; }); }
  function rowsOf(lid) { return R.pays.filter(function (r) { return r.lease_id === lid; }); }
  function uidOfRow(r) {
    var l = R.leases.find(function (x) { return x.id === r.lease_id; });
    return l ? l.unit_id : null;
  }
  function recsOf(lid) { return R.rec.filter(function (x) { return x.lease_id === lid; }); }
  function r2(n) { return Math.round(n * 100) / 100; }
  // จ่ายตัดงวดเก่าสุดก่อน (FIFO) ยอดที่ยังไม่จ่ายจึงทบไปงวดถัดไปโดยอัตโนมัติ
  function ledger(l) {
    var rs = rowsOf(l.id).slice().sort(function (a, b) { return a.period < b.period ? -1 : 1; });
    var T = recsOf(l.id).reduce(function (a, x) { return a + Number(x.amount); }, 0);
    rs.forEach(function (r) {
      var o = Number(r.amount), p = Math.min(T, o);
      r._paid = r2(p); r._left = r2(o - p); T = r2(T - p);
    });
    return rs;
  }
  function sum(a, k) { return a.reduce(function (t, x) { return t + x[k]; }, 0); }
  function unitOver(u) {
    var ids = R.leases.filter(function (l) { return l.unit_id === u.id; }).map(function (l) { return l.id; });
    var td = today();
    return R.pays.filter(function (r) { return ids.indexOf(r.lease_id) > -1 && r._left > 0 && eff(r) < td; });
  }
  // งวดปัจจุบันของสัญญา: ถ้ามีงวดถึงกำหนดแล้วยังไม่ครบ ให้รวมยอดค้างยกมา ถ้าไม่มี ให้แสดงงวดถัดไปงวดเดียว
  function cur(l) {
    var rs = ledger(l), td = today();
    var due = rs.filter(function (r) { return r._left > 0 && eff(r) <= td; });
    var left = r2(sum(rs, '_left'));
    if (due.length) {
      var c = due[due.length - 1], pay = r2(sum(due, '_left'));
      return { row: c, n: rs.indexOf(c) + 1, total: rs.length, pay: pay, carry: r2(pay - c._left), left: left };
    }
    var f = rs.find(function (r) { return r._left > 0; });
    if (f) return { row: f, n: rs.indexOf(f) + 1, total: rs.length, pay: f._left, carry: 0, left: left };
    return { row: null, total: rs.length, pay: 0, carry: 0, left: 0 };
  }
  function rstat(r) {
    if (r._left <= 0) return { t: 'จ่ายแล้ว', c: 'g' };
    var n = diff(today(), eff(r)), part = r._paid > 0 ? ' · จ่ายบางส่วน' : '';
    if (n < 0) return { t: 'เลยกำหนด ' + (-n) + ' วัน' + part, c: 'r' };
    if (n === 0) return { t: 'ครบกำหนดวันนี้' + part, c: 'a' };
    if (n <= 3) return { t: 'อีก ' + n + ' วันครบกำหนด' + part, c: 'a' };
    return { t: 'ยังไม่ถึงกำหนด' + part, c: 'b' };
  }
  function termTxt(l) { return l.term_months ? (l.term_months % 12 === 0 ? (l.term_months / 12) + ' ปี' : l.term_months + ' เดือน') : 'ไม่กำหนด'; }

  // ===== หน้าหลัก =====
  function card(u) {
    var l = leaseOf(u), st = UST[u.status] || UST.vacant;
    var h = '<button class="rc" data-a="runit" data-v="' + u.id + '"><div class="t"><b>' + esc(u.name) +
      (u.floor != null ? ' <small>ชั้น ' + u.floor + '</small>' : '') +
      '</b><span class="bd ' + st[1] + '">' + st[0] + '</span></div>';
    if (l) {
      h += '<div style="margin-top:6px">' + esc((l.tenants || {}).name) + '</div>';
      var c = cur(l);
      if (c.row) {
        var s = rstat(c.row);
        h += '<div class="s"><span class="bd ' + s.c + '">' + s.t + '</span><small>งวด ' + c.n + '/' + c.total + ' · ' + ml(c.row.period) +
          ' · ครบกำหนด ' + fd(eff(c.row)) + '</small></div><div class="s"><b>ต้องจ่าย ฿' + fmt(c.pay) + '</b>' +
          (c.carry > 0 ? '<small class="over">รวมค้างยกมา ฿' + fmt(c.carry) + '</small>' : '') + '</div>';
      } else if (c.total) {
        h += '<div class="s"><span class="bd g">จ่ายครบทุกงวดแล้ว</span></div>';
      } else {
        h += '<div class="s"><small>เริ่มสัญญา ' + fd(l.start_date) + '</small></div>';
      }
    } else if (Number(u.default_rent) > 0) {
      h += '<div class="s"><small>ค่าเช่าตั้งต้น ฿' + fmt(u.default_rent) + '</small></div>';
    }
    if (unitOver(u).some(function (r) { return !l || r.lease_id !== l.id; })) {
      h += '<div class="s over">ค้างจ่ายจากผู้เช่าเดิม</div>';
    }
    return h + '</button>';
  }

  function rentPage() {
    if (R.err) {
      return '<h2>อสังหาเช่า</h2><div class="card empty">' + esc(R.err) +
        '<br><button class="btn" data-a="rreload">ลองใหม่</button></div>';
    }
    if (!R.loaded) return '<div class="empty">กำลังโหลดข้อมูล...</div>';
    var h = '<h2>อสังหาเช่า</h2><div class="btns" style="margin-bottom:12px">' +
      '<button class="btn o" style="margin-top:0" data-a="raddp">' + ic('plus', 20) + ' เพิ่มตึก</button>' +
      '<button class="btn o" style="margin-top:0" data-a="raddu">' + ic('plus', 20) + ' เพิ่มห้อง</button></div>';
    if (!R.props.length) return h + '<div class="card empty">ยังไม่มีตึก<br>กด "เพิ่มตึก" เพื่อเริ่มต้น</div>';

    var n = R.units.length, o = 0, v = 0, m = 0;
    R.units.forEach(function (u) {
      if (u.status === 'occupied') o++; else if (u.status === 'vacant') v++; else m++;
    });
    var t = tm(), td = today(), cnt = 0, paid = 0, exp = 0, got = 0, od = 0, oda = 0;
    R.pays.forEach(function (r) {
      if (r.period === t) { cnt++; exp += Number(r.amount); got += r._paid; if (r._left <= 0) paid++; }
      if (r._left > 0 && eff(r) < td) { od++; oda += r._left; }
    });
    h += '<div class="grid">' +
      '<div class="card"><small>ห้องทั้งหมด</small><b class="v">' + n + '</b></div>' +
      '<div class="card"><small>มีผู้เช่า</small><b class="v">' + o + '</b></div>' +
      '<div class="card"><small>ห้องว่าง</small><b class="v">' + v + '</b></div>' +
      '<div class="card"><small>ซ่อมบำรุง</small><b class="v">' + m + '</b></div></div>' +
      '<div class="card"><h3>ค่าเช่าเดือนนี้ · ' + ml(t) + '</h3>' +
      kv2('จ่ายแล้ว', paid + ' / ' + cnt + ' ห้อง') +
      kv2('เก็บได้', '฿' + fmt(got) + ' จาก ฿' + fmt(exp)) +
      '<div class="kv"><span>ค้างเกินกำหนด</span><b class="' + (od ? 'over' : '') + '">' + od + ' รายการ ฿' + fmt(oda) + '</b></div></div>';

    h += '<div class="chips"><button class="chip ' + (R.pf === 'all' ? 'on' : '') + '" data-a="rpf" data-v="all">ทุกตึก</button>' +
      R.props.map(function (p) {
        return '<button class="chip ' + (R.pf === p.id ? 'on' : '') + '" data-a="rpf" data-v="' + p.id + '">' + esc(p.name) + '</button>';
      }).join('') + '</div>';
    var SF = [['all', 'ทั้งหมด'], ['occupied', 'มีผู้เช่า'], ['vacant', 'ว่าง'], ['maintenance', 'ซ่อมบำรุง'], ['late', 'ค้างจ่าย']];
    h += '<div class="chips">' + SF.map(function (s) {
      return '<button class="chip ' + (R.sf === s[0] ? 'on' : '') + '" data-a="rsf" data-v="' + s[0] + '">' + s[1] + '</button>';
    }).join('') + '</div>';

    function match(u) {
      if (R.sf === 'all') return true;
      if (R.sf === 'late') return unitOver(u).length > 0;
      return u.status === R.sf;
    }
    function cmp(a, b) {
      return ((a.floor == null ? 999 : a.floor) - (b.floor == null ? 999 : b.floor)) ||
        a.name.localeCompare(b.name, 'th', { numeric: true });
    }
    R.props.filter(function (p) { return R.pf === 'all' || p.id === R.pf; }).forEach(function (p) {
      var all = R.units.filter(function (u) { return u.property_id === p.id; });
      var us = all.filter(match).sort(cmp);
      h += '<div class="gh">' + ic('building', 20) + esc(p.name) + ' <small>(' + us.length + ' ห้อง)</small></div>';
      h += us.length ? us.map(card).join('') :
        '<div class="note">' + (all.length ? 'ไม่มีห้องตามตัวกรอง' : 'ยังไม่มีห้อง กด "เพิ่มห้อง"') + '</div>';
    });
    return h;
  }

  var _r = render;
  render = function () {
    _r();
    if (S.cur !== 'rent') return;
    if (S.sb && !R.loaded && !R.loading) loadRent();
    $('view').innerHTML = rentPage();
  };

  A.rpf = function (v) { R.pf = v; render(); };
  A.rsf = function (v) { R.sf = v; render(); };
  A.rreload = function () { R.err = ''; R.loaded = false; render(); };

  // ===== รายละเอียดห้อง =====
  function rowBtn(r) {
    var s = rstat(r);
    return '<button class="row" style="width:100%;text-align:left" data-a="rrow" data-v="' + r.id + '"><div class="gr">' +
      ml(r.period) + '<br><small>ครบกำหนด ' + fd(eff(r)) + ' · ฿' + fmt(r.amount) + (r._paid > 0 && r._left > 0 ? ' · ค้าง ฿' + fmt(r._left) : '') + '</small></div>' +
      '<span class="bd ' + s.c + '">' + s.t + '</span></button>';
  }
  function recRow(x) {
    return '<div class="kv"><span>' + fd(x.paid_on) + ' · ' + (MTH[x.method] || '') +
      (x.note ? '<br><small>' + esc(x.note) + '</small>' : '') + '</span><span><b>฿' + fmt(x.amount) + '</b> ' +
      '<button class="bd r" style="margin-left:6px" data-a="rdelrec" data-v="' + x.id + '">ลบ</button></span></div>';
  }

  function unitSheet(id) {
    var u = unit(id);
    if (!u) return closeSheet();
    var l = leaseOf(u), st = UST[u.status] || UST.vacant;
    var h = head(esc(uname(u)));
    h += '<div class="kv"><span>สถานะห้อง</span><span class="bd ' + st[1] + '">' + st[0] + '</span></div>';
    if (u.floor != null) h += kv2('ชั้น', u.floor);
    h += kv2('ค่าเช่าตั้งต้น', '฿' + fmt(u.default_rent));

    if (l) {
      var tn = l.tenants || {}, c = cur(l), rs = ledger(l), last = rs[rs.length - 1];
      h += '<h3 style="margin-top:14px">ผู้เช่า</h3>' + kv2('ชื่อ', esc(tn.name)) +
        (tn.phone ? kv2('โทร', '<a href="tel:' + esc(tn.phone) + '" style="color:var(--pri)">' + esc(tn.phone) + '</a>') : '') +
        kv2('เริ่มสัญญา', fd(l.start_date)) + kv2('ระยะสัญญา', termTxt(l)) +
        (l.term_months && last ? kv2('ครบสัญญา (งวดสุดท้าย)', fd(eff(last))) : '') +
        kv2('ค่าเช่า', '฿' + fmt(l.rent) + ' / เดือน') +
        kv2('เงินมัดจำ', '฿' + fmt(l.deposit) + (l.deposit_paid_on ? ' (รับ ' + fd(l.deposit_paid_on) + ')' : '')) +
        kv2('ครบกำหนดทุกวันที่', l.due_day);
      if (c.row) {
        var s = rstat(c.row);
        h += '<h3 style="margin-top:14px">ค่าเช่างวดที่ ' + c.n + (c.total ? ' / ' + c.total : '') + ' · ' + ml(c.row.period) + '</h3>' +
          '<div class="kv"><span>สถานะ</span><span class="bd ' + s.c + '">' + s.t + '</span></div>' +
          kv2('ค่าเช่างวดนี้', '฿' + fmt(c.row.amount)) +
          (c.carry > 0 ? '<div class="kv"><span>ค้างยกมาจากงวดก่อน</span><b class="over">฿' + fmt(c.carry) + '</b></div>' : '') +
          (c.row._paid > 0 ? kv2('จ่ายแล้วในงวดนี้', '฿' + fmt(c.row._paid)) : '') +
          '<div class="kv"><span><b>ต้องจ่ายตอนนี้</b></span><b>฿' + fmt(c.pay) + '</b></div>' +
          kv2('ครบกำหนด', fd(c.row.due_date)) + (c.row.postponed_to ? kv2('เลื่อนเป็นวันที่', fd(c.row.postponed_to)) : '') +
          '<button class="btn" data-a="rrow" data-v="' + c.row.id + '">รับเงิน / เลื่อนวัน</button>';
      } else if (c.total) {
        h += '<div class="note" style="margin-top:12px">จ่ายครบทุกงวดตามสัญญาแล้ว</div>';
      } else {
        h += '<div class="note" style="margin-top:12px">ยังไม่มีงวดค่าเช่า</div>';
      }
      var rc = recsOf(l.id).slice(0, 5);
      if (rc.length) h += '<h3 style="margin-top:14px">ประวัติรับเงิน</h3>' + rc.map(recRow).join('');
      h += '<button class="btn o" data-a="rend" data-v="' + l.id + '">ย้ายออก</button>';
    } else if (u.status === 'vacant') {
      h += '<div class="btns"><button class="btn" data-a="rlease" data-v="' + u.id + '">ทำสัญญาเช่า</button>' +
        '<button class="btn o" data-a="rst" data-v="' + u.id + '|maintenance">ส่งซ่อมบำรุง</button></div>';
    } else {
      h += '<button class="btn" data-a="rst" data-v="' + u.id + '|vacant">ซ่อมเสร็จ พร้อมให้เช่า</button>';
    }

    var old = unitOver(u).filter(function (r) { return !l || r.lease_id !== l.id; });
    if (old.length) h += '<div class="hr"></div><h3 class="over">ค้างจ่ายจากผู้เช่าเดิม</h3>' + old.map(rowBtn).join('');

    var ct = R.costs.filter(function (c) { return c.unit_id === u.id; }).reduce(function (a, c) { return a + Number(c.amount); }, 0);
    h += '<div class="hr"></div><button class="row" style="width:100%;text-align:left;padding:14px 4px" data-a="rcosts" data-v="' + u.id + '">' +
      '<div class="gr">ค่าซ่อมบำรุง / อุปกรณ์<br><small>รวม ฿' + fmt(ct) + '</small></div><span>›</span></button>' +
      '<button class="btn o" data-a="redu" data-v="' + u.id + '">แก้ไขชื่อ / ชั้น / ค่าเช่าตั้งต้น</button>';
    openSheet(h);
  }
  A.runit = function (id) { unitSheet(id); };

  A.rst = async function (v) {
    if (busy) return;
    var a = v.split('|'), u = unit(a[0]);
    if (!u) return;
    var msg = a[1] === 'vacant' ? 'ซ่อมห้องเสร็จแล้ว เปลี่ยนเป็น "ห้องว่าง" พร้อมให้เช่าหรือไม่?' : 'ส่งห้องนี้เข้า "ซ่อมบำรุง" หรือไม่?';
    if (!confirm(msg)) return;
    busy = true;
    var r = await S.sb.from('units').update({ status: a[1] }).eq('id', a[0]).neq('status', 'occupied').select('id');
    busy = false;
    if (r.error || !r.data || !r.data.length) return toast('เปลี่ยนสถานะไม่สำเร็จ');
    await loadRent();
    unitSheet(a[0]);
    toast('เปลี่ยนสถานะห้องแล้ว');
  };

  // ===== เพิ่มตึก / ห้อง / แก้ไขห้อง =====
  A.raddp = function () {
    openSheet(head('เพิ่มตึก') +
      '<label>ชื่อตึก<input id="zpn" placeholder="เช่น ตึก 5"></label>' +
      '<label>ที่อยู่ (ไม่บังคับ)<input id="zpa"></label>' +
      '<div class="err" id="zer"></div><button class="btn" id="zgo" data-a="rsavep">บันทึกตึก</button>');
  };
  A.rsavep = async function () {
    if (busy) return;
    var n = $('zpn').value.trim();
    if (!n) { $('zer').textContent = 'ใส่ชื่อตึก'; return; }
    busy = true; $('zgo').disabled = true;
    var r = await S.sb.from('properties').insert({ name: n, address: $('zpa').value.trim() || null });
    busy = false;
    if (r.error) {
      $('zgo').disabled = false;
      $('zer').textContent = /duplicate|unique/i.test(r.error.message) ? 'มีตึกชื่อนี้แล้ว' : 'บันทึกไม่สำเร็จ: ' + r.error.message;
      return;
    }
    await loadRent(); closeSheet(); toast('เพิ่มตึกแล้ว');
  };

  A.raddu = function () {
    if (!R.props.length) return toast('เพิ่มตึกก่อน');
    var sel = R.pf !== 'all' ? R.pf : R.props[0].id;
    openSheet(head('เพิ่มห้อง') +
      '<label>ตึก<select id="zup">' + R.props.map(function (p) {
        return '<option value="' + p.id + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      }).join('') + '</select></label>' +
      '<div class="two"><label>ชั้น (ไม่บังคับ)<input id="zuf" type="number" inputmode="numeric"></label>' +
      '<label>ค่าเช่าตั้งต้น<input id="zur" type="number" inputmode="decimal" min="0" value="0"></label></div>' +
      '<label>ชื่อห้อง (เพิ่มหลายห้องพร้อมกันได้ ขึ้นบรรทัดใหม่หรือคั่นด้วยจุลภาค)' +
      '<textarea id="zun" rows="4" placeholder="เช่น 15, 16, 17"></textarea></label>' +
      '<div class="err" id="zer"></div><button class="btn" id="zgo" data-a="rsaveu">บันทึกห้อง</button>');
  };
  A.rsaveu = async function () {
    if (busy) return;
    var names = [];
    $('zun').value.split(/[\n,，;]+/).forEach(function (x) {
      x = x.trim();
      if (x && names.indexOf(x) < 0) names.push(x);
    });
    if (!names.length) { $('zer').textContent = 'ใส่ชื่อห้องอย่างน้อย 1 ห้อง'; return; }
    if (names.length > 100) { $('zer').textContent = 'เพิ่มได้ครั้งละไม่เกิน 100 ห้อง'; return; }
    var rent = parseFloat($('zur').value) || 0, fl = $('zuf').value === '' ? null : parseInt($('zuf').value);
    if (rent < 0) { $('zer').textContent = 'ค่าเช่าไม่ถูกต้อง'; return; }
    var pid = $('zup').value;
    busy = true; $('zgo').disabled = true;
    var r = await S.sb.from('units').insert(names.map(function (n) {
      return { property_id: pid, name: n, default_rent: rent, floor: fl };
    }));
    busy = false;
    if (r.error) {
      $('zgo').disabled = false;
      $('zer').textContent = /duplicate|unique/i.test(r.error.message) ? 'มีห้องชื่อซ้ำในตึกนี้' : 'บันทึกไม่สำเร็จ: ' + r.error.message;
      return;
    }
    await loadRent(); closeSheet(); toast('เพิ่ม ' + names.length + ' ห้องแล้ว');
  };

  A.redu = function (id) {
    var u = unit(id);
    if (!u) return;
    openSheet(head('แก้ไขห้อง') + noteBox(uname(u)) +
      '<label>ชื่อห้อง<input id="zun" value="' + esc(u.name) + '"></label>' +
      '<div class="two"><label>ชั้น<input id="zuf" type="number" inputmode="numeric" value="' + (u.floor == null ? '' : u.floor) + '"></label>' +
      '<label>ค่าเช่าตั้งต้น<input id="zur" type="number" inputmode="decimal" min="0" value="' + u.default_rent + '"></label></div>' +
      '<div class="err" id="zer"></div><button class="btn" id="zgo" data-a="rsaveed" data-v="' + id + '">บันทึก</button>');
  };
  A.rsaveed = async function (id) {
    if (busy) return;
    var n = $('zun').value.trim(), rent = parseFloat($('zur').value);
    if (!n || isNaN(rent) || rent < 0) { $('zer').textContent = 'ตรวจสอบชื่อห้องและค่าเช่า'; return; }
    busy = true;
    var r = await S.sb.from('units').update({
      name: n, default_rent: rent, floor: $('zuf').value === '' ? null : parseInt($('zuf').value)
    }).eq('id', id).select('id');
    busy = false;
    if (r.error || !r.data || !r.data.length) {
      $('zer').textContent = r.error && /duplicate|unique/i.test(r.error.message) ? 'มีห้องชื่อซ้ำในตึกนี้' : 'บันทึกไม่สำเร็จ';
      return;
    }
    await loadRent(); unitSheet(id); toast('แก้ไขห้องแล้ว');
  };

  // ===== ทำสัญญาเช่า =====
  A.rlease = function (id) {
    var u = unit(id);
    if (!u) return;
    var t = today();
    dueTouched = false;
    openSheet(head('ทำสัญญาเช่า') + noteBox(uname(u)) +
      '<label>ชื่อผู้เช่า<input id="zt" placeholder="ชื่อ-นามสกุล"></label>' +
      '<label>เบอร์โทร (ไม่บังคับ)<input id="zph" type="tel" inputmode="tel"></label>' +
      '<label>วันเริ่มสัญญา<input id="zs" type="date" value="' + t + '"></label>' +
      '<label>ระยะสัญญา (ไม่เกิน 3 ปี)<select id="zterm">' + (function () {
        var o = '';
        for (var m = 1; m <= 36; m++) o += '<option value="' + m + '"' + (m === 12 ? ' selected' : '') + '>' +
          (m % 12 === 0 ? (m / 12) + ' ปี (' + m + ' เดือน)' : m + ' เดือน') + '</option>';
        return o;
      })() + '</select></label>' +
      '<label>ค่าเช่าต่อเดือน (บาท)<input id="zr" type="number" inputmode="decimal" min="0" value="' + (u.default_rent || '') + '"></label>' +
      '<label>เงินมัดจำ (บาท)<input id="zd" type="number" inputmode="decimal" min="0" value="0"></label>' +
      '<label>วันที่รับเงินมัดจำ<input id="zdp" type="date" value="' + t + '"></label>' +
      '<label>วันครบกำหนดจ่ายค่าเช่างวดแรก<input id="zf" type="date" value="' + addMonth(t) + '"></label>' +
      '<small>งวดต่อ ๆ ไปจะครบกำหนดวันที่เดียวกันของทุกเดือน ถ้าเป็นผู้เช่าที่อยู่มาก่อนแล้ว ให้เลือกวันครบกำหนดเป็นงวดที่กำลังจะถึง</small>' +
      '<div class="err" id="zer"></div><button class="btn" id="zgo" data-a="rsavel" data-v="' + id + '">บันทึกสัญญา</button>');
    var sync = function () { if (!dueTouched) $('zf').value = addMonth($('zs').value || today()); };
    $('zs').onchange = sync; $('zs').oninput = sync;
    $('zf').onchange = function () { dueTouched = true; };
  };
  A.rsavel = async function (id) {
    if (busy) return;
    var er = function (m) { $('zer').textContent = m; };
    var name = $('zt').value.trim(), s = $('zs').value, f = $('zf').value;
    var rent = parseFloat($('zr').value), dep = parseFloat($('zd').value) || 0, dpd = $('zdp').value || null;
    if (!name) return er('ใส่ชื่อผู้เช่า');
    if (!s || !f) return er('เลือกวันที่ให้ครบ');
    if (f < s) return er('วันครบกำหนดงวดแรกต้องไม่ก่อนวันเริ่มสัญญา');
    if (isNaN(rent) || rent < 0 || dep < 0) return er('ตรวจสอบจำนวนเงิน');
    if (!confirm('ทำสัญญากับ ' + name + '\nค่าเช่า ฿' + fmt(rent) + ' / เดือน\nระยะสัญญา ' + $('zterm').value + ' เดือน\nมัดจำ ฿' + fmt(dep) +
      '\nงวดแรกครบกำหนด ' + fd(f) + '\nยืนยัน?')) return;
    busy = true; $('zgo').disabled = true; $('zgo').textContent = 'กำลังบันทึก...';
    var r = await S.sb.rpc('start_lease', {
      p_unit_id: id, p_tenant_name: name, p_tenant_phone: $('zph').value,
      p_start: s, p_first_due: f, p_rent: rent, p_deposit: dep, p_deposit_paid_on: dpd, p_term_months: parseInt($('zterm').value)
    });
    busy = false;
    if (r.error) {
      $('zgo').disabled = false; $('zgo').textContent = 'บันทึกสัญญา';
      return er('บันทึกไม่สำเร็จ: ' + r.error.message);
    }
    await loadRent(); unitSheet(id); toast('ทำสัญญาแล้ว ห้องเปลี่ยนเป็น "มีผู้เช่า"');
  };

  // ===== ย้ายออก =====
  A.rend = function (lid) {
    var l = R.leases.find(function (x) { return x.id === lid; });
    if (!l) return;
    var u = unit(l.unit_id);
    openSheet(head('ย้ายออก') + noteBox(uname(u) + ' · ' + ((l.tenants || {}).name || '')) +
      '<label>วันที่ย้ายออก<input id="zed" type="date" value="' + today() + '"></label>' +
      '<label>คืนเงินมัดจำ (บาท) · รับไว้ ฿' + fmt(l.deposit) +
      '<input id="zrf" type="number" inputmode="decimal" min="0" value="' + l.deposit + '"></label>' +
      '<small>ห้องจะเปลี่ยนเป็น "ซ่อมบำรุง" ค่าเช่าเดือนหลังวันย้ายออกที่ยังไม่จ่ายจะถูกยกเลิก ส่วนงวดก่อนหน้าที่ยังไม่จ่ายจะยังแสดงเป็นค้างจ่าย</small>' +
      '<div class="err" id="zer"></div><button class="btn" id="zgo" data-a="rsaven" data-v="' + lid + '">ยืนยันย้ายออก</button>');
  };
  A.rsaven = async function (lid) {
    if (busy) return;
    var l = R.leases.find(function (x) { return x.id === lid; });
    var d = $('zed').value, rf = parseFloat($('zrf').value);
    if (!d) { $('zer').textContent = 'เลือกวันที่ย้ายออก'; return; }
    if (!confirm('ยืนยันย้ายออกวันที่ ' + fd(d) + ' ?')) return;
    busy = true; $('zgo').disabled = true;
    var r = await S.sb.rpc('end_lease', { p_lease_id: lid, p_end: d, p_refund: isNaN(rf) ? null : rf });
    busy = false;
    if (r.error) { $('zgo').disabled = false; $('zer').textContent = 'บันทึกไม่สำเร็จ: ' + r.error.message; return; }
    await loadRent(); unitSheet(l.unit_id); toast('ย้ายออกแล้ว ห้องอยู่ในสถานะซ่อมบำรุง');
  };

  // ===== งวดค่าเช่า: รับเงิน (แบ่งจ่ายได้) / เลื่อน / ลบ =====
  A.rmeth = function (v) {
    meth = v;
    document.querySelectorAll('.md .chip').forEach(function (c) { c.classList.toggle('on', c.dataset.v === v); });
  };
  function rowSheet(id) {
    var r = R.pays.find(function (x) { return x.id === id; });
    if (!r) return;
    var l = R.leases.find(function (x) { return x.id === r.lease_id; });
    var u = l && unit(l.unit_id), s = rstat(r), c = cur(l);
    var isCur = c.row && c.row.id === r.id;
    meth = 'cash';
    var h = head('ค่าเช่า ' + ml(r.period)) + kv2('ห้อง', esc(uname(u))) +
      kv2('ผู้เช่า', esc(l && l.tenants ? l.tenants.name : '')) + kv2('ค่าเช่างวดนี้', '฿' + fmt(r.amount)) +
      (r._paid > 0 ? kv2('จ่ายแล้ว', '฿' + fmt(r._paid)) : '') +
      (r._left > 0 ? '<div class="kv"><span>ค้างอยู่</span><b class="over">฿' + fmt(r._left) + '</b></div>' : '') +
      kv2('ครบกำหนด', fd(r.due_date)) + (r.postponed_to ? kv2('เลื่อนเป็นวันที่', fd(r.postponed_to)) : '') +
      '<div class="kv"><span>สถานะ</span><span class="bd ' + s.c + '">' + s.t + '</span></div>';
    if (r._left <= 0) {
      h += '<div class="note" style="margin-top:10px">งวดนี้จ่ายครบแล้ว ถ้าบันทึกผิด ให้ลบรายการรับเงินในหน้าห้อง</div>';
    } else if (!isCur) {
      h += '<div class="note" style="margin-top:10px">งวดนี้ยังไม่ถึงคิว ระบบจะตัดเงินงวดเก่าสุดก่อนเสมอ</div>';
    } else {
      h += '<h3 style="margin-top:14px">รับเงินค่าเช่า</h3>' +
        (c.carry > 0 ? '<div class="note">รวมยอดค้างยกมา ฿' + fmt(c.carry) + ' แล้ว</div>' : '') +
        '<label>จำนวนที่รับ (บาท) · ต้องจ่ายตอนนี้ ฿' + fmt(c.pay) +
        '<input id="zpa2" type="number" inputmode="decimal" min="0" value="' + c.pay + '"></label>' +
        '<small>จ่ายบางส่วนได้ ยอดที่เหลือจะทบไปงวดถัดไป</small>' +
        '<label>วันที่รับเงิน<input id="zpd" type="date" value="' + today() + '"></label>' +
        '<div class="mth md">' + Object.keys(MTH).map(function (k) {
          return '<button type="button" class="chip ' + (k === meth ? 'on' : '') + '" data-a="rmeth" data-v="' + k + '">' + MTH[k] + '</button>';
        }).join('') + '</div>' +
        '<label>หมายเหตุ (ไม่บังคับ)<input id="zpm"></label>' +
        '<div class="err" id="zer"></div><button class="btn" data-a="rpay" data-v="' + l.id + '">บันทึกรับเงิน</button>' +
        '<div class="hr"></div><h3>เลื่อนวันครบกำหนด</h3>' +
        '<label>เลื่อนเป็นวันที่<input id="zpp" type="date" value="' + addDays(eff(r), 7) + '"></label>' +
        '<button class="btn o" data-a="rpost" data-v="' + r.id + '">เลื่อนวันครบกำหนด</button>' +
        (r.postponed_to ? '<button class="btn o" data-a="rpostclr" data-v="' + r.id + '">ยกเลิกการเลื่อน (กลับเป็น ' + fd(r.due_date) + ')</button>' : '');
    }
    openSheet(h);
  }
  A.rrow = function (id) { rowSheet(id); };

  async function updRow(id, patch, okMsg) {
    if (busy) return;
    var row = R.pays.find(function (x) { return x.id === id; });
    var uid = row ? uidOfRow(row) : null;
    busy = true;
    var r = await S.sb.from('rent_payments').update(patch).eq('id', id).select('id');
    busy = false;
    if (r.error || !r.data || !r.data.length) {
      var e = $('zer');
      if (e) e.textContent = 'บันทึกไม่สำเร็จ' + (r.error ? ': ' + r.error.message : '');
      return;
    }
    await loadRent();
    if (uid) unitSheet(uid); else closeSheet();
    toast(okMsg);
  }
  A.rpay = async function (lid) {
    if (busy) return;
    var l = R.leases.find(function (x) { return x.id === lid; });
    var c = l && cur(l), amt = parseFloat($('zpa2').value), d = $('zpd').value;
    if (!c || !c.row) return;
    if (!(amt > 0)) { $('zer').textContent = 'ใส่จำนวนเงินที่รับ'; return; }
    if (!d) { $('zer').textContent = 'เลือกวันที่รับเงิน'; return; }
    if (amt > c.left + 0.005) { $('zer').textContent = 'เกินยอดค้างทั้งสัญญา (฿' + fmt(c.left) + ')'; return; }
    if (amt < c.pay - 0.005 && !confirm('รับบางส่วน ฿' + fmt(amt) + ' จาก ฿' + fmt(c.pay) + '\nยอดที่เหลือ ฿' + fmt(c.pay - amt) + ' จะทบไปงวดถัดไป\nยืนยัน?')) return;
    busy = true;
    var n = $('zpm').value.trim();
    var r = await S.sb.from('rent_receipts').insert({ lease_id: lid, amount: r2(amt), paid_on: d, method: meth, note: n || null });
    busy = false;
    if (r.error) { $('zer').textContent = 'บันทึกไม่สำเร็จ: ' + r.error.message; return; }
    await loadRent(); unitSheet(l.unit_id); toast('บันทึกรับเงินแล้ว');
  };
  A.rdelrec = async function (id) {
    if (busy) return;
    var x = R.rec.find(function (k) { return k.id === id; });
    if (!x) return;
    if (!confirm('ลบรายการรับเงิน ฿' + fmt(x.amount) + ' (' + fd(x.paid_on) + ') ?\nงวดค่าเช่าจะกลับเป็นค้างจ่ายตามยอดที่ลบ')) return;
    busy = true;
    var r = await S.sb.from('rent_receipts').update({ cancelled: true }).eq('id', id).select('id');
    busy = false;
    if (r.error || !r.data || !r.data.length) return toast('ลบไม่สำเร็จ');
    var l = R.leases.find(function (k) { return k.id === x.lease_id; });
    await loadRent(); if (l) unitSheet(l.unit_id); toast('ลบรายการรับเงินแล้ว');
  };
  A.rpost = function (id) {
    var r = R.pays.find(function (x) { return x.id === id; }), d = $('zpp').value;
    if (!d) { $('zer') && ($('zer').textContent = 'เลือกวันที่ที่จะเลื่อนไป'); return toast('เลือกวันที่ที่จะเลื่อนไป'); }
    if (d <= r.due_date) return toast('ต้องเลื่อนไปหลังวันครบกำหนดเดิม (' + fd(r.due_date) + ')');
    return updRow(id, { postponed_to: d }, 'เลื่อนเป็น ' + fd(d) + ' แล้ว');
  };
  A.rpostclr = function (id) { return updRow(id, { postponed_to: null }, 'ยกเลิกการเลื่อนแล้ว'); };

  // ===== ค่าซ่อมบำรุง (แยกจากหน้าผู้เช่า) =====
  A.rcosts = function (id) {
    var u = unit(id);
    if (!u) return;
    var cs = R.costs.filter(function (c) { return c.unit_id === id; });
    var ct = cs.reduce(function (a, c) { return a + Number(c.amount); }, 0);
    openSheet(head('ค่าซ่อมบำรุง') + noteBox(uname(u)) + kv2('รวมทั้งหมด', '฿' + fmt(ct)) +
      (cs.length ? cs.slice(0, 30).map(function (c) {
        return '<div class="kv"><span>' + fd(c.paid_on) + ' · ' + (KIND[c.kind] || '') +
          (c.note ? '<br><small>' + esc(c.note) + '</small>' : '') + '</span><b>฿' + fmt(c.amount) + '</b></div>';
      }).join('') : '<div class="note">ยังไม่มีรายการ</div>') +
      '<button class="btn" data-a="rcost" data-v="' + id + '">+ บันทึกค่าซ่อมบำรุง</button>' +
      '<div class="btns"><button class="btn o" data-a="dcosts" data-v="' + id + '">ลบรายการ</button>' +
      '<button class="btn o" data-a="runit" data-v="' + id + '">กลับหน้าห้อง</button></div>');
  };

  A.rkind = function (v) {
    kind = v;
    document.querySelectorAll('.kd .chip').forEach(function (c) { c.classList.toggle('on', c.dataset.v === v); });
  };
  A.rcost = function (id) {
    var u = unit(id);
    if (!u) return;
    kind = 'repair';
    openSheet(head('บันทึกค่าซ่อมบำรุง') + noteBox(uname(u)) +
      '<div class="lb">ประเภท</div><div class="mth kd">' + Object.keys(KIND).map(function (k) {
        return '<button type="button" class="chip ' + (k === kind ? 'on' : '') + '" data-a="rkind" data-v="' + k + '">' + KIND[k] + '</button>';
      }).join('') + '</div>' +
      '<label>จำนวนเงิน (บาท)<input id="zca" type="number" inputmode="decimal" min="0"></label>' +
      '<label>วันที่จ่าย<input id="zcd" type="date" value="' + today() + '"></label>' +
      '<label>รายละเอียด (ไม่บังคับ)<input id="zcn" placeholder="เช่น ทาสีห้อง"></label>' +
      '<div class="err" id="zer"></div><button class="btn" id="zgo" data-a="rsavec" data-v="' + id + '">บันทึกรายการ</button>');
  };
  A.rsavec = async function (id) {
    if (busy) return;
    var amt = parseFloat($('zca').value), d = $('zcd').value;
    if (!(amt > 0)) { $('zer').textContent = 'ใส่จำนวนเงิน'; return; }
    if (!d) { $('zer').textContent = 'เลือกวันที่'; return; }
    if (!confirm('บันทึก ' + KIND[kind] + ' ฿' + fmt(amt) + ' ?\n(บันทึกแล้วแก้ไขไม่ได้)')) return;
    busy = true; $('zgo').disabled = true;
    var r = await S.sb.from('unit_costs').insert({
      unit_id: id, kind: kind, amount: amt, paid_on: d, note: $('zcn').value.trim() || null
    });
    busy = false;
    if (r.error) { $('zgo').disabled = false; $('zer').textContent = 'บันทึกไม่สำเร็จ: ' + r.error.message; return; }
    await loadRent(); A.rcosts(id); toast('บันทึกค่าซ่อมบำรุงแล้ว');
  };

  if (window.App && window.App.stop) {
    var _stop = window.App.stop;
    window.App.stop = function () { resetR(); _stop(); };
  }
  window.SSRent = {
    R: R, cur: cur, eff: eff, today: today, diff: diff, fd: fd, uname: uname, unit: unit, rowsOf: rowsOf,
    ensure: function () { if (S.sb && !R.loaded && !R.loading) return loadRent(); },
    reload: function () { return loadRent(); }
  };
})();
