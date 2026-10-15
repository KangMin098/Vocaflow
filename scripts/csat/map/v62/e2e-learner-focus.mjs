// scripts/csat/map/v62/e2e-learner-focus.mjs
//
// 학습지도 v6.2 P-M4 — 학습자 경험(목표 → 우선 TASK → 학습 경로 → 자료 → 다음 행동) 브라우저 시나리오 · 화면 증거.
//   A 목표 없음 · 기록 없음            → 「지금 무엇부터」 no_goal · 우선 카드 0 · 지도 · Inspector 는 열림
//   A2 목표만 있고 기록 없음(근거 부족)  → no_record · 「약점으로 정한 것은 없어요」 · 기록하기 CTA
//   B 목표 + 기록 → 우선 TASK           → ready · 카드 1~3 = ActionRank 순서 · 첫 카드 = Inspector 선택 · 다음 행동 링크에 복귀 문맥(map_task · from=map)
//                                          카드 2 를 누르면 Inspector 가 그 TASK 로 · Inspector 기본 화면에 학습 경로 · 자료가 근거 상세보다 먼저 · 근거 상세는 접힘
//   C 적격 R5 → 다음 행동 링크로 문항을 열고 같은 TASK 로 복귀(문항 화면의 「지도로」 링크 = map_task 유지)
//   D V2 · S5 → 수요 줄은 보이고(숨기지 않음) 「지금 학습할 수 있어요」 가 아니다(독해 문항으로 대체 안 함)
//   E 테스트 교재 → 어떤 TASK 의 지도 연습 줄도 공장 재고를 「지금 학습」 으로 올리지 않는다
//   F 과거 기준 보기(asof) · 목표 변경 → 과거 보기는 다음 행동 링크 0 · 목표를 바꿔도 기록 수 불변
//   G 저장된 PLAN 없음 → 오류 없이 「묶음 미저장」 기록 상태 · 계획 열기 동작
//   모든 상태에서 1280 · 1440 페이지 가로 넘침 0 · 화면 저장
// 합성 계정(끝에 삭제) — 학습 효과의 증거가 아니다. 계정 이메일 · 비밀번호 · id 는 남기지 않는다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-learner-focus.mjs --base http://localhost:3005 --evidence <dir>
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
const EVID = path.resolve(ROOT, arg('--evidence', 'tmp/v62-learner-focus'))
const READY = 'M2409'
fs.mkdirSync(EVID, { recursive: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const must = async (q, label) => { const { data, error } = await q; if (error) throw new Error(`${label}: ${error.message}`); return data }
const startedAt = new Date().toISOString()
const results = []
const rec = (name, ok, detail) => { results.push({ name, ok, detail: detail ?? null }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 300)}` : ''}`) }
const skips = []
const skip = (name, detail) => { skips.push({ name, detail }); console.log(`[SKIP] ${name}`) }
const users = []
const browser = await chromium.launch()
let shots = 0

