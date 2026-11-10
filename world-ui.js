/* Xiress add-on: world-ui.js — UI เต็มจอ + ข้อมูลจริง + แชทน้องฟ้า (ฝ่ายเลขา)
   แทน city.js เดิม · โหลดหลัง world-3d.js และ world-int.js
   การโต้ตอบ/แชท: เฉพาะฝ่ายเลขา (น้องฟ้า) · ตอบจากข้อมูลจริงในระบบ + ความรู้เกี่ยวกับเว็บ + คุยเล่น (กฎในเครื่อง ไม่เรียก AI API) */
(function () {
  'use strict';
  var W = window.SSW;
  var ai = M.find(function (m) { return m.id === 'ai'; });
  if (ai) { ai.t = 'แมพร้าน'; M.splice(M.indexOf(ai), 1); M.unshift(ai); }
  S.cur = 'ai';

  /* ---------- helpers ---------- */
  function tdy() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); }
  function bkk(d) { return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); }
  function addD(s, n) { var a = s.split('-'); return new Date(Date.UTC(+a[0], +a[1] - 1, +a[2] + n)).toISOString().slice(0, 10); }
  function F(n) { return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 }); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function thr() { try { return parseInt(localStorage.getItem('ss_low')) || 3; } catch (e) { return 3; } }
  function kvh(a, b) { return '<div class="kv"><span>' + a + '</span><b>' + b + '</b></div>'; }
  function hm(s) { return new Date(s).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }); }
  function E_(s) { return esc(s); }
  var IC = {
    cube: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 12l9-5M12 12v10M12 12L3 7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    rl: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    rr: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
    home: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>',
    bell: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    menu: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    box: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
    cart: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>',
    flag: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4M4 4h13l-2 4 2 4H4"/></svg>',
    out: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>',
    send: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'
  };

  /* ---------- ข้อมูลจริง ---------- */
  var DT = { sales: [], exps: [], at: 0, loading: false, ok: false };
  function pname(id) { var p = (S.prods || []).find(function (x) { return x.id === id; }); return p ? p.code + ' ' + p.name : 'สินค้า'; }
  async function loadData(force) {
    if (!S.sb || !S.ready || DT.loading) return; if (!force && Date.now() - DT.at < 45000) return;
    DT.loading = true;
    try {
      var t = tdy(), s0 = addD(t, -35);
      var a = await S.sb.from('sales').select('product_id,qty,unit_price,unit_cost,created_at').is('voided_at', null).gte('created_at', s0 + 'T00:00:00+07:00').order('created_at', { ascending: false }).limit(5000);
      var b = await S.sb.from('expenses').select('kind,amount,paid_on').is('voided_at', null).gte('paid_on', s0).limit(5000);
      if (!a.error) DT.sales = a.data || []; if (!b.error) DT.exps = b.data || [];
      DT.ok = !a.error; DT.at = Date.now();
    } catch (e) { DT.ok = false; }
    DT.loading = false; paint();
  }
  function sumS(rows, f) { return rows.reduce(function (s, x) { return s + f(x); }, 0); }
  var rv = function (x) { return x.unit_price * x.qty; }, gp = function (x) { return (x.unit_price - x.unit_cost) * x.qty; };
  function today() { var t = tdy(); return DT.sales.filter(function (x) { return bkk(x.created_at) === t; }); }
  function month() { var m = tdy().slice(0, 7); return DT.sales.filter(function (x) { return bkk(x.created_at).slice(0, 7) === m; }); }
  function monthExp() { var m = tdy().slice(0, 7); return DT.exps.filter(function (x) { return x.paid_on.slice(0, 7) === m; }); }
  function pqty(p) { return (p.variants || []).reduce(function (a, v) { return a + (v.stock_levels || []).reduce(function (b, x) { return b + x.qty; }, 0); }, 0); }
  function totalQty() { return (S.prods || []).reduce(function (a, p) { return a + pqty(p); }, 0); }
  function lowList() { var T = thr(); return (S.prods || []).filter(function (p) { return p.status !== 'black' && pqty(p) <= T; }); }
  function rentInfo() {
    var X = window.SSRent; if (!X) return null; try { X.ensure(); } catch (e) {} if (!X.R.loaded) return null;
    var td = X.today ? X.today() : tdy(), over = X.R.pays.filter(function (r) { return r._left > 0 && X.eff(r) < td; });
    return { over: over.length, amt: over.reduce(function (s, r) { return s + r._left; }, 0), units: (X.R.units || []).length, rows: over };
  }
  var TK = []; try { TK = JSON.parse(localStorage.getItem('ss_tasks') || '[]'); } catch (e) {}
  function saveTK() { try { localStorage.setItem('ss_tasks', JSON.stringify(TK)); } catch (e) {} }
  function pendingN() { return TK.filter(function (t) { return !t.done && t.d <= tdy(); }).length; }
  function alertsN() { var r = rentInfo(); return lowList().length + (r ? r.over : 0) + pendingN(); }

  /* ตัวชี้วัดของแต่ละฝ่าย (ข้อมูลจริง) */
  function met(k) {
    var t = today(), m = month(), P = S.prods || [], ri = rentInfo(), ld = DT.ok ? null : 'กำลังโหลด...';
    var money = function (n) { return ld || '฿' + F(n); };
    switch (k) {
      case 'acc': return [['ยอดขายวันนี้', money(sumS(t, rv))], ['กำไรขั้นต้นวันนี้', money(sumS(t, gp))], ['ยอดขายเดือนนี้', money(sumS(m, rv))], ['รายจ่ายเดือนนี้', ld || '฿' + F(sumS(monthExp(), function (x) { return Number(x.amount); }))]];
      case 'prod': var st = { green: 0, blue: 0, red: 0, black: 0 }; P.forEach(function (p) { st[p.status] = (st[p.status] || 0) + 1; }); return [['จำนวนรุ่น', F(P.length)], ['พร้อมขาย', F(st.green)], ['สำรอง / เสีย', F(st.blue) + ' / ' + F(st.red)], ['หมดสต็อก', F(st.black)]];
      case 'stock': var val = P.reduce(function (a, p) { return a + pqty(p) * Number(p.current_cost || 0); }, 0); return [['สินค้ารวม', F(totalQty()) + ' ชิ้น'], ['มูลค่าทุนรวม', '฿' + F(val)], ['สถานที่จัดเก็บ', F((S.locs || []).length)], ['ใกล้หมด (≤' + thr() + ')', F(lowList().length) + ' รุ่น']];
      case 'sales': var tp = {}; t.forEach(function (x) { tp[x.product_id] = (tp[x.product_id] || 0) + x.qty; }); var bi = Object.keys(tp).sort(function (a, b) { return tp[b] - tp[a]; })[0];
        return [['ยอดขายวันนี้', money(sumS(t, rv))], ['รายการขาย', ld || F(t.length)], ['จำนวนชิ้น', ld || F(sumS(t, function (x) { return x.qty; }))], ['ขายดีวันนี้', ld || (bi ? pname(bi).split(' ')[0] + ' ×' + tp[bi] : '-')]];
      case 'rent': return [['ค้างชำระ', ri ? F(ri.over) + ' งวด' : 'กำลังโหลด...'], ['ยอดค้าง', ri ? '฿' + F(ri.amt) : '-'], ['ยูนิตทั้งหมด', ri ? F(ri.units) : '-'], ['สถานะ', ri ? (ri.over ? 'มีค้างจ่าย' : 'เรียบร้อย') : '-']];
      case 'tax': var pf = sumS(m, gp) - sumS(monthExp(), function (x) { return Number(x.amount); }); return [['กำไรเดือนนี้ (ประมาณ)', ld || '฿' + F(pf)], ['ยอดขายเดือนนี้', money(sumS(m, rv))], ['ปีภาษี', String(new Date().getFullYear() + 543)], ['รายละเอียด', 'กดดูข้อมูลฝ่าย']];
      case 'news': return [['สถานะ', 'ยังไม่เชื่อมต่อ'], ['แหล่งข่าว', 'ยังไม่มี'], ['ข่าววันนี้', '-'], ['หมายเหตุ', 'ไม่แต่งข่าวเอง']];
      case 'sec': return [['งานค้างวันนี้', F(pendingN())], ['งานทั้งหมด', F(TK.filter(function (x) { return !x.done; }).length)], ['แจ้งเตือนรวม', F(alertsN())], ['คุยกับน้องฟ้า', 'ถามได้ทุกเรื่อง']];
    }
    return [];
  }
  function tagText(k) {
    var t = today();
    if (k === 'acc' || k === 'sales') return DT.ok ? '฿' + F(sumS(t, rv)) : '';
    if (k === 'prod') return F((S.prods || []).length) + ' รุ่น'; if (k === 'stock') return F(totalQty()) + ' ชิ้น';
    if (k === 'rent') { var r = rentInfo(); return r ? (r.over ? 'ค้าง ' + r.over : 'เรียบร้อย') : ''; }
    if (k === 'sec') return pendingN() ? 'งาน ' + pendingN() : 'พร้อมคุย'; if (k === 'news') return 'ยังไม่ต่อ'; return '';
  }

  /* ---------- DOM ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '#office,.ofn{display:none!important}body.wlock{overflow:hidden}',
    '#wd{position:fixed;inset:0;z-index:10;display:none;font-family:system-ui,-apple-system,"Noto Sans Thai",sans-serif;color:var(--gt);overflow:hidden;background:#eaf0f8;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}',
    '#wd.on{display:block}#wd.wext{--g:rgba(255,255,255,.88);--g2:rgba(241,245,251,.9);--gt:#0f172a;--gm:#64748b;--gl:rgba(15,23,42,.09);--ac:#2563eb;--ok:#16a34a;--bad:#dc2626;--in:#f1f5f9}',
    '#wd.wint{--g:rgba(14,18,30,.84);--g2:rgba(28,34,52,.86);--gt:#e8ecf6;--gm:#8a93a8;--gl:rgba(255,255,255,.09);--ac:#6d8bff;--ok:#4ade80;--bad:#f87171;--in:rgba(255,255,255,.06);background:#070a12}',
    '#wgl{position:absolute;inset:0;transition:opacity .23s}#wd.wfade #wgl{opacity:0}#wgl canvas{width:100%;height:100%;display:block;touch-action:none;outline:0}',
    ':where(#wd) button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}:where(#wd) input{font:inherit;font-size:16px;color:inherit;outline:0}',
    '.wg{background:var(--g);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--gl);border-radius:16px;box-shadow:0 8px 28px rgba(15,23,42,.12)}',
    '.wint .wg{box-shadow:0 8px 28px rgba(0,0,0,.45)}',
    '.wtop{position:absolute;left:10px;right:10px;top:calc(10px + env(safe-area-inset-top,0px));display:flex;align-items:center;gap:8px;padding:7px 8px;z-index:4}',
    '.wlogo{display:flex;align-items:center;gap:8px;font-weight:800;font-size:.98rem;white-space:nowrap}.wlogo i{width:32px;height:32px;border-radius:10px;background:var(--ac);color:#fff;display:grid;place-items:center}',
    '.wsrch{position:relative;flex:1;min-width:0}.wsrch input{width:100%;padding:9px 12px 9px 34px;border-radius:12px;background:var(--in);border:1px solid var(--gl)}.wsrch svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--gm)}',
    '#wsr{position:absolute;left:0;right:0;top:44px;max-height:50vh;overflow:auto;border-radius:14px;display:none;padding:6px}#wsr button{display:flex;width:100%;justify-content:space-between;gap:8px;text-align:left;padding:9px 10px;border-radius:10px;font-size:.88rem}#wsr button:hover,#wsr button:active{background:var(--in)}#wsr small{color:var(--gm)}',
    '.wchip{display:flex;align-items:center;gap:6px;padding:8px 11px;border-radius:12px;background:var(--in);border:1px solid var(--gl);font-size:.8rem;white-space:nowrap}',
    '.wib{position:relative;width:38px;height:38px;border-radius:12px;background:var(--in);border:1px solid var(--gl);display:grid;place-items:center;flex:0 0 38px}.wib b{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;border-radius:9px;background:#ef4444;color:#fff;font-size:.68rem;display:grid;place-items:center;padding:0 4px}',
    '.wav{background:var(--ac)!important;color:#fff;font-weight:800;font-size:.9rem}',
    '.wkpi{position:absolute;left:10px;top:calc(72px + env(safe-area-inset-top,0px));display:flex;gap:8px;z-index:3;max-width:calc(100% - 20px)}',
    '.wk{display:flex;align-items:center;gap:10px;padding:10px 14px 10px 10px;min-width:176px}.wk i{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:rgba(37,99,235,.12);color:var(--ac);flex:0 0 38px}',
    '.wk small{display:block;color:var(--gm);font-size:.7rem}.wk b{display:block;font-size:1.25rem;line-height:1.15}.wk em{font-style:normal;font-size:.68rem;padding:2px 7px;border-radius:99px;background:rgba(22,163,74,.14);color:var(--ok);margin-left:6px;font-weight:700}.wk em.r{background:rgba(220,38,38,.12);color:var(--bad)}',
    '.wpan{position:absolute;right:62px;top:calc(72px + env(safe-area-inset-top,0px));width:310px;max-height:calc(100% - 200px);overflow:auto;padding:14px;z-index:3;display:none}.wpan.on{display:block}',
    '.wph{display:flex;align-items:center;gap:10px;margin-bottom:10px}.wph i{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;font-size:1.4rem;font-style:normal;flex:0 0 42px}.wph b{display:block;font-size:1.02rem}.wph small{color:var(--gm)}.wph .wx{margin-left:auto;width:32px;height:32px;border-radius:10px;background:var(--in);display:grid;place-items:center;flex:0 0 32px}',
    '.wpill{display:inline-block;font-size:.68rem;padding:2px 9px;border-radius:99px;background:rgba(22,163,74,.14);color:var(--ok);font-weight:700;margin-left:6px}',
    '.wbar2{height:6px;border-radius:9px;background:var(--in);overflow:hidden;margin:10px 0}.wbar2 i{display:block;height:100%;border-radius:9px;background:var(--ac)}',
    '.wrow{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--gl);font-size:.86rem}.wrow span{color:var(--gm)}.wrow b{text-align:right}',
    '.wbtn{display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 12px;border-radius:12px;background:var(--ac);color:#fff!important;font-weight:700;font-size:.88rem;flex:1}.wbtn.o{background:var(--in);color:var(--gt)!important;border:1px solid var(--gl)}.wbtns{display:flex;gap:8px;margin-top:10px}',
    '.wact{position:absolute;left:10px;bottom:calc(76px + env(safe-area-inset-bottom,0px));width:330px;padding:12px 14px;z-index:3}.wact h4{font-size:.78rem;color:var(--gm);margin:0 0 8px;letter-spacing:.3px}',
    '.wsteps{display:flex;align-items:center;margin:2px 0 12px}.wsteps div{flex:1;text-align:center;font-size:.66rem;color:var(--gm);position:relative}.wsteps div:before{content:"";display:block;width:14px;height:14px;border-radius:50%;margin:0 auto 4px;background:var(--in);border:2px solid var(--gl);position:relative;z-index:1}.wsteps div:after{content:"";position:absolute;top:6px;left:-50%;width:100%;height:2px;background:var(--gl)}.wsteps div:first-child:after{display:none}.wsteps div.d:before{background:var(--ac);border-color:var(--ac)}.wsteps div.d:after{background:var(--ac)}.wsteps div.d{color:var(--gt);font-weight:700}',
    '.wli{display:flex;justify-content:space-between;gap:8px;font-size:.8rem;padding:5px 0;border-top:1px solid var(--gl)}.wli span{color:var(--gm);white-space:nowrap}.wli b{white-space:nowrap}.wli div{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}',
    '.wctl{position:absolute;right:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;padding:4px;z-index:3}.wctl button{width:42px;height:42px;border-radius:12px;display:grid;place-items:center}.wctl button:active{background:var(--in)}.wctl hr{border:0;border-top:1px solid var(--gl);margin:2px 6px}',
    '.wbot{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px));display:flex;gap:6px;padding:5px;z-index:4;white-space:nowrap}.wbot button{padding:10px 14px;border-radius:12px;font-weight:700;font-size:.86rem;display:flex;align-items:center;gap:6px;color:var(--gm)}.wbot button.on{background:var(--ac);color:#fff}.wbot .wfa{background:#ec4899;color:#fff}',
    '.wtabs{position:absolute;left:10px;right:10px;top:calc(72px + env(safe-area-inset-top,0px));display:none;gap:6px;overflow-x:auto;scrollbar-width:none;padding:5px;z-index:3}.wint .wtabs{display:flex}.wtabs::-webkit-scrollbar{display:none}.wtabs button{padding:8px 13px;border-radius:11px;font-size:.8rem;white-space:nowrap;color:var(--gm);font-weight:600}.wtabs button.on{background:var(--ac);color:#fff}',
    '.wleft{position:absolute;left:10px;top:calc(130px + env(safe-area-inset-top,0px));width:250px;max-height:calc(100% - 210px);overflow:auto;padding:12px;z-index:3;display:none}.wint .wleft{display:block}',
    '.wleft h4,.wright h4{font-size:.68rem;letter-spacing:.6px;color:var(--gm);margin:0 0 8px;font-weight:700}.wgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}.wgrid div{background:var(--in);border-radius:12px;padding:9px 10px;border:1px solid var(--gl)}.wgrid small{display:block;color:var(--gm);font-size:.64rem;letter-spacing:.3px}.wgrid b{font-size:1.02rem}',
    '.wst{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--gl);font-size:.82rem}.wst b{display:block}.wst small{color:var(--gm)}.wst em{margin-left:auto;font-style:normal;font-size:.64rem;padding:2px 8px;border-radius:99px;background:var(--in);color:var(--gm)}.wst em.w{color:var(--ok)}',
    '.wright{position:absolute;right:62px;top:calc(130px + env(safe-area-inset-top,0px));width:250px;max-height:40%;overflow:hidden;padding:12px;z-index:3;display:none}.wint .wright{display:block}.wf{font-size:.78rem;padding:6px 0;border-top:1px solid var(--gl)}.wf b{margin-right:6px}.wf small{float:right;color:var(--gm)}',
    '.wtag{position:absolute;left:0;top:0;z-index:2;pointer-events:none;will-change:transform}',
    '.wb{pointer-events:auto;cursor:pointer;display:flex;align-items:center;gap:6px;background:#fff;border:1px solid rgba(15,23,42,.1);border-radius:99px;padding:4px 11px 4px 5px;font-size:.74rem;font-weight:700;color:#0f172a;box-shadow:0 4px 14px rgba(15,23,42,.16);white-space:nowrap}.wb i{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:.8rem}.wb small{color:#2563eb;font-weight:700;font-size:.7rem}.wb.on{background:#2563eb;color:#fff}.wb.on small{color:#dbeafe}',
    '.wsec{pointer-events:auto;cursor:pointer;background:linear-gradient(135deg,#f472b6,#ec4899);color:#fff;border-radius:14px 14px 14px 3px;padding:6px 11px;font-size:.76rem;font-weight:800;box-shadow:0 6px 18px rgba(236,72,153,.45);white-space:nowrap;animation:wbob 1.6s ease-in-out infinite}@keyframes wbob{50%{transform:translateY(-4px)}}',
    '.wn{background:rgba(10,14,24,.78);color:#e8ecf6;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:2px 8px;font-size:.66rem;white-space:nowrap}.wn.s{background:#ec4899;border-color:#fbcfe8;pointer-events:auto;cursor:pointer}',
    '.wsay{background:#fff;color:#111827;border-radius:12px;padding:5px 10px;font-size:.72rem;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.4);max-width:170px;white-space:normal;text-align:center}',
    '.wchat{position:absolute;right:62px;bottom:calc(76px + env(safe-area-inset-bottom,0px));width:min(360px,calc(100% - 84px));box-sizing:border-box;height:min(520px,calc(100% - 180px));display:none;flex-direction:column;z-index:6;overflow:hidden}.wchat.on{display:flex}',
    '.wch{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#f472b6,#ec4899);color:#fff}.wch .av{width:40px;height:40px;border-radius:50%;background:#fff;display:grid;place-items:center;font-size:1.4rem}.wch>div:nth-child(2){min-width:0;flex:1}.wch b{display:block}.wch small{display:block;color:#fff;opacity:.92;font-size:.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wch .av{flex:none}.wch button{flex:none}.wch button{margin-left:auto;width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.22);display:grid;place-items:center;color:#fff}',
    '.wcb{flex:1;min-height:0;min-width:0;box-sizing:border-box;overflow-x:hidden;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;user-select:text;-webkit-user-select:text}.wm{box-sizing:border-box;max-width:88%;min-width:0;flex:none;padding:9px 12px;overflow-wrap:anywhere;border-radius:16px;font-size:.88rem;line-height:1.5;background:var(--in);border:1px solid var(--gl);border-bottom-left-radius:4px;word-break:normal}.wm.u{align-self:flex-end;background:#ec4899;color:#fff;border:0;border-radius:16px 16px 4px 16px}.wm .kv{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-top:1px solid var(--gl);font-size:.82rem}.wm ul{margin:4px 0 4px 16px;padding:0}.wm li{margin:2px 0}.wm .wbtn{margin-top:6px;padding:8px 10px;font-size:.8rem;flex:none;display:inline-flex}.wm small{color:var(--gm)}.wm .q{display:none}',
    '.wqs{display:flex;gap:6px;overflow-x:auto;padding:0 12px 8px;scrollbar-width:none}.wqs::-webkit-scrollbar{display:none}.wqs button{flex:0 0 auto;padding:6px 11px;border-radius:99px;background:var(--in);border:1px solid var(--gl);font-size:.76rem}',
    '.wci{display:flex;gap:8px;padding:8px 10px 10px;border-top:1px solid var(--gl)}.wci input{flex:1;min-width:0;padding:10px 12px;border-radius:12px;background:var(--in);border:1px solid var(--gl);user-select:text;-webkit-user-select:text}.wci button{width:44px;border-radius:12px;background:#ec4899;color:#fff;display:grid;place-items:center}',
    '.wdot{display:inline-flex;gap:3px}.wdot i{width:6px;height:6px;border-radius:50%;background:var(--gm);animation:wdt 1s infinite}.wdot i:nth-child(2){animation-delay:.15s}.wdot i:nth-child(3){animation-delay:.3s}@keyframes wdt{50%{transform:translateY(-4px);opacity:.4}}',
    '.wmenu{position:absolute;inset:0;z-index:8;display:none;background:rgba(15,23,42,.4)}.wmenu.on{display:block}.wmenu>div{position:absolute;right:0;top:0;bottom:0;width:min(300px,84%);padding:calc(18px + env(safe-area-inset-top,0px)) 14px 18px;overflow:auto;border-radius:20px 0 0 20px;background:var(--g2)}.wmenu h3{margin:0 0 10px;font-size:1rem}.wmenu button.mi{display:flex;align-items:center;gap:12px;width:100%;padding:13px 10px;border-radius:12px;font-weight:600;text-align:left}.wmenu button.mi:active,.wmenu button.mi.on{background:var(--in)}',
    '@media(max-width:1000px){.wlogo span{display:none}.wchip.loc{display:none}.wkpi{gap:6px;right:10px;overflow-x:auto;scrollbar-width:none}.wkpi::-webkit-scrollbar{display:none}.wk{min-width:0;flex:1;padding:8px 9px;gap:7px}.wk i{display:none}.wk b{font-size:1.02rem}.wk em{display:none}.wk small{font-size:.62rem}',
    '#wd.wp .wctl{display:none}.wpan{left:10px;right:10px;top:auto;bottom:calc(76px + env(safe-area-inset-bottom,0px));width:auto;max-height:46%}.wact{display:none}.wctl{top:auto;bottom:calc(76px + env(safe-area-inset-bottom,0px));transform:none;right:10px}.wctl.hp{display:none}',
    '.wleft{display:none!important}.wright{display:none!important}.wchat{left:10px;right:10px;width:auto;bottom:calc(76px + env(safe-area-inset-bottom,0px));height:min(62%,520px)}.wint .wkpi{top:calc(124px + env(safe-area-inset-top,0px))}.wbot button{padding:9px 11px;font-size:.8rem}}'
  ].join('');
  document.head.appendChild(css);

  var WD, built = false, started = false, tagEls = {}, feed = [], cmsgs = [], lastSel = null;
  function $$(s, r) { return (r || WD).querySelector(s); }
  function build() {
    if (built) return; built = true;
    WD = document.createElement('div'); WD.id = 'wd'; WD.className = 'wext';
    WD.innerHTML =
      '<div id="wgl"></div>' +
      '<header class="wtop wg"><div class="wlogo"><i>' + IC.cube + '</i><span>Xiress</span></div>' +
      '<div class="wsrch"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg><input id="wq" placeholder="ค้นหาสินค้า รหัส หรือฝ่าย..." autocomplete="off"><div id="wsr" class="wg"></div></div>' +
      '<div class="wchip loc" id="wloc">📍 ร้านของฉัน</div><button class="wib" data-a="wbell" aria-label="แจ้งเตือน">' + IC.bell + '<b id="wbadge" style="display:none">0</b></button>' +
      '<button class="wib wav" id="wav" data-a="wset" aria-label="ตั้งค่า">ก</button><button class="wib" data-a="wmenu" aria-label="เมนู">' + IC.menu + '</button></header>' +
      '<div class="wkpi" id="wkpi"></div>' +
      '<div class="wtabs wg" id="wtabs"></div>' +
      '<aside class="wpan wg" id="wpan"></aside>' +
      '<aside class="wact wg" id="wact"></aside>' +
      '<aside class="wleft wg" id="wleft"></aside><aside class="wright wg" id="wright"></aside>' +
      '<div class="wctl wg" id="wctl"><button data-a="wzin" aria-label="ซูมเข้า">' + IC.plus + '</button><button data-a="wzout" aria-label="ซูมออก">' + IC.minus + '</button><hr><button data-a="wrl" aria-label="หมุนซ้าย">' + IC.rl + '</button><button data-a="wrr" aria-label="หมุนขวา">' + IC.rr + '</button><hr><button data-a="wrec" aria-label="กลับกลางแมพ">' + IC.home + '</button></div>' +
      '<div class="wbot wg" id="wbot"></div>' +
      '<section class="wchat wg" id="wchat"><div class="wch"><div class="av">🌸</div><div><b>น้องฟ้า · เลขา</b><small>ตอบจากข้อมูลจริงของร้าน และคุยเล่นเป็นเพื่อนได้</small></div><button data-a="wchatx" aria-label="ปิด">' + IC.x + '</button></div><div class="wcb" id="wcb"></div><div class="wqs" id="wqs"></div><div class="wci"><input id="wcin" placeholder="พิมพ์คุยกับน้องฟ้า..." autocomplete="off"><button data-a="wsend" aria-label="ส่ง">' + IC.send + '</button></div></section>' +
      '<div class="wmenu" id="wmenu"><div class="wg"></div></div>';
    document.body.appendChild(WD);
    $$('#wq').addEventListener('input', search); $$('#wq').addEventListener('focus', search);
    $$('#wcin').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); A.wsend(); } });
    WD.addEventListener('click', function (e) { if (!e.target.closest('.wsrch')) $$('#wsr').style.display = 'none'; if (e.target.id === 'wmenu') A.wmenux(); });
    ['wkpi', 'wact', 'wpan', 'wleft', 'wright', 'wchat', 'wtabs', 'wbot', 'wctl'].forEach(function (id) { $$('#' + id).addEventListener('pointerdown', function (e) { e.stopPropagation(); }); });
  }

  /* ---------- ค้นหา ---------- */
  function search() {
    var q = $$('#wq').value.trim().toLowerCase(), box = $$('#wsr'); if (!q) { box.style.display = 'none'; return; }
    var ds = W.D.filter(function (d) { return d.n.indexOf(q) > -1 || d.s.indexOf(q) > -1 || d.k.indexOf(q) > -1; }).slice(0, 3);
    var ps = (S.prods || []).filter(function (p) { return p.name.toLowerCase().indexOf(q) > -1 || p.code.toLowerCase().indexOf(q) > -1; }).slice(0, 6);
    box.innerHTML = ds.map(function (d) { return '<button data-a="wgoto" data-v="' + d.k + '"><span>' + d.ic + ' ' + d.n + '</span><small>ฝ่าย</small></button>'; }).join('') +
      ps.map(function (p) { return '<button data-a="open" data-v="' + E_(p.code) + '"><span>' + E_(p.code) + ' · ' + E_(p.name) + '</span><small>เหลือ ' + pqty(p) + '</small></button>'; }).join('') || '<button><span>ไม่พบ</span></button>';
    box.style.display = 'block';
  }

  /* ---------- วาด UI ---------- */
  function paint() {
    if (!built || !WD.classList.contains('on')) return;
    var V = W.V, t = today(), low = lowList().length, ri = rentInfo(), el = $$('#wkpi');
    var kp = [
      ['box', 'สินค้าในคลัง', F(totalQty()) + ' ชิ้น', low ? '<em class="r">ใกล้หมด ' + low + '</em>' : '<em>' + F((S.prods || []).length) + ' รุ่น</em>'],
      ['cart', 'ขายวันนี้', DT.ok ? '฿' + F(sumS(t, rv)) : '...', DT.ok ? '<em>' + t.length + ' รายการ</em>' : ''],
      ['flag', 'ต้องติดตาม', F(alertsN()) + ' รายการ', ri && ri.over ? '<em class="r">ค่าเช่าค้าง ' + ri.over + '</em>' : (pendingN() ? '<em class="r">งาน ' + pendingN() + '</em>' : '<em>เรียบร้อย</em>')]
    ];
    el.innerHTML = kp.map(function (k) { return '<div class="wk wg"><i>' + IC[k[0]] + '</i><div><small>' + k[1] + '</small><b>' + k[2] + k[3] + '</b></div></div>'; }).join('');
    var n = alertsN(), bd = $$('#wbadge'); bd.style.display = n ? '' : 'none'; bd.textContent = n > 99 ? '99+' : n;
    var em = ''; try { em = (window.sb && 0) || ''; } catch (e) {}
    $$('#wav').textContent = (localStorage.getItem('lastEmail') || 'ก').charAt(0).toUpperCase();
    if (S.locs && S.locs[0]) $$('#wloc').textContent = '📍 ' + S.locs[0].name + (S.locs.length > 1 ? ' +' + (S.locs.length - 1) : '');
    // กิจกรรมล่าสุด
    var rec = DT.sales.slice(0, 5), steps = [['มีสินค้าในระบบ', (S.prods || []).length > 0], ['มียอดขายวันนี้', t.length > 0], ['บันทึกรายจ่ายวันนี้', DT.exps.some(function (x) { return x.paid_on === tdy(); })], ['ไม่มีของใกล้หมด', low === 0]];
    $$('#wact').innerHTML = '<h4>เช็กลิสต์ประจำวัน</h4><div class="wsteps">' + steps.map(function (s) { return '<div class="' + (s[1] ? 'd' : '') + '">' + s[0] + '</div>'; }).join('') + '</div><h4>ขายล่าสุด</h4>' +
      (rec.length ? rec.map(function (x) { return '<div class="wli"><span>' + hm(x.created_at) + '</span><div>' + E_(pname(x.product_id)) + ' ×' + x.qty + '</div><b>฿' + F(rv(x)) + '</b></div>'; }).join('') : '<div class="wli"><div style="color:var(--gm)">' + (DT.ok ? 'ยังไม่มีรายการขาย' : 'กำลังโหลด...') + '</div></div>');
    W.D.forEach(function (d) { var e = tagEls[d.k]; if (e) { var s = e.querySelector('small'); if (s) s.textContent = tagText(d.k); e.classList.toggle('on', V.sel === d.k); } });
    paintPanel(); paintInt(); paintBot();
  }
  function paintPanel() {
    var V = W.V, p = $$('#wpan'), k = V.sel; WD.classList.toggle('wp', V.mode === 'ext' && !!k || $$('#wchat').classList.contains('on')); if (V.mode !== 'ext' || !k) { p.classList.remove('on'); return; }
    var d = W.BD[k], rows = met(k), sf = d.staff[0]; p.classList.add('on');
    var pct = k === 'stock' ? Math.min(100, totalQty() ? Math.round((1 - lowList().length / Math.max(1, (S.prods || []).length)) * 100) : 0) : k === 'sales' || k === 'acc' ? Math.min(100, Math.round(sumS(today(), rv) / 50)) : null;
    p.innerHTML = '<div class="wph"><i style="background:' + W.hex(d.c) + '22">' + d.ic + '</i><div><b>' + d.n + '<span class="wpill">ออนไลน์</span></b><small>' + E_(sf[0]) + ' · ' + E_(sf[1]) + '</small></div><button class="wx" data-a="wdesel" aria-label="ปิด">' + IC.x + '</button></div>' +
      rows.map(function (r) { return '<div class="wrow"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('') +
      (pct != null ? '<div class="wbar2"><i style="width:' + pct + '%"></i></div>' : '') +
      '<div class="wbtns"><button class="wbtn" data-a="wdept" data-v="' + k + '">ดูรายละเอียด</button><button class="wbtn o" data-a="wenter" data-v="' + k + '">เข้าไปข้างใน</button></div>' + (k === 'sec' ? '<div class="wbtns"><button class="wbtn" style="background:#ec4899" data-a="wchat">💬 คุยกับน้องฟ้า</button></div>' : '');
  }
  function paintBot() {
    var m = W.V.mode, b = $$('#wbot');
    b.innerHTML = m === 'ext' ? '<button class="on" data-a="wmode" data-v="ext">ภายนอก</button><button data-a="wenter" data-v="' + (W.V.sel || 'sec') + '">ภายใน</button><button class="wfa" data-a="wchat">🌸 น้องฟ้า</button>'
      : '<button data-a="wmode" data-v="ext">' + IC.out + ' ออกไปข้างนอก</button><button class="on">ภายใน</button><button data-a="wdept" data-v="' + (W.V.room === 'all' ? 'acc' : W.V.room) + '">ข้อมูลฝ่าย</button><button class="wfa" data-a="wchat">🌸 น้องฟ้า</button>';
    $$('#wact').style.display = ''; $$('#wkpi').style.display = m === 'int' && innerWidth <= 1000 ? 'none' : '';
    if (m === 'int') { $$('#wact').style.display = 'none'; $$('#wpan').classList.remove('on'); }
    $$('#wctl').classList.toggle('hp', false);
  }
  function modeLabel(n) { return n.mode === 'sit' ? ['นั่งทำงาน', 'w'] : n.mode === 'walk' ? ['เดินอยู่', ''] : n.sec ? ['ต้อนรับ', 'w'] : ['ยืนประจำจุด', '']; }
  function paintInt() {
    if (W.V.mode !== 'int') return;
    var V = W.V, rm = V.room, tabs = $$('#wtabs'), L = $$('#wleft'), R = $$('#wright');
    tabs.innerHTML = '<button data-a="wroom" data-v="all" class="' + (rm === 'all' ? 'on' : '') + '">ภาพรวม</button>' + W.D.map(function (d) { return '<button data-a="wroom" data-v="' + d.k + '" class="' + (rm === d.k ? 'on' : '') + '">' + d.ic + ' ' + d.s + '</button>'; }).join('');
    var act = tabs.querySelector('.on'); if (act && act.scrollIntoView && !tabs._s) { tabs._s = 1; try { act.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) {} setTimeout(function () { tabs._s = 0; }, 400); }
    var d = W.BD[rm === 'all' ? 'sec' : rm], rows = rm === 'all' ? [['ฝ่ายทั้งหมด', '8'], ['พนักงาน', String(W.D.length * 3)], ['แจ้งเตือน', F(alertsN())], ['งานค้าง', F(pendingN())]] : met(rm);
    var staff = (W.INT ? W.INT.npcs : []).filter(function (n) { return rm === 'all' || n.k === rm; });
    L.innerHTML = '<h4>' + (rm === 'all' ? 'ภาพรวมออฟฟิศ' : E_(d.n).toUpperCase()) + '</h4><div class="wgrid">' + rows.map(function (r) { return '<div><small>' + r[0] + '</small><b>' + r[1] + '</b></div>'; }).join('') + '</div><h4>ความเคลื่อนไหวพนักงาน</h4>' +
      staff.slice(0, rm === 'all' ? 10 : 6).map(function (n) { var s = modeLabel(n); return '<div class="wst"><div><b>' + E_(n.name) + '</b><small>' + E_(n.role) + '</small></div><em class="' + s[1] + '">' + s[0] + '</em></div>'; }).join('') + '<div class="wbtns"><button class="wbtn" style="background:#ec4899" data-a="wchat">💬 ถามน้องฟ้า</button></div>';
    R.innerHTML = '<h4>บทสนทนาในออฟฟิศ</h4>' + (feed.length ? feed.slice(0, 7).map(function (f) { return '<div class="wf"><b style="color:' + f.c + '">' + E_(f.n) + '</b>' + E_(f.t) + '<small>' + f.tm + '</small></div>'; }).join('') : '<div class="wf" style="color:var(--gm)">กำลังรอพนักงานคุยกัน...</div>');
  }

  /* ---------- แท็ก 3D ---------- */
  function makeTags() {
    W.D.forEach(function (d) {
      var e = document.createElement('div'); e.className = 'wtag wb'; e.dataset.k = d.k; e.innerHTML = '<i style="background:' + W.hex(d.c) + '22">' + d.ic + '</i>' + d.s + ' <small></small>';
      e.addEventListener('click', function (ev) { ev.stopPropagation(); W.select(d.k); }); WD.appendChild(e); tagEls[d.k] = e;
      W.tagAdd(e, d.g, d.top - 1, 'ext');
    });
    var s = document.createElement('div'); s.className = 'wtag'; s.innerHTML = '<div class="wsec">💬 คุยกับน้องฟ้า</div>'; s.style.pointerEvents = 'none'; s.firstChild.addEventListener('click', function (ev) { ev.stopPropagation(); A.wchat(); }); WD.appendChild(s); W.tagAdd(s, W.secObj(), 3.1, 'ext');
    (W.INT ? W.INT.npcs : []).forEach(function (n) {
      var e = document.createElement('div'); e.className = 'wtag'; e.innerHTML = '<div class="wn' + (n.sec ? ' s' : '') + '">' + (n.sec ? '💬 ' : '') + E_(n.name) + ' · ' + E_(n.role) + '</div>';
      if (n.sec) e.firstChild.addEventListener('click', function (ev) { ev.stopPropagation(); A.wchat(); }); WD.appendChild(e); W.tagAdd(e, n.g, 3.4 * (n.sec ? .92 : .86) + .3, 'int', n.k);
    });
    W.cb.say = function (r) {
      var n = r.n; feed.unshift({ n: n.name, t: r.text, c: W.hex(n.d.c), tm: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }); feed = feed.slice(0, 12);
      if (W.V.mode !== 'int' || !(W.V.room === 'all' ? false : W.V.room === n.k)) { if (W.V.mode === 'int') paintInt(); return; }
      var e = document.createElement('div'); e.className = 'wtag'; e.innerHTML = '<div class="wsay">' + E_(r.text) + '</div>'; WD.appendChild(e);
      e.style.display = 'none'; var rec = { el: e, obj: n.g, dy: 3.4 * .86 + 1.3, mode: 'int', room: n.k }; W.tags.push(rec); setTimeout(function () { var i = W.tags.indexOf(rec); if (i > -1) W.tags.splice(i, 1); if (e.parentNode) e.parentNode.removeChild(e); }, 3600); paintInt();
    };
    W.cb.select = function (k) { paint(); }; W.cb.mode = function () { paint(); }; W.cb.room = function () { paint(); }; W.cb.chat = function () { A.wchat(); };
  }

  /* ---------- ฝ่ายต่าง ๆ (รายละเอียด) ---------- */
  function extra(k) {
    if (k !== 'prod' && k !== 'stock') return; var m = {};
    (S.prods || []).forEach(function (p) { var c = p.categories ? p.categories.name : 'อื่น ๆ', o = m[c] || (m[c] = { n: 0, q: 0, v: 0 }); o.n++; o.q += pqty(p); o.v += pqty(p) * Number(p.current_cost); });
    $('sbody').insertAdjacentHTML('beforeend', '<details class="tri" open><summary>แยกตามประเภท</summary>' + Object.keys(m).map(function (c) { return '<div class="kv"><span>' + esc(c) + '<br><small>' + m[c].n + ' รุ่น</small></span><span>' + m[c].q + ' ชิ้น<br><small>ทุน ฿' + F(m[c].v) + '</small></span></div>'; }).join('') + '</details>');
  }
  function plainSheet(k) {
    var d = W.BD[k]; openSheet(head(esc(d.n)) + met(k).map(function (r) { return kvh(r[0], r[1]); }).join(''));
  }
  A.wdept = function (k) {
    closeSheet(); if (k === 'tax') return taxSheet(); if (k === 'news') return newsSheet(); if (k === 'sec') return secSheet();
    var ok = false; try { if (A.ofc) { A.ofc(k); ok = !!$('sbody').innerHTML; } } catch (e) { ok = false; }
    if (!ok) plainSheet(k); else extra(k);
  };
  async function taxSheet() {
    openSheet(head('ฝ่ายภาษี') + '<div id="txb" class="empty">กำลังคำนวณ...</div>');
    try {
      var y = tdy().slice(0, 4);
      var a = await S.sb.from('sales').select('qty,unit_price,unit_cost').is('voided_at', null).gte('created_at', y + '-01-01T00:00:00+07:00').limit(5000);
      var e = await S.sb.from('expenses').select('amount').is('voided_at', null).gte('paid_on', y + '-01-01').limit(5000);
      if (a.error || e.error) throw (a.error || e.error);
      var inc = 0, cg = 0; a.data.forEach(function (x) { inc += x.unit_price * x.qty; cg += x.unit_cost * x.qty; });
      var ex = e.data.reduce(function (t, x) { return t + Number(x.amount); }, 0), c = window.SmartShopTax.calc({ shop_inc: inc, shop_exp: cg + ex, shop_m: 'actual' });
      if (!$('txb')) return;
      $('txb').outerHTML = kvh('ยอดขายสะสมปีนี้', '฿' + F(inc)) + kvh('ต้นทุนขาย + รายจ่าย', '฿' + F(cg + ex)) + kvh('กำไรสะสม', '฿' + F(inc - cg - ex)) + kvh('เงินได้สุทธิ (หักลดหย่อนส่วนตัว)', '฿' + F(c.net)) + kvh('ภาษีประมาณการ', '฿' + F(c.tax)) +
        '<div class="note" style="margin:10px 0">ประมาณการจากร้านค้าอย่างเดียว ยังไม่รวมค่าเช่า/ลดหย่อนอื่น ใช้หน้าภาษีเพื่อกรอกละเอียด</div><button class="btn" data-a="go" data-v="tax">ไปหน้าคำนวณภาษี</button>';
    } catch (x) { if ($('txb')) $('txb').textContent = 'คำนวณไม่สำเร็จ: ' + (x.message || x); }
  }
  function newsSheet() { openSheet(head('ฝ่ายข่าวเศรษฐกิจ') + '<div class="note"><b>สถานะ: ยังไม่เชื่อมต่อ</b><br>ฝ่ายนี้ต้องดึงข่าวจริงผ่านเซิร์ฟเวอร์และ AI API (มีค่าใช้จ่ายตามการใช้งาน) ระบบจะไม่แต่งข่าวเอง จะเปิดให้เมื่อคุณอนุญาต</div>'); }
  function rentItems(ym) {
    var X = window.SSRent, o = []; if (!X || !X.R.loaded) return o;
    X.R.pays.forEach(function (r) { if (r._left > 0 && X.eff(r).slice(0, 7) === ym) { var l = X.R.leases.find(function (z) { return z.id === r.lease_id; }), u = l && X.unit(l.unit_id); o.push({ d: X.eff(r), t: 'เก็บค่าเช่า ' + (u ? X.uname(u) : '') + ' ฿' + F(r._left), auto: 1 }); } });
    return o;
  }
  function secSheet() {
    var ym = tdy().slice(0, 7), L = TK.filter(function (t) { return t.d.slice(0, 7) === ym; }).concat(rentItems(ym));
    L.sort(function (a, b) { return (a.d + (a.h || '')) < (b.d + (b.h || '')) ? -1 : 1; });
    openSheet(head('ฝ่ายเลขา') + '<small>ตารางเดือนนี้ (ค่าเช่าที่ใกล้ครบกำหนดดึงมาให้อัตโนมัติ)</small>' + (L.length ? L.map(function (t) {
      return '<div class="kv" style="align-items:flex-start;' + (t.done ? 'opacity:.55' : '') + '"><span>' + t.d.slice(8) + '/' + t.d.slice(5, 7) + (t.h ? ' ' + t.h : '') + '<br>' + (t.done ? '<s>' + esc(t.t) + '</s>' : esc(t.t)) + '</span>' +
        (t.auto ? '' : '<span><button class="dsm" style="color:var(--text);border-color:var(--line)" data-a="tkdone" data-v="' + t.id + '">' + (t.done ? 'เปิดใหม่' : 'เสร็จ') + '</button> <button class="dsm" data-a="tkdel" data-v="' + t.id + '">ลบ</button></span>') + '</div>';
    }).join('') : '<div class="empty">ยังไม่มีงานเดือนนี้</div>') +
      '<h3 style="margin-top:14px">เพิ่มงาน / นัดหมาย</h3><label>เรื่องที่ต้องทำ<input id="tkt" placeholder="เช่น โทรตามค่าเช่า"></label><div class="two"><label>วันที่<input id="tkd" type="date" value="' + tdy() + '"></label><label>เวลาเตือน<input id="tkh" type="time"></label></div><div class="err" id="tker"></div><button class="btn" data-a="tkadd">บันทึกและเตือน</button>' +
      '<small>แจ้งเตือนเด้งเมื่อเปิดแอปอยู่ตอนถึงเวลา ข้อมูลเก็บในเครื่องนี้</small>');
  }
  A.tkadd = function () {
    var t = $('tkt').value.trim(), d = $('tkd').value; if (!t || !d) { $('tker').textContent = 'ใส่เรื่องและวันที่'; return; }
    TK.push({ id: String(Date.now()), t: t, d: d, h: $('tkh').value || '', done: 0, n: 0 }); saveTK(); if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); secSheet(); toast('บันทึกงานแล้ว'); paint();
  };
  A.tkdone = function (id) { var t = TK.find(function (x) { return x.id === id; }); if (t) { t.done = t.done ? 0 : 1; saveTK(); secSheet(); paint(); } };
  A.tkdel = function (id) { TK = TK.filter(function (x) { return x.id !== id; }); saveTK(); secSheet(); paint(); };
  setInterval(function () {
    var now = new Date(); TK.forEach(function (t) {
      if (t.done || t.n || new Date(t.d + 'T' + (t.h || '09:00') + ':00') > now) return; t.n = 1; saveTK(); toast('เลขาเตือน: ' + t.t);
      try { if (window.Notification && Notification.permission === 'granted') new Notification('Xiress', { body: t.t }); } catch (e) {}
    });
  }, 30000);

  /* ---------- คลังความรู้เกี่ยวกับเว็บ ---------- */
  function ol(a) { return '<ol style="margin:4px 0 4px 18px;padding:0">' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol>'; }
  function go_(id, label) { return '<br><button class="wbtn" data-a="wgo" data-v="' + id + '">' + label + '</button>'; }
  var KB = [
    [/เพิ่มสินค้า|ลงสินค้า|สร้างสินค้า|เพิ่มของ|ของใหม่/, 'เพิ่มสินค้าใหม่ทำได้ที่หน้า "สินค้า" ค่ะ' + ol(['กดปุ่ม <b>+</b> มุมขวาล่าง', 'ถ่ายรูป/เลือกรูป ใส่ชื่อ เลือกประเภท ต้นทุน ราคาขายตั้งต้น', 'ใส่ไซส์/ลาย และจำนวนแยกตามสถานที่จัดเก็บ (เพิ่มได้หลายไซส์)', 'กดบันทึก ระบบจะสร้างรหัส (เช่น PAN-001) และ QR Code ให้อัตโนมัติ']) + go_('prod', 'ไปหน้าสินค้า')],
    [/qr|คิวอาร์|สแกน|บาร์โค้ด/i, 'QR Code ของสินค้า:' + ol(['เปิดรายละเอียดสินค้า แล้วกด "QR Code สินค้า"', 'ดาวน์โหลดเป็นรูป หรือพิมพ์ออกมาติดสินค้าได้', 'ตอนขาย/ค้นหา สแกน QR (ไอคอนในช่องค้นหา) จะเปิดสินค้านั้นทันที']) + '<small>ประเภทสินค้าก็มี QR ประจำประเภทที่หน้าตั้งค่า</small>' + go_('prod', 'ไปหน้าสินค้า')],
    [/สถานะ|สีเขียว|สีฟ้า|สีแดง|สีดำ|พร้อมขาย|สำรอง/, 'สถานะสินค้ามี 4 สี: <b>เขียว</b> = พร้อมขาย, <b>ฟ้า</b> = สำรอง, <b>แดง</b> = เสีย, <b>ดำ</b> = หมด เปลี่ยนได้ที่รายละเอียดสินค้า หัวข้อ "เปลี่ยนสถานะ" ค่ะ'],
    [/เติมสินค้า|ย้ายสินค้า|ย้ายของ|ปรับสต|ปรับจำนวน|โอนสต|จัดการสต/, 'จัดการสต๊อกทำที่รายละเอียดสินค้า หัวข้อ "จัดการสต๊อก" ค่ะ:' + ol(['<b>เติมสินค้า</b> เพิ่มจำนวนเข้าสถานที่นั้น', '<b>ย้ายสินค้า</b> ย้ายระหว่างสถานที่จัดเก็บ', '<b>ปรับจำนวนสต๊อก</b> แก้ให้ตรงกับของจริง']) + go_('stock', 'ไปหน้าคลัง')],
    [/แก้ไขสินค้า|แก้สินค้า|ลบสินค้า|ลบของ|ปัดซ้าย|ลบไซส์/, 'แก้ไข/ลบสินค้า: เปิดรายละเอียดสินค้าแล้วกด "แก้ไขสินค้า" หรือในหน้าคลังให้<b>ปัดการ์ดสินค้าไปทางซ้าย</b> จะมีปุ่มแก้ไข/ลบ การลบจะมีการยืนยันก่อนเสมอค่ะ'],
    [/ยกเลิกการขาย|ยกเลิกบิล|ยกเลิกรายการขาย|ขายผิด|คืนสินค้า|void/i, 'ขายผิดยกเลิกได้ที่เมนู "ประวัติการขาย" กด "ยกเลิกการขาย" ระบบจะคืนสต๊อกให้ค่ะ' + go_('ord', 'ไปประวัติการขาย')],
    [/ประวัติการขาย|บิลย้อนหลัง|ดูบิล/, 'ดูบิลย้อนหลังได้ที่เมนู "ประวัติการขาย" ค่ะ' + go_('ord', 'เปิดประวัติการขาย')],
    [/ขายสินค้า|วิธีขาย|ตะกร้า|ชำระเงิน|ขายของ|คิดเงิน|ตัดสต/, 'วิธีขาย (เปิดจากหน้าสินค้า):' + ol(['ค้นหาหรือสแกน QR สินค้า', 'เลือกไซส์/ลาย แล้ว "เพิ่มลงตะกร้า"', 'เปิดตะกร้า เลือกวิธีชำระ: เงินสด / บัตร / โอนเงิน / อื่น ๆ', 'กดชำระเงิน ระบบตัดสต๊อกและบันทึกยอดขายให้อัตโนมัติ']) + go_('sell', 'ไปหน้าขายสินค้า')],
    [/ปิดยอด|รายจ่าย|ค่าน้ำ|ค่าไฟ|ค่าแรง|บัญชี/, 'เมนู "บัญชี": บันทึกรายจ่าย (ค่าเช่า น้ำ ไฟ เดินทาง ค่าแรง บรรจุภัณฑ์ อื่น ๆ) ดูรายรับ-รายจ่าย และ "ปิดยอดประจำวัน" เพื่อเช็กเงินสดที่ควรมีกับของจริงค่ะ' + go_('acc', 'ไปหน้าบัญชี')],
    [/รายงาน|csv|ส่งออก|สำรองข้อมูล|ดาวน์โหลดข้อมูล|export/i, 'หน้า "รายงาน" ดูสรุปรายวัน/สัปดาห์/เดือน/ปี (ยอดขาย กำไร รายจ่าย ค่าเช่า) ส่วนการสำรองข้อมูลเป็นไฟล์ CSV (สินค้า ประวัติขาย รายจ่าย รับค่าเช่า) อยู่ที่หน้า "ตั้งค่า" ค่ะ' + go_('rep', 'ไปหน้ารายงาน')],
    [/ภาษี|ลดหย่อน|ยื่นภาษี/, 'เมนู "ภาษี" ช่วยคำนวณภาษีเงินได้บุคคลธรรมดา กรอกรายได้ ลดหย่อน (ครอบครัว ประกัน กองทุน) แล้วสรุปให้ เป็นการประมาณการ ยื่นจริงเช็กกับสรรพากรอีกทีนะคะ' + go_('tax', 'ไปหน้าภาษี')],
    [/อสังหา|ค่าเช่า|ห้องเช่า|ผู้เช่า|สัญญาเช่า|ย้ายออก|ค่าซ่อม|มัดจำ|ตึก/, 'เมนู "อสังหาเช่า": เพิ่มตึก/ห้อง ทำสัญญาเช่า (ไม่เกิน 3 ปี) รับเงินค่าเช่า เลื่อนวันครบกำหนด บันทึกค่าซ่อมบำรุง และย้ายผู้เช่าออกได้ค่ะ ค่าเช่าที่ใกล้ครบกำหนดจะเด้งในตารางของฟ้าด้วย' + go_('rent', 'ไปหน้าอสังหาเช่า')],
    [/ตั้งค่า|รหัสผ่าน|ธีม|โหมดมืด|dark|ประเภทสินค้า|สถานที่จัดเก็บ|เมืองพยากรณ์|ขีดต่ำ|ใกล้หมดเมื่อ/i, 'หน้า "ตั้งค่า": สลับธีมสว่าง/มืด, ตั้งจำนวนเตือนของใกล้หมด, เลือกเมืองพยากรณ์อากาศ, เพิ่ม/แก้ชื่อประเภทสินค้า, เพิ่มสถานที่จัดเก็บ, ส่งออก CSV และเปลี่ยนรหัสผ่านค่ะ' + go_('set', 'ไปหน้าตั้งค่า')],
    [/ล็อกอิน|เข้าสู่ระบบ|ออกจากระบบ|ลืมรหัส|login/i, 'เข้าสู่ระบบด้วยอีเมลกับรหัสผ่านค่ะ ออกจากระบบได้ที่หน้า "ตั้งค่า" ส่วนเปลี่ยนรหัสผ่านก็อยู่ที่นั่นเหมือนกัน ถ้าลืมรหัสต้องให้ผู้ดูแลระบบรีเซ็ตให้นะคะ'],
    [/ติดตั้ง|ลงแอป|หน้าจอโฮม|pwa|เพิ่มไปยังหน้าจอ/i, 'เปิดเว็บนี้ในมือถือ แล้วเลือก "เพิ่มไปยังหน้าจอโฮม" (Safari: ปุ่มแชร์ → Add to Home Screen / Chrome: เมนู → ติดตั้งแอป) จะได้ไอคอนเปิดเหมือนแอปเลยค่ะ'],
    [/dashboard|แดชบอร์ด|ภาพรวมร้าน/i, 'หน้า Dashboard ซ่อนไว้แล้วค่ะ ถ้าอยากดูภาพรวม พิมพ์ "สรุปวันนี้" ได้เลย หรือดูยอดย้อนหลังที่เมนู "รายงาน" นะคะ' + go_('rep', 'ไปหน้ารายงาน')],
    [/แมพ|แผนที่|เมือง|ฝ่าย|ภายใน|เข้าไปข้างใน|หมุน|ซูม|เลขา/, 'หน้าแมพนี้คือภาพรวมร้านแบบ 3 มิติค่ะ: แตะตึกเพื่อดูข้อมูลของแต่ละฝ่าย กด "เข้าไปข้างใน" เพื่อดูออฟฟิศ ลากเพื่อเลื่อนแมพ บีบนิ้ว/ปุ่ม + − เพื่อซูม และปุ่มลูกศรหมุนเพื่อหมุนมุมมอง ส่วนคุยกับฟ้าได้ที่ปุ่ม 🌸 หรือแตะตัวฟ้าที่หน้าตึกเลขาเลยค่ะ']
  ];
  var HOWCUE = /ยังไง|วิธี|อย่างไร|ทำไง|ที่ไหน|หน้าไหน|เมนูไหน|ใช้.*ไง|ใช้งาน|อยู่ตรงไหน|คืออะไร|หมายถึง|ทำอะไรได้|มีอะไรบ้าง|เป็นยังไง|สอน|แนะนำ/;
  var MENU = '<b>เมนูทั้งหมด</b> ' + '<ul><li><b>สินค้า / คลัง</b> เพิ่ม แก้ ดูสต๊อก แยกตามสถานที่</li><li><b>ขายสินค้า</b> เปิดสินค้าแล้วกดปุ่ม "ขายสินค้า" · ดูย้อนหลังที่ <b>ประวัติการขาย</b></li><li><b>บัญชี</b> รายจ่าย ปิดยอด</li><li><b>รายงาน</b> วัน/สัปดาห์/เดือน/ปี</li><li><b>อสังหาเช่า</b> ห้อง สัญญา ค่าเช่า</li><li><b>ภาษี</b> คำนวณภาษีบุคคลธรรมดา</li><li><b>ตั้งค่า</b> ธีม แจ้งเตือน ส่งออกข้อมูล</li></ul>';

  /* ---------- สมองของน้องฟ้า ---------- */
  function hour() { return +new Date().toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' }); }
  function tword() { var h = hour(); return h < 5 ? 'ดึก' : h < 11 ? 'เช้า' : h < 13 ? 'เที่ยง' : h < 17 ? 'บ่าย' : h < 19 ? 'เย็น' : 'ค่ำ'; }
  var JOKES = ['ทำไมกุญแจถึงไม่เคยหลงทาง… เพราะมันมี "รู" นำทางไงคะ 😆', 'พนักงานบัญชีไปเที่ยวทะเลแล้วไม่สนุกเลย เพราะเจอแต่ "ยอดคลื่น" ที่ไม่ลงตัวค่ะ 🌊', 'สินค้าที่ขายดีที่สุดในโลกคืออะไร… "ความหวัง" ค่ะ ใครก็ซื้อ 😄', 'ถามว่าทำไมเลขาต้องใจเย็น… เพราะนัดเยอะจนใจ "ว่าง" ไม่ได้ค่ะ 🤭', 'ผักอะไรที่ร้านค้าชอบ… "ผักกาด" เพราะ "กาด" แปลว่าตลาดไงคะ 🥬'];
  var FOODS = ['ข้าวมันไก่', 'ผัดกะเพราไข่ดาว', 'ส้มตำไก่ย่าง', 'ก๋วยเตี๋ยวเรือ', 'ข้าวหมูกระเทียม', 'ราเมน', 'หมูกระทะ', 'โจ๊กร้อน ๆ', 'ข้าวผัดปู', 'ชานมไข่มุกสักแก้ว'];
  function smallTalk(s) {
    var m;
    if (/^(สวัสดี|หวัดดี|ดีจ้า|ดีค่ะ|ดีครับ|ดีงับ|hello|hi\b|hey|เฮ้|โย่ว|ว่าไง)/i.test(s)) return pick(['สวัสดีตอน' + tword() + 'ค่ะ 🌸 วันนี้มีอะไรให้ฟ้าช่วยไหมคะ', 'ว่าไงเพื่อน! ตอน' + tword() + 'แล้ว กินอะไรหรือยังคะ?', 'หวัดดีค่ะ ฟ้ารออยู่เลย 😊 จะถามเรื่องร้าน หรือจะนั่งคุยเล่นก็ได้นะ']);
    if (/สบายดี|เป็นยังไงบ้าง|เป็นไงบ้าง|เหนื่อยไหม|วันนี้เป็นไง|ทำอะไรอยู่/.test(s)) return pick(['ฟ้าสบายดีค่ะ กำลังจัดตารางอยู่เลย 📅 แล้วเพื่อนล่ะ วันนี้เป็นไงบ้าง?', 'สบายดีค่ะ ได้คุยกับเพื่อนก็ยิ่งดี 💕 เล่าให้ฟังได้นะว่าวันนี้เจออะไรมา']);
    if (/ขอบคุณ|ขอบใจ|thanks|thank you|ขอบคุงง/i.test(s)) return pick(['ยินดีเลยค่ะ 🌸', 'ไม่เป็นไรค่ะเพื่อน ถามได้ตลอดเลยนะ', 'แค่นี้เอง สบายมากค่ะ 😊']);
    if (/ชื่ออะไร|ใครอ่ะ|คุณคือใคร|เธอคือใคร|แนะนำตัว/.test(s)) return 'ฟ้าชื่อ <b>น้องฟ้า</b> เป็นเลขาประจำร้านนี้ค่ะ 🌸 ตอบเรื่องข้อมูลในเว็บ ช่วยดูยอด/สต๊อก/ค่าเช่า จดงานเตือนงาน และคุยเล่นเป็นเพื่อนได้ด้วยนะ (ฟ้าเป็นระบบตอบตามกฎในเครื่อง ไม่ใช่คนจริง ๆ ค่ะ)';
    if (/ทำอะไรได้|ช่วยอะไรได้|มีอะไรบ้าง|ใช้ยังไง|help|ช่วยด้วย/i.test(s)) return 'ฟ้าช่วยได้หลายอย่างค่ะ:<ul><li>ถามยอดขาย กำไร สินค้าขายดี ของที่ควรเติม</li><li>ถามจำนวนสต๊อก ค้นสินค้าจากรหัส/ชื่อ (เช่น "PAN-001 เหลือเท่าไหร่")</li><li>ค่าเช่าค้าง งานที่ต้องทำ — พิมพ์ "เตือนพรุ่งนี้ 10:00 โทรหาลูกค้า" ฟ้าจดให้</li><li>วิธีใช้เว็บนี้ทุกเมนู</li><li>หรือคุยเล่น ขอมุก ขอกำลังใจ ก็ได้ 😄</li></ul>';
    if (/เหนื่อย|เครียด|ท้อ|หมดแรง|เศร้า|เหงา|ไม่ไหว|หงุดหงิด|กังวล/.test(s)) return pick(['โอ๋ ๆ เพื่อน วันนี้ทำเต็มที่แล้วนะคะ 🫶 ลองพักสัก 5 นาที ดื่มน้ำ ยืดเส้นยืดสาย เดี๋ยวฟ้าดูงานให้เอง อยากให้ฟ้าสรุปสิ่งที่ต้องทำให้ไหมคะ?', 'ฟ้าอยู่ตรงนี้นะ ไม่ต้องแบกคนเดียว 💕 เล่าได้เลยว่าเรื่องอะไรหนักใจที่สุด หรือถ้าอยากเบา ๆ ให้ฟ้าเล่ามุกให้ฟังก็ได้นะ', 'ธุรกิจมีขึ้นมีลงเป็นเรื่องปกติค่ะ ค่อย ๆ ไปทีละอย่าง เริ่มจากเรื่องเล็กที่ทำเสร็จได้ก่อนนะ 🌱']);
    if (/หิว|กินอะไรดี|กินข้าว|อาหาร|มื้อ/.test(s)) return 'ตอน' + tword() + 'แบบนี้ ฟ้าขอโหวต <b>' + pick(FOODS) + '</b> ค่ะ 🍽️ เพื่อนชอบแนวไหนล่ะ?';
    if (/เบื่อ|ไม่มีอะไรทำ|คุยเป็นเพื่อน|คุยเล่น|คุยหน่อย|ว่างอ่ะ/.test(s)) return pick(['มาคุยกันค่ะ! ถามเล่น ๆ ก่อน — ถ้าได้เลือกไปเที่ยวได้ที่เดียว เพื่อนจะไปไหนคะ? ✈️', 'เบื่อเหรอ งั้นเล่นทายใจกัน ฟ้าคิดเลข 1-10 ไว้ในใจ เพื่อนลองทายสิคะ 😆', 'ขอมุกไหมคะ? พิมพ์ "เล่ามุก" ได้เลย หรือเล่าเรื่องที่ทำให้ยิ้มวันนี้ให้ฟ้าฟังก็ได้นะ']);
    if (/มุก|ตลก|ขำ|เล่าเรื่อง|ฮาหน่อย/.test(s)) return pick(JOKES);
    if (/เก่งจัง|เก่งมาก|น่ารัก|สวย|ฉลาด|เจ๋ง|ดีมาก|สุดยอด/.test(s)) return pick(['อุ๊ย เขินเลย 🙈 ขอบคุณนะคะเพื่อน', 'ฮึฮึ ฟ้าตั้งใจค่ะ 💕 เพื่อนก็เก่งมากเหมือนกันที่ดูแลร้านเองทั้งหมด', 'ได้ยินแบบนี้ฟ้ามีแรงทำงานต่อเลยค่ะ ✨']);
    if (/รัก|คิดถึง|ชอบ(เธอ|ฟ้า)|เป็นแฟน/.test(s)) return pick(['ฟ้าก็คิดถึงเพื่อนเหมือนกันค่ะ 💕 (แต่ฟ้าเป็นเลขา AI นะ เป็นได้แค่เพื่อนที่ดีที่สุดเลย 😆)', 'น่ารักจัง 🌸 ขอบคุณที่มาคุยด้วยนะคะ']);
    if (/อายุเท่าไหร่|กี่ขวบ/.test(s)) return 'ฟ้าอายุเท่ากับเวลาที่เว็บนี้เปิดใช้งานค่ะ 😄 ยังใหม่เอี่ยมเลย';
    if (/อยู่ที่ไหน|อยู่ไหน|บ้านอยู่/.test(s)) return 'ฟ้าอยู่ในตึกเลขาตรงกลางแมพนี้เลยค่ะ มีห้องสไตล์ญี่ปุ่นด้วยนะ 🏯 กด "เข้าไปข้างใน" ได้เลย';
    if (/ชอบกิน|อาหารโปรด|ชอบอะไร/.test(s)) return 'ฟ้าชอบชาเขียวร้อน ๆ กับขนมโมจิค่ะ 🍵 ส่วนเพื่อนล่ะคะ?';
    if (/ง่วง|นอน|ดึกแล้ว|ราตรี/.test(s)) return hour() >= 21 || hour() < 5 ? 'ดึกแล้วนะคะ งานพรุ่งนี้ฟ้าจดไว้ให้แล้ว นอนพักผ่อนเถอะ ราตรีสวัสดิ์ค่ะ 🌙' : 'ง่วงก็ไปล้างหน้าหรือชงกาแฟสักแก้วไหมคะ ☕ เดี๋ยวฟ้าเตือนให้พักตา 20 วินาทีทุกชั่วโมงนะ';
    if (/กาแฟ|ชา\b|ชาเขียว|น้ำ/.test(s)) return 'ชงให้เลยค่ะ ☕ เอาหวานน้อยใช่ไหมคะ? (ฟ้าเสิร์ฟได้แค่ในจินตนาการนะ แต่ตั้งใจชงสุด ๆ)';
    if (/บาย|ลาก่อน|ไปก่อน|แล้วเจอกัน|bye/i.test(s)) return pick(['บายค่ะเพื่อน เจอกันใหม่นะ 👋', 'ไปดี ๆ นะคะ มีอะไรเรียกฟ้าได้ตลอด 🌸']);
    if (/ขอโทษ|โทษที|sorry/i.test(s)) return 'ไม่เป็นไรเลยค่ะ ไม่ต้องคิดมาก 😊';
    if (/^(555+|ฮ่า+|55+|ขำ|lol|haha)/i.test(s)) return pick(['ฮ่า ๆ ขำด้วยเลย 😆', '555 เห็นเพื่อนหัวเราะฟ้าก็มีความสุขค่ะ', 'หัวเราะแล้วสบายใจขึ้นเนอะ 😄']);
    if (/^(ใช่|ครับ|ค่ะ|คะ|โอเค|ok|okay|ได้|เอา|อืม|อ่อ|อ๋อ)/i.test(s) && s.length < 10) return pick(['โอเคค่ะ 👌', 'รับทราบค่ะ มีอะไรเพิ่มบอกฟ้าได้เลยนะ', 'ค่ะ ๆ 😊']);
    if (/^(ไม่|ไม่เอา|ไม่ใช่)/.test(s) && s.length < 10) return 'ได้ค่ะ ไม่เป็นไร ถ้าเปลี่ยนใจเรียกฟ้าได้เลยนะ';
    if (/เวลา|กี่โมง|วันนี้วัน|วันที่เท่าไหร่|วันอะไร/.test(s)) return 'ตอนนี้ ' + new Date().toLocaleString('th-TH', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Bangkok' }) + ' ค่ะ ⏰';
    if (/ให้กำลังใจ|เป็นกำลังใจ|ปลอบ|อวยพร/.test(s)) return pick(['สู้ ๆ นะคะ ขายได้ทีละชิ้นก็คือก้าวหนึ่งแล้วค่ะ 💪', 'เพื่อนทำได้อยู่แล้ว ฟ้าเชื่อ! ✨', 'ทุกร้านที่ใหญ่ ก็เคยเริ่มจากชิ้นแรกเหมือนกันค่ะ 🌱']);
    return null;
  }
  function viaAI(v, cb) {
    var inp = $('aiin'); if (!inp || !A.aisend) return cb('ตอนนี้ดึงข้อมูลวิเคราะห์ไม่ได้ ลองรีเฟรชหน้านี้แล้วถามใหม่นะคะ');
    inp.value = v; A.aisend(); var tries = 0, iv = setInterval(function () {
      var a = document.querySelector('#aiout .ans'), q = a && a.querySelector('.q'); tries++;
      if (a && q && q.textContent === v && a.textContent.indexOf('กำลังวิเคราะห์') < 0) { clearInterval(iv); var c = a.cloneNode(true); c.querySelector('.q').remove(); var sm = c.querySelector('small'); cb((sm ? '<small>' + sm.innerHTML + '</small><br>' : '') + c.innerHTML.replace(/<small>.*?<\/small>/, '')); }
      else if (tries > 40) { clearInterval(iv); cb('ดึงข้อมูลไม่ทัน ลองถามใหม่อีกครั้งนะคะ'); }
    }, 400);
  }
  function findProd(q) {
    var m = q.match(/[A-Za-z]{3}-?\d{3}/); if (m) { var c = m[0].toUpperCase(); if (c.indexOf('-') < 0) c = c.slice(0, 3) + '-' + c.slice(3); var p = (S.prods || []).find(function (x) { return x.code.toUpperCase() === c; }); if (p) return p; }
    var ql = q.toLowerCase(); return (S.prods || []).find(function (x) { return x.name.length >= 3 && ql.indexOf(x.name.toLowerCase()) > -1; });
  }
  function prodCard(p) {
    var T = thr(), q = pqty(p);
    return '<b>' + E_(p.code) + ' · ' + E_(p.name) + '</b><div class="kv"><span>สถานะ</span><b>' + (ST[p.status] || p.status) + '</b></div><div class="kv"><span>คงเหลือรวม</span><b>' + q + ' ชิ้น' + (q <= T ? ' ⚠️' : '') + '</b></div><div class="kv"><span>ราคาขายตั้งต้น</span><b>฿' + F(p.base_price) + '</b></div><div class="kv"><span>ต้นทุน</span><b>฿' + F(p.current_cost) + '</b></div>' +
      (p.variants || []).map(function (v) { return '<div class="kv"><span>' + E_(vname(v)) + '</span><span>' + (S.locs || []).map(function (l) { return E_(l.name) + ' ' + lq(v, l.id); }).join(' · ') + '</span></div>'; }).join('') + '<button class="wbtn" data-a="open" data-v="' + E_(p.code) + '">เปิดรายละเอียด</button>';
  }
  function addTaskFrom(raw) {
    var m = raw.match(/^(?:ช่วย)?(?:จดงาน|เพิ่มงาน|จดไว้|เตือน(?:ฉัน|ให้|หน่อย)?|นัด)\s*(.*)$/); if (!m || !m[1].trim()) return null;
    var txt = m[1].trim(), d = tdy(), h = '', tm;
    if (/พรุ่งนี้/.test(txt)) { d = addD(d, 1); txt = txt.replace('พรุ่งนี้', ''); } else if (/มะรืน/.test(txt)) { d = addD(d, 2); txt = txt.replace('มะรืนนี้', '').replace('มะรืน', ''); } else txt = txt.replace('วันนี้', '');
    if ((tm = txt.match(/(\d{1,2})[:.](\d{2})/))) { h = ('0' + tm[1]).slice(-2) + ':' + tm[2]; txt = txt.replace(tm[0], ''); }
    else if ((tm = txt.match(/(\d{1,2})\s*โมง/))) { var hh = +tm[1]; if (hh < 7 && /บ่าย|เย็น|ค่ำ/.test(txt)) hh += 12; h = ('0' + hh).slice(-2) + ':00'; txt = txt.replace(tm[0], ''); }
    txt = txt.replace(/\s+/g, ' ').replace(/^(ว่า|ที่|ให้)\s*/, '').trim(); if (!txt) return null;
    TK.push({ id: String(Date.now()), t: txt, d: d, h: h, done: 0, n: 0 }); saveTK(); paint();
    return 'จดแล้วค่ะ ✅ <b>' + E_(txt) + '</b><br><small>วันที่ ' + d.slice(8) + '/' + d.slice(5, 7) + (h ? ' เวลา ' + h : '') + ' · ฟ้าจะเด้งเตือนตอนถึงเวลา (ตอนเปิดแอปอยู่)</small><br><button class="wbtn o" data-a="wdept" data-v="sec">เปิดตารางงาน</button>';
  }
  function dailySummary() {
    var t = today(), low = lowList(), ri = rentInfo(), L = [];
    L.push('ยอดขายวันนี้ <b>฿' + F(sumS(t, rv)) + '</b> (' + t.length + ' รายการ) · กำไรขั้นต้น ฿' + F(sumS(t, gp)));
    L.push(low.length ? 'ของใกล้หมด/หมด <b>' + low.length + ' รุ่น</b>' + (low.length ? ' เช่น ' + low.slice(0, 3).map(function (p) { return E_(p.code); }).join(', ') : '') : 'ไม่มีของใกล้หมด 👍');
    L.push(ri ? (ri.over ? 'ค่าเช่าค้าง <b>' + ri.over + ' งวด</b> รวม ฿' + F(ri.amt) : 'ค่าเช่าไม่มีค้างค่ะ') : 'ข้อมูลค่าเช่ากำลังโหลด');
    L.push(pendingN() ? 'งานที่ต้องทำวันนี้ <b>' + pendingN() + '</b> รายการ' : 'ไม่มีงานค้างวันนี้');
    return '<b>สรุปวันนี้</b><ul>' + L.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
  }
  function brain(raw, done) {
    var q = raw.trim(), s = q.replace(/(ค่ะ|คะ|ครับ|นะ|น่ะ|จ้ะ|จ้า|หน่อย|ด้วย)+\s*$/g, '').trim() || q, t;
    if (!DT.ok) loadData(true);
    if ((t = addTaskFrom(q))) return done(t);
    if (/^(ลบงานทั้งหมด|ล้างงาน)/.test(q)) { return done('เรื่องลบงาน ฟ้าให้ลบเองในตารางงานจะปลอดภัยกว่านะคะ<br><button class="wbtn o" data-a="wdept" data-v="sec">เปิดตารางงาน</button>'); }
    var p = findProd(q);
    if (p && !HOWCUE.test(q)) return done(prodCard(p));
    if (/สรุป(วันนี้|ให้|หน่อย)?$|ภาพรวม|แจ้งเตือน|ต้องระวัง|ต้องทำอะไร|มีอะไรด่วน|เช็คร้าน|เช็กร้าน/.test(s) && !/ภาษี|รายงาน/.test(s)) return done(dailySummary());
    var how = HOWCUE.test(s) || s.length < 14, k;
    if (HOWCUE.test(s) && /เมนู(ทั้งหมด|อะไร)|มีเมนู|หน้าอะไรบ้าง|ใช้เว็บ|เว็บนี้/.test(s)) return done(MENU);
    for (k = 0; k < KB.length; k++) if (KB[k][0].test(s) && (HOWCUE.test(s) || /^(ขอ)?(วิธี)/.test(s))) return done(KB[k][1]);
    /* ข้อมูลวิเคราะห์ (ใช้ระบบเดิมของหน้า AI) */
    var td = /วันนี้/.test(s), mo = /เดือน/.test(s);
    if (/กำไร/.test(s) && mo) { var g = sumS(month(), gp), e = sumS(monthExp(), function (x) { return Number(x.amount); }); return done(DT.ok ? '<b>เดือนนี้</b><div class="kv"><span>กำไรขั้นต้น</span><b>฿' + F(g) + '</b></div><div class="kv"><span>รายจ่าย</span><b>฿' + F(e) + '</b></div><div class="kv"><span>กำไรหลังหักรายจ่าย</span><b>฿' + F(g - e) + '</b></div>' : 'กำลังโหลดข้อมูล ลองถามอีกครั้งนะคะ'); }
    if (/(ยอดขาย|ขายได้|ขาย).*(เดือน)|เดือน.*(ยอดขาย|ขายได้)/.test(s)) return done(DT.ok ? 'ยอดขายเดือนนี้ <b>฿' + F(sumS(month(), rv)) + '</b> จาก ' + month().length + ' รายการ (' + F(sumS(month(), function (x) { return x.qty; })) + ' ชิ้น)' : 'กำลังโหลดข้อมูล ลองถามอีกครั้งนะคะ');
    if (td && /กำไร/.test(s)) { if (!DT.ok) return viaAI('วันนี้กำไรเท่าไหร่?', done); var tt = today(), te = DT.exps.filter(function (x) { return x.paid_on === tdy(); }), gg = sumS(tt, gp), ee = sumS(te, function (x) { return Number(x.amount); }); return done(!tt.length && !te.length ? 'วันนี้ยังไม่มีรายการขายหรือรายจ่ายในระบบค่ะ' : '<b>กำไรวันนี้</b><div class="kv"><span>กำไรขั้นต้น</span><b>฿' + F(gg) + '</b></div><div class="kv"><span>รายจ่ายวันนี้</span><b>฿' + F(ee) + '</b></div><div class="kv"><span>กำไรหลังหักรายจ่าย</span><b>฿' + F(gg - ee) + '</b></div>'); }
    if (/ยอดขาย|ขายได้|ขายไป|ยอดวันนี้|รายได้/.test(s) && !/ดี/.test(s)) { if (!DT.ok) return viaAI('วันนี้ขายได้เท่าไหร่?', done); var ts = today(); return done(ts.length ? 'ยอดขายวันนี้ <b>฿' + F(sumS(ts, rv)) + '</b> จาก ' + ts.length + ' รายการ (' + F(sumS(ts, function (x) { return x.qty; })) + ' ชิ้น) ค่ะ' : 'วันนี้ยังไม่มีรายการขายค่ะ'); }
    if (/ขายดี|ขายได้ดี|ยอดนิยม|best/i.test(s)) return viaAI('สินค้าขายดีที่สุด', done);
    if (/ควรเติม|เติมสินค้า|เติมของ|สั่งของ|สั่งสินค้า|ควรสั่ง/.test(s) && !how) return viaAI('ควรเติมสินค้าอะไร?', done);
    if (/ค้างสต|ขายไม่ออก|ไม่ขยับ|ของค้าง|ทุนจม/.test(s)) return viaAI('สินค้าค้างสต๊อก', done);
    if (/ผิดปกติ/.test(s)) return viaAI('รายจ่ายผิดปกติ', done);
    if (/ลดต้นทุน|ประหยัด/.test(s)) return viaAI('ลดต้นทุนยังไง', done);
    if (/ตรวจราคา|ราคาขาย|ตั้งราคา|ราคาต่ำ/.test(s)) return viaAI('ตรวจราคาขาย', done);
    /* ข้อมูลสต๊อก (คำนวณเอง) */
    if (/ใกล้หมด|ของเหลือน้อย|สินค้าหมด|หมดสต|ของหมด/.test(s)) {
      var lw = lowList().sort(function (a, b) { return pqty(a) - pqty(b); });
      return done(lw.length ? 'ของใกล้หมด (เหลือ ≤ ' + thr() + ' ชิ้น) มี <b>' + lw.length + ' รุ่น</b><ul>' + lw.slice(0, 8).map(function (x) { return '<li>' + E_(x.code + ' ' + x.name) + ' — เหลือ ' + pqty(x) + '</li>'; }).join('') + '</ul>' : 'ตอนนี้ไม่มีสินค้าใกล้หมดค่ะ 👍');
    }
    if (/กี่รุ่น|กี่ชิ้น|มีสินค้า|สินค้าทั้งหมด|จำนวนสินค้า|สต็อกรวม|สต๊อกรวม|ของในคลัง/.test(s)) return done('มีสินค้า <b>' + F((S.prods || []).length) + ' รุ่น</b> รวม <b>' + F(totalQty()) + ' ชิ้น</b> ค่ะ');
    if (/มูลค่า|ทุนรวม|ต้นทุนรวม/.test(s)) { var vv = (S.prods || []).reduce(function (a, x) { return a + pqty(x) * Number(x.current_cost || 0); }, 0); return done('มูลค่าสต๊อกตามราคาทุนรวม <b>฿' + F(vv) + '</b> ค่ะ'); }
    if (/สถานที่|ที่เก็บ|แยกตามที่|แต่ละที่|คลัง.*เท่า|สต็อก.*ที่/.test(s) && (S.locs || []).length) return done('<b>สต๊อกแยกตามสถานที่</b>' + S.locs.map(function (l) { var n = (S.prods || []).reduce(function (a, x) { return a + (x.variants || []).reduce(function (b, v) { return b + lq(v, l.id); }, 0); }, 0); return '<div class="kv"><span>' + E_(l.name) + '</span><b>' + F(n) + ' ชิ้น</b></div>'; }).join(''));
    if (/ประเภท|หมวด/.test(s) && !how) { var cm = {}; (S.prods || []).forEach(function (x) { var c = x.categories ? x.categories.name : 'อื่น ๆ'; cm[c] = (cm[c] || 0) + 1; }); return done('<b>ประเภทสินค้า</b>' + Object.keys(cm).map(function (c) { return '<div class="kv"><span>' + E_(c) + '</span><b>' + cm[c] + ' รุ่น</b></div>'; }).join('')); }
    if (/สถานะ|พร้อมขาย|สำรอง/.test(s) && !how) { var st = { green: 0, blue: 0, red: 0, black: 0 }; (S.prods || []).forEach(function (x) { st[x.status]++; }); return done('<b>สถานะสินค้า</b>' + Object.keys(st).map(function (c) { return '<div class="kv"><span>' + ST[c] + '</span><b>' + st[c] + ' รุ่น</b></div>'; }).join('')); }
    if (/ค่าเช่า|ผู้เช่า|ห้องเช่า|ค้างจ่าย|ค้างชำระ/.test(s) && !how) { var ri = rentInfo(); if (!ri) return done('กำลังโหลดข้อมูลอสังหาอยู่ค่ะ ลองถามอีกครั้งในอีกสักครู่นะคะ<button class="wbtn o" data-a="wgo" data-v="rent">เปิดหน้าอสังหาเช่า</button>'); return done(ri.over ? 'ค่าเช่าค้างชำระ <b>' + ri.over + ' งวด</b> รวม <b>฿' + F(ri.amt) + '</b> ค่ะ<br><button class="wbtn" data-a="wgo" data-v="rent">ดูรายละเอียด</button>' : 'ตอนนี้ไม่มีค่าเช่าค้างค่ะ 🎉 (มี ' + ri.units + ' ยูนิต)'); }
    if (/งาน|นัด|ตาราง|เตือน/.test(s) && !how) { var pl = TK.filter(function (x) { return !x.done; }).sort(function (a, b) { return (a.d + a.h) < (b.d + b.h) ? -1 : 1; }); return done(pl.length ? '<b>งานที่ยังไม่เสร็จ ' + pl.length + ' รายการ</b><ul>' + pl.slice(0, 6).map(function (x) { return '<li>' + x.d.slice(8) + '/' + x.d.slice(5, 7) + (x.h ? ' ' + x.h : '') + ' — ' + E_(x.t) + '</li>'; }).join('') + '</ul><button class="wbtn o" data-a="wdept" data-v="sec">เปิดตารางงาน</button>' : 'ยังไม่มีงานค้างเลยค่ะ ✨ อยากให้จดอะไรพิมพ์ว่า "เตือนพรุ่งนี้ 10:00 โทรหาลูกค้า" ได้เลยนะ'); }
    if (/ภาษี/.test(s)) return done('ภาษีคำนวณแบบประมาณการได้ค่ะ ฟ้าเปิดสรุปให้ดูเลยนะ<br><button class="wbtn" data-a="wdept" data-v="tax">ดูสรุปภาษี</button>');
    if (/ข่าว/.test(s)) return done('ฝ่ายข่าวยังไม่ได้เชื่อมต่อแหล่งข่าวจริงค่ะ ฟ้าเลยไม่แต่งข่าวให้นะ ถ้าต้องการให้เปิดใช้ ต้องต่อระบบ AI/ข่าวเพิ่มก่อน');
    t = smallTalk(s); if (t) return done(t);
    for (k = 0; k < KB.length; k++) if (KB[k][0].test(s) && s.length < 40) return done(KB[k][1]);
    done(pick(['ฟ้ายังจับใจความไม่ค่อยได้ค่ะ 😅 ลองถามเรื่อง ยอดขาย สต๊อก ค่าเช่า งานที่ต้องทำ วิธีใช้เมนูต่าง ๆ หรือชวนฟ้าคุยเล่นก็ได้นะ', 'อืม… ฟ้ายังไม่แน่ใจว่าเพื่อนหมายถึงอะไร ลองพิมพ์ว่า "ทำอะไรได้บ้าง" ดูไหมคะ 🌸', 'เรื่องนี้ฟ้ายังตอบไม่ได้ แต่ถ้าเป็นข้อมูลในร้านหรือวิธีใช้เว็บ ถามมาได้เลย หรือจะเล่าให้ฟังเฉย ๆ ก็ได้ ฟ้าฟังอยู่ค่ะ 💕']));
  }

  /* ---------- แชท UI ---------- */
  var QS = ['สรุปวันนี้', 'วันนี้ขายได้เท่าไหร่', 'ของใกล้หมด', 'ค่าเช่าค้าง', 'เพิ่มสินค้ายังไง', 'ทำอะไรได้บ้าง', 'เล่ามุก'];
  function bubble(cls, html) { var b = $$('#wcb'), d = document.createElement('div'); d.className = 'wm ' + cls; d.innerHTML = html; b.appendChild(d); b.scrollTop = b.scrollHeight; return d; }
  function chatOpen(on) {
    var c = $$('#wchat'); c.classList.toggle('on', on !== false); WD.classList.toggle('wp', on !== false || !!W.V.sel);
    if (on !== false) {
      if (!$$('#wcb').children.length) {
        var h = hour(), pn = pendingN();
        bubble('', 'สวัสดีตอน' + tword() + 'ค่ะ ฟ้าเองนะ 🌸 เลขาประจำร้าน<br>' + (pn ? 'ตอนนี้มีงานค้างอยู่ ' + pn + ' รายการค่ะ<br>' : '') + 'ถามเรื่องข้อมูลร้าน วิธีใช้เว็บ หรือจะคุยเล่นก็ได้เลยนะ');
        $$('#wqs').innerHTML = QS.map(function (q) { return '<button data-a="wq" data-v="' + q + '">' + q + '</button>'; }).join('');
      }
      if (innerWidth > 1000) setTimeout(function () { $$('#wcin').focus(); }, 60);
    }
  }
  var busy = false;
  A.wsend = function (v) {
    var i = $$('#wcin'), q = (typeof v === 'string' ? v : i.value).trim(); if (!q || busy) return; i.value = ''; chatOpen(true); bubble('u', E_(q)); busy = true;
    var ty = bubble('', '<span class="wdot"><i></i><i></i><i></i></span>'), t0 = Date.now(), fin = function (html) { var w = Math.max(0, 450 - (Date.now() - t0)); setTimeout(function () { ty.innerHTML = html; busy = false; $$('#wcb').scrollTop = $$('#wcb').scrollHeight; }, w); };
    try { brain(q, fin); } catch (e) { fin('ขอโทษค่ะ ฟ้าสะดุดนิดหน่อย ลองถามใหม่อีกครั้งนะคะ'); }
  };
  A.wq = function (v) { A.wsend(v); };
  A.wchat = function () { var c = $$('#wchat'); if (c.classList.contains('on') && !arguments[2]) { } chatOpen(true); };
  A.wchatx = function () { chatOpen(false); };

  /* ---------- actions ---------- */
  A.wzin = function () { W.zoomBy(1.25); }; A.wzout = function () { W.zoomBy(.8); }; A.wrl = function () { W.rotateBy(-Math.PI / 4 * (W.V.mode === 'ext' ? 2 : .5)); }; A.wrr = function () { W.rotateBy(Math.PI / 4 * (W.V.mode === 'ext' ? 2 : .5)); }; A.wrec = function () { if (W.V.mode === 'ext') W.recenter(); else W.focusRoom('all'); };
  A.wdesel = function () { W.select(null); };
  A.wenter = function (k) { W.setMode('int', k || 'sec'); };
  A.wmode = function (m) { W.setMode(m); };
  A.wroom = function (k) { W.focusRoom(k); };
  A.wgoto = function (k) { $$('#wsr').style.display = 'none'; $$('#wq').value = ''; if (W.V.mode === 'int') W.focusRoom(k); else W.select(k); };
  A.wgo = function (id) { chatOpen(false); go(id); };
  A.wset = function () { go('set'); };
  A.wmenu = function () { var m = $$('#wmenu'); m.firstChild.innerHTML = '<h3>เมนู</h3>' + M.map(function (x) { return '<button class="mi ' + (x.id === 'ai' ? 'on' : '') + '" data-a="' + (x.id === 'ai' ? 'wmenux' : 'wgo') + '" data-v="' + x.id + '">' + ic(x.i, 22) + x.t + '</button>'; }).join('') + '<button class="mi" data-a="logout">' + IC.out + ' ออกจากระบบ</button>'; m.classList.add('on'); };
  A.wmenux = function () { $$('#wmenu').classList.remove('on'); };
  A.wbell = function () { chatOpen(true); A.wsend('สรุปวันนี้'); };
  var _go = go; go = function (id) { var m = $$ && WD && $$('#wmenu'); if (m) m.classList.remove('on'); return _go.apply(this, arguments); };

  /* ---------- เริ่มทำงาน ---------- */
  function loadThree(cb) {
    if (window.THREE) return cb();
    /* ลองไฟล์ในเว็บก่อน (three_min.js / three.min.js) แล้วค่อยใช้ CDN */
    var src = ['three_min.js?v=128', 'three.min.js?v=128', 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'], i = 0;
    (function next() {
      if (i >= src.length) { $$('#wgl').innerHTML = '<div style="padding:90px 20px;text-align:center">โหลด 3D ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วรีเฟรช</div>'; return; }
      var s = document.createElement('script'); s.src = src[i++]; s.onload = function () { if (window.THREE) cb(); else next(); }; s.onerror = next; document.head.appendChild(s);
    })();
  }
  function boot() {
    if (started) return; started = true;
    loadThree(function () {
      try { W.start($$('#wgl')); makeTags(); } catch (e) { console.error(e); $$('#wgl').innerHTML = '<div style="padding:90px 20px;text-align:center">อุปกรณ์นี้เปิดแมพ 3D ไม่ได้<br><small>' + esc(e.message) + '</small></div>'; }
      paint(); WD.classList.add('wext');
    });
  }
  function sync() {
    var on = !!(S.ready && S.cur === 'ai'); build(); WD.classList.toggle('on', on); document.body.classList.toggle('wlock', on);
    if (on) { boot(); loadData(); try { window.SSRent && window.SSRent.ensure(); } catch (e) {} paint(); }
  }
  var _r = render; render = function () { _r.apply(this, arguments); sync(); };
  setInterval(function () { if (WD && WD.classList.contains('on')) { loadData(); paint(); } }, 8000);
  window.addEventListener('resize', function () { paint(); });
  if (S.ready) render();
})();
