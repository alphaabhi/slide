import '@fontsource-variable/plus-jakarta-sans/wght.css'
import '@fontsource/atkinson-hyperlegible/latin-400.css'
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { isAuthPath, preloadAuthArea } from './app/routes'
import { reloadOnce } from './lib/reloadOnce'

// A preloaded file vanished because a new version went live: fetch the new version.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadOnce()
})

// Opening a signed-in page directly: start downloading its code before React even renders.
if (isAuthPath(window.location.pathname)) preloadAuthArea()

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
