// scripts/knowledge/loop-screen-e2e.mts
//
// 학습 원리 순환 — **실제 화면** E2E(2026-10-10). 개발 서버 2대 + 개발 DB + 기존 테스트 계정(lexicon-test@vocaflow.local · 합성 도메인).
//   학습자 서버(--learner, 기본 :3011) · 관리자 보기 서버(--admin, 기본 :3012 · DEV_ADMIN_BYPASS=1 — 개발 전용).
//   확인하는 것(화면 · DB 로 확인된 것만 PASS):
//     S1 B6-3 학습 지도 확인 시트에 출시된 확인 문항 링크가 9개 보인다
//     S2 확인 문항 9개 문항 화면에 원리 과제 패널이 보인다
//     S3 두 문항에서 실제로 제출 → 화면 판정 · learning_task_attempts 에 행이 생긴다
//     S4 두 확인 문항 결과로 학습 지도 판정이 「연습이 필요해 보여요」(confirmed_need)로 바뀐다
//     S5 관리자 「성과 검토 신호」 에 적용 행이 보이고, 합성 기록은 성과로 세지 않는다
//     S6 학습자 계정은 관리자 화면에 못 들어간다 · 켜지지 않은(초안) 과제는 서버가 기록을 거부한다
//   쓰기: 테스트 계정의 수행 기록 · 세션 · 원장(승인 범위 시도 ≤120 · 세션 ≤60 · 원장 ≤200 · 합성). 끝에 이번 실행이 만든 PK 만 지운다(못 지우면 보고).
//   실행: cd apps/web && node --env-file=<.env.local> <tsx cli> ../../scripts/knowledge/loop-screen-e2e.mts
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '../..')
const arg = (k: string, d: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const LEARNER = arg('--learner', 'http://localhost:3011')
const ADMIN = arg('--admin', 'http://localhost:3012')
const OUT = arg('--out', path.join(ROOT, 'tmp/knowledge/loop-e2e'))
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = req('@playwright/test')
const fixture = fs.readFileSync(path.join(ROOT, 'apps/web/tests/e2e/fixtures/test-user.ts'), 'utf8')
const EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || fixture.match(/email:[^'"]*['"]([^'"]+@[^'"]+)['"]/)![1]
const PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || fixture.match(/password:[^'"]*['"]([^'"]+)['"]/)![1]
fs.mkdirSync(OUT, { recursive: true })

const ITEMS = ['2022#20', '2025#20', '2016#20', '2020#20', '2021#20', '2026#20', 'M2506#20', 'M2606#20', 'M2609#20']
const slug = (id: string) => id.replace('#', '-')
const results: { id: string; pass: boolean; detail: string }[] = []
const rec = (id: string, pass: boolean, detail: string) => {
  results.push({ id, pass, detail })
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id} — ${detail}`)
}
const ann = (id: string) => {
  const dir = path.join(ROOT, 'apps/web/src/lib/knowledge/annotations')
  const f = fs.readdirSync(dir).filter((x) => x.startsWith(`claim-support-${slug(id).toLowerCase()}.`)).sort().pop()!
  return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { claim: number; support: number[]; sentenceCount: number; relationProbe: { relation: string } }
}

const user = await (async () => {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email === EMAIL)
    if (hit) return hit
    if (data.users.length < 200) break
  }
  throw new Error('테스트 계정이 없다 — 새로 만들지 않는다')
})()

const maxId = async (table: string, col: string) => {
  const { data, error } = await db.from(table).select(col).eq('user_id', user.id).order(col, { ascending: false }).limit(1)
  if (error) throw new Error(`${table} 기준선: ${error.message}`)
  return (data?.[0] as Record<string, unknown> | undefined)?.[col] ?? null
}
const before = { attempt: (await maxId('learning_task_attempts', 'id')) as number | null, startedAt: new Date().toISOString() }

const browser = await chromium.launch()
const learner = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
learner.setDefaultTimeout(120_000)
// 이 실행이 보낸 기록의 mutation id — 정리 대상은 이것으로만 고른다
const sentMutations = new Set<string>()
learner.on('request', (r: { url: () => string; method: () => string; postData: () => string | null }) => {
  if (r.method() !== 'POST' || !/\/api\/csat\/item\/[^/]+\/task$/.test(new URL(r.url()).pathname)) return
  try {
    const m = JSON.parse(r.postData() ?? '{}').clientMutationId
    if (typeof m === 'string') sentMutations.add(m)
  } catch {
    // 본문이 JSON 이 아니면 기록도 생기지 않는다
  }
})
const go = async (p: typeof learner, url: string) => {
  await p.goto(url, { waitUntil: 'domcontentloaded' })
  await p.waitForLoadState('networkidle').catch(() => {})
}
const shot = (p: typeof learner, name: string) => p.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false })

async function openStructureSheet() {
  await go(learner, `${LEARNER}/csat/diagnosis?tab=map`)
  await learner.locator('button[data-step="structure"]').first().click()
  await learner.getByTestId('find-practice-link').first().waitFor()
}

try {
  // 로그인
  await go(learner, `${LEARNER}/login`)
  await learner.fill('input[type="email"]', EMAIL)
  await learner.fill('input[type="password"]', PASSWORD)
  await Promise.all([learner.waitForURL((u: URL) => !u.pathname.startsWith('/login'), { timeout: 120_000 }), learner.click('button[type="submit"]')])

  // S1 학습 지도 B6-3 확인 문항
  await openStructureSheet()
  const links = await learner.locator('[data-testid="find-practice-link"][data-task="B6-3"]').evaluateAll((els: Element[]) => els.map((e) => e.getAttribute('data-item')))
  await shot(learner, 's1-map-sheet')
  rec('S1 B6-3 확인 문항 링크', ITEMS.every((i) => links.includes(i)) && links.length === ITEMS.length, `링크 ${links.length}개: ${links.join(', ')}`)
  const outcomeBefore = await learner.getByTestId('find-outcome').getAttribute('data-state').catch(() => null)
  const decisionBefore = await learner.getByTestId('learning-decision').getAttribute('data-action').catch(() => null)

  // S2 확인 문항 9개 원리 패널
  const panelOk: string[] = []
  for (const id of ITEMS) {
    await go(learner, `${LEARNER}/csat/item/${slug(id)}#principle`)
    const ok = await learner.getByTestId('principle-panel').isVisible().catch(() => false)
    if (ok) panelOk.push(id)
  }
  rec('S2 확인 문항 원리 패널', panelOk.length === ITEMS.length, `${panelOk.length}/${ITEMS.length} 보임${panelOk.length < ITEMS.length ? ' — 없음: ' + ITEMS.filter((i) => !panelOk.includes(i)).join(', ') : ''}`)

  // S3 아직 시도하지 않은 확인 문항 두 개에 일부러 틀린 주장으로 제출
  const { data: tried } = await db.from('learning_first_attempts').select('item_ref').eq('user_id', user.id).eq('task_key', 'claim-support').eq('phase', 'practice')
  const triedSet = new Set((tried ?? []).map((r: { item_ref: string }) => r.item_ref))
  const fresh = ITEMS.filter((i) => !triedSet.has(i)).slice(0, 2)
  const submitted: string[] = []
  for (const id of fresh) {
    const a = ann(id)
    await go(learner, `${LEARNER}/csat/item/${slug(id)}#principle`)
    const panel = learner.getByTestId('principle-panel')
    await panel.locator('button').first().click()
    await learner.getByTestId('principle-task').waitFor()
    const wrongClaim = [...Array(a.sentenceCount).keys()].find((i) => i !== a.claim && !a.support.includes(i))!
    await learner.locator(`[data-claim="${wrongClaim}"]`).click()
    const sup = [...Array(a.sentenceCount).keys()].find((i) => i !== wrongClaim)!
    await learner.locator(`[data-support="${sup}"]`).click()
    await learner.locator(`[data-relation="${a.relationProbe.relation}"]`).check()
    await learner.getByRole('button', { name: '확인하기' }).click()
    const result = learner.getByTestId('principle-result')
    await result.waitFor()
    const correct = await result.getAttribute('data-correct')
    await shot(learner, `s3-${slug(id)}`)
    if (correct === 'false') submitted.push(id)
  }
  const { data: newRows } = await db.from('learning_task_attempts').select('id,item_ref,is_correct,synthetic,help_level').eq('user_id', user.id).gt('id', before.attempt ?? 0)
  const rowsFor = (newRows ?? []).filter((r: { item_ref: string }) => fresh.includes(r.item_ref))
  rec('S3 실제 제출 · 수행 기록', fresh.length === 2 && submitted.length === 2 && rowsFor.length >= 2 && rowsFor.every((r: { is_correct: boolean }) => r.is_correct === false),
    `제출 ${submitted.join(', ') || '없음'} · 새 기록 ${rowsFor.length}행 · ${JSON.stringify(rowsFor.map((r: Record<string, unknown>) => ({ item: r.item_ref, ok: r.is_correct, syn: r.synthetic, help: r.help_level })))}`)

  // S4 학습 지도 판정 변화
  await openStructureSheet()
  const outcome = learner.getByTestId('find-outcome')
  const stateAfter = await outcome.getAttribute('data-state').catch(() => null)
  const text = await outcome.innerText().catch(() => '')
  await shot(learner, 's4-map-outcome')
  rec('S4 두 확인 문항 → 학습 요구 판정', stateAfter === 'confirmed_need', `전 ${outcomeBefore} → 후 ${stateAfter} · 「${text.replace(/\s+/g, ' ').slice(0, 120)}」`)

  // S7 학습 요구 → 다음 할 일(원리 기반 결정) · 추적 정보
  const dec = learner.getByTestId('learning-decision')
  const action = await dec.getAttribute('data-action').catch(() => null)
  const trace = { policy: await dec.getAttribute('data-policy').catch(() => null), principle: await dec.getAttribute('data-principle').catch(() => null), method: await dec.getAttribute('data-method').catch(() => null), reason: await dec.getAttribute('data-reason').catch(() => null), observation: JSON.parse((await dec.getAttribute('data-observation').catch(() => null)) ?? 'null') }
  const decHref = await learner.getByTestId('learning-decision-link').getAttribute('href').catch(() => null)
  rec('S7 학습 요구 → 원리 과제 선택', decisionBefore === 'start_check' && action === 'practice_method' && !!trace.policy && !!trace.principle && !!trace.method && !!trace.reason && trace.observation?.items?.length === 2 && decHref === '/csat/practice/claim-support',
    `전 ${decisionBefore} → 후 ${action} · ${decHref} · 정책 ${trace.policy} · 원리 ${trace.principle?.slice(0, 8)} · 방법 ${trace.method?.slice(0, 8)}`)

  // S5 관리자 성과 검토 신호
  const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  admin.setDefaultTimeout(120_000)
  await go(admin, `${ADMIN}/admin/knowledge/signals`)
  const rows = await admin.getByTestId('signal-row').count()
  const body = await admin.locator('main').innerText().catch(() => '')
  await admin.screenshot({ path: path.join(OUT, 's5-admin-signals.png'), fullPage: true })
  // 방금 낸 합성 제출이 그 적용 행에서 「합성」으로만 세지고 실제 · 성과 신호에 들어가지 않는지 행마다 확인한다
  const synthCheck: { item: string; real: number; synthetic: number; level: string | null }[] = []
  for (const id of submitted) {
    const row = admin.getByTestId('signal-row').filter({ hasText: `claim-support:${slug(id)}` }).first()
    const level = await row.getAttribute('data-level').catch(() => null)
    const counts = await row.locator('dt', { hasText: '실제 첫 시도 · 제외 · 합성' }).locator('xpath=following-sibling::dd[1]').innerText().catch(() => '')
    const [real, , synthetic] = counts.split('·').map((s: string) => Number(s.trim()))
    synthCheck.push({ item: id, real, synthetic, level })
  }
  const synthOk = synthCheck.length === submitted.length && synthCheck.length > 0 && synthCheck.every((c) => c.real === 0 && c.synthetic >= 1 && c.level !== 'review')
  rec('S5 관리자 성과 검토 신호 · 합성 제외', rows >= 10 && synthOk,
    `적용 행 ${rows}개 · 제출 문항별 ${JSON.stringify(synthCheck)}(실제 0 · 합성 ≥1 · 검토 필요 아님이어야 통과) · 본문 「검토 필요」 ${(body.match(/검토 필요/g) ?? []).length}회`)
  await go(admin, `${ADMIN}/admin/knowledge/product`)
  const approveBtn = await admin.getByRole('button', { name: /출시 승인하고 학습자에게 켜기/ }).count()
  await admin.screenshot({ path: path.join(OUT, 's5-admin-product.png'), fullPage: true })
  rec('S5b 관리자 출시 승인 버튼', approveBtn >= 1, `「출시 승인하고 학습자에게 켜기」 ${approveBtn}개(초안 · 중단 적용)`)

  // S6 접근 제한 — 학습자 계정으로 관리자 화면 · 초안 과제 기록
  await go(learner, `${LEARNER}/admin/knowledge/signals`)
  const landed = new URL(learner.url()).pathname
  const draftRes = await learner.evaluate(async () => {
    const r = await fetch('/api/csat/item/2022-36/task', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ response: {}, sec: 1, clientSessionId: crypto.randomUUID(), clientMutationId: crypto.randomUUID(), answeredAt: new Date().toISOString(), helpLevel: 'independent' }) })
    return { status: r.status, body: await r.json().catch(() => null) }
  })
  rec('S6 서버 접근 제한', !landed.startsWith('/admin') && draftRes.status >= 400 && ['not_live', 'no_task'].includes(String(draftRes.body?.code)),
    `학습자 → /admin/knowledge/signals 도착 ${landed} · 초안 과제(cohesion-link 2022#36) 기록 ${draftRes.status} code=${draftRes.body?.code}`)
} catch (e) {
  rec('예외', false, (e as Error).message)
} finally {
  await browser.close()
}