async function account(tag) {
  const email = `map-v62-focus-${tag}-${Date.now()}@example.com`
  const password = `Mf-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(u.user.id)
  return { email, password, id: u.user.id }
}
async function open(acc, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(240_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', acc.email)
  await page.fill('input[type="password"]', acc.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
  return { ctx, page }
}
async function map(page, q = '') {
  await page.goto(`${BASE}/csat/diagnosis?tab=map${q}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="focus-strip"]', { timeout: 120_000 })
  await page.waitForTimeout(400)
}
const state = (page) => page.evaluate(() => {
  const strip = document.querySelector('[data-testid="focus-strip"]')
  const ins = document.querySelector('[data-testid="task-inspector"]')
  // Inspector 본문의 **직계** 구획만(근거 상세 안의 연구 details 는 빼고) — data-testid 가 있으면 그것, 없으면 aria-labelledby
  const body = ins?.querySelector('[aria-labelledby="ins-now"]')?.parentElement
  const order = body ? [...body.children].filter((e) => e.matches('section, details')).map((e) => e.getAttribute('data-testid') ?? e.getAttribute('aria-labelledby')) : []
  return {
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    focus: strip?.getAttribute('data-state') ?? null,
    head: strip?.querySelector('h2')?.textContent ?? null,
    cards: [...document.querySelectorAll('[data-testid="focus-card"]')].map((c) => c.getAttribute('data-task')),
    whys: [...document.querySelectorAll('[data-testid="focus-card"] dd:first-of-type')].map((d) => d.textContent),
    nexts: [...document.querySelectorAll('[data-testid="focus-next"]')].map((a) => a.getAttribute('href')),
    record: !!document.querySelector('[data-testid="focus-record"]'),
    blocked: document.querySelector('[data-testid="focus-blocked"] summary')?.textContent ?? null,
    selected: document.querySelector('[data-testid="unified-map"]')?.getAttribute('data-selected') ?? null,
    insNext: document.querySelector('[data-testid="inspector-next"]')?.getAttribute('href') ?? null,
    insOrder: order,
    detailOpen: document.querySelector('[data-testid="inspector-detail"]')?.hasAttribute('open') ?? null,
    supply: [...document.querySelectorAll('[data-testid="inspector-supply"] li')].map((e) => ({ role: e.getAttribute('data-role'), state: e.getAttribute('data-state'), step: e.getAttribute('data-step') })),
    ledger: document.querySelector('[data-testid="inspector-ledger-note"]')?.getAttribute('data-ledger') ?? null,
    records: document.querySelector('[data-testid="umap-records"]')?.textContent?.replace(/\s+/g, ' ').slice(0, 60) ?? null,
  }
})
async function shot(page, name) {
  await page.screenshot({ path: path.join(EVID, `${String(++shots).padStart(2, '0')}-${name}.png`) })
}
const sel = async (page, task) => {
  await page.click(`[data-node="${task}"]`)
  await page.waitForSelector(`[data-testid="task-inspector"][data-task="${task}"]`)
  await page.waitForTimeout(300)
}

