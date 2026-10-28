// apps/web/tests/e2e-isolated/factory-dcp-runner.isolated.spec.ts
//
// 단계 1D D5 — 실제 제품 컴포넌트(FactoryDcpRunner → DcpPlayer → DcpChoiceItem)와 실제 앱 CSS 를 PC Chromium(1440px)에서
// 읽기 → 선택 → 저장 실패 → 같은 키로 재시도 → 제출 결과 → Workspace 복귀 링크까지 실행하고 단계마다 캡처한다.
// 서버 · 로그인 · 공유 DB 없음. 하네스 HTML 은 scripts/build-factory-dcp-harness.mts 가 굽는다(대역 목록은 그 파일 머리말).
// 제출 응답은 page.route 대역 — 실제 SQL 채점 · 결속 · 멱등은 dcp-learning.pglite.test.ts 가 본다.
//
//   pnpm --dir apps/web exec tsx scripts/build-factory-dcp-harness.mts
//   pnpm --dir apps/web exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/factory-dcp-runner.isolated.spec.ts
import fs from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

const HTML = path.resolve(__dirname, '../fixtures/factory-dcp-harness.html')
const SHOTS = path.resolve(__dirname, '../../playwright-auth/shots-1d')
const ORIGIN = 'http://harness.local'
const DELIVERY = '00000000-0000-4000-8000-00000000dd01'

test('공장 DCP 연습 — 읽기 · 선택 · 저장 실패 재시도(같은 키) · 결과 · 복귀', async ({ page }) => {
  // 하네스가 없으면 skip 이 아니라 실패 — skip 을 통과로 읽지 않게 한다
  expect(fs.existsSync(HTML), 'harness not built — run scripts/build-factory-dcp-harness.mts first').toBe(true)
  fs.mkdirSync(SHOTS, { recursive: true })
  const posts: { choice: number; mutationId: string }[] = []
  await page.route(`${ORIGIN}/`, (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync(HTML, 'utf8') }))
  await page.route(`${ORIGIN}/api/csat/factory/${DELIVERY}/attempt`, async (r) => {
    const body = r.request().postDataJSON() as { choice: number; mutationId: string }
    expect(Object.keys(body).sort()).toEqual(['choice', 'mutationId'])
    posts.push(body)
    if (posts.length === 1) return r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'x', code: 'query_failed' }) })
    // 모양이 다른 200 — 정오만 있고 영수증 · 실제 채점 시도 id 가 없다. 완료로 올리면 안 된다
    if (posts.length === 2) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: { correct: true } }) })
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: {
      receiptId: '00000000-0000-4000-8000-00000000ee01', deliveryId: DELIVERY, correct: true, csatAttemptId: '00000000-0000-4000-8000-00000000ee02',
      answerKey: { explanation_ko: '제목이 시선의 출발점을 정하고 작품의 일부라는 결론이 요지다.' }, evidence: false, nonEvidenceReason: 'role_not_evidence', replayed: posts.length > 2 } }) })
  })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${ORIGIN}/`)

  // 읽기 — 지문 · 묻는 말 · 다섯 선택지 · 연습 경계 문구. 답변 전 정답 · 해설 없음
  await expect(page.getByTestId('factory-dcp-runner')).toBeVisible()
  await expect(page.getByText('다음 글의 요지로 가장 적절한 것은?')).toBeVisible()
  await expect(page.getByRole('radio')).toHaveCount(5)
  await expect(page.getByTestId('factory-dcp-note')).toContainText('연습 기록')
  await expect(page.getByText('정답', { exact: false })).toHaveCount(0)
  await page.screenshot({ path: path.join(SHOTS, '01-read.png'), fullPage: true })

  // 선택 → 키보드 focus 가 보이는지 · 터치 타깃 44px
  const second = page.getByRole('radio').nth(1)
  await second.focus()
  await page.keyboard.press('Space')
  await expect(second).toHaveAttribute('aria-checked', 'true')
  const box = await second.boundingBox()
  expect(box && box.height).toBeGreaterThanOrEqual(44)
  const submit = page.getByRole('button', { name: '제출' })
  await submit.click()

  // 저장 실패 — 오답이 아니라 「못 했다」 · 고른 답 유지
  await expect(page.getByRole('alert')).toContainText('채점을 못 했어요')
  await expect(page.getByText('아쉬워요')).toHaveCount(0)
  await expect(second).toHaveAttribute('aria-checked', 'true')
  await page.screenshot({ path: path.join(SHOTS, '02-save-failed.png'), fullPage: true })

  // 재시도 ① — 모양이 다른 200 은 여전히 「못 했다」 · 고른 답 유지
  await submit.click()
  await expect(page.getByRole('alert')).toContainText('채점을 못 했어요')
  await expect(page.getByText('정확해요')).toHaveCount(0)
  await expect(second).toHaveAttribute('aria-checked', 'true')

  // 재시도 ② — 같은 응답은 같은 mutationId(UUID v4)
  await submit.click()
  await expect(page.getByText('정확해요')).toBeVisible()
  expect(posts).toHaveLength(3)
  expect(posts[1]).toEqual(posts[0])
  expect(posts[2]).toEqual(posts[0])
  expect(posts[0]!.mutationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  expect(posts[0]!.choice).toBe(2)
  await page.screenshot({ path: path.join(SHOTS, '03-graded.png'), fullPage: true })

  // 마치기 → Workspace 복귀 링크
  await page.getByRole('button', { name: '마치기' }).click()
  const back = page.getByRole('link', { name: 'Workspace 로 돌아가기' })
  await expect(back).toHaveAttribute('href', '/csat/diagnosis?tab=map&view=full')
  // 완료 문구 — 연습 기록 경계 · 향상 주장(기본 격려) 없음 · 다음 할 일은 Workspace
  const done = page.getByTestId('dcp-done-body')
  await expect(done).toContainText('연습 기록')
  await expect(done).toContainText('Workspace 의 다음 할 일')
  await expect(done).not.toContainText('꾸준함이 실력이 돼요')
  await page.screenshot({ path: path.join(SHOTS, '04-done.png'), fullPage: true })
  // 복귀 클릭 계측 — 이동은 막고 이벤트만 본다
  await page.evaluate(() => document.addEventListener('click', (e) => e.preventDefault()))
  await back.click()
  const events = await page.evaluate(() => (window as unknown as { __vfEvents?: unknown[] }).__vfEvents ?? [])
  expect(events).toEqual([
    { name: 'csat_factory_dcp_opened', props: { type: 'main_point', attempts: 0 } },
    { name: 'csat_factory_dcp_submitted', props: { type: 'main_point', correct: true, replayed: true } },
    { name: 'csat_factory_dcp_returned', props: { finished: true } },
  ])
  // 속성은 숫자 · 불리언 · 닫힌 열거형만 — id · 본문 없음
  expect(JSON.stringify(events)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/)
  expect(errors).toEqual([])
})
