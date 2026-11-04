// fah-avatar.js — ตัวละครน้องฟ้า 3D สร้างด้วยโค้ด three.js ล้วน (ไม่ใช้ไฟล์โมเดลภายนอก ไม่ติดไลเซนส์)
// ใช้ร่วมกันระหว่าง ai-live.html และ avatar-studio.html
import * as THREE from 'three';

export const AVATAR_KEY = 'fah_avatar_v1';

export const DEFAULT_CONFIG = {
  name: 'น้องฟ้า',
  personality: 'ร่าเริง ขี้เล่นนิดๆ ใส่ใจเจ้าของร้าน ชอบแมว พูดจาน่ารักสุภาพ',
  skin: '#ffe9df',
  hairStyle: 'long',      // long | twintail | ponytail | bob | short
  bangs: 'side',          // side | straight | split
  ahoge: true,
  hairColor: '#2c1a3d',
  eyeColor: '#9a5cff',
  eyeShape: 'round',      // round | sharp | sleepy
  eyeSize: 1.0,
  blush: true,
  fang: true,
  ears: 'cat',            // cat | fox | bunny | none
  earColor: '#231530',
  earInner: '#f5eef8',
  outfit: 'hoodie',       // hoodie | sailor | maid | idol | dress
  outfitMain: '#1f1a2b',
  outfitAccent: '#9a6bff',
  innerColor: '#ffffff',
  bow: true,
  bowColor: '#a67cff',
  clip: true,
  choker: true,
  bell: true,
  glasses: false,
  headphones: false,
  voice: { lang: 'ja-JP', pitch: 1.6, rate: 1.05, voiceName: '' },
};

export const PRESETS = {
  original: { label: 'ฟ้าต้นแบบ 😺', cfg: {} },
  student: { label: 'นักเรียน 🎒', cfg: { hairStyle: 'ponytail', bangs: 'straight', hairColor: '#3b2418', eyeColor: '#4f8cff', earColor: '#3b2418', outfit: 'sailor', outfitMain: '#22305e', outfitAccent: '#e0445a', bowColor: '#e0445a', clip: false } },
  maid: { label: 'เมดคาเฟ่ ☕', cfg: { hairStyle: 'twintail', hairColor: '#f3c3dc', eyeColor: '#ff4f93', earColor: '#f3c3dc', earInner: '#ffffff', outfit: 'maid', outfitMain: '#1c1a22', outfitAccent: '#ff8cc0', bowColor: '#ff8cc0', clip: false, bell: false } },
  idol: { label: 'ไอดอล ✨', cfg: { hairStyle: 'twintail', bangs: 'split', hairColor: '#8fd3ff', eyeColor: '#21b5c4', ears: 'bunny', earColor: '#ffffff', earInner: '#ffc2dc', outfit: 'idol', outfitMain: '#ffffff', outfitAccent: '#ff6fa8', bowColor: '#ff6fa8', headphones: true, choker: false } },
  fox: { label: 'จิ้งจอก 🦊', cfg: { hairStyle: 'bob', hairColor: '#f0a050', eyeColor: '#e0552a', ears: 'fox', earColor: '#f0a050', earInner: '#fff3e6', outfit: 'dress', outfitMain: '#fff6ea', outfitAccent: '#d9534f', bowColor: '#d9534f', glasses: true, clip: false } },
};

export function mergeConfig(base, extra) {
  const out = JSON.parse(JSON.stringify(base));
  if (!extra || typeof extra !== 'object') return out;
  for (const k of Object.keys(extra)) {
    if (k === 'voice') out.voice = { ...out.voice, ...(extra.voice || {}) };
    else if (k in out) out[k] = extra[k];
  }
  return out;
}
export function loadAvatarConfig() {
  try { return mergeConfig(DEFAULT_CONFIG, JSON.parse(localStorage.getItem(AVATAR_KEY) || 'null')); }
  catch (e) { return mergeConfig(DEFAULT_CONFIG, null); }
}
export function saveAvatarConfig(cfg) {
  try { localStorage.setItem(AVATAR_KEY, JSON.stringify(cfg)); return true; } catch (e) { return false; }
}

// ---------- วัสดุ / ตัวช่วย ----------
const D2R = Math.PI / 180;
const HEAD_R = 0.42;
const GRAD = (() => {
  const t = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x2a1a30, side: THREE.BackSide });

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const target = amt < 0 ? new THREE.Color(0, 0, 0) : new THREE.Color(1, 1, 1);
  return '#' + c.lerp(target, Math.abs(amt)).getHexString();
}
const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...o });
const flat = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });

