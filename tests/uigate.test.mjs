// tests/uigate.test.mjs — UI Quality Gate: 화면 설계 계약 · UI 증거 형식 · 완료 게이트(SKIP≠PASS · 객관 결함 · 커밋 결속)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isUiPath, touchesUi, uiDesignMissing, validateUiEvidence, uiGateMissing, UI_CHECKS, UI_DESIGN_FIELDS } from '../lib/uigate.mjs'
import { approveDesign } from '../lib/usergoals.mjs'
import { goalMetrics } from '../lib/perf.mjs'

const allPass = () => Object.fromEntries(Object.keys(UI_CHECKS).map((k) => [k, 'pass']))
const fullUi = () => ({ ...Object.fromEntries(Object.keys(UI_DESIGN_FIELDS).map((k) => [k, `${k} 설명`])), screens: [{ screen: '지도', layout: '2열' }], ui_acceptance: ['카드 3개가 한 줄', '빈 상태 안내'] })

test('화면 경로 판정: 앱 라우트·컴포넌트·스타일·glob 은 화면, lib 로직은 아니다', () => {
  assert.equal(isUiPath('apps/web/src/components/csat/map/LearnerMap.tsx'), true)
  assert.equal(isUiPath('apps/web/src/components/csat/diagnosis/map/**'), true)
  assert.equal(isUiPath('apps/web/src/**'), true)
  assert.equal(isUiPath('apps/web/src/lib/csat/map/core.ts'), false)
  assert.equal(isUiPath('apps/web/src/lib/csat/map/**'), false)
  assert.equal(touchesUi(['apps/web/src/lib/x.ts', 'apps/web/src/app/(main)/csat/page.tsx']), true)
})

test('화면 설계 계약: 12항목 중 빠진 것을 정확히 짚고, 다 있으면 통과', () => {
  assert.equal(uiDesignMissing(null).length, 12)
  const ui = fullUi()
  assert.deepEqual(uiDesignMissing(ui), [])
  delete ui.states
  ui.ui_acceptance = []
  assert.deepEqual(uiDesignMissing(ui).sort(), ['states', 'ui_acceptance'].sort())
})

test('설계 승인: 화면 경로 설계는 ui_design 없이는 UI_DESIGN_REQUIRED, 화면 아닌 설계는 그대로', () => {
  const mk = (paths, ui) => ({
    userGoals: { goals: { 'UG-1': { ug_id: 'UG-1', status: 'OPEN', profile: 'BALANCED', designs: [{ version: 1, status: 'PROPOSED', source: 'chatgpt', acceptance: ['A'], allowed_paths: paths, ...(ui ? { ui_design: ui } : {}) }], history: [], rounds: [], approval: null } } },
    decisionLog: { entries: [{ decision_id: 'DL-1', status: 'APPROVED', approved_by: 'user', summary: 'UG-1@v1 승인' }] },
    taskQueue: { tasks: [] },
  })
  assert.throws(() => approveDesign(mk(['apps/web/src/components/map/**']), 'UG-1', { version: 1, decision_id: 'DL-1', by: 't' }), { code: 'UI_DESIGN_REQUIRED' })
  assert.doesNotThrow(() => approveDesign(mk(['apps/web/src/components/map/**'], fullUi()), 'UG-1', { version: 1, decision_id: 'DL-1', by: 't' }))
  assert.doesNotThrow(() => approveDesign(mk(['apps/web/src/lib/map/**']), 'UG-1', { version: 1, decision_id: 'DL-1', by: 't' }))
})

