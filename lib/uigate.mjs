// lib/uigate.mjs
//
// UI Quality Gate(2026-10-10 사용자 최상위 요구 B — 화면 UX/UI·시각 디자인 품질). 규칙만 — AI·Codex 호출 없음.
//
//   ① 설계 계약: 화면 경로를 건드리는 설계는 ui_design(12항목)을 갖춰야 승인된다 — 없으면 임의 PASS 하지 않고 설계에서 보완
//   ② 작업 표시: 화면 경로를 건드리는 **새** 작업에 ui_gate(+ 설계의 UI 수용 기준 사본) — 기존 작업·완료 증거는 소급하지 않는다
//   ③ UI 증거(type 'ui'): 대상 URL · 기준 commit · viewport(PC) · 실행 환경 · 스크린샷(파일 해시) · 10개 검사 결과 · 결함(객관/제안)
//   ④ 완료: ui_gate 작업은 이번 run 의 UI 증거가 pass · 검증 커밋과 같은 commit · 10개 검사 전부 pass(SKIP≠PASS) ·
//          열린 객관 결함 0 · UI 수용 기준 전부 pass 여야 완료. 주관적 개선 제안(suggestion)은 완료를 막지 않는다(무한 수정 루프 방지)
//
// 증거를 만드는 도구는 제품 저장소의 기존 것을 쓴다(playwright e2e · `pnpm design:ref-compare` · scripts/design/capture-*.mjs).

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

