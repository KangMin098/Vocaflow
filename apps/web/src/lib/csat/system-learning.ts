// apps/web/src/lib/csat/system-learning.ts
//
// **학습 정리 — 시스템이 미리 갖춘 자료만으로 정리 · 확인 · 다음 활동을 만든다.** (T-0091 · 2026-10-23 사용자 승인 설계)
//
// 제품 계약(DECISIONS CL-SL-1):
//   · 학습자가 손으로 쓴 글을 평가하지 않는다 — 자유 서술 입력 · 자기 채점 · 자기 이해도 판정 · 임의 자료 평가를 만들지 않는다.
//   · 정리에 보이는 관계 · 근거 · 원리/조건/반례는 모두 검수 · 계약 자료(teaching-contract · 탐구 원리 · 오답 블록)에서 온다.
//     해설 산문에서 채점 기준 · 오답 후보를 즉석 추측하지 않는다 — 자료가 없으면 「준비 중」으로 말한다.
//   · 자료 준비 상태(prepared/preparing)와 학습 성취는 다른 축이다. 정리를 열람 · 보관해도 숙달 · 독립 수행으로 세지 않는다.
//   · 개인화 = 제공 자료의 보관 · 표시 · 분류와 실제 수행 기록뿐. 과거에 쓴 글은 지우거나 고치지 않고 읽기 전용으로만 보인다.

import type { EvidenceUnit, TeachingModel } from './teaching-contract'
import type { InquiryPrinciple } from './inquiry/labels'
import type { SceneId } from './inquiry/scenes'

/** 근거 단위 이름 — 문장 밖 단위(표 칸 · 빈칸 · 밑줄 …)도 그 단위로 부른다(teaching-contract) */
export const UNIT_LABEL: Record<EvidenceUnit, string> = {
  sentence: '문장',
  paragraph: '문단',
  underline: '밑줄',
  blank: '빈칸',
  choice: '선택지',
  table_cell: '표 칸',
  chart_series: '도표 계열',
  notice_item: '안내문 항목',
  summary_slot: '요약문 빈칸',
}

/** 확인 과제 준비 상태 — 사전에 정답 · 허용 근거 · 피드백이 구축된 과제가 있을 때만 prepared */
export type CheckReadiness = 'prepared' | 'preparing'

export interface SummaryEvidence {
  /** 오답 블록 key(analysis:reject:n) — 강조 · 이동에 쓴다 */
  key: string
  choice: number | null
  title: string
  /** 검수된 설명 첫 문단 — 새로 쓰지 않는다 */
  body: string
}

export interface NextActivity {
  id: 'evidence' | 'compare' | 'checks' | 'lecture'
  label: string
  /** 이동할 장면 — 강의는 없다(탭 전환) */
  scene: SceneId | null
}

export interface LearningSummary {
  /** 핵심 관계 — 유형 교수 계약의 관계 문장(없으면 null) */
  relation: string | null
  units: string[]
  principle: InquiryPrinciple | null
  evidence: SummaryEvidence[]
  checks: { readiness: CheckReadiness; count: number; scene: SceneId | null }
  next: NextActivity[]
}

/** 과거 작성 기록 여부 — 있을 때만 읽기 전용 열람을 연다 */
export function hasWrittenHistory(counts: { explanations: number; notes: number; meaning?: number }): boolean {
  return counts.explanations + counts.notes + (counts.meaning ?? 0) > 0
}

/**
 * 정리 모델 — 입력은 모두 이미 구축된 자료다. 같은 입력이면 같은 정리(시각 · 무작위 없음).
 * checks: 이 문항의 사전 구축 이해 확인(정답 · 피드백 포함). 없으면 「확인 과제 준비 중」.
 */
