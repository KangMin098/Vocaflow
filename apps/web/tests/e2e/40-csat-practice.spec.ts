// apps/web/tests/e2e/40-csat-practice.spec.ts
//
// **/csat/practice 「주장과 근거」 연습 — 이식 회귀(docs/csat-learner/PRACTICE_PORT.md).**
// 이식 원천: 동결 feat/knowledge-vnext 의 40-knowledge-practice.spec.ts(설계 · 배포 표는 폐기돼 경로를 정본으로 바꿨다).
//
// ⚠️ DB 에 쓰지 않는다(G1 incident 재발 방지). 로그인 단계를 포함한 **모든 브라우저 컨텍스트**에서
//    분석 이벤트 · 그 밖의 쓰기 요청을 가로채 기록만 한다. 제출 API 는 이 파일 안의 **가짜 서버**가 받는다 —
//    채점은 실제 정본 함수(gradePractice + gradeClaimSupport)로 한다. 화면이 읽는 것(문항 풀 · 내 기록)은 실제 서버 읽기다.
// 합성 학습자 검증이다 — 학습 효과를 말하지 않는다.
// Run: pnpm --filter web test:e2e:r5 (starts the guarded server automatically).
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { annotationFor, gradeClaimSupport, skeletonSig } from '../../src/lib/knowledge/claim-support'
import { RELATION_LABEL } from '../../src/lib/knowledge/claim-support-labels'
import { gradePractice, keyFromAnnotation, phaseOfType, practiceFeedback, type PracticeAnswer } from '../../src/lib/knowledge/practice'
import { serviceClient } from './utils/db'

const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password:
    process.env.PLAYWRIGHT_RUNTIME_PASSWORD ??
    (() => {
      throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local')
    })(),
}
// Request this item; reservation may substitute another released practice item.
const PRACTICE = '/csat/practice/claim-support?item=2022%2320'
// Reservation can substitute another item. Bind clicks, grading and expected
// feedback to the selected item's current annotation AND baked skeleton.
function fixtureFor(itemId: string) {
  const ann = annotationFor(itemId)
  expect(ann, `current annotation for ${itemId}`).not.toBeNull()
  const [exam] = itemId.split('#')
  const file = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/lib/csat/skeleton-data', `${exam}.json`), 'utf8'))
  const item = file.items.find((i: { id: string }) => i.id === itemId)
  expect(item, `baked skeleton for ${itemId}`).toBeTruthy()
  expect(skeletonSig(item.sentences.map((s: { chars: number }) => s.chars))).toBe(ann!.skeletonSig)
  expect(item.sentences).toHaveLength(ann!.sentenceCount)
  return { key: keyFromAnnotation(ann!), phase: phaseOfType(item.type_id)! }
}

let storage: Awaited<ReturnType<BrowserContext['storageState']>>
const READ_ONLY_BASE = process.env.R5_READ_ONLY_BASE_URL || 'http://localhost:3129'
let ownedServer: ChildProcess | null = null

test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

