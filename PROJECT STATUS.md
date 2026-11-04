# SMART SHOP — สถานะโปรเจกต์ (สำหรับส่งต่อ session/บัญชี)

## สถาปัตยกรรม
- เว็บสแตติก ไม่มี build: `index.html` (แกนสินค้า/คลัง/Dashboard) + add-on `*.js` โหลดต่อกันตามลำดับท้ายไฟล์
- Backend: Supabase (auth.js — URL/anon key อยู่ในไฟล์) · ตาราง: products, variants, stock_levels, sales, expenses, rent_*
- add-on: sell/status/stock/rent/edit/delete/overview/final/cart/extras/alerts/pages/office → แล้วตามด้วย world-3d/world-int/world-ui
- หน้าแรก = แมพ 3D เต็มจอ (S.cur='ai'); three.min.js r128 ฝังในโฟลเดอร์

## ทำเสร็จแล้ว
- ลบ city.js, ทำแมพใหม่: ภายนอกขาว-ฟ้า, ภายในออฟฟิศมืด 8 ห้อง, ตัวละครบล็อกสาวผมสี, UI แผงข้อมูลเต็มจอ
- แชทน้องฟ้า (เลขา) เท่านั้น: ข้อมูลจริง + วิธีใช้เว็บ + คุยเล่น + จดงานเตือน (rule-based ไม่ใช้ AI API)
- เลย์เอาต์ tablet/มือถือ (≤1000px) ซ่อนแผงข้าง

## ยังค้าง / ยังไม่ได้ทำ
- ลิงก์ถาวร + QR: ต้องมีโฮสต์ (GitHub Pages/Cloudflare Pages) — รอลิงก์จากผู้ใช้
- ยกระดับหน้าเดิม (สินค้า คลัง ขาย บัญชี รายงาน อสังหา ภาษี ตั้งค่า) ให้สไตล์เดียวกับแมพ: ยังไม่เริ่ม
- ทดสอบกับ Supabase จริงและอุปกรณ์จริงครบทุกหน้า (ตอนนี้เทสต์ด้วยข้อมูลจำลองเฉพาะหน้าแมพ)
- ประสิทธิภาพมือถือรุ่นเก่า (ภายในมี mesh จำนวนมาก ควร merge geometry)

## ข้อควรระวัง
- ห้ามเปลี่ยน business logic (ราคา/สต๊อก/บัญชี) โดยไม่ได้รับอนุญาต
- add-on ใช้การ override `render`/`A.*` ซ้อนกัน ลำดับ script ใน index.html สำคัญ

## ระบบกล้อง (เพิ่มล่าสุด)
- `world-cam.js` — โหมดกล้อง: orbit (เดิม) / walk (Free Roam เดินระดับสายตา, เข้า-ออกตึก, บุคคลที่ 3 กด V) / free / spec (◀▶ ตามตึก-ห้อง-คน) / debug (HUD+wireframe F). ปรับ ความเร็ว/FOV/ความไว ได้ (เก็บ localStorage `ss_cam`). ภายในมีผนัง+ช่องประตู+ชนเฟอร์นิเจอร์ (`W.intBlocked`), แผ่นเขียว "ทางออก" ที่กลางทางเดิน
- `world-camui.js` — เมนู 🎥 มุมกล้อง, เมนู 👁 แสดง/ซ่อนกล่อง (เก็บ `ss_ui`), ปุ่ม –/+ ย่อมุมกล่อง, แถบพับขอบล่าง, โหมดโล่ง (H), จอยสติ๊กมือถือ, ▲▼, แถบ Spectator
- ลำดับ script ใน index.html: world-3d → world-int → world-cam → world-ui → world-camui
- คีย์ลัด: WASD/ลูกศร, Shift, Q/E, V, F, C(เมนูกล้อง), H(โหมดโล่ง), Esc(กลับมุมสูง)
