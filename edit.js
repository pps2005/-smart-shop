(function () {
  Object.assign(I, {
    minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>'
  });

  var css = document.createElement('style');
  css.textContent =
    '.rch{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px}.rch .chip{flex:1 1 40%;justify-content:center}' +
    '.vbtn{padding:8px 12px;border:1px solid var(--red);border-radius:10px;color:var(--red);font-size:.85rem;margin-top:4px}';
  document.head.appendChild(css);

  var RS = { fix: 'แก้ไขที่กรอกผิด', count: 'นับสต๊อกใหม่', lost: 'สินค้าหาย', broken: 'สินค้าเสีย' };
  var busy = false, cur = null, reason = 'fix';

  function byCode(c) { return S.prods.find(function (p) { return p.code === c; }); }
  function kv(a, b) { return '<div class="kv"><span>' + a + '</span><b>' + b + '</b></div>'; }
  function lname(id) {
    var l = S.locs.find(function (x) { return x.id === id; });
    return l ? esc(l.name) : '';
  }
  function ph(p) {
    return '<div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">' +
      '<div class="th" style="width:64px;height:64px;flex-basis:64px">' + thumb(p) + '</div>' +
      '<div><b>' + esc(p.code) + '</b> ' + esc(p.name) + '</div></div>';
  }

  // ===== แก้ไขสินค้า =====
  function editSheet(code) {
    var p = byCode(code);
    if (!p) return;
    cur = p;
    var img = S.imgs[p.image_path]
      ? '<img src="' + S.imgs[p.image_path] + '" alt="">'
      : ic('cam', 34) + '<span>แตะเพื่อเลือกรูป</span>';
    openSheet(
      head('แก้ไขสินค้า') +
      '<div class="note" style="margin-bottom:12px">รหัส <b>' + esc(p.code) + '</b> และประเภทสินค้า แก้ไขไม่ได้ เพื่อให้ QR เดิมใช้ได้เสมอ</div>' +
      '<label class="ph" id="ephl" for="epf">' + img + '</label>' +
      '<input type="file" id="epf" accept="image/*" style="display:none">' +
      '<label>ชื่อสินค้า<input id="en" value="' + esc(p.name) + '"></label>' +
      '<div class="two"><label>ต้นทุน (บาท)<input id="ec" type="number" inputmode="decimal" min="0" value="' + p.current_cost + '"></label>' +
      '<label>ราคาขายตั้งต้น<input id="ep" type="number" inputmode="decimal" min="0" value="' + p.base_price + '"></label></div>' +
      '<small>การเปลี่ยนต้นทุนมีผลกับการขายครั้งต่อไปเท่านั้น ยอดขายและกำไรเก่าไม่เปลี่ยน</small>' +
      '<label style="margin-top:10px">รายละเอียดเพิ่มเติม<textarea id="ed" rows="2">' + esc(p.description || '') + '</textarea></label>' +
      '<h3 style="margin-top:6px">ไซส์ / ลาย</h3>' +
      (p.variants || []).map(function (v) {
        return '<div class="two"><input class="evs" data-v="' + v.id + '" value="' + esc(v.size || '') + '" placeholder="ไซส์">' +
          '<input class="evp" data-v="' + v.id + '" value="' + esc(v.pattern || '') + '" placeholder="ลาย/สี"></div>';
      }).join('') +
      '<div class="err" id="eer"></div><button class="btn" id="ego" data-a="esave">บันทึกการแก้ไข</button>'
    );
    $('epf').onchange = function (e) {
      var f = e.target.files[0];
      if (f) $('ephl').innerHTML = '<img src="' + URL.createObjectURL(f) + '" alt="">';
    };
  }

  A.esave = async function () {
    if (busy) return;
    var p = cur, er = function (m) { $('eer').textContent = m; };
    var name = $('en').value.trim(), price = parseFloat($('ep').value), cost = parseFloat($('ec').value);
    if (!name || isNaN(price) || isNaN(cost) || price < 0 || cost < 0) return er('ตรวจสอบชื่อ ราคา และต้นทุน');
    er('');

    var patch = {};
    if (name !== p.name) patch.name = name;
    var d = $('ed').value.trim() || null;
    if (d !== (p.description || null)) patch.description = d;
    if (price !== Number(p.base_price)) patch.base_price = price;
    var costChanged = cost !== Number(p.current_cost);
    if (costChanged) patch.current_cost = cost;

    var vch = [];
    (p.variants || []).forEach(function (v) {
      var s = document.querySelector('.evs[data-v="' + v.id + '"]');
      var t = document.querySelector('.evp[data-v="' + v.id + '"]');
      if (!s || !t) return;
      var ns = s.value.trim(), np = t.value.trim();
      if (ns !== (v.size || '') || np !== (v.pattern || '')) vch.push({ id: v.id, size: ns || null, pattern: np || null });
    });

    var f = $('epf').files[0];
    if (!Object.keys(patch).length && !vch.length && !f) {
      detail(p.code);
      return toast('ไม่มีการเปลี่ยนแปลง');
    }
    if (costChanged && !confirm('เปลี่ยนต้นทุนเป็น ฿' + fmt(cost) + ' ?\nใช้กับการขายหลังจากนี้เท่านั้น ยอดขายและกำไรเก่าไม่เปลี่ยน (เก็บประวัติต้นทุนเดิมไว้)')) return;
    if (price < cost && !confirm('ราคาขายต่ำกว่าต้นทุน ยืนยันบันทึก?')) return;

    var btn = $('ego');
    busy = true; btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    try {
      if (f) {
        var path = S.uid + '/' + Date.now() + '.jpg';
        var up = await S.sb.storage.from('product-images').upload(path, await shrink(f), { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
        patch.image_path = path;
      }
      if (Object.keys(patch).length) {
        var r = await S.sb.from('products').update(patch).eq('id', p.id).select('id');
        if (r.error) throw r.error;
        if (!r.data || !r.data.length) throw new Error('บันทึกไม่สำเร็จ');
      }
      for (var i = 0; i < vch.length; i++) {
        var r2 = await S.sb.from('variants').update({ size: vch[i].size, pattern: vch[i].pattern }).eq('id', vch[i].id).select('id');
        if (r2.error) throw r2.error;
      }
      await load();
      busy = false;
      detail(p.code);
      toast('บันทึกการแก้ไขแล้ว');
    } catch (e) {
      busy = false; btn.disabled = false; btn.textContent = 'บันทึกการแก้ไข';
      er(/duplicate|unique/i.test(e.message || '') ? 'มีไซส์/ลายซ้ำกับรุ่นอื่นในสินค้านี้' : 'บันทึกไม่สำเร็จ: ' + (e.message || e));
      load();
    }
  };

  // ===== ปรับจำนวนสต๊อก =====
  function acv() { return (cur.variants || []).find(function (v) { return v.id === $('av').value; }); }

  function asum() {
    var v = acv(), loc = $('al').value, have = lq(v, loc), q = parseInt($('aq').value);
    var bad = (isNaN(q) || q < 0) ? 'ใส่จำนวนตั้งแต่ 0 ขึ้นไป' : (q === have ? 'จำนวนเท่าเดิม ยังไม่มีอะไรเปลี่ยน' : '');
    $('aer').textContent = bad;
    $('ago').disabled = !!bad;
    if (bad) { $('asum').innerHTML = ''; return; }
    var dl = q - have;
    $('asum').innerHTML =
      kv('ในระบบตอนนี้', have + ' ชิ้น') +
      kv('หลังปรับ', q + ' ชิ้น (' + (dl > 0 ? '+' : '') + dl + ')') +
      kv('รวมรุ่นนี้', vq(v) + ' → ' + (vq(v) - have + q));
  }

  function adjSheet(code) {
    var p = byCode(code);
    if (!p) return;
    var vs = p.variants || [];
    if (!vs.length) return toast('สินค้านี้ไม่มีรุ่นย่อย');
    cur = p; reason = 'fix';
    openSheet(
      head('ปรับจำนวนสต๊อก') + ph(p) +
      '<div class="note" style="margin-bottom:12px">ใช้แก้จำนวนที่กรอกผิดหรือนับสต๊อกใหม่ ระบบเก็บประวัติทุกครั้ง ถ้าเป็นการย้ายของระหว่างสถานที่ ให้ใช้ปุ่ม "ย้ายสินค้า"</div>' +
      '<label>ไซส์ / ลาย<select id="av">' + vs.map(function (v) {
        return '<option value="' + v.id + '">' + esc(vname(v)) + ' (รวม ' + vq(v) + ')</option>';
      }).join('') + '</select></label>' +
      '<label>สถานที่<select id="al">' + S.locs.map(function (l) {
        return '<option value="' + l.id + '">' + esc(l.name) + '</option>';
      }).join('') + '</select></label>' +
      '<div class="lb">จำนวนที่นับได้จริง</div>' +
      '<div class="stp"><button type="button" class="sbn" data-a="astp" data-v="-1" aria-label="ลด">' + ic('minus', 26) + '</button>' +
      '<input id="aq" type="number" inputmode="numeric" min="0" value="0">' +
      '<button type="button" class="sbn" data-a="astp" data-v="1" aria-label="เพิ่ม">' + ic('plus', 26) + '</button></div>' +
      '<div class="lb">เหตุผล</div><div class="rch">' + Object.keys(RS).map(function (k) {
        return '<button type="button" class="chip ' + (k === reason ? 'on' : '') + '" data-a="areason" data-v="' + k + '">' + RS[k] + '</button>';
      }).join('') + '</div>' +
      '<div class="sm" id="asum"></div><div class="err" id="aer"></div>' +
      '<button class="btn" id="ago" data-a="ago">ยืนยันการปรับจำนวน</button>'
    );
    var re = function () { $('aq').value = lq(acv(), $('al').value); asum(); };
    $('av').onchange = re; $('al').onchange = re; $('aq').oninput = asum;
    re();
  }
  A.astp = function (v) {
    var i = $('aq');
    i.value = Math.max(0, (parseInt(i.value) || 0) + parseInt(v));
    asum();
  };
  A.areason = function (v) {
    reason = v;
    document.querySelectorAll('.rch .chip').forEach(function (c) { c.classList.toggle('on', c.dataset.v === v); });
  };
  A.ago = async function () {
    if (busy) return;
    var btn = $('ago');
    if (btn.disabled) return;
    var v = acv(), loc = $('al').value, have = lq(v, loc), q = parseInt($('aq').value), code = cur.code;
    if (!confirm('ปรับ ' + vname(v) + ' ที่ ' + (S.locs.find(function (l) { return l.id === loc; }) || {}).name +
      '\nจาก ' + have + ' เป็น ' + q + ' ชิ้น ใช่หรือไม่?')) return;
    busy = true; btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    var r = await S.sb.rpc('adjust_stock', { p_variant_id: v.id, p_location_id: loc, p_new_qty: q, p_reason: RS[reason] });
    busy = false;
    if (r.error) {
      btn.disabled = false; btn.textContent = 'ยืนยันการปรับจำนวน';
      $('aer').textContent = 'ปรับไม่สำเร็จ: ' + r.error.message;
      return;
    }
    await load();
    detail(code);
    toast('ปรับจำนวนแล้ว ' + have + ' → ' + q);
  };

  // ===== ยกเลิกการขาย =====
  A.vsale = async function (v) {
    if (busy) return;
    var a = v.split('|');
    if (!confirm('ยกเลิกรายการขายนี้?\nสินค้าจะคืนเข้าสต๊อกที่เดิม และไม่นับเป็นยอดขาย (ยังเก็บประวัติไว้)')) return;
    busy = true;
    var r = await S.sb.rpc('void_sale', { p_sale_id: a[0], p_reason: 'กดผิด/ลงผิด' });
    busy = false;
    if (r.error) return toast('ยกเลิกไม่สำเร็จ: ' + r.error.message);
    await load();
    detail(a[1]);
    toast('ยกเลิกการขายแล้ว คืนสินค้าเข้าสต๊อกแล้ว');
  };

  A.eopen = function (v) { editSheet(v); };
  A.aopen = function (v) { adjSheet(v); };

  // ===== เพิ่มปุ่มและประวัติการขายในหน้าสินค้า =====
  var _d = detail;
  detail = function (code) {
    _d(code);
    var p = byCode(code), b = $('sbody');
    if (!p || !b) return;
    var anchor = Array.prototype.find.call(b.querySelectorAll('h3'), function (h) {
      return h.textContent === 'เปลี่ยนสถานะ';
    });
    if (anchor) {
      anchor.insertAdjacentHTML('beforebegin',
        '<h3 style="margin-top:14px">แก้ไขข้อมูล</h3><div class="btns">' +
        '<button class="btn o" data-a="eopen" data-v="' + esc(code) + '">' + ic('edit', 22) + ' แก้ไขสินค้า</button>' +
        '<button class="btn o" data-a="aopen" data-v="' + esc(code) + '">' + ic('sliders', 22) + ' ปรับจำนวน</button></div>');
    }
    var all = b.querySelectorAll('.btns'), last = all[all.length - 1];
    if (!last) return;
    last.insertAdjacentHTML('beforebegin', '<div id="shist" data-c="' + esc(code) + '"></div>');
    S.sb.from('sales')
      .select('id,qty,unit_price,unit_cost,created_at,voided_at,variants(size,pattern),locations(name)')
      .eq('product_id', p.id).order('created_at', { ascending: false }).limit(8)
      .then(function (r) {
        var el = $('shist');
        if (!el || el.dataset.c !== code || r.error || !r.data || !r.data.length) return;
        el.innerHTML = '<h3 style="margin-top:14px">ประวัติการขายล่าสุด</h3>' + r.data.map(function (s) {
          var tot = Number(s.unit_price) * s.qty, vo = !!s.voided_at;
          var dt = new Date(s.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
          return '<div class="kv" style="align-items:flex-start;' + (vo ? 'opacity:.55' : '') + '"><span>' + dt +
            '<br><small>' + esc(vname(s.variants || {})) + ' · ' + esc((s.locations || {}).name || '') + ' · ×' + s.qty + '</small></span>' +
            '<span style="text-align:right">' + (vo
              ? '<s>฿' + fmt(tot) + '</s><br><small>ยกเลิกแล้ว</small>'
              : '<b>฿' + fmt(tot) + '</b><br><button class="vbtn" data-a="vsale" data-v="' + s.id + '|' + esc(code) + '">ยกเลิกการขาย</button>') +
            '</span></div>';
        }).join('');
      });
  };
})();
