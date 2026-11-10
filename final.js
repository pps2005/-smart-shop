/* Xiress add-on (ต่อยอดจากของเดิม ไม่แทนที่ไฟล์เดิม)
   วิธีใช้: ใส่บรรทัดนี้ใน index.html "ต่อจาก" overview.js ->  <script src="final.js"></script>
   วิธียกเลิก: ลบบรรทัดนั้นออก ระบบกลับเป็นเหมือนเดิม */
(function () {
  'use strict';

  Object.assign(I, {
    receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
  });
  if (!M.some(function (m) { return m.id === 'tax'; })) {
    var ri = M.findIndex(function (m) { return m.id === 'rep'; });
    M.splice(ri < 0 ? M.length : ri + 1, 0, { id: 'tax', i: 'receipt', t: 'ภาษี' });
  }
  var mf = document.createElement('link'); mf.rel = 'manifest'; mf.href = 'manifest.webmanifest'; document.head.appendChild(mf);
  var ai = document.createElement('link'); ai.rel = 'apple-touch-icon'; ai.href = 'icon-192.png'; document.head.appendChild(ai);

  var css = document.createElement('style');
  css.textContent = [
    '.sheet>div{max-height:92vh!important}.ex{display:none!important}',
    '.h3{font-size:1.1rem;font-weight:700;margin:16px 0 8px}',
    '.mg{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px}',
    '.mc{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:112px;padding:14px 8px;background:var(--bg);border:1px solid var(--line);border-radius:20px;font-weight:700;text-align:center}',
    '.mc .mi{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:rgba(52,210,123,.16);color:var(--pri)}',
    '.tri{background:var(--bg);border-radius:14px;padding:4px 14px;margin:10px 0}',
    '.tri>summary{list-style:none;display:flex;align-items:center;gap:10px;font-weight:700;cursor:pointer;padding:12px 0}',
    '.tri>summary::-webkit-details-marker{display:none}',
    '.tri>summary::before{content:"";border-left:10px solid currentColor;border-top:6px solid transparent;border-bottom:6px solid transparent;transition:transform .2s;flex:0 0 auto}',
    '.tri[open]>summary::before{transform:rotate(90deg)}',
    '.tri>summary small{margin-left:auto;font-weight:400}',
    '.qrd{display:flex;gap:12px;align-items:center;margin:12px 0}',
    '.qrd img{width:120px;height:120px;image-rendering:pixelated;background:#fff;border-radius:10px;padding:5px;flex:0 0 120px}',
    '.qrd .btns{margin-top:6px}.qrd .btn{margin:0;min-height:44px;padding:8px}',
    '.swr{position:relative;overflow:hidden;border-radius:18px;margin-bottom:12px}',
    '.swa{position:absolute;top:0;bottom:0;right:0;display:flex}',
    '.swa button{width:84px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#fff;font-size:.85rem;font-weight:700}',
    '.swa .e{background:#2563eb}.swa .d{background:#dc2626}',
    '.swc{position:relative;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px;touch-action:pan-y;transition:transform .2s;user-select:none;-webkit-user-select:none}',
    '.swc .tri{margin:4px 0 0}',
    '#sw input{padding-right:94px!important}#sw .sb{color:var(--pri)}#sw .cb{right:46px}',
    '.scv{position:relative;background:#000;border-radius:16px;overflow:hidden;aspect-ratio:1;margin-bottom:10px}',
    '.scv video{width:100%;height:100%;object-fit:cover}',
    '.scv:after{content:"";position:absolute;inset:18%;border:3px solid #34d27b;border-radius:18px}',
    '.bub{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin:10px 0;white-space:pre-line;line-height:1.6}',
    '.bub.q{background:var(--pri2);color:#04210f;margin-left:36px;font-weight:600}',
    '.qs{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}',
    '.txs{display:flex;align-items:flex-start;margin:6px 0 14px}',
    '.txd{flex:1;display:flex;flex-direction:column;align-items:center;position:relative}',
    '.txd i{width:26px;height:26px;border-radius:50%;background:var(--line);color:var(--mute);font-style:normal;font-size:.8rem;display:grid;place-items:center;z-index:1}',
    '.txd.done i{background:var(--pri);color:#fff}.txd.cur i{background:var(--pri);color:#fff;box-shadow:0 0 0 4px rgba(52,210,123,.25)}',
    '.txd:not(:last-child)::after{content:"";position:absolute;top:13px;left:50%;width:100%;border-top:3px dotted var(--line)}',
    '.txd.done:not(:last-child)::after{border-color:var(--pri)}',
    '.txg{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}@media(max-width:600px){.txg{grid-template-columns:1fr}}',
    '.txh{color:var(--pri);font-size:.75rem;margin:-6px 0 12px}',
    '.txb{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}',
    '.txbig{font-size:1.9rem;font-weight:800;color:var(--pri)}'
  ].join('');
  document.head.appendChild(css);

  /* ---------- ตัวช่วย ---------- */
  var EXK = { rent: 'ค่าเช่า', water: 'ค่าน้ำ', electric: 'ค่าไฟ', travel: 'ค่าเดินทาง', labor: 'ค่าแรง', packaging: 'บรรจุภัณฑ์', other: 'อื่น ๆ' };
  var PMN = { cash: 'เงินสด', card: 'บัตร', transfer: 'โอนเงิน', other: 'อื่น ๆ' };
  var SG = function (n) { return (n > 0 ? '+' : n < 0 ? '-' : '') + fmt(Math.abs(Math.round(n))); };
  var N0 = function (n) { return fmt(Math.round(Number(n) || 0)); };
  function today() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); }
  function bkk(d) { return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); }
  function addD(s, n) { var a = s.split('-'); return new Date(Date.UTC(+a[0], +a[1] - 1, +a[2] + n)).toISOString().slice(0, 10); }
  function fd(s) { var a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function byCode(c) { return S.prods.find(function (p) { return p.code === c; }); }
  function kv(a, b) { return '<div class="kv"><span>' + a + '</span><b>' + b + '</b></div>'; }
  function cardH(a, b) { return '<div class="card"><small>' + a + '</small><b class="v">' + b + '</b></div>'; }
  function sum(arr, k) { return arr.reduce(function (a, x) { return a + (Number(x[k]) || 0); }, 0); }
  function still(id) { return S.cur === id && S.ready; }
  function qrSafe(text) { try { var q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createDataURL(8, 3); } catch (e) { return ''; } }

  async function fetchAll(mk) {
    var out = [], from = 0, step = 1000;
    for (;;) {
      var r = await mk().range(from, from + step - 1);
      if (r.error) throw r.error;
      out = out.concat(r.data);
      if (r.data.length < step || from > 200000) break;
      from += step;
    }
    return out;
  }
  function salesBetween(a, b) {
    return fetchAll(function () {
      return S.sb.from('sales').select('id,product_id,qty,unit_price,unit_cost,payment_method,created_at')
        .is('voided_at', null).gte('created_at', a + 'T00:00:00+07:00').lt('created_at', b + 'T00:00:00+07:00').order('created_at');
    });
  }
  function expBetween(a, b) {
    return fetchAll(function () {
      return S.sb.from('expenses').select('id,kind,amount,paid_on,note').is('voided_at', null).gte('paid_on', a).lt('paid_on', b).order('paid_on');
    });
  }
  function csv(rows) {
    return '\ufeff' + rows.map(function (r) {
      return r.map(function (c) {
        if (c == null) return '';
        c = String(c);
        if (/^[=+@]/.test(c) || /^-[^0-9.]/.test(c)) c = "'" + c;
        return /[",\n\r]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
      }).join(',');
    }).join('\r\n');
  }
  function download(name, text, type) {
    var b = new Blob([text], { type: type || 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function errMsg(e) {
    var m = (e && e.message) || String(e);
    return /relation|does not exist|schema cache/i.test(m) ? m + ' (ยังไม่ได้รันไฟล์ phase5.sql ใน Supabase ใช่หรือไม่?)' : m;
  }

  /* ---------- 1) เมนูเพิ่มเติม (การ์ดแบบรูปที่ 4) + เอาปุ่มลูกศรขยายออก ---------- */
  var _os = openSheet;
  openSheet = function (h) { _os(h); var x = document.querySelector('#sbody .ex'); if (x) x.remove(); };
  var _cs = closeSheet;
  closeSheet = function () {
    stopScan(); _cs();
    if (/^#c=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  };
  A.more = function () {
    openSheet(head('เมนูเพิ่มเติม') + '<div class="mg">' + M.slice(3).map(function (m) {
      return '<button class="mc" data-a="go" data-v="' + m.id + '"><span class="mi">' + ic(m.i, 26) + '</span>' + esc(m.t) + '</button>';
    }).join('') + '</div>');
  };

  /* ---------- 2) หน้ารายละเอียดสินค้า: รูป > QR > ข้อมูล > ประวัติขาย > คงเหลือรวม > ไซส์/ลาย(พับได้) ---------- */
  var LB = { red: 'เสีย', black: 'หมด', out: 'หมด', blue: 'สำรอง' };
  function eff(p) {
    if (p.status === 'red') return 'red';
    if (p.status === 'black') return 'black';
    if (pq(p) < 1) return 'out';
    return p.status === 'blue' ? 'blue' : '';
  }
  function ovl(p) { var e = eff(p); return e ? '<span class="ovl o-' + e + '"><b>' + LB[e] + '</b></span>' : ''; }

  detail = function (code) {
    var p = byCode(code);
    if (!p) return toast('ไม่พบสินค้า ' + code);
    var vs = p.variants || [], c = esc(code);
    var q = qrSafe(location.origin + location.pathname + '#p=' + encodeURIComponent(code));
    openSheet(
      head(esc(p.name)) +
      '<div class="im" style="border-radius:16px;aspect-ratio:16/10">' + thumb(p) + ovl(p) + '</div>' +
      '<div class="qrd">' + (q ? '<img src="' + q + '" alt="QR">' : '') + '<div><b style="font-size:1.25rem">' + c + '</b>' +
      '<div><small>QR Code ประจำสินค้า</small></div><div class="btns">' +
      '<button class="btn o" data-a="dl" data-v="' + c + '" aria-label="ดาวน์โหลด QR">' + ic('dl', 20) + '</button>' +
      '<button class="btn o" data-a="pr" data-v="' + c + '" aria-label="พิมพ์ QR">' + ic('print', 20) + '</button></div></div></div>' +
      kv('ประเภท', esc(p.categories && p.categories.name)) +
      kv('ต้นทุน', '฿' + fmt(p.current_cost)) + kv('ราคาขายตั้งต้น', '฿' + fmt(p.base_price)) +
      '<div class="kv"><span>สถานะ</span><span><i class="dt" style="background:var(--' + p.status + ');margin-right:6px"></i>' + ST[p.status] + '</span></div>' +
      (p.description ? '<div class="kv"><span>รายละเอียด</span><span>' + esc(p.description) + '</span></div>' : '') +
      '<div id="shist2" data-c="' + c + '"><div class="h3">ประวัติการขาย</div><small>กำลังโหลด...</small></div>' +
      kv('คงเหลือรวม', pq(p) + ' ชิ้น') +
      '<details class="tri"><summary>แยกตามไซส์/ลาย <small>' + vs.length + ' รายการ</small></summary>' +
      vs.map(function (v) {
        return '<div class="kv"><span>' + esc(vname(v)) + '</span><span>' +
          S.locs.map(function (l) { return esc(l.name) + ' ' + lq(v, l.id); }).join(' · ') + '</span></div>';
      }).join('') + '</details>' +
      '<button class="btn" data-a="sale" data-v="' + c + '">' + ic('cart', 20) + ' ขายสินค้า</button>' +
      '<div class="h3">เปลี่ยนสถานะ</div><div class="chips" style="flex-wrap:wrap">' +
      Object.keys(ST).map(function (k) {
        return '<button class="chip ' + (p.status === k ? 'on' : '') + '" data-a="setst" data-v="' + c + '|' + k + '"><i class="dt" style="background:var(--' + k + ')"></i>' + ST[k] + '</button>';
      }).join('') + '</div><div id="sth2" data-c="' + c + '"></div>' +
      '<div class="h3">จัดการสต๊อก</div><div class="btns">' +
      '<button class="btn o" data-a="rsopen" data-v="' + c + '">' + ic('plus', 22) + ' เติมสินค้า</button>' +
      '<button class="btn o" data-a="tfopen" data-v="' + c + '">' + ic('swap', 22) + ' ย้ายสินค้า</button></div>' +
      '<div class="h3">แก้ไขข้อมูล</div><div class="btns">' +
      '<button class="btn o" data-a="eopen" data-v="' + c + '">' + ic('edit', 22) + ' แก้ไขสินค้า</button>' +
      '<button class="btn o" data-a="aopen" data-v="' + c + '">' + ic('sliders', 22) + ' ปรับจำนวน</button></div>' +
      '<div class="dsep"></div><button class="btn o dng" data-a="pdel" data-v="' + c + '">' + ic('trash', 20) + ' ลบสินค้านี้</button>'
    );
    S.sb.from('sales').select('id,qty,unit_price,created_at,voided_at,variants(size,pattern),locations(name)')
      .eq('product_id', p.id).order('created_at', { ascending: false }).limit(8)
      .then(function (r) {
        var el = $('shist2');
        if (!el || el.dataset.c !== code) return;
        var rows = (!r.error && r.data) ? r.data : [];
        el.innerHTML = '<div class="h3">ประวัติการขาย</div>' + (rows.length ? rows.map(function (s) {
          var tot = Number(s.unit_price) * s.qty, vo = !!s.voided_at;
          var dt = new Date(s.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
          return '<div class="kv" style="align-items:flex-start;' + (vo ? 'opacity:.55' : '') + '"><span>' + dt +
            '<br><small>' + esc(vname(s.variants || {})) + ' · ' + esc((s.locations || {}).name || '') + ' · ×' + s.qty + '</small></span>' +
            '<span style="text-align:right">' + (vo ? '<s>฿' + fmt(tot) + '</s><br><small>ยกเลิกแล้ว</small>'
              : '<b>฿' + fmt(tot) + '</b><br><button class="vbtn" data-a="vsale" data-v="' + s.id + '|' + esc(code) + '">ยกเลิกการขาย</button>') +
            '</span></div>';
        }).join('') : '<small>ยังไม่มีประวัติการขาย</small>');
      });
    S.sb.from('status_history').select('from_status,to_status,created_at').eq('product_id', p.id)
      .order('created_at', { ascending: false }).limit(5).then(function (r) {
        var el = $('sth2');
        if (!el || el.dataset.c !== code || r.error || !r.data || !r.data.length) return;
        el.innerHTML = '<small>ประวัติการเปลี่ยนสถานะ</small>' + r.data.map(function (h) {
          return '<div class="kv"><span>' + new Date(h.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) +
            '</span><span>' + ST[h.from_status] + ' → ' + ST[h.to_status] + '</span></div>';
        }).join('');
      });
  };

  /* ---------- 3) หน้าคลัง: ปัดซ้ายเพื่อ แก้ไข/ลบ + ไซส์/ลายพับได้ ---------- */
  stockPage = function () {
    var L = S.locs;
    var tot = function (id) {
      return S.prods.reduce(function (a, p) {
        return a + (p.variants || []).reduce(function (b, v) { return b + (id ? lq(v, id) : vq(v)); }, 0);
      }, 0);
    };
    var sh = S.loc === 'all' ? L : L.filter(function (l) { return l.id === S.loc; });
    var rows = filt().filter(function (p) { return S.loc === 'all' || (p.variants || []).some(function (v) { return lq(v, S.loc) > 0; }); });
    return '<h2>คลังสินค้า</h2><div class="grid">' + cardH('รวมทุกที่', fmt(tot()) + ' ชิ้น') +
      L.map(function (l) { return cardH(esc(l.name), fmt(tot(l.id)) + ' ชิ้น'); }).join('') + '</div>' +
      '<div class="chips"><button class="chip ' + (S.loc === 'all' ? 'on' : '') + '" data-a="loc" data-v="all">' + ic('pin', 14) + ' ทุกที่</button>' +
      L.map(function (l) { return '<button class="chip ' + (S.loc === l.id ? 'on' : '') + '" data-a="loc" data-v="' + l.id + '">' + esc(l.name) + '</button>'; }).join('') + '</div>' +
      stChips() + '<div class="note" style="margin-bottom:12px">ปัดการ์ดสินค้าไปทางซ้ายเพื่อ แก้ไข หรือ ลบ</div>' +
      (rows.map(function (p) {
        var c = esc(p.code), vs = p.variants || [];
        return '<div class="swr"><div class="swa">' +
          '<button class="e" data-a="eopen" data-v="' + c + '">' + ic('edit', 22) + 'แก้ไข</button>' +
          '<button class="d" data-a="pdel" data-v="' + c + '">' + ic('trash', 22) + 'ลบ</button></div>' +
          '<div class="swc"><button class="row" style="width:100%;text-align:left;padding-top:0" data-a="open" data-v="' + c + '">' +
          '<div class="th">' + thumb(p) + '</div><div class="gr"><b>' + c + '</b> ' + esc(p.name) + '<br><small>รวม ' + pq(p) + ' ชิ้น</small></div>' +
          '<i class="dt" style="background:var(--' + p.status + ')"></i></button>' +
          '<details class="tri"><summary>แยกตามไซส์/ลาย <small>' + vs.length + ' รายการ</small></summary>' +
          vs.map(function (v) {
            return '<div class="kv"><span>' + esc(vname(v)) + '</span><span>' + sh.map(function (l) { return esc(l.name) + ' ' + lq(v, l.id); }).join(' · ') + '</span></div>';
          }).join('') + '</details></div></div>';
      }).join('') || (S.prods.length ? '<div class="empty">ไม่พบสินค้า</div>' : emptyBox));
  };

  var sw = null, SWW = 168, swT = 0;
  document.addEventListener('pointerdown', function (e) {
    var c = e.target.closest && e.target.closest('.swc');
    document.querySelectorAll('.swc.open').forEach(function (x) {
      if (x !== c) { x.style.transform = ''; x.classList.remove('open'); }
    });
    if (!c) { sw = null; return; }
    sw = { c: c, x: e.clientX, y: e.clientY, base: c.classList.contains('open') ? -SWW : 0, drag: false, id: e.pointerId, cur: 0 };
  });
  document.addEventListener('pointermove', function (e) {
    if (!sw || e.pointerId !== sw.id) return;
    var dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (!sw.drag) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) { sw.drag = true; sw.c.style.transition = 'none'; }
      else if (Math.abs(dy) > 10) { sw = null; return; }
      else return;
    }
    sw.cur = Math.max(-SWW, Math.min(0, sw.base + dx));
    sw.c.style.transform = 'translateX(' + sw.cur + 'px)';
  });
  function swEnd() {
    if (!sw) return;
    if (sw.drag) {
      var open = sw.cur < -SWW / 2;
      sw.c.style.transition = '';
      sw.c.style.transform = open ? 'translateX(-' + SWW + 'px)' : '';
      sw.c.classList.toggle('open', open);
      swT = Date.now();
    }
    sw = null;
  }
  document.addEventListener('pointerup', swEnd);
  document.addEventListener('pointercancel', swEnd);
  document.addEventListener('click', function (e) {
    if (Date.now() - swT < 350) { e.stopPropagation(); e.preventDefault(); return; }
    var c = e.target.closest && e.target.closest('.swc.open');
    if (c) { c.style.transform = ''; c.classList.remove('open'); e.stopPropagation(); e.preventDefault(); }
  }, true);

  /* ---------- 4) สแกน QR ด้วยกล้อง + QR ประจำประเภท ---------- */
  var stream = null, scanning = false, scanTimer = null;
  function stopScan() {
    scanning = false;
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  }
  function onScanned(t) {
    var m = t.match(/#p=([^&]+)$/), g = t.match(/#c=([^&]+)$/);
    if (m) { closeSheet(); return A.sale(decodeURIComponent(m[1])); }
    if (g) { closeSheet(); return catSheet(decodeURIComponent(g[1])); }
    toast('QR นี้ไม่ใช่ของร้าน');
    startScan();
  }
  async function startScan() {
    var v = $('scvid'); if (!v) return;
    scanning = true;
    var det = null;
    if ('BarcodeDetector' in window) { try { det = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) {} }
    if (!det && !window.jsQR) {
      try {
        await new Promise(function (ok, no) {
          var s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s);
        });
      } catch (e) { $('scer').textContent = 'โหลดตัวอ่าน QR ไม่ได้ ตรวจสอบอินเทอร์เน็ต'; return; }
    }
    var cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true }), bz = false;
    scanTimer = setInterval(async function () {
      if (!scanning || !$('scvid')) return stopScan();
      if (bz || v.readyState < 2) return;
      bz = true;
      try {
        var txt = '';
        if (det) { var r = await det.detect(v); if (r.length) txt = r[0].rawValue; }
        else {
          cv.width = v.videoWidth; cv.height = v.videoHeight; cx.drawImage(v, 0, 0);
          var im = cx.getImageData(0, 0, cv.width, cv.height), q = window.jsQR(im.data, im.width, im.height);
          if (q) txt = q.data;
        }
        if (txt) { stopScan(); onScanned(txt); }
      } catch (e) {}
      bz = false;
    }, 300);
  }
  A.scan = async function () {
    openSheet(head('สแกน QR Code') + '<div class="scv"><video id="scvid" playsinline muted></video></div><div class="err" id="scer"></div><small>เล็งกล้องไปที่ QR ของสินค้า ระบบจะเปิดหน้าขายให้ทันที</small>');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      var v = $('scvid'); v.srcObject = stream; await v.play(); startScan();
    } catch (e) { var er = $('scer'); if (er) er.textContent = 'เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์ (ต้องเปิดผ่าน https)'; stopScan(); }
  };
  var scb = document.createElement('button');
  scb.type = 'button'; scb.className = 'sb cb'; scb.setAttribute('aria-label', 'สแกน QR'); scb.setAttribute('data-a', 'scan');
  scb.innerHTML = ic('qr', 20); $('sw').appendChild(scb);

  function catSheet(id) {
    var c = S.cats.find(function (x) { return x.id === id; });
    if (!c) return toast('ไม่พบประเภทสินค้านี้');
    var L = S.prods.filter(function (p) { return p.category_id === id; })
      .sort(function (a, b) { return ((pq(b) > 0) - (pq(a) > 0)) || a.code.localeCompare(b.code); });
    openSheet(head(esc(c.name)) + '<small>เลือกรุ่นที่จะขาย ระบบจะดึงต้นทุนตามรุ่นที่เลือก</small>' + (L.map(function (p) {
      return '<button class="row" style="width:100%;text-align:left" data-a="sale" data-v="' + esc(p.code) + '"><div class="th">' + thumb(p) + '</div>' +
        '<div class="gr"><b>' + esc(p.code) + '</b> ' + esc(p.name) + '<br><small>ต้นทุน ฿' + fmt(p.current_cost) + ' · คงเหลือ ' + pq(p) + '</small></div>' +
        '<i class="dt" style="background:var(--' + p.status + ')"></i></button>';
    }).join('') || '<div class="empty">ยังไม่มีสินค้าในประเภทนี้</div>'));
  }
  var _oh = openHash;
  openHash = function () {
    var m = location.hash.match(/^#c=(.+)$/);
    if (m && S.ready) return catSheet(decodeURIComponent(m[1]));
    _oh();
  };
  A.catqr = function (id) {
    var c = S.cats.find(function (x) { return x.id === id; }); if (!c) return;
    var u = qrSafe(location.origin + location.pathname + '#c=' + id);
    openSheet(head('QR ประจำประเภท') + '<div class="qrb"><img src="' + u + '" alt="QR"><h3 style="margin-top:10px">' + esc(c.name) + '</h3>' +
      '<small>สแกนแล้วเลือกรุ่นที่ขายในประเภทนี้</small></div><div class="btns">' +
      '<button class="btn" data-a="catqrdl" data-v="' + id + '">' + ic('dl', 20) + ' ดาวน์โหลด</button>' +
      '<button class="btn o" data-a="catqrpr" data-v="' + id + '">' + ic('print', 20) + ' พิมพ์</button></div>');
  };
  A.catqrdl = function (id) {
    var c = S.cats.find(function (x) { return x.id === id; }), im = new Image();
    im.onload = function () {
      var w = im.width, cv = document.createElement('canvas'); cv.width = w; cv.height = w + 70;
      var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, w + 70); x.drawImage(im, 0, 0);
      x.fillStyle = '#000'; x.textAlign = 'center'; x.font = 'bold 34px sans-serif'; x.fillText(c.name.slice(0, 20), w / 2, w + 46);
      cv.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'QR-' + c.prefix + '.png'; a.click(); });
    };
    im.src = qrSafe(location.origin + location.pathname + '#c=' + id);
  };
  A.catqrpr = function (id) {
    var c = S.cats.find(function (x) { return x.id === id; });
    $('pa').innerHTML = '<img src="' + qrSafe(location.origin + location.pathname + '#c=' + id) + '" style="width:55mm"><div><b>' + esc(c.name) + '</b></div>';
    setTimeout(function () { window.print(); }, 200);
  };

  /* ---------- หน้าที่เพิ่มใหม่ ---------- */
  var PAGES = {};
  var _r = render;
  render = function () {
    _r();
    if (S.ready && PAGES[S.cur]) {
      $('sw').style.display = 'none';
      PAGES[S.cur]();
    }
  };

  /* ===== บัญชี + ปิดยอดประจำวัน ===== */
  var AC = { date: null, kind: 'other', cur: null };
  PAGES.acc = async function () {
    if (!AC.date) AC.date = today();
    var d = AC.date, td = today();
    $('view').innerHTML = '<h2>บัญชี</h2><div class="ovn"><button data-a="acprev" aria-label="วันก่อน">‹</button><b>' +
      (d === td ? 'วันนี้ · ' : '') + fd(d) + '</b><button data-a="acnext" aria-label="วันถัดไป">›</button></div>' +
      '<div id="accb"><div class="empty">กำลังโหลด...</div></div>';
    try {
      var r = await Promise.all([
        salesBetween(d, addD(d, 1)),
        S.sb.from('expenses').select('id,kind,amount,note').is('voided_at', null).eq('paid_on', d).order('created_at', { ascending: false }),
        S.sb.from('incomes').select('id,amount,note').is('voided_at', null).eq('received_on', d).order('created_at', { ascending: false }),
        S.sb.from('daily_closes').select('*').eq('close_date', d).maybeSingle(),
        S.sb.from('daily_closes').select('close_date,expected_cash,counted_cash,diff').order('close_date', { ascending: false }).limit(7)
      ]);
      for (var i = 1; i < r.length; i++) if (r[i].error) throw r[i].error;
      if (!still('acc') || !$('accb')) return;
      var by = { cash: 0, card: 0, transfer: 0, other: 0 }, rev = 0, cogs = 0, n = 0;
      r[0].forEach(function (x) {
        var v = x.unit_price * x.qty; rev += v; cogs += x.unit_cost * x.qty; n += x.qty;
        by[PMN[x.payment_method] ? x.payment_method : 'other'] += v;
      });
      var exs = r[1].data, ics = r[2].data, cl = r[3].data;
      var ex = sum(exs, 'amount'), inc = sum(ics, 'amount'), gross = rev - cogs, net = gross - ex + inc;
      AC.cur = { d: d, rev: rev, cogs: cogs, by: by, ex: ex, inc: inc, gross: gross, net: net, id: cl ? cl.id : null };
      var rowsH = function (list, tbl) {
        return list.length ? list.map(function (x) {
          return '<div class="row"><div class="gr"><b>' + (tbl === 'expenses' ? (EXK[x.kind] || 'อื่น ๆ') : 'รายรับอื่น') + ' ฿' + fmt(x.amount) + '</b>' +
            (x.note ? '<br><small>' + esc(x.note) + '</small>' : '') + '</div><button class="dsm" data-a="accvoid" data-v="' + tbl + '|' + x.id + '">ยกเลิก</button></div>';
        }).join('') : '<small>ไม่มีรายการ</small>';
      };
      $('accb').innerHTML =
        '<div class="grid">' + cardH('ยอดขาย (' + fmt(n) + ' ชิ้น)', '฿' + fmt(rev)) + cardH('ต้นทุนสินค้าที่ขาย', '฿' + fmt(cogs)) +
        cardH('กำไรขั้นต้น', '฿' + fmt(gross)) + cardH('รายจ่าย', '฿' + fmt(ex)) + '</div>' +
        '<div class="card"><small>กำไรหลังหักรายจ่าย' + (inc ? ' (รวมรายรับอื่น ฿' + fmt(inc) + ')' : '') + '</small><b class="v ' + (net >= 0 ? 'ovp' : 'ovm') + '">฿' + SG(net) + '</b></div>' +
        '<div class="card"><h3>แยกตามวิธีชำระเงิน</h3>' + Object.keys(PMN).map(function (k) { return kv(PMN[k], '฿' + fmt(by[k])); }).join('') + '</div>' +
        '<div class="card"><h3>ปิดยอดประจำวัน</h3>' +
        '<label>เงินทอนตั้งต้นในลิ้นชัก (บาท)<input id="acf" type="number" inputmode="decimal" min="0" value="' + (cl ? cl.opening_cash : 0) + '"></label>' +
        '<div class="kv" style="border-top:0"><span>เงินสดที่ควรมี</span><b id="acx">-</b></div>' +
        '<label>เงินสดที่นับได้จริง (บาท)<input id="acc" type="number" inputmode="decimal" min="0" value="' + (cl ? cl.counted_cash : '') + '"></label>' +
        '<div class="kv"><span>ผลต่าง</span><b id="acd">-</b></div>' +
        '<small>เงินสดที่ควรมี = เงินทอนตั้งต้น + ยอดขายเงินสด + รายรับอื่น − รายจ่ายของวัน (ระบบนับรายจ่ายและรายรับอื่นเป็นเงินสด)</small>' +
        '<div class="err" id="acer"></div><button class="btn" data-a="acclose">' + (cl ? 'บันทึกปิดยอดใหม่ (ทับของเดิม)' : 'บันทึกปิดยอด') + '</button></div>' +
        '<div class="btns"><button class="btn o" data-a="accexp">+ รายจ่าย</button><button class="btn o" data-a="accinc">+ รายรับอื่น</button></div>' +
        '<div class="card" style="margin-top:12px"><h3>รายจ่ายวันนี้</h3>' + rowsH(exs, 'expenses') + '</div>' +
        '<div class="card"><h3>รายรับอื่น</h3>' + rowsH(ics, 'incomes') + '</div>' +
        '<div class="card"><h3>ปิดยอดล่าสุด</h3>' + (r[4].data.length ? r[4].data.map(function (x) {
          return '<div class="kv"><span>' + fd(x.close_date) + '</span><span>ควรมี ฿' + fmt(x.expected_cash) + ' · จริง ฿' + fmt(x.counted_cash) +
            ' · <b class="' + (x.diff < 0 ? 'ovm' : x.diff > 0 ? 'ovp' : '') + '">' + SG(Number(x.diff)) + '</b></span></div>';
        }).join('') : '<small>ยังไม่เคยปิดยอด</small>') + '</div>' +
        '<button class="btn o" data-a="go" data-v="dash">ดูสรุปรายสัปดาห์/เดือน/ปี (Dashboard)</button>';
      var upd = function () {
        var f = parseFloat($('acf').value) || 0, e = f + by.cash + inc - ex, cs = $('acc').value;
        $('acx').textContent = '฿' + fmt(e);
        if (cs === '') { $('acd').textContent = '-'; return; }
        var df = (parseFloat(cs) || 0) - e;
        $('acd').innerHTML = '<span class="' + (df < 0 ? 'ovm' : df > 0 ? 'ovp' : '') + '">' + SG(df) + ' (' + (df === 0 ? 'พอดี' : df < 0 ? 'เงินขาด' : 'เงินเกิน') + ')</span>';
      };
      $('acf').oninput = upd; $('acc').oninput = upd; upd();
    } catch (e) {
      if ($('accb')) $('accb').innerHTML = '<div class="card empty">โหลดไม่สำเร็จ: ' + esc(errMsg(e)) + '</div>';
    }
  };
  A.acprev = function () { AC.date = addD(AC.date, -1); PAGES.acc(); };
  A.acnext = function () { if (AC.date >= today()) return toast('ไม่สามารถดูวันในอนาคต'); AC.date = addD(AC.date, 1); PAGES.acc(); };
  var accBusy = false;
  A.acclose = async function () {
    if (accBusy || !AC.cur) return;
    var c = AC.cur, cs = $('acc').value, er = function (m) { $('acer').textContent = m; };
    if (cs === '' || isNaN(parseFloat(cs)) || parseFloat(cs) < 0) return er('กรอกเงินสดที่นับได้จริง');
    var f = parseFloat($('acf').value) || 0, cnt = parseFloat(cs), exp = f + c.by.cash + c.inc - c.ex;
    var df = cnt - exp;
    if (!confirm('ปิดยอดวันที่ ' + fd(c.d) + '\nเงินสดที่ควรมี ฿' + fmt(exp) + '\nนับได้จริง ฿' + fmt(cnt) + '\nผลต่าง ' + SG(df) + ' บาท\nยืนยัน?')) return;
    var row = { close_date: c.d, sales_total: c.rev, cash_total: c.by.cash, card_total: c.by.card, transfer_total: c.by.transfer, other_total: c.by.other,
      cogs: c.cogs, expenses_total: c.ex, other_income: c.inc, opening_cash: f, expected_cash: exp, counted_cash: cnt, diff: df,
      gross_profit: c.gross, net_profit: c.net, updated_at: new Date().toISOString() };
    accBusy = true;
    var r = c.id ? await S.sb.from('daily_closes').update(row).eq('id', c.id) : await S.sb.from('daily_closes').insert(row);
    accBusy = false;
    if (r.error) return er('บันทึกไม่สำเร็จ: ' + errMsg(r.error));
    toast('บันทึกปิดยอดแล้ว'); PAGES.acc();
  };
  function accSheet(tbl) {
    AC.kind = 'other';
    var isEx = tbl === 'expenses';
    openSheet(head(isEx ? 'บันทึกรายจ่าย' : 'บันทึกรายรับอื่น') +
      (isEx ? '<div class="lb">ประเภทรายจ่าย</div><div class="mth ek">' + Object.keys(EXK).map(function (k) {
        return '<button type="button" class="chip ' + (k === AC.kind ? 'on' : '') + '" data-a="acekind" data-v="' + k + '">' + EXK[k] + '</button>';
      }).join('') + '</div>' : '') +
      '<label>จำนวนเงิน (บาท)<input id="aca" type="number" inputmode="decimal" min="0"></label>' +
      '<label>วันที่<input id="acdt" type="date" value="' + AC.date + '"></label>' +
      '<label>รายละเอียด (ไม่บังคับ)<input id="acn"></label>' +
      '<div class="err" id="acer2"></div><button class="btn" id="acgo" data-a="accsave" data-v="' + tbl + '">บันทึก</button>');
  }
  A.accexp = function () { accSheet('expenses'); };
  A.accinc = function () { accSheet('incomes'); };
  A.acekind = function (v) {
    AC.kind = v;
    document.querySelectorAll('.ek .chip').forEach(function (c) { c.classList.toggle('on', c.dataset.v === v); });
  };
  A.accsave = async function (tbl) {
    if (accBusy) return;
    var a = parseFloat($('aca').value), d = $('acdt').value, er = function (m) { $('acer2').textContent = m; };
    if (!(a > 0)) return er('ใส่จำนวนเงินมากกว่า 0');
    if (!d) return er('เลือกวันที่');
    var n = $('acn').value.trim() || null;
    accBusy = true; $('acgo').disabled = true;
    var row = tbl === 'expenses' ? { kind: AC.kind, amount: a, paid_on: d, note: n } : { amount: a, received_on: d, note: n };
    var r = await S.sb.from(tbl).insert(row);
    accBusy = false;
    if (r.error) { $('acgo').disabled = false; return er('บันทึกไม่สำเร็จ: ' + errMsg(r.error)); }
    AC.date = d; closeSheet(); toast('บันทึกแล้ว');
    if (S.cur === 'acc') PAGES.acc();
  };
  A.accvoid = async function (v) {
    if (accBusy) return;
    var a = v.split('|');
    if (!confirm('ยกเลิกรายการนี้?\nระบบเก็บประวัติไว้ แต่ไม่นับในยอดรวม')) return;
    accBusy = true;
    var r = await S.sb.from(a[0]).update({ voided_at: new Date().toISOString() }).eq('id', a[1]).is('voided_at', null);
    accBusy = false;
    if (r.error) return toast('ยกเลิกไม่สำเร็จ: ' + errMsg(r.error));
    toast('ยกเลิกรายการแล้ว'); PAGES.acc();
  };

  /* ===== รายงาน ===== */
  var RP = { tab: 'month', off: 0, cache: null };
  function rng() {
    var a = today().split('-').map(Number), U = function (y, m, d) { return new Date(Date.UTC(y, m, d)); };
    var iso = function (d) { return d.toISOString().slice(0, 10); }, T = U(a[0], a[1] - 1, a[2]), s, e, label;
    if (RP.tab === 'day') { s = U(a[0], a[1] - 1, a[2] + RP.off); e = U(a[0], a[1] - 1, a[2] + RP.off + 1); label = fd(iso(s)); }
    else if (RP.tab === 'week') {
      var dow = (T.getUTCDay() + 6) % 7;
      s = U(a[0], a[1] - 1, a[2] - dow + RP.off * 7); e = U(a[0], a[1] - 1, a[2] - dow + RP.off * 7 + 7);
      label = fd(iso(s)) + ' - ' + fd(addD(iso(e), -1));
    } else if (RP.tab === 'month') {
      s = U(a[0], a[1] - 1 + RP.off, 1); e = U(a[0], a[1] + RP.off, 1);
      label = s.toLocaleDateString('th-TH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    } else {
      s = U(a[0] + RP.off, 0, 1); e = U(a[0] + RP.off + 1, 0, 1);
      label = 'ปี ' + s.toLocaleDateString('th-TH', { year: 'numeric', timeZone: 'UTC' });
    }
    return { a: iso(s), b: iso(e), label: label };
  }
  PAGES.rep = async function () {
    var r = rng(), tabs = [['day', 'วัน'], ['week', 'สัปดาห์'], ['month', 'เดือน'], ['year', 'ปี']];
    $('view').innerHTML = '<h2>รายงาน</h2><div class="seg">' + tabs.map(function (x) {
      return '<button data-a="reptab" data-v="' + x[0] + '" class="' + (RP.tab === x[0] ? 'on' : '') + '">' + x[1] + '</button>';
    }).join('') + '</div><div class="ovn"><button data-a="repprev" aria-label="ก่อนหน้า">‹</button><b>' + r.label + '</b><button data-a="repnext" aria-label="ถัดไป">›</button></div><div id="repb"><div class="empty">กำลังโหลด...</div></div>';
    try {
      var res = await Promise.all([salesBetween(r.a, r.b), expBetween(r.a, r.b), salesBetween(addD(today(), -60), addD(today(), 1))]);
      if (!still('rep') || !$('repb')) return;
      var sales = res[0], exs = res[1], by = { cash: 0, card: 0, transfer: 0, other: 0 }, rev = 0, cogs = 0, n = 0, cat = {}, prod = {};
      var pm = {}; S.prods.forEach(function (p) { pm[p.id] = p; });
      sales.forEach(function (x) {
        var v = x.unit_price * x.qty, g = (x.unit_price - x.unit_cost) * x.qty, p = pm[x.product_id];
        rev += v; cogs += x.unit_cost * x.qty; n += x.qty; by[PMN[x.payment_method] ? x.payment_method : 'other'] += v;
        var cn = p && p.categories ? p.categories.name : 'ไม่ระบุ';
        var c = cat[cn] || (cat[cn] = { qty: 0, rev: 0, gross: 0 }); c.qty += x.qty; c.rev += v; c.gross += g;
        var k = x.product_id, o = prod[k] || (prod[k] = { qty: 0, rev: 0, gross: 0 }); o.qty += x.qty; o.rev += v; o.gross += g;
      });
      var ex = sum(exs, 'amount'), gross = rev - cogs, net = gross - ex;
      var top = Object.keys(prod).sort(function (a, b) { return prod[b].qty - prod[a].qty; }).slice(0, 10);
      var sold60 = {}; res[2].forEach(function (x) { sold60[x.product_id] = 1; });
      var low = S.prods.filter(function (p) { return p.status !== 'black' && pq(p) <= 3; });
      var dead = S.prods.filter(function (p) { return pq(p) > 0 && p.status !== 'red' && p.status !== 'black' && !sold60[p.id]; });
      var bad = S.prods.filter(function (p) { return p.status === 'red'; });
      var list = function (arr, f) { return arr.length ? arr.slice(0, 15).map(f).join('') : '<small>ไม่มี</small>'; };
      var line = function (p, t) { return '<button class="row" style="width:100%;text-align:left;padding:6px 0" data-a="open" data-v="' + esc(p.code) + '"><div class="gr"><b>' + esc(p.code) + '</b> ' + esc(p.name) + '<br><small>' + t + '</small></div></button>'; };
      RP.cache = { r: r, sales: sales };
      $('repb').innerHTML =
        '<div class="grid">' + cardH('ยอดขาย (' + fmt(n) + ' ชิ้น)', '฿' + fmt(rev)) + cardH('กำไรขั้นต้น', '฿' + fmt(gross)) +
        cardH('รายจ่าย', '฿' + fmt(ex)) + cardH('กำไรหลังหักรายจ่าย', '<span class="' + (net >= 0 ? 'ovp' : 'ovm') + '">฿' + SG(net) + '</span>') + '</div>' +
        '<details class="tri" open><summary>แยกตามวิธีชำระเงิน</summary>' + Object.keys(PMN).map(function (k) { return kv(PMN[k], '฿' + fmt(by[k])); }).join('') + '</details>' +
        '<details class="tri" open><summary>แยกตามประเภทสินค้า</summary>' + (Object.keys(cat).map(function (k) {
          return '<div class="kv"><span>' + esc(k) + '<br><small>' + cat[k].qty + ' ชิ้น</small></span><span>฿' + fmt(cat[k].rev) + '<br><small>กำไร ' + SG(cat[k].gross) + '</small></span></div>';
        }).join('') || '<small>ไม่มีข้อมูลในช่วงนี้</small>') + '</details>' +
        '<details class="tri"><summary>สินค้าขายดี (แยกรุ่น)</summary>' + (top.map(function (k, i) {
          var p = pm[k]; return '<div class="kv"><span>' + (i + 1) + '. ' + esc(p ? p.code + ' ' + p.name : 'สินค้า') + '<br><small>' + prod[k].qty + ' ชิ้น</small></span><span>฿' + fmt(prod[k].rev) + '<br><small>กำไร ' + SG(prod[k].gross) + '</small></span></div>';
        }).join('') || '<small>ไม่มีข้อมูลในช่วงนี้</small>') + '</details>' +
        '<details class="tri"><summary>สินค้าใกล้หมด (≤ 3 ชิ้น) <small>' + low.length + '</small></summary>' + list(low, function (p) { return line(p, 'เหลือ ' + pq(p) + ' ชิ้น'); }) + '</details>' +
        '<details class="tri"><summary>สินค้าค้างสต๊อก (ไม่ขายใน 60 วัน) <small>' + dead.length + '</small></summary>' + list(dead, function (p) { return line(p, 'เหลือ ' + pq(p) + ' ชิ้น'); }) + '</details>' +
        '<details class="tri"><summary>สินค้าเสีย <small>' + bad.length + '</small></summary>' + list(bad, function (p) { return line(p, 'เหลือ ' + pq(p) + ' ชิ้น'); }) + '</details>' +
        '<button class="btn o" data-a="repcsv">' + ic('dl', 20) + ' ส่งออกยอดขายช่วงนี้ (CSV)</button>';
    } catch (e) { if ($('repb')) $('repb').innerHTML = '<div class="card empty">โหลดไม่สำเร็จ: ' + esc(errMsg(e)) + '</div>'; }
  };
  A.reptab = function (v) { RP.tab = v; RP.off = 0; PAGES.rep(); };
  A.repprev = function () { RP.off--; PAGES.rep(); };
  A.repnext = function () { RP.off++; PAGES.rep(); };
  A.repcsv = function () {
    if (!RP.cache) return;
    var pm = {}; S.prods.forEach(function (p) { pm[p.id] = p; });
    var rows = [['วันเวลา', 'รหัส', 'ชื่อสินค้า', 'จำนวน', 'ราคาขาย', 'ต้นทุน', 'รายรับ', 'กำไรขั้นต้น', 'วิธีชำระ']];
    RP.cache.sales.forEach(function (x) {
      var p = pm[x.product_id] || {};
      rows.push([new Date(x.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }), p.code, p.name, x.qty, x.unit_price, x.unit_cost,
        x.unit_price * x.qty, (x.unit_price - x.unit_cost) * x.qty, PMN[x.payment_method] || x.payment_method]);
    });
    download('sales-' + RP.cache.r.a + '.csv', csv(rows));
  };

  /* ===== ภาษี (ขั้นตอนทีละหน้า ตามรูปที่ 1) ===== */
  var BR = [[150000, 0], [150000, 0.05], [200000, 0.10], [250000, 0.15], [250000, 0.20], [1000000, 0.25], [3000000, 0.30], [Infinity, 0.35]];
  function taxOf(net) {
    var left = net, tax = 0, rows = [], from = 0;
    for (var i = 0; i < BR.length && left > 0; i++) {
      var w = Math.min(left, BR[i][0]), t = w * BR[i][1];
      rows.push({ from: from, to: from + w, rate: BR[i][1], tax: t }); tax += t; left -= w; from += w;
    }
    return { tax: tax, rows: rows };
  }
  function calc(v) {
    var n = function (k) { return Math.max(0, Number(v[k]) || 0); };
    var sal = n('salary'), salEx = Math.min(sal * 0.5, 100000);
    var shop = n('shop_inc'), shopEx = v.shop_m === 'flat' ? shop * Math.min(100, Math.max(0, v.shop_pct === undefined || v.shop_pct === '' ? 60 : Number(v.shop_pct) || 0)) / 100 : n('shop_exp');
    var rent = n('rent_inc'), rentEx = v.rent_m === 'flat' ? rent * 0.3 : n('rent_exp');
    var oth = n('other_inc'), assess = sal + shop + rent + oth;
    var inc = Math.max(0, sal - salEx) + Math.max(0, shop - shopEx) + Math.max(0, rent - rentEx) + oth;
    var D = [];
    var add = function (name, amt) { if (amt > 0) D.push([name, amt]); };
    add('ค่าลดหย่อนส่วนตัว', 60000);
    add('คู่สมรส (ไม่มีเงินได้)', v.spouse ? 60000 : 0);
    add('บุตร', Math.floor(n('child')) * 30000);
    add('บุตรคนที่ 2 ขึ้นไป (เกิดตั้งแต่ 2561) เพิ่มอีก', Math.floor(n('child2')) * 30000);
    add('บิดามารดา', Math.min(4, Math.floor(n('parent'))) * 30000);
    add('ดูแลผู้พิการ', Math.floor(n('disab')) * 60000);
    add('ฝากครรภ์/คลอดบุตร', Math.min(60000, n('preg')));
    add('ประกันสังคม', Math.min(9000, n('sso')));
    add('ดอกเบี้ยเงินกู้ที่อยู่อาศัย', Math.min(100000, n('home')));
    var life = Math.min(100000, n('life')), health = Math.min(25000, n('health'));
    add('เบี้ยประกันชีวิต + สุขภาพ (รวมไม่เกิน 100,000)', Math.min(100000, life + health));
    add('ประกันสุขภาพบิดามารดา', Math.min(15000, n('phealth')));
    var ret = Math.min(n('annuity'), 0.15 * assess, 200000) + Math.min(n('pvd'), 0.15 * sal, 500000) +
      Math.min(n('rmf'), 0.30 * assess, 500000) + Math.min(n('nsf'), 30000);
    add('กลุ่มเกษียณ: ประกันบำนาญ + PVD + RMF + กอช. (รวมไม่เกิน 500,000)', Math.min(500000, ret));
    add('SSF', Math.min(n('ssf'), 0.30 * assess, 200000));
    add('Thai ESG', Math.min(n('esg'), 0.30 * assess, 300000));
    var before = D.reduce(function (a, x) { return a + x[1]; }, 0);
    var cap = 0.10 * Math.max(0, inc - before);
    add('เงินบริจาค (ไม่เกิน 10% ของเงินได้หลังลดหย่อน)', Math.min(n('don') + n('donedu') * 2, cap));
    add('บริจาคพรรคการเมือง', Math.min(10000, n('party')));
    var ded = D.reduce(function (a, x) { return a + x[1]; }, 0), net = Math.max(0, inc - ded), t = taxOf(net);
    return { assess: assess, exp: salEx + shopEx + rentEx, inc: inc, D: D, ded: ded, net: net, tax: t.tax, rows: t.rows, wht: n('wht'),
      pay: t.tax - n('wht'), eff: assess > 0 ? t.tax / assess * 100 : 0, minTax: (sal * 0 + shop + rent + oth) > 1000000 ? (shop + rent + oth) * 0.005 : 0 };
  }
  window.SmartShopTax = { calc: calc, taxOf: taxOf };

  var TX = { step: 1, year: new Date().getFullYear(), v: { shop_m: 'actual', rent_m: 'actual', shop_pct: 60 } };
  var TT = ['รายได้', 'ลดหย่อนครอบครัว', 'กองทุนสำรองเลี้ยงชีพ เงินประกันสังคม และที่อยู่อาศัย', 'ประกัน', 'กองทุนอื่น ๆ', 'คำนวณภาษี'];
  function fld(k, label, hint) {
    return '<div><label>' + label + '<input data-k="' + k + '" inputmode="decimal" placeholder="ระบุจำนวนเงิน" value="' + (TX.v[k] == null ? '' : esc(TX.v[k])) + '"></label>' +
      '<div class="txh">' + (hint || '&nbsp;') + '</div></div>';
  }
  function mchips(key, a, b) {
    return '<div class="chips" style="flex-wrap:wrap">' + [a, b].map(function (o) {
      return '<button class="chip ' + (TX.v[key] === o[0] ? 'on' : '') + '" data-a="txm" data-v="' + key + '|' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function taxBody() {
    var s = TX.step, h = '';
    if (s === 1) {
      h = '<h3>รายได้ประจำปี ' + (TX.year + 543) + '</h3><div class="chips"><button class="chip ' + (TX.year === new Date().getFullYear() ? 'on' : '') + '" data-a="txyear" data-v="' + new Date().getFullYear() + '">ปีนี้</button>' +
        '<button class="chip ' + (TX.year === new Date().getFullYear() - 1 ? 'on' : '') + '" data-a="txyear" data-v="' + (new Date().getFullYear() - 1) + '">ปีที่แล้ว</button></div>' +
        '<button class="btn o" data-a="txpull" style="margin:0 0 14px">' + ic('dl', 18) + ' ดึงรายได้/ต้นทุนจากร้านและค่าเช่าในระบบ</button><div class="txg">' +
        fld('salary', 'เงินเดือน/ค่าจ้างทั้งปี (ถ้ามี)', 'หักค่าใช้จ่าย 50% ไม่เกิน 100,000 บาท') +
        fld('other_inc', 'เงินได้อื่น ๆ', 'ถ้ามี') + fld('wht', 'ภาษีที่ถูกหัก ณ ที่จ่าย/จ่ายล่วงหน้าแล้ว', 'ถ้ามี') + '</div>' +
        '<div class="h3">รายได้จากร้านค้า</div><div class="txg">' + fld('shop_inc', 'ยอดขายรวมทั้งปี', 'ดึงจากระบบได้') + '</div>' +
        mchips('shop_m', ['actual', 'ใช้ค่าใช้จ่ายจริง'], ['flat', 'หักแบบเหมา %']) + '<div class="txg" style="margin-top:10px">' +
        (TX.v.shop_m === 'flat' ? fld('shop_pct', 'หักเหมา (%)', 'อัตราขึ้นกับประเภทธุรกิจ ตรวจสอบกับสรรพากร') : fld('shop_exp', 'ต้นทุนสินค้า + รายจ่ายทั้งปี', 'ดึงจากระบบได้')) + '</div>' +
        '<div class="h3">รายได้ค่าเช่า</div><div class="txg">' + fld('rent_inc', 'ค่าเช่าที่รับจริงทั้งปี', 'ดึงจากระบบได้') + '</div>' +
        mchips('rent_m', ['actual', 'ใช้ค่าใช้จ่ายจริง'], ['flat', 'หักเหมา 30%']) +
        (TX.v.rent_m === 'flat' ? '' : '<div class="txg" style="margin-top:10px">' + fld('rent_exp', 'ค่าซ่อมบำรุง/ค่าใช้จ่ายค่าเช่า', 'ดึงจากระบบได้') + '</div>');
    } else if (s === 2) {
      h = '<h3>รายการลดหย่อนภาษี : ครอบครัว</h3><div class="note" style="margin-bottom:12px">ค่าลดหย่อนส่วนตัว 60,000 บาท ใส่ให้อัตโนมัติ</div>' +
        '<div class="chips"><button class="chip ' + (TX.v.spouse ? 'on' : '') + '" data-a="txtog" data-v="spouse">คู่สมรสไม่มีเงินได้ (60,000)</button></div><div class="txg">' +
        fld('child', 'จำนวนบุตร (คนละ 30,000)', 'ใส่เป็นจำนวนคน') + fld('child2', 'บุตรคนที่ 2 ขึ้นไปที่เกิดตั้งแต่ปี 2561 (เพิ่มคนละ 30,000)', 'ใส่เป็นจำนวนคน') +
        fld('parent', 'บิดามารดาที่เลี้ยงดู (คนละ 30,000)', 'ไม่เกิน 4 คน') + fld('disab', 'ดูแลผู้พิการ (คนละ 60,000)', 'ใส่เป็นจำนวนคน') +
        fld('preg', 'ฝากครรภ์และคลอดบุตร', 'ไม่เกิน 60,000') + '</div>';
    } else if (s === 3) {
      h = '<h3>รายการลดหย่อนภาษี : กองทุนสำรองเลี้ยงชีพ เงินประกันสังคม และที่อยู่อาศัย</h3><div class="txg">' +
        fld('sso', 'เงินประกันสังคม', 'ไม่เกิน 9,000 บาท') + fld('pvd', 'กองทุนสำรองเลี้ยงชีพ (PVD)', 'ไม่เกิน 15% ของค่าจ้าง ไม่เกิน 500,000') +
        fld('home', 'ดอกเบี้ยเงินกู้ที่อยู่อาศัย', 'ไม่เกิน 100,000 บาท') + '</div>';
    } else if (s === 4) {
      h = '<h3>รายการลดหย่อนภาษี : ประกัน</h3><div class="txg">' +
        fld('life', 'เบี้ยประกันชีวิต', 'ไม่เกิน 100,000 บาท') + fld('health', 'เบี้ยประกันสุขภาพ', 'ไม่เกิน 25,000') +
        '</div><div class="note" style="margin-bottom:12px">เบี้ยประกันชีวิตและประกันสุขภาพรวมกันต้องไม่เกิน 100,000 บาท</div><div class="txg">' +
        fld('phealth', 'เบี้ยประกันสุขภาพบิดามารดา', 'ไม่เกิน 15,000') +
        fld('annuity', 'เบี้ยประกันชีวิตบำนาญ', 'ไม่เกิน 15% ของรายได้ ไม่เกิน 200,000 บาท รวมกับกองทุนอื่นไม่เกิน 500,000') + '</div>';
    } else if (s === 5) {
      h = '<h3>รายการลดหย่อนภาษี : กองทุนอื่น ๆ และเงินบริจาค</h3><div class="txg">' +
        fld('rmf', 'กองทุน RMF', 'ไม่เกิน 30% ของรายได้ ไม่เกิน 500,000') + fld('ssf', 'กองทุน SSF', 'ไม่เกิน 30% ของรายได้ ไม่เกิน 200,000') +
        fld('esg', 'กองทุน Thai ESG', 'ไม่เกิน 30% ของรายได้ ไม่เกิน 300,000') + fld('nsf', 'กองทุนการออมแห่งชาติ (กอช.)', 'ไม่เกิน 30,000') +
        fld('don', 'เงินบริจาคทั่วไป', 'ไม่เกิน 10% ของเงินได้หลังลดหย่อน') + fld('donedu', 'บริจาคเพื่อการศึกษา/กีฬา/โรงพยาบาลรัฐ (นับ 2 เท่า)', 'รวมกับบริจาคทั่วไปไม่เกิน 10%') +
        fld('party', 'บริจาคพรรคการเมือง', 'ไม่เกิน 10,000') + '</div>';
    } else {
      var c = calc(TX.v);
      h = '<h3>สรุปการคำนวณภาษี ปี ' + (TX.year + 543) + '</h3><div class="card" style="text-align:center"><small>ภาษีที่ต้องเสีย (ประมาณการ)</small><div class="txbig">฿' + N0(c.tax) + '</div>' +
        '<small>' + (c.pay >= 0 ? 'ชำระเพิ่มประมาณ ฿' + N0(c.pay) : 'ขอคืนประมาณ ฿' + N0(-c.pay)) + ' หลังหักภาษีที่จ่ายแล้ว ฿' + N0(c.wht) + '</small></div>' +
        kv('เงินได้พึงประเมินรวม', '฿' + N0(c.assess)) + kv('หักค่าใช้จ่าย', '฿' + N0(c.exp)) + kv('เงินได้หลังหักค่าใช้จ่าย', '฿' + N0(c.inc)) +
        kv('ค่าลดหย่อนรวม', '฿' + N0(c.ded)) + kv('เงินได้สุทธิ', '฿' + N0(c.net)) + kv('อัตราภาษีเฉลี่ยจากเงินได้รวม', c.eff.toFixed(2) + '%') +
        '<details class="tri"><summary>ตารางภาษีขั้นบันได</summary>' + (c.rows.map(function (r) {
          return '<div class="kv"><span>' + N0(r.from) + ' - ' + N0(r.to) + ' (' + Math.round(r.rate * 100) + '%)</span><span>฿' + N0(r.tax) + '</span></div>';
        }).join('') || '<small>เงินได้สุทธิไม่เกินเกณฑ์ที่ได้รับยกเว้น</small>') + '</details>' +
        '<details class="tri"><summary>รายการลดหย่อนที่ใช้</summary>' + c.D.map(function (d) { return '<div class="kv"><span>' + d[0] + '</span><span>฿' + N0(d[1]) + '</span></div>'; }).join('') + '</details>' +
        (c.minTax ? '<div class="note" style="margin-bottom:10px">รายได้ตามมาตรา 40(2)-(8) เกิน 1,000,000 บาท: ควรเทียบกับภาษีขั้นต่ำ 0.5% ของรายได้ (ประมาณ ฿' + N0(c.minTax) + ') แล้วชำระตามจำนวนที่สูงกว่า โปรดตรวจสอบกับสรรพากร</div>' : '') +
        '<div class="note" style="color:var(--red)">นี่เป็นเพียงการประมาณการเพื่อเตรียมข้อมูล ไม่ใช่การยื่นภาษีจริง เกณฑ์ภาษีอาจเปลี่ยนแปลง กรุณาตรวจสอบกับกรมสรรพากรหรือผู้เชี่ยวชาญก่อนยื่นจริง</div>' +
        '<button class="btn o" data-a="txcsv">' + ic('dl', 20) + ' ส่งออกสรุปภาษี (CSV)</button><button class="btn o" data-a="txreset">เริ่มกรอกใหม่</button>';
    }
    return h;
  }
  PAGES.tax = function () {
    var st = '<div class="txs">' + TT.map(function (t, i) {
      var k = i + 1 < TX.step ? 'done' : i + 1 === TX.step ? 'cur' : '';
      return '<div class="txd ' + k + '"><i>' + (k === 'done' ? ic('check', 14) : i + 1) + '</i></div>';
    }).join('') + '</div><div style="text-align:center;font-weight:700;margin-bottom:12px">' + TT[TX.step - 1] + '</div>';
    $('view').innerHTML = '<h2>ช่วยคำนวณภาษีเงินได้บุคคลธรรมดา</h2>' + st + '<div class="card">' + taxBody() + '</div>' +
      '<div class="txb">' + (TX.step > 1 ? '<button class="btn o" style="margin:0" data-a="txprev">ย้อนกลับ</button>' : '<span></span>') +
      (TX.step < 6 ? '<button class="btn" style="margin:0" data-a="txnext">ถัดไป</button>' : '') + '</div>' +
      '<div class="note" style="margin-top:12px">ข้อมูลที่กรอกอยู่ในเครื่องนี้เท่านั้น ไม่ถูกบันทึกลงฐานข้อมูล</div>';
  };
  document.addEventListener('input', function (e) {
    var k = e.target && e.target.dataset && e.target.dataset.k;
    if (k && S.cur === 'tax') TX.v[k] = e.target.value;
  });
  A.txnext = function () { TX.step = Math.min(6, TX.step + 1); PAGES.tax(); window.scrollTo(0, 0); };
  A.txprev = function () { TX.step = Math.max(1, TX.step - 1); PAGES.tax(); window.scrollTo(0, 0); };
  A.txtog = function (k) { TX.v[k] = !TX.v[k]; PAGES.tax(); };
  A.txm = function (v) { var a = v.split('|'); TX.v[a[0]] = a[1]; PAGES.tax(); };
  A.txyear = function (v) { TX.year = +v; PAGES.tax(); };
  A.txreset = function () { if (!confirm('ล้างข้อมูลที่กรอกทั้งหมด?')) return; TX = { step: 1, year: TX.year, v: { shop_m: 'actual', rent_m: 'actual', shop_pct: 60 } }; PAGES.tax(); };
  A.txpull = async function () {
    var y = TX.year, a = y + '-01-01', b = (y + 1) + '-01-01', msg = [];
    try {
      var sl = await salesBetween(a, b);
      var ex = await expBetween(a, b);
      TX.v.shop_inc = Math.round(sl.reduce(function (t, x) { return t + x.unit_price * x.qty; }, 0));
      TX.v.shop_exp = Math.round(sl.reduce(function (t, x) { return t + x.unit_cost * x.qty; }, 0) + sum(ex, 'amount'));
      msg.push('ดึงข้อมูลร้านค้าแล้ว');
    } catch (e) { msg.push('ดึงข้อมูลร้านค้าไม่ได้: ' + errMsg(e)); }
    try {
      var rp = await S.sb.from('rent_payments').select('amount').eq('cancelled', false).gte('paid_on', a).lt('paid_on', b).limit(5000);
      var uc = await S.sb.from('unit_costs').select('amount').gte('paid_on', a).lt('paid_on', b).limit(5000);
      if (rp.error || uc.error) throw (rp.error || uc.error);
      TX.v.rent_inc = Math.round(sum(rp.data, 'amount')); TX.v.rent_exp = Math.round(sum(uc.data, 'amount'));
      msg.push('ดึงข้อมูลค่าเช่าแล้ว');
    } catch (e) { msg.push('ดึงข้อมูลค่าเช่าไม่ได้'); }
    PAGES.tax(); toast(msg.join(' · '));
  };
  A.txcsv = function () {
    var c = calc(TX.v), rows = [['รายการ', 'จำนวนเงิน (บาท)'], ['ปีภาษี (พ.ศ.)', TX.year + 543], ['เงินได้พึงประเมินรวม', Math.round(c.assess)],
      ['หักค่าใช้จ่าย', Math.round(c.exp)], ['เงินได้หลังหักค่าใช้จ่าย', Math.round(c.inc)]];
    c.D.forEach(function (d) { rows.push(['ลดหย่อน: ' + d[0], Math.round(d[1])]); });
    rows.push(['ค่าลดหย่อนรวม', Math.round(c.ded)], ['เงินได้สุทธิ', Math.round(c.net)], ['ภาษีประมาณการ', Math.round(c.tax)],
      ['ภาษีที่จ่ายแล้ว', Math.round(c.wht)], ['ชำระเพิ่ม/(ขอคืน)', Math.round(c.pay)], ['หมายเหตุ', 'ประมาณการเท่านั้น ไม่ใช่การยื่นภาษีจริง']);
    download('tax-estimate-' + (TX.year + 543) + '.csv', csv(rows));
  };

  /* ===== ผู้ช่วยสรุปข้อมูล (ยังไม่ใช่ AI) ===== */
  var AIQ = [
    ['วันนี้ขายได้เท่าไหร่?', 'today'], ['วันนี้กำไรเท่าไหร่?', 'profit'], ['สินค้าไหนขายดีที่สุด?', 'best'],
    ['ควรเติมสินค้าอะไร?', 'refill'], ['สินค้าอะไรค้างสต๊อก?', 'dead'], ['มีรายจ่ายอะไรผิดปกติ?', 'expense']
  ];
  var aiLog = [];
  PAGES.ai = function () {
    $('view').innerHTML = '<h2>AI Assistant</h2><div class="note" style="margin-bottom:10px;color:var(--text)"><b>สถานะ: ยังไม่ได้เชื่อมต่อ AI จริง</b><br>' +
      'ตอนนี้เป็น "ผู้ช่วยสรุปข้อมูล" ที่คำนวณจากฐานข้อมูลจริงของร้านด้วยสูตรตายตัว ไม่สร้างตัวเลขเอง และไม่แก้ไขข้อมูลใด ๆ ' +
      'การต่อ AI จริงต้องใช้ API key เก็บบนเซิร์ฟเวอร์ (Supabase Edge Function) และมีค่าใช้จ่ายตามการใช้งาน จะทำเมื่อคุณอนุญาตเท่านั้น</div>' +
      '<div class="qs">' + AIQ.map(function (q) { return '<button class="chip" data-a="aiask" data-v="' + q[1] + '">' + q[0] + '</button>'; }).join('') + '</div><div id="ailog">' +
      aiLog.map(function (m) { return '<div class="bub ' + (m.q ? 'q' : '') + '">' + m.t + '</div>'; }).join('') + '</div>';
  };
  A.aiask = async function (k) {
    var q = AIQ.find(function (x) { return x[1] === k; }), t = today(), ans = '';
    aiLog.push({ q: 1, t: esc(q[0]) });
    try {
      var pm = {}; S.prods.forEach(function (p) { pm[p.id] = p; });
      var nm = function (id) { return pm[id] ? pm[id].code + ' ' + pm[id].name : 'สินค้า'; };
      if (k === 'today' || k === 'profit') {
        var s = await salesBetween(t, addD(t, 1)), rev = 0, cg = 0, n = 0;
        s.forEach(function (x) { rev += x.unit_price * x.qty; cg += x.unit_cost * x.qty; n += x.qty; });
        if (k === 'today') ans = s.length ? 'ข้อมูลวันที่ ' + fd(t) + ': ขายได้ ฿' + fmt(rev) + ' จำนวน ' + n + ' ชิ้น (' + s.length + ' รายการ)' : 'ข้อมูลวันที่ ' + fd(t) + ': ยังไม่มียอดขาย';
        else {
          var ex = sum(await expBetween(t, addD(t, 1)), 'amount');
          ans = 'ข้อมูลวันที่ ' + fd(t) + ':\nกำไรขั้นต้น ฿' + SG(rev - cg) + '\nรายจ่ายวันนี้ ฿' + fmt(ex) + '\nกำไรหลังหักรายจ่าย ฿' + SG(rev - cg - ex);
        }
      } else if (k === 'best' || k === 'refill' || k === 'dead') {
        var days = k === 'dead' ? 60 : 30, a = addD(t, -days), sl = await salesBetween(a, addD(t, 1)), by = {};
        sl.forEach(function (x) { var o = by[x.product_id] || (by[x.product_id] = { q: 0, r: 0 }); o.q += x.qty; o.r += x.unit_price * x.qty; });
        var rg = 'ช่วง ' + fd(a) + ' - ' + fd(t) + ' (' + days + ' วัน)';
        if (!sl.length && k !== 'dead') ans = rg + ': ยังไม่มีข้อมูลการขาย จึงสรุปไม่ได้';
        else if (k === 'best') ans = rg + ':\n' + Object.keys(by).sort(function (x, y) { return by[y].q - by[x].q; }).slice(0, 5).map(function (id, i) { return (i + 1) + '. ' + nm(id) + ' ขาย ' + by[id].q + ' ชิ้น ฿' + fmt(by[id].r); }).join('\n');
        else if (k === 'refill') {
          var L = S.prods.filter(function (p) { return p.status !== 'black' && pq(p) <= 3 && by[p.id]; });
          ans = rg + ':\n' + (L.length ? 'สินค้าที่ขายได้แต่เหลือน้อย (≤3 ชิ้น):\n' + L.map(function (p) { return '• ' + p.code + ' ' + p.name + ' เหลือ ' + pq(p) + ' ชิ้น (ขายไป ' + by[p.id].q + ' ชิ้น)'; }).join('\n') : 'ไม่พบสินค้าที่ขายได้และเหลือน้อย');
        } else {
          var D = S.prods.filter(function (p) { return pq(p) > 0 && p.status !== 'black' && p.status !== 'red' && !by[p.id]; });
          ans = rg + ':\n' + (D.length ? 'สินค้าที่มีของแต่ไม่มียอดขายเลย ' + D.length + ' รุ่น:\n' + D.slice(0, 10).map(function (p) { return '• ' + p.code + ' ' + p.name + ' เหลือ ' + pq(p) + ' ชิ้น'; }).join('\n') : 'ไม่พบสินค้าค้างสต๊อก');
        }
      } else {
        var e90 = await expBetween(addD(t, -90), addD(t, 1)), c1 = addD(t, -30), rec = {}, old = {};
        e90.forEach(function (x) { var m = x.paid_on >= c1 ? rec : old; m[x.kind] = (m[x.kind] || 0) + Number(x.amount); });
        if (e90.length < 5) ans = 'ข้อมูลรายจ่าย 90 วันที่ผ่านมามี ' + e90.length + ' รายการ น้อยเกินไปที่จะเทียบความผิดปกติ';
        else {
          var fl = Object.keys(rec).filter(function (kk) { var avg = (old[kk] || 0) / 2; return rec[kk] > avg * 1.5 && rec[kk] - avg > 500; });
          ans = 'เทียบ 30 วันล่าสุด กับค่าเฉลี่ยต่อเดือนของ 60 วันก่อนหน้า:\n' + (fl.length ? fl.map(function (kk) { return '• ' + (EXK[kk] || kk) + ': ฿' + fmt(rec[kk]) + ' (ปกติประมาณ ฿' + fmt((old[kk] || 0) / 2) + ')'; }).join('\n') : 'ไม่พบรายจ่ายที่สูงผิดปกติ');
        }
      }
    } catch (e) { ans = 'ดึงข้อมูลไม่สำเร็จ: ' + errMsg(e); }
    aiLog.push({ t: esc(ans) });
    if (S.cur === 'ai') PAGES.ai();
  };

  /* ===== ตั้งค่า / สำรองข้อมูล ===== */
  PAGES.set = async function () {
    $('view').innerHTML = '<h2>ตั้งค่า</h2><div class="card"><h3>บัญชีผู้ใช้</h3><div class="kv" style="border-top:0"><span>อีเมล</span><b id="stm">...</b></div>' +
      '<details class="tri"><summary>เปลี่ยนรหัสผ่าน</summary><label>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)<input id="pw1" type="password" autocomplete="new-password"></label>' +
      '<label>พิมพ์ซ้ำอีกครั้ง<input id="pw2" type="password" autocomplete="new-password"></label><div class="err" id="pwer"></div>' +
      '<button class="btn" data-a="pwsave">บันทึกรหัสผ่านใหม่</button></details>' +
      '<div class="btns"><button class="btn o" data-a="theme">เปลี่ยนธีม สว่าง/มืด</button><button class="btn o dng" data-a="logout">ออกจากระบบ</button></div></div>' +
      '<div class="card"><h3>ประเภทสินค้า</h3>' + S.cats.map(function (c) {
        var n = S.prods.filter(function (p) { return p.category_id === c.id; }).length;
        return '<div class="row"><div class="gr"><b>' + esc(c.name) + '</b> <small>' + esc(c.prefix) + '-001 · ' + n + ' รุ่น</small></div>' +
          '<button class="dsm" style="color:var(--text);border-color:var(--line)" data-a="catren" data-v="' + c.id + '">แก้ชื่อ</button>' +
          '<button class="dsm" style="color:var(--text);border-color:var(--line)" data-a="catqr" data-v="' + c.id + '">QR</button></div>';
      }).join('') + '<button class="btn o" data-a="catadd">' + ic('plus', 18) + ' เพิ่มประเภท</button></div>' +
      '<div class="card"><h3>สถานที่จัดเก็บ</h3>' + S.locs.map(function (l) { return '<div class="kv" style="border-top:0"><span>' + esc(l.name) + '</span></div>'; }).join('') +
      '<button class="btn o" data-a="locadd">' + ic('plus', 18) + ' เพิ่มสถานที่</button></div>' +
      '<div class="card"><h3>สำรองและส่งออกข้อมูล</h3><small>ไฟล์ CSV เปิดด้วย Excel / Google Sheets ได้</small><div class="btns" style="margin-top:6px">' +
      '<button class="btn o" data-a="exp" data-v="products">สินค้า</button><button class="btn o" data-a="exp" data-v="stock">สต๊อก</button>' +
      '<button class="btn o" data-a="exp" data-v="sales">ยอดขายทั้งหมด</button><button class="btn o" data-a="exp" data-v="expenses">รายจ่าย</button></div>' +
      '<button class="btn" data-a="exp" data-v="backup">' + ic('dl', 20) + ' สำรองข้อมูลทั้งหมด (JSON)</button><div class="err" id="exer"></div></div>';
    S.sb.auth.getUser().then(function (r) { var e = $('stm'); if (e) e.textContent = (r.data && r.data.user && r.data.user.email) || '-'; });
  };
  A.pwsave = async function () {
    var a = $('pw1').value, b = $('pw2').value, er = function (m) { $('pwer').textContent = m; };
    if (a.length < 8) return er('รหัสผ่านต้องยาวอย่างน้อย 8 ตัว');
    if (a !== b) return er('รหัสผ่านสองช่องไม่ตรงกัน');
    var r = await S.sb.auth.updateUser({ password: a });
    if (r.error) return er('เปลี่ยนไม่สำเร็จ: ' + r.error.message);
    $('pw1').value = ''; $('pw2').value = ''; er(''); toast('เปลี่ยนรหัสผ่านแล้ว');
  };
  A.catadd = function () {
    openSheet(head('เพิ่มประเภทสินค้า') + '<label>ชื่อประเภท<input id="cn" placeholder="เช่น ผ้าพันคอ"></label>' +
      '<label>ตัวย่อรหัส (ตัวอักษรอังกฤษใหญ่ 3 ตัว)<input id="cp" maxlength="3" placeholder="เช่น SCA" style="text-transform:uppercase"></label>' +
      '<small>รหัสสินค้าจะเป็น ตัวย่อ-001, ตัวย่อ-002 ... ตัวย่อเปลี่ยนภายหลังไม่ได้</small><div class="err" id="cer"></div><button class="btn" id="cgo" data-a="catsave">บันทึก</button>');
  };
  A.catsave = async function () {
    var n = $('cn').value.trim(), p = $('cp').value.trim().toUpperCase(), er = function (m) { $('cer').textContent = m; };
    if (!n) return er('ใส่ชื่อประเภท');
    if (!/^[A-Z]{3}$/.test(p)) return er('ตัวย่อต้องเป็นตัวอักษร A-Z จำนวน 3 ตัว');
    $('cgo').disabled = true;
    var r = await S.sb.from('categories').insert({ name: n, prefix: p });
    if (r.error) { $('cgo').disabled = false; return er(/duplicate|unique/i.test(r.error.message) ? 'ชื่อหรือตัวย่อนี้มีอยู่แล้ว' : 'บันทึกไม่สำเร็จ: ' + r.error.message); }
    closeSheet(); await load(); toast('เพิ่มประเภทแล้ว');
  };
  A.catren = async function (id) {
    var c = S.cats.find(function (x) { return x.id === id; }); if (!c) return;
    var n = prompt('ชื่อประเภทใหม่ (รหัสสินค้าเดิมไม่เปลี่ยน)', c.name);
    if (n === null || !n.trim() || n.trim() === c.name) return;
    var r = await S.sb.from('categories').update({ name: n.trim() }).eq('id', id);
    if (r.error) return toast('แก้ชื่อไม่สำเร็จ: ' + r.error.message);
    await load(); toast('แก้ชื่อประเภทแล้ว');
  };
  A.locadd = async function () {
    var n = prompt('ชื่อสถานที่ใหม่ เช่น คลังสำรอง');
    if (!n || !n.trim()) return;
    var r = await S.sb.from('locations').insert({ name: n.trim() });
    if (r.error) return toast('เพิ่มไม่สำเร็จ: ' + r.error.message);
    await load(); toast('เพิ่มสถานที่แล้ว');
  };
  A.exp = async function (what) {
    var er = $('exer'); if (er) er.textContent = 'กำลังเตรียมไฟล์...';
    var d = today();
    try {
      if (what === 'products') {
        var rows = [['รหัส', 'ชื่อ', 'ประเภท', 'ต้นทุน', 'ราคาตั้งต้น', 'สถานะ', 'คงเหลือรวม']];
        S.prods.forEach(function (p) { rows.push([p.code, p.name, p.categories && p.categories.name, p.current_cost, p.base_price, ST[p.status], pq(p)]); });
        download('products-' + d + '.csv', csv(rows));
      } else if (what === 'stock') {
        var r2 = [['รหัส', 'ชื่อ', 'ไซส์', 'ลาย', 'สถานที่', 'จำนวน']];
        S.prods.forEach(function (p) { (p.variants || []).forEach(function (v) { S.locs.forEach(function (l) { r2.push([p.code, p.name, v.size, v.pattern, l.name, lq(v, l.id)]); }); }); });
        download('stock-' + d + '.csv', csv(r2));
      } else if (what === 'sales') {
        var sl = await fetchAll(function () {
          return S.sb.from('sales').select('id,qty,unit_price,unit_cost,payment_method,created_at,voided_at,product_id,variants(size,pattern),locations(name)').order('created_at');
        });
        var pm = {}; S.prods.forEach(function (p) { pm[p.id] = p; });
        var r3 = [['วันเวลา', 'รหัส', 'ชื่อ', 'ไซส์/ลาย', 'สถานที่', 'จำนวน', 'ราคาขาย', 'ต้นทุน', 'รายรับ', 'กำไรขั้นต้น', 'วิธีชำระ', 'สถานะ']];
        sl.forEach(function (x) {
          var p = pm[x.product_id] || {};
          r3.push([new Date(x.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }), p.code, p.name, vname(x.variants || {}), (x.locations || {}).name, x.qty,
            x.unit_price, x.unit_cost, x.unit_price * x.qty, (x.unit_price - x.unit_cost) * x.qty, PMN[x.payment_method] || x.payment_method, x.voided_at ? 'ยกเลิก' : 'ปกติ']);
        });
        download('sales-all-' + d + '.csv', csv(r3));
      } else if (what === 'expenses') {
        var ex = await fetchAll(function () { return S.sb.from('expenses').select('id,kind,amount,paid_on,note,voided_at').order('paid_on'); });
        var r4 = [['วันที่', 'ประเภท', 'จำนวน', 'หมายเหตุ', 'สถานะ']];
        ex.forEach(function (x) { r4.push([x.paid_on, EXK[x.kind] || x.kind, x.amount, x.note, x.voided_at ? 'ยกเลิก' : 'ปกติ']); });
        download('expenses-' + d + '.csv', csv(r4));
      } else {
        var out = { exported_at: new Date().toISOString(), note: 'สำรองข้อมูล Xiress' };
        var T = ['categories', 'locations', 'products', 'variants', 'stock_levels', 'sales', 'status_history', 'expenses', 'incomes', 'daily_closes', 'properties', 'units', 'tenants', 'leases', 'rent_payments', 'unit_costs'];
        for (var i = 0; i < T.length; i++) {
          try { out[T[i]] = await fetchAll(function () { return S.sb.from(T[i]).select('*').order('created_at'); }); }
          catch (e) { try { out[T[i]] = await fetchAll(function () { return S.sb.from(T[i]).select('*'); }); } catch (e2) { out[T[i]] = { error: e2.message }; } }
        }
        download('smartshop-backup-' + d + '.json', JSON.stringify(out, null, 1), 'application/json');
      }
      if (er) er.textContent = '';
      toast('ดาวน์โหลดไฟล์แล้ว');
    } catch (e) { if (er) er.textContent = 'ส่งออกไม่สำเร็จ: ' + errMsg(e); }
  };

  /* วาดหน้าใหม่ถ้าหน้านั้นเปิดค้างอยู่ */
  if (S.ready) render();
})();
