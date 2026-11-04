// fah-2d.js — น้องฟ้าแบบ 2D: ใช้รูปตัวละครจริง แล้วทำให้มีชีวิตด้วย canvas
// กะพริบตา · ขยับปากตามเสียง · หายใจ/โยกตัว · ท่าทาง · อารมณ์ · เอฟเฟกต์ · สติกเกอร์
// ใช้ร่วมกันระหว่าง ai-live.html และ avatar-studio.html

export const KEY = 'fah2d_v1';
export const DEFAULT = {
  name: 'น้องฟ้า',
  personality: 'ร่าเริง ขี้เล่นนิดๆ ใส่ใจเจ้าของร้าน ชอบแมว พูดจาน่ารักสุภาพ',
  custom: false,                      // true = ใช้รูปที่อัปโหลดเอง (เก็บในเครื่อง)
  eye1: { x: 0.5131, y: 0.3379, w: 0.0883, h: 0.0606, blink: true },
  eye2: { x: 0.3150, y: 0.4006, w: 0.0990, h: 0.0425, blink: false },
  mouth: { x: 0.4511, y: 0.4633, w: 0.0764, h: 0.0510, on: true },
  filter: { hue: 0, sat: 100, bri: 100, con: 100 },
  effect: 'hearts',                   // hearts | sparkle | paws | notes | sakura | snow | none
  motion: 1,                          // ความแรงการขยับ 0–2
  theme: 'purple',
  stickers: [],                       // { e, x, y, s, r }
  voice: { lang: 'ja-JP', pitch: 1.6, rate: 1.05, voiceName: '' },
};
export const DEFAULT_IMG = 'fah-live.jpg';

export const THEMES = {
  purple: { label: 'ม่วงนีออน', a: '#b48cff', b: '#ff8fd0', bg: '#170b2e', line: 'rgba(205,170,255,.75)' },
  pink: { label: 'ชมพูหวาน', a: '#ff8fc8', b: '#ffc36e', bg: '#2a0d22', line: 'rgba(255,180,220,.75)' },
  blue: { label: 'ฟ้าใส', a: '#7fc8ff', b: '#b48cff', bg: '#0b1630', line: 'rgba(160,210,255,.75)' },
  mint: { label: 'มิ้นต์', a: '#6fe3c2', b: '#ffd36e', bg: '#0a2226', line: 'rgba(150,240,215,.75)' },
  gold: { label: 'ทองหรู', a: '#ffd36e', b: '#ff8fa8', bg: '#22160a', line: 'rgba(255,220,150,.75)' },
};
export const FX = {
  hearts: ['💜', '💗', '💕'], sparkle: ['✨', '⭐', '💫'], paws: ['🐾'], notes: ['🎵', '🎶'],
  sakura: ['🌸'], snow: ['❄️'], none: [],
};
export const STICKERS = ['🎀', '👑', '⭐', '✨', '💜', '💗', '🌸', '🐾', '😺', '🐱', '🌙', '☁️', '🍓', '🧋', '🎧', '🕶️', '🦋', '💎', '🍰', '🌈'];

export function merge(base, extra) {
  const out = JSON.parse(JSON.stringify(base));
  if (!extra || typeof extra !== 'object') return out;
  for (const k of Object.keys(out)) {
    if (!(k in extra)) continue;
    const v = extra[k];
    if (out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]) && v && typeof v === 'object') out[k] = { ...out[k], ...v };
    else out[k] = v;
  }
  return out;
}
export function loadCfg() { try { return merge(DEFAULT, JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return merge(DEFAULT, null); } }
export function saveCfg(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); return true; } catch (e) { return false; } }

