// scripts/knowledge/vertical-claim-support-e2e.mts
//
// Phase 3 첫 수직 경로 브라우저 E2E(2026-10-08) — 개발 서버 + 개발 DB. 실제 사슬(vertical-claim-support-build.mts)이 있어야 한다.
//   A 학습자: /csat/item/2022-20 → 「이 문항에서 확인할 읽기 원리」 → 직접 확인하기 → 오답 제출 → 다시 → 정답 제출 → 기록(DB)
//     · 연구 용어 비노출 · 본인 행만 읽힘(학습자 키) · 직접 쓰기 거부 · 비로그인 401 · efficacy 그대로
//   B 학습 지도: 「글 구조·핵심」 단계 시트 FIND B6-3 → 같은 과제로 가는 명시적 링크
//   C 관리자 추적: 제품 적용 → 사슬 추적(끊긴 곳 0 · 연구 근거 없음 · 효과 미확정)
//   D 노출 게이트: 실제 문항 적용을 관리자 화면에서 중단 → 학습자 칸 · 지도 링크 사라짐 → 다시 켬 → 돌아옴
//   E 재검토 전파(zz- 시험 사슬 — 끝에 지운다): 기제 문장 고치기 → 방법 · 과제 검토 중 · 적용 자동 중단 · 추적에 끊긴 곳
//                                              근거 축 변경 → 채택 항목 + 아래 층 검토 중
// 쓰기: 테스트 계정 2(끝에 삭제 → 수행 기록 cascade) · zz 사슬(끝에 삭제) · 실제 문항 적용의 중단/재개 1회(검토 이력에 남는다).
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/knowledge/vertical-claim-support-e2e.mts [--base http://localhost:3001]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '../..')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3001'
const OUT = path.join(ROOT, 'tmp/knowledge/vertical-e2e')
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL as string
if (!URL_.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')
fs.mkdirSync(OUT, { recursive: true })
let fail = 0
const rec = (name: string, ok: boolean, detail: unknown = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 240)}`) }
const must = async <T,>(q: PromiseLike<{ data: T | null; error: { message: string } | null }>, what: string): Promise<T> => { const { data, error } = await q; if (error) throw new Error(`${what}: ${error.message}`); return data as T }

const ITEM = '2022#20'
const SLUG = '2022-20'
const FORBIDDEN = /탐구|inquiry|근거 수준|evidence level|실무자 주장|practitioner|채택|adopted|efficacy|효과|후보|제품 적용|application|claim-support-relation|task-claim-support|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i
const users: string[] = []
const zz: { items: string[]; apps: string[] } = { items: [], apps: [] }

async function newLearner(browser: { newContext: (o: object) => Promise<any> }, tag: string) {
  const email = `vertical-${tag}-${Date.now()}@example.com`
  const password = `Vc-${crypto.randomBytes(9).toString('base64url')}-Aa1`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  users.push(data.user.id)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const login = await ctx.newPage()
  login.setDefaultTimeout(240_000)
  await login.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await login.fill('input[type="email"]', email)
  await login.fill('input[type="password"]', password)
  await login.click('button[type="submit"]')
  await login.waitForURL((u: URL) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' })
  await login.close()
  const page = await ctx.newPage()
  page.setDefaultTimeout(240_000)
  const userDb = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string, { auth: { persistSession: false } })
  const { error: e2 } = await userDb.auth.signInWithPassword({ email, password })
  if (e2) throw e2
  return { page, ctx, id: data.user.id, userDb }
}

async function liveItemApp() {
  const task = await must(db.from('knowledge_items').select('id').eq('slug', 'task-claim-support-link').single(), 'task')
  return must(db.from('knowledge_applications').select('id, status').eq('surface', 'csat_item_task').eq('surface_ref', 'claim-support:2022-20').eq('item_id', (task as { id: string }).id).single(), 'item app') as Promise<{ id: string; status: string }>
}

/** zz 과제 항목에 적용 · 검증 계획 · 켜기 · 「제품 적용」 — 시험 사슬 전용 */
async function zzApp(taskId: string, tag: string): Promise<string> {
  const app = await must(db.from('knowledge_applications').insert({ item_id: taskId, surface: 'module_task', surface_ref: `zz-vertical-${tag}`, created_by: 'e2e:vertical', updated_by: 'e2e:vertical' }).select('id').single(), 'zz app') as { id: string }
  zz.apps.push(app.id)
  await must(db.from('knowledge_trials').insert({ application_id: app.id, design: { pre: true, post: true, min_n: 1 }, created_by: 'e2e:vertical' }), 'zz trial')
  await must(db.from('knowledge_applications').update({ status: 'active', released_at: new Date().toISOString(), updated_by: 'e2e:vertical' }).eq('id', app.id), 'zz activate')
  await must(db.from('knowledge_items').update({ status: 'applied', status_reason: 'E2E', updated_by: 'e2e:vertical' }).eq('id', taskId), 'zz applied')
  return app.id
}

async function zzChain(tag: string, withTask: boolean) {
  const origin = await must(db.from('knowledge_csat_origins').select('passage_sha256').contains('item_ids', [ITEM]).single(), 'origin') as { passage_sha256: string }
  const layers = withTask ? [['principle', 'processing_mechanism'], ['method', 'method'], ['practice', 'task']] : [['principle', 'processing_mechanism'], ['method', 'method']]
  const ids: string[] = []
  for (const [layer, kind] of layers) {
    const slug = `zz-vert-${tag}-${layer}`
    const row = await must(db.from('knowledge_items').insert({ layer, kind, slug, title: `TEST ${tag} ${layer}`, statement: `E2E 시험 항목(${tag} · ${layer}) — 실행 뒤 삭제`, skill_ids: [], condition_ids: [], status: 'in_review', created_by: 'e2e:vertical', updated_by: 'e2e:vertical' }).select('id').single(), `zz ${slug}`) as { id: string }
    ids.push(row.id); zz.items.push(row.id)
    await must(db.from('knowledge_evidence').insert({ item_id: row.id, grade: 'B', attribution: 'observed', source_type: 'csat_origin', csat_passage_sha256: origin.passage_sha256, created_by: 'e2e:vertical' }), 'zz ev')
  }
  const linkRows: Record<string, string>[] = []
  for (let i = 1; i < ids.length; i++) {
    linkRows.push({ from_id: ids[i], to_id: ids[i - 1], kind: 'implements', reason: 'E2E', created_by: 'e2e:vertical' })
  }
  await must(db.from('knowledge_links').insert(linkRows), 'zz link')
  await must(db.from('knowledge_items').update({ status: 'adopted', status_reason: 'E2E 시험 채택', updated_by: 'e2e:vertical' }).in('id', ids), 'zz adopt')
  const appId = withTask ? await zzApp(ids[2], tag) : null
  return { ids, appId, slugs: layers.map(([l]) => `zz-vert-${tag}-${l}`) }
}
const statusOf = async (ids: string[]) => Object.fromEntries(((await must(db.from('knowledge_items').select('id, status').in('id', ids), 'st')) as { id: string; status: string }[]).map((r) => [r.id, r.status]))

const browser = await chromium.launch()
let realPaused = false
try {
  const admin = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  admin.setDefaultTimeout(240_000)
  const go = async (p: { goto: Function; waitForLoadState: Function }, url: string) => { await p.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' }); await p.waitForLoadState('networkidle').catch(() => {}) }

  // ── A 학습자 ──
  const A = await newLearner(browser, 'a')
  await go(A.page, `/csat/item/${SLUG}`)
  const panel = A.page.locator('[data-testid="principle-panel"]')
  await panel.waitFor()
  const panelText = await panel.innerText()
  rec('A · 문항 화면에 「이 문항에서 확인할 읽기 원리」 · 주장과 근거 연결', /이 문항에서 확인할 읽기 원리/.test(panelText) && /주장과 근거 연결/.test(panelText), panelText.slice(0, 120))
  rec('A · 학습자 화면에 연구 용어 · 내부 id 없음', !FORBIDDEN.test(panelText), panelText.match(FORBIDDEN)?.[0] ?? '')
  await panel.getByRole('button', { name: '직접 확인하기' }).click()
  await A.page.screenshot({ path: path.join(OUT, 'A-task.png'), fullPage: false })
  // 오답: 재진술 문장(6번째)을 주장으로 · 4번째만 · 관계=예시
  await panel.locator('[data-claim="5"]').click()
  await panel.locator('[data-support="3"]').click()
  await panel.locator('[data-relation="example"]').check()
  await panel.getByRole('button', { name: '확인하기' }).click()
  const r1 = panel.locator('[data-testid="principle-result"]')
  await r1.waitFor()
  rec('A · 오답 제출 → 결과(재진술 안내 · 빠진 문장)', (await r1.getAttribute('data-correct')) === 'false' && /다시 말한 문장/.test(await r1.innerText()) && /빠진 문장: 5번째/.test(await r1.innerText()), (await r1.innerText()).slice(0, 160))
  await panel.getByRole('button', { name: '다시 해 보기' }).click()
  await panel.locator('[data-claim="1"]').click()
  await panel.locator('[data-support="3"]').click()
  await panel.locator('[data-support="4"]').click()
  await panel.locator('[data-relation="reason"]').check()
  await panel.getByRole('button', { name: '확인하기' }).click()
  await panel.locator('[data-testid="principle-result"][data-correct="true"]').waitFor()
  rec('A · 정답 제출 → 「주장과 근거를 정확히 연결했어요」', true)
  await A.page.screenshot({ path: path.join(OUT, 'A-result.png'), fullPage: false })

  const app = await liveItemApp()
  const rows = await must(db.from('learning_task_attempts').select('task_key, application_id, item_ref, phase, is_correct, synthetic, content_hash, response').eq('user_id', A.id).order('id'), 'A rows') as Record<string, unknown>[]
  rec('A · 수행 기록 2건(실제 · practice · 같은 적용 · 문항 · 주석 해시)', rows.length === 2 && rows.every((r) => r.task_key === 'claim-support' && r.application_id === app.id && r.item_ref === ITEM && r.phase === 'practice' && r.synthetic === false && typeof r.content_hash === 'string')
    && rows[0].is_correct === false && rows[1].is_correct === true, rows.map((r) => ({ c: r.is_correct, p: r.phase })))

  // 권한 — 학습자 키(RLS): 본인 행만 · 쓰기 거부
  const B = await newLearner(browser, 'b')
  await must(db.from('learning_task_attempts').insert({ user_id: B.id, task_key: 'claim-support', item_ref: ITEM, phase: 'practice', synthetic: true, response: { e2e: true }, is_correct: false }), 'B row')
  const own = await A.userDb.from('learning_task_attempts').select('user_id')
  rec('A · 학습자 키로 읽으면 본인 행만(2)', !own.error && (own.data ?? []).length === 2 && (own.data ?? []).every((r) => r.user_id === A.id), own.error?.message ?? (own.data ?? []).length)
  const ins = await A.userDb.from('learning_task_attempts').insert({ user_id: A.id, task_key: 'claim-support', phase: 'practice', is_correct: true })
  rec('A · 학습자 키로 직접 기록 쓰기 거부', !!ins.error, ins.error?.message)
  const upd = await A.userDb.from('learning_task_attempts').update({ is_correct: true }).eq('user_id', A.id).select('id')
  rec('A · 학습자 키로 자기 기록 고치기 거부', !!upd.error || (upd.data ?? []).length === 0, upd.error?.message ?? (upd.data ?? []).length)
  const anon = await fetch(`${BASE}/api/csat/item/${SLUG}/task`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ response: { claim: 1, support: [3, 4], relation: 'reason' } }) })
  rec('비로그인 제출 → 401', anon.status === 401, anon.status)
  const bad = await A.page.evaluate(async (s: string) => (await fetch(`/api/csat/item/${s}/task`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ response: { claim: 9, support: [3], relation: 'reason' } }) })).status, SLUG)
  rec('범위 밖 문장 번호 → 400(기록 안 남음)', bad === 400, bad)
  const other = await A.page.evaluate(async () => (await fetch('/api/csat/item/2021-20/task', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ response: { claim: 1, support: [3], relation: 'reason' } }) })).status)
  rec('적용 없는 문항(2021-20) → 400 · 화면에도 없음', other === 400, other)
  const task = await must(db.from('knowledge_items').select('efficacy, status').eq('slug', 'task-claim-support-link').single(), 'task eff') as { efficacy: string; status: string }
  const trials = await must(db.from('knowledge_trials').select('status, result').eq('application_id', app.id), 'trials') as { status: string; result: string | null }[]
  rec('수행 뒤에도 efficacy 미확정 · 검증 계획 planned', task.efficacy === 'not_assessed' && trials.every((t) => t.status === 'planned' && t.result === null), { task, trials })

  // ── B 학습 지도 ──
  await go(A.page, '/csat/diagnosis?tab=map')
  await A.page.locator('[data-testid="read-path"] [data-step="structure"]').click()
  const link = A.page.locator('[data-testid="find-practice-link"][data-task="B6-3"]')
  await link.waitFor()
  const href = await link.getAttribute('href')
  rec('B · 지도 「글 구조·핵심」 FIND B6-3 → 같은 과제로 가는 링크', href === `/csat/item/${SLUG}#principle`, href)
  rec('B · 다른 FIND 과제에는 링크 없음(명시적 연결만)', (await A.page.locator('[data-testid="find-practice-link"]').count()) === 1)
  await A.page.screenshot({ path: path.join(OUT, 'B-map.png'), fullPage: false })
  await link.click()
  await A.page.locator('[data-testid="principle-panel"]').waitFor()
  rec('B · 링크 → 문항 화면의 같은 과제', true)

  // ── C 관리자 추적 ──
  await go(admin, `/admin/knowledge/product/${app.id}`)
  const breaks = admin.locator('[data-testid="trace-breaks"]')
  await breaks.waitFor()
  rec('C · 사슬 추적 — 끊긴 곳 0', (await breaks.getAttribute('data-live')) === 'true', await breaks.innerText())
  const chainTxt = await admin.locator('[data-testid="trace-chain"]').innerText()
  rec('C · 탐구 질문 → 근거 → 기제 → 방법 → 과제 → 적용 → 수행 → 검증', ['inquiry', 'evidence', 'principle', 'method', 'practice', 'application', 'attempts', 'trial'].every((s) => chainTxt.length > 0) && (await admin.locator('[data-testid="trace-chain"] > li').count()) >= 8, (await admin.locator('[data-testid="trace-chain"] > li').count()))
  rec('C · 연구 근거 없음을 그대로 보인다', /없음/.test(await admin.locator('[data-testid="trace-research"]').innerText()))
  rec('C · 실제 수행이 보이되 효과는 미확정', /기록 \d+건/.test(await admin.locator('[data-testid="trace-attempts"]').innerText()) && /미확정/.test(await admin.locator('[data-testid="trace-efficacy"]').innerText()))
  await admin.screenshot({ path: path.join(OUT, 'C-trace.png'), fullPage: true })

  // ── D 노출 게이트 — 실제 문항 적용 중단 → 사라짐 → 다시 켬 ──
  await go(admin, '/admin/knowledge/product')
  const ctl = admin.locator(`[data-testid="app-status-${app.id}"]`)
  await ctl.getByLabel(/이유/).fill('E2E — 학습자 노출 게이트 확인(곧 다시 켬)')
  await ctl.getByRole('button', { name: '중단' }).click()
  await admin.getByText('저장했습니다').first().waitFor()
  realPaused = true
  await go(A.page, `/csat/item/${SLUG}`)
  rec('D · 적용 중단 → 학습자 문항 화면에서 원리 칸이 사라짐', (await A.page.locator('[data-testid="principle-panel"]').count()) === 0)
  await go(A.page, '/csat/diagnosis?tab=map')
  await A.page.locator('[data-testid="read-path"] [data-step="structure"]').click()
  await A.page.locator('[data-step-sheet]').waitFor()
  rec('D · 지도 링크도 사라짐(문항 쪽이 꺼지면 지도에서 빈 화면으로 보내지 않는다)', (await A.page.locator('[data-testid="find-practice-link"]').count()) === 0)
  await go(admin, '/admin/knowledge/product')
  await admin.locator(`[data-testid="app-status-${app.id}"]`).getByRole('button', { name: '학습자에게 켜기' }).click()
  await admin.getByText('저장했습니다').first().waitFor()
  realPaused = false
  await go(A.page, `/csat/item/${SLUG}`)
  rec('D · 다시 켬 → 돌아옴', (await A.page.locator('[data-testid="principle-panel"]').count()) === 1)

  // ── E 재검토 전파(zz 시험 사슬) ──
  const c1 = await zzChain(`s${Date.now().toString(36)}`, true)
  await go(admin, `/admin/knowledge/item/${c1.slugs[0]}`)
  const sf = admin.locator('section', { has: admin.locator('#statement-form') })
  // 수화 전에 채우면 React 상태가 못 받아 버튼이 계속 꺼져 있다 — 켜질 때까지 다시 채운다
  const save = sf.getByRole('button', { name: '문장 저장' })
  for (let i = 0; i < 10 && !(await save.isEnabled()); i++) { await sf.getByLabel('항목 문장').fill(`E2E 시험 항목 — 문장을 고쳤다 ${i}`); await admin.waitForTimeout(500) }
  await save.click()
  const fb = sf.locator('[role="status"], [role="alert"]').first()
  await fb.waitFor()
  const msg = await fb.innerText()
  const st1 = await statusOf(c1.ids)
  const app1 = await must(db.from('knowledge_applications').select('status, status_reason').eq('id', c1.appId!).single(), 'zz app') as { status: string; status_reason: string }
  rec('E · 기제 문장 변경 → 기제 · 방법 · 과제 모두 검토 중(연쇄)', c1.ids.every((id) => st1[id] === 'in_review') && /연쇄 재검토/.test(msg), { st1, msg })
  rec('E · 과제 적용 자동 중단(DB 트리거)', app1.status === 'paused' && /자동 중단/.test(app1.status_reason), app1)
  await go(admin, `/admin/knowledge/product/${c1.appId}`)
  rec('E · 추적 화면에 끊긴 곳 표시', (await admin.locator('[data-testid="trace-breaks"]').getAttribute('data-live')) === 'false', (await admin.locator('[data-testid="trace-breaks"]').innerText()).slice(0, 200))
  const rv = await must(db.from('knowledge_reviews').select('item_id, to_status, reason').in('item_id', c1.ids).eq('to_status', 'in_review'), 'reviews') as { reason: string }[]
  rec('E · 검토 기록에 연쇄 이유가 남는다', rv.length >= 3 && rv.some((r) => /연쇄 재검토/.test(r.reason ?? '')), rv.length)

  const c2 = await zzChain(`e${Date.now().toString(36)}`, false)
  const ev = await must(db.from('knowledge_evidence').select('id').eq('item_id', c2.ids[0]).single(), 'zz2 ev') as { id: string }
  await go(admin, `/admin/knowledge/item/${c2.slugs[0]}`)
  const axes = admin.locator('[data-testid="evidence-axes"]').first()
  await axes.getByLabel('적용 적합성').selectOption('partial')
  await axes.getByRole('button', { name: '축 저장' }).click()
  await axes.getByRole('status').waitFor()
  const st2 = await statusOf(c2.ids)
  rec('E · 근거 축 변경 → 채택 항목 + 아래 층 검토 중', c2.ids.every((id) => st2[id] === 'in_review'), { st2, ev: ev.id })
} catch (e) {
  rec('실행 오류 없이 끝남', false, (e as Error).message)
} finally {
  await browser.close()
  // 실제 적용을 중단한 채 끝나면 되살린다(검증 계획 · 채택이 그대로라 DB 가 받는다)
  if (realPaused) {
    const app = await liveItemApp().catch(() => null)
    if (app && app.status === 'paused') await db.from('knowledge_applications').update({ status: 'active', status_reason: null, released_at: new Date().toISOString(), updated_by: 'e2e:vertical-restore' }).eq('id', app.id)
  }
  for (const id of users) await db.auth.admin.deleteUser(id).catch(() => {})
  if (zz.apps.length) {
    await db.from('knowledge_applications').update({ status: 'rolled_back', status_reason: 'E2E 정리', updated_by: 'e2e:vertical' }).in('id', zz.apps).neq('status', 'rolled_back')
    await db.from('knowledge_trials').delete().in('application_id', zz.apps)
    await db.from('knowledge_applications').delete().in('id', zz.apps)
  }
  if (zz.items.length) {
    await db.from('knowledge_links').delete().or(`from_id.in.(${zz.items.join(',')}),to_id.in.(${zz.items.join(',')})`)
    await db.from('knowledge_evidence').delete().in('item_id', zz.items)
    await db.from('knowledge_reviews').delete().in('item_id', zz.items)
    await db.from('knowledge_items').delete().in('id', zz.items)
  }
  const left = (await db.from('knowledge_items').select('id', { count: 'exact', head: true }).like('slug', 'zz-vert-%')).count
  const leftAttempts = users.length ? (await db.from('learning_task_attempts').select('id', { count: 'exact', head: true }).in('user_id', users)).count : 0
  const realApp = await liveItemApp().catch(() => null)
  rec('정리 — zz 항목 0 · 테스트 계정 기록 0 · 실제 문항 적용 active', left === 0 && leftAttempts === 0 && realApp?.status === 'active', { left, leftAttempts, real: realApp?.status })
  console.log(fail ? `실패 ${fail}` : '모든 단언 통과')
  process.exit(fail ? 1 : 0)
}
