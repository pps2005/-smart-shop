/* ============================================================
   world-cam.js — ระบบกล้องหลายโหมด (ภายนอก + ภายใน)
   orbit  = มุมสูงแบบเดิม (ดีฟอลต์)
   walk   = Free Roam · เดินระดับสายตา (บุคคลที่ 1 / 3) เดินเข้า-ออกตึก เดินหากันได้
   free   = Free Camera · บินอิสระทุกทิศ
   spec   = Spectator · บินวนดู / ตามคน-ตึก-ห้อง (◀ ▶ เปลี่ยนเป้าหมาย)
   debug  = Debug Camera · กล้องอิสระเร็ว + HUD ข้อมูล + wireframe
   ============================================================ */
(function () {
  'use strict';
  var W = window.SSW; if (!W) return;
  var V = W.V, T = null;
  var CAM = W.CAM = { spd: 14, fov: 68, sens: 1, third: false };
  try { var sv = JSON.parse(localStorage.getItem('ss_cam') || '{}'); ['spd', 'fov', 'sens'].forEach(function (k) { if (typeof sv[k] === 'number') CAM[k] = sv[k]; }); CAM.third = !!sv.third; } catch (e) {}
  W.camSave = function () { try { localStorage.setItem('ss_cam', JSON.stringify(CAM)); } catch (e) {} };
  V.cam = 'orbit';

  var EYE_E = 2.65, EYE_I = 2.4, P = { x: 0, y: EYE_E, z: 37, yaw: 0, pitch: 0 };
  var K = {}, IN = { f: 0, s: 0, u: 0 }, moving = false, lastB = 'sec', cool = 0, busy = false, hint = '', wire = false, wmat = null;
  var PLE = null, spI = 0, spA = .6, spD = 0, spH = .5, spPos = null, spList = [], spMode = '', fps = 60, ldrag = 0, fog = null;
  W.camBusy = function () { return busy; };
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- ชน/ขอบเขต ---------- */
  function extBlocked(x, z, R) {
    if (Math.abs(x) > 95 || Math.abs(z) > 95) return true;
    for (var i = 0; i < W.D.length; i++) { var d = W.D[i]; if (Math.abs(x - d.x) < d.w / 2 + R && Math.abs(z - d.z) < d.p / 2 + R) return true; }
    return false;
  }
  function blocked(x, z) { return V.mode === 'ext' ? extBlocked(x, z, .7) : W.intBlocked(x, z, .55); }

  /* ---------- วางตัว / สลับโหมด ---------- */
  function say(h) { if (h !== hint) { hint = h; if (W.cb.hint) W.cb.hint(h); } }
  function spawn(m, room) {
    var d, free = V.cam === 'free' || V.cam === 'debug';
    if (m === 'int') {
      var k = room && room !== 'all' ? room : lastB || 'sec'; d = W.BD[k]; lastB = k;
      P.x = d.rx; P.z = 0; P.yaw = d.rc[1] ? Math.PI : 0; P.y = free ? 7 : EYE_I; P.pitch = free ? -.42 : 0;
      V.room = k; if (W.intFocus) W.intFocus(k, true); if (W.cb.room) W.cb.room(k);
    } else {
      d = W.BD[room && room !== 'all' ? room : lastB || 'sec']; lastB = d.k;
      P.x = d.x; P.z = d.z + d.p / 2 + (free ? 18 : 4); P.yaw = Math.PI; P.y = free ? 14 : EYE_E; P.pitch = free ? -.3 : 0;
      if (free) P.yaw = 0;
    }
    cool = 1.6; busy = false; say('');
  }
  W.spawn = spawn;

  function fromOrbit(c) {
    var free = c === 'free' || c === 'debug';
    if (V.mode === 'ext') {
      if (c === 'walk') { var k = V.sel || 'sec'; lastB = k; var d = W.BD[k]; P.x = d.x; P.z = d.z + d.p / 2 + 6; P.yaw = 0; P.y = EYE_E; P.pitch = 0; }
      else if (free) { P.x = V.cx + Math.sin(V.th) * 70; P.z = V.cz + Math.cos(V.th) * 70; P.y = 55; P.yaw = V.th; P.pitch = -.67; }
    } else {
      if (c === 'walk') { spawn('int', V.room); return; }
      if (free && W.pc) { var e = new T.Euler().setFromQuaternion(W.pc.quaternion, 'YXZ'); P.x = W.pc.position.x; P.y = W.pc.position.y; P.z = W.pc.position.z; P.yaw = e.y; P.pitch = e.x; }
    }
  }
  W.setCam = function (c) {
    T = window.THREE; var from = V.cam; if (c === from) return;
    V.cam = c; busy = false; K = {}; IN.f = IN.s = IN.u = 0; spMode = '';
    if (from === 'orbit') fromOrbit(c);
    else if (c === 'walk') { P.y = V.mode === 'ext' ? EYE_E : EYE_I; P.pitch = clamp(P.pitch, -.6, .6); if (blocked(P.x, P.z)) spawn(V.mode, V.room); }
    if (c === 'orbit') { if (W.EXS) { W.EXS.overrideMaterial = null; W.EXS.fog = null; } if (W.INT) { W.INT.scene.overrideMaterial = null; W.INT.fpOnly.forEach(function (m) { m.visible = false; }); } if (PLE) PLE.visible = false; if (W.PLI) W.PLI.visible = false; say(''); if (V.mode === 'int' && W.intFocus) W.intFocus(V.room, true); }
    if (W.cb.cam) W.cb.cam(c);
  };
  W.camWire = function (on) { wire = on == null ? !wire : !!on; return wire; };

  /* ---------- Spectator ---------- */
  function buildTargets() {
    var L = [], I = V.mode === 'int';
    if (!I) {
      L.push({ n: 'ภาพรวมเมือง', p: function () { return [0, 1.5, 8]; } });
      W.D.forEach(function (d) { L.push({ n: d.n, p: function () { return [d.x, 3, d.z]; } }); });
      if (W.EX && W.EX.sec) L.push({ n: 'น้องฟ้า (เลขา)', p: function () { var q = W.EX.sec.position; return [q.x, 1.8, q.z]; } });
      var i = 0; (W.EX ? W.EX.ag : []).forEach(function (n) { if (n.k === 'ppl') { i++; L.push({ n: 'คนเดินถนน ' + i, p: function () { var q = n.g.position; return [q.x, 1.8, q.z]; } }); } });
    } else {
      L.push({ n: 'ออฟฟิศทั้งหมด', p: function () { return [0, 1.5, 0]; } });
      W.D.forEach(function (d) { L.push({ n: d.n, p: function () { return [d.rx, 1.5, d.rz]; } }); });
      ((W.INT && W.INT.npcs) || []).forEach(function (n) { L.push({ n: (n.name || 'พนักงาน') + (n.role ? ' · ' + n.role : ''), p: function () { var q = n.g.position; return [q.x, 1.6, q.z]; } }); });
    }
    return L;
  }
  W.camNext = function (s) { if (!spList.length) return; spI = (spI + (s || 1) + spList.length) % spList.length; spPos = null; if (W.cb.spec) W.cb.spec(spList[spI].n); };
  W.camTarget = function () { return spList[spI] ? spList[spI].n : ''; };

  /* ---------- อินพุต ---------- */
  W.camLook = function (dx, dy) {
    if (V.cam === 'spec') { spA -= dx * .006 * CAM.sens; spH = clamp(spH + dy * .004 * CAM.sens, .08, 1.3); ldrag = 1.5; return; }
    var s = .0042 * CAM.sens; P.yaw -= dx * s; P.pitch = clamp(P.pitch - dy * s, -1.5, 1.5);
  };
  W.camWheel = function (dy) {
    if (V.cam === 'spec') { spD = clamp(spD * Math.exp(dy * .0012), 4, 110); return; }
    if (V.cam === 'free' || V.cam === 'debug') { CAM.spd = clamp(CAM.spd * Math.exp(-dy * .0012), 3, 60); if (W.cb.cfg) W.cb.cfg(); }
  };
  W.camAxis = function (f, s) { IN.f = f; IN.s = s; };
  W.camVert = function (u) { IN.u = u; };
  function typing(e) { var t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); }
  window.addEventListener('keydown', function (e) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (V.cam === 'orbit') return;
    if (k === 'escape') { W.setCam('orbit'); return; }
    if (V.cam === 'spec') { if (k === 'arrowleft' || k === 'a') W.camNext(-1); if (k === 'arrowright' || k === 'd') W.camNext(1); return; }
    if (k === 'f' && V.cam === 'debug') { W.camWire(); if (W.cb.cfg) W.cb.cfg(); return; }
    if (k === 'v') { CAM.third = !CAM.third; W.camSave(); if (W.cb.cfg) W.cb.cfg(); return; }
    K[k] = 1; if (k === 'shift') K.shift = 1; if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { var k = e.key.toLowerCase(); delete K[k]; if (k === 'shift') delete K.shift; });
  window.addEventListener('blur', function () { K = {}; });

  /* ---------- ลูปกล้อง (เรียกจาก frame) ---------- */
  W.camStep = function (dt, t, w, h) {
    T = window.THREE; var pc = W.pc, I = V.mode === 'int', sc = I ? W.INT.scene : W.EXS; if (!sc) return;
    fps += (1 / Math.max(dt, .001) - fps) * .08; cool = Math.max(0, cool - dt); ldrag = Math.max(0, ldrag - dt);
    if (pc.view && pc.view.enabled) pc.clearViewOffset();
    if (pc.fov !== CAM.fov) { pc.fov = CAM.fov; pc.updateProjectionMatrix(); }
    if (!wmat) wmat = new T.MeshBasicMaterial({ color: 0x7dd3fc, wireframe: true });
    if (W.INT && W.INT.fpOnly) { var fv = I && V.cam === 'walk'; W.INT.fpOnly.forEach(function (m) { m.visible = fv; }); }
    var other = I ? W.EXS : W.INT.scene; if (other && other.overrideMaterial) other.overrideMaterial = null;
    sc.overrideMaterial = V.cam === 'debug' && wire ? wmat : null;
    if (!I) { if (!fog) fog = new T.Fog(0xe9eef7, 110, 260); sc.fog = V.cam === 'spec' || V.cam === 'free' || V.cam === 'debug' ? null : fog; if (sc.background && sc.background.isColor) fog.color.copy(sc.background); }
    if (!PLE && W.EXS) { PLE = W.mkChar({ hair: 0x7cc3ff, top: 0x93c5fd, f: 1, long: 1, bow: 0x60a5fa, s: .86 }); PLE.visible = false; W.EXS.add(PLE); }
    var av = I ? W.PLI : PLE; if (PLE && (I || V.cam !== 'walk' || !CAM.third)) PLE.visible = false; if (W.PLI && (!I || V.cam !== 'walk' || !CAM.third)) W.PLI.visible = false;

    if (V.cam === 'spec') { spec(dt, t, I, pc); return; }

    /* เคลื่อนที่ */
    var walk = V.cam === 'walk', f = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0) + IN.f, s = (K.d ? 1 : 0) - (K.a ? 1 : 0) + IN.s, u = (K.e || K[' '] ? 1 : 0) - (K.q || K.control ? 1 : 0) + IN.u;
    if (K.arrowleft) P.yaw += 1.9 * dt; if (K.arrowright) P.yaw -= 1.9 * dt;
    f = clamp(f, -1, 1); s = clamp(s, -1, 1); u = clamp(u, -1, 1);
    var run = K.shift ? (walk ? 1.8 : 2.6) : 1, base = walk ? CAM.spd * .5 : V.cam === 'debug' ? CAM.spd * 2.2 : CAM.spd, sp = base * run;
    var len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
    var cp = walk ? 1 : Math.cos(P.pitch), fx = -Math.sin(P.yaw) * cp, fz = -Math.cos(P.yaw) * cp, fy = walk ? 0 : Math.sin(P.pitch), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    moving = !busy && (Math.abs(f) + Math.abs(s) + Math.abs(u) > .05);
    if (!busy) {
      var dx = (fx * f + rx * s) * sp * dt, dz = (fz * f + rz * s) * sp * dt, dy = (fy * f + u) * sp * dt * (walk ? 0 : 1);
      if (walk) { if (!blocked(P.x + dx, P.z)) P.x += dx; if (!blocked(P.x, P.z + dz)) P.z += dz; P.y = I ? EYE_I : EYE_E; }
      else { P.x += dx; P.z += dz; P.y += dy; if (I) { P.x = clamp(P.x, -42, 42); P.z = clamp(P.z, -24, 24); P.y = clamp(P.y, .6, 16); } else { P.x = clamp(P.x, -110, 110); P.z = clamp(P.z, -110, 110); P.y = clamp(P.y, .6, 140); } }
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
        var ex = Math.hypot(P.x, P.z);
        if (Math.abs(P.x) < 2.5 && Math.abs(P.z) < 1.8) { if (cool <= 0) { busy = true; W.setMode('ext'); } }
        else if (ex < 9) txt = '🚪 ทางออก — เดินเข้าแผ่นสีเขียวเพื่อออกไปข้างนอก';
        var rk = W.roomAt(P.x, P.z) || 'all'; if (rk !== V.room && !busy) { V.room = rk; if (W.intFocus) W.intFocus(rk); if (W.cb.room) W.cb.room(rk); }
        ((W.INT && W.INT.npcs) || []).forEach(function (n) { if (n.sec && Math.hypot(n.g.position.x - P.x, n.g.position.z - P.z) < 7) txt = '💬 แตะที่น้องฟ้าเพื่อคุยกับเลขาได้เลย'; });
      }
    }
    say(txt);

    /* วางกล้อง */
    var third = walk && CAM.third, cpitch = Math.cos(P.pitch), dirx = -Math.sin(P.yaw) * cpitch, diry = Math.sin(P.pitch), dirz = -Math.cos(P.yaw) * cpitch;
    if (third) { var D = 4.6; pc.position.set(P.x - dirx * D, Math.max(.7, P.y - diry * D + .6), P.z - dirz * D); }
    else pc.position.set(P.x, P.y, P.z);
    pc.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    if (av) {
      av.visible = third; av.position.set(P.x, I ? 0 : .25, P.z); av.rotation.y = P.yaw + Math.PI;
      if (third) { W.pose(av, t, moving ? 'walk' : 'idle'); if (moving) av.position.y += Math.abs(Math.sin(t * 9)) * .05; }
    }
    /* ป้ายชื่อ/ตึกหันหาผู้ชม */
    if (!I) W.D.forEach(function (d) { d.sign.rotation.y = Math.atan2(pc.position.x - d.x, pc.position.z - d.z); });
  };

  function spec(dt, t, I, pc) {
    var key = I ? 'i' : 'e'; if (spMode !== key) { spMode = key; spList = buildTargets(); spI = 0; spD = I ? 13 : 38; spPos = null; if (W.cb.spec) W.cb.spec(spList[0].n); }
    var tg = spList[spI].p(); if (!spPos) spPos = [tg[0], tg[1], tg[2]]; var k = Math.min(1, dt * 3);
    spPos[0] += (tg[0] - spPos[0]) * k; spPos[1] += (tg[1] - spPos[1]) * k; spPos[2] += (tg[2] - spPos[2]) * k;
    if (!ldrag) spA += dt * .13;
    var dd = spD * (spI === 0 ? (I ? 1.5 : 2.3) : 1), cp = Math.cos(spH), x = spPos[0] + Math.sin(spA) * cp * dd, y = spPos[1] + Math.sin(spH) * dd + 1, z = spPos[2] + Math.cos(spA) * cp * dd;
    if (I) { x = clamp(x, -44, 44); z = clamp(z, -25, 25); y = clamp(y, 1.2, 16); }
    pc.position.set(x, y, z); pc.lookAt(spPos[0], spPos[1], spPos[2]);
    var e = new T.Euler().setFromQuaternion(pc.quaternion, 'YXZ'); P.x = x; P.y = y; P.z = z; P.yaw = e.y; P.pitch = e.x; moving = false; say('');
    if (!I) W.D.forEach(function (d) { d.sign.rotation.y = Math.atan2(x - d.x, z - d.z); });
  }

  var ofr = W.focusRoom, tele = false;
  W.focusRoom = function (k) { ofr(k); if (V.cam === 'walk' && V.mode === 'int' && k && k !== 'all' && !tele && !busy) { tele = true; spawn('int', k); tele = false; } };

  W.camInfo = function () {
    var r = W.rd && W.rd.info ? W.rd.info.render : { calls: 0, triangles: 0 };
    return { cam: V.cam, mode: V.mode, x: P.x, y: P.y, z: P.z, yaw: P.yaw, pitch: P.pitch, fps: fps, calls: r.calls, tris: r.triangles, room: V.mode === 'int' ? (W.roomAt(P.x, P.z) || 'ทางเดิน') : '-', wire: wire, fov: CAM.fov, spd: CAM.spd };
  };
})();
