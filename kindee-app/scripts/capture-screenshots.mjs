import { chromium } from 'playwright-core'
import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(projectDir, 'screenshots')
const baseUrl = process.env.KINDEE_SCREENSHOT_URL ?? 'http://127.0.0.1:5173/'
const candidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
]

let executablePath
for (const candidate of candidates) {
  try {
    await access(candidate)
    executablePath = candidate
    break
  } catch { /* try the next installed browser */ }
}
if (!executablePath) throw new Error('Chrome or Edge was not found')

await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--hide-scrollbars'],
})

const captured = []
const shot = async (page, name) => {
  await page.waitForTimeout(250)
  const file = path.join(outputDir, `${name}.png`)
  await page.screenshot({ path: file, animations: 'disabled' })
  captured.push(file)
}

const openMobilePage = async () => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'th-TH',
    colorScheme: 'light',
  })
  const page = await context.newPage()
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  return { context, page }
}

try {
  // Public/auth surfaces.
  const auth = await openMobilePage()
  await shot(auth.page, '01-splash-guest-first')
  await auth.page.getByRole('button', { name: 'สำรองข้อมูลฟรี' }).click()
  await shot(auth.page, '02-sign-up')
  await auth.page.getByRole('button', { name: 'มีบัญชีอยู่แล้ว เข้าสู่ระบบ' }).click()
  await shot(auth.page, '03-sign-in')
  await auth.page.getByRole('button', { name: 'เงื่อนไขการใช้งาน' }).click()
  await shot(auth.page, '04-terms-and-privacy')
  await auth.context.close()

  // Guest onboarding and the core daily logging surfaces.
  const app = await openMobilePage()
  await app.page.getByRole('button', { name: 'เริ่มบันทึกเลย' }).click()
  await shot(app.page, '05-onboarding-profile')
  await app.page.getByRole('button', { name: 'ถัดไป' }).click()
  await shot(app.page, '06-onboarding-body')
  await app.page.getByRole('button', { name: 'ถัดไป' }).click()
  await shot(app.page, '07-onboarding-activity')
  await app.page.getByRole('button', { name: 'ถัดไป' }).click()
  await shot(app.page, '08-onboarding-goal')
  await app.page.getByRole('button', { name: 'ถัดไป' }).click()
  await shot(app.page, '09-onboarding-target')
  await app.page.getByRole('button', { name: 'เริ่มใช้งาน' }).click()
  await app.page.getByRole('button', { name: 'Health' }).click()
  await shot(app.page, '10-today-empty')

  await app.page.getByRole('button', { name: 'เพิ่มอาหาร' }).click()
  await shot(app.page, '11-add-recent')
  await app.page.getByRole('button', { name: 'ค้นหา', exact: true }).click()
  await app.page.getByPlaceholder('พิมพ์ชื่ออาหาร หรือแบรนด์...').fill('กระเพา')
  await shot(app.page, '12-add-search-thai')
  await app.page.getByRole('button', { name: /ข้าวกะเพราหมูสับไข่ดาว อาหารปรุงสำเร็จ/ }).click()
  await shot(app.page, '13-quantity-sheet')

  await app.page.reload({ waitUntil: 'domcontentloaded' })
  await app.page.waitForTimeout(800)
  await app.page.getByRole('button', { name: 'เพิ่มอาหาร' }).click()
  await app.page.getByRole('button', { name: 'ค้นหา', exact: true }).click()
  await app.page.getByPlaceholder('พิมพ์ชื่ออาหาร หรือแบรนด์...').fill('กระเพา')
  await app.page.getByRole('button', { name: 'บันทึก ข้าวกะเพราหมูสับไข่ดาว ทันที' }).click()
  await app.page.getByRole('button', { name: 'Health' }).click()
  await shot(app.page, '14-today-with-entry')
  await app.page.getByRole('button', { name: 'Calendar' }).click()
  await shot(app.page, '15-history')
  await app.page.getByRole('button', { name: 'ฉัน' }).click()
  await shot(app.page, '16-profile')

  await app.page.getByRole('button', { name: 'เพิ่มอาหาร' }).click()
  await app.page.getByRole('button', { name: 'สแกน', exact: true }).click()
  await shot(app.page, '17-barcode-scan')
  await app.page.getByRole('button', { name: 'ถ่ายรูป', exact: true }).click()
  await shot(app.page, '18-photo-analysis')
  await app.context.close()
} finally {
  await browser.close()
}

console.log(`Captured ${captured.length} screens:`)
for (const file of captured) console.log(file)
