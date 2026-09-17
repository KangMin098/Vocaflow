// apps/web/scripts/csat-lecture/gate2-play.mts
//
// **Gate 2 · 파일럿 재생 — 실제 화면에서 처음부터 끝까지.**
//
// 진짜 Chrome·Edge 를 띄워(목소리가 보이는 유일한 길 — real-browser.mts) 해설 화면에서 강의를
// 틀고, 끝날 때까지 기다린 뒤 무대가 남긴 기록(`?lecture-debug=1` → window.__LECTURE__)을 잰다.
//
//   · 타깃 일치 — 큐가 시작될 때 active 로 칠해진 DOM 블록의 키 = 그 큐의 타깃 키
//   · 완주      — 모든 큐가 completed 로 끝났고 무대가 ended 에 닿았다
//   · 쉼 준수   — 붙든 시간 = pause_after_ms − 앞당김(±150ms), 마지막 큐는 pause 그대로
//   · 발화 오류 — 한/영 전환을 포함한 모든 발화에서 0
//   · 순서      — cue-start 가 0,1,2,… 로 한 번씩
// 그리고 첫 문항에서 intro · evidence · eliminate 시점의 스크린샷 3장.
//
// 무음 실행(--audible 없으면 음소거) — 판정은 전부 기계가 한다(지시문 「사람 귀 대신 자동 검사」).
//
//   npx tsx scripts/csat-lecture/gate2-play.mts

import fs from 'node:fs'
import path from 'node:path'

import type { Page } from '@playwright/test'

import { REPORTS, writeJson } from './env.mts'
import { launchReal, type BrowserName } from './real-browser.mts'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
/**
 * 브라우저마다 **따로 구운 세션**을 쓴다. 한 세션을 둘이 나눠 쓰면 한쪽의 토큰 갱신이 다른 쪽을
 * 로그인 화면으로 보낸다(리프레시 토큰은 한 번 쓰면 회전된다).
 *   npx tsx scripts/e2e-session.mts .auth-csat-lecture-chrome.json
 *   npx tsx scripts/e2e-session.mts .auth-csat-lecture-edge.json
 */
const STATE: Record<BrowserName, string> = {
  chrome: 'playwright-auth/.auth-csat-lecture-chrome.json',
  edge: 'playwright-auth/.auth-csat-lecture-edge.json',
}
const SHOTS = path.join(REPORTS, 'shots')
const muted = !process.argv.includes('--audible')
const PILOT = ['M2706#31', 'M2706#32', 'M2706#34', 'M2706#36', 'M2706#37', '2026#36']
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null
/** `--only <문항>` — 한 편만 Chrome 에서(연기 검사). 리포트는 쓰지 않는다 */
const PLAN: Record<BrowserName, string[]> = ONLY ? { chrome: [ONLY], edge: [] } : { chrome: PILOT.slice(0, 3), edge: PILOT.slice(3) }

type Log = { t: number; type: string; cue?: string; index?: number; holdMs?: number; outcome?: { completed: boolean; errors: string[]; recovered?: string[] } }
type Probe = {
  mode: string
  ended: boolean
  checks: { i: number; cue: string; want: string; got: string | null }[]
  log: Log[]
  cues: { id: string; role: string; pause: number }[]
  lead: number
  status: string
  index: number
}

async function read(page: Page): Promise<Probe | null> {
  return page.evaluate(() => {
    const d = (window as unknown as { __LECTURE__?: any }).__LECTURE__
    if (!d?.player) return null
    const p = d.player
    return {
      mode: d.mode,
      ended: d.ended,
      checks: d.checks,
      log: p.log,
      cues: p.cues.map((c: any) => ({ id: c.id, role: c.role, pause: c.pause_after_ms })),
      lead: p.adapter?.leadMs ?? 0,
      status: p.getState().status,
      index: p.getState().index,
    }
  })
}

