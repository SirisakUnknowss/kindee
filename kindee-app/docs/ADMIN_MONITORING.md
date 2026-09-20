# KinDee Admin Monitoring

หน้า dashboard อยู่ที่ `/admin` และใช้สำหรับดูภาพรวมผู้ใช้ แพ็กเกจ การบันทึกอาหาร งานวิเคราะห์รูป error logs และ feedback จาก UAT

## การให้สิทธิ์ผู้ดูแล

ระบบตรวจสิทธิ์จาก Supabase Auth `app_metadata` เท่านั้น ไม่ใช้ `user_metadata` เพราะผู้ใช้แก้ไขข้อมูลส่วนนั้นเองได้

ตั้งค่าให้บัญชีผู้ดูแลมี metadata ต่อไปนี้ผ่าน Supabase Dashboard หรือ Admin API:

```json
{
  "role": "admin"
}
```

หลังแก้ metadata ให้ผู้ดูแลออกจากระบบและเข้าสู่ระบบใหม่เพื่อรับ session ล่าสุด

## ข้อมูลที่แสดง

- จำนวนผู้ใช้ทั้งหมด ผู้ใช้ active และผู้ใช้ใหม่ใน 7 วัน
- จำนวนรายการอาหารและงานวิเคราะห์รูปทั้งหมด
- งานวิเคราะห์รูปล้มเหลวและอัตราสำเร็จ
- สัดส่วน Free, Plus, Pro และ Unlimited
- กิจกรรมการบันทึกอาหารย้อนหลัง 14 วัน
- ตารางผู้ใช้ พร้อมแพ็กเกจ สถานะ จำนวน entry และโควตารูป
- error logs และ feedback ล่าสุดจาก `app_reports`

## Security

- Browser เรียกเฉพาะ `/api/admin/monitoring` ด้วย access token ของผู้ดูแล
- Pages Function ตรวจ user จาก Supabase Auth ทุกครั้ง แล้วตรวจ `app_metadata.role`
- `SUPABASE_SERVICE_ROLE_KEY` อยู่เฉพาะ Cloudflare Pages Functions
- Dashboard เป็น read-only และตั้ง `Cache-Control: private, no-store`
- API ส่งผู้ใช้ล่าสุดสูงสุด 200 รายและ logs ล่าสุด 100 ราย เพื่อลดการเปิดเผยข้อมูลเกินจำเป็น

## ข้อจำกัด

- Auth user list ดึงสูงสุด 1,000 บัญชีต่อการ refresh หากระบบมีผู้ใช้มากกว่านี้ควรเพิ่ม server-side pagination
- กราฟ 14 วันประมวลผลจากข้อมูลล่าสุดที่ Data API ส่งกลับ หากปริมาณข้อมูลสูงควรย้ายไปใช้ aggregate RPC หรือ analytics warehouse
- Operational logs ในหน้านี้คือ app error/feedback ที่ KinDee เก็บเอง ไม่ใช่ Cloudflare request logs หรือ Supabase Postgres logs
