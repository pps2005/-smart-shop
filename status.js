(function () {
  var css = document.createElement('style');
  css.textContent =
    '.ovl{position:absolute;inset:0;display:grid;place-items:center;background:rgba(15,23,42,.5);pointer-events:none;overflow:hidden}' +
    '.ovl b{display:block;width:140%;text-align:center;transform:rotate(-14deg);color:#fff;font-weight:800;letter-spacing:3px;font-size:1.5rem;padding:6px 0;box-shadow:0 4px 14px rgba(0,0,0,.35)}' +
    '.o-out b,.o-black b{background:#111827;border-top:2px solid #fff;border-bottom:2px solid #fff}' +
    '.o-red b{background:#dc2626}' +
    '.o-blue{background:rgba(37,99,235,.15)}.o-blue b{background:#2563eb;font-size:1.1rem}';
  document.head.appendChild(css);

  var LB = { red: 'เสีย', black: 'หมด', out: 'หมด', blue: 'สำรอง' };
  function eff(p) {
    if (p.status === 'red') return 'red';
    if (p.status === 'black') return 'black';
    if (pq(p) < 1) return 'out';
    if (p.status === 'blue') return 'blue';
    return '';
  }
  function ovl(p) {
    var e = eff(p);
    return e ? '<span class="ovl o-' + e + '"><b>' + LB[e] + '</b></span>' : '';
  }
  function dot(p) { return eff(p) === 'out' ? 'black' : p.status; }

  list = function () {
    var L = filt();
    $('lst').innerHTML = L.length ? L.map(function (p) {
      return '<button class="pc" data-a="open" data-v="' + esc(p.code) + '"><div class="im">' + thumb(p) + ovl(p) +
        '<i class="dt" style="background:var(--' + dot(p) + ')"></i></div><div class="pi"><div class="pn">' + esc(p.name) +
        '</div><div class="pr">฿' + fmt(p.base_price) + '</div><div class="pm"><span>' + esc(p.code) +
        '</span><span>คงเหลือ ' + pq(p) + '</span></div></div></button>';
    }).join('') : (S.prods.length ? '<div class="empty">ไม่พบสินค้า</div>' : emptyBox);
  };

  var _d = detail;
  detail = function (code) {
    _d(code);
    var p = S.prods.find(function (x) { return x.code === code; });
    var b = $('sbody');
    if (!p || !b) return;
    var im = b.querySelector('.im');
    if (im) im.insertAdjacentHTML('beforeend', ovl(p));
    var bt = b.querySelector('.btns');
    if (!bt) return;
    bt.insertAdjacentHTML('beforebegin',
      '<h3 style="margin-top:14px">เปลี่ยนสถานะ</h3><div class="chips" style="flex-wrap:wrap">' +
      Object.keys(ST).map(function (k) {
        return '<button class="chip ' + (p.status === k ? 'on' : '') + '" data-a="setst" data-v="' + esc(p.code) + '|' + k + '">' +
          '<i class="dt" style="background:var(--' + k + ')"></i>' + ST[k] + '</button>';
      }).join('') + '</div><div id="sth" data-c="' + esc(code) + '"></div>');
    S.sb.from('status_history').select('from_status,to_status,created_at')
      .eq('product_id', p.id).order('created_at', { ascending: false }).limit(5)
      .then(function (r) {
        var el = $('sth');
        if (!el || el.dataset.c !== code || r.error || !r.data || !r.data.length) return;
        el.innerHTML = '<small>ประวัติการเปลี่ยนสถานะ</small>' + r.data.map(function (h) {
          return '<div class="kv"><span>' +
            new Date(h.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) +
            '</span><span>' + ST[h.from_status] + ' → ' + ST[h.to_status] + '</span></div>';
        }).join('');
      });
  };

  var busy = false;
  A.setst = async function (v) {
    if (busy) return;
    var a = v.split('|');
    var p = S.prods.find(function (x) { return x.code === a[0]; });
    if (!p || p.status === a[1]) return;
    if (!confirm('เปลี่ยนสถานะ ' + p.code + ' เป็น "' + ST[a[1]] + '" ใช่หรือไม่?')) return;
    busy = true;
    var r = await S.sb.rpc('set_product_status', { p_product_id: p.id, p_status: a[1], p_note: null });
    busy = false;
    if (r.error) return toast('เปลี่ยนสถานะไม่สำเร็จ: ' + r.error.message);
    await load();
    detail(a[0]);
    toast('เปลี่ยนสถานะเป็น "' + ST[a[1]] + '" แล้ว');
  };
})();
