import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Icon } from '../components/ui'
import { adminSupabase } from '../lib/admin-auth'
import { AdminDashboard } from './AdminDashboard'

type Stage = 'loading' | 'login' | 'enroll' | 'verify' | 'ready'
type Enrollment = { factorId: string; qrCode: string; secret: string }

export function AdminAccess({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>('loading')
  const [code, setCode] = useState('')
  const [factorId, setFactorId] = useState('')
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const inspect = useCallback(async () => {
    if (!adminSupabase) { setStage('login'); return }
    const { data: sessionData, error: sessionError } = await adminSupabase.auth.getSession()
    if (sessionError || !sessionData.session) { setStage('login'); return }
    const { data: aal, error: aalError } = await adminSupabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aalError) { setMessage('ตรวจสอบ MFA ไม่สำเร็จ กรุณาลองใหม่'); setStage('login'); return }
    if (aal.currentLevel === 'aal2') { setStage('ready'); return }
    const { data: factors, error: factorError } = await adminSupabase.auth.mfa.listFactors()
    if (factorError) { setMessage('ตรวจสอบ MFA ไม่สำเร็จ กรุณาลองใหม่'); setStage('login'); return }
    const verified = factors.totp.find((factor) => factor.status === 'verified')
    if (verified) { setFactorId(verified.id); setStage('verify') }
    else { setStage('enroll') }
  }, [])

  useEffect(() => {
    void inspect()
    if (!adminSupabase) return
    const { data: { subscription } } = adminSupabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setStage('login'); setEnrollment(null) }
    })
    return () => subscription.unsubscribe()
  }, [inspect])

  const signIn = async () => {
    if (!adminSupabase) { setMessage('ERR_ADMIN_001'); return }
    setBusy(true); setMessage('')
    const { error } = await adminSupabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin` },
    })
    if (error) setMessage('ERR_ADMIN_002')
    setBusy(false)
  }

  const enroll = async () => {
    if (!adminSupabase) return
    setBusy(true); setMessage('')
    const { data, error } = await adminSupabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'KinDee Admin' })
    if (error || !data.totp) setMessage('ตั้งค่า MFA ไม่สำเร็จ กรุณาลองใหม่')
    else setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    setBusy(false)
  }

  const verify = async (event: FormEvent) => {
    event.preventDefault()
    if (!adminSupabase) return
    setBusy(true); setMessage('')
    const id = enrollment?.factorId ?? factorId
    const { error } = await adminSupabase.auth.mfa.challengeAndVerify({ factorId: id, code: code.trim() })
    setCode('')
    if (error) setMessage('รหัส MFA ไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่')
    else { setEnrollment(null); await inspect() }
    setBusy(false)
  }

  const signOut = async () => {
    setBusy(true)
    await adminSupabase?.auth.signOut()
    setStage('login'); setEnrollment(null); setCode(''); setMessage('')
    setBusy(false)
  }

  if (stage === 'ready') return <AdminDashboard onExit={onExit} onSignOut={() => { void signOut() }} />

  return <div className="kd-admin-gate">
    <Icon name="ph ph-shield-check" size={44} />
    <h1>KinDee Admin</h1>
    <p>พื้นที่สำหรับผู้ดูแลระบบ ใช้บัญชีแยกจากผู้ใช้งาน KinDee</p>
    {stage === 'loading' && <p>กำลังตรวจสอบสิทธิ์…</p>}
    {stage === 'login' && <button className="kd-btn kd-btn-primary" onClick={() => { void signIn() }} disabled={busy}><Icon name="ph ph-google-logo" size={20} />เข้าสู่ระบบด้วย Google</button>}
    {stage === 'enroll' && <div className="kd-admin-login-form">
      <p>ต้องตั้งค่าแอปยืนยันตัวตน (TOTP) ก่อนเข้าดูข้อมูล</p>
      {!enrollment && <button className="kd-btn kd-btn-primary" onClick={() => { void enroll() }} disabled={busy}>เริ่มตั้งค่า MFA</button>}
      {enrollment && <><img src={enrollment.qrCode} alt="QR สำหรับตั้งค่า MFA" className="kd-admin-qr" /><small>หรือกรอกรหัสนี้ในแอปยืนยันตัวตน: {enrollment.secret}</small></>}
    </div>}
    {(stage === 'verify' || enrollment) && <form className="kd-admin-login-form" onSubmit={(event) => { void verify(event) }}>
      <label>รหัส 6 หลักจากแอปยืนยันตัวตน<input inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value)} /></label>
      <button className="kd-btn kd-btn-primary" disabled={busy}>ยืนยัน MFA</button>
    </form>}
    {message && <p role="alert">{message}</p>}
    <button className="kd-btn kd-btn-outline" onClick={stage === 'login' ? onExit : () => { void signOut() }} disabled={busy}>{stage === 'login' ? 'กลับไปที่แอป' : 'ออกจากระบบผู้ดูแล'}</button>
  </div>
}
