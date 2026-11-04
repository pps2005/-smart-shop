/* ============================================================
   fah.js — น้องฟ้า v2: คุยเป็นธรรมชาติขึ้น + พูดออกเสียงได้ (ฟรี ไม่ใช้ AI API)
   - ชั้นบทสนทนา: จำชื่อ/วิธีเรียกผู้ใช้, จำเรื่องที่เพิ่งถาม แล้วตอบต่อเนื่อง,
     จับอารมณ์ดี/ไม่ดี, ตอบรับแบบสะท้อนคำพูด แทนข้อความ "ไม่เข้าใจ"
     คำถามเรื่องข้อมูลร้าน/วิธีใช้ ยังส่งให้ระบบเดิม (world-ui.js) ตอบเหมือนเดิม
   - เสียง: Web Speech API ของเครื่อง (ฟรี) ปรับโทน/ความเร็ว/เลือกเสียงได้
     มีพรีเซ็ต "น่ารัก (16–20 ปี)" · พูดคำตอบในแชท + พูดตอนเลขาเตือนงาน
   - ใช้เสียงจากแอปแปลงเสียงได้: อัดคลิปสั้นจากแอปแล้วอัปโหลดเป็นเสียง
     ทักทาย / แจ้งเตือน / ตอบรับ (เก็บในเครื่องนี้)
   ลำดับโหลด: หลัง easy.js · วิธียกเลิก: ลบ <script src="fah.js">
   ============================================================ */
