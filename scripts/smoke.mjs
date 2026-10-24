// Teste de fumaça no navegador (Chromium/Playwright): percorre os fluxos principais,
// grava uma atividade com geolocalização emulada, recarrega a página e verifica persistência.
// Uso: node scripts/smoke.mjs <url> <pasta-de-capturas>
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const { chromium } = createRequire(import.meta.url)('playwright')
const [url = 'http://localhost:4173/', out = 'shots'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errors = []
const results = []
const check = (name, ok, detail = '') => { results.push(`${ok ? 'OK  ' : 'FALHA'} ${name}${detail ? ' — ' + detail : ''}`) }

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Fortaleza', ...opts })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/tile|openstreetmap|ERR_|Failed to load resource/i.test(m.text())) errors.push(`[console] ${m.text()}`) })
  return { ctx, page }
}
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` })

// 1) Primeira visita: introdução -> configuração inicial
const start = { lat: -5.8429, lng: -35.1979 }
const { ctx, page } = await newPage({ geolocation: { latitude: start.lat, longitude: start.lng, accuracy: 6 }, permissions: ['geolocation'] })
await page.goto(url)
await page.getByRole('button', { name: 'Pular introdução' }).waitFor()
check('introdução aparece na primeira visita', true)
await page.getByRole('button', { name: 'Pular introdução' }).click()
await page.getByText('Movimento com companhia e propósito').waitFor()
await shot(page, '01-onboarding-1')
await page.getByPlaceholder('Seu nome ou apelido (opcional)').fill('Enio')
await page.getByRole('button', { name: 'Continuar' }).click()
await shot(page, '02-onboarding-2')
await page.getByRole('button', { name: 'Continuar' }).click()
await page.getByRole('button', { name: 'Continuar' }).click()
await shot(page, '03-onboarding-4')
await page.getByRole('button', { name: 'Entrar na Move+' }).click()
await page.getByText('Comece por aqui').waitFor()
check('painel vazio mostra primeiros passos', true)
await shot(page, '04-home-empty')

// 2) Todas as áreas abrem sem erro
const routes = ['mapa', 'calendario', 'estatisticas', 'missoes', 'conquistas', 'comunidade', 'dispositivos', 'perfil', 'ajustes', 'notificacoes', 'historico', 'registrar?modo=manual', 'registrar?modo=importar']
for (const r of routes) {
  await page.goto(`${url}#/${r}`)
  await page.waitForTimeout(500)
  const h1 = await page.locator('main h1').first().textContent().catch(() => null)
  check(`rota #/${r}`, !!h1, h1 ?? 'sem título')
  await shot(page, `10-${r.replace(/[?=]/g, '_')}`)
}

// 3) Gravação com GPS emulado: caminhada para o norte, ~1,5 m/s
await page.goto(`${url}#/registrar`)
await page.getByText(/GPS pronto/).waitFor({ timeout: 15000 }).catch(async (e) => { await shot(page, "fail-gps"); console.log(errors.join("\n")); throw e })
check('GPS confirmado por leitura real antes de iniciar', true)
await shot(page, '20-gps-ready')
await page.getByRole('button', { name: /Iniciar caminhada/ }).click()
let lat = start.lat
for (let i = 0; i < 40; i++) {
  lat += (1.5 * 3) / 111195
  await ctx.setGeolocation({ latitude: lat, longitude: start.lng, accuracy: 6 })
  await page.waitForTimeout(3000)
  if (i === 20) await shot(page, '21-recording')
}
await page.getByRole('button', { name: 'Pausar' }).click()
await page.getByRole('button', { name: 'Finalizar' }).click()
await page.getByText('Resumo da atividade').waitFor()
await shot(page, '22-summary')
const dist = await page.locator('.summary-stats .stat').first().textContent()
check('resumo com distância medida', /0,1\d|0,2\d/.test(dist ?? ''), dist ?? '')
await page.getByRole('button', { name: 'Salvar atividade' }).click()
await page.waitForURL(/atividade/)
await page.waitForTimeout(800)
await shot(page, '23-activity')

