'use client'

// apps/web/src/app/(main)/csat/map/MapClient.tsx
//
// 히트맵에서 칸을 고르면 **그 칸으로 드릴다운**한다.
//
// ⚠️ 모달을 띄우지 않는다(CLAUDE.md §학습 UX — 모달 오버레이로 학습 중단 금지).
//   고른 칸의 다음 문은 격자 아래에 **인라인**으로 편다.

import { useState } from 'react'

import { Heatmap } from '@/components/csat/Heatmap'
import type { Heatmap as HeatmapData } from '@/lib/csat/heatmap'

export function MapClient({ data }: { data: HeatmapData }) {
  const [pick, setPick] = useState<{ typeId: string; year: number } | null>(null)
  const row = pick ? data.rows.find((r) => r.typeId === pick.typeId) : null

  return (
    <div className="flex flex-col gap-4">
      <Heatmap data={data} onPick={(typeId, year) => setPick({ typeId, year })} />

      {pick && row ? (
        <nav
          aria-label={`${row.name} 다음 단계`}
          className="flex flex-wrap gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3"
        >
          <a
            href={`/csat/${pick.typeId}`}
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 text-sm text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
          >
            {row.name} 유형 해부 →
          </a>
          {/* ⚠️ 여기는 `/csat/patterns`(묶기) 로 가고 있었다. 그 화면은 걷어냈다 —
              「내가 챙길 함정」은 손으로 고르는 것보다 **실제로 틀린 기록**이 낫고,
              그쪽은 이미 있다(`my-traps.ts`). 그래서 다음 문을 **겨루기**로 바꾼다:
              고른 유형을 본 뒤 할 일은 묶어 두는 것이 아니라 **가려낼 수 있는지 보는 것**이다. */}
          <a
            href="/csat/drill"
            className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 text-sm text-[var(--t1)] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)] hover:border-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none"
          >
            이 수법 가려낼 수 있는지 해 보기 →
          </a>
        </nav>
      ) : null}
    </div>
  )
}
