export const LEGAL_VERSION = '2026-09-20'

export const legalConfig = {
  controllerName: process.env.EXPO_PUBLIC_DATA_CONTROLLER_NAME?.trim() || 'ผู้ให้บริการแอปพลิเคชัน KinDee',
  controllerAddress: process.env.EXPO_PUBLIC_DATA_CONTROLLER_ADDRESS?.trim() || 'ประเทศไทย',
  privacyEmail: process.env.EXPO_PUBLIC_PRIVACY_EMAIL?.trim() || 'privacy@kindee.app',
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@kindee.app',
} as const
