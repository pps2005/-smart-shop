/* SMART SHOP add-on: world-int.js — ภายในออฟฟิศมืดสไตล์ Sims (8 ห้อง = 8 ฝ่าย)
   ต้องโหลดต่อจาก world-3d.js */
(function () {
  'use strict';
  var W = window.SSW, U = W.u, T, IS, RW = W.RW, RD = W.RD, rooms = {}, NP = [], PK = [], lights = {}, cur = { x: 0, z: 0, d: 90, el: 1.05, init: false }, foc = { room: 'all' }, sayT = 2, TK = [];
  var BL = [], PLI = null, WH = 6.5, CH = 9.4, OZ = -3, DXL = -10.4, GZ = 6.3, PY = 4.2, CW = 9;
  W.DXL = DXL; W.PY = PY; W.CW = CW;
  function addBlock(g, x, z, w, d, ry) { var r = Math.abs(Math.round((ry || 0) / (Math.PI / 2))) % 2, t; if (r) { t = w; w = d; d = t; } var cx = (g.userData.ox != null ? g.userData.ox : g.position.x) + x, cz = (g.userData.oz != null ? g.userData.oz : g.position.z) + z; BL.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, lv: g.userData.lv || 0 }); }
  var mat = U.mat, emi = U.emi, box = U.box, cyl = U.cyl, sph = U.sph, plane = U.plane, cvs = U.cvs, pick = U.pick, rnd = U.rnd;

  /* ---------- พื้นผิว ---------- */
  function wood(c1, c2, key) {
    var t = cvs(128, 128, function (g) {
      for (var by = 0; by < 4; by++) for (var bx = 0; bx < 4; bx++) {
        var hz = (bx + by) % 2 === 0;
        for (var i = 0; i < 4; i++) {
          g.fillStyle = (i + bx + by) % 2 ? c1 : c2; if (hz) g.fillRect(bx * 32, by * 32 + i * 8, 32, 8); else g.fillRect(bx * 32 + i * 8, by * 32, 8, 32);
          g.fillStyle = 'rgba(0,0,0,.28)'; if (hz) g.fillRect(bx * 32, by * 32 + i * 8, 32, 1); else g.fillRect(bx * 32 + i * 8, by * 32, 1, 32);
        }
      }
    }, key); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(RW / 5, RD / 5); return t;
  }
  function tiles(c, key) { var t = cvs(64, 64, function (g) { g.fillStyle = c; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; g.strokeRect(0, 0, 64, 64); for (var i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(Math.random() * 64, Math.random() * 64, 3, 3); } }, key); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(RW / 3, RD / 3); return t; }
  function tatami(key) { var t = cvs(128, 64, function (g) { g.fillStyle = '#7f8a52'; g.fillRect(0, 0, 128, 64); for (var y = 0; y < 64; y += 3) { g.fillStyle = 'rgba(90,100,40,.18)'; g.fillRect(0, y, 128, 1); } g.fillStyle = '#3d3a22'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 0, 3, 64); g.fillRect(63, 0, 3, 64); g.fillStyle = '#6b6a3a'; g.fillRect(0, 31, 128, 2); }, key); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(RW / 4, RD / 2); return t; }
  function rugTex(c, key) { return cvs(64, 64, function (g) { g.fillStyle = c; g.fillRect(0, 0, 64, 64); for (var i = 0; i < 300; i++) { g.fillStyle = 'rgba(0,0,0,' + (Math.random() * .12) + ')'; g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); } g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 3; g.strokeRect(5, 5, 54, 54); }, key); }
  function booksTex() { return cvs(128, 96, function (g) { g.fillStyle = '#2a1d16'; g.fillRect(0, 0, 128, 96); var cs = ['#c2410c', '#1d4ed8', '#15803d', '#a16207', '#be185d', '#7c3aed', '#0e7490', '#e5e7eb']; for (var r = 0; r < 4; r++) { var x = 3; while (x < 124) { var w = 4 + Math.random() * 6 | 0, h = 14 + Math.random() * 8 | 0; g.fillStyle = cs[Math.random() * cs.length | 0]; g.fillRect(x, r * 24 + 22 - h, w, h); x += w + 1; } g.fillStyle = '#4a3322'; g.fillRect(0, r * 24 + 22, 128, 3); } }, 'books'); }
  function screenTex(c, k) { return cvs(64, 40, function (g) { g.fillStyle = '#0d1424'; g.fillRect(0, 0, 64, 40); g.fillStyle = c; for (var i = 0; i < 6; i++) g.fillRect(5, 5 + i * 5.5, 12 + ((i * 17 + k) % 40), 2); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(46, 6, 12, 8); }, 'scr' + c + k); }
  function neon(txt, c) {
    return cvs(512, 96, function (g) { g.font = 'bold 56px system-ui,"Noto Sans Thai",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = c; g.shadowBlur = 22; g.fillStyle = c; g.fillText(txt, 256, 50); g.shadowBlur = 6; g.fillStyle = '#fff'; g.fillText(txt, 256, 50); }, 'neon' + txt);
  }
  function glowTex() { return cvs(64, 64, function (g) { var r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(255,190,110,.75)'); r.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }, 'glow'); }
  function glow(g, x, z, s, c) { var m = new T.MeshBasicMaterial({ map: glowTex(), transparent: true, blending: T.AdditiveBlending, depthWrite: false, color: c || 0xffffff }); var p = new T.Mesh(new T.PlaneGeometry(s, s), m); p.rotation.x = -Math.PI / 2; p.position.set(x, .06, z); g.add(p); }

  /* ---------- เฟอร์นิเจอร์ ---------- */
  function G(g, x, z, ry) { var o = new T.Group(); o.position.set(x, 0, z); o.rotation.y = ry || 0; g.add(o); return o; }
  function chair(g, x, z, ry, c) { var o = G(g, x, z, ry); cyl(o, .12, .12, .8, 0, .4, 0, 0x2a2f3a, 8); box(o, 1, .18, 1, 0, .95, 0, c || 0x39404f); box(o, 1, 1.05, .16, 0, 1.5, .45, c || 0x39404f); box(o, 1.1, .1, 1.1, 0, .05, 0, 0x20242d); return o; }
  function monitor(o, x, y, z, c, k) { box(o, .14, .5, .14, x, y + .25, z, 0x20242d); box(o, 1.5, .95, .1, x, y + 1, z, 0x151a24); var s = new T.Mesh(new T.PlaneGeometry(1.36, .82), new T.MeshBasicMaterial({ map: screenTex(c, k) })); s.position.set(x, y + 1, z + .06); o.add(s); }
  function desk(g, x, z, ry, o) {
    o = o || {}; var d = G(g, x, z, ry), w = o.w || 3.4; addBlock(g, x, z, w, 1.8, ry); box(d, w, .16, 1.7, 0, 1.4, 0, o.c || 0x7a4a2a); box(d, .16, 1.35, 1.5, -w / 2 + .15, .68, 0, 0x4a2c18); box(d, .16, 1.35, 1.5, w / 2 - .15, .68, 0, 0x4a2c18); box(d, w - .3, 1, .12, 0, .85, -.7, 0x3c2414);
    monitor(d, o.m == null ? 0 : o.m, 1.48, -.35, o.sc || '#5eead4', Math.floor(x + z)); if (o.m2 != null) monitor(d, o.m2, 1.48, -.35, '#f9a8d4', 5);
    box(d, .9, .06, .35, 0, 1.5, .35, 0x2a2f3a, 1); box(d, .35, .24, .3, w / 2 - .5, 1.58, .4, 0xe5e7eb, 1); cyl(d, .13, .13, .26, -w / 2 + .5, 1.6, .45, 0xf8fafc, 10);
    var cx = x + Math.sin(ry || 0) * 1.9, cz = z + Math.cos(ry || 0) * 1.9; chair(g, cx, cz, ry || 0, o.cc);
    return { x: x + Math.sin(ry || 0) * 1.62, z: z + Math.cos(ry || 0) * 1.62, ry: (ry || 0) + Math.PI };
  }
  function shelf(g, x, z, ry, w, h) { var o = G(g, x, z, ry); w = w || 4; h = h || 4.2; addBlock(g, x, z, w, .9, ry); box(o, w, h, .8, 0, h / 2, 0, 0x3a2416); var p = new T.Mesh(new T.PlaneGeometry(w - .3, h - .3), new T.MeshBasicMaterial({ map: booksTex(), color: 0xbbbbbb })); p.position.set(0, h / 2, .42); o.add(p); return o; }
  function cabinet(g, x, z, ry) { var o = G(g, x, z, ry); addBlock(g, x, z, 1.8, 1.3, ry); box(o, 1.7, 2.8, 1.2, 0, 1.4, 0, 0x6b7280); for (var i = 0; i < 3; i++) { box(o, 1.5, .8, .08, 0, .5 + i * .9, .62, 0x4b5563); box(o, .5, .08, .06, 0, .6 + i * .9, .68, 0xe5e7eb, 1); } return o; }
  function plant(g, x, z, s) { s = s || 1; var o = G(g, x, z); cyl(o, .6 * s, .45 * s, .9 * s, 0, .45 * s, 0, 0xc2693a, 10); for (var i = 0; i < 6; i++) { var a = i / 6 * 6.28; sph(o, .55 * s, Math.cos(a) * .5 * s, 1.4 * s + (i % 2) * .3, Math.sin(a) * .5 * s, pick([0x2f8f4e, 0x3aa45c, 0x278048])); } sph(o, .7 * s, 0, 2 * s, 0, 0x3aa45c); return o; }
  function floorLamp(g, x, z, c) { var o = G(g, x, z); cyl(o, .35, .35, .12, 0, .06, 0, 0x20242d, 10); cyl(o, .06, .06, 3.6, 0, 1.8, 0, 0x20242d, 6); cyl(o, .5, .75, .9, 0, 3.7, 0, emi(c || 0xffc27a, .95), 12); glow(g, x, z, 7); return o; }
  function sofa(g, x, z, ry, c) { var o = G(g, x, z, ry); addBlock(g, x, z, 4.4, 1.8, ry); box(o, 4.2, .8, 1.7, 0, .6, 0, c); box(o, 4.2, 1.3, .5, 0, 1.4, -.75, c); [-1, 1].forEach(function (a) { box(o, .5, 1.1, 1.7, a * 2.05, .95, 0, c); }); return o; }
  function table(g, x, z, w, d, h, c, ry) { var o = G(g, x, z, ry); addBlock(g, x, z, w, d, ry); box(o, w, .15, d, 0, h, 0, c || 0x7a4a2a); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (a) { box(o, .18, h, .18, a[0] * (w / 2 - .2), h / 2, a[1] * (d / 2 - .2), 0x3c2414); }); return o; }
  function rug(g, x, z, w, d, c, k) { var m = new T.MeshStandardMaterial({ map: rugTex(c, 'rug' + k), roughness: 1 }), p = new T.Mesh(new T.PlaneGeometry(w, d), m); p.rotation.x = -Math.PI / 2; p.position.set(x, .04, z); p.receiveShadow = true; g.add(p); return p; }
  function board(g, x, y, z, w, h, ry, tex) { var o = G(g, x, 0, ry); o.position.z = z; box(o, w + .3, h + .3, .12, 0, y, 0, 0xe5e7eb); var p = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex })); p.position.set(0, y, .08); o.add(p); return o; }
  function chart() { return cvs(160, 96, function (g) { g.fillStyle = '#f8fafc'; g.fillRect(0, 0, 160, 96); g.strokeStyle = '#cbd5e1'; for (var i = 1; i < 5; i++) { g.beginPath(); g.moveTo(10, i * 18); g.lineTo(150, i * 18); g.stroke(); } g.strokeStyle = '#16a34a'; g.lineWidth = 3; g.beginPath(); g.moveTo(12, 78); [[40, 60], [70, 66], [100, 36], [130, 28], [150, 14]].forEach(function (p) { g.lineTo(p[0], p[1]); }); g.stroke(); g.fillStyle = '#ef4444'; for (i = 0; i < 6; i++) g.fillRect(14 + i * 24, 86 - (i * 7 % 18 + 6), 10, i * 7 % 18 + 6); }, 'chart'); }
  function calendar() {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth(), td = now.getDate(), first = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate();
    var mn = now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    return cvs(256, 176, function (g) {
      g.fillStyle = '#fff7fb'; g.fillRect(0, 0, 256, 176); g.fillStyle = '#f472b6'; g.fillRect(0, 0, 256, 28); g.fillStyle = '#fff'; g.font = 'bold 18px system-ui,"Noto Sans Thai"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(mn, 128, 15);
      g.fillStyle = '#9d174d'; g.font = '11px system-ui'; ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].forEach(function (c, i) { g.fillText(c, 20 + i * 36, 40); });
      for (var d = 1; d <= dim; d++) { var idx = first + d - 1, cx = 20 + (idx % 7) * 36, cy = 62 + Math.floor(idx / 7) * 22; if (d === td) { g.fillStyle = '#f472b6'; g.beginPath(); g.arc(cx, cy, 10, 0, 6.3); g.fill(); g.fillStyle = '#fff'; } else g.fillStyle = '#4b2a3a'; g.font = '13px system-ui'; g.fillText(d, cx, cy + 1); }
    }, 'cal' + td);
  }
  function tvTex(txt, c, k) { return cvs(128, 72, function (g) { var r = g.createLinearGradient(0, 0, 128, 72); r.addColorStop(0, '#0b1730'); r.addColorStop(1, '#16315f'); g.fillStyle = r; g.fillRect(0, 0, 128, 72); g.fillStyle = c; g.fillRect(0, 54, 128, 18); g.fillStyle = '#fff'; g.font = 'bold 13px system-ui'; g.textAlign = 'left'; g.fillText(txt, 6, 66); g.fillStyle = 'rgba(255,255,255,.5)'; for (var i = 0; i < 4; i++) g.fillRect(8, 10 + i * 8, 50 + (i * k) % 40, 3); g.fillStyle = c; g.fillRect(80, 12, 38, 30); }, 'tv' + txt + k); }
  function rack(g, x, z, ry) { var o = G(g, x, z, ry); addBlock(g, x, z, 3.6, 1, ry); [-1.6, 1.6].forEach(function (a) { box(o, .12, 3.2, .12, a, 1.6, 0, 0xcbd5e1); box(o, .12, .12, 1.2, a, .06, 0, 0xcbd5e1); }); box(o, 3.4, .1, .1, 0, 3.1, 0, 0xcbd5e1); var cs = [0xf97316, 0x3b82f6, 0xf472b6, 0x22c55e, 0xfacc15, 0xa78bfa, 0xef4444]; for (var i = 0; i < 9; i++) box(o, .3, 1.7 + Math.random() * .4, .8, -1.4 + i * .35, 2.1, 0, cs[i % cs.length]); return o; }
  function stockRack(g, x, z, ry, w) { var o = G(g, x, z, ry); w = w || 4.4; addBlock(g, x, z, w + .3, 1.5, ry); [-1, 1].forEach(function (a) { box(o, .16, 5, 1.4, a * w / 2, 2.5, 0, 0x3b82f6); }); for (var l = 0; l < 4; l++) { box(o, w, .14, 1.4, 0, .7 + l * 1.25, 0, 0xf97316); for (var i = 0; i < 3; i++) box(o, .95 + Math.random() * .3, .85, .95, -w / 2 + .85 + i * 1.4, 1.2 + l * 1.25, 0, pick([0xd9ae72, 0xd9ae72, 0xe8c48a, 0x93c5fd])); } return o; }
  function counter(g, x, z, w) { var o = G(g, x, z); addBlock(g, x, z, w + .2, 1.8, 0); box(o, w, 1.5, 1.6, 0, .75, 0, 0x3f4756); box(o, w + .2, .14, 1.8, 0, 1.55, 0, 0xe5e7eb); box(o, .9, .5, .7, -w / 4, 1.85, 0, 0x20242d); var s = new T.Mesh(new T.PlaneGeometry(.7, .35), new T.MeshBasicMaterial({ map: screenTex('#86efac', 3) })); s.position.set(-w / 4, 1.95, .36); s.rotation.x = -.3; o.add(s); return o; }
  function wallDeco(g, d) {
    box(g, RW - .2, .14, .1, 0, .6, -RD / 2 + .06, emi(d.c, .9), 1);
    var nm = new T.Mesh(new T.PlaneGeometry(7, 1.3), new T.MeshBasicMaterial({ map: neon(d.n, W.hex(d.c)), transparent: true })); nm.position.set(0, 4.15, -RD / 2 + .04); g.add(nm);
    [-6.2, 6.2].forEach(function (x) { box(g, 3, 2, .12, x, 3, -RD / 2 + .04, 0x0b1224, 1); box(g, 2.8, 1.8, .06, x, 3, -RD / 2 + .1, emi(0x1e3a6b, .8), 1); box(g, .1, 1.8, .08, x, 3, -RD / 2 + .14, 0x0b1224, 1); box(g, 2.8, .1, .08, x, 3, -RD / 2 + .14, 0x0b1224, 1); });
    var ck = cyl(g, .6, .6, .12, 0, 3.1, -RD / 2 + .12, 0xf8fafc, 20); ck.rotation.x = Math.PI / 2;
  }

  /* ---------- ห้องแต่ละฝ่าย ---------- */
  var RB = {
    acc: function (g, d, S) {
      rug(g, 0, 2.2, 9, 5, '#8a1f2b', 'red'); S.push(desk(g, -5, .2, Math.PI, { m: 0 }), desk(g, -.5, .2, Math.PI, { m: 0, m2: 1.1 }), desk(g, 4, .2, Math.PI, { sc: '#fde68a' }));
      cabinet(g, -7.8, -5.7); cabinet(g, -6, -5.7); board(g, 5, 3, -6.5 + .08, 3.2, 1.9, 0, chart()); shelf(g, 7.8, 2.5, -Math.PI / 2, 4, 4); table(g, -4.5, 3.8, 2.6, 1.4, 1.2, 0x7a4a2a); plant(g, -8, 5.2); floorLamp(g, 8, -4.5);
    },
    prod: function (g, d, S) {
      rug(g, 0, 2.6, 8, 5, '#c2570c', 'org'); rack(g, -6, -5, 0); rack(g, -2.2, -5, 0); rack(g, 6.4, -5, 0); table(g, 1.2, 2.2, 4.4, 2, 1.3, 0xe5d3b3); for (var i = 0; i < 5; i++) box(g, .9, .5, .7, -.6 + i * .8, 1.6, 2.2 + (i % 2) * .3, pick([0xf97316, 0x3b82f6, 0xf472b6, 0x22c55e]));
      S.push(desk(g, 5.5, .5, Math.PI, { sc: '#fdba74' }), desk(g, -5.5, 3, Math.PI / 2, { sc: '#93c5fd' })); var mq = W.mkChar({ hair: 0xf3d27a, top: 0xfb7185, f: 1, bow: 0xf472b6, s: .85 }); mq.position.set(-3.4, 0, 2.8); mq.rotation.y = .5; g.add(mq); W.pose(mq, 0, 'idle'); plant(g, 8, 5.2); floorLamp(g, -8, 4.5);
    },
    stock: function (g, d, S) {
      stockRack(g, -6, -5.4, 0); stockRack(g, -1.2, -5.4, 0); stockRack(g, 3.8, -5.4, 0); stockRack(g, 7.7, -2.5, -Math.PI / 2, 4);
      var p = RB.__pal; p(g, -5, 2, .3); p(g, -2.4, 3.4, -.2); S.push(desk(g, 5.6, 2.5, Math.PI, { sc: '#67e8f9', c: 0x5a606b }));
      var f = new T.Group(); f.position.set(-7, 0, 4); f.rotation.y = .6; g.add(f); var fk = RB.__fork(); f.add(fk); floorLamp(g, 8, 5);
    },
    sales: function (g, d, S) {
      rug(g, 0, 3, 9, 4.5, '#0f766e', 'teal'); counter(g, 0, -1.5, 7.4); shelf(g, -6.5, -5.8, 0, 4, 4.2); shelf(g, 6.5, -5.8, 0, 4, 4.2); sofa(g, 5.2, 4.2, Math.PI, 0x7c3aed); table(g, 5.2, 2, 2.2, 1.2, .9, 0x3b3f4c); S.push({ x: -2.6, z: -3.2, ry: 0, stand: 1 }, { x: 2.6, z: -3.2, ry: 0, stand: 1 });
      var op = new T.Mesh(new T.PlaneGeometry(2.4, .9), new T.MeshBasicMaterial({ map: neon('OPEN', '#f472b6'), transparent: true })); op.position.set(-8.7, 3, 1.5); op.rotation.y = Math.PI / 2; g.add(op); plant(g, -8, 5.2); floorLamp(g, -8, 1);
    },
    rent: function (g, d, S) {
      rug(g, 0, 1, 11, 6, '#1e40af', 'blue'); table(g, 0, 1, 7.4, 2.8, 1.4, 0x6b4426); for (var i = 0; i < 3; i++) { chair(g, -2.6 + i * 2.6, -1.3, Math.PI, 0x334155); chair(g, -2.6 + i * 2.6, 3.3, 0, 0x334155); }
      box(g, 1.6, .9, 1.2, 0, 1.95, 1, 0xffffff); box(g, 1.8, .22, 1.4, 0, 2.5, 1, 0xef4444);
      var kb = G(g, 5.5, -6.5 + .1, 0); box(kb, 4, 2.6, .12, 0, 2.6, 0, 0x3b2a1a); for (i = 0; i < 12; i++) box(kb, .2, .5, .06, -1.6 + (i % 6) * .64, 3.1 - Math.floor(i / 6) * 1.0, .1, pick([0xfacc15, 0xe5e7eb, 0xf97316]), 1);
      S.push({ x: -2.6, z: -1.3, ry: 0, sit: 1, chair: 1 }, { x: 2.6, z: 3.3, ry: Math.PI, sit: 1, chair: 1 }); cabinet(g, -7.6, -5.6); cabinet(g, -5.8, -5.6); plant(g, 8, 5.2); floorLamp(g, -8.2, 4.5);
    },
    tax: function (g, d, S) {
      rug(g, 0, 2, 9, 5, '#14532d', 'green'); shelf(g, -6, -5.8, 0, 4.4, 4.6); shelf(g, -1.6, -5.8, 0, 4.4, 4.6); shelf(g, 8.4, -1, -Math.PI / 2, 4.4, 4.6);
      S.push(desk(g, -4.5, .5, Math.PI, { w: 4.2, sc: '#fde68a' }), desk(g, 3, .5, Math.PI, { sc: '#bef264' })); for (var i = 0; i < 4; i++) box(g, 1, .12 + i * .06, .75, -5.6 + i * .5, 1.55 + i * .06, -.9 + (i % 2) * .3, 0xfafaf9, 1);
      board(g, 4.8, 3.4, -6.5 + .08, 3.2, 1.9, 0, chart()); table(g, 4.5, 4, 2.6, 1.3, 1.1, 0x6b4426); plant(g, -8, 5.2); floorLamp(g, 8, 4.5);
    },
    news: function (g, d, S) {
      rug(g, 0, 2.5, 10, 5, '#1f2a44', 'navy'); var ns = ['BREAKING', 'ECON', 'MARKET']; ns.forEach(function (n, i) { var x = -4 + i * 4; box(g, 3.6, 2.2, .18, x, 3.2, -6.5 + .1, 0x0b1224, 1); var s = new T.Mesh(new T.PlaneGeometry(3.4, 2), new T.MeshBasicMaterial({ map: tvTex(n, ['#ef4444', '#22c55e', '#f59e0b'][i], i + 2) })); s.position.set(x, 3.2, -6.5 + .21); g.add(s); });
      S.push(desk(g, -5.5, .5, Math.PI, { m: -.7, m2: .7, sc: '#93c5fd' }), desk(g, -.5, .5, Math.PI, { sc: '#a7f3d0' }), desk(g, 4.5, .5, Math.PI, { m: -.7, m2: .7, sc: '#fca5a5' }));
      var on = new T.Mesh(new T.PlaneGeometry(2.6, .9), new T.MeshBasicMaterial({ map: neon('ON AIR', '#ef4444'), transparent: true })); on.position.set(8.7, 3.6, 2); on.rotation.y = -Math.PI / 2; g.add(on); cyl(g, .08, .08, 2.6, 7.5, 1.3, 4, 0x20242d, 6); sph(g, .22, 7.5, 2.8, 4, 0x20242d); plant(g, -8, 5.2); floorLamp(g, 8, -4.5);
    },
    sec: function (g, d, S) {
      var cb = G(g, -7.5, -4.6); cyl(cb, .3, .4, 3, 0, 1.5, 0, 0x7a5230, 8); for (var i = 0; i < 6; i++) sph(cb, 1.1, Math.cos(i) * 1.1, 3.4 + (i % 3) * .5, Math.sin(i) * 1.1, pick([0xffb7d5, 0xffc9e0, 0xff9fc6]));
      board(g, 0, 3.2, -6.5 + .08, 4.6, 3.2, 0, calendar()); table(g, -3.2, 2.6, 3.4, 2.4, .8, 0x6b4426); [[-1.6, 2.6], [-4.8, 2.6], [-3.2, 4.4], [-3.2, .8]].forEach(function (a) { box(g, 1, .25, 1, a[0], .15, a[1], 0xf472b6, 1); });
      cyl(g, .3, .3, .34, -3, .98, 2.6, 0xf8fafc, 10); cyl(g, .25, .25, .3, -3.9, .98, 2.2, 0xf8fafc, 10);
      var rc = G(g, 3.6, -1.4); box(rc, 4.6, 1.5, 1.7, 0, .75, 0, 0xf9a8d4); box(rc, 4.8, .16, 1.9, 0, 1.55, 0, 0xfff1f6); box(rc, .8, .3, .6, -1.2, 1.85, .1, 0x20242d, 1); box(rc, .5, .5, .1, 1, 1.85, 0, 0xfb7185, 1);
      S.push({ x: 3.6, z: -3.1, ry: 0, stand: 1, sec: 1 }, desk(g, 7, 3.5, -Math.PI / 2, { sc: '#f9a8d4' }), { x: -3.2, z: .6, ry: 0, sit: 1, chair: 0, low: 1 });
      // ฉากชิโจ (ผนังกระดาษ) แบบรูปอ้างอิงที่ 3
      for (i = 0; i < 4; i++) { box(g, 2, 3.6, .12, -8.8, 2.1, -3.5 + i * 2.4, 0x3b2a1a, 1); box(g, 1.8, 3.4, .06, -8.7, 2.1, -3.5 + i * 2.4, emi(0xffe9b8, .55), 1); box(g, 1.8, .06, .08, -8.68, 2.1, -3.5 + i * 2.4, 0x3b2a1a, 1); }
      plant(g, 8, -5.2); floorLamp(g, 8, 5.2, 0xffc27a);
    }
  };
  RB.__pal = function (g, x, z, ry) { var p = new T.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p); box(p, 1.9, .22, 1.9, 0, .11, 0, 0xc9a26b); for (var i = 0; i < 6; i++) box(p, .9, .9, .9, i % 2 ? .5 : -.5, .7 + Math.floor(i / 4) * 1, (Math.floor(i / 2) % 2) ? .5 : -.5, pick([0xd9ae72, 0x3b82f6, 0xe8c48a])); };
  RB.__fork = function () { var g = new T.Group(); box(g, 1.7, .9, 1.2, 0, .8, 0, 0xfacc15); box(g, 1, .9, 1, -.3, 1.7, 0, 0xfacc15, 1); box(g, .14, 2.2, .14, .85, 1.5, .5, 0x4b5563); box(g, .14, 2.2, .14, .85, 1.5, -.5, 0x4b5563); box(g, .9, .1, .2, 1.3, .3, .4, 0x4b5563); box(g, .9, .1, .2, 1.3, .3, -.4, 0x4b5563); return g; };


  /* ---------- ของตกแต่งเพิ่ม (ห้องใหญ่ขึ้น) ---------- */
  function lounge(g, x, z, c) { var o = G(g, x, z); addBlock(g, x, z, 2.6, 1.6, 0); box(o, 2.4, .5, 1.4, 0, .45, 0, 0x6b4426); box(o, 2.6, .08, 1.6, 0, .72, 0, 0x8a5a33); [[-1.9, 0], [1.9, 0], [0, -1.35], [0, 1.35]].forEach(function (a) { box(o, a[0] ? .95 : 1.1, .22, a[0] ? 1.1 : .95, a[0], .12, a[1], c || 0xc0392b, 1); }); cyl(o, .22, .22, .22, 0, .86, 0, 0xf8fafc, 10); return o; }
  function mannequin(g, x, z, c) { var o = G(g, x, z); addBlock(g, x, z, 1.2, 1.2, 0); cyl(o, .6, .7, .14, 0, .07, 0, 0x2a2f3a, 12); cyl(o, .08, .08, 1.4, 0, .8, 0, 0x9ca3af, 6); cyl(o, .5, .38, 1.5, 0, 2.1, 0, c, 10); sph(o, .32, 0, 3.15, 0, 0xe8d5c0); return o; }
  function tripod(g, x, z) { var o = G(g, x, z); addBlock(g, x, z, 1.2, 1.2, 0); [[-.5, 0], [.5, .1], [0, -.5]].forEach(function (a, i) { var l = cyl(o, .05, .05, 2.4, a[0] * .6, 1.2, a[1] * .6, 0x20242d, 5); l.rotation.z = a[0] * .35; l.rotation.x = a[1] * .35; }); box(o, .8, .6, 1.3, 0, 2.7, 0, 0x151a24); cyl(o, .24, .24, .5, 0, 2.7, .85, 0x3b4252, 10).rotation.x = Math.PI / 2; box(o, .2, .2, .2, 0, 3.1, -.3, 0xef4444, 1); return o; }
  function cherry(g, x, z, s) { s = s || 1; var o = G(g, x, z); addBlock(g, x, z, 1.4 * s, 1.4 * s, 0); cyl(o, .35 * s, .5 * s, 3.4 * s, 0, 1.7 * s, 0, 0x6b4a32, 8); for (var i = 0; i < 7; i++) sph(o, 1.5 * s, Math.cos(i * 2.1) * 1.4 * s, (3.9 + (i % 3) * .55) * s, Math.sin(i * 2.1) * 1.4 * s, pick([0xffb7d5, 0xffc9e0, 0xff9fc6])); return o; }
  function winPane(g, x, y, z, ry, w, h) { var o = G(g, x, z, ry); o.position.y = y; box(o, w + .3, h + .3, .14, 0, 0, 0, 0x3b2a1a, 1); box(o, w, h, .08, 0, 0, .06, emi(0xffe2b0, .75), 1); for (var i = 1; i < 4; i++) box(o, .06, h, .1, -w / 2 + i * w / 4, 0, .1, 0x3b2a1a, 1); box(o, w, .06, .1, 0, 0, .1, 0x3b2a1a, 1); return o; }
  var RX = {
    acc: function (g) { sofa(g, -9.4, 8.7, Math.PI, 0x3b5b8a); table(g, -9.4, 6.9, 2.2, 1.1, .9, 0x6b4426); cyl(g, .45, .45, 2.4, 11.8, 1.2, 8.6, 0x9ccfe8, 10); },
    prod: function (g) { mannequin(g, -11, 8.2, 0xf472b6); mannequin(g, -8.6, 8.4, 0x60a5fa); mannequin(g, 11.4, 4.8, 0xfbbf24); },
    stock: function (g) { RB.__pal(g, -11, 7.6, .2); RB.__pal(g, -9, 5.2, -.1); RB.__pal(g, 11, 8.2, .3); },
    sales: function (g) { table(g, -9.4, 7.9, 3.2, 1.4, 1.1, 0xe5d3b3); for (var i = 0; i < 4; i++) box(g, .9, .6, .8, -10.5 + i * .75, 1.5, 7.9, pick([0xf472b6, 0x38bdf8, 0xfbbf24, 0x34d399])); },
    rent: function (g) { table(g, -9.4, 7.8, 3.4, 2.2, 1.1, 0x6b4426); [[-1, -.4, 1.2, 1.8, 0xe5e7eb], [0, 0, 1, 2.6, 0x93c5fd], [1, .3, 1.1, 1.4, 0xfcd34d]].forEach(function (a) { box(g, a[2], a[3], a[2], -9.4 + a[0] * 1.1, 1.2 + a[3] / 2, 7.8 + a[1], a[4], 1); }); },
    tax: function (g) { for (var i = 0; i < 3; i++) cabinet(g, -11 + i * 1.8, 9.1, Math.PI); },
    news: function (g) { tripod(g, -9.6, 7.6); var l = G(g, -11.6, 5.4); box(l, .1, 3.4, .1, 0, 1.7, 0, 0x20242d); box(l, 1.4, 1.1, .1, 0, 3.4, .1, emi(0xfff4d6, 1.2), 1); },
    sec: function (g) { lounge(g, -9.4, 7.6, 0xf472b6); cherry(g, -12, 4.6, .8); }
  };
  function extras(g, d) {
    [-1, 1].forEach(function (s) { for (var i = 0; i < 3; i++) shelf(g, s * 12.45, -7.4 + i * 4.2, -s * Math.PI / 2, 4, 5.4); });
    [-1, 1].forEach(function (s) { box(g, .8, WH, .8, s * RW / 2, WH / 2, -RD / 2, 0x3b2a1a); box(g, .8, WH, .8, s * RW / 2, WH / 2, RD / 2, 0x3b2a1a); });
    box(g, RW, .4, .5, 0, WH - .2, -RD / 2 + .1, 0x3b2a1a, 1); box(g, .5, .4, RD, -RW / 2 + .1, WH - .2, 0, 0x3b2a1a, 1); box(g, .5, .4, RD, RW / 2 - .1, WH - .2, 0, 0x3b2a1a, 1);
    winPane(g, 0, 3.4, RD / 2 - .1, Math.PI, 5, 2.4); winPane(g, 12.7, 3.2, 0, -Math.PI / 2, 4, 2);
    lounge(g, 9.6, 7.6); plant(g, 12, 8.8, 1.3); plant(g, -12, 8.8, 1.3); floorLamp(g, 12, 3.6, 0xffc27a);
    if (RX[d.k]) RX[d.k](g);
    // เพดาน/คาน/โคมกระดาษ (เห็นเฉพาะโหมดเดิน)
    var X0 = d.rx, Z0 = d.rz; fpAdd(RW, .3, RD, X0, WH + .15, Z0, 'ceil');
    for (var i = -2; i <= 2; i++) fpAdd(.5, .5, RD, X0 + i * 5.2, WH - .1, Z0, 'beam');
    for (i = -1; i <= 1; i += 2) fpAdd(RW, .45, .5, X0, WH - .1, Z0 + i * 4.5, 'beam');
    [[-6, -2], [6, -2], [-6, 5], [6, 5]].forEach(function (a) { fpAdd(.06, 1.4, .06, X0 + a[0], WH - .8, Z0 + a[1], 'beam'); fpAdd(1, 1, 1, X0 + a[0], WH - 1.8, Z0 + a[1], 'lamp'); });
  }
  var FP = [];
  function fpAdd(w, h, d, x, y, z, kind) {
    var m = kind === 'lamp' ? new T.MeshBasicMaterial({ color: 0xffd9a0 }) : kind === 'ceil' ? new T.MeshBasicMaterial({ color: 0x4a3626 }) : kind === 'beam' ? mat(0x2f2118, { roughness: 1 }) : mat(0x3a3f4d, { roughness: .95 });
    var o = new T.Mesh(kind === 'lamp' ? new T.CylinderGeometry(.5, .45, .95, 10) : new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.visible = false; IS.add(o); FP.push(o); return o;
  }

  /* ---------- สร้างฉากภายใน ---------- */
  W.buildInt = function (TH) {
    T = TH; IS = new T.Scene(); IS.background = new T.Color(0x070a12); IS.fog = new T.Fog(0x070a12, 170, 460);
    lights.amb = new T.HemisphereLight(0x8da2d6, 0x2a1b14, .62); IS.add(lights.amb);
    lights.dl = new T.DirectionalLight(0xffe0b0, .62); lights.dl.castShadow = true; lights.dl.shadow.mapSize.set(2048, 2048); lights.dl.shadow.bias = -.0006;
    var sh = lights.dl.shadow.camera; sh.left = -26; sh.right = 26; sh.top = 22; sh.bottom = -22; sh.near = 1; sh.far = 80; IS.add(lights.dl); IS.add(lights.dl.target);
    lights.p1 = new T.PointLight(0xffb066, .85, 30, 1.6); lights.p2 = new T.PointLight(0xffd7a3, .6, 30, 1.6); IS.add(lights.p1); IS.add(lights.p2);
    var out = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshStandardMaterial({ color: 0x0c1220, roughness: 1 })); out.rotation.x = -Math.PI / 2; out.position.y = -.05; out.receiveShadow = true; IS.add(out);
    var cor = new T.Mesh(new T.PlaneGeometry(RW * 4, CW), new T.MeshStandardMaterial({ map: tiles('#2a2f40', 'cor'), roughness: .75 })); cor.rotation.x = -Math.PI / 2; cor.position.set(0, .005, 0); cor.material.map.repeat.set(52, 4.5); cor.receiveShadow = true; IS.add(cor);
    var wallM = mat(0x2d2733, { roughness: .9 }), wallM2 = mat(0x3a3040, { roughness: .9 });
    W.D.forEach(function (d) {
      var g = new T.Group(); g.position.set(d.rx, 0, d.rz); IS.add(g); rooms[d.k] = g; var S = [];
      var fl = d.k === 'sec' ? tatami('tat') : d.k === 'stock' ? tiles('#3a414e', 'tstock') : d.k === 'news' ? tiles('#232a3d', 'tnews') : wood(d.k === 'prod' || d.k === 'sales' ? '#7a5234' : '#5b3a24', d.k === 'prod' || d.k === 'sales' ? '#6a4529' : '#4a2e1b', 'w' + (d.k === 'prod' || d.k === 'sales' ? 1 : 0));
      var f = new T.Mesh(new T.PlaneGeometry(RW, RD), new T.MeshStandardMaterial({ map: fl, roughness: .7 })); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; g.add(f);
      var wc = d.k === 'sec' ? 0x4a3a2c : null, WM = wc || wallM, WM2 = wc || wallM2, HG = 1.8;
      var fg = new T.Group(); fg.position.set(0, 0, OZ); g.add(fg); fg.userData.ox = d.rx; fg.userData.oz = d.rz + OZ;
      function wallX(x0, x1, z, th, m, gx) {
        (gx == null ? [[x0, x1]] : [[x0, gx - HG], [gx + HG, x1]]).forEach(function (a) { box(g, a[1] - a[0], WH, th, (a[0] + a[1]) / 2, WH / 2, z, m); addBlock(g, (a[0] + a[1]) / 2, z, a[1] - a[0], th, 0); });
        if (gx != null) box(g, HG * 2, WH - 4.4, th, gx, (WH + 4.4) / 2, z, m);
      }
      function wallZ(z0, z1, x, th, m, gz) {
        (gz == null ? [[z0, z1]] : [[z0, gz - HG], [gz + HG, z1]]).forEach(function (a) { box(g, th, WH, a[1] - a[0], x, WH / 2, (a[0] + a[1]) / 2, m); addBlock(g, x, (a[0] + a[1]) / 2, th, a[1] - a[0], 0); });
        if (gz != null) box(g, th, WH - 4.4, HG * 2, x, (WH + 4.4) / 2, gz, m);
      }
      wallX(-RW / 2 - .5, RW / 2 + .5, -RD / 2 - .25, .5, WM, d.rc[1] === 1 ? DXL : null);
      wallZ(-RD / 2, RD / 2, -RW / 2 - .25, .5, WM2, d.rc[0] > 0 ? GZ : null); if (d.rc[0] === 3) wallZ(-RD / 2, RD / 2, RW / 2 + .25, .5, WM2, null);
      if (d.rc[1] === 0) { box(g, RW, .14, .16, 0, 1.1, RD / 2, 0x151a24); [[-RW / 2, -HG], [HG, RW / 2]].forEach(function (a) { box(g, a[1] - a[0], .9, .06, (a[0] + a[1]) / 2, .6, RD / 2, mat(0x9fc8ff, { transparent: true, opacity: .22, roughness: .1 }), 1); addBlock(g, (a[0] + a[1]) / 2, RD / 2, a[1] - a[0], .3, 0); }); }
      wallDeco(g, d); RB[d.k](fg, d, S); extras(g, d);
      // ตัวละคร
      var st = d.staff, ti = 0, seats = S.filter(function (s) { return s; });
      st.forEach(function (sf, i) {
        var seat = seats[i], isSec = d.k === 'sec' && i === 0, o = { hair: sf[2], top: sf[3], bot: pick([0x475569, 0x6b7fd6, 0x7c8aa6]), f: !(['พี่โต้ง', 'พี่ต้น', 'พี่เอ', 'ลุงชัย', 'อ.ตั้ม', 'พี่ปั้น', 'พี่ข่าว', 'น้องกัน', 'น้องบีม', 'น้องนิว', 'น้องฟิล์ม'].indexOf(sf[0]) > -1) || isSec, long: i % 2 === 0, bow: [0xf472b6, 0x60a5fa, 0xfbbf24][i % 3], s: isSec ? .92 : .86 };
        var c = W.mkChar(o); g.add(c); var n = { g: c, d: d, name: sf[0], role: sf[1], k: d.k, i: i, sec: isSec, mode: 'idle', st: rnd(0, 5), tg: null, wait: rnd(1, 4) };
        if (seat && seat.chair !== 0 && !seat.stand) { n.mode = 'sit'; n.seat = seat; c.position.set(seat.x, 1.0 - .86 * o.s + .02, seat.z + OZ); c.rotation.y = seat.ry; }
        else if (seat && seat.stand) { n.mode = 'stand'; c.position.set(seat.x, 0, seat.z + OZ); c.rotation.y = seat.ry; }
        else if (seat && seat.sit) { n.mode = 'sit'; n.seat = seat; c.position.set(seat.x, (seat.low ? .38 : 1.0) - .86 * o.s + .02, seat.z + OZ); c.rotation.y = seat.ry; }
        else { n.mode = 'walk'; n.rb = { x0: -7.5, x1: 7.5, z0: 5.9, z1: 8.5 }; c.position.set(rnd(-5, 5), 0, rnd(6, 8.4)); }
        if (isSec) { n.mode = 'stand'; c.position.set(3.6, 0, -3.1 + OZ); c.rotation.y = 0; c.userData.sec = true; c.traverse(function (x) { x.userData.sec = true; }); PK.push(c); W.secInt = c; }
        NP.push(n);
      });
      d.room = g;
    });
    var ep = new T.Mesh(new T.PlaneGeometry(6.6, 4.4), new T.MeshBasicMaterial({ map: cvs(256, 176, function (g) { g.fillStyle = 'rgba(16,185,129,.28)'; g.fillRect(0, 0, 256, 176); g.strokeStyle = '#34d399'; g.lineWidth = 6; g.strokeRect(6, 6, 244, 164); g.fillStyle = '#d1fae5'; g.font = 'bold 40px system-ui,"Noto Sans Thai"'; g.textAlign = 'center'; g.fillText('🚪 ทางออก', 128, 100); }, 'exitpad'), transparent: true, depthWrite: false }));
    ep.rotation.x = -Math.PI / 2; ep.position.set(0, .08, 0); IS.add(ep);
    var bm = new T.Mesh(new T.CylinderGeometry(2.4, 2.4, 9, 20, 1, true), new T.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: .12, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); bm.position.set(0, 4.5, 0); IS.add(bm);
    PLI = W.mkChar({ hair: 0x7cc3ff, top: 0x93c5fd, f: 1, long: 1, bow: 0x60a5fa, s: .86 }); PLI.visible = false; IS.add(PLI); W.PLI = PLI;

    /* ---- ฮอลล์กลาง + ทางเดินกว้าง ---- */
    var wd = mat(0x8a6a45, { roughness: .8 });
    rug(IS, 0, 0, 20, 7, '#7a1f33', 'hall'); rug(IS, -34, 0, 10, 6, '#1f3a5f', 'hl'); rug(IS, 34, 0, 10, 6, '#1f3a5f', 'hr');
    cherry(IS, -8.5, -3.2, 1.1); cherry(IS, 8.5, -3.2, 1.1); plant(IS, -9.5, 3.6, 1.4); plant(IS, 9.5, 3.6, 1.4);
    [-1, 1].forEach(function (s) { for (var i = 0; i < 2; i++) { var bx = s * (44 + i * 6); table(IS, bx, -3.6, 4, 1, .9, 0x6b4426); table(IS, bx, 3.6, 4, 1, .9, 0x6b4426); floorLamp(IS, s * 50.5, i ? 3.6 : -3.6, 0xffc27a); } });
    var hs = new T.Mesh(new T.PlaneGeometry(10, 1.6), new T.MeshBasicMaterial({ map: neon('SMART SHOP · ชั้น 1', '#f9a8d4'), transparent: true })); hs.position.set(0, 5.4, -4.2); IS.add(hs);

    /* ---- ชั้น 2: เลานจ์ระเบียง 2 ฝั่ง + บันไดจากฮอลล์ ---- */
    var n0 = IS.children.length;
    var dk = new T.Group(); dk.position.y = PY; dk.userData.lv = 1; IS.add(dk);
    var gl = mat(0x9fc8ff, { transparent: true, opacity: .22, roughness: .1 });
    [-1, 1].forEach(function (s) {
      box(IS, 26, .4, CW, s * 37, PY - .2, 0, wd); box(IS, 26, .1, CW, s * 37, PY + .02, 0, mat(0x6b4a2b, { roughness: .9 }), 1);
      [-1, 1].forEach(function (q) { box(dk, 26, .9, .06, s * 37, .6, q * 4.5, gl, 1); box(dk, 26, .12, .14, s * 37, 1.1, q * 4.5, 0x3b2a1a, 1); box(IS, 26, .5, .3, s * 37, PY - .5, q * 4.6, 0x3b2a1a, 1); });
      box(dk, .06, .9, CW, s * 50, .6, 0, gl, 1); box(dk, .14, .12, CW, s * 50, 1.1, 0, 0x3b2a1a, 1);
      for (var i = 0; i < 9; i++) { var hh = (i + 1) * PY / 9; box(IS, 1, hh, 3.6, s * (15 + i + .5), hh / 2, 0, i % 2 ? 0x9a7650 : 0x8a6a45); }
      var ang = Math.atan2(PY, 9), L = Math.hypot(9, PY);
      [-1.85, 1.85].forEach(function (q) { var bar = box(IS, L, .1, .1, s * 19.5, PY / 2 + 1.05, q, 0x3b2a1a, 1); bar.rotation.z = s * ang; for (var i = 0; i <= 9; i += 3) box(IS, .1, 1.1, .1, s * (15 + i), i * PY / 9 + .55, q, 0x3b2a1a, 1); });
      BL.push({ x0: s > 0 ? 15 : -24, x1: s > 0 ? 24 : -15, z0: -2.05, z1: -1.75, lv: 2 }, { x0: s > 0 ? 15 : -24, x1: s > 0 ? 24 : -15, z0: 1.75, z1: 2.05, lv: 2 }, { x0: s > 0 ? 23.6 : -24.4, x1: s > 0 ? 24.4 : -23.6, z0: -2, z1: 2, lv: 0 });
      /* ของในเลานจ์ */
      shelf(dk, s * 49.2, -2.4, -s * Math.PI / 2, 4, 5.4); shelf(dk, s * 49.2, 2.4, -s * Math.PI / 2, 4, 5.4);
      sofa(dk, s * 32, -3.1, 0, 0x7c3aed); sofa(dk, s * 40, -3.1, 0, 0x0f766e); sofa(dk, s * 32, 3.1, Math.PI, 0xdb2777); sofa(dk, s * 40, 3.1, Math.PI, 0x2563eb);
      table(dk, s * 36, 0, 3.4, 1.8, .8, 0x6b4426); rug(dk, s * 36, 0, 12, 6, s > 0 ? '#14532d' : '#7c2d12', 'dk' + s);
      plant(dk, s * 27, -3.6, 1.2); plant(dk, s * 27, 3.6, 1.2); plant(dk, s * 47.5, -3.7, 1.2); floorLamp(dk, s * 47, 3.4, 0xffc27a); floorLamp(dk, s * 28.5, 0, 0xffc27a);
      var sg = new T.Mesh(new T.PlaneGeometry(7, 1.3), new T.MeshBasicMaterial({ map: neon(s > 0 ? 'ชั้น 2 · เลานจ์' : 'ชั้น 2 · ห้องสมุด', s > 0 ? '#a7f3d0' : '#fde68a'), transparent: true })); sg.position.set(s * 23.6, PY + 3, 0); sg.rotation.y = -s * Math.PI / 2; IS.add(sg);
      [-1, 1].forEach(function (q) { cherry(IS, s * 19, q * 3.4 + (q < 0 ? -.4 : .4), .55); });
    });
    var UP = new T.Group(); IS.children.slice(n0).forEach(function (c) { UP.add(c); }); UP.visible = false; IS.add(UP);

    /* ---- เพดาน/ผนังเฉพาะโหมดเดิน ---- */
    fpAdd(104.6, .3, CW, 0, CH, 0, 'ceil'); fpAdd(.5, CH, CW, -52.25, CH / 2, 0); fpAdd(.5, CH, CW, 52.25, CH / 2, 0);
    fpAdd(104.6, CH - WH, .5, 0, (CH + WH) / 2, -CW / 2); fpAdd(104.6, CH - WH, .5, 0, (CH + WH) / 2, CW / 2);
    fpAdd(104.6, WH, .5, 0, WH / 2, CW / 2 + RD + .25);
    for (var bi = -4; bi <= 4; bi++) fpAdd(.6, .5, CW, bi * 11.5, CH - .3, 0, 'beam');
    for (bi = -3; bi <= 3; bi++) { fpAdd(.06, 1.6, .06, bi * 15, CH - 1.1, 2, 'beam'); fpAdd(1.3, 1.3, 1.3, bi * 15, CH - 2.3, 2, 'lamp'); fpAdd(.06, 1.6, .06, bi * 15, CH - 1.1, -2, 'beam'); fpAdd(1.3, 1.3, 1.3, bi * 15, CH - 2.3, -2, 'lamp'); }
    W.INT = { npcs: NP, scene: IS, blockers: BL, fpOnly: FP, up: UP };
  };

  /* ---------- กล้อง/ลูป ---------- */
  function insets(w, h) { var wide = w > 1000; return { l: wide ? 270 : 0, r: wide ? 300 : 0, t: wide ? 128 : 124, b: 84 }; }
  function distFor(room, w, h) {
    var t = Math.tan(19 * Math.PI / 180), I = insets(w, h), a = w / h, fw = Math.max(200, w - I.l - I.r), fh = Math.max(200, h - I.t - I.b);
    if (room === 'all') return Math.max(RW * 4 * 1.04 / (2 * t * a * fw / w), (RD * 2 + CW + 3) * 1.0 / (2 * t * fh / h), 60);
    return Math.max(RD * 1.5 / (2 * t * fh / h), RW * 1.22 / (2 * t * a * fw / w), 30);
  }
  W.intGround = function (x, z, lv) {
    var ax = Math.abs(x), az = Math.abs(z);
    if (ax >= 15 && ax < 24 && az < 1.95) return PY * (ax - 15) / 9;
    if (lv === 1 && ax >= 24 && ax <= 50 && az < 4.6) return PY;
    return 0;
  };
  W.intBlocked = function (x, z, R, lv) {
    R = R == null ? .55 : R; lv = lv || 0; var ax = Math.abs(x), az = Math.abs(z);
    if (ax > 51.4 || az > 23.3) return true;
    if (lv === 1) { if (ax >= 23.2 && ax <= 49.2) { if (az > 3.9) return true; } else if (ax >= 14.6 && ax < 23.2) { if (az > 1.45) return true; } else return true; }
    for (var i = 0; i < BL.length; i++) { var b = BL[i]; if (b.lv !== 2 && b.lv !== lv) continue; if (x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R) return true; } return false;
  };
  W.roomAt = function (x, z) { var c = Math.floor((x + 52) / RW), r = z < -CW / 2 ? 0 : z > CW / 2 ? 1 : -1; if (r < 0 || c < 0 || c > 3) return null; var k = null; W.D.forEach(function (d) { if (d.rc[0] === c && d.rc[1] === r) k = d.k; }); return k; };
  W.intFocus = function (room, instant) { foc.room = room; if (instant) cur.init = false; };
  W.intPick = function () { return PK; };
  W.intFrame = function (dt, t, a, w, h, free) {
    var V = W.V, rm = foc.room, d = W.BD[rm], tx = d ? d.rx : 0, tz = d ? d.rz + .8 : 0, td = distFor(rm, w, h), el = rm === 'all' ? 1.08 : .98, I = insets(w, h);
    if (free) { var cp = W.pc.position; tx = cp.x; tz = cp.z; cur.init = false; if (W.pc.fov !== W.CAM.fov) { W.pc.fov = W.CAM.fov; W.pc.updateProjectionMatrix(); } }
    else { if (W.pc.fov !== 38) { W.pc.fov = 38; W.pc.updateProjectionMatrix(); } W.pc.setViewOffset(w, h, -(I.l - I.r) / 2, -(I.t - I.b) / 2, w, h); }
    if (!cur.init && !free) { cur.x = tx; cur.z = tz; cur.d = td * 1.15; cur.el = el; cur.init = true; }
    var k = Math.min(1, dt * 4); cur.x += (tx - cur.x) * k; cur.z += (tz - cur.z) * k; cur.d += (td - cur.d) * k; cur.el += (el - cur.el) * k;
    if (!free) { var dd = cur.d * V.dz, yaw = V.yaw;
      W.pc.position.set(cur.x + Math.sin(yaw) * Math.cos(cur.el) * dd, Math.sin(cur.el) * dd + .5, cur.z + Math.cos(yaw) * Math.cos(cur.el) * dd); W.pc.lookAt(cur.x, 1.2, cur.z); }
    // แสง
    var ov = rm === 'all' && !free; lights.amb.intensity += ((ov ? .95 : .55) - lights.amb.intensity) * k; lights.dl.castShadow = !ov;
    lights.dl.position.set(tx + 8, 18, tz + 10); lights.dl.target.position.set(tx, 0, tz);
    lights.p1.position.set(tx - 4, 4.2, tz + 1); lights.p2.position.set(tx + 4.5, 4.2, tz + 2); lights.p1.intensity = ov ? .15 : .85; lights.p2.intensity = ov ? .15 : .6;
    NP.forEach(function (n) { stepNpc(n, dt, t); });
    sayT -= dt; if (sayT <= 0) { sayT = rnd(2.4, 4.2); say(); }
    return IS;
  };
  function stepNpc(n, dt, t) {
    var g = n.g, s = t + n.st;
    if (n.mode === 'sit') { W.pose(g, s, 'sit'); }
    else if (n.mode === 'stand') { W.pose(g, s, n.sec ? 'wave' : 'idle'); if (n.sec && ((Math.floor(s / 5)) % 2)) W.pose(g, s, 'idle'); }
    else if (n.mode === 'walk') {
      if (n.wait > 0) { n.wait -= dt; W.pose(g, s, 'idle'); return; }
      if (!n.tg) n.tg = { x: rnd(n.rb.x0, n.rb.x1), z: rnd(n.rb.z0, n.rb.z1) };
      var dx = n.tg.x - g.position.x, dz = n.tg.z - g.position.z, L = Math.hypot(dx, dz);
      if (L < .25) { n.tg = null; n.wait = rnd(2, 6); return; }
      g.position.x += dx / L * 2.4 * dt; g.position.z += dz / L * 2.4 * dt;
      var ty = Math.atan2(dx, dz), df = ty - g.rotation.y; while (df > Math.PI) df -= 6.283; while (df < -Math.PI) df += 6.283; g.rotation.y += df * Math.min(1, dt * 8);
      W.pose(g, s, 'walk'); g.position.y = Math.abs(Math.sin(s * 9)) * .05;
    }
  }
  function say() {
    var inRoom = NP.filter(function (n) { return foc.room === 'all' || n.k === foc.room; }), pool = inRoom.length && Math.random() < .8 ? inRoom : NP, n = pick(pool), d = n.d;
    if (W.cb.say) W.cb.say({ n: n, text: pick(d.say) });
  }
})();
