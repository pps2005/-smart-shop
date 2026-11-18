// anime-image-bot v2 — ระบบใหม่ ไม่ใช้กติกาเก่า · ใช้ D1 (DB) เดิม + ตัวเชื่อมเดิม (settings, fluxkeys, helpers)
// ทุกสวิตช์ปิดไว้ก่อน · เพิ่ม "สูตรงาน" ของแต่ละประเภทที่ RECIPES (kind -> async (env, job) => บันทึกผล)
const VER = '2.0';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,x-key', 'access-control-max-age': '86400' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...CORS } });
const SW = [['queue', 'ตัวจัดคิว'], ['flux', 'ภาพ Flux (Cloudflare)'], ['kaggle', 'เปิดเครื่อง Kaggle'], ['helpers', 'เครื่องผู้ช่วย']];
// ตารางข้อมูลเก่าที่ล้างได้ — ไม่แตะ settings, fluxkeys, helpers, voices, sfx_real
const OLD = ['series', 'chars', 'scripts', 'loras', 'lchunks', 'shots', 'scenes', 'qc', 'jobs', 'images', 'vjobs', 'char_profiles', 'aud_cands', 'story_assets', 'flipbooks', 'videos', 'vchunks', 'vlog', 'casting', 'pres_eps', 'manual_tasks', 'notices'];
const OLD_AUTO = ['auto_fill', 'auto_anime', 'cast_on', 'aud_auto', 'auto_lora'];
const RECIPES = {}; // ว่างไว้: ประเภทงานใหม่ยังไม่มีสูตร

const authOK = (req, url, env) => !env.PASSWORD || (url.searchParams.get('k') || req.headers.get('x-key')) === env.PASSWORD;
const put = (env, k, v) => env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k, String(v)).run();

async function schema(env) {
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)'),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS q2_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, title TEXT, input TEXT, status TEXT DEFAULT 'queued', note TEXT, created INTEGER, updated INTEGER)"),
  ]);
}
async function switches(env) {
  const o = {}; SW.forEach(([k]) => o[k] = false);
  const r = await env.DB.prepare("SELECT key,value FROM settings WHERE key LIKE 'sw:%'").all();
  (r.results || []).forEach(x => { o[x.key.slice(3)] = x.value === '1'; });
  return o;
}
async function allOff(env) {
  for (const [k] of SW) await put(env, 'sw:' + k, 0);
  for (const k of OLD_AUTO) await put(env, k, k === 'cast_on' ? '0' : '0');
}
async function tick(env) {
  const s = await switches(env);
  if (!s.queue) return { skipped: 'queue off' };
  const j = await env.DB.prepare("SELECT * FROM q2_jobs WHERE status='queued' ORDER BY id LIMIT 1").first();
  if (!j) return { skipped: 'empty' };
  const run = RECIPES[j.kind];
  if (!run) {
    if (j.note !== 'ยังไม่มีสูตรงานประเภทนี้') await env.DB.prepare('UPDATE q2_jobs SET note=?,updated=? WHERE id=?').bind('ยังไม่มีสูตรงานประเภทนี้', Date.now(), j.id).run();
    return { skipped: 'no recipe' };
  }
  await env.DB.prepare("UPDATE q2_jobs SET status='running',updated=? WHERE id=?").bind(Date.now(), j.id).run();
  try { const note = await run(env, j, s); await env.DB.prepare("UPDATE q2_jobs SET status='done',note=?,updated=? WHERE id=?").bind(String(note || ''), Date.now(), j.id).run(); }
  catch (e) { await env.DB.prepare("UPDATE q2_jobs SET status='failed',note=?,updated=? WHERE id=?").bind(String(e.message || e).slice(0, 300), Date.now(), j.id).run(); }
  return { ran: j.id };
}
async function state(env) {
  const jobs = (await env.DB.prepare('SELECT id,kind,title,status,note,created FROM q2_jobs ORDER BY id DESC LIMIT 100').all()).results || [];
  const link = async t => { try { return (await env.DB.prepare('SELECT COUNT(*) n FROM ' + t).first()).n; } catch (e) { return null; } };
  return { ver: VER, switches: await switches(env), switchList: SW, jobs, links: { fluxkeys: await link('fluxkeys'), helpers: await link('helpers'), voices: await link('voices'), sfx_real: await link('sfx_real') }, kaggle: !!(env.KAGGLE_USERNAME || env.KAGGLE_USER) };
}
export default {
  async scheduled(event, env, ctx) { await schema(env); ctx.waitUntil(tick(env).catch(() => {})); },
  async fetch(req, env, ctx) {
    const url = new URL(req.url), p = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (p === '/') return new Response('anime-image-bot v' + VER, { headers: CORS });
    if (!authOK(req, url, env)) return json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
    try {
      await schema(env);
      if (p === '/api/ping') return json({ ok: true, bot: 'anime-image-bot', ver: VER });
      if (p === '/api/state') return json(await state(env));
      if (req.method !== 'POST') return json({ error: 'not found' }, 404);
      const b = await req.json().catch(() => ({}));
      if (p === '/api/switch') { if (!SW.some(x => x[0] === b.key)) return json({ error: 'ไม่รู้จักสวิตช์' }, 400); await put(env, 'sw:' + b.key, b.on ? 1 : 0); return json({ ok: true }); }
      if (p === '/api/off-all') { await allOff(env); return json({ ok: true }); }
      if (p === '/api/enqueue') { const t = String(b.title || '').trim().slice(0, 200), k = String(b.kind || '').trim().slice(0, 50); if (!t || !k) return json({ error: 'ใส่ประเภทและชื่องาน' }, 400); const n = Date.now(); await env.DB.prepare('INSERT INTO q2_jobs (kind,title,input,created,updated) VALUES (?,?,?,?,?)').bind(k, t, String(b.input || '').slice(0, 8000), n, n).run(); return json({ ok: true }); }
      if (p === '/api/cancel') { await env.DB.prepare("DELETE FROM q2_jobs WHERE id=? AND status!='running'").bind(+b.id).run(); return json({ ok: true }); }
      if (p === '/api/clear') { await env.DB.prepare("DELETE FROM q2_jobs WHERE status!='running'").run(); return json({ ok: true }); }
      if (p === '/api/run') return json(await tick(env));
      if (p === '/api/wipe') { // ล้างข้อมูลเก่า (กู้คืนไม่ได้) — ต้องส่ง confirm = 'ลบทั้งหมด'
        if (b.confirm !== 'ลบทั้งหมด') return json({ error: 'ต้องพิมพ์ ลบทั้งหมด' }, 400);
        await allOff(env); const done = [];
        for (const t of OLD) { try { await env.DB.prepare('DELETE FROM ' + t).run(); done.push(t); } catch (e) { } }
        return json({ ok: true, cleared: done });
      }
      return json({ error: 'not found' }, 404);
    } catch (e) { return json({ error: String(e.message || e) }, 500); }
  },
};