/** 화면 경로 — 앱 라우트·컴포넌트·스타일·공개 이미지. 설계 경로가 glob 이어도 고정 접두로 판정 */
const UI_PREFIXES = ['apps/web/src/app/', 'apps/web/src/components/', 'apps/web/src/styles/', 'apps/web/public/', 'packages/design-tokens/', 'packages/ui-shared/']
const UI_EXT = /\.(tsx|jsx|css|scss)$/i
export function isUiPath(p) {
  const x = String(p).replace(/\\/g, '/').replace(/^\.\//, '')
  const fixed = x.split(/[*?[{]/)[0]
  if (UI_PREFIXES.some((u) => fixed.startsWith(u) || u.startsWith(fixed) && fixed.length > 'apps/web/'.length)) return true
  return !/[*?[{]/.test(x) && UI_EXT.test(x)
}
export const touchesUi = (paths = []) => paths.some(isUiPath)

/** Work 화면 설계 계약 12항목(요구 §2) — 키: 설명 */
export const UI_DESIGN_FIELDS = {
  users_and_purpose: '대상 사용자와 화면 목적',
  user_journey: '핵심 사용자 여정',
  information_architecture: '정보 구조·내비게이션',
  visual_direction: '시각 디자인 방향(기존 디자인 시스템·우수 화면 참고, 템플릿 반복 금지)',
  screens: '화면별 레이아웃·컴포넌트·상호작용',
  typography_color_spacing: '타이포그래피·색상·간격·대비',
  learner_fit: '학습자 수준·교육 목적 적합성',
  states: '로딩·빈 상태·오류·완료 상태',
  accessibility: '접근성·사용성',
  implementation_scope: '구현 허용 범위',
  ui_acceptance: 'UI·디자인 수용 기준(검증 가능한 문장 배열)',
  browser_verification: '실제 브라우저 검증 방법(URL·viewport·도구)',
}
export function uiDesignMissing(ui) {
  if (!ui || typeof ui !== 'object') return Object.keys(UI_DESIGN_FIELDS)
  const filled = (v) => (Array.isArray(v) ? v.length > 0 && v.every((x) => (typeof x === 'string' ? x.trim() : x && typeof x === 'object')) : typeof v === 'string' ? v.trim().length > 0 : v && typeof v === 'object' && Object.keys(v).length > 0)
  const miss = Object.keys(UI_DESIGN_FIELDS).filter((k) => !filled(ui[k]))
  if (!miss.includes('ui_acceptance') && !(Array.isArray(ui.ui_acceptance) && ui.ui_acceptance.every((a) => typeof a === 'string' && a.trim()))) miss.push('ui_acceptance(문자열 배열)')
  return miss
}

/** UI Quality Gate 10개 검사(요구 §4) */
export const UI_CHECKS = {
  render: '해당 페이지 정상 렌더링',
  layout_pc: 'PC 목표 해상도 레이아웃',
  readability_hierarchy: '콘텐츠 가독성·시각적 위계',
  design_system: '디자인 시스템 일관성',
  journey_interaction: '사용자 여정·주요 상호작용',
  states: '로딩·빈 상태·오류 상태',
  accessibility: '접근성 기본 요건',
  navigation_progress: '화면 간 이동·학습 진행 연결',
  visual_regression: '디자인 회귀·시각적 결함',
  design_acceptance: 'Work 설계 UI 수용 기준 충족',
}
export const PC_MIN_WIDTH = 1280

const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')

/** type 'ui' 증거 형식 검사 — 통과하면 스크린샷 해시를 돌려준다(기록 시점 무결성) */
export function validateUiEvidence(ev, t, { roots = [] } = {}) {
  const errs = []
  const urls = Array.isArray(ev.urls) ? ev.urls : ev.url ? [ev.url] : []
  if (!urls.length || !urls.every((u) => /^https?:\/\//.test(String(u)))) errs.push('urls(대상 URL 배열, http/https)')
  if (!/^[0-9a-f]{7,40}$/.test(String(ev.commit || ''))) errs.push('commit(기준 커밋 sha — UI 증거는 필수)')
  const vw = Number(ev.viewport?.width)
  if (!(vw >= PC_MIN_WIDTH) || !(Number(ev.viewport?.height) > 0)) errs.push(`viewport {width ≥ ${PC_MIN_WIDTH}(PC), height}`)
  if (!ev.environment || typeof ev.environment !== 'string') errs.push('environment(실행 환경 — 예: next dev localhost:3000 · chromium 130)')
  if (!ev.checks || typeof ev.checks !== 'object') errs.push(`checks {${Object.keys(UI_CHECKS).join(', ')}}: pass|fail|skip`)
  else for (const k of Object.keys(UI_CHECKS)) if (!['pass', 'fail', 'skip'].includes(ev.checks[k])) errs.push(`checks.${k} = pass|fail|skip`)
  if (!Array.isArray(ev.defects)) errs.push('defects 배열([] 가능) — {kind: objective|suggestion, claim, status: open|fixed}')
  else for (const d of ev.defects) if (!['objective', 'suggestion'].includes(d?.kind) || !d.claim || !['open', 'fixed'].includes(d.status)) errs.push('defects[] 는 {kind: objective|suggestion, claim, status: open|fixed}')
  const uiAcc = t.ui_acceptance || []
  if (uiAcc.length && !(Array.isArray(ev.ui_acceptance_results) && ev.ui_acceptance_results.length === uiAcc.length && ev.ui_acceptance_results.every((r) => ['pass', 'fail', 'skip'].includes(r)))) errs.push(`ui_acceptance_results(설계 UI 수용 기준 ${uiAcc.length}개 각각 pass|fail|skip)`)
  if (!Array.isArray(ev.screenshots) || !ev.screenshots.length) errs.push('screenshots(파일 경로 배열)')
  if (errs.length) return { errs }
  const shots = []
  for (const s of ev.screenshots) {
    const hit = [s, ...roots.filter(Boolean).map((r) => path.join(r, s))].find((c) => {
      try {
        return fs.statSync(c).isFile()
      } catch {
        return false
      }
    })
    if (!hit) return { errs: [`스크린샷 ${s} 가 없다 — 없는 화면으로 UI 를 통과시킬 수 없다`] }
    shots.push({ path: s, sha256: sha256(hit) })
  }
  // SKIP 은 PASS 가 아니다 — pass 라고 적었는데 검사·기준 중 pass 가 아닌 것이 있거나 열린 객관 결함이 있으면 형식 오류
  if (ev.result === 'pass') {
    const notPass = uiNotPassing(ev, t)
    if (notPass.length) return { errs: [`result=pass 인데 ${notPass.join(' / ')} — 실제 결과대로 fail/skip 으로 기록한다`] }
  }
  return { errs: [], screenshots_sha256: shots }
}

/** UI 증거가 완료를 막는 이유들(빈 배열이면 통과) */
export function uiNotPassing(ev, t) {
  const out = []
  for (const k of Object.keys(UI_CHECKS)) if (ev.checks?.[k] !== 'pass') out.push(`검사 ${k}(${UI_CHECKS[k]})=${ev.checks?.[k] ?? '없음'}`)
  const open = (ev.defects || []).filter((d) => d.kind === 'objective' && d.status === 'open')
  if (open.length) out.push(`열린 객관 결함 ${open.length}건`)
  const acc = t.ui_acceptance || []
  acc.forEach((a, i) => {
    if (ev.ui_acceptance_results?.[i] !== 'pass') out.push(`UI 수용 기준 ${i}「${String(a).slice(0, 40)}」=${ev.ui_acceptance_results?.[i] ?? '없음'}`)
  })
  return out
}

/** 완료 게이트 — ui_gate 작업의 이번 run 증거에 통과한 UI 증거가 있는가. 반환: 빠진 항목 목록(빈 배열이면 통과) */
export function uiGateMissing(t, current, verified) {
  if (!t.ui_gate) return []
  const ui = current.filter((e) => e.type === 'ui')
  if (!ui.length) return ['UI 증거(type ui) 없음 — 화면 포함 작업은 실제 브라우저 검증이 있어야 완료(실행 안 했으면 완료 불가)']
  const same = verified ? ui.filter((e) => String(verified).startsWith(String(e.commit)) || String(e.commit).startsWith(String(verified))) : ui
  if (!same.length) return [`UI 증거의 commit(${ui.map((e) => e.commit).join(',')}) ≠ 검증 커밋 ${verified}`]
  const best = same.map((e) => ({ e, why: e.result === 'pass' ? uiNotPassing(e, t) : [`result=${e.result}`] })).sort((a, b) => a.why.length - b.why.length)[0]
  return best.why
}
