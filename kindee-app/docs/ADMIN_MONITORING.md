# KinDee Admin Monitoring

หน้า `/admin` ใช้บัญชีผู้ดูแล **คนละระบบ** กับบัญชีผู้ใช้ KinDee ไม่สามารถนำ account หรือ token ของผู้ใช้ทั่วไปมาเปิด dashboard ได้

## ตั้งค่าระบบผู้ดูแล

1. สร้าง Supabase project ใหม่สำหรับ **Admin Auth เท่านั้น** ห้ามใช้ project เดียวกับฐานข้อมูล KinDee
2. เปิด Google provider ใน Admin project ด้วย OAuth client ของ Google และเพิ่ม callback URL ของ Admin project ใน Google Auth Platform จากนั้นเพิ่ม `/admin` ของทุก environment ใน Supabase Redirect URLs
3. สร้าง/เชิญบัญชีผู้ดูแลด้วย email ที่ยืนยันแล้วใน Admin project แล้วปิด public sign-up เพื่อให้เฉพาะบัญชีเดิมเข้าได้ Google identity ที่ใช้ email เดียวกันจะถูกเชื่อมกับบัญชีเดิม; ตรวจ UUID หลัง Google login ครั้งแรกก่อนเพิ่มลง allowlist
4. เปิด TOTP MFA ใน Admin project ผู้ดูแลจะลงทะเบียนแอปยืนยันตัวตนจากหน้า `/admin` ครั้งแรก และต้องกรอกรหัส MFA เมื่อ session อยู่ระดับ `aal1`
5. ตั้ง URL และ publishable key ของ Admin project เป็น `VITE_ADMIN_SUPABASE_URL`, `VITE_ADMIN_SUPABASE_PUBLISHABLE_KEY` ใน build environment และ `ADMIN_SUPABASE_URL`, `ADMIN_SUPABASE_PUBLISHABLE_KEY` ใน Pages Functions environment
6. ใส่ UUID ของบัญชี admin ที่อนุญาตใน `ADMIN_USER_IDS` (คั่นด้วย comma) เฉพาะฝั่ง Pages Functions; อย่าใช้ email หรือ UUID ของ user project
7. ค่า `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` เดิมยังชี้ไปยัง **data project** เพื่ออ่านข้อมูล monitoring เท่านั้น

ค่า environment เหล่านี้ต้องตั้งแยกสำหรับ development, preview และ production ก่อน deploy. ถ้ายังไม่ตั้งครบ, ใช้ project เดียวกัน, หรือ allowlist ว่าง API จะไม่ให้เข้าถึง (`503`)

## Security

- Admin Auth client แยกจาก user Auth client และใช้ storage key `kindee-admin-auth` คนละ session กัน
- `/api/admin/monitoring` ตรวจ bearer กับ Auth endpoint ของ Admin project **ทุกคำขอ** แล้วตรวจ UUID ใน `ADMIN_USER_IDS` และ JWT `aal2` ก่อนใช้ service role ของ data project
- `app_metadata` ใน user project หรือการเปลี่ยน URL ไป `/admin` ไม่ได้ให้สิทธิ์ admin
- ไม่มีหน้า sign-up สำหรับ admin; publishable key ไม่ใช่ secret ส่วน service-role key อยู่ฝั่ง Pages Functions เท่านั้น
- Dashboard เป็น read-only, ตอบ `Cache-Control: private, no-store` และไม่ส่ง admin token ไป data project
- จำกัดผู้ใช้ล่าสุดสูงสุด 200 รายและ logs 100 รายในผล API

ถ้าสงสัยว่าบัญชีรั่ว ให้ลบ UUID จาก `ADMIN_USER_IDS` และ revoke session ทันที

## ข้อมูลที่แสดง

- จำนวนผู้ใช้ทั้งหมด ผู้ใช้ active และผู้ใช้ใหม่ใน 7 วัน
- จำนวนรายการอาหารและงานวิเคราะห์รูปทั้งหมด
- งานวิเคราะห์รูปล้มเหลวและอัตราสำเร็จ
- สัดส่วน Free, Plus, Pro และ Unlimited
- กิจกรรมการบันทึกอาหารย้อนหลัง 14 วัน
- ตารางผู้ใช้ พร้อมแพ็กเกจ สถานะ จำนวน entry และโควตารูป
- error logs และ feedback ล่าสุดจาก `app_reports`

## ข้อจำกัด

- Auth user list ดึงสูงสุด 1,000 บัญชีต่อการ refresh หากระบบมีผู้ใช้มากกว่านี้ควรเพิ่ม server-side pagination
- กราฟ 14 วันประมวลผลจากข้อมูลล่าสุดที่ Data API ส่งกลับ หากปริมาณข้อมูลสูงควรย้ายไปใช้ aggregate RPC หรือ analytics warehouse
- Operational logs ในหน้านี้คือ app error/feedback ที่ KinDee เก็บเอง ไม่ใช่ Cloudflare request logs หรือ Supabase Postgres logs
