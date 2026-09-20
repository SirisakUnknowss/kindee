# KinDee — บัญชีแคลอรีสำหรับอาหารไทย

KinDee เป็น Progressive Web App สำหรับบันทึกอาหารและบริหาร TDEE ด้วยแนวคิดเดียวกับบัญชีรายรับ–รายจ่าย:

- `งบวันนี้` คือเป้าแคลอรีรายวัน
- `ใช้ไป` คืออาหารและเครื่องดื่มที่บันทึก
- `คงเหลือ` คือแคลอรีที่ยังจัดสรรได้

แอปออกแบบแบบ guest-first ใช้งานได้โดยไม่สมัครสมาชิก ข้อมูลถูกเก็บใน IndexedDB ก่อน และซิงก์กับ Supabase เมื่อผู้ใช้สร้างบัญชี

## สถานะปัจจุบัน

- Onboarding และคำนวณ TDEE ด้วยสูตร Mifflin–St Jeor
- ตัวกันเป้าต่ำกว่าเกณฑ์ปลอดภัย
- บันทึก ค้นหา แก้ไข และลบอาหาร
- สแกนบาร์โค้ดและค้นหาผ่าน Open Food Facts
- วิเคราะห์ภาพอาหารผ่าน Gemini เมื่อเปิดใช้ server key
- Offline-first ด้วย Dexie และ outbox sync
- Supabase Auth, Postgres, RLS และ RPC สำหรับ sync
- Cloudflare Pages Functions สำหรับ `/api/barcode`, `/api/photo`, `/api/sync` และ Stripe Billing
- PWA พร้อมไอคอน KinDee และชุดภาพ UAT 18 หน้า

รายละเอียด product และ architecture อยู่ที่ [Product roadmap](KinDee/product-roadmap-architecture.md)
ส่วนความแตกต่างของแพ็กเกจสมาชิกอยู่ที่ [Subscription packages](KinDee/subscription-packages.md)
คู่มือหน้า dashboard สำหรับผู้ดูแลอยู่ที่ [Admin monitoring](kindee-app/docs/ADMIN_MONITORING.md)

## Technology

- React 18, TypeScript และ Vite
- Dexie / IndexedDB
- Supabase Auth และ Postgres
- Cloudflare Pages และ Pages Functions
- Vitest และ Playwright สำหรับชุดภาพหน้าจอ

## โครงสร้าง repository

```text
kindee/
├─ kindee-app/                  ตัวเว็บและ Pages Functions
│  ├─ functions/api/           API ที่ทำงานบน Cloudflare
│  ├─ public/                  PWA assets และโลโก้
│  ├─ screenshots/             ภาพหน้าจอสำหรับ review/UAT
│  └─ src/                     React application
├─ supabase/migrations/         schema, RLS และ sync RPC
├─ KinDee/                      product/design/architecture docs
└─ .github/workflows/ci.yml     typecheck, test และ production build
```

## เริ่มพัฒนาในเครื่อง

ต้องมี Node.js 22 ขึ้นไป จากนั้น:

```bash
cd kindee-app
npm install
copy .env.development.example .env.development.local
npm run dev
```

เปิด `http://localhost:5173` หากยังไม่ใส่ค่า Supabase แอปยังทดลอง guest flow ได้ แต่บัญชีและ server features จะไม่ทำงานครบ

คำสั่งหลัก:

```bash
npm run typecheck
npm test
npm run build
npm run screenshots
```

## Environment configuration

ค่าถูกแยกเป็นสาม environment และห้ามใช้ database ร่วมกัน:

| Environment | Vite template | Cloudflare | Supabase |
|---|---|---|---|
| Development | `.env.development.example` | `.dev.vars.example` | local/dev project |
| Staging/UAT | `.env.staging.example` | Preview environment | staging project |
| Production | `.env.production.example` | Production environment | production project |

### Browser variables

ตัวแปรที่ขึ้นต้นด้วย `VITE_` จะถูกฝังใน JavaScript bundle จึงใส่ได้เฉพาะค่าที่เปิดเผยต่อ browser:

```dotenv
VITE_APP_ENV=development
VITE_SUPABASE_URL=https://project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

ห้ามใส่ `SUPABASE_SERVICE_ROLE_KEY` หรือ `GEMINI_API_KEY` ในตัวแปร `VITE_*`

### Server variables and secrets

Pages Functions ใช้ค่าต่อไปนี้:

| Name | Secret | Required | Purpose |
|---|---:|---:|---|
| `SUPABASE_URL` | No | Yes | Supabase endpoint ของ environment นั้น |
| `SUPABASE_PUBLISHABLE_KEY` | No | Yes | ตรวจ session และเรียก PostgREST ตามสิทธิ์ผู้ใช้ |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Photo API | งาน server ที่ต้องข้าม RLS |
| `GEMINI_API_KEY` | Yes | Photo API | วิเคราะห์ภาพอาหาร |
| `GEMINI_MODEL` | No | No | ค่าเริ่มต้น `gemini-2.5-flash` |
| `BARCODE_PROVIDER_URL` | No | No | ค่าเริ่มต้น Open Food Facts |
| `APP_URL` | No | Billing | URL หลักของ environment สำหรับ Checkout redirect |
| `STRIPE_SECRET_KEY` | Yes | Billing | Stripe secret key ฝั่ง server |
| `STRIPE_WEBHOOK_SECRET` | Yes | Billing | ตรวจลายเซ็น `/api/billing/webhook` |
| `STRIPE_PRICE_PLUS_MONTH` / `STRIPE_PRICE_PLUS_YEAR` | No | Plus | Stripe recurring Price IDs |
| `STRIPE_PRICE_PRO_MONTH` / `STRIPE_PRICE_PRO_YEAR` | No | Pro | Stripe recurring Price IDs |
| `STRIPE_PRICE_UNLIMITED_MONTH` / `STRIPE_PRICE_UNLIMITED_YEAR` | No | Unlimited | Stripe recurring Price IDs |

### ตั้งค่า Subscription

สร้าง recurring Prices ใน Stripe สำหรับ Plus, Pro และ Unlimited อย่างละรายเดือน/รายปี แล้วใส่ Price ID ทั้ง 6 ค่าใน Cloudflare Pages จากนั้นตั้ง webhook ไปที่ `/api/billing/webhook` และรับ events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` ทุก paid plan ทดลองใช้ฟรี 30 วันเฉพาะครั้งแรก ส่วนการเปลี่ยนแพ็กเกจ ยกเลิก และแก้ข้อมูลชำระเงินทำผ่าน Stripe Customer Portal

