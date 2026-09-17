// apps/web/scripts/csat-learner/gate3-home.mts
//
// **Gate 3 · 홈 · 세션 알고리즘 · 복습 큐 · 기록.** (docs/csat-learner-brief.md [E])
//
//   F1  앱 열기 → 첫 문항 표시까지 탭 ≤ 2 · 3G 스로틀 10초 이내(PDF 캐시 있을 때)
//   F2  학습자 라우트 3개 외 0개 — 파일 시스템과 라우트 레지스트리 둘 다
//   F7  [헷갈려요] → 3일 뒤 세션(단위 테스트 · 시간 모킹) — vitest 결과를 싣는다
//   F8  세션 자동 구성 규칙(단위 테스트) — 같은 파일
//   F9  PDF 없는 홈 = 「받기/놓기」 한 줄만 더해지고 나머지 같다
//   F10 접근성 — Lighthouse(모바일) 90+ · 키보드만으로 전 흐름 완주
//
//   npx tsx scripts/csat-learner/gate3-home.mts [--base http://localhost:3000] [--no-lighthouse]

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import { chromium, type BrowserContext, type Page } from '@playwright/test'

import { REPORTS, arg, flag, localPapers, writeJson } from './env.mts'

const BASE = arg('base') ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const STATE = 'playwright-auth/.auth-csat-learner.json'
const SHOTS = path.resolve('test-results-csat-learner')
fs.mkdirSync(SHOTS, { recursive: true })