function outline(mesh, thick = 0.007) {
  const g = mesh.geometry.clone();
  const p = g.attributes.position, n = g.attributes.normal;
  if (!n) return mesh;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + n.getX(i) * thick, p.getY(i) + n.getY(i) * thick, p.getZ(i) + n.getZ(i) * thick);
  }
  const o = new THREE.Mesh(g, OUTLINE_MAT); o.userData.outline = true; mesh.add(o);
  return mesh;
}
function mesh(geo, mat, line = 0.007) { const m = new THREE.Mesh(geo, mat); return line ? outline(m, line) : m; }

function strandGeo(len, w) {
  const pts = [new THREE.Vector2(0.0005, 0)];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = w * Math.pow(1 - t, 0.8) * (t < 0.22 ? 0.55 + (t / 0.22) * 0.45 : 1);
    pts.push(new THREE.Vector2(Math.max(r, 0.0006), -t * len));
  }
  return new THREE.LatheGeometry(pts, 10);
}

function eyeTexture(color, shape) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const top = shape === 'sleepy' ? 95 : 40;
  const path = () => {
    g.beginPath(); g.moveTo(26, 132);
    g.quadraticCurveTo(120, top - 10, 232, shape === 'sharp' ? 100 : 122);
    g.quadraticCurveTo(236, 250, 128, 250);
    g.quadraticCurveTo(22, 250, 26, 132); g.closePath();
  };
  g.save(); path(); g.clip();
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  const gr = g.createLinearGradient(0, 60, 0, 250);
  gr.addColorStop(0, shade(color, -0.55)); gr.addColorStop(0.55, color); gr.addColorStop(1, shade(color, 0.45));
  g.fillStyle = gr; g.beginPath(); g.ellipse(128, 160, 74, 96, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = shade(color, -0.6); g.lineWidth = 6; g.stroke();
  g.fillStyle = shade(color, -0.75); g.beginPath(); g.ellipse(128, 158, 30, 44, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(128, 215, 46, 18, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.ellipse(96, 116, 22, 28, -0.3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(160, 200, 10, 10, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  // ขนตาบน
  g.strokeStyle = '#24152b'; g.lineCap = 'round'; g.lineWidth = 20;
  g.beginPath(); g.moveTo(24, 136); g.quadraticCurveTo(120, top - 10, 234, shape === 'sharp' ? 98 : 120); g.stroke();
  if (shape === 'sharp') { g.lineWidth = 12; g.beginPath(); g.moveTo(222, 104); g.lineTo(250, 78); g.stroke(); }
  else { g.lineWidth = 10; g.beginPath(); g.moveTo(222, 118); g.lineTo(244, 104); g.stroke(); }
  g.lineWidth = 6; g.beginPath(); g.moveTo(150, 248); g.quadraticCurveTo(200, 246, 222, 228); g.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

function catPrintTexture(lineColor) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.strokeStyle = lineColor; g.lineWidth = 7; g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath(); g.moveTo(26, 50); g.lineTo(34, 18); g.lineTo(54, 38); g.quadraticCurveTo(64, 34, 74, 38);
  g.lineTo(94, 18); g.lineTo(102, 50); g.quadraticCurveTo(110, 100, 64, 104); g.quadraticCurveTo(18, 100, 26, 50); g.stroke();
  g.fillStyle = lineColor;
  g.beginPath(); g.arc(48, 66, 6, 0, 7); g.fill(); g.beginPath(); g.arc(80, 66, 6, 0, 7); g.fill();
  g.lineWidth = 4; g.beginPath(); g.moveTo(56, 82); g.quadraticCurveTo(64, 90, 64, 82); g.quadraticCurveTo(64, 90, 72, 82); g.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

// ---------- คลาสตัวละคร ----------
export class FahAvatar {
  constructor(config) {
    this.root = new THREE.Group();
    this.config = mergeConfig(DEFAULT_CONFIG, config);
    this.s = {
      t: 0, blinkT: 1.5, blinkPh: 0, emotion: 'neutral', emoHold: 0, talking: false, mouth: 0,
      look: new THREE.Vector2(), lookCur: new THREE.Vector2(), gesture: null, earT: 3, earPh: 0,
      arms: { L: { raise: 0.12, fwd: 0.05, elbow: 0.15, fz: 0 }, R: { raise: 0.12, fwd: 0.05, elbow: 0.15, fz: 0 } },
      lean: 0, headExtra: new THREE.Vector3(), bounce: 0,
    };
    this.build();
  }

  setConfig(cfg) { this.config = mergeConfig(DEFAULT_CONFIG, cfg); this.build(); }
  setEmotion(name, hold = 5) { this.s.emotion = name || 'neutral'; this.s.emoHold = hold; }
  setTalking(on) { this.s.talking = !!on; }
  gesture(name) {
    const dur = { wave: 2.2, point: 2.0, paw: 2.2, cheer: 2.0, think: 2.6, heart: 2.4, nod: 1.2, bow: 1.8 }[name];
    if (dur) this.s.gesture = { name, t: 0, dur };
  }
  lookAt(x, y) { this.s.look.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1)); }

  _dispose() {
    this.root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material !== OUTLINE_MAT) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
    this.root.clear();
  }

  _onHead(obj, lat, lon, off = 0) {
    const piv = new THREE.Group(); piv.rotation.order = 'YXZ';
    piv.rotation.set(-lat * D2R, lon * D2R, 0);
    obj.position.z += HEAD_R + off;
    piv.add(obj); this.headG.add(piv); return piv;
  }
  _strand(len, w, mat, lat, lon, { off = 0.03, hang = 0, tilt = 0, roll = 0 } = {}) {
    const m = new THREE.Mesh(strandGeo(len, w), mat); m.scale.z = 0.55; outline(m, 0.006);
    const g = new THREE.Group(); g.add(m);
    g.rotation.x = hang * lat * D2R + tilt; g.rotation.z = roll;
    this._onHead(g, lat, lon, off); return g;
  }

  build() {
    this._dispose();
    const c = this.config, P = (this.p = {});
    const skin = toon(c.skin), hair = toon(c.hairColor), main = toon(c.outfitMain), accent = toon(c.outfitAccent), inner = toon(c.innerColor);
    const dark = toon('#1d1724'), white = toon('#ffffff');

    // โครงร่าง
    const body = (P.body = new THREE.Group()); this.root.add(body);
    const lower = new THREE.Group(); body.add(lower);
    const upper = (P.upper = new THREE.Group()); upper.position.y = 0.55; body.add(upper);

    // ลำตัว
    const torsoMat = ['maid', 'idol', 'dress'].includes(c.outfit) ? main : inner;
    const torso = mesh(new THREE.CapsuleGeometry(0.2, 0.3, 6, 18), torsoMat);
    torso.scale.set(1.12, 1, 0.78); torso.position.y = 0.31; upper.add(torso); P.torso = torso;
    const neck = mesh(new THREE.CylinderGeometry(0.068, 0.075, 0.2, 14), skin, 0.005); neck.position.y = 0.58; upper.add(neck);

    // ชุด
    if (c.outfit === 'hoodie') {
      const jk = mesh(new THREE.CylinderGeometry(0.235, 0.265, 0.56, 28, 1, true, 0.5, Math.PI * 2 - 1.0), toon(c.outfitMain, { side: THREE.DoubleSide }));
      jk.scale.z = 0.8; jk.position.y = 0.27; upper.add(jk);
      for (const sgn of [-1, 1]) {
        const ed = mesh(new THREE.BoxGeometry(0.022, 0.56, 0.02), accent, 0);
        ed.position.set(sgn * 0.265 * Math.sin(0.5) * 0.95, 0.27, 0.8 * 0.25 * Math.cos(0.5) + 0.01); ed.rotation.y = sgn * 0.45; upper.add(ed);
      }
      const hood = mesh(new THREE.TorusGeometry(0.15, 0.055, 8, 20), main); hood.rotation.x = Math.PI / 2 + 0.5; hood.position.set(0, 0.55, -0.1); upper.add(hood);
      const pr = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.13), flat('#ffffff', { map: catPrintTexture(shade(c.outfitMain, 0.1)), transparent: true }));
      pr.position.set(0, 0.3, 0.172); upper.add(pr);
    } else if (c.outfit === 'sailor') {
      const back = mesh(new THREE.BoxGeometry(0.36, 0.24, 0.015), main); back.position.set(0, 0.44, -0.16); back.rotation.x = 0.35; upper.add(back);
      for (const sgn of [-1, 1]) {
        const v = mesh(new THREE.BoxGeometry(0.05, 0.24, 0.015), main, 0.004); v.position.set(sgn * 0.075, 0.44, 0.15); v.rotation.set(-0.25, 0, sgn * 0.55); upper.add(v);
      }
      this._bow(upper, c.outfitAccent, 0.9).position.set(0, 0.36, 0.185);
    } else if (c.outfit === 'maid') {
      const bib = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), flat('#ffffff')); bib.position.set(0, 0.22, 0.17); upper.add(bib);
      const col = mesh(new THREE.TorusGeometry(0.085, 0.022, 8, 20), white, 0.004); col.rotation.x = Math.PI / 2; col.position.y = 0.5; upper.add(col);
      this._bow(upper, c.outfitAccent, 0.7).position.set(0, 0.45, 0.12);
    } else if (c.outfit === 'idol') {
      const fr = mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 28), accent, 0.004); fr.rotation.x = Math.PI / 2; fr.scale.y = 0.78; fr.position.y = 0.48; upper.add(fr);
      this._bow(upper, c.outfitAccent, 1.0).position.set(0, 0.36, 0.18);
    } else {
      const col = mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 20), white, 0.004); col.rotation.x = Math.PI / 2; col.position.y = 0.5; upper.add(col);
      this._bow(upper, c.outfitAccent, 0.7).position.set(0, 0.42, 0.13);
    }

    // กระโปรง ขา
    const skirtMat = toon(c.outfitMain, { side: THREE.DoubleSide, flatShading: true });
    const skirt = mesh(new THREE.CylinderGeometry(0.21, 0.35, 0.3, 16, 1, true), skirtMat); skirt.position.y = 0.47; lower.add(skirt);
    const hemColor = c.outfit === 'maid' ? '#ffffff' : c.outfitAccent;
    const hem = mesh(new THREE.TorusGeometry(0.35, c.outfit === 'idol' ? 0.03 : 0.012, 6, 32), toon(hemColor), 0); hem.rotation.x = Math.PI / 2; hem.position.y = 0.32; lower.add(hem);
    if (c.outfit === 'maid') {
      const ap = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), flat('#ffffff', { side: THREE.DoubleSide })); ap.position.set(0, 0.46, 0.29); ap.rotation.x = -0.41; lower.add(ap);
    }
    const sockMat = toon(['maid', 'idol'].includes(c.outfit) ? '#ffffff' : '#1d1a24');
    for (const sgn of [-1, 1]) {
      const leg = mesh(new THREE.CapsuleGeometry(0.062, 0.32, 4, 12), skin, 0.005); leg.position.set(sgn * 0.09, 0.2, 0); lower.add(leg);
      const sock = mesh(new THREE.CapsuleGeometry(0.067, 0.2, 4, 12), sockMat, 0.005); sock.position.set(sgn * 0.09, 0.13, 0); lower.add(sock);
      const shoe = mesh(new THREE.SphereGeometry(0.07, 14, 10), dark, 0.005); shoe.scale.set(1, 0.6, 1.5); shoe.position.set(sgn * 0.09, -0.02, 0.03); lower.add(shoe);
    }

    // แขน
    const longSleeve = ['hoodie', 'sailor', 'dress'].includes(c.outfit);
    const sleeveMat = c.outfit === 'sailor' ? inner : main;
    const cuffMat = c.outfit === 'sailor' ? main : (c.outfit === 'maid' ? white : accent);
    P.arm = {};
    for (const [side, sgn] of [['L', 1], ['R', -1]]) {
      const sh = new THREE.Group(); sh.position.set(sgn * 0.25, 0.47, 0); upper.add(sh);
      const ua = mesh(new THREE.CapsuleGeometry(0.056, 0.2, 4, 12), sleeveMat, 0.005); ua.position.y = -0.13; sh.add(ua);
      if (!longSleeve) { const puff = mesh(new THREE.SphereGeometry(0.085, 14, 10), c.outfit === 'idol' ? accent : main, 0.005); puff.position.y = -0.04; sh.add(puff); }
      const el = new THREE.Group(); el.position.y = -0.27; sh.add(el);
      const fa = mesh(new THREE.CapsuleGeometry(0.05, 0.17, 4, 12), longSleeve ? sleeveMat : skin, 0.005); fa.position.y = -0.11; el.add(fa);
      const cuff = mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.04, 14), cuffMat, 0.004); cuff.position.y = -0.2; el.add(cuff);
      const hand = mesh(new THREE.SphereGeometry(0.056, 14, 10), skin, 0.005); hand.position.y = -0.27; hand.scale.set(0.9, 1, 0.8); el.add(hand);
      const finger = mesh(new THREE.CapsuleGeometry(0.014, 0.06, 3, 6), skin, 0.003); finger.position.set(0, -0.33, 0.01); finger.visible = false; el.add(finger);
      P.arm[side] = { sh, el, finger, sgn };
    }

    // หัว
    const hp = (P.headPivot = new THREE.Group()); hp.position.y = 0.6; upper.add(hp);
    const headG = (this.headG = new THREE.Group()); headG.position.y = 0.4; hp.add(headG);
    const head = mesh(new THREE.SphereGeometry(HEAD_R, 40, 30), skin, 0.006); head.scale.set(1, 0.97, 0.96); headG.add(head);

    // โชคเกอร์
    if (c.choker) {
      const ch = mesh(new THREE.TorusGeometry(0.074, 0.016, 8, 24), dark, 0); ch.rotation.x = Math.PI / 2; ch.position.y = 0.56; upper.add(ch);
      if (c.bell) { const b = mesh(new THREE.SphereGeometry(0.026, 14, 10), toon('#f5c542'), 0.004); b.position.set(0, 0.52, 0.085); upper.add(b); }
    }

    // ใบหน้า
    const eyeTex = eyeTexture(c.eyeColor, c.eyeShape);
    const lineMat = flat('#2a1830');
    P.eyes = {};
    for (const [side, sgn] of [['L', 1], ['R', -1]]) {
      const g = new THREE.Group();
      const open = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.17), flat('#ffffff', { map: eyeTex, transparent: true }));
      if (sgn < 0) open.scale.x = -1;
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 6, 18, Math.PI), lineMat);
      arc.visible = false; g.add(open, arc);
      g.scale.setScalar(c.eyeSize);
      this._onHead(g, -6, sgn * 24, 0.012);
      const brow = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.016), flat(shade(c.hairColor, -0.2)));
      this._onHead(brow, 13, sgn * 25, 0.015);
      P.eyes[side] = { g, open, arc, brow, sgn };
    }
    // ปาก
    const mouth = new THREE.Group(); this._onHead(mouth, -27, 0, 0.012); P.mouth = mouth;
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.007, 6, 16, Math.PI), lineMat);
    smile.rotation.z = Math.PI; smile.scale.y = 0.6; smile.position.y = 0.012; mouth.add(smile);
    const open = new THREE.Group();
    open.add(new THREE.Mesh(new THREE.CircleGeometry(0.042, 24), flat('#8a2b3f')));
    const tongue = new THREE.Mesh(new THREE.CircleGeometry(0.024, 18), flat('#ff8fa3')); tongue.position.set(0, -0.016, 0.001); open.add(tongue);
    mouth.add(open);
    const fangShape = new THREE.Shape(); fangShape.moveTo(-0.009, 0); fangShape.lineTo(0.009, 0); fangShape.lineTo(0, -0.018); fangShape.closePath();
    const fangOpen = new THREE.Mesh(new THREE.ShapeGeometry(fangShape), flat('#ffffff')); fangOpen.position.set(0.017, 0.036, 0.002); open.add(fangOpen);
    const fangClosed = new THREE.Mesh(new THREE.ShapeGeometry(fangShape), flat('#ffffff')); fangClosed.position.set(0.02, -0.006, 0.002); mouth.add(fangClosed);
    fangOpen.visible = fangClosed.visible = c.fang;
    P.smile = smile; P.open = open; P.fangClosed = fangClosed;
    // แก้มแดง
    P.blush = [];
    for (const sgn of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.CircleGeometry(0.055, 20), flat('#ff7f9c', { transparent: true, opacity: 0.35, depthWrite: false }));
      b.scale.set(1.3, 0.7, 1); this._onHead(b, -15, sgn * 37, 0.01); P.blush.push(b);
    }

    // ผม
    const capF = mesh(new THREE.SphereGeometry(HEAD_R * 1.06, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.37), hair, 0.006); headG.add(capF);
    const backLen = c.hairStyle === 'short' ? 0.62 : 0.8;
    const capB = mesh(new THREE.SphereGeometry(HEAD_R * 1.06, 36, 22, Math.PI, Math.PI, 0, Math.PI * backLen), hair, 0.006); headG.add(capB);
    const bangSets = {
      side: [[-56, 0.26, 0.25], [-40, 0.3, 0.25], [-22, 0.31, 0.3], [-6, 0.29, 0.3], [10, 0.27, 0.3], [27, 0.3, 0.25], [44, 0.27, 0.2], [58, 0.24, 0.1]],
      straight: [[-54, 0.27, 0], [-36, 0.28, 0], [-18, 0.29, 0], [0, 0.29, 0], [18, 0.29, 0], [36, 0.28, 0], [54, 0.27, 0]],
      split: [[-56, 0.27, -0.25], [-40, 0.29, -0.3], [-24, 0.3, -0.35], [-9, 0.26, -0.4], [9, 0.26, 0.4], [24, 0.3, 0.35], [40, 0.29, 0.3], [56, 0.27, 0.25]],
    };
    for (const [lon, len, roll] of bangSets[c.bangs] || bangSets.side) {
      this._strand(len, 0.078, hair, 46 - Math.abs(lon) * 0.12, lon, { off: 0.035, tilt: 0.22, roll });
    }
    for (const sgn of [-1, 1]) this._strand(c.hairStyle === 'short' ? 0.4 : 0.62, 0.075, hair, 16, sgn * 74, { off: 0.03, hang: 0.75, tilt: -0.05 });
    if (c.ahoge) {
      this._strand(0.2, 0.03, hair, 84, 10, { off: 0.02, tilt: Math.PI - 0.6, roll: 0.3 });
      this._strand(0.15, 0.025, hair, 84, -15, { off: 0.02, tilt: Math.PI - 0.9, roll: -0.4 });
    }
    P.sway = [];
    if (c.hairStyle === 'long') {
      const sheet = mesh(new THREE.CapsuleGeometry(0.36, 0.72, 8, 18), hair, 0.006);
      sheet.scale.set(1.15, 1, 0.38); sheet.position.set(0, -0.56, -0.25);
      const sg = new THREE.Group(); sg.add(sheet); headG.add(sg); P.sway.push(sg);
      for (const lon of [115, 140, 165, 195, 220, 245]) P.sway.push(this._strand(1.0, 0.11, hair, 5, lon, { off: 0.03, hang: 1, tilt: -0.06 }));
    } else if (c.hairStyle === 'twintail') {
      for (const sgn of [-1, 1]) {
        P.sway.push(this._strand(1.0, 0.15, hair, 30, sgn * 118, { off: 0.04, hang: 1, tilt: -0.45 }));
        const tie = mesh(new THREE.SphereGeometry(0.045, 12, 10), toon(c.bowColor), 0.004); this._onHead(tie, 30, sgn * 118, 0.06);
      }
      for (const lon of [150, 180, 210]) this._strand(0.42, 0.1, hair, 0, lon, { off: 0.03, hang: 1 });
    } else if (c.hairStyle === 'ponytail') {
      P.sway.push(this._strand(0.95, 0.15, hair, 38, 180, { off: 0.05, hang: 1, tilt: -0.55 }));
      const tie = mesh(new THREE.SphereGeometry(0.05, 12, 10), toon(c.bowColor), 0.004); this._onHead(tie, 38, 180, 0.07);
      for (const lon of [150, 180, 210]) this._strand(0.38, 0.1, hair, -5, lon, { off: 0.03, hang: 1 });
    } else {
      const L = c.hairStyle === 'bob' ? 0.5 : 0.3;
      for (let lon = 95; lon <= 265; lon += 24) P.sway.push(this._strand(L, 0.1, hair, 8, lon, { off: 0.03, hang: 0.7, tilt: -0.08 }));
    }

    // หู
    P.ears = [];
    if (c.ears !== 'none') {
      const earM = toon(c.earColor), inM = toon(c.earInner);
      for (const sgn of [-1, 1]) {
        const g = new THREE.Group();
        if (c.ears === 'bunny') {
          const o = mesh(new THREE.CapsuleGeometry(0.06, 0.4, 4, 12), earM, 0.006); o.position.y = 0.25;
          const i = mesh(new THREE.CapsuleGeometry(0.035, 0.32, 4, 10), inM, 0); i.position.set(0, 0.24, 0.025);
          o.scale.z = i.scale.z = 0.45; g.add(o, i); g.rotation.x = Math.PI / 2 - 0.2;
          this._onHead(g, 72, sgn * 20, -0.02);
        } else {
          const h = c.ears === 'fox' ? 0.32 : 0.24, w = c.ears === 'fox' ? 0.12 : 0.125;
          const o = mesh(new THREE.ConeGeometry(w, h, 20), earM, 0.006);
          const i = mesh(new THREE.ConeGeometry(w * 0.62, h * 0.72, 16), inM, 0); i.position.set(0, -0.02, 0.035);
          o.scale.z = i.scale.z = 0.5; g.add(o, i); g.rotation.x = Math.PI / 2;
          g.position.z = h * 0.3;
          this._onHead(g, 58, sgn * 38, 0);
        }
        P.ears.push(g);
      }
    }

    // เครื่องประดับ
    if (c.bow) { const b = this._bow(new THREE.Group(), c.bowColor, 1.3); this._onHead(b.parent, 42, -60, 0.06); b.parent.children[0].rotation.z = 0.5; }
    if (c.clip) {
      const cg = new THREE.Group();
      const face = mesh(new THREE.SphereGeometry(0.045, 14, 10), toon('#e4e1ea'), 0.004); face.scale.z = 0.45; cg.add(face);
      for (const sgn of [-1, 1]) {
        const e = mesh(new THREE.ConeGeometry(0.02, 0.035, 8), toon('#e4e1ea'), 0.003); e.position.set(sgn * 0.026, 0.04, 0); e.rotation.z = -sgn * 0.3; cg.add(e);
        const d = new THREE.Mesh(new THREE.CircleGeometry(0.006, 8), flat('#2a1830')); d.position.set(sgn * 0.015, 0.005, 0.022); cg.add(d);
      }
      this._onHead(cg, 30, -42, 0.06);
      const xg = new THREE.Group();
      for (const r of [0.7, -0.7]) { const bar = mesh(new THREE.BoxGeometry(0.1, 0.014, 0.012), toon(c.bowColor), 0.003); bar.rotation.z = r; xg.add(bar); }
      this._onHead(xg, 14, -50, 0.05);
    }
    if (c.glasses) {
      const gm = toon('#3a2a44');
      for (const sgn of [-1, 1]) { const r = mesh(new THREE.TorusGeometry(0.075, 0.008, 8, 28), gm, 0); this._onHead(r, -6, sgn * 24, 0.05); }
      const br = mesh(new THREE.BoxGeometry(0.06, 0.01, 0.01), gm, 0); this._onHead(br, -2, 0, 0.06);
    }
    if (c.headphones) {
      const band = mesh(new THREE.TorusGeometry(0.47, 0.025, 8, 36, Math.PI), toon(c.outfitAccent), 0.004); band.position.y = 0.02; headG.add(band);
      for (const sgn of [-1, 1]) {
        const cup = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 20), white, 0.005); cup.rotation.z = Math.PI / 2; cup.position.set(sgn * 0.45, 0.02, 0); headG.add(cup);
        const pad = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.075, 20), toon(c.outfitAccent), 0); pad.rotation.z = Math.PI / 2; pad.position.set(sgn * 0.47, 0.02, 0); headG.add(pad);
      }
    }
    if (c.outfit === 'maid') {
      const fr = mesh(new THREE.TorusGeometry(0.445, 0.035, 6, 30, Math.PI), white, 0.004); fr.rotation.x = -0.35; fr.position.set(0, 0.02, 0.03); headG.add(fr);
    }

    this.update(0);
  }

  _bow(parent, color, size = 1) {
    const g = new THREE.Group(), m = toon(color);
    for (const sgn of [-1, 1]) {
      const lobe = mesh(new THREE.ConeGeometry(0.05 * size, 0.1 * size, 14), m, 0.004);
      lobe.rotation.z = sgn * Math.PI / 2; lobe.position.x = -sgn * 0.05 * size; lobe.scale.z = 0.5; g.add(lobe);
      const tail = mesh(new THREE.BoxGeometry(0.022 * size, 0.07 * size, 0.008), m, 0.003);
      tail.position.set(sgn * 0.018 * size, -0.045 * size, -0.004); tail.rotation.z = sgn * 0.35; g.add(tail);
    }
    const knot = mesh(new THREE.SphereGeometry(0.022 * size, 12, 10), m, 0.004); knot.scale.z = 0.7; g.add(knot);
    parent.add(g); return g;
  }

  update(dt) {
    const s = this.s, P = this.p, t = (s.t += dt);
    const lerp = (a, b, k) => a + (b - a) * Math.min(1, k);
    // กะพริบตา
    s.blinkT -= dt; if (s.blinkT <= 0) { s.blinkPh = 0.13; s.blinkT = 2 + Math.random() * 3.5; }
    const blink = s.blinkPh > 0; if (blink) s.blinkPh -= dt;
    if (s.emoHold > 0) { s.emoHold -= dt; if (s.emoHold <= 0) s.emotion = 'neutral'; }
    const e = s.emotion;
    // ปาก
    const target = s.talking ? (0.3 + 0.7 * Math.abs(Math.sin(t * 12.5 + Math.sin(t * 4.3) * 2))) * (0.65 + 0.35 * Math.random()) : 0;
    s.mouth = lerp(s.mouth, target, dt * 18);

    // ท่าทาง
    const idle = { raise: 0.12, fwd: 0.05 + (s.talking ? Math.sin(t * 3) * 0.06 : 0), elbow: 0.18, fz: 0 };
    let L = { ...idle }, R = { ...idle, fwd: 0.05 + (s.talking ? Math.sin(t * 3 + 1.4) * 0.08 : 0) };
    let lean = 0, nod = 0, tilt = 0, bounce = 0, finger = false;
    if (s.gesture) {
      const gs = s.gesture; gs.t += dt;
      const env = Math.min(1, gs.t / 0.3, (gs.dur - gs.t) / 0.35);
      const k = Math.max(0, env), gt = gs.t;
      const mix = (a, b) => { for (const key in b) a[key] = a[key] + (b[key] - a[key]) * k; };
      switch (gs.name) {
        case 'wave': mix(R, { raise: 2.5, fwd: 0.25, elbow: 0.55, fz: Math.sin(gt * 10) * 0.45 }); tilt = 0.12 * k; break;
        case 'point': mix(R, { raise: 0.3, fwd: 1.35, elbow: 0.2 }); finger = k > 0.5; tilt = -0.12 * k; break;
        case 'paw': mix(L, { raise: 0.25, fwd: 1.45, elbow: 1.9, fz: Math.sin(gt * 8) * 0.25 }); mix(R, { raise: 0.25, fwd: 1.45, elbow: 1.9, fz: -Math.sin(gt * 8) * 0.25 }); tilt = 0.15 * k; break;
        case 'cheer': mix(L, { raise: 2.7, fwd: 0.1, elbow: 0.3 }); mix(R, { raise: 2.7, fwd: 0.1, elbow: 0.3 }); bounce = Math.abs(Math.sin(gt * 7)) * 0.04 * k; break;
        case 'think': mix(R, { raise: 0.15, fwd: 0.95, elbow: 2.25 }); tilt = 0.2 * k; break;
        case 'heart': mix(L, { raise: 0.55, fwd: 1.0, elbow: 1.55, fz: -0.4 }); mix(R, { raise: 0.55, fwd: 1.0, elbow: 1.55, fz: 0.4 }); tilt = 0.1 * k; break;
        case 'nod': nod = Math.sin(gt * 9) * 0.16 * k; break;
        case 'bow': lean = 0.35 * k; break;
      }
      if (gs.t >= gs.dur) s.gesture = null;
    }
    for (const side of ['L', 'R']) {
      const tgt = side === 'L' ? L : R, cur = s.arms[side], a = P.arm[side];
      for (const key in tgt) cur[key] = lerp(cur[key], tgt[key], dt * 9);
      a.sh.rotation.set(-cur.fwd, 0, a.sgn * cur.raise);
      a.el.rotation.set(-cur.elbow, 0, cur.fz);
    }
    P.arm.R.finger.visible = finger;
    s.lean = lerp(s.lean, lean, dt * 6); s.bounce = lerp(s.bounce, bounce, dt * 10);
    P.body.position.y = Math.sin(t * 1.6) * 0.006 + s.bounce;
    P.upper.rotation.x = s.lean;
    P.torso.scale.y = 1 + Math.sin(t * 1.6) * 0.012;

    // ศีรษะ
    s.lookCur.x = lerp(s.lookCur.x, s.look.x, dt * 4); s.lookCur.y = lerp(s.lookCur.y, s.look.y, dt * 4);
    const hx = s.headExtra;
    hx.x = lerp(hx.x, nod + (e === 'sad' ? 0.12 : 0), dt * 8);
    hx.z = lerp(hx.z, tilt + (e === 'shy' ? 0.15 : 0), dt * 6);
    P.headPivot.rotation.set(-s.lookCur.y * 0.18 + hx.x, s.lookCur.x * 0.38 + Math.sin(t * 0.5) * 0.05, Math.sin(t * 0.7) * 0.035 + hx.z);
    for (const g of P.sway) g.rotation.z = (g.userData.rz0 ??= g.rotation.z) + Math.sin(t * 1.3 + g.id) * 0.03;
    // หูกระดิก
    s.earT -= dt; if (s.earT <= 0) { s.earPh = 0.35; s.earT = 3 + Math.random() * 5; }
    if (s.earPh > 0) s.earPh -= dt;
    P.ears.forEach((g, i) => { g.rotation.z = s.earPh > 0 ? Math.sin(s.earPh * 40) * 0.15 * (i ? 1 : -1) : 0; });

    // สีหน้า
    const happy = e === 'happy';
    for (const side of ['L', 'R']) {
      const E = P.eyes[side];
      const winkThis = e === 'wink' && side === 'L';
      const arcMode = happy || winkThis || blink;
      E.open.visible = !arcMode;
      E.arc.visible = arcMode;
      E.arc.scale.y = happy || winkThis ? 0.9 : 0.35;
      E.arc.position.y = happy || winkThis ? -0.01 : -0.03;
      const sy = e === 'surprised' ? 1.12 : e === 'angry' ? 0.86 : 1;
      E.open.scale.y = lerp(E.open.scale.y, sy, dt * 10);
      const inward = E.sgn; // ด้านในของคิ้ว
      const rz = e === 'angry' ? -inward * 0.38 : e === 'sad' ? inward * 0.32 : -inward * 0.06;
      E.brow.rotation.z = lerp(E.brow.rotation.z, rz, dt * 10);
      E.brow.position.y = lerp(E.brow.position.y, e === 'surprised' ? 0.035 : 0, dt * 10);
    }
    const talkOpen = s.mouth > 0.05;
    const forceOpen = e === 'surprised';
    P.open.visible = talkOpen || forceOpen;
    P.smile.visible = !P.open.visible;
    P.fangClosed.visible = this.config.fang && P.smile.visible && e !== 'sad';
    const ow = forceOpen && !talkOpen ? 0.55 : 1, oh = forceOpen && !talkOpen ? 0.7 : 0.2 + s.mouth * 0.75;
    P.open.scale.set(ow, oh, 1);
    if (e === 'sad' || e === 'angry') { P.smile.rotation.z = 0; P.smile.position.y = -0.028; }
    else { P.smile.rotation.z = Math.PI; P.smile.position.y = 0.012; }
    const bl = e === 'shy' ? 0.75 : happy ? 0.5 : this.config.blush ? 0.32 : 0;
    for (const b of P.blush) b.material.opacity = lerp(b.material.opacity, bl, dt * 5);
  }
}

// ฟังก์ชันช่วยตั้งฉากพื้นฐาน (แสง/เรนเดอร์) ใช้ร่วมกันสองหน้า
export function createRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}
export function addLights(scene, tint = 0xd8c8ff) {
  scene.add(new THREE.HemisphereLight(0xffffff, tint, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(1.5, 3, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb48cff, 1.2); rim.position.set(-2, 2, -2); scene.add(rim);
}
export { THREE };