สำหรับ local Pages Functions:

```bash
cd kindee-app
copy .dev.vars.example .dev.vars
copy .env.development.example .env.development.local
npm run pages:dev
```

ไฟล์ `.env.*.local` และ `.dev.vars` ถูก ignore จาก Git แล้ว

## ตั้งค่า Supabase

สร้าง Supabase project แยกสำหรับ staging และ production แล้วใช้ migration ตามลำดับ:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

จากนั้นตั้งค่า Authentication:

1. เปิด Email/Password และ Google provider ที่ต้องการ
2. ตั้ง Site URL เป็น URL ของ environment นั้น
3. เพิ่ม `http://localhost:5173` สำหรับ development
4. เพิ่ม staging Pages URL ใน Redirect URLs ของ staging
5. เพิ่ม production domain ใน Redirect URLs ของ production

อย่านำข้อมูลจริงหรือ service-role key ของ production มาใช้ใน UAT

## Deploy บน Cloudflare Pages

หลังสมัคร Cloudflare:

1. ไปที่ Workers & Pages แล้วสร้าง Pages project จาก GitHub repository นี้
2. ตั้ง production branch เป็น `main`
3. ตั้ง Root directory เป็น `kindee-app`
4. ตั้ง Build command เป็น `npm run build`
5. ตั้ง Build output directory เป็น `dist`
6. เพิ่ม browser variables และ server variables ใน Preview และ Production แยกกัน
7. ใส่ service-role และ Gemini key เป็น Secrets

ไฟล์ [wrangler.jsonc](kindee-app/wrangler.jsonc) กำหนดค่า non-secret สำหรับ local, preview และ production ไว้แล้ว ส่วนค่าจริงของ Supabase/Gemini ให้กรอกใน Cloudflare Dashboard เท่านั้น

**production deploy ให้ push ขึ้น `main` แล้วปล่อยให้ Cloudflare build เอง** เพราะค่า `VITE_*` ของฝั่งเบราว์เซอร์อยู่ใน Cloudflare ไม่ได้อยู่ในเครื่อง การ build ในเครื่องแล้ว `wrangler pages deploy` จะได้ bundle ที่ไม่มีค่า Supabase ทำให้บัญชี การซิงก์ และการค้นหาจากฐานข้อมูลใช้งานไม่ได้ทั้งหมด

ถ้าจำเป็นต้อง deploy จากเครื่องจริง ๆ ต้องสร้าง `.env.production.local` ให้มีค่าเดียวกับใน Cloudflare ก่อน แล้วจึง:

```bash
cd kindee-app
npx wrangler login
npm run deploy:preview
npm run deploy:production
```

Pull request และ branch ที่ไม่ใช่ production สามารถใช้ Preview deployment เป็น URL สำหรับ UAT ได้

## UAT checklist

- เริ่มใช้งานแบบ guest และทำ onboarding จนจบ
- ตรวจตัวเลข `งบวันนี้ / ใช้ไป / คงเหลือ`
- ค้นหา เพิ่ม แก้ไข และลบอาหาร
- สแกนบาร์โค้ดบน iOS และ Android
- ปิดอินเทอร์เน็ต บันทึกรายการ แล้วเชื่อมต่อใหม่
- สมัครบัญชี ยืนยันอีเมล และตรวจการซิงก์ข้ามเครื่อง
- ปิดและเปิด PWA ใหม่ ตรวจว่าข้อมูลยังอยู่
- ตรวจสถานะใช้งบเกินโดยไม่มีข้อความตำหนิหรือสีแดง

เมื่อแจ้งบั๊กให้ระบุ URL, รุ่นอุปกรณ์, browser, ขั้นตอนที่ทำ, ผลที่คาดหวัง, ผลที่เกิดจริง และภาพหน้าจอ

## Security rules

- ห้าม commit `.env`, `.env.*.local` หรือ `.dev.vars`
- ห้ามส่ง service-role/Gemini key เข้า browser bundle
- API ต้องตรวจ Supabase access token และไม่เชื่อ `user_id` จาก request body
- ใช้ staging data สำหรับ UAT และแยก production project เสมอ

## License and data

แหล่งข้อมูลที่วางแผนใช้ประกอบด้วย Thai Food Composition Database, Open Food Facts และ USDA FoodData Central ต้องตรวจสิทธิ์การใช้งานและเงื่อนไข ODbL ก่อนเปิดเชิงพาณิชย์
