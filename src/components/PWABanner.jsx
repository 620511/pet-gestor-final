// src/components/PWABanner.jsx
// Exibe banners contextuais:
//  - "Instalar app" quando disponível
//  - "Sem conexão" quando offline
//  - "Nova versão disponível" quando o SW atualizou

import { usePWA } from '../hooks/usePWA'

export function PWABanner() {
  const { canInstall, isOffline, updateReady, install, applyUpdate } = usePWA()

  // ── Sem internet ─────────────────────────────────────────────
  if (isOffline) {
    return (
      <div style={banner('#f59e0b', '#1a1200')}>
        <span style={{ fontSize: 16 }}>📡</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
          Modo offline — alterações serão sincronizadas quando voltar a internet
        </span>
      </div>
    )
  }

  // ── Atualização disponível ────────────────────────────────────
  if (updateReady) {
    return (
      <div style={banner('#6366f1', '#0d0b1a')}>
        <span style={{ fontSize: 16 }}>🔄</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
          Nova versão do Pet Gestor disponível
        </span>
        <button style={btn('#6366f1')} onClick={applyUpdate}>
          Atualizar agora
        </button>
      </div>
    )
  }

  // ── Instalar como app ─────────────────────────────────────────
  if (canInstall) {
    return (
      <div style={banner('#4ade80', '#001a08')}>
        <span style={{ fontSize: 16 }}>🐾</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
          Instale o Pet Gestor na tela inicial do seu dispositivo
        </span>
        <button style={btn('#4ade80', '#000')} onClick={install}>
          Instalar app
        </button>
      </div>
    )
  }

  return null
}

const banner = (borderColor, bg) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 16px',
  background: bg,
  borderBottom: `2px solid ${borderColor}`,
  color: '#e2e8f0',
  flexShrink: 0,
  zIndex: 50,
})

const btn = (bg, color = '#fff') => ({
  padding: '6px 14px',
  background: bg,
  color,
  border: 'none',
  borderRadius: 8,
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
})
