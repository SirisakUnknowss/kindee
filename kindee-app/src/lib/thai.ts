/**
 * Normalizes Thai text for fuzzy search matching (pg_trgm & client-side search).
 * 
 * Rules:
 * 1. NFC normalize
 * 2. Remove Thai tone marks & special symbols (U+0E48–U+0E4B, U+0E4C, U+0E47)
 * 3. Remove all spaces
 * 4. Replace easily confused vowels: ำ -> าม, ใ -> ไ, ฤ -> ริ
 * 5. Replace sound-alike consonants: ทร -> ซ, ณ -> น, ญ -> ย, ฏ -> ต, ฬ -> ล
 * 6. Lowercase English characters
 */
export function normalizeThai(str: string): string {
  if (!str) return ''

  let s = str.normalize('NFC').toLowerCase()

  // 1. Remove tone marks (ไม้เอก, ไม้โท, ไม้ตรี, ไม้จัตวา) and karan (การันต์), maitaikhu (ไม้ไต่คู้)
  s = s.replace(/[\u0E47\u0E48\u0E49\u0E4A\u0E4B\u0E4C]/g, '')

  // 2. Remove spaces and punctuation
  s = s.replace(/[\s\-_,.:;'"!@#$%^&*()=+[\]{}|\\/<>?~`]/g, '')

  // 3. Normalize confused vowels
  s = s.replace(/ำ/g, 'าม')
  s = s.replace(/ใ/g, 'ไ')
  s = s.replace(/ฤ/g, 'ริ')

  // 4. Normalize sound-alike consonants
  s = s.replace(/ทร/g, 'ซ')
  s = s.replace(/ณ/g, 'น')
  s = s.replace(/ญ/g, 'ย')
  s = s.replace(/ฏ/g, 'ต')
  s = s.replace(/ฬ/g, 'ล')

  return s
}
