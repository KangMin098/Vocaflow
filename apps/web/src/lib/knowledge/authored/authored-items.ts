// apps/web/src/lib/knowledge/authored/authored-items.ts
// FINAL §4 — 자체 창작 산출물(authored_item) 세트: 검증 · 학습자 보기 · 채점 · 등록 인자(순수 — DB · 시계 없음).
//
// 창작 지문은 Vocaflow 저작물이라 학습자에게 원문을 보여 준다(기출 csat_item 과 다르다). 그래도 권리 · Gold 는 사람 결정
// 원장(content_human_decision)에 사람 행이 있어야 공급된다 — 이 파일의 provenance.humanGold/rights 는 상태 표시일 뿐 승인이 아니다.
// 채점 주석은 기존 「주장과 근거」 형식(claim · support · supportDisputed · relationProbe)을 그대로 쓰고 중심 의미 선택지(answer)를 더한다.
// Gold hash · revision 은 DB 가 jsonb 에서 계산한다(authored_item_gold_hash) — 여기서 다시 계산하지 않는다(jsonb 직렬화가 JSON.stringify 와 다르다).
import { RELATIONS, type Relation } from '../claim-support-labels'
import { gradeClaimSupport, parseResponse, type ClaimSupportAnnotation, type ClaimSupportGrade } from '../claim-support'

import r5Set from './r5-central-meaning.v1.json'

export const AUTHORED_REF_PREFIX = 'authored:'
export const ASSESSMENT_ROLES = ['independent_check', 'transfer', 'delayed_check'] as const
export const INSTRUCTION_ROLES = ['model_explanation', 'guided_practice'] as const
export type AuthoredRole = (typeof ASSESSMENT_ROLES)[number] | (typeof INSTRUCTION_ROLES)[number]

export const DISTRACTOR_DESIGNS = ['opposed_view', 'too_narrow', 'off_text', 'distorted', 'reversed'] as const
export type DistractorDesign = (typeof DISTRACTOR_DESIGNS)[number]

export interface TeachStep { step: string; text: string; sentences: number[] }

export interface AuthoredBody {
  sentences: string[]
  stem: string
  choices: string[]
  /** 교수(model_explanation) — 출제 원리를 문장 번호와 함께 단계별로 */
  teach?: TeachStep[]
  /** 안내 연습(guided_practice) — 학습자가 열어 보는 단서 */
  hints?: string[]
}

export interface AuthoredGold {
  answer: number
  claim: number
  claimRestated: number[]
  support: number[]
  supportDisputed: number[]
  opposed: number[]
  relationProbe: { sentence: number; relation: Relation }
  /** 한 줄 요지(모범) — 응답 뒤에만 보인다 */
  gist: string
  distractors: { choice: number; design: DistractorDesign; why: string }[]
}

export interface AuthoredItem {
  id: string
  role: AuthoredRole
  passageGroup: string
  body: AuthoredBody
  gold: AuthoredGold
}

export interface AuthoredSet {
  set: string
  taskId: string
  taskKey: string
  provenance: { author: string; method: string; derivedFrom: string[]; createdAt: string; humanGold: string; rights: string }
  items: AuthoredItem[]
}

export const R5_AUTHORED_SET = r5Set as AuthoredSet

export const isAssessmentRole = (r: string): boolean => (ASSESSMENT_ROLES as readonly string[]).includes(r)
export const authoredRef = (id: string) => `${AUTHORED_REF_PREFIX}${id}`
export const isAuthoredRef = (ref: string) => ref.startsWith(AUTHORED_REF_PREFIX)
const setVersion = (s: AuthoredSet) => s.set.slice(s.set.lastIndexOf('.') + 1)
/** 채점 주석 ref — 과제 키로 시작해야 한다(DB check · G2 결속 규칙) */
export const annotationRefOf = (s: AuthoredSet, item: AuthoredItem) => `${s.taskKey}-${item.id}.${setVersion(s)}`

