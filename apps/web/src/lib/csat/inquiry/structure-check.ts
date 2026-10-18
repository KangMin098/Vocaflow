// apps/web/src/lib/csat/inquiry/structure-check.ts
// FINAL §6 ⑤ — 「글 전체 구조」 학습자 직접 상호작용: 검수된 설계 주석(passage_design)의 문장 역할 · 구조 패턴을 **먼저 예측**하고
// 서버가 대조한다(순수). 허용 대안(alternatives)에 있는 역할도 맞음으로 본다 — 주석자 둘이 갈린 자리를 오답 처리하지 않는다.
// 이 판정은 「설계 가설과 얼마나 같게 읽었나」이지 능력 근거가 아니다 — 수행 기록(task_key design-structure)은 지도 근거 키 밖이다.
import { PATTERN_LABEL, ROLE_LABEL, type PassageDesign, type Pattern, type Role } from '../design'

export const STRUCTURE_TASK_KEY = 'design-structure'
export const ROLES = Object.keys(ROLE_LABEL) as Role[]
export const PATTERNS = Object.keys(PATTERN_LABEL) as Pattern[]

export interface StructureResponse { roles: Role[]; pattern: Pattern }
export interface StructureGrade {
  roleOk: boolean[]
  rolesRight: number
  patternOk: boolean
  /** 주제문 자리를 맞혔나 — 구조 읽기의 핵심(학습자 피드백 첫 줄) */
  topicOk: boolean
  isCorrect: boolean
}

export function parseStructureResponse(raw: unknown, n: number): StructureResponse | null {
  const r = (raw ?? {}) as { roles?: unknown; pattern?: unknown }
  if (!Array.isArray(r.roles) || r.roles.length !== n || !r.roles.every((x) => ROLES.includes(x as Role))) return null
  if (!PATTERNS.includes(r.pattern as Pattern)) return null
  return { roles: r.roles as Role[], pattern: r.pattern as Pattern }
}

export function gradeStructure(d: PassageDesign, r: StructureResponse): StructureGrade {
  const ok = d.roles.map((want, i) => r.roles[i] === want || d.alternatives.some((a) => a.index === i && a.role === r.roles[i]))
  const topics = d.roles.map((x, i) => (x === 'topic' ? i : -1)).filter((i) => i >= 0)
  const picked = r.roles.map((x, i) => (x === 'topic' ? i : -1)).filter((i) => i >= 0)
  const topicOk = topics.length === 0 ? picked.length === 0 : topics.every((i) => ok[i]) && picked.every((i) => ok[i])
  const patternOk = r.pattern === d.pattern
  return { roleOk: ok, rolesRight: ok.filter(Boolean).length, patternOk, topicOk, isCorrect: patternOk && ok.every(Boolean) }
}
