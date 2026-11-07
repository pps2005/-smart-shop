// ===== Anime Image Bot — Cloudflare Worker (Flux schnell + D1 + Cron) =====
// Bindings ที่ต้องตั้งใน Cloudflare:  AI (Workers AI),  DB (D1: anime-bot-db)
// Variables (Secret):  PASSWORD   | ไม่บังคับ: TG_TOKEN, TG_CHAT (แจ้งเตือน Telegram)
// Cron Trigger:  * * * * *   (บอทเช็คทุกนาที แต่สร้างภาพตามระยะห่างที่ตั้งในเว็บ)
// ใช้คู่กับ studio.html แท็บ "เจนภาพ" (เรียก API นี้ข้ามโดเมน จึงเปิด CORS ไว้ · ป้องกันด้วย PASSWORD)

const MODEL = '@cf/black-forest-labs/flux-1-schnell';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (p === '/') return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    if (!authOK(req, url, env)) return json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
    await ensureSchema(env);
    try {
      if (p === '/api/ping') return json({ ok: true, bot: 'anime-image-bot', github: !!(env.GH_TOKEN && env.GH_REPO) });
      if (p === '/api/state') return json(await getState(env));
      if (p.startsWith('/img/')) return getImage(env, +p.split('/')[2]);
      if (p === '/api/zip') return makeZip(env, url.searchParams.get('project') || '', url.searchParams.get('starred') === '1');
      if (req.method !== 'POST') return json({ error: 'not found' }, 404);
      const body = await req.json().catch(() => ({}));
      if (p === '/api/enqueue') return json(await enqueue(env, body));
      if (p === '/api/settings') {
        for (const k of ['interval_min', 'style', 'character', 'steps'])
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
  },
};

// ---------- core ----------
async function tick(env, force) {
  const s = await getSettings(env);
  const now = Date.now();
  if (!force) {
    if (now < +s.paused_until) return { skipped: 'paused' };
    if (now - +s.last_run < (+s.interval_min || 1) * 60000 - 15000) return { skipped: 'wait' };
    if (now - +s.last_run > 180000) await env.DB.prepare("UPDATE jobs SET status='queued' WHERE status='running'").run();
  }
  const job = await env.DB.prepare("SELECT * FROM jobs WHERE status='queued' ORDER BY id LIMIT 1").first();
  if (!job) return { skipped: 'empty' };
  await setSetting(env, 'last_run', String(now));
  await env.DB.prepare("UPDATE jobs SET status='running' WHERE id=?").bind(job.id).run();
  try {
    const out = await env.AI.run(MODEL, { prompt: job.prompt.slice(0, 2048), steps: Math.min(8, Math.max(1, +s.steps || 4)) });
    if (!out || !out.image) throw new Error('AI ไม่ได้ส่งภาพกลับมา');
    await env.DB.prepare('INSERT INTO images (job_id,project,scene,prompt,data,starred,created) VALUES (?,?,?,?,?,0,?)')
      .bind(job.id, job.project, job.scene, job.prompt, out.image, Date.now()).run();
    await env.DB.prepare('DELETE FROM jobs WHERE id=?').bind(job.id).run();
    const left = await env.DB.prepare("SELECT COUNT(*) n FROM jobs WHERE status='queued'").first();
    if (left.n === 0) await notify(env, `✅ คิวของโปรเจกต์ "${job.project}" เสร็จครบแล้ว เข้าไปเลือกภาพได้เลย`);
    return { done: true, left: left.n };
  } catch (e) {
    const msg = String(e.message || e);
    if (/neuron|allocation|quota|exceed|limit|4006|3036/i.test(msg)) {
      await env.DB.prepare("UPDATE jobs SET status='queued' WHERE id=?").bind(job.id).run();
      const d = new Date(); d.setUTCHours(24, 2, 0, 0);
      await setSetting(env, 'paused_until', String(d.getTime()));
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
  const s = { interval_min: '2', style: '', character: '', steps: '4', paused_until: '0', last_run: '0' };
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
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT, scene INTEGER, prompt TEXT, status TEXT DEFAULT 'queued', error TEXT, created INTEGER)"),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS images (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER, project TEXT, scene INTEGER, prompt TEXT, data TEXT, starred INTEGER DEFAULT 0, created INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS notices (id INTEGER PRIMARY KEY AUTOINCREMENT, msg TEXT, created INTEGER)'),
  ]);
  schemaReady = true;
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