/** 세트 규칙 위반 목록(빈 배열 = 통과). 등록 전 · 테스트에서 돈다 */
export function validateAuthoredSet(s: AuthoredSet): string[] {
  const errs: string[] = []
  const ids = new Set<string>()
  const groupClass = new Map<string, 'instruction' | 'assessment'>()
  if (!/^[a-z]\.[a-z_]{2,60}$/.test(s.taskId)) errs.push(`taskId 형식: ${s.taskId}`)
  if (!/^[a-z][a-z0-9-]{2,60}$/.test(s.taskKey)) errs.push(`taskKey 형식: ${s.taskKey}`)
  if (s.provenance.derivedFrom.length > 0) errs.push('창작 세트는 원천 지문에서 파생되지 않아야 한다(derivedFrom 비어 있음)')
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
    const n = it.body.sentences.length
    if (n < 2 || n > 30) errs.push(`${at} 문장 수 ${n}`)
    if (it.body.choices.length !== 5) errs.push(`${at} 선택지는 5개`)
    const g = it.gold
    const inRange = (k: number) => Number.isInteger(k) && k >= 0 && k < n
    const all = [g.claim, ...g.claimRestated, ...g.support, ...g.supportDisputed, ...g.opposed, g.relationProbe.sentence]
    if (!all.every(inRange)) errs.push(`${at} 문장 번호 범위 밖`)
    const buckets = [g.claimRestated, g.support, g.supportDisputed, g.opposed]
    const seen = new Set<number>([g.claim])
    for (const b of buckets) for (const k of b) {
      if (seen.has(k)) errs.push(`${at} 문장 ${k} 가 두 범주에 있다`)
      seen.add(k)
    }
    if (g.support.length === 0) errs.push(`${at} 뒷받침 문장이 없다`)
    if (!RELATIONS.includes(g.relationProbe.relation)) errs.push(`${at} 관계 ${g.relationProbe.relation}`)
    if (g.relationProbe.sentence === g.claim) errs.push(`${at} 관계 질문이 주장 문장을 묻는다`)
    const probeIn = g.relationProbe.relation === 'opposed' ? g.opposed : g.relationProbe.relation === 'restatement' ? g.claimRestated : g.support
    if (!probeIn.includes(g.relationProbe.sentence)) errs.push(`${at} 관계 질문 문장이 그 관계 범주에 없다`)
    if (!Number.isInteger(g.answer) || g.answer < 0 || g.answer > 4) errs.push(`${at} 정답 번호`)
    const dc = g.distractors.map((d) => d.choice).sort()
    const want = [0, 1, 2, 3, 4].filter((k) => k !== g.answer)
    if (JSON.stringify(dc) !== JSON.stringify(want)) errs.push(`${at} 오답 설계가 정답 외 4개를 모두 덮지 않는다`)
    if (!g.distractors.every((d) => DISTRACTOR_DESIGNS.includes(d.design) && d.why.length > 0)) errs.push(`${at} 오답 설계 유형/이유`)
    if (g.gist.trim().length < 8) errs.push(`${at} 한 줄 요지가 비었다`)
    if (it.role === 'model_explanation' && !(it.body.teach && it.body.teach.length >= 3)) errs.push(`${at} 교수 단계가 없다`)
    if (it.role === 'guided_practice' && !(it.body.hints && it.body.hints.length >= 1)) errs.push(`${at} 안내 단서가 없다`)
    if (isAssessmentRole(it.role) && (it.body.teach || it.body.hints)) errs.push(`${at} 평가 문항에 해설 · 단서가 있다`)
  }
  return errs
}

/** 학습자에게 보내는 본문 — Gold 는 절대 넣지 않는다. 교수 단계는 교수 역할에서만 */
export interface AuthoredLearnerView {
  ref: string
  role: AuthoredRole
  sentences: string[]
  stem: string
  choices: string[]
  teach: TeachStep[] | null
  hints: string[] | null
}

