// apps/web/src/components/flashcard/FirstJudge.tsx
//
// 첫 판정 — "떠올랐나, 안 떠올랐나" 두 갈래.
//
// v07 「주묵 판면」 재작성. 이전 판이 안고 있던 것 셋:
//   ① **이모지 😅 / 💡** — 세 살짜리 얼굴을 학습자 앞에 놓는 것이고, 기기마다 다른 그림이
//      나오므로 우리가 고른 것도 아니다(브랜드 자산 0개 상태의 기본값이다).
//   ② **붉은 테두리 + 붉은 hover 면**(`rgba(239,68,68,.25)` · `--error-light`)이 "모르겠어요"
//      쪽에 걸려 있었다. 모른다는 것은 **오류가 아니라 상태**다 — 인출 실패는 학습의 재료다
//      (Bjork, desirable difficulty). 붉게 칠하면 다음번에 정직하게 누르지 않게 된다.
//      CLAUDE.md 「정답률 빨간 글씨 압박 금지」· 철학 3 Empathetic Feedback 과 같은 방향.
//   ③ hover 에 `-translate-y` + 그림자 — 판면에서는 요소가 뜨지 않는다.
//
// 지금은 **두 갈래를 대칭으로** 둔다. 어느 쪽도 좋은 답이 아니고, 어느 쪽도 나쁜 답이 아니다.
// 구분은 색이 아니라 **표식**(빈 네모 / 그어진 네모)과 위치로 한다.

'use client'

interface FirstJudgeProps {
  visible: boolean
  onJudge: (answer: 'yes' | 'no') => void
}

const BASE =
  'flex flex-1 items-center justify-center gap-2.5 rounded-[var(--r-md)] border bg-[var(--bg)] px-4 py-4 min-h-[56px] font-display text-[14.5px] font-[600] transition-[background-color,border-color,color] duration-[var(--dur-fast)] ease-[var(--ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'

export function FirstJudge({ visible, onJudge }: FirstJudgeProps) {
  return (
    <div
      className={`mt-4 flex w-full max-w-[540px] gap-2 transition-[opacity,transform] duration-[var(--dur-slow)] ease-[var(--ease)] ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2.5 opacity-0'
      } `}
      aria-hidden={!visible}
    >
      <button
        onClick={() => onJudge('no')}
        className={`${BASE} border-[var(--bd)] text-[var(--t2)] hover:border-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:ring-[var(--t3)]`}
      >
        {/* 빈 네모 — 아직 채워지지 않았다는 뜻. 실패 표식이 아니다. */}
        <span
          aria-hidden
          className="inline-block h-[13px] w-[13px] shrink-0 rounded-[1px] border-[1.5px] border-current"
        />
        <span>아직이에요</span>
      </button>

      <button
        onClick={() => onJudge('yes')}
        className={`${BASE} border-[var(--memory-stable)] text-[var(--memory-stable-ink)] hover:bg-[var(--success-light)] focus-visible:ring-[var(--memory-stable)]`}
      >
        {/* 그어진 네모 — 채워졌다. 채점이 아니라 기록이다. */}
        <span
          aria-hidden
          className="inline-flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-[1px] bg-current"
        />
        <span>떠올랐어요</span>
      </button>
    </div>
  )
}
