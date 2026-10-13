#!/usr/bin/env node
// scripts/design/home-browse-compare.mjs
//
// **v3 M1 지도 홈 · 기출 탐구 조건 ↔ 3B 참조 명세 실측 대조.** (docs/design/refs/3b/home-browse/spec.json)
//   node --env-file=<apps/web/.env.local> scripts/design/home-browse-compare.mjs [--base http://localhost:3000] [--tol 2]
// PC 1280 · 1440(라이트)에서 실제 화면을 열어 계산된 크기 · 색을 재고 표로 낸다. 학습 지도(ref-compare) · 원문 이해 패널과 별개.
// 누름 대상 높이의 기대값은 deviations.minTarget(44, 접근성 규칙) — 참조 알약 높이보다 앞선다.
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
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/design/refs/3b/home-browse/spec.json'), 'utf8'))
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

  await page.goto(`${BASE}/csat`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="home-explore"]')
  const home = await page.evaluate(() => {
    const cs = (el) => getComputedStyle(el)
    const r = (el) => el.getBoundingClientRect()
    const card = document.querySelector('[data-testid="home-explore"]')
    const mine = document.querySelector('[data-testid="home-mine"] a')
    const go = document.querySelector('[data-testid="home-explore-go"]')
    return {
      cardBg: cs(card).backgroundColor, cardBorder: cs(card).borderTopColor, cardRadius: parseFloat(cs(card).borderTopLeftRadius),
      cardPadY: parseFloat(cs(card).paddingTop), cardPadX: parseFloat(cs(card).paddingLeft),
      mineBg: cs(mine).backgroundColor, mineRadius: parseFloat(cs(mine).borderTopLeftRadius), mineH: r(mine).height,
      goBg: cs(go).backgroundColor, goFg: cs(go).color, goH: r(go).height,
    }
  })
  await page.goto(`${BASE}/csat/browse?purpose=killer`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="browse-conditions"]')
  const br = await page.evaluate(() => {
    const cs = (el) => getComputedStyle(el)
    const r = (el) => el.getBoundingClientRect()
    const on = document.querySelector('[data-purpose="killer"]')
    const off = document.querySelector('[data-purpose="evidence"]')
    const sel = document.querySelector('#csat-browse-exam')
    return {
      onBg: cs(on).backgroundColor, onFg: cs(on).color, onH: r(on).height, onRadius: parseFloat(cs(on).borderTopLeftRadius),
      offBg: cs(off).backgroundColor, offBorder: cs(off).borderTopColor, selH: r(sel).height,
    }
  })
  const min = spec.deviations.minTarget
  const pillR = (v) => v >= 22 // 알약(9999px)은 계산값이 높이의 절반으로 잘린다 — 높이 44 의 절반 이상이면 알약
  const rows = [
    ['홈 · 기출 탐구 카드 면', spec.card.bg, hex(home.cardBg)],
    ['홈 · 카드 테두리', spec.card.border, hex(home.cardBorder)],
    ['홈 · 카드 반경', spec.card.radius, home.cardRadius],
    ['홈 · 카드 위 여백', spec.card.padY, home.cardPadY],
    ['홈 · 카드 가로 안쪽', spec.card.insetX, home.cardPadX],
    ['홈 · 내 자료 알약 면', spec.pillSoft.bg, hex(home.mineBg)],
    ['홈 · 내 자료 알약 반경(알약)', true, pillR(home.mineRadius)],
    [`홈 · 내 자료 높이(참조 ${spec.pillSoft.h} → 규칙 ${min})`, min, home.mineH, 'min'],
    ['홈 · 1차 행동 면', spec.primary.bg, hex(home.goBg)],
    ['홈 · 1차 행동 글자', spec.primary.fg, hex(home.goFg)],
    [`홈 · 1차 행동 높이(규칙 ${min})`, min, home.goH, 'min'],
    ['서가 · 고른 조건 면', spec.primary.bg, hex(br.onBg)],
    ['서가 · 고른 조건 글자', spec.primary.fg, hex(br.onFg)],
    ['서가 · 조건 반경(알약)', true, pillR(br.onRadius)],
    ['서가 · 안 고른 조건 면', spec.field.bg, hex(br.offBg)],
    ['서가 · 안 고른 조건 테두리', spec.field.border, hex(br.offBorder)],
    [`서가 · 조건 높이(규칙 ${min})`, min, br.onH, 'min'],
    [`서가 · 회차 고르기 높이(규칙 ${min})`, min, br.selH, 'min'],
  ]
  console.log(`\n${width}×900 · 허용 ±${TOL}px (높이는 최소값 이상)\n`)
  console.log('항목 | 참조(기대) | 우리 | 판정')
  console.log('---|---|---|---')
  for (const [name, ref, our, mode] of rows) {
    const ok = typeof ref === 'boolean' ? ref === our : typeof ref === 'string' ? ref.toLowerCase() === String(our).toLowerCase() : mode === 'min' ? our >= ref - TOL : Math.abs(our - ref) <= TOL
    if (!ok) fail++
    console.log(`${name} | ${ref === true ? '알약' : ref} | ${typeof our === 'number' ? our.toFixed(1) : our === true ? '알약' : our} | ${ok ? '통과' : '실패'}`)
  }
  await page.close()
}
await browser.close()
console.log(fail === 0 ? '\n모든 항목이 참조 명세와 맞는다.' : `\n${fail}개 항목이 참조 명세에서 벗어났다.`)
process.exit(fail === 0 ? 0 : 1)