async function playOne(name: BrowserName, page: Page, itemId: string, shoot: boolean) {
  const slug = itemId.replace('#', '-')
  await page.goto(`${BASE}/csat/item/${slug}?lecture-debug=1`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  const bar = page.locator('[data-lecture-bar]')
  await bar.waitFor({ timeout: 60_000 })
  // 목소리 판정이 끝날 때까지 — 버튼 문구가 바뀐다
  await page.waitForTimeout(3000)
  const play = bar.getByRole('button', { name: /강의 듣기|하이라이트만 보기/ })
  await play.click({ timeout: 30_000 })

  const shots = new Set<string>()
  const started = Date.now()
  let last: Probe | null = null
  for (;;) {
    last = await read(page)
    if (shoot && last && last.status === 'playing') {
      const role = last.cues[last.index]?.role
      if (role && ['intro', 'evidence', 'eliminate'].includes(role) && !shots.has(role)) {
        shots.add(role)
        await page.waitForTimeout(600) // 스크롤 1회가 끝나게
        fs.mkdirSync(SHOTS, { recursive: true })
        await page.screenshot({ path: path.join(SHOTS, `gate2-${slug}-${role}.png`) })
      }
    }
    if (last?.ended) break
    if (Date.now() - started > 9 * 60_000) break
    await page.waitForTimeout(250)
  }
  if (!last) return { item: itemId, browser: name, pass: false, reasons: ['무대 기록이 없다'] }

  const n = last.cues.length
  const starts = last.log.filter((e) => e.type === 'cue-start').map((e) => e.index)
  const ends = last.log.filter((e) => e.type === 'cue-end')
  const holds = last.log.filter((e) => e.type === 'hold-end')
  const mismatches = last.checks.filter((c) => c.got !== c.want)
  const completed = ends.filter((e) => e.outcome?.completed).length
  const errors = ends.flatMap((e) => e.outcome?.errors ?? [])
  // 막혔다가 다시 읽어 살린 발화 — 오류는 아니지만 리포트에 드러낸다
  const recovered = ends.flatMap((e) => (e.outcome?.recovered ?? []).map((x) => `${e.cue}:${x}`))
  const orderOk = starts.length === n && starts.every((x, i) => x === i)
  const pauseDev: number[] = []
  for (let i = 0; i < n; i += 1) {
    const e = ends.find((x) => x.index === i)
    const h = holds.find((x) => x.index === i)
    if (!e || !h) continue
    // 엔진이 **그때** 정한 붙들기 시간과 견준다. 처음에는 마지막 앞당김 값으로 쟀다가 Edge 에서
    // 전부 틀렸다 — 앞당김(이동평균)이 강의 중 280 → 170ms 로 내려가 앞쪽 큐가 −100ms 로 보였다.
    const want = e.holdMs ?? last.cues[i].pause
    pauseDev.push(Math.round(h.t - e.t - want))
  }
  const pauseOk = pauseDev.length === n && pauseDev.every((d) => d >= -20 && d <= 150)
  const reasons = [
    ...(mismatches.length ? [`타깃 불일치 ${mismatches.length}`] : []),
    ...(completed !== n ? [`완주 ${completed}/${n}`] : []),
    ...(!last.ended ? ['끝나지 않음'] : []),
    ...(errors.length ? [`발화 오류 ${errors.length}`] : []),
    ...(!orderOk ? ['큐 순서가 어긋남'] : []),
    ...(!pauseOk ? ['쉼 어긋남'] : []),
  ]
  return {
    item: itemId,
    browser: name,
    mode: last.mode,
    pass: reasons.length === 0,
    reasons,
    cues: n,
    checks: last.checks.length,
    mismatches,
    completed,
    utteranceErrors: errors,
    recoveredUtterances: recovered,
    orderOk,
    pauseDeviationMs: pauseDev,
    leadMs: last.lead,
    wallSec: Math.round((Date.now() - started) / 1000),
  }
}


async function runBrowser(name: BrowserName) {
  const { browser, close } = await launchReal(name, { muted })
  const out: Awaited<ReturnType<typeof playOne>>[] = []
  try {
    const ctx = browser.contexts()[0]
    await ctx.addCookies(JSON.parse(fs.readFileSync(STATE[name], 'utf8')).cookies)
    const page = ctx.pages()[0] ?? (await ctx.newPage())
    for (const [i, id] of PLAN[name].entries()) {
      try {
        const r = await playOne(name, page, id, name === 'chrome' && i === 0)
        out.push(r)
        console.log(name, id, r.pass ? 'PASS' : 'FAIL', JSON.stringify(r.reasons))
      } catch (e) {
        out.push({ item: id, browser: name, pass: false, reasons: [String(e).slice(0, 200)] })
        console.log(name, id, 'ERROR', String(e).slice(0, 200))
      }
    }
  } finally {
    await close()
  }
  return out
}

const results = (await Promise.all((['chrome', 'edge'] as BrowserName[]).filter((b) => PLAN[b].length).map(runBrowser))).flat()
if (ONLY) {
  console.log(JSON.stringify(results, null, 2))
  process.exit(results.every((r) => r.pass) ? 0 : 1)
}
const pass = results.length === PILOT.length && results.every((r) => r.pass)
writeJson(path.join(REPORTS, 'gate2-report.json'), {
  gate: 2,
  measuredAt: new Date().toISOString(),
  muted,
  criteria: '타깃 불일치 0 · 완주 6/6 · 한/영 전환 포함 발화 오류 0 · 큐 순서 · 쉼 준수(−20~+150ms)',
  pass,
  completed: `${results.filter((r) => r.pass).length}/${PILOT.length}`,
  screenshots: fs.existsSync(SHOTS) ? fs.readdirSync(SHOTS).filter((f) => f.startsWith('gate2-')) : [],
  items: results,
})
console.log(`Gate 2 ${pass ? 'PASS' : 'FAIL'}`)
process.exit(pass ? 0 : 1)
