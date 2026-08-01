# KinDee — แผนการ implement ระบบให้ใช้งานได้จริง

เอกสารวางแผนงานวิศวกรรม ต่อจาก `kindee-architecture.md`, `kindee-design.md` 0.2, `kindee-food-data.md`
เวอร์ชัน: 1.0 — 1 สิงหาคม 2026
ขอบเขต: พาจาก UI prototype ที่มีอยู่ (`kindee-app/`) ไปสู่ระบบที่ผู้ใช้จริงใช้ได้ทุกวันโดยไม่ต้องมีเราคอยดูแล

---

## 0. สถานะปัจจุบันตามจริง

`kindee-app/` คือ **UI shell ที่เดินได้ครบทุก flow แต่ยังไม่มีระบบหลังบ้าน** ไม่ใช่แอปที่ใช้งานจริงได้ ตารางนี้คือเส้นแบ่ง

| ส่วน | ตอนนี้เป็นอะไร | ต้องกลายเป็นอะไร |
|---|---|---|
| Auth | `setTimeout` 950ms แล้วถือว่าล็อกอินสำเร็จ ไม่มีบัญชีจริง | Supabase Auth (Google OAuth + email/password + verify + reset) |
| ข้อมูลผู้ใช้ | `localStorage` ก้อนเดียว หายเมื่อล้างเบราว์เซอร์ ไม่ซิงก์ข้ามเครื่อง | IndexedDB (Dexie) เป็น source of truth ฝั่ง client + ซิงก์ขึ้น Postgres |
| การซิงก์ | ธง `pending` ที่ถูกล้างทิ้งหลัง 900ms ไม่มีการส่งอะไรจริง | outbox queue + `POST /api/sync` แบบ idempotent ด้วย `client_id` |
| คลังอาหาร | 16 รายการ hardcode ในไฟล์ `.ts` | ~200k–400k รายการใน Postgres + ค้นหาไทยแบบ fuzzy + cache ในเครื่อง |
| ค้นหา | `Array.filter` + `String.includes` | `pg_trgm` + normalize วรรณยุกต์/สระ + จัดอันดับ 5 ชั้น |
| สแกนบาร์โค้ด | ปุ่ม "จำลอง: สแกนเจอ / ไม่พบ" | `getUserMedia` + `BarcodeDetector` (fallback `zxing-wasm`) + lookup 5 ชั้น |
| ถ่ายรูป AI | ปุ่มชัตเตอร์ที่ขึ้น toast เฉย ๆ | server route → vision API + โควตา + cache ด้วย hash |
| OCR ฉลาก | ยังไม่มี | server route → OCR → parse ตัวเลขโภชนาการ → เติมฟอร์มให้ |
| ประวัติ/โปรไฟล์ | คำนวณสดจาก entries ในเครื่อง | `daily_summaries` ที่อัปเดตด้วย trigger + weight logs |
| ความปลอดภัย | ไม่มี — ไม่มี server ให้ป้องกัน | RLS ทุกตาราง, rate limit, ไม่มี API key ฝั่ง client |
| PDPA | มีข้อความในหน้า Terms แต่ไม่มีกลไก | ส่งออกข้อมูล, ลบบัญชีจริง, retention policy |
| คุณภาพ | ไม่มีเทสต์เลย | unit test `lib/calc`+`lib/thai`, integration test sync, E2E flow หลัก |

**สิ่งที่ใช้ต่อได้เลยโดยไม่ต้องเขียนใหม่:** design token ทั้งชุด, ทุกหน้าจอและสถานะ, copy ภาษาไทย, `lib/calc.ts` (ฟังก์ชันบริสุทธิ์ คำนวณถูกต้องแล้ว), โครงสร้าง component

**ประมาณการรวม: 14–19 สัปดาห์** สำหรับคนทำคนเดียวเต็มเวลา ถึงจุดที่เปิดให้คนนอกใช้ได้จริง

---

## 1. นิยาม "พร้อมใช้งานจริง"

ถ้าข้อใดข้อหนึ่งยังไม่ผ่าน ห้ามเปิดให้ผู้ใช้นอกกลุ่มทดสอบ

1. ผู้ใช้สมัคร → ตั้งค่า → บันทึกอาหาร → ปิดแอป → เปิดบนเครื่องอื่น แล้วข้อมูลอยู่ครบ
2. ปิดเน็ตแล้วบันทึกได้ 10 รายการ เปิดเน็ตกลับมาแล้วขึ้นครบ 10 ไม่ซ้ำ ไม่หาย
3. สแกนของจริงในร้านสะดวกซื้อ 50 ชิ้น เจอ ≥ 40% และที่ไม่เจอเข้า flow เพิ่มเองได้จบ
4. ค้นหา "กระเพรา" เจอ "ผัดกะเพรา" และ "ข้าวมันไก่ต้ม" เจอทั้งที่พิมพ์ติดกัน
5. ลบบัญชีแล้วข้อมูลหายจริงจาก Postgres และ storage ภายใน 30 วัน
6. ไม่มี API key ใด ๆ อยู่ใน bundle ฝั่ง client (ตรวจด้วย `grep` ใน `dist/`)
7. p95 ของการเปิดแอปถึงเห็นหน้าวันนี้ ≤ 2.5 วิ บน 4G และ ≤ 1 วิ เมื่อ warm
8. Lighthouse PWA installable ผ่าน + a11y ≥ 95
9. เคลียร์เรื่องสิทธิ์ Thai FCD และตรวจ ODbL เรียบร้อย (ดูข้อ 10)

