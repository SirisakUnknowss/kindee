import { StyleSheet } from 'react-native'

/** KinDee "Calorie Ledger" brand theme, ported from the web app's CSS variables. */
export const C = {
  bg: '#f5f1e8',
  surface: '#fffdf7',
  border: '#e1dbcd',
  borderStrong: '#c9c1b2',
  text: '#24322d',
  muted: '#626b65',
  bodyAlt: '#435149',
  accent: '#3f7d68',
  accentPressed: '#285c50',
  accentLine: '#72a493',
  accentTint: '#ddece6',
  accentTintSoft: '#f0f7f3',
  onAccent: '#ffffff',
  onTint: '#1f5142',
  ledgerCredit: '#31705a',
  ledgerDebit: '#9a6234',
  ledgerRule: '#d8d0c0',
  statusFar: '#abc8b9',
  statusMid: '#78a792',
  statusNear: '#4c866e',
  statusOver: '#c58a2d',
  danger: '#b4534c',
  warnText: '#8a5a2a',
  disabled: '#b2c9bf',
  cam: '#1b1d26',
} as const

export const R = { card: 16, btn: 12, sheet: 22 } as const

export const T = StyleSheet.create({
  display: { fontSize: 46, lineHeight: 52, fontWeight: '500', color: C.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  h1: { fontSize: 24, lineHeight: 34, fontWeight: '500', color: C.text },
  h2: { fontSize: 18, lineHeight: 26, fontWeight: '500', color: C.text },
  body: { fontSize: 13.5, lineHeight: 22, color: C.text },
  label: { fontSize: 12.5, lineHeight: 19, color: C.text },
  caption: { fontSize: 11.5, lineHeight: 18, color: C.text },
  muted: { color: C.muted },
  tnum: { fontVariant: ['tabular-nums'] },
})

export const shadow = {
  card: { shadowColor: '#544834', shadowOpacity: 0.05, shadowRadius: 0, shadowOffset: { width: 0, height: 2 }, elevation: 0 },
  fab: { shadowColor: '#3f7d68', shadowOpacity: 0.36, shadowRadius: 11, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  toast: { shadowColor: '#25322e', shadowOpacity: 0.28, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
} as const
