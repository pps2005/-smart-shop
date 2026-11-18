// Xiress Studio bot v2 — เริ่มใหม่ ว่างเปล่า · ใช้ตัวเชื่อมเดิม
// เชื่อมของเดิม: Secrets (PASSWORD, KAGGLE_USERNAME, KAGGLE_KEY, GH_*, TG_*), D1 "DB", ตาราง settings / fluxkeys / helpers / voices / sfx_real
const VER = 'v2-0';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,x-key', 'access-control-max-age': '86400' };
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json', ...CORS } });
const authOK = (req, url, env) => !env.PASSWORD || (url.searchParams.get('k') || req.headers.get('x-key')) === env.PASSWORD;
const SW = ['master', 'queue', 'kaggle', 'helpers']; // สวิตช์หลัก (เก็บใน settings เป็น sw_xxx · ค่าเริ่มต้น = ปิด)
const WIPE = ["aud_cands", "casting", "char_profiles", "chars", "flipbooks", "images", "jobs", "lchunks", "loras", "manual_tasks", "notices", "pres_eps", "qc", "qmeter", "rmeter", "scenes", "scripts", "series", "shots", "story_assets", "vchunks", "videos", "vjobs", "vlog"]; // ตารางเก่าที่ล้างได้ (ไม่รวม settings, fluxkeys, helpers, voices, sfx_real)
const RECIPES = {}; // สูตรงานแต่ละประเภท: RECIPES.ชื่อ = async (env, job) => {...}  (ยังว่าง — รอกำหนดประเภทงาน)
let ready = false;
async function schema(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)'),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS n_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, input TEXT, status TEXT DEFAULT 'queued', err TEXT DEFAULT '', created INTEGER, updated INTEGER)")]);
  ready = true;
}
async function switches(env) {
  const r = await env.DB.prepare("SELECT key,value FROM settings WHERE key LIKE 'sw_%'").all(), o = {};
  for (const n of SW) o[n] = '0';
  for (const x of r.results) o[x.key.slice(3)] = String(x.value);
  return o;
}
const setSw = (env, n, on) => env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('sw_' + n, on ? '1' : '0').run();
const kAuth = env => { const k = env.KAGGLE_KEY || ''; return k.startsWith('KGAT_') ? 'Bearer ' + k : 'Basic ' + btoa((env.KAGGLE_USERNAME || '') + ':' + k); };
async function kFetch(env, path) {
  const r = await fetch('https://www.kaggle.com/api/v1' + path, { headers: { authorization: kAuth(env), accept: 'application/json', 'user-agent': 'xiress-bot' } });
  return { ok: r.ok, status: r.status };
}
const rows = async (env, q) => (await env.DB.prepare(q).all().catch(() => ({ results: [] }))).results;
async function status(env) {
  await schema(env);
  const [jobs, helpers, flux, nv, ns, supa] = await Promise.all([
    rows(env, "SELECT status, COUNT(*) n FROM n_jobs GROUP BY status"),
    rows(env, 'SELECT id,name,on_,seen,done FROM helpers'),
    rows(env, 'SELECT id,name,on_,last_err FROM fluxkeys'),
    rows(env, 'SELECT COUNT(*) n FROM voices'), rows(env, 'SELECT COUNT(*) n FROM sfx_real'),
    rows(env, "SELECT COUNT(*) n FROM settings WHERE key LIKE 'supa%' AND value<>''")]);
  return { ok: true, ver: VER, sw: await switches(env), jobs, helpers, flux, voices: (nv[0] || {}).n || 0, sfx: (ns[0] || {}).n || 0,
    link: { kaggle: !!(env.KAGGLE_USERNAME && env.KAGGLE_KEY), github: !!(env.GH_TOKEN && env.GH_REPO), telegram: !!(env.TG_TOKEN && env.TG_CHAT), supabase: ((supa[0] || {}).n || 0) > 0 } };
}
async function handle(req, env) {
  const url = new URL(req.url), p = url.pathname;
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (p === '/api/ping') return json({ ok: true, bot: 'xiress-bot', ver: VER });
  if (!p.startsWith('/api/')) return new Response('Xiress bot ' + VER, { headers: CORS });
  if (!authOK(req, url, env)) return json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
  await schema(env);
  const b = req.method === 'POST' ? await req.json().catch(() => ({})) : {}, now = Date.now();
  if (p === '/api/status') return json(await status(env));
  if (p === '/api/kaggle-test') { if (!env.KAGGLE_USERNAME || !env.KAGGLE_KEY) return json({ ok: false, msg: 'ยังไม่ได้ตั้ง KAGGLE_USERNAME / KAGGLE_KEY' }); const r = await kFetch(env, '/kernels/list?user=' + encodeURIComponent(env.KAGGLE_USERNAME) + '&pageSize=1'); return json({ ok: r.ok, msg: r.ok ? 'Kaggle เชื่อมได้' : 'Kaggle ตอบ ' + r.status }); }
  if (p === '/api/switch') { // ปิด/เปิดรายตัว: สวิตช์หลัก, helper:ID, flux:ID
    const n = String(b.name || ''), on = b.on ? 1 : 0, m = n.match(/^(helper|flux):(\d+)$/);
    if (m) await env.DB.prepare('UPDATE ' + (m[1] === 'helper' ? 'helpers' : 'fluxkeys') + ' SET on_=?1 WHERE id=?2').bind(on, +m[2]).run();
    else if (SW.includes(n)) await setSw(env, n, on);
    else return json({ error: 'ไม่รู้จักสวิตช์นี้' }, 400);
    return json({ ok: true });
  }
  if (p === '/api/jobs') return json({ jobs: await rows(env, 'SELECT id,kind,status,err,created FROM n_jobs ORDER BY id DESC LIMIT 50') });
  if (p === '/api/job/add') { const k = String(b.kind || '').trim().slice(0, 40); if (!k) return json({ error: 'ใส่ประเภทงานก่อน' }, 400); await env.DB.prepare('INSERT INTO n_jobs (kind,input,created,updated) VALUES (?,?,?,?)').bind(k, String(b.input || '').slice(0, 4000), now, now).run(); return json({ ok: true }); }
  if (p === '/api/job/cancel') { await env.DB.prepare("UPDATE n_jobs SET status='cancelled',updated=?1 WHERE id=?2 AND status IN ('queued','running')").bind(now, +b.id || 0).run(); return json({ ok: true }); }
  if (p === '/api/jobs/clear') { await env.DB.prepare("UPDATE n_jobs SET status='cancelled',updated=?1 WHERE status IN ('queued','running')").bind(now).run(); return json({ ok: true }); }
  if (p === '/api/wipe') { // ล้างข้อมูลเก่า: ต้องพิมพ์ยืนยัน · เก็บ settings, fluxkeys, helpers, voices, sfx_real · กู้คืนไม่ได้
    if (b.confirm !== 'ลบทั้งหมด') return json({ error: 'ต้องพิมพ์ ลบทั้งหมด เพื่อยืนยัน' }, 400);
    for (const n of SW) await setSw(env, n, 0);
    await env.DB.batch(WIPE.map(t => env.DB.prepare('DROP TABLE IF EXISTS ' + t)));
    return json({ ok: true, dropped: WIPE.length });
  }
  return json({ error: 'ไม่พบคำสั่งนี้' }, 404);
}
async function tick(env) { // ตัวจัดคิว (cron ทุกนาที) — ทำงานเมื่อสวิตช์ master + queue เปิดเท่านั้น
  await schema(env);
  const s = await switches(env); if (s.master !== '1' || s.queue !== '1') return;
  const j = await env.DB.prepare("SELECT id,kind,input FROM n_jobs WHERE status='queued' ORDER BY id LIMIT 1").first(); if (!j) return;
  const set = (st, err) => env.DB.prepare('UPDATE n_jobs SET status=?1,err=?2,updated=?3 WHERE id=?4').bind(st, err || '', Date.now(), j.id).run();
  const r = RECIPES[j.kind]; if (!r) return set('failed', 'ยังไม่มีสูตรงานประเภท "' + j.kind + '"');
  await set('running');
  try { await r(env, j); await set('done'); } catch (e) { await set('failed', String(e.message || e).slice(0, 300)); }
}
export default {
  async fetch(req, env) { try { return await handle(req, env); } catch (e) { return json({ error: String(e.message || e) }, 500); } },
  async scheduled(ev, env, ctx) { ctx.waitUntil(tick(env)); }
};
