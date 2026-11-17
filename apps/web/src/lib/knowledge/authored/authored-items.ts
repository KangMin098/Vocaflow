// apps/web/src/lib/knowledge/authored/authored-items.ts
// FINAL §4 · §5 — 자체 창작 산출물(authored_item) 세트: 검증 · 학습자 보기 · 채점 · 등록 인자(순수 — DB · 시계 없음).
//
// 창작 지문은 Vocaflow 저작물이라 학습자에게 원문을 보여 준다(기출 csat_item 과 다르다). 그래도 권리 · Gold 는 사람 결정
// 원장(content_human_decision)에 사람 행이 있어야 공급된다 — provenance.humanGold/rights 는 상태 표시일 뿐 승인이 아니다.
// 채점 계약은 **과제 형식**(formats.ts)마다 다르다 — TASK 가 재는 능력에 맞춘다(R5 주장·근거 계약을 다른 TASK 에 복사하지 않는다).
// 형식 공통 규칙(여기): 역할 5종 · 지문 묶음의 교수/평가 분리 · 평가 문항에 해설 · 단서 없음 · 원천 파생 없음 · 선택지 · Gold 형식.
// Gold hash · revision 은 DB 가 jsonb 에서 계산한다(authored_item_gold_hash) — 여기서 다시 계산하지 않는다.
import { FORMAT_SPECS, formatOf, type DistractorDesign, type FormatId } from './formats'
import type { Relation } from '../claim-support-labels'

import r5Set from './r5-central-meaning.v1.json'
import evidenceSet from './e-evidence-location.v1.json'
import optionSet from './e-option-correspondence.v1.json'
import inferenceSet from './r-inference.v1.json'
import relationSet from './r-relation.v1.json'
import formSet from './s-form-scope.v1.json'
import senseSet from './v-contextual-sense.v1.json'
import refSet from './r-reference.v1.json'
import multiwordSet from './v-multiword.v1.json'
import dfSet from './r-discourse-function.v1.json'
import dsSet from './r-discourse-structure.v1.json'
import demandSet from './e-task-demand.v1.json'
import coreSet from './s-sentence-core.v1.json'
import attachSet from './s-attachment.v1.json'
import chunkSet from './s-chunk-boundary.v1.json'
import structSet from './s-structural-relation.v1.json'
import semSet from './v-semantic-relation.v1.json'
import r5CycleSet from './r5-cycle-supplement.v2.json'

export { DISTRACTOR_DESIGNS, type DistractorDesign } from './formats'

export const AUTHORED_REF_PREFIX = 'authored:'
export const ASSESSMENT_ROLES = ['independent_check', 'transfer', 'delayed_check'] as const
export const INSTRUCTION_ROLES = ['model_explanation', 'guided_practice'] as const
export type AuthoredRole = (typeof ASSESSMENT_ROLES)[number] | (typeof INSTRUCTION_ROLES)[number]

export interface TeachStep { step: string; text: string; sentences: number[] }

export interface AuthoredBody {
  /** 과제 형식 — 없으면 central_meaning(R5 첫 세트) */
  format?: FormatId
  sentences: string[]
  stem: string
  choices?: string[]
  /** 교수(model_explanation) — 출제 원리를 문장 번호와 함께 단계별로 */
  teach?: TeachStep[]
  /** 안내 연습(guided_practice) — 학습자가 열어 보는 단서 */
  hints?: string[]
  /** 형식별 칸(contextual_sense.target · sentence_relation.pairs · form_scope.marks) */
  [k: string]: unknown
}

/** R5 central_meaning Gold(다른 형식은 formats.ts 계약) */
export interface AuthoredGold {
  answer: number
  claim: number
  claimRestated: number[]
  support: number[]
  supportDisputed: number[]
  opposed: number[]
  relationProbe: { sentence: number; relation: Relation }
  gist: string
  distractors: { choice: number; design: DistractorDesign; why: string }[]
}

