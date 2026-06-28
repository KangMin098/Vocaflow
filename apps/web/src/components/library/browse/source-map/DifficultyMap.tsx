// apps/web/src/components/library/browse/source-map/DifficultyMap.tsx
//
// 난이도 맵 — 트랙별 V밴드를 공유 축(쉬움→어려움)에 그리고, 내 위치선을 겹친다.
// 모든 위치·색은 입력→계산 (하드코딩 0):
//   · 세그먼트 [left,width] = vToPct(vMin)~vToPct(vMax)
//   · 내 위치선 = vToPct(effectiveUserV)
//   · 세그먼트 색 = judgeTrackFit (fit/easy/hard) → color-mix wash (카드 배지색 정합)
// Calm UI: red 압박색 미사용 (도전=amber, 수월=중립).

'use client'

import {
  SOURCE_TRACKS,
  TRACK_FIT_META,
  effectiveUserV,
  judgeTrackFit,
  sortTracksForUser,
  vToPct,
  type SourceTrack,
  type TrackKey,
} from '@/lib/articles/source-map'

const LABEL_W = '8rem' // 라벨 칼럼 폭 — 내 위치선 정렬 기준

export function DifficultyMap({
  userV,
  activeKey,
  onTrackTap,
}: {
  userV: number
  activeKey: TrackKey | null
  onTrackTap: (key: TrackKey) => void
}) {
  const tracks = sortTracksForUser(SOURCE_TRACKS, userV)
  const eff = effectiveUserV(userV)
  const nowPct = vToPct(eff)

  return (
    <div
      className="relative flex flex-col gap-2.5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4"
      style={{ ['--label-w' as string]: LABEL_W }}
    >
      {/* 축 라벨 */}
      <div className="flex items-center" style={{ paddingLeft: 'var(--label-w)' }}>
        <span className="font-mono text-[10px] font-[700] text-[var(--t3)]">쉬움</span>
        <span className="ml-auto font-mono text-[10px] font-[700] text-[var(--t3)]">어려움</span>
      </div>

      {/* 내 위치선 — 레인 영역(라벨 칼럼 이후)만 덮는 오버레이 */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{ left: `calc(1rem + var(--label-w))`, right: '1rem', top: '2.75rem', bottom: '1rem' }}
      >
        <div className="absolute inset-y-0" style={{ left: `${nowPct}%` }}>
          <div className="absolute inset-y-0 w-px -translate-x-1/2 bg-[var(--p)] opacity-70" />
          <div className="absolute -top-1 -translate-x-1/2 whitespace-nowrap rounded-[var(--r-full)] bg-[var(--p)] px-1.5 py-0.5 font-mono text-[9px] font-[700] text-[var(--ti)]">
            내 위치
          </div>
        </div>
      </div>

      {/* 트랙 레인 */}
      {tracks.map((track) => (
        <Lane key={track.key} track={track} userV={userV} active={activeKey === track.key} onTap={onTrackTap} />
      ))}

      <p className="mt-1 font-body text-[10.5px] leading-[1.45] text-[var(--t3)]" style={{ paddingLeft: 'var(--label-w)' }}>
        막대는 각 트랙의 난이도 범위예요. 세로선이 지금 내 수준 — 선과 겹치는 트랙이 &ldquo;딱 맞아요&rdquo;.
      </p>
    </div>
  )
}

function Lane({
  track,
  userV,
  active,
  onTap,
}: {
  track: SourceTrack
  userV: number
  active: boolean
  onTap: (key: TrackKey) => void
}) {
  const fit = judgeTrackFit(track, userV)
  const meta = TRACK_FIT_META[fit]
  const left = vToPct(track.vMin)
  const width = Math.max(6, vToPct(track.vMax) - left) // 최소 가시 폭

  return (
    <div className="flex items-center gap-3">
      {/* 라벨 칼럼 */}
      <button
        type="button"
        onClick={() => onTap(track.key)}
        title={`${track.title} — ${meta.label}`}
        className="flex shrink-0 items-center gap-1.5 rounded-[var(--r-sm)] py-1 pr-1 text-left transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
        style={{ width: 'var(--label-w)' }}
      >
        <span aria-hidden className="text-[15px] leading-none">
          {track.icon}
        </span>
        <span className="line-clamp-1 font-display text-[11.5px] font-[700] text-[var(--t1)]">
          {track.title}
        </span>
      </button>

      {/* 레인 */}
      <button
        type="button"
        onClick={() => onTap(track.key)}
        aria-label={`${track.title} 트랙으로 이동 (난이도 ${meta.label})`}
        className="relative h-6 flex-1 rounded-[var(--r-full)] bg-[var(--bg2)] transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        <span
          className="absolute inset-y-0 flex items-center justify-center rounded-[var(--r-full)] border transition-all"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            backgroundColor: `color-mix(in srgb, ${meta.color} 20%, var(--bg))`,
            borderColor: active
              ? meta.color
              : `color-mix(in srgb, ${meta.color} 40%, transparent)`,
            boxShadow: active ? `0 0 0 2px color-mix(in srgb, ${meta.color} 35%, transparent)` : 'none',
          }}
        >
          <span
            className="truncate px-1 font-mono text-[9px] font-[700]"
            style={{ color: `color-mix(in srgb, ${meta.color} 78%, var(--t1))` }}
          >
            {meta.label}
          </span>
        </span>
      </button>
    </div>
  )
}
