// verification/ui/ui-verify-map.mjs — UI Quality Gate 첫 실증: 학습 지도(LearnerMap) · T-0019 학년별 권장 참고
//
// 실행(비밀값은 env-file 로만 — 출력하지 않는다):
//   node --env-file=D:/workspace/Vocaflow/apps/web/.env.local verification/ui/ui-verify-map.mjs --base http://localhost:3000 --out verification/ui/UG-0002-T0019
// 전제: dev 서버가 이미 떠 있다(띄우거나 죽이지 않는다 — 공유 워크스페이스). 요청만 보낸다.
// 결과: <out>/ui-evidence.json(type "ui" 형식 · docs/UI_QUALITY_GATE.md) + 스크린샷. 실행 못 한 검사는 skip(통과 아님).

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const args = process.argv.slice(2)
const arg = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d)
const BASE = arg('base', 'http://localhost:3000')
const OUT = path.resolve(arg('out', 'verification/ui/out'))
const ROUTE = arg('route', '/csat/diagnosis?tab=map')
const require_ = createRequire('D:/workspace/Vocaflow/apps/web/package.json')
const { chromium } = require_('@playwright/test')
const email = process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev'
const password = process.env.PLAYWRIGHT_RUNTIME_PASSWORD
if (!password) throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 없음 — --env-file 로 넘긴다')
fs.mkdirSync(OUT, { recursive: true })

