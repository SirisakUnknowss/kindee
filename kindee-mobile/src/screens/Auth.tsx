import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { BrandLogo, Button, Checkbox, Field, Icon, IconButton, Row, Screen, TextButton } from '../components/ui'
import { useStore } from '../lib/store'
import { ACCOUNTS_ENABLED } from '../config/features'
import { API_BASE, isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { C, R, T } from '../theme'
import { Terms } from './Terms'

type Mode = 'signup' | 'login'
type AuthErr = null | 'email' | 'pass' | 'weak' | 'exists' | 'offline'
type View_ = 'splash' | 'login' | 'verify' | 'forgot' | 'terms'

const REDIRECT = `${API_BASE}/`

export function Auth({ onSignedIn, onGuest }: {
  onSignedIn: (account: { email: string; userId: string; profile?: Profile }) => void
  onGuest: () => void
}) {
  const { online, showToast } = useStore()
  const [view, setView] = useState<View_>('splash')
  const [termsBack, setTermsBack] = useState<View_>('login')
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [err, setErr] = useState<AuthErr>(null)
  const [loading, setLoading] = useState(false)
  const [resendLeft, setResendLeft] = useState(60)
  const [forgotSent, setForgotSent] = useState(false)
  const [acceptedLegal, setAcceptedLegal] = useState(false)

  const finishSignIn = async (user: { id: string; email?: string }) => {
    if (!supabase) return
    const [{ data }, { data: weights }] = await Promise.all([
      supabase.from('profiles').select('sex,birth_date,height_cm,activity,goal,target_kcal,target_source').eq('id', user.id).maybeSingle(),
      supabase.from('weight_logs').select('weight_kg').eq('user_id', user.id).order('logged_on', { ascending: false }).limit(1),
    ])
    const birth = data?.birth_date ? new Date(`${data.birth_date}T00:00:00Z`) : null
    const profile = data && birth ? {
      sex: data.sex,
      bDay: birth.getUTCDate(),
      bMonth: birth.getUTCMonth() + 1,
      bYear: birth.getUTCFullYear(),
      height: Number(data.height_cm),
      weight: Number(weights?.[0]?.weight_kg ?? 60),
      activity: data.activity,
      goal: data.goal,
      target: data.target_kcal,
      targetSource: data.target_source,
    } as Profile : undefined
    onSignedIn({ email: user.email ?? email, userId: user.id, profile })
  }

  // Restore a session persisted by a previous launch.
  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) void finishSignIn(data.session.user)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (view !== 'verify') return
    const t = setInterval(() => setResendLeft((n) => (n > 0 ? n - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [view])

  const go = (m: Mode) => { setMode(m); setErr(null); setView('login') }

  const submit = async () => {
    if (!online) return setErr('offline')
    if (mode === 'signup' && !acceptedLegal) return showToast('โปรดยืนยันว่าคุณอายุ 18 ปีขึ้นไปและยอมรับเอกสารก่อนสมัคร')
    if (!email.includes('@') || !email.includes('.')) return setErr('email')
    if (pass.length < 8) return setErr(mode === 'signup' ? 'weak' : 'pass')
    setErr(null)
    setLoading(true)
    try {
      if (!supabase) return showToast('ยังไม่ได้ตั้งค่าบัญชีสำหรับแอปนี้ ใช้งานแบบไม่สมัครสมาชิกได้ก่อนนะ')
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password: pass, options: { emailRedirectTo: REDIRECT } })
        if (error) {
          if (error.message.includes('already registered')) setErr('exists')
          else if (error.code === 'over_email_send_rate_limit' || error.status === 429) showToast('ส่งอีเมลยืนยันถี่เกินไป โปรดรอสักครู่แล้วลองใหม่')
          else showToast(`สมัครสมาชิกไม่สำเร็จ: ${error.message}`)
        } else {
          setResendLeft(60)
          setView('verify')
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass })
        if (error) {
          setErr('pass')
        } else if (data.user && !data.user.email_confirmed_at) {
          setView('verify')
          showToast('โปรดยืนยันอีเมลก่อนเข้าใช้งาน')
        } else {
          await finishSignIn(data.user)
          showToast('ยินดีต้อนรับกลับ ข้อมูลซิงก์เรียบร้อยแล้ว')
        }
      }
    } catch {
      setErr(online ? 'pass' : 'offline')
    } finally {
      setLoading(false)
    }
  }

  const checkVerification = async () => {
    if (!online) return setErr('offline')
    if (!supabase) return showToast('ยังไม่ได้ตั้งค่าบัญชีสำหรับแอปนี้')
    setLoading(true)
    const notYet = () => showToast('ยังไม่พบการยืนยันอีเมล โปรดเปิดลิงก์ในกล่องจดหมายของคุณก่อนกดปุ่มนี้')
    try {
      if (pass) {
        const { data } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass })
        if (data?.user?.email_confirmed_at) {
          await finishSignIn(data.user)
          showToast('ยืนยันอีเมลสำเร็จเรียบร้อย')
          return
        }
      }
      notYet()
    } catch {
      notYet()
    } finally {
      setLoading(false)
    }
  }

  const sendReset = async () => {
    if (!supabase || !email.includes('@')) return setErr('email')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: REDIRECT })
    if (error) return showToast('ยังส่งลิงก์ไม่ได้ ลองอีกครั้งในอีกสักครู่นะ')
    setForgotSent(true)
  }

  const openTerms = () => { setTermsBack(view); setView('terms') }

  if (view === 'terms') return <Terms onBack={() => setView(termsBack)} />

  if (view === 'splash') {
    return (
      <Screen style={{ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 26, gap: 16 }}>
        <BrandLogo size={112} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 30, fontWeight: '500', color: C.text }}>KinDee</Text>
          <Text style={[{ fontSize: 14.5, maxWidth: 264, textAlign: 'center', marginTop: 4 }, T.muted]}>นับแคลอรีที่เข้าใจอาหารไทย บันทึกมื้อหนึ่งจบใน 3 วินาที</Text>
        </View>
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 8 }}>
          <Button onPress={onGuest}>เริ่มบันทึกเลย</Button>
          {ACCOUNTS_ENABLED && <Button variant="outline" onPress={() => go('signup')}>สำรองข้อมูลฟรี</Button>}
          {ACCOUNTS_ENABLED && <Button variant="ghost" onPress={() => go('login')}>มีบัญชีแล้ว · เข้าสู่ระบบ</Button>}
        </View>
        <Row style={{ gap: 6 }}>
          <Icon name="ph ph-cellphone" size={14} color={C.muted} />
          <Text style={[T.caption, T.muted]}>{ACCOUNTS_ENABLED ? 'ใช้แบบไม่สมัครสมาชิกได้ ข้อมูลจะเก็บไว้ในเครื่องนี้' : 'ไม่ต้องสมัครสมาชิก ข้อมูลทั้งหมดเก็บไว้ในเครื่องนี้'}</Text>
        </Row>
        <Pressable onPress={openTerms} accessibilityRole="link"><Text style={{ color: C.accentPressed, fontSize: 13.5, textDecorationLine: 'underline' }}>อ่านเงื่อนไขการใช้งานและประกาศความเป็นส่วนตัว</Text></Pressable>
      </Screen>
    )
  }

  if (view === 'verify') {
    return (
      <Screen style={{ paddingHorizontal: 20 }}>
        <View style={{ alignSelf: 'flex-start', marginLeft: -12 }}><IconButton name="ph ph-caret-left" label="ย้อนกลับ" onPress={() => setView('login')} /></View>
        <View style={{ gap: 14, marginTop: 12 }}>
          <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: C.accentTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="ph ph-envelope-simple-open" size={28} color={C.accentPressed} />
          </View>
          <Text style={T.h1}>ส่งลิงก์ไปแล้วนะ</Text>
          <Text style={[T.body, T.muted]}>
            เราส่งลิงก์ยืนยันไปที่ <Text style={{ fontWeight: '500', color: C.text }}>{email}</Text> แล้ว พอยืนยันเสร็จ ข้อมูลของคุณจะซิงก์ให้ทุกเครื่องที่ล็อกอิน
          </Text>
          <Button onPress={checkVerification} loading={loading}>{loading ? 'กำลังตรวจสอบ...' : 'ยืนยันแล้ว ไปตั้งค่าต่อ'}</Button>
          <Button
            variant="outline"
            disabled={resendLeft > 0}
            onPress={async () => {
              if (!supabase) return
              const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
              if (error) return showToast('ยังส่งลิงก์ไม่ได้ ลองอีกครั้งในอีกสักครู่นะ')
              setResendLeft(60)
              showToast('ส่งลิงก์ยืนยันอีกครั้งแล้ว')
            }}
          >
            {resendLeft > 0 ? `ส่งอีกครั้งได้ในอีก ${resendLeft} วิ` : 'ส่งอีกครั้ง'}
          </Button>
          <TextButton onPress={() => { setMode('signup'); setView('login') }}>ใช้อีเมลอื่น</TextButton>
        </View>
      </Screen>
    )
  }

  if (view === 'forgot') {
    return (
      <Screen style={{ paddingHorizontal: 20 }}>
        <View style={{ alignSelf: 'flex-start', marginLeft: -12 }}><IconButton name="ph ph-caret-left" label="ย้อนกลับ" onPress={() => { setForgotSent(false); setView('login') }} /></View>
        {forgotSent ? (
          <View style={{ gap: 14, marginTop: 12 }}>
            <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: C.accentTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="ph ph-paper-plane-tilt" size={28} color={C.accentPressed} />
            </View>
            <Text style={T.h1}>ส่งลิงก์ตั้งรหัสใหม่แล้ว</Text>
            <Text style={[T.body, T.muted]}>ถ้ามีบัญชีที่ใช้อีเมลนี้อยู่ จะได้รับลิงก์ตั้งรหัสใหม่ภายในไม่กี่นาที ลองเช็คในกล่องสแปมด้วยนะ</Text>
            <Button onPress={() => { setForgotSent(false); setView('login') }}>กลับไปเข้าสู่ระบบ</Button>
          </View>
        ) : (
          <View style={{ gap: 14, marginTop: 12 }}>
            <Text style={T.h1}>ลืมรหัสผ่าน ไม่เป็นไร</Text>
            <Text style={[T.body, T.muted]}>กรอกอีเมลที่ใช้สมัคร แล้วเราจะส่งลิงก์ตั้งรหัสใหม่ไปให้</Text>
            <Field label="อีเมล" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} placeholder="you@example.com" />
            <Button onPress={sendReset}>ส่งลิงก์ตั้งรหัสใหม่</Button>
          </View>
        )}
      </Screen>
    )
  }

  // ---- login / signup ----
  const emailErr = err === 'email' ? 'อีเมลยังไม่ถูกรูปแบบ ลองเช็คอีกครั้งนะ' : err === 'exists' ? 'อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทนนะ' : null
  const passErr = err === 'weak' ? 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว' : err === 'pass' ? 'อีเมลหรือรหัสผ่านยังไม่ตรง ลองใหม่อีกครั้ง' : null

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 26 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignSelf: 'flex-start', marginLeft: -12 }}><IconButton name="ph ph-caret-left" label="ย้อนกลับ" onPress={() => setView('splash')} /></View>
          <Text style={[T.h1, { marginTop: 8 }]}>{mode === 'signup' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</Text>
          <Text style={[T.body, T.muted, { marginTop: 4 }]}>{mode === 'signup' ? 'สร้างบัญชีไว้ ข้อมูลจะซิงก์ให้ทุกเครื่อง' : 'ยินดีต้อนรับกลับมา ข้อมูลรออยู่ครบแล้ว'}</Text>

          {mode === 'signup' && (
            <View style={{ marginTop: 16, padding: 12, borderRadius: R.card, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface }}>
              <Checkbox checked={acceptedLegal} onChange={setAcceptedLegal}>
                <Text style={[T.caption, { color: C.text }]}>ฉันอายุ 18 ปีขึ้นไป และยอมรับเงื่อนไขการใช้งาน รวมถึงรับทราบประกาศความเป็นส่วนตัว</Text>
              </Checkbox>
            </View>
          )}

          {!isSupabaseConfigured && (
            <Text style={[T.caption, T.muted, { marginTop: 8 }]}>โหมดบัญชียังไม่เปิดใน environment นี้ แต่ยังใช้งานแบบไม่สมัครสมาชิกได้ตามปกติ</Text>
          )}

          {err === 'offline' && (
            <View accessibilityRole="alert" style={{ backgroundColor: C.accentTint, borderRadius: 12, padding: 12, marginTop: 14 }}>
              <Text style={[T.body, { color: C.onTint }]}>ตอนนี้ยังออฟไลน์อยู่ เลยเข้าสู่ระบบไม่ได้ — แต่บันทึกมื้ออาหารไว้ในเครื่องได้ตามปกติ</Text>
            </View>
          )}

          <View style={{ gap: 14, marginTop: 18 }}>
            <Field
              label="อีเมล" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
              value={email} placeholder="you@example.com" error={emailErr}
              onChangeText={(t) => { setEmail(t); if (err === 'email' || err === 'exists') setErr(null) }}
            />
            <View>
              <Field
                label="รหัสผ่าน" secureTextEntry={!showPass} autoCapitalize="none" autoCorrect={false}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                value={pass} error={passErr} style={{ paddingRight: 48 }}
                onChangeText={(t) => { setPass(t); if (err === 'pass' || err === 'weak') setErr(null) }}
              />
              <View style={{ position: 'absolute', right: 2, top: 20 }}>
                <IconButton name={showPass ? 'ph ph-eye-slash' : 'ph ph-eye'} size={19} color={C.muted} label={showPass ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} onPress={() => setShowPass((v) => !v)} />
              </View>
            </View>

            <Button onPress={submit} loading={loading}>{loading ? 'กำลังดำเนินการ…' : mode === 'signup' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</Button>
            {mode === 'login' && <TextButton onPress={() => setView('forgot')}>ลืมรหัสผ่าน</TextButton>}
            <TextButton onPress={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setErr(null) }}>
              {mode === 'signup' ? 'มีบัญชีอยู่แล้ว เข้าสู่ระบบ' : 'ยังไม่มีบัญชี สมัครสมาชิก'}
            </TextButton>
          </View>

          <Text style={[T.caption, T.muted, { marginTop: 18 }]}>
            การใช้งานต่อถือว่ายอมรับ <Text style={{ color: C.accentPressed, textDecorationLine: 'underline' }} onPress={openTerms}>เงื่อนไขการใช้งาน</Text> และ{' '}
            <Text style={{ color: C.accentPressed, textDecorationLine: 'underline' }} onPress={openTerms}>นโยบายความเป็นส่วนตัว</Text> · ข้อมูลน้ำหนักและมื้ออาหารเก็บในบัญชีของคุณ ซิงก์ให้เฉพาะอุปกรณ์ที่คุณล็อกอิน
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
