// ===== Anime Image Bot — Cloudflare Worker (Flux schnell + D1 + Cron) =====
// Bindings ที่ต้องตั้งใน Cloudflare:  AI (Workers AI),  DB (D1: anime-bot-db)
// Variables (Secret):  PASSWORD   | ไม่บังคับ: TG_TOKEN, TG_CHAT (แจ้งเตือน Telegram)
// วิดีโอ (ไม่บังคับ): KAGGLE_USERNAME, KAGGLE_KEY → ทำวิดีโอด้วย GPU ฟรีของ Kaggle อัตโนมัติ
// Cron Trigger:  * * * * *   (บอทเช็คทุกนาที แต่สร้างภาพตามระยะห่างที่ตั้งในเว็บ)
// ใช้คู่กับ studio.html แท็บ "เจนภาพ" (เรียก API นี้ข้ามโดเมน จึงเปิด CORS ไว้ · ป้องกันด้วย PASSWORD)

import SCENES from './scenes.json';
import IDEAS from './ideas.json';
import SFXLIB from './sfx.json';
import MUSICLIB from './music.json';
import VFXLIB from './vfx.json';
import WORLD from './world.json'; // คลังโลก: อาวุธ พลังอาคม ของวิเศษ โลกและจักรวาล (400 รายการ) // คลังไอเดีย 600 รายการ (ตัวละคร ชุด พร็อพ สัตว์ องค์ประกอบฉาก เอฟเฟกต์) พร้อมรหัส CHR/COS/PRP/CRT/ELM/FX // คลัง 1000 ฉากอนิเมะของผู้ใช้ (Anime_Scene_Library_1000.xlsx) ใช้สุ่มแคสติ้งหมวดฉาก
const MODEL = '@cf/black-forest-labs/flux-1-schnell';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (p === '/') return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    if (p.startsWith('/k/')) return (await vRoutes(req, env, url, ctx).catch(e => json({ error: String(e.message || e) }, 500)));
    if (p.startsWith('/h/')) return (await helperScript(env, url).catch(e => new Response('# error: ' + String(e.message || e), { status: 500 })));
    if (!authOK(req, url, env)) return json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
    await ensureSchema(env);
    if (selfUrl !== url.origin) { selfUrl = url.origin; ctx.waitUntil(setSetting(env, 'self_url', url.origin)); }
    try {
      if (p === '/api/vstate' || p.startsWith('/vid/')) return await vApi(req, env, url, ctx, {});
      if (p === '/api/vcast') return await castApi(req, env, url, {});
      if (p === '/api/ping') return json({ ok: true, bot: 'anime-image-bot', github: !!(env.GH_TOKEN && env.GH_REPO) });
      if (p === '/api/state') return json(await getState(env));
      if (p.startsWith('/img/')) return getImage(env, +p.split('/')[2]);
      if (p === '/api/zip') return makeZip(env, url.searchParams.get('project') || '', url.searchParams.get('starred') === '1');
      if (req.method !== 'POST') return json({ error: 'not found' }, 404);
      const body = await req.json().catch(() => ({}));
      if (p.startsWith('/api/vcast')) { const cr = await castApi(req, env, url, body); if (cr) return cr; }
      if (p.startsWith('/api/v')) { const vr = await vApi(req, env, url, ctx, body); if (vr) return vr; }
      if (p === '/api/enqueue') return json(await enqueue(env, body));
      if (p === '/api/settings') {
        for (const k of ['interval_min', 'style', 'character', 'steps', 'pace', 'slots'])
          if (body[k] !== undefined) await setSetting(env, k, String(body[k]));
        return json({ ok: true });
      }
      if (p === '/api/star') { await env.DB.prepare('UPDATE images SET starred=1-starred WHERE id=?').bind(body.id).run(); return json({ ok: true }); }
      if (p === '/api/delete') { await env.DB.prepare('DELETE FROM images WHERE id=?').bind(body.id).run(); return json({ ok: true }); }
      if (p === '/api/regen') {
        const im = await env.DB.prepare('SELECT project,scene,prompt FROM images WHERE id=?').bind(body.id).first();
        if (im) await env.DB.prepare("INSERT INTO jobs (project,scene,prompt,status,created) VALUES (?,?,?,'queued',?)").bind(im.project, im.scene, im.prompt, Date.now()).run();
        return json({ ok: true });
      }
      if (p === '/api/runnow') return json(await tick(env, true));
      if (p === '/api/push') return json(await ghPush(env, body.path, body.b64, body.message));
      if (p === '/api/resume') { await setSetting(env, 'paused_until', '0'); await env.DB.prepare("UPDATE jobs SET status='queued' WHERE status IN ('running','failed')").run(); return json({ ok: true }); }
      if (p === '/api/clearqueue') { await env.DB.prepare("DELETE FROM jobs WHERE status IN ('queued','failed')").run(); return json({ ok: true }); }
      if (p === '/api/clearnotices') { await env.DB.prepare('DELETE FROM notices').run(); return json({ ok: true }); }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String(e.message || e) }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    await ensureSchema(env);
    ctx.waitUntil(tick(env, false));
    ctx.waitUntil(autoHeal(env).catch(() => {}).then(() => vTick(env, false)).catch(e => setSetting(env, 'k_error', String(e.message || e).slice(0, 300))));
    ctx.waitUntil(castBatch(env, 0, false).catch(() => {}));
    ctx.waitUntil(libDaily(env, false).catch(() => {}));
  },
};

// ---------- ซ่อมงานที่พังอัตโนมัติ ----------
// งานวิดีโอ/เสียงที่พัง: รอ 2 ชม. (เผื่อแก้โค้ดหรือเครื่องว่าง) แล้วส่งกลับเข้าคิวเอง สูงสุด 6 ครั้ง
// ภาพที่พัง (ไม่ใช่เพราะโควตา): ลองใหม่เองสูงสุด 2 รอบ
async function autoHeal(env) {
  const s = await getSettings(env), now = Date.now();
  if (now - (+s.heal_last || 0) < 30 * 60000) return;
  await setSetting(env, 'heal_last', String(now));
  const v = await env.DB.prepare("UPDATE vjobs SET status='queued', error='🔧 ซ่อมอัตโนมัติ: '||substr(COALESCE(error,''),1,300) WHERE status='failed' AND tries<6 AND COALESCE(started,0)<?").bind(now - 120 * 60000).run();
  const i = await env.DB.prepare("UPDATE jobs SET status='queued', heal=COALESCE(heal,0)+1 WHERE status='failed' AND COALESCE(heal,0)<2").run();
  const n = (v.meta?.changes || 0) + (i.meta?.changes || 0);
  if (n) await setSetting(env, 'heal_note', `${new Date(now).toISOString()} ส่งงานที่พังกลับเข้าคิว ${n} งาน`);
}

// ---------- core ----------
// ช่วงเวลาทำภาพ (ชั่วโมงเวลาไทย) เช่น "7,12,18,22" · งบต่อช่วง = โควตาฟรี ~8,500 neurons/วัน ÷ จำนวนช่วง
function slotList(s) {
  const a = String(s.slots || '7,12,18,22').split(/[,\s]+/).map(Number).filter(h => h >= 0 && h < 24);
  return [...new Set(a)].sort((x, y) => x - y).length ? [...new Set(a)].sort((x, y) => x - y) : [7, 12, 18, 22];
}
async function slotCheck(env, s, now) {
  if (s.pace === '0') return { full: false };
  const hrs = slotList(s), b = new Date(now + 7 * 3600000);
  const day0 = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - 7 * 3600000; // 00:00 เวลาไทย
  const h = b.getUTCHours() + b.getUTCMinutes() / 60;
  const cur = [...hrs].reverse().find(x => x <= h);
  const start = cur === undefined ? day0 - 86400000 + hrs[hrs.length - 1] * 3600000 : day0 + cur * 3600000; // ก่อนช่วงแรกของวัน = ยังเป็นช่วงสุดท้ายของเมื่อวาน
  const nxt = hrs.find(x => x > h);
  const next = nxt === undefined ? day0 + 86400000 + hrs[0] * 3600000 : day0 + nxt * 3600000;
  if (String(start) !== s.slot_start) { await setSetting(env, 'slot_start', String(start)); await setSetting(env, 'slot_n', '0'); s.slot_n = '0'; }
  const nx = await env.DB.prepare("SELECT steps FROM jobs WHERE status='queued' ORDER BY id LIMIT 1").first();
  const st = Math.min(8, Math.max(1, +(nx && nx.steps) || +s.steps || 4)), per = 19.2 + 9.6 * st;
  const budget = Math.max(1, Math.floor(8500 / hrs.length / per));
  const info = JSON.stringify({ start, next, n: +s.slot_n || 0, budget });
  if (info !== s.slot_info) await setSetting(env, 'slot_info', info);
  return { full: (+s.slot_n || 0) >= budget };
}
async function tick(env, force) {
  const s = await getSettings(env);
  const now = Date.now();
  if (!force) {
    if (now < +s.paused_until) return { skipped: 'paused' };
    if (now - +s.last_run < (+s.interval_min || 1) * 60000 - 15000) return { skipped: 'wait' };
    const sl = await slotCheck(env, s, now); // แบ่งทำเป็นช่วงเวลา แต่ละช่วงมีโควตาของตัวเอง
    if (sl.full) return { skipped: 'slot full' };
    if (now - +s.last_run > 180000) await env.DB.prepare("UPDATE jobs SET status='queued' WHERE status='running'").run();
  }
  const job = await env.DB.prepare("SELECT * FROM jobs WHERE status='queued' ORDER BY id LIMIT 1").first();
  if (!job) return { skipped: 'empty' };
  await setSetting(env, 'last_run', String(now));
  await env.DB.prepare("UPDATE jobs SET status='running' WHERE id=?").bind(job.id).run();
  try {
    const out = await env.AI.run(MODEL, { prompt: job.prompt.slice(0, 2048), steps: Math.min(8, Math.max(1, +job.steps || +s.steps || 4)) });
    if (!out || !out.image) throw new Error('AI ไม่ได้ส่งภาพกลับมา');
    await env.DB.prepare('INSERT INTO images (job_id,project,scene,prompt,data,starred,created) VALUES (?,?,?,?,?,0,?)')
      .bind(job.id, job.project, job.scene, job.prompt, out.image, Date.now()).run();
    await env.DB.prepare('DELETE FROM jobs WHERE id=?').bind(job.id).run();
    if (s.pace !== '0') await setSetting(env, 'slot_n', String((+s.slot_n || 0) + 1));
    const left = await env.DB.prepare("SELECT COUNT(*) n FROM jobs WHERE status='queued'").first();
    if (left.n === 0) await notify(env, `✅ คิวของโปรเจกต์ "${job.project}" เสร็จครบแล้ว เข้าไปเลือกภาพได้เลย`);
    return { done: true, left: left.n };
  } catch (e) {
    const msg = String(e.message || e);
    if (/neuron|allocation|quota|exceed|limit|4006|3036/i.test(msg)) {
      await env.DB.prepare("UPDATE jobs SET status='queued' WHERE id=?").bind(job.id).run();
      await setSetting(env, 'img_err', new Date().toISOString() + ' ' + msg.slice(0, 400));
      const d = new Date(); d.setUTCHours(24, 2, 0, 0);
      // เพิ่งผ่านเที่ยงคืน UTC ไม่นาน แต่ Cloudflare ยังบอกว่าโควตาหมด → โควตาอาจรีเซ็ตช้า ลองใหม่ทุก 30 นาที แทนที่จะรอข้ามวัน
      const early = new Date().getUTCHours() < 6;
      await setSetting(env, 'paused_until', String(early ? Date.now() + 30 * 60000 : d.getTime()));
      await notify(env, '⏸ โควตาสร้างภาพฟรีของวันนี้หมดแล้ว บอทจะกลับมาทำต่อเองประมาณ 07:00 น. (เวลาไทย)');
      return { paused: true };
    }
    await env.DB.prepare("UPDATE jobs SET status='failed', error=? WHERE id=?").bind(msg.slice(0, 300), job.id).run();
    await notify(env, `⚠️ สร้างภาพฉาก ${job.scene} ไม่สำเร็จ: ${msg.slice(0, 120)}`);
    return { error: msg };
  }
}

async function enqueue(env, b) {
  const project = (b.project || 'โปรเจกต์ใหม่').trim().slice(0, 60);
  const s0 = await getSettings(env);
  // แบบส่งจากสตูดิโอ: items = [{scene, prompt}] กำหนดเลขฉากเอง · raw = ใช้ prompt ตามที่เขียนมา ไม่เติมตัวละคร/สไตล์
  if (Array.isArray(b.items) && b.items.length) {
    const variants = Math.min(8, Math.max(1, +b.variants || 1));
    const stmts = [];
    for (const it of b.items.slice(0, 200)) {
      const pr = String(it.prompt || '').trim();
      if (!pr) continue;
      const full = b.raw ? pr : [s0.character, pr, s0.style].filter(x => x && x.trim()).join(', ');
      for (let v = 0; v < variants; v++)
        stmts.push(env.DB.prepare("INSERT INTO jobs (project,scene,prompt,status,created) VALUES (?,?,?,'queued',?)").bind(project, +it.scene || 0, full, Date.now()));
    }
    if (!stmts.length) return { error: 'ไม่มี prompt' };
    await env.DB.batch(stmts);
    return { ok: true, added: stmts.length };
  }
  const lines = String(b.lines || '').split('\n').map(x => x.trim()).filter(Boolean);
  const variants = Math.min(8, Math.max(1, +b.variants || 1));
  if (!lines.length) return { error: 'ยังไม่ได้ใส่ prompt' };
  const s = await getSettings(env);
  const max = await env.DB.prepare('SELECT MAX(scene) m FROM (SELECT scene FROM jobs WHERE project=? UNION ALL SELECT scene FROM images WHERE project=?)').bind(project, project).first();
  let scene = (max && max.m) || 0;
  const stmts = [];
  for (const line of lines) {
    scene++;
    const full = [s.character, line, s.style].filter(x => x && x.trim()).join(', ');
    for (let v = 0; v < variants; v++)
      stmts.push(env.DB.prepare("INSERT INTO jobs (project,scene,prompt,status,created) VALUES (?,?,?,'queued',?)").bind(project, scene, full, Date.now()));
  }
  await env.DB.batch(stmts);
  return { ok: true, added: stmts.length };
}