---

## 2. ลำดับงาน — ทำไมต้องเรียงแบบนี้

```
P1 รากฐาน (auth + DB + RLS)        ← ทุกอย่างต่อยอดจากตรงนี้ ห้ามข้าม
   ↓
P2 offline-first + sync            ← ต้องมาก่อนคลังอาหาร เพราะกระทบ data flow ทั้งหมด
   ↓
P3 คลังอาหาร + ค้นหาไทย            ← งานหนักที่สุด ทำคู่ขนานกับ P2 ได้บางส่วน
   ↓
P4 สแกนบาร์โค้ด + เพิ่มสินค้าเอง    ← จุดขายหลักของ 0.2
   ↓
P5 ประวัติ + โปรไฟล์ + PDPA        ← ปิดช่องกฎหมายก่อนเปิดสาธารณะ
   ↓
P6 AI (รูปอาหาร + OCR ฉลาก)        ← เลื่อนออกได้ ไม่ block การเปิดตัว
   ↓
P7 ขัดเงา + observability + launch
```

**เหตุผลที่ sync มาก่อนคลังอาหาร:** ถ้าสร้างระบบค้นหา/สแกนบนสมมติฐาน "ออนไลน์เสมอ" แล้วค่อยมายัด offline ทีหลัง ต้องรื้อ data layer ใหม่ทั้งหมด การตัดสินใจว่าอะไรเป็น source of truth (IndexedDB) ต้องเกิดก่อนงานที่เหลือ

---

## P1 — รากฐาน: Auth + Database + RLS
**2 สัปดาห์ · ไม่มีอะไรทำต่อได้ถ้าอันนี้ไม่เสร็จ**

### 1.1 ตั้ง Supabase project
- สร้าง project (region `ap-southeast-1` สิงคโปร์ — ใกล้ไทยสุด latency ~30ms)
- แยก 3 environment: `local` (supabase CLI), `staging`, `production`
- ใช้ migration files ทั้งหมด (`supabase/migrations/*.sql`) ห้ามแก้ schema ผ่าน dashboard เด็ดขาด — ไม่งั้น staging กับ prod จะ drift แล้วตามหาสาเหตุบั๊กไม่เจอ

### 1.2 Schema ตั้งต้น

```sql
-- ── โปรไฟล์ ────────────────────────────────────────────────
create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text,
  sex           text not null check (sex in ('male','female')),
  birth_date    date not null,
  height_cm     numeric(5,1) not null check (height_cm between 100 and 250),
  activity      text not null check (activity in ('sedentary','light','moderate','active')),
  goal          text not null check (goal in ('lose','keep','gain')),
  target_kcal   int  not null check (target_kcal between 800 and 6000),
  target_source text not null default 'auto' check (target_source in ('auto','manual')),
  show_macros   boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── น้ำหนัก (เปลี่ยนบ่อย เก็บแยก) ───────────────────────────
create table weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  weight_kg  numeric(5,1) not null check (weight_kg between 20 and 400),
  logged_on  date not null,
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

-- ── รายการที่กิน ───────────────────────────────────────────
create table entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  client_id    text not null,              -- uuid ที่สร้างจากเครื่อง
  food_id      uuid references foods on delete set null,
  portion_id   uuid references food_portions on delete set null,
  qty          numeric(6,2) not null default 1,
  grams        numeric(8,2),
  meal         text not null check (meal in ('breakfast','lunch','dinner','snack')),
  eaten_at     timestamptz not null,
  eaten_on     date not null,
  -- snapshot: แก้ข้อมูลอาหารทีหลังแล้วประวัติต้องไม่ขยับ
  food_name    text not null,
  kcal         numeric(8,2) not null,
  protein      numeric(8,2),
  carb         numeric(8,2),
  fat          numeric(8,2),
  entry_source text not null check (entry_source in ('search','recent','barcode','photo','manual')),
  deleted_at   timestamptz,                -- soft delete เพื่อให้ sync ลบข้ามเครื่องได้
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (user_id, client_id)              -- ← หัวใจของ idempotent sync
);
create index on entries (user_id, eaten_on desc) where deleted_at is null;
create index on entries (user_id, updated_at desc);

-- ── สรุปรายวัน (อัปเดตด้วย trigger เพื่อให้กราฟเร็ว) ─────────
create table daily_summaries (
  user_id     uuid not null references auth.users on delete cascade,
  date        date not null,
  kcal        numeric(10,2) not null default 0,
  protein     numeric(10,2) not null default 0,
  carb        numeric(10,2) not null default 0,
  fat         numeric(10,2) not null default 0,
  entry_count int not null default 0,
  target_kcal int,
  primary key (user_id, date)
);
```

**`unique (user_id, client_id)` คือบรรทัดที่สำคัญที่สุดในไฟล์นี้** — มันทำให้ส่งซ้ำกี่ครั้งก็ไม่เกิดข้อมูลซ้ำ ทั้ง retry อัตโนมัติ ทั้งกดปุ่มรัว ทั้งสองเครื่องส่งพร้อมกัน

### 1.3 Trigger สรุปรายวัน

