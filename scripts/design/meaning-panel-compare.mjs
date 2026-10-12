#!/usr/bin/env node
// scripts/design/meaning-panel-compare.mjs
//
// **v3.1 원문 이해 패널 ↔ 3B 참조 명세 실측 대조.** (docs/design/refs/3b/meaning-panel/spec.json)
//   node --env-file=<apps/web/.env.local> scripts/design/meaning-panel-compare.mjs [--base http://localhost:3000] [--tol 2] [--item 2026-34]
// PC 1280 · 1440(라이트)에서 실제 화면을 열어 카드 · 구절 행 · 알약의 계산된 크기 · 색을 재고 명세와 표로 대조한다.
// 학습 지도 대조(ref-compare.mjs)와 별개다 — 그 결과로 이 패널을 검증하지 않는다.
// 누름 대상 높이는 명세 deviations.minTarget(44, 접근성 규칙)이 기대값이다 — 참조 높이보다 앞선다(표에 둘 다 적는다).
import fs from 'node:fs'
import path from 'node:path'

import { ROOT, chromium } from './lib/ref-page.mjs'

const argv = process.argv.slice(2)
const arg = (k, d) => {
  const i = argv.indexOf(k)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
const BASE = arg('--base', process.env.CAPTURE_BASE_URL || 'http://localhost:3000')
const TOL = Number(arg('--tol', 2))
const ITEM = arg('--item', '2026-34')
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/design/refs/3b/meaning-panel/spec.json'), 'utf8'))
const email = process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev'
const password = process.env.PLAYWRIGHT_RUNTIME_PASSWORD
if (!password) {
  console.error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — node --env-file=apps/web/.env.local 로 실행')
  process.exit(2)
}
const hex = (rgb) => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb ?? '')
  return m ? '#' + m.slice(1, 4).map((v) => Number(v).toString(16).padStart(2, '0')).join('') : String(rgb)
}

const browser = await chromium.launch()
let fail = 0
for (const width of [1280, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })
  page.setDefaultTimeout(240_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.keyboard.press('Enter')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 150_000 })
  await page.goto(`${BASE}/csat/item/${ITEM}?scene=meaning`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="ms-explain"]')
  await page.waitForTimeout(800)
  const m = await page.evaluate(() => {
    const cs = (el) => getComputedStyle(el)
    const r = (el) => el.getBoundingClientRect()
    const head = document.querySelector('[data-testid="ms-head-card"]')
    const card = document.querySelector('[data-testid="ms-explain"]')
    const row = card.querySelector('[data-testid="ms-phrase"]')
    const pressed = document.querySelector('[data-testid="ms-units"] button[aria-pressed="true"]')
    const soft = card.querySelector('[data-testid="ms-go-judgment"]')
    return {
      cardBg: cs(card).backgroundColor, cardBorder: cs(card).borderTopColor, cardRadius: parseFloat(cs(card).borderTopLeftRadius),
      cardGap: r(card).top - r(head).bottom,
      insetX: r(row).left - r(card).left - parseFloat(cs(card).borderLeftWidth),
      padY: parseFloat(cs(card).paddingTop),
      fieldBg: cs(row).backgroundColor, fieldH: r(row).height,
      pillActiveBg: cs(pressed).backgroundColor, pillActiveH: r(pressed).height,
      pillSoftBg: cs(soft).backgroundColor, pillSoftH: r(soft).height,
    }
  })
  const min = spec.deviations.minTarget
  const rows = [
    ['카드 면', spec.card.bg, hex(m.cardBg)],
    ['카드 테두리', spec.card.border, hex(m.cardBorder)],
    ['카드 반경', spec.card.radius, m.cardRadius],
    ['카드 사이 간격', spec.card.gap, m.cardGap],
    ['카드 → 구절 행(가로)', spec.card.insetX, m.insetX],
    ['카드 위 여백', spec.card.padY, m.padY],
    ['구절 행 면', spec.field.bg, hex(m.fieldBg)],
    [`구절 행 높이(참조 ${spec.field.h} → 규칙 ${min})`, Math.max(min, spec.field.h), m.fieldH, 'min'],
    ['의미 고르기 눌림 면', spec.pillActive.bg, hex(m.pillActiveBg)],
    [`의미 알약 높이(참조 ${spec.pillActive.h} → 규칙 ${min})`, Math.max(min, spec.pillActive.h), m.pillActiveH, 'min'],
    ['이어 가기 알약 면', spec.pillSoft.bg, hex(m.pillSoftBg)],
    [`이어 가기 높이(참조 ${spec.pillSoft.h} → 규칙 ${min})`, Math.max(min, spec.pillSoft.h), m.pillSoftH, 'min'],
  ]
  console.log(`\n${width}×900 · ${ITEM} · 허용 ±${TOL}px (높이는 최소값 이상)\n`)
  console.log('항목 | 참조(기대) | 우리 | 판정')
  console.log('---|---|---|---')
  for (const [name, ref, our, mode] of rows) {
    const ok = typeof ref === 'string' ? ref.toLowerCase() === String(our).toLowerCase() : mode === 'min' ? our >= ref - TOL : Math.abs(our - ref) <= TOL
    if (!ok) fail++
    console.log(`${name} | ${ref} | ${typeof our === 'number' ? our.toFixed(1) : our} | ${ok ? '통과' : '실패'}`)
  }
  await page.close()
}
await browser.close()
console.log(fail === 0 ? '\n모든 항목이 참조 명세와 맞는다.' : `\n${fail}개 항목이 참조 명세에서 벗어났다.`)
process.exit(fail === 0 ? 0 : 1)
