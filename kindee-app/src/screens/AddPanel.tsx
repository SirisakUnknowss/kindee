import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, QualityBadge, Thumb } from '../components/ui'
import { FILTERS, FOODS, OFFLINE_COUNT, type Food, type FoodCat } from '../data/foods'
import { MEALS, mealLabel, num } from '../lib/calc'
import { useStore } from '../lib/store'
import type { Meal } from '../lib/types'

type Tab = 'recent' | 'search' | 'scan' | 'photo'
type ScanState = 'aiming' | 'fetching' | 'notfound' | 'denied'

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
  onQuickAddMany,
}: {
  initialTab: Tab
  initialMeal: Meal
  onClose: () => void
  onPickFood: (foodId: string, meal: Meal) => void
  onQuickAdd: (foodId: string, meal: Meal) => void
  onQuickAddMany: (foodIds: string[], meal: Meal) => void
}) {
  const { online, entries, addContribution, showToast } = useStore()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [meal, setMeal] = useState<Meal>(initialMeal)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [filter, setFilter] = useState<'all' | FoodCat>('all')
  const searchRef = useRef<HTMLInputElement>(null)

  // scan
  const [scan, setScan] = useState<ScanState>('aiming')
  const [scanCount, setScanCount] = useState(0)
  const [torch, setTorch] = useState(false)
  const [queue, setQueue] = useState<string[]>([])
  const [photoQuota] = useState(3)

  useEffect(() => {
    if (tab === 'search') searchRef.current?.focus()
  }, [tab])

  // debounce ~420ms
  useEffect(() => {
    if (!query.trim()) return setSearching(false)
    setSearching(true)
    const t = window.setTimeout(() => setSearching(false), 420)
    return () => window.clearTimeout(t)
  }, [query])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return FOODS.filter((f) => {
      const catOk = filter === 'all' || f.cat === filter
      const qOk = !q || f.name.toLowerCase().includes(q) || (f.brand ?? '').toLowerCase().includes(q)
      return catOk && qOk
    })
  }, [query, filter])

  const recentIds = useMemo(() => {
    const seen: string[] = []
    for (let i = entries.length - 1; i >= 0 && seen.length < 8; i--) {
      if (!seen.includes(entries[i].foodId)) seen.push(entries[i].foodId)
    }
    return seen.length ? seen : ['kaprao', 'cha-yen', 'khai-tom', 'banana', 'americano']
  }, [entries])

  const frequent = useMemo(() => recentIds.slice(0, 6).map((id) => FOODS.find((f) => f.id === id)!), [recentIds])

  const yesterdayIds = ['khao-man-kai', 'cha-yen']
  const yesterdayKcal = yesterdayIds.reduce((s, id) => s + FOODS.find((f) => f.id === id)!.kcal, 0)

  /**
   * ของจริง: <video> จาก getUserMedia + BarcodeDetector (fallback zxing-wasm)
   * ตรงนี้จำลองการตรวจจับด้วยการแตะกรอบเล็ง
   */
  const simulateDetect = (found: boolean) => {
    if (!online) {
      const code = String(8850000000000 + Math.floor(Math.random() * 999999))
      setQueue((q) => [...q, code])
      showToast('เก็บเลขบาร์โค้ดไว้แล้ว จะค้นให้เมื่อกลับมาออนไลน์')
      return
    }
    setScan('fetching')
    window.setTimeout(() => {
      if (found) {
        setScan('aiming')
        setScanCount((c) => c + 1)
        onPickFood('taokaenoi', meal)
      } else {
        setScan('notfound')
      }
    }, 700)
  }

  const panelHeader = (
    <div style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="kd-row" style={{ padding: '4px 8px', gap: 8 }}>
        <button className="kd-icon-btn" onClick={onClose} aria-label="ปิด">
          <Icon name="ph ph-x" size={22} />
        </button>
        <div className="kd-hscroll" style={{ flex: 1 }}>
          {MEALS.map((m) => (
            <button
              key={m.id}
              className={`kd-chip${meal === m.id ? ' on' : ''}`}
              aria-pressed={meal === m.id}
              onClick={() => setMeal(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="kd-row" style={{ gap: 6, padding: '0 12px 10px' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`kd-chip${tab === t.id ? ' on' : ''}`}
            style={{ flex: 1, borderRadius: 12, padding: '0 6px', fontSize: 13 }}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            <Icon name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="kd-screen kd-anim-panel" style={{ zIndex: 6 }}>
      {panelHeader}

      {tab === 'recent' && (
        <div className="kd-scroll" style={{ padding: '4px 16px 32px' }}>
          <h2 className="kd-h2" style={{ marginBottom: 8 }}>กินบ่อย</h2>
          <p className="kd-caption kd-muted" style={{ marginBottom: 10 }}>แตะครั้งเดียวบันทึกเลย ด้วยปริมาณที่เคยกินล่าสุด</p>
          <div className="kd-hscroll">
            {frequent.map((f) => (
              <button
                key={f.id}
                className="kd-card"
                style={{ width: 138, flex: 'none', padding: 12, textAlign: 'left' }}
                onClick={() => onQuickAdd(f.id, meal)}
              >
                <Thumb food={f} size={36} />
                <div className="kd-clamp2" style={{ fontSize: 13.5, lineHeight: 1.5, minHeight: 40, marginTop: 8 }}>
                  {f.name}
                </div>
                <div className="kd-caption kd-muted tnum">{num(f.kcal)} kcal · 1 {f.units[0].label}</div>
              </button>
            ))}
          </div>

          <h2 className="kd-h2" style={{ margin: '22px 0 8px' }}>มื้อ{mealLabel(meal)}เมื่อวาน</h2>
          <div className="kd-card" style={{ padding: 14 }}>
            {yesterdayIds.map((id) => {
              const f = FOODS.find((x) => x.id === id)!
              return (
                <div key={id} className="kd-row" style={{ justifyContent: 'space-between', gap: 12, padding: '4px 0' }}>
                  <span className="kd-body kd-clamp2">{f.name}</span>
                  <span className="kd-label kd-muted tnum">{num(f.kcal)} kcal</span>
                </div>
              )
            })}
            <button
              className="kd-btn kd-btn-outline"
              style={{ marginTop: 12, minHeight: 48 }}
              onClick={() => onQuickAddMany(yesterdayIds, meal)}
            >
              บันทึกทั้งมื้อ · {num(yesterdayKcal)} kcal
            </button>
          </div>

          <h2 className="kd-h2" style={{ margin: '22px 0 8px' }}>ล่าสุด</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {recentIds.map((id) => {
              const f = FOODS.find((x) => x.id === id)!
              return (
                <FoodResultRow
                  key={id}
                  food={f}
                  onOpen={() => onPickFood(f.id, meal)}
                  onQuickAdd={() => onQuickAdd(f.id, meal)}
                />
              )
            })}
          </div>
        </div>
      )}

      {tab === 'search' && (
        <>
          <div style={{ padding: '0 16px 10px' }}>
            <div style={{ position: 'relative' }}>
              <Icon
                name="ph ph-magnifying-glass"
                size={18}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: 12, top: 14 }}
              />
              <input
                ref={searchRef}
                className="kd-input"
                style={{ minHeight: 46, padding: '0 44px 0 38px' }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาอาหารหรือสินค้า"
                aria-label="ค้นหาอาหารหรือสินค้า"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="ล้างคำค้น"
                  style={{
                    position: 'absolute', right: 8, top: 8, width: 30, height: 30,
                    borderRadius: 999, background: 'var(--border)', display: 'grid', placeItems: 'center',
                  }}
                >
                  <Icon name="ph ph-x" size={14} />
                </button>
              )}
            </div>
            <div className="kd-hscroll" style={{ marginTop: 10 }}>
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={`kd-chip${filter === f.id ? ' on' : ''}`}
                  style={{ minHeight: 38 }}
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {!online && (
              <div className="kd-offline" style={{ borderRadius: 12, marginTop: 10 }} role="status">
                <Icon name="ph ph-wifi-slash" size={15} />
                ตอนนี้ค้นได้เฉพาะ {OFFLINE_COUNT} รายการที่เก็บไว้ในเครื่อง
              </div>
            )}
          </div>

          <div className="kd-scroll" style={{ padding: '0 16px 32px' }}>
            {searching ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {[0, 1, 2, 3].map((i) => <div key={i} className="kd-skel" style={{ height: 66, borderRadius: 16 }} />)}
              </div>
            ) : results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 8px', display: 'grid', gap: 12, justifyItems: 'center' }}>
                <Icon name="ph ph-magnifying-glass" size={36} color="var(--decor)" />
                <h2 className="kd-h2">ยังไม่เจอ “{query}”</h2>
                <p className="kd-body kd-muted" style={{ maxWidth: 280 }}>
                  ถ้าเป็นของในร้าน สแกนบาร์โค้ดหลังซองจะเจอง่ายกว่า หรือจะช่วยเพิ่มเข้าคลังเลยก็ได้
                </p>
                <div style={{ display: 'grid', gap: 10, width: '100%' }}>
                  <button className="kd-btn kd-btn-primary" onClick={() => setTab('scan')}>
                    <Icon name="ph ph-barcode" size={20} />
                    สแกนบาร์โค้ด
                  </button>
                  <button
                    className="kd-btn kd-btn-outline"
                    onClick={() => { addContribution(); showToast('ขอบคุณที่ช่วยเพิ่มนะ เดี๋ยวเราตรวจให้') }}
                  >
                    เพิ่มเอง
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {!query && <p className="kd-label kd-muted" style={{ marginBottom: 2 }}>หมวดยอดนิยมสำหรับมื้อ{mealLabel(meal)}</p>}
                {results.map((f) => (
                  <FoodResultRow
                    key={f.id}
                    food={f}
                    onOpen={() => onPickFood(f.id, meal)}
                    onQuickAdd={() => onQuickAdd(f.id, meal)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'scan' && (
        <div className="kd-cam">
          {scan === 'denied' ? (
            <div style={{ padding: 24, display: 'grid', gap: 12, placeContent: 'center', height: '100%', textAlign: 'center', justifyItems: 'center' }}>
              <Icon name="ph ph-camera-slash" size={40} color="var(--on-dark-muted)" />
              <h2 className="kd-h2" style={{ color: 'var(--on-dark)' }}>ยังเปิดกล้องไม่ได้</h2>
              <ol className="kd-body" style={{ color: 'var(--on-dark-muted)', textAlign: 'left', paddingLeft: 20 }}>
                <li>แตะไอคอนหน้าช่องที่อยู่เว็บ</li>
                <li>เลือก “การตั้งค่าเว็บไซต์”</li>
                <li>อนุญาตให้ใช้กล้อง แล้วกลับมาลองใหม่</li>
              </ol>
              <button className="kd-btn kd-btn-primary" onClick={() => setScan('aiming')}>ลองใหม่อีกครั้ง</button>
              <button className="kd-btn-text" style={{ color: 'var(--on-dark-accent)' }} onClick={() => setTab('search')}>
                กรอกเลขบาร์โค้ดเอง
              </button>
            </div>
          ) : (
            <>
              <div style={{ position: 'absolute', inset: 0, padding: 12, display: 'flex', flexDirection: 'column' }}>
                <div className="kd-row" style={{ justifyContent: 'space-between', zIndex: 2 }}>
                  <button
                    onClick={() => setTorch((t) => !t)}
                    aria-label="ไฟฉาย"
                    aria-pressed={torch}
                    style={{
                      width: 44, height: 44, borderRadius: 999, display: 'grid', placeItems: 'center',
                      background: torch ? 'var(--on-dark)' : 'rgba(255,255,255,.14)',
                      color: torch ? 'var(--cam)' : 'var(--on-dark)',
                    }}
                  >
                    <Icon name="ph ph-flashlight" size={20} />
                  </button>
                  {scanCount > 0 && (
                    <span
                      className="kd-caption tnum"
                      style={{ background: 'rgba(255,255,255,.14)', color: 'var(--on-dark)', borderRadius: 999, padding: '6px 12px' }}
                      role="status"
                    >
                      เพิ่มไปแล้ว {scanCount} ชิ้น
                    </span>
                  )}
                </div>

                <div style={{ flex: 1 }} />

                <div style={{ zIndex: 2, textAlign: 'center', display: 'grid', gap: 10, paddingBottom: 8 }}>
                  {scan === 'fetching' ? (
                    <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
                      <div className="kd-skel" style={{ width: 200, height: 14, background: 'var(--cam-skel)' }} />
                      <div className="kd-skel" style={{ width: 140, height: 14, background: 'var(--cam-skel)' }} />
                      <span className="kd-caption" style={{ color: 'var(--on-dark-muted)' }}>กำลังดึงข้อมูลสินค้า…</span>
                    </div>
                  ) : (
                    <p className="kd-body" style={{ color: 'var(--on-dark)' }}>เล็งไปที่บาร์โค้ดหลังซอง</p>
                  )}

                  {!online && queue.length > 0 && (
                    <div style={{ background: 'var(--cam-sheet)', borderRadius: 12, padding: 10, textAlign: 'left' }}>
                      <div className="kd-caption" style={{ color: 'var(--on-dark-accent)', marginBottom: 4 }}>
                        ออฟไลน์อยู่ · เก็บไว้ {queue.length} ชิ้น จะค้นให้เมื่อกลับมาออนไลน์
                      </div>
                      {queue.map((c) => (
                        <div key={c} className="kd-row tnum" style={{ justifyContent: 'space-between', color: 'var(--on-dark-muted)', fontSize: 12 }}>
                          <span>{c}</span>
                          <span>รอค้นหา</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="kd-row" style={{ gap: 8, justifyContent: 'center' }}>
                    <button
                      className="kd-btn"
                      style={{ background: 'var(--on-dark)', color: 'var(--cam)', minHeight: 46, width: 'auto', padding: '0 18px' }}
                      onClick={() => simulateDetect(true)}
                    >
                      จำลอง: สแกนเจอ
                    </button>
                    <button
                      className="kd-btn"
                      style={{ background: 'rgba(255,255,255,.14)', color: 'var(--on-dark)', minHeight: 46, width: 'auto', padding: '0 18px' }}
                      onClick={() => simulateDetect(false)}
                    >
                      จำลอง: ไม่พบ
                    </button>
                  </div>

                  <button className="kd-btn-text" style={{ color: 'var(--on-dark-accent)' }} onClick={() => setTab('search')}>
                    กรอกเลขบาร์โค้ดเอง
                  </button>
                  <button className="kd-btn-text" style={{ color: 'var(--on-dark-muted)', fontSize: 12 }} onClick={() => setScan('denied')}>
                    ดูสถานะ “ไม่ได้รับอนุญาตใช้กล้อง”
                  </button>
                </div>
              </div>

              <div className="kd-reticle" aria-hidden="true">
                <span className="tl" /><span className="tr" /><span className="bl" /><span className="br" />
                {scan === 'aiming' && <div className="kd-scanline" />}
              </div>
            </>
          )}

          {scan === 'notfound' && (
            <div
              className="kd-anim-sheet"
              style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                background: 'var(--cam-sheet)', color: 'var(--on-dark)',
                borderRadius: 'var(--r-sheet) var(--r-sheet) 0 0', padding: '16px 16px 20px',
                display: 'grid', gap: 10, zIndex: 3,
              }}
              role="dialog"
              aria-label="ไม่พบสินค้านี้ในคลัง"
            >
              <span className="kd-caption tnum" style={{ color: 'var(--on-dark-muted)' }}>8850123456789</span>
              <h2 className="kd-h2">ยังไม่มีสินค้านี้ในคลัง ช่วยเพิ่มหน่อยไหม?</h2>
              <p className="kd-body" style={{ color: 'var(--on-dark-muted)' }}>
                สินค้าไทยหลายอย่างยังไม่มีใครเพิ่มไว้ ถ้าถ่ายรูปฉลากให้ เราอ่านตัวเลขให้เองได้เลย
              </p>
              <button
                className="kd-btn kd-btn-primary"
                onClick={() => { addContribution(); setScan('aiming'); showToast('ขอบคุณที่ช่วยเพิ่มนะ เดี๋ยวเราตรวจให้') }}
              >
                <Icon name="ph ph-camera" size={20} />
                ถ่ายรูปฉลาก
              </button>
              <div className="kd-row" style={{ gap: 8 }}>
                <button
                  className="kd-btn"
                  style={{ border: '1px solid var(--cam-line)', color: 'var(--on-dark)' }}
                  onClick={() => { addContribution(); setScan('aiming'); showToast('บันทึกไว้ใช้เองแล้ว') }}
                >
                  กรอกเอง
                </button>
                <button
                  className="kd-btn"
                  style={{ border: '1px solid var(--cam-line)', color: 'var(--on-dark)' }}
                  onClick={() => { setScan('aiming'); setTab('search') }}
                >
                  ค้นด้วยชื่อ
                </button>
              </div>
              <button className="kd-btn-text" style={{ color: 'var(--on-dark-accent)' }} onClick={() => setScan('aiming')}>
                สแกนชิ้นอื่นต่อ
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'photo' && (
        <div className="kd-cam">
          <div style={{ position: 'absolute', inset: 0, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span
              className="kd-caption tnum"
              style={{ background: 'rgba(255,255,255,.14)', color: 'var(--on-dark)', borderRadius: 999, padding: '6px 12px' }}
            >
              เหลือ {photoQuota} ครั้งวันนี้
            </span>
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', width: '100%' }}>
              <div style={{ width: 250, height: 250, border: '2px dashed rgba(255,255,255,.35)', borderRadius: 18 }} />
            </div>
            <p className="kd-body" style={{ color: 'var(--on-dark)' }}>ถ่ายจากด้านบน ให้เห็นทั้งจาน</p>
            <p className="kd-caption" style={{ color: 'var(--on-dark-muted)', textAlign: 'center', maxWidth: 300 }}>
              วิธีนี้แม่นน้อยที่สุด ถ้าของมีบาร์โค้ด สแกนจะได้ตัวเลขตรงกว่า และต้องกดยืนยันผลทุกครั้ง
            </p>
            <div className="kd-row" style={{ gap: 24, alignItems: 'center', margin: '14px 0 6px' }}>
              <button className="kd-icon-btn" style={{ color: 'var(--on-dark)' }} aria-label="เลือกจากคลังภาพ">
                <Icon name="ph ph-images" size={24} />
              </button>
              <button
                aria-label="ถ่ายรูป"
                onClick={() => showToast('ส่งรูปให้ AI ช่วยทายแล้ว — ต้องกดยืนยันผลก่อนบันทึกเสมอ')}
                style={{ width: 66, height: 66, borderRadius: 999, background: 'var(--on-dark)', border: '4px solid rgba(255,255,255,.3)' }}
              />
              <div style={{ width: 44 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
