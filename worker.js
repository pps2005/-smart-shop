// ===== Anime Image Bot — Cloudflare Worker (ภาพ: SDXL อนิเมะ / FLUX.1-dev บน Kaggle (เลือกเอง/อัตโนมัติ) · Flux schnell สำรอง + D1 + Cron) =====
// Bindings ที่ต้องตั้งใน Cloudflare:  AI (Workers AI),  DB (D1: anime-bot-db)
// Variables (Secret):  PASSWORD   | ไม่บังคับ: TG_TOKEN, TG_CHAT (แจ้งเตือน Telegram)
// วิดีโอ (ไม่บังคับ): KAGGLE_USERNAME, KAGGLE_KEY → ทำวิดีโอด้วย GPU ฟรีของ Kaggle อัตโนมัติ
// Cron Trigger:  * * * * *   (บอทเช็คทุกนาที แต่สร้างภาพตามระยะห่างที่ตั้งในเว็บ)
// ใช้คู่กับ studio.html แท็บ "เจนภาพ" (เรียก API นี้ข้ามโดเมน จึงเปิด CORS ไว้ · ป้องกันด้วย PASSWORD)

import SCENES from './scenes.json';
import IDEAS from './ideas.json';
import WORLD from './world.json';
import MANGA from './mangaep.json'; // คลังโลก: อาวุธ พลังอาคม ของวิเศษ โลกและจักรวาล (400 รายการ) // คลังไอเดีย 600 รายการ (ตัวละคร ชุด พร็อพ สัตว์ องค์ประกอบฉาก เอฟเฟกต์) พร้อมรหัส CHR/COS/PRP/CRT/ELM/FX // คลัง 1000 ฉากอนิเมะของผู้ใช้ (Anime_Scene_Library_1000.xlsx) ใช้สุ่มแคสติ้งหมวดฉาก
const MODEL = '@cf/black-forest-labs/flux-1-schnell';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (p === '/') return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    if (p.startsWith('/k/')) return (await vRoutes(req, env, url, ctx).catch(e => json({ error: String(e.message || e) }, 500)));
    if (p.startsWith('/h/')) return (await helperScript(env, url).catch(e => new Response('# error: ' + String(e.message || e), { status: 500 })));
    if (p.startsWith('/vv/')) { // ลิงก์คลิปแบบมีลายเซ็น ให้เครื่อง Kaggle ดึงไปรวมคลิป (ไม่เปิดรหัสผ่านเจ้าของ)
      const vid = +p.split('/')[2];
      if (!vid || url.searchParams.get('s') !== await vvSig(env, vid)) return new Response('forbidden', { status: 403 });
      return getVideo(req, env, vid);
    }
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
      if (p === '/api/anime') return json(await animeApi(env, body));
      if (p === '/api/enqueue') return json(await enqueue(env, body));
      if (p === '/api/fluxkeys') return json(await fluxKeysApi(env, body));
      if (p === '/api/settings') {
        for (const k of ['interval_min', 'style', 'character', 'steps', 'pace', 'slots', 'style_preset', 'auto_fill', 'script_model', 'img_engine', 'auto_char_engine', 'auto_obj_engine', 'img_model', 'img_quant', 'img_w', 'img_h', 'img_cap'])
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
  },
  async scheduled(event, env, ctx) {
    await ensureSchema(env);
    ctx.waitUntil(tick(env, false).then(r => setSetting(env, 'tick_dbg', new Date().toISOString() + ' ' + JSON.stringify(r).slice(0, 200))).catch(e => setSetting(env, 'tick_dbg', new Date().toISOString() + ' ERR ' + String(e && e.stack || e).slice(0, 400))));
    ctx.waitUntil(autoHeal(env).catch(() => {}).then(() => vTick(env, false)).catch(e => setSetting(env, 'k_error', String(e.message || e).slice(0, 300))));
    ctx.waitUntil(castBatch(env, 0, false).catch(() => {}));
    ctx.waitUntil(audDaily(env).catch(() => {}));
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
  if (b.getUTCHours() < 7 || s.aud_day === day) return;
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
async function charTrain(env, b) {
  await animeSchema(env);
  const ch = await env.DB.prepare('SELECT * FROM chars WHERE id=? AND series_id=0').bind(+b.char_id).first(); if (!ch) return { error: 'ไม่พบตัวละคร' };
  if (await charBusy(env, ch.id)) return { error: 'กำลังรอ/เทรนอยู่ รอให้เสร็จก่อน' };
  const pj = charProj(ch);
  const all = (await env.DB.prepare('SELECT id,scene,starred FROM images WHERE project=? ORDER BY id').bind(pj).all()).results;
  const st = all.filter(x => x.starred), use = (st.length ? st : all).slice(0, 24);
  if (use.length < 8) return { error: st.length ? `ติด ⭐ แค่ ${st.length} ภาพ ต้องอย่างน้อย 8 (หรือไม่ติดเลย = ใช้ทุกภาพ)` : `มีภาพแค่ ${all.length} ภาพ ต้องอย่างน้อย 8 ภาพ` };
  const trig = 'chr' + ch.id + 'x', imgs = use.map(x => ({ id: x.id, cap: `${trig}, ${CHAR_VARS[((+x.scene || 1) - 1) % CHAR_VARS.length]}` }));
  await env.DB.batch([env.DB.prepare("UPDATE loras SET status='old' WHERE char_id=?").bind(ch.id), env.DB.prepare("DELETE FROM vjobs WHERE kind='lora' AND status IN ('queued','failed') AND project=?").bind(pj)]);
  const r = await env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,kind,opt) VALUES (?,'','lora','','','',0,'queued',0,?,'lora',?)").bind(pj, Date.now(), JSON.stringify({ char_id: ch.id, trigger: trig, images: imgs })).run();
  await env.DB.prepare("INSERT INTO loras (char_id,vjob,status,created) VALUES (?,?,'queued',?)").bind(ch.id, r.meta.last_row_id, Date.now()).run();
  return { ok: true, images: imgs.length };
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
  if (act === 'char_del') {
    await animeSchema(env);
    const c = await env.DB.prepare('SELECT * FROM chars WHERE id=? AND series_id=0').bind(+b.char_id).first(); if (!c) return { error: 'ไม่พบตัวละคร' };
    if (await charBusy(env, c.id)) return { error: 'กำลังรอ/เทรนอยู่ รอให้เสร็จก่อนค่อยลบ' };
    const ls = (await env.DB.prepare('SELECT id FROM loras WHERE char_id=?').bind(c.id).all()).results, pj = charProj(c);
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
    try { const out = await env.AI.run(MODEL, { prompt, steps }); if (out && out.image) return { image: out.image, by: '' }; throw new Error('AI ไม่ได้ส่งภาพกลับมา'); }
    catch (e) { const m = String(e.message || e); if (!isQuota(m)) throw e; await setSetting(env, 'img_err', new Date().toISOString() + ' ' + m.slice(0, 400)); await setSetting(env, 'paused_until', String(nextReset())); s.paused_until = String(nextReset()); }
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
function imgEngineFor(j, s) {
  const e = String((s && s.img_engine) || 'auto');
  if (e === 'sdxl' || e === 'dev') return e;
  const p = String((j && j.prompt) || ''), pr = String((j && j.project) || '');
  if (pr.startsWith('ฉาก') && !/chr\d+x/.test(p)) return 'dev'; // ช็อตฉาก/บรรยากาศไม่มีตัวละคร → FLUX.1-dev · ช็อตมีตัวละคร → SDXL + LoRA
  const obj = pr.startsWith('คลัง·') || p.includes('[[STYLE_OBJ]]') || p.includes('[[STYLE_ENV]]') ||
    /plain soft background|single object|creature design|dress form|faceless mannequin|environment element design|product design sheet/.test(p);
  return obj ? (s.auto_obj_engine === 'sdxl' ? 'sdxl' : 'dev') : (s.auto_char_engine === 'dev' ? 'dev' : 'sdxl');
}
// ===== เวอร์ชันเรียบ: ซีรีส์ → บท (AI เสนอ/สั่งแก้) → (ต่อไป: ตัวละคร LoRA → ซีน → ตอน) =====
const SCRIPT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'; // เปลี่ยนได้ที่ settings.script_model (ชื่อโมเดล Workers AI)
async function llmJson(env, s, user) {
  const out = await env.AI.run(s.script_model || SCRIPT_MODEL, { messages: [{ role: 'system', content: 'คุณเป็นนักเขียนบทอนิเมะ ตอบเป็นภาษาไทย และตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น' }, { role: 'user', content: user }], max_tokens: 2400 });
  let t = out && out.response; if (t && typeof t === 'object') t = JSON.stringify(t);
  t = String(t || '').replace(/```json|```/g, '');
  const a = t.search(/[\[{]/); if (a < 0) throw new Error('AI ไม่ได้ตอบเป็น JSON ลองใหม่อีกครั้ง');
  return JSON.parse(t.slice(a, t.lastIndexOf(t[a] === '[' ? ']' : '}') + 1));
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
  animeReady = true;
}
// เทรน LoRA ตัวละครอัตโนมัติ: ภาพอ้างอิงครบและไม่มีงานค้าง → เข้าคิวเทรนบน Kaggle (ใช้ภาพที่ติดดาว ถ้าเลือกไว้ ≥8 ภาพ ไม่งั้นใช้ทุกภาพ) · ปิดได้ที่ settings.auto_lora = 0
async function animeAuto(env, s) {
  if (s.auto_lora === '0') return;
  await animeSchema(env);
  const cs = (await env.DB.prepare("SELECT c.* FROM chars c WHERE c.series_id<>0 AND NOT EXISTS (SELECT 1 FROM loras l WHERE l.char_id=c.id AND l.status IN ('queued','ready','failed'))").all()).results;
  for (const c of cs) {
    const pj = charProj(c);
    if ((await env.DB.prepare("SELECT COUNT(*) n FROM jobs WHERE project=? AND status IN ('queued','running','kaggle')").bind(pj).first()).n) continue;
    const all = (await env.DB.prepare('SELECT id,scene,starred FROM images WHERE project=? ORDER BY id').bind(pj).all()).results;
    if (all.length < 12) continue;
    const st = all.filter(x => x.starred), use = (st.length >= 8 ? st : all).slice(0, 24), trig = 'chr' + c.id + 'x';
    const imgs = use.map(x => ({ id: x.id, cap: `${trig}, ${CHAR_VARS[((+x.scene || 1) - 1) % CHAR_VARS.length]}` }));
    const r = await env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,kind,opt) VALUES (?,'','lora','','','',0,'queued',0,?,'lora',?)").bind(pj, Date.now(), JSON.stringify({ char_id: c.id, trigger: trig, images: imgs })).run();
    await env.DB.prepare("INSERT INTO loras (char_id,vjob,status,created) VALUES (?,?,'queued',?)").bind(c.id, r.meta.last_row_id, Date.now()).run();
  }
}
// ตัวละครต่อซีรีส์: สร้างชุดภาพอ้างอิงหลายมุม/อารมณ์ (เข้าคิวภาพเดิม → โหมดอัตโนมัติเลือก SDXL ให้) ภาพที่ติดดาว = ชุดเทรน LoRA
const CHAR_VARS = ['front view, full body, standing, neutral expression', 'three-quarter view, upper body, smiling', 'side profile, upper body', 'back view, full body', 'close-up face, happy', 'close-up face, serious', 'close-up face, surprised', 'full body, walking', 'sitting on a chair, full body', 'running, dynamic pose, full body', 'looking up, upper body', 'waving at viewer, upper body', 'angry expression, upper body', 'sad expression, close-up face', 'laughing, upper body', 'arms crossed, full body, confident'];
const charProj = c => `ซีรีส์${c.series_id}·${c.name}`;
async function charRefs(env, cid, n) {
  const c = await env.DB.prepare('SELECT * FROM chars WHERE id=?').bind(cid).first(); if (!c) throw new Error('ไม่พบตัวละคร');
  const pj = charProj(c);
  const have = (await env.DB.prepare('SELECT (SELECT COUNT(*) FROM images WHERE project=?1)+(SELECT COUNT(*) FROM jobs WHERE project=?1 AND status<>\'failed\') n').bind(pj).first()).n || 0;
  const now = Date.now(), st = [];
  for (let i = 0; i < n; i++) st.push(env.DB.prepare("INSERT INTO jobs (project,scene,prompt,status,created,steps) VALUES (?,?,?,'queued',?,4)").bind(pj, have + i + 1, `${c.desc}, ${CHAR_VARS[(have + i) % CHAR_VARS.length]}, plain light background, same character design in every image, [[STYLE]]`.slice(0, 1800), now));
  await env.DB.batch(st);
  return { queued: n };
}

// ซีรีส์ 12 ตอน × 3 ซีน: เขียนบทซีน (ตอนละ ~5 นาที) จากโครงเรื่อง
async function epWrite(env, s, e) {
  const sr = await env.DB.prepare('SELECT * FROM series WHERE id=?').bind(e.series_id).first();
  const cs = (await env.DB.prepare('SELECT name,desc FROM chars WHERE series_id=?').bind(e.series_id).all()).results;
  const pv = await env.DB.prepare('SELECT logline FROM scenes WHERE series_id=? AND no=?').bind(e.series_id, e.no - 1).first();
  const nx = await env.DB.prepare('SELECT logline FROM scenes WHERE series_id=? AND no=?').bind(e.series_id, e.no + 1).first();
  const o0 = await llmJson(env, s, `ซีรีส์: ${sr ? sr.brief : ''}\nตัวละคร: ${cs.map(c => c.name + ' = ' + c.desc).join(' | ') || '-'}\nตอนที่ ${e.ep}/12 ซีนที่ ${e.sc}/3: ${e.title} — ${e.logline}\nซีนก่อนหน้า: ${pv ? pv.logline : '-'}\nซีนถัดไป: ${nx ? nx.logline : '-'}\nเขียนบทซีนนี้ (ยาวราว 5 นาที ตามโครงเรื่องของตอนนั้น ซีน 3 ซีนต่อเนื่องกันเป็น 1 ตอน 15 นาที) ตอบเป็น JSON object {"title":"ชื่อตอน","logline":"สรุป","beats":["เหตุการณ์ตามลำดับเวลา 6-10 ข้อ"]}`);
  const o = Array.isArray(o0) ? o0[0] : o0;
  if (!o || !Array.isArray(o.beats) || !o.beats.length) throw new Error('เขียนบทไม่สำเร็จ ลองใหม่');
  o.title = o.title || e.title;
  const r = await env.DB.prepare('INSERT INTO scripts (series_id,body,picked,created) VALUES (?,?,1,?)').bind(e.series_id, JSON.stringify(o).slice(0, 8000), Date.now()).run();
  await env.DB.prepare('UPDATE scenes SET script_id=?, sb=0 WHERE id=?').bind(r.meta.last_row_id, e.id).run();
  return r.meta.last_row_id;
}
// ช็อตสำคัญ (ฉากสู้/เคลื่อนไหว/ช็อตเปิดทุก 5 ช็อต) ทำเป็นวิดีโอ ที่เหลือใช้ภาพนิ่งซูมเลื่อน
const keyShot = (sh, i) => i % 5 === 0 || /fight|battle|chase|run|jump|attack|talisman|glow|explo|seal|spell|leap|punch/i.test(sh.en || '');
// ทำงานต่อเองทีละขั้นต่อรอบ cron: บท → ช็อต → ภาพคีย์ → วิดีโอ → รวมตอน (ทีละตอน เรียงตามลำดับ เพราะ GPU ฟรีมีจำกัด)
async function animeAdvance(env, s) {
  if (s.auto_anime === '0') return;
  await animeSchema(env);
  const e = (await env.DB.prepare('SELECT * FROM scenes WHERE auto=1 AND fin=0 ORDER BY series_id,no').all()).results.find(x => x.ep <= (+s['anime_ok_' + x.series_id] || 0) + 1); if (!e) return; // ทำทีละตอน: ตอนถัดไปเริ่มเมื่อผู้ใช้กดตรวจผ่านตอนก่อน
  if (!e.script_id) { await epWrite(env, s, e); return; }
  const sid = e.script_id;
  if (e.sb >= 0) { const r = await animeApi(env, { act: 'sb_beat', script_id: sid, beat: e.sb, minutes: 5 }); await env.DB.prepare('UPDATE scenes SET sb=? WHERE id=?').bind(r.next, e.id).run(); return; }
  const rows = (await env.DB.prepare('SELECT id,en,kproj FROM shots WHERE script_id=? ORDER BY idx').bind(sid).all()).results;
  const hasImg = (await env.DB.prepare('SELECT COUNT(DISTINCT project) n FROM images WHERE project LIKE ?').bind(`ฉาก${sid}·%`).first()).n;
  if (hasImg < rows.length) { await animeApi(env, { act: 'kf', script_id: sid }); return; }
  await animeApi(env, { act: 'vid', script_id: sid });
  for (const [i, sh] of rows.entries()) { if (!keyShot(sh, i)) continue; const v = await env.DB.prepare('SELECT MAX(id) id FROM videos WHERE ep=? AND shot=?').bind('a' + sid, String(sh.id)).first(); if (!v || !v.id) return; }
  await env.DB.prepare('UPDATE scenes SET fin=1 WHERE id=?').bind(e.id).run();
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
    const cs = (await env.DB.prepare('SELECT name,desc FROM chars WHERE series_id=?').bind(sc.series_id).all()).results;
    const total = 12 * Math.min(15, Math.max(1, +b.minutes || 5)), N = Math.min(10, Math.max(2, Math.ceil(total / beats.length)));
    const arr = await llmJson(env, s, `ซีรีส์: ${sr ? sr.brief : ''}\nตัวละคร: ${cs.map(c => c.name + ' = ' + c.desc).join(' | ') || '-'}\nชื่อซีน: ${o.title || ''}\nเหตุการณ์ที่ ${bi + 1}/${beats.length}: ${beats[bi]}\nเขียน ${N} ช็อตต่อเนื่องของเหตุการณ์นี้ (ช็อตละราว 5 วินาที ระบุมุมกล้องและการกระทำ) ตอบเป็น JSON array ของ {"th":"คำอธิบายช็อตภาษาไทยสั้นๆ","en":"English image prompt: setting, action, camera angle (no character names, no hair/clothes details)","chars":["ชื่อตัวละครที่อยู่ในช็อต"]}`);
    const list = (Array.isArray(arr) ? arr : [arr]).slice(0, N);
    const base = (await env.DB.prepare('SELECT COUNT(*) n FROM shots WHERE script_id=?').bind(sc.id).first()).n;
    await env.DB.batch(list.map((x, i) => env.DB.prepare('INSERT INTO shots (script_id,idx,beat,th,en,chars,kproj,created) VALUES (?,?,?,?,?,?,?,?)').bind(sc.id, base + i + 1, bi, String(x.th || '').slice(0, 300), String(x.en || '').slice(0, 600), JSON.stringify(Array.isArray(x.chars) ? x.chars : []), `ฉาก${sc.id}·${base + i + 1}`, Date.now())));
    return { next: bi + 1 < beats.length ? bi + 1 : -1, added: list.length };
  }
  if (act === 'sb_edit') {
    const sh = await env.DB.prepare('SELECT * FROM shots WHERE id=?').bind(+b.id).first(); if (!sh) throw new Error('ไม่พบช็อต');
    const cmd = String(b.command || '').trim().slice(0, 400); if (!cmd) throw new Error('พิมพ์คำสั่งแก้ก่อน');
    const o = await llmJson(env, s, `ช็อตปัจจุบัน: ${JSON.stringify({ th: sh.th, en: sh.en, chars: JSON.parse(sh.chars || '[]') })}\nคำสั่งแก้: ${cmd}\nแก้ช็อตตามคำสั่ง ตอบเป็น JSON object {"th":"...","en":"English image prompt","chars":["..."]}`);
    await env.DB.prepare('UPDATE shots SET th=?, en=?, chars=? WHERE id=?').bind(String(o.th || sh.th).slice(0, 300), String(o.en || sh.en).slice(0, 600), JSON.stringify(Array.isArray(o.chars) ? o.chars : JSON.parse(sh.chars || '[]')), sh.id).run();
    return { ok: true };
  }
  if (act === 'kf') { // สร้างภาพคีย์ (SDXL + LoRA ตัวละครที่ติ๊กใช้) · ไม่ส่ง ids = ทำเฉพาะช็อตที่ยังไม่มีภาพ
    const sc = await env.DB.prepare('SELECT series_id FROM scripts WHERE id=?').bind(+b.script_id).first(); if (!sc) throw new Error('ไม่พบบท');
    const rows = (await env.DB.prepare('SELECT * FROM shots WHERE script_id=? ORDER BY idx').bind(+b.script_id).all()).results;
    const only = Array.isArray(b.ids) ? new Set(b.ids.map(Number)) : null;
    const lc = (await env.DB.prepare("SELECT c.id cid,c.name,l.id lid FROM chars c JOIN loras l ON l.char_id=c.id AND l.status='ready' AND l.use=1 WHERE c.series_id=? OR c.series_id=0").bind(sc.series_id).all()).results;
    const hv = new Set((await env.DB.prepare('SELECT DISTINCT project FROM images WHERE project LIKE ?').bind(`ฉาก${+b.script_id}·%`).all()).results.map(x => x.project));
    const pd = new Set((await env.DB.prepare("SELECT DISTINCT project FROM jobs WHERE project LIKE ? AND status IN ('queued','running','kaggle')").bind(`ฉาก${+b.script_id}·%`).all()).results.map(x => x.project));
    const st = []; let n = 0;
    for (const sh of rows) {
      if (only ? !only.has(sh.id) : (hv.has(sh.kproj) || pd.has(sh.kproj))) continue;
      let names = []; try { names = JSON.parse(sh.chars || '[]'); } catch { names = []; }
      const m = lc.filter(c => names.includes(c.name));
      st.push(env.DB.prepare('UPDATE shots SET loras=? WHERE id=?').bind(JSON.stringify(m.map(c => ({ id: c.lid, w: 0.8 }))), sh.id));
      st.push(env.DB.prepare("INSERT INTO jobs (project,scene,prompt,status,created,steps) VALUES (?,1,?,'queued',?,4)").bind(sh.kproj, `${m.map(c => 'chr' + c.cid + 'x').join(', ')}${m.length ? ', ' : ''}${sh.en}, [[STYLE]]`.slice(0, 1800), Date.now()));
      n++;
    }
    if (st.length) await env.DB.batch(st);
    return { queued: n };
  }
  if (act === 'shots') {
    const like = `ฉาก${+b.script_id}·%`;
    const rows = (await env.DB.prepare('SELECT id,idx,beat,th,chars FROM shots WHERE script_id=? ORDER BY idx').bind(+b.script_id).all()).results;
    const im = {}, pd = {};
    for (const x of (await env.DB.prepare('SELECT project, MAX(id) id FROM images WHERE project LIKE ? GROUP BY project').bind(like).all()).results) im[x.project] = x.id;
    for (const x of (await env.DB.prepare("SELECT project, COUNT(*) n FROM jobs WHERE project LIKE ? AND status IN ('queued','running','kaggle') GROUP BY project").bind(like).all()).results) pd[x.project] = x.n;
    const vv = {}, vj = {};
    for (const x of (await env.DB.prepare('SELECT shot, MAX(id) id FROM videos WHERE ep=? GROUP BY shot').bind('a' + (+b.script_id)).all()).results) vv[x.shot] = x.id;
    for (const x of (await env.DB.prepare("SELECT shot, COUNT(*) n FROM vjobs WHERE ep=? AND status IN ('queued','running') GROUP BY shot").bind('a' + (+b.script_id)).all()).results) vj[x.shot] = x.n;
    return { shots: rows.map(r => ({ ...r, img: im[`ฉาก${+b.script_id}·${r.idx}`] || 0, pending: pd[`ฉาก${+b.script_id}·${r.idx}`] || 0, vid: vv[String(r.id)] || 0, vpend: vj[String(r.id)] || 0 })) };
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
      e.img = (await env.DB.prepare('SELECT COUNT(DISTINCT project) n FROM images WHERE project LIKE ?').bind(`ฉาก${e.script_id}·%`).first()).n;
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
    const rows = (await env.DB.prepare('SELECT id,en,kproj FROM shots WHERE script_id=? ORDER BY idx').bind(sid).all()).results;
    const have = new Set([...(await env.DB.prepare("SELECT DISTINCT shot FROM videos WHERE ep=?").bind(ep).all()).results, ...(await env.DB.prepare("SELECT shot FROM vjobs WHERE ep=? AND status IN ('queued','running')").bind(ep).all()).results].map(x => String(x.shot)));
    let n = 0;
    for (const [i, sh] of rows.entries()) {
      if (n >= 6) break; if (!keyShot(sh, i) || have.has(String(sh.id))) continue;
      const im = await env.DB.prepare('SELECT data FROM images WHERE project=? ORDER BY id DESC LIMIT 1').bind(sh.kproj).first(); if (!im || !im.data) continue;
      await env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,opt) VALUES (?,?,?,?,?,?,?,'queued',0,?,?)").bind('อนิเมะ·' + sid, ep, String(sh.id), `anime style, ${sh.en}, smooth natural motion, consistent face and outfit, no morphing`.slice(0, 600), VNEG, im.data, vFrames(5), Date.now(), JSON.stringify({ hq: 0, fps: 12 })).run();
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
  if (now < (+s.k_pause || 0)) return false; // โควตา GPU Kaggle สัปดาห์นี้หมด → ให้ Flux ทำไปก่อน
  return true;
}
async function bridgeImg(env, s) {
  const rows = (await env.DB.prepare("SELECT id,project,scene,prompt,steps,seed FROM jobs WHERE status='queued' AND COALESCE(eng,'')<>'flux' ORDER BY id LIMIT 40").all()).results;
  if (!rows.length) return 0;
  const st = [], now = Date.now();
  for (const j of rows) {
    let lo = [];
    if (String(j.project).startsWith('ฉาก')) { const sh = await env.DB.prepare('SELECT loras FROM shots WHERE kproj=?').bind(j.project).first().catch(() => null); try { lo = JSON.parse((sh && sh.loras) || '[]'); } catch { lo = []; } }
    const eg = lo.length ? 'sdxl' : imgEngineFor(j, s), hi = (+j.steps || 4) >= 8;
    const opt = { jobId: j.id, scene: j.scene, engine: eg, steps: eg === 'sdxl' ? (hi ? 34 : 26) : (hi ? 28 : 24), seed: +j.seed || 0, w: +s.img_w || 1024, h: +s.img_h || 1024, model: s.img_model || '', quant: s.img_quant || '', loras: lo };
    st.push(env.DB.prepare("INSERT INTO vjobs (project,ep,shot,prompt,neg,image,frames,status,tries,created,kind,opt) VALUES (?,?,?,?,'','',0,'queued',0,?,'img',?)")
      .bind(j.project, '', String(j.scene), withStyle(j.prompt, s).slice(0, 1800), now, JSON.stringify(opt)));
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
  await animeAuto(env, s).catch(() => {});
  await animeAdvance(env, s).catch(() => {});
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
    if (now - +s.last_run < (+s.interval_min || 1) * 60000 - 15000) return { skipped: 'wait' };
    const sl = await slotCheck(env, s, now); // แบ่งทำเป็นช่วงเวลา แต่ละช่วงมีโควตาของตัวเอง
    if (sl.full) return { skipped: 'slot full' };
    if (now - +s.last_run > 180000) await env.DB.prepare("UPDATE jobs SET status='queued' WHERE status='running'").run();
  }
  const job = await env.DB.prepare("SELECT * FROM jobs WHERE status='queued' AND (?=0 OR eng='flux') ORDER BY id LIMIT 1").bind(useK ? 1 : 0).first();
  if (!job) { if (s.auto_fill === '1' && !force && !useK) { await autoFill(env, s); return { skipped: 'empty', filled: true }; } return { skipped: 'empty' }; }
  await setSetting(env, 'last_run', String(now));
  await env.DB.prepare("UPDATE jobs SET status='running' WHERE id=?").bind(job.id).run();
  try {
    const out = await genImage(env, s, withStyle(job.prompt, s).slice(0, 2048), Math.min(8, Math.max(1, +job.steps || +s.steps || 4)), +job.seed || 0);
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
      const j = await env.DB.prepare("UPDATE vjobs SET status='running', started=?, tries=tries+1, helper=? WHERE id=(SELECT id FROM vjobs WHERE status='queued' ORDER BY (kind='img'), CASE WHEN kind='img' THEN COALESCE(json_extract(opt,'$.engine'),'') END, id LIMIT 1) AND status='queued' RETURNING id,project,ep,shot,prompt,neg,frames,kind,opt").bind(Date.now(), hid).first();
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
    if (p.startsWith('/k/limg/')) { // รูปในชุดเทรน LoRA ให้เครื่อง Kaggle ดึง
      await animeSchema(env);
      const j = await env.DB.prepare('SELECT opt FROM vjobs WHERE id=? AND kind=\'lora\'').bind(id).first(); let o = {}; try { o = JSON.parse((j && j.opt) || '{}'); } catch { o = {}; }
      const iid = +p.split('/')[4];
      if (!j || !(o.images || []).some(x => x.id === iid)) return new Response('not found', { status: 404 });
      const r = await env.DB.prepare('SELECT data FROM images WHERE id=?').bind(iid).first();
      return r ? new Response(b64ToBytes(r.data), { headers: { 'content-type': 'image/jpeg' } }) : new Response('not found', { status: 404 });
    }
    if (p.startsWith('/k/lora/')) { // รับไฟล์ LoRA ที่เทรนเสร็จ → เก็บเป็นก้อนใน D1 (ฟรี ไม่ต้องใช้ที่เก็บเพิ่ม)
      await animeSchema(env);
      const l = await env.DB.prepare('SELECT id FROM loras WHERE vjob=?').bind(id).first();
      const buf = new Uint8Array(await req.arrayBuffer());
      if (!l) return json({ error: 'no lora' }, 404);
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
      const rows = (await env.DB.prepare('SELECT data FROM lchunks WHERE lid=? ORDER BY idx').bind(id).all()).results;
      if (!rows.length) return new Response('not found', { status: 404 });
      const parts = rows.map(r => b64ToBytes(r.data)); const out = new Uint8Array(parts.reduce((a, x) => a + x.length, 0)); let o = 0; for (const x of parts) { out.set(x, o); o += x.length; }
      return new Response(out, { headers: { 'content-type': 'application/octet-stream' } });
    }
    if (p.startsWith('/k/done/')) {
      const j = await env.DB.prepare('SELECT * FROM vjobs WHERE id=?').bind(id).first();
      if (!j) return json({ error: 'no job' }, 404);
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
      await env.DB.batch(st);
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
      const again = b.requeue || j.tries < 2;
      await env.DB.prepare('UPDATE vjobs SET status=?, error=? WHERE id=?').bind(again ? 'queued' : 'failed', String(b.error || '').slice(0, 500), id).run();
      if (j.kind === 'lora' && !again) await env.DB.prepare("UPDATE loras SET status='failed', error=? WHERE vjob=?").bind(String(b.error || '').slice(0, 300), id).run().catch(() => {});
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

async function vvSig(env, id) {
  const s = await getSettings(env);
  let kt = s.ktoken;
  if (!kt) { kt = crypto.randomUUID().replace(/-/g, ''); await setSetting(env, 'ktoken', kt); }
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(kt + ':vv:' + id));
  return [...new Uint8Array(h)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
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
    crf = 18 if passes == 1 else 22  # ช็อตยาวบีบไฟล์มากขึ้น (คลิปเก็บใน D1 ที่พื้นที่ฟรีจำกัด)
    vf = "scale='if(gt(iw,ih),-2,1080)':'if(gt(iw,ih),1080,-2)':flags=lanczos,unsharp=5:5:0.6:5:5:0.0"
    if opt.get("fps") == 12:
        vf = "fps=12," + vf  # ลุคอนิเมะ: 12 ภาพ/วิ แบบวาดมือ
    sh('"%s" -y -loglevel error -framerate %d -i "%s/%%05d.png" -vf "%s" -c:v libx264 -preset veryfast -crf %d -pix_fmt yuv420p -movflags +faststart "%s"' % (ffmpeg_bin(), fps, tmp, vf, crf, mp4))
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


# ---------- ภาพอนิเมะ: 2 เอนจิน สลับได้ต่องาน (opt.engine) ----------
#   sdxl = SDXL อนิเมะ (Animagine XL 4.0) · dev = FLUX.1-dev (GGUF)
# ตั้งเองได้ที่ settings.img_model = repo::ไฟล์ (.safetensors → SDXL · .gguf → FLUX) · settings.img_quant = quant ของ FLUX (ค่าเริ่มต้น Q5_K_S)
IMG_MODELS = [
    ("cagliostrolab/animagine-xl-4.0", "animagine-xl-4.0-opt.safetensors"),
    ("cagliostrolab/animagine-xl-4.0", "animagine-xl-4.0.safetensors"),
]
IMG_POS = "masterpiece, high score, great score, absurdres, "
IMG_NEG = "lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, low quality, low score, bad score, average score, signature, watermark, username, blurry"
IMG_QUANTS = ["Q5_K_S", "Q4_K_S", "Q4_0", "Q8_0"]
FLUX_REPO = "city96/FLUX.1-dev-gguf"
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


def ensure_flux(model_spec="", quant=""):
    if M.get("flux"):
        return
    log("กำลังโหลดโมเดลภาพ FLUX.1-dev (ครั้งแรกประมาณ 5–10 นาที)")
    cands = []
    if model_spec and "::" in model_spec and model_spec.strip().lower().endswith(".gguf"):
        r, f = model_spec.split("::", 1)
        cands.append((r.strip(), f.strip()))
    qs = ([quant] if quant else []) + [x for x in IMG_QUANTS if x != quant]
    cands += [(FLUX_REPO, "flux1-dev-%s.gguf" % x) for x in qs]
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
    M["flux"] = got
    log("โมเดลภาพ FLUX.1-dev พร้อม: " + got)


def ensure_image(engine="dev", model_spec="", quant=""):
    with LOCK:
        if engine == "sdxl":
            ensure_sdxl(model_spec)
        else:
            ensure_flux(model_spec, quant)


def ensure_lora(lid):
    fn = "lora%s.safetensors" % lid
    dst = os.path.join(COMFY, "models", "loras", fn)
    if not os.path.exists(dst) or os.path.getsize(dst) < 100000:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        open(dst, "wb").write(call("/k/lget/%s" % lid, timeout=600))
    return fn


def gen_image(j, port=8188):
    opt = j.get("opt") or {}
    engine = "sdxl" if opt.get("engine") == "sdxl" else "dev"
    ensure_image(engine, opt.get("model") or "", opt.get("quant") or "")
    q = 8 if engine == "sdxl" else 16
    W = max(512, min(1536, int(opt.get("w") or 1024))) // q * q
    H = max(512, min(1536, int(opt.get("h") or 1024))) // q * q
    if engine == "sdxl":
        steps = max(10, min(50, int(opt.get("steps") or 26)))
    else:
        steps = max(16, min(30, int(opt.get("steps") or 24)))
    seed = int(opt.get("seed") or 0) or random.randint(1, 2 ** 31)
    jid = "i%s" % j["id"]
    if engine == "sdxl":
        wf = {
            "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": M["sdxl"]}},
            "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": IMG_POS + (j.get("prompt") or "")}},
            "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": IMG_NEG}},
            "4": {"class_type": "EmptyLatentImage", "inputs": {"width": W, "height": H, "batch_size": 1}},
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
    else:
        wf = {
            "1": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": M["flux"]}},
            "2": {"class_type": "DualCLIPLoader", "inputs": {"clip_name1": "t5xxl_fp8_e4m3fn.safetensors", "clip_name2": "clip_l.safetensors", "type": "flux"}},
            "3": {"class_type": "VAELoader", "inputs": {"vae_name": M["fluxvae"]}},
            "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": (j.get("prompt") or "")}},
            "5": {"class_type": "FluxGuidance", "inputs": {"conditioning": ["4", 0], "guidance": float(opt.get("guidance") or FLUX_GUIDANCE)}},
            "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": ""}},
            "7": {"class_type": "EmptySD3LatentImage", "inputs": {"width": W, "height": H, "batch_size": 1}},
            "8": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "seed": seed, "steps": steps, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0], "denoise": 1.0}},
            "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["3", 0]}},
            "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "img%s" % jid}},
        }
    t0 = time.time()
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
        if time.time() - t0 > 900:
            raise RuntimeError("เจนภาพนานเกิน 15 นาที")
    outs = sorted(glob.glob(os.path.join(COMFY, "output", "**", "img%s_*" % jid), recursive=True))
    if not outs:
        raise RuntimeError("ไม่มีไฟล์ภาพออกมา")
    from PIL import Image
    im = Image.open(outs[-1]).convert("RGB")
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
        keep = []
        for ln in open(KV + "/requirements.txt").read().splitlines():
            t = ln.strip()
            if t and not t.startswith(("#", "-e", "torch", "xformers")):
                keep.append(t)
        open("/tmp/kreq.txt", "w").write("\n".join(keep) + "\naccelerate\nbitsandbytes\n")
        sh(KV + "/venv/bin/pip install -q -r /tmp/kreq.txt")
        M["kohya"] = True


