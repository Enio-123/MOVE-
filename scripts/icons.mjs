// Gera os ícones PNG do PWA a partir de public/icons/favicon.svg (marca oficial sobre fundo branco).
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const { chromium } = createRequire(import.meta.url)('playwright')
const svg = readFileSync('public/icons/favicon.svg', 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [name, size, pad] of [['icon-192', 192, 0], ['icon-512', 512, 0], ['maskable-512', 512, 0.1]]) {
  // Maskable: fundo branco cheio e a marca dentro da zona segura.
  const inner = pad ? svg.replace(/<rect id="bg"[^>]*\/>/, '') : svg
  const s = Math.round(size * (1 - pad * 2))
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:${pad ? '#ffffff' : 'transparent'}"><div style="width:${size}px;height:${size}px;display:grid;place-items:center">${inner.replace('<svg ', `<svg width="${s}" height="${s}" `)}</div></body></html>`)
  await page.screenshot({ path: `public/icons/${name}.png`, omitBackground: !pad })
}
await browser.close()
console.log('ícones gerados')
