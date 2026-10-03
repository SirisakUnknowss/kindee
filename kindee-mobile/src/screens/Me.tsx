import { useState } from 'react'
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { Button, Card, Checkbox, Chip, Field, Icon, Row, Screen } from '../components/ui'
import { legalConfig } from '../config/legal'
import { num } from '../lib/calc'
import { clearDeviceData, deleteAccount, downloadMyData } from '../lib/privacy'
import { sendFeedback } from '../lib/report'
import { useStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { C, T } from '../theme'

function MenuRow({ icon, label, onPress, disabled, color = C.accentPressed, hint }: { icon: string; label: string; onPress: () => void; disabled?: boolean; color?: string; hint?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 52, borderTopWidth: 1, borderTopColor: C.border }}>
      <Icon name={icon} size={20} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: color === C.accentPressed ? C.text : color, fontSize: 14.5 }}>{label}</Text>
        {hint ? <Text style={[T.caption, T.muted]}>{hint}</Text> : null}
      </View>
      <Icon name="ph ph-caret-right" size={16} color={C.muted} />
    </Pressable>
  )
}

/** หน้า "ฉัน" — โปรไฟล์ เป้าหมาย ความเป็นส่วนตัว และฟีดแบ็ก (ไม่มีหน้าชำระเงินในแอป iOS รอบแรก) */
export function Me({ onEditTarget, onOpenLegal }: { onEditTarget: () => void; onOpenLegal: (tab: 'terms' | 'privacy') => void }) {
  const { profile, session, entries, contributions, showMacros, setShowMacros, setSession, reset, showToast } = useStore()
  const daysUsed = new Set(entries.map((e) => e.day)).size
  const [privacyBusy, setPrivacyBusy] = useState<'export' | 'delete' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [feedbackState, setFeedbackState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  const submitFeedback = async () => {
    setFeedbackState('sending')
    const ok = await sendFeedback(feedback, rating ?? undefined)
    setFeedbackState(ok ? 'sent' : 'failed')
    if (ok) { setFeedback(''); setRating(null) }
  }

  const exportData = async () => {
    if (!session) return
    setPrivacyBusy('export')
    try {
      const warnings = await downloadMyData(session, profile)
      if (warnings.length) Alert.alert('ส่งออกไม่ครบ', 'ส่งออกข้อมูลในเครื่องแล้ว แต่ข้อมูลบนคลาวด์บางส่วนส่งออกไม่สำเร็จ โปรดติดต่อฝ่ายความเป็นส่วนตัว')
    } catch {
      showToast('ส่งออกข้อมูลไม่สำเร็จ ลองอีกครั้งนะ')
    } finally {
      setPrivacyBusy(null)
    }
  }

  const removeAllData = async () => {
    if (!session) return
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
      Alert.alert('ลบข้อมูลไม่สำเร็จ', `โปรดลองเข้าสู่ระบบใหม่หรือติดต่อ ${legalConfig.privacyEmail}`)
      setPrivacyBusy(null)
    }
  }

  const confirmDelete = () => {
    const isAccount = session?.kind === 'account'
    Alert.alert(
      isAccount ? 'ลบบัญชีและข้อมูลทั้งหมด?' : 'ลบข้อมูลทั้งหมดในเครื่อง?',
      isAccount ? 'บัญชีและข้อมูลบนคลาวด์จะถูกลบถาวร ย้อนกลับไม่ได้' : 'รายการอาหารและโปรไฟล์ในเครื่องนี้จะถูกลบถาวร ย้อนกลับไม่ได้',
      [{ text: 'ยกเลิก', style: 'cancel' }, { text: 'ลบถาวร', style: 'destructive', onPress: () => void removeAllData() }],
    )
  }

  const signOut = async () => {
    if (session?.kind === 'account') {
      await supabase?.auth.signOut()
      await clearDeviceData()
      reset()
    } else {
      setSession(null)
    }
  }

  return (
    <Screen>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}><Text style={T.h1}>ฉัน</Text></View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.accentTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="ph ph-user" size={22} color={C.accentPressed} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[T.body, { fontWeight: '500' }]}>{session?.kind === 'account' ? session.email : 'ใช้งานแบบไม่สมัครสมาชิก'}</Text>
            <Text style={[T.caption, T.muted]}>{session?.kind === 'account' ? 'ข้อมูลซิงก์ให้ทุกเครื่องที่ล็อกอิน' : 'ข้อมูลเก็บอยู่ในเครื่องนี้ ยังไม่ได้สำรอง'}</Text>
          </View>
        </Card>

        <Row style={{ gap: 8 }}>
          {[['น้ำหนักตอนนี้', `${profile?.weight ?? '—'} กก.`], ['เป้าต่อวัน', `${num(profile?.target ?? 0)}`], ['ใช้แอปมา', `${daysUsed} วัน`]].map(([label, value]) => (
            <Card key={label} style={{ flex: 1, padding: 12 }}>
              <Text style={[T.caption, T.muted]}>{label}</Text>
              <Text style={[{ fontSize: 16, fontWeight: '500', color: C.text }, T.tnum]}>{value}</Text>
            </Card>
          ))}
        </Row>

        {contributions > 0 && (
          <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
            <Icon name="ph ph-heart" size={20} color={C.accentPressed} />
            <Text style={T.body}>ช่วยเพิ่มสินค้าแล้ว {contributions} รายการ</Text>
          </Card>
        )}

        <Card style={{ overflow: 'hidden' }}>
          <Pressable onPress={onEditTarget} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 52 }}>
            <Icon name="ph ph-fire" size={20} color={C.accentPressed} />
            <Text style={{ flex: 1, fontSize: 14.5, color: C.text }}>เป้าหมาย</Text>
            <Icon name="ph ph-caret-right" size={16} color={C.muted} />
          </Pressable>
          <View style={{ borderTopWidth: 1, borderTopColor: C.border, padding: 14, minHeight: 52 }}>
            <Checkbox checked={showMacros} onChange={setShowMacros}>
              <Text style={{ fontSize: 14.5, color: C.text }}>แสดง macro บนหน้าวันนี้</Text>
            </Checkbox>
          </View>
        </Card>

        <Card style={{ padding: 14 }}>
          <Text style={[T.body, { fontWeight: '500', marginBottom: 6 }]}>เครดิตแหล่งข้อมูลโภชนาการ</Text>
          <Text style={[T.caption, T.muted]}>
            Thai Food Composition Database — สถาบันโภชนาการ มหาวิทยาลัยมหิดล (ใช้เพื่อวัตถุประสงค์ที่ไม่ใช่เชิงพาณิชย์) · Open Food Facts (ODbL) · USDA FoodData Central (public domain) · ข้อมูลที่ผู้ใช้ช่วยกันเพิ่ม
          </Text>
        </Card>

        <Card style={{ overflow: 'hidden' }}>
          <View style={{ padding: 14, paddingBottom: 8 }}>
            <Text style={[T.body, { fontWeight: '500' }]}>ข้อมูลและความเป็นส่วนตัว</Text>
            <Text style={[T.caption, T.muted, { marginTop: 3 }]}>
              ใช้สิทธิได้ในแอปหรืออีเมล <Text style={{ color: C.accentPressed }} onPress={() => Linking.openURL(`mailto:${legalConfig.privacyEmail}`)}>{legalConfig.privacyEmail}</Text>
            </Text>
          </View>
          <MenuRow icon="ph ph-file-text" label="เงื่อนไขการใช้งาน" onPress={() => onOpenLegal('terms')} />
          <MenuRow icon="ph ph-shield-check" label="ประกาศความเป็นส่วนตัว" onPress={() => onOpenLegal('privacy')} />
          <MenuRow icon="ph ph-download-simple" label={privacyBusy === 'export' ? 'กำลังรวบรวมข้อมูล…' : 'ส่งออกข้อมูลของฉัน (.json)'} onPress={exportData} disabled={privacyBusy !== null} />
          <MenuRow
            icon="ph ph-trash"
            color="#a53636"
            label={privacyBusy === 'delete' ? 'กำลังลบ…' : session?.kind === 'account' ? 'ลบบัญชีและข้อมูลทั้งหมด' : 'ลบข้อมูลทั้งหมดในเครื่อง'}
            onPress={confirmDelete}
            disabled={privacyBusy !== null}
          />
        </Card>

        <Card style={{ overflow: 'hidden' }}>
          <View style={{ padding: 14, paddingBottom: 8 }}>
            <Text style={[T.body, { fontWeight: '500' }]}>บอกเราหน่อยว่าใช้แล้วเป็นยังไง</Text>
            <Text style={[T.caption, T.muted, { marginTop: 3 }]}>ติดตรงไหน อยากได้อะไรเพิ่ม บอกได้เลย ข้อความจะถูกส่งให้ทีมพัฒนาพร้อมรุ่นของแอป ไม่มีข้อมูลอาหารหรือน้ำหนักติดไปด้วย</Text>
          </View>
          <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
            <Row style={{ gap: 6 }}>
              {[1, 2, 3, 4, 5].map((v) => (
                <Chip key={v} on={rating === v} onPress={() => setRating(rating === v ? null : v)} style={{ flex: 1 }}>{String(v)}</Chip>
              ))}
            </Row>
            <Field
              multiline maxLength={500} placeholder="เช่น หาเมนูไม่เจอ ปุ่มกดยาก หรืออยากได้อะไรเพิ่ม"
              value={feedback}
              onChangeText={(t) => { setFeedback(t); if (feedbackState !== 'idle') setFeedbackState('idle') }}
            />
            <Button disabled={!feedback.trim()} loading={feedbackState === 'sending'} onPress={submitFeedback} icon={<Icon name="ph ph-paper-plane-tilt" size={20} color="#fff" />}>
              {feedbackState === 'sending' ? 'กำลังส่ง…' : 'ส่งให้ทีมพัฒนา'}
            </Button>
            {feedbackState === 'sent' && <Text style={[T.caption, { color: C.accentPressed }]}>ส่งแล้ว ขอบคุณมากนะ</Text>}
            {feedbackState === 'failed' && <Text style={[T.caption, { color: '#a53636' }]}>ส่งไม่สำเร็จ ลองใหม่อีกครั้งตอนออนไลน์</Text>}
          </View>
        </Card>

        <Button variant="outline" onPress={signOut}>{session?.kind === 'account' ? 'ออกจากระบบ' : 'สำรองข้อมูลฟรี'}</Button>
      </ScrollView>
    </Screen>
  )
}
