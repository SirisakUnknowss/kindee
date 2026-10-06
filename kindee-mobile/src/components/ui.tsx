import { MaterialCommunityIcons } from '@expo/vector-icons'
import type { ComponentProps, ReactNode } from 'react'
import {
  ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewProps, type ViewStyle,
} from 'react-native'
import { Image } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { QUALITY, type Food, type Quality } from '../data/foods'
import { num, ringColor, type RingTone } from '../lib/calc'
import { C, R, T } from '../theme'

type MciName = ComponentProps<typeof MaterialCommunityIcons>['name']

// Phosphor icon names (used by the shared food/meal data) -> MaterialCommunityIcons.
// Value is [outline, filled?].
const ICONS: Record<string, [MciName, MciName?]> = {
  aperture: ['camera-iris'],
  'arrow-right': ['arrow-right'],
  barbell: ['dumbbell'],
  barcode: ['barcode-scan'],
  'bowl-food': ['bowl-mix-outline', 'bowl-mix'],
  'bowl-steam': ['noodles'],
  calculator: ['calculator'],
  calendar: ['calendar-outline'],
  'calendar-dots': ['calendar-month-outline', 'calendar-month'],
  camera: ['camera-outline'],
  cellphone: ['cellphone'],
  'caret-left': ['chevron-left'],
  'caret-right': ['chevron-right'],
  carrot: ['carrot'],
  'chart-bar': ['chart-bar'],
  check: ['check'],
  'check-circle': ['check-circle-outline', 'check-circle'],
  circle: ['circle-outline'],
  'circle-notch': ['loading'],
  'clock-counter-clockwise': ['history'],
  'cloud-arrow-up': ['cloud-upload-outline'],
  'cloud-x': ['cloud-off-outline'],
  coffee: ['coffee-outline'],
  cookie: ['cookie-outline'],
  crown: ['crown-outline'],
  desktop: ['desktop-classic'],
  'download-simple': ['download'],
  drop: ['water-outline'],
  egg: ['egg-outline'],
  'envelope-simple-open': ['email-open-outline'],
  equals: ['equal'],
  eye: ['eye-outline'],
  'eye-slash': ['eye-off-outline'],
  'file-text': ['file-document-outline'],
  fire: ['fire'],
  flag: ['flag-outline'],
  'fork-knife': ['silverware-fork-knife'],
  'gender-female': ['gender-female'],
  'gender-male': ['gender-male'],
  'globe-hemisphere-east': ['earth'],
  hamburger: ['hamburger'],
  heart: ['heart-outline', 'heart'],
  heartbeat: ['heart-pulse'],
  image: ['image-outline'],
  info: ['information-outline'],
  leaf: ['leaf'],
  'magnifying-glass': ['magnify'],
  moon: ['weather-night'],
  notebook: ['notebook-outline'],
  package: ['package-variant-closed'],
  'paper-plane-tilt': ['send-outline'],
  'pencil-simple': ['pencil-outline'],
  'person-simple-run': ['run'],
  'person-simple-walk': ['walk'],
  plus: ['plus'],
  receipt: ['receipt-text-outline'],
  'seal-check': ['check-decagram-outline', 'check-decagram'],
  'shield-check': ['shield-check-outline'],
  'squares-four': ['view-grid-outline', 'view-grid'],
  star: ['star-outline'],
  sun: ['white-balance-sunny'],
  'sun-dim': ['weather-sunset-up'],
  trash: ['trash-can-outline'],
  'trend-down': ['trending-down'],
  'trend-up': ['trending-up'],
  user: ['account-outline'],
  'user-circle': ['account-circle-outline', 'account-circle'],
  wallet: ['wallet-outline'],
  warning: ['alert-outline'],
  'warning-circle': ['alert-circle-outline'],
  'wifi-slash': ['wifi-off'],
  x: ['close'],
}

/** Accepts the web app's `ph ph-name` / `ph-fill ph-name` strings so shared data keeps working. */
export function Icon({ name, size = 20, color = C.text, style }: { name: string; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const filled = name.includes('ph-fill')
  const key = name.split(' ').pop()!.replace(/^ph-/, '')
  const entry = ICONS[key] ?? ['help-circle-outline']
  const glyph = (filled && entry[1]) || entry[0]
  return <MaterialCommunityIcons name={glyph} size={size} color={color} style={style} />
}

export function Spinner({ color = C.onAccent }: { color?: string }) {
  return <ActivityIndicator size="small" color={color} />
}

type BtnVariant = 'primary' | 'outline' | 'plain' | 'danger' | 'ghost'

export function Button({
  children, onPress, variant = 'primary', disabled, icon, style, loading, accessibilityLabel,
}: {
  children?: ReactNode
  onPress?: () => void
  variant?: BtnVariant
  disabled?: boolean
  loading?: boolean
  icon?: ReactNode
  style?: StyleProp<ViewStyle>
  accessibilityLabel?: string
}) {
  const v = btnVariants[variant]
  const off = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!off }}
      style={({ pressed }) => [
        styles.btn, v.box,
        variant === 'primary' && off && { backgroundColor: C.disabled },
        pressed && !off && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? <Spinner color={v.text.color as string} /> : icon}
      {typeof children === 'string' ? <Text style={[styles.btnText, v.text]}>{children}</Text> : children}
    </Pressable>
  )
}

