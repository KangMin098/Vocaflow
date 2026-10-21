// scripts/design/vault-check.mjs
//
// 단어장 허브(/wordvault)의 세 역할이 남았는지 실제로 실행한다 — learner-tines-audit S3 단어장의 I 근거.
//   제목: h1 하나 · 시작선(판 ↔ 본문 카드) 일치
//   학습 조작: 보기 탭 4개가 링크로 이동 · 현재 탭 표시 · 「지금 다시 만나기」 이동 · 테마 전환
//   자료 정보: 본문 카드(단어 수 · 기억 4색) · 자료 묶음 미리보기 팝업 열기/Esc
// 사용: node scripts/design/vault-check.mjs --base http://localhost:3041 --out <dir> [--width 1440]

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
const BASELINE = arg('baseline', null)
const outDir = path.resolve(ROOT, arg('out', 'tmp/s3/vault-check'))
const width = Number(arg('width', '1440'))
const STATE_FILE = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', ...(fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {}) })
  const p = await ctx.newPage()
  const steps = []
  const step = async (name, fn) => {
    try { const r = await fn(); steps.push({ name, ...r }); process.stdout.write(`${r.ok ? '✓' : '✗'} ${name} ${JSON.stringify({ ...r, ok: undefined })}\n`) }
    catch (e) { steps.push({ name, ok: false, error: String(e).slice(0, 140) }); process.stdout.write(`✗ ${name} — ${String(e).slice(0, 90)}\n`) }
  }
  const go = async () => { await p.goto(`${BASE}/wordvault`, { waitUntil: 'domcontentloaded', timeout: 120_000 }); await p.waitForTimeout(5000) }
  await go()

  await step('제목 h1 하나 · 판과 본문 카드 시작선 일치', async () => {
    const h1s = await p.locator('h1').allTextContents()
    const hero = await p.locator('header:has(h1)').first().boundingBox()
    // 본문 첫 카드 = 「지금 다시 만나기」(또는 「새 단어 익히기」)를 감싼 테두리 있는 넓은 상자
    const card = await p.evaluate(() => {
      const cta = [...document.querySelectorAll('a')].find((a) => /지금 다시 만나기|새 단어 익히기/.test(a.textContent ?? ''))
      let c = cta?.parentElement ?? null
      // 테두리는 border 이거나 Tines 스킨의 그림자 고리(box-shadow 0 0 0 1px)다
      const framed = (e) => { const cs = getComputedStyle(e); return cs.borderTopWidth !== '0px' || cs.boxShadow !== 'none' }
      while (c && !(c.getBoundingClientRect().width > 600 && framed(c))) c = c.parentElement
      return c ? { x: Math.round(c.getBoundingClientRect().x) } : null
    })
    return { ok: h1s.length === 1 && hero && card && Math.abs(hero.x - card.x) <= 2, h1s, heroX: hero && Math.round(hero.x), cardX: card?.x }
  })
  await step('보기 탭 4개 · 현재 탭 표시(허브)', async () => {
    const tabs = p.getByRole('navigation', { name: '보기' }).getByRole('link')
    const labels = await tabs.allTextContents()
    const current = await p.getByRole('navigation', { name: '보기' }).locator('[aria-current="page"]').allTextContents()
    const heights = await tabs.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
    return { ok: labels.length === 4 && current.join() === '허브' && heights.every((h) => h >= 44), labels, current, heights }
  })
  await step('탭 「둘러보기」 → /wordvault/browse', async () => {
    await p.getByRole('navigation', { name: '보기' }).getByRole('link', { name: '둘러보기' }).click()
    await p.waitForURL(/\/wordvault\/browse/, { timeout: 60_000 })
    const url = new URL(p.url()).pathname
    await go()
    return { ok: url === '/wordvault/browse', url }
  })
  await step('테마 전환 → data-theme 바뀜(되돌림)', async () => {
    const before = await p.evaluate(() => document.documentElement.getAttribute('data-theme'))
    await p.getByRole('button', { name: '테마 전환' }).click()
    await p.waitForTimeout(400)
    const after = await p.evaluate(() => document.documentElement.getAttribute('data-theme'))
    await p.screenshot({ path: path.join(outDir, `theme-toggled@${width}.png`) })
    await p.getByRole('button', { name: '테마 전환' }).click()
    await p.waitForTimeout(300)
    return { ok: before !== after, before, after }
  })
  await step('자료 정보 — 단어 수 · 기억 4색 칸', async () => {
    const txt = await p.locator('main').first().innerText()
    const has = ['안정', '흔들림', '흐릿함', '새 단어'].filter((k) => txt.includes(k))
    return { ok: has.length === 4 && /\d+\s*단어/.test(txt), memory: has }
  })
  // 「지금 다시 만나기」의 목적지는 화면 코드(VaultIdentity)가 정한다 — 머리를 바꾼 뒤에도 **기준선과 같은 곳**으로 가는지 본다.
  // (처음엔 「세션으로 간다」고 기대했는데, 원래 동작은 흐릿한 단어 목록 browse?filter=state:risk 였다 — 기대값 오류 정정)
  await step('「지금 다시 만나기」 → 기준선과 같은 목적지', async () => {
    const cta = p.getByRole('link', { name: /지금 다시 만나기|새 단어 익히기/ }).first()
    const href = await cta.getAttribute('href')
    let baseHref = null
    if (BASELINE) {
      const bp = await ctx.newPage()
      await bp.goto(`${BASELINE}/wordvault`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
      await bp.waitForTimeout(5000)
      baseHref = await bp.getByRole('link', { name: /지금 다시 만나기|새 단어 익히기/ }).first().getAttribute('href').catch(() => null)
      await bp.close()
    }
    await cta.click()
    await p.waitForTimeout(3000)
    const url = new URL(p.url())
    await go()
    return { ok: Boolean(href) && (!BASELINE || href === baseHref) && `${url.pathname}${url.search}` === href, href, baseHref, landed: `${url.pathname}${url.search}` }
  })
  await step('자료 묶음 미리보기 팝업 → Esc 닫힘', async () => {
    const trigger = p.locator('main button').filter({ hasText: /미리|단어장|세트|권/ }).first()
    await trigger.scrollIntoViewIfNeeded()
    await trigger.click()
    await p.waitForTimeout(1000)
    const open = await p.locator('[role="dialog"][aria-modal="true"]').count()
    await p.screenshot({ path: path.join(outDir, `preview@${width}.png`) })
    await p.keyboard.press('Escape')
    await p.waitForTimeout(600)
    const closed = (await p.locator('[role="dialog"][aria-modal="true"]').count()) === 0
    return { ok: open === 1 && closed, open, closed, trigger: (await trigger.textContent())?.trim().slice(0, 30) }
  })
  await browser.close()
  fs.writeFileSync(path.join(outDir, `_vault@${width}.json`), JSON.stringify({ base: BASE, sha: arg('sha', 'unknown'), width, at: new Date().toISOString(), steps }, null, 2))
  console.log(`\n${steps.filter((s) => s.ok).length}/${steps.length}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