```sql
create or replace function bump_daily_summary() returns trigger
language plpgsql security definer as $$
declare
  target_user uuid := coalesce(new.user_id, old.user_id);
  target_date date := coalesce(new.eaten_on, old.eaten_on);
begin
  insert into daily_summaries (user_id, date, kcal, protein, carb, fat, entry_count)
  select target_user, target_date,
         coalesce(sum(kcal),0), coalesce(sum(protein),0),
         coalesce(sum(carb),0), coalesce(sum(fat),0), count(*)
  from entries
  where user_id = target_user and eaten_on = target_date and deleted_at is null
  on conflict (user_id, date) do update set
    kcal = excluded.kcal, protein = excluded.protein, carb = excluded.carb,
    fat = excluded.fat, entry_count = excluded.entry_count;
  return null;
end $$;

create trigger entries_summary
after insert or update or delete on entries
for each row execute function bump_daily_summary();
```

> ระวัง: ถ้า entry ถูกย้ายวัน (`eaten_on` เปลี่ยน) ต้องอัปเดตทั้งวันเก่าและวันใหม่ — เขียน trigger แยกกรณี UPDATE ที่ `old.eaten_on <> new.eaten_on` ให้ recompute สองวัน ไม่งั้นวันเก่าจะค้างตัวเลขผิด **เขียนเทสต์ครอบเคสนี้โดยเฉพาะ**

### 1.4 RLS — เปิดทุกตารางที่มี `user_id`

```sql
alter table profiles        enable row level security;
alter table weight_logs     enable row level security;
alter table entries         enable row level security;
alter table daily_summaries enable row level security;

create policy own_profile on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy own_entries on entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- ทำแบบเดียวกันกับ weight_logs, daily_summaries

-- คลังอาหารอ่านได้ทุกคน เขียนได้เฉพาะ service role
alter table foods enable row level security;
create policy read_foods on foods for select using (true);
create policy write_own_food on foods for insert
  with check (auth.uid() = contributed_by and source = 'user');
```

**ต้องมีเทสต์ที่พิสูจน์ว่า RLS ทำงาน** — เขียน integration test ที่ล็อกอินเป็น user A แล้วพยายามอ่าน/แก้ entry ของ user B ต้องได้ 0 แถวหรือ error ไม่ใช่แค่ "เชื่อว่าเขียน policy ถูกแล้ว"

### 1.5 Auth ฝั่งแอป
- แทน mock ใน `src/screens/Auth.tsx` ด้วย `@supabase/supabase-js`
  - `signInWithOAuth({ provider: 'google' })` — ตั้ง redirect URL ให้ครบทั้ง 3 env
  - `signUp` / `signInWithPassword` / `resetPasswordForEmail`
  - email template ภาษาไทย (Supabase → Auth → Email Templates)
- session persistence + auto refresh + `onAuthStateChange` → ล้าง local DB เมื่อ sign out
- **map error ของ Supabase เป็น `AuthErr` เดิมที่ UI รองรับอยู่แล้ว** (`email` / `pass` / `weak` / `exists` / `offline`) UI ไม่ต้องแก้
- route guard: `/` → ถ้ามี session และ `profiles` มีแถว → หน้าวันนี้ / ถ้ามี session แต่ไม่มีโปรไฟล์ → onboarding

**เกณฑ์ผ่าน P1:** สมัครบัญชีจริงด้วย Google และ email ได้ · ยืนยันอีเมลจริง · รีเซ็ตรหัสผ่านจริง · โปรไฟล์บันทึกลง Postgres · integration test RLS ผ่าน

---

## P2 — Offline-first + Sync
**2–3 สัปดาห์ · จุดที่พังง่ายที่สุดถ้าทำลวก**

### 2.1 Dexie schema

```ts
db.version(1).stores({
  entries:     'client_id, eaten_on, [eaten_on+meal], updated_at, dirty',
  foods_cache: 'id, barcode, *tokens, cached_at',
  outbox:      '++seq, client_id, op, tries',
  meta:        'key',           // last_pulled_at, user_id
  scan_queue:  '++seq, barcode' // บาร์โค้ดที่สแกนตอนออฟไลน์
})
```

**IndexedDB คือ source of truth ของ UI** — ทุกหน้าอ่านจาก Dexie ผ่าน `useLiveQuery` ไม่มีหน้าไหนอ่านจาก network โดยตรง network มีหน้าที่เดียวคือเติมข้อมูลลง Dexie

### 2.2 Outbox protocol

```
เขียน (add/edit/delete):
  1. เขียนลง Dexie ทันที + ตั้ง dirty = 1        ← UI อัปเดตทันที ไม่รอ network
  2. push งานเข้า outbox
  3. flush เมื่อ: มี network / กลับมา foreground / ทุก 30 วิถ้ามีคิวค้าง

flush:
  POST /api/sync { ops: [...], since: last_pulled_at }
  → server upsert ด้วย (user_id, client_id) แล้วคืน { applied, conflicts, changes, now }
  → ลบ op ที่ applied ออกจาก outbox, ล้าง dirty
  → merge changes (การเปลี่ยนแปลงจากเครื่องอื่น) ลง Dexie
  → เก็บ now เป็น last_pulled_at
```

**กติกาที่ห้ามละเมิด**
- ทุก op ต้องมี `client_id` ที่สร้างจากเครื่อง (`crypto.randomUUID()`) ตั้งแต่วินาทีแรก ไม่ใช่รอ id จาก server
- **retry ต้อง exponential backoff + jitter** (1s, 2s, 4s… สูงสุด 5 นาที) และหยุดที่ 10 ครั้งแล้วขึ้นสถานะให้ผู้ใช้เห็น ไม่ใช่ retry รัวจนแบตหมดหรือ DDoS ตัวเอง
- ลบ = soft delete (`deleted_at`) เพราะถ้า hard delete แล้วเครื่องอื่นที่ยังไม่ซิงก์จะ push กลับมาใหม่ ผู้ใช้จะเห็นของที่ลบไปแล้วโผล่กลับมา
- conflict ใช้ last-write-wins ด้วย `updated_at` — entries เป็น append-mostly conflict จริงน้อยมาก อย่า over-engineer

