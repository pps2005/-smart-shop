/* Xiress add-on: city.js v2 - เมือง 3D (Three.js r128)
   1 อาคาร = 1 ฝ่าย: เดินเข้าตึกได้ มีห้องข้างใน, คนในเมืองเยอะ, ตัวละครใหม่, NPC ทุกคนพิมพ์ถามได้ (ตอบจากข้อมูลจริงของร้าน)
   โหลดท้ายสุดใน index.html. ยกเลิก: ลบบรรทัด <script src="city.js"> */
(function () {
  'use strict';
  var ai = M.find(function (m) { return m.id === 'ai'; });
  if (ai) { M.splice(M.indexOf(ai), 1); M.unshift(ai); }
  S.cur = 'ai';

  var css = document.createElement('style');
  css.textContent = [
    '#city{position:relative;height:74vh;min-height:440px;border-radius:18px;overflow:hidden;background:#bfe0f7;margin:10px 0}#city canvas{width:100%;height:100%;display:block;touch-action:none}#office,.ofn{display:none!important}',
    '.cbar{position:absolute;top:8px;left:8px;display:flex;gap:6px;z-index:2}.cbar button,#cplace button{padding:8px 12px;border-radius:10px;background:rgba(15,23,42,.78);color:#fff;font-size:.8rem;font-weight:700}.cbar .on{background:#34d27b;color:#04210f}',
    '#cplace{position:absolute;top:8px;right:8px;z-index:2}#cplace button{background:#ef4444}',
    '.chint{position:absolute;left:0;right:0;top:50px;text-align:center;font-size:.72rem;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.7);pointer-events:none;z-index:2}',
    '#cjoy{position:absolute;left:14px;bottom:14px;width:96px;height:96px;border-radius:50%;background:rgba(255,255,255,.25);border:2px solid rgba(255,255,255,.6);display:none;touch-action:none;z-index:2}#cjoy i{position:absolute;left:30px;top:30px;width:36px;height:36px;border-radius:50%;background:rgba(15,23,42,.8)}',
    '#ctalk{position:absolute;right:14px;bottom:14px;display:none;padding:12px 18px;border-radius:12px;background:#34d27b;color:#04210f;font-weight:800;z-index:2}',
    '.cm{max-height:36vh;overflow:auto;display:flex;flex-direction:column;gap:8px;margin:10px 0}.cm>div{max-width:88%;padding:8px 12px;border-radius:14px;background:var(--bg);line-height:1.5;font-size:.9rem}.cm .u{align-self:flex-end;background:#34d27b;color:#04210f}',
    '.cr{display:flex;gap:8px;margin-top:8px}.cr input{flex:1;margin:0!important}'
  ].join('');
  document.head.appendChild(css);

  var W = 12, P = 9, SP = 26;
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
  var FEM = { acc: 1, rent: 1, sec: 1, sales: 1 };
  D.forEach(function (d) { d.f = !!FEM[d.k]; });
  var sc, rd, oc, pc, BXG, CE, IL, ray, last = 0, cw = 0, ch = 0, TL = [], NP = [], CR = [], PL, near = null, MC = {}, PG = {}, BD = {}, RM = {}, CH = { npc: null }, dm;
  var V = { mode: 'iso', th: Math.PI / 4, zoom: 1.15, yaw: 0, px: 0, pz: 13, jx: 0, jy: 0, inn: null }, keys = {};
  var RD = [-39, -13, 13, 39], DK = [[-7.5, -1], [7.5, -1], [-7.5, 3.5], [7.5, 3.5]];
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function tdy() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); }
  function kv(a, b) { return '<div class="kv"><span>' + a + '</span><b>' + b + '</b></div>'; }

  /* ---------- วัสดุ/เรขาคณิต ---------- */
  function shade(h, k) { var f = function (v) { return Math.max(0, Math.min(255, Math.round(v + k * 255))); }; return 'rgb(' + f(h >> 16 & 255) + ',' + f(h >> 8 & 255) + ',' + f(h & 255) + ')'; }
  function ptex(base, vr, rep) {
    var c = document.createElement('canvas'); c.width = c.height = 32; var g = c.getContext('2d');
    for (var y = 0; y < 32; y += 2) for (var x = 0; x < 32; x += 2) { g.fillStyle = shade(base, (Math.random() - .5) * vr); g.fillRect(x, y, 2, 2); }
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep || 3, rep || 3); t.anisotropy = 4; return t;
  }
  function stex(t, col) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 96; var g = c.getContext('2d');
    g.fillStyle = '#10151d'; g.fillRect(0, 0, 512, 96); g.fillStyle = col; g.fillRect(0, 0, 512, 10);
    g.fillStyle = '#fff'; g.font = 'bold 52px system-ui,"Noto Sans Thai",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 256, 54);
    var x = new THREE.CanvasTexture(c); x.anisotropy = 4; return x;
  }
  function facade(base, bays, fl) {
    var c = document.createElement('canvas'); c.width = 96 * bays; c.height = 96; var g = c.getContext('2d'), x, i;
    g.fillStyle = shade(base, 0); g.fillRect(0, 0, c.width, 96);
    for (i = 0; i < 500; i++) { g.fillStyle = shade(base, (Math.random() - .5) * .08); g.fillRect(Math.random() * c.width | 0, Math.random() * 96 | 0, 3, 3); }
    g.fillStyle = shade(base, .16); g.fillRect(0, 88, c.width, 8);
    for (x = 0; x < bays; x++) {
      var X = x * 96 + 18, lit = Math.random() < .3, gr = g.createLinearGradient(0, 16, 0, 74);
      gr.addColorStop(0, lit ? '#ffe9a8' : '#c9ebff'); gr.addColorStop(1, lit ? '#f7c566' : '#5fa6d6');
      g.fillStyle = '#f4efe4'; g.fillRect(X - 4, 12, 68, 66); g.fillStyle = gr; g.fillRect(X, 16, 60, 58);
      g.fillStyle = '#f4efe4'; g.fillRect(X + 28, 16, 4, 58); g.fillRect(X, 42, 60, 4);
      g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(X + 4, 18, 10, 52); g.fillStyle = shade(base, -.22); g.fillRect(X - 6, 78, 72, 5);
    }
    var t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, fl); return t;
  }
  function mt(c) { return MC[c] || (MC[c] = new THREE.MeshStandardMaterial({ color: c, roughness: .85 })); }
  function gm(k, f) { return PG[k] || (PG[k] = f()); }
  function bx(g, w, h, d, x, y, z, m) { var o = new THREE.Mesh(BXG, m); o.scale.set(w, h, d); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; }
  function pl(g, w, h, x, y, z, ry, m) { var o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; }
  function tree(g, x, z, s) {
    bx(g, .5 * s, 2 * s, .5 * s, x, s, z, mt(0x6b4a2b));
    var o = new THREE.Mesh(gm('lf', function () { return new THREE.SphereGeometry(1.5, 10, 8); }), mt(pick([0x3f9b3a, 0x4aa84a, 0x58b552]))); o.scale.setScalar(s); o.position.set(x, 3 * s, z); o.castShadow = true; g.add(o);
  }

  /* ---------- อาคาร ---------- */
  function building(d) {
    var g = new THREE.Group(), H = d.fl * 3, y0 = .7, tr = mt(0xeee8da), dk = mt(0x2b3440), ac = mt(d.c), rf = mt(0x59606b),
      gl = new THREE.MeshStandardMaterial({ color: 0x8fd3f5, emissive: 0x1c5a80, emissiveIntensity: .4, roughness: .2, metalness: .4 }),
      fm = new THREE.MeshStandardMaterial({ map: facade(d.c, 4, d.fl), roughness: .8 }), sm = new THREE.MeshStandardMaterial({ map: facade(d.c, 3, d.fl), roughness: .8 });
    bx(g, 18.6, .2, 18.6, 0, .1, 0, mt(0xcfc9bb)); bx(g, W + 1.2, .5, P + 1.2, 0, .45, 0, tr);
    var m = new THREE.Mesh(BXG, [sm, sm, rf, rf, fm, fm]); m.scale.set(W, H, P); m.position.set(0, y0 + H / 2, 0); m.castShadow = m.receiveShadow = true; g.add(m);
    for (var f = 1; f <= d.fl; f++) bx(g, W + .4, .22, P + .4, 0, y0 + f * 3 - .08, 0, tr);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (a) { bx(g, .8, H, .8, a[0] * W / 2, y0 + H / 2, a[1] * P / 2, tr); });
    bx(g, W, .7, .3, 0, y0 + H + .35, P / 2 - .15, ac); bx(g, W, .7, .3, 0, y0 + H + .35, -P / 2 + .15, ac); bx(g, .3, .7, P, W / 2 - .15, y0 + H + .35, 0, ac); bx(g, .3, .7, P, -W / 2 + .15, y0 + H + .35, 0, ac);
    bx(g, 2, 1, 1.4, -3.5, y0 + H + .9, 1, mt(0xb8c0c8)); bx(g, 2, 1, 1.4, 3.5, y0 + H + .9, -1.2, mt(0xb8c0c8));
    var tk = new THREE.Mesh(gm('tk', function () { return new THREE.CylinderGeometry(.9, .9, 1.6, 12); }), mt(0x8b6b4a)); tk.position.set(-3.5, y0 + H + 1.2, -2.5); g.add(tk);
    bx(g, .25, 1.7, .25, -3.6, y0 + H + 1.55, 3.5, dk); bx(g, .25, 1.7, .25, 3.6, y0 + H + 1.55, 3.5, dk); bx(g, 8.6, 1.8, .3, 0, y0 + H + 3.3, 3.6, dk);
    pl(g, 8.2, 1.5, 0, y0 + H + 3.3, 3.77, 0, new THREE.MeshBasicMaterial({ map: stex(d.n, '#' + ('000000' + d.c.toString(16)).slice(-6)) }));
    bx(g, 6, 3.1, 1.6, 0, y0 + 1.55, P / 2 + .8, mt(0xf6f1e6)); bx(g, 5.2, 2.1, .1, 0, y0 + 1.4, P / 2 + 1.62, gl);
    bx(g, 1.9, 2.5, .12, 0, y0 + 1.25, P / 2 + 1.68, mt(0x3b2a1a)); bx(g, .1, .45, .1, .6, y0 + 1.25, P / 2 + 1.78, mt(0xe0b341));
    bx(g, 6.6, .3, 2.3, 0, y0 + 3.25, P / 2 + 1.1, ac); pl(g, 4.6, .86, 0, y0 + 3.0, P / 2 + 2.27, 0, new THREE.MeshBasicMaterial({ map: stex(d.n, '#' + ('000000' + d.c.toString(16)).slice(-6)) }));
    [-1, 1].forEach(function (s) { bx(g, 1.1, .7, 1.1, s * 4, y0 + .35, P / 2 + 1.5, mt(0x7a5230)); bx(g, .9, .8, .9, s * 4, y0 + 1, P / 2 + 1.5, mt(0x4aa84a)); });
    bx(g, 4.4, .12, 1.8, 0, .56, P / 2 + 2.5, mt(0xb9b2a0));
    return g;
  }
  function lamp(x, z) { var g = sc; bx(g, .2, 4.6, .2, x, 2.3, z, mt(0x2b3440)); bx(g, .9, .22, .4, x, 4.6, z, mt(0xfff3b0)); }

  /* ---------- ตัวละคร ---------- */
  function person(o) {
    var g = new THREE.Group(), sk = mt(o.skin), sm = mt(o.sh), pm = mt(o.pants || 0x334155), hm = mt(o.hair), dk = mt(0x1b1b1b), L = [], R = [];
    function add(geo, m, x, y, z, p) { var s = new THREE.Mesh(geo, m); s.position.set(x, y, z); (p || g).add(s); return s; }
    add(gm('t', function () { return new THREE.CylinderGeometry(.28, .24, .78, 12); }), sm, 0, 1.17, 0);
    add(gm('h', function () { return new THREE.SphereGeometry(.29, 16, 12); }), sk, 0, 1.8, 0);
    add(gm('hc', function () { return new THREE.SphereGeometry(.315, 16, 10, 0, Math.PI * 2, 0, Math.PI * .56); }), hm, 0, 1.83, -.02);
    var hb = add(gm('hb', function () { return new THREE.SphereGeometry(.3, 12, 10); }), hm, 0, o.f ? 1.6 : 1.76, -.1); hb.scale.set(1, o.f ? 1.6 : .7, .7);
    [-1, 1].forEach(function (s) {
      add(gm('e', function () { return new THREE.SphereGeometry(.035, 6, 6); }), dk, s * .1, 1.82, .27);
      var a = new THREE.Group(); a.position.set(s * .36, 1.5, 0); g.add(a); R.push(a);
      add(gm('a', function () { return new THREE.CylinderGeometry(.075, .07, .56, 8); }), sm, 0, -.27, 0, a); add(gm('hd', function () { return new THREE.SphereGeometry(.075, 8, 6); }), sk, 0, -.58, 0, a);
      var l = new THREE.Group(); l.position.set(s * .12, .8, 0); g.add(l); L.push(l);
      add(gm('l', function () { return new THREE.CylinderGeometry(.1, .09, .7, 8); }), pm, 0, -.36, 0, l); add(gm('s', function () { return new THREE.BoxGeometry(.18, .1, .3); }), dk, 0, -.75, .05, l);
    });
    if (o.f) add(gm('sk', function () { return new THREE.CylinderGeometry(.2, .38, .42, 14); }), mt(o.sk2 || o.sh), 0, .98, 0);
    g.scale.setScalar(1.35); g.userData.L = L; g.userData.R = R;
    if (o.cast) g.traverse(function (x) { x.castShadow = true; });
    else { var bl = new THREE.Mesh(gm('bl', function () { return new THREE.CircleGeometry(.5, 12); }), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .25 })); bl.rotation.x = -Math.PI / 2; bl.position.y = .03; g.add(bl); }
    var ht = new THREE.Mesh(gm('ht', function () { return new THREE.CylinderGeometry(.7, .7, 2.3, 8); }), new THREE.MeshBasicMaterial({ visible: false })); ht.position.y = 1.15; g.add(ht);
    return g;
  }
  function pose(g, t, mv) { var s = mv ? Math.sin(t * 8) * .7 : 0, u = g.userData; u.L[0].rotation.x = s; u.L[1].rotation.x = -s; u.R[0].rotation.x = -s * .8; u.R[1].rotation.x = s * .8; }
  function setPos(n) { if (n.ax === 'x') n.g.position.set(n.p, 0, n.ln); else if (n.ax === 'z') n.g.position.set(n.ln, 0, n.p); }
  function mkNpc(name, say, k, o, mv) {
    var g = person(o), n = { name: name, say: say, k: k, g: g, ph: Math.random() * 6, pz: 0, sp: 0, dir: 1 }, a;
    for (a in mv) n[a] = mv[a]; g.userData.npc = n; sc.add(g); TL.push(g); NP.push(n); setPos(n); return n;
  }
  function car(col) {
    var g = new THREE.Group(), dk = mt(0x1b1b1b);
    bx(g, 2.2, .8, 4.2, 0, .75, 0, mt(col)); bx(g, 1.9, .7, 2.2, 0, 1.45, -.2, mt(0xcfe8f7));
    [[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]].forEach(function (w) { bx(g, .3, .7, .7, w[0] * 1.1, .38, w[1], dk); });
    [-.7, .7].forEach(function (x) { bx(g, .4, .25, .1, x, .8, 2.1, mt(0xfff3b0)); }); return g;
  }
  function room(d, i) {
    var g = new THREE.Group(), ox = 300 + i * 40, wl = mt(0xf3ece0), ac = mt(d.c), dk = mt(0x2b3440), k = d.k, sg = '#' + ('000000' + d.c.toString(16)).slice(-6);
    g.position.set(ox, 0, 0); RM[d.k] = { ox: ox };
    bx(g, 24, .3, 16, 0, -.15, 0, new THREE.MeshStandardMaterial({ map: ptex(0xb98a56, .12, 8), roughness: .8 }));
    pl(g, 24, 8, 0, 4, -8, 0, wl); pl(g, 16, 8, -12, 4, 0, Math.PI / 2, wl); pl(g, 16, 8, 12, 4, 0, -Math.PI / 2, wl);
    pl(g, 10.4, 8, -6.8, 4, 8, Math.PI, wl); pl(g, 10.4, 8, 6.8, 4, 8, Math.PI, wl); pl(g, 3.2, 4.6, 0, 5.7, 8, Math.PI, wl);
    pl(g, 24, 2.4, 0, 1.2, -7.98, 0, ac); pl(g, 8, 1.5, 0, 5.4, -7.95, 0, new THREE.MeshBasicMaterial({ map: stex(d.n, sg) }));
    pl(g, 2.6, .5, 0, 3.8, 7.95, Math.PI, new THREE.MeshBasicMaterial({ map: stex('ทางออก', '#16a34a') }));
    [-4, 0, 4].forEach(function (z) { pl(g, 2.6, 2.6, -11.95, 4.4, z, Math.PI / 2, new THREE.MeshBasicMaterial({ color: 0xa8dcff })); pl(g, 2.6, 2.6, 11.95, 4.4, z, -Math.PI / 2, new THREE.MeshBasicMaterial({ color: 0xa8dcff })); });
    bx(g, 9, .03, 5.5, 0, .02, 2.2, ac); bx(g, 8.2, .04, 4.7, 0, .03, 2.2, mt(0xf1e7d3));
    bx(g, 8, 1.2, 1.6, 0, .6, -3.2, ac); bx(g, 8.3, .15, 1.9, 0, 1.27, -3.2, mt(0xffffff));
    DK.forEach(function (a) {
      bx(g, 3.4, .9, 1.6, a[0], .45, a[1], mt(0xcaa57a)); bx(g, 1.2, .8, .1, a[0], 1.5, a[1] - .4, dk); bx(g, 1.05, .65, .04, a[0], 1.5, a[1] - .34, new THREE.MeshBasicMaterial({ color: 0x7cc4ff }));
      bx(g, .9, .8, .9, a[0], .4, a[1] + 1.5, ac); bx(g, .9, .9, .15, a[0], 1.1, a[1] + 1.95, ac);
    });
    [-1, 1].forEach(function (s) {
      bx(g, .8, 5, 10, s * 11.5, 2.5, -.5, mt(0x8b5a2b));
      for (var r = 0; r < 3; r++) for (var c = 0; c < 5; c++) bx(g, .6, .7, 1.2, s * 11.2, 1.2 + r * 1.5, -4.2 + c * 1.9, mt(pick([0xef4444, 0x3b82f6, 0xf59e0b, 0x10b981, 0x8b5cf6, 0xfafafa])));
      bx(g, 1, .7, 1, s * 10.4, .35, -6.4, mt(0x7a5230)); bx(g, .9, 1.1, .9, s * 10.4, 1.2, -6.4, mt(0x4aa84a));
    });
    if (/prod|stock|sales/.test(k)) [[-3, 5.5], [3, 5.8], [-9.5, 6.3]].forEach(function (a) { bx(g, 1.4, 1.2, 1.4, a[0], .6, a[1], mt(0xc9a064)); bx(g, 1.2, 1, 1.2, a[0] + .2, 1.7, a[1], mt(0xd9b57a)); });
    if (/ai|news|tax/.test(k)) [-3, -1.5, 1.5, 3].forEach(function (x) { bx(g, 1, 3.4, 1, x, 1.7, -7.2, dk); bx(g, .7, .12, .05, x, 2.8, -6.65, new THREE.MeshBasicMaterial({ color: 0x4ade80 })); bx(g, .7, .12, .05, x, 2.3, -6.65, new THREE.MeshBasicMaterial({ color: 0x60a5fa })); });
    sc.add(g); return ox;
  }

  /* ---------- ฉาก ---------- */
  var CN = [['ลุงแดง', 'ผมมาซื้อของที่ร้านนี้ประจำเลย'], ['น้องพลอย', 'วันนี้อากาศดี เดินเล่นสบาย ๆ ค่ะ'], ['ป้าแอน', 'ตึกบัญชีอยู่แถวกลางเมืองนะจ๊ะ'], ['พี่บอย', 'ขอไปส่งของก่อนนะครับ'], ['น้องเอ็ม', 'ร้านนี้มีของใหม่ทุกอาทิตย์เลย'], ['คุณหญิง', 'เดินเล่นยามเย็นดีต่อสุขภาพนะคะ'], ['ลุงสมศักดิ์', 'สมัยก่อนที่นี่เป็นแค่ทุ่งนา'], ['น้องมะปราง', 'หนูรอเพื่อนอยู่ค่ะ'], ['พี่ต้น', 'เมืองนี้ใหญ่ขึ้นทุกวันเลย'], ['ป้าสมจิตร', 'ซื้อของเข้าร้านครบหรือยังลูก']];
  var SK = [0xf2c9a0, 0xe3b389, 0xc68a5e, 0x9a6b45], HR = [0x1f1f1f, 0x3b2a1a, 0x6b4423, 0x111827, 0x7c2d12, 0xb08968], SH = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899, 0x14b8a6, 0xf97316], PN = [0x334155, 0x1e3a8a, 0x44403c, 0x1f2937];
  function init() {
    BXG = new THREE.BoxGeometry(1, 1, 1); dm = new THREE.Object3D();
    var sk = document.createElement('canvas'); sk.width = 4; sk.height = 256; var sg = sk.getContext('2d'), gr = sg.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#5aa9ea'); gr.addColorStop(.7, '#cfe8fa'); gr.addColorStop(1, '#f4f9ff'); sg.fillStyle = gr; sg.fillRect(0, 0, 4, 256);
    sc = new THREE.Scene(); sc.background = new THREE.CanvasTexture(sk); sc.fog = new THREE.Fog(0xd6eafa, 120, 260);
    rd = new THREE.WebGLRenderer({ antialias: true }); rd.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); rd.shadowMap.enabled = true; rd.shadowMap.type = THREE.PCFSoftShadowMap; CE.insertBefore(rd.domElement, CE.firstChild);
    oc = new THREE.OrthographicCamera(-1, 1, 1, -1, -300, 400); pc = new THREE.PerspectiveCamera(65, 1, .1, 400); ray = new THREE.Raycaster();
    sc.add(new THREE.HemisphereLight(0xdcefff, 0x78945a, .8));
    var sun = new THREE.DirectionalLight(0xfff1d0, .9); sun.position.set(50, 80, 35); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004;
    var sh = sun.shadow.camera; sh.left = -75; sh.right = 75; sh.top = 75; sh.bottom = -75; sh.far = 220; sc.add(sun);
    IL = new THREE.PointLight(0xfff0d8, .9, 45); IL.position.set(300, 6, 0); sc.add(IL);
    var gr2 = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ map: ptex(0x6aa84f, .16, 90), roughness: 1 })); gr2.rotation.x = -Math.PI / 2; gr2.receiveShadow = true; sc.add(gr2);
    var asp = mt(0x464c57), sw = mt(0xd8d3c6), SEG = [[-55, -42.5], [-35.5, -16.5], [-9.5, 9.5], [16.5, 35.5], [42.5, 55]], dash = [];
    RD.forEach(function (r) {
      bx(sc, 112, .1, 7, 0, .06, r, asp); bx(sc, 7, .1, 112, r, .06, 0, asp);
      SEG.forEach(function (s) { [-4.6, 4.6].forEach(function (o) { var m = (s[0] + s[1]) / 2, l = s[1] - s[0]; bx(sc, l, .22, 2.2, m, .11, r + o, sw); bx(sc, 2.2, .22, l, r + o, .11, m, sw); }); });
      for (var p = -54; p < 54; p += 6) if (!RD.some(function (q) { return Math.abs(p - q) < 5.5; })) { dash.push([p, r, 2.4, .25]); dash.push([r, p, .25, 2.4]); }
    });
    var di = new THREE.InstancedMesh(BXG, mt(0xf5e6a0), dash.length);
    dash.forEach(function (a, i) { dm.position.set(a[0], .13, a[1]); dm.scale.set(a[2], .02, a[3]); dm.updateMatrix(); di.setMatrixAt(i, dm.matrix); }); sc.add(di);
    RD.forEach(function (r) { [-45, -15, 15, 45].forEach(function (t) { lamp(t, r + 3.9); lamp(r + 3.9, t); }); });
    for (var i = 0; i < 14; i++) { var a = i / 14 * Math.PI * 2, R = 78 + Math.random() * 14, h = 14 + Math.random() * 30, w = 8 + Math.random() * 6, tw = new THREE.Mesh(BXG, new THREE.MeshStandardMaterial({ map: facade(pick([0x8a9bb0, 0xa0a8b5, 0x9a8f86, 0x7f94a8]), 4, Math.round(h / 3)), roughness: .8 })); tw.scale.set(w, h, w); tw.position.set(Math.cos(a) * R, h / 2, Math.sin(a) * R); tw.castShadow = true; sc.add(tw); }
    for (i = 0; i < 46; i++) { var tx = (Math.random() - .5) * 200, tz = (Math.random() - .5) * 200; if (Math.abs(tx) < 58 && Math.abs(tz) < 58) continue; tree(sc, tx, tz, .8 + Math.random() * .8); }
    D.forEach(function (d, i) {
      BD[d.k] = d; var b = building(d), bx0 = d.x * SP, bz0 = d.z * SP; b.position.set(bx0, 0, bz0); b.userData.k = d.k; sc.add(b); TL.push(b);
      [-1, 1].forEach(function (s) { tree(sc, bx0 + s * 9, bz0 + 7.6, .7); }); var ox = room(d, i);
      mkNpc(d.who, d.say, d.k, { skin: pick(SK), hair: d.hair, sh: d.sh, pants: 0x334155, f: d.f, cast: true }, { ax: 'x', ln: bz0 + 8.3, p: bx0 + Math.random() * 6 - 3, dir: 1, sp: 1.1, lo: bx0 - 6, hi: bx0 + 6 });
      mkNpc(d.who, d.say, d.k, { skin: pick(SK), hair: d.hair, sh: d.sh, pants: 0x334155, f: d.f, cast: true }, { ax: 'x', ln: -4.8, p: ox, sp: 0, lo: ox, hi: ox, inside: 1 });
      mkNpc('พนักงานทั่วไป', ['วันนี้งานเยอะเลย ถามหัวหน้าได้นะ', 'กาแฟหมดแล้ว ไปชงก่อนนะ'], null, { skin: pick(SK), hair: pick(HR), sh: pick(SH), pants: pick(PN), f: i % 2 === 0, cast: false }, { ax: 'x', ln: 5.8, p: ox, dir: 1, sp: .9, lo: ox - 9, hi: ox + 9 });
      mkNpc('น้องฝึกงาน', ['หนูกำลังฝึกงานอยู่ค่ะ', 'ขอเรียนรู้จากพี่ ๆ ก่อนนะครับ'], null, { skin: pick(SK), hair: pick(HR), sh: pick(SH), pants: pick(PN), f: i % 2 === 1, cast: false }, { ax: 'x', ln: 1.3, p: ox, dir: -1, sp: .8, lo: ox - 4.5, hi: ox + 4.5 });
    });
    for (i = 0; i < 34; i++) {
      var c = CN[i % CN.length], r2 = pick(RD), ax = Math.random() < .5 ? 'x' : 'z';
      mkNpc(c[0], [c[1], 'ถามเรื่องร้านได้นะ ผมตอบจากข้อมูลจริงเท่านั้น'], null, { skin: pick(SK), hair: pick(HR), sh: pick(SH), pants: pick(PN), f: Math.random() < .5, cast: false }, { ax: ax, ln: r2 + (Math.random() < .5 ? -4.6 : 4.6), p: Math.random() * 100 - 50, dir: Math.random() < .5 ? 1 : -1, sp: 1.5 + Math.random() * 1.3, lo: -52, hi: 52 });
    }
    for (i = 0; i < 8; i++) {
      var cg = car(pick([0xef4444, 0x3b82f6, 0xfacc15, 0xf8fafc, 0x10b981, 0x6b7280])), rr = pick(RD), cx = Math.random() < .5, dr = Math.random() < .5 ? 1 : -1;
      sc.add(cg); CR.push({ g: cg, ax: cx ? 'x' : 'z', ln: rr + dr * (cx ? 1.8 : -1.8), p: Math.random() * 110 - 55, dir: dr, sp: 7 + Math.random() * 5 });
    }
    PL = person({ skin: 0xf2c9a0, hair: 0x222222, sh: 0xfacc15, pants: 0x1e3a8a, cast: true }); PL.position.set(V.px, 0, V.pz); sc.add(PL);
    bind(); requestAnimationFrame(tick);
  }

  /* ---------- เข้า/ออกตึก ---------- */
  function place() { var e = $('cplace'); if (e) e.innerHTML = V.inn ? '<button data-a="cexit">ออกจากตึก · ' + esc(BD[V.inn].n) + '</button>' : ''; }
  function enter(k) {
    if (!RM[k]) return; V.inn = k; V.px = RM[k].ox; V.pz = 6.2; V.yaw = 0; IL.position.set(RM[k].ox, 6, 0);
    if (V.mode === 'iso') A.cmode('third'); closeSheet(); place();
  }
  function leave() { var d = BD[V.inn]; if (!d) return; V.px = d.x * SP; V.pz = d.z * SP + 8.3; V.yaw = Math.PI; V.inn = null; place(); }
  function blocked(x, z) {
    if (V.inn) {
      var dx = x - RM[V.inn].ox;
      if (Math.abs(dx) > 11.3 || z < -7.3 || z > 7.9) return true;
      if (Math.abs(dx) < 4.8 && z < -2.1) return true;
      return DK.some(function (a) { return Math.abs(dx - a[0]) < 2.2 && Math.abs(z - a[1]) < 1.3; });
    }
    return D.some(function (d) {
      var ex = x - d.x * SP, ez = z - d.z * SP;
      return (Math.abs(ex) < 6.9 && Math.abs(ez) < 5.6) || (Math.abs(ex) < 3.3 && Math.abs(ex) >= 2 && ez >= 5.6 && ez < 6.9);
    });
  }
  function turn(g, to, k) { var d = to - g.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; g.rotation.y += d * Math.min(1, k); }

  function tick(ts) {
    requestAnimationFrame(tick);
    if (!rd || !CE.isConnected) return;
    var dt = Math.min(.05, (ts - last) / 1000), t = ts / 1000; last = ts;
    var w = CE.clientWidth, h = CE.clientHeight;
    if (!w || !h) return;
    if (w !== cw || h !== ch) { cw = w; ch = h; rd.setSize(w, h, false); pc.aspect = w / h; pc.updateProjectionMatrix(); }
    var walk = V.mode !== 'iso', mvP = false;
    if (walk) {
      var kx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), ky = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
      var jx = Math.max(-1, Math.min(1, V.jx + kx)), jy = Math.max(-1, Math.min(1, V.jy + ky));
      var fx = -Math.sin(V.yaw), fz = -Math.cos(V.yaw), rx = Math.cos(V.yaw), rz = -Math.sin(V.yaw), sp = 9 * dt;
      var nx = V.px + (fx * -jy + rx * jx) * sp, nz = V.pz + (fz * -jy + rz * jx) * sp;
      nx = Math.max(-58, Math.min(V.inn ? 999 : 58, nx)); nz = Math.max(-58, Math.min(58, nz));
      if (!blocked(nx, V.pz)) V.px = nx; if (!blocked(V.px, nz)) V.pz = nz;
      mvP = Math.abs(jx) + Math.abs(jy) > .1;
      PL.position.set(V.px, mvP ? Math.abs(Math.sin(t * 8)) * .1 : 0, V.pz); PL.rotation.y = V.yaw + Math.PI;
      if (!V.inn) D.forEach(function (d) { var ex = V.px - d.x * SP, ez = V.pz - d.z * SP; if (Math.abs(ex) < 2.1 && ez > 5.2 && ez < 7.4) enter(d.k); });
      else if (V.pz > 7.2 && Math.abs(V.px - RM[V.inn].ox) < 1.9) leave();
    }
    pose(PL, t, mvP);
    near = null; var nd = 40;
    NP.forEach(function (n) {
      var g = n.g, talk = CH.npc === n, mv = false;
      if (n.sp) {
        if (n.pz > 0 || talk) n.pz -= dt;
        else {
          n.p += n.dir * n.sp * dt; mv = true;
          if (n.p > n.hi || n.p < n.lo) { n.dir *= -1; n.p = Math.max(n.lo, Math.min(n.hi, n.p)); n.pz = Math.random() * 2.5; }
          else if (Math.random() < dt * .07) n.pz = 1 + Math.random() * 3;
          setPos(n); turn(g, n.ax === 'x' ? (n.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (n.dir > 0 ? 0 : Math.PI), dt * 10);
        }
      }
      var dx = V.px - g.position.x, dz = V.pz - g.position.z, d2 = dx * dx + dz * dz;
      if (!mv && (talk || (d2 < 100 && walk))) turn(g, Math.atan2(dx, dz), dt * 6);
      else if (!mv && n.sp === 0 && !talk) turn(g, 0, dt * 4);
      pose(g, t + n.ph, mv); g.position.y = mv ? Math.abs(Math.sin((t + n.ph) * 8)) * .06 : 0;
      if (walk && d2 < nd && !!n.g.parent && (V.inn ? n.inside || n.ln === 5.8 || n.ln === 1.3 : g.position.x < 200)) { nd = d2; near = n; }
    });
    CR.forEach(function (c) { c.p += c.dir * c.sp * dt; if (c.p > 60) c.p = -60; if (c.p < -60) c.p = 60; if (c.ax === 'x') { c.g.position.set(c.p, 0, c.ln); c.g.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; } else { c.g.position.set(c.ln, 0, c.p); c.g.rotation.y = c.dir > 0 ? 0 : Math.PI; } });
    var tb = $('ctalk'); tb.style.display = near ? 'block' : 'none'; if (near) tb.textContent = 'คุยกับ ' + near.name;
    PL.visible = V.mode !== 'first'; var cam;
    if (!walk) {
      var a = w / h, vh = 80 / V.zoom, el = .62, R = 100; cam = oc;
      oc.left = -vh * a / 2; oc.right = vh * a / 2; oc.top = vh / 2; oc.bottom = -vh / 2; oc.updateProjectionMatrix();
      oc.position.set(Math.sin(V.th) * Math.cos(el) * R, Math.sin(el) * R, Math.cos(V.th) * Math.cos(el) * R); oc.lookAt(0, 0, 0);
    } else {
      cam = pc; var fx2 = -Math.sin(V.yaw), fz2 = -Math.cos(V.yaw);
      if (V.mode === 'third') { pc.position.set(V.px - fx2 * 7, 4.8, V.pz - fz2 * 7); pc.lookAt(V.px + fx2 * 3, 2.2, V.pz + fz2 * 3); }
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
    c.addEventListener('pointerup', function (e) { if (ps[e.pointerId] && Object.keys(ps).length === 1 && mv < 8) tap(e); delete ps[e.pointerId]; pd = 0; });
    c.addEventListener('pointercancel', function (e) { delete ps[e.pointerId]; });
    c.addEventListener('wheel', function (e) { e.preventDefault(); V.zoom = Math.max(.6, Math.min(3, V.zoom * Math.exp(-e.deltaY * .001))); }, { passive: false });
    window.addEventListener('keydown', function (e) { if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return; keys[e.key.toLowerCase()] = 1; });
    window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = 0; });
    var jy = $('cjoy'), kn = jy.firstChild, jid = null;
    function jm(e) { var r = jy.getBoundingClientRect(), x = (e.clientX - r.left - 48) / 40, y = (e.clientY - r.top - 48) / 40, l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } V.jx = x; V.jy = y; kn.style.transform = 'translate(' + x * 30 + 'px,' + y * 30 + 'px)'; }
    jy.addEventListener('pointerdown', function (e) { jid = e.pointerId; jy.setPointerCapture(jid); jm(e); });
    jy.addEventListener('pointermove', function (e) { if (e.pointerId === jid) jm(e); });
    function je() { jid = null; V.jx = V.jy = 0; kn.style.transform = ''; }
    jy.addEventListener('pointerup', je); jy.addEventListener('pointercancel', je);
    document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.id === 'cin') A.csend(); });
  }
  function tap(e) {
    var r = rd.domElement.getBoundingClientRect(), v = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v, V.mode === 'iso' ? oc : pc);
    var h = ray.intersectObjects(TL, true)[0]; if (!h) return;
    var o = h.object; while (o && !o.userData.npc && !o.userData.k) o = o.parent;
    if (!o) return;
    if (o.userData.npc) talk(o.userData.npc); else bSheet(o.userData.k);
  }
  A.cmode = function (m) {
    if (m === 'iso' && V.inn) leave();
    V.mode = m; if (m !== 'iso') { V.jx = V.jy = 0; }
    CE.querySelectorAll('.cbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === m); });
    $('cjoy').style.display = m === 'iso' ? 'none' : 'block';
  };
  A.ctalk = function () { if (near) talk(near); };
  A.center = function (k) { closeSheet(); enter(k); };
  A.cexit = function () { leave(); };
  function bSheet(k) {
    var d = BD[k]; if (!d) return;
    openSheet(head(esc(d.n)) + '<div class="note" style="margin-bottom:10px">' + esc(d.who) + ' ประจำฝ่ายนี้ · เดินเข้าไปข้างในเพื่อคุยและดูข้อมูล</div><div class="btns"><button class="btn" data-a="center" data-v="' + k + '">เดินเข้าตึก</button><button class="btn o" data-a="cdept" data-v="' + k + '">ดูข้อมูลฝ่าย</button></div>');
  }

  /* ---------- NPC ถาม-ตอบ (ข้อมูลจริงของร้านเท่านั้น) ---------- */
  var QQ = ['วันนี้ขายได้เท่าไหร่?', 'วันนี้กำไรเท่าไหร่?', 'สินค้าไหนขายดีที่สุด?', 'ควรเติมสินค้าอะไร?'];
  function msg(cls, html) { var m = $('cmsg'); if (!m) return null; var d = document.createElement('div'); d.className = cls; d.innerHTML = html; m.appendChild(d); m.scrollTop = m.scrollHeight; return d; }
  function talk(n) {
    CH.npc = n; var line = n.k === 'sec' && pendingN() ? 'ตอนนี้มีงานค้างอยู่ ' + pendingN() + ' รายการค่ะ' : pick(n.say);
    openSheet(head(esc(n.name)) + '<div class="cm" id="cmsg"></div><div class="pgh">' + QQ.map(function (q) { return '<button class="chip" data-a="cask" data-v="' + q + '">' + q + '</button>'; }).join('') + '</div><div class="cr"><input id="cin" class="set-i" placeholder="พิมพ์ถาม ' + esc(n.name) + ' เช่น วันนี้กำไรเท่าไหร่" autocomplete="off"><button class="btn" style="margin:0;width:auto;padding:0 18px" data-a="csend">ส่ง</button></div>');
    msg('', esc(line));
  }
  A.cask = function (v) { var i = $('cin'); if (i) { i.value = v; A.csend(); } };
  A.csend = function () {
    var i = $('cin'), v = i && i.value.trim(), n = CH.npc; if (!v || !n) return; i.value = ''; msg('u', esc(v));
    var td = /วันนี้/.test(v), dep = null;
    if ((td && /กำไร|ขาย|ยอด/.test(v)) || /ขายดี|เติม|สั่ง|ใกล้หมด|ค้าง|ไม่ขยับ|ขายไม่ออก|ผิดปกติ|ราคา|ลดต้นทุน|ต้นทุน|ประหยัด/.test(v)) return dataAns(v, n);
    if (/ภาษี/.test(v)) dep = 'tax'; else if (/ข่าว/.test(v)) dep = 'news'; else if (/งาน|ตาราง|นัด|เตือน|เลขา/.test(v)) dep = 'sec'; else if (/ค่าเช่า|ห้อง|ผู้เช่า/.test(v)) dep = 'rent';
    else if (/คลัง|สต๊อก|สต็อก/.test(v)) dep = 'stock'; else if (/บัญชี|รายจ่าย/.test(v)) dep = 'acc'; else if (/สินค้า/.test(v)) dep = 'prod';
    if (dep) return msg('', 'เรื่องนี้ดูได้ที่ ' + esc(BD[dep].n) + ' ค่ะ<br><button class="btn o" style="margin-top:6px" data-a="cdept" data-v="' + dep + '">เปิดข้อมูล ' + esc(BD[dep].n) + '</button>');
    if (/ขอบคุณ|ขอบใจ/.test(v)) return msg('', 'ยินดีเลย ถามได้ตลอดนะ');
    if (/ชื่อ|ใคร/.test(v)) return msg('', 'ฉันชื่อ ' + esc(n.name));
    msg('', (/สวัสดี|หวัดดี/.test(v) ? esc(pick(n.say)) + '<br>' : '') + 'ถามเรื่อง ยอดขายวันนี้ กำไร สินค้าขายดี ของที่ควรเติม ภาษี งานนัด หรือค่าเช่า ได้เลย ตอบจากข้อมูลจริงของร้านเท่านั้น');
  };
  function dataAns(v, n) {
    var inp = $('aiin'), b = msg('', 'กำลังเช็คข้อมูล...'); if (!inp || !_as) { if (b) b.textContent = 'ตอนนี้ดึงข้อมูลไม่ได้ ลองเปิดหน้านี้ใหม่'; return; }
    inp.value = v; _as(); var tries = 0, iv = setInterval(function () {
      var a = document.querySelector('#aiout .ans'), q = a && a.querySelector('.q'); tries++;
      if (a && q && q.textContent === v && a.textContent.indexOf('กำลังวิเคราะห์') < 0) { clearInterval(iv); var c = a.cloneNode(true); c.querySelector('.q').remove(); if (b) b.innerHTML = c.innerHTML; var m = $('cmsg'); if (m) m.scrollTop = m.scrollHeight; }
      else if (tries > 30) { clearInterval(iv); if (b) b.textContent = 'ยังดึงข้อมูลไม่ได้ ลองถามใหม่อีกครั้งนะ'; }
    }, 400);
  }

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
      try { if (window.Notification && Notification.permission === 'granted') new Notification('Xiress', { body: t.t }); } catch (e) {}
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

  var _cs = closeSheet;
  closeSheet = function () { CH.npc = null; return _cs.apply(this, arguments); };

  /* ---------- ผูกกับหน้า AI ---------- */
  var _r = render;
  render = function () {
    _r.apply(this, arguments);
    if (!(S.ready && S.cur === 'ai')) return;
    var h = $('view').querySelector('h2'); if (!h) return;
    if (!CE) {
      CE = document.createElement('div'); CE.id = 'city';
      CE.innerHTML = '<div class="cbar"><button data-a="cmode" data-v="iso" class="on">มุมสูง</button><button data-a="cmode" data-v="third">บุคคลที่ 3</button><button data-a="cmode" data-v="first">บุคคลที่ 1</button></div><div id="cplace"></div><div class="chint">แตะตึก = เข้าไปข้างใน · แตะคน = คุยถามตอบ · ใช้จอยเดินในโหมดบุคคลที่ 3</div><div id="cjoy"><i></i></div><button id="ctalk" data-a="ctalk">คุยกับ NPC</button>';
    }
    h.insertAdjacentElement('afterend', CE);
    if (!rd) {
      if (window.THREE) init();
      else { var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'; s.onload = init; s.onerror = function () { CE.insertAdjacentHTML('beforeend', '<div style="padding:60px 16px;text-align:center">โหลด Three.js ไม่ได้ ตรวจสอบอินเทอร์เน็ต</div>'); }; document.head.appendChild(s); }
    }
  };
  if (S.ready) render();
})();
