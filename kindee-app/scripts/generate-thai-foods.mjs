#!/usr/bin/env node
// Generates ~8,000-10,000 approximate Thai food entries by combining dish
// templates with protein/ingredient variants and portion sizes. Nutrition
// values are rough per-category estimates + modifiers — NOT lab-verified.
// Output: SQL batch files under scripts/out/ that INSERT into the existing
// `public.foods` + `public.food_portions` tables (see Supabase project
// kindee-development). Run: node scripts/generate-thai-foods.mjs
//
// This does not touch the live database itself — a separate step (run by
// the operator via Supabase MCP / SQL) applies the generated batch files.

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, 'out')
mkdirSync(OUT_DIR, { recursive: true })

// category -> { label prefix used only for search variety, base kcal/100g, protein/carb/fat/100g, ui category, takesProtein, takesSpice, defaultUnit, defaultGrams }
const TEMPLATES = [
  // ข้าว
  { name: 'ผัดกะเพรา', cat: 'ข้าว', ui: 'dish', kcal: 145, p: 8, c: 12, f: 7, protein: true, spice: true, unit: 'จาน', grams: 350 },
  { name: 'ข้าวผัด', cat: 'ข้าว', ui: 'dish', kcal: 160, p: 6, c: 22, f: 6, protein: true, spice: false, unit: 'จาน', grams: 350 },
  { name: 'ข้าวคลุกกะปิ', cat: 'ข้าว', ui: 'dish', kcal: 150, p: 6, c: 20, f: 5, protein: true, spice: false, unit: 'จาน', grams: 350 },
  { name: 'ข้าวมันไก่', cat: 'ข้าว', ui: 'dish', kcal: 190, p: 7, c: 20, f: 9, protein: false, spice: false, unit: 'จาน', grams: 400 },
  { name: 'ข้าวขาหมู', cat: 'ข้าว', ui: 'dish', kcal: 210, p: 8, c: 18, f: 12, protein: false, spice: false, unit: 'จาน', grams: 400 },
  { name: 'ข้าวหมูแดง', cat: 'ข้าว', ui: 'dish', kcal: 175, p: 8, c: 20, f: 7, protein: false, spice: false, unit: 'จาน', grams: 380 },
  { name: 'ข้าวหมูกรอบ', cat: 'ข้าว', ui: 'dish', kcal: 200, p: 8, c: 18, f: 11, protein: false, spice: false, unit: 'จาน', grams: 380 },
  { name: 'ข้าวราดแกง', cat: 'ข้าว', ui: 'dish', kcal: 165, p: 7, c: 20, f: 6, protein: true, spice: true, unit: 'จาน', grams: 380 },
  // กับข้าว
  { name: 'ผัดพริกแกง', cat: 'กับข้าว', ui: 'dish', kcal: 150, p: 9, c: 6, f: 9, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ผัดขิง', cat: 'กับข้าว', ui: 'dish', kcal: 130, p: 8, c: 7, f: 6, protein: true, spice: false, unit: 'จาน', grams: 250 },
  { name: 'ผัดกระเทียมพริกไทย', cat: 'กับข้าว', ui: 'dish', kcal: 135, p: 9, c: 4, f: 8, protein: true, spice: false, unit: 'จาน', grams: 250 },
  { name: 'ผัดเผ็ด', cat: 'กับข้าว', ui: 'dish', kcal: 145, p: 8, c: 6, f: 9, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ผัดผักรวม', cat: 'กับข้าว', ui: 'dish', kcal: 90, p: 5, c: 6, f: 5, protein: true, spice: false, unit: 'จาน', grams: 250 },
  { name: 'ผัดคะน้า', cat: 'กับข้าว', ui: 'dish', kcal: 100, p: 6, c: 5, f: 6, protein: true, spice: false, unit: 'จาน', grams: 250 },
  { name: 'ไข่เจียว', cat: 'กับข้าว', ui: 'dish', kcal: 220, p: 10, c: 2, f: 19, protein: false, spice: false, unit: 'จาน', grams: 150 },
  // ก๋วยเตี๋ยว
  { name: 'ก๋วยเตี๋ยวน้ำ', cat: 'ก๋วยเตี๋ยว', ui: 'dish', kcal: 90, p: 5, c: 12, f: 2, protein: true, spice: false, unit: 'ชาม', grams: 450 },
  { name: 'ก๋วยเตี๋ยวแห้ง', cat: 'ก๋วยเตี๋ยว', ui: 'dish', kcal: 130, p: 6, c: 16, f: 4, protein: true, spice: false, unit: 'ชาม', grams: 400 },
  { name: 'ก๋วยเตี๋ยวต้มยำ', cat: 'ก๋วยเตี๋ยว', ui: 'dish', kcal: 100, p: 5, c: 12, f: 3, protein: true, spice: true, unit: 'ชาม', grams: 450 },
  { name: 'บะหมี่น้ำ', cat: 'ก๋วยเตี๋ยว', ui: 'dish', kcal: 95, p: 5, c: 13, f: 2, protein: true, spice: false, unit: 'ชาม', grams: 450 },
  { name: 'เส้นใหญ่ผัดซีอิ๊ว', cat: 'ก๋วยเตี๋ยว', ui: 'dish', kcal: 160, p: 6, c: 20, f: 6, protein: true, spice: false, unit: 'จาน', grams: 350 },
  { name: 'ผัดไทย', cat: 'ก๋วยเตี๋ยว', ui: 'dish', kcal: 155, p: 6, c: 22, f: 5, protein: true, spice: false, unit: 'จาน', grams: 350 },
  { name: 'ผัดขี้เมา', cat: 'ก๋วยเตี๋ยว', ui: 'dish', kcal: 150, p: 7, c: 16, f: 7, protein: true, spice: true, unit: 'จาน', grams: 350 },
  // แกง
  { name: 'แกงเขียวหวาน', cat: 'แกง', ui: 'dish', kcal: 120, p: 6, c: 4, f: 9, protein: true, spice: true, unit: 'ถ้วย', grams: 300 },
  { name: 'แกงเผ็ด', cat: 'แกง', ui: 'dish', kcal: 115, p: 6, c: 4, f: 8, protein: true, spice: true, unit: 'ถ้วย', grams: 300 },
  { name: 'แกงส้ม', cat: 'แกง', ui: 'dish', kcal: 70, p: 6, c: 5, f: 2, protein: true, spice: true, unit: 'ถ้วย', grams: 300 },
  { name: 'แกงมัสมั่น', cat: 'แกง', ui: 'dish', kcal: 150, p: 7, c: 6, f: 11, protein: true, spice: false, unit: 'ถ้วย', grams: 300 },
  { name: 'แกงป่า', cat: 'แกง', ui: 'dish', kcal: 65, p: 7, c: 3, f: 2, protein: true, spice: true, unit: 'ถ้วย', grams: 300 },
  { name: 'ต้มยำ', cat: 'แกง', ui: 'dish', kcal: 55, p: 6, c: 3, f: 2, protein: true, spice: true, unit: 'ถ้วย', grams: 350 },
  { name: 'ต้มข่า', cat: 'แกง', ui: 'dish', kcal: 95, p: 6, c: 4, f: 6, protein: true, spice: false, unit: 'ถ้วย', grams: 350 },
  { name: 'แกงจืด', cat: 'แกง', ui: 'dish', kcal: 45, p: 5, c: 3, f: 1, protein: true, spice: false, unit: 'ถ้วย', grams: 350 },
  // ยำ-สลัด
  { name: 'ยำวุ้นเส้น', cat: 'ยำ-สลัด', ui: 'dish', kcal: 90, p: 6, c: 10, f: 2, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ยำมาม่า', cat: 'ยำ-สลัด', ui: 'dish', kcal: 120, p: 5, c: 14, f: 4, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ส้มตำ', cat: 'ยำ-สลัด', ui: 'dish', kcal: 55, p: 2, c: 11, f: 0.5, protein: true, spice: true, unit: 'จาน', grams: 200 },
  { name: 'ยำทะเลรวม', cat: 'ยำ-สลัด', ui: 'dish', kcal: 75, p: 8, c: 6, f: 2, protein: false, spice: true, unit: 'จาน', grams: 250 },
  { name: 'สลัดผัก', cat: 'ยำ-สลัด', ui: 'dish', kcal: 60, p: 4, c: 4, f: 3, protein: true, spice: false, unit: 'จาน', grams: 250 },
  { name: 'พล่า', cat: 'ยำ-สลัด', ui: 'dish', kcal: 80, p: 7, c: 5, f: 3, protein: true, spice: true, unit: 'จาน', grams: 250 },
  // ทอด-ย่าง
  { name: 'ทอด', cat: 'ทอด-ย่าง', ui: 'dish', kcal: 230, p: 9, c: 6, f: 17, protein: true, spice: false, unit: 'จาน', grams: 250 },
  { name: 'ย่าง', cat: 'ทอด-ย่าง', ui: 'dish', kcal: 170, p: 10, c: 1, f: 12, protein: true, spice: false, unit: 'จาน', grams: 250 },
  { name: 'ปิ้ง', cat: 'ทอด-ย่าง', ui: 'dish', kcal: 165, p: 10, c: 1, f: 11, protein: true, spice: false, unit: 'ไม้', grams: 60 },
  { name: 'เผา', cat: 'ทอด-ย่าง', ui: 'dish', kcal: 120, p: 12, c: 0, f: 6, protein: true, spice: false, unit: 'ตัว', grams: 250 },
  { name: 'สเต๊ก', cat: 'ทอด-ย่าง', ui: 'dish', kcal: 180, p: 15, c: 4, f: 11, protein: true, spice: false, unit: 'จาน', grams: 300 },
  { name: 'ทอดกระเทียม', cat: 'ทอด-ย่าง', ui: 'dish', kcal: 220, p: 10, c: 5, f: 15, protein: true, spice: false, unit: 'จาน', grams: 250 },
  // ของหวาน
  { name: 'ข้าวเหนียวมะม่วง', cat: 'ของหวาน', ui: 'sweet', kcal: 195, p: 3, c: 35, f: 6, protein: false, spice: false, unit: 'จาน', grams: 300 },
  { name: 'ทับทิมกรอบ', cat: 'ของหวาน', ui: 'sweet', kcal: 140, p: 1, c: 28, f: 3, protein: false, spice: false, unit: 'ถ้วย', grams: 250 },
  { name: 'กล้วยบวชชี', cat: 'ของหวาน', ui: 'sweet', kcal: 130, p: 1, c: 24, f: 4, protein: false, spice: false, unit: 'ถ้วย', grams: 250 },
  { name: 'บัวลอย', cat: 'ของหวาน', ui: 'sweet', kcal: 150, p: 2, c: 26, f: 4, protein: false, spice: false, unit: 'ถ้วย', grams: 250 },
  { name: 'ขนมชั้น', cat: 'ของหวาน', ui: 'sweet', kcal: 160, p: 1, c: 30, f: 4, protein: false, spice: false, unit: 'ชิ้น', grams: 60 },
  { name: 'ลอดช่อง', cat: 'ของหวาน', ui: 'sweet', kcal: 145, p: 1, c: 27, f: 4, protein: false, spice: false, unit: 'ถ้วย', grams: 250 },
  { name: 'ฝอยทอง', cat: 'ของหวาน', ui: 'sweet', kcal: 180, p: 3, c: 32, f: 5, protein: false, spice: false, unit: 'ชิ้น', grams: 60 },
  { name: 'สังขยา', cat: 'ของหวาน', ui: 'sweet', kcal: 170, p: 3, c: 22, f: 8, protein: false, spice: false, unit: 'ชิ้น', grams: 100 },
  // เครื่องดื่ม
  { name: 'ชาไทย', cat: 'เครื่องดื่ม', ui: 'drink', kcal: 65, p: 0.5, c: 12, f: 1.8, protein: false, spice: false, unit: 'แก้ว', grams: 350 },
  { name: 'กาแฟเย็น', cat: 'เครื่องดื่ม', ui: 'drink', kcal: 55, p: 0.5, c: 10, f: 1.5, protein: false, spice: false, unit: 'แก้ว', grams: 350 },
  { name: 'น้ำส้มคั้น', cat: 'เครื่องดื่ม', ui: 'drink', kcal: 45, p: 0.5, c: 11, f: 0, protein: false, spice: false, unit: 'แก้ว', grams: 350 },
  { name: 'น้ำมะนาว', cat: 'เครื่องดื่ม', ui: 'drink', kcal: 40, p: 0, c: 10, f: 0, protein: false, spice: false, unit: 'แก้ว', grams: 350 },
  { name: 'สมูทตี้ผลไม้', cat: 'เครื่องดื่ม', ui: 'drink', kcal: 60, p: 0.5, c: 14, f: 0.3, protein: false, spice: false, unit: 'แก้ว', grams: 350 },
  { name: 'น้ำเก๊กฮวย', cat: 'เครื่องดื่ม', ui: 'drink', kcal: 35, p: 0, c: 9, f: 0, protein: false, spice: false, unit: 'แก้ว', grams: 350 },
  // อาหารเช้า
  { name: 'โจ๊ก', cat: 'อาหารเช้า', ui: 'dish', kcal: 60, p: 3, c: 9, f: 1, protein: true, spice: false, unit: 'ชาม', grams: 350 },
  { name: 'ข้าวต้ม', cat: 'อาหารเช้า', ui: 'dish', kcal: 55, p: 3, c: 9, f: 1, protein: true, spice: false, unit: 'ชาม', grams: 350 },
  { name: 'แซนวิช', cat: 'อาหารเช้า', ui: 'dish', kcal: 220, p: 9, c: 24, f: 9, protein: true, spice: false, unit: 'ชิ้น', grams: 180 },
  // อาหารอีสาน
  { name: 'ลาบ', cat: 'อาหารอีสาน', ui: 'dish', kcal: 140, p: 14, c: 5, f: 7, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ก้อย', cat: 'อาหารอีสาน', ui: 'dish', kcal: 130, p: 15, c: 4, f: 5, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ซุปหน่อไม้', cat: 'อาหารอีสาน', ui: 'dish', kcal: 55, p: 3, c: 6, f: 1, protein: true, spice: true, unit: 'ถ้วย', grams: 250 },
  { name: 'ตำซั่ว', cat: 'อาหารอีสาน', ui: 'dish', kcal: 65, p: 3, c: 10, f: 1, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'น้ำตก', cat: 'อาหารอีสาน', ui: 'dish', kcal: 135, p: 14, c: 4, f: 6, protein: true, spice: true, unit: 'จาน', grams: 250 },
  // อาหารใต้
  { name: 'แกงไตปลา', cat: 'อาหารใต้', ui: 'dish', kcal: 110, p: 7, c: 5, f: 7, protein: true, spice: true, unit: 'ถ้วย', grams: 300 },
  { name: 'คั่วกลิ้ง', cat: 'อาหารใต้', ui: 'dish', kcal: 190, p: 12, c: 3, f: 14, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ผัดสะตอ', cat: 'อาหารใต้', ui: 'dish', kcal: 160, p: 9, c: 8, f: 10, protein: true, spice: true, unit: 'จาน', grams: 250 },
  // ของว่าง
  { name: 'ปอเปี๊ยะทอด', cat: 'ของว่าง', ui: 'dish', kcal: 210, p: 5, c: 22, f: 11, protein: true, spice: false, unit: 'จาน', grams: 200 },
  { name: 'สาคูไส้', cat: 'ของว่าง', ui: 'dish', kcal: 180, p: 4, c: 26, f: 7, protein: true, spice: false, unit: 'จาน', grams: 200 },
  { name: 'ทอดมัน', cat: 'ของว่าง', ui: 'dish', kcal: 190, p: 8, c: 10, f: 12, protein: true, spice: true, unit: 'จาน', grams: 200 },
  // เพิ่มเติม: จานเดียว/ผัด/แกงยอดนิยมอื่น ๆ เพื่อความหลากหลาย
  { name: 'ผัดซีอิ๊ว', cat: 'กับข้าว', ui: 'dish', kcal: 150, p: 8, c: 14, f: 7, protein: true, spice: false, unit: 'จาน', grams: 300 },
  { name: 'ผัดพริกไทยดำ', cat: 'กับข้าว', ui: 'dish', kcal: 140, p: 9, c: 5, f: 8, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ผัดกะหล่ำปลี', cat: 'กับข้าว', ui: 'dish', kcal: 100, p: 6, c: 6, f: 5, protein: true, spice: false, unit: 'จาน', grams: 250 },
  { name: 'ผัดถั่วฝักยาว', cat: 'กับข้าว', ui: 'dish', kcal: 110, p: 6, c: 6, f: 6, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ผัดหน่อไม้', cat: 'กับข้าว', ui: 'dish', kcal: 95, p: 6, c: 5, f: 5, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ผัดเปรี้ยวหวาน', cat: 'กับข้าว', ui: 'dish', kcal: 135, p: 7, c: 12, f: 6, protein: true, spice: false, unit: 'จาน', grams: 300 },
  { name: 'ผัดมะเขือยาว', cat: 'กับข้าว', ui: 'dish', kcal: 105, p: 6, c: 6, f: 6, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ผัดใบกะเพราะกรอบ', cat: 'กับข้าว', ui: 'dish', kcal: 150, p: 8, c: 7, f: 9, protein: true, spice: true, unit: 'จาน', grams: 300 },
  { name: 'ต้มจืดเต้าหู้', cat: 'แกง', ui: 'dish', kcal: 40, p: 4, c: 3, f: 1, protein: true, spice: false, unit: 'ถ้วย', grams: 350 },
  { name: 'ต้มแซ่บ', cat: 'อาหารอีสาน', ui: 'dish', kcal: 65, p: 6, c: 4, f: 2, protein: true, spice: true, unit: 'ถ้วย', grams: 350 },
  { name: 'แกงคั่ว', cat: 'แกง', ui: 'dish', kcal: 130, p: 7, c: 5, f: 9, protein: true, spice: true, unit: 'ถ้วย', grams: 300 },
  { name: 'แกงเลียง', cat: 'แกง', ui: 'dish', kcal: 60, p: 6, c: 5, f: 1, protein: true, spice: true, unit: 'ถ้วย', grams: 300 },
  { name: 'แกงกะหรี่', cat: 'แกง', ui: 'dish', kcal: 145, p: 7, c: 8, f: 9, protein: true, spice: false, unit: 'ถ้วย', grams: 300 },
  { name: 'แกงหน่อไม้', cat: 'แกง', ui: 'dish', kcal: 70, p: 6, c: 5, f: 2, protein: true, spice: true, unit: 'ถ้วย', grams: 300 },
  { name: 'ยำสามกรอบ', cat: 'ยำ-สลัด', ui: 'dish', kcal: 100, p: 7, c: 6, f: 5, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ยำใหญ่', cat: 'ยำ-สลัด', ui: 'dish', kcal: 95, p: 7, c: 6, f: 4, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ยำตะไคร้', cat: 'ยำ-สลัด', ui: 'dish', kcal: 85, p: 6, c: 6, f: 3, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ยำถั่วพู', cat: 'ยำ-สลัด', ui: 'dish', kcal: 80, p: 5, c: 6, f: 3, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ยำปลากรอบ', cat: 'ยำ-สลัด', ui: 'dish', kcal: 105, p: 8, c: 6, f: 5, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ทอดกรอบ', cat: 'ทอด-ย่าง', ui: 'dish', kcal: 235, p: 9, c: 8, f: 16, protein: true, spice: false, unit: 'จาน', grams: 250 },
  { name: 'ทอดสมุนไพร', cat: 'ทอด-ย่าง', ui: 'dish', kcal: 210, p: 10, c: 5, f: 14, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ย่างจิ้มแจ่ว', cat: 'ทอด-ย่าง', ui: 'dish', kcal: 175, p: 11, c: 2, f: 12, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'นึ่งมะนาว', cat: 'ทอด-ย่าง', ui: 'dish', kcal: 90, p: 12, c: 3, f: 2, protein: true, spice: true, unit: 'จาน', grams: 300 },
  { name: 'ผัดพริกสด', cat: 'กับข้าว', ui: 'dish', kcal: 130, p: 8, c: 5, f: 7, protein: true, spice: true, unit: 'จาน', grams: 250 },
  { name: 'ข้าวผัดปู', cat: 'ข้าว', ui: 'dish', kcal: 170, p: 7, c: 22, f: 6, protein: false, spice: false, unit: 'จาน', grams: 350 },
  { name: 'ข้าวไข่เจียว', cat: 'ข้าว', ui: 'dish', kcal: 200, p: 7, c: 24, f: 9, protein: false, spice: false, unit: 'จาน', grams: 350 },
  { name: 'ข้าวกะเพราไข่ดาว', cat: 'ข้าว', ui: 'dish', kcal: 175, p: 9, c: 20, f: 8, protein: true, spice: true, unit: 'จาน', grams: 380 },
  { name: 'ข้าวต้มปลา', cat: 'อาหารเช้า', ui: 'dish', kcal: 55, p: 5, c: 8, f: 1, protein: false, spice: false, unit: 'ชาม', grams: 350 },
  { name: 'ข้าวต้มหมู', cat: 'อาหารเช้า', ui: 'dish', kcal: 60, p: 5, c: 8, f: 2, protein: false, spice: false, unit: 'ชาม', grams: 350 },
  { name: 'ปาท่องโก๋', cat: 'อาหารเช้า', ui: 'dish', kcal: 300, p: 6, c: 35, f: 15, protein: false, spice: false, unit: 'ชิ้น', grams: 60 },
  { name: 'ขนมครก', cat: 'ของว่าง', ui: 'sweet', kcal: 160, p: 3, c: 20, f: 8, protein: false, spice: false, unit: 'ชิ้น', grams: 80 },
  { name: 'ข้าวเกรียบปากหม้อ', cat: 'ของว่าง', ui: 'dish', kcal: 140, p: 5, c: 18, f: 5, protein: true, spice: false, unit: 'จาน', grams: 200 },
]

const PROTEINS = [
  'หมู', 'ไก่', 'เนื้อ', 'กุ้ง', 'ปลา', 'หมึก', 'เต้าหู้', 'ไข่', 'ทะเลรวม', 'หมูกรอบ',
  'ไก่บ้าน', 'เป็ด', 'ปลาดุก', 'ปลาช่อน', 'กุ้งแม่น้ำ',
]
// per-protein macro modifiers (per 100g, added on top of template base)
const PROTEIN_MOD = {
  'หมู': { kcal: 10, p: 2, c: 0, f: 1 },
  'ไก่': { kcal: 0, p: 3, c: 0, f: 0 },
  'เนื้อ': { kcal: 15, p: 3, c: 0, f: 1 },
  'กุ้ง': { kcal: -10, p: 3, c: 0, f: -1 },
  'ปลา': { kcal: -15, p: 3, c: 0, f: -1 },
  'หมึก': { kcal: -12, p: 2, c: 0, f: -1 },
  'เต้าหู้': { kcal: -20, p: 1, c: 1, f: 0 },
  'ไข่': { kcal: 5, p: 2, c: 0, f: 2 },
  'ทะเลรวม': { kcal: -5, p: 3, c: 0, f: -0.5 },
  'หมูกรอบ': { kcal: 40, p: 2, c: 0, f: 6 },
  'ไก่บ้าน': { kcal: -5, p: 3, c: 0, f: -0.5 },
  'เป็ด': { kcal: 25, p: 2, c: 0, f: 3 },
  'ปลาดุก': { kcal: -8, p: 3, c: 0, f: -0.5 },
  'ปลาช่อน': { kcal: -10, p: 3, c: 0, f: -1 },
  'กุ้งแม่น้ำ': { kcal: -8, p: 3, c: 0, f: -0.5 },
}

const SIZES = [
  { label: 'จัมโบ้', mult: 1.7 },
  { label: 'พิเศษ', mult: 1.35 },
  { label: 'ธรรมดา', mult: 1.0 },
  { label: 'เล็ก', mult: 0.7 },
]

const SPICE = [
  { label: '', mult: 1.0 },
  { label: 'เผ็ดน้อย', mult: 0.95 },
  { label: 'เผ็ดพิเศษ', mult: 1.05 },
]

function round1(n) { return Math.round(n * 10) / 10 }

const seen = new Set()
const rows = []

for (const t of TEMPLATES) {
  const proteinList = t.protein ? PROTEINS : [null]
  const spiceList = t.spice ? SPICE : [{ label: '', mult: 1.0 }]
  for (const protein of proteinList) {
    for (const size of SIZES) {
      for (const spice of spiceList) {
        const namePieces = [t.name]
        if (protein) namePieces.push(protein)
        if (spice.label) namePieces.push(spice.label)
        if (size.label !== 'ธรรมดา') namePieces.push(`(${size.label})`)
        const name = namePieces.join(protein ? (t.name.startsWith('ผัด') || t.name.startsWith('แกง') || t.name.startsWith('ต้ม') || t.name.startsWith('ยำ') ? '' : '') : '')
        // Build a natural name: "<dish><protein><spice><(size)>" e.g. "ผัดกะเพราหมูเผ็ดพิเศษ (พิเศษ)"
        const fullName = `${t.name}${protein ?? ''}${spice.label}${size.label !== 'ธรรมดา' ? ` (${size.label})` : ''}`.trim()
        if (seen.has(fullName)) continue
        seen.add(fullName)

        const mod = protein ? PROTEIN_MOD[protein] : { kcal: 0, p: 0, c: 0, f: 0 }
        const kcal100 = round1((t.kcal + mod.kcal) * spice.mult)
        const p100 = round1(Math.max(0, t.p + mod.p))
        const c100 = round1(Math.max(0, t.c + mod.c))
        const f100 = round1(Math.max(0, t.f + mod.f))
        const grams = Math.round(t.grams * size.mult)

        rows.push({
          id: crypto.randomUUID(),
          name_th: fullName,
          category: t.ui,
          category_th: t.cat,
          kcal_100g: kcal100,
          protein_100g: p100,
          carb_100g: c100,
          fat_100g: f100,
          unit_label: t.unit,
          grams,
        })
      }
    }
  }
}

console.log(`Generated ${rows.length} unique food rows`)

function esc(s) {
  return String(s).replace(/'/g, "''")
}

const BATCH = 300
let batchIndex = 0
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH)
  const foodValues = chunk.map((r) => (
    `('${r.id}', '${esc(r.name_th)}', NULL, ARRAY['${esc(r.category_th)}']::text[], '${esc(r.category)}', true, false, ${r.kcal_100g}, ${r.protein_100g}, ${r.carb_100g}, ${r.fat_100g}, 'ai', 'unverified', true, public.normalize_thai('${esc(r.name_th)}'))`
  )).join(',\n')
  const portionValues = chunk.map((r) => (
    `('${r.id}', '${esc(r.unit_label)}', ${r.grams}, true, 0)`
  )).join(',\n')

  // Fixed ids generated client-side avoid any RETURNING/join ordering fragility.
  const sql = `-- batch ${batchIndex}: ${chunk.length} rows (aliases[0] carries the granular Thai
-- category; the UI-facing category column stays within the app's existing filter set)
insert into public.foods (id, name_th, name_en, aliases, category, is_dish, is_packaged, kcal_100g, protein_100g, carb_100g, fat_100g, source, quality, is_public, search_text)
values
${foodValues};

insert into public.food_portions (food_id, label_th, grams, is_default, sort_order)
values
${portionValues};
`
  writeFileSync(path.join(OUT_DIR, `batch_${String(batchIndex).padStart(3, '0')}.sql`), sql, 'utf8')
  batchIndex++
}

console.log(`Wrote ${batchIndex} batch files to ${OUT_DIR}`)
