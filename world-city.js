/* ============================================================
   world-city.js — เมืองเปิดโลก (open world) รอบที่ดินร้าน
   - เมืองขนาด ~830 × 830 ม. (ใหญ่กว่าแมพเดิม ~20 เท่า) ล้อมรอบ 8 ตึกของร้าน
   - ถนนตาราง · แม่น้ำ + สะพาน · ย่านตึกสูง · ตึกแถว/ร้านค้า · บ้านคน · คอนโด
     ห้าง · โรงเรียน · โรงพยาบาล · วัด/ศาลเจ้า · สวน · ตลาด · สนามกีฬา · รถไฟฟ้ายกระดับ
     รถวิ่ง · คนเดิน · เรือ · แลนด์มาร์กประจำเมือง
   - สลับประเทศได้ 4 เมือง: กรุงเทพฯ / โตเกียว / โซล / เซี่ยงไฮ้ (รายละเอียดต่างกัน)
   - ใช้ InstancedMesh (วาดหลายพันชิ้นในไม่กี่ draw call) เพื่อให้มือถือไหว
   ลำดับโหลด: หลัง world-3d.js (world-3d เรียก W.buildCity ตอนสร้างฉาก)
   ============================================================ */
(function () {
  'use strict';
  var W = window.SSW = window.SSW || {};
  var T, SC = null, CITY = null, TH = null, rng = Math.random;
  var L = 416, RV0 = 282, RV1 = 340;                      /* ขอบเมือง · แนวแม่น้ำ (แกน z) */
  var SP = [-416, -346, -276, -206, -136, -66, 0, 66, 136, 206, 276, 346, 416];
  var RAIL_Z = -136, RAIL_H = 9;
  W.LIM = L - 2; W.ZMIN = .12;

  /* ---------- ธีม 4 เมือง ---------- */
  var THEMES = {
    bkk: { name: 'กรุงเทพฯ', country: 'ไทย', flag: '🇹🇭', desc: 'ตึกแถวสีสด วัด ตลาด รถตุ๊กตุ๊ก แม่น้ำเจ้าพระยา', seed: 11,
      sky: 0xdcecfb, ground: 0xb9c2ae, lot: 0xd8d2c4, grass: 0x78b552, road: 0x4a515e, line: '#f2c94c', water: 0x7f9c86, bridge: 0xc9c2b2,
      wall: [0xf1e4c8, 0xe8d3b0, 0xf6f1e7, 0xd9c7a8, 0xe9bf98, 0xf0dca8, 0xd3dde2], shop: [0xf6c76b, 0x8fd3c8, 0xf29e8e, 0xb7d77a, 0xf3e2a9, 0x9cc4e4, 0xe5a8d0, 0xffb38a],
      awn: [0xd94848, 0x2f8f5b, 0x2c6fb8, 0xf2a93b, 0x8e44ad], glass: [0x8fb3c9, 0x9fc3d6, 0x7da0b8, 0xa9c1cf], roof: [0xb4532a, 0xc8693b, 0x9a4a2c, 0x7d8a96, 0x3f6f8f],
      tree: [['palm', .4], ['round', .6]], green: [0x3f8f3a, 0x4e9a3c, 0x2f7d32, 0x5aa646], shopH: [8, 13], shopW: 4.4, houseN: 4, flatRoof: .35, towerH: [45, 135], condoH: [32, 70],
      taxi: [0xff5fa2, 0x55c43b, 0xf4d03f, 0x3a86d4], car: [0xffffff, 0xc0c4cc, 0x2c3e50, 0x8b1a1a, 0x1f4e79, 0x9aa5b1], tuk: .14, bus: 0xc0392b,
      rail: [0x2e7d32, 0xf4f6f8], boat: 0xf2c94c,
      signs: ['ข้าวมันไก่', 'ก๋วยเตี๋ยว', 'ร้านสะดวกซื้อ', 'กาแฟสด', 'ร้านยา', 'ร้านทอง', 'ส้มตำ', 'ร้านตัดผม', 'ชานมไข่มุก', 'ซ่อมมือถือ', 'ข้าวแกง', 'ผัดไทย'],
      N: { mall: 'ห้างสรรพสินค้า', school: 'โรงเรียน', hosp: 'โรงพยาบาล', market: 'ตลาดนัด', temple: 'วัด', park: 'สวนสาธารณะ', stadium: 'สนามกีฬา', station: 'สถานีรถไฟฟ้า', river: 'แม่น้ำเจ้าพระยา' },
      font: '"Noto Sans Thai","Sukhumvit Set",system-ui', temple: 'wat', lm: 'prang', lmc: [3, 9], flagC: ['#a51931', '#f4f5f8', '#2d2a4a', '#f4f5f8', '#a51931'] },
    tyo: { name: 'โตเกียว', country: 'ญี่ปุ่น', flag: '🇯🇵', desc: 'ตึกแคบสูง ซากุระ ศาลเจ้า เจดีย์ 5 ชั้น โตเกียวทาวเวอร์', seed: 23,
      sky: 0xe3ecf6, ground: 0xb7bcc2, lot: 0xd6d6d2, grass: 0x86b26a, road: 0x50565f, line: '#ffffff', water: 0x6f97a6, bridge: 0xbfc4c9,
      wall: [0xf2f0eb, 0xe4e1da, 0xd8d4cc, 0xc9ccd1, 0xb9b3a8, 0xede6d6], shop: [0xf2f0eb, 0xdcd8cf, 0xc7cbd1, 0xe9dcc4, 0xb8c4cf, 0xa9b1ba],
      awn: [0x1f3b73, 0x8c1c13, 0x2d6a4f, 0x444444, 0xc8102e], glass: [0x9db4c8, 0xb3c6d6, 0x8aa1b5, 0x6f8799], roof: [0x3c4148, 0x4f5761, 0x2f3b4c, 0x6b6f75],
      tree: [['cherry', .45], ['round', .55]], green: [0x4f8a3d, 0x5f9a48, 0x3e7a35], shopH: [11, 22], shopW: 5, houseN: 5, flatRoof: .25, towerH: [55, 160], condoH: [30, 60],
      taxi: [0x1b1b1b, 0x2e8b57, 0xf2c037, 0x3366cc], car: [0xffffff, 0xd6d9de, 0x222222, 0x9aa5b1, 0x6b7a8f], tuk: 0, bus: 0x2a7f62,
      rail: [0xe9ecef, 0x2e9e4b], boat: 0xe74c3c,
      signs: ['ラーメン', 'コンビニ', '居酒屋', 'カフェ', '寿司', '薬局', '書店', 'カラオケ', 'うどん', '焼き鳥', '本屋', 'たこ焼き'],
      N: { mall: 'デパート', school: '学校', hosp: '病院', market: '市場', temple: '神社', park: '公園', stadium: '運動場', station: '駅', river: '隅田川' },
      font: '"Hiragino Sans","Noto Sans JP",system-ui', temple: 'shrine', lm: 'tokyotower', lmc: [8, 2], flagC: ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'], jpflag: 1 },
    sel: { name: 'โซล', country: 'เกาหลีใต้', flag: '🇰🇷', desc: 'อพาร์ตเมนต์สูงมีเลขตึก วังหลังคาโค้ง ต้นแปะก๊วย หอคอยบนเขา แม่น้ำฮัน', seed: 37,
      sky: 0xe1ebf7, ground: 0xb8bdb4, lot: 0xd5d3cc, grass: 0x80b05c, road: 0x4d535c, line: '#f5c400', water: 0x5f8fae, bridge: 0xc5c8cc,
      wall: [0xf4f2ee, 0xe2ddd3, 0xc98b6b, 0xb5735a, 0xd9d4ca, 0xeee8dc], shop: [0xf4f2ee, 0xe6e2da, 0xd1cdc5, 0xc4b8a8, 0xdfe6ec],
      awn: [0x1565c0, 0xd32f2f, 0xf9a825, 0x2e7d32, 0x6a1b9a], glass: [0x9bb7cf, 0x86a6c2, 0xb0c4d6, 0x7a95ad], roof: [0x3b4046, 0x5b4636, 0x46505a, 0x6d5a4a],
      tree: [['ginkgo', .45], ['round', .35], ['pine', .2]], green: [0x4a8a3b, 0x5c9b45, 0x3a7232], shopH: [9, 16], shopW: 5, houseN: 4, flatRoof: .6, towerH: [50, 140], condoH: [45, 75],
      taxi: [0xf57c00, 0xc0c4cc, 0x1b1b1b], car: [0xffffff, 0xd0d4d9, 0x1f1f1f, 0x7d8a96, 0x2b4a6f], tuk: 0, bus: 0x2e86de,
      rail: [0x2e9e4b, 0xf4f6f8], boat: 0xffffff, apt: 1,
      signs: ['편의점', '카페', '치킨', '분식', '약국', '노래방', 'PC방', '빵집', '김밥', '떡볶이', '서점', '미용실'],
      N: { mall: '백화점', school: '학교', hosp: '병원', market: '시장', temple: '궁', park: '공원', stadium: '운동장', station: '역', river: '한강' },
      font: '"Apple SD Gothic Neo","Noto Sans KR",system-ui', temple: 'palace', lm: 'seoultower', lmc: [9, 1], flagC: ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'], krflag: 1 },
    sha: { name: 'เซี่ยงไฮ้', country: 'จีน', flag: '🇨🇳', desc: 'ตึกระฟ้ากระจก บ้านชิคูเหมิน เจดีย์จีน ซุ้มประตูแดง หอไข่มุก', seed: 53,
      sky: 0xe5ebf2, ground: 0xb5b8b0, lot: 0xd3cfc6, grass: 0x7aa95a, road: 0x4b5058, line: '#ffffff', water: 0x7b9196, bridge: 0xc2bfb8,
      wall: [0xb7b2a8, 0xc9c3b8, 0xe3ded4, 0x9e9a92, 0xd8c3a5, 0xf0ebe2], shop: [0xc0392b, 0xe3ded4, 0xb7b2a8, 0xd35400, 0xe6c07b, 0xd8c3a5],
      awn: [0xc0392b, 0xf1c40f, 0x2c3e50, 0x16a085, 0x8e44ad], glass: [0x7fa3bf, 0x6c8faa, 0x9bb7cc, 0x5d7f99, 0xa7c0d2], roof: [0x3d3d3d, 0x5a4a3a, 0x4a4f55, 0x7b2d26],
      tree: [['round', .75], ['willow', .25]], green: [0x4b8a3c, 0x5d9945, 0x3f7a33], shopH: [7, 12], shopW: 5, houseN: 4, flatRoof: .3, towerH: [70, 190], condoH: [40, 85],
      taxi: [0x1abc9c, 0xc0392b, 0xf1c40f, 0x2980b9], car: [0xffffff, 0xd5d8dc, 0x1c1c1c, 0x7f8c8d, 0x34495e], tuk: 0, bus: 0x27ae60,
      rail: [0xf4f6f8, 0x1f6fb2], boat: 0xc0392b,
      signs: ['饭店', '便利店', '茶馆', '药店', '面馆', '超市', '书店', '包子铺', '奶茶', '银行', '火锅', '理发'],
      N: { mall: '百货商场', school: '学校', hosp: '医院', market: '市场', temple: '宝塔', park: '公园', stadium: '体育场', station: '地铁站', river: '黄浦江' },
      font: '"PingFang SC","Noto Sans SC",system-ui', temple: 'pagoda', lm: 'pearl', lmc: [8, 9], flagC: ['#de2910', '#de2910', '#de2910', '#de2910', '#de2910'], cnflag: 1 }
  };
  W.CITIES = THEMES;
  var cur = 'bkk'; try { var sv = localStorage.getItem('ss_city'); if (sv && THEMES[sv]) cur = sv; } catch (e) {}

  /* ---------- ตัวช่วย ---------- */
  function mul(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function R(a, b) { return a + rng() * (b - a); }
  function P(a) { return a[Math.floor(rng() * a.length)]; }
  function wpick(list) { var x = rng(), s = 0; for (var i = 0; i < list.length; i++) { s += list[i][1]; if (x <= s) return list[i][0]; } return list[0][0]; }
  function shade(c, f) { var r = (c >> 16 & 255) * f, g = (c >> 8 & 255) * f, b = (c & 255) * f; return (Math.min(255, r) << 16) | (Math.min(255, g) << 8) | Math.min(255, b); }
  function hx(c) { return '#' + ('000000' + c.toString(16)).slice(-6); }

  var GEO = null, MAT = null, BUF, COL, NSIGN, SIGNMAX = 80, TEXC = {};
  function geos() {
    if (GEO) return;
    var pr = new T.BufferGeometry();
    pr.setAttribute('position', new T.Float32BufferAttribute([-.5, 0, .5, .5, 0, .5, 0, 1, .5, .5, 0, -.5, -.5, 0, -.5, 0, 1, -.5,
      -.5, 0, -.5, -.5, 0, .5, 0, 1, .5, -.5, 0, -.5, 0, 1, .5, 0, 1, -.5, .5, 0, .5, .5, 0, -.5, 0, 1, -.5, .5, 0, .5, 0, 1, -.5, 0, 1, .5], 3));
    pr.computeVertexNormals();
    GEO = {
      win: new T.BoxGeometry(1, 1, 1).translate(0, .5, 0), box: new T.BoxGeometry(1, 1, 1).translate(0, .5, 0), roof: pr,
      cone: new T.ConeGeometry(.5, 1, 12).translate(0, .5, 0), cone4: new T.ConeGeometry(.5, 1, 4).rotateY(Math.PI / 4).translate(0, .5, 0),
      cyl: new T.CylinderGeometry(.5, .5, 1, 12).translate(0, .5, 0), cyl8: new T.CylinderGeometry(.5, .5, 1, 8).translate(0, .5, 0),
      ball: new T.IcosahedronGeometry(.5, 1).translate(0, .5, 0), crown: new T.IcosahedronGeometry(.5, 0).translate(0, .5, 0),
      water: new T.BoxGeometry(1, 1, 1).translate(0, .5, 0), plane: new T.PlaneGeometry(1, 1)
    };
    var plain = new T.MeshLambertMaterial({ color: 0xffffff }), flat = new T.MeshLambertMaterial({ color: 0xffffff });
    MAT = { win: winMat(), box: plain, roof: flat, cone: plain, cone4: flat, cyl: plain, cyl8: flat, ball: plain, crown: flat,
      water: new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0x0b2030, emissiveIntensity: .35 }) };
  }
  /* วัสดุตึกที่วาดหน้าต่างด้วย shader (ไม่ต้องใช้รูป) */
  function winMat() {
    var m = new T.MeshLambertMaterial({ color: 0xffffff });
    m.onBeforeCompile = function (sh) {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvec4 cwp = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\ncwp = instanceMatrix * cwp;\n#endif\ncwp = modelMatrix * cwp; vWP = cwp.xyz;\nvec3 cwn = objectNormal;\n#ifdef USE_INSTANCING\ncwn = mat3(instanceMatrix) * cwn;\n#endif\nvWN = normalize(mat3(modelMatrix) * cwn);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;\nfloat chash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat cside = 1.0 - step(0.5, abs(vWN.y));\nvec2 cu = vec2(abs(vWN.x) > 0.5 ? vWP.z : vWP.x, vWP.y);\nvec2 cs = vec2(3.0, 3.4);\nvec2 cc = fract(cu / cs);\nfloat cw = step(0.2, cc.x) * step(cc.x, 0.8) * step(0.3, cc.y) * step(cc.y, 0.8) * cside * step(0.9, vWP.y);\nfloat lit = step(0.84, chash(floor(cu / cs)));\nvec3 cg = mix(vec3(0.33, 0.47, 0.62), vec3(0.98, 0.88, 0.6), lit);\ndiffuseColor.rgb = mix(diffuseColor.rgb, cg, cw * 0.85);');
    };
    return m;
  }
  /* เก็บชิ้นส่วน: (ชนิด, x, ฐาน y, z, กว้าง x, สูง, ลึก z, สี, หมุน, ชนได้) */
  function put(k, x, y, z, sx, sy, sz, c, ry, col) {
    (BUF[k] || (BUF[k] = [])).push(x, y, z, sx, sy, sz, ry || 0, c);
    if (col) addCol(x, z, ry && Math.abs(Math.sin(ry)) > .5 ? sz : sx, ry && Math.abs(Math.sin(ry)) > .5 ? sx : sz);
  }
  function flush() {
    var d = new T.Object3D(), c = new T.Color();
    Object.keys(BUF).forEach(function (k) {
      var a = BUF[k], n = a.length / 8; if (!n) return;
      var m = new T.InstancedMesh(GEO[k], MAT[k], n);
      for (var i = 0; i < n; i++) {
        var o = i * 8; d.position.set(a[o], a[o + 1], a[o + 2]); d.rotation.set(0, a[o + 6], 0); d.scale.set(a[o + 3], a[o + 4], a[o + 5]); d.updateMatrix();
        m.setMatrixAt(i, d.matrix); m.setColorAt(i, c.setHex(a[o + 7]));
      }
      m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.frustumCulled = false; m.receiveShadow = true; m.castShadow = false; CITY.add(m);
    });
  }

  /* ---------- ชนกำแพง (ตารางแฮช 16 ม.) ---------- */
  var GRID = {}, GS = 16, HILL = null;
  function addCol(x, z, w, d) {
    if (w < 1.2 && d < 1.2) return;
    var r = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
    for (var gx = Math.floor(r.x0 / GS); gx <= Math.floor(r.x1 / GS); gx++) for (var gz = Math.floor(r.z0 / GS); gz <= Math.floor(r.z1 / GS); gz++) (GRID[gx + ',' + gz] || (GRID[gx + ',' + gz] = [])).push(r);
  }
  function onBridge(x) { for (var i = 0; i < SP.length; i++) if (Math.abs(x - SP[i]) < 5.2) return true; return false; }
  W.cityHit = function (x, z, Rr) {
    if (!CITY) return false; Rr = Rr || .6;
    if (z > RV0 - Rr && z < RV1 + Rr && !onBridge(x)) return true;
    if (HILL && Math.hypot(x - HILL.x, z - HILL.z) < HILL.r) return true;
    for (var gx = Math.floor((x - Rr) / GS); gx <= Math.floor((x + Rr) / GS); gx++) for (var gz = Math.floor((z - Rr) / GS); gz <= Math.floor((z + Rr) / GS); gz++) {
      var L2 = GRID[gx + ',' + gz]; if (!L2) continue;
      for (var i = 0; i < L2.length; i++) { var r = L2[i]; if (x > r.x0 - Rr && x < r.x1 + Rr && z > r.z0 - Rr && z < r.z1 + Rr) return true; }
    }
    return false;
  };

  /* ---------- ป้าย (ข้อความตามภาษาของเมือง) ---------- */
  function sigTex(text, bg, fg, w, h) {
    var key = text + bg + fg + TH.font; if (TEXC[key]) return TEXC[key];
    var cv = document.createElement('canvas'); cv.width = w || 256; cv.height = h || 72; var g = cv.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, cv.width, 6);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    var fs = Math.round(cv.height * .56); g.font = '800 ' + fs + 'px ' + TH.font;
    while (g.measureText(text).width > cv.width - 16 && fs > 12) { fs -= 2; g.font = '800 ' + fs + 'px ' + TH.font; }
    g.fillText(text, cv.width / 2, cv.height / 2 + 2);
    var t = new T.CanvasTexture(cv); t.anisotropy = 4; TEXC[key] = t; return t;
  }
  function sign(text, x, y, z, ry, w, bg, fg, force) {
    if (!force && NSIGN >= SIGNMAX) return; NSIGN++;
    var m = new T.Mesh(GEO.plane, new T.MeshBasicMaterial({ map: sigTex(text, bg || '#c0392b', fg || '#ffffff') }));
    m.scale.set(w, w * 72 / 256, 1); m.position.set(x, y, z); m.rotation.y = ry || 0; CITY.add(m);
  }
  function bigSign(text, x, y, z, ry, w, bg, fg) {
    var m = new T.Mesh(GEO.plane, new T.MeshBasicMaterial({ map: sigTex(text, bg || '#1f2937', fg || '#ffffff', 512, 120) }));
    m.scale.set(w, w * 120 / 512, 1); m.position.set(x, y, z); m.rotation.y = ry || 0; CITY.add(m);
  }
  function flagTex() {
    var key = 'flag' + cur; if (TEXC[key]) return TEXC[key];
    var cv = document.createElement('canvas'); cv.width = 120; cv.height = 80; var g = cv.getContext('2d');
    if (TH.jpflag) { g.fillStyle = '#fff'; g.fillRect(0, 0, 120, 80); g.fillStyle = '#bc002d'; g.beginPath(); g.arc(60, 40, 22, 0, 7); g.fill(); }
    else if (TH.krflag) { g.fillStyle = '#fff'; g.fillRect(0, 0, 120, 80); g.fillStyle = '#cd2e3a'; g.beginPath(); g.arc(60, 40, 18, Math.PI, 0); g.fill(); g.fillStyle = '#0047a0'; g.beginPath(); g.arc(60, 40, 18, 0, Math.PI); g.fill(); g.fillStyle = '#111'; [[22, 18], [98, 18], [22, 62], [98, 62]].forEach(function (p) { g.fillRect(p[0] - 8, p[1] - 6, 16, 3); g.fillRect(p[0] - 8, p[1], 16, 3); g.fillRect(p[0] - 8, p[1] + 6, 16, 3); }); }
    else if (TH.cnflag) { g.fillStyle = '#de2910'; g.fillRect(0, 0, 120, 80); g.fillStyle = '#ffde00'; g.font = '28px sans-serif'; g.fillText('★', 10, 34); g.font = '11px sans-serif'; g.fillText('★', 40, 14); g.fillText('★', 48, 26); g.fillText('★', 48, 40); g.fillText('★', 40, 52); }
    else { var st = TH.flagC; [16, 16, 16, 16, 16].forEach(function (h, i) { g.fillStyle = st[i]; g.fillRect(0, i * 16, 120, 16); }); g.fillStyle = '#2d2a4a'; g.fillRect(0, 27, 120, 26); }
    var t = new T.CanvasTexture(cv); TEXC[key] = t; return t;
  }
  function flag(x, z, h) {
    put('cyl', x, 0, z, .25, h, .25, 0xe5e7eb);
    var f = new T.Mesh(GEO.plane, new T.MeshLambertMaterial({ map: flagTex(), side: T.DoubleSide })); f.scale.set(3, 2, 1); f.position.set(x + 1.6, h - 1.2, z); CITY.add(f);
  }

  /* ---------- ต้นไม้ ---------- */
  function tree(x, z, s, kind) {
    kind = kind || wpick(TH.tree); s = s || R(.85, 1.25); var g = P(TH.green);
    if (kind === 'palm') { put('cyl', x, 0, z, .45 * s, 7 * s, .45 * s, 0x8b6b4a); put('crown', x, 6.6 * s, z, 5.4 * s, 1.5 * s, 5.4 * s, 0x2f8a3a); put('crown', x, 6.9 * s, z, 3.4 * s, 1.4 * s, 3.4 * s, 0x3fa04a, .7); }
    else if (kind === 'pine') { put('cyl', x, 0, z, .45 * s, 2 * s, .45 * s, 0x6b4a33); put('cone', x, 1.6 * s, z, 3.8 * s, 3.6 * s, 3.8 * s, 0x2e5e3a); put('cone', x, 3.6 * s, z, 2.8 * s, 3 * s, 2.8 * s, 0x356b42); }
    else {
      var cc = kind === 'cherry' ? P([0xf7b6d2, 0xffc9de, 0xf4a6c6]) : kind === 'ginkgo' ? P([0xf2c12e, 0xf5d04a, 0xe8b923]) : kind === 'willow' ? 0x9ccc65 : g;
      put('cyl', x, 0, z, .5 * s, 2.6 * s, .5 * s, 0x7a5638);
      put('crown', x, 2 * s, z, (kind === 'willow' ? 5.2 : 4.4) * s, (kind === 'willow' ? 4.6 : 3.8) * s, (kind === 'willow' ? 5.2 : 4.4) * s, cc, rng() * 3);
    }
  }

  /* ---------- ย่านต่าง ๆ ---------- */
  function pad(x0, x1, z0, z1, c) { put('box', (x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, .16, z1 - z0, c); }
  function shopRow(x0, x1, z0, z1, edge) {
    var D = 12, uw = TH.shopW, y = .16, ax = edge === 'n' || edge === 's', a0 = (ax ? x0 : z0) + D, a1 = (ax ? x1 : z1) - D, n = Math.max(1, Math.floor((a1 - a0) / uw)), st = (a1 - a0) / n;
    var ry = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[edge];
    for (var i = 0; i < n; i++) {
      var a = a0 + st * (i + .5), h = R(TH.shopH[0], TH.shopH[1]), c = P(TH.shop);
      var cx = ax ? a : (edge === 'e' ? x1 - D / 2 : x0 + D / 2), cz = ax ? (edge === 's' ? z1 - D / 2 : z0 + D / 2) : a;
      put('win', cx, y, cz, ax ? st - .2 : D, h, ax ? D : st - .2, c, 0, true);
      if (rng() < .5) put('box', cx, y + h, cz, ax ? st - .2 : D, R(.5, 1.6), ax ? D : st - .2, shade(c, .85));
      var fx = ax ? cx : (edge === 'e' ? x1 + .7 : x0 - .7), fz = ax ? (edge === 's' ? z1 + .7 : z0 - .7) : cz;
      put('box', fx, y + 2.9, fz, ax ? st - .5 : 1.4, .2, ax ? 1.4 : st - .5, P(TH.awn));
      if (rng() < .42) { var sx = ax ? cx : (edge === 'e' ? x1 + .1 : x0 - .1), sz = ax ? (edge === 's' ? z1 + .1 : z0 - .1) : cz; sign(P(TH.signs), sx, y + 4.1, sz, ry, st - .7, hx(P(TH.awn)), '#fff'); }
    }
  }
  function commercial(x0, x1, z0, z1) {
    ['n', 's', 'e', 'w'].forEach(function (e) { shopRow(x0, x1, z0, z1, e); });
    var D = 12; [[x0 + D / 2, z0 + D / 2], [x1 - D / 2, z0 + D / 2], [x0 + D / 2, z1 - D / 2], [x1 - D / 2, z1 - D / 2]].forEach(function (p) { put('win', p[0], .16, p[1], D - .3, R(TH.shopH[1], TH.shopH[1] + 8), D - .3, P(TH.shop), 0, true); });
    pad(x0 + D, x1 - D, z0 + D, z1 - D, 0x6b7280);
    for (var i = 0; i < 3; i++) tree(R(x0 + D + 3, x1 - D - 3), R(z0 + D + 3, z1 - D - 3), .9, 'round');
  }
  function towers(x0, x1, z0, z1) {
    var mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, q = [[x0, mx, z0, mz], [mx, x1, z0, mz], [x0, mx, mz, z1], [mx, x1, mz, z1]];
    pad(x0, x1, z0, z1, 0xc9ccd1);
    q.forEach(function (c, i) {
      if (rng() < .15) { tree((c[0] + c[1]) / 2, (c[2] + c[3]) / 2, 1.2, 'round'); return; }
      var fw = R(14, Math.min(22, c[1] - c[0] - 3)), fd = R(14, Math.min(22, c[3] - c[2] - 3)), h = R(TH.towerH[0], TH.towerH[1]) * (i === 0 ? 1.1 : 1), cx = (c[0] + c[1]) / 2, cz = (c[2] + c[3]) / 2, g = P(TH.glass);
      put('win', cx, .16, cz, fw, h, fd, g, 0, true);
      if (rng() < .5) put('win', cx, .16 + h, cz, fw * .66, h * R(.15, .3), fd * .66, shade(g, 1.06));
      put('box', cx, .16 + h, cz, fw * .5, R(2, 5), fd * .5, shade(g, .7));
      if (rng() < .4) put('cyl', cx, .16 + h, cz, .4, R(8, 16), .4, 0xd1d5db);
    });
  }
  function houses(x0, x1, z0, z1) {
    var n = TH.houseN, pw = (x1 - x0) / n, pd = (z1 - z0) / n;
    pad(x0, x1, z0, z1, TH.grass);
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      if (rng() < .08) { tree(x0 + pw * (i + .5), z0 + pd * (j + .5)); continue; }
      var hxp = x0 + pw * (i + .5) + R(-1, 1), hz = z0 + pd * (j + .5) + R(-1, 1), w = R(pw * .5, pw * .68), d = R(pd * .48, pd * .62), fl = rng() < .55 ? 1 : 2, h = fl === 1 ? 3.4 : 6.3, rc = P(TH.roof);
      put('win', hxp, .16, hz, w, h, d, P(TH.wall), 0, true);
      if (rng() < TH.flatRoof) put('box', hxp, .16 + h, hz, w + .4, .45, d + .4, shade(rc, 1.1));
      else if (w >= d) put('roof', hxp, .16 + h, hz, d + 1, R(1.8, 2.8), w + 1, rc, Math.PI / 2);
      else put('roof', hxp, .16 + h, hz, w + 1, R(1.8, 2.8), d + 1, rc, 0);
      if (rng() < .45) tree(hxp + (rng() < .5 ? -1 : 1) * (pw * .38), hz + pd * .32, .7);
    }
    var fc = shade(TH.lot, .8); put('box', (x0 + x1) / 2, .16, z0 + .2, x1 - x0, 1.1, .3, fc); put('box', (x0 + x1) / 2, .16, z1 - .2, x1 - x0, 1.1, .3, fc);
  }
  function condo(x0, x1, z0, z1) {
    pad(x0, x1, z0, z1, TH.grass);
    var n = TH.apt ? 3 : 2, w = x1 - x0 - 10, sp = (z1 - z0) / n;
    for (var i = 0; i < n; i++) {
      var cz = z0 + sp * (i + .5), h = R(TH.condoH[0], TH.condoH[1]), c = P(TH.wall);
      put('win', (x0 + x1) / 2, .16, cz, w, h, Math.min(13, sp - 5), c, 0, true); put('box', (x0 + x1) / 2, .16 + h, cz, w + .4, 1.2, Math.min(13, sp - 5) + .4, shade(c, .8));
      if (TH.apt) bigSign((100 + (Math.abs(x0) % 7) * 10 + i + 1) + '동', (x0 + x1) / 2 + w / 2 + .08, .16 + h - 6, cz, Math.PI / 2, 7, hx(c), '#1f2937');
    }
    if (!TH.apt) put('water', (x0 + x1) / 2, .1, (z0 + z1) / 2, 14, .25, 6, 0x5cc8e8);
    for (var t = 0; t < 6; t++) tree(R(x0 + 2, x1 - 2), rng() < .5 ? z0 + 2 : z1 - 2, .9);
  }
  function park(x0, x1, z0, z1, big) {
    pad(x0, x1, z0, z1, TH.grass);
    var mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    put('water', mx + R(-6, 6), .1, mz + R(-6, 6), R(16, 24), .2, R(10, 16), TH.water);
    put('box', mx, .16, z0 + 4, x1 - x0 - 6, .06, 2.5, TH.lot); put('box', x0 + 4, .16, mz, 2.5, .06, z1 - z0 - 6, TH.lot);
    for (var i = 0; i < (big ? 40 : 26); i++) { var x = R(x0 + 3, x1 - 3), z = R(z0 + 3, z1 - 3); if (Math.abs(x - mx) < 13 && Math.abs(z - mz) < 10) continue; tree(x, z); }
    sign(TH.N.park, x0 + 6, 2.2, z1 + .1, 0, 7, '#2f7d32', '#fff', true);
  }
  function mall(x0, x1, z0, z1, ry) {
    pad(x0, x1, z0, z1, 0x9ca3af);
    var w = x1 - x0 - 6, d = z1 - z0 - 14, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2 - 3;
    put('win', cx, .16, cz, w, 18, d, 0xeef1f5, 0, true); put('box', cx, 18.16, cz, w - 6, 3, d - 6, 0xd1d5db);
    put('box', cx, .16, z1 - 7.6, 18, 9, 1, 0x7db7e0); bigSign(TH.N.mall, cx, 13, z1 - 10 + .15, 0, 26, '#b91c1c');
    for (var i = 0; i < 8; i++) put('box', x0 + 6 + i * ((w - 6) / 7), .16, z1 - 3.5, 2, 1.4, 4, P(TH.car));
  }
  function school(x0, x1, z0, z1) {
    pad(x0, x1, z0, z1, TH.lot);
    var w = x1 - x0, c = 0xf4ede0, cx = (x0 + x1) / 2;
    put('win', cx, .16, z0 + 6, w - 6, 11, 9, c, 0, true); put('roof', cx, 11.16, z0 + 6, 10, 2.2, w - 5, P(TH.roof), Math.PI / 2);
    put('win', x0 + 7, .16, (z0 + z1) / 2, 9, 11, z1 - z0 - 22, c, 0, true); put('win', x1 - 7, .16, (z0 + z1) / 2, 9, 11, z1 - z0 - 22, c, 0, true);
    put('box', cx, .16, (z0 + z1) / 2 + 6, w - 26, .1, z1 - z0 - 26, 0xd2691e); put('box', cx, .2, (z0 + z1) / 2 + 6, w - 32, .1, z1 - z0 - 32, TH.grass);
    flag(cx, z1 - 4, 12); bigSign(TH.N.school, cx, 8.5, z0 + 10.6, 0, 16, '#1d4ed8');
  }
  function hospital(x0, x1, z0, z1) {
    pad(x0, x1, z0, z1, TH.lot);
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    put('win', cx, .16, cz - 6, 36, 26, 18, 0xf8fafc, 0, true); put('win', cx + 10, .16, cz + 12, 20, 13, 14, 0xeef2f7, 0, true);
    put('box', cx, 26.2, cz - 6, 2.2, 7, .8, 0xdc2626); put('box', cx, 28.6, cz - 6, 7, 2.2, .8, 0xdc2626);
    bigSign(TH.N.hosp, cx - 8, 6, cz + 3.1, 0, 16, '#dc2626');
    for (var i = 0; i < 6; i++) tree(x0 + 4 + i * 9, z1 - 3, .8);
  }
  function market(x0, x1, z0, z1) {
    pad(x0, x1, z0, z1, 0xa8a29e);
    for (var i = 0; i < 6; i++) for (var j = 0; j < 6; j++) {
      var x = x0 + 6 + i * ((x1 - x0 - 12) / 5), z = z0 + 6 + j * ((z1 - z0 - 12) / 5), c = P(TH.awn);
      put('box', x, .16, z, 3.2, 1, 2.4, 0x8b5a2b); put('cyl', x - 1.4, .16, z, .12, 2.6, .12, 0x9ca3af); put('cyl', x + 1.4, .16, z, .12, 2.6, .12, 0x9ca3af);
      put('roof', x, 2.7, z, 3.8, 1.1, 3, c, Math.PI / 2);
    }
    bigSign(TH.N.market, (x0 + x1) / 2, 5, z1 + .2, 0, 14, '#ea580c');
    put('box', (x0 + x1) / 2 - 7.5, .16, z1 - .3, .5, 5.5, .5, 0x6b7280); put('box', (x0 + x1) / 2 + 7.5, .16, z1 - .3, .5, 5.5, .5, 0x6b7280);
  }
  function stadium(x0, x1, z0, z1) {
    pad(x0, x1, z0, z1, TH.lot);
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    put('box', cx, .16, cz, 44, .12, 28, 0x3f9b4a); put('box', cx, .3, cz, .3, .02, 28, 0xffffff); put('box', cx, .3, cz - 13.8, 44, .02, .3, 0xffffff); put('box', cx, .3, cz + 13.8, 44, .02, .3, 0xffffff);
    for (var s = 0; s < 4; s++) { put('box', cx, .16 + s * 1.2, cz - 17 - s * 1.6, 44, 1.2, 1.6, s % 2 ? 0x2563eb : 0x60a5fa, 0, true); put('box', cx, .16 + s * 1.2, cz + 17 + s * 1.6, 44, 1.2, 1.6, s % 2 ? 0xdc2626 : 0xf87171, 0, true); }
    put('box', cx - 22, .16, cz, .2, 2.4, 7, 0xffffff); put('box', cx + 22, .16, cz, .2, 2.4, 7, 0xffffff);
    sign(TH.N.stadium, x0 + 7, 2.4, z1 + .1, 0, 9, '#16a34a', '#fff', true);
  }

  /* ---------- วัด / ศาลเจ้า / วัง / เจดีย์ (ตามประเทศ) ---------- */
  function temple(x0, x1, z0, z1) {
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, t = TH.temple;
    if (t === 'wat') {
      pad(x0, x1, z0, z1, 0xeee7d6);
      put('box', cx, .16, cz, 34, 1.4, 20, 0xffffff, 0, true); put('box', cx, 1.56, cz, 26, 7, 13, 0xfdf8ec, 0, true);
      put('roof', cx, 8.5, cz, 16, 5, 30, 0xd35400, Math.PI / 2); put('roof', cx, 10.5, cz, 12, 4.4, 25, 0x1e8449, Math.PI / 2); put('roof', cx, 12.8, cz, 8, 4, 19, 0xd35400, Math.PI / 2);
      [-1, 1].forEach(function (a) { put('cone', cx + a * 15, 9, cz, .6, 4, .6, 0xf5c518); put('cone', cx + a * 11.8, 12, cz, .5, 3.4, .5, 0xf5c518); });
      [[x0 + 8, z0 + 8], [x1 - 8, z0 + 8]].forEach(function (p) { put('cyl', p[0], .16, p[1], 7, 3, 7, 0xffffff, 0, true); put('ball', p[0], 2.6, p[1], 6.2, 6, 6.2, 0xfdfaf2); put('cone', p[0], 8, p[1], 2.4, 10, 2.4, 0xf5c518); });
      put('box', cx, .16, z1 - .4, x1 - x0, 1.6, .5, 0xffffff); put('box', cx, .16, z0 + .4, x1 - x0, 1.6, .5, 0xffffff);
      for (var i = 0; i < 5; i++) tree(x0 + 4 + i * 11, z1 - 5, 1.1, 'round');
    } else if (t === 'shrine') {
      pad(x0, x1, z0, z1, 0xd6cfc2);
      [-1, 1].forEach(function (a) { put('cyl', cx + a * 3.4, .16, z1 - 6, .7, 8, .7, 0xd7261e, 0, true); });
      put('box', cx, 7.6, z1 - 6, 10.5, .8, 1, 0x1f1f1f); put('box', cx, 6.3, z1 - 6, 8.4, .5, .6, 0xd7261e);
      put('box', cx, .16, cz - 4, 18, 1, 13, 0x8a8178); put('box', cx, 1.16, cz - 4, 13, 5.5, 9, 0xb33a2e, 0, true); put('roof', cx, 6.6, cz - 4, 13, 4.2, 20, 0x3c4148, Math.PI / 2);
      var px = x0 + 10, pz = z0 + 10, sz = 8;
      for (var k = 0; k < 5; k++) { put('box', px, .16 + k * 3.2, pz, sz, 2.4, sz, 0xb33a2e, 0, k === 0); put('box', px, .16 + k * 3.2 + 2.4, pz, sz + 3, .5, sz + 3, 0x2f3338); sz -= 1.1; }
      put('cyl', px, 16.2, pz, .4, 6, .4, 0xc9a227);
      for (var j = 0; j < 14; j++) tree(R(x0 + 3, x1 - 3), R(z0 + 3, z1 - 3), 1, rng() < .6 ? 'cherry' : 'pine');
    } else if (t === 'palace') {
      pad(x0, x1, z0, z1, 0xd8cfbf);
      [[cx, z0 + .5, x1 - x0, 1], [cx, z1 - .5, x1 - x0, 1]].forEach(function (w) { put('box', w[0], .16, w[1], w[2], 2.6, w[3], 0x9b8f80, 0, true); });
      put('box', x0 + .5, .16, cz, 1, 2.6, z1 - z0, 0x9b8f80, 0, true); put('box', x1 - .5, .16, cz, 1, 2.6, z1 - z0, 0x9b8f80, 0, true);
      for (var g2 = -2; g2 <= 2; g2++) put('cyl', cx + g2 * 3.2, .16, z1 - 1.5, .7, 6, .7, 0xa93226);
      put('box', cx, 6, z1 - 1.5, 16, 1, 3.4, 0x2e7d6b); put('roof', cx, 7, z1 - 1.5, 6, 2.6, 19, 0x3b4046, Math.PI / 2);
      put('box', cx, .16, cz - 6, 26, 2, 16, 0xbdb3a3, 0, true); put('box', cx, 2.16, cz - 6, 20, 6, 11, 0xa93226, 0, true); put('box', cx, 7.6, cz - 6, 21, .9, 12, 0x2e7d6b);
      put('roof', cx, 8.5, cz - 6, 15, 4, 26, 0x3b4046, Math.PI / 2); put('roof', cx, 11.2, cz - 6, 10, 3, 18, 0x3b4046, Math.PI / 2);
      for (var m2 = 0; m2 < 10; m2++) tree(R(x0 + 4, x1 - 4), R(cz + 6, z1 - 6), 1, rng() < .5 ? 'pine' : 'ginkgo');
    } else {
      pad(x0, x1, z0, z1, 0xd6cfc3);
      var r = 9, py = .16; for (var q = 0; q < 7; q++) { put('cyl8', cx - 10, py, cz - 6, r, 3.2, r, q % 2 ? 0xd35400 : 0xc0392b, 0, q === 0); put('cyl8', cx - 10, py + 3.2, cz - 6, r + 3.2, .6, r + 3.2, 0x1e5631); py += 3.8; r -= .9; }
      put('cone', cx - 10, py, cz - 6, 2, 5, 2, 0xd4ac0d);
      [-1, 1].forEach(function (a) { put('cyl', cx + 8 + a * 5, .16, z1 - 3, .8, 7, .8, 0xc0392b, 0, true); });
      put('box', cx + 8, 7, z1 - 3, 14, 1, 2, 0xc0392b); put('roof', cx + 8, 8, z1 - 3, 3.5, 2.6, 16, 0xd4ac0d, Math.PI / 2);
      for (var j2 = 0; j2 < 12; j2++) tree(R(x0 + 3, x1 - 3), R(z0 + 3, z1 - 3), 1, rng() < .5 ? 'willow' : 'round');
    }
    sign(TH.N.temple, cx + 14, 2.6, z1 + .15, 0, 6, '#7c2d12', '#fde68a', true);
  }

  /* ---------- แลนด์มาร์กประจำเมือง (mesh ปกติ ไม่กี่ชิ้น) ---------- */
  function LM(geo, c, x, y, z, sx, sy, sz) { var m = new T.Mesh(geo, new T.MeshLambertMaterial({ color: c })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); CITY.add(m); return m; }
  function frustum(rt, rb, h, seg) { return new T.CylinderGeometry(rt, rb, h, seg || 4).translate(0, h / 2, 0); }
  function landmark(x0, x1, z0, z1) {
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, k = TH.lm;
    if (k === 'prang') {
      pad(x0, x1, z0, z1, 0xeee7d6); put('box', cx, .16, cz, 34, 4, 34, 0xf3ecdc, 0, true); put('box', cx, 4.16, cz, 24, 4, 24, 0xece3cf, 0, true);
      var y = 8.16, parts = [[9, 7.5, 10, 0xf2ead8], [7.5, 6.2, 9, 0xe9dcc0], [6.2, 4.6, 9, 0xf2ead8], [4.6, 3, 8, 0xe9dcc0], [3, 1.6, 8, 0xf2ead8]];
      parts.forEach(function (p) { LM(frustum(p[1], p[0], p[2], 12), p[3], cx, y, cz, 1, 1, 1); y += p[2]; });
      LM(frustum(.1, 1.6, 9, 12), 0xf5c518, cx, y, cz, 1, 1, 1);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (a) { var x = cx + a[0] * 13, z = cz + a[1] * 13, yy = 8.16; [[3.4, 2.6, 7], [2.6, 1.4, 6], [1.4, .1, 5]].forEach(function (p) { LM(frustum(p[1], p[0], p[2], 10), 0xf2ead8, x, yy, z, 1, 1, 1); yy += p[2]; }); });
      bigSign('วัดริมน้ำ', cx, 3, z1 + .2, 0, 12, '#92400e');
    } else if (k === 'tokyotower') {
      pad(x0, x1, z0, z1, 0xc9ccd1);
      var yy2 = .16, segs = [[16, 11, 34, 0xff5a1f], [11, 7.5, 30, 0xf8f8f8], [7.5, 5, 26, 0xff5a1f], [5, 3, 24, 0xf8f8f8], [3, 1.6, 22, 0xff5a1f]];
      segs.forEach(function (p, i) { LM(frustum(p[1], p[0], p[2]), p[3], cx, yy2, cz, 1, 1, 1); yy2 += p[2]; if (i === 1 || i === 3) LM(new T.BoxGeometry(1, 1, 1), 0xf8f8f8, cx, yy2, cz, p[1] * 2.2, 4, p[1] * 2.2); });
      LM(frustum(.15, .8, 20, 6), 0xf8f8f8, cx, yy2, cz, 1, 1, 1); addCol(cx, cz, 32, 32);
      put('win', cx, .16, z1 - 8, 40, 9, 12, 0xe5e7eb, 0, true);
    } else if (k === 'seoultower') {
      HILL = { x: cx, z: cz, r: 42 };
      var hill = LM(new T.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0x5f8f45, cx, 0, cz, 46, 28, 46);
      for (var i = 0; i < 46; i++) { var an = rng() * 6.28, rr = R(8, 40), hgt = 28 * Math.sqrt(Math.max(0, 1 - (rr * rr) / (46 * 46))); put('cone', cx + Math.cos(an) * rr, hgt - 1, cz + Math.sin(an) * rr, 3.4, 5, 3.4, P([0x2e5e3a, 0x3b7044, 0x4a8a3b])); }
      LM(frustum(2.2, 3.2, 62, 16), 0xf3f4f6, cx, 27, cz, 1, 1, 1); LM(frustum(6.4, 5.2, 9, 20), 0xe5e7eb, cx, 76, cz, 1, 1, 1); LM(frustum(5.2, 6.4, 3, 20), 0x9ca3af, cx, 85, cz, 1, 1, 1);
      LM(frustum(.3, 1.2, 24, 8), 0xdc2626, cx, 88, cz, 1, 1, 1);
    } else {
      pad(x0, x1, z0, z1, 0xc9ccd1);
      [[0, 1], [.87, -.5], [-.87, -.5]].forEach(function (a) { var p = LM(frustum(1.6, 2.2, 52, 10), 0xe5e7eb, cx + a[0] * 9, 0, cz + a[1] * 9, 1, 1, 1); p.rotation.z = -a[0] * .12; p.rotation.x = a[1] * .12; });
      LM(frustum(2.6, 3, 110, 12), 0xeef2f7, cx, 0, cz, 1, 1, 1);
      LM(new T.SphereGeometry(14, 22, 16), 0xd6338a, cx, 42, cz, 1, 1, 1); LM(new T.SphereGeometry(9, 20, 14), 0xd6338a, cx, 98, cz, 1, 1, 1);
      [[-1, 1], [1, 1], [0, -1]].forEach(function (a, i) { LM(new T.SphereGeometry(4, 14, 10), 0xd6338a, cx + a[0] * 9, 8, cz + a[1] * 9, 1, 1, 1); });
      LM(frustum(.2, 1.4, 34, 8), 0xe5e7eb, cx, 110, cz, 1, 1, 1); addCol(cx, cz, 28, 28);
    }
  }

  /* ---------- ถนน (รวมเป็น mesh เดียว) ---------- */
  function roadTex() {
    var cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; var g = cv.getContext('2d');
    g.fillStyle = hx(TH.road); g.fillRect(0, 0, 64, 128); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, 0, 64, 4); g.fillRect(0, 124, 64, 4);
    g.fillStyle = TH.line; g.fillRect(0, 61, 36, 6);
    var t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  var SEG = [];            /* ช่วงถนน: {ax:'x' วิ่งตามแกน x (z คงที่) | 'z', c, a, b} */
  function segs() {
    SEG = [];
    SP.forEach(function (c) {
      var inner = c === 0 || Math.abs(c) === 66;
      [['x'], ['z']].forEach(function (A) { if (inner) { SEG.push({ ax: A[0], c: c, a: -L, b: -66 }); SEG.push({ ax: A[0], c: c, a: 66, b: L }); } else SEG.push({ ax: A[0], c: c, a: -L, b: L }); });
    });
  }
  function roads() {
    var pos = [], uv = [], idx = [], n = 0, hw = 6;
    SEG.forEach(function (s) {
      var len = s.b - s.a, q;
      if (s.ax === 'x') q = [[s.a, s.c - hw], [s.b, s.c - hw], [s.b, s.c + hw], [s.a, s.c + hw]];
      else q = [[s.c + hw, s.a], [s.c + hw, s.b], [s.c - hw, s.b], [s.c - hw, s.a]];
      q.forEach(function (p) { pos.push(p[0], .03, p[1]); });
      uv.push(0, 0, len / 8, 0, len / 8, 1, 0, 1);
      if (s.ax === 'x') idx.push(n, n + 2, n + 1, n, n + 3, n + 2); else idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
      n += 4;
    });
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    var m = new T.Mesh(g, new T.MeshLambertMaterial({ map: roadTex(), side: T.DoubleSide })); m.receiveShadow = true; CITY.add(m);
    /* ต้นไม้ริมถนน */
    SEG.forEach(function (s) {
      for (var p = s.a + 10; p < s.b - 6; p += 17) {
        var near = SP.some(function (c) { return Math.abs(p - c) < 9; }); if (near) continue;
        [-1, 1].forEach(function (sd) {
          var x = s.ax === 'x' ? p : s.c + sd * 7.2, z = s.ax === 'x' ? s.c + sd * 7.2 : p;
          if (z > RV0 - 4 && z < RV1 + 4) return; if (Math.abs(x) < 72 && Math.abs(z) < 72) return;
          if (rng() < .8) tree(x, z, R(.7, 1));
        });
      }
    });
  }

  /* ---------- แม่น้ำ + สะพาน + เรือ ---------- */
  var BOATS = [];
  function river() {
    put('water', 0, -.2, (RV0 + RV1) / 2, 2 * L + 40, .34, RV1 - RV0, TH.water);
    [RV0 - .4, RV1 + .4].forEach(function (z) { put('box', 0, 0, z, 2 * L, .8, .8, 0x9ca3af); });
    SP.forEach(function (x) {
      put('box', x, 0, (RV0 + RV1) / 2, 12, .36, RV1 - RV0 + 2, TH.bridge);
      [-1, 1].forEach(function (a) { put('box', x + a * 5.8, .36, (RV0 + RV1) / 2, .3, 1, RV1 - RV0 + 2, 0xe5e7eb); });
    });
    for (var i = 0; i < 26; i++) tree(R(-L, L), RV0 - 9 + (rng() < .5 ? 0 : RV1 - RV0 + 18), .9);
    sign(TH.N.river, -100, 1.9, RV0 - .9, Math.PI, 10, '#0e7490', '#fff', true); sign(TH.N.river, 100, 1.9, RV1 + .9, 0, 10, '#0e7490', '#fff', true);
    BOATS = [];
    for (var b = 0; b < 3; b++) {
      var g = new T.Group(), hull = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: b === 1 ? 0xffffff : TH.boat })); hull.scale.set(b === 1 ? 22 : 12, 1.4, b === 1 ? 6 : 3); hull.position.y = .5; g.add(hull);
      var cab = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: b === 1 ? 0x1e3a8a : 0x7c2d12 })); cab.scale.set(b === 1 ? 12 : 4, b === 1 ? 2.6 : 1.4, b === 1 ? 4.6 : 2.4); cab.position.y = 2.2; g.add(cab);
      CITY.add(g); BOATS.push({ g: g, p: R(-L, L), z: RV0 + 10 + b * 16, sp: R(5, 9) * (b % 2 ? -1 : 1) });
    }
  }

  /* ---------- รถไฟฟ้ายกระดับ ---------- */
  var TRAIN = null;
  function rail() {
    put('box', 0, RAIL_H, RAIL_Z, 2 * L, 1.2, 7, 0xd1d5db);
    for (var x = -L + 6; x < L; x += 26) put('box', x, 0, RAIL_Z, 1.8, RAIL_H, 1.8, 0xbfc5cc, 0, true);
    put('box', 0, RAIL_H + 1.2, RAIL_Z, 46, .6, 14, 0xe5e7eb); put('box', 0, RAIL_H + 6.4, RAIL_Z, 50, .6, 16, TH.rail[0]);
    [-23, 23].forEach(function (a) { put('box', a, RAIL_H + 1.2, RAIL_Z - 6.6, .4, 5.2, .4, 0x9ca3af); put('box', a, RAIL_H + 1.2, RAIL_Z + 6.6, .4, 5.2, .4, 0x9ca3af); });
    bigSign(TH.N.station, 0, RAIL_H + 4.8, RAIL_Z + 7.1, 0, 16, hx(TH.rail[0]));
    var g = new T.Group(); for (var i = 0; i < 4; i++) {
      var c = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: TH.rail[1] })); c.scale.set(17, 3.4, 3.2); c.position.set(i * 18, RAIL_H + 2.9, 0); g.add(c);
      var st = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: TH.rail[0] })); st.scale.set(17.1, .7, 3.3); st.position.set(i * 18, RAIL_H + 2.3, 0); g.add(st);
    }
    g.position.z = RAIL_Z; CITY.add(g); TRAIN = { g: g, p: -L, sp: 22, wait: 0 };
  }

  /* ---------- รถและคน (อัปเดตทุกเฟรม) ---------- */
  var VEH = [], PED = [], VM = null, PM = null;
  function traffic() {
    VEH = []; PED = [];
    var NV = 120, NP = 150, dummy = new T.Object3D(), col = new T.Color();
    var body = new T.InstancedMesh(GEO.box, new T.MeshLambertMaterial({ color: 0xffffff }), NV), top = new T.InstancedMesh(GEO.box, new T.MeshLambertMaterial({ color: 0xffffff }), NV), base = new T.InstancedMesh(GEO.box, new T.MeshLambertMaterial({ color: 0x1f2937 }), NV);
    for (var i = 0; i < NV; i++) {
      var s = P(SEG), type = rng() < TH.tuk ? 'tuk' : rng() < .07 ? 'bus' : rng() < .3 ? 'taxi' : 'car';
      var c = type === 'taxi' ? P(TH.taxi) : type === 'bus' ? TH.bus : type === 'tuk' ? P([0x1e88e5, 0x43a047, 0xe53935, 0xfdd835]) : P(TH.car);
      var v = { s: s, p: R(s.a, s.b), dir: rng() < .5 ? 1 : -1, sp: type === 'bus' ? R(7, 9) : type === 'tuk' ? R(8, 11) : R(10, 15), type: type };
      v.dim = type === 'bus' ? [10, 2.6, 2.6, 1.3] : type === 'tuk' ? [2.8, 1, 1.5, 1.2] : [4.2, 1, 1.9, 1];
      VEH.push(v); body.setColorAt(i, col.setHex(c)); top.setColorAt(i, col.setHex(type === 'tuk' ? 0x263238 : type === 'bus' ? shade(c, 1.2) : 0x9fb4c7));
    }
    var pb = new T.InstancedMesh(GEO.box, new T.MeshLambertMaterial({ color: 0xffffff }), NP), ph = new T.InstancedMesh(GEO.ball, new T.MeshLambertMaterial({ color: 0xf1c7a5 }), NP);
    var PC = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899, 0xffffff, 0x111827, 0x64748b];
    for (var j = 0; j < NP; j++) { var s2 = P(SEG); PED.push({ s: s2, p: R(s2.a, s2.b), sd: rng() < .5 ? -1 : 1, dir: rng() < .5 ? 1 : -1, sp: R(1.1, 1.8), ph: R(0, 6) }); pb.setColorAt(j, col.setHex(P(PC))); }
    [body, top, base, pb, ph].forEach(function (m) { m.frustumCulled = false; m.instanceMatrix.setUsage(T.DynamicDrawUsage); if (m.instanceColor) m.instanceColor.needsUpdate = true; CITY.add(m); });
    VM = { body: body, top: top, base: base, d: dummy }; PM = { b: pb, h: ph };
  }
  function bridgeY(ax, x, z) { return ax === 'z' && z > RV0 - 1 && z < RV1 + 1 ? .36 : 0; }
  W.cityStep = function (dt, t) {
    if (!CITY || !VM || W.V && W.V.mode !== 'ext') return;
    var d = VM.d, i, v, x, z, ry, y;
    for (i = 0; i < VEH.length; i++) {
      v = VEH[i]; v.p += v.dir * v.sp * dt; if (v.p > v.s.b) v.p = v.s.a; if (v.p < v.s.a) v.p = v.s.b;
      var off = v.dir > 0 ? 2.8 : -2.8;
      if (v.s.ax === 'x') { x = v.p; z = v.s.c + off; ry = v.dir > 0 ? 0 : Math.PI; } else { x = v.s.c - off; z = v.p; ry = v.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
      y = bridgeY(v.s.ax, x, z); var D = v.dim;
      d.rotation.set(0, ry, 0);
      d.position.set(x, y + .45, z); d.scale.set(D[0], D[1] * (v.type === 'bus' ? 1 : .75), D[2]); d.updateMatrix(); VM.body.setMatrixAt(i, d.matrix);
      d.position.set(x, y + .45 + D[1] * (v.type === 'bus' ? 1 : .75), z); d.scale.set(v.type === 'bus' ? D[0] * .96 : D[0] * .55, v.type === 'bus' ? .9 : .7 * D[3], D[2] * .92); d.updateMatrix(); VM.top.setMatrixAt(i, d.matrix);
      d.position.set(x, y, z); d.scale.set(D[0] * .86, .45, D[2] * 1.02); d.updateMatrix(); VM.base.setMatrixAt(i, d.matrix);
    }
    VM.body.instanceMatrix.needsUpdate = VM.top.instanceMatrix.needsUpdate = VM.base.instanceMatrix.needsUpdate = true;
    for (i = 0; i < PED.length; i++) {
      v = PED[i]; v.p += v.dir * v.sp * dt; if (v.p > v.s.b) v.p = v.s.a; if (v.p < v.s.a) v.p = v.s.b;
      if (v.s.ax === 'x') { x = v.p; z = v.s.c + v.sd * 8.2; } else { x = v.s.c + v.sd * 8.2; z = v.p; }
      if (z > RV0 - 1 && z < RV1 + 1) { if (v.s.ax === 'x') z = v.s.c - v.sd * 8.2; else x = v.s.c + v.sd * 4.6; }
      var bob = Math.abs(Math.sin((t + v.ph) * 8)) * .08; y = bridgeY(v.s.ax, x, z) + .16 + bob;
      d.rotation.set(0, 0, 0); d.position.set(x, y, z); d.scale.set(.55, 1.15, .38); d.updateMatrix(); PM.b.setMatrixAt(i, d.matrix);
      d.position.set(x, y + 1.15, z); d.scale.set(.42, .42, .42); d.updateMatrix(); PM.h.setMatrixAt(i, d.matrix);
    }
    PM.b.instanceMatrix.needsUpdate = PM.h.instanceMatrix.needsUpdate = true;
    if (TRAIN) { var tr = TRAIN; if (tr.wait > 0) tr.wait -= dt; else { var was = tr.p; tr.p += tr.sp * dt; if (was < -27 && tr.p >= -27) tr.wait = 6; if (tr.p > L + 70) tr.p = -L - 70; } tr.g.position.x = tr.p; }
    BOATS.forEach(function (b) { b.p += b.sp * dt; if (b.p > L + 30) b.p = -L - 30; if (b.p < -L - 30) b.p = L + 30; b.g.position.set(b.p, Math.sin(t * 1.5 + b.z) * .1, b.z); b.g.rotation.y = b.sp > 0 ? 0 : Math.PI; });
  };

  /* ---------- สร้างทั้งเมือง ---------- */
  var SPECIAL = { '7,4': 'mall', '4,8': 'school', '9,3': 'school', '8,7': 'hosp', '3,7': 'temple', '6,8': 'park', '10,8': 'park', '5,7': 'market', '10,5': 'stadium', '4,4': 'parkS' };
  function build() {
    TH = THEMES[cur]; rng = mul(TH.seed); geos(); BUF = {}; GRID = {}; NSIGN = 0; HILL = null;
    CITY = new T.Group(); CITY.name = 'city';
    var gnd = new T.Mesh(new T.PlaneGeometry(2 * L + 900, 2 * L + 900), new T.MeshLambertMaterial({ color: TH.ground })); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -.02; gnd.receiveShadow = true; CITY.add(gnd);
    segs(); roads(); river(); rail();
    for (var ix = 0; ix < 12; ix++) for (var iz = 0; iz < 12; iz++) {
      if ((ix === 5 || ix === 6) && (iz === 5 || iz === 6)) continue;
      if (iz === 10) continue;
      var x0 = SP[ix] + 8, x1 = SP[ix + 1] - 8, z0 = SP[iz] + 8, z1 = SP[iz + 1] - 8, key = ix + ',' + iz, sp = SPECIAL[key];
      if (Math.abs(SP[iz] - RAIL_Z) < 1 || Math.abs(SP[iz + 1] - RAIL_Z) < 1) { if (Math.abs(SP[iz + 1] - RAIL_Z) < 1) z1 -= 3; else z0 += 3; }
      if (TH.lmc[0] === ix && TH.lmc[1] === iz) landmark(x0, x1, z0, z1);
      else if (sp === 'mall') mall(x0, x1, z0, z1);
      else if (sp === 'school') school(x0, x1, z0, z1);
      else if (sp === 'hosp') hospital(x0, x1, z0, z1);
      else if (sp === 'temple') temple(x0, x1, z0, z1);
      else if (sp === 'park' || sp === 'parkS') park(x0, x1, z0, z1, sp === 'park');
      else if (sp === 'market') market(x0, x1, z0, z1);
      else if (sp === 'stadium') stadium(x0, x1, z0, z1);
      else if (ix >= 1 && ix <= 3 && iz >= 1 && iz <= 3) towers(x0, x1, z0, z1);
      else if (ix >= 4 && ix <= 7 && iz >= 4 && iz <= 7) commercial(x0, x1, z0, z1);
      else if (ix === 0 || ix === 11 || iz === 0 || iz === 11) { if (rng() < .8) houses(x0, x1, z0, z1); else park(x0, x1, z0, z1); }
      else { var r = rng(); if (r < .32) condo(x0, x1, z0, z1); else if (r < .55) commercial(x0, x1, z0, z1); else houses(x0, x1, z0, z1); }
    }
    /* เนินเขารอบเมือง */
    for (var h = 0; h < 70; h++) { var an = h / 70 * Math.PI * 2, rr = L + R(60, 140); put('crown', Math.cos(an) * rr * 1.05, -6, Math.sin(an) * rr * 1.05, R(60, 120), R(25, 60), R(60, 120), P([0x6f9a55, 0x7fa862, 0x5e8a4a]), rng() * 3); }
    flush(); traffic();
    SC.add(CITY);
    SC.background = new T.Color(TH.sky); if (SC.fog) SC.fog.color.setHex(TH.sky);
  }
  function dispose() {
    if (!CITY) return; SC.remove(CITY);
    CITY.traverse(function (o) { if (o.isInstancedMesh) { o.dispose && o.dispose(); } else if (o.isMesh) { if (o.geometry && !Object.keys(GEO).some(function (k) { return GEO[k] === o.geometry; })) o.geometry.dispose(); if (o.material && o.material.map && !Object.keys(TEXC).some(function (k) { return TEXC[k] === o.material.map; })) o.material.map.dispose(); if (o.material && !Object.keys(MAT).some(function (k) { return MAT[k] === o.material; })) o.material.dispose(); } });
    CITY = null; VM = null; PM = null; TRAIN = null; BOATS = []; Object.keys(TEXC).forEach(function (k) { TEXC[k].dispose(); delete TEXC[k]; });
  }
  W.buildCity = function (sc, three) { T = three || window.THREE; SC = sc; try { build(); } catch (e) { console.error('city build', e); } };
  W.setCity = function (id) {
    if (!THEMES[id] || !SC) return false; cur = id; try { localStorage.setItem('ss_city', id); } catch (e) {}
    dispose(); build(); if (W.cb && W.cb.city) W.cb.city(id); return true;
  };
  W.cityId = function () { return cur; };
  /* ถ้าไฟล์นี้โหลดหลังฉากถูกสร้างแล้ว */
  var late = setInterval(function () { if (W.EXS && !CITY && window.THREE) { clearInterval(late); W.buildCity(W.EXS, window.THREE); } else if (CITY) clearInterval(late); }, 400);

  /* ---------- ปุ่มเลือกเมือง ---------- */
  function ui() {
    var wd = document.getElementById('wd'), ctl = wd && wd.querySelector('#wctl'); if (!ctl) return false; if (wd.querySelector('.wcity')) return true;
    var b = document.createElement('button'); b.textContent = '🌏'; b.setAttribute('aria-label', 'เปลี่ยนเมือง'); b.style.fontSize = '1.15rem'; ctl.appendChild(b);
    var pop = document.createElement('section'); pop.className = 'wpop wg wcity'; wd.appendChild(pop);
    pop.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    function draw() {
      pop.innerHTML = '<h3>🌏 เลือกเมือง<button data-x="1" aria-label="ปิด">✕</button></h3>' + Object.keys(THEMES).map(function (k) { var t = THEMES[k]; return '<button class="wcr' + (k === cur ? ' on' : '') + '" data-city="' + k + '"><i>' + t.flag + '</i><span><b>' + t.name + ' · ' + t.country + '</b><small>' + t.desc + '</small></span></button>'; }).join('') +
        '<div class="wbr"><button data-zoom="1">🔭 ดูทั้งเมือง</button><button class="p" data-home="1">🏠 กลับร้าน</button></div><div class="wsl" style="margin-top:8px"><span>เดินสำรวจเมือง: กด 🎥 → Free Roam · เดินออกจากที่ดินร้านไปได้ทุกทิศ</span></div>';
    }
    b.onclick = function () { document.querySelectorAll('#wd .wpop.on').forEach(function (p) { if (p !== pop) p.classList.remove('on'); }); draw(); pop.classList.toggle('on'); };
    pop.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.dataset.x) pop.classList.remove('on');
      if (t.dataset.city) { var id = t.dataset.city; pop.innerHTML = '<h3>⏳ กำลังสร้างเมือง ' + THEMES[id].name + '...</h3>'; setTimeout(function () { W.setCity(id); pop.classList.remove('on'); if (window.toast) window.toast(THEMES[id].flag + ' ยินดีต้อนรับสู่' + THEMES[id].name); }, 40); }
      if (t.dataset.zoom && W.V) { W.V.zoom = W.ZMIN * 1.3; W.V.tx = 0; W.V.tz = 0; pop.classList.remove('on'); }
      if (t.dataset.home && W.recenter) { W.recenter(); pop.classList.remove('on'); }
    });
    return true;
  }
  var ut = setInterval(function () { if (ui()) clearInterval(ut); }, 500);
})();
