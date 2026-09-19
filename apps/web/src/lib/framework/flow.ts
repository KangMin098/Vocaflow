// apps/web/src/lib/framework/flow.ts
//
// 단계 이동 설계 — **잠금이 아니라 초대**.
//
// 이 파일이 답하는 질문은 하나다: 학습자가 Recognized 에서 Recalled 로 넘어갈 때
// 그것을 어떻게 알고, 어떻게 자연스럽게 넘어가는가.
//
// 설계 원칙 5개 (프로젝트 4철학에서 직접 나온다):
//
//   ① **막지 않고 권한다.** 자물쇠 UI 를 두지 않는다. 다음 단계는 "아직 못 함" 이 아니라
//      "지금 할 만함" 으로 나타난다. 해금은 선수 관계에서 도출된 것만 허용하고
//      임의 임계 게이트는 배제한다(조사 근거: ALEKS 식 선수 그래프 · 임의 게이트 선례 없음).
//
//   ② **증거가 생긴 순간에 권한다.** 이동을 알리는 자리는 처방 카드가 아니라 **세션 끝**이다.
//      방금 그 단어들을 맞힌 직후이므로 학습자의 주의가 이미 거기 있고, "왜 이걸 권하는가" 를
//      설명할 필요가 없다 — 방금 겪었다.
//
//   ③ **학습자가 아니라 단어가 움직인다.** 단계는 학습자 등급이 아니라 단어별 상태다.
//      그래서 레벨업 의식(폭죽·트로피)이 없다 — CLAUDE.md 가 금지하고, 애초에 올라간 것은
//      학습자가 아니라 단어 6개다. 대신 환경이 조용히 바뀐다(Implicit Progress).
//
//   ④ **한 번에 한 걸음만 보인다.** 사다리 전체를 보여주지 않는다(Progressive Disclosure).
//      한 세션에 새 면을 **하나만** 들인다 — 작업기억 4항목(Cognitive Load) 제약이고,
//      두 개를 동시에 들이면 어느 것이 어려웠는지 학습자도 우리도 알 수 없다.
//
//   ⑤ **후퇴는 조용히.** 단어가 흔들려 앞 단계 큐로 돌아갈 때 "실패" 문구를 쓰지 않는다
//      (Empathetic Feedback). 기억이 흐려지는 것은 결함이 아니라 곡선의 정상 동작이다.
//
// ⚠️ 아래 임계값은 **출발값**이다. 근거가 있는 것은 근거를, 없는 것은 없다고 적었다.
//    실사용 데이터로 조정해야 하며, 조정 이력을 이 파일에 남긴다.

import { FACETS, SPINE, nextSpine, type FacetId, type StageId } from './axes'

// ── 단어 하나의 프레임워크 상태 ────────────────────────────────────

/** Memory state 는 R(t) 에서 동적 계산한다 — DB 저장 금지(CLAUDE.md). */
export type MemoryState = 'new' | 'risk' | 'shaky' | 'stable'

export interface WordFrameworkState {
  word: string
  /** 통과한 면 — Stage 는 여기서 파생된다(별도 저장 금지) */
  passed: FacetId[]
  /** 면별 최근 정답률 (0~1). 없으면 아직 시도 없음 */
  accuracy: Partial<Record<FacetId, number>>
  /** 면별 성공 횟수 */
  hits: Partial<Record<FacetId, number>>
  memory: MemoryState
  /** 누적 만남 횟수 — 읽기 노출 포함. 8~10회를 하한 신호로만 쓴다 */
  encounters: number
}

// ── 이동 조건 ──────────────────────────────────────────────────────

/**
 * 정답률 목표 대역. 이 대역을 상한으로 삼아 난이도를 자동 조절한다 —
 * "항상 어렵게" 가 아니다(Desirable Difficulty 의 재진술).
 *
 * 출발값 0.85 는 Wilson 2019 의 최적 학습률 논의에서 가져왔으나 **인간 어휘 실험이 아니다**.
 * 그래서 게이트가 아니라 페이싱 신호로만 쓴다.
 */
export const ACCURACY_TARGET = 0.85
export const ACCURACY_HOLD_BELOW = 0.7

/** 면을 통과했다고 보는 최소 성공 횟수 — 한 번은 우연일 수 있다. */
export const HITS_TO_PASS = 2

/**
 * 노출 횟수 하한 신호. 문헌은 6~20+ 로 갈리므로 **단일 상수로 못 박지 않는다**.
 * 이 값 미달이면 처방이 새 면을 권하기 전에 narrow reading(같은 도서 연속 챕터)을 먼저 권한다.
 */
export const ENCOUNTERS_FLOOR = 8

export interface Advance {
  from: StageId
  to: StageId
  facet: FacetId
  /** 이 이동이 왜 지금 가능한가 — 학습자에게 보여줄 한국어 한 줄 */
  because: string
  /** 아직 못 권하는 이유(있으면). 있으면 권하지 않는다. */
  holdReason?: string
}

