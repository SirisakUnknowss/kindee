// Contact form: client-side checks, then POST /api/contact (landing/functions/api/contact.ts).
(() => {
  const form = document.getElementById('contact-form')
  const status = document.getElementById('c-status')
  const submit = document.getElementById('c-submit')
  const topic = document.getElementById('c-topic')
  if (!form) return

  // "สมัครร่วมทดสอบ" buttons preselect the matching topic.
  document.querySelectorAll('a[data-topic]').forEach((link) => {
    link.addEventListener('click', () => { topic.value = link.dataset.topic })
  })

  const say = (text, kind) => {
    status.textContent = text
    status.className = `form-status ${kind ?? ''}`
  }

  const fields = {
    name: { el: document.getElementById('c-name'), msg: 'กรอกชื่อ' },
    email: { el: document.getElementById('c-email'), msg: 'กรอกอีเมลให้ถูกต้อง เช่น name@example.com' },
    message: { el: document.getElementById('c-message'), msg: 'เขียนข้อความอย่างน้อย 10 ตัวอักษร' },
  }

  const validate = () => {
    for (const f of Object.values(fields)) f.el.removeAttribute('aria-invalid')
    const name = fields.name.el.value.trim()
    const email = fields.email.el.value.trim()
    const message = fields.message.el.value.trim()
    if (!name) return fields.name
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fields.email
    if (message.length < 10) return fields.message
    return null
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const bad = validate()
    if (bad) {
      bad.el.setAttribute('aria-invalid', 'true')
      bad.el.focus()
      say(bad.msg, 'err')
      return
    }
    if (!document.getElementById('c-consent').checked) {
      say('ติ๊กยินยอมให้เราใช้อีเมลเพื่อตอบกลับก่อนส่ง', 'err')
      return
    }

    submit.disabled = true
    say('กำลังส่ง…')
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
        say('ได้รับข้อความแล้ว ทีมงานจะตอบกลับทางอีเมลที่คุณให้ไว้', 'ok')
      } else if (response.status === 429) {
        say('ส่งหลายครั้งเกินไปในช่วงนี้ ลองใหม่อีกครั้งในอีกหนึ่งชั่วโมง', 'err')
      } else {
        const email = document.getElementById('support-email').textContent
        say(`ส่งไม่สำเร็จ ลองอีกครั้ง หรืออีเมลถึง ${email}`, 'err')
      }
    } catch {
      say('เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง', 'err')
    } finally {
      submit.disabled = false
    }
  })
})()
