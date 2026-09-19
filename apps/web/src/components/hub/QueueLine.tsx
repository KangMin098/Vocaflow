// apps/web/src/components/hub/QueueLine.tsx
//
// **오늘 담길 낱말** — 모듈 허브(`/flashcard` · `/spellforge`)의 골격(2026-09-19 화면 재설계 DD-34 ·
// docs/design/compare/module-hubs.md 발산 A).
//
// 이전(`TodayQueue`)은 4열 균등 숫자 타일(0·0·8·0) + 전폭 회색 막대였다 — 단어 복습 앱의 대시보드(감사 평균),
// `/flashcard` 와 `/spellforge` 가 픽셀 단위로 같았다. 지금은 **play 가 제시할 순서 그대로의 낱말 줄**:
//   · 밑줄 = 기억 상태(`DecayUnderline` — `/text/[id]` · `/hub` 와 같은 표식, 색 + 굵기 + 범례 3중)
//   · 이번 세션에 담기는 앞 N개에 권점 — 세션 길이를 바꾸면 권점이 옮겨 찍힌다(`/hub` 골든과 같은 몸짓, 200ms 색만)
//   · 세션 밖 낱말은 흐리게 — 무엇이 이번에 빠지는지도 보인다

import { DecayUnderline } from '@/components/ui/press'
import { MEMORY_LABEL } from '@/lib/framework/memory-labels'
import type { QueueKind, QueuedWord } from '@/lib/learner/session-queue'

import styles from './queue-line.module.css'

/** 줄에 올리는 최대 낱말 수 — 두세 줄. 세션이 더 길면 "외 N" 으로 말한다 */
const LINE_MAX = 36
/**
 * 좁은 화면에서는 앞 12개만 — 36개를 다 세우면 390px 에서 시작 버튼이 첫 화면 밖으로 밀렸다
 * (2026-09-19 첫 캡처 901/844 · 수정 1회차). 나머지는 「외 N개」 로 말한다.
 */
const MOBILE_MAX = 12

const ORDER: readonly QueueKind[] = ['risk', 'shaky', 'new', 'stable']

export function QueueLine({
  words,
  marked,
  unit,
}: {
  /** play 가 제시할 순서(급한 것 먼저) */
  words: QueuedWord[]
  /** 이번 세션에 담기는 수 — 앞에서부터 이만큼 권점 */
  marked: number
  /** 세는 단위 — 「장」(카드) · 「개」 */
  unit: string
}) {
  const shown = words.slice(0, LINE_MAX)
  const session = words.slice(0, marked)
  const counts = ORDER.map((k) => ({ k, n: session.filter((w) => w.state === k).length })).filter((c) => c.n > 0)
  const overflow = words.length - shown.length
  const overflowMobile = words.length - Math.min(words.length, MOBILE_MAX)

  return (
    <section aria-label="오늘 담길 낱말" data-queue-line="" className="flex flex-col gap-2">
      <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-body text-[13px] text-[var(--t2)]">
        <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
          이번 세션 {marked}
          {unit}
        </span>
        {counts.map(({ k, n }) => (
          <span key={k} className="font-display text-[12px] font-[600] text-[var(--t1)]">
            <DecayUnderline state={k}>{MEMORY_LABEL[k].label}</DecayUnderline>{' '}
            <span className="font-mono tabular-nums text-[var(--t2)]">{n}</span>
          </span>
        ))}
      </p>

      <p lang="en" className="m-0 font-english text-[18px] leading-[2.1] text-[var(--t1)] [overflow-wrap:anywhere] md:text-[19px]">
        {shown.map((w, i) => {
          const on = i < marked
          return (
            <span key={`${w.word}-${i}`} className={i >= MOBILE_MAX ? 'max-md:hidden' : undefined}>
              <span
                className={styles.word}
                data-on={on}
                data-queue-word=""
                style={on ? undefined : { color: 'var(--t2)' }}
              >
                <DecayUnderline state={w.state}>{w.word}</DecayUnderline>
              </span>
              {i < shown.length - 1 && (
                <span className={`text-[var(--t3)] ${i === MOBILE_MAX - 1 ? 'max-md:hidden' : ''}`}> · </span>
              )}
            </span>
          )
        })}
        {overflowMobile > 0 && (
          <span className="font-body text-[13px] text-[var(--t2)] md:hidden"> … 외 {overflowMobile.toLocaleString()}개</span>
        )}
        {overflow > 0 && (
          <span className="hidden font-body text-[13px] text-[var(--t2)] md:inline"> … 외 {overflow.toLocaleString()}개</span>
        )}
      </p>
      <p className="m-0 font-body text-[12px] text-[var(--t2)] [word-break:keep-all]">
        <span className={styles.word} data-on="true" aria-hidden>
          점
        </span>{' '}
        찍힌 낱말이 이번에 만나는 것 — 카드가 나오는 순서(다음 복습 날짜가 이른 것부터) 그대로예요.
      </p>
    </section>
  )
}
