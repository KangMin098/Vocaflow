// scripts/csat/map/v62/e2e-pm4b-acceptance.mjs
//
// 학습지도 v6.2 P-M4b — Codex 독립 검토(review/map-v62-pm4-ux-final · dbdfc7a81)의 P2 2건 · H01 · H05 를 실제 브라우저로 잰다.
//   P2-01 영역 이름: 1280 · 1440 기본 보기 · 전체 펼침에서 여섯 영역 이름이 잘리지 않는가(DOM scroll/client · 말줄임 계산값) · 개수/보류 · 선택 보존
//   P2-02 과거 기준 보기: 읽기 전용 띠 · 목표 편집/기록 추가 직접 동작 0 · 학습 시작 링크 0 · 계획 저장 버튼 0 · 「현재 기준으로」 링크 → 현재에서 목표 저장 성공
//          · 새로 고침 · 뒤로가기 뒤에도 같은 경계
//   H01 클릭 영역: 주요 조작의 실제 bounding rect(44px 기준)
//   H05 키보드(Tab · Enter · Space · focus 표시) · 전체 펼침 캔버스 가로 스크롤 · 기본 보기 복귀 · 새로 고침 · 뒤로가기 · 1024 · 390(지원 범위 밖 — 관찰만) · 계정 분리
// 합성 계정(끝에 삭제) — 학습 효과의 증거가 아니다. 계정 이메일 · 비밀번호 · id 는 남기지 않는다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-pm4b-acceptance.mjs --base http://localhost:3005 --evidence <dir>
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const BASE = arg('--base', 'http://localhost:3005')
const EVID = path.resolve(ROOT, arg('--evidence', 'tmp/v62-pm4b'))
const READY = 'M2409'
fs.mkdirSync(EVID, { recursive: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const must = async (q, label) => { const { data, error } = await q; if (error) throw new Error(`${label}: ${error.message}`); return data }
const startedAt = new Date().toISOString()
const results = []
const skips = []
const observations = []
const rec = (name, ok, detail) => { results.push({ name, ok, detail: detail ?? null }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 260)}` : ''}`) }
const obs = (name, detail) => { observations.push({ name, detail }); console.log(`[OBS] ${name} — ${JSON.stringify(detail).slice(0, 260)}`) }
const users = []
const browser = await chromium.launch()
let shots = 0
const shot = (page, name, full = false) => page.screenshot({ path: path.join(EVID, `${String(++shots).padStart(2, '0')}-${name}.png`), fullPage: full })

