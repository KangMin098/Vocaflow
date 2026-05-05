// apps/web/src/components/hub/TodayQueue.tsx
// 오늘의 학습 큐 — Memory Decay 4단계 색 분포 + Retrieval priming
// 학습 과학:
//   · Memory Decay (CLAUDE.md) — stable / shaky / risk / new 4단계
//   · Retrieval priming (Wagner) — 학습 직전 단어 종류 미리 노출
//   · Cognitive Load (Sweller) — 복잡한 SRS 결과를 색·숫자로 chunk

import { Sparkles } from 'lucide-react'

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

const KIND_META: Record<
  QueueBucket['kind'],
  { label: string; color: string; bg: string; description: string }
> = {
  stable: {
    label: '안정',
    color: 'var(--memory-stable, #22C55E)',
    bg: 'rgba(34, 197, 94, 0.12)',
    description: '확실히 알고 있어요',
  },
  shaky: {
    label: '흔들림',
    color: 'var(--memory-shaky, #F59E0B)',
    bg: 'rgba(245, 158, 11, 0.12)',
    description: '가끔 헷갈려요',
  },
  risk: {
    label: '흐릿함',
    color: 'var(--memory-risk, #EF4444)',
    bg: 'rgba(239, 68, 68, 0.12)',
    description: '오늘 만나주세요',
  },
  new: {
    label: '새 단어',
    color: 'var(--memory-new, #94A3B8)',
    bg: 'rgba(148, 163, 184, 0.12)',
    description: '처음 만나요',
  },
}

export function TodayQueue({ buckets, totalLabel }: TodayQueueProps) {
  const total = buckets.reduce((s, b) => s + b.count, 0)
  const visibleBuckets = buckets.filter((b) => b.count > 0)

  return (
    <section
      aria-label="오늘의 학습 큐"
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
    >
      <header className="mb-4 flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--p)]"
          aria-hidden
        >
          <Sparkles size={13} strokeWidth={2} />
        </span>
        <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">오늘의 큐</h2>
        <span className="font-body text-[12px] text-[var(--t3)]">·</span>
        <p className="font-body text-[12px] text-[var(--t3)]">기억 상태별 추천</p>
        <span
          className="ml-auto font-mono text-[11px] tabular-nums text-[var(--t3)]"
        >
          {totalLabel ?? `${total}개`}
        </span>
      </header>

      {/* 4단계 분포 가로 바 */}
      <div className="mb-4 flex h-2 w-full overflow-hidden rounded-full bg-[var(--bg3)]">
        {buckets.map((b) => {
          if (b.count === 0) return null
          const pct = total > 0 ? (b.count / total) * 100 : 0
          const meta = KIND_META[b.kind]
          return (
            <div
              key={b.kind}
              style={{ width: `${pct}%`, backgroundColor: meta.color }}
              title={`${meta.label}: ${b.count}개`}
              aria-label={`${meta.label}: ${b.count}개`}
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
              className={`rounded-[var(--r-md)] border p-3 transition-all duration-[var(--dur-normal)] ${
                dim ? 'border-[var(--bd)] bg-[var(--bg2)] opacity-60' : 'border-[var(--bd)] bg-[var(--bg)]'
              }`}
              style={!dim ? { borderColor: `${meta.color}40` } : undefined}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                <p className="font-display text-[11px] font-[700] uppercase tracking-[0.06em]" style={{ color: dim ? 'var(--t3)' : meta.color }}>
                  {meta.label}
                </p>
              </div>
              <p className="mt-1.5 font-display text-[22px] font-[800] tabular-nums leading-none text-[var(--t1)]">
                {count}
              </p>
              <p className="mt-1 font-body text-[11px] leading-tight text-[var(--t3)]">
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
        <p className="mt-3 text-center font-body text-[12px] italic text-[var(--t3)]">
          오늘 만날 단어가 없어요. 단어장을 추가하거나 새 라운드를 시작해보세요.
        </p>
      )}
    </section>
  )
}
