#!/usr/bin/env node
// generate-icons.mjs
// Roda com: node generate-icons.mjs
// Gera todos os ícones PNG necessários para o PWA na pasta public/icons/
// Não precisa de dependência externa — usa apenas o canvas nativo do Node (v18+)

import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const outDir = join(process.cwd(), 'public', 'icons')
mkdirSync(outDir, { recursive: true })

for (const size of sizes) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Fundo
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
  grad.addColorStop(0, '#0d1b2a')
  grad.addColorStop(1, '#080f1a')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, size * 0.22)
  ctx.fill()

  // Pata (emoji simulado com texto)
  ctx.font = `${size * 0.55}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('🐾', size / 2, size / 2)

  const buf = canvas.toBuffer('image/png')
  const file = join(outDir, `pwa-${size}x${size}.png`)
  writeFileSync(file, buf)
  console.log(`✓ ${file}`)
}

console.log('\n✅ Ícones gerados em public/icons/')
