// apps/web/src/components/library/browse/source-map/SourceMap.tsx
//
// 소스 맵 — /library/scripts 상단 오리엔테이션 층 (ArticlesExplorer 위).
// 사용자 V레벨(useUserVLevel)로 트랙 난이도 맵 + 카드를 재계산·재정렬.
//   · DifficultyMap 트랙 탭 → 해당 카드 scrollIntoView + 강조 (목업 약점 5)
//   · 첫 진입 = 가장 적합한(fit) 카드 1개만 펼침 (Progressive Disclosure)
//   · 카드 CTA → onPickTrack → 상위 Shell 이 ArticlesExplorer 를 그 트랙으로 필터
// 미진단(userV 0)은 V5 baseline (judgeArticleIPlusOne 정합) — 맵이 비지 않음.

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Compass } from 'lucide-react'

import { useUserVLevel } from '@/hooks/useUserVLevel'
import {
  SOURCE_TRACKS,
  computeTrackCounts,
  judgeTrackFit,
  sortTracksForUser,
  type SourceTrack,
  type TrackKey,
} from '@/lib/articles/source-map'
import type { PublishedArticle } from '@/lib/articles/types'

import { DifficultyMap } from './DifficultyMap'
import { TrackCard } from './TrackCard'

export function SourceMap({
  articles,
  onPickTrack,
}: {
  articles: PublishedArticle[]
  onPickTrack: (track: SourceTrack) => void
}) {
  const userV = useUserVLevel()

  const sorted = useMemo(() => sortTracksForUser(SOURCE_TRACKS, userV), [userV])
  const counts = useMemo(() => computeTrackCounts(articles), [articles])

  // Progressive Disclosure — 첫 진입엔 최상위 fit 트랙만 펼침. userV 로드 시 갱신(미터치 한정).
  const defaultKey = useMemo<TrackKey | null>(() => {
    const top = sorted[0]
    return top && judgeTrackFit(top, userV) === 'fit' ? top.key : null
  }, [sorted, userV])

  const [open, setOpen] = useState<Set<TrackKey>>(new Set())
  const [touched, setTouched] = useState(false)
  const [activeKey, setActiveKey] = useState<TrackKey | null>(null)

  useEffect(() => {
    if (!touched) setOpen(defaultKey ? new Set([defaultKey]) : new Set())
  }, [defaultKey, touched])

  const refs = useRef<Map<TrackKey, HTMLDivElement>>(new Map())
  const setRef = useCallback((key: TrackKey) => (el: HTMLDivElement | null) => {
    if (el) refs.current.set(key, el)
    else refs.current.delete(key)
  }, [])

  const toggle = useCallback((key: TrackKey) => {
    setTouched(true)
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // 맵 탭 → 강조 + 펼침 + 스크롤
  const handleTap = useCallback((key: TrackKey) => {
    setActiveKey(key)
    setTouched(true)
    setOpen((prev) => new Set(prev).add(key))
    requestAnimationFrame(() => {
      refs.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  const handlePick = useCallback(
    (track: SourceTrack) => {
      setActiveKey(track.key)
      onPickTrack(track)
    },
    [onPickTrack],
  )

  return (
    <section aria-label="소스 맵" className="flex flex-col gap-3">
      <header className="flex items-center gap-2 px-1">
        <span
          aria-hidden
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--p)]"
        >
          <Compass size={15} />
        </span>
        <div className="flex flex-col">
          <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">어떤 글부터 읽을까요?</h2>
          <p className="font-body text-[11.5px] text-[var(--t3)]">
            내 수준에 맞춰 트랙을 정렬했어요. 막대를 눌러 자세히 보기.
          </p>
        </div>
      </header>

      <DifficultyMap userV={userV} activeKey={activeKey} onTrackTap={handleTap} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sorted.map((track) => (
          <TrackCard
            key={track.key}
            ref={setRef(track.key)}
            track={track}
            userV={userV}
            count={counts[track.key]}
            expanded={touched ? open.has(track.key) : defaultKey === track.key}
            highlighted={activeKey === track.key}
            onToggle={() => toggle(track.key)}
            onPick={handlePick}
          />
        ))}
      </div>
    </section>
  )
}
