// apps/web/tests/e2e-isolated/fast-worksheet.isolated.spec.ts
//
// 단계 3 FAST — 실제 FastWorksheet 화면 · 실제 앱 CSS(admin 스킨)를 PC Chromium 1440px 에서:
// 묶음 열기 → 순서 바꾸기 · 발문 수정 → 옛 검수 거절 → 검수 요청 내려받기 → 신규 검수 가져오기 → 미리보기(sandbox) → 내려받기 → 원천 실패 · 재시도.
// API 는 page.route 가 받되 응답은 **실제** evaluateFast/fastView/fastFiles 가 만든다(인증 · 원천 DB 조회는 route.test.ts).
//
//   pnpm --dir apps/web exec tsx scripts/build-fast-worksheet-harness.mts
//   pnpm --dir apps/web exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/fast-worksheet.isolated.spec.ts
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

const WEB = path.resolve(__dirname, '../..')
/** 실제 판정기 — scripts/fast-worksheet-harness-eval.mts(tsx 자식 프로세스) */
function evaluate(action: string, bundle: unknown, current: unknown): { status: number; body: unknown; target?: unknown } {
  const r = spawnSync(process.execPath, [path.resolve(WEB, '../../node_modules/tsx/dist/cli.mjs'), '--tsconfig', 'tsconfig.json', 'scripts/fast-worksheet-harness-eval.mts'], { cwd: WEB, input: JSON.stringify({ action, bundle, current }), encoding: 'utf8', maxBuffer: 1 << 26 })
  if (r.status !== 0) throw new Error(r.stderr)
  return JSON.parse(r.stdout)
}
const TEACHER_EDIT = { order: ['cm-topic-01', 'cm-main-point-01', 'cm-title-01'], items: { 'cm-main-point-01': { stem: '다음 글의 중심 생각으로 가장 적절한 것은?' } }, editor: { kind: 'human', agent: 'admin-ui', session: null, note: '관리자 화면 편집' } }

const HTML = path.resolve(__dirname, '../fixtures/fast-worksheet-harness.html')
const BUNDLE = path.resolve(__dirname, '../fixtures/fast-harness-bundle.json')
const SHOTS = path.resolve(__dirname, '../../playwright-auth/shots-fast')
const ORIGIN = 'http://harness.local'

test.use({ viewport: { width: 1440, height: 1000 } })

