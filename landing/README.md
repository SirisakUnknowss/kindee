# KinDee landing page

เว็บแนะนำ KinDee สำหรับคนที่ยังไม่ได้ใช้แอป เป็น static site (HTML/CSS/JS ล้วน ไม่มี build step) กับ Pages Function หนึ่งตัวสำหรับฟอร์มติดต่อ

```text
landing/
├─ index.html              เนื้อหาทั้งหมด (ภาษาไทย)
├─ styles.css              ธีม "บัญชีแคลอรี" ตาม KinDee/brand-theme.md
├─ main.js                 ตรวจฟอร์มฝั่ง browser แล้วส่งไป /api/contact
├─ assets/icon.svg         ไอคอนเดียวกับแอป
└─ functions/api/contact.ts  บันทึกข้อความลง Supabase (service key)
```

## ดูในเครื่อง

จาก root ของ repo:

```bash
node kindee-app/node_modules/wrangler/bin/wrangler.js pages dev landing --port 5190
```

เปิด `http://localhost:5190` ถ้าไม่ได้ใส่ค่า Supabase ฟอร์มจะตอบ `503` แล้วแสดงอีเมลสำรองให้ผู้ใช้แทน ส่วนอื่นของหน้าดูได้ตามปกติ

ถ้าจะทดสอบฟอร์มจริง ให้สร้าง `landing/.dev.vars` (ถูก ignore จาก Git):

```dotenv
SUPABASE_URL=https://<staging-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<staging service role key>
```

## Deploy บน Cloudflare Pages

แยกเป็น Pages project ของตัวเอง ไม่ปนกับตัวแอป

1. Workers & Pages → Create → Pages → เชื่อม GitHub repo นี้
2. Production branch `main` · Root directory `landing` · Build command เว้นว่าง · Build output directory `.`
3. Variables and Secrets (ตั้งแยก Preview กับ Production):
   - `SUPABASE_URL` — data project ของ environment นั้น
   - `SUPABASE_SERVICE_ROLE_KEY` — ใส่เป็น **Secret**
4. Apply migration `supabase/migrations/20260923070000_contact_requests.sql` กับ Supabase ของ environment นั้น (`npx supabase db push`)
5. ผูกโดเมนหลัก เช่น `kindee.app` กับ landing และให้ตัวแอปอยู่ที่ subdomain เช่น `app.kindee.app`

## ต้องแก้ก่อนเปิดจริง

- ลิงก์ "ลองใช้เลย" ชี้ไปที่ `https://kindee.pages.dev/` (`#cta-app` ใน `index.html`) ถ้าย้ายแอปไปโดเมนอื่นต้องแก้ตรงนี้
- อีเมล `support@kindee.app` ใน `#support-email` ต้องเป็น mailbox ที่มีคนอ่านจริง ค่าเดียวกับ `VITE_SUPPORT_EMAIL` ของแอป
- ข้อความยินยอมในฟอร์มระบุว่าเก็บข้อมูล **ไม่เกิน 12 เดือน** ซึ่ง migration มี pg_cron ลบให้แล้ว ควรให้ทนาย/DPO ตรวจพร้อม Privacy Notice ของแอป
- ตารางแพ็กเกจไม่ได้ใส่ราคา เพราะยังไม่ได้ตั้งราคา Stripe จริง

## อ่านข้อความที่ส่งเข้ามา

```sql
select created_at, topic, name, email, message
from public.contact_requests
where status = 'new'
order by created_at desc;

update public.contact_requests set status = 'replied' where id = '<id>';
```
