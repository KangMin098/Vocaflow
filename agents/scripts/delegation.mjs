// agents/scripts/delegation.mjs
//
// AUTONOMOUS_DELEGATED 위임 정책의 순수 판정기(실행하지 않는다). 정본 agents/policies/delegation.json · 설명 docs/agents/AUTONOMOUS_DELEGATED.md.
//   policyActive    — 정책이 채택됐고 채택 기록이 사람 승인 티켓으로 채워졌는가(에이전트가 status 만 바꿔서는 켜지지 않는다)
//   classifySql     — 마이그레이션 SQL 의 위험 등급(additive · security · destructive · unsafe)
//   evaluateDelegatedApply — 위임 DB 적용의 전 조건을 한 번에 판정(이유 목록). 하나라도 어긋나면 ok=false
//   protectedChanges — 정책 · 실행기 · 가드를 바꾸는 변경 파일(자동 병합 금지)
// 한계: 같은 OS 계정의 에이전트가 정책을 어기고 파일을 직접 고치는 위조는 이 판정기가 막지 못한다(db-approval.mjs 와 같은 한계).
//   그래서 채택 기록은 사람 승인 창의 1회용 티켓(db-approval-hook)으로만 만들고, 이 파일들을 바꾸는 PR 은 사람이 병합한다.

const SHA_RE = /^[0-9a-f]{64}$/

/** 채택 기록 — { adoptedAt, ticketHash(64hex), by: 'human', scopeSha(64hex) } 가 모두 있고 status=adopted 일 때만 활성 */
export function policyActive(policy) {
  if (!policy || policy.policy !== 'AUTONOMOUS_DELEGATED') return { active: false, reason: '정책 정본이 아니다' }
  if (policy.status !== 'adopted') return { active: false, reason: `status=${policy.status ?? 'none'} — 채택 전` }
  const a = policy.adoption
  if (!a || a.by !== 'human' || !SHA_RE.test(a.ticketHash ?? '') || !SHA_RE.test(a.scopeSha ?? '') || !a.adoptedAt) {
    return { active: false, reason: '채택 기록이 사람 승인 티켓으로 채워지지 않았다' }
  }
  return { active: true, reason: null }
}

/** 주석 · 문자열 리터럴을 지운 SQL(키워드 판정용 — 달러 인용 함수 본문은 남긴다: 본문 안 DELETE 도 위험으로 본다) */
function stripSql(sql) {
  return String(sql)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
}

