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

/**
 * 화면 위쪽(top < maxTop)의 단추를 눌러 **새로 나타난 패널**을 잰다.
 * 처음엔 「header 안 넓은 요소」를 찾았는데 패널이 header 밖에 그려져 두 번 「미확보」였다(2026-10-18).
 * 그래서 누르기 전후의 보이는 면(배경 또는 테두리가 있는 요소)을 비교해 새로 생긴 것만 고른다.
 */
async function clickAndMeasure(page, name, maxTop, shot) {
  const visibleSurfaces = () => [...document.querySelectorAll('body *')].filter((e) => {
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e)
    return r.width > 120 && r.height > 60 && r.bottom > 0 && r.top < innerHeight && cs.visibility !== 'hidden' && cs.opacity !== '0'
      && (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px')
  }).map((e) => { e.dataset.vfSeen = e.dataset.vfSeen ?? '1'; return e }).length
  await page.evaluate(visibleSurfaces)
  const target = await page.evaluate(({ name, maxTop }) => {
    const el = [...document.querySelectorAll('a,button')].find((e) =>
      (e.textContent.trim() === name || e.getAttribute('aria-label') === name) && e.getBoundingClientRect().top < maxTop && e.getBoundingClientRect().width > 0)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, expanded: el.getAttribute('aria-expanded'), popup: el.getAttribute('aria-haspopup') }
  }, { name, maxTop })
  if (!target) return 'not-observed: 단추 없음'
  await page.mouse.click(target.x, target.y)
  await page.waitForTimeout(900)
  const panels = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => {
    if (e.dataset.vfSeen) return false
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e)
    return r.width > 120 && r.height > 60 && r.bottom > 0 && r.top < innerHeight && cs.visibility !== 'hidden' && cs.opacity !== '0'
      && (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px')
  }).sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)
    .slice(0, 3).map((e) => {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e)
      return { role: e.getAttribute('role'), modal: e.getAttribute('aria-modal'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        bg: cs.backgroundColor, radius: cs.borderRadius, border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`, shadow: cs.boxShadow.slice(0, 100), padding: cs.padding }
    }))
  await page.screenshot({ path: path.join(outDir, `${shot}@${page.viewportSize().width}.png`) })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const escCloses = await page.evaluate(() => ![...document.querySelectorAll('body *')].some((e) => !e.dataset.vfSeen && e.getBoundingClientRect().width > 120 && e.getBoundingClientRect().height > 60 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).opacity !== '0' && getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)'))
  await page.evaluate(() => document.querySelectorAll('[data-vf-seen]').forEach((e) => delete e.dataset.vfSeen))
  return { trigger: target, panels, escCloses }
}

async function openStates(page, id) {
  const states = {}
  if (id === 'home') {
    states.headerItems = await page.evaluate(() =>
      [...document.querySelectorAll('header a, header button')]
        .map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30))
        .filter(Boolean).slice(0, 20))
    states.megaMenu = await clickAndMeasure(page, 'Product', 80, `${id}-megamenu`)
    states.search = await clickAndMeasure(page, 'Open search', 80, `${id}-search`)
  }
  // 앵커형 드롭다운(우리 팝오버에 가장 가까운 역할) — Library 의 하위 내비 「Overview ▾」
  if (id === 'library') states.subnavDropdown = await clickAndMeasure(page, 'Overview', 130, `${id}-dropdown`)
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