type Check = { id: string; pass: boolean; detail: string }
const checks: Check[] = []
const check = (id: string, pass: boolean, detail: string) => {
  checks.push({ id, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${detail}`)
}
const extra: Record<string, unknown> = {}

// ── F2 · 라우트 ──────────────────────────────────────────────────────
{
  const root = path.resolve('src/app/(main)/csat')
  const pages: string[] = []
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name === 'page.tsx' || e.name === 'route.ts') pages.push('/csat' + path.relative(root, d).replace(/\\/g, '/').replace(/^(?=.)/, '/'))
    }
  }
  walk(root)
  const want = ['/csat', '/csat/progress', '/csat/session']
  const got = [...new Set(pages.map((p) => p.replace(/\/$/, '')))].sort()
  const reg = fs.readFileSync(path.resolve('src/lib/framework/learner-routes.ts'), 'utf8')
  const regPaths = [...reg.matchAll(/path:\s*'(\/csat[^']*)'/g)].map((m) => m[1]).sort()
  check(
    'F2',
    JSON.stringify(got) === JSON.stringify(want) && JSON.stringify(regPaths) === JSON.stringify(want),
    `파일 ${got.join(' ')} · 레지스트리 ${regPaths.join(' ')}`,
  )
}

// ── F7 · F8 · 단위 테스트 ─────────────────────────────────────────────
{
  // 표준 출력에는 dotenv 안내 등이 섞인다 — 결과는 파일로 받는다
  const out = path.join(os.tmpdir(), 'csat-session-vitest.json')
  spawnSync('npx', ['vitest', 'run', 'src/lib/csat/session', '--reporter=json', `--outputFile=${out}`], {
    encoding: 'utf8',
    shell: true,
    maxBuffer: 20 * 1024 * 1024,
  })
  const json = JSON.parse(fs.readFileSync(out, 'utf8'))
  const tests = (json.testResults as { assertionResults: { title: string; status: string; ancestorTitles: string[] }[] }[]).flatMap(
    (f) => f.assertionResults,
  )
  const group = (g: string) => tests.filter((t) => t.ancestorTitles.some((a) => a.startsWith(g)))
  for (const g of ['F7', 'F8']) {
    const ts = group(g)
    check(g, ts.length > 0 && ts.every((t) => t.status === 'passed'), `${ts.filter((t) => t.status === 'passed').length}/${ts.length} 통과`)
  }
}

// ── 브라우저 ─────────────────────────────────────────────────────────
const browser = await chromium.launch()
const mobile = { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

async function freshContext(): Promise<{ ctx: BrowserContext; page: Page; errors: string[] }> {
  const ctx = await browser.newContext({ storageState: STATE, ...mobile })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    // 「Failed to fetch RSC payload」 — 측정이 다음 주소로 `goto` 하는 순간 끊긴 **링크 프리페치**다
    // (Next 가 스스로 브라우저 이동으로 대체한다 · 실측 2026-09-17 프로덕션). 흐름의 오류가 아니다.
    if (m.type() === 'error' && !/favicon|DevTools|analytics|Failed to fetch RSC payload/i.test(m.text())) errors.push(m.text())
  })
  return { ctx, page, errors }
}

async function resetDevice(page: Page, onboarded: boolean) {
  // 서버 기록도 지운다 — 읽을 때 기기 기록과 합쳐지므로(온보딩 판정까지 바뀐다)
  await page.request.delete(`${BASE}/api/csat/session/record`)
  await page.goto(`${BASE}/csat/progress`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.evaluate(async (ob) => {
    await new Promise<void>((res) => {
      const r = indexedDB.deleteDatabase('vocaflow-csat')
      r.onsuccess = r.onerror = r.onblocked = () => res()
    })
    if (!ob) return
    await new Promise<void>((res) => {
      const r = indexedDB.open('vocaflow-csat', 1)
      r.onupgradeneeded = () => {
        r.result.createObjectStore('record')
        r.result.createObjectStore('papers')
      }
      r.onsuccess = () => {
        const tx = r.result.transaction('record', 'readwrite')
        tx.objectStore('record').put({ version: 1, attempts: [], reviews: [], onboarded: true }, 'me')
        tx.oncomplete = () => {
          r.result.close()
          res()
        }
      }
    })
  }, onboarded)
}

/** 홈 카드의 뼈 — testid 목록과 보이는 글자(받기/놓기 줄 제외) */
async function homeShape(page: Page) {
  return page.evaluate(() => {
    const card = document.querySelector('[data-testid="today-card"]')
    const ids = [...document.querySelectorAll('main [data-testid]')].map((e) => e.getAttribute('data-testid'))
    const need = document.querySelector('[data-testid="paper-need"]')?.closest('div.mt-4') ?? null
    const text = card ? [...card.childNodes].filter((n) => n !== need).map((n) => (n as HTMLElement).innerText ?? n.textContent).join('|') : ''
    return { ids, text, hasNeed: Boolean(need) }
  })
}

const papers = localPapers()
const paperOf = (exam: string) => {
  const a = JSON.parse(fs.readFileSync(path.resolve(`src/lib/csat/anchor-data/${exam}.json`), 'utf8'))
  return papers.get(a.sha256) ?? null
}

// ── 온보딩 → 한 번만 ──────────────────────────────────────────────────
{
  const { ctx, page } = await freshContext()
  await resetDevice(page, false)
  await page.goto(`${BASE}/csat`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.getByTestId('onboarding').waitFor({ timeout: 60_000 })
  await page.screenshot({ path: path.join(SHOTS, 'home-onboarding.png') })
  await page.getByTestId('start').click()
  await page.waitForURL(/\/csat\/session/, { timeout: 60_000 })
  await page.goto(`${BASE}/csat`, { waitUntil: 'domcontentloaded' })
  const again = await page.getByTestId('today-card').waitFor({ timeout: 60_000 }).then(() => page.getByTestId('onboarding').count())
  check('온보딩 한 번', again === 0, `두 번째 방문에 온보딩 ${again}개`)
  await ctx.close()
}

// ── F9 · PDF 없는 홈 vs 있는 홈 ─────────────────────────────────────────
let neededExams: string[] = []
{
  const { ctx, page } = await freshContext()
  await resetDevice(page, true)
  await page.goto(`${BASE}/csat`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.getByTestId('today-card').waitFor({ timeout: 60_000 })
  const without = await homeShape(page)
  await page.screenshot({ path: path.join(SHOTS, 'home-no-pdf.png') })
  // 이 세션이 필요한 회차 — 카드가 `data-need` 로 말한다. 하나씩 놓는다
  neededExams = ((await page.getByTestId('today-card').getAttribute('data-need')) ?? '').split(',').filter(Boolean)
  for (const exam of neededExams) {
    const file = paperOf(exam)
    if (!file) throw new Error(`${exam} 원본이 없다`)
    await page.getByTestId('paper-input').setInputFiles(file)
    await page.waitForFunction(
      (e) => !(document.querySelector('[data-testid="today-card"]')?.getAttribute('data-need') ?? '').split(',').includes(e),
      exam,
      { timeout: 90_000 },
    )
  }
  extra.needed = neededExams
  const withPdf = await homeShape(page)
  await page.screenshot({ path: path.join(SHOTS, 'home-with-pdf.png') })
  const sameIds = JSON.stringify(without.ids.filter((i) => i !== 'paper-need' && i !== 'paper-input')) ===
    JSON.stringify(withPdf.ids.filter((i) => i !== 'paper-need' && i !== 'paper-input'))
  check(
    'F9',
    without.hasNeed && !withPdf.hasNeed && sameIds && without.text === withPdf.text,
    `PDF 없음: 안내 ${without.hasNeed} · 있음: 안내 ${withPdf.hasNeed} · 나머지 요소 같음 ${sameIds} · 카드 글자 같음 ${without.text === withPdf.text}`,
  )
  extra.home = { without, withPdf }

  // ── F1 · 3G 에서 열기 → 첫 문항 ────────────────────────────────────
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false })
  // 공유 DB 가 바쁜 순간 한 번만 재면 1.3초와 11.1초가 둘 다 나왔다(실측) — 세 번 재서 중앙값으로 판정한다.
  // 매번 **새 탭**(문서 캐시 없음)에서 연다. 기록은 기기에 그대로 — 앞 회차의 풀이가 없으니 같은 세션이다.
  const runs: number[] = []
  let taps = 0
  for (let r = 0; r < 3; r += 1) {
    const tab = r === 0 ? page : await ctx.newPage()
    const cdpTab = r === 0 ? cdp : await ctx.newCDPSession(tab)
    if (r > 0) {
      await cdpTab.send('Network.enable')
      await cdpTab.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      })
    }
    taps = 0
    const t0 = Date.now()
    await tab.goto(`${BASE}/csat`, { waitUntil: 'commit', timeout: 120_000 })
    await tab.getByTestId('start').waitFor({ timeout: 60_000 })
    await tab.getByTestId('start').click()
    taps += 1
    await tab.waitForSelector('[data-testid="item-screen"][data-phase="solve"] [data-testid="passage"]', { timeout: 60_000 })
    runs.push(Date.now() - t0)
    if (r === 0) await tab.screenshot({ path: path.join(SHOTS, 'f1-first-item.png') })
    if (r > 0) await tab.close()
  }
  const ms = [...runs].sort((a, b) => a - b)[1]
  check(
    'F1',
    taps <= 2 && ms <= 10_000,
    `탭 ${taps} · 중앙값 ${(ms / 1000).toFixed(1)}초 (${runs.map((x) => (x / 1000).toFixed(1)).join(' / ')} · 3G 1.6Mbps/150ms · PDF 캐시 있음 · ${BASE})`,
  )
  extra.f1 = { taps, runs, median: ms, base: BASE }
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await ctx.close()
}

// ── F10-a · 키보드만으로 완주 ─────────────────────────────────────────
{
  const { ctx, page, errors } = await freshContext()
  // 캐시(추출본)는 앞 컨텍스트와 공유되지 않는다 — 기록만 새로, 문제지는 세션 안에서 놓는다
  await resetDevice(page, true)
  await page.goto(`${BASE}/csat/session?set=2026-38&k=order`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.getByTestId('paper-input').setInputFiles(paperOf('2026')!)
  await page.waitForSelector('[data-testid="item-screen"][data-phase="solve"]', { timeout: 90_000 })

  const tabTo = async (pred: string, max = 60) => {
    for (let i = 0; i < max; i += 1) {
      await page.keyboard.press('Tab')
      const ok = await page.evaluate((sel) => document.activeElement?.matches(sel) ?? false, pred)
      if (ok) return i + 1
    }
    return -1
  }
  const toChoice = await tabTo('[data-choice]')
  await page.keyboard.press('Enter')
  await page.waitForSelector('[data-testid="item-screen"][data-phase="understand"]', { timeout: 60_000 })
  const toSentence = await tabTo('[data-note-kind]')
  await page.keyboard.press('Enter')
  const noteOpen = await page.getByTestId('sentence-note').count()
  const toMark = await tabTo('[data-testid="mark-ok"]', 80)
  await page.keyboard.press('Enter')
  await page.getByTestId('finish').waitFor({ timeout: 30_000 })
  const toHome = await tabTo('[data-testid="home"]')
  check(
    'F10 키보드',
    toChoice > 0 && toSentence > 0 && noteOpen === 1 && toMark > 0 && toHome > 0 && errors.length === 0,
    `Tab 수 — 선지 ${toChoice} · 근거 문장 ${toSentence}(Enter → 설명 ${noteOpen}) · 알겠어요 ${toMark} · 홈으로 ${toHome} · 오류 ${errors.length}${errors.length ? ` · ${[...new Set(errors)].slice(0, 3).join(' | ').slice(0, 300)}` : ''}`,
  )

  // axe — 이해 단계(가장 복잡한 상태)를 포함해 세 화면
  await page.goto(`${BASE}/csat/session?set=2026-38&k=order`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="item-screen"][data-phase="solve"]', { timeout: 90_000 })
  await page.locator('[data-choice="1"]').click()
  await page.waitForSelector('[data-testid="item-screen"][data-phase="understand"]')
  await page.locator('[data-note-kind]').first().click()
  const axeSession = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  const axe: Record<string, string[]> = { 'session(이해)': axeSession.violations.map((v) => `${v.id}×${v.nodes.length}`) }
  for (const u of ['/csat', '/csat/progress']) {
    await page.goto(`${BASE}${u}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    axe[u] = r.violations.map((v) => `${v.id}×${v.nodes.length}`)
  }
  await page.screenshot({ path: path.join(SHOTS, 'progress.png') })
  const total = Object.values(axe).reduce((a, v) => a + v.length, 0)
  check('F10 axe', total === 0, Object.entries(axe).map(([k, v]) => `${k}: ${v.length ? v.join(',') : '0'}`).join(' · '))
  extra.axe = axe
  await ctx.close()
}

await browser.close()

// ── F10-b · Lighthouse 모바일 접근성 ─────────────────────────────────
if (!flag('no-lighthouse')) {
  const state = JSON.parse(fs.readFileSync(STATE, 'utf8')) as { cookies: { name: string; value: string }[] }
  const cookie = state.cookies.map((c) => `${c.name}=${c.value}`).join('; ')
  const headers = path.join(os.tmpdir(), 'csat-lh-headers.json')
  fs.writeFileSync(headers, JSON.stringify({ Cookie: cookie }))
  const scores: Record<string, number | null> = {}
  for (const u of ['/csat', '/csat/session?set=2026-38&k=order', '/csat/progress']) {
    const out = path.join(os.tmpdir(), `csat-lh-${u.replace(/\W+/g, '_')}.json`)
    fs.rmSync(out, { force: true })
    try {
      // ⚠️ Windows 에서 Lighthouse 는 **측정을 마친 뒤** 임시 폴더 정리(EPERM)에서 0 이 아닌 값으로
      //    끝난다(실측 2026-09-17). 종료 코드가 아니라 결과 파일로 판정한다.
      spawnSync(
        'npx',
        [
          '--yes',
          'lighthouse@13',
          // 셸을 거치므로 `&` 가 명령 구분자가 된다 — 주소를 따옴표로 감싼다
          `"${BASE}${u}"`,
          '--only-categories=accessibility',
          '--form-factor=mobile',
          '--output=json',
          `--output-path=${out}`,
          `--extra-headers=${headers}`,
          `--chrome-path=${chromium.executablePath()}`,
          '--chrome-flags=--headless=new --no-sandbox',
          '--quiet',
        ],
        { stdio: 'ignore', shell: true, timeout: 300_000 },
      )
      const lh = JSON.parse(fs.readFileSync(out, 'utf8'))
      const failed = lh.categories?.accessibility?.auditRefs
        ?.map((r: { id: string }) => lh.audits[r.id])
        .filter((a: { score: number | null; scoreDisplayMode: string }) => a.scoreDisplayMode === 'binary' && a.score === 0)
        .map((a: { id: string }) => a.id)
      ;(extra.lighthouseFailed ??= {} as Record<string, string[]>)
      ;(extra.lighthouseFailed as Record<string, string[]>)[u] = failed ?? []
      scores[u] = Math.round((lh.categories.accessibility.score ?? 0) * 100)
      const final = lh.finalDisplayedUrl ?? lh.finalUrl
      if (!String(final).includes('/csat')) scores[u] = null // 로그인으로 튕겼다
    } catch {
      scores[u] = null
    }
  }
  extra.lighthouse = scores
  const vals = Object.values(scores)
  check('F10 Lighthouse', vals.every((v) => v !== null && v >= 90), Object.entries(scores).map(([k, v]) => `${k.split('?')[0]} ${v ?? '측정 실패'}`).join(' · '))
}

const pass = checks.every((c) => c.pass)
writeJson(path.join(REPORTS, 'gate3-report.json'), {
  gate: 3,
  at: new Date().toISOString(),
  base: BASE,
  pass,
  checks,
  ...extra,
  shots: fs.readdirSync(SHOTS).filter((f) => /^(home|f1|progress)/.test(f)).map((f) => `apps/web/test-results-csat-learner/${f}`),
})
console.log(`\nGate 3 → ${pass ? 'PASS' : 'FAIL'} (${checks.filter((c) => c.pass).length}/${checks.length})`)
process.exit(pass ? 0 : 1)
