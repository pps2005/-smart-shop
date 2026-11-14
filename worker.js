// ===== Anime Image Bot — Cloudflare Worker (ภาพ: SDXL อนิเมะ / FLUX.1-dev บน Kaggle (เลือกเอง/อัตโนมัติ) · Flux schnell สำรอง + D1 + Cron) =====
// Bindings ที่ต้องตั้งใน Cloudflare:  AI (Workers AI),  DB (D1: anime-bot-db)
// Variables (Secret):  PASSWORD   | ไม่บังคับ: TG_TOKEN, TG_CHAT (แจ้งเตือน Telegram)
// วิดีโอ (ไม่บังคับ): KAGGLE_USERNAME, KAGGLE_KEY → ทำวิดีโอด้วย GPU ฟรีของ Kaggle อัตโนมัติ
// Cron Trigger:  * * * * *   (บอทเช็คทุกนาที แต่สร้างภาพตามระยะห่างที่ตั้งในเว็บ)
// ใช้คู่กับ studio.html แท็บ "เจนภาพ" (เรียก API นี้ข้ามโดเมน จึงเปิด CORS ไว้ · ป้องกันด้วย PASSWORD)

import SCENES from './scenes.json';
import IDEAS from './ideas.json';
import WORLD from './world.json';
import SBX from './sbx.json'; // สตอรีบอร์ดที่เขียนมือ (เรื่อง → ตอน → ซีน → ช็อต) นำเข้าด้วย settings sb_import
import MANGA from './mangaep.json';
import SETS from './sets.json'; // ฉาก 3D แบบกล่อง (ห้อง/ของ/จุดยืน/มุมกล้อง) ต่อสถานที่ — ทุกช่องในสถานที่เดียวกันใช้ฉากเดียวกัน // คลังโลก: อาวุธ พลังอาคม ของวิเศษ โลกและจักรวาล (400 รายการ) // คลังไอเดีย 600 รายการ (ตัวละคร ชุด พร็อพ สัตว์ องค์ประกอบฉาก เอฟเฟกต์) พร้อมรหัส CHR/COS/PRP/CRT/ELM/FX // คลัง 1000 ฉากอนิเมะของผู้ใช้ (Anime_Scene_Library_1000.xlsx) ใช้สุ่มแคสติ้งหมวดฉาก
const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const BOT_VER = 'draft-k-2';

// ----- มิเตอร์การอ่านฐานข้อมูล: D1 ฟรีอ่านได้ 5 ล้านแถว/วัน (นับตามแถวที่สแกน) เกินแล้วระบบดับทั้งวัน → นับเองทุกคำสั่ง แล้วชะลองานเบื้องหลังเมื่อใกล้เพดาน -----
const READ_CAP = 5000000, READ_SLOW = 3200000, READ_STOP = 4850000, READ_WEB = 4850000, READ_KSTOP = 4850000; // ผู้ใช้สั่ง: ใช้ได้ถึง 97% ก่อนรีเซ็ต 07:00 (เก็บ 3% ไว้ให้หน้าเว็บ) — // 85% หยุดงานเบื้องหลัง · 90% หน้าเว็บเข้าโหมดประหยัด · 95% หยุดจ่ายงานให้ Kaggle (ทำต่อหลังรีเซ็ต)
// ชะลอตั้งแต่ต้นวัน: แบ่งโควตาให้พอทั้งวัน (ใช้ได้ราว 80% เกลี่ยตาม 24 ชม. + เผื่อ 5%) ถ้าใช้เร็วกว่ากำหนด งานเบื้องหลังจะเว้นช่วงห่างขึ้นเอง
function readPace(rr, now) { const t = now || Date.now(), d0 = Date.parse(new Date(t).toISOString().slice(0, 10) + 'T00:00:00Z'), budget = READ_CAP * (0.80 * (t - d0) / 86400000 + 0.05);
  return { budget, every: rr <= budget ? 1 : rr <= budget + READ_CAP * 0.05 ? 3 : rr <= budget + READ_CAP * 0.10 ? 6 : 12 }; }
const readDay = () => 'rr:' + new Date().toISOString().slice(0, 10);
function meterDB(db, acc, tag0) { // นับแถวที่อ่าน แยกตามที่มา (tag) เพื่อโชว์หลอด % ในหน้าสตูดิโอ
  let tag = tag0 || 'อื่นๆ';
  acc.by = acc.by || {};
  const add = r => { const n = (r && r.meta && +r.meta.rows_read) || 0; acc.n += n; acc.by[tag] = (acc.by[tag] || 0) + n; acc.w = (acc.w || 0) + ((r && r.meta && +r.meta.rows_written) || 0); if (r && r.meta && +r.meta.size_after) acc.size = +r.meta.size_after; return r; };
  const wrap = st => ({
    __st: st,
    bind: (...a) => wrap(st.bind(...a)),
    all: async () => add(await st.all()),
    run: async () => add(await st.run()),
    first: async c => { const r = add(await st.all()), row = r.results && r.results[0]; return row == null ? null : (c ? row[c] : row); }
  });
  return { prepare: q => wrap(db.prepare(q)), batch: async l => { const r = await db.batch(l.map(x => x.__st || x)); for (const x of r) add(x); return r; }, setTag: t => { tag = t; }, withTag: t => meterDB(db, acc, t) };
}
// โควตาฟรีอื่นๆ (แยกจากหลอดอ่านฐานข้อมูล): qmeter(day,k,v) · day = วัน UTC หรือวันเริ่มสัปดาห์ Kaggle
const utcDay = t => new Date(t || Date.now()).toISOString().slice(0, 10);
const kgWeek = t => { const d = new Date(t || Date.now()), back = (d.getUTCDay() + 1) % 7; return utcDay(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)); }; // Kaggle รีเซ็ตราวเสาร์ 00:00 UTC (07:00 ไทย) — ค่าประมาณ
async function qadd(env, k, v, day) { try { await env.DB.prepare('INSERT INTO qmeter (day,k,v) VALUES (?1,?2,?3) ON CONFLICT(day,k) DO UPDATE SET v=v+excluded.v').bind(day || utcDay(), k, v).run(); } catch (e) { } }
async function qset(env, k, v, day) { try { await env.DB.prepare('INSERT INTO qmeter (day,k,v) VALUES (?1,?2,?3) ON CONFLICT(day,k) DO UPDATE SET v=excluded.v').bind(day || utcDay(), k, v).run(); } catch (e) { } }
const tagged = (env, t) => (env.DB && env.DB.withTag ? { ...env, DB: env.DB.withTag(t) } : env);
async function flushReads(db, acc, min) {
  const n = acc.n, w = acc.w || 0, sz = acc.size || 0, rq = acc.req ? 1 : 0; acc.req = 0; if (n < (min || 1) && !w && !rq) return; acc.n = 0; acc.w = 0; const by = acc.by || {}; acc.by = {};
  const day = new Date().toISOString().slice(0, 10);
  try {
    await db.batch([db.prepare("INSERT INTO settings (key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(settings.value AS INTEGER)+CAST(excluded.value AS INTEGER) AS TEXT)").bind(readDay(), String(n)),
      ...Object.entries(by).filter(([, v]) => v > 0).map(([t, v]) => db.prepare('INSERT INTO rmeter (day,tag,n,c) VALUES (?1,?2,?3,1) ON CONFLICT(day,tag) DO UPDATE SET n=n+excluded.n, c=c+1').bind(day, t, v)),
      ...(w || rq ? [db.prepare('INSERT INTO qmeter (day,k,v) VALUES (?1,?2,?3) ON CONFLICT(day,k) DO UPDATE SET v=v+excluded.v').bind(day, 'dw', w + 2 + Object.keys(by).length), db.prepare('INSERT INTO qmeter (day,k,v) VALUES (?1,?2,?3) ON CONFLICT(day,k) DO UPDATE SET v=v+excluded.v').bind(day, 'req', rq)] : []),
      ...(sz ? [db.prepare("INSERT INTO qmeter (day,k,v) VALUES ('all','dbsize',?1) ON CONFLICT(day,k) DO UPDATE SET v=excluded.v").bind(sz)] : [])]);
  } catch (e) { try { await db.batch([db.prepare('CREATE TABLE IF NOT EXISTS rmeter (day TEXT, tag TEXT, n INTEGER, c INTEGER, PRIMARY KEY(day,tag))'), db.prepare('CREATE TABLE IF NOT EXISTS qmeter (day TEXT, k TEXT, v REAL, PRIMARY KEY(day,k))')]); } catch (x) { } }
}
export default {
  async fetch(req, env0, ctx) {
    const acc = { n: 0, req: 1 }, env = { ...env0, DB: meterDB(env0.DB, acc) };
    try { return await handleFetch(req, env, ctx); } finally { ctx.waitUntil(flushReads(env0.DB, acc, 1)); }
  },
  async scheduled(event, env0, ctx) {
    const acc = { n: 0 }, env = { ...env0, DB: meterDB(env0.DB, acc) }, jobs = [];
    await handleCron(event, env, { waitUntil: p => jobs.push(p) });
    ctx.waitUntil(Promise.allSettled(jobs).then(async () => { await flushReads(env0.DB, acc, 1); if (new Date().getUTCMinutes() === 7) await env0.DB.prepare("DELETE FROM settings WHERE key LIKE 'rr:%' AND key < ?").bind('rr:' + new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)).run().catch(() => { }); if (new Date().getUTCMinutes() === 7) await env0.DB.prepare('DELETE FROM rmeter WHERE day < ?').bind(new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)).run().catch(() => { }); }));
  },
};
async function handleFetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (p === '/') return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    if (p.startsWith('/k/') && env.DB.setTag) env.DB.setTag('kaggle:' + (p.split('/')[2] || ''));
    if (p.startsWith('/k/')) return (await vRoutes(req, env, url, ctx).catch(e => json({ error: String(e.message || e) }, 500)));
    if (p.startsWith('/h/')) return (await helperScript(env, url).catch(e => new Response('# error: ' + String(e.message || e), { status: 500 })));
    if (p.startsWith('/vv/')) { // ลิงก์คลิปแบบมีลายเซ็น ให้เครื่อง Kaggle ดึงไปรวมคลิป (ไม่เปิดรหัสผ่านเจ้าของ)
      const vid = +p.split('/')[2];
      if (!vid || url.searchParams.get('s') !== await vvSig(env, vid)) return new Response('forbidden', { status: 403 });
      return getVideo(req, env, vid);
    }
    if (p.startsWith('/vi/')) { // ภาพคีย์แบบมีลายเซ็น ให้เครื่อง Kaggle ดึงไปทำช็อตภาพนิ่งตอนรวมตอน
      const iid = +p.split('/')[2];
      if (!iid || url.searchParams.get('s') !== await vvSig(env, 'i' + iid)) return new Response('forbidden', { status: 403 });
      const r = await env.DB.prepare('SELECT data FROM images WHERE id=?').bind(iid).first();
      return r && r.data ? new Response(b64ToBytes(r.data), { headers: { 'content-type': 'image/jpeg' } }) : new Response('not found', { status: 404 });
    }
    if (!authOK(req, url, env)) return json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
    if (env.DB.setTag) env.DB.setTag(p.startsWith('/img/') ? 'web:img' : 'web:' + p.replace(/^\/api\//, ''));
    await ensureSchema(env);
    if (selfUrl !== url.origin) { selfUrl = url.origin; ctx.waitUntil(setSetting(env, 'self_url', url.origin)); }
    try {
      if (p === '/api/vstate' || p.startsWith('/vid/')) return await vApi(req, env, url, ctx, {});
      if (p === '/api/vcast') return await castApi(req, env, url, {});
      if (p === '/api/ping') return json({ ok: true, bot: 'anime-image-bot', github: !!(env.GH_TOKEN && env.GH_REPO), ver: BOT_VER, kseen: +((await getSettings(env)).k_seen) || 0 });
      if (p === '/api/state') return json(await getState(env));
      if (p.startsWith('/img/')) return getImage(env, +p.split('/')[2]);
      if (p.startsWith('/vo/')) { const r = await env.DB.prepare('SELECT data,mime FROM voices WHERE id=?').bind(+p.split('/')[2]).first(); return r ? new Response(b64ToBytes(r.data), { headers: { 'content-type': r.mime || 'audio/mp4', 'cache-control': 'private, max-age=31536000, immutable', ...CORS } }) : new Response('not found', { status: 404 }); } // เสียงพากย์ทีละบรรทัด
      if (p === '/api/zip') return makeZip(env, url.searchParams.get('project') || '', url.searchParams.get('starred') === '1');
      if (req.method !== 'POST') return json({ error: 'not found' }, 404);
      const body = await req.json().catch(() => ({}));
      if (env.DB.setTag) env.DB.setTag('web:' + p.replace(/^\/api\//, '') + (body && body.act ? ':' + String(body.act).slice(0, 20) : ''));
      if (p.startsWith('/api/vcast')) { const cr = await castApi(req, env, url, body); if (cr) return cr; }
      if (p.startsWith('/api/v')) { const vr = await vApi(req, env, url, ctx, body); if (vr) return vr; }
      if (p === '/api/anime') return json(await animeApi(env, body));
      if (p === '/api/enqueue') return json(await enqueue(env, body));
      if (p === '/api/fluxkeys') return json(await fluxKeysApi(env, body));
      if (p === '/api/settings') {
        for (const k of ['interval_min', 'style', 'character', 'steps', 'pace', 'slots', 'style_preset', 'auto_fill', 'script_model', 'img_engine', 'auto_char_engine', 'auto_obj_engine', 'img_model', 'img_quant', 'img_w', 'img_h', 'img_cap', 'auto_lora', 'cast_on', 'aud_auto'])
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
      if (p === '/api/clearqueue') { await env.DB.prepare("DELETE FROM jobs WHERE status IN ('queued','failed','kaggle')").run(); await env.DB.prepare("DELETE FROM vjobs WHERE kind='img' AND status='queued'").run(); return json({ ok: true }); }
      if (p === '/api/clearjobs') { const pre = String(body.prefix || ''); if (!pre) return json({ error: 'no prefix' }, 400); const r = await env.DB.prepare("DELETE FROM jobs WHERE instr(project,?)=1 AND status!='running'").bind(pre).run(); return json({ ok: true, n: (r.meta && r.meta.changes) || 0 }); }
      if (p === '/api/clearnotices') { await env.DB.prepare('DELETE FROM notices').run(); return json({ ok: true }); }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String(e.message || e) }, 500);
    }
}
async function handleCron(event, env, ctx) {
    await ensureSchema(env);
    const kv0 = {}; for (const x of ((await env.DB.prepare('SELECT key,value FROM settings WHERE key IN (?,?,?,?)').bind(readDay(), 'boost_until', 'sb_import', 'sb_redraw').all().catch(() => ({ results: [] }))).results || [])) kv0[x.key] = x.value;
    const rrNow = +kv0[readDay()] || 0;
    // งานที่สั่งอัปเดต (นำเข้าสตอรีบอร์ด/วาดใหม่) = งานด่วน: ไม่ต้องรอรอบที่ชะลอไว้ · เปิดโหมดเร่ง 10 นาทีให้ส่งงานวาดต่อได้ทันที (ยกเว้นเกิน 90% เพื่อกันเว็บล่ม)
    if ((kv0.sb_import || kv0.sb_redraw) && rrNow <= READ_WEB && !(+kv0.boost_until > Date.now())) { kv0.boost_until = String(Date.now() + 10 * 60000); await setSetting(env, 'boost_until', kv0.boost_until); }
    const boost = +kv0.boost_until > Date.now();
    if (rrNow <= READ_STOP && !boost) { const pc = readPace(rrNow); if (new Date().getUTCMinutes() % pc.every) return; } // ปุ่มเร่งสตอรีบอร์ด: ไม่เว้นช่วง // ใช้เร็วกว่ากำหนด: เว้นช่วงทำงาน (ทุก 3/6/12 นาที)
    if (rrNow > (boost ? READ_WEB : READ_STOP)) return; // ถึง 85% แล้ว (โหมดเร่ง/งานด่วน: ถึง 90%): งานเบื้องหลังทุกอย่างพักไว้ทำต่อหลังรีเซ็ต 07:00 เพื่อให้หน้าเว็บยังเปิดได้ (เดิมกันแค่คิววาดภาพ งานอื่นยังวิ่งจนทะลุ 100%)
    ctx.waitUntil(tick(tagged(env, 'bg:tick'), false).then(r => setSetting(env, 'tick_dbg', new Date().toISOString() + ' ' + JSON.stringify(r).slice(0, 200))).catch(e => setSetting(env, 'tick_dbg', new Date().toISOString() + ' ERR ' + String(e && e.stack || e).slice(0, 400))));
    ctx.waitUntil(autoHeal(tagged(env, 'bg:heal')).catch(() => {}).then(() => vTick(tagged(env, 'bg:kaggle'), false)).catch(e => setSetting(env, 'k_error', String(e.message || e).slice(0, 300))));
    ctx.waitUntil(helperKTick(tagged(env, 'bg:kaggle')).catch(() => { }));
    ctx.waitUntil(cpuKTick(tagged(env, 'bg:kaggle')).catch(() => { })); // ผู้ช่วย (ครอบครัว) ที่ผูก API ของ Kaggle ไว้: เปิดเครื่องบัญชีเขาเองเมื่อคิวงานเยอะ
    ctx.waitUntil(castBatch(tagged(env, 'bg:cast'), 0, false).catch(() => {}));
    ctx.waitUntil(audDaily(tagged(env, 'bg:aud')).catch(() => {}));
}

// ---------- ซ่อมงานที่พังอัตโนมัติ ----------
// งานวิดีโอ/เสียงที่พัง: รอ 2 ชม. (เผื่อแก้โค้ดหรือเครื่องว่าง) แล้วส่งกลับเข้าคิวเอง สูงสุด 6 ครั้ง
// ภาพที่พัง (ไม่ใช่เพราะโควตา): ลองใหม่เองสูงสุด 2 รอบ
// ที่เก็บไฟล์ LoRA: Supabase Storage (ฟรี 1 GB) — D1 เล็กเกินจะเก็บไฟล์ LoRA · ตั้งค่า supa_url / supa_key / supa_dir ใน settings
async function supa(s, method, name, body) {
  const u = String(s.supa_url || '').replace(/\/+$/, ''), k = s.supa_key, d = s.supa_dir; if (!u || !k || !d) return null;
  const h = { apikey: k, authorization: 'Bearer ' + k };
  if (body != null) { h['content-type'] = 'application/octet-stream'; h['x-upsert'] = 'true'; }
  return fetch(`${u}/storage/v1/object/loras/${d}/${name}`, { method, headers: h, body: body == null ? undefined : body });
}
async function supaDelLora(env, lid) { try { const s = await getSettings(env), n = +String(s['lparts:' + lid] || '').split(',')[0] || 0; for (let i = 0; i < n; i++) await supa(s, 'DELETE', `l${lid}_${i}`); if (n) await env.DB.prepare('DELETE FROM settings WHERE key=?').bind('lparts:' + lid).run(); } catch (e) { } }
async function supaSelfTest(env, s) { // ทดสอบที่เก็บไฟล์: เขียน → เขียนทับ → อ่าน → ลบ (สั่งด้วย settings supa_test=1)
  let out = '';
  try {
    const b = new Uint8Array(300000); for (let i = 0; i < b.length; i++) b[i] = (i * 31 + 7) & 255;
    const a = await supa(s, 'POST', 'selftest_0', b); if (!a) throw new Error('ยังไม่ได้ตั้งค่า'); out += 'put ' + a.status; if (!a.ok) out += ' ' + (await a.text()).slice(0, 150);
    const a2 = await supa(s, 'POST', 'selftest_0', b); out += ' · put2 ' + a2.status;
    const g = await supa(s, 'GET', 'selftest_0'), gb = new Uint8Array(await g.arrayBuffer()); out += ' · get ' + g.status + ' ' + gb.length + (gb.length === b.length && gb[12345] === b[12345] ? ' same' : ' DIFF');
    const d = await supa(s, 'DELETE', 'selftest_0'); out += ' · del ' + d.status;
  } catch (e) { out += ' · error ' + String(e.message || e).slice(0, 200); }
  await setSetting(env, 'supa_test', out);
}
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
  const st = Math.min(8, Math.max(1, +(nx && nx.steps) || +s.steps || 4)), per = 19.2 + 38.4 * st; // วัดจริง: ภาพ 1024² ที่ 4 สเต็ป ใช้ราว 170–190 neurons
  const nk = (await env.DB.prepare('SELECT COUNT(*) n FROM fluxkeys WHERE on_=1').first().catch(() => ({ n: 0 }))) || { n: 0 };
  const budget = Math.max(1, Math.floor(8500 * (1 + (+nk.n || 0)) / hrs.length / per));
  const info = JSON.stringify({ start, next, n: +s.slot_n || 0, budget });
  if (info !== s.slot_info) await setSetting(env, 'slot_info', info);
  return { full: (+s.slot_n || 0) >= budget };
}
// ---- โควตา Flux จากผู้ช่วย: บัญชี Cloudflare ของแต่ละคน (token สิทธิ์ Workers AI อย่างเดียว) ใช้ต่อเมื่อโควตาเราหมด ----
const isQuota = m => /neuron|allocation|quota|exceed|limit|4006|3036|429/i.test(m);
function nextReset() { const early = new Date().getUTCHours() < 6, d = new Date(); d.setUTCHours(24, 2, 0, 0); return early ? Date.now() + 30 * 60000 : d.getTime(); }
async function activeKeys(env, now) { return (await env.DB.prepare('SELECT * FROM fluxkeys WHERE on_=1 AND COALESCE(paused_until,0)<? ORDER BY id').bind(now).all()).results; }
async function runHelper(k, prompt, steps, seed) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(k.acct)}/ai/run/${MODEL}`, { method: 'POST', headers: { authorization: 'Bearer ' + k.token, 'content-type': 'application/json' }, body: JSON.stringify({ prompt, steps }) }); // flux-schnell บน Workers AI ไม่รับ seed
  const j = await r.json().catch(() => ({}));
  if (r.ok && j.result && j.result.image) return j.result.image;
  throw new Error(`[${r.status}] ` + JSON.stringify(j.errors || j).slice(0, 300));
}

// ---------- ออดิชันตัวละคร: แต่ละบทมีผู้สมัครหน้าตา/บุคลิกต่างกันจริง + ภาพออดิชันช็อตเดียวกันให้เทียบ ----------
const AUD_ROLES = [
  { key: 'อายะ', role: 'นางเอก · นักผนึกเถื่อน', g: 'woman', age: [20, 24], outfit: 'a long dark sealer coat over a simple shirt, fitted trousers, boots, a belt pouch of paper talismans', shot: 'standing on a stone street of a fantasy town at dusk, holding a glowing paper talisman between two fingers, magic rune circle forming around her hand, cool determined look', traits: ['เงียบ', 'ลึกลับ', 'เย็นชา', 'ขี้อายลึกๆ', 'ดื้อ', 'มุ่งมั่น', 'ขี้เหงา'] },
  { key: 'อาเคยะ', role: 'พระเอก · หนุ่มร่าเริงที่ซ่อนอสูรไว้ในตัว', g: 'young man', age: [20, 23], outfit: 'casual layered streetwear (hoodie or sweater with a light jacket), jeans, sneakers, a folded umbrella', shot: 'grinning brightly and offering an umbrella toward the viewer in light rain, one eye faintly glowing red in the shadow', traits: ['ร่าเริง', 'เสียงดัง', 'ใจดี', 'ขี้กลัว', 'ซุ่มซ่าม', 'จริงใจ', 'มีความลับ'] },
  { key: 'โยมะ', role: 'สารวัตรแฝงตัว · สุขุม', g: 'man', age: [25, 30], outfit: 'a long investigator coat, waistcoat, shirt and tie, a silver patrol badge, gloves', shot: 'reading a small leather case notebook under a street lamp at night, glancing sharply at the viewer', traits: ['สุขุม', 'ฉลาด', 'สุภาพ', 'จริงจัง', 'ช่างสังเกต', 'เก็บความรู้สึก'] },
  { key: 'ซานะ', role: 'เพื่อนสนิทนางเอก · สาวร้านขนมปัง', g: 'young woman', age: [19, 22], outfit: 'a cosy blouse and cardigan with a long skirt and a bakery apron with flour marks', shot: 'in a warm bakery holding up a basket of fresh bread, flour on her cheek, shy but stubborn smile', traits: ['ขี้อาย', 'ใจดี', 'ดื้อ', 'ขี้ตกใจ', 'อบอุ่น', 'พูดตรง'] },
  { key: 'กาซึ', role: 'ผู้ใหญ่ลึกลับที่คอยดูแล · อาจเป็นตัวร้าย', g: 'man', age: [32, 38], outfit: 'a dark shirt with rolled sleeves and a long open coat, a pocket watch chain', shot: 'leaning against a doorway at night, flicking a glowing talisman between his fingers with a sly smile', traits: ['ขี้เล่น', 'เจ้าเล่ห์', 'ลึกลับ', 'ใจดีแบบแปลกๆ', 'ฉลาด', 'มีอดีต'] },
];
const AUD = {
  hairC: ['jet black', 'silver white', 'ash grey', 'deep navy', 'chestnut brown', 'honey blonde', 'copper orange', 'crimson red', 'soft pink', 'lavender', 'dark teal', 'two-tone black and white'],
  hairS_f: ['very long straight hair', 'long wavy hair', 'shoulder-length bob', 'short pixie cut', 'high ponytail', 'twin low braids', 'side-swept long bangs with a half-up bun', 'messy wolf cut'],
  hairS_m: ['short messy hair', 'swept-back hair', 'shaggy medium hair', 'undercut', 'neat side part', 'long hair tied in a low ponytail', 'spiky hair', 'curly short hair'],
  eye: ['grey', 'amber', 'emerald green', 'ice blue', 'violet', 'gold', 'dark brown', 'heterochromia blue and gold'],
  face: ['sharp narrow eyes', 'large gentle eyes', 'droopy sleepy eyes', 'fierce upturned eyes', 'soft round face', 'sharp jawline', 'freckles', 'a small beauty mark'],
  extra: ['a single earring', 'round glasses', 'a choker', 'a scar across the eyebrow', 'a hair clip', 'a scarf', 'fingerless gloves', 'a beaded bracelet', 'none'],
  build: ['tall and slender with model-like proportions', 'tall with long legs and an elegant figure', 'slim and graceful', 'tall, fit and well-proportioned'],
  names_f: ['ฮินะ', 'มิซากิ', 'เร็น', 'ชิซุกุ', 'อาโออิ', 'ยูกิ', 'คาเอเดะ', 'ซากุระ', 'นัตสึ', 'มิโอ', 'รุย', 'สึบากิ'],
  names_m: ['เร็นจิ', 'ไคโตะ', 'ฮารุ', 'โซรา', 'ยูโตะ', 'ทาคุมิ', 'ริคุ', 'เคนจิ', 'โทมะ', 'ชิน', 'อิซึมิ', 'ซึบาสะ'],
};
const pk = (r, a) => a[Math.floor(r() * a.length)];

// ---------- ลุคหลากหลาย (ทุกตัวเป็นผู้ใหญ่ 19+ · แนวเซ็กซี่ = แต่งตัวเต็ม เย้ายวนแบบแฟชั่น ไม่โป๊) ----------
const LOOK = {
  vibes: { cute: 'cute and sweet, soft gentle charm', sexy: 'alluring and sexy in a tasteful fashionable way, confident and mature charm', cool: 'cool and stylish, sharp edgy charm', elegant: 'elegant and refined, graceful charm', mixed: 'cute-sexy gap charm, sweet face with an alluring figure and a playful confident look' },
  outfit_f: {
    cute: ['a pastel oversized knit sweater with a pleated mini skirt and knee socks', 'a frilly sailor-style blouse with a ribbon and a short skirt (adult casual fashion)', 'a lolita-inspired dress with lace and a bow headband', 'a fluffy hooded jacket with shorts and thigh-high socks', 'a cozy cardigan, a ribbon blouse and a tiered skirt', 'a yellow raincoat over a cute dress and rain boots', 'overalls over a striped tee with a beret', 'a puff-sleeve sundress with a straw hat'],
    sexy: ['a plunging deep-V bodycon dress showing cleavage', 'a tight low-cut crop top with a short skirt', 'a strapless mini dress with a high slit', 'a low-cut sheer-sleeved evening gown with a high slit', 'an open-front blouse tied at the waist over a bandeau top and short shorts', 'a fitted off-shoulder knit top with high-waisted jeans, bare collarbones', 'an elegant backless evening dress with a long slit, fully covered and tasteful', 'a cropped jacket, a fitted tank top and leather shorts with thigh-high boots', 'a silky slip dress with a loose blazer', 'a bodycon turtleneck dress with a belt and long boots', 'a halter-neck top with a long flowing skirt and layered necklaces', 'a lace-trimmed bralette-style top under an open shirt and jeans', 'a sleek black cocktail dress with sheer sleeves'],
    cool: ['a leather biker jacket, a band tee, ripped jeans and boots', 'a tech-wear jacket with straps, cargo pants and sneakers', 'an oversized trench coat with a hoodie and combat boots', 'a punk-style plaid skirt, a studded belt and a chain accessory', 'a sporty crop hoodie, track pants and chunky sneakers', 'a tailored suit with an open collar and no tie'],
    elegant: ['a long tailored coat, a silk blouse and a pencil skirt', 'a floral kimono-style haori with a modern long skirt', 'a long gown with a lace shawl', 'a white one-piece dress with a thin cardigan and a pearl necklace', 'a refined blazer dress with heeled boots'],
  },
  outfit_m: {
    cute: ['an oversized pastel hoodie with loose jeans and sneakers', 'a knit vest over a white shirt with a bow tie', 'a soft sweater with a scarf and a tote bag', 'a striped tee, suspenders and a beanie', 'a baggy cardigan and a long-sleeve tee with round glasses'],
    sexy: ['an open shirt showing a toned chest with slim trousers', 'a tight sleeveless top showing muscular arms with a light jacket', 'an unbuttoned loose shirt over a fitted tee, slim trousers and a chain necklace', 'a fitted black turtleneck with an open long coat', 'a white shirt with rolled sleeves, loosened tie and suspenders', 'a sleeveless-layered top showing toned arms with a light jacket over the shoulders', 'a tailored dark suit with an open collar and a loose tie', 'a leather jacket over a V-neck shirt and dark jeans'],
    cool: ['a bomber jacket, cargo pants and chunky sneakers', 'a tech-wear coat with straps and a mask around the neck', 'a long coat, a hoodie and combat boots', 'a varsity jacket with a graphic tee and ripped jeans', 'a denim jacket with a band tee and silver rings'],
    elegant: ['a three-piece suit with a pocket watch chain', 'a long wool coat over a turtleneck and tailored trousers', 'a modern hakama-style outfit with a haori', 'a crisp white shirt, a vest and a long scarf', 'a navy blazer with a silk shirt and loafers'],
  },
  bg: ['a neon-lit Tokyo alley at night with glowing signs', 'a sunlit cafe terrace with flowers', 'a rooftop at sunset with a city skyline', 'a cherry blossom path with falling petals', 'a rainy street with reflections and umbrellas', 'a cozy bookshop with warm lamps', 'a seaside promenade at golden hour', 'a snowy shrine entrance with red torii gates', 'a lively night festival with lanterns and stalls', 'a modern high-rise balcony at night', 'a flower-filled greenhouse', 'a retro arcade with colorful lights', 'a quiet train platform at dawn', 'a luxurious hotel lounge with chandeliers', 'a school-style library with floating dust in sunlight', 'a starry hilltop with a telescope', 'an old shopping arcade (shotengai) in the evening', 'a beach with turquoise water and clouds', 'a fantasy town square with glowing magic lights', 'a rooftop pool at twilight', 'an autumn park with red maple leaves', 'a stylish studio with soft pink and blue gradient lighting', 'a moonlit bridge over a river with fireflies', 'a futuristic cyber city street with holograms', 'a Japanese hot-spring town street at dusk', 'a sunflower field under a summer sky', 'a rainy convenience store front at midnight'],
  pose: ['hand running through hair, looking at the viewer', 'leaning forward with a gentle smile', 'looking back over the shoulder', 'one hand waving, laughing', 'arms crossed with a confident smirk', 'sitting casually with legs crossed', 'walking toward the viewer, wind blowing the hair', 'hands in pockets, a relaxed cool look', 'holding a drink, head tilted', 'covering a blushing smile with one hand', 'stretching one arm up, cheerful', 'resting the chin on a hand, a calm gaze'],
  build_f: { cute: ['petite and slim with a youthful figure', 'small and soft with a gentle figure', 'slim and slightly short with a cute figure'], sexy: ['tall with long legs, a very large bust and a curvy hourglass figure', 'voluptuous with an exaggerated large bust, a tiny waist and full hips', 'athletic with toned curves, a large bust and long legs', 'model-like proportions with a large bust and a slim waist'], cool: ['tall, lean and athletic', 'slim and sharp with model-like proportions'], elegant: ['tall and graceful with a shapely figure and a full bust', 'poised and elegant with long limbs, a full bust and a slim waist'], mixed: ['petite with a surprisingly curvy figure and a large bust', 'soft and curvy with a large bust and a sweet face'] },
  build_m: { cute: ['slim and boyish with a soft look', 'lean, slightly short and youthful'], sexy: ['very tall and big, broad-shouldered with a heavily muscular build', 'lean and muscular with defined arms and a sharp jawline', 'handsome with an average slim-athletic build'], cool: ['tall and lean athletic build', 'big, tall and muscular', 'wiry, sharp and stylish with an average build'], elegant: ['tall and slender with a refined posture', 'well-proportioned and graceful'], mixed: ['slim with hidden toned muscle and a boyish face', 'tall with a gentle face and a muscular build'] },
  hairC: ['jet black', 'silver white', 'ash grey', 'deep navy', 'chestnut brown', 'honey blonde', 'copper orange', 'crimson red', 'soft pink', 'lavender', 'dark teal', 'two-tone black and white', 'platinum blonde with pastel tips', 'milk-tea brown', 'wine red', 'midnight blue with a lighter gradient', 'mint green', 'peach pink gradient'],
  hairS_f: ['very long straight hair', 'long wavy hair', 'shoulder-length bob', 'short pixie cut', 'high ponytail', 'twin low braids', 'side-swept long bangs with a half-up bun', 'messy wolf cut', 'twin tails', 'a side braid over the shoulder', 'a short layered cut with an ahoge', 'long hair with hime-cut bangs', 'curly voluminous hair', 'a high bun with loose strands'],
  hairS_m: ['short messy hair', 'swept-back hair', 'shaggy medium hair', 'undercut', 'neat side part', 'long hair tied in a low ponytail', 'spiky hair', 'curly short hair', 'a two-block cut with curtain bangs', 'a wolf cut', 'slicked-back hair with loose strands', 'a medium wavy cut with an ahoge'],
};

// ---------- ช่วงอายุ 10–60: ต่ำกว่า 18 = แต่งตัวสุภาพตามวัย ไม่เซ็กซี่/วาบหวิวเด็ดขาด · 18+ จึงมีแนวเซ็กซี่เล็กน้อยได้ ----------
const AGEB = [
  { id: 'teen', a: [15, 17], w: 2, minor: true, vibes: ['cute', 'cool'], bf: ['a slim teenage figure', 'a lanky teenage figure'], bm: ['a slim teenage figure', 'a lanky teenage figure'], of: ['a neat school uniform with a ribbon or tie', 'a hoodie with jeans and sneakers', 'a casual sweater with a pleated skirt, fully modest', 'a sporty jacket and track pants', 'a summer yukata at a festival'], om: ['a neat school uniform with a tie', 'a hoodie with jeans and sneakers', 'a casual jacket with a tee and cargo pants', 'a sporty jersey and track pants', 'a summer yukata at a festival'] },
  { id: 'young', a: [18, 29], w: 4, vibes: ['cute', 'sexy', 'sexy', 'cool', 'elegant', 'mixed', 'mixed'] },
  { id: 'adult', a: [30, 50], w: 4, vibes: ['sexy', 'sexy', 'cool', 'elegant', 'mixed'] },
  { id: 'mature', a: [51, 65], w: 2, vibes: ['elegant', 'cool'], bf: ['a mature graceful figure with a full bust and soft lines', 'a mature elegant figure'], bm: ['a mature big and broad-built man', 'a mature lean distinguished build'], of: ['a tailored jacket with a silk blouse and long skirt, mature and refined', 'a traditional kimono with an obi', 'a cardigan, a blouse and wide trousers with a scarf', 'a sleek evening dress with a shawl'], om: ['a tailored suit with a vest', 'a long coat over a sweater and slacks', 'a traditional haori with a kimono', 'a casual shirt with a blazer and glasses'] },
  { id: 'senior', a: [66, 80], w: 1, vibes: ['elegant'], bf: ['an elderly petite graceful figure', 'an elderly sturdy dignified figure'], bm: ['an elderly sturdy build', 'an elderly slender dignified build'], of: ['a soft cardigan with a long skirt and a shawl', 'a traditional kimono in muted colours', 'a neat blouse with wide trousers and a cane'], om: ['a cardigan over a shirt with slacks', 'a traditional jinbei', 'a neat jacket with a flat cap and a cane'] },
];
const pickAge = r => { let t = AGEB.reduce((a, b) => a + b.w, 0) * r(); for (const b of AGEB) { if ((t -= b.w) < 0) return b; } return AGEB[2]; };
const genderWord = (fem, age) => fem ? (age < 18 ? 'teenage girl' : age < 30 ? 'young woman' : age < 51 ? 'woman' : age < 66 ? 'mature woman' : 'elderly woman') : (age < 18 ? 'teenage boy' : age < 30 ? 'young man' : age < 51 ? 'man' : age < 66 ? 'mature man' : 'elderly man');
const AUD_STYLE = 'authentic Japanese anime style, modern 2020s Japanese TV anime screenshot style, soft delicate thin lineart with colored outlines, large detailed eyes with gradient irises, visible pupils and soft highlights, light pink blush on the cheeks, hair drawn in layered strands with glossy light streaks and subtle two-tone or inner-color hair, smooth soft cel shading with gentle gradients, pale clean skin tones, slightly muted warm color palette, simple tidy indoor or street background with soft lighting and mild depth of field, clean modern slice-of-life romance anime look, high quality';
const AUD_STYLES = [
  'high quality modern anime illustration, polished pixiv-style key art, masterpiece, best quality, very aesthetic, crisp thin clean lineart, extremely glossy hair with sharp white specular highlight bands and fine flyaway strands, large luminous detailed eyes with layered iris gradients and star-shaped sparkle highlights, soft blush on the cheeks, smooth cel shading with soft pastel lighting, bright airy softly blurred background with light bokeh', 'high quality modern anime illustration, masterpiece, best quality, very aesthetic, sharp elegant lineart, silky detailed hair with flowing strands and bright highlights, big shiny detailed eyes with intricate irises, delicate blush, clean soft shading, cool bright window light, softly blurred school or city background', 'high quality modern anime illustration, masterpiece, best quality, very aesthetic, clean lineart with soft colored outlines, glossy hair with highlight bands, sparkling violet-toned detailed eyes, gentle blush, bright white or pastel gradient background with sparkles and stars, cute and polished',
  'high quality modern anime illustration, polished pixiv-style key art, masterpiece, best quality, very aesthetic, crisp thin clean lineart, extremely glossy hair with sharp white specular highlight bands and fine flyaway strands, large luminous detailed eyes with layered iris gradients and star-shaped sparkle highlights, soft blush on the cheeks, smooth cel shading with soft pastel lighting, bright airy softly blurred background with light bokeh', 'high quality modern anime illustration, masterpiece, best quality, very aesthetic, sharp elegant lineart, silky detailed hair with flowing strands and bright highlights, big shiny detailed eyes with intricate irises, delicate blush, clean soft shading, cool bright window light, softly blurred school or city background', 'high quality modern anime illustration, masterpiece, best quality, very aesthetic, clean lineart with soft colored outlines, glossy hair with highlight bands, sparkling violet-toned detailed eyes, gentle blush, bright white or pastel gradient background with sparkles and stars, cute and polished',
  'soft pastel slice-of-life TV anime style, thin delicate sketchy lineart, large gradient eyes with soft highlights, light blush lines on the cheeks, flat soft coloring with gentle gradients, bright airy lighting',
  'polished modern TV anime key visual style, glossy hair with bold specular highlight shapes, sparkling detailed eyes with star highlights, crisp clean lineart with colored outlines, vivid cool color palette, soft rim light',
];
const pickU = (r, a, u) => { let v = pk(r, a); for (let t = 0; t < 30 && u.has(v); t++) v = pk(r, a); u.add(v); return v; };
const TR_EN = { 'เงียบ': 'quiet', 'ลึกลับ': 'mysterious', 'เย็นชา': 'aloof', 'ขี้อายลึกๆ': 'secretly shy', 'ดื้อ': 'stubborn', 'มุ่งมั่น': 'determined', 'ขี้เหงา': 'lonely', 'ร่าเริง': 'cheerful', 'เสียงดัง': 'loud', 'ใจดี': 'kind', 'ขี้กลัว': 'timid', 'ซุ่มซ่าม': 'clumsy', 'จริงใจ': 'sincere', 'มีความลับ': 'secretive', 'สุขุม': 'calm', 'ฉลาด': 'clever', 'สุภาพ': 'polite', 'จริงจัง': 'serious', 'ช่างสังเกต': 'observant', 'เก็บความรู้สึก': 'reserved', 'ขี้อาย': 'shy', 'ขี้ตกใจ': 'easily startled', 'อบอุ่น': 'warm', 'พูดตรง': 'blunt', 'ขี้เล่น': 'playful', 'เจ้าเล่ห์': 'sly', 'ใจดีแบบแปลกๆ': 'oddly kind', 'มีอดีต': 'with a hidden past' };
function audIntro(name, tr) {
  const L = { 'เงียบ': 'ฉันพูดไม่เก่ง แต่จะแสดงให้ดูค่ะ', 'ร่าเริง': 'สวัสดีครับ! ผมเล่นได้ทุกฉากเลย จริงๆ นะ!', 'สุขุม': 'ผมอ่านบทครบทุกหน้าแล้วครับ', 'ขี้อาย': 'ข-ขอโทษค่ะ ตื่นเต้นนิดหน่อย…', 'ขี้เล่น': 'บทนี้ตั้งใจเขียนมาให้ผมเลยใช่ไหม?', 'ลึกลับ': 'บทนี้… ฉันรู้จักเขาดีกว่าที่คุณคิด', 'เจ้าเล่ห์': 'ลองให้ผมเล่นสักฉาก แล้วคุณจะไม่ลืม', 'ดื้อ': 'ถ้าไม่ให้บทนี้ ฉันจะมาอีกพรุ่งนี้', 'ใจดี': 'ยินดีที่ได้รู้จักนะคะ ฝากตัวด้วย', 'จริงจัง': 'ผมพร้อมเริ่มเมื่อคุณพร้อมครับ' };
  for (const t of tr) if (L[t]) return L[t];
  return `ฉันชื่อ${name} ขอโอกาสสักครั้งนะ`;
}
// ออดิชันรายวัน: หลัง 07:00 น. เวลาไทย เรียกผู้สมัครใหม่รวม aud_daily คน (ค่าเริ่ม 6, 4–8) เฉพาะบทที่ยังไม่ได้เลือก
async function audDaily(env) {
  const s = await getSettings(env), b = new Date(Date.now() + 7 * 3600000), day = b.toISOString().slice(0, 10);
  if (s.aud_auto === '0' || b.getUTCHours() < 7 || s.aud_day === day) return;
  await setSetting(env, 'aud_day', day);
  const first = await env.DB.prepare('SELECT COUNT(*) n FROM aud_cands').first();
  if (!first || !+first.n) return; // วันแรกเรียกครบทุกบทตอนเปิดห้องออดิชันอยู่แล้ว
  const chosen = new Set((await env.DB.prepare('SELECT cast_role FROM aud_cands WHERE cast_role IS NOT NULL').all()).results.map(x => x.cast_role));
  const open = AUD_ROLES.filter(R => !chosen.has(R.key)); if (!open.length) return;
  const total = Math.min(8, Math.max(4, +s.aud_daily || 6)), per = {};
  for (let k = 0; k < total; k++) { const R = open[k % open.length]; per[R.key] = (per[R.key] || 0) + 1; }
  for (const [role, n] of Object.entries(per)) await audApi(env, { act: 'gen', role, n });
}
// ---------- ตัวละคร LoRA: เลือกผู้สมัคร → สร้างชุดภาพ 12 ภาพ → ⭐ เลือกภาพ → ฝึก LoRA (ตัวละครที่ series_id=0 ใช้ได้ทุกเรื่อง จับคู่ด้วยชื่อ) ----------
async function charList(env) {
  await animeSchema(env);
  const cs = (await env.DB.prepare('SELECT * FROM chars WHERE series_id=0 ORDER BY id DESC').all()).results;
  for (const c of cs) {
    const pj = charProj(c);
    c.images = (await env.DB.prepare('SELECT id,starred FROM images WHERE project=? ORDER BY id').bind(pj).all()).results;
    c.pending = (await env.DB.prepare("SELECT COUNT(*) n FROM jobs WHERE project=? AND status IN ('queued','running','kaggle')").bind(pj).first()).n;
    const l = await env.DB.prepare("SELECT l.id,l.status,l.error,l.size,l.use,v.status vs, v.opt FROM loras l LEFT JOIN vjobs v ON v.id=l.vjob WHERE l.char_id=? AND l.status<>'old' ORDER BY l.id DESC LIMIT 1").bind(c.id).first();
    if (l) { if (l.status === 'queued' && l.vs === 'running') l.status = 'training'; try { l.n = (JSON.parse(l.opt || '{}').images || []).length; } catch { l.n = 0; } delete l.opt; delete l.vs; c.lora = l; }
    c.trigger = 'chr' + c.id + 'x';
  }
  return { chars: cs };
}
async function charBusy(env, id) { return (await env.DB.prepare("SELECT COUNT(*) n FROM loras WHERE char_id=? AND status='queued'").bind(id).first()).n > 0; }
async function charMake(env, b) {
  await animeSchema(env);
  const c = await env.DB.prepare('SELECT * FROM aud_cands WHERE id=?').bind(+b.id).first(); if (!c) return { error: 'ไม่พบผู้สมัคร' };
  if (+c.char_id) return { error: 'สร้างตัวละครนี้ไปแล้ว' };
  const R = AUD_ROLES.find(x => x.key === c.role) || { outfit: '' };
  let name = String(c.name || 'ตัวละคร').replace(/·/g, '-').slice(0, 40);
  if (await env.DB.prepare('SELECT id FROM chars WHERE series_id=0 AND name=?').bind(name).first()) name = `${name} ${c.id}`;
  const desc = `${c.look || ''}${R.outfit ? ', wearing ' + R.outfit : ''}`.slice(0, 600);
  const r = await env.DB.prepare('INSERT INTO chars (series_id,name,desc,created) VALUES (0,?,?,?)').bind(name, desc, Date.now()).run();
  const id = r.meta.last_row_id;
  await env.DB.prepare('UPDATE aud_cands SET char_id=? WHERE id=?').bind(id, c.id).run();
  await charRefs(env, id, 12);
  return { ok: true, char_id: id };
}
async function loraPri(env, charId) { // 0 = ตัวหลัก (เทรนก่อน) · 1 = ตัวอื่น
  try {
    const c = await env.DB.prepare('SELECT cast_role,cast_story FROM aud_cands WHERE char_id=?').bind(+charId).first(); if (!c || !c.cast_role) return 1;
    const pl = await readPlan(env, c.cast_story), r = pl && pl.roles.find(x => x.key === c.cast_role); return r && r.tier === 'main' ? 0 : 1;
  } catch (e) { return 1; }
}
async function charTrain(env, b) {
  await animeSchema(env);
  const ch = await env.DB.prepare('SELECT * FROM chars WHERE id=? AND series_id=0').bind(+b.char_id).first(); if (!ch) return { error: 'ไม่พบตัวละคร' };
  if (await charBusy(env, ch.id)) return { error: 'กำลังรอ/เทรนอยู่ รอให้เสร็จก่อน' };
  const pj = charProj(ch);
  const all = (await env.DB.prepare('SELECT id,scene,starred FROM images WHERE project=? ORDER BY id').bind(pj).all()).results;
  const st = all.filter(x => x.starred), use = (st.length ? st : all).slice(0, 24);
  if (use.length < 8) return { error: st.length ? `ติด ⭐ แค่ ${st.length} ภาพ ต้องอย่างน้อย 8 (หรือไม่ติดเลย = ใช้ทุกภาพ)` : `มีภาพแค่ ${all.length} ภาพ ต้องอย่างน้อย 8 ภาพ` };
  const trig = 'chr' + ch.id + 'x', imgs = use.map(x => ({ id: x.id, cap: `${xlKind(ch) === 'char' ? loraTag({ cid: ch.id, desc: ch.desc }) : trig}, ${xlVar(ch, (+x.scene || 1) - 1)}` }));
  await env.DB.batch([env.DB.prepare("UPDATE loras SET status='old' WHERE char_id=?").bind(ch.id), env.DB.prepare("DELETE FROM vjobs WHERE kind='lora' AND status IN ('queued','failed') AND project=?").bind(pj)]);
  const r = await env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,kind,opt) VALUES (?,'','lora','','','',0,'queued',0,?,'lora',?)").bind(pj, Date.now(), JSON.stringify({ char_id: ch.id, trigger: trig, images: imgs, pri: await loraPri(env, ch.id), dim: xlKind(ch) === 'char' ? 8 : 4 })).run();
  await env.DB.prepare("INSERT INTO loras (char_id,vjob,status,created) VALUES (?,?,'queued',?)").bind(ch.id, r.meta.last_row_id, Date.now()).run();
  return { ok: true, images: imgs.length };
}
// เปลี่ยนสไตล์ทั้งเรื่อง: วาดภาพชุดฝึกของตัวละครที่ LoRA ยังไม่เสร็จใหม่ด้วยสไตล์ปัจจุบัน แล้วส่งเทรนเองเมื่อภาพครบ (สั่งด้วย settings restyle=start)
// สั่งชุดฝึกจากฐานข้อมูล: settings lset_req = {ชื่อ: {cid, ref, mix:{ชุด:จำนวน}}} → สร้างงานวาด 16 ภาพ/ตัว (โชว์ในคลังภาพอ้างอิง) + lset ให้ส่งเทรนเอง
function lsetJobs(n, cid, ref, mix, noset, gags) {
  const C = HY_CHAR[n]; if (!C) return null;
  const ST = 'anime screencap, flat color, clean thin lineart, soft colors, beautiful detailed eyes, perfect anatomy, good proportions, full color';
  const V = ['full body, standing, front view, gentle smile, simple white background', 'full body, standing, three-quarter view, hand on hip, simple white background', 'full body, walking, from side, simple background', 'upper body, front view, looking at viewer, smile, simple background', 'portrait, close-up, face focus, looking at viewer, simple background', 'upper body, three-quarter view, surprised, simple background', 'cowboy shot, sitting on chair, relaxed, indoors', 'upper body, blush, looking away, simple background'];
  const PM = ['sitting, front view', 'loaf pose, lying, from side', 'walking, from side', 'curled up sleeping', 'jumping, playful', 'sitting, back view, looking back', 'close-up, face focus', 'eating from a bowl', 'stretching', 'lying on back, playful', 'sitting on a bench, night', 'close-up of tail tip with glowing paper lantern', 'sitting, three-quarter view', 'standing on all fours, alert', 'yawning', 'pouncing'];
  const jobs = [], caps = [], pfx = 'อ้างอิง·' + n + '·ปกติ·' + (noset ? 'ใหม่' : 'ฝึก'); let i = 0;
  const qn = C.o ? ['two cats', 'a cat without a lantern on its tail', 'monochrome drawing'] : ['two people', 'the same person drawn twice', 'monochrome black and white drawing', 'deformed body, extra limbs'];
  const neg = (C.neg ? C.neg + ', ' : '') + 'nsfw, nude, nipples, panties, monochrome, greyscale, multiple views' + (C.o ? ', lantern on head, multiple cats' : ', 2girls, 2boys');
  for (const [k, c] of Object.entries(mix || { [C.def]: 16 })) { const o = C.of[k]; if (!o) continue;
    for (let t = 0; t < c; t++, i++) {
      const v = C.o ? 'the glowing paper lantern hangs from the end of its tail, full body, ' + PM[i % PM.length] + ', simple white background' : V[i % V.length];
      const up = C.o || /portrait|upper body|cowboy/.test(v);
      jobs.push([pfx + '·' + o[0] + '·' + String(i).padStart(2, '0'), [C.id, o[1], v, ST].filter(Boolean).join(', '), { engine: 'sdxl', w: up ? 1024 : 832, h: up ? 1024 : 1216, steps: 30, seed: 0, loras: [], neg, ...(ref ? { refimg: ref, rw: 0.45, ipa_end: 0.7 } : {}), takes: 2, np: C.o ? 0 : 1, qneg: qn }]);
      caps.push(C.o ? 'no humans, white kitten, glowing lantern on tail tip, ' + PM[i % PM.length] : (/^1boy/.test(C.id) ? '1boy, ' : '1girl, ') + o[1] + ', ' + v);
    } }
  for (const [gi, g] of (gags ? (C.gx || []).slice(0, gags) : []).entries()) { const o = C.of[C.def];
    jobs.push(['อ้างอิง·' + n + '·ตลก·' + o[0] + '·' + String(gi).padStart(2, '0'), [C.id, o[1], 'upper body, ' + g + ', colorful speed lines background, anime screencap, flat color, clean thin lineart, full color'].join(', '), { engine: 'sdxl', w: 1024, h: 1024, steps: 30, seed: 0, loras: [], neg, ...(ref ? { refimg: ref, rw: 0.35, ipa_end: 0.6 } : {}), takes: 2, np: C.o ? 0 : 1, qneg: qn }]); }
  return { jobs, set: { cid, caps, pfx } };
}
async function lsetReqTick(env, s) {
  if (!s.lset_req) return; let R; try { R = JSON.parse(s.lset_req); } catch { R = {}; }
  await env.DB.prepare("DELETE FROM settings WHERE key='lset_req'").run();
  let L = {}; try { L = JSON.parse(s.lset || '{}'); } catch { }
  let t = Date.now();
  for (const [n, r] of Object.entries(R)) { const P = lsetJobs(n, +r.cid, +r.ref || 0, r.mix, r.noset, +r.gags || 0); if (!P) continue; // noset = วาดภาพอ้างอิงให้เลือกก่อน ยังไม่ส่งเทรน
    for (const [pj, pr, op] of P.jobs) await env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,kind,opt) VALUES (?,'','0',?,'','',0,'queued',0,?,'img',?)").bind(pj, pr, t++, JSON.stringify(op)).run();
    if (!r.noset) L[n] = P.set; }
  await setSetting(env, 'lset', JSON.stringify(L));
}
// ชุดฝึก LoRA จากภาพที่ผู้ใช้เลือก: settings lset = {ชื่อ: {cid, caps:[...]}} · ภาพ 'ชุดฝึก·ชื่อ·NN' วาดครบ → ส่งเทรนเอง (คำบรรยายภาพตามลำดับ NN)
async function lsetTick(env, s) {
  if (!s.lset) return; let L; try { L = JSON.parse(s.lset); } catch { return; }
  let ch = false;
  for (const [nm, o] of Object.entries(L)) {
    const pf = o.pfx || ('ชุดฝึก·' + nm + '·'); // ชุดฝึกที่โชว์ในคลังภาพอ้างอิงด้วย: pfx = 'อ้างอิง·ชื่อ·ปกติ·ฝึก'
    const pend = (await env.DB.prepare("SELECT COUNT(*) n FROM vjobs WHERE kind='img' AND status IN ('queued','running') AND project LIKE ?").bind(pf + '%').first()).n;
    if (pend) continue;
    const im = (await env.DB.prepare("SELECT id,project FROM images WHERE project LIKE ? ORDER BY id").bind(pf + '%').all()).results;
    if (im.length < 10) { if (!pend) { delete L[nm]; ch = true; } continue; }
    const trig = 'chr' + o.cid + 'x', imgs = im.map(x => { const k = +((String(x.project).match(/(\d+)$/) || [])[1] || 0); return { id: x.id, cap: trig + ', ' + ((o.caps || [])[k] || '1girl') }; });
    const pj = 'ซีรีส์0·' + nm;
    await env.DB.batch([env.DB.prepare("UPDATE loras SET status='old' WHERE char_id=?").bind(o.cid), env.DB.prepare("DELETE FROM vjobs WHERE kind='lora' AND status IN ('queued','failed') AND project=?").bind(pj)]);
    const r = await env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,kind,opt) VALUES (?,'','lora','','','',0,'queued',0,?,'lora',?)").bind(pj, Date.now(), JSON.stringify({ char_id: o.cid, trigger: trig, images: imgs, pri: 0, dim: 16 })).run();
    await env.DB.prepare("INSERT INTO loras (char_id,vjob,status,created) VALUES (?,?,'queued',?)").bind(o.cid, r.meta.last_row_id, Date.now()).run();
    await env.DB.prepare('INSERT INTO vlog (msg,created) VALUES (?,?)').bind('ชุดฝึก ' + nm + ' ครบ ' + imgs.length + ' ภาพ → ส่งเทรน LoRA ' + trig, Date.now()).run().catch(() => { });
    delete L[nm]; ch = true;
  }
  if (ch) { if (Object.keys(L).length) await setSetting(env, 'lset', JSON.stringify(L)); else await env.DB.prepare("DELETE FROM settings WHERE key='lset'").run(); }
}
async function restyleTick(env, s) {
  if (!s.restyle) return;
  await animeSchema(env);
  if (String(s.restyle).startsWith('start')) { // 'start' = ทุกตัวที่ LoRA ยังไม่เสร็จ · 'start:3,7' = เฉพาะตัวละคร id ที่ระบุ (เช่น ตัวที่ต้องใช้ในตอนที่จะทำก่อน)
    const only = String(s.restyle).includes(':') ? new Set(String(s.restyle).split(':')[1].split(',').map(Number).filter(Boolean)) : null;
    const cs = (await env.DB.prepare("SELECT c.* FROM chars c WHERE c.series_id=0 AND EXISTS (SELECT 1 FROM loras l WHERE l.char_id=c.id AND l.status IN ('queued','failed')) AND NOT EXISTS (SELECT 1 FROM loras l WHERE l.char_id=c.id AND l.status='ready') AND NOT EXISTS (SELECT 1 FROM vjobs v WHERE v.kind='lora' AND v.status='running' AND v.project='ซีรีส์0·'||c.name)").all()).results.filter(c => !only || only.has(c.id));
    if (only) for (const id of only) if (!cs.some(c => c.id === id)) { const c = await env.DB.prepare("SELECT * FROM chars WHERE id=? AND series_id=0 AND NOT EXISTS (SELECT 1 FROM loras l WHERE l.char_id=chars.id AND l.status='ready')").bind(id).first(); if (c) cs.push(c); } // ตัวที่ระบุมาแต่ยังไม่เคยเข้าคิวเทรนก็รวมด้วย
    for (const c of cs) {
      const pj = charProj(c);
      await env.DB.batch([env.DB.prepare("DELETE FROM vjobs WHERE kind='lora' AND status IN ('queued','failed','hold') AND project=?").bind(pj), env.DB.prepare("DELETE FROM loras WHERE char_id=? AND status IN ('queued','failed')").bind(c.id), env.DB.prepare("DELETE FROM jobs WHERE project=?").bind(pj), env.DB.prepare("DELETE FROM vjobs WHERE kind='img' AND status='queued' AND project=?").bind(pj), env.DB.prepare('DELETE FROM images WHERE project=?').bind(pj)]);
      await charRefs(env, c.id, 16);
      await env.DB.prepare("UPDATE jobs SET steps=8 WHERE project=? AND status='queued'").bind(pj).run(); // ชุดฝึกวาดคุณภาพสูง
    }
    await setSetting(env, 'restyle', JSON.stringify({ ids: cs.map(c => c.id), done: [] }));
    await setSetting(env, 'lora_go', '1');
    return;
  }
  let o; try { o = JSON.parse(s.restyle); } catch (e) { o = null; }
  if (!o || !Array.isArray(o.ids)) { await env.DB.prepare("DELETE FROM settings WHERE key='restyle'").run(); return; }
  let ch = false;
  for (const id of o.ids) {
    if (o.done.includes(id)) continue;
    const c = await env.DB.prepare('SELECT * FROM chars WHERE id=?').bind(id).first(); if (!c) { o.done.push(id); ch = true; continue; }
    const pj = charProj(c);
    const pend = (await env.DB.prepare("SELECT COUNT(*) n FROM jobs WHERE project=? AND status IN ('queued','running','kaggle')").bind(pj).first()).n;
    const have = (await env.DB.prepare('SELECT COUNT(*) n FROM images WHERE project=?').bind(pj).first()).n;
    if (pend || have < 12) continue;
    const r = await charTrain(env, { char_id: id }); if (r && r.ok) { o.done.push(id); ch = true; }
  }
  if (o.done.length >= o.ids.length) await env.DB.prepare("DELETE FROM settings WHERE key='restyle'").run();
  else if (ch) await setSetting(env, 'restyle', JSON.stringify(o));
}
// LoRA ประเภทอื่น: ภาพชุดฝึกครบเมื่อไหร่ ส่งเทรนเอง
async function xlTick(env) {
  await animeSchema(env);
  const cs = (await env.DB.prepare("SELECT c.* FROM chars c WHERE c.series_id=0 AND (c.kind IN ('enemy','place','style') OR (c.kind='char' AND c.story IS NOT NULL)) AND NOT EXISTS (SELECT 1 FROM loras l WHERE l.char_id=c.id AND l.status IN ('queued','ready','failed'))").all()).results;
  for (const c of cs) {
    const pj = charProj(c);
    if ((await env.DB.prepare("SELECT COUNT(*) n FROM jobs WHERE project=? AND status IN ('queued','running','kaggle')").bind(pj).first()).n) continue;
    if ((await env.DB.prepare('SELECT COUNT(*) n FROM images WHERE project=?').bind(pj).first()).n < 12) continue;
    await charTrain(env, { char_id: c.id });
  }
}
async function xlNew(env, story, kind, name, desc) {
  await animeSchema(env);
  name = String(name || '').replace(/[·\n]/g, ' ').trim().slice(0, 40); if (!name || !XL_VARS[kind]) return { error: 'ข้อมูลไม่ครบ' };
  if (await env.DB.prepare('SELECT id FROM chars WHERE series_id=0 AND name=?').bind(name).first()) return { error: `มีชื่อ "${name}" อยู่แล้ว`, dup: true };
  const r = await env.DB.prepare('INSERT INTO chars (series_id,name,desc,created,kind,story) VALUES (0,?,?,?,?,?)').bind(name, String(desc || '').slice(0, 500), Date.now(), kind, story).run(), id = r.meta.last_row_id;
  await charRefs(env, id, 16);
  await env.DB.prepare("UPDATE jobs SET steps=8 WHERE project=? AND status='queued'").bind('ซีรีส์0·' + name).run();
  return { ok: true, id };
}
// วาดช่องที่มีตัวละครของตอนนั้นใหม่ทั้งหมด (settings sb_redraw = "เรื่อง|ตอน") — ใช้หลังแก้ตัวสั่งวาดหรือ LoRA เพิ่งเสร็จ · ช่องฉากหลังล้วนไม่แตะ
async function sbRedrawTick(env, s) {
  if (!s.sb_redraw) return;
  const [story, epS, mode, scOnly] = String(s.sb_redraw).split('|'); // ตัวที่สาม 'all' = วาดใหม่ทุกช่องรวมฉากหลัง · ตัวที่สี่ = เฉพาะซีนนั้น
  const cl = await env.DB.prepare("DELETE FROM settings WHERE key='sb_redraw' AND value=?").bind(String(s.sb_redraw)).run(); if (!cl.meta || !cl.meta.changes) return; // จองงานแบบอะตอม: กันรอบที่ทำงานซ้อนกันทำซ้ำ
  const sr = await env.DB.prepare('SELECT id FROM series WHERE title=?').bind(story).first(); if (!sr) return;
  const scs = (await env.DB.prepare('SELECT script_id,sc FROM scenes WHERE series_id=? AND ep=? ORDER BY sc').bind(sr.id, +epS).all()).results;
  for (const sc of scs) { if (!sc.script_id || (scOnly && +sc.sc !== +scOnly)) continue;
    const l = (await env.DB.prepare("SELECT id,kproj FROM shots WHERE script_id=? AND (?='all' OR (chars IS NOT NULL AND chars<>'[]' AND chars<>''))").bind(sc.script_id, mode || '').all()).results; if (!l.length) continue;
    await env.DB.prepare('DELETE FROM settings WHERE key=?').bind('sbdone:' + sc.script_id).run();
    for (let i = 0; i < l.length; i += 20) await env.DB.batch(l.slice(i, i + 20).flatMap(sh => [env.DB.prepare("DELETE FROM jobs WHERE project=? AND status='queued'").bind(sh.kproj), env.DB.prepare('DELETE FROM images WHERE project=?').bind(sh.kproj)]));
    await animeApi(env, { act: 'kf', script_id: +sc.script_id, ids: l.map(x => x.id) });
  }
}
// นำเข้าสตอรีบอร์ดที่เขียนมือจาก sbx.json แทนที่ช็อตเดิมของตอนนั้น (settings sb_import = "เรื่อง|ตอน") แล้วให้ระบบวาดภาพตามปกติ · ไม่ให้ AI ตัดช็อต/เขียนบทพูดทับ
async function sbImportTick(env, s) {
  if (!s.sb_import) return;
  await animeSchema(env);
  const [story, epS] = String(s.sb_import).split('|'), ep = +epS, D = (SBX[story] || {})[String(ep)];
  const cl = await env.DB.prepare("DELETE FROM settings WHERE key='sb_import' AND value=?").bind(String(s.sb_import)).run(); if (!cl.meta || !cl.meta.changes) return; // จองงานแบบอะตอม: เคยนำเข้าซ้อน 2 รอบจนช่องซ้ำ
  const sr = await env.DB.prepare('SELECT id FROM series WHERE title=?').bind(story).first(); if (!D || !sr) return;
  for (const [sc, list] of Object.entries(D)) {
    const e = await env.DB.prepare('SELECT id,script_id FROM scenes WHERE series_id=? AND ep=? AND sc=?').bind(sr.id, ep, +sc).first(); if (!e || !e.script_id) continue;
    const sid = e.script_id, old = (await env.DB.prepare('SELECT kproj FROM shots WHERE script_id=?').bind(sid).all()).results, st = [];
    for (const o of old) st.push(env.DB.prepare('DELETE FROM images WHERE project=?').bind(o.kproj), env.DB.prepare("DELETE FROM jobs WHERE project=?").bind(o.kproj), env.DB.prepare("DELETE FROM vjobs WHERE project=? AND kind='img' AND status='queued'").bind(o.kproj));
    st.push(env.DB.prepare('DELETE FROM shots WHERE script_id=?').bind(sid));
    list.forEach((x, i) => { const ls = (x.lines || []).map(l => ({ who: String(l.who || ''), say: String(l.say || ''), ...(l.ja ? { ja: String(l.ja) } : {}), ...(l.emo ? { emo: String(l.emo) } : {}), ...(l.nv ? { nv: String(l.nv) } : {}), ...(+l.spd ? { spd: +l.spd } : {}), ...(+l.pause ? { pause: +l.pause } : {}), ...(l.pron ? { pron: String(l.pron) } : {}), ...(l.dir ? { dir: String(l.dir).slice(0, 120) } : {}) })); // ja/emo = บทพากย์ญี่ปุ่น + อารมณ์
      st.push(env.DB.prepare('INSERT INTO shots (script_id,idx,beat,th,en,chars,kproj,created,say,chain,loc) VALUES (?,?,0,?,?,?,?,?,?,?,?)').bind(sid, i + 1, String(x.th || ''), String(x.en || '').slice(0, 1800), JSON.stringify(x.chars || []), `ฉาก${sid}·${i + 1}`, Date.now(), JSON.stringify({ who: ls[0] ? ls[0].who : '', say: ls[0] ? ls[0].say : '', lines: ls, ...(x.think ? { think: x.think } : {}), ...(x.ono ? { ono: x.ono } : {}), ...(x.thinkTh ? { thinkTh: x.thinkTh } : {}), ...(x.onoTh ? { onoTh: x.onoTh } : {}), ...(x.dir ? { dir: x.dir } : {}), ...(x.s3 ? { s3: x.s3 } : {}) }), x.chain ? 1 : 0, x.loc || null)); }); // dir = ใบสั่งงานผู้กำกับ (ช็อต มุม การเคลื่อนกล้อง แสง อารมณ์ เวลา เสียง ดนตรี พรอมต์วิดีโอ)
    for (let i = 0; i < st.length; i += 20) await env.DB.batch(st.slice(i, i + 20));
    await env.DB.prepare('UPDATE scenes SET sb=-1, fin=0, auto=1 WHERE id=?').bind(e.id).run();
    await setSetting(env, 'sbfix:' + sid, '0,0'); await setSetting(env, 'sbsay:' + sid, 'hand');
    await env.DB.prepare('DELETE FROM settings WHERE key=?').bind('sbdone:' + sid).run();
  }
}
async function charRename(env, b) {
  await animeSchema(env);
  const ch = await env.DB.prepare('SELECT * FROM chars WHERE id=? AND series_id=0').bind(+b.char_id).first(); if (!ch) return { error: 'ไม่พบตัวละคร' };
  const name = String(b.name || '').trim().replace(/·/g, '-').slice(0, 40); if (!name) return { error: 'ใส่ชื่อก่อน' };
  if (await env.DB.prepare('SELECT id FROM chars WHERE series_id=0 AND name=? AND id<>?').bind(name, ch.id).first()) return { error: 'มีตัวละครชื่อนี้แล้ว' };
  const o = charProj(ch), n = charProj({ series_id: 0, name });
  await env.DB.batch([env.DB.prepare('UPDATE chars SET name=? WHERE id=?').bind(name, ch.id), env.DB.prepare('UPDATE images SET project=? WHERE project=?').bind(n, o), env.DB.prepare('UPDATE jobs SET project=? WHERE project=?').bind(n, o), env.DB.prepare("UPDATE vjobs SET project=? WHERE project=? AND kind='lora'").bind(n, o)]);
  return { ok: true };
}
async function audApi(env, b) {
  const act = b.act || 'list';
  if (act === 'gen') {
    const R = AUD_ROLES.find(x => x.key === b.role); if (!R) return { error: 'ไม่รู้จักบท' };
    const n = Math.min(6, Math.max(1, +b.n || 4)), r = rng((Date.now() ^ 0x2f6a1c3d) + Math.floor(Math.random() * 1e9)), fem = /woman/.test(R.g);
    const used = new Set((await env.DB.prepare('SELECT name FROM aud_cands WHERE role=?').bind(R.key).all()).results.map(x => x.name));
    const mn = (await env.DB.prepare('SELECT MIN(id) m FROM jobs').first()) || {}; let jid = Math.min(+mn.m || 1000000, 1000000) - 1;
    const st = [], U = { sty: new Set(), bg: new Set(), out: new Set(), pose: new Set(), hc: new Set(), hs: new Set(), build: new Set() };
    const vibeKeys = Object.keys(LOOK.vibes); let vq = [...vibeKeys].sort(() => r() - 0.5); // วนลุคให้ครบ ไม่ซ้ำกันในชุดเดียวกัน
    for (let k = 0; k < n; k++) {
      let name = pk(r, fem ? AUD.names_f : AUD.names_m); for (let t = 0; t < 20 && used.has(name); t++) name = pk(r, fem ? AUD.names_f : AUD.names_m); used.add(name);
      const AB = pickAge(r), age = AB.a[0] + Math.floor(r() * (AB.a[1] - AB.a[0] + 1)), gw = genderWord(fem, age);
      const tr = [...R.traits].sort(() => r() - 0.5).slice(0, 3);
      const vibe = pk(r, AB.vibes), og = fem ? LOOK.outfit_f : LOOK.outfit_m, bd = fem ? LOOK.build_f : LOOK.build_m;
      const outfit = pickU(r, AB.of ? (fem ? AB.of : AB.om) : (og[vibe] || og[pk(r, ['cute', 'sexy', 'cool', 'elegant'])]), U.out);
      const bg = pickU(r, LOOK.bg, U.bg), pose = pickU(r, LOOK.pose, U.pose), build = pickU(r, AB.bf ? (fem ? AB.bf : AB.bm) : bd[vibe], U.build);
      const ex = pk(r, AUD.extra), hc = pickU(r, LOOK.hairC, U.hc), hs = pickU(r, fem ? LOOK.hairS_f : LOOK.hairS_m, U.hs);
      const look = `${build} ${gw} aged ${age}, ${hc} ${hs}, ${pk(r, AUD.eye)} eyes, ${pk(r, AUD.face)}${ex === 'none' ? '' : ', ' + ex}`;
      const ins = await env.DB.prepare('INSERT INTO aud_cands (role,name,age,traits,intro,look,created) VALUES (?,?,?,?,?,?,?)').bind(R.key, name, age, tr.join(','), audIntro(name, tr), look, Date.now()).run();
      const cid = ins.meta.last_row_id, proj = `ออดิชัน·${R.key}·${cid}·${name}`;
      const sty = pickU(r, AUD_STYLES, U.sty), comp = pk(r, ['close-up portrait with the face large in the frame', 'bust-up portrait looking at the viewer', 'upper-body shot with the face and figure clearly visible', 'cowboy shot with the face, outfit and figure clearly visible']);
      const tail = 'original character, modern Japanese or Korean everyday fashion, clothed' + (AB.minor ? ', wholesome and age-appropriate with modest clothing' : '');
      const face = AB.minor ? (fem ? 'a cute teenage girl with a sweet face' : 'a cute teenage boy with a bright face') : fem ? 'an extremely beautiful ' + gw + ' with a gorgeous refined face' : 'a very handsome ' + gw + ' with sharp refined features and a stylish Japanese or Korean hairstyle';
      st.push(env.DB.prepare("INSERT INTO jobs (id,project,scene,prompt,status,created,steps) VALUES (?,?,1,?,'queued',?,4)").bind(jid--, proj, `${sty}, ${comp}, ${face}, ${LOOK.vibes[vibe]}, ${look}, wearing ${outfit}, ${pose}, background: ${bg}, personality: ${tr.map(t => TR_EN[t] || '').filter(Boolean).join(', ')}, ${tail}`.slice(0, 2000), Date.now()));
    }
    await env.DB.batch(st);
    return { ok: true, added: n };
  }
  if (act === 'char_list') return await charList(env);
  if (act === 'char_make') return await charMake(env, b);
  if (act === 'char_train') return await charTrain(env, b);
  if (act === 'char_rename') return await charRename(env, b);
  if (act === 'char_more') { const ch = await env.DB.prepare('SELECT id FROM chars WHERE id=? AND series_id=0').bind(+b.char_id).first(); if (!ch) return { error: 'ไม่พบตัวละคร' }; return await charRefs(env, ch.id, Math.min(8, Math.max(1, +b.n || 8))); }
  if (act === 'lora_use') { await env.DB.prepare('UPDATE loras SET use=? WHERE id=?').bind(b.on ? 1 : 0, +b.id).run(); return { ok: true }; }
  if (act === 'wipe_all') { // ล้างคลังนักแสดงเก่าทั้งหมด: ผู้สมัคร + ตัวละคร + LoRA + ภาพออดิชัน/ภาพชุดฝึก + งานเทรนที่ค้าง (ต้องส่ง confirm='ลบทั้งหมด')
    if (b.confirm !== 'ลบทั้งหมด') return { error: 'ต้องยืนยันก่อนลบ' };
    await animeSchema(env);
    const cs = (await env.DB.prepare('SELECT id,role,char_id FROM aud_cands').all()).results, st = [];
    for (const c of cs) {
      if (+c.char_id) {
        const ch = await env.DB.prepare('SELECT * FROM chars WHERE id=? AND series_id=0').bind(+c.char_id).first();
        if (ch) {
          const ls = (await env.DB.prepare('SELECT id FROM loras WHERE char_id=?').bind(ch.id).all()).results, pj = charProj(ch);
          for (const l of ls) { st.push(env.DB.prepare('DELETE FROM lchunks WHERE lid=?').bind(l.id)); await supaDelLora(env, l.id); }
          st.push(env.DB.prepare('DELETE FROM loras WHERE char_id=?').bind(ch.id), env.DB.prepare("DELETE FROM vjobs WHERE kind='lora' AND project=?").bind(pj), env.DB.prepare("DELETE FROM jobs WHERE project=? AND status<>'running'").bind(pj), env.DB.prepare('DELETE FROM images WHERE project=?').bind(pj), env.DB.prepare('DELETE FROM chars WHERE id=?').bind(ch.id));
        }
      }
      st.push(env.DB.prepare('DELETE FROM images WHERE project LIKE ?').bind(`ออดิชัน·${c.role}·${c.id}·%`));
    }
    st.push(env.DB.prepare("DELETE FROM jobs WHERE project LIKE 'ออดิชัน·%' AND status<>'running'"), env.DB.prepare('DELETE FROM aud_cands'));
    for (let i = 0; i < st.length; i += 50) await env.DB.batch(st.slice(i, i + 50));
    return { ok: true, removed: cs.length };
  }
  if (act === 'char_del') {
    await animeSchema(env);
    const c = await env.DB.prepare('SELECT * FROM chars WHERE id=? AND series_id=0').bind(+b.char_id).first(); if (!c) return { error: 'ไม่พบตัวละคร' };
    if (await charBusy(env, c.id)) return { error: 'กำลังรอ/เทรนอยู่ รอให้เสร็จก่อนค่อยลบ' };
    const ls = (await env.DB.prepare('SELECT id FROM loras WHERE char_id=?').bind(c.id).all()).results, pj = charProj(c);
    for (const l of ls) await supaDelLora(env, l.id);
    await env.DB.batch([...ls.map(l => env.DB.prepare('DELETE FROM lchunks WHERE lid=?').bind(l.id)), env.DB.prepare('DELETE FROM loras WHERE char_id=?').bind(c.id), env.DB.prepare("DELETE FROM vjobs WHERE kind='lora' AND project=?").bind(pj), env.DB.prepare("DELETE FROM jobs WHERE project=? AND status='queued'").bind(pj), env.DB.prepare('DELETE FROM images WHERE project=?').bind(pj), env.DB.prepare('UPDATE aud_cands SET char_id=0 WHERE char_id=?').bind(c.id), env.DB.prepare('DELETE FROM chars WHERE id=?').bind(c.id)]);
    return { ok: true };
  }
  if (act === 'daily') { await setSetting(env, 'aud_daily', String(Math.min(8, Math.max(4, +b.n || 6)))); return { ok: true }; }
  if (act === 'keep') { await env.DB.prepare('UPDATE aud_cands SET kept=CASE WHEN COALESCE(kept,0)=1 THEN 0 ELSE 1 END WHERE id=?').bind(+b.id).run(); return { ok: true }; }
  if (act === 'unassign') { await env.DB.prepare('UPDATE aud_cands SET cast_role=NULL, cast_story=NULL, chosen=0 WHERE id=?').bind(+b.id).run(); return { ok: true }; }
  if (act === 'pick') { // ใส่นักแสดงจากคลังลงบทในเรื่อง (บทอะไรก็ได้ ไม่จำเป็นต้องตรงกับบทที่มาออดิชัน)
    const c = await env.DB.prepare('SELECT * FROM aud_cands WHERE id=?').bind(+b.id).first(); if (!c) return { error: 'ไม่พบผู้สมัคร' };
    const roleKey = String(b.role || c.role), story = String(b.story || 'สาเหตุที่ฉันรัก').slice(0, 60);
    const R = AUD_ROLES.find(x => x.key === roleKey) || { outfit: '', shot: '' };
    await env.DB.prepare('UPDATE aud_cands SET cast_role=NULL, cast_story=NULL, chosen=0 WHERE cast_role=? AND cast_story=?').bind(roleKey, story).run();
    await env.DB.prepare('UPDATE aud_cands SET cast_role=?, cast_story=?, chosen=1, kept=1 WHERE id=?').bind(roleKey, story, c.id).run();
    c.role = roleKey;
    const prompt = `Create ONE character model sheet for an original anime series, art style: [[STYLE]]. Plain light background. Layout: full-body front view, side view and back view in a row; below them six face close-ups (neutral, smiling, angry, surprised, sad, determined); plus one full-body dynamic action pose. Use the ATTACHED casting image as the exact reference for this character: keep the same face, hairstyle, hair colour, eye colour and accessories. Original adult character, not based on any existing anime. No text, no labels, no watermark.\n\nCharacter: ${c.role}, ${c.look}. Personality: ${c.traits}. Outfit: ${R.outfit || ''}. Action pose: ${R.shot || ''}.`;
    const title = 'ชีตใหม่ · ' + c.role, ex = await env.DB.prepare('SELECT id FROM manual_tasks WHERE title=?').bind(title).first();
    if (ex) await env.DB.prepare("UPDATE manual_tasks SET prompt=?, descr=? WHERE id=? AND status!='done'").bind(prompt, `แนบภาพออดิชันของ ${c.name}`, ex.id).run();
    else await env.DB.prepare("INSERT INTO manual_tasks (kind,title,descr,prompt,pri,status,created) VALUES ('char',?,?,?,1,'todo',?)").bind(title, `แนบภาพออดิชันของ ${c.name}`, prompt, Date.now()).run();
    return { ok: true };
  }
  if (act === 'del') { await env.DB.prepare('DELETE FROM aud_cands WHERE id=?').bind(+b.id).run(); await env.DB.prepare("DELETE FROM jobs WHERE instr(project,'ออดิชัน·')=1 AND instr(project,?)>0 AND status='queued'").bind(`·${+b.id}·`).run(); return { ok: true }; }
  { // บทที่ยังไม่มีผู้สมัครเลย เรียกให้ 4 คนอัตโนมัติ (ครั้งแรกที่เปิดห้องออดิชัน)
    const have = new Set((await env.DB.prepare('SELECT DISTINCT role FROM aud_cands').all()).results.map(x => x.role));
    for (const R of AUD_ROLES) if (!have.has(R.key)) await audApi(env, { act: 'gen', role: R.key, n: 4 });
  }
  const cs = (await env.DB.prepare('SELECT * FROM aud_cands ORDER BY id').all()).results;
  const ims = (await env.DB.prepare("SELECT id,project,scene FROM images WHERE instr(project,'ออดิชัน·')=1 ORDER BY id").all()).results;
  const jb = (await env.DB.prepare("SELECT project,status FROM jobs WHERE instr(project,'ออดิชัน·')=1").all()).results;
  const s0 = await getSettings(env);
  return { daily: Math.min(8, Math.max(4, +s0.aud_daily || 6)), roles: AUD_ROLES.map(x => ({ key: x.key, role: x.role })), cands: cs.map(c => { const pre = `ออดิชัน·${c.role}·${c.id}·`; return { ...c, card: (ims.filter(i => i.project.startsWith(pre) && i.scene === 1).pop() || {}).id || 0, aud: (ims.filter(i => i.project.startsWith(pre) && i.scene === 2).pop() || {}).id || 0, pending: jb.filter(j => j.project.startsWith(pre)).length }; }) };
}

async function fluxKeysApi(env, b) {
  const act = (b || {}).act || 'list';
  if (act === 'add') {
    const name = String(b.name || '').trim().slice(0, 40), acct = String(b.acct || '').trim(), token = String(b.token || '').trim();
    if (!name || !/^[0-9a-f]{32}$/i.test(acct) || token.length < 20) return { error: 'ตรวจชื่อ Account ID (32 ตัว) และรหัสอีกครั้ง' };
    let ok = '', err = '';
    try { await runHelper({ acct, token }, 'a small blue flower, simple illustration', 1); ok = 'ทดสอบผ่าน'; } catch (e) { err = String(e.message || e); if (!isQuota(err)) return { error: 'ทดสอบรหัสไม่ผ่าน: ' + err.slice(0, 200) }; ok = 'รหัสใช้ได้ แต่โควตาวันนี้ของบัญชีนี้หมดแล้ว'; }
    await env.DB.prepare('INSERT INTO fluxkeys (name,acct,token,on_,created) VALUES (?,?,?,0,?)').bind(name, acct, token, Date.now()).run();
    return { ok: true, msg: ok };
  }
  if (act === 'set') { await env.DB.prepare('UPDATE fluxkeys SET on_=? WHERE id=?').bind(b.on ? 1 : 0, +b.id).run(); return { ok: true }; }
  if (act === 'del') { await env.DB.prepare('DELETE FROM fluxkeys WHERE id=?').bind(+b.id).run(); return { ok: true }; }
  const r = await env.DB.prepare('SELECT id,name,acct,on_,paused_until,day,n,last_err,created FROM fluxkeys ORDER BY id').all();
  return { keys: r.results.map(k => ({ ...k, acct: k.acct.slice(0, 4) + '…' + k.acct.slice(-4) })), now: Date.now() };
}
async function genImage(env, s, prompt, steps, seed) {
  const now = Date.now();
  if (now >= +s.paused_until) {
    try { const out = await env.AI.run(MODEL, { prompt, steps }); if (out && out.image) { await qadd(env, 'nu', 19.2 + 38.4 * steps); await qadd(env, 'img', 1); return { image: out.image, by: '' }; } throw new Error('AI ไม่ได้ส่งภาพกลับมา'); }
    catch (e) { const m = String(e.message || e); if (!isQuota(m)) throw e; await qset(env, 'nu_full', 1); await setSetting(env, 'img_err', new Date().toISOString() + ' ' + m.slice(0, 400)); await setSetting(env, 'paused_until', String(nextReset())); s.paused_until = String(nextReset()); }
  }
  const day = new Date(now + 7 * 3600000).toISOString().slice(0, 10);
  for (const k of await activeKeys(env, now)) {
    try {
      const img = await runHelper(k, prompt, steps, seed);
      await env.DB.prepare('UPDATE fluxkeys SET n=CASE WHEN day=? THEN COALESCE(n,0)+1 ELSE 1 END, day=?, last_err=NULL WHERE id=?').bind(day, day, k.id).run();
      return { image: img, by: k.name };
    } catch (e) {
      const m = String(e.message || e);
      // พรอมต์ถูกปฏิเสธ (เช่นตัวกรองเนื้อหาเข้าใจผิด) = ปัญหาของงานนี้ ไม่ใช่ของบัญชี → ให้งานนี้ล้มเหลว ไม่พักบัญชี
      if (/NSFW|8007|3030|\[400\]/i.test(m) && !isQuota(m)) { await env.DB.prepare('UPDATE fluxkeys SET last_err=? WHERE id=?').bind(m.slice(0, 200), k.id).run(); throw new Error('พรอมต์ถูกตัวกรองปฏิเสธ ลองแก้คำ: ' + m.slice(0, 160)); }
      await env.DB.prepare('UPDATE fluxkeys SET last_err=?, paused_until=? WHERE id=?').bind(m.slice(0, 200), isQuota(m) ? nextReset() : now + 30 * 60000, k.id).run();
    }
  }
  const qe = new Error('quota: โควตาเราและผู้ช่วยหมดทุกบัญชี'); qe.allQuota = true; throw qe;
}
// ---- สไตล์ลายเส้นกลาง: พรอมต์เก็บ [[STYLE]] ไว้ แล้วแทนด้วยสไตล์ปัจจุบันตอนสร้าง/แสดง เปลี่ยนสไตล์ทีเดียวมีผลกับทุกอย่าง (รวมงานที่ยังรอคิว) ----
const DEF_STYLE = 'soft anime style, beautiful detailed anime illustration, delicate fine line art, detailed hair strands and fabric folds, soft cinematic lighting, gentle shading';
function curStyle(s) { return String((s && s.style) || '').trim() || DEF_STYLE; }
function envStyle(s) { return curStyle(s).split(',').map(x => x.trim()).filter(x => x && !/hair|fabric|character|face|portrait|girl|person|people|skin|beautiful/i.test(x)).join(', ') || 'soft anime style, detailed anime background art'; }
// สไตล์สำหรับ "ของ/ชุด/สัตว์/อาวุธ" (งานออกแบบวัตถุ): ตัดคำที่ดึงให้โมเดลวาดหน้าคน/ผม/สาวสวย ออก (Flux ไม่มี negative prompt คำว่า hair/beautiful จึงดึงหน้าเข้ามา)
function objStyle(s) { return curStyle(s).split(',').map(x => x.trim()).filter(x => x && !/hair|fabric|character|face|portrait|girl|person|people|skin|beautiful/i.test(x)).join(', ') || 'soft anime style, clean detailed design illustration'; }
// พรอมต์เก่าในคิว/คลัง: ล้างประโยคปฏิเสธ (no face, no head ฯลฯ — ใน Flux กลับดึงสิ่งนั้นเข้ามา) และเลือกสไตล์ตามชนิดงาน
function legacyFix(p) {
  const objy = /plain soft background|single object|creature design|dress form|faceless mannequin|environment element design|product design sheet/.test(p);
  p = p.split(', not worn, no person, no face, no head, no body, no hands, no mannequin').join('').split('laid flat or floating').join('isolated')
    .split('displayed on a faceless mannequin').join("displayed on a headless tailor's dress form")
    .split(', no people').join('').split('no people, ').join('');
  if (objy && p.includes('[[STYLE]]')) p = p.split('[[STYLE]]').join('[[STYLE_OBJ]]');
  return p;
}
// ตัวสำรอง (Flux) วาดช่องสตอรีบอร์ด: ใช้ LoRA ไม่ได้ → ตัดคำกระตุ้น LoRA ทิ้ง และย้ายลายเส้นไว้ "ต้นคำสั่ง" (อยู่ท้ายแล้ว Flux ไม่ค่อยทำตาม ภาพออกโทนอุ่นเงานุ่ม)
function fluxDraft(job, s, shEn, fl) {
  const p = String(job.prompt || '');
  if (!String(job.project || '').startsWith('ฉาก') || !p.includes('[[STYLE]]')) return withStyle(p, s);
  // มีคำกระตุ้น LoRA = คำสั่งพ่วงชุดประจำตัวของตัวละครมาด้วย (เช่น ฮู้ดดำของริน) ซึ่งทับชุดที่ช่องนั้นระบุ → ใช้เฉพาะจำนวนคน + คำบรรยายของช่อง
  const body = fl && fl.nochar && shEn ? shEn : shEn && /chr\d+x/.test(p) ? p.split(/chr\d+x/)[0] + shEn : p.replace(/chr\d+x,?\s*/g, '').replace(/,?\s*\[\[STYLE\]\]/, '');
  // Flux ไม่ค่อยทำตามแท็กอายุ ต้องบอกเป็นประโยค (เจอจริง: ป้าฮานะ 61 ออกมาเป็นสาว)
  const age = /\b(old woman|old man|middle-aged)/.test(p) ? 'Every character is drawn youthful and attractive, looking much younger than their real age, smooth faces without wrinkles' : ''; // ผู้ใช้สั่ง: ทุกตัวดูหนุ่มสาว อายุเยอะให้สวย/หล่อกว่าวัย
  // ภาพร่างสตอรีบอร์ด = มังงะขาวดำตัดเส้นหมึก (ผู้ใช้เลือก): ไม่มีสี/แสงให้แกว่งข้ามช่อง · ตั้ง settings draft_style เพื่อเปลี่ยนได้
  const st = String(s.draft_style || '').trim() || 'professional black and white manga panel, clean consistent fine-pen line art with controlled line weight and precise contours, light dot screentone and controlled hatching for shading. Characters: hair drawn as fine separate strands, detailed expressive eyes with highlights, natural clothing folds and fabric texture, correct hand anatomy with five well-shaped fingers, small accessories drawn clearly. Environment: real architecture and furniture with surface textures (wood grain, paper, metal, glass, plush fur), small props that fit the place, clear foreground, midground and background with correct perspective and depth, contact shadows and cast shadows under people and objects. Any paper, ledger, book, sign or talisman shows only simple wavy lines or blank areas instead of writing. Clean and readable, not cluttered, people (only those the scene describes) drawn in a delicate manga style with slender anime proportions, no color, no text, no speech bubbles';
  const col = !!(fl && fl.color); // ภาพสี (แบบผสม): คงสีในบท ไม่ตัดออก
  const mono = col ? body.replace(/\bmanga\b/gi, 'anime').replace(/,?\s*single cinematic illustration/, '').replace(/\b(a |an )?\d\d-year-old /gi, 'a ').replace(/ {2,}/g, ' ') : body.replace(/,?\s*single cinematic illustration/, '').replace(/\b(bright |dark |pale |soft |warm |deep )?(red|blue|pink|yellow|orange|purple|green|golden|crimson|scarlet|indigo|teal|brown)\b\s*/gi, '').replace(/\bblond\b/gi, 'light').replace(/\b(a |an )?\d\d-year-old /gi, 'a ').replace(/, a tired gentle face/gi, ', a gentle face').replace(/\ba plain /gi, 'a ').replace(/\b(mature male|middle-aged man|mature female|middle-aged woman|old woman|old man),\s*/gi, '').replace(/ {2,}/g, ' ');
  const who = fl && fl.nochar ? (/\bhands?\b|fingers/.test(mono) ? 'Only the hands described are visible, no full person and nobody else in the picture. ' : /pedestrian|passersby|customers|crowd|clerks|people/.test(mono) ? 'No main characters: only the tiny distant figures the scene mentions. ' : /demon|creature|spirit|figure|silhouette|child/.test(mono) ? 'No other people except what the scene describes. ' : 'No people at all in this panel, only the place and objects. ') : ''; // ช่องไม่มีตัวละคร: กัน AI เติมคนแปลกหน้า (เจอจริง: เด็กนักเรียนโผล่หน้าหอระฆัง)
  if (col) return `${draftCam(mono, fl && fl.nochar, true)}. ${who}${age ? age + '. ' : ''}Scene: ${mono}. Style: ${HY_FLUX_STYLE} The setting is always fully drawn behind the characters with complete background detail, never a blank or plain background.`;
  return `${draftCam(mono, fl && fl.nochar)}. ${who}${age ? age + '. ' : ''}Scene: ${mono}. Style: ${st}. The setting is always fully drawn behind the characters with complete background detail, never a blank or plain background. Strictly black ink on white paper, grayscale only.`; // มุมกล้อง + เนื้อเรื่องมาก่อนลายเส้น (ตัวเข้ารหัส CLIP อ่านแค่ ~77 โทเคนแรก — เดิมลายเส้นมาก่อน มุมกล้องเลยหลุด ได้แต่หน้าตรง)
}
// มุมกล้องของช่อง → ประโยคบังคับท่า/มุม (Flux ชอบวาดคนหันหน้าตรงมองกล้องถ้าไม่สั่งชัด)
function draftCam(en, nochar, col) {
  const e = String(en || '').toLowerCase(), c = [];
  if (/worm's-eye/.test(e)) c.push("worm's-eye view looking almost straight up, strong perspective");
  if (/bird's-eye/.test(e)) c.push("bird's-eye view looking straight down from high above");
  if (/\bpov\b|point of view/.test(e)) c.push('first-person point of view shot');
  if (/dutch/.test(e)) c.push('tilted dutch angle');
  if (/over-the-shoulder/.test(e)) c.push('over-the-shoulder shot, one character seen from behind in the foreground');
  if (/back view|from behind|walking away/.test(e)) c.push('character seen from behind, back to the viewer');
  if (/side view|from the side|profile|side shot/.test(e)) c.push('side profile view, character facing sideways');
  if (/low[- ]angle/.test(e)) c.push('dramatic low-angle shot looking up from the ground');
  if (/high[- ]angle|from above|from high above|top-down/.test(e)) c.push('high-angle shot looking down from above');
  if (/extreme close-up/.test(e)) c.push('extreme close-up filling the frame');
  else if (/close-up/.test(e)) c.push('close-up framing');
  if (/medium shot|medium two-shot/.test(e)) c.push('medium shot, waist-up framing');
  if (/two-shot|face to face|face-to-face/.test(e)) c.push('two characters interacting with each other, facing each other, not facing the viewer');
  if (/wide shot|establishing|panoram|street-level/.test(e)) c.push(nochar ? 'wide shot, the place fills the frame' : 'wide shot, the place fills the frame, characters small in the scene');
  if (/dynamic|running|leaping|swinging|throwing|jumping|fighting|lunging/.test(e)) c.push('dynamic action pose with motion lines, diagonal composition');
  if (/insert/.test(e)) c.push('insert shot of the object, no character faces');
  if (!nochar && !/back view|from behind|side view|from the side|profile|over-the-shoulder|insert|wide shot|establishing|pov|only (his|her|the two) hand/.test(e)) c.push('three-quarter view, the character is busy with the action and looking away from the viewer, candid moment, not posing for the camera');
  if (!c.length) c.push(nochar ? 'the place and objects only' : 'three-quarter view, candid moment');
  return (col ? 'Full colour anime key frame, not black and white. Camera: ' : 'Manga panel. Camera: ') + c.join(', ');
}
function withStyle(p, s) { p = legacyFix(String(p || '')); if (p.includes('[[STYLE_OBJ]]')) p = p.split('[[STYLE_OBJ]]').join(objStyle(s)); if (p.includes('[[STYLE_ENV]]')) p = p.split('[[STYLE_ENV]]').join(envStyle(s)); return p.includes('[[STYLE]]') ? p.split('[[STYLE]]').join(curStyle(s)) : p; }
// เจนต่อเนื่อง: คิวว่างเมื่อไร เติมผู้สมัครออดิชันใหม่เอง (สลับบท) — เอาไว้ให้ได้ภาพมากพอเลือกทำ LoRA
async function autoFill(env, s) {
  const n = +s.fill_n || 0; await setSetting(env, 'fill_n', String(n + 1));
  const asg = new Set((await env.DB.prepare('SELECT cast_role FROM aud_cands WHERE cast_role IS NOT NULL').all()).results.map(x => x.cast_role));
  const open = AUD_ROLES.filter(R => !asg.has(R.key)), L = open.length ? open : AUD_ROLES;
  await audApi(env, { act: 'gen', role: L[n % L.length].key, n: 1 });
}
// ---- ภาพอนิเมะด้วย SDXL / FLUX.1-dev บน Kaggle (ฟรี ไม่กินโควตา Cloudflare) · Flux เป็นตัวสำรองเมื่อ Kaggle ใช้ไม่ได้ ----
// เลือกเอนจินภาพต่องาน: img_engine = auto | sdxl | dev | flux(Cloudflare schnell) · ค่าเก่า 'kaggle' = auto
// auto: งานของ/ชุด/สัตว์/อาวุธ/ฉากในคลัง → FLUX.1-dev (auto_obj_engine) · งานตัวละคร/ฉากอนิเมะ → SDXL (auto_char_engine) · ตั้งสลับได้
// FLUX ที่ใช้หารายได้ได้: FLUX.1-schnell (Apache-2.0) เป็นค่าเริ่มต้น · FLUX.1-dev ห้ามใช้เชิงพาณิชย์ — ใช้ได้เฉพาะเมื่อตั้ง settings img_commercial='0'
// ===== ภาพแบบผสม: ฉาก (FLUX) + ตัวละคร/ของสำคัญ (SDXL Animagine XL 4.0, ใบอนุญาต Open RAIL++-M ใช้หารายได้ได้) =====
const HY_FLUX_STYLE = 'high quality full colour TV anime background art and key frame, clean consistent line art, flat cel colours with soft gradients, detailed real architecture and furniture with textures, correct perspective and depth, believable lighting and cast shadows, every sign, label, screen and paper is blank with no letters.';
const HY_SDXL_STYLE = 'anime screencap, anime coloring, flat color, clean lineart, cel shading, detailed background';
// ตัวละคร = ตัวตน (หน้า/ตา/สีผม/สัดส่วน ล็อกตายตัว) + ตู้เสื้อผ้า (ชุด+ทรงผม เปลี่ยนตามบท) — ผู้ใช้สั่ง: หล่อ สวย สัดส่วนดี มีจุดขาย วาบหวิวระดับอนิเมะทีวี หลายชุดหลายทรงผม
// สัตว์อ้างอิงกายวิภาคสัตว์จริง (ผู้ใช้สั่ง) · แก้ทับได้ที่ settings hytags
const HY_CHAR = {
  'โทวะ': { id: '1boy, adult, young man, handsome, bishounen, black hair, dark grey eyes, sharp eyes, mole under eye, tall, slim, broad shoulders', neg: 'green hair, blue hair, brown hair, blonde hair, fat, old man',
    of: { work: ['ชุดทำงาน', 'messy hair, ahoge, round eyewear, thin glasses, white collared shirt, sleeves rolled up, loose necktie, dark necktie, grey sweater vest, black pants', 'messy black hair, round glasses, grey knit vest and loose necktie'],
      casual: ['วันหยุด', 'messy hair, round eyewear, navy cardigan, white t-shirt, beige pants, sneakers', 'messy black hair, round glasses, navy cardigan over a white tee'],
      home: ['อยู่บ้าน', 'very messy hair, bedhead, no eyewear, oversized grey t-shirt, sweatpants, slippers', 'bed-head black hair, no glasses, baggy grey tee and sweatpants'],
      cool: ['หล่อเท่ (ถอดแว่น)', 'slicked back hair, no eyewear, black suit, black jacket, white shirt, black necktie, serious, cool', 'slicked-back black hair, no glasses, sharp black suit'] }, def: 'work' },
  'ริน': { id: '1girl, adult, young woman, beautiful, red hair, long hair, amber eyes, sharp eyes, slender, curvy, slim waist, long legs', neg: 'black hair, brown hair, blonde hair, short hair',
    of: { night: ['นักผนึก (กลางคืน)', 'high ponytail, cropped black hoodie, hood down, midriff, navel, black shorts, black thighhighs, fingerless gloves, sneakers', 'long red high ponytail, cropped black hoodie showing her waist, shorts and black thigh-highs'],
      bakery: ['ร้านขนมปัง', 'braided bun, low bun, large round eyewear, cream blouse, white apron, smile', 'red braided bun, big round glasses, cream blouse and white bakery apron'],
      casual: ['เดินเล่นวันหยุด', 'long hair down, hair over shoulder, off-shoulder white sweater, bare shoulders, denim skirt, ankle boots', 'long loose red hair, off-shoulder white sweater, denim skirt'],
      sleep: ['ชุดนอน', 'side braid, oversized white t-shirt, short shorts, barefoot, sleepy', 'red side braid, oversized white sleep tee and shorts'] }, def: 'night' },
  'มิโอะ': { id: '1girl, adult, young woman, beautiful, black hair, purple eyes, half-closed eyes, long eyelashes, curvy, slim waist', neg: 'brown hair, blue hair, red hair, school uniform, serafuku, pleated skirt, sweater vest, vest, necktie',
    of: { office: ['ชุดออฟฟิศ', 'short bob, blunt bangs, rabbit hair ornament, fitted white blouse, collared blouse, long sleeves, black pencil skirt, black pantyhose', 'short black bob, blunt bangs, rabbit hair clip, fitted white blouse and black pencil skirt'],
      inspector: ['สารวัตรอาคม', 'bob cut, hair slicked to one side, hairpin, black military coat, white gloves, armband, black pencil skirt, knee boots, serious', 'black bob pinned to one side, black inspector coat with armband and white gloves'],
      holiday: ['วันหยุดสีหวาน', 'short bob, blunt bangs, rabbit hair ornament, pastel pink knit sweater, white flared skirt, holding stuffed bunny', 'short black bob, pink knit sweater, white skirt, hugging a toy rabbit'],
      sleep: ['ชุดนอนกระต่าย', 'short bob, messy hair, rabbit print pajamas, animal hood, rabbit ears hood, hugging pillow', 'messy black bob, rabbit-print pyjamas with a bunny-ear hood'] }, def: 'office' },
  'หัวหน้าซาเอกิ': { id: '1girl, mature female, beautiful, tall, black hair, streaked hair, silver streak, red eyes, sharp eyes, red lips, curvy', neg: '',
    of: { suit: ['สูทดำ', 'short bob, drop earrings, fitted black pantsuit, black jacket, high collar blouse, black pants, high heels', 'black bob with one silver streak, fitted black pantsuit'],
      casual: ['นอกเวลางาน', 'short bob, sunglasses on head, wine red turtleneck sweater, long beige coat', 'black bob with silver streak, wine turtleneck and long coat'] }, def: 'suit' },
  'ป้าฮานะ': { id: '1girl, mature female, beautiful, youthful, grey hair, red eyes, sharp eyes, long eyelashes, mole under mouth, red lips, curvy', neg: 'blue eyes, brown hair, black hair, white hair',
    of: { bakery: ['ร้านขนมปัง', 'hair bun, white apron, sleeves rolled up, flour on clothes, holding rolling pin', 'grey hair in a bun, white apron dusted with flour, rolling pin'],
      casual: ['นอกร้าน', 'long hair down, purple kimono, obi', 'long grey hair down, purple kimono'],
      sealer: ['ชุดนักผนึก (อดีต)', 'high ponytail, long black battle coat with red trim, talisman belt, paper talismans, holding rolling pin like a weapon, fierce smile', 'grey high ponytail, black battle coat with red trim and talismans'],
      winter: ['ชุดกันหนาว', 'low side bun, long knit cardigan, scarf, long skirt, holding paper bag of bread', 'grey side bun, knit cardigan and scarf'] }, def: 'bakery', gx: ['comedic angry face, raising rolling pin, anger vein, sharp teeth', 'comedic smug face, smirk, half-closed eyes, hand on hip', 'comedic crying laughing, tears of laughter, open mouth, holding stomach', 'comedic shocked face, white blank eyes, sweatdrop, flour cloud'] },
  'ไค': { id: '1boy, adult, young man, handsome, blonde hair, golden eyes, fang, scar on eyebrow, athletic', neg: '',
    of: { courier: ['คนขนของ', 'short hair, spiky hair, open courier jacket, black t-shirt, cargo pants, large backpack, grin', 'spiky blond hair, open courier jacket, big backpack'],
      casual: ['ชุดเล่น', 'spiky hair, hawaiian shirt, open shirt, shorts, sandals, grin', 'spiky blond hair, open hawaiian shirt and shorts'],
      winter: ['ชุดกันหนาว', 'spiky hair, oversized hoodie, long scarf, beanie, hands in pockets', 'spiky blond hair, hoodie, scarf and beanie'],
      night: ['ชุดขนของกลางคืน', 'spiky hair, black bomber jacket, face mask pulled down, cargo pants, fingerless gloves, lantern on belt', 'spiky blond hair, black bomber jacket, mask pulled down'] }, def: 'courier', gx: ['comedic face, red handprint on cheek, slapped, teary eyes', 'comedic lovestruck face, heart-shaped eyes, blush, drooling', 'comedic crying, waterfall tears, wailing', 'comedic smug grin, sparkling teeth, thumbs up'] },
  'โมจิ': { o: 1, id: 'no humans, animal focus, white kitten, fluffy fur, realistic cat anatomy, real cat proportions, chubby round body, short legs, pink nose, whiskers, big blue eyes, long fluffy tail, small glowing paper lantern at tail tip', neg: 'human, humanoid, standing on two legs, anthro, clothes',
    of: { def: ['ปกติ', '', 'a fluffy round white kitten with real cat anatomy and a tiny glowing lantern on its tail tip'] }, def: 'def' },
};
const HY_TAGS = {}; // ชุดหลักของแต่ละตัว (ใช้กับโค้ดเดิม) + ริน_d = ชุดร้านขนมปัง
for (const [n, c] of Object.entries(HY_CHAR)) { const o = c.of[c.def]; HY_TAGS[n] = { ...(c.o ? { o: 1 } : {}), tags: [c.id, o[1]].filter(Boolean).join(', '), desc: o[2], ...(c.neg ? { neg: c.neg } : {}) }; }
HY_TAGS['ริน_d'] = { tags: HY_CHAR['ริน'].id + ', ' + HY_CHAR['ริน'].of.bakery[1], desc: HY_CHAR['ริน'].of.bakery[2], neg: HY_CHAR['ริน'].neg };
function refPlan(cr) { // [project, prompt, opt] เรียงตามลำดับความสำคัญ: ชุดที่ใช้ในตอน 1 → ชุดอื่น → ตัวรอง
  const GAG = ['comedic deadpan face, half-closed eyes, flat unimpressed expression, blank stare, colorful speed lines background', 'comedic shocked face, white blank eyes, sweatdrop, mouth wide open, exaggerated, colorful speed lines background', 'comedic laughing face, huge wide open mouth, closed happy eyes, exaggerated expression, colorful burst background', 'comedic flustered face, blush, steam from ears, wavy mouth, embarrassed, sparkles background'];
  const ST = 'simple white background, anime screencap, flat color, clean lineart, character design, beautiful detailed eyes, perfect anatomy, good proportions';
  const refOf = n => { const v = cr[n]; return v ? (+v.n || 0) : 0; }; // ล็อกหน้าจากภาพปกติที่เลือกเท่านั้น (ภาพหน้าตลกพาสีรุ้ง/ภาพซ้อนสองคนมาด้วย)
  const one = (n, ofk, view, extra) => { const c = HY_CHAR[n], o = c.of[ofk]; const id = refOf(n);
    const pr = [c.id, o[1], view, extra || '', /comedic/.test(view) ? 'anime screencap, flat color, clean lineart, beautiful detailed eyes, good proportions' : ST].filter(Boolean).join(', ');
    return ['อ้างอิง·' + n + '·' + (/comedic/.test(view) ? 'ตลก' : 'ปกติ') + '·' + o[0], pr, { engine: 'sdxl', w: /upper body/.test(view) ? 1024 : 832, h: /upper body/.test(view) ? 1024 : 1216, steps: 30, seed: 0, loras: [], ...(c.neg ? { neg: c.neg + ', nsfw, nude, nipples, panties' } : { neg: 'nsfw, nude, nipples, panties' }), ...(id ? { refimg: id, rw: 0.4, ipa_end: 0.7 } : {}), takes: 2, np: c.o ? 0 : 1, qneg: ['two people', 'the same person drawn twice', 'a close-up face next to the full body', 'monochrome black and white drawing', 'deformed body, extra limbs'] }]; };
  const FB = 'full body, standing, front view, arms at sides, gentle smile', TQ = 'full body, standing, three-quarter view, confident pose', UP = g => 'upper body, ' + g;
  const out = [];
  for (const [n, k] of [['โทวะ', 'work'], ['ริน', 'night'], ['ริน', 'bakery'], ['มิโอะ', 'office']]) { out.push(one(n, k, FB), one(n, k, TQ)); }
  out.push(one('มิโอะ', 'office', 'cowboy shot, hand on cheek, looking at viewer, slight blush'), one('มิโอะ', 'office', 'full body, sitting on office chair, crossed legs, hugging plush rabbit'));
  for (const n of ['โทวะ', 'ริน', 'มิโอะ']) out.push(one(n, HY_CHAR[n].def, UP(GAG[1])), one(n, HY_CHAR[n].def, UP(GAG[3])));
  out.push(one('โมจิ', 'def', 'full body, sitting, front view, cute'), one('โมจิ', 'def', 'full body, loaf pose, lying, from side, cute'));
  for (const n of ['โทวะ', 'ริน', 'มิโอะ']) for (const k of Object.keys(HY_CHAR[n].of)) if (k !== HY_CHAR[n].def && !(n === 'ริน' && k === 'bakery')) out.push(one(n, k, FB));
  const GX = { 'หัวหน้าซาเอกิ': 'comedic menacing face, dark aura, glowing red eyes, shadowed face, colorful speed lines background', 'ไค': 'comedic face, red handprint on cheek, slapped, teary eyes, colorful speed lines background', 'ป้าฮานะ': 'comedic angry face, raising rolling pin, anger vein, sharp teeth, colorful speed lines background' };
  for (const n of ['หัวหน้าซาเอกิ', 'ไค', 'ป้าฮานะ']) { const c = HY_CHAR[n]; out.push(one(n, c.def, FB), one(n, c.def, UP(GX[n]))); for (const k of Object.keys(c.of)) if (k !== c.def) out.push(one(n, k, FB)); }
  return out;
}
function hyLook(n, ofk) { const c = HY_CHAR[n]; const o = c && c.of[ofk]; return o ? { tags: [c.id, o[1]].filter(Boolean).join(', '), desc: o[2], ...(c.neg ? { neg: c.neg } : {}), ...(c.o ? { o: 1 } : {}) } : null; }
function s3Actor(x, z, pose, face) { // หุ่นคนแบบกล่อง (ยืน/นั่ง/โค้ง/นั่งพื้น/ตัวเล็ก) ให้ภาพความลึก
  const f = face >= 0 ? 1 : -1, bx = (a, b, c, d, e, g) => [Math.min(a, d), Math.min(b, e), Math.min(c, g), Math.max(a, d), Math.max(b, e), Math.max(c, g)].map(v => Math.round(v * 1000) / 1000);
  if (pose === 'sit') return [bx(x - .24, .47, z - .16 * f, x + .24, 1.05, z + .08 * f), bx(x - .11, 1.05, z - .1 * f, x + .11, 1.32, z + .1 * f), bx(x - .2, .45, z, x + .2, .6, z + .45 * f), bx(x - .18, 0, z + .38 * f, x + .18, .45, z + .5 * f)];
  if (pose === 'bow') return [bx(x - .18, 0, z - .12, x + .18, .9, z + .12), bx(x - .24, .85, z, x + .24, 1.15, z + .6 * f), bx(x - .11, .7, z + .55 * f, x + .11, .95, z + .78 * f)];
  if (pose === 'floor') return [bx(x - .3, 0, z - .4, x + .3, .65, z + .4), bx(x - .11, .65, z - .1, x + .11, .9, z + .1)];
  if (pose === 'tall') return [bx(x - .14, 0, z - .08, x + .14, 1.2, z + .08), bx(x - .18, 1.2, z - .1, x + .18, 1.95, z + .1), bx(x - .1, 1.95, z - .1, x + .1, 2.2, z + .1)];
  if (pose === 'tiny') return [bx(x - .15, .47, z - .15, x + .15, .78, z + .15)];
  return [bx(x - .18, 0, z - .12, x + .18, .86, z + .12), bx(x - .24, .86, z - .14, x + .24, 1.46, z + .14), bx(x - .11, 1.46, z - .11, x + .11, 1.73, z + .11)];
}
function s3Opt(s3) { // say.s3 = {loc, cam, act:[[ชื่อ, จุดยืน]]} → กล่องฉาก + หุ่นคน + กล้อง
  const S = SETS[s3 && s3.loc]; if (!S) return null;
  let cam = S.cams[s3.cam];
  if (!cam && /^(close|side):/.test(s3.cam || '')) { const [k, sp, ...m] = s3.cam.split(':'), P = S.spots[sp]; if (!P) return null; const [x, z, pose, f] = P, h = { sit: 1.18, floor: .8, tiny: .62, bow: .9 }[pose] || 1.58, low = m.includes('low');
    cam = k === 'close' ? { p: [x + .15, h - (low ? .35 : .02), z + 1.05 * f], l: [x, h + (low ? .12 : -.04), z], fov: 42 } : { p: [x + 1.15, h - (low ? .35 : 0), z + .1 * f], l: [x - .3, h + (low ? .1 : -.05), z + .05 * f], fov: 44 }; }
  if (!cam) return null;
  const act = [], actn = [], actc = []; for (const [nm, sp] of (s3.act || [])) { const P = S.spots[sp]; if (P) { const b = s3Actor(P[0], P[1], P[2], P[3]); act.push(...b); actn.push(nm); actc.push(b.length); } }
  return { loc: s3.loc, camName: s3.cam, cam, boxes: S.boxes, act, actn, actc };
}
function hyOpt(en, names, s, of) {
  let HT = HY_TAGS; try { HT = { ...HY_TAGS, ...JSON.parse(s.hytags || '{}') }; } catch { }
  const e = String(en || ''), lo = e.toLowerCase();
  const day = /braided low bun|bakery apron/.test(lo); // รินตอนกลางวัน (พนักงานร้านขนมปัง)
  const chars = [];
  for (const n of names || []) { const t = (of && of[n] && hyLook(n, of[n])) || HT[n === 'ริน' && day ? 'ริน_d' : n]; if (t) chars.push({ n, p: t.o ? 0 : 1, tags: t.tags, desc: t.desc, ...(t.neg ? { neg: t.neg } : {}) }); }
  const chibi = /chibi/.test(lo), hands = /only (his|her|the two) hands?|hand(s)? (is|are) visible/.test(lo);
  if (chibi) for (const c of chars) c.tags = 'chibi, ' + c.tags;
  if (hands) for (const c of chars) c.p = 0; // ช่องเห็นแค่มือ: ไม่วาดทั้งตัว
  // ฉากเปล่า: มุมกล้อง + ส่วน Setting/Lighting ของบท
  const set = (e.match(/Setting:\s*([^]*?)(?=\s(?:Lighting|Effects):|\sAll papers|$)/) || [])[1] || '';
  const lit = (e.match(/Lighting:\s*([^.]*)\./) || [])[1] || '';
  const bg = `${draftCam(e, true, true)}. No people at all, an empty place with nobody in it. Place: ${set.replace(/;?\s*drawn behind (him|her|them)\.?/gi, '').trim()}${lit ? '. Lighting: ' + lit : ''}. Style: ${HY_FLUX_STYLE}`;
  const contact = /\b(sits?|sitting|seated|bench|desk|holds?|holding|hands? (him|her)|pulls?|pulling|hug|lean(s|ing)?|carr(y|ies|ying)|grab|tug|bites?|touch|shoulder|lying|kneel|crouch|on the floor|chair)\b/.test(lo);
  const place = /archive office/.test(lo) ? 'indoors, office, filing cabinet, wooden floor, arched window, ceiling lamp' : /vending machine/.test(lo) ? 'outdoors, night, alley, gravel, brick wall, vending machine, bench, street lamp' : /storage aisle/.test(lo) ? 'indoors, storage room, shelves, dark, light bulb' : /bakery/.test(lo) ? 'indoors, bakery, bread, counter, sunlight' : /outside the city barrier|floating rock/.test(lo) ? 'outdoors, night, starry sky, floating island, dark mist' : /town|street|roof/.test(lo) ? 'outdoors, town, street, japanese architecture, lantern' : '';
  const pc = chars.filter(c => c.p), cnt = pc.length ? [pc.filter(c => /1girl/.test(c.tags)).length, pc.filter(c => /1boy/.test(c.tags)).length] : [0, 0];
  const cntT = pc.length ? [cnt[1] ? cnt[1] + 'boy' + (cnt[1] > 1 ? 's' : '') : '', cnt[0] ? cnt[0] + 'girl' + (cnt[0] > 1 ? 's' : '') : ''].filter(Boolean).join(', ') : (hands ? 'hands, close-up' : 'no humans, scenery');
  const plush = /plush toys/.test(lo) ? 'exactly five small plush toys sitting on the desk, white rabbit plush, brown teddy bear, grey seal plush, orange tabby cat plush, yellow chick plush' : '';
  const L = lit.toLowerCase(), litT = /night|moon|lamp|glow/.test(L) ? 'night, dark, lamp light' : /dim|flicker|dark/.test(L) ? 'dim lighting' : /afternoon|sunset|evening|dusk|golden/.test(L) ? 'afternoon, warm sunlight, golden hour' : /morning|dawn/.test(L) ? 'morning, soft sunlight' : /sun|window|day|bright/.test(L) ? 'daylight, sunlight' : '';
  return {
    chars, bg, mode: contact || chibi || hands ? 'over' : 'comp', style: s.hy_style || HY_SDXL_STYLE,
    pose: /from behind|back view|back to the viewer/.test(lo) ? 'from behind' : /side view|profile/.test(lo) ? 'from side' : '',
    all: [cntT, chars.map(c => c.tags.replace(/^(chibi, )?\d?(boy|girl|1boy|1girl), /, '$1')).join(', '), place, litT, 'consistent lighting, full color', plush].filter(Boolean).join(', ').slice(0, 900),
    neg: (() => { const T = chars.map(c => c.tags).join(', ').toLowerCase(), N = ['nsfw, nude, nipples, panties, underwear, monochrome, greyscale, sketch, english text, japanese text, letters, logo, watermark, school uniform, serafuku, floating objects, multicolored hair, streaked hair, colored inner hair', ...chars.map(c => c.neg || '')].join(', ').split(',').map(x => x.trim()).filter(x => x && !T.includes(x.toLowerCase())); return [...new Set(N)].join(', '); })(), // คำห้ามของตัวละครหนึ่งที่ชนกับชุด/ผมของอีกตัวในช่องเดียวกันถูกตัดออก
    props: plush ? { 88: 'small cute plush toy, stuffed animal' } : {}, dc: 0.62, dn: 1.0, cs: 0.75, // SDXL วาดจากศูนย์ทั้งภาพ ใช้แค่เส้นโครงของ FLUX (ไม่เอาสี/ลายเส้น FLUX ปน → สไตล์ไม่แกว่ง ชุดไม่เพี้ยนตามแบบร่าง)
    ...(plush ? { plush: ['long-eared white rabbit plush toy', 'brown teddy bear plush toy', 'grey seal plush toy, round seal', 'small cat plush toy', 'yellow chick plush toy, baby bird'] } : {}),
  };
}
function fluxEng(s) { return s && s.img_commercial === '0' ? 'dev' : 'schnell'; }
function imgEngineFor(j, s) {
  const e = String((s && s.img_engine) || 'auto');
  if (e === 'sdxl') return e; if (e === 'dev' || e === 'schnell') return fluxEng(s);
  if (j && j.eng === 'sdxl') return 'sdxl'; // ช็อตร่างที่มีตัวละครแต่ยังไม่มี LoRA: ใช้ SDXL อนิเมะ ให้ลายเส้นตรงกับของจริง
  const p = String((j && j.prompt) || ''), pr = String((j && j.project) || '');
  if (pr.startsWith('ฉาก') && !/chr\d+x/.test(p)) return fluxEng(s); // ช็อตฉาก/บรรยากาศไม่มีตัวละคร → FLUX.1-dev · ช็อตมีตัวละคร → SDXL + LoRA
  const obj = pr.startsWith('คลัง·') || p.includes('[[STYLE_OBJ]]') || p.includes('[[STYLE_ENV]]') ||
    /plain soft background|single object|creature design|dress form|faceless mannequin|environment element design|product design sheet/.test(p);
  return obj ? (s.auto_obj_engine === 'sdxl' ? 'sdxl' : fluxEng(s)) : (s.auto_char_engine === 'dev' ? fluxEng(s) : 'sdxl');
}
// ===== เวอร์ชันเรียบ: ซีรีส์ → บท (AI เสนอ/สั่งแก้) → (ต่อไป: ตัวละคร LoRA → ซีน → ตอน) =====
const SCRIPT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'; // เปลี่ยนได้ที่ settings.script_model (ชื่อโมเดล Workers AI)
async function llmJson(env, s, user) {
  let out; try { out = await env.AI.run(s.script_model || SCRIPT_MODEL, { messages: [{ role: 'system', content: 'คุณเป็นนักเขียนบทอนิเมะ ตอบเป็นภาษาไทย และตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น' }, { role: 'user', content: user }], max_tokens: 2400 }); }
  catch (e) { if (isQuota(String(e.message || e))) await qset(env, 'nu_full', 1); throw e; }
  { const u = out && out.usage, ti = (u && +u.prompt_tokens) || Math.ceil(String(user).length / 2), to = (u && +u.completion_tokens) || Math.ceil(String((out && out.response) || '').length / 2); await qadd(env, 'nu', ti * 0.026668 + to * 0.204805); await qadd(env, 'llm', 1); } // ราคาเป็น neurons ของ llama-3.3-70b fp8 (ประมาณ)
  let t = out && out.response; if (t && typeof t === 'object') t = JSON.stringify(t);
  t = String(t || '').replace(/```json|```/g, '');
  const a = t.search(/[\[{]/); if (a < 0) throw new Error('AI ไม่ได้ตอบเป็น JSON ลองใหม่อีกครั้ง');
  try { return JSON.parse(t.slice(a, t.lastIndexOf(t[a] === '[' ? ']' : '}') + 1)); }
  catch (e) { // คำตอบยาวจนถูกตัดกลางคัน: เก็บเฉพาะรายการที่เขียนจบแล้ว (เจอจริงกับตัวเขียนช่องมังงะ — ค้างทั้งตอน)
    const b = t.indexOf('['), k = t.lastIndexOf('},'); if (b >= 0 && k > b) { try { return JSON.parse(t.slice(b, k + 1) + ']'); } catch (e2) { } }
    throw new Error('AI ตอบ JSON ไม่ครบ: ' + String(e.message || e).slice(0, 80)); }
}
let animeReady = false;
async function animeSchema(env) {
  if (animeReady) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS series (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, brief TEXT, created INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS chars (id INTEGER PRIMARY KEY AUTOINCREMENT, series_id INTEGER, name TEXT, desc TEXT, created INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS scripts (id INTEGER PRIMARY KEY AUTOINCREMENT, series_id INTEGER, body TEXT, ver INTEGER DEFAULT 1, picked INTEGER DEFAULT 0, created INTEGER)'),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS loras (id INTEGER PRIMARY KEY AUTOINCREMENT, char_id INTEGER, vjob INTEGER, status TEXT DEFAULT 'queued', error TEXT, size INTEGER DEFAULT 0, use INTEGER DEFAULT 0, created INTEGER)"),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS lchunks (lid INTEGER, idx INTEGER, data TEXT)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS shots (id INTEGER PRIMARY KEY AUTOINCREMENT, script_id INTEGER, idx INTEGER, beat INTEGER, th TEXT, en TEXT, chars TEXT, loras TEXT, kproj TEXT, created INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS scenes (id INTEGER PRIMARY KEY AUTOINCREMENT, series_id INTEGER, ep INTEGER DEFAULT 1, sc INTEGER DEFAULT 1, no INTEGER, title TEXT, logline TEXT, script_id INTEGER DEFAULT 0, sb INTEGER DEFAULT 0, auto INTEGER DEFAULT 0, fin INTEGER DEFAULT 0, created INTEGER)')]);
  await env.DB.prepare('ALTER TABLE shots ADD COLUMN say TEXT').run().catch(() => { });
  await env.DB.prepare('ALTER TABLE shots ADD COLUMN chain INTEGER DEFAULT 0').run().catch(() => { });
  for (const q of ['ALTER TABLE shots ADD COLUMN loc TEXT', "ALTER TABLE chars ADD COLUMN kind TEXT DEFAULT 'char'", 'ALTER TABLE chars ADD COLUMN story TEXT']) await env.DB.prepare(q).run().catch(() => { });
  await env.DB.batch(['shots(script_id)', 'shots(kproj)', 'scenes(series_id)', 'lchunks(lid)', 'loras(char_id)', 'aud_cands(kept)'].map((x, i) => env.DB.prepare(`CREATE INDEX IF NOT EXISTS ix_b${i} ON ${x}`))).catch(() => { });
  animeReady = true;
}
// เทรน LoRA ตัวละครอัตโนมัติ: ภาพอ้างอิงครบและไม่มีงานค้าง → เข้าคิวเทรนบน Kaggle (ใช้ภาพที่ติดดาว ถ้าเลือกไว้ ≥8 ภาพ ไม่งั้นใช้ทุกภาพ) · ปิดได้ที่ settings.auto_lora = 0
async function animeAuto(env, s) {
  if (s.auto_lora === '0') return;
  await animeSchema(env);
  const cs = (await env.DB.prepare("SELECT c.* FROM chars c WHERE (c.series_id<>0 OR EXISTS (SELECT 1 FROM aud_cands a WHERE a.char_id=c.id AND a.cast_role IS NOT NULL)) AND NOT EXISTS (SELECT 1 FROM loras l WHERE l.char_id=c.id AND l.status IN ('queued','ready','failed'))").all()).results;
  for (const c of cs) {
    const pj = charProj(c);
    if ((await env.DB.prepare("SELECT COUNT(*) n FROM jobs WHERE project=? AND status IN ('queued','running','kaggle')").bind(pj).first()).n) continue;
    const all = (await env.DB.prepare('SELECT id,scene,starred FROM images WHERE project=? ORDER BY id').bind(pj).all()).results;
    if (all.length < 12) continue;
    const st = all.filter(x => x.starred), use = (st.length >= 8 ? st : all).slice(0, 24), trig = 'chr' + c.id + 'x';
    const imgs = use.map(x => ({ id: x.id, cap: `${trig}, ${CHAR_VARS[((+x.scene || 1) - 1) % CHAR_VARS.length]}` }));
    const r = await env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,kind,opt) VALUES (?,'','lora','','','',0,'queued',0,?,'lora',?)").bind(pj, Date.now(), JSON.stringify({ char_id: c.id, trigger: trig, images: imgs, pri: await loraPri(env, c.id) })).run();
    await env.DB.prepare("INSERT INTO loras (char_id,vjob,status,created) VALUES (?,?,'queued',?)").bind(c.id, r.meta.last_row_id, Date.now()).run();
  }
}
// ตัวละครต่อซีรีส์: สร้างชุดภาพอ้างอิงหลายมุม/อารมณ์ (เข้าคิวภาพเดิม → โหมดอัตโนมัติเลือก SDXL ให้) ภาพที่ติดดาว = ชุดเทรน LoRA
const CHAR_VARS = ['front view, full body, standing, neutral expression', 'three-quarter view, upper body, smiling', 'side profile, upper body', 'back view, full body', 'close-up face, happy', 'close-up face, serious', 'close-up face, surprised', 'full body, walking', 'sitting on a chair, full body', 'running, dynamic pose, full body', 'looking up, upper body', 'waving at viewer, upper body', 'angry expression, upper body', 'sad expression, close-up face', 'laughing, upper body', 'arms crossed, full body, confident'];
const charProj = c => `ซีรีส์${c.series_id}·${c.name}`;
// LoRA ประเภทอื่นของเรื่อง: ศัตรู/ตัวประหลาด (enemy) · สถานที่ (place) · สไตล์ทั้งเรื่อง (style) — ใช้ตาราง chars เดิม แยกด้วยคอลัมน์ kind
const XL_VARS = {
  enemy: ['front view, full body, menacing stance', 'three-quarter view, full body', 'side view, full body', 'close-up of the face, snarling', 'roaring, upper body', 'lunging forward to attack, dynamic pose', 'crouching low, ready to pounce', 'back view, full body', 'looming, seen from a low angle', 'close-up of its claws or weapon', 'walking slowly, full body', 'recoiling from a hit', 'emerging from shadows', 'glaring, upper body', 'mid-leap, dynamic pose', 'standing still in mist, full body'],
  place: ['wide establishing shot, daytime', 'wide establishing shot, night', 'view from the entrance', 'central area at eye level', 'low angle view', 'high angle view from above', 'side angle view', 'close view of its characteristic details', 'at sunset, warm light', 'in the rain', 'quiet early morning', 'looking outward from inside', 'corner view with depth', 'foggy atmosphere', 'lantern-lit evening', 'straight-on symmetrical view'],
  style: ['a young woman smiling, upper body', 'a young man with a serious look, upper body', 'two people talking on a street', 'a quiet city street at night', 'a traditional room interior', 'a close-up face with a surprised expression', 'a person running, full body', 'a temple courtyard, wide shot', 'a canned coffee on a table, close-up', 'a rooftop view at sunset', 'a person sitting by a window', 'a market street with lanterns', 'a fighting pose, dynamic full body', 'a rainy alley', 'a glowing paper talisman, close-up', 'three friends laughing together']
};
const xlKind = c => (XL_VARS[c && c.kind] ? c.kind : 'char');
const xlVar = (c, i) => { const k = xlKind(c), L = k === 'char' ? CHAR_VARS : XL_VARS[k]; return L[((i % L.length) + L.length) % L.length]; };
const xlRefPrompt = (c, i) => { const k = xlKind(c), v = xlVar(c, i);
  if (k === 'enemy') return `${c.desc}, ${v}, plain dark background, same creature design in every image, [[STYLE]]`;
  if (k === 'place') return `${c.desc}, ${v}, no people, same location design in every image, detailed anime background art, [[STYLE]]`;
  if (k === 'style') return `${v}${c.desc ? ', ' + c.desc : ''}, [[STYLE]]`;
  return `${c.desc}, ${v}, plain light background, same character design in every image, [[STYLE]]`; };
async function charRefs(env, cid, n) {
  const c = await env.DB.prepare('SELECT * FROM chars WHERE id=?').bind(cid).first(); if (!c) throw new Error('ไม่พบตัวละคร');
  const pj = charProj(c);
  const have = (await env.DB.prepare('SELECT (SELECT COUNT(*) FROM images WHERE project=?1)+(SELECT COUNT(*) FROM jobs WHERE project=?1 AND status<>\'failed\') n').bind(pj).first()).n || 0;
  const now = Date.now(), st = [];
  for (let i = 0; i < n; i++) st.push(env.DB.prepare("INSERT INTO jobs (project,scene,prompt,status,created,steps) VALUES (?,?,?,'queued',?,4)").bind(pj, have + i + 1, xlRefPrompt(c, have + i).slice(0, 1800), now));
  await env.DB.batch(st);
  return { queued: n };
}

// ===== สร้างตอนอัตโนมัติจากโครงเรื่อง (.docx): บท→ช็อต→ภาพคีย์+LoRA→วิดีโอ ผ่านระบบ animeAdvance เดิม =====
async function readPlan(env, story) { try { const r = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('plan:' + story).first(); return r ? JSON.parse(r.value) : null; } catch (e) { return null; } }
async function castList(env, sr) { // บทในเรื่อง (ชื่อบท + ลักษณะ + LoRA ที่พร้อมของนักแสดงที่ใส่บทไว้) ให้ AI เขียนบท/ช็อต และให้ภาพคีย์ใช้ LoRA ถูกคน
  if (!sr) return [];
  const plan = await readPlan(env, sr.title); if (!plan) return [];
  const rows = (await env.DB.prepare("SELECT c.cast_role k, c.char_id cid, (SELECT l.id FROM loras l WHERE l.char_id=c.char_id AND l.status='ready' ORDER BY l.id DESC LIMIT 1) lid FROM aud_cands c WHERE c.cast_story=? AND c.cast_role IS NOT NULL").bind(sr.title).all()).results;
  const m = new Map(rows.map(x => [x.k, x]));
  return plan.roles.map(r => { const c = m.get(r.key) || {}; return { name: r.key, desc: `${r.kind}${r.age ? ' อายุ ' + r.age : ''}: ${r.look}`.slice(0, 300), cid: c.cid || 0, lid: c.lid || 0 }; });
}
// ประเภทงาน: กำหนดจำนวนซีน/ช็อตต่อซีน และแนวการเล่าเรื่อง (สัดส่วนภาพ/สไตล์ตั้งจากหน้าเว็บตอนกดเลือก)
const WORK = {
  anime: { scenes: 3, shots: 20, beats: '5-7', note: 'งานนี้เป็นอนิเมะ: แอ็กชันและอารมณ์ชัดเจน มุมกล้องหลากหลาย มีช็อตเคลื่อนไหวเด่นๆ' },
  film: { scenes: 3, shots: 16, beats: '5-6', note: 'งานนี้เป็นหนังสั้นโทนภาพยนตร์: จังหวะนิ่ง ช็อตกว้างสลับโคลสอัพ แสงเงาแบบหนัง เล่าด้วยภาพมากกว่าคำพูด' },
  series: { scenes: 3, shots: 14, beats: '5-6', note: 'งานนี้เป็นซีรีส์ดราม่า: เน้นบทสนทนาและสีหน้าตัวละคร จบซีนด้วยปมให้อยากดูต่อ' },
  ad: { scenes: 1, shots: 8, beats: '4', note: 'งานนี้เป็นโฆษณาสั้นราว 30 วินาที: เปิดด้วยภาพดึงสายตา → ปัญหาหรือความต้องการ → จุดขาย → ปิดด้วยคำชวน' }
};
async function workOf(env, title) { let k = ''; try { const r = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('wk:' + title).first(); k = r ? String(r.value) : ''; } catch (e) { } return { key: WORK[k] ? k : '', ...(WORK[k] || WORK.anime) }; }
async function epstOf(env, title) { try { const r = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('epst:' + title).first(); return r ? JSON.parse(r.value) : {}; } catch (e) { return {}; } }
async function shotLoraMap(env, seriesId) { // LoRA ที่พร้อมใช้ของตัวละครในเรื่องนี้ + น้ำหนักต่อบท
  const sc = { series_id: seriesId };
  const lc = (await env.DB.prepare("SELECT c.id cid,c.name,c.desc,l.id lid FROM chars c JOIN loras l ON l.char_id=c.id AND l.status='ready' AND l.use=1 WHERE c.series_id=? OR c.series_id=0").bind(sc.series_id).all()).results;
  for (const c of await castList(env, await env.DB.prepare('SELECT * FROM series WHERE id=?').bind(sc.series_id).first())) if (c.lid) lc.push({ cid: c.cid, name: c.name, lid: c.lid, desc: ((await env.DB.prepare('SELECT desc FROM chars WHERE id=?').bind(c.cid).first()) || {}).desc || '' }); // LoRA ของนักแสดงที่ใส่บทไว้ (ชื่อบท = ชื่อใน shots.chars)
  let wm = {}; try { const srt = await env.DB.prepare('SELECT title FROM series WHERE id=?').bind(sc.series_id).first(), wr = srt && await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('lw:' + srt.title).first(); wm = wr ? JSON.parse(wr.value) : {}; } catch (e) { wm = {}; }
  let xl = []; try { const srt = await env.DB.prepare('SELECT title FROM series WHERE id=?').bind(seriesId).first(); if (srt) xl = (await env.DB.prepare("SELECT c.id cid,c.name,c.kind,l.id lid FROM chars c JOIN loras l ON l.char_id=c.id AND l.status='ready' AND l.use=1 WHERE c.story=? AND c.kind IN ('style','place') ORDER BY l.id DESC").bind(srt.title).all()).results; } catch (e) { xl = []; }
  return { lc: lc.filter(c => !xl.some(x => x.cid === c.cid)), wm, xl };
}
// คำเรียก LoRA ในคำสั่งวาด: คำกระตุ้น + เพศ + ลักษณะเด่นสั้นๆ ของตัวนั้น (คำกระตุ้นอย่างเดียวไม่พอ โมเดลจะวาดเป็นคนอื่น — เจอจริงกับ LoRA ชุดแรก)
const loraTag = c => { const d = String(c.desc || ''), g = /\b(woman|girl|female)\b/i.test(d) ? '1girl' : /\b(man|boy|male)\b/i.test(d) ? '1boy' : ''; return ['chr' + c.cid + 'x', g, d.split(',').slice(0, 4).join(',').slice(0, 170)].filter(Boolean).join(', '); };
// LoRA ที่ช็อตนี้ควรใช้: ตัวละคร/ศัตรูในช็อต (สูงสุด 2) + สไตล์ของเรื่อง + สถานที่ (ถ้ายังไม่เกิน 3 ตัว — ซ้อนมากกว่านี้ภาพเริ่มเละ)
function shotLoraPick(sh, L) {
  let names = []; try { names = JSON.parse(sh.chars || '[]'); } catch (e) { names = []; }
  const seen = new Set(), m = [];
  for (const c of L.lc) if (names.includes(c.name) && !seen.has(+c.lid) && m.length < 2) { seen.add(+c.lid); m.push({ cid: c.cid, lid: c.lid, w: +(L.wm || {})[c.name] || 0.9, k: 'char', tag: loraTag(c) }); }
  const st = (L.xl || []).find(x => x.kind === 'style'); if (st) m.push({ cid: st.cid, lid: st.lid, w: 0.6, k: 'style' });
  const pl = sh.loc && (L.xl || []).find(x => x.kind === 'place' && x.name === sh.loc); if (pl && m.length < 3) m.push({ cid: pl.cid, lid: pl.lid, w: 0.7, k: 'place' });
  return { names, m };
}
async function epCheck(env, story, plan, E) {
  const rows = (await env.DB.prepare("SELECT c.cast_role k, (SELECT status FROM loras l WHERE l.char_id=c.char_id AND l.status<>'old' ORDER BY l.id DESC LIMIT 1) ls FROM aud_cands c WHERE c.cast_story=? AND c.cast_role IS NOT NULL").bind(story).all()).results;
  const cast = new Map(rows.map(x => [x.k, x.ls])), rs = (E.cast || []).map(k => plan.roles.find(x => x.key === k)).filter(r => r && r.g !== 'x' && r.tier !== 'none');
  return { miss: rs.filter(r => !cast.has(r.key)).map(r => r.key), nol: rs.filter(r => r.tier === 'main' && cast.get(r.key) !== 'ready').map(r => r.key) };
}
async function qcCheck(env, imgId) { // ตรวจภาพ 1 ใบ: ภาพว่าง/เสีย (เช็กเอง) + ให้ AI ดูภาพให้คะแนน 1-10 (ถ้า AI ใช้ไม่ได้ จะข้ามส่วนนี้)
  const r = await env.DB.prepare('SELECT data FROM images WHERE id=?').bind(imgId).first();
  if (!r || !r.data) return { score: 0, issues: 'ไม่พบภาพ' };
  const bytes = b64ToBytes(r.data);
  if (bytes.length < 15000) return { score: 1, issues: 'ภาพว่างหรือเสีย' };
  if (bytes.length > 1600000) return { score: null, issues: 'ภาพใหญ่เกินกว่าจะส่งให้ AI ตรวจ' };
  try {
    const out = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', { image: Array.from(bytes), prompt: 'You are checking one anime key frame. Rate its quality from 1 to 10. Penalize heavily: deformed or extra fingers or hands, melted or distorted faces, duplicated limbs or bodies, garbled text, watermarks, broken or blurry image. Answer exactly in this format: SCORE=<number> ISSUES=<at most 8 words>', max_tokens: 60 });
    const t = String((out && (out.description || out.response)) || '');
    const m = t.match(/SCORE\s*[=:]\s*(\d+)/i);
    if (!m) return { score: null, issues: '' };
    const im = t.match(/ISSUES\s*[=:]\s*(.+)/i);
    return { score: Math.max(0, Math.min(10, +m[1])), issues: im ? im[1].slice(0, 120) : '' };
  } catch (e) { return { score: null, issues: 'AI ตรวจภาพไม่ได้: ' + String((e && e.message) || e).slice(0, 100) }; }
}
async function qcRun(env, story, budget, onlySid) {
  await animeSchema(env);
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS qc (shot_id INTEGER PRIMARY KEY, img INTEGER, score INTEGER, issues TEXT, tries INTEGER DEFAULT 0, created INTEGER)').run();
  const sr = await env.DB.prepare('SELECT id FROM series WHERE title=?').bind(story).first(); if (!sr) return { eps: [], left: 0, vision: false };
  const scs = (await env.DB.prepare('SELECT * FROM scenes WHERE series_id=? AND script_id>0 ORDER BY no').bind(sr.id).all()).results.filter(x => !onlySid || +x.script_id === +onlySid);
  const eps = {}; let left = 0, seen = 0, nul = 0;
  for (const sc of scs) {
    const E = eps[sc.ep] || (eps[sc.ep] = { no: sc.ep, shots: 0, scored: 0, sum: 0, bad: 0, fixing: 0, scenes: 0, fin: 0, final: 0, issues: [] });
    E.scenes++; if (+sc.fin) E.fin++;
    const rows = (await env.DB.prepare('SELECT id,kproj FROM shots WHERE script_id=? ORDER BY idx').bind(sc.script_id).all()).results;
    for (const sh of rows) {
      E.shots++;
      const im = await env.DB.prepare('SELECT MAX(id) id FROM images WHERE project=?').bind(sh.kproj).first();
      if (!im || !im.id) { E.fixing++; continue; }
      let q = await env.DB.prepare('SELECT * FROM qc WHERE shot_id=?').bind(sh.id).first();
      if (!q || +q.img !== +im.id) {
        if (budget <= 0) { left++; continue; }
        budget--;
        const r = await qcCheck(env, im.id), tries = q ? +q.tries : 0;
        await env.DB.prepare('INSERT OR REPLACE INTO qc (shot_id,img,score,issues,tries,created) VALUES (?,?,?,?,?,?)').bind(sh.id, im.id, r.score, r.issues || '', tries, Date.now()).run();
        q = { score: r.score, issues: r.issues, tries, img: im.id };
      }
      seen++; if (q.score == null) nul++;
      if (q.score != null) { E.scored++; E.sum += +q.score; }
      if (q.score != null && +q.score <= 4) {
        if (+q.tries < 2) { // ภาพเสีย: ลบภาพ+วิดีโอของช็อตนี้ แล้วให้ระบบวาดใหม่เอง (ใช้ LoRA ตัวละครเดิม) และรวมซีนใหม่เมื่อครบ
          await env.DB.batch([
            env.DB.prepare('DELETE FROM images WHERE project=?').bind(sh.kproj),
            env.DB.prepare('DELETE FROM videos WHERE ep=? AND shot=?').bind('a' + sc.script_id, String(sh.id)),
            env.DB.prepare("DELETE FROM videos WHERE ep=? AND shot='final'").bind('a' + sc.script_id),
            env.DB.prepare("DELETE FROM videos WHERE ep=? AND shot='final'").bind('E' + sr.id + 'x' + sc.ep),
            env.DB.prepare('UPDATE scenes SET fin=0 WHERE id=?').bind(sc.id),
            env.DB.prepare('INSERT OR REPLACE INTO qc (shot_id,img,score,issues,tries,created) VALUES (?,0,NULL,?,?,?)').bind(sh.id, q.issues || '', +q.tries + 1, Date.now())]);
          E.fixing++; if (E.issues.length < 3 && q.issues) E.issues.push(q.issues);
        } else { E.bad++; if (E.issues.length < 3 && q.issues) E.issues.push(q.issues); }
      }
    }
  }
  const out = [];
  for (const E of Object.values(eps).sort((a, b) => a.no - b.no)) {
    const v = await env.DB.prepare("SELECT MAX(id) id FROM videos WHERE ep=? AND shot='final'").bind('E' + sr.id + 'x' + E.no).first();
    E.final = (v && v.id) || 0; E.avg = E.scored ? Math.round(E.sum / E.scored * 10) : null; delete E.sum; out.push(E);
  }
  return { ok: true, eps: out, left, vision: seen === 0 ? null : nul < seen };
}
// ===== สตอรีบอร์ดแบบมังงะ (v2): บทพูดกับภาพเกิดพร้อมกันทีละช่อง · มุมกล้องเป็นตัวเลือกตายตัว · รูปลักษณ์ตัวละครใส่จากบทเสมอ · มีรอบ "อ่านทวน" ให้ AI เติมช่องที่ขาดจนเรื่องต่อกัน =====
const SHOTS = { wide: 'wide shot', medium: 'medium shot, waist up', closeup: 'close-up of the face', two: 'two-shot', ots: 'over-the-shoulder shot', low: 'low angle shot', high: 'high angle shot from above', insert: 'extreme close-up insert shot of an object or hands, no face', back: 'view from behind' };
const thOnly = t => String(t == null ? '' : t).replace(/[぀-ヿ㐀-鿿＀-￯]+/g, '').replace(/\s+/g, ' ').trim(); // ตัดอักษรจีน/ญี่ปุ่นที่ AI ชอบหลุดมา
function cleanPanel(x, names, places) {
  const fix = w => { w = thOnly(w); if (!w) return ''; if (names.includes(w)) return w; const f = names.find(n => n.includes(w) || w.includes(n)); return f || null; };
  const solo = (Array.isArray(x.chars) ? x.chars : []).map(fix).filter(Boolean), lines = (Array.isArray(x.lines) ? x.lines : []).map(l => { let w = fix(l && l.who); if (w === '' && l && String(l.who || '').trim() && solo.length === 1) w = solo[0]; /* ชื่อคนพูดเป็นอักษรต่างชาติ: ถ้าช่องนั้นมีตัวละครเดียว ถือว่าเป็นคนนั้น */ return { who: w, say: thOnly(l && l.say).slice(0, 120) }; }).filter(l => l.say && l.who !== null && !/^(ฟังนะ|ว่าไง|ดีไหม|อะไรนะ|เอาล่ะ)$/.test(l.say)).slice(0, 3);
  const chars = [...new Set((Array.isArray(x.chars) ? x.chars : []).map(fix).filter(Boolean).concat(lines.map(l => l.who).filter(Boolean)))].slice(0, 4);
  const shot = SHOTS[x.shot] ? x.shot : 'medium', en = String(x.en || '').replace(/\s+/g, ' ').trim().slice(0, 380);
  if (!en) return null;
  const think = thOnly(x.think).slice(0, 40), ono = thOnly(x.ono).slice(0, 14);
  return { th: thOnly(x.th).slice(0, 200) || en.slice(0, 80), en: SHOTS[shot] + ', ' + en, chars, say: JSON.stringify({ who: lines[0] ? lines[0].who : '', say: lines[0] ? lines[0].say : '', lines, ...(think ? { think } : {}), ...(ono ? { ono } : {}) }), chain: x.chain ? 1 : 0, loc: places.includes(x.loc) ? x.loc : null, shot };
}
// รูปลักษณ์ตัวละครตามบท (ถ้าบทไม่ได้บอก ให้ออกแบบตามธีมของเรื่อง) — ใช้ทั้งตอนวาดร่างและตอนออกแบบ LoRA · เก็บใน settings looks:<เรื่อง> แก้เองได้
async function roleLooks(env, s, story, plan) {
  let L = {}; try { const r = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('looks:' + story).first(); L = r ? JSON.parse(r.value) : {}; } catch (e) { L = {}; }
  const miss = ((plan && plan.roles) || []).filter(r => r.tier !== 'none' && !L[r.key]);
  if (!miss.length || !plan) return L;
  try {
    const o = await llmJson(env, s, `เรื่อง: ${plan.title || story}\n${String(plan.overview || '').slice(0, 700)}\nตัวละครที่ต้องออกแบบ:\n${miss.map(r => `- ${r.key}: ${r.g === 'f' ? 'หญิง' : r.g === 'm' ? 'ชาย' : 'ไม่ใช่คน'} อายุ ${r.age || '?'} · ${r.kind} · ${r.look || ''} · ${r.traits || ''}`).join('\n')}\nที่ออกแบบไว้แล้ว (ห้ามซ้ำ): ${Object.entries(L).map(([k, v]) => k + ' = ' + v).join(' | ').slice(0, 900) || '-'}\n\nออกแบบรูปลักษณ์ของแต่ละตัวเป็นคำสั่งวาดภาพภาษาอังกฤษ ไม่เกิน 30 คำ: เพศ อายุ ทรงผม สีผม สีตา ชุดประจำตัว จุดเด่น 1 อย่าง ให้แต่ละตัวต่างกันชัดเจน ยึดตามที่บทบอก ส่วนที่บทไม่ได้บอกให้ออกแบบให้เข้ากับธีมของเรื่อง ตัวละครที่เป็นคนต้องเป็นผู้ใหญ่ ห้ามชุดนักเรียน ออกแบบขึ้นใหม่ ห้ามอ้างถึงตัวละครจากเรื่องอื่น ตัวที่ไม่ใช่คนให้บรรยายเป็นสัตว์หรืออสูร\nตอบเป็น JSON: {"ชื่อตัวละคร":"english look"}`);
    for (const r of miss) if (typeof o[r.key] === 'string' && o[r.key].trim().length > 15) L[r.key] = o[r.key].trim().slice(0, 240);
    await setSetting(env, 'looks:' + story, JSON.stringify(L));
  } catch (e) { }
  return L;
}
// อ่านทวนทั้งซีนแบบคนอ่านครั้งแรก: แก้บทพูดที่ลอย เติมช่องที่ขาดให้เรื่องต่อกัน (ทำครั้งเดียวต่อซีน)
async function sbReview(env, s, sid, names, places) {
  await env.DB.prepare('UPDATE shots SET idx=idx*10 WHERE script_id=? AND idx<5000').bind(sid).run();
  const rows = (await env.DB.prepare('SELECT id,idx,th,say,chars FROM shots WHERE script_id=? ORDER BY idx').bind(sid).all()).results; if (rows.length < 3) return { edit: 0, add: 0 };
  const sc = await env.DB.prepare('SELECT s.title,s.logline,p.body FROM scenes s JOIN scripts p ON p.id=s.script_id WHERE s.script_id=?').bind(sid).first();
  const txt = rows.map((r, i) => { let y = {}; try { y = JSON.parse(r.say || '{}'); } catch (e) { } return `${i + 1}. [ภาพ: ${r.th}] ${(y.lines || []).map(l => (l.who || 'บรรยาย') + ': ' + l.say).join(' / ') || '(ไม่มีคำ)'}`; }).join('\n');
  const o = await llmJson(env, s, `นี่คือมังงะ 1 ซีน เรียงตามช่อง\nซีนนี้ต้องเล่าว่า: ${sc ? sc.title + ' — ' + sc.logline : ''}\nบทของซีน: ${String((sc && sc.body) || '').slice(0, 1500)}\nตัวละครที่ใช้ชื่อได้: ${names.join(', ')}\n\n${txt}\n\nอ่านแบบคนที่ไม่รู้เรื่องมาก่อน แล้วแก้ให้อ่านรู้เรื่องครบ: ใครเป็นใคร อยู่ที่ไหน ต้องการอะไร เกิดอะไรขึ้น แล้วจบซีนอย่างไร\n- edit = ช่องที่บทพูดลอย ไม่ต่อกับช่องก่อน หรือไม่บอกอะไร ให้เขียน lines ใหม่ (1-3 บรรทัด)\n- add = ช่องที่ต้องเพิ่มเพราะเรื่องกระโดด ขาดเหตุผล ขาดปฏิกิริยา หรือบทพูดแน่นเกินไป (ระบุ after = เลขช่องที่จะแทรกต่อท้าย; shot เลือกจาก ${Object.keys(SHOTS).join(' | ')}; en = ฉากและการกระทำภาษาอังกฤษ เรียกตัวละครว่า the man / the woman / the creature ห้ามใส่ชื่อ ห้ามบรรยายผมหรือชุด)\nไม่เกินอย่างละ 6 รายการ ภาษาไทยล้วน ถ้าอ่านรู้เรื่องดีแล้วให้ตอบรายการว่าง\nตอบเป็น JSON: {"edit":[{"n":1,"lines":[{"who":"","say":""}]}],"add":[{"after":1,"shot":"medium","th":"","en":"","chars":[""],"lines":[{"who":"","say":""}]}]}`);
  const st = []; let ne = 0, na = 0;
  for (const x of (Array.isArray(o.edit) ? o.edit : []).slice(0, 6)) { const r = rows[+x.n - 1]; if (!r) continue; const p = cleanPanel({ en: 'x', lines: x.lines, chars: [] }, names, places); let y = {}; try { y = JSON.parse(p.say); } catch (e) { } if (!y.lines || !y.lines.length) continue; let old = {}; try { old = JSON.parse(r.say || '{}'); } catch (e) { } st.push(env.DB.prepare('UPDATE shots SET say=? WHERE id=?').bind(JSON.stringify({ ...old, who: y.lines[0].who, say: y.lines[0].say, lines: y.lines }), r.id)); ne++; }
  const used = {};
  for (const x of (Array.isArray(o.add) ? o.add : []).slice(0, 6)) { const r = rows[+x.after - 1]; if (!r) continue; const p = cleanPanel(x, names, places); if (!p) continue; used[r.id] = (used[r.id] || 0) + 1; if (used[r.id] > 4) continue; const idx = r.idx + used[r.id] * 2;
    st.push(env.DB.prepare('INSERT INTO shots (script_id,idx,beat,th,en,chars,kproj,created,say,chain,loc) VALUES (?,?,0,?,?,?,?,?,?,0,?)').bind(sid, idx, p.th, p.en, JSON.stringify(p.chars), `ฉาก${sid}·${idx}`, Date.now(), p.say, p.loc)); na++; }
  for (let i = 0; i < st.length; i += 20) await env.DB.batch(st.slice(i, i + 20));
  return { edit: ne, add: na };
}
// ออกแบบตัวละครของเรื่องจากบท → วาดชุดฝึก → เทรน LoRA → ใส่บทให้เอง (settings design_cast=<เรื่อง> หรือปุ่มในสตูดิโอ)
async function designCast(env, s, story) {
  await animeSchema(env);
  const plan = await readPlan(env, story); if (!plan) return { error: 'ไม่พบโครงเรื่อง' };
  const L = await roleLooks(env, s, story, plan), made = [];
  await env.DB.prepare("UPDATE aud_cands SET cast_role=NULL, cast_story=NULL, chosen=0 WHERE cast_story=? AND NOT EXISTS (SELECT 1 FROM chars c WHERE c.id=aud_cands.char_id AND c.story=?)").bind(story, story).run(); // ถอดนักแสดงจากคลังเก่าที่ไม่ได้ออกแบบมาเพื่อเรื่องนี้ (ไม่ลบ)
  for (const r of plan.roles) {
    if (r.tier === 'none' || !L[r.key]) continue;
    if (await env.DB.prepare('SELECT 1 FROM aud_cands WHERE cast_story=? AND cast_role=?').bind(story, r.key).first()) continue;
    let name = String(r.key).replace(/[·\n]/g, ' ').slice(0, 30); if (await env.DB.prepare('SELECT id FROM chars WHERE series_id=0 AND name=?').bind(name).first()) name = (name + ' ' + story).slice(0, 40);
    if (await env.DB.prepare('SELECT id FROM chars WHERE series_id=0 AND name=?').bind(name).first()) continue;
    const desc = `${r.g === 'f' ? 'woman, ' : r.g === 'm' ? 'man, ' : ''}${L[r.key]}`.slice(0, 500);
    const c = await env.DB.prepare("INSERT INTO chars (series_id,name,desc,created,kind,story) VALUES (0,?,?,?,'char',?)").bind(name, desc, Date.now(), story).run(), cid = c.meta.last_row_id;
    await env.DB.prepare("INSERT INTO aud_cands (role,name,age,traits,intro,look,chosen,created,kept,cast_role,cast_story,char_id) VALUES ('',?,?,'','',?,1,?,1,?,?,?)").bind(name, +r.age || 0, desc, Date.now(), r.key, story, cid).run();
    await charRefs(env, cid, 16);
    await env.DB.prepare("UPDATE jobs SET steps=8 WHERE project=? AND status='queued'").bind('ซีรีส์0·' + name).run();
    made.push(r.key);
  }
  await setSetting(env, 'lora_go', '1');
  return { ok: true, made };
}
// ตรวจสตอรีบอร์ดเองก่อนวาด: ตัดช็อตที่ซ้ำ/ไม่เดินเรื่อง และเปลี่ยนมุมกล้องช็อตที่ซ้ำมุมติดกัน (ทำครั้งเดียวต่อซีน)
async function sbTighten(env, s, sid) {
  const rows = (await env.DB.prepare('SELECT id,idx,th,en,kproj,chain FROM shots WHERE script_id=? ORDER BY idx').bind(sid).all()).results;
  if (rows.length < 6) return { cut: 0, fix: 0 };
  const keep = new Set(); rows.forEach((r, i) => { if (+r.chain || +((rows[i + 1] || {}).chain)) keep.add(i + 1); }); // ชุดท่าต่อเนื่องของฉากสู้: ห้ามตัด/ห้ามแก้ prompt (ต้องคงมุมกล้องและฉากเดิม)
  const o = await llmJson(env, s, `นี่คือสตอรีบอร์ดของ 1 ซีน เรียงตามลำดับ (เลข: คำอธิบาย | prompt ภาพ)\n${rows.map((r, i) => `${i + 1}: ${r.th} | ${String(r.en).slice(0, 160)}`).join('\n')}\n\nตรวจแล้วแก้ให้เป็นสตอรีบอร์ดที่กระชับและดูดี:\n1) drop = เลขช็อตที่ควรตัดทิ้ง เพราะซ้ำกับช็อตก่อนหน้า (เหตุการณ์เดิม ท่าเดิม) หรือไม่ช่วยเล่าเรื่อง ช็อตติดกันที่เป็นการกระทำต่อเนื่องเดียวกัน (เช่น เดินเข้าไป → หยุด → มองรอบๆ หรือ ยืนฟัง → ยืนเงียบ) ให้เหลือช็อตเดียวที่ดีที่สุด ตัดให้เด็ดขาด ไม่ต้องเกรงใจ ห้ามตัดช็อตแรกและช็อตสุดท้าย ห้ามตัดเกินครึ่งของทั้งหมด ห้ามตัดช็อตที่มีเหตุการณ์สำคัญหรือตัวละครใหม่เข้าฉาก\n2) fix = ช็อตที่เหลือซึ่งมุมกล้องซ้ำกับช็อตติดกัน ให้เขียน prompt ภาพใหม่เป็นภาษาอังกฤษ เปลี่ยนมุมกล้อง/ขนาดภาพให้หลากหลาย (wide shot, close-up, low angle, over-the-shoulder ฯลฯ) โดยคงฉากและการกระทำเดิม ห้ามใส่ชื่อตัวละคร\nตอบเป็น JSON: {"drop":[เลข],"fix":[{"n":เลข,"en":"new English image prompt"}]}`);
  const N = rows.length, dropN = [...new Set((Array.isArray(o.drop) ? o.drop : []).map(Number).filter(n => n > 1 && n < N && !keep.has(n)))].slice(0, Math.floor(N / 2));
  const dropSet = new Set(dropN), fixes = (Array.isArray(o.fix) ? o.fix : []).filter(f => f && +f.n >= 1 && +f.n <= N && !dropSet.has(+f.n) && !keep.has(+f.n) && typeof f.en === 'string' && f.en.trim().length >= 20).slice(0, Math.ceil(N / 2));
  const st = [], touch = [];
  for (const n of dropN) { const r = rows[n - 1]; touch.push(r); st.push(env.DB.prepare('DELETE FROM shots WHERE id=?').bind(r.id)); }
  for (const f of fixes) { const r = rows[+f.n - 1]; touch.push(r); st.push(env.DB.prepare('UPDATE shots SET en=? WHERE id=?').bind(f.en.trim().slice(0, 600), r.id)); }
  for (const r of touch) { // งาน/ภาพเดิมของช็อตที่ถูกตัดหรือแก้ ไม่ใช้แล้ว (ช็อตที่แก้จะถูกส่งวาดใหม่เอง)
    st.push(env.DB.prepare("DELETE FROM jobs WHERE project=? AND status IN ('queued','kaggle')").bind(r.kproj));
    st.push(env.DB.prepare("DELETE FROM vjobs WHERE project=? AND kind='img' AND status='queued'").bind(r.kproj));
    st.push(env.DB.prepare('DELETE FROM images WHERE project=?').bind(r.kproj));
  }
  for (let i = 0; i < st.length; i += 20) await env.DB.batch(st.slice(i, i + 20));
  return { cut: dropN.length, fix: fixes.length };
}
// เขียนบทพูดไทยรายช็อต (ใช้อ่านแบบเว็บตูน · ต่อไปใช้ทำซับและเสียงพากย์) — ทำครั้งเดียวต่อซีนหลังตัดช็อตแล้ว
// ใบสั่งงานผู้กำกับรายช็อต (เก็บใน say.dir) — ตัดให้สั้น กันข้อมูลบวม
function dirSay(d, sid, n) { if (!d || typeof d !== 'object') return null; const o = { id: `S${sid}-${String(n).padStart(2, '0')}` }; for (const k of ['kind', 'genre', 'shot', 'angle', 'move', 'act', 'face', 'env', 'light', 'mood', 'sfx', 'bgm', 'anim']) if (d[k]) o[k] = String(d[k]).slice(0, 120); if (+d.dur) o.dur = Math.min(20, Math.max(1, +d.dur)); if (d.vp) o.vp = String(d.vp).slice(0, 400); return JSON.stringify({ lines: [], dir: o }); }
async function sbSay(env, s, sid) {
  const rows = (await env.DB.prepare('SELECT id,th,chars,say FROM shots WHERE script_id=? ORDER BY idx').bind(sid).all()).results; if (!rows.length) return 0;
  for (const r of rows) { try { r.dir = (JSON.parse(r.say || '{}') || {}).dir || null; } catch (e) { r.dir = null; } }
  const sc = await env.DB.prepare('SELECT body FROM scripts WHERE id=?').bind(sid).first();
  const o = await llmJson(env, s, `บทของซีนนี้: ${String((sc && sc.body) || '').slice(0, 3000)}\n\nสตอรีบอร์ดเรียงตามลำดับ (เลข: เหตุการณ์ [ตัวละครในช็อต])\n${rows.map((r, i) => `${i + 1}: ${r.th} ${r.chars || '[]'}${r.dir ? ` {แนว ${r.dir.genre || '-'} · อารมณ์ที่ต้องการ: ${r.dir.mood || '-'}}` : ''}`).join('\n')}\n\nเขียนซับภาษาไทยแบบอนิเมะที่ใช้ภาพนิ่ง: ภาพหนึ่งค้างไว้ แล้วซับขึ้นทีละบรรทัด\n- แต่ละช็อตมี 1-3 บรรทัด (lines) บรรทัดละไม่เกิน 40 ตัวอักษร\n- บทพูด: who = ชื่อตัวละครที่อยู่ในช็อตนั้น ฉากสนทนาให้สลับกันพูดโต้ตอบบ่อยๆ (ถ้าทั้งคู่อยู่ในช็อตเดียวกัน สลับคนพูดในช็อตเดียวได้) ประโยคสั้น เป็นธรรมชาติ มีอารมณ์ ไม่ใช่คำห้วนคำเดียว\n- คำบรรยาย/ความคิด/เล่าสถานการณ์: who = "" แบ่งเป็นท่อนสั้นๆ ค่อยๆ เล่าทีละนิด · บรรทัดบรรยายใส่ "nv" บอกโทนของผู้บรรยาย (narrator เล่าเรื่องอบอุ่น · n_cine ภาพยนตร์ · n_anime อนิเมะ/ตลก · n_dark มืดหม่น/สยอง · n_doc สารคดี/อธิบายโลก · n_emo อารมณ์ลึกซึ้ง · n_epic ยิ่งใหญ่/ฉากสู้) ถ้าเรื่องมีตัวช่วยเล่าเรื่อง (สัตว์/มาสคอต) ให้บางบรรทัดเป็นมุมมองของมัน แซว/สรุป/พาเรื่องเดิน ด้วย "nv":"companion"\n- ต่อเนื่องกันทั้งซีน อ่านแล้วเข้าใจเรื่องโดยไม่ต้องมีเสียง ช็อตแอ็กชันล้วนให้ lines ว่างได้\n- เฉพาะช็อตหน้ามีม/จังหวะตลก/อารมณ์พุ่ง ใส่ตัวหนังสือลอยได้ (ช็อตปกติไม่ต้องใส่): think = ความคิดในใจสั้นๆ ไม่เกิน 18 ตัวอักษร (เช่น "ตื่นเต้นสุดๆ!" "ซวยแล้ว...") · ono = คำเสียงประกอบแบบมังงะ ไม่เกิน 8 ตัวอักษร (เช่น "ตึกตัก!" "ปิ๊ง!" "เงียบ..." "ฮึ่ม!")\nตอบเป็น JSON array: [{"n":เลขช็อต,"lines":[{"who":"ชื่อคนพูด หรือ \"\"","say":"ข้อความ"}],"think":"","ono":""}]`);
  const arr = Array.isArray(o) ? o : (o && Array.isArray(o.shots) ? o.shots : []), st = [];
  for (const x of arr) {
    const r = rows[+x.n - 1]; if (!r) continue;
    const ls = (Array.isArray(x.lines) ? x.lines : (x.say ? [x] : [])).filter(l => l && typeof l.say === 'string' && l.say.trim()).slice(0, 3).map(l => ({ who: String(l.who || '').slice(0, 40), say: l.say.trim().slice(0, 120), ...(!l.who && /^(narrator|n_cine|n_anime|n_dark|n_doc|n_emo|n_epic|companion)$/.test(String(l.nv || '')) ? { nv: String(l.nv) } : {}) }));
    const think = typeof x.think === 'string' ? x.think.trim().slice(0, 40) : '', ono = typeof x.ono === 'string' ? x.ono.trim().slice(0, 14) : '';
    if (!ls.length && !think && !ono) continue;
    st.push(env.DB.prepare('UPDATE shots SET say=? WHERE id=?').bind(JSON.stringify({ who: ls[0] ? ls[0].who : '', say: ls[0] ? ls[0].say : '', lines: ls, ...(think ? { think } : {}), ...(ono ? { ono } : {}), ...(r.dir ? { dir: r.dir } : {}) }), r.id));
  }
  for (let i = 0; i < st.length; i += 20) await env.DB.batch(st.slice(i, i + 20));
  return st.length;
}
async function epStart(env, story, plan, E) { // สร้างซีรีส์ + 3 ซีนของตอนนี้ แล้วเปิดให้ animeAdvance (cron ทุกนาที) ทำต่อเองจนครบ
  await animeSchema(env);
  const brief = [`เรื่อง: ${plan.title || story}`, plan.overview || '', plan.rule ? 'กติกาทุกตอน: ' + plan.rule : '', 'ตัวละคร: ' + plan.roles.map(r => `${r.key} (${r.kind}${r.age ? ', ' + r.age + ' ปี' : ''}) ${r.look}`).join(' | ')].filter(Boolean).join('\n').slice(0, 14000);
  let sr = await env.DB.prepare('SELECT * FROM series WHERE title=?').bind(story).first();
  if (!sr) { const r = await env.DB.prepare('INSERT INTO series (title,brief,created) VALUES (?,?,?)').bind(story, brief, Date.now()).run(); sr = { id: r.meta.last_row_id, title: story }; }
  else await env.DB.prepare('UPDATE series SET brief=? WHERE id=?').bind(brief, sr.id).run();
  const ex = (await env.DB.prepare('SELECT id FROM scenes WHERE series_id=? AND ep=?').bind(sr.id, E.no).all()).results;
  if (!ex.length) {
    const f = E.f || {}, mood = f['อารมณ์'] ? ` อารมณ์: ${f['อารมณ์']}` : '', rule = plan.rule ? ` (${plan.rule})` : '';
    const W = await workOf(env, story);
    const sc = W.scenes === 1 ? [{ title: E.title, logline: `${Object.entries(f).map(([k, v]) => k + ': ' + v).join(' · ') || E.title}${rule}` }] : [
      { title: `${E.title} · ซีน 1 เปิดเรื่อง`, logline: `${f['เรื่อง'] || f['คดี'] || E.title}${rule}${mood}` },
      { title: `${E.title} · ซีน 2 สืบสวน`, logline: `${f['คดี'] || f['เรื่อง'] || E.title}${mood}` },
      { title: `${E.title} · ซีน 3 ฉากสู้และจบตอน`, logline: `ฉากสู้: ${f['ฉากสู้'] || '-'} จบตอน: ${f['จบตอน'] || '-'}${mood}` }];
    await env.DB.batch(sc.map((x, i) => env.DB.prepare('INSERT INTO scenes (series_id,ep,sc,no,title,logline,auto,created) VALUES (?,?,?,?,?,?,1,?)').bind(sr.id, E.no, i + 1, (E.no - 1) * 3 + i + 1, x.title.slice(0, 80), x.logline.slice(0, 400), Date.now())));
  } else await env.DB.prepare('UPDATE scenes SET auto=1 WHERE series_id=? AND ep=? AND fin=0').bind(sr.id, E.no).run();
  const cur = +((await getSettings(env))['anime_ok_' + sr.id]) || 0; if (cur < E.no - 1) await setSetting(env, 'anime_ok_' + sr.id, String(E.no - 1));
  return sr.id;
}
async function epWaiting(env) { // ตอนที่รอ LoRA ตัวหลัก: พร้อมเมื่อไหร่เริ่มทำให้เอง
  const rows = (await env.DB.prepare("SELECT key,value FROM settings WHERE key LIKE 'epst:%'").all()).results;
  for (const r of rows) {
    let st; try { st = JSON.parse(r.value); } catch (e) { continue; }
    const story = r.key.slice(5); let ch = false;
    for (const [no, v] of Object.entries(st)) {
      if (!v || v.status !== 'waiting') continue;
      const plan = await readPlan(env, story), E = plan && plan.eps.find(x => x.no === +no); if (!E) continue;
      const ck = v.nolora ? { miss: [], nol: [] } : await epCheck(env, story, plan, E); if ((ck.miss.length && !v.gate) || ck.nol.length) continue; // โหมดสตอรีบอร์ด: ตัวรองไม่ต้องมีนักแสดง
      const sid = await epStart(env, story, plan, E); st[no] = { status: 'running', series: sid, at: Date.now(), all: !!v.all, ...(v.gate ? { gate: v.gate } : {}) }; if (v.all) await setSetting(env, 'anime_ok_' + sid, '99'); ch = true;
    }
    if (ch) await setSetting(env, r.key, JSON.stringify(st));
  }
}
// ซีรีส์ 12 ตอน × 3 ซีน: เขียนบทซีน (ตอนละ ~5 นาที) จากโครงเรื่อง
async function epWrite(env, s, e) {
  const sr = await env.DB.prepare('SELECT * FROM series WHERE id=?').bind(e.series_id).first();
  const cs = (await env.DB.prepare('SELECT name,desc FROM chars WHERE series_id=?').bind(e.series_id).all()).results.concat(await castList(env, sr));
  const pv = await env.DB.prepare('SELECT logline FROM scenes WHERE series_id=? AND no=?').bind(e.series_id, e.no - 1).first();
  const nx = await env.DB.prepare('SELECT logline FROM scenes WHERE series_id=? AND no=?').bind(e.series_id, e.no + 1).first();
  const W = await workOf(env, sr ? sr.title : '');
  const o0 = await llmJson(env, s, `เรื่อง: ${sr ? sr.brief : ''}\n${W.note}\nตัวละคร: ${cs.map(c => c.name + ' = ' + c.desc).join(' | ') || '-'}\nตอนที่ ${e.ep} ซีนที่ ${e.sc}/${W.scenes}: ${e.title} — ${e.logline}\nซีนก่อนหน้า: ${pv ? pv.logline : '-'}\nซีนถัดไป: ${nx ? nx.logline : '-'}\nเขียนบทซีนนี้ตามโครงเรื่องของตอนนั้น (ซีนนี้จะแตกเป็นภาพราว ${W.shots} ช็อต${W.scenes > 1 ? ' และ ' + W.scenes + ' ซีนต่อเนื่องกันเป็น 1 ตอน' : ''}) ตอบเป็น JSON object {"title":"ชื่อตอน","logline":"สรุป","beats":["เหตุการณ์ตามลำดับเวลา ${W.beats} ข้อ"]}`);
  const o = Array.isArray(o0) ? o0[0] : o0;
  if (!o || !Array.isArray(o.beats) || !o.beats.length) throw new Error('เขียนบทไม่สำเร็จ ลองใหม่');
  o.title = o.title || e.title;
  const r = await env.DB.prepare('INSERT INTO scripts (series_id,body,picked,created) VALUES (?,?,1,?)').bind(e.series_id, JSON.stringify(o).slice(0, 8000), Date.now()).run();
  await env.DB.prepare('UPDATE scenes SET script_id=?, sb=0 WHERE id=?').bind(r.meta.last_row_id, e.id).run();
  return r.meta.last_row_id;
}
// ช็อตสำคัญ (ฉากสู้/เคลื่อนไหว/ช็อตเปิดทุก 5 ช็อต) ทำเป็นวิดีโอ ที่เหลือใช้ภาพนิ่งซูมเลื่อน
// ช็อตที่ทำเป็นคลิปขยับ: ทุกช็อตที่ 5 · ช็อตแอ็กชัน · ช็อตที่ตัวละครในภาพเป็นคนพูด (ปากขยับ) — ช็อตบรรยาย/เล่าสถานการณ์ใช้ภาพนิ่งซูมช้า
const speakShot = sh => { try { const y = JSON.parse(sh.say || '{}') || {}, c = JSON.parse(sh.chars || '[]'), ls = Array.isArray(y.lines) ? y.lines : [y]; return Array.isArray(c) && ls.some(l => l && l.who && l.say && c.includes(l.who)); } catch (e) { return false; } };
let VALL = true, HELPN = 0; // คุณภาพสูงสุด: ทุกช็อตขยับ (ปิดได้ที่ settings v_all=0)
const keyShot = (sh, i) => VALL || i % 5 === 0 || /fight|battle|chase|run|jump|attack|talisman|glow|explo|seal|spell|leap|punch/i.test(sh.en || '') || speakShot(sh) || !!+sh.chain;
// ทำงานต่อเองทีละขั้นต่อรอบ cron: บท → ช็อต → ภาพคีย์ → วิดีโอ → รวมตอน (ทีละตอน เรียงตามลำดับ เพราะ GPU ฟรีมีจำกัด)
async function animeAdvance(env, s) {
  if (s.auto_anime === '0') return;
  VALL = s.v_all !== '0';
  await animeSchema(env);
  await epWaiting(env);
  await epAssemble(env, s).catch(() => {});
  const list = (await env.DB.prepare('SELECT * FROM scenes WHERE auto=1 AND fin=0 ORDER BY series_id,no').all()).results.filter(x => x.ep <= (+s['anime_ok_' + x.series_id] || 0) + 1); // ทำทีละตอน: ตอนถัดไปเริ่มเมื่อผู้ใช้กดตรวจผ่านตอนก่อน
  const meta = {};
  for (const e of list) {
    const m = meta[e.series_id] || (meta[e.series_id] = await (async () => { const sr = await env.DB.prepare('SELECT title FROM series WHERE id=?').bind(e.series_id).first(), t = sr ? sr.title : ''; return { title: t, W: await workOf(env, t), st: await epstOf(env, t) }; })());
    if (!e.script_id) { await epWrite(env, s, e); return; }
    const sid = e.script_id;
    const gsb = ((m.st[e.ep] || {}).gate) === 'sb';
    if (e.sb >= 0 && gsb) { // โหมดสตอรีบอร์ด: เขียนเป็นช่องมังงะ (ภาพ + บทพูดพร้อมกัน) แล้วอ่านทวนเติมช่องที่ขาด — ไม่ใช้ตัวตัดช็อต/ตัวเติมบทพูดรุ่นเก่า
      const fk = 'sbfail:' + sid, [fn, ft] = String(s[fk] || '0|0').split('|').map(Number);
      if (fn >= 3 && Date.now() - ft < 30 * 60000) continue; // พลาด 3 ครั้งติด: พักซีนนี้ 30 นาที ไม่วนเรียก AI ทุกนาที (เคยวนค้าง 5 ชม.)
      let r; try { r = await animeApi(env, { act: 'sb_panels', script_id: sid, beat: e.sb, shots: m.W.shots }); }
      catch (x) { await setSetting(env, fk, (fn >= 3 ? 1 : fn + 1) + '|' + Date.now()); await env.DB.prepare('INSERT INTO vlog (msg,created) VALUES (?,?)').bind(`⚠️ เขียนสตอรีบอร์ดซีน ${sid} เหตุการณ์ ${e.sb + 1} ไม่สำเร็จ: ${String(x && x.message || x).slice(0, 300)}`, Date.now()).run().catch(() => { }); return; }
      if (fn) await env.DB.prepare('DELETE FROM settings WHERE key=?').bind(fk).run();
      if (r.next < 0) { await setSetting(env, 'sbfix:' + sid, '0,0'); await setSetting(env, 'sbsay:' + sid, 'v2'); await env.DB.prepare("DELETE FROM settings WHERE key IN (?,?)").bind('sbrev:' + sid, 'sbdone:' + sid).run(); }
      await env.DB.prepare('UPDATE scenes SET sb=? WHERE id=?').bind(r.next, e.id).run(); return; }
    if (e.sb >= 0) { const r = await animeApi(env, { act: 'sb_beat', script_id: sid, beat: e.sb, shots: m.W.shots }); await env.DB.prepare('UPDATE scenes SET sb=? WHERE id=?').bind(r.next, e.id).run(); return; }
    if (gsb && s['sbsay:' + sid] === 'v2' && s['sbrev:' + sid] == null) { let r = { edit: 0, add: 0 }; try { const pl = await readPlan(env, m.title), names = ((pl && pl.roles) || []).filter(x => x.tier !== 'none').map(x => x.key), places = ((pl && pl.locs) || []).map(l => l.name); r = await sbReview(env, s, sid, names, places); } catch (x) { } await setSetting(env, 'sbrev:' + sid, r.edit + ',' + r.add); return; }
    if (gsb && s['sbfix:' + sid] == null) { let r = { cut: 0, fix: 0 }; try { r = await sbTighten(env, s, sid); } catch (x) { } await setSetting(env, 'sbfix:' + sid, r.cut + ',' + r.fix); return; } // แตกช็อตครบ → ให้ AI ตรวจตัดช็อตซ้ำ/แก้มุมกล้องก่อนวาด
    if (gsb && s['sbsay:' + sid] == null) { let n = 0; try { n = await sbSay(env, s, sid); } catch (x) { } await setSetting(env, 'sbsay:' + sid, String(n)); return; } // บทพูดรายช็อต
    if (gsb && s['sbdone:' + sid] === '1') continue; // ซีนนี้ภาพครบและตรวจแล้ว รออนุมัติ: ไม่ต้องอ่านอะไรอีก
    const rows = (await env.DB.prepare('SELECT id,en,kproj,say,chars,chain FROM shots WHERE script_id=? ORDER BY idx').bind(sid).all()).results;
    const hasImg = (await env.DB.prepare('SELECT COUNT(*) n FROM shots s WHERE s.script_id=? AND EXISTS (SELECT 1 FROM images i WHERE i.project=s.kproj)').bind(sid).first()).n;
    if (hasImg < rows.length) {
      const need = (await env.DB.prepare("SELECT COUNT(*) n FROM shots s WHERE s.script_id=? AND NOT EXISTS (SELECT 1 FROM images i WHERE i.project=s.kproj) AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.project=s.kproj AND j.status IN ('queued','running','kaggle'))").bind(sid).first()).n;
      if (!need) continue; // ทุกช็อตที่ขาดภาพเข้าคิวแล้ว: รอวาด
      const r = await animeApi(env, { act: 'kf', script_id: sid }); if (r.queued) return; continue; } // ภาพคีย์เข้าคิวครบแล้ว → ไปเตรียมซีนถัดไประหว่างรอวาด
    if (gsb) { if (!m.qc) { m.qc = 1; const q = await qcRun(env, m.title, 4, sid).catch(() => null); if (q && !q.left && !(q.eps || []).some(E => E.fixing)) await setSetting(env, 'sbdone:' + sid, '1'); } continue; } // ระหว่างรอ: AI ตรวจภาพทีละ 4 ใบ ภาพเสียลบแล้ววาดใหม่เอง (สูงสุด 2 รอบต่อช็อต) · สตอรีบอร์ดซีนนี้ครบแล้ว: รอผู้ใช้กดอนุมัติก่อนทำคลิป (ระหว่างนี้ไปทำซีนถัดไปของตอนเดียวกัน)
    if ((m.st[e.ep] || {}).still) { await env.DB.prepare('UPDATE scenes SET fin=1 WHERE id=?').bind(e.id).run(); return; } // ฉบับภาพนิ่ง: ข้ามขั้นทำคลิป ไปรวมตอนเลย
    const q = await animeApi(env, { act: 'vid', script_id: sid });
    let miss = false;
    for (const [i, sh] of rows.entries()) { if (!keyShot(sh, i)) continue; const v = await env.DB.prepare('SELECT MAX(id) id FROM videos WHERE ep=? AND shot=?').bind('a' + sid, String(sh.id)).first(); if (!v || !v.id) { miss = true; break; } }
    if (miss) { if (q.queued) return; continue; }
    await env.DB.prepare('UPDATE scenes SET fin=1 WHERE id=?').bind(e.id).run(); return;
  }
}
// ทุกซีนของตอนเสร็จ → เข้าคิวรวมเป็นไฟล์ตอนเดียว (ช็อตที่มีคลิปใช้คลิป ช็อตที่เหลือใช้ภาพนิ่งซูมช้า) · ทำเฉพาะตอนที่สั่งจากสตูดิโอ
async function epAssemble(env, s) {
  const og = s.self_url; if (!og) return;
  const done = (await env.DB.prepare('SELECT series_id sid, ep, MIN(fin) mf FROM scenes WHERE auto=1 AND script_id>0 GROUP BY series_id, ep HAVING mf=1').all()).results;
  for (const d of done) {
    const key = 'E' + d.sid + 'x' + d.ep;
    if ((await env.DB.prepare("SELECT COUNT(*) n FROM videos WHERE ep=? AND shot='final'").bind(key).first()).n) continue;
    const vj = await env.DB.prepare("SELECT COUNT(*) n, COALESCE(SUM(status IN ('queued','running')),0) live FROM vjobs WHERE ep=? AND kind='epcat'").bind(key).first();
    if (+vj.live || +vj.n >= 3) continue;
    const sr = await env.DB.prepare('SELECT title FROM series WHERE id=?').bind(d.sid).first(); if (!sr) continue;
    const st = await epstOf(env, sr.title); if (!st[d.ep] || st[d.ep].status !== 'running') continue;
    const urls = []; // แต่ละช็อต: ไฟล์ภาพ/คลิป + บทพูด (ทำซับ) · เสียงพากย์จะเติมช่อง vo เมื่อระบบเสียงพร้อม
    for (const sc of (await env.DB.prepare('SELECT script_id FROM scenes WHERE series_id=? AND ep=? ORDER BY sc').bind(d.sid, d.ep).all()).results) {
      for (const sh of (await env.DB.prepare('SELECT id,kproj,say,en,chain FROM shots WHERE script_id=? ORDER BY idx').bind(sc.script_id).all()).results) {
        let sy = {}; try { sy = JSON.parse(sh.say || '{}') || {}; } catch (x) { sy = {}; }
        const it = { lines: (Array.isArray(sy.lines) ? sy.lines : (sy.say ? [{ who: String(sy.who || ''), say: String(sy.say) }] : [])).map(l => String(l.who || '')[0] === '~' ? { who: '', say: '(' + String(l.who).slice(1) + ' ในใจ) ' + String(l.say || '') } : l), /* ความคิดในใจ (~ชื่อ) → ซับวงเล็บ */ think: String(sy.think || ''), ono: String(sy.ono || ''), en: String(sh.en || '').slice(0, 220), ...(+sh.chain ? { chain: 1 } : {}) }; // en: ใช้เลือกวิธีขยับกล้องและเอฟเฟกต์ฉากสู้ตอนรวมตอน
        const v = await env.DB.prepare('SELECT MAX(id) id FROM videos WHERE ep=? AND shot=?').bind('a' + sc.script_id, String(sh.id)).first();
        if (v && v.id) { urls.push({ u: og + '/vv/' + v.id + '?s=' + await vvSig(env, v.id), ...it }); continue; }
        const im = await env.DB.prepare('SELECT MAX(id) id FROM images WHERE project=?').bind(sh.kproj).first();
        if (im && im.id) urls.push({ u: og + '/vi/' + im.id + '?s=' + await vvSig(env, 'i' + im.id), ...it });
      }
    }
    if (!urls.length || urls.length > 400) continue;
    const plan = await readPlan(env, sr.title).catch(() => null), PE = plan && plan.eps.find(x => x.no === +d.ep);
    const spec = { v: 2, title: String((plan && plan.title) || sr.title).split('\n')[0].slice(0, 60), ep: +d.ep, eptitle: PE ? String(PE.title).slice(0, 80) : '', items: urls, bgm: '', credits: ['ภาพและแอนิเมชัน: สร้างด้วย AI', 'ผลิตโดย ' + String(s.studio_name || 'SMART SHOP')] };
    await env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,kind,opt) VALUES (?,?,'final',?,'','',0,'queued',0,?,'epcat',?)").bind(('ตอน·' + sr.title + '·' + d.ep).slice(0, 60), key, JSON.stringify(spec), Date.now(), JSON.stringify({ still: 2.2, crf: 26, fps: 24 })).run();
  }
}
async function animeApi(env, b) {
  await animeSchema(env);
  const act = b.act || 'list', s = await getSettings(env);
  const shape = '{"title":"ชื่อซีน","logline":"สรุป 1-2 ประโยค","beats":["เหตุการณ์ตามลำดับเวลา"]}';
  if (act === 'new') {
    const brief = String(b.brief || '').trim().slice(0, 14000); if (!brief) throw new Error('พิมพ์ก่อนว่าอยากได้อนิเมะแบบไหน');
    const r = await env.DB.prepare('INSERT INTO series (title,brief,created) VALUES (?,?,?)').bind(String(b.title || '').slice(0, 80) || brief.slice(0, 40), brief, Date.now()).run();
    return { id: r.meta.last_row_id };
  }
  if (act === 'ideas') {
    const sr = await env.DB.prepare('SELECT * FROM series WHERE id=?').bind(+b.series_id).first(); if (!sr) throw new Error('ไม่พบซีรีส์');
    const n = Math.min(4, Math.max(1, +b.n || 3));
    const arr = await llmJson(env, s, `แนวอนิเมะที่ต้องการ: ${sr.brief}\n${b.extra ? 'เพิ่มเติม: ' + String(b.extra).slice(0, 500) + '\n' : ''}เสนอบทสำหรับ 1 ซีน (ยาวราว 5 นาที) จำนวน ${n} แบบที่ต่างกัน ตอบเป็น JSON array ของ ${shape} โดย beats มี 6-10 ข้อ`);
    const list = (Array.isArray(arr) ? arr : [arr]).slice(0, n);
    await env.DB.batch(list.map(x => env.DB.prepare('INSERT INTO scripts (series_id,body,created) VALUES (?,?,?)').bind(sr.id, JSON.stringify(x).slice(0, 8000), Date.now())));
    return { ok: true, added: list.length };
  }
  if (act === 'edit') {
    const sc = await env.DB.prepare('SELECT * FROM scripts WHERE id=?').bind(+b.id).first(); if (!sc) throw new Error('ไม่พบบท');
    const cmd = String(b.command || '').trim().slice(0, 600); if (!cmd) throw new Error('พิมพ์คำสั่งแก้ก่อน');
    const o = await llmJson(env, s, `บทปัจจุบัน: ${sc.body}\nคำสั่งแก้: ${cmd}\nแก้บทตามคำสั่ง แล้วตอบเป็น JSON object ${shape}`);
    await env.DB.prepare('UPDATE scripts SET body=?, ver=ver+1 WHERE id=?').bind(JSON.stringify(Array.isArray(o) ? o[0] : o).slice(0, 8000), sc.id).run();
    return { ok: true };
  }
  if (act === 'pick') { const sc = await env.DB.prepare('SELECT series_id FROM scripts WHERE id=?').bind(+b.id).first(); if (sc) await env.DB.batch([env.DB.prepare('UPDATE scripts SET picked=0 WHERE series_id=?').bind(sc.series_id), env.DB.prepare('UPDATE scripts SET picked=1 WHERE id=?').bind(+b.id)]); return { ok: true }; }
  if (act === 'del') { await env.DB.prepare('DELETE FROM scripts WHERE id=?').bind(+b.id).run(); return { ok: true }; }
  if (act === 'char_new') {
    const name = String(b.name || '').trim().slice(0, 40), desc = String(b.desc || '').trim().slice(0, 600);
    if (!name || !desc) throw new Error('ใส่ชื่อและลักษณะตัวละครก่อน');
    const r = await env.DB.prepare('INSERT INTO chars (series_id,name,desc,created) VALUES (?,?,?,?)').bind(+b.series_id, name, desc, Date.now()).run();
    return { id: r.meta.last_row_id, ...(await charRefs(env, r.meta.last_row_id, 16)) };
  }
  if (act === 'char_refs') return await charRefs(env, +b.char_id, Math.min(16, +b.n || 8));
  if (act === 'char_del') {
    const c = await env.DB.prepare('SELECT * FROM chars WHERE id=?').bind(+b.char_id).first();
    if (c) await env.DB.batch([env.DB.prepare('DELETE FROM images WHERE project=?').bind(charProj(c)), env.DB.prepare("DELETE FROM jobs WHERE project=? AND status IN ('queued','failed')").bind(charProj(c)), env.DB.prepare('DELETE FROM chars WHERE id=?').bind(c.id)]);
    return { ok: true };
  }
  if (act === 'sb_beat') { // แตกบทเป็นช็อตทีละเหตุการณ์ (หน้าเว็บเรียกวนจนครบ)
    const sc = await env.DB.prepare('SELECT * FROM scripts WHERE id=?').bind(+b.script_id).first(); if (!sc) throw new Error('ไม่พบบท');
    let o = {}; try { o = JSON.parse(sc.body); } catch { o = {}; }
    const beats = o.beats || [], bi = +b.beat || 0; if (!beats.length) throw new Error('บทนี้ยังไม่มีเหตุการณ์');
    if (bi === 0) await env.DB.batch([env.DB.prepare('DELETE FROM shots WHERE script_id=?').bind(sc.id), env.DB.prepare('DELETE FROM images WHERE project LIKE ?').bind(`ฉาก${sc.id}·%`)]);
    const sr = await env.DB.prepare('SELECT * FROM series WHERE id=?').bind(sc.series_id).first();
    const xs = sr ? (await env.DB.prepare("SELECT name,desc,kind FROM chars WHERE story=? AND kind IN ('enemy','place')").bind(sr.title).all().catch(() => ({ results: [] }))).results : [], places = xs.filter(x => x.kind === 'place').map(x => x.name);
    const cs = (await env.DB.prepare('SELECT name,desc FROM chars WHERE series_id=?').bind(sc.series_id).all()).results.concat(await castList(env, sr)).concat(xs.filter(x => x.kind === 'enemy').map(x => ({ name: x.name, desc: 'ศัตรู/ตัวประหลาด: ' + x.desc })));
    const total = +b.shots > 0 ? Math.min(180, +b.shots) : 12 * Math.min(15, Math.max(1, +b.minutes || 5)), N = Math.min(10, Math.max(2, Math.ceil(total / beats.length)));
    const canon = sr ? await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('canon:' + sr.title).first() : null;
    const arr = await llmJson(env, s, `ซีรีส์: ${sr ? sr.brief : ''}\n${canon ? 'ความต่อเนื่องที่ต้องรักษา (ห้ามขัดแย้ง: ตัวละคร สิ่งของ เวลา ความสัมพันธ์): ' + String(canon.value).slice(0, 1500) + '\n' : ''}ตัวละคร: ${cs.map(c => c.name + ' = ' + c.desc).join(' | ') || '-'}\nชื่อซีน: ${o.title || ''}\nเหตุการณ์ที่ ${bi + 1}/${beats.length}: ${beats[bi]}\nเขียน ${N} ช็อตต่อเนื่องของเหตุการณ์นี้ (ช็อตละราว 2-4 วินาที ระบุมุมกล้องและการกระทำ · ฉากสนทนาให้สลับช็อตระหว่างคนพูดกับคนฟัง (shot / reverse shot) ใช้โคลสอัพหน้าคนพูดสลับกับภาพสองคน ช็อตหนึ่งมีคนพูดหลักคนเดียว แต่ละช็อตต้องบอกสีหน้าอารมณ์ให้ชัดใน prompt ภาพ (เช่น bright smile with closed eyes, blushing, pouting, wide-eyed surprise, teary eyes) และเปลี่ยนสีหน้าไปตามบทสนทนา ทุกช็อตต้องวาดฉากหลังของสถานที่จริงให้ครบเสมอ ห้ามพื้นหลังเรียบหรือว่าง ช็อตจังหวะอารมณ์/ตลก/เขิน ให้เติมเอฟเฟกต์ซ้อนบนฉากจริงแทน (sparkles, floating hearts, gloomy vertical lines over the scene) ภาพหนึ่งค้างได้นานพอให้ซับขึ้น 2-3 บรรทัด จึงไม่ต้องแตกช็อตถี่ในฉากคุย · จังหวะตลก/เหวอ/เขินจัด/โมโห ให้ใส่ "หน้ามีม" ของตัวละครเราเองได้ 1-3 ช็อตต่อซีน (เฉพาะจังหวะที่เข้ากับเรื่อง ไม่ใส่ในฉากเครียดหรือฉากสู้จริงจัง): เขียน prompt เป็นหน้ารีแอ็กชันเกินจริงแบบการ์ตูน เช่น chibi super-deformed reaction face, blank white eyes with a shocked open mouth, tiny dot eyes with a sweat drop, sparkling star eyes, deadpan half-lidded stare, smug cat-like grin, comical angry vein mark, gloomy blue lines over the face, simplified comedic drawing with squinting eyes and a huge open-mouth laugh with both hands raised, drawn inside the real location of the scene with the background fully drawn คงทรงผมและสีผมของตัวละครนั้นไว้ · ฉากต่อสู้ให้เล่าเป็นลำดับ: ศัตรูปรากฏ/ตั้งท่า → พุ่งเข้าโจมตี → ป้องกันหรือหลบ → ปะทะ (ช็อต impact) → ผลลัพธ์ → ช็อตพักภาพกว้างนิ่งๆ (ท้องฟ้า ฝุ่นจาง) → โคลสอัพหน้านิ่งของผู้ชนะพร้อมบทพูดสั้น ใช้ช็อตสั้นหลายมุม (wide, low angle, close-up, over-the-shoulder) บอกเอฟเฟกต์เวท/แรงปะทะใน prompt ให้ชัด (glowing talisman barrier, energy slash, shockwave, debris, sparks) · ท่าที่ต้องเห็นการเคลื่อนไหวต่อเนื่อง (เช่น เงื้อ → ฟันลง → ศัตรูกระเด็น) ให้เขียนเป็นช็อตติดกัน 2-4 ช็อตที่ "มุมกล้องเดียวกัน ฉากหลังเดียวกัน ตัวละครชุดเดียวกัน เปลี่ยนแค่ท่า" โดย prompt ต้องขึ้นต้นด้วยคำบรรยายฉากและมุมกล้องที่เหมือนกันทุกตัวอักษร แล้วตามด้วยท่าที่ต่างกัน และใส่ "chain":true ในช็อตที่ต่อจากช็อตก่อนหน้า) · ทั้งตอนต้องมีครบทุกแนวตามที่เรื่องเปิดให้ (ตกใจ/จัมป์สแกร์ · เล่าเรื่องน่ากลัว · ตลก · มีม · เซอร์วิสเบาๆ แบบไม่ตั้งใจและสุภาพ ไม่โป๊ · กวนๆ · ข้อคิด/จิตวิทยา · ดราม่า · แอ็กชัน · อบอุ่น) เลือกแนวที่เข้ากับเหตุการณ์นี้ และใช้มุมกล้อง/เทคนิคภาพให้ถึงอารมณ์แนวนั้น: ตกใจ = ความเงียบก่อน แล้วโคลสอัพพุ่งเข้าหาคนดู · น่ากลัว = มุมกว้างมืด แสงต่ำ ช็อตเงียบนิ่ง · ตลก = จิบิ/หน้าเกินจริง ซูมกระแทก · มีม = ภาพแบ่งครึ่งเทียบ/หน้าโหลดไม่ขึ้น · กวน = โคลสอัพยิ้มมุมปาก · ข้อคิด = ช็อตเชิงสัญลักษณ์ เงาสะท้อน · แอ็กชัน = มุมต่ำ เส้นความเร็ว · อย่าใช้ช็อต+มุมเดียวกันเกิน 2 ช่องติดกัน · ตรวจก่อนตอบ: เรื่องต่อเนื่องไหม ตัวละครอยู่ตำแหน่งสมเหตุผลไหม มุมกล้องเข้ากับอารมณ์ไหม มีช็อตซ้ำไหม เปลี่ยนสถานที่ต้องมีช็อตเชื่อม — แก้ก่อนตอบ · ตอบเป็น JSON array ของ {"th":"คำอธิบายช็อตภาษาไทยสั้นๆ","en":"English image prompt: setting, action, camera angle (no character names, no hair/clothes details)","chars":["ชื่อตัวละครที่อยู่ในช็อต"],"chain":false,"loc":"","dir":{"kind":"ประเภทซีน เช่น Establishing/Dialogue Scene/Reaction Scene/Action Scene/Silent Scene/Comedy Scene/Emotional Scene/Climax Scene/Transition Scene/Ending Scene","genre":"แนว (ภาษาไทย)","shot":"Wide/Medium/Close-up/Extreme Close-up/Over-the-Shoulder/POV","angle":"มุมกล้อง","move":"การเคลื่อนกล้อง","act":"การกระทำ","face":"สีหน้า","light":"แสง","dur":3,"mood":"อารมณ์ที่ต้องการให้คนดูรู้สึก","sfx":"เสียงประกอบ","bgm":"ดนตรีพื้นหลัง","anim":"การเคลื่อนไหว ตัว/หน้า/ตา/ผม/เสื้อ/ฉาก","vp":"English video prompt: camera movement + motion"}}${places.length ? ` · loc = ชื่อสถานที่จากรายการนี้ถ้าช็อตเกิดที่นั่น (${places.join(" | ")}) ไม่งั้นเว้นว่าง` : ''} · ถ้ามีศัตรู/ตัวประหลาดในช็อต ให้ใส่ชื่อมันใน chars ด้วย`);
    const list = (Array.isArray(arr) ? arr : [arr]).slice(0, N);
    const base = (await env.DB.prepare('SELECT COUNT(*) n FROM shots WHERE script_id=?').bind(sc.id).first()).n;
    await env.DB.batch(list.map((x, i) => env.DB.prepare('INSERT INTO shots (script_id,idx,beat,th,en,chars,kproj,created,chain,loc,say) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(sc.id, base + i + 1, bi, String(x.th || '').slice(0, 300), String(x.en || '').slice(0, 600), JSON.stringify(Array.isArray(x.chars) ? x.chars : []), `ฉาก${sc.id}·${base + i + 1}`, Date.now(), i > 0 && x.chain ? 1 : 0, places.includes(x.loc) ? x.loc : null, dirSay(x.dir, sc.id, base + i + 1))));
    return { next: bi + 1 < beats.length ? bi + 1 : -1, added: list.length };
  }
  if (act === 'sb_panels') { // v2: เขียนช่องมังงะของเหตุการณ์นี้ (ภาพ + บทพูดพร้อมกัน)
    const sc = await env.DB.prepare('SELECT * FROM scripts WHERE id=?').bind(+b.script_id).first(); if (!sc) throw new Error('ไม่พบบท');
    let o = {}; try { o = JSON.parse(sc.body); } catch { o = {}; }
    const beats = o.beats || [], bi = +b.beat || 0; if (!beats.length) throw new Error('บทนี้ยังไม่มีเหตุการณ์');
    if (bi === 0) { const old = (await env.DB.prepare('SELECT kproj FROM shots WHERE script_id=?').bind(sc.id).all()).results, st = [env.DB.prepare('DELETE FROM shots WHERE script_id=?').bind(sc.id)]; for (const x of old) st.push(env.DB.prepare('DELETE FROM images WHERE project=?').bind(x.kproj), env.DB.prepare('DELETE FROM jobs WHERE project=?').bind(x.kproj)); for (let i = 0; i < st.length; i += 20) await env.DB.batch(st.slice(i, i + 20)); }
    const sr = await env.DB.prepare('SELECT * FROM series WHERE id=?').bind(sc.series_id).first(), plan = sr ? await readPlan(env, sr.title) : null;
    const xs = sr ? (await env.DB.prepare("SELECT name,desc,kind FROM chars WHERE story=? AND kind IN ('enemy','place')").bind(sr.title).all().catch(() => ({ results: [] }))).results : [], places = xs.filter(x => x.kind === 'place').map(x => x.name).concat(((plan && plan.locs) || []).map(l => l.name));
    const roles = ((plan && plan.roles) || []).filter(r => r.tier !== 'none'), names = roles.map(r => r.key).concat(xs.filter(x => x.kind === 'enemy').map(x => x.name));
    const scn = await env.DB.prepare('SELECT title,logline,ep,sc FROM scenes WHERE script_id=?').bind(sc.id).first();
    const prev = (await env.DB.prepare('SELECT th,say FROM shots WHERE script_id=? ORDER BY idx DESC LIMIT 3').bind(sc.id).all()).results.reverse().map(r => { let y = {}; try { y = JSON.parse(r.say || '{}'); } catch (e) { } return `[${r.th}] ${(y.lines || []).map(l => (l.who || 'บรรยาย') + ': ' + l.say).join(' / ')}`; }).join('\n');
    const total = +b.shots > 0 ? Math.min(180, +b.shots) : 20, N = Math.min(5, Math.max(3, Math.ceil(total / beats.length)));
    const arr = await llmJson(env, s, `เรื่อง: ${String(sr ? sr.brief : '').slice(0, 1800)}\nตัวละครที่ใช้ชื่อได้ (ต้องสะกดตามนี้): ${roles.map(r => `${r.key} (${r.g === 'f' ? 'หญิง' : r.g === 'm' ? 'ชาย' : 'ไม่ใช่คน'} ${r.age || ''} ${r.kind}: ${r.look || ''}${r.traits ? ' · ' + r.traits : ''})`).join(' | ')}${xs.filter(x => x.kind === 'enemy').length ? ' | ศัตรู: ' + xs.filter(x => x.kind === 'enemy').map(x => x.name).join(', ') : ''}\nซีน: ${scn ? scn.title + ' — ' + scn.logline : o.title || ''}\nเหตุการณ์ทั้งซีน: ${beats.map((x, i) => (i + 1) + ') ' + x).join(' ').slice(0, 1200)}\nช่องก่อนหน้า:\n${prev || '(เริ่มซีน)'}\n\nเขียนมังงะของ "เหตุการณ์ที่ ${bi + 1}: ${beats[bi]}" เป็น ${N} ช่อง (เพิ่มได้ถึง ${N + 3} ช่องถ้าบทพูดเยอะ) ภาพละ 16:9 ให้คนที่ไม่รู้เรื่องมาก่อนอ่านแล้วเข้าใจ:\n- ${bi === 0 ? 'ช่องแรกเป็นภาพกว้างบอกสถานที่และเวลา พร้อมคำบรรยาย (who ว่าง) ' : 'ต่อจากช่องก่อนหน้าให้เนียน '}ตัวละครที่โผล่ครั้งแรกในซีนต้องมีคำบรรยายสั้นๆ ว่าเป็นใคร\n- บทพูดต้องเล่าเหตุและผล: ใครต้องการอะไร เกิดอะไรขึ้น อีกฝ่ายตอบอย่างไร ห้ามบทพูดลอยๆ คำเดียว (เช่น "ฟังนะ" "ว่าไง" "ดีไหม") ห้ามพูดซ้ำสิ่งที่ภาพบอกแล้ว\n- ช่องละ 1-3 บรรทัด ตัวละครสลับกันพูด ถ้าพูดเยอะให้แตกเป็นหลายช่อง ภาษาไทยล้วน ห้ามมีอักษรจีนหรือญี่ปุ่น\n- shot ต้องหลากหลาย ห้ามซ้ำกันเกิน 2 ช่องติด เลือกจาก: wide (เห็นฉากกว้าง) | medium | closeup (หน้า สีหน้าชัด) | two (สองคนในภาพ) | ots (ข้ามไหล่) | low (มุมต่ำ) | high (มุมสูง) | insert (ภาพของ/มือ/รายละเอียด ไม่มีหน้า) | back (จากด้านหลัง)\n- en = ภาษาอังกฤษ บอกสถานที่ + ใครทำอะไร ท่าทาง สีหน้า เรียกตัวละครว่า the man / the woman / the creature ห้ามใส่ชื่อ ห้ามบรรยายผมหรือชุด ภาพหนึ่งมีคนไม่เกิน 2 คน\n- think = ความคิดในใจสั้นๆ และ ono = คำเสียงประกอบ ใส่เฉพาะช่องจังหวะตลกหรืออารมณ์พุ่ง · loc = ชื่อสถานที่จากรายการ (${places.slice(0, 10).join(' | ') || '-'}) ถ้าตรง · chain = true เฉพาะท่าต่อสู้ที่ต่อจากช่องก่อนในมุมกล้องเดิม\nตอบเป็น JSON array: [{"shot":"wide","th":"ภาพนี้คืออะไร","en":"...","chars":["ชื่อ"],"lines":[{"who":"","say":""}],"think":"","ono":"","loc":"","chain":false}]`);
    const list = (Array.isArray(arr) ? arr : (arr && Array.isArray(arr.panels) ? arr.panels : [arr])).slice(0, N + 3).map(x => cleanPanel(x || {}, names, places)).filter(Boolean);
    if (!list.length) throw new Error('AI เขียนช่องมาใช้ไม่ได้เลย (ตอบ: ' + JSON.stringify(arr).slice(0, 160) + ')');
    const base = ((await env.DB.prepare('SELECT MAX(idx) m FROM shots WHERE script_id=?').bind(sc.id).first()) || {}).m || 0;
    if (list.length) await env.DB.batch(list.map((x, i) => env.DB.prepare('INSERT INTO shots (script_id,idx,beat,th,en,chars,kproj,created,say,chain,loc) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(sc.id, base + i + 1, bi, x.th, x.en, JSON.stringify(x.chars), `ฉาก${sc.id}·${base + i + 1}`, Date.now(), x.say, i > 0 ? x.chain : 0, x.loc)));
    return { next: bi + 1 < beats.length ? bi + 1 : -1, added: list.length, names, places };
  }
  if (act === 'sb_edit') {
    const sh = await env.DB.prepare('SELECT * FROM shots WHERE id=?').bind(+b.id).first(); if (!sh) throw new Error('ไม่พบช็อต');
    const cmd = String(b.command || '').trim().slice(0, 400); if (!cmd) throw new Error('พิมพ์คำสั่งแก้ก่อน');
    const o = await llmJson(env, s, `ช็อตปัจจุบัน: ${JSON.stringify({ th: sh.th, en: sh.en, chars: JSON.parse(sh.chars || '[]') })}\nคำสั่งแก้: ${cmd}\nแก้ช็อตตามคำสั่ง ตอบเป็น JSON object {"th":"...","en":"English image prompt","chars":["..."]}`);
    await env.DB.prepare('UPDATE shots SET th=?, en=?, chars=? WHERE id=?').bind(String(o.th || sh.th).slice(0, 300), String(o.en || sh.en).slice(0, 1800), JSON.stringify(Array.isArray(o.chars) ? o.chars : JSON.parse(sh.chars || '[]')), sh.id).run();
    return { ok: true };
  }
  if (act === 'kf') { // สร้างภาพคีย์ (SDXL + LoRA ตัวละครที่ติ๊กใช้) · ไม่ส่ง ids = ทำเฉพาะช็อตที่ยังไม่มีภาพ
    const sc = await env.DB.prepare('SELECT series_id FROM scripts WHERE id=?').bind(+b.script_id).first(); if (!sc) throw new Error('ไม่พบบท');
    const rows = (await env.DB.prepare('SELECT * FROM shots WHERE script_id=? ORDER BY idx').bind(+b.script_id).all()).results;
    const only = Array.isArray(b.ids) ? new Set(b.ids.map(Number)) : null;
    const LM = await shotLoraMap(env, sc.series_id);
    const srK = await env.DB.prepare('SELECT title FROM series WHERE id=?').bind(sc.series_id).first(), planK = srK ? await readPlan(env, srK.title) : null, ROLES = (planK && planK.roles) || [], LOOKS = planK ? await roleLooks(env, s, srK.title, planK) : {};
    const hv = new Set((await env.DB.prepare('SELECT DISTINCT project FROM images WHERE project >= ? AND project < ?').bind(`ฉาก${+b.script_id}·`, `ฉาก${+b.script_id}·\uffff`).all()).results.map(x => x.project));
    const pd = new Set((await env.DB.prepare("SELECT DISTINCT project FROM jobs WHERE project LIKE ? AND status IN ('queued','running','kaggle')").bind(`ฉาก${+b.script_id}·%`).all()).results.map(x => x.project));
    const st = []; let n = 0;
    const seedOf = {}; { let head = null; for (const [i, sh] of rows.entries()) { if (!(+sh.chain && head)) head = sh; if (+sh.chain || +((rows[i + 1] || {}).chain)) seedOf[sh.id] = 100000 + head.id * 7; } } // ชุดท่าต่อเนื่อง: ใช้ seed เดียวกัน ให้ฉากหลัง/มุมกล้องออกมาใกล้กันที่สุด
    for (const sh of rows) {
      if (only ? !only.has(sh.id) : (hv.has(sh.kproj) || pd.has(sh.kproj))) continue;
      const { names, m } = shotLoraPick(sh, LM), nch = m.filter(c => c.k === 'char').length;
      const lset = new Set(LM.lc.filter(c => m.some(x => x.lid === c.lid)).map(c => c.name)), extra = [], gs = [];
      let crt = 0; const ages = [];
      for (const n of names) { const R = ROLES.find(r => r.key === n), lk = String(LOOKS[n] || (R && R.look) || ''); if (!lset.has(n) && LOOKS[n] && !String(sh.en).includes(LOOKS[n].slice(0, 24))) extra.push(LOOKS[n]);
        if (/creature|spirit|cat-like|beast|monster|animal|mascot/i.test(lk) || (R && /วิญญาณ|สัตว์|ภูต|ปีศาจ/.test(String(R.kind || '')))) { crt++; continue; } // ตัวที่ไม่ใช่คน ไม่นับเป็นจำนวนคนในภาพ
        const g = R && (R.g === 'f' || R.g === 'm') ? R.g : /\b(woman|girl|female)\b/i.test(lk) ? 'f' : 'm'; gs.push(g); ages.push([g, +(R && R.age) || +((lk.match(/(\d\d)-year-old/) || [])[1]) || 0]); }
      const old = ''; // เลิกใส่แท็กวัยกลางคน/สูงวัย (ผู้ใช้สั่ง: ทุกตัวละครดูหนุ่มสาว)
      const nf = gs.filter(g => g === 'f').length, nm = gs.length - nf, gt = n => n === 1 ? '1' : n === 2 ? '2' : '3';
      // จำนวนคน+เพศ ต้องอยู่ "ต้นคำสั่ง" (อยู่ท้ายแล้วโมเดลวาดเป็นกลุ่มผู้หญิง/ตารางหน้าคน — เจอจริงกับตอน 1)
      const cnt = !gs.length ? (crt ? 'no humans, creature' : /wide shot|insert shot/.test(sh.en) && !/\b(man|woman|men|women|customers?|guard|merchant|thugs?|figures?|demons?|hands?|finger|clerks?|people|person)\b/i.test(sh.en) ? 'no humans' : '') : [gs.length === 1 ? 'solo' : '', nm ? gt(nm) + (nm > 1 ? 'boys' : 'boy') : '', nf ? gt(nf) + (nf > 1 ? 'girls' : 'girl') : '', nm && !nf ? 'male focus' : '', old, crt ? 'one small creature' : '', gs.length === 1 ? 'single character' : gs.length === 2 ? 'only two people' : ''].filter(Boolean).join(', ');
      st.push(env.DB.prepare('UPDATE shots SET loras=? WHERE id=?').bind(JSON.stringify(m.map(c => ({ id: c.lid, w: c.w }))), sh.id));
      st.push(env.DB.prepare("INSERT INTO jobs (project,scene,prompt,status,created,steps,eng,seed) VALUES (?,1,?,'queued',?,?,?,?)").bind(sh.kproj, `${cnt ? cnt + ', ' : ''}${m.map(c => c.tag || ('chr' + c.cid + 'x')).join(', ')}${m.length ? ', ' : ''}${sh.en}${extra.length ? ', ' + extra.join('; ') : ''}, single cinematic illustration, [[STYLE]]`.slice(0, 1800), Date.now(), nch ? 8 : 4, names.length && !m.length ? 'sdxl' : null, seedOf[sh.id] || null)); // ร่างคร่าวๆ (ยังไม่มี LoRA) วาดเร็ว · ของจริงที่ใช้ LoRA วาดคุณภาพสูง
      n++;
    }
    if (st.length) await env.DB.batch(st);
    return { queued: n };
  }
  if (act === 'shots') {
    const sid = +b.script_id, ep = 'a' + sid;
    const rows = (await env.DB.prepare("SELECT s.id,s.idx,s.beat,s.th,s.en,s.chars,s.say, COALESCE((SELECT MAX(i.id) FROM images i WHERE i.project=s.kproj),0) img, (SELECT COUNT(*) FROM jobs j WHERE j.project=s.kproj AND j.status IN ('queued','running','kaggle')) pending, COALESCE((SELECT MAX(v.id) FROM videos v WHERE v.ep=?1 AND v.shot=CAST(s.id AS TEXT)),0) vid, (SELECT COUNT(*) FROM vjobs q WHERE q.ep=?1 AND q.shot=CAST(s.id AS TEXT) AND q.status IN ('queued','running')) vpend, (SELECT group_concat(v.line||':'||v.id) FROM voices v WHERE v.shot=s.id) vo FROM shots s WHERE s.script_id=?2 ORDER BY s.idx").bind(ep, sid).all()).results;
    return { shots: rows };
  }
  if (act === 'lora_use') { await env.DB.prepare('UPDATE loras SET use=? WHERE id=?').bind(b.on ? 1 : 0, +b.id).run(); return { ok: true }; }
  if (act === 'lora_retrain') { await env.DB.batch([env.DB.prepare("UPDATE loras SET status='old' WHERE char_id=?").bind(+b.char_id), env.DB.prepare("DELETE FROM vjobs WHERE kind='lora' AND status IN ('queued','failed') AND project=(SELECT 'ซีรีส์'||series_id||'·'||name FROM chars WHERE id=?)").bind(+b.char_id)]); return { ok: true }; }
  if (act === 'chars') {
    const cs = (await env.DB.prepare('SELECT * FROM chars WHERE series_id=? ORDER BY id').bind(+b.series_id).all()).results;
    for (const c of cs) {
      const pj = charProj(c);
      c.images = (await env.DB.prepare('SELECT id,starred FROM images WHERE project=? ORDER BY id').bind(pj).all()).results;
      c.pending = (await env.DB.prepare("SELECT COUNT(*) n FROM jobs WHERE project=? AND status IN ('queued','running','kaggle')").bind(pj).first()).n;
      const l = await env.DB.prepare("SELECT l.id,l.status,l.error,l.size,l.use,v.status vs FROM loras l LEFT JOIN vjobs v ON v.id=l.vjob WHERE l.char_id=? AND l.status<>'old' ORDER BY l.id DESC LIMIT 1").bind(c.id).first();
      if (l) { if (l.status === 'queued' && l.vs === 'running') l.status = 'training'; c.lora = l; }
    }
    return { chars: cs };
  }
  if (act === 'ep_plan') { // วางโครง 12 ตอน × 3 ซีน ทีละตอน (หน้าเว็บเรียกวนจนครบ)
    const sr = await env.DB.prepare('SELECT * FROM series WHERE id=?').bind(+b.series_id).first(); if (!sr) throw new Error('ไม่พบซีรีส์');
    const e = Math.max(1, +b.from || 1); if (e > 12) return { next: -1 };
    const prev = (await env.DB.prepare('SELECT ep,sc,title,logline FROM scenes WHERE series_id=? ORDER BY no DESC LIMIT 6').bind(sr.id).all()).results.reverse();
    const arr = await llmJson(env, s, `เรื่องและโครงเรื่องทั้งหมด:\n${sr.brief}\n\nแบ่งเรื่องเป็น 12 ตอน ตอนละ 3 ซีน (ซีนละ ~5 นาที) ซีนที่วางไว้ก่อนหน้า: ${prev.map(x => `ตอน${x.ep}ซีน${x.sc} ${x.title}: ${x.logline}`).join(' | ') || '-'}\nเขียน 3 ซีนของตอนที่ ${e} ตามโครงเรื่องของตอนนั้น (ซีน 1 เปิดเรื่อง ซีน 2 กลางเรื่อง/ฉากสู้หรือสืบสวน ซีน 3 ปิดตอนและจุดที่ต้องดูต่อ) ตอบเป็น JSON array 3 รายการของ {"title":"ชื่อซีน","logline":"สรุป 1-2 ประโยค"}`);
    const list = (Array.isArray(arr) ? arr : [arr]).slice(0, 3); if (!list.length) throw new Error('วางโครงไม่สำเร็จ ลองใหม่');
    await env.DB.prepare('DELETE FROM scenes WHERE series_id=? AND ep=? AND script_id=0').bind(sr.id, e).run();
    await env.DB.batch(list.map((x, i) => env.DB.prepare('INSERT INTO scenes (series_id,ep,sc,no,title,logline,created) VALUES (?,?,?,?,?,?,?)').bind(sr.id, e, i + 1, (e - 1) * 3 + i + 1, String(x.title || '').slice(0, 80), String(x.logline || '').slice(0, 400), Date.now())));
    return { next: e < 12 ? e + 1 : -1 };
  }
  if (act === 'chars_auto') { // สกัดตัวละครจากเรื่อง แล้วสร้างภาพอ้างอิงให้ทุกตัว (ครบ 12 ภาพ ระบบเทรน LoRA เอง)
    const sr = await env.DB.prepare('SELECT * FROM series WHERE id=?').bind(+b.series_id).first(); if (!sr) throw new Error('ไม่พบซีรีส์');
    const arr = await llmJson(env, s, `เรื่อง:\n${sr.brief}\n\nสกัดตัวละครที่ต้องมีหน้าตาคงที่ทุกซีน (ตัวหลัก ตัวรอง ตัวร้าย สัตว์/อสูรประจำเรื่อง) ตอบเป็น JSON array ของ {"name":"ชื่อตัวละครตามเรื่อง","desc":"English visual description for image generation: adult age, gender, face, hair colour and style, eye colour, build, signature outfit and accessories (no story spoilers)"}`);
    const have = new Set((await env.DB.prepare('SELECT name FROM chars WHERE series_id=?').bind(sr.id).all()).results.map(x => x.name));
    let n = 0;
    for (const x of (Array.isArray(arr) ? arr : [arr]).slice(0, 12)) {
      const name = String(x.name || '').trim().slice(0, 40), desc = String(x.desc || '').trim().slice(0, 600); if (!name || !desc || have.has(name)) continue;
      const r = await env.DB.prepare('INSERT INTO chars (series_id,name,desc,created) VALUES (?,?,?,?)').bind(sr.id, name, desc, Date.now()).run();
      await charRefs(env, r.meta.last_row_id, 12); n++;
    }
    return { added: n };
  }
  if (act === 'eps') {
    const rows = (await env.DB.prepare('SELECT * FROM scenes WHERE series_id=? ORDER BY no').bind(+b.series_id).all()).results;
    for (const e of rows) {
      if (!e.script_id) continue; const ep = 'a' + e.script_id;
      e.tot = (await env.DB.prepare('SELECT COUNT(*) n FROM shots WHERE script_id=?').bind(e.script_id).first()).n;
      e.img = (await env.DB.prepare('SELECT COUNT(DISTINCT project) n FROM images WHERE project >= ? AND project < ?').bind(`ฉาก${e.script_id}·`, `ฉาก${e.script_id}·\uffff`).first()).n;
      e.vid = (await env.DB.prepare("SELECT COUNT(DISTINCT shot) n FROM videos WHERE ep=? AND shot<>'final'").bind(ep).first()).n;
      e.final = ((await env.DB.prepare("SELECT MAX(id) id FROM videos WHERE ep=? AND shot='final'").bind(ep).first()) || {}).id || 0;
    }
    const ef = {}; for (let k = 1; k <= 12; k++) { const v = await env.DB.prepare("SELECT MAX(id) id FROM videos WHERE ep=? AND shot='final'").bind('E' + (+b.series_id) + 'x' + k).first(); if (v && v.id) ef[k] = v.id; }
    return { eps: rows, efinal: ef, ok: +s['anime_ok_' + (+b.series_id)] || 0 };
  }
  if (act === 'ep_ok') { await setSetting(env, 'anime_ok_' + (+b.series_id), String(+b.ep || 0)); return { ok: true }; }
  if (act === 'ep_auto') { // เปิด/ปิดให้ทำเอง: ส่ง id = ตอนเดียว ไม่ส่ง = ทุกตอนที่ยังไม่เสร็จของซีรีส์
    if (+b.id) await env.DB.prepare('UPDATE scenes SET auto=? WHERE id=?').bind(b.on ? 1 : 0, +b.id).run();
    else await env.DB.prepare('UPDATE scenes SET auto=? WHERE series_id=? AND fin=0').bind(b.on ? 1 : 0, +b.series_id).run();
    return { ok: true };
  }
  if (act === 'vid') { // ภาพคีย์ → วิดีโอช็อตละ ~5 วิ (ลุคอนิเมะ 12fps) ครั้งละไม่เกิน 6 ช็อต ที่เหลือทำรอบถัดไป
    const sid = +b.script_id, ep = 'a' + sid;
    const rows = (await env.DB.prepare('SELECT id,en,kproj,say,chars,chain FROM shots WHERE script_id=? ORDER BY idx').bind(sid).all()).results;
    const have = new Set([...(await env.DB.prepare("SELECT DISTINCT shot FROM videos WHERE ep=?").bind(ep).all()).results, ...(await env.DB.prepare("SELECT shot FROM vjobs WHERE ep=? AND status IN ('queued','running')").bind(ep).all()).results].map(x => String(x.shot)));
    let n = 0;
    for (const [i, sh] of rows.entries()) {
      VALL = s.v_all !== '0'; if (i === 0) HELPN = (((await env.DB.prepare("SELECT COUNT(*) n FROM helpers WHERE on_=1 AND COALESCE(kuser,'')<>''").first().catch(() => null)) || {}).n) || 0; // ผู้ช่วยรันอัตโนมัติ 1 คน = +1 แบบต่อช็อต · 2 คนขึ้นไป = +2 (สูงสุด 5)
      if (n >= 6) break; if (!keyShot(sh, i) || have.has(String(sh.id))) continue;
      const im = await env.DB.prepare('SELECT data FROM images WHERE project=? ORDER BY id DESC LIMIT 1').bind(sh.kproj).first(); if (!im || !im.data) continue;
      const isAct = /fight|battle|chase|attack|talisman|explo|seal|spell|leap|punch|slash|strike|clash|kick|dodge|charge|impact|burst/i.test(sh.en || ''), nx = rows[i + 1], vo = isAct ? { hq: 1 } : { hq: s.v_hq === '0' ? 0 : 1, fps: 12 }; vo.takes = Math.max(1, Math.min(5, (+s.v_takes || 3) + (HELPN >= 2 ? 2 : HELPN))); // คุณภาพสูงสุด: ทุกช็อต 8 สเต็ป + ทำหลายแบบแล้วเลือกที่ดีที่สุด // ช็อตแอ็กชัน: คุณภาพสูง + เติมเฟรมให้ลื่น · ช็อตทั่วไป: ลุคอนิเมะ 12fps
      if (nx && +nx.chain && s.self_url) { const ni = await env.DB.prepare('SELECT MAX(id) id FROM images WHERE project=?').bind(nx.kproj).first(); if (ni && ni.id) vo.end = s.self_url + '/vi/' + ni.id + '?s=' + await vvSig(env, 'i' + ni.id); } // ท่าถัดไปของชุดต่อเนื่อง = เฟรมสุดท้ายของคลิปนี้
      await env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,opt) VALUES (?,?,?,?,?,?,?,'queued',0,?,?)").bind('อนิเมะ·' + sid, ep, String(sh.id), `anime style, ${sh.en}, ${speakShot(sh) ? 'the character is talking, mouth opening and closing naturally while speaking, subtle head movement, ' : ''}${isAct ? 'fast dynamic action, strong motion, impact, ' : ''}smooth natural motion, consistent face and outfit, no morphing`.slice(0, 600), VNEG, im.data, vFrames(vo.end ? 3 : (speakShot(sh) && !isAct ? 3 : 5)), Date.now(), JSON.stringify(vo)).run();
      n++;
    }
    return { queued: n };
  }
  const sers = (await env.DB.prepare('SELECT id,title,brief FROM series ORDER BY id DESC LIMIT 20').all()).results;
  const sid = +b.series_id || (sers[0] && sers[0].id) || 0;
  const scripts = sid ? (await env.DB.prepare('SELECT id,body,ver,picked FROM scripts WHERE series_id=? ORDER BY id DESC').bind(sid).all()).results : [];
  return { series: sers, series_id: sid, scripts };
}
async function kImgOn(env, s, now) {
  if ((s.img_engine || 'auto') === 'flux') return false;
  kEnv(env, s);
  if (!env.KAGGLE_USERNAME || !env.KAGGLE_KEY) return false;
  if (now < (+s.k_pause || 0)) { // โควตา GPU บัญชีหลักหมด: ถ้ามีผู้ช่วยรันอัตโนมัติพร้อม ยังส่งงานภาพไป Kaggle ได้ (เครื่องผู้ช่วยทำ) ไม่งั้นให้ Flux ทำ
    const h = await env.DB.prepare("SELECT COUNT(*) n FROM helpers WHERE on_=1 AND COALESCE(kuser,'')<>'' AND COALESCE(kpause,0)<?").bind(now).first().catch(() => null);
    return !!(h && h.n);
  }
  return true;
}
async function bridgeImg(env, s) {
  const rows = (await env.DB.prepare("SELECT id,project,scene,prompt,steps,seed,eng FROM jobs WHERE status='queued' AND COALESCE(eng,'')<>'flux' ORDER BY CASE WHEN project LIKE 'ฉาก%·%' THEN CAST(substr(project,4,instr(project,'·')-4) AS INTEGER) ELSE 999999 END, CASE WHEN project LIKE 'ฉาก%·%' THEN CAST(substr(project,instr(project,'·')+1) AS INTEGER) END, id LIMIT 40").all()).results;
  { const HOLD = new Set(String(s.img_hold || '').split(',').map(x => x.trim()).filter(Boolean)); // พักวาดซีนที่ระบุ (script_id) เช่น รอผู้ใช้เลือกภาพอ้างอิงตัวละครก่อน
    if (HOLD.size) for (let i = rows.length - 1; i >= 0; i--) { const m = /^ฉาก(\d+)·/.exec(String(rows[i].project)); if (m && HOLD.has(m[1])) rows.splice(i, 1); } }
  if (!rows.length) return 0;
  // จองงานแบบอะตอมก่อนส่ง (เคยมีรอบทำงานซ้อน 2 รอบ ส่งงานเดียวกันไป Kaggle ซ้ำ 2 เท่า)
  const got = new Set(((await env.DB.prepare(`UPDATE jobs SET status='kaggle' WHERE status='queued' AND id IN (${rows.map(() => '?').join(',')}) RETURNING id`).bind(...rows.map(r => r.id)).all()).results || []).map(r => r.id));
  const st = [], now = Date.now();
  for (const j of rows) { if (!got.has(j.id)) continue;
    let lo = [];
    if (String(j.project).startsWith('ฉาก')) { const sh = await env.DB.prepare('SELECT loras FROM shots WHERE kproj=?').bind(j.project).first().catch(() => null); try { lo = JSON.parse((sh && sh.loras) || '[]'); } catch { lo = []; } }
    if (String(j.project).startsWith('ทดสอบLoRA·')) lo = [{ id: +String(j.project).split('·')[1] || 0, w: 0.8 }];
    // สตอรีบอร์ดช่วงร่าง (sb_draft ≠ 0): วาดเป็นมังงะขาวดำด้วย FLUX.1-dev บน Kaggle (ไม่ใช้ LoRA) ลายเส้นเดียวกับตัวสำรอง แต่ละเอียดกว่า · ปิดร่างด้วย sb_draft=0 เมื่อจะวาดจริงเป็นสี + LoRA
    const draft = String(j.project).startsWith('ฉาก') && s.sb_draft !== '0';
    let shEn = '', shLoc = '', noChar = false; if (draft) { const shr = await env.DB.prepare('SELECT en,loc,chars FROM shots WHERE kproj=?').bind(j.project).first().catch(() => null); shEn = shr ? String(shr.en || '') : ''; shLoc = shr ? String(shr.loc || '') : ''; noChar = !!shr && !/[^\[\]\s]/.test(String(shr.chars || '[]')); lo = []; }
    // ภาพร่าง: สถานที่เดียวกันใช้ seed ชุดเดียวกัน (ฉากหลัง/ลายเส้นใกล้กันขึ้น) + วาด 2 แบบแล้วให้ CLIP ตรวจเลือกภาพที่ตรงบทและฉากหลังครบที่สุด
    const locSeed = shLoc ? [...shLoc].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 2000000000 + 1 : 0;
    const hyOn = draft && s.img_hybrid === '1'; // ภาพแบบผสม: FLUX วาดฉาก · SDXL อนิเมะวาดตัวละคร/ของสำคัญทั้งหมด (สี) — ผู้ใช้สั่ง: รายละเอียดสำคัญใช้ SDXL เท่านั้น
    const eg = hyOn ? (s.img_hy_mode === 'paste' ? 'hybrid' : 'cn') : draft ? fluxEng(s) : lo.length ? 'sdxl' : imgEngineFor(j, s), hi = (+j.steps || 4) >= 8;
    const npExp = !draft || /chibi/i.test(shEn) || /only (his|her|the two) hands?|hand(s)? (is|are) visible/i.test(shEn) ? null : /No people in the picture/.test(shEn) ? 0 : /Exactly one person/.test(shEn) ? 1 : /Exactly two people/.test(shEn) ? 2 : null; // จำนวนคนที่บทกำหนด ให้เครื่องตรวจภาพนับเทียบ
    const plushBad = draft && /talisman archive office/.test(shEn) && !/plush toys/.test(shEn) ? ['a person holding a teddy bear or stuffed toy', 'stuffed toys lying on the floor'] : [];
    let shChars = [], s3 = null, shOf = null; if (hyOn) { const cr = await env.DB.prepare('SELECT chars,say FROM shots WHERE kproj=?').bind(j.project).first().catch(() => null); try { shChars = JSON.parse((cr && cr.chars) || '[]'); } catch { shChars = []; } try { const sy = JSON.parse((cr && cr.say) || '{}'); shOf = sy.outfit || null; if (sy.s3 && s.img_3d !== '0') s3 = s3Opt(sy.s3); } catch { s3 = null; } }
    let hyO = hyOn ? hyOpt(shEn, shChars, s, shOf) : null;
    if (hyO && s.self_url) { // ภาพอ้างอิงตัวละครที่ผู้ใช้อนุมัติ (ปกติ / หน้าตลกในช่องตลก) → ลิงก์มีลายเซ็นให้เครื่อง Kaggle ดึง
      const LIB = {}, MAP = {}, REF = {}; for (const k of Object.keys(s)) { try { if (k.startsWith('charref:')) Object.assign(LIB, JSON.parse(s[k] || '{}')); if (k.startsWith('refmap:')) Object.assign(MAP, JSON.parse(s[k] || '{}')); } catch { } }
      for (const [lib, v] of Object.entries(LIB)) { const role = lib in MAP ? MAP[lib] : lib; if (role && !(role in REF && MAP[lib] === undefined)) REF[role] = v; } // ตัวละครในคลังที่ผู้ใช้จับคู่กับบท (ค่าเริ่มต้น = ชื่อเดียวกัน)
      const gag = /chibi|comedic|gag|meme|deadpan|super-deformed/i.test(shEn);
      for (const c of hyO.chars) { const R = REF[c.n]; if (!R) continue; const id = gag && (R.g || []).length ? R.g[(j.id || 0) % R.g.length] : R.n; if (id) { c.ref = s.self_url + '/vi/' + id + '?s=' + await vvSig(env, 'i' + id); c.rw = gag ? 0.45 : 0.6; } }
    }
    const opt = { ...(hyOn ? { hy: hyO } : {}), ...(s3 ? { s3 } : {}), ...(draft && npExp !== null ? { np: npExp } : {}), ...(draft ? { ...(hyOn ? {} : { gray: 1 }), takes: npExp >= 2 ? 3 : (+s.draft_takes || 2), ...(noChar || plushBad.length || hyOn ? { qneg: [...(noChar ? ['a person standing in the foreground'] : []), ...plushBad, ...(hyOn ? ['objects floating in the air', 'a crooked broken table with mismatched edges', 'words and letters written on signs', 'a person cut in half or merged into furniture'] : [])] } : {}), qc: [shEn.split(/,? setting:/i)[0].slice(0, 220), hyOn ? 'a detailed colour anime illustration with a fully drawn detailed background' : 'a detailed black and white manga panel with a fully drawn detailed background'] } : {}), ...(draft && locSeed ? { seedLoc: locSeed } : {}), jobId: j.id, scene: j.scene, engine: s3 ? 's3d' : eg, steps: eg === 'sdxl' ? (hi ? 34 : 26) : eg === 'schnell' ? 6 : (hi ? 28 : 24), seed: +j.seed || 0, w: draft ? 1344 : (+s.img_w || 1024), h: draft ? 768 : (+s.img_h || 1024), model: s.img_model || '', quant: s.img_quant || '', loras: lo };
    st.push(env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,kind,opt) VALUES (?,?,?,?,'','',0,'queued',0,?,'img',?)")
      .bind(j.project, '', String(j.scene), (draft ? fluxDraft({ project: j.project, prompt: noChar ? '[[STYLE]]' : j.prompt }, s, noChar ? shEn : /chr\d+x/.test(String(j.prompt || '')) ? shEn : '', { nochar: noChar , color: hyOn }) : withStyle(j.prompt, s)).slice(0, 4000), now, JSON.stringify(opt)));
    st.push(env.DB.prepare("UPDATE jobs SET status='kaggle' WHERE id=?").bind(j.id));
  }
  await env.DB.batch(st);
  return rows.length;
}
// เติมคิวภาพเองให้ GPU ทำงานเต็มโควตา แต่หยุดเมื่อภาพในคลังถึงเพดาน (D1 ฟรีเก็บได้จำกัด) — ติ๊กดาว/ลบภาพที่ไม่ใช้เพื่อให้ทำต่อ
async function kTopUp(env, s) {
  const c = await env.DB.prepare('SELECT COUNT(*) n FROM images').first();
  if (+c.n >= (+s.img_cap || 600)) {
    const day = new Date().toISOString().slice(0, 10);
    if (s.cap_note !== day) { await setSetting(env, 'cap_note', day); await notify(env, '🖼️ ภาพในคลังถึงเพดานแล้ว บอทหยุดเติมคิวอัตโนมัติ ลบภาพที่ไม่ใช้หรือเพิ่มค่า img_cap เพื่อทำต่อ'); }
    return;
  }
  const a = await env.DB.prepare("SELECT (SELECT COUNT(*) FROM jobs WHERE status='queued' AND COALESCE(eng,'')<>'flux') + (SELECT COUNT(*) FROM vjobs WHERE kind='img' AND status IN ('queued','running')) n").first();
  let n = +(a && a.n) || 0;
  for (let i = 0; i < 8 && n < 16; i++, n++) await autoFill(env, await getSettings(env));
}
async function tick(env, force) {
  const s = await getSettings(env);
  const now = Date.now();
  if (!force) { const rr = +s[readDay()] || 0; if (rr > READ_STOP) return { skipped: 'reads ' + rr }; } // ใกล้เพดานอ่านรายวัน: งานเบื้องหลังทำทุก 5 นาที · เกือบเต็ม: หยุดงานเบื้องหลัง (เครื่อง Kaggle ยังส่งงานได้)
  await animeAuto(tagged(env, 'bg:anime'), s).catch(() => {});
  if (s.supa_test === '1') await supaSelfTest(env, s);
  await sbImportTick(env, s).catch(() => { });
  await sbRedrawTick(env, s).catch(() => { });
  if (s.lora_purge) { // ลบ LoRA ชุดเก่า (ไฟล์ใน Supabase + แถวในฐานข้อมูล) ตามที่ผู้ใช้สั่ง — ทีละ 4 ตัวต่อรอบ
    const ids = String(s.lora_purge).split(',').map(Number).filter(Boolean), now4 = ids.slice(0, 4);
    for (const id of now4) { await supaDelLora(env, id).catch(() => { }); await env.DB.batch([env.DB.prepare('DELETE FROM lchunks WHERE lid=?').bind(id), env.DB.prepare('DELETE FROM loras WHERE id=?').bind(id), env.DB.prepare("DELETE FROM settings WHERE key=?").bind('lparts:' + id)]).catch(() => { }); }
    await setSetting(env, 'lora_purge', ids.slice(4).join(','));
  }
  if (s.design_cast) { await env.DB.prepare("DELETE FROM settings WHERE key='design_cast'").run(); await designCast(env, s, String(s.design_cast)).catch(() => { }); }
  await restyleTick(tagged(env, 'bg:lora'), s).catch(() => { });
  await lsetReqTick(tagged(env, 'bg:lora'), s).catch(() => { });
  await lsetTick(tagged(env, 'bg:lora'), s).catch(() => { });
  await xlTick(tagged(env, 'bg:lora')).catch(() => { });
  await animeAdvance(tagged(env, 'bg:anime'), s).catch(() => {});
  const useK = await kImgOn(env, s, now);
  if (useK) {
    if (!force && s.auto_fill === '1') await kTopUp(env, s);
    await bridgeImg(env, s);
  } else {
    // Kaggle ใช้ไม่ได้ → ดึงงานที่ยังไม่ได้เริ่มกลับมาให้ Flux ทำ
    await env.DB.prepare("UPDATE jobs SET status='queued', eng='flux' WHERE status='kaggle' AND id IN (SELECT CAST(json_extract(opt,'$.jobId') AS INTEGER) FROM vjobs WHERE kind='img' AND status='queued')").run().catch(() => {});
    await env.DB.prepare("DELETE FROM vjobs WHERE kind='img' AND status='queued'").run().catch(() => {});
  }
  if (!force) {
    if (now < +s.paused_until && !(await activeKeys(env, now)).length) return { skipped: 'paused' };
    const boost = +s.boost_until > now; // ปุ่มเร่ง: วาดทุกนาที และใช้โควตาวาดของทั้งวันได้เลย ไม่ต้องรอช่วงเวลาถัดไป
    if (now - +s.last_run < (boost ? 1 : (+s.interval_min || 1)) * 60000 - 15000) return { skipped: 'wait' };
    const sl = boost ? { full: false } : await slotCheck(env, s, now); // แบ่งทำเป็นช่วงเวลา แต่ละช่วงมีโควตาของตัวเอง
    if (sl.full) return { skipped: 'slot full' };
    if (now - +s.last_run > 180000) await env.DB.prepare("UPDATE jobs SET status='queued' WHERE status='running'").run();
  }
  const job = await env.DB.prepare("SELECT * FROM jobs WHERE status='queued' AND (?=0 OR eng='flux') ORDER BY CASE WHEN project LIKE 'ฉาก%·%' THEN CAST(substr(project,4,instr(project,'·')-4) AS INTEGER) ELSE 999999 END, CASE WHEN project LIKE 'ฉาก%·%' THEN CAST(substr(project,instr(project,'·')+1) AS INTEGER) END, id LIMIT 1").bind(useK ? 1 : 0).first();
  if (!job) { if (s.auto_fill === '1' && !force && !useK) { await autoFill(env, s); return { skipped: 'empty', filled: true }; } return { skipped: 'empty' }; }
  await setSetting(env, 'last_run', String(now));
  await env.DB.prepare("UPDATE jobs SET status='running' WHERE id=?").bind(job.id).run();
  try {
    let shEn = ''; if (String(job.project || '').startsWith('ฉาก') && /chr\d+x/.test(String(job.prompt || ''))) { const shr = await env.DB.prepare('SELECT en FROM shots WHERE kproj=?').bind(job.project).first().catch(() => null); shEn = shr ? String(shr.en || '') : ''; }
    const out = await genImage(env, s, fluxDraft(job, s, shEn).slice(0, 2048), Math.min(8, Math.max(1, +job.steps || +s.steps || 4)), +job.seed || 0);
    await env.DB.prepare('INSERT INTO images (job_id,project,scene,prompt,data,starred,created) VALUES (?,?,?,?,?,0,?)')
      .bind(job.id, job.project, job.scene, job.prompt, out.image, Date.now()).run();
    await env.DB.prepare('DELETE FROM jobs WHERE id=?').bind(job.id).run();
    if (s.pace !== '0') await setSetting(env, 'slot_n', String((+s.slot_n || 0) + 1));
    const left = await env.DB.prepare("SELECT COUNT(*) n FROM jobs WHERE status='queued'").first();
    if (left.n === 0) await notify(env, `✅ คิวของโปรเจกต์ "${job.project}" เสร็จครบแล้ว เข้าไปเลือกภาพได้เลย`);
    return { done: true, left: left.n };
  } catch (e) {
    const msg = String(e.message || e);
    if (e.allQuota || isQuota(msg)) {
      await env.DB.prepare("UPDATE jobs SET status='queued' WHERE id=?").bind(job.id).run();
      if (!e.allQuota) await setSetting(env, 'img_err', new Date().toISOString() + ' ' + msg.slice(0, 400));
      // เพิ่งผ่านเที่ยงคืน UTC ไม่นาน แต่ Cloudflare ยังบอกว่าโควตาหมด → ลองใหม่ทุก 30 นาที แทนที่จะรอข้ามวัน
      if (Date.now() >= +s.paused_until) await setSetting(env, 'paused_until', String(nextReset()));
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
      const full = b.raw ? pr : [s0.character, pr, '[[STYLE]]'].filter(x => x && x.trim()).join(', ');
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
  const safe = {}; for (const k in s) if (!/key|token|secret|pass/i.test(k)) safe[k] = s[k]; // ไม่ส่งรหัส/token ไปที่เบราว์เซอร์
  const fk = (await env.DB.prepare('SELECT name,on_,paused_until,n,day FROM fluxkeys').all().catch(() => ({ results: [] }))).results;
  return { settings: safe, jobs: q.results, images: im.results, notices: n.results, now: Date.now(), hasPassword: !!env.PASSWORD, helpers: fk.filter(k => +k.on_).map(k => ({ name: k.name, ready: +k.paused_until < Date.now(), n: +k.n || 0, day: k.day })) };
}

async function getImage(env, id) {
  const r = await env.DB.prepare('SELECT data FROM images WHERE id=?').bind(id).first();
  if (!r) return new Response('not found', { status: 404 });
  const bytes = b64ToBytes(r.data);
  const type = bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png' : bytes[0] === 0x52 && bytes[8] === 0x57 ? 'image/webp' : 'image/jpeg';
  return new Response(bytes, { headers: { 'content-type': type, 'cache-control': 'private, max-age=31536000, immutable', ...CORS } }); // ภาพแต่ละเลขไม่เคยเปลี่ยน: ให้เครื่องผู้ใช้เก็บไว้ได้ยาว ไม่ต้องอ่านฐานข้อมูลซ้ำ และยังดูได้ตอนฐานข้อมูลเต็มโควตา
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
    env.DB.prepare('CREATE TABLE IF NOT EXISTS rmeter (day TEXT, tag TEXT, n INTEGER, c INTEGER, PRIMARY KEY(day,tag))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS qmeter (day TEXT, k TEXT, v REAL, PRIMARY KEY(day,k))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS voices (id INTEGER PRIMARY KEY AUTOINCREMENT, shot INTEGER, line INTEGER, data TEXT, mime TEXT, created INTEGER, UNIQUE(shot,line))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS notices (id INTEGER PRIMARY KEY AUTOINCREMENT, msg TEXT, created INTEGER)'),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS vjobs (id INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT, ep TEXT, shot TEXT, prompt TEXT, neg TEXT, image TEXT, frames INTEGER, status TEXT DEFAULT 'queued', error TEXT, tries INTEGER DEFAULT 0, created INTEGER, started INTEGER, kind TEXT DEFAULT 'gen', opt TEXT, helper INTEGER DEFAULT 0)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS char_profiles (name TEXT PRIMARY KEY, data TEXT, updated INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS fluxkeys (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, acct TEXT, token TEXT, on_ INTEGER DEFAULT 0, paused_until INTEGER DEFAULT 0, day TEXT, n INTEGER DEFAULT 0, last_err TEXT, created INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS aud_cands (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT, name TEXT, age INTEGER, traits TEXT, intro TEXT, look TEXT, chosen INTEGER DEFAULT 0, created INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS story_assets (id INTEGER PRIMARY KEY AUTOINCREMENT, story TEXT, cat TEXT, image_id INTEGER, cand_id INTEGER, label TEXT, created INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS flipbooks (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, descr TEXT, n INTEGER, seed INTEGER, status TEXT, created INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS sfx_real (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, mime TEXT, size INTEGER, data TEXT, created INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS manual_tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, title TEXT, descr TEXT, prompt TEXT, pri INTEGER DEFAULT 50, status TEXT DEFAULT 'todo', image_id INTEGER DEFAULT 0, created INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS helpers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, key TEXT UNIQUE, on_ INTEGER DEFAULT 1, created INTEGER, seen INTEGER DEFAULT 0, done INTEGER DEFAULT 0, cur TEXT DEFAULT '')"),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER, project TEXT, ep TEXT, shot TEXT, prompt TEXT, size INTEGER, sec INTEGER, w INTEGER, h INTEGER, created INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS vchunks (vid INTEGER, idx INTEGER, data TEXT, PRIMARY KEY (vid, idx))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS vlog (id INTEGER PRIMARY KEY AUTOINCREMENT, msg TEXT, created INTEGER)'),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS casting (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT, cat TEXT DEFAULT 'char', name TEXT, descr TEXT, prompt TEXT, status TEXT DEFAULT 'pending', created INTEGER)"),
  ]);
  for (const q of ['ALTER TABLE jobs ADD COLUMN seed INTEGER', 'ALTER TABLE jobs ADD COLUMN eng TEXT', 'ALTER TABLE aud_cands ADD COLUMN kept INTEGER DEFAULT 0', 'ALTER TABLE aud_cands ADD COLUMN cast_role TEXT', 'ALTER TABLE aud_cands ADD COLUMN cast_story TEXT', 'ALTER TABLE aud_cands ADD COLUMN char_id INTEGER DEFAULT 0']) await env.DB.prepare(q).run().catch(() => {});
  await env.DB.batch(['images(project)', 'jobs(project)', 'jobs(status)', 'vjobs(status)', 'vjobs(project)', 'vjobs(ep,shot)', 'videos(ep,shot)'].map((x, i) => env.DB.prepare(`CREATE INDEX IF NOT EXISTS ix_a${i} ON ${x}`))).catch(() => { });
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
      if ((+s[readDay()] || 0) > READ_KSTOP) return json({ job: null, paused: 'reads' }); // ถึง 95%: ไม่จ่ายงานใหม่ เครื่องทำงานที่ถืออยู่ให้จบแล้วปิดเอง ทำต่อพรุ่งนี้
      // เครื่องที่ถือสคริปต์รุ่นเก่า (ไม่ส่ง v หรือ v<2) หรือเครื่องที่ติดตั้งตัวเทรนไม่ผ่านในรอบนี้ → ไม่จ่ายงานเทรน LoRA ให้ (รอเครื่องรอบใหม่)
      const cpuK = url.searchParams.get('cpu') === '1' ? 1 : 0, kv0 = +url.searchParams.get('v') || 0, gpuNoCat = !cpuK && kv0 >= 6 && s.v_cpu !== '0' ? 1 : 0, noTts = kv0 < 7 ? 1 : 0; // เครื่อง CPU (ไม่จำกัดชั่วโมง) รับเฉพาะงานรวมตอน/รวมคลิป · เครื่อง GPU ไม่รับงานพวกนี้
      const kv = +url.searchParams.get('v') || 0, noLora = kv < 4 || s.lora_go !== '1' || url.searchParams.get('nolora') === '1' ? 1 : 0 /* lora_go: เปิดให้เทรนเมื่อชุดฝึกสไตล์ใหม่พร้อม */, noCat = kv < 5 ? 1 : 0; // งานรวมตอน (epcat) ต้องใช้สคริปต์รุ่น 3 ขึ้นไป
      await env.DB.prepare("UPDATE vjobs SET status='queued' WHERE status='running' AND started < ?").bind(Date.now() - 150 * 60000).run();
      const j = await env.DB.prepare("UPDATE vjobs SET status='running', started=?, tries=tries+1, helper=? WHERE id=(SELECT id FROM vjobs WHERE status='queued' AND (?3=0 OR kind<>'lora') AND (?4=0 OR kind<>'epcat') AND (?5=0 OR kind IN ('epcat','concat','tts')) AND (?6=0 OR kind NOT IN ('epcat','concat','tts')) AND (?7=0 OR kind<>'tts') AND (?8=0 OR json_extract(opt,'$.engine') IS NOT 'schnell') AND (?9=0 OR COALESCE(json_extract(opt,'$.engine'),'') NOT IN ('hybrid','cn','s3d')) AND (?10=0 OR kind<>'song') AND (?11=0 OR json_extract(opt,'$.refimg') IS NULL) AND NOT (kind='lora' AND EXISTS (SELECT 1 FROM vjobs r WHERE r.kind='lora' AND r.status='running')) ORDER BY (kind='img'), CASE WHEN kind='lora' THEN COALESCE(json_extract(opt,'$.pri'),1) END, CASE WHEN kind='img' AND project LIKE 'อ้างอิง·%' THEN 0 WHEN kind='img' AND project LIKE 'ฉาก%·%' THEN CAST(substr(project,4,instr(project,'·')-4) AS INTEGER) WHEN kind='img' THEN 999999 END, CASE WHEN kind='img' AND project LIKE 'ฉาก%·%' THEN CAST(substr(project,instr(project,'·')+1) AS INTEGER) END, CASE WHEN kind='img' THEN COALESCE(json_extract(opt,'$.engine'),'') END, id LIMIT 1) AND status='queued' RETURNING id,project,ep,shot,prompt,neg,frames,kind,opt").bind(Date.now(), hid, noLora, noCat, cpuK, gpuNoCat, noTts, kv0 < 8 ? 1 : 0, kv0 < 13 ? 1 : 0, kv0 < 15 ? 1 : 0, kv0 < 15 ? 1 : 0).first(); // แบบผสมรุ่นแก้ (สีเต็ม ตุ๊กตาตามบท) ต้องใช้สคริปต์รุ่น 10 // เครื่องรุ่นเก่า (<v8) ไม่รู้จัก FLUX.1-schnell → ไม่ให้รับงานนั้น
      if (hid) await env.DB.prepare('UPDATE helpers SET seen=?, cur=? WHERE id=?').bind(Date.now(), j ? String(j.project).slice(0, 120) : '', hid).run();
      if (!j) return json({});
      try { j.opt = JSON.parse(j.opt || '{}'); } catch { j.opt = {}; }
      if (+j.opt.refimg) j.opt.ref = (s.self_url || url.origin) + '/vi/' + (+j.opt.refimg) + '?s=' + await vvSig(env, 'i' + (+j.opt.refimg)); // ภาพอ้างอิงที่ผู้ใช้เลือก → ลิงก์มีลายเซ็นให้เครื่องดึง (IP-Adapter)
      if (!hid) await setSetting(env, 'k_seen', String(Date.now()));
      return json({ job: j });
    }
    if (p.startsWith('/k/img/')) {
      const r = await env.DB.prepare('SELECT image FROM vjobs WHERE id=?').bind(id).first();
      if (!r) return new Response('not found', { status: 404 });
      return new Response(b64ToBytes(r.image), { headers: { 'content-type': 'image/jpeg' } });
    }
    if (p.startsWith('/k/limg/')) { // รูปในชุดเทรน LoRA ให้เครื่อง Kaggle ดึง
      await animeSchema(env);
      const j = await env.DB.prepare('SELECT opt FROM vjobs WHERE id=? AND kind=\'lora\'').bind(id).first(); let o = {}; try { o = JSON.parse((j && j.opt) || '{}'); } catch { o = {}; }
      const iid = +p.split('/')[4];
      if (!j || !(o.images || []).some(x => x.id === iid)) return new Response('not found', { status: 404 });
      const r = await env.DB.prepare('SELECT data FROM images WHERE id=?').bind(iid).first();
      return r ? new Response(b64ToBytes(r.data), { headers: { 'content-type': 'image/jpeg' } }) : new Response('not found', { status: 404 });
    }
    if (p.startsWith('/k/prog/')) { // ความคืบหน้าเทรน LoRA จากเครื่อง Kaggle (สเต็ป/ทั้งหมด/บรรทัดล่าสุด)
      const b = await req.json().catch(() => ({}));
      await setSetting(env, 'lprog:' + id, JSON.stringify({ step: +b.step || 0, total: +b.total || 0, tail: String(b.tail || '').slice(-400), at: Date.now() }));
      const lj = await env.DB.prepare("SELECT status FROM vjobs WHERE id=?").bind(id).first(); // งานถูกยกเลิก (ลบ/ไม่ได้รันอยู่) → บอกเครื่องให้หยุดเทรนทันที ไม่เปลือง GPU
      return json({ ok: true, ...(!lj || lj.status !== 'running' ? { stop: 1 } : {}) });
    }
    if (p.startsWith('/k/lora/')) { // รับไฟล์ LoRA ที่เทรนเสร็จ → เก็บเป็นก้อนใน D1 (ฟรี ไม่ต้องใช้ที่เก็บเพิ่ม)
      await animeSchema(env);
      const l = await env.DB.prepare('SELECT id FROM loras WHERE vjob=?').bind(id).first();
      const buf = new Uint8Array(await req.arrayBuffer());
      if (!l) return json({ error: 'no lora' }, 404);
      const part = url.searchParams.get('part');
      if (part != null) { // ส่งเป็นท่อน (ท่อนละ ~20 MB) ไปเก็บที่ Supabase Storage
        const of = Math.max(1, +url.searchParams.get('of') || 1), size = +url.searchParams.get('size') || 0;
        const r = await supa(s, 'POST', `l${l.id}_${+part}`, buf); if (!r) return json({ error: 'ยังไม่ได้ตั้งที่เก็บไฟล์ LoRA' }, 500);
        if (!r.ok) return json({ error: 'เก็บไฟล์ LoRA ไม่สำเร็จ: ' + r.status + ' ' + (await r.text()).slice(0, 200) }, 502);
        if (+part + 1 >= of) {
          await setSetting(env, 'lparts:' + l.id, of + ',' + size);
          await env.DB.batch([env.DB.prepare('DELETE FROM lchunks WHERE lid=?').bind(l.id), env.DB.prepare("UPDATE loras SET status='ready', size=?, error=NULL WHERE id=?").bind(size, l.id)]);
          await notify(env, `🧬 เทรน LoRA ตัวละครเสร็จแล้ว (${Math.round(size / 1048576)} MB) เข้าไปเลือกใช้ในเรื่องได้เลย`);
        }
        return json({ ok: true, lid: l.id });
      }
      if (buf.length < 100000) return json({ error: 'ไฟล์ LoRA เล็กผิดปกติ' }, 400);
      await env.DB.prepare('DELETE FROM lchunks WHERE lid=?').bind(l.id).run();
      const st = [];
      for (let i = 0, n = 0; i < buf.length; i += VCHUNK, n++) st.push(env.DB.prepare('INSERT INTO lchunks (lid,idx,data) VALUES (?,?,?)').bind(l.id, n, bytesToB64(buf.subarray(i, i + VCHUNK))));
      await env.DB.batch(st);
      await env.DB.prepare("UPDATE loras SET status='ready', size=?, error=NULL WHERE id=?").bind(buf.length, l.id).run();
      await notify(env, `🧬 เทรน LoRA ตัวละครเสร็จแล้ว (${Math.round(buf.length / 1048576)} MB) เข้าไปเลือกใช้ในเรื่องได้เลย`);
      return json({ ok: true });
    }
    if (p.startsWith('/k/lget/')) { // ให้เครื่อง Kaggle ดึง LoRA ไปใช้ตอนสร้างภาพ/ซีน (id = id ของ LoRA)
      await animeSchema(env);
      const lp = String(s['lparts:' + id] || '').split(','), ln = +lp[0] || 0;
      if (url.searchParams.get('info')) return json({ parts: ln, size: +lp[1] || 0 });
      if (ln) { const r = await supa(s, 'GET', `l${id}_${+url.searchParams.get('part') || 0}`); if (!r || !r.ok) return new Response('storage ' + (r ? r.status : 'off'), { status: 502 }); return new Response(r.body, { headers: { 'content-type': 'application/octet-stream' } }); }
      const rows = (await env.DB.prepare('SELECT data FROM lchunks WHERE lid=? ORDER BY idx').bind(id).all()).results;
      if (!rows.length) return new Response('not found', { status: 404 });
      const parts = rows.map(r => b64ToBytes(r.data)); const out = new Uint8Array(parts.reduce((a, x) => a + x.length, 0)); let o = 0; for (const x of parts) { out.set(x, o); o += x.length; }
      return new Response(out, { headers: { 'content-type': 'application/octet-stream' } });
    }
    if (p.startsWith('/k/vo/')) { // เครื่อง CPU ส่งเสียงพากย์มาทีละบรรทัด
      const j = await env.DB.prepare("SELECT id FROM vjobs WHERE id=? AND kind='tts'").bind(id).first(); if (!j) return json({ error: 'no job' }, 404);
      const buf = new Uint8Array(await req.arrayBuffer()); if (buf.length < 200) return json({ error: 'ไฟล์เสียงเล็กผิดปกติ' }, 400);
      await env.DB.prepare('INSERT OR REPLACE INTO voices (shot,line,data,mime,created) VALUES (?,?,?,?,?)').bind(+url.searchParams.get('shot'), +url.searchParams.get('line'), bytesToB64(buf), 'audio/mp4', Date.now()).run();
      return json({ ok: true });
    }
    if (p.startsWith('/k/song/')) { // เพลงจาก ACE-Step (ก่อน/หลังเทรน LoRA เสียงร้อง) → เก็บเป็นไฟล์เสียงในคลังเสียง
      const j = await env.DB.prepare("SELECT id,opt FROM vjobs WHERE id=? AND kind='song'").bind(id).first(); if (!j) return json({ error: 'no job' }, 404);
      const buf = new Uint8Array(await req.arrayBuffer()); if (buf.length < 2000) return json({ error: 'ไฟล์เพลงเล็กผิดปกติ' }, 400);
      const i = +url.searchParams.get('i') || 0, tag = url.searchParams.get('tag') === 'lora' ? 'lora' : 'base', shot = -(100000 + id * 10 + i + (tag === 'lora' ? 5 : 0));
      await env.DB.prepare('INSERT OR REPLACE INTO voices (shot,line,data,mime,created) VALUES (?,0,?,?,?)').bind(shot, bytesToB64(buf), 'audio/mp4', Date.now()).run();
      const v = await env.DB.prepare('SELECT id FROM voices WHERE shot=? AND line=0').bind(shot).first();
      let o = {}; try { o = JSON.parse(j.opt || '{}'); } catch { }
      const L = JSON.parse((await getSettings(env)).songs || '[]'); L.push({ vid: v.id, job: id, i, tag, title: ((o.songs || [])[i] || {}).title || 'เพลง ' + (i + 1), story: o.story || '', at: Date.now() }); await setSetting(env, 'songs', JSON.stringify(L.slice(-40)));
      return json({ ok: true });
    }
    if (p.startsWith('/k/sblob/')) { // ไฟล์ LoRA เสียงร้อง → Supabase Storage (ท่อนละ ~20 MB)
      const j = await env.DB.prepare("SELECT id FROM vjobs WHERE id=? AND kind='song'").bind(id).first(); if (!j) return json({ error: 'no job' }, 404);
      const part = +url.searchParams.get('part') || 0, of = +url.searchParams.get('of') || 1, r = await supa(s, 'POST', `songlora_${id}_${part}`, new Uint8Array(await req.arrayBuffer()));
      if (!r || !r.ok) return json({ error: 'เก็บไฟล์ไม่สำเร็จ ' + (r ? r.status : 'off') }, 502);
      if (part + 1 >= of) await setSetting(env, 'songlora', JSON.stringify({ job: id, of, at: Date.now() }));
      return json({ ok: true });
    }
    if (p.startsWith('/k/done/')) {
      const j = await env.DB.prepare('SELECT * FROM vjobs WHERE id=?').bind(id).first();
      if (!j) return json({ error: 'no job' }, 404);
      if (j.kind === 'song') { await env.DB.prepare('DELETE FROM vjobs WHERE id=?').bind(id).run(); return json({ ok: true }); }
      if (j.kind === 'tts') { await env.DB.prepare('DELETE FROM vjobs WHERE id=?').bind(id).run(); return json({ ok: true }); }
      if (j.kind === 'lora') { await env.DB.prepare("UPDATE vjobs SET status='done' WHERE id=?").bind(id).run(); return json({ ok: true }); }
      const buf = new Uint8Array(await req.arrayBuffer());
      if (buf.length < 1000) return json({ error: 'ไฟล์เล็กผิดปกติ' }, 400);
      if (j.kind === 'img') { // ภาพ FLUX.1-dev จาก Kaggle → เข้าคลังภาพเหมือนภาพ Flux
        let o = {}; try { o = JSON.parse(j.opt || '{}'); } catch { o = {}; }
        const jb = o.jobId ? await env.DB.prepare('SELECT prompt FROM jobs WHERE id=?').bind(o.jobId).first() : null;
        await env.DB.batch([
          env.DB.prepare('INSERT INTO images (job_id,project,scene,prompt,data,starred,created) VALUES (?,?,?,?,?,0,?)').bind(+o.jobId || 0, j.project, +o.scene || 0, jb ? jb.prompt : j.prompt, bytesToB64(buf), Date.now()),
          env.DB.prepare('DELETE FROM jobs WHERE id=?').bind(+o.jobId || 0),
          env.DB.prepare('DELETE FROM vjobs WHERE id=?').bind(id),
        ]);
        if (String(j.project).startsWith('ฉาก')) await env.DB.prepare('DELETE FROM images WHERE project=?1 AND id<(SELECT MAX(id) FROM images WHERE project=?1)').bind(j.project).run().catch(() => {});
        if (hid) await env.DB.prepare('UPDATE helpers SET done=done+1, seen=?, cur=? WHERE id=?').bind(Date.now(), '', hid).run();
        return json({ ok: true, img: true });
      }
      const v = await env.DB.prepare('INSERT INTO videos (job_id,project,ep,shot,prompt,size,sec,w,h,created) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .bind(id, j.project, j.ep, j.shot, j.prompt, buf.length, +url.searchParams.get('sec') || 0, +url.searchParams.get('w') || 0, +url.searchParams.get('h') || 0, Date.now()).run();
      const vid = v.meta.last_row_id, st = [];
      for (let i = 0, n = 0; i < buf.length; i += VCHUNK, n++)
        st.push(env.DB.prepare('INSERT INTO vchunks (vid,idx,data) VALUES (?,?,?)').bind(vid, n, bytesToB64(buf.subarray(i, i + VCHUNK))));
      for (let i = 0; i < st.length; i += 8) await env.DB.batch(st.slice(i, i + 8)); // ไฟล์ตอนเต็มมีหลายก้อน: ส่งทีละ 8 ก้อน กันคำสั่งใหญ่เกิน
      await env.DB.prepare("UPDATE vjobs SET status='done', image='' WHERE id=?").bind(id).run();
      if (hid) await env.DB.prepare("UPDATE helpers SET done=done+1, seen=?, cur='' WHERE id=?").bind(Date.now(), hid).run();
      const left = await env.DB.prepare("SELECT COUNT(*) n FROM vjobs WHERE status IN ('queued','running')").first();
      if (left.n === 0) await notify(env, `🎞️ วิดีโอของ "${j.project}" ทำเสร็จครบแล้ว เข้าไปเลือกคลิปในหน้าช็อตได้เลย`);
      return json({ ok: true, vid });
    }
    if (p.startsWith('/k/fail/')) {
      const b = await req.json().catch(() => ({}));
      const j = await env.DB.prepare('SELECT tries,shot,project,kind,opt FROM vjobs WHERE id=?').bind(id).first();
      if (!j) return json({ ok: true });
      const again = j.kind === 'lora' ? j.tries < 4 : (b.requeue || j.tries < 2);
      await env.DB.prepare('UPDATE vjobs SET status=?, error=? WHERE id=?').bind(again ? 'queued' : 'failed', String(b.error || '').slice(0, 500), id).run();
      if (j.kind === 'lora' && !again) await env.DB.prepare("UPDATE loras SET status='failed', error=? WHERE vjob=?").bind(String(b.error || '').slice(0, 500), id).run().catch(() => {});
      if (j.kind === 'img' && !again) { // ภาพ Kaggle พังซ้ำ → ส่งให้ Flux ทำแทน และกันไม่ให้ซ่อมอัตโนมัติซ้ำจนได้ภาพซ้อน
        let o = {}; try { o = JSON.parse(j.opt || '{}'); } catch { o = {}; }
        if (o.jobId) await env.DB.prepare("UPDATE jobs SET status='queued', eng='flux' WHERE id=?").bind(+o.jobId).run();
        await env.DB.prepare('UPDATE vjobs SET tries=99 WHERE id=?').bind(id).run();
        return json({ ok: true });
      }
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
// ความยาวคลิป 2–5 วินาที (ค่าเริ่ม 3) → จำนวนเฟรมแบบ 4k+1 ที่ 16 fps
function vFrames(sec, max = 5) { const s = Math.min(max, Math.max(2, +sec || 3)); return Math.round(s * 16 / 4) * 4 + 1; }
async function vApi(req, env, url, ctx, body) {
  const p = url.pathname;
  kEnv(env, await getSettings(env));
  if (p === '/api/vstate') {
    const s = await getSettings(env);
    const jobs = (await env.DB.prepare("SELECT id,project,ep,shot,status,error,tries,created,started,kind FROM vjobs WHERE status NOT IN ('done','hold') AND COALESCE(kind,'')<>'img' ORDER BY id LIMIT 300").all()).results;
    const videos = (await env.DB.prepare('SELECT id,job_id,project,ep,shot,prompt,size,sec,w,h,created FROM videos ORDER BY id DESC LIMIT 500').all()).results;
    const logs = (await env.DB.prepare('SELECT msg,created FROM vlog ORDER BY id DESC LIMIT 12').all()).results;
    const ic = (await env.DB.prepare("SELECT status, COUNT(*) n FROM vjobs WHERE kind='img' AND status IN ('queued','running') GROUP BY status").all()).results;
    const imgs = { q: +((ic.find(x => x.status === 'queued') || {}).n) || 0, r: +((ic.find(x => x.status === 'running') || {}).n) || 0 };
    const helpers = (await env.DB.prepare('SELECT id,name,key,on_,created,seen,done,cur FROM helpers ORDER BY id').all()).results;
    return json({ jobs, videos, logs, helpers, imgs, now: Date.now(), kaggle: { configured: !!(env.KAGGLE_USERNAME && env.KAGGLE_KEY), user: env.KAGGLE_USERNAME || '', hasKey: !!env.KAGGLE_KEY, status: s.k_status || '', checked: +s.k_checked || 0, pushed: +s.k_pushed || 0, seen: +s.k_seen || 0, error: s.k_error || '' } });
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
        .bind(String(body.project || 'โปรเจกต์').slice(0, 60), String(body.ep || ''), String(it.shot ?? ''), String(it.prompt || '').slice(0, 2000), String(it.neg || VNEG).slice(0, 800), img, vFrames(it.frames ? (+it.frames - 1) / 16 : 3, 15), Date.now(), opt)); // ช็อตยาวสูงสุด 15 วิ (kernel เจนต่อกันทีละ 5 วิ)
    }
    if (!st.length) return json({ error: 'ไม่มีช็อตที่มีภาพคีย์' });
    await env.DB.batch(st);
    ctx.waitUntil(vTick(env, true));
    return json({ ok: true, added: st.length });
  }
  if (p === '/api/vconcat') {
    let urls = (Array.isArray(body.urls) ? body.urls : []).filter(u => /^https:\/\//.test(u)).slice(0, 400);
    if (Array.isArray(body.vids) && body.vids.length) { // รวมจากคลิปในบอทโดยตรง (ไม่ต้องอัปโหลดขึ้น Supabase)
      const og = (await getSettings(env)).self_url || url.origin;
      urls = [];
      for (const v of body.vids.slice(0, 400)) { const id = +v; if (id) urls.push(og + '/vv/' + id + '?s=' + await vvSig(env, id)); }
    }
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
  const s = await getSettings(env), now = Date.now(), cpuOff = s.v_cpu !== '0';
  const q = await env.DB.prepare("SELECT COUNT(*) n, MIN(created) t0 FROM vjobs WHERE status='queued' AND (?1=0 OR kind NOT IN ('epcat','concat','tts'))").bind(cpuOff ? 1 : 0).first();
  if (!q.n) return { skipped: 'empty' };
  // รวมงานก่อนเปิดเครื่อง: เปิดแต่ละรอบเสียเวลาโหลดโมเดล ~15 นาที (นับเป็นโควตา) → รอให้มีงาน ≥6 ชิ้น หรืองานแรกรอเกิน 20 นาที
  if (!force && q.n < 6 && now - (+q.t0 || now) < 20 * 60000 && !/running|queued|starting/.test(String(s.k_status || ''))) return { skipped: 'batching ' + q.n };
  if (!force && now - (+s.k_checked || 0) < 120000) return { skipped: 'wait' };
  if (now < (+s.k_pause || 0)) return { skipped: 'paused' };
  await setSetting(env, 'k_checked', String(now));
  const slug = `${env.KAGGLE_USERNAME}/${KSLUG}`;
  const stt = await kFetch(env, `/kernels/status?userName=${encodeURIComponent(env.KAGGLE_USERNAME)}&kernelSlug=${KSLUG}`);
  const status = String((stt.j && stt.j.status) || (stt.ok ? '' : 'none')).toLowerCase();
  if (/running|starting|queued/.test(String(s.k_status || '')) && !/running|queued/.test(status) && +s.k_pushed) await qadd(env, 'kgh', Math.min(12, (now - +s.k_pushed) / 3600000), kgWeek(+s.k_pushed)); // รอบเครื่องจบ: บวกชั่วโมงที่ใช้ (นับจากตอนสั่งเปิดถึงตอนเห็นว่าจบ ≈ เกินจริงเล็กน้อย)
  await setSetting(env, 'k_status', status);
  if (/running|queued/.test(status)) {
    // กันกรณีเครื่องค้าง: ถ้าไม่ได้ยินเสียงจาก kernel เกิน 90 นาที ปล่อยให้รอบต่อไปจัดการ
    return { running: true, status };
  }
  if (now - (+s.k_pushed || 0) < 5 * 60000) return { skipped: 'recently pushed', status };
  if (/error/.test(status) && stt.j && stt.j.failureMessage) await setSetting(env, 'k_error', String(stt.j.failureMessage).slice(0, 300));
  if (!s.ktoken) { s.ktoken = crypto.randomUUID().replace(/-/g, ''); await setSetting(env, 'ktoken', s.ktoken); }
  if (!s.self_url) return { error: 'ยังไม่รู้ลิงก์ของบอท เปิดหน้าสตูดิโอ 1 ครั้งก่อน' };
  const text = KAGGLE_PY.replace('__API__', s.self_url).replace('__TOKEN__', s.ktoken).replace('__MAXH__', '10').replace('__QUANT__', s.k_quant || 'Q4_K_M').replace('__CPU__', '0');
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

async function vvSig(env, id) {
  const s = await getSettings(env);
  let kt = s.ktoken;
  if (!kt) { kt = crypto.randomUUID().replace(/-/g, ''); await setSetting(env, 'ktoken', kt); }
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(kt + ':vv:' + id));
  return [...new Uint8Array(h)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---- ผังเสียงพากย์เริ่มต้น (VOICEVOX ฟรี ใส่เครดิต "VOICEVOX:ชื่อ") · sp = ชื่อต้นเสียง, st = สไตล์, speed/pitch/into/vol = ปรับเสียง, emo = สไตล์ตามอารมณ์เฉพาะตัว ----
// ผังเสียงตัวละคร (Character Voice Direction): d = คำกำกับเสียงภาษาไทย · sp/st = นักพากย์ VOICEVOX/สไตล์ · speed/pitch/into/vol = ความเร็ว/ระดับเสียง/ขึ้นลง/ความดัง
// pre/post = ช่องหายใจก่อน/หลังประโยค (วินาที) · gap = เว้นหลังพูดจบ (วินาที) · emo = ปรับตามอารมณ์ (n ปกติ h ดีใจ s เศร้า a โกรธ w กังวล x ตกใจ t แซว d อ่อนโยน)
const VCAST_DEFAULT = {
  // ผู้บรรยาย 7 แบบ (เลือกตามแนวของช่อง: nv ในบรรทัด) — narrator = เล่าเรื่องอบอุ่น (ค่าเริ่มต้น) · narrator2 = มืดหม่น (ชื่อเดิม)
  narrator: { sp: '雨晴はう', st: 'ノーマル', speed: 0.93, pitch: 0, into: 0.95, pre: 0.12, post: 0.25, gap: 0.5, d: { id: 'Storyteller · ผู้เล่าเรื่องอบอุ่น นุ่มนวล ชวนติดตาม', tone: 'นุ่ม ใส อบอุ่น', pitch: 'กลาง', speed: 'ช้ากว่าปกตินิด', accent: 'ญี่ปุ่นมาตรฐาน (โตเกียว)', emo: 'เรียบ มีรอยยิ้มในเสียง', breath: 'หายใจเข้าก่อนประโยคยาว', trait: 'ออกเสียงชัด ไม่รีบ' } },
  n_cine: { sp: '†聖騎士 紅桜†', st: 'ノーマル', speed: 0.86, pitch: -0.04, into: 1.1, pre: 0.2, post: 0.4, gap: 0.7, d: { id: 'Cinematic · ทุ้ม ลึก ทรงพลัง แบบตัวอย่างภาพยนตร์', tone: 'ทุ้มหนัก', pitch: 'ต่ำ', speed: 'ช้า เว้นจังหวะ', accent: 'มาตรฐาน', emo: 'หนักแน่น', breath: 'ลมหายใจยาวก่อนประโยค', trait: 'ก้องแบบโรงหนัง' } },
  n_anime: { sp: '四国めたん', st: 'ノーマル', speed: 1.02, pitch: 0.01, into: 1.35, pre: 0.08, post: 0.18, gap: 0.4, d: { id: 'Anime · เสียงมีเอกลักษณ์ ขึ้นลงแบบอนิเมะ', tone: 'สดใส มีสีสัน', pitch: 'กลาง-สูง', speed: 'ปกติ', accent: 'มาตรฐาน', emo: 'แสดงอารมณ์ชัด ขำได้', breath: 'สั้น', trait: 'จังหวะเล่นมุก' } },
  n_dark: { sp: '青山龍星', st: 'しっとり', speed: 0.8, pitch: -0.06, into: 0.7, vol: 0.92, pre: 0.25, post: 0.45, gap: 0.8, d: { id: 'Dark · ต่ำ ลึกลับ เยือกเย็น แนวสยองขวัญ', tone: 'ต่ำ เย็น', pitch: 'ต่ำมาก', speed: 'ช้ามาก', accent: 'มาตรฐาน', emo: 'นิ่ง กดดัน', breath: 'ลมหายใจกระซิบ', trait: 'เว้นเงียบก่อนคำสำคัญ' } },
  n_doc: { sp: '雀松朱司', st: 'ノーマル', speed: 0.97, pitch: 0, into: 0.9, pre: 0.1, post: 0.25, gap: 0.5, d: { id: 'Documentary · ชัดเจน สุขุม น่าเชื่อถือ', tone: 'เรียบ ชัด', pitch: 'กลาง-ต่ำ', speed: 'ปกติ', accent: 'มาตรฐาน', emo: 'เป็นกลาง', breath: 'สม่ำเสมอ', trait: 'แบบสารคดี' } },
  n_emo: { sp: '小夜/SAYO', st: 'ノーマル', speed: 0.88, pitch: 0, into: 1.15, pre: 0.15, post: 0.45, gap: 0.8, d: { id: 'Emotional · สื่ออารมณ์ลึกซึ้ง มีน้ำหนักทุกประโยค', tone: 'นุ่ม ลึก', pitch: 'กลาง', speed: 'ช้า', accent: 'มาตรฐาน', emo: 'อ่อนไหว', breath: 'ถอนใจเบาๆ', trait: 'ลากเสียงท้ายประโยค' } },
  n_epic: { sp: '青山龍星', st: '熱血', speed: 0.9, pitch: -0.02, into: 1.35, pre: 0.15, post: 0.3, gap: 0.5, d: { id: 'Epic · ยิ่งใหญ่ ทรงพลัง ฉากสู้/แฟนตาซี', tone: 'ดัง กร้าว', pitch: 'ต่ำ-กลาง', speed: 'ปกติ หนักแน่น', accent: 'มาตรฐาน', emo: 'ฮึกเหิม', breath: 'ลมแรง', trait: 'เน้นคำ' } },
  narrator2: { sp: '青山龍星', st: 'しっとり', speed: 0.82, pitch: -0.05, into: 0.75, pre: 0.22, post: 0.4, gap: 0.7, d: { id: 'Dark (เดิม) · ผู้เล่าชายช่วงกลางคืน/เรื่องหลอน', tone: 'ทุ้ม ต่ำ ลึกลับ', pitch: 'ต่ำ', speed: 'ช้า', accent: 'ญี่ปุ่นมาตรฐาน', emo: 'นิ่ง กดดัน', breath: 'ลมหายใจยาว', trait: 'เสียงก้องในอก' }, emo: { w: { speed: 0.78, vol: 0.85 } } },
  'โทวะ': { sp: '玄野武宏', st: 'ノーマル', speed: 1.02, pitch: 0, into: 1.15, pre: 0.08, post: 0.15, gap: 0.35, d: { id: 'เสมียนหนุ่มหน้าเด็ก ใจดี ขี้เกรงใจ ขอโทษเก่ง', tone: 'สุภาพ อบอุ่น ลนง่าย', pitch: 'กลาง-สูงนิด', speed: 'ปกติ เร็วขึ้นตอนตกใจ/ลน', accent: 'ญี่ปุ่นมาตรฐาน สุภาพ (ですます)', emo: 'แสดงออกชัด ตกใจเสียงแตก เขินแล้วติดอ่าง', breath: 'ถอนหายใจบ่อย', trait: 'เสียงหนุ่ม ไม่ทุ้ม พูดในใจเบาและก้อง' }, emo: { x: { speed: 1.15, into: 1.35 }, w: { speed: 0.95, vol: 0.9 }, s: { speed: 0.92, into: 0.95 } } },
  'ริน': { sp: '九州そら', st: 'ノーマル', speed: 0.93, pitch: -0.03, into: 0.8, pre: 0.1, post: 0.2, gap: 0.45, d: { id: 'นักล่าอสูรยามค่ำ เย็นชา ปากแซ่บ / กลางวันเป็นพนักงานร้านขนมปังเสียงหวาน', tone: 'กลางคืน: ต่ำ เรียบ ห้วน · กลางวัน: หวาน สดใส', pitch: 'กลาง-ต่ำ (กลางวันสูงขึ้น)', speed: 'ช้า มั่นใจ', accent: 'ญี่ปุ่นมาตรฐาน ภาษากันเอง (タメ口) ตอนกลางคืน', emo: 'เก็บอารมณ์ ยิ้มด้วยเสียงตอนแซว', breath: 'หายใจสั้น นิ่ง', trait: 'คำลงท้ายสั้น ตัดจบ' }, emo: { d: { st: 'あまあま', pitch: 0.03, into: 1.25, speed: 1.05 }, t: { st: 'ツンツン', speed: 0.95 }, h: { into: 1.0 } } },
  'มิโอะ': { sp: '冥鳴ひまり', st: 'ノーマル', speed: 0.95, pitch: 0, into: 0.5, pre: 0.1, post: 0.2, gap: 0.6, d: { id: 'ลูกน้องหน้านิ่ง เย็นชา แอบใส่ใจ', tone: 'เรียบ แบน ไร้อารมณ์', pitch: 'กลาง', speed: 'ช้าเล็กน้อย เว้นวรรคก่อนตอบ', accent: 'ญี่ปุ่นมาตรฐาน สุภาพห้วน', emo: 'แทบไม่เปลี่ยน มุกกวนพูดหน้าตาย', breath: 'เงียบ ไม่ได้ยินลมหายใจ', trait: 'เสียงเบา ชัด เย็น' } },
  'หัวหน้าซาเอกิ': { sp: '波音リツ', st: 'ノーマル', speed: 0.88, pitch: -0.05, into: 0.85, pre: 0.12, post: 0.25, gap: 0.6, d: { id: 'หัวหน้าสาวสง่า น่าเกรงขาม ใจดีลึกๆ', tone: 'เย็น คม มีอำนาจ', pitch: 'ต่ำ', speed: 'ช้า หนักแน่น', accent: 'ญี่ปุ่นมาตรฐาน ภาษาผู้บังคับบัญชา', emo: 'คุมอารมณ์ ตอนห่วงเสียงเบาลง', breath: 'หายใจช้า มั่นคง', trait: 'ทุกคำชัด ไม่มีคำฟุ่มเฟือย' }, emo: { d: { speed: 0.85, vol: 0.85, into: 1.0 } } },
  'ป้าฮานะ': { sp: 'もち子さん', st: 'ノーマル', speed: 1.12, pitch: 0, into: 1.3, pre: 0.06, post: 0.12, gap: 0.3, d: { id: 'เจ้าของร้านขนมปัง ร่าเริง', tone: 'สดใส อบอุ่น', pitch: 'กลาง-สูง', speed: 'เร็ว', accent: 'ญี่ปุ่นมาตรฐานแบบคุณป้าใจดี', emo: 'หัวเราะง่าย', breath: 'หายใจเร็ว', trait: 'พูดยาวต่อเนื่อง' } },
  'ไค': { sp: '白上虎太郎', st: 'ふつう', speed: 1.1, pitch: 0.02, into: 1.3, d: { id: 'ตัวละครหนุ่มร่าเริง', tone: 'สดใส', pitch: 'สูง', speed: 'เร็ว', accent: 'มาตรฐาน', emo: 'ชัด', breath: 'สั้น', trait: 'พลังเยอะ' } },
  'ท่านเก็นโด': { sp: '麒ヶ島宗麟', st: 'ノーマル', speed: 0.85, pitch: 0, into: 0.9, gap: 0.6, d: { id: 'ผู้อาวุโสทรงอำนาจ', tone: 'ทุ้มหนัก', pitch: 'ต่ำมาก', speed: 'ช้า', accent: 'แบบเก่า', emo: 'นิ่ง', breath: 'ยาว', trait: 'น่าเกรงขาม' } },
  'เท็ตสึ': { sp: '青山龍星', st: 'ノーマル', speed: 0.95, pitch: -0.02, into: 1.0, d: { id: 'ชายหนุ่มแข็งแรง', tone: 'ทุ้ม', pitch: 'ต่ำ', speed: 'ปกติ', accent: 'มาตรฐาน', emo: 'ตรงไปตรงมา', breath: 'ปกติ', trait: 'หนักแน่น' } },
  'โมจิ': { sp: 'ずんだもん', st: 'あまあま', speed: 1.2, pitch: 0.12, into: 1.5, pre: 0.03, post: 0.08, gap: 0.25, d: { id: 'สัตว์วิญญาณกลมๆ หางตะเกียง พูดได้แค่ "มุจิ"', tone: 'แหลม น่ารัก', pitch: 'สูงมาก', speed: 'เร็ว', accent: '-', emo: 'ตามอารมณ์เกินจริง ขู่ฟ่อ/ดีใจ', breath: 'สั้นๆ ฟุดฟิด', trait: 'เสียงสัตว์เล็ก' } },
  'อสูร': { sp: 'No.7', st: 'ノーマル', speed: 0.8, pitch: -0.1, into: 0.6, pre: 0.2, post: 0.4, gap: 0.6, vol: 0.9, d: { id: 'อสูรสวมหน้ากาก เลียนเสียงคน', tone: 'แหบ เย็นเยียบ ขาดๆ หายๆ', pitch: 'ต่ำผิดธรรมชาติ', speed: 'ช้ามาก ลากคำ', accent: 'เลียนคนไม่เนียน', emo: 'ไม่มีอารมณ์', breath: 'ลมหายใจกระซิบ', trait: 'ก้องแบบผิดที่' } },
  'อสูรตัวเล็ก': { sp: 'No.7', st: 'ノーマル', speed: 1.1, pitch: 0.06, into: 1.2, d: { id: 'อสูรตัวจิ๋ว ขี้กลัว', tone: 'แหลมสั่น', pitch: 'สูง', speed: 'เร็ว', accent: '-', emo: 'กลัว', breath: 'หอบ', trait: 'เสียงสั่น' } },
  _m: { sp: '剣崎雌雄', st: 'ノーマル', speed: 1.0, pitch: -0.02, into: 1.0, d: { id: 'ตัวประกอบชาย' } },
  _f: { sp: '春日部つむぎ', st: 'ノーマル', speed: 1.0, pitch: 0, into: 1.0, d: { id: 'ตัวประกอบหญิง' } },
  _x: { sp: 'No.7', st: 'ノーマル', speed: 0.9, pitch: -0.08, into: 0.7, d: { id: 'อสูร/สิ่งที่ไม่ใช่คน' } },
};
// ผู้บรรยายคนเดียว + โทนตามบท: 7 แบบ = ส่วนต่างจากเสียงหลักของผู้บรรยาย (คูณด้วยความเข้มการพากย์ที่ผู้ใช้ตั้ง 0–1.5)
const NARR_TONE = {
  narrator: {}, // Storyteller: เสียงหลัก
  n_cine: { speed: -0.08, pitch: -0.03, into: 0.12, pre: 0.08, post: 0.15, gap: 0.2 },
  n_anime: { speed: 0.04, pitch: 0.02, into: 0.35 },
  n_dark: { speed: -0.13, pitch: -0.05, into: -0.3, vol: -0.08, pre: 0.1, post: 0.2, gap: 0.3, st: 'ささやき' },
  n_doc: { speed: 0.02, into: -0.12 },
  n_emo: { speed: -0.07, into: 0.22, post: 0.2, gap: 0.3 },
  n_epic: { speed: -0.04, pitch: -0.01, into: 0.4, vol: 0.08 },
};
NARR_TONE.narrator2 = NARR_TONE.n_dark;
// รายชื่อเสียง VOICEVOX ให้เลือกเป็นผู้บรรยาย/ตัวช่วยเล่าเรื่อง (g: m ชาย · f หญิง · c ตัวการ์ตูน/สัตว์)
const VV_VOICES = [['雨晴はう', 'f'], ['四国めたん', 'f'], ['春日部つむぎ', 'f'], ['冥鳴ひまり', 'f'], ['九州そら', 'f'], ['もち子さん', 'f'], ['WhiteCUL', 'f'], ['小夜/SAYO', 'f'], ['櫻歌ミコ', 'f'], ['春歌ナナ', 'f'], ['波音リツ', 'f'], ['No.7', 'f'], ['琴詠ニア', 'f'], ['中国うさぎ', 'f'],
  ['青山龍星', 'm'], ['†聖騎士 紅桜†', 'm'], ['雀松朱司', 'm'], ['玄野武宏', 'm'], ['白上虎太郎', 'm'], ['剣崎雌雄', 'm'], ['麒ヶ島宗麟', 'm'], ['ちび式じい', 'm'],
  ['ずんだもん', 'c'], ['猫使アル', 'c'], ['猫使ビィ', 'c'], ['あいえるたん', 'c'], ['満別花丸', 'c'], ['栗田まろん', 'c']];
const VV_SAMPLE = 'ここは響の町。結界の下で、静かに時を刻む小さな町だ。……でも今夜、何かが起きる。';
// แปลงผังเสียง: ผู้บรรยายทุกแบบ = เสียงเดียวกัน (cast.narrator) + โทนตามบท · companion = ตัวช่วยเล่าเรื่อง (สัตว์/มาสคอต) แยกเสียง
function castResolve(cast) {
  const c = { ...cast }, base = cast.narrator || VCAST_DEFAULT.narrator, k = Math.max(0, Math.min(1.5, cast.narrator && cast.narrator.k != null ? +cast.narrator.k : 1));
  for (const [key, t] of Object.entries(NARR_TONE)) {
    const o = { ...base, emo: undefined };
    for (const f of ['speed', 'pitch', 'into', 'vol', 'pre', 'post', 'gap']) if (t[f]) o[f] = Math.round(((+base[f] || (f === 'speed' || f === 'into' || f === 'vol' ? 1 : f === 'pre' ? 0.1 : f === 'post' ? 0.2 : f === 'gap' ? 0.5 : 0)) + t[f] * k) * 1000) / 1000;
    if (t.st && k >= 0.5) o.st = t.st; // เสียงกระซิบ (ถ้าผู้บรรยายคนนั้นมีสไตล์นี้ ไม่มีก็ใช้ปกติ)
    c[key] = o;
  }
  { const e = c.n_epic || base; c._title = { ...e, speed: Math.max(0.75, (+e.speed || 1) - 0.06), into: Math.min(2, (+e.into || 1) + 0.25), vol: 1.25, pre: 0.25, post: 0.5 }; } // เสียงพากย์ชื่อเรื่อง/ชื่อตอน: ช้าลงนิด เน้นคำ ดังขึ้น
  if (!c.companion) c.companion = { sp: 'ずんだもん', st: 'ノーマル', speed: 1.1, pitch: 0.06, into: 1.4, name: 'โมจิ' };
  return c;
}
// ---- เครื่อง CPU ของ Kaggle (ไม่จำกัดชั่วโมงต่อสัปดาห์): รับงานรวมตอน/ซับ/เสียงผสม/รวมคลิป ประหยัดโควตา GPU ----
async function cpuKTick(env) {
  const S = {}; for (const r of (await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('v_cpu','kc_status','kc_pushed','kc_checked','self_url','ktoken','k_quant','k_user','k_key')").all()).results) S[r.key] = r.value;
  if (S.v_cpu === '0') return { skipped: 'off' };
  const now = Date.now(); if (now - (+S.kc_checked || 0) < 120000) return { skipped: 'wait' };
  const q = ((await env.DB.prepare("SELECT COUNT(*) n FROM vjobs WHERE status='queued' AND kind IN ('epcat','concat','tts')").first()) || {}).n || 0;
  if (!q) return { skipped: 'empty' };
  await setSetting(env, 'kc_checked', String(now));
  const ke = { ...env }; kEnv(ke, S); if (!ke.KAGGLE_USERNAME || !ke.KAGGLE_KEY || !S.self_url || !S.ktoken) return { skipped: 'no kaggle' };
  const slug = KSLUG + '-cpu', st = await kFetch(ke, `/kernels/status?userName=${encodeURIComponent(ke.KAGGLE_USERNAME)}&kernelSlug=${slug}`);
  const status = String((st.j && st.j.status) || (st.ok ? '' : 'none')).toLowerCase(); await setSetting(env, 'kc_status', status);
  if (/running|queued/.test(status) || now - (+S.kc_pushed || 0) < 5 * 60000) return { running: true };
  const text = KAGGLE_PY.replace('__API__', S.self_url).replace('__TOKEN__', S.ktoken).replace('__MAXH__', '11').replace('__QUANT__', S.k_quant || 'Q4_K_M').replace('__CPU__', '1');
  const push = await kFetch(ke, '/kernels/push', { method: 'POST', body: JSON.stringify({ slug: `${ke.KAGGLE_USERNAME}/${slug}`, newTitle: slug, text, language: 'python', kernelType: 'script', isPrivate: true, enableGpu: false, enableTpu: false, enableInternet: true, datasetDataSources: [], competitionDataSources: [], kernelDataSources: [], modelDataSources: [], categoryIds: [] }) });
  await setSetting(env, 'kc_pushed', String(now));
  const err = !push.ok ? `Kaggle CPU ${push.status}: ${JSON.stringify(push.j).slice(0, 200)}` : (push.j && (push.j.error || push.j.errorMessage)) || '';
  if (err) { await setSetting(env, 'kc_status', 'error'); await env.DB.prepare('INSERT INTO vlog (msg,created) VALUES (?,?)').bind('⚠️ เปิดเครื่อง CPU ไม่สำเร็จ: ' + String(err).slice(0, 300), now).run().catch(() => { }); }
  return { pushed: !err };
}
// ---- ผู้ช่วยแบบรันอัตโนมัติ: ผู้ช่วยให้ API token ของ Kaggle ตัวเองไว้ ระบบเปิดเครื่องบัญชีเขาให้เอง (ใช้โควตา GPU ของเขา) ----
let helperCols = false;
async function helperSchema(env) {
  if (helperCols) return; helperCols = true;
  for (const c of ['kuser TEXT', 'kkey TEXT', "kstat TEXT DEFAULT ''", 'kpushed INTEGER DEFAULT 0', 'kpause INTEGER DEFAULT 0', 'kchecked INTEGER DEFAULT 0', "kerr TEXT DEFAULT ''"]) await env.DB.prepare('ALTER TABLE helpers ADD COLUMN ' + c).run().catch(() => { });
}
const hEnv = h => ({ KAGGLE_USERNAME: String(h.kuser || '').trim(), KAGGLE_KEY: String(h.kkey || '').trim() });
async function helperKTick(env) {
  await helperSchema(env);
  const hs = (await env.DB.prepare("SELECT id,name,key,kuser,kkey,kstat,kpushed,kpause,kchecked FROM helpers WHERE on_=1 AND COALESCE(kuser,'')<>'' AND COALESCE(kkey,'')<>'' ORDER BY id").all()).results;
  if (!hs.length) return { skipped: 'no helpers' };
  const now = Date.now(), S = {};
  for (const r of (await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('self_url','k_status','k_pause','k_quant')").all()).results) S[r.key] = r.value;
  const q = ((await env.DB.prepare("SELECT COUNT(*) n FROM vjobs WHERE status='queued'").first()) || {}).n || 0;
  const mainBusy = /running|queued|starting/.test(String(S.k_status || '')), mainPaused = now < (+S.k_pause || 0);
  let launched = 0;
  for (const h of hs) {
    if (now - (+h.kchecked || 0) < 120000) continue;
    await env.DB.prepare('UPDATE helpers SET kchecked=? WHERE id=?').bind(now, h.id).run();
    const he = hEnv(h), st = await kFetch(he, `/kernels/status?userName=${encodeURIComponent(he.KAGGLE_USERNAME)}&kernelSlug=${KSLUG}`);
    const status = String((st.j && st.j.status) || (st.ok ? '' : (st.status === 404 || st.status === 403) ? 'none' : 'error ' + st.status)).toLowerCase(); // 403/404 = ยังไม่เคยมีเครื่องของเราในบัญชีนี้ (ครั้งแรก) ไม่ใช่ key เสีย — key เสียจริงจะรู้ตอนสั่งเปิดเครื่อง
    if (/running|starting|queued/.test(String(h.kstat || '')) && !/running|queued/.test(status) && +h.kpushed) await qadd(env, 'kgh:h' + h.id, Math.min(12, (now - +h.kpushed) / 3600000), kgWeek(+h.kpushed));
    if (/running|queued/.test(status)) { await env.DB.prepare('UPDATE helpers SET kstat=? WHERE id=?').bind(status, h.id).run(); continue; }
    if (/^error 401/.test(status)) { await env.DB.prepare("UPDATE helpers SET kstat=?, kerr='API ของ Kaggle ใช้ไม่ได้ (token ผิดหรือหมดอายุ)', kpause=? WHERE id=?").bind(status, now + 6 * 3600000, h.id).run(); continue; }
    await env.DB.prepare('UPDATE helpers SET kstat=? WHERE id=?').bind(status, h.id).run();
    if (launched || now < (+h.kpause || 0) || now - (+h.kpushed || 0) < 5 * 60000) continue;
    if (/starting/.test(String(h.kstat || '')) && status === 'none' && now - (+h.kpushed || 0) < 40 * 60000) { await env.DB.prepare('UPDATE helpers SET kstat=? WHERE id=?').bind('starting', h.id).run(); continue; } // เพิ่งสั่งเปิด แต่ยังหาเครื่องไม่เจอ: รอก่อน ไม่สั่งซ้ำ (กันเปลืองโควตาผู้ช่วย)
    // เปิดเครื่องผู้ช่วยเมื่อคุ้ม: คิวเยอะ (เครื่องหลักทำอยู่แล้วยังเหลือเยอะ) หรือเครื่องหลักหมดโควตา — คิวน้อยไม่เปิด เพราะเปิดเครื่องแต่ละรอบเสียเวลาโหลดโมเดล ~15 นาที
    if (!(q >= (mainPaused ? 1 : mainBusy ? 4 : 8))) continue;
    if (!S.self_url) continue;
    const text = KAGGLE_PY.replace('__API__', S.self_url).replace('__TOKEN__', h.key).replace('__MAXH__', '11').replace('__QUANT__', S.k_quant || 'Q4_K_M').replace('__CPU__', '0');
    const push = await kFetch(he, '/kernels/push', { method: 'POST', body: JSON.stringify({ slug: `${he.KAGGLE_USERNAME}/${KSLUG}`, newTitle: KSLUG, text, language: 'python', kernelType: 'script', isPrivate: true, enableGpu: true, enableTpu: false, enableInternet: true, machineShape: 'NvidiaTeslaT4', datasetDataSources: [], competitionDataSources: [], kernelDataSources: [], modelDataSources: [], categoryIds: [] }) });
    let err = !push.ok ? `Kaggle ${push.status}: ${JSON.stringify(push.j).slice(0, 200)}` : (push.j && (push.j.error || push.j.errorMessage)) || '';
    if (/40[13]/.test(err)) err = 'Kaggle ไม่ยอมให้เปิดเครื่อง: ชื่อผู้ใช้ไม่ตรงกับเจ้าของ key หรือ key ผิด/หมดอายุ (' + err.slice(0, 120) + ')';
    else if (/phone|verif/i.test(err)) err = 'บัญชีนี้ยังไม่ได้ยืนยันเบอร์โทรใน Kaggle จึงใช้ GPU ไม่ได้ (' + err.slice(0, 120) + ')';
    await env.DB.prepare('UPDATE helpers SET kpushed=?, kerr=?, kstat=?, kpause=? WHERE id=?').bind(now, String(err).slice(0, 300), err ? 'error' : 'starting', err ? now + (/quota|limit|exceed/i.test(err) ? 6 : 1) * 3600000 : 0, h.id).run();
    if (!err) { launched = 1; const mu = String((push.j && (push.j.url || push.j.ref)) || '').match(/\/code\/([^/]+)\//); if (mu && mu[1] && mu[1].toLowerCase() !== he.KAGGLE_USERNAME.toLowerCase()) await env.DB.prepare('UPDATE helpers SET kuser=? WHERE id=?').bind(mu[1], h.id).run(); } // ชื่อผู้ใช้ที่กรอกผิด: แก้เป็นชื่อจริงจากคำตอบของ Kaggle
  }
  return { ok: true, launched };
}
// ---- สคริปต์สำหรับผู้ช่วย (เปิดใน Kaggle ของตัวเอง) ----
async function helperScript(env, url) {
  await ensureSchema(env);
  const key = url.pathname.split('/')[2] || '';
  const h = key.length > 20 ? await env.DB.prepare('SELECT id,name FROM helpers WHERE key=? AND on_=1').bind(key).first() : null;
  if (!h) return new Response('print("รหัสผู้ช่วยนี้ใช้ไม่ได้แล้ว ติดต่อเจ้าของสตูดิโอ")\n', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const s = await getSettings(env);
  const text = KAGGLE_PY.replace('__API__', s.self_url || url.origin).replace('__TOKEN__', key).replace('__MAXH__', '11').replace('__QUANT__', s.k_quant || 'Q4_K_M').replace('__CPU__', '0');
  return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}

function bytesToB64(u) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }

const KAGGLE_PY = String.raw`# ===== anime-video-bot : Kaggle kernel (ส่งขึ้นอัตโนมัติจาก Worker anime-image-bot) =====
# ดึงงานจากเว็บ -> Wan 2.2 Image-to-Video (GGUF + LightX2V 4 steps) บน ComfyUI -> ส่ง mp4 กลับ
import os, sys, json, time, subprocess, urllib.request, urllib.error, random, shutil, glob, threading

API = "__API__"
TOKEN = "__TOKEN__"
MAXH = float("__MAXH__")
CPU = "__CPU__" == "1"  # เครื่อง CPU: ทำเฉพาะงานรวมตอน/รวมคลิป ไม่ติดตั้งโมเดล
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
    if not os.path.isdir(COMFY + "/custom_nodes/ComfyUI_IPAdapter_plus"):  # ป้อนภาพอ้างอิงตัวละครตอนวาด (IP-Adapter)
        sh("git clone --depth 1 https://github.com/cubiq/ComfyUI_IPAdapter_plus " + COMFY + "/custom_nodes/ComfyUI_IPAdapter_plus", check=False)
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
    takes = max(1, min(5, int(opt.get("takes") or 1))) if passes == 1 else 1
    for k in range(passes):
        if takes > 1:
            # ทำหลายแบบ แล้วเก็บแบบที่หน้าตัวละครเพี้ยนน้อยสุดและขยับพอดี (วัดบนเครื่องนี้ ไม่ใช้โควตา AI)
            best = None
            for t in range(takes):
                fr, fps_t, W_t, H_t = gen_pass(j, img, k, port, F1, opt, tag="t%d" % t)
                sc, info = take_score(fr, img)
                log("ช็อต %s แบบที่ %d/%d: คะแนน %.3f (%s)" % (j.get("shot"), t + 1, takes, sc, info))
                if best is None or sc > best[0]:
                    if best:
                        [os.remove(f) for f in best[1] if os.path.exists(f)]
                    best = (sc, fr, fps_t, W_t, H_t, t)
                else:
                    [os.remove(f) for f in fr if os.path.exists(f)]
            frames, fps, W, H = best[1], best[2], best[3], best[4]
            log("ช็อต %s เลือกแบบที่ %d" % (j.get("shot"), best[5] + 1))
        else:
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
    crf = 18 if passes == 1 else 22  # ช็อตยาวบีบไฟล์มากขึ้น (คลิปเก็บใน D1 ที่พื้นที่ฟรีจำกัด)
    vf = "scale='if(gt(iw,ih),-2,1080)':'if(gt(iw,ih),1080,-2)':flags=lanczos,unsharp=5:5:0.6:5:5:0.0"
    if opt.get("fps") == 12:
        vf = "fps=12," + vf  # ลุคอนิเมะ: 12 ภาพ/วิ แบบวาดมือ
    sh('"%s" -y -loglevel error -framerate %d -i "%s/%%05d.png" -vf "%s" -c:v libx264 -preset veryfast -crf %d -pix_fmt yuv420p -movflags +faststart "%s"' % (ffmpeg_bin(), fps, tmp, vf, crf, mp4))
    shutil.rmtree(tmp, ignore_errors=True)
    return mp4, time.time() - t0, W, H


# ---------- เสียงพากย์ญี่ปุ่น: VOICEVOX (ฟรี รันบน CPU) ----------
VV = {"ok": False, "url": "http://127.0.0.1:50021"}
EMO_ST = {"h": ["喜び", "わーい", "うきうき", "楽々", "あまあま"], "a": ["怒り", "ツンギレ", "おこ", "ツンツン"], "s": ["悲しみ", "かなしい", "悲しい", "しくしく", "びえーん"],
          "w": ["ささやき", "ヒソヒソ", "内緒話", "囁き"], "x": ["びくびく", "おどろき", "悲しみ"], "t": ["ツンツン", "クール", "セクシー"], "d": ["あまあま", "喜び", "わーい"]}


def ensure_voicevox():
    if VV["ok"]:
        return
    d = os.path.join(ROOT, "voicevox")
    runs = [f for f in glob.glob(os.path.join(d, "**", "run"), recursive=True) if os.path.isfile(f)]
    if not runs:
        os.makedirs(d, exist_ok=True)
        ver = "0.19.1"
        f = os.path.join(d, "vv.7z")
        url = "https://github.com/VOICEVOX/voicevox_engine/releases/download/%s/voicevox_engine-linux-cpu-%s.7z.001" % (ver, ver)
        log("กำลังโหลดตัวทำเสียงพากย์ VOICEVOX %s (ครั้งแรกของรอบ)" % ver)
        sh('wget -q -O "%s" "%s" || curl -sL -o "%s" "%s"' % (f, url, f, url))
        if not sh("which 7z || which 7za", check=False).strip():
            sh("apt-get install -y -q p7zip-full >/dev/null 2>&1 || true", check=False)
        if sh("which 7z || which 7za", check=False).strip():
            sh('$(which 7z || which 7za) x -y -o"%s" "%s" >/dev/null' % (d, f))
        else:
            sh("pip install -q py7zr", check=False)
            import py7zr
            with py7zr.SevenZipFile(f, "r") as z:
                z.extractall(d)
        os.remove(f)
        runs = [f for f in glob.glob(os.path.join(d, "**", "run"), recursive=True) if os.path.isfile(f)]
        if not runs:
            raise RuntimeError("แตกไฟล์ VOICEVOX ไม่สำเร็จ")
    r = runs[0]
    os.chmod(r, 0o755)
    subprocess.Popen([r, "--host", "127.0.0.1", "--port", "50021"], cwd=os.path.dirname(r), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t = time.time()
    while time.time() - t < 600:
        try:
            urllib.request.urlopen(VV["url"] + "/version", timeout=5).read()
            break
        except Exception:
            time.sleep(3)
    else:
        raise RuntimeError("VOICEVOX ไม่ตอบภายใน 10 นาที")
    VV["sp"] = json.loads(urllib.request.urlopen(VV["url"] + "/speakers", timeout=60).read())
    VV["ok"] = True
    log("ตัวทำเสียงพากย์พร้อม (%d ต้นเสียง)" % len(VV["sp"]))


def vv_style(name, style, emo):
    sps = VV["sp"]
    cand = [s for s in sps if name and name in s["name"]] or [s for s in sps if "四国めたん" in s["name"]] or sps[:1]
    sp = cand[0]
    want = EMO_ST.get(emo, []) + ([style] if style else []) + ["ノーマル", "ふつう"]
    for w in want:
        for st in sp["styles"]:
            if st["name"] == w:
                return st["id"], sp["name"]
    return sp["styles"][0]["id"], sp["name"]


def vv_req(path, data=None, q=None):
    u = VV["url"] + path + ("?" + urllib.parse.urlencode(q) if q else "")
    rq = urllib.request.Request(u, data=(json.dumps(data).encode() if data is not None else b""), method="POST", headers={"content-type": "application/json"})
    return urllib.request.urlopen(rq, timeout=300).read()


def tts_job(j):
    import urllib.parse
    ensure_voicevox()
    t0 = time.time()
    o = j.get("opt") or {}
    cast = o.get("cast") or {}
    done = 0
    for ln in o.get("lines") or []:
        who = str(ln.get("who") or "")
        name = who.lstrip("~")
        g = ln.get("g") or ""
        c = (cast.get(ln.get("nv")) or cast.get("narrator")) if not who else cast.get(name) or (cast.get("_x") if g == "x" else cast.get("_f") if g == "f" else cast.get("_m")) or {}
        emo = ln.get("emo") or "n"
        c = dict(c, **((c.get("emo") or {}).get(emo) or {}))
        sid, spn = vv_style(c.get("sp"), c.get("st"), emo if emo not in ("n", "d") else "")
        try:
            qd = json.loads(vv_req("/audio_query", q={"text": ln.get("pron") or ln["ja"], "speaker": sid}))  # pron = คำอ่านคะนะที่กำกับไว้
            qd["speedScale"] = float(c.get("speed", 1.0)) * (0.92 if emo == "w" else 1.0) * float(ln.get("spd") or 1.0)
            qd["pitchScale"] = float(c.get("pitch", 0.0))
            qd["intonationScale"] = float(c.get("into", 1.0)) * (1.15 if emo in ("x", "a") else 1.0)
            qd["volumeScale"] = float(c.get("vol", 1.0))  # เสียงในใจดังเท่าเสียงพูด (ผู้ใช้สั่ง) · ต่างกันแค่ก้องเบาๆ
            qd["prePhonemeLength"] = float(c.get("pre", 0.08))  # ช่องหายใจก่อนพูด ตามผังเสียงตัวละคร
            qd["postPhonemeLength"] = float(c.get("post", 0.15))
            wav = vv_req("/synthesis", qd, q={"speaker": sid})
            wf = os.path.join(ROOT, "vo.wav")
            mf = os.path.join(ROOT, "vo.m4a")
            open(wf, "wb").write(wav)
            fx = ["aecho=0.9:0.6:35:0.18"] if who.startswith("~") else []  # ความคิดในใจ: ก้องเบาๆ แบบอนิเมะ
            fx.append("loudnorm=I=%d:TP=-1:LRA=9" % (-14 if ln.get("loud") else -18))  # ชื่อเรื่อง/ชื่อตอนดังกว่าปกติ  # ปรับความดังทุกบรรทัดให้เท่ากัน (ตรวจคุณภาพเสียง)
            af = '-af "%s"' % ",".join(fx)
            sh('"%s" -y -loglevel error -i "%s" %s -ac 1 -ar 24000 -c:a aac -b:a 64k "%s"' % (ffmpeg_bin(), wf, af, mf))
            call("/k/vo/%s?shot=%s&line=%s" % (j["id"], ln["shot"], ln["line"]), raw=open(mf, "rb").read(), timeout=120)
            done += 1
        except Exception as e:
            log("เสียงบรรทัด %s/%s พัง: %s" % (ln.get("shot"), ln.get("line"), str(e)[:200]))
    log("ทำเสียงพากย์ %s เสร็จ %d/%d บรรทัด" % (j.get("project"), done, len(o.get("lines") or [])))
    if not done and o.get("lines"):
        raise RuntimeError("ทำเสียงไม่ได้สักบรรทัด")
    f = os.path.join(ROOT, "tts%s.txt" % j["id"])
    open(f, "w").write("ok %d\n" % done)
    return f, time.time() - t0, 0, 0


def take_score(frames, ref):
    # วัดแบบง่าย: (1) เฟรมช่วงหลังยังมีโครงภาพคล้ายภาพต้นฉบับ = หน้า/ตัวไม่ละลาย (2) ขยับพอ ไม่นิ่งเป็นภาพ (3) ไม่กระพริบกระตุก
    import numpy as np
    from PIL import Image

    def g(x):
        im = x if hasattr(x, "convert") else Image.open(x)
        return np.asarray(im.convert("L").resize((96, 54)), dtype=np.float32) / 255.0

    def corr(a, b):
        a = a - a.mean()
        b = b - b.mean()
        return float((a * b).sum() / (np.sqrt((a * a).sum() * (b * b).sum()) + 1e-6))
    r = g(ref)
    arr = [g(f) for f in frames]  # ทุกเฟรม (ภาพย่อ 96x54 เร็ว) จะได้จับการกระพริบที่เกิดเฟรมเว้นเฟรม
    if len(arr) < 3:
        return 0.0, "เฟรมน้อย"
    late = arr[len(arr) // 2:]
    keep = float(np.mean([corr(a, r) for a in late[::max(1, len(late) // 12)]]))
    d = [float(np.abs(arr[i + 1] - arr[i]).mean()) for i in range(len(arr) - 1)]
    step, jitter = float(np.mean(d)), float(np.std(d))  # ต่างกันทีละเฟรม: สูงผิดปกติ = กระพริบ/สั่น
    span = float(np.mean([np.abs(a - arr[0]).mean() for a in late]))  # ขยับไปจากเฟรมแรกแค่ไหน: ต่ำมาก = แทบเป็นภาพนิ่ง
    sc = keep - (0.5 if span < 0.008 else 0.0) - max(0.0, step - 0.03) * 5 - jitter * 2
    return sc, "คงรูป %.2f ขยับ %.3f กระตุก %.3f" % (keep, span, step)


def gen_pass(j, im, k, port=8188, F=81, opt=None, tag=""):
    opt = opt or {}
    hq = bool(opt.get("hq"))
    ST = 8 if hq else 4  # ช็อตสำคัญ: 8 steps + ภาพใหญ่ขึ้น
    jid = "%s_p%d%s" % (j["id"], k, tag)
    W, H = size_for(*im.size, area=(720 * 720 if hq else 640 * 640))
    fname = "job%s.jpg" % jid
    im.save(os.path.join(COMFY, "input", fname), quality=95)
    seed = random.randint(1, 2 ** 31)
    pos = j.get("prompt") or "subtle natural motion"
    neg = j.get("neg") or "blurry, distorted face, deformed hands, extra fingers, morphing, flickering, text, watermark"
    end_name = ""
    if opt.get("end") and k == 0:
        # ท่าต่อเนื่อง: กำหนดภาพเฟรมสุดท้าย (ท่าถัดไป) ให้ตัวทำคลิปเติมการเคลื่อนไหวระหว่างสองท่า
        try:
            import io
            from PIL import Image
            with urllib.request.urlopen(urllib.request.Request(opt["end"], headers=UA), timeout=120) as r:
                eim = Image.open(io.BytesIO(r.read())).convert("RGB").resize(im.size)
            end_name = "job%s_end.jpg" % jid
            eim.save(os.path.join(COMFY, "input", end_name), quality=95)
        except Exception as e:
            log("ดึงภาพท่าปลายทางไม่ได้ ใช้โหมดภาพเดียว: %s" % str(e)[:120])
            end_name = ""
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
        wf["17"] = {"class_type": "RIFE VFI", "inputs": {"ckpt_name": "rife47.pth", "frames": ["15", 0], "clear_cache_after_n_frames": 10, "multiplier": 3, "fast_mode": True, "ensemble": True, "scale_factor": 1.0, "dtype": "float16", "torch_compile": False, "batch_size": 1}}
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
    base12 = dict(wf["12"])
    if end_name:
        wf["18"] = {"class_type": "LoadImage", "inputs": {"image": end_name}}
        wf["12"] = {"class_type": "WanFirstLastFrameToVideo", "inputs": {"positive": ["8", 0], "negative": ["9", 0], "vae": ["10", 0], "width": W, "height": H, "length": F, "batch_size": 1, "start_image": ["11", 0], "end_image": ["18", 0]}}
    while True:
        try:
            run(wf)
            break
        except Exception as e:
            if end_name:
                log("โหมดเฟรมแรก-เฟรมท้ายใช้ไม่ได้ ใช้โหมดภาพเดียวแทน: " + str(e)[:200])
                wf["12"] = base12
                wf.pop("18", None)
                end_name = ""
            elif fps != 16:
                log("เติมเฟรมไม่สำเร็จ ใช้ 16fps แทน: " + str(e)[:200])
                M["rife"] = False
                wf.pop("17", None)
                wf["16"]["inputs"]["images"] = ["15", 0]
                fps = 16
            else:
                raise
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


# ---------- ภาพอนิเมะ: 2 เอนจิน สลับได้ต่องาน (opt.engine) ----------
#   sdxl = SDXL อนิเมะ (Animagine XL 4.0) · dev = FLUX.1-dev (GGUF)
# ตั้งเองได้ที่ settings.img_model = repo::ไฟล์ (.safetensors → SDXL · .gguf → FLUX) · settings.img_quant = quant ของ FLUX (ค่าเริ่มต้น Q5_K_S)
IMG_MODELS = [
    ("cagliostrolab/animagine-xl-4.0", "animagine-xl-4.0-opt.safetensors"),
    ("cagliostrolab/animagine-xl-4.0", "animagine-xl-4.0.safetensors"),
]
IMG_POS = "masterpiece, high score, great score, absurdres, "
IMG_NEG = "crowd, 4girls, 5girls, 6+girls, 4boys, 6+boys, clone, identical faces, multiple views, collage, grid, split screen, comic panels, character sheet, reference sheet, turnaround, lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, low quality, low score, bad score, average score, signature, watermark, username, blurry"
IMG_QUANTS = ["Q5_K_S", "Q4_K_S", "Q4_0", "Q8_0"]
FLUX_REPO = "city96/FLUX.1-dev-gguf"
FLUX_S_REPO = "city96/FLUX.1-schnell-gguf"  # Apache-2.0: ใช้หารายได้ได้
FLUX_TE = "comfyanonymous/flux_text_encoders"
FLUX_VAES = [("black-forest-labs/FLUX.1-schnell", "ae.safetensors"), ("Comfy-Org/Lumina_Image_2.0_Repackaged", "split_files/vae/ae.safetensors"), ("black-forest-labs/FLUX.1-dev", "ae.safetensors")]
FLUX_GUIDANCE = 3.5


def ensure_sdxl(model_spec=""):
    if M.get("sdxl"):
        return
    log("กำลังโหลดโมเดลภาพอนิเมะ SDXL (ครั้งแรกประมาณ 3–6 นาที)")
    cands = list(IMG_MODELS)
    if model_spec and "::" in model_spec and not model_spec.strip().lower().endswith(".gguf"):
        r, f = model_spec.split("::", 1)
        cands.insert(0, (r.strip(), f.strip()))
    got = None
    for repo, f in cands:
        try:
            fetch([("checkpoints", repo, f)])
            got = os.path.basename(f)
            break
        except Exception as e:
            log("โหลด %s ไม่ได้: %s" % (f, str(e)[:200]))
    if not got:
        raise RuntimeError("โหลดโมเดลภาพ SDXL ไม่สำเร็จ")
    try:  # VAE แก้ปัญหาภาพดำ/เพี้ยนของ SDXL บน GPU รุ่น T4 (fp16)
        fetch([("vae", "madebyollin/sdxl-vae-fp16-fix", "sdxl_vae.safetensors", "sdxl_vae_fp16fix.safetensors")])
        M["sdxlvae"] = "sdxl_vae_fp16fix.safetensors"
    except Exception as e:
        log("โหลด VAE แก้ภาพดำไม่ได้ ใช้ VAE ในโมเดลแทน: " + str(e)[:160])
        M["sdxlvae"] = ""
    M["sdxl"] = got
    log("โมเดลภาพ SDXL พร้อม: " + got)


def ensure_flux(model_spec="", quant="", schnell=False):
    key = "flux_s" if schnell else "flux"
    if M.get(key):
        return
    log("กำลังโหลดโมเดลภาพ %s (ครั้งแรกประมาณ 5–10 นาที)" % ("FLUX.1-schnell" if schnell else "FLUX.1-dev"))
    cands = []
    if model_spec and "::" in model_spec and model_spec.strip().lower().endswith(".gguf") and (("schnell" in model_spec.lower()) == schnell):
        r, f = model_spec.split("::", 1)
        cands.append((r.strip(), f.strip()))
    qs = ([quant] if quant else []) + [x for x in IMG_QUANTS if x != quant]
    cands += [(FLUX_S_REPO, "flux1-schnell-%s.gguf" % x) for x in qs] if schnell else [(FLUX_REPO, "flux1-dev-%s.gguf" % x) for x in qs]
    got = None
    for repo, f in cands:
        try:
            fetch([("unet", repo, f)])
            got = os.path.basename(f)
            break
        except Exception as e:
            log("โหลด %s ไม่ได้: %s" % (f, str(e)[:200]))
    if not got:
        raise RuntimeError("โหลดโมเดล FLUX.1-dev ไม่สำเร็จ (ถ้าขึ้น 401/403 ให้ตั้ง HF_TOKEN ของบัญชี Hugging Face ที่กดยอมรับสัญญา FLUX.1-dev แล้ว)")
    fetch([("clip", FLUX_TE, "clip_l.safetensors"), ("clip", FLUX_TE, "t5xxl_fp8_e4m3fn.safetensors")])
    vae = None
    for repo, f in FLUX_VAES:
        try:
            fetch([("vae", repo, f, "flux_ae.safetensors")])
            vae = "flux_ae.safetensors"
            break
        except Exception as e:
            log("โหลด VAE %s ไม่ได้: %s" % (repo, str(e)[:160]))
    if not vae:
        raise RuntimeError("โหลด VAE ของ FLUX ไม่สำเร็จ")
    M["fluxvae"] = vae
    M[key] = got
    log("โมเดลภาพ FLUX พร้อม: " + got)


def ensure_image(engine="dev", model_spec="", quant=""):
    with LOCK:
        if engine == "sdxl":
            ensure_sdxl(model_spec)
        else:
            ensure_flux(model_spec, quant, engine == "schnell")


def ensure_lora(lid):
    fn = "lora%s.safetensors" % lid
    dst = os.path.join(COMFY, "models", "loras", fn)
    if not os.path.exists(dst) or os.path.getsize(dst) < 100000:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        try:
            info = json.loads(call("/k/lget/%s?info=1" % lid, timeout=60))
        except Exception:
            info = {}
        if info.get("parts"):
            with open(dst + ".tmp", "wb") as o:
                for i in range(int(info["parts"])):
                    o.write(call("/k/lget/%s?part=%d" % (lid, i), timeout=600))
            if info.get("size") and os.path.getsize(dst + ".tmp") != int(info["size"]):
                raise RuntimeError("ดึงไฟล์ LoRA %s มาไม่ครบ" % lid)
            os.replace(dst + ".tmp", dst)
        else:
            open(dst, "wb").write(call("/k/lget/%s" % lid, timeout=600))
    return fn


_CLIP = None
_QNEG = []


def clip_pick(paths, pos):
    # ตรวจคุณภาพภาพ (Visual QC): ให้คะแนน = ตรงกับบท/ฉากหลังครบ − ฉากว่าง/เบลอ/มือผิดรูป/มีสี/มีตัวหนังสือ แล้วเลือกภาพคะแนนสูงสุด
    global _CLIP
    neg = ["an empty blank white background", "a blurry messy unfinished sketch", "deformed hands with extra fingers", "a colored illustration", "text, letters and speech bubbles", "a cluttered noisy image", "a schoolgirl in a school uniform", "extra strangers who do not belong in the scene"] + list(_QNEG)
    try:
        import torch
        from PIL import Image
        from transformers import CLIPModel, CLIPProcessor
        if _CLIP is None:
            nm = "openai/clip-vit-base-patch32"
            _CLIP = (CLIPModel.from_pretrained(nm).eval(), CLIPProcessor.from_pretrained(nm))
        m, pr = _CLIP
        ims = [Image.open(x).convert("RGB") for x in paths]
        tx = [str(t)[:300] for t in pos if t] + neg
        inp = pr(text=tx, images=ims, return_tensors="pt", padding=True, truncation=True)
        with torch.no_grad():
            lg = m(**inp).logits_per_image
        npos = len(tx) - len(neg)
        sc = lg[:, :npos].mean(1) - lg[:, npos:].mean(1) * 0.5
        best = int(sc.argmax())
        return best, "คะแนน " + " / ".join("%.1f" % float(v) for v in sc)
    except Exception as e:
        return len(paths) - 1, "ตรวจไม่ได้: %s" % str(e)[:120]


def clip_scores(paths, pos):
    # คะแนน CLIP ของทุกภาพ (ตรงบท − ภาพเสีย)
    global _CLIP
    neg = ["an empty blank white background", "a blurry messy unfinished sketch", "deformed hands with extra fingers", "a colored illustration", "text, letters and speech bubbles", "a cluttered noisy image", "a schoolgirl in a school uniform", "extra strangers who do not belong in the scene", "two copies of the same person side by side", "a person with two heads", "signs and posters with writing"] + list(_QNEG)
    try:
        import torch
        from PIL import Image
        from transformers import CLIPModel, CLIPProcessor
        if _CLIP is None:
            nm = "openai/clip-vit-base-patch32"
            _CLIP = (CLIPModel.from_pretrained(nm).eval(), CLIPProcessor.from_pretrained(nm))
        m, pr = _CLIP
        ims = [Image.open(x).convert("RGB") for x in paths]
        tx = [str(t)[:300] for t in pos if t] + neg
        inp = pr(text=tx, images=ims, return_tensors="pt", padding=True, truncation=True)
        with torch.no_grad():
            lg = m(**inp).logits_per_image
        npos = len(tx) - len(neg)
        sc = lg[:, :npos].mean(1) - lg[:, npos:].mean(1) * 0.5
        return [float(v) for v in sc], ""
    except Exception as e:
        log("ตรวจด้วย CLIP ไม่ได้: %s" % str(e)[:120])
        return [], str(e)[:120]


_DET = None


def person_count(path):
    # นับคนในภาพด้วย Faster R-CNN (torchvision, ฟรี) บน CPU · ใช้ไม่ได้คืน None = ข้ามการนับ
    global _DET
    try:
        import torch
        import torchvision
        from PIL import Image
        if _DET is None:
            w = torchvision.models.detection.FasterRCNN_ResNet50_FPN_V2_Weights.DEFAULT
            _DET = (torchvision.models.detection.fasterrcnn_resnet50_fpn_v2(weights=w, box_score_thresh=0.5).eval(), w.transforms())
        m, tf = _DET
        im = Image.open(path).convert("RGB")
        im.thumbnail((896, 896))
        with torch.no_grad():
            r = m([tf(im)])[0]
        return int(((r["labels"] == 1) & (r["scores"] >= 0.7)).sum())
    except Exception as e:
        log("นับคนในภาพไม่ได้: %s" % str(e)[:120])
        return None


# ---------- ภาพแบบผสม (hybrid): FLUX.1-schnell วาดฉาก/วางองค์ประกอบ · SDXL อนิเมะวาดรายละเอียดสำคัญทั้งหมด ----------
#   1) FLUX วาดทั้งช่อง 2 แบบ (ใช้เป็นแบบร่างวางท่า/ตำแหน่ง) + ตรวจจำนวนคน เลือกแบบที่ผ่าน
#   2) FLUX วาดฉากเปล่าไม่มีคน (ฉากหลังจริงของภาพ)
#   3) ตรวจหาคน/ของสำคัญในแบบร่าง → SDXL วาดตัวละครแต่ละตัวใหม่ตามแท็กประจำตัว (หน้า ผม แว่น ชุด) → ตัดพื้นหลังแล้ววางลงฉากเปล่า
#      ช่องที่ตัวละครสัมผัสฉาก (นั่ง จับของ) วางทับแบบร่างเดิมแทน
#   4) SDXL วาดของสำคัญ (ตุ๊กตา กระป๋อง สัตว์) ทับอีกรอบ แล้วลงเส้นทับทั้งภาพเบาๆ ให้แสง/ลายเส้นกลืนกัน
HY_PROPS = {17: "cute small animal", 88: "small cute plush toy, stuffed animal", 47: "drink can", 44: "drink can", 84: "book, blank pages", 77: "smartphone, blank screen"}
_RB = None


def comfy_go(wf, prefix, port):
    pid = comfy("/prompt", {"prompt": wf, "client_id": "bot"}, port=port)["prompt_id"]
    t1 = time.time()
    while True:
        time.sleep(2)
        h = comfy("/history/" + pid, port=port)
        if pid in h:
            st = h[pid].get("status", {})
            if st.get("status_str") == "error":
                raise RuntimeError("เจนภาพไม่สำเร็จ: " + json.dumps([m for m in st.get("messages", []) if m[0] == "execution_error"])[:400])
            break
        if time.time() - t1 > 900:
            raise RuntimeError("เจนภาพนานเกิน 15 นาที")
    return sorted(glob.glob(os.path.join(COMFY, "output", "**", prefix + "_*"), recursive=True))


def comfy_free(port):
    try:
        comfy("/free", {"unload_models": True, "free_memory": True}, port=port)
    except Exception:
        pass


def wf_flux(prompt, W, H, seed, batch, prefix):
    return {
        "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": M["flux_s"]}},
        "2": {"class_type": "DualCLIPLoader", "inputs": {"clip_name1": "t5xxl_fp8_e4m3fn.safetensors", "clip_name2": "clip_l.safetensors", "type": "flux"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": M["fluxvae"]}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": prompt}},
        "5": {"class_type": "FluxGuidance", "inputs": {"conditioning": ["4", 0], "guidance": FLUX_GUIDANCE}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": ""}},
        "7": {"class_type": "EmptySD3LatentImage", "inputs": {"width": W, "height": H, "batch_size": batch}},
        "8": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "seed": seed, "steps": 6, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0], "denoise": 1.0}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["3", 0]}},
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": prefix}},
    }


def wf_sdxl_i2i(img_name, pos, neg, seed, denoise, prefix, loras=None):
    wf = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": M["sdxl"]}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": pos}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": neg}},
        "4": {"class_type": "LoadImage", "inputs": {"image": img_name}},
        "5": {"class_type": "VAEEncode", "inputs": {"pixels": ["4", 0], "vae": ["1", 2]}},
        "6": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "seed": seed, "steps": 28, "cfg": 5.5, "sampler_name": "euler_ancestral", "scheduler": "normal", "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["5", 0], "denoise": denoise}},
        "7": {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
        "8": {"class_type": "SaveImage", "inputs": {"images": ["7", 0], "filename_prefix": prefix}},
    }
    if M.get("sdxlvae"):
        wf["9"] = {"class_type": "VAELoader", "inputs": {"vae_name": M["sdxlvae"]}}
        wf["5"]["inputs"]["vae"] = ["9", 0]
        wf["7"]["inputs"]["vae"] = ["9", 0]
    pm, pc = ["1", 0], ["1", 1]
    for n, lo in enumerate(loras or []):
        nid = str(30 + n)
        wf[nid] = {"class_type": "LoraLoader", "inputs": {"model": pm, "clip": pc, "lora_name": ensure_lora(lo["id"]), "strength_model": float(lo.get("w") or 0.8), "strength_clip": 1.0}}
        pm, pc = [nid, 0], [nid, 1]
    wf["2"]["inputs"]["clip"] = pc
    wf["3"]["inputs"]["clip"] = pc
    wf["6"]["inputs"]["model"] = pm
    return wf


def detect_boxes(path, th=0.55):
    # กล่องของคน/ของในภาพ [(label, [x0,y0,x1,y1], score)] เรียงคะแนนมาก→น้อย
    try:
        person_count(path)  # โหลดตัวตรวจจับ
        import torch
        from PIL import Image
        m, tf = _DET
        im = Image.open(path).convert("RGB")
        W0 = im.width
        im.thumbnail((896, 896))
        k = W0 / float(im.width)
        with torch.no_grad():
            r = m([tf(im)])[0]
        out = []
        for lb, bx, sc in zip(r["labels"].tolist(), r["boxes"].tolist(), r["scores"].tolist()):
            if sc >= th:
                out.append((int(lb), [v * k for v in bx], float(sc)))
        return sorted(out, key=lambda x: -x[2])
    except Exception as e:
        log("หาตำแหน่งตัวละครไม่ได้: %s" % str(e)[:120])
        return []


def cutout(im):
    # ตัดพื้นหลังตัวละครอนิเมะ (rembg รุ่น isnet-anime ฟรี) · ไม่ได้ = None
    global _RB
    try:
        try:
            import rembg
        except Exception:
            sh("pip install -q rembg onnxruntime", check=False)
            import rembg
        if _RB is None:
            _RB = rembg.new_session("isnet-anime")
        return rembg.remove(im, session=_RB)
    except Exception as e:
        log("ตัดพื้นหลังตัวละครไม่ได้: %s" % str(e)[:120])
        return None


def match_chars(img, boxes, chars):
    # จับคู่กล่องคน ↔ ตัวละคร ด้วย CLIP (ทุกการเรียงสับเปลี่ยน เลือกผลรวมคะแนนสูงสุด)
    n = min(len(boxes), len(chars))
    if n <= 1 or len(chars) <= 1:
        return list(range(len(boxes)))
    try:
        import itertools
        import torch
        from transformers import CLIPModel, CLIPProcessor
        global _CLIP
        if _CLIP is None:
            nm = "openai/clip-vit-base-patch32"
            _CLIP = (CLIPModel.from_pretrained(nm).eval(), CLIPProcessor.from_pretrained(nm))
        m, pr = _CLIP
        crops = [img.crop([int(v) for v in b[1]]) for b in boxes]
        inp = pr(text=[str(c.get("desc") or c.get("tags") or "")[:200] for c in chars], images=crops, return_tensors="pt", padding=True, truncation=True)
        with torch.no_grad():
            lg = m(**inp).logits_per_image.tolist()
        best, bs = None, -1e9
        for perm in itertools.permutations(range(len(chars)), len(boxes) if len(boxes) <= len(chars) else len(chars)):
            s = sum(lg[i][perm[i]] for i in range(len(perm)))
            if s > bs:
                bs, best = s, perm
        res = list(best) + [-1] * (len(boxes) - len(best))
        return res
    except Exception as e:
        log("จับคู่ตัวละครไม่ได้: %s" % str(e)[:120])
        return list(range(len(boxes)))


def soft_mask(size, pad=0.12, blur=0.06):
    from PIL import Image, ImageDraw, ImageFilter
    w, h = size
    mk = Image.new("L", size, 0)
    ImageDraw.Draw(mk).rectangle([int(w * pad), int(h * pad), int(w * (1 - pad)), int(h * (1 - pad))], fill=255)
    return mk.filter(ImageFilter.GaussianBlur(max(2, int(min(w, h) * blur))))


def hy_refine(img, box, pos, neg, seed, denoise, prefix, port, loras=None, margin=0.18):
    # วาดใหม่เฉพาะบริเวณกล่องด้วย SDXL (ขยายให้ด้านยาว ~1024 แล้วย่อกลับ)
    from PIL import Image
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    X0, Y0 = max(0, int(x0 - w * margin)), max(0, int(y0 - h * margin))
    X1, Y1 = min(img.width, int(x1 + w * margin)), min(img.height, int(y1 + h * margin))
    crop = img.crop((X0, Y0, X1, Y1))
    cw, ch = crop.size
    s = 1024.0 / max(cw, ch)
    tw, th = max(512, int(cw * s) // 8 * 8), max(512, int(ch * s) // 8 * 8)
    nm = prefix + ".png"
    os.makedirs(os.path.join(COMFY, "input"), exist_ok=True)
    crop.resize((tw, th), Image.LANCZOS).save(os.path.join(COMFY, "input", nm))
    outs = comfy_go(wf_sdxl_i2i(nm, pos, neg, seed, denoise, prefix, loras), prefix, port)
    r = Image.open(outs[-1]).convert("RGB").resize((cw, ch), Image.LANCZOS)
    for f in outs:
        try:
            os.remove(f)
        except Exception:
            pass
    return r, (X0, Y0)


def gen_hybrid(j, port=8188):
    from PIL import Image, ImageFilter
    opt = j.get("opt") or {}
    hy = opt.get("hy") or {}
    t0 = time.time()
    ensure_image("schnell")
    ensure_image("sdxl")
    W = max(512, min(1536, int(opt.get("w") or 1344))) // 16 * 16
    H = max(512, min(1536, int(opt.get("h") or 768))) // 16 * 16
    seed = int(opt.get("seed") or 0) or (int(opt.get("seedLoc") or 0) * 1000 + int(opt.get("jobId") or 0) % 1000 if opt.get("seedLoc") else 0) or random.randint(1, 2 ** 31)
    jid = "i%s" % j["id"]
    exp = opt.get("np")
    exp = None if exp is None or exp == "" else int(exp)
    chars = hy.get("chars") or []
    style = hy.get("style") or "anime screencap, flat color, clean lineart, cel shading"
    neg = IMG_NEG + ", " + (hy.get("neg") or "monochrome, greyscale, sketch, english text, japanese text, letters, logo, school uniform, serafuku")
    # 1) แบบร่างวางองค์ประกอบ (FLUX 2 แบบ × สูงสุด 2 รอบ) + ตรวจจำนวนคน
    best, tmp = None, []
    for rd in range(2):
        pf = "img%sA%d" % (jid, rd)
        outs = comfy_go(wf_flux(j.get("prompt") or "", W, H, seed + rd * 7919, 2, pf), pf, port)
        tmp += outs
        scs, _ = clip_scores(outs, opt.get("qc") or [j.get("prompt") or ""])
        for k, pth in enumerate(outs):
            sc = scs[k] if k < len(scs) else 0.0
            cnt = person_count(pth) if exp is not None else None
            bad = cnt is not None and ((exp == 0 and cnt >= 1) or (exp > 0 and cnt > exp))
            log("ภาพ %s ร่าง %d/%d: คะแนน %.1f · คน %s/%s %s" % (jid, rd + 1, k + 1, sc, "-" if cnt is None else cnt, "-" if exp is None else exp, "ไม่ผ่าน" if bad else "ผ่าน"))
            key = (0 if bad else 1, sc)
            if best is None or key > best[0]:
                best = (key, pth)
        if best[0][0] == 1:
            break
    A = Image.open(best[1]).convert("RGB")
    boxes = detect_boxes(best[1])
    persons = [b for b in boxes if b[0] == 1]
    npc = len([c for c in chars if c.get("p")])
    persons = persons[:min(exp, npc) if exp is not None else npc]  # คนเกินบท (ร่างโคลน) ไม่ถูกวาดซ้ำ และหายไปเมื่อวางลงฉากเปล่า
    persons.sort(key=lambda b: b[1][0])
    # 2) ฉากเปล่า (FLUX) สำหรับวางตัวละครที่วาดใหม่
    B = None
    if persons and hy.get("mode") == "comp" and hy.get("bg"):
        pf = "img%sB" % jid
        outs = comfy_go(wf_flux(hy["bg"], W, H, seed + 31, 1, pf), pf, port)
        tmp += outs
        B = Image.open(outs[-1]).convert("RGB")
    comfy_free(port)  # สลับไป SDXL: คืนหน่วยความจำของ FLUX ก่อน
    # 3) ตัวละครทุกตัววาดใหม่ด้วย SDXL ตามแท็กประจำตัว
    pc = [c for c in chars if c.get("p")]
    who = match_chars(A, persons, pc)
    base = B.copy() if B is not None else A.copy()
    pasted = []
    for i, b in enumerate(persons):
        c = pc[who[i]] if 0 <= who[i] < len(pc) else {}
        pos = IMG_POS + style + ", " + (c.get("tags") or "1person") + ", solo, " + (hy.get("pose") or "")
        r, (X0, Y0) = hy_refine(A, b[1], pos, neg + (", " + c["neg"] if c.get("neg") else ""), seed + 101 + i, float(hy.get("dc") or 0.55), "img%sP%d" % (jid, i), port, c.get("loras"))
        mk = None
        if B is not None:
            cut = cutout(r)
            if cut is not None:
                mk = cut.split()[-1].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
        if mk is None:
            if B is not None:  # ตัดพื้นหลังไม่ได้ → กลับไปวางทับแบบร่างเดิม
                base = A.copy()
                for (rr, xy, mm) in pasted:
                    base.paste(rr, xy, mm)
                B = None
            mk = soft_mask(r.size)
        base.paste(r, (X0, Y0), mk)
        pasted.append((r, (X0, Y0), mk))
        log("ภาพ %s: วาดตัวละคร %s ใหม่ด้วย SDXL" % (jid, c.get("n") or "?"))
    # 4) ของสำคัญในภาพ (ตุ๊กตา กระป๋อง สัตว์ หนังสือ) วาดใหม่ด้วย SDXL
    tp = os.path.join(ROOT, "%s_base.png" % jid)
    base.save(tp)
    props = hy.get("props") or {}
    k = 0
    found = detect_boxes(tp, 0.5)
    pl = hy.get("plush") or []
    if pl:  # ตุ๊กตาบนโต๊ะ: เรียงซ้าย→ขวา แล้ววาดแต่ละตัวตามชนิดที่บทกำหนด (กันได้ตัวซ้ำ/ขาดแมวน้ำ)
        pb = sorted([b for b in found if b[0] in (15, 16, 17, 18, 88) and (b[1][2] - b[1][0]) * (b[1][3] - b[1][1]) < W * H * 0.05], key=lambda b: b[1][0])[:len(pl)]
        for i, (lb, bx, sc) in enumerate(pb):
            r, xy = hy_refine(base, bx, IMG_POS + style + ", " + pl[i] + ", no humans, solo, detailed", neg, seed + 401 + i, 0.6, "img%sU%d" % (jid, i), port, None, 0.3)
            base.paste(r, xy, soft_mask(r.size, 0.15, 0.08))
        found = [b for b in found if b not in pb]
    for lb, bx, sc in found:
        if lb == 1 or k >= 5:
            continue
        t = props.get(str(lb)) or HY_PROPS.get(lb)
        if not t or (bx[2] - bx[0]) * (bx[3] - bx[1]) < W * H * 0.002:
            continue
        r, xy = hy_refine(base, bx, IMG_POS + style + ", " + t + ", no humans, detailed", neg, seed + 301 + k, 0.5, "img%sO%d" % (jid, k), port, None, 0.25)
        base.paste(r, xy, soft_mask(r.size, 0.15, 0.08))
        k += 1
    # 5) ลงเส้นทับทั้งภาพเบาๆ ด้วย SDXL ให้ทุกส่วนเป็นลายเส้นเดียวกัน
    base.save(tp)
    shutil.copy(tp, os.path.join(COMFY, "input", "%s_base.png" % jid))
    allt = IMG_POS + style + ", " + (hy.get("all") or "")
    pf = "img%sH" % jid
    outs = comfy_go(wf_sdxl_i2i("%s_base.png" % jid, allt, neg, seed + 7, float(hy.get("dh") or (0.42 if not persons else 0.3)), pf), pf, port)
    tmp += outs
    im = Image.open(outs[-1]).convert("RGB")
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    if exp is not None:
        fp = os.path.join(ROOT, "%s_fin.png" % jid)
        im.save(fp)
        log("ภาพ %s: ภาพจบมีคน %s/%s" % (jid, person_count(fp), exp))
    comfy_free(port)
    jpg = os.path.join(ROOT, "%s.jpg" % jid)
    im.save(jpg, "JPEG", quality=92, optimize=True)
    for f in tmp + [tp]:
        try:
            os.remove(f)
        except Exception:
            pass
    return jpg, int(time.time() - t0), W, H


# ---------- ภาพแบบ ControlNet (cn): FLUX วางโครงภาพ → SDXL อนิเมะวาดใหม่ทั้งภาพรอบเดียวตามเส้นโครง ----------
#   ไม่มีการตัดแปะ: โต๊ะ ของ คน เงา อยู่ในมุมมองเดียวกัน (ผู้ใช้เจอ: โต๊ะไม่เท่ากัน ตุ๊กตาลอย จากวิธีแปะทีละชิ้น)
#   ControlNet Union SDXL (xinsir, Apache-2.0 ใช้หารายได้ได้)
CN_REPO = ("xinsir/controlnet-union-sdxl-1.0", "diffusion_pytorch_model.safetensors")


def ensure_cn():
    if M.get("cn"):
        return
    with LOCK:
        if M.get("cn"):
            return
        log("กำลังโหลด ControlNet SDXL (ครั้งแรกประมาณ 2–4 นาที)")
        fetch([("controlnet", CN_REPO[0], CN_REPO[1], "cn_union_sdxl.safetensors")])
        M["cn"] = "cn_union_sdxl.safetensors"


def wf_sdxl_cn(img_name, pos, neg, seed, denoise, strength, prefix, batch=2, union=True, loras=None):
    wf = wf_sdxl_i2i(img_name, pos, neg, seed, denoise, prefix, loras)
    wf["10"] = {"class_type": "ControlNetLoader", "inputs": {"control_net_name": M["cn"]}}
    cn = ["10", 0]
    if union:
        wf["11"] = {"class_type": "SetUnionControlNetType", "inputs": {"control_net": ["10", 0], "type": "canny/lineart/anime_lineart/mlsd"}}
        cn = ["11", 0]
    wf["12"] = {"class_type": "Canny", "inputs": {"image": ["4", 0], "low_threshold": 0.2, "high_threshold": 0.5}}
    wf["13"] = {"class_type": "ControlNetApplyAdvanced", "inputs": {"positive": ["2", 0], "negative": ["3", 0], "control_net": cn, "image": ["12", 0], "strength": strength, "start_percent": 0.0, "end_percent": 0.85}}
    wf["14"] = {"class_type": "RepeatLatentBatch", "inputs": {"samples": ["5", 0], "amount": batch}}
    wf["6"]["inputs"]["positive"] = ["13", 0]
    wf["6"]["inputs"]["negative"] = ["13", 1]
    wf["6"]["inputs"]["latent_image"] = ["14", 0]
    return wf


def ident_check(path, chars):
    # คนแต่ละคนในภาพตรงกับตัวละครในบทไหม (กันชุด/ผมสลับกัน เช่น แว่นไปอยู่ผิดคน) → (ผ่าน, คะแนนห่าง)
    pc = [c for c in chars if c.get("p")]
    if len(pc) < 2:
        return True, 0.0
    try:
        import itertools
        import torch
        from PIL import Image
        from transformers import CLIPModel, CLIPProcessor
        global _CLIP
        if _CLIP is None:
            nm = "openai/clip-vit-base-patch32"
            _CLIP = (CLIPModel.from_pretrained(nm).eval(), CLIPProcessor.from_pretrained(nm))
        m, pr = _CLIP
        bx = [b for b in detect_boxes(path) if b[0] == 1][:len(pc)]
        if len(bx) < len(pc):
            return True, 0.0  # จำนวนคนตรวจแยกอยู่แล้ว
        im = Image.open(path).convert("RGB")
        crops = [im.crop([int(v) for v in b[1]]) for b in bx]
        inp = pr(text=[str(c.get("desc") or "")[:200] for c in pc], images=crops, return_tensors="pt", padding=True, truncation=True)
        with torch.no_grad():
            lg = m(**inp).logits_per_image.tolist()
        best, bs = None, -1e9
        for perm in itertools.permutations(range(len(pc))):
            s = sum(lg[i][perm[i]] for i in range(len(perm)))
            if s > bs:
                bs, best = s, perm
        ok, mg = True, 1e9
        for i, ci in enumerate(best):
            row = lg[i]
            other = max([row[k] for k in range(len(pc)) if k != ci] or [row[ci]])
            mg = min(mg, row[ci] - other)
            if row[ci] < other:
                ok = False
        return ok, mg
    except Exception as e:
        log("ตรวจตัวตนตัวละครไม่ได้: %s" % str(e)[:120])
        return True, 0.0


def gen_cn(j, port=8188):
    from PIL import Image
    opt = j.get("opt") or {}
    hy = opt.get("hy") or {}
    t0 = time.time()
    ensure_image("schnell")
    ensure_image("sdxl")
    ensure_cn()
    W = max(512, min(1536, int(opt.get("w") or 1344))) // 16 * 16
    H = max(512, min(1536, int(opt.get("h") or 768))) // 16 * 16
    seed = int(opt.get("seed") or 0) or (int(opt.get("seedLoc") or 0) * 1000 + int(opt.get("jobId") or 0) % 1000 if opt.get("seedLoc") else 0) or random.randint(1, 2 ** 31)
    jid = "i%s" % j["id"]
    exp = opt.get("np")
    exp = None if exp is None or exp == "" else int(exp)
    chars = hy.get("chars") or []
    style = hy.get("style") or "anime screencap, flat color, clean lineart, cel shading"
    neg = IMG_NEG + ", " + (hy.get("neg") or "monochrome, greyscale, sketch, letters, logo, school uniform")
    _QNEG[:] = opt.get("qneg") or []
    qc = opt.get("qc") or [j.get("prompt") or ""]

    def bad_count(pth):
        cnt = person_count(pth) if exp is not None else None
        return cnt, cnt is not None and ((exp == 0 and cnt >= 1) or (exp > 0 and cnt > exp))

    # 1) FLUX วางโครงภาพ (มุมกล้อง ตำแหน่งคน/ของ เส้นโต๊ะ) 2 แบบ × สูงสุด 2 รอบ
    best, tmp = None, []
    for rd in range(2):
        pf = "img%sA%d" % (jid, rd)
        outs = comfy_go(wf_flux(j.get("prompt") or "", W, H, seed + rd * 7919, 2, pf), pf, port)
        tmp += outs
        scs, _ = clip_scores(outs, qc)
        for k, pth in enumerate(outs):
            sc = scs[k] if k < len(scs) else 0.0
            cnt, bad = bad_count(pth)
            log("ภาพ %s โครง %d/%d: คะแนน %.1f · คน %s/%s %s" % (jid, rd + 1, k + 1, sc, "-" if cnt is None else cnt, "-" if exp is None else exp, "ไม่ผ่าน" if bad else "ผ่าน"))
            key = (0 if bad else 1, sc)
            if best is None or key > best[0]:
                best = (key, pth)
        if best[0][0] == 1:
            break
    comfy_free(port)
    os.makedirs(os.path.join(COMFY, "input"), exist_ok=True)
    lay = "%s_lay.png" % jid
    Image.open(best[1]).convert("RGB").save(os.path.join(COMFY, "input", lay))
    # 2) SDXL วาดใหม่ทั้งภาพรอบเดียว ตามเส้นโครง (ControlNet) · ตรวจจำนวนคน + ตัวตนตัวละคร + ภาพเพี้ยน
    pos = IMG_POS + style + ", " + (hy.get("all") or "")
    dn, stg = float(hy.get("dn") or 0.82), float(hy.get("cs") or 0.7)
    pick, union = None, True
    for rd in range(2):
        pf = "img%sC%d" % (jid, rd)
        try:
            outs = comfy_go(wf_sdxl_cn(lay, pos, neg, seed + 501 + rd * 97, dn, stg, pf, 2, union), pf, port)
        except RuntimeError as e:
            if union and "SetUnionControlNetType" in str(e) or (union and "node" in str(e).lower()):
                log("ComfyUI รุ่นนี้ไม่มีตัวเลือกชนิด ControlNet ใช้แบบทั่วไปแทน")
                union = False
                outs = comfy_go(wf_sdxl_cn(lay, pos, neg, seed + 501 + rd * 97, dn, stg, pf, 2, union), pf, port)
            else:
                raise
        tmp += outs
        scs, _ = clip_scores(outs, qc)
        for k, pth in enumerate(outs):
            sc = scs[k] if k < len(scs) else 0.0
            cnt, bad = bad_count(pth)
            idok, mg = ident_check(pth, chars)
            ok = not bad and idok
            log("ภาพ %s SDXL %d/%d: คะแนน %.1f · คน %s/%s · ตัวละคร %s %s" % (jid, rd + 1, k + 1, sc, "-" if cnt is None else cnt, "-" if exp is None else exp, "ตรง" if idok else "สลับ", "ผ่าน" if ok else "ไม่ผ่าน"))
            key = (1 if ok else 0, sc)
            if pick is None or key > pick[0]:
                pick = (key, pth)
        if pick[0][0] == 1:
            break
        if rd == 0:
            log("ภาพ %s: ยังไม่มีแบบไหนผ่าน วาดใหม่อีกรอบ" % jid)
    comfy_free(port)
    im = Image.open(pick[1]).convert("RGB")
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    jpg = os.path.join(ROOT, "%s.jpg" % jid)
    im.save(jpg, "JPEG", quality=92, optimize=True)
    for f in tmp + [os.path.join(COMFY, "input", lay)]:
        try:
            os.remove(f)
        except Exception:
            pass
    return jpg, int(time.time() - t0), W, H


# ---------- ภาพจากฉาก 3D (s3d): ห้อง/ของ/ตำแหน่งคน มาจากฉาก 3D เดียวกันทุกช่อง → SDXL วาดตามความลึก + เส้นโครง ----------
#   ฉากเดียวกันทุกมุมกล้อง: ผนัง หน้าต่าง โต๊ะ ตุ๊กตา อยู่ที่เดิมเสมอ (ผู้ใช้สั่ง: ทำ 3D ทุกฉาก)
def render3d(boxes, cam, W, H):
    import numpy as np
    p = np.array(cam["p"], float); l = np.array(cam["l"], float)
    f = l - p; f /= np.linalg.norm(f)
    up = np.array([0.0, 1.0, 0.0])
    r = np.cross(up, f); r /= (np.linalg.norm(r) + 1e-9)  # แกน +x = ขวาของภาพ
    u = np.cross(f, r)
    th = np.tan(np.radians(float(cam.get("fov", 55))) / 2)
    ys, xs = np.mgrid[0:H, 0:W]
    sx = (2 * (xs + 0.5) / W - 1) * th * W / H
    sy = (1 - 2 * (ys + 0.5) / H) * th
    d = f[None, None, :] + sx[..., None] * r[None, None, :] + sy[..., None] * u[None, None, :]
    d /= np.linalg.norm(d, axis=2, keepdims=True)
    d = np.where(np.abs(d) < 1e-9, 1e-9, d)
    inv = 1.0 / d
    T = np.full((H, W), np.inf); FID = np.full((H, W), -1, np.int64)
    for bi, b in enumerate(boxes):
        mn = np.array(b[:3], float); mx = np.array(b[3:6], float)
        t1 = (mn - p) * inv; t2 = (mx - p) * inv
        tlo = np.minimum(t1, t2); thi = np.maximum(t1, t2)
        tmin = tlo.max(axis=2); tmax = thi.min(axis=2)
        ax = tlo.argmax(axis=2)
        hit = (tmax >= np.maximum(tmin, 0)) & (tmin > 1e-3)
        closer = hit & (tmin < T)
        T[closer] = tmin[closer]
        sgn = np.take_along_axis(d, ax[..., None], 2)[..., 0] > 0
        FID[closer] = (bi * 6 + ax * 2 + sgn)[closer]
    zf = T * (d @ f)
    fin = np.isfinite(zf)
    far = np.percentile(zf[fin], 98) if fin.any() else 1.0
    near = max(0.05, zf[fin].min()) if fin.any() else 0.0
    dep = np.zeros((H, W))
    dep[fin] = 1.0 - np.clip((zf[fin] - near) / max(1e-6, far - near), 0, 1) * 0.92
    e = np.zeros((H, W), bool)
    e[:, 1:] |= FID[:, 1:] != FID[:, :-1]
    e[1:, :] |= FID[1:, :] != FID[:-1, :]
    z2 = np.where(fin, zf, far * 3)
    e[:, 1:] |= np.abs(z2[:, 1:] - z2[:, :-1]) > 0.06 * np.minimum(z2[:, 1:], z2[:, :-1])
    e[1:, :] |= np.abs(z2[1:, :] - z2[:-1, :]) > 0.06 * np.minimum(z2[1:, :], z2[:-1, :])
    e2 = e.copy(); e2[1:, :] |= e[:-1, :]; e2[:, 1:] |= e[:, :-1]
    render3d.bid = np.where(FID >= 0, FID // 6, -1)  # ดัชนีกล่องที่เห็นในแต่ละพิกเซล (ทำหน้ากากตัวละคร)
    return (dep * 255).astype(np.uint8), (e2 * 255).astype(np.uint8)


IPA_FILES = (("ipadapter", "h94/IP-Adapter", "sdxl_models/ip-adapter-plus_sdxl_vit-h.safetensors", "ip-adapter-plus_sdxl_vit-h.safetensors"),
             ("clip_vision", "h94/IP-Adapter", "models/image_encoder/model.safetensors", "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"))


def ensure_ipa():
    # IP-Adapter Plus SDXL (h94, Apache-2.0) + ตัวเข้ารหัสภาพ ViT-H · ใช้ไม่ได้ = ข้าม (วาดแบบไม่มีภาพอ้างอิง)
    if M.get("ipa") or M.get("noipa"):
        return bool(M.get("ipa"))
    if not os.path.isdir(os.path.join(COMFY, "custom_nodes", "ComfyUI_IPAdapter_plus")):
        M["noipa"] = 1
        log("ยังไม่มีตัวป้อนภาพอ้างอิง (IP-Adapter) ในเครื่องรอบนี้ — รอบหน้าจะติดตั้งให้")
        return False
    with LOCK:
        try:
            fetch(list(IPA_FILES))
            M["ipa"] = IPA_FILES[0][3]
            M["clipv"] = IPA_FILES[1][3]
            log("ตัวป้อนภาพอ้างอิงตัวละคร (IP-Adapter) พร้อม")
        except Exception as e:
            M["noipa"] = 1
            log("โหลด IP-Adapter ไม่ได้: %s" % str(e)[:160])
    return bool(M.get("ipa"))


def get_ref(url, jid, k):
    # ดึงภาพอ้างอิงที่ผู้ใช้อนุมัติ (ลิงก์มีลายเซ็นจากเว็บ) ลงโฟลเดอร์ input ของ ComfyUI
    nm = "%s_ref%d.png" % (jid, k)
    try:
        from PIL import Image
        import io
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=120) as r:
            Image.open(io.BytesIO(r.read())).convert("RGB").save(os.path.join(COMFY, "input", nm))
        return nm
    except Exception as e:
        log("ดึงภาพอ้างอิงไม่ได้: %s" % str(e)[:120])
        return None


def add_ipa(wf, model_ref, refs, final_node, end_at=1.0):
    # refs = [(ชื่อไฟล์ภาพอ้างอิง, ชื่อไฟล์หน้ากากหรือ None, น้ำหนัก)] → ต่อโมเดลผ่าน IPAdapterAdvanced ทีละตัว
    if not refs:
        return wf
    wf["40"] = {"class_type": "IPAdapterModelLoader", "inputs": {"ipadapter_file": M["ipa"]}}
    wf["41"] = {"class_type": "CLIPVisionLoader", "inputs": {"clip_name": M["clipv"]}}
    pm = model_ref
    for i, (img, mask, w) in enumerate(refs):
        a, b, c = str(50 + i * 3), str(51 + i * 3), str(52 + i * 3)
        wf[a] = {"class_type": "LoadImage", "inputs": {"image": img}}
        wf[c] = {"class_type": "IPAdapterAdvanced", "inputs": {"model": pm, "ipadapter": ["40", 0], "image": [a, 0], "weight": w, "weight_type": "linear", "combine_embeds": "concat", "start_at": 0.0, "end_at": end_at, "embeds_scaling": "V only", "clip_vision": ["41", 0]}}
        if mask:
            wf[b] = {"class_type": "LoadImageMask", "inputs": {"image": mask, "channel": "red"}}
            wf[c]["inputs"]["attn_mask"] = [b, 0]
        pm = [c, 0]
    wf[final_node]["inputs"]["model"] = pm
    return wf


def wf_sdxl_s3d(dep_name, lin_name, pos, neg, seed, prefix, W, H, sd, sl, batch=2):
    wf = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": M["sdxl"]}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": pos}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": neg}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": W, "height": H, "batch_size": batch}},
        "10": {"class_type": "ControlNetLoader", "inputs": {"control_net_name": M["cn"]}},
        "11": {"class_type": "SetUnionControlNetType", "inputs": {"control_net": ["10", 0], "type": "depth"}},
        "12": {"class_type": "SetUnionControlNetType", "inputs": {"control_net": ["10", 0], "type": "canny/lineart/anime_lineart/mlsd"}},
        "13": {"class_type": "LoadImage", "inputs": {"image": dep_name}},
        "14": {"class_type": "LoadImage", "inputs": {"image": lin_name}},
        "15": {"class_type": "ControlNetApplyAdvanced", "inputs": {"positive": ["2", 0], "negative": ["3", 0], "control_net": ["11", 0], "image": ["13", 0], "strength": sd, "start_percent": 0.0, "end_percent": 0.8}},
        "16": {"class_type": "ControlNetApplyAdvanced", "inputs": {"positive": ["15", 0], "negative": ["15", 1], "control_net": ["12", 0], "image": ["14", 0], "strength": sl, "start_percent": 0.0, "end_percent": 0.65}},
        "5": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "seed": seed, "steps": 30, "cfg": 5.5, "sampler_name": "euler_ancestral", "scheduler": "normal", "positive": ["16", 0], "negative": ["16", 1], "latent_image": ["4", 0], "denoise": 1.0}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": prefix}},
    }
    if M.get("sdxlvae"):
        wf["9"] = {"class_type": "VAELoader", "inputs": {"vae_name": M["sdxlvae"]}}
        wf["6"]["inputs"]["vae"] = ["9", 0]
    return wf


def gen_s3d(j, port=8188):
    from PIL import Image
    opt = j.get("opt") or {}
    hy = opt.get("hy") or {}
    s3 = opt.get("s3") or {}
    t0 = time.time()
    ensure_image("sdxl")
    ensure_cn()
    W = max(512, min(1536, int(opt.get("w") or 1344))) // 16 * 16
    H = max(512, min(1536, int(opt.get("h") or 768))) // 16 * 16
    seed = int(opt.get("seed") or 0) or random.randint(1, 2 ** 31)
    jid = "i%s" % j["id"]
    exp = opt.get("np")
    exp = None if exp is None or exp == "" else int(exp)
    chars = hy.get("chars") or []
    style = hy.get("style") or "anime screencap, flat color, clean lineart, cel shading"
    neg = IMG_NEG + ", " + (hy.get("neg") or "monochrome, greyscale, sketch, letters, logo, school uniform")
    _QNEG[:] = opt.get("qneg") or []
    qc = opt.get("qc") or [j.get("prompt") or ""]
    # 1) เรนเดอร์ฉาก 3D: ความลึก (ฉาก + หุ่นคน) · เส้นโครง (เฉพาะฉาก ไม่ใส่หุ่น — ไม่ให้คนออกมาเหลี่ยมเป็นกล่อง)
    dep, _ = render3d((s3.get("boxes") or []) + (s3.get("act") or []), s3["cam"], W // 2, H // 2)
    bid = render3d.bid
    _, lin = render3d(s3.get("boxes") or [], s3["cam"], W // 2, H // 2)
    os.makedirs(os.path.join(COMFY, "input"), exist_ok=True)
    dn, ln = "%s_dep.png" % jid, "%s_lin.png" % jid
    Image.fromarray(dep).convert("RGB").resize((W, H), Image.BILINEAR).save(os.path.join(COMFY, "input", dn))
    Image.fromarray(lin).convert("RGB").resize((W, H), Image.NEAREST).save(os.path.join(COMFY, "input", ln))
    log("ภาพ %s: เรนเดอร์ฉาก 3D %s มุม %s" % (jid, s3.get("loc", "?"), s3.get("camName", "?")))
    # ภาพอ้างอิงตัวละครที่ผู้ใช้อนุมัติ → ป้อนเฉพาะบริเวณของตัวละครนั้น (หน้ากากจากหุ่นในฉาก 3D)
    refs = []
    if any(c.get("ref") for c in chars) and ensure_ipa():
        import numpy as np
        from PIL import ImageFilter
        nset, k0 = len(s3.get("boxes") or []), 0
        for ai, (nm, nb) in enumerate(zip(s3.get("actn") or [], s3.get("actc") or [])):
            c = next((x for x in chars if x.get("n") == nm), None)
            if c and c.get("ref"):
                mk = np.isin(bid, list(range(nset + k0, nset + k0 + nb)))
                if mk.any():
                    rimg = get_ref(c["ref"], jid, ai)
                    if rimg:
                        mn = "%s_mk%d.png" % (jid, ai)
                        Image.fromarray((mk * 255).astype("uint8")).filter(ImageFilter.MaxFilter(15)).resize((W, H), Image.BILINEAR).convert("RGB").save(os.path.join(COMFY, "input", mn))
                        refs.append((rimg, mn, float(c.get("rw") or 0.6)))
            k0 += nb
        if refs:
            log("ภาพ %s: ใช้ภาพอ้างอิงตัวละคร %d ตัว" % (jid, len(refs)))
    # 2) SDXL วาดทั้งภาพตามฉาก 3D · ตรวจจำนวนคน + ตัวตน + ภาพเพี้ยน · ไม่ผ่านวาดใหม่อีกรอบ
    pos = IMG_POS + style + ", " + (hy.get("all") or "")
    sd, sl = float(s3.get("sd") or 0.7), float(s3.get("sl") or 0.55)
    pick, tmp = None, []
    for rd in range(2):
        pf = "img%sS%d" % (jid, rd)
        wf = wf_sdxl_s3d(dn, ln, pos, neg, seed + rd * 131, pf, W, H, sd, sl, 2)
        if refs:
            add_ipa(wf, ["1", 0], refs, "5")
        try:
            outs = comfy_go(wf, pf, port)
        except RuntimeError as e:
            if not refs:
                raise
            log("ใช้ภาพอ้างอิงไม่ได้รอบนี้ วาดแบบไม่มีภาพอ้างอิง: %s" % str(e)[:160])
            refs, M["noipa"] = [], 1
            outs = comfy_go(wf_sdxl_s3d(dn, ln, pos, neg, seed + rd * 131, pf, W, H, sd, sl, 2), pf, port)
        tmp += outs
        scs, _ = clip_scores(outs, qc)
        for k, pth in enumerate(outs):
            sc = scs[k] if k < len(scs) else 0.0
            cnt = person_count(pth) if exp is not None else None
            bad = cnt is not None and ((exp == 0 and cnt >= 1) or (exp > 0 and cnt > exp))
            idok, mg = ident_check(pth, chars)
            ok = not bad and idok
            log("ภาพ %s 3D %d/%d: คะแนน %.1f · คน %s/%s · ตัวละคร %s %s" % (jid, rd + 1, k + 1, sc, "-" if cnt is None else cnt, "-" if exp is None else exp, "ตรง" if idok else "สลับ", "ผ่าน" if ok else "ไม่ผ่าน"))
            key = (1 if ok else 0, sc)
            if pick is None or key > pick[0]:
                pick = (key, pth)
        if pick[0][0] == 1:
            break
    comfy_free(port)
    im = Image.open(pick[1]).convert("RGB")
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    jpg = os.path.join(ROOT, "%s.jpg" % jid)
    im.save(jpg, "JPEG", quality=92, optimize=True)
    for f in tmp + [os.path.join(COMFY, "input", dn), os.path.join(COMFY, "input", ln)]:
        try:
            os.remove(f)
        except Exception:
            pass
    return jpg, int(time.time() - t0), W, H


def gen_image(j, port=8188):
    opt = j.get("opt") or {}
    if opt.get("engine") == "s3d":
        return gen_s3d(j, port)
    if opt.get("engine") == "cn":
        return gen_cn(j, port)
    if opt.get("engine") == "hybrid":
        return gen_hybrid(j, port)
    engine = opt.get("engine") if opt.get("engine") in ("sdxl", "schnell") else "dev"
    ensure_image(engine, opt.get("model") or "", opt.get("quant") or "")
    q = 8 if engine == "sdxl" else 16
    W = max(512, min(1536, int(opt.get("w") or 1024))) // q * q
    H = max(512, min(1536, int(opt.get("h") or 1024))) // q * q
    if engine == "sdxl":
        steps = max(10, min(50, int(opt.get("steps") or 26)))
    elif engine == "schnell":
        steps = max(4, min(8, int(opt.get("steps") or 6)))  # schnell: 4–8 ขั้นพอ
    else:
        steps = max(16, min(30, int(opt.get("steps") or 24)))
    seed = int(opt.get("seed") or 0) or (int(opt.get("seedLoc") or 0) * 1000 + int(opt.get("jobId") or 0) % 1000 if opt.get("seedLoc") else 0) or random.randint(1, 2 ** 31)
    takes = max(1, min(3, int(opt.get("takes") or 1)))  # SDXL ก็วาดหลายแบบแล้วตรวจเลือกได้ (ภาพอ้างอิง/ชุดฝึก: นับคน + CLIP ตรวจภาพเสีย)  # วาดหลายแบบในรอบเดียว แล้วตรวจเลือกภาพที่ดีที่สุด
    jid = "i%s" % j["id"]
    if engine == "sdxl":
        wf = {
            "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": M["sdxl"]}},
            "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": IMG_POS + (j.get("prompt") or "")}},
            "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": IMG_NEG}},
            "4": {"class_type": "EmptyLatentImage", "inputs": {"width": W, "height": H, "batch_size": takes}},
            "5": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "seed": seed, "steps": steps, "cfg": 6.0, "sampler_name": "euler_ancestral", "scheduler": "normal", "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0], "denoise": 1.0}},
            "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
            "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": "img%s" % jid}},
        }
        if M.get("sdxlvae"):
            wf["8"] = {"class_type": "VAELoader", "inputs": {"vae_name": M["sdxlvae"]}}
            wf["6"]["inputs"]["vae"] = ["8", 0]
        pm, pc = ["1", 0], ["1", 1]
        for n, lo in enumerate(opt.get("loras") or []):
            nid = str(30 + n)
            wf[nid] = {"class_type": "LoraLoader", "inputs": {"model": pm, "clip": pc, "lora_name": ensure_lora(lo["id"]), "strength_model": float(lo.get("w") or 0.8), "strength_clip": 1.0}}
            pm, pc = [nid, 0], [nid, 1]
        wf["2"]["inputs"]["clip"] = pc
        wf["3"]["inputs"]["clip"] = pc
        wf["5"]["inputs"]["model"] = pm
        if opt.get("ref") and ensure_ipa():  # ภาพอ้างอิงที่ผู้ใช้เลือก: ล็อกหน้า/ทรงตัวละครด้วย IP-Adapter
            rimg = get_ref(opt["ref"], jid, 0)
            if rimg:
                add_ipa(wf, pm, [(rimg, None, float(opt.get("rw") or 0.55))], "5", float(opt.get("ipa_end") or 1.0))  # ipa_end < 1 = ล็อกหน้า/โครงช่วงต้น ปล่อยลายเส้น/สีช่วงท้าย (กันสไตล์ภาพต้นแบบหลุดมา เช่น พื้นหลังสีรุ้ง ภาพซ้อนสองคน)
        if opt.get("neg"):
            wf["3"]["inputs"]["text"] = IMG_NEG + ", " + str(opt["neg"])
    else:
        wf = {
            "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": M["flux_s" if engine == "schnell" else "flux"]}},
            "2": {"class_type": "DualCLIPLoader", "inputs": {"clip_name1": "t5xxl_fp8_e4m3fn.safetensors", "clip_name2": "clip_l.safetensors", "type": "flux"}},
            "3": {"class_type": "VAELoader", "inputs": {"vae_name": M["fluxvae"]}},
            "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": (j.get("prompt") or "")}},
            "5": {"class_type": "FluxGuidance", "inputs": {"conditioning": ["4", 0], "guidance": float(opt.get("guidance") or FLUX_GUIDANCE)}},
            "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": ""}},
            "7": {"class_type": "EmptySD3LatentImage", "inputs": {"width": W, "height": H, "batch_size": takes}},
            "8": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "seed": seed, "steps": steps, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0], "denoise": 1.0}},
            "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["3", 0]}},
            "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "img%s" % jid}},
        }
    t0 = time.time()
    sk = [k for k in wf if wf[k]["class_type"] == "SaveImage"][0]
    kk = "5" if engine == "sdxl" else "8"

    def run_once(sd, tag):
        wf[kk]["inputs"]["seed"] = sd
        wf[sk]["inputs"]["filename_prefix"] = "img%s%s" % (jid, tag)
        t1 = time.time()
        pid = comfy("/prompt", {"prompt": wf, "client_id": "bot"}, port=port)["prompt_id"]
        while True:
            time.sleep(2)
            h = comfy("/history/" + pid, port=port)
            if pid in h:
                st = h[pid].get("status", {})
                if st.get("status_str") == "error":
                    msgs = [m for m in st.get("messages", []) if m[0] == "execution_error"]
                    raise RuntimeError("เจนภาพไม่สำเร็จ: " + json.dumps(msgs)[:500])
                break
            if time.time() - t1 > 900:
                raise RuntimeError("เจนภาพนานเกิน 15 นาที")
        return sorted(glob.glob(os.path.join(COMFY, "output", "**", "img%s%s_*" % (jid, tag)), recursive=True))

    from PIL import Image
    # ตรวจภาพอัตโนมัติ (Visual QC): ทุกแบบที่วาด → (1) นับคนในภาพด้วยตัวตรวจจับคน เทียบจำนวนที่บทกำหนด (กันคนซ้ำ/คนแปลกหน้าโผล่)
    # (2) CLIP ให้คะแนนตรงบท − ภาพเสีย · ถ้าไม่มีแบบไหนผ่าน วาดใหม่ทันทีด้วย seed ใหม่ (สูงสุด 3 รอบ) แล้วใช้แบบที่ดีที่สุด
    exp = opt.get("np")
    exp = None if exp is None or exp == "" else int(exp)
    rounds = 3 if takes > 1 else 1
    outs_all, best_ok, best_any = [], None, None
    for rd in range(rounds):
        outs = run_once(seed + rd * 7919, "r%d" % rd)
        if not outs:
            raise RuntimeError("ไม่มีไฟล์ภาพออกมา")
        outs_all += outs
        if takes <= 1:
            best_any = (0.0, outs[-1])
            break
        _QNEG[:] = opt.get("qneg") or []
        scs, info = clip_scores(outs, opt.get("qc") or [j.get("prompt") or ""])
        for k, pth in enumerate(outs):
            sc = scs[k] if k < len(scs) else 0.0
            cnt = person_count(pth) if exp is not None else None
            bad = cnt is not None and ((exp == 0 and cnt >= 1) or (exp > 0 and cnt > exp))
            log("ภาพ %s รอบ %d แบบ %d: คะแนน %.1f · คนในภาพ %s/%s %s" % (jid, rd + 1, k + 1, sc, "-" if cnt is None else cnt, "-" if exp is None else exp, "ไม่ผ่าน" if bad else "ผ่าน"))
            if best_any is None or sc > best_any[0]:
                best_any = (sc, pth)
            if not bad and (best_ok is None or sc > best_ok[0]):
                best_ok = (sc, pth)
        if best_ok:
            break
        log(("ภาพ %s: ไม่มีแบบไหนผ่านการตรวจ วาดใหม่รอบที่ %d" % (jid, rd + 2)) if rd + 1 < rounds else ("ภาพ %s: ตรวจไม่ผ่านครบ %d รอบ ใช้แบบที่คะแนนดีที่สุด" % (jid, rounds)))
    outs = outs_all
    pick = outs.index((best_ok or best_any)[1])
    im = Image.open(outs[pick]).convert("RGB")
    if (j.get("opt") or {}).get("gray"):
        im = im.convert("L").convert("RGB")  # สตอรีบอร์ดร่าง: บังคับขาวดำ กันสีหลุด
    if max(e[1] for e in im.getextrema()) < 10:
        raise RuntimeError("ภาพที่ได้เป็นสีดำ (VAE ผิดพลาด)")
    jpg = os.path.join(ROOT, "%s.jpg" % jid)
    im.save(jpg, "JPEG", quality=90, optimize=True)
    for f in outs:
        try:
            os.remove(f)
        except Exception:
            pass
    return jpg, int(time.time() - t0), W, H


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
    sh('"%s" -y -loglevel error %s -filter_complex "%s%sconcat=n=%d:v=1:a=0[o]" -map "[o]" -c:v libx264 -preset veryfast -crf 23 -movflags +faststart "%s"' % (ff, ins, parts, chain, len(files), out))
    shutil.rmtree(d, ignore_errors=True)
    return out, 0, W, H


TH_MARKS = set(chr(c) for c in [0x0E31] + list(range(0x0E34, 0x0E3B)) + list(range(0x0E47, 0x0E4F)))
TH_LEAD = set("เแโใไ")
FONTS = {"dir": "", "name": ""}


TH = {"tok": None}


def th_tokens(t):
    # ตัดคำไทยด้วย pythainlp (ติดตั้งครั้งแรกครั้งเดียว) · ใช้ไม่ได้ก็คืน None แล้วไปใช้วิธีสำรอง
    if TH["tok"] is None:
        try:
            try:
                from pythainlp.tokenize import word_tokenize
            except Exception:
                sh("pip install -q pythainlp", check=False)
                from pythainlp.tokenize import word_tokenize
            TH["tok"] = lambda x: word_tokenize(x, engine="newmm", keep_whitespace=True)
        except Exception:
            TH["tok"] = False
    if not TH["tok"]:
        return None
    try:
        return [w for w in TH["tok"](t) if w]
    except Exception:
        return None


def th_vis(t):
    return sum(1 for ch in t if ch not in TH_MARKS)


def wrap_th(t, maxc, maxl=3):
    # ตัดบรรทัดซับ: ภาษาไทยไม่มีเว้นวรรคระหว่างคำ → ตัดตามคำ (pythainlp) · สำรอง: ตัดที่เว้นวรรค หรือจุดที่สระ/วรรณยุกต์ไม่ขาดจากพยัญชนะ
    t = " ".join(str(t or "").split())
    out = []
    toks = th_tokens(t) if th_vis(t) > maxc else None
    if toks:
        cur = ""
        for w in toks:
            if cur.strip() and th_vis(cur + w) > maxc:
                out.append(cur.strip())
                cur = w.lstrip()
            else:
                cur += w
        if cur.strip():
            out.append(cur.strip())
        t = ""
    while t:
        n = 0
        cut = len(t)
        for i, ch in enumerate(t):
            if ch not in TH_MARKS:
                n += 1
            if n > maxc:
                cut = i
                break
        if cut < len(t):
            sp = t.rfind(" ", int(cut * 0.4), cut + 1)
            if sp > 0:
                cut = sp
            else:
                while cut > 2 and (t[cut] in TH_MARKS or t[cut] in "ะาำๅๆ" or t[cut - 1] in TH_LEAD):
                    cut -= 1
        out.append(t[:cut].strip())
        t = t[cut:].strip()
    if len(out) > maxl:
        out = out[:maxl - 1] + [" ".join(out[maxl - 1:])]
    return out


def thai_font():
    # ฟอนต์ไทยสำหรับซับ/เครดิต: ใช้ของเครื่องถ้ามี ไม่งั้นโหลดมาเก็บไว้
    if FONTS["name"]:
        return FONTS
    fd = os.path.join(ROOT, "fonts")
    os.makedirs(fd, exist_ok=True)
    for name, urls in (("Sarabun", ["https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Bold.ttf", "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-Bold.ttf"]),
                       ("Noto Sans Thai", ["https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSansThai/hinted/ttf/NotoSansThai-Bold.ttf"])):
        f = os.path.join(fd, name.replace(" ", "") + "-Bold.ttf")
        for u in urls:
            if os.path.exists(f) and os.path.getsize(f) > 20000:
                break
            try:
                with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r, open(f, "wb") as o:
                    shutil.copyfileobj(r, o)
            except Exception:
                pass
        if os.path.exists(f) and os.path.getsize(f) > 20000:
            FONTS.update(dir=fd, name=name)
            return FONTS
        if os.path.exists(f):
            os.remove(f)
    have = sh("fc-list :lang=th family 2>/dev/null | head -20", check=False)
    if not have.strip():
        sh("apt-get install -y -qq fonts-thai-tlwg >/dev/null 2>&1", check=False)
        have = sh("fc-list :lang=th family 2>/dev/null | head -20", check=False)
    for cand in ("Sarabun", "Noto Sans Thai", "Loma", "Garuda", "Waree", "Kinnari"):
        if cand in have:
            FONTS.update(dir="", name=cand)
            return FONTS
    log("ไม่พบฟอนต์ไทยในเครื่อง ซับอาจแสดงผิด")
    FONTS.update(dir="", name="Sans")
    return FONTS


def ff_sub():
    # ffmpeg ที่ฝังซับได้ (ต้องมีตัวกรอง ass): ลองของเครื่องก่อน แล้วค่อยตัวที่มากับ imageio
    for b in ("ffmpeg", ffmpeg_bin()):
        try:
            if " ass " in sh('"%s" -hide_banner -filters 2>/dev/null | grep " ass " || true' % b, check=False):
                return b
        except Exception:
            pass
    return ""


def media_dur(ff, f):
    import re
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", sh('"%s" -i "%s" 2>&1 | grep -m1 Duration || true' % (ff, f), check=False))
    return (int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))) if m else 0.0


def ass_time(t):
    t = max(0.0, t)
    return "%d:%02d:%05.2f" % (int(t // 3600), int(t % 3600 // 60), t % 60)


def ass_esc(t):
    return str(t).replace("\\", "").replace("{", "(").replace("}", ")").replace("\n", " ")


ACT_RE = "fight|battle|chase|attack|talisman|explo|seal|spell|leap|punch|slash|strike|clash|kick|dodge|charge|impact|burst"
CAMS = ["zin", "panR", "zout", "tiltU", "panL", "zin", "tiltD", "zout"]


def pick_cam(en, i, dur):
    # เลือกวิธีขยับกล้องของภาพนิ่งจากคำบรรยายช็อต (ไม่มีคำบอก → หมุนเวียนไม่ให้ซ้ำกันติดๆ)
    import re
    e = (en or "").lower()
    if re.search(ACT_RE, e):
        return "punch"
    if re.search("shock|surpris|gasp|sudden|startl|realiz|wide.?eyed", e):
        return "push"
    if re.search("low angle|looking up|tower|sky|tall|from below", e):
        return "tiltU"
    if re.search("high angle|looking down|from above|bird", e):
        return "tiltD"
    if re.search("wide shot|establishing|landscape|city|street|panorama|skyline", e):
        return "panR" if i % 2 == 0 else "panL"
    if re.search("close.?up|closeup|face|eyes|portrait", e):
        return "zin" if i % 2 == 0 else "zout"
    if dur < 1.7:
        return "hold"
    return CAMS[i % len(CAMS)]


def cam_expr(cam, n):
    # คืน (z, x, y) ของ zoompan · on = เลขเฟรม
    cx, cy = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    if cam == "zout":
        return "1.10-0.10*on/%d" % n, cx, cy
    if cam == "panR":
        return "1.12", "(iw-iw/zoom)*on/%d" % n, cy
    if cam == "panL":
        return "1.12", "(iw-iw/zoom)*(1-on/%d)" % n, cy
    if cam == "tiltU":
        return "1.12", cx, "(ih-ih/zoom)*(1-on/%d)" % n
    if cam == "tiltD":
        return "1.12", cx, "(ih-ih/zoom)*on/%d" % n
    if cam == "push":
        k = max(3, int(n * 0.3))
        return "if(lt(on,%d),1+0.22*on/%d,1.22+0.02*(on-%d)/%d)" % (k, k, k, max(1, n - k)), cx, "ih/2-(ih/zoom/2)-ih*0.03"
    if cam == "punch":
        a, b = max(2, int(n * 0.34)), max(4, int(n * 0.67))
        return "if(lt(on,%d),1.0,if(lt(on,%d),1.28,1.6))" % (a, b), cx, "ih/2-(ih/zoom/2)-ih*0.04"
    if cam == "hold":
        return "1.03", cx, cy
    return "1+0.10*on/%d" % n, cx, cy


def speed_lines(d, W, H):
    # เส้นสปีดโปร่งใส 2 แบบ สลับกันให้ดูสั่นไหว (ใช้ซ้อนบนช็อตแอ็กชัน)
    out = []
    try:
        import math
        import random
        from PIL import Image, ImageDraw
        for v in range(2):
            f = os.path.join(d, "sl%d.png" % v)
            if not os.path.exists(f):
                im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                dr = ImageDraw.Draw(im)
                rnd = random.Random(7 + v * 13)
                R = math.hypot(W, H) / 2
                for _ in range(70):
                    ang = rnd.uniform(0, math.tau)
                    r0 = R * rnd.uniform(0.42, 0.8)
                    w = rnd.uniform(0.004, 0.016)
                    p = [(W / 2 + r0 * math.cos(ang), H / 2 + r0 * math.sin(ang)), (W / 2 + R * 1.1 * math.cos(ang - w), H / 2 + R * 1.1 * math.sin(ang - w)), (W / 2 + R * 1.1 * math.cos(ang + w), H / 2 + R * 1.1 * math.sin(ang + w))]
                    dr.polygon(p, fill=(255, 255, 255, rnd.randint(110, 210)))
                im.save(f)
            out.append(f)
    except Exception as e:
        log("ทำเส้นสปีดไม่ได้: %s" % str(e)[:100])
        return []
    return out


def epcat(j):
    # รวมทั้งตอนเป็นไฟล์เดียวตามลำดับช็อต: ช็อตที่มีคลิปใช้คลิป ช็อตภาพนิ่งทำเป็นคลิปซูมช้า
    # รุ่น 2: ซับไทยฝังในภาพ · เสียงพากย์รายช็อต (ถ้ามี) · เพลงบรรเลงคลอ เบาลงเองตอนมีเสียงพูด · เอนด์เครดิตท้ายตอน
    import re
    spec = json.loads(j.get("prompt") or "[]")
    if isinstance(spec, list):
        spec = {"items": [{"u": u} for u in spec]}
    items = spec.get("items") or []
    opt = j.get("opt") or {}
    still, crf, fps = float(opt.get("still") or 2.2), int(opt.get("crf") or 28), int(opt.get("fps") or 24)
    d = os.path.join(ROOT, "ec%s" % j["id"])
    os.makedirs(d, exist_ok=True)
    ff = ffmpeg_bin()

    def grab(u, f):
        req = urllib.request.Request(u, headers=UA)
        with urllib.request.urlopen(req, timeout=300) as r, open(f, "wb") as o:
            shutil.copyfileobj(r, o)
        return f

    src = []
    for i, it in enumerate(items):
        u = it.get("u") or ""
        isimg = "/vi/" in u
        try:
            f = grab(u, os.path.join(d, "s%03d.%s" % (i, "jpg" if isimg else "mp4")))
        except Exception as e:
            log("ข้ามช็อต %d (ดึงไฟล์ไม่ได้): %s" % (i + 1, str(e)[:120]))
            continue
        vo = ""
        if it.get("vo"):
            try:
                vo = grab(it["vo"], os.path.join(d, "v%03d.wav" % i))
            except Exception as e:
                log("ช็อต %d ไม่มีเสียงพากย์ (ดึงไฟล์ไม่ได้): %s" % (i + 1, str(e)[:120]))
        sfx = []
        for k, su in enumerate((it.get("sfx") or [])[:2]):
            try:
                sfx.append(grab(su, os.path.join(d, "x%03d_%d.snd" % (i, k))))
            except Exception:
                pass
        en = str(it.get("en") or "")
        # บทของช็อต: หลายบรรทัดได้ (ภาพเดียวค้างไว้ ซับเปลี่ยนทีละบรรทัด แบบอนิเมะที่ใช้ภาพนิ่ง)
        lines = [(str(l.get("who") or ""), " ".join(str(l.get("say") or "").split())) for l in (it.get("lines") or []) if isinstance(l, dict) and str(l.get("say") or "").strip()][:4]
        if not lines and str(it.get("say") or "").strip():
            lines = [(str(it.get("who") or ""), " ".join(str(it.get("say")).split()))]
        src.append({"f": f, "img": isimg, "vo": vo, "sfx": sfx, "en": en, "act": bool(re.search(ACT_RE, en.lower())), "hit": bool(re.search("impact|strike|slash|clash|explo|punch|smash|burst|collid|shatter", en.lower())), "chain": bool(it.get("chain")), "lines": lines, "say": " ".join(l[1] for l in lines), "think": " ".join(str(it.get("think") or "").split())[:40], "ono": " ".join(str(it.get("ono") or "").split())[:14]})
    if not src:
        raise RuntimeError("ไม่มีไฟล์ให้รวม")
    W = H = 0
    for x in src:
        if not x["img"]:
            m = re.search(r", (\d{3,4})x(\d{3,4})", sh('"%s" -i "%s" 2>&1 | grep -m1 "Video:" || true' % (ff, x["f"]), check=False))
            if m:
                W, H = int(m.group(1)), int(m.group(2))
                break
    if not W:
        from PIL import Image
        W, H = Image.open(src[0]["f"]).size
    k = min(1.0, 1280.0 / max(W, H))
    W, H = int(W * k) // 2 * 2, int(H * k) // 2 * 2
    enc = "-r %d -c:v libx264 -preset veryfast -crf %d -pix_fmt yuv420p -an" % (fps, max(16, crf - 4))
    parts = []
    sl = speed_lines(d, W, H) if any(x["act"] for x in src) else []
    for i, x in enumerate(src):
        o = os.path.join(d, "p%03d.mp4" % i)
        vlen = media_dur(ff, x["vo"]) if x["vo"] else 0.0
        x["rd"] = [min(3.6, max(1.5, 0.9 + 0.065 * th_vis(l[1]))) for l in x["lines"]]  # เวลาอ่านต่อบรรทัด
        read = sum(x["rd"])
        # เอฟเฟกต์ช็อตแอ็กชัน: จอสั่น + แฟลชขาวตอนเข้า + เส้นสปีด
        fx = ""
        ins = ""
        if x["act"]:
            fx = ",scale=%d:%d,crop=%d:%d:x='(iw-%d)/2*(1+sin(n*2.3))':y='(ih-%d)/2*(1+cos(n*3.1))'" % (int(W * 1.06) // 2 * 2, int(H * 1.06) // 2 * 2, W, H, W, H)
            if x["chain"]:
                pass  # ท่าต่อเนื่องจากช็อตก่อน: ไม่ใส่แฟลชคั่น ให้ภาพไหลต่อกัน
            elif x["hit"]:
                fx += ",eq=contrast=2.4:saturation=0:brightness=0.06:enable='lt(n,3)',negate=enable='lt(n,3)'"  # เฟรมปะทะ: เงาดำขาวกลับสี 3 เฟรม
            else:
                fx += ",fade=t=in:st=0:d=0.14:color=white"
        try:
            if x["img"]:
                # ภาพนิ่ง: ยาวพอให้อ่านซับ/ฟังเสียงจบ ไม่ค้างนาน · กล้องขยับหลายแบบ
                dur = (vlen + 0.35) if vlen else (read or (1.1 if x["act"] else still))
                dur = max(1.0 if x["act"] else 1.4, dur)
                n = max(2, int(round(dur * fps)))
                z, zx, zy = cam_expr(pick_cam(x["en"], i, dur), n)
                vf = "scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,zoompan=z='%s':d=%d:x='%s':y='%s':s=%dx%d:fps=%d,setsar=1%s" % (W * 2, H * 2, W * 2, H * 2, z, n, zx, zy, W, H, fps, fx)
                base = '-loop 0 -i "%s"' % x["f"]
                cnt = "-frames:v %d" % n
            else:
                dv = media_dur(ff, x["f"]) or 5.0
                # คลิป: ช็อตพูดตัดให้พอดีเสียง/ซับ · ช็อตทั่วไปไม่เกิน 3.5 วิ · ช็อตแอ็กชันใช้เต็ม
                want = dv if x["act"] else ((vlen + 0.4) if vlen else (max(2.0, read) if read else min(dv, 3.5)))
                dur = max(1.2, want)
                pad = (",tpad=stop_mode=clone:stop_duration=%.2f" % (dur - dv)) if dur > dv + 0.05 else ""
                vf = "scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,fps=%d,setsar=1%s%s" % (W, H, W, H, fps, pad, fx)
                base = '-i "%s"' % x["f"]
                cnt = "-t %.2f" % dur
            if x["act"] and len(sl) == 2:
                fc = "[0:v]%s[b];[b][1:v]overlay=enable='lt(mod(n,4),2)'[c];[c][2:v]overlay=enable='gte(mod(n,4),2)'[v]" % vf
                sh('"%s" -y -loglevel error %s -i "%s" -i "%s" -filter_complex "%s" -map "[v]" %s %s "%s"' % (ff, base, sl[0], sl[1], fc, cnt, enc, o))
            else:
                sh('"%s" -y -loglevel error %s -vf "%s" %s %s "%s"' % (ff, base, vf, cnt, enc, o))
            dur = media_dur(ff, o) or dur
            parts.append({"o": o, "dur": dur, "x": x})
        except Exception as e:
            log("ข้ามช็อต %d (แปลงไฟล์ไม่ได้): %s" % (i + 1, str(e)[-160:]))
    if not parts:
        raise RuntimeError("แปลงไฟล์ไม่สำเร็จสักช็อต")
    body = sum(p["dur"] for p in parts)
    credits = [str(c) for c in (spec.get("credits") or []) if str(c).strip()][:12]
    cdur = (4.0 + 0.5 * len(credits)) if (credits or spec.get("title")) else 0.0
    if cdur:
        co = os.path.join(d, "credit.mp4")
        sh('"%s" -y -loglevel error -f lavfi -i "color=c=0x101018:s=%dx%d:r=%d" -t %.2f %s "%s"' % (ff, W, H, fps, cdur, enc, co))
        parts.append({"o": co, "dur": cdur, "x": None})
    lst = os.path.join(d, "list.txt")
    with open(lst, "w") as o:
        for p in parts:
            o.write("file '%s'" % p["o"] + chr(10))
    silent = os.path.join(d, "silent.mp4")
    sh('"%s" -y -loglevel error -f concat -safe 0 -i "%s" -c copy "%s"' % (ff, lst, silent))
    total = body + cdur
    # ---- เสียง: พากย์เรียงตามช็อต + เพลงคลอ ----
    SR = 44100
    al = os.path.join(d, "alist.txt")
    anyvo = False
    with open(al, "w") as o:
        for i, p in enumerate(parts):
            a = os.path.join(d, "a%03d.wav" % i)
            x = p["x"]
            snd = ([(x["vo"], 1.0, 150)] if x and x["vo"] else []) + ([(f, 0.8, 40) for f in x["sfx"]] if x else [])
            if snd:
                try:
                    fc = ";".join("[%d:a]aresample=%d,aformat=channel_layouts=stereo,volume=%.2f,adelay=%d:all=1[s%d]" % (k, SR, v, dl, k) for k, (f, v, dl) in enumerate(snd))
                    fc += ";" + "".join("[s%d]" % k for k in range(len(snd))) + "amix=inputs=%d:normalize=0:duration=longest,apad[m]" % len(snd)
                    sh('"%s" -y -loglevel error %s -filter_complex "%s" -map "[m]" -t %.3f -ar %d -ac 2 "%s"' % (ff, " ".join('-i "%s"' % f for f, v, dl in snd), fc, p["dur"], SR, a))
                    anyvo = anyvo or bool(x["vo"])
                except Exception:
                    sh('"%s" -y -loglevel error -f lavfi -i anullsrc=r=%d:cl=stereo -t %.3f "%s"' % (ff, SR, p["dur"], a))
            else:
                sh('"%s" -y -loglevel error -f lavfi -i anullsrc=r=%d:cl=stereo -t %.3f "%s"' % (ff, SR, p["dur"], a))
            o.write("file '%s'" % a + chr(10))
    voice = os.path.join(d, "voice.wav")
    sh('"%s" -y -loglevel error -f concat -safe 0 -i "%s" -c copy "%s"' % (ff, al, voice))
    bgm = ""
    if spec.get("bgm"):
        try:
            bgm = grab(spec["bgm"], os.path.join(d, "bgm.src"))
        except Exception as e:
            log("ไม่มีเพลงประกอบ (ดึงไฟล์ไม่ได้): %s" % str(e)[:120])
    mix = os.path.join(d, "mix.m4a")
    if bgm:
        fo = max(0.0, total - 2.5)
        fc = ("[1:a]aresample=%d,volume=%.2f,afade=t=in:d=1.5,afade=t=out:st=%.2f:d=2.5[b];[0:a]asplit[v1][v2];[b][v1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[bd];[v2][bd]amix=inputs=2:normalize=0:duration=first[m]"
              % (SR, float(opt.get("bgmvol") or 0.35), fo))
        sh('"%s" -y -loglevel error -i "%s" -stream_loop -1 -i "%s" -filter_complex "%s" -map "[m]" -t %.3f -c:a aac -b:a 160k "%s"' % (ff, voice, bgm, fc, total, mix))
    else:
        sh('"%s" -y -loglevel error -i "%s" -t %.3f -c:a aac -b:a 128k "%s"' % (ff, voice, total, mix))
    # ---- ซับ + เครดิต (ASS) ----
    out = os.path.join(ROOT, "job%s.mp4" % j["id"])
    subs = [p for p in parts if p["x"] and (p["x"]["say"] or p["x"]["think"] or p["x"]["ono"])]
    done = False
    fsub = ff_sub() if (subs or cdur) else ""
    if fsub:
        fn = thai_font()
        land = W >= H
        fs = int(H / 15.0) if land else int(W / 14.0)
        maxc = max(12, int(W * 0.88 / (fs * 0.5)))
        ass = os.path.join(d, "subs.ass")
        with open(ass, "w", encoding="utf-8") as o:
            o.write("[Script Info]\nScriptType: v4.00+\nPlayResX: %d\nPlayResY: %d\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n" % (W, H))
            o.write("[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n")
            o.write("Style: D,%s,%d,&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,%.1f,1,2,%d,%d,%d,1\n" % (fn["name"], fs, fs / 11.0, int(W * 0.05), int(W * 0.05), int(H * (0.06 if land else 0.14))))
            o.write("Style: N,%s,%d,&H00E8F4FF,&H00FFFFFF,&H00101010,&H80000000,0,-1,0,0,100,100,0,0,1,%.1f,1,2,%d,%d,%d,1\n" % (fn["name"], int(fs * 0.86), fs / 12.0, int(W * 0.05), int(W * 0.05), int(H * (0.06 if land else 0.14))))
            o.write("Style: T,%s,%d,&H00B469FF,&H00FFFFFF,&H00FFFFFF,&H80000000,-1,-1,0,0,100,100,0,0,1,%.1f,2,7,0,0,0,1\n" % (fn["name"], int(fs * 1.0), fs / 9.0))
            o.write("Style: O,%s,%d,&H00FFC850,&H00FFFFFF,&H00401010,&H80000000,-1,0,0,0,100,100,0,0,1,%.1f,2,9,0,0,0,1\n" % (fn["name"], int(fs * 1.9), fs / 7.0))
            o.write("Style: C,%s,%d,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,%d,%d,0,1\n\n" % (fn["name"], int(fs * 0.8), int(W * 0.08), int(W * 0.08)))
            o.write("[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
            t = 0.0
            for p in parts:
                x = p["x"]
                if x and (x["think"] or x["ono"]) and p["dur"] > 0.6:
                    # ตัวหนังสือลอยของช็อตมีม: ความคิดในใจ (มุมบนซ้าย เอียง สีชมพู) · เสียงประกอบแบบมังงะ (ขวา ตัวใหญ่ สีฟ้า) เด้งเข้าแล้วค้าง
                    ta, tb = ass_time(t + 0.12), ass_time(t + p["dur"] - 0.05)
                    if x["think"]:
                        o.write("Dialogue: 1,%s,%s,T,,0,0,0,,{\\an7\\pos(%d,%d)\\frz7\\fad(120,120)\\fscx60\\fscy60\\t(0,160,\\fscx100\\fscy100)}%s\n" % (ta, tb, int(W * 0.05), int(H * (0.07 if land else 0.12)), "\\N".join(ass_esc(l) for l in wrap_th(x["think"], max(8, int(maxc * 0.45)), 3))))
                    if x["ono"]:
                        o.write("Dialogue: 1,%s,%s,O,,0,0,0,,{\\an9\\pos(%d,%d)\\frz-11\\fad(80,120)\\fscx40\\fscy40\\t(0,140,\\fscx112\\fscy112)\\t(140,240,\\fscx100\\fscy100)}%s\n" % (ta, tb, int(W * 0.95), int(H * (0.10 if land else 0.20)), ass_esc(x["ono"])))
                if x and x["lines"]:
                    # แบ่งเวลาของช็อตให้แต่ละบรรทัดตามความยาว · บรรทัดยาวเกิน 2 แถวแตกเป็นท่อน ขึ้นทีละนิด
                    ev = []
                    for (who, say), rd in zip(x["lines"], x["rd"]):
                        rows = wrap_th(say, maxc, 99)
                        grp = [rows[k:k + 2] for k in range(0, len(rows), 2)]
                        for g in grp:
                            ev.append((who, g, rd * sum(th_vis(r) for r in g) / max(1, sum(th_vis(r) for r in rows))))
                    tot = sum(e[2] for e in ev) or 1.0
                    a0 = t + 0.1
                    span = max(0.5, p["dur"] - 0.18)
                    for who, g, w in ev:
                        b0 = a0 + span * w / tot
                        o.write("Dialogue: 0,%s,%s,%s,,0,0,0,,%s\n" % (ass_time(a0), ass_time(b0 - 0.04), "D" if who else "N", "\\N".join(ass_esc(l) for l in g)))
                        a0 = b0
                t += p["dur"]
            if cdur:
                big = int(fs * 1.25)
                lines = []
                if spec.get("title"):
                    lines.append("{\\fs%d\\b1}%s{\\b0\\fs%d}" % (big, ass_esc(spec["title"]), int(fs * 0.72)))
                if spec.get("eptitle") or spec.get("ep"):
                    lines.append(ass_esc(("ตอนที่ %s" % spec["ep"] if spec.get("ep") else "") + ((" · " if spec.get("ep") else "") + str(spec["eptitle"]) if spec.get("eptitle") else "")))
                    lines.append("")
                for c in credits:
                    lines += [ass_esc(l) for l in wrap_th(c, int(maxc * 1.25))]
                o.write("Dialogue: 0,%s,%s,C,,0,0,0,,{\\fad(700,500)}%s\n" % (ass_time(body + 0.3), ass_time(total - 0.2), "\\N".join(lines)))
        try:
            fdopt = (":fontsdir='%s'" % fn["dir"]) if fn["dir"] else ""
            sh('"%s" -y -loglevel error -i "%s" -i "%s" -vf "ass=\'%s\'%s" -c:v libx264 -preset veryfast -crf %d -pix_fmt yuv420p -r %d -c:a copy -shortest -movflags +faststart "%s"' % (fsub, silent, mix, ass, fdopt, crf, fps, out), cwd=d)
            done = True
        except Exception as e:
            log("ฝังซับไม่สำเร็จ ส่งแบบไม่มีซับแทน: %s" % str(e)[-200:])
    elif subs or cdur:
        log("เครื่องนี้ไม่มีตัวฝังซับ ส่งแบบไม่มีซับและเครดิตตัวอักษร")
    if not done:
        sh('"%s" -y -loglevel error -i "%s" -i "%s" -c:v copy -c:a copy -shortest -movflags +faststart "%s"' % (ff, silent, mix, out))
    shutil.rmtree(d, ignore_errors=True)
    log("รวมตอนเสร็จ %d ช็อต %d วินาที (%dx%d)%s%s%s" % (len(src), total, W, H, " · มีเสียงพากย์" if anyvo else "", " · มีเพลง" if bgm else "", " · มีซับ" if (done and subs) else ""))
    return out, 0, W, H


# ---------- เทรน LoRA ตัวละคร (kohya sd-scripts · SDXL อนิเมะ · อัตโนมัติจากงาน kind=lora) ----------
KV = os.path.join(ROOT, "kohya")


def ensure_kohya():
    with LOCK:
        if M.get("kohya"):
            return
        log("กำลังติดตั้งตัวเทรน LoRA (ครั้งแรกประมาณ 5–10 นาที)")
        if not os.path.exists(KV):
            sh("git clone --depth 1 https://github.com/kohya-ss/sd-scripts " + KV)
        sh("python3 -m venv --system-site-packages " + KV + "/venv", check=False)
        if not os.path.exists(KV + "/venv/bin/pip"):
            log("venv ไม่มี pip (Kaggle ตัด ensurepip) ลองสร้างด้วย virtualenv แทน")
            sh("rm -rf " + KV + "/venv", check=False)
            sh("python3 -m pip install -q virtualenv", check=False)
            sh("python3 -m virtualenv --system-site-packages " + KV + "/venv", check=False)
        if os.path.exists(KV + "/venv/bin/pip"):
            pip = '"' + KV + '/venv/bin/pip"'
            py = '"' + KV + '/venv/bin/python"'
        else:
            log("สร้าง venv ไม่ได้ ใช้ Python หลักของเครื่องแทน")
            pip = "python3 -m pip"
            py = "python3"
        keep = []
        for ln in open(KV + "/requirements.txt").read().splitlines():
            t = ln.strip()
            if t and not t.startswith(("#", "-", ".", "torch", "xformers")):
                keep.append(t)
        keep += ["accelerate", "bitsandbytes"]
        open("/tmp/kreq.txt", "w").write("\n".join(keep) + "\n")
        r = subprocess.run('%s install -q -r /tmp/kreq.txt' % pip, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        if r.returncode != 0:
            log("ติดตั้งรวดเดียวไม่ผ่าน ลองทีละแพ็กเกจ: " + r.stdout[-300:])
            for t in keep:
                q = subprocess.run('%s install -q "%s"' % (pip, t), shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
                if q.returncode != 0:
                    nm = t
                    for ch in "=<>~! ;[":
                        nm = nm.split(ch)[0]
                    log("แพ็กเกจ %s ติดตั้งแบบล็อกเวอร์ชันไม่ผ่าน ลองเวอร์ชันล่าสุด" % nm)
                    sh('%s install -q "%s"' % (pip, nm), check=False)
        chk = subprocess.run('%s -c "import accelerate, diffusers, transformers, safetensors, bitsandbytes, library.train_util"' % py, shell=True, cwd=KV, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        if chk.returncode != 0:
            raise RuntimeError("ตัวเทรน LoRA ใช้ไม่ได้ (import ไม่ผ่าน): " + chk.stdout[-380:])
        M["kpy"] = py
        M["kohya"] = True


def train_lora(job, port):
    opt = job.get("opt") or {}
    imgs = opt.get("images") or []
    if len(imgs) < 8:
        raise RuntimeError("ภาพสำหรับเทรนน้อยกว่า 8 ภาพ")
    prog(job["id"], 0, 0, "กำลังเตรียมโมเดลและตัวเทรน (ครั้งแรกอาจนาน 5–10 นาที)")
    ensure_image("sdxl", "", "")
    ensure_kohya()
    trig = opt.get("trigger") or "chr"
    d = os.path.join(ROOT, "lora%s" % job["id"])
    data = os.path.join(d, "data", "10_" + trig)
    out = os.path.join(d, "out")
    os.makedirs(data, exist_ok=True)
    os.makedirs(out, exist_ok=True)
    mark = os.path.join(out, "trained.ok")
    t0 = time.time()
    if os.path.exists(mark):
        log("LoRA %s เทรนเสร็จไว้แล้ว ส่งไฟล์ซ้ำอย่างเดียว" % trig)
    else:
        for i, it in enumerate(imgs):
            open(os.path.join(data, "%03d.jpg" % i), "wb").write(call("/k/limg/%s/%s" % (job["id"], it["id"])))
            open(os.path.join(data, "%03d.txt" % i), "w").write(it.get("cap") or trig)
        if port:
            try:
                comfy("/free", {"unload_models": True, "free_memory": True}, port=port)
            except Exception:
                pass
        steps = max(1200, min(2000, len(imgs) * 100))  # ชุดแรกเทรน 960 สเต็ปแล้วแทบไม่มีผลกับภาพ → เพิ่มสเต็ป + แรงขึ้น
        ldim = max(2, min(32, int(opt.get("dim") or 8)))  # ตัวละคร 8 · ศัตรู/สถานที่/สไตล์ 4 (ไฟล์เล็กลงครึ่งหนึ่ง)
        ckpt = os.path.join(COMFY, "models", "checkpoints", M["sdxl"])
        vae = os.path.join(COMFY, "models", "vae", M["sdxlvae"]) if M.get("sdxlvae") else ""
        cmd = ('CUDA_VISIBLE_DEVICES=%d %s "%s/sdxl_train_network.py" --pretrained_model_name_or_path "%s" %s'
               ' --train_data_dir "%s" --output_dir "%s" --output_name lora --caption_extension .txt'
               ' --network_module networks.lora --network_dim %d --network_alpha %d --network_train_unet_only'
               ' --resolution 768,768 --enable_bucket --train_batch_size 1 --max_train_steps %d'
               ' --learning_rate 2e-4 --lr_scheduler cosine --lr_warmup_steps 50 --optimizer_type AdamW8bit'
               ' --mixed_precision fp16 --save_precision fp16 --gradient_checkpointing --cache_latents --sdpa --no_half_vae --seed 1'
               ' --shuffle_caption --keep_tokens 1 --min_snr_gamma 5 --noise_offset 0.05 --max_grad_norm 1.0'
               % (max(0, (port or 8188) - 8188), M.get("kpy") or ('"%s/venv/bin/python"' % KV), KV, ckpt, ('--vae "%s"' % vae) if vae else "", os.path.join(d, "data"), out, ldim, ldim, steps))
        log("เริ่มเทรน LoRA %s (%d ภาพ · %d สเต็ป)" % (trig, len(imgs), steps))
        t0 = time.time()
        prog(job["id"], 0, steps, "เริ่มเทรน")
        sh_prog(cmd, KV, job["id"], steps)
    f = os.path.join(out, "lora.safetensors")
    if not os.path.exists(f):
        raise RuntimeError("เทรนจบแต่ไม่พบไฟล์ LoRA")
    open(mark, "w").write("1")
    data = open(f, "rb").read()
    PART = 20 * 1024 * 1024
    n = max(1, (len(data) + PART - 1) // PART)
    lid = 0
    for i in range(n):  # ส่งเป็นท่อน ท่อนละ 20 MB (ไฟล์ทั้งก้อนใหญ่เกินที่บอทรับได้)
        r = json.loads(call("/k/lora/%s?part=%d&of=%d&size=%d" % (job["id"], i, n, len(data)), raw=data[i * PART:(i + 1) * PART], timeout=900) or b"{}")
        lid = r.get("lid") or lid
    log("ส่งไฟล์ LoRA %s แล้ว (%d MB · %d ท่อน)" % (trig, len(data) / 1048576, n))
    if lid:  # เก็บสำเนาไว้ในเครื่องรอบนี้เลย ไม่ต้องดึงกลับมาอีก
        ld = os.path.join(COMFY, "models", "loras")
        os.makedirs(ld, exist_ok=True)
        shutil.copy(f, os.path.join(ld, "lora%s.safetensors" % lid))
    shutil.rmtree(d, ignore_errors=True)
    dummy = os.path.join(ROOT, "lora_done_%s.bin" % job["id"])
    open(dummy, "wb").write(b"0" * 2048)
    return dummy, time.time() - t0, 0, 0


def sh_prog(cmd, cwd, jid, total):
    import re
    print("$", cmd, flush=True)
    p = subprocess.Popen(cmd, shell=True, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    tail, buf, last = [], "", 0.0
    while True:
        ch = p.stdout.read(1)
        if ch == "":
            break
        if ch not in "\r\n":
            buf += ch
            continue
        line, buf = buf.strip(), ""
        if not line:
            continue
        tail.append(line[-200:])
        tail = tail[-30:]
        m = re.search(r"(\d+)/(\d+)", line)
        if m and "steps" in line and time.time() - last > 15:
            last = time.time()
            try:
                rr = call("/k/prog/%s" % jid, {"step": int(m.group(1)), "total": int(m.group(2)) or total, "tail": line[-200:]}, timeout=20)
                if isinstance(rr, dict) and rr.get("stop"):
                    p.kill()
                    raise RuntimeError("ยกเลิกงานเทรนตามคำสั่งจากเว็บ")
            except RuntimeError:
                raise
            except Exception:
                pass
    p.wait()
    print("\n".join(tail[-12:]), flush=True)
    if p.returncode != 0:
        raise RuntimeError("คำสั่งล้มเหลว: " + cmd[:80] + " :: " + "\n".join(tail)[-300:])


def prog(jid, step, total, tail):
    try:
        call("/k/prog/%s" % jid, {"step": step, "total": total, "tail": tail}, timeout=20)
    except Exception:
        pass


# ---------- เพลง (kind=song): ACE-Step 1.5 (MIT) · เทรน LoRA เสียงร้องญี่ปุ่นจาก PJS corpus (CC BY-SA 4.0 ใช้เชิงพาณิชย์ได้) ----------
#   opt.train=1: ดาวน์โหลด PJS → เทรน LoRA → เก็บไฟล์ขึ้น Supabase · แล้วสร้างเพลงทุกเพลงทั้งแบบเดิมและแบบใช้ LoRA ให้ผู้ใช้ฟังเทียบ
#   ติดตั้งใน venv แยก (ไม่ไปทับ torch ของ ComfyUI)
ACE = None


def ace_setup():
    global ACE
    if ACE:
        return ACE
    d = os.path.join(ROOT, "ace")
    py = os.path.join(d, "venv", "bin", "python")
    vd = os.path.join(d, "venv")
    if not os.path.exists(os.path.join(vd, "bin", "pip")):
        log("กำลังติดตั้ง ACE-Step 1.5 (ครั้งแรกประมาณ 10–15 นาที)")
        if not os.path.isdir(os.path.join(d, "repo")):
            sh("git clone --depth 1 https://github.com/ace-step/ACE-Step-1.5 " + os.path.join(d, "repo"))
        sh("rm -rf " + vd, check=False)
        sh("python3 -m venv --system-site-packages " + vd, check=False)
        if not os.path.exists(os.path.join(vd, "bin", "pip")):  # Kaggle ตัด ensurepip → venv ไม่มี pip (รอบก่อนพังตรงนี้)
            sh("rm -rf " + vd, check=False)
            sh("python3 -m pip install -q virtualenv", check=False)
            sh("python3 -m virtualenv --system-site-packages " + vd, check=False)
        if not os.path.exists(os.path.join(vd, "bin", "pip")):
            raise RuntimeError("สร้าง venv สำหรับ ACE-Step ไม่ได้")
        sh('"%s" -m pip install -q -e "%s"' % (py, os.path.join(d, "repo")), check=False)
        sh('"%s" -m pip install -q gdown huggingface_hub soundfile' % py, check=False)
    ck = os.path.join(d, "repo", "checkpoints")
    if not os.path.isdir(ck) or len(os.listdir(ck)) < 2:
        log("กำลังโหลดโมเดลเพลง ACE-Step 1.5")
        sh('"%s" -c "from huggingface_hub import snapshot_download as s; s(\'ACE-Step/Ace-Step1.5\', local_dir=\'%s\')"' % (py, ck))
    ACE = (d, py, ck)
    return ACE


GEN_PY = r"""
import sys, json, os, glob, shutil
cfg = json.load(open(sys.argv[1]))
repo, out = cfg['repo'], cfg['out']
os.chdir(repo); sys.path.insert(0, repo)
from acestep.handler import AceStepHandler
from acestep.llm_inference import LLMHandler
from acestep.inference import GenerationParams, GenerationConfig, generate_music
dit = AceStepHandler()
dit.initialize_service(project_root=repo, config_path='acestep-v15-turbo', device='cuda')
llm = LLMHandler()
llm.initialize(checkpoint_dir=os.path.join(repo, 'checkpoints'), lm_model_path=cfg.get('lm', 'acestep-5Hz-lm-1.7B'), backend='pt', device='cuda')
res = []
for tag, lora in (('base', None), ('lora', cfg.get('lora'))):
    if tag == 'lora':
        if not lora:
            continue
        dit.add_lora(lora_path=lora, adapter_name='jp')
    for i, s in enumerate(cfg['songs']):
        d = os.path.join(out, '%s_%d' % (tag, i)); os.makedirs(d, exist_ok=True)
        cap = s['caption'] + ((', ' + cfg.get('trigger')) if tag == 'lora' and cfg.get('trigger') else '')
        p = GenerationParams(task_type='text2music', caption=cap, lyrics=s['lyrics'], bpm=s.get('bpm'), keyscale=s.get('key', ''), timesignature='4', vocal_language='ja', duration=float(s.get('dur', 90)))
        try:
            generate_music(dit, llm, p, GenerationConfig(), save_dir=d)
        except Exception as e:
            print('GENFAIL', tag, i, str(e)[:300], flush=True); continue
        f = sorted(glob.glob(os.path.join(d, '**', '*.*'), recursive=True), key=os.path.getsize)
        f = [x for x in f if x.lower().endswith(('.wav', '.flac', '.mp3', '.ogg'))]
        if f:
            res.append({'tag': tag, 'i': i, 'file': f[-1]})
json.dump(res, open(os.path.join(out, 'result.json'), 'w'))
"""


def song_job(j, port):
    opt = j.get("opt") or {}
    t0 = time.time()
    comfy_free(port)
    d, py, ck = ace_setup()
    repo = os.path.join(d, "repo")
    jid = "s%s" % j["id"]
    work_d = os.path.join(ROOT, jid)
    os.makedirs(work_d, exist_ok=True)
    lora = None
    trig = "xiress_jp_vocal"
    if opt.get("train"):
        data = os.path.join(d, "pjs")
        if not os.path.isdir(data):
            log("กำลังดาวน์โหลดคลังเสียงร้อง PJS (CC BY-SA 4.0)")
            zp = os.path.join(d, "pjs.zip")
            sh('"%s" -m gdown --id 1hPHwOkSe2Vnq6hXrhVtzNskJjVMQmvN_ -O "%s"' % (py, zp))
            sh('cd "%s" && unzip -q -o "%s" -d pjs' % (d, zp))
        aud = os.path.join(work_d, "audio")
        os.makedirs(aud, exist_ok=True)
        n = 0
        for w in sorted(glob.glob(os.path.join(data, "**", "*song*.wav"), recursive=True)):
            b = os.path.splitext(os.path.basename(w))[0]
            shutil.copy(w, os.path.join(aud, b + ".wav"))
            txt = [t for t in glob.glob(os.path.join(os.path.dirname(w), "*.txt")) if "song" in os.path.basename(t) or len(glob.glob(os.path.join(os.path.dirname(w), "*.txt"))) == 1]
            if txt:
                try:
                    shutil.copy(txt[0], os.path.join(aud, b + ".txt"))
                except Exception:
                    pass
            n += 1
        log("เตรียมข้อมูลเสียงร้อง %d เพลง" % n)
        if n < 5:
            raise RuntimeError("หาไฟล์เสียงร้องใน PJS ไม่เจอ (%d)" % n)
        ten, outl = os.path.join(work_d, "tensors"), os.path.join(work_d, "lora")
        sh('cd "%s" && "%s" train.py fixed --checkpoint-dir "%s" --model-variant turbo --preprocess --audio-dir "%s" --tensor-output "%s"' % (repo, py, ck, aud, ten))
        log("เริ่มเทรน LoRA เสียงร้องญี่ปุ่น (%d รอบ)" % int(opt.get("epochs") or 60))
        sh('cd "%s" && timeout 10800 "%s" train.py fixed --checkpoint-dir "%s" --model-variant turbo --dataset-dir "%s" --output-dir "%s" --epochs %d --rank %d' % (repo, py, ck, ten, outl, int(opt.get("epochs") or 60), int(opt.get("rank") or 32)), check=False)
        cands = sorted(glob.glob(os.path.join(outl, "**", "*.safetensors"), recursive=True), key=os.path.getmtime)
        if cands:
            lora = cands[-1]
            log("เทรน LoRA เสร็จ: %s (%.0f MB)" % (os.path.basename(lora), os.path.getsize(lora) / 1e6))
            try:  # เก็บไฟล์ LoRA ขึ้น Supabase (ท่อนละ 20 MB)
                raw = open(lora, "rb").read()
                parts = [raw[i:i + 20000000] for i in range(0, len(raw), 20000000)]
                for k, part in enumerate(parts):
                    call("/k/sblob/%s?name=songlora&part=%d&of=%d" % (j["id"], k, len(parts)), raw=part, timeout=600)
            except Exception as e:
                log("เก็บไฟล์ LoRA เพลงไม่สำเร็จ: %s" % str(e)[:160])
        else:
            log("เทรน LoRA ไม่สำเร็จ จะสร้างเพลงแบบเดิมให้ก่อน")
    cfgp = os.path.join(work_d, "cfg.json")
    gp = os.path.join(work_d, "gen.py")
    open(gp, "w").write(GEN_PY)
    json.dump({"repo": repo, "out": os.path.join(work_d, "out"), "songs": opt.get("songs") or [], "lora": lora, "trigger": trig}, open(cfgp, "w"), ensure_ascii=False)
    log("กำลังสร้างเพลง %d เพลง%s" % (len(opt.get("songs") or []), " (เทียบ ก่อน/หลังเทรน)" if lora else ""))
    sh('cd "%s" && "%s" "%s" "%s"' % (repo, py, gp, cfgp))
    res = json.load(open(os.path.join(work_d, "out", "result.json")))
    for r in res:
        m4a = os.path.join(work_d, "%s_%d.m4a" % (r["tag"], r["i"]))
        sh('"%s" -y -loglevel error -i "%s" -af "loudnorm=I=-14:TP=-1.5" -c:a aac -b:a 64k -ac 2 "%s"' % (ffmpeg_bin(), r["file"], m4a))
        call("/k/song/%s?i=%d&tag=%s" % (j["id"], r["i"], r["tag"]), raw=open(m4a, "rb").read(), timeout=300)
    log("ส่งเพลงแล้ว %d ไฟล์" % len(res))
    fin = os.path.join(work_d, "done.txt")
    open(fin, "w").write("ok %d" % len(res))
    return fin, int(time.time() - t0), 0, 0


def work(job, port):
    if job.get("kind") == "song":
        return song_job(job, port)
    if job.get("kind") == "lora":
        return train_lora(job, port)
    if job.get("kind") == "tts":
        return tts_job(job)
    if job.get("kind") == "epcat":
        log("กำลังรวมทั้งตอน %s" % job.get("project"))
        return epcat(job)
    if job.get("kind") == "concat":
        log("กำลังรวมคลิป %s → %s" % (job.get("project"), job.get("shot")))
        return concat(job)
    if job.get("kind") == "img":
        return gen_image(job, port)
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


def claim_path():
    return "/k/claim?v=15" + ("&nolora=1" if M.get("nolora") else "") + ("&cpu=1" if CPU else "")


def claim_wait(stat):
    # การ์ดว่าง: รองานใหม่ระหว่างที่การ์ดอื่นยังทำงานอยู่ (สูงสุด 15 นาที) แทนที่จะปิดทิ้ง ให้ใช้การ์ดคู่ได้เต็ม
    job = J(claim_path()).get("job")
    waited = 0
    while not job and stat.get("busy", 0) > 0 and time.time() - T0 < MAXH * 3600:
        time.sleep(45)
        waited += 45
        job = J(claim_path()).get("job")
    return job


def worker(port, first, stat):
    job = first if first else (claim_wait(stat) if port else None)
    healed = None
    while job:
        stat["busy"] = stat.get("busy", 0) + 1
        try:
            mp4, sec, W, H = work(job, port)
            data = open(mp4, "rb").read()
            call("/k/done/%s?sec=%d&w=%d&h=%d" % (job["id"], sec, W, H), raw=data, timeout=600)
            os.remove(mp4)
            stat["done"] += 1
            if job.get("kind") != "img":
                log("เสร็จช็อต %s ใน %d นาที (%d KB)" % (job.get("shot"), sec / 60, len(data) / 1024))
            elif stat["done"] % 20 == 0:
                log("เจนภาพบน Kaggle แล้ว %d ภาพในรอบนี้ (ล่าสุด %d วินาที)" % (stat["done"], sec))
        except Exception as e:
            log("ช็อต %s พัง: %s" % (job.get("shot"), str(e)[:400]))
            if job.get("kind") == "lora" and not M.get("kohya"):
                # ติดตั้งตัวเทรนไม่ผ่าน: ลองซ้ำในเครื่องเดิมไม่ช่วย → คืนงานเข้าคิว และเครื่องนี้ไม่รับงานเทรนอีกในรอบนี้
                M["nolora"] = True
                log("ติดตั้งตัวเทรน LoRA ไม่ผ่านในรอบนี้ จะลองใหม่ตอนเครื่องเริ่มรอบถัดไป (เครื่องนี้ทำงานอื่นต่อ)")
            if port and healed != job["id"] and job.get("kind") != "lora":  # ซ่อมแล้วลองใหม่ในเครื่องก่อน 1 ครั้ง
                healed = job["id"]
                heal(port, str(e))
                stat["busy"] -= 1
                continue
            try:
                J("/k/fail/%s" % job["id"], {"error": (str(e)[-500:] if job.get("kind") == "lora" else str(e)[:500])})
            except Exception:
                pass
            try:  # ComfyUI การ์ดนี้ตายแล้ว → หยุดเฉพาะการ์ดนี้ อีกการ์ดทำต่อ
                urllib.request.urlopen("http://127.0.0.1:%d/system_stats" % port, timeout=10).read()
            except Exception:
                log("การ์ด %d หยุดทำงาน การ์ดที่เหลือทำต่อ" % (port - 8187))
                stat["busy"] -= 1
                return
        stat["busy"] = stat.get("busy", 1) - 1
        if time.time() - T0 > MAXH * 3600:
            log("ใกล้หมดเวลารอบนี้ จะเริ่มรอบใหม่ให้เอง")
            return
        job = claim_wait(stat) if port else J(claim_path()).get("job")


def main():
    job = J(claim_path()).get("job")
    if not job:
        log("ไม่มีงานวิดีโอในคิว ปิดเครื่องเพื่อประหยัดโควตา")
        return
    stat = {"done": 0}
    if CPU:  # เครื่อง CPU: รับงานรวมตอนไปเรื่อยๆ จนคิวว่าง
        worker(0, job, stat)
        log("เครื่อง CPU จบรอบ รวมเสร็จ %d งาน" % stat["done"])
        return
    if job.get("kind") in ("concat", "epcat"):  # งานรวมคลิปไม่ต้องใช้ GPU
        worker(0, job, stat)
        job = J(claim_path()).get("job")
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
        th.append(threading.Thread(target=lambda p=port: worker(p, None, stat)))
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
  hairF: [['short wavy bob', 'ผมบ็อบหยักศก'], ['long straight hair with blunt bangs', 'ผมยาวตรงหน้าม้าตัดตรง'], ['high ponytail', 'ผมหางม้าสูง'], ['low twin braids', 'ผมเปียคู่ต่ำ'], ['messy bun with loose strands', 'ผมมวยหลวมๆ'], ['long layered hair with wispy bangs', 'ผมยาวไล่เลเยอร์หน้าม้าบาง'], ['short pixie cut', 'ผมสั้นพิกซี่'], ['half-up hair with a ribbon', 'ผมมัดครึ่งหัวผูกโบว์'], ['long twin tails', 'ผมทวินเทลยาว'], ['side ponytail over the shoulder', 'ผมหางม้าข้างพาดไหล่'], ['hime cut with long side locks', 'ผมทรงฮิเมะ'], ['curly shoulder-length hair', 'ผมหยิกประบ่า'], ['long wavy hair with a side braid', 'ผมยาวลอนมีเปียข้าง'], ['asymmetrical bob with an undercolor', 'ผมบ็อบเฉียงไฮไลต์สีด้านใน']],
  hairM: [['messy short hair with bangs', 'ผมสั้นยุ่งมีหน้าม้า'], ['spiky hair', 'ผมชี้ฟู'], ['slicked back hair', 'ผมเสยหลัง'], ['wolf cut', 'ผมทรงวูล์ฟคัต'], ['short undercut', 'ผมอันเดอร์คัต'], ['shoulder-length tied hair', 'ผมยาวประบ่ามัดจุก'], ['curly textured hair', 'ผมหยิกเท็กซ์เจอร์'], ['long loose hair with a center part', 'ผมยาวสยายแสกกลาง'], ['buzz-cut sides with a fringe top', 'ผมข้างสั้นเกรียนด้านบนมีหน้าม้า'], ['messy man bun', 'ผมมวยยุ่งๆ']],
  hc: [['black', 'ดำ'], ['dark brown', 'น้ำตาลเข้ม'], ['chestnut', 'น้ำตาลเกาลัด'], ['ash blonde', 'บลอนด์หม่น'], ['pastel pink', 'ชมพูพาสเทล'], ['navy blue', 'น้ำเงินกรมท่า'], ['white', 'ขาว'], ['copper red', 'แดงทองแดง'], ['lavender', 'ม่วงลาเวนเดอร์']],
  eye: [['amber', 'อำพัน'], ['emerald green', 'เขียวมรกต'], ['sky blue', 'ฟ้า'], ['violet', 'ม่วง'], ['dark brown', 'น้ำตาลเข้ม'], ['crimson', 'แดง'], ['gray', 'เทา']],
  outF: [['oversized hoodie and pleated skirt', 'ฮู้ดดี้ตัวใหญ่กับกระโปรงพลีท'], ['denim jacket over a sundress', 'แจ็กเก็ตยีนส์ทับเดรส'], ['office blouse and slacks', 'เสื้อเชิ้ตทำงานกับกางเกงสแล็ก'], ['cafe apron uniform', 'ชุดพนักงานร้านกาแฟมีผ้ากันเปื้อน'], ['sporty track jacket and shorts', 'แจ็กเก็ตกีฬากับกางเกงขาสั้น'], ['long coat and scarf', 'โค้ทยาวกับผ้าพันคอ'], ['cardigan and long skirt', 'คาร์ดิแกนกับกระโปรงยาว'], ['leather jacket and jeans', 'แจ็กเก็ตหนังกับยีนส์']],
  outM: [['white shirt and slacks', 'เสื้อเชิ้ตขาวกับกางเกงสแล็ก'], ['hoodie and cargo pants', 'ฮู้ดดี้กับกางเกงคาร์โก'], ['denim jacket and t-shirt', 'แจ็กเก็ตยีนส์กับเสื้อยืด'], ['chef jacket', 'ชุดเชฟ'], ['racing jacket', 'แจ็กเก็ตแข่งรถ'], ['knit sweater and coat', 'สเวตเตอร์ไหมพรมกับโค้ท']],
  vibe: [['cheerful energetic', 'ร่าเริง พลังเยอะ', 'big bright smile'], ['cool and aloof', 'นิ่ง เท่ เย็นชา', 'calm cool expression'], ['shy and gentle', 'ขี้อาย อ่อนโยน', 'shy soft smile'], ['clumsy and funny', 'โก๊ะ ตลก', 'goofy surprised expression'], ['confident leader', 'มั่นใจ เป็นผู้นำ', 'confident smirk'], ['mysterious', 'ลึกลับ', 'mysterious half smile'], ['sleepy and lazy', 'ขี้เกียจ ง่วงตลอด', 'sleepy half-lidded eyes']],
  acc: [['', ''], ['', ''], ['round glasses', 'แว่นกลม'], ['hair clip', 'กิ๊บติดผม'], ['headphones around the neck', 'หูฟังคล้องคอ'], ['small earrings', 'ต่างหูเล็ก'], ['choker', 'โชกเกอร์'], ['beanie', 'หมวกไหมพรม']],
  // ---- มิติออดิชัน: หุ่น / ปาก / ออร่า / แนวหน้าตา (ทุกตัวเป็นผู้ใหญ่ 19+) ----
  bodyF: [['curvy hourglass figure with a full bust and slim waist', 'หุ่นนาฬิกาทราย อกอวบ เอวคอด'], ['slim elegant model figure, long legs, modest bust', 'หุ่นเพรียวสูงแบบนางแบบ ขายาว'], ['petite cute figure with a soft small frame', 'ตัวเล็กน่ารัก โครงเล็ก'], ['athletic toned figure with defined abs and a firm bust', 'หุ่นนักกีฬา กล้ามท้องเบาๆ'], ['soft plump figure with a generous bust and gentle curves', 'หุ่นอวบนุ่ม อกใหญ่ สัดส่วนโค้งมน'], ['tall strong figure with broad shoulders and long legs', 'สูงแข็งแรง ไหล่กว้าง ขายาว'], ['balanced average figure with a natural bust', 'หุ่นสมส่วนธรรมชาติ']],
  bodyM: [['muscular bodybuilder physique with broad chest and thick arms', 'กล้ามใหญ่ อกกว้าง แขนหนา'], ['lean athletic swimmer build with defined abs', 'หุ่นนักว่ายน้ำ ซิกแพ็ก'], ['tall slim elegant build with long limbs', 'สูงเพรียวสง่า แขนขายาว'], ['broad-shouldered sturdy build', 'ไหล่กว้าง ตัวแน่น'], ['wiry runner build, lean muscle', 'หุ่นนักวิ่ง กล้ามเรียว'], ['soft cuddly build with a gentle frame', 'หุ่นนุ่มนิ่ม ท่าทางอบอุ่น'], ['bulky strong build with thick thighs and shoulders', 'หุ่นบึกบึน ต้นขา ไหล่หนา']],
  mouth: [['small gentle smile', 'ยิ้มเล็กอ่อนโยน'], ['soft pout', 'ปากเม้มงอนเบาๆ'], ['sharp confident smirk', 'ยิ้มมุมปากมั่นใจ'], ['thin neutral line', 'ปากเส้นตรงนิ่ง'], ['lips slightly parted, dazed', 'ปากเผยอเล็กน้อย เหม่อ'], ['bright open-mouth grin with small fangs', 'ยิ้มกว้างมีเขี้ยวเล็ก'], ['shy wobbly smile', 'ยิ้มเขินๆ สั่นนิดๆ'], ['tight clenched frown', 'ปากเม้มแน่น หน้าตึง']],
  aura: [['warm glowing sparkles around the character', 'ออร่าอบอุ่น ประกายระยิบ'], ['calm cool pale-blue aura', 'ออร่าเย็นสงบ โทนฟ้า'], ['dangerous dark aura with sharp shadows', 'ออร่าอันตราย เงาคม'], ['dreamy pastel haze and soft bloom', 'ออร่าฝันๆ หมอกพาสเทล'], ['elegant noble aura with soft rim light', 'ออร่าสง่าสูงศักดิ์ แสงขอบนุ่ม'], ['mysterious faint purple mist', 'ออร่าลึกลับ หมอกม่วงจางๆ'], ['sunny cheerful golden glow', 'ออร่าสดใส เรืองทอง'], ['quiet lonely moody atmosphere', 'ออร่าเงียบเหงา มีอารมณ์']],
  face: [['sweet', 'หวาน', 'sweet round soft face, big sparkling eyes, rosy cheeks'], ['sharp', 'เข้ม', 'sharp defined face, narrow intense eyes, strong brows'], ['gentle', 'อ่อนโยน', 'gentle kind face, soft droopy eyes, relaxed brows'], ['nerd', 'เด็กเนิร์ด', 'bookish face with glasses, slightly awkward earnest look, light freckles'], ['fierce', 'ดุ', 'fierce stern face, glaring upturned eyes, furrowed brows'], ['deadpan', 'หน้านิ่ง', 'deadpan expressionless face, flat half-lidded eyes'], ['dazed', 'หน้ามึน', 'blank dazed face, vacant spaced-out eyes, slightly open mouth'], ['elegant', 'สง่า เรียบหรู', 'mature elegant face, long lashes, composed refined gaze'], ['playful', 'ซนกวนๆ', 'mischievous face, teasing gaze, one raised brow'], ['tsundere', 'ปากแข็งใจอ่อน', 'flustered pouting face, blushing, eyes looking away']],
  // ---- ช่วงอายุ 10–70 ปี (ไม่มี 18 เพื่อแยกวัยเด็ก/วัยรุ่นกับผู้ใหญ่ให้ชัด) น้ำหนักการสุ่ม ----
  ageG: [['child', 10, 12, 0.9, 'เด็ก'], ['teen', 13, 17, 1.2, 'วัยรุ่น'], ['young', 19, 22, 1.6, 'วัยรุ่นตอนปลาย/นักศึกษา'], ['adult', 25, 33, 2, 'วัยทำงาน'], ['mid', 35, 45, 1.4, 'วัยกลางคน'], ['senior', 46, 55, 1, 'ผู้ใหญ่อาวุโส'], ['elder', 56, 70, 1, 'ผู้สูงวัย']],
  bodyK: [['small slim childlike frame', 'ตัวเล็กผอมบางตามวัย'], ['sturdy active kid build', 'ตัวแน่น ซนคล่องแคล่ว'], ['lanky growing frame with long limbs', 'โตเร็ว แขนขายาวเก้งก้าง'], ['soft round cheeks and a chubby cute build', 'แก้มกลม ตัวนุ่มน่ารัก'], ['average healthy build for the age', 'สมส่วนตามวัย']],
  bodyMid: [['mature balanced figure', 'หุ่นสมส่วนแบบผู้ใหญ่'], ['broad sturdy mature build', 'ตัวหนา แข็งแรง'], ['slim refined mature build', 'ผอมเพรียวดูดี'], ['soft comfortable build with a gentle belly', 'หุ่นนุ่มมีพุงนิดๆ'], ['tall lean mature build', 'สูงเพรียวแบบผู้ใหญ่'], ['fit toned mature build', 'หุ่นฟิตกระชับ']],
  bodyE: [['slim elderly build with a slight stoop', 'ผอมเพรียว หลังค่อมเล็กน้อย'], ['sturdy elderly build, still strong', 'ตัวแน่น แข็งแรงตามวัย'], ['plump kindly elderly build', 'อวบอบอุ่นใจดี'], ['tall lean elderly build, upright posture', 'สูงเพรียว หลังตรง'], ['small frail-looking elderly build', 'ตัวเล็กบอบบาง']],
  hcE: [['silver gray', 'เทาเงิน'], ['white', 'ขาว'], ['salt-and-pepper gray', 'หงอกแซมดำ'], ['gray', 'เทา']],
  nameF: ['มิว', 'ใบเตย', 'พิม', 'น้ำหวาน', 'ฟ้าใส', 'ข้าวหอม', 'ปลายฝน', 'มายด์', 'เอิง', 'ญาญ่า', 'แพรวา', 'ไอซ์', 'จูน', 'ลูกพีช', 'เมษา'],
  nameM: ['ภูมิ', 'ต้นกล้า', 'ไนท์', 'เจ', 'ซัน', 'ธาม', 'คิน', 'ปั้น', 'ไท', 'เรน'],
};
const pick = (a, r) => a[Math.floor(r() * a.length)];
function rng(seed) { let x = seed >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }
function castHeight(f, a, r) { // ส่วนสูง (ซม.) เฉลี่ยตามวัยและเพศ แล้วสุ่มเบี่ยง ±6
  const M = [138, 144, 150, 156, 162, 167, 170, 172], F = [138, 145, 152, 157, 159, 160, 161, 161]; // อายุ 10..17
  let base;
  if (a <= 17) base = (f ? F : M)[Math.max(0, a - 10)] - 0; // 10→index 0
  else if (a <= 45) base = f ? 161 : 173; else if (a <= 55) base = f ? 160 : 172; else if (a <= 65) base = f ? 158 : 170; else base = f ? 156 : 168;
  const h = Math.round(base + (r() * 12 - 6)), d = h - base;
  return [h, d >= 4 ? 'สูงกว่าเพื่อนวัยเดียวกัน' : d <= -4 ? 'เตี้ยกว่าเพื่อนวัยเดียวกัน' : 'ส่วนสูงปกติตามวัย', d >= 4 ? 'taller than most people of the same age' : d <= -4 ? 'shorter than most people of the same age' : 'average height for the age'];
}
const MINOR_BAN = /ออกเดต|ไอดอล|โกธิก|ไซเบอร์พังก์|คาเฟ่/;
function castMake(r, style) {
  const tot = CAST.g.reduce((a, b) => a + b[2], 0); let t = r() * tot, g = CAST.g[0];
  for (const x of CAST.g) { if ((t -= x[2]) < 0) { g = x; break; } }
  const f = g[0] === 'f';
  // เลือกช่วงวัยตามน้ำหนัก แล้วสุ่มอายุจริงในช่วง
  const gt = CAST.ageG.reduce((a, x) => a + x[3], 0); let tt = r() * gt, grp = CAST.ageG[0];
  for (const x of CAST.ageG) { if ((tt -= x[3]) < 0) { grp = x; break; } }
  const ageN = grp[1] + Math.floor(r() * (grp[2] - grp[1] + 1)), minor = ageN < 18, elder = ageN >= 56;
  const hc = elder ? pick(CAST.hcE, r) : pick(CAST.hc, r), eye = pick(CAST.eye, r),
    vibe = pick(CAST.vibe, r), acc = pick(CAST.acc, r), name = pick(f ? CAST.nameF : CAST.nameM, r),
    body = minor ? pick(CAST.bodyK, r) : elder ? pick(CAST.bodyE, r) : ageN >= 35 ? pick(CAST.bodyMid, r) : pick(f ? CAST.bodyF : CAST.bodyM, r),
    mouth = pick(CAST.mouth, r), aura = pick(CAST.aura, r), face = pick(CAST.face, r), ht = castHeight(f, ageN, r);
  const U = castMake.used || (castMake.used = { cos: new Set(), look: new Set() });
  let hair = pick(f ? CAST.hairF : CAST.hairM, r), hcc = hc;
  for (let k = 0; k < 20 && U.look.has(hair[0] + '|' + hcc[0]); k++) { hair = pick(f ? CAST.hairF : CAST.hairM, r); hcc = elder ? pick(CAST.hcE, r) : pick(CAST.hc, r); }
  U.look.add(hair[0] + '|' + hcc[0]);
  let arch = pick(IDEAS.char, r);
  for (let k = 0; k < 15 && ageN > 22 && /นักเรียน|เด็ก/.test(arch.n); k++) arch = pick(IDEAS.char, r); // บทนักเรียนเฉพาะอายุ ≤ 22
  // ชุดไม่ซ้ำ + เหมาะวัย: เด็ก/วัยรุ่นตัดชุดออกเดต/ไอดอล/โกธิก/ไซเบอร์พังก์/คาเฟ่ · ชุดนักเรียนเฉพาะอายุ ≤ 22
  const okCos = c => (!minor || !MINOR_BAN.test(c.n)) && (ageN <= 22 || !/นักเรียน/.test(c.n));
  let pool = IDEAS.costume.filter(c => okCos(c) && !U.cos.has(c.id));
  if (!pool.length) { for (const c of IDEAS.costume) U.cos.delete(c.id); pool = IDEAS.costume.filter(okCos); }
  const cos = pick(pool, r); U.cos.add(cos.id);
  const out = [cos.e, `${cos.n} (${cos.id})`];
  const who = minor ? (ageN <= 12 ? (f ? 'young girl' : 'young boy') : (f ? 'teenage girl' : 'teenage boy')) : elder ? (f ? 'elderly woman' : 'elderly man') : (f ? 'woman' : 'man');
  const real = style === 'real';
  const ageTxt = elder ? `${ageN} years old, elderly, gentle wrinkles and laugh lines` : ageN >= 46 ? `${ageN} years old, mature, subtle age lines` : ageN >= 35 ? `${ageN} years old, mature adult` : minor ? `${ageN} years old, age-appropriate childlike proportions` : `${ageN} years old adult`;
  const safe = minor ? 'wholesome, age-appropriate, modest everyday clothing, fully covered' : 'fully clothed, tasteful';
  const prompt = `${real ? 'photorealistic full body photo' : 'full body anime character design'} of an original ${who} as a ${arch.e}, ${ageTxt}, about ${ht[0]} cm tall, ${ht[2]}, ${hcc[0]} ${hair[0]}, ${eye[0]} eyes, ${face[2]}, ${mouth[0]}, ${vibe[2]}, ${vibe[0]} personality, ${body[0]}, ${aura[0]}, wearing ${out[0]}${acc[0] ? ', ' + acc[0] : ''}, ${safe}, standing in a relaxed natural pose, front view, plain light gray studio background, ${real ? 'soft studio lighting, 50mm photo' : 'clean lineart, soft cel shading, high quality anime illustration'}, vertical 9:16`;
  const desc = `${arch.id} ${arch.n} · ${g[1]} ${ageN} ปี (${grp[4]}) · สูง ${ht[0]} ซม. ${ht[1]} · หุ่น: ${body[1]} · หน้า: ${face[1]} · ผม${hcc[1]} ${hair[1]} · ตา${eye[1]} · ปาก: ${mouth[1]} · ออร่า: ${aura[1]} · ${out[1]}${acc[1] ? ' · ' + acc[1] : ''} · นิสัย${vibe[1]}`;
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
    return { name: sc.n, desc: `#${sc.i} ${sc.c} · ${sc.m} · เหมาะกับ ${sc.g}`, prompt: `${sc.e}, an empty deserted unpopulated location, scenery only, wide environment background plate, no characters, nothing alive in the frame, detailed anime background art, ${tail.split('[[STYLE]]').join('[[STYLE_ENV]]')}` }; }
  const it = pick(r() < 0.5 ? IDEAS.prop : IDEAS.element, r);
  return { name: it.n, desc: `${it.id} · ${it.d} · เหมาะกับ${it.fit}`, prompt: `a ${it.e}, single object design, centered, product design sheet on a plain soft background, still life of the object only, ${tail}` };
}

// ---------- คลังเสียง: เพลงบรรเลง (ACE-Step) + เสียงประกอบ (Stable Audio Open) ----------
async function audioEnqueue(env, items) {
  const st = items.map(it => env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,kind,opt) VALUES (?,?,?,?,'','',0,'queued',0,?,'audio',?)")
    .bind(it.project, '', '1', it.prompt.slice(0, 1500), Date.now(), JSON.stringify({ type: it.type, sec: it.sec, vocal: it.vocal ? 1 : 0 })));
  if (st.length) await env.DB.batch(st);
}
// ---------- คลังอัตโนมัติรายวัน: ทุกวันหลัง 07:00 สร้างของใหม่หมวดละ 1 ชิ้น (ยกเว้นตัวละคร) ครบรายการแล้ววนรอบใหม่ ----------
function manualPrompt(kind, desc, chars) {
  const base = 'Art style: [[STYLE]], high quality, no text, no watermark. All characters are ORIGINAL adults, not based on any existing anime, manga or game character.';
  if (kind === 'char') return `Create ONE character model sheet image of an original adult anime character. Show on a plain light background: full-body front view, side view and back view, plus four face close-ups (neutral, smiling, angry, surprised). Keep the design identical in every view. Character: ${desc}. ${base}`;
  if (kind === 'cover') return `Create a vertical key-visual / cover illustration for an original anime series, dramatic composition, cinematic lighting, space left clear for a title (but draw NO text). Subject: ${desc}. ${base}`;
  if (kind === 'key') return `Create ONE widescreen 16:9 anime key-frame illustration, cinematic composition and lighting. Scene: ${desc}.${chars ? ' Character design to follow: ' + String(chars).slice(0, 400) + '.' : ''} If I attach a character sheet, keep the faces and outfits exactly the same as the sheet. ${base}`;
  return `Create ONE anime illustration. Subject: ${desc}. ${base}`;
}
const LIB_TAIL = '[[STYLE]], high quality';
const LIB_OBJ = '[[STYLE_OBJ]], high quality', LIB_ENV = '[[STYLE_ENV]], high quality';
const LIBD = [
  ['ฉาก', () => SCENES, it => `${it.e}, an empty deserted unpopulated location, scenery only, wide environment background plate, no characters, nothing alive in the frame, detailed anime background art, cinematic lighting, ${LIB_TAIL.split('[[STYLE]]').join('[[STYLE_ENV]]')}`],
  ['สัตว์และอสูร', () => IDEAS.creature, it => `a ${it.e}, full body creature design, front view, centered on a plain soft background, ${LIB_OBJ}`],
  ['ของประกอบ', () => IDEAS.prop, it => `a ${it.e}, a single isolated object, centered, product design sheet on a plain soft background, still life of the object only, ${LIB_OBJ}`],
  ['ชุด', () => IDEAS.costume, it => `${it.e} outfit displayed on a headless tailor's dress form, fashion design sheet, front view and back view side by side, plain soft background, ${LIB_OBJ}`],
  ['องค์ประกอบฉาก', () => IDEAS.element, it => `a ${it.e}, environment element design, isolated on a plain soft background, ${LIB_OBJ}`],
  ['อาวุธ', () => WORLD.weapon, it => `a ${it.e}, weapon design, single object, centered, plain soft background, ${LIB_OBJ}`],
  ['พลังอาคม', () => WORLD.power, it => `${it.e}, magic power visual effect, anime spell, dramatic lighting, dark background, abstract energy only, ${LIB_ENV}`],
  ['ของวิเศษ', () => WORLD.artifact, it => `a ${it.e}, magical item design, single object, centered, plain soft background, ${LIB_OBJ}`],
  ['โลกและจักรวาล', () => WORLD.realm, it => `${it.e}, epic anime world landscape, cinematic lighting, detailed background art, ${LIB_ENV}`],
];
// สเต็ปภาพคลัง: ฉาก/เอฟเฟกต์/พลังงาน 4 สเต็ป (พอแล้วสำหรับโมเดลนี้) ส่วนงานออกแบบที่ต้องละเอียดกว่า (สัตว์ ชุด อาวุธ ของ) 6 สเต็ป
const LIB_STEP4 = new Set(['ฉาก', 'องค์ประกอบฉาก', 'พลังอาคม', 'โลกและจักรวาล', 'เอฟเฟกต์']);
function libSteps(cat) { return 4; } // ผู้ใช้เลือก: คุณภาพ 4 พอสำหรับทุกหมวด
function libName(it) { return (typeof it.i === 'number' ? String(it.i).padStart(4, '0') + ' ' : '') + String(it.n).replace(' — ', ' · ').replace(/·/g, '-').replace(' - ', ' · '); }
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
  { const old = (await env.DB.prepare("SELECT descr FROM casting WHERE cat='char' ORDER BY id DESC LIMIT 400").all()).results.map(x => x.descr || '');
    castMake.used = { cos: new Set(), look: new Set() };
    for (const d of old) { const m = d.match(/COS-\d+/); if (m) castMake.used.cos.add(m[0]); }
    if (castMake.used.cos.size >= IDEAS.costume.length) castMake.used.cos.clear(); }
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
  if (p === '/api/vcastmanual') { // งานมือ: รายการพรอมต์สำหรับ GPT/Gemini (ไม่มีกำหนดเวลา ไม่เข้าคิวอัตโนมัติ)
    const b = body || {}, act = b.act || 'list';
    if (act === 'add') {
      const kind = ['char', 'key', 'cover', 'other'].includes(b.kind) ? b.kind : 'other', title = String(b.title || '').trim().slice(0, 80), desc = String(b.desc || (b.quick ? b.title : '') || '').trim().slice(0, 900);
      if (!title || !desc) return json({ error: 'ใส่ชื่อและคำอธิบายก่อน' }, 400);
      const dup = await env.DB.prepare("SELECT id FROM manual_tasks WHERE title=? AND status!='skip'").bind(title).first();
      if (dup && !b.quick) return json({ ok: true, dup: true });
      if (dup) return json({ ok: true, id: dup.id });
      const s = await getSettings(env);
      await env.DB.prepare('INSERT INTO manual_tasks (kind,title,descr,prompt,pri,status,created) VALUES (?,?,?,?,?,?,?)')
        .bind(kind, title, desc, manualPrompt(kind, desc, s.character || ''), { char: 10, key: 20, cover: 30, other: 40 }[kind], 'todo', Date.now()).run()
        .then(x => x);
      const nid = await env.DB.prepare('SELECT id FROM manual_tasks WHERE title=? ORDER BY id DESC').bind(title).first();
      return json({ ok: true, id: nid && nid.id });
    }
    if (act === 'set') { await env.DB.prepare('UPDATE manual_tasks SET status=? WHERE id=?').bind(['todo', 'skip', 'done'].includes(b.status) ? b.status : 'todo', +b.id).run(); return json({ ok: true }); }
    if (act === 'del') { await env.DB.prepare('DELETE FROM manual_tasks WHERE id=?').bind(+b.id).run(); return json({ ok: true }); }
    const r = await env.DB.prepare("SELECT id,kind,title,descr,prompt,pri,status,image_id,created FROM manual_tasks ORDER BY CASE status WHEN 'todo' THEN 0 WHEN 'skip' THEN 1 ELSE 2 END, pri, id LIMIT 300").all();
    { const s = await getSettings(env); for (const t of r.results) t.prompt = withStyle(t.prompt, s); }
    return json({ tasks: r.results });
  }
  if (p === '/api/vcastprofile') { // ข้อมูลตัวละครที่ผู้ใช้เลือกจากตัวเลือก (Claude อ่านไปเขียนเรื่อง/พรอมต์)
    const b = body || {};
    if (b.act === 'set') {
      const name = String(b.name || '').trim().slice(0, 60); if (!name) return json({ error: 'ไม่มีชื่อ' }, 400);
      const d = JSON.stringify(b.data || {}).slice(0, 3000);
      await env.DB.prepare('INSERT INTO char_profiles (name,data,updated) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET data=excluded.data, updated=excluded.updated').bind(name, d, Date.now()).run();
      return json({ ok: true });
    }
    const r = await env.DB.prepare('SELECT name,data FROM char_profiles').all(), out = {};
    for (const x of r.results) { try { out[x.name] = JSON.parse(x.data); } catch (e) { } }
    return json({ profiles: out });
  }
  if (p === '/api/vcastmanga') { // มังงะรายตอน: สร้างภารกิจภาพรายช่อง (ครั้งเดียว) แล้วส่งช่อง+สถานะภาพกลับ
    const ep = MANGA[String((body || {}).ep || 1)];
    if (!ep) return json({ error: 'ไม่มีตอนนี้' }, 404);
    const pr = {}; for (const x of (await env.DB.prepare('SELECT name,data FROM char_profiles').all()).results) { try { pr[x.name] = JSON.parse(x.data); } catch (e) { } }
    const RT = { w: 'widescreen landscape 16:9', t: 'tall vertical portrait 3:4', s: 'square 1:1' };
    const tt = n => `${ep.tag} · ช่อง ${String(n).padStart(2, '0')}`;
    const sel = () => env.DB.prepare('SELECT id,title,status,image_id,prompt FROM manual_tasks WHERE title LIKE ?').bind(ep.tag + ' · ช่อง%').all();
    let have = new Map((await sel()).results.map(r => [r.title, r]));
    const ins = [];
    ep.panels.forEach((pn, i) => {
      const t = tt(i + 1);
      const cl = pn.chars.map(n => { const q = pr[n] || {}; return `${n} (${q.gender === 'หญิง' ? 'woman' : q.gender === 'ชาย' ? 'man' : 'person'}${q.age ? ', age ' + String(q.age).split(' ')[0] : ', adult'}${ep.outfit[n] ? ', wearing: ' + ep.outfit[n] : ''})`; });
      const prompt = `Create ONE manga/anime panel illustration, ${RT[pn.s] || RT.w} composition. Scene: ${pn.shot}${cl.length ? ' Characters in this panel: ' + cl.join('; ') + '. Attach the character sheet of each of them and keep their faces, hairstyles, eye and hair colours exactly the same as the sheets.' : ''} Cinematic lighting, art style: [[STYLE]]. Draw NO speech bubbles, NO text, NO watermark. All characters are original adults (university-age or older). Background people wear casual university clothes, NOT school uniforms.`.slice(0, 1800);
      const ex = have.get(t);
      if (ex) { if (ex.status === 'todo' && ex.prompt !== prompt) ins.push(env.DB.prepare('UPDATE manual_tasks SET prompt=? WHERE id=?').bind(prompt, ex.id)); return; }
      ins.push(env.DB.prepare('INSERT INTO manual_tasks (kind,title,descr,prompt,pri,status,created) VALUES (?,?,?,?,?,?,?)').bind('key', t, pn.shot.slice(0, 300), prompt, 100 + i, 'todo', Date.now()));
    });
    if (ins.length) { await env.DB.batch(ins); have = new Map((await sel()).results.map(r => [r.title, r])); }
    const s9 = await getSettings(env);
    return json({ title: ep.title, panels: ep.panels.map((pn, i) => { const t = have.get(tt(i + 1)) || {}; if (t.prompt) t.prompt = withStyle(t.prompt, s9); return { n: i + 1, s: pn.s, cap: pn.cap, dlg: pn.dlg, chars: pn.chars, task_id: t.id || 0, status: t.status || 'todo', image_id: t.image_id || 0, prompt: t.prompt || '' }; }) });
  }
  if (p === '/api/vcastoutfitup') { // อัปภาพชุดของตัวละครเข้าแฟ้ม (ติดดาว)
    const b = body || {}, name = String(b.name || '').trim().slice(0, 60), outfit = String(b.outfit || '').trim().slice(0, 60);
    const data = String(b.data || '').replace(/^data:[^,]*,/, '');
    if (!name || !outfit) return json({ error: 'ไม่มีชื่อ' }, 400);
    if (data.length < 2000) return json({ error: 'ไฟล์ภาพเล็กผิดปกติ' }, 400);
    if (data.length > 1900000) return json({ error: 'ภาพใหญ่เกินไป ลองใหม่อีกครั้ง' }, 400);
    const ins = await env.DB.prepare('INSERT INTO images (job_id,project,scene,prompt,data,starred,created) VALUES (0,?,?,?,?,1,?)').bind('แฟ้ม·' + name + '·' + outfit, 1, '', data, Date.now()).run();
    return json({ ok: true, image_id: ins.meta.last_row_id });
  }
  if (p === '/api/vcastaud') return json(await audApi(env, body || {}));
  if (p === '/api/vcaststory') { // ของที่เก็บไว้ (⭐) เอามาใช้ในเรื่อง: ฉาก อาวุธ เวท โลก ฯลฯ
    const b = body || {}, act = b.act || 'list', s = await getSettings(env);
    let stories = []; try { stories = JSON.parse(s.stories || '[]'); } catch (e) { }
    if (!stories.length) stories = ['สาเหตุที่ฉันรัก'];
    if (act === 'newstory') { const n = String(b.name || '').trim().slice(0, 60); if (n && !stories.includes(n)) { stories.push(n); await setSetting(env, 'stories', JSON.stringify(stories)); } return json({ ok: true }); }
    if (act === 'add') {
      const story = String(b.story || stories[0]).slice(0, 60), cat = String(b.cat || 'อื่นๆ').slice(0, 30), label = String(b.label || '').slice(0, 60);
      const ex = await env.DB.prepare('SELECT id FROM story_assets WHERE story=? AND image_id=?').bind(story, +b.image_id).first();
      if (!ex) await env.DB.prepare('INSERT INTO story_assets (story,cat,image_id,label,created) VALUES (?,?,?,?,?)').bind(story, cat, +b.image_id, label, Date.now()).run();
      return json({ ok: true });
    }
    if (act === 'del') { await env.DB.prepare('DELETE FROM story_assets WHERE id=?').bind(+b.id).run(); return json({ ok: true }); }
    const a = (await env.DB.prepare('SELECT * FROM story_assets ORDER BY story, cat, id').all()).results;
    return json({ stories, assets: a });
  }
  if (p === '/api/vcastflip') { // flipbook เอฟเฟกต์จาก Flux (ไม่ใช้ Kaggle): ล็อกค่าสุ่มเดียวกันทุกเฟรม แล้วให้ผู้ใช้ตรวจผ่านก่อนเข้าคลัง
    const b = body || {}, act = b.act || 'list';
    if (act === 'make') {
      const name = String(b.name || '').trim().slice(0, 40), desc = String(b.desc || '').trim().slice(0, 400), n = Math.min(8, Math.max(2, +b.n || 4));
      if (!name || !desc) return json({ error: 'ใส่ชื่อและคำอธิบาย' }, 400);
      const seed = 1 + Math.floor(Math.random() * 2147483000);
      const ins = await env.DB.prepare("INSERT INTO flipbooks (name,descr,n,seed,status,created) VALUES (?,?,?,?,'making',?)").bind(name, desc, n, seed, Date.now()).run();
      const fid = ins.meta.last_row_id, mn = (await env.DB.prepare('SELECT MIN(id) m FROM jobs').first()) || {}; let jid = Math.min(+mn.m || 1000000, 1000000) - n;
      const PH = ['', 'variation with a different shape and more jagged sharp edges', 'larger and more intense variation, dramatic impact frame', 'smaller and thinner variation with fine sharp lines', 'wide spreading variation with strong radial motion lines', 'close-up variation, dense and detailed', 'thin delicate variation with long trailing streaks', 'explosive peak-moment variation with a bright white flash core'];
      const st = [];
      for (let k = 0; k < n; k++) {
        // เอฟเฟกต์เดี่ยวบนพื้นดำสนิท → หน้าเว็บแปลงเป็น PNG โปร่งใสได้ (ความสว่าง = ความทึบ) ใช้ซ้อนบนฉากตอนตัดต่อ
        st.push(env.DB.prepare("INSERT INTO jobs (id,project,scene,prompt,status,created,steps) VALUES (?,?,?,?,'queued',?,4)").bind(jid++, `ฟลิปบุ๊ก·${fid}·${name}`, k + 1, `${desc}${PH[k % PH.length] ? ', ' + PH[k % PH.length] : ''}, isolated visual effect element only, centered with empty space around it, on a pure solid black background, no ground, no floor, no objects, no people, hand-drawn 2D Japanese TV anime action-scene VFX style (anime FX animation key frame), cel-shaded flat colour shapes with a bright white-hot core and a saturated coloured glow around it, bold crisp sharp-edged angular shapes, dynamic motion and impact lines, strong contrast, not photorealistic, not a 3D render, not a smoke simulation, no text, no watermark`, Date.now()));
      }
      await env.DB.batch(st);
      return json({ ok: true, id: fid });
    }
    if (act === 'set') { await env.DB.prepare('UPDATE flipbooks SET status=? WHERE id=?').bind(['ok', 'rejected', 'review'].includes(b.status) ? b.status : 'review', +b.id).run(); return json({ ok: true }); }
    if (act === 'del') { await env.DB.prepare('DELETE FROM flipbooks WHERE id=?').bind(+b.id).run(); await env.DB.prepare("DELETE FROM jobs WHERE instr(project,?)=1 AND status!='running'").bind(`ฟลิปบุ๊ก·${+b.id}·`).run(); await env.DB.prepare('DELETE FROM images WHERE instr(project,?)=1').bind(`ฟลิปบุ๊ก·${+b.id}·`).run(); return json({ ok: true }); }
    const fb = (await env.DB.prepare('SELECT * FROM flipbooks ORDER BY id DESC LIMIT 60').all()).results;
    const ims = (await env.DB.prepare("SELECT id,project,scene FROM images WHERE instr(project,'ฟลิปบุ๊ก·')=1 ORDER BY scene, id").all()).results;
    const jb = (await env.DB.prepare("SELECT project,status FROM jobs WHERE instr(project,'ฟลิปบุ๊ก·')=1").all()).results;
    return json({ items: fb.map(f => { const pre = `ฟลิปบุ๊ก·${f.id}·`, fr = []; ims.filter(i => i.project.startsWith(pre)).forEach(i => { fr[i.scene - 1] = i.id; }); return { ...f, frames: fr, pending: jb.filter(j => j.project.startsWith(pre) && j.status !== 'failed').length, failed: jb.filter(j => j.project.startsWith(pre) && j.status === 'failed').length }; }) });
  }
  if (p === '/api/vcastsfx') { // คลังเสียงจริง (CC0 ที่ผู้ใช้โหลดมาอัปเอง)
    const b = body || {}, act = b.act || 'list';
    if (act === 'add') {
      const name = String(b.name || '').trim().slice(0, 80), data = String(b.data || '').replace(/^data:[^,]*,/, '');
      const mime = /^audio\/(ogg|mpeg|wav|x-wav|mp4|aac|flac)$/.test(b.mime) ? b.mime : 'audio/ogg';
      if (!name || data.length < 200) return json({ error: 'ไฟล์ไม่ถูกต้อง' }, 400);
      if (data.length > 1900000) return json({ error: 'ไฟล์ใหญ่เกิน (เกิน ~1.4MB) ใช้ชุด OGG/MP3 แทน WAV' }, 400);
      const dup = await env.DB.prepare('SELECT id FROM sfx_real WHERE name=? AND size=?').bind(name, data.length).first();
      if (dup) return json({ ok: true, dup: true });
      await env.DB.prepare('INSERT INTO sfx_real (name,mime,size,data,created) VALUES (?,?,?,?,?)').bind(name, mime, data.length, data, Date.now()).run();
      return json({ ok: true });
    }
    if (act === 'del') { await env.DB.prepare('DELETE FROM sfx_real WHERE id=?').bind(+b.id).run(); return json({ ok: true }); }
    if (act === 'get') { const r = await env.DB.prepare('SELECT mime,data FROM sfx_real WHERE id=?').bind(+b.id).first(); return r ? json(r) : json({ error: 'ไม่พบ' }, 404); }
    const r = await env.DB.prepare('SELECT id,name,mime,size,created FROM sfx_real ORDER BY name LIMIT 2000').all();
    return json({ items: r.results });
  }
  if (p === '/api/vcastmanualup') { // อัปโหลดภาพที่ได้จาก GPT/Gemini เข้าคลัง (ย่อภาพมาแล้วจากเบราว์เซอร์)
    const b = body || {}, t = await env.DB.prepare('SELECT id,title,prompt FROM manual_tasks WHERE id=?').bind(+b.id).first();
    if (!t) return json({ error: 'ไม่พบงานนี้' }, 404);
    const data = String(b.data || '').replace(/^data:[^,]*,/, '');
    if (data.length < 2000) return json({ error: 'ไฟล์ภาพเล็กผิดปกติ' }, 400);
    if (data.length > 1900000) return json({ error: 'ภาพใหญ่เกินไป ลองใหม่อีกครั้ง' }, 400);
    const ins = await env.DB.prepare('INSERT INTO images (job_id,project,scene,prompt,data,starred,created) VALUES (0,?,?,?,?,1,?)').bind('✋·' + t.title, 1, t.prompt.slice(0, 600), data, Date.now()).run();
    await env.DB.prepare("UPDATE manual_tasks SET status='done', image_id=? WHERE id=?").bind(ins.meta.last_row_id, t.id).run();
    return json({ ok: true, image_id: ins.meta.last_row_id });
  }
  if (p === '/api/vcastanimate') { // ทำให้ภาพในคลังขยับ: ส่งเข้าคิววิดีโอ (Wan 2.2 บน Kaggle ฟรี)
    const b = body || {}, im = await env.DB.prepare('SELECT id,project,data FROM images WHERE id=?').bind(+b.id).first();
    if (!im || !im.data) return json({ error: 'ไม่พบภาพนี้' }, 404);
    const MOT = {
      idle: 'the character stands naturally, blinks softly, breathes gently, hair and clothes sway in a light breeze, subtle head movement',
      wave: 'the character smiles and waves one hand at the viewer, hair and clothes sway gently',
      turn: 'the character slowly turns the head and looks toward the viewer with a soft smile, hair sways',
      walk: 'the character walks forward in place with a relaxed step, arms swinging lightly, hair and clothes flowing'
    };
    const mo = MOT[b.motion] ? b.motion : 'idle';
    const prompt = ('anime style, same character design, ' + MOT[mo] + ', static camera, smooth natural motion, consistent face and outfit, no morphing').slice(0, 600);
    await env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,opt) VALUES (?,?,?,?,?,?,?,'queued',0,?,?)")
      .bind('ภาพขยับ·' + String(im.project || '').replace(/^✋·/, '').slice(0, 40), 'anim', String(im.id), prompt, VNEG, im.data, vFrames(b.sec), Date.now(), JSON.stringify({ hq: 0, fps: 0 })).run();
    return json({ ok: true });
  }
  if (p === '/api/vcastlibone') { // สั่งสร้างภาพรายการเดียวจากคลังทันที
    const b = body || {};
    const row = LIBD.find(x => x[0] === b.cat); if (!row) return json({ error: 'ไม่รู้จักหมวด' }, 400);
    const it = (row[1]() || []).find(x => x.i === +b.i); if (!it) return json({ error: 'ไม่พบรายการ' }, 400);
    const proj = `คลัง·${b.cat}·${libName(it)}`, pr = row[2](it).slice(0, 2000);
    await env.DB.batch([0, 1].map(() => env.DB.prepare("INSERT INTO jobs (project,scene,prompt,status,created,steps) VALUES (?,?,?,'queued',?,?)").bind(proj, 1, pr, Date.now(), libSteps(b.cat))));
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
    if (p === '/api/vcastep') { // โครงเรื่อง (.docx ที่อ่านแล้ว) → ใส่บทอัตโนมัติ → ตรวจบทก่อนสร้างทีละตอน
      const b = body || {}, act = b.act || 'get', story = String(b.story || '').trim().slice(0, 60);
      if (!story) return json({ error: 'ไม่มีชื่อเรื่อง' }, 400);
      const rd = async k => { try { const r = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(k).first(); return r ? JSON.parse(r.value) : null; } catch (e) { return null; } };
      const clip = (x, n) => String(x == null ? '' : x).slice(0, n);
      if (act === 'get') { // แผน + นักแสดงในคลัง (พร้อมสถานะ LoRA ของแต่ละคน)
        const cs = (await env.DB.prepare('SELECT id,name,age,role,cast_role,cast_story,char_id FROM aud_cands WHERE COALESCE(kept,0)=1 ORDER BY id DESC').all()).results;
        for (const c of cs) {
          const R = AUD_ROLES.find(x => x.key === c.role); c.g = R ? (/woman/.test(R.g) ? 'f' : 'm') : ''; c.lora = '';
          if (+c.char_id) { const l = await env.DB.prepare("SELECT status,error FROM loras WHERE char_id=? AND status<>'old' ORDER BY id DESC LIMIT 1").bind(c.char_id).first(); c.lora = l ? l.status : 'none'; c.lora_err = l && l.status === 'failed' ? String(l.error || '').slice(-400) : ''; }
          const pf = `ออดิชัน·${c.role}·${c.id}·`, fr = await env.DB.prepare('SELECT MAX(id) id FROM images WHERE project >= ? AND project < ? AND scene=1').bind(pf, pf + '\uffff').first(); c.face = (fr && fr.id) || 0; // ช่วงแทน LIKE ให้ใช้ดัชนีได้ (เดิมสแกนภาพทั้งตารางต่อคน = ~18,000 แถวต่อครั้ง)
        }
        const epst = (await rd('epst:' + story)) || {}, sr = await env.DB.prepare('SELECT id FROM series WHERE title=?').bind(story).first();
        if (sr) for (const [no, v] of Object.entries(epst)) {
          if (!v || v.status !== 'running') continue;
          const scs = (await env.DB.prepare('SELECT * FROM scenes WHERE series_id=? AND ep=? ORDER BY sc').bind(sr.id, +no).all()).results, g = { sc: scs.length, wr: 0, tot: 0, img: 0, vid: 0, fin: 0 };
          for (const e of scs) {
            if (+e.fin) g.fin++;
            if (!e.script_id) continue; g.wr++;
            g.tot += (await env.DB.prepare('SELECT COUNT(*) n FROM shots WHERE script_id=?').bind(e.script_id).first()).n;
            g.img += (await env.DB.prepare('SELECT COUNT(DISTINCT project) n FROM images WHERE project >= ? AND project < ?').bind(`ฉาก${e.script_id}·`, `ฉาก${e.script_id}·\uffff`).first()).n;
            g.vid += (await env.DB.prepare("SELECT COUNT(DISTINCT shot) n FROM videos WHERE ep=? AND shot<>'final'").bind('a' + e.script_id).first()).n;
          }
          v.prog = g;
        }
        let meter = null; try { const dy = new Date().toISOString().slice(0, 10); const tt0 = +((await getSettings(env))[readDay()]) || 0, pc0 = readPace(tt0); meter = { cap: READ_CAP, stop: READ_STOP, web: READ_WEB, kstop: READ_KSTOP, budget: Math.round(pc0.budget), every: pc0.every, day: dy, now: Date.now(), total: tt0, by: (await env.DB.prepare('SELECT tag,n,c FROM rmeter WHERE day=? ORDER BY n DESC').bind(dy).all()).results }; } catch (e) { meter = null; }
        if (meter) try { // แผนงานในคิว: แต่ละคิวจะใช้ฐานข้อมูลประมาณเท่าไร (คิดจากการใช้จริงวันนี้ต่อภาพ/ต่อบรรทัดเสียง)
          const S = await getSettings(env), d0 = Date.parse(dy + 'T00:00:00Z');
          const kR = meter.by.filter(r => /^(kaggle|bg:kaggle)/.test(r.tag)).reduce((a, r) => a + (+r.n || 0), 0);
          const iT = ((await env.DB.prepare('SELECT COUNT(*) n FROM images WHERE created>=?').bind(d0).first()) || {}).n || 0, vT = ((await env.DB.prepare('SELECT COUNT(*) n FROM voices WHERE created>=?').bind(d0).first()) || {}).n || 0;
          const perImg = iT >= 5 ? Math.round(kR / (iT + vT / 20)) : 2500, perLine = Math.max(30, Math.round(perImg / 20));
          const Q = [], add = (label, n, unit, per, note) => { if (n > 0) Q.push({ label, n, unit, est: Math.round(n * per), note: note || '' }); };
          const sc = {}; for (const r of (await env.DB.prepare('SELECT script_id,ep,sc FROM scenes').all()).results) sc[r.script_id] = `ตอน ${r.ep} ซีน ${r.sc}`;
          const im = (await env.DB.prepare("SELECT CASE WHEN project LIKE 'อ้างอิง·%' THEN 'R' WHEN project LIKE 'ฉาก%·%' THEN substr(project,4,instr(project,'·')-4) ELSE 'X' END g, COUNT(*) n FROM vjobs WHERE kind='img' AND status IN ('queued','running') GROUP BY g").all()).results;
          for (const r of im) add(r.g === 'R' ? 'แผ่นอ้างอิงตัวละคร' : r.g === 'X' ? 'ภาพอื่นๆ' : 'ภาพ ' + (sc[r.g] || 'ฉาก ' + r.g), +r.n, 'ภาพ', perImg);
          const held = String(S.img_hold || '').split(',').map(x => x.trim()).filter(Boolean);
          for (const h of held) { const n = ((await env.DB.prepare('SELECT COUNT(*) n FROM shots s WHERE s.script_id=? AND NOT EXISTS (SELECT 1 FROM images i WHERE i.project=s.kproj)').bind(+h).first()) || {}).n || 0; add('ภาพ ' + (sc[h] || 'ฉาก ' + h), n, 'ภาพ', perImg, 'พักไว้ รอผู้ใช้เลือกภาพอ้างอิง'); }
          const tl = ((await env.DB.prepare("SELECT SUM(json_array_length(json_extract(opt,'$.lines'))) n FROM vjobs WHERE kind='tts' AND status IN ('queued','running')").first()) || {}).n || 0; add('เสียงพากย์', +tl, 'บรรทัด', perLine);
          const lp = String(S.lora_purge || '').split(',').filter(Boolean).length; add('ลบไฟล์ LoRA เก่า', lp, 'ไฟล์', 40);
          meter.queue = { items: Q, perImg, perLine, measured: iT >= 5 };
        } catch (e) { }
        const voq = {}; for (const r of (await env.DB.prepare("SELECT project, SUM(json_array_length(json_extract(opt,'$.lines'))) n FROM vjobs WHERE kind='tts' AND status IN ('queued','running') AND project LIKE ? GROUP BY project").bind('เสียงพากย์·' + story + '·ตอน%').all()).results) voq[String(r.project).split('·ตอน').pop()] = +r.n || 0; // บรรทัดเสียงที่ยังรอทำ ต่อตอน
        return json({ ok: true, voq, meter, draft: (await getSettings(env)).sb_draft !== '0' && (await getSettings(env)).img_hybrid !== '1' /* ภาพแบบผสมเป็นภาพสี: ไม่ใส่ฟิลเตอร์ขาวดำของภาพร่าง */, boost: +((await getSettings(env)).boost_until) || 0, reads: Math.round((+((await getSettings(env))[readDay()]) || 0) / READ_CAP * 100), plan: await rd('plan:' + story), epst, cands: cs, best: +((await getSettings(env))['best:' + story]) || 0, kind: (await workOf(env, story)).key });
      }
      if (act === 'save') {
        const pl = b.plan || {}; if (!Array.isArray(pl.roles) || !Array.isArray(pl.eps) || !pl.roles.length || !pl.eps.length) return json({ error: 'โครงเรื่องไม่ครบ (ต้องมีบทและตอน)' }, 400);
        const plan = {
          title: clip(pl.title, 80), overview: clip(pl.overview, 1500), rule: clip(pl.rule, 400),
          roles: pl.roles.slice(0, 40).map(r => ({ key: clip(r.key, 40), name: clip(r.name, 80), kind: clip(r.kind, 80), age: Math.max(0, Math.min(120, +r.age || 0)), g: ['f', 'm', 'x'].includes(r.g) ? r.g : '', tier: ['main', 'support', 'none'].includes(r.tier) ? r.tier : (r.g === 'x' ? 'none' : 'support'), look: clip(r.look, 300), secret: clip(r.secret, 300), traits: clip(r.traits, 300) })).filter(r => r.key),
          eps: pl.eps.slice(0, 60).map(e => ({ no: +e.no || 0, title: clip(e.title, 120), f: Object.fromEntries(Object.entries(e.f || {}).slice(0, 8).map(([k, v]) => [clip(k, 20), clip(v, 700)])), cast: (Array.isArray(e.cast) ? e.cast : []).slice(0, 40).map(x => clip(x, 40)) })).filter(e => e.no),
          locs: (Array.isArray(pl.locs) ? pl.locs : []).slice(0, 40).map(l => ({ name: clip(l.name, 80), eps: (Array.isArray(l.eps) ? l.eps : []).slice(0, 60).map(Number), note: clip(l.note, 200) }))
        };
        const js = JSON.stringify(plan); if (js.length > 90000) return json({ error: 'ไฟล์โครงเรื่องใหญ่เกินไป' }, 400);
        await setSetting(env, 'plan:' + story, js);
        const s = await getSettings(env); let stories = []; try { stories = JSON.parse(s.stories || '[]'); } catch (e) { }
        if (!stories.length) stories = ['สาเหตุที่ฉันรัก'];
        if (!stories.includes(story)) { stories.push(story); await setSetting(env, 'stories', JSON.stringify(stories)); }
        return json({ ok: true, roles: plan.roles.length, eps: plan.eps.length });
      }
      if (act === 'lib') { // คลัง LoRA: เฉพาะตัวที่เทรนเสร็จแล้ว (status=ready) ของนักแสดงในคลัง + ใช้เป็นบทไหนอยู่ + ภาพทดสอบ + น้ำหนักต่อบท
        const rows = (await env.DB.prepare("SELECT l.id lid, l.char_id, l.size, l.created, a.id cand, a.name, a.role, a.cast_role, a.cast_story FROM loras l JOIN aud_cands a ON a.char_id=l.char_id WHERE l.status='ready' AND l.id=(SELECT MAX(x.id) FROM loras x WHERE x.char_id=l.char_id AND x.status='ready') ORDER BY l.id DESC").all()).results;
        for (const c of rows) {
          const fr = await env.DB.prepare('SELECT MAX(id) id FROM images WHERE project >= ? AND project < ? AND scene=1').bind(`ออดิชัน·${c.role}·${c.cand}·`, `ออดิชัน·${c.role}·${c.cand}·\uffff`).first(); c.face = (fr && fr.id) || 0;
          const tp = 'ทดสอบLoRA·' + c.lid, ti = await env.DB.prepare('SELECT MAX(id) id FROM images WHERE project=?').bind(tp).first(), tj = await env.DB.prepare("SELECT COUNT(*) n FROM jobs WHERE project=? AND status IN ('queued','running','kaggle')").bind(tp).first();
          c.test = (ti && ti.id) || 0; c.testing = !!(tj && tj.n);
        }
        return json({ ok: true, loras: rows, weights: (await rd('lw:' + story)) || {} });
      }
      if (act === 'training') { // LoRA ที่ยังไม่เสร็จ: รอคิว / กำลังเทรน (พร้อมความคืบหน้า) / เทรนพัง (พร้อมข้อผิดพลาด)
        const rows = (await env.DB.prepare("SELECT l.id lid, l.char_id, l.vjob, l.status, l.error, l.created, v.status vs, json_extract(v.opt,'$.pri') pri, a.id cand, a.name, a.cast_role FROM loras l LEFT JOIN vjobs v ON v.id=l.vjob LEFT JOIN aud_cands a ON a.char_id=l.char_id WHERE l.status IN ('queued','failed') AND l.id=(SELECT MAX(x.id) FROM loras x WHERE x.char_id=l.char_id AND x.status<>'old') ORDER BY l.id").all()).results;
        const waiting = rows.filter(x => x.status === 'queued' && x.vs !== 'running').sort((p, q) => ((+p.pri === 0 ? 0 : 1) - (+q.pri === 0 ? 0 : 1)) || (p.vjob - q.vjob));
        const items = [];
        for (const x of rows) {
          let st = x.status; if (st === 'queued' && x.vs === 'running') st = 'training';
          const it = { lid: x.lid, cand: x.cand || 0, name: x.name || ('ตัวละคร ' + x.char_id), cast_role: x.cast_role || '', status: st, pri: +x.pri === 0 ? 0 : 1, error: st === 'failed' ? String(x.error || '').slice(-400) : '', pos: st === 'queued' ? waiting.indexOf(x) + 1 : 0, step: 0, total: 0, tail: '', at: 0 };
          if (st === 'training') { const pg = await rd('lprog:' + x.vjob); if (pg) { it.step = pg.step || 0; it.total = pg.total || 0; it.tail = pg.tail || ''; it.at = pg.at || 0; } }
          items.push(it);
        }
        const s2 = await getSettings(env);
        return json({ ok: true, items, autos: { fill: s2.auto_fill === '1', lora: s2.auto_lora !== '0', cast: s2.cast_on !== '0', aud: s2.aud_auto !== '0' } });
      }
      if (act === 'autos_off') { // ปิดระบบอัตโนมัติตัวเก่าทั้งหมด (เติมคิวภาพเอง · เทรน LoRA เอง · แคสติ้งรายวัน · ออดิชันรายวัน) + ล้างคิวงานเทรน/ภาพที่ค้าง
        for (const [k, v] of [['auto_fill', '0'], ['auto_lora', '0'], ['cast_on', '0'], ['aud_auto', '0']]) await setSetting(env, k, v);
        await animeSchema(env);
        const r1 = await env.DB.prepare("UPDATE loras SET status='old' WHERE status IN ('queued','failed') AND COALESCE(vjob,0) NOT IN (SELECT id FROM vjobs WHERE status='running')").run();
        await env.DB.batch([
          env.DB.prepare("DELETE FROM vjobs WHERE kind='lora' AND status IN ('queued','failed')"),
          env.DB.prepare("DELETE FROM vjobs WHERE kind='img' AND status='queued'"),
          env.DB.prepare("DELETE FROM jobs WHERE status IN ('queued','failed','kaggle')")]);
        return json({ ok: true, loras_cleared: (r1.meta && r1.meta.changes) || 0 });
      }
      if (act === 'lora_test') { // วาดภาพทดสอบหน้าด้วย LoRA ที่เสร็จแล้ว (เห็นผลในคลัง LoRA)
        const l = await env.DB.prepare('SELECT id,char_id,status FROM loras WHERE id=?').bind(+b.lora).first();
        if (!l || l.status !== 'ready') return json({ error: 'LoRA นี้ยังไม่พร้อม' }, 400);
        const pj = 'ทดสอบLoRA·' + l.id, tc = await env.DB.prepare('SELECT id cid,desc FROM chars WHERE id=?').bind(l.char_id).first();
        if ((await env.DB.prepare("SELECT COUNT(*) n FROM jobs WHERE project=? AND status IN ('queued','running','kaggle')").bind(pj).first()).n) return json({ ok: true, pending: true });
        await env.DB.batch([env.DB.prepare('DELETE FROM images WHERE project=?').bind(pj), env.DB.prepare("INSERT INTO jobs (project,scene,prompt,status,created,steps) VALUES (?,1,?,'queued',?,4)").bind(pj, `${tc ? loraTag(tc) : 'chr' + l.char_id + 'x'}, solo, upper body portrait, looking at viewer, gentle smile, plain light background, [[STYLE]]`, Date.now())]);
        return json({ ok: true });
      }
      if (act === 'lorawt') { // น้ำหนัก LoRA ต่อบท (0.3–1.2) ใช้ตอนสร้างภาพคีย์ของช็อตที่มีตัวละครนั้น
        const key = clip(b.key, 40), v = Math.round(Math.max(0.3, Math.min(1.2, +b.w || 0.8)) * 100) / 100, m = (await rd('lw:' + story)) || {};
        if (!key) return json({ error: 'ไม่พบบท' }, 400);
        m[key] = v; await setSetting(env, 'lw:' + story, JSON.stringify(m)); return json({ ok: true, w: v });
      }
      if (act === 'songs') { // เพลงที่สร้างแล้ว + เพลงปิดที่เลือก + งานเพลงที่ค้าง
        const S = await getSettings(env); let L = []; try { L = JSON.parse(S.songs || '[]'); } catch { }
        const q = (await env.DB.prepare("SELECT id,status,started FROM vjobs WHERE kind='song' AND status IN ('queued','running')").all()).results;
        return json({ ok: true, songs: L.filter(x => !x.story || x.story === story), pick: +(await rd('ending_song:' + story)) || 0, queue: q, lora: S.songlora ? JSON.parse(S.songlora) : null });
      }
      if (act === 'song_pick') { await setSetting(env, 'ending_song:' + story, JSON.stringify(+b.vid || 0)); return json({ ok: true }); }
      if (act === 'refs') { // แผ่นอ้างอิงตัวละคร (ปกติ + หน้าตลก): รายการภาพ + ที่อนุมัติแล้ว + คิวที่ค้าง
        const im = (await env.DB.prepare("SELECT id,project FROM images WHERE project LIKE 'อ้างอิง·%' ORDER BY id").all()).results;
        const q = (await env.DB.prepare("SELECT project,COUNT(*) n FROM vjobs WHERE kind='img' AND status IN ('queued','running') AND project LIKE 'อ้างอิง·%' GROUP BY project").all()).results;
        return json({ ok: true, imgs: im, queued: q, ok_: (await rd('charref:' + story)) || {}, map: (await rd('refmap:' + story)) || {}, roles: Object.keys(HY_TAGS).filter(n => n !== 'ริน_d'), names: [...new Set([...Object.keys(HY_TAGS).filter(n => n !== 'ริน_d'), ...im.map(x => String(x.project).split('·')[1])])] });
      }
      if (act === 'ref_map') { // ตัวละครในคลัง → ใช้เป็นบทไหน ('' = ไม่ใช้ในเรื่องนี้)
        const m = (await rd('refmap:' + story)) || {}; m[String(b.lib || '')] = String(b.role ?? ''); await setSetting(env, 'refmap:' + story, JSON.stringify(m)); return json({ ok: true, map: m });
      }
      if (act === 'ref_ok') { // อนุมัติภาพอ้างอิง: {name, kind:'n'|'g', id, on}
        const cur = (await rd('charref:' + story)) || {}, nm = String(b.name || ''), k = b.kind === 'g' ? 'g' : 'n'; cur[nm] = cur[nm] || { n: 0, g: [] };
        if (k === 'n') { const m = new Set(cur[nm].m || (cur[nm].n ? [cur[nm].n] : [])); b.on ? m.add(+b.id) : m.delete(+b.id); cur[nm].m = [...m]; if (!m.has(cur[nm].n)) cur[nm].n = cur[nm].m[0] || 0; } else { const g = new Set(cur[nm].g || []); b.on ? g.add(+b.id) : g.delete(+b.id); cur[nm].g = [...g]; }
        await setSetting(env, 'charref:' + story, JSON.stringify(cur)); return json({ ok: true, ok_: cur });
      }
      if (act === 'ref_make') { // วาดแผ่นอ้างอิงตามตู้เสื้อผ้า (ชุดหลักที่ใช้ในตอน 1 ก่อน) · name = เฉพาะตัวนั้น · มิโอะใช้หน้าที่ผู้ใช้เลือกเป็นภาพอ้างอิง
        const cr = (await rd('charref:' + story)) || {}; let n = 0;
        for (const r of refPlan(cr)) { if (b.name && !r[0].startsWith('อ้างอิง·' + b.name + '·')) continue;
          await env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,kind,opt) VALUES (?,?,?,?,'','',0,'queued',0,?,'img',?)").bind(r[0], '', '0', r[1], Date.now() + n, JSON.stringify(r[2])).run(); n++; }
        return json({ ok: true, jobs: n });
      }
      if (act === 'qcrep') { // รายงานตรวจความต่อเนื่อง/คุณภาพของตอน (สร้างโดยสคริปต์ตรวจก่อนส่งวาด)
        return json({ ok: true, rep: await rd('qcrep:' + story + '|' + (+b.ep || 1)), canon: await rd('canon:' + story) });
      }
      if (act === 'vo_cast') { // ผังเสียงพากย์ของเรื่อง (แก้ได้: ส่ง cast มาแทน) + รายชื่อเสียงให้เลือก + เสียงตัวอย่าง
        if (b.cast && typeof b.cast === 'object') await setSetting(env, 'vcast:' + story, JSON.stringify(b.cast));
        const smp = (await env.DB.prepare('SELECT shot,id FROM voices WHERE shot<0 AND shot>-100').all()).results, sm = {}; for (const r of smp) sm[VV_VOICES[-r.shot - 1] ? VV_VOICES[-r.shot - 1][0] : r.shot] = r.id;
        const tv = (await env.DB.prepare('SELECT shot,id FROM voices WHERE shot<=-200 AND shot>-400 AND line=0').all()).results, ti = {}; for (const r of tv) ti[-r.shot - 200] = r.id; // 0 = ชื่อเรื่อง · n = ชื่อตอน n
        return json({ ok: true, ending: +(await rd('ending_song:' + story)) || 0, cast: (await rd('vcast:' + story)) || VCAST_DEFAULT, voices: VV_VOICES, samples: sm, titles: ti, epja: (await rd('eptitle_ja:' + story)) || {}, seriesja: (await rd('series_ja:' + story)) || '' });
      }
      if (act === 'vo_samples') { // ทำเสียงตัวอย่างของทุกเสียงให้ฟังก่อนเลือก (เครื่อง CPU ฟรี)
        const lines = [], cast = {}; VV_VOICES.forEach(([sp], i) => { cast['_s' + i] = { sp, st: 'ノーマル', speed: 0.95 }; lines.push({ shot: -(i + 1), line: 0, who: '', nv: '_s' + i, ja: VV_SAMPLE, emo: 'n' }); });
        await env.DB.prepare("DELETE FROM vjobs WHERE kind='tts' AND status='queued' AND ep='vs'").run(); // กดซ้ำ = แทนคิวเดิม ไม่ต่อท้าย
        await env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,kind,opt) VALUES (?,?,'tts','','',NULL,0,'queued',0,?,'tts',?)").bind('เสียงตัวอย่างผู้บรรยาย', 'vs', Date.now(), JSON.stringify({ lines, cast })).run();
        return json({ ok: true, lines: lines.length });
      }
      if (act === 'vo_make') { // สั่งทำเสียงพากย์ญี่ปุ่นของตอน (บรรทัดที่มีบทญี่ปุ่น) บนเครื่อง CPU ของ Kaggle
        const sr = await env.DB.prepare('SELECT id FROM series WHERE title=?').bind(story).first(); if (!sr) return json({ error: 'ไม่พบเรื่อง' }, 404);
        const cast = castResolve((await rd('vcast:' + story)) || VCAST_DEFAULT), plan = await rd('plan:' + story), G = {}; for (const r of ((plan && plan.roles) || [])) G[r.key] = r.g;
        const scs = (await env.DB.prepare('SELECT script_id FROM scenes WHERE series_id=? AND ep=? ORDER BY sc').bind(sr.id, +b.ep).all()).results;
        let nl = 0, nj = 0; const NJ = [];
        for (const sc of scs) { if (!sc.script_id) continue;
          const rows = (await env.DB.prepare("SELECT s.id,s.say,(SELECT group_concat(v.line) FROM voices v WHERE v.shot=s.id) have FROM shots s WHERE s.script_id=? ORDER BY s.idx").bind(sc.script_id).all()).results, L = [];
          for (const r of rows) { let y = {}; try { y = JSON.parse(r.say || '{}'); } catch (e) { } const hv = new Set(String(r.have || '').split(',').filter(Boolean).map(Number));
            (y.lines || []).forEach((l, i) => { if (!l.ja || (!b.redo && hv.has(i))) return; const wo = String(l.who || ''); if (b.only === 'narr' && wo) return; if (b.only === 'think' && !wo.startsWith('~')) return; if (b.only === 'narrthink' && wo && !wo.startsWith('~')) return; const w = String(l.who || ''), nm = w.replace(/^~/, ''); L.push({ shot: r.id, line: i, who: w, ja: String(l.ja).slice(0, 300), emo: String(l.emo || 'n'), g: G[nm] || '', ...(l.nv ? { nv: String(l.nv) } : {}), ...(+l.spd ? { spd: Math.min(1.6, Math.max(0.6, +l.spd)) } : {}), ...(l.pron ? { pron: String(l.pron).slice(0, 300) } : {}) }); }); }
          for (let k = 0; k < L.length; k += 80) NJ.push(['เสียงพากย์·' + story + '·ตอน' + (+b.ep), 'v' + sc.script_id, L.slice(k, k + 80)]); }
        { // พากย์ชื่อเรื่อง + ชื่อตอน (ผู้บรรยาย โทนยิ่งใหญ่ เสียงดังกว่าปกติ)
          const sja = (await rd('series_ja:' + story)) || '', eja = ((await rd('eptitle_ja:' + story)) || {})[String(+b.ep)] || '';
          const have = new Set((await env.DB.prepare('SELECT shot FROM voices WHERE line=0 AND shot IN (?,?)').bind(-200, -200 - (+b.ep)).all()).results.map(r => r.shot)), TL = [];
          const redoT = b.redo && (!b.only || b.only === 'narr' || b.only === 'narrthink');
          if (sja && (redoT || !have.has(-200))) TL.push({ shot: -200, line: 0, who: '', nv: '_title', ja: sja, emo: 'x', loud: 1 });
          if (eja && (redoT || !have.has(-200 - (+b.ep)))) TL.push({ shot: -200 - (+b.ep), line: 0, who: '', nv: '_title', ja: `第${+b.ep}話。　${eja}！`, emo: 'x', loud: 1 });
          if (TL.length) NJ.push(['เสียงพากย์ชื่อเรื่อง·' + story, 'vt', TL]);
        }
        { // กดซ้ำ = บรรทัดเดียวกันในคิวเก่าถูกแทนที่ (เคยกดหลายรอบจนคิวซ้ำ 4–5 เท่า รอเป็นชั่วโมง)
          const K = new Set(); for (const [, , ls] of NJ) for (const l of ls) K.add(l.shot + ':' + l.line);
          if (K.size) { const old = (await env.DB.prepare("SELECT id,opt FROM vjobs WHERE kind='tts' AND status='queued' AND project IN (?,?)").bind('เสียงพากย์·' + story + '·ตอน' + (+b.ep), 'เสียงพากย์ชื่อเรื่อง·' + story).all()).results;
            for (const o of old) { let y = {}; try { y = JSON.parse(o.opt || '{}'); } catch (e) { } const keep = (y.lines || []).filter(l => !K.has(l.shot + ':' + l.line));
              if (!keep.length) await env.DB.prepare('DELETE FROM vjobs WHERE id=?').bind(o.id).run();
              else if (keep.length < (y.lines || []).length) { y.lines = keep; await env.DB.prepare('UPDATE vjobs SET opt=? WHERE id=?').bind(JSON.stringify(y), o.id).run(); } } }
          for (const [pj, ep, ls] of NJ) { await env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,kind,opt) VALUES (?,?,'tts','','',NULL,0,'queued',0,?,'tts',?)").bind(pj, ep, Date.now(), JSON.stringify({ lines: ls, cast })).run(); nj++; nl += ls.length; }
        }
        return json({ ok: true, jobs: nj, lines: nl });
      }
      if (act === 'helpers') { // ผู้ช่วย Kaggle: ลิงก์สคริปต์ให้ผู้ช่วยกดรันใน Kaggle ของตัวเอง
        const S9 = await getSettings(env), base = S9.self_url || url.origin;
        await helperSchema(env);
        if (b.set) { await env.DB.prepare('UPDATE helpers SET on_=? WHERE id=?').bind(b.on ? 1 : 0, +b.set).run(); }
        if (b.add) { const nm = String(b.add).trim().slice(0, 40) || 'ผู้ช่วย', key = 'h' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8); await env.DB.prepare('INSERT INTO helpers (name,key,on_,created) VALUES (?,?,1,?)').bind(nm, key, Date.now()).run(); }
        if (b.unk) await env.DB.prepare("UPDATE helpers SET kuser=NULL, kkey=NULL, kstat='', kerr='' WHERE id=?").bind(+b.unk).run();
        if (b.setk) { // ผูก API ของ Kaggle: ทดสอบก่อนว่าใช้ได้ แล้วค่อยเก็บ (ไม่ส่งค่า key กลับไปหน้าเว็บ)
          let ku = String(b.kuser || '').trim().replace(/^@/, ''), kk = String(b.kkey || '').trim();
          try { const jj = JSON.parse(kk); if (jj && jj.key) { kk = String(jj.key); ku = ku || String(jj.username || ''); } } catch (e) { } // วางทั้งไฟล์ kaggle.json ก็ได้
          if (!ku || kk.length < 20) return json({ error: 'ใส่ชื่อผู้ใช้ Kaggle และ API key ให้ครบ' }, 400);
          const t = await kFetch({ KAGGLE_USERNAME: ku, KAGGLE_KEY: kk }, `/kernels/list?mine=true&pageSize=20`);
          { const own = (Array.isArray(t.j) ? t.j : []).map(k => String(k.ref || '').split('/')[0]).find(Boolean); if (own && own.toLowerCase() !== ku.toLowerCase()) ku = own; } // ถ้าบัญชีมีโน้ตบุ๊กอยู่แล้ว ใช้ชื่อเจ้าของจริง
          if (t.status === 401 || t.status === 403) return json({ error: 'Kaggle ไม่รับ API key นี้ (ชื่อผู้ใช้หรือ key ไม่ถูก)' }, 400);
          await env.DB.prepare("UPDATE helpers SET kuser=?, kkey=?, kerr='', kpause=0, on_=1 WHERE id=?").bind(ku, kk, +b.setk).run();
        }
        const wk = kgWeek(), hk = {}; for (const r of (await env.DB.prepare("SELECT k,v FROM qmeter WHERE day=? AND k LIKE 'kgh:h%'").bind(wk).all().catch(() => ({ results: [] }))).results || []) hk[r.k] = +r.v;
        const hs = (await env.DB.prepare('SELECT id,name,key,on_,seen,done,cur,kuser,kstat,kpushed,kpause,kerr FROM helpers ORDER BY id').all()).results, now = Date.now();
        return json({ ok: true, items: hs.map(h => { const run = /running|starting|queued/.test(String(h.kstat || '')) && +h.kpushed ? Math.min(12, (now - +h.kpushed) / 3600000) : 0; return { id: h.id, name: h.name, on: +h.on_, seen: +h.seen || 0, done: +h.done || 0, cur: h.cur || '', link: base + '/h/' + h.key, auto: !!h.kuser, kuser: h.kuser || '', kstat: h.kstat || '', kerr: h.kerr || '', kpause: +h.kpause || 0, kgh: (hk['kgh:h' + h.id] || 0) + run }; }) });
      }
      if (act === 'quota') { // โควตาฟรีทั้งหมดที่ใช้ (แยกจากหลอดอ่านฐานข้อมูล)
        const S9 = await getSettings(env), now = Date.now(), dy = utcDay(now), wk = kgWeek(now), Q = {};
        for (const r of (await env.DB.prepare("SELECT day,k,v FROM qmeter WHERE day IN (?,?,'all')").bind(dy, wk).all()).results) Q[(r.day === wk && r.day !== dy ? 'w:' : '') + r.k] = +r.v;
        const kRun = /running|starting|queued/.test(String(S9.k_status || '')) && +S9.k_pushed ? (now - +S9.k_pushed) / 3600000 : 0, kFull = /weekly GPU quota/i.test(String(S9.k_error || '')) && now < (+S9.k_pause || 0) + 7 * 86400000;
        const kgh = (Q['w:kgh'] || (wk === dy ? Q.kgh : 0) || 0) + Math.min(12, kRun);
        const supa = ((await env.DB.prepare("SELECT COALESCE(SUM(size),0) n FROM loras WHERE status IN ('ready','old') AND size>0").first()) || {}).n || 0;
        const resetD = new Date(Date.parse(dy + 'T00:00:00Z') + 86400000).getTime(), resetW = Date.parse(wk + 'T00:00:00Z') + 7 * 86400000;
        const helpers = (await env.DB.prepare('SELECT name,n,day FROM fluxkeys WHERE on_=1').all().catch(() => ({ results: [] }))).results || [];
        await helperSchema(env); const hk = {}; for (const r of (await env.DB.prepare("SELECT k,v FROM qmeter WHERE day=? AND k LIKE 'kgh:h%'").bind(wk).all().catch(() => ({ results: [] }))).results || []) hk[r.k] = +r.v;
        const hgs = ((await env.DB.prepare("SELECT id,name,kstat,kpushed,kerr FROM helpers WHERE on_=1 AND COALESCE(kuser,'')<>'' ORDER BY id").all().catch(() => ({ results: [] }))).results || []).map(h => { const run = /running|starting|queued/.test(String(h.kstat || '')) && +h.kpushed ? Math.min(12, (now - +h.kpushed) / 3600000) : 0, full = /quota|limit/i.test(String(h.kerr || '')); return { k: 'kgh' + h.id, name: 'Kaggle GPU · ผู้ช่วย ' + h.name, used: full ? 30 : (hk['kgh:h' + h.id] || 0) + run, cap: 30, unit: 'ชม.', reset: resetW, est: 1, full, note: run ? `เครื่องกำลังทำงาน (รอบนี้ ${run.toFixed(1)} ชม.)` : h.kerr ? '⚠️ ' + String(h.kerr).slice(0, 80) : 'ว่าง รอคิวงานเยอะพอค่อยเปิดเอง' }; });
        return json({ ok: true, now, items: [
          { k: 'd1r', name: 'ฐานข้อมูล · อ่าน', used: +S9[readDay()] || 0, cap: READ_CAP, unit: 'แถว', reset: resetD, note: 'เต็มแล้วเว็บล่ม · ดูรายละเอียดที่หลอดด้านบน' },
          { k: 'd1w', name: 'ฐานข้อมูล · เขียน', used: Q.dw || 0, cap: 100000, unit: 'แถว', reset: resetD, est: 1 },
          { k: 'req', name: 'คำขอเข้าบอท (หน้าเว็บ + Kaggle)', used: Q.req || 0, cap: 100000, unit: 'ครั้ง', reset: resetD },
          { k: 'ai', name: 'Cloudflare AI (วาดสำรอง + เขียนบท)', used: Q.nu_full ? Math.max(10000, Q.nu || 0) : (Q.nu || 0), cap: 10000, unit: 'neurons', reset: resetD, est: 1, full: !!Q.nu_full, note: `วาด ${Q.img || 0} ภาพ · เรียก AI เขียนบท ${Q.llm || 0} ครั้ง${helpers.length ? ' · บัญชีผู้ช่วย ' + helpers.map(h => h.name + ' ' + (h.day === new Date(now + 7 * 3600000).toISOString().slice(0, 10) ? h.n || 0 : 0) + ' ภาพ').join(', ') : ''}` },
          { k: 'kg', name: 'Kaggle GPU · บัญชีหลัก', used: kFull ? Math.max(30, kgh) : kgh, cap: 30, unit: 'ชม.', reset: resetW, est: 1, full: kFull, note: kRun ? `เครื่องกำลังทำงาน (รอบนี้ ${kRun.toFixed(1)} ชม.)` : '' },
          ...hgs,
          { k: 'supa', name: 'Supabase · ไฟล์ LoRA', used: Math.round(supa / 1048576), cap: 1024, unit: 'MB', reset: 0 },
          { k: 'd1s', name: 'ฐานข้อมูล · พื้นที่เก็บ', used: Math.round((Q.dbsize || 0) / 1048576), cap: 5120, unit: 'MB', reset: 0 },
        ] });
      }
      if (act === 'boost') { const h = Math.max(0, Math.min(6, +b.hours || 0)); await setSetting(env, 'boost_until', String(h ? Date.now() + h * 3600000 : 0)); return json({ ok: true, until: h ? Date.now() + h * 3600000 : 0 }); } // เร่งสตอรีบอร์ดชั่วคราว (สูงสุด 6 ชม.) · ยังหยุดเองที่ 85%
      if (act === 'setkind') { // ประเภทงาน: อนิเมะ / หนัง / ซีรีส์ / โฆษณา (มีผลกับตอนที่เริ่มทำหลังจากนี้)
        if (!WORK[b.kind]) return json({ error: 'ไม่รู้จักประเภทงานนี้' }, 400);
        await setSetting(env, 'wk:' + story, String(b.kind)); return json({ ok: true, kind: b.kind, scenes: WORK[b.kind].scenes, shots: WORK[b.kind].shots });
      }
      if (act === 'sb' || act === 'sb_redo' || act === 'sb_ok' || act === 'sb_lora' || act === 'sb_del' || act === 'sb_reopen') { // สตอรีบอร์ดของตอน: ดูทุกช็อต · วาดใหม่รายช็อต · อนุมัติแล้วค่อยทำคลิปทั้งตอน
        await animeSchema(env);
        const st = (await rd('epst:' + story)) || {}, cur = st[+b.ep], sr = await env.DB.prepare('SELECT id FROM series WHERE title=?').bind(story).first();
        const scs = sr ? (await env.DB.prepare('SELECT id,sc,title,script_id,sb,fin FROM scenes WHERE series_id=? AND ep=? ORDER BY sc').bind(sr.id, +b.ep).all()).results : [];
        if (act === 'sb_del') { // ลบช็อตออกจากสตอรีบอร์ด (ภาพ/งานของช็อตนั้นลบด้วย)
          const sh = await env.DB.prepare('SELECT id,script_id,kproj FROM shots WHERE id=?').bind(+b.shot).first();
          if (!sh || !scs.some(x => +x.script_id === +sh.script_id)) return json({ error: 'ไม่พบช็อตนี้ในตอนนี้' }, 404);
          if (cur && cur.gate === 'ok') return json({ error: 'อนุมัติไปแล้ว ลบช็อตไม่ได้' }, 400);
          await env.DB.batch([env.DB.prepare('DELETE FROM shots WHERE id=?').bind(sh.id), env.DB.prepare('DELETE FROM images WHERE project=?').bind(sh.kproj), env.DB.prepare("DELETE FROM jobs WHERE project=? AND status IN ('queued','kaggle')").bind(sh.kproj), env.DB.prepare("DELETE FROM vjobs WHERE project=? AND kind='img' AND status='queued'").bind(sh.kproj), env.DB.prepare('DELETE FROM videos WHERE ep=? AND shot=?').bind('a' + sh.script_id, String(sh.id))]);
          return json({ ok: true });
        }
        if (act === 'sb_redo') {
          const sh = await env.DB.prepare('SELECT id,script_id,kproj FROM shots WHERE id=?').bind(+b.shot).first();
          if (!sh || !scs.some(x => +x.script_id === +sh.script_id)) return json({ error: 'ไม่พบช็อตนี้ในตอนนี้' }, 404);
          if ((await env.DB.prepare("SELECT COUNT(*) n FROM jobs WHERE project=? AND status IN ('queued','running','kaggle')").bind(sh.kproj).first()).n) return json({ ok: true, pending: true });
          await env.DB.prepare('DELETE FROM settings WHERE key=?').bind('sbdone:' + sh.script_id).run();
          const cmd = String(b.command || '').trim(); if (cmd) await animeApi(env, { act: 'sb_edit', id: sh.id, command: cmd }); // สั่งแก้ภาพเป็นคำพูด (ไม่ใส่ = วาดใหม่ตามเดิม)
          await env.DB.batch([env.DB.prepare('DELETE FROM images WHERE project=?').bind(sh.kproj), env.DB.prepare('DELETE FROM videos WHERE ep=? AND shot=?').bind('a' + sh.script_id, String(sh.id))]);
          await animeApi(env, { act: 'kf', script_id: sh.script_id, ids: [sh.id] });
          return json({ ok: true });
        }
        const pl0 = await rd('plan:' + story), E = pl0 && pl0.eps.find(x => x.no === +b.ep), need = E ? (await epCheck(env, story, pl0, E)).nol : [], stale = [];
        if (sr) { const LM = await shotLoraMap(env, sr.id);
          for (const e of scs) { if (!e.script_id) continue; for (const sh of (await env.DB.prepare('SELECT id,script_id,chars,loras,kproj,loc FROM shots WHERE script_id=?').bind(e.script_id).all()).results) {
            let lo = []; try { lo = JSON.parse(sh.loras || '[]'); } catch (x) { }
            const want = [...new Set(shotLoraPick(sh, LM).m.map(c => +c.lid))].sort().join(','), has = [...new Set(lo.map(x => +x.id))].sort().join(',');
            if (want !== has) stale.push(sh); } } }
        if (act === 'sb_lora') { // LoRA มาครบทีหลัง: วาดใหม่เฉพาะช็อตที่ตัวละครยังไม่ได้ใช้ LoRA ล่าสุด
          const by = {}; for (const sh of stale) (by[sh.script_id] = by[sh.script_id] || []).push(sh);
          for (const [sid, l] of Object.entries(by)) { await env.DB.prepare('DELETE FROM settings WHERE key=?').bind('sbdone:' + sid).run(); for (let i = 0; i < l.length; i += 20) await env.DB.batch(l.slice(i, i + 20).map(sh => env.DB.prepare("DELETE FROM jobs WHERE project=? AND status='queued'").bind(sh.kproj))); for (let i = 0; i < l.length; i += 20) await env.DB.batch(l.slice(i, i + 20).map(sh => env.DB.prepare('DELETE FROM images WHERE project=?').bind(sh.kproj))); await animeApi(env, { act: 'kf', script_id: +sid, ids: l.map(x => x.id) }); }
          return json({ ok: true, redo: stale.length });
        }
        if (act === 'sb_reopen') { // กลับไปที่สตอรีบอร์ดของตอนนี้ (เช่น หลังดูฉบับภาพนิ่งแล้วจะทำอนิเมะเต็ม): ลบไฟล์รวมตอนเดิม เปิดด่านอนุมัติใหม่
          if (!cur || !sr) return json({ error: 'ไม่พบตอนนี้' }, 404);
          const key = 'E' + sr.id + 'x' + (+b.ep);
          await env.DB.batch([env.DB.prepare('DELETE FROM vchunks WHERE vid IN (SELECT id FROM videos WHERE ep=? AND shot=?)').bind(key, 'final'), env.DB.prepare("DELETE FROM videos WHERE ep=? AND shot='final'").bind(key), env.DB.prepare("DELETE FROM vjobs WHERE ep=? AND kind='epcat'").bind(key), env.DB.prepare('UPDATE scenes SET fin=0, auto=1 WHERE series_id=? AND ep=?').bind(sr.id, +b.ep)]);
          cur.status = 'running'; cur.gate = 'sb'; delete cur.still; await setSetting(env, 'epst:' + story, JSON.stringify(st)); return json({ ok: true });
        }
        const out = []; let tot = 0, img = 0, wr = 0;
        for (const e of scs) {
          const x = { sc: e.sc, title: e.title, shots: [], writing: !e.script_id || +e.sb >= 0 };
          if (e.script_id) { x.shots = (await animeApi(env, { act: 'shots', script_id: e.script_id })).shots; if (!x.writing) wr++; }
          tot += x.shots.length; img += x.shots.filter(v => v.img).length; out.push(x);
        }
        let cut = 0, fix = 0, qn = 0, bad = 0; const S0 = await getSettings(env), qm = {};
        try { for (const q of (await env.DB.prepare('SELECT q.shot_id,q.img,q.score,q.tries FROM qc q JOIN shots s ON s.id=q.shot_id JOIN scenes c ON c.script_id=s.script_id WHERE c.series_id=? AND c.ep=?').bind(sr ? sr.id : 0, +b.ep).all()).results) qm[q.shot_id] = q; } catch (x) { }
        for (const e of scs) { const v = String(S0['sbfix:' + e.script_id] || '').split(','); cut += +v[0] || 0; fix += +v[1] || 0; }
        for (const x of out) for (const v of x.shots) { const q = qm[v.id]; if (v.img && q && +q.img === +v.img) { qn++; if (q.score != null && +q.score <= 4) { v.bad = 1; bad++; } } }
        const ready = scs.length > 0 && wr === scs.length && tot > 0 && img === tot;
        if (act === 'sb_ok') {
          if (!cur || cur.status !== 'running') return json({ error: 'ตอนนี้ยังไม่ได้เริ่มทำ' }, 400);
          if (!ready && !b.force) return json({ error: `สตอรีบอร์ดยังวาดไม่ครบ (${img}/${tot} ภาพ) รอให้ครบก่อน` }, 400);
          if (b.still) { cur.gate = 'ok'; cur.still = 1; cur.okAt = Date.now(); await setSetting(env, 'epst:' + story, JSON.stringify(st)); return json({ ok: true, still: true }); } // ฉบับภาพนิ่ง + ซับ (ไม่ทำคลิป ไม่บังคับ LoRA) ไว้ดูทั้งตอนก่อน
          if (need.length) return json({ error: 'ยังเลือก LoRA ที่เสร็จแล้วให้ตัวหลักไม่ครบ: ' + need.join(', ') }, 400);
          if (stale.length) return json({ error: `มี ${stale.length} ช็อตที่ยังไม่ได้วาดด้วย LoRA ล่าสุด กดวาดใหม่ด้วย LoRA ก่อน` }, 400);
          cur.gate = 'ok'; cur.okAt = Date.now(); await setSetting(env, 'epst:' + story, JSON.stringify(st)); return json({ ok: true });
        }
        return json({ ok: true, ep: +b.ep, status: cur ? cur.status : '', gate: cur ? cur.gate || '' : '', need, stale: stale.length, ready, tot, img, cut, fix, qn, bad, scenes: out });
      }
      const plan = await rd('plan:' + story); if (!plan) return json({ error: 'ยังไม่ได้อัปโหลดโครงเรื่องของเรื่องนี้' }, 404);
      if (act === 'setr') { // เปลี่ยนเพศ / ระดับบทของตัวละคร (ตัวหลัก = ใช้ LoRA ล็อกหน้า)
        const r = plan.roles.find(x => x.key === b.key), v = String(b.value == null ? '' : b.value);
        if (!r || !((b.field === 'g' && ['', 'f', 'm', 'x'].includes(v)) || (b.field === 'tier' && ['main', 'support', 'none'].includes(v)))) return json({ error: 'ข้อมูลไม่ถูกต้อง' }, 400);
        if (b.field === 'g') { r.g = v; if (v === 'x') r.tier = 'none'; else if (r.tier === 'none') r.tier = 'support'; } else r.tier = v;
        await setSetting(env, 'plan:' + story, JSON.stringify(plan)); return json({ ok: true });
      }
      if (act === 'design_cast') return json(await designCast(env, await getSettings(env), story));
      if (act === 'xl_list') { // LoRA ประเภทอื่นของเรื่องนี้ + สถานะ
        await animeSchema(env);
        const rows = (await env.DB.prepare("SELECT c.id,c.name,c.kind,c.desc,(SELECT COUNT(*) FROM images i WHERE i.project='ซีรีส์0·'||c.name) img,(SELECT MIN(i.id) FROM images i WHERE i.project='ซีรีส์0·'||c.name) face,(SELECT COUNT(*) FROM jobs j WHERE j.project='ซีรีส์0·'||c.name AND j.status IN ('queued','running','kaggle')) pend,(SELECT l.status FROM loras l WHERE l.char_id=c.id AND l.status<>'old' ORDER BY l.id DESC LIMIT 1) lora,(SELECT l.size FROM loras l WHERE l.char_id=c.id AND l.status='ready' ORDER BY l.id DESC LIMIT 1) size FROM chars c WHERE c.series_id=0 AND c.story=? AND c.kind IN ('enemy','place','style') ORDER BY c.kind,c.id").bind(story).all()).results;
        return json({ ok: true, items: rows });
      }
      if (act === 'xl_new') { // สร้างเอง: พิมพ์ชื่อ + คำอธิบายภาษาไทย → AI แปลงเป็นคำสั่งวาดภาษาอังกฤษ
        const kind = String(b.kind || ''), S = await getSettings(env); let en = '';
        if (kind !== 'style' || String(b.desc || '').trim()) { try { const o = await llmJson(env, S, `แปลงคำอธิบายนี้เป็นคำสั่งวาดภาพภาษาอังกฤษแบบอนิเมะ สั้น กระชับ บอกรูปร่างหน้าตา สี จุดเด่น (${kind === 'place' ? 'เป็นสถานที่ ไม่มีคน' : kind === 'enemy' ? 'เป็นศัตรู/ตัวประหลาดที่ออกแบบขึ้นใหม่ ห้ามอ้างถึงตัวละครจากเรื่องอื่น' : 'เป็นคำบอกลายเส้น'}): "${String(b.desc || b.name).slice(0, 400)}"\nตอบเป็น JSON: {"en":"..."}`); en = String(o.en || ''); } catch (e) { en = ''; } }
        if (!en && kind !== 'style') return json({ error: 'AI แปลงคำอธิบายไม่สำเร็จ ลองใหม่' }, 502);
        const r = await xlNew(env, story, kind, b.name, en); return json(r, r.error ? 400 : 200);
      }
      if (act === 'xl_auto') { // ให้ AI อ่านบทแล้วเสนอ: สไตล์ 1 + ศัตรูหลักของ 3 ตอนแรก + สถานที่ที่ใช้ซ้ำ
        const S = await getSettings(env), made = [];
        const eps = plan.eps.slice(0, 3).map(E => `ตอน ${E.no} ${E.title}: ${Object.entries(E.f || {}).map(([k, v]) => k + '=' + v).join(' · ')}`.slice(0, 600)).join('\n');
        const o = await llmJson(env, S, `เรื่อง: ${plan.title || story}\n${String(plan.overview || '').slice(0, 800)}\n${eps}\nสถานที่ในเรื่อง: ${(plan.locs || []).map(L => L.name + (L.note ? ' (' + L.note + ')' : '')).join(' | ').slice(0, 800) || '-'}\n\nเลือกสิ่งที่ควรทำเป็นแบบภาพประจำเรื่องให้หน้าตาคงที่ทุกช็อต: ศัตรู/ตัวประหลาดหลักของ 3 ตอนนี้ (ไม่เกิน 3 ตัว ออกแบบขึ้นใหม่ ห้ามอ้างถึงตัวละครจากเรื่องอื่น) และสถานที่ที่ใช้ซ้ำบ่อย (ไม่เกิน 3 แห่ง) ชื่อเป็นภาษาไทยสั้นๆ en เป็นคำสั่งวาดภาพภาษาอังกฤษแบบอนิเมะบอกรูปร่าง สี จุดเด่น\nตอบเป็น JSON: {"enemies":[{"name":"","en":""}],"places":[{"name":"","en":""}]}`);
        const st = await xlNew(env, story, 'style', ('สไตล์ ' + story).slice(0, 40), ''); if (st.ok) made.push('สไตล์');
        for (const [k, L] of [['enemy', o.enemies], ['place', o.places]]) for (const x of (Array.isArray(L) ? L : []).slice(0, 3)) { if (!x || !x.name || !x.en) continue; const r = await xlNew(env, story, k, x.name, x.en); if (r.ok) made.push(x.name); }
        return json({ ok: true, made });
      }
      if (act === 'xl_del') {
        const c = await env.DB.prepare("SELECT * FROM chars WHERE id=? AND series_id=0 AND kind IN ('enemy','place','style')").bind(+b.id).first(); if (!c) return json({ error: 'ไม่พบ' }, 404);
        const pj = charProj(c), ls = (await env.DB.prepare('SELECT id FROM loras WHERE char_id=?').bind(c.id).all()).results;
        for (const l of ls) await supaDelLora(env, l.id);
        await env.DB.batch([env.DB.prepare('DELETE FROM loras WHERE char_id=?').bind(c.id), env.DB.prepare("DELETE FROM vjobs WHERE kind='lora' AND status<>'running' AND project=?").bind(pj), env.DB.prepare('DELETE FROM jobs WHERE project=?').bind(pj), env.DB.prepare('DELETE FROM images WHERE project=?').bind(pj), env.DB.prepare('DELETE FROM chars WHERE id=?').bind(c.id)]);
        return json({ ok: true });
      }
      if (act === 'lorapick') { // เลือก LoRA ที่เทรนเสร็จแล้วให้บทนี้ (lora=0 → ถอดออก) · รับเฉพาะ status=ready เท่านั้น
        const r = plan.roles.find(x => x.key === b.key); if (!r) return json({ error: 'ไม่พบบทนี้' }, 400);
        if (!+b.lora) { await env.DB.prepare('UPDATE aud_cands SET cast_role=NULL, cast_story=NULL, chosen=0 WHERE cast_role=? AND cast_story=?').bind(r.key, story).run(); return json({ ok: true }); }
        const l = await env.DB.prepare('SELECT id,char_id,status FROM loras WHERE id=?').bind(+b.lora).first();
        if (!l || l.status !== 'ready') return json({ error: 'LoRA นี้ยังเทรนไม่เสร็จ เลือกได้เฉพาะตัวที่เสร็จแล้ว' }, 400);
        const c = await env.DB.prepare('SELECT id,name,cast_role,cast_story FROM aud_cands WHERE char_id=?').bind(l.char_id).first();
        if (!c) return json({ error: 'LoRA นี้ไม่อยู่ในคลังนักแสดง' }, 400);
        if (c.cast_role && c.cast_story && c.cast_story !== story) return json({ error: `${c.name} ใช้อยู่ในเรื่อง "${c.cast_story}" แล้ว ถอดออกจากเรื่องนั้นก่อน` }, 400);
        await env.DB.batch([
          env.DB.prepare('UPDATE aud_cands SET cast_role=NULL, cast_story=NULL, chosen=0 WHERE cast_role=? AND cast_story=?').bind(r.key, story),
          env.DB.prepare('UPDATE aud_cands SET cast_role=?, cast_story=?, chosen=1, kept=1 WHERE id=?').bind(r.key, story, c.id)]);
        return json({ ok: true });
      }
      if (act === 'cast') { // ใส่/ถอดนักแสดงของบทนี้ (กดเลือกเอง)
        const r = plan.roles.find(x => x.key === b.key); if (!r) return json({ error: 'ไม่พบบทนี้' }, 400);
        await env.DB.prepare('UPDATE aud_cands SET cast_role=NULL, cast_story=NULL, chosen=0 WHERE cast_role=? AND cast_story=?').bind(r.key, story).run();
        if (+b.cand) {
          const c = await env.DB.prepare('SELECT id FROM aud_cands WHERE id=?').bind(+b.cand).first(); if (!c) return json({ error: 'ไม่พบนักแสดง' }, 404);
          await env.DB.prepare('UPDATE aud_cands SET cast_role=?, cast_story=?, chosen=1, kept=1 WHERE id=?').bind(r.key, story, c.id).run();
        }
        return json({ ok: true });
      }
      if (act === 'lorago') { // ตัวหลักยังไม่มี LoRA: สร้างตัวละคร (วาดภาพชุดฝึก) → ฝึก LoRA บน Kaggle
        const c = await env.DB.prepare('SELECT id,char_id FROM aud_cands WHERE id=?').bind(+b.cand).first(); if (!c) return json({ error: 'ไม่พบนักแสดง' }, 404);
        if (!+c.char_id) { const r = await charMake(env, { id: c.id }); if (r && r.error) return json(r, 400); return json({ ok: true, msg: 'สร้างตัวละครแล้ว กำลังวาดภาพชุดฝึก รอเสร็จแล้วกดฝึก LoRA อีกครั้ง' }); }
        const r = await charTrain(env, { char_id: +c.char_id }); if (r && r.error) return json(r, 400); return json({ ok: true, msg: 'ส่งฝึก LoRA ขึ้น Kaggle แล้ว' });
      }
      if (act === 'qc') return json(await qcRun(env, story, 5)); // ตรวจภาพทุกช็อต (ครั้งละ 5 ภาพ หน้าเว็บเรียกวนจนครบ) + สั่งทำใหม่เองช็อตที่เสีย
      if (act === 'pick') { await setSetting(env, 'best:' + story, String(+b.ep || 0)); return json({ ok: true }); }
      if (act === 'autocast') { // จับคู่นักแสดงในคลังที่ว่างอยู่ ตามเพศ + อายุใกล้สุด (ไม่แย่งคนที่ใส่บทเรื่องอื่นไว้แล้ว)
        const cs = (await env.DB.prepare("SELECT id,role,age,cast_role,cast_story,char_id FROM aud_cands WHERE COALESCE(kept,0)=1").all()).results, rdy = new Set((await env.DB.prepare("SELECT DISTINCT char_id FROM loras WHERE status='ready'").all()).results.map(x => +x.char_id));
        const have = new Set(cs.filter(c => c.cast_story === story && c.cast_role).map(c => c.cast_role)), taken = new Set(), done = [];
        const pool = cs.filter(c => !c.cast_role);
        for (const r of plan.roles) {
          if (r.g === 'x' || r.tier === 'none' || !r.g || have.has(r.key)) continue;
          let best = null, bs = 1e9;
          for (const c of pool) {
            if (taken.has(c.id)) continue;
            const R = AUD_ROLES.find(x => x.key === c.role), cf = R ? /woman/.test(R.g) : null;
            if (cf !== null && (r.g === 'f') !== cf) continue;
            const d = Math.abs((+c.age || 25) - (+r.age || 25)) - (r.tier === 'main' && +c.char_id && rdy.has(+c.char_id) ? 100 : 0); if (d < bs) { bs = d; best = c; }
          }
          if (best) { taken.add(best.id); done.push(r.key); await env.DB.prepare('UPDATE aud_cands SET cast_role=?, cast_story=?, chosen=1 WHERE id=?').bind(r.key, story, best.id).run(); }
        }
        return json({ ok: true, cast: done, left: plan.roles.filter(r => r.g && r.g !== 'x' && r.tier !== 'none' && !have.has(r.key) && !done.includes(r.key)).map(r => r.key), nog: plan.roles.filter(r => !r.g).map(r => r.key) });
      }
      if (act === 'make') { // เริ่มทำตอนนี้ · sb=1: ทำถึงสตอรีบอร์ดแล้วหยุดรออนุมัติ (count=1-3 ตอนรวด) · nolora=1: ไม่รอ/ไม่ใช้ LoRA (หน้าตัวละครจะไม่คงที่)
        const E0 = plan.eps.find(x => x.no === +b.ep); if (!E0) return json({ error: 'ไม่มีตอนนี้' }, 404);
        const Es = b.sb ? plan.eps.filter(x => x.no >= E0.no).sort((x, y) => x.no - y.no).slice(0, Math.min(3, Math.max(1, +b.count || 1))) : [E0];
        const st = (await rd('epst:' + story)) || {}, gate = b.sb ? { gate: 'sb' } : {}, nos = new Set(Es.map(x => x.no)), waiting = new Set(); let sid = 0;
        if (b.sb) for (const k of Object.keys(st)) if (!nos.has(+k) && st[k] && st[k].status === 'waiting' && !st[k].gate) delete st[k]; // ยกเลิกตอนอื่นที่ค้างรอจากระบบเดิม
        for (const E of Es) {
          if (st[E.no] && st[E.no].status === 'running' && st[E.no].gate === 'ok') continue; // ตอนที่อนุมัติแล้วไม่แตะ
          const ck = b.nolora ? { miss: [], nol: [] } : await epCheck(env, story, plan, E);
          if (b.sb) ck.miss = []; // โหมดสตอรีบอร์ด: บังคับเฉพาะตัวหลักต้องมี LoRA ที่เสร็จแล้ว ตัวรองไม่ต้องมีนักแสดง
          if (ck.miss.length) return json({ error: 'ยังไม่ได้ใส่บท: ' + ck.miss.join(', '), missing: ck.miss }, 400);
          if (ck.nol.length) { st[E.no] = { status: 'waiting', need: ck.nol, at: Date.now(), all: !!b.all, ...gate }; ck.nol.forEach(x => waiting.add(x)); continue; }
          sid = await epStart(env, story, plan, E); st[E.no] = { status: 'running', series: sid, at: Date.now(), all: !!b.all, ...gate };
        }
        if (sid && b.all) await setSetting(env, 'anime_ok_' + sid, '99'); // ทำต่อเนื่องทุกตอน ไม่ต้องรอผู้ใช้กดผ่านตอนก่อน
        else if (sid && b.sb) { const cur = +((await getSettings(env))['anime_ok_' + sid]) || 0, want = Es[Es.length - 1].no - 1; if (cur !== 99 && cur < want) await setSetting(env, 'anime_ok_' + sid, String(want)); } // เปิดให้ทำถึงตอนสุดท้ายของชุดนี้
        await setSetting(env, 'epst:' + story, JSON.stringify(st));
        return json(waiting.size ? { ok: true, waiting: [...waiting] } : { ok: true, started: true });
      }
      if (act === 'stop') { // หยุดตอนนี้ (ของที่ทำไปแล้วยังอยู่)
        const st = (await rd('epst:' + story)) || {}, sr = await env.DB.prepare('SELECT id FROM series WHERE title=?').bind(story).first();
        if (sr) await env.DB.prepare('UPDATE scenes SET auto=0 WHERE series_id=? AND ep=? AND fin=0').bind(sr.id, +b.ep).run();
        delete st[+b.ep]; await setSetting(env, 'epst:' + story, JSON.stringify(st)); return json({ ok: true });
      }
      return json({ error: 'ไม่รู้จักคำสั่ง' }, 400);
    }
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