const btnVariants: Record<BtnVariant, { box: ViewStyle; text: TextStyle }> = {
  primary: { box: { backgroundColor: C.accent }, text: { color: C.onAccent } },
  outline: { box: { borderWidth: 1, borderColor: C.accentLine }, text: { color: C.accentPressed } },
  plain: { box: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong }, text: { color: C.text } },
  danger: { box: { borderWidth: 1, borderColor: C.danger }, text: { color: C.danger } },
  ghost: { box: { minHeight: 44 }, text: { color: C.accentPressed, fontSize: 13.5, fontWeight: '400' } },
}

export function TextButton({ children, onPress, disabled, style }: { children: ReactNode; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ color: C.accentPressed, fontSize: 13.5 }}>{children}</Text>
    </Pressable>
  )
}

export function IconButton({ name, onPress, label, size = 22, color = C.text, disabled, style }: { name: string; onPress?: () => void; label: string; size?: number; color?: string; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={[styles.iconBtn, disabled && { opacity: 0.35 }, style]}>
      <Icon name={name} size={size} color={color} />
    </Pressable>
  )
}

export function Chip({ children, on, onPress, icon, style }: { children: ReactNode; on?: boolean; onPress?: () => void; icon?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      style={[styles.chip, on && { backgroundColor: C.accentTint, borderColor: C.accentLine }, style]}
    >
      {icon ? <Icon name={icon} size={16} color={on ? C.onTint : C.text} /> : null}
      <Text style={{ fontSize: 13.5, color: on ? C.onTint : C.text, fontWeight: on ? '500' : '400' }}>{children}</Text>
    </Pressable>
  )
}

export function Card({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function Field({ label, error, ...props }: TextInputProps & { label?: string; error?: string | null }) {
  return (
    <View>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#9aa29c"
        {...props}
        style={[styles.input, error ? { borderColor: C.statusOver } : null, props.multiline && { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' }, props.style]}
      />
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <Icon name="ph ph-warning-circle" size={14} color={C.warnText} />
          <Text style={{ fontSize: 12.5, color: C.warnText, flex: 1 }}>{error}</Text>
        </View>
      ) : null}
    </View>
  )
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <Pressable onPress={() => onChange(!checked)} accessibilityRole="checkbox" accessibilityState={{ checked }} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={[styles.checkbox, checked && { backgroundColor: C.accent, borderColor: C.accent }]}>
        {checked ? <Icon name="ph ph-check" size={16} color="#fff" /> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  )
}

export function Row({ children, style, ...rest }: ViewProps) {
  return <View {...rest} style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>
}

/** Screen container: bg colour plus the top safe-area inset. */
export function Screen({ children, style, bottom }: { children: ReactNode; style?: StyleProp<ViewStyle>; bottom?: boolean }) {
  const insets = useSafeAreaInsets()
  return <View style={[{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top, paddingBottom: bottom ? insets.bottom : 0 }, style]}>{children}</View>
}

export function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="ปิด" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.handle} />
        {children}
      </View>
    </Modal>
  )
}

export function Header({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <Row style={{ gap: 8, paddingHorizontal: 8, paddingVertical: 4, minHeight: 52 }}>
      {onBack ? <IconButton name="ph ph-caret-left" label="ย้อนกลับ" onPress={onBack} /> : null}
      {title ? <Text style={[T.h2, { flex: 1, paddingLeft: onBack ? 0 : 8 }]}>{title}</Text> : <View style={{ flex: 1 }} />}
      {right}
    </Row>
  )
}

/** ป้ายคุณภาพข้อมูล — ไอคอน + ข้อความเสมอ ห้ามสื่อด้วยสีอย่างเดียว */
export function QualityBadge({ q }: { q: Quality }) {
  const meta = QUALITY[q]
  return (
    <Row style={{ gap: 4 }}>
      <Icon name={meta.icon} size={13} color={meta.color} />
      <Text style={{ fontSize: 11.5, color: meta.color }}>{meta.label}</Text>
    </Row>
  )
}

export function Thumb({ food, size = 44 }: { food: Food; size?: number }) {
  const packaged = food.kind === 'pack'
  return (
    <View style={{ width: size, height: size, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: packaged ? C.accentTint : '#e9efe9' }}>
      <Icon name={food.icon} size={size * 0.48} color={packaged ? C.accentPressed : '#4f6b55'} />
    </View>
  )
}

