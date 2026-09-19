// apps/web/src/components/flashcard/ForgettingCurve.tsx
//
// **이 단어의 기억선** — `/flashcard/play` 골격(2026-09-19 발산 A · docs/design/compare/flashcard-play.md · DD-24).
//
// 카드 바로 아래 한 줄의 시간축. 왼쪽 = 지난 복습 → 오늘까지 이 단어가 흐려진 선(R(t)),
// 오른쪽 = 오늘 이후. 뒤집으면 네 평가의 **다음 만남 자리**가 축 위에 눈금으로 서고,
// 손을 얹은(hover·focus) 평가의 다음 곡선이 그어진다 — "이 버튼이 무엇을 정하는가" 가 선으로 보인다.
// Anki 의 네 버튼은 날짜만 말한다. 여기는 그 날짜까지 기억이 어떻게 내려가는지를 말한다.
//
// 모션: 없다(정지 그래픽 — 학습 화면 7종 밖 모션을 만들지 않는다). 미리보기는 즉시 바뀐다.
// 접근성: 색만으로 말하지 않는다 — 오늘 상태는 밑줄 두께(DecayUnderline) + 말, SVG 는 문장 aria-label.
// ⚠️ FSRS 변수(D/S)를 숫자로 보이지 않는다(§17 안티패턴 2).

'use client'

import { DecayUnderline } from '@/components/ui/press'
import { formatDue, type LineRating, type MemoryLine } from '@/lib/flashcard/memory-line'

const W = 600
const H = 90
const PAD = 6
/** 오늘의 가로 위치 — 왼쪽 35% 가 지난 시간, 나머지가 앞으로 */
const TODAY_X = W * 0.35

const STATE_KO = { stable: '알아요', shaky: '익숙해요', risk: '흐릿해요', new: '처음 만나요' } as const
export const RATING_KO: Record<LineRating, string> = {
  again: '몰라요',
  hard: '어려워요',
  good: '기억나요',
  easy: '너무 쉬워요',
}

const y = (r: number) => PAD + (H - PAD * 2) * (1 - r)

export function ForgettingCurve({
  line,
  preview,
  showRatings,
}: {
  line: MemoryLine
  /** 손을 얹은 평가 — 그 평가의 다음 곡선을 긋는다 */
  preview: LineRating | null
  /** 뒤집은 뒤 — 네 평가의 다음 만남 눈금을 세운다 */
  showRatings: boolean
}) {
  const pastSpan = line.past.length > 0 ? Math.max(1, -line.past[0].d) : 1
  const xPast = (d: number) => TODAY_X * (1 + d / pastSpan)
  // 앞으로는 제곱근 축 — 10분·1일·8일이 한데 뭉치지 않게
  const xFuture = (d: number) => TODAY_X + (W - TODAY_X) * Math.sqrt(Math.min(d, line.horizon) / line.horizon)

  const pastPath = line.past.map((p, i) => `${i === 0 ? 'M' : 'L'}${xPast(p.d).toFixed(1)},${y(p.r).toFixed(1)}`).join(' ')
  const chosen = showRatings && preview ? line.previews.find((p) => p.rating === preview) : undefined
  const futurePath = chosen
    ? chosen.curve.map((p, i) => `${i === 0 ? 'M' : 'L'}${xFuture(p.d).toFixed(1)},${y(p.r).toFixed(1)}`).join(' ')
    : ''

  const since =
    line.sinceDays === null
      ? null
      : line.sinceDays < 1
        ? '오늘 본 단어'
        : `지난번 뒤로 ${Math.round(line.sinceDays)}일`
  const label =
    `이 단어의 기억 — 지금 ${STATE_KO[line.state]}` +
    (since ? `, ${since}` : '') +
    (chosen ? `. ${RATING_KO[chosen.rating]}를 고르면 ${formatDue(chosen.dueInDays)} 다시 만나요.` : '.')

  return (
    <figure data-memory-line={line.state} className="mt-5 w-full max-w-[540px]">
      <figcaption className="flex items-baseline justify-between gap-3 font-mono text-[11px] tabular-nums text-[var(--t2)]">
        <span>이 단어의 기억</span>
        <span className="flex items-baseline gap-2">
          {since && <span>{since}</span>}
          <span className="font-display text-[12px] font-[700] text-[var(--t1)]">
            <DecayUnderline state={line.state}>{STATE_KO[line.state]}</DecayUnderline>
          </span>
        </span>
      </figcaption>

      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-1 block h-[64px] w-full md:h-[76px]"
      >
        {/* 문턱 — 0.95(알아요) · 0.70(흐릿해요 경계). 판면 괘선처럼 옅게 */}
        {[0.95, 0.7].map((r) => (
          <line key={r} x1="0" x2={W} y1={y(r)} y2={y(r)} stroke="var(--bd)" strokeWidth="1" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
        ))}
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--bd)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {/* 오늘 */}
        <line x1={TODAY_X} x2={TODAY_X} y1="0" y2={H} stroke="var(--t4)" strokeWidth="1" vectorEffect="non-scaling-stroke" />

        {line.past.length > 0 ? (
          <path d={pastPath} fill="none" stroke="var(--t1)" strokeWidth="1.75" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ) : (
          // 새 낱말 — 지난 선이 없다. 점선 바닥이 "아직 기억이 없다" 를 말한다
          <line x1="0" x2={TODAY_X} y1={y(0)} y2={y(0)} stroke="var(--memory-new)" strokeWidth="2" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        )}

        {chosen && (
          <path d={futurePath} fill="none" stroke="var(--memory-stable)" strokeWidth="1.75" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        )}

        {/* 네 평가의 다음 만남 자리 */}
        {showRatings &&
          line.previews.map((p) => (
            <line
              key={p.rating}
              x1={xFuture(p.dueInDays)}
              x2={xFuture(p.dueInDays)}
              y1={H - PAD - (p.rating === preview ? 16 : 8)}
              y2={H - PAD}
              stroke={p.rating === preview ? 'var(--t1)' : 'var(--t3)'}
              strokeWidth={p.rating === preview ? 2 : 1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
      </svg>

      <div className="relative mt-1 h-4 font-mono text-[10.5px] tabular-nums text-[var(--t3)]" aria-hidden>
        <span className="absolute left-0">{line.past.length > 0 ? '지난 복습' : '처음'}</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${(TODAY_X / W) * 100}%` }}>
          오늘
        </span>
        <span className="absolute right-0">{line.horizon}일 뒤</span>
      </div>
      {chosen && (
        <p className="mt-1 text-right font-body text-[12px] text-[var(--t2)]" aria-hidden>
          {RATING_KO[chosen.rating]} → <span className="font-mono tabular-nums text-[var(--t1)]">{formatDue(chosen.dueInDays)}</span> 다시 만나요
        </p>
      )}
    </figure>
  )
}
