// Captura quadros da introdução 3D para revisão visual.
// Uso: node scripts/shot-intro.mjs <url> <pasta-saida> [largura] [altura]
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const [url = 'http://localhost:5173/', out = 'shots', w = '390', h = '844'] = process.argv.slice(2)
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(url)
const t0 = Date.now()
for (const t of [700, 1600, 2500, 3300, 4000, 4700, 6000]) {
  const wait = t - (Date.now() - t0)
  if (wait > 0) await page.waitForTimeout(wait)
  await page.screenshot({ path: `${out}/intro-${w}-${t}.png` })
}
console.log(errors.length ? 'ERROS:\n' + errors.join('\n') : 'sem erros')
await browser.close()
