export const LEGAL_VERSION = '2026-09-15'
export const PHOTO_AI_CONSENT_VERSION = 'photo-ai-2026-09-15'

export const legalConfig = {
  controllerName: import.meta.env.VITE_DATA_CONTROLLER_NAME?.trim() || 'ผู้ให้บริการแอปพลิเคชัน KinDee',
  controllerAddress: import.meta.env.VITE_DATA_CONTROLLER_ADDRESS?.trim() || 'ประเทศไทย',
  privacyEmail: import.meta.env.VITE_PRIVACY_EMAIL?.trim() || 'privacy@kindee.app',
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL?.trim() || 'support@kindee.app',
} as const

