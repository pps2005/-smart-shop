/* ============================================================
   crm.js — ลูกค้า/งาน (CRM) ตั้งแต่หาลูกค้าจนรับเงิน
   ลูกค้า (หา → ทัก → สนใจ → ทดลอง → ปิดการขาย) · บันทึกการคุย · ร่างข้อความพร้อมส่ง LINE
   งาน (เสนอราคา → กำลังทำ → ส่งงาน) · ใบแจ้งหนี้ + QR พร้อมเพย์ · กด "รับเงินแล้ว" → ลงรายรับ (incomes) อัตโนมัติ
   ต้องรัน crm.sql ใน Supabase ก่อน 1 ครั้ง · ลำดับโหลด: ต่อท้าย index.html (หลังไฟล์อื่น)
   ============================================================ */
(function () {
  'use strict';
  if (typeof M === 'undefined') return;
  if (!M.some(function (m) { return m.id === 'crm'; })) {
    var ri = M.findIndex(function (m) { return m.id === 'rent'; });
    M.splice(ri < 0 ? M.length : ri + 1, 0, { id: 'crm', i: 'chat', t: 'ลูกค้า/งาน' });
  }
  var STAGE = { lead: ['รายชื่อ', '#64748b'], contacted: ['ทักแล้ว', '#2563eb'], interested: ['สนใจ', '#7c3aed'], trial: ['ทดลองใช้', '#d97706'], won: ['ลูกค้า', '#16a34a'], lost: ['ไม่สนใจ', '#94a3b8'] };
  var JST = { quote: ['เสนอราคา', '#64748b'], doing: ['กำลังทำ', '#2563eb'], delivered: ['ส่งงานแล้ว', '#7c3aed'], invoiced: ['รอเก็บเงิน', '#d97706'], paid: ['จ่ายแล้ว', '#16a34a'], cancelled: ['ยกเลิก', '#94a3b8'] };
  var KIND = { saas: 'ค่าสมาชิกระบบ', web: 'ทำเว็บ/ระบบ', other: 'อื่น ๆ' };
  var LOGK = { note: '📝 โน้ต', line: '💬 LINE', call: '📞 โทร', meet: '🤝 เจอกัน', email: '✉️ อีเมล' };
  var C = { tab: 'home', loaded: false, err: '', missing: false, cl: [], jobs: [], inv: [], logs: [], set: {}, q: '', sf: 'open' };

  var css = document.createElement('style');
  css.textContent = [
    '.crt{display:flex;gap:6px;overflow-x:auto;margin:4px 0 12px;scrollbar-width:none}.crt button{flex:0 0 auto;padding:9px 14px;border-radius:12px;border:1px solid var(--line);font-weight:700}.crt button.on{background:var(--pri);color:#fff;border-color:var(--pri)}',
    '.crk{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px}.crk div{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}.crk b{display:block;font-size:1.35rem}.crk small{color:var(--mute)}',
    '.crp{display:flex;gap:4px;margin-bottom:10px}.crp div{flex:1;text-align:center;border-radius:10px;padding:8px 2px;color:#fff;font-size:.78rem}.crp b{display:block;font-size:1.15rem}',
    '.crr{display:block;width:100%;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:8px}.crr .t{display:flex;justify-content:space-between;gap:8px;align-items:center}.crr small{color:var(--mute)}',
    '.crb{display:inline-block;color:#fff;border-radius:99px;padding:3px 10px;font-size:.75rem;font-weight:700;white-space:nowrap}',
    '.crf label{display:block;margin:10px 0 4px;font-size:.9rem;color:var(--mute)}.crf input,.crf select,.crf textarea{width:100%;padding:11px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--text);font:inherit;font-size:16px}.crf textarea{min-height:80px}',
    '.crs{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.crs button{padding:8px 12px;border-radius:10px;border:1px solid var(--line);font-size:.88rem}.crs button.on{color:#fff}',
    '.crl{border-left:3px solid var(--line);padding:4px 10px;margin:6px 0;font-size:.92rem;white-space:pre-wrap}.crl small{display:block;color:var(--mute)}',
    '.crmsg{background:var(--bg);border:1px dashed var(--line);border-radius:12px;padding:12px;white-space:pre-wrap;font-size:.95rem;line-height:1.6;margin:8px 0}',
    '.crbtns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.crbtns .btn{flex:1}',
    '.crinv{background:#fff;color:#111;border-radius:14px;padding:16px;border:1px solid #e5e7eb}.crinv h2{margin:0 0 4px}.crinv table{width:100%;border-collapse:collapse;margin:10px 0}.crinv td{padding:6px 0;border-bottom:1px solid #eee}.crinv .tot{font-size:1.4rem;font-weight:800;text-align:right}.crinv img{display:block;margin:8px auto;width:200px;height:200px;image-rendering:pixelated}',
    '.crwarn{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;border-radius:14px;padding:14px;line-height:1.6}'
  ].join('');
  document.head.appendChild(css);

  function E(s) { return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function B(n) { return '฿' + Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 }); }
  function td() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
  function addDays(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function thd(d) { if (!d) return '-'; var x = new Date(d + 'T00:00:00'); return x.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); }
  function badge(m, k) { var s = m[k] || ['-', '#94a3b8']; return '<span class="crb" style="background:' + s[1] + '">' + s[0] + '</span>'; }
  function cl(id) { return C.cl.find(function (c) { return c.id === id; }); }
  function sheet(t, h) { openSheet((typeof head === 'function' ? head(E(t)) : '<h3>' + E(t) + '</h3>') + h); }

  /* ---------- ข้อมูล ---------- */
  async function load() {
    if (!S.sb) return;
    C.err = '';
    try {
      var r = await Promise.all([
        S.sb.from('clients').select('*').eq('archived', false).order('created_at', { ascending: false }),
        S.sb.from('jobs').select('*').order('created_at', { ascending: false }),
        S.sb.from('invoices').select('*').order('created_at', { ascending: false }),
        S.sb.from('biz_settings').select('*').maybeSingle()
      ]);
      for (var i = 0; i < r.length; i++) if (r[i].error) throw r[i].error;
      C.cl = r[0].data || []; C.jobs = r[1].data || []; C.inv = r[2].data || []; C.set = r[3].data || {};
      C.missing = false; C.loaded = true;
    } catch (e) {
      var m = String(e.message || e);
      C.missing = /does not exist|schema cache|PGRST205|42P01/i.test(m + (e.code || ''));
      C.err = C.missing ? '' : 'โหลดข้อมูลไม่สำเร็จ: ' + m; C.loaded = true;
    }
    if (S.cur === 'crm') page();
  }
  function fail(r) { if (r && r.error) { toast('บันทึกไม่สำเร็จ: ' + r.error.message); return true; } return false; }

  /* ---------- หน้า ---------- */
  function page() {
    var v = $('view'); if (!v) return;
    if (!C.loaded) { v.innerHTML = '<h2>ลูกค้า/งาน</h2><div class="empty">กำลังโหลด...</div>'; load(); return; }
    if (C.missing) { v.innerHTML = '<h2>ลูกค้า/งาน</h2><div class="crwarn">⚙️ <b>ยังไม่ได้ติดตั้งตาราง CRM</b><br>เปิด Supabase › SQL Editor › New query › วางเนื้อหาไฟล์ <b>crm.sql</b> › กด Run<br>เสร็จแล้วกลับมากดปุ่มด้านล่าง</div><div class="crbtns"><button class="btn" data-a="crmre">โหลดใหม่</button></div>'; return; }
    var tabs = [['home', '🏠 ภาพรวม'], ['cl', '👥 ลูกค้า'], ['job', '🧰 งาน'], ['inv', '🧾 ใบแจ้งหนี้'], ['set', '⚙️ ตั้งค่า']];
    var h = '<h2>ลูกค้า/งาน</h2>' + (C.err ? '<div class="crwarn">' + E(C.err) + '</div>' : '') +
      '<div class="crt">' + tabs.map(function (t) { return '<button class="' + (C.tab === t[0] ? 'on' : '') + '" data-a="crmtab" data-v="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    h += ({ home: home, cl: clients, job: jobsPage, inv: invPage, set: setPage }[C.tab] || home)();
    v.innerHTML = h;
  }
  function yearPaid(y) { return C.inv.filter(function (i) { return i.status === 'paid' && String(i.paid_on || '').slice(0, 4) === String(y); }); }
  function home() {
    var t = td(), due = C.cl.filter(function (c) { return c.next_on && c.next_on <= t && c.stage !== 'lost'; });
    var open = C.inv.filter(function (i) { return i.status === 'sent'; }), late = open.filter(function (i) { return i.due_on && i.due_on < t; });
    var mo = t.slice(0, 7), mPaid = C.inv.filter(function (i) { return i.status === 'paid' && String(i.paid_on || '').slice(0, 7) === mo; });
    var sum = function (a) { return a.reduce(function (s, i) { return s + Number(i.amount); }, 0); };
    var y = t.slice(0, 4), yp = yearPaid(y), byK = {};
    yp.forEach(function (i) { var j = C.jobs.find(function (x) { return x.id === i.job_id; }), k = j ? j.kind : 'other'; byK[k] = (byK[k] || 0) + Number(i.amount); });
    var h = '<div class="crp">' + ['lead', 'contacted', 'interested', 'trial', 'won'].map(function (k) { return '<div style="background:' + STAGE[k][1] + '"><b>' + C.cl.filter(function (c) { return c.stage === k; }).length + '</b>' + STAGE[k][0] + '</div>'; }).join('') + '</div>';
    h += '<div class="crk"><div><small>รับเงินเดือนนี้</small><b style="color:#16a34a">' + B(sum(mPaid)) + '</b></div><div><small>รอเก็บเงิน</small><b style="color:#d97706">' + B(sum(open)) + '</b><small>' + open.length + ' ใบ' + (late.length ? ' · เลยกำหนด ' + late.length : '') + '</small></div></div>';
    h += '<div class="card"><h3>📌 ต้องตามวันนี้ (' + due.length + ')</h3>' + (due.length ? due.map(rowCl).join('') : '<div class="empty" style="padding:10px">ไม่มีคนที่ต้องตามวันนี้ 🎉</div>') + '</div>';
    if (late.length) h += '<div class="card"><h3>⏰ ใบแจ้งหนี้เลยกำหนด</h3>' + late.map(rowInv).join('') + '</div>';
    h += '<div class="card"><h3>📊 รายรับงานบริการ ปี ' + (Number(y) + 543) + '</h3>' + Object.keys(KIND).map(function (k) { return '<div class="kv"><span>' + KIND[k] + '</span><b>' + B(byK[k] || 0) + '</b></div>'; }).join('') +
      '<div class="kv"><span><b>รวม</b></span><b>' + B(sum(yp)) + '</b></div><small style="color:var(--mute)">ลงในหน้าบัญชีเป็น "รายรับอื่น" แล้ว · หน้าภาษียังไม่ได้รวมยอดนี้ ควรให้นักบัญชีช่วยดูประเภทเงินได้ก่อนยื่น</small></div>';
    h += '<div class="crbtns"><button class="btn" data-a="crmnewcl">+ เพิ่มลูกค้า</button><button class="btn o" data-a="crmtab" data-v="cl">ดูลูกค้าทั้งหมด</button></div>';
    return h;
  }
  function rowCl(c) {
    var j = C.jobs.filter(function (x) { return x.client_id === c.id && x.status !== 'cancelled'; }).length;
    return '<button class="crr" data-a="crmcl" data-v="' + c.id + '"><div class="t"><b>' + E(c.name) + '</b>' + badge(STAGE, c.stage) + '</div><small>' + E(c.contact || '') + (c.source ? ' · จาก ' + E(c.source) : '') + (j ? ' · งาน ' + j : '') + (c.next_on ? ' · ตามต่อ ' + thd(c.next_on) : '') + '</small></button>';
  }
  function clients() {
    var q = C.q.trim(), L = C.cl.filter(function (c) { return (C.sf === 'all' || (C.sf === 'open' ? c.stage !== 'lost' && c.stage !== 'won' : c.stage === C.sf)) && (!q || (c.name + ' ' + (c.contact || '')).indexOf(q) >= 0); });
    var f = [['open', 'กำลังคุย'], ['won', 'ลูกค้า'], ['lost', 'ไม่สนใจ'], ['all', 'ทั้งหมด']];
    return '<div class="crf"><input id="crmq" placeholder="🔍 ค้นหาชื่อ/เบอร์/LINE" value="' + E(C.q) + '"></div><div class="crs">' + f.map(function (x) { return '<button class="' + (C.sf === x[0] ? 'on' : '') + '" style="' + (C.sf === x[0] ? 'background:var(--pri)' : '') + '" data-a="crmsf" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      (L.length ? L.map(rowCl).join('') : '<div class="empty">ยังไม่มีลูกค้า</div>') + '<div class="crbtns"><button class="btn" data-a="crmnewcl">+ เพิ่มลูกค้า</button></div>';
  }
  function rowJob(j) { var c = cl(j.client_id); return '<button class="crr" data-a="crmjob" data-v="' + j.id + '"><div class="t"><b>' + E(j.title) + '</b>' + badge(JST, j.status) + '</div><small>' + E(c ? c.name : '-') + ' · ' + KIND[j.kind] + ' · ' + B(j.price) + (j.due_on ? ' · ส่ง ' + thd(j.due_on) : '') + '</small></button>'; }
  function jobsPage() { var L = C.jobs.filter(function (j) { return j.status !== 'cancelled' && j.status !== 'paid'; }), done = C.jobs.filter(function (j) { return j.status === 'paid'; }).slice(0, 10); return (L.length ? L.map(rowJob).join('') : '<div class="empty">ไม่มีงานค้าง</div>') + (done.length ? '<h3 style="margin-top:16px">จ่ายแล้วล่าสุด</h3>' + done.map(rowJob).join('') : ''); }
  function rowInv(i) { var c = cl(i.client_id), late = i.status === 'sent' && i.due_on && i.due_on < td(); return '<button class="crr" data-a="crminv" data-v="' + i.id + '"><div class="t"><b>' + E(i.no) + ' · ' + B(i.amount) + '</b>' + (i.status === 'paid' ? badge(JST, 'paid') : i.status === 'void' ? badge(JST, 'cancelled') : '<span class="crb" style="background:' + (late ? '#dc2626' : '#d97706') + '">' + (late ? 'เลยกำหนด' : 'รอจ่าย') + '</span>') + '</div><small>' + E(c ? c.name : '-') + ' · ' + E(i.item) + ' · ครบกำหนด ' + thd(i.due_on) + '</small></button>'; }
  function invPage() { return C.inv.length ? C.inv.map(rowInv).join('') : '<div class="empty">ยังไม่มีใบแจ้งหนี้ — สร้างได้จากหน้างาน</div>'; }
  function setPage() {
    var s = C.set || {};
    return '<div class="card crf"><h3>ข้อมูลธุรกิจ (แสดงบนใบแจ้งหนี้)</h3><label>ชื่อธุรกิจ/ชื่อคุณ</label><input id="crsn" value="' + E(s.biz_name || '') + '"><label>เบอร์ติดต่อ</label><input id="crsp" inputmode="tel" value="' + E(s.phone || '') + '"><label>พร้อมเพย์ (เบอร์มือถือ 10 หลัก หรือเลขบัตร 13 หลัก)</label><input id="crspp" inputmode="numeric" value="' + E(s.promptpay || '') + '"><label>ข้อความท้ายใบแจ้งหนี้</label><textarea id="crsno">' + E(s.invoice_note || 'ขอบคุณที่ใช้บริการค่ะ/ครับ') + '</textarea><div class="crbtns"><button class="btn" data-a="crmsave">บันทึก</button></div></div>';
  }

  /* ---------- ลูกค้า ---------- */
  function clForm(c) {
    c = c || {};
    return '<div class="crf"><label>ชื่อลูกค้า/ร้าน/หอพัก *</label><input id="cfn" value="' + E(c.name || '') + '"><label>ติดต่อ (เบอร์/LINE/อีเมล)</label><input id="cfc" value="' + E(c.contact || '') + '"><label>มาจากไหน</label><input id="cfs" placeholder="เช่น คนรู้จัก, Facebook, เดินเข้ามา" value="' + E(c.source || '') + '"><label>โน้ต</label><textarea id="cfo">' + E(c.note || '') + '</textarea><label>ตามต่อวันที่</label><input id="cfd" type="date" value="' + E(c.next_on || addDays(td(), 2)) + '"></div>';
  }
  async function openCl(id) {
    var c = cl(id); if (!c) return;
    var r = await S.sb.from('client_logs').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(30);
    var logs = (r.data || []), jobs = C.jobs.filter(function (j) { return j.client_id === id; });
    sheet(c.name, '<div>' + badge(STAGE, c.stage) + ' <small style="color:var(--mute)">' + E(c.contact || '') + '</small></div>' +
      '<div class="crs">' + Object.keys(STAGE).map(function (k) { return '<button class="' + (c.stage === k ? 'on' : '') + '" style="' + (c.stage === k ? 'background:' + STAGE[k][1] : '') + '" data-a="crmstage" data-v="' + id + '|' + k + '">' + STAGE[k][0] + '</button>'; }).join('') + '</div>' +
      (c.note ? '<div class="crl">' + E(c.note) + '</div>' : '') +
      '<h3>✍️ ร่างข้อความพร้อมส่ง</h3><div class="crs">' + Object.keys(TPL).map(function (k) { return '<button data-a="crmdraft" data-v="' + id + '|' + k + '">' + TPL[k].t + '</button>'; }).join('') + '</div><div id="crmdraft"></div>' +
      '<h3>🧰 งาน (' + jobs.length + ')</h3>' + jobs.map(rowJob).join('') + '<div class="crbtns"><button class="btn o" data-a="crmnewjob" data-v="' + id + '">+ เพิ่มงาน/เสนอราคา</button></div>' +
      '<h3>💬 บันทึกการคุย</h3><div class="crf"><select id="crlk">' + Object.keys(LOGK).map(function (k) { return '<option value="' + k + '">' + LOGK[k] + '</option>'; }).join('') + '</select><textarea id="crlb" placeholder="คุยอะไรไป ลูกค้าว่ายังไง"></textarea><label>ตามต่อวันที่</label><input id="crln" type="date" value="' + (c.next_on || addDays(td(), 3)) + '"></div><div class="crbtns"><button class="btn" data-a="crmlog" data-v="' + id + '">บันทึก</button></div>' +
      logs.map(function (l) { return '<div class="crl">' + LOGK[l.kind] + ' ' + E(l.body) + '<small>' + new Date(l.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) + '</small></div>'; }).join('') +
      '<div class="crbtns"><button class="btn o" data-a="crmedit" data-v="' + id + '">แก้ไขข้อมูล</button></div>');
  }

  /* ---------- ข้อความสำเร็จรูป (คุณเป็นคนส่งเอง) ---------- */
  var TPL = {
    hi: { t: '👋 ทักครั้งแรก', f: function (c, s) { return 'สวัสดีค่ะ/ครับ คุณ' + c.name + '\nผม/ดิฉัน ' + (s.biz_name || '...') + ' ทำระบบช่วยจัดการห้องเช่าและร้านค้า ใช้ง่ายบนมือถือ ตัวหนังสือใหญ่\n- ออกบิลค่าเช่า ค่าน้ำไฟ\n- ดูห้องว่าง ห้องค้างจ่ายในหน้าเดียว\n- ผู้เช่าโอนผ่าน QR พร้อมเพย์ได้\nสนใจลองใช้ฟรีก่อนไหมคะ/ครับ ไม่มีค่าใช้จ่ายและไม่ผูกมัดเลย'; } },
    follow: { t: '🔁 ตามผล', f: function (c) { return 'สวัสดีค่ะ/ครับ คุณ' + c.name + '\nแวะมาถามว่าได้ลองดูระบบที่ส่งไปหรือยังคะ/ครับ ติดตรงไหนหรืออยากให้ช่วยตั้งค่าให้ บอกได้เลย ยินดีช่วยฟรีค่ะ/ครับ'; } },
    quote: { t: '💰 เสนอราคา', f: function (c, s, j) { return 'สวัสดีค่ะ/ครับ คุณ' + c.name + '\nขอเสนอราคา: ' + (j ? j.title + ' ' + B(j.price) : '................') + '\n' + (j && j.due_on ? 'ส่งงานได้ภายใน ' + thd(j.due_on) + '\n' : '') + 'ราคานี้รวม: ...........\nถ้าตกลง ตอบกลับข้อความนี้ได้เลยค่ะ/ครับ'; } },
    remind: { t: '⏰ เตือนชำระ', f: function (c, s, j, i) { return 'สวัสดีค่ะ/ครับ คุณ' + c.name + '\nแจ้งเตือนใบแจ้งหนี้ ' + (i ? i.no + ' ยอด ' + B(i.amount) + ' ครบกำหนด ' + thd(i.due_on) : '') + '\nโอนผ่านพร้อมเพย์ ' + (s.promptpay || '...') + ' ได้เลย โอนแล้วส่งสลิปกลับมาได้ค่ะ/ครับ ขอบคุณมากค่ะ/ครับ'; } },
    thanks: { t: '🙏 ขอบคุณ', f: function (c) { return 'ได้รับเงินเรียบร้อยแล้วค่ะ/ครับ ขอบคุณคุณ' + c.name + ' มากๆ\nถ้ามีอะไรให้ช่วยเพิ่มเติม ทักมาได้ตลอดเลยค่ะ/ครับ'; } },
  };
  function draft(id, k) {
    var c = cl(id), s = C.set || {}, j = C.jobs.find(function (x) { return x.client_id === id && x.status !== 'cancelled' && x.status !== 'paid'; }), i = C.inv.find(function (x) { return x.client_id === id && x.status === 'sent'; });
    var t = TPL[k].f(c, s, j, i), box = $('crmdraft'); if (!box) return;
    box.innerHTML = '<div class="crmsg" id="crmtext">' + E(t) + '</div><div class="crbtns"><button class="btn o" data-a="crmcopy">📋 คัดลอก</button><a class="btn" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://line.me/R/share?text=' + encodeURIComponent(t) + '">ส่งทาง LINE</a></div><small style="color:var(--mute)">แก้คำได้ก่อนส่ง · ค่ะ/ครับ เลือกใช้ตามผู้ส่ง</small>';
  }

  /* ---------- งาน + ใบแจ้งหนี้ ---------- */
  function jobForm(j) {
    j = j || {};
    return '<div class="crf"><label>ชื่องาน *</label><input id="jft" value="' + E(j.title || '') + '" placeholder="เช่น ระบบห้องเช่า 20 ห้อง รายเดือน / ทำเว็บร้านกาแฟ"><label>ประเภท</label><select id="jfk">' + Object.keys(KIND).map(function (k) { return '<option value="' + k + '"' + (j.kind === k ? ' selected' : '') + '>' + KIND[k] + '</option>'; }).join('') + '</select><label>ราคา (บาท)</label><input id="jfp" type="number" inputmode="decimal" min="0" value="' + (j.price != null ? j.price : '') + '"><label>กำหนดส่ง</label><input id="jfd" type="date" value="' + E(j.due_on || '') + '"><label>โน้ต</label><textarea id="jfn">' + E(j.note || '') + '</textarea></div>';
  }
  function openJob(id) {
    var j = C.jobs.find(function (x) { return x.id === id; }); if (!j) return; var c = cl(j.client_id);
    var inv = C.inv.filter(function (i) { return i.job_id === id; });
    sheet(j.title, '<div>' + badge(JST, j.status) + ' <small style="color:var(--mute)">' + E(c ? c.name : '') + ' · ' + KIND[j.kind] + ' · ' + B(j.price) + '</small></div>' +
      '<div class="crs">' + ['quote', 'doing', 'delivered', 'cancelled'].map(function (k) { return '<button class="' + (j.status === k ? 'on' : '') + '" style="' + (j.status === k ? 'background:' + JST[k][1] : '') + '" data-a="crmjst" data-v="' + id + '|' + k + '">' + JST[k][0] + '</button>'; }).join('') + '</div>' +
      (j.note ? '<div class="crl">' + E(j.note) + '</div>' : '') +
      '<h3>🧾 ใบแจ้งหนี้</h3>' + (inv.length ? inv.map(rowInv).join('') : '<small style="color:var(--mute)">ยังไม่ได้ออก</small>') +
      '<div class="crf"><label>ยอดที่จะเรียกเก็บ</label><input id="ivam" type="number" inputmode="decimal" value="' + j.price + '"><label>ครบกำหนดชำระ</label><input id="ivdu" type="date" value="' + addDays(td(), 7) + '"></div>' +
      '<div class="crbtns"><button class="btn" data-a="crmnewinv" data-v="' + id + '">ออกใบแจ้งหนี้ + QR</button><button class="btn o" data-a="crmeditjob" data-v="' + id + '">แก้ไขงาน</button></div>');
  }
  /* QR พร้อมเพย์ (มาตรฐาน EMVCo ของธนาคารไทย) */
  function crc16(s) { var c = 0xFFFF; for (var i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (var k = 0; k < 8; k++) c = c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1; c &= 0xFFFF; } return ('0000' + c.toString(16).toUpperCase()).slice(-4); }
  function ppPayload(id, amt) {
    var d = String(id || '').replace(/\D/g, ''), f = function (t, v) { return t + ('0' + v.length).slice(-2) + v; }, acc;
    if (d.length === 10 && d[0] === '0') acc = f('01', ('0000000000000' + '66' + d.slice(1)).slice(-13));
    else if (d.length === 13) acc = f('02', d); else if (d.length === 15) acc = f('03', d); else return null;
    var p = f('00', '01') + f('01', amt ? '12' : '11') + f('29', f('00', 'A000000677010111') + acc) + f('58', 'TH') + f('53', '764') + (amt ? f('54', Number(amt).toFixed(2)) : '') + '6304';
    return p + crc16(p);
  }
  function qrImg(text) { if (typeof qrcode !== 'function' || !text) return ''; var q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createDataURL(6, 2); }
  function invHtml(i) {
    var c = cl(i.client_id) || {}, s = C.set || {}, pl = ppPayload(s.promptpay, i.amount);
    return '<div class="crinv" id="crinvbox"><h2>ใบแจ้งหนี้</h2><div>' + E(s.biz_name || '') + (s.phone ? ' · ' + E(s.phone) : '') + '</div><div style="color:#555">เลขที่ ' + E(i.no) + ' · ออก ' + thd(i.issued_on) + ' · ครบกำหนด ' + thd(i.due_on) + '</div>' +
      '<div style="margin-top:8px">ถึง: <b>' + E(c.name || '') + '</b></div><table><tr><td>' + E(i.item) + '</td><td style="text-align:right">' + B(i.amount) + '</td></tr></table><div class="tot">รวม ' + B(i.amount) + '</div>' +
      (i.status === 'paid' ? '<div style="text-align:center;color:#16a34a;font-weight:800;font-size:1.3rem;margin-top:8px">✅ ชำระแล้ว ' + thd(i.paid_on) + '</div>' : pl && qrImg(pl) ? '<img src="' + qrImg(pl) + '" alt="QR พร้อมเพย์"><div style="text-align:center">สแกนจ่ายด้วยแอปธนาคาร · พร้อมเพย์ ' + E(s.promptpay) + '</div>' : '<div class="crwarn" style="margin-top:8px">' + (pl ? 'โหลดตัวสร้าง QR ไม่ได้ (ตรวจอินเทอร์เน็ต) · โอนพร้อมเพย์ ' + E(s.promptpay) + ' ยอด ' + B(i.amount) : 'ใส่เลขพร้อมเพย์ในแท็บ ⚙️ ตั้งค่า เพื่อแสดง QR') + '</div>') +
      (s.invoice_note ? '<div style="margin-top:10px;color:#555">' + E(s.invoice_note) + '</div>' : '') + '</div>';
  }
  function openInv(id) {
    var i = C.inv.find(function (x) { return x.id === id; }); if (!i) return;
    sheet('ใบแจ้งหนี้ ' + i.no, invHtml(i) + (i.status === 'sent' ? '<div class="crf"><label>วันที่ได้รับเงิน</label><input id="crpd" type="date" value="' + td() + '"></div>' : '') + '<div class="crbtns">' + (i.status === 'sent' ? '<button class="btn" data-a="crmpaid" data-v="' + id + '">✅ รับเงินแล้ว (ลงบัญชี)</button>' : '') + '<button class="btn o" data-a="crmprint" data-v="' + id + '">🖨️ พิมพ์/บันทึก PDF</button>' + (i.status === 'sent' ? '<button class="btn o" data-a="crmremind" data-v="' + id + '">⏰ ข้อความเตือน</button><button class="btn o" data-a="crmvoid" data-v="' + id + '" style="color:#dc2626">ยกเลิกใบนี้</button>' : '') + '</div><div id="crmdraft"></div>');
  }

  /* ---------- ปุ่ม ---------- */
  A.crmtab = function (v) { C.tab = v; page(); };
  A.crmre = function () { C.loaded = false; page(); };
  A.crmsf = function (v) { C.sf = v; page(); };
  A.crmcl = function (id) { openCl(id); };
  A.crmjob = function (id) { openJob(id); };
  A.crminv = function (id) { openInv(id); };
  A.crmnewcl = function () { sheet('เพิ่มลูกค้า', clForm() + '<div class="crbtns"><button class="btn" data-a="crmaddcl">บันทึก</button></div>'); };
  A.crmaddcl = async function () {
    var n = $('cfn').value.trim(); if (!n) return toast('ใส่ชื่อลูกค้าก่อนนะ');
    var r = await S.sb.from('clients').insert({ name: n, contact: $('cfc').value.trim() || null, source: $('cfs').value.trim() || null, note: $('cfo').value.trim() || null, next_on: $('cfd').value || null }).select().single();
    if (fail(r)) return; C.cl.unshift(r.data); closeSheet(); toast('เพิ่มลูกค้าแล้ว'); page(); openCl(r.data.id);
  };
  A.crmedit = function (id) { var c = cl(id); sheet('แก้ไข ' + c.name, clForm(c) + '<div class="crbtns"><button class="btn" data-a="crmupcl" data-v="' + id + '">บันทึก</button><button class="btn o" data-a="crmarch" data-v="' + id + '" style="color:#dc2626">ซ่อนลูกค้านี้</button></div>'); };
  A.crmupcl = async function (id) {
    var p = { name: $('cfn').value.trim(), contact: $('cfc').value.trim() || null, source: $('cfs').value.trim() || null, note: $('cfo').value.trim() || null, next_on: $('cfd').value || null };
    if (!p.name) return toast('ใส่ชื่อลูกค้าก่อนนะ');
    var r = await S.sb.from('clients').update(p).eq('id', id).select().single(); if (fail(r)) return;
    Object.assign(cl(id), r.data); toast('บันทึกแล้ว'); page(); openCl(id);
  };
  A.crmarch = async function (id) { if (!confirm('ซ่อนลูกค้านี้? (ข้อมูลยังอยู่ ไม่ได้ลบ)')) return; var r = await S.sb.from('clients').update({ archived: true }).eq('id', id); if (fail(r)) return; C.cl = C.cl.filter(function (c) { return c.id !== id; }); closeSheet(); page(); };
  A.crmstage = async function (v) { var a = v.split('|'), r = await S.sb.from('clients').update({ stage: a[1] }).eq('id', a[0]); if (fail(r)) return; cl(a[0]).stage = a[1]; page(); openCl(a[0]); };
  A.crmlog = async function (id) {
    var b = $('crlb').value.trim(); if (!b) return toast('พิมพ์สิ่งที่คุยก่อนนะ');
    var r = await S.sb.from('client_logs').insert({ client_id: id, kind: $('crlk').value, body: b }); if (fail(r)) return;
    var nx = $('crln').value || null, c = cl(id), up = { next_on: nx }; if (c.stage === 'lead') up.stage = 'contacted';
    await S.sb.from('clients').update(up).eq('id', id); Object.assign(c, up); toast('บันทึกแล้ว'); page(); openCl(id);
  };
  A.crmdraft = function (v) { var a = v.split('|'); draft(a[0], a[1]); };
  A.crmcopy = function () { var t = $('crmtext').textContent; if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast('คัดลอกแล้ว'); }, function () { toast('คัดลอกไม่ได้ ลองกดค้างที่ข้อความ'); }); };
  A.crmnewjob = function (cid) { sheet('เพิ่มงาน', jobForm() + '<div class="crbtns"><button class="btn" data-a="crmaddjob" data-v="' + cid + '">บันทึก</button></div>'); };
  function jobVals() { return { title: $('jft').value.trim(), kind: $('jfk').value, price: Number($('jfp').value || 0), due_on: $('jfd').value || null, note: $('jfn').value.trim() || null }; }
  A.crmaddjob = async function (cid) {
    var p = jobVals(); if (!p.title) return toast('ใส่ชื่องานก่อนนะ'); if (!(p.price >= 0)) return toast('ราคาไม่ถูกต้อง'); p.client_id = cid;
    var r = await S.sb.from('jobs').insert(p).select().single(); if (fail(r)) return; C.jobs.unshift(r.data);
    var c = cl(cid); if (c && (c.stage === 'lead' || c.stage === 'contacted')) { await S.sb.from('clients').update({ stage: 'interested' }).eq('id', cid); c.stage = 'interested'; }
    toast('เพิ่มงานแล้ว'); page(); openJob(r.data.id);
  };
  A.crmeditjob = function (id) { var j = C.jobs.find(function (x) { return x.id === id; }); sheet('แก้ไขงาน', jobForm(j) + '<div class="crbtns"><button class="btn" data-a="crmupjob" data-v="' + id + '">บันทึก</button></div>'); };
  A.crmupjob = async function (id) { var p = jobVals(); if (!p.title) return toast('ใส่ชื่องานก่อนนะ'); var r = await S.sb.from('jobs').update(p).eq('id', id).select().single(); if (fail(r)) return; Object.assign(C.jobs.find(function (x) { return x.id === id; }), r.data); page(); openJob(id); };
  A.crmjst = async function (v) { var a = v.split('|'); if (a[1] === 'cancelled' && !confirm('ยกเลิกงานนี้?')) return; var r = await S.sb.from('jobs').update({ status: a[1] }).eq('id', a[0]); if (fail(r)) return; C.jobs.find(function (x) { return x.id === a[0]; }).status = a[1]; page(); openJob(a[0]); };
  A.crmnewinv = async function (jid) {
    var j = C.jobs.find(function (x) { return x.id === jid; }), amt = Number($('ivam').value || 0); if (!(amt > 0)) return toast('ใส่ยอดเงินก่อนนะ');
    var ym = td().slice(0, 7).replace('-', ''), n = C.inv.filter(function (i) { return String(i.no).indexOf('INV-' + ym) === 0; }).length + 1;
    var r = await S.sb.from('invoices').insert({ client_id: j.client_id, job_id: jid, no: 'INV-' + ym + '-' + ('00' + n).slice(-3), item: j.title, amount: amt, due_on: $('ivdu').value || null }).select().single();
    if (fail(r)) return; C.inv.unshift(r.data);
    await S.sb.from('jobs').update({ status: 'invoiced' }).eq('id', jid); j.status = 'invoiced';
    page(); openInv(r.data.id); toast('ออกใบแจ้งหนี้แล้ว');
  };
  A.crmpaid = async function (id) {
    var i = C.inv.find(function (x) { return x.id === id; }); if (!i || i.status !== 'sent') return;
    var c = cl(i.client_id) || {}, d = ($('crpd') && $('crpd').value) || td();
    if (!confirm('ยืนยันได้รับเงิน ' + B(i.amount) + ' จาก ' + (c.name || '') + ' วันที่ ' + thd(d) + '?\nระบบจะลงเป็นรายรับในหน้าบัญชีให้')) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return toast('รูปแบบวันที่ไม่ถูกต้อง');
    var inc = await S.sb.from('incomes').insert({ amount: i.amount, received_on: d, note: 'ใบแจ้งหนี้ ' + i.no + ' · ' + (c.name || '') + ' · ' + i.item }).select('id').single(); if (fail(inc)) return;
    var r = await S.sb.from('invoices').update({ status: 'paid', paid_on: d, income_id: inc.data.id }).eq('id', id); if (fail(r)) return;
    i.status = 'paid'; i.paid_on = d; i.income_id = inc.data.id;
    if (i.job_id) { await S.sb.from('jobs').update({ status: 'paid' }).eq('id', i.job_id); var j = C.jobs.find(function (x) { return x.id === i.job_id; }); if (j) j.status = 'paid'; }
    if (c.id && c.stage !== 'won') { await S.sb.from('clients').update({ stage: 'won' }).eq('id', c.id); c.stage = 'won'; }
    toast('✅ รับเงิน ' + B(i.amount) + ' ลงบัญชีรายรับแล้ว'); page(); openInv(id); draft(c.id, 'thanks');
  };
  A.crmvoid = async function (id) { if (!confirm('ยกเลิกใบแจ้งหนี้นี้?')) return; var r = await S.sb.from('invoices').update({ status: 'void' }).eq('id', id); if (fail(r)) return; C.inv.find(function (x) { return x.id === id; }).status = 'void'; page(); openInv(id); };
  A.crmremind = function (id) { var i = C.inv.find(function (x) { return x.id === id; }); draft(i.client_id, 'remind'); };
  A.crmprint = function (id) {
    var i = C.inv.find(function (x) { return x.id === id; }), w = window.open('', '_blank'); if (!w) return toast('เบราว์เซอร์บล็อกหน้าต่างใหม่');
    w.document.write('<!doctype html><meta charset="utf-8"><title>' + E(i.no) + '</title><style>body{font-family:system-ui,"Noto Sans Thai",sans-serif;max-width:560px;margin:24px auto;padding:0 16px}.crinv h2{margin:0 0 4px}.crinv table{width:100%;border-collapse:collapse;margin:10px 0}.crinv td{padding:6px 0;border-bottom:1px solid #eee}.crinv .tot{font-size:1.4rem;font-weight:800;text-align:right}.crinv img{display:block;margin:8px auto;width:200px;height:200px;image-rendering:pixelated}.crwarn{display:none}</style>' + invHtml(i) + '<script>setTimeout(function(){print()},400)<\/script>');
    w.document.close();
  };
  A.crmsave = async function () {
    var p = { biz_name: $('crsn').value.trim() || null, phone: $('crsp').value.trim() || null, promptpay: $('crspp').value.replace(/\D/g, '') || null, invoice_note: $('crsno').value.trim() || null, updated_at: new Date().toISOString() };
    if (p.promptpay && !ppPayload(p.promptpay, 1)) return toast('พร้อมเพย์ต้องเป็นเบอร์ 10 หลัก หรือเลขบัตร 13 หลัก');
    var r = await S.sb.from('biz_settings').upsert(p, { onConflict: 'owner_id' }).select().single(); if (fail(r)) return;
    C.set = r.data; toast('บันทึกแล้ว');
  };
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'crmq') { C.q = e.target.value; var pos = e.target.selectionStart; page(); var i = $('crmq'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } } });

  var _r = render;
  render = function () { _r(); if (S.ready && S.cur === 'crm') { $('sw').style.display = 'none'; page(); } };
  if (window.App && window.App.stop) { var _s = window.App.stop; window.App.stop = function () { C.loaded = false; C.cl = []; C.jobs = []; C.inv = []; _s(); }; }
  window.SSCrm = { C: C, reload: load, ppPayload: ppPayload };
})();
