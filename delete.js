(function () {
  Object.assign(I, {
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'
  });

  var css = document.createElement('style');
  css.textContent =
    '.dng{color:var(--red)!important;border:2px solid var(--red)!important;background:transparent!important}' +
    '.dsm{padding:10px 14px;border:2px solid var(--red);border-radius:10px;color:var(--red);font-weight:700;font-size:.95rem}' +
    '.dimp{background:var(--bg);border-radius:14px;padding:6px 12px;margin:10px 0}' +
    '.dsep{border-top:2px solid var(--line);margin:16px 0 8px}';
  document.head.appendChild(css);

  var KIND = { repair: 'ค่าซ่อม', equipment: 'ค่าอุปกรณ์', labor: 'ค่าช่าง', other: 'อื่น ๆ' };
  var busy = false, ctx = null, props = [];

  function kv(a, b) { return '<div class="kv"><span>' + a + '</span><b>' + b + '</b></div>'; }
  function dbtn(act, val, label) {
    return '<button class="btn o dng" data-a="' + act + '" data-v="' + val + '">' + ic('trash', 20) + ' ' + label + '</button>';
  }
  async function rpc(fn, args) {
    var r = await S.sb.rpc(fn, args);
    if (r.error) throw r.error;
    return r.data;
  }
  function gname() { var h = $('sbody').querySelector('h2'); return h ? h.textContent : ''; }
  function rdone(msg) { closeSheet(); if (A.rreload) A.rreload(); toast(msg); }

  // ยืนยันขั้นที่สอง: ต้องพิมพ์คำว่า "ลบ"
  function forceSheet(title, warn, rows, c) {
    ctx = c;
    openSheet(
      head(title) +
      '<div class="note" style="margin-bottom:10px;color:var(--red)">' + warn + '</div>' +
      '<div class="dimp">' + rows + '</div>' +
      '<label>พิมพ์คำว่า <b>ลบ</b> เพื่อยืนยัน<input id="dtx" autocomplete="off"></label>' +
      '<div class="err" id="der"></div>' +
      '<button class="btn o dng" id="dgo" data-a="dforce" disabled>ลบถาวร</button>' +
      '<button class="btn o" data-a="close">ยกเลิก</button>'
    );
    $('dtx').oninput = function () { $('dgo').disabled = $('dtx').value.trim() !== 'ลบ'; };
  }
  A.dforce = async function () {
    if (busy || !ctx || $('dtx').value.trim() !== 'ลบ') return;
    busy = true; $('dgo').disabled = true;
    try {
      var d = await rpc(ctx.fn, Object.assign({}, ctx.args, { p_force: true }));
      busy = false;
      await ctx.after(d);
    } catch (e) {
      busy = false; $('dgo').disabled = false;
      $('der').textContent = 'ลบไม่สำเร็จ: ' + (e.message || e);
    }
  };

  // ขั้นตอนทั่วไป: ถามยืนยัน -> ลบ -> ถ้ามีประวัติเงินให้ยืนยันอีกชั้น
  async function del(o) {
    if (busy || !confirm(o.confirm)) return;
    busy = true;
    try {
      var d = await rpc(o.fn, Object.assign({ p_force: false }, o.args));
      busy = false;
      if (d.deleted) return o.after(d);
      forceSheet(o.title, o.warn, o.rows(d), { fn: o.fn, args: o.args, after: o.after });
    } catch (e) {
      busy = false;
      toast('ลบไม่สำเร็จ: ' + (e.message || e));
    }
  }

  // ===== สินค้า =====
  async function pdone(d) {
    if (d.image_path) {
      try { await S.sb.storage.from('product-images').remove([d.image_path]); } catch (e) {}
    }
    closeSheet();
    await load();
    toast('ลบสินค้า ' + d.code + ' แล้ว');
  }
  A.pdel = function (code) {
    var p = S.prods.find(function (x) { return x.code === code; });
    if (!p) return;
    var qty = pq(p);
    return del({
      fn: 'delete_product', args: { p_product_id: p.id },
      confirm: 'ลบสินค้า ' + p.code + ' ' + p.name + ' ?\n' +
        (qty ? 'สต๊อกที่เหลือ ' + qty + ' ชิ้นจะหายไปด้วย\n' : '') +
        'รหัสนี้จะไม่ถูกนำกลับมาใช้อีก และลบแล้วกู้คืนไม่ได้',
      title: 'ลบสินค้าที่มียอดขาย',
      warn: 'สินค้านี้มียอดขายแล้ว ถ้าลบ ยอดขายเหล่านี้จะหายถาวร รายได้และกำไรย้อนหลังจะเปลี่ยน ถ้าแค่เลิกขาย แนะนำให้เปลี่ยนสถานะเป็น "หมด/เลิกจำหน่าย" (สีดำ) แทน',
      rows: function (d) {
        return kv('ยอดขาย', d.sales + ' รายการ') + kv('รวมรายรับ (ไม่นับที่ยกเลิก)', '฿' + fmt(d.revenue)) +
          kv('สต๊อกคงเหลือ', d.stock + ' ชิ้น');
      },
      after: pdone
    });
  };

  // ===== ห้อง / สัญญา =====
  A.dunit = function (id) {
    var nm = gname();
    return del({
      fn: 'delete_unit', args: { p_unit_id: id },
      confirm: 'ลบห้อง "' + nm + '" ?\nลบแล้วกู้คืนไม่ได้',
      title: 'ลบห้องที่มีประวัติ',
      warn: 'ห้อง ' + esc(nm) + ' มีข้อมูลการเงินอยู่ ถ้าลบ ข้อมูลเหล่านี้จะหายถาวร และรายได้ค่าเช่าที่ใช้คำนวณภาษีจะลดลง',
      rows: function (d) {
        return kv('สัญญาเช่า', d.leases + ' รายการ') +
          kv('ค่าเช่าที่รับแล้ว', d.paid_rows + ' งวด · ฿' + fmt(d.income)) +
          kv('รายการค่าซ่อมบำรุง', d.costs + ' รายการ · ฿' + fmt(d.cost_total));
      },
      after: function () { return rdone('ลบห้องแล้ว'); }
    });
  };
  A.dlease = function (id) {
    var nm = gname();
    return del({
      fn: 'delete_lease', args: { p_lease_id: id },
      confirm: 'ลบสัญญาเช่าของห้อง "' + nm + '" ?\nใช้เมื่อทำสัญญาผิด ผู้เช่าและงวดค่าเช่าของสัญญานี้จะถูกลบ ห้องจะกลับเป็น "ห้องว่าง"\nลบแล้วกู้คืนไม่ได้',
      title: 'ลบสัญญาที่รับเงินแล้ว',
      warn: 'สัญญานี้มีการรับค่าเช่าแล้ว ถ้าลบ รายได้ค่าเช่าส่วนนี้จะหายถาวร',
      rows: function (d) { return kv('ค่าเช่าที่รับแล้ว', d.paid_rows + ' งวด · ฿' + fmt(d.income)); },
      after: function () { return rdone('ลบสัญญาแล้ว ห้องกลับเป็นห้องว่าง'); }
    });
  };

  // ===== ค่าซ่อมบำรุงทีละรายการ =====
  A.dcosts = async function (uid) {
    var r = await S.sb.from('unit_costs').select('id,kind,amount,paid_on,note')
      .eq('unit_id', uid).order('paid_on', { ascending: false });
    if (r.error) return toast('โหลดรายการไม่สำเร็จ');
    openSheet(head('รายการค่าซ่อมบำรุง') + (r.data.length ? r.data.map(function (c) {
      return '<div class="row"><div class="gr"><b>' + (KIND[c.kind] || '') + ' ฿' + fmt(c.amount) + '</b><br><small>' +
        esc(c.paid_on) + (c.note ? ' · ' + esc(c.note) : '') + '</small></div>' +
        '<button class="dsm" data-a="dcost" data-v="' + c.id + '|' + uid + '">ลบ</button></div>';
    }).join('') : '<div class="empty">ไม่มีรายการ</div>'));
  };
  A.dcost = async function (v) {
    if (busy) return;
    var a = v.split('|');
    if (!confirm('ลบรายการค่าซ่อมนี้?\nลบแล้วกู้คืนไม่ได้')) return;
    busy = true;
    try {
      await rpc('delete_unit_cost', { p_id: a[0] });
      busy = false;
      if (A.rreload) A.rreload();
      toast('ลบรายการแล้ว');
      A.dcosts(a[1]);
    } catch (e) {
      busy = false;
      toast('ลบไม่สำเร็จ: ' + (e.message || e));
    }
  };

  // ===== ตึก =====
  A.dprops = async function () {
    var r = await S.sb.from('properties').select('id,name,units(id)').order('created_at');
    if (r.error) return toast('โหลดรายการตึกไม่สำเร็จ');
    props = r.data;
    openSheet(head('ลบตึก') + (props.length ? props.map(function (p) {
      return '<div class="row"><div class="gr"><b>' + esc(p.name) + '</b><br><small>' + (p.units || []).length +
        ' ห้อง</small></div><button class="dsm" data-a="dprop" data-v="' + p.id + '">ลบ</button></div>';
    }).join('') : '<div class="empty">ยังไม่มีตึก</div>'));
  };
  A.dprop = function (id) {
    var p = props.find(function (x) { return x.id === id; });
    if (!p) return;
    return del({
      fn: 'delete_property', args: { p_property_id: id },
      confirm: 'ลบตึก "' + p.name + '" ?\nลบแล้วกู้คืนไม่ได้',
      title: 'ลบตึกที่มีห้อง',
      warn: 'ตึก ' + esc(p.name) + ' ยังมีห้องอยู่ ถ้าลบ ห้อง ผู้เช่า สัญญา ค่าเช่า และค่าซ่อมทั้งหมดของตึกนี้จะหายถาวร รายได้ค่าเช่าที่ใช้คำนวณภาษีจะลดลง',
      rows: function (d) { return kv('จำนวนห้อง', d.units + ' ห้อง') + kv('สัญญาเช่า', d.leases + ' รายการ'); },
      after: function () { return rdone('ลบตึกแล้ว'); }
    });
  };

  // ===== ใส่ปุ่มลบเข้าไปในหน้าจอเดิม =====
  var _d = detail;
  detail = function (code) {
    _d(code);
    var b = $('sbody');
    if (!b || !S.prods.some(function (x) { return x.code === code; })) return;
    b.insertAdjacentHTML('beforeend', '<div class="dsep"></div>' + dbtn('pdel', esc(code), 'ลบสินค้านี้'));
  };

  var _os = openSheet;
  openSheet = function (h) {
    _os(h);
    var b = $('sbody');
    if (!b) return;
    var e = b.querySelector('button[data-a="redu"]');
    if (e && !b.querySelector('[data-a="dunit"]')) {
      var id = e.dataset.v;
      e.insertAdjacentHTML('afterend', '<div class="dsep"></div><h3 style="color:var(--red)">ลบข้อมูล</h3>' +
        dbtn('dcosts', id, 'จัดการ / ลบรายการค่าซ่อม') + dbtn('dunit', id, 'ลบห้องนี้'));
    }
    var n = b.querySelector('button[data-a="rend"]');
    if (n && !b.querySelector('[data-a="dlease"]')) {
      n.insertAdjacentHTML('afterend', dbtn('dlease', n.dataset.v, 'ลบสัญญานี้ (ทำผิด)'));
    }
  };

  var _r = render;
  render = function () {
    _r();
    if (S.cur !== 'rent') return;
    var v = $('view'), b = v && v.querySelector('[data-a="raddp"]');
    if (b && !v.querySelector('[data-a="dprops"]')) {
      b.parentNode.insertAdjacentHTML('afterend',
        '<button class="btn o dng" style="margin:0 0 12px" data-a="dprops">' + ic('trash', 20) + ' ลบตึก</button>');
    }
  };
})();
