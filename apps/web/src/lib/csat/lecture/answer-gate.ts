// apps/web/src/lib/csat/lecture/answer-gate.ts
//
// **「정답 직접 안내 전까지」 경로의 화면 공개 판단 — 한 곳에서만 정한다.**
//
// 학습자가 이 경로를 고르면, 경계(첫 직접 정답 cue) 뒤로 가는 모든 이동(재생 · ←/→ · 이전/다음 차례 · 차례 직접 선택 ·
// 건너뛰기)은 같은 검사(`boundaryGate`)를 지난다. 명시적 동의(경계 안내의 「계속 듣기(정답 공개)」 · 블록의 「정답 보기」)
// 전에는 정답을 확정하는 화면 정보(머리 칩 「정답 ⓝ」 · 정답 근거 블록 · 오답 소거 블록)를 감추고 강조도 켜지 않는다.
//
// ⚠️ UI 의 정답 미표시 계약이지 보안 경계가 아니다. 첫 HTML · RSC props 에는 아직 정답 데이터가 실린다 —
// 서버 지연 조회는 판단 장면 (b) 계약(연구 29 · 31 §4)의 별도 작업이다.

import type { TheaterBlock } from '@/lib/csat/theater'

export type LecturePath = 'self' | 'full' | 'until' | null

export interface AnswerGateState {
  path: LecturePath
  /** 검증된 경계(cue index). 없으면 null — 그때는 「정답 직접 안내 전까지」 경로가 없다 */
  stopAt: number | null
  /** 학습자가 정답 공개에 명시적으로 동의했다 */
  consented: boolean
  /**
   * 학습자가 정답을 감추기로 골랐다(「정답 직접 안내 전까지」). 강의 경로와 따로 둔다 — 강의 요청이 실패해 경로가
   * 풀려도(오류 → 다시 고르기) 감춤은 동의 전까지 그대로다(T-0140 r4 R4-02). 없으면 경로가 until 인지로 정한다.
   */
  hideAnswer?: boolean
}

/** 정답을 화면에서 감추는 중인가 — 「정답 직접 안내 전까지」 를 고르고 아직 동의하지 않은 동안만 */
export function answerWithheld(s: AnswerGateState): boolean {
  return (s.hideAnswer ?? (s.path === 'until' && s.stopAt != null)) && !s.consented
}

/**
 * 차례 이동 판단. 경계 뒤로 가려는 이동은 상태(재생 · 일시정지 · 끝남 · 시작 전)와 수단(키 · 단추 · 직접 선택)에 관계없이
 * 경계 안내로 돌린다 — `'boundary'` 면 cursor 를 옮기지 않는다.
 */
export function boundaryGate(index: number, s: AnswerGateState): 'boundary' | 'ok' {
  return answerWithheld(s) && s.path === 'until' && s.stopAt != null && index >= s.stopAt ? 'boundary' : 'ok'
}

const ANSWER_CHIP = /^정답 \S+$/
const isRejectKey = (key: string) => /^analysis:reject(?::\d)?$/.test(key)

/** 이 블록이 정답을 확정하는 정보인가(정답 근거 · 오답 소거) */
export function confirmsAnswer(b: Pick<TheaterBlock, 'key' | 'kind'>): boolean {
  return b.kind === 'answer' || b.kind === 'reject' || isRejectKey(b.key)
}

/** 동의 전 강조 대상 — 정답을 확정하는 블록이면 강조하지 않는다 */
export function gatedLiveKey(key: string | null, blocks: Pick<TheaterBlock, 'key' | 'kind'>[], s: AnswerGateState): string | null {
  if (!key || !answerWithheld(s)) return key
  const b = blocks.find((x) => x.key === key)
  return b && confirmsAnswer(b) ? null : key
}

/**
 * 동의 전 화면에 그릴 블록. 머리 블록은 정답 칩만 「정답 공개 전」 으로 바꾸고, 정답 근거 · 오답 소거 블록은
 * 본문 · 칩 · 인용 · 선지 번호(키의 `reject:n` 포함 — DOM 속성으로 남는다)를 비운 자리표시(`withheld: true`)로 바꾼다. 동의 뒤에는 원래 블록 그대로.
 */
export function gateBlocks(blocks: TheaterBlock[], s: AnswerGateState): (TheaterBlock & { withheld?: boolean })[] {
  if (!answerWithheld(s)) return blocks
  let n = 0
  return blocks.map((b) => {
    if (b.kind === 'head') return { ...b, chips: b.chips.map((c) => (ANSWER_CHIP.test(c.text) ? { text: '정답 공개 전', tone: 'quiet' as const } : c)) }
    if (!confirmsAnswer(b)) return b
    return {
      key: `analysis:withheld:${n++}`,
      kind: b.kind,
      title: b.kind === 'answer' ? '답이 왜 이것인가' : '오답 지우기',
      chips: [],
      body: [],
      quote: null,
      withheld: true,
    }
  })
}
