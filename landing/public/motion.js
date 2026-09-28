// Scroll-driven motion for the landing page.
//
// Content is fully visible without this file. It adds html.anim only once it
// is running; every hidden start state in styles.css hangs off that class, so a
// failed or blocked script can never leave the page blank. On any error it
// removes html.anim again.
//
// Written in ES2017 on purpose: older in-app browsers (LINE, Facebook, old
// Android WebViews) reject the whole file on newer syntax such as ?. or ??.
(function () {
  var root = document.documentElement
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches

  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)) }

  var scenes = $$('[data-bg]')
  var hero = document.querySelector('[data-pin]')
  var progressEls = $$('[data-progress]')
  var dock = document.getElementById('dock')
  var install = document.querySelector('.install-grid')
  var contact = document.getElementById('contact-form')
  var ringNum = document.getElementById('ring-num')
  var ringFg = document.querySelector('.ring-fg')
  var rows = $$('.mock-rows li')

  // The hero story: budget minus three foods, landing at these points of --t.
  var BUDGET = 1810
  var FOODS = [250, 590, 120]
  var LANDS = [0.56, 0.66, 0.76]
  var CIRC = 2 * Math.PI * 52

  var scene = ''
  function setScene(name) {
    if (!name || name === scene) return
    scene = name
    root.style.setProperty('--scene', 'var(--bg-' + name + ')')
    root.setAttribute('data-scene', name)
  }

  function setHeroNumbers(t) {
    var used = 0, landed = 0
    for (var i = 0; i < FOODS.length; i++) {
      if (t >= LANDS[i]) { used += FOODS[i]; landed++ }
    }
    rows.forEach(function (li, i) { li.classList.toggle('on', i < landed) })
    if (ringNum) ringNum.textContent = (BUDGET - used).toLocaleString('en-US')
    if (ringFg) ringFg.style.strokeDashoffset = String(CIRC * (used / BUDGET))
  }

  function update() {
    var vh = window.innerHeight
    var mid = vh / 2

    // Background follows whichever scene crosses the middle of the screen.
    for (var i = 0; i < scenes.length; i++) {
      var r = scenes[i].getBoundingClientRect()
      if (r.top <= mid && r.bottom > mid) { setScene(scenes[i].getAttribute('data-bg')); break }
    }

    // Pin the hero only when there is room for the sequence; otherwise show its end state.
    var pin = !reduce && vh >= 520
    root.classList.toggle('pin', pin)
    if (!pin) setHeroNumbers(1)
    if (pin && hero) {
      var hr = hero.getBoundingClientRect()
      var span = Math.max(1, hr.height - vh)
      var t = clamp(-hr.top / span, 0, 1)
      hero.style.setProperty('--t', t.toFixed(4))
      setHeroNumbers(t)
    }

    if (!reduce) progressEls.forEach(function (el) {
      var r = el.getBoundingClientRect()
      el.style.setProperty('--p', clamp((vh - r.top) / (vh + r.height), 0, 1).toFixed(4))
    })

    // Mobile start button: after the hero, but not over the install card or form.
    if (dock && hero) {
      var past = hero.getBoundingClientRect().bottom < vh * 0.4
      var busy = [install, contact].some(function (el) {
        if (!el) return false
        var r = el.getBoundingClientRect()
        return r.top < vh && r.bottom > 0
      })
      dock.classList.toggle('show', past && !busy)
    }
  }

  var queued = false
  function schedule() {
    if (queued) return
    queued = true
    var run = function () { if (!queued) return; queued = false; try { update() } catch (e) { fail(e) } }
    requestAnimationFrame(run)
    setTimeout(run, 120) // covers tabs where animation frames are paused
  }

  function fail(e) {
    root.classList.remove('anim')
    root.classList.remove('pin')
    if (window.console) console.error('KinDee motion disabled:', e)
  }

  function reveal() {
    var targets = $$('[data-reveal]')
    if (!('IntersectionObserver' in window)) { targets.forEach(function (el) { el.classList.add('in') }); return }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target) }
      })
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
    targets.forEach(function (el) { io.observe(el) })
  }

  try {
    if (!reduce) root.classList.add('anim')
    reveal()
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('load', schedule)
  } catch (e) {
    fail(e)
  }
})()