const started_at = new Date().toISOString()
const notes = {}
const checks = {}
const defects = []
const shots = []
const shot = async (target, name, opts = {}) => {
  const f = path.join(OUT, name)
  await target.screenshot({ path: f, ...opts })
  shots.push(path.relative(path.resolve('.'), f).split(path.sep).join('/'))
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
const page = await ctx.newPage()
const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 200)))
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e.message).slice(0, 200)}`))

// 로그인(기존 capture-learner.mjs 와 같은 절차)
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)
await page.fill('input[type="email"]', email)
await page.fill('input[type="password"]', password)
await page.click('button[type="submit"]')
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 150_000 })

// ① 렌더
const resp = await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
let rendered = false
try {
  await page.getByTestId('learner-map').waitFor({ timeout: 180_000 })
  rendered = true
} catch {
  rendered = false
}
await page.waitForTimeout(1500)
const commit = arg('commit', null)
notes.http = resp?.status()
notes.console_errors = consoleErrors.slice(0, 10)
checks.render = rendered && resp?.status() === 200 ? 'pass' : 'fail'
if (checks.render === 'fail') defects.push({ kind: 'objective', claim: `학습 지도 렌더 실패(HTTP ${resp?.status()} · learner-map ${rendered})`, status: 'open' })
await shot(page, 'map-1440-full.png', { fullPage: true })

const guide = page.getByTestId('grade-guide')
const hasGuide = rendered && (await guide.count()) > 0
if (hasGuide) {
  await guide.scrollIntoViewIfNeeded()
  await shot(guide, 'grade-guide-1440.png')
}

// ② PC 레이아웃 — 1440·1920 에서 가로 넘침 없음 · 안내 블록이 화면 폭 안
const layout = {}
for (const w of [1440, 1920]) {
  await page.setViewportSize({ width: w, height: 900 })
  await page.waitForTimeout(400)
  layout[w] = await page.evaluate(() => {
    const g = document.querySelector('[data-testid="grade-guide"]')
    const r = g?.getBoundingClientRect()
    return { overflowX: document.documentElement.scrollWidth - window.innerWidth, guide: r ? { x: Math.round(r.x), w: Math.round(r.width), right: Math.round(r.right) } : null }
  })
}
await page.setViewportSize({ width: 1440, height: 900 })
// 안내 블록과 바로 위 형제(듣기 트랙) 사이 간격 — 눈으로 본 「제목이 듣기 줄에 붙어 보인다」를 수치로
layout.gap_above_guide = hasGuide
  ? await page.evaluate(() => {
      const g = document.querySelector('[data-testid="grade-guide"]')
      const h = g.querySelector('h3')?.getBoundingClientRect()
      let prev = g.previousElementSibling
      while (prev && prev.getBoundingClientRect().height === 0) prev = prev.previousElementSibling
      const pb = prev?.getBoundingClientRect()
      const kids = prev ? [...prev.querySelectorAll('*')].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0) : []
      const lowest = kids.length ? Math.max(...kids.map((r) => r.bottom)) : pb?.bottom
      return pb && h ? { prev: prev.getAttribute('data-testid') || prev.className, heading_top: Math.round(h.top), prev_bottom: Math.round(pb.bottom), prev_content_bottom: Math.round(lowest), gap: Math.round(h.top - lowest) } : null
    })
  : null
notes.layout = layout
if (layout.gap_above_guide && layout.gap_above_guide.gap < 8) defects.push({ kind: 'objective', claim: `「학년별 권장 참고」 제목이 바로 위 듣기 트랙 내용과 ${layout.gap_above_guide.gap}px 간격(8px 미만 — 겹치거나 붙어 듣기 줄의 일부처럼 보인다)`, status: 'open' })
const widths = [layout[1440], layout[1920]]
checks.layout_pc = hasGuide && widths.every((l) => l.overflowX <= 0 && (!l.guide || l.guide.right <= 1920)) && !(layout.gap_above_guide && layout.gap_above_guide.gap < 8) ? 'pass' : 'fail'
if (widths.some((l) => l.overflowX > 0)) defects.push({ kind: 'objective', claim: `PC 가로 넘침 ${JSON.stringify(layout)}`, status: 'open' })

// ③ 가독성·위계 · ⑦ 대비 — 안내 블록 글자 크기·대비(실제 계산색 · 배경은 조상까지 올라가 찾는다)
const typo = hasGuide
  ? await guide.evaluate((root) => {
      const lum = (c) => {
        const m = c.match(/\d+(\.\d+)?/g)?.map(Number)
        if (!m) return null
        const [r, g, b] = m.slice(0, 3).map((v) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const bgOf = (el) => {
        for (let e = el; e; e = e.parentElement) {
          const b = getComputedStyle(e).backgroundColor
          const a = b.match(/rgba?\(([^)]+)\)/)?.[1].split(',').map(Number)
          if (a && (a.length < 4 || a[3] > 0.5)) return b
        }
        return 'rgb(255,255,255)'
      }
      const out = []
      for (const el of root.querySelectorAll('*')) {
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
        if (!own) continue
        const cs = getComputedStyle(el)
        const l1 = lum(cs.color)
        const l2 = lum(bgOf(el))
        const ratio = l1 == null || l2 == null ? null : (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
        out.push({ tag: el.tagName, text: el.textContent.trim().slice(0, 40), size: parseFloat(cs.fontSize), weight: cs.fontWeight, family: cs.fontFamily.split(',')[0], ratio: ratio && Math.round(ratio * 100) / 100 })
      }
      const h = root.querySelector('h3')
      return { items: out, heading: h ? { size: parseFloat(getComputedStyle(h).fontSize), weight: getComputedStyle(h).fontWeight, text: h.textContent } : null }
    })
  : { items: [], heading: null }
notes.typography = typo
const minSize = Math.min(...typo.items.map((i) => i.size))
const minRatio = Math.min(...typo.items.map((i) => i.ratio).filter(Boolean))
const bodySize = typo.items.find((i) => i.tag === 'P')?.size
checks.readability_hierarchy = hasGuide && minSize >= 12 && typo.heading && (typo.heading.size > (bodySize ?? 0) || Number(typo.heading.weight) > 500) ? 'pass' : 'fail'
if (hasGuide && minSize < 12) defects.push({ kind: 'objective', claim: `학년별 안내 글자 ${minSize}px(12px 미만)`, status: 'open' })
if (hasGuide && typo.heading && !(typo.heading.size > (bodySize ?? 0) || Number(typo.heading.weight) > 500)) defects.push({ kind: 'objective', claim: `학년별 안내 제목(${typo.heading.size}px/${typo.heading.weight})이 본문(${bodySize}px)과 위계가 같다 — 제목과 설명이 같은 클래스(pathHint)`, status: 'open' })

// ④ 디자인 시스템 — 안내 블록 서체가 지도 본문과 같고, 인라인 style 로 색·크기를 덮지 않는다
const ds = hasGuide
  ? await page.evaluate(() => {
      const map = document.querySelector('[data-testid="learner-map"]')
      const g = document.querySelector('[data-testid="grade-guide"]')
      return { mapFont: getComputedStyle(map).fontFamily.split(',')[0], guideFont: getComputedStyle(g).fontFamily.split(',')[0], inlineStyled: [...g.querySelectorAll('[style]')].length, classes: [...new Set([...g.querySelectorAll('*')].map((e) => e.className).filter(Boolean))].slice(0, 12) }
    })
  : null
notes.design_system = ds
checks.design_system = ds && ds.mapFont === ds.guideFont && ds.inlineStyled === 0 ? 'pass' : 'fail'

// ⑤ 여정·상호작용 — 「지금 먼저 확인할 것」 행동 버튼 → 단계 시트(대화상자) 열림 → Esc 로 닫힘
let journey = 'fail'
try {
  // 학습 길의 첫 단계 카드(어휘·표현)를 누르면 단계 시트가 열린다 — 계정 상태와 무관한 공통 여정
  const cta = page.locator('[data-testid="learner-map"] button').filter({ hasText: '어휘·표현' }).first()
  await cta.scrollIntoViewIfNeeded()
  await cta.click({ timeout: 10_000 })
  const dlg = page.getByRole('dialog').first()
  await dlg.waitFor({ timeout: 10_000 })
  await shot(page, 'map-1440-stepsheet.png')
  await page.keyboard.press('Escape')
  await dlg.waitFor({ state: 'hidden', timeout: 5_000 })
  journey = 'pass'
} catch (e) {
  notes.journey_error = String(e.message).slice(0, 200)
}
checks.journey_interaction = journey

// ⑥ 로딩·빈·오류 상태 — 이 계정 하나로는 만들 수 없다(데이터 없는 계정·오류 주입 없음) → skip(통과 아님)
checks.states = 'skip'
notes.states = '실행 못 함: 빈 상태·오류 상태를 만들 계정·주입 수단이 이 실행에 없다'

// ⑦ 접근성 기본 — 안내가 접근성 트리에 · 대비 4.5 이상 · 키보드 포커스 표시
const aria = hasGuide ? await guide.ariaSnapshot() : ''
notes.aria_snapshot = aria.slice(0, 1200)
const ariaHas = ['학년별 권장 참고', '실제 경로는 진단 결과가 결정', '듣기는 별도 트랙'].map((t) => aria.includes(t))
const focusVisible = await page.evaluate(async () => {
  const seen = []
  for (let i = 0; i < 25; i++) {
    document.activeElement?.blur
    await new Promise((r) => setTimeout(r, 0))
  }
  return seen
})
void focusVisible
let focusOk = 0
let focusTotal = 0
await page.locator('body').click({ position: { x: 5, y: 5 } })
for (let i = 0; i < 20; i++) {
  await page.keyboard.press('Tab')
  const f = await page.evaluate(() => {
    const e = document.activeElement
    if (!e || e === document.body) return null
    const cs = getComputedStyle(e)
    return { tag: e.tagName, visible: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none') }
  })
  if (!f) continue
  focusTotal += 1
  if (f.visible) focusOk += 1
}
notes.accessibility = { aria_phrases: ariaHas, min_contrast: minRatio, focus_visible: `${focusOk}/${focusTotal}` }
checks.accessibility = ariaHas.every(Boolean) && minRatio >= 4.5 && focusTotal > 0 && focusOk === focusTotal ? 'pass' : 'fail'
if (minRatio < 4.5) defects.push({ kind: 'objective', claim: `학년별 안내 글자 대비 최저 ${minRatio}:1(4.5 미만)`, status: 'open' })
if (focusTotal && focusOk < focusTotal) defects.push({ kind: 'objective', claim: `키보드 포커스 표시 ${focusOk}/${focusTotal}`, status: 'open' })

// ⑧ 화면 간 이동 — 지도 안 링크가 실제로 열린다(같은 출처 · 최대 8개)
const hrefs = rendered ? await page.locator('[data-testid="learner-map"] a[href^="/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')))].slice(0, 8)) : []
const nav = []
for (const h of hrefs) {
  const r = await page.request.get(`${BASE}${h}`, { maxRedirects: 0, timeout: 120_000 }).catch((e) => ({ status: () => `err ${String(e.message).slice(0, 60)}` }))
  nav.push({ href: h, status: r.status() })
}
notes.navigation = nav
checks.navigation_progress = nav.length && nav.every((n) => typeof n.status === 'number' && n.status < 400) ? 'pass' : nav.length ? 'fail' : 'skip'
for (const n of nav.filter((x) => !(typeof x.status === 'number' && x.status < 400))) defects.push({ kind: 'objective', claim: `링크 ${n.href} → ${n.status}`, status: 'open' })

// ⑨ 시각 회귀 — 비교 기준(이전 캡처)이 없다 → 이번 캡처가 기준이 된다. skip(통과 아님)
checks.visual_regression = 'skip'
notes.visual_regression = '기준 캡처 없음 — 이번 스크린샷을 다음 비교의 기준으로 남긴다'

// ⑩ 설계 UI 수용 기준 — 설계 v8 은 UI Quality Gate 이전이라 ui_design·UI 수용 기준이 없다. 기능 기준 [3]·[4] 의 화면 부분만 확인
const cards = rendered ? await page.locator('[data-testid="learner-map"] [data-step], [data-testid="learner-map"] li').count() : 0
const bands = hasGuide ? await guide.locator('li, [data-band]').count() : 0
notes.design_acceptance = { v8_ac3_three_bands: bands, v8_ac3_aria: ariaHas, map_items: cards, ui_design: '설계 v8 에 ui_design 없음(게이트 이전) — 디자인 수용 기준 자체가 없다' }
checks.design_acceptance = 'skip'

await browser.close()
const observed_at = new Date().toISOString()
const allPass = Object.values(checks).every((v) => v === 'pass')
const evidence = {
  type: 'ui',
  command_or_protocol: `node --env-file=<web .env.local> verification/ui/ui-verify-map.mjs --base ${BASE} --out ${path.relative(path.resolve('.'), OUT).split(path.sep).join('/')}`,
  result: allPass && !defects.some((d) => d.kind === 'objective' && d.status === 'open') ? 'pass' : Object.values(checks).includes('fail') ? 'fail' : 'skip',
  skip_count: Object.values(checks).filter((v) => v === 'skip').length,
  artifact_path_or_url: `${path.relative(path.resolve('.'), OUT).split(path.sep).join('/')}/ui-evidence.json`,
  started_at,
  observed_at,
  commit,
  urls: [`${BASE}${ROUTE}`],
  viewport: { width: 1440, height: 900 },
  environment: `next dev(${BASE}) · worktree Vocaflow-map-feedback · chromium(playwright) · 계정 runtime-test`,
  screenshots: shots,
  checks,
  defects,
  ui_acceptance_results: [],
  notes,
}
fs.writeFileSync(path.join(OUT, 'ui-evidence.json'), JSON.stringify(evidence, null, 2))
console.log(JSON.stringify({ result: evidence.result, checks, defects, notes: { http: notes.http, console_errors: notes.console_errors.length, layout: notes.layout, accessibility: notes.accessibility, navigation: notes.navigation, design_system: notes.design_system, heading: typo.heading, minSize, journey_error: notes.journey_error } }, null, 2))
