// scripts/csat/map/v62/e2e-map-supply.mjs
//
// v6.2 P-F4c — R5 기존 콘텐츠 재사용 수직 경로(**읽기 전용** — 수요 · 공급 저장은 승인안 B 전이라 없다).
//   ① R5 선택 → Inspector 수요 키 · 공급(독립 확인 = 기존 검수 확인 문항) · 다음 행동이 그 공급 문항 중 하나
//   ② 새로 고쳐도 같은 수요 키(같은 학습자 · 같은 버전 → 같은 수요) · 새 생산 0
//   ③ 공급 문항을 풀고 돌아오면 그 문항은 다시 공급되지 않는다(중복 공급 0) · 같은 TASK 로 복귀
//   ④ V2 · S5 — 수요는 있으나 공급 경로 없음(무관 · 결손으로 바꾸지 않음) · 보류 TASK 는 수요 없음
//   ⑤ 다른 학습자 계정은 첫 학습자의 수요 키 · 공급 이력을 보지 않는다(학습자별 계산)
// 합성 계정(끝에 삭제) — 학습 효과의 증거가 아니다.
//   node --tls-max-v1.2 --env-file=<main apps/web/.env.local> scripts/csat/map/v62/e2e-map-supply.mjs --base http://localhost:3005 [--evidence <dir>]
// --evidence: 단계별 Inspector 화면 · results.json(HEAD · 대상 서버 · 시작/종료 · 항목별 PASS/FAIL · 합성 계정 정리 확인)을 남긴다.
//   계정 이메일 · 비밀번호 · 사용자 id 는 남기지 않는다(개수와 정리 결과만).
import crypto from 'node:crypto'
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const { createClient } = req('@supabase/supabase-js')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3005'
const EVID = process.argv.includes('--evidence') ? path.resolve(process.argv[process.argv.indexOf('--evidence') + 1]) : null
if (EVID) (await import('node:fs')).mkdirSync(EVID, { recursive: true })
const startedAt = new Date().toISOString()
let shot = 0
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const results = []
const rec = (name, ok, detail) => { results.push({ name, ok, detail: detail ?? null }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`) }
const users = []

// LM-W1 — Inspector 는 상시 열이 아니라 「노드 → 빠른 팝업 → 자세한 근거 보기」 드로어 안에 있다(내용 · testid 그대로)
async function openInspector(page, task) {
  await page.waitForSelector(`[data-node="${task}"]`)
  if (!(await page.$(`[data-testid="ins-drawer"] [data-testid="task-inspector"][data-task="${task}"]`))) {
    if (await page.$('[data-testid="ins-drawer"]')) { await page.keyboard.press('Escape'); await page.waitForTimeout(200) }
    if (await page.$('[data-testid="ws-modal"]')) { await page.keyboard.press('Escape'); await page.waitForTimeout(200) }
    // 홈 복귀는 그 칸으로 부드럽게 스크롤한다 — 스크롤이 멈춘 뒤 누르고, 팝업이 안 떴으면 다시(움직이는 칸을 놓친 클릭)
    for (let i = 0; i < 3 && !(await page.$(`[data-testid="task-pop"][data-task="${task}"]`)); i++) {
      await page.locator(`[data-node="${task}"]`).scrollIntoViewIfNeeded()
      await page.waitForTimeout(600)
      await page.click(`[data-node="${task}"]`)
      await page.waitForTimeout(300)
    }
    await page.waitForSelector(`[data-testid="task-pop"][data-task="${task}"]`)
    await page.click('[data-testid="pop-detail"]')
  }
  await page.waitForSelector(`[data-testid="ins-drawer"] [data-testid="task-inspector"][data-task="${task}"]`)
}

const browser = await chromium.launch()

async function learner(tag, goal = 80) {
  const email = `map-v62-supply-${tag}-${Date.now()}@example.com`
  const password = `Mq-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data: u, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(u.user.id)
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  page.setDefaultTimeout(240_000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { waitUntil: 'commit' })
  if ((await page.request.put(`${BASE}/api/csat/diagnosis/map/goal`, { data: { target: goal } })).status() !== 200) throw new Error('목표 실패')
  return page
}
const view = async (page, task) => {
  await page.goto(`${BASE}/csat/diagnosis?tab=map&map_task=${task}`, { waitUntil: 'domcontentloaded' })
  await openInspector(page, task)
  await page.waitForTimeout(300)
  if (EVID) await page.locator(`[data-testid="task-inspector"][data-task="${task}"]`).screenshot({ path: path.join(EVID, `${String(++shot).padStart(2, '0')}-${task}.png`) })
  return page.evaluate(() => ({
    demand: document.querySelector('[data-testid="inspector-supply"]')?.getAttribute('data-demand') ?? null,
    rows: [...document.querySelectorAll('[data-testid="inspector-supply"] li')].map((e) => ({ role: e.getAttribute('data-role'), state: e.getAttribute('data-state'), step: e.getAttribute('data-step'), text: e.textContent })),
    next: document.querySelector('[data-testid="inspector-next"]')?.getAttribute('href') ?? null,
    ledger: document.querySelector('[data-testid="inspector-ledger-note"]')?.getAttribute('data-ledger') ?? null,
  }))
}
// 정답 · 오답은 주석(annotations)으로 만든다(e2e-lm-g1-2 와 같은 방법)
const ANN = path.join(ROOT, 'apps/web/src/lib/knowledge/annotations')
function annotationOf(s) {
  const fsm = req('node:fs')
  const files = fsm.readdirSync(ANN).filter((f) => f.startsWith(`claim-support-${s.toLowerCase().replace('#', '-')}.v`)).sort()
  if (!files.length) throw new Error(`주석 없음 ${s}`)
  return JSON.parse(fsm.readFileSync(path.join(ANN, files.at(-1)), 'utf8'))
}
const slug = (href) => href?.split('#')[0].split('?')[0].split('/').pop() ?? null

try {
  const a = await learner('a')
  const r1 = await view(a, 'r.central_meaning')
  const check = r1.rows.find((r) => r.role === 'independent_check')
  // #281 E04 — 정식 자격(FQ) reader 가 없으면 기존 확인 문항은 「열 수 있음 · 정식 자격 전」(open_unqualified)이지 available 이 아니다
  rec('① R5 수요 · 독립 확인 = 기존 출시 확인 문항(열 수 있음 · 정식 자격 전) · 다음 행동 있음', !!r1.demand && check?.state === 'open_unqualified' && check?.step === 'open_unqualified' && !!r1.next, r1)
  // P-F8e — 영속 주문 표(승인안 B)가 없으므로 어떤 줄도 「주문됨 · 만드는 중 · 검수 중 · 보류 · 공급 완료」가 아니다
  const ORDERISH = new Set(['ordered', 'producing', 'reviewing', 'held', 'delivered', 'partially_delivered', 'delivered_count_unknown'])
  rec('①b 실제 주문 기록 없이 주문 계열 단계 0 · 기록 상태를 숨기지 않음', r1.rows.length > 0 && r1.rows.every((r) => r.step && !ORDERISH.has(r.step)) && ['not_installed', 'no_workspace'].includes(r1.ledger), { steps: r1.rows.map((r) => r.step), ledger: r1.ledger })
  // Factory I1 — 교수 역할(원문 분석 · 모델 설명) 줄은 교수 적합성 검수 전이라 「지금 쓸 수 있음(available)」이 아니다.
  //   열 수 있는 해설이 있으면 readable_unreviewed · read_now(지금 읽을 수 있음 · 수업용 검수 전), 없으면 기존 needs_review/unsupported
  const teachingRows = (r) => r.rows.filter((x) => x.role === 'source_analysis' || x.role === 'model_explanation')
  rec('①c 확인 단계 — 교수 역할 줄이 있다면 available 아님(이 단계는 보통 0줄 · 실제 검사는 ⑥)', teachingRows(r1).every((x) => x.state !== 'available' && (x.state !== 'readable_unreviewed' || x.step === 'read_now')), teachingRows(r1).map((x) => ({ role: x.role, state: x.state, step: x.step })))
  const r1b = await view(a, 'r.central_meaning')
  rec('② 새로 고쳐도 같은 수요 키', r1b.demand === r1.demand, { a: r1.demand, b: r1b.demand })

  // ③ 공급 문항 하나 풀기
  const first = slug(r1.next)
  await a.goto(`${BASE}${r1.next.split('#')[0]}`, { waitUntil: 'domcontentloaded' })
  const panel = a.locator('[data-testid="principle-panel"]')
  await panel.waitFor({ timeout: 120_000 })
  await a.waitForLoadState('networkidle').catch(() => {})
  const task = panel.locator('[data-testid="principle-task"]')
  for (let k = 0; k < 10 && !(await task.count()); k++) {
    await panel.getByRole('button', { name: '직접 확인하기' }).click({ timeout: 10_000 }).catch(() => {})
    await a.waitForTimeout(800)
  }
  await panel.locator('[data-claim]').last().click()
  await panel.locator('[data-support]').first().click()
  await panel.locator('[data-relation]').last().check().catch(() => {})
  const resp = a.waitForResponse((r) => /\/api\/csat\/item\/.+\/task/.test(r.url()))
  await panel.getByRole('button', { name: '확인하기' }).click()
  const saved = (await resp).status() === 200
  const r3 = await view(a, 'r.central_meaning')
  rec('③ 푼 문항은 다시 공급되지 않는다(다음 행동이 다른 미노출 문항) · 같은 TASK', saved && slug(r3.next) !== first, { first, next: slug(r3.next) })

  // ④ V2 · S5 · 보류
  const v2 = await view(a, 'v.contextual_sense')
  const s5 = await view(a, 's.form_scope')
  const l1 = await view(a, 'l.sound')
  rec('④ V2 · S5 = 수요는 있고 공급 경로 없음 · 보류 TASK 는 수요 없음', v2.rows.length > 0 && v2.rows.every((r) => r.state !== 'available') && s5.rows.length > 0 && l1.rows.length === 0, { v2: v2.rows.map((r) => r.state), s5: s5.rows.map((r) => r.state), l1: l1.rows.length })

  // ⑤ 다른 학습자
  const b = await learner('b')
  const rb = await view(b, 'r.central_meaning')
  rec('⑤ 다른 학습자는 자기 수요 · 공급(첫 학습자가 푼 문항이 그에게는 미노출 그대로)', slug(rb.next) === first, { bNext: slug(rb.next), aSolved: first })

  // ⑥ Factory I1 — 확인 2회 실패 → REPAIR 단계 수요(원문 분석 · 모델 설명 · 지도 연습). 교수 역할 줄은 교수 검수 전이라 available 이 아니고,
  //    푼 문항의 해설은 열람 가능 = readable_unreviewed · read_now(「지금 읽을 수 있어요 · 수업용 검수 전」). 열람 기능은 그대로다.
  const c = await learner('c')
  for (let i = 0; i < 2; i++) {
    const s = await view(c, 'r.central_meaning')
    const it = slug(s.next)
    const ann = annotationOf(it)
    const resp = await c.request.post(`${BASE}/api/csat/item/${it}/task`, { data: { response: { claim: (ann.claim + 1) % ann.sentenceCount, support: ann.support, relation: ann.relationProbe.relation }, clientSessionId: crypto.randomUUID(), clientMutationId: crypto.randomUUID(), answeredAt: new Date().toISOString(), helpLevel: 'independent', sec: 40 } })
    if (resp.status() !== 200) throw new Error(`FIND 제출 실패 ${resp.status()}`)
    await c.waitForTimeout(1300)
  }
  const rc = await view(c, 'r.central_meaning')
  const tr = teachingRows(rc)
  rec('⑥ REPAIR — 교수 역할 줄 있음 · available 아님 · 열람 가능 해설은 read_now(검수 전 표시)', tr.length > 0 && tr.every((x) => x.state !== 'available') && tr.some((x) => x.state === 'readable_unreviewed') && tr.filter((x) => x.state === 'readable_unreviewed').every((x) => x.step === 'read_now' && /검수 전/.test(x.text ?? '')), tr.map((x) => ({ role: x.role, state: x.state, step: x.step, text: (x.text ?? '').slice(0, 40) })))
} catch (e) {
  rec('실행 오류', false, { error: String(e).slice(0, 300) })
} finally {
  await browser.close()
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
}
const failed = results.filter((r) => !r.ok).length
if (EVID) {
  // 정리 확인 — 만든 합성 계정이 남아 있지 않은가(id 는 기록하지 않는다)
  let remaining = 0
  for (const id of users) { const { data } = await db.auth.admin.getUserById(id); if (data?.user) remaining++ }
  const head = (await import('node:child_process')).execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const dirty = (await import('node:child_process')).execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean).length
  ;(await import('node:fs')).writeFileSync(path.join(EVID, 'results.json'), JSON.stringify({
    suite: 'R5 기존 콘텐츠 재사용 수직 경로(e2e-map-supply.mjs)', head, trackedFilesModified: dirty, base: BASE, startedAt, endedAt: new Date().toISOString(),
    browser: 'chromium(@playwright/test) · 1440×1000', population: '합성 계정 2(끝에 삭제) — 학습 효과의 증거가 아니다',
    results, pass: results.length - failed, fail: failed, skip: 0, screenshots: shot,
    cleanup: { syntheticAccountsCreated: users.length, remainingAfterDelete: remaining },
  }, null, 2) + String.fromCharCode(10))
}
console.log(failed ? `FAIL ${failed}` : 'ALL PASS')
process.exit(failed ? 1 : 0)