### 2.3 Server route

`POST /api/sync` (Supabase Edge Function หรือ Next route — เลือกอย่างใดอย่างหนึ่งแล้วอย่าผสม)
- ตรวจ JWT → ได้ `user_id` **ห้ามเชื่อ `user_id` ที่ client ส่งมาเด็ดขาด**
- validate ทุก op ด้วย zod: `kcal` 0–10000, `qty` > 0, `eaten_on` ไม่เกิน 1 ปีย้อนหลัง/1 วันข้างหน้า
- จำกัด 200 ops ต่อ request (client แบ่ง batch เอง)
- upsert แบบ transaction เดียว
- คืน changes ที่ `updated_at > since` เพื่อให้เครื่องอื่นตามทัน

### 2.4 UI ที่ต้องต่อของจริง (ทำไว้แล้วในดีไซน์)
- แถบ "ยังไม่ได้ซิงก์ · บันทึกไว้ในเครื่องแล้ว" ← ผูกกับ `outbox.count() > 0`
- ป้าย "รอซิงก์" ในแต่ละแถว ← ผูกกับ `entry.dirty`
- สถานะ "ซิงก์ไม่สำเร็จ" หลัง retry หมด — **ยังไม่ได้ออกแบบ ต้องเพิ่ม** ใช้โทนสงบเหมือนแถบออฟไลน์ + ปุ่ม "ลองอีกครั้ง"

### 2.5 เทสต์ที่ต้องมี (ไม่ใช่ optional)
| เคส | คาดหวัง |
|---|---|
| ออฟไลน์ เพิ่ม 10 รายการ แล้วออนไลน์ | ขึ้น server ครบ 10 ไม่ซ้ำ |
| ส่ง batch เดิมซ้ำ 3 ครั้ง | server มี 10 แถวเท่าเดิม |
| เครื่อง A เพิ่ม / เครื่อง B ลบ อันเดียวกัน | ทั้งสองเครื่องจบที่สถานะ "ลบแล้ว" |
| ปิดแอปกลางคัน flush | เปิดใหม่แล้วคิวยังอยู่ ส่งต่อได้ |
| server 500 | คิวไม่หาย backoff ทำงาน |
| แก้ `eaten_on` ข้ามวัน | summary ทั้งวันเก่าและใหม่ถูกต้อง |

**เกณฑ์ผ่าน P2:** ทุกเคสข้างบนผ่านแบบอัตโนมัติใน CI

---

## P3 — คลังอาหาร + ค้นหาภาษาไทย
**4–5 สัปดาห์ · งานหนักที่สุด และเป็นสิ่งเดียวที่ทำให้แอปนี้ต่างจาก MyFitnessPal**

### 3.1 Schema คลัง

```sql
create table foods (
  id            uuid primary key default gen_random_uuid(),
  name_th       text not null,
  name_en       text,
  aliases       text[] not null default '{}',
  brand         text,
  barcode       text unique,
  category      text,
  is_dish       boolean not null default false,
  is_packaged   boolean not null default false,
  kcal_100g     numeric(8,2) not null,
  protein_100g  numeric(8,2), carb_100g numeric(8,2), fat_100g numeric(8,2),
  package_size_g   numeric(8,2),
  serving_size_g   numeric(8,2),
  servings_per_pkg numeric(6,2),
  image_url text, label_image_url text,
  source        text not null check (source in ('off','usda','inmu','curated','user')),
  source_id     text,
  source_updated timestamptz,
  quality       text not null default 'unverified'
                check (quality in ('verified','community','unverified','incomplete')),
  confirm_count int not null default 0,
  region        text default 'TH',
  contributed_by uuid references auth.users on delete set null,
  is_public     boolean not null default false,
  search_text   text not null,      -- normalize แล้ว
  popularity    int not null default 0,
  created_at timestamptz not null default now()
);

create table food_portions (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references foods on delete cascade,
  label_th text not null,           -- 'จาน', 'ทัพพี', 'ไม้', 'ทั้งซอง'
  grams numeric(8,2) not null,
  is_default boolean not null default false,
  sort_order int not null default 0
);

create extension if not exists pg_trgm;
create index foods_search_trgm on foods using gin (search_text gin_trgm_ops);
create index foods_barcode on foods (barcode) where barcode is not null;
create index foods_region_pkg on foods (region, is_packaged);
```

### 3.2 `lib/thai/` — normalize (ฟังก์ชันบริสุทธิ์ เขียนเทสต์ให้ครบ)

```
normalizeThai(s):
  1. NFC normalize
  2. ตัดวรรณยุกต์และไม้ไต่คู้ (U+0E48–U+0E4B, U+0E4C, U+0E47)
  3. ตัดช่องว่างทั้งหมด (ภาษาไทยไม่เว้นวรรคระหว่างคำอยู่แล้ว)
  4. ยุบสระที่คนสับสน: ำ→าม, ใ→ไ, ฤ→ริ
  5. ยุบพยัญชนะเสียงซ้ำ: ทร→ซ, ณ→น, ญ→ย, ฏ→ต, ฬ→ล
  6. lowercase ส่วนที่เป็นอังกฤษ
```

