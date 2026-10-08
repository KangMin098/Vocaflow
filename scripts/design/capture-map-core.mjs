#!/usr/bin/env node
// scripts/design/capture-map-core.mjs
//
// 학습 지도 전후 캡처 — 첫 화면(핵심 요약) · 전체 지도(상세) · A 라인 팝업(관찰 · 근거 탭) · 비역량 노드 팝업.
//   node --env-file=apps/web/.env.local scripts/design/capture-map-core.mjs --base http://localhost:3100 --out <dir> [--prefix after]
// 첫 화면의 노드(카드) 수도 출력한다. 로그인은 런타임 테스트 계정(값은 env 에서만 읽고 출력하지 않는다).

import fs from 'node:fs'
import path from 'node:path'
import { chromium } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const arg = (k, d) => {
  const i = argv.indexOf(k)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
const BASE = arg('--base', 'http://localhost:3100')
const OUT = arg('--out', '.')
const PREFIX = arg('--prefix', 'after')
const email = process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev'
const password = process.env.PLAYWRIGHT_RUNTIME_PASSWORD
if (!password) {
  console.error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — node --env-file=apps/web/.env.local 로 실행')
  process.exit(2)
}
fs.mkdirSync(OUT, { recursive: true })
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${PREFIX}-${name}.png`), fullPage: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
page.setDefaultTimeout(240_000)
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle').catch(() => {})
await page.waitForTimeout(2500)
await page.fill('input[type="email"]', email)
await page.fill('input[type="password"]', password)
await page.keyboard.press('Enter')
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 150_000 })

// 1) 첫 화면
await page.goto(`${BASE}/csat/diagnosis?tab=map`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('[data-testid="csat-core-map"], [data-map-cols]')
await page.waitForTimeout(1500)
const first = await page.evaluate(() => ({
  coreCards: document.querySelectorAll('[data-core]').length,
  mapNodes: document.querySelectorAll('[data-map-node]').length,
  cards: [...document.querySelectorAll('[data-core]')].map((el) => `${el.getAttribute('data-core')}:${el.getAttribute('data-status')}`),
}))
console.log('첫 화면', JSON.stringify(first))
await shot(page, '1-first')

// 2) 전체 지도
await page.goto(`${BASE}/csat/diagnosis?tab=map&view=full`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('[data-map-cols]')
await page.waitForTimeout(1500)
console.log('전체 지도 노드', await page.locator('[data-map-node]').count())
await shot(page, '2-full')

// 3) A 라인 팝업 — 관찰 · 근거 탭
await page.locator('[data-map-node="A1"]').click()
await page.waitForSelector('[data-map-modal]')
await page.getByRole('tab', { name: /관찰|달성/ }).click()
await page.waitForTimeout(400)
await page.locator('[data-map-modal]').screenshot({ path: path.join(OUT, `${PREFIX}-3-popup-A1-observe.png`) })
await page.getByRole('tab', { name: '근거' }).click()
await page.waitForTimeout(400)
await page.locator('[data-map-modal]').screenshot({ path: path.join(OUT, `${PREFIX}-4-popup-A1-basis.png`) })
await page.keyboard.press('Escape')

// 4) 비역량 노드(측정 렌즈 B) 팝업 — 목표 탭
const b = page.locator('[data-map-node="B"]')
if (await b.count()) {
  await b.click()
  await page.waitForSelector('[data-map-modal]')
  await page.waitForTimeout(400)
  await page.locator('[data-map-modal]').screenshot({ path: path.join(OUT, `${PREFIX}-5-popup-B.png`) })
}
await browser.close()
