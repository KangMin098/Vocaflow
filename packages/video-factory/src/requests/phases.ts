// packages/video-factory/src/requests/phases.ts
//
// **순환의 자리 이름과 다음 할 일 — 화면과 CLI 가 같은 문장을 쓴다.**
// 둘이 따로 적으면 화면이 「승인하세요」라고 하는데 CLI 는 「export 하세요」라고 말하게 된다.

import type { RequestPhase } from './types'

export const PHASE_LABEL: Record<RequestPhase, string> = {
  requested: '설계 대기',
  designed: '검토 대기',
  changes_requested: '수정 요청됨',
  approved: '승인 — 적용 대기',
  rejected: '반려',
  applying: '적용 중',
  applied: '발행 — 평가 대기',
  evaluated: '평가 완료',
  failed: '적용 실패',
  cancelled: '거둠',
}

/** 순환 5단계 — 스테퍼의 칸 */
export const CYCLE_STEPS = ['기획', '설계', '검토', '적용', '평가'] as const
export type CycleStep = (typeof CYCLE_STEPS)[number]

/**
 * 지금 어느 칸에 있나. 끝난 요청(반려·거둠)은 멈춘 칸을 돌려준다.
 * 기획과 설계는 같은 드레인에서 함께 나온다 — 설계 대기는 「기획」 칸에 둔다.
 */
export function cycleStepOf(phase: RequestPhase): { step: CycleStep; done: boolean } {
  switch (phase) {
    case 'requested':
      return { step: '기획', done: false }
    case 'changes_requested':
      return { step: '설계', done: false }
    case 'designed':
    case 'rejected':
    case 'cancelled':
      return { step: '검토', done: false }
    case 'approved':
    case 'applying':
    case 'failed':
      return { step: '적용', done: false }
    case 'applied':
      return { step: '평가', done: false }
    case 'evaluated':
      return { step: '평가', done: true }
  }
}

/** 다음 할 일 — **누가** 무엇을. 사람 몫은 화면, 기계 몫은 명령. */
export const NEXT_STEP: Record<RequestPhase, { who: 'admin' | 'agent' | 'none'; text: string }> = {
  requested: { who: 'agent', text: 'pnpm video requests:export → video-request-designer → pnpm video requests:import --commit' },
  changes_requested: {
    who: 'agent',
    text: '코멘트를 반영해 다시 설계: pnpm video requests:export → video-request-designer → pnpm video requests:import --commit',
  },
  designed: { who: 'admin', text: '이 화면에서 검토 — 승인 · 수정 요청 · 반려' },
  approved: { who: 'agent', text: 'pnpm video requests:pull' },
  applying: {
    who: 'agent',
    text: 'pnpm video voice <id> && pnpm video render <id> && pnpm video loudness --fix && pnpm video thumbs <id> → package → publish → pnpm video requests',
  },
  applied: { who: 'agent', text: 'pnpm video evaluate <id>' },
  evaluated: { who: 'none', text: '끝 — 평가가 같은 분야·수요자의 다음 기획에 들어간다' },
  failed: { who: 'agent', text: '오류를 고친 뒤 pnpm video requests:pull (승인된 rev 로 다시 적용)' },
  rejected: { who: 'none', text: '끝(반려) — 다시 하려면 새 요청을 만든다' },
  cancelled: { who: 'none', text: '끝(거둠)' },
}

/** `<id>` 자리를 실제 영상 id 로 */
export function nextStepText(phase: RequestPhase, videoId: string | null): string {
  const t = NEXT_STEP[phase].text
  return videoId ? t.replaceAll('<id>', videoId) : t
}
