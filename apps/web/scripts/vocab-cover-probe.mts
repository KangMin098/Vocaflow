// apps/web/scripts/vocab-cover-probe.mts
//
// **단어장 표지를 실제 화면에서 굽어 본다.**
//
// ── 왜 필요한가 ────────────────────────────────────────────────────
// 교재 표지에서 배운 것이 그대로 적용된다: 표지는 코드를 읽어서 판정할 수 없다
// (`cover-probe.mts` 머리 주석 — 굽어 보고서야 셋이 드러났다). 단어장 표지도 2026-09-07 에
// 브랜드 각인을 화면에 연결했는데, 렌더 단언은 "글자가 마크업에 있다" 까지만 말한다.
// **겹치는지 · 읽히는지 · 시리즈로 보이는지**는 그림이라야 보인다.
//
// 교재 쪽과 달리 여기서는 **실제 화면**을 찍는다 — 단어장 표지는 SVG 한 장이 아니라
// 카드·칩·스크림·Tailwind 토큰이 겹친 결과라, 합성한 판을 찍으면 화면과 다른 것을 보게 된다.
//
// ── 쓰기 ────────────────────────────────────────────────────────────
//   pnpm --filter web dev            (다른 창에서)
//   pnpm --filter web vocab:probe <출력디렉터리> [기준URL]
//
// 읽기만 한다 · 재실행 안전 · 산출물은 저장소 밖(인자로 받은 디렉터리)에 쓴다.

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { chromium } from '@playwright/test'

const OUT = process.argv[2] ?? '.'
const BASE = process.argv[3] ?? 'http://localhost:3000'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })

const shots: string[] = []
const shoot = async (name: string, selector?: string, opts: { pad?: number } = {}) => {
  const path = join(OUT, `${name}.png`)
  if (selector) {
    const el = page.locator(selector).first()
    await el.scrollIntoViewIfNeeded()
    const box = await el.boundingBox()
    if (!box) {
      console.log(`  ! ${name} — ${selector} 가 화면에 없다`)
      return
    }
    const pad = opts.pad ?? 0
    await page.screenshot({
      path,
      clip: {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: box.width + pad * 2,
        height: box.height + pad * 2,
      },
    })
  } else {
    await page.screenshot({ path, fullPage: true })
  }
  shots.push(path)
  console.log(`  ${name}.png`)
}

await page.goto(`${BASE}/library/vocab`, { waitUntil: 'networkidle', timeout: 180_000 })
// 표지는 서버 렌더 결과라 추가 대기가 필요 없지만, 캐러셀은 마운트 후 자리를 잡는다.
await page.waitForTimeout(1200)

console.log('찍는다:')
await shoot('01-page-top')
// 히어로 — 규격의 글자(kicker · 권 번호 · 계열 줄)가 보이는 유일한 표면
await shoot('02-hero', '.book-cover-premium--center', { pad: 16 })
/*
  격자 타일은 **묶음 보기를 벗어나야** 나온다(`VocabSetGrid` 의 `isGrouped`) —
  기본 화면은 카테고리별 캐러셀이라 타일이 **DOM 에 아예 없다**(실측: `article` 0개).
  정렬을 바꿔 격자로 넘어간다.
*/
const sort = page.locator('select').last()
if (await sort.count()) {
  await sort.selectOption({ index: 1 }).catch(() => {})
  await page.waitForTimeout(900)
}
await shoot('03-tile', 'article[id^="set-"]', { pad: 12 })

// 타일 여섯 장을 한 화면에 — 계열 색이 서가에서 갈리는가
const grid = page.locator('article[id^="set-"]')
const n = await grid.count()
if (n > 0) {
  const first = await grid.first().boundingBox()
  if (first) {
    await page.screenshot({
      path: join(OUT, '04-shelf.png'),
      clip: { x: Math.max(0, first.x - 12), y: Math.max(0, first.y - 12), width: 1280 - Math.max(0, first.x - 12) - 24, height: Math.min(720, first.height * 2 + 60) },
    })
    shots.push(join(OUT, '04-shelf.png'))
    console.log('  04-shelf.png')
  }
}

// 모바일 — 390px 에서 타일이 더 작아진다(글자가 살아남는지)
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(600)
await shoot('05-mobile', 'article[id^="set-"]', { pad: 10 })

await browser.close()
console.log(`\n표지 ${shots.length}장 → ${OUT}`)
