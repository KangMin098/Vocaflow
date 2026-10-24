// apps/web/scripts/judgment-harness/run.mjs
// 격리 브라우저 검사 — 사례별 cases/<slug>.check.mjs 의 check(page, t) 를 1280·1440 에서 돌린다.
// 이것은 「격리 컴포넌트 검사」다. 실제 인증 제품 E2E · 서버 공개 계약 검증이 아니다.
// node scripts/judgment-harness/run.mjs [slug …]   →  out/results-<slug>.json · out/<slug>-<width>.png
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from './build.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const web = path.resolve(here, '../..')
const require = createRequire(path.join(web, 'package.json'))
const { chromium } = require('@playwright/test')
const tokens = fs.readFileSync(path.resolve(web, '../../packages/design-tokens/src/tokens.css'), 'utf8')

const all = fs.readdirSync(path.join(here, 'cases')).filter((f) => f.endsWith('.check.mjs')).map((f) => f.replace('.check.mjs', ''))
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : all
fs.mkdirSync(path.join(here, 'out'), { recursive: true })

const browser = await chromium.launch()
let failed = 0
for (const slug of slugs) {
  const js = await build(slug)
  const bundle = fs.readFileSync(js, 'utf8')
  const cssFile = js.replace(/\.js$/, '.css')
  const css = fs.existsSync(cssFile) ? fs.readFileSync(cssFile, 'utf8') : ''
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>판단 도구 격리 화면</title><style>${tokens}</style><style>${css}</style><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,'Malgun Gothic',sans-serif;background:var(--bg)}button{font:inherit}</style></head><body><div id="root"></div><script type="module">${bundle.replace(/<\/script/g, '<\\/script')}</script></body></html>`
  const { check } = await import(pathToFileURL(path.join(here, 'cases', `${slug}.check.mjs`)).href)
  const results = []
  for (const width of [1280, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await page.route('http://harness.local/**', (r) => r.fulfill({ contentType: 'text/html', body: html }))
    const t = {
      width,
      check: (name, pass, detail) => results.push({ width, name, pass: Boolean(pass), detail }),
      // 원문 문장은 여러 줄 인라인이라 요소 사각형 가운데가 문장 사이 공백일 수 있다 — 실제 글줄 조각(가장 넓은 것)의 가운데를 누른다
      clickUnit: async (id) => {
        const p = await page.evaluate((u) => {
          const el = document.querySelector(`[data-unit="${u}"]`)
          if (!el) return null
          el.scrollIntoView({ block: 'center' })
          const r = [...el.getClientRects()].sort((a, b) => b.width - a.width)[0]
          return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
        }, id)
        if (!p) throw new Error(`원문 단위 없음: ${id}`)
        await page.mouse.click(p.x, p.y)
      },
      shot: (label) => page.screenshot({ path: path.join(here, 'out', `${slug}-${width}${label ? '-' + label : ''}.png`) }),
      open: async (query = '') => { await page.goto(`http://harness.local/${query}`); await page.waitForSelector('[data-judgment-shell], [data-judgment-empty], [data-swap-root]') },
    }
    try {
      await check(page, t)
    } catch (e) {
      results.push({ width, name: '검사 실행', pass: false, detail: String(e?.stack ?? e).slice(0, 600) })
    }
    results.push({ width, name: '페이지 오류 없음', pass: errors.length === 0, detail: errors.slice(0, 5) })
    await page.close()
  }
  const bad = results.filter((r) => !r.pass)
  failed += bad.length
  fs.writeFileSync(path.join(here, 'out', `results-${slug}.json`), JSON.stringify({ slug, kind: 'isolated-component-browser', results }, null, 2) + '\n')
  console.log(`${slug}: ${results.length - bad.length}/${results.length} 통과`)
  for (const b of bad) console.log(`  ✗ [${b.width}] ${b.name} ${JSON.stringify(b.detail ?? '').slice(0, 300)}`)
}
await browser.close()
process.exit(failed ? 1 : 0)
