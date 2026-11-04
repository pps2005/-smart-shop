/* ============================================================
   world-life.js — ทำให้เมืองมีชีวิต
   1) กลางวัน/กลางคืนตามเวลาจริง (กรุงเทพฯ) · ไฟหน้าต่าง · ไฟถนน · ปุ่มสลับ อัตโนมัติ/กลางวัน/กลางคืน
   2) NPC คนทำงานทั่วเมือง (บาริสต้า แม่ค้า รปภ. พยาบาล ครู พนักงานสถานี คนงาน ฯลฯ) คุยได้
      บทพูดประกอบจากชุดคำ ได้มากกว่า 100,000 แบบ · บอกทางจากแผนที่จริงในเกม · สั่งกาแฟ/อาหารได้
   3) เมืองเปลี่ยนเองทุกวัน: ซ่อมถนน · ไซต์ก่อสร้าง · แจ้งเตือนเมื่อเดินเข้าใกล้ (รวมตึกเช่าจริง)
   4) เข้าตึกเช่า → ลิฟต์ → ดูห้องแต่ละชั้นจากข้อมูลจริงในหน้าอสังหา
   ลำดับโหลด: หลัง world-rent.js
   ============================================================ */
(function () {
  'use strict';
  var W = window.SSW = window.SSW || {};
  var T = null, G = null, NPCS = [], EVENTS = [], LAMPS = null, built = -1, dayKey = '', lights = null, daySky = null;
  var told = {}, pop = null, cur = null, prompt = null;
  W.NIGHT = W.NIGHT || { value: 0 };

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function mul(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var TZ = { bkk: 'Asia/Bangkok', tyo: 'Asia/Tokyo', sel: 'Asia/Seoul', sha: 'Asia/Shanghai' };
  function bkk() { var id = W.cityId ? W.cityId() : 'bkk'; return new Date(new Date().toLocaleString('en-US', { timeZone: TZ[id] || 'Asia/Bangkok' })); }
  W.cityNow = bkk;
  function hm() { var d = bkk(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function say(t) { if (typeof toast === 'function') toast(t); }

  /* ================= 1) กลางวัน / กลางคืน ================= */
  var MODE = localStorage.getItem('ss_daymode') || 'auto';
  function dayK() {
    if (MODE === 'day') return 1; if (MODE === 'night') return 0;
    var d = bkk(), h = d.getHours() + d.getMinutes() / 60;
    if (h >= 7 && h < 17.5) return 1; if (h >= 19.3 || h < 5.3) return 0;
    if (h < 7) return (h - 5.3) / 1.7; return 1 - (h - 17.5) / 1.8;
  }
  function findLights() {
    var sc = W.EXS; if (!sc) return null;
    var L = { hemi: [], dir: [], amb: [] };
    sc.traverse(function (o) {
      if (!(o.isHemisphereLight || o.isDirectionalLight || o.isAmbientLight)) return;
      if (o.userData.baseI == null) { o.userData.baseI = o.intensity; o.userData.baseC = o.color.clone(); }
      if (o.isHemisphereLight) L.hemi.push([o, o.userData.baseI]); else if (o.isDirectionalLight) L.dir.push([o, o.userData.baseI, o.userData.baseC]); else L.amb.push([o, o.userData.baseI]);
    });
    return L;
  }
  var NIGHT_SKY = null, DUSK = null;
  function applyDay() {
    if (!T || !W.EXS) return;
    if (!lights) lights = findLights();
    if (!NIGHT_SKY) { NIGHT_SKY = new T.Color(0x0d1630); DUSK = new T.Color(0xf2a86b); }
    var k = dayK(), n = 1 - k, sc = W.EXS;
    W.NIGHT.value = n;
    lights.hemi.forEach(function (a) { a[0].intensity = a[1] * (0.32 + 0.68 * k); });
    lights.amb.forEach(function (a) { a[0].intensity = a[1] * (0.35 + 0.65 * k); });
    lights.dir.forEach(function (a) { a[0].intensity = a[1] * (0.12 + 0.88 * k); var dusk = k > 0 && k < 1 ? Math.sin(k * Math.PI) : 0; a[0].color.copy(a[2]).lerp(DUSK, dusk * .6).lerp(new T.Color(0x8aa0d8), n * .6); });
    if (sc.background && sc.background.isColor) {
      if (!daySky) daySky = sc.background.clone();
      var c = daySky.clone().lerp(DUSK, (k > 0 && k < 1 ? Math.sin(k * Math.PI) : 0) * .35).lerp(NIGHT_SKY, n);
      sc.background.copy(c); if (sc.fog) sc.fog.color.copy(c);
    }
    if (LAMPS) { LAMPS.material.opacity = n * .95; LAMPS.visible = n > .05; }
    NPCS.forEach(function (p) { if (p.lamp) p.lamp.material.opacity = n; });
    var b = document.getElementById('wday');
    if (b) b.innerHTML = (MODE === 'auto' ? (n > .5 ? '🌙' : k < 1 ? '🌇' : '🌞') : MODE === 'day' ? '🌞' : '🌙') + ' <b>' + hm() + '</b> <small>' + (MODE === 'auto' ? 'ตามเวลาจริง' : MODE === 'day' ? 'กลางวัน' : 'กลางคืน') + '</small>';
  }
  function glowTex() {
    var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d');
    var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,236,190,1)'); gr.addColorStop(.25, 'rgba(255,210,140,.75)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
  }
  function streetLamps() {
    var SP = [-416, -346, -276, -206, -136, -66, 0, 66, 136, 206, 276, 346, 416], pos = [];
    SP.forEach(function (a) { SP.forEach(function (b) { for (var t = 0; t < 70; t += 23) { pos.push(a + 6, 5.5, b + t + 8); pos.push(a + t + 8, 5.5, b - 6); } }); });
    var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    var m = new T.PointsMaterial({ map: glowTex(), size: 7, transparent: true, depthWrite: false, opacity: 0, blending: T.AdditiveBlending });
    LAMPS = new T.Points(geo, m); LAMPS.renderOrder = 5; G.add(LAMPS);
  }

  /* ================= 2) NPC ================= */
  var ROLES = {
    barista: { t: 'บาริสต้า', ic: '☕', col: 0x6b3f2a, hat: 0x3b2418, shop: 'cafe', names: ['มินท์', 'โบ๊ท', 'แพรว', 'ต้นข้าว', 'จูน'], place: 'ร้านกาแฟ' },
    vendor: { t: 'แม่ค้าอาหาร', ic: '🍜', col: 0xd94848, hat: 0xffffff, shop: 'food', names: ['ป้าแดง', 'พี่นก', 'น้าเปิ้ล', 'ลุงชัย'], place: 'รถเข็นอาหาร' },
    market: { t: 'แม่ค้าตลาด', ic: '🧺', col: 0x2f8f5b, hat: 0xf2c94c, shop: 'fruit', names: ['ป้าสมศรี', 'พี่อ้อย', 'น้าบุญ'], place: 'ตลาด' },
    guard: { t: 'รปภ.', ic: '💂', col: 0x1f3b73, hat: 0x111827, names: ['ลุงเสริม', 'พี่ชาติ', 'น้าเปี๊ยก'], place: 'ป้อมยาม' },
    nurse: { t: 'พยาบาล', ic: '👩‍⚕️', col: 0xf8fafc, hat: 0xffffff, names: ['พี่แอน', 'พี่ฝน', 'พี่หมิว'], place: 'โรงพยาบาล' },
    teacher: { t: 'คุณครู', ic: '👩‍🏫', col: 0x8e44ad, hat: 0x3b2418, names: ['ครูน้ำฝน', 'ครูวิชัย', 'ครูส้ม'], place: 'โรงเรียน' },
    staff: { t: 'พนักงานห้าง', ic: '🛍️', col: 0xe5a8d0, hat: 0x3b2418, names: ['น้องเฟิร์น', 'น้องบีม', 'น้องแพม'], place: 'ห้าง' },
    station: { t: 'เจ้าหน้าที่สถานี', ic: '🚉', col: 0x2e7d32, hat: 0x1b5e20, names: ['พี่ก้อง', 'พี่นุ่น'], place: 'สถานีรถไฟฟ้า' },
    worker: { t: 'คนงานก่อสร้าง', ic: '👷', col: 0xf2a93b, hat: 0xf4d03f, names: ['พี่หมาน', 'ลุงจ่อย', 'พี่ต่อ'], place: 'ไซต์งาน' },
    gardener: { t: 'คนดูแลสวน', ic: '🧑‍🌾', col: 0x4e9a3c, hat: 0xd9a35b, names: ['ลุงทอง', 'ป้าจันทร์'], place: 'สวนสาธารณะ' },
    coach: { t: 'โค้ชกีฬา', ic: '🏃', col: 0x2c6fb8, hat: 0xffffff, names: ['โค้ชเบียร์', 'โค้ชหมี'], place: 'สนามกีฬา' },
    keeper: { t: 'เจ้าหน้าที่ศาสนสถาน', ic: '🛕', col: 0xf2c037, hat: 0x3b2418, names: ['พี่ธรรม', 'ลุงศักดิ์'], place: 'วัด/ศาลเจ้า' },
    guide: { t: 'ไกด์นำเที่ยว', ic: '🗺️', col: 0x3a86d4, hat: 0xff5fa2, names: ['พี่โอ๊ต', 'พี่ปุ้ย'], place: 'แลนด์มาร์ก' },
    clerk: { t: 'พนักงานร้านสะดวกซื้อ', ic: '🏪', col: 0x0f8a4a, hat: 0xf47b20, shop: 'conv', names: ['น้องมิว', 'น้องเจ', 'พี่ก้อย'], place: 'ร้านสะดวกซื้อ' },
    reception: { t: 'พนักงานต้อนรับโรงแรม', ic: '🛎️', col: 0x3b2a14, hat: 0xb08d57, names: ['คุณพลอย', 'คุณกันต์'], place: 'โรงแรม' },
    parkstaff: { t: 'พนักงานสวนสนุก', ic: '🎡', col: 0x7c3aed, hat: 0xfacc15, names: ['พี่เมย์', 'พี่บอส'], place: 'สวนสนุก' },
    recruiter: { t: 'ฝ่ายจัดหางาน', ic: '💼', col: 0x1d4ed8, hat: 0x111827, names: ['คุณนิด', 'คุณภพ'], place: 'บริษัทจัดหางาน' },
    rider: { t: 'ไรเดอร์', ic: '🛵', col: 0x16a34a, hat: 0x16a34a, names: ['พี่วิน', 'พี่หนุ่ม', 'พี่ปั๊ม'], place: 'ริมถนน' },
    manager: { t: 'นิติบุคคลตึก', ic: '🧑‍💼', col: 0x334155, hat: 0x111827, names: ['คุณปรีชา', 'คุณวรรณ', 'คุณเอก'], place: 'ล็อบบี้ตึก' },
  };
  var POI_ROLE = { conv: ['clerk', 'rider'], hotel: ['reception', 'guard'], park2: ['parkstaff', 'vendor'], agency: ['recruiter'], school: ['teacher', 'guard'], hosp: ['nurse', 'guard'], mall: ['staff', 'guard'], market: ['market', 'vendor'], park: ['gardener', 'vendor'], stadium: ['coach'], station: ['station', 'barista'], temple: ['keeper'], landmark: ['guide', 'vendor'] };
  var POI_TH = { school: 'โรงเรียน', hosp: 'โรงพยาบาล', mall: 'ห้าง', market: 'ตลาด', temple: 'วัด', park: 'สวน', stadium: 'สนามกีฬา', station: 'สถานีรถไฟฟ้า', landmark: 'แลนด์มาร์ก', cafe: 'ร้านกาแฟ', rent: 'ตึกเช่า' };
  var MENUS = {
    cafe: [['อเมริกาโน่', 45, '☕'], ['ลาเต้', 55, '☕'], ['คาปูชิโน่', 55, '☕'], ['มอคค่า', 60, '🍫'], ['ชาไทย', 45, '🧋'], ['ชาเขียวมัทฉะ', 60, '🍵'], ['โกโก้', 50, '🍫'], ['น้ำมะนาวโซดา', 40, '🍋'], ['ครัวซองต์', 55, '🥐'], ['บราวนี่', 50, '🍫'], ['เค้กส้ม', 65, '🍰'], ['แซนด์วิชแฮมชีส', 69, '🥪']],
    food: [['ข้าวมันไก่', 50, '🍗'], ['กะเพราหมูสับไข่ดาว', 60, '🍳'], ['ก๋วยเตี๋ยวต้มยำ', 50, '🍜'], ['ข้าวผัดกุ้ง', 60, '🍤'], ['ผัดไทย', 55, '🍜'], ['ส้มตำไทย', 45, '🥗'], ['หมูปิ้ง+ข้าวเหนียว', 35, '🍢'], ['น้ำเปล่า', 10, '💧']],
    conv: [['ข้าวกล่องเข้าไมโครเวฟ', 45, '🍱'], ['แซนด์วิช', 35, '🥪'], ['ซาลาเปา', 20, '🥟'], ['ไส้กรอกย่าง', 25, '🌭'], ['โอนิกิริ', 25, '🍙'], ['นมเย็น', 15, '🥛'], ['น้ำดื่ม', 7, '💧'], ['กาแฟกระป๋อง', 20, '🥫'], ['ขนมมันฝรั่ง', 20, '🍟'], ['ไอศกรีม', 25, '🍦']],
    fruit: [['มะม่วง (กก.)', 60, '🥭'], ['ส้ม (กก.)', 50, '🍊'], ['กล้วยหอม (หวี)', 40, '🍌'], ['แตงโม (ลูก)', 45, '🍉'], ['สับปะรด (ลูก)', 35, '🍍'], ['ผักรวม (กำ)', 20, '🥬']],
  };
  var OPT = { cafe: { size: [['S', 0], ['M', 10], ['L', 20]], sweet: ['0%', '25%', '50%', '100%'], temp: ['ร้อน', 'เย็น', 'ปั่น'] } };

  function person(role) {
    var r = ROLES[role], g = new T.Group(), skin = new T.MeshLambertMaterial({ color: 0xf1c7a8 });
    var body = new T.MeshLambertMaterial({ color: r.col }), dark = new T.MeshLambertMaterial({ color: 0x1f2937 });
    var b = new T.Mesh(new T.BoxGeometry(.62, .8, .34), body); b.position.y = 1.25; g.add(b);
    var l1 = new T.Mesh(new T.BoxGeometry(.24, .82, .26), dark); l1.position.set(-.15, .42, 0); var l2 = l1.clone(); l2.position.x = .15; g.add(l1, l2);
    var h = new T.Mesh(new T.SphereGeometry(.26, 12, 10), skin); h.position.y = 1.9; g.add(h);
    var cap = new T.Mesh(new T.CylinderGeometry(.27, .29, .14, 12), new T.MeshLambertMaterial({ color: r.hat })); cap.position.y = 2.1; g.add(cap);
    var a1 = new T.Mesh(new T.BoxGeometry(.16, .7, .18), body); a1.position.set(-.4, 1.25, 0); var a2 = a1.clone(); a2.position.x = .4; g.add(a1, a2);
    g.userData.parts = { body: b, head: h, a1: a1, a2: a2 };
    g.scale.setScalar(.78);   /* สูงประมาณ 1.7 ม. เท่าคนจริง */
    return g;
  }
  function kiosk(kind, x, z) {
    var g = new T.Group(); g.position.set(x, 0, z);
    var col = kind === 'cafe' ? 0x7a4a2a : kind === 'food' ? 0xc0392b : 0x2f8f5b;
    var base = new T.Mesh(new T.BoxGeometry(3.4, 1.1, 1.4), new T.MeshLambertMaterial({ color: col })); base.position.y = .55; g.add(base);
    var top = new T.Mesh(new T.BoxGeometry(3.8, .15, 2.2), new T.MeshLambertMaterial({ color: 0xffffff })); top.position.y = 2.7; g.add(top);
    [-1.7, 1.7].forEach(function (a) { var p = new T.Mesh(new T.BoxGeometry(.1, 1.6, .1), new T.MeshLambertMaterial({ color: 0x475569 })); p.position.set(a, 1.9, .6); g.add(p); });
    var c = document.createElement('canvas'); c.width = 256; c.height = 64; var q = c.getContext('2d');
    q.fillStyle = kind === 'cafe' ? '#3b2418' : kind === 'food' ? '#7f1d1d' : '#14532d'; q.fillRect(0, 0, 256, 64);
    q.fillStyle = '#fff'; q.font = 'bold 34px "Noto Sans Thai",system-ui'; q.textAlign = 'center'; q.textBaseline = 'middle';
    q.fillText(kind === 'cafe' ? '☕ กาแฟสด' : kind === 'food' ? '🍜 อาหารตามสั่ง' : '🧺 ผักผลไม้', 128, 34);
    var sg = new T.Mesh(new T.PlaneGeometry(3.4, .85), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c) })); sg.position.set(0, 3.2, 1.11); g.add(sg);
    var sg2 = sg.clone(); sg2.rotation.y = Math.PI; sg2.position.z = -1.11; g.add(sg2);
    G.add(g); if (W.cityCol) W.cityCol(x, z, 3.6, 1.6);
    return g;
  }
  var SPL = [-416, -346, -276, -206, -136, -66, 0, 66, 136, 206, 276, 346, 416];
  function onRoad(x, z) { for (var i = 0; i < SPL.length; i++) if (Math.abs(x - SPL[i]) < 7.2 || Math.abs(z - SPL[i]) < 7.2) return true; return false; }
  W.onRoad = onRoad;
  function freeSpot(x, z, tries) {
    var dirs = [[0, 0], [0, 4], [0, -4], [4, 0], [-4, 0], [6, 6], [-6, 6], [6, -6], [-6, -6], [0, 9], [9, 0], [0, -9], [-9, 0], [12, 0], [0, 12], [-12, 0], [0, -12]];
    for (var i = 0; i < dirs.length; i++) { var a = x + dirs[i][0], b = z + dirs[i][1]; if (!onRoad(a, b) && (!W.cityHit || !W.cityHit(a, b, .9))) return [a, b]; }
    return null;
  }
  function addNPC(role, x, z, face, extra) {
    var sp = freeSpot(x, z); if (!sp) return null;
    var r = ROLES[role], g = person(role); g.position.set(sp[0], 0, sp[1]); g.rotation.y = face || 0;
    var id = NPCS.length, npc = { id: id, role: role, r: r, name: r.names[id % r.names.length], g: g, x: sp[0], z: sp[1], ph: Math.random() * 6, extra: extra || {} };
    g.userData.k = 'npc:' + id; g.traverse(function (o) { o.userData.k = 'npc:' + id; o.userData.lifeNpc = true; });
    G.add(g); if (W.EX && W.EX.pick) W.EX.pick.push(g);
    var wd = document.getElementById('wd');
    if (wd && W.tagAdd) {
      var e = document.createElement('div'); e.className = 'wtag wnpc'; e.textContent = r.ic + ' ' + npc.name;
      wd.appendChild(e); W.tagAdd(e, g, 2.1, 'ext'); npc.tag = e;
    }
    NPCS.push(npc); return npc;
  }

  /* ---------- บทพูด (ประกอบจากชุดคำ → มากกว่า 100,000 แบบ) ---------- */
  var OPEN = ['', 'อ้อ ', 'อืม ', 'ได้เลยครับ/ค่ะ ', 'ยินดีครับ/ค่ะ ', 'ว่าแต่ ', 'เอาจริงนะ ', 'บอกตรงๆ ', 'จริงๆ แล้ว ', 'ฮ่าๆ ', 'ใช่เลย ', 'โอ้ ', 'เอ้อ ', 'แหม ', 'ขอบอกว่า ', 'ฟังนะ ', 'ตามที่รู้มา ', 'ถ้าให้แนะนำ ', 'อ๋อ เรื่องนี้ ', 'ดีจังที่ถาม '];
  var CLOSE = ['', ' นะครับ/คะ', ' ครับ/ค่ะ', ' ล่ะ', ' แหละ', ' 😊', ' ฮ่าๆ', ' ถ้ามีอะไรถามได้อีกนะ', ' ขอให้เป็นวันที่ดีนะ', ' แวะมาอีกนะ', ' ระวังรถด้วยนะ', ' ดูแลตัวเองด้วย', ' ไว้เจอกันใหม่', ' ยิ้มเข้าไว้', ' สู้ๆ', ' ไม่ต้องเกรงใจ', ' ✨', ' 👍', ' จ้า', ' นะ'];
  var TIMEW = function () { var h = bkk().getHours(); return h < 11 ? 'เช้า' : h < 16 ? 'บ่าย' : h < 19 ? 'เย็น' : 'ค่ำ'; };
  var CORE = {
    greet: [
      function (n) { return 'สวัสดีตอน' + TIMEW() + ' ผม/ฉัน' + n.name + ' เป็น' + n.r.t + 'อยู่ตรงนี้'; },
      function (n) { return 'หวัดดี วันนี้มาทำอะไรแถว' + n.r.place + 'เหรอ'; },
      function (n) { return 'ยินดีต้อนรับสู่' + n.r.place + ' มีอะไรให้ช่วยไหม'; },
      function (n) { return 'อ้าว มาพอดีเลย ตอนนี้' + (W.NIGHT.value > .5 ? 'ค่ำแล้วคนเริ่มน้อย' : 'คนกำลังเยอะเลย'); },
      function (n) { return 'สวัสดี ' + n.name + 'เองนะ ทำงานที่' + n.r.place + 'มา' + (2 + n.id % 9) + ' ปีแล้ว'; },
    ],
    how: [
      function () { return pick(['สบายดี', 'ยุ่งนิดหน่อยแต่ไหว', 'วันนี้งานเยอะแต่สนุก', 'เหนื่อยหน่อยแต่ยังยิ้มได้', 'ดีมาก ลูกค้าใจดีทั้งวัน']); },
      function () { return pick(['ก็เรื่อยๆ', 'ดีขึ้นเยอะหลังได้กินข้าว', 'อากาศ' + (W.NIGHT.value > .5 ? 'เย็นสบาย' : 'ร้อนหน่อย') + 'แต่โอเค']); },
    ],
    job: [
      function (n) { return 'งานของ' + n.r.t + 'ก็' + ({ barista: 'ชงกาแฟ ทำความสะอาดเครื่อง จำชื่อลูกค้าประจำ', vendor: 'ตื่นตีสี่ไปจ่ายตลาด แล้วมาตั้งร้าน', market: 'คัดผักผลไม้สดๆ ทุกเช้า', guard: 'ดูแลความปลอดภัย ตรวจคนเข้าออก', nurse: 'ดูแลคนไข้ วัดความดัน จ่ายยาตามหมอสั่ง', teacher: 'สอนหนังสือ ตรวจการบ้าน ดูแลเด็กๆ', staff: 'แนะนำสินค้า จัดชั้น ดูแลลูกค้า', station: 'ช่วยคนซื้อตั๋ว บอกทาง ดูแลชานชาลา', worker: 'ก่อสร้างและซ่อมถนนให้ทุกคนเดินทางสะดวก', gardener: 'รดน้ำต้นไม้ ตัดหญ้า ดูแลสวน', coach: 'ฝึกนักกีฬา จัดตารางซ้อม', keeper: 'ดูแลความสะอาดและต้อนรับคนมาไหว้', guide: 'พาเที่ยวและเล่าประวัติเมือง', manager: 'ดูแลตึก รับแจ้งซ่อม เก็บค่าส่วนกลาง' }[n.role] || 'ช่วยทุกคนที่ผ่านมา'); },
      function (n) { return 'เข้างาน' + pick(['เจ็ดโมง', 'แปดโมง', 'เก้าโมง', 'สิบโมง']) + ' เลิก' + pick(['ห้าโมงเย็น', 'หกโมง', 'สองทุ่ม']) + ' เหนื่อยแต่ชอบงานนี้'; },
    ],
    food: [function () { return 'แถวนี้ลอง' + pick(['ข้าวมันไก่', 'ก๋วยเตี๋ยวเรือ', 'ส้มตำ', 'ข้าวขาหมู', 'ผัดไทย', 'ราเมง', 'ชาไทย']) + 'สิ อร่อยมาก ร้านอยู่' + pick(['หัวมุมถนน', 'ใกล้สถานี', 'ตรงข้ามห้าง', 'ในตลาด']); }],
    traffic: [function () { return pick(['ช่วงเช้ารถติดมาก ขึ้นรถไฟฟ้าดีกว่า', 'ตอนนี้รถไม่ค่อยติด', 'เย็นนี้ระวังรถติดแถวห้าง', 'ถ้ารีบ เดินลัดสวนจะเร็วกว่า']) + (EVENTS.some(function (e) { return e.t === 'road'; }) ? ' แล้ววันนี้มีซ่อมถนนด้วยนะ' : ''); }],
    weather: [function () { return 'ตอนนี้ ' + hm() + ' น. ' + (W.NIGHT.value > .5 ? 'มืดแล้ว เดินกลับบ้านระวังตัวด้วย' : pick(['แดดดีมาก', 'ฟ้าใส', 'ร้อนหน่อย พกน้ำด้วย', 'อาจมีฝนตอนบ่าย'])); }],
    family: [function () { return pick(['ที่บ้านมีลูกสองคน', 'อยู่กับแม่และแมวหนึ่งตัว', 'แฟนทำงานแถวนี้เหมือนกัน', 'เพิ่งย้ายมาอยู่เมืองนี้ปีที่แล้ว']) + ' ' + pick(['วันหยุดชอบไปเที่ยวทะเล', 'ชอบทำกับข้าวกินเอง', 'ชอบดูหนัง', 'ชอบเล่นกีฬา']); }],
    thanks: [function () { return pick(['ไม่เป็นไรเลย', 'ด้วยความยินดี', 'ยินดีช่วยเสมอ', 'สบายมาก']); }],
    bye: [function () { return pick(['บ๊ายบาย', 'แล้วเจอกันใหม่', 'เดินทางปลอดภัย', 'โชคดีนะ']); }],
    unknown: [
      function (n) { return 'เรื่องนั้นไม่ค่อยรู้เท่าไหร่ แต่ถ้าเกี่ยวกับ' + n.r.place + 'ถามได้เลย'; },
      function () { return 'ขอโทษที ฟังไม่ค่อยทัน ลองถามเรื่องทาง อาหาร หรือที่เที่ยวแถวนี้ดูไหม'; },
      function () { return 'น่าสนใจนะ ' + pick(['เล่าเพิ่มได้ไหม', 'ไม่เคยคิดมาก่อนเลย', 'เดี๋ยวลองไปถามเพื่อนดู']); },
    ],
  };
  // คำนวณจำนวนแบบที่สร้างได้ (แสดงให้รู้ว่าเกิน 100,000)
  W.npcLineCount = function () { var c = 0; Object.keys(CORE).forEach(function (k) { c += CORE[k].length * 8; }); return OPEN.length * CLOSE.length * c * Object.keys(ROLES).length; };
  function polite(n, s) { var f = (n.id % 2) === 0; return s.replace(/ผม\/ฉัน/g, f ? 'ฉัน' : 'ผม').replace(/ครับ\/ค่ะ/g, f ? 'ค่ะ' : 'ครับ').replace(/ครับ\/คะ/g, f ? 'คะ' : 'ครับ'); }
  function line(n, intent) { var c = pick(CORE[intent] || CORE.unknown)(n); return polite(n, pick(OPEN) + c + pick(CLOSE)); }

  var DIR = ['ทิศเหนือ', 'ทิศตะวันออกเฉียงเหนือ', 'ทิศตะวันออก', 'ทิศตะวันออกเฉียงใต้', 'ทิศใต้', 'ทิศตะวันตกเฉียงใต้', 'ทิศตะวันตก', 'ทิศตะวันตกเฉียงเหนือ'];
  function direction(n, kind) {
    var list = (W.POI || []).filter(function (q) { return q.t === kind; });
    if (kind === 'rent') list = (W.rentPlaced || []).map(function (p) { return { x: p.x, z: p.z, n: p.name }; });
    if (kind === 'cafe') list = NPCS.filter(function (p) { return p.role === 'barista'; }).map(function (p) { return { x: p.x, z: p.z, n: 'ร้านกาแฟของ' + p.name }; });
    if (!list.length) return 'แถวนี้ไม่มี' + POI_TH[kind] + 'เลย';
    var b = list.slice().sort(function (a, c) { return Math.hypot(a.x - n.x, a.z - n.z) - Math.hypot(c.x - n.x, c.z - n.z); })[0];
    var d = Math.hypot(b.x - n.x, b.z - n.z), ang = Math.atan2(b.x - n.x, -(b.z - n.z)), di = DIR[(Math.round(ang / (Math.PI / 4)) + 8) % 8];
    if (d < 25) return POI_TH[kind] + 'อยู่ตรงนี้เลย';
    return (b.n || POI_TH[kind]) + 'อยู่' + di + ' ประมาณ ' + Math.round(d / 10) * 10 + ' เมตร เดินราว ' + Math.max(1, Math.round(d / 80)) + ' นาที' + (d > 300 ? ' ขึ้นรถไฟฟ้าก็ได้' : '');
  }
  var KW = [
    [/สวัสดี|หวัดดี|ดีครับ|ดีค่ะ|hello|hi\b/i, 'greet'], [/สบายดี|เป็นไง|เหนื่อยไหม/, 'how'], [/ทำงาน|ทำอะไร|หน้าที่|งานของ/, 'job'],
    [/กินอะไร|ร้านอร่อย|หิว|อาหาร/, 'food'], [/รถติด|เดินทาง|รถ/, 'traffic'], [/อากาศ|ฝน|ร้อน|กี่โมง|เวลา/, 'weather'], [/ครอบครัว|บ้าน|ลูก|แฟน|วันหยุด/, 'family'],
    [/ขอบคุณ|ขอบใจ|thank/i, 'thanks'], [/บาย|ลาก่อน|ไปก่อน/, 'bye'],
  ];
  var WHERE = [[/โรงเรียน|รร\./, 'school'], [/โรงพยาบาล|รพ\.|หมอ/, 'hosp'], [/ห้าง|ช้อป/, 'mall'], [/ตลาด/, 'market'], [/สวน/, 'park'], [/สถานี|รถไฟฟ้า|bts|mrt/i, 'station'], [/วัด|ศาลเจ้า/, 'temple'], [/สนามกีฬา/, 'stadium'], [/แลนด์มาร์ก|ที่เที่ยว/, 'landmark'], [/กาแฟ|คาเฟ่/, 'cafe'], [/ตึกเช่า|ห้องเช่า|คอนโด|หอ/, 'rent']];
  function answer(n, q) {
    q = String(q || '');
    var w = WHERE.find(function (x) { return x[0].test(q); });
    if (w && /ไป|ที่ไหน|ทาง|อยู่ไหน|ใกล้|แถวนี้/.test(q)) return polite(n, pick(OPEN) + direction(n, w[1]) + pick(CLOSE));
    if (n.role === 'manager' && /ว่าง|ห้อง|เช่า|ค้าง|จ่าย/.test(q) && n.extra.rent) return managerInfo(n);
    if (n.r.shop && /สั่ง|ซื้อ|เมนู|ราคา|มีอะไร|ขาย/.test(q)) { setTimeout(function () { showMenu(n); }, 300); return polite(n, 'นี่เมนูของเรา เลือกได้เลยครับ/ค่ะ'); }
    var k = KW.find(function (x) { return x[0].test(q); });
    return line(n, k ? k[1] : 'unknown');
  }
  function managerInfo(n) {
    var p = (W.rentPlaced || []).find(function (x) { return x.id === n.extra.rent; });
    if (!p) return polite(n, 'ข้อมูลตึกกำลังโหลดอยู่ครับ/ค่ะ');
    return polite(n, 'ตึก' + p.name + ' ตอนนี้' + (p.vac ? 'มีห้องว่าง ' + p.vac + ' ห้อง' : 'ห้องเต็มแล้ว') + (p.over ? ' และมีห้องค้างจ่าย ' + p.over + ' ห้อง' : ' ไม่มีห้องค้างจ่าย') + ' อยากดูชั้นไหนขึ้นลิฟต์ได้เลยครับ/ค่ะ');
  }

  /* ---------- หน้าต่างคุย / สั่งของ ---------- */
  var ORD = []; try { ORD = JSON.parse(localStorage.getItem('ss_orders') || '[]'); } catch (e) {}
  function ensurePop() {
    if (pop) return pop;
    pop = document.createElement('div'); pop.id = 'wlife';
    (document.getElementById('wd') || document.body).appendChild(pop);
    ['pointerdown', 'wheel', 'touchstart'].forEach(function (ev) { pop.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true }); });
    pop.addEventListener('click', onClick);
    pop.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'wlq') { e.preventDefault(); sendQ(); } });
    return pop;
  }
  function bubble(who, txt) {
    var l = document.getElementById('wll'); if (!l) return;
    var d = document.createElement('div'); d.className = 'wlm ' + who; d.textContent = txt; l.appendChild(d); l.scrollTop = l.scrollHeight;
  }
  var CHIPS = ['สวัสดี', 'ทำงานอะไร', 'แถวนี้กินอะไรดี', 'ไปสถานีรถไฟฟ้ายังไง', 'โรงพยาบาลอยู่ไหน', 'อากาศเป็นไง', 'ขอบคุณ'];
  function talk(n) {
    ensurePop(); cur = n;
    n.g.rotation.y = W.pc ? Math.atan2(W.pc.position.x - n.x, W.pc.position.z - n.z) : n.g.rotation.y;
    var chips = (n.r.shop ? ['🛒 ดูเมนู/สั่ง'] : []).concat(n.role === 'manager' ? ['มีห้องว่างไหม', '🛗 ขึ้นลิฟต์'] : []).concat(W.lifeChips ? W.lifeChips(n) : []).concat(CHIPS);
    pop.innerHTML = '<div class="wlh"><span class="wla">' + n.r.ic + '</span><div><b>' + E(n.name) + '</b><small>' + E(n.r.t) + ' · ' + E(n.r.place) + '</small></div><button data-l="x">✕</button></div>' +
      '<div class="wll" id="wll"></div><div class="wlc">' + chips.map(function (c) { return '<button data-l="chip">' + E(c) + '</button>'; }).join('') + '</div>' +
      '<div class="wli"><input id="wlq" placeholder="พิมพ์คุยกับ ' + E(n.name) + '…" autocomplete="off"><button data-l="send">➤</button></div>';
    pop.classList.add('on');
    bubble('n', line(n, 'greet'));
  }
  function sendQ(txt) {
    var i = document.getElementById('wlq'), q = (txt || (i && i.value) || '').trim(); if (!q || !cur) return; if (i) i.value = '';
    bubble('u', q);
    var n = cur; setTimeout(function () { bubble('n', answer(n, q)); }, 350 + Math.random() * 400);
  }
  function showMenu(n) {
    var M = MENUS[n.r.shop]; if (!M) return;
    if (W.isOpen && !W.isOpen(n.r.shop)) { bubble('n', polite(n, 'ขอโทษครับ/ค่ะ ตอนนี้ร้านปิดแล้ว เปิดอีกที ' + W.hoursTxt(n.r.shop))); return; }
    var l = document.getElementById('wll'); if (!l) return;
    var d = document.createElement('div'); d.className = 'wlmenu';
    d.innerHTML = M.map(function (m, i) { return '<button data-l="item" data-i="' + i + '"><span>' + m[2] + '</span>' + E(m[0]) + '<b>฿' + m[1] + '</b></button>'; }).join('');
    l.appendChild(d); l.scrollTop = l.scrollHeight;
  }
  var cartSel = null;
  function chooseItem(i) {
    var n = cur, m = MENUS[n.r.shop][i]; cartSel = { m: m, size: 'M', sweet: '50%', temp: 'เย็น' };
    if (n.r.shop !== 'cafe' || /ครัวซองต์|บราวนี่|เค้ก|แซนด์วิช/.test(m[0])) return confirmOrder();
    var o = OPT.cafe, l = document.getElementById('wll'), d = document.createElement('div'); d.className = 'wlopt';
    d.innerHTML = '<div>' + m[2] + ' <b>' + E(m[0]) + '</b></div>' +
      '<div>ขนาด ' + o.size.map(function (s) { return '<button data-l="opt" data-k="size" data-v="' + s[0] + '"' + (s[0] === 'M' ? ' class="on"' : '') + '>' + s[0] + (s[1] ? ' +' + s[1] : '') + '</button>'; }).join('') + '</div>' +
      '<div>แบบ ' + o.temp.map(function (s) { return '<button data-l="opt" data-k="temp" data-v="' + s + '"' + (s === 'เย็น' ? ' class="on"' : '') + '>' + s + '</button>'; }).join('') + '</div>' +
      '<div>ความหวาน ' + o.sweet.map(function (s) { return '<button data-l="opt" data-k="sweet" data-v="' + s + '"' + (s === '50%' ? ' class="on"' : '') + '>' + s + '</button>'; }).join('') + '</div>' +
      '<button class="wlok" data-l="confirm">ยืนยันสั่ง</button>';
    l.appendChild(d); l.scrollTop = l.scrollHeight;
  }
  function confirmOrder() {
    var n = cur, c = cartSel; if (!c) return;
    var extra = n.r.shop === 'cafe' ? ({ S: 0, M: 10, L: 20 }[c.size] || 0) : 0, price = c.m[1] + extra;
    if (W.onBuy && W.onBuy({ name: c.m[0], ic: c.m[2], price: price }) === false) { bubble('n', polite(n, 'เงินในกระเป๋าไม่พอนะครับ/คะ ลองไปหางานทำที่บริษัทจัดหางานดูไหม')); cartSel = null; return; }
    var desc = c.m[0] + (n.r.shop === 'cafe' && extra >= 0 && !/ครัวซองต์|บราวนี่|เค้ก|แซนด์วิช/.test(c.m[0]) ? ' ' + c.temp + ' ' + c.size + ' หวาน ' + c.sweet : '');
    bubble('u', 'ขอ ' + desc);
    bubble('n', polite(n, 'รับ' + desc + ' ทั้งหมด ฿' + price + ' ครับ/ค่ะ รอสักครู่นะ'));
    var l = document.getElementById('wll'), bar = document.createElement('div'); bar.className = 'wlbar'; bar.innerHTML = '<i></i><span>กำลังทำ…</span>'; l.appendChild(bar); l.scrollTop = l.scrollHeight;
    setTimeout(function () { bar.querySelector('i').style.width = '100%'; }, 30);
    setTimeout(function () {
      bar.remove();
      bubble('n', polite(n, pick(['ได้แล้ว', 'เสร็จแล้ว', 'มาแล้ว']) + c.m[2] + ' ' + c.m[0] + ' ' + pick(['ร้อนๆ เลย', 'ทำสุดฝีมือ', 'อร่อยแน่นอน', 'ขอบคุณที่อุดหนุน']) + 'ครับ/ค่ะ'));
      ORD.unshift({ t: Date.now(), who: n.name, at: n.r.place, item: desc, price: price }); ORD = ORD.slice(0, 50);
      try { localStorage.setItem('ss_orders', JSON.stringify(ORD)); } catch (e) {}
      say('🧾 ได้รับ ' + c.m[2] + ' ' + c.m[0] + ' · ฿' + price);
    }, 2600);
    cartSel = null;
  }
  function onClick(e) {
    var t = e.target.closest('[data-l]'); if (!t) return;
    var a = t.dataset.l;
    if (a === 'x') { pop.classList.remove('on'); cur = null; }
    else if (a === 'send') sendQ();
    else if (a === 'chip') { var tx = t.textContent; if (W.lifeChip && W.lifeChip(cur, tx)) return; if (/ดูเมนู/.test(tx)) { bubble('u', 'ขอดูเมนูหน่อย'); showMenu(cur); } else if (/ลิฟต์/.test(tx)) { if (cur.extra.rent) enter(cur.extra.rent); } else sendQ(tx); }
    else if (a === 'item') chooseItem(+t.dataset.i);
    else if (a === 'opt') { cartSel[t.dataset.k] = t.dataset.v; t.parentNode.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === t); }); }
    else if (a === 'confirm') { t.parentNode.querySelectorAll('button').forEach(function (b) { b.disabled = true; }); confirmOrder(); }
    else if (a === 'floor') floor(t.dataset.p, +t.dataset.f);
    else if (a === 'lobby') enter(t.dataset.p);
    else if (a === 'room') roomInfo(t.dataset.p, t.dataset.u);
  }

  /* ================= 4) เข้าตึก + ลิฟต์ ================= */
  function floorsOf(pid) {
    var X = window.SSRent; if (!X || !X.R.loaded) return null;
    var units = X.R.units.filter(function (u) { return u.property_id === pid; }), F = {};
    units.forEach(function (u, i) { var m = String(u.name).match(/(\d)(\d{2})\b/), f = m ? +m[1] : Math.floor(i / 4) + 1; (F[f] = F[f] || []).push(u); });
    return F;
  }
  function enter(pid) {
    var X = window.SSRent, F = floorsOf(pid), p = (W.rentPlaced || []).find(function (q) { return q.id === pid; }); if (!F || !p) return;
    ensurePop(); cur = null;
    var keys = Object.keys(F).map(Number).sort(function (a, b) { return b - a; });
    pop.innerHTML = '<div class="wlh"><span class="wla">🛗</span><div><b>ลิฟต์ · ' + E(p.name) + '</b><small>อาคาร #' + p.n + ' · ประตูอัตโนมัติเปิดแล้ว ยินดีต้อนรับค่ะ</small></div><button data-l="x">✕</button></div>' +
      '<div class="wlift">' + keys.map(function (f) {
        var us = F[f], v = us.filter(function (u) { return u.status === 'vacant'; }).length;
        return '<button data-l="floor" data-p="' + pid + '" data-f="' + f + '"><b>' + f + '</b><small>' + us.length + ' ห้อง' + (v ? ' · ว่าง ' + v : '') + '</small></button>';
      }).join('') + '<button disabled><b>G</b><small>ล็อบบี้ (คุณอยู่ที่นี่)</small></button></div>';
    pop.classList.add('on');
  }
  function floor(pid, f) {
    var lift = pop.querySelector('.wlift'); if (lift) lift.innerHTML = '<div class="wlgo">🛗 กำลังขึ้นชั้น ' + f + '…<i></i></div>';
    setTimeout(function () {
      var X = window.SSRent, F = floorsOf(pid), us = (F && F[f]) || [], td = X.today();
      var rooms = us.map(function (u) {
        var l = X.R.leases.find(function (q) { return q.unit_id === u.id && q.status === 'active'; }), over = 0;
        if (l) X.rowsOf(l.id).forEach(function (r) { if (r._left > 0 && X.eff(r) < td) over++; });
        var c = over ? 'r' : u.status === 'occupied' ? 'g' : u.status === 'maintenance' ? 'k' : 'a';
        return '<button class="wlrm ' + c + '" data-l="room" data-p="' + pid + '" data-u="' + u.id + '"><b>' + E(u.name) + '</b><small>' + (over ? 'ค้าง ' + over + ' งวด' : u.status === 'occupied' ? (l && l.tenants ? E(l.tenants.name) : 'มีผู้เช่า') : u.status === 'maintenance' ? 'ซ่อมบำรุง' : 'ห้องว่าง') + '</small></button>';
      }).join('');
      pop.innerHTML = '<div class="wlh"><span class="wla">🚪</span><div><b>ชั้น ' + f + '</b><small>เดินตามทางเดิน แตะห้องเพื่อดูข้อมูล · 🟢 มีผู้เช่า 🟡 ว่าง 🔴 ค้างจ่าย</small></div><button data-l="x">✕</button></div>' +
        '<div class="wlhall">' + (rooms || '<small>ไม่มีห้องในชั้นนี้</small>') + '</div><div id="wlroom"></div>' +
        '<div class="wli"><button class="wlok" data-l="lobby" data-p="' + pid + '">🛗 กลับเข้าลิฟต์</button><button class="wlok" data-l="x" style="background:#64748b">🚶 ออกจากตึก</button></div>';
    }, 1100);
  }
  function roomInfo(pid, uid) {
    var X = window.SSRent, u = X.unit(uid), box = document.getElementById('wlroom'); if (!u || !box) return;
    var l = X.R.leases.find(function (q) { return q.unit_id === uid && q.status === 'active'; }), html = '<b>' + E(u.name) + '</b> · ';
    if (!l) html += u.status === 'maintenance' ? 'กำลังซ่อมบำรุง' : 'ห้องว่าง พร้อมให้เช่า';
    else {
      var c = X.cur(l), td = X.today();
      html += 'ผู้เช่า ' + E(l.tenants ? l.tenants.name : '-') + '<br>';
      if (c.row) { var d = X.eff(c.row), late = d < td; html += (late ? '🔴 ค้างจ่าย ' : '📅 งวดถัดไป ') + 'งวด ' + c.n + '/' + c.total + ' · ' + X.fd(d) + ' · ฿' + Number(c.pay).toLocaleString('th-TH'); }
      else html += '✅ จ่ายครบทุกงวดแล้ว';
    }
    box.innerHTML = html; box.style.display = 'block';
  }
  W.enterBuilding = enter;

  /* ================= 3) เมืองเปลี่ยนเองทุกวัน ================= */
  function cone(x, z) {
    var c = new T.Mesh(new T.ConeGeometry(.28, .8, 8), new T.MeshLambertMaterial({ color: 0xff6b1a })); c.position.set(x, .4, z); G.add(c);
    var s = new T.Mesh(new T.CylinderGeometry(.18, .2, .12, 8), new T.MeshLambertMaterial({ color: 0xffffff })); s.position.set(x, .5, z); G.add(s);
  }
  function signPost(txt, x, z, bg) {
    var c = document.createElement('canvas'); c.width = 256; c.height = 96; var g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 256, 96); g.fillStyle = '#111'; g.font = 'bold 30px "Noto Sans Thai",system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 128, 50, 240);
    var m = new T.Mesh(new T.PlaneGeometry(2.6, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), side: T.DoubleSide })); m.position.set(x, 1.8, z); G.add(m);
    var p = new T.Mesh(new T.BoxGeometry(.1, 1.3, .1), new T.MeshLambertMaterial({ color: 0x475569 })); p.position.set(x, .65, z); G.add(p);
  }
  function crane(x, z) {
    var y = new T.MeshLambertMaterial({ color: 0xf4c430 });
    var m = new T.Mesh(new T.BoxGeometry(1.2, 34, 1.2), y); m.position.set(x, 17, z); G.add(m);
    var j = new T.Mesh(new T.BoxGeometry(26, .9, .9), y); j.position.set(x + 8, 33.5, z); G.add(j);
    var cw = new T.Mesh(new T.BoxGeometry(3, 2, 1.6), new T.MeshLambertMaterial({ color: 0x64748b })); cw.position.set(x - 4, 32.5, z); G.add(cw);
    var cb = new T.Mesh(new T.BoxGeometry(.05, 14, .05), new T.MeshBasicMaterial({ color: 0x222222 })); cb.position.set(x + 16, 26, z); G.add(cb);
    return j;
  }
  function frame(x, z, fl) {
    var c = new T.MeshLambertMaterial({ color: 0xb8bfc8 }), s = new T.MeshLambertMaterial({ color: 0x7c8794 });
    for (var i = 0; i <= fl; i++) { var sl = new T.Mesh(new T.BoxGeometry(20, .35, 14), c); sl.position.set(x, i * 3.4 + .2, z); G.add(sl); }
    [[-10, -7], [10, -7], [-10, 7], [10, 7], [0, -7], [0, 7]].forEach(function (a) { var col = new T.Mesh(new T.BoxGeometry(.5, fl * 3.4, .5), s); col.position.set(x + a[0], fl * 1.7, z + a[1]); G.add(col); });
    var fence = new T.MeshLambertMaterial({ color: 0x2e7d32 });
    [[0, 11, 28, .2], [0, -11, 28, .2], [14, 0, .2, 22], [-14, 0, .2, 22]].forEach(function (f) { var m = new T.Mesh(new T.BoxGeometry(f[2], 2.2, f[3]), fence); m.position.set(x + f[0], 1.1, z + f[1]); G.add(m); });
    if (W.cityCol) W.cityCol(x, z, 28, 22);
  }
  function events() {
    var d = bkk(), key = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(), rnd = mul(key);
    var SP = [-346, -276, -206, -136, -66, 0, 66, 136, 206, 346];
    // ซ่อมถนน 3 จุด
    for (var i = 0; i < 3; i++) {
      var a = Math.floor(rnd() * SP.length), b = Math.floor(rnd() * (SP.length - 1)), horiz = rnd() < .5;
      var lineC = SP[a], s0 = SP[b] + 12, len = 18;
      var x0 = horiz ? s0 : lineC + 2.5, z0 = horiz ? lineC + 2.5 : s0;
      for (var k = 0; k <= 6; k++) cone(horiz ? x0 + k * len / 6 : x0, horiz ? z0 : z0 + k * len / 6);
      var bx = horiz ? x0 + len / 2 : x0 + 1.4, bz = horiz ? z0 + 1.4 : z0 + len / 2;
      var bar = new T.Mesh(new T.BoxGeometry(horiz ? len : .3, .9, horiz ? .3 : len), new T.MeshLambertMaterial({ color: 0xfacc15 })); bar.position.set(bx, .45, bz); G.add(bar);
      signPost('🚧 ซ่อมถนน', horiz ? x0 - 2 : x0 + 3, horiz ? z0 + 3 : z0 - 2, '#facc15');
      var w = addNPC('worker', horiz ? x0 + len / 2 : x0 + 3, horiz ? z0 + 4 : z0 + len / 2);
      EVENTS.push({ t: 'road', x: bx, z: bz, msg: '🚧 ข้างหน้ากำลังซ่อมถนน ช่วงนี้ขับ/เดินช้าๆ นะ (คาดว่าเสร็จใน ' + (1 + Math.floor(rnd() * 5)) + ' วัน)' });
    }
    // ไซต์ก่อสร้างบนแปลงที่ยังว่าง
    var used = (W.rentPlaced || []).length, lots = (W.RENT_LOTS || []).slice(used);
    lots.filter(function () { return rnd() < .35; }).slice(0, 2).forEach(function (lot) {
      var cx = (lot.x0 + lot.x1) / 2, cz = (lot.z0 + lot.z1) / 2, fl = 2 + Math.floor(rnd() * 6);
      frame(cx, cz, fl); crane(cx - 9, cz - 5);
      signPost('🏗️ กำลังก่อสร้าง', cx, cz + 12.5, '#fde68a');
      addNPC('worker', cx + 6, cz + 13);
      EVENTS.push({ t: 'build', x: cx, z: cz, msg: '🏗️ ใกล้ไซต์ก่อสร้าง ตึกใหม่ ' + fl + ' ชั้น คาดว่าเสร็จอีก ' + (2 + Math.floor(rnd() * 10)) + ' เดือน' });
    });
  }

  /* ---------- สร้างทั้งหมด ---------- */
  function clear() {
    if (G) { G.traverse(function (o) { if (o.isMesh || o.isPoints) { o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); if (G.parent) G.parent.remove(G); }
    if (W.EX && W.EX.pick) W.EX.pick = W.EX.pick.filter(function (o) { return !(o.userData && o.userData.lifeNpc); });
    NPCS.forEach(function (n) { if (n.tag) { if (n.tag.parentNode) n.tag.parentNode.removeChild(n.tag); if (W.tags) { var i = W.tags.findIndex(function (q) { return q.el === n.tag; }); if (i >= 0) W.tags.splice(i, 1); } } });
    NPCS = []; EVENTS = []; LAMPS = null; G = null;
  }
  var skyVer = -1;
  function build() {
    clear();
    if (skyVer !== W.cityVer && W.EXS.background && W.EXS.background.isColor) { daySky = W.EXS.background.clone(); skyVer = W.cityVer; }
    G = new T.Group(); G.name = 'life'; W.EXS.add(G);
    streetLamps();
    // NPC ตามสถานที่
    (W.POI || []).forEach(function (q) {
      var roles = POI_ROLE[q.t]; if (!roles) return;
      roles.forEach(function (r, i) { var dz = q.door ? q.door.z + 2 : q.z + 24; addNPC(r, (q.door ? q.door.x : q.x) + (i ? -4 : 4), dz, 0); });
    });
    // ร้านกาแฟ / รถเข็นอาหาร / แผงผลไม้ ริมถนนรอบร้าน
    [[40, 76, 'cafe'], [-76, 40, 'food'], [76, -40, 'cafe'], [-40, -76, 'fruit'], [150, 76, 'food'], [-150, -76, 'cafe'], [222, 150, 'cafe'], [-222, 150, 'food']].forEach(function (s) {
      var sp = freeSpot(s[0], s[1]); if (!sp) return;
      kiosk(s[2], sp[0], sp[1]);
      addNPC(s[2] === 'cafe' ? 'barista' : s[2] === 'food' ? 'vendor' : 'market', sp[0], sp[1] - 1.6, Math.PI);
    });
    // นิติบุคคล + รปภ. หน้าตึกเช่าทุกหลัง
    (W.rentPlaced || []).forEach(function (p) { addNPC('manager', p.dx + 3, p.dz + 1, 0, { rent: p.id }); addNPC('guard', p.dx - 3, p.dz + 1, 0, { rent: p.id }); });
    events();
    built = W.cityVer; dayKey = bkk().toDateString(); told = {};
    applyDay();
  }

  /* ---------- เดินใกล้ → แจ้งเตือน / ปุ่มคุย ---------- */
  function here() {
    if (!W.V) return null;
    if (W.V.cam && W.V.cam !== 'orbit' && W.pc) return { x: W.pc.position.x, z: W.pc.position.z, walk: true };
    if ((W.V.zoom || 1) > 1.3) return { x: W.V.tx, z: W.V.tz, walk: false };
    return null;
  }
  function proximity() {
    var p = here(); if (!p) { if (prompt) prompt.style.display = 'none'; return; }
    EVENTS.forEach(function (e, i) { var k = 'e' + i; if (!told[k] && Math.hypot(e.x - p.x, e.z - p.z) < 40) { told[k] = 1; say(e.msg); } });
    (W.rentPlaced || []).forEach(function (r) {
      var k = 'r' + r.id; if (told[k] || Math.hypot(r.x - p.x, r.z - p.z) > 45) return; told[k] = 1;
      say('🏢 ใกล้' + r.name + ' (อาคาร #' + r.n + ') · ' + (r.over ? 'ค้างจ่าย ' + r.over + ' ห้อง' : r.vac ? 'ว่าง ' + r.vac + ' ห้อง' : 'ห้องเต็ม'));
    });
    // ปุ่มลัดตอนเดิน
    if (!prompt) {
      prompt = document.createElement('button'); prompt.id = 'wlprompt';
      (document.getElementById('wd') || document.body).appendChild(prompt);
      prompt.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      prompt.onclick = function () { var a = prompt.dataset; if (a.n) talk(NPCS[+a.n]); else if (a.r) enter(a.r); };
    }
    var best = null, bd = 1e9;
    if (p.walk) {
      NPCS.forEach(function (n) { var d = Math.hypot(n.x - p.x, n.z - p.z); if (d < 5 && d < bd) { bd = d; best = { n: n }; } });
      (W.rentPlaced || []).forEach(function (r) { var d = Math.hypot(r.dx - p.x, r.dz - p.z); if (d < 4.5 && d < bd) { bd = d; best = { r: r }; } });
    }
    if (best && !(pop && pop.classList.contains('on'))) {
      prompt.style.display = 'block';
      if (best.n) { prompt.dataset.n = best.n.id; delete prompt.dataset.r; prompt.textContent = '💬 คุยกับ' + best.n.r.t + ' ' + best.n.name; }
      else { prompt.dataset.r = best.r.id; delete prompt.dataset.n; prompt.textContent = '🚪 ประตูเปิดแล้ว · เข้าตึก ' + best.r.name; }
    } else prompt.style.display = 'none';
    // ป้ายชื่อ NPC เฉพาะที่อยู่ใกล้
    var c = W.pc && W.pc.position;
    NPCS.forEach(function (n) { if (n.tag) n.tag.style.opacity = c && Math.hypot(n.x - c.x, n.z - c.z) < (p.walk ? 30 : 140) ? 1 : 0; });
  }

  /* ---------- UI ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '#wday{position:absolute;left:10px;top:70px;z-index:6;padding:7px 12px;border-radius:14px;background:var(--g2,rgba(255,255,255,.92));color:var(--text,#0f172a);font-size:.85rem;box-shadow:0 4px 14px rgba(15,23,42,.15)}#wday small{color:var(--mut,#64748b)}',
    '.wtag.wnpc{font-size:.72rem;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.88);color:#0f172a;white-space:nowrap;transition:opacity .3s}',
    '#wlprompt{position:absolute;left:50%;transform:translateX(-50%);bottom:150px;z-index:7;display:none;padding:12px 20px;border-radius:16px;border:0;font-weight:700;font-size:1rem;color:#fff;background:linear-gradient(135deg,#2563eb,#7c3aed);box-shadow:0 6px 20px rgba(37,99,235,.4)}',
    '#wlife{position:absolute;left:10px;top:70px;bottom:90px;width:min(380px,calc(100% - 20px));z-index:9;display:none;flex-direction:column;gap:8px;padding:12px;border-radius:20px;background:var(--g2,rgba(255,255,255,.97));color:var(--text,#0f172a);box-shadow:0 10px 30px rgba(15,23,42,.25);font-size:.95rem}',
    '#wlife.on{display:flex}#wlife .wlh{display:flex;gap:10px;align-items:center}#wlife .wlh>div{flex:1}#wlife .wlh b{display:block;font-size:1.1rem}#wlife .wlh small{color:var(--mut,#64748b)}',
    '#wlife .wla{width:44px;height:44px;border-radius:14px;background:var(--in,#f1f5f9);display:grid;place-items:center;font-size:1.5rem}#wlife .wlh button{width:40px;height:40px;border-radius:12px}',
    '#wlife .wlhall,#wlife .wll{min-height:0}#wlife .wll{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:4px}',
    '#wlife .wlm{max-width:85%;white-space:normal;overflow-wrap:anywhere;padding:8px 12px;border-radius:14px;line-height:1.45;background:var(--in,#f1f5f9)}#wlife .wlm.u{align-self:flex-end;background:#2563eb;color:#fff}',
    '#wlife .wlc{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}#wlife .wlc button{flex:0 0 auto;padding:7px 11px;border-radius:12px;border:1px solid var(--line,#cbd5e1);font-size:.85rem}',
    '#wlife .wli{display:flex;gap:6px}#wlife .wli input{flex:1;min-width:0;font-size:16px;padding:10px 12px;border-radius:12px;border:1px solid var(--line,#cbd5e1);background:var(--card,#fff);color:inherit}#wlife .wli button{padding:0 14px;border-radius:12px;border:0;color:#fff;background:#2563eb;font-weight:700}',
    '#wlife .wlmenu{display:grid;grid-template-columns:1fr 1fr;gap:6px}#wlife .wlmenu button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px;border-radius:12px;border:1px solid var(--line,#cbd5e1);font-size:.85rem}#wlife .wlmenu span{font-size:1.5rem}',
    '#wlife .wlopt{display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:14px;background:var(--in,#f1f5f9)}#wlife .wlopt button{margin:2px;padding:6px 10px;border-radius:10px;border:1px solid var(--line,#cbd5e1)}#wlife .wlopt button.on{background:#2563eb;color:#fff;border-color:#2563eb}',
    '#wlife .wlok{flex:1;min-height:46px;padding:11px;border-radius:12px;border:0;color:#fff;font-weight:700;background:linear-gradient(135deg,#2563eb,#7c3aed)}',
    '#wlife .wlbar{position:relative;height:30px;border-radius:12px;background:var(--in,#f1f5f9);overflow:hidden}#wlife .wlbar i{position:absolute;inset:0 auto 0 0;width:0;background:#86efac;transition:width 2.5s linear}#wlife .wlbar span{position:relative;display:block;text-align:center;line-height:30px;font-size:.85rem}',
    '#wlife .wlift{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;overflow-y:auto}#wlife .wlift button{padding:12px 4px;border-radius:16px;border:2px solid var(--line,#cbd5e1);background:var(--card,#fff)}#wlife .wlift b{display:block;font-size:1.5rem}#wlife .wlift small{font-size:.75rem;color:var(--mut,#64748b)}',
    '#wlife .wlgo{grid-column:1/-1;text-align:center;padding:30px 0;font-size:1.1rem;font-weight:700}#wlife .wlgo i{display:block;height:6px;margin:14px auto 0;width:60%;border-radius:6px;background:linear-gradient(90deg,#2563eb,#7c3aed);animation:wlup 1.1s linear}@keyframes wlup{from{width:0}}',
    '#wlife .wlhall{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;overflow-y:auto;padding:8px;border-radius:14px;background:repeating-linear-gradient(90deg,var(--in,#f1f5f9) 0 24px,transparent 24px 48px)}',
    '#wlife .wlrm{padding:10px;border-radius:12px;border:0;color:#fff;text-align:left}#wlife .wlrm b{display:block;color:#fff}#wlife .wlrm small{color:#fff;opacity:.95}#wlife .wlrm.g{background:#16a34a}#wlife .wlrm.a{background:#d97706}#wlife .wlrm.r{background:#dc2626}#wlife .wlrm.k{background:#64748b}',
    '#wlroom{display:none;padding:10px 12px;border-radius:14px;background:var(--in,#f1f5f9);line-height:1.6}',
    '@media(max-width:700px){#wlife{top:auto;bottom:80px;max-height:66%;left:8px;right:8px;width:auto}#wday{top:auto;bottom:150px}}'
  ].join('');
  document.head.appendChild(css);
  function dayBtn() {
    if (document.getElementById('wday')) return;
    var wd = document.getElementById('wd'); if (!wd) return;
    var b = document.createElement('button'); b.id = 'wday'; wd.appendChild(b);
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    b.onclick = function () { MODE = MODE === 'auto' ? 'night' : MODE === 'night' ? 'day' : 'auto'; try { localStorage.setItem('ss_daymode', MODE); } catch (e) {} applyDay(); say(MODE === 'auto' ? '🕐 กลางวัน/กลางคืนตามเวลาจริง' : MODE === 'night' ? '🌙 โหมดกลางคืน' : '🌞 โหมดกลางวัน'); };
  }

  /* ---------- วนทำงาน ---------- */
  var hooked = false, last = performance.now();
  function hook() {
    if (hooked || typeof W.select !== 'function') return;
    var orig = W.select;
    W.select = function (k) { if (typeof k === 'string' && k.indexOf('npc:') === 0) { var n = NPCS[+k.slice(4)]; if (n) talk(n); return; } return orig.apply(this, arguments); };
    hooked = true;
  }
  function anim(now) {
    requestAnimationFrame(anim);
    var dt = Math.min(.05, (now - last) / 1000); last = now; if (!G || document.hidden) return;
    var t = now / 1000;
    NPCS.forEach(function (n) {
      var P = n.g.userData.parts; P.body.position.y = 1.25 + Math.sin(t * 2 + n.ph) * .02;
      var talking = cur === n; P.a2.rotation.x = talking ? Math.sin(t * 6) * .5 - .4 : Math.sin(t * 1.3 + n.ph) * .08;
      P.head.rotation.y = Math.sin(t * .7 + n.ph) * .4;
      if (n.role === 'worker') P.a1.rotation.x = Math.sin(t * 4 + n.ph) * .7;
    });
  }
  requestAnimationFrame(anim);
  setInterval(function () {
    T = window.THREE; hook(); dayBtn();
    if (!T || !W.EXS || !W.RENT_LOTS || !W.POI) return;
    var rp = (W.rentPlaced || []).map(function (p) { return p.id; }).join();
    if (built !== W.cityVer || dayKey !== bkk().toDateString() || rp !== build.rp) { build.rp = rp; lights = null; build(); }
    applyDay(); proximity();
  }, 1000);
  W.lifeTalk = function (i) { if (NPCS[i]) talk(NPCS[i]); };
  W.lifeNPCs = function () { return NPCS; };
  W.lifeAnswer = function (n, q) { return answer(n, q); };
  W.lifeBubble = function (who, t) { bubble(who, t); };
  W.lifeClose = function () { if (pop) pop.classList.remove('on'); cur = null; };
})();
