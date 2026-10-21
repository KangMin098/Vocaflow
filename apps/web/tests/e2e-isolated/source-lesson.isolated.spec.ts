// apps/web/tests/e2e-isolated/source-lesson.isolated.spec.ts
//
// 단계 2B — 실제 제품 컴포넌트(FactoryDcpRunner → DcpPlayer + SourceLessonPanel)와 실제 앱 CSS · CsatShell root 토큰으로 PC Chromium(1440px)에서
// 요지(전략 → 첫 답 → 시범 → 비교 설명 저장 실패 → 같은 키 재시도) → 제목(cue) → 주제(새 단서 없음 · 절차) → Workspace 복귀를 실행하고 캡처한다.
// 서버 · 로그인 · 공유 DB 없음. 하네스 HTML 은 scripts/build-factory-dcp-harness.mts 가 굽는다(#lesson=… 로 단계 선택).
// 대역: POST …/attempt · GET/POST …/lesson 응답은 page.route — 실제 SQL 판정(순서 · 멱등 · 소유 · 철회 · 근거 아님)은 dcp-learning.pglite.test.ts.
//   GET 대역의 시범 본문은 교수 자료 파일 그대로(서버 lessonModel 과 같은 값).
//
//   pnpm --dir apps/web exec tsx scripts/build-factory-dcp-harness.mts
//   pnpm --dir apps/web exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/source-lesson.isolated.spec.ts
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

const HTML = path.resolve(__dirname, '../fixtures/factory-dcp-harness.html')
const LESSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/lib/knowledge/authored/source-lesson-title-route.v3.json'), 'utf8')) as { model: unknown[] }
const SHOTS = path.resolve(__dirname, '../../playwright-auth/shots-2b')
const ORIGIN = 'http://harness.local'
const D = '00000000-0000-4000-8000-00000000dd01'
const NEXT = '00000000-0000-4000-8000-00000000dd02'
const RECEIPT = '00000000-0000-4000-8000-00000000ee01'

async function mount(page: Page, step: 'main_point' | 'title' | 'topic', reflect: (body: Record<string, unknown>, n: number) => { status: number; json: unknown }) {
  expect(fs.existsSync(HTML), 'harness not built — run scripts/build-factory-dcp-harness.mts first').toBe(true)
  const seen = { gets: 0, posts: [] as Record<string, unknown>[] }
  await page.route(`${ORIGIN}/`, (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync(HTML, 'utf8') }))
  const correctKey = { main_point: 2, title: 4, topic: 1 }[step]
  await page.route(`${ORIGIN}/api/csat/factory/${D}/attempt`, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: {
    receiptId: RECEIPT, deliveryId: D, correct: r.request().postDataJSON().choice === correctKey, csatAttemptId: '00000000-0000-4000-8000-00000000ee02', answerKey: { answer: correctKey }, evidence: false,
    nonEvidenceReason: 'role_not_evidence', replayed: false } }) }))
  await page.route(`${ORIGIN}/api/csat/factory/${D}/lesson`, async (r) => {
    if (r.request().method() === 'GET') {
      seen.gets++
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({
        progress: { deliveryId: D, workspaceId: '00000000-0000-4000-8000-0000000000aa', steps: [
          { type: step, deliveryId: D, state: 'ok', attempted: true, reflected: seen.posts.length > 0 },
          ...(step === 'topic' ? [] : [{ type: step === 'main_point' ? 'title' : 'topic', deliveryId: NEXT, state: 'ok', attempted: false, reflected: false }])] },
        model: step === 'main_point' ? LESSON.model : null }) })
    }
    const b = r.request().postDataJSON() as Record<string, unknown>
    seen.posts.push(b)
    const out = reflect(b, seen.posts.length)
    return r.fulfill({ status: out.status, contentType: 'application/json', body: JSON.stringify(out.json) })
  })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${ORIGIN}/#lesson=${step}`)
  return { seen, errors }
}
const ok = (step: string, support: string) => ({ status: 200, json: {
  result: { reflectionId: '00000000-0000-4000-8000-00000000ff01', attemptId: RECEIPT, deliveryId: D, step, recorded: true, evidence: false, replayed: false },
  feedback: { support, claim: 'accepted', note: support === 'sufficient' ? '고른 근거만으로 판단을 받칠 수 있어요. 다른 근거도 함께 써도 돼요.' : '이 근거가 판단과 어떻게 이어지는지 한 번 더 살펴봐요 — 틀렸다는 뜻이 아니라 함께 검토할 근거예요.' } } })

async function answer(page: Page) {
  await page.getByRole('radio').nth(0).click()
  await page.getByRole('button', { name: '제출' }).click()
  await expect(page.getByTestId('source-lesson-panel')).toBeVisible()
}