(function () {
  'use strict';
  var $$ = function (s) { return document.querySelector(s); };
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function E_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hour() { return +new Date().toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' }); }

  /* ---------- ความจำ (เก็บในเครื่อง) ---------- */
  var MEM = { name: '', call: 'พี่', pend: '', last: '', n: 0, likes: [] };
  try { var m0 = JSON.parse(localStorage.getItem('ss_fah') || 'null'); if (m0) Object.assign(MEM, m0); } catch (e) {}
  function msave() { try { localStorage.setItem('ss_fah', JSON.stringify(MEM)); } catch (e) {} }
  function you() { return MEM.call === 'name' && MEM.name ? MEM.name : MEM.call === 'เพื่อน' ? 'เพื่อน' : 'พี่' + (MEM.name ? MEM.name : ''); }
  function youShort() { return MEM.call === 'name' && MEM.name ? MEM.name : MEM.call === 'เพื่อน' ? 'เพื่อน' : 'พี่'; }

  /* ---------- 1) ชั้นบทสนทนา ---------- */
  var BIZ = /ยอด|ขาย|กำไร|สต[็๊]?อก|สต๊อค|สินค้า|ค่าเช่า|ผู้เช่า|ห้องเช่า|ค้าง|งาน|นัด|ตาราง|เตือน|จด|ภาษี|รายจ่าย|รายรับ|บัญชี|เมนู|วิธี|ยังไง|อย่างไร|เพิ่ม|ลบ|แก้|คลัง|ราคา|ต้นทุน|สรุป|รายงาน|เติม|หมด|มูลค่า|ประเภท|หมวด|สถานะ|ข่าว|ทำอะไรได้|ช่วยอะไรได้|มุก|ตลก|ตั้งค่า|qr|คิวอาร์|บาร์โค้ด|ออเดอร์|ตะกร้า|[A-Za-z]{3}-?\d{3}/i;
  var POS = /ดี(มาก|ใจ|จัง)?|สนุก|แฮปปี้|happy|สบาย|เยี่ยม|ปัง|ขายดี|รวย|โอเค|ok|ชอบ|สุดยอด|เจ๋ง|ผ่าน|สำเร็จ|หายแล้ว|555|ฮ่า/i;
  var NEG = /แย่|เหนื่อย|เครียด|ท้อ|เศร้า|เหงา|ไม่ไหว|หงุดหงิด|กังวล|เบื่อ|โกรธ|ป่วย|ไม่สบาย|ปวด|เจ็บ|ขายไม่ได้|เงียบ|ร้องไห้|เสียใจ|ผิดหวัง|ไม่ดี|งานเยอะ|ยุ่ง/;
  var END = [' ค่ะ', ' นะคะ', ' น้า', ' ค่า'];
  function clean(s) { return s.replace(/(ค่ะ|คะ|ครับ|คับ|งับ|นะ|น่ะ|จ้ะ|จ้า|อะ|อ่ะ|หน่อย|ด้วย|เลย)+\s*$/g, '').trim() || s; }
  function bit(s, n) { s = s.replace(/\s+/g, ' ').trim(); return s.length > (n || 28) ? s.slice(0, n || 28) + '…' : s; }

  function ask(topic, q) { MEM.pend = topic; msave(); return q; }

  function chat(raw) {
    var q = raw.trim(), s = clean(q), r, mm;
    MEM.n++;
    /* ชื่อ / วิธีเรียก */
    if ((mm = s.match(/(?:ฉัน|ผม|เรา|หนู|พี่)?\s*ชื่อ\s*([ก-๙A-Za-z]{1,20})$/)) && !/อะไร|ไร/.test(mm[1])) { MEM.name = mm[1]; MEM.pend = ''; msave(); return pick(['ยินดีที่ได้รู้จักนะคะ' + you() + ' 🌸 ฟ้าจำไว้แล้วค่า', 'ชื่อ' + mm[1] + 'เหรอคะ น่ารักจัง ฟ้าจะเรียก' + you() + 'นะคะ 😊']); }
    if ((mm = s.match(/^เรียก(?:ฉัน|ผม|เรา|หนู)?ว่า\s*([ก-๙A-Za-z]{1,20})$/))) {
      var w = mm[1]; if (/^พี่/.test(w)) { MEM.call = 'พี่'; MEM.name = w.replace(/^พี่/, ''); } else if (w === 'เพื่อน') MEM.call = 'เพื่อน'; else { MEM.call = 'name'; MEM.name = w; }
      msave(); return 'ได้เลยค่ะ ต่อไปฟ้าจะเรียกว่า "' + you() + '" นะคะ 💕';
    }
    if (/ฉันชื่ออะไร|ผมชื่ออะไร|จำชื่อ.*ได้ไหม|รู้จักฉันไหม/.test(s)) return MEM.name ? 'จำได้สิคะ ' + you() + ' ไงคะ 😊' : ask('name', 'ฟ้ายังไม่รู้ชื่อเลยค่ะ 🥺 บอกฟ้าได้ไหมคะ ว่าให้เรียกว่าอะไรดี?');

    if (/เสียง/.test(s) && /เปลี่ยน|ปรับ|ตั้ง|ไม่ชอบ|เล็ก|แหลม|ทุ้ม/.test(s)) { setTimeout(openVoice, 50); return 'ปรับเสียงฟ้าได้เลยค่ะ 🎀 ฟ้าเปิดหน้าตั้งค่าเสียงให้แล้วนะคะ'; }
    if (/^(ปิดเสียง|เงียบ|หยุดพูด)/.test(s)) { VO.on = false; vsave(); syncBtn(); return 'ได้ค่ะ ฟ้าจะพิมพ์อย่างเดียวนะคะ 🤫 กดปุ่ม 🔈 ด้านบนเพื่อเปิดเสียงได้เลย'; }
    if (/^(เปิดเสียง|พูดหน่อย|พูดได้ไหม)/.test(s)) { VO.on = true; vsave(); syncBtn(); return 'เปิดเสียงแล้วค่ะ ได้ยินฟ้าไหมคะ' + youShort() + ' 🎀'; }
    if (/อากาศ|ฝน|ร้อนไหม|หนาวไหม|พายุ/.test(s)) return pick(['ฟ้ายังดูพยากรณ์อากาศให้ไม่ได้นะคะ 🥺 ลองเปิดแอปพยากรณ์อากาศดูก่อนน้า ถ้าฝนตกอย่าลืมเก็บของหน้าร้านด้วยนะคะ ☔', 'เรื่องฝนฟ้าอากาศฟ้าเช็กให้ไม่ได้ค่ะ 😅 แต่ถ้าออกไปข้างนอก พกร่มไว้ก่อนอุ่นใจกว่านะคะ']);
    if (/ซีรีส์|ซีรี่ย์|หนัง|ดูการ์ตูน|อนิเมะ|เพลง|ฟังเพลง|เกม|เล่นเกม/.test(s)) { var hb = /ซีรี/.test(s) ? 'ดูซีรีส์' : /หนัง|การ์ตูน|อนิเมะ/.test(s) ? 'ดูหนัง' : /เพลง/.test(s) ? 'ฟังเพลง' : 'เล่นเกม';
      return pick(['ว้าว ' + hb + 'อยู่เหรอคะ 😆 ฟ้าก็ชอบนะ ', 'ดีจังเลยค่ะ ได้' + hb + 'พักผ่อนบ้าง 🍿 ']) + ask('tell', 'เรื่องไหนสนุกสุดคะ เล่าให้ฟ้าฟังหน่อย'); }
    /* ตอบต่อจากคำถามที่ฟ้าเพิ่งถาม */
    var pend = MEM.pend; MEM.pend = ''; msave();
    if (pend && !BIZ.test(s)) {
      if (pend === 'name' && s.length <= 20 && !/\s/.test(s)) { MEM.name = s.replace(/^(ชื่อ|เรียก(ว่า)?)/, ''); msave(); return 'ยินดีที่ได้รู้จักค่ะ ' + you() + ' 🌸 ต่อไปฟ้าจะเรียกแบบนี้นะคะ'; }
      if (pend === 'day') {
        if (NEG.test(s)) return pick(['งื้อ ฟังแล้วฟ้าเป็นห่วงเลยค่ะ 🫂 ไม่เป็นไรนะคะ' + youShort() + ' พักก่อนก็ได้ เรื่องร้านเดี๋ยวฟ้าช่วยดูให้', 'โอ๋ ๆ นะคะ วันแบบนี้มีได้ค่ะ ' + youShort() + 'เก่งมากแล้วที่ผ่านมาได้ อยากเล่าให้ฟ้าฟังไหมคะ?']);
        if (POS.test(s)) return pick(['เย้ ดีใจด้วยค่า ✨ ได้ยินแบบนี้ฟ้าก็อารมณ์ดีตามเลย', 'ดีจังเลยค่ะ 😆 วันดี ๆ แบบนี้ขอให้ขายดีทั้งวันเลยนะคะ']);
        return pick(['อื้อ ฟ้าฟังอยู่นะคะ เล่าต่อได้เลย 😊', 'งั้นวันนี้ค่อย ๆ ไปทีละอย่างนะคะ มีอะไรให้ฟ้าช่วยบอกได้เลยค่ะ']);
      }
      if (pend === 'food') { if (MEM.likes.indexOf(s) < 0) { MEM.likes.push(bit(s, 20)); MEM.likes = MEM.likes.slice(-6); msave(); } return pick(['"' + bit(s, 20) + '" น่ากินมากเลยค่ะ 🤤 ฟ้าจดไว้ในใจแล้ว คราวหน้าจะแนะนำแนวนี้ให้นะคะ', 'ว้าว ' + bit(s, 20) + ' เหรอคะ ฟ้าหิวตามเลย 😋 กินเยอะ ๆ นะคะ จะได้มีแรงขายของ']); }
      if (pend === 'trip') return pick(['ว้าว ' + bit(s, 20) + ' เลยเหรอคะ ✈️ ฟ้าอยากไปด้วยจัง ถ้าขายดี ๆ เก็บเงินไปเที่ยวกันนะคะ', bit(s, 20) + ' ดีเลยค่ะ! ฟ้าว่าบรรยากาศต้องดีมากแน่ ๆ ตั้งเป้าไว้เลยค่ะ ' + youShort() + ' ต้องได้ไปแน่นอน 💪']);
      if (pend === 'tell') return pick(['ฟ้าฟังอยู่นะคะ… ' + (NEG.test(s) ? 'เป็นฟ้าก็คงรู้สึกแบบเดียวกันค่ะ ไม่แปลกเลย 🫂' : 'เล่าเก่งมากเลยค่ะ ฟ้าตั้งใจฟังสุด ๆ 😊'), 'อื้อ ๆ แล้วยังไงต่อคะ? 👀']);
    }

    /* อารมณ์ / เรื่องทั่วไปที่ระบบเดิมยังไม่ตอบ */
    if (/^(ฟ้า|น้องฟ้า|ฟ้าจ๋า|ฟ้า ๆ|ฟ้าๆ)$/.test(s)) CUE = 'ok';
    if (CUE) return pick(['ค้า~ ฟ้าอยู่นี่ค่ะ 🙋‍♀️ มีอะไรให้ช่วยคะ' + youShort(), 'ขา~ เรียกฟ้าเหรอคะ 😊', 'ค่า มาแล้วค่ะ ✨']);
    if (/^(สวัสดี|หวัดดี|ดีจ้า|ดีค่ะ|ดีครับ|hello|hi\b|hey|ว่าไง)/i.test(s)) {
      var h = hour(), g = h < 5 ? 'ดึกแล้ว ยังไม่นอนอีกเหรอคะ 🌙' : h < 11 ? 'อรุณสวัสดิ์ค่า ☀️' : h < 13 ? 'สวัสดีตอนเที่ยงค่ะ ทานข้าวหรือยังคะ? 🍚' : h < 17 ? 'สวัสดีตอนบ่ายค่า 🌤️' : 'สวัสดีตอนเย็นค่ะ เหนื่อยไหมคะวันนี้ 🌇';
      return (MEM.name ? you() + ' ' : '') + g + ' ' + ask('day', pick(['วันนี้เป็นยังไงบ้างคะ?', 'วันนี้ร้านเป็นไงบ้างคะ?', 'มีอะไรให้ฟ้าช่วยไหมคะ?']));
    }
    if (/เป็นไงบ้าง|เป็นยังไงบ้าง|สบายดีไหม|ทำอะไรอยู่/.test(s)) return 'ฟ้าสบายดีค่ะ กำลังนั่งจัดตารางงานให้อยู่เลย 📅 ' + ask('day', 'แล้ว' + youShort() + 'ล่ะคะ วันนี้เป็นยังไงบ้าง?');
    if (/เบื่อ|เหงา|ไม่มีใครคุย|คุยเล่น|คุยหน่อย|คุยด้วย/.test(s)) { var tq = pick([['trip', 'ถ้าไปเที่ยวได้ที่เดียว อยากไปไหนคะ?'], ['food', 'ช่วงนี้ชอบกินอะไรอยู่คะ?'], ['tell', 'วันนี้มีเรื่องอะไรเกิดขึ้นบ้างคะ? เล่าให้ฟ้าฟังหน่อย']]); return 'มาคุยกับฟ้าได้เลยค่ะ 💕 ' + ask(tq[0], tq[1]); }
    if (/ลูกค้าน้อย|ไม่ค่อยมีคน|ไม่มีคนเข้า|ร้านเงียบ|คนน้อย/.test(s)) return pick(['งื้อ วันเงียบ ๆ มีได้ค่ะ' + youShort() + ' อย่าเพิ่งท้อนะคะ 🫂 ลองโพสต์รูปสินค้าใหม่ลงโซเชียล หรือจัดโปรเล็ก ๆ ดูไหมคะ ', 'ไม่เป็นไรนะคะ วันนี้เงียบ พรุ่งนี้อาจขายดีก็ได้ ✨ ช่วงนี้ฟ้าว่าลองจัดหน้าร้านใหม่ หรือแจ้งลูกค้าประจำว่ามีของเข้าใหม่ดีไหมคะ ']) + ask('tell', 'ปกติลูกค้าเยอะช่วงไหนคะ?');
    if (NEG.test(s) && s.length < 60) return pick(['งื้อ ' + youShort() + 'คะ 🫂 ' , 'โอ๋ ๆ นะคะ ' ]) + ask('tell', pick(['เกิดอะไรขึ้นเหรอคะ เล่าให้ฟ้าฟังได้นะ', 'พักดื่มน้ำก่อนนะคะ แล้วอยากเล่าไหมว่าเป็นอะไร?']));
    if (/หิว|กินอะไรดี|ยังไม่ได้กิน/.test(s)) return (MEM.likes.length ? 'ฟ้าจำได้ว่า' + youShort() + 'ชอบ ' + pick(MEM.likes) + ' ไปกินอันนั้นดีไหมคะ 😋 ' : pick(['ตอนนี้ฟ้าว่าข้าวมันไก่ก็ดีนะคะ 🍗 ', 'ก๋วยเตี๋ยวเรือร้อน ๆ สักชามไหมคะ 🍜 ', 'กะเพราไข่ดาวไม่เคยทำให้ผิดหวังค่ะ 🍳 '])) + ask('food', 'ปกติ' + youShort() + 'ชอบกินอะไรที่สุดคะ?');
    if (/เที่ยว|อยากไป|ทะเล|ภูเขา/.test(s)) return pick(['พูดถึงเที่ยวแล้วฟ้าตื่นเต้นเลยค่ะ ✈️ ', 'อยากไปเที่ยวเหมือนกันค่า 🏖️ ']) + ask('trip', 'ถ้าไปได้ที่เดียว ' + youShort() + 'อยากไปไหนที่สุดคะ?');
    if (/อายุ|กี่ขวบ/.test(s) && /ฟ้า|เธอ|หนู|คุณ/.test(s)) return 'ถ้าเป็นคนจริง ฟ้าก็คงประมาณสิบแปดค่ะ 😆 แต่จริง ๆ ฟ้าเป็นเลขาในเว็บนะคะ';
    return null;
  }

  /* ข้อความ "ไม่เข้าใจ" ของระบบเดิม → ตอบแบบรับฟังแทน */
  var FALLBACK = /จับใจความไม่ค่อยได้|ยังตอบไม่ได้|ยังไม่แน่ใจว่าเพื่อนหมายถึง|ยังไม่เข้าใจ|ไม่แน่ใจว่าหมายถึง/;
  function listen(q) {
    var s = clean(q);
    if (/\?|ไหม|มั้ย|หรือเปล่า|รึเปล่า|ป่าว|ยังไง|ทำไม|อะไร/.test(s)) return pick([
      'อืม… เรื่อง "' + E_(bit(s)) + '" ฟ้ายังตอบได้ไม่ชัวร์ค่ะ 🙏 แต่ถ้าเป็นเรื่องในร้าน เช่น ยอดขาย สต๊อก ค่าเช่า งานที่ต้องทำ ฟ้าตอบได้เลยนะคะ',
      'ข้อนี้ฟ้าไม่อยากเดาให้ผิดค่ะ 😅 ' + youShort() + 'ลองถามแบบสั้น ๆ อีกทีได้ไหมคะ หรือพิมพ์ "ทำอะไรได้บ้าง" ดูก็ได้น้า']);
    return pick([
      'อื้อ ฟ้าฟังอยู่นะคะ 😊 ' + ask('tell', 'เล่าต่ออีกนิดได้ไหมคะ?'),
      'เข้าใจค่ะ "' + E_(bit(s)) + '" ' + ask('tell', 'แล้ว' + youShort() + 'รู้สึกยังไงกับเรื่องนี้คะ?'),
      'ค่า ฟ้าจดไว้ในใจแล้ว 📝 มีอะไรให้ช่วยต่อบอกได้เลยน้า']);
  }

  function bubble(html) { var b = $$('#wcb'), d = document.createElement('div'); d.className = 'wm'; d.innerHTML = html; b.appendChild(d); b.scrollTop = b.scrollHeight; return d; }
  function warmify(html) { return html.replace(/เพื่อน(?!ร่วม|บ้าน)/g, youShort() === 'เพื่อน' ? 'เพื่อน' : youShort()); }

  var orig = null, mine = false, CUE = '';
  function hook() {
    if (!A.wsend || A.wsend.__fah) return; orig = A.wsend;
    var f = function (v) {
      var i = $$('#wcin'), q = (typeof v === 'string' ? v : (i ? i.value : '')).trim(); if (!q) return;
      unlock();
      var r = null; CUE = ''; try { r = BIZ.test(q) ? null : chat(q); } catch (e) { r = null; }
      if (r == null) { mine = false; return orig.apply(this, arguments); }
      /* ตอบเอง: ใช้รูปแบบเดียวกับแชทเดิม */
      if (i && typeof v !== 'string') i.value = '';
      if (A.wchat) A.wchat();
      var u = document.createElement('div'); u.className = 'wm u'; u.innerHTML = E_(q); $$('#wcb').appendChild(u);
      var ty = bubble('<span class="wdot"><i></i><i></i><i></i></span>');
      var cue = CUE; ty.__spoken = 1; setTimeout(function () { ty.innerHTML = r; ty.__done = r; $$('#wcb').scrollTop = $$('#wcb').scrollHeight; cue ? playClip(cue, spoken(ty)) : say(spoken(ty)); }, 380 + Math.min(900, r.length * 6));
    };
    f.__fah = 1; A.wsend = f;
  }

  /* เฝ้าดูคำตอบของระบบเดิม: เปลี่ยนคำเรียก + แทนข้อความไม่เข้าใจ + อ่านออกเสียง */
  function watch() {
    var cb = $$('#wcb'); if (!cb || cb.__fah) return; cb.__fah = 1;
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        var t = m.target.nodeType === 1 ? m.target : m.target.parentNode, el = t && t.closest && t.closest('.wm');
        if (m.type === 'childList') Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1 && n.classList.contains('wm')) el = n; });
        if (!el || el.classList.contains('u') || el.querySelector('.wdot') || el.__done === el.innerHTML) return;
        var prevU = el.previousElementSibling, q = prevU && prevU.classList.contains('u') ? prevU.textContent : '';
        if (FALLBACK.test(el.textContent) && q) el.innerHTML = listen(q);
        else if (MEM.call !== 'เพื่อน' && /เพื่อน/.test(el.innerHTML)) el.innerHTML = warmify(el.innerHTML);
        el.__done = el.innerHTML;
        if (!el.__spoken) { el.__spoken = 1; var isGreet = !prevU; isGreet ? playClip('greet', spoken(el)) : say(spoken(el)); }
      });
    }).observe(cb, { childList: true, subtree: true, characterData: true });
  }

  /* ---------- 2) เสียง ---------- */
  var PRE = {
    cute: { n: '🎀 น่ารัก (16–20 ปี)', p: 1.45, r: 1.07 },
    bright: { n: '✨ สดใสร่าเริง', p: 1.3, r: 1.15 },
    soft: { n: '🌸 นุ่มนวล อ่อนโยน', p: 1.2, r: 0.93 },
    normal: { n: '🙂 เสียงปกติของเครื่อง', p: 1, r: 1 }
  };
  var VO = { on: true, pre: 'cute', p: 1.45, r: 1.07, vol: 1, voice: '', note: true };
  try { var v0 = JSON.parse(localStorage.getItem('ss_voice') || 'null'); if (v0) Object.assign(VO, v0); } catch (e) {}
  function vsave() { try { localStorage.setItem('ss_voice', JSON.stringify(VO)); } catch (e) {} }
  var SY = window.speechSynthesis, voices = [];
  function loadVoices() { if (!SY) return; voices = SY.getVoices() || []; }
  if (SY) { loadVoices(); try { SY.addEventListener('voiceschanged', loadVoices); } catch (e) { SY.onvoiceschanged = loadVoices; } }
  var FEM = /kanya|narisa|premwadee|achara|pattara|niwat-?no|female|ผู้หญิง|หญิง|google ไทย|google thai|siri/i;
  function thVoices() { return voices.filter(function (v) { return /^th/i.test(v.lang); }); }
  function chooseVoice() {
    var th = thVoices(); if (!th.length) return null;
    if (VO.voice) { var f = th.find(function (v) { return v.voiceURI === VO.voice || v.name === VO.voice; }); if (f) return f; }
    return th.find(function (v) { return FEM.test(v.name) && !/niwat/i.test(v.name); }) || th[0];
  }
  function toSpeech(t) {
    t = String(t || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ');
    t = t.replace(/฿\s?([\d,\.]+)/g, '$1 บาท').replace(/(\d),(\d)/g, '$1$2').replace(/\s*[•·]\s*/g, ', ').replace(/[“”"「」]/g, '').replace(/\bPAN-/g, 'แพน ').replace(/…/g, '').replace(/\s+/g, ' ').trim();
    if (t.length > 240) { var cut = t.slice(0, 240), k = Math.max(cut.lastIndexOf(' '), 160); t = cut.slice(0, k); }
    return t;
  }
  /* ข้อความที่จะพูดจากกล่องแชท: ตัดปุ่มออก และเว้นจังหวะตรงขึ้นบรรทัดใหม่ */
  function spoken(el) {
    var c = el.cloneNode(true); Array.prototype.forEach.call(c.querySelectorAll('button,.wbtns'), function (b) { b.remove(); });
    Array.prototype.forEach.call(c.querySelectorAll('br,li,.kv,div'), function (b) { b.insertAdjacentText('beforebegin', ' . '); });
    return c.textContent.replace(/(\s*\.\s*){2,}/g, ' . ').replace(/^\s*\.\s*/, '');
  }
  function say(text, force) {
    if (!SY || (!VO.on && !force)) return; var t = toSpeech(text); if (!t) return;
    try {
      SY.cancel(); var u = new SpeechSynthesisUtterance(t), v = chooseVoice();
      u.lang = 'th-TH'; if (v) u.voice = v; u.pitch = Math.max(0, Math.min(2, VO.p)); u.rate = Math.max(.5, Math.min(2, VO.r)); u.volume = VO.vol;
      SY.speak(u);
    } catch (e) { console.warn('fah speak', e); }
  }
  /* iPhone ต้องแตะหน้าจอก่อน 1 ครั้งถึงจะพูดได้ */
  var unlocked = false;
  function unlock() { if (unlocked || !SY) return; unlocked = true; try { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; SY.speak(u); } catch (e) {} try { ctx(); } catch (e) {} }
  document.addEventListener('pointerdown', unlock, { once: false, passive: true });

  /* เสียงติ๊งก่อนแจ้งเตือน */
  var AC = null; function ctx() { if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function chime() {
    var c = ctx(); if (!c) return; var t = c.currentTime;
    [[1046.5, 0], [1318.5, .13], [1568, .26]].forEach(function (n) { var o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = n[0]; g.gain.setValueAtTime(0, t + n[1]); g.gain.linearRampToValueAtTime(.18 * VO.vol, t + n[1] + .02); g.gain.exponentialRampToValueAtTime(.001, t + n[1] + .45); o.connect(g); g.connect(c.destination); o.start(t + n[1]); o.stop(t + n[1] + .5); });
  }

  /* ---------- คลิปเสียงจากแอปแปลงเสียง (IndexedDB) ---------- */
  var SLOTS = { greet: 'ทักทายตอนเปิดแชท', alert: 'เสียงแจ้งเตือนงาน', ok: 'ตอบรับ ("ค่า~")' }, CLIP = {};
  function idb(fn) { try { var r = indexedDB.open('ss_fah', 1); r.onupgradeneeded = function () { r.result.createObjectStore('clips'); }; r.onsuccess = function () { fn(r.result); }; } catch (e) {} }
  function loadClips() { idb(function (db) { var tx = db.transaction('clips'), st = tx.objectStore('clips'); Object.keys(SLOTS).forEach(function (k) { var g = st.get(k); g.onsuccess = function () { if (g.result) CLIP[k] = URL.createObjectURL(g.result); }; }); }); }
  function putClip(k, blob) { idb(function (db) { var tx = db.transaction('clips', 'readwrite'); if (blob) tx.objectStore('clips').put(blob, k); else tx.objectStore('clips').delete(k); }); if (CLIP[k]) URL.revokeObjectURL(CLIP[k]); CLIP[k] = blob ? URL.createObjectURL(blob) : null; }
  loadClips();
  function playClip(k, fallback) {
    if (!VO.on) return;
    if (CLIP[k]) { try { if (SY) SY.cancel(); var a = new Audio(CLIP[k]); a.volume = VO.vol; a.play().catch(function () { if (fallback) say(fallback); }); return; } catch (e) {} }
    if (fallback) say(fallback);
  }

  /* แจ้งเตือนของเลขา (จาก world-ui.js: toast('เลขาเตือน: ...')) → ติ๊ง + พูด */
  var _toast = window.toast;
  if (typeof _toast === 'function') window.toast = function (m) {
    _toast.apply(this, arguments);
    var s = String(m || '');
    if (/^เลขาเตือน[:：]/.test(s) && VO.note) {
      chime(); var job = s.replace(/^เลขาเตือน[:：]\s*/, '');
      setTimeout(function () { CLIP.alert ? playClip('alert') : say(youShort() + 'คะ ถึงเวลา ' + job + ' แล้วนะคะ', true); }, 650);
      if (CLIP.alert) setTimeout(function () { say(job, true); }, 2600);
    }
  };

  /* ---------- หน้าตั้งค่าเสียง ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '.wch .fvb{width:36px;height:36px;border-radius:12px;background:rgba(255,255,255,.22);color:#fff;font-size:1.05rem;display:grid;place-items:center;flex:0 0 36px}',
    '.fvp{position:absolute;inset:0;z-index:9;display:none;background:rgba(15,23,42,.45);align-items:flex-end;justify-content:center}.fvp.on{display:flex}',
    '.fvp>div{width:min(460px,100%);max-height:88%;overflow:auto;background:var(--card,#fff);color:var(--text,#0f172a);border-radius:22px 22px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px));font-size:1rem}',
    '.fvp h3{display:flex;align-items:center;margin:0 0 12px;font-size:1.15rem}.fvp h3 button{margin-left:auto;width:38px;height:38px;border-radius:12px;background:var(--bg,#f4f6fb);font-size:1.1rem}',
    '.fvp .pr{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fvp .pr button{min-height:54px;border-radius:14px;border:2px solid var(--line,#e5e9f2);background:var(--bg,#f4f6fb);font-weight:700;font-size:.95rem;padding:8px;color:var(--text,#0f172a)}.fvp .pr button.on{border-color:#ec4899;background:rgba(236,72,153,.12)}',
    '.fvp .rw{margin-top:14px}.fvp .rw div{display:flex;justify-content:space-between;font-weight:700;margin-bottom:4px}.fvp .rw small{color:var(--mute,#64748b);font-weight:500}.fvp input[type=range]{width:100%;accent-color:#ec4899;height:28px}',
    '.fvp select{width:100%;padding:12px;border-radius:12px;border:2px solid var(--line,#e5e9f2);background:var(--bg,#f4f6fb);font-size:16px;color:inherit}',
    '.fvp .tg{display:flex;align-items:center;gap:10px;padding:12px 0;border-top:1px solid var(--line,#e5e9f2);margin-top:12px;font-weight:700}.fvp .tg span{flex:1}.fvp .tg input{width:22px;height:22px;accent-color:#ec4899}',
    '.fvp .go{width:100%;min-height:56px;border-radius:16px;background:linear-gradient(135deg,#f472b6,#ec4899);color:#fff;font-weight:800;font-size:1.1rem;margin-top:14px}',
    '.fvp .cl{display:flex;align-items:center;gap:8px;padding:10px 0;border-top:1px solid var(--line,#e5e9f2)}.fvp .cl span{flex:1;min-width:0;overflow-wrap:anywhere}.fvp .cl label,.fvp .cl button{padding:8px 10px;border-radius:10px;border:1px solid var(--line,#e5e9f2);font-size:.85rem;background:var(--bg,#f4f6fb);color:inherit;cursor:pointer;white-space:nowrap}',
    '.fvp .nt{font-size:.85rem;color:var(--mute,#64748b);line-height:1.5;margin-top:10px}'
  ].join('');
  document.head.appendChild(css);

  var panel = null, vbtn = null;
  function syncBtn() { if (vbtn) { vbtn.textContent = VO.on ? '🔊' : '🔈'; vbtn.setAttribute('aria-label', VO.on ? 'ปิดเสียงน้องฟ้า' : 'เปิดเสียงน้องฟ้า'); } }
  function openVoice() {
    loadVoices(); if (!panel) return;
    var th = thVoices(), cur = chooseVoice();
    var h = '<div><h3>🎀 เสียงน้องฟ้า<button data-fx="x" aria-label="ปิด">✕</button></h3>' +
      '<div class="pr">' + Object.keys(PRE).map(function (k) { return '<button data-fp="' + k + '" class="' + (VO.pre === k ? 'on' : '') + '">' + PRE[k].n + '</button>'; }).join('') + '</div>' +
      '<div class="rw"><div><span>โทนเสียง <small>(ต่ำ ↔ สูง/เด็กลง)</small></span><b id="fpv">' + VO.p.toFixed(2) + '</b></div><input type="range" id="fp" min="0.5" max="2" step="0.05" value="' + VO.p + '"></div>' +
      '<div class="rw"><div><span>ความเร็วพูด</span><b id="frv">' + VO.r.toFixed(2) + '</b></div><input type="range" id="fr" min="0.6" max="1.6" step="0.05" value="' + VO.r + '"></div>' +
      '<div class="rw"><div><span>ความดัง</span><b id="fvv">' + Math.round(VO.vol * 100) + '%</b></div><input type="range" id="fv" min="0.1" max="1" step="0.05" value="' + VO.vol + '"></div>' +
      '<div class="rw"><div><span>เสียงในเครื่อง</span></div>' + (th.length ? '<select id="fs">' + th.map(function (v) { return '<option value="' + E_(v.voiceURI) + '"' + (cur && cur.voiceURI === v.voiceURI ? ' selected' : '') + '>' + E_(v.name) + '</option>'; }).join('') + '</select>' : '<div class="nt">เครื่องนี้ยังไม่มีเสียงภาษาไทย · iPhone: ตั้งค่า → การช่วยการเข้าถึง → เนื้อหาที่พูด → เสียง → ไทย แล้วดาวน์โหลดเสียงผู้หญิง (เช่น Kanya)</div>') + '</div>' +
      '<button class="go" data-fx="test">▶️ ทดลองฟังเสียง</button>' +
      '<label class="tg"><span>🔊 พูดคำตอบในแชท</span><input type="checkbox" id="fon"' + (VO.on ? ' checked' : '') + '></label>' +
      '<label class="tg" style="margin-top:0"><span>🔔 พูดตอนเลขาเตือนงาน</span><input type="checkbox" id="fnt"' + (VO.note ? ' checked' : '') + '></label>' +
      '<h3 style="margin-top:16px;font-size:1rem">🎙️ ใช้เสียงจากแอปแปลงเสียง</h3><div class="nt" style="margin:0 0 6px">อัดเสียงในแอปแปลงเสียง แล้วบันทึกเป็นไฟล์เสียง (m4a / mp3 / wav) จากนั้นกด "เลือกไฟล์" ด้านล่าง · คำตอบอื่น ๆ ยังใช้เสียงของเครื่องที่ปรับไว้ด้านบน</div>' +
      Object.keys(SLOTS).map(function (k) { return '<div class="cl"><span>' + SLOTS[k] + (CLIP[k] ? ' ✅' : '') + '</span>' + (CLIP[k] ? '<button data-fc="play" data-k="' + k + '">▶️</button><button data-fc="del" data-k="' + k + '">ลบ</button>' : '') + '<label>เลือกไฟล์<input type="file" accept="audio/*" data-k="' + k + '" hidden></label></div>'; }).join('') +
      '<div class="nt">เสียงจากเครื่องฟรี แต่ความเป็นธรรมชาติขึ้นกับเสียงที่มีในมือถือ · เสียงเด็กผู้หญิงที่สมจริงมากกว่านี้ต้องใช้บริการเสียง AI แบบเสียเงิน</div></div>';
    panel.innerHTML = h; panel.classList.add('on');
    var g = function (id) { return panel.querySelector('#' + id); };
    g('fp').oninput = function () { VO.p = +this.value; VO.pre = ''; g('fpv').textContent = VO.p.toFixed(2); mark(); vsave(); };
    g('fr').oninput = function () { VO.r = +this.value; VO.pre = ''; g('frv').textContent = VO.r.toFixed(2); mark(); vsave(); };
    g('fv').oninput = function () { VO.vol = +this.value; g('fvv').textContent = Math.round(VO.vol * 100) + '%'; vsave(); };
    if (g('fs')) g('fs').onchange = function () { VO.voice = this.value; vsave(); say('สวัสดีค่ะ ฟ้าเองนะคะ', true); };
    g('fon').onchange = function () { VO.on = this.checked; vsave(); syncBtn(); };
    g('fnt').onchange = function () { VO.note = this.checked; vsave(); };
    Array.prototype.forEach.call(panel.querySelectorAll('input[type=file]'), function (inp) {
      inp.onchange = function () { var f = inp.files && inp.files[0]; if (!f) return; if (f.size > 3e6) { alertBox('ไฟล์ใหญ่เกินไป (ไม่เกิน 3MB · คลิปสั้น ๆ 2–5 วินาทีกำลังดี)'); return; } putClip(inp.dataset.k, f); setTimeout(openVoice, 200); };
    });
    function mark() { Array.prototype.forEach.call(panel.querySelectorAll('[data-fp]'), function (b) { b.classList.toggle('on', b.dataset.fp === VO.pre); }); }
  }
  function alertBox(t) { if (typeof window.toast === 'function') window.toast(t); }

  function build() {
    var wd = document.getElementById('wd'), head = document.querySelector('#wchat .wch'); if (!wd || !head || head.querySelector('.fvb')) return !!(head && head.querySelector('.fvb'));
    var x = head.querySelector('[data-a="wchatx"]');
    vbtn = document.createElement('button'); vbtn.className = 'fvb'; vbtn.onclick = function (e) { e.stopPropagation(); VO.on = !VO.on; vsave(); syncBtn(); if (VO.on) say('เปิดเสียงแล้วค่ะ', true); else if (SY) SY.cancel(); };
    var sb = document.createElement('button'); sb.className = 'fvb'; sb.textContent = '🎀'; sb.setAttribute('aria-label', 'ตั้งค่าเสียงน้องฟ้า'); sb.onclick = function (e) { e.stopPropagation(); openVoice(); };
    head.insertBefore(vbtn, x); head.insertBefore(sb, x); syncBtn();
    var sm = head.querySelector('small'); if (sm) sm.textContent = 'แตะ 🎀 เพื่อปรับเสียง · คุยเล่นได้ทุกเรื่อง';
    panel = document.createElement('div'); panel.className = 'fvp'; wd.appendChild(panel);
    panel.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    panel.addEventListener('click', function (e) {
      if (e.target === panel) { panel.classList.remove('on'); return; }
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.fx === 'x') panel.classList.remove('on');
      if (b.dataset.fx === 'test') say(pick(['สวัสดีค่ะ' + youShort() + ' ฟ้าเองนะคะ วันนี้ให้ฟ้าช่วยอะไรดีคะ', 'ค่า~ ยอดขายวันนี้ดีมากเลยนะคะ เก่งที่สุดเลย', youShort() + 'คะ ถึงเวลาโทรตามค่าเช่าแล้วนะคะ']), true);
      if (b.dataset.fp) { var p = PRE[b.dataset.fp]; VO.pre = b.dataset.fp; VO.p = p.p; VO.r = p.r; vsave(); openVoice(); say('สวัสดีค่ะ ฟ้าเองนะคะ', true); }
      if (b.dataset.fc === 'play') { var a = new Audio(CLIP[b.dataset.k]); a.volume = VO.vol; a.play(); }
      if (b.dataset.fc === 'del') { putClip(b.dataset.k, null); setTimeout(openVoice, 100); }
    });
    return true;
  }

  /* ตอบรับเสียงสั้น ๆ เมื่อเปิดแชทจากปุ่ม */
  var tm = setInterval(function () { if (A.wsend) hook(); if (build()) { watch(); clearInterval(tm); } }, 300);
  window.SSFah = { say: say, chat: chat, mem: MEM, voice: VO, open: openVoice };
})();
