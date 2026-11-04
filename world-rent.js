/* ============================================================
   world-rent.js — ตึกเช่าจากหน้า "อสังหาเช่า" ไปโผล่บนแมพเมือง
   - ตึก (properties) แต่ละหลังได้แปลงว่างในเมืองตามลำดับที่เพิ่ม (อาคาร #1, #2, …)
   - ความสูงตามจำนวนห้อง · สีแถบบอกสถานะ: เขียว=ปกติ เหลือง=มีห้องว่าง แดง=มีค้างจ่าย
   - แตะตึก → ผู้เช่า ห้องว่าง ค้างจ่าย ค่างวดครั้งต่อไป + แถวนี้มีอะไร (รร. รพ. ห้าง สถานี …)
   - เดินชนตึกไม่ได้ · ประตูกระจกหน้าตึกเลื่อนเปิดเองเมื่อเดินเข้าใกล้
   ลำดับโหลด: หลัง world-city.js / world-ui.js (ใส่ท้าย index.html)
   ============================================================ */
(function () {
  'use strict';
  var W = window.SSW = window.SSW || {};
  var T = null, G = null, TAGS = [], DOORS = [], sig = '', pop = null, COLS = {}, colVer = -1;

  var POI_IC = { school: '🏫', hosp: '🏥', mall: '🛍️', market: '🧺', temple: '🛕', park: '🌳', stadium: '🏟️', station: '🚉', landmark: '🗼' };
  var POI_TH = { school: 'โรงเรียน', hosp: 'โรงพยาบาล', mall: 'ห้าง', market: 'ตลาด', temple: 'วัด/ศาลเจ้า', park: 'สวน', stadium: 'สนามกีฬา', station: 'สถานีรถไฟฟ้า', landmark: 'แลนด์มาร์ก' };
  var UST = { occupied: ['มีผู้เช่า', '#16a34a'], vacant: ['ห้องว่าง', '#d97706'], maintenance: ['ซ่อมบำรุง', '#64748b'] };

  function X() { return window.SSRent; }
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function F(n) { return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 }); }

  /* ---------- สรุปข้อมูลตึก ---------- */
  function summary(p) {
    var x = X(), R = x.R, td = x.today();
    var units = R.units.filter(function (u) { return u.property_id === p.id; });
    var s = { p: p, units: units, occ: 0, vac: 0, mnt: 0, over: 0, overAmt: 0, next: null, rooms: [] };
    units.forEach(function (u) {
      if (u.status === 'occupied') s.occ++; else if (u.status === 'maintenance') s.mnt++; else s.vac++;
      var l = R.leases.find(function (q) { return q.unit_id === u.id && q.status === 'active'; });
      var room = { u: u, l: l, tenant: l && l.tenants ? l.tenants.name : '', st: null, over: 0, overAmt: 0 };
      if (l) {
        var rows = x.rowsOf(l.id);
        rows.forEach(function (r) {
          if (!(r._left > 0)) return;
          var d = x.eff(r);
          if (d < td) { room.over++; room.overAmt += r._left; }
          else if (!s.next || d < s.next.d) s.next = { d: d, amt: r._left, room: u.name, tenant: room.tenant };
        });
        try { room.st = x.cur(l); } catch (e) {}
      }
      if (room.over) { s.over++; s.overAmt += room.overAmt; }
      s.rooms.push(room);
    });
    s.level = s.over ? 'r' : s.vac ? 'a' : 'g';
    return s;
  }
  function lotOf(i) { return (W.RENT_LOTS || [])[i]; }
  function props() {
    var R = X().R;
    return R.props.slice().sort(function (a, b) { return String(a.created_at || '') < String(b.created_at || '') ? -1 : 1; });
  }

  /* ---------- พื้นผิวตึก ---------- */
  var TEX = {};
  function facadeTex(wall) {
    if (TEX[wall]) return TEX[wall];
    var c = document.createElement('canvas'); c.width = 256; c.height = 256; var g = c.getContext('2d');
    g.fillStyle = wall; g.fillRect(0, 0, 256, 256);
    for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) {
      var lit = Math.random() < .45;
      var gr = g.createLinearGradient(0, y * 64 + 12, 0, y * 64 + 52);
      gr.addColorStop(0, lit ? '#fff3c4' : '#9fc3d6'); gr.addColorStop(1, lit ? '#f5d27a' : '#5f86a0');
      g.fillStyle = gr; g.fillRect(x * 64 + 10, y * 64 + 12, 44, 40);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x * 64 + 10, y * 64 + 12, 44, 4);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x * 64 + 8, y * 64 + 52, 48, 3);
    }
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; TEX[wall] = t; return t;
  }
  function labelTex(txt, sub, bg) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 160; var g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 160); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, 0, 512, 12);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 64px "Noto Sans Thai",system-ui,sans-serif'; g.fillText(txt, 256, 66, 490);
    g.font = '32px "Noto Sans Thai",system-ui,sans-serif'; g.fillText(sub, 256, 124, 490);
    var t = new T.CanvasTexture(c); return t;
  }
  var LV = { g: '#16a34a', a: '#d97706', r: '#dc2626' };

  /* ---------- สร้างตึก ---------- */
  function clear() {
    if (G) { G.traverse(function (o) { if (!o.isMesh) return; o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { if (m.map && !Object.keys(TEX).some(function (k) { return TEX[k] === m.map; })) m.map.dispose(); m.dispose(); }); }); if (G.parent) G.parent.remove(G); }
    if (W.EX && W.EX.pick) W.EX.pick = W.EX.pick.filter(function (o) { return !o.userData.rentBld; });
    TAGS.forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
    if (W.tags) for (var i = W.tags.length - 1; i >= 0; i--) if (TAGS.indexOf(W.tags[i].el) >= 0) W.tags.splice(i, 1);
    TAGS = []; DOORS = []; G = null;
  }
  function box(w, h, d, mat, x, y, z) { var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; return m; }
  function lambert(o) { return new T.MeshLambertMaterial(o); }

  function building(p, i, lot) {
    var s = summary(p), cx = (lot.x0 + lot.x1) / 2, cz = (lot.z0 + lot.z1) / 2;
    var w = Math.min(lot.x1 - lot.x0 - 16, 30), d = Math.min(lot.z1 - lot.z0 - 18, 20);
    var floors = Math.max(2, Math.min(18, Math.ceil((s.units.length || 4) / 4))), fh = 3.6, h = floors * fh + 1.5;
    var g = new T.Group(); g.position.set(cx, 0, cz);
    var walls = ['#f5f1ea', '#e8eef5', '#f3e8de', '#e6efe9', '#efe7f5'], wall = walls[i % walls.length];
    var ft = facadeTex(wall).clone(); ft.needsUpdate = true; ft.repeat.set(Math.max(2, Math.round(w / 3.4)) / 4, floors / 4);
    var fside = facadeTex(wall).clone(); fside.needsUpdate = true; fside.repeat.set(Math.max(2, Math.round(d / 3.4)) / 4, floors / 4);
    var plain = lambert({ color: wall });
    var mats = [lambert({ map: fside }), lambert({ map: fside }), plain, plain, lambert({ map: ft }), lambert({ map: ft })];
    var tower = new T.Mesh(new T.BoxGeometry(w, floors * fh, d), mats); tower.position.y = 1.5 + floors * fh / 2; tower.castShadow = tower.receiveShadow = true; g.add(tower);
    // ชั้นล่าง (ล็อบบี้) + ประตูกระจก
    g.add(box(w + 1, 1.5, d + 1, lambert({ color: '#cfd6dd' }), 0, 0, 0));
    var lobby = box(w - .2, 3.2, .3, lambert({ color: '#1f2937', transparent: true, opacity: .55 }), 0, 1.5, d / 2 + .05); g.add(lobby);
    var dmat = lambert({ color: '#9ed8f0', transparent: true, opacity: .6 });
    var dl = box(1.4, 2.8, .12, dmat, -.7, 1.5, d / 2 + .25), dr = box(1.4, 2.8, .12, dmat, .7, 1.5, d / 2 + .25);
    g.add(dl, dr); g.add(box(3.4, .3, .2, lambert({ color: '#475569' }), 0, 4.3, d / 2 + .25));
    DOORS.push({ l: dl, r: dr, x: cx, z: cz + d / 2 + 1.5, o: 0 });
    W.rentPlaced.push({ id: p.id, name: p.name, n: i + 1, x: cx, z: cz, dx: cx, dz: cz + d / 2 + 2.5, floors: floors, level: s.level, over: s.over, vac: s.vac });
    // แถบสีสถานะ + ป้ายชื่อ
    var lv = LV[s.level];
    g.add(box(w + .6, .5, d + .6, lambert({ color: '#9aa4b1' }), 0, h, 0));
    var lm = lambert({ color: lv, emissive: lv, emissiveIntensity: .35 });
    g.add(box(w + .8, .5, .5, lm, 0, h + .3, d / 2 + .3), box(w + .8, .5, .5, lm, 0, h + .3, -d / 2 - .3), box(.5, .5, d + .8, lm, w / 2 + .3, h + .3, 0), box(.5, .5, d + .8, lm, -w / 2 - .3, h + .3, 0));
    g.add(box(1.2, 2.4, 1.2, lambert({ color: '#cbd5e1' }), w / 2 - 3, h + .5, -d / 2 + 3));
    var sh = 3.2, sw = Math.min(w - 2, 13);
    var sg = new T.Mesh(new T.PlaneGeometry(sw, sh), new T.MeshBasicMaterial({ map: labelTex(p.name, 'อาคาร #' + (i + 1), lv) }));
    sg.position.set(0, Math.max(6.2, h - 2.4), d / 2 + .08); g.add(sg);
    var sg2 = sg.clone(); sg2.rotation.y = Math.PI; sg2.position.z = -d / 2 - .08; g.add(sg2);
    // ป้ายยืนหน้าตึก
    g.add(box(.3, 2.4, .3, lambert({ color: '#64748b' }), w / 2 - 1, 0, d / 2 + 4));
    g.userData = { k: 'rent:' + p.id, rentBld: true };
    g.traverse(function (o) { o.userData.k = 'rent:' + p.id; o.userData.rentBld = true; });
    G.add(g);
    if (W.EX && W.EX.pick) W.EX.pick.push(g);
    if (colVer !== W.cityVer) { colVer = W.cityVer; COLS = {}; }
    var ck = lot.key + ':' + w + 'x' + d;
    if (W.cityCol && !COLS[ck]) { COLS[ck] = 1; W.cityCol(cx, cz, w + 1, d + 1); }
    // ป้ายลอยแบบตึกร้าน
    var wd = document.getElementById('wd');
    if (wd && W.tagAdd) {
      var e = document.createElement('div'); e.className = 'wtag wb';
      var st = s.over ? '🔴 ค้าง ' + s.over + ' ห้อง' : s.vac ? '🟡 ว่าง ' + s.vac + ' ห้อง' : '🟢 เต็ม';
      e.innerHTML = '<i style="background:' + lv + '22">🏢</i>' + E(p.name) + ' <small>' + st + '</small>';
      wd.appendChild(e); W.tagAdd(e, g, h + 3, 'ext'); TAGS.push(e);
    }
    return s;
  }
  function emptyLot(lot, i) {
    var cx = (lot.x0 + lot.x1) / 2, cz = (lot.z0 + lot.z1) / 2;
    var post = box(.25, 2, .25, lambert({ color: '#94a3b8' }), cx, 0, cz + 6); G.add(post);
    var sg = new T.Mesh(new T.PlaneGeometry(5, 1.6), new T.MeshBasicMaterial({ map: labelTex('ที่ว่าง #' + (i + 1), 'รอตึกใหม่จากหน้าอสังหา', '#64748b') }));
    sg.position.set(cx, 2.6, cz + 6.15); G.add(sg);
  }

  function rebuild() {
    clear();
    var sc = W.EXS; if (!sc || !T || !W.RENT_LOTS) return;
    G = new T.Group(); G.name = 'rentals'; sc.add(G);
    var list = props(), lots = W.RENT_LOTS, seen = {}; W.rentPlaced = [];
    try { seen = JSON.parse(localStorage.getItem('ss_rentmap_seen') || '{}'); } catch (e) {}
    var fresh = [];
    lots.forEach(function (lot, i) {
      var p = list[i];
      if (p) { building(p, i, lot); if (!seen[p.id]) { fresh.push(p.name + ' → อาคาร #' + (i + 1)); seen[p.id] = 1; } }
      else emptyLot(lot, i);
    });
    try { localStorage.setItem('ss_rentmap_seen', JSON.stringify(seen)); } catch (e) {}
    if (fresh.length && Object.keys(seen).length > fresh.length && window.toast) toast('🏢 เพิ่มตึกใหม่บนแมพ: ' + fresh.join(', '));
    if (list.length > lots.length && window.toast) toast('แมพมีแปลงว่าง ' + lots.length + ' แปลง ตึกที่เกินจะยังไม่แสดง');
  }

  /* ---------- หน้าต่างรายละเอียด ---------- */
  function nearby(x, z) {
    var best = {};
    (W.POI || []).forEach(function (q) { var dd = Math.hypot(q.x - x, q.z - z); if (!best[q.t] || dd < best[q.t].d) best[q.t] = { d: dd, n: q.n }; });
    return Object.keys(best).sort(function (a, b) { return best[a].d - best[b].d; }).filter(function (k) { return best[k].d < 520; }).slice(0, 6)
      .map(function (k) { var dd = best[k].d, walk = Math.max(1, Math.round(dd / 80)); return '<span class="wrn">' + POI_IC[k] + ' ' + POI_TH[k] + ' ~' + Math.round(dd / 10) * 10 + ' ม. <small>(เดิน ' + walk + ' นาที)</small></span>'; }).join('');
  }
  function show(id) {
    var x = X(); if (!x || !x.R.loaded) return;
    var list = props(), i = list.findIndex(function (p) { return p.id === id; }); if (i < 0) return;
    var p = list[i], s = summary(p), lot = lotOf(i), td = x.today();
    if (!pop) {
      pop = document.createElement('div'); pop.id = 'wrent';
      (document.getElementById('wd') || document.body).appendChild(pop);
      pop.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      pop.addEventListener('click', function (e) {
        var t = e.target.closest('[data-r]'); if (!t) return;
        if (t.dataset.r === 'x') pop.classList.remove('on');
        if (t.dataset.r === 'go') { pop.classList.remove('on'); if (typeof go === 'function') go('rent'); }
        if (t.dataset.r === 'in') { pop.classList.remove('on'); if (W.enterBuilding) W.enterBuilding(pop.dataset.id); }
      });
    }
    var nx = s.next ? 'ค่างวดครั้งต่อไป <b>' + x.fd(s.next.d) + '</b> · ' + E(s.next.room) + ' ฿' + F(s.next.amt) + ' <small>(อีก ' + x.diff(td, s.next.d) + ' วัน)</small>' : 'ไม่มีค่างวดที่รอจ่าย';
    var rooms = s.rooms.slice().sort(function (a, b) { return (b.over - a.over) || String(a.u.name).localeCompare(String(b.u.name), 'th', { numeric: true }); });
    var rows = rooms.slice(0, 30).map(function (r) {
      var stt = UST[r.u.status] || UST.vacant, extra = '';
      if (r.over) extra = '<span class="wrb" style="background:#dc2626">ค้าง ' + r.over + ' งวด ฿' + F(r.overAmt) + '</span>';
      else if (r.st && r.st.row) extra = '<small>งวด ' + r.st.n + '/' + r.st.total + ' · ' + x.fd(x.eff(r.st.row)) + '</small>';
      return '<div class="wrr"><b>' + E(r.u.name) + '</b><span class="wrb" style="background:' + stt[1] + '">' + stt[0] + '</span>' + (r.tenant ? '<span>' + E(r.tenant) + '</span>' : '') + extra + '</div>';
    }).join('') + (rooms.length > 30 ? '<div class="wrr"><small>…และอีก ' + (rooms.length - 30) + ' ห้อง</small></div>' : '');
    pop.innerHTML = '<div class="wrh"><div><b>🏢 ' + E(p.name) + '</b><small>อาคาร #' + (i + 1) + ' บนแมพ' + (p.address ? ' · ' + E(p.address) : '') + '</small></div><button data-r="x" aria-label="ปิด">✕</button></div>' +
      '<div class="wrk"><div><b>' + s.units.length + '</b><small>ห้องทั้งหมด</small></div><div style="color:#16a34a"><b>' + s.occ + '</b><small>มีผู้เช่า</small></div><div style="color:#d97706"><b>' + s.vac + '</b><small>ห้องว่าง</small></div><div style="color:#dc2626"><b>' + s.over + '</b><small>ค้างจ่าย</small></div></div>' +
      (s.over ? '<div class="wra r">⚠️ ค้างจ่ายรวม ฿' + F(s.overAmt) + '</div>' : '') +
      '<div class="wra">📅 ' + nx + '</div>' +
      (lot ? '<div class="wrs">📍 แถวนี้มี</div><div class="wrp">' + (nearby((lot.x0 + lot.x1) / 2, (lot.z0 + lot.z1) / 2) || '<small>ไม่มีสถานที่สำคัญใกล้ๆ</small>') + '</div>' : '') +
      '<div class="wrs">🚪 ห้องในตึก</div><div class="wrl">' + (rows || '<small>ยังไม่มีห้อง เพิ่มได้ที่หน้าอสังหา</small>') + '</div>' +
      (W.enterBuilding ? '<button class="wrg" data-r="in">🛗 เข้าตึก ขึ้นลิฟต์ดูแต่ละชั้น</button>' : '') + '<button class="wrg" data-r="go" style="background:#64748b">เปิดหน้าอสังหาเช่า</button>';
    pop.dataset.id = p.id; pop.classList.add('on');
    if (lot && W.V && W.V.cam === 'orbit') { W.V.tx = (lot.x0 + lot.x1) / 2 - 6; W.V.tz = (lot.z0 + lot.z1) / 2 + 6; W.V.zoom = Math.max(W.V.zoom || 1, 1.5); }
  }

  /* ---------- ประตูเปิดอัตโนมัติ ---------- */
  function doors(dt) {
    var c = W.pc && W.pc.position; if (!c || !DOORS.length) return;
    var walk = W.V && W.V.cam && W.V.cam !== 'orbit';
    DOORS.forEach(function (d) {
      var near = walk && Math.hypot(c.x - d.x, c.z - d.z) < 6;
      d.o += ((near ? 1 : 0) - d.o) * Math.min(1, dt * 4);
      d.l.position.x = -.7 - d.o * 1.3; d.r.position.x = .7 + d.o * 1.3;
    });
  }

  /* ---------- เริ่มทำงาน ---------- */
  function dataSig() {
    var R = X().R;
    return [W.cityVer, R.props.length, R.props.map(function (p) { return p.id + p.name; }).join(), R.units.map(function (u) { return u.id + u.status; }).join(), R.leases.length,
      R.pays.reduce(function (a, r) { return a + (r._left || 0); }, 0), R.rec.length].join('|');
  }
  var css = document.createElement('style');
  css.textContent = [
    '#wrent{position:absolute;right:10px;top:70px;bottom:90px;width:min(380px,calc(100% - 20px));z-index:9;display:none;flex-direction:column;gap:8px;overflow-y:auto;padding:14px;border-radius:20px;background:var(--g2,rgba(255,255,255,.97));color:var(--text,#0f172a);box-shadow:0 10px 30px rgba(15,23,42,.25);font-size:.95rem}',
    '#wrent.on{display:flex}',
    '#wrent .wrh{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}#wrent .wrh b{font-size:1.15rem;display:block}#wrent .wrh small{color:var(--mut,#64748b)}',
    '#wrent .wrh button{width:40px;height:40px;border-radius:12px;font-size:1.1rem;flex-shrink:0}',
    '#wrent .wrk{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}#wrent .wrk div{background:var(--in,#f1f5f9);border-radius:14px;padding:8px 4px;text-align:center}#wrent .wrk b{display:block;font-size:1.3rem}#wrent .wrk small{font-size:.75rem;color:var(--mut,#64748b)}',
    '#wrent .wra{background:var(--in,#f1f5f9);border-radius:14px;padding:9px 12px;line-height:1.5}#wrent .wra.r{background:#fee2e2;color:#991b1b;font-weight:700}',
    '#wrent .wrs{font-weight:800;margin-top:4px}#wrent .wrp{display:flex;flex-wrap:wrap;gap:6px}#wrent .wrn{background:var(--in,#f1f5f9);border-radius:99px;padding:5px 10px;font-size:.85rem}',
    '#wrent .wrl{display:flex;flex-direction:column;gap:5px}#wrent .wrr{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:7px 10px;border-radius:12px;background:var(--in,#f8fafc)}',
    '#wrent .wrb{color:#fff;border-radius:99px;padding:2px 9px;font-size:.75rem;font-weight:700}',
    '#wrent .wrg{margin-top:4px;padding:12px;border-radius:14px;border:0;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--pri,#2563eb),var(--pri2,#7c3aed))}',
    '@media(max-width:700px){#wrent{top:auto;bottom:80px;max-height:62%;right:8px;left:8px;width:auto}}'
  ].join('');
  document.head.appendChild(css);

  var hooked = false, lastT = performance.now();
  function hook() {
    if (hooked || typeof W.select !== 'function') return;
    var orig = W.select;
    W.select = function (k) {
      if (typeof k === 'string' && k.indexOf('rent:') === 0) { show(k.slice(5)); return; }
      if (pop) pop.classList.remove('on');
      return orig.apply(this, arguments);
    };
    hooked = true;
  }
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    if (G && !document.hidden) doors(dt);
  }
  requestAnimationFrame(loop);
  setInterval(function () {
    T = window.THREE; hook();
    var x = X(); if (!T || !W.EXS || !W.RENT_LOTS || !x) return;
    try { x.ensure(); } catch (e) {}
    if (!x.R.loaded) return;
    var sg = dataSig();
    if (sg !== sig) { sig = sg; rebuild(); }
  }, 1500);
  W.rentShow = show;
})();
