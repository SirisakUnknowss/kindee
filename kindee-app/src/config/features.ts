// KinDee is free with a donation QR for now. Paid plans (Stripe) stay in the code and
// come back by building with VITE_BILLING_ENABLED=true.
export const billingEnabled = import.meta.env.VITE_BILLING_ENABLED === 'true'

/** PromptPay QR card as PNG (bank apps scanning from the gallery may not read WebP). */
export const donateQrUrl = import.meta.env.VITE_DONATE_QR_URL || '/donate-qr.png'

/** Shown under the QR so donors can match the name their bank app displays. */
export const donateRecipient = import.meta.env.VITE_DONATE_RECIPIENT || 'นาย ศิริศักดิ์ แดงเด่นศรี'
