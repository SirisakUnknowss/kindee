import { useState } from 'react'
import { Linking, ScrollView, Text, View } from 'react-native'
import { Chip, Header, Row, Screen } from '../components/ui'
import { legalConfig } from '../config/legal'
import { DOC, type LegalTab } from '../content/legal'
import { C, R, T } from '../theme'

export function Terms({ onBack, initialTab = 'terms' }: { onBack: () => void; initialTab?: LegalTab }) {
  const [tab, setTab] = useState<LegalTab>(initialTab)
  const doc = DOC[tab]
  return (
    <Screen>
      <Header title="ข้อกำหนดและความเป็นส่วนตัว" onBack={onBack} />
      <Row style={{ gap: 6, paddingHorizontal: 16, paddingBottom: 12 }}>
        {(['terms', 'privacy'] as const).map((value) => (
          <Chip key={value} on={tab === value} onPress={() => setTab(value)} style={{ flex: 1, borderRadius: 12 }}>
            {value === 'terms' ? 'เงื่อนไขการใช้งาน' : 'ประกาศความเป็นส่วนตัว'}
          </Chip>
        ))}
      </Row>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <Text style={[T.caption, T.muted]}>{doc.updated}</Text>
        <View style={{ backgroundColor: C.accentTintSoft, borderWidth: 1, borderColor: C.accentLine, borderRadius: R.card, padding: 14, marginTop: 12, marginBottom: 20 }}>
          <Text style={[T.label, { fontWeight: '500', marginBottom: 6 }]}>สรุปสั้น ๆ</Text>
          {doc.summary.map((item) => (
            <Text key={item} style={[T.body, { color: C.bodyAlt, marginBottom: 4 }]}>• {item}</Text>
          ))}
        </View>
        <View style={{ gap: 20 }}>
          {doc.sections.map(([title, body]) => (
            <View key={title}>
              <Text style={{ fontSize: 15.5, fontWeight: '500', lineHeight: 22, marginBottom: 6, color: C.text }}>{title}</Text>
              <Text style={{ fontSize: 13.5, lineHeight: 24, color: C.bodyAlt }}>{body}</Text>
            </View>
          ))}
        </View>
        <Text style={[T.caption, T.muted, { marginTop: 24 }]}>
          ติดต่อผู้ควบคุมข้อมูล:{' '}
          <Text style={{ color: C.accentPressed }} onPress={() => Linking.openURL(`mailto:${legalConfig.privacyEmail}`)}>{legalConfig.privacyEmail}</Text>
        </Text>
      </ScrollView>
    </Screen>
  )
}
