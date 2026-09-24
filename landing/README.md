# KinDee landing page

เว็บแนะนำ KinDee สำหรับคนที่ยังไม่ได้ใช้แอป เป็น static site (HTML/CSS/JS ล้วน ไม่มี build step) กับ Pages Function หนึ่งตัวสำหรับฟอร์มติดต่อ

```text
landing/
├─ public/                   ไฟล์ที่ถูก publish (เฉพาะโฟลเดอร์นี้)
│  ├─ index.html             เนื้อหาทั้งหมด (ภาษาไทย)
│  ├─ styles.css             ธีม "บัญชีแคลอรี" ตาม KinDee/brand-theme.md
│  ├─ main.js                ตรวจฟอร์มฝั่ง browser แล้วส่งไป /api/contact
│  ├─ i18n.js                คำแปลภาษาอังกฤษ + ปุ่มสลับภาษา TH/EN และธีม ระบบ/สว่าง/มืด
│  ├─ story.js               scroll storytelling: ฉากเปลี่ยนทีละหน้า + พื้นหลังเปลี่ยนสี
│  └─ assets/                ไอคอน + ภาพหน้าจอแอป (WebP 780×960)
├─ functions/api/contact.ts  บันทึกข้อความลง Supabase (service key)
└─ README.md                 ไฟล์นี้ — ไม่ถูก publish
```

## Scroll storytelling

- จอกว้าง ≥ 960px, สูง ≥ 680px และไม่ได้ตั้ง reduced motion → **story mode**: ส่วนเล่าเรื่อง 6 ฉากเป็นเวทีค้าง (sticky) มือถือจำลองอยู่กับที่ เปลี่ยนภาพหน้าจอ ข้อความ crossfade เลื่อนเมาส์/กดลูกศร/PageDown หนึ่งครั้ง = หนึ่งฉาก ต่อด้วยหน้าเต็มจอ แพ็กเกจ → ความเป็นส่วนตัว → FAQ → ติดต่อ
- ไม่ใช้ CSS scroll-snap เพราะ snap แบบ mandatory ดึงการเลื่อนเล็ก ๆ (trackpad/ล้อเมาส์) กลับที่เดิม การพลิกหน้าจึงทำใน `story.js` (ล็อก ~0.9 วิ กัน momentum ของ trackpad) หน้าที่สูงกว่าจอเลื่อนปกติจนถึงขอบก่อนพลิก
- พื้นหลังทั้งหน้าคือ `.scene-bg` ที่เปลี่ยนสีตาม `data-bg` ของฉาก/หน้า (`base`, `mint`, `sky`, `peach`, `lime`, `deep`) กำหนดสีใน `styles.css` ทั้งธีมสว่างและมืด
- มือถือ/จอเตี้ย/reduced motion → เรียงต่อกันปกติ แต่ยังเปลี่ยนพื้นหลังและค่อย ๆ เผยเนื้อหา
- เพิ่มฉาก: เพิ่ม `.chapter` + `.snap` + จุดใน `.dots` และแก้ `6 * 100vh` ใน `styles.css`

## ภาษาและธีม

- ข้อความภาษาไทยเขียนใน `index.html` โดยตรง (ใช้ได้แม้ปิด JavaScript) ส่วนภาษาอังกฤษอยู่ใน `i18n.js` ผูกกันด้วย `data-i18n`, `data-i18n-html` และ `data-i18n-attr="attr:key;attr:key"`
- เพิ่มข้อความใหม่: ใส่ key ใน HTML แล้วเพิ่มคำแปลใน `EN` ของ `i18n.js`
- ภาษาเริ่มต้นตามภาษาเบราว์เซอร์ (`th` → ไทย, อื่น ๆ → English) ธีมเริ่มต้นตาม OS; ค่าที่ผู้ใช้เลือกเก็บใน `localStorage` (`kd-lang`, `kd-theme`)
- สคริปต์เล็ก ๆ ใน `<head>` ตั้งค่าก่อนวาดหน้าจอ จึงไม่กระพริบ

## ดูในเครื่อง

ต้องรันจากในโฟลเดอร์ `landing/` เพื่อให้ wrangler เจอ `functions/` และใช้ `.dev.vars` ของ landing:

```bash
cd landing
node ../kindee-app/node_modules/wrangler/bin/wrangler.js pages dev public --port 5190
```

เปิด `http://localhost:5190` ถ้าไม่ได้ใส่ค่า Supabase ฟอร์มจะตอบ `503` แล้วแสดงอีเมลสำรองให้ผู้ใช้แทน ส่วนอื่นของหน้าดูได้ตามปกติ

ถ้าจะทดสอบฟอร์มจริง ให้สร้าง `landing/.dev.vars` (ถูก ignore จาก Git):

```dotenv
SUPABASE_URL=https://<staging-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<staging service role key>
```

## Deploy บน Cloudflare Pages

Pages project ชื่อ `kindee-landing` (https://kindee-landing.pages.dev) แยกจากตัวแอป สร้างแบบ **Direct Upload** เมื่อ 2026-09-23 จึง deploy ด้วย wrangler ไม่ได้ build อัตโนมัติจาก Git

```bash
cd landing
node ../kindee-app/node_modules/wrangler/bin/wrangler.js pages deploy public --project-name kindee-landing --branch main
```

`--branch main` = production · branch อื่น = preview URL

ตั้งค่าใน Cloudflare → Workers & Pages → kindee-landing → Settings → Variables and Secrets (แยก Production กับ Preview) แล้ว deploy ใหม่หนึ่งครั้ง:

- `SUPABASE_URL` — data project ของ environment นั้น
- `SUPABASE_SERVICE_ROLE_KEY` — ใส่เป็น **Secret**

ก่อนตั้งค่าครบ `/api/contact` ตอบ `503` และหน้าเว็บจะแสดงอีเมลสำรองแทน

จากนั้น apply migration `supabase/migrations/20260923070000_contact_requests.sql` กับ Supabase ของ environment นั้น (`npx supabase db push`) และถ้ามีโดเมนหลัก เช่น `kindee.app` ให้ผูกกับ landing แล้วย้ายแอปไปอยู่ subdomain เช่น `app.kindee.app`

ถ้าอยากให้ build อัตโนมัติจาก Git ต้องสร้าง project ใหม่แบบเชื่อม GitHub (Root directory `landing`, Build command เว้นว่าง, Output `public`) เพราะ Direct Upload เปลี่ยนเป็น Git ภายหลังไม่ได้

## ต้องแก้ก่อนเปิดจริง

- ลิงก์ "ลองใช้เลย" ชี้ไปที่ `https://kindee.pages.dev/` (`#cta-app` ใน `public/index.html`) ถ้าย้ายแอปไปโดเมนอื่นต้องแก้ตรงนี้
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
