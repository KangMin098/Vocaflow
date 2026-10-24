// apps/web/src/lib/csat/lecture/answer-split.ts
//
// **판단 장면 정답 지연 조회 (b) — 첫 응답과 공개 응답을 가르는 한 곳.**
//
// 문항 해설 페이지의 첫 HTML · RSC props 에는 정답을 정하거나 확정하는 자료를 싣지 않는다. 학습자가 정답을 명시적으로
// 요청하면 서버(`POST /api/csat/item/[slug]/judgment`)가 노출 원장(learning_exposure_record)을 먼저 커밋하고 나서야
// 나머지(`AnswerReveal`)를 돌려준다. 이 파일은 순수 함수만 둔다 — 서버 로더(`lib/csat/judgment-reveal.ts`)와
// 클라이언트(AnalysisTheater 의 병합)가 같은 규칙을 쓴다. 타입만 import 한다(정본 JSON 이 브라우저 번들에 들어가지 않게).
//
// 첫 응답에 남기는 것: 원문 · 지도 문장 골격 · 재는 능력 · 출제 의도 · 절차 · 어휘 · v3 의미 단위 · 발문 요구 ·
// 설계 역할 · 패턴 · 단서(비결정적 근거 탐색). 공개 응답으로 옮기는 것(설계 주장 · 설계 한계 문장 포함): 머리 정답 칩 · 정답 근거 · 오답 소거 블록 ·
// 지도 정답/오답 앵커와 자리 · 이해 확인 과제(정답 근거 · 오답 번호) · 비교 쌍 선지 번호 · 함정 · v3 선지 판정 ·
// 설계 주장 · 오답 설계 · 문항 원리 · 설계 selection/transform_note · 정답 번호 · 정답 근거 문장.

import type { ComparePair } from '@/components/csat/theater/ComparePairs'
import type { InquiryRecord, V3PairView } from '@/lib/csat/inquiry/labels'
import type { MapAnchor, MapPlacement } from '@/lib/csat/passage-map-model'
import type { GateKey } from '@/lib/csat/reveal-gate'
import type { TheaterBlock } from '@/lib/csat/theater'
import type { UnderstandingCheck } from '@/lib/csat/understanding-check'

export interface TheaterAnswerData {
  blocks: TheaterBlock[]
  anchors: MapAnchor[]
  placements: MapPlacement[]
  checks: UnderstandingCheck[]
  comparePairs: ComparePair[]
  v3Pairs: V3PairView[]
  inquiry: InquiryRecord | null
  gate: GateKey
}

/** 공개 응답 — 노출 원장 커밋 뒤에만 서버가 보낸다 */
export interface AnswerReveal {
  analysisVersion: number | null
  /** 정답을 확정하는 블록(정답 근거 · 오답 소거)과 정답 칩이 있는 머리 블록 */
  blocks: TheaterBlock[]
  anchors: MapAnchor[]
  placements: MapPlacement[]
  checks: UnderstandingCheck[]
  comparePairs: ComparePair[]
  /** v3 쌍별 매핑 선지 번호(매핑 순서대로) */
  v3Choices: { pairId: string; choices: { self?: number[]; other?: number[] }[] }[]
  inquiry: Pick<InquiryRecord, 'distractors' | 'principle'> & { v3?: { choices: NonNullable<InquiryRecord['v3']>['choices']; claims: NonNullable<InquiryRecord['v3']>['design']['claims']; limitation: string; conditions: string[]; meanings: NonNullable<InquiryRecord['v3']>['meanings'] } }
  gate: { answer: number | null; evidence: number[]; selection: string | null; transform_note: string | null }
}

const ANSWER_CHIP = /^정답 \S+$/
/** 의미 단위 설명이 정답 · 특정 선지를 가리키는가(실제 정본 4건: 「정답 제목 …」 · 「빈칸 선지 ④의 …」) */
const POINTS_AT_CHOICE = /정답|선지\s*[①-⑤\d]|\d\s*번\s*선지/
const confirms = (b: TheaterBlock) => b.kind === 'answer' || b.kind === 'reject'

