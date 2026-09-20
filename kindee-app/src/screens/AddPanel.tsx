import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, QualityBadge, Thumb } from '../components/ui'
import { FILTERS, FOODS, registerRuntimeFood, type Food, type FoodCat } from '../data/foods'
import { MEALS, num } from '../lib/calc'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { normalizeThai } from '../lib/thai'
import { db } from '../lib/db'
import type { Meal } from '../lib/types'
import { PHOTO_AI_CONSENT_VERSION } from '../config/legal'

type Tab = 'recent' | 'search' | 'manual' | 'scan' | 'photo'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'recent', label: 'ล่าสุด', icon: 'ph ph-clock-counter-clockwise' },
  { id: 'search', label: 'ค้นหา', icon: 'ph ph-magnifying-glass' },
  { id: 'manual', label: 'จดเอง', icon: 'ph ph-pencil-simple' },
  { id: 'scan', label: 'สแกน', icon: 'ph ph-barcode' },
  { id: 'photo', label: 'ถ่ายรูป', icon: 'ph ph-camera' },
]

function FoodResultRow({
  food,
  onOpen,
  onQuickAdd,
}: {
  food: Food
  onOpen: () => void
  onQuickAdd: () => void
}) {
  const packaged = food.kind === 'pack'
  return (
    <div className="kd-card kd-row" style={{ padding: '10px 12px', gap: 12 }}>
      <button onClick={onOpen} className="kd-row" style={{ flex: 1, gap: 12, minWidth: 0, textAlign: 'left' }}>
        <Thumb food={food} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="kd-clamp2" style={{ fontSize: 15, lineHeight: 1.5 }}>{food.name}</span>
          <span className="kd-caption kd-muted" style={{ display: 'block' }}>
            {packaged ? `${food.brand} · ${food.pack}` : `อาหารปรุงสำเร็จ · 1 ${food.units[0].label}`}
          </span>
          <QualityBadge q={food.q} />
        </span>
        <span style={{ textAlign: 'right', flex: 'none' }}>
          <span className="tnum" style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>{num(food.kcal)}</span>
          <span className="kd-caption kd-muted">{packaged ? 'ต่อหน่วยบรรจุ' : `ต่อ ${food.units[0].label}`}</span>
        </span>
      </button>
      <button className="kd-icon-btn" onClick={onQuickAdd} aria-label={`บันทึก ${food.name} ทันที`}>
        <Icon name="ph ph-plus" size={20} color="var(--accent-pressed)" />
      </button>
    </div>
  )
}

type PhotoCandidate = {
  food_id: string
  name_th: string
  serving_g: number
  portion: number
  confidence: number
  /** nutrition for ONE standard serving */
  kcal: number
  protein: number
  carb: number
  fat: number
}

const PHOTO_ERRORS: Record<string, string> = {
  unauthorized: 'ต้องเข้าสู่ระบบก่อนใช้การวิเคราะห์รูป',
  quota_exhausted: 'ใช้สิทธิ์วิเคราะห์รูปของเดือนนี้ครบแล้ว',
  no_match: 'ไม่พบเมนูที่ตรงกับรูป ลองค้นหาด้วยชื่อแทน',
  consent_audit_failed: 'บันทึกความยินยอมไม่สำเร็จ ระบบจึงไม่ได้ส่งรูปออกไป ลองใหม่อีกครั้ง',
  catalogue_empty: 'คลังอาหารยังไม่พร้อมใช้งาน',
  provider_failed: 'ผู้ให้บริการ AI ไม่ตอบกลับ ลองใหม่อีกครั้ง',
  invalid_provider_result: 'ผลลัพธ์จาก AI ไม่ถูกต้อง ลองถ่ายใหม่อีกครั้ง',
  consent_required: 'ต้องยืนยันความยินยอมก่อนส่งรูป',
  invalid_image: 'รูปใหญ่เกินไป ใช้ไฟล์ไม่เกิน 2 MB',
  feature_unavailable: 'ยังไม่ได้เปิดใช้การวิเคราะห์รูป (ยังไม่ได้ตั้งค่า AI)',
  service_unconfigured: 'ยังไม่ได้เปิดใช้การวิเคราะห์รูป (ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์)',
}