test('UI 증거: 형식 · 스크린샷 해시 · SKIP 을 pass 로 적으면 거부 · 완료 게이트(커밋 결속 · 객관 결함 · 제안은 통과)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-ui-'))
  fs.writeFileSync(path.join(dir, 'shot.png'), 'png')
  const t = { ui_gate: true, ui_acceptance: ['카드 3개가 한 줄'] }
  const ev = (o = {}) => ({ type: 'ui', result: 'pass', urls: ['http://localhost:3000/csat/map'], commit: 'abc1234', viewport: { width: 1440, height: 900 }, environment: 'next dev · chromium', screenshots: ['shot.png'], checks: allPass(), defects: [{ kind: 'suggestion', claim: '여백 조금 더', status: 'open' }], ui_acceptance_results: ['pass'], ...o })
  const ok = validateUiEvidence(ev(), t, { roots: [dir] })
  assert.deepEqual(ok.errs, [])
  assert.equal(ok.screenshots_sha256[0].sha256.length, 64)
  assert.match(validateUiEvidence(ev({ viewport: { width: 390, height: 800 } }), t, { roots: [dir] }).errs.join(), /PC/)
  assert.match(validateUiEvidence(ev({ screenshots: ['none.png'] }), t, { roots: [dir] }).errs.join(), /스크린샷/)
  assert.match(validateUiEvidence(ev({ checks: { ...allPass(), states: 'skip' } }), t, { roots: [dir] }).errs.join(), /result=pass 인데/)
  // 완료 게이트
  assert.match(uiGateMissing(t, [], 'abc1234').join(), /UI 증거\(type ui\) 없음/)
  assert.deepEqual(uiGateMissing(t, [ev()], 'abc1234ffff'), [], '주관적 제안(suggestion)은 완료를 막지 않는다')
  assert.match(uiGateMissing(t, [ev()], 'def5678').join(), /≠ 검증 커밋/)
  assert.match(uiGateMissing(t, [ev({ result: 'fail', defects: [{ kind: 'objective', claim: '버튼 잘림', status: 'open' }] })], 'abc1234').join(), /result=fail/)
  assert.match(uiGateMissing(t, [ev({ result: 'skip', checks: { ...allPass(), render: 'skip' } })], 'abc1234').join(), /result=skip/)
  assert.deepEqual(uiGateMissing({ ui_gate: false }, [], 'x'), [], '화면 아닌(또는 이전) 작업은 소급하지 않는다')
})

test('목표 속도 지표: 접수→승인 · Work 왕복 · 재작업 · 사용자 개입 · 미계측 항목은 null 이 아니라 사유', () => {
  const state = {
    userGoals: { goals: { 'UG-1': { ug_id: 'UG-1', status: 'OPEN', created_at: '2026-10-10T00:00:00Z', designs: [{ version: 1, created_at: '2026-10-10T01:00:00Z', approved_at: '2026-10-10T02:00:00Z' }], rounds: [{ recipient: 'chatgpt', response_status: 'APPLIED' }, { recipient: 'chatgpt', response_status: 'PENDING' }] } } },
    taskQueue: { tasks: [{ task_id: 'T-1', user_goal_id: 'UG-1', status: 'COMPLETED', design_version: 1, ui_gate: true, evidence: [{ type: 'ui' }], dispatch: { at: '2026-10-10T02:00:00Z', accepted_at: '2026-10-10T02:10:00Z' }, history: [{ at: '2026-10-10T02:10:00Z', to: 'IN_PROGRESS' }, { at: '2026-10-10T02:30:00Z', from: 'IN_PROGRESS', to: 'REVIEW' }, { at: '2026-10-10T02:40:00Z', from: 'REVIEW', to: 'READY' }, { at: '2026-10-10T02:50:00Z', from: 'READY', to: 'IN_PROGRESS' }, { at: '2026-10-10T03:00:00Z', from: 'IN_PROGRESS', to: 'REVIEW' }, { at: '2026-10-10T03:05:00Z', from: 'REVIEW', to: 'COMPLETED' }] }] },
    decisionLog: { entries: [{ recorded_via: 'tty', summary: 'UG-1 정책' }, { recorded_via: null, summary: 'UG-1 제안' }] },
  }
  const m = goalMetrics(state, 'UG-1', { now: '2026-10-10T04:00:00Z' })
  assert.equal(m.received_to_first_design_approval_ms, 2 * 3600_000)
  assert.deepEqual(m.work_round_trips, { requested: 2, answered: 1 })
  assert.equal(m.approval_wait_ms, 3600_000)
  assert.equal(m.tasks[0].dispatch_wait_ms, 600_000)
  assert.equal(m.tasks[0].review_wait_ms, 15 * 60_000)
  assert.equal(m.rework_total, 1)
  assert.equal(m.tasks[0].ui_evidence, 1)
  assert.equal(m.user_interventions, 1)
  assert.equal(m.goal_elapsed_ms, 4 * 3600_000)
  assert.ok(m.not_measured.pr_ci_merge)
})