const DESTRUCTIVE = [
  [/\bdrop\s+(table|schema|column|view|materialized\s+view|function|trigger|policy|index|type)\b/i, 'DROP'],
  [/\btruncate\b/i, 'TRUNCATE'],
  [/\bdelete\s+from\b/i, 'DELETE'],
  [/\balter\s+table\b[^;]*\bdrop\b/i, 'ALTER TABLE … DROP'],
  [/\bupdate\s+[a-z_."]+\s+set\b/i, 'UPDATE(기존 행 변경)'],
  [/\balter\s+table\b[^;]*\balter\s+column\b[^;]*\btype\b/i, 'ALTER COLUMN TYPE'],
]
const SECURITY = [
  [/\bgrant\b/i, 'GRANT'],
  [/\brevoke\b/i, 'REVOKE'],
  [/\b(create|alter|drop)\s+policy\b/i, 'RLS 정책'],
  [/\b(enable|disable|force|no\s+force)\s+row\s+level\s+security\b/i, 'RLS 켜기 · 끄기'],
  [/\bowner\s+to\b/i, 'OWNER 변경'],
  [/\b(create|alter)\s+role\b/i, 'ROLE'],
  [/\bsecurity\s+definer\b/i, 'SECURITY DEFINER'],
  [/\b(auth|storage)\.[a-z_]+/i, 'auth · storage 스키마'],
]
const UNSAFE = [
  [/\bcopy\b[^;]*\b(from|to)\s+program\b/i, 'COPY PROGRAM'],
  [/\bpg_read_file\b|\bpg_ls_dir\b|\blo_import\b/i, '서버 파일 접근'],
  [/\bcreate\s+extension\b/i, 'EXTENSION'],
  [/\bdo\s+\$/i, 'DO 블록(검토 불가 동적 실행)'],
  [/\bexecute\s+(format|'|\$)/i, '동적 SQL'],
]

/** @returns {{ class: 'additive'|'security'|'destructive'|'unsafe', findings: string[] }} — 가장 무거운 등급 */
export function classifySql(sql) {
  const s = stripSql(sql)
  const hit = (rules) => rules.filter(([re]) => re.test(s)).map(([, name]) => name)
  const unsafe = hit(UNSAFE)
  if (unsafe.length) return { class: 'unsafe', findings: unsafe }
  const destructive = hit(DESTRUCTIVE)
  if (destructive.length) return { class: 'destructive', findings: destructive }
  const security = hit(SECURITY)
  if (security.length) return { class: 'security', findings: security }
  return { class: 'additive', findings: [] }
}

/**
 * 위임 DB 적용 판정(순수). 실행기는 ok=true 일 때만, 그리고 정책 db.enabled=true 일 때만 적용한다.
 * input: { policy, target, file, sql, sha, codexAcceptance:{ sha, verdict, reviewer }, checkpoint:{ before:boolean }, applied:{ version→sha } }
 */
export function evaluateDelegatedApply(input, sha256) {
  const reasons = []
  const p = input.policy
  const act = policyActive(p)
  if (!act.active) reasons.push(`정책 비활성 — ${act.reason}`)
  if (!p?.db?.enabled) reasons.push('db.enabled=false — 위임 DB 실행기가 꺼져 있다')
  if (!(p?.db?.targets ?? []).includes(input.target)) reasons.push(`대상 DB ${input.target} 가 위임 범위 밖`)
  if (!/^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/.test(input.file ?? '')) reasons.push('버전 번호 있는 마이그레이션 파일이 아니다(_pending_ · 임의 경로 불가)')
  if (!SHA_RE.test(input.sha ?? '')) reasons.push('정확한 sha256 이 없다')
  else if (sha256(input.sql ?? '') !== input.sha) reasons.push('파일 본문 sha256 ≠ 승인 대상 sha256')
  const c = input.codexAcceptance
  if (!c || c.reviewer !== 'codex' || c.verdict !== 'ACCEPT' || c.sha !== input.sha) reasons.push('같은 sha256 에 결속된 Codex ACCEPT 가 없다')
  const k = classifySql(input.sql ?? '')
  if (k.class !== (p?.db?.delegable_class ?? 'additive')) reasons.push(`위험 등급 ${k.class}(${k.findings.join(' · ')}) — 위임 불가, 사용자 승인 경로`)
  if (!input.checkpoint?.before) reasons.push('적용 전 checkpoint 가 없다')
  const v = (input.file ?? '').match(/(\d{14})_/)?.[1]
  if (v && input.applied && input.applied[v]) reasons.push(`버전 ${v} 는 이미 적용 이력이 있다(재적용 금지)`)
  return { ok: reasons.length === 0, reasons, class: k.class }
}

/** 정책 파일이 아직 main 에 없을 때의 기본 보호 경로(delegation.json code.protected_paths 와 같다) */
export const DEFAULT_PROTECTED = ['agents/policies/', 'agents/scripts/safe-merge.mjs', 'agents/scripts/guard.mjs', 'agents/scripts/db-approval.mjs', 'agents/scripts/db-approval-hook.mjs', 'agents/scripts/delegation.mjs', '.claude/settings.json', '.codex/config.toml', '.github/workflows/']

/** 정책 보호 경로를 건드린 변경 파일 — 있으면 safe-merge 는 자동 병합하지 않는다 */
export function protectedChanges(files, policy) {
  const prefixes = policy?.code?.protected_paths ?? DEFAULT_PROTECTED
  return (files ?? []).filter((f) => prefixes.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p)))
}