// 4) Registro manual
await page.goto(`${url}#/registrar?modo=manual`)
await page.getByLabel('Duração (min)').fill('25')
await page.getByLabel('Distância (km, opcional)').fill('2')
await page.getByRole('button', { name: 'Salvar registro' }).click()
await page.waitForURL(/atividade/)

await page.goto(`${url}#/`)
await page.waitForTimeout(600)
await shot(page, '30-home-data')
const xpBefore = await page.locator('.hero .num').filter({ hasText: 'XP' }).first().textContent()
await page.reload()
await page.waitForTimeout(1200)
const xpAfter = await page.locator('.hero .num').filter({ hasText: 'XP' }).first().textContent()
check('XP persiste após recarregar', xpBefore === xpAfter && !!xpBefore, `${xpBefore} -> ${xpAfter}`)
const introAgain = await page.getByRole('button', { name: 'Pular introdução' }).count()
check('introdução não reaparece', introAgain === 0)
await page.goto(`${url}#/calendario`); await page.waitForTimeout(500); await shot(page, '31-calendar-data')
await page.goto(`${url}#/estatisticas`); await page.waitForTimeout(500); await shot(page, '32-stats-data')
await page.goto(`${url}#/missoes`); await page.waitForTimeout(500); await shot(page, '33-missions-data')

// 5) Gravação interrompida por recarga -> recuperação
await page.goto(`${url}#/registrar`)
await page.getByText(/GPS pronto/).waitFor({ timeout: 15000 })
await page.getByRole('button', { name: /Iniciar/ }).click()
for (let i = 0; i < 6; i++) { lat += 4.5 / 111195; await ctx.setGeolocation({ latitude: lat, longitude: start.lng, accuracy: 6 }); await page.waitForTimeout(1500) }
await page.reload()
await page.goto(`${url}#/`)
const rec = await page.getByText('Gravação interrompida').waitFor({ timeout: 5000 }).then(() => true).catch(() => false)
check('gravação interrompida é oferecida para recuperação', rec)
await shot(page, '40-recovery')
if (rec) await page.getByRole('button', { name: 'Salvar como atividade recuperada' }).click()
await page.waitForTimeout(800)

// 6) Desktop e tema claro
await page.setViewportSize({ width: 1366, height: 860 })
await page.goto(`${url}#/`); await page.waitForTimeout(600); await shot(page, '50-desktop-home')
await page.goto(`${url}#/mapa`); await page.waitForTimeout(800); await shot(page, '51-desktop-map')
await page.goto(`${url}#/ajustes`); await page.getByRole('button', { name: 'Claro' }).click()
await page.goto(`${url}#/`); await page.waitForTimeout(500); await shot(page, '52-desktop-light')
await ctx.close()

// 7) Permissão de localização negada
const denied = await newPage()
await denied.page.goto(url)
await denied.page.evaluate(async () => {
  const req = indexedDB.open('moveplus', 1)
  await new Promise((r) => { req.onsuccess = r; req.onupgradeneeded = () => { const db = req.result; for (const c of ['activities','routes','places','events','groups','planned','notifications','posts']) db.createObjectStore(c, { keyPath: 'id' }); db.createObjectStore('tracks', { keyPath: 'activityId' }); db.createObjectStore('photos'); db.createObjectStore('kv') } })
})
await denied.page.getByRole('button', { name: 'Pular introdução' }).click().catch(() => {})
await denied.page.getByRole('button', { name: 'Continuar' }).click()
for (let i = 0; i < 2; i++) await denied.page.getByRole('button', { name: 'Continuar' }).click()
await denied.page.getByRole('button', { name: 'Entrar na Move+' }).click()
await denied.page.goto(`${url}#/registrar`)
await denied.page.getByRole('button', { name: 'Ativar GPS' }).click()
await denied.page.getByRole('button', { name: 'Continuar' }).click()
const deniedMsg = await denied.page.getByText('Permissão de localização negada').waitFor({ timeout: 8000 }).then(() => true).catch(() => false)
check('permissão negada é identificada (não confundida com falta de sinal)', deniedMsg)
await shot(denied.page, '60-denied')
await denied.ctx.close()

await browser.close()
console.log(results.join('\n'))
console.log(errors.length ? `\nERROS NO CONSOLE (${errors.length}):\n` + [...new Set(errors)].join('\n') : '\nSem erros no console.')