test('FAST — 편집 · 옛 검수 거절 · 신규 검수 · 미리보기 · 내려받기 · 실패 재시도', async ({ page }, info) => {
  expect(fs.existsSync(HTML), 'harness not built — run scripts/build-fast-worksheet-harness.mts').toBe(true)
  fs.mkdirSync(SHOTS, { recursive: true })
  const bundle = JSON.parse(fs.readFileSync(BUNDLE, 'utf8'))
  const current = bundle.source_snapshot
  let failNext = false
  const calls: string[] = []
  page.on('dialog', (d) => void d.dismiss())
  await page.route(`${ORIGIN}/`, (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync(HTML, 'utf8') }))
  await page.route(`${ORIGIN}/api/admin/csat/fast-worksheet`, (r) => {
    const { action, bundle: b } = r.request().postDataJSON()
    calls.push(action)
    if (failNext) {
      failNext = false
      return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ status: 'source_unavailable', error: '원천 현재 행을 읽지 못했습니다.' }) })
    }
    const out = evaluate(action, b, current)
    return r.fulfill({ status: out.status, contentType: 'application/json', body: JSON.stringify(out.body) })
  })
  await page.goto(`${ORIGIN}/`)
  await expect(page.getByRole('heading', { name: '빠른 학습지 (FAST)' })).toBeVisible()
  await expect(page.getByText('지원 범위: 한 원천의 지도 연습')).toBeVisible()

  // 1) 묶음 열기
  const bundlePath = info.outputPath('bundle.json')
  fs.writeFileSync(bundlePath, JSON.stringify(bundle))
  await page.locator('input[type=file]').first().setInputFiles(bundlePath)
  await expect(page.locator('[data-review-status="review_required"]')).toBeVisible()
  const ids = () => page.locator('article[data-item-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-item-id')))
  expect(await ids()).toEqual(['cm-main-point-01', 'cm-title-01', 'cm-topic-01'])

  // 2) Codex 교사 선택과 같은 편집: topic → main_point → title, 요지 발문 수정
  await page.getByRole('button', { name: 'cm-topic-01 위로' }).click()
  await expect.poll(ids).toEqual(['cm-main-point-01', 'cm-topic-01', 'cm-title-01'])
  await page.getByRole('button', { name: 'cm-topic-01 위로' }).click()
  await expect.poll(ids).toEqual(['cm-topic-01', 'cm-main-point-01', 'cm-title-01'])
  const stem = page.locator('article[data-item-id="cm-main-point-01"] input').first()
  await stem.fill('다음 글의 중심 생각으로 가장 적절한 것은?')
  await stem.blur()
  await expect(page.getByText('편집 1곳 · 순서 바뀜')).toBeVisible()
  await page.screenshot({ path: path.join(SHOTS, '01-edited-review-required.png'), fullPage: true })

  // 3) 검수 요청 내려받기(검수 전에는 학습지를 주지 않는다)
  const downloads: string[] = []
  page.on('download', (d) => downloads.push(d.suggestedFilename()))
  await page.getByRole('button', { name: '검수 요청 내려받기(새 세션용)' }).click()
  await expect.poll(() => downloads.slice().sort()).toEqual(['edited-output.json', 'review-request.json'])

  // 4) 옛 바이트 검수(편집 전 target) → 거절
  const state = { target: evaluate('preview', { ...bundle, edit: TEACHER_EDIT }, current).target }
  const baseState = { target: evaluate('preview', bundle, current).target }
  const EV = ['근거 구절과 선지를 원문에 대조했다 (harness)']
  const axes = { A: { state: 'unknown', evidence: [] }, B: { state: 'pass', evidence: EV }, C: { state: 'pass', evidence: EV }, D: { state: 'pass', evidence: EV }, F: { state: 'unknown', evidence: [] }, H: { state: 'pass', evidence: EV } }
  const review = (target: unknown) => ({ schema: 'vf.dcp-ai-review/1', kind: 'ai', reviewer: { model: 'claude', session: 'harness-fresh-session', role: 'independent_fast_content_reviewer' }, target, conclusion: 'pass', axes, evidence: [], limitations: ['harness review fixture — not an actual content review'] })
  const oldPath = info.outputPath('old-review.json')
  fs.writeFileSync(oldPath, JSON.stringify(review(baseState.target)))
  await page.locator('input[type=file]').nth(1).setInputFiles(oldPath)
  await expect(page.locator('[data-review-status="review_rejected"]')).toContainText('review_target_mismatch')
  await expect(page.getByTitle('학생용 문제지')).toHaveCount(0)

  // 5) 실패 → 같은 묶음 재시도
  failNext = true
  await page.getByRole('button', { name: '다시 판정' }).click()
  await expect(page.getByRole('alert')).toContainText('source_unavailable')
  await page.getByRole('button', { name: '같은 묶음으로 다시 시도' }).click()
  await expect(page.locator('[data-review-status="review_rejected"]')).toBeVisible()

  // 6) 새 바이트 검수 → 통과 · sandbox 미리보기 · 학생용에는 정답 없음
  const freshPath = info.outputPath('fresh-review.json')
  fs.writeFileSync(freshPath, JSON.stringify(review(state.target)))
  await page.locator('input[type=file]').nth(1).setInputFiles(freshPath)
  await expect(page.locator('[data-review-status="reviewed"]')).toContainText('보류 축 A, F')
  const student = page.getByTitle('학생용 문제지')
  await expect(student).toHaveAttribute('sandbox', '')
  await expect(page.frameLocator('iframe[title="학생용 문제지"]').locator('h3').nth(1)).toHaveText('2. 다음 글의 중심 생각으로 가장 적절한 것은?')
  await expect(page.frameLocator('iframe[title="학생용 문제지"]').locator('body')).not.toContainText('정답')
  await expect(page.frameLocator('iframe[title="교사용 해설지"]').locator('body')).toContainText('정답 1번')
  await page.screenshot({ path: path.join(SHOTS, '02-reviewed-preview.png'), fullPage: true })

  downloads.length = 0
  await page.getByRole('button', { name: '문제지 · 해설지 · manifest 내려받기' }).click()
  await expect.poll(() => downloads.slice().sort()).toEqual(['edited-output.json', 'manifest.json', 'review-binding.json', 'review-request.json', 'student.html', 'teacher.html'])
  expect(calls.filter((c) => c === 'export')).toHaveLength(2)
})