export function AddPanel({
  initialTab,
  initialMeal,
  onClose,
  onPickFood,
  onQuickAdd,
  onManualAdd,
}: {
  initialTab: Tab
  initialMeal: Meal
  onClose: () => void
  onPickFood: (foodId: string, meal: Meal) => void
  onQuickAdd: (foodId: string, meal: Meal) => void
  onManualAdd: (entry: {
    meal: Meal; name: string; amount: number; unitLabel: string; kcal: number
    protein?: number; carb?: number; fat?: number; note?: string
  }) => void
  onQuickAddMany?: (foodIds: string[], meal: Meal) => void
}) {
  const { entries, session, online, showToast } = useStore()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [meal, setMeal] = useState<Meal>(initialMeal)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | FoodCat>('all')
  const searchRef = useRef<HTMLInputElement>(null)
  const [manualName, setManualName] = useState('')
  const [manualAmount, setManualAmount] = useState('1')
  const [manualUnit, setManualUnit] = useState('จาน')
  const [manualKcal, setManualKcal] = useState('')
  const [manualProtein, setManualProtein] = useState('')
  const [manualCarb, setManualCarb] = useState('')
  const [manualFat, setManualFat] = useState('')
  const [manualNote, setManualNote] = useState('')

  // Camera & Scan states
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scan, setScan] = useState<'aiming' | 'fetching' | 'notfound' | 'denied'>('aiming')
  const [scanCount, setScanCount] = useState<number>(0)
  const [manualBarcode, setManualBarcode] = useState('')
  const lastDetected = useRef<{ code: string; at: number } | null>(null)

  // Photo states
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoCandidates, setPhotoCandidates] = useState<PhotoCandidate[] | null>(null)
  const [photoPortions, setPhotoPortions] = useState<Record<string, number>>({})
  const [photoConsent, setPhotoConsent] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  // Catalogue search states
  const [remoteIds, setRemoteIds] = useState<string[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (tab === 'search') searchRef.current?.focus()
  }, [tab])

  // Camera access starts only after the user opens Scan and is always released.
  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: number | undefined
    let cancelled = false
    if (tab === 'scan') {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s
          if (videoRef.current) {
            videoRef.current.srcObject = s
          }
          const NativeDetector = (window as typeof window & {
            BarcodeDetector?: new (options: { formats: string[] }) => {
              detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>
            }
          }).BarcodeDetector
          if (NativeDetector) {
            const detector = new NativeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] })
            timer = window.setInterval(async () => {
              if (cancelled || !videoRef.current || videoRef.current.readyState < 2) return
              const [result] = await detector.detect(videoRef.current).catch(() => [])
              if (!result?.rawValue) return
              const previous = lastDetected.current
              if (previous?.code === result.rawValue && Date.now() - previous.at < 2_000) return
              lastDetected.current = { code: result.rawValue, at: Date.now() }
              void handleBarcodeLookup(result.rawValue)
            }, 200)
          }
        })
        .catch(() => setScan('denied'))
    }
    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [tab])

  // Barcode Lookup Handler
  const handleBarcodeLookup = async (code: string) => {
    if (!code) return
    if (!online) {
      await db.scan_queue.add({ barcode: code, scanned_at: new Date().toISOString() })
      setScanCount((count) => count + 1)
      setScan('aiming')
      return showToast('เก็บบาร์โค้ดไว้แล้ว จะค้นหาให้เมื่อกลับมาออนไลน์')
    }
    setScan('fetching')
    try {
      const res = await fetch(`/api/barcode/${encodeURIComponent(code)}`)
      const data = await res.json()
      if (res.ok && data.food) {
        const packageGrams = Number(data.food.package_size_g ?? data.food.serving_size_g ?? 100)
        const kcal100g = Number(data.food.kcal_100g)
        if (!Number.isFinite(kcal100g)) throw new Error('incomplete_nutrition')
        const runtime = registerRuntimeFood({
          id: data.food.id ?? `barcode:${code}`,
          name: data.food.name_th,
          brand: data.food.brand ?? undefined,
          pack: `${packageGrams} ก.`,
          kcal: Math.round(kcal100g * packageGrams / 100),
          protein: Number(data.food.protein_100g ?? 0) * packageGrams / 100,
          carb: Number(data.food.carb_100g ?? 0) * packageGrams / 100,
          fat: Number(data.food.fat_100g ?? 0) * packageGrams / 100,
          kind: 'pack', cat: 'store', q: data.food.quality === 'verified' ? 'verified' : 'open',
          icon: 'ph ph-package', units: [{ label: 'ทั้งบรรจุภัณฑ์', f: 1 }, { label: 'ครึ่งหนึ่ง', f: 0.5 }],
        })
        showToast(`เจอสินค้า: ${runtime.name}`)
        onPickFood(runtime.id, meal)
        setScanCount((c) => c + 1)
        setScan('aiming')
      } else {
        setScan('notfound')
      }
    } catch {
      setScan('notfound')
    }
  }

  // Handle Photo Upload / Capture for Gemini 1.5 Flash
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!photoConsent) {
      e.target.value = ''
      showToast('โปรดยินยอมให้ส่งรูปไปยัง Google Gemini ก่อน')
      return
    }
    if (session?.kind !== 'account' || !supabase) {
      showToast('การวิเคราะห์รูปต้องใช้บัญชีฟรี เพื่อควบคุมโควตาและปกป้องข้อมูล')
      return
    }
    const authClient = supabase
    if (file.size > 2_000_000) {
      showToast('รูปใหญ่เกิน 2 MB ลองเลือกรูปที่เล็กลงนะ')
      return
    }

    setPhotoLoading(true)
    setPhotoError(null)
    const fail = (message: string) => {
      setPhotoError(message)
      showToast(message)
    }
    const reader = new FileReader()
    reader.onerror = () => {
      setPhotoLoading(false)
      fail('อ่านไฟล์รูปไม่สำเร็จ ลองเลือกรูปใหม่')
    }
    reader.onload = async () => {
      const base64 = reader.result as string
      try {
        const { data: { session: authSession } } = await authClient.auth.getSession()
        if (!authSession) throw new Error('auth_required')
        const res = await fetch('/api/photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession.access_token}` },
          body: JSON.stringify({
            imageBase64: base64,
            consent: {
              version: PHOTO_AI_CONSENT_VERSION,
              provider: 'Google Gemini API',
              consentedAt: new Date().toISOString(),
            },
          }),
        })
        const data = await res.json()
        if (Array.isArray(data.candidates) && data.candidates.length) {
          const found = data.candidates as PhotoCandidate[]
          setPhotoCandidates(found)
          setPhotoPortions(Object.fromEntries(found.map((c) => [c.food_id, c.portion || 1])))
        } else {
          fail(PHOTO_ERRORS[data.error?.code] ?? 'ไม่สามารถวิเคราะห์รูปอาหารได้ ลองใหม่อีกครั้ง')
        }
      } catch {
        fail('เกิดข้อผิดพลาดในการวิเคราะห์รูปอาหาร')
      } finally {
        setPhotoLoading(false)
        // Allow re-selecting the same file after a failure.
        e.target.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  // The bundled catalogue answers instantly and offline; the database adds the
  // rest of the ~1,000 curated foods once the query settles.
  useEffect(() => {
    const term = query.trim()
    if (!supabase || !online || term.length < 2) {
      setRemoteIds([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase!.rpc('search_foods', {
        q: term,
        cat: filter === 'all' ? null : filter,
        lim: 30,
      })
      if (cancelled) return
      setSearching(false)
      if (error || !Array.isArray(data)) return setRemoteIds([])
      // Default portion labels ("แก้ว", "ชาม", ...) live in a separate table.
      const { data: portions } = await supabase!
        .from('food_portions')
        .select('food_id,label_th')
        .in('food_id', data.map((row: any) => row.id))
        .eq('is_default', true)
      if (cancelled) return
      const labels = new Map<string, string>((portions ?? []).map((p: any) => [p.food_id, p.label_th]))
      setRemoteIds(data.map((row: any) => {
        const grams = Number(row.serving_size_g) || 100
        const per = (value: unknown) => Math.round((Number(value) || 0) * grams / 100 * 10) / 10
        return registerRuntimeFood({
          id: row.id,
          name: row.name_th,
          kind: 'dish',
          cat: (FILTERS.some((f) => f.id === row.category) ? row.category : 'dish') as FoodCat,
          kcal: Math.round(Number(row.kcal_100g) * grams / 100),
          protein: per(row.protein_100g),
          carb: per(row.carb_100g),
          fat: per(row.fat_100g),
          q: row.quality === 'verified' ? 'verified' : 'open',
          icon: 'ph ph-bowl-food',
          units: [
            { label: labels.get(row.id) ?? 'ที่', f: 1 },
            { label: `ครึ่ง${labels.get(row.id) ?? 'ที่'}`, f: 0.5 },
            { label: 'ต่อ 100 ก.', f: Math.round(100 / grams * 100) / 100 },
          ],
        }).id
      }))
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, filter, online])

  const results = useMemo(() => {
    const q = normalizeThai(query)
    // Database results are registered into FOODS, so exclude them here and append
    // them below; otherwise a food matched by both sources would show up twice.
    const remoteIdSet = new Set(remoteIds)
    const local = FOODS.filter((f) => {
      if (remoteIdSet.has(f.id)) return false
      const catOk = filter === 'all' || f.cat === filter
      const haystack = normalizeThai(`${f.name} ${f.brand ?? ''}`)
      const qOk = !q || haystack.includes(q)
      return catOk && qOk
    })
    const localNames = new Set(local.map((f) => normalizeThai(f.name)))
    const remote = remoteIds
      .map((id) => FOODS.find((f) => f.id === id))
      .filter((f): f is Food => Boolean(f) && !localNames.has(normalizeThai(f!.name)))
    return [...local, ...remote]
  }, [query, filter, remoteIds])

  const recents = useMemo(() => {
    const ids = Array.from(new Set(entries.map((e) => e.foodId)))
    return ids.map((id) => FOODS.find((f) => f.id === id)).filter(Boolean) as Food[]
  }, [entries])
  const manualQty = Number(manualAmount)
  const manualPerUnit = Number(manualKcal)
  const manualTotal = Number.isFinite(manualQty) && Number.isFinite(manualPerUnit) ? Math.round(manualQty * manualPerUnit) : 0
  const manualValid = manualName.trim().length > 0 && manualQty > 0 && manualQty <= 100 && manualPerUnit >= 0 && manualPerUnit <= 10_000 && manualTotal <= 10_000
  const optionalNumber = (value: string) => value.trim() === '' ? undefined : Math.max(0, Number(value) || 0)

  return (
    <div className="kd-screen" style={{ zIndex: 6 }}>
      <div style={{ paddingTop: 'var(--safe-top)', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="kd-row" style={{ padding: '8px 12px 0', justifyContent: 'space-between' }}>
          <span className="kd-h2">เพิ่มอาหาร</span>
          <button className="kd-icon-btn" onClick={onClose} aria-label="ปิด">
            <Icon name="ph ph-x" size={22} />
          </button>
        </div>

        <div className="kd-row" style={{ padding: '8px 12px 12px', gap: 6, overflowX: 'auto' }}>
          {MEALS.map((m) => (
            <button
              key={m.id}
              className={`kd-chip${meal === m.id ? ' on' : ''}`}
              onClick={() => setMeal(m.id)}
            >
              <Icon name={m.icon} size={16} />
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderTop: '1px solid var(--border)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 0',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === t.id ? 'var(--accent-pressed)' : 'var(--text-muted)',
                fontSize: 12.5, fontWeight: tab === t.id ? 500 : 400,
              }}
            >
              <Icon name={t.icon} size={20} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="kd-scroll">
        {tab === 'recent' && (
          <div style={{ padding: '14px 16px', display: 'grid', gap: 14 }}>
            <div>
              <span className="kd-h2">รายการที่เพิ่งกิน</span>
              <p className="kd-caption kd-muted">แตะที่ปุ่ม + เพื่อบันทึกมื้อนี้ทันที</p>
            </div>
            {recents.length === 0 ? (
              <div className="kd-card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                ยังไม่มีรายการอาหารที่เพิ่งกิน ลองสแกนหรือค้นหาด้านบนได้เลย
              </div>
            ) : (
              recents.map((f) => (
                <FoodResultRow
                  key={f.id}
                  food={f}
                  onOpen={() => onPickFood(f.id, meal)}
                  onQuickAdd={() => onQuickAdd(f.id, meal)}
                />
              ))
            )}
          </div>
        )}

        {tab === 'search' && (
          <div style={{ padding: '14px 16px', display: 'grid', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <input
                ref={searchRef}
                className="kd-input"
                type="text"
                placeholder="พิมพ์ชื่ออาหาร หรือแบรนด์..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ paddingLeft: 40 }}
              />
              <Icon name="ph ph-magnifying-glass" size={20} style={{ position: 'absolute', left: 12, top: 16, color: 'var(--text-muted)' }} />
            </div>

            <div className="kd-row" style={{ gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={`kd-chip${filter === f.id ? ' on' : ''}`}
                  onClick={() => setFilter(f.id as any)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {results.map((f) => (
                <FoodResultRow
                  key={f.id}
                  food={f}
                  onOpen={() => onPickFood(f.id, meal)}
                  onQuickAdd={() => onQuickAdd(f.id, meal)}
                />
              ))}
              {searching && (
                <p className="kd-caption kd-muted" style={{ textAlign: 'center' }}>กำลังค้นหาในคลังอาหาร...</p>
              )}
              {!searching && !results.length && query.trim().length > 0 && (
                <p className="kd-caption kd-muted" style={{ textAlign: 'center' }}>
                  {online ? 'ไม่พบอาหารนี้ จดรายการเองได้ที่แท็บ "จดเอง"' : 'ออฟไลน์อยู่ ค้นได้เฉพาะรายการที่มีในเครื่อง'}
                </p>
              )}
            </div>
          </div>
        )}

        {tab === 'manual' && (
          <div className="kd-manual-entry">
            <div>
              <h2 className="kd-h2">จดรายการอาหารเอง</h2>
              <p className="kd-caption kd-muted">เหมือนจดบัญชี — ใส่เท่าที่รู้ ช่องสารอาหารและโน้ตเว้นไว้ได้</p>
            </div>

            <label><span className="kd-field-label">ชื่ออาหาร</span><input className="kd-input" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="เช่น ข้าวสวยร้านประจำ" autoFocus /></label>

            <div className="kd-manual-two-col">
              <label><span className="kd-field-label">จำนวนที่กิน</span><input className="kd-input tnum" type="number" inputMode="decimal" min="0.1" max="100" step="0.1" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} /></label>
              <label><span className="kd-field-label">หน่วย</span><input className="kd-input" value={manualUnit} onChange={(e) => setManualUnit(e.target.value)} placeholder="จาน / ถ้วย / ชิ้น" /></label>
            </div>

            <label><span className="kd-field-label">แคลอรีต่อ 1 {manualUnit.trim() || 'หน่วย'}</span><div className="kd-input-with-unit"><input className="kd-input tnum" type="number" inputMode="numeric" min="0" max="10000" value={manualKcal} onChange={(e) => setManualKcal(e.target.value)} placeholder="เช่น 240" /><span>kcal</span></div></label>

            <div className="kd-card kd-manual-calculator">
              <div><Icon name="ph ph-calculator" size={23} /><span>ตัวช่วยคำนวณ</span></div>
              <p className="tnum">{manualAmount || '0'} {manualUnit.trim() || 'หน่วย'} × {manualKcal || '0'} kcal</p>
              <strong className="tnum">รวม {num(manualTotal)} kcal</strong>
            </div>

            <details className="kd-details kd-manual-details">
              <summary>สารอาหารและบันทึกเพิ่มเติม</summary>
              <div className="kd-manual-three-col">
                {[['โปรตีน', manualProtein, setManualProtein], ['คาร์บ', manualCarb, setManualCarb], ['ไขมัน', manualFat, setManualFat]].map(([label, value, setter]) => (
                  <label key={label as string}><span className="kd-field-label">{label as string} (ก.)</span><input className="kd-input tnum" type="number" inputMode="decimal" min="0" value={value as string} onChange={(e) => (setter as (value: string) => void)(e.target.value)} placeholder="–" /></label>
                ))}
              </div>
              <label><span className="kd-field-label">โน้ต</span><textarea className="kd-input kd-manual-note" value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="เช่น กินครึ่งจาน, ไม่ใส่น้ำมัน, สูตรของที่บ้าน" maxLength={240} /></label>
            </details>

            <button className="kd-btn kd-btn-primary" disabled={!manualValid} onClick={() => onManualAdd({
              meal, name: manualName.trim(), amount: manualQty, unitLabel: manualUnit.trim() || 'หน่วย', kcal: manualTotal,
              protein: optionalNumber(manualProtein), carb: optionalNumber(manualCarb), fat: optionalNumber(manualFat), note: manualNote.trim() || undefined,
            })}>
              <Icon name="ph ph-notebook" size={20} /> บันทึกรายการ · {num(manualTotal)} kcal
            </button>
          </div>
        )}

        {tab === 'scan' && (
          <div style={{ position: 'relative', minHeight: 400, background: '#000', color: '#fff', padding: 16 }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: 260, objectFit: 'cover', borderRadius: 16 }} />

            <div className="kd-row" style={{ justifyContent: 'space-between', margin: '10px 0' }}>
              <span className="kd-caption" style={{ color: '#aaa' }}>
                {scan === 'fetching' ? 'กำลังค้นหาข้อมูลสินค้า...' : 'เล็งไปที่บาร์โค้ด หรือพิมพ์ระบุ'}
              </span>
              {scanCount > 0 && (
                <span className="kd-caption tnum" style={{ background: 'var(--accent-tint)', color: 'var(--on-tint)', padding: '4px 10px', borderRadius: 999 }}>
                  สแกนเพิ่มไปแล้ว {scanCount} ชิ้น
                </span>
              )}
            </div>

            <div style={{ margin: '10px 0', display: 'grid', gap: 10 }}>
              <div className="kd-row" style={{ gap: 8 }}>
                <input
                  className="kd-input"
                  type="text"
                  placeholder="พิมพ์เลขบาร์โค้ดที่นี่..."
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                />
                <button className="kd-btn kd-btn-primary" style={{ width: 'auto', minWidth: 90 }} onClick={() => handleBarcodeLookup(manualBarcode)}>
                  ค้นหา
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'photo' && (
          <div style={{ padding: '24px 16px', textAlign: 'center', display: 'grid', gap: 16 }}>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhotoUpload} />

            <div style={{ width: 80, height: 80, borderRadius: 24, background: 'var(--accent-tint)', margin: '0 auto', display: 'grid', placeItems: 'center' }}>
              <Icon name="ph ph-camera" size={36} color="var(--accent-pressed)" />
            </div>

            <div>
              <h2 className="kd-h2">ช่วยหาเมนูจากรูปอาหาร</h2>
              <p className="kd-body kd-muted" style={{ marginTop: 4 }}>
                ระบบจะแนะนำเมนูจากคลังอาหาร คุณเป็นคนเลือกและยืนยันก่อนบันทึกเสมอ
              </p>
            </div>

            <label className="kd-card" style={{ padding: 14, textAlign: 'left', display: 'flex', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={photoConsent}
                onChange={(event) => setPhotoConsent(event.target.checked)}
                style={{ width: 22, height: 22, flex: 'none', accentColor: 'var(--accent)' }}
              />
              <span>
                <span className="kd-body" style={{ display: 'block', fontWeight: 500 }}>ยินยอมให้ส่งรูปนี้ไปวิเคราะห์ด้วย AI</span>
                <span className="kd-caption kd-muted" style={{ display: 'block', marginTop: 4 }}>
                  รูปจะถูกส่งไปยัง Google Gemini API และอาจประมวลผลนอกประเทศไทย KinDee ไม่เก็บไฟล์ต้นฉบับ โปรดถ่ายเฉพาะอาหารและหลีกเลี่ยงใบหน้า เอกสาร หรือข้อมูลส่วนตัว
                </span>
              </span>
            </label>

            <button className="kd-btn kd-btn-primary" onClick={() => fileInputRef.current?.click()} disabled={photoLoading || !photoConsent}>
              <Icon name="ph ph-aperture" size={20} />
              {photoLoading ? 'กำลังวิเคราะห์รูปภาพ...' : 'ถ่ายรูป / เลือกรูปภาพ'}
            </button>

            {photoError && !photoLoading && (
              <p className="kd-caption" role="alert" style={{ color: 'var(--status-over, #b3261e)', textAlign: 'left' }}>
                {photoError}
              </p>
            )}

            {photoCandidates && (
              <div style={{ textAlign: 'left', display: 'grid', gap: 10, marginTop: 16 }}>
                <h3 className="kd-h2">ผลการวิเคราะห์จาก AI:</h3>
                <p className="kd-caption kd-muted" style={{ marginTop: -6 }}>ค่าพลังงานเป็นค่าประมาณ ปรับปริมาณให้ตรงกับที่กินจริงก่อนบันทึก</p>
                {photoCandidates.map((c) => {
                  const portion = photoPortions[c.food_id] ?? 1
                  const setPortion = (next: number) =>
                    setPhotoPortions((all) => ({ ...all, [c.food_id]: Math.max(0.25, Math.min(4, next)) }))
                  const total = Math.round(c.kcal * portion)
                  return <div key={c.food_id} className="kd-card" style={{ padding: 12, display: 'grid', gap: 10 }}>
                    <div className="kd-row" style={{ justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 500 }}>{c.name_th}</div>
                      <div className="kd-caption kd-muted" style={{ flex: 'none' }}>มั่นใจ {Math.round(c.confidence * 100)}%</div>
                    </div>
                    <div className="kd-caption kd-muted">
                      โปรตีน {num(c.protein * portion)}g · คาร์บ {num(c.carb * portion)}g · ไขมัน {num(c.fat * portion)}g
                    </div>
                    <div className="kd-row" style={{ justifyContent: 'space-between', gap: 8 }}>
                      <div className="kd-row" style={{ gap: 6 }}>
                        <button className="kd-btn" aria-label="ลดปริมาณ" style={{ width: 36, minHeight: 36, padding: 0 }} onClick={() => setPortion(portion - 0.25)}>−</button>
                        <span style={{ minWidth: 56, textAlign: 'center' }}>{portion} ที่</span>
                        <button className="kd-btn" aria-label="เพิ่มปริมาณ" style={{ width: 36, minHeight: 36, padding: 0 }} onClick={() => setPortion(portion + 0.25)}>+</button>
                      </div>
                      <button className="kd-btn kd-btn-primary" style={{ width: 'auto', minHeight: 36, padding: '0 12px' }} onClick={() => onManualAdd({
                        meal, name: c.name_th, amount: portion, unitLabel: 'ที่', kcal: total,
                        protein: Math.round(c.protein * portion * 10) / 10,
                        carb: Math.round(c.carb * portion * 10) / 10,
                        fat: Math.round(c.fat * portion * 10) / 10,
                        note: 'บันทึกจากรูปภาพ',
                      })}>
                        {num(total)} kcal · บันทึก
                      </button>
                    </div>
                  </div>
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
