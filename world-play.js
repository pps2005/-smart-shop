/* ============================================================
   world-play.js — ใช้ชีวิตในเมือง (สไตล์ The Sims + FiveM + Google Maps)
   - HUD: เงิน · เวลาเมือง · ความต้องการ (หิว/พลังงาน/สนุก/สังคม) · มินิแมพ
   - ปุ่มใหญ่สำหรับ iPad/มือถือ: กระโดด เต้น โบกมือ ไหว้ กิน พูด แผนที่ เรียกรถ งาน ซ่อน UI
   - แผนที่เต็มจอ ค้นหาสถานที่ · นำทาง · แท็กซี่ · BTS/MRT
   - เวลาเปิด-ปิดตามเวลาท้องถิ่นของเมือง · ร้านปิดเข้าไม่ได้
   - เข้าร้าน/สถานที่ (ร้านสะดวกซื้อ โรงแรม ห้าง สวนสนุก รพ. ฯลฯ) · ทำกิจกรรมได้
   - บริษัทจัดหางาน → ฝึกงานกับ NPC พี่เลี้ยง → ทำกะได้เงิน · ไรเดอร์ส่งอาหารขี่มอเตอร์ไซค์
   ลำดับโหลด: หลัง world-life.js
   ============================================================ */
(function () {
  'use strict';
  var W = window.SSW = window.SSW || {};
  var KEY = 'ss_play';
  var ST = { money: 500, needs: { food: 80, energy: 80, fun: 60, social: 60 }, inv: [], jobs: {}, xp: 0, name: 'ฉัน', last: Date.now(), ui: true };
  try { var sv = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sv) ST = Object.assign(ST, sv, { needs: Object.assign(ST.needs, sv.needs || {}) }); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) {} }
  function $(id) { return document.getElementById(id); }
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function F(n) { return Math.round(n).toLocaleString('th-TH'); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function say(t) { if (typeof toast === 'function') toast(t); }
  function now() { return W.cityNow ? W.cityNow() : new Date(); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function me() { var i = W.camInfo && W.camInfo(); if (!i) return null; return { x: i.x, z: i.z, walk: i.cam === 'walk' && i.mode === 'ext', yaw: i.yaw }; }

  /* ================= เวลาเปิด-ปิด (ตามเวลาท้องถิ่นของเมือง) ================= */
  // [เปิด, ปิด] ชั่วโมง · we = วันหยุด · off = วันที่ปิด (0=อาทิตย์)
  var HOURS = {
    conv: { d: [0, 24] }, hotel: { d: [0, 24] }, hosp: { d: [0, 24] },
    cafe: { d: [7, 19] }, food: { d: [6, 21] }, fruit: { d: [5, 13] }, market: { d: [4, 13] },
    mall: { d: [10, 22], tyo: [10, 21], sel: [10.5, 22] }, park2: { d: [10, 19], we: [9, 20] },
    agency: { d: [9, 17], we: [9, 12], off: [0] }, school: { d: [7.5, 16.5], off: [0, 6] }, temple: { d: [8, 17] },
    stadium: { d: [9, 21] }, park: { d: [5, 21] }, landmark: { d: [9, 20] },
    station: { d: [5.25, 24.75], tyo: [5, 24.5], sel: [5.5, 24.5], sha: [5.5, 23] }, metro: { d: [6, 24], tyo: [5, 24.5], sel: [5.5, 24.5], sha: [5.5, 23] },
  };
  function span(t) {
    var h = HOURS[t]; if (!h) return null;
    var d = now(), day = d.getDay(), city = W.cityId ? W.cityId() : 'bkk';
    if (h.off && h.off.indexOf(day) >= 0) return { closed: true };
    return { r: ((day === 0 || day === 6) && h.we) || h[city] || h.d };
  }
  W.isOpen = function (t) {
    var s = span(t); if (!s) return true; if (s.closed) return false;
    var d = now(), x = d.getHours() + d.getMinutes() / 60, r = s.r;
    if (r[1] > 24) return x >= r[0] || x < r[1] - 24;
    return x >= r[0] && x < r[1];
  };
  function hh(v) { v = v % 24; var h = Math.floor(v), m = Math.round((v - h) * 60); return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2); }
  W.hoursTxt = function (t) { var s = span(t); if (!s) return 'ทุกวัน'; if (s.closed) return 'วันนี้ปิดทำการ'; return s.r[0] === 0 && s.r[1] === 24 ? 'เปิด 24 ชม.' : hh(s.r[0]) + '–' + hh(s.r[1]) + ' น.'; };

  /* ================= เงิน / ของ / ความต้องการ ================= */
  var FOOD_VAL = { '🍱': 45, '🥪': 30, '🥟': 20, '🌭': 20, '🍙': 22, '🥛': 10, '💧': 6, '🥫': 8, '🍟': 12, '🍦': 12, '☕': 8, '🍫': 10, '🧋': 12, '🍵': 8, '🍋': 8, '🥐': 22, '🍰': 18, '🍗': 45, '🍳': 45, '🍜': 42, '🍤': 45, '🥗': 30, '🍢': 32, '🥭': 15, '🍊': 12, '🍌': 15, '🍉': 15, '🍍': 15, '🥬': 8 };
  W.onBuy = function (it) {
    if (ST.money < it.price) return false;
    ST.money -= it.price; ST.inv.push({ n: it.name, ic: it.ic }); ST.inv = ST.inv.slice(-20); save(); hud(); return true;
  };
  function addMoney(v, why) { ST.money += v; save(); hud(); say((v >= 0 ? '💰 +฿' : '💸 -฿') + F(Math.abs(v)) + (why ? ' · ' + why : '')); }
  function need(k, v) { ST.needs[k] = clamp(ST.needs[k] + v, 0, 100); }
  function decay() {
    var dt = Math.min(3600, (Date.now() - ST.last) / 1000); ST.last = Date.now();
    need('food', -dt / 40); need('energy', -dt / 70); need('fun', -dt / 55); need('social', -dt / 60);
  }

  /* ================= ท่าทาง (ตัวละครของเรา) ================= */
  var ACT = null;
  function act(name, dur) { ACT = { n: name, t0: performance.now() / 1000, d: dur || 3 }; }
  W.actPose = function (c, t) {
    if (!ACT) return false;
    var k = t - ACT.t0; if (k > ACT.d || k < 0) { ACT = null; return false; }
    var U = c.userData, n = ACT.n;
    U.A[0].rotation.set(0, 0, 0); U.A[1].rotation.set(0, 0, 0); U.L[0].rotation.set(0, 0, 0); U.L[1].rotation.set(0, 0, 0); U.head.rotation.set(0, 0, 0);
    if (n === 'dance') { var s = Math.sin(t * 8); U.A[0].rotation.z = -2.2 + s * .5; U.A[1].rotation.z = 2.2 + s * .5; U.L[0].rotation.x = s * .5; U.L[1].rotation.x = -s * .5; U.head.rotation.z = s * .2; c.rotation.y += Math.sin(t * 2) * .3; c.position.y += Math.abs(s) * .08; }
    else if (n === 'wave') { U.A[1].rotation.z = 2.6 + Math.sin(t * 9) * .35; }
    else if (n === 'wai') { U.A[0].rotation.x = -1.9; U.A[1].rotation.x = -1.9; U.A[0].rotation.z = -.45; U.A[1].rotation.z = .45; U.head.rotation.x = Math.min(.35, k * .8); }
    else if (n === 'eat') { U.A[1].rotation.x = -2.3 + Math.sin(t * 6) * .25; U.head.rotation.x = .1 + Math.sin(t * 6) * .05; }
    else if (n === 'talk') { U.A[0].rotation.x = -.5 + Math.sin(t * 5) * .3; U.head.rotation.z = Math.sin(t * 4) * .08; }
    else if (n === 'cheer') { U.A[0].rotation.z = -2.8; U.A[1].rotation.z = 2.8; c.position.y += Math.abs(Math.sin(t * 7)) * .12; }
    return true;
  };
  var bubbleEl = null;
  function speak(txt) {
    if (!W.PLE || !W.tagAdd) return;
    if (!bubbleEl) { bubbleEl = document.createElement('div'); bubbleEl.className = 'wtag wpbub'; $('wd').appendChild(bubbleEl); W.tagAdd(bubbleEl, W.PLE, 2.2, 'ext'); }
    bubbleEl.textContent = txt; bubbleEl.style.opacity = 1; clearTimeout(bubbleEl._t); bubbleEl._t = setTimeout(function () { bubbleEl.style.opacity = 0; }, 4500);
    act('talk', 2.5); need('social', 4);
    var p = me(), L = W.lifeNPCs ? W.lifeNPCs() : [];
    if (!p) return;
    var n = L.filter(function (q) { return Math.hypot(q.x - p.x, q.z - p.z) < 8; }).sort(function (a, b) { return Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z); })[0];
    if (n && W.lifeAnswer) setTimeout(function () { var a = W.lifeAnswer(n, txt); if (n.tag) { var o = n.tag.textContent; n.tag.textContent = '💬 ' + a; n.tag.classList.add('talk'); setTimeout(function () { n.tag.textContent = o; n.tag.classList.remove('talk'); }, 5000); } need('social', 6); }, 700);
  }

  /* ================= UI ================= */
  var css = document.createElement('style');
  css.textContent = [
    '#wp{position:absolute;inset:0;pointer-events:none;z-index:6;font-family:inherit}#wp>*{pointer-events:auto}',
    '#wd #wday{left:auto;right:64px;top:calc(70px + env(safe-area-inset-top,0px))}body.ss-game #wphud{top:calc(70px + env(safe-area-inset-top,0px))}',
    '#wphud{position:absolute;left:10px;top:calc(126px + env(safe-area-inset-top,0px));width:206px;padding:10px;border-radius:18px;background:rgba(15,23,42,.78);color:#fff;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 6px 20px rgba(0,0,0,.25)}',
    '#wphud .wptop{display:flex;align-items:center;gap:8px}#wphud .gem{width:22px;height:30px;background:linear-gradient(160deg,#86efac,#16a34a);clip-path:polygon(50% 0,100% 40%,50% 100%,0 40%);filter:drop-shadow(0 0 6px #4ade80);animation:wpgem 3s ease-in-out infinite}@keyframes wpgem{50%{transform:translateY(-3px) rotateY(180deg)}}',
    '#wphud .money{font-size:1.15rem;font-weight:800;color:#86efac}#wphud .clk{margin-left:auto;font-size:.8rem;opacity:.85;text-align:right;line-height:1.2}',
    '#wpmini{display:block;width:186px;height:186px;margin:8px 0 6px;border-radius:50%;border:3px solid rgba(255,255,255,.85);background:#cfd8c7;cursor:pointer}',
    '#wphud .nd{display:grid;grid-template-columns:22px 1fr;gap:3px 6px;align-items:center;font-size:.8rem}#wphud .bar{height:9px;border-radius:9px;background:rgba(255,255,255,.18);overflow:hidden}#wphud .bar i{display:block;height:100%;border-radius:9px;transition:width .6s}',
    '#wphud .job{margin-top:6px;font-size:.78rem;opacity:.9}#wphud.mini .nd,#wphud.mini .job{display:none}#wphud .wptop{cursor:pointer}',
    '#wpnav{position:absolute;left:50%;top:calc(70px + env(safe-area-inset-top,0px));transform:translateX(-50%);padding:8px 14px;border-radius:14px;background:#1a73e8;color:#fff;font-weight:700;display:none;align-items:center;gap:10px;box-shadow:0 6px 18px rgba(26,115,232,.4)}#wpnav i{font-style:normal;font-size:1.4rem;display:inline-block;transition:transform .2s}#wpnav button{background:rgba(255,255,255,.2);color:#fff;border:0;border-radius:10px;padding:4px 8px}',
    '#wpact{position:absolute;right:68px;bottom:calc(90px + env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:repeat(2,58px);gap:8px}',
    '#wpact button{width:58px;height:58px;border-radius:50%;border:0;background:rgba(15,23,42,.72);color:#fff;font-size:1.45rem;display:grid;place-items:center;box-shadow:0 4px 12px rgba(0,0,0,.3);position:relative}#wpact button small{position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);font-size:.62rem;color:#0f172a;background:rgba(255,255,255,.85);padding:0 5px;border-radius:6px;white-space:nowrap}',
    '#wpact button.big{background:#16a34a}#wpact button:active{transform:scale(.92)}',
    '#wpdo{position:absolute;left:50%;bottom:calc(150px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:none;padding:13px 22px;border-radius:16px;border:0;font-weight:800;font-size:1.02rem;color:#fff;background:linear-gradient(135deg,#16a34a,#0d9488);box-shadow:0 6px 20px rgba(22,163,74,.45);white-space:nowrap}#wpdo.lock{background:#64748b}',
    '.wtag.wpbub{background:#fff;color:#0f172a;padding:6px 10px;border-radius:14px;font-size:.85rem;max-width:200px;white-space:normal;box-shadow:0 3px 10px rgba(0,0,0,.25);transition:opacity .4s}',
    '.wtag.wnpc.talk{max-width:220px;white-space:normal;background:#fff;font-size:.8rem;padding:5px 9px;border-radius:12px}',
    '#wpsheet{position:fixed;inset:0;z-index:2000;display:none;background:rgba(15,23,42,.45);align-items:flex-end;justify-content:center}#wpsheet.on{display:flex}',
    '#wpsheet>div{width:min(560px,100%);max-height:86%;overflow:auto;background:var(--g2,#fff);color:var(--text,#0f172a);border-radius:22px 22px 0 0;padding:14px 16px calc(16px + env(safe-area-inset-bottom,0px));box-shadow:0 -10px 30px rgba(0,0,0,.25)}',
    '#wpsheet h3{margin:0 0 8px;display:flex;align-items:center;gap:8px}#wpsheet h3 button{margin-left:auto;width:40px;height:40px;border-radius:12px}',
    '#wpsheet .scene{height:150px;border-radius:16px;margin-bottom:10px;position:relative;overflow:hidden;display:flex;align-items:flex-end;justify-content:space-around;padding:10px;font-size:2.2rem;box-shadow:inset 0 -30px 40px rgba(0,0,0,.08)}',
    '#wpsheet .scene b{position:absolute;left:12px;top:10px;font-size:.85rem;background:rgba(255,255,255,.88);padding:3px 9px;border-radius:9px;color:#0f172a}',
    '#wpsheet .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}#wpsheet .opt{display:flex;align-items:center;gap:10px;padding:12px;border-radius:14px;border:1px solid var(--line,#e2e8f0);background:var(--card,#fff);text-align:left;font-size:.95rem;width:100%}#wpsheet .opt span{font-size:1.6rem}#wpsheet .opt small{display:block;color:var(--mut,#64748b);font-size:.8rem}',
    '#wpsheet .opt:disabled{opacity:.45}#wpsheet .pri{width:100%;padding:13px;border-radius:14px;border:0;font-weight:800;color:#fff;background:linear-gradient(135deg,#16a34a,#0d9488);margin-top:8px;font-size:1rem}',
    '#wpsheet .lesson{padding:12px 14px;border-radius:14px;background:var(--in,#f1f5f9);line-height:1.6;margin-bottom:8px}#wpsheet .q{font-weight:700;margin:6px 0}#wpsheet .ok{color:#16a34a;font-weight:700}#wpsheet .ng{color:#dc2626;font-weight:700}',
    '#wpsheet input{width:100%;font-size:16px;padding:12px;border-radius:12px;border:1px solid var(--line,#cbd5e1);background:var(--card,#fff);color:inherit;margin-bottom:8px}',
    '#wpmap{position:fixed;inset:0;z-index:2001;display:none;background:#e8eaed}#wpmap.on{display:block}#wpmap canvas{width:100%;height:100%;display:block;touch-action:none}',
    '#wpmap .bar{position:absolute;left:10px;right:10px;top:calc(10px + env(safe-area-inset-top,0px));display:flex;gap:8px}#wpmap .bar input{flex:1;min-width:0;font-size:16px;padding:12px 16px;border-radius:24px;border:0;box-shadow:0 2px 8px rgba(0,0,0,.25)}#wpmap .bar button{width:46px;height:46px;border-radius:50%;border:0;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25);font-size:1.2rem}',
    '#wpmap .chips{position:absolute;left:10px;right:10px;top:calc(66px + env(safe-area-inset-top,0px));display:flex;gap:6px;overflow-x:auto}#wpmap .chips button{flex:0 0 auto;padding:7px 12px;border-radius:18px;border:0;background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.2);font-size:.85rem}#wpmap .chips button.on{background:#1a73e8;color:#fff}',
    '#wpmap .card{position:absolute;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));max-width:520px;margin:auto;background:#fff;color:#0f172a;border-radius:18px;padding:14px;box-shadow:0 4px 18px rgba(0,0,0,.25);display:none}#wpmap .card.on{display:block}',
    '#wpmap .card .row{display:flex;gap:8px;margin-top:10px}#wpmap .card .row button{flex:1;padding:11px 6px;border-radius:22px;border:1px solid #dadce0;background:#fff;font-weight:700;color:#1a73e8}#wpmap .card .row button.pri{background:#1a73e8;color:#fff;border-color:#1a73e8}',
    '#wpfade{position:fixed;inset:0;z-index:2002;background:#000;opacity:0;pointer-events:none;transition:opacity .45s;display:grid;place-items:center;color:#fff;font-size:1.2rem;font-weight:700}',
    'body.ss-game .wkpi,body.ss-game .wact,body.ss-game .wpan,body.ss-game .wtabs,body.ss-game .wleft,body.ss-game .wright,body.ss-game .wtag.wb{display:none!important}',
    '@media(max-width:700px){#wpact{right:62px}#wphud{width:150px;padding:8px}#wpmini{width:130px;height:130px}#wpact{grid-template-columns:repeat(2,52px);gap:7px}#wpact button{width:52px;height:52px;font-size:1.3rem}}'
  ].join('');
  document.head.appendChild(css);

  var ROOT = null;
  function buildUI() {
    var wd = $('wd'); if (!wd || $('wp')) return !!$('wp');
    ROOT = document.createElement('div'); ROOT.id = 'wp';
    ROOT.innerHTML =
      '<div id="wphud"><div class="wptop"><div class="gem"></div><div><div class="money" id="wpmoney"></div><small id="wpname"></small></div><div class="clk" id="wpclk"></div></div>' +
      '<canvas id="wpmini" width="300" height="300" title="แตะเพื่อเปิดแผนที่"></canvas>' +
      '<div class="nd"><span>🍔</span><div class="bar"><i id="wpn_food"></i></div><span>⚡</span><div class="bar"><i id="wpn_energy"></i></div><span>🎉</span><div class="bar"><i id="wpn_fun"></i></div><span>💬</span><div class="bar"><i id="wpn_social"></i></div></div>' +
      '<div class="job" id="wpjob"></div></div>' +
      '<div id="wpnav"><i id="wpnavarr">⬆</i><span id="wpnavtxt"></span><button data-p="navx">✕</button></div>' +
      '<div id="wpact">' +
      '<button data-p="jump" class="big">⤴<small>กระโดด</small></button><button data-p="dance">💃<small>เต้น</small></button>' +
      '<button data-p="wave">👋<small>ทักทาย</small></button><button data-p="wai">🙏<small>ไหว้</small></button>' +
      '<button data-p="eat">🍔<small>กิน</small></button><button data-p="talk">💬<small>พูด</small></button>' +
      '<button data-p="map">🗺️<small>แผนที่</small></button><button data-p="ride">🚕<small>เรียกรถ</small></button>' +
      '<button data-p="jobs">💼<small>งาน</small></button><button data-p="ui">👁<small>ซ่อน UI</small></button></div>' +
      '<button id="wpdo"></button>' +
      '<div id="wpsheet"><div id="wpsh"></div></div>' +
      '<div id="wpmap"><canvas id="wpmc"></canvas><div class="bar"><button data-p="mapx">←</button><input id="wpq" placeholder="ค้นหาที่นี่ เช่น โรงพยาบาล ร้านสะดวกซื้อ" autocomplete="off"><button data-p="mapme">◎</button></div><div class="chips" id="wpchips"></div><div class="card" id="wpcard"></div></div>' +
      '<div id="wpfade"></div>';
    wd.appendChild(ROOT);
    ['wpsheet', 'wpmap', 'wpfade'].forEach(function (id) { var el = $(id); document.body.appendChild(el); el.addEventListener('click', onClick); });
    ['pointerdown', 'wheel', 'touchstart'].forEach(function (ev) { ROOT.addEventListener(ev, function (e) { if (e.target.closest('#wphud,#wpact,#wpdo,#wpsheet,#wpmap,#wpnav')) e.stopPropagation(); }, { passive: true }); });
    ROOT.addEventListener('click', onClick);
    $('wpmini').addEventListener('click', function () { openMap(); });
    ROOT.querySelector('.wptop').addEventListener('click', function () { $('wphud').classList.toggle('mini'); });
    if (innerWidth < 700) $('wphud').classList.add('mini');
    $('wpq').addEventListener('input', function () { drawChipsAndSearch(); });
    $('wpsheet').addEventListener('click', function (e) { if (e.target.id === 'wpsheet') closeSheet(); });
    mapInput();
    if (!ST.ui) document.body.classList.add('ss-game');
    hud(); return true;
  }
  function hud() {
    if (!$('wpmoney')) return;
    $('wpmoney').textContent = '฿' + F(ST.money);
    $('wpname').textContent = ST.name + (ST.inv.length ? ' · 🎒 ' + ST.inv.length : '');
    var d = now(); $('wpclk').innerHTML = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + '<br>' + ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'][d.getDay()];
    ['food', 'energy', 'fun', 'social'].forEach(function (k) { var v = ST.needs[k], el = $('wpn_' + k); el.style.width = v + '%'; el.style.background = v > 60 ? '#4ade80' : v > 30 ? '#facc15' : '#f87171'; });
    var j = Object.keys(ST.jobs).map(function (k) { return JOBS[k] && JOBS[k].ic + ' ' + JOBS[k].t + ' Lv.' + (ST.jobs[k].lv || 1); }).filter(Boolean);
    $('wpjob').textContent = j.length ? '💼 ' + j.join(' · ') : '💼 ยังไม่มีงาน — แตะ 💼 หางาน';
  }

  /* ================= ชีท (หน้าต่างล่าง) ================= */
  function sheet(html) { $('wpsh').innerHTML = html; $('wpsheet').classList.add('on'); }
  function closeSheet() { $('wpsheet').classList.remove('on'); }
  function head(ic, t) { return '<h3>' + ic + ' ' + E(t) + '<button data-p="shx">✕</button></h3>'; }

  function eatSheet() {
    if (!ST.inv.length) return sheet(head('🎒', 'กระเป๋า') + '<div class="lesson">ยังไม่มีอะไรกินเลย ลองซื้อที่ร้านสะดวกซื้อ ร้านกาแฟ หรือรถเข็นอาหารนะ 🏪</div>');
    sheet(head('🎒', 'เลือกกิน/ดื่ม') + '<div class="g2">' + ST.inv.map(function (it, i) { return '<button class="opt" data-p="eatit" data-i="' + i + '"><span>' + it.ic + '</span>' + E(it.n) + '</button>'; }).join('') + '</div>');
  }
  function talkSheet() {
    sheet(head('💬', 'พูด') + '<input id="wpsay" placeholder="พิมพ์สิ่งที่อยากพูด…" maxlength="80"><div class="g2">' +
      ['สวัสดีครับ/ค่ะ', 'ขอบคุณครับ/ค่ะ', 'แถวนี้มีร้านอร่อยไหม', 'ไปสถานีรถไฟฟ้ายังไง', 'วันนี้อากาศดีจัง', 'ทำงานอะไรอยู่'].map(function (t) { return '<button class="opt" data-p="sayq">' + t + '</button>'; }).join('') +
      '</div><button class="pri" data-p="say">💬 พูด</button>');
    setTimeout(function () { var i = $('wpsay'); if (i && innerWidth > 900) i.focus(); }, 60);
  }

  /* ================= สถานที่ (เข้าได้/ปิดอยู่) ================= */
  var PL = {
    conv: { ic: '🏪', bg: 'linear-gradient(#f8fafc 60%,#d1fae5)', deco: '🧃🍙🥪🧊🍦', acts: [['shop', '🛒', 'ซื้อของ', 'ข้าวกล่อง ขนม เครื่องดื่ม'], ['micro', '♨️', 'อุ่นไมโครเวฟ', 'อุ่นข้าวกล่องในกระเป๋า'], ['work:clerk', '🧑‍💼', 'ทำกะพนักงาน', 'ต้องผ่านฝึกงานก่อน']] },
    hotel: { ic: '🏨', bg: 'linear-gradient(#fef3c7 55%,#b08d57)', deco: '🛎️🛋️🪴🧳✨', acts: [['sleep', '🛏️', 'เช็กอินพักผ่อน', '฿1,200 · พลังงานเต็ม'], ['spa', '💆', 'สปา', '฿600 · สนุก+พลังงาน'], ['buffet', '🍽️', 'บุฟเฟต์', '฿850 · อิ่มมาก'], ['work:reception', '🛎️', 'ทำกะพนักงานต้อนรับ', 'ต้องผ่านฝึกงานก่อน']] },
    mall: { ic: '🛍️', bg: 'linear-gradient(#ede9fe 55%,#c4b5fd)', deco: '👗🎬🍔🧸💄', acts: [['movie', '🎬', 'ดูหนัง', '฿220 · สนุกมาก'], ['court', '🍜', 'ศูนย์อาหาร', '฿60 · อิ่ม'], ['shopping', '👗', 'ช้อปปิ้ง', '฿300 · สนุก'], ['arcade', '🕹️', 'เกมเซ็นเตอร์', '฿100 · สนุก']] },
    park2: { ic: '🎡', bg: 'linear-gradient(#e0f2fe 50%,#bbf7d0)', deco: '🎡🎢🎠🍿🎈', acts: [['ride', '🎢', 'เล่นเครื่องเล่น', '฿450 บัตรเข้า · สนุกเต็ม'], ['popcorn', '🍿', 'ป๊อปคอร์น', '฿60'], ['work:parkstaff', '🎟️', 'ทำกะพนักงานสวนสนุก', 'ต้องผ่านฝึกงานก่อน']] },
    agency: { ic: '💼', bg: 'linear-gradient(#eff6ff 55%,#bfdbfe)', deco: '🧑‍💼📋💻☕🪴', acts: [['jobs', '📋', 'ดูตำแหน่งงานว่าง', 'สมัคร + ฝึกงานกับพี่เลี้ยง']] },
    hosp: { ic: '🏥', bg: 'linear-gradient(#f0fdfa 55%,#99f6e4)', deco: '🩺💊🧑‍⚕️🛏️🩹', acts: [['check', '🩺', 'ตรวจสุขภาพ', '฿300 · พลังงาน+'], ['pharm', '💊', 'ร้านขายยา', '฿80 · พลังงาน+']] },
    school: { ic: '🏫', bg: 'linear-gradient(#fefce8 55%,#fde68a)', deco: '📚✏️🧑‍🏫🎒🔔', acts: [['class', '📚', 'เข้าเรียนคอร์สสั้น', 'ฟรี · XP +'], ['lib', '📖', 'ห้องสมุด', 'สนุก+']] },
    temple: { ic: '🛕', bg: 'linear-gradient(#fff7ed 55%,#fed7aa)', deco: '🛕🪷🕯️🔔🌸', acts: [['merit', '🙏', 'ทำบุญ', '฿20 · สบายใจ']] },
    market: { ic: '🧺', bg: 'linear-gradient(#f0fdf4 55%,#bbf7d0)', deco: '🥭🍊🥬🐟🍌', acts: [['shopm', '🧺', 'ซื้อของสด', 'ผลไม้ ผัก']] },
    stadium: { ic: '🏟️', bg: 'linear-gradient(#ecfeff 55%,#a5f3fc)', deco: '⚽🏃🏀🏆📣', acts: [['sport', '⚽', 'ออกกำลังกาย', 'ฟรี · สนุก+ หิว+']] },
    station: { ic: '🚉', bg: 'linear-gradient(#f1f5f9 55%,#cbd5e1)', deco: '🚆🎫🕐🧳🚶', acts: [['train', '🚆', 'ซื้อตั๋วขึ้นรถไฟฟ้า', 'เลือกสถานีปลายทาง']] },
  };
  function placeType(q) { return q.t === 'parkS' ? 'park' : q.t; }
  function enterPlace(q) {
    var t = placeType(q), P = PL[t]; if (!P) return;
    if (!W.isOpen(t)) return say('🔒 ' + q.n + ' ปิดอยู่ · ' + W.hoursTxt(t));
    sheet(head(P.ic, q.n) + '<div class="scene" style="background:' + P.bg + '"><b>🕐 ' + W.hoursTxt(t) + '</b>' + (P.deco.match(/\p{Extended_Pictographic}(\u200d\p{Extended_Pictographic})*/gu) || []).map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</div>' +
      '<div class="g2">' + P.acts.map(function (a) { return '<button class="opt" data-p="do" data-a="' + a[0] + '" data-t="' + t + '"><span>' + a[1] + '</span><div>' + a[2] + '<small>' + a[3] + '</small></div></button>'; }).join('') + '</div>');
  }
  var SHOP_CONV = [['ข้าวกล่อง', 45, '🍱'], ['แซนด์วิช', 35, '🥪'], ['ซาลาเปา', 20, '🥟'], ['โอนิกิริ', 25, '🍙'], ['ไส้กรอก', 25, '🌭'], ['นมเย็น', 15, '🥛'], ['น้ำดื่ม', 7, '💧'], ['ไอศกรีม', 25, '🍦']];
  var SHOP_MKT = [['มะม่วง', 60, '🥭'], ['ส้ม', 50, '🍊'], ['กล้วยหอม', 40, '🍌'], ['แตงโม', 45, '🍉'], ['ผักรวม', 20, '🥬']];
  function shopList(list) {
    sheet(head('🛒', 'เลือกซื้อ') + '<div class="g2">' + list.map(function (m, i) { return '<button class="opt" data-p="buy" data-n="' + E(m[0]) + '" data-c="' + m[1] + '" data-i="' + m[2] + '"><span>' + m[2] + '</span><div>' + E(m[0]) + '<small>฿' + m[1] + '</small></div></button>'; }).join('') + '</div>');
  }
  function doAct(a, t) {
    var cost = function (v, msg, fn) { if (ST.money < v) return say('💸 เงินไม่พอ ไปหางานที่บริษัทจัดหางานได้นะ'); addMoney(-v, msg); fn(); save(); hud(); closeSheet(); };
    if (a.indexOf('work:') === 0) return startShift(a.slice(5));
    switch (a) {
      case 'shop': return shopList(SHOP_CONV);
      case 'shopm': return shopList(SHOP_MKT);
      case 'micro': var i = ST.inv.findIndex(function (x) { return x.ic === '🍱'; }); if (i < 0) return say('ไม่มีข้าวกล่องในกระเป๋า'); ST.inv[i].n += ' (อุ่นแล้ว)'; save(); return say('♨️ ติ๊ง! อุ่นข้าวกล่องเรียบร้อย');
      case 'sleep': return cost(1200, 'ค่าห้องพัก', function () { fade('😴 นอนหลับพักผ่อน…', function () { ST.needs.energy = 100; need('fun', 10); }); });
      case 'spa': return cost(600, 'สปา', function () { need('energy', 35); need('fun', 30); });
      case 'buffet': return cost(850, 'บุฟเฟต์', function () { ST.needs.food = 100; act('eat', 3); });
      case 'movie': return cost(220, 'ตั๋วหนัง', function () { fade('🎬 กำลังดูหนัง…', function () { need('fun', 45); }); });
      case 'court': return cost(60, 'ศูนย์อาหาร', function () { need('food', 45); act('eat', 3); });
      case 'shopping': return cost(300, 'ช้อปปิ้ง', function () { need('fun', 25); });
      case 'arcade': return cost(100, 'เกมเซ็นเตอร์', function () { need('fun', 22); });
      case 'ride': return cost(450, 'บัตรสวนสนุก', function () { fade('🎢 กรี๊ดดด!', function () { ST.needs.fun = 100; need('energy', -10); }); });
      case 'popcorn': return cost(60, 'ป๊อปคอร์น', function () { need('food', 15); need('fun', 5); });
      case 'check': return cost(300, 'ตรวจสุขภาพ', function () { need('energy', 25); });
      case 'pharm': return cost(80, 'ยา/วิตามิน', function () { need('energy', 12); });
      case 'class': ST.xp += 15; need('fun', 8); need('energy', -8); save(); hud(); closeSheet(); return say('📚 เรียนจบคอร์สสั้น +15 XP');
      case 'lib': need('fun', 15); save(); hud(); closeSheet(); return say('📖 อ่านหนังสือเพลินๆ');
      case 'merit': return cost(20, 'ทำบุญ', function () { need('fun', 12); act('wai', 3); });
      case 'sport': need('fun', 25); need('food', -15); need('energy', -12); save(); hud(); closeSheet(); return say('⚽ ออกกำลังกายเสร็จ สดชื่น!');
      case 'train': return trainSheet();
      case 'jobs': return jobBoard();
    }
  }
  function fade(txt, fn) {
    var f = $('wpfade'); f.textContent = txt; f.style.opacity = 1; f.style.pointerEvents = 'auto';
    setTimeout(function () { try { fn && fn(); } catch (e) {} save(); hud(); }, 600);
    setTimeout(function () { f.style.opacity = 0; f.style.pointerEvents = 'none'; }, 1600);
  }

  /* ================= การเดินทาง: แท็กซี่ / BTS-MRT ================= */
  function goTo(x, z, label) {
    if (!W.setCam || !W.camPut) return;
    var doIt = function () {
      var sp = spotNear(x, z);
      W.camPut(sp[0], sp[1], 0, 0, 0); say('📍 ถึงแล้ว: ' + label);
    };
    if (W.V && W.V.mode !== 'ext' && W.setMode) { W.setMode('ext'); setTimeout(function () { if (W.V.cam !== 'walk') W.setCam('walk'); setTimeout(doIt, 300); }, 600); return; }
    if (W.V && W.V.cam !== 'walk') { W.setCam('walk'); setTimeout(doIt, 300); } else doIt();
  }
  function spotNear(x, z) {
    for (var r = 0; r < 40; r += 2) for (var a = 0; a < 8; a++) {
      var px = x + Math.cos(a / 8 * Math.PI * 2) * r, pz = z + Math.sin(a / 8 * Math.PI * 2) * r;
      if (!(W.cityHit && W.cityHit(px, pz, .8))) return [px, pz];
    }
    return [x, z];
  }
  function places() {
    var L = [];
    (W.POI || []).forEach(function (q) { var t = placeType(q); L.push({ n: q.n, t: t, x: q.door ? q.door.x : q.x, z: q.door ? q.door.z + 2 : q.z, q: q, ic: (PL[t] || {}).ic || '📍' }); });
    (W.STATIONS || []).forEach(function (s) { L.push({ n: s.n, t: s.line === 'metro' ? 'metro' : 'station', x: s.x, z: s.z, ic: s.line === 'metro' ? 'Ⓜ️' : '🚆', st: s }); });
    (W.rentPlaced || []).forEach(function (r) { L.push({ n: r.name + ' (อาคาร #' + r.n + ')', t: 'rent', x: r.dx, z: r.dz + 2, ic: '🏢', rent: r }); });
    (W.lifeNPCs ? W.lifeNPCs() : []).filter(function (n) { return n.r.shop; }).forEach(function (n) { L.push({ n: n.r.place + ' (' + n.name + ')', t: n.r.shop === 'cafe' ? 'cafe' : n.r.shop, x: n.x, z: n.z + 2, ic: n.r.ic, npc: n }); });
    return L;
  }
  function fare(d) { return 35 + Math.ceil(d / 50) * 6; }
  function rideSheet() {
    var p = me(); if (!p) return say('เข้าโหมดเดิน (🚶) ก่อนนะ');
    var L = places().map(function (q) { q.d = Math.hypot(q.x - p.x, q.z - p.z); return q; }).filter(function (q) { return q.d > 40; }).sort(function (a, b) { return a.n.localeCompare(b.n, 'th'); });
    sheet(head('🚕', 'เรียกแท็กซี่ · มิเตอร์เริ่ม ฿35') + '<div class="g2">' + L.slice(0, 40).map(function (q, i) { return '<button class="opt" data-p="taxi" data-x="' + q.x + '" data-z="' + q.z + '" data-n="' + E(q.n) + '" data-f="' + fare(q.d) + '"><span>' + q.ic + '</span><div>' + E(q.n) + '<small>' + Math.round(q.d) + ' ม. · ฿' + fare(q.d) + '</small></div></button>'; }).join('') + '</div>');
  }
  function nearStation() { var p = me(); if (!p) return null; return (W.STATIONS || []).filter(function (s) { return Math.hypot(s.x - p.x, s.z - p.z) < 14; })[0] || null; }
  function trainSheet() {
    var here = nearStation(); var S = W.STATIONS || [];
    if (!here) return say('ต้องยืนอยู่ที่สถานีก่อนนะ เปิดแผนที่ 🗺️ แล้วค้นหา "สถานี"');
    var t = here.line === 'metro' ? 'metro' : 'station';
    if (!W.isOpen(t)) return say('🔒 รถไฟฟ้าปิดให้บริการ · ' + W.hoursTxt(t));
    sheet(head(here.line === 'metro' ? 'Ⓜ️' : '🚆', 'ขึ้นรถไฟฟ้าจาก ' + here.n) + '<div class="g2">' + S.filter(function (s) { return s !== here; }).map(function (s, i) {
      var stops = 1 + Math.round(Math.hypot(s.x - here.x, s.z - here.z) / 140), f = Math.min(62, 17 + stops * 4);
      return '<button class="opt" data-p="trainto" data-x="' + s.x + '" data-z="' + s.z + '" data-n="' + E(s.n) + '" data-f="' + f + '"><span>' + (s.line === 'metro' ? 'Ⓜ️' : '🚆') + '</span><div>' + E(s.n) + '<small>' + stops + ' สถานี · ฿' + f + '</small></div></button>';
    }).join('') + '</div>');
  }

  /* ================= งาน: บริษัทจัดหางาน → ฝึกงาน → ทำกะ ================= */
  var JOBS = {
    barista: { t: 'บาริสต้า', ic: '☕', at: 'cafe', role: 'barista', pay: 55,
      lessons: [['พื้นฐาน', 'กาแฟดีเริ่มจากเมล็ดสด บดก่อนชง ช็อตเอสเปรสโซ่ใช้กาแฟ 18 กรัม สกัด 25–30 วินาที ได้น้ำกาแฟราว 36 กรัม', 'ช็อตเอสเปรสโซ่ที่ดีควรสกัดนานเท่าไหร่?', ['25–30 วินาที', '5 วินาที', '2 นาที'], 0],
        ['นมและฟอง', 'ลาเต้ = เอสเปรสโซ่ + นมร้อน ฟองบาง · คาปูชิโน่ ฟองหนากว่า · ตีนมที่ราว 60–65°C ร้อนกว่านี้นมจะไหม้', 'ตีนมควรร้อนประมาณกี่องศา?', ['60–65°C', '100°C', '30°C'], 0],
        ['บริการ', 'ทวนออเดอร์ทุกครั้ง: ขนาด ร้อน/เย็น ความหวาน · ถามชื่อลูกค้าไว้เรียกตอนเสร็จ · ยิ้มและขอบคุณ', 'รับออเดอร์แล้วควรทำอะไรก่อนชง?', ['ทวนออเดอร์กับลูกค้า', 'ชงเลยไม่ต้องถาม', 'ให้ลูกค้าชงเอง'], 0]],
      shift: function () { var d = pick(['ลาเต้', 'อเมริกาโน่', 'คาปูชิโน่', 'มอคค่า']), tp = pick(['ร้อน', 'เย็น']), sw = pick(['0%', '25%', '50%', '100%']), right = d + ' ' + tp + ' หวาน ' + sw; return { q: 'ลูกค้า: "ขอ' + d + tp + ' หวาน ' + sw + ' ค่ะ"', ok: right, opts: [right, d + ' ' + (tp === 'ร้อน' ? 'เย็น' : 'ร้อน') + ' หวาน ' + sw, pick(['ลาเต้', 'อเมริกาโน่', 'มอคค่า'].filter(function (x) { return x !== d; })) + ' ' + tp + ' หวาน ' + sw] }; } },
    clerk: { t: 'พนักงานร้านสะดวกซื้อ', ic: '🏪', at: 'conv', role: 'clerk', pay: 50,
      lessons: [['ต้อนรับ', 'ลูกค้าเข้าร้านให้ทักทาย "สวัสดีค่ะ/ครับ" · สแกนบาร์โค้ดทุกชิ้น · ถามรับถุงไหม', 'ลูกค้าเข้าร้านควรทำอะไร?', ['ทักทายลูกค้า', 'เงียบไว้', 'เล่นมือถือ'], 0],
        ['ทอนเงิน', 'นับเงินที่รับต่อหน้าลูกค้า แล้วทอน = เงินที่รับ − ราคารวม · นับทอนให้ลูกค้าดูอีกครั้ง', 'ของ 65 บาท รับ 100 บาท ต้องทอนเท่าไหร่?', ['35 บาท', '45 บาท', '25 บาท'], 0],
        ['ของหมดอายุ', 'จัดของแบบ FIFO ของเข้าก่อนวางหน้า · เช็กวันหมดอายุทุกเช้า ของหมดอายุเก็บออกทันที', 'FIFO หมายถึงอะไร?', ['ของเข้าก่อนขายก่อน', 'ของใหม่ขายก่อน', 'ขายของแพงก่อน'], 0]],
      shift: function () { var p = [20, 25, 35, 45, 59, 65, 79][Math.floor(Math.random() * 7)] + [0, 7, 15][Math.floor(Math.random() * 3)], g = p <= 50 ? 50 : p <= 100 ? 100 : 500, c = g - p; return { q: 'ลูกค้าซื้อของ ฿' + p + ' จ่าย ฿' + g + ' ต้องทอนเท่าไหร่?', ok: '฿' + c, opts: ['฿' + c, '฿' + (c + 10), '฿' + Math.max(0, c - 5)] }; } },
    reception: { t: 'พนักงานต้อนรับโรงแรม', ic: '🛎️', at: 'hotel', role: 'reception', pay: 80,
      lessons: [['เช็กอิน', 'ขอดูบัตรประชาชน/พาสปอร์ต ยืนยันชื่อการจอง แจ้งเวลาอาหารเช้าและรหัส Wi-Fi', 'เช็กอินต้องขอดูอะไรจากแขก?', ['บัตรประชาชน/พาสปอร์ต', 'สมุดบัญชี', 'ไม่ต้องดูอะไร'], 0],
        ['เวลา', 'โดยทั่วไปเช็กอิน 14:00 เช็กเอาต์ 12:00 · ขอเช็กเอาต์ช้าได้ตามห้องว่าง', 'เวลาเช็กเอาต์ทั่วไปคือกี่โมง?', ['12:00 น.', '18:00 น.', '06:00 น.'], 0],
        ['ภาษา', 'ทักแขกต่างชาติ: Good morning / Welcome · ญี่ปุ่น: いらっしゃいませ · จีน: 欢迎光临 · เกาหลี: 어서 오세요', '"Welcome" ภาษาจีนพูดว่าอะไร?', ['欢迎光临', 'ありがとう', '안녕히 가세요'], 0]],
      shift: function () { var r = pick([['เตียงคู่ 2 คน ไม่สูบบุหรี่', 'ห้องดีลักซ์ ทวิน ปลอดบุหรี่'], ['ครอบครัว 2 ผู้ใหญ่ 2 เด็ก', 'ห้องแฟมิลี่สวีท'], ['คนเดียว ทำงาน ต้องการโต๊ะ', 'ห้องซูพีเรียร์ คิง มีโต๊ะทำงาน']]); return { q: 'แขก: "ขอห้อง' + r[0] + '"', ok: r[1], opts: [r[1], 'ห้องประชุม', 'ห้องเก็บของ'].sort(function () { return Math.random() - .5; }) }; } },
    parkstaff: { t: 'พนักงานสวนสนุก', ic: '🎡', at: 'park2', role: 'parkstaff', pay: 60,
      lessons: [['ความปลอดภัย', 'ตรวจเข็มขัดนิรภัยทุกที่นั่งก่อนปล่อยเครื่องเล่น · ห้ามคนสูงไม่ถึงเกณฑ์ขึ้นเด็ดขาด', 'ก่อนปล่อยเครื่องเล่นต้องทำอะไร?', ['ตรวจเข็มขัดทุกที่นั่ง', 'ปล่อยเลย', 'ถามลูกค้าเอง'], 0],
        ['เกณฑ์ส่วนสูง', 'รถไฟเหาะต้องสูง 120 ซม. ขึ้นไป · ม้าหมุนเด็กเล็กขึ้นได้แต่ต้องมีผู้ปกครอง', 'เด็กสูง 110 ซม. ขึ้นรถไฟเหาะได้ไหม?', ['ไม่ได้', 'ได้', 'ได้ถ้าจ่ายเพิ่ม'], 0]],
      shift: function () { var h = 95 + Math.floor(Math.random() * 50), ok = h >= 120 ? 'ให้ขึ้นได้' : 'ขออภัย ยังขึ้นไม่ได้'; return { q: 'เด็กสูง ' + h + ' ซม. ขอขึ้นรถไฟเหาะ (เกณฑ์ 120 ซม.)', ok: ok, opts: ['ให้ขึ้นได้', 'ขออภัย ยังขึ้นไม่ได้'] }; } },
    rider: { t: 'ไรเดอร์ส่งอาหาร', ic: '🛵', at: 'conv', role: 'rider', pay: 0,
      lessons: [['ขับขี่ปลอดภัย', 'สวมหมวกกันน็อกทุกครั้ง · ห้ามขับบนทางเท้า · หยุดให้คนข้ามทางม้าลาย', 'ขับมอเตอร์ไซค์ต้องสวมอะไร?', ['หมวกกันน็อก', 'หมวกแก๊ป', 'ไม่ต้องสวม'], 0],
        ['รับ-ส่งของ', 'รับของที่ร้าน เช็กออเดอร์ให้ครบ · ส่งถึงมือลูกค้า ถ่ายรูปยืนยัน · ค่าส่งคิดตามระยะทาง', 'รับของจากร้านต้องเช็กอะไร?', ['ออเดอร์ครบไหม', 'สีรถลูกค้า', 'ราคาน้ำมัน'], 0]] },
  };
  function jobBoard() {
    sheet(head('📋', 'ตำแหน่งงานว่าง') + '<div class="lesson">สมัครแล้วต้องฝึกงานกับพี่เลี้ยง (NPC) ให้ผ่านก่อน จึงทำกะได้เงินจริง · ทำกะได้ตามเวลาเปิดร้าน</div><div class="g2">' +
      Object.keys(JOBS).map(function (k) { var j = JOBS[k], have = ST.jobs[k]; return '<button class="opt" data-p="apply" data-j="' + k + '"><span>' + j.ic + '</span><div>' + j.t + '<small>' + (have ? (have.trained ? '✅ ทำงานอยู่ Lv.' + (have.lv || 1) : '📝 รอฝึกงาน') : (j.pay ? '฿' + j.pay + '/งาน' : 'ค่าส่งตามระยะ')) + '</small></div></button>'; }).join('') + '</div>');
  }
  function train(k, step, msg) {
    var j = JOBS[k]; step = step || 0;
    if (step >= j.lessons.length) {
      ST.jobs[k] = { trained: true, lv: 1, done: 0 }; ST.xp += 20; save(); hud();
      return sheet(head('🎓', 'ฝึกงานผ่านแล้ว!') + '<div class="lesson">ยินดีด้วย! ตอนนี้คุณเป็น <b>' + j.t + '</b> แล้ว 🎉<br>ไปที่ ' + PLACE_TH[j.at] + ' แล้วแตะ "ทำกะ" เพื่อเริ่มงาน' + (k === 'rider' ? '<br>ไรเดอร์: แตะ 💼 แล้วเลือก "รับออเดอร์ส่งอาหาร"' : '') + '</div><button class="pri" data-p="navjob" data-j="' + k + '">🧭 นำทางไปที่ทำงาน</button>');
    }
    var L = j.lessons[step], mentor = pick(['พี่เลี้ยง', 'หัวหน้ากะ', 'รุ่นพี่']);
    sheet(head(j.ic, 'ฝึกงาน ' + j.t + ' (' + (step + 1) + '/' + j.lessons.length + ')') + (msg || '') +
      '<div class="lesson">🧑‍🏫 <b>' + mentor + ':</b> บทเรียน "' + L[0] + '"<br>' + L[1] + '</div><div class="q">❓ ' + L[2] + '</div>' +
      L[3].map(function (o, i) { return '<button class="opt" style="margin-bottom:6px" data-p="ans" data-j="' + k + '" data-s="' + step + '" data-c="' + (i === L[4] ? 1 : 0) + '">' + E(o) + '</button>'; }).join(''));
  }
  var PLACE_TH = { cafe: 'ร้านกาแฟ', conv: 'ร้านสะดวกซื้อ', hotel: 'โรงแรม', park2: 'สวนสนุก' };
  var SHIFT = null;
  function startShift(k) {
    var j = JOBS[k]; if (!j) return;
    if (!ST.jobs[k] || !ST.jobs[k].trained) { closeSheet(); return say('ต้องสมัครและฝึกงาน ' + j.t + ' ที่บริษัทจัดหางานก่อนนะ 💼'); }
    if (!W.isOpen(j.at)) return say('🔒 ตอนนี้ร้านปิด ทำกะไม่ได้ · ' + W.hoursTxt(j.at));
    if (ST.needs.energy < 15) return say('⚡ เหนื่อยเกินไป พักผ่อนก่อนนะ');
    SHIFT = { k: k, n: 0, ok: 0 }; shiftQ();
  }
  function shiftQ(msg) {
    var j = JOBS[SHIFT.k];
    if (SHIFT.n >= 5) {
      var lv = ST.jobs[SHIFT.k].lv || 1, pay = Math.round(SHIFT.ok * j.pay * (1 + (lv - 1) * .15));
      ST.jobs[SHIFT.k].done = (ST.jobs[SHIFT.k].done || 0) + 1; if (ST.jobs[SHIFT.k].done % 3 === 0) ST.jobs[SHIFT.k].lv = lv + 1;
      need('energy', -20); need('food', -12); need('social', 15); ST.xp += SHIFT.ok * 3; save();
      sheet(head(j.ic, 'จบกะ!') + '<div class="lesson">ถูก ' + SHIFT.ok + '/5 · ได้ค่าแรง <b>฿' + F(pay) + '</b>' + (ST.jobs[SHIFT.k].lv > lv ? '<br>🎉 เลื่อนขั้นเป็น Lv.' + ST.jobs[SHIFT.k].lv + ' ค่าแรงเพิ่มขึ้น!' : '') + '</div><button class="pri" data-p="shx">เสร็จสิ้น</button>');
      addMoney(pay, 'ค่าแรง' + j.t); SHIFT = null; return;
    }
    var c = j.shift(); SHIFT.c = c;
    var opts = c.opts.slice(); for (var i = opts.length - 1; i > 0; i--) { var r = Math.floor(Math.random() * (i + 1)), x = opts[i]; opts[i] = opts[r]; opts[r] = x; }
    sheet(head(j.ic, j.t + ' · ลูกค้าคนที่ ' + (SHIFT.n + 1) + '/5') + (msg || '') + '<div class="lesson">🧑 ' + E(c.q) + '</div>' +
      opts.map(function (o) { return '<button class="opt" style="margin-bottom:6px" data-p="sans" data-v="' + E(o) + '">' + E(o) + '</button>'; }).join(''));
  }

  /* ---------- ไรเดอร์: รับ-ส่งของจริงในแมพ ---------- */
  var DEL = null, NAV = null;
  function riderStart() {
    if (!ST.jobs.rider || !ST.jobs.rider.trained) return say('ต้องฝึกงานไรเดอร์ที่บริษัทจัดหางานก่อนนะ 🛵');
    var p = me(); if (!p) return say('เข้าโหมดเดิน (🚶) ก่อนนะ');
    var shops = places().filter(function (q) { return q.npc || q.t === 'conv'; }), dests = places().filter(function (q) { return q.t === 'rent' || q.t === 'hotel' || q.t === 'school' || q.t === 'hosp' || q.t === 'agency'; });
    if (!shops.length || !dests.length) return say('ยังไม่มีออเดอร์ตอนนี้');
    var a = shops.sort(function (x, y) { return Math.hypot(x.x - p.x, x.z - p.z) - Math.hypot(y.x - p.x, y.z - p.z); })[Math.floor(Math.random() * Math.min(3, shops.length))];
    var b = pick(dests), dist = Math.hypot(a.x - b.x, a.z - b.z);
    DEL = { a: a, b: b, stage: 'pick', pay: Math.round(25 + dist / 12), item: pick(['ข้าวมันไก่', 'ชานมไข่มุก', 'ผัดไทย', 'ข้าวกล่อง', 'ส้มตำ']) };
    W.speedMul = 2.4; closeSheet();
    nav(a.x, a.z, '🛵 ไปรับ ' + DEL.item + ' ที่ ' + a.n);
    say('📦 ออเดอร์ใหม่! ค่าส่ง ฿' + DEL.pay + ' · ขี่มอเตอร์ไซค์ (เร็วขึ้น 2.4 เท่า)');
  }
  function riderTick(p) {
    if (!DEL || !p) return;
    var tgt = DEL.stage === 'pick' ? DEL.a : DEL.b;
    if (Math.hypot(tgt.x - p.x, tgt.z - p.z) < 7) {
      if (DEL.stage === 'pick') { DEL.stage = 'drop'; nav(DEL.b.x, DEL.b.z, '🛵 ส่ง ' + DEL.item + ' ที่ ' + DEL.b.n); say('✅ รับของแล้ว ไปส่งได้เลย'); }
      else { addMoney(DEL.pay, 'ค่าส่ง ' + DEL.item); ST.jobs.rider.done = (ST.jobs.rider.done || 0) + 1; need('energy', -6); act('wave', 2); DEL = null; W.speedMul = 1; nav(null); save(); hud(); say('🎉 ส่งสำเร็จ! แตะ 💼 รับออเดอร์ใหม่'); }
    }
  }

  /* ---------- นำทาง ---------- */
  function nav(x, z, label) {
    if (x == null) { NAV = null; $('wpnav').style.display = 'none'; return; }
    NAV = { x: x, z: z, l: label }; $('wpnav').style.display = 'flex';
  }
  function navTick(p) {
    if (!NAV || !p) return;
    var d = Math.hypot(NAV.x - p.x, NAV.z - p.z), ang = Math.atan2(NAV.x - p.x, NAV.z - p.z), rel = ang - (p.yaw + Math.PI);
    $('wpnavarr').style.transform = 'rotate(' + (-rel) + 'rad)';
    $('wpnavtxt').textContent = NAV.l + ' · ' + Math.round(d) + ' ม.';
    if (d < 6 && !DEL) { say('📍 ถึงที่หมายแล้ว'); nav(null); }
  }

  /* ================= แผนที่ (แบบ Google Maps) ================= */
  var MV = { cx: 0, cz: 0, s: .9, sel: null, filt: 'all' }, SPL = [-416, -346, -276, -206, -136, -66, 0, 66, 136, 206, 276, 346, 416];
  var FILT = [['all', 'ทั้งหมด'], ['conv', '🏪 สะดวกซื้อ'], ['food', '🍜 อาหาร'], ['cafe', '☕ คาเฟ่'], ['station', '🚆 รถไฟฟ้า'], ['metro', 'Ⓜ️ ใต้ดิน'], ['hotel', '🏨 โรงแรม'], ['mall', '🛍️ ห้าง'], ['hosp', '🏥 รพ.'], ['school', '🏫 รร.'], ['rent', '🏢 ตึกเช่า'], ['park2', '🎡 สวนสนุก'], ['agency', '💼 หางาน']];
  function openMap() { var p = me(); if (p) { MV.cx = p.x; MV.cz = p.z; } $('wpmap').classList.add('on'); drawChipsAndSearch(); drawMap(); }
  function drawChipsAndSearch() {
    $('wpchips').innerHTML = FILT.map(function (f) { return '<button data-p="filt" data-f="' + f[0] + '" class="' + (MV.filt === f[0] ? 'on' : '') + '">' + f[1] + '</button>'; }).join('');
    drawMap();
  }
  function shown() {
    var q = ($('wpq') && $('wpq').value || '').trim();
    return places().filter(function (p) { return (MV.filt === 'all' || p.t === MV.filt || (MV.filt === 'food' && (p.t === 'food' || p.t === 'fruit'))) && (!q || p.n.indexOf(q) >= 0 || (PL[p.t] && q.indexOf('ร้าน') >= 0 && p.t === 'conv')); });
  }
  function drawMap() {
    var cv = $('wpmc'); if (!cv || !$('wpmap').classList.contains('on')) return;
    var dpr = Math.min(devicePixelRatio || 1, 2), Wd = cv.clientWidth, Hd = cv.clientHeight; cv.width = Wd * dpr; cv.height = Hd * dpr;
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var s = MV.s, ox = Wd / 2 - MV.cx * s, oz = Hd / 2 - MV.cz * s, X = function (x) { return ox + x * s; }, Z = function (z) { return oz + z * s; };
    g.fillStyle = '#e8eaed'; g.fillRect(0, 0, Wd, Hd);
    g.fillStyle = '#f8f9fa'; g.fillRect(X(-416), Z(-416), 832 * s, 832 * s);
    for (var bi = 0; bi < 12; bi++) for (var bj = 0; bj < 12; bj++) { if (bj === 10) continue; g.fillStyle = (bi + bj) % 3 ? '#eceff1' : '#e3e7ea'; g.fillRect(X(SPL[bi] + 8), Z(SPL[bj] + 8), (SPL[bi + 1] - SPL[bi] - 16) * s, (SPL[bj + 1] - SPL[bj] - 16) * s); }
    g.fillStyle = '#c8e6c9'; (W.POI || []).forEach(function (q) { if (q.t === 'park' || q.t === 'parkS' || q.t === 'park2') g.fillRect(X(q.x - 27), Z(q.z - 27), 54 * s, 54 * s); });
    g.fillStyle = '#aadaff'; g.fillRect(X(-416), Z(282), 832 * s, 58 * s);
    g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(3, 10 * s); SPL.forEach(function (c) { g.beginPath(); g.moveTo(X(c), Z(-416)); g.lineTo(X(c), Z(416)); g.stroke(); g.beginPath(); g.moveTo(X(-416), Z(c)); g.lineTo(X(416), Z(c)); g.stroke(); });
    g.strokeStyle = '#fbbc04'; g.lineWidth = Math.max(1, 2 * s); [0, -136, 136].forEach(function (c) { g.beginPath(); g.moveTo(X(c), Z(-416)); g.lineTo(X(c), Z(416)); g.stroke(); });
    g.strokeStyle = '#34a853'; g.lineWidth = Math.max(2, 4 * s); g.setLineDash([10, 6]); g.beginPath(); g.moveTo(X(-416), Z(-136)); g.lineTo(X(416), Z(-136)); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#dadce0'; (W.RENT_LOTS || []).forEach(function (l) { g.fillRect(X(l.x0 + 10), Z(l.z0 + 12), (l.x1 - l.x0 - 20) * s, (l.z1 - l.z0 - 24) * s); });
    var L = shown(); g.font = '600 12px system-ui,sans-serif'; g.textAlign = 'center';
    L.forEach(function (p) {
      var x = X(p.x), y = Z(p.z); if (x < -20 || y < -20 || x > Wd + 20 || y > Hd + 20) return;
      var open = p.t === 'rent' || W.isOpen(p.t), sel = MV.sel === p;
      g.fillStyle = sel ? '#ea4335' : open ? '#1a73e8' : '#9aa0a6'; g.beginPath(); g.arc(x, y - 14, sel ? 15 : 12, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 6, y - 8); g.lineTo(x + 6, y - 8); g.lineTo(x, y); g.fill();
      g.font = '14px system-ui'; g.fillText(p.ic, x, y - 9);
      if (s > .7 || sel) { g.font = '600 11px system-ui,sans-serif'; g.fillStyle = '#202124'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeText(p.n.slice(0, 22), x, y + 13); g.fillText(p.n.slice(0, 22), x, y + 13); }
    });
    var me0 = me(); if (me0) { var px = X(me0.x), py = Z(me0.z); g.fillStyle = 'rgba(26,115,232,.2)'; g.beginPath(); g.arc(px, py, 22, 0, 7); g.fill(); g.fillStyle = '#1a73e8'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(px, py, 8, 0, 7); g.fill(); g.stroke(); }
    if (NAV && me0) { g.strokeStyle = '#1a73e8'; g.lineWidth = 5; g.setLineDash([2, 8]); g.lineCap = 'round'; g.beginPath(); g.moveTo(X(me0.x), Z(me0.z)); g.lineTo(X(me0.x), Z(NAV.z)); g.lineTo(X(NAV.x), Z(NAV.z)); g.stroke(); g.setLineDash([]); }
    MV.hits = L.map(function (p) { return { p: p, x: X(p.x), y: Z(p.z) - 12 }; });
  }
  function mapInput() {
    var cv = $('wpmc'), ps = {}, last = null, moved = 0, pd = 0;
    cv.addEventListener('pointerdown', function (e) { ps[e.pointerId] = { x: e.clientX, y: e.clientY }; moved = 0; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', function (e) {
      if (!ps[e.pointerId]) return; var k = Object.keys(ps);
      if (k.length === 1) { MV.cx -= (e.clientX - ps[e.pointerId].x) / MV.s; MV.cz -= (e.clientY - ps[e.pointerId].y) / MV.s; moved += Math.abs(e.clientX - ps[e.pointerId].x) + Math.abs(e.clientY - ps[e.pointerId].y); }
      ps[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (k.length === 2) { var a = ps[k[0]], b = ps[k[1]], d = Math.hypot(a.x - b.x, a.y - b.y); if (pd) MV.s = clamp(MV.s * d / pd, .3, 4); pd = d; moved = 99; }
      drawMap();
    });
    cv.addEventListener('pointerup', function (e) { if (moved < 6 && Object.keys(ps).length === 1) tapMap(e); delete ps[e.pointerId]; pd = 0; });
    cv.addEventListener('wheel', function (e) { e.preventDefault(); MV.s = clamp(MV.s * Math.exp(-e.deltaY * .0015), .3, 4); drawMap(); }, { passive: false });
  }
  function tapMap(e) {
    var r = $('wpmc').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    var h = (MV.hits || []).filter(function (q) { return Math.hypot(q.x - x, q.y - y) < 22; })[0];
    MV.sel = h ? h.p : null; drawMap();
    var c = $('wpcard'); if (!h) return c.classList.remove('on');
    var p = h.p, m = me(), d = m ? Math.hypot(p.x - m.x, p.z - m.z) : 0, open = p.t === 'rent' || W.isOpen(p.t);
    c.innerHTML = '<b style="font-size:1.1rem">' + p.ic + ' ' + E(p.n) + '</b><div style="color:' + (open ? '#188038' : '#d93025') + ';margin-top:4px">' + (p.t === 'rent' ? 'ตึกเช่าของคุณ' : (open ? 'เปิดอยู่' : 'ปิดแล้ว') + ' · ' + W.hoursTxt(p.t)) + '</div>' +
      '<div style="color:#5f6368;font-size:.9rem">🚶 ' + Math.max(1, Math.round(d / 80)) + ' นาที (' + Math.round(d) + ' ม.) · 🚕 ฿' + fare(d) + '</div>' +
      '<div class="row"><button class="pri" data-p="navgo">🧭 นำทาง</button><button data-p="taxigo">🚕 แท็กซี่</button>' + (p.st ? '<button data-p="trainmap">🚆 รถไฟฟ้า</button>' : '') + '</div>';
    c.classList.add('on');
  }
  function drawMini() {
    var cv = $('wpmini'); if (!cv) return; var g = cv.getContext('2d'), p = me(), Wd = 300, s = 1.1;
    var cx = p ? p.x : (W.V ? W.V.tx : 0), cz = p ? p.z : (W.V ? W.V.tz : 0);
    g.save(); g.clearRect(0, 0, Wd, Wd); g.beginPath(); g.arc(150, 150, 150, 0, 7); g.clip();
    g.fillStyle = '#eef0e8'; g.fillRect(0, 0, Wd, Wd);
    var rot = p ? (p.yaw) : 0; g.translate(150, 150); g.rotate(rot); g.translate(-cx * s, -cz * s);
    g.fillStyle = '#aadaff'; g.fillRect(-416 * s, 282 * s, 832 * s, 58 * s);
    g.strokeStyle = '#ffffff'; g.lineWidth = 11; SPL.forEach(function (c) { g.beginPath(); g.moveTo(c * s, -416 * s); g.lineTo(c * s, 416 * s); g.stroke(); g.beginPath(); g.moveTo(-416 * s, c * s); g.lineTo(416 * s, c * s); g.stroke(); });
    g.strokeStyle = '#34a853'; g.lineWidth = 4; g.beginPath(); g.moveTo(-416 * s, -136 * s); g.lineTo(416 * s, -136 * s); g.stroke();
    places().forEach(function (q) { if (Math.hypot(q.x - cx, q.z - cz) > 160) return; g.fillStyle = q.t === 'rent' ? '#ea4335' : W.isOpen(q.t) ? '#1a73e8' : '#9aa0a6'; g.beginPath(); g.arc(q.x * s, q.z * s, 7, 0, 7); g.fill(); });
    if (NAV) { g.fillStyle = '#ea4335'; g.beginPath(); g.arc(NAV.x * s, NAV.z * s, 10, 0, 7); g.fill(); }
    g.restore();
    g.fillStyle = '#1a73e8'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(150, 136); g.lineTo(161, 162); g.lineTo(150, 156); g.lineTo(139, 162); g.closePath(); g.fill(); g.stroke();
  }

  /* ================= ปุ่มทำงาน ================= */
  function onClick(e) {
    var b = e.target.closest('[data-p]'); if (!b) return; var a = b.dataset.p, d = b.dataset;
    if (a === 'jump') { if (W.camJump) W.camJump(); if (W.V && W.V.cam !== 'walk') say('กด 🚶 (โหมดเดิน) ก่อนนะ'); }
    else if (a === 'dance') { act('dance', 6); need('fun', 6); }
    else if (a === 'wave') { act('wave', 2.5); need('social', 2); }
    else if (a === 'wai') act('wai', 2.5);
    else if (a === 'eat') eatSheet();
    else if (a === 'eatit') { var it = ST.inv.splice(+d.i, 1)[0]; if (it) { need('food', FOOD_VAL[it.ic] || 15); act('eat', 3); if (/☕|🥫|🧋/.test(it.ic)) need('energy', 10); save(); hud(); say('😋 อร่อย! ' + it.ic + ' ' + it.n); } closeSheet(); }
    else if (a === 'talk') talkSheet();
    else if (a === 'sayq') { $('wpsay').value = b.textContent; }
    else if (a === 'say') { var t = ($('wpsay').value || '').trim(); if (t) { closeSheet(); speak(t); } }
    else if (a === 'map') openMap();
    else if (a === 'mapx') { $('wpmap').classList.remove('on'); $('wpcard').classList.remove('on'); }
    else if (a === 'mapme') { var p = me(); if (p) { MV.cx = p.x; MV.cz = p.z; MV.s = 1.4; drawMap(); } }
    else if (a === 'filt') { MV.filt = d.f; drawChipsAndSearch(); }
    else if (a === 'navgo' && MV.sel) { nav(MV.sel.x, MV.sel.z, '🧭 ' + MV.sel.n); $('wpmap').classList.remove('on'); if (W.V && W.V.cam !== 'walk' && W.setCam) W.setCam('walk'); }
    else if (a === 'taxigo' && MV.sel) { var m = me(); var f = fare(m ? Math.hypot(MV.sel.x - m.x, MV.sel.z - m.z) : 100); taxi(MV.sel.x, MV.sel.z, MV.sel.n, f); $('wpmap').classList.remove('on'); }
    else if (a === 'trainmap') { $('wpmap').classList.remove('on'); say('เดินไปที่สถานีแล้วแตะ "🚆 ขึ้นรถไฟฟ้า"'); nav(MV.sel.x, MV.sel.z, '🚆 ' + MV.sel.n); }
    else if (a === 'ride') rideSheet();
    else if (a === 'taxi') taxi(+d.x, +d.z, d.n, +d.f);
    else if (a === 'trainto') { if (ST.money < +d.f) return say('💸 เงินไม่พอซื้อตั๋ว'); addMoney(-+d.f, 'ตั๋วรถไฟฟ้า'); closeSheet(); fade('🚆 กำลังเดินทางไป ' + d.n + '…', function () { goTo(+d.x, +d.z, d.n); }); }
    else if (a === 'jobs') { var opts = '<button class="opt" data-p="board"><span>📋</span><div>ตำแหน่งงานว่าง<small>สมัคร/ฝึกงาน</small></div></button>' + (ST.jobs.rider && ST.jobs.rider.trained ? '<button class="opt" data-p="rider"><span>🛵</span><div>รับออเดอร์ส่งอาหาร<small>' + (DEL ? 'กำลังส่งอยู่' : 'ขี่มอเตอร์ไซค์ไปรับ-ส่ง') + '</small></div></button>' : '') + Object.keys(ST.jobs).filter(function (k) { return ST.jobs[k].trained && k !== 'rider'; }).map(function (k) { return '<button class="opt" data-p="navjob" data-j="' + k + '"><span>' + JOBS[k].ic + '</span><div>ไปทำกะ ' + JOBS[k].t + '<small>' + PLACE_TH[JOBS[k].at] + ' · ' + W.hoursTxt(JOBS[k].at) + '</small></div></button>'; }).join(''); var ag = (W.POI || []).find(function (q) { return q.t === 'agency'; }); sheet(head('💼', 'งานของฉัน · XP ' + ST.xp) + '<div class="g2">' + opts + (ag ? '<button class="opt" data-p="navag"><span>🧭</span><div>นำทางไปบริษัทจัดหางาน<small>' + W.hoursTxt('agency') + '</small></div></button>' : '') + '</div>'); }
    else if (a === 'board') jobBoard();
    else if (a === 'navag') { var ag2 = (W.POI || []).find(function (q) { return q.t === 'agency'; }); if (ag2) { nav(ag2.door ? ag2.door.x : ag2.x, ag2.door ? ag2.door.z + 2 : ag2.z, '💼 บริษัทจัดหางาน'); closeSheet(); } }
    else if (a === 'rider') { if (DEL) return say('กำลังส่งออเดอร์อยู่ ตามลูกศรสีฟ้าเลย'); riderStart(); }
    else if (a === 'apply') { var k = d.j; if (ST.jobs[k] && ST.jobs[k].trained) return say('ทำงานนี้อยู่แล้ว ไปทำกะได้เลย'); ST.jobs[k] = { trained: false }; save(); train(k, 0); }
    else if (a === 'ans') { var ok = d.c === '1', st = +d.s; if (ok) { train(d.j, st + 1, '<div class="ok">✅ ถูกต้อง! เก่งมาก</div>'); } else train(d.j, st, '<div class="ng">❌ ยังไม่ถูก ลองอ่านบทเรียนอีกครั้งนะ</div>'); }
    else if (a === 'sans' && SHIFT) { var good = d.v === SHIFT.c.ok; if (good) SHIFT.ok++; SHIFT.n++; shiftQ(good ? '<div class="ok">✅ ลูกค้าพอใจ!</div>' : '<div class="ng">❌ ผิด ที่ถูกคือ "' + E(SHIFT.c.ok) + '"</div>'); }
    else if (a === 'navjob') { var J = JOBS[d.j], tg = places().filter(function (q) { return q.t === J.at; }), m2 = me(); if (tg.length && m2) { tg.sort(function (x, y) { return Math.hypot(x.x - m2.x, x.z - m2.z) - Math.hypot(y.x - m2.x, y.z - m2.z); }); nav(tg[0].x, tg[0].z, J.ic + ' ' + tg[0].n); } closeSheet(); }
    else if (a === 'do') doAct(d.a, d.t);
    else if (a === 'buy') { if (W.onBuy({ name: d.n, ic: d.i, price: +d.c }) === false) say('💸 เงินไม่พอ'); else say('🛍️ ซื้อ ' + d.i + ' ' + d.n + ' ฿' + d.c + ' แล้ว (อยู่ในกระเป๋า)'); }
    else if (a === 'shx') closeSheet();
    else if (a === 'navx') { nav(null); if (DEL) { DEL = null; W.speedMul = 1; say('ยกเลิกออเดอร์แล้ว'); } }
    else if (a === 'ui') { ST.ui = !ST.ui; document.body.classList.toggle('ss-game', !ST.ui); save(); say(ST.ui ? '👁 แสดงแผงข้อมูลร้าน' : '🎮 โหมดเล่นเกม: ซ่อนแผงที่ไม่จำเป็นแล้ว'); }
  }
  function taxi(x, z, n, f) {
    if (ST.money < f) return say('💸 เงินไม่พอจ่ายค่าแท็กซี่');
    closeSheet(); addMoney(-f, 'ค่าแท็กซี่');
    fade('🚕 กำลังนั่งแท็กซี่ไป ' + n + '…', function () { goTo(x, z, n); });
  }

  /* ================= เดินใกล้ประตู → เข้า / ปิดอยู่ ================= */
  var NEAR = null;
  function doorTick(p) {
    var btn = $('wpdo'); if (!btn) return;
    NEAR = null;
    if (p && p.walk && !$('wpsheet').classList.contains('on')) {
      var best = null, bd = 9;
      (W.POI || []).forEach(function (q) { if (!PL[placeType(q)]) return; var dx = q.door ? q.door.x : q.x, dz = q.door ? q.door.z : q.z, d = Math.hypot(dx - p.x, dz - p.z); if (d < bd) { bd = d; best = { q: q }; } });
      var stn = nearStation(); if (stn && !best) best = { st: stn };
      NEAR = best;
    }
    if (!NEAR) return btn.style.display = 'none';
    btn.style.display = 'block';
    if (NEAR.st) { var tt = NEAR.st.line === 'metro' ? 'metro' : 'station', o = W.isOpen(tt); btn.className = o ? '' : 'lock'; btn.textContent = o ? '🚆 ขึ้นรถไฟฟ้า · ' + NEAR.st.n : '🔒 ' + NEAR.st.n + ' ปิด · ' + W.hoursTxt(tt); btn.onclick = trainSheet; return; }
    var t = placeType(NEAR.q), op = W.isOpen(t);
    btn.className = op ? '' : 'lock';
    btn.textContent = op ? '🚪 ประตูเปิด · เข้า ' + NEAR.q.n : '🔒 ' + NEAR.q.n + ' ปิดอยู่ · ' + W.hoursTxt(t);
    btn.onclick = function () { enterPlace(NEAR.q); };
  }

  /* ---------- ชิปพิเศษในหน้าต่างคุยกับ NPC (ฝึกงาน/ทำกะ) ---------- */
  var ROLE_JOB = { barista: 'barista', clerk: 'clerk', reception: 'reception', parkstaff: 'parkstaff', rider: 'rider' };
  W.lifeChips = function (n) {
    var k = ROLE_JOB[n.role], out = [];
    if (n.role === 'recruiter') out.push('📋 หางานทำ');
    if (k) out.push(ST.jobs[k] && ST.jobs[k].trained ? (k === 'rider' ? '🛵 รับออเดอร์' : '🧑‍💼 ทำกะกับพี่') : '🎓 ขอฝึกงานด้วย');
    return out;
  };
  W.lifeChip = function (n, tx) {
    var k = ROLE_JOB[n.role];
    if (/หางานทำ/.test(tx)) { W.lifeClose(); jobBoard(); return true; }
    if (/ฝึกงาน/.test(tx) && k) { W.lifeClose(); if (!ST.jobs[k]) ST.jobs[k] = { trained: false }; save(); train(k, 0); return true; }
    if (/ทำกะ/.test(tx) && k) { W.lifeClose(); startShift(k); return true; }
    if (/รับออเดอร์/.test(tx)) { W.lifeClose(); riderStart(); return true; }
    return false;
  };

  /* ---------- ไรเดอร์ NPC วิ่งบนถนน ---------- */
  var BIKES = [], BG = null;
  function bikes() {
    var T = window.THREE; if (!T || !W.EXS || BG) return;
    BG = new T.Group(); BG.name = 'bikes'; W.EXS.add(BG);
    var cols = [0x16a34a, 0xf97316, 0xdb2777, 0x16a34a, 0xf59e0b];
    for (var i = 0; i < 14; i++) {
      var g = new T.Group(), c = cols[i % cols.length];
      var body = new T.Mesh(new T.BoxGeometry(.45, .5, 1.6), new T.MeshLambertMaterial({ color: 0x222222 })); body.position.y = .55; g.add(body);
      var box = new T.Mesh(new T.BoxGeometry(.55, .5, .5), new T.MeshLambertMaterial({ color: c })); box.position.set(0, 1.45, -.55); g.add(box);
      var rd = new T.Mesh(new T.BoxGeometry(.42, .62, .3), new T.MeshLambertMaterial({ color: c })); rd.position.set(0, 1.25, 0); g.add(rd);
      var hd = new T.Mesh(new T.SphereGeometry(.17, 10, 8), new T.MeshLambertMaterial({ color: c })); hd.position.set(0, 1.72, .02); g.add(hd);
      [-.6, .6].forEach(function (z) { var w = new T.Mesh(new T.CylinderGeometry(.27, .27, .12, 12), new T.MeshLambertMaterial({ color: 0x111111 })); w.rotation.z = Math.PI / 2; w.position.set(0, .27, z); g.add(w); });
      var ax = i % 2 ? 'x' : 'z', line = SPL[1 + (i * 5) % 11], dir = i % 3 ? 1 : -1;
      BIKES.push({ g: g, ax: ax, c: line + (dir > 0 ? 2.2 : -2.2), p: -400 + Math.random() * 800, dir: dir, sp: 9 + Math.random() * 5 });
      BG.add(g);
    }
  }
  var lastB = performance.now();
  function bikeLoop(t) {
    requestAnimationFrame(bikeLoop);
    var dt = Math.min(.05, (t - lastB) / 1000); lastB = t; if (document.hidden) return;
    BIKES.forEach(function (b) {
      b.p += b.sp * b.dir * dt; if (b.p > 416) b.p = -416; if (b.p < -416) b.p = 416;
      if (b.ax === 'x') { b.g.position.set(b.p, 0, b.c); b.g.rotation.y = b.dir > 0 ? Math.PI / 2 : -Math.PI / 2; } else { b.g.position.set(b.c, b.ax === 'z' && b.p > 280 && b.p < 342 ? .36 : 0, b.p); b.g.rotation.y = b.dir > 0 ? 0 : Math.PI; }
    });
  }
  requestAnimationFrame(bikeLoop);

  /* ================= วนทำงาน ================= */
  var verB = -1;
  setInterval(function () {
    if (!buildUI()) return;
    if (W.EXS && verB !== W.cityVer) { if (BG && BG.parent) BG.parent.remove(BG); BG = null; BIKES = []; bikes(); verB = W.cityVer; }
    var p = me(); doorTick(p); navTick(p); riderTick(p); drawMini();
    if ($('wpmap').classList.contains('on')) drawMap();
  }, 250);
  setInterval(function () {
    decay(); hud(); save();
    var low = Object.keys(ST.needs).filter(function (k) { return ST.needs[k] < 15; });
    if (low.length && Math.random() < .25) say({ food: '🍔 หิวมากแล้ว หาอะไรกินหน่อย', energy: '⚡ เหนื่อยมาก ไปพักที่โรงแรมหรือบ้านนะ', fun: '🎉 เบื่อจัง ไปสวนสนุกหรือห้างดีไหม', social: '💬 เหงา ลองคุยกับคนแถวนี้ดู' }[low[0]]);
  }, 10000);
  W.play = { ST: ST, nav: nav, enterPlace: enterPlace };
})();
