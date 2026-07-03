// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// ── Registra o Service Worker gerado pelo vite-plugin-pwa ────
const updateSW = registerSW({
  // Checa por atualizações a cada 60 minutos
  onRegisteredSW(swUrl, r) {
    r && setInterval(() => {
      r.update()
    }, 60 * 60 * 1000)
  },
  // Quando o usuário confirma, recarrega para aplicar
  onNeedRefresh() {
    // O PWABanner cuida de exibir o botão "Atualizar"
    // aqui só disparamos o evento para o hook usePWA capturar
    window.dispatchEvent(new CustomEvent('pwa-update-ready'))
  },
  onOfflineReady() {
    console.log('[PWA] App pronto para uso offline')
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
