// scripts/design/tines-adoption-audit.mjs
// Tines 대상 전 라우트의 소스/정상 렌더·동적 링크·캡처 목록. 완료 여부는 사람의 대조로 판정한다.
// 기본은 소스 목록만 저장한다. --only는 아래 확인된 캡처 경로만 허용한다.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, chromium } from './lib/ref-page.mjs'

const args = process.argv.slice(2)
const arg = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback
const base = arg('--base', 'http://localhost:3000')
const phase = arg('--phase', 'before')
if (!/^[a-z0-9-]+$/i.test(phase)) throw new Error('phase must be a simple folder name')
const only = arg('--only', '')?.split(',').filter(Boolean)
if (args.includes('--mobile')) throw new Error('모바일은 디자인 작업 대상에서 제외한다')
const width = Number(arg('--width', '1440'))
if (![1280, 1440].includes(width)) throw new Error('PC 검증 너비는 1280 또는 1440이다')
const dark = args.includes('--dark')
const output = path.join(ROOT, 'tmp/tines-adoption', `${phase}-${width}-${dark ? 'dark' : 'light'}`)
const app = path.join(ROOT, 'apps/web/src/app')
const inventory = []
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (entry.name === 'page.tsx') {
      const route = '/' + path.relative(app, dir).split(path.sep).filter(segment => !/^\(.+\)$/.test(segment)).join('/')
      if (/^\/(admin|csat|dev)(\/|$)/.test(route)) continue
      const source = fs.readFileSync(file, 'utf8')
      inventory.push({ route, file: path.relative(ROOT, file).replaceAll('\\', '/'), dynamic: route.includes('['),
        directComponents: [...source.matchAll(/from\s+['"](@\/components\/[^'"]+)['"]/g)].map(match => match[1]),
        redirects: /\bredirect\(/.test(source) })
    }
  }
}
walk(app)
inventory.sort((a, b) => a.route.localeCompare(b.route))
fs.mkdirSync(output, { recursive: true })
const captureRoutes = new Set(['/', '/library/vocab', '/dictate', '/flashcard', '/spellforge', '/pairflip', '/diagnostic', '/diagnostic/history', '/settings'])
if (!only?.length) {
  fs.writeFileSync(path.join(output, 'audit.json'), JSON.stringify({ base, width, dark, inventory, results: [], mode: 'source-only' }, null, 2) + '\n')
  console.log(JSON.stringify({ inventory: inventory.length, mode: 'source-only' }))
  process.exit(0)
}
if (only.some(route => !captureRoutes.has(route))) {
  throw new Error('미검토 경로의 렌더는 학습 기록을 쓸 수 있다. 서버/브라우저 쓰기 차단을 확인하기 전에는 전체 렌더를 실행하지 않는다. 허용 경로: ' + [...captureRoutes].join(', '))
}
const browser = await chromium.launch()
const authFile = path.join(ROOT, 'apps/web/playwright-auth/.auth-reference-design.json')
const signed = await browser.newContext({ viewport: { width, height: 900 }, storageState: authFile, reducedMotion: 'reduce' })
const anonymous = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
for (const context of [signed, anonymous]) {
  await context.addInitScript(theme => localStorage.setItem('vocaflow-theme', theme), dark ? 'dark' : 'light')
  // 새로 허용한 세 경로는 초기 조회만 확인했다. 저장 버튼은 누르지 않는다.
  // 이 가드를 서버 측 전량 쓰기 차단으로 세지 않는다.
  if(only.every(route=>['/diagnostic','/diagnostic/history','/settings'].includes(route))) {
    await context.route('**/*',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort('blockedbyclient'))
  }
}
const discovered = new Set()
// 기존 실측 링크를 재사용한다. 동적 ID를 만들어 내지 않는다.
const oldCorpus = path.join(ROOT, 'tmp/ours-corpus')
if (fs.existsSync(oldCorpus)) for (const file of fs.readdirSync(oldCorpus).filter(file => file.endsWith('.json'))) {
  try { const data = JSON.parse(fs.readFileSync(path.join(oldCorpus, file), 'utf8')); if (typeof data.route === 'string') discovered.add(data.route) } catch { /* 오래된 불완전 파일은 대상으로 삼지 않는다. */ }
}
const results = []
async function visit(item, route = item.route) {
  const authRoute = /^\/(login|signup|reset-password|verify-email)(\/|$)/.test(route)
  const page = await (authRoute || route === '/' ? anonymous : signed).newPage()
  const shot = `${route.replace(/[^a-z0-9-]/gi, '_') || 'home'}.png`
  try {
    const response = await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {})
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
    const rendered = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement)
      const visible = element => { const rect = element.getBoundingClientRect(); const style = getComputedStyle(element); return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' }
      const bodyText = document.body.innerText
      const fonts = [...new Set([...document.querySelectorAll('h1,h2,button,input')].filter(visible).map(element => getComputedStyle(element).fontFamily))]
      return {
        path: location.pathname, title: document.title, csat: !!document.querySelector('[data-design-scope="csat"]'),
        skin: document.documentElement.dataset.skin, primary: root.getPropertyValue('--p').trim(), fonts,
        headings: [...document.querySelectorAll('h1,h2')].filter(visible).map(element => element.innerText).slice(0, 7),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        artwork: [...document.images].filter(image => /illustrations\/tines/.test(decodeURIComponent(image.currentSrc || image.src))).length,
        brokenImages: [...document.images].filter(image => visible(image) && image.complete && image.naturalWidth === 0).length,
        controls: [...document.querySelectorAll('button,input,select,textarea,[role="tab"]')].filter(visible).length,
        emptyMain: !!document.querySelector('main') && ![...document.querySelectorAll('main')].some(main => main.innerText.trim().length > 0),
        loading: !!document.querySelector('[aria-busy="true"]') || /^\s*(로딩|불러오는 중)/.test(bodyText),
        error: /Application error:|Internal Server Error|Unhandled Runtime Error/.test(bodyText),
        links: [...document.querySelectorAll('a[href]')].map(element => element.href).filter(href => href.startsWith(location.origin)).map(href => new URL(href).pathname),
      }
    })
    for (const link of rendered.links) discovered.add(link)
    delete rendered.links
    const status = response?.status() ?? null
    const result = { route: item.route, visited: route, status, ...rendered, screenshot: shot }
    result.state = status >= 400 || rendered.error ? 'error' : rendered.path === '/login' && !authRoute ? 'auth-redirect' : rendered.path !== route.split('?')[0] ? 'redirect' : rendered.loading ? 'loading' : rendered.emptyMain ? 'empty-shell' : 'rendered'
    if (result.state === 'rendered') await page.screenshot({ path: path.join(output, shot), fullPage: false })
    results.push(result)
    console.log(`${results.length} ${route} ${result.state}${rendered.overflow ? ' OVERFLOW' : ''}`)
  } catch (error) { results.push({ route: item.route, visited: route, state: 'failed', error: error.message }); console.log(`${results.length} ${route} failed`) }
  finally { await page.close() }
  fs.writeFileSync(path.join(output, 'audit.json'), JSON.stringify({ base, width, dark, inventory, results }, null, 2) + '\n')
}
const selected = inventory.filter(item => !only?.length || only.includes(item.route))
let cursor = 0
const statics = selected.filter(item => !item.dynamic)
await Promise.all(Array.from({ length: 2 }, async () => {
  while (cursor < statics.length) { const item = statics[cursor++]; await visit(item) }
}))
for (const item of selected.filter(item => item.dynamic)) {
  const pattern = new RegExp('^' + item.route.replace(/\[\.\.\.[^\]]+\]/g, '.+').replace(/\[[^\]]+\]/g, '[^/?#]+') + '$')
  const route = [...discovered].find(route => pattern.test(route))
  if (route) await visit(item, route)
  else results.push({ route: item.route, state: 'no-id' })
}
fs.writeFileSync(path.join(output, 'audit.json'), JSON.stringify({ base, width, dark, inventory, results }, null, 2) + '\n')
await browser.close()
console.log(JSON.stringify({ inventory: inventory.length, attempted: results.length, states: results.reduce((counts, result) => ({ ...counts, [result.state]: (counts[result.state] ?? 0) + 1 }), {}) }))
