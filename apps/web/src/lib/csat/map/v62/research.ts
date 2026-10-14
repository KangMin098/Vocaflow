// apps/web/src/lib/csat/map/v62/research.ts
//
// v6.2 P-M3 — TASK 별 「학습 행동」 구분과 연구 v1.4 근거(읽기 전용 스냅샷 research-v14.data.json)를 Inspector 가 읽는 모양으로.
//   학습 행동: R5 = 선지 없이 중심 구성 ↔ 선지를 보고 고르기 · E3 = 정답 찾기(AI) ↔ 다섯 선지 전체 검증(FOV). 각 행동이 제품에 지금 있는지(실제 과제 키)를 같이 적는다.
//   연구 근거: 원문 결속 AI 검토(R1) — 두 AI 판정과 일치 여부를 그대로. 검증된 관련성 · 학생 능력 · 교수 효과가 아니다. 문항 링크를 주지 않는다(노출 원장 보호).
// 순수 모듈 — 판정 · 순위에 쓰지 않는다(NeedRank 승격 금지 · v1.4 forbidden).

import type { TaskId } from '../v4/definition'

import RESEARCH from './research-v14.data.json'
import { makeLink, type Relevance, type TaskItemLink } from './relevance'

export interface LearningBehavior {
  id: string
  name: string
  /** 학습자가 실제로 하는 일 */
  does: string
  /** 제품에 지금 있는 과제(확인 과제 키) — 없으면 null */
  productKey: string | null
  /** 없을 때 상태 */
  status: 'available' | 'design_only' | 'not_started'
}

/** v6.2 §4 · §7.2 · v1.4 즉시 참고 설계 — 같은 TASK 안에서도 서로 다른 학습 · 평가 주장이다 */
export const BEHAVIORS: Readonly<Record<TaskId, readonly LearningBehavior[]>> = {
  'r.central_meaning': [
    { id: 'r5-locate', name: '선지 없이 중심 · 근거 문장 가리기', does: '선지를 보기 전에 본문에서 주장 문장과 그것을 떠받치는 문장 · 관계를 고른다', productKey: 'claim-support', status: 'available' },
    { id: 'r5-generate', name: '선지 없이 중심 의미 만들기', does: '자기 말로 주제 대상 · 중심 서술 · 조건 범위를 쓴다(같은 뜻의 다른 표현 허용)', productKey: null, status: 'design_only' },
    { id: 'r5-compare', name: '만든 중심과 선지 비교', does: '선지가 범위를 보존했는지 · 넓히거나 좁혔는지 가린다', productKey: null, status: 'design_only' },
  ],
  'e.option_correspondence': [
    { id: 'e3-ai', name: '정답 찾기(AI)', does: '정답 선지 하나가 다시 말한 본문 문장을 찾는다', productKey: 'option-restate', status: 'available' },
    { id: 'e3-fov', name: '다섯 선지 전체 검증(FOV)', does: '다섯 선지 각각이 왜 성립 · 불성립하는지 주체 · 극성 · 범위 · 강도 · 조건으로 설명한다', productKey: null, status: 'design_only' },
    { id: 'e3-fit', name: '본문 지지 ↔ 발문 적합 구분', does: '본문이 말하는가(textual support)와 발문이 묻는 것에 맞는가(task fit)를 따로 판단한다', productKey: null, status: 'design_only' },
  ],
  'e.evidence_location': [
    { id: 'e2-locate', name: '판단을 정하는 근거 문장 찾기', does: '빈칸 · 판단을 정하는 본문 문장을 고른다(유인 문장과 구별)', productKey: 'evidence-locate', status: 'available' },
  ],
  's.form_scope': [
    { id: 's5-scope', name: '작용 범위 풀어 쓰기', does: '부정 · 비교 · 양화 · 조건이 무엇에 걸리는지 완성 명제로 쓴다', productKey: null, status: 'design_only' },
  ],
  'v.contextual_sense': [
    { id: 'v2-sense', name: '문맥 뜻 고르고 다른 뜻 배제', does: '지정 표현의 뜻 후보 중 문맥 단서로 하나를 고르고 나머지를 배제한 이유를 쓴다', productKey: null, status: 'design_only' },
  ],
}

export const BEHAVIOR_STATUS_LABEL: Record<LearningBehavior['status'], string> = {
  available: '지금 할 수 있어요',
  design_only: '연구 설계만 있어요(공개 전)',
  not_started: '준비 전',
}

type Snapshot = typeof RESEARCH
export type ResearchTask = Snapshot['tasks'][number]

export interface ResearchView {
  source: Snapshot['source']
  /** 공개 · 평가 자격 — v1.4 는 R0 · R1 만 통과 */
  gate: ResearchTask['gate'] | null
  definition: string | null
  methods: ResearchTask['methods']
  activities: ResearchTask['activities']
  /** 원문 결속 AI 검토 — 두 판정 · 일치 */
  reviews: { item: string; type: string; first: string; second: string | null; agree: boolean }[]
  status: Snapshot['status']
}

export function researchFor(task: TaskId): ResearchView | null {
  const t = RESEARCH.tasks.find((x) => x.task === task) ?? null
  const reviews = RESEARCH.links.filter((l) => l.task === task)
  if (!t && reviews.length === 0) return null
  return {
    source: RESEARCH.source,
    gate: t?.gate ?? null,
    definition: t?.definition ?? null,
    methods: t?.methods ?? [],
    activities: t?.activities ?? [],
    reviews,
    status: RESEARCH.status,
  }
}

/**
 * 연구 검토 행 → 관련성 계약(relevance.ts). 사람 검수가 아니므로 relevance 는 unknown 으로 두고,
 * 두 AI 가 같은 판정일 때만 candidateRelevance 에 싣는다(R1). 갈린 행은 후보도 비운다(합의로 지우지 않는다).
 */
export function researchLinks(): TaskItemLink[] {
  return RESEARCH.links.map((l) => {
    const cand: Exclude<Relevance, 'not_applicable'> | null = l.agree && (l.first === 'direct' || l.first === 'indirect') ? l.first : null
    return makeLink({ task: l.task, item: l.item, source: 'research_ai_reviewed', candidateRelevance: cand, analysisVersion: `v1.4@${RESEARCH.source.commit}` })
  })
}