export interface AuthoredItem {
  id: string
  role: AuthoredRole
  passageGroup: string
  body: AuthoredBody
  gold: AuthoredGold | Record<string, unknown>
}

export interface AuthoredSet {
  set: string
  taskId: string
  taskKey: string
  format?: FormatId
  /** 설명 글 문장 번호 규약 — 반드시 '1-based'(화면 표시와 같다). gold · teach.sentences 의 숫자 배열은 0부터 */
  proseNumbering?: '1-based'
  provenance: { author: string; method: string; derivedFrom: string[]; createdAt: string; humanGold: string; rights: string; revisionNote?: string }
  items: AuthoredItem[]
}

export const R5_AUTHORED_SET = r5Set as AuthoredSet

export const isAssessmentRole = (r: string): boolean => (ASSESSMENT_ROLES as readonly string[]).includes(r)
export const authoredRef = (id: string) => `${AUTHORED_REF_PREFIX}${id}`
export const isAuthoredRef = (ref: string) => ref.startsWith(AUTHORED_REF_PREFIX)
const setVersion = (s: AuthoredSet) => s.set.slice(s.set.lastIndexOf('.') + 1)
/** 채점 주석 ref — 과제 키로 시작해야 한다(DB check · G2 결속 규칙) */
export const annotationRefOf = (s: AuthoredSet, item: AuthoredItem) => `${s.taskKey}-${item.id}.${setVersion(s)}`
export const setFormat = (s: AuthoredSet): FormatId => s.format ?? 'central_meaning'

/**
 * 2E — 보충 세트 등록 정책(신뢰 레지스트리 · 정확한 세트 ID 키). 일반 세트는 역할 5종을 모두 갖춰야 한다.
 * 여기 적힌 세트만 적힌 역할 부분집합을 **정확히** 가질 수 있다 — 등록되지 않은 세트는 우회하지 못한다.
 * 검토된 바이트는 고치지 않는다(표식은 파일이 아니라 이 표에 둔다). sha256 = 두 AI 검토 영수증이 결속한 파일 바이트(시험이 확인).
 */
export const SUPPLEMENTAL_SETS: Readonly<Record<string, { taskId: string; roles: readonly AuthoredRole[]; supplements: string; sha256: string }>> = {
  'r5-central-meaning-cycle.v2': {
    taskId: 'r.central_meaning', roles: ['independent_check', 'transfer'], supplements: R5_AUTHORED_SET.set,
    sha256: '408d40fdd5a1e24ec9bf5ce2b5e398e09c86a4dbf9aa16523bb305d41268c08c',
  },
}
const ALL_ROLES: readonly AuthoredRole[] = [...ASSESSMENT_ROLES, ...INSTRUCTION_ROLES]

