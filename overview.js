/* Xiress add-on: week/month/year overview + expandable popups + UI refresh.
   Load LAST in index.html:  <script src="overview.js"></script>
   To undo: delete that one line from index.html. */
(function(){
var css = ''
+':root{--pri:#16a34a;--pri2:#34d27b}'
+'[data-theme=dark]{--bg:#0b0d12;--card:#141923;--line:#232a38;--text:#eef1f7;--mute:#8a93a8;--pri:#22c55e;--pri2:#34d27b}'
+'.top{background:var(--card)!important;color:var(--text);border-bottom:1px solid var(--line)}'
+'.top .ic{background:var(--bg);color:var(--text)}'
+'#sw input{background:var(--bg)!important;color:var(--text)!important;border:1px solid var(--line)!important}'
+'.btn,.fab{color:#04210f}.chip.on{color:#04210f}'
+'.card,.pc{border-radius:20px}'
+'.bot .on{background:rgba(52,210,123,.16);border-radius:16px}'
+'.sheet>div{max-height:62vh;transition:max-height .25s;border-radius:24px 24px 0 0}'
+'.sheet.full>div{max-height:94vh}'
+'.sh .x{margin-left:8px;flex:0 0 36px}'
+'#sbody details{background:var(--bg);border-radius:14px;padding:10px 14px;margin-top:10px}'
+'#sbody summary{font-weight:700;cursor:pointer}'
+'.seg{display:flex;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:5px;gap:4px}'
+'.seg button{flex:1;padding:10px 4px;border-radius:12px;color:var(--mute);font-weight:600}'
+'.seg .on{background:var(--pri2);color:#04210f}'
+'.ovn{display:flex;align-items:center;justify-content:space-between;margin:14px 0}'
+'.ovn b{font-size:1.1rem}.ovn button{width:40px;height:40px;border-radius:12px;background:var(--card);border:1px solid var(--line);font-size:1.2rem}'
+'.ovd{margin-top:14px}.ovd>summary{font-weight:700;cursor:pointer;padding:10px 2px}'
+'.ovdow,.ovcal{display:grid;gap:6px}.ovdow{grid-template-columns:repeat(7,1fr);margin-top:14px;text-align:center;font-size:.72rem;color:var(--mute)}'
+'.ovcell{background:var(--card);border:1px solid var(--line);border-radius:14px;min-height:60px;padding:6px 2px;text-align:center;font-size:.75rem;color:var(--mute);width:100%}'
+'.ovcell b{display:block;font-size:.8rem;margin-top:4px;color:var(--text)}'
+'.ovcell.p{background:rgba(52,210,123,.16);border-color:#34d27b}.ovcell.p b{color:#34d27b}'
+'.ovcell.n{background:rgba(255,107,107,.16);border-color:#ff6b6b}.ovcell.n b{color:#ff6b6b}'
+'.ovcell.t{outline:2px solid var(--pri2)}.ovcell.blank{visibility:hidden}'
+'.ovp{color:#16a34a}.ovm{color:#dc2626}[data-theme=dark] .ovp{color:#34d27b}[data-theme=dark] .ovm{color:#ff6b6b}';
var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

var O = {tab:'month', off:0, m:{}};
var TH = function(n){return Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:0})};
var SG = function(n){return (n>0?'+':n<0?'-':'')+TH(Math.abs(n))};
var bkk = function(d){return new Date(d).toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'})};
var iso = function(d){return d.toISOString().slice(0,10)};
var U = function(y,m,d){return new Date(Date.UTC(y,m,d))};
var PM = {cash:'เงินสด',card:'บัตร',transfer:'โอน',other:'อื่นๆ'};
var EX = {rent:'ค่าเช่า',water:'ค่าน้ำ',electric:'ค่าไฟ',travel:'ค่าเดินทาง',labor:'ค่าแรง',packaging:'บรรจุภัณฑ์',other:'อื่นๆ'};

function range(){
  var t = new Date(bkk(new Date())+'T00:00:00Z'), s, e, label;
  if(O.tab==='week'){
    s = new Date(t); s.setUTCDate(s.getUTCDate()-((t.getUTCDay()+6)%7)+O.off*7);
    e = new Date(s); e.setUTCDate(e.getUTCDate()+7);
    var l = new Date(e); l.setUTCDate(l.getUTCDate()-1);
    var f = function(d){return d.toLocaleDateString('th-TH',{day:'numeric',month:'short',timeZone:'UTC'})};
    label = f(s)+' - '+f(l);
  } else if(O.tab==='month'){
    s = U(t.getUTCFullYear(),t.getUTCMonth()+O.off,1); e = U(s.getUTCFullYear(),s.getUTCMonth()+1,1);
    label = s.toLocaleDateString('th-TH',{month:'long',year:'numeric',timeZone:'UTC'});
  } else if(O.tab==='year'){
    s = U(t.getUTCFullYear()+O.off,0,1); e = U(s.getUTCFullYear()+1,0,1);
    label = 'ปี '+s.toLocaleDateString('th-TH',{year:'numeric',timeZone:'UTC'});
  } else { s = U(2000,0,1); e = U(2100,0,1); label = 'ยอดรวมทั้งหมด'; }
  return {s:s,e:e,label:label};
}

function shell(){
  var tabs = [['week','สัปดาห์'],['month','เดือน'],['year','ปี'],['all','ทั้งหมด']];
  return '<div class="seg">'+tabs.map(function(x){return '<button data-a="ovtab" data-v="'+x[0]+'" class="'+(O.tab===x[0]?'on':'')+'">'+x[1]+'</button>'}).join('')+'</div>'
  +'<div class="ovn" id="ovn"><button data-a="ovprev" aria-label="ก่อนหน้า">‹</button><b id="ovl"></b><button data-a="ovnext" aria-label="ถัดไป">›</button></div>'
  +'<div class="grid" id="ovc"></div>'
  +'<div class="ovdow" id="ovdow" hidden><div>จ.</div><div>อ.</div><div>พ.</div><div>พฤ.</div><div>ศ.</div><div>ส.</div><div>อา.</div></div>'
  +'<div class="ovcal" id="ovcal" style="margin-top:12px"></div><p class="empty" id="ovmsg" style="padding:16px"></p>';
}

var origDash = dashPage;
dashPage = function(){
  return '<h2>ภาพรวมร้าน</h2>'+shell()
   +'<details class="ovd"><summary>สถานะสินค้าและคลัง</summary>'+String(origDash()).replace('<h2>ภาพรวมร้าน</h2>','')+'</details>';
};
var origRender = render;
render = function(){ origRender.apply(this, arguments); if(S.ready && S.cur==='dash') ovLoad(); };

async function ovLoad(){
  var r = range(), c0 = $('ovcal'); if(!c0) return;
  $('ovl').textContent = r.label; $('ovmsg').textContent = 'กำลังโหลด...'; c0.innerHTML = ''; $('ovc').innerHTML = '';
  $('ovn').style.visibility = O.tab==='all' ? 'hidden' : 'visible';
  var a = iso(r.s), b = iso(r.e), my = r.s;
  var res = await Promise.all([
    S.sb.from('sales').select('id,product_id,qty,unit_price,unit_cost,payment_method,created_at').is('voided_at',null).gte('created_at',a+'T00:00:00+07:00').lt('created_at',b+'T00:00:00+07:00').order('created_at').limit(5000),
    S.sb.from('expenses').select('id,kind,amount,paid_on,note').is('voided_at',null).gte('paid_on',a).lt('paid_on',b).limit(5000)
  ]);
  if(!$('ovcal')) return;
  var err = res[0].error || res[1].error;
  if(err){ $('ovmsg').textContent = 'โหลดข้อมูลไม่สำเร็จ: '+err.message; return; }
  var names = {}; (S.prods||[]).forEach(function(p){names[p.id] = p.code+' '+p.name});
  var key = function(d){return O.tab==='year' ? d.slice(0,7) : d};
  var m = {}, T = {rev:0,gross:0,exp:0,n:0};
  var get = function(k){return m[k] || (m[k] = {rev:0,gross:0,exp:0,sales:[],exps:[],names:names})};
  res[0].data.forEach(function(x){
    var rev = x.unit_price*x.qty, g = (x.unit_price-x.unit_cost)*x.qty, o = get(key(bkk(x.created_at)));
    o.rev += rev; o.gross += g; o.sales.push(x); T.rev += rev; T.gross += g; T.n += x.qty;
  });
  res[1].data.forEach(function(x){ var o = get(key(x.paid_on)); o.exp += Number(x.amount); o.exps.push(x); T.exp += Number(x.amount); });
  O.m = m;
  var net = T.gross - T.exp;
  $('ovc').innerHTML =
    '<div class="card"><small>กำไรสุทธิ</small><b class="v '+(net>=0?'ovp':'ovm')+'">฿'+SG(net)+'</b></div>'
   +'<div class="card"><small>ยอดขาย ('+TH(T.n)+' ชิ้น)</small><b class="v">฿'+TH(T.rev)+'</b></div>'
   +'<div class="card"><small>กำไรขั้นต้น</small><b class="v">฿'+TH(T.gross)+'</b></div>'
   +'<div class="card"><small>รายจ่าย</small><b class="v">฿'+TH(T.exp)+'</b></div>';
  $('ovmsg').textContent = (!T.n && !T.exp) ? 'ยังไม่มีรายการในช่วงนี้' : '';
  $('ovdow').hidden = O.tab!=='month';
  c0.style.gridTemplateColumns = O.tab==='year' ? 'repeat(3,1fr)' : 'repeat(7,1fr)';
  if(O.tab==='all') return;
  var h = '', today = bkk(new Date());
  if(O.tab==='year'){
    for(var i=0;i<12;i++){
      var k = my.getUTCFullYear()+'-'+String(i+1).padStart(2,'0');
      h += cell(k, U(2000,i,1).toLocaleDateString('th-TH',{month:'short',timeZone:'UTC'}), m[k], false);
    }
  } else {
    if(O.tab==='month'){ for(var j=0;j<(my.getUTCDay()+6)%7;j++) h += '<div class="ovcell blank"></div>'; }
    for(var d = new Date(my); d < r.e; d.setUTCDate(d.getUTCDate()+1)){
      var k2 = iso(d); h += cell(k2, d.getUTCDate(), m[k2], k2===today);
    }
  }
  c0.innerHTML = h;
}
function cell(k,label,o,today){
  if(!o) return '<div class="ovcell'+(today?' t':'')+'">'+label+'<b>—</b></div>';
  var net = o.gross - o.exp;
  return '<button class="ovcell '+(net>=0?'p':'n')+(today?' t':'')+'" data-a="ovday" data-v="'+k+'">'+label+'<b>'+SG(net)+'</b></button>';
}

function openBucket(k){
  var o = O.m[k]; if(!o) return;
  var title = k.length===7
    ? U(+k.slice(0,4),+k.slice(5)-1,1).toLocaleDateString('th-TH',{month:'long',year:'numeric',timeZone:'UTC'})
    : new Date(k+'T00:00:00Z').toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  var net = o.gross - o.exp;
  var h = head(esc(title))
   +'<div class="kv"><span>ยอดขาย</span><b>฿'+TH(o.rev)+'</b></div>'
   +'<div class="kv"><span>กำไรขั้นต้น</span><b>฿'+TH(o.gross)+'</b></div>'
   +'<div class="kv"><span>รายจ่าย</span><b>฿'+TH(o.exp)+'</b></div>'
   +'<div class="kv"><span>กำไรสุทธิ</span><b class="'+(net>=0?'ovp':'ovm')+'">฿'+SG(net)+'</b></div>';
  h += '<details open><summary>รายการขาย ('+o.sales.length+')</summary>'+(o.sales.map(function(x){
    var t = new Date(x.created_at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
    var g = (x.unit_price-x.unit_cost)*x.qty;
    return '<div class="kv"><span>'+esc(o.names[x.product_id]||'สินค้า')+' x'+x.qty+'<br><small>'+t+' · '+(PM[x.payment_method]||'')+'</small></span><span>฿'+TH(x.unit_price*x.qty)+'<br><small class="'+(g>=0?'ovp':'ovm')+'">กำไร '+SG(g)+'</small></span></div>';
  }).join('') || '<div class="empty">ไม่มีรายการขาย</div>')+'</details>';
  h += '<details><summary>รายจ่าย ('+o.exps.length+')</summary>'+(o.exps.map(function(x){
    return '<div class="kv"><span>'+(EX[x.kind]||'อื่นๆ')+(x.note?' · '+esc(x.note):'')+'</span><span>฿'+TH(x.amount)+'</span></div>';
  }).join('') || '<div class="empty">ไม่มีรายจ่าย</div>')+'</details>';
  openSheet(h);
}

/* every popup: expand/collapse button + collapsible sections */
function post(){
  var sh = $('sheet'), body = $('sbody');
  sh.classList.remove('full');
  var hd = body.querySelector('.sh');
  if(hd && !hd.querySelector('.ex')){
    var b = document.createElement('button');
    b.className = 'x ex'; b.setAttribute('data-a','expand'); b.setAttribute('aria-label','ขยายหรือย่อ'); b.textContent = '⤢';
    hd.insertBefore(b, hd.querySelector('.x'));
  }
  Array.prototype.slice.call(body.querySelectorAll('h3')).forEach(function(h){
    if(h.parentNode !== body) return;
    var d = document.createElement('details'), s = document.createElement('summary');
    d.open = true; s.textContent = h.textContent;
    h.parentNode.insertBefore(d, h); d.appendChild(s);
    var n = h.nextElementSibling;
    while(n && n.tagName !== 'H3' && !/(^|\s)btns?(\s|$)/.test(n.className || '')){
      var nx = n.nextElementSibling; d.appendChild(n); n = nx;
    }
    h.parentNode.removeChild(h);
  });
}
var origOpen = openSheet;
openSheet = function(h){ origOpen(h); post(); };
var origClose = closeSheet;
closeSheet = function(){ origClose(); $('sheet').classList.remove('full'); };

A.expand = function(){ $('sheet').classList.toggle('full'); };
A.ovtab = function(v){
  O.tab = v; O.off = 0;
  document.querySelectorAll('.seg button').forEach(function(x){x.classList.toggle('on', x.getAttribute('data-v')===v)});
  ovLoad();
};
A.ovprev = function(){ O.off--; ovLoad(); };
A.ovnext = function(){ O.off++; ovLoad(); };
A.ovday = function(v){ openBucket(v); };
})();
