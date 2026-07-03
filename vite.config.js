import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
      devOptions: {
        enabled: true, // PWA ativo também em desenvolvimento
      },
      workbox: {
        // Cache de todos os assets do app
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Estratégia: tenta rede primeiro, cai no cache se offline
        runtimeCaching: [
          {
            // Supabase Auth — network first
            urlPattern: ({ url }) => url.origin.includes('supabase.co') && url.pathname.includes('/auth/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-auth',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 }, // 1h
            },
          },
          {
            // Supabase REST API — network first com fallback
            urlPattern: ({ url }) => url.origin.includes('supabase.co') && url.pathname.includes('/rest/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 5 }, // 5 min
            },
          },
          {
            // Fontes e assets externos
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      manifest: {
        name: 'Pet Gestor — PDV Petshop',
        short_name: 'Pet Gestor',
        description: 'Sistema PDV para Petshop e Agroshop',
        theme_color: '#0d1b2a',
        background_color: '#080f1a',
        display: 'standalone',          // abre sem barra do navegador
        orientation: 'any',             // portrait e landscape
        scope: '/',
        start_url: '/',
        categories: ['business', 'productivity'],
        lang: 'pt-BR',
        icons: [
          { src: '/icons/pwa-72x72.png',   sizes: '72x72',   type: 'image/png' },
          { src: '/icons/pwa-96x96.png',   sizes: '96x96',   type: 'image/png' },
          { src: '/icons/pwa-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/pwa-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/pwa-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Abrir PDV',
            short_name: 'PDV',
            description: 'Ir direto para o ponto de venda',
            url: '/?tab=pdv',
            icons: [{ src: '/icons/pwa-96x96.png', sizes: '96x96' }],
          },
          {
            name: 'Ver Estoque',
            short_name: 'Estoque',
            description: 'Consultar estoque',
            url: '/?tab=estoque',
            icons: [{ src: '/icons/pwa-96x96.png', sizes: '96x96' }],
          },
        ],
      },
    }),
  ],
})