/** วงแหวนงบแคลอรี — โทนต่อเนื่อง ไม่มีแดง */
export function CalorieRing({ consumed, target, tone, loading }: { consumed: number; target: number; tone: RingTone; loading?: boolean }) {
  const r = 86
  const c = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(1, consumed / target) : 0
  const over = consumed > target
  const left = Math.abs(target - consumed)
  return (
    <View style={{ width: 200, height: 200, alignSelf: 'center' }}>
      <Svg width={200} height={200} viewBox="0 0 200 200">
        <Circle cx={100} cy={100} r={r} fill="none" stroke={C.border} strokeWidth={13} />
        {!loading && pct > 0 ? (
          <Circle cx={100} cy={100} r={r} fill="none" stroke={ringColor(tone)} strokeWidth={13} strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 100 100)" />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 2 }]}>
        {loading ? (
          <>
            <View style={[styles.skel, { width: 56, height: 12 }]} />
            <View style={[styles.skel, { width: 96, height: 34, marginTop: 8 }]} />
          </>
        ) : (
          <>
            <Text style={{ fontSize: 13, color: C.muted }}>{over ? 'ใช้เกินงบ' : 'งบคงเหลือ'}</Text>
            <Text style={T.display}>{num(left)}</Text>
            <Text style={[T.body, T.muted, T.tnum]}>จากงบ {num(target)} kcal</Text>
          </>
        )}
      </View>
    </View>
  )
}

export function MacroBar({ macros }: { macros: { protein: number; carb: number; fat: number } }) {
  const rows = [
    { label: 'โปรตีน', v: macros.protein, color: C.statusNear, max: 120 },
    { label: 'คาร์บ', v: macros.carb, color: C.accentLine, max: 260 },
    { label: 'ไขมัน', v: macros.fat, color: C.statusOver, max: 70 },
  ]
  return (
    <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ flex: 1 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, color: C.muted }}>{r.label}</Text>
            <Text style={[T.caption, T.tnum]}>{num(r.v)} ก.</Text>
          </Row>
          <View style={{ height: 4, borderRadius: 999, backgroundColor: C.border, marginTop: 4 }}>
            <View style={{ height: 4, borderRadius: 999, width: `${Math.min(100, (r.v / r.max) * 100)}%`, backgroundColor: r.color }} />
          </View>
        </View>
      ))}
    </View>
  )
}

export function OfflineBar({ text, icon = 'ph ph-wifi-slash', right }: { text: string; icon?: string; right?: ReactNode }) {
  return (
    <Row style={{ gap: 8, backgroundColor: C.accentTint, paddingHorizontal: 14, paddingVertical: 8 }} accessibilityRole="alert">
      <Icon name={icon} size={15} color={C.onTint} />
      <Text style={{ fontSize: 12.5, color: C.onTint, flex: 1 }}>{text}</Text>
      {right}
    </Row>
  )
}

export function BrandLogo({ size = 96 }: { size?: number }) {
  return <Image source={require('../../assets/logo.png')} style={{ width: size, height: size }} resizeMode="contain" accessible={false} />
}

export function Toast({ text, onUndo, onEdit }: { text: string; onUndo?: () => void; onEdit?: () => void }) {
  const insets = useSafeAreaInsets()
  return (
    <View pointerEvents="box-none" style={[styles.toastWrap, { bottom: insets.bottom + 96 }]}>
      <View style={styles.toast} accessibilityRole="alert">
        <Icon name="ph-fill ph-check-circle" size={20} color="#b9ddcd" />
        <Text style={{ flex: 1, color: '#fff', fontSize: 13.5 }}>{text}</Text>
        {onEdit ? <Pressable onPress={onEdit} hitSlop={8}><Text style={{ color: '#b9ddcd', fontWeight: '500' }}>แก้ไข</Text></Pressable> : null}
        {onUndo ? <Pressable onPress={onUndo} hitSlop={8}><Text style={{ color: '#b9ddcd', fontWeight: '500' }}>เลิกทำ</Text></Pressable> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  btn: { minHeight: 52, borderRadius: R.btn, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { fontSize: 15.5, fontWeight: '500' },
  iconBtn: { width: 44, height: 44, borderRadius: R.btn, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.card },
  fieldLabel: { fontSize: 12, color: C.muted, marginBottom: 6 },
  input: { minHeight: 52, paddingHorizontal: 14, borderRadius: R.btn, borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.surface, color: C.text, fontSize: 16 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.borderStrong, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(36,50,45,0.45)' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, paddingHorizontal: 16, paddingTop: 8, maxHeight: '90%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderStrong, marginBottom: 12 },
  skel: { backgroundColor: C.border, borderRadius: 8 },
  toastWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#25322e', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, width: '100%', maxWidth: 440 },
})

export { styles as uiStyles }