// 정리 — **이 실행이 보낸 제출**(브라우저가 보낸 clientMutationId)로 생긴 행만. 같은 계정 · 같은 시간대의 다른 실행 행은 건드리지 않는다(Codex P1)
const cleanup: Record<string, unknown> = { sentMutations: sentMutations.size }
{
  const { data: atts } = sentMutations.size
    ? await db.from('learning_task_attempts').select('id,client_mutation_id,session_id,synthetic').eq('user_id', user.id).in('client_mutation_id', [...sentMutations])
    : { data: [] }
  const mine = (atts ?? []).filter((r: { synthetic: boolean }) => r.synthetic === true)
  const ids = mine.map((r: { id: number }) => r.id)
  const muts = mine.map((r: { client_mutation_id: string | null }) => r.client_mutation_id).filter(Boolean)
  const sess = [...new Set(mine.map((r: { session_id: string | null }) => r.session_id).filter(Boolean))]
  const del = async (table: string, col: string, vals: unknown[]) => {
    if (!vals.length) return { table, deleted: 0 }
    const { data, error } = await db.from(table).delete().eq('user_id', user.id).in(col, vals as string[]).select(col)
    return { table, asked: vals.length, deleted: data?.length ?? 0, error: error?.message ?? null }
  }
  cleanup.attempts = await del('learning_task_attempts', 'id', ids)
  cleanup.mutations = await del('learning_mutations', 'client_mutation_id', muts)
  cleanup.sessions = await del('learning_sessions', 'id', sess)
}
console.log('정리', JSON.stringify(cleanup))
fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ at: new Date().toISOString(), results, cleanup }, null, 2))
const failed = results.filter((r) => !r.pass).length
console.log(failed ? `실패 ${failed}/${results.length}` : `전부 통과 ${results.length}`)
process.exit(failed ? 1 : 0)
