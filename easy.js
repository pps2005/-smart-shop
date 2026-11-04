/* ============================================================
   easy.js — ปรับให้ใช้ง่ายขึ้น (โหลดเป็นไฟล์สุดท้าย)
   1) ปุ่มที่ต้องยืนยัน (เช่น "ยกเลิก" รายจ่าย) ใช้กล่องยืนยันของเว็บเสมอ
      — แก้ปัญหาเบราว์เซอร์ในแอป (LINE/Facebook ฯลฯ) ที่ไม่แสดง confirm()
   2) ซ่อนหน้า "ขายสินค้า" และ "Dashboard"
   3) ข้อความยาวเกินกล่อง → ขึ้นบรรทัดใหม่ · ช่องพิมพ์คุยกับน้องฟ้าขยายลงมาได้
   4) หน้าภาษีแบบง่าย: ถามทีละข้อ ตัวใหญ่ กดเลือกคำตอบ (ไม่เกิน 4 ตัวเลือก)
      ใช้สูตรคำนวณเดิมจาก final.js (window.SmartShopTax.calc) ไม่เปลี่ยนตรรกะภาษี
   วิธียกเลิก: ลบ <script src="easy.js"> ออกจาก index.html
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 1) กล่องยืนยันสำหรับทุกปุ่ม ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-a]');
    if (t && window.confirmFix && typeof A[t.dataset.a] === 'function') window.confirmFix.wrapA(t.dataset.a);
  }, true);

  /* ---------- 2) ซ่อนหน้า ขายสินค้า + Dashboard ---------- */
  var HIDE = ['sell', 'dash'];
  HIDE.forEach(function (id) { var i = M.findIndex(function (m) { return m.id === id; }); if (i >= 0) M.splice(i, 1); });
  var _go = A.go;
  A.go = function (v) { if (HIDE.indexOf(v) >= 0) v = 'ai'; return _go(v); };

  /* ---------- 3) CSS: ข้อความขึ้นบรรทัดใหม่ + หน้าภาษีตัวใหญ่ ---------- */
  var st = document.createElement('style');
  st.textContent = [
    '[data-a="go"][data-v="dash"],[data-a="go"][data-v="sell"]{display:none!important}',
    '#view .kv>span,#view .note,#view .empty,#view small,#view .txh,.cft{min-width:0;overflow-wrap:anywhere;white-space:normal}',
    '.wpop{overflow-x:hidden}.wpop .wsl{flex-wrap:wrap}.wpop .wsl span{min-width:0;flex:1 1 auto;white-space:normal;overflow-wrap:anywhere}.wpop .wtg span{white-space:normal;overflow-wrap:anywhere}',
    '.wbn,.whint{white-space:normal;overflow-wrap:anywhere}',
    '.wci{align-items:flex-end}.wci textarea{flex:1;min-width:0;resize:none;padding:10px 12px;border-radius:12px;background:var(--in);border:1px solid var(--gl);color:var(--gt);font:inherit;font-size:16px;line-height:1.45;max-height:132px;overflow-y:auto;user-select:text;-webkit-user-select:text;outline:0}.wci button{height:44px;flex:0 0 44px}',
    /* หน้าภาษีแบบง่าย */
    '.et{font-size:1.08rem}.et h2{font-size:1.4rem}',
    '.etp{display:flex;justify-content:space-between;color:var(--mute);font-size:1rem;margin:2px 0 6px}',
    '.etbar{height:10px;border-radius:10px;background:var(--line);overflow:hidden;margin-bottom:18px}.etbar i{display:block;height:100%;background:var(--pri);border-radius:10px;transition:width .3s}',
    '.etq{font-size:1.5rem;font-weight:800;line-height:1.45;margin:4px 0 8px;overflow-wrap:anywhere}',
    '.eth{color:var(--mute);font-size:1.05rem;line-height:1.55;margin-bottom:16px;overflow-wrap:anywhere}',
    '.eto{display:flex;flex-direction:column;gap:12px}',
    '.eto button{display:flex;align-items:center;gap:14px;width:100%;min-height:72px;padding:14px 16px;border-radius:18px;background:var(--card);border:2px solid var(--line);color:var(--text);text-align:left;font-size:1.2rem;font-weight:700;line-height:1.35}',
    '.eto button:active,.eto button.on{border-color:var(--pri);background:rgba(79,70,229,.08)}',
    '.eto button i{font-style:normal;font-size:1.7rem;flex:0 0 36px;text-align:center}',
    '.eto button small{display:block;font-size:.95rem;font-weight:500;color:var(--mute);margin-top:3px}',
    '.etn{width:100%;font-size:1.8rem!important;font-weight:800;padding:16px!important;border-radius:16px!important;text-align:center;border:2px solid var(--line);background:var(--card)}',
    '.etgo{width:100%;min-height:64px;border-radius:18px;background:var(--pri);color:#fff;font-size:1.25rem;font-weight:800;margin-top:14px}',
    '.etbk{width:100%;min-height:56px;border-radius:16px;background:transparent;border:2px solid var(--line);color:var(--text);font-size:1.1rem;font-weight:700;margin-top:18px}',
    '.etres{text-align:center;padding:22px 14px;border-radius:22px;background:var(--card);border:2px solid var(--line);margin-bottom:14px}.etres b{display:block;font-size:2.6rem;line-height:1.2;margin:6px 0;color:var(--pri)}',
    '.etf label{display:block;font-size:1.05rem;font-weight:700;margin:14px 0 4px}.etf input{width:100%;font-size:1.3rem;padding:12px 14px;border-radius:14px;border:2px solid var(--line);background:var(--card)}.etf small{color:var(--mute);font-size:.92rem}',
    '.etl{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--line);font-size:1.08rem}.etl span{min-width:0;overflow-wrap:anywhere}.etl b{white-space:nowrap}'
  ].join('');
  document.head.appendChild(st);

  /* ---------- ช่องพิมพ์แชท → textarea ขยายลงมาได้ ---------- */
  function fitTa(t) { t.style.height = 'auto'; t.style.height = Math.min(132, t.scrollHeight + 2) + 'px'; }
  var taTimer = setInterval(function () {
    var old = document.getElementById('wcin'); if (!old) return;
    clearInterval(taTimer); if (old.tagName === 'TEXTAREA') return;
    var ta = document.createElement('textarea');
    ta.id = 'wcin'; ta.rows = 1; ta.placeholder = old.placeholder; ta.autocomplete = 'off'; ta.value = old.value;
    old.parentNode.replaceChild(ta, old);
    ta.addEventListener('input', function () { fitTa(ta); });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); A.wsend(); setTimeout(function () { fitTa(ta); }, 0); }
    });
    ta.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    var sb = ta.parentNode.querySelector('[data-a="wsend"]'); if (sb) sb.addEventListener('click', function () { setTimeout(function () { fitTa(ta); }, 0); });
  }, 300);

  /* ============================================================
     4) หน้าภาษีแบบง่าย
     ============================================================ */
  var NOW = new Date().getFullYear();
  var N0 = function (n) { return Math.round(Number(n) || 0).toLocaleString('th-TH'); };
  var ET;
  function fresh() { return { i: 0, year: NOW - 1, v: {}, pulled: null, loading: false }; }
  try { ET = JSON.parse(localStorage.getItem('ss_easytax') || 'null'); } catch (e) { ET = null; }
  if (!ET || typeof ET.v !== 'object') ET = fresh();
  ET.loading = false;
  function save() { try { localStorage.setItem('ss_easytax', JSON.stringify(ET)); } catch (e) {} }

  /* ดึงข้อมูลร้าน/ค่าเช่าจากระบบ */
  async function all(mk) {
    var out = [], from = 0;
    for (;;) { var r = await mk().range(from, from + 999); if (r.error) throw r.error; out = out.concat(r.data || []); if (!r.data || r.data.length < 1000) break; from += 1000; }
    return out;
  }
  var sumK = function (a, k) { return a.reduce(function (s, x) { return s + (Number(x[k]) || 0); }, 0); };
  async function pull() {
    var y = ET.year, a = y + '-01-01', b = (y + 1) + '-01-01', P = { shop_inc: 0, shop_exp: 0, rent_inc: 0, rent_exp: 0, ok: true };
    try {
      var sl = await all(function () { return S.sb.from('sales').select('qty,unit_price,unit_cost').is('voided_at', null).gte('created_at', a + 'T00:00:00+07:00').lt('created_at', b + 'T00:00:00+07:00').order('created_at'); });
      var ex = await all(function () { return S.sb.from('expenses').select('amount').is('voided_at', null).gte('paid_on', a).lt('paid_on', b).order('paid_on'); });
      P.shop_inc = Math.round(sl.reduce(function (t, x) { return t + x.unit_price * x.qty; }, 0));
      P.shop_exp = Math.round(sl.reduce(function (t, x) { return t + (Number(x.unit_cost) || 0) * x.qty; }, 0) + sumK(ex, 'amount'));
    } catch (e) { P.ok = false; }
    try {
      var rp = await S.sb.from('rent_payments').select('amount').eq('cancelled', false).gte('paid_on', a).lt('paid_on', b).limit(5000);
      var uc = await S.sb.from('unit_costs').select('amount').gte('paid_on', a).lt('paid_on', b).limit(5000);
      if (!rp.error) P.rent_inc = Math.round(sumK(rp.data || [], 'amount'));
      if (!uc.error) P.rent_exp = Math.round(sumK(uc.data || [], 'amount'));
    } catch (e) {}
    return P;
  }

  /* ---------- คำถาม ---------- */
  var v = function () { return ET.v; };
  var STEPS = [
    { id: 'year', q: function () { return 'จะคำนวณภาษีของปีไหนคะ?'; }, h: 'ยื่นภาษีช่วง ม.ค. – มี.ค. ให้เลือก "ปีที่แล้ว"',
      o: function () { return [['📅', 'ปี ' + (NOW - 1 + 543), 'ปีที่แล้ว (ใช้ยื่นภาษีปีนี้)', function () { setYear(NOW - 1); }], ['🗓️', 'ปี ' + (NOW + 543), 'ปีนี้ (ดูล่วงหน้า)', function () { setYear(NOW); }]]; } },

    { id: 'shop', q: function () { var p = ET.pulled || {}; return p.shop_inc > 0 ? 'ยอดขายของร้านทั้งปี ฿' + N0(p.shop_inc) + ' ถูกต้องไหมคะ?' : 'มีรายได้จากการขายของไหมคะ?'; },
      h: function () { return ET.pulled && ET.pulled.shop_inc > 0 ? 'ตัวเลขนี้ระบบรวมจากยอดขายที่บันทึกไว้' : 'ระบบยังไม่พบยอดขายของปีนี้'; },
      o: function () {
        var p = ET.pulled || {};
        if (p.shop_inc > 0) return [['✅', 'ถูกต้อง ใช้ตัวเลขนี้', '', function () { v().shop_inc = p.shop_inc; v().shop_exp = p.shop_exp; v()._shop = 'ok'; }],
          ['✏️', 'ไม่ถูก ขอแก้ตัวเลขเอง', '', function () { v().shop_exp = p.shop_exp; v()._shop = 'edit'; }],
          ['🚫', 'ไม่มีรายได้จากร้าน', '', function () { v().shop_inc = 0; v()._shop = 'no'; }]];
        return [['🚫', 'ไม่มี', '', function () { v().shop_inc = 0; v()._shop = 'no'; }], ['✏️', 'มี ขอกรอกยอดขายทั้งปี', '', function () { v().shop_exp = 0; v()._shop = 'edit'; }]];
      } },
    { id: 'shopn', show: function () { return v()._shop === 'edit'; }, num: 'shop_inc', q: function () { return 'ยอดขายของร้านทั้งปี กี่บาทคะ?'; }, h: 'ใส่ยอดขายรวมทั้งปี (ก่อนหักต้นทุน)' },

    { id: 'rent', q: function () { var p = ET.pulled || {}; return p.rent_inc > 0 ? 'ค่าเช่าที่ได้รับทั้งปี ฿' + N0(p.rent_inc) + ' ถูกต้องไหมคะ?' : 'มีรายได้จากการให้เช่าห้อง/บ้าน/ที่ดินไหมคะ?'; },
      h: function () { return ET.pulled && ET.pulled.rent_inc > 0 ? 'ตัวเลขนี้ระบบรวมจากค่าเช่าที่บันทึกไว้' : ''; },
      o: function () {
        var p = ET.pulled || {};
        if (p.rent_inc > 0) return [['✅', 'ถูกต้อง ใช้ตัวเลขนี้', '', function () { v().rent_inc = p.rent_inc; v().rent_exp = p.rent_exp; v()._rent = 'ok'; }],
          ['✏️', 'ไม่ถูก ขอแก้ตัวเลขเอง', '', function () { v().rent_exp = p.rent_exp; v()._rent = 'edit'; }],
          ['🚫', 'ไม่มีรายได้ค่าเช่า', '', function () { v().rent_inc = 0; v()._rent = 'no'; }]];
        return [['🚫', 'ไม่มี', '', function () { v().rent_inc = 0; v()._rent = 'no'; }], ['✏️', 'มี ขอกรอกค่าเช่าทั้งปี', '', function () { v().rent_exp = 0; v()._rent = 'edit'; }]];
      } },
    { id: 'rentn', show: function () { return v()._rent === 'edit'; }, num: 'rent_inc', q: function () { return 'ค่าเช่าที่ได้รับทั้งปี กี่บาทคะ?'; }, h: 'รวมทุกห้อง/ทุกที่ ทั้งปี' },

    { id: 'sal', q: function () { return 'มีเงินเดือนจากงานประจำไหมคะ?'; }, h: 'เช่น เป็นพนักงานบริษัท หรือรับราชการ',
      o: function () { return [['🚫', 'ไม่มี', '', function () { v().salary = 0; v()._sal = 'no'; }], ['💵', 'มี ขอกรอกเงินเดือน "ต่อเดือน"', 'ระบบคูณ 12 ให้', function () { v()._sal = 'm'; }], ['🧾', 'มี ขอกรอกรวม "ทั้งปี"', 'ดูได้จากใบ 50 ทวิ', function () { v()._sal = 'y'; }]]; } },
    { id: 'saln', show: function () { return v()._sal === 'm' || v()._sal === 'y'; }, num: '_salraw', q: function () { return v()._sal === 'm' ? 'เงินเดือน เดือนละกี่บาทคะ?' : 'เงินเดือนรวมทั้งปี กี่บาทคะ?'; }, h: 'ถ้ามีโบนัส ให้รวมเข้าไปด้วย',
      after: function () { v().salary = (Number(v()._salraw) || 0) * (v()._sal === 'm' ? 12 : 1); } },

    { id: 'fam', q: function () { return 'สถานะครอบครัวของคุณคะ?'; }, h: '',
      o: function () { return [['🙂', 'โสด', '', function () { v().spouse = false; }], ['💑', 'แต่งงาน คู่สมรสไม่มีรายได้', 'ลดหย่อนเพิ่ม 60,000', function () { v().spouse = true; }], ['👫', 'แต่งงาน คู่สมรสมีรายได้', '', function () { v().spouse = false; }], ['🕊️', 'หม้าย / หย่าร้าง', '', function () { v().spouse = false; }]]; } },

    { id: 'kid', q: function () { return 'มีลูกที่อายุไม่ถึง 20 ปี หรือยังเรียนอยู่ (ไม่ถึง 25 ปี) กี่คนคะ?'; }, h: 'ลดหย่อนได้คนละ 30,000 บาท',
      o: function () { return [['🚫', 'ไม่มี', '', function () { v().child = 0; v()._kid = ''; }], ['👶', '1 คน', '', function () { v().child = 1; v()._kid = ''; }], ['👧👦', '2 คน', '', function () { v().child = 2; v()._kid = ''; }], ['👨‍👩‍👧‍👦', '3 คนขึ้นไป', '', function () { v()._kid = 'more'; }]]; } },
    { id: 'kidn', show: function () { return v()._kid === 'more'; }, num: 'child', unit: 'คน', q: function () { return 'มีลูกกี่คนคะ?'; }, h: 'ใส่เป็นจำนวนคน' },
    { id: 'kid2', show: function () { return Number(v().child) >= 2; }, q: function () { return 'ลูกคนที่ 2 เป็นต้นไป เกิดตั้งแต่ปี 2561 ไหมคะ?'; }, h: 'ถ้าใช่ ลดหย่อนเพิ่มอีกคนละ 30,000 บาท',
      o: function () { return [['✅', 'ใช่', '', function () { v().child2 = Math.max(0, Math.floor(Number(v().child)) - 1); }], ['❌', 'ไม่ใช่', '', function () { v().child2 = 0; }], ['🤔', 'ไม่แน่ใจ', 'ข้ามไปก่อน', function () { v().child2 = 0; }]]; } },

    { id: 'par', q: function () { return 'เลี้ยงดูพ่อแม่ที่อายุ 60 ปีขึ้นไปกี่คนคะ?'; }, h: 'พ่อแม่ต้องมีรายได้ไม่เกิน 30,000 บาทต่อปี · ลดหย่อนได้คนละ 30,000',
      o: function () { return [['🚫', 'ไม่มี', '', function () { v().parent = 0; }], ['👵', '1 คน', '', function () { v().parent = 1; }], ['👴👵', '2 คน', '', function () { v().parent = 2; }], ['👪', '3–4 คน', 'รวมพ่อแม่ของคู่สมรส (ที่ไม่มีรายได้)', function () { v().parent = 4; }]]; } },

    { id: 'sso', q: function () { return 'จ่ายเงินประกันสังคมแบบไหนคะ?'; }, h: '',
      o: function () {
        return [['🏢', 'ลูกจ้างบริษัท (มาตรา 33)', 'หักจากเงินเดือน 5% ไม่เกินปีละ 9,000', function () { var s = Number(v().salary) || 0; v().sso = s > 0 ? Math.min(9000, Math.round(s * 0.05)) : 9000; v()._sso = '33'; }],
          ['🙋', 'ส่งต่อเอง (มาตรา 39)', 'ปีละ 5,184 บาท', function () { v().sso = 5184; v()._sso = '39'; }],
          ['🧑‍🌾', 'อาชีพอิสระ (มาตรา 40)', '', function () { v()._sso = '40'; }],
          ['🚫', 'ไม่ได้จ่าย', '', function () { v().sso = 0; v()._sso = ''; }]];
      } },
    { id: 'sso40', show: function () { return v()._sso === '40'; }, q: function () { return 'ประกันสังคมมาตรา 40 จ่ายเดือนละเท่าไหร่คะ?'; }, h: '',
      o: function () { return [['1️⃣', 'เดือนละ 70 บาท', '', function () { v().sso = 840; }], ['2️⃣', 'เดือนละ 100 บาท', '', function () { v().sso = 1200; }], ['3️⃣', 'เดือนละ 300 บาท', '', function () { v().sso = 3600; }], ['🤔', 'ไม่แน่ใจ', 'ข้ามไปก่อน', function () { v().sso = 0; }]]; } },

    { id: 'ins', q: function () { return 'มีประกันชีวิต หรือประกันสุขภาพของตัวเองไหมคะ?'; }, h: '',
      o: function () { return [['🚫', 'ไม่มี', '', function () { v()._ins = ''; v().life = 0; v().health = 0; }], ['❤️', 'มีประกันชีวิต', '', function () { v()._ins = 'l'; v().health = 0; }], ['🏥', 'มีประกันสุขภาพ', '', function () { v()._ins = 'h'; v().life = 0; }], ['✨', 'มีทั้งสองอย่าง', '', function () { v()._ins = 'lh'; }]]; } },
    { id: 'lifen', show: function () { return /l/.test(v()._ins || ''); }, num: 'life', q: function () { return 'เบี้ยประกันชีวิต ทั้งปี กี่บาทคะ?'; }, h: 'ดูได้จากใบเสร็จของบริษัทประกัน' },
    { id: 'healthn', show: function () { return /h/.test(v()._ins || ''); }, num: 'health', q: function () { return 'เบี้ยประกันสุขภาพ ทั้งปี กี่บาทคะ?'; }, h: 'ลดหย่อนได้ไม่เกิน 25,000 บาท' },

    { id: 'wht', q: function () { return 'มีภาษีที่ถูกหักไว้แล้ว (หัก ณ ที่จ่าย) ไหมคะ?'; }, h: 'ดูได้จากใบ 50 ทวิ ที่ได้จากนายจ้าง หรือคนที่จ่ายเงินให้',
      o: function () { return [['🚫', 'ไม่มี', '', function () { v().wht = 0; v()._wht = ''; }], ['🧾', 'มี ขอกรอกจำนวน', '', function () { v()._wht = 'y'; }], ['🤔', 'ไม่แน่ใจ', 'ข้ามไปก่อน', function () { v().wht = 0; v()._wht = ''; }]]; } },
    { id: 'whtn', show: function () { return v()._wht === 'y'; }, num: 'wht', q: function () { return 'ภาษีที่ถูกหักไว้แล้ว รวมกี่บาทคะ?'; }, h: '' },

    { id: 'more', q: function () { return 'มีค่าลดหย่อนอื่นอีกไหมคะ?'; }, h: 'เช่น ดอกเบี้ยบ้าน · กองทุน RMF / SSF / Thai ESG · เงินบริจาค · ประกันสุขภาพพ่อแม่',
      o: function () { return [['✅', 'ไม่มี ดูผลเลย', '', function () { v()._more = ''; }], ['➕', 'มี ขอกรอกเพิ่ม', '', function () { v()._more = 'y'; }]]; } },
    { id: 'moref', show: function () { return v()._more === 'y'; }, form: [
      ['home', 'ดอกเบี้ยเงินกู้ซื้อบ้าน', 'ไม่เกิน 100,000'], ['phealth', 'ประกันสุขภาพพ่อแม่', 'ไม่เกิน 15,000'],
      ['rmf', 'กองทุน RMF', ''], ['ssf', 'กองทุน SSF', ''], ['esg', 'กองทุน Thai ESG', ''], ['pvd', 'กองทุนสำรองเลี้ยงชีพ', ''],
      ['annuity', 'ประกันชีวิตแบบบำนาญ', ''], ['nsf', 'กองทุนการออมแห่งชาติ (กอช.)', 'ไม่เกิน 30,000'],
      ['don', 'เงินบริจาคทั่วไป', ''], ['donedu', 'บริจาคการศึกษา/โรงพยาบาลรัฐ', 'นับ 2 เท่า'], ['party', 'บริจาคพรรคการเมือง', 'ไม่เกิน 10,000'],
      ['disab', 'ดูแลผู้พิการ (จำนวนคน)', 'คนละ 60,000'], ['preg', 'ค่าฝากครรภ์/คลอดบุตร', 'ไม่เกิน 60,000'], ['other_inc', 'รายได้อื่น ๆ', 'ถ้ามี']
    ], q: function () { return 'กรอกเฉพาะข้อที่มีนะคะ'; }, h: 'ข้อที่ไม่มี เว้นว่างไว้ได้เลย' },

    { id: 'res' }
  ];
  function shown(s) { return !s.show || s.show(); }
  function setYear(y) {
    if (ET.year !== y || !ET.pulled) { ET.year = y; ET.pulled = null; }
    ET.loading = true; save(); draw();
    if (!S.sb) { ET.loading = false; ET.pulled = { shop_inc: 0, shop_exp: 0, rent_inc: 0, rent_exp: 0 }; return; }
    pull().then(function (p) { ET.pulled = p; ET.loading = false; save(); if (S.cur === 'tax') draw(); });
  }
  function nextStep() { var i = ET.i + 1; while (i < STEPS.length - 1 && !shown(STEPS[i])) i++; ET.i = Math.min(i, STEPS.length - 1); save(); draw(); window.scrollTo(0, 0); }
  function prevStep() { var i = ET.i - 1; while (i > 0 && !shown(STEPS[i])) i--; ET.i = Math.max(0, i); save(); draw(); window.scrollTo(0, 0); }

  /* ระบบเลือกวิธีหักค่าใช้จ่าย (ตามจริง / เหมา) ที่เสียภาษีน้อยที่สุดให้อัตโนมัติ */
  function best() {
    var C = window.SmartShopTax && window.SmartShopTax.calc; if (!C) return null;
    var b = null;
    ['actual', 'flat'].forEach(function (sm) {
      ['actual', 'flat'].forEach(function (rm) {
        var x = Object.assign({}, ET.v, { shop_m: sm, rent_m: rm, shop_pct: 60 });
        var c = C(x); if (!b || c.tax < b.c.tax - 0.001) b = { c: c, sm: sm, rm: rm };
      });
    });
    return b;
  }

  function esc2(s) { return typeof esc === 'function' ? esc(s) : String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function val(x) { return typeof x === 'function' ? x() : (x || ''); }

  function draw() {
    var view = document.getElementById('view'); if (!view || S.cur !== 'tax') return;
    if (!S.ready) { view.innerHTML = '<div class="empty">กำลังโหลดข้อมูล...</div>'; return; }
    if (!ET.pulled && !ET.loading && ET.i > 0 && S.sb) { setYear(ET.year); return; }
    var s = STEPS[ET.i] || STEPS[0];
    if (!shown(s)) { nextStep(); return; }
    var vis = STEPS.filter(function (x) { return shown(x) && x.id !== 'res'; }), no = vis.indexOf(s) + 1, tot = vis.length;
    var h = '<div class="et"><h2>🧾 คำนวณภาษี (แบบง่าย)</h2>';
    if (s.id !== 'res') h += '<div class="etp"><span>ข้อ ' + no + ' จาก ' + tot + '</span><span>ปีภาษี ' + (ET.year + 543) + '</span></div><div class="etbar"><i style="width:' + Math.round((no - 1) / tot * 100) + '%"></i></div>';

    if (ET.loading) {
      h += '<div class="etq">กำลังดึงยอดขายและค่าเช่าจากระบบ...</div><div class="eth">รอสักครู่นะคะ</div>';
    } else if (s.id === 'res') {
      h += result();
    } else {
      h += '<div class="etq">' + val(s.q) + '</div>' + (val(s.h) ? '<div class="eth">' + val(s.h) + '</div>' : '');
      if (s.o) {
        h += '<div class="eto">' + s.o().map(function (o, k) {
          return '<button data-a="etpick" data-v="' + k + '"><i>' + o[0] + '</i><span>' + o[1] + (o[2] ? '<small>' + o[2] + '</small>' : '') + '</span></button>';
        }).join('') + '</div>';
      } else if (s.num) {
        var cur = ET.v[s.num]; h += '<input class="etn" id="etnum" type="text" inputmode="numeric" placeholder="0" value="' + (cur ? N0(cur) : '') + '">' +
          '<div class="eth" style="text-align:center;margin-top:6px">' + (s.unit || 'บาท') + '</div><button class="etgo" data-a="etnum">ตกลง ✓</button>';
      } else if (s.form) {
        h += '<div class="etf">' + s.form.map(function (f) {
          var cur = ET.v[f[0]]; return '<label>' + f[1] + (f[2] ? ' <small>(' + f[2] + ')</small>' : '') + '</label><input data-ek="' + f[0] + '" type="text" inputmode="numeric" placeholder="ไม่มี" value="' + (cur ? N0(cur) : '') + '">';
        }).join('') + '</div><button class="etgo" data-a="etform">ดูผลการคำนวณ ✓</button>';
      }
    }
    if (ET.i > 0 && !ET.loading) h += '<button class="etbk" data-a="etback">← ย้อนกลับไปแก้คำตอบ</button>';
    h += '</div>';
    view.innerHTML = h;
    var ni = document.getElementById('etnum');
    if (ni) {
      ni.addEventListener('input', function () { var d = ni.value.replace(/[^\d.]/g, ''); ni.value = d ? N0(Math.floor(Number(d))) : ''; });
      ni.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); A.etnum(); } });
    }
    Array.prototype.forEach.call(view.querySelectorAll('[data-ek]'), function (inp) {
      inp.addEventListener('input', function () { var d = inp.value.replace(/[^\d]/g, ''); inp.value = d ? N0(d) : ''; });
    });
  }

  function result() {
    var b = best(); if (!b) return '<div class="note">คำนวณไม่ได้ (ไม่พบสูตรภาษี)</div>';
    var c = b.c, h = '';
    if (c.tax < 1) h += '<div class="etres"><div style="font-size:1.2rem;font-weight:700">ผลการคำนวณปี ' + (ET.year + 543) + '</div><b>ไม่ต้องเสียภาษี 🎉</b>';
    else h += '<div class="etres"><div style="font-size:1.2rem;font-weight:700">ภาษีที่ต้องเสียทั้งปี (ประมาณ)</div><b>฿' + N0(c.tax) + '</b>';
    if (c.wht > 0) h += '<div style="font-size:1.15rem;font-weight:700">' + (c.pay >= 0 ? 'ต้องจ่ายเพิ่มอีกประมาณ ฿' + N0(c.pay) : 'ขอเงินคืนได้ประมาณ ฿' + N0(-c.pay)) + '</div><div class="eth" style="margin:4px 0 0">หักภาษีที่ถูกหักไว้แล้ว ฿' + N0(c.wht) + '</div>';
    h += '</div>';
    h += '<div class="card"><div class="etl"><span>รายได้รวมทั้งปี</span><b>฿' + N0(c.assess) + '</b></div><div class="etl"><span>หักค่าใช้จ่าย</span><b>฿' + N0(c.exp) + '</b></div>' +
      '<div class="etl"><span>หักค่าลดหย่อน</span><b>฿' + N0(c.ded) + '</b></div><div class="etl"><span>เงินที่ใช้คิดภาษี</span><b>฿' + N0(c.net) + '</b></div></div>';
    var why = [];
    if (Number(ET.v.shop_inc) > 0) why.push('ร้านค้า: ระบบเลือก' + (b.sm === 'flat' ? 'หักเหมา 60%' : 'หักค่าใช้จ่ายตามจริง') + ' ให้ เพราะเสียภาษีน้อยกว่า');
    if (Number(ET.v.rent_inc) > 0) why.push('ค่าเช่า: ระบบเลือก' + (b.rm === 'flat' ? 'หักเหมา 30%' : 'หักค่าใช้จ่ายตามจริง') + ' ให้ เพราะเสียภาษีน้อยกว่า');
    if (why.length) h += '<div class="note" style="font-size:1rem">' + why.join('<br>') + '</div>';
    h += '<details class="tri"><summary>ดูรายการลดหย่อนที่ใช้</summary>' + c.D.map(function (d) { return '<div class="etl"><span>' + esc2(d[0]) + '</span><b>฿' + N0(d[1]) + '</b></div>'; }).join('') + '</details>';
    h += '<details class="tri"><summary>ดูตารางภาษีขั้นบันได</summary>' + (c.rows.map(function (r) { return '<div class="etl"><span>' + N0(r.from) + ' – ' + N0(r.to) + ' (' + Math.round(r.rate * 100) + '%)</span><b>฿' + N0(r.tax) + '</b></div>'; }).join('') || '<div class="eth">เงินได้ไม่ถึงเกณฑ์เสียภาษี</div>') + '</details>';
    if (c.minTax) h += '<div class="note" style="font-size:1rem">รายได้จากร้าน/ค่าเช่าเกิน 1 ล้านบาท: ควรเทียบกับภาษีขั้นต่ำ 0.5% (ประมาณ ฿' + N0(c.minTax) + ') แล้วจ่ายตามจำนวนที่มากกว่า</div>';
    h += '<div class="note" style="color:var(--red);font-size:1rem;margin-top:10px">เป็นเพียงการประมาณการ ไม่ใช่การยื่นภาษีจริง ควรตรวจสอบกับกรมสรรพากรก่อนยื่น</div>';
    h += '<button class="etgo" style="background:var(--card);color:var(--text);border:2px solid var(--line)" data-a="etreset">🔄 เริ่มคำนวณใหม่</button>';
    return h;
  }

  A.etpick = function (k) { var s = STEPS[ET.i]; var o = s && s.o && s.o()[+k]; if (!o) return; o[3](); if (s.id === 'year') { ET.i = 0; } if (!ET.loading) nextStep(); else { var w = setInterval(function () { if (!ET.loading) { clearInterval(w); nextStep(); } }, 200); } };
  A.etnum = function () { var s = STEPS[ET.i], i = document.getElementById('etnum'); if (!s || !i) return; ET.v[s.num] = Number(i.value.replace(/[^\d.]/g, '')) || 0; if (s.after) s.after(); nextStep(); };
  A.etform = function () { Array.prototype.forEach.call(document.querySelectorAll('[data-ek]'), function (inp) { ET.v[inp.dataset.ek] = Number(inp.value.replace(/[^\d]/g, '')) || 0; }); nextStep(); };
  A.etback = function () { prevStep(); };
  A.etreset = function () { if (!confirm('เริ่มคำนวณภาษีใหม่ตั้งแต่ข้อแรก?')) return; ET = fresh(); save(); draw(); window.scrollTo(0, 0); };

  /* ---------- ผูกเข้ากับ render ---------- */
  var _r = render;
  render = function () {
    if (HIDE.indexOf(S.cur) >= 0) S.cur = 'ai';
    _r.apply(this, arguments);
    if (S.cur === 'tax') draw();
  };
})();
