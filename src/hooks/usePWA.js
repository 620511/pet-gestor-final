// src/hooks/usePWA.js
// Gerencia instalação, atualizações e status offline do PWA

import { useState, useEffect, useCallback } from 'react'

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState(null)  // evento beforeinstallprompt
  const [isInstalled, setIsInstalled]     = useState(false)
  const [isOffline, setIsOffline]         = useState(!navigator.onLine)
  const [updateReady, setUpdateReady]     = useState(false)
  const [swReg, setSwReg]                 = useState(null)

  useEffect(() => {
    // ── Detecta se já está instalado como PWA ─────────────────
    const mq = window.matchMedia('(display-mode: standalone)')
    setIsInstalled(mq.matches || window.navigator.standalone === true)
    const onMqChange = (e) => setIsInstalled(e.matches)
    mq.addEventListener('change', onMqChange)

    // ── Captura o prompt de instalação ────────────────────────
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // ── Online / Offline ──────────────────────────────────────
    const goOnline  = () => setIsOffline(false)
    const goOffline = () => setIsOffline(true)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)

    // ── Service Worker: detecta nova versão ───────────────────
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return
        setSwReg(reg)

        // Já tem um SW esperando? (atualização pendente)
        if (reg.waiting) setUpdateReady(true)

        // Escuta instalação de novo SW
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateReady(true)
            }
          })
        })
      })

      // Reload quando o SW novo assume controle
      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) { refreshing = true; window.location.reload() }
      })
    }

    return () => {
      mq.removeEventListener('change', onMqChange)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Dispara o prompt de instalação nativo
  const install = useCallback(async () => {
    if (!installPrompt) return false
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setInstallPrompt(null)
      setIsInstalled(true)
    }
    return outcome === 'accepted'
  }, [installPrompt])

  // Aplica a atualização pendente (recarrega o app)
  const applyUpdate = useCallback(() => {
    swReg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
  }, [swReg])

  return {
    canInstall:  !!installPrompt && !isInstalled,
    isInstalled,
    isOffline,
    updateReady,
    install,
    applyUpdate,
  }
}
