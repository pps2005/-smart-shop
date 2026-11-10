/* Xiress add-on: extras.js
   1) เอาลูกศรขยาย (⤢) ออกจาก "เมนูเพิ่มเติม"
   2) หน้าคลัง: ปัดการ์ดสินค้าไปทางซ้าย เพื่อแก้ไข / ลบ
   3) Popup สินค้า: ย่อเป็นสามเหลี่ยม แยกตามไซส์/ลาย พร้อมประวัติการขายของแต่ละไซส์
   4) เมนู "บัญชี": บันทึกรายจ่าย
   Load LAST in index.html:  <script src="extras.js"></script>
   To undo: delete that one line from index.html. */
(function () {
  var css = document.createElement('style');
  css.textContent = [
    /* สามเหลี่ยมย่อ/ขยาย */
    '#sbody details.tri{background:var(--bg);border-radius:14px;padding:0 14px;margin-top:10px}',
    '#sbody details.tri[open]{padding-bottom:10px}',
    '#sbody details.tri>summary{list-style:none;display:flex;align-items:center;gap:10px;padding:14px 0;font-weight:700;cursor:pointer}',
    '#sbody details.tri>summary::-webkit-details-marker{display:none}',
    '#sbody details.tri>summary::before{content:"";flex:0 0 auto;border-left:8px solid currentColor;border-top:6px solid transparent;border-bottom:6px solid transparent;transition:transform .15s}',
    '#sbody details.tri[open]>summary::before{transform:rotate(90deg)}',
    '#sbody details.tri>summary .sr{margin-left:auto;font-weight:600;color:var(--mute);font-size:.9rem;display:flex;align-items:center;gap:6px}',
    /* ปัดซ้าย */
    '.swp-w{position:relative;margin-bottom:12px;border-radius:20px;overflow:hidden}',
    '.swp-w>.card{position:relative;z-index:1;margin:0;touch-action:pan-y;user-select:none;-webkit-user-select:none;transition:transform .2s}',
    '.swp-a{position:absolute;top:0;bottom:0;right:0;width:160px;display:flex}',
    '.swp-a button{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#fff;font-weight:700;font-size:.9rem}',
    '.swp-e{background:#2563eb}.swp-d{background:#dc2626}',
    /* บัญชี */
    '.xdh{display:flex;justify-content:space-between;margin:14px 4px 6px;color:var(--mute);font-size:.85rem}'
  ].join('');
  document.head.appendChild(css);

  function byCode(c) { return S.prods.find(function (p) { return p.code === c; }); }
  function today() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); }
  function kv(a, b) { return '<div class="kv"><span>' + a + '</span><b>' + b + '</b></div>'; }
  function dtime(s) { return new Date(s).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }); }

  /* ===== 1) เอาลูกศรขยายออกจากเมนูเพิ่มเติม ===== */
  var _os = openSheet;
  openSheet = function (h) {
    _os(h);
    var b = $('sbody'), t = b && b.querySelector('.sh h2');
    if (t && t.textContent.trim() === 'เมนูเพิ่มเติม') {
      var x = b.querySelector('.ex');
      if (x) x.parentNode.removeChild(x);
    }
  };

  /* ===== 2) ปัดซ้ายในหน้าคลัง ===== */
  var W = 160, openW = null;
  function closeSwipe() {
    if (openW) { openW.card.style.transform = ''; openW = null; }
  }
  function bindSwipe(c) {
    var sx = 0, sy = 0, base = 0, pos = 0, lock = null, down = false, moved = false;
    c.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = true; lock = null; moved = false; sx = e.clientX; sy = e.clientY;
      base = (openW && openW.card === c) ? -W : 0;
      pos = base;
      if (openW && openW.card !== c) closeSwipe();
    });
    c.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (lock === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (lock === 'x') {
          try { c.setPointerCapture(e.pointerId); } catch (_) {}
          c.style.transition = 'none';
        }
      }
      if (lock !== 'x') return;
      moved = true;
      pos = Math.max(-W, Math.min(0, base + dx));
      c.style.transform = 'translateX(' + pos + 'px)';
    });
    function end() {
      if (!down) return;
      down = false;
      if (lock !== 'x') return;
      c.style.transition = '';
      if (pos < -W / 2) {
        c.style.transform = 'translateX(-' + W + 'px)';
        if (openW && openW.card !== c) closeSwipe();
        openW = { card: c };
      } else {
        c.style.transform = '';
        if (openW && openW.card === c) openW = null;
      }
    }
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('click', function (e) {
      if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; return; }
      if (openW && openW.card === c) { e.stopPropagation(); e.preventDefault(); closeSwipe(); }
    }, true);
  }
  function swipeify() {
    var v = $('view');
    if (!v) return;
    openW = null;
    Array.prototype.forEach.call(v.querySelectorAll('.card'), function (c) {
      var b = c.querySelector('button[data-a="open"]');
      if (!b || c.parentNode.classList.contains('swp-w')) return;
      var code = esc(b.dataset.v), w = document.createElement('div');
      w.className = 'swp-w';
      w.innerHTML = '<div class="swp-a">' +
        '<button type="button" class="swp-e" data-a="swe" data-v="' + code + '">' + ic('edit', 22) + '<span>แก้ไข</span></button>' +
        '<button type="button" class="swp-d" data-a="swd" data-v="' + code + '">' + ic('trash', 22) + '<span>ลบ</span></button></div>';
      c.parentNode.insertBefore(w, c);
      w.appendChild(c);
      bindSwipe(c);
    });
    Array.prototype.forEach.call(v.querySelectorAll('.note'), function (n) {
      if (/ระยะที่ 4/.test(n.textContent)) n.textContent = 'ปัดการ์ดสินค้าไปทางซ้าย เพื่อแก้ไขหรือลบ';
    });
  }
  document.addEventListener('pointerdown', function (e) {
    if (openW && !openW.card.parentNode.contains(e.target)) closeSwipe();
  }, true);
  A.swe = function (v) { closeSwipe(); A.eopen(v); };
  A.swd = function (v) { closeSwipe(); A.pdel(v); };

  /* ===== 3) Popup สินค้าแบบย่อ/ขยายได้ ===== */
  var OVL = { red: 'เสีย', black: 'หมด', out: 'หมด', blue: 'สำรอง' };
  function effStatus(p) {
    if (p.status === 'red') return 'red';
    if (p.status === 'black') return 'black';
    if (pq(p) < 1) return 'out';
    if (p.status === 'blue') return 'blue';
    return '';
  }
  function saleRow(s, code) {
    var tot = Number(s.unit_price) * s.qty, vo = !!s.voided_at;
    return '<div class="kv" style="align-items:flex-start;' + (vo ? 'opacity:.55' : '') + '"><span>' + dtime(s.created_at) +
      '<br><small>' + esc((s.locations || {}).name || '') + ' · ×' + s.qty + '</small></span>' +
      '<span style="text-align:right">' + (vo
        ? '<s>฿' + fmt(tot) + '</s><br><small>ยกเลิกแล้ว</small>'
        : '<b>฿' + fmt(tot) + '</b><br><button class="vbtn" data-a="vsale" data-v="' + s.id + '|' + esc(code) + '">ยกเลิกการขาย</button>') +
      '</span></div>';
  }

  detail = function (code) {
    var p = byCode(code);
    if (!p) return toast('ไม่พบสินค้า ' + code);
    var vs = p.variants || [], eff = effStatus(p), dotc = eff === 'out' ? 'black' : p.status, c = esc(code);

    var big = '<div class="im" style="border-radius:16px;aspect-ratio:16/10;margin:10px 0">' + thumb(p) +
      (eff ? '<span class="ovl o-' + eff + '"><b>' + OVL[eff] + '</b></span>' : '') + '</div>';

    var h = head(esc(p.name)) +
      '<div class="row" style="padding:0 0 4px"><div class="th" style="width:64px;height:64px;flex-basis:64px">' + thumb(p) + '</div>' +
      '<div class="gr"><b>' + esc(p.code) + '</b><br><small>฿' + fmt(p.base_price) + ' · คงเหลือรวม ' + pq(p) + ' ชิ้น</small></div>' +
      '<i class="dt" style="background:var(--' + dotc + ')"></i></div>' +
      '<div class="btns"><button class="btn o" data-a="qr" data-v="' + c + '">' + ic('qr', 20) + ' QR Code</button>' +
      '<button class="btn" data-a="sale" data-v="' + c + '">' + ic('cart', 20) + ' ขายสินค้า</button></div>' +

      '<details class="tri"><summary>รูปและรายละเอียดสินค้า</summary>' + big +
      kv('รหัสสินค้า', esc(p.code)) +
      kv('ประเภท', esc(p.categories && p.categories.name)) +
      kv('ต้นทุน', '฿' + fmt(p.current_cost)) +
      kv('ราคาขายตั้งต้น', '฿' + fmt(p.base_price)) +
      kv('สถานะ', '<i class="dt" style="background:var(--' + p.status + ');margin-right:6px"></i>' + ST[p.status]) +
      kv('คงเหลือรวม', pq(p) + ' ชิ้น') +
      (p.description ? kv('รายละเอียด', esc(p.description)) : '') +
      '</details>' +

      '<small style="display:block;margin-top:14px">แยกตามไซส์/ลาย</small>' +
      (vs.length ? vs.map(function (v) {
        return '<details class="tri"' + (vs.length === 1 ? ' open' : '') + '><summary>' + esc(vname(v)) +
          '<span class="sr">เหลือ ' + vq(v) + '</span></summary>' +
          S.locs.map(function (l) { return kv(esc(l.name), lq(v, l.id) + ' ชิ้น'); }).join('') +
          '<div id="vh-' + v.id + '"><small>กำลังโหลดประวัติการขาย…</small></div></details>';
      }).join('') : '<div class="note" style="margin-top:8px">ยังไม่มีไซส์/ลาย</div>') +

      '<details class="tri"><summary>เปลี่ยนสถานะ<span class="sr"><i class="dt" style="background:var(--' + p.status + ')"></i>' + ST[p.status] + '</span></summary>' +
      '<div class="chips" style="flex-wrap:wrap">' + Object.keys(ST).map(function (k) {
        return '<button class="chip ' + (p.status === k ? 'on' : '') + '" data-a="setst" data-v="' + c + '|' + k + '">' +
          '<i class="dt" style="background:var(--' + k + ')"></i>' + ST[k] + '</button>';
      }).join('') + '</div><div id="sth" data-c="' + c + '"></div></details>' +

      '<details class="tri"><summary>จัดการสินค้า</summary><div class="btns">' +
      '<button class="btn o" data-a="rsopen" data-v="' + c + '">' + ic('plus', 22) + ' เติมสินค้า</button>' +
      '<button class="btn o" data-a="tfopen" data-v="' + c + '">' + ic('swap', 22) + ' ย้ายสินค้า</button>' +
      '<button class="btn o" data-a="eopen" data-v="' + c + '">' + ic('edit', 22) + ' แก้ไขสินค้า</button>' +
      '<button class="btn o" data-a="aopen" data-v="' + c + '">' + ic('sliders', 22) + ' ปรับจำนวน</button></div>' +
      '<button class="btn o dng" data-a="pdel" data-v="' + c + '">' + ic('trash', 20) + ' ลบสินค้านี้</button></details>';

    openSheet(h);

    /* ประวัติการขาย แยกตามไซส์/ลาย */
    S.sb.from('sales')
      .select('id,variant_id,qty,unit_price,created_at,voided_at,locations(name)')
      .eq('product_id', p.id).order('created_at', { ascending: false }).limit(200)
      .then(function (r) {
        var by = {};
        if (!r.error && r.data) r.data.forEach(function (s) { (by[s.variant_id] = by[s.variant_id] || []).push(s); });
        vs.forEach(function (v) {
          var el = $('vh-' + v.id);
          if (!el) return;
          if (r.error) { el.innerHTML = '<small>โหลดประวัติการขายไม่สำเร็จ</small>'; return; }
          var L = by[v.id] || [], live = L.filter(function (s) { return !s.voided_at; });
          var n = live.reduce(function (a, s) { return a + s.qty; }, 0);
          el.innerHTML = '<small style="display:block;margin:10px 0 2px">ประวัติการขาย (' + live.length + ' รายการ · ขายแล้ว ' + n + ' ชิ้น)</small>' +
            (L.length ? L.map(function (s) { return saleRow(s, code); }).join('') : '<small>ยังไม่เคยขาย</small>');
        });
      });

    /* ประวัติการเปลี่ยนสถานะ */
    S.sb.from('status_history').select('from_status,to_status,created_at')
      .eq('product_id', p.id).order('created_at', { ascending: false }).limit(5)
      .then(function (r) {
        var el = $('sth');
        if (!el || el.dataset.c !== code || r.error || !r.data || !r.data.length) return;
        el.innerHTML = '<small>ประวัติการเปลี่ยนสถานะ</small>' + r.data.map(function (x) {
          return '<div class="kv"><span>' + dtime(x.created_at) + '</span><span>' + ST[x.from_status] + ' → ' + ST[x.to_status] + '</span></div>';
        }).join('');
      });
  };

  /* ===== 4) บัญชี: บันทึกรายจ่าย ===== */
  var EXK = { rent: 'ค่าเช่า', water: 'ค่าน้ำ', electric: 'ค่าไฟ', travel: 'ค่าเดินทาง', labor: 'ค่าแรง', packaging: 'บรรจุภัณฑ์', other: 'อื่น ๆ' };
  var PMX = { cash: 'เงินสด', card: 'บัตร', transfer: 'โอนเงิน', other: 'อื่น ๆ' };
  var X = { off: 0, rows: [], loaded: false, loading: false, err: '', kind: '', pay: 'cash', busy: false, tok: 0, uid: null };

  function monthRange() {
    var t = new Date(today() + 'T00:00:00Z');
    var s = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + X.off, 1));
    var e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1));
    return {
      a: s.toISOString().slice(0, 10), b: e.toISOString().slice(0, 10),
      label: s.toLocaleDateString('th-TH', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    };
  }
  function offsetOf(d) {
    var t = new Date(today() + 'T00:00:00Z'), x = new Date(d + 'T00:00:00Z');
    return (x.getUTCFullYear() - t.getUTCFullYear()) * 12 + (x.getUTCMonth() - t.getUTCMonth());
  }
  async function loadExp() {
    var my = ++X.tok, r = monthRange();
    X.loading = true; X.err = '';
    var res = await S.sb.from('expenses')
      .select('id,kind,amount,paid_on,payment_method,note,voided_at')
      .gte('paid_on', r.a).lt('paid_on', r.b)
      .order('paid_on', { ascending: false }).order('created_at', { ascending: false }).limit(1000);
    if (my !== X.tok) return;
    X.loading = false; X.loaded = true;
    if (res.error) { X.err = res.error.message; X.rows = []; } else { X.rows = res.data; }
    if (S.cur === 'acc') $('view').innerHTML = accPage();
  }
  function sumBy(rows, f) {
    var m = {};
    rows.forEach(function (x) { var k = x[f]; m[k] = (m[k] || 0) + Number(x.amount); });
    return m;
  }
  function accPage() {
    var r = monthRange();
    var h = '<h2>บัญชี</h2><button class="btn" data-a="xadd">' + ic('plus', 20) + ' บันทึกรายจ่าย</button>' +
      '<div class="ovn"><button data-a="xprev" aria-label="เดือนก่อนหน้า">‹</button><b>' + r.label + '</b><button data-a="xnext" aria-label="เดือนถัดไป">›</button></div>';
    if (!X.loaded) return h + '<div class="empty">กำลังโหลด...</div>';
    if (X.err) return h + '<div class="note">โหลดรายจ่ายไม่สำเร็จ: ' + esc(X.err) + '</div>';

    var live = X.rows.filter(function (x) { return !x.voided_at; });
    var tot = live.reduce(function (a, x) { return a + Number(x.amount); }, 0);
    h += '<div class="grid"><div class="card"><small>รายจ่ายรวม</small><b class="v">฿' + fmt(tot) + '</b></div>' +
      '<div class="card"><small>จำนวนรายการ</small><b class="v">' + live.length + '</b></div></div>';

    if (live.length) {
      var bk = sumBy(live, 'kind'), bp = sumBy(live, 'payment_method');
      h += '<details class="tri" style="background:var(--card);border:1px solid var(--line)"><summary>สรุปแยกประเภทและวิธีจ่าย</summary>' +
        Object.keys(bk).sort(function (a, b) { return bk[b] - bk[a]; }).map(function (k) { return kv(EXK[k] || k, '฿' + fmt(bk[k])); }).join('') +
        '<div class="kv" style="border-top:2px solid var(--line)"></div>' +
        Object.keys(bp).map(function (k) { return kv(PMX[k] || k, '฿' + fmt(bp[k])); }).join('') + '</details>';
    }

    var days = [], by = {};
    X.rows.forEach(function (x) { if (!by[x.paid_on]) { by[x.paid_on] = []; days.push(x.paid_on); } by[x.paid_on].push(x); });
    h += days.length ? days.map(function (d) {
      var L = by[d], dsum = L.filter(function (x) { return !x.voided_at; }).reduce(function (a, x) { return a + Number(x.amount); }, 0);
      return '<div class="xdh"><span>' + new Date(d + 'T00:00:00Z').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) +
        '</span><span>รวม ฿' + fmt(dsum) + '</span></div><div class="card" style="padding:2px 14px">' +
        L.map(function (x) {
          var vo = !!x.voided_at;
          return '<div class="kv" style="align-items:flex-start;' + (vo ? 'opacity:.55' : '') + '"><span>' + esc(EXK[x.kind] || x.kind) +
            (x.note ? ' · ' + esc(x.note) : '') + '<br><small>' + esc(PMX[x.payment_method] || '') + '</small></span>' +
            '<span style="text-align:right">' + (vo
              ? '<s>฿' + fmt(x.amount) + '</s><br><small>ยกเลิกแล้ว</small>'
              : '<b>฿' + fmt(x.amount) + '</b><br><button class="vbtn" data-a="xvoid" data-v="' + x.id + '">ยกเลิก</button>') +
            '</span></div>';
        }).join('') + '</div>';
    }).join('') : '<div class="empty">ยังไม่มีรายจ่ายในเดือนนี้<br>กดปุ่ม "บันทึกรายจ่าย" ด้านบน</div>';
    return h + '<div class="note" style="margin-top:12px">ระบบจะหักรายจ่ายเหล่านี้ออกจากกำไรในรายงานให้อัตโนมัติ</div>';
  }
  function accRender() {
    if (S.uid !== X.uid) { X.uid = S.uid; X.loaded = false; X.rows = []; }
    if (S.ready && S.sb && !X.loaded && !X.loading) loadExp();
    $('view').innerHTML = accPage();
  }
  function reload() { X.loaded = false; X.loading = false; accRender(); }

  A.xprev = function () { X.off--; reload(); };
  A.xnext = function () { X.off++; reload(); };
  A.xadd = function () {
    if (!S.ready) return;
    X.kind = ''; X.pay = 'cash'; X.busy = false;
    var t = today();
    openSheet(head('บันทึกรายจ่าย') +
      '<small>ประเภทรายจ่าย</small><div class="pay" id="xk">' + Object.keys(EXK).map(function (k) {
        return '<button type="button" class="chip" data-a="xkind" data-v="' + k + '">' + EXK[k] + '</button>';
      }).join('') + '</div>' +
      '<div class="two"><label>จำนวนเงิน (บาท)<input id="xa" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label>' +
      '<label>วันที่จ่าย<input id="xd" type="date" value="' + t + '" max="' + t + '"></label></div>' +
      '<small>วิธีจ่ายเงิน</small><div class="pay" id="xp">' + Object.keys(PMX).map(function (k) {
        return '<button type="button" class="chip ' + (k === 'cash' ? 'on' : '') + '" data-a="xpay" data-v="' + k + '">' + PMX[k] + '</button>';
      }).join('') + '</div>' +
      '<label>หมายเหตุ (ไม่บังคับ)<input id="xn" maxlength="200" placeholder="เช่น ค่าไฟเดือนนี้"></label>' +
      '<div class="err" id="xer"></div><button class="btn" id="xgo" data-a="xsave">บันทึกรายจ่าย</button>');
  };
  function pick(box, v) {
    Array.prototype.forEach.call($(box).querySelectorAll('.chip'), function (b) { b.classList.toggle('on', b.getAttribute('data-v') === v); });
  }
  A.xkind = function (v) { X.kind = v; pick('xk', v); };
  A.xpay = function (v) { X.pay = v; pick('xp', v); };
  A.xsave = async function () {
    if (X.busy) return;
    var amt = parseFloat($('xa').value), d = $('xd').value, note = $('xn').value.trim(), err = '';
    if (!X.kind) err = 'เลือกประเภทรายจ่ายก่อน';
    else if (!(amt > 0)) err = 'ใส่จำนวนเงินมากกว่า 0';
    else if (amt > 10000000) err = 'จำนวนเงินสูงผิดปกติ กรุณาตรวจสอบอีกครั้ง';
    else if (!d) err = 'เลือกวันที่จ่าย';
    else if (d > today()) err = 'วันที่ต้องไม่เป็นวันในอนาคต';
    $('xer').textContent = err;
    if (err) return;
    X.busy = true; $('xgo').disabled = true;
    var r = await S.sb.from('expenses').insert({
      kind: X.kind, amount: Math.round(amt * 100) / 100, paid_on: d, payment_method: X.pay, note: note || null
    });
    X.busy = false;
    if (r.error) {
      if ($('xgo')) $('xgo').disabled = false;
      if ($('xer')) $('xer').textContent = 'บันทึกไม่สำเร็จ: ' + r.error.message;
      return;
    }
    closeSheet();
    toast('บันทึกรายจ่ายแล้ว');
    X.off = offsetOf(d);
    if (S.cur === 'acc') reload(); else { X.loaded = false; }
  };
  A.xvoid = async function (id) {
    if (X.busy) return;
    if (!confirm('ยกเลิกรายจ่ายนี้?\nรายการจะไม่ถูกนับในบัญชี (ยังเก็บประวัติไว้)')) return;
    X.busy = true;
    var r = await S.sb.from('expenses').update({ voided_at: new Date().toISOString(), void_reason: 'ลงผิด/ยกเลิก' })
      .eq('id', id).is('voided_at', null).select('id');
    X.busy = false;
    if (r.error) return toast('ยกเลิกไม่สำเร็จ: ' + r.error.message);
    if (!r.data || !r.data.length) { toast('รายการนี้ถูกยกเลิกไปแล้ว หรือไม่มีสิทธิ์แก้ไข'); return reload(); }
    toast('ยกเลิกรายจ่ายแล้ว');
    reload();
  };

  /* ===== ผูกเข้ากับ render ===== */
  var _r = render;
  render = function () {
    _r.apply(this, arguments);
    if (S.ready && S.cur === 'stock') swipeify();
    if (S.cur === 'acc') accRender();
  };
})();
