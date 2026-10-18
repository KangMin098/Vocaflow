// scripts/design/session-check.mjs
//
// 세션 공통 조작을 실제로 실행한다 — learner-tines-audit S3 ③ 세션의 I 근거.
//   · 전역 헤더 없음(전체화면) · 나가기 조작이 하나(오른쪽 위) · 그 조작의 목적지
//   · 학습 동작 하나(Space = 다음 단계 공개 등) 후 화면이 바뀌는가 — 학습 방식은 모듈마다 다르므로 「바뀌었다」만 본다
//   · Esc → 복귀 주소로 이동
// 기록(평가 1~5 등 FSRS 쓰기)은 하지 않는다 — 공유 검증 계정의 학습 데이터를 바꾸지 않는다.
// 사용: node scripts/design/session-check.mjs --base http://localhost:3041 --out <dir> --page "id|/path?q|/expected-close" ...

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require_ = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = require_('@playwright/test')
const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const BASE = arg('base', 'http://localhost:3041')
const outDir = path.resolve(ROOT, arg('out', 'tmp/s3/session-check'))
const width = Number(arg('width', '1440'))
const pages = args.flatMap((a, i) => (a === '--page' ? [args[i + 1]] : [])).map((s) => { const [id, url, close] = s.split('|'); return { id, url, close } })
const STATE_FILE = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const results = []
  for (const pg of pages) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', ...(fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {}) })
    const p = await ctx.newPage()
    const row = { id: pg.id, url: pg.url, base: BASE, width, at: new Date().toISOString() }
    try {
      await p.goto(`${BASE}${pg.url}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
      await p.waitForTimeout(6000)
      const info = await p.evaluate(() => {
        const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.top < innerHeight }
        const name = (e) => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ')
        const exits = [...document.querySelectorAll('a, button')].filter(vis).filter((e) => /세션 닫기|닫기|종료|나가기/.test(name(e)) && !/설정/.test(name(e)))
          .map((e) => { const r = e.getBoundingClientRect(); return { name: name(e).slice(0, 30), href: e.getAttribute('href'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })
        const appHeader = Boolean([...document.querySelectorAll('header')].find((h) => vis(h) && h.querySelector('a[href="/hub"]') && h.getBoundingClientRect().top < 5))
        return { exits, appHeader, text: document.querySelector('main')?.innerText.slice(0, 600) ?? '' }
      })
      row.appHeader = info.appHeader
      row.exits = info.exits
      await p.screenshot({ path: path.join(outDir, `${pg.id}@${width}-start.png`) })
      // 학습 동작 하나 — Space(공개 · 재생 등). 입력칸이 포커스면 Space 가 글자가 되므로 바깥을 누르고 한다.
      await p.mouse.click(10, 450)
      await p.keyboard.press('Space')
      await p.waitForTimeout(1200)
      const after = await p.evaluate(() => document.querySelector('main')?.innerText.slice(0, 600) ?? '')
      row.actionChanged = after !== info.text
      await p.screenshot({ path: path.join(outDir, `${pg.id}@${width}-action.png`) })
      // Esc → 복귀
      await p.keyboard.press('Escape')
      await p.waitForTimeout(3500)
      row.afterEsc = new URL(p.url()).pathname
      row.ok = !row.appHeader && row.exits.length === 1 && row.exits[0].x > width - 120 && row.exits[0].h >= 44 && row.afterEsc === pg.close
    } catch (e) {
      row.ok = false
      row.error = String(e).slice(0, 140)
    }
    process.stdout.write(`${row.ok ? '✓' : '✗'} ${pg.id} ${JSON.stringify({ appHeader: row.appHeader, exits: row.exits?.map((e) => [e.name, e.x, e.y, e.w, e.h]), action: row.actionChanged, esc: row.afterEsc, error: row.error })}\n`)
    results.push(row)
    await ctx.close()
  }
  await browser.close()
  fs.writeFileSync(path.join(outDir, `_sessions@${width}.json`), JSON.stringify({ sha: arg('sha', 'unknown'), results }, null, 2))
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