async function getState(env) {
  const s = await getSettings(env);
  const q = await env.DB.prepare("SELECT id,project,scene,prompt,status,error FROM jobs ORDER BY id LIMIT 200").all();
  const im = await env.DB.prepare('SELECT id,project,scene,prompt,starred,created FROM images ORDER BY project, scene, id').all();
  const n = await env.DB.prepare('SELECT id,msg,created FROM notices ORDER BY id DESC LIMIT 20').all();
  return { settings: s, jobs: q.results, images: im.results, notices: n.results, now: Date.now(), hasPassword: !!env.PASSWORD };
}

async function getImage(env, id) {
  const r = await env.DB.prepare('SELECT data FROM images WHERE id=?').bind(id).first();
  if (!r) return new Response('not found', { status: 404 });
  const bytes = b64ToBytes(r.data);
  const type = bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png' : bytes[0] === 0x52 && bytes[8] === 0x57 ? 'image/webp' : 'image/jpeg';
  return new Response(bytes, { headers: { 'content-type': type, 'cache-control': 'private, max-age=86400', ...CORS } });
}

// ---------- ZIP (stored, no compression) ----------
async function makeZip(env, project, starredOnly) {
  let sql = 'SELECT id,project,scene,data FROM images WHERE 1=1';
  const args = [];
  if (project) { sql += ' AND project=?'; args.push(project); }
  if (starredOnly) sql += ' AND starred=1';
  sql += ' ORDER BY project, scene, id';
  const rows = (await env.DB.prepare(sql).bind(...args).all()).results;
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0, count = {};
  for (const r of rows) {
    const key = r.project + '_' + r.scene; count[key] = (count[key] || 0) + 1;
    const name = enc.encode(`${safe(r.project)}/scene${String(r.scene).padStart(2, '0')}_${String.fromCharCode(96 + count[key])}.jpg`);
    const data = b64ToBytes(r.data), crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, rows.length, true); end.setUint16(10, rows.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const blob = new Blob([...parts, ...central, new Uint8Array(end.buffer)]);
  return new Response(blob, { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="images.zip"`, ...CORS } });
}
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function safe(s) { return String(s).replace(/[\\/:*?"<>|]/g, '_'); }

// ---------- ส่งไฟล์ขึ้น GitHub (ฟรี) ให้ Claude ดึงไปใช้ต่อ ----------
// ต้องตั้ง Secret: GH_TOKEN (fine-grained token สิทธิ์ Contents: Read and write เฉพาะ repo นั้น), GH_REPO เช่น pps2005/anime-assets
async function ghPush(env, path, b64, message) {
  if (!env.GH_TOKEN || !env.GH_REPO) return { error: 'ยังไม่ได้ตั้ง GH_TOKEN / GH_REPO ใน Cloudflare' };
  path = String(path || '');
  if (!/^[A-Za-z0-9._\-\/]{1,200}$/.test(path) || path.includes('..')) return { error: 'ชื่อไฟล์ไม่ถูกต้อง' };
  if (!b64 || b64.length > 70e6) return { error: 'ไฟล์ว่างหรือใหญ่เกิน' };
  const url = `https://api.github.com/repos/${env.GH_REPO}/contents/${path}`;
  const h = { authorization: `Bearer ${env.GH_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'anime-image-bot', 'content-type': 'application/json' };
  let sha;
  const g = await fetch(url, { headers: h });
  if (g.ok) sha = (await g.json()).sha;
  const r = await fetch(url, { method: 'PUT', headers: h, body: JSON.stringify({ message: message || `studio: ${path}`, content: b64, ...(sha ? { sha } : {}) }) });
  if (!r.ok) return { error: `GitHub ${r.status}: ${(await r.text()).slice(0, 160)}` };
  return { ok: true, path };
}

// ---------- helpers ----------
function authOK(req, url, env) {
  if (!env.PASSWORD) return true;
  return (url.searchParams.get('k') || req.headers.get('x-key')) === env.PASSWORD;
}
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,x-key', 'access-control-max-age': '86400' };
function json(o, status = 200) { return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...CORS } }); }
function b64ToBytes(b64) { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
async function getSettings(env) {
  const r = await env.DB.prepare('SELECT key,value FROM settings').all();
  const s = { interval_min: '2', style: '', character: '', steps: '4', paused_until: '0', last_run: '0', pace: '1', slots: '7,12,18,22' };
  for (const x of r.results) s[x.key] = x.value;
  return s;
}
async function setSetting(env, k, v) { await env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k, v).run(); }
async function notify(env, msg) {
  await env.DB.prepare('INSERT INTO notices (msg,created) VALUES (?,?)').bind(msg, Date.now()).run();
  if (env.TG_TOKEN && env.TG_CHAT) {
    try { await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: env.TG_CHAT, text: msg }) }); } catch (e) {}
  }
}
let schemaReady = false;
let selfUrl = '';
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT, scene INTEGER, prompt TEXT, status TEXT DEFAULT 'queued', error TEXT, created INTEGER, steps INTEGER, heal INTEGER DEFAULT 0)"),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS images (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER, project TEXT, scene INTEGER, prompt TEXT, data TEXT, starred INTEGER DEFAULT 0, created INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS notices (id INTEGER PRIMARY KEY AUTOINCREMENT, msg TEXT, created INTEGER)'),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS vjobs (id INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT, ep TEXT, shot TEXT, prompt TEXT, neg TEXT, image TEXT, frames INTEGER, status TEXT DEFAULT 'queued', error TEXT, tries INTEGER DEFAULT 0, created INTEGER, started INTEGER, kind TEXT DEFAULT 'gen', opt TEXT, helper INTEGER DEFAULT 0)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS helpers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, key TEXT UNIQUE, on_ INTEGER DEFAULT 1, created INTEGER, seen INTEGER DEFAULT 0, done INTEGER DEFAULT 0, cur TEXT DEFAULT '')"),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER, project TEXT, ep TEXT, shot TEXT, prompt TEXT, size INTEGER, sec INTEGER, w INTEGER, h INTEGER, created INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS vchunks (vid INTEGER, idx INTEGER, data TEXT, PRIMARY KEY (vid, idx))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS vlog (id INTEGER PRIMARY KEY AUTOINCREMENT, msg TEXT, created INTEGER)'),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS casting (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT, cat TEXT DEFAULT 'char', name TEXT, descr TEXT, prompt TEXT, status TEXT DEFAULT 'pending', created INTEGER)"),
  ]);
  schemaReady = true;
}


// =====================================================================
// ===== วิดีโอ: คิว image-to-video → Kaggle (GPU ฟรี) → เก็บคลิปใน D1 =====
// Secrets ที่ต้องตั้งเพิ่ม:  KAGGLE_USERNAME, KAGGLE_KEY  (จาก kaggle.com/settings → API)
// Kaggle kernel ถูกส่งขึ้นและสั่งรันอัตโนมัติจาก cron เมื่อมีงานในคิว แล้วปิดเองเมื่อคิวว่าง
const KSLUG = 'anime-video-bot';
const VCHUNK = 1000000; // ไบต์ต่อแถว (D1 จำกัด ~2MB/แถว เก็บเป็น base64)
const VNEG = 'blurry, distorted face, deformed hands, extra fingers, morphing, flickering, sudden movement, text, watermark';

function kEnv(env, s) { // รับชื่อ secret ได้หลายแบบ: KAGGLE_KEY / Token · หรือกรอกในหน้าสตูดิโอ (เก็บใน settings)
  s = s || {};
  if (!env.KAGGLE_KEY) env.KAGGLE_KEY = env.Token || env.TOKEN || env.token || env.KAGGLE_TOKEN || s.k_key || '';
  if (!env.KAGGLE_USERNAME) env.KAGGLE_USERNAME = env.Username || env.USERNAME || env.username || env.KAGGLE_USER || s.k_user || '';
  env.KAGGLE_USERNAME = String(env.KAGGLE_USERNAME).trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?kaggle\.com\//, '').replace(/\/.*$/, '');
  env.KAGGLE_KEY = String(env.KAGGLE_KEY).trim();
  return env;
}
async function vRoutes(req, env, url, ctx) {
  const p = url.pathname;
  // ---- ฝั่ง Kaggle kernel (ยืนยันด้วย token แยก) ----
  if (p.startsWith('/k/')) {
    await ensureSchema(env);
    const s = await getSettings(env);
    const tk = url.searchParams.get('t') || '';
    let hid = 0, hname = '';
    if (!s.ktoken || tk !== s.ktoken) { // ผู้ช่วย: ใช้รหัสของตัวเอง ทำได้แค่รับงาน/ส่งงาน
      const h = tk.length > 20 ? await env.DB.prepare('SELECT id,name FROM helpers WHERE key=? AND on_=1').bind(tk).first() : null;
      if (!h) return json({ error: 'bad token' }, 401);
      hid = h.id; hname = h.name;
    }
    const id = +p.split('/')[3];
    if (hid && id && p !== '/k/claim' && p !== '/k/log') {
      const own = await env.DB.prepare('SELECT helper FROM vjobs WHERE id=?').bind(id).first();
      if (!own || own.helper !== hid) return json({ error: 'not your job' }, 403);
    }
    if (p === '/k/claim') {
      await env.DB.prepare("UPDATE vjobs SET status='queued' WHERE status='running' AND started < ?").bind(Date.now() - 150 * 60000).run();
      const j = await env.DB.prepare("UPDATE vjobs SET status='running', started=?, tries=tries+1, helper=? WHERE id=(SELECT id FROM vjobs WHERE status='queued' ORDER BY id LIMIT 1) AND status='queued' RETURNING id,project,ep,shot,prompt,neg,frames,kind,opt").bind(Date.now(), hid).first();
      if (hid) await env.DB.prepare('UPDATE helpers SET seen=?, cur=? WHERE id=?').bind(Date.now(), j ? String(j.project).slice(0, 120) : '', hid).run();
      if (!j) return json({});
      try { j.opt = JSON.parse(j.opt || '{}'); } catch { j.opt = {}; }
      if (!hid) await setSetting(env, 'k_seen', String(Date.now()));
      return json({ job: j });
    }
    if (p.startsWith('/k/img/')) {
      const r = await env.DB.prepare('SELECT image FROM vjobs WHERE id=?').bind(id).first();
      if (!r) return new Response('not found', { status: 404 });
      return new Response(b64ToBytes(r.image), { headers: { 'content-type': 'image/jpeg' } });
    }
    if (p.startsWith('/k/done/')) {
      const j = await env.DB.prepare('SELECT * FROM vjobs WHERE id=?').bind(id).first();
      if (!j) return json({ error: 'no job' }, 404);
      const buf = new Uint8Array(await req.arrayBuffer());
      if (buf.length < 1000) return json({ error: 'ไฟล์เล็กผิดปกติ' }, 400);
      const v = await env.DB.prepare('INSERT INTO videos (job_id,project,ep,shot,prompt,size,sec,w,h,created) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .bind(id, j.project, j.ep, j.shot, j.prompt, buf.length, +url.searchParams.get('sec') || 0, +url.searchParams.get('w') || 0, +url.searchParams.get('h') || 0, Date.now()).run();
      const vid = v.meta.last_row_id, st = [];
      for (let i = 0, n = 0; i < buf.length; i += VCHUNK, n++)
        st.push(env.DB.prepare('INSERT INTO vchunks (vid,idx,data) VALUES (?,?,?)').bind(vid, n, bytesToB64(buf.subarray(i, i + VCHUNK))));
      await env.DB.batch(st);
      await env.DB.prepare("UPDATE vjobs SET status='done', image='' WHERE id=?").bind(id).run();
      if (hid) await env.DB.prepare("UPDATE helpers SET done=done+1, seen=?, cur='' WHERE id=?").bind(Date.now(), hid).run();
      const left = await env.DB.prepare("SELECT COUNT(*) n FROM vjobs WHERE status IN ('queued','running')").first();
      if (left.n === 0) await notify(env, `🎞️ วิดีโอของ "${j.project}" ทำเสร็จครบแล้ว เข้าไปเลือกคลิปในหน้าช็อตได้เลย`);
      return json({ ok: true, vid });
    }
    if (p.startsWith('/k/fail/')) {
      const b = await req.json().catch(() => ({}));
      const j = await env.DB.prepare('SELECT tries,shot,project FROM vjobs WHERE id=?').bind(id).first();
      if (!j) return json({ ok: true });
      const again = b.requeue || j.tries < 2;
      await env.DB.prepare('UPDATE vjobs SET status=?, error=? WHERE id=?').bind(again ? 'queued' : 'failed', String(b.error || '').slice(0, 500), id).run();
      if (!again && j.tries >= 6) await notify(env, `⚠️ ทำช็อต ${j.shot} (${j.project}) ไม่สำเร็จหลังซ่อมเองหลายรอบ: ${String(b.error || '').slice(0, 140)}`);
      return json({ ok: true });
    }
    if (p === '/k/log') {
      const b = await req.json().catch(() => ({}));
      await env.DB.prepare('INSERT INTO vlog (msg,created) VALUES (?,?)').bind((hid ? `🤝 ${hname}: ` : '') + String(b.msg || '').slice(0, 600), Date.now()).run();
      await env.DB.prepare('DELETE FROM vlog WHERE id < (SELECT MAX(id) - 60 FROM vlog)').run();
      if (hid) await env.DB.prepare('UPDATE helpers SET seen=? WHERE id=?').bind(Date.now(), hid).run();
      else await setSetting(env, 'k_seen', String(Date.now()));
      return json({ ok: true });
    }
    return json({ error: 'not found' }, 404);
  }
  return null;
}

// ---- ฝั่งสตูดิโอ (ผ่าน PASSWORD แล้ว) ----
async function vApi(req, env, url, ctx, body) {
  const p = url.pathname;
  kEnv(env, await getSettings(env));
  if (p === '/api/vstate') {
    const s = await getSettings(env);
    const jobs = (await env.DB.prepare("SELECT id,project,ep,shot,status,error,tries,created,started,kind FROM vjobs WHERE status!='done' ORDER BY id LIMIT 300").all()).results;
    const videos = (await env.DB.prepare('SELECT id,job_id,project,ep,shot,prompt,size,sec,w,h,created FROM videos ORDER BY id DESC LIMIT 500').all()).results;
    const logs = (await env.DB.prepare('SELECT msg,created FROM vlog ORDER BY id DESC LIMIT 12').all()).results;
    const helpers = (await env.DB.prepare('SELECT id,name,key,on_,created,seen,done,cur FROM helpers ORDER BY id').all()).results;
    return json({ jobs, videos, logs, helpers, now: Date.now(), kaggle: { configured: !!(env.KAGGLE_USERNAME && env.KAGGLE_KEY), user: env.KAGGLE_USERNAME || '', hasKey: !!env.KAGGLE_KEY, status: s.k_status || '', checked: +s.k_checked || 0, pushed: +s.k_pushed || 0, seen: +s.k_seen || 0, error: s.k_error || '' } });
  }
  if (p.startsWith('/vid/')) return getVideo(req, env, +p.split('/')[2]);
  if (req.method !== 'POST') return null;
  if (p === '/api/venqueue') {
    const items = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
    const st = [];
    for (const it of items) {
      const img = String(it.image || '');
      if (!img || img.length > 1800000) continue;
      const opt = JSON.stringify({ hq: it.hq ? 1 : 0, fps: +it.fps === 12 ? 12 : 0 });
      st.push(env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,opt) VALUES (?,?,?,?,?,?,?,'queued',0,?,?)")
        .bind(String(body.project || 'โปรเจกต์').slice(0, 60), String(body.ep || ''), String(it.shot ?? ''), String(it.prompt || '').slice(0, 2000), String(it.neg || VNEG).slice(0, 800), img, Math.min(161, Math.max(17, +it.frames || 81)), Date.now(), opt));
    }
    if (!st.length) return json({ error: 'ไม่มีช็อตที่มีภาพคีย์' });
    await env.DB.batch(st);
    ctx.waitUntil(vTick(env, true));
    return json({ ok: true, added: st.length });
  }
  if (p === '/api/vconcat') {
    const urls = (Array.isArray(body.urls) ? body.urls : []).filter(u => /^https:\/\//.test(u)).slice(0, 400);
    if (urls.length < 1) return json({ error: 'ไม่มีคลิปให้รวม' });
    await env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,kind) VALUES (?,?,?,?,'','',0,'queued',0,?,'concat')")
      .bind(String(body.project || '').slice(0, 60), String(body.ep || ''), String(body.key || 'final').slice(0, 20), JSON.stringify(urls), Date.now()).run();
    ctx.waitUntil(vTick(env, true));
    return json({ ok: true, clips: urls.length });
  }
  if (p === '/api/vdel') { await env.DB.batch([env.DB.prepare('DELETE FROM vchunks WHERE vid=?').bind(body.id), env.DB.prepare('DELETE FROM videos WHERE id=?').bind(body.id)]); return json({ ok: true }); }
  if (p === '/api/vcancel') { await env.DB.prepare("DELETE FROM vjobs WHERE id=? AND status!='running'").bind(body.id).run(); return json({ ok: true }); }
  if (p === '/api/vhelperadd') {
    const name = String(body.name || '').trim().slice(0, 40) || 'ผู้ช่วย';
    const key = 'h' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    await env.DB.prepare('INSERT INTO helpers (name,key,on_,created) VALUES (?,?,1,?)').bind(name, key, Date.now()).run();
    return json({ ok: true, key });
  }
  if (p === '/api/vhelperset') {
    if (body.del) { await env.DB.prepare('DELETE FROM helpers WHERE id=?').bind(+body.id).run(); }
    else await env.DB.prepare('UPDATE helpers SET on_=? WHERE id=?').bind(body.on ? 1 : 0, +body.id).run();
    await env.DB.prepare("UPDATE vjobs SET status='queued' WHERE status='running' AND helper=?").bind(+body.id).run(); // คืนงานที่ค้างอยู่กับผู้ช่วยคนนี้
    return json({ ok: true });
  }
  if (p === '/api/vclear') { await env.DB.prepare("DELETE FROM vjobs WHERE status IN ('queued','failed')").run(); return json({ ok: true }); }
  if (p === '/api/vretry') { await env.DB.prepare("UPDATE vjobs SET status='queued', tries=0, error=NULL WHERE status='failed'").run(); ctx.waitUntil(vTick(env, true)); return json({ ok: true }); }
  if (p === '/api/vkick') return json(await vTick(env, true));
  if (p === '/api/vkaggle') {
    if (body.user !== undefined) await setSetting(env, 'k_user', String(body.user).trim().slice(0, 80));
    if (body.key) await setSetting(env, 'k_key', String(body.key).trim().slice(0, 300));
    await setSetting(env, 'k_pushed', '0'); await setSetting(env, 'k_error', '');
    ctx.waitUntil(vTick(env, true));
    return json({ ok: true });
  }
  return null;
}

async function getVideo(req, env, id) {
  const rows = (await env.DB.prepare('SELECT data FROM vchunks WHERE vid=? ORDER BY idx').bind(id).all()).results;
  if (!rows.length) return new Response('not found', { status: 404, headers: CORS });
  const parts = rows.map(r => b64ToBytes(r.data)), len = parts.reduce((a, b) => a + b.length, 0), all = new Uint8Array(len);
  let o = 0; for (const x of parts) { all.set(x, o); o += x.length; }
  const h = { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=86400', ...CORS };
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (m) {
    let a = m[1] === '' ? len - +m[2] : +m[1], b = m[1] === '' || m[2] === '' ? len - 1 : Math.min(+m[2], len - 1);
    if (a < 0) a = 0;
    if (a >= len) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${len}`, ...CORS } });
    return new Response(all.subarray(a, b + 1), { status: 206, headers: { ...h, 'content-range': `bytes ${a}-${b}/${len}`, 'content-length': String(b - a + 1) } });
  }
  return new Response(all, { headers: { ...h, 'content-length': String(len) } });
}

