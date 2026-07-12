// apps/web/src/components/library/browse/DifficultyMap.tsx
//
// 난이도 지도 (v06.221) — /library/scripts 오리엔테이션 핵심.
// "쉬움 → 어려움" 축 위에 시리즈(트랙)를 배치하고, 학습자의 현재 위치("여기 있어요")를
// 시리즈 사이에 끼워 넣어 "어떤 시리즈가 내게 맞는지"를 색이 아닌 위치로 전달한다(§10 접근성).
//   · 칩 = 난이도 오름차순(쉬움 왼쪽) · 클릭 → 해당 시리즈 카드로.
//   · 마커 = effectiveV 기준 좌(수월)/우(도전) 경계.
//   · 추천 트랙 = 링 + "추천" 라벨 (색만으로 정보 전달 금지).
// 수치·위치·순서는 ScriptsMap(실집계)에서 옴 — 하드코딩 없음.

'use client'

import { MapPin, Sparkles } from 'lucide-react'

import { vToCefrLabel, type ScriptsMap, type TrackKey, type TrackStat } from '@/lib/articles/source-map'

/** 트랙 난이도 중심값 (칩 정렬·마커 삽입 기준). */
function trackCenter(s: TrackStat): number {
  return (s.vMin + s.vMax) / 2
}

export function DifficultyMap({
  map,
  onSelectTrack,
}: {
  map: ScriptsMap
  onSelectTrack: (key: TrackKey) => void
}) {
  if (map.tracks.length === 0) return null

  // 난이도 오름차순(쉬움 → 어려움) 정렬 + 학습자 마커 삽입 위치 계산.
  const byDifficulty = [...map.tracks].sort((a, b) => trackCenter(a) - trackCenter(b) || a.vMin - b.vMin)
  const markerIndex = byDifficulty.filter((s) => trackCenter(s) <= map.effectiveV).length
  const myCefr = vToCefrLabel(map.effectiveV)

  const marker = (
    <div
      key="__marker"
      className="flex shrink-0 flex-col items-center gap-1 self-stretch px-1"
      aria-hidden
    >
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-[var(--r-full)] bg-[var(--p)] px-2 py-0.5 font-display text-[10px] font-[800] text-[var(--ti)]">
        <MapPin size={10} /> 여기
      </span>
      <span className="h-full w-[2px] flex-1 rounded-full bg-[var(--p)]" />
    </div>
  )

  const chips = byDifficulty.map((s) => {
    const recommended = s.track.key === map.recommendedTrackKey
    return (
      <button
        key={s.track.key}
        type="button"
        onClick={() => onSelectTrack(s.track.key)}
        aria-label={`${s.track.short} 시리즈 — ${s.cefrLabel}, ${s.count}편${recommended ? ' (추천)' : ''}`}
        className={[
          'group relative flex shrink-0 flex-col items-center gap-0.5 rounded-[var(--r-md)] border px-3 py-2',
          'transition-all duration-[var(--dur-normal)] ease-[var(--ease)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
          recommended
            ? 'border-[var(--p)] bg-[var(--p-light)] shadow-[var(--sh-xs)]'
            : 'border-[var(--bd)] bg-[var(--bg)] hover:-translate-y-0.5 hover:border-[var(--p)] hover:shadow-[var(--sh-sm)]',
        ].join(' ')}
      >
        {recommended && (
          <span className="absolute -top-2 right-1 inline-flex items-center gap-0.5 rounded-[var(--r-full)] bg-[var(--p)] px-1.5 py-[1px] font-display text-[8.5px] font-[800] text-[var(--ti)] shadow-[var(--sh-xs)]">
            <Sparkles size={8} aria-hidden /> 추천
          </span>
        )}
        <span className="text-[18px] leading-none" aria-hidden>
          {s.track.icon}
        </span>
        <span className="whitespace-nowrap font-display text-[11.5px] font-[700] text-[var(--t1)]">
          {s.track.short}
        </span>
        <span className="font-mono text-[9.5px] font-[600] text-[var(--t3)]">{s.cefrLabel}</span>
      </button>
    )
  })

  // 마커를 난이도 순 칩 사이에 삽입.
  const rail: React.ReactNode[] = []
  byDifficulty.forEach((_, i) => {
    if (i === markerIndex) rail.push(marker)
    rail.push(chips[i])
  })
  if (markerIndex >= byDifficulty.length) rail.push(marker)

  return (
    <section
      aria-label="난이도 지도"
      className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-4"
    >
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h2 className="inline-flex items-center gap-1.5 font-display text-[13px] font-[800] text-[var(--t1)]">
          <MapPin size={14} aria-hidden className="text-[var(--p)]" /> 난이도 지도
        </h2>
        <span className="font-mono text-[10.5px] font-[600] text-[var(--t3)]">
          내 레벨 · {map.userV > 0 ? `V${map.userV}` : '기준'} · {myCefr}
        </span>
      </div>

      {/* 시리즈 레일 — 쉬움(왼쪽) → 어려움(오른쪽), 마커가 내 위치 표시 */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex items-stretch gap-2">{rail}</div>
      </div>

      {/* 축 baseline — 방향 안내 (색만으로 정보 전달 금지 → 텍스트 라벨 병기) */}
      <div className="flex items-center gap-2 px-0.5">
        <span className="font-display text-[10px] font-[700] text-[var(--t3)]">← 쉬움</span>
        <span
          aria-hidden
          className="h-[3px] flex-1 rounded-full"
          style={{
            background:
              'linear-gradient(to right, color-mix(in srgb, var(--learn-known) 40%, transparent), var(--bd) 45%, color-mix(in srgb, var(--learn-review) 45%, transparent))',
          }}
        />
        <span className="font-display text-[10px] font-[700] text-[var(--t3)]">어려움 →</span>
      </div>
    </section>
  )
}