เคสที่ต้องผ่าน (เอาไปเป็น test case ตรง ๆ):

| พิมพ์ | ต้องเจอ |
|---|---|
| กระเพรา / กะเพรา / กระเพา | ผัดกะเพรา |
| ข้าวมันไก่ต้ม (ติดกัน) | ข้าวมันไก่ต้ม |
| กะเพ (พิมพ์ไม่ครบ) | ผัดกะเพรา (prefix match) |
| somtam / ส้มตำ | ส้มตำไทย |
| นมโฟร์โมส / โฟร์โมสต์ | นมโฟร์โมสต์ |

### 3.3 ฟังก์ชันค้นหา

```sql
create or replace function search_foods(q text, cat text default null, lim int default 30)
returns setof foods language sql stable as $$
  with nq as (select normalize_thai(q) as t)
  select f.* from foods f, nq
  where (cat is null or f.category = cat)
    and (f.search_text % nq.t or f.search_text like nq.t || '%')
  order by
    (f.search_text = nq.t) desc,                    -- 1. ตรงเป๊ะ
    (f.search_text like nq.t || '%') desc,          -- 2. ขึ้นต้นตรง
    (f.quality = 'verified') desc,                  -- 3. ข้อมูลที่เชื่อถือได้
    f.popularity desc,                              -- 4. ยอดนิยม
    similarity(f.search_text, nq.t) desc            -- 5. fuzzy
  limit lim;
$$;
```

"เคยกิน" จัดอันดับฝั่ง client (ข้อมูลอยู่ใน Dexie อยู่แล้ว) — ไม่ต้องยิงไปถาม server ว่าผู้ใช้เคยกินอะไร

### 3.4 ท่อนำเข้าข้อมูล (`scripts/ingest/`)

```
off-dump.ts    ดาวน์โหลด Open Food Facts dump (~9GB jsonl.gz)
               → กรอง: countries มี th|sg|my|vn|กlobal และมี energy-kcal_100g
               → เหลือ ~150k–250k รายการ
               → normalize หน่วย, map field, สร้าง search_text
               → upsert เข้า foods (source='off', source_id=code)

usda.ts        Foundation + SR Legacy (public domain) สำหรับวัตถุดิบอ้างอิง
inmu.ts        Thai FCD — เข้าได้หลังเคลียร์สิทธิ์แล้วเท่านั้น (ดูข้อ 10)
dishes.ts      อาหารไทยปรุงสำเร็จ 300–500 จาน — งานมือ ไม่มีทางลัด
```

**จานไทยเป็นงานมือจริง ๆ ไม่มีทางลัด** ทำเป็น CSV แล้ว import: `name_th, aliases, category, kcal, protein, carb, fat, portions(json), source`
เริ่มจาก 200 จานที่ครอบคลุมสิ่งที่คนไทยกินจริงราว 80% — เมนูศูนย์อาหารและร้านข้างทาง ไม่ใช่อาหารหรู
กำหนดหน่วยตวงไทยพร้อมน้ำหนักต่อหน่วยให้ครบ (จาน/ทัพพี/ถ้วย/ชาม/ไม้/ลูก/แก้ว) — **นี่คือส่วนที่แอปต่างชาติทำไม่ได้**

ตั้ง cron รายสัปดาห์ดึง delta ของ OFF (GitHub Actions ก็พอ ไม่ต้องมี infra)

### 3.5 ลำดับความน่าเชื่อถือเมื่อชนกัน
`curated/verified` > `community` (confirm_count ≥ 2) > `off/usda` ที่ข้อมูลครบ > `user` คนเดียว > ข้อมูลไม่ครบ (แสดงได้แต่ต้องเตือน)

### 3.6 Cache ในเครื่อง
- bundle มากับแอป: อาหารไทยยอดนิยม ~500 รายการ (JSON ~200KB gzip) โหลดเข้า Dexie ตอนติดตั้ง
- cache เพิ่ม: ทุกอย่างที่ผู้ใช้คนนี้เคยกินหรือเคยสแกน
- ออฟไลน์ = ค้นเฉพาะ Dexie + แสดงให้ชัดว่ากำลังค้นจากคลังในเครื่อง (UI มีแล้ว)

**เกณฑ์ผ่าน P3:** เทสต์ normalize ผ่านทุกเคส · ค้น "กระเพรา" เจอ · p95 ของ query ≤ 150ms ที่ 200k แถว · จานไทย ≥ 300 รายการพร้อมหน่วยตวง

---

## P4 — สแกนบาร์โค้ด + เพิ่มสินค้าเอง
**2–3 สัปดาห์ · จุดขายหลักของเวอร์ชัน 0.2**

### 4.1 ตัวสแกน
```ts
// Chrome/Android รองรับ BarcodeDetector แล้ว, iOS Safari ยังไม่ → ต้องมี fallback
const detector = 'BarcodeDetector' in window
  ? new BarcodeDetector({ formats: ['ean_13','ean_8','upc_a','upc_e','code_128'] })
  : await loadZxingWasm()   // lazy load เฉพาะเมื่อจำเป็น (~300KB)
```
- `getUserMedia({ video: { facingMode: 'environment' } })` + ขอสิทธิ์ **ตอนกดเข้าแท็บสแกนเท่านั้น** ไม่ใช่ตอนเปิดแอป
- ตรวจทุก ~200ms (ไม่ใช่ทุกเฟรม — กินแบตฟรี)
- debounce บาร์โค้ดเดิม 2 วิ กันสแกนซ้ำชิ้นเดิมรัว ๆ
- ไฟฉาย: `track.applyConstraints({ advanced: [{ torch: true }] })` — เช็ค `getCapabilities()` ก่อน ถ้าไม่รองรับให้ซ่อนปุ่ม ไม่ใช่แสดงปุ่มที่กดแล้วไม่เกิดอะไร
- iOS: ต้องเป็น HTTPS และต้องเกิดจาก user gesture / cleanup `track.stop()` ทุกครั้งที่ออกจากแท็บ ไม่งั้นไฟกล้องค้าง