// ---- สั่ง Kaggle: เรียกจาก cron ทุกนาที / ตอนเพิ่มงาน ----
function kAuth(env) {
  const k = env.KAGGLE_KEY || '';
  return k.startsWith('KGAT_') ? `Bearer ${k}` : 'Basic ' + btoa(`${env.KAGGLE_USERNAME}:${k}`);
}
async function kFetch(env, path, init) {
  const r = await fetch('https://www.kaggle.com/api/v1' + path, { ...init, headers: { authorization: kAuth(env), accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'anime-image-bot', ...((init && init.headers) || {}) } });
  const t = await r.text();
  let j = {}; try { j = JSON.parse(t); } catch (e) { j = { raw: t.slice(0, 200) }; }
  return { ok: r.ok, status: r.status, j };
}
async function vTick(env, force) {
  await ensureSchema(env);
  kEnv(env, await getSettings(env));
  if (!env.KAGGLE_USERNAME || !env.KAGGLE_KEY) return { skipped: 'no kaggle' };
  await ensureSchema(env);
  const q = await env.DB.prepare("SELECT COUNT(*) n FROM vjobs WHERE status='queued'").first();
  if (!q.n) return { skipped: 'empty' };
  const s = await getSettings(env), now = Date.now();
  if (!force && now - (+s.k_checked || 0) < 120000) return { skipped: 'wait' };
  if (now < (+s.k_pause || 0)) return { skipped: 'paused' };
  await setSetting(env, 'k_checked', String(now));
  const slug = `${env.KAGGLE_USERNAME}/${KSLUG}`;
  const stt = await kFetch(env, `/kernels/status?userName=${encodeURIComponent(env.KAGGLE_USERNAME)}&kernelSlug=${KSLUG}`);
  const status = String((stt.j && stt.j.status) || (stt.ok ? '' : 'none')).toLowerCase();
  await setSetting(env, 'k_status', status);
  if (/running|queued/.test(status)) {
    // กันกรณีเครื่องค้าง: ถ้าไม่ได้ยินเสียงจาก kernel เกิน 90 นาที ปล่อยให้รอบต่อไปจัดการ
    return { running: true, status };
  }
  if (now - (+s.k_pushed || 0) < 5 * 60000) return { skipped: 'recently pushed', status };
  if (/error/.test(status) && stt.j && stt.j.failureMessage) await setSetting(env, 'k_error', String(stt.j.failureMessage).slice(0, 300));
  if (!s.ktoken) { s.ktoken = crypto.randomUUID().replace(/-/g, ''); await setSetting(env, 'ktoken', s.ktoken); }
  if (!s.self_url) return { error: 'ยังไม่รู้ลิงก์ของบอท เปิดหน้าสตูดิโอ 1 ครั้งก่อน' };
  const text = KAGGLE_PY.replace('__API__', s.self_url).replace('__TOKEN__', s.ktoken).replace('__MAXH__', '10').replace('__QUANT__', s.k_quant || 'Q4_K_M');
  const push = await kFetch(env, '/kernels/push', { method: 'POST', body: JSON.stringify({ slug, newTitle: KSLUG, text, language: 'python', kernelType: 'script', isPrivate: true, enableGpu: true, enableTpu: false, enableInternet: true, machineShape: 'NvidiaTeslaT4', datasetDataSources: [], competitionDataSources: [], kernelDataSources: [], modelDataSources: [], categoryIds: [] }) });
  await setSetting(env, 'k_pushed', String(now));
  const err = !push.ok ? `Kaggle ${push.status}: ${JSON.stringify(push.j).slice(0, 220)}` : (push.j && (push.j.error || push.j.errorMessage)) || '';
  await setSetting(env, 'k_error', err);
  if (err) {
    if (/quota|limit|exceed/i.test(err)) { await setSetting(env, 'k_pause', String(now + 6 * 3600000)); await notify(env, '⏸ โควตา GPU ของ Kaggle สัปดาห์นี้น่าจะหมดแล้ว งานรออยู่ในคิว จะลองใหม่อีก 6 ชั่วโมง'); }
    else await notify(env, '⚠️ สั่ง Kaggle ไม่สำเร็จ: ' + err.slice(0, 160));
    return { error: err };
  }
  await setSetting(env, 'k_status', 'starting');
  return { pushed: true };
}

// ---- สคริปต์สำหรับผู้ช่วย (เปิดใน Kaggle ของตัวเอง) ----
async function helperScript(env, url) {
  await ensureSchema(env);
  const key = url.pathname.split('/')[2] || '';
  const h = key.length > 20 ? await env.DB.prepare('SELECT id,name FROM helpers WHERE key=? AND on_=1').bind(key).first() : null;
  if (!h) return new Response('print("รหัสผู้ช่วยนี้ใช้ไม่ได้แล้ว ติดต่อเจ้าของสตูดิโอ")\n', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const s = await getSettings(env);
  const text = KAGGLE_PY.replace('__API__', s.self_url || url.origin).replace('__TOKEN__', key).replace('__MAXH__', '11').replace('__QUANT__', s.k_quant || 'Q4_K_M');
  return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}

function bytesToB64(u) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }

