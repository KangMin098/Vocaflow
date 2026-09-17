// apps/web/scripts/csat-learner/gate4-shots.mts
//
// **Gate 4 · 최종 스크린샷 3장** — 홈 · 세션(② 이해 · 근거 설명 펼침) · 기록. 375px.
// 그리고 화면마다 **보이는 인터랙티브 요소 수**를 남긴다 — 「요소 하나 제거」가 실제로 줄었는지의 자.
//
// ⚠️ 세션 스크린샷에는 평가원 지문이 찍힌다 → `test-results-csat-learner/`(gitignore).
//
//   npx tsx scripts/csat-learner/gate4-shots.mts [--base http://localhost:3100]

import fs from 'node:fs'
import path from 'node:path'

import { chromium, type Page } from '@playwright/test'

import { REPORTS, arg, localPapers, writeJson } from './env.mts'

const BASE = arg('base') ?? 'http://localhost:3100'
const STATE = 'playwright-auth/.auth-csat-learner.json'
const SHOTS = path.resolve('test-results-csat-learner')
fs.mkdirSync(SHOTS, { recursive: true })

const a2026 = JSON.parse(fs.readFileSync(path.resolve('src/lib/csat/anchor-data/2026.json'), 'utf8'))
const paper = localPapers().get(a2026.sha256)
if (!paper) throw new Error('2026 원본이 없다')

/**
 * `<main>` 안에서 눈에 보이는 조작 요소 수 · 보이는 글자 수.
 * ⚠️ `evaluate` 안에 **이름 붙은 화살표 함수를 두지 않는다** — tsx(esbuild)가 `__name(...)` 을 끼워
 *    브라우저에서 `__name is not defined` 로 죽는다(실측).
 */
const facts = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body
    let controls = 0
    for (const e of main.querySelectorAll('button, a[href], [role="button"], input:not([type="hidden"]), select, summary')) {
      const r = (e as HTMLElement).getBoundingClientRect()
      if (r.width > 0 && r.height > 0) controls += 1
    }
    return { controls, chars: (main as HTMLElement).innerText.replace(/\s+/g, '').length }
  })

const browser = await chromium.launch()
const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()

// 기기 정리 + 온보딩 끝낸 상태 + 풀이 세 개(기록 화면이 비지 않게) · 서버 기록도 비운다
await page.request.delete(`${BASE}/api/csat/session/record`)
await page.goto(`${BASE}/csat/progress`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
await page.evaluate(async () => {
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase('vocaflow-csat')
    r.onsuccess = r.onerror = r.onblocked = () => res()
  })
  const day = 86_400_000
  const d1 = new Date(Date.now() - day).toISOString()
  const d2 = new Date(Date.now() - 2 * day).toISOString()
  await new Promise<void>((res) => {
    const r = indexedDB.open('vocaflow-csat', 1)
    r.onupgradeneeded = () => {
      r.result.createObjectStore('record')
      r.result.createObjectStore('papers')
    }
    r.onsuccess = () => {
      const tx = r.result.transaction('record', 'readwrite')
      tx.objectStore('record').put(
        {
          version: 1,
          onboarded: true,
          attempts: [
            { item_id: '2026#31', type_id: 'R-BLANK', correct: false, confused: false, at: d2, sec: 140 },
            { item_id: '2026#36', type_id: 'R-ORDER', correct: true, confused: false, at: d1, sec: 95 },
            { item_id: '2026#38', type_id: 'R-INSERT', correct: true, confused: true, at: d1, sec: 120 },
          ],
          reviews: [],
        },
        'me',
      )
      tx.oncomplete = () => {
        r.result.close()
        res()
      }
    }
  })
})

const out: Record<string, unknown> = {}

// ① 홈
await page.goto(`${BASE}/csat`, { waitUntil: 'domcontentloaded' })
await page.getByTestId('today-card').waitFor({ timeout: 60_000 })
await page.screenshot({ path: path.join(SHOTS, 'final-1-home.png') })
out.home = await facts(page)

// ② 세션 — 이해 단계, 근거 설명 펼침
await page.goto(`${BASE}/csat/session?set=2026-18&k=order`, { waitUntil: 'domcontentloaded' })
await page.getByTestId('paper-input').setInputFiles(paper)
await page.waitForSelector('[data-testid="item-screen"][data-phase="solve"]', { timeout: 90_000 })
out.solve = await facts(page)
await page.locator('[data-choice="1"]').click()
await page.waitForSelector('[data-testid="item-screen"][data-phase="understand"]')
await page.locator('[data-note-kind="evidence"]').first().click()
await page.getByTestId('sentence-note').waitFor()
await page.waitForTimeout(300)
await page.getByTestId('sentence-note').evaluate((el) => el.scrollIntoView({ block: 'center' }))
await page.screenshot({ path: path.join(SHOTS, 'final-2-session.png') })
out.understand = await facts(page)

// ③ 기록
await page.goto(`${BASE}/csat/progress`, { waitUntil: 'domcontentloaded' })
await page.getByTestId('accuracy').waitFor({ timeout: 30_000 })
await page.screenshot({ path: path.join(SHOTS, 'final-3-progress.png') })
out.progress = await facts(page)

await browser.close()
writeJson(path.join(REPORTS, 'gate4-shots.json'), {
  gate: 4,
  at: new Date().toISOString(),
  base: BASE,
  facts: out,
  shots: ['final-1-home.png', 'final-2-session.png', 'final-3-progress.png'].map((f) => `apps/web/test-results-csat-learner/${f}`),
})
console.log(JSON.stringify(out))
