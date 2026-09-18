# PDPA launch checklist

สถานะโค้ด ณ 15 กันยายน 2026

- [x] Privacy Notice ภาษาไทยและ Terms of Use เปิดอ่านได้ก่อนและหลังเข้าสู่ระบบ
- [x] ระบุวัตถุประสงค์ของข้อมูลน้ำหนัก เป้าหมาย และรายการอาหาร
- [x] ระบุ retention ของข้อมูลบัญชี ข้อมูลในเครื่อง AI record, log และ backup
- [x] ผู้ใช้ส่งออก JSON และลบบัญชี/ข้อมูลในเครื่องได้จากหน้า “ฉัน”
- [x] consent แยกก่อนส่งรูปไป Google Gemini พร้อม server-side validation และ audit record
- [x] medical disclaimer และข้อจำกัดผล AI
- [x] age gate 18+ และช่องทางผู้ปกครองขอลบ
- [x] incident response runbook
- [ ] ให้ทนายไทยหรือ DPO ตรวจข้อความ ฐานกฎหมาย การโอนต่างประเทศ และ retention จริง
- [ ] ใส่ `VITE_DATA_CONTROLLER_NAME`, `VITE_DATA_CONTROLLER_ADDRESS`, `VITE_PRIVACY_EMAIL`, `VITE_SUPPORT_EMAIL` ที่เป็นข้อมูลจริงและทดสอบ mailbox/SLA
- [ ] deploy migration `20260915123942_pdpa_controls.sql` และทดสอบ RLS ด้วยผู้ใช้สองบัญชี
- [x] ตั้ง scheduled job รายวัน (pg_cron: `20260918034654_photo_jobs_cleanup_cron.sql`) ให้ลบ `photo_jobs where expires_at < now()`; endpoint มี opportunistic cleanup เป็นชั้นเสริม
- [ ] ตั้ง Gemini เป็น billing-enabled paid service, ปิด data sharing และกำหนด log retention ต่ำสุดที่การดำเนินงานยอมรับได้
- [ ] ทำ DPA/ตรวจ data location และ subprocessor list ของ Supabase, Cloudflare และ Google
- [ ] ตั้ง owner, เบอร์โทร/ช่องทางฉุกเฉิน และ tabletop test สำหรับ incident runbook
- [ ] ตรวจรอบ backup จริงของทุกผู้ให้บริการให้สอดคล้องข้อความ “ไม่เกิน 90 วัน”
- [ ] ทดสอบ export, account deletion, cascade, shared-food anonymization และ token-expiry behavior ใน production-like environment

คำสั่งตรวจพื้นฐานหลัง deploy:

```sql
select relname, relrowsecurity
from pg_class
where relname in ('profiles', 'weight_logs', 'entries', 'photo_jobs', 'privacy_consents');

select user_id, purpose, version, provider, granted_at
from public.privacy_consents
order by granted_at desc
limit 20;

delete from public.photo_jobs where expires_at < now();
```

