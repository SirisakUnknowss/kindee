// Language (TH/EN) and theme (system/light/dark) preferences.
// Thai is written in the HTML itself; this file holds English and swaps text by
// data-i18n keys. The original Thai is captured from the DOM on first run so
// switching back needs no second dictionary.
(() => {
  const EN = {
    'meta.title': 'KinDee — Eat well within your TDEE',
    'meta.description': 'KinDee is a calorie counter built for Thai food. Set a daily calorie budget from your TDEE and log meals by plate, ladle or skewer in seconds. Free to start, no sign-up needed.',
    skip: 'Skip to content',
    'nav.label': 'Main menu',
    'nav.home': 'KinDee home',
    'nav.contact': 'Contact',
    'nav.cta': 'Try it free',
    'prefs.langLabel': 'Switch to Thai',
    'prefs.themeLabel': 'Theme',
    'prefs.system': 'Match system',
    'prefs.light': 'Light',
    'prefs.dark': 'Dark',

    'hero.badge': 'Now open for early testers',
    'hero.title': '<span class="soft">Eat well,</span><br><span class="nowrap">count easy</span>',
    'hero.lede': 'KinDee sets a daily calorie budget from your TDEE, then lets you log Thai food by the <b>plate, ladle or skewer</b> in seconds. See right away how much of today’s budget is left.',
    'hero.cta': 'Start free — no sign-up',
    'hero.beta': 'Join the beta',
    'hero.trustLabel': 'Highlights',
    'hero.trust1': '<b>1,300+</b> Thai dishes',
    'hero.trust2': 'Works offline',
    'hero.trust3': 'PDPA-compliant data',
    'hero.shotAlt': 'KinDee Today screen showing 1,190 kcal left of a 1,810 kcal budget',
    'hero.floatDish': 'Basil pork with fried egg',
    'hero.floatMeta': '1 plate · logged',
    'hero.floatLeft': 'Left for today',

    'why.title': 'Made for people who eat Thai food',
    'why.lede': 'Foreign calorie apps can’t find Thai dishes, make you weigh everything in grams and leave you feeling guilty. KinDee fixes all three.',
    'why.1t': 'Find every Thai dish',
    'why.1p': 'Pad kra pao, khao kha moo, som tam — they’re all in the catalogue, and a misspelled tone mark still finds them.',
    'why.2t': 'Use the portions you know',
    'why.2p': 'Pick a plate, bowl, ladle, skewer or glass and KinDee turns it into calories for you.',
    'why.3t': 'No judgement, no guilt',
    'why.3p': 'Used up your budget? You just see the honest total — no red, no scolding — so you keep logging every day.',

    'show.label': 'Features',
    'show.searchAlt': 'Searching “kra pao” finds basil pork with fried egg at 620 kcal per plate',
    'show.searchEyebrow': 'Search',
    'show.searchTitle': 'Type a few letters, find your meal',
    'show.searchText': 'More than 1,300 Thai foods, sorted into one-plate dishes, packaged snacks and drinks. Meals you’ve eaten before come first, so repeating one takes a single tap.',
    'show.portionAlt': 'Choosing plate, ladle or bowl and a quantity from half to two plates, totalling 620 kcal',
    'show.portionEyebrow': 'Portions',
    'show.portionTitle': 'Half a plate, one ladle, two skewers',
    'show.portionText': 'Choose amounts the way you order food. No guessing grams — though you can enter grams when you want precision.',

    'mini.1t': 'Barcode scan',
    'mini.1p': 'Scan convenience-store products and confirm before logging.',
    'mini.2t': 'Photo with AI',
    'mini.2p': 'AI suggests close matches; you always choose and confirm.',
    'mini.3t': 'Works offline',
    'mini.3p': 'Saves on your phone first and syncs when you’re back online.',
    'mini.4t': 'Backup across devices',
    'mini.4p': 'Create a free account when you’re ready — nothing you logged is lost.',

    'how.eyebrow': 'Start in 3 steps',
    'how.title': 'No sign-up first. Open it and go.',
    'how.1t': 'Set your daily budget',
    'how.1p': 'Enter sex, age, height, weight, activity and goal. KinDee calculates your TDEE with the Mifflin–St Jeor formula and never sets a target below a safe minimum.',
    'how.2t': 'Log every meal',
    'how.2p': 'Pick from recent meals, search, scan a barcode or snap a photo, then choose a familiar portion.',
    'how.3t': 'See what’s left',
    'how.3p': 'Know instantly how much budget is left for your next meal. Want a backup? Create a free account any time.',

    'plans.eyebrow': 'Plans',
    'plans.title': 'Basic logging is free forever',
    'plans.lede': 'Paid plans add long-term history and more AI photo analysis, with a 30-day free trial the first time. The real price is always shown in the app before you confirm.',
    'plans.caption': 'KinDee plan comparison',
    'plans.feature': 'Feature',
    'plans.pick': 'Recommended',
    'plans.r1': 'TDEE calculation and food logging',
    'plans.r2': 'Thai food search, barcode scan, offline use',
    'plans.r3': 'Backup and sync across devices',
    'plans.r4': 'History and trends',
    'plans.r5': 'AI photo analyses per month',
    'plans.r6': 'Advanced goals and macros',
    'plans.r7': 'Early access to new features',
    'plans.basic': 'Basic',
    'plans.unlimited': 'Unlimited',
    'plans.fair': 'Fair use',

    'privacy.eyebrow': 'Privacy',
    'privacy.title': 'Your health data stays in your hands',
    'privacy.1': '<b>On your phone first</b>Until you sign up, everything is stored only on your phone.',
    'privacy.2': '<b>We ask before any photo</b>Food photos go to AI only after you give separate consent.',
    'privacy.3': '<b>Export or delete any time</b>Download your data or delete your account from the “Me” tab whenever you like.',
    'privacy.4': '<b>Built for PDPA</b>A Thai privacy notice sets out exactly why we keep data and for how long. For users aged 18 and over.',

    'faq.eyebrow': 'FAQ',
    'faq.title': 'Before you start',
    'faq.1q': 'Do I need to sign up first?',
    'faq.1a': 'No. Open the app, set your budget and start logging right away. A free account is only for backup and using more than one device.',
    'faq.2q': 'Do I download it from the App Store or Play Store?',
    'faq.2a': 'No. KinDee is a web app (PWA). Open it in your browser and tap “Add to Home Screen” — it then works like any app, even offline.',
    'faq.3q': 'How accurate are the calorie numbers?',
    'faq.3a': 'They are estimates based on a food database and standard portions; the same dish varies between shops. KinDee helps you see the big picture of what you eat — it isn’t medical advice. If you have a health condition, talk to a doctor or dietitian.',
    'faq.4q': 'Will the AI log food for me automatically?',
    'faq.4a': 'No. AI and barcode scanning only suggest items. You pick and confirm every entry before it’s saved.',
    'faq.5q': 'What if I use up my budget before dinner?',
    'faq.5a': 'Keep logging as usual. KinDee shows the honest total in calm, neutral colours with no scolding — consistency matters more than any single day.',

    'contact.eyebrow': 'Contact',
    'contact.title': 'Want to join the beta, or have a question?',
    'contact.lede': 'Tell us briefly what you’re interested in and we’ll reply to the email you give us.',
    'contact.direct': 'Or email',
    'form.name': 'Name',
    'form.email': 'Email for our reply',
    'form.topic': 'Topic',
    'form.topicBeta': 'Join the beta',
    'form.topicGeneral': 'General question',
    'form.topicBusiness': 'Business and partnerships',
    'form.topicSupport': 'Report a problem',
    'form.message': 'Message',
    'form.placeholder': 'e.g. I use an iPhone and want to try logging food while losing weight',
    'form.consent': 'I agree that KinDee may use this name and email only to reply to my question, and keep them for no longer than 12 months.',
    'form.submit': 'Send message',

    'footer.brand': 'KinDee · Eat well within your TDEE',
    'footer.disclaimer': 'KinDee is not a medical device or medical service. Energy values are estimates to help you manage eating habits only.',
  }

  const root = document.documentElement
  const original = new Map() // element -> { text?, html?, attrs? } in Thai

  const remember = (el, kind, value) => {
    const entry = original.get(el) ?? {}
    if (kind === 'attr') (entry.attrs ??= {})[value.name] = value.value
    else if (!(kind in entry)) entry[kind] = value
    original.set(el, entry)
  }

  function apply(lang) {
    const en = lang === 'en'
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      remember(el, 'text', el.textContent)
      el.textContent = en ? EN[el.dataset.i18n] ?? original.get(el).text : original.get(el).text
    })
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      remember(el, 'html', el.innerHTML)
      el.innerHTML = en ? EN[el.dataset.i18nHtml] ?? original.get(el).html : original.get(el).html
    })
    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.dataset.i18nAttr.split(';').forEach((pair) => {
        const [name, key] = pair.split(':')
        const saved = original.get(el)?.attrs?.[name]
        if (saved === undefined) remember(el, 'attr', { name, value: el.getAttribute(name) ?? '' })
        el.setAttribute(name, en ? EN[key] ?? original.get(el).attrs[name] : original.get(el).attrs[name])
      })
    })
    root.setAttribute('lang', lang)
    root.dataset.lang = lang
    document.dispatchEvent(new CustomEvent('kd:lang', { detail: lang }))
  }

  const store = (key, value) => { try { localStorage.setItem(key, value) } catch {} }

  // Language toggle: one button that flips TH <-> EN.
  const langButton = document.getElementById('lang-toggle')
  langButton?.addEventListener('click', () => {
    const next = root.dataset.lang === 'en' ? 'th' : 'en'
    store('kd-lang', next)
    apply(next)
  })

  // Theme: "system" removes the attribute so prefers-color-scheme decides.
  const themeButtons = document.querySelectorAll('[data-theme-opt]')
  const markTheme = (choice) => themeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeOpt === choice)))
  let current = 'system'
  try { current = localStorage.getItem('kd-theme') || 'system' } catch {}
  markTheme(current)
  themeButtons.forEach((b) => b.addEventListener('click', () => {
    const choice = b.dataset.themeOpt
    if (choice === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', choice)
    store('kd-theme', choice)
    markTheme(choice)
  }))

  window.kdLang = () => root.dataset.lang || 'th'
  if (root.dataset.lang === 'en') apply('en')
})()
