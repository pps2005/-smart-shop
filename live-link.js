// live-link.js — เมนู "AI Live" + "แต่งตัวน้องฟ้า" และสะพานให้หน้าไลฟ์ใช้สมองน้องฟ้าเดิม (ข้อมูลร้านจริง)
// โหลดเป็นไฟล์สุดท้ายใน index.html · วิธียกเลิก: ลบ <script src="live-link.js">
(function () {
  if (typeof M === 'undefined' || typeof go !== 'function') return;
  var PAGES = { live: 'ai-live.html', avatar: 'avatar-studio.html' };
  if (!M.some(function (m) { return m.id === 'live'; })) {
    M.push({ id: 'live', i: 'chat', t: 'AI Live 🎙️' });
    M.push({ id: 'avatar', i: 'sliders', t: 'แต่งตัวน้องฟ้า 👗' });
  }

  // เปิดหน้าไลฟ์ซ้อนบนเว็บเดิม (เว็บหลักยังทำงานอยู่ข้างหลัง สมอง/ข้อมูลร้านใช้ร่วมกันได้)
  var css = document.createElement('style');
  css.textContent = '#ssLive{position:fixed;inset:0;z-index:99999;border:0;width:100%;height:100%;background:#170b2e}' +
    'body.ss-live-on>*:not(#ssLive){display:none!important}';
  document.head.appendChild(css);
  function open(page) {
    var f = document.getElementById('ssLive');
    if (!f) { f = document.createElement('iframe'); f.id = 'ssLive'; f.allow = 'microphone; autoplay'; document.body.appendChild(f); }
    f.src = PAGES[page] + '?embed=1';
    var wm = document.getElementById('wmenu'); if (wm) wm.classList.remove('on');
    if (typeof closeSheet === 'function') try { closeSheet(); } catch (e) {}
    document.body.classList.add('ss-live-on');
  }
  function close() {
    var f = document.getElementById('ssLive');
    document.body.classList.remove('ss-live-on');
    if (f) f.remove();
    try { speechSynthesis.cancel(); } catch (e) {}
    window.dispatchEvent(new Event('resize'));
  }

  // ถามสมองเดิม (world-ui.js + fah.js) แล้วส่งคำตอบกลับ โดยไม่ให้เว็บหลักพูดซ้อน
  function ask(q) {
    return new Promise(function (res, rej) {
      var box = document.querySelector('#wcb');
      if (!box || typeof A === 'undefined' || !A.wsend) return rej(new Error('no-brain'));
      var SY = window.speechSynthesis, muted = false;
      try { SY.speak = function () {}; muted = true; } catch (e) {}
      var unmute = function () { if (muted) { try { delete SY.speak; } catch (e) {} } };
      var n0 = box.children.length, t = 0;
      try { A.wsend(q); } catch (e) { unmute(); return rej(e); }
      var iv = setInterval(function () {
        t += 120;
        var k = box.children, last = k[k.length - 1];
        if (k.length >= n0 + 2 && last && !last.classList.contains('u') && !last.querySelector('.wdot')) {
          clearInterval(iv); setTimeout(unmute, 300); res(last.innerHTML);
        } else if (t > 10000) { clearInterval(iv); unmute(); rej(new Error('timeout')); }
      }, 120);
    });
  }
  window.SSLive = { open: open, close: close, ask: ask };

  var origGo = go;
  go = function (id) {
    if (PAGES[id]) { open(id); return; }
    return origGo.apply(this, arguments);
  };
})();
