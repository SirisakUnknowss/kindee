// Language (TH/EN) and theme (system/light/dark) preferences.
// Thai is written in the HTML itself; this file holds English and swaps text by
// data-i18n keys. The original Thai is captured from the DOM on first run so
// switching back needs no second dictionary.
// Written in ES2017 on purpose: older in-app browsers (LINE, Facebook, old
// Android WebViews) reject the whole file on newer syntax such as ?. or ??.
(function () {
  var EN = {
    'meta.title': 'KinDee — Eat well within your TDEE',
    'meta.description': 'KinDee is a calorie counter built for Thai food. Set a daily calorie budget from your TDEE and log meals by plate, ladle or skewer in seconds. Free to start, no sign-up needed.',
    'skip': 'Skip to content',
    'nav.label': 'Main menu',
    'nav.home': 'KinDee home',
    'nav.install': 'Install',
    'nav.contact': 'Contact',
    'nav.cta': 'Try it free',
    'prefs.langLabel': 'Switch to Thai',
    'prefs.themeLabel': 'Theme',
    'prefs.system': 'Match system',
    'prefs.light': 'Light',
    'prefs.dark': 'Dark',

    'hero.badge': 'Now open for early testers',
    'hero.title': '<span class="soft">Eat well,</span> <span class="nowrap">count easy</span>',
    'hero.lede': 'Count calories for Thai food like keeping a budget. Set a daily limit, log by the plate, ladle or skewer, and see what’s left instantly.',
    'hero.cta': 'Start free — no sign-up',
    'hero.install': 'How to install on your phone',
    'hero.budget': 'Today’s budget from TDEE',
    'hero.remain': 'Left for dinner',
    'hero.formula': 'Budget <span>−</span> what you ate <span>=</span> <b>what’s left</b>',
    'hero.cue': 'Scroll to see how it works',
    'mock.label': 'Example Today screen: budget 1,810 kcal, 960 eaten, 850 left',
    'mock.today': 'Today',
    'mock.left': 'Left today',
    'mock.of': 'of',
    'food.1': 'Iced coffee',
    'food.1u': '1 glass',
    'food.2': 'Chicken rice',
    'food.2u': '1 bowl',
    'food.3': 'Som tam',
    'food.3u': '1 plate',

    'search.typed': 'kra pao',
    'search.eyebrow': 'Search',
    'search.title': 'Misspell it — still found',
    'search.text': 'More than 1,300 Thai dishes. Type it any way you like and the right dish turns up, with meals you’ve eaten before listed first.',
    'show.searchAlt': 'Searching “kra pao” finds basil pork with fried egg at 620 kcal per plate',
    'portion.eyebrow': 'Portions',
    'portion.title': 'No scales. No guessing grams.',
    'portion.text': 'Pick amounts the way you order food — half a plate, one ladle, two skewers — and KinDee does the calories.',
    'show.portionAlt': 'Choosing plate, ladle or bowl and a quantity from half to two plates, totalling 620 kcal',
    'marquee.1': 'plate · ladle · skewer · bowl · glass · pack · cup · plate · ladle · skewer · bowl',
    'marquee.2': 'half a plate · 2 skewers · 1 ladle · 1 glass · half a bowl · 3 balls · 1 pack · half a plate',

    'more.eyebrow': 'More ways to log',
    'more.title': 'Pick the fastest way',
    'mini.1t': 'Barcode scan',
    'mini.1p': 'Scan convenience-store products and confirm before logging.',
    'mini.2t': 'Photo with AI',
    'mini.2p': 'AI suggests close matches; you always choose and confirm.',
    'mini.3t': 'Works offline',
    'mini.3p': 'Saves on your phone first and syncs when you’re back online.',
    'mini.4t': 'Backup across devices',
    'mini.4p': 'Create a free account when you’re ready — nothing you logged is lost.',

    'calm.title': 'No red.<br>No guilt.',
    'calm.text': 'Used your whole budget before dinner? KinDee just shows the honest total in calm colours — consistency matters more than any single day.',
    'calm.chipT': 'Budget used up',
    'calm.chipS': 'Keep logging as usual',

    'how.eyebrow': 'Start in 3 steps',
    'how.title': 'No sign-up first. Open it and go.',
    'how.1t': 'Set your daily budget',
    'how.1s': 'Answer 5 quick questions. KinDee works out your TDEE and never sets a target below a safe minimum.',
    'how.2t': 'Log every meal',
    'how.2s': 'Pick a recent meal, search, scan or snap a photo — it takes seconds.',
    'how.3t': 'See what’s left',
    'how.3s': 'Know right away what’s left for your next meal. Want a backup? Create a free account any time.',

    'install.eyebrow': 'Free to install',
    'install.title': 'No app store needed — install it from the web',
    'install.lede': 'KinDee is a web app. Open the link, add it to your home screen, and you get an icon like any other app — it even works offline.',
    'install.ios1': 'Open the link in Safari',
    'install.ios2': 'Tap the <b>Share</b> button at the bottom',
    'install.ios3': 'Choose <b>Add to Home Screen</b>',
    'install.and1': 'Open the link in Chrome',
    'install.and2': 'Tap the <b>⋮</b> menu at the top right',
    'install.and3': 'Choose <b>Install app</b> or <b>Add to Home screen</b>',
    'install.cta': 'Open KinDee now',
    'install.link': 'or type',

    'plans.eyebrow': 'Plans',
    'plans.title': 'Basic logging is free forever',
    'plans.lede': 'Paid plans add long-term history and more AI photo analysis, with a 30-day free trial the first time. The price is always shown in the app before you confirm.',
    'plans.pick': 'Recommended',
    'plans.freeNote': 'Start and log every day',
    'plans.plusNote': 'For steady daily logging',
    'plans.proNote': 'For clear goals',
    'plans.unlNote': 'For heavy AI use',
    'plans.f1': 'Food logging + TDEE',
    'plans.f2': 'Search, scan, offline',
    'plans.f3': 'Backup across devices',
    'plans.ai3': 'AI photo analysis 3×/month',
    'plans.allFree': 'Everything in Free',
    'plans.history': 'Unlimited history and trends',
    'plans.ai30': 'AI photo analysis 30×/month',
    'plans.allPlus': 'Everything in Plus',
    'plans.macro': 'Advanced goals and macros',
    'plans.ai100': 'AI photo analysis 100×/month',
    'plans.allPro': 'Everything in Pro',
    'plans.aiFair': 'AI under fair use',
    'plans.early': 'Early access to new features',

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
    'footer.disclaimer': 'KinDee is not a medical device or medical service. Energy values are estimates to help you manage eating habits only.'
  }

  var root = document.documentElement
  // Original Thai, kept on the element itself so switching back is exact.
  var TEXT = '__kdText', HTML = '__kdHtml', ATTRS = '__kdAttrs'
  var pick = function (key, fallback, en) { return en && EN.hasOwnProperty(key) ? EN[key] : fallback }
  var each = function (selector, fn) { Array.prototype.forEach.call(document.querySelectorAll(selector), fn) }

  function apply(lang) {
    var en = lang === 'en'
    each('[data-i18n]', function (el) {
      if (!(TEXT in el)) el[TEXT] = el.textContent
      el.textContent = pick(el.getAttribute('data-i18n'), el[TEXT], en)
    })
    each('[data-i18n-html]', function (el) {
      if (!(HTML in el)) el[HTML] = el.innerHTML
      el.innerHTML = pick(el.getAttribute('data-i18n-html'), el[HTML], en)
    })
    each('[data-i18n-attr]', function (el) {
      if (!el[ATTRS]) el[ATTRS] = {}
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var parts = pair.split(':'), name = parts[0], key = parts[1]
        if (!(name in el[ATTRS])) el[ATTRS][name] = el.getAttribute(name) || ''
        el.setAttribute(name, pick(key, el[ATTRS][name], en))
      })
    })
    root.setAttribute('lang', lang)
    root.setAttribute('data-lang', lang)
    var ev
    try { ev = new CustomEvent('kd:lang', { detail: lang }) } catch (e) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent('kd:lang', false, false, lang) }
    document.dispatchEvent(ev)
  }

  var store = function (key, value) { try { localStorage.setItem(key, value) } catch (e) {} }

  // Language toggle: one button that flips TH <-> EN.
  var langButton = document.getElementById('lang-toggle')
  if (langButton) langButton.addEventListener('click', function () {
    var next = root.getAttribute('data-lang') === 'en' ? 'th' : 'en'
    store('kd-lang', next)
    apply(next)
  })

  // Theme: "system" removes the attribute so prefers-color-scheme decides.
  var themeButtons = document.querySelectorAll('[data-theme-opt]')
  var markTheme = function (choice) {
    Array.prototype.forEach.call(themeButtons, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-opt') === choice)) })
  }
  var current = 'system'
  try { current = localStorage.getItem('kd-theme') || 'system' } catch (e) {}
  markTheme(current)
  Array.prototype.forEach.call(themeButtons, function (b) {
    b.addEventListener('click', function () {
      var choice = b.getAttribute('data-theme-opt')
      if (choice === 'system') root.removeAttribute('data-theme')
      else root.setAttribute('data-theme', choice)
      store('kd-theme', choice)
      markTheme(choice)
    })
  })

  window.kdLang = function () { return root.getAttribute('data-lang') || 'th' }
  if (root.getAttribute('data-lang') === 'en') apply('en')
})()
