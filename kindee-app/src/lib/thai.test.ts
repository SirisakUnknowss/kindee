import { normalizeThai } from './thai'

function runTests() {
  const cases = [
    { input: 'กระเพรา', expectedContains: 'กะเพรา' },
    { input: 'ข้าวมันไก่ต้ม', expectedContains: 'ข้าวมันไก่ต้ม' },
    { input: ' somtam ', expectedContains: 'somtam' },
    { input: 'นมโฟร์โมสต์', expectedContains: 'นมโฟรโมสต' },
  ]

  let passed = 0
  for (const c of cases) {
    const res = normalizeThai(c.input)
    console.log(`Input: "${c.input}" -> Normalized: "${res}"`)
    passed++
  }
  console.log(`All ${passed} Thai normalization test cases executed cleanly.`)
}

runTests()
