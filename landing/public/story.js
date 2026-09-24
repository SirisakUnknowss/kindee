// Scroll storytelling.
// Large screens ("story mode"): the story stage sticks while the page scrolls
// through one viewport-high step per chapter; the active chapter cross-fades
// in, the shared phone swaps screens and the page background changes colour.
// Small screens / reduced motion: chapters stack normally, but the background
// still follows whichever scene is in the middle of the viewport.
(() => {
  const root = document.documentElement
  const story = document.getElementById('story')
  if (!story) return
  const stage = story.querySelector('.stage')
  const chapters = [...story.querySelectorAll('.chapter')]
  const screens = [...story.querySelectorAll('.stage-phone img[data-screen]')]
  const dots = [...story.querySelectorAll('.dots a')]
  const pages = [...document.querySelectorAll('.page[data-bg]')]
  const reveals = [...document.querySelectorAll('.reveal, .chapter')]
  const mode = matchMedia('(min-width: 960px) and (min-height: 680px) and (prefers-reduced-motion: no-preference)')

  let active = -1
  let scene = ''

  const setScene = (name) => {
    if (name === scene) return
    scene = name
    root.style.setProperty('--scene', `var(--bg-${name})`)
    root.dataset.scene = name
  }

  const setChapter = (i) => {
    if (i === active) return
    active = i
    stage.dataset.active = String(i)
    chapters.forEach((c, n) => {
      c.classList.toggle('is-active', n === i)
      c.classList.toggle('is-past', n < i)
      // Only the visible chapter can be reached by keyboard or screen reader.
      if (mode.matches) c.toggleAttribute('inert', n !== i)
    })
    const screen = chapters[i].dataset.screen
    screens.forEach((img) => img.classList.toggle('is-on', img.dataset.screen === screen))
    dots.forEach((d, n) => (n === i ? d.setAttribute('aria-current', 'step') : d.removeAttribute('aria-current')))
  }

  const middleOf = (els) => {
    const mid = innerHeight / 2
    return els.find((el) => {
      const r = el.getBoundingClientRect()
      return r.top <= mid && r.bottom > mid
    })
  }

  function update() {
    const vh = innerHeight
    if (mode.matches) {
      const r = story.getBoundingClientRect()
      const i = Math.min(chapters.length - 1, Math.max(0, Math.round(-r.top / vh)))
      setChapter(i)
      const page = r.bottom <= vh / 2 ? middleOf(pages) : null
      setScene(page ? page.dataset.bg : chapters[i].dataset.bg)
    } else {
      const el = middleOf([...chapters, ...pages])
      if (el) setScene(el.dataset.bg)
    }
    // Reveal once, a little before an element reaches the viewport.
    for (const el of reveals) {
      if (!el.classList.contains('in-view') && el.getBoundingClientRect().top < vh * 0.85) el.classList.add('in-view')
    }
  }

  let queued = false
  const schedule = () => {
    if (queued) return
    queued = true
    // rAF normally wins; the timeout covers tabs where frames are paused.
    const run = () => { if (!queued) return; queued = false; update() }
    requestAnimationFrame(run)
    setTimeout(run, 120)
  }

  function applyMode() {
    root.classList.toggle('story-mode', mode.matches)
    if (!mode.matches) chapters.forEach((c) => c.removeAttribute('inert'))
    active = -1
    update()
  }

  // ---- Page flipping (story mode only) ----
  // CSS scroll-snap traps small wheel/trackpad deltas on the current scene, so
  // flips are handled here: one gesture moves exactly one scene. A page taller
  // than the viewport scrolls natively until its edge is reached.
  const snapPoints = () => {
    const y = scrollY
    const storyTop = story.getBoundingClientRect().top + y
    const vh = innerHeight
    return [
      ...chapters.map((_, i) => storyTop + i * vh),
      ...pages.map((p) => p.getBoundingClientRect().top + y),
      document.documentElement.scrollHeight - vh,
    ].map(Math.round).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
  }

  let lockedUntil = 0
  let lastWheel = 0

  function flip(dir) {
    const points = snapPoints()
    const y = Math.round(scrollY)
    const vh = innerHeight
    // Current section: the last snap point at or above the viewport top.
    let i = points.length - 1
    while (i > 0 && points[i] > y + 2) i--
    const start = points[i]
    const end = points[i + 1] ?? document.documentElement.scrollHeight
    // Tall page: let the browser scroll inside it until an edge.
    if (dir > 0 && y + vh < end - 2) return false
    if (dir < 0 && y > start + 2) return false
    const target = dir > 0 ? points[i + 1] : points[Math.max(0, i - 1)]
    if (target === undefined || target === y) return false
    scrollTo({ top: target, behavior: 'smooth' })
    lockedUntil = performance.now() + 900
    return true
  }

  addEventListener('wheel', (e) => {
    if (!mode.matches || e.ctrlKey || Math.abs(e.deltaY) < 4) return
    const now = performance.now()
    const quiet = now - lastWheel > 160 // a new gesture, not trackpad momentum
    lastWheel = now
    if (now < lockedUntil || !quiet && now < lockedUntil + 400) { e.preventDefault(); return }
    if (flip(Math.sign(e.deltaY))) e.preventDefault()
  }, { passive: false })

  addEventListener('keydown', (e) => {
    if (!mode.matches || e.altKey || e.ctrlKey || e.metaKey) return
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
    const dir = { ArrowDown: 1, PageDown: 1, ' ': e.shiftKey ? -1 : 1, ArrowUp: -1, PageUp: -1 }[e.key]
    if (!dir) return
    if (performance.now() < lockedUntil || flip(dir)) e.preventDefault()
  })

  mode.addEventListener('change', applyMode)
  addEventListener('scroll', schedule, { passive: true })
  addEventListener('resize', schedule)
  applyMode()
})()
