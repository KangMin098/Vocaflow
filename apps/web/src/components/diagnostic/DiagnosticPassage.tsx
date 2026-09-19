// apps/web/src/components/diagnostic/DiagnosticPassage.tsx
//
// **답할수록 칠해지는 지문** — `/diagnostic` 의 골격(2026-09-19 발산 A · docs/design/compare/diagnostic.md).
//
// 랜딩 데모 지문(낱말별 V-Level 을 서버가 사전으로 계산)을 `/fit` 과 **같은 칠 규칙**(`runs` —
// 주묵 옅은 면 + 1px 주묵 밑줄)으로 그린다. 레벨이 바뀌면 낱말 면 색이 200ms 에 바뀐다 —
// 랜딩·`/fit` 과 같은 몸짓. 여기서 레벨을 움직이는 것은 슬라이더가 아니라 **학습자의 답**이다.
//
// 레벨이 없을 때(아직 답 0): 학습 낱말마다 dotted 밑줄(`--memory-new`) — 제품 문법으로 "아직 모름".
// 칠하지 않은 빈 지문을 두면 이 자리가 무엇을 할지 말하지 못한다.
//
// 규약: 색 + 밑줄 + 문장(범례) 3중 · 모션은 색 전환 200ms 뿐(reduced-motion 에서 끈다 — /fit 과 같다) ·
//   영어 원문 Lora(`font-english`) · 토큰 경유(다크 자동).

import { runs } from '@/components/textfit/PaintedPassage'
import { countUnknownTypes, type PaintToken } from '@/lib/textfit/paint'

export function DiagnosticPassage({
  tokens,
  level,
  size = 'lg',
}: {
  tokens: PaintToken[]
  /** 칠할 기준 레벨 — `null` 이면 아직 모름(dotted) */
  level: number | null
  size?: 'lg' | 'sm'
}) {
  const text =
    size === 'lg'
      ? 'text-[17px] leading-[1.95] md:text-[19px]'
      : 'text-[15px] leading-[1.85] md:text-[16px]'

  if (level === null) {
    return (
      <p lang="en" data-diagnostic-passage="unknown" className={`m-0 font-english text-[var(--t1)] ${text}`}>
        {tokens.map((tok, i) =>
          tok.v === undefined ? (
            <span key={i}>{tok.t}</span>
          ) : (
            <span
              key={i}
              className="underline decoration-[var(--memory-new)] decoration-dotted decoration-2 underline-offset-[5px]"
            >
              {tok.t}
            </span>
          ),
        )}
      </p>
    )
  }

  return (
    <p lang="en" data-diagnostic-passage={level} className={`m-0 font-english text-[var(--t1)] ${text}`}>
      {runs(tokens, level).map((run, i) =>
        run.unknown ? (
          <mark
            key={i}
            className="rounded-[var(--r-sm)] bg-[var(--ju-wash)] px-[1px] text-[var(--t1)] underline decoration-[var(--ju)] decoration-1 underline-offset-[4px] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] motion-reduce:transition-none"
          >
            {run.text}
          </mark>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </p>
  )
}

/** 이 레벨에서 지문 속 처음 만나는 낱말의 서로 다른 수 — 문장이 같은 수를 말하게 한다. */
export function unknownIn(tokens: PaintToken[], level: number): number {
  return countUnknownTypes(tokens, level)
}