// ---------- รูปที่อัปโหลดเอง (IndexedDB) ----------
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('fah2d', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('img');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export async function saveImage(blob) {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction('img', 'readwrite'); t.objectStore('img').put(blob, 'main'); t.oncomplete = res; t.onerror = () => rej(t.error); });
}
export async function loadImageBlob() {
  try {
    const d = await db();
    return await new Promise(res => { const t = d.transaction('img'); const q = t.objectStore('img').get('main'); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
  } catch (e) { return null; }
}
export async function imageURL(cfg) {
  if (cfg.custom) { const b = await loadImageBlob(); if (b) return URL.createObjectURL(b); }
  return DEFAULT_IMG;
}
// ย่อรูปใหญ่ก่อนเก็บ (สูงสุด 1400px) เพื่อให้ iPad ลื่น
export function shrinkImage(file, maxH = 1400) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxH / img.height, 1600 / img.width);
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob(b => b ? res(b) : rej(new Error('encode')), 'image/jpeg', 0.9);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = rej; img.src = URL.createObjectURL(file);
  });
}

// ---------- เสียง (ฟรี: เสียงในเครื่อง) ----------
export function voices() { return 'speechSynthesis' in window ? speechSynthesis.getVoices() : []; }
export function pickVoice(v) {
  const L = voices(), lang = v.lang || 'ja-JP', two = lang.slice(0, 2);
  return L.find(x => x.name === v.voiceName && x.lang.replace('_', '-').startsWith(two))
    || L.find(x => x.lang.replace('_', '-') === lang) || L.find(x => x.lang.startsWith(two)) || null;
}
export function speak(text, v, onStart, onEnd) {
  let done = false;
  const end = () => { if (!done) { done = true; onEnd && onEnd(); } };
  const fake = () => { onStart && onStart(); setTimeout(end, Math.max(1400, [...text].length * 95)); };
  if (!text || !('speechSynthesis' in window)) { fake(); return; }
  const voice = pickVoice(v);
  if (!voice) { fake(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice; u.lang = voice.lang; u.pitch = v.pitch ?? 1.6; u.rate = v.rate ?? 1.05;
  u.onstart = () => onStart && onStart(); u.onend = end; u.onerror = end;
  setTimeout(end, 15000 + text.length * 180);
  speechSynthesis.speak(u);
}

// ---------- ตัวละคร 2D ----------
const MOTIONS = { hop: 1.1, nod: 1.0, tilt: 1.6, shake: 0.9, wiggle: 1.5, bounce: 1.2, sink: 2.2, lean: 1.6, point: 1.4, heart: 1.8 };
const MARKS = { angry: '💢', sad: '💧', surprised: '❗', think: '❓', sleepy: '💤', love: '💗' };

export class Puppet {
  constructor(canvas, cfg, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.cfg = merge(DEFAULT, cfg);
    this.opts = { fit: null, edgeFade: false, ...opts };
    this.img = null; this.iw = 1; this.ih = 1;
    this.s = { t: 0, blinkT: 1.8, blinkPh: 0, emo: 'neutral', emoT: 0, talking: false, open: 1, mot: null, look: 0, lookCur: 0 };
    this.parts = [];
    this.view = { s: 1, x: 0, y: 0 };
    this.still = false; this.showGuides = false; this.selSticker = -1;
    this.fxT = 0; this.last = performance.now();
    this._raf = this._raf.bind(this);
    requestAnimationFrame(this._raf);
  }
  async setImage(src) {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
    this.img = img; this.iw = img.naturalWidth; this.ih = img.naturalHeight;
    this.prepare();
  }
  setConfig(cfg) { this.cfg = merge(DEFAULT, cfg); this.prepare(); }
  emotion(name, hold = 4) {
    this.s.emo = name || 'neutral'; this.s.emoT = hold;
    if (name === 'happy' || name === 'love') this.burst(name === 'love' ? FX.hearts : FX.sparkle, 7);
  }
  motion(name) { if (MOTIONS[name]) this.s.mot = { n: name, t: 0, d: MOTIONS[name] }; if (name === 'heart') this.burst(FX.hearts, 10); }
  talk(on) { this.s.talking = !!on; }
  look(x) { this.s.look = Math.max(-1, Math.min(1, x)); }
  burst(set, n = 6) {
    if (!set || !set.length) return;
    const f = this.faceScreen();
    for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1; this.parts.push({ e: set[i % set.length], x: f.x + side * f.w * (1.3 + Math.random() * 1.2), y: f.y + (Math.random() - 0.3) * f.w * 1.5, vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 60, a: 1, s: 18 + Math.random() * 16, life: 1.6 + Math.random() * 0.8, t: 0 }); }
  }

  // พิกัด: รูป ↔ จอ
  fit() {
    const W = this.cv.clientWidth, H = this.cv.clientHeight, iw = this.iw, ih = this.ih;
    if (this.opts.fit) return this.opts.fit(W, H, iw, ih);
    const s = Math.min(W / iw, H / ih) * 0.96;
    return { s, x: (W - iw * s) / 2, y: (H - ih * s) / 2 };
  }
  toImg(px, py) { const v = this.view; return { x: (px - v.x) / v.s / this.iw, y: (py - v.y) / v.s / this.ih }; }
  toScr(nx, ny) { const v = this.view; return { x: v.x + nx * this.iw * v.s, y: v.y + ny * this.ih * v.s }; }
  faceScreen() {
    const e = this.cfg.eye1, m = this.cfg.mouth;
    const c = this.toScr((e.x + e.w / 2 + m.x + m.w / 2) / 2, (e.y + m.y + m.h) / 2);
    return { x: c.x, y: c.y, w: e.w * this.iw * this.view.s * 1.4 };
  }

  // เตรียมภาพซ้อน (เปลือกตา ปาก) จากสีผิวจริงของรูป
  prepare() {
    if (!this.img) return;
    const iw = this.iw, ih = this.ih, c = this.cfg;
    const src = document.createElement('canvas'); src.width = iw; src.height = ih;
    const g = src.getContext('2d', { willReadFrequently: true }); g.drawImage(this.img, 0, 0);
    const box = r => ({ x: r.x * iw, y: r.y * ih, w: r.w * iw, h: r.h * ih });
    const sample = (x, y, w, h) => {
      try {
        const d = g.getImageData(Math.max(0, x | 0), Math.max(0, y | 0), Math.max(1, w | 0), Math.max(1, h | 0)).data;
        let r = 0, gg = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { const L = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; if (L > 150) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } }
        return n ? [r / n, gg / n, b / n] : [248, 210, 222];
      } catch (e) { return [248, 210, 222]; }
    };
    const rgba = (c3, a) => `rgba(${c3[0] | 0},${c3[1] | 0},${c3[2] | 0},${a})`;
    const patch = (ctx, cx, cy, rx, ry, col) => {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(rx, ry);
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.7, rgba(col, 1)); gr.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    };
    const mc = box(c.mouth), mcx = mc.x + mc.w / 2;
    this.L = { mouth: null, eyes: [] };

    for (const key of ['eye1', 'eye2']) {
      const e = c[key]; if (!e || !e.blink) continue;
      const b = box(e), pad = Math.max(b.w, b.h) * 0.35;
      const cw = b.w + pad * 2, ch = b.h + pad * 2;
      const ring = [sample(b.x - 7, b.y + b.h * 0.35, 5, b.h * 0.6), sample(b.x + b.w + 2, b.y + b.h * 0.35, 5, b.h * 0.6), sample(b.x + b.w * 0.2, b.y + b.h + 2, b.w * 0.6, 4)];
      const col = [0, 1, 2].map(i => ring.reduce((a, r) => a + r[i], 0) / ring.length * 0.985);
      const outerRight = b.x + b.w / 2 > mcx;
      const mk = happy => {
        const o = document.createElement('canvas'); o.width = Math.ceil(cw); o.height = Math.ceil(ch);
        const q = o.getContext('2d');
        patch(q, cw / 2, ch / 2 + b.h * 0.06, b.w * 0.58, b.h * 0.56, col);
        q.strokeStyle = '#2b1530'; q.lineCap = 'round'; q.lineWidth = Math.max(2, b.h * 0.1);
        const x0 = pad + b.w * 0.06, x1 = pad + b.w * 0.94, yb = pad + b.h * (happy ? 0.66 : 0.52);
        q.beginPath(); q.moveTo(x0, yb);
        q.quadraticCurveTo(pad + b.w / 2, pad + b.h * (happy ? 0.12 : 0.86), x1, yb); q.stroke();
        // ขนตาปลายหาง
        const ox = outerRight ? x1 : x0, dir = outerRight ? 1 : -1;
        q.lineWidth = Math.max(1.5, b.h * 0.06);
        q.beginPath(); q.moveTo(ox, yb); q.lineTo(ox + dir * b.w * 0.12, yb - b.h * (happy ? 0.05 : 0.14)); q.stroke();
        return o;
      };
      this.L.eyes.push({ b, pad, closed: mk(false), happy: mk(true), outerRight });
    }

    if (c.mouth && c.mouth.on) {
      const b = mc, pad = Math.max(b.w, b.h) * 0.3;
      const cw = b.w + pad * 2, ch = b.h + pad * 2;
      const col = sample(b.x - b.w * 0.25, b.y + b.h + 4, b.w * 1.5, Math.max(3, b.h * 0.3));
      const cover = document.createElement('canvas'); cover.width = Math.ceil(cw); cover.height = Math.ceil(ch);
      patch(cover.getContext('2d'), cw / 2, ch / 2, b.w * 0.66, b.h * 0.72, col);
      // ปากจริงจากรูป ตัดขอบนุ่ม
      const spr = document.createElement('canvas'); spr.width = Math.ceil(b.w * 1.12); spr.height = Math.ceil(b.h * 1.12);
      const q = spr.getContext('2d');
      q.drawImage(src, b.x - b.w * 0.06, b.y - b.h * 0.06, spr.width, spr.height, 0, 0, spr.width, spr.height);
      q.globalCompositeOperation = 'destination-in';
      q.save(); q.translate(spr.width / 2, spr.height / 2); q.scale(spr.width / 2, spr.height / 2);
      const gr = q.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, '#000'); gr.addColorStop(0.78, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      q.fillStyle = gr; q.beginPath(); q.arc(0, 0, 1, 0, Math.PI * 2); q.fill(); q.restore();
      this.L.mouth = { b, pad, cover, spr };
    }
    this.cv.style.filter = `hue-rotate(${c.filter.hue}deg) saturate(${c.filter.sat}%) brightness(${c.filter.bri}%) contrast(${c.filter.con}%)`;
  }

  _raf(now) {
    requestAnimationFrame(this._raf);
    if (document.hidden) { this.last = now; return; }
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.step(dt); this.draw();
  }

  step(dt) {
    const s = this.s; s.t += dt;
    s.blinkT -= dt; if (s.blinkT <= 0) { s.blinkPh = 0.13; s.blinkT = 2.2 + Math.random() * 3.5; if (Math.random() < 0.15) s.blinkT = 0.25; }
    if (s.blinkPh > 0) s.blinkPh -= dt;
    if (s.emoT > 0) { s.emoT -= dt; if (s.emoT <= 0) s.emo = 'neutral'; }
    if (s.mot) { s.mot.t += dt; if (s.mot.t >= s.mot.d) s.mot = null; }
    const closedEmo = ['sad', 'angry', 'sleepy', 'think'].includes(s.emo);
    let target;
    if (s.talking) target = 0.22 + 0.78 * Math.abs(Math.sin(s.t * 13 + Math.sin(s.t * 4.7) * 2)) * (0.6 + 0.4 * Math.random());
    else target = closedEmo ? 0 : 1;
    s.open += (target - s.open) * Math.min(1, dt * (s.talking ? 22 : 8));
    s.lookCur += (s.look - s.lookCur) * Math.min(1, dt * 3);
    // อนุภาคลอยรอบตัว
    const set = FX[this.cfg.effect] || [];
    this.fxT -= dt;
    if (set.length && this.fxT <= 0 && !this.still) {
      this.fxT = 0.9 + Math.random() * 0.8;
      const W = this.cv.clientWidth, H = this.cv.clientHeight, v = this.view;
      const x = v.x + Math.random() * this.iw * v.s;
      this.parts.push({ e: set[Math.floor(Math.random() * set.length)], x: Math.min(W - 10, Math.max(10, x)), y: H + 10, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 30, a: 0.9, s: 14 + Math.random() * 12, life: 5 + Math.random() * 3, t: 0 });
    }
    for (const p of this.parts) { p.t += dt; p.x += p.vx * dt + Math.sin(p.t * 2 + p.s) * 0.4; p.y += p.vy * dt; }
    this.parts = this.parts.filter(p => p.t < p.life);
  }

  motionPose() {
    const s = this.s, k = this.still ? 0 : this.cfg.motion;
    let dx = s.lookCur * 4, dy = Math.sin(s.t * 1.7) * 2.2, rot = Math.sin(s.t * 0.6) * 0.006 + s.lookCur * 0.008, sc = 1, br = Math.sin(s.t * 1.7) * 0.004;
    if (s.emo === 'sad') { dy += 6; sc *= 0.99; }
    if (s.emo === 'shy') rot += 0.015;
    if (s.mot) {
      const m = s.mot, t = m.t, env = Math.max(0, Math.min(1, t / 0.15, (m.d - t) / 0.25));
      switch (m.n) {
        case 'hop': dy -= Math.abs(Math.sin(t * Math.PI / 0.36)) * 22 * env; break;
        case 'nod': dy += Math.sin(t * 12) * 6 * env; rot += Math.sin(t * 12) * 0.006 * env; break;
        case 'tilt': rot += 0.045 * env; break;
        case 'shake': dx += Math.sin(t * 34) * 7 * env; break;
        case 'wiggle': rot += Math.sin(t * 10) * 0.035 * env; break;
        case 'bounce': case 'heart': sc *= 1 + Math.abs(Math.sin(t * 8)) * 0.02 * env; dy -= Math.abs(Math.sin(t * 8)) * 6 * env; break;
        case 'sink': dy += 12 * env; sc *= 1 - 0.015 * env; break;
        case 'lean': case 'point': sc *= 1 + 0.035 * env; rot -= 0.02 * env; break;
      }
    }
    return { dx: dx * k, dy: dy * k, rot: rot * k, sc: 1 + (sc - 1) * k, br: br * k };
  }

  draw() {
    const cv = this.cv, ctx = this.ctx, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (!this.img) return;
    const f = this.fit(); this.view = f;
    const P = this.motionPose(), iw = this.iw, ih = this.ih, s = this.s, c = this.cfg;
    ctx.save();
    ctx.translate(f.x + iw * f.s / 2 + P.dx, f.y + ih * f.s + P.dy);
    ctx.rotate(P.rot);
    ctx.scale(f.s * P.sc, f.s * P.sc * (1 + P.br));
    ctx.translate(-iw / 2, -ih);
    ctx.drawImage(this.img, 0, 0, iw, ih);
    const L = this.L || { eyes: [] };
    // ตา
    const happy = s.emo === 'happy' || s.emo === 'love';
    for (const e of L.eyes) {
      const lay = happy ? e.happy : (s.blinkPh > 0 || s.emo === 'sleepy') ? e.closed : null;
      if (lay) ctx.drawImage(lay, e.b.x - e.pad, e.b.y - e.pad);
    }
    // ปาก
    const M = L.mouth;
    if (M && s.open < 0.97) {
      const b = M.b;
      ctx.drawImage(M.cover, b.x - M.pad, b.y - M.pad);
      if (s.open > 0.08) {
        const h = M.spr.height * (0.25 + 0.75 * s.open), w = M.spr.width * (0.85 + 0.15 * s.open);
        ctx.drawImage(M.spr, b.x + b.w / 2 - w / 2, b.y - b.h * 0.06, w, h);
      } else {
        ctx.strokeStyle = '#5a2236'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, b.h * 0.1);
        const sad = ['sad', 'angry'].includes(s.emo), y = b.y + b.h * 0.42;
        ctx.beginPath(); ctx.moveTo(b.x + b.w * 0.2, y + (sad ? b.h * 0.15 : 0));
        ctx.quadraticCurveTo(b.x + b.w / 2, y + (sad ? -b.h * 0.2 : b.h * 0.35), b.x + b.w * 0.8, y + (sad ? b.h * 0.15 : 0)); ctx.stroke();
        if (!sad) { ctx.fillStyle = '#fff'; ctx.beginPath(); const fx = b.x + b.w * 0.36, fy = y + b.h * 0.12; ctx.moveTo(fx - b.w * 0.06, fy); ctx.lineTo(fx + b.w * 0.06, fy + b.h * 0.02); ctx.lineTo(fx, fy + b.h * 0.2); ctx.closePath(); ctx.fill(); }
      }
    }
    // แก้มแดงเพิ่มตอนเขิน
    if (s.emo === 'shy' || s.emo === 'love') {
      ctx.fillStyle = 'rgba(255,110,150,0.28)';
      for (const k of ['eye1', 'eye2']) { const e = c[k]; if (!e) continue; ctx.beginPath(); ctx.ellipse((e.x + e.w / 2) * iw, (e.y + e.h * 1.9) * ih, e.w * iw * 0.42, e.h * ih * 0.35, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    // สติกเกอร์
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    c.stickers.forEach((st, i) => {
      ctx.save(); ctx.translate(st.x * iw, st.y * ih); ctx.rotate(st.r || 0);
      ctx.font = `${Math.round(st.s * iw)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(st.e, 0, 0);
      if (i === this.selSticker) { ctx.strokeStyle = '#ff8fd0'; ctx.lineWidth = 3 / f.s; ctx.setLineDash([8 / f.s, 6 / f.s]); const r = st.s * iw * 0.62; ctx.strokeRect(-r, -r, r * 2, r * 2); }
      ctx.restore();
    });
    // เส้นช่วยตั้งตำแหน่งตา/ปาก (หน้าแต่งตัว)
    if (this.showGuides) {
      ctx.lineWidth = 2 / f.s; ctx.setLineDash([6 / f.s, 4 / f.s]);
      [['eye1', '#7fe3ff'], ['eye2', '#ffd36e'], ['mouth', '#ff8fd0']].forEach(([k, col]) => {
        const r = c[k]; if (!r) return; ctx.strokeStyle = col; ctx.strokeRect(r.x * iw, r.y * ih, r.w * iw, r.h * ih);
      });
      ctx.setLineDash([]);
    }
    ctx.restore();

    // ขอบนุ่มซ้ายขวา (ให้กลืนกับพื้นหลัง)
    if (this.opts.edgeFade) {
      ctx.save(); ctx.globalCompositeOperation = 'destination-out';
      const fw = Math.min(70, iw * f.s * 0.1);
      let gr = ctx.createLinearGradient(f.x, 0, f.x + fw, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(f.x - 30, 0, fw + 30, H);
      const xr = f.x + iw * f.s;
      gr = ctx.createLinearGradient(xr, 0, xr - fw, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(xr - fw, 0, fw + 30, H);
      gr = ctx.createLinearGradient(0, f.y, 0, f.y + 50); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, f.y - 30, W, 80);
      ctx.restore();
    }

    // เครื่องหมายอารมณ์ + อนุภาค (พิกัดจอ)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const mk = MARKS[s.emo];
    if (mk) {
      const e = c.eye1, p = this.toScr(e.x + e.w * 1.6, e.y - e.h * 1.6), sz = e.w * iw * f.s * 0.7;
      ctx.globalAlpha = 0.95; ctx.font = `${sz | 0}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(mk, p.x + P.dx, p.y + P.dy + Math.sin(s.t * 4) * 4);
    }
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.a * (1 - p.t / p.life));
      ctx.font = `${p.s | 0}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(p.e, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }
}

// รูปหน้าเล็ก (ใช้เป็นไอคอนในแชท)
export function faceThumbStyle(url, cfg, iw, ih, size = 32) {
  const e = cfg.eye1, m = cfg.mouth;
  const cx = (e.x + e.w / 2 + m.x + m.w / 2) / 2 * iw, cy = (e.y + m.y + m.h) / 2 * ih;
  const span = e.w * iw * 3.2, k = size / span;
  return `background-image:url("${url}");background-size:${iw * k}px ${ih * k}px;background-position:${-(cx * k - size / 2)}px ${-(cy * k - size / 2)}px`;
}
