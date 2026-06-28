// apps/web/src/components/library/browse/SourceMapShell.tsx
//
// 소스 맵 ↔ 탐색 목록 연결 셸 (클라).
// page(RSC)가 fetch 한 articles 를 SourceMap + ArticlesExplorer 양쪽에 공유.
// 맵 트랙 CTA → 그 트랙 소스로 ArticlesExplorer 필터 + 목록으로 스무스 스크롤
// (목업 약점 5 — 맵과 목록 연결). 단일 articles prop, 추가 fetch 0.

'use client'

import { useCallback, useRef, useState } from 'react'

import type { SourceTrack } from '@/lib/articles/source-map'
import type { PublishedArticle } from '@/lib/articles/types'

import { ArticlesExplorer } from './ArticlesExplorer'
import { SourceMap } from './source-map/SourceMap'

export function SourceMapShell({ articles }: { articles: PublishedArticle[] }) {
  const [filter, setFilter] = useState<{ label: string; sources: string[] } | null>(null)
  const explorerRef = useRef<HTMLDivElement>(null)

  const handlePickTrack = useCallback((track: SourceTrack) => {
    setFilter({ label: track.title, sources: [...track.sources] })
    requestAnimationFrame(() => {
      explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const handleClear = useCallback(() => setFilter(null), [])

  return (
    <div className="flex flex-col gap-6">
      <SourceMap articles={articles} onPickTrack={handlePickTrack} />
      <div ref={explorerRef} className="scroll-mt-4">
        <ArticlesExplorer articles={articles} sourceFilter={filter} onClearSourceFilter={handleClear} />
      </div>
    </div>
  )
}
