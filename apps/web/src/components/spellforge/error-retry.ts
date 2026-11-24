// apps/web/src/components/spellforge/error-retry.ts
// 오답 뒤 「다시 입력하기」 — 학습자가 누를 때만 입력 · 오답 표시를 정리한다(예전 3초 자동 삭제는 고쳐 쓰던 입력까지 지웠다).
// 보관된 콜백이 단어 변경 · 모드 전환 · 언마운트 · 계정 전환 뒤 옛 세션을 건드리지 않도록 세대(epoch)와 주인 확인을 함께 본다.
// 재시도 자체는 평가 · 대기열 · 기록을 만들지 않는다 — apply 는 화면 정리만 한다.

export interface RetryEpoch {
  current: number
}

/** 단어 변경 · 모드 전환 · 언마운트 · 계정 전환 때 부른다 — 이전에 만든 재시도 콜백을 모두 무효로 만든다 */
export function bumpRetryEpoch(epoch: RetryEpoch): void {
  epoch.current += 1
}

/**
 * 지금 세대에 묶인 재시도 콜백. 세대가 바뀌었거나 주인이 아니면 아무것도 하지 않고 false.
 * apply: 입력 · 오답 표시 정리와 입력 칸 포커스(화면 상태만).
 */
export function makeRetry(epoch: RetryEpoch, ownsSession: () => boolean, apply: () => void): () => boolean {
  const bound = epoch.current
  return () => {
    if (epoch.current !== bound || !ownsSession()) return false
    apply()
    return true
  }
}
