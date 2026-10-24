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
import type { MeaningSupportView } from '@/lib/csat/meaning-support/labels'
import type { SkeletonSentence } from '@/lib/csat/passage-skeleton'
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
  /** v3 비교 쌍 전체 */
  v3Pairs: V3PairView[]
  inquiry: Pick<InquiryRecord, 'distractors' | 'principle'> & { v3?: { choices: NonNullable<InquiryRecord['v3']>['choices']; claims: NonNullable<InquiryRecord['v3']>['design']['claims']; limitation: string; requirement: NonNullable<InquiryRecord['v3']>['requirement']; meanings: NonNullable<InquiryRecord['v3']>['meanings'] } }
  gate: { answer: number | null; evidence: number[]; selection: string | null; transform_note: string | null }
  /** 지도 문장(근거 인용 · 앵커 id 포함, `splitMapSentences`) — 지도가 없으면 null */
  mapSentences?: SkeletonSentence[] | null
  /** 원문 이해 교수 설명 전체(`splitMeaningSupport`) — 없으면 null */
  meaningSupport?: MeaningSupportView | null
}

const ANSWER_CHIP = /^정답 \S+$/
// 첫 응답에 남기는 블록은 머리(문항 이름 · 유형 · 배점 — 정답 칩은 바꾼다)와 어휘뿐이다. 재는 능력 · 출제 의도 · 절차도 문항별 풀이라
// 실제 분석에 정답 성분 · 소거 순서가 들어 있다(T-0147 Codex R147-02: 2015#33 의도 「정답이 '크다 + 느슨하다 + 경쟁적이다' …」,
// 분석 산출물 1,165행 중 507행 후보). 문장 단위 결정성 감수 전까지는 블록째 공개 응답으로 옮긴다(fail-closed)
const confirms = (b: TheaterBlock) => b.kind !== 'head' && b.kind !== 'vocab'

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
        // 의미 단위도 통째로 옮긴다 — 키워드 필터는 결정적 설명을 놓쳤다(R147-08: 2014A#39 「… 끝나는 지점이 ④ 앞이다」 · 2014A#27 밑줄 ④ 문맥).
        // 문장 단위 결정성 감수 전까지 fail-closed. 발문 · 읽기 범위는 일반 지시라 남긴다
        ...(v3
          ? {
              v3: {
                ...v3,
                // 발문 요약(requested) · 읽기 범위도 옮긴다 — 정답의 뜻을 그대로 적는 문항이 있다(R147-09). 첫 응답은 극성만
                requirement: { requested: '', polarity: v3.requirement.polarity, conditions: [] },
                meanings: [],
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
      // v3 비교 쌍은 통째로 공개 응답으로 — 선지 번호를 빼도 relation · focus · differences 문장이 오답 소거를 적는다(R147-06: 2014A#23 「왼쪽 ①은 …」)
      v3Pairs: [],
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
      v3Pairs: full.v3Pairs,
      inquiry: {
        distractors: full.inquiry?.distractors ?? [],
        principle: full.inquiry?.principle ?? null,
        ...(v3 ? { v3: { choices: v3.choices, claims: v3.design.claims, limitation: v3.design.limitation, requirement: v3.requirement, meanings: v3.meanings } } : {}),
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
  const at = base.findIndex((b) => b.kind === 'vocab')
  const add = reveal.blocks.filter((b) => b.kind !== 'head')
  const blocks = at < 0 ? [...base, ...add] : [...base.slice(0, at), ...add, ...base.slice(at)]
  const v3 = initial.inquiry?.v3
  return {
    blocks,
    anchors: reveal.anchors,
    placements: reveal.placements,
    checks: reveal.checks,
    comparePairs: reveal.comparePairs,
    v3Pairs: reveal.v3Pairs,
    inquiry: initial.inquiry
      ? {
          ...initial.inquiry,
          distractors: reveal.inquiry.distractors,
          principle: reveal.inquiry.principle,
          ...(v3 && reveal.inquiry.v3
            ? {
                v3: {
                  ...v3,
                  requirement: reveal.inquiry.v3.requirement,
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

/**
 * 원문 이해 교수 설명(meaningSupport) — 통째로 공개 응답으로 옮긴다. 선지 연결(bridges)만이 아니라 본문도 선지 판정을 적는다
 * (T-0147 Codex R147-01 · R147-05: 2026#30 whole.summaryKo 「⑤는 이와 충돌한다」 · 2026#35 units 「흐름 밖의 문장 … (④)」).
 * 문장 단위 결정성 감수 전까지 첫 응답에는 싣지 않는다(fail-closed).
 */
export function splitMeaningSupport(view: MeaningSupportView | null): { initial: MeaningSupportView | null; reveal: MeaningSupportView | null } {
  return { initial: null, reveal: view }
}

export function mergeMeaningSupport(initial: MeaningSupportView | null, revealed: MeaningSupportView | null | undefined): MeaningSupportView | null {
  return revealed ?? initial
}

/**
 * 지도 문장 골격 — 첫 응답에는 문장 길이만 둔다. 문장 안의 `reveals`(앵커 id 와 근거 인용)는 정답 근거 자리 · 오답 id 를 그대로 담는다
 * (T-0147 Codex R147-07: 배포 골격 802건 전부 answer 표식, 445건은 오답 id 넷이 모두 있어 남는 선지로 정답 확정). 공개 응답이 원래 문장을 돌려준다.
 */
export function splitMapSentences(sentences: SkeletonSentence[]): { initial: SkeletonSentence[]; reveal: SkeletonSentence[] } {
  return { initial: sentences.map((s) => ({ chars: s.chars, reveals: [] })), reveal: sentences }
}
