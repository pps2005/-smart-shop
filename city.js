/* SMART SHOP add-on: city.js - เมือง 3D Voxel (Three.js) 1 อาคาร = 1 ฝ่าย, หน้า AI เป็นหน้าแรก
   โหลดท้ายสุดใน index.html. ยกเลิก: ลบบรรทัด <script src="city.js"> */
(function () {
  'use strict';
  var ai = M.find(function (m) { return m.id === 'ai'; });
  if (ai) { M.splice(M.indexOf(ai), 1); M.unshift(ai); }
  S.cur = 'ai';

  var css = document.createElement('style');
  css.textContent = '#city{position:relative;height:62vh;min-height:360px;border-radius:18px;overflow:hidden;background:#9ad1f5;margin:10px 0}#city canvas{width:100%;height:100%;display:block;image-rendering:pixelated;touch-action:none}#office,.ofn{display:none!important}' +
    '.cbar{position:absolute;top:8px;left:8px;display:flex;gap:6px;z-index:2}.cbar button{padding:8px 12px;border-radius:10px;background:rgba(15,23,42,.75);color:#fff;font-size:.8rem;font-weight:700}.cbar .on{background:#34d27b;color:#04210f}' +
    '#cjoy{position:absolute;left:14px;bottom:14px;width:96px;height:96px;border-radius:50%;background:rgba(255,255,255,.25);border:2px solid rgba(255,255,255,.6);display:none;touch-action:none;z-index:2}#cjoy i{position:absolute;left:30px;top:30px;width:36px;height:36px;border-radius:50%;background:rgba(15,23,42,.8)}' +
    '#ctalk{position:absolute;right:14px;bottom:14px;display:none;padding:12px 18px;border-radius:12px;background:#34d27b;color:#04210f;font-weight:800;z-index:2}';
  document.head.appendChild(css);

  var W = 12, P = 10, SP = 26, Q = .6;
  var D = [
    { k: 'acc', n: 'ฝ่ายบัญชี', who: 'พี่นุ่น (บัญชี)', c: 0x2f9e5b, x: -1, z: -1, fl: 5, hair: 0x3b2a1a, sh: 0x16a34a, say: ['ตัวเลขต้องตรงทุกบาทนะคะ', 'อยากรู้กำไรเดือนนี้ กดดูรายละเอียดได้เลย', 'ใบเสร็จครบหรือยังคะ เดี๋ยวบัญชีไม่ลงตัว'] },
    { k: 'prod', n: 'ฝ่ายสินค้า', who: 'น้องมิกซ์ (สินค้า)', c: 0xd9702a, x: 0, z: -1, fl: 4, hair: 0x1f1f1f, sh: 0xea580c, say: ['วันนี้มีของใหม่เข้าเพียบเลยครับ', 'รุ่นไหนขายดี ถามผมได้นะ', 'ผมจำรหัสสินค้าได้หมดเลย เทพไหมล่ะ'] },
    { k: 'stock', n: 'ฝ่ายคลัง', who: 'ลุงชัย (คลัง)', c: 0x1b8aa6, x: 1, z: -1, fl: 6, hair: 0x6b7280, sh: 0x0891b2, say: ['ของอยู่ครบ ลุงนับเองกับมือ', 'ย้ายของแล้วอย่าลืมบันทึกนะ', 'หลังบ้านเย็นสบาย มานั่งพักก่อนก็ได้'] },
    { k: 'sales', n: 'ฝ่ายขาย', who: 'พี่เอ (ขาย)', c: 0xc2306f, x: -1, z: 0, fl: 4, hair: 0x2b1b12, sh: 0xdb2777, say: ['วันนี้ต้องปิดยอดให้ได้ สู้ ๆ!', 'ลูกค้ามาเมื่อไหร่ เรียกพี่ได้เลย', 'โปรโมชันวันนี้ ลดแรงจัด'] },
    { k: 'ai', n: 'ศูนย์ AI', who: 'ออโต้ (ผู้จัดการ AI)', c: 0x7c4dd6, x: 0, z: 0, fl: 6, hair: 0x94a3b8, sh: 0x6d28d9, say: ['ประมวลผลเรียบร้อย ถามได้ทุกฝ่าย', 'บี๊บ ๆ ฉันสรุปจากข้อมูลจริงเท่านั้น', 'พิมพ์คำถามด้านล่างได้เลยครับ'] },
    { k: 'rent', n: 'ฝ่ายอสังหา', who: 'ป้าหมวย (อสังหา)', c: 0x2f6fd6, x: 1, z: 0, fl: 5, hair: 0x7c2d12, sh: 0x2563eb, say: ['ค่าเช่าถึงกำหนดอย่าลืมตามนะลูก', 'ห้องว่างมีคนสนใจเยอะเลยจ้ะ', 'ป้าดูแลทุกห้องเหมือนบ้านตัวเองเลย'] },
    { k: 'tax', n: 'ฝ่ายภาษี', who: 'อาจารย์ตั้ม (ภาษี)', c: 0x8a6d3b, x: -1, z: 1, fl: 4, hair: 0x374151, sh: 0x78350f, say: ['ภาษีวางแผนล่วงหน้าดีกว่าแก้ทีหลัง', 'ลดหย่อนอย่าลืมเก็บหลักฐานนะ', 'ตัวเลขนี้เป็นประมาณการ ยื่นจริงเช็คกับสรรพากร'] },
    { k: 'news', n: 'ฝ่ายข่าว', who: 'พี่ข่าว (เศรษฐกิจ)', c: 0x4a5568, x: 0, z: 1, fl: 5, hair: 0x111827, sh: 0x1f2937, say: ['ข่าวด่วน! ... ยังไม่ได้ต่อสายข่าวเลยครับ', 'อยากรู้ว่าเศรษฐกิจกระทบร้านยังไง ต้องรอต่อระบบก่อน', 'ผมไม่แต่งข่าวเองนะ ต้องมีแหล่งจริง'] },
    { k: 'sec', n: 'ฝ่ายเลขา', who: 'น้องฟ้า (เลขา)', c: 0xd96b8a, x: 1, z: 1, fl: 4, hair: 0x4a2c17, sh: 0xe11d48, say: ['ตารางเดือนนี้ให้ฟ้าจัดการเองค่ะ', 'มีนัดอะไรบอกฟ้าได้เลย เดี๋ยวเตือนให้', 'อย่าลืมพักผ่อนด้วยนะคะ'] }
  ];
  var sc, rd, oc, pc, BXG, CE, last = 0, cw = 0, ch = 0, ray, CL = [], NP = [], PL, near = null, MC = {};
  var V = { mode: 'iso', th: Math.PI / 4, zoom: 1, yaw: 0, px: 0, pz: 13, jx: 0, jy: 0 }, keys = {};
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function tdy() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); }
  function kv(a, b) { return '<div class="kv"><span>' + a + '</span><b>' + b + '</b></div>'; }

  /* ---------- วัสดุ/เรขาคณิต ---------- */
  function shade(h, k) { var f = function (v) { return Math.max(0, Math.min(255, Math.round(v + k * 255))); }; return 'rgb(' + f(h >> 16 & 255) + ',' + f(h >> 8 & 255) + ',' + f(h & 255) + ')'; }
  function ptex(base, vr, rep) {
    var c = document.createElement('canvas'); c.width = c.height = 16; var g = c.getContext('2d');
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { g.fillStyle = shade(base, (Math.random() - .5) * vr + (y % 8 === 0 ? -.06 : 0)); g.fillRect(x, y, 1, 1); }
    var t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep || 3, rep || 3); return t;
  }
  function stex(t, col) {
    var c = document.createElement('canvas'); c.width = 256; c.height = 48; var g = c.getContext('2d');
    g.fillStyle = '#10151d'; g.fillRect(0, 0, 256, 48); g.fillStyle = col; g.fillRect(0, 0, 256, 5);
    g.fillStyle = '#fff'; g.font = 'bold 26px system-ui,"Noto Sans Thai",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 128, 27);
    var x = new THREE.CanvasTexture(c); x.magFilter = x.minFilter = THREE.NearestFilter; return x;
  }
  function mt(c) { return MC[c] || (MC[c] = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: .9 })); }
  function bx(g, w, h, d, x, y, z, m) { var o = new THREE.Mesh(BXG, m); o.scale.set(w, h, d); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; }
  var dm;
  function inst(g, m, L) {
    var o = new THREE.InstancedMesh(BXG, m, L.length);
    L.forEach(function (a, i) { dm.position.set(a[0], a[1], a[2]); dm.scale.set(a[3], a[4], a[5]); dm.updateMatrix(); o.setMatrixAt(i, dm.matrix); });
    o.castShadow = o.receiveShadow = true; g.add(o);
  }

  function building(d) {
    var g = new THREE.Group(), H = d.fl * 3, y0 = .7, wl = new THREE.MeshStandardMaterial({ map: ptex(d.c, .12, 3), flatShading: true }),
      tr = mt(0xeee8da), dk = mt(0x2b3440), ac = mt(d.c),
      gl = new THREE.MeshStandardMaterial({ color: 0x8fd3f5, emissive: 0x1c5a80, emissiveIntensity: .45, roughness: .2, metalness: .4 });
    bx(g, 18, .2, 18, 0, .1, 0, mt(0xbdb7a8));
    bx(g, W + 1.6, .5, P + 1.6, 0, .45, 0, tr);
    bx(g, W, H, P, 0, y0 + H / 2, 0, wl);
    for (var f = 1; f <= d.fl; f++) bx(g, W + .4, .25, P + .4, 0, y0 + f * 3 - .1, 0, tr);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (a) { bx(g, .9, H, .9, a[0] * W / 2, y0 + H / 2, a[1] * P / 2, tr); });
    bx(g, W - 4, 2.4, P - 4, 0, y0 + H + 1.2, 0, wl); bx(g, W - 3.4, .3, P - 3.4, 0, y0 + H + 2.55, 0, tr);
    bx(g, W, .7, .3, 0, y0 + H + .35, P / 2 - .15, ac); bx(g, W, .7, .3, 0, y0 + H + .35, -P / 2 + .15, ac);
    bx(g, .3, .7, P, W / 2 - .15, y0 + H + .35, 0, ac); bx(g, .3, .7, P, -W / 2 + .15, y0 + H + .35, 0, ac);
    bx(g, 1.6, .9, 1.2, -4, y0 + H + 1.1, 2, mt(0xb8c0c8)); bx(g, 1.6, .9, 1.2, 4, y0 + H + 1.1, -2, mt(0xb8c0c8)); bx(g, .2, 3, .2, 2, y0 + H + 4, -1, dk);
    bx(g, .25, 1.6, .25, -3.6, y0 + H + 3.3, 3.2, dk); bx(g, .25, 1.6, .25, 3.6, y0 + H + 3.3, 3.2, dk);
    bx(g, 8.4, 1.7, .3, 0, y0 + H + 4.2, 3.25, dk);
    var sg = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.4), new THREE.MeshBasicMaterial({ map: stex(d.n, '#' + ('000000' + d.c.toString(16)).slice(-6)) }));
    sg.position.set(0, y0 + H + 4.2, 3.42); g.add(sg);
    var G = [], F = [], SL = [];
    for (var r = 0; r < d.fl; r++) {
      var y = y0 + r * 3 + 1.7;
      [-4.5, -1.5, 1.5, 4.5].forEach(function (x) { [P / 2, -P / 2].forEach(function (z) {
        if (z > 0 && r === 0 && Math.abs(x) < 2.5) return; var s = z > 0 ? 1 : -1;
        G.push([x, y, z + s * .05, 1.9, 1.6, .2]); F.push([x, y, z + s * .02, 2.3, 2, .2]); SL.push([x, y - 1.05, z + s * .25, 2.5, .22, .5]);
      }); });
      [-3, 0, 3].forEach(function (zz) { [W / 2, -W / 2].forEach(function (x) { var s = x > 0 ? 1 : -1;
        G.push([x + s * .05, y, zz, .2, 1.6, 1.9]); F.push([x + s * .02, y, zz, .2, 2, 2.3]); SL.push([x + s * .25, y - 1.05, zz, .5, .22, 2.5]);
      }); });
    }
    inst(g, gl, G); inst(g, dk, F); inst(g, tr, SL);
    bx(g, 2.6, 2.6, .2, 0, y0 + 1.3, P / 2 + .05, gl); bx(g, 3.2, 3, .18, 0, y0 + 1.5, P / 2 + .02, dk);
    bx(g, 5.4, .3, 2.4, 0, y0 + 3.2, P / 2 + 1.2, ac); bx(g, .25, 3.2, .25, -2.5, y0 + 1.6, P / 2 + 2.2, tr); bx(g, .25, 3.2, .25, 2.5, y0 + 1.6, P / 2 + 2.2, tr);
    bx(g, 4.4, .25, 1.2, 0, .55, P / 2 + 1.4, mt(0xcfc8b8));
    [-1, 1].forEach(function (s) {
      bx(g, .6, 1.6, .6, s * 8, 1, 7.5, mt(0x6b4a2b)); bx(g, 2.4, 1.8, 2.4, s * 8, 2.6, 7.5, mt(s > 0 ? 0x3f9b3a : 0x4aa84a)); bx(g, 1.6, 1.2, 1.6, s * 8, 3.9, 7.5, mt(0x5cbf56));
      bx(g, .2, 4, .2, s * 6, 2.2, 8.4, dk); bx(g, .9, .4, .5, s * 6, 4.3, 8.4, mt(0xfff3b0));
    });
    return g;
  }
  function person(hair, sh) {
    var g = new THREE.Group(), sk = mt(0xf2c9a0);
    bx(g, .7, .9, .4, 0, .9, 0, mt(sh)); bx(g, .55, .55, .55, 0, 1.65, 0, sk); bx(g, .6, .22, .6, 0, 1.98, 0, mt(hair)); bx(g, .6, .5, .12, 0, 1.78, -.2, mt(hair));
    bx(g, .25, .6, .25, -.17, .3, 0, mt(0x374151)); bx(g, .25, .6, .25, .17, .3, 0, mt(0x374151));
    bx(g, .2, .8, .22, -.47, .95, 0, mt(sh)); bx(g, .2, .8, .22, .47, .95, 0, mt(sh));
    g.scale.setScalar(1.5); return g;
  }

  /* ---------- ฉาก ---------- */
  function init() {
    BXG = new THREE.BoxGeometry(1, 1, 1); dm = new THREE.Object3D();
    sc = new THREE.Scene(); sc.background = new THREE.Color(0x9ad1f5); sc.fog = new THREE.Fog(0x9ad1f5, 110, 240);
    rd = new THREE.WebGLRenderer({ antialias: false }); rd.shadowMap.enabled = true; CE.insertBefore(rd.domElement, CE.firstChild);
    oc = new THREE.OrthographicCamera(-1, 1, 1, -1, -300, 400); pc = new THREE.PerspectiveCamera(65, 1, .1, 400); ray = new THREE.Raycaster();
    sc.add(new THREE.HemisphereLight(0xcfe8ff, 0x6b8f4e, .75));
    var sun = new THREE.DirectionalLight(0xfff1d0, .95); sun.position.set(50, 80, 35); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    var sh = sun.shadow.camera; sh.left = -80; sh.right = 80; sh.top = 80; sh.bottom = -80; sh.far = 220; sc.add(sun);
    var gt = ptex(0x6aa84f, .16, 60), gr = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ map: gt, flatShading: true }));
    gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true; sc.add(gr);
    [-39, -13, 13, 39].forEach(function (v) { bx(sc, 100, .1, 7, 0, .06, v, mt(0x4b5563)); bx(sc, 7, .1, 100, v, .06, 0, mt(0x4b5563)); });
    D.forEach(function (d) {
      var b = building(d); b.position.set(d.x * SP, 0, d.z * SP); b.userData.k = d.k; sc.add(b); CL.push(b);
      var p = person(d.hair, d.sh); p.userData.k = d.k; p.position.set(d.x * SP + (Math.random() - .5) * 6, 0, d.z * SP + 8);
      sc.add(p); CL.push(p); NP.push({ d: d, k: d.k, g: p, tx: p.position.x, w: Math.random() * 2, X: d.x * SP });
    });
    PL = person(0x222222, 0xfacc15); PL.position.set(V.px, 0, V.pz); sc.add(PL);
    bind(); requestAnimationFrame(tick);
  }
  function blocked(x, z) { return D.some(function (d) { return Math.abs(x - d.x * SP) < 7.4 && Math.abs(z - d.z * SP) < 6.4; }); }
  function tick(ts) {
    requestAnimationFrame(tick);
    if (!rd || !CE.isConnected) return;
    var dt = Math.min(.05, (ts - last) / 1000); last = ts;
    var w = CE.clientWidth, h = CE.clientHeight;
    if (!w || !h) return;
    if (w !== cw || h !== ch) { cw = w; ch = h; rd.setSize(w * Q, h * Q, false); pc.aspect = w / h; pc.updateProjectionMatrix(); }
    var walk = V.mode !== 'iso';
    if (walk) {
      var kx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), ky = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
      var jx = Math.max(-1, Math.min(1, V.jx + kx)), jy = Math.max(-1, Math.min(1, V.jy + ky));
      var fx = -Math.sin(V.yaw), fz = -Math.cos(V.yaw), rx = Math.cos(V.yaw), rz = -Math.sin(V.yaw), sp = 9 * dt;
      var nx = V.px + (fx * -jy + rx * jx) * sp, nz = V.pz + (fz * -jy + rz * jx) * sp;
      nx = Math.max(-55, Math.min(55, nx)); nz = Math.max(-55, Math.min(55, nz));
      if (!blocked(nx, V.pz)) V.px = nx; if (!blocked(V.px, nz)) V.pz = nz;
      PL.position.set(V.px, Math.abs(jx) + Math.abs(jy) > .1 ? Math.abs(Math.sin(ts / 90)) * .12 : 0, V.pz); PL.rotation.y = V.yaw + Math.PI;
    }
    near = null; var nd = 25;
    NP.forEach(function (n) {
      var p = n.g.position, dx = n.tx - p.x;
      if (Math.abs(dx) > .1) { p.x += Math.sign(dx) * 1.3 * dt; n.g.rotation.y = dx > 0 ? Math.PI / 2 : -Math.PI / 2; p.y = Math.abs(Math.sin(ts / 140)) * .1; }
      else { p.y = 0; n.g.rotation.y = 0; n.w -= dt; if (n.w <= 0) { n.tx = n.X + (Math.random() - .5) * 10; n.w = 1 + Math.random() * 3; } }
      var d2 = (p.x - V.px) * (p.x - V.px) + (p.z - V.pz) * (p.z - V.pz); if (walk && d2 < nd) { nd = d2; near = n; }
    });
    $('ctalk').style.display = near ? 'block' : 'none';
    PL.visible = V.mode !== 'first'; var cam;
    if (!walk) {
      var a = w / h, vh = 90 / V.zoom, el = .62, R = 100; cam = oc;
      oc.left = -vh * a / 2; oc.right = vh * a / 2; oc.top = vh / 2; oc.bottom = -vh / 2; oc.updateProjectionMatrix();
      oc.position.set(Math.sin(V.th) * Math.cos(el) * R, Math.sin(el) * R, Math.cos(V.th) * Math.cos(el) * R); oc.lookAt(0, 0, 0);
    } else {
      cam = pc; var fx2 = -Math.sin(V.yaw), fz2 = -Math.cos(V.yaw);
      if (V.mode === 'third') { pc.position.set(V.px - fx2 * 7, 4.6, V.pz - fz2 * 7); pc.lookAt(V.px + fx2 * 3, 2.2, V.pz + fz2 * 3); }
      else { pc.position.set(V.px, 2.7, V.pz); pc.lookAt(V.px + fx2 * 5, 2.5, V.pz + fz2 * 5); }
    }
    rd.render(sc, cam);
  }

  /* ---------- ควบคุม ---------- */
  function bind() {
    var c = rd.domElement, ps = {}, mv = 0, pd = 0;
    c.addEventListener('pointerdown', function (e) { c.setPointerCapture(e.pointerId); ps[e.pointerId] = { x: e.clientX, y: e.clientY }; mv = 0; if (Object.keys(ps).length === 2) { var a = Object.values(ps); pd = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); } });
    c.addEventListener('pointermove', function (e) {
      var p = ps[e.pointerId]; if (!p) return; var n = Object.keys(ps).length, dx = e.clientX - p.x;
      mv += Math.abs(dx) + Math.abs(e.clientY - p.y);
      if (n === 1) { if (V.mode === 'iso') V.th -= dx * .01; else V.yaw -= dx * .008; }
      p.x = e.clientX; p.y = e.clientY;
      if (n === 2) { var a = Object.values(ps), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); if (pd) V.zoom = Math.max(.6, Math.min(3, V.zoom * d / pd)); pd = d; }
    });
    function up(e) {
      if (ps[e.pointerId] && Object.keys(ps).length === 1 && mv < 8) tap(e);
      delete ps[e.pointerId]; pd = 0;
    }
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', function (e) { delete ps[e.pointerId]; });
    c.addEventListener('wheel', function (e) { e.preventDefault(); V.zoom = Math.max(.6, Math.min(3, V.zoom * Math.exp(-e.deltaY * .001))); }, { passive: false });
    window.addEventListener('keydown', function (e) { if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return; keys[e.key.toLowerCase()] = 1; });
    window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = 0; });
    var jy = $('cjoy'), kn = jy.firstChild, jid = null;
    function jm(e) { var r = jy.getBoundingClientRect(), x = (e.clientX - r.left - 48) / 40, y = (e.clientY - r.top - 48) / 40, l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } V.jx = x; V.jy = y; kn.style.transform = 'translate(' + x * 30 + 'px,' + y * 30 + 'px)'; }
    jy.addEventListener('pointerdown', function (e) { jid = e.pointerId; jy.setPointerCapture(jid); jm(e); });
    jy.addEventListener('pointermove', function (e) { if (e.pointerId === jid) jm(e); });
    function je() { jid = null; V.jx = V.jy = 0; kn.style.transform = ''; }
    jy.addEventListener('pointerup', je); jy.addEventListener('pointercancel', je);
  }
  function tap(e) {
    var r = rd.domElement.getBoundingClientRect(), v = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v, V.mode === 'iso' ? oc : pc);
    var h = ray.intersectObjects(CL, true)[0]; if (!h) return;
    var o = h.object; while (o && !o.userData.k) o = o.parent;
    if (!o) return;
    if (o.children.length > 12) A.cdept(o.userData.k); else talk(o.userData.k);
  }
  A.cmode = function (m) {
    V.mode = m; if (m !== 'iso') { V.jx = V.jy = 0; }
    CE.querySelectorAll('.cbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === m); });
    $('cjoy').style.display = m === 'iso' ? 'none' : 'block';
  };
  A.ctalk = function () { if (near) talk(near.k); };

  /* ---------- NPC คุยได้ ---------- */
  function talk(k) {
    var d = D.find(function (x) { return x.k === k; }); if (!d) return;
    var line = k === 'sec' && pendingN() ? 'ตอนนี้มีงานค้างอยู่ ' + pendingN() + ' รายการค่ะ' : pick(d.say);
    openSheet(head(esc(d.who)) + '<div class="bub" id="cline">' + esc(line) + '</div><div class="btns"><button class="btn o" data-a="cchat" data-v="' + k + '">คุยเล่น</button><button class="btn" data-a="cdept" data-v="' + k + '">ขอดูรายละเอียด</button></div>');
  }
  A.cchat = function (k) { var d = D.find(function (x) { return x.k === k; }), e = $('cline'); if (d && e) e.textContent = pick(d.say); };

  /* ---------- ฝ่ายต่าง ๆ ---------- */
  function extra(k) {
    if (k !== 'prod' && k !== 'stock') return;
    var m = {}; (S.prods || []).forEach(function (p) { var c = p.categories ? p.categories.name : 'อื่น ๆ', o = m[c] || (m[c] = { n: 0, q: 0, v: 0 }); o.n++; o.q += pq(p); o.v += pq(p) * Number(p.current_cost); });
    $('sbody').insertAdjacentHTML('beforeend', '<details class="tri" open><summary>แยกตามประเภท</summary>' + Object.keys(m).map(function (c) {
      return '<div class="kv"><span>' + esc(c) + '<br><small>' + m[c].n + ' รุ่น</small></span><span>' + m[c].q + ' ชิ้น<br><small>ทุน ฿' + fmt(m[c].v) + '</small></span></div>';
    }).join('') + '</details>');
  }
  A.cdept = function (k) {
    if (k === 'tax') return taxSheet(); if (k === 'news') return newsSheet(); if (k === 'sec') return secSheet();
    if (A.ofc) A.ofc(k); extra(k);
  };
  async function taxSheet() {
    openSheet(head('ฝ่ายภาษี') + '<div id="txb" class="empty">กำลังคำนวณ...</div>');
    try {
      var y = tdy().slice(0, 4);
      var a = await S.sb.from('sales').select('qty,unit_price,unit_cost').is('voided_at', null).gte('created_at', y + '-01-01T00:00:00+07:00').limit(5000);
      var e = await S.sb.from('expenses').select('amount').is('voided_at', null).gte('paid_on', y + '-01-01').limit(5000);
      if (a.error || e.error) throw (a.error || e.error);
      var inc = 0, cg = 0; a.data.forEach(function (x) { inc += x.unit_price * x.qty; cg += x.unit_cost * x.qty; });
      var ex = e.data.reduce(function (t, x) { return t + Number(x.amount); }, 0), c = window.SmartShopTax.calc({ shop_inc: inc, shop_exp: cg + ex, shop_m: 'actual' });
      if (!$('txb')) return;
      $('txb').outerHTML = kv('ยอดขายสะสมปีนี้', '฿' + fmt(Math.round(inc))) + kv('ต้นทุนขาย + รายจ่าย', '฿' + fmt(Math.round(cg + ex))) + kv('กำไรสะสม', '฿' + fmt(Math.round(inc - cg - ex))) +
        kv('เงินได้สุทธิ (หักลดหย่อนส่วนตัว)', '฿' + fmt(Math.round(c.net))) + kv('ภาษีประมาณการ', '฿' + fmt(Math.round(c.tax))) +
        '<div class="note" style="margin:10px 0">ประมาณการจากร้านค้าอย่างเดียว ยังไม่รวมค่าเช่า/ลดหย่อนอื่น ใช้หน้าภาษีเพื่อกรอกละเอียด</div><button class="btn" data-a="go" data-v="tax">ไปหน้าคำนวณภาษี</button>';
    } catch (x) { if ($('txb')) $('txb').textContent = 'คำนวณไม่สำเร็จ: ' + (x.message || x); }
  }
  function newsSheet() {
    openSheet(head('ฝ่ายข่าวเศรษฐกิจ') + '<div class="note"><b>สถานะ: ยังไม่เชื่อมต่อ</b><br>ฝ่ายนี้ต้องดึงข่าวจริงและวิเคราะห์ผลกระทบต่อร้าน ซึ่งต้องใช้ AI API และแหล่งข่าวผ่านเซิร์ฟเวอร์ (Supabase Edge Function) มีค่าใช้จ่ายตามการใช้งาน ระบบจะไม่แต่งข่าวเอง จะเปิดให้เมื่อคุณอนุญาต</div>');
  }

  /* ---------- ฝ่ายเลขา: ตาราง/งาน/แจ้งเตือน (เก็บในเครื่องนี้) ---------- */
  var TK = []; try { TK = JSON.parse(localStorage.getItem('ss_tasks') || '[]'); } catch (e) {}
  function saveTK() { try { localStorage.setItem('ss_tasks', JSON.stringify(TK)); } catch (e) {} }
  function pendingN() { return TK.filter(function (t) { return !t.done && t.d <= tdy(); }).length; }
  function rentItems(ym) {
    var X = window.SSRent, o = []; if (!X || !X.R.loaded) return o;
    X.R.pays.forEach(function (r) { if (r._left > 0 && X.eff(r).slice(0, 7) === ym) { var l = X.R.leases.find(function (z) { return z.id === r.lease_id; }), u = l && X.unit(l.unit_id); o.push({ d: X.eff(r), t: 'เก็บค่าเช่า ' + (u ? X.uname(u) : '') + ' ฿' + fmt(r._left), auto: 1 }); } });
    return o;
  }
  function secSheet() {
    var ym = tdy().slice(0, 7), L = TK.filter(function (t) { return t.d.slice(0, 7) === ym; }).concat(rentItems(ym));
    L.sort(function (a, b) { return (a.d + (a.h || '')) < (b.d + (b.h || '')) ? -1 : 1; });
    openSheet(head('ฝ่ายเลขา') + '<small>ตารางเดือนนี้ (ค่าเช่าที่ใกล้ครบกำหนดดึงมาให้อัตโนมัติ)</small>' + (L.length ? L.map(function (t) {
      return '<div class="kv" style="align-items:flex-start;' + (t.done ? 'opacity:.55' : '') + '"><span>' + t.d.slice(8) + '/' + t.d.slice(5, 7) + (t.h ? ' ' + t.h : '') + '<br>' + (t.done ? '<s>' + esc(t.t) + '</s>' : esc(t.t)) + '</span>' +
        (t.auto ? '' : '<span><button class="dsm" style="color:var(--text);border-color:var(--line)" data-a="tkdone" data-v="' + t.id + '">' + (t.done ? 'เปิดใหม่' : 'เสร็จ') + '</button> <button class="dsm" data-a="tkdel" data-v="' + t.id + '">ลบ</button></span>') + '</div>';
    }).join('') : '<div class="empty">ยังไม่มีงานเดือนนี้</div>') +
      '<h3 style="margin-top:14px">เพิ่มงาน / นัดหมาย</h3><label>เรื่องที่ต้องทำ<input id="tkt" placeholder="เช่น โทรตามค่าเช่า"></label><div class="two"><label>วันที่<input id="tkd" type="date" value="' + tdy() + '"></label><label>เวลาเตือน<input id="tkh" type="time"></label></div><div class="err" id="tker"></div><button class="btn" data-a="tkadd">บันทึกและเตือน</button>' +
      '<small>แจ้งเตือนเด้งเมื่อเปิดแอปอยู่ตอนถึงเวลา ข้อมูลเก็บในเครื่องนี้</small>');
  }
  A.tkadd = function () {
    var t = $('tkt').value.trim(), d = $('tkd').value;
    if (!t || !d) { $('tker').textContent = 'ใส่เรื่องและวันที่'; return; }
    TK.push({ id: String(Date.now()), t: t, d: d, h: $('tkh').value || '', done: 0, n: 0 }); saveTK();
    if (window.Notification && Notification.permission === 'default') Notification.requestPermission();
    secSheet(); toast('บันทึกงานแล้ว');
  };
  A.tkdone = function (id) { var t = TK.find(function (x) { return x.id === id; }); if (t) { t.done = t.done ? 0 : 1; saveTK(); secSheet(); } };
  A.tkdel = function (id) { TK = TK.filter(function (x) { return x.id !== id; }); saveTK(); secSheet(); };
  setInterval(function () {
    var now = new Date();
    TK.forEach(function (t) {
      if (t.done || t.n || new Date(t.d + 'T' + (t.h || '09:00') + ':00') > now) return;
      t.n = 1; saveTK(); toast('เลขาเตือน: ' + t.t);
      try { if (window.Notification && Notification.permission === 'granted') new Notification('SMART SHOP', { body: t.t }); } catch (e) {}
    });
  }, 30000);

  /* ---------- AI chat ครอบคลุมทุกฝ่าย ---------- */
  var _as = A.aisend;
  A.aisend = function () {
    var i = $('aiin'), v = i && i.value.trim(), k = null;
    if (v) {
      if (/ภาษี/.test(v)) k = 'tax'; else if (/ข่าว/.test(v)) k = 'news'; else if (/งาน|ตาราง|นัด|เตือน|เลขา/.test(v)) k = 'sec';
      else if (/ค่าเช่า|ห้อง|ผู้เช่า/.test(v)) k = 'rent'; else if (/คลัง|สต๊อก|สต็อก/.test(v)) k = 'stock'; else if (/บัญชี|รายจ่าย/.test(v)) k = 'acc';
    }
    if (k) { i.value = ''; return A.cdept(k); }
    return _as.apply(this, arguments);
  };

  /* ---------- ผูกกับหน้า AI ---------- */
  var _r = render;
  render = function () {
    _r.apply(this, arguments);
    if (!(S.ready && S.cur === 'ai')) return;
    var h = $('view').querySelector('h2'); if (!h) return;
    if (!CE) {
      CE = document.createElement('div'); CE.id = 'city';
      CE.innerHTML = '<div class="cbar"><button data-a="cmode" data-v="iso" class="on">มุมสูง</button><button data-a="cmode" data-v="third">บุคคลที่ 3</button><button data-a="cmode" data-v="first">บุคคลที่ 1</button></div><div id="cjoy"><i></i></div><button id="ctalk" data-a="ctalk">คุยกับ NPC</button>';
    }
    h.insertAdjacentElement('afterend', CE);
    if (!rd) {
      if (window.THREE) init();
      else { var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'; s.onload = init; s.onerror = function () { CE.insertAdjacentHTML('beforeend', '<div style="padding:60px 16px;text-align:center">โหลด Three.js ไม่ได้ ตรวจสอบอินเทอร์เน็ต</div>'); }; document.head.appendChild(s); }
    }
  };
  if (S.ready) render();
})();
