// apps/web/src/components/dashboard/DurabilityLadder.tsx
//
// Growth 히어로 — **기억이 버티는 시간**.
//
// 무엇을 대체했나: `user_stats.known_word_count` 를 읽어 "마음에 자리잡은 단어 0개" 를
// 띄우던 그라데이션 상자. 그 컬럼은 정상적으로 갱신되고 있었고 0도 정직한 값이었다 —
// 정의가 `stability >= 21`(Anki mature)이라 21일을 버티는 단어가 실제로 없었을 뿐이다.
// 문제는 **그 지표를 주인공으로 세운 것**이다: 신규~중급 학습자는 몇 달 동안 0을 본다.
// 회고 화면의 주인공 자리에 몇 달간 0을 두는 것은 "당신은 아무것도 이루지 못했다" 를
// 매일 반복하는 것과 같다. (자세한 경위는 memory-horizon.ts 머리주석 ①)
//
// 왜 하필 지속 시간인가:
//   개수는 노력의 양을 말하지만 **질을 말하지 못한다**. 같은 252개라도 하루면 흐려지는 252개와
//   한 달을 버티는 252개는 완전히 다른 학습이고, 학습자는 그 차이를 알 방법이 없었다.
//   FSRS 의 stability(S) 는 정확히 그 값이다 — R(t)=0.9^(t/S) 에서 S 는 회상률이 90%로
//   떨어지기까지의 일수, 즉 **기억의 반감기**다. 우리는 단어마다 그 값을 이미 갖고 있다.
//
// 평가하지 않는다:
//   추세선(좋아졌다/나빠졌다)을 그리지 않는다. 정답률이 낮은 구간에서는 FSRS 가 S 를 낮추므로
//   추세가 정직하게 하락으로 나오는데, 회고 화면이 그걸 들이미는 것은 철학 ③ 위반이다.
//   대신 **지금 어디에 있는지**를 보여주고, 사다리를 올리는 방법 한 문장을 붙인다.
//
// 색: 단일 액센트(--p)의 밝기 변조만 — 사다리는 순서가 있는 축이라 4색 상태 토큰을 쓰면
// 안 된다(그 토큰은 R(t) 4상태 전용이고, 여기 5칸과 의미가 다르다).
//
// 2026-09-19 「기억의 지층」(화면 재설계 DD-29 · docs/design/compare/retrospect.md 발산 A):
//   페이지가 `@form 환경 변형 — 사다리 층` 을 선언했지만 렌더는 흰 카드 한 장 · 12px 막대 · 5칸 숫자
//   격자였다 — 층에 **낱말이 없었고**, 빈 칸은 `0` 세 개로 첫 화면에 섰다(브리프 "0/0/0 금지").
//   지금은 위(하루)에서 아래(계절)로 층이 쌓인 단면이다:
//     · 층 두께 = 그 층의 낱말 수 · 층 안에 **실제 낱말** · 아래로 갈수록 진하다(순서 있는 축)
//     · 이번 주에 다시 만나 맞힌 낱말에 **권점** — `/hub` 「오늘 다시 볼 낱말」 과 같은 표식
//     · 층을 누르면 그 층의 낱말이 뜻과 함께 펼쳐진다(모션 0 · 색 전환만) — 관측 `retrospect_layer_opened`
//     · 빈 층은 숫자 대신 **층 이름만 괘선 한 줄**(Implicit Progress — 0 을 쓰지 않는다)

'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { track } from '@/lib/analytics/client'
import { RUNGS, formatDuration, type Ladder, type RungKey } from '@/lib/learner/growth-math'

import styles from './strata.module.css'

/** 층이 내려갈수록 진해진다 — 순서 있는 축의 시각 부호(단일 액센트 밝기 변조). */
const RUNG_ALPHA: Record<RungKey, number> = {
  day: 0.28,
  few: 0.45,
  week: 0.62,
  month: 0.8,
  season: 1,
}

/** 층 바탕 = `--p` 를 이만큼(%)까지 섞는다 — 글자 대비를 지키는 상한. 펼치거나 손을 얹으면 +6 */
const TINT_MAX = 16

/** 접힌 층에 서는 낱말 수 — 두 줄을 넘지 않게. 나머지는 펼쳐서 */
const FOLDED_WORDS = 14

/** 층 두께(px) — 낱말 수의 제곱근. 130개와 6개가 한눈에 다르되 한 층이 화면을 먹지 않게 */
function bandPad(count: number): number {
  return Math.round(6 + Math.min(18, Math.sqrt(count) * 1.6))
}

