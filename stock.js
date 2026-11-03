(function () {
  Object.assign(I, {
    minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
    swap: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    check: '<polyline points="20 6 9 17 4 12"/>'
  });

  var css = document.createElement('style');
  css.textContent = [
    '.sheet>div{font-size:19px;line-height:1.5}',
    '.sheet h2{font-size:1.45rem}.sheet h3{font-size:1.2rem}',
    '.sheet .kv{font-size:1.05rem;padding:12px 0}',
    '.sheet .kv span:first-child,.sheet small{color:var(--text);opacity:.75}',
    '.sheet small{font-size:.95rem}',
    '.sheet label,.lb{font-size:1rem;font-weight:600;color:var(--text)}',
    '.lb{margin-bottom:4px}',
    '.sheet input,.sheet select,.sheet textarea{font-size:18px;min-height:54px;border-width:2px}',
    '.sheet .btn{min-height:58px;font-size:1.1rem}',
    '.sheet .chip{padding:12px 16px;font-size:1rem}',
    '.sheet .x{width:48px;height:48px}',
    '.stp{display:grid;grid-template-columns:64px 1fr 64px;gap:10px;margin:6px 0 12px}',
    '.sbn{height:60px;border-radius:14px;background:var(--bg);border:2px solid var(--line);display:grid;place-items:center}',
    '.stp input{width:100%;height:60px;text-align:center;font-size:1.7rem!important;font-weight:800;border-radius:14px;border:2px solid var(--line);background:var(--bg);outline:0}',
    '.swp{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:50px;border-radius:12px;border:2px dashed var(--line);margin:0 0 10px;color:var(--pri);font-weight:700}',
    '.okb{width:72px;height:72px;margin:6px auto 10px;border-radius:50%;background:var(--green);color:#fff;display:grid;place-items:center}',
    '.sm{font-size:1.05rem}'
  ].join('');
  document.head.appendChild(css);

  var busy = false, cur = null;

  function byCode(c) { return S.prods.find(function (p) { return p.code === c; }); }
  function lname(id) {
    var l = S.locs.find(function (x) { return x.id === id; });
    return l ? esc(l.name) : '';
  }
  function kv(a, b) { return '<div class="kv"><span>' + a + '</span><b>' + b + '</b></div>'; }
  function ph(p) {
    return '<div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">' +
      '<div class="th" style="width:64px;height:64px;flex-basis:64px">' + thumb(p) + '</div>' +
      '<div><b>' + esc(p.code) + '</b> ' + esc(p.name) + '</div></div>';
  }
  function stepper(id, val) {
    return '<div class="stp"><button type="button" class="sbn" data-a="stp" data-v="' + id + '|-1" aria-label="ลด">' + ic('minus', 26) + '</button>' +
      '<input id="' + id + '" type="number" inputmode="numeric" min="1" value="' + val + '">' +
      '<button type="button" class="sbn" data-a="stp" data-v="' + id + '|1" aria-label="เพิ่ม">' + ic('plus', 26) + '</button></div>';
  }
  A.stp = function (v) {
    var a = v.split('|'), i = $(a[0]);
    var n = (parseInt(i.value) || 0) + parseInt(a[1]);
    var mx = parseInt(i.max) || 9999;
    i.value = Math.max(1, Math.min(n, mx));
    i.dispatchEvent(new Event('input'));
  };
  function locOpts(v) {
    return S.locs.map(function (l) {
      return '<option value="' + l.id + '">' + esc(l.name) + (v ? ' (มี ' + lq(v, l.id) + ')' : '') + '</option>';
    }).join('');
  }

  // ===== หน้าสรุปหลังทำรายการ (ให้เห็นว่าเหลือจริงกี่ชิ้น) =====
  function done(title, code, vid) {
    var p = byCode(code);
    var v = p && (p.variants || []).find(function (x) { return x.id === vid; });
    if (!p || !v) { closeSheet(); return; }
    openSheet(
      head(title) + '<div class="okb">' + ic('check', 44) + '</div>' +
      '<h3 style="text-align:center;margin-bottom:10px">' + esc(p.code) + ' · ' + esc(p.name) + '<br>' + esc(vname(v)) + '</h3>' +
      '<small>จำนวนคงเหลือตอนนี้</small>' +
      S.locs.map(function (l) { return kv(esc(l.name), lq(v, l.id) + ' ชิ้น'); }).join('') +
      kv('รวมรุ่นนี้', vq(v) + ' ชิ้น') + kv('รวมทั้งสินค้า', pq(p) + ' ชิ้น') +
      '<div class="btns"><button class="btn o" data-a="close">เสร็จสิ้น</button>' +
      '<button class="btn" data-a="open" data-v="' + esc(code) + '">ดูสินค้า</button></div>'
    );
  }

  // ===== ย้ายสินค้า =====
  function tv() { return (cur.variants || []).find(function (v) { return v.id === $('tv').value; }); }

  function tlocs(keep) {
    var v = tv(), f = $('tf'), t = $('tt');
    var pf = f.value, pt = t.value, o = locOpts(v);
    f.innerHTML = o; t.innerHTML = o;
    if (keep && pf && pt) { f.value = pf; t.value = pt; }
    else {
      var sorted = S.locs.slice().sort(function (a, b) { return lq(v, b.id) - lq(v, a.id); });
      f.value = sorted[0].id;
      t.value = S.locs.find(function (l) { return l.id !== sorted[0].id; }).id;
    }
    tsum();
  }
  function tsum() {
    var v = tv(), f = $('tf').value, t = $('tt').value, qi = $('tq');
    var q = parseInt(qi.value), have = lq(v, f);
    qi.max = have;
    var bad = f === t ? 'ต้นทางและปลายทางต้องไม่ใช่ที่เดียวกัน' :
      have < 1 ? 'ที่ต้นทางไม่มีสินค้ารุ่นนี้' :
      !(q >= 1) ? 'ใส่จำนวนอย่างน้อย 1' :
      q > have ? 'ที่ต้นทางมีแค่ ' + have + ' ชิ้น' : '';
    $('ter').textContent = bad;
    $('tgo').disabled = !!bad;
    if (bad) { $('tsum').innerHTML = ''; return; }
    var tt = lq(v, t);
    $('tsum').innerHTML =
      '<small>ผลหลังย้าย (ก่อน → หลัง)</small>' +
      kv(lname(f) + ' (ต้นทาง)', have + ' → ' + (have - q)) +
      kv(lname(t) + ' (ปลายทาง)', tt + ' → ' + (tt + q)) +
      kv('รวมรุ่นนี้', vq(v) + ' (เท่าเดิม)');
  }
  function tfSheet(code) {
    var p = byCode(code);
    if (!p) return;
    if (S.locs.length < 2) return toast('ต้องมีสถานที่อย่างน้อย 2 แห่ง');
    var vs = p.variants || [];
    if (!vs.length) return toast('สินค้านี้ไม่มีรุ่นย่อย');
    cur = p;
    openSheet(
      head('ย้ายสินค้า') + ph(p) +
      '<label>ไซส์ / ลาย<select id="tv">' + vs.map(function (v) {
        return '<option value="' + v.id + '">' + esc(vname(v)) + ' (รวม ' + vq(v) + ')</option>';
      }).join('') + '</select></label>' +
      '<label>ย้ายจาก<select id="tf"></select></label>' +
      '<button type="button" class="swp" data-a="tswap">' + ic('swap', 24) + ' สลับทิศทาง</button>' +
      '<label>ไปที่<select id="tt"></select></label>' +
      '<div class="lb">จำนวนที่ย้าย</div>' + stepper('tq', 1) +
      '<div class="sm" id="tsum"></div><div class="err" id="ter"></div>' +
      '<button class="btn" id="tgo" data-a="tgo">ยืนยันการย้าย</button>'
    );
    $('tv').onchange = function () { tlocs(true); };
    $('tf').onchange = function () {
      if ($('tt').value === $('tf').value) {
        $('tt').value = S.locs.find(function (l) { return l.id !== $('tf').value; }).id;
      }
      tsum();
    };
    $('tt').onchange = function () {
      if ($('tt').value === $('tf').value) {
        $('tf').value = S.locs.find(function (l) { return l.id !== $('tt').value; }).id;
      }
      tsum();
    };
    $('tq').oninput = tsum;
    tlocs(false);
  }
  A.tswap = function () {
    var a = $('tf').value;
    $('tf').value = $('tt').value;
    $('tt').value = a;
    tsum();
  };
  A.tgo = async function () {
    if (busy) return;
    var btn = $('tgo');
    if (btn.disabled) return;
    var v = tv(), code = cur.code, vid = v.id;
    busy = true; btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    var r = await S.sb.rpc('transfer_stock', {
      p_variant_id: vid, p_from: $('tf').value, p_to: $('tt').value, p_qty: parseInt($('tq').value)
    });
    busy = false;
    if (r.error) {
      btn.disabled = false; btn.textContent = 'ยืนยันการย้าย';
      $('ter').textContent = 'ย้ายไม่สำเร็จ: ' + r.error.message;
      return;
    }
    await load();
    done('ย้ายสินค้าแล้ว', code, vid);
  };

  // ===== เติมสินค้า =====
  function rcur() {
    var id = $('rv').value;
    return id === 'new' ? null : (cur.variants || []).find(function (x) { return x.id === id; });
  }
  function rsum() {
    var isNew = $('rv').value === 'new', v = rcur();
    $('rnew').style.display = isNew ? 'block' : 'none';
    var loc = $('rl').value, q = parseInt($('rq').value);
    var have = v ? lq(v, loc) : 0, tot = v ? vq(v) : 0;
    var bad = !(q >= 1) ? 'ใส่จำนวนอย่างน้อย 1' :
      (isNew && !$('rs').value.trim() && !$('rp').value.trim()) ? 'ใส่ไซส์หรือลายของรุ่นใหม่' : '';
    $('rer').textContent = bad;
    $('rgo').disabled = !!bad;
    if (bad) { $('rsum').innerHTML = ''; return; }
    $('rsum').innerHTML =
      '<small>ผลหลังเติม (ก่อน → หลัง)</small>' +
      kv(lname(loc), have + ' → ' + (have + q)) +
      kv('รวมรุ่นนี้', tot + ' → ' + (tot + q));
  }
  function rsSheet(code) {
    var p = byCode(code);
    if (!p) return;
    cur = p;
    var vs = p.variants || [];
    openSheet(
      head('เติมสินค้า') + ph(p) +
      '<label>ไซส์ / ลาย<select id="rv">' + vs.map(function (v) {
        return '<option value="' + v.id + '">' + esc(vname(v)) + ' (รวม ' + vq(v) + ')</option>';
      }).join('') + '<option value="new">+ ไซส์/ลายใหม่</option></select></label>' +
      '<div id="rnew" style="display:none"><div class="two"><input id="rs" placeholder="ไซส์ เช่น XL"><input id="rp" placeholder="ลาย/สี"></div></div>' +
      '<label>เติมไปที่<select id="rl">' + locOpts(null) + '</select></label>' +
      '<div class="lb">จำนวนที่เติม</div>' + stepper('rq', 1) +
      '<label>หมายเหตุ (ไม่บังคับ)<input id="rn" placeholder="เช่น รับของรอบใหม่"></label>' +
      '<div class="sm" id="rsum"></div><div class="err" id="rer"></div>' +
      '<button class="btn" id="rgo" data-a="rgo">ยืนยันการเติมสินค้า</button>'
    );
    ['rv', 'rl'].forEach(function (id) { $(id).onchange = rsum; });
    ['rq', 'rs', 'rp'].forEach(function (id) { $(id).oninput = rsum; });
    rsum();
  }
  A.rgo = async function () {
    if (busy) return;
    var btn = $('rgo');
    if (btn.disabled) return;
    var p = cur, code = p.code, v = rcur();
    busy = true; btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    var r = await S.sb.rpc('restock_stock', {
      p_product_id: p.id, p_variant_id: v ? v.id : null,
      p_size: v ? null : $('rs').value, p_pattern: v ? null : $('rp').value,
      p_location_id: $('rl').value, p_qty: parseInt($('rq').value),
      p_note: $('rn').value.trim() || null
    });
    busy = false;
    if (r.error) {
      btn.disabled = false; btn.textContent = 'ยืนยันการเติมสินค้า';
      $('rer').textContent = 'เติมไม่สำเร็จ: ' + r.error.message;
      return;
    }
    var vid = r.data;
    await load();
    var np = byCode(code);
    if (np && np.status === 'black' &&
        confirm('สินค้านี้สถานะ "หมด" ตอนนี้มีของแล้ว ต้องการเปลี่ยนเป็น "พร้อมขาย" หรือไม่?')) {
      await S.sb.rpc('set_product_status', { p_product_id: np.id, p_status: 'green', p_note: 'เติมสินค้าแล้ว' });
      await load();
    }
    done('เติมสินค้าแล้ว', code, vid);
  };

  A.rsopen = function (v) { rsSheet(v); };
  A.tfopen = function (v) { tfSheet(v); };

  // ===== เพิ่มปุ่มในหน้ารายละเอียดสินค้า =====
  var _d = detail;
  detail = function (code) {
    _d(code);
    var p = byCode(code), b = $('sbody');
    if (!p || !b) return;
    var anchor = Array.prototype.find.call(b.querySelectorAll('h3'), function (h) {
      return h.textContent === 'เปลี่ยนสถานะ';
    }) || b.querySelector('.btns');
    if (!anchor) return;
    anchor.insertAdjacentHTML('beforebegin',
      '<h3 style="margin-top:14px">จัดการสต๊อก</h3><div class="btns">' +
      '<button class="btn o" data-a="rsopen" data-v="' + esc(code) + '">' + ic('plus', 22) + ' เติมสินค้า</button>' +
      '<button class="btn o" data-a="tfopen" data-v="' + esc(code) + '">' + ic('swap', 22) + ' ย้ายสินค้า</button></div>');
  };
})();