/** 세트 규칙 위반 목록(빈 배열 = 통과). 등록 전 · 테스트에서 돈다 */
export function validateAuthoredSet(s: AuthoredSet): string[] {
  const errs: string[] = []
  // 역할 계약 — 일반 세트 = 5종 모두 · 등록된 보충 세트 = 등록된 부분집합과 정확히 같고 TASK 도 같아야 한다
  const supp = Object.prototype.hasOwnProperty.call(SUPPLEMENTAL_SETS, s.set) ? SUPPLEMENTAL_SETS[s.set] : null
  const want = [...(supp?.roles ?? ALL_ROLES)].sort().join(',')
  const have = [...new Set(s.items.map((i) => i.role))].sort().join(',')
  if (have !== want) errs.push(`역할 ${have} — ${supp ? '등록된 보충 역할' : '역할 5종'}(${want})과 다르다`)
  if (supp && supp.taskId !== s.taskId) errs.push(`보충 세트 TASK ${s.taskId} ≠ 등록 ${supp.taskId}`)
  const ids = new Set<string>()
  const groupClass = new Map<string, 'instruction' | 'assessment'>()
  const fmt = setFormat(s)
  if (!/^[a-z]\.[a-z_]{2,60}$/.test(s.taskId)) errs.push(`taskId 형식: ${s.taskId}`)
  if (!/^[a-z][a-z0-9-]{2,60}$/.test(s.taskKey)) errs.push(`taskKey 형식: ${s.taskKey}`)
  // 설명 글(why · rationale · teach · hints)의 문장 번호는 화면과 같은 1부터 — 0부터 쓴 세트가 학습자에게 엉뚱한 문장을 가리켰다(2026-10-18 발견)
  if (s.proseNumbering !== '1-based') errs.push('proseNumbering 이 1-based 가 아니다(설명 글 문장 번호는 화면과 같게 1부터)')
  if (s.provenance.derivedFrom.length > 0) errs.push('창작 세트는 원천 지문에서 파생되지 않아야 한다(derivedFrom 비어 있음)')
  // 문장 역할 형식: 위치만 보고 맞힐 수 있으면 역할 판단을 재지 못한다(맹검 검토 2026-10-18 — 12문항 모두 마지막 문장이 결론)
  if (fmt === 'discourse_roles') {
    const roles = s.items.map((i) => ((i.gold as { roles?: string[] }).roles ?? []))
    const endsConclusion = roles.filter((r) => r[r.length - 1] === 'conclusion').length
    if (endsConclusion > Math.ceil(s.items.length / 2)) errs.push(`마지막 문장이 결론인 문항이 ${endsConclusion}/${s.items.length} — 위치 단서(절반 이하로)`)
    const topicAt = new Set(roles.map((r) => r.indexOf('topic')))
    if (s.items.length >= 3 && topicAt.size < 3) errs.push('주제문 위치가 다양하지 않다(서로 다른 위치 3곳 이상)')
  }
  for (const it of s.items) {
    const at = `[${it.id}]`
    if (ids.has(it.id)) errs.push(`${at} id 중복`)
    ids.add(it.id)
    if (!/^[a-z0-9][a-z0-9.-]{2,80}$/.test(it.id)) errs.push(`${at} id 형식`)
    if (![...ASSESSMENT_ROLES, ...INSTRUCTION_ROLES].includes(it.role)) errs.push(`${at} 역할 ${it.role}`)
    const cls = isAssessmentRole(it.role) ? 'assessment' : 'instruction'
    const prev = groupClass.get(it.passageGroup)
    if (prev && prev !== cls) errs.push(`${at} 지문 묶음 ${it.passageGroup} 에 교수·평가가 섞였다`)
    groupClass.set(it.passageGroup, cls)
    const nS = it.body.sentences.length
    if (nS < 2 || nS > 30) errs.push(`${at} 문장 수 ${nS}`)
    if (formatOf(it.body) !== fmt) errs.push(`${at} 형식이 세트(${fmt})와 다르다`)
    if (fmt !== 'central_meaning' && it.body.format !== fmt) errs.push(`${at} body.format 이 없다`)
    for (const e of FORMAT_SPECS[fmt].validate(it.body, it.gold as Record<string, unknown>)) errs.push(`${at} ${e}`)
    if (it.role === 'model_explanation' && !(it.body.teach && it.body.teach.length >= 3)) errs.push(`${at} 교수 단계가 없다`)
    if (it.role === 'guided_practice' && !(it.body.hints && it.body.hints.length >= 1)) errs.push(`${at} 안내 단서가 없다`)
    if (isAssessmentRole(it.role) && (it.body.teach || it.body.hints)) errs.push(`${at} 평가 문항에 해설 · 단서가 있다`)
  }
  return errs
}

/** 학습자에게 보내는 본문 — Gold 는 절대 넣지 않는다. 교수 단계는 교수 역할에서만, 단서는 안내 연습에서만 */
export interface AuthoredLearnerView {
  ref: string
  role: AuthoredRole
  format: FormatId
  sentences: string[]
  stem: string
  choices: string[]
  teach: TeachStep[] | null
  hints: string[] | null
  /** 형식별 칸(정답 아님 — 무엇을 묻는지만): target · pairs · marks */
  extra: Record<string, unknown>
}

