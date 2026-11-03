(function () {
  var css = document.createElement('style');
  css.textContent =
    '#sw{position:relative}#sw input{padding-right:48px}' +
    '#sw .sb{position:absolute;right:0;top:0;bottom:0;width:46px;display:grid;place-items:center;color:#4f46e5}' +
    '.pay{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px}.pay .chip{flex:1 1 40%;justify-content:center}' +
    '.sm{background:var(--bg);border-radius:14px;padding:8px 12px;margin:6px 0}.sm .kv{border:0;padding:4px 0}';
  document.head.appendChild(css);

  var PAY = { cash: 'เงินสด', card: 'บัตร', transfer: 'โอนเงิน', other: 'อื่น ๆ' };
  var pay = 'cash';
  try { pay = localStorage.getItem('pay') || 'cash'; } catch (e) {}
  if (!PAY[pay]) pay = 'cash';
  var key = null, cur = null, busy = false;

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function clearHash() {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  function byCode(c) { return S.prods.find(function (p) { return p.code === c; }); }
  function curV() {
    var id = $('sv2').value;
    return (cur.variants || []).find(function (v) { return v.id === id; });
  }

  // ปิด popup แล้วล้างลิงก์ QR ไม่ให้เด้งซ้ำ
  var _close = closeSheet;
  closeSheet = function () {
    _close();
    if (/^#p=/.test(location.hash)) clearHash();
  };

  // ===== popup รายละเอียดสินค้า (รูปบน รายละเอียดล่าง + ปุ่ม QR/ขาย) =====
  detail = function (code) {
    var p = byCode(code);
    if (!p) return toast('ไม่พบสินค้า ' + code);
    var vs = p.variants || [];
    openSheet(
      head(esc(p.name)) +
      '<div class="im" style="border-radius:16px;aspect-ratio:16/10;margin-bottom:8px">' + thumb(p) + '</div>' +
      '<div class="kv"><span>รหัสสินค้า</span><b>' + esc(p.code) + '</b></div>' +
      '<div class="kv"><span>ประเภท</span><span>' + esc(p.categories && p.categories.name) + '</span></div>' +
      '<div class="kv"><span>ต้นทุน</span><span>฿' + fmt(p.current_cost) + '</span></div>' +
      '<div class="kv"><span>ราคาขายตั้งต้น</span><b>฿' + fmt(p.base_price) + '</b></div>' +
      '<div class="kv"><span>สถานะ</span><span><i class="dt" style="background:var(--' + p.status + ');margin-right:6px"></i>' + ST[p.status] + '</span></div>' +
      '<div class="kv"><span>คงเหลือรวม</span><b>' + pq(p) + ' ชิ้น</b></div>' +
      (p.description ? '<div class="kv"><span>รายละเอียด</span><span>' + esc(p.description) + '</span></div>' : '') +
      '<h3 style="margin-top:14px">แยกตามไซส์/ลาย</h3>' +
      vs.map(function (v) {
        return '<div class="kv"><span>' + esc(vname(v)) + '</span><span>' +
          S.locs.map(function (l) { return esc(l.name) + ' ' + lq(v, l.id); }).join(' · ') + '</span></div>';
      }).join('') +
      '<div class="btns"><button class="btn o" data-a="qr" data-v="' + esc(p.code) + '">' + ic('qr', 20) + ' QR Code</button>' +
      '<button class="btn" data-a="sale" data-v="' + esc(p.code) + '">' + ic('cart', 20) + ' ขายสินค้า</button></div>'
    );
  };

  // ===== ค้นหาแล้วเด้ง popup =====
  var q = $('q');
  q.setAttribute('enterkeyhint', 'search');
  var sb = document.createElement('button');
  sb.type = 'button'; sb.className = 'sb'; sb.setAttribute('aria-label', 'ค้นหา');
  sb.innerHTML = ic('search', 20);
  $('sw').appendChild(sb);

  function doSearch() {
    if (!S.ready) return toast('กำลังโหลดข้อมูล รอสักครู่');
    var t = q.value.trim().toLowerCase();
    if (!t) return toast('พิมพ์ชื่อหรือรหัสสินค้าก่อน');
    var L = S.prods.filter(function (p) { return p.name.toLowerCase().indexOf(t) > -1 || p.code.toLowerCase().indexOf(t) > -1; });
    var ex = S.prods.filter(function (p) { return p.code.toLowerCase() === t; });
    q.blur();
    if (ex.length === 1) return detail(ex[0].code);
    if (L.length === 1) return detail(L[0].code);
    if (!L.length) return toast('ไม่พบสินค้า');
    openSheet(head('ผลการค้นหา (' + L.length + ')') + L.map(function (p) {
      return '<button class="row" style="width:100%;text-align:left" data-a="open" data-v="' + esc(p.code) + '">' +
        '<div class="th">' + thumb(p) + '</div><div class="gr"><b>' + esc(p.code) + '</b> ' + esc(p.name) +
        '<br><small>฿' + fmt(p.base_price) + ' · คงเหลือ ' + pq(p) + '</small></div>' +
        '<i class="dt" style="background:var(--' + p.status + ')"></i></button>';
    }).join(''));
  }
  sb.addEventListener('click', doSearch);
  q.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
  });

  // ===== popup ขายสินค้า =====
  function saleSheet(code) {
    if (!S.ready) return;
    var p = byCode(code);
    if (!p) return toast('ไม่พบสินค้า ' + code);
    key = uuid();
    var all = S.prods.slice().sort(function (a, b) { return a.code.localeCompare(b.code); });
    openSheet(
      head('ขายสินค้า') +
      '<label>รหัสสินค้า<select id="sc">' + all.map(function (x) {
        return '<option value="' + esc(x.code) + '"' + (x.code === code ? ' selected' : '') + '>' + esc(x.code) + ' · ' + esc(x.name) + '</option>';
      }).join('') + '</select></label><div id="sf"></div>'
    );
    $('sc').onchange = function () { key = uuid(); fill(this.value); };
    fill(code);
  }

  function fill(code) {
    var p = byCode(code);
    cur = p;
    var vs = p.variants || [];
    if (!vs.length) { $('sf').innerHTML = '<div class="empty">สินค้านี้ไม่มีรุ่นย่อย</div>'; return; }
    var vsel = vs.find(function (v) { return vq(v) > 0; }) || vs[0];
    var h =
      '<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><div class="th" style="width:56px;height:56px;flex-basis:56px">' + thumb(p) +
      '</div><div><b>' + esc(p.name) + '</b><br><small>ต้นทุน ฿' + fmt(p.current_cost) + ' · ราคาตั้งต้น ฿' + fmt(p.base_price) + '</small></div></div>';
    if (p.status === 'red' || p.status === 'black') {
      h += '<div class="note" style="margin-bottom:10px;color:var(--red)">สถานะสินค้านี้คือ "' + ST[p.status] + '"</div>';
    }
    h += '<label>ไซส์ / ลาย<select id="sv2">' + vs.map(function (v) {
      return '<option value="' + v.id + '"' + (v === vsel ? ' selected' : '') + '>' + esc(vname(v)) + ' (เหลือ ' + vq(v) + ')</option>';
    }).join('') + '</select></label>' +
      '<label>ขายจากสถานที่<select id="sl"></select></label>' +
      '<div class="two"><label>จำนวน<input id="sq" type="number" inputmode="numeric" min="1" value="1"></label>' +
      '<label>ราคาขายจริง (บาท)<input id="spx" type="number" inputmode="decimal" min="0" value="' + p.base_price + '"></label></div>' +
      '<small>วิธีชำระเงิน</small><div class="pay">' + Object.keys(PAY).map(function (k) {
        return '<button type="button" class="chip ' + (k === pay ? 'on' : '') + '" data-a="pay" data-v="' + k + '">' + PAY[k] + '</button>';
      }).join('') + '</div>' +
      '<div class="sm" id="ssum"></div><div class="err" id="ser"></div>' +
      '<button class="btn" id="sgo" data-a="sellgo">ยืนยันการขาย</button>';
    $('sf').innerHTML = h;
    $('sv2').onchange = locs;
    $('sl').onchange = function () { clamp(); sum(); };
    $('sq').oninput = sum;
    $('spx').oninput = sum;
    locs();
  }

  function locs() {
    var v = curV(), sel = $('sl');
    var opts = S.locs.map(function (l) { return { id: l.id, name: l.name, n: lq(v, l.id) }; });
    var first = opts.find(function (o) { return o.n > 0; });
    sel.innerHTML = opts.map(function (o) {
      return '<option value="' + o.id + '"' + (first && o.id === first.id ? ' selected' : '') + (o.n < 1 ? ' disabled' : '') + '>' + esc(o.name) + ' (เหลือ ' + o.n + ')</option>';
    }).join('');
    clamp(); sum();
  }
  function clamp() {
    var n = lq(curV(), $('sl').value), qi = $('sq');
    qi.max = n;
    if (n > 0 && +qi.value > n) qi.value = n;
  }
  function sum() {
    var v = curV(), n = lq(v, $('sl').value);
    var qn = parseInt($('sq').value), px = parseFloat($('spx').value), c = Number(cur.current_cost);
    var bad = n < 1 ? 'ไซส์/ลายนี้หมดสต๊อก' :
      !(qn >= 1) ? 'ใส่จำนวนอย่างน้อย 1' :
      qn > n ? 'มีของแค่ ' + n + ' ชิ้น' :
      (isNaN(px) || px < 0) ? 'ใส่ราคาขายจริง' : '';
    $('ser').textContent = bad;
    $('sgo').disabled = !!bad;
    if (bad) { $('ssum').innerHTML = ''; return; }
    var rev = px * qn, cost = c * qn, gp = rev - cost;
    $('ssum').innerHTML =
      '<div class="kv"><span>รายรับ</span><b>฿' + fmt(rev) + '</b></div>' +
      '<div class="kv"><span>ต้นทุนขาย</span><span>฿' + fmt(cost) + '</span></div>' +
      '<div class="kv"><span>กำไรขั้นต้น</span><b style="color:var(--' + (gp < 0 ? 'red' : 'green') + ')">฿' + fmt(gp) + '</b></div>' +
      (px < c ? '<div class="lk">⚠ ราคาขายต่ำกว่าต้นทุน</div>' : '');
  }

  A.sale = function (v) { saleSheet(v); };
  A.pay = function (v) {
    pay = v;
    try { localStorage.setItem('pay', v); } catch (e) {}
    document.querySelectorAll('.pay .chip').forEach(function (c) { c.classList.toggle('on', c.dataset.v === v); });
  };
  A.sellgo = async function () {
    if (busy) return;
    var btn = $('sgo');
    if (btn.disabled) return;
    var v = curV(), qn = parseInt($('sq').value), px = parseFloat($('spx').value), loc = $('sl').value;
    var c = Number(cur.current_cost), code = cur.code, vn = vname(v);
    if (px < c && !confirm('ราคาขายต่ำกว่าต้นทุน ยืนยันขายหรือไม่?')) return;
    if ((cur.status === 'red' || cur.status === 'black') && !confirm('สินค้านี้สถานะ "' + ST[cur.status] + '" ยืนยันขายหรือไม่?')) return;
    busy = true; btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    try {
      var r = await S.sb.rpc('record_sale', {
        p_variant_id: v.id, p_location_id: loc, p_qty: qn, p_price: px, p_method: pay, p_key: key
      });
      if (r.error) throw r.error;
      var s = r.data;
      var gp = (Number(s.unit_price) - Number(s.unit_cost)) * s.qty;
      key = null; cur = null;
      closeSheet();
      await load();
      toast('ขายแล้ว ' + code + ' ' + vn + ' ×' + s.qty + ' = ฿' + fmt(s.unit_price * s.qty) + ' · กำไร ฿' + fmt(gp));
    } catch (e) {
      btn.disabled = false; btn.textContent = 'ยืนยันการขาย';
      $('ser').textContent = 'ขายไม่สำเร็จ: ' + (e.message || e);
    }
    busy = false;
  };

  // เมนู "ขายสินค้า" เปิด popup ขาย
  var _go = A.go;
  A.go = function (v) {
    if (v === 'sell') {
      closeSheet();
      if (!S.prods.length) return toast('ยังไม่มีสินค้า เพิ่มสินค้าก่อน');
      return saleSheet(S.prods[0].code);
    }
    _go(v);
  };

  // สแกน QR (#p=รหัส) แล้วเปิด popup ขายทันที
  var _old = openHash;
  window.removeEventListener('hashchange', _old);
  openHash = function () {
    var m = location.hash.match(/^#p=(.+)$/);
    if (m && S.ready) saleSheet(decodeURIComponent(m[1]));
  };
  window.addEventListener('hashchange', function () { openHash(); });
})();