try {
  // ── A · A2 ──
  const a = await account('a')
  for (const width of [1280, 1440]) {
    const { ctx, page } = await open(a, width)
    await map(page)
    const s = await state(page)
    rec(`A 목표 없음 · 기록 없음(${width}) — no_goal · 우선 카드 0 · 지도 · Inspector 열림 · 가로 넘침 0`, s.focus === 'no_goal' && s.cards.length === 0 && !!s.selected && s.overflowX === 0, s)
    await shot(page, `A-no-goal-${width}`)
    if (width === 1440) {
      if ((await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 80 } })).status() !== 200) throw new Error('목표 실패')
      await map(page)
      const s2 = await state(page)
      // 기록이 없어도 목표 관련 확인 순서(ActionRank)는 있다 — 카드는 「근거를 만드는 확인」이고 모두 「확정 아님」이어야 한다
    rec('A2 목표만 · 기록 없음 — no_record · 약점 확정 아님 · 기록하기 CTA · 카드는 확인 행동이고 모두 확정 아님', s2.focus === 'no_record' && s2.record && s2.cards.length <= 3 && s2.whys.every((w) => w.includes('확정 아님')) && s2.overflowX === 0, { focus: s2.focus, record: s2.record, cards: s2.cards, whys: s2.whys })
      await shot(page, 'A2-goal-no-record-1440')
    }
    await ctx.close()
  }

  // ── B · C · D · E · F · G ──
  const b = await account('b')
  for (const width of [1440, 1280]) {
    const { ctx, page } = await open(b, width)
    if (width === 1440) {
      const key = Object.fromEntries((await must(db.from('csat_dx_answer_key').select('no, answers').eq('exam_id', READY), 'key')).map((k) => [k.no, k.answers[0]]))
      const W = new Set([20, 23, 29, 30, 32, 33, 35, 36, 37, 38, 39, 43, 44])
      const choices = Object.fromEntries(Object.keys(key).map((no) => [no, W.has(Number(no)) ? (key[no] % 5) + 1 : key[no]]))
      const r = await page.request.post(`${BASE}/api/csat/diagnosis/sessions`, { data: { examId: READY, mode: 'live', takenAt: new Date().toISOString().slice(0, 10), totalMinutes: 70, clientKey: crypto.randomUUID(), choices, flags: {} } })
      if (r.status() !== 200) throw new Error(`기록 실패 ${r.status()}`)
      if ((await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 80 } })).status() !== 200) throw new Error('목표 실패')
      for (let i = 0; i < 60; i++) {
        if ((await must(db.from('csat_dx_snapshot').select('id').eq('user_id', b.id).limit(1), 'snapshot')).length) break
        await new Promise((r2) => setTimeout(r2, 1000))
      }
    }
    await map(page)
    const s = await state(page)
    const ret = (h) => !!h && h.includes('from=map') && h.includes('map_task=')
    rec(`B 목표 + 기록(${width}) — ready · 카드 1~3 · 첫 카드 = Inspector 선택 · 다음 행동마다 복귀 문맥 · 가로 넘침 0`, s.focus === 'ready' && s.cards.length >= 1 && s.cards.length <= 3 && s.cards[0] === s.selected && s.nexts.length === s.cards.length && s.nexts.every(ret) && s.overflowX === 0, { cards: s.cards, selected: s.selected, nexts: s.nexts.length, overflowX: s.overflowX })
    await shot(page, `B-ready-${width}`)
    if (width === 1280) { await ctx.close(); continue }

    rec('B Inspector 기본 화면 순서 — 현재와 목표 → 학습 경로 · 자료 → 근거 상세(접힘) → 지원 상태', JSON.stringify(s.insOrder) === JSON.stringify(['ins-now', 'ins-plan', 'inspector-detail', 'inspector-coverage']) && s.detailOpen === false, { order: s.insOrder, detailOpen: s.detailOpen })
    // 카드 2 → Inspector 갱신
    if (s.cards[1]) {
      await page.click(`[data-testid="focus-card"][data-task="${s.cards[1]}"] [data-testid="focus-select"]`)
      await page.waitForSelector(`[data-testid="task-inspector"][data-task="${s.cards[1]}"]`)
      const s2 = await state(page)
      rec('B 우선 카드 2 를 누르면 Inspector 가 그 TASK 로 · 카드 선택 표시', s2.selected === s.cards[1], { selected: s2.selected })
      await shot(page, 'B-card2-selected-1440')
    }
    // G 저장 PLAN 없음 — 기록 상태 no_workspace · 계획 열기
    await sel(page, s.cards[0])
    const g = await state(page)
    let planOk = false
    if (await page.$('[data-testid="inspector-plan-toggle"]')) {
      await page.click('[data-testid="inspector-plan-toggle"]')
      planOk = !!(await page.waitForSelector('[data-testid="umap-plan"] [data-testid="plan-section"]', { timeout: 30_000 }).catch(() => null))
    }
    rec('G 저장 PLAN 없음 — 오류 없이 「묶음 미저장」 기록 상태 · 학습계획 열림', g.ledger === 'no_workspace' && planOk, { ledger: g.ledger, planOk })
    await shot(page, 'G-plan-open-1440')

    // C R5 → 문항 → 같은 TASK 복귀
    await map(page)
    const c0 = await state(page)
    const first = c0.cards[0]
    const href = c0.nexts[0]
    await page.click(`[data-testid="focus-card"][data-task="${first}"] [data-testid="focus-next"]`)
    await page.waitForURL((u) => u.pathname.startsWith('/csat/item/'), { timeout: 120_000 })
    await page.waitForSelector('[data-testid="item-check-mode"]')
    await shot(page, 'C-item-opened-1440')
    // 확인 모드 → 「해설 보기」 뒤 지도 복귀 링크(e2e-map-return 과 같은 경로)
    await page.click('[data-testid="item-check-explain"]')
    await page.waitForSelector('[data-testid="item-back-map"]')
    const back = await page.getAttribute('[data-testid="item-back-map"]', 'href')
    if (back) { await page.goto(`${BASE}${back}`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('[data-testid="focus-strip"]') }
    const c1 = back ? await state(page) : null
    rec('C 다음 행동 → 문항 화면 → 지도 복귀 링크로 같은 TASK', !!back && c1?.selected === first, { first, href: href?.split('?')[0], back: back?.split('?')[0], returned: c1?.selected ?? null })
    await shot(page, 'C-returned-1440')

    // D · E V2 · S5 — 수요는 보이고 「지금 학습」 이 아니다 / 지도 연습 줄이 공장 재고를 학습 가능으로 올리지 않는다
    await map(page)
    const dE = {}
    for (const t of ['v.contextual_sense', 's.form_scope']) {
      await sel(page, t)
      const st = await state(page)
      dE[t] = st.supply
      await shot(page, `D-${t}-1440`)
    }
    const allRows = Object.values(dE).flat()
    rec('D V2 · S5 — 수요 줄 있음 · 「지금 학습할 수 있어요」 아님(독해 문항 대체 없음)', Object.values(dE).every((rows) => rows.length > 0 && rows.every((r) => r.step !== 'learn_now')), dE)
    // 이 상태(확인 단계)에서는 V2 · S5 에 지도 연습 줄이 없을 수 있다 — 볼 줄이 0 이면 PASS 가 아니라 SKIP(단위 시험 supply-ledger · supply 가 공장 재고 → 「검수 대기」를 지킨다)
    const guided = allRows.filter((r) => r.role === 'guided_practice')
    if (guided.length === 0) skip('E 테스트 교재 — 이 상태의 V2 · S5 에 지도 연습 줄 0개라 브라우저로는 볼 수 없음(단위 시험이 대신 지킴)', { rows: allRows.map((r) => r.role) })
    else rec('E 테스트 교재 — 지도 연습 줄이 공장 재고를 「지금 학습」 으로 올리지 않음', guided.every((r) => r.state !== 'available' && r.step !== 'learn_now'), guided)

    // F 과거 기준 · 목표 변경
    await map(page, `&asof=${new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10)}`)
    const f1 = await state(page)
    rec('F 과거 기준 보기 — 다음 행동 링크 0(학습 시작 안 함)', f1.nexts.length === 0 && f1.insNext === null, { focus: f1.focus, nexts: f1.nexts.length, insNext: f1.insNext })
    await shot(page, 'F-past-1440')
    await map(page)
    const before = (await state(page)).records
    if ((await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: 92 } })).status() !== 200) throw new Error('목표 변경 실패')
    await map(page)
    const f2 = await state(page)
    rec('F 목표 변경(80 → 92) — 기록 수 그대로 · 지도 다시 계산(우선 카드 = Inspector 선택)', f2.records === before && f2.focus === 'ready' && f2.cards[0] === f2.selected, { before, after: f2.records, cards: f2.cards })
    await shot(page, 'F-goal-92-1440')
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
  suite: '학습지도 v6.2 P-M4 학습자 경험 시나리오(e2e-learner-focus.mjs)',
  head: execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  trackedFilesModified: execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean).length,
  base: BASE, startedAt, endedAt: new Date().toISOString(), browser: 'chromium(@playwright/test)', population: '합성 계정 2(끝에 삭제) — 학습 효과의 증거가 아니다',
  results, skips, pass: results.length - failed, fail: failed, skip: skips.length, screenshots: shots,
  cleanup: { syntheticAccountsCreated: users.length, remainingAfterDelete: remaining },
}, null, 2) + String.fromCharCode(10))
console.log(failed ? `FAIL ${failed}` : 'ALL PASS')
process.exit(failed ? 1 : 0)