export function buildLearningSummary(input: {
  goal: Pick<TeachingModel, 'relation' | 'units'> | null
  principle: InquiryPrinciple | null
  rejects: { key: string; title: string; body: string[] }[]
  checks: { kind: 'evidence' | 'lure' }[]
  checkScene: (kind: 'evidence' | 'lure') => SceneId
  hasCompare: boolean
  hasLecture: boolean
}): LearningSummary {
  const evidence = input.rejects
    .filter((b) => b.body.some((p) => p.trim()))
    .map((b) => {
      const n = Number(b.key.split(':').pop())
      return { key: b.key, choice: Number.isInteger(n) ? n : null, title: b.title, body: b.body.find((p) => p.trim()) as string }
    })
  const first = input.checks[0]
  const checkScene = first ? input.checkScene(first.kind) : null
  const next: NextActivity[] = []
  if (evidence.length) next.push({ id: 'evidence', label: '문항 성립에서 근거 다시 짚기', scene: 'judgment' })
  if (input.checks.length && checkScene) next.push({ id: 'checks', label: `준비된 확인 과제 ${input.checks.length}개 풀기`, scene: checkScene })
  if (input.hasCompare) next.push({ id: 'compare', label: '검수된 기출 비교로 경계 확인', scene: 'compare' })
  if (input.hasLecture) next.push({ id: 'lecture', label: '강의로 다시 보기', scene: null })
  return {
    relation: input.goal?.relation?.trim() || null,
    units: [...new Set((input.goal?.units ?? []).map((u) => UNIT_LABEL[u]).filter(Boolean))],
    principle: input.principle && input.principle.statement.trim() ? input.principle : null,
    evidence,
    checks: { readiness: input.checks.length ? 'prepared' : 'preparing', count: input.checks.length, scene: checkScene },
    next,
  }
}

// ── 안내 연습(원문 요지 → 제목 → 주제) — 서술 칸 대신 고르는 시스템 카드 ────────────────────────
// 저장 계약(ReflectionBody: relation · comparison · procedure 문자열)은 그대로다. 학습자가 쓰지 않고, 고른 카드 문장 ·
// 시스템이 계산한 대조 사실이 그 칸에 담긴다. 서버 피드백(근거 충분/함께 검토)은 문장 선택으로만 정해진다.

export interface SystemCard {
  id: string
  text: string
}

/** 근거 → 판단의 관계 카드(요지 · 주제) */
export const RELATION_CARDS: readonly SystemCard[] = [
  { id: 'reason', text: '근거 문장이 판단의 이유를 든다' },
  { id: 'example', text: '근거 문장이 판단을 사례로 보여 준다' },
  { id: 'contrast', text: '근거 문장이 반대 생각과 대조해 판단을 드러낸다' },
  { id: 'condition', text: '근거 문장이 판단이 성립하는 조건 · 범위를 한정한다' },
]

/** 제목 단계 — 문장과 글 전체를 묶는 표현의 관계 카드 */
export const TITLE_RELATION_CARDS: readonly SystemCard[] = [
  { id: 'metaphor', text: '그 문장의 핵심 표현을 제목이 비유로 압축한다' },
  { id: 'keyword', text: '그 문장의 핵심어를 제목이 그대로 이어받는다' },
  { id: 'question', text: '그 문장의 판단을 제목이 물음 꼴로 바꾼다' },
]

/** 주제 단계 — 다른 글에도 쓰는 절차 카드 */
export const PROCEDURE_CARDS: readonly SystemCard[] = [
  { id: 'claim-first', text: '필자의 판단 문장을 먼저 찾고, 그 문장을 받치는 근거 문장을 모은다' },
  { id: 'repeat', text: '글 전체에서 되풀이되는 핵심어를 모아 판단 문장과 맞춰 본다' },
  { id: 'turn', text: '역접 · 결론 표지 뒤 문장을 판단 후보로 놓고 근거와 맞는지 확인한다' },
]

export function relationCardsFor(step: 'main_point' | 'title' | 'topic'): readonly SystemCard[] {
  return step === 'title' ? TITLE_RELATION_CARDS : RELATION_CARDS
}

/**
 * 내 선택과 시범의 대조 — 학습자가 쓰지 않는다. 시범이 짚은 문장(0-기반)과 고른 문장을 셈만 한다(평가 · 점수 아님).
 */
export function compareWithModel(claim: number | null, support: readonly number[], modelSentences: readonly number[]): string {
  const model = new Set(modelSentences)
  const mine = [...new Set([...(claim === null ? [] : [claim]), ...support])].sort((a, b) => a - b)
  const same = mine.filter((i) => model.has(i))
  const onlyMine = mine.filter((i) => !model.has(i))
  const onlyModel = [...model].filter((i) => !mine.includes(i)).sort((a, b) => a - b)
  const nums = (xs: number[]) => (xs.length ? xs.map((i) => i + 1).join('·') : '없음')
  return `시범과 같은 문장 ${nums(same)} · 내가 더 고른 문장 ${nums(onlyMine)} · 시범만 짚은 문장 ${nums(onlyModel)}`
}