async function account(tag) {
  const email = `map-v62-pm4b-${tag}-${Date.now()}@example.com`
  const password = `Mb-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(u.user.id)
  return { email, password, id: u.user.id }
}
async function open(acc, width, height = 900) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(240_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', acc.email)
  await page.fill('input[type="password"]', acc.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
  return { ctx, page }
}
async function go(page, q = '') {
  await page.goto(`${BASE}/csat/diagnosis?tab=map${q}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="focus-strip"]', { timeout: 120_000 })
  await page.waitForTimeout(500)
}
async function seedRecord(page, userId) {
  const key = Object.fromEntries((await must(db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', READY), 'key')).map((k) => [k.no, k.answers[0]]))
  const W = new Set([20, 23, 29, 30, 32, 33, 35, 36, 37, 38, 39, 43, 44])
  const choices = Object.fromEntries(Object.keys(key).map((no) => [no, W.has(Number(no)) ? (key[no] % 5) + 1 : key[no]]))
  const r = await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, { data: { examId: READY, mode: 'live', takenAt: new Date().toISOString().slice(0, 10), totalMinutes: 70, clientKey: crypto.randomUUID(), choices, flags: {} } })
  if (r.status() !== 200) throw new Error(`기록 실패 ${r.status()}`)
  if ((await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 80 } })).status() !== 200) throw new Error('목표 실패')
  for (let i = 0; i < 60; i++) {
    if ((await must(db.from('csat_dx_snapshot').select('id').eq('user_id', userId).limit(1), 'snapshot')).length) break
    await new Promise((r2) => setTimeout(r2, 1000))
  }
}
/** 영역 머리 — 이름이 잘리는가(가로 넘침 · 말줄임 계산값) · 개수/보류 표시 · 선택 */
const domains = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="umap-domain"]')].map((b) => {
  const spans = [...b.querySelectorAll(':scope > span')]
  const name = spans[1]
  const cs = name ? getComputedStyle(name) : null
  return {
    code: spans[0]?.textContent ?? null,
    name: name?.textContent ?? null,
    clipped: name ? name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 1 : true,
    ellipsis: cs?.textOverflow === 'ellipsis' && cs?.whiteSpace === 'nowrap',
    lines: name ? Math.round(name.getBoundingClientRect().height / parseFloat(cs.lineHeight || '16')) : null,
    tag: spans[2]?.textContent ?? null,
    pressed: b.getAttribute('aria-pressed'),
    w: Math.round(b.getBoundingClientRect().width),
  }
}))
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
/** 실제 클릭 영역 — 보이는 것만 */
const rects = (page, sels) => page.evaluate((sels) => Object.fromEntries(sels.map((s) => {
  const els = [...document.querySelectorAll(s)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
  if (!els.length) return [s, null]
  const hs = els.map((e) => e.getBoundingClientRect())
  return [s, { n: els.length, minH: Math.round(Math.min(...hs.map((r) => r.height)) * 10) / 10, minW: Math.round(Math.min(...hs.map((r) => r.width)) * 10) / 10 }]
})), sels)

try {
  const a = await account('a')
  const b = await account('b')
  {
    const { ctx, page } = await open(a, 1440)
    await seedRecord(page, a.id)
    await ctx.close()
  }

  // ── P2-01 영역 이름 · 1280 / 1440 / 전체 펼침 ──
  for (const width of [1280, 1440]) {
    const { ctx, page } = await open(a, width)
    for (const [label, q] of [['core', ''], ['full', '&view=full']]) {
      await go(page, q)
      const d = await domains(page)
      const ox = await overflowX(page)
      const ok = d.length === 6 && d.every((x) => x.name && !x.clipped && !x.ellipsis && x.tag) && ox === 0
      rec(`P2-01 영역 이름 ${width} ${label} — 6영역 이름 잘림 0 · 개수/보류 표시 · 페이지 가로 넘침 0`, ok, { overflowX: ox, domains: d.map((x) => `${x.code}:${x.name}${x.clipped ? '(잘림)' : ''}·${x.tag}·${x.lines}줄·${x.w}px`) })
      await page.locator('[data-testid="umap-canvas"]').screenshot({ path: path.join(EVID, `${String(++shots).padStart(2, '0')}-P2-01-domains-${width}-${label}.png`) })
    }
    // 선택 보존 — 다른 영역 머리를 눌러도 이름은 그대로 · 눌린 영역 aria-pressed
    await go(page)
    await page.click('[data-testid="umap-domain"] >> nth=4')
    await page.waitForTimeout(300)
    const d2 = await domains(page)
    rec(`P2-01 ${width} 영역 머리 선택 — 눌린 영역 aria-pressed=true · 이름 잘림 0`, d2[4]?.pressed === 'true' && d2.every((x) => !x.clipped), { pressed: d2.map((x) => x.pressed) })
    await shot(page, `P2-01-page-${width}`)
    await ctx.close()
  }

  // ── P2-02 과거 기준 보기 ──
  {
    const { ctx, page } = await open(a, 1440)
    const asof = new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10)
    await go(page, `&asof=${asof}`)
    const past = () => page.evaluate(() => ({
      bar: document.querySelector('[data-testid="umap-past-bar"]')?.textContent ?? null,
      goalEdit: !!document.querySelector('[data-testid="map-goal-edit"]'),
      goalToCurrent: document.querySelector('[data-testid="map-goal-to-current"]')?.getAttribute('href') ?? null,
      recordAdd: !!document.querySelector('[data-testid="umap-record-add"]'),
      recordToCurrent: document.querySelector('[data-testid="umap-record-to-current"]')?.getAttribute('href') ?? null,
      focusNext: document.querySelectorAll('[data-testid="focus-next"]').length,
      insNext: !!document.querySelector('[data-testid="inspector-next"]'),
      recordsLabel: document.querySelector('[data-testid="umap-records"] h3')?.textContent ?? null,
      latestLabel: [...document.querySelectorAll('[data-testid="umap-top"] h3')].map((h) => h.textContent).find((t) => t?.startsWith('최근 시험')) ?? null,
    }))
    const p1 = await past()
    const pastOk = (p) => !!p.bar && p.bar.includes('읽기 전용') && !p.goalEdit && !p.recordAdd && !!p.goalToCurrent && !p.goalToCurrent.includes('asof') && !!p.recordToCurrent && p.focusNext === 0 && !p.insNext && (p.recordsLabel ?? '').includes(asof) && (p.latestLabel ?? '').includes('지금 전체 기록 기준')
    rec('P2-02 과거 보기 — 읽기 전용 띠 · 목표 편집/기록 추가 직접 동작 0 · 현재 기준 링크 · 학습 시작 0 · 기준일/전체 기록 범위 구분', pastOk(p1), p1)
    await shot(page, 'P2-02-past-1440')
    // 계획 열기 — 저장 · 조정 버튼 없음
    let planSave = null
    if (await page.$('[data-testid="inspector-plan-toggle"]')) {
      await page.click('[data-testid="inspector-plan-toggle"]')
      await page.waitForSelector('[data-testid="umap-plan"] [data-testid="plan-section"]', { timeout: 30_000 })
      planSave = await page.$$eval('[data-testid="plan-save"]', (els) => els.length)
    }
    rec('P2-02 과거 보기 학습계획 — 열리지만 저장 버튼 0(편집 차단 유지)', planSave === 0, { planSave })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="focus-strip"]')
    rec('P2-02 새로 고침 뒤에도 과거 보기 경계 그대로', pastOk(await past()), null)
    // 현재 기준으로 → 목표 저장
    await page.click('[data-testid="umap-past-to-current"]')
    await page.waitForURL((u) => !u.search.includes('asof'))
    await page.waitForSelector('[data-testid="map-goal-edit"]')
    await page.click('[data-testid="map-goal-edit"]')
    await page.fill('#map-goal-input', '88')
    const put = page.waitForResponse((r) => r.url().includes('/api/csat/diagnosis/map/goal') && r.request().method() === 'PUT', { timeout: 60_000 }).catch(() => null)
    await page.press('#map-goal-input', 'Enter')
    const res = await put
    await page.waitForTimeout(800)
    const gv = await page.textContent('[data-testid="goal-value"]')
    rec('P2-02 현재 기준 복귀 → 목표 편집 · 저장 성공(88점) · 기록 추가 링크 다시 보임', !!res && res.status() === 200 && (gv ?? '').includes('88') && !!(await page.$('[data-testid="umap-record-add"]')), { status: res?.status() ?? null, goal: gv })
    await shot(page, 'P2-02-current-goal-88-1440')
    // 뒤로가기 → 과거 보기 경계
    await page.goBack({ waitUntil: 'domcontentloaded' })
    // 지금 화면의 focus-strip 이 이미 있어 그것을 기다리면 이동 전 DOM 을 읽는다 — 과거 띠 자체를 기다린다(없으면 실패)
    await page.waitForSelector('[data-testid="umap-past-bar"]', { timeout: 60_000 }).catch(() => null)
    const pb = await past()
    rec('P2-02 뒤로가기로 과거 보기에 돌아오면 다시 읽기 전용', pastOk(pb) || (pb.bar !== null && !pb.goalEdit && !pb.recordAdd), { url: page.url().replace(BASE, ''), bar: !!pb.bar, goalEdit: pb.goalEdit })
    await ctx.close()
  }

  // ── H01 클릭 영역 · H05 키보드 · 전체 펼침 · 새로 고침 · 뒤로가기 ──
  {
    const { ctx, page } = await open(a, 1440)
    await go(page)
    await page.click('[data-testid="focus-blocked"] > summary')
    await page.click('[data-testid="inspector-detail"] > summary')
    const r = await rects(page, ['[data-testid="focus-blocked"] > summary', '[data-testid="focus-blocked"] li button', '[data-testid="focus-select"]', '[data-testid="focus-next"]', '[data-testid="focus-record"]', '[data-testid="umap-domain"]', '[data-testid="umap-node"]', '[data-testid="inspector-next"]', '[data-testid="inspector-detail"] > summary', '[data-testid="inspector-coverage"] > summary', '[data-testid="inspector-plan-toggle"]', '[data-testid="map-goal-edit"]', '[data-testid="umap-record-add"]', '[data-testid="map-full-link"]'])
    const asof = new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10)
    await go(page, `&asof=${asof}`)
    Object.assign(r, await rects(page, ['[data-testid="umap-past-to-current"]', '[data-testid="map-goal-to-current"]', '[data-testid="umap-record-to-current"]']))
    const small = Object.entries(r).filter(([, v]) => v && v.minH < 44)
    rec('H01 실제 클릭 영역 — 측정한 주요 조작 모두 높이 44px 이상', small.length === 0, { small, measured: r })
    // 키보드: TASK 노드 Enter · 우선 카드 Space · focus 표시
    await go(page)
    const s0 = await page.getAttribute('[data-testid="unified-map"]', 'data-selected')
    const target = await page.$$eval('[data-testid="umap-node"]', (els, s0) => els.map((e) => e.getAttribute('data-node')).find((id) => id !== s0 && !id.startsWith('l.') && !id.startsWith('x.')), s0)
    await page.focus(`[data-node="${target}"]`)
    await page.keyboard.press('Enter')
    await page.waitForSelector(`[data-testid="task-inspector"][data-task="${target}"]`)
    const cards = await page.$$eval('[data-testid="focus-card"]', (els) => els.map((e) => e.getAttribute('data-task')))
    await page.focus(`[data-testid="focus-card"][data-task="${cards[1]}"] [data-testid="focus-select"]`)
    await page.keyboard.press('Space')
    await page.waitForSelector(`[data-testid="task-inspector"][data-task="${cards[1]}"]`)
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    const ring = await page.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return { tag: e.tagName, testid: e.getAttribute('data-testid'), outline: cs.outlineStyle, outlineW: cs.outlineWidth, shadow: cs.boxShadow } })
    rec('H05 키보드 — 관계도 TASK Enter · 우선 카드 Space 로 Inspector 전환 · Tab 포커스 표시 보임', ring.outline !== 'none' && ring.outlineW !== '0px', { enterTo: target, spaceTo: cards[1], ring })
    await shot(page, 'H05-keyboard-focus-1440')
    // 전체 펼침 → 캔버스 가로 스크롤 → 기본 보기 → 뒤로가기 → 새로 고침
    await page.click('[data-testid="map-full-link"]')
    await page.waitForURL((u) => u.search.includes('view=full'))
    await page.waitForSelector('[data-testid="focus-strip"]')
    const sc = await page.evaluate(() => { const c = document.querySelector('[data-testid="umap-canvas"]'); c.scrollLeft = 400; return { scrollW: c.scrollWidth, clientW: c.clientWidth, left: c.scrollLeft, pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth } })
    rec('H05 전체 펼침 — 캔버스 안에서만 가로 스크롤 · 페이지 가로 넘침 0', sc.scrollW > sc.clientW && sc.left > 0 && sc.pageOverflow === 0, sc)
    await shot(page, 'H05-full-scrolled-1440')
    await page.click('[data-testid="map-core-link"]')
    await page.waitForURL((u) => !u.search.includes('view=full'))
    await page.goBack({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="focus-strip"]')
    const backFull = await page.getAttribute('[data-testid="csat-map-screen"]', 'data-view')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="focus-strip"]')
    const afterReload = await page.evaluate(() => ({ view: document.querySelector('[data-testid="csat-map-screen"]')?.getAttribute('data-view'), selected: document.querySelector('[data-testid="unified-map"]')?.getAttribute('data-selected'), first: document.querySelector('[data-testid="focus-card"]')?.getAttribute('data-task') }))
    rec('H05 기본 보기 → 뒤로가기 = 전체 펼침 · 새로 고침 뒤 같은 보기 · 선택 = 우선 1번(탭 기억은 문서 단위)', backFull === 'full' && afterReload.view === 'full' && afterReload.selected === afterReload.first, { backFull, afterReload })
    await ctx.close()
  }

  // ── H05 계정 분리 · 1024 · 390 ──
  {
    const { ctx, page } = await open(b, 1440)
    await go(page)
    const bs = await page.evaluate(() => ({ total: document.querySelector('[data-testid="umap-records"]')?.getAttribute('data-total'), focus: document.querySelector('[data-testid="focus-strip"]')?.getAttribute('data-state') }))
    rec('H05 계정 분리 — 다른 계정은 첫 계정의 기록 · 목표를 보지 않는다(기록 0 · 목표 없음)', bs.total === '0' && bs.focus === 'no_goal', bs)
    await ctx.close()
  }
  for (const [w, h] of [[1024, 768], [390, 844]]) {
    const { ctx, page } = await open(a, w, h)
    await go(page)
    const o = await page.evaluate(() => ({ pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, ins: Math.round(document.querySelector('[data-testid="task-inspector"]')?.getBoundingClientRect().width ?? 0), cards: document.querySelectorAll('[data-testid="focus-card"]').length }))
    obs(`${w}px — 지원 범위 밖(디자인 대상은 PC 1280 · 1440) · 관찰만`, o)
    await shot(page, `OBS-${w}`, true)
    await ctx.close()
  }
} catch (e) {
  rec('실행 오류', false, { error: String(e).slice(0, 300) })
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
}
let remaining = 0
for (const id of users) { const { data } = await db.auth.admin.getUserById(id); if (data?.user) remaining++ }
const failed = results.filter((r) => !r.ok).length
fs.writeFileSync(path.join(EVID, 'results.json'), JSON.stringify({
  suite: '학습지도 v6.2 P-M4b 수용(e2e-pm4b-acceptance.mjs) — Codex PM4-P2-01 · P2-02 · H01 · H05',
  head: execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  trackedFilesModified: execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean).length,
  base: BASE, startedAt, endedAt: new Date().toISOString(), browser: 'chromium(@playwright/test)', population: '합성 계정 2(끝에 삭제) — 학습 효과의 증거가 아니다',
  results, observations, skips, pass: results.length - failed, fail: failed, skip: skips.length, screenshots: shots,
  cleanup: { syntheticAccountsCreated: users.length, remainingAfterDelete: remaining },
}, null, 2) + String.fromCharCode(10))
console.log(failed ? `FAIL ${failed}` : 'ALL PASS')
process.exit(failed ? 1 : 0)
