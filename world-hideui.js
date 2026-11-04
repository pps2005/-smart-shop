/* ============================================================
   world-hideui.js — ซ่อน UI ทั้งหมดในหน้าแมพ (โหมดภาพล้วน)
   - ซ่อนทุกอย่างที่ซ้อนอยู่บนฉาก 3D: แถบค้นหา/เมนูบน, HUD+มินิแมพ, ปุ่มกระโดด/เต้น/…,
     ปุ่มซูม/กล้อง, แถบ ภายนอก·ภายใน·น้องฟ้า, แชทน้องฟ้า, ป้ายลอย, นาฬิกา, จอยสติ๊ก, ชีท/ป๊อปอัป
   - เหลือปุ่ม 👁 เล็กๆ มุมขวาบนไว้แตะเพื่อเรียก UI กลับมา (หรือกด H บนคีย์บอร์ด)
   - ไม่เก็บค่าข้ามการรีเฟรช: เปิดหน้าใหม่ UI จะแสดงปกติเสมอ
   ใช้ได้จากโค้ดอื่น: SSW.hideAll() สลับ · SSW.hideAll(true) ซ่อน · SSW.hideAll(false) แสดง
   ============================================================ */
(function () {
  'use strict';
  var W = window.SSW = window.SSW || {};
  var CLS = 'ss-hideall', hidden = false, WD = null, btn = null, hintT = 0;

  function css() {
    var s = document.createElement('style');
    s.textContent = [
      /* ซ่อนทุกลูกของ #wd ยกเว้นผืนผ้าใบ 3D กับปุ่มเรียกคืน (ครอบคลุมของที่เพิ่มทีหลังด้วย) */
      'body.' + CLS + ' #wd>*:not(#wgl):not(#wsx){display:none!important}',
      /* ส่วนที่ถูกย้ายไปอยู่ใต้ body (ชีท/แผนที่เต็มจอ) — #wpfade ไม่ซ่อน เพราะใช้เป็นฉากเฟดตอนเทเลพอร์ต */
      'body.' + CLS + ' #wpsheet,body.' + CLS + ' #wpmap{display:none!important}',
      /* ป้ายลอยที่อาจอยู่นอก #wd */
      'body.' + CLS + ' .wtag{display:none!important}',
      '#wsx{position:absolute;right:calc(10px + env(safe-area-inset-right,0px));top:calc(10px + env(safe-area-inset-top,0px));z-index:9;display:none;align-items:center;gap:8px;height:40px;min-width:40px;padding:0 11px;border-radius:20px;border:1px solid rgba(255,255,255,.5);background:rgba(15,23,42,.38);color:#fff;font-size:1.15rem;line-height:1;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:.55;transition:opacity .2s;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent}',
      '#wsx:active{opacity:1}',
      '#wsx small{font-size:.78rem;font-weight:700;color:#fff;white-space:nowrap;max-width:0;overflow:hidden;opacity:0;transition:max-width .3s,opacity .3s}',
      '#wsx.hint{opacity:.95}#wsx.hint small{max-width:200px;opacity:1}',
      'body.' + CLS + ' #wsx{display:flex}'
    ].join('');
    document.head.appendChild(s);
  }

  function say() {
    if (!btn) return;
    btn.classList.add('hint'); clearTimeout(hintT);
    hintT = setTimeout(function () { btn.classList.remove('hint'); }, 2600);
  }

  function set(on) {
    on = !!on; if (on === hidden) return hidden;
    hidden = on;
    document.body.classList.toggle(CLS, hidden);
    document.body.classList.remove('ss-game');
    if (hidden) {
      try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
      say();
    } else { clearTimeout(hintT); if (btn) btn.classList.remove('hint'); }
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    return hidden;
  }

  W.hideAll = function (v) { return set(v === undefined ? !hidden : v); };
  W.uiHidden = function () { return hidden; };

  function init() {
    WD = document.getElementById('wd'); if (!WD) return false;
    if (document.getElementById('wsx')) return true;
    css();
    btn = document.createElement('button'); btn.id = 'wsx'; btn.type = 'button';
    btn.setAttribute('aria-label', 'แสดง UI');
    btn.innerHTML = '👁<small>แตะเพื่อแสดง UI</small>';
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) { btn.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true }); });
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(false); });
    WD.appendChild(btn);

    /* คีย์ลัด H (เมื่อไม่ได้พิมพ์อยู่) — แทนโหมดโล่งเดิม */
    window.addEventListener('keydown', function (e) {
      var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key && e.key.toLowerCase() === 'h' && WD.style.display !== 'none' && getComputedStyle(WD).display !== 'none') { e.stopImmediatePropagation(); W.hideAll(); }
    }, true);
    return true;
  }
  var tm = setInterval(function () { if (init()) clearInterval(tm); }, 150);
})();