def train_lora(job, port):
    opt = job.get("opt") or {}
    imgs = opt.get("images") or []
    if len(imgs) < 8:
        raise RuntimeError("ภาพสำหรับเทรนน้อยกว่า 8 ภาพ")
    ensure_image("sdxl", "", "")
    ensure_kohya()
    trig = opt.get("trigger") or "chr"
    d = os.path.join(ROOT, "lora%s" % job["id"])
    data = os.path.join(d, "data", "10_" + trig)
    out = os.path.join(d, "out")
    os.makedirs(data, exist_ok=True)
    os.makedirs(out, exist_ok=True)
    for i, it in enumerate(imgs):
        open(os.path.join(data, "%03d.jpg" % i), "wb").write(call("/k/limg/%s/%s" % (job["id"], it["id"])))
        open(os.path.join(data, "%03d.txt" % i), "w").write(it.get("cap") or trig)
    if port:
        try:
            comfy("/free", {"unload_models": True, "free_memory": True}, port=port)
        except Exception:
            pass
    steps = max(600, min(1500, len(imgs) * 60))
    ckpt = os.path.join(COMFY, "models", "checkpoints", M["sdxl"])
    vae = os.path.join(COMFY, "models", "vae", M["sdxlvae"]) if M.get("sdxlvae") else ""
    cmd = ('CUDA_VISIBLE_DEVICES=%d "%s/venv/bin/python" "%s/sdxl_train_network.py" --pretrained_model_name_or_path "%s" %s'
           ' --train_data_dir "%s" --output_dir "%s" --output_name lora --caption_extension .txt'
           ' --network_module networks.lora --network_dim 8 --network_alpha 4 --network_train_unet_only'
           ' --resolution 768,768 --enable_bucket --train_batch_size 1 --max_train_steps %d'
           ' --learning_rate 1e-4 --lr_scheduler cosine --lr_warmup_steps 50 --optimizer_type AdamW8bit'
           ' --mixed_precision fp16 --save_precision fp16 --gradient_checkpointing --cache_latents --sdpa --no_half_vae --seed 1'
           % (max(0, (port or 8188) - 8188), KV, KV, ckpt, ('--vae "%s"' % vae) if vae else "", os.path.join(d, "data"), out, steps))
    log("เริ่มเทรน LoRA %s (%d ภาพ · %d สเต็ป)" % (trig, len(imgs), steps))
    t0 = time.time()
    sh(cmd)
    f = os.path.join(out, "lora.safetensors")
    if not os.path.exists(f):
        raise RuntimeError("เทรนจบแต่ไม่พบไฟล์ LoRA")
    call("/k/lora/%s" % job["id"], raw=open(f, "rb").read(), timeout=900)
    shutil.rmtree(d, ignore_errors=True)
    dummy = os.path.join(ROOT, "lora_done_%s.bin" % job["id"])
    open(dummy, "wb").write(b"0" * 2048)
    return dummy, time.time() - t0, 0, 0


def work(job, port):
    if job.get("kind") == "lora":
        return train_lora(job, port)
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


def claim_wait(stat):
    # การ์ดว่าง: รองานใหม่ระหว่างที่การ์ดอื่นยังทำงานอยู่ (สูงสุด 15 นาที) แทนที่จะปิดทิ้ง ให้ใช้การ์ดคู่ได้เต็ม
    job = J("/k/claim").get("job")
    waited = 0
    while not job and waited < 900 and stat.get("busy", 0) > 0 and time.time() - T0 < MAXH * 3600:
        time.sleep(45)
        waited += 45
        job = J("/k/claim").get("job")
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
            if port and healed != job["id"]:  # ซ่อมแล้วลองใหม่ในเครื่องก่อน 1 ครั้ง
                healed = job["id"]
                heal(port, str(e))
                stat["busy"] -= 1
                continue
            try:
                J("/k/fail/%s" % job["id"], {"error": str(e)[:500]})
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
        job = claim_wait(stat) if port else J("/k/claim").get("job")


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
