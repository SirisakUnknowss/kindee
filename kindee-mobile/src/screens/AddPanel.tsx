import { CameraView, Camera, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { Button, Card, Checkbox, Chip, Field, Icon, IconButton, QualityBadge, Row, Screen, Thumb } from '../components/ui'
import { FILTERS, FOODS, registerRuntimeFood, type Food, type FoodCat } from '../data/foods'
import { MEALS, num } from '../lib/calc'
import { commit, db } from '../lib/db'
import { useStore } from '../lib/store'
import { API_BASE, supabase } from '../lib/supabase'
import { normalizeThai } from '../lib/thai'
import type { Meal } from '../lib/types'
import { C, T } from '../theme'

type Tab = 'recent' | 'favorite' | 'search' | 'manual' | 'scan'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'recent', label: 'ล่าสุด', icon: 'ph ph-clock-counter-clockwise' },
  { id: 'favorite', label: 'โปรด', icon: 'ph ph-heart' },
  { id: 'search', label: 'ค้นหา', icon: 'ph ph-magnifying-glass' },
  { id: 'manual', label: 'จดเอง', icon: 'ph ph-pencil-simple' },
  { id: 'scan', label: 'สแกน', icon: 'ph ph-barcode' },
]

type ManualDraft = {
  name: string; amount: string; unit: string; kcal: string
  protein: string; carb: string; fat: string; note: string; saveAsFavorite: boolean
}
const emptyManualDraft = (): ManualDraft => ({ name: '', amount: '1', unit: 'จาน', kcal: '', protein: '', carb: '', fat: '', note: '', saveAsFavorite: false })

type ManualPayload = {
  meal: Meal; name: string; amount: number; unitLabel: string; kcal: number
  protein?: number; carb?: number; fat?: number; note?: string; saveAsFavorite?: boolean
}

const ZOOM_LEVELS = [{ label: '1x', value: 0 }, { label: '2x', value: 0.08 }, { label: '5x', value: 0.2 }] as const

function FoodResultRow({ food, onOpen, onQuickAdd }: { food: Food; onOpen: () => void; onQuickAdd: () => void }) {
  const packaged = food.kind === 'pack'
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingLeft: 12, paddingRight: 4, gap: 4 }}>
      <Pressable onPress={onOpen} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Thumb food={food} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ fontSize: 15, lineHeight: 22, color: C.text }}>{food.name}</Text>
          <Text style={[T.caption, T.muted]}>{packaged ? `${food.brand} · ${food.pack}` : `อาหารปรุงสำเร็จ · 1 ${food.units[0].label}`}</Text>
          <QualityBadge q={food.q} />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[{ fontSize: 15, fontWeight: '500', color: C.text }, T.tnum]}>{num(food.kcal)}</Text>
          <Text style={[T.caption, T.muted]}>{packaged ? 'ต่อหน่วยบรรจุ' : `ต่อ ${food.units[0].label}`}</Text>
        </View>
      </Pressable>
      <IconButton name="ph ph-plus" size={20} color={C.accentPressed} label={`บันทึก ${food.name} ทันที`} onPress={onQuickAdd} />
    </Card>
  )
}

function EmptyNote({ children }: { children: string }) {
  return <Card style={{ padding: 24, alignItems: 'center' }}><Text style={{ color: C.muted, textAlign: 'center' }}>{children}</Text></Card>
}

