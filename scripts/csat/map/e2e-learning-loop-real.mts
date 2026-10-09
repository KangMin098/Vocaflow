// scripts/csat/map/e2e-learning-loop-real.mts
//
// 학습 순환 실제 경로 E2E(2026-10-09 · main d83600529 뒤) — 개발 서버 + 개발 DB. 직접 INSERT 없이 학생 화면만 쓴다.
//   1 학습 지도 FIND B6-3 → 「2022학년도 수능 20번으로 직접 확인」 링크
//   2 문항 화면 원리 칸 → 오답 제출 → 다시 → 정답 제출(G2 기록 계약: 세션 · client_mutation_id · 판단 시각)
//   3 DB: 시도 2건(세션 연결 · mutation id · 합성 = 서버가 테스트 도메인으로 판정) · 첫 시도 뷰 = 오답 · 원장 행
//   4 같은 요청 재전송 → duplicate(행 그대로)
//   5 학습 지도로 돌아오면 「내가 한 확인 2번 · 처음 다시 볼 곳 · 최근 맞았어요 · 다음 확인으로」
// 쓰기: 테스트 계정 1(example.com — 합성 판정) · 시도 2 · 세션 ≤2 · 원장 ≤6 · 방문 이벤트. 끝에 이 계정 것만 정리(계정 삭제 cascade).
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/map/e2e-learning-loop-real.mts [--base http://localhost:3003]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3003'
const OUT = path.join(ROOT, 'tmp/csat/learning-loop-real')
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL as string
if (!URL_.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const { chromium } = createRequire(path.join(ROOT, 'apps/web/package.json'))('@playwright/test')
fs.mkdirSync(OUT, { recursive: true })
let fail = 0
const rec = (name: string, ok: boolean, detail: unknown = '') => { if (!ok) fail++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 260)}`) }

const email = `loop-real-${Date.now()}@example.com`
const password = `Lr-${crypto.randomBytes(9).toString('base64url')}-Aa1`
const { data: created, error: ce } = await db.auth.admin.createUser({ email, password, email_confirm: true })
if (ce) throw ce
const uid = created.user.id
// 실학습 Practice 풀에 2022#20 말고 다른 문항이 있나 — 켜진 claim-support 문항 적용 수로 판정(화면 안내 조건과 같다: 그때만 「다른 지문에 적용」 링크)
const { data: liveApps } = await db.from('knowledge_applications').select('surface_ref').eq('surface', 'csat_item_task').eq('status', 'active').like('surface_ref', 'claim-support:%')
// 실학습 풀은 「켜진 적용 + 이 코드에 주석이 있는 문항」 만 담는다(practice-server) — 주석 파일이 없는 문항은 켜져 있어도 풀 밖
const annDir = path.join(ROOT, 'apps/web/src/lib/knowledge/annotations')
const annotated = new Set(fs.readdirSync(annDir).filter((n) => n.startsWith('claim-support-')).map((n) => n.replace(/^claim-support-/, '').replace(/\.v\d+\.json$/, '')))
const otherPractice = (liveApps ?? []).some((a) => a.surface_ref !== 'claim-support:2022-20' && annotated.has(a.surface_ref.replace(/^claim-support:/, '')))
console.log(`· 실학습 Practice 풀의 다른 문항: ${otherPractice ? '있음' : '없음'} → 「다른 지문에 적용」 링크 기대 ${otherPractice ? '보임' : '숨김'}`)
let browser: { close: () => Promise<void>; newContext: (o: object) => Promise<any> } | null = null
try {
  browser = await chromium.launch()
  const page = await (await browser!.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  page.setDefaultTimeout(240_000)
  const go = async (url: string) => { await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}) }
  await go('/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u: URL) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' })

  // 1 학습 지도 → 확인 과제 링크
  const openSheet = async () => {
    await go('/csat/diagnosis?tab=map')
    await page.locator('[data-testid="read-path"] [data-step="structure"]').click()
    await page.locator('[data-step-sheet]').waitFor()
  }
  await openSheet()
  const link = page.locator('[data-testid="find-practice-link"][data-task="B6-3"][data-item="2022#20"]')
  rec('1 학습 지도 FIND B6-3 → 확인 과제 링크', (await link.count()) === 1 && (await link.getAttribute('href')) === '/csat/item/2022-20#principle', await link.getAttribute('href'))
  // 링크 주소는 위에서 확인했다 — 이동은 그 주소로 연다(지도 모달 안 클릭 이동은 해시 스크롤 · 모달 상태에 따라 패널 렌더가 늦다)
  await go((await link.getAttribute("href"))!.split("#")[0])

  // 2 문항 화면에서 오답 → 다시 → 정답(화면 경로 그대로)
  const panel = page.locator('[data-testid="principle-panel"]')
  await panel.waitFor()
  await panel.getByRole('button', { name: '직접 확인하기' }).click()
  const bodies: Record<string, unknown>[] = []
  page.on('request', (r: { url: () => string; method: () => string; postData: () => string | null }) => {
    if (r.method() === 'POST' && r.url().includes('/api/csat/item/2022-20/task')) bodies.push(JSON.parse(r.postData() ?? 'null'))
  })
  await panel.locator('[data-claim="6"]').click()
  await panel.locator('[data-support="3"]').click()
  await panel.locator('[data-relation="example"]').check()
  const r1 = page.waitForResponse((r: { url: () => string }) => r.url().includes('/api/csat/item/2022-20/task'))
  await panel.getByRole('button', { name: '확인하기' }).click()
  const b1 = await (await r1).json()
  await panel.locator('[data-testid="principle-result"][data-correct="false"]').waitFor()
  rec('2 오답 제출 → 저장(outcome inserted) · 결과 표시', b1.outcome === 'inserted' && b1.grade?.isCorrect === false, b1)
  rec('2 요청에 G2 메타(세션 · mutation · 판단 시각 · 도움 수준)', !!bodies[0] && ['clientSessionId', 'clientMutationId', 'answeredAt', 'helpLevel'].every((k) => typeof bodies[0][k] === 'string'), bodies[0])
  await panel.getByRole('button', { name: '다시 해 보기' }).click()
  await panel.locator('[data-claim="1"]').click()
  await panel.locator('[data-support="3"]').click()
  await panel.locator('[data-support="4"]').click()
  await panel.locator('[data-relation="reason"]').check()
  await panel.getByRole('button', { name: '확인하기' }).click()
  await panel.locator('[data-testid="principle-result"][data-correct="true"]').waitFor()
  rec('2 정답 제출 → 「정확히 연결」', true)
  // 문항 화면의 Practice 링크(PR #164) — 같은 원리를 다른 기출로 연습
  const itemPractice = page.locator('a[href="/csat/practice/claim-support"]')
  rec('2 문항 화면에 Practice 링크(/csat/practice/claim-support)', (await itemPractice.count()) >= 1)

  // 3 DB 확인
  const rows = (await db.from('learning_task_attempts').select('id, task_key, item_ref, is_correct, synthetic, session_id, client_mutation_id, phase').eq('user_id', uid).order('answered_at')).data ?? []
  rec('3 시도 2건 · 세션 연결 · mutation id · 합성(테스트 도메인) · practice', rows.length === 2 && rows.every((r) => r.session_id && r.client_mutation_id && r.synthetic === true && r.task_key === 'claim-support' && r.item_ref === '2022#20') && rows[0].is_correct === false && rows[1].is_correct === true, rows.map((r) => ({ c: r.is_correct, s: !!r.session_id, syn: r.synthetic })))
  const fa = (await db.from('learning_first_attempts').select('is_correct, help_level, synthetic').eq('user_id', uid).eq('item_ref', '2022#20')).data ?? []
  rec('3 첫 시도 뷰 = 오답 한 건 · 합성', fa.length === 1 && fa[0].is_correct === false && fa[0].synthetic === true, fa)
  const { count: mc } = await db.from('learning_mutations').select('client_mutation_id', { count: 'exact', head: true }).eq('user_id', uid)
  rec('3 요청 원장 기록 있음', (mc ?? 0) >= 2, mc)

  // 4 같은 요청 재전송 → duplicate
  const replay = await page.request.post(`${BASE}/api/csat/item/2022-20/task`, { data: bodies[0] })
  const rb = await replay.json().catch(() => ({}))
  const { count: after } = await db.from('learning_task_attempts').select('id', { count: 'exact', head: true }).eq('user_id', uid)
  rec('4 같은 요청 재전송 → duplicate · 행 2 그대로', rb.outcome === 'duplicate' && after === 2, { status: replay.status(), rb, after })

  // 5 학습 지도로 돌아와 결과 환류
  await openSheet()
  const res = page.locator('[data-testid="find-practice-result"]')
  await res.waitFor()
  const t = await res.innerText()
  rec('5 학습 지도 「내가 한 확인 2번 · 처음 다시 볼 곳 · 최근 맞았어요」 · 다음 = 넘어가기', (await res.getAttribute('data-attempts')) === '2' && (await res.getAttribute('data-next')) === 'move_on' && /처음 다시 볼 곳/.test(t) && /최근.*맞았어요/.test(t), t)
  const mp = page.locator('[data-testid="find-next-practice"]')
  rec(`5 학습 지도 다음 칸 — 다른 지문 Practice 링크 ${otherPractice ? '보임' : '숨김'}`, otherPractice ? (await mp.count()) === 1 && (await mp.getAttribute('href')) === '/csat/practice/claim-support' : (await mp.count()) === 0)
  await page.locator('li', { has: res }).screenshot({ path: path.join(OUT, 'map-feedback.png') })

  // 6 Practice 화면 — 주소가 실제로 열린다(리다이렉트 · 404 아님)
  const pr = await page.request.get(`${BASE}/csat/practice/claim-support`, { maxRedirects: 0 })
  rec('6 Practice 주소 /csat/practice/claim-support 가 200 으로 열린다', pr.status() === 200, pr.status())

} finally {
  await browser?.close().catch((e: Error) => console.log(`브라우저 종료 실패: ${e.message}`))
  const { error: fe } = await db.from('funnel_events').delete().eq('user_id', uid)
  rec('정리 — 이번 계정의 방문 이벤트 삭제', !fe, fe?.message ?? '')
  const { error: de } = await db.auth.admin.deleteUser(uid)
  rec('정리 — 테스트 계정 삭제(세션 · 시도 · 원장 cascade — F7 계정 삭제 허용)', !de, de?.message ?? '')
  const left = await Promise.all(['learning_task_attempts', 'learning_sessions', 'learning_mutations'].map(async (t) => (await db.from(t).select('user_id', { count: 'exact', head: true }).eq('user_id', uid)).count))
  rec('정리 — 남은 시도 · 세션 · 원장 0', left.every((n) => n === 0), left)
}
if (fail) { console.log(`실패 ${fail}`); process.exitCode = 1 } else console.log('모든 단언 통과')