### 4.2 Lookup 5 ชั้น
```
1. Dexie foods_cache (barcode)      ← เร็วสุด ใช้ได้ออฟไลน์
2. Supabase foods (barcode)         ← เร็ว ควบคุมได้
3. Open Food Facts API              ← ผ่าน server route เท่านั้น
4. เจอ → เขียนลง foods + cache ในเครื่อง
5. ไม่เจอ → เปิด sheet "เพิ่มสินค้าเอง" (หน้า 15)
```
- ชั้น 3 ต้องผ่าน `/api/barcode/:code` ฝั่งเรา ไม่ยิงจาก client ตรง เพราะต้อง rate limit และ cache ไว้ (ไม่สุภาพกับบริการฟรีถ้ายิงตรง)
- ออฟไลน์: เก็บเข้า `scan_queue` แล้วค้นทีเดียวเมื่อกลับมาออนไลน์ พร้อมสรุป "เจอ 3 จาก 5 ชิ้น" — **ห้ามทิ้งบาร์โค้ดที่สแกนไปแล้วเด็ดขาด**

### 4.3 ฟอร์มเพิ่มสินค้าเอง (ยังไม่ได้ออกแบบ — ต้องทำดีไซน์ก่อน)
- ฟิลด์: ชื่อ / แบรนด์ / ขนาดบรรจุ / kcal ต่อ 100 ก. หรือต่อหน่วยบริโภค / macro (optional)
- ปุ่ม "ถ่ายรูปฉลาก" → OCR (P6) — **กลไกนี้ชี้ขาดว่าจะได้ข้อมูลหรือไม่** ลดงานจากกรอก 6 ช่องเหลือกด 2 ครั้ง
- ตัวเลือก "บันทึกไว้ใช้เองก่อน" (`is_public=false`) vs "แชร์ให้คนอื่นด้วย" (`is_public=true`) — ห้าม default เป็นแชร์
- ปุ่ม "แจ้งข้อมูลไม่ถูกต้อง" ในหน้ารายละเอียด + ตาราง `food_reports`

### 4.4 ขั้น 0.5 — วัดของจริงก่อนลงแรง
**ทำก่อนเขียนโค้ดส่วนนี้ทั้งหมด:** เดินเข้า 7-Eleven + Lotus's + Big C สแกนของ 50 ชิ้น จดว่า OFF มีกี่ชิ้น
- ≥ 60% → flow เพิ่มเองเป็นฟีเจอร์เสริมได้
- 30–60% → ต้องขัด flow เพิ่มเองให้ดีพอ ๆ กับสแกน
- < 30% → flow เพิ่มเองคือฟีเจอร์หลัก ต้องทุ่มเวลาให้มันมากกว่าที่วางไว้ และควรพิจารณาซื้อ dataset สินค้าไทยเพิ่ม

ตัวเลขนี้เปลี่ยนแผนได้ทั้งเฟส — ใช้เวลา 3–5 วัน คุ้มมาก

**เกณฑ์ผ่าน P4:** สแกนของจริง 50 ชิ้นได้ผลตามเป้า · สแกนต่อเนื่อง 5 ชิ้นไม่หลุด · ออฟไลน์เก็บคิวครบ · ปฏิเสธสิทธิ์กล้องแล้วยังมีทางไปต่อ

---

## P5 — ประวัติ + โปรไฟล์ + PDPA
**2 สัปดาห์ · ปิดช่องกฎหมายก่อนเปิดสาธารณะ**

- **หน้า 21 ประวัติ:** อ่านจาก `daily_summaries` (เร็ว) แทนการรวม entries สด · 7/30/90 วัน · กราฟน้ำหนัก
- **Streak แบบให้อภัย:** freeze 2 ครั้ง/เดือนอัตโนมัติ · เน้น "บันทึกไป 18 จาก 30 วัน" มากกว่าเลขติดต่อกัน
- **หน้า 24 ข้อมูลส่วนตัว:** ⚠️ เมื่อแก้ค่าที่กระทบการคำนวณ **ต้องขึ้น dialog ถามก่อนว่าจะคำนวณเป้าใหม่ไหม** (ยังไม่ได้ออกแบบ) — ห้ามเขียนทับ `target_kcal` เงียบ ๆ โดยเฉพาะเมื่อ `target_source='manual'`
- **หน้า 26 บันทึกน้ำหนัก:** ไม่แสดงป้าย "อ้วน/ผอม" ตามบรีฟ
- **PDPA (บังคับ):**
  - ส่งออกข้อมูล CSV/JSON — สร้างไฟล์ฝั่ง server แล้วส่งลิงก์หมดอายุ
  - **ลบบัญชีจริง** — Edge Function ที่ลบ `auth.users` (cascade ลงทุกตาราง) + ลบรูปใน storage + ตัดการเชื่อมโยง `contributed_by` ของสินค้าที่แชร์ไปแล้ว (ไม่ลบข้อมูลสินค้า แต่ทำให้ไม่ระบุตัวตน)
  - หน้าเงื่อนไข/ความเป็นส่วนตัวที่มีอยู่ **เป็นดราฟต์ ต้องให้ทนายตรวจและใส่ชื่อผู้ควบคุมข้อมูลจริงก่อนเปิด**
  - เครดิตแหล่งข้อมูลในหน้าเกี่ยวกับ — เป็นเงื่อนไขสัญญาอนุญาต ไม่ใช่มารยาท

