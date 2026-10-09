// lib/policy.mjs
//
// 목표 단위 실행 정책(Execution Policy) + 위험 분류 — 사용자 승인을 「설계 버전·파일 경로마다」가 아니라 「목표마다 한 번」으로.
//
//   정책(goal.execution_policy · 사용자가 대화형 터미널로 승인한 goal_delegation 결정에 내용 sha256 째 결속):
//     goal_id · allowed_capabilities[] · allowed_code_areas[](glob) · excluded_operations[] · risk_level(LOW|MEDIUM — 자동 실행 상한)
//     approval_evidence(결정 id) · max_runtime_min · max_cost_usd · merge_policy(none|pr_only) · live_test_user(선택 · 실제 학습자 아님)
//
//   위험(경로·DB 범위·작업 종류로만 — AI 판단 없음 · 모르면 높게):
//     HIGH   DB 스키마·데이터(supabase/** · *.sql · migrations · scripts/db/** · db_scope write) · 인증·권한·RLS · .env·비밀 ·
//            정본(goals/** · docs/platform-goals/** · LEARNING_MAP_VNEXT.md) · 배포·CI(.github/workflows · vercel · next.config) ·
//            의존성(package.json · lockfile) · 개인정보 · 작업 종류 db_write·canon_change·deploy·merge_main·external_publish
//     MEDIUM 제품 코드(apps/** · packages/** 의 테스트 아닌 파일 — 기존 동작·학생 UI·API) · scripts/**(DB 아님) · 개발 DB 읽기
//     LOW    테스트(__tests__ · *.test.* · *.spec.*) · 정본 아닌 문서(*.md · docs/**)
//   HIGH 는 어떤 정책으로도 자동 실행하지 않는다 — 별도 대화형 승인(DB 쓰기 · 정본 재봉인 등 기존 경로).

import crypto from 'node:crypto'

export const RISK = { LOW: 1, MEDIUM: 2, HIGH: 3 }
export const CAPABILITIES = ['read', 'plan', 'design_request', 'code_change', 'test', 'review', 'docs', 'branch_push', 'pr_open', 'db_read_dev']
export const HIGH_OPS = ['db_write', 'schema_change', 'canon_change', 'deploy', 'merge_main', 'external_publish', 'auth_change', 'personal_data']
export const MERGE_POLICIES = ['none', 'pr_only']

/** glob → 정규식: `**​/` = 0개 이상 폴더 · 끝의 `**` = 아무거나 · `*` = 한 단계 · `?` = 한 글자 */
function g2re(g) {
  const s = String(g).replace(/\\/g, '/')
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '*' && s[i + 1] === '*') {
      if (s[i + 2] === '/') {
        out += '(?:.*/)?'
        i += 2
      } else {
        out += '.*'
        i += 1
      }
    } else if (c === '*') out += '[^/]*'
    else if (c === '?') out += '[^/]'
    else out += c.replace(/[.+^${}()|[\]]/g, '\\$&')
  }
  return new RegExp(`^${out}$`, 'i')
}
const matchAny = (p, globs) => globs.some((g) => g2re(g).test(String(p).replace(/\\/g, '/')))

const HIGH_PATHS = [
  'supabase/**', '**/*.sql', '**/migrations/**', 'scripts/db/**',
  '**/.env*', '**/*secret*', '**/*credential*',
  '**/auth/**', '**/middleware.*', '**/*rls*', 'apps/web/src/lib/supabase/**',
  'goals/**', 'docs/platform-goals/**', '**/LEARNING_MAP_VNEXT.md', '**/GOAL_ACCEPTANCE_CRITERIA.json',
  '.github/workflows/**', '**/vercel.json', '**/next.config.*',
  '**/package.json', '**/pnpm-lock.yaml', '**/*privacy*', '**/*personal*',
]
const LOW_PATHS = ['**/__tests__/**', '**/*.test.*', '**/*.spec.*', '**/*.md', 'docs/**']

/** HIGH 파일이 어떤 승인 종류로만 풀리는가 — 대응이 없으면 자동 작업에서는 늘 막힌다(인증·정본·의존성·개인정보) */
export function highApprovalKind(p) {
  if (matchAny(p, ['supabase/**', '**/*.sql', '**/migrations/**', 'scripts/db/**'])) return 'db_write'
  if (matchAny(p, ['**/.env*', '**/*secret*', '**/*credential*'])) return 'secret'
  if (matchAny(p, ['.github/workflows/**', '**/vercel.json', '**/next.config.*'])) return 'deploy'
  return null
}

/** 경로 하나의 위험 — 높은 규칙이 먼저(테스트 폴더 안의 .sql 도 HIGH) */
export function pathRisk(p) {
  if (matchAny(p, HIGH_PATHS)) return 'HIGH'
  if (matchAny(p, LOW_PATHS)) return 'LOW'
  return 'MEDIUM'
}

