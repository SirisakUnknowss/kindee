import { Icon } from '../components/ui'
import { num } from '../lib/calc'
import { useStore } from '../lib/store'

/** หน้า 23 ฉัน — ระดับ wireframe (P1) พร้อมทางเข้าแก้เป้าหมายและตั้งค่าที่จำเป็น */
export function Me({ onEditTarget }: { onEditTarget: () => void }) {
  const { profile, session, entries, contributions, showMacros, setShowMacros, reset } = useStore()
  const daysUsed = new Set(entries.map((e) => e.day)).size

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
            <div className="kd-body" style={{ fontWeight: 500 }}>{session?.email ?? 'ยังไม่ได้เข้าสู่ระบบ'}</div>
            <div className="kd-caption kd-muted">ข้อมูลซิงก์ให้ทุกเครื่องที่ล็อกอิน</div>
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
          <button className="kd-row" style={{ width: '100%', padding: 14, gap: 10, minHeight: 52 }} onClick={onEditTarget}>
            <Icon name="ph ph-fire" size={20} color="var(--accent-pressed)" />
            <span style={{ flex: 1, textAlign: 'left' }}>เป้าหมาย</span>
            <Icon name="ph ph-caret-right" size={16} color="var(--text-muted)" />
          </button>
          <div style={{ borderTop: '1px solid var(--border)' }} />
          <label className="kd-row" style={{ padding: 14, gap: 10, minHeight: 52, cursor: 'pointer' }}>
            <Icon name="ph ph-chart-bar" size={20} color="var(--accent-pressed)" />
            <span style={{ flex: 1 }}>แสดง macro บนหน้าวันนี้</span>
            <input type="checkbox" checked={showMacros} onChange={(e) => setShowMacros(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
          </label>
        </div>

        <div className="kd-card" style={{ padding: 14, marginTop: 14 }}>
          <div className="kd-body" style={{ fontWeight: 500, marginBottom: 6 }}>เครดิตแหล่งข้อมูลโภชนาการ</div>
          <p className="kd-caption kd-muted">
            Thai Food Composition Database — สถาบันโภชนาการ มหาวิทยาลัยมหิดล (ใช้เพื่อวัตถุประสงค์ที่ไม่ใช่เชิงพาณิชย์) ·
            Open Food Facts (ODbL) · USDA FoodData Central (public domain) · ข้อมูลที่ผู้ใช้ช่วยกันเพิ่ม
          </p>
        </div>

        <button className="kd-btn kd-btn-outline" style={{ marginTop: 14 }} onClick={reset}>
          ออกจากระบบ
        </button>
        <p className="kd-caption kd-muted" style={{ marginTop: 12 }}>
          หน้าอื่น ๆ (ข้อมูลส่วนตัว · บันทึกน้ำหนัก · ตั้งค่าเต็ม · ลบบัญชี · ส่งออก CSV) อยู่ในลำดับ P2 ยังไม่ได้ทำในรอบนี้
        </p>
      </div>
    </div>
  )
}
