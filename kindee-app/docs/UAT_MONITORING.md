# UAT — อ่าน error และ feedback

ระหว่าง UAT แอปส่งสองอย่างเข้าตาราง `public.app_reports` ผ่าน `/api/report`

- `kind = 'error'` มาจาก error ที่ไม่ถูกดักในเบราว์เซอร์ ส่งอัตโนมัติ ผู้ใช้ไม่ต้องทำอะไร
- `kind = 'feedback'` มาจากช่องส่งความเห็นในหน้า “ฉัน” พร้อมคะแนน 1–5 ถ้าผู้ทดสอบให้

ตารางนี้ไม่มี policy สำหรับ client ใด ๆ เขียนได้เฉพาะ Pages Function ที่ถือ service key และอ่านด้วย SQL

## ป้องกันข้อมูลล้น

- หนึ่งเครื่องส่งได้ไม่เกิน 60 รายการต่อชั่วโมง เกินกว่านั้น API ตอบ 429
- หนึ่ง session ของเบราว์เซอร์ส่ง error ได้ไม่เกิน 20 รายการ และ error ข้อความเดิมส่งซ้ำได้ทุก 1 นาที
- ข้อความยาวเกินถูกตัด (message 500 ตัวอักษร, detail 4,000)

## Query ที่ใช้บ่อย

feedback ล่าสุด

```sql
select created_at, rating, message, app_version
from public.app_reports
where kind = 'feedback'
order by created_at desc
limit 50;
```

error ที่เจอบ่อยที่สุด พร้อมจำนวนเครื่องที่เจอ

```sql
select message,
       count(*) as hits,
       count(distinct installation_id) as devices,
       max(created_at) as last_seen
from public.app_reports
where kind = 'error' and created_at > now() - interval '7 days'
group by message
order by hits desc
limit 20;
```

ดู stack ของ error หนึ่งตัว

```sql
select created_at, url, user_agent, detail
from public.app_reports
where kind = 'error' and message = 'ข้อความที่ต้องการดู'
order by created_at desc
limit 5;
```

คะแนนเฉลี่ยและจำนวนคนที่ให้ feedback

```sql
select round(avg(rating), 2) as avg_rating,
       count(*) filter (where rating is not null) as rated,
       count(*) as total
from public.app_reports
where kind = 'feedback';
```

## เคลียร์เมื่อจบรอบ

ทำเครื่องหมายว่าอ่านแล้วแทนการลบ เพื่อเก็บไว้เทียบรอบถัดไป

```sql
update public.app_reports set resolved_at = now()
where resolved_at is null and created_at < now() - interval '14 days';
```

## ข้อจำกัดที่ต้องรู้

- ไม่มีการแจ้งเตือน ต้องเปิด SQL ดูเอง ถ้าอยากได้แจ้งเตือนอัตโนมัติต้องต่อบริการเพิ่ม
- error ที่เกิดตอนออฟไลน์จะหายไป เพราะไม่มีการเก็บคิวไว้ส่งทีหลัง
- error ฝั่งเซิร์ฟเวอร์ (Pages Functions) ไม่เข้าตารางนี้ ดูผ่าน `npx wrangler pages deployment tail` แทน