const EXTRA_KEYS = ['target', 'pairs', 'marks', 'focus', 'segments', 'ask', 'pair', 'taskStem'] as const
export function learnerBody(role: AuthoredRole, body: AuthoredBody) {
  return {
    format: formatOf(body),
    sentences: body.sentences,
    stem: body.stem,
    choices: body.choices ?? [],
    teach: role === 'model_explanation' ? body.teach ?? null : null,
    hints: role === 'guided_practice' ? body.hints ?? null : null,
    extra: Object.fromEntries(EXTRA_KEYS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]])),
  }
}

export function learnerView(_s: AuthoredSet, it: AuthoredItem): AuthoredLearnerView {
  return { ref: authoredRef(it.id), role: it.role, ...learnerBody(it.role, it.body) }
}

export type AuthoredResponse = Record<string, unknown>
export interface AuthoredGrade { isCorrect: boolean; [k: string]: unknown }

/** 응답 검사 + 채점(형식 계약). 형식이 틀리면 null(라우트가 400) */
export function gradeAuthored(s: AuthoredSet, it: AuthoredItem, raw: unknown): { response: AuthoredResponse; grade: AuthoredGrade } | null {
  return FORMAT_SPECS[formatOf(it.body)].grade(it.body, it.gold as Record<string, unknown>, raw, annotationRefOf(s, it))
}

/** 응답 뒤 공개하는 해설(Gold 파생) — 독립 확인도 응답 뒤에는 보여 준다(풀이 전에는 절대 아님) */
export function revealAfterAnswer(it: AuthoredItem): Record<string, unknown> {
  return { format: formatOf(it.body), ...FORMAT_SPECS[formatOf(it.body)].reveal(it.gold as Record<string, unknown>) }
}

/** DB authored_item_register 인자(관리자 등록 러너가 쓴다) */
export function registrationArgs(s: AuthoredSet, it: AuthoredItem) {
  return {
    p_ref: authoredRef(it.id),
    p_task: s.taskId,
    p_task_key: s.taskKey,
    p_role_class: isAssessmentRole(it.role) ? 'assessment' : 'instruction',
    p_intended_role: it.role,
    p_group: it.passageGroup,
    p_body: it.body,
    p_gold: it.gold,
    p_annotation_ref: annotationRefOf(s, it),
    p_provenance: { ...s.provenance, set: s.set, item: it.id },
  }
}

/** 2E 보충 — 정본 순환(확인 → 바로잡기 → 전이 → 다시 확인)의 미노출 독립 확인 2 · 전이 1(SUPPLEMENTAL_SETS 등록) */
export const R5_CYCLE_SUPPLEMENT = r5CycleSet as unknown as AuthoredSet
const SETS: AuthoredSet[] = [R5_AUTHORED_SET, R5_CYCLE_SUPPLEMENT, ...[evidenceSet, optionSet, inferenceSet, relationSet, formSet, senseSet, refSet, multiwordSet, dfSet, dsSet, demandSet, coreSet, attachSet, chunkSet, structSet, semSet].map((x) => x as unknown as AuthoredSet)]
export const AUTHORED_SETS: readonly AuthoredSet[] = SETS

export function findAuthored(ref: string): { set: AuthoredSet; item: AuthoredItem } | null {
  if (!isAuthoredRef(ref)) return null
  const id = ref.slice(AUTHORED_REF_PREFIX.length)
  for (const set of SETS) {
    const item = set.items.find((x) => x.id === id)
    if (item) return { set, item }
  }
  return null
}

export function authoredItemsFor(taskId: string, role?: AuthoredRole): { set: AuthoredSet; item: AuthoredItem }[] {
  return SETS.filter((s) => s.taskId === taskId).flatMap((set) => set.items.filter((i) => !role || i.role === role).map((item) => ({ set, item })))
}