/**
 * 다음 spine 면을 권할 수 있는가.
 *
 * **가장 중요한 규칙**: `new` 단어에 생산 과제(Spell)를 권하지 않는다.
 * 초기 부호화 단계에서 생산을 강제하면 자원 소모로 **오히려 학습이 나빠진다**
 * (Barcroft — 전문성 역전). 현재 코드가 우연히 이 순서를 지키고 있는데
 * 문서에 없어서 다음 사람이 깨뜨릴 수 있다. 여기에 못 박는다.
 */
export function canAdvance(state: WordFrameworkState): Advance | null {
  const facet = nextSpine(state.passed)
  if (!facet) return null

  const from = stageOfState(state)
  const to = STAGE_FOR[facet]
  if (!to) return null

  const acc = state.accuracy[facet] ?? null
  const base: Advance = { from, to, facet, because: BECAUSE[facet] }

  // ① 생산 과제는 갓 만난 단어에 권하지 않는다
  if (state.memory === 'new' && FACETS[facet].retrieval.includes('생산')) {
    return { ...base, holdReason: '아직 방금 만난 단어예요 — 먼저 몇 번 더 알아보고 나서요' }
  }

  // ② 앞 면이 흔들리는 중이면 다음 면을 얹지 않는다
  const prevIdx = SPINE.indexOf(facet) - 1
  const prev = prevIdx >= 0 ? SPINE[prevIdx] : null
  if (prev) {
    const prevAcc = state.accuracy[prev] ?? 0
    if (prevAcc < ACCURACY_HOLD_BELOW) {
      return { ...base, holdReason: `${FACETS[prev].name} 이 아직 흔들려요 — 그것부터 다져요` }
    }
  }

  // ③ 노출이 얕으면 새 면보다 만남을 먼저 권한다
  if (state.encounters < ENCOUNTERS_FLOOR && facet !== 'recognize') {
    return { ...base, holdReason: '이 단어를 만난 횟수가 아직 적어요 — 같은 책을 더 읽어요' }
  }

  // ④ 이미 잘하고 있으면 다음 면으로
  if (acc == null || acc >= ACCURACY_HOLD_BELOW) return base

  return { ...base, holdReason: '조금 더 익숙해진 다음에요' }
}

const STAGE_FOR: Partial<Record<FacetId, StageId>> = {
  recognize: 'recognized',
  spell: 'recalled',
  use: 'applied',
  fluency: 'fluent',
}

/** "왜 지금 이걸 권하는가" — 학습자가 방금 겪은 것을 그대로 말한다. */
const BECAUSE: Record<FacetId, string> = {
  recognize: '이제 뜻을 붙여 볼 때예요',
  spell: '뜻은 아는데 아직 못 쓰는 단어예요',
  sound: '소리로도 만나 볼까요',
  build: '조각으로 나눠 보면 비슷한 단어까지 같이 잡혀요',
  use: '쓸 수 있으니 이제 문장에서요',
  fluency: '알긴 아는데 아직 뜸을 들여요',
}

function stageOfState(state: WordFrameworkState): StageId {
  let deepest: StageId = 'met'
  for (const f of SPINE) {
    if (state.passed.includes(f)) deepest = STAGE_FOR[f] ?? deepest
  }
  return deepest
}

// ── 이동을 알리는 자리 (Handoff) ───────────────────────────────────
//
// 이동은 "메뉴에서 다음 활동을 찾아 누르는 것" 이 아니다. **네 자리에서만** 권한다.
// 그 외의 자리에서 다음 단계를 권하면 처방 정본이 또 갈라진다(현재 7개가 경쟁하는 원인).

export type HandoffAt =
  /** 읽기를 마친 순간 — 만난 단어가 확정된다 */
  | 'chapter-end'
  /** 활동 세션이 끝난 순간 — **주 이동 지점**. 방금 겪은 증거가 가장 뜨겁다 */
  | 'session-end'
  /** Today 처방 카드 — 세션 밖에서 다시 들어오는 입구 */
  | 'today'
  /** Vault 의 단어 상세 — 학습자가 특정 단어를 스스로 파고들 때 */
  | 'vault-word'

export interface Handoff {
  at: HandoffAt
  /** 이 자리에서 보여줄 문구 (한국어) */
  headline: (n: number) => string
  /** 행동 한 개 — 두 개 이상 두지 않는다(선택 마비) */
  action: (facet: FacetId) => string
  /** 미루기 — 항상 있어야 한다. 강제하면 우회 대상이 된다 */
  defer: string
}

export const HANDOFFS: Record<HandoffAt, Handoff> = {
  'chapter-end': {
    at: 'chapter-end',
    headline: (n) => `이 챕터에서 ${n}개를 만났어요`,
    action: () => '지금 익히기',
    defer: '나중에',
  },
  'session-end': {
    at: 'session-end',
    // 세션 끝에서만 "준비됐다" 는 표현을 쓴다 — 방금 그것을 증명했기 때문이다
    headline: (n) => `${n}개가 다음 단계로 갈 준비가 됐어요`,
    action: (facet) => `${FACETS[facet].name} 해보기`,
    defer: '오늘은 여기까지',
  },
  today: {
    at: 'today',
    headline: (n) => `${n}개는 뜻은 아는데 아직 못 써요`,
    action: (facet) => `${FACETS[facet].name} ${' '}시작`,
    defer: '다른 것 하기',
  },
  'vault-word': {
    at: 'vault-word',
    headline: () => '이 단어의 다음 한 걸음',
    action: (facet) => `${FACETS[facet].name} 로 확인`,
    defer: '',
  },
}

