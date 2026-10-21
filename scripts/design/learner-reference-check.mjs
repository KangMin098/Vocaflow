// scripts/design/learner-reference-check.mjs
// 대표 네 화면의 PC 렌더·기하·실제 탐색 동작을 확인한다. 학습/이벤트 쓰기는 브라우저에서 차단한다.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { blockLearningWrites } from './lib/read-only-context.mjs'
import { saveCaptureReport } from './lib/capture-report.mjs'
import { freezeMotion, installFreezeMotion, settleImages } from './lib/freeze-motion.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require_ = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = require_('@playwright/test')
const base = process.env.CAPTURE_BASE_URL ?? 'http://localhost:3041'
const out = path.resolve(ROOT, process.env.CAPTURE_OUT ?? 'tmp/s10/final')
const state = path.join(ROOT, 'apps/web/playwright-auth/.auth-design-capture.json')
const routes = ['/hub', '/library/books', '/dashboard', '/wordvault']
const ready = { '/hub': '.hub-reference', '/library/books': '.books-reference__grid', '/dashboard': '.dashboard-reference__memory', '/wordvault': '.vault-reference__identity' }
const blocked = [], renders = [], checks = []
fs.mkdirSync(out, { recursive: true })
assert.ok(fs.existsSync(state), '인증 상태 파일이 필요하다 — 내용을 출력하지 않는다')
const browser = await chromium.launch()
async function check(name, run) {
  try { const detail = await run(); checks.push({ name, ok: true, detail }); console.log(`PASS ${name}`) }
  catch (error) { checks.push({ name, ok: false, error: String(error).slice(0, 180) }); console.log(`FAIL ${name}: ${String(error).slice(0, 140)}`) }
}
try {
  for (const width of [1440, 1280]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, storageState: state, reducedMotion: 'reduce', colorScheme: theme })
    await blockLearningWrites(context, blocked)
    await context.addInitScript((value) => { localStorage.setItem('vocaflow-theme', value); document.documentElement.setAttribute('data-theme', value) }, theme)
    const page = await context.newPage()
    await installFreezeMotion(page)
    for (const route of routes) {
      const key = `${route.slice(1).replaceAll('/', '_')}@${width}-${theme}`
      try {
        await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 120000 })
        assert.equal(new URL(page.url()).pathname, route, '로그인/다른 경로로 이동됨')
        await page.locator(ready[route]).first().waitFor({ timeout: 90000 })
        if (route === '/library/books') await page.locator('[data-area-nav-slot] [role="tablist"]').waitFor()
        await page.evaluate(() => document.fonts.ready)
        await settleImages(page)
        await page.waitForFunction(() => [...document.querySelectorAll('[data-reference-cover]')].every(element => {
          const img = element.querySelector('img'), fallback = element.querySelector('[data-cover-fallback]')
          return img?.complete && (img.naturalWidth > 0 || (fallback && getComputedStyle(fallback).display !== 'none' && fallback.getBoundingClientRect().height > 0))
        }))
        await freezeMotion(page)
        const geometry = await page.evaluate(() => {
          const box = (selector) => { const e = document.querySelector(selector); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }
          return { heading: box('h1'), headingCount: document.querySelectorAll('h1').length, row: box('[data-compass-row]'), rail: box('.books-reference__rail'), hero: box('.books-reference__hero header'), canvas: getComputedStyle(document.body).backgroundColor, theme: document.documentElement.getAttribute('data-theme'), overflow: document.documentElement.scrollWidth > innerWidth + 1 }
        })
        assert.equal(geometry.headingCount, 1, 'h1 중복/누락')
        assert.equal(geometry.overflow, false, '페이지 가로 넘침')
        assert.equal(geometry.theme, theme, '실제 테마가 다름')
        if (route === '/library/books') {
          assert.equal(geometry.rail.x, 40)
          assert.equal(geometry.rail.width, 288)
          assert.ok(Math.abs(geometry.hero.x - (width === 1440 ? 400 : 392)) <= 2, '본문 시작선')
          assert.ok(geometry.hero.height >= 280 && geometry.hero.height <= 460, '장면 비율을 보존한 열린 머리 높이')
          assert.equal(geometry.hero.y, 154, '서가 첫 화면 머리 시작선')
          assert.ok(Math.abs(geometry.hero.y - geometry.rail.y) <= 2, '레일/머리 판 시작점 불일치')
        }
        await page.screenshot({ path: path.join(out, `${key}.png`) })
        if (width === 1440 && theme === 'light') await page.screenshot({ path: path.join(out, `${key}-full.png`), fullPage: true })
        renders.push({ route, landed: new URL(page.url()).pathname, width, theme, at: new Date().toISOString(), ok: true, geometry })
        console.log(`RENDER ${key}`)
      } catch (error) { renders.push({ route, width, theme, ok: false, error: String(error).slice(0, 200) }); console.log(`RENDER FAIL ${key}: ${String(error).slice(0, 140)}`); continue }
      if (theme !== 'light') continue
      if (route === '/hub') {
        await check(`상단 메뉴 Escape 후 열기 단추로 포커스 복귀 @${width}`, async () => {
          const trigger = page.locator('header').getByRole('button', { name: /^Read/ }).first()
          await trigger.focus()
          await page.keyboard.press('Enter')
          assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
          const panelId = await trigger.getAttribute('aria-controls')
          const panel = page.locator(`[id="${panelId}"]`)
          await panel.getByRole('link').first().focus()
          await page.keyboard.press('Escape')
          assert.equal(await trigger.getAttribute('aria-expanded'), 'false')
          assert.equal(await trigger.evaluate(element => element === document.activeElement), true)
        })
        await check(`전역 검색 Escape 후 검색 단추로 포커스 복귀 @${width}`, async () => {
          const trigger = page.getByRole('button', { name: /Ctrl\+K/ })
          await trigger.focus()
          await page.keyboard.press('Control+k')
          const dialog = page.getByRole('dialog').last()
          await dialog.waitFor({ state: 'visible' })
          await page.keyboard.press('Tab')
          assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true)
          await page.keyboard.press('Escape')
          await dialog.waitFor({ state: 'hidden' })
          assert.equal(await trigger.evaluate(element => element === document.activeElement), true)
        })
        await check(`오늘의 상태·도서 병렬 배치와 표지 실패 표시 @${width}`, async () => {
          const layout = await page.evaluate(() => {
            const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON()
            return { memory: rect('[data-hub-memory]'), books: rect('[data-hub-books]'), forecast: rect('[data-hub-forecast]') }
          })
          assert.ok(layout.books, '실제 추천 도서 목록 누락')
          if (layout.memory) {
            assert.ok(layout.books.x >= layout.memory.right + 16, '추천 도서가 기억 상태 아래로 밀림')
            assert.ok(Math.abs(layout.books.y - layout.memory.y) <= 2, '상태와 추천의 시작선 불일치')
          }
          const failedImages = await page.locator('[data-reference-cover] img').evaluateAll(images => images.filter(image => image.complete && !image.naturalWidth && getComputedStyle(image).visibility !== 'hidden').length)
          assert.equal(failedImages, 0, '실패한 원본 표지 아이콘 노출')
          return { sideBySide: !!layout.memory, books: layout.books }
        })
        await check(`플랫폼 탭 방향키·표지 높이 @${width}`, async () => {
          const tabs = page.getByRole('tablist', { name: 'Vocaflow 플랫폼' })
          await tabs.getByRole('tab').first().focus()
          await page.keyboard.press('End')
          assert.equal(await tabs.getByRole('tab').last().getAttribute('aria-selected'), 'true')
          await page.keyboard.press('Home')
          await page.getByRole('tabpanel').locator('[data-reference-cover]').first().waitFor()
          const covers = await page.getByRole('tabpanel').locator('[data-reference-cover]').evaluateAll(elements => elements.map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })))
          assert.ok(covers.length > 0 && covers.every(cover => cover.height >= cover.width * 1.45), '원본 실패 후 표지 비율 축소')
          await page.evaluate(() => window.scrollTo(0, 0))
          return { covers: covers.length }
        })
      }
      if (route === '/library/books') {
        const rail = page.locator('.books-reference__rail'), catalogue = page.locator('#browse')
        await check(`서가 검색→결과→상세 시트→Escape @${width}`, async () => {
          await rail.getByRole('searchbox', { name: '도서 검색' }).fill('hamlet')
          const cards = catalogue.locator('[role="listitem"]')
          await cards.first().waitFor({ state: 'visible' })
          const titles = await cards.allTextContents()
          assert.ok(titles.length > 0 && titles.every((title) => /hamlet/i.test(title)), '검색 결과 불일치')
          await cards.first().getByRole('link').first().click()
          const dialog = page.getByRole('dialog').last()
          await dialog.waitFor({ state: 'visible' })
          await page.keyboard.press('Escape')
          await dialog.waitFor({ state: 'hidden' })
          await rail.getByRole('searchbox').fill('')
          return { results: titles.length }
        })
        await check(`레벨 선택·초기화 @${width}`, async () => {
          const group = rail.locator('details').filter({ has: page.locator('summary', { hasText: '레벨' }) })
          if (!await group.evaluate((element) => element.open)) await group.locator('summary').click()
          const option = group.getByRole('button', { includeHidden: true }).first()
          await option.click()
          assert.equal(await option.getAttribute('aria-pressed'), 'true')
          assert.equal(await group.evaluate((element) => element.open), true)
          await rail.getByRole('button', { name: '초기화' }).click()
          assert.equal(await option.getAttribute('aria-pressed'), 'false')
        })
        await check(`레일 고정·구역 내비 한 줄 @${width}`, async () => {
          assert.equal(await page.locator('[data-area-nav-slot] [role="tablist"]').count(), 1)
          await page.evaluate(() => window.scrollTo(0, 600))
          const rect = await rail.boundingBox()
          assert.ok(rect.y >= 72 && rect.y <= 104)
          await page.evaluate(() => window.scrollTo(0, 0))
        })
      }
      if (route === '/wordvault') {
        await check(`단어장 보기 탭·기억 이름·기존 CTA @${width}`, async () => {
          const tabs = page.getByRole('navigation', { name: '보기' })
          assert.equal(await tabs.getByRole('link').count(), 4)
          assert.equal(await tabs.locator('[aria-current="page"]').innerText(), '허브')
          const text = await page.locator('.vault-reference__memory').innerText()
          for (const label of ['안정', '흔들림', '흐릿함', '새 단어']) assert.ok(text.includes(label))
          const href = await page.locator('.vault-reference__identity a').getAttribute('href')
          assert.equal(new URL(href, base).pathname, '/wordvault/browse')
          return { href }
        })
        await check(`테마 전환·복원 @${width}`, async () => {
          const toggle = page.getByRole('button', { name: '테마 전환' })
          await toggle.click()
          await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark')
          await toggle.click()
          await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light')
        })
      }
    }
    await context.close()
  }
} finally {
  await browser.close()
  saveCaptureReport(out, { base, reference: '기존 tmp/tines-ref/20261018의 1440 첫 화면/전체와 tmp/s8/tines의 구획 측정. 새 외부 재촬영은 ERR_NETWORK_ACCESS_DENIED', renders, checks, blockedWrites: blocked.length }, 16)
  fs.writeFileSync(path.join(out, '_blocked-writes.txt'), blocked.join('\n'))
}
console.log(`렌더 ${renders.filter((row) => row.ok).length}/${renders.length} · 상호작용 ${checks.filter((row) => row.ok).length}/${checks.length}`)
if (renders.some((row) => !row.ok) || checks.some((row) => !row.ok)) process.exitCode = 1
