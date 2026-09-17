import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { StoreProvider } from './lib/store'
import { registerSW } from 'virtual:pwa-register'

// autoUpdate: when a new deploy is found the page reloads onto it.
// Also re-check hourly so long-open tabs and installed PWAs pick it up.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="kd-app">
      <StoreProvider>
        <App />
      </StoreProvider>
    </div>
  </StrictMode>,
)
