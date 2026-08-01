# KinDee — PWA นับแคลอรี (P0)

สร้างจาก `design_handoff_kindee/README.md` (handoff hifi) + `KinDee/kindee-design.md` 0.2 และ `KinDee/kindee-architecture.md`

Stack: **React 18 + TypeScript + Vite + vite-plugin-pwa** · CSS ล้วนพร้อม design token (ไม่ใช้ Tailwind เพื่อให้ค่าตรงกับ token sheet ของดีไซน์แบบ 1:1)

```bash
npm install
npm run dev      # http://localhost:5183
npm run build    # tsc -b && vite build (+ service worker/manifest)
```

## ทำอะไรไปแล้ว

| กลุ่ม | หน้า | สถานะ |
|---|---|---|
| A เข้าสู่ระบบ | 1 Splash · 2 Login/Signup · 3 ยืนยันอีเมล · 4 ลืมรหัสผ่าน · เงื่อนไข/PDPA | ครบ (auth เป็น mock — ต่อ Supabase/Firebase Auth ได้เลย) |
| B ตั้งค่าครั้งแรก | 6–10 พร้อมสูตร Mifflin–St Jeor และตัวกันด้านล่าง | ครบ |
| C ใช้งานหลัก | **11 วันนี้** · **12 ล่าสุด** · **13 ค้นหา** · **14 สแกน** · 16 ถ่ายรูป · 15 ไม่พบบาร์โค้ด · **18 เลือกปริมาณ** · 20 แก้ไข | ครบทั้ง 5 หน้า P0 |
| D โปรไฟล์ | 21 ประวัติ · 23 ฉัน | ระดับ wireframe (P1) |

**สถานะที่ทำไว้:** ว่างเปล่า · กำลังโหลด (skeleton ไม่ใช่วงหมุน) · ออฟไลน์ (แถบบน + รอซิงก์ + คิวบาร์โค้ด) · ไม่ได้รับอนุญาตใช้กล้อง · ดูย้อนหลังแบบอ่านอย่างเดียว · ฟอร์ม error โทนไม่ตำหนิ

## โครงไฟล์

```
src/
├─ data/foods.ts        คลังอาหารตั้งต้น (จาน + สินค้าบรรจุภัณฑ์) + ป้ายคุณภาพข้อมูล
├─ lib/calc.ts          ฟังก์ชันบริสุทธิ์: TDEE, floor, kcal ต่อ entry, โทนวงแหวน — unit test ได้
├─ lib/types.ts         Entry / Profile (entry เก็บ kcal เป็น snapshot)
├─ lib/store.tsx        state + persistence + สถานะออนไลน์/คิวรอซิงก์
├─ components/ui.tsx    วงแหวน · แถบ macro · ป้ายคุณภาพ · sheet · มาสคอต · แถบออฟไลน์
├─ screens/             Auth · Terms · Onboarding · Today · AddPanel · QtySheet · History · Me
└─ styles.css           design token ทั้งชุด + animation (เคารพ prefers-reduced-motion)
```

## กติกาที่โค้ดยึดไว้ (อย่าเผลอแก้)

- **ไม่มีสีแดงกับ “กินเกินเป้า”** — ใช้ `--status-over` (เหลืองอำพัน) แดงสงวนไว้ให้การลบเท่านั้น
- **เป้าห้ามต่ำกว่าเกณฑ์ปลอดภัย** (ชาย 1,500 / หญิง 1,200) — `computeTarget()` ดันขึ้นให้เอง พร้อมข้อความน้ำเสียงห่วงใย
- **`entries.kcal` เป็น snapshot** — แก้ข้อมูลอาหารทีหลังแล้วประวัติต้องไม่ขยับ
- **สินค้าบรรจุภัณฑ์ค่าเริ่มต้นคือ “ทั้งซอง”** และถ้าฉลากระบุหลายหน่วยบริโภคต้องขึ้นกล่องบอกว่ากำลังนับแบบไหน
- **ป้ายคุณภาพข้อมูล = ไอคอน + ข้อความเสมอ** ห้ามสื่อด้วยสีอย่างเดียว
- แตะการ์ด “กินบ่อย” หรือปุ่ม `+` = บันทึกทันที แล้วขึ้น toast ที่มี “แก้ไข/เลิกทำ”

## ยังต้องต่อของจริง

1. **Auth** — Supabase Auth หรือ Firebase Auth (Google + email/verify) แทน mock ใน `screens/Auth.tsx`
2. **กล้อง/บาร์โค้ด** — `getUserMedia` + `BarcodeDetector` (fallback `zxing-wasm`) แทนปุ่ม “จำลอง: สแกนเจอ/ไม่พบ” ใน `AddPanel.tsx`
3. **คลังอาหาร** — Open Food Facts / USDA / Thai FCD + ค้นหาไทยแบบ normalize วรรณยุกต์ (`pg_trgm`) ตาม architecture ข้อ 6.2
4. **Persistence** — เปลี่ยน localStorage เป็น Dexie (IndexedDB) + outbox queue, upsert ฝั่ง server ด้วย `uid` เพื่อให้ idempotent
5. **OCR ฉลาก / AI ทายจากรูป** — ผ่าน server route เท่านั้น พร้อมโควตารายวัน (หน้า 17 ผล AI ยังไม่ได้ทำ)
6. **Assets** — self-host LINE Seed Sans TH (SIL OFL) และ Phosphor Icons แทน CDN, ทำไอคอน PNG ชุดจริง

## ที่ยังไม่ได้ทำในรอบนี้

หน้า 5 Welcome · 17 ผล AI · 19 รายละเอียดอาหาร · 22 รายละเอียดรายวัน · 24–27 (ข้อมูลส่วนตัว/เป้า/น้ำหนัก/ตั้งค่าเต็ม) · dialog ถามว่า “จะคำนวณเป้าใหม่ไหม” เมื่อแก้ค่าที่กระทบการคำนวณ · ฟอร์มเพิ่มสินค้าเองแบบเต็ม (ตามที่ handoff ระบุว่ายังไม่ได้ออกแบบ)

## เครดิตข้อมูล

Thai Food Composition Database — สถาบันโภชนาการ ม.มหิดล (ไม่ใช่เชิงพาณิชย์) · Open Food Facts (ODbL) · USDA FoodData Central (public domain)
⚠️ ก่อนทำเชิงพาณิชย์ ต้องเคลียร์สิทธิ์ Thai FCD กับ ม.มหิดล และตรวจเงื่อนไข share-alike ของ ODbL ก่อน
