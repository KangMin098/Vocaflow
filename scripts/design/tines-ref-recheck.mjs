// scripts/design/tines-ref-recheck.mjs
//
// Tines 참조 재조사 — 하위 템플릿을 PC 1440/1280 으로 다시 열어 재고, 열린 상태(메가메뉴·검색·FAQ·쿠키)를 확인한다.
//
// 왜: `docs/design/refs/tines/*` 는 2026-09-21 수집이다. 과거 수집을 최신 근거로 옮기지 않으려면
//     같은 템플릿을 오늘 다시 열어 **무엇이 그대로이고 무엇이 바뀌었는지**를 숫자로 남겨야 한다.
//     열지 못한 상태는 「미확보」로 적는다 — 추정으로 채우지 않는다.
//
// 사용: node scripts/design/tines-ref-recheck.mjs [--out tmp/tines-ref/<날짜>] [--widths 1440,1280]
// 산출: <out>/*.png(커밋 금지 · 참조 원본) · <out>/_measure.json(측정값만 — 문서 요약의 원천)

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
const outDir = path.resolve(ROOT, arg('out', 'tmp/tines-ref/recheck'))
const widths = arg('widths', '1440,1280').split(',').map(Number)
const onlyIds = arg('only', '') ? new Set(arg('only', '').split(',')) : null

/** 학습자 화면 유형에 대응하는 참조 템플릿(learner-tines-plan S0b). */
const PAGES = [
  { id: 'home', url: 'https://www.tines.com/' },
  { id: 'product-3b', url: 'https://www.tines.com/3b/' },
  { id: 'library', url: 'https://www.tines.com/library/' },
  { id: 'university', url: 'https://www.tines.com/university/' },
  { id: 'customers', url: 'https://www.tines.com/customers/' },
  { id: 'case-study', url: 'https://www.tines.com/case-studies/omada-health/' },
  { id: 'solution', url: 'https://www.tines.com/solutions/security/' },
  { id: 'pricing', url: 'https://www.tines.com/pricing/' },
  { id: 'book-demo', url: 'https://www.tines.com/book-a-demo/' },
  { id: 'legal', url: 'https://www.tines.com/legal/' },
  { id: 'not-found', url: 'https://www.tines.com/this-page-does-not-exist-vocaflow-check/' },
]

/** 페이지 안에서 계산 스타일을 잰다 — 숫자만 돌려준다(본문·이미지는 가져오지 않는다). */
function measure() {
  const px = (v) => Math.round(parseFloat(v) * 10) / 10
  const pick = (el) => {
    if (!el) return null
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return {
      tag: el.tagName.toLowerCase(),
      x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height),
      fontFamily: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      fontSize: px(cs.fontSize), fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing, color: cs.color, background: cs.backgroundColor,
      radius: cs.borderRadius,
    }
  }
  const h1 = document.querySelector('h1')
  const header = document.querySelector('header')
  // 본문 컨테이너 폭: h1 의 가장 가까운 조상 중 폭이 뷰포트보다 좁은 첫 블록
  let container = h1?.parentElement ?? null
  while (container && container.getBoundingClientRect().width >= innerWidth - 2) container = container.parentElement
  if (!container) {
    container = h1
    while (container?.parentElement && container.parentElement.getBoundingClientRect().width < innerWidth - 2) container = container.parentElement
  }
  const buttons = [...document.querySelectorAll('a[class*="button" i], button')]
    .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 60 && r.height > 28 && r.top < innerHeight })
    .slice(0, 4).map(pick)
  const sections = [...document.querySelectorAll('main section, main > div > section, section')]
    .slice(0, 40).map((s) => {
      const cs = getComputedStyle(s)
      return { h: Math.round(s.getBoundingClientRect().height), bg: cs.backgroundColor }
    }).filter((s) => s.h > 80)
  return {
    title: document.title.slice(0, 80),
    docHeight: document.documentElement.scrollHeight,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    header: pick(header),
    h1: pick(h1),
    h2: pick(document.querySelector('h2')),
    body: pick(document.querySelector('main p') ?? document.querySelector('p')),
    container: container ? { w: Math.round(container.getBoundingClientRect().width), x: Math.round(container.getBoundingClientRect().x) } : null,
    buttons,
    sectionCount: sections.length,
    sectionBgs: [...new Set(sections.map((s) => s.bg))].slice(0, 12),
    details: document.querySelectorAll('details').length,
    tabs: document.querySelectorAll('[role="tab"]').length,
    dialogsInDom: document.querySelectorAll('[role="dialog"]').length,
  }
}

