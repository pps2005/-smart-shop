# Xiress Studio
สตูดิโอทำอนิเมะ AI และหลังบ้านช่อง

- index.html — สตูดิโอหลัก (สตอรีบอร์ด เสียงพากย์ ดูแบบอนิเมะ โควตา ผู้ช่วย)
- anime-core.html — ตัวละคร · สถานที่ · ซีน
- scene-pick.html — เลือกฉากทำตอน + ล็อกหน้า
- worker.js — บอทหลังบ้าน (Cloudflare Worker anime-image-bot + D1 + Kaggle)
- sbx.json — สตอรีบอร์ดที่เขียนมือ


## โหมด TikTok (2026-11-16)
- ค่าเริ่มต้นคลิป: 9:16 1080×1920 30fps · 12 ภาพ ≈ 48 วิ · ซับเว้นโซน UI ของ TikTok · CRF18 + loudnorm -14 LUFS
- ออดิชันรายวัน (audDaily) ปิดเป็นค่าเริ่มต้น เปิดด้วย settings aud_auto=1
