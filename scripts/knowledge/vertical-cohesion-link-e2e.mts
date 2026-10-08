// scripts/knowledge/vertical-cohesion-link-e2e.mts
//
// 두 번째 수직 경로 「실제 수행 기록」 브라우저 E2E(2026-10-08 준비) — **노출 승인 뒤에만 돈다.**
// 전제(하나라도 아니면 아무것도 쓰지 않고 멈춘다 — exit 2):
//   ① 응집 적용 2개(cohesion-link:2022-36 · a3-4)가 active(사용자 노출 승인 뒤)
//   ② 문항 과제 기록이 G2 계약(f5 통합 · learning_attempt_record) — 응답에 outcome 이 있다
// 확인:
//   A 학습자: /csat/item/2022-36 응집 칸 → 오답 → 다시 → 정답 → 기록 2건(세션 · client_mutation_id · 적용 · 주석 해시)
//     · 첫 시도 뷰 = 오답 · independent · 합성 아님 · 같은 mutation 재전송 → duplicate(행 그대로) · 비로그인 401 · 형식 오류 invalid_input
//   B 학습 지도: relation 단계 시트 FIND A3-4 → /csat/item/2022-36#principle · 링크 → 같은 과제
//   C 관리자 추적: 제품 적용 → 사슬 추적(끊긴 곳 0 · 효과 미확정)
//   efficacy not_assessed · 검증 계획 planned 그대로
// 쓰기: 테스트 학습자 1(끝에 삭제 → 세션 · 수행 기록 cascade). 지식 행 · 적용 상태는 읽기만 한다.
// 복습 · 재평가 순환은 f5 의 기출 → Practice → 복습 → 재평가 E2E 가 맡는다(같은 G2 기록 위).
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/knowledge/vertical-cohesion-link-e2e.mts [--base http://localhost:3001]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '../..')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3001'
const OUT = path.join(ROOT, 'tmp/knowledge/vertical-cohesion-e2e')
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL as string
if (!URL_.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')
fs.mkdirSync(OUT, { recursive: true })
let fail = 0
const rec = (name: string, ok: boolean, detail: unknown = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 240)}`) }
const must = async <T,>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>, what: string): Promise<T> => { const { data, error } = await q; if (error) throw new Error(`${what}: ${error.message}`); return data as T }

const ITEM = '2022#36'
const SLUG = '2022-36'
const FORBIDDEN = /탐구|inquiry|근거 수준|evidence level|실무자 주장|practitioner|채택|adopted|efficacy|효과|후보|제품 적용|application|cohesion-cues|task-cohesion/i

// ① 노출 승인 전이면 멈춘다
const task = await must(db.from('knowledge_items').select('id, efficacy').eq('slug', 'task-cohesion-link').single(), 'task') as { id: string; efficacy: string }
const apps = await must(db.from('knowledge_applications').select('id, surface, surface_ref, status').eq('item_id', task.id), 'apps') as { id: string; surface: string; surface_ref: string; status: string }[]
const itemApp = apps.find((a) => a.surface === 'csat_item_task')
if (apps.length !== 2 || apps.some((a) => a.status !== 'active') || !itemApp) {
  console.log(`BLOCKED — 응집 적용이 모두 active 가 아니다(노출 승인 전): ${JSON.stringify(apps.map((a) => [a.surface_ref, a.status]))}. 아무것도 쓰지 않았다.`)
  process.exit(2)
}

// ② G2 계약 확인 — **계정을 만들기 전에**(Codex P1: 옛 계약도 답을 INSERT 하므로 제출로 확인하면 「쓰기 없음」이 거짓이 된다).
//    개발 서버는 이 워크트리 코드를 띄우므로 서버 기록 함수가 learning_attempt_record 를 부르는지 원본으로 본다.
const serverSrc = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/knowledge/product-server.ts'), 'utf8')
if (!serverSrc.includes("learning_attempt_record")) {
  console.log('BLOCKED — 문항 과제 기록이 아직 G2 계약이 아니다(product-server 에 learning_attempt_record 경로 없음). f5 통합 머지 뒤 다시 돌린다. 아무것도 쓰지 않았다.')
  process.exit(2)
}

const email = `vertical-coh-${Date.now()}@example.com`
const password = `Vc-${crypto.randomBytes(9).toString('base64url')}-Aa1`
const { data: created, error: ce } = await db.auth.admin.createUser({ email, password, email_confirm: true })
if (ce) throw ce
const uid = created.user.id
let browser: { close: () => Promise<void>; newContext: (o: object) => Promise<any> } | null = null
try {
  browser = await chromium.launch()
  const ctx = await browser!.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(240_000)
  const go = async (url: string) => { await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}) }
  await go('/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u: URL) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' })

  // ② G2 계약 확인 — 요청 메타를 보내고 응답에 outcome 이 오는지(아니면 옛 직접 INSERT 경로)
  const lastBody: { v: Record<string, unknown> | null } = { v: null }
  page.on('request', (r: { url: () => string; method: () => string; postData: () => string | null }) => {
    if (r.method() === 'POST' && r.url().includes(`/api/csat/item/${SLUG}/task`)) lastBody.v = JSON.parse(r.postData() ?? 'null')
  })

  // ── A 학습자 ──
  await go(`/csat/item/${SLUG}`)
  const panel = page.locator('[data-testid="principle-panel"][data-task="cohesion-link"]')
  await panel.waitFor()
  const text = await panel.innerText()
  rec('A · 응집 칸 보임 · 연구 용어 없음', !FORBIDDEN.test(text), text.match(FORBIDDEN)?.[0] ?? '')
  await panel.getByRole('button', { name: '직접 확인하기' }).click()
  // 오답: 단서 1 → 1번째(0) · 순서 3번째 보기
  await panel.locator('[data-probe="cue1"][data-pick="0"]').click()
  await panel.locator('[data-probe="cue2"][data-pick="2"]').click()
  await panel.locator('[data-order="2"]').check()
  const r1 = page.waitForResponse((r: { url: () => string }) => r.url().includes(`/api/csat/item/${SLUG}/task`))
  await panel.getByRole('button', { name: '확인하기' }).click()
  const first = await (await r1).json()
  if (!('outcome' in first)) {
    console.log('BLOCKED — 문항 과제 기록이 G2 계약이 아니다(응답에 outcome 없음). f5 통합 머지 뒤 다시 돌린다.')
    process.exitCode = 2
  } else {
    await panel.locator('[data-testid="principle-result"][data-correct="false"]').waitFor()
    rec('A · 오답 → 결과(단서 1 다시 · 순서 다시)', first.outcome === 'inserted' && first.grade?.isCorrect === false, first)
    const firstBody = lastBody.v
    rec('A · 요청에 G2 메타(세션 · mutation · 판단 시각 · 도움 수준)', !!firstBody && ['clientSessionId', 'clientMutationId', 'answeredAt', 'helpLevel'].every((k) => typeof firstBody[k] === 'string'), firstBody)
    await panel.getByRole('button', { name: '다시 해 보기' }).click()
    await panel.locator('[data-probe="cue1"][data-pick="3"]').click()
    await panel.locator('[data-probe="cue2"][data-pick="2"]').click()
    await panel.locator('[data-order="1"]').check()
    await panel.getByRole('button', { name: '확인하기' }).click()
    await panel.locator('[data-testid="principle-result"][data-correct="true"]').waitFor()
    rec('A · 정답 → 「단서를 따라 단락을 바르게 이었어요」', true)
    await page.screenshot({ path: path.join(OUT, 'A-result.png') })

    const rows = await must(db.from('learning_task_attempts').select('id, task_key, application_id, item_ref, is_correct, synthetic, session_id, client_mutation_id').eq('user_id', uid).order('answered_at'), 'rows') as Record<string, unknown>[]
    rec('A · 기록 2건(응집 과제 · 같은 적용 · 문항 · 세션 · mutation id · 실제)', rows.length === 2 && rows.every((r) => r.task_key === 'cohesion-link' && r.application_id === itemApp.id && r.item_ref === ITEM && r.session_id && r.client_mutation_id && r.synthetic === false)
      && rows[0].is_correct === false && rows[1].is_correct === true, rows.map((r) => ({ c: r.is_correct, s: !!r.session_id })))
    const fa = await must(db.from('learning_first_attempts').select('is_correct, help_level, synthetic').eq('user_id', uid).eq('item_ref', ITEM), 'first') as Record<string, unknown>[]
    rec('A · 첫 시도 = 오답 한 건 · 실효 도움 수준 기록 · 합성 아님', fa.length === 1 && fa[0].is_correct === false && typeof fa[0].help_level === 'string' && fa[0].synthetic === false, fa)
    // 같은 mutation 재전송 → duplicate · 행 그대로
    const replay = await page.request.post(`${BASE}/api/csat/item/${SLUG}/task`, { data: firstBody })
    const rb = await replay.json().catch(() => ({}))
    const after = await must(db.from('learning_task_attempts').select('id').eq('user_id', uid), 'after') as unknown[]
    rec('A · 같은 mutation 재전송 → duplicate · 행 2 그대로', rb.outcome === 'duplicate' && after.length === 2, { status: replay.status(), rb, rows: after.length })
    const bad = await page.request.post(`${BASE}/api/csat/item/${SLUG}/task`, { data: { ...firstBody, clientMutationId: crypto.randomUUID(), response: { picks: { cue1: 99, cue2: 2 }, order: 1 } } })
    rec('A · 형식 오류 → 400 invalid_input', bad.status() === 400 && (await bad.json()).code === 'invalid_input', bad.status())
    const anon = await fetch(`${BASE}/api/csat/item/${SLUG}/task`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(firstBody) })
    rec('A · 비로그인 → 401', anon.status === 401, anon.status)

    // ── B 학습 지도 ──
    await go('/csat/diagnosis?tab=map')
    await page.locator('[data-testid="read-path"] [data-step="relation"]').click()
    const link = page.locator('[data-testid="find-practice-link"][data-task="A3-4"]')
    await link.waitFor()
    rec('B · 지도 relation FIND A3-4 → 같은 과제 링크', (await link.getAttribute('href')) === `/csat/item/${SLUG}#principle`, await link.getAttribute('href'))
    await link.click()
    await page.locator('[data-testid="principle-panel"][data-task="cohesion-link"]').waitFor()
    rec('B · 링크 → 문항 화면의 응집 과제', true)

    // ── C 관리자 추적 ──
    const admin = await (await browser!.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
    admin.setDefaultTimeout(240_000)
    await admin.goto(`${BASE}/admin/knowledge/product/${itemApp.id}`, { waitUntil: 'domcontentloaded' })
    const breaks = admin.locator('[data-testid="trace-breaks"]')
    await breaks.waitFor()
    rec('C · 사슬 추적 — 끊긴 곳 0', (await breaks.getAttribute('data-live')) === 'true', await breaks.innerText())
    rec('C · 수행이 보이되 효과는 미확정', /기록 \d+건/.test(await admin.locator('[data-testid="trace-attempts"]').innerText()) && /미확정/.test(await admin.locator('[data-testid="trace-efficacy"]').innerText()))
    await admin.screenshot({ path: path.join(OUT, 'C-trace.png'), fullPage: true })

    const eff = await must(db.from('knowledge_items').select('efficacy').eq('id', task.id).single(), 'eff') as { efficacy: string }
    const trials = await must(db.from('knowledge_trials').select('status').in('application_id', apps.map((a) => a.id)), 'trials') as { status: string }[]
    rec('efficacy not_assessed · 검증 계획 planned 그대로', eff.efficacy === 'not_assessed' && trials.every((t) => t.status === 'planned'), { eff, trials })
  }
} finally {
  // 정리는 브라우저 종료 실패와 무관하게 — 삭제 오류는 숨기지 않는다(Codex P2)
  await browser?.close().catch((e: Error) => console.log(`브라우저 종료 실패: ${e.message}`))
  const { error: de } = await db.auth.admin.deleteUser(uid)
  rec('정리 — 테스트 계정 삭제(세션 · 기록 cascade)', !de, de?.message ?? '')
}
if (fail) { console.log(`실패 ${fail}`); process.exitCode = 1 } else if (process.exitCode !== 2) console.log('모든 단언 통과')
