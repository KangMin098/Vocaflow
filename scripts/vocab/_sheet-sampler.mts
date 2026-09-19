// scripts/vocab/_sheet-sampler.mts
//
// **학습자가 실제로 여는 지면을 표본으로 가져오는 한 곳.**
//
// ── 왜 공용으로 뺐나 ───────────────────────────────────────────────
// 지면 지수(`design-benchmark.mts`)와 선택 지수(`choice-benchmark.mts`)는 **같은 화면**을 재야
// 한다 — 하나는 매 쪽 장치를, 하나는 고를 근거를 세지만 둘 다 "학습자가 그 세트를 열었을 때"
// 가 기준이다. 여는 방법을 두 벌 두면 한쪽만 고쳐졌을 때 두 지수가 다른 화면을 재게 되고,
// 그 어긋남은 숫자만 봐서는 보이지 않는다.
//
// ── 무엇이 "여는 것" 인가 (실측 2026-09-06) ─────────────────────────
// `/library/vocab` 의 카드는 `NetflixDetailSheet` 를 연다. `VocabSetPreviewModal`(판권면·목차가
// 붙는 쪽)은 카테고리를 골라 격자를 띄운 뒤에도 **열리지 않는다**. 그래서 여기서 여는 것은
// 학습자가 실제로 닿는 시트이고, 그것이 두 지수의 공통 분모다.

import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Browser, Page } from 'playwright'

// `playwright` 는 워크스페이스 루트에 링크돼 있지 않다 — `@playwright/test` 가 `apps/web` 의
// devDependency 라서 거기서만 풀린다. 스크립트 위치 기준으로 그 package.json 에서 해석한다.
const HERE = path.dirname(fileURLToPath(import.meta.url))
const req = createRequire(path.join(HERE, '..', '..', 'apps', 'web', 'package.json'))
const { chromium } = req('@playwright/test') as typeof import('playwright')

export interface Sheet {
  /** 어느 경로로 열렸나 — 리포트가 "어느 화면을 잰 것인가" 를 말할 수 있어야 한다. */
  path: 'grid-modal' | 'carousel-sheet'
  title: string
  text: string
  html: string
}

/**
 * 표본 계획 — 카테고리를 갈아 가며 뽑는다.
 * `null` 은 기본 화면이다. 학습자가 **가장 먼저 만나는** 지면이라 반드시 넣는다.
 */
export const SAMPLE_PLAN: ReadonlyArray<{ chip: string | null; nth: number }> = [
  { chip: null, nth: 0 },
  { chip: null, nth: 1 },
  { chip: '어원', nth: 0 },
  { chip: '테마별', nth: 0 },
  { chip: '고등', nth: 0 },
  { chip: '초등', nth: 0 },
  { chip: '공인영어', nth: 0 },
  { chip: '중등', nth: 0 },
]

async function readDialog(page: Page): Promise<{ text: string; html: string } | null> {
  const dlg = page.locator('[role="dialog"]').first()
  if ((await dlg.count()) === 0) return null
  const stickyTitle = await dlg.evaluate((el) => {
    const title = el.querySelector('h1, h2, [id$="-title"]')
    for (let n: Element | null = title; n && n !== el.parentElement; n = n.parentElement) {
      const pos = getComputedStyle(n as Element).position
      if (pos === 'sticky' || pos === 'fixed') return true
    }
    return false
  })
  const html = `${await dlg.innerHTML()}\n<!--{"__stickyTitle":${stickyTitle}}-->`
  return { text: await dlg.innerText(), html }
}

async function openOne(
  page: Page,
  base: string,
  categoryChip: string | null,
  nth: number,
): Promise<Sheet | null> {
  await page.goto(`${base}/library/vocab`, { waitUntil: 'domcontentloaded' })
  /*
    ⚠️ 고정 대기로는 표본이 들쭉날쭉해진다 — 같은 명령이 8개 중 6개를 열었다가 2개만 열었다
    (실측 2026-09-06, 개발 서버 컴파일 지연). **카드가 나타날 때까지** 기다린다.
  */
  await page
    .locator('main button')
    .filter({ hasText: /\d+\s*단어/ })
    .first()
    .waitFor({ state: 'visible', timeout: 45_000 })

  if (categoryChip) {
    /*
      ⚠️ **카테고리 칩과 세트 카드를 글자로만 가르면 안 된다.** `hasText: '어원'` 은
      「📜 어원 2」칩과 「어원으로 익히는 1,500 · 1,500 단어」카드에 둘 다 걸린다.
      카드에는 낱말 수가 붙으므로 그것으로 가른다.
    */
    const chip = page
      .locator('main button')
      .filter({ hasText: categoryChip })
      .filter({ hasNotText: /\d+\s*단어/ })
      .first()
    if ((await chip.count()) === 0) return null
    await chip.click()
    await page.waitForTimeout(1800)
  }

  const cards = page.locator('main button').filter({ hasText: /\d+\s*단어/ })
  const n = await cards.count()
  if (n === 0) return null
  const card = cards.nth(Math.min(nth, n - 1))
  const title = (await card.innerText()).replace(/\s+/g, ' ').trim().slice(0, 60)
  await card.click()
  await page.locator('[role="dialog"]').first().waitFor({ state: 'visible', timeout: 20_000 })
  /*
    ⚠️ **지면은 열린 뒤에 채워진다** — 시트는 즉시 뜨지만 지면은 `/api/vocab/<id>/spread` 를
    기다린다. 로딩 문구가 사라질 때까지 기다리지 않으면 응답이 늦은 시트만 "장치가 없다" 로
    세어져 실행마다 다른 지수가 나온다.
  */
  await page
    .locator('[role="dialog"]')
    .first()
    .getByText('지면을 여는 중')
    .waitFor({ state: 'detached', timeout: 60_000 })
    .catch(() => {})
  await page.waitForTimeout(800)

  const d = await readDialog(page)
  if (!d) return null
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(400)
  return { path: d.html.includes('vocab-preview-title') ? 'grid-modal' : 'carousel-sheet', title, ...d }
}

/**
 * 표본을 연다. 한 번 실패했다고 빼면 표본 수가 실행마다 달라지므로 **두 번까지** 다시 해 본다.
 */
export async function sampleSheets(base: string, samples: number): Promise<{
  sheets: Sheet[]
  browser: Browser
}> {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 2200 } })
  const sheets: Sheet[] = []
  for (const plan of SAMPLE_PLAN.slice(0, samples)) {
    let sheet: Sheet | null = null
    for (let attempt = 1; attempt <= 2 && !sheet; attempt += 1) {
      try {
        sheet = await openOne(page, base, plan.chip, plan.nth)
      } catch (err) {
        console.error(
          `  ! ${plan.chip ?? '기본'} #${plan.nth} 열기 실패(${attempt}/2): ${(err as Error).message.split('\n')[0]}`,
        )
      }
    }
    if (sheet) sheets.push(sheet)
  }
  return { sheets, browser }
}