/** 변경 묶음의 위험 = 가장 높은 것. db_scope·작업 종류도 본다. 경로가 없으면 판단 불가 → HIGH */
export function classifyRisk({ paths = [], db_scope = null, operations = [] } = {}) {
  const reasons = []
  let level = 'LOW'
  const up = (l, why) => {
    if (RISK[l] > RISK[level]) level = l
    if (l !== 'LOW') reasons.push(`${l}: ${why}`)
  }
  if (!paths.length) up('HIGH', '변경 경로가 없다 — 범위를 알 수 없다')
  for (const p of paths) {
    const r = pathRisk(p)
    if (r !== 'LOW') up(r, p)
  }
  const mode = db_scope?.mode ?? 'none'
  if (mode === 'write') up('HIGH', 'db_scope=write')
  else if (mode === 'read') up('MEDIUM', 'db_scope=read')
  for (const o of operations) if (HIGH_OPS.includes(o)) up('HIGH', `operation ${o}`)
  return { level, reasons }
}

export const policySha = (policy) => crypto.createHash('sha256').update(JSON.stringify(canon(policy))).digest('hex')
function canon(v) {
  if (Array.isArray(v)) return v.map(canon)
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
  return v
}

/** 정책 형식 검사 — 틀리면 오류 목록 */
export function validatePolicy(p) {
  const e = []
  if (!p || typeof p !== 'object') return ['정책이 객체가 아니다']
  if (!/^UG-/.test(p.goal_id || '')) e.push('goal_id(UG-…)')
  if (!Array.isArray(p.allowed_capabilities) || p.allowed_capabilities.some((c) => !CAPABILITIES.includes(c))) e.push(`allowed_capabilities ⊂ ${CAPABILITIES.join('|')}`)
  if (!Array.isArray(p.allowed_code_areas) || !p.allowed_code_areas.length) e.push('allowed_code_areas(비지 않은 glob 배열)')
  const BROAD = ['**', '*', '**/*', 'apps/**', 'apps/web/**', 'apps/web/src/**', 'apps/web/src/lib/**', 'apps/web/src/app/**', 'apps/web/src/components/**', 'packages/**', 'scripts/**', 'docs/**']
  for (const a of p.allowed_code_areas || []) if (pathRisk(a) === 'HIGH' || BROAD.includes(String(a).replace(/\\/g, '/'))) e.push(`code area ${a} 는 HIGH 이거나 너무 넓다`)
  if (!Array.isArray(p.excluded_operations)) e.push('excluded_operations 배열')
  for (const o of HIGH_OPS) if (!(p.excluded_operations || []).includes(o)) e.push(`excluded_operations 에 ${o} 가 있어야 한다(HIGH 는 정책으로 위임하지 않는다)`)
  if (!['LOW', 'MEDIUM'].includes(p.risk_level)) e.push('risk_level 은 LOW|MEDIUM(HIGH 는 위임 불가)')
  if (!(Number(p.max_runtime_min) > 0)) e.push('max_runtime_min > 0')
  if (!(Number(p.max_cost_usd) > 0)) e.push('max_cost_usd > 0')
  if (!MERGE_POLICIES.includes(p.merge_policy)) e.push(`merge_policy ${MERGE_POLICIES.join('|')}`)
  if (p.live_test_user !== undefined && p.live_test_user !== null && !/^[0-9a-f-]{36}$/i.test(p.live_test_user)) e.push('live_test_user 는 uuid(테스트 계정)')
  if (p.live_test_user && !(p.allowed_capabilities || []).includes('db_read_dev')) e.push('live_test_user 는 db_read_dev 능력과 함께')
  return e
}

/**
 * 정책이 이 변경(설계·작업)을 덮는가. 덮으면 { ok:true, risk } — 사용자에게 다시 묻지 않는다.
 * 아니면 { ok:false, why[] } — 그 변경만 승인 대기(독립 작업은 계속).
 */
export function policyCovers(policy, { paths = [], db_scope = null, operations = [], db_changes = false, capability = 'code_change' } = {}) {
  const why = []
  if (!policy) return { ok: false, why: ['목표 실행 정책 없음'] }
  const risk = classifyRisk({ paths, db_scope, operations: [...operations, ...(db_changes ? ['db_write'] : [])] })
  if (risk.level === 'HIGH') why.push(`위험 HIGH(${risk.reasons.filter((r) => r.startsWith('HIGH')).join(' · ')}) — 별도 사용자 승인`)
  else if (RISK[risk.level] > RISK[policy.risk_level]) why.push(`위험 ${risk.level} > 정책 상한 ${policy.risk_level}`)
  const outside = paths.filter((p) => !matchAny(p, policy.allowed_code_areas))
  if (outside.length) why.push(`허용 코드 영역 밖: ${outside.join(', ')}`)
  if (!policy.allowed_capabilities.includes(capability)) why.push(`능력 ${capability} 이 정책에 없다`)
  if ((db_scope?.mode ?? 'none') === 'read' && !policy.allowed_capabilities.includes('db_read_dev')) why.push('개발 DB 읽기(db_read_dev) 미위임')
  for (const o of operations) if ((policy.excluded_operations || []).includes(o)) why.push(`제외된 작업 ${o}`)
  return why.length ? { ok: false, why, risk } : { ok: true, risk }
}
