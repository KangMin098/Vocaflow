// scripts/design/learner-overlay-check.mjs
//
// 학습자 화면의 팝업·검색을 **실제로 열고 닫아 본다** — learner-tines-audit 의 I(상호작용) 칸 근거.
// 열기 → 역할·모달 속성 → 껍데기 계산 스타일(모서리·그림자·테두리) → Esc 로 닫힘 → 포커스 복귀를 잰다.
// 열지 못한 것은 「열기 실패」로 적는다 — 통과로 세지 않는다.
//
// 사용: node -r dotenv/config scripts/design/learner-overlay-check.mjs --base http://localhost:3041 --sha <커밋> --out docs/design/shots/learner-tines/s2
// 계정·로그인 상태 파일은 capture-learner.mjs 와 같다(로그인 횟수를 늘리지 않는다).

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
const BASE = arg('base', 'http://localhost:3000')
const SHA = arg('sha', 'unknown')
const outDir = path.resolve(ROOT, arg('out', 'docs/design/shots/learner-tines/overlays'))
const STATE_FILE = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')
const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD ?? (() => { throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다') })(),
}
const TEXT_ID = arg('text', '859e0b09-6dcc-4c70-97ee-7563341bf8d4')

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(900)
  await page.fill('input[type="email"]', USER.email)
  await page.fill('input[type="password"]', USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 150_000 })
}

/** 열린 대화상자(가장 위)의 속성·계산 스타일 */
const probeDialog = () => {
  // 닫힌 곁 패널처럼 화면 밖으로 밀려 있거나 aria-hidden 인 것은 열린 것이 아니다(1차 실행 오판 2건).
  const all = [...document.querySelectorAll('[role="dialog"]')].filter((d) => {
    const r = d.getBoundingClientRect(); const cs = getComputedStyle(d)
    const onScreen = r.right > 1 && r.left < innerWidth - 1 && r.bottom > 1 && r.top < innerHeight - 1
    return r.width > 0 && r.height > 0 && onScreen && cs.visibility !== 'hidden' && cs.opacity !== '0' && d.getAttribute('aria-hidden') !== 'true'
  })
  const d = all[all.length - 1]
  if (!d) return null
  const cs = getComputedStyle(d)
  const r = d.getBoundingClientRect()
  return {
    label: d.getAttribute('aria-label') || d.getAttribute('aria-labelledby'),
    modal: d.getAttribute('aria-modal'),
    w: Math.round(r.width), h: Math.round(r.height),
    radius: cs.borderRadius, shadow: cs.boxShadow.slice(0, 80), border: cs.borderTopWidth + ' ' + cs.borderTopColor,
    bg: cs.backgroundColor,
  }
}

const SCENARIOS = [
  {
    id: 'hub-search', route: '/hub',
    open: async (p) => { await p.keyboard.press('Control+k') },
    trigger: 'button[aria-label="검색 (Ctrl+K)"]',
    after: async (p, row) => {
      await p.keyboard.type('hamlet', { delay: 30 })
      // 결과 링크가 생기거나 「없」(결과 없음) 문구가 뜰 때까지 — 고정 대기·「찾는 중」 사라짐 대기는
      // 200ms 디바운스 전의 빈 상태를 재서 0건으로 적었다(2026-10-18 오판 2회).
      await p.waitForFunction(() => {
        const d = document.querySelector('[role="dialog"][aria-modal="true"]')
        return Boolean(d && (d.querySelector('a[href]') || /없/.test(d.textContent ?? '')))
      }, null, { timeout: 30_000 }).catch(() => { row.searchTimeout = true })
      row.results = await p.evaluate(() => document.querySelectorAll('[role="dialog"] a[href]').length)
    },
  },
  {
    id: 'hub-search-click', route: '/hub',
    open: async (p) => { await p.click('button[aria-label="검색 (Ctrl+K)"]') },
    trigger: 'button[aria-label="검색 (Ctrl+K)"]',
  },
  {
    id: 'books-detail-sheet', route: '/library/books',
    open: async (p) => {
      // 둘러보기 격자의 첫 책 카드(버튼) — 시트를 연다
      const card = p.locator('main button:has(img)').first()
      await card.scrollIntoViewIfNeeded()
      await card.click()
    },
  },
  {
    id: 'vocab-preview', route: '/library/vocab',
    open: async (p) => {
      const card = p.locator('main button').filter({ hasText: /단어|words|미리/ }).first()
      await card.scrollIntoViewIfNeeded()
      await card.click()
    },
  },
  {
    id: 'reader-type-popover', route: `/text/${TEXT_ID}?mode=read`,
    open: async (p) => {
      const b = p.locator('button[aria-label*="타이포"], button[aria-label*="글자"], button[title*="글자"]').first()
      await b.click()
    },
  },
  {
    id: 'reader-chapter-nav', route: `/text/${TEXT_ID}?mode=read`,
    open: async (p) => { await p.getByRole('button', { name: /목차/ }).first().click() },
  },
  {
    id: 'session-no-search', route: '/flashcard/play?set=6f92ab53-b978-4b08-9c6c-adeab6aeee11',
    noOverlay: true,
  },
]

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const fresh = fs.existsSync(STATE_FILE) && Date.now() - fs.statSync(STATE_FILE).mtimeMs < 25 * 60 * 1000
  let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(fresh ? { storageState: STATE_FILE } : {}) })
  {
    const p = await ctx.newPage()
    await p.goto(`${BASE}/hub`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await p.waitForTimeout(2500)
    if (new URL(p.url()).pathname.startsWith('/login')) { await login(p); await ctx.storageState({ path: STATE_FILE }) }
    await p.close()
  }
  const results = []
  for (const s of SCENARIOS) {
    const row = { id: s.id, route: s.route, base: BASE, sha: SHA, width: 1440, theme: 'light', at: new Date().toISOString() }
    const p = await ctx.newPage()
    try {
      await p.goto(`${BASE}${s.route}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
      await p.waitForTimeout(4500)
      row.landed = new URL(p.url()).pathname
      if (s.noOverlay) {
        row.searchButton = await p.locator('button[aria-label="검색 (Ctrl+K)"]').count()
        await p.keyboard.press('Control+k')
        await p.waitForTimeout(600)
        row.dialogAfterCtrlK = Boolean(await p.evaluate(probeDialog))
        row.ok = row.searchButton === 0 && !row.dialogAfterCtrlK
      } else {
        await s.open(p)
        await p.waitForTimeout(900)
        row.opened = await p.evaluate(probeDialog)
        if (!row.opened) throw new Error('열기 실패 — 보이는 role=dialog 없음')
        if (s.after) await s.after(p, row)
        await p.screenshot({ path: path.join(outDir, `${s.id}@1440-open.png`) })
        await p.keyboard.press('Escape')
        await p.waitForTimeout(700)
        row.closedByEsc = !(await p.evaluate(probeDialog))
        if (s.trigger) row.focusReturned = await p.evaluate((sel) => document.activeElement?.matches(sel) ?? false, s.trigger)
        row.ok = row.closedByEsc && (s.trigger ? row.focusReturned : true)
      }
    } catch (e) {
      row.ok = false
      row.error = String(e).slice(0, 140)
    }
    process.stdout.write(`${row.ok ? '✓' : '✗'} ${s.id}${row.error ? ' — ' + row.error.slice(0, 80) : ''}\n`)
    results.push(row)
    await p.close()
  }
  await browser.close()
  fs.writeFileSync(path.join(outDir, '_overlays.json'), JSON.stringify(results, null, 2))
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} → ${outDir}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