/** 전체 자료 → 첫 응답(정답 없음) + 공개 응답 */
export function splitAnswer(full: TheaterAnswerData, analysisVersion: number | null): { initial: TheaterAnswerData; reveal: AnswerReveal } {
  const head = full.blocks.find((b) => b.kind === 'head')
  const initialBlocks = full.blocks
    .filter((b) => !confirms(b))
    .map((b) => (b.kind === 'head' ? { ...b, chips: b.chips.map((c) => (ANSWER_CHIP.test(c.text) ? { text: '정답 확인 전', tone: 'quiet' as const } : c)) } : b))
  const v3 = full.inquiry?.v3
  const initialInquiry: InquiryRecord | null = full.inquiry
    ? {
        analysis_version: full.inquiry.analysis_version,
        review: full.inquiry.review,
        distractors: [],
        principle: null,
        // 설계 한계 문장도 옮긴다 — 실제 정본 45건이 「2~5번 선지의 content_truth=false」 처럼 선지 판정을 적는다(전수 검사)
        // 발문 조건(requirement.conditions)도 옮긴다 — 59건이 「④는 …와 대조한다」 · 「정답은 … 어긋나는 선지」 처럼 선지별 판정을 적는다.
        // 의미 단위는 정답 · 특정 선지를 가리키는 것만 뺀다(근거 탐색은 남긴다). 발문 · 읽기 범위는 일반 지시라 남긴다
        ...(v3
          ? {
              v3: {
                ...v3,
                requirement: { ...v3.requirement, conditions: [] },
                meanings: v3.meanings.filter((m) => !POINTS_AT_CHOICE.test(`${m.meaning_ko} ${m.scope.note ?? ''}`)),
                choices: [],
                design: { claims: [], limitation: '' },
              },
            }
          : {}),
      }
    : null
  const design = full.gate.design
  return {
    initial: {
      blocks: initialBlocks,
      anchors: [],
      placements: [],
      checks: [],
      comparePairs: [],
      v3Pairs: full.v3Pairs.map((p) => ({ ...p, mappings: p.mappings.map((m) => ({ ...m, self: { sentences: m.self.sentences }, other: { sentences: m.other.sentences } })) })),
      inquiry: initialInquiry,
      gate: { answer: null, evidence: [], design: design ? { ...design, selection: '', transform_note: '' } : design },
    },
    reveal: {
      analysisVersion,
      blocks: [...(head ? [head] : []), ...full.blocks.filter(confirms)],
      anchors: full.anchors,
      placements: full.placements,
      checks: full.checks,
      comparePairs: full.comparePairs,
      v3Choices: full.v3Pairs.map((p) => ({ pairId: p.pairId, choices: p.mappings.map((m) => ({ ...(m.self.choices ? { self: m.self.choices } : {}), ...(m.other.choices ? { other: m.other.choices } : {}) })) })),
      inquiry: {
        distractors: full.inquiry?.distractors ?? [],
        principle: full.inquiry?.principle ?? null,
        ...(v3 ? { v3: { choices: v3.choices, claims: v3.design.claims, limitation: v3.design.limitation, conditions: v3.requirement.conditions, meanings: v3.meanings } } : {}),
      },
      gate: { answer: full.gate.answer, evidence: full.gate.evidence, selection: design?.selection ?? null, transform_note: design?.transform_note ?? null },
    },
  }
}

/**
 * 첫 응답 + 공개 응답 → 전체 자료. 블록 순서는 종류로 맞춘다(theaterBlocks 순서: 머리 · 재는 능력 · 의도 · 정답 근거 · 오답 · 절차 · 어휘) —
 * 첫 응답에 「원래 순서 키 목록」 을 실으면 오답 번호(reject:n)가 다시 새므로 싣지 않는다.
 */
export function mergeReveal(initial: TheaterAnswerData, reveal: AnswerReveal): TheaterAnswerData {
  const head = reveal.blocks.find((b) => b.kind === 'head')
  const base = initial.blocks.map((b) => (b.kind === 'head' && head ? head : b))
  const at = base.findIndex((b) => b.kind === 'procedure' || b.kind === 'vocab')
  const add = reveal.blocks.filter((b) => b.kind !== 'head')
  const blocks = at < 0 ? [...base, ...add] : [...base.slice(0, at), ...add, ...base.slice(at)]
  const v3 = initial.inquiry?.v3
  return {
    blocks,
    anchors: reveal.anchors,
    placements: reveal.placements,
    checks: reveal.checks,
    comparePairs: reveal.comparePairs,
    v3Pairs: initial.v3Pairs.map((p) => {
      const c = reveal.v3Choices.find((x) => x.pairId === p.pairId)?.choices
      return c
        ? { ...p, mappings: p.mappings.map((m, i) => ({ ...m, self: { ...m.self, ...(c[i]?.self ? { choices: c[i].self } : {}) }, other: { ...m.other, ...(c[i]?.other ? { choices: c[i].other } : {}) } })) }
        : p
    }),
    inquiry: initial.inquiry
      ? {
          ...initial.inquiry,
          distractors: reveal.inquiry.distractors,
          principle: reveal.inquiry.principle,
          ...(v3 && reveal.inquiry.v3
            ? {
                v3: {
                  ...v3,
                  requirement: { ...v3.requirement, conditions: reveal.inquiry.v3.conditions },
                  meanings: reveal.inquiry.v3.meanings,
                  choices: reveal.inquiry.v3.choices,
                  design: { ...v3.design, claims: reveal.inquiry.v3.claims, limitation: reveal.inquiry.v3.limitation },
                },
              }
            : {}),
        }
      : null,
    gate: {
      answer: reveal.gate.answer,
      evidence: reveal.gate.evidence,
      design: initial.gate.design ? { ...initial.gate.design, selection: reveal.gate.selection ?? '', transform_note: reveal.gate.transform_note ?? '' } : initial.gate.design,
    },
  }
}