test('요지 — 답변 전 전략만 · 저장된 첫 답 뒤 시범 · 비교 설명 저장 실패 → 같은 키 재시도 → 다음 단계', async ({ page }) => {
  fs.mkdirSync(SHOTS, { recursive: true })
  const { seen, errors } = await mount(page, 'main_point', (_b, n) => {
    if (n === 1) return { status: 502, json: { code: 'query_failed' } }
    if (n === 2) return { status: 200, json: { result: { recorded: true, evidence: false, attemptId: RECEIPT, step: 'main_point' }, feedback: { support: 'sufficient', claim: 'accepted', note: '불완전한 영수증' } } }
    return ok('main_point', 'sufficient')
  })
  await expect(page.getByTestId('lesson-before')).toHaveAttribute('data-kind', 'strategy')
  await expect(page.getByTestId('source-lesson-model')).toHaveCount(0)
  await expect(page.getByText('사례와 판단을 가르기')).toHaveCount(0)
  expect(seen.gets).toBe(0)
  await page.screenshot({ path: path.join(SHOTS, '01-main-before.png'), fullPage: true })

  await answer(page)
  await expect(page.getByTestId('lesson-submitted-answer')).toContainText('1번')
  await expect(page.getByTestId('source-lesson-model')).toContainText('사례와 판단을 가르기')
  await page.getByTestId('claim-6').check()
  await page.getByTestId('support-3').check()
  await page.getByTestId('reflect-relation').fill('처음 단어가 길이 되어 시선을 이끈다는 설명이, 제목이 작품의 일부라는 판단을 받친다.')
  await page.getByTestId('reflect-comparison').fill('나는 하늘과 구석 사례에 머물렀다. 시범은 사례가 바뀌어도 남는 제목의 기능을 찾았다.')
  await page.getByTestId('reflect-save').click()
  await expect(page.getByTestId('reflect-error')).toContainText('쓴 설명은 그대로')
  await expect(page.getByTestId('reflect-comparison')).toHaveValue(/시범은 사례가/)
  await expect(page.getByTestId('lesson-next')).toHaveCount(0)
  await page.screenshot({ path: path.join(SHOTS, '02-main-save-failed.png'), fullPage: true })

  await page.getByTestId('reflect-save').click()
  await expect(page.getByTestId('reflect-error')).toBeVisible()
  await expect(page.getByTestId('lesson-next')).toHaveCount(0)
  await page.getByTestId('reflect-save').click()
  await expect(page.getByTestId('reflect-saved')).toHaveAttribute('data-support', 'sufficient')
  expect(seen.posts).toHaveLength(3)
  expect(seen.posts[1]).toEqual(seen.posts[0])
  expect(seen.posts[2]).toEqual(seen.posts[0])
  expect(Object.keys(seen.posts[0]!).sort()).toEqual(['attemptId', 'body', 'mutationId'])
  expect(seen.posts[0]!.attemptId).toBe(RECEIPT)
  expect(seen.posts[0]!.body).toMatchObject({ step: 'main_point', claim: 6, support: [3], procedure: null })
  await expect(page.getByTestId('lesson-next')).toHaveAttribute('href', `/csat/factory/${NEXT}?from=map`)
  await expect(page.getByTestId('reflect-saved')).toContainText('실력 향상의 근거로 세지 않아요')
  await page.screenshot({ path: path.join(SHOTS, '03-main-saved.png'), fullPage: true })
  const ev = await page.evaluate(() => (window as unknown as { __vfEvents?: { name: string }[] }).__vfEvents ?? [])
  expect(ev.filter((e) => e.name === 'csat_source_lesson_reflected')).toEqual([{ name: 'csat_source_lesson_reflected', props: { step: 'main_point', support: 'sufficient', replayed: false } }])
  expect(errors).toEqual([])
})

test('제목 — cue 만(시범 없음) · 목록 밖 근거는 오답이 아닌 함께 검토', async ({ page }) => {
  const { seen, errors } = await mount(page, 'title', () => ok('title', 'discussable'))
  await expect(page.getByTestId('lesson-before')).toHaveAttribute('data-kind', 'cue')
  await answer(page)
  await expect(page.getByTestId('source-lesson-model')).toHaveCount(0)
  await page.getByTestId('support-0').check()
  await page.getByTestId('reflect-relation').fill('그림 사례가 길이라는 비유를 보여 준다.')
  await page.getByTestId('reflect-save').click()
  await expect(page.getByTestId('reflect-saved')).toContainText('틀렸다는 뜻이 아니라')
  expect(seen.posts[0]!.body).toMatchObject({ step: 'title', claim: null, comparison: null, procedure: null })
  await page.screenshot({ path: path.join(SHOTS, '04-title-saved.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('주제 — 새 단서 없음 · 자기 절차 필수 · 저장 뒤 Workspace(혼자 확인)로', async ({ page }) => {
  const { errors } = await mount(page, 'topic', () => ok('topic', 'sufficient'))
  await expect(page.getByTestId('lesson-before')).toHaveCount(0)
  await answer(page)
  await page.getByTestId('claim-7').check()
  await page.getByTestId('support-1').check()
  await page.getByTestId('support-5').check()
  await page.getByTestId('reflect-relation').fill('구석을 보는 사례와 노래 · 이야기로의 확장이 제목의 기능을 받친다.')
  await expect(page.getByTestId('reflect-save')).toBeDisabled()
  await page.getByTestId('reflect-procedure').fill('사례와 설명을 가르고, 설명을 필자 판단으로 압축한 뒤 근거로 확인한다.')
  await page.getByTestId('reflect-save').click()
  await expect(page.getByTestId('lesson-return')).toHaveAttribute('href', '/csat/diagnosis?tab=map&view=full')
  await page.screenshot({ path: path.join(SHOTS, '05-topic-saved.png'), fullPage: true })
  expect(errors).toEqual([])
})
