// apps/web/tests/e2e/40-csat-practice.spec.ts
//
// **/csat/practice 「주장과 근거」 연습 — 이식 회귀(docs/csat-learner/PRACTICE_PORT.md).**
// 이식 원천: 동결 feat/knowledge-vnext 의 40-knowledge-practice.spec.ts(설계 · 배포 표는 폐기돼 경로를 정본으로 바꿨다).
//
// ⚠️ DB 에 쓰지 않는다(G1 incident 재발 방지). 로그인 단계를 포함한 **모든 브라우저 컨텍스트**에서
//    분석 이벤트 · 그 밖의 쓰기 요청을 가로채 기록만 한다. 제출 API 는 이 파일 안의 **가짜 서버**가 받는다 —
//    채점은 실제 정본 함수(gradePractice + gradeClaimSupport)로 한다. 화면이 읽는 것(문항 풀 · 내 기록)은 실제 서버 읽기다.
// 합성 학습자 검증이다 — 학습 효과를 말하지 않는다.
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

import { annotationFor, gradeClaimSupport } from '../../src/lib/knowledge/claim-support'
import { gradePractice, keyFromAnnotation, practiceFeedback, type PracticeAnswer } from '../../src/lib/knowledge/practice'

const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password:
    process.env.PLAYWRIGHT_RUNTIME_PASSWORD ??
    (() => {
      throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local')
    })(),
}
// 2026-10-10: 주석 문항이 1 → 9개(2026-10-09 적용 확대)가 되어 추천 첫 문항이 바뀌었다 — 이 스펙의 답 키는 2022#20 이라 그 문항을 지정해 연다
const PRACTICE = '/csat/practice/claim-support?item=2022%2320'
const ITEM = '2022#20'
const KEY = keyFromAnnotation(annotationFor(ITEM)!)

let storage: Awaited<ReturnType<BrowserContext['storageState']>>

test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

/** 쓰기로 보이는 요청 — GET/HEAD 가 아닌 것과 PostgREST 쓰기 */
const isWrite = (method: string) => method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext()
  // 로그인 화면 · 로그인 뒤 첫 화면도 분석 이벤트를 보낸다 — 여기서도 가로챈다. 인증 요청만 통과시킨다
  await ctx.route('**/api/analytics/event', (route) => route.fulfill({ json: { ok: true } }))
  await ctx.route('**/rest/v1/**', (route) => (isWrite(route.request().method()) ? route.fulfill({ status: 204, body: '' }) : route.continue()))
  const page = await ctx.newPage()
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', USER.email)
  await page.fill('input[type="password"]', USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
  storage = await ctx.storageState()
  await ctx.close()
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
  const ctx = await browser.newContext({ storageState: storage, viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
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
      const grade = gradePractice(gradeClaimSupport, KEY, answer)
      return route.fulfill({ json: { ok: true, outcome, feedback: practiceFeedback(KEY, grade, answer.option === null ? null : answer.option === 5, 'practice', body.helpLevel as 'independent') } })
    }
    probe.writes.push(`${req.method()} ${url} ${(req.postData() ?? "").slice(0, 300)}`)
    return route.fulfill(url.includes('/api/analytics/event') ? { json: { ok: true } } : { status: 204, body: '' })
  })
  return probe
}

/** 주장 문장 2 · 근거 4 · 5 · 관계 「이유」 · 선지 5 · 확신 「확실해요」 — 2022#20 의 정답 */
async function answer(page: Page) {
  await page.getByRole('button', { name: /^문장 2/ }).click()
  await page.getByRole('button', { name: /^문장 4/ }).click()
  await page.getByRole('button', { name: /^문장 5/ }).click()
  await page.getByRole('button', { name: /이유 · 조건을 대며/ }).click()
  await page.getByRole('button', { name: '5번', exact: true }).click()
  await page.getByRole('button', { name: '확실해요' }).click()
}

test('학습자: 검증 전 문항은 안 보이고, 풀이 → 판정(정답 키는 응답 뒤에만) · 중복 클릭은 한 번 전송', async ({ browser }) => {
  const d = await device(browser)
  await d.page.goto(PRACTICE)
  await expect(d.page.getByRole('heading', { level: 1, name: '주장 문장 먼저 찾기' })).toBeVisible()
  // 학습자에게 골격(검증 전) 문항은 없다
  await expect(d.page.locator('option', { hasText: '검증 전' })).toHaveCount(0)
  await expect(d.page.getByText('주장: 문장')).toHaveCount(0)
  await answer(d.page)
  await d.page.getByRole('button', { name: '맞춰 보기' }).dblclick()
  await expect(d.page.getByRole('status').filter({ hasText: '주장 문장을 찾았어요' })).toBeVisible({ timeout: 20_000 })
  await expect(d.page.getByText(/주장: 문장 2 · 근거: 문장 4, 5 \(맞음\)/)).toBeVisible()
  expect(d.submits).toHaveLength(1)
  const s = d.submits[0]
  expect(s).toMatchObject({ itemId: ITEM, claim: 1, support: [3, 4], relation: 'reason', option: 5, confidence: 3, helpLevel: 'independent', preview: false })
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

test('어느 컨텍스트에서도 DB 쓰기가 새지 않았다(분석 이벤트 제외 가로챈 쓰기 0)', async ({ browser }) => {
  const d = await device(browser)
  await d.page.goto(PRACTICE)
  await d.page.waitForLoadState('networkidle')
  expect(d.writes.filter((w) => !w.includes('/api/analytics/event'))).toEqual([])
  await d.ctx.close()
})
