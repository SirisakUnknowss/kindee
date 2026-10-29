import { useRef, useState } from 'react'
import { Icon, Sheet } from '../components/ui'
import { num } from '../lib/calc'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { clearDeviceData, deleteAccount, downloadMyData } from '../lib/privacy'
import { legalConfig } from '../config/legal'
import { billingEnabled, donateQrUrl, donateRecipient } from '../config/features'
import { sendFeedback } from '../lib/report'
import { downloadBackup, parseBackup, restoreBackup, summarize } from '../lib/backup'
import type { Profile } from '../lib/types'

/** หน้า 23 ฉัน — ระดับ wireframe (P1) พร้อมทางเข้าแก้เป้าหมายและตั้งค่าที่จำเป็น */
export function Me({ onEditTarget, onOpenLegal, onOpenPricing, onOpenBody, onOpenLeaderboard, onProfileRestore }: {
  onOpenBody: () => void; onEditTarget: () => void; onOpenLegal: (tab: 'terms' | 'privacy') => void; onOpenPricing: () => void
  onOpenLeaderboard: () => void; onProfileRestore: (p: Profile) => void
}) {
  const {
    profile, session, entries, contributions, showMacros, setShowMacros, setSession, reset, showToast,
    lengthUnit, setLengthUnit, waterGoal, setWaterGoal, exerciseMode, setExerciseMode,
  } = useStore()
  const [backupBusy, setBackupBusy] = useState(false)
  const [donateOpen, setDonateOpen] = useState(false)
  const [qrFailed, setQrFailed] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const exportBackup = async () => {
    setBackupBusy(true)
    try {
      await downloadBackup(profile, { showMacros, lengthUnit, waterGoal, exerciseMode })
      showToast('ส่งออกไฟล์สำรองแล้ว เก็บไฟล์ไว้ในที่ปลอดภัย')
    } finally {
      setBackupBusy(false)
    }
  }

  const importBackup = async (file: File | undefined) => {
    if (!file) return
    setBackupBusy(true)
    try {
      const backup = parseBackup(await file.text())
      const sum = summarize(backup)
      const ok = window.confirm(
        `พบข้อมูล ${sum.days} วัน: อาหาร ${sum.entries} รายการ, เมนูโปรด ${sum.favorites}, รูปร่าง ${sum.bodyMeasurements}, น้ำดื่ม ${sum.water} วัน, ออกกำลังกาย ${sum.exercises} รายการ\n\n`
        + 'ข้อมูลจะรวมเข้ากับที่มีในเครื่อง รายการเดียวกันจะถูกแทนที่ด้วยข้อมูลจากไฟล์'
        + (backup.profile ? ' และเป้าหมายกับข้อมูลร่างกายจะใช้ตามไฟล์' : '') + ' เรียกคืนเลยไหม',
      )
      if (!ok) return
      await restoreBackup(backup)
      if (backup.profile) onProfileRestore(backup.profile)
      const st = backup.settings
      if (typeof st.showMacros === 'boolean') setShowMacros(st.showMacros)
      if (st.lengthUnit === 'cm' || st.lengthUnit === 'in') setLengthUnit(st.lengthUnit)
      if (st.waterGoal === null || (typeof st.waterGoal === 'number' && st.waterGoal >= 500 && st.waterGoal <= 6000)) setWaterGoal(st.waterGoal)
      if (st.exerciseMode === 'add' || st.exerciseMode === 'included') setExerciseMode(st.exerciseMode)
      showToast(`เรียกคืนข้อมูลแล้ว ${sum.days} วัน`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'เรียกคืนข้อมูลไม่สำเร็จ')
    } finally {
      setBackupBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }
  const daysUsed = new Set(entries.map((e) => e.day)).size
  const [privacyBusy, setPrivacyBusy] = useState<'export' | 'delete' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [feedbackState, setFeedbackState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  const submitFeedback = async () => {
    setFeedbackState('sending')
    const ok = await sendFeedback(feedback, rating ?? undefined)
    setFeedbackState(ok ? 'sent' : 'failed')
    if (ok) {
      setFeedback('')
      setRating(null)
    }
  }

  const exportData = async () => {
    if (!session) return
    setPrivacyBusy('export')
    try {
      const warnings = await downloadMyData(session, profile)
      if (warnings.length) alert('ดาวน์โหลดข้อมูลในเครื่องแล้ว แต่ข้อมูลบนคลาวด์บางส่วนส่งออกไม่สำเร็จ โปรดติดต่อฝ่ายความเป็นส่วนตัว')
    } finally {
      setPrivacyBusy(null)
    }
  }

  const removeAllData = async () => {
    if (!session) return
    if (!confirmDelete) return setConfirmDelete(true)
    setPrivacyBusy('delete')
    try {
      if (session.kind === 'account') {
        const { data } = await supabase!.auth.getSession()
        if (!data.session) throw new Error('auth_required')
        await deleteAccount(data.session.access_token)
        await supabase!.auth.signOut({ scope: 'local' })
      }
      await clearDeviceData()
      reset()
      setSession(null)
    } catch {
      alert(`ยังลบข้อมูลไม่สำเร็จ โปรดลองเข้าสู่ระบบใหม่หรือติดต่อ ${legalConfig.privacyEmail}`)
      setPrivacyBusy(null)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="kd-screen">
      <div style={{ padding: '47px 16px 0' }}>
        <h1 className="kd-h1" style={{ marginTop: 8 }}>ฉัน</h1>
      </div>
      <div className="kd-scroll" style={{ padding: '12px 16px 140px' }}>
        <div className="kd-card kd-row" style={{ padding: 14, gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 999, background: 'var(--accent-tint)', display: 'grid', placeItems: 'center' }}>
            <Icon name="ph ph-user" size={22} color="var(--accent-pressed)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="kd-body" style={{ fontWeight: 500 }}>
              {session?.kind === 'account' ? session.email : 'ใช้งานแบบไม่สมัครสมาชิก'}
            </div>
            <div className="kd-caption kd-muted">
              {session?.kind === 'account' ? 'ข้อมูลซิงก์ให้ทุกเครื่องที่ล็อกอิน' : 'ข้อมูลเก็บอยู่ในเครื่องนี้ ยังไม่ได้สำรอง'}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
          {[
            ['น้ำหนักตอนนี้', `${profile?.weight ?? '—'} กก.`],
            ['เป้าต่อวัน', `${num(profile?.target ?? 0)}`],
            ['ใช้แอปมา', `${daysUsed} วัน`],
          ].map(([label, value]) => (
            <div key={label} className="kd-card" style={{ padding: 12 }}>
              <div className="kd-caption kd-muted">{label}</div>
              <div className="tnum" style={{ fontSize: 16, fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>

        {contributions > 0 && (
          <div className="kd-card kd-row" style={{ padding: 14, gap: 10, marginTop: 10 }}>
            <Icon name="ph ph-heart" size={20} color="var(--accent-pressed)" />
            <span className="kd-body">ช่วยเพิ่มสินค้าแล้ว {contributions} รายการ</span>
          </div>
        )}

        <div className="kd-card" style={{ marginTop: 14, overflow: 'hidden' }}>
          {billingEnabled && (
            <>
              <button className="kd-row" style={{ width: '100%', padding: 14, gap: 10, minHeight: 52 }} onClick={onOpenPricing}>
                <Icon name="ph ph-crown" size={20} color="var(--accent-pressed)" />
                <span style={{ flex: 1, textAlign: 'left' }}>
                  <span style={{ display: 'block' }}>แพ็กเกจและสมาชิก</span>
                  <span className="kd-caption kd-muted">Free · Plus · Pro · Unlimited</span>
                </span>
                <Icon name="ph ph-caret-right" size={16} color="var(--text-muted)" />
              </button>
              <div style={{ borderTop: '1px solid var(--border)' }} />
            </>
          )}
          <button className="kd-row" style={{ width: '100%', padding: 14, gap: 10, minHeight: 52 }} onClick={onOpenLeaderboard}>
            <Icon name="ph ph-trophy" size={20} color="var(--accent-pressed)" />
            <span style={{ flex: 1, textAlign: 'left' }}>
              <span style={{ display: 'block' }}>อันดับประจำเดือน</span>
              <span className="kd-caption kd-muted">แข่งกันจดอาหารให้ครบทุกวัน</span>
            </span>
            <Icon name="ph ph-caret-right" size={16} color="var(--text-muted)" />
          </button>
          <div style={{ borderTop: '1px solid var(--border)' }} />
          <button className="kd-row" style={{ width: '100%', padding: 14, gap: 10, minHeight: 52 }} onClick={onEditTarget}>
            <Icon name="ph ph-fire" size={20} color="var(--accent-pressed)" />
            <span style={{ flex: 1, textAlign: 'left' }}>เป้าหมาย</span>
            <Icon name="ph ph-caret-right" size={16} color="var(--text-muted)" />
          </button>
          <div style={{ borderTop: '1px solid var(--border)' }} />
          <button className="kd-row" style={{ width: '100%', padding: 14, gap: 10, minHeight: 52 }} onClick={onOpenBody}>
            <Icon name="ph ph-ruler" size={20} color="var(--accent-pressed)" />
            <span style={{ flex: 1, textAlign: 'left' }}>ติดตามรูปร่าง</span>
            <Icon name="ph ph-caret-right" size={16} color="var(--text-muted)" />
          </button>
          <div style={{ borderTop: '1px solid var(--border)' }} />
          <label className="kd-row" style={{ padding: 14, gap: 10, minHeight: 52, cursor: 'pointer' }}>
            <Icon name="ph ph-chart-bar" size={20} color="var(--accent-pressed)" />
            <span style={{ flex: 1 }}>แสดง macro บนหน้าวันนี้</span>
            <input type="checkbox" checked={showMacros} onChange={(e) => setShowMacros(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
          </label>
        </div>

        <div className="kd-card" style={{ marginTop: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 14px 8px' }}>
            <div className="kd-body" style={{ fontWeight: 500 }}>สำรองและเรียกคืนข้อมูล</div>
            <p className="kd-caption kd-muted" style={{ marginTop: 3 }}>
              เก็บอาหาร น้ำดื่ม ออกกำลังกาย รูปร่าง และเป้าหมายเป็นไฟล์ .json ไว้ย้ายเครื่องหรือกันข้อมูลหาย ใช้ได้แม้ไม่สมัครสมาชิก
            </p>
          </div>
          <button className="kd-row" style={{ width: '100%', padding: 14, gap: 10, minHeight: 50, borderTop: '1px solid var(--border)' }} onClick={exportBackup} disabled={backupBusy}>
            <Icon name="ph ph-export" size={20} color="var(--accent-pressed)" />
            <span style={{ flex: 1, textAlign: 'left' }}>ส่งออกไฟล์สำรอง</span>
          </button>
          <button className="kd-row" style={{ width: '100%', padding: 14, gap: 10, minHeight: 50, borderTop: '1px solid var(--border)' }} onClick={() => fileInput.current?.click()} disabled={backupBusy}>
            <Icon name="ph ph-upload-simple" size={20} color="var(--accent-pressed)" />
            <span style={{ flex: 1, textAlign: 'left' }}>{backupBusy ? 'กำลังทำงาน…' : 'เรียกคืนจากไฟล์สำรอง'}</span>
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => void importBackup(e.target.files?.[0])} />
        </div>

        <button className="kd-card kd-row" style={{ width: '100%', padding: 14, gap: 12, marginTop: 14, textAlign: 'left' }} onClick={() => setDonateOpen(true)}>
          <Icon name="ph-fill ph-coffee" size={24} color="var(--ledger-debit)" />
          <span style={{ flex: 1 }}>
            <span className="kd-body" style={{ display: 'block', fontWeight: 500 }}>เลี้ยงกาแฟทีมพัฒนา</span>
            <span className="kd-caption kd-muted">KinDee ใช้ฟรีทุกฟีเจอร์ สนับสนุนตามสะดวกผ่าน QR พร้อมเพย์</span>
          </span>
          <Icon name="ph ph-caret-right" size={16} color="var(--text-muted)" />
        </button>

        {donateOpen && (
          <Sheet onClose={() => setDonateOpen(false)} labelledBy="donate-title">
            <div style={{ padding: '4px 20px 24px', display: 'grid', gap: 12, textAlign: 'center' }}>
              <h2 id="donate-title" className="kd-h2">สนับสนุนค่ากาแฟ</h2>
              <p className="kd-caption kd-muted">แอปนี้ใช้งานฟรี ทุกกำลังใจช่วยให้เราพัฒนาต่อได้ สแกนด้วยแอปธนาคาร หรือบันทึกรูปไว้สแกนทีหลัง</p>
              {qrFailed ? (
                <p className="kd-caption">ยังไม่ได้ตั้งค่า QR สำหรับรับบริจาค</p>
              ) : (
                <img className="kd-donate-qr" src={donateQrUrl} alt="QR พร้อมเพย์สำหรับสนับสนุนค่ากาแฟ" onError={() => setQrFailed(true)} />
              )}
              {!qrFailed && (
                <div className="kd-card" style={{ padding: 12, display: 'grid', gap: 4 }}>
                  <span className="kd-caption kd-muted">ชื่อผู้รับ</span>
                  <strong className="kd-body">{donateRecipient}</strong>
                  <span className="kd-caption kd-muted">ตรวจให้ตรงกับชื่อที่ขึ้นในแอปธนาคารก่อนโอน</span>
                </div>
              )}
              {!qrFailed && <a className="kd-btn kd-btn-outline" href={donateQrUrl} download="kindee-donate-qr.png">บันทึกรูป QR</a>}
              <p className="kd-caption" style={{ color: 'var(--warn-text)' }}>
                <Icon name="ph ph-shield-warning" size={14} /> KinDee รับสนับสนุนผ่าน QR ในแอปนี้เท่านั้น ไม่มีการทักแชตหรือโทรไปขอเงิน
              </p>
              <p className="kd-caption kd-muted">{qrFailed ? '' : 'ถ้าบันทึกไม่ได้ ให้แตะค้างที่รูปเพื่อบันทึก · '}ไม่สนับสนุนก็ใช้ได้เหมือนเดิมทุกอย่าง</p>
            </div>
          </Sheet>
        )}

        <div className="kd-card" style={{ padding: 14, marginTop: 14 }}>
          <div className="kd-body" style={{ fontWeight: 500, marginBottom: 6 }}>เครดิตแหล่งข้อมูลโภชนาการ</div>
          <p className="kd-caption kd-muted">
            ค่าโภชนาการของเมนูอาหารไทยเป็นค่าประมาณที่ KinDee รวบรวมจากส่วนประกอบของแต่ละเมนู ไม่ใช่ค่าจากห้องปฏิบัติการ ·
            ข้อมูลสินค้าที่ได้จากการสแกนบาร์โค้ดมาจาก Open Food Facts (ODbL) · รายการที่จดเองมาจากข้อมูลที่คุณกรอก
          </p>
        </div>

        <div className="kd-card" style={{ marginTop: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 14px 8px' }}>
            <div className="kd-body" style={{ fontWeight: 500 }}>ข้อมูลและความเป็นส่วนตัว</div>
            <p className="kd-caption kd-muted" style={{ marginTop: 3 }}>
              ใช้สิทธิได้ในแอปหรืออีเมล <a href={`mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail}</a>
            </p>
          </div>
          {[
            ['เงื่อนไขการใช้งาน', 'ph ph-file-text', () => onOpenLegal('terms')],
            ['ประกาศความเป็นส่วนตัว', 'ph ph-shield-check', () => onOpenLegal('privacy')],
          ].map(([label, icon, action]) => (
            <button key={label as string} className="kd-row" style={{ width: '100%', padding: 14, gap: 10, minHeight: 50, borderTop: '1px solid var(--border)' }} onClick={action as () => void}>
              <Icon name={icon as string} size={20} color="var(--accent-pressed)" />
              <span style={{ flex: 1, textAlign: 'left' }}>{label as string}</span>
              <Icon name="ph ph-caret-right" size={16} color="var(--text-muted)" />
            </button>
          ))}
          <button className="kd-row" style={{ width: '100%', padding: 14, gap: 10, minHeight: 50, borderTop: '1px solid var(--border)' }} onClick={exportData} disabled={privacyBusy !== null}>
            <Icon name="ph ph-download-simple" size={20} color="var(--accent-pressed)" />
            <span style={{ flex: 1, textAlign: 'left' }}>{privacyBusy === 'export' ? 'กำลังรวบรวมข้อมูล…' : 'ส่งออกข้อมูลของฉัน (.json)'}</span>
          </button>
          <button className="kd-row" style={{ width: '100%', padding: 14, gap: 10, minHeight: 50, borderTop: '1px solid var(--border)', color: '#a53636' }} onClick={removeAllData} disabled={privacyBusy !== null}>
            <Icon name="ph ph-trash" size={20} color="#a53636" />
            <span style={{ flex: 1, textAlign: 'left' }}>
              {privacyBusy === 'delete' ? 'กำลังลบ…' : confirmDelete ? 'แตะอีกครั้งเพื่อยืนยันการลบถาวร' : session?.kind === 'account' ? 'ลบบัญชีและข้อมูลทั้งหมด' : 'ลบข้อมูลทั้งหมดในเครื่อง'}
            </span>
          </button>
          {confirmDelete && (
            <button className="kd-btn-text" style={{ width: '100%', padding: '8px 14px 14px' }} onClick={() => setConfirmDelete(false)} disabled={privacyBusy !== null}>ยกเลิก</button>
          )}
        </div>

        <div className="kd-card" style={{ marginTop: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 14px 8px' }}>
            <div className="kd-body" style={{ fontWeight: 500 }}>บอกเราหน่อยว่าใช้แล้วเป็นยังไง</div>
            <p className="kd-caption kd-muted" style={{ marginTop: 3 }}>
              ติดตรงไหน อยากได้อะไรเพิ่ม บอกได้เลย ข้อความจะถูกส่งให้ทีมพัฒนาพร้อมรุ่นของแอป ไม่มีข้อมูลอาหารหรือน้ำหนักติดไปด้วย
            </p>
          </div>
          <div style={{ padding: '0 14px 14px', display: 'grid', gap: 10 }}>
            <div className="kd-row" style={{ gap: 6 }}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  className={`kd-chip${rating === value ? ' on' : ''}`}
                  style={{ flex: 1, minWidth: 0 }}
                  aria-pressed={rating === value}
                  aria-label={`ให้คะแนน ${value} จาก 5`}
                  onClick={() => setRating(rating === value ? null : value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <textarea
              className="kd-input"
              style={{ minHeight: 88, padding: 12, resize: 'vertical' }}
              placeholder="เช่น หาเมนูไม่เจอ ปุ่มกดยาก หรืออยากได้อะไรเพิ่ม"
              value={feedback}
              maxLength={500}
              onChange={(e) => {
                setFeedback(e.target.value)
                if (feedbackState !== 'idle') setFeedbackState('idle')
              }}
            />
            <button
              className="kd-btn kd-btn-primary"
              disabled={!feedback.trim() || feedbackState === 'sending'}
              onClick={submitFeedback}
            >
              <Icon name="ph ph-paper-plane-tilt" size={20} />
              {feedbackState === 'sending' ? 'กำลังส่ง…' : 'ส่งให้ทีมพัฒนา'}
            </button>
            {feedbackState === 'sent' && (
              <p className="kd-caption" role="status" style={{ color: 'var(--accent-pressed)' }}>ส่งแล้ว ขอบคุณมากนะ</p>
            )}
            {feedbackState === 'failed' && (
              <p className="kd-caption" role="alert" style={{ color: '#a53636' }}>ส่งไม่สำเร็จ ลองใหม่อีกครั้งตอนออนไลน์</p>
            )}
          </div>
        </div>

        <button className="kd-btn kd-btn-outline" style={{ marginTop: 14 }} onClick={async () => {
          if (session?.kind === 'account') {
            await supabase?.auth.signOut()
            await clearDeviceData()
            reset()
          } else {
            setSession(null)
          }
        }}>
          {session?.kind === 'account' ? 'ออกจากระบบ' : 'สำรองข้อมูลฟรี'}
        </button>
      </div>
    </div>
  )
}
