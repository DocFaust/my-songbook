import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import OidcAuthProvider from './auth/OidcAuthProvider.jsx'

// Production only. In `vite dev` this module is a no-op.
// A new service worker reloads the page once; the first install does not.
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <OidcAuthProvider>
      <App />
    </OidcAuthProvider>
  </StrictMode>,
)