/** 쓰기로 보이는 요청 — GET/HEAD 가 아닌 것과 PostgREST 쓰기 */
const isWrite = (method: string) => method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000)
  const ctx = await browser.newContext({ baseURL: READ_ONLY_BASE })
  let guardProbe
  try { guardProbe = await ctx.request.head('/login', { timeout: 120_000 }) } catch (error) {
    // The ordinary test:e2e command also runs this file. Start its protected
    // server here when absent; never use the ordinary learner server for QA.
    if (!String(error).includes('ECONNREFUSED') || !['localhost', '127.0.0.1'].includes(new URL(READ_ONLY_BASE).hostname)) throw error
    ownedServer = spawn(process.execPath, [path.resolve(__dirname, '../../../../scripts/csat/map/v62/r5-read-only-server.cjs')], { env: { ...process.env, R5_READ_ONLY_PORT: new URL(READ_ONLY_BASE).port || '3129' }, stdio: 'ignore', windowsHide: true })
    for (let retry = 0; retry < 120; retry++) {
      try { guardProbe = await ctx.request.head('/login', { timeout: 120_000 }); break } catch (startupError) {
        if (ownedServer.exitCode !== null) throw new Error(`R5 guarded server exited: ${ownedServer.exitCode}`)
        if (!String(startupError).includes('ECONNREFUSED')) throw startupError
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }
  }
  expect(guardProbe, 'guarded server readiness').toBeTruthy()
  expect(guardProbe!.headers()['x-vocaflow-r5-read-only'], 'isolated server must block RSC DB writes too').toBe('1')
  // 로그인 화면 · 로그인 뒤 첫 화면도 분석 이벤트를 보낸다 — 여기서도 가로챈다. 인증 요청만 통과시킨다
  await ctx.route('**/*', (route) => {
    const r = route.request()
    if (!isWrite(r.method()) || new URL(r.url()).pathname === '/auth/v1/token') return route.continue()
    return route.fulfill({ json: { ok: true } })
  })
  const page = await ctx.newPage()
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await page.fill('input[type="email"]', USER.email)
  await page.fill('input[type="password"]', USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
  storage = await ctx.storageState()
  await ctx.close()
})
test.afterAll(() => {
  if (!ownedServer || ownedServer.exitCode !== null || !ownedServer.pid) return
  if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(ownedServer.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
  else ownedServer.kill('SIGTERM')
})

interface Probe {
  page: Page
  ctx: BrowserContext
  /** 가짜 서버가 받은 제출 본문 */
  submits: Record<string, unknown>[]
  /** 판단 전 해설 열람 본문(/api/csat/practice/view) */
  views: Record<string, unknown>[]
  /** 복습 예약 본문(/api/csat/practice/review) */
  reviews: Record<string, unknown>[]
  /** 가로챈 그 밖의 쓰기(분석 이벤트 포함) */
  writes: string[]
  /** 다음 n 번 제출을 500 으로 */
  failNext: number
}

/** 가짜 제출 서버 — 같은 (제출 id) 는 한 번만 저장(duplicate), 다른 답이면 conflict */
async function device(browser: Browser): Promise<Probe> {
  const ctx = await browser.newContext({ baseURL: READ_ONLY_BASE, storageState: storage, viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.setDefaultNavigationTimeout(120_000)
  const probe: Probe = { page, ctx, submits: [], views: [], reviews: [], writes: [], failNext: 0 }
  const stored = new Map<string, string>()
  // 컨텍스트 전체를 가로챈다 — 「해설 보기」 가 여는 새 탭도 같은 그물 안이다(PRACTICE_PORT_VERIFICATION §5 P1).
  // 쓰기 계수도 컨텍스트 단위다(probe.writes 는 이 컨텍스트의 모든 페이지 합)
  await ctx.route('**/*', async (route) => {
    const req = route.request()
    const url = req.url()
    if (!isWrite(req.method())) return route.continue()
    // 문제지 해시 조회는 POST 지만 읽기다(좌표 색인 반환 · DB 쓰기 없음 — api/csat/paper 머리말). 해설 탭이 로컬 문제지를 열면 보낸다
    if (req.url().includes('/api/csat/paper')) return route.continue()
    // 기기 진행 동기화(본 문항 목록 등)는 학습 시도가 아니다 — #182 해결 뒤 해설 탭이 /api/csat/state 에 PUT 한다(전엔 503 으로 막혀 안 보였다). 가짜 응답으로 받아 실 DB 는 안 바뀐다
    if (req.url().includes('/api/csat/state')) return route.fulfill({ json: { ok: true } })
    if (url.includes('/api/csat/practice/review')) {
      probe.reviews.push(req.postDataJSON() as Record<string, unknown>)
      // 서버 확정 날짜 — 이미 다른 날로 잡혀 있던 경우(kept)를 흉내 낸다
      return route.fulfill({ json: { ok: true, reviewDate: '2026-10-12', requestedDate: '2026-10-16', kept: true, reviewAt: '2026-10-11T15:00:00.000Z', outcome: 'duplicate' } })
    }
    if (url.includes('/api/csat/practice/view')) {
      probe.views.push(req.postDataJSON() as Record<string, unknown>)
      return route.fulfill({ json: { ok: true, saved: true } })
    }
    if (url.includes('/api/csat/practice/attempt')) {
      const body = req.postDataJSON() as Record<string, unknown>
      probe.submits.push(body)
      if (probe.failNext > 0) {
        probe.failNext -= 1
        return route.fulfill({ status: 500, json: { ok: false, error: '잠시 뒤 다시 시도해 주세요' } })
      }
      const id = String(body.clientMutationId)
      const sig = JSON.stringify([body.itemId, body.claim, body.support, body.relation, body.option, body.confidence, body.answeredAt, body.helpLevel])
      if (stored.has(id) && stored.get(id) !== sig) return route.fulfill({ status: 409, json: { ok: false, error: 'conflict' } })
      const outcome = stored.has(id) ? 'duplicate' : 'inserted'
      stored.set(id, sig)
      const answer = body as unknown as PracticeAnswer
      expect(body.itemId).toBe(await page.locator('select').inputValue())
      const { key, phase } = fixtureFor(String(body.itemId))
      const db = serviceClient()
      expect(db, 'read-only answer-key client').not.toBeNull()
      const { data, error } = await db!.from('csat_items_public').select('answer').eq('id', body.itemId).single()
      expect(error).toBeNull()
      expect(data!.answer).toBeGreaterThanOrEqual(1)
      expect(data!.answer).toBeLessThanOrEqual(5)
      const grade = gradePractice(gradeClaimSupport, key, answer)
      return route.fulfill({ json: { ok: true, outcome, feedback: practiceFeedback(key, grade, answer.option === null ? null : answer.option === data!.answer, phase, body.helpLevel as 'independent') } })
    }
    probe.writes.push(`${req.method()} ${url} ${(req.postData() ?? "").slice(0, 300)}`)
    return route.fulfill(url.includes('/api/analytics/event') ? { json: { ok: true } } : { status: 204, body: '' })
  })
  return probe
}

/** 실제 선택 문항의 현재 주장 · 근거 · 관계. 선지 5 정오는 실제 읽기 전용 키로 채점한다. */
async function answer(page: Page) {
  const { key } = fixtureFor(await page.locator('select').inputValue())
  await page.getByRole('button', { name: new RegExp(`^문장 ${key.claim + 1}(?:\\s|$)`) }).click()
  for (const support of key.support) await page.getByRole('button', { name: new RegExp(`^문장 ${support + 1}(?:\\s|$)`) }).click()
  await page.getByRole('button', { name: RELATION_LABEL[key.relationProbe!.relation], exact: true }).click()
  await page.getByRole('button', { name: '5번', exact: true }).click()
  await page.getByRole('button', { name: '확실해요' }).click()
  return key
}

test('학습자: 검증 전 문항은 안 보이고, 풀이 → 판정(정답 키는 응답 뒤에만) · 중복 클릭은 한 번 전송', async ({ browser }) => {
  const d = await device(browser)
  await d.page.goto(PRACTICE)
  await expect(d.page.getByRole('heading', { level: 1, name: '주장 문장 먼저 찾기' })).toBeVisible()
  // 학습자에게 골격(검증 전) 문항은 없다
  await expect(d.page.locator('option', { hasText: '검증 전' })).toHaveCount(0)
  await expect(d.page.getByText('주장: 문장')).toHaveCount(0)
  const key = await answer(d.page)
  await d.page.getByRole('button', { name: '맞춰 보기' }).dblclick()
  await expect(d.page.getByRole('status').filter({ hasText: '주장 문장을 찾았어요' })).toBeVisible({ timeout: 20_000 })
  await expect(d.page.getByText(`주장: 문장 ${key.claim + 1} · 근거: 문장 ${key.support.map((s) => s + 1).join(', ')} (맞음)`, { exact: false })).toBeVisible()
  expect(d.submits).toHaveLength(1)
  const s = d.submits[0]
  expect(s).toMatchObject({ itemId: key.itemId, claim: key.claim, support: key.support, relation: key.relationProbe!.relation, option: 5, confidence: 3, helpLevel: 'independent', preview: false })
  expect(typeof s.answeredAt).toBe('string')
  expect(String(s.clientMutationId)).toMatch(/^[0-9a-f-]{36}$/)
  expect(String(s.clientSessionId)).toMatch(/^[0-9a-f-]{36}$/)
  // knowledge_task_* 이벤트를 보내지 않는다(DB 허용 목록 밖)
  expect(d.writes.filter((w) => w.includes('knowledge_task'))).toEqual([])
  await d.ctx.close()
})

test('학습자: 실패 뒤 재시도는 같은 제출 id · 같은 판단 시각(요청 멱등)', async ({ browser }) => {
  const d = await device(browser)
  d.failNext = 1
  await d.page.goto(PRACTICE)
  await answer(d.page)
  await d.page.getByRole('button', { name: '맞춰 보기' }).click()
  await expect(d.page.locator('[role=alert]:not(#__next-route-announcer__)')).toBeVisible() // Next 경로 알림판도 role=alert
  await d.page.getByRole('button', { name: '맞춰 보기' }).click()
  await expect(d.page.getByRole('status').filter({ hasText: '주장 문장을 찾았어요' })).toBeVisible({ timeout: 20_000 })
  expect(d.submits).toHaveLength(2)
  expect(d.submits[1].clientMutationId).toBe(d.submits[0].clientMutationId)
  expect(d.submits[1].answeredAt).toBe(d.submits[0].answeredAt)
  await d.ctx.close()
})

test('학습자: 해설 먼저 보기는 시도가 아니다 — 그 세션의 판단은 viewed_first 로 간다', async ({ browser }) => {
  const d = await device(browser)
  await d.page.goto(PRACTICE)
  const [popup] = await Promise.all([d.ctx.waitForEvent('page'), d.page.getByRole('link', { name: /해설 먼저 보기/ }).click()])
  await popup.waitForLoadState('networkidle').catch(() => null)
  await popup.close()
  // 새 탭의 쓰기도 가로채졌고(가짜 응답) 분석 이벤트 외 쓰기는 없다
  expect(d.writes.filter((w) => !w.includes('/api/analytics/event'))).toEqual([])
  expect(d.submits).toHaveLength(0)
  await expect(d.page.getByText(/해설을 먼저 봤어요/)).toBeVisible()
  await answer(d.page)
  await d.page.getByRole('button', { name: '맞춰 보기' }).click()
  await expect(d.page.getByText(/판단에는 넣지 않아요/)).toBeVisible({ timeout: 20_000 })
  expect(d.submits[0].helpLevel).toBe('viewed_first')
  // 판단 전 열람은 그 순간 별도 요청으로 남는다(같은 세션 · 판단보다 이르거나 같은 시각)
  expect(d.views).toHaveLength(1)
  expect(d.views[0].clientSessionId).toBe(d.submits[0].clientSessionId)
  expect(Date.parse(String(d.views[0].viewedAt))).toBeLessThanOrEqual(Date.parse(String(d.submits[0].answeredAt)))
  await d.ctx.close()
})

test('학습자: 판단을 보낸 뒤 연 해설은 도움 수준을 바꾸지 않고 별도 행동으로 간다(실패 뒤 재시도도 같은 세션 · 같은 id)', async ({ browser }) => {
  const d = await device(browser)
  d.failNext = 1
  await d.page.goto(PRACTICE)
  await answer(d.page)
  await d.page.getByRole('button', { name: '맞춰 보기' }).click()
  await expect(d.page.locator('[role=alert]:not(#__next-route-announcer__)')).toBeVisible() // Next 경로 알림판도 role=alert
  // 판단을 보낸 세션 — 링크는 「해설 먼저 보기」 가 아니다
  await expect(d.page.getByRole('link', { name: /해설 먼저 보기/ })).toHaveCount(0)
  const [popup] = await Promise.all([d.ctx.waitForEvent('page'), d.page.getByRole('link', { name: '해설 보기' }).first().click()])
  await popup.close()
  // 해설을 본 뒤에는 답을 바꿀 수 없다 — 같은 답 재전송만
  await expect(d.page.getByRole('button', { name: /^문장 3/ })).toBeDisabled()
  await expect(d.page.getByRole('button', { name: '1번', exact: true })).toBeDisabled()
  await d.page.getByRole('button', { name: '맞춰 보기' }).click()
  await expect(d.page.getByRole('status').filter({ hasText: '주장 문장을 찾았어요' })).toBeVisible({ timeout: 20_000 })
  // 실패한 제출 → 열람 순간의 별도 기록(같은 제출 본문 + 열람 시각) → 재시도 = 3건, 모두 같은 제출 id · 같은 답 · 같은 sec
  expect(d.submits).toHaveLength(3)
  expect(new Set(d.submits.map((x) => x.clientMutationId)).size).toBe(1)
  expect(new Set(d.submits.map((x) => JSON.stringify([x.claim, x.support, x.relation, x.option, x.confidence, x.sec, x.answeredAt]))).size).toBe(1)
  expect(d.submits.map((x) => x.helpLevel)).toEqual(['independent', 'independent', 'independent'])
  expect(d.submits[0].explanationViewedAt).toBeNull()
  expect(typeof d.submits[1].explanationViewedAt).toBe('string')
  expect(d.submits[2].explanationViewedAt).toBe(d.submits[1].explanationViewedAt)
  await d.ctx.close()
})

test('학습자: 판정 뒤 「며칠 뒤 다시 보기」 — 서버가 확정한 날짜를 보인다(요청 날짜로 덮지 않음 · E11)', async ({ browser }) => {
  const d = await device(browser)
  await d.page.goto(PRACTICE)
  await answer(d.page)
  await d.page.getByRole('button', { name: '맞춰 보기' }).click()
  await expect(d.page.getByRole('status').filter({ hasText: '주장 문장을 찾았어요' })).toBeVisible({ timeout: 20_000 })
  await d.page.getByRole('button', { name: '7일 뒤 다시 보기' }).click()
  await expect(d.page.getByText('2026-10-12(이미 잡혀 있던 날)', { exact: false })).toBeVisible()
  expect(d.reviews).toHaveLength(1)
  expect(d.reviews[0]).toMatchObject({ days: 7, clientSessionId: d.submits[0].clientSessionId })
  expect(typeof d.reviews[0].finishedAt).toBe('string')
  await d.ctx.close()
})

test('대체 문항은 2022#20과 다른 실제 정답으로 클릭 · 채점 · 응답이 결속된다', async ({ browser }) => {
  const d = await device(browser)
  await d.page.goto(PRACTICE)
  const values = await d.page.locator('select option').evaluateAll((es) => es.map((e) => (e as HTMLOptionElement).value))
  const originalKey = keyFromAnnotation(annotationFor('2022#20')!)
  const alternative = values.find((id) => JSON.stringify(fixtureFor(id).key) !== JSON.stringify(originalKey))
  expect(alternative, 'a released item with a different actual claim/support/relation key').toBeTruthy()
  await d.page.locator('select').selectOption(alternative!)
  const key = await answer(d.page)
  await d.page.getByRole('button', { name: '맞춰 보기' }).click()
  await expect(d.page.getByText(`주장: 문장 ${key.claim + 1} · 근거: 문장 ${key.support.map((s) => s + 1).join(', ')} (맞음)`, { exact: false })).toBeVisible()
  expect(d.submits).toHaveLength(1)
  expect(d.submits[0]).toMatchObject({ itemId: alternative, claim: key.claim, support: key.support, relation: key.relationProbe!.relation })
  await d.ctx.close()
})

test('어느 컨텍스트에서도 DB 쓰기가 새지 않았다(분석 이벤트 제외 가로챈 쓰기 0)', async ({ browser }) => {
  const d = await device(browser)
  await d.page.goto(PRACTICE)
  await d.page.waitForLoadState('networkidle')
  expect(d.writes.filter((w) => !w.includes('/api/analytics/event'))).toEqual([])
  await d.ctx.close()
})
