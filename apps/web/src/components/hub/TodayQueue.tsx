// apps/web/src/components/hub/TodayQueue.tsx
// 오늘의 학습 큐 — Memory Decay 4단계 색 분포 + Retrieval priming
// 학습 과학:
//   · Memory Decay (CLAUDE.md) — stable / shaky / risk / new 4단계
//   · Retrieval priming (Wagner) — 학습 직전 단어 종류 미리 노출
//   · Cognitive Load (Sweller) — 복잡한 SRS 결과를 색·숫자로 chunk

import { Sparkles } from 'lucide-react'

import { MEMORY_LABEL } from '@/lib/framework/memory-labels'

export interface QueueBucket {
  /** Memory Decay 4단계 + new */
  kind: 'stable' | 'shaky' | 'risk' | 'new'
  count: number
  /** 미리보기 단어 (최대 3개) */
  preview?: string[]
}

export interface TodayQueueProps {
  buckets: QueueBucket[]
  /** 우측 정보 */
  totalLabel?: string
}

// color = 막대·점을 칠하는 색 · ink = 그 색 계열을 **글자**로 쓸 때(AA 확보) · tint = 카드 배경.
//   같은 값을 글자에도 쓰면 종이 위 2.0~3.6:1 로 미달이었다(2026-08-09 axe 실측).
//   ⚠️ `${meta.color}0D` 처럼 var() 문자열에 알파 hex 를 붙이던 코드는 **무효 CSS** 라
//      카드 배경/테두리가 실제로는 투명이었다 → color-mix 로 교체.
const KIND_META: Record<
  QueueBucket['kind'],
  { label: string; color: string; ink: string; tint: string; edge: string; description: string }
> = {
  stable: {
    label: MEMORY_LABEL.stable.label,
    color: 'var(--memory-stable)',
    ink: 'var(--memory-stable-ink)',
    tint: 'color-mix(in srgb, var(--memory-stable) 8%, transparent)',
    edge: 'color-mix(in srgb, var(--memory-stable) 30%, transparent)',
    description: '확실히 알고 있어요',
  },
  shaky: {
    label: MEMORY_LABEL.shaky.label,
    color: 'var(--memory-shaky)',
    ink: 'var(--memory-shaky-ink)',
    tint: 'color-mix(in srgb, var(--memory-shaky) 8%, transparent)',
    edge: 'color-mix(in srgb, var(--memory-shaky) 30%, transparent)',
    description: '가끔 헷갈려요',
  },
  risk: {
    label: MEMORY_LABEL.risk.label,
    color: 'var(--memory-risk)',
    ink: 'var(--memory-risk-ink)',
    tint: 'color-mix(in srgb, var(--memory-risk) 8%, transparent)',
    edge: 'color-mix(in srgb, var(--memory-risk) 30%, transparent)',
    description: '오늘 만나주세요',
  },
  new: {
    label: MEMORY_LABEL.new.label,
    color: 'var(--memory-new)',
    ink: 'var(--memory-new-ink)',
    tint: 'color-mix(in srgb, var(--memory-new) 8%, transparent)',
    edge: 'color-mix(in srgb, var(--memory-new) 30%, transparent)',
    description: '처음 만나요',
  },
}

export function TodayQueue({ buckets, totalLabel }: TodayQueueProps) {
  const total = buckets.reduce((s, b) => s + b.count, 0)
  const visibleBuckets = buckets.filter((b) => b.count > 0)

  return (
    <section
      aria-label="오늘의 학습 큐"
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-xs)]"
    >
      <header className="mb-4 flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--on-p-tint)]"
          aria-hidden
        >
          <Sparkles size={13} strokeWidth={2} />
        </span>
        <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">오늘의 큐</h2>
        <span className="font-body text-[12px] text-[var(--t2)]">·</span>
        <p className="font-body text-[12px] text-[var(--t2)]">기억 상태별 추천</p>
        <span
          className="ml-auto font-mono text-[11px] tabular-nums text-[var(--t2)]"
        >
          {totalLabel ?? `${total}개`}
        </span>
      </header>

      {/* 4단계 분포 가로 바 */}
      {/* 막대 전체를 하나의 그림으로 읽히게 한다 — 조각 div 에 aria-label 을 다는 것은
          role 없는 요소에 금지된 속성이라 axe(aria-prohibited-attr) 위반이었다. */}
      <div
        className="mb-4 flex h-2 w-full overflow-hidden rounded-full bg-[var(--bg3)]"
        role="img"
        aria-label={buckets.filter((b) => b.count > 0).map((b) => KIND_META[b.kind].label + ' ' + b.count + '개').join(', ')}
      >
        {buckets.map((b) => {
          if (b.count === 0) return null
          const pct = total > 0 ? (b.count / total) * 100 : 0
          const meta = KIND_META[b.kind]
          return (
            <div
              key={b.kind}
              style={{ width: `${pct}%`, backgroundColor: meta.color }}
              title={`${meta.label}: ${b.count}개`}
            />
          )
        })}
      </div>

      {/* 4 카드 */}
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {(['risk', 'shaky', 'new', 'stable'] as const).map((kind) => {
          const b = buckets.find((x) => x.kind === kind)
          const meta = KIND_META[kind]
          const count = b?.count ?? 0
          const dim = count === 0
          return (
            <li
              key={kind}
              className="rounded-[var(--r-md)] border p-3 transition-all duration-[var(--dur-normal)]"
              style={
                dim
                  ? { borderColor: 'var(--bd)', background: 'var(--bg2)', opacity: 0.55 }
                  : {
                      // 카드 active: color wash + border tint (Memory Decay 정체성)
                      borderColor: meta.edge,
                      background: meta.tint,
                    }
              }
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                <p className="font-display text-[11px] font-[700] uppercase tracking-[0.06em]" style={{ color: dim ? 'var(--t2)' : meta.ink }}>
                  {meta.label}
                </p>
              </div>
              <p className="mt-1.5 font-display text-[22px] font-[800] tabular-nums leading-none text-[var(--t1)]">
                {count}
              </p>
              <p className="mt-1 font-body text-[11px] leading-tight text-[var(--t2)]">
                {meta.description}
              </p>
              {b?.preview && b.preview.length > 0 && (
                <p className="mt-2 truncate font-english text-[10px] italic text-[var(--t2)]">
                  {b.preview.slice(0, 3).join(' · ')}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {/* 빈 상태 (전체 큐 0) */}
      {visibleBuckets.length === 0 && (
        <p className="mt-3 text-center font-body text-[12px] italic text-[var(--t2)]">
          오늘 만날 단어가 없어요. 단어장을 추가하거나 새 라운드를 시작해보세요.
        </p>
      )}
    </section>
  )
}
