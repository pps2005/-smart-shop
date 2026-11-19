// Xiress Studio bot v2 — เริ่มใหม่ ว่างเปล่า · ใช้ตัวเชื่อมเดิม
// เชื่อมของเดิม: Secrets (PASSWORD, KAGGLE_USERNAME, KAGGLE_KEY, GH_*, TG_*), D1 "DB", ตาราง settings / fluxkeys / helpers / voices / sfx_real
const VER = 'v2-1';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,x-key', 'access-control-max-age': '86400' };
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json', ...CORS } });
const authOK = (req, url, env) => !env.PASSWORD || (url.searchParams.get('k') || req.headers.get('x-key')) === env.PASSWORD;
const SW = ['master', 'queue', 'kaggle', 'helpers']; // สวิตช์หลัก (เก็บใน settings เป็น sw_xxx · ค่าเริ่มต้น = ปิด)
const WIPE = ["aud_cands", "casting", "char_profiles", "chars", "flipbooks", "images", "jobs", "lchunks", "loras", "manual_tasks", "notices", "pres_eps", "qc", "qmeter", "rmeter", "scenes", "scripts", "series", "shots", "story_assets", "vchunks", "videos", "vjobs", "vlog"]; // ตารางเก่าที่ล้างได้ (ไม่รวม settings, fluxkeys, helpers, voices, sfx_real)
const MODELS = [ // รายการโมเดลที่น่าใช้ (ลงทะเบียนไว้ก่อน · ยังไม่มีสูตรงานเรียกใช้ · ชื่อ hf ที่ว่าง = ต้องตรวจชื่อก่อนใช้) run: cf = Workers AI, kaggle = GPU ฟรีของ Kaggle, cpu = ffmpeg
  { id: 'flux1-dev', kind: 'image', name: 'FLUX.1-dev', run: 'kaggle', hf: 'black-forest-labs/FLUX.1-dev', note: 'ภาพละเอียด ทำตามคำสั่งแม่น (ตัวเดิม)' },
  { id: 'flux-schnell', kind: 'image', name: 'FLUX.1 schnell', run: 'cf', hf: '@cf/black-forest-labs/flux-1-schnell', note: 'เร็ว ไม่ต้องรอเครื่อง Kaggle (ตัวสำรองเดิม)' },
  { id: 'flux2-klein-4b', kind: 'image', name: 'FLUX.2 klein 4B (ภาพต้นแบบ)', run: 'kaggle', hf: 'black-forest-labs/FLUX.2-klein-4B', note: 'ใส่ภาพต้นแบบ 1–4 รูป ทำตัวละครหน้าเหมือนเดิมทุกช็อต · Apache 2.0 · บรรทัดแรกของโจทย์: ref:#เลขงาน' },
  { id: 'flux1-kontext', kind: 'image', name: 'FLUX.1 Kontext', run: 'kaggle', hf: 'black-forest-labs/FLUX.1-Kontext-dev', note: 'ใส่ภาพอ้างอิง ทำตัวละครให้หน้าเหมือนเดิม (12B ใหญ่เกินเครื่องฟรี — ใช้ klein 4B แทน)' },
  { id: 'illustrious-xl', kind: 'image', name: 'Illustrious XL (SDXL)', run: 'kaggle', hf: '', note: 'มาตรฐานโอเพนซอร์สสายอนิเมะ มีหลายเช็กพอยต์' },
  { id: 'animagine-xl-4', kind: 'image', name: 'Animagine XL 4.0', run: 'kaggle', hf: 'cagliostrolab/animagine-xl-4.0', note: 'ตัวละครแม่น เส้นคม' },
  { id: 'wan-2-2', kind: 'video', name: 'Wan 2.2 (TI2V-5B / A14B)', run: 'kaggle', hf: 'Wan-AI/Wan2.2-TI2V-5B', note: 'ภาพนิ่ง→วิดีโอ สัญญาอนุญาต Apache 2.0' },
  { id: 'wan-animate-2', kind: 'video', name: 'Wan-Animate-2', run: 'kaggle', hf: '', note: 'ออกส.ค. 2026 Apache 2.0 ใช้ขยับตัวละคร' },
  { id: 'ltx-2-5', kind: 'video', name: 'LTX-2.5', run: 'kaggle', hf: 'Lightricks/LTX-2.5', note: 'ใหม่สุด สร้างภาพ+เสียงพร้อมกัน (ฟรีถ้ารายได้ไม่ถึง 10 ล้านดอลลาร์)' },
  { id: 'hunyuanvideo-1-5', kind: 'video', name: 'HunyuanVideo 1.5', run: 'kaggle', hf: '', note: 'กินแรมน้อยสุด (~14GB เมื่อออฟโหลด)' },
  { id: 'rife', kind: 'video', name: 'RIFE', run: 'kaggle', hf: '', note: 'เพิ่มเฟรมให้ลื่น (ตัวเดิม)' },
  { id: 'qwen3-tts-design', kind: 'voice', name: 'Qwen3-TTS VoiceDesign 1.7B', run: 'kaggle', hf: 'Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign', note: 'ออกแบบเสียงจากคำบรรยาย · 10 ภาษา (ไทยน่าจะไม่มี)' },
  { id: 'qwen3-tts-clone', kind: 'voice', name: 'Qwen3-TTS Base 1.7B', run: 'kaggle', hf: 'Qwen/Qwen3-TTS-12Hz-1.7B-Base', note: 'โคลนเสียงจากตัวอย่าง 3 วินาที' },
  { id: 'typhoon-whisper-large', kind: 'subs', name: 'Typhoon Whisper Large v3', run: 'kaggle', hf: 'scb10x/typhoon-whisper-large-v3', note: 'ถอดเสียงไทยแม่นสุด (MIT)' },
  { id: 'typhoon-whisper-turbo', kind: 'subs', name: 'Typhoon Whisper Turbo', run: 'kaggle', hf: 'typhoon-ai/typhoon-whisper-turbo', note: 'ถอดเสียงไทย เร็วกว่า' },
  { id: 'whisper-v3-turbo', kind: 'subs', name: 'Whisper Large v3 Turbo', run: 'kaggle', hf: 'openai/whisper-large-v3-turbo', note: 'ถอดเสียง 99+ ภาษา (ไม่แปลภาษา)' },
  { id: 'llama-3-3-70b', kind: 'text', name: 'Llama 3.3 70B', run: 'cf', hf: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', note: 'เขียนบท/ช่วยคิดโจทย์ (ตัวเดิม)' },
  { id: 'llava-1-5', kind: 'text', name: 'LLaVA 1.5 7B (ดูภาพ)', run: 'cf', hf: '@cf/llava-hf/llava-1.5-7b-hf', note: 'ตรวจภาพที่สร้างว่าตรงโจทย์ไหม (ตัวเดิม)' },
  { id: 'pony-v7', kind: 'image', name: 'Pony Diffusion V7', run: 'kaggle', hf: '', note: 'ท่าทางไดนามิก กายวิภาคแม่น รองรับ LoRA' },
  { id: 'hunyuan-image-3', kind: 'image', name: 'HunyuanImage 3.0', run: 'kaggle', hf: '', note: 'ภาพทั่วไปคุณภาพสูงจาก Tencent' },
  { id: 'mochi-1', kind: 'video', name: 'Mochi 1', run: 'kaggle', hf: '', note: 'ฐานฝึก LoRA วิดีโอที่ง่ายสุด การเคลื่อนไหวลื่น 480p' },
  { id: 'cogvideox-1-5', kind: 'video', name: 'CogVideoX-1.5', run: 'kaggle', hf: '', note: 'วิดีโอจากข้อความ/ภาพ รุ่นเบา' },
  { id: 'svd', kind: 'video', name: 'Stable Video Diffusion', run: 'kaggle', hf: '', note: 'ภาพนิ่ง→วิดีโอสั้น สายตระกูล SD' },
  { id: 'skyreels-v1', kind: 'video', name: 'SkyReels V1', run: 'kaggle', hf: '', note: 'เด่นเรื่องคนและท่าทางตัวละคร' },
  { id: 'kandinsky-6-video', kind: 'video', name: 'Kandinsky 6.0 Video', run: 'kaggle', hf: '', note: 'วิดีโอโอเพนเวตอีกตัวเลือก (ยังไม่ได้ตรวจรายละเอียด)' },
  { id: 'longcat-video', kind: 'video', name: 'LongCat-Video', run: 'kaggle', hf: '', note: 'ต่อฉากเป็นหลายช่วงให้ยาวขึ้น' },
  { id: 'magi-2', kind: 'video', name: 'MAGI-2 Preview', run: 'kaggle', hf: '', note: 'คลิป 10 วินาทีพร้อมเสียง · ต้อง GPU 8 ตัว' },
  { id: 'minimax-h3', kind: 'video', name: 'MiniMax H3', run: 'kaggle', hf: '', note: 'ภาพสวยสุดในกลุ่มโอเพน มีบทพูดและเสียง · ต้อง GPU 4 ตัว' },
  { id: 'qwen3-tts-custom', kind: 'voice', name: 'Qwen3-TTS CustomVoice 1.7B', run: 'kaggle', hf: 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice', note: '9 เสียงสำเร็จรูป ปรับสไตล์ได้' },
  { id: 'qwen3-tts-06-clone', kind: 'voice', name: 'Qwen3-TTS Base 0.6B', run: 'kaggle', hf: 'Qwen/Qwen3-TTS-12Hz-0.6B-Base', note: 'โคลนเสียงรุ่นเบา กินแรมน้อย' },
  { id: 'qwen3-tts-06-custom', kind: 'voice', name: 'Qwen3-TTS CustomVoice 0.6B', run: 'kaggle', hf: 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice', note: 'เสียงสำเร็จรูปรุ่นเบา' },
  { id: 'chatterbox', kind: 'voice', name: 'Chatterbox', run: 'kaggle', hf: '', note: 'TTS โอเพนซอร์ส (ยังไม่ได้ตรวจรายละเอียด)' },
  { id: 'vibevoice-7b', kind: 'voice', name: 'VibeVoice 7B', run: 'kaggle', hf: '', note: 'TTS ขนาดใหญ่ 7B (ยังไม่ได้ตรวจรายละเอียด)' },
  { id: 'kugelaudio', kind: 'voice', name: 'KugelAudio 7B', run: 'kaggle', hf: '', note: 'TTS 7B ที่ใช้ Qwen เป็นแกน' },
  { id: 'pocket-tts', kind: 'voice', name: 'Pocket TTS', run: 'cpu', hf: '', note: 'เล็กมาก ~100M รันบน CPU ได้' },
  { id: 'distil-whisper', kind: 'subs', name: 'Distil-Whisper', run: 'kaggle', hf: '', note: 'เร็วกว่า Whisper ราว 5–6 เท่า เหมาะภาษาอังกฤษ' },
  { id: 'sensevoice', kind: 'subs', name: 'SenseVoice', run: 'kaggle', hf: '', note: 'ถอดเสียงหลายภาษา รวมไทย (ค่าผิดพลาดสูงกว่า Whisper เล็กน้อย)' },
  { id: 'canary-qwen', kind: 'subs', name: 'Canary-Qwen 2.5B', run: 'kaggle', hf: '', note: 'แม่นสุดบนลีดเดอร์บอร์ดเปิด เน้นอังกฤษ' },
  { id: 'qwen3-asr', kind: 'subs', name: 'Qwen3-ASR', run: 'kaggle', hf: '', note: '52 ภาษา มีเวลากำกับคำ' },
  { id: 'ffmpeg', kind: 'edit', name: 'ffmpeg', run: 'cpu', hf: '', note: 'ตัดต่อ ต่อคลิป ใส่เสียงและซับ (ไม่ใช่โมเดล)' }
];
const RUN = ['animagine-xl-4', 'flux1-dev', 'flux2-klein-4b', 'typhoon-whisper-large', 'typhoon-whisper-turbo', 'whisper-v3-turbo'], BIG = ['magi-2', 'minimax-h3']; // RUN = เครื่องรัน Kaggle (kaggle-runner.py) รองรับแล้ว · BIG = ใหญ่เกินเครื่องฟรี
MODELS.forEach(m => { m.fit = BIG.includes(m.id) ? 'big' : RUN.includes(m.id) ? 'ok' : m.run === 'cf' ? 'cf' : 'reg'; });
const RECIPES = {}; // สูตรงานแต่ละประเภท: RECIPES.ชื่อ = async (env, job) => {...}  (ยังว่าง — รอกำหนดประเภทงาน)
const allSet = async env => { const r = await env.DB.prepare('SELECT key,value FROM settings').all(), o = {}; for (const x of r.results) o[x.key] = x.value; return o; };
async function supa(s, method, name, body) { // ที่เก็บไฟล์เดิม: Supabase Storage (bucket loras) · settings: supa_url / supa_key / supa_dir
  const u = String(s.supa_url || '').replace(/\/+$/, ''), k = s.supa_key, d = s.supa_dir; if (!u || !k || !d) return null;
  const h = { apikey: k, authorization: 'Bearer ' + k };
  if (body != null) { h['content-type'] = 'application/octet-stream'; h['x-upsert'] = 'true'; }
  return fetch(`${u}/storage/v1/object/loras/${d}/${name}`, { method, headers: h, body: body == null ? undefined : body });
}
RECIPES.image = async (env, job) => { // งานรูป: FLUX.1 schnell (Workers AI) → เก็บลง Supabase
  const sw = await switches(env); if (sw['model_flux-schnell'] !== '1') throw new Error('เปิดสวิตช์ FLUX.1 schnell ในสรุปงานก่อน');
  const s = await allSet(env); if (!s.supa_url || !s.supa_key || !s.supa_dir) throw new Error('ยังไม่ได้ตั้งค่า Supabase (supa_url / supa_key / supa_dir)');
  const out = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt: String(job.input || '').slice(0, 2000), steps: 4 });
  if (!out || !out.image) throw new Error('AI ไม่ได้ส่งภาพกลับมา');
  const bin = atob(out.image), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const r = await supa(s, 'POST', 'n_img_' + job.id + '.jpg', bytes); if (!r || !r.ok) throw new Error('บันทึกภาพลง Supabase ไม่สำเร็จ ' + (r ? r.status : ''));
};
let ready = false;
async function schema(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)'),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS n_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, input TEXT, status TEXT DEFAULT 'queued', err TEXT DEFAULT '', created INTEGER, updated INTEGER)")]);
  await env.DB.prepare('ALTER TABLE n_jobs ADD COLUMN out TEXT').run().catch(() => { });
  ready = true;
}
async function switches(env) {
  const r = await env.DB.prepare("SELECT key,value FROM settings WHERE key LIKE 'sw_%'").all(), o = {};
  for (const n of SW) o[n] = '0';
  for (const x of r.results) o[x.key.slice(3)] = String(x.value);
  return o;
}
const setSw = (env, n, on) => env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('sw_' + n, on ? '1' : '0').run();
function kEnv(env, s) { // รับรหัส Kaggle แบบเดียวกับบอทเก่า: secret ชื่อ KAGGLE_KEY/Token ฯลฯ หรือค่าที่กรอกในหน้าเว็บ (เก็บใน settings: k_user / k_key)
  s = s || {};
  if (!env.KAGGLE_KEY) env.KAGGLE_KEY = env.Token || env.TOKEN || env.token || env.KAGGLE_TOKEN || s.k_key || '';
  if (!env.KAGGLE_USERNAME) env.KAGGLE_USERNAME = env.Username || env.USERNAME || env.username || env.KAGGLE_USER || s.k_user || '';
  env.KAGGLE_USERNAME = String(env.KAGGLE_USERNAME).trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?kaggle\.com\//, '').replace(/\/.*$/, '');
  env.KAGGLE_KEY = String(env.KAGGLE_KEY).trim();
  return env;
}
async function kenv(env) { const r = await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('k_user','k_key')").all().catch(() => ({ results: [] })), s = {}; for (const x of r.results) s[x.key] = x.value; return kEnv({ ...env }, s); }
const kAuth = env => { const k = env.KAGGLE_KEY || ''; return k.startsWith('KGAT_') ? 'Bearer ' + k : 'Basic ' + btoa((env.KAGGLE_USERNAME || '') + ':' + k); };
async function kFetch(env, path) {
  const r = await fetch('https://www.kaggle.com/api/v1' + path, { headers: { authorization: kAuth(env), accept: 'application/json', 'user-agent': 'xiress-bot' } });
  return { ok: r.ok, status: r.status };
}
const rows = async (env, q) => (await env.DB.prepare(q).all().catch(() => ({ results: [] }))).results;
async function status(env) {
  await schema(env); let ke;
  const [jobs, helpers, flux, nv, ns, supa] = await Promise.all([
    rows(env, "SELECT status, COUNT(*) n FROM n_jobs GROUP BY status"),
    rows(env, 'SELECT id,name,on_,seen,done FROM helpers'),
    rows(env, 'SELECT id,name,on_,last_err FROM fluxkeys'),
    rows(env, 'SELECT COUNT(*) n FROM voices'), rows(env, 'SELECT COUNT(*) n FROM sfx_real'),
    rows(env, "SELECT COUNT(*) n FROM settings WHERE key LIKE 'supa%' AND value<>''")]);
  const sw = await switches(env);
  return { ok: true, ver: VER, sw, models: MODELS.map(m => ({ ...m, on: sw['model_' + m.id] === '1' })), jobs, helpers, flux, voices: (nv[0] || {}).n || 0, sfx: (ns[0] || {}).n || 0,
    link: { kaggle: !!((ke = await kenv(env)).KAGGLE_USERNAME && ke.KAGGLE_KEY), github: !!(env.GH_TOKEN && env.GH_REPO), telegram: !!(env.TG_TOKEN && env.TG_CHAT), supabase: ((supa[0] || {}).n || 0) > 0 } };
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
  if (p === '/api/kcred') { // บันทึกรหัส Kaggle (เก็บใน settings เหมือนบอทเก่า · ไม่ส่งกลับมาแสดง) · ว่างทั้งคู่ = ลบ
    const u = String(b.user || '').trim(), k = String(b.key || '').trim();
    if (!u && !k) await env.DB.prepare("DELETE FROM settings WHERE key IN ('k_user','k_key')").run();
    else if (!u || !k) return json({ error: 'ใส่ให้ครบทั้งชื่อผู้ใช้และคีย์' }, 400);
    else await env.DB.batch([env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('k_user', u), env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('k_key', k)]);
    return json({ ok: true });
  }
  if (p === '/api/kaggle-test') { const e = await kenv(env); if (!e.KAGGLE_USERNAME || !e.KAGGLE_KEY) return json({ ok: false, msg: 'ยังไม่ได้ตั้งรหัส Kaggle (ใส่ได้ที่ 🔌 เชื่อมต่อ)' }); const r = await kFetch(e, '/kernels/list?user=' + encodeURIComponent(e.KAGGLE_USERNAME) + '&pageSize=1'); return json({ ok: r.ok, msg: r.ok ? 'Kaggle เชื่อมได้' : 'Kaggle ตอบ ' + r.status }); }
  if (p === '/api/switch') { // ปิด/เปิดรายตัว: สวิตช์หลัก, helper:ID, flux:ID
    const n = String(b.name || ''), on = b.on ? 1 : 0, m = n.match(/^(helper|flux):(\d+)$/), md = n.match(/^model:([\w.\-]+)$/);
    if (md && MODELS.some(x => x.id === md[1])) await setSw(env, 'model_' + md[1], on);
    else if (m) await env.DB.prepare('UPDATE ' + (m[1] === 'helper' ? 'helpers' : 'fluxkeys') + ' SET on_=?1 WHERE id=?2').bind(on, +m[2]).run();
    else if (SW.includes(n)) await setSw(env, n, on);
    else return json({ error: 'ไม่รู้จักสวิตช์นี้' }, 400);
    return json({ ok: true });
  }
  if (p === '/api/img') { const s = await allSet(env), r = await supa(s, 'GET', 'n_img_' + (+url.searchParams.get('id') || 0) + '.jpg'); if (!r || !r.ok) return json({ error: 'ไม่พบภาพ' }, 404); return new Response(r.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=86400', ...CORS } }); }
  if (p === '/api/ref') { // อัปโหลดภาพต้นแบบ (jpg เป็น base64) → เก็บเป็นงาน kind=ref ที่เสร็จแล้ว แล้วอ้างด้วย ref:#เลขงาน · ต้องตั้ง Supabase ไว้แล้ว
    const s = await allSet(env), d = String(b.b64 || '').replace(/^data:[^,]*,/, '');
    if (!d) return json({ error: 'ไม่พบไฟล์ภาพ' }, 400);
    if (d.length > 6e6) return json({ error: 'ภาพใหญ่เกินไป (ไม่เกินราว 4 MB)' }, 400);
    let bin; try { bin = atob(d); } catch (e) { return json({ error: 'ไฟล์ภาพไม่ถูกต้อง' }, 400); }
    const by = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i);
    const ins = await env.DB.prepare("INSERT INTO n_jobs (kind,input,status,out,created,updated) VALUES ('ref',?1,'done','img',?2,?2)").bind(String(b.name || 'ref').slice(0, 80), now).run(), id = ins.meta.last_row_id;
    const r = await supa(s, 'POST', 'n_img_' + id + '.jpg', by);
    if (!r || !r.ok) { await env.DB.prepare('DELETE FROM n_jobs WHERE id=?1').bind(id).run(); return json({ error: 'บันทึกภาพลง Supabase ไม่สำเร็จ (ตั้ง supa_url / supa_key / supa_dir แล้วหรือยัง)' }, 500); }
    return json({ ok: true, id });
  }
  if (p === '/api/k/next') { // เครื่อง Kaggle ดึงงาน: ?models=a,b
    const ms = (url.searchParams.get('models') || '').split(',').filter(Boolean); if (!ms.length) return json({ job: null });
    const j = await env.DB.prepare("SELECT id,kind,input FROM n_jobs WHERE status='kwait' AND substr(kind,1,2)='k:' ORDER BY id LIMIT 20").all(), x = j.results.find(r => ms.includes(r.kind.slice(2)));
    if (!x) return json({ job: null });
    await env.DB.prepare("UPDATE n_jobs SET status='running',updated=?1 WHERE id=?2 AND status='kwait'").bind(now, x.id).run();
    return json({ job: { id: x.id, model: x.kind.slice(2), input: x.input } });
  }
  if (p === '/api/k/done') { // เครื่อง Kaggle ส่งผล: {id, ok, err, out, b64(jpg)}
    const id = +b.id || 0; let err = b.ok ? '' : String(b.err || 'พลาด').slice(0, 300), out = String(b.out || '').slice(0, 20000);
    if (b.ok && b.b64) { const s = await allSet(env), bin = atob(b.b64), by = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i); const r = await supa(s, 'POST', 'n_img_' + id + '.jpg', by); if (!r || !r.ok) { err = 'บันทึกภาพลง Supabase ไม่สำเร็จ'; b.ok = 0; } else out = 'img'; }
    await env.DB.prepare('UPDATE n_jobs SET status=?1,err=?2,out=?3,updated=?4 WHERE id=?5').bind(b.ok ? 'done' : 'failed', err, out, now, id).run();
    return json({ ok: true });
  }
  if (p === '/api/jobs') return json({ jobs: await rows(env, 'SELECT id,kind,status,err,out,created FROM n_jobs ORDER BY id DESC LIMIT 50') });
  if (p === '/api/job/add') { const k = String(b.kind || '').trim().slice(0, 40); if (!k) return json({ error: 'ใส่ประเภทงานก่อน' }, 400); await env.DB.prepare('INSERT INTO n_jobs (kind,input,created,updated) VALUES (?,?,?,?)').bind(k, String(b.input || '').slice(0, 4000), now, now).run(); return json({ ok: true }); }
  if (p === '/api/job/cancel') { await env.DB.prepare("UPDATE n_jobs SET status='cancelled',updated=?1 WHERE id=?2 AND status IN ('queued','running','kwait')").bind(now, +b.id || 0).run(); return json({ ok: true }); }
  if (p === '/api/jobs/clear') { await env.DB.prepare("UPDATE n_jobs SET status='cancelled',updated=?1 WHERE status IN ('queued','running','kwait')").bind(now).run(); return json({ ok: true }); }
  if (p === '/api/wipe') { // ล้างข้อมูลเก่า: ต้องพิมพ์ยืนยัน · เก็บ settings, fluxkeys, helpers, voices, sfx_real · กู้คืนไม่ได้
    if (b.confirm !== 'ลบทั้งหมด') return json({ error: 'ต้องพิมพ์ ลบทั้งหมด เพื่อยืนยัน' }, 400);
    for (const n of SW) await setSw(env, n, 0);
    await env.DB.batch(WIPE.map(t => env.DB.prepare('DROP TABLE IF EXISTS ' + t)));
    return json({ ok: true, dropped: WIPE.length });
  }
  return json({ error: 'ไม่พบคำสั่งนี้' }, 404);
}
async function tick(env) { // ตัวจัดคิว (cron ทุกนาที) — ทำงานเมื่อสวิตช์ master + queue เปิดเท่านั้น · สูงสุด 3 งานต่อรอบ
  await schema(env);
  const s = await switches(env); if (s.master !== '1' || s.queue !== '1') return;
  for (let n = 0; n < 3; n++) {
    const j = await env.DB.prepare("SELECT id,kind,input FROM n_jobs WHERE status='queued' ORDER BY id LIMIT 1").first(); if (!j) return;
    const set = (st, err) => env.DB.prepare('UPDATE n_jobs SET status=?1,err=?2,updated=?3 WHERE id=?4').bind(st, err || '', Date.now(), j.id).run();
    if (j.kind.startsWith('k:')) {
      const m = MODELS.find(x => x.id === j.kind.slice(2));
      if (!m) { await set('failed', 'ไม่รู้จักโมเดลนี้'); continue; }
      if (m.fit !== 'ok') { await set('failed', m.fit === 'big' ? 'โมเดลนี้ใหญ่เกินเครื่อง Kaggle ฟรี' : 'โมเดลนี้ยังไม่มีสูตรบนเครื่องรัน'); continue; }
      if (s['model_' + m.id] !== '1') { await set('failed', 'เปิดสวิตช์โมเดล ' + m.name + ' ก่อน'); continue; }
      if (s.kaggle !== '1') { await set('failed', 'เปิดสวิตช์ "ใช้เครื่อง Kaggle" ก่อน'); continue; }
      await set('kwait'); continue;
    }
    const r = RECIPES[j.kind]; if (!r) { await set('failed', 'ยังไม่มีสูตรงานประเภท "' + j.kind + '"'); continue; }
    await set('running');
    try { await r(env, j); await set('done'); } catch (e) { await set('failed', String(e.message || e).slice(0, 300)); }
  }
}
export default {
  async fetch(req, env) { try { return await handle(req, env); } catch (e) { return json({ error: String(e.message || e) }, 500); } },
  async scheduled(ev, env, ctx) { ctx.waitUntil(tick(env)); }
};