---

## P6 — AI: รูปอาหาร + OCR ฉลาก
**2–3 สัปดาห์ · เลื่อนออกได้ ไม่ block launch**

```
client: ถ่ายรูป → resize ≤1024px, JPEG q75 → SHA-256 hash
  ↓
POST /api/photo  (ห้ามเรียก vision API จาก client เด็ดขาด — key รั่ว + คุมต้นทุนไม่ได้)
  ↓ 1. rate limit ต่อ user (5 ครั้ง/วัน) ตรวจจาก photo_jobs
  ↓ 2. cache hit ด้วย image_hash → คืนผลเดิม ไม่เสียเงินซ้ำ
  ↓ 3. เรียก vision API พร้อม prompt ที่บังคับให้เลือกจาก "รายการในคลังของเรา" เท่านั้น
  ↓ 4. บันทึก cost_cents ลง photo_jobs ทุกครั้ง
  ↓
คืน candidate 3 อันดับ + ความมั่นใจ → ผู้ใช้ยืนยันเสมอ (หน้า 17 ยังไม่ได้ออกแบบ)
```

**กติกาที่ห้ามละเมิด:** ห้ามบันทึกอัตโนมัติ · จำกัดโควตา · ให้ AI เลือกจากคลังที่มี ไม่ตอบอิสระ (ไม่งั้น map กลับฐานข้อมูลไม่ได้) · ความมั่นใจต่ำให้เขียนตรง ๆ ว่า "ไม่ค่อยแน่ใจ ลองค้นหาแทนไหม"

**OCR ฉลาก** (`/api/ocr-label`) สำคัญกว่า AI ทายรูปอาหารในเชิงผลลัพธ์ เพราะเป็นตัวปลดล็อกให้ผู้ใช้ยอมช่วยเพิ่มสินค้าไทย — parse "พลังงาน xxx กิโลแคลอรี", "โปรตีน x ก." จากฉลากไทย แล้วเติมฟอร์มให้ ผู้ใช้แค่ตรวจ

**ตั้งงบเพดานรายเดือน + alert ที่ 50/80/100%** ตั้งแต่วันแรก ไม่ใช่รอบิลมาแล้วค่อยตกใจ

---

## P7 — ขัดเงา + Observability + Launch
**2 สัปดาห์**

- **PWA:** service worker (Workbox) — app shell แบบ precache, foods API แบบ stale-while-revalidate, ห้าม cache `/api/sync` · หน้าสอนติดตั้งแยก iOS (ผ่านเมนู Share) กับ Android
- **iOS storage:** Safari ล้าง IndexedDB ได้ถ้าไม่เปิดแอปนาน → ขอ `navigator.storage.persist()` + ซิงก์ขึ้น server ทันทีที่ออนไลน์
- **Performance:** code-split ต่อ route · lazy load zxing เฉพาะตอนสแกน · self-host font + subset ช่วงไทย+ละติน (ลดจาก ~400KB เหลือ ~80KB) · Phosphor เป็น SVG sprite เฉพาะไอคอนที่ใช้จริง แทนโหลดทั้งชุดจาก CDN
- **Error tracking:** Sentry + source map
- **Analytics แบบเคารพความเป็นส่วนตัว:** วัดแค่ funnel (สมัคร→onboarding→บันทึกครั้งแรก→วันที่ 7), เวลาที่ใช้บันทึกหนึ่งมื้อ (เป้า ≤ 3 วิ), อัตราเจอของการสแกน, retention D1/D7/D30
- **CI:** typecheck + unit + integration + E2E (Playwright) ทุก PR · preview deploy ต่อ branch
- **Backup:** Supabase PITR + export รายสัปดาห์ไปที่อื่น (อย่าพึ่ง backup ของ provider เจ้าเดียว)

---

## 8. เทสต์ที่ต้องมี (จัดลำดับตามความคุ้ม)

| ระดับ | ครอบอะไร | ทำไมคุ้ม |
|---|---|---|
| Unit | `lib/calc` (TDEE, floor, kcal), `lib/thai` (normalize) | เลขเพี้ยน = ผู้ใช้เลิกเชื่อถือทันที และเป็นฟังก์ชันบริสุทธิ์ เทสต์ง่ายมาก |
| Integration | sync (ทุกเคสในตาราง 2.5), RLS, trigger summary | บั๊กตรงนี้ทำข้อมูลผู้ใช้หาย ซึ่งกู้คืนไม่ได้ |
| E2E | สมัคร→onboarding→บันทึก→เห็นบนอีกเครื่อง, สแกน→บันทึก, ออฟไลน์→ออนไลน์ | ครอบ 95% ของการใช้งานจริง |
| Manual | สแกนของจริงในร้าน, iOS Safari, ขยายตัวอักษร 200% | จำลองใน CI ไม่ได้ |

**อย่าไล่ 100% coverage** — เอาแค่ 4 บรรทัดข้างบนให้แน่น คุ้มกว่าเทสต์ component ที่แค่ render แล้วเช็คว่ามีข้อความ

---

## 9. ความเสี่ยงและการรับมือ