export function DurabilityLadder({ ladder }: { ladder: Ladder }) {
  const { counts, unseen, onLadder, medianDays, champion, strata } = ladder
  const [open, setOpen] = useState<RungKey | null>(null)

  // 지층에 아무도 없다 — 숫자를 나열하지 않고 문장 하나 + 다음 한 걸음(D4).
  if (onLadder === 0) {
    return (
      <section aria-label="기억이 버티는 시간" className="py-2">
        <p className="max-w-[42ch] font-editorial text-[24px] font-[500] leading-[1.3] tracking-[-0.014em] text-[var(--t1)] [word-break:keep-all] md:text-[30px]">
          {unseen > 0
            ? '아직 한 번도 다시 만난 단어가 없어요.'
            : '단어를 담으면 여기서 기억이 자라는 걸 볼 수 있어요.'}
        </p>
        <p className="mt-3 max-w-[46ch] font-body text-[14px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
          {unseen > 0
            ? `담아 둔 ${unseen.toLocaleString()}개를 한 번 복습하면, 그때부터 단어마다 "며칠을 버티는지"가 기록되기 시작해요.`
            : '글을 읽고 모르는 단어를 담는 것이 첫걸음이에요.'}
        </p>
        <Link
          href={unseen > 0 ? '/flashcard' : '/hub'}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--ju)] px-4 font-display text-[13px] font-[700] text-[var(--on-ju)] no-underline transition-colors duration-[var(--dur-normal)] hover:bg-[var(--ju-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px"
        >
          {unseen > 0 ? '한 번 복습하기' : '오늘 할 일 보기'}
          <ArrowRight size={14} aria-hidden />
        </Link>
      </section>
    )
  }

  const heaviest = RUNGS.reduce((a, b) => (counts[b.key] > counts[a.key] ? b : a))
  const weekMarked = strata ? RUNGS.reduce((n, r) => n + strata[r.key].filter((w) => w.thisWeek).length, 0) : 0

  function toggle(key: RungKey) {
    const next = open === key ? null : key
    setOpen(next)
    if (next) track({ name: 'retrospect_layer_opened', props: { rung: next, words: counts[next] } })
  }

  return (
    <section aria-label="기억이 버티는 시간" data-strata="">
      {/* 한 문장 — 중앙값. 평균이 아니라 중앙값인 이유: 한 단어가 유난히 오래 버티면
          평균이 통째로 끌려가 "내 기억이 이만큼 간다" 는 착각을 만든다. */}
      <h2 className="font-editorial text-[26px] font-[500] leading-[1.2] tracking-[-0.014em] text-[var(--t1)] [word-break:keep-all] md:text-[34px]">
        단어 절반이{' '}
        <span className="text-[var(--ju-ink)]">
          {medianDays !== null ? formatDuration(medianDays) : '—'}
        </span>{' '}
        버텨요
      </h2>
      <p className="mt-2 max-w-[60ch] font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
        위층일수록 금방 흐려지고, 아래로 내려갈수록 오래 남아요.
        {weekMarked > 0 && (
          <>
            {' '}
            <span className={styles.week}>점</span> 찍힌 낱말은 이번 주에 다시 만나 맞힌 {weekMarked.toLocaleString()}개예요.
          </>
        )}
      </p>

      {/* 지층 — 위가 하루, 아래가 계절. 층 두께 = 낱말 수. 색만으로 알리지 않는다(이름 + 수 + 낱말). */}
      <ol className="mt-5 border-t-2 border-[var(--t1)]">
        {RUNGS.map((r) => {
          const count = counts[r.key]
          const words = strata?.[r.key] ?? []
          const isOpen = open === r.key
          const tint = Math.round(RUNG_ALPHA[r.key] * TINT_MAX)
          const bandStyle = {
            '--band': `color-mix(in srgb, var(--p) ${tint}%, var(--bg))`,
            '--band-on': `color-mix(in srgb, var(--p) ${tint + 6}%, var(--bg))`,
          } as React.CSSProperties

          // 빈 층 — 괘선 한 줄과 이름만. 0 을 쓰지 않는다.
          if (count === 0) {
            return (
              <li
                key={r.key}
                data-stratum={r.key}
                className="flex min-h-[32px] items-center gap-3 border-b border-dashed border-[var(--bd)] px-1"
              >
                <span className="w-[76px] shrink-0 font-display text-[12px] font-[600] text-[var(--t3)] md:w-[104px]">
                  {r.label}
                </span>
                <span className="font-body text-[12px] text-[var(--t3)] [word-break:keep-all]">{r.note}</span>
              </li>
            )
          }

          const folded = words.slice(0, FOLDED_WORDS)
          const pad = bandPad(count)
          return (
            <li key={r.key} data-stratum={r.key} className="border-b border-[var(--bd)]">
              <button
                type="button"
                onClick={() => toggle(r.key)}
                aria-expanded={isOpen}
                aria-controls={`stratum-${r.key}`}
                style={{ ...bandStyle, paddingTop: pad, paddingBottom: pad }}
                data-open={isOpen}
                className={`${styles.band} group flex min-h-[44px] w-full items-start gap-3 bg-[var(--band)] px-1 text-left hover:bg-[var(--band-on)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px data-[open=true]:bg-[var(--band-on)]`}
              >
                <span className="flex w-[76px] shrink-0 flex-col md:w-[104px]">
                  <span className="font-display text-[13px] font-[700] text-[var(--t1)] group-hover:text-[var(--p)]">
                    {r.label}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
                    {count.toLocaleString()}개
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  {folded.length > 0 ? (
                    <span className="line-clamp-2 font-english text-[15px] leading-[1.9] text-[var(--t1)] [overflow-wrap:anywhere]">
                      {folded.map((w, i) => (
                        <span key={w.word}>
                          <span className={w.thisWeek ? styles.week : undefined}>{w.word}</span>
                          {i < folded.length - 1 && <span className="text-[var(--t3)]"> · </span>}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="font-body text-[12px] text-[var(--t2)]">{r.note}</span>
                  )}
                </span>
                <span
                  aria-hidden
                  className="shrink-0 self-center font-display text-[11px] font-[600] text-[var(--t2)] group-hover:text-[var(--p)]"
                >
                  {isOpen ? '접기' : '펼치기'}
                </span>
              </button>

              {isOpen && (
                <div id={`stratum-${r.key}`} className="px-1 pb-4 pt-3">
                  <p className="font-body text-[12px] text-[var(--t2)] [word-break:keep-all]">
                    {r.note} — 오래 버티는 순
                  </p>
                  <ul className="mt-2 gap-x-8 sm:columns-2">
                    {words.map((w) => (
                      <li
                        key={w.word}
                        className="flex min-w-0 break-inside-avoid items-baseline gap-3 border-b border-[var(--bd)] py-2"
                      >
                        <span className={`font-english text-[15px] text-[var(--t1)] ${w.thisWeek ? styles.week : ''}`}>
                          {w.word}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-body text-[12px] text-[var(--t2)]">
                          {w.meaning ?? ''}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--t2)]">
                          {formatDuration(w.days)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {count > words.length && (
                    <Link
                      href="/wordvault"
                      className="mt-2 inline-flex min-h-[44px] items-center gap-1 font-display text-[12px] font-[700] text-[var(--p)] no-underline hover:text-[var(--p-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]"
                    >
                      나머지 {(count - words.length).toLocaleString()}개는 단어장에서
                      <ArrowRight size={12} aria-hidden />
                    </Link>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {/* 지금 무엇을 하면 층이 내려가는가 — 회고가 채점이 아니라 안내가 되는 지점. */}
      <div className="mt-4 flex flex-col gap-2">
        <p className="max-w-[58ch] font-editorial text-[15px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
          {heaviest.key === 'day' || heaviest.key === 'few'
            ? '간격을 두고 다시 만날수록 낱말이 아래층으로 내려가요. 오늘 다 하지 않아도 괜찮아요 — 내일 다시 만나는 편이 오히려 오래 남아요.'
            : '한 번 내려간 층은 잘 올라오지 않아요. 지금 속도면 충분해요.'}
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-[var(--t2)]">
          <span>지층 위 {onLadder.toLocaleString()}개</span>
          {unseen > 0 && <span>· 아직 만나기 전 {unseen.toLocaleString()}개</span>}
        </p>
      </div>

      {/* 가장 깊이 내려간 낱말 — 숫자가 아니라 **단어 자체**와 그 이력. */}
      {champion && (
        <p className="mt-4 border-t border-[var(--bd)] pt-3 font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
          <span className="font-display text-[11px] font-[600] text-[var(--t2)]">가장 멀리 온 단어</span>{' '}
          <span className="font-english text-[17px] text-[var(--t1)]">{champion.word}</span>{' '}
          <span>{champion.meaning}</span> — {fmtFirstMet(champion.firstMet)}에 처음 만나
          {champion.reviewCount > 0 && ` ${champion.reviewCount}번을 다시 만났고,`} 지금{' '}
          <strong className="font-display font-[700] text-[var(--t1)]">{formatDuration(champion.days)}</strong>
          을 버텨요.
        </p>
      )}
    </section>
  )
}

/** 'YYYY-MM-DD' → "8월 5일". 연도는 빼도 회고 맥락에서 모호하지 않다. */
function fmtFirstMet(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`
}
