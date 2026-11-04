/* SMART SHOP add-on: world-3d.js  — แมพ 3D ใหม่ (แทน city.js)
   ภายนอก = แมพไอโซเมตริกขาว-ฟ้าเต็มจอ, ตัวละคร = บล็อกสาวผมสี/ริบบิ้น (เลขาผมชมพู)
   ใช้ three.min.js (r128) ในโฟลเดอร์เดียวกัน ไม่พึ่ง CDN
   ส่วนภายใน (ออฟฟิศมืดสไตล์ Sims) อยู่ใน world-int.js, ส่วน UI/ข้อมูล/แชทเลขา อยู่ใน world-ui.js */
(function () {
  'use strict';
  var W = window.SSW = window.SSW || {};
  var CS = 26, RW = 18, RD = 13, RZ = 9;
  W.CS = CS; W.RW = RW; W.RD = RD; W.RZ = RZ;

  /* ---------- ฝ่ายทั้งหมด ---------- */
  W.D = [
    { k: 'acc', n: 'ฝ่ายบัญชี', s: 'บัญชี', ic: '📒', c: 0x22c55e, gx: -1, gz: -1, rc: [0, 0], w: 13, h: 6.5, p: 10, cols: 5, rows: 2,
      staff: [['พี่นุ่น', 'หัวหน้าบัญชี', 0x3b2a1a, 0x86efac], ['น้องเอย', 'ทำบัญชี', 0xb79cff, 0xfde68a], ['พี่โต้ง', 'ตรวจเอกสาร', 0x222233, 0x93c5fd]],
      say: ['ตัวเลขต้องตรงทุกบาทนะคะ', 'ใบเสร็จครบหรือยังคะ', 'ปิดยอดวันนี้แล้วเดี๋ยวรายงานให้', 'กาแฟแก้วที่สามแล้ววันนี้'] },
    { k: 'prod', n: 'ฝ่ายสินค้า', s: 'สินค้า', ic: '👕', c: 0xf97316, gx: 0, gz: -1, rc: [1, 0], w: 13, h: 6, p: 10, cols: 5, rows: 2,
      staff: [['น้องมิกซ์', 'ดูแลสินค้า', 0x7de0c3, 0xfdba74], ['พี่แบม', 'ถ่ายรูปสินค้า', 0xff8fc7, 0xfca5a5], ['น้องกัน', 'ติดป้าย/QR', 0x5b3a29, 0x93c5fd]],
      say: ['ของใหม่เข้าเพียบเลย', 'รหัสสินค้าจำได้หมดนะ', 'ถ่ายรูปชุดนี้สวยมาก', 'ติด QR ครบทุกชิ้นแล้ว'] },
    { k: 'stock', n: 'ฝ่ายคลัง', s: 'คลัง', ic: '📦', c: 0x06b6d4, gx: 1, gz: -1, rc: [2, 0], w: 17, h: 7.5, p: 10, cols: 0, rows: 0,
      staff: [['ลุงชัย', 'หัวหน้าคลัง', 0x9ca3af, 0x67e8f9], ['พี่ต้น', 'นับสต๊อก', 0x222233, 0xfde68a], ['น้องฝน', 'แพ็คของ', 0x7cc3ff, 0xfbcfe8]],
      say: ['ของอยู่ครบ นับเองกับมือ', 'ย้ายของแล้วอย่าลืมบันทึก', 'พาเลทนี้ต้องส่งก่อนเที่ยง', 'ระวังรถโฟล์คลิฟท์ด้วยนะ'] },
    { k: 'sales', n: 'ฝ่ายขาย', s: 'ขาย', ic: '🛒', c: 0xec4899, gx: -1, gz: 0, rc: [3, 0], w: 13, h: 6, p: 10, cols: 4, rows: 2,
      staff: [['พี่เอ', 'หัวหน้าขาย', 0x2b1b12, 0xf9a8d4], ['น้องบีม', 'แคชเชียร์', 0xf3d27a, 0xfecdd3], ['น้องใบเตย', 'ดูแลลูกค้า', 0xb79cff, 0xa5b4fc]],
      say: ['วันนี้ต้องปิดยอดให้ได้ สู้ ๆ', 'ลูกค้ามาเมื่อไหร่ เรียกได้เลย', 'ขายดีสุดวันนี้คือชุดนั้นแหละ', 'ทอนเงินครบนะคะ'] },
    { k: 'rent', n: 'ฝ่ายอสังหา', s: 'อสังหา', ic: '🏢', c: 0x3b82f6, gx: 1, gz: 0, rc: [0, 1], w: 12, h: 10.5, p: 10, cols: 4, rows: 4,
      staff: [['ป้าหมวย', 'ผู้จัดการอสังหา', 0x7c2d12, 0x93c5fd], ['พี่ปั้น', 'เก็บค่าเช่า', 0x222233, 0xbfdbfe], ['น้องแจม', 'ดูแลห้อง', 0xff8fc7, 0xc7d2fe]],
      say: ['ค่าเช่าถึงกำหนดอย่าลืมตามนะ', 'ห้องว่างมีคนสนใจเยอะเลย', 'ดูแลทุกห้องเหมือนบ้านตัวเอง', 'กุญแจชุดนี้ของห้อง 3 นะ'] },
    { k: 'tax', n: 'ฝ่ายภาษี', s: 'ภาษี', ic: '🧾', c: 0xca8a04, gx: -1, gz: 1, rc: [1, 1], w: 13, h: 6.5, p: 10, cols: 4, rows: 2,
      staff: [['อ.ตั้ม', 'ที่ปรึกษาภาษี', 0x374151, 0xfde68a], ['พี่มด', 'เอกสารภาษี', 0x5b3a29, 0xfed7aa], ['น้องฟิล์ม', 'คำนวณ', 0x7de0c3, 0xd9f99d]],
      say: ['วางแผนภาษีล่วงหน้าดีกว่าแก้ทีหลัง', 'เก็บหลักฐานลดหย่อนไว้นะ', 'ตัวเลขนี้เป็นประมาณการ', 'ยื่นจริงเช็คกับสรรพากรด้วย'] },
    { k: 'news', n: 'ฝ่ายข่าว', s: 'ข่าว', ic: '📰', c: 0x64748b, gx: 1, gz: 1, rc: [2, 1], w: 13, h: 7.5, p: 10, cols: 4, rows: 3,
      staff: [['พี่ข่าว', 'บรรณาธิการ', 0x111827, 0xcbd5e1], ['น้องนิว', 'สรุปข่าว', 0xf3d27a, 0xa7f3d0], ['พี่เจน', 'ตรวจแหล่งข่าว', 0xb79cff, 0xddd6fe]],
      say: ['ยังไม่ได้ต่อสายข่าวเลยครับ', 'ไม่แต่งข่าวเองนะ ต้องมีแหล่งจริง', 'รอเชื่อมระบบก่อนนะ'] },
    { k: 'sec', n: 'ฝ่ายเลขา', s: 'เลขา', ic: '🗓️', c: 0xf472b6, gx: 0, gz: 1, rc: [3, 1], w: 13, h: 6, p: 10, cols: 4, rows: 2,
      staff: [['น้องฟ้า', 'เลขา (คุยได้)', 0xff8fc7, 0xf9a8d4], ['พี่ฝ้าย', 'ผู้ช่วยเลขา', 0x7cc3ff, 0xfbcfe8], ['น้องมะลิ', 'ต้อนรับ', 0x5b3a29, 0xfecdd3]],
      say: ['ตารางเดือนนี้ฟ้าจัดการเองค่ะ', 'มีนัดอะไรบอกฟ้าได้เลย', 'อย่าลืมพักผ่อนด้วยนะคะ', 'ชงชาเขียวให้ไหมคะ'] }
  ];
  W.BD = {}; W.D.forEach(function (d) { W.BD[d.k] = d; d.x = d.gx * CS; d.z = d.gz * CS; d.rx = (d.rc[0] - 1.5) * RW; d.rz = d.rc[1] ? RZ : -RZ; });

  var T, BX, MC = {}, GC = {}, CVC = {};
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function hex(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }
  W.hex = hex;
  function mat(c, o) {
    var k = c + (o ? JSON.stringify(o) : '');
    if (!MC[k]) { var p = { color: c, roughness: .72, metalness: 0 }; if (o) for (var i in o) p[i] = o[i]; MC[k] = new T.MeshStandardMaterial(p); }
    return MC[k];
  }
  function emi(c, i) { return mat(c, { emissive: c, emissiveIntensity: i == null ? 1 : i, roughness: .5 }); }
  function isM(m) { return Array.isArray(m) || (m && m.isMaterial); }
  function box(g, w, h, d, x, y, z, m, ns) {
    var o = new T.Mesh(BX, isM(m) ? m : mat(m)); o.scale.set(w, h, d); o.position.set(x, y, z);
    o.castShadow = !ns; o.receiveShadow = true; g.add(o); return o;
  }
  function geo(k, f) { return GC[k] || (GC[k] = f()); }
  function cyl(g, rt, rb, h, x, y, z, m, seg) {
    var o = new T.Mesh(geo('c' + rt + '_' + rb + '_' + h + '_' + (seg || 14), function () { return new T.CylinderGeometry(rt, rb, h, seg || 14); }), isM(m) ? m : mat(m));
    o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o;
  }
  function sph(g, r, x, y, z, m) {
    var o = new T.Mesh(geo('s' + r, function () { return new T.IcosahedronGeometry(r, 1); }), isM(m) ? m : mat(m, { flatShading: true }));
    o.position.set(x, y, z); o.castShadow = true; g.add(o); return o;
  }
  function plane(g, w, h, x, y, z, rx, ry, m) {
    var o = new T.Mesh(new T.PlaneGeometry(w, h), isM(m) ? m : mat(m)); o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, 0); o.receiveShadow = true; g.add(o); return o;
  }
  function cvs(w, h, fn, key) {
    if (key && CVC[key]) return CVC[key];
    var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); fn(g, w, h);
    var t = new T.CanvasTexture(c); t.anisotropy = 4; if (key) CVC[key] = t; return t;
  }
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  W.u = { T: function () { return T; }, mat: mat, emi: emi, box: box, cyl: cyl, sph: sph, plane: plane, cvs: cvs, rrect: rrect, pick: pick, rnd: rnd, geo: geo, isM: isM };

  /* ---------- ตัวละคร (สไตล์บล็อกสาวน่ารัก ผมสี ริบบิ้น) ---------- */
  function faceTex(o) {
    var key = 'face' + [o.skin, o.hair, o.eye, o.f ? 1 : 0, o.bang ? 1 : 0].join('_');
    return cvs(64, 64, function (g) {
      var sk = hex(o.skin || 0xffdcc2), hr = hex(o.hair || 0x333344), ey = o.eye || '#5b3f8c';
      g.fillStyle = sk; g.fillRect(0, 0, 64, 64);
      g.fillStyle = hr; g.fillRect(0, 0, 64, 15);                       // ผมหน้าม้า
      for (var i = 0; i < 8; i++) { var x0 = i * 8; g.fillRect(x0, 12, 8, 3 + ((i * 7) % 5)); }
      g.fillRect(0, 12, 7, 30); g.fillRect(57, 12, 7, 30);              // ผมข้างแก้ม
      var ex = [17, 40];
      ex.forEach(function (x) {
        g.fillStyle = '#2a2140'; g.fillRect(x, 26, 8, 16);
        g.fillStyle = ey; g.fillRect(x + 1, 28, 6, 13);
        g.fillStyle = '#9b7be0'; g.fillRect(x + 1, 36, 6, 5);
        g.fillStyle = '#fff'; g.fillRect(x + 1, 28, 3, 4); g.fillRect(x + 5, 36, 2, 2);
        g.fillStyle = '#2a2140'; g.fillRect(x - 1, 24, 10, 2);
      });
      if (o.f !== 0) { g.fillStyle = 'rgba(255,120,150,.45)'; g.fillRect(11, 44, 9, 5); g.fillRect(44, 44, 9, 5); }
      g.fillStyle = '#c2475a'; g.fillRect(28, 49, 8, 2); g.fillRect(27, 48, 2, 2); g.fillRect(35, 48, 2, 2);
    }, key);
  }
  function mkChar(o) {
    var g = new T.Group(), sk = mat(o.skin || 0xffdcc2), hm = mat(o.hair || 0x333344, { roughness: .55 }), tm = mat(o.top || 0xf9a8d4), bm = mat(o.bot || 0x6b7fd6),
      fm = new T.MeshStandardMaterial({ map: faceTex(o), roughness: .85 }), U = g.userData = {};
    var s = o.s || 1; g.scale.setScalar(s);
    var head = new T.Group(); head.position.set(0, 1.95, 0); g.add(head); U.head = head;
    var hb = new T.Mesh(BX, [sk, sk, hm, sk, fm, hm]); hb.scale.set(1.05, 1.05, 1.05); hb.position.y = .525; hb.castShadow = true; head.add(hb);
    box(head, 1.16, .34, 1.16, 0, 1.0, 0, hm);                       // ผมด้านบน
    box(head, 1.16, 1.15, .3, 0, .5, -.52, hm);                      // ผมยาวด้านหลัง
    if (o.f) {
      [-1, 1].forEach(function (sd) { box(head, .2, .9, .46, sd * .56, .46, -.1, hm); });
      if (o.long) [-1, 1].forEach(function (sd) { box(head, .32, 1.0, .32, sd * .5, -.4, -.4, hm); });
      if (o.bow) [-1, 1].forEach(function (sd) { var b = box(head, .34, .3, .16, sd * .45, 1.02, .3, mat(o.bow, { emissive: o.bow, emissiveIntensity: .15 })); box(head, .12, .12, .18, sd * .45, 1.02, .3, 0xffffff); });
    }
    // ลำตัว
    box(g, .98, 1.05, .56, 0, 1.42, 0, tm);
    box(g, .6, .1, .2, 0, 1.86, .3, 0xffffff);                       // คอปก
    if (o.f) { box(g, .26, .22, .12, 0, 1.64, .32, mat(o.bow || 0xf472b6)); box(g, 1.2, .5, .8, 0, .98, 0, tm); }
    else box(g, .98, .3, .56, 0, .95, 0, bm);
    // แขน-ขา (pivot ที่ข้อต่อ)
    U.A = [-1, 1].map(function (sd) { var p = new T.Group(); p.position.set(sd * .68, 1.86, 0); box(p, .32, .86, .34, 0, -.4, 0, tm); box(p, .3, .24, .32, 0, -.9, 0, sk); g.add(p); return p; });
    U.L = [-1, 1].map(function (sd) { var p = new T.Group(); p.position.set(sd * .27, .86, 0); box(p, .42, .46, .44, 0, -.2, 0, o.f ? sk : bm); box(p, .43, .4, .45, 0, -.62, 0, 0xffffff); box(p, .46, .16, .56, 0, -.78, .06, 0x3b3550); g.add(p); return p; });
    return g;
  }
  W.mkChar = mkChar;
  function pose(c, t, m) {
    var U = c.userData, s, i;
    if (m === 'walk') { s = Math.sin(t * 9) * .7; U.L[0].rotation.x = s; U.L[1].rotation.x = -s; U.A[0].rotation.x = -s * .8; U.A[1].rotation.x = s * .8; U.head.rotation.z = 0; }
    else if (m === 'sit') { U.L[0].rotation.x = U.L[1].rotation.x = -Math.PI / 2; s = Math.sin(t * 14); U.A[0].rotation.x = -1.15 + s * .06; U.A[1].rotation.x = -1.15 - s * .06; U.head.rotation.x = Math.sin(t * .7) * .05; }
    else if (m === 'wave') { U.L[0].rotation.x = U.L[1].rotation.x = 0; U.A[0].rotation.x = 0; U.A[1].rotation.set(0, 0, 0); U.A[1].rotation.z = 2.6 + Math.sin(t * 9) * .35; U.head.rotation.z = Math.sin(t * 3) * .06; }
    else { U.L[0].rotation.x = U.L[1].rotation.x = 0; U.A[0].rotation.x = Math.sin(t * 1.6) * .05; U.A[1].rotation.x = -Math.sin(t * 1.6) * .05; U.A[0].rotation.z = U.A[1].rotation.z = 0; U.head.rotation.z = Math.sin(t * 1.2) * .03; U.head.rotation.x = 0; }
    if (m !== 'wave') U.A[1].rotation.z = 0;
  }
  W.pose = pose;

  /* ---------- ตัวช่วยฉาก ---------- */
  function gradBg(top, bot) { return cvs(4, 256, function (g) { var gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); }, 'bg' + top + bot); }
  function facadeTex(w, h, cols, rows, key) {
    return cvs(Math.round(w * 26), Math.round(h * 26), function (g, cw, ch) {
      var S = 26; g.fillStyle = '#f8fafd'; g.fillRect(0, 0, cw, ch);
      g.fillStyle = '#e3e9f2'; g.fillRect(0, ch - S * .45, cw, S * .45); g.fillRect(0, 0, cw, S * .3);
      if (!cols) { g.fillStyle = '#e6ebf3'; for (var r = 0; r < 5; r++) g.fillRect(0, ch * .15 + r * ch * .14, cw, 2); return; }
      var mx = S * .8, my = S * .9, gw = (cw - mx * 2) / cols, gh = (ch - my - S * 1.2) / rows;
      for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
        var x = mx + i * gw + gw * .1, y = my + j * gh + gh * .1, ww = gw * .8, hh = gh * .78, lit = Math.random() < .18;
        var gr = g.createLinearGradient(0, y, 0, y + hh); gr.addColorStop(0, lit ? '#fff1c4' : '#d9eeff'); gr.addColorStop(1, lit ? '#f7cf86' : '#8cbfe9');
        g.fillStyle = '#c9d4e3'; g.fillRect(x - 2, y - 2, ww + 4, hh + 4); g.fillStyle = gr; g.fillRect(x, y, ww, hh);
        g.fillStyle = '#eef3fa'; g.fillRect(x + ww / 2 - 1, y, 2, hh); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(x, y + hh); g.lineTo(x + ww * .4, y); g.lineTo(x + ww * .6, y); g.lineTo(x + ww * .2, y + hh); g.fill();
      }
    }, key);
  }
  function signTex(d, big) {
    return cvs(512, 128, function (g) {
      g.fillStyle = '#ffffff'; rrect(g, 4, 4, 504, 120, 22); g.fill();
      g.fillStyle = hex(d.c); rrect(g, 4, 4, 130, 120, 22); g.fill(); g.fillRect(100, 4, 34, 120);
      g.font = '64px system-ui,"Apple Color Emoji","Noto Color Emoji"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(d.ic, 69, 68);
      g.fillStyle = '#16233b'; g.font = 'bold 58px system-ui,"Noto Sans Thai",sans-serif'; g.textAlign = 'left'; g.fillText(d.n, 156, 66);
    }, 'sign' + d.k);
  }
  function tree(g, x, z, s, col) {
    s = s || 1; box(g, .4 * s, 1.6 * s, .4 * s, x, .8 * s, z, 0x9a7b5a);
    var c = col || pick([0x5ec26a, 0x6bcf7a, 0x4fb862]); sph(g, 1.25 * s, x, 2.5 * s, z, c); sph(g, .85 * s, x + .5 * s, 3.4 * s, z - .2 * s, c);
  }
  function lamp(g, x, z) { box(g, .16, 3.8, .16, x, 1.9, z, 0xaab6c8); box(g, .8, .16, .3, x, 3.8, z, 0xaab6c8); box(g, .5, .1, .24, x, 3.7, z, emi(0xfff2c0, .8), 1); }
  function pallet(g, x, z, ry, n, col) {
    var p = new T.Group(); p.position.set(x, 0, z); p.rotation.y = ry || 0; g.add(p);
    box(p, 1.9, .22, 1.9, 0, .11, 0, 0xc9a26b); box(p, 1.9, .08, .3, 0, .26, .7, 0xb48a52); box(p, 1.9, .08, .3, 0, .26, -.7, 0xb48a52);
    for (var i = 0; i < (n || 4); i++) { var cx = (i % 2 ? .5 : -.5), cz = (Math.floor(i / 2) % 2 ? .5 : -.5), cy = .3 + .5 + Math.floor(i / 4) * 1.0; box(p, .9, .9, .9, cx, cy, cz, col || pick([0xd9ae72, 0xd9ae72, 0x3b82f6, 0xe8c48a])); box(p, .92, .12, .3, cx, cy + .25, cz, 0xf1e2c6, 1); }
    return p;
  }
  function wheel(g, x, y, z, r) { var w = cyl(g, r, r, .35, x, y, z, 0x2a3140, 12); w.rotation.x = Math.PI / 2; return w; }
  function truck(cab) {
    var g = new T.Group(); box(g, 5.4, 2.5, 2.5, -.6, 2.0, 0, 0xffffff); box(g, 5.42, .35, 2.52, -.6, 1.2, 0, 0x3b82f6); box(g, 5.2, .4, 2.3, -.6, .62, 0, 0x5a6577);
    box(g, 2.0, 1.9, 2.3, 3.0, 1.55, 0, cab); box(g, .12, 1.0, 1.9, 4.03, 1.95, 0, 0xbfe2ff); box(g, .1, .5, 2.2, 4.06, .85, 0, 0x2a3140);
    [-2.4, .9, 3.0].forEach(function (x) { wheel(g, x, .55, 1.25, .55); wheel(g, x, .55, -1.25, .55); }); return g;
  }
  function car(col) {
    var g = new T.Group(); box(g, 3.2, .9, 1.6, 0, .85, 0, col); box(g, 1.7, .75, 1.45, -.2, 1.6, 0, 0xffffff); box(g, 1.72, .55, 1.47, -.2, 1.62, 0, 0xbfe2ff, 1);
    [-1, 1].forEach(function (a) { wheel(g, a * 1.0, .42, .8, .42); wheel(g, a * 1.0, .42, -.8, .42); }); return g;
  }
  function forklift() {
    var g = new T.Group(); box(g, 1.7, .9, 1.2, 0, .8, 0, 0xfacc15); box(g, 1.0, .9, 1.0, -.3, 1.7, 0, 0xfacc15, 1); box(g, .14, 1.6, .14, .85, 1.9, .5, 0x4b5563); box(g, .14, 1.6, .14, .85, 1.9, -.5, 0x4b5563);
    var f = new T.Group(); f.position.set(.95, .4, 0); g.add(f); box(f, .9, .1, .2, .4, 0, .4, 0x4b5563); box(f, .9, .1, .2, .4, 0, -.4, 0x4b5563); g.userData.fork = f;
    [-1, 1].forEach(function (a) { wheel(g, a * .55, .35, .65, .35); wheel(g, a * .55, .35, -.65, .35); }); return g;
  }

  /* ---------- อาคารภายนอก ---------- */
  var DEPROP = {
    acc: function (g, d) { for (var i = 0; i < 4; i++) cyl(g, .9, .9, .3, -8, .4 + i * .32, 7.2, 0xfacc15, 20); box(g, 2.4, .5, 2.4, -8, .25, 7.2, 0xe5e9f0); },
    prod: function (g, d) { box(g, 4, .15, .15, -8, 2.4, 7.2, 0xaab6c8); [-9.5, -6.5].forEach(function (x) { box(g, .15, 2.4, .15, x, 1.2, 7.2, 0xaab6c8); }); for (var i = 0; i < 7; i++) box(g, .28, 1.2, .12, -9.4 + i * .5, 1.7, 7.2, pick([0xf97316, 0x3b82f6, 0xf472b6, 0x22c55e, 0xfacc15])); },
    sales: function (g, d) { box(g, 2.4, .2, 1.4, 7.5, 1.4, 7.2, 0xffffff); [-1, 1].forEach(function (a) { box(g, .12, 1.4, .12, 7.5 + a * 1.1, .7, 7.2, 0xaab6c8); }); box(g, 2.4, .4, 1.4, 7.5, 1.6, 7.2, d.c); },
    rent: function (g, d) { for (var i = 0; i < 4; i++) box(g, 1.5, .18, .9, 0, 2.8 + i * 2.2, 5.45, 0xe3e9f2); },
    tax: function (g, d) { [-1, 1].forEach(function (a) { [0, 1.6].forEach(function (o) { cyl(g, .38, .38, 4.2, a * 3 + (a > 0 ? o : -o), 2.4, 6.2, 0xffffff, 14); }); }); },
    news: function (g, d) { box(g, .2, 4, .2, -4, 9.5, -2, 0xaab6c8); var dish = new T.Mesh(geo('dish', function () { return new T.SphereGeometry(1.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); }), mat(0xffffff, { side: T.DoubleSide })); dish.position.set(-4, 11.5, -1.4); dish.rotation.x = -.9; g.add(dish); },
    sec: function (g, d) { tree(g, -8, 6.5, 1.1, 0xffb7d5); tree(g, 8, 6.5, 1, 0xffc9e0); for (var i = -1; i < 2; i++) { box(g, .5, .5, .5, i * 1.6, 4.2, 5.7, emi(0xff7ab8, .6), 1); } },
    stock: function (g, d) { pallet(g, -9, 8, .3, 4); pallet(g, 9.4, 7.6, -.2, 6, 0x3b82f6); }
  };
  function building(d) {
    var g = new T.Group(), Wd = d.w, Hd = d.h, Pd = d.p, c = d.c, y0 = .25;
    g.position.set(d.x, 0, d.z); g.userData.k = d.k;
    box(g, Wd + 5, .25, Pd + 6, 0, .125, 1.5, 0xffffff);
    var fm = new T.MeshStandardMaterial({ map: facadeTex(Wd, Hd, d.cols, d.rows, 'fF' + d.k), roughness: .55 }), sm = new T.MeshStandardMaterial({ map: facadeTex(Pd, Hd, d.cols ? 4 : 0, d.rows, 'fS' + d.k), roughness: .55 });
    var body = new T.Mesh(BX, [sm, sm, mat(0xf2f5fa), mat(0xdde5ef), fm, fm]); body.scale.set(Wd, Hd, Pd); body.position.y = y0 + Hd / 2; body.castShadow = body.receiveShadow = true; g.add(body);
    box(g, Wd + .7, .45, Pd + .7, 0, y0 + Hd + .22, 0, c); box(g, Wd + .3, .14, Pd + .3, 0, y0 + Hd + .52, 0, 0xffffff);
    box(g, Wd + .8, .16, .5, 0, y0 + 1.2, Pd / 2 + .15, 0xe3e9f2); [-1, 1].forEach(function (a) { box(g, .5, Hd, .5, a * (Wd / 2), y0 + Hd / 2, Pd / 2, 0xeef2f8); });
    if (d.k === 'stock') { for (var i = -1; i < 2; i++) { box(g, 3.6, 3.8, .2, i * 5, y0 + 1.9, Pd / 2 + .12, 0x3b82f6); for (var r = 0; r < 5; r++) box(g, 3.5, .08, .06, i * 5, y0 + .7 + r * .7, Pd / 2 + .25, 0xdbe7ff, 1); } }
    else { box(g, 3.4, 3.2, .3, 0, y0 + 1.6, Pd / 2 + .15, 0x16233b); box(g, 3, 2.9, .12, 0, y0 + 1.55, Pd / 2 + .32, emi(0x9fd2ff, .35), 1); box(g, .08, 2.9, .13, 0, y0 + 1.55, Pd / 2 + .4, 0xffffff, 1); box(g, 4.6, .3, 1.8, 0, y0 + 3.6, Pd / 2 + .9, c); [-1, 1].forEach(function (a) { box(g, .14, 3.4, .14, a * 2.2, y0 + 1.7, Pd / 2 + 1.7, 0xdfe6f0); }); box(g, 3.2, .1, 1.6, 0, y0 + .05, Pd / 2 + 1.6, 0xd8e0ec, 1); }
    var sg = signTex(d), sm2 = new T.MeshBasicMaterial({ map: sg, transparent: true });
    var ty = y0 + Hd + 1.9; box(g, .16, 1.8, .16, -Wd * .3, ty - .5, Pd / 2 - .4, 0xaab6c8); box(g, .16, 1.8, .16, Wd * .3, ty - .5, Pd / 2 - .4, 0xaab6c8);
    var sgp = new T.Group(); sgp.position.set(0, ty + .1, Pd / 2 - .4); g.add(sgp); d.sign = sgp;
    plane(sgp, 8.4, 2.1, 0, 0, .08, 0, 0, sm2); plane(sgp, 8.4, 2.1, 0, 0, -.08, 0, Math.PI, sm2); box(sgp, 8.5, 2.2, .1, 0, 0, 0, 0xffffff, 1);
    [[-3, -2], [3, 1]].forEach(function (a) { box(g, 2, .9, 1.4, a[0], y0 + Hd + 1.1, a[1], 0xdfe6ef); box(g, 1.7, .08, 1.1, a[0], y0 + Hd + 1.58, a[1], 0xb9c4d4, 1); });
    [-1, 1].forEach(function (a) { tree(g, a * (Wd / 2 + 2.6), Pd / 2 + 3, .8); });
    if (DEPROP[d.k]) DEPROP[d.k](g, d);
    // หมุดตำแหน่ง (เหมือนหมุดในวิดีโอ)
    var pin = new T.Group(); pin.position.set(0, y0 + Hd + 6.2, 0); var pm = emi(0x3b82f6, .6);
    var ph = new T.Mesh(geo('pinH', function () { return new T.SphereGeometry(.75, 16, 12); }), pm); ph.position.y = .55; pin.add(ph);
    var pc = new T.Mesh(geo('pinC', function () { return new T.ConeGeometry(.75, 1.3, 14); }), pm); pc.rotation.x = Math.PI; pc.position.y = -.35; pin.add(pc);
    var pd = new T.Mesh(geo('pinD', function () { return new T.SphereGeometry(.3, 10, 8); }), emi(0xffffff, 1)); pd.position.y = .55; pin.add(pd); g.add(pin); g.userData.pin = pin; g.userData.pm = pm;
    d.g = g; d.top = y0 + Hd + 8.4; return g;
  }

  /* ---------- สร้างฉากภายนอก ---------- */
  var EX = { sc: null, ag: [], pick: [], tags: [] };
  function buildExt() {
    var sc = EX.sc = new T.Scene(); sc.background = new T.Color(0xe6edf7);
    sc.add(new T.HemisphereLight(0xf4f8ff, 0xaebdd6, .62));
    var sun = new T.DirectionalLight(0xfff8ee, .62); sun.position.set(46, 90, 34); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0005; sun.shadow.radius = 3;
    var sh = sun.shadow.camera; sh.left = -64; sh.right = 64; sh.top = 64; sh.bottom = -64; sh.near = 10; sh.far = 220; sc.add(sun);
    var gt = cvs(128, 128, function (g) { g.fillStyle = '#eef2f9'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#dfe6f1'; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128); }, 'gground'); gt.wrapS = gt.wrapT = T.RepeatWrapping; gt.repeat.set(70, 70);
    var gr = new T.Mesh(new T.PlaneGeometry(500, 500), new T.MeshStandardMaterial({ map: gt, roughness: 1 })); gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true; sc.add(gr);
    // ถนน
    var rt = cvs(128, 64, function (g) { g.fillStyle = '#cdd6e4'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#b4c1d6'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 61, 128, 3); g.fillStyle = '#ffffff'; g.fillRect(8, 30, 56, 4); }, 'road'); rt.wrapS = rt.wrapT = T.RepeatWrapping; rt.repeat.set(112 / 8, 1);
    var rm = new T.MeshStandardMaterial({ map: rt, roughness: .9 }), RDS = [-39, -13, 13, 39];
    RDS.forEach(function (r) {
      var a = new T.Mesh(new T.PlaneGeometry(112, 6), rm); a.rotation.x = -Math.PI / 2; a.position.set(0, .03, r); a.receiveShadow = true; sc.add(a);
      var b = new T.Mesh(new T.PlaneGeometry(112, 6), rm); b.rotation.x = -Math.PI / 2; b.rotation.z = Math.PI / 2; b.position.set(r, .035, 0); b.receiveShadow = true; sc.add(b);
      lampsAlong(sc, r);
    });
    // เส้นสีฟ้าเหมือน conveyor ในวิดีโอ
    [-13, 13].forEach(function (r) { box(sc, 112, .05, .3, 0, .08, r - 2.5, emi(0x4f8ff7, .25), 1); box(sc, .3, .05, 112, r - 2.5, .09, 0, emi(0x4f8ff7, .25), 1); });
    // อาคาร
    W.D.forEach(function (d) { var b = building(d); sc.add(b); EX.pick.push(b); });
    // ลานกลาง
    var pz = new T.Group(); sc.add(pz); cyl(pz, 8.5, 8.7, .3, 0, .15, 0, 0xffffff, 40); cyl(pz, 7, 7, .35, 0, .18, 0, 0xe8eff9, 40); cyl(pz, 1.6, 2, 1.4, 0, 1, 0, 0xffffff, 6);
    var core = new T.Group(); core.position.y = 4; pz.add(core); box(core, 2.1, 2.1, 2.1, 0, 0, 0, emi(0x3b82f6, .55)); box(core, 1.0, 1.0, 1.0, 0, 0, 0, emi(0xffffff, .8)); EX.core = core;
    for (var a = 0; a < 6; a++) { var an = a / 6 * Math.PI * 2; tree(pz, Math.cos(an) * 6.2, Math.sin(an) * 6.2, .8); }
    // รั้วริมที่ดิน
    for (var i = -3; i <= 3; i++) { box(sc, .16, 1.6, .16, i * 8, .8, -60, 0xc5d0e0, 1); box(sc, .16, 1.6, .16, 60, .8, i * 8, 0xc5d0e0, 1); }
    box(sc, 112, .1, .1, 0, 1.3, -60, 0xc5d0e0, 1); box(sc, .1, .1, 112, 60, 1.3, 0, 0xc5d0e0, 1);
    for (i = 0; i < 40; i++) { var tx = rnd(-75, 75), tz = rnd(-75, 75); if (Math.abs(tx) < 58 && Math.abs(tz) < 58) continue; tree(sc, tx, tz, rnd(.9, 1.5)); }
    // ยานพาหนะ
    [[0xf97316, 'x', -13 + 1.5, 1, 7], [0x3b82f6, 'x', 13 - 1.5, -1, 8], [0x3b82f6, 'z', 13 + 1.5, 1, 6.5], [0xf97316, 'z', -13 - 1.5, -1, 6]].forEach(function (a) {
      var tk = truck(a[0]); sc.add(tk); EX.ag.push({ k: 'veh', g: tk, ax: a[1], ln: a[2], p: rnd(-50, 50), dir: a[3], sp: a[4] });
    });
    [0xffffff, 0x3b82f6, 0xcbd5e1, 0xffffff, 0x60a5fa].forEach(function (cl, i) { var cr = car(cl), ax = i % 2 ? 'x' : 'z', r = RDS[i % 4], dr = i % 3 ? 1 : -1; sc.add(cr); EX.ag.push({ k: 'veh', g: cr, ax: ax, ln: r + (dr > 0 ? 1.4 : -1.4), p: rnd(-50, 50), dir: dr, sp: rnd(8, 11) }); });
    // รถโฟล์คลิฟท์ + คนเดิน
    var sd = W.BD.stock, f1 = forklift(); sc.add(f1); EX.ag.push({ k: 'fork', g: f1, x0: sd.x - 6, x1: sd.x + 6, z: sd.z + 10.2, p: 0, dir: 1, sp: 2.2, load: pallet(f1, 1.6, 0, 0, 2) });
    var cols = [[0xff8fc7, 0xf9a8d4], [0xb79cff, 0xc7d2fe], [0x7de0c3, 0xa7f3d0], [0xf3d27a, 0xfde68a], [0x7cc3ff, 0xbfdbfe], [0x5b3a29, 0xfed7aa], [0x222233, 0xcbd5e1]];
    for (i = 0; i < 14; i++) {
      var cc = cols[i % cols.length], ch = mkChar({ hair: cc[0], top: cc[1], bot: pick([0x6b7fd6, 0x475569, 0x94a3b8]), f: i % 3 !== 2, bow: i % 2 ? 0xf472b6 : 0x60a5fa, s: .62 }); sc.add(ch);
      var ax = i % 2 ? 'x' : 'z', rr = RDS[Math.floor(i / 2) % 4];
      EX.ag.push({ k: 'ppl', g: ch, ax: ax, ln: rr + (i % 4 < 2 ? -3.7 : 3.7), p: rnd(-50, 50), dir: i % 2 ? 1 : -1, sp: rnd(1.4, 2.2), ph: rnd(0, 6) });
    }
    // เลขา (ผมชมพู) ยืนโบกมือหน้าตึก
    var sec = W.BD.sec, sf = mkChar({ hair: 0xff8fc7, top: 0xf9a8d4, f: 1, long: 1, bow: 0xf472b6, s: .85 }); sf.position.set(sec.x + 4.4, .25, sec.z + 8.6); sf.rotation.y = .5; sc.add(sf);
    sf.userData.sec = true; sf.traverse(function (o) { o.userData.sec = true; }); EX.sec = sf; EX.pick.push(sf);
    // วงเลือก
    var sel = new T.Group(); [[1, 0], [-1, 0]].forEach(function (a) { box(sel, .5, .3, 17.5, a[0] * 9, 0, 1.5, emi(0x3b82f6, 1), 1); }); [[1, 0], [-1, 0]].forEach(function (a) { box(sel, 18.5, .3, .5, 0, 0, 1.5 + a[0] * 8.7, emi(0x3b82f6, 1), 1); }); sel.visible = false; sel.position.y = .4; sc.add(sel); EX.sel = sel;
  }
  function lampsAlong(sc, r) { [-45, -15, 15, 45].forEach(function (t) { lamp(sc, t, r + 3.7); lamp(sc, r + 3.7, t); }); }

  /* ---------- กล้อง/ควบคุม/ลูปหลัก ---------- */
  var V = { mode: 'ext', th: Math.PI / 4, thT: Math.PI / 4, zoom: 1, cx: 0, cz: 8, tx: 0, tz: 8, sel: null, room: 'all', yaw: 0, dz: 1, fade: 0 };
  W.V = V;
  var rd, oc, pc, ray, host, last = 0, cw = 0, ch = 0, ready = false, NT = [];
  W.tags = NT; W.cb = {};
  function tagAdd(el, obj, dy, mode, room) { el.style.display = 'none'; NT.push({ el: el, obj: obj, dy: dy || 0, mode: mode, room: room }); }
  W.tagAdd = tagAdd;
  W.clearTags = function (mode) { for (var i = NT.length - 1; i >= 0; i--) if (!mode || NT[i].mode === mode) { if (NT[i].el.parentNode) NT[i].el.parentNode.removeChild(NT[i].el); NT.splice(i, 1); } };

  function frame(ts) {
    requestAnimationFrame(frame);
    if (!ready || !host) return;
    if (document.hidden) return;
    var w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    var dt = Math.min(.05, (ts - last) / 1000), t = ts / 1000; last = ts;
    if (w !== cw || h !== ch) { cw = w; ch = h; rd.setSize(w, h, false); pc.aspect = w / h; pc.updateProjectionMatrix(); }
    var cam, scn;
    if (V.mode === 'ext') {
      EX.ag.forEach(function (n) { stepExt(n, dt, t); });
      if (EX.core) { EX.core.rotation.y = t * .6; EX.core.position.y = 4 + Math.sin(t * 1.6) * .25; }
      EX.sec && pose(EX.sec, t, 'wave');
      W.D.forEach(function (d, i) { var p = d.g.userData.pin; p.position.y = d.top - 2.2 + Math.sin(t * 2 + i) * .35; p.rotation.y = t * 1.1; d.sign.rotation.y = V.th; var s = V.sel === d.k; d.g.userData.pm.emissiveIntensity = s ? 1.4 : .55; });
      if (EX.sel && V.sel) { EX.sel.visible = true; EX.sel.scale.setScalar(1 + Math.sin(t * 4) * .015); }
      V.th += (V.thT - V.th) * Math.min(1, dt * 6); V.cx += (V.tx - V.cx) * Math.min(1, dt * 5); V.cz += (V.tz - V.cz) * Math.min(1, dt * 5);
      var a = w / h, vh = Math.max(66, 84 / Math.max(a, .55)) / V.zoom, el = .64, R = 120; cam = oc; scn = EX.sc;
      oc.left = -vh * a / 2; oc.right = vh * a / 2; oc.top = vh / 2; oc.bottom = -vh / 2; oc.updateProjectionMatrix();
      oc.position.set(V.cx + Math.sin(V.th) * Math.cos(el) * R, Math.sin(el) * R, V.cz + Math.cos(V.th) * Math.cos(el) * R); oc.lookAt(V.cx, 0, V.cz);
    } else if (W.intFrame) { var r = W.intFrame(dt, t, w / h, w, h); cam = pc; scn = r; }
    if (scn) rd.render(scn, cam);
    // ป้ายลอย (DOM)
    NT.forEach(function (o) {
      var ok = o.mode === V.mode && (!o.room || o.room === V.room || V.room === 'all' && o.room === '*');
      if (!ok || !o.obj || (o.show && !o.show())) { if (o.on !== false) { o.el.style.display = 'none'; o.on = false; } return; }
      var v = (o.v || (o.v = new T.Vector3())); o.obj.getWorldPosition(v); v.y += o.dy; v.project(cam);
      if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) { if (o.on !== false) { o.el.style.display = 'none'; o.on = false; } return; }
      if (o.on !== true) { o.el.style.display = ''; o.on = true; }
      o.el.style.transform = 'translate(' + ((v.x * .5 + .5) * w).toFixed(1) + 'px,' + ((-v.y * .5 + .5) * h).toFixed(1) + 'px) translate(-50%,-100%)';
    });
  }
  function stepExt(n, dt, t) {
    var g = n.g;
    if (n.k === 'veh') {
      n.p += n.dir * n.sp * dt; if (n.p > 62) n.p = -62; if (n.p < -62) n.p = 62;
      if (n.ax === 'x') { g.position.set(n.p, 0, n.ln); g.rotation.y = n.dir > 0 ? 0 : Math.PI; } else { g.position.set(n.ln, 0, n.p); g.rotation.y = n.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
    } else if (n.k === 'ppl') {
      n.p += n.dir * n.sp * dt; if (n.p > 60) n.p = -60; if (n.p < -60) n.p = 60;
      if (n.ax === 'x') { g.position.set(n.p, .25, n.ln); g.rotation.y = n.dir > 0 ? Math.PI / 2 : -Math.PI / 2; } else { g.position.set(n.ln, .25, n.p); g.rotation.y = n.dir > 0 ? 0 : Math.PI; }
      pose(g, t + n.ph, 'walk'); g.position.y = .25 + Math.abs(Math.sin((t + n.ph) * 9)) * .05;
    } else if (n.k === 'fork') {
      n.p += n.dir * n.sp * dt; var x = n.x0 + n.p; if (x > n.x1) { n.dir = -1; n.load.visible = false; } if (x < n.x0) { n.dir = 1; n.load.visible = true; }
      g.position.set(Math.max(n.x0, Math.min(n.x1, x)), 0, n.z); g.rotation.y = n.dir > 0 ? 0 : Math.PI; n.p = Math.max(0, Math.min(n.x1 - n.x0, n.p));
    }
  }

  /* ---------- API ---------- */
  W.start = function (el) {
    T = window.THREE; if (!T || ready) return false; host = el; BX = new T.BoxGeometry(1, 1, 1);
    rd = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); rd.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); rd.shadowMap.enabled = true; rd.shadowMap.type = T.PCFSoftShadowMap;
    el.insertBefore(rd.domElement, el.firstChild); W.canvas = rd.domElement;
    oc = new T.OrthographicCamera(-1, 1, 1, -1, -300, 500); pc = new T.PerspectiveCamera(38, 1, .5, 500); ray = new T.Raycaster(); W.pc = pc; W.rd = rd;
    buildExt(); if (W.buildInt) W.buildInt(T); bind(); ready = true; requestAnimationFrame(frame); return true;
  };
  W.ready = function () { return ready; };
  W.setMode = function (m, room) {
    if (V.mode === m && (!room || room === V.room)) return;
    V.fade = 1; var wd = document.getElementById('wd'); if (wd) wd.classList.add('wfade');
    setTimeout(function () {
      V.mode = m; if (m === 'int') { V.room = room || 'all'; V.yaw = 0; V.dz = 1; if (W.intFocus) W.intFocus(V.room, true); }
      if (wd) { wd.classList.toggle('wint', m === 'int'); wd.classList.toggle('wext', m === 'ext'); }
      if (W.cb.mode) W.cb.mode(m, V.room);
      setTimeout(function () { if (wd) wd.classList.remove('wfade'); }, 60);
    }, 230);
  };
  W.select = function (k) {
    V.sel = k; var d = W.BD[k];
    if (d) { EX.sel.position.set(d.x, .4, d.z); V.tx = d.x - 6; V.tz = d.z + 6; V.zoom = Math.max(V.zoom, 1.5); } else { EX.sel.visible = false; }
    if (W.cb.select) W.cb.select(k);
  };
  W.recenter = function () { V.tx = 0; V.tz = 8; V.zoom = 1; V.thT = Math.PI / 4; V.sel = null; EX.sel.visible = false; if (W.cb.select) W.cb.select(null); };
  W.zoomBy = function (f) { if (V.mode === 'ext') V.zoom = Math.max(.55, Math.min(3.2, V.zoom * f)); else V.dz = Math.max(.55, Math.min(1.7, V.dz / f)); };
  W.rotateBy = function (a) { if (V.mode === 'ext') V.thT += a; else V.yaw = Math.max(-.9, Math.min(.9, V.yaw + a)); };
  W.focusRoom = function (k) { V.room = k; if (W.intFocus) W.intFocus(k); if (W.cb.room) W.cb.room(k); };
  W.extObj = function (k) { return W.BD[k] && W.BD[k].g; };
  W.secObj = function () { return EX.sec; };

  function bind() {
    var c = rd.domElement, ps = {}, mv = 0, pd = 0;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', function (e) { try { c.setPointerCapture(e.pointerId); } catch (x) {} ps[e.pointerId] = { x: e.clientX, y: e.clientY }; mv = 0; var a = Object.keys(ps); if (a.length === 2) { var p = ps[a[0]], q = ps[a[1]]; pd = Math.hypot(p.x - q.x, p.y - q.y); } });
    c.addEventListener('pointermove', function (e) {
      var p = ps[e.pointerId]; if (!p) return; var n = Object.keys(ps).length, dx = e.clientX - p.x, dy = e.clientY - p.y; mv += Math.abs(dx) + Math.abs(dy);
      if (n === 1) {
        if (V.mode === 'ext') {
          var a = cw / ch, vh = Math.max(66, 84 / Math.max(a, .55)) / V.zoom, k = vh / ch, sn = Math.sin(.64);
          V.tx += -Math.cos(V.th) * dx * k + (-Math.sin(V.th)) * dy * k / sn; V.tz += Math.sin(V.th) * dx * k + (-Math.cos(V.th)) * dy * k / sn;
          V.tx = Math.max(-60, Math.min(60, V.tx)); V.tz = Math.max(-60, Math.min(60, V.tz)); V.cx = V.tx; V.cz = V.tz;
        } else V.yaw = Math.max(-.9, Math.min(.9, V.yaw - dx * .006));
      }
      p.x = e.clientX; p.y = e.clientY;
      if (n === 2) { var ks = Object.keys(ps), p1 = ps[ks[0]], p2 = ps[ks[1]], d = Math.hypot(p1.x - p2.x, p1.y - p2.y); if (pd) W.zoomBy(d / pd); pd = d; }
    });
    c.addEventListener('pointerup', function (e) { var one = Object.keys(ps).length === 1; if (ps[e.pointerId] && one && mv < 8) tap(e); delete ps[e.pointerId]; pd = 0; });
    c.addEventListener('pointercancel', function (e) { delete ps[e.pointerId]; pd = 0; });
    c.addEventListener('wheel', function (e) { e.preventDefault(); W.zoomBy(Math.exp(-e.deltaY * .0012)); }, { passive: false });
  }
  function tap(e) {
    var r = rd.domElement.getBoundingClientRect(), v = new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v, V.mode === 'ext' ? oc : pc);
    var list = V.mode === 'ext' ? EX.pick : (W.intPick ? W.intPick() : []), h = ray.intersectObjects(list, true)[0];
    if (!h) { if (V.mode === 'ext' && V.sel) W.select(null); return; }
    var o = h.object, hit = null; while (o) { if (o.userData && (o.userData.sec || o.userData.k)) { hit = o; break; } o = o.parent; }
    if (!hit) return;
    if (hit.userData.sec) { if (W.cb.chat) W.cb.chat(); } else if (V.mode === 'ext') W.select(hit.userData.k);
  }
})();
