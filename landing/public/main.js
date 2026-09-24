// Contact form: client-side checks, then POST /api/contact (landing/functions/api/contact.ts).
(() => {
  const form = document.getElementById('contact-form')
  const status = document.getElementById('c-status')
  const submit = document.getElementById('c-submit')
  const topic = document.getElementById('c-topic')
  if (!form) return

  const MESSAGES = {
    th: {
      name: 'กรอกชื่อ',
      email: 'กรอกอีเมลให้ถูกต้อง เช่น name@example.com',
      message: 'เขียนข้อความอย่างน้อย 10 ตัวอักษร',
      consent: 'ติ๊กยินยอมให้เราใช้อีเมลเพื่อตอบกลับก่อนส่ง',
      sending: 'กำลังส่ง…',
      sent: 'ได้รับข้อความแล้ว ทีมงานจะตอบกลับทางอีเมลที่คุณให้ไว้',
      limited: 'ส่งหลายครั้งเกินไปในช่วงนี้ ลองใหม่อีกครั้งในอีกหนึ่งชั่วโมง',
      failed: (email) => `ส่งไม่สำเร็จ ลองอีกครั้ง หรืออีเมลถึง ${email}`,
      offline: 'เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง',
    },
    en: {
      name: 'Enter your name',
      email: 'Enter a valid email, e.g. name@example.com',
      message: 'Write a message of at least 10 characters',
      consent: 'Tick the consent box so we can use your email to reply',
      sending: 'Sending…',
      sent: 'Message received. We’ll reply to the email you gave us.',
      limited: 'Too many messages just now. Please try again in an hour.',
      failed: (email) => `Couldn’t send. Try again, or email ${email}`,
      offline: 'Can’t connect. Check your internet and try again.',
    },
  }
  const t = () => MESSAGES[window.kdLang?.() === 'en' ? 'en' : 'th']

  // "Join the beta" links preselect the matching topic.
  document.querySelectorAll('a[data-topic]').forEach((link) => {
    link.addEventListener('click', () => { topic.value = link.dataset.topic })
  })

  // A status line written in one language shouldn't linger after switching.
  document.addEventListener('kd:lang', () => say(''))

  function say(text, kind) {
    status.textContent = text
    status.className = `form-status ${kind ?? ''}`
  }

  const fields = {
    name: document.getElementById('c-name'),
    email: document.getElementById('c-email'),
    message: document.getElementById('c-message'),
  }

  const invalidField = () => {
    for (const el of Object.values(fields)) el.removeAttribute('aria-invalid')
    if (!fields.name.value.trim()) return 'name'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.value.trim())) return 'email'
    if (fields.message.value.trim().length < 10) return 'message'
    return null
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const bad = invalidField()
    if (bad) {
      fields[bad].setAttribute('aria-invalid', 'true')
      fields[bad].focus()
      say(t()[bad], 'err')
      return
    }
    if (!document.getElementById('c-consent').checked) {
      say(t().consent, 'err')
      return
    }

    submit.disabled = true
    say(t().sending)
    const data = Object.fromEntries(new FormData(form))
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          topic: data.topic,
          message: data.message,
          consent: true,
          website: data.website,
        }),
      })
      if (response.ok) {
        form.reset()
        say(t().sent, 'ok')
      } else if (response.status === 429) {
        say(t().limited, 'err')
      } else {
        say(t().failed(document.getElementById('support-email').textContent), 'err')
      }
    } catch {
      say(t().offline, 'err')
    } finally {
      submit.disabled = false
    }
  })
})()
