// scripts/design/tines-ref-shots.mjs — 대표 5페이지 1440 캡처(쿠키 Reject all).
// 산출 tmp/s9/tines/<page>-<0..2|full>.png + 측정 JSON. 접속 실패는 exit 1, 기존 s8 증거는 보존.
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require_ = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = require_('@playwright/test')
const out = path.join(ROOT, 'tmp/s9/tines')
fs.mkdirSync(out, { recursive: true })
const pages = { home: '/', library: '/library/', customers: '/customers/', product: '/product/', university: '/university/' }
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const measurements = []
let failures = 0
for (const [k, u] of Object.entries(pages)) {
  try {
    const response = await p.goto('https://www.tines.com' + u, { waitUntil: 'domcontentloaded', timeout: 25000 })
    if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`)
    await p.waitForTimeout(2000); await p.getByRole('button',{name:'Reject all'}).click({timeout:5000}).catch(()=>{}); await p.waitForTimeout(800)
    for (let i = 0; i < 3; i++) {
      await p.evaluate((y) => window.scrollTo(0, y), i * 900)
      await p.waitForTimeout(900)
      await p.screenshot({ path: path.join(out, `${k}-${i}.png`) })
    }
    await p.evaluate(() => window.scrollTo(0, 0))
    await p.screenshot({ path: path.join(out, `${k}-full.png`), fullPage: true })
    measurements.push({ page: k, url: p.url(), viewport: { width: 1440, height: 900 }, ...await p.evaluate(() => {
      const rect = (element) => {
        if (!element) return null
        const r = element.getBoundingClientRect(), s = getComputedStyle(element)
        return { x: r.x, y: r.y, width: r.width, height: r.height, fontSize: s.fontSize, radius: s.borderRadius, background: s.backgroundColor }
      }
      const heading = document.querySelector('h1')
      let hero = heading?.parentElement
      while (hero && !(parseFloat(getComputedStyle(hero).borderRadius) > 10 && hero.getBoundingClientRect().width > 500)) hero = hero.parentElement
      return { heading: rect(heading), hero: rect(hero), search: rect(document.querySelector('input[placeholder="Find a story"]')) }
    }) })
    console.log('ok', k)
  } catch (e) { failures++; console.log('fail', k, String(e).slice(0, 80)) }
}
fs.writeFileSync(path.join(out, '_measurements.json'), JSON.stringify(measurements, null, 2))
await b.close()
if (failures) process.exitCode = 1
