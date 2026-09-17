import { useEffect, useState } from 'react'
import { BrandLogo, Icon } from '../components/ui'
import { useStore } from '../lib/store'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { Terms } from './Terms'
import type { Profile } from '../lib/types'

type Mode = 'signup' | 'login'
type AuthErr = null | 'email' | 'pass' | 'weak' | 'exists' | 'offline'
type View = 'splash' | 'login' | 'verify' | 'forgot' | 'terms'

const GoogleLogo = () => (
  <svg width="19" height="19" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
  </svg>
)

export function Auth({
  onSignedIn,
  onGuest,
}: {
  onSignedIn: (account: { email: string; userId: string; profile?: Profile }) => void
  onGuest: () => void
}) {
  const { online, showToast } = useStore()
  const [view, setView] = useState<View>('splash')
  const [termsBack, setTermsBack] = useState<View>('login')
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

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) void finishSignIn(data.session.user)
    })
  // The callback intentionally runs once to restore an existing browser session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (view !== 'verify') return
    const t = window.setInterval(() => setResendLeft((n) => (n > 0 ? n - 1 : 0)), 1000)
    return () => window.clearInterval(t)
  }, [view])

  const go = (m: Mode) => {
    setMode(m)
    setErr(null)
    setView('login')
  }

  const submit = async () => {
    if (!online) return setErr('offline')
    if (mode === 'signup' && !acceptedLegal) return showToast('โปรดยืนยันว่าคุณอายุ 18 ปีขึ้นไปและยอมรับเอกสารก่อนสมัคร')
    if (!email.includes('@') || !email.includes('.')) return setErr('email')
    if (pass.length < 8) return setErr(mode === 'signup' ? 'weak' : 'pass')
    setErr(null)
    setLoading(true)

    try {
      if (!supabase) {
        showToast('ยังไม่ได้ตั้งค่า Supabase สำหรับบัญชี ใช้งานแบบไม่สมัครสมาชิกได้ก่อนนะ')
        return
      }
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password: pass })
        if (error) {
          if (error.message.includes('already registered')) {
            setErr('exists')
          } else setErr('pass')
        } else {
          setResendLeft(60)
          setView('verify')
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
        if (error) {
          setErr('pass')
        } else {
          const user = data.user
          if (user && !user.email_confirmed_at) {
            setView('verify')
            showToast('โปรดยืนยันอีเมลก่อนเข้าใช้งาน')
          } else {
            await finishSignIn(user)
            showToast('ยินดีต้อนรับกลับ ข้อมูลซิงก์เรียบร้อยแล้ว')
          }
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
    if (!supabase) return showToast('ยังไม่ได้ตั้งค่า Supabase')
    setLoading(true)
    try {
      const { data } = await supabase.auth.getUser()
      const user = data?.user
      if (user && user.email_confirmed_at) {
        setLoading(false)
        await finishSignIn(user)
        showToast('ยืนยันอีเมลสำเร็จเรียบร้อย')
        return
      }

      if (pass) {
        const { data: signInData } = await supabase.auth.signInWithPassword({ email, password: pass })
        if (signInData?.user?.email_confirmed_at) {
          setLoading(false)
          await finishSignIn(signInData.user)
          showToast('ยืนยันอีเมลสำเร็จเรียบร้อย')
          return
        }
      }

      showToast('ยังไม่พบการยืนยันอีเมล โปรดเปิดลิงก์ในกล่องจดหมายของคุณก่อนกดปุ่มนี้')
    } catch (e) {
      showToast('ยังไม่พบการยืนยันอีเมล โปรดเปิดลิงก์ในกล่องจดหมายของคุณก่อนกดปุ่มนี้')
    } finally {
      setLoading(false)
    }
  }

  const google = async () => {
    if (!online) return setErr('offline')
    // Google can create a new account from either tab, so consent is always required.
    if (!acceptedLegal) return showToast('โปรดยืนยันว่าคุณอายุ 18 ปีขึ้นไปและยอมรับเอกสารก่อนดำเนินการต่อด้วย Google')
    if (!supabase) return showToast('ยังไม่ได้ตั้งค่า Supabase')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname,
        },
      })
      if (error) showToast('ยังเข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้งนะ')
    } catch {
      showToast('ยังเข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองอีกครั้งนะ')
    } finally {
      setLoading(false)
    }
  }

  const openTerms = () => {
    setTermsBack(view)
    setView('terms')
  }

  if (view === 'terms') return <Terms onBack={() => setView(termsBack)} />

  if (view === 'splash') {
    return (
      <div
        className="kd-screen"
        style={{ padding: '51px 26px 34px', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 16 }}
      >
        <BrandLogo size={112} />
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 500, lineHeight: 1.3 }}>KinDee</h1>
          <p className="kd-muted" style={{ fontSize: 14.5, maxWidth: 264, margin: '4px auto 0' }}>
            นับแคลอรีที่เข้าใจอาหารไทย บันทึกมื้อหนึ่งจบใน 3 วินาที
          </p>
        </div>
        <div style={{ width: '100%', display: 'grid', gap: 10, marginTop: 8 }}>
          <button className="kd-btn kd-btn-primary" onClick={onGuest}>เริ่มบันทึกเลย</button>
          <button className="kd-btn kd-btn-outline" onClick={() => go('signup')}>สำรองข้อมูลฟรี</button>
          <button className="kd-btn-text" onClick={() => go('login')}>มีบัญชีแล้ว · เข้าสู่ระบบ</button>
        </div>
        <p className="kd-caption kd-muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Icon name="ph ph-arrows-clockwise" size={14} />
          ใช้แบบไม่สมัครสมาชิกได้ ข้อมูลจะเก็บไว้ในเครื่องนี้
        </p>
        <button className="kd-btn-text" style={{ textDecoration: 'underline' }} onClick={openTerms}>
          อ่านเงื่อนไขการใช้งานและประกาศความเป็นส่วนตัว
        </button>
      </div>
    )
  }

  if (view === 'verify') {
    return (
      <div className="kd-screen" style={{ padding: '51px 20px 26px' }}>
        <button className="kd-icon-btn" onClick={() => setView('login')} aria-label="ย้อนกลับ">
          <Icon name="ph ph-caret-left" size={22} />
        </button>
        <div style={{ display: 'grid', gap: 14, marginTop: 12 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--accent-tint)', display: 'grid', placeItems: 'center' }}>
            <Icon name="ph ph-envelope-simple-open" size={28} color="var(--accent-pressed)" />
          </div>
          <h1 className="kd-h1">ส่งลิงก์ไปแล้วนะ</h1>
          <p className="kd-body kd-muted">
            เราส่งลิงก์ยืนยันไปที่ <b style={{ fontWeight: 500, color: 'var(--text)' }}>{email}</b> แล้ว
            พอยืนยันเสร็จ ข้อมูลของคุณจะซิงก์ให้ทุกเครื่องที่ล็อกอิน
          </p>
          <button className="kd-btn kd-btn-primary" onClick={checkVerification} disabled={loading}>
            {loading ? 'กำลังตรวจสอบ...' : 'ยืนยันแล้ว ไปตั้งค่าต่อ'}
          </button>
          <button
            className="kd-btn"
            disabled={resendLeft > 0}
            onClick={async () => {
              if (!supabase) return
              const { error } = await supabase.auth.resend({ type: 'signup', email })
              if (error) return showToast('ยังส่งลิงก์ไม่ได้ ลองอีกครั้งในอีกสักครู่นะ')
              setResendLeft(60)
              showToast('ส่งลิงก์ยืนยันอีกครั้งแล้ว')
            }}
            style={{
              border: `1px solid ${resendLeft > 0 ? 'var(--border-strong)' : 'var(--accent-line)'}`,
              color: resendLeft > 0 ? 'var(--text-muted)' : 'var(--accent-pressed)',
              cursor: resendLeft > 0 ? 'default' : 'pointer',
            }}
          >
            {resendLeft > 0 ? `ส่งอีกครั้งได้ในอีก ${resendLeft} วิ` : 'ส่งอีกครั้ง'}
          </button>
          <button className="kd-btn-text" onClick={() => { setMode('signup'); setView('login') }}>
            ใช้อีเมลอื่น
          </button>
        </div>
      </div>
    )
  }

  if (view === 'forgot') {
    return (
      <div className="kd-screen" style={{ padding: '51px 20px 26px' }}>
        <button className="kd-icon-btn" onClick={() => { setForgotSent(false); setView('login') }} aria-label="ย้อนกลับ">
          <Icon name="ph ph-caret-left" size={22} />
        </button>
        {forgotSent ? (
          <div style={{ display: 'grid', gap: 14, marginTop: 12 }}>
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--accent-tint)', display: 'grid', placeItems: 'center' }}>
              <Icon name="ph ph-paper-plane-tilt" size={28} color="var(--accent-pressed)" />
            </div>
            <h1 className="kd-h1">ส่งลิงก์ตั้งรหัสใหม่แล้ว</h1>
            <p className="kd-body kd-muted">
              ถ้ามีบัญชีที่ใช้อีเมลนี้อยู่ จะได้รับลิงก์ตั้งรหัสใหม่ภายในไม่กี่นาที ลองเช็คในกล่องจดหมายขยะด้วยนะ
            </p>
            <button className="kd-btn kd-btn-primary" onClick={() => { setForgotSent(false); setView('login') }}>
              กลับไปเข้าสู่ระบบ
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14, marginTop: 12 }}>
            <h1 className="kd-h1">ลืมรหัสผ่าน ไม่เป็นไร</h1>
            <p className="kd-body kd-muted">กรอกอีเมลที่ใช้สมัคร แล้วเราจะส่งลิงก์ตั้งรหัสใหม่ไปให้</p>
            <div>
              <label className="kd-field-label" htmlFor="fg-email">อีเมล</label>
              <input
                id="fg-email"
                className="kd-input"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <button className="kd-btn kd-btn-primary" onClick={async () => {
              if (!supabase || !email.includes('@')) return setErr('email')
              const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
              })
              if (error) return showToast('ยังส่งลิงก์ไม่ได้ ลองอีกครั้งในอีกสักครู่นะ')
              setForgotSent(true)
            }}>ส่งลิงก์ตั้งรหัสใหม่</button>
          </div>
        )}
      </div>
    )
  }

  // ---- login / signup ----
  const emailErr = err === 'email' ? 'อีเมลยังไม่ถูกรูปแบบ ลองเช็คอีกครั้งนะ' : err === 'exists' ? 'อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทนไหม' : null
  const passErr =
    err === 'weak' ? 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว' : err === 'pass' ? 'รหัสผ่านยังไม่ตรง ลองใหม่อีกครั้ง' : null

  return (
    <div className="kd-screen">
      <div className="kd-scroll" style={{ padding: '51px 20px 26px' }}>
        <button className="kd-icon-btn" onClick={() => setView('splash')} aria-label="ย้อนกลับ">
          <Icon name="ph ph-caret-left" size={22} />
        </button>
        <h1 className="kd-h1" style={{ marginTop: 8 }}>
          {mode === 'signup' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
        </h1>
        <p className="kd-body kd-muted" style={{ marginTop: 4 }}>
          {mode === 'signup'
            ? 'สร้างบัญชีไว้ ข้อมูลจะซิงก์ให้ทุกเครื่อง'
            : 'ยินดีต้อนรับกลับมา ข้อมูลรออยู่ครบแล้ว'}
        </p>

        <label className="kd-card" style={{ marginTop: 16, padding: 12, display: 'flex', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={acceptedLegal} onChange={(event) => setAcceptedLegal(event.target.checked)} style={{ width: 22, height: 22, flex: 'none', accentColor: 'var(--accent)' }} />
          <span className="kd-caption" style={{ textAlign: 'left' }}>
            ฉันอายุ 18 ปีขึ้นไป และยอมรับเงื่อนไขการใช้งาน รวมถึงรับทราบประกาศความเป็นส่วนตัว
          </span>
        </label>

        <button className="kd-btn kd-btn-plain" style={{ marginTop: 20 }} onClick={google} disabled={loading || !acceptedLegal}>
          <GoogleLogo />
          ดำเนินการต่อด้วย Google
        </button>

        {!isSupabaseConfigured && (
          <p className="kd-caption kd-muted" role="status" style={{ marginTop: 8 }}>
            โหมดบัญชียังไม่เปิดใน environment นี้ แต่ยังใช้งานแบบไม่สมัครสมาชิกได้ตามปกติ
          </p>
        )}

        <div className="kd-row" style={{ gap: 10, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, var(--border-strong))' }} />
          <span className="kd-caption kd-muted" style={{ fontSize: 12 }}>หรือ</span>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, var(--border-strong), transparent)' }} />
        </div>

        {err === 'offline' && (
          <div style={{ background: 'var(--accent-tint)', color: 'var(--on-tint)', borderRadius: 12, padding: 12, marginBottom: 14 }} role="status">
            <div className="kd-body">
              ตอนนี้ยังออฟไลน์อยู่ เลยเข้าสู่ระบบไม่ได้ — แต่บันทึกมื้ออาหารไว้ในเครื่องได้ตามปกติ เดี๋ยวซิงก์ให้เมื่อกลับมาออนไลน์
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label className="kd-field-label" htmlFor="au-email">อีเมล</label>
            <input
              id="au-email"
              className={`kd-input${emailErr ? ' err' : ''}`}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (err === 'email' || err === 'exists') setErr(null) }}
              placeholder="you@example.com"
              aria-invalid={!!emailErr}
            />
            {emailErr && (
              <div className="kd-err"><Icon name="ph ph-warning-circle" size={14} />{emailErr}</div>
            )}
          </div>

          <div>
            <label className="kd-field-label" htmlFor="au-pass">รหัสผ่าน</label>
            <div style={{ position: 'relative' }}>
              <input
                id="au-pass"
                className={`kd-input${passErr ? ' err' : ''}`}
                type={showPass ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={pass}
                onChange={(e) => { setPass(e.target.value); if (err === 'pass' || err === 'weak') setErr(null) }}
                style={{ paddingRight: 48 }}
                aria-invalid={!!passErr}
              />
              <button
                className="kd-icon-btn"
                style={{ position: 'absolute', right: 4, top: 4 }}
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                <Icon name={showPass ? 'ph ph-eye-slash' : 'ph ph-eye'} size={19} color="var(--text-muted)" />
              </button>
            </div>
            {passErr && <div className="kd-err"><Icon name="ph ph-warning-circle" size={14} />{passErr}</div>}
          </div>

          <button className="kd-btn kd-btn-primary" onClick={submit} disabled={loading || !online || (mode === 'signup' && !acceptedLegal)}>
            {loading ? (
              <>
                <span className="kd-spin"><Icon name="ph ph-circle-notch" size={18} /></span>
                กำลังดำเนินการ…
              </>
            ) : mode === 'signup' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
          </button>

          {mode === 'login' && (
            <button className="kd-btn-text" onClick={() => setView('forgot')}>ลืมรหัสผ่าน</button>
          )}

          <button className="kd-btn-text" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setErr(null) }}>
            {mode === 'signup' ? 'มีบัญชีอยู่แล้ว เข้าสู่ระบบ' : 'ยังไม่มีบัญชี สมัครสมาชิก'}
          </button>
        </div>

        <p className="kd-caption kd-muted" style={{ marginTop: 18 }}>
          การใช้งานต่อถือว่ายอมรับ{' '}
          <button className="kd-btn-text" style={{ display: 'inline', minHeight: 0, textDecoration: 'underline' }} onClick={openTerms}>
            เงื่อนไขการใช้งาน
          </button>{' '}
          และ{' '}
          <button className="kd-btn-text" style={{ display: 'inline', minHeight: 0, textDecoration: 'underline' }} onClick={openTerms}>
            นโยบายความเป็นส่วนตัว
          </button>{' '}
          · ข้อมูลน้ำหนักและมื้ออาหารเก็บในบัญชีของคุณ ซิงก์ให้เฉพาะอุปกรณ์ที่คุณล็อกอิน
        </p>
      </div>
    </div>
  )
}
