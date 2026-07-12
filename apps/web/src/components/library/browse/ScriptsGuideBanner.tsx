// apps/web/src/components/library/browse/ScriptsGuideBanner.tsx
//
// 학습권장 배너 (v06.221) — /library/scripts 상단 개인화 헤더.
// 학습자 레벨 밴드(미진단/초급/중급/고급)에 맞춰 "지금 무엇부터" 한 문장으로 안내.
//   · 미진단 → 진단 유도(/diagnostic) · 그 외 → 추천 시리즈로 이동.
//   · 고급 → 솔직한 안내(대부분 수월) + 깊이 유도 (사용자 결정).
// Calm UI: 폭죽·과장 없이 차분한 안내 톤.

'use client'

import Link from 'next/link'
import { ArrowRight, Compass, Sparkles } from 'lucide-react'

import { bandGuidance, type ScriptsMap, type TrackKey } from '@/lib/articles/source-map'

export function ScriptsGuideBanner({
  map,
  onSelectTrack,
}: {
  map: ScriptsMap
  onSelectTrack: (key: TrackKey) => void
}) {
  const g = bandGuidance(map)

  const ctaClass =
    'inline-flex min-h-[44px] w-fit items-center gap-1.5 rounded-[var(--r-md)] bg-[var(--p)] px-4 py-2 font-display text-[13px] font-[700] text-[var(--ti)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:opacity-90'

  return (
    <section
      aria-label="학습 안내"
      className="relative overflow-hidden rounded-[var(--r-lg)] border bg-[var(--p-light)] p-5"
      style={{ borderColor: 'color-mix(in srgb, var(--p) 22%, transparent)' }}
    >
      <div className="flex flex-col gap-2.5">
        <span className="inline-flex w-fit items-center gap-1.5 font-display text-[11px] font-[800] uppercase tracking-[0.1em] text-[var(--p)]">
          <Compass size={13} aria-hidden /> {g.eyebrow}
        </span>
        <h2 className="font-editorial text-[22px] font-[600] leading-[1.15] tracking-[-0.01em] text-[var(--t1)] md:text-[26px]">
          {g.title}
        </h2>
        <p className="max-w-[62ch] font-body text-[13.5px] leading-[1.55] text-[var(--t2)]">{g.sub}</p>

        <div className="mt-1">
          {g.cta.kind === 'diagnostic' ? (
            <Link href="/diagnostic" className={ctaClass}>
              <Sparkles size={14} aria-hidden />
              {g.cta.label}
              <ArrowRight size={14} aria-hidden />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => map.recommendedTrackKey && onSelectTrack(map.recommendedTrackKey)}
              disabled={!map.recommendedTrackKey}
              className={`${ctaClass} disabled:opacity-50`}
            >
              {g.cta.label}
              <ArrowRight size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