const KAGGLE_PY = String.raw`# ===== anime-video-bot : Kaggle kernel (ส่งขึ้นอัตโนมัติจาก Worker anime-image-bot) =====
# ดึงงานจากเว็บ -> Wan 2.2 Image-to-Video (GGUF + LightX2V 4 steps) บน ComfyUI -> ส่ง mp4 กลับ
import os, sys, json, time, subprocess, urllib.request, urllib.error, random, shutil, glob, threading

API = "__API__"
TOKEN = "__TOKEN__"
MAXH = float("__MAXH__")
QUANT = "__QUANT__"
T0 = time.time()
UA = {"user-agent": "anime-video-bot/1.0"}


def call(path, data=None, raw=None, timeout=180):
    url = API + path + ("&" if "?" in path else "?") + "t=" + TOKEN
    hdr = dict(UA)
    body = None
    if raw is not None:
        body = raw
        hdr["content-type"] = "application/octet-stream"
    elif data is not None:
        body = json.dumps(data).encode()
        hdr["content-type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=hdr, method="POST" if body is not None else "GET")
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code < 500 or i == 3:
                raise
        except Exception:
            if i == 3:
                raise
        time.sleep(5 * (i + 1))


def J(path, data=None):
    out = call(path, data if data is not None else {})
    return json.loads(out or b"{}")


def log(m):
    print(m, flush=True)
    try:
        call("/k/log", {"msg": str(m)[:600]})
    except Exception as e:
        print("log fail", e, flush=True)


def sh(cmd, cwd=None, check=True):
    print("$", cmd, flush=True)
    p = subprocess.run(cmd, shell=True, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    print(p.stdout[-3000:], flush=True)
    if check and p.returncode != 0:
        raise RuntimeError("คำสั่งล้มเหลว: " + cmd[:80] + " :: " + p.stdout[-300:])
    return p.stdout


# ---------- เตรียมเครื่อง ----------
def pick_root():
    best, root = -1, "/tmp"
    for d in ["/kaggle/tmp", "/tmp", "/kaggle/working"]:
        try:
            os.makedirs(d, exist_ok=True)
            free = shutil.disk_usage(d).free
            if free > best:
                best, root = free, d
        except Exception:
            pass
    return root, best


ROOT, FREE = pick_root()
COMFY = os.path.join(ROOT, "ComfyUI")
M = {}
PORTS = []


def pick(files, *need, ext):
    c = [f for f in files if f.endswith(ext) and all(n.lower() in f.lower() for n in need)]
    c.sort(key=len)
    if not c:
        raise RuntimeError("หาไฟล์โมเดลไม่เจอ: " + " ".join(need))
    return c[0]


def setup():
    gpu = sh("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader", check=False).strip()
    log("เครื่องพร้อม GPU: %s · พื้นที่ว่าง %.0f GB ที่ %s" % (gpu or "ไม่พบ GPU!", FREE / 1e9, ROOT))
    if not gpu or "failed" in gpu.lower():
        raise RuntimeError("ไม่มี GPU — ตรวจว่าบัญชี Kaggle ยืนยันเบอร์โทรแล้ว และโควตา GPU ยังเหลือ")
    if not os.path.isdir(COMFY):
        sh("git clone --depth 1 https://github.com/comfyanonymous/ComfyUI " + COMFY)
        sh("git clone --depth 1 https://github.com/city96/ComfyUI-GGUF " + COMFY + "/custom_nodes/ComfyUI-GGUF")
        sh("git clone --depth 1 https://github.com/Fannovel16/ComfyUI-Frame-Interpolation " + COMFY + "/custom_nodes/ComfyUI-Frame-Interpolation", check=False)
    req = open(COMFY + "/requirements.txt").read().splitlines()
    keep = [r for r in req if r.strip() and not r.strip().startswith("#") and not r.split("=")[0].split(">")[0].split("<")[0].strip().lower() in ("torch", "torchvision", "torchaudio")]
    open("/tmp/req.txt", "w").write("\n".join(keep) + "\ngguf\nhuggingface_hub\n")
    sh("pip install -q -r /tmp/req.txt", check=False)
    fi = COMFY + "/custom_nodes/ComfyUI-Frame-Interpolation/requirements-no-cupy.txt"
    if os.path.exists(fi):
        sh("pip install -q -r " + fi, check=False)
    log("ติดตั้ง ComfyUI แล้ว")
    start_servers(gpu)


LOCK = threading.Lock()


def fetch(plan):
    from huggingface_hub import hf_hub_download
    errs = []

    def dl(item):
        kind, repo, f = item[:3]
        dst = os.path.join(COMFY, "models", kind, item[3] if len(item) > 3 else os.path.basename(f))
        try:
            if os.path.exists(dst):
                return
            p = hf_hub_download(repo, f, local_dir=os.path.join(ROOT, "hf"))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            os.symlink(p, dst)
        except Exception as e:
            errs.append(f + ": " + str(e)[:200])

    th = [threading.Thread(target=dl, args=(it,)) for it in plan]
    [t.start() for t in th]
    [t.join() for t in th]
    if errs:
        raise RuntimeError("โหลดโมเดลไม่สำเร็จ: " + " | ".join(errs))


def ensure_audio():
    with LOCK:
        if M.get("audio"):
            return
        log("กำลังโหลดโมเดลเสียง (ACE-Step เพลง + Stable Audio Open เสียงประกอบ)")
        fetch([("checkpoints", "Comfy-Org/ACE-Step_ComfyUI_repackaged", "all_in_one/ace_step_v1_3.5b.safetensors")])
        sao = None
        for repo in ("Comfy-Org/stable-audio-open-1.0_repackaged", "Comfy-Org/stable-audio-open-1.0"):
            try:  # ไฟล์ทางการที่ ComfyUI ทำไว้ให้ (รู้จักรุ่นโมเดลแน่นอน)
                fetch([("checkpoints", repo, "stable-audio-open-1.0.safetensors", "sao_official.safetensors")])
                sao = "sao_official.safetensors"
                log("โหลดไฟล์ Stable Audio ทางการจาก " + repo + " แล้ว")
                break
            except Exception as e:
                log("โหลด Stable Audio จาก %s ไม่ได้: %s" % (repo, str(e)[:200]))
                try:
                    os.remove(os.path.join(COMFY, "models", "checkpoints", "sao_official.safetensors"))
                except Exception:
                    pass
        if not sao:
            log("ใช้ไฟล์ Stable Audio สำรอง (อาจใช้ไม่ได้)")
            fetch([("checkpoints", "AEmotionStudio/stable-audio-open-models", "model.safetensors", "stable_audio_open_1.0.safetensors")])
            sao = "stable_audio_open_1.0.safetensors"
        fetch([("text_encoders", "google-t5/t5-base", "model.safetensors", "t5_base.safetensors")])
        fix_t5()
        M["sao"], M["t5"] = sao, "t5_base.safetensors"
        M["audio"] = True
        log("โมเดลเสียงพร้อม")


def fix_t5():
    # ไฟล์ T5 ของ google มี embedding แบบผูกกัน (tied) บางชื่อหายไป → ComfyUI โหลดไม่ครบ (meta tensor)
    # ทำไฟล์ใหม่ให้มีทั้ง shared.weight และ encoder.embed_tokens.weight และตัดส่วน decoder ที่ไม่ใช้ออก
    dst = os.path.join(COMFY, "models", "text_encoders", "t5_base.safetensors")
    try:
        from safetensors.torch import load_file, save_file
        sd = load_file(os.path.realpath(dst))
        emb = sd.get("shared.weight")
        if emb is None:
            emb = sd.get("encoder.embed_tokens.weight")
        out = {k: v.contiguous() for k, v in sd.items() if not k.startswith("decoder.") and k != "lm_head.weight"}
        if emb is not None:
            out["shared.weight"] = emb.contiguous()
            out["encoder.embed_tokens.weight"] = emb.clone().contiguous()
        log("แก้ไฟล์ T5: %d → %d keys (embedding %s)" % (len(sd), len(out), "พบ" if emb is not None else "ไม่พบ!"))
        os.remove(dst)
        save_file(out, dst)
    except Exception as e:
        log("แก้ไฟล์ T5 ไม่สำเร็จ: " + str(e)[:300])


def ensure_video():
    with LOCK:
        if M.get("high"):
            return
        load_video_models()


def load_video_models():
    log("กำลังโหลดโมเดลวิดีโอ (ครั้งแรกประมาณ 10–20 นาที)")
    from huggingface_hub import list_repo_files, hf_hub_download
    q = list_repo_files("QuantStack/Wan2.2-I2V-A14B-GGUF")
    r21 = list_repo_files("Comfy-Org/Wan_2.1_ComfyUI_repackaged")
    r22 = list_repo_files("Comfy-Org/Wan_2.2_ComfyUI_Repackaged")
    plan = [
        ("unet", "QuantStack/Wan2.2-I2V-A14B-GGUF", pick(q, "HighNoise", QUANT, ext=".gguf")),
        ("unet", "QuantStack/Wan2.2-I2V-A14B-GGUF", pick(q, "LowNoise", QUANT, ext=".gguf")),
        ("text_encoders", "Comfy-Org/Wan_2.1_ComfyUI_repackaged", pick(r21, "umt5", "fp8", ext=".safetensors")),
        ("vae", "Comfy-Org/Wan_2.1_ComfyUI_repackaged", pick(r21, "vae/wan_2.1_vae", ext=".safetensors")),
        ("loras", "Comfy-Org/Wan_2.2_ComfyUI_Repackaged", pick(r22, "i2v", "lightx2v", "high_noise", ext=".safetensors")),
        ("loras", "Comfy-Org/Wan_2.2_ComfyUI_Repackaged", pick(r22, "i2v", "lightx2v", "low_noise", ext=".safetensors")),
    ]
    errs = []

    def dl(item):
        kind, repo, f = item
        try:
            p = hf_hub_download(repo, f, local_dir=os.path.join(ROOT, "hf"))
            dst = os.path.join(COMFY, "models", kind, os.path.basename(f))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if not os.path.exists(dst):
                os.symlink(p, dst)
        except Exception as e:
            errs.append(f + ": " + str(e)[:200])

    th = [threading.Thread(target=dl, args=(it,)) for it in plan]
    [t.start() for t in th]
    [t.join() for t in th]
    if errs:
        raise RuntimeError("โหลดโมเดลไม่สำเร็จ: " + " | ".join(errs))
    b = lambda i: os.path.basename(plan[i][2])
    M.update(high=b(0), low=b(1), te=b(2), vae=b(3), lh=b(4), ll=b(5))
    log("โหลดโมเดลวิดีโอครบ: " + ", ".join(str(v) for v in M.values()))


def start_servers(gpu):
    n = max(1, len([l for l in gpu.splitlines() if l.strip()]))
    try:
        ram = int(open("/proc/meminfo").read().split()[1]) / 1e6
    except Exception:
        ram = 0
    if ram and ram < 24:
        n = 1
    for g in range(n):
        if g:
            time.sleep(20)
        port = 8188 + g
        env = dict(os.environ, CUDA_VISIBLE_DEVICES=str(g))
        lf = open(os.path.join(ROOT, "comfy%d.log" % g), "w")
        subprocess.Popen([sys.executable, "main.py", "--listen", "127.0.0.1", "--port", str(port), "--disable-auto-launch", "--temp-directory", os.path.join(ROOT, "ctmp%d" % g)], cwd=COMFY, stdout=lf, stderr=subprocess.STDOUT, env=env)
        for i in range(240):
            try:
                urllib.request.urlopen("http://127.0.0.1:%d/system_stats" % port, timeout=5).read()
                PORTS.append(port)
                break
            except Exception:
                time.sleep(3)
        else:
            log("ComfyUI การ์ดที่ %d เปิดไม่ขึ้น: %s" % (g + 1, open(os.path.join(ROOT, "comfy%d.log" % g)).read()[-300:]))
    if not PORTS:
        raise RuntimeError("ComfyUI เปิดไม่ขึ้นเลย")
    try:
        M["rife"] = "RIFE VFI" in comfy("/object_info/RIFE%20VFI", port=PORTS[0])
    except Exception:
        M["rife"] = False
    log("ComfyUI เปิดแล้ว %d การ์ด (RAM %.0f GB) · เติมเฟรม RIFE: %s" % (len(PORTS), ram, "พร้อม" if M["rife"] else "ไม่มี"))


def comfy(path, data=None, port=8188):
    req = urllib.request.Request("http://127.0.0.1:%d" % port + path, data=json.dumps(data).encode() if data is not None else None, headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        raise RuntimeError("ComfyUI ตอบ %s: %s" % (e.code, e.read()[:600].decode("utf8", "ignore")))


def size_for(w, h, area=640 * 640):
    w, h = max(1, w), max(1, h)
    s = (area / (w * h)) ** 0.5
    return max(256, int(round(w * s / 16)) * 16), max(256, int(round(h * s / 16)) * 16)


FFMPEG = shutil.which("ffmpeg")


def ffmpeg_bin():
    global FFMPEG
    if not FFMPEG:
        sh("pip install -q imageio-ffmpeg", check=False)
        import imageio_ffmpeg
        FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
    return FFMPEG


def gen(j, port=8188):
    ensure_video()
    # ช็อตสั้น (1–5 วิ) = รอบเดียว ยาวตามจริง · ช็อตยาว (>5 วิ) = เจนหลายรอบต่อกันจากเฟรมสุดท้าย
    total = max(17, int(j.get("frames") or 81))
    passes = 1 if total <= 81 else (total - 1 + 79) // 80
    F1 = min(81, max(17, 4 * round((total - 1) / 4) + 1)) if passes == 1 else 81
    opt = j.get("opt") or {}
    from PIL import Image
    import io
    img = Image.open(io.BytesIO(call("/k/img/%s" % j["id"]))).convert("RGB")
    seq, fps, t0, W, H = [], 16, time.time(), 0, 0
    for k in range(passes):
        frames, fps, W, H = gen_pass(j, img, k, port, F1, opt)
        seq += frames if k == 0 else frames[1:]
        img = Image.open(frames[-1]).convert("RGB")
    jid = j["id"]
    tmp = os.path.join(ROOT, "seq%s" % jid)
    os.makedirs(tmp, exist_ok=True)
    for i, f in enumerate(seq):
        shutil.move(f, os.path.join(tmp, "%05d.png" % i))
    out = os.path.join(COMFY, "output")
    for f in glob.glob(os.path.join(out, "job%s_*.png" % jid)):
        os.remove(f)
    mp4 = os.path.join(ROOT, "job%s.mp4" % jid)
    vf = "scale='if(gt(iw,ih),-2,1080)':'if(gt(iw,ih),1080,-2)':flags=lanczos,unsharp=5:5:0.6:5:5:0.0"
    if opt.get("fps") == 12:
        vf = "fps=12," + vf  # ลุคอนิเมะ: 12 ภาพ/วิ แบบวาดมือ
    sh('"%s" -y -loglevel error -framerate %d -i "%s/%%05d.png" -vf "%s" -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -movflags +faststart "%s"' % (ffmpeg_bin(), fps, tmp, vf, mp4))
    shutil.rmtree(tmp, ignore_errors=True)
    return mp4, time.time() - t0, W, H


def gen_pass(j, im, k, port=8188, F=81, opt=None):
    opt = opt or {}
    hq = bool(opt.get("hq"))
    ST = 8 if hq else 4  # ช็อตสำคัญ: 8 steps + ภาพใหญ่ขึ้น
    jid = "%s_p%d" % (j["id"], k)
    W, H = size_for(*im.size, area=(720 * 720 if hq else 640 * 640))
    fname = "job%s.jpg" % jid
    im.save(os.path.join(COMFY, "input", fname), quality=95)
    seed = random.randint(1, 2 ** 31)
    pos = j.get("prompt") or "subtle natural motion"
    neg = j.get("neg") or "blurry, distorted face, deformed hands, extra fingers, morphing, flickering, text, watermark"
    wf = {
        "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": M["high"]}},
        "2": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": M["low"]}},
        "3": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": M["lh"], "strength_model": 1.0}},
        "4": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["2", 0], "lora_name": M["ll"], "strength_model": 1.0}},
        "5": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["3", 0], "shift": 5.0}},
        "6": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["4", 0], "shift": 5.0}},
        "7": {"class_type": "CLIPLoader", "inputs": {"clip_name": M["te"], "type": "wan"}},
        "8": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["7", 0], "text": pos}},
        "9": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["7", 0], "text": neg}},
        "10": {"class_type": "VAELoader", "inputs": {"vae_name": M["vae"]}},
        "11": {"class_type": "LoadImage", "inputs": {"image": fname}},
        "12": {"class_type": "WanImageToVideo", "inputs": {"positive": ["8", 0], "negative": ["9", 0], "vae": ["10", 0], "start_image": ["11", 0], "width": W, "height": H, "length": F, "batch_size": 1}},
        "13": {"class_type": "KSamplerAdvanced", "inputs": {"model": ["5", 0], "add_noise": "enable", "noise_seed": seed, "steps": ST, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "positive": ["12", 0], "negative": ["12", 1], "latent_image": ["12", 2], "start_at_step": 0, "end_at_step": ST // 2, "return_with_leftover_noise": "enable"}},
        "14": {"class_type": "KSamplerAdvanced", "inputs": {"model": ["6", 0], "add_noise": "disable", "noise_seed": seed, "steps": ST, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "positive": ["12", 0], "negative": ["12", 1], "latent_image": ["13", 0], "start_at_step": ST // 2, "end_at_step": ST, "return_with_leftover_noise": "disable"}},
        "15": {"class_type": "VAEDecode", "inputs": {"samples": ["14", 0], "vae": ["10", 0]}},
        "16": {"class_type": "SaveImage", "inputs": {"images": ["15", 0], "filename_prefix": "job%s" % jid}},
    }
    fps = 16
    if M.get("rife") and opt.get("fps") != 12:
        # เติมเฟรม 16 → 48 fps ให้ลื่น (ถ้าพัง ใช้ผลเดิมจาก cache ไม่ต้องเจนใหม่)
        wf["17"] = {"class_type": "RIFE VFI", "inputs": {"ckpt_name": "rife47.pth", "frames": ["15", 0], "clear_cache_after_n_frames": 10, "multiplier": 3, "fast_mode": True, "ensemble": True, "scale_factor": 1.0}}
        wf["16"]["inputs"]["images"] = ["17", 0]
        fps = 48
    t = time.time()

    def run(w):
        pid = comfy("/prompt", {"prompt": w, "client_id": "bot"}, port=port)["prompt_id"]
        while True:
            time.sleep(5)
            h = comfy("/history/" + pid, port=port)
            if pid in h:
                st = h[pid].get("status", {})
                if st.get("status_str") == "error":
                    msgs = [m for m in st.get("messages", []) if m[0] == "execution_error"]
                    raise RuntimeError("เจนไม่สำเร็จ: " + json.dumps(msgs)[:500])
                return
            if time.time() - t > 7200:
                raise RuntimeError("เจนนานเกิน 120 นาที")
    try:
        run(wf)
    except Exception as e:
        if fps == 16:
            raise
        log("เติมเฟรมไม่สำเร็จ ใช้ 16fps แทน: " + str(e)[:200])
        M["rife"] = False
        wf.pop("17", None)
        wf["16"]["inputs"]["images"] = ["15", 0]
        fps = 16
        run(wf)
    out = os.path.join(COMFY, "output")
    frames = sorted(glob.glob(os.path.join(out, "job%s_*.png" % jid)))
    if not frames:
        raise RuntimeError("ไม่มีเฟรมออกมา")
    return frames, fps, W, H


# ---------- เสียง: เพลง (ACE-Step) / เสียงประกอบ (Stable Audio Open) ----------
def audio(j, port=8188):
    ensure_audio()
    opt = j.get("opt") or {}
    typ, sec = opt.get("type", "sfx"), max(3, min(120, int(opt.get("sec") or 10)))
    jid = "a%s" % j["id"]
    seed = random.randint(1, 2 ** 31)
    pr = j.get("prompt") or ""
    if typ == "music":
        wf = {
            "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "ace_step_v1_3.5b.safetensors"}},
            "2": {"class_type": "TextEncodeAceStepAudio", "inputs": {"clip": ["1", 1], "tags": pr, "lyrics": ("[verse]\nooh, aah, ooh\n[chorus]\nla la la, ooh aah" if opt.get("vocal") else "[instrumental]"), "lyrics_strength": 0.99}},
            "3": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["2", 0]}},
            "4": {"class_type": "EmptyAceStepLatentAudio", "inputs": {"seconds": sec, "batch_size": 1}},
            "5": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["1", 0], "shift": 5.0}},
            "6": {"class_type": "KSampler", "inputs": {"model": ["5", 0], "seed": seed, "steps": 50, "cfg": 5.0, "sampler_name": "euler", "scheduler": "simple", "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0], "denoise": 1.0}},
            "7": {"class_type": "VAEDecodeAudio", "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
            "8": {"class_type": "SaveAudio", "inputs": {"audio": ["7", 0], "filename_prefix": "aud%s" % jid}},
        }
    else:
        wf = {
            "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": M.get("sao", "stable_audio_open_1.0.safetensors")}},
            "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": M.get("t5", "t5_base.safetensors"), "type": "stable_audio"}},
            "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": pr}},
            "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": "music, speech, low quality, noise, distortion"}},
            "5": {"class_type": "ConditioningStableAudio", "inputs": {"positive": ["3", 0], "negative": ["4", 0], "seconds_start": 0.0, "seconds_total": float(sec)}},
            "6": {"class_type": "EmptyLatentAudio", "inputs": {"seconds": float(sec), "batch_size": 1}},
            "7": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "seed": seed, "steps": 50, "cfg": 4.98, "sampler_name": "dpmpp_3m_sde_gpu", "scheduler": "exponential", "positive": ["5", 0], "negative": ["5", 1], "latent_image": ["6", 0], "denoise": 1.0}},
            "8": {"class_type": "VAEDecodeAudio", "inputs": {"samples": ["7", 0], "vae": ["1", 2]}},
            "9": {"class_type": "SaveAudio", "inputs": {"audio": ["8", 0], "filename_prefix": "aud%s" % jid}},
        }
    t0 = time.time()
    pid = comfy("/prompt", {"prompt": wf, "client_id": "bot"}, port=port)["prompt_id"]
    while True:
        time.sleep(4)
        h = comfy("/history/" + pid, port=port)
        if pid in h:
            st = h[pid].get("status", {})
            if st.get("status_str") == "error":
                msgs = [m for m in st.get("messages", []) if m[0] == "execution_error"]
                raise RuntimeError("ทำเสียงไม่สำเร็จ: " + json.dumps(msgs)[:500])
            break
        if time.time() - t0 > 1800:
            raise RuntimeError("ทำเสียงนานเกิน 30 นาที")
    outs = sorted(glob.glob(os.path.join(COMFY, "output", "**", "aud%s_*" % jid), recursive=True))
    if not outs:
        raise RuntimeError("ไม่มีไฟล์เสียงออกมา")
    m4a = os.path.join(ROOT, "%s.m4a" % jid)
    sh('"%s" -y -loglevel error -i "%s" -af "afade=t=in:d=0.05,areverse,afade=t=in:d=0.3,areverse,loudnorm=I=-16:TP=-1.5" -c:a aac -b:a 192k -movflags +faststart -f mp4 "%s"' % (ffmpeg_bin(), outs[-1], m4a))
    for f in outs:
        os.remove(f)
    return m4a, time.time() - t0, 0, 0


# ---------- งานหลัก ----------
def concat(j):
    urls = json.loads(j.get("prompt") or "[]")
    d = os.path.join(ROOT, "cc%s" % j["id"])
    os.makedirs(d, exist_ok=True)
    files = []
    for i, u in enumerate(urls):
        f = os.path.join(d, "%03d.mp4" % i)
        req = urllib.request.Request(u, headers=UA)
        with urllib.request.urlopen(req, timeout=300) as r, open(f, "wb") as o:
            shutil.copyfileobj(r, o)
        files.append(f)
    ff = ffmpeg_bin()
    probe = sh('"%s" -i "%s" 2>&1 | grep -m1 "Video:" || true' % (ff, files[0]), check=False)
    import re
    m = re.search(r", (\d{3,4})x(\d{3,4})", probe)
    W, H = (int(m.group(1)), int(m.group(2))) if m else (1080, 1080)
    W, H = W // 2 * 2, H // 2 * 2
    ins = " ".join('-i "%s"' % f for f in files)
    parts = "".join("[%d:v]scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2,fps=30,setsar=1,format=yuv420p[v%d];" % (i, W, H, W, H, i) for i in range(len(files)))
    chain = "".join("[v%d]" % i for i in range(len(files)))
    out = os.path.join(ROOT, "job%s.mp4" % j["id"])
    sh('"%s" -y -loglevel error %s -filter_complex "%s%sconcat=n=%d:v=1:a=0[o]" -map "[o]" -c:v libx264 -preset veryfast -crf 18 -movflags +faststart "%s"' % (ff, ins, parts, chain, len(files), out))
    shutil.rmtree(d, ignore_errors=True)
    return out, 0, W, H


def work(job, port):
    if job.get("kind") == "concat":
        log("กำลังรวมคลิป %s → %s" % (job.get("project"), job.get("shot")))
        return concat(job)
    if job.get("kind") == "audio":
        log("เริ่มทำเสียง %s (การ์ด %d)" % (job.get("project"), port - 8187))
        return audio(job, port)
    log("เริ่มเจน %s ช็อต %s%s (การ์ด %d)" % (job.get("project"), job.get("shot"), " ⭐คุณภาพสูง" if (job.get("opt") or {}).get("hq") else "", port - 8187))
    return gen(job, port)


def heal(port, err):
    # ซ่อมเครื่องเอง: ล้างโมเดล/หน่วยความจำการ์ดจอ และโหลดโมเดลเสียงใหม่ถ้าไฟล์ T5 มีปัญหา
    e = err.lower()
    try:
        r = urllib.request.Request("http://127.0.0.1:%d/free" % port, data=json.dumps({"unload_models": True, "free_memory": True}).encode(), headers={"Content-Type": "application/json"})
        urllib.request.urlopen(r, timeout=60).read()
    except Exception:
        pass
    if "meta tensor" in e or "t5" in e:
        M["audio"] = False
    try:
        import torch
        torch.cuda.empty_cache()
    except Exception:
        pass
    time.sleep(10)
    log("🔧 ซ่อมอัตโนมัติ (การ์ด %d): ล้างหน่วยความจำแล้วลองงานเดิมอีกครั้ง" % (port - 8187))


def worker(port, first, stat):
    job = first
    healed = None
    while job:
        try:
            mp4, sec, W, H = work(job, port)
            data = open(mp4, "rb").read()
            call("/k/done/%s?sec=%d&w=%d&h=%d" % (job["id"], sec, W, H), raw=data, timeout=600)
            os.remove(mp4)
            stat["done"] += 1
            log("เสร็จช็อต %s ใน %d นาที (%d KB)" % (job.get("shot"), sec / 60, len(data) / 1024))
        except Exception as e:
            log("ช็อต %s พัง: %s" % (job.get("shot"), str(e)[:400]))
            if port and healed != job["id"]:  # ซ่อมแล้วลองใหม่ในเครื่องก่อน 1 ครั้ง
                healed = job["id"]
                heal(port, str(e))
                continue
            try:
                J("/k/fail/%s" % job["id"], {"error": str(e)[:500]})
            except Exception:
                pass
            try:  # ComfyUI การ์ดนี้ตายแล้ว → หยุดเฉพาะการ์ดนี้ อีกการ์ดทำต่อ
                urllib.request.urlopen("http://127.0.0.1:%d/system_stats" % port, timeout=10).read()
            except Exception:
                log("การ์ด %d หยุดทำงาน การ์ดที่เหลือทำต่อ" % (port - 8187))
                return
        if time.time() - T0 > MAXH * 3600:
            log("ใกล้หมดเวลารอบนี้ จะเริ่มรอบใหม่ให้เอง")
            return
        job = J("/k/claim").get("job")


def main():
    job = J("/k/claim").get("job")
    if not job:
        log("ไม่มีงานวิดีโอในคิว ปิดเครื่องเพื่อประหยัดโควตา")
        return
    stat = {"done": 0}
    if job.get("kind") == "concat":  # งานรวมคลิปไม่ต้องใช้ GPU
        worker(0, job, stat)
        job = J("/k/claim").get("job")
        if not job:
            log("จบรอบ ทำเสร็จ %d คลิป" % stat["done"])
            return
    try:
        setup()
    except Exception as e:
        J("/k/fail/%s" % job["id"], {"error": str(e)[:500], "requeue": 1})
        log("เตรียมเครื่องไม่สำเร็จ: " + str(e)[:400])
        raise
    th = [threading.Thread(target=worker, args=(PORTS[0], job, stat))]
    for port in PORTS[1:]:
        th.append(threading.Thread(target=lambda p=port: worker(p, J("/k/claim").get("job"), stat)))
    for t in th:
        t.start()
        time.sleep(90)  # ให้การ์ดแรกโหลดโมเดล/RIFE ก่อน ไม่แย่งกัน
    [t.join() for t in th]
    log("จบรอบ ทำเสร็จ %d คลิป (%d การ์ด)" % (stat["done"], len(PORTS)))


main()
`;