async function openStates(page, id) {
  const states = {}
  if (id === 'home') {
    states.headerItems = await page.evaluate(() =>
      [...document.querySelectorAll('header a, header button')]
        .map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30))
        .filter(Boolean).slice(0, 20))
    // 메가메뉴: 「Product」 항목에 호버(첫 메가메뉴)
    const nav = page.locator('header').getByRole('button', { name: /^Product/ }).or(page.locator('header').getByRole('link', { name: /^Product$/ })).first()
    try {
      await nav.hover({ timeout: 4000 })
      await page.waitForTimeout(400)
      // 호버로 안 열리면 누른다(메뉴가 클릭으로 여는 구현일 수 있다)
      if ((await nav.getAttribute('aria-expanded').catch(() => null)) === 'false') await nav.click({ timeout: 3000 })
      await page.waitForTimeout(700)
      states.megaMenu = await page.evaluate(() => {
        const cand = [...document.querySelectorAll('header *')].filter((e) => {
          const r = e.getBoundingClientRect()
          return r.width > 600 && r.height > 150 && r.top >= 40 && getComputedStyle(e).visibility !== 'hidden'
        }).sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]
        if (!cand) return 'not-observed'
        const r = cand.getBoundingClientRect()
        return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bg: getComputedStyle(cand).backgroundColor, radius: getComputedStyle(cand).borderRadius }
      })
      await page.screenshot({ path: path.join(outDir, `${id}-megamenu@${page.viewportSize().width}.png`) })
    } catch { states.megaMenu = 'not-observed' }
    await page.mouse.move(5, 600)
    // 검색: 접근 이름에 search 가 든 버튼
    try {
      const search = page.getByRole('button', { name: /open search/i }).or(page.getByRole('link', { name: /open search/i })).first()
      await search.click({ timeout: 4000 })
      await page.waitForTimeout(800)
      states.search = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]') ?? document.querySelector('input[type="search"]')?.closest('div')
        if (!d) return 'not-observed'
        const r = d.getBoundingClientRect()
        return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bg: getComputedStyle(d).backgroundColor, modal: d.getAttribute('aria-modal') }
      })
      await page.screenshot({ path: path.join(outDir, `${id}-search@${page.viewportSize().width}.png`) })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      states.searchEscCloses = await page.evaluate(() => !document.querySelector('[role="dialog"][aria-modal="true"]'))
    } catch { states.search = 'not-observed' }
  }
  // FAQ 펼침(details)
  const det = page.locator('details summary').first()
  if (await det.count()) {
    try {
      await det.scrollIntoViewIfNeeded({ timeout: 3000 })
      await det.click({ timeout: 3000 })
      await page.waitForTimeout(400)
      states.faqOpen = await page.evaluate(() => document.querySelectorAll('details[open]').length)
    } catch { states.faqOpen = 'not-observed' }
  }
  // 탭 전환
  const tabs = page.getByRole('tab')
  if ((await tabs.count()) > 1) {
    try {
      await tabs.nth(1).click({ timeout: 3000 })
      await page.waitForTimeout(400)
      states.tabSwitch = await tabs.nth(1).getAttribute('aria-selected')
    } catch { states.tabSwitch = 'not-observed' }
  }
  return states
}

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true })
  const results = []
  for (const w of widths) for (const p of PAGES.filter((x) => !onlyIds || onlyIds.has(x.id))) {
    // 페이지마다 브라우저를 새로 띄운다 — 긴 홈 전체 캡처 한 번에 브라우저가 죽으면
    // 같은 폭의 나머지가 모두 실패했다(2026-10-18 1차 실행 11/22).
    const browser = await chromium.launch()
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: 'en-US', reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    {
      const row = { id: p.id, url: p.url, width: w, at: new Date().toISOString() }
      try {
        const res = await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
        row.status = res?.status() ?? null
        await page.waitForTimeout(3500)
        row.finalUrl = page.url()
        // 쿠키 배너는 기록한 뒤 「거절」로 닫는다 — 열지 않으면 아래 상태 확인을 가린다.
        const reject = page.getByRole('button', { name: /reject|decline|deny/i }).first()
        row.cookieBanner = (await reject.isVisible().catch(() => false)) ? 'visible' : 'not-observed'
        if (row.cookieBanner === 'visible') { await reject.click().catch(() => {}); await page.waitForTimeout(500) }
        row.m = await page.evaluate(measure)
        await page.screenshot({ path: path.join(outDir, `${p.id}@${w}.png`) })
        // 전체 캡처는 높이를 12000px 로 자른다(브라우저가 죽지 않게)
        const h = Math.min(row.m.docHeight, 12000)
        await page.screenshot({ path: path.join(outDir, `${p.id}@${w}-full.png`), fullPage: true, clip: { x: 0, y: 0, width: w, height: h } }).catch((e) => { row.fullError = String(e).slice(0, 80) })
        row.states = await openStates(page, p.id)
        process.stdout.write(`✓ ${p.id} @${w} ${row.status}\n`)
      } catch (e) {
        row.error = String(e).slice(0, 160)
        process.stdout.write(`✗ ${p.id} @${w} — ${row.error.slice(0, 90)}\n`)
      }
      results.push(row)
    }
    await browser.close().catch(() => {})
  }
  // --only 로 일부만 다시 재면 기존 측정 파일에서 그 행만 바꾼다.
  const file = path.join(outDir, '_measure.json')
  const prev = onlyIds && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []
  const key = (r) => `${r.id}@${r.width}`
  const merged = [...prev.filter((r) => !results.some((n) => key(n) === key(r))), ...results]
  fs.writeFileSync(file, JSON.stringify(merged, null, 2))
  console.log(`\n${results.filter((r) => !r.error).length}/${results.length} → ${outDir}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
