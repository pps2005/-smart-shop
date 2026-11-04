/* ============================================================
   world-cam.js — ระบบกล้องหลายโหมด (ภายนอก + ภายใน)
   orbit  = มุมสูงแบบเดิม (ดีฟอลต์)
   walk   = Free Roam · เดินระดับสายตา (บุคคลที่ 1 / 3 / ดูหน้าตัวเอง)
            เดินเข้า-ออกตึก เดินระหว่างห้อง ขึ้นบันไดไปชั้น 2
   free   = Free Camera · บินอิสระทุกทิศ
   ============================================================ */
(function () {
  'use strict';
  var W = window.SSW; if (!W) return;
  var V = W.V, T = null;
  var CAM = W.CAM = { spd: 14, fov: 68, sens: 1, third: false, selfie: false };
  try { var sv = JSON.parse(localStorage.getItem('ss_cam') || '{}'); ['spd', 'fov', 'sens'].forEach(function (k) { if (typeof sv[k] === 'number') CAM[k] = sv[k]; }); CAM.third = !!sv.third; } catch (e) {}
  W.camSave = function () { try { localStorage.setItem('ss_cam', JSON.stringify({ spd: CAM.spd, fov: CAM.fov, sens: CAM.sens, third: CAM.third })); } catch (e) {} };
  V.cam = 'orbit';

  var EYE_E = 2.65, EYE_I = 2.4, P = { x: 0, y: EYE_E, z: 37, g: 0, yaw: 0, pitch: 0 };
  var K = {}, IN = { f: 0, s: 0, u: 0 }, moving = false, lastB = 'sec', cool = 0, busy = false, hint = '', PLE = null, fps = 60, fog = null;
  W.camBusy = function () { return busy; };
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lvl() { return P.g > (W.PY || 4.2) * .5 ? 1 : 0; }

  /* ---------- ชน/ขอบเขต ---------- */
  function extBlocked(x, z, R) {
    if (Math.abs(x) > 95 || Math.abs(z) > 95) return true;
    for (var i = 0; i < W.D.length; i++) { var d = W.D[i]; if (Math.abs(x - d.x) < d.w / 2 + R && Math.abs(z - d.z) < d.p / 2 + R) return true; }
    return false;
  }
  function blocked(x, z) { return V.mode === 'ext' ? extBlocked(x, z, .7) : W.intBlocked(x, z, .55, lvl()); }

  /* ---------- วางตัว / สลับโหมด ---------- */
  function say(h) { if (h !== hint) { hint = h; if (W.cb.hint) W.cb.hint(h); } }
  function spawn(m, room) {
    var d, free = V.cam === 'free';
    P.g = 0;
    if (m === 'int') {
      var k = room && room !== 'all' ? room : lastB || 'sec'; d = W.BD[k]; lastB = k;
      var row1 = d.rc[1] === 1, RD = W.RD;
      P.x = row1 ? d.rx + W.DXL : d.rx; P.z = row1 ? d.rz - RD / 2 - 2.4 : d.rz + RD / 2 + 2.4; P.yaw = row1 ? Math.PI : 0;
      P.y = free ? 9 : EYE_I; P.pitch = free ? -.42 : 0;
      V.room = k; if (W.intFocus) W.intFocus(k, true); if (W.cb.room) W.cb.room(k);
    } else {
      d = W.BD[room && room !== 'all' ? room : lastB || 'sec']; lastB = d.k;
      P.x = d.x; P.z = d.z + d.p / 2 + (free ? 18 : 4); P.yaw = free ? 0 : Math.PI; P.y = free ? 14 : EYE_E; P.pitch = free ? -.3 : 0;
    }
    cool = 1.6; busy = false; say('');
  }
  W.spawn = spawn;

  function fromOrbit(c) {
    var free = c === 'free';
    if (V.mode === 'ext') {
      if (c === 'walk') { var k = V.sel || 'sec'; lastB = k; var d = W.BD[k]; P.x = d.x; P.z = d.z + d.p / 2 + 6; P.yaw = 0; P.y = EYE_E; P.pitch = 0; P.g = 0; }
      else if (free) { P.x = V.cx + Math.sin(V.th) * 70; P.z = V.cz + Math.cos(V.th) * 70; P.y = 55; P.yaw = V.th; P.pitch = -.67; }
    } else {
      if (c === 'walk') { spawn('int', V.room); return; }
      if (free && W.pc) { var e = new T.Euler().setFromQuaternion(W.pc.quaternion, 'YXZ'); P.x = W.pc.position.x; P.y = W.pc.position.y; P.z = W.pc.position.z; P.yaw = e.y; P.pitch = e.x; }
    }
  }
  W.setCam = function (c) {
    T = window.THREE; if (c !== 'orbit' && c !== 'walk' && c !== 'free') c = 'orbit';
    var from = V.cam; if (c === from) return;
    V.cam = c; busy = false; K = {}; IN.f = IN.s = IN.u = 0;
    if (from === 'orbit') fromOrbit(c);
    else if (c === 'walk') { var gnd = 0; if (V.mode === 'int') { P.g = 0; } P.y = (V.mode === 'ext' ? EYE_E : EYE_I) + gnd; P.pitch = clamp(P.pitch, -.6, .6); if (blocked(P.x, P.z)) spawn(V.mode, V.room); }
    if (c === 'orbit') { CAM.selfie = false; if (W.EXS) { W.EXS.fog = null; } if (W.INT) { W.INT.fpOnly.forEach(function (m) { m.visible = false; }); W.INT.up.visible = false; } if (PLE) PLE.visible = false; if (W.PLI) W.PLI.visible = false; say(''); if (V.mode === 'int' && W.intFocus) W.intFocus(V.room, true); }
    if (W.cb.cam) W.cb.cam(c);
  };
  /* ดูหน้าตัวเอง: เปิดบุคคลที่ 3 แล้วหมุนกล้องมาด้านหน้า */
  W.camSelfie = function (on) {
    if (V.cam !== 'walk') W.setCam('walk');
    CAM.selfie = on == null ? !CAM.selfie : !!on; if (CAM.selfie) CAM.third = true; if (W.cb.cfg) W.cb.cfg(); return CAM.selfie;
  };

  /* ---------- อินพุต ---------- */
  W.camLook = function (dx, dy) { var s = .0042 * CAM.sens; P.yaw -= dx * s; P.pitch = clamp(P.pitch - dy * s, -1.5, 1.5); };
  W.camWheel = function (dy) { if (V.cam === 'free') { CAM.spd = clamp(CAM.spd * Math.exp(-dy * .0012), 3, 60); if (W.cb.cfg) W.cb.cfg(); } };
  W.camAxis = function (f, s) { IN.f = f; IN.s = s; };
  W.camVert = function (u) { IN.u = u; };
  function typing(e) { var t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); }
  window.addEventListener('keydown', function (e) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (V.cam === 'orbit') return;
    if (k === 'escape') { W.setCam('orbit'); return; }
    if (k === 'v') { CAM.third = !CAM.third; if (!CAM.third) CAM.selfie = false; W.camSave(); if (W.cb.cfg) W.cb.cfg(); return; }
    if (k === 'x') { W.camSelfie(); return; }
    K[k] = 1; if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { delete K[e.key.toLowerCase()]; });
  window.addEventListener('blur', function () { K = {}; });

  /* ---------- ลูปกล้อง (เรียกจาก frame) ---------- */
  W.camStep = function (dt, t, w, h) {
    T = window.THREE; var pc = W.pc, I = V.mode === 'int', sc = I ? W.INT.scene : W.EXS; if (!sc) return;
    fps += (1 / Math.max(dt, .001) - fps) * .08; cool = Math.max(0, cool - dt);
    if (pc.view && pc.view.enabled) pc.clearViewOffset();
    if (pc.fov !== CAM.fov) { pc.fov = CAM.fov; pc.updateProjectionMatrix(); }
    var walk = V.cam === 'walk';
    if (W.INT) { var fv = I && walk; W.INT.fpOnly.forEach(function (m) { m.visible = fv; }); W.INT.up.visible = I; }
    if (!I) { if (!fog) fog = new T.Fog(0xe9eef7, 110, 260); sc.fog = walk ? fog : null; if (sc.background && sc.background.isColor) fog.color.copy(sc.background); }
    if (!PLE && W.EXS) { PLE = W.mkChar({ hair: 0x7cc3ff, top: 0x93c5fd, f: 1, long: 1, bow: 0x60a5fa, s: .86 }); PLE.visible = false; W.EXS.add(PLE); }
    var av = I ? W.PLI : PLE; if (PLE && (I || !walk || !CAM.third)) PLE.visible = false; if (W.PLI && (!I || !walk || !CAM.third)) W.PLI.visible = false;

    /* เคลื่อนที่ */
    var f = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0) + IN.f, s = (K.d ? 1 : 0) - (K.a ? 1 : 0) + IN.s, u = (K.e || K[' '] ? 1 : 0) - (K.q || K.control ? 1 : 0) + IN.u;
    if (K.arrowleft) P.yaw += 1.9 * dt; if (K.arrowright) P.yaw -= 1.9 * dt;
    f = clamp(f, -1, 1); s = clamp(s, -1, 1); u = clamp(u, -1, 1);
    var run = K.shift ? (walk ? 1.8 : 2.6) : 1, sp = (walk ? CAM.spd * .5 : CAM.spd) * run;
    var len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
    var cp = walk ? 1 : Math.cos(P.pitch), fx = -Math.sin(P.yaw) * cp, fz = -Math.cos(P.yaw) * cp, fy = walk ? 0 : Math.sin(P.pitch), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    moving = !busy && (Math.abs(f) + Math.abs(s) + Math.abs(u) > .05);
    if (!busy) {
      var dx = (fx * f + rx * s) * sp * dt, dz = (fz * f + rz * s) * sp * dt, dy = (fy * f + u) * sp * dt;
      if (walk) {
        if (!blocked(P.x + dx, P.z)) P.x += dx; if (!blocked(P.x, P.z + dz)) P.z += dz;
        if (I) { P.g = W.intGround(P.x, P.z, lvl()); P.y = EYE_I + P.g; } else { P.g = 0; P.y = EYE_E; }
      } else {
        P.x += dx; P.z += dz; P.y += dy;
        if (I) { P.x = clamp(P.x, -58, 58); P.z = clamp(P.z, -30, 30); P.y = clamp(P.y, .6, 22); } else { P.x = clamp(P.x, -110, 110); P.z = clamp(P.z, -110, 110); P.y = clamp(P.y, .6, 140); }
      }
    }

    /* เดินเข้า-ออกตึก + ข้อความแนะนำ */
    var txt = '';
    if (walk && !busy) {
      if (!I) {
        W.D.forEach(function (d) {
          var fz2 = d.z + d.p / 2, ax = Math.abs(P.x - d.x);
          if (ax < 2.6 && P.z > fz2 && P.z < fz2 + 9) { txt = '🚪 ' + d.n + ' — เดินเข้าประตูเพื่อเข้าไปข้างใน'; if (cool <= 0 && P.z < fz2 + 1.4 && ax < 2.3) { busy = true; lastB = d.k; W.setMode('int', d.k); } }
        });
      } else {
        var lv = lvl();
        if (lv === 0 && Math.abs(P.x) < 3.3 && Math.abs(P.z) < 2.1) { if (cool <= 0) { busy = true; W.setMode('ext'); } }
        else if (lv === 0 && Math.hypot(P.x, P.z) < 12) txt = '🚪 ทางออก — เดินเข้าแผ่นสีเขียวเพื่อออกไปข้างนอก';
        var ax2 = Math.abs(P.x); if (lv === 0 && ax2 > 10 && ax2 < 26 && Math.abs(P.z) < 5) txt = '🪜 บันไดขึ้นชั้น 2 (เลานจ์/ห้องสมุด) — เดินไปตามบันได'; if (lv === 1) txt = '🛋️ ชั้น 2 · ' + (P.x > 0 ? 'เลานจ์' : 'ห้องสมุด') + ' — เดินลงบันไดกลับชั้น 1';
        var rk = lv === 1 ? 'all' : (W.roomAt(P.x, P.z) || 'all'); if (rk !== V.room && !busy) { V.room = rk; if (W.intFocus) W.intFocus(rk); if (W.cb.room) W.cb.room(rk); }
        if (lv === 0) ((W.INT && W.INT.npcs) || []).forEach(function (n) { if (n.sec && Math.hypot(n.g.position.x - P.x, n.g.position.z - P.z) < 8) txt = '💬 แตะที่น้องฟ้าเพื่อคุยกับเลขาได้เลย'; });
      }
    }
    say(txt);

    /* วางกล้อง */
    var third = walk && CAM.third, cpitch = Math.cos(P.pitch), dirx = -Math.sin(P.yaw) * cpitch, diry = Math.sin(P.pitch), dirz = -Math.cos(P.yaw) * cpitch;
    if (third && CAM.selfie) {
      /* กล้องอยู่ด้านหน้าตัวละคร มองกลับมาที่ใบหน้า */
      var D = 4.2, hx = P.x, hy = P.y - .45, hz = P.z;
      pc.position.set(hx - Math.sin(P.yaw) * D * Math.cos(.15 + P.pitch * .5), Math.max(.8, hy + .5 + Math.sin(.15 + P.pitch * .5) * D * .3), hz - Math.cos(P.yaw) * D * Math.cos(.15 + P.pitch * .5)); pc.lookAt(hx, hy, hz);
    } else {
      if (third) { var D2 = 4.6; pc.position.set(P.x - dirx * D2, Math.max(.7, P.y - diry * D2 + .6), P.z - dirz * D2); }
      else pc.position.set(P.x, P.y, P.z);
      pc.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    }
    if (av) {
      av.visible = third; av.position.set(P.x, (I ? P.g : .25), P.z); av.rotation.y = P.yaw + Math.PI;
      if (third) { W.pose(av, t, moving ? 'walk' : 'idle'); if (moving) av.position.y += Math.abs(Math.sin(t * 9)) * .05; }
    }
    if (!I) W.D.forEach(function (d) { d.sign.rotation.y = Math.atan2(pc.position.x - d.x, pc.position.z - d.z); });
  };

  var ofr = W.focusRoom, tele = false;
  W.focusRoom = function (k) { ofr(k); if (V.cam === 'walk' && V.mode === 'int' && k && k !== 'all' && !tele && !busy) { tele = true; spawn('int', k); tele = false; } };

  W.camPut = function (x, z, yaw, g, pitch) { P.x = x; P.z = z; P.yaw = yaw || 0; P.g = g || 0; P.pitch = pitch || 0; P.y = (V.mode === 'int' ? EYE_I : EYE_E) + P.g; };
  W.camInfo = function () { return { cam: V.cam, mode: V.mode, x: P.x, y: P.y, z: P.z, g: P.g, yaw: P.yaw, pitch: P.pitch, fps: fps, fov: CAM.fov, spd: CAM.spd, lv: lvl() }; };
})();