// =====================================================================
// ===== แคสติ้ง: ทุกวันสุ่มออกแบบตัวละครใหม่ 3–5 ตัว ให้ผู้ใช้อนุมัติ =====
const CAST = {
  g: [['f', 'หญิง', 7], ['m', 'ชาย', 3]],
  age: [[19, 'วัยรุ่นตอนปลาย'], [22, 'นักศึกษา'], [25, 'วัยทำงานตอนต้น'], [28, 'วัยทำงาน'], [33, 'ผู้ใหญ่']],
  hairF: [['short wavy bob', 'ผมบ็อบหยักศก'], ['long straight hair with blunt bangs', 'ผมยาวตรงหน้าม้าตัดตรง'], ['high ponytail', 'ผมหางม้าสูง'], ['low twin braids', 'ผมเปียคู่ต่ำ'], ['messy bun with loose strands', 'ผมมวยหลวมๆ'], ['long layered hair with wispy bangs', 'ผมยาวไล่เลเยอร์หน้าม้าบาง'], ['short pixie cut', 'ผมสั้นพิกซี่'], ['half-up hair with a ribbon', 'ผมมัดครึ่งหัวผูกโบว์']],
  hairM: [['messy short hair with bangs', 'ผมสั้นยุ่งมีหน้าม้า'], ['spiky hair', 'ผมชี้ฟู'], ['slicked back hair', 'ผมเสยหลัง'], ['wolf cut', 'ผมทรงวูล์ฟคัต'], ['short undercut', 'ผมอันเดอร์คัต'], ['shoulder-length tied hair', 'ผมยาวประบ่ามัดจุก']],
  hc: [['black', 'ดำ'], ['dark brown', 'น้ำตาลเข้ม'], ['chestnut', 'น้ำตาลเกาลัด'], ['ash blonde', 'บลอนด์หม่น'], ['pastel pink', 'ชมพูพาสเทล'], ['navy blue', 'น้ำเงินกรมท่า'], ['white', 'ขาว'], ['copper red', 'แดงทองแดง'], ['lavender', 'ม่วงลาเวนเดอร์']],
  eye: [['amber', 'อำพัน'], ['emerald green', 'เขียวมรกต'], ['sky blue', 'ฟ้า'], ['violet', 'ม่วง'], ['dark brown', 'น้ำตาลเข้ม'], ['crimson', 'แดง'], ['gray', 'เทา']],
  outF: [['oversized hoodie and pleated skirt', 'ฮู้ดดี้ตัวใหญ่กับกระโปรงพลีท'], ['denim jacket over a sundress', 'แจ็กเก็ตยีนส์ทับเดรส'], ['office blouse and slacks', 'เสื้อเชิ้ตทำงานกับกางเกงสแล็ก'], ['cafe apron uniform', 'ชุดพนักงานร้านกาแฟมีผ้ากันเปื้อน'], ['sporty track jacket and shorts', 'แจ็กเก็ตกีฬากับกางเกงขาสั้น'], ['long coat and scarf', 'โค้ทยาวกับผ้าพันคอ'], ['cardigan and long skirt', 'คาร์ดิแกนกับกระโปรงยาว'], ['leather jacket and jeans', 'แจ็กเก็ตหนังกับยีนส์']],
  outM: [['white shirt and slacks', 'เสื้อเชิ้ตขาวกับกางเกงสแล็ก'], ['hoodie and cargo pants', 'ฮู้ดดี้กับกางเกงคาร์โก'], ['denim jacket and t-shirt', 'แจ็กเก็ตยีนส์กับเสื้อยืด'], ['chef jacket', 'ชุดเชฟ'], ['racing jacket', 'แจ็กเก็ตแข่งรถ'], ['knit sweater and coat', 'สเวตเตอร์ไหมพรมกับโค้ท']],
  vibe: [['cheerful energetic', 'ร่าเริง พลังเยอะ', 'big bright smile'], ['cool and aloof', 'นิ่ง เท่ เย็นชา', 'calm cool expression'], ['shy and gentle', 'ขี้อาย อ่อนโยน', 'shy soft smile'], ['clumsy and funny', 'โก๊ะ ตลก', 'goofy surprised expression'], ['confident leader', 'มั่นใจ เป็นผู้นำ', 'confident smirk'], ['mysterious', 'ลึกลับ', 'mysterious half smile'], ['sleepy and lazy', 'ขี้เกียจ ง่วงตลอด', 'sleepy half-lidded eyes']],
  acc: [['', ''], ['', ''], ['round glasses', 'แว่นกลม'], ['hair clip', 'กิ๊บติดผม'], ['headphones around the neck', 'หูฟังคล้องคอ'], ['small earrings', 'ต่างหูเล็ก'], ['choker', 'โชกเกอร์'], ['beanie', 'หมวกไหมพรม']],
  nameF: ['มิว', 'ใบเตย', 'พิม', 'น้ำหวาน', 'ฟ้าใส', 'ข้าวหอม', 'ปลายฝน', 'มายด์', 'เอิง', 'ญาญ่า', 'แพรวา', 'ไอซ์', 'จูน', 'ลูกพีช', 'เมษา'],
  nameM: ['ภูมิ', 'ต้นกล้า', 'ไนท์', 'เจ', 'ซัน', 'ธาม', 'คิน', 'ปั้น', 'ไท', 'เรน'],
};
const pick = (a, r) => a[Math.floor(r() * a.length)];
function rng(seed) { let x = seed >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }
function castMake(r, style) {
  const tot = CAST.g.reduce((a, b) => a + b[2], 0); let t = r() * tot, g = CAST.g[0];
  for (const x of CAST.g) { if ((t -= x[2]) < 0) { g = x; break; } }
  const f = g[0] === 'f', age = pick(CAST.age, r), hair = pick(f ? CAST.hairF : CAST.hairM, r), hc = pick(CAST.hc, r), eye = pick(CAST.eye, r),
    vibe = pick(CAST.vibe, r), acc = pick(CAST.acc, r), name = pick(f ? CAST.nameF : CAST.nameM, r);
  const arch = pick(IDEAS.char, r);
  let cos = pick(IDEAS.costume, r);
  for (let k = 0; k < 10 && age[0] > 22 && /นักเรียน/.test(cos.n); k++) cos = pick(IDEAS.costume, r); // ชุดนักเรียนเฉพาะคนอายุไม่เกิน 22
  const out = [cos.e, `${cos.n} (${cos.id})`];
  const who = f ? 'young woman' : 'young man';
  const real = style === 'real';
  const prompt = `${real ? 'photorealistic full body photo' : 'full body anime character design'} of an original ${who} as a ${arch.e}, ${age[0]} years old, ${hc[0]} ${hair[0]}, ${eye[0]} eyes, ${vibe[2]}, ${vibe[0]} personality, wearing ${out[0]}${acc[0] ? ', ' + acc[0] : ''}, standing in a relaxed natural pose, front view, plain light gray studio background, ${real ? 'soft studio lighting, 50mm photo' : 'clean lineart, soft cel shading, high quality anime illustration'}, vertical 9:16`;
  const desc = `${arch.id} ${arch.n} · ${g[1]} ${age[0]} ปี · ผม${hc[1]} ${hair[1]} · ตา${eye[1]} · ${out[1]}${acc[1] ? ' · ' + acc[1] : ''} · นิสัย${vibe[1]}`;
  return { name, desc, prompt };
}
const CAST2 = {
  pet: {
    sp: [['fluffy cat', 'แมวขนฟู'], ['short-haired cat', 'แมวขนสั้น'], ['shiba inu', 'หมาชิบะ'], ['corgi', 'หมาคอร์กี้'], ['pomeranian', 'หมาปอม'], ['golden retriever puppy', 'ลูกหมาโกลเด้น'], ['lop-eared rabbit', 'กระต่ายหูตก'], ['hamster', 'แฮมสเตอร์'], ['parakeet', 'นกแก้ว'], ['baby chick', 'ลูกเจี๊ยบ'], ['duckling', 'ลูกเป็ด'], ['hedgehog', 'เม่นแคระ'], ['red panda', 'แพนด้าแดง'], ['penguin chick', 'ลูกเพนกวิน']],
    col: [['orange', 'สีส้ม'], ['white', 'สีขาว'], ['gray', 'สีเทา'], ['black', 'สีดำ'], ['cream', 'สีครีม'], ['calico', 'สามสี'], ['brown', 'สีน้ำตาล']],
    acc: [['', ''], ['red collar with a bell', 'ปลอกคอแดงมีกระดิ่ง'], ['tiny scarf', 'ผ้าพันคอจิ๋ว'], ['ribbon bow', 'โบว์'], ['little knit hat', 'หมวกไหมพรมจิ๋ว']],
    mood: [['sleepy', 'ขี้เซา'], ['playful', 'ซน'], ['grumpy', 'หน้าบึ้ง'], ['curious', 'ขี้สงสัย'], ['happy', 'อารมณ์ดี']],
    name: ['ส้มจี๊ด', 'โมจิ', 'ข้าวปั้น', 'ถั่วแดง', 'บัวลอย', 'ทองหยิบ', 'มะพร้าว', 'ปุยฝ้าย', 'ขนมปัง', 'เต้าหู้', 'ช็อกโก', 'มะขาม']
  },
  place: {
    loc: [['cozy apartment bedroom', 'ห้องนอนอพาร์ตเมนต์'], ['small cafe interior', 'ร้านกาแฟเล็กๆ'], ['rooftop with city view', 'ดาดฟ้าวิวเมือง'], ['school classroom', 'ห้องเรียน'], ['convenience store at night', 'ร้านสะดวกซื้อ'], ['train station platform', 'ชานชาลารถไฟ'], ['seaside road', 'ถนนเลียบทะเล'], ['flower field', 'ทุ่งดอกไม้'], ['night market street', 'ถนนตลาดนัดกลางคืน'], ['quiet library', 'ห้องสมุด'], ['laundromat', 'ร้านซักผ้าหยอดเหรียญ'], ['bus stop in the countryside', 'ป้ายรถเมล์ชนบท'], ['shrine stairs in a forest', 'บันไดศาลเจ้ากลางป่า'], ['amusement park', 'สวนสนุก']],
    time: [['early morning', 'เช้าตรู่'], ['bright noon', 'กลางวัน'], ['golden sunset', 'ยามเย็น'], ['night', 'กลางคืน']],
    wx: [['clear weather', 'ฟ้าใส'], ['light rain', 'ฝนปรอยๆ'], ['soft snowfall', 'หิมะตกเบาๆ'], ['after the rain with puddles', 'หลังฝนตก'], ['cherry blossom petals falling', 'ซากุระร่วง']]
  },
  prop: {
    it: [['vintage film camera', 'กล้องฟิล์มวินเทจ'], ['bento lunch box', 'กล่องข้าวเบนโตะ'], ['bicycle with a front basket', 'จักรยานมีตะกร้า'], ['retro radio', 'วิทยุเรโทร'], ['handwritten letter', 'จดหมายเขียนมือ'], ['umbrella', 'ร่ม'], ['backpack with keychains', 'เป้มีพวงกุญแจ'], ['smartphone with a cute case', 'มือถือเคสน่ารัก'], ['bubble tea', 'ชานมไข่มุก'], ['music box', 'กล่องดนตรี'], ['scooter', 'สกู๊ตเตอร์'], ['plush toy', 'ตุ๊กตาผ้า']],
    st: [['pastel', 'โทนพาสเทล'], ['retro', 'สไตล์เรโทร'], ['minimal white', 'มินิมอลขาว'], ['colorful', 'สีสดใส']]
  }
};
function castMake2(cat, r, style) {
  const real = style === 'real', tail = real ? 'photorealistic, 50mm photo, vertical 9:16' : 'soft anime style, high quality anime illustration, cinematic lighting, vertical 9:16';
  if (cat === 'pet') { const C = CAST2.pet, a = pick(IDEAS.creature, r), c = pick(C.col, r), m = pick(C.mood, r);
    const x = /แมว|สุนัข|กระต่าย|เม่น|แพนด้า|จิ้งจอก/.test(a.n) ? pick(C.acc, r) : ['', ''];
    return { name: pick(C.name, r), desc: `${a.id} ${a.n} · ${c[1]}${x[1] ? ' · ' + x[1] : ''} · นิสัย${m[1]} · เหมาะกับ${a.fit}`, prompt: `${real ? 'photorealistic full body photo' : 'full body anime creature character design'} of an original ${c[0]} ${a.e}${x[0] ? ' wearing a ' + x[0] : ''}, ${m[0]} expression, plain light gray background, ${tail}` }; }
  if (cat === 'place') {
    const used = castMake2.usedPlaces || new Set();
    let sc = pick(SCENES, r);
    for (let k = 0; k < 30 && used.has(sc.n); k++) sc = pick(SCENES, r);
    used.add(sc.n);
    return { name: sc.n, desc: `#${sc.i} ${sc.c} · ${sc.m} · เหมาะกับ ${sc.g}`, prompt: `${sc.e}, detailed anime background art, no people, ${tail}` }; }
  const it = pick(r() < 0.5 ? IDEAS.prop : IDEAS.element, r);
  return { name: it.n, desc: `${it.id} · ${it.d} · เหมาะกับ${it.fit}`, prompt: `a ${it.e}, single object design, centered, plain soft background, ${tail}` };
}

