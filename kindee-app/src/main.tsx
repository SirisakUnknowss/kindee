import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { StoreProvider } from './lib/store'
import { registerSW } from 'virtual:pwa-register'
import { installErrorReporting } from './lib/report'

// autoUpdate: when a new deploy is found the page reloads onto it. The service
// worker only looks for one when asked, so check whenever the app is likely to
// be showing stale code: on load, when the tab becomes visible again, when the
// connection returns, and every few minutes for tabs left open.
const UPDATE_INTERVAL_MS = 5 * 60 * 1000

registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    let lastCheck = Date.now()
    const check = () => {
      lastCheck = Date.now()
      void registration.update()
    }
    setInterval(check, UPDATE_INTERVAL_MS)
    // A backgrounded tab throttles timers, so re-check when it comes back.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck > 30_000) check()
    })
    window.addEventListener('online', check)
  },
})

// UAT: uncaught errors go to app_reports so testers do not have to describe them.
installErrorReporting()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className={window.location.pathname.startsWith('/admin') ? 'kd-app kd-app-admin' : 'kd-app'}>
      <StoreProvider>
        <App />
      </StoreProvider>
    </div>
  </StrictMode>,
)