export function learnerView(s: AuthoredSet, it: AuthoredItem): AuthoredLearnerView {
  return {
    ref: authoredRef(it.id),
    role: it.role,
    sentences: it.body.sentences,
    stem: it.body.stem,
    choices: it.body.choices,
    teach: it.role === 'model_explanation' ? it.body.teach ?? null : null,
    hints: it.role === 'guided_practice' ? it.body.hints ?? null : null,
  }
}

export interface AuthoredResponse {
  claim: number
  support: number[]
  relation: Relation
  choice: number
}

export interface AuthoredGrade extends ClaimSupportGrade {
  choiceOk: boolean
  /** 고른 오답의 설계 유형(정답이면 null) — 「왜 끌렸나」 피드백 */
  choiceDesign: DistractorDesign | null
}

const asAnnotation = (it: AuthoredItem, version: string): ClaimSupportAnnotation => ({
  version,
  itemId: authoredRef(it.id),
  skeletonSig: '',
  sentenceCount: it.body.sentences.length,
  claim: it.gold.claim,
  claimRestated: it.gold.claimRestated,
  support: it.gold.support,
  // 주장 · 다시 말하기 문장은 뒷받침으로 골라도 감점하지 않는다 — 맹검 2인이 주장 문장을 서로 다르게 고른 문항이 있다(리뷰 기록)
  supportDisputed: [...it.gold.supportDisputed, ...it.gold.claimRestated, it.gold.claim],
  opposed: it.gold.opposed,
  relationProbe: it.gold.relationProbe,
  answerAnchorOverlap: { answerAnchorSentences: [it.gold.claim], note: 'authored' },
  provenance: { annotator: '', independentReviewer: '', reviewerBlind: true, agreement: '', resolved: '', reviewedAt: '' },
})

/** 응답 검사 + 채점. 형식이 틀리면 null(라우트가 400) */
export function gradeAuthored(s: AuthoredSet, it: AuthoredItem, raw: unknown): { response: AuthoredResponse; grade: AuthoredGrade } | null {
  const ann = asAnnotation(it, annotationRefOf(s, it))
  const cs = parseResponse(raw, ann)
  if (!cs) return null
  const choice = (raw as { choice?: unknown }).choice
  if (!Number.isInteger(choice) || (choice as number) < 0 || (choice as number) >= it.body.choices.length) return null
  const base = gradeClaimSupport(ann, cs)
  const choiceOk = choice === it.gold.answer
  // 주장을 다른 말로 다시 한 문장도 중심 문장이다 — 맹검 2인이 item-1·2·7 에서 주장/다시 말하기를 서로 바꿔 골랐다.
  // 합리적인 해석을 오답 처리하지 않는다(FINAL §4.3). 정확한 주장 문장인지는 claimOk 로 따로 남긴다.
  const centralOk = base.claimOk || it.gold.claimRestated.includes(cs.claim)
  return {
    response: { ...cs, choice: choice as number },
    grade: {
      ...base,
      claimRestated: !base.claimOk && it.gold.claimRestated.includes(cs.claim),
      choiceOk,
      choiceDesign: choiceOk ? null : it.gold.distractors.find((d) => d.choice === choice)?.design ?? null,
      // 이 TASK 의 증거 = 「한 줄 요지(선택) + 중심 문장」 — 둘 다 맞아야 정답. 뒷받침 · 관계는 피드백으로 남는다
      isCorrect: choiceOk && centralOk,
    },
  }
}

/** 응답 뒤 공개하는 해설(Gold 파생) — 독립 확인도 응답 뒤에는 보여 준다(풀이 전에는 절대 아님) */
export function revealAfterAnswer(it: AuthoredItem) {
  return {
    gist: it.gold.gist,
    answer: it.gold.answer,
    claim: it.gold.claim,
    claimRestated: it.gold.claimRestated,
    support: it.gold.support,
    opposed: it.gold.opposed,
    distractors: it.gold.distractors,
  }
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

const SETS: AuthoredSet[] = [R5_AUTHORED_SET]

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