// ---------- คลังเสียง: เพลงบรรเลง (ACE-Step) + เสียงประกอบ (Stable Audio Open) ----------
async function audioEnqueue(env, items) {
  const st = items.map(it => env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,kind,opt) VALUES (?,?,?,?,'','',0,'queued',0,?,'audio',?)")
    .bind(it.project, '', '1', it.prompt.slice(0, 1500), Date.now(), JSON.stringify({ type: it.type, sec: it.sec, vocal: it.vocal ? 1 : 0 })));
  if (st.length) await env.DB.batch(st);
}
async function audioDaily(env, have) {
  // ต่อวัน: เสียงประกอบ aud_sfx_n รายการ + เพลง aud_music_n รายการ รายการละ aud_var แบบ (ตั้งค่าได้)
  const s = await getSettings(env), r = rng(Date.now() ^ 0x5bd1e995), out = [], made = [];
  const V = Math.min(3, Math.max(1, +s.aud_var || 2));
  const pickN = (cat, L, n) => {
    const key = x => `${String(x.i).padStart(4, '0')} ${x.n}`;
    let free = L.filter(x => ![...have].some(p => p === `คลัง·${cat}·${key(x)}` || p.startsWith(`คลัง·${cat}·${key(x)} · รอบ`)));
    const res = [];
    for (let k = 0; k < n; k++) {
      if (free.length) { const t = Math.floor(r() * free.length); res.push([free[t], key(free[t])]); free.splice(t, 1); }
      else { const x = L[Math.floor(r() * L.length)], b = key(x); res.push([x, `${b} · รอบ ${[...have].filter(p => p.startsWith(`คลัง·${cat}·${b}`)).length + 1 + k}`]); }
    }
    return res;
  };
  for (const [x, nm] of pickN('เสียงประกอบ', SFXLIB, Math.min(400, +s.aud_sfx_n || 200)))
    for (let v = 0; v < V; v++) out.push({ project: `คลัง·เสียงประกอบ·${nm}`, prompt: x.e + ', clean high quality sound effect, no music', type: 'sfx', sec: 10 });
  const ms = pickN('เพลง', MUSICLIB, Math.min(100, +s.aud_music_n || 20));
  for (const [x, nm] of ms)
    for (let v = 0; v < V; v++) out.push(x.t === 'sfx'
      ? { project: `คลัง·เพลง·${nm}`, prompt: x.e + ', cinematic music sound effect, high quality', type: 'sfx', sec: 8 }
      : { project: `คลัง·เพลง·${nm}`, prompt: x.e + (x.v ? ', anime soundtrack, wordless vocals, high quality' : ', anime soundtrack, instrumental, no vocals, high quality'), type: 'music', sec: 45, vocal: x.v ? 1 : 0 });
  for (let k = 0; k < out.length; k += 50) await audioEnqueue(env, out.slice(k, k + 50));
  made.push(`เสียงประกอบ ${Math.min(400, +s.aud_sfx_n || 200)} รายการ`, `เพลง ${ms.length} รายการ (รายการละ ${V} แบบ)`);
  return made;
}