// ── 세션 구성 규칙 ─────────────────────────────────────────────────

/**
 * 한 세션에 새로 들이는 면의 최대 개수. 1 이다.
 * 두 개를 동시에 들이면 어느 것이 어려웠는지 학습자도 우리도 알 수 없다.
 */
export const NEW_FACETS_PER_SESSION = 1

/**
 * 하루 목표를 **개수로 닫는다** — 단어 수·XP 가 아니다.
 * 국외 선례: Elevate 하루 3~5 게임 · Beelinguapp 주 1~3/4~6/7~10 스토리.
 * "언제 끝나는지" 를 학습자가 알 수 있어야 한다.
 */
export const DAILY_BLOCKS = { min: 2, target: 3, max: 5 } as const

/**
 * 간섭 회피 — FSRS 는 카드 단위 독립을 가정하므로 우리 계층에서 보정한다.
 *
 *  · 같은 어족에서 파생된 항목을 같은 세션에 몰지 않는다(Anki Disperse Siblings 상당)
 *  · 의미 세트(동의어 · 상위개념 공유)를 묶지 않고 **thematic 묶음**(같은 장면 · 같은 사건)으로
 *
 * ⚠️ 근거의 한계: 의미 클러스터 간섭 연구는 대부분 novice · 짧은 리스트 실험이다.
 *    이미 stable 인 단어의 복습 큐에도 같은 간섭이 있는지는 미확인 — 이 규칙은 그만큼 잠정이다.
 */
export const INTERFERENCE = {
  /** 한 세션에 허용하는 동일 어족 항목 수 */
  maxSameFamily: 1,
  /** 한 세션에 허용하는 동일 의미 클러스터 항목 수 */
  maxSameSemanticCluster: 1,
} as const

/**
 * Four Strands 배분 목표. 진행 가이드의 1급 지표로 쓸 수 있다 —
 * 우리 데이터로 산출 가능하고, 현 배분은 language-focused 편중이다
 * (meaning-focused output 은 활동 자체가 없다).
 *
 * 게이트가 아니라 **주간 넛지**로 쓴다.
 */
export type Strand = 'input' | 'output' | 'language-focused' | 'fluency'
export const STRAND_TARGET: Record<Strand, number> = {
  input: 0.25,
  output: 0.25,
  'language-focused': 0.25,
  fluency: 0.25,
}

// ── 콘텐츠 → 학습 흐름 ────────────────────────────────────────────
//
// 도서·스크립트·세트가 프레임워크에 물리는 지점. 읽기에서 연습으로 넘어가는 흐름이
// 자연스러워야 "유기적 결합" 이 성립한다.
//
//   읽는다 → 모르는 단어를 만난다(Met) → 챕터 끝에서 확정
//     → 그 단어들로 Recognize → 같은 책 다음 챕터에서 다시 만난다(노출 누적)
//     → 노출이 쌓이면 Spell · Use 로
//
// **narrow reading 이 핵심 장치다.** 같은 도서의 연속 챕터는 어휘가 겹치므로,
// 노출 횟수 하한을 인공 반복이 아니라 읽기로 채울 수 있다 —
// 우리 library_books 챕터 구조 · user_book_group_id 와 이미 정합한다.

// ContentRef 는 여기서 선언하지 않는다 — 이 파일이 먼저 선언했지만 `id` 를 필수로 두어
// `mine`(가리킬 자료가 없는 내 복습 큐)을 표현할 수 없었고, 실제로 DB 에 적재되는 정의는
// lib/content/content-ref.ts 다. 같은 개념이 두 곳에 있으면 그게 곧 drift 라
// **적재되는 쪽을 단일 정의로 삼고** 여기서는 다시 내보내기만 한다.
export type { ContentRef } from '@/lib/content/content-ref'

/**
 * 다음 읽을 것을 고르는 신호 — LingQ 의 방식을 차용한다:
 * **다음 텍스트를 '아는 단어 %' 로 추천**한다.
 *
 * 커버리지 임계를 하드 게이트로 쓰지 않는다 — Schmitt et al.(2011)은 임계값 자체의
 * 증거가 없고 관계가 선형이라고 보고했다. 그래서 차단하지 않고
 * **예상 미지어 밀도를 연속값으로 보여주고 지원(hover 사전 · 주석)의 양을 조절**한다.
 */
export const COVERAGE = {
  /** 최소 이정표 — 95% 커버리지 ≈ 4~5천 어족 */
  comfortable: 0.95,
  /** 최적 이정표 — 98% ≈ 8~9천 어족 */
  optimal: 0.98,
  /** 이 아래면 지원을 최대로 켠다(차단이 아니다) */
  supportHeavyBelow: 0.9,
} as const
