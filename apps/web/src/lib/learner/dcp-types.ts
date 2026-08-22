// apps/web/src/lib/learner/dcp-types.ts
//
// DCP 문항 유형의 **단일 출처** — 재생용(학습자가 푼다) vs 교재용(인쇄물에만 쓴다).
//
// ⚠️ 이 파일이 갈리면 화면·채점·처방이 서로 다른 유형 집합을 믿는다.
//    `dcp-playable-types.integration` 이 DB 에 실제로 저장된 유형과 이 목록을 대조한다 —
//    새 유형을 적재하면 그 회귀가 먼저 빨개진다(실제로 여러 번 그렇게 잡혔다).

/** 코어 2종 — 문단을 다시 읽어야 풀리는 유형. 가장 먼저 재생 지원이 붙었다. */
export const CORE_DCP_TYPES = ['order', 'insert'] as const

/**
 * 5지선다 계열 — **지문 하나 + 선택지 다섯**으로 푸는 유형(수능 대표 9종).
 *
 * 아홉이 한 목록인 이유는 편의가 아니라 실측이다. DB 에 저장된 것들의 모양이 **완전히 같다**:
 *   payload    `{passage, choices[5], stem_ko, underline, summary_sentence, choice_language}`
 * 모양이 같으므로 파서·플레이어·채점이 하나면 된다. 유형마다 화면을 따로 만들면
 * 아홉 벌이 조금씩 다르게 낡는다.
 */
export const CHOICE_DCP_TYPES = [
  'topic',
  'blank',
  'main_point',
  'title',
  'summary',
  'purpose',
  'implication',
  'content_match',
  'claim',
] as const

/** 학습자가 실제로 푸는 유형 전체. */
export const PLAYABLE_DCP_TYPES = [...CORE_DCP_TYPES, ...CHOICE_DCP_TYPES] as const

/**
 * 교재(인쇄물)에만 쓰는 유형 — 학습자 화면에는 나가지 않는다.
 *
 * 지우면 안 된다. 교재 조판이 이 재고를 쓴다.
 */
export const TEXTBOOK_ONLY_DCP_TYPES = [
  'irrelevant',
  'word_order',
  'vocab_choice',
  // 2026-08-21 적재. **이 회귀가 실제로 잡아 냈다** — 580행을 넣은 직후 통합 테스트가
  // "분류되지 않은 유형 grammar_choice" 로 실패했고, 그래서 이 줄이 생겼다.
  'grammar_choice',

  // ── 학교 시험 축 4종 (2026-08-22 · 문항 10,239) ──────────────────────
  // 같은 회귀가 **세 번째로** 잡았다. 이 넷은 `SERIES_SPINE` 4단(중3)이 실제로 쓰는
  // 유형이라 서가에도 보이고 교재도 된다 — 그런데도 여기(교재 전용)에 두는 근거는
  // **payload 실측**이다. 위 선택지 갈래는 지문 + 선택지 5개를 요구하는데:
  //
  //   blank_word   3,564 — choices 0건 · passage 0건 · answer 0건 (답을 써 넣는 단답)
  //   grammar_fix  2,540 — 위와 같음
  //   unit_vocab   2,848 — choices 있음 · **선택지가 5개인 것 0건** · passage 0건
  //   unit_grammar 1,287 — 위와 같음
  //
  // 즉 `parseItem` 이 넷 다 `null` 로 버린다. 재생용 목록에 넣으면 "풀 수 있다" 고 적히고
  // 실제로는 한 문항도 안 나오는, **이 파일이 막으려던 바로 그 상태**가 된다.
  // 옮기려면 목록이 아니라 **입력 화면 + `grade_dcp_item` 채점 규칙**을 먼저 만들어야 한다.
  'blank_word',
  'grammar_fix',
  'unit_vocab',
  'unit_grammar',
] as const

export type CoreDcpType = (typeof CORE_DCP_TYPES)[number]
export type ChoiceDcpType = (typeof CHOICE_DCP_TYPES)[number]
export type PlayableDcpType = (typeof PLAYABLE_DCP_TYPES)[number]
export type TextbookOnlyDcpType = (typeof TEXTBOOK_ONLY_DCP_TYPES)[number]

/** 학습자가 풀 수 있는 유형인가. */
export function isPlayableDcpType(type: unknown): type is PlayableDcpType {
  return typeof type === 'string' && (PLAYABLE_DCP_TYPES as readonly string[]).includes(type)
}

/** 5지선다 계열인가 — 화면·채점이 한 벌로 처리하는 묶음. */
export function isChoiceDcpType(type: unknown): type is ChoiceDcpType {
  return typeof type === 'string' && (CHOICE_DCP_TYPES as readonly string[]).includes(type)
}

/** 두 갈래 어디에도 없는 유형 — 분류가 안 된 것이다. */
export function isClassifiedDcpType(type: string): boolean {
  return (
    (PLAYABLE_DCP_TYPES as readonly string[]).includes(type) ||
    (TEXTBOOK_ONLY_DCP_TYPES as readonly string[]).includes(type)
  )
}