// ---------- คลังอัตโนมัติรายวัน: ทุกวันหลัง 07:00 สร้างของใหม่หมวดละ 1 ชิ้น (ยกเว้นตัวละคร) ครบรายการแล้ววนรอบใหม่ ----------
const LIB_TAIL = 'modern TV anime style, clean lineart, cel shading, high quality';
const LIBD = [
  ['ฉาก', () => SCENES, it => `${it.e}, no people, detailed anime background art, cinematic lighting, ${LIB_TAIL}`],
  ['สัตว์และอสูร', () => IDEAS.creature, it => `a ${it.e}, full body, creature design, front view, plain soft background, ${LIB_TAIL}`],
  ['ของประกอบ', () => IDEAS.prop, it => `a ${it.e}, single object design, centered, plain soft background, ${LIB_TAIL}`],
  ['ชุด', () => IDEAS.costume, it => `${it.e} outfit displayed on a faceless mannequin, fashion design sheet, front and back view, plain soft background, ${LIB_TAIL}`],
  ['องค์ประกอบฉาก', () => IDEAS.element, it => `a ${it.e}, environment element design, no people, ${LIB_TAIL}`],
  ['อาวุธ', () => WORLD.weapon, it => `a ${it.e}, weapon design, single object, centered, plain soft background, ${LIB_TAIL}`],
  ['พลังอาคม', () => WORLD.power, it => `${it.e}, magic power visual effect, anime spell, dramatic lighting, dark background, no people, ${LIB_TAIL}`],
  ['ของวิเศษ', () => WORLD.artifact, it => `a ${it.e}, magical item design, single object, centered, plain soft background, ${LIB_TAIL}`],
  ['โลกและจักรวาล', () => WORLD.realm, it => `${it.e}, epic anime world landscape, no people, cinematic lighting, detailed background art, ${LIB_TAIL}`],
  ['เอฟเฟกต์', () => VFXLIB, it => `${it.e}, visual effect artwork for anime and film, isolated effect on a dark background, no people, high quality`],
];
function libName(it) { return (typeof it.i === 'number' ? String(it.i).padStart(4, '0') + ' ' : '') + String(it.n).replace(' — ', ' · ').replace(/·/g, '-').replace(' - ', ' · '); }
async function libDaily(env, force) {
  const s = await getSettings(env), day = bkkDay(), hr = new Date(Date.now() + 7 * 3600000).getUTCHours();
  if (!force && (s.lib_on === '0' || hr < 7 || s.lib_day === day)) return { skipped: true };
  await setSetting(env, 'lib_day', day);
  const have = new Set([...(await env.DB.prepare("SELECT DISTINCT project FROM jobs WHERE project LIKE 'คลัง·%'").all()).results,
    ...(await env.DB.prepare("SELECT DISTINCT project FROM images WHERE project LIKE 'คลัง·%'").all()).results].map(x => x.project));
  const r = rng(Date.now() ^ Math.floor(Math.random() * 1e9)), st = [], made = [];
  for (const [cat, list, mk] of LIBD) {
    const L = list() || [];
    if (!L.length) continue;
    const name = libName;
    let free = L.filter(it => ![...have].some(p => p === `คลัง·${cat}·${name(it)}` || p.startsWith(`คลัง·${cat}·${name(it)} · รอบ`)));
    let it, nm;
    if (free.length) { it = free[Math.floor(r() * free.length)]; nm = name(it); }
    else { // ครบทุกรายการแล้ว → วนรอบใหม่ เป็นเวอร์ชันใหม่ของของเดิม
      it = L[Math.floor(r() * L.length)]; const base = name(it);
      const n = [...have].filter(p => p === `คลัง·${cat}·${base}` || p.startsWith(`คลัง·${cat}·${base} · รอบ`)).length;
      nm = `${base} · รอบ ${n + 1}`;
    }
    const proj = `คลัง·${cat}·${nm}`, pr = mk(it).slice(0, 2000);
    for (let v = 0; v < 2; v++) st.push(env.DB.prepare("INSERT INTO jobs (project,scene,prompt,status,created,steps) VALUES (?,?,?,'queued',?,8)").bind(proj, 1, pr, Date.now()));
    made.push(`${cat}: ${nm}`);
  }
  if (st.length) await env.DB.batch(st);
  const vh = new Set((await env.DB.prepare("SELECT DISTINCT project FROM vjobs WHERE project LIKE 'คลัง·%' UNION SELECT DISTINCT project FROM videos WHERE project LIKE 'คลัง·%'").all()).results.map(x => x.project));
  try { made.push(...await audioDaily(env, vh)); await vTick(env, true); } catch (e) { made.push('เสียง: ' + String(e.message || e).slice(0, 80)); }
  await notify(env, `📦 คลังวันนี้: ${made.join(' · ')}`);
  return { ok: true, made };
}
function bkkDay(ts) { return new Date((ts || Date.now()) + 7 * 3600000).toISOString().slice(0, 10); }
async function castBatch(env, n, force, only) {
  const s = await getSettings(env), day = bkkDay(), hr = new Date(Date.now() + 7 * 3600000).getUTCHours();
  if (!force) {
    if (s.cast_on === '0' || hr < 7) return { skipped: true };
    const c = await env.DB.prepare('SELECT COUNT(*) n FROM casting WHERE day=?').bind(day).first();
    if (c.n) return { skipped: 'done today' };
  }
  n = Math.min(5, Math.max(1, n || +s.cast_n || 4));
  const cats = only ? [only] : String(s.cast_cats || 'char,pet,place,prop').split(',').filter(Boolean);
  const r = rng(Date.now() ^ Math.floor(Math.random() * 1e9)), st = [];
  castMake2.usedPlaces = new Set((await env.DB.prepare("SELECT name FROM casting WHERE cat='place'").all()).results.map(x => x.name));
  let total = 0;
  for (const cat of cats) {
    const used = new Set();
    for (let i = 0; i < n; i++) {
      const mk = () => cat === 'char' ? castMake(r, s.cast_style || 'anime') : castMake2(cat, r, s.cast_style || 'anime');
      let c = mk();
      for (let k = 0; k < 8 && used.has(c.name); k++) c = mk();
      used.add(c.name);
      const ins = await env.DB.prepare("INSERT INTO casting (day,cat,name,descr,prompt,status,created) VALUES (?,?,?,?,?,'pending',?)").bind(day, cat, c.name, c.desc, c.prompt, Date.now()).run();
      st.push(env.DB.prepare("INSERT INTO jobs (project,scene,prompt,status,created) VALUES (?,?,?,'queued',?)").bind('แคสติ้ง·' + day, ins.meta.last_row_id, c.prompt, Date.now()));
      total++;
    }
  }
  await env.DB.batch(st);
  await notify(env, `🎬 แคสติ้งวันนี้มาแล้ว ${total} รายการ เข้าไปเลือกในแท็บคลัง`);
  return { ok: true, added: total };
}
async function castApi(req, env, url, body) {
  const p = url.pathname;
  if (p === '/api/vcastlib') return json(await libDaily(env, true));
  if (p === '/api/vcastlibone') { // สั่งสร้างภาพรายการเดียวจากคลังทันที
    const b = body || {};
    const row = LIBD.find(x => x[0] === b.cat); if (!row) return json({ error: 'ไม่รู้จักหมวด' }, 400);
    const it = (row[1]() || []).find(x => x.i === +b.i); if (!it) return json({ error: 'ไม่พบรายการ' }, 400);
    const proj = `คลัง·${b.cat}·${libName(it)}`, pr = row[2](it).slice(0, 2000);
    await env.DB.batch([0, 1].map(() => env.DB.prepare("INSERT INTO jobs (project,scene,prompt,status,created,steps) VALUES (?,?,?,'queued',?,8)").bind(proj, 1, pr, Date.now())));
    return json({ ok: true, project: proj });
  }
  if (p === '/api/vcastaudio') {
    const cat = body.type === 'music' ? 'เพลง' : 'เสียงประกอบ', name = String(body.name || body.prompt || '').slice(0, 60);
    if (!body.prompt) return json({ error: 'ต้องมีคำบรรยายเสียง' }, 400);
    await audioEnqueue(env, [{ project: `คลัง·${cat}·${name}`, prompt: String(body.prompt), type: body.type === 'music' ? 'music' : 'sfx', sec: Math.min(120, Math.max(3, +body.sec || (body.type === 'music' ? 60 : 10))) }]);
    await vTick(env, true);
    return json({ ok: true });
  }
  if (p === '/api/vcastlibset') {
    if (body.on !== undefined) await setSetting(env, 'lib_on', body.on ? '1' : '0');
    for (const k of ['aud_sfx_n', 'aud_music_n', 'aud_var']) if (body[k] !== undefined) await setSetting(env, k, String(Math.max(0, +body[k] || 0)));
    return json({ ok: true });
  }
  if (p === '/api/vcast') {
    const rows = (await env.DB.prepare("SELECT * FROM casting WHERE status!='rejected' OR day>=? ORDER BY id DESC LIMIT 200").bind(bkkDay(Date.now() - 2 * 86400000)).all()).results;
    const imgs = (await env.DB.prepare("SELECT id,project,scene FROM images WHERE project LIKE 'แคสติ้ง·%'").all()).results;
    const jobs = (await env.DB.prepare("SELECT project,scene,status FROM jobs WHERE project LIKE 'แคสติ้ง·%'").all()).results;
    const s = await getSettings(env);
    for (const r of rows) {
      r.img = (imgs.find(i => +i.scene === r.id) || {}).id || 0;
      const j = jobs.find(x => +x.scene === r.id); r.job = j ? j.status : '';
    }
    return json({ today: bkkDay(), rows, cast_on: s.cast_on !== '0', cast_n: +s.cast_n || 4, cast_style: s.cast_style || 'anime', cast_cats: s.cast_cats || 'char,pet,place,prop' });
  }
  if (p === '/api/vcastset') {
    if (body.id && ['approved', 'rejected', 'pending'].includes(body.status)) await env.DB.prepare('UPDATE casting SET status=?, name=COALESCE(?,name) WHERE id=?').bind(body.status, body.name || null, body.id).run();
    for (const k of ['cast_on', 'cast_n', 'cast_style', 'cast_cats']) if (body[k] !== undefined) await setSetting(env, k, String(body[k]));
    return json({ ok: true });
  }
  if (p === '/api/vcastnow') return json(await castBatch(env, +body.n || 0, true, ['char', 'pet', 'place', 'prop'].includes(body.cat) ? body.cat : ''));
  return null;
}

