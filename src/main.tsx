import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import '@fontsource/plus-jakarta-sans/800.css'
import './styles/tokens.css'
import './styles/app.css'
import './styles/pages.css'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { init } from './services/actions'
import './services/install'

void init()
createRoot(document.getElementById('root')!).render(<App />)

// Service worker: cache do app para abrir sem conexão (somente em produção).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* sem cache offline: o app continua funcionando online */
    })
  })
}
