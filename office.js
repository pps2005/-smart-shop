/* Xiress add-on: office.js (v2)
   หน้า AI = ออฟฟิศทีมผู้ช่วย 6 ฝ่าย: บัญชี สินค้า คลัง ขาย อสังหา AI
   ตัวละครนั่งทำงาน/เดินไปมา มีบทพูด กดโต๊ะ -> ตัวละครกลับมานั่ง + เปิดสรุปสั้นของฝ่ายนั้น (ข้อมูลจริง ไม่เรียก AI API)
   วิธียกเลิก: ลบบรรทัด <script src="office.js"> ใน index.html */
(function () {
  var css = document.createElement('style');
  css.textContent = [
    '#office{position:relative;margin:10px 0 14px;border-radius:18px;overflow:hidden;border:3px solid #6b4220;box-shadow:0 6px 0 #4a2e16,0 10px 18px rgba(0,0,0,.18);background:#e8c99b}',
    '#office svg{width:100%;height:auto;display:block;image-rendering:pixelated}',
    '#office [data-a]{cursor:pointer}',
    '#office .ovr{position:absolute;inset:0;pointer-events:none}',
    '#office .ob{position:absolute;background:#fff;color:#111;border:2px solid #111;border-radius:5px;padding:2px 7px;font-size:11px;font-weight:700;line-height:1.35;white-space:nowrap;box-shadow:2px 2px 0 rgba(0,0,0,.25);transform:translate(-50%,-100%);display:none}',
    '#office .ob:after{content:"";position:absolute;left:var(--tx,50%);bottom:-7px;margin-left:-4px;border:4px solid transparent;border-top:5px solid #111;border-bottom:0}',
    '#office .ob i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#ef4444;margin-right:4px}',
    '#office .blk{animation:oblk 1s steps(1) infinite}@keyframes oblk{50%{opacity:.2}}',
    '.ofn{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}',
    '.ofn button{padding:9px 2px;border-radius:12px;background:var(--card);border:1px solid var(--line);font-size:.8rem;font-weight:700;text-align:center}',
    '.ofn span{display:block;font-size:1.3rem;line-height:1.2}',
    '.ofh{border-radius:12px;padding:10px 12px;margin:8px 0;font-weight:700;background:var(--bg)}'
  ].join('');
  document.head.appendChild(css);

  var VW = 160, VH = 186, GAPX = 76;
  var OF = { d: null, busy: false, err: '', root: null, raf: 0, npcs: [], last: 0 };
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;

  function F(n) { return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 }); }
  function SG(n) { return (n > 0 ? '+' : n < 0 ? '-' : '') + F(Math.abs(n)); }
  function bkk(d) { return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); }
  function kv(a, b) { return '<div class="kv"><span>' + a + '</span><b>' + b + '</b></div>'; }
  function col(n) { return n >= 0 ? 'ovp' : 'ovm'; }
  function thr() { try { return parseInt(localStorage.getItem('ss_low')) || 3; } catch (e) { return 3; } }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function R(x, y, w, h, f, e) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '"' + (e ? ' ' + e : '') + '/>'; }

  /* ---------- ตัวละคร ---------- */
  function sprite(d, fr, mv) {
    var l = mv && fr;
    if (d.robot) {
      return R(3, -3, 2, 3, '#64748b') + R(2, -4, 4, 1, '#ef4444') + R(0, 0, 8, 6, '#e2e8f0') + R(1, 2, 2, 2, '#2563eb') + R(5, 2, 2, 2, '#2563eb') + R(1, 5, 6, 1, '#94a3b8') +
        R(-1, 6, 1, 4, '#94a3b8') + R(8, 6, 1, 4, '#94a3b8') + R(0, 6, 8, 5, '#64748b') + R(3, 7, 2, 2, '#38bdf8') + R(1, 11, 3, l ? 2 : 3, '#475569') + R(4, 11, 3, l ? 3 : 2, '#475569');
    }
    return R(1, 0, 6, 2, d.hair) + R(0, 1, 1, 3, d.hair) + R(7, 1, 1, 3, d.hair) + R(1, 2, 6, 4, '#f2c9a0') + R(2, 3, 1, 1, '#1f2937') + R(5, 3, 1, 1, '#1f2937') +
      R(-1, 6, 1, 4, d.shirt) + R(8, 6, 1, 4, d.shirt) + R(0, 6, 8, 5, d.shirt) + R(1, 6, 6, 1, 'rgba(255,255,255,.3)') +
      R(1, 11, 3, l ? 2 : 3, '#374151') + R(4, 11, 3, l ? 3 : 2, '#374151') + R(1, l ? 13 : 14, 3, 1, '#111') + R(4, l ? 14 : 13, 3, 1, '#111');
  }

  /* ---------- ฉาก ---------- */
  function sign(x, y, w, t, c) {
    return R(x, y, w, 8, c, 'stroke="#111" stroke-width=".6"') + R(x, y, w, 2, 'rgba(255,255,255,.25)') +
      '<text x="' + (x + 2) + '" y="' + (y + 5.8) + '" textLength="' + (w - 4) + '" lengthAdjust="spacingAndGlyphs" font-size="4.4" font-weight="700" fill="#fff" style="font-family:system-ui,sans-serif">' + t + '</text>';
  }
  function plant(x, y) { return R(x + 1, y + 5, 4, 3, '#b45309') + R(x + 2, y, 2, 5, '#15803d') + R(x, y + 1, 2, 2, '#22c55e') + R(x + 4, y + 2, 2, 2, '#22c55e') + R(x + 2, y - 1, 2, 2, '#4ade80'); }
  function box(x, y, c) { return R(x, y, 4, 3, c) + R(x, y, 4, 1, 'rgba(255,255,255,.35)'); }

  var DEP = [
    { k: 'acc', t: 'ฝ่ายบัญชี', ic: '💰', ox: 4, oy: 16, c: '#15803d', rug: ['#86efac', '#bbf7d0'], scr: '#34d399', shirt: '#16a34a', hair: '#3b2a1a',
      x: function (o, y) { return R(o + 40, y + 1, 16, 10, '#fff', 'stroke="#111" stroke-width=".5"') + R(o + 43, y + 7, 2, 3, '#16a34a') + R(o + 46, y + 5, 2, 5, '#16a34a') + R(o + 49, y + 3, 2, 7, '#16a34a') + R(o + 52, y + 6, 2, 4, '#facc15') +
        R(o + 59, y + 12, 11, 22, '#94a3b8') + R(o + 60, y + 14, 9, 6, '#cbd5e1') + R(o + 60, y + 22, 9, 6, '#cbd5e1') + R(o + 63, y + 16, 3, 1, '#64748b') + R(o + 63, y + 24, 3, 1, '#64748b') + plant(o + 14, y + 33); } },
    { k: 'prod', t: 'ฝ่ายสินค้า', ic: '📦', ox: 84, oy: 16, c: '#c2410c', rug: ['#fdba74', '#fed7aa'], scr: '#fbbf24', shirt: '#ea580c', hair: '#1f1f1f',
      x: function (o, y) { return R(o + 58, y + 10, 13, 27, '#8b5a2b') + R(o + 59, y + 11, 11, 7, '#6b4220') + R(o + 59, y + 19, 11, 7, '#6b4220') + R(o + 59, y + 27, 11, 7, '#6b4220') +
        box(o + 60, y + 14, '#f59e0b') + box(o + 65, y + 14, '#ef4444') + box(o + 60, y + 22, '#3b82f6') + box(o + 65, y + 22, '#10b981') + box(o + 60, y + 30, '#a855f7') + box(o + 65, y + 30, '#f59e0b') +
        R(o + 40, y + 1, 16, 10, '#fef3c7', 'stroke="#111" stroke-width=".5"') + R(o + 42, y + 3, 12, 1, '#c2410c') + R(o + 42, y + 6, 8, 1, '#c2410c') + R(o + 42, y + 8, 10, 1, '#c2410c'); } },
    { k: 'stock', t: 'ฝ่ายคลัง', ic: '🏬', ox: 4, oy: 72, c: '#0e7490', rug: ['#67e8f9', '#a5f3fc'], scr: '#22d3ee', shirt: '#0891b2', hair: '#4a2c17',
      x: function (o, y) { return R(o + 58, y + 10, 13, 3, '#475569') + R(o + 58, y + 22, 13, 3, '#475569') + R(o + 58, y + 34, 13, 3, '#475569') + R(o + 58, y + 10, 2, 27, '#475569') + R(o + 69, y + 10, 2, 27, '#475569') +
        box(o + 61, y + 17, '#d6a05c') + box(o + 66, y + 17, '#e0b070') + box(o + 61, y + 29, '#e0b070') + box(o + 66, y + 29, '#d6a05c') + R(o + 61, y + 14, 8, 3, '#d6a05c') +
        R(o + 40, y + 1, 16, 10, '#fff', 'stroke="#111" stroke-width=".5"') + R(o + 42, y + 3, 5, 3, '#06b6d4') + R(o + 49, y + 3, 5, 3, '#f59e0b') + R(o + 42, y + 7, 12, 2, '#94a3b8'); } },
    { k: 'sales', t: 'ฝ่ายขาย', ic: '🛒', ox: 84, oy: 72, c: '#be185d', rug: ['#f9a8d4', '#fbcfe8'], scr: '#f472b6', shirt: '#db2777', hair: '#2b1b12',
      x: function (o, y) { return R(o + 56, y + 22, 15, 12, '#9d174d') + R(o + 56, y + 22, 15, 3, '#be185d') + R(o + 59, y + 15, 9, 7, '#e5e7eb') + R(o + 60, y + 16, 7, 3, '#34d399') + R(o + 60, y + 20, 7, 1, '#94a3b8') +
        R(o + 40, y + 1, 16, 10, '#111827') + R(o + 42, y + 3, 12, 6, '#22c55e') + '<text x="' + (o + 48) + '" y="' + (y + 7.6) + '" text-anchor="middle" font-size="4" font-weight="700" fill="#052e16" style="font-family:system-ui,sans-serif">OPEN</text>' + plant(o + 14, y + 33); } },
    { k: 'rent', t: 'ฝ่ายอสังหา', ic: '🏢', ox: 4, oy: 128, c: '#1d4ed8', rug: ['#93c5fd', '#bfdbfe'], scr: '#60a5fa', shirt: '#2563eb', hair: '#7c2d12',
      x: function (o, y) { var w = ''; [0, 1, 2].forEach(function (i) { [0, 1, 2].forEach(function (j) { w += R(o + 60 + i * 3.4, y + 14 + j * 4, 1.8, 2, '#fde047'); }); });
        return R(o + 58, y + 10, 13, 24, '#94a3b8') + R(o + 58, y + 10, 13, 3, '#64748b') + w + R(o + 63, y + 27, 3, 7, '#92400e') +
          R(o + 40, y + 1, 16, 10, '#92400e', 'stroke="#111" stroke-width=".5"') + R(o + 43, y + 4, 2, 2, '#fde047') + R(o + 48, y + 4, 2, 2, '#fde047') + R(o + 43, y + 8, 2, 1, '#fde047') + R(o + 48, y + 8, 2, 1, '#fde047'); } },
    { k: 'ai', t: 'ผู้จัดการ AI', ic: '🤖', ox: 84, oy: 128, c: '#6d28d9', rug: ['#c4b5fd', '#ddd6fe'], scr: '#a78bfa', robot: true, shirt: '', hair: '',
      x: function (o, y) { return R(o + 58, y + 10, 12, 24, '#1f2937') + R(o + 59, y + 12, 10, 3, '#334155') + R(o + 59, y + 17, 10, 3, '#334155') + R(o + 59, y + 22, 10, 3, '#334155') + R(o + 61, y + 13, 3, 1, '#22c55e') + R(o + 61, y + 18, 3, 1, '#38bdf8') +
        '<g class="blk">' + R(o + 66, y + 13, 2, 1, '#ef4444') + R(o + 66, y + 23, 2, 1, '#22c55e') + '</g>' + R(o + 40, y + 1, 16, 10, '#312e81', 'stroke="#111" stroke-width=".5"') + '<g class="blk">' + R(o + 43, y + 4, 2, 2, '#a78bfa') + R(o + 48, y + 4, 2, 2, '#a78bfa') + '</g>' + R(o + 43, y + 8, 10, 1, '#a78bfa') + plant(o + 14, y + 33); } }
  ];
  var PROPS = [
    { x: 62, wy: 58, say: 'ขอน้ำเย็น ๆ หน่อย', d: function (x, y) { return R(x + 1, y + 6, 6, 8, '#e5e7eb') + R(x + 2, y + 1, 4, 5, '#93c5fd') + R(x + 2, y + 1, 4, 1, '#bfdbfe') + R(x + 3, y + 9, 2, 1, '#3b82f6'); } },
    { x: 92, wy: 58, say: 'กาแฟสักแก้ว', d: function (x, y) { return R(x, y + 4, 8, 10, '#475569') + R(x + 1, y + 5, 6, 3, '#fbbf24') + R(x + 2, y + 10, 4, 3, '#fff') + R(x + 1, y + 4, 6, 1, '#ef4444'); } },
    { x: 20, wy: 114, say: 'ปริ้นเอกสารแป๊บ', d: function (x, y) { return R(x - 2, y + 7, 12, 7, '#9ca3af') + R(x, y + 3, 8, 4, '#fff') + R(x - 2, y + 7, 12, 2, '#d1d5db') + R(x + 6, y + 10, 2, 1, '#22c55e'); } },
    { x: 66, wy: 114, say: 'พักสายตาแป๊บ', d: function (x, y) { return R(x - 4, y + 6, 16, 8, '#f472b6') + R(x - 4, y + 3, 16, 4, '#db2777') + R(x - 5, y + 5, 3, 9, '#be185d') + R(x + 10, y + 5, 3, 9, '#be185d'); } },
    { x: 132, wy: 114, say: 'รดน้ำต้นไม้หน่อย', d: function (x, y) { return R(x + 1, y + 8, 6, 6, '#b45309') + R(x + 3, y, 2, 8, '#15803d') + R(x, y + 2, 3, 3, '#22c55e') + R(x + 5, y + 3, 3, 3, '#22c55e') + R(x + 2, y - 2, 4, 3, '#4ade80'); } }
  ];

  function sceneSvg() {
    var s = '<defs><pattern id="oflr" width="16" height="8" patternUnits="userSpaceOnUse">' + R(0, 0, 16, 8, '#e8c99b') + R(0, 0, 16, 1, '#d9b583') + R(0, 4, 16, 1, '#dcb98a') + R(8, 0, 1, 4, '#d9b583') + R(3, 4, 1, 4, '#d9b583') + '</pattern></defs>';
    s += R(0, 14, VW, VH - 14, 'url(#oflr)') + R(0, 58, VW, 12, 'rgba(255,255,255,.16)') + R(0, 114, VW, 14, 'rgba(255,255,255,.16)');
    s += R(0, 0, VW, 14, '#d8c39d') + R(0, 8, VW, 4, '#c3ad84') + R(0, 12, VW, 2, '#8d7a55');
    for (var i = 0; i < 5; i++) if (i !== 2) s += R(8 + i * 30, 2, 20, 8, '#bfe3f5', 'stroke="#6d98b0" stroke-width=".6"') + R(8 + i * 30, 2, 20, 3, '#e0f2fe') + R(17.6 + i * 30, 2, .8, 8, '#6d98b0');
    s += R(70, 3, 9, 9, '#fff', 'stroke="#333" stroke-width=".6"') + R(74.4, 4.5, .7, 4, '#333') + R(74.4, 8, 3, .7, '#333');
    PROPS.forEach(function (p) { s += p.d(p.x, p.wy + 3); });
    var back = '', front = '', hit = '';
    DEP.forEach(function (d) {
      var o = d.ox, y = d.oy;
      back += R(o, y + 9, 72, 35, d.rug[0]) + R(o + 2, y + 11, 68, 31, d.rug[1]) + sign(o + 2, y + 1, 36, d.t, d.c) + d.x(o, y) + R(o + 38, y + 13, 12, 9, '#334155') + R(o + 39, y + 14, 10, 3, '#475569');
      front += R(o + 16, y + 22, 44, 3, '#e0a964') + R(o + 16, y + 25, 44, 5, '#a0692f') + R(o + 16, y + 29, 44, 1, '#6b4220') + R(o + 18, y + 30, 2, 5, '#6b4220') + R(o + 56, y + 30, 2, 5, '#6b4220') +
        R(o + 20, y + 13, 13, 8, '#1f2937') + R(o + 21, y + 14, 11, 6, d.scr) + R(o + 22, y + 15, 5, 1, 'rgba(255,255,255,.7)') + R(o + 25, y + 21, 3, 1, '#374151') +
        R(o + 36, y + 20, 7, 2, '#e5e7eb') + R(o + 53, y + 19, 3, 3, '#fff') + R(o + 53, y + 19, 3, 1, '#92400e');
      hit += '<rect x="' + o + '" y="' + y + '" width="72" height="44" fill="transparent" data-a="ofc" data-v="' + d.k + '" aria-label="' + d.t + '"/>';
    });
    return '<svg viewBox="0 0 ' + VW + ' ' + VH + '" shape-rendering="crispEdges" role="img" aria-label="ออฟฟิศทีมผู้ช่วย">' + s + back + '<g id="npcs"></g>' + front + hit + '</svg>';
  }

  function officeHtml() {
    return '<div id="office">' + sceneSvg() + '<div class="ovr" id="ovr"></div></div>' +
      '<div class="ofn">' + DEP.map(function (d) { return '<button data-a="ofc" data-v="' + d.k + '"><span>' + d.ic + '</span>' + d.t + '</button>'; }).join('') + '</div>' +
      '<div class="note" style="margin-bottom:12px">กดโต๊ะหรือปุ่มฝ่ายเพื่อดูสรุปสั้น ๆ · ตัวละครจะกลับมานั่งทำงานให้ · จุดแดงในกรอบคำพูด = มีเรื่องที่ควรดู</div>';
  }

  /* ---------- ตัวละครเดิน/นั่ง ---------- */
  function seatOf(d) { return { x: d.ox + 40, y: d.oy + 12 }; }
  function ownWy(d) { return d.oy >= 128 ? 114 : 58; }
  function planOut(n, pr) {
    var d = n.d, s = seatOf(d), ax = d.ox + 4, wy = ownWy(d), p = [s, { x: ax, y: s.y }, { x: ax, y: wy }];
    if (pr.wy !== wy) { p.push({ x: GAPX, y: wy }); p.push({ x: GAPX, y: pr.wy }); }
    p.push({ x: pr.x, y: pr.wy });
    return p.filter(function (q, i) { return !i || q.x !== p[i - 1].x || q.y !== p[i - 1].y; });
  }
  function startOut(n) {
    var free = PROPS.filter(function (p) { return p !== n.pr && !OF.npcs.some(function (m) { return m !== n && m.pr === p && (m.st === 'out' || m.st === 'idle'); }); });
    if (!free.length) { n.t = 3; return; }
    var pr = pick(free);
    n.pr = pr; n.out = planOut(n, pr); n.k = 0; n.route = n.out.slice(1); n.ri = 0; n.st = 'out'; n.sp = 22; n.line = null;
  }
  function startBack(n, fast) {
    n.route = n.out.slice(0, n.k + 1).reverse(); n.ri = 0; n.st = 'back'; n.sp = fast ? 48 : 22; n.line = null;
  }
  function mkNpc(d, i) {
    var s = seatOf(d);
    return { d: d, x: s.x, y: s.y, face: 1, st: 'sit', t: 1.5 + i * 1.8 + Math.random() * 3, hold: false, holdT: 0, work: [], al: false, line: null, greet: 0, fr: 0, ft: 0, ci: 0, el: null, bub: null, sig: '', bsig: '' };
  }
  function build() {
    OF.npcs = DEP.map(mkNpc);
    var g = OF.root.querySelector('#npcs'), ov = OF.root.querySelector('#ovr');
    OF.npcs.forEach(function (n) {
      g.insertAdjacentHTML('beforeend', '<g id="n-' + n.d.k + '" data-a="ofc" data-v="' + n.d.k + '"><g class="fl"></g></g>');
      ov.insertAdjacentHTML('beforeend', '<div class="ob" id="b-' + n.d.k + '"></div>');
      n.el = g.lastChild; n.bub = ov.lastChild;
    });
    paint();
  }
  function step(n, dt) {
    var mv = false;
    if (n.st === 'sit') {
      if (n.greet > 0) n.greet -= dt;
      n.t -= dt;
      if (n.t <= 0 && !n.hold && !still) startOut(n);
    } else if (n.st === 'idle') {
      n.t -= dt;
      if (n.t <= 0 || n.hold) startBack(n, n.hold);
    } else {
      mv = true;
      var P = n.route[n.ri], dx = P.x - n.x, dy = P.y - n.y, dist = Math.abs(dx) + Math.abs(dy), mvd = n.sp * dt;
      if (dx) n.face = dx > 0 ? 1 : -1;
      if (mvd >= dist) {
        n.x = P.x; n.y = P.y; n.ri++;
        if (n.st === 'out') n.k++;
        if (n.ri >= n.route.length) {
          mv = false;
          if (n.st === 'out') { n.st = 'idle'; n.t = 2.6 + Math.random() * 2; n.line = n.pr.say; n.face = 1; }
          else { n.st = 'sit'; n.face = 1; n.t = 6 + Math.random() * 5; n.x = seatOf(n.d).x; n.y = seatOf(n.d).y; if (n.hold) n.greet = 3; }
        }
      } else { n.x += dx ? Math.sign(dx) * mvd : 0; n.y += dy ? Math.sign(dy) * mvd : 0; }
    }
    if (mv) { n.ft += dt; if (n.ft > .18) { n.ft = 0; n.fr ^= 1; } } else n.fr = 0;
    return mv;
  }
  function paintNpc(n, mv, T, W, H) {
    var x = Math.round(n.x), y = Math.round(n.y + (mv && n.fr ? -1 : 0)), sig = x + ',' + y + ',' + n.face + ',' + n.fr + ',' + mv;
    if (sig !== n.sig) {
      n.sig = sig;
      n.el.setAttribute('transform', 'translate(' + x + ',' + y + ')');
      var fl = n.el.firstChild;
      fl.setAttribute('transform', n.face < 0 ? 'translate(8,0) scale(-1,1)' : '');
      fl.innerHTML = sprite(n.d, n.fr, mv);
    }
    var txt = null, al = false;
    if (n.st === 'idle') txt = n.line;
    else if (n.st === 'sit') {
      if (n.greet > 0) txt = 'ได้ค่ะ นี่ข้อมูลล่าสุด';
      else if (n.work.length) { var w = n.work[Math.floor(T / 3.6) % n.work.length]; txt = w.t; al = w.al; }
    } else if (n.hold) txt = 'กลับแล้วค่ะ…';
    if (!txt) { if (n.bsig) { n.bub.style.display = 'none'; n.bsig = ''; } return; }
    var sc = W / VW, px = (x + 4) * sc, py = (y - 2) * sc, bsig = txt + al + Math.round(px) + Math.round(py);
    if (bsig === n.bsig) return;
    n.bsig = bsig;
    n.bub.innerHTML = (al ? '<i></i>' : '') + esc(txt);
    n.bub.style.display = 'block';
    var bw = n.bub.offsetWidth, left = Math.max(bw / 2 + 2, Math.min(W - bw / 2 - 2, px));
    n.bub.style.left = left + 'px'; n.bub.style.top = Math.max(py, n.bub.offsetHeight + 2) + 'px';
    n.bub.style.setProperty('--tx', (bw / 2 + px - left) + 'px');
  }
  function tick(ts) {
    if (!OF.root || !document.body.contains(OF.root)) { OF.raf = 0; OF.root = null; return; }
    var dt = Math.min(.1, (ts - (OF.last || ts)) / 1000); OF.last = ts;
    var open = $('sheet') && $('sheet').classList.contains('show'), W = OF.root.clientWidth, H = OF.root.clientHeight;
    OF.npcs.forEach(function (n) {
      if (n.hold) { if (open) n.holdT = 0; else { n.holdT += dt; if (n.holdT > 6) { n.hold = false; n.t = Math.max(n.t, 3); } } }
      var mv = step(n, dt);
      paintNpc(n, mv, ts / 1000, W, H);
    });
    OF.raf = requestAnimationFrame(tick);
  }
  function startLoop() {
    if (OF.raf) cancelAnimationFrame(OF.raf);
    OF.root = $('office'); OF.last = 0; build(); OF.raf = requestAnimationFrame(tick);
  }

  /* ---------- ข้อมูล ---------- */
  async function all(mk) {
    var out = [];
    for (var i = 0; i < 20; i++) {
      var r = await mk().range(i * 1000, i * 1000 + 999);
      if (r.error) throw r.error;
      out = out.concat(r.data);
      if (r.data.length < 1000) break;
    }
    return out;
  }
  async function ofLoad() {
    if (OF.busy || !S.sb) return;
    OF.busy = true; OF.err = '';
    try {
      var td = bkk(new Date()), ym = td.slice(0, 7), ms = ym + '-01', iso = new Date(ms + 'T00:00:00+07:00').toISOString();
      var res = await Promise.all([
        all(function () { return S.sb.from('sales').select('qty,unit_price,unit_cost,created_at,voided_at,void_reason').or('created_at.gte.' + iso + ',voided_at.gte.' + iso).order('created_at'); }),
        all(function () { return S.sb.from('expenses').select('kind,amount,paid_on').is('voided_at', null).gte('paid_on', ms).order('paid_on'); })
      ]);
      if (window.SSRent) { var p = window.SSRent.ensure(); if (p && p.then) await p; }
      OF.d = { td: td, ym: ym, sales: res[0], exps: res[1] };
    } catch (e) { OF.err = e.message || String(e); }
    OF.busy = false;
    paint();
  }

  /* ---------- สรุปตัวเลข ---------- */
  function accSum() {
    var D = OF.d, s = { rev: 0, cost: 0, exp: 0 };
    D.sales.forEach(function (x) { if (!x.voided_at && bkk(x.created_at).slice(0, 7) === D.ym) { s.rev += x.unit_price * x.qty; s.cost += x.unit_cost * x.qty; } });
    D.exps.forEach(function (x) { s.exp += Number(x.amount); });
    s.net = s.rev - s.cost - s.exp;
    return s;
  }
  function salesSum() {
    var D = OF.d, s = { rev: 0, gp: 0, q: 0, bills: 0, ret: 0, retAmt: 0 };
    D.sales.forEach(function (x) {
      if (!x.voided_at && bkk(x.created_at) === D.td) { s.rev += x.unit_price * x.qty; s.gp += (x.unit_price - x.unit_cost) * x.qty; s.q += x.qty; s.bills++; }
      if (x.voided_at && bkk(x.voided_at) === D.td) { s.ret++; s.retAmt += x.unit_price * x.qty; }
    });
    return s;
  }
  function prodSum() {
    var P = S.prods || [], c = { green: 0, blue: 0, red: 0, black: 0 }, pcs = 0, out = [], low = [], T = thr(), loc = {};
    P.forEach(function (p) {
      c[p.status] = (c[p.status] || 0) + 1; pcs += pq(p);
      S.locs.forEach(function (l) { loc[l.id] = (loc[l.id] || 0) + (p.variants || []).reduce(function (a, v) { return a + lq(v, l.id); }, 0); });
      if (p.status !== 'black') { if (pq(p) < 1) out.push(p); else if (pq(p) <= T) low.push(p); }
    });
    return { n: P.length, c: c, pcs: pcs, out: out, low: low, T: T, loc: loc };
  }
  function rentSum() {
    var X = window.SSRent;
    if (!X) return { none: true };
    var Rr = X.R;
    if (Rr.err) return { err: Rr.err };
    if (!Rr.loaded) return { wait: true };
    var td = X.today(), ym = td.slice(0, 7), st = { occupied: 0, vacant: 0, maintenance: 0 }, od = [], oda = 0, inc = 0, mc = 0;
    Rr.units.forEach(function (u) { st[u.status] = (st[u.status] || 0) + 1; });
    Rr.pays.forEach(function (r) { if ((r._left || 0) > 0 && X.eff(r) < td) { od.push(r); oda += r._left; } });
    Rr.rec.forEach(function (x) { if (x.paid_on.slice(0, 7) === ym) inc += Number(x.amount); });
    Rr.costs.forEach(function (x) { if (x.paid_on.slice(0, 7) === ym) mc += Number(x.amount); });
    return { n: Rr.units.length, st: st, od: od, oda: oda, inc: inc, mc: mc, td: td };
  }

  /* ---------- บทพูดตอนนั่งทำงาน (จากข้อมูลจริง) ---------- */
  function paint() {
    if (!OF.npcs.length) return;
    var P = prodSum(), W = {}, L = function (t, al) { return { t: t, al: !!al }; };
    W.prod = [L('มี ' + F(P.n) + ' รุ่น รวม ' + F(P.pcs) + ' ชิ้น'), L(P.out.length ? 'หมดสต๊อก ' + P.out.length + ' รุ่น' : 'ยังไม่มีรุ่นที่หมด', P.out.length)];
    W.stock = [L('ใกล้หมด ' + P.low.length + ' รุ่น (≤' + P.T + ' ชิ้น)', P.low.length)].concat(S.locs.map(function (l) { return L(l.name + ' ' + F(P.loc[l.id]) + ' ชิ้น'); }));
    W.ai = [L('ถามฉันได้นะ'), L('สรุปจากข้อมูลจริงให้ได้')];
    if (OF.d) {
      var a = accSum(), s = salesSum();
      W.acc = [L('กำไรเดือนนี้ ' + SG(a.net) + ' บาท', a.net < 0), L('รายจ่าย ' + F(a.exp) + ' บาท')];
      W.sales = [L('วันนี้ขาย ' + F(s.rev) + ' บาท'), L(s.ret ? 'คืน/ยกเลิก ' + s.ret + ' รายการ' : 'ขายไป ' + F(s.q) + ' ชิ้น', s.ret)];
    } else { W.acc = W.sales = [L(OF.err ? 'โหลดข้อมูลไม่ได้' : 'กำลังดึงข้อมูล…', OF.err)]; }
    var r = rentSum();
    W.rent = r.none ? [L('ยังไม่มีข้อมูล')] : r.err ? [L('โหลดไม่ได้', true)] : r.wait ? [L('กำลังดึงข้อมูล…')] : [L('ห้องว่าง ' + r.st.vacant + ' ห้อง'), L(r.od.length ? 'ค้างจ่าย ' + r.od.length + ' รายการ' : 'ไม่มีค่าเช่าค้าง', r.od.length)];
    OF.npcs.forEach(function (n) { n.work = W[n.d.k] || []; });
  }

  /* ---------- สรุปสั้นของแต่ละฝ่าย ---------- */
  function hl(t, c) { return '<div class="ofh" style="color:var(--' + c + ')">' + t + '</div>'; }
  function accSheet() {
    if (!OF.d) return openSheet(head('💰 ฝ่ายบัญชี') + '<div class="empty">' + (OF.err ? 'โหลดข้อมูลไม่สำเร็จ: ' + esc(OF.err) : 'กำลังโหลดข้อมูล...') + '</div>');
    var a = accSum(), r = rentSum(), rn = (r.none || r.err || r.wait) ? null : r.inc - r.mc;
    openSheet(head('💰 ฝ่ายบัญชี') + hl(a.net >= 0 ? 'เดือนนี้ร้านค้ากำไร ฿' + SG(a.net) : 'เดือนนี้ร้านค้าขาดทุน ฿' + SG(a.net), a.net >= 0 ? 'green' : 'red') +
      kv('ยอดขาย', '฿' + F(a.rev)) + kv('รายจ่าย', '฿' + F(a.exp)) +
      (rn === null ? '' : '<div class="kv"><span>อสังหา (ค่าเช่า−ซ่อม)</span><b class="' + col(rn) + '">฿' + SG(rn) + '</b></div>' + '<div class="kv"><span><b>รวมทั้งหมด</b></span><b class="' + col(a.net + rn) + '">฿' + SG(a.net + rn) + '</b></div>') +
      '<div class="btns"><button class="btn o" data-a="go" data-v="rep">รายงานเต็ม</button><button class="btn" data-a="go" data-v="acc">รายจ่าย</button></div>');
  }
  function row(p) {
    return '<button class="row" style="width:100%;text-align:left" data-a="open" data-v="' + esc(p.code) + '"><div class="th">' + thumb(p) + '</div><div class="gr"><b>' + esc(p.code) + '</b> ' + esc(p.name) + '<br><small>เหลือ ' + pq(p) + ' ชิ้น</small></div><i class="dt" style="background:var(--' + p.status + ')"></i></button>';
  }
  function prodSheet() {
    var P = prodSum(), bad = P.out.length + P.low.length;
    openSheet(head('📦 ฝ่ายสินค้า') + hl(bad ? 'ต้องดู: หมด ' + P.out.length + ' · ใกล้หมด ' + P.low.length + ' รุ่น' : 'สินค้าปกติดี ไม่มีรุ่นหมดหรือใกล้หมด', bad ? 'red' : 'green') +
      kv('จำนวนรุ่น', F(P.n)) + kv('สินค้ารวม', F(P.pcs) + ' ชิ้น') +
      '<div class="kv"><span>สถานะ</span><b>' + Object.keys(ST).map(function (k) { return ST[k] + ' ' + (P.c[k] || 0); }).join(' · ') + '</b></div>' +
      P.out.slice(0, 2).concat(P.low.slice(0, 2)).map(row).join('') +
      '<div class="btns"><button class="btn o" data-a="go" data-v="stock">คลัง</button><button class="btn" data-a="go" data-v="prod">หน้าสินค้า</button></div>');
  }
  function stockSheet() {
    var P = prodSum();
    openSheet(head('🏬 ฝ่ายคลัง') + hl(P.out.length ? 'ของหมด ' + P.out.length + ' รุ่น ควรเติม' : P.low.length ? 'ใกล้หมด ' + P.low.length + ' รุ่น' : 'สต๊อกพอ ไม่มีรุ่นใกล้หมด', P.out.length ? 'red' : P.low.length ? 'blue' : 'green') +
      S.locs.map(function (l) { return kv(esc(l.name), F(P.loc[l.id]) + ' ชิ้น'); }).join('') + kv('รวม', F(P.pcs) + ' ชิ้น') +
      P.out.slice(0, 2).concat(P.low.slice(0, 2)).map(row).join('') +
      '<div class="btns"><button class="btn o" data-a="go" data-v="prod">สินค้า</button><button class="btn" data-a="go" data-v="stock">หน้าคลัง</button></div>');
  }
  function salesSheet() {
    if (!OF.d) return openSheet(head('🛒 ฝ่ายขาย') + '<div class="empty">' + (OF.err ? 'โหลดข้อมูลไม่สำเร็จ: ' + esc(OF.err) : 'กำลังโหลดข้อมูล...') + '</div>');
    var s = salesSum();
    openSheet(head('🛒 ฝ่ายขาย') + hl(s.bills ? 'วันนี้ขายได้ ฿' + F(s.rev) : 'วันนี้ยังไม่มียอดขาย', s.bills ? 'green' : 'mute') +
      kv('ขายแล้ว', F(s.q) + ' ชิ้น · ' + s.bills + ' รายการ') + kv('กำไรขั้นต้น', '฿' + SG(s.gp)) +
      '<div class="kv"><span>คืน/ยกเลิกวันนี้</span><b class="' + (s.ret ? 'ovm' : '') + '">' + s.ret + ' รายการ' + (s.ret ? ' · ฿' + F(s.retAmt) : '') + '</b></div>' +
      '<div class="note" style="margin-top:8px">ขายสินค้า: เปิดสินค้าจากหน้าสินค้า แล้วกดขาย</div>' +
      '<div class="btns"><button class="btn o" data-a="go" data-v="rep">รายงาน</button><button class="btn" data-a="go" data-v="prod">เลือกสินค้าขาย</button></div>');
  }
  function rentSheet() {
    var r = rentSum();
    if (r.none) return openSheet(head('🏢 ฝ่ายอสังหา') + '<div class="note">ยังไม่มีข้อมูลอสังหาเช่าในระบบ</div>');
    if (r.err) return openSheet(head('🏢 ฝ่ายอสังหา') + '<div class="empty">โหลดข้อมูลไม่สำเร็จ: ' + esc(r.err) + '</div>');
    if (r.wait) { ofLoad(); return openSheet(head('🏢 ฝ่ายอสังหา') + '<div class="empty">กำลังโหลดข้อมูล... แล้วกดโต๊ะอีกครั้ง</div>'); }
    var X = window.SSRent, rn = r.inc - r.mc;
    openSheet(head('🏢 ฝ่ายอสังหา') + hl(r.od.length ? 'ค้างจ่าย ' + r.od.length + ' รายการ ฿' + F(r.oda) : 'ไม่มีค่าเช่าค้างจ่าย', r.od.length ? 'red' : 'green') +
      kv('ห้องทั้งหมด', r.n + ' (มีผู้เช่า ' + r.st.occupied + ' · ว่าง ' + r.st.vacant + ')') +
      '<div class="kv"><span>เดือนนี้ ค่าเช่า−ซ่อม</span><b class="' + col(rn) + '">฿' + SG(rn) + '</b></div>' +
      r.od.slice(0, 3).map(function (p) {
        var l = X.R.leases.find(function (x) { return x.id === p.lease_id; }), u = l && X.unit(l.unit_id);
        return '<button class="row" style="width:100%;text-align:left"' + (u ? ' data-a="runit" data-v="' + u.id + '"' : '') + '><div class="gr"><b>' + esc(u ? X.uname(u) : 'ห้อง') + '</b><br><small>' + esc((l && l.tenants && l.tenants.name) || '') + ' · เลย ' + (-X.diff(r.td, X.eff(p))) + ' วัน</small></div><b class="ovm">฿' + F(p._left) + '</b></button>';
      }).join('') + '<button class="btn" data-a="go" data-v="rent">ไปหน้าอสังหาเช่า</button>');
  }

  A.ofc = function (k) {
    var n = OF.npcs.find(function (x) { return x.d.k === k; });
    if (n) {
      n.hold = true; n.holdT = 0;
      if (n.st === 'out' || n.st === 'idle') startBack(n, true);
      else if (n.st === 'back') n.sp = 48;
      else n.greet = 3;
    }
    if (k === 'acc') return accSheet();
    if (k === 'prod') return prodSheet();
    if (k === 'stock') return stockSheet();
    if (k === 'sales') return salesSheet();
    if (k === 'rent') return rentSheet();
    var i = $('aiin');
    if (i) { i.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { i.focus(); }, 350); }
  };

  /* ---------- ผูกเข้ากับหน้า AI ---------- */
  var _r = render;
  render = function () {
    _r.apply(this, arguments);
    if (!(S.ready && S.cur === 'ai')) return;
    var v = $('view'), h = v && v.querySelector('h2');
    if (!h || $('office')) return;
    h.insertAdjacentHTML('afterend', officeHtml());
    startLoop();
    ofLoad();
  };
})();
