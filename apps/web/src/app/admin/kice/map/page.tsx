// apps/web/src/app/admin/kice/map/page.tsx
//
// **① 지형 파악 — 훑는다.**
//
// 유형 카드 26장에는 **시간축이 없었다.** 총합만 보이니 2018년에 사라진 유형과 작년에 늘어난
// 유형이 같은 얼굴로 놓인다. 이 화면은 그 둘을 가른다.
//
// ⚠️ 원문을 읽지 않는다 — `csat_items_public`(지문·선지가 없는 뷰)만 쓴다.

import type { Metadata } from 'next'
import Link from 'next/link'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'

import { MapClient } from './MapClient'
import { loadHeatmap } from '@/lib/csat/heatmap'

export const metadata: Metadata = {
  title: '기출 지형 — 연도 × 유형',
  description:
    '평가원 수능·모의평가 독해 기출을 연도와 유형으로 한 판에 놓았습니다. 어느 유형이 언제부터 얼마나 자주 나오는지 보입니다.',
}

export const dynamic = 'force-dynamic'

export default async function CsatMapPage() {
  const data = await loadHeatmap()

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-editorial text-xl font-[600] text-[var(--t1)]">지형</h1>
        <AdminScreenHelp screen="kice-map" className="mt-2" />
        {/* 수치는 늘 분모와 함께(브리프 E5). */}
        <p className="tabular-nums text-xs text-[var(--t3)]">
          {data.exams}회차 · {data.items.toLocaleString()}문항 · {data.rows.length}유형
        </p>
      </header>

      {data.error ? (
        <p className="mt-3 break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 text-sm text-[var(--t2)]">
          지금은 지형을 불러오지 못했어요.{' '}
          <Link href="/admin/kice" className="inline-flex min-h-[44px] items-center underline underline-offset-2">
            허브에서 유형별로 보기 →
          </Link>
        </p>
      ) : !data.rows.length ? (
        // 빈 상태는 설명이 아니라 **다음 한 걸음**이다(브리프 A4 · D5).
        <p className="mt-3 break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 text-sm text-[var(--t2)]">
          아직 셀 기출이 없어요.{' '}
          <Link href="/admin/kice" className="inline-flex min-h-[44px] items-center underline underline-offset-2">
            오답 분포부터 보기 →
          </Link>
        </p>
      ) : (
        <div className="mt-4">
          <MapClient data={data} />
        </div>
      )}
    </div>
  )
}