// ---------- หน้าเว็บ ----------
const HTML = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Anime Image Bot</title><style>
:root{--bg:#0f1115;--card:#181b22;--line:#2a2f3a;--tx:#e8eaf0;--mut:#8a91a3;--ac:#ff7aa8;--ok:#5fd39a;--warn:#ffc35c}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.5 system-ui,-apple-system,"Noto Sans Thai",sans-serif}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 14px;z-index:5}
h1{font-size:17px;margin:0 0 8px}#status{font-size:13px;color:var(--mut)}
nav{display:flex;gap:6px;margin-top:10px;overflow-x:auto}nav button{flex:none}
main{padding:14px;max-width:900px;margin:auto}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
label{display:block;font-size:13px;color:var(--mut);margin:10px 0 4px}
input,textarea,select{width:100%;background:#0c0e12;color:var(--tx);border:1px solid var(--line);border-radius:10px;padding:10px;font:inherit}
textarea{min-height:140px}button{background:#232836;color:var(--tx);border:1px solid var(--line);border-radius:10px;padding:9px 14px;font:inherit;cursor:pointer}
button.pri{background:var(--ac);border-color:var(--ac);color:#1a0d13;font-weight:600}button.on{background:var(--tx);color:var(--bg)}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.mut{color:var(--mut);font-size:13px}
.notice{padding:8px 10px;border-left:3px solid var(--warn);background:#1e1b14;border-radius:6px;margin:6px 0;font-size:14px}
.job{display:flex;gap:8px;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px}.job b{flex:none;width:80px}
.tag{font-size:11px;padding:2px 7px;border-radius:99px;background:#232836}.tag.running{background:var(--warn);color:#000}.tag.failed{background:#ff5c5c;color:#000}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.img{position:relative;border-radius:12px;overflow:hidden;border:2px solid transparent;background:#000}.img.star{border-color:var(--ac)}
.img img{width:100%;display:block;aspect-ratio:1;object-fit:cover}.img .bar{display:flex;justify-content:space-between;padding:4px}
.img .bar button{padding:4px 8px;font-size:13px}h3{margin:16px 0 8px;font-size:15px}
#viewer{position:fixed;inset:0;background:#000d;display:none;align-items:center;justify-content:center;z-index:20;padding:10px}#viewer img{max-width:100%;max-height:85vh;border-radius:10px}
</style></head><body>
<header><h1>🎨 Anime Image Bot</h1><div id="status">กำลังโหลด…</div>
<nav><button data-t="order" class="on">สั่งงาน</button><button data-t="queue">คิว</button><button data-t="gallery">คลังภาพ</button><button data-t="settings">ตั้งค่า</button></nav></header>
<main>
<section id="t-order">
 <div id="notices"></div>
 <div class="card"><label>ชื่อโปรเจกต์ / ตอน</label><input id="project" placeholder="เช่น EP01">
 <label>Prompt ฉากละ 1 บรรทัด (ภาษาอังกฤษได้ผลดีที่สุด)</label>
 <textarea id="lines" placeholder="standing at a train station platform, winter morning&#10;pointing at the sky, smiling, snow falling&#10;close-up face, surprised expression"></textarea>
 <label>สร้างกี่แบบต่อฉาก (ไว้เลือก)</label><select id="variants"><option>1</option><option>2</option><option selected>3</option><option>4</option></select>
 <div class="row" style="margin-top:12px"><button class="pri" onclick="enqueue()">เพิ่มเข้าคิว</button><span class="mut" id="eta"></span></div>
 <p class="mut">บอทจะเติม "คำอธิบายตัวละคร" ไว้ข้างหน้า และ "สไตล์" ไว้ข้างหลังให้อัตโนมัติ (แก้ได้ที่แท็บตั้งค่า)</p></div>
</section>
<section id="t-queue" hidden><div class="card"><div class="row"><button class="pri" onclick="post('/api/runnow').then(load)">สร้างภาพถัดไปเดี๋ยวนี้</button><button onclick="post('/api/resume').then(load)">ทำต่อ / ลองใหม่ที่พัง</button><button onclick="if(confirm('ล้างคิวที่ยังไม่ได้ทำทั้งหมด?'))post('/api/clearqueue').then(load)">ล้างคิว</button></div><div id="jobs"></div></div></section>
<section id="t-gallery" hidden><div class="card"><div class="row"><select id="gproj" style="flex:1" onchange="renderGallery()"></select><button id="onlyStar" onclick="starOnly=!starOnly;this.classList.toggle('on');renderGallery()">⭐ เฉพาะที่เลือก</button></div>
<div class="row" style="margin-top:8px"><button onclick="zip(true)">⬇️ โหลด ZIP (เฉพาะ ⭐)</button><button onclick="zip(false)">⬇️ โหลด ZIP ทั้งหมด</button></div></div><div id="gallery"></div></section>
<section id="t-settings" hidden><div class="card">
 <label>คำอธิบายตัวละคร (ใส่ไว้หน้าทุก prompt เพื่อให้หน้าตาใกล้เคียงกัน)</label><textarea id="character" style="min-height:90px" placeholder="1girl, short black bob hair, low side ponytail, brown eyes, white hoodie, red scarf"></textarea>
 <label>สไตล์ (ต่อท้ายทุก prompt)</label><textarea id="style" style="min-height:70px"></textarea>
 <label>ระยะห่างระหว่างภาพ (นาที)</label><input id="interval_min" type="number" min="1">
 <label>คุณภาพ (steps 1–8, มาก = ละเอียดขึ้นแต่กินโควตามากขึ้น)</label><input id="steps" type="number" min="1" max="8">
 <div class="row" style="margin-top:12px"><button class="pri" onclick="saveSettings()">บันทึก</button></div>
 <p class="mut">ฟรี ~10,000 Neurons/วัน ≈ 200 ภาพ (4 steps) รีเซ็ต 07:00 น. เวลาไทย</p></div></section>
</main><div id="viewer" onclick="this.style.display='none'"><img></div>
<script>
let K=localStorage.getItem('k')||'',S=null,starOnly=false,tab='order';
const $=id=>document.getElementById(id);
const q=p=>p+(p.includes('?')?'&':'?')+'k='+encodeURIComponent(K);
async function api(p,o){const r=await fetch(q(p),o);if(r.status===401){K=prompt('ใส่รหัสผ่านของบอท')||'';localStorage.setItem('k',K);return api(p,o)}return r.json()}
const post=(p,b)=>api(p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b||{})});
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('main section').forEach(s=>s.hidden=s.id!=='t-'+tab)});
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const t=ms=>new Date(+ms).toLocaleString('th-TH',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'});
async function load(){S=await api('/api/state');const s=S.settings,queued=S.jobs.filter(j=>j.status==='queued').length,paused=S.now<+s.paused_until;
 let st=paused?'⏸ พักอยู่ (โควตาหมด) จะทำต่อ '+t(s.paused_until):queued?'▶️ กำลังทำงาน · เหลือในคิว '+queued+' ภาพ · ภาพถัดไปประมาณ '+t(Math.max(S.now,+s.last_run+s.interval_min*60000)):'✅ คิวว่าง';
 $('status').textContent=st+' · คลัง '+S.images.length+' ภาพ'+(S.hasPassword?'':' · ⚠️ ยังไม่ได้ตั้งรหัสผ่าน');
 $('notices').innerHTML=S.notices.length?'<div class="card"><div class="row" style="justify-content:space-between"><b>แจ้งเตือน</b><button onclick="post(\\'/api/clearnotices\\').then(load)">ล้าง</button></div>'+S.notices.slice(0,5).map(n=>'<div class="notice">'+esc(n.msg)+' <span class="mut">'+t(n.created)+'</span></div>').join('')+'</div>':'';
 $('jobs').innerHTML=S.jobs.length?S.jobs.map(j=>'<div class="job"><b>'+esc(j.project)+' #'+j.scene+'</b><span style="flex:1">'+esc(j.prompt).slice(0,120)+(j.error?'<br><span class="mut">'+esc(j.error)+'</span>':'')+'</span><span class="tag '+j.status+'">'+({queued:'รอคิว',running:'กำลังสร้าง',failed:'พัง'}[j.status]||j.status)+'</span></div>').join(''):'<p class="mut">ไม่มีงานในคิว</p>';
 const projs=[...new Set(S.images.map(i=>i.project))],cur=$('gproj').value;
 $('gproj').innerHTML='<option value="">ทุกโปรเจกต์</option>'+projs.map(p=>'<option'+(p===cur?' selected':'')+'>'+esc(p)+'</option>').join('');
 if(document.activeElement.tagName!=='TEXTAREA'&&document.activeElement.tagName!=='INPUT')for(const k of ['character','style','interval_min','steps'])$(k).value=s[k];
 renderGallery()}
function renderGallery(){if(!S)return;const p=$('gproj').value;let im=S.images.filter(i=>(!p||i.project===p)&&(!starOnly||i.starred));
 const g={};im.forEach(i=>{(g[i.project+' · ฉาก '+i.scene]??=[]).push(i)});
 $('gallery').innerHTML=Object.keys(g).length?Object.entries(g).map(([k,a])=>'<h3>'+esc(k)+'</h3><p class="mut" style="margin:-4px 0 8px">'+esc(a[0].prompt).slice(0,140)+'</p><div class="grid">'+a.map(i=>'<div class="img'+(i.starred?' star':'')+'"><img loading="lazy" src="'+q('/img/'+i.id)+'" onclick="view(this.src)"><div class="bar"><button onclick="act(\\'star\\','+i.id+')">'+(i.starred?'⭐':'☆')+'</button><button onclick="act(\\'regen\\','+i.id+')" title="สร้างใหม่">🔁</button><button onclick="if(confirm(\\'ลบภาพนี้?\\'))act(\\'delete\\','+i.id+')">🗑</button></div></div>').join('')+'</div>').join(''):'<p class="mut">ยังไม่มีภาพ</p>'}
function view(src){$('viewer').querySelector('img').src=src;$('viewer').style.display='flex'}
async function act(a,id){await post('/api/'+a,{id});if(a==='regen')alert('เพิ่มเข้าคิวแล้ว');load()}
async function enqueue(){const r=await post('/api/enqueue',{project:$('project').value,lines:$('lines').value,variants:$('variants').value});
 if(r.error)return alert(r.error);$('lines').value='';$('eta').textContent='เพิ่ม '+r.added+' ภาพ ใช้เวลาประมาณ '+Math.round(r.added*S.settings.interval_min)+' นาที';load()}
async function saveSettings(){await post('/api/settings',{character:$('character').value,style:$('style').value,interval_min:Math.max(1,+$('interval_min').value||1),steps:Math.min(8,Math.max(1,+$('steps').value||4))});alert('บันทึกแล้ว');load()}
function zip(st){location.href=q('/api/zip?project='+encodeURIComponent($('gproj').value)+(st?'&starred=1':''))}
load();setInterval(load,20000);
</script></body></html>`;