| ความเสี่ยง | ระดับ | รับมือ | ต้องทำเมื่อไร |
|---|---|---|---|
| สิทธิ์ Thai FCD เชิงพาณิชย์ | **สูง** | ติดต่อ ม.มหิดล ขออนุญาตเป็นลายลักษณ์อักษร | **ก่อนเริ่ม P3** |
| share-alike ของ ODbL กระทบโมเดลธุรกิจ | **สูง** | ให้ทนายดูเส้นแบ่ง "ใช้ในแอป" vs "เผยแพร่ฐานข้อมูลดัดแปลง" | ก่อนเริ่ม P3 |
| สินค้าไทยใน OFF น้อยเกินไป | **สูง** | วัดจริงในขั้น 0.5 แล้วปรับแผนตามผล | ก่อน P4 |
| ค่า vision API บานปลาย | สูง | โควตา + cache hash + ย่อรูป + เพดานงบ + alert | P6 วันแรก |
| ข้อมูลผู้ใช้หายตอน sync | สูง | เทสต์ตาราง 2.5 + soft delete + backup | P2 |
| คนเลิกใช้ในสัปดาห์แรก | สูง | วัด time-to-log (เป้า ≤3 วิ) + ปุ่มกินซ้ำ + streak ให้อภัย | วัดตั้งแต่ P5 |
| iOS ล้าง storage | กลาง | `storage.persist()` + ซิงก์ทันทีที่ออนไลน์ | P7 |
| ข้อมูลผู้ใช้ผิด/ถูกก่อกวน | กลาง | ตรวจเองช่วงแรก + confirm 2 คน + ปุ่มแจ้งผิด | P4 |
| ผู้ใช้เลือกหน่วยผิด (ซอง vs หน่วยบริโภค) | กลาง | default ทั้งซอง + กล่องบอกว่ากำลังนับแบบไหน (ทำแล้วใน UI) | ✅ |

---

## 10. สิ่งที่ต้องทำ**ก่อน**เริ่มเขียนโค้ด P3

ไม่ใช่งานเขียนโค้ด แต่ block งานเขียนโค้ดอยู่ ทำคู่ขนานกับ P1–P2 ได้

1. **ติดต่อสถาบันโภชนาการ ม.มหิดล** — ขออนุญาตใช้ Thai FCD ระบุให้ชัดว่าเป็นแอปฟรีตอนนี้ แต่อาจมีรายได้ในอนาคต ขอเงื่อนไขทั้งสองแบบ
2. **ปรึกษาทนายเรื่อง ODbL share-alike** — โดยเฉพาะกรณีที่เรารวมข้อมูล OFF กับข้อมูลที่เรากรอกเองเข้าเป็นคลังเดียว
3. **จดโดเมนและเช็คชื่อ** ว่าซ้ำกับใครไหม
4. **ขั้น 0.5** — สแกนของจริง 50 ชิ้นในร้าน วัดเปอร์เซ็นต์ที่เจอ
5. **ตัดสินใจโมเดลรายได้** — เพราะมันกำหนดว่าข้อ 1 กับ 2 ต้องเจรจาแบบไหน

---

## 11. Timeline

```
สัปดาห์  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19
P1 auth  ██████
P2 sync        █████████
P3 คลัง              ███████████████████
P4 สแกน                              ██████████
P5 profile                                     ███████
P6 AI                                                 ██████████
P7 launch                                                       ███████
กฎหมาย   ▓▓▓▓▓▓▓▓▓▓  (คู่ขนาน — ต้องจบก่อน P3 เริ่มจริง)
ขั้น 0.5        ▓▓▓   (คู่ขนาน)
```

**ทางลัดถ้าต้องรีบ:** ตัด P6 (AI) ออกทั้งเฟส แล้วเปิดตัวที่สัปดาห์ 13 ได้ — AI ทายรูปอาหารเป็นทางเลือกสุดท้ายที่แม่นน้อยที่สุดอยู่แล้ว แต่ **OCR ฉลากตัดไม่ได้** ถ้าผลขั้น 0.5 ออกมาต่ำกว่า 40% เพราะมันคือกลไกเดียวที่ทำให้คนยอมช่วยเพิ่มสินค้าไทย ให้ย้าย OCR ไปอยู่ใน P4 แทน

**สิ่งที่ตัดไม่ได้เลย:** P1, P2 และ P3 ส่วนจานไทย — สามอย่างนี้คือแอป ที่เหลือคือส่วนขยาย

---

## 12. งานดีไซน์ที่ยังค้าง

ต้องได้จากดีไซน์ก่อนถึงเฟสที่เกี่ยวข้อง

| สิ่งที่ขาด | ต้องใช้ในเฟส |
|---|---|
| dialog "จะคำนวณเป้าใหม่ไหม" เมื่อแก้ค่าที่กระทบการคำนวณ | P5 |
| ฟอร์มเพิ่มสินค้าเองแบบเต็ม | P4 |
| หน้า 17 ผล AI | P6 |
| หน้า 19 รายละเอียดอาหาร, 22 รายละเอียดรายวัน | P5 |
| หน้า 24–27 (ข้อมูลส่วนตัว/เป้า/น้ำหนัก/ตั้งค่าเต็ม) | P5 |
| สถานะ "ซิงก์ไม่สำเร็จหลัง retry หมด" | P2 |
| หน้าสอนติดตั้ง PWA (iOS / Android) | P7 |
| โลโก้จริง + มาสคอต + ไอคอนแอปชุดจริง | P7 |
