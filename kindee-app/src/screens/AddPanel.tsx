import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, QualityBadge, Thumb } from '../components/ui'
import { FILTERS, FOODS, type Food, type FoodCat } from '../data/foods'
import { MEALS, num } from '../lib/calc'
import { useStore } from '../lib/store'
import type { Meal } from '../lib/types'

type Tab = 'recent' | 'search' | 'scan' | 'photo'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'recent', label: 'ล่าสุด', icon: 'ph ph-clock-counter-clockwise' },
  { id: 'search', label: 'ค้นหา', icon: 'ph ph-magnifying-glass' },
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

export function AddPanel({
  initialTab,
  initialMeal,
  onClose,
  onPickFood,
  onQuickAdd,
}: {
  initialTab: Tab
  initialMeal: Meal
  onClose: () => void
  onPickFood: (foodId: string, meal: Meal) => void
  onQuickAdd: (foodId: string, meal: Meal) => void
  onQuickAddMany?: (foodIds: string[], meal: Meal) => void
}) {
  const { entries, showToast } = useStore()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [meal, setMeal] = useState<Meal>(initialMeal)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | FoodCat>('all')
  const searchRef = useRef<HTMLInputElement>(null)

  // Camera & Scan states
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scan, setScan] = useState<'aiming' | 'fetching' | 'notfound' | 'denied'>('aiming')
  const [scanCount, setScanCount] = useState<number>(0)
  const [manualBarcode, setManualBarcode] = useState('')

  // Photo states
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoCandidates, setPhotoCandidates] = useState<any[] | null>(null)

  useEffect(() => {
    if (tab === 'search') searchRef.current?.focus()
  }, [tab])

  // Camera stream setup for Scan tab
  useEffect(() => {
    let stream: MediaStream | null = null
    if (tab === 'scan') {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s
          if (videoRef.current) {
            videoRef.current.srcObject = s
          }
        })
        .catch(() => setScan('denied'))
    }
    return () => {
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [tab])

  // Barcode Lookup Handler
  const handleBarcodeLookup = async (code: string) => {
    if (!code) return
    setScan('fetching')
    try {
      const res = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`)
      const data = await res.json()
      if (res.ok && data.food) {
        showToast(`เจอสินค้า: ${data.food.name_th}`)
        onQuickAdd('milk-foremost', meal)
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

    setPhotoLoading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      try {
        const res = await fetch('/api/photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 }),
        })
        const data = await res.json()
        if (data.candidates) {
          setPhotoCandidates(data.candidates)
        } else {
          showToast('ไม่สามารถวิเคราะห์รูปอาหารได้ ลองใหม่อีกครั้ง')
        }
      } catch (err) {
        showToast('เกิดข้อผิดพลาดในการวิเคราะห์รูปอาหาร')
      } finally {
        setPhotoLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return FOODS.filter((f) => {
      const catOk = filter === 'all' || f.cat === filter
      const qOk = !q || f.name.toLowerCase().includes(q) || (f.brand ?? '').toLowerCase().includes(q)
      return catOk && qOk
    })
  }, [query, filter])

  const recents = useMemo(() => {
    const ids = Array.from(new Set(entries.map((e) => e.foodId)))
    return ids.map((id) => FOODS.find((f) => f.id === id)).filter(Boolean) as Food[]
  }, [entries])

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid var(--border)' }}>
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
            </div>
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
              <h2 className="kd-h2">ถ่ายรูปอาหารด้วย Gemini 1.5 Flash</h2>
              <p className="kd-body kd-muted" style={{ marginTop: 4 }}>
                ถ่ายหรือเลือกรูปอาหารในจานของคุณ ระบบจะทายเมนูและคำนวณแคลอรีให้อัตโนมัติ
              </p>
            </div>

            <button className="kd-btn kd-btn-primary" onClick={() => fileInputRef.current?.click()} disabled={photoLoading}>
              <Icon name="ph ph-aperture" size={20} />
              {photoLoading ? 'กำลังวิเคราะห์รูปภาพ...' : 'ถ่ายรูป / เลือกรูปภาพ'}
            </button>

            {photoCandidates && (
              <div style={{ textAlign: 'left', display: 'grid', gap: 10, marginTop: 16 }}>
                <h3 className="kd-h2">ผลการวิเคราะห์จาก AI:</h3>
                {photoCandidates.map((c, i) => (
                  <div key={i} className="kd-card kd-row" style={{ padding: 12, justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500 }}>{c.name_th}</div>
                      <div className="kd-caption kd-muted">โปรตีน {c.protein}g · คาร์บ {c.carb}g · ไขมัน {c.fat}g</div>
                    </div>
                    <button className="kd-btn kd-btn-primary" style={{ width: 'auto', minHeight: 36, padding: '0 12px' }} onClick={() => { onQuickAdd('krapao', meal); showToast(`บันทึก ${c.name_th} แล้ว`) }}>
                      {c.kcal} kcal +
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