export function AddPanel({ initialTab, initialMeal, onClose, onPickFood, onQuickAdd, onManualAdd, onManualAddMany }: {
  initialTab: Tab
  initialMeal: Meal
  onClose: () => void
  onPickFood: (foodId: string, meal: Meal) => void
  onQuickAdd: (foodId: string, meal: Meal) => void
  onManualAdd: (entry: ManualPayload) => void
  onManualAddMany?: (entries: ManualPayload[]) => void
}) {
  const { entries, online, showToast, favorites, logFavorite, removeFavorite } = useStore()
  const [tab, setTab] = useState<Tab>(initialTab === ('photo' as Tab) ? 'search' : initialTab)
  const [meal, setMeal] = useState<Meal>(initialMeal)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | FoodCat>('all')
  const [manualItems, setManualItems] = useState<ManualDraft[]>([emptyManualDraft()])

  // Scan state
  const [permission, requestPermission] = useCameraPermissions()
  const [scan, setScan] = useState<'aiming' | 'fetching' | 'notfound'>('aiming')
  const [scanCount, setScanCount] = useState(0)
  const [manualBarcode, setManualBarcode] = useState('')
  const [zoom, setZoom] = useState<number>(0)
  const [galleryScanning, setGalleryScanning] = useState(false)
  const lastDetected = useRef<{ code: string; at: number } | null>(null)
  const scanningRef = useRef(false)

  // Catalogue search state
  const [remoteIds, setRemoteIds] = useState<string[]>([])
  const [searching, setSearching] = useState(false)

  const handleBarcodeLookup = async (code: string) => {
    if (!code || scanningRef.current) return
    if (!online) {
      db.scanQueue.push({ barcode: code, scanned_at: new Date().toISOString() })
      commit()
      setScanCount((c) => c + 1)
      setScan('aiming')
      return showToast('เก็บบาร์โค้ดไว้แล้ว จะค้นหาให้เมื่อกลับมาออนไลน์')
    }
    scanningRef.current = true
    setScan('fetching')
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8_000)
      const res = await fetch(`${API_BASE}/api/barcode/${encodeURIComponent(code)}`, { signal: controller.signal })
      clearTimeout(timeout)
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
          kcal: Math.round((kcal100g * packageGrams) / 100),
          protein: (Number(data.food.protein_100g ?? 0) * packageGrams) / 100,
          carb: (Number(data.food.carb_100g ?? 0) * packageGrams) / 100,
          fat: (Number(data.food.fat_100g ?? 0) * packageGrams) / 100,
          kind: 'pack', cat: 'store', q: data.food.quality === 'verified' ? 'verified' : 'open',
          icon: 'ph ph-package', units: [{ label: 'ทั้งบรรจุภัณฑ์', f: 1 }, { label: 'ครึ่งหนึ่ง', f: 0.5 }],
        })
        showToast(`เจอสินค้า: ${runtime.name}`)
        onPickFood(runtime.id, meal)
        setScanCount((c) => c + 1)
        setScan('aiming')
      } else {
        setScan('notfound')
        showToast('ไม่พบสินค้าชิ้นนี้ในระบบ ลองพิมพ์เลขบาร์โค้ดหรือจดเองแทน')
      }
    } catch {
      setScan('notfound')
      showToast('ค้นหาไม่สำเร็จ เชื่อมต่อช้าหรือขาดหาย ลองใหม่อีกครั้ง')
    } finally {
      scanningRef.current = false
    }
  }

  // Ask for the camera only after the user opens the Scan tab.
  useEffect(() => {
    if (tab === 'scan' && permission && !permission.granted && permission.canAskAgain) void requestPermission()
  }, [tab, permission, requestPermission])

  const onBarcode = ({ data }: { data: string }) => {
    if (scanningRef.current || !data) return
    const previous = lastDetected.current
    if (previous?.code === data && Date.now() - previous.at < 2_000) return
    lastDetected.current = { code: data, at: Date.now() }
    void handleBarcodeLookup(data)
  }

  // Small, glossy or damaged barcodes are easier to read from a cropped gallery photo.
  const pickBarcodeFromGallery = async () => {
    setGalleryScanning(true)
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
      if (picked.canceled || !picked.assets[0]) return
      const results = await Camera.scanFromURLAsync(picked.assets[0].uri)
      if (results[0]?.data) void handleBarcodeLookup(results[0].data)
      else showToast('อ่านบาร์โค้ดจากรูปนี้ไม่ได้ ลองถ่ายให้ชัดขึ้นหรือพิมพ์เลขแทน')
    } catch {
      showToast('อ่านบาร์โค้ดจากรูปนี้ไม่ได้ ลองถ่ายให้ชัดขึ้นหรือพิมพ์เลขแทน')
    } finally {
      setGalleryScanning(false)
    }
  }

  // The bundled catalogue answers instantly and offline; the database adds the rest once the query settles.
  useEffect(() => {
    const term = query.trim()
    if (!supabase || !online || term.length < 2) {
      setRemoteIds([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      const { data, error } = await supabase!.rpc('search_foods', { q: term, cat: filter === 'all' ? null : filter, lim: 30 })
      if (cancelled) return
      setSearching(false)
      if (error || !Array.isArray(data)) return setRemoteIds([])
      const { data: portions } = await supabase!
        .from('food_portions').select('food_id,label_th')
        .in('food_id', data.map((row: { id: string }) => row.id)).eq('is_default', true)
      if (cancelled) return
      const labels = new Map<string, string>((portions ?? []).map((p: { food_id: string; label_th: string }) => [p.food_id, p.label_th]))
      setRemoteIds(data.map((row: Record<string, unknown>) => {
        const id = String(row.id)
        const grams = Number(row.serving_size_g) || 100
        const per = (value: unknown) => Math.round(((Number(value) || 0) * grams) / 100 * 10) / 10
        const label = labels.get(id) ?? 'ที่'
        return registerRuntimeFood({
          id,
          name: String(row.name_th),
          kind: 'dish',
          cat: (FILTERS.some((f) => f.id === row.category) ? row.category : 'dish') as FoodCat,
          kcal: Math.round((Number(row.kcal_100g) * grams) / 100),
          protein: per(row.protein_100g), carb: per(row.carb_100g), fat: per(row.fat_100g),
          q: row.quality === 'verified' ? 'verified' : 'open',
          icon: 'ph ph-bowl-food',
          units: [{ label, f: 1 }, { label: `ครึ่ง${label}`, f: 0.5 }, { label: 'ต่อ 100 ก.', f: Math.round((100 / grams) * 100) / 100 }],
        }).id
      }))
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, filter, online])

  const results = useMemo(() => {
    const q = normalizeThai(query)
    const remoteIdSet = new Set(remoteIds)
    const local = FOODS.filter((f) => {
      if (remoteIdSet.has(f.id)) return false
      const catOk = filter === 'all' || f.cat === filter
      return catOk && (!q || normalizeThai(`${f.name} ${f.brand ?? ''}`).includes(q))
    }).slice(0, 80)
    const localNames = new Set(local.map((f) => normalizeThai(f.name)))
    const remote = remoteIds
      .map((id) => FOODS.find((f) => f.id === id))
      .filter((f): f is Food => Boolean(f) && !localNames.has(normalizeThai(f!.name)))
    return [...local, ...remote]
  }, [query, filter, remoteIds])

  const recents = useMemo(() => {
    const ids = Array.from(new Set(entries.map((e) => e.foodId))).filter((id) => id !== 'custom')
    return ids.map((id) => FOODS.find((f) => f.id === id)).filter(Boolean) as Food[]
  }, [entries])

  const optionalNumber = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Number(v) || 0))
  const manualCalc = (d: ManualDraft) => {
    const qty = Number(d.amount)
    const perUnit = Number(d.kcal)
    const total = Number.isFinite(qty) && Number.isFinite(perUnit) ? Math.round(qty * perUnit) : 0
    const valid = d.name.trim().length > 0 && qty > 0 && qty <= 100 && perUnit >= 0 && perUnit <= 10_000 && total <= 10_000
    return { qty, perUnit, total, valid }
  }
  const updateManual = (i: number, patch: Partial<ManualDraft>) => setManualItems((items) => items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const manualValid = manualItems.filter((it) => manualCalc(it).valid)
  const manualGrand = manualValid.reduce((s, it) => s + manualCalc(it).total, 0)

  const submitManual = () => {
    const payload: ManualPayload[] = manualValid.map((d) => {
      const c = manualCalc(d)
      return {
        meal, name: d.name.trim(), amount: c.qty, unitLabel: d.unit.trim() || 'หน่วย', kcal: c.total,
        protein: optionalNumber(d.protein), carb: optionalNumber(d.carb), fat: optionalNumber(d.fat),
        note: d.note.trim() || undefined, saveAsFavorite: d.saveAsFavorite,
      }
    })
    if (payload.length === 1) onManualAdd(payload[0])
    else if (onManualAddMany) onManualAddMany(payload)
    else payload.forEach(onManualAdd)
  }

  return (
    <Screen style={{ position: 'absolute', inset: 0, zIndex: 6 }}>
      <View style={{ backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Row style={{ paddingHorizontal: 12, paddingTop: 8, justifyContent: 'space-between' }}>
          <Text style={T.h2}>เพิ่มอาหาร</Text>
          <IconButton name="ph ph-x" label="ปิด" onPress={onClose} />
        </Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, gap: 6 }}>
          {MEALS.map((m) => <Chip key={m.id} icon={m.icon} on={meal === m.id} onPress={() => setMeal(m.id)}>{m.label}</Chip>)}
        </ScrollView>
        <Row style={{ borderTopWidth: 1, borderTopColor: C.border }}>
          {TABS.map((t) => (
            <Pressable key={t.id} onPress={() => setTab(t.id)} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }}
              style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: tab === t.id ? C.accent : 'transparent' }}>
              <Icon name={t.icon} size={20} color={tab === t.id ? C.accentPressed : C.muted} />
              <Text style={{ fontSize: 12.5, color: tab === t.id ? C.accentPressed : C.muted, fontWeight: tab === t.id ? '500' : '400' }}>{t.label}</Text>
            </Pressable>
          ))}
        </Row>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          {tab === 'recent' && (
            <View style={{ padding: 16, gap: 14 }}>
              <View>
                <Text style={T.h2}>รายการที่เพิ่งกิน</Text>
                <Text style={[T.caption, T.muted]}>แตะที่ปุ่ม + เพื่อบันทึกมื้อนี้ทันที</Text>
              </View>
              {recents.length === 0
                ? <EmptyNote>ยังไม่มีรายการอาหารที่เพิ่งกิน ลองสแกนหรือค้นหาด้านบนได้เลย</EmptyNote>
                : recents.map((f) => <FoodResultRow key={f.id} food={f} onOpen={() => onPickFood(f.id, meal)} onQuickAdd={() => onQuickAdd(f.id, meal)} />)}
            </View>
          )}

          {tab === 'favorite' && (
            <View style={{ padding: 16, gap: 14 }}>
              <View>
                <Text style={T.h2}>เมนูโปรด</Text>
                <Text style={[T.caption, T.muted]}>แตะการ์ดเพื่อบันทึกเมนูนี้ทันที ไม่ต้องพิมพ์ใหม่</Text>
              </View>
              {favorites.length === 0
                ? <EmptyNote>ยังไม่มีเมนูโปรด กดปุ่ม "บันทึกเป็นเมนูโปรด" ตอนจดเองเพื่อเพิ่มที่นี่</EmptyNote>
                : favorites.map((f) => (
                  <Card key={f.uid} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingLeft: 12, paddingRight: 4 }}>
                    <Pressable
                      accessibilityRole="button"
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                      onPress={() => {
                        const entry = logFavorite(f.uid, meal)
                        if (entry) { onClose(); showToast(`จด ${f.name} แล้ว ${num(entry.kcal)} kcal`, { undoUid: entry.uid }) }
                      }}
                    >
                      <Icon name="ph ph-heart" size={22} color={C.accentPressed} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={2} style={{ fontSize: 15, lineHeight: 22, color: C.text }}>{f.name}</Text>
                        <Text style={[T.caption, T.muted]}>{f.amount} {f.unit}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[{ fontSize: 15, fontWeight: '500', color: C.text }, T.tnum]}>{num(f.kcal)}</Text>
                        <Text style={[T.caption, T.muted]}>kcal</Text>
                      </View>
                    </Pressable>
                    <IconButton name="ph ph-trash" size={20} color={C.statusOver} label={`ลบ ${f.name} ออกจากเมนูโปรด`} onPress={() => removeFavorite(f.uid)} />
                  </Card>
                ))}
            </View>
          )}

          {tab === 'search' && (
            <View style={{ padding: 16, gap: 14 }}>
              <View>
                <Field value={query} onChangeText={setQuery} placeholder="พิมพ์ชื่ออาหาร หรือแบรนด์..." autoFocus returnKeyType="search" style={{ paddingLeft: 42 }} />
                <View style={{ position: 'absolute', left: 13, top: 16 }}><Icon name="ph ph-magnifying-glass" size={20} color={C.muted} /></View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {FILTERS.map((f) => <Chip key={f.id} on={filter === f.id} onPress={() => setFilter(f.id)}>{f.label}</Chip>)}
              </ScrollView>
              <View style={{ gap: 10 }}>
                {results.map((f) => <FoodResultRow key={f.id} food={f} onOpen={() => onPickFood(f.id, meal)} onQuickAdd={() => onQuickAdd(f.id, meal)} />)}
                {searching && <Text style={[T.caption, T.muted, { textAlign: 'center' }]}>กำลังค้นหาในคลังอาหาร...</Text>}
                {!searching && !results.length && query.trim().length > 0 && (
                  <View style={{ gap: 8, alignItems: 'center', paddingVertical: 8 }}>
                    <Text style={[T.caption, T.muted, { textAlign: 'center' }]}>
                      {online ? `ยังไม่มี "${query.trim()}" ในคลังอาหาร` : 'ออฟไลน์อยู่ ค้นได้เฉพาะรายการที่มีในเครื่อง'}
                    </Text>
                    <Button
                      variant="outline" style={{ minHeight: 44 }}
                      icon={<Icon name="ph ph-pencil-simple" size={18} color={C.accentPressed} />}
                      onPress={() => {
                        setManualItems((items) => { const next = [...items]; next[next.length - 1] = { ...next[next.length - 1], name: query.trim() }; return next })
                        setTab('manual')
                      }}
                    >
                      {`จดเองเป็น "${query.trim()}"`}
                    </Button>
                  </View>
                )}
              </View>
            </View>
          )}

          {tab === 'manual' && (
            <View style={{ padding: 16, gap: 14 }}>
              <View>
                <Text style={T.h2}>จดรายการอาหารเอง</Text>
                <Text style={[T.caption, T.muted]}>เหมือนจดบัญชี — เพิ่มได้หลายจาน ใส่เท่าที่รู้ ช่องสารอาหารและโน้ตเว้นไว้ได้</Text>
              </View>
              {manualItems.map((d, i) => {
                const c = manualCalc(d)
                return (
                  <Card key={i} style={{ padding: 14, gap: 12 }}>
                    {manualItems.length > 1 && (
                      <Row style={{ justifyContent: 'space-between' }}>
                        <Text style={[T.caption, T.muted]}>รายการที่ {i + 1}</Text>
                        <IconButton name="ph ph-x" size={18} label="ลบรายการนี้" onPress={() => setManualItems((items) => items.filter((_, idx) => idx !== i))} />
                      </Row>
                    )}
                    <Field label="ชื่ออาหาร" value={d.name} onChangeText={(t) => updateManual(i, { name: t })} placeholder="เช่น ข้าวสวยร้านประจำ" />
                    <Row style={{ gap: 10, alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}><Field label="จำนวนที่กิน" keyboardType="decimal-pad" value={d.amount} onChangeText={(t) => updateManual(i, { amount: t })} /></View>
                      <View style={{ flex: 1 }}><Field label="หน่วย" value={d.unit} onChangeText={(t) => updateManual(i, { unit: t })} placeholder="จาน / ถ้วย / ชิ้น" /></View>
                    </Row>
                    <Field label={`แคลอรีต่อ 1 ${d.unit.trim() || 'หน่วย'} (kcal)`} keyboardType="number-pad" value={d.kcal} onChangeText={(t) => updateManual(i, { kcal: t })} placeholder="เช่น 240" />
                    <View style={{ backgroundColor: C.accentTintSoft, borderRadius: 12, padding: 12, gap: 2 }}>
                      <Row style={{ gap: 8 }}><Icon name="ph ph-calculator" size={20} color={C.accentPressed} /><Text style={[T.label, { color: C.bodyAlt }]}>ตัวช่วยคำนวณ</Text></Row>
                      <Text style={[T.body, T.tnum, { color: C.bodyAlt }]}>{d.amount || '0'} {d.unit.trim() || 'หน่วย'} × {d.kcal || '0'} kcal</Text>
                      <Text style={[{ fontSize: 16, fontWeight: '500', color: C.text }, T.tnum]}>รวม {num(c.total)} kcal</Text>
                    </View>
                    <Row style={{ gap: 8, alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}><Field label="โปรตีน (ก.)" keyboardType="decimal-pad" value={d.protein} onChangeText={(t) => updateManual(i, { protein: t })} placeholder="–" /></View>
                      <View style={{ flex: 1 }}><Field label="คาร์บ (ก.)" keyboardType="decimal-pad" value={d.carb} onChangeText={(t) => updateManual(i, { carb: t })} placeholder="–" /></View>
                      <View style={{ flex: 1 }}><Field label="ไขมัน (ก.)" keyboardType="decimal-pad" value={d.fat} onChangeText={(t) => updateManual(i, { fat: t })} placeholder="–" /></View>
                    </Row>
                    <Field label="โน้ต" multiline maxLength={240} value={d.note} onChangeText={(t) => updateManual(i, { note: t })} placeholder="เช่น กินครึ่งจาน, ไม่ใส่น้ำมัน, สูตรของที่บ้าน" style={{ minHeight: 64 }} />
                    <Checkbox checked={d.saveAsFavorite} onChange={(v) => updateManual(i, { saveAsFavorite: v })}>
                      <Row style={{ gap: 4 }}><Icon name="ph ph-heart" size={16} color={C.text} /><Text style={T.caption}>บันทึกเป็นเมนูโปรด</Text></Row>
                    </Checkbox>
                  </Card>
                )
              })}
              <Button variant="outline" icon={<Icon name="ph ph-plus" size={18} color={C.accentPressed} />} onPress={() => setManualItems((items) => [...items, emptyManualDraft()])}>เพิ่มอีกรายการ</Button>
              <Button disabled={manualValid.length === 0} icon={<Icon name="ph ph-notebook" size={20} color="#fff" />} onPress={submitManual}>
                {`บันทึก${manualValid.length > 1 ? `ทั้งหมด ${manualValid.length} รายการ` : 'รายการ'} · ${num(manualGrand)} kcal`}
              </Button>
            </View>
          )}

          {tab === 'scan' && (
            <View style={{ backgroundColor: '#000', padding: 16, minHeight: 420 }}>
              {permission?.granted ? (
                <View>
                  <CameraView
                    style={{ width: '100%', height: 260, borderRadius: 16, overflow: 'hidden' }}
                    facing="back"
                    zoom={zoom}
                    autofocus="on"
                    barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
                    onBarcodeScanned={onBarcode}
                  />
                  <Row style={{ position: 'absolute', bottom: 10, alignSelf: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, padding: 4 }}>
                    {ZOOM_LEVELS.map((z) => (
                      <Pressable key={z.label} onPress={() => setZoom(z.value)} accessibilityRole="button" accessibilityLabel={`ซูม ${z.label}`}
                        style={{ width: 40, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: zoom === z.value ? '#fff' : 'transparent' }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: zoom === z.value ? '#000' : '#fff' }}>{z.label}</Text>
                      </Pressable>
                    ))}
                  </Row>
                </View>
              ) : (
                <View style={{ height: 260, borderRadius: 16, backgroundColor: C.cam, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 }}>
                  <Icon name="ph ph-camera" size={32} color="#b2b6ca" />
                  <Text style={{ color: '#e9e9ed', textAlign: 'center' }}>ต้องอนุญาตให้ใช้กล้องเพื่อสแกนบาร์โค้ด</Text>
                  <Text style={{ color: '#b2b6ca', textAlign: 'center', fontSize: 12.5 }}>หรือพิมพ์เลขบาร์โค้ด / เลือกรูปจากแกลเลอรีด้านล่างก็ได้</Text>
                  {permission && !permission.canAskAgain
                    ? <Button variant="plain" style={{ minHeight: 44 }} onPress={() => void Linking.openSettings()}>เปิดการตั้งค่า</Button>
                    : <Button variant="plain" style={{ minHeight: 44 }} onPress={() => void requestPermission()}>อนุญาตใช้กล้อง</Button>}
                </View>
              )}

              <Row style={{ justifyContent: 'space-between', marginVertical: 10 }}>
                <Row style={{ gap: 6 }}>
                  {scan === 'fetching' && <ActivityIndicator size="small" color="#aaa" />}
                  <Text style={[T.caption, { color: '#aaa' }]}>{scan === 'fetching' ? 'กำลังค้นหาข้อมูลสินค้า...' : 'เล็งไปที่บาร์โค้ด หรือพิมพ์ระบุ'}</Text>
                </Row>
                {scanCount > 0 && (
                  <Text style={[T.caption, T.tnum, { backgroundColor: C.accentTint, color: C.onTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' }]}>สแกนเพิ่มไปแล้ว {scanCount} ชิ้น</Text>
                )}
              </Row>

              <View style={{ gap: 10 }}>
                <Row style={{ gap: 8 }}>
                  <View style={{ flex: 1 }}><Field value={manualBarcode} onChangeText={setManualBarcode} keyboardType="number-pad" placeholder="พิมพ์เลขบาร์โค้ดที่นี่..." /></View>
                  <Button style={{ width: 90 }} onPress={() => void handleBarcodeLookup(manualBarcode.trim())}>ค้นหา</Button>
                </Row>
                <Button
                  variant="plain" loading={galleryScanning}
                  style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'transparent' }}
                  icon={<Icon name="ph ph-image" size={18} color="#fff" />}
                  onPress={pickBarcodeFromGallery}
                >
                  <Text style={{ color: '#fff', fontSize: 15.5, fontWeight: '500' }}>{galleryScanning ? 'กำลังอ่านบาร์โค้ด...' : 'เลือกภาพบาร์โค้ดจากแกลเลอรี'}</Text>
                </Button>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

export type { Tab as AddTab }
