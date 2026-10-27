// apps/web/src/lib/library/complete-chapter-controller.ts
// T-0192 — 읽기 완료 저장 요청의 순서 관리. 요청마다 세대 번호를 붙여, 장이 바뀌거나(A→B→A 포함)
// 새 요청이 시작된 뒤 도착한 옛 응답은 버린다. 진행 중에는 새 요청을 받지 않는다(중복 조작 차단).
import type { CompleteChapterResult } from './complete-chapter'

export type CompletionPhase =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'failed' }
  | { kind: 'done'; result: CompleteChapterResult }

export interface CompletionController {
  /** 현재 장 저장 시도. 진행 중이면 무시하고 false */
  start(): boolean
  /** 장이 바뀌면 진행 중 요청을 무효화하고 idle 로 */
  setTextId(textId: string): void
  phase(): CompletionPhase
}

export function createCompletionController(
  initialTextId: string,
  complete: (textId: string) => Promise<CompleteChapterResult>,
  onChange: (phase: CompletionPhase) => void,
): CompletionController {
  let textId = initialTextId
  let generation = 0
  let current: CompletionPhase = { kind: 'idle' }
  const set = (p: CompletionPhase) => {
    current = p
    onChange(p)
  }

  return {
    start() {
      if (current.kind === 'submitting') return false
      const mine = ++generation
      const requested = textId
      set({ kind: 'submitting' })
      complete(requested).then(
        (res) => {
          if (mine !== generation) return
          set(res?.ok ? { kind: 'done', result: res } : { kind: 'failed' })
        },
        () => {
          if (mine !== generation) return
          set({ kind: 'failed' })
        },
      )
      return true
    },
    setTextId(next) {
      if (next === textId) return
      textId = next
      generation++
      set({ kind: 'idle' })
    },
    phase: () => current,
  }
}
