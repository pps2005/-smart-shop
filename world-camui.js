/* ============================================================
   world-camui.js — UI ของระบบกล้อง + ย่อ/ซ่อนกล่อง UI
   (เมนูกล้อง, เมนูแสดง/ซ่อนแผง, ปุ่มย่อมุมกล่อง, แถบล่างพับได้,
    จอยสติ๊ก, ปุ่มขึ้น/ลง, HUD ดีบัก, แถบ Spectator, ข้อความแนะนำ)
   ============================================================ */
(function () {
  'use strict';
  var W = window.SSW; if (!W || !W.CAM) return;
  var V = W.V, CAM = W.CAM, WD = null, coarse = false;
  try { coarse = matchMedia('(pointer:coarse)').matches; } catch (e) {}
  var UIK = ['kpi', 'act', 'left', 'right', 'tabs', 'top', 'tags', 'dock'];
  var UL = { kpi: 'การ์ดตัวเลขด้านบน', act: 'กล่องงาน/ทางลัด (ซ้ายล่าง)', left: 'แผงข้อมูลฝ่าย (ซ้าย)', right: 'ฟีด/กิจกรรม (ขวา)', tabs: 'แถบเลือกห้อง', top: 'แถบค้นหา/เมนูด้านบน', tags: 'ป้ายชื่อลอย', dock: 'แถบปุ่มด้านล่าง' };
  var ui = { kpi: 1, act: 1, left: 1, right: 1, tabs: 1, top: 1, tags: 1, dock: 1, mn: {} }, snap = null, clean = null;
  try { var sv = JSON.parse(localStorage.getItem('ss_ui') || 'null'); if (sv) { UIK.forEach(function (k) { if (sv[k] === 0 || sv[k] === 1) ui[k] = sv[k]; }); ui.mn = sv.mn || {}; } } catch (e) {}
  /* เหลือเฉพาะ 3 ส่วนที่ผู้ใช้เลือก: แถบค้นหาด้านบน · ป้ายชื่อลอย · แถบปุ่มด้านล่าง — ที่เหลือซ่อนถาวร */
  var MK = ['top', 'tags', 'dock'], OFF = ['kpi', 'act', 'left', 'right', 'tabs'];
  OFF.forEach(function (k) { ui[k] = 0; });
  function save() { OFF.forEach(function (k) { ui[k] = 0; }); try { localStorage.setItem('ss_ui', JSON.stringify(ui)); } catch (e) {} }

  var MODES = [
    ['orbit', '🧭', 'มุมสูง', 'ดีฟอลต์ · หมุน/ซูมดูภาพรวม'],
    ['walk', '🚶', 'Free Roam · เดินระดับสายตา', 'เดินในเมือง เข้าตึก เดินระหว่างห้อง ขึ้นชั้น 2']
  ];

  function css() {
    var s = document.createElement('style'); s.textContent = [
      '#wd.h-kpi .wkpi,#wd.h-act .wact,#wd.h-left .wleft,#wd.h-right .wright,#wd.h-tabs .wtabs,#wd.h-top .wtop{display:none!important}',
      '#wd.h-tags .wtag{visibility:hidden}',
      '#wd .wbot{transition:transform .25s ease,opacity .2s}#wd.h-dock .wbot{transform:translate(-50%,170%);opacity:0;pointer-events:none}',
      '#wd .mn{max-height:50px!important;overflow:hidden!important}',
      '#wd.cam-x .wctl .zr{display:none}',
      '.wmn{position:absolute;z-index:5;width:26px;height:26px;border-radius:9px;display:none;place-items:center;font-size:15px;line-height:1;font-weight:800;background:var(--in);color:var(--gt);border:1px solid var(--gl);pointer-events:auto;cursor:pointer}',
      '.wdh{position:absolute;left:50%;bottom:0;transform:translateX(-50%);z-index:5;width:76px;height:16px;display:grid;place-items:center;pointer-events:auto;border-radius:10px 10px 0 0;background:var(--g2,rgba(20,24,36,.7));backdrop-filter:blur(8px);color:var(--gm);font-size:11px;padding:0;margin-bottom:env(safe-area-inset-bottom,0px)}',
      '.wdh:before{content:"";width:34px;height:4px;border-radius:4px;background:currentColor;opacity:.6}#wd.h-dock .wdh:before{display:none}#wd.h-dock .wdh:after{content:"▲ เมนู"}',
      '.wpop{position:absolute;right:62px;bottom:calc(76px + env(safe-area-inset-bottom,0px));width:330px;max-height:calc(100% - 170px);overflow:auto;padding:14px;z-index:7;display:none;color:var(--gt)}.wpop.on{display:block}',
      '.wpop h3{margin:0 0 10px;font-size:.95rem;display:flex;align-items:center}.wpop h3 button{margin-left:auto;width:30px;height:30px;border-radius:10px;background:var(--in)}',
      '.wpop .wcr{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:9px 10px;border-radius:12px;margin-bottom:5px;background:var(--in);border:1px solid var(--gl);color:var(--gt)}.wpop .wcr.on{background:var(--ac);color:#fff;border-color:transparent}.wpop .wcr i{font-style:normal;font-size:1.25rem;width:26px;text-align:center}.wpop .wcr b{display:block;font-size:.84rem}.wpop .wcr small{opacity:.75;font-size:.7rem;display:block;line-height:1.3}',
      '.wpop .wsl{margin:10px 0 2px;font-size:.78rem;display:flex;justify-content:space-between;color:var(--gm)}.wpop .wsl b{color:var(--gt)}.wpop input[type=range]{width:100%;accent-color:var(--ac)}',
      '.wpop .wtg{display:flex;align-items:center;gap:10px;padding:9px 4px;border-top:1px solid var(--gl);font-size:.86rem;cursor:pointer}.wpop .wtg input{width:18px;height:18px;accent-color:var(--ac)}.wpop .wtg span{flex:1}',
      '.wpop .wbr{display:flex;gap:8px;margin-top:10px}.wpop .wbr button{flex:1;padding:10px;border-radius:12px;background:var(--in);border:1px solid var(--gl);font-weight:700;font-size:.8rem;color:var(--gt)}.wpop .wbr button.p{background:var(--ac);color:#fff;border:0}',
      '.wbn,.whint{position:absolute;left:50%;transform:translateX(-50%);z-index:6;pointer-events:none;text-align:center;border-radius:14px;padding:9px 16px;font-size:.82rem;font-weight:600;max-width:calc(100% - 28px);opacity:0;transition:opacity .3s;color:var(--gt)}.wbn.on,.whint.on{opacity:1}',
      '.wbn{top:calc(78px + env(safe-area-inset-top,0px))}.whint{bottom:calc(84px + env(safe-area-inset-bottom,0px));background:#10b981;color:#fff;box-shadow:0 8px 24px rgba(16,185,129,.4)}',
      '.wspec{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:5;display:none;align-items:center;gap:4px;padding:5px;max-width:calc(100% - 20px);color:var(--gt)}.wspec.on{display:flex}.wspec button{width:44px;height:44px;border-radius:12px;background:var(--in);font-size:1rem;color:var(--gt)}.wspec div{min-width:150px;max-width:260px;padding:0 10px;text-align:center;font-size:.82rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wspec small{display:block;font-weight:500;color:var(--gm);font-size:.64rem}',
      '.whud{position:absolute;left:10px;top:calc(130px + env(safe-area-inset-top,0px));z-index:5;display:none;padding:10px 12px;font:600 .72rem/1.55 ui-monospace,Menlo,Consolas,monospace;white-space:pre;color:var(--gt);pointer-events:none}.whud.on{display:block}',
      '.wjoy{position:absolute;left:22px;bottom:calc(98px + env(safe-area-inset-bottom,0px));width:118px;height:118px;border-radius:50%;z-index:5;display:none;touch-action:none;background:rgba(15,23,42,.28);border:2px solid rgba(255,255,255,.35);backdrop-filter:blur(4px);pointer-events:auto}.wjoy.on{display:block}.wjoy i{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 4px 14px rgba(0,0,0,.35)}',
      '.wvb{display:none!important}#wd.cam-v .wvb{display:grid!important}.wsf{display:none!important}#wd.cam-w .wsf{display:grid!important}',
      '@media(max-width:1000px){.wpop{left:10px;right:10px;width:auto;max-height:64%}.wspec div{min-width:110px}}'
    ].join(''); document.head.appendChild(s);
  }

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  var camMenu, uiMenu, bn, hintEl, spec, hud, joy, knob, bnT = 0, mnBtns = {};

  function apply() {
    OFF.forEach(function (k) { ui[k] = 0; });
    UIK.forEach(function (k) { WD.classList.toggle('h-' + k, !ui[k]); });
    WD.classList.toggle('cam-x', V.cam !== 'orbit'); WD.classList.toggle('cam-w', V.cam === 'walk'); WD.classList.toggle('cam-v', V.cam === 'free');
    Object.keys(mnBtns).forEach(function (id) { var p = WD.querySelector('#' + id); if (p) p.classList.toggle('mn', !!ui.mn[id]); });
  }

  function banner(txt, ms) { bn.textContent = txt; bn.classList.add('on'); clearTimeout(bnT); bnT = setTimeout(function () { bn.classList.remove('on'); }, ms || 4200); }
  function help(c) {
    var t = {
      walk: coarse ? '🚶 จอยซ้ายเดิน · ลากที่ฉากเพื่อมอง · 🙂 ดูหน้าตัวเอง · เดินเข้าประตู/ขึ้นบันไดได้' : '🚶 WASD เดิน · ลากเมาส์มอง · Shift วิ่ง · V บุคคลที่ 3 · X ดูหน้าตัวเอง · เดินเข้าประตู/ขึ้นบันไดได้ · Esc กลับ',
      free: coarse ? '🕊️ จอยซ้ายบิน · ลากเพื่อมอง · ปุ่ม ▲▼ ขึ้น/ลง · ปรับความเร็วในเมนูกล้อง' : '🕊️ WASD บิน · Q/E ลง/ขึ้น · ลากเมาส์มอง · Shift เร็ว · ล้อเมาส์ = ความเร็ว · Esc กลับ'
    }; if (t[c]) banner(t[c], 5200);
  }

  function menuCam() {
    var h = '<h3>🎥 มุมกล้อง<button data-x="1" aria-label="ปิด">✕</button></h3>';
    MODES.forEach(function (m) { h += '<button class="wcr' + (V.cam === m[0] ? ' on' : '') + '" data-c="' + m[0] + '"><i>' + m[1] + '</i><span><b>' + m[2] + '</b><small>' + m[3] + '</small></span></button>'; });
    h += '<div class="wsl"><span>ความเร็วเคลื่อนที่</span><b id="cv1">' + Math.round(CAM.spd) + '</b></div><input type="range" id="cs1" min="3" max="60" step="1" value="' + CAM.spd + '">' +
      '<div class="wsl"><span>มุมกว้าง (FOV)</span><b id="cv2">' + Math.round(CAM.fov) + '°</b></div><input type="range" id="cs2" min="40" max="105" step="1" value="' + CAM.fov + '">' +
      '<div class="wsl"><span>ความไวการมอง</span><b id="cv3">' + CAM.sens.toFixed(1) + '×</b></div><input type="range" id="cs3" min="0.4" max="2.5" step="0.1" value="' + CAM.sens + '">' +
      '<label class="wtg"><span>👤 มุมมองบุคคลที่ 3 (เห็นตัวละครตัวเอง)</span><input type="checkbox" id="cs4"' + (CAM.third ? ' checked' : '') + '></label>' +
      '<label class="wtg"><span>🙂 ดูหน้าตัวเอง (กล้องหันมาด้านหน้า)</span><input type="checkbox" id="cs5"' + (CAM.selfie ? ' checked' : '') + '></label>' +
      '<div class="wbr"><button id="cs6">รีเซ็ตค่ากล้อง</button><button class="p" data-c="orbit">กลับมุมสูง</button></div>';
    camMenu.innerHTML = h;
    var q = function (s) { return camMenu.querySelector(s); };
    q('#cs1').oninput = function () { CAM.spd = +this.value; q('#cv1').textContent = Math.round(CAM.spd); W.camSave(); };
    q('#cs2').oninput = function () { CAM.fov = +this.value; q('#cv2').textContent = Math.round(CAM.fov) + '°'; W.camSave(); };
    q('#cs3').oninput = function () { CAM.sens = +this.value; q('#cv3').textContent = CAM.sens.toFixed(1) + '×'; W.camSave(); };
    q('#cs4').onchange = function () { CAM.third = this.checked; if (!this.checked) CAM.selfie = false; W.camSave(); menuCam(); };
    q('#cs5').onchange = function () { W.camSelfie(this.checked); };
    q('#cs6').onclick = function () { CAM.spd = 14; CAM.fov = 68; CAM.sens = 1; CAM.third = false; CAM.selfie = false; W.camSave(); menuCam(); };
  }
  function menuUI() {
    var h = '<h3>👁 แสดง / ซ่อนกล่อง<button data-x="1" aria-label="ปิด">✕</button></h3>';
    MK.forEach(function (k) { h += '<label class="wtg"><span>' + UL[k] + '</span><input type="checkbox" data-u="' + k + '"' + (ui[k] ? ' checked' : '') + '></label>'; });
    h += '<div class="wbr"><button data-z="clean">' + (clean ? '↩︎ คืนค่า' : '🧼 โหมดโล่ง (ซ่อนทั้งหมด)') + '</button><button class="p" data-z="all">แสดงทั้งหมด</button></div>' +
      '<div class="wsl" style="margin-top:12px"><span>เคล็ดลับ: กด <b>–</b> ที่มุมกล่องเพื่อย่อ · แตะแถบเล็กที่ขอบล่างเพื่อพับ/เปิดแถบปุ่ม · กด H เพื่อโหมดโล่ง</span></div>';
    uiMenu.innerHTML = h;
    uiMenu.querySelectorAll('input[data-u]').forEach(function (i) { i.onchange = function () { ui[i.dataset.u] = i.checked ? 1 : 0; clean = null; save(); apply(); }; });
    uiMenu.querySelector('[data-z=clean]').onclick = toggleClean;
    uiMenu.querySelector('[data-z=all]').onclick = function () { MK.forEach(function (k) { ui[k] = 1; }); ui.mn = {}; clean = null; save(); apply(); menuUI(); };
  }
  function toggleClean() {
    if (clean) { UIK.forEach(function (k) { ui[k] = clean[k]; }); clean = null; }
    else { clean = {}; UIK.forEach(function (k) { clean[k] = ui[k]; if (k !== 'tags' && k !== 'hud') ui[k] = 0; }); }
    save(); apply(); menuUI();
  }
  function open(m) { var o = m.classList.contains('on'); camMenu.classList.remove('on'); uiMenu.classList.remove('on'); if (!o) { if (m === camMenu) menuCam(); else menuUI(); m.classList.add('on'); } }

  function init() {
    WD = document.getElementById('wd'); if (!WD) return false; if (WD.querySelector('.wpop')) return true;
    css();
    var ctl = WD.querySelector('#wctl');
    if (ctl) {
      Array.prototype.forEach.call(ctl.children, function (c) { c.classList.add('zr'); });
      var hr = el('hr'), bc = el('button', '', '🎥'), bu = el('button', '', '👁'), bUp = el('button', 'wvb', '▲'), bDn = el('button', 'wvb', '▼');
      bc.setAttribute('aria-label', 'มุมกล้อง'); bu.setAttribute('aria-label', 'แสดง/ซ่อนกล่อง'); bc.style.fontSize = bu.style.fontSize = bUp.style.fontSize = bDn.style.fontSize = '1.15rem';
      var bs = el('button', 'wsf', '🙂'); bs.setAttribute('aria-label', 'ดูหน้าตัวเอง'); bs.style.fontSize = '1.15rem'; bs.onclick = function () { W.camSelfie(); };
      ctl.appendChild(hr); ctl.appendChild(bUp); ctl.appendChild(bDn); ctl.appendChild(bs); ctl.appendChild(bc); ctl.appendChild(bu);
      bc.onclick = function () { open(camMenu); }; bu.onclick = function () { open(uiMenu); };
      [[bUp, 1], [bDn, -1]].forEach(function (a) {
        var on = function (e) { e.preventDefault(); W.camVert(a[1]); }, off = function () { W.camVert(0); };
        a[0].addEventListener('pointerdown', on); a[0].addEventListener('pointerup', off); a[0].addEventListener('pointerleave', off); a[0].addEventListener('pointercancel', off);
      });
    }
    camMenu = el('section', 'wpop wg'); uiMenu = el('section', 'wpop wg'); bn = el('div', 'wbn wg'); hintEl = el('div', 'whint'); 
    joy = el('div', 'wjoy', '<i></i>'); knob = joy.firstChild;
    var dh = el('button', 'wdh'); dh.setAttribute('aria-label', 'พับ/เปิดแถบปุ่มด้านล่าง');
    [camMenu, uiMenu, bn, hintEl, joy, dh].forEach(function (e) { WD.appendChild(e); e.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); }); });
    dh.onclick = function () { ui.dock = ui.dock ? 0 : 1; clean = null; save(); apply(); };
    [camMenu, uiMenu].forEach(function (m) {
      m.addEventListener('click', function (e) {
        var t = e.target.closest('button'); if (!t) return;
        if (t.dataset.x) m.classList.remove('on');
        if (t.dataset.c) { W.setCam(t.dataset.c); m.classList.remove('on'); }
      });
    });

    /* จอยสติ๊ก */
    var jid = null, R = 44;
    function jm(e) { var r = joy.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; W.camAxis(-dy / R, dx / R); }
    joy.addEventListener('pointerdown', function (e) { jid = e.pointerId; try { joy.setPointerCapture(jid); } catch (x) {} jm(e); e.preventDefault(); });
    joy.addEventListener('pointermove', function (e) { if (e.pointerId === jid) jm(e); });
    var je = function (e) { if (e.pointerId === jid) { jid = null; knob.style.transform = ''; W.camAxis(0, 0); } };
    joy.addEventListener('pointerup', je); joy.addEventListener('pointercancel', je);

    /* ปุ่มย่อมุมกล่อง */
    ['wleft', 'wright', 'wact', 'wpan'].forEach(function (id) {
      var b = el('button', 'wmn', ui.mn[id] ? '+' : '–'); b.setAttribute('aria-label', 'ย่อ/ขยายกล่อง'); WD.appendChild(b); mnBtns[id] = b;
      b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      b.onclick = function () { ui.mn[id] = ui.mn[id] ? 0 : 1; save(); apply(); b.textContent = ui.mn[id] ? '+' : '–'; };
    });

    /* callbacks จากกล้อง */
    W.cb.cam = function (c) {
      if (c !== 'orbit' && !snap) { snap = {}; UIK.forEach(function (k) { snap[k] = ui[k]; }); ['kpi', 'act', 'left', 'right', 'tabs'].forEach(function (k) { ui[k] = 0; }); }
      if (c === 'orbit' && snap) { UIK.forEach(function (k) { ui[k] = snap[k]; }); snap = null; }
      apply(); help(c);
      var cb = document.querySelector('#wd .wctl'); if (cb) cb.dataset.cam = c; hintEl.classList.remove('on'); W.cb.cfg();
    };
    W.cb.hint = function (t) { if (t) { hintEl.textContent = t; hintEl.classList.add('on'); } else hintEl.classList.remove('on'); };
    W.cb.cfg = function () { if (camMenu.classList.contains('on')) menuCam(); };

    /* คีย์ลัด */
    window.addEventListener('keydown', function (e) {
      var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') || e.ctrlKey || e.metaKey || e.altKey) return;
      var k = e.key.toLowerCase(); if (k === 'h') toggleClean(); if (k === 'c') open(camMenu);
    });

    /* ซิงก์ตำแหน่ง/การแสดงผลเป็นระยะ */
    setInterval(function () {
      var wr = WD.getBoundingClientRect();
      Object.keys(mnBtns).forEach(function (id) {
        var p = WD.querySelector('#' + id), b = mnBtns[id]; if (!p) return; var cs = getComputedStyle(p), r = p.getBoundingClientRect(), vis = cs.display !== 'none' && r.width > 20 && r.height > 20 && !WD.classList.contains('h-' + id.replace('w', ''));
        if (id === 'wpan') vis = vis && p.classList.contains('on');
        b.style.display = vis ? 'grid' : 'none'; if (vis) { b.style.left = (r.right - wr.left - (id === 'wpan' ? 70 : 36)) + 'px'; b.style.top = (r.top - wr.top + 8) + 'px'; }
      });
      var chatOn = WD.querySelector('#wchat') && WD.querySelector('#wchat').classList.contains('on');
      joy.classList.toggle('on', (V.cam === 'walk' || V.cam === 'free') && (coarse || innerWidth <= 1000) && !chatOn);
    }, 220);
    apply(); return true;
  }
  var tm = setInterval(function () { if (init()) clearInterval(tm); }, 150);
})();
