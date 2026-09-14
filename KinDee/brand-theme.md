# KinDee Brand Theme

## Selected theme: บัญชีแคลอรี (Calorie Ledger)

Theme นี้ต่อยอดจากสีใบเตยอุ่น แต่เปลี่ยนภาษาภาพให้เหมือนสมุดบัญชีรายรับ–รายจ่าย: TDEE คือวงเงินประจำวัน อาหารแต่ละรายการคือยอดใช้ และผลต่างคือยอดคงเหลือ ผู้ใช้จึงรู้สถานะได้ทันทีโดยไม่รู้สึกว่ากำลังถูกห้ามกิน

### Ledger language

- งบแคลอรีใช้เครื่องหมาย `+` และสีเขียวใบเตย
- แคลอรีจากอาหารใช้เครื่องหมาย `−` และสีน้ำตาลอิฐ
- ยอดคงเหลือคั่นด้วยเส้นรวมยอดแบบสมุดบัญชี
- พื้นหลังใช้สีสมุดกระดาษอุ่นและเส้นบรรทัดจาง ๆ
- สีแดงสงวนไว้สำหรับการลบข้อมูลหรือข้อผิดพลาด ไม่ใช้ตัดสินการกินเกินงบ

### Core palette

| Role | Color | Usage |
|---|---|---|
| Pandan | `#3F7D68` | Primary actions, active navigation, brand icon |
| Deep pandan | `#285C50` | Pressed state and high-emphasis text |
| Pandan line | `#72A493` | Focus, selection borders, progress details |
| Pandan tint | `#DDECE6` | Selected surfaces and supportive notices |
| Soft pandan | `#F0F7F3` | Subtle hover and informational surfaces |
| Warm rice | `#F8F7F2` | Main background |
| Rice surface | `#FFFDF8` | Cards and sheets |
| Turmeric | `#C58A2D` | Over-target and attention states without shame |
| Danger | `#B4534C` | Destructive actions only |

สีสถานะต้องมีข้อความหรือไอคอนประกอบเสมอ ห้ามใช้สีแดงกับการกินเกินเป้า และห้ามใช้สีเขียวเพื่อสื่อว่าอาหารชนิดหนึ่ง “ดี” กว่าอีกชนิดหนึ่ง

## Logo generation prompt

```text
Design a distinctive, production-ready app logo for “KinDee,” a friendly Thai food and TDEE tracking app. Create one minimal rounded vector symbol combining a Thai rice bowl viewed from the front, a subtle circular progress arc representing daily TDEE, and a single steam stroke forming an abstract letter K. The personality should feel warm, supportive, modern, nourishing, and recognizably Thai without being childish. Use simple geometric construction, generous negative space, balanced symmetry, soft rounded corners, and strong readability at 24px. Color palette: pandan green #3F7D68, deep green #285C50, warm rice #F8F7F2, and a small turmeric accent #D49A3A. Flat vector design, solid colors, transparent background, centered 1:1 composition, suitable for iOS and Android. Show the primary symbol, monochrome version, and simplified small-size variant. Do not include text, medical crosses, weighing scales, measuring tape, muscular bodies, chef hats, generic fork-and-spoon icons, realistic food, detailed ingredients, faces, gradients, shadows, glossy 3D effects, or stock-logo styling.
```
