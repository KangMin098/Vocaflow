// apps/web/src/app/admin/kice/predict/page.tsx
//
// **④ 사정권 — 판단한다.**
//
// ⚠️ **예측이 아니라 산수다.** 평가원의 다음 출제를 아는 사람은 없다. 이 화면이 하는 일은
//   최근 출제 빈도를 세어 A/B/C 로 묶고 **그 근거 수를 함께 적는 것**이다. 학습자가
//   ① 지형에서 같은 숫자를 직접 확인할 수 있어야 한다(CLAUDE.md I5).
//
// ⚠️ 원래 계획은 `csat_type_reports.open_questions` 를 펴는 것이었는데, 실제로 읽어 보니
//   분석가 작업 노트였다(「모청크의 관찰 ①」·「body_ok:false」·「파서 개선 시」).
//   학습자 글이 아니라 뺐다 — 자세한 경위는 `lib/csat/priority.ts` 머리말.

import type { Metadata } from 'next'
import Link from 'next/link'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'

import { loadHeatmap } from '@/lib/csat/heatmap'
import { BAND_LABEL, BAND_SAYS, buildPriority, recentYearCount, type Band } from '@/lib/csat/priority'
import { AXIS } from '@/lib/csat/axes'

import { PriorityClient } from './PriorityClient'

export const metadata: Metadata = {
  title: '사정권 — 최근 출제가 많은 유형',
  description:
    // 정적 메타데이터라 런타임 값을 못 쓴다 — 그래서 **숫자를 아예 안 적는다.**
    // 박아 두면 회차가 늘 때 본문과 어긋난다(본문은 세어서 쓴다).
    '최근 회차의 출제 빈도를 세어 유형을 A·B·C로 묶었습니다. 예측이 아니라 기출을 센 결과입니다.',
}

export const dynamic = 'force-dynamic'

const BANDS: Band[] = ['A', 'B', 'C', 'gone']

export default async function CsatPredictPage() {
  const map = await loadHeatmap()
  const rows = buildPriority(map)
  // 문구의 「N개년」은 세어서 쓴다 — 박아 두면 회차가 늘 때 아래 줄과 어긋난다.
  const recentN = recentYearCount(map.years)

  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-editorial text-xl font-[600] text-[var(--t1)]">사정권</h1>
        <AdminScreenHelp screen="kice-predict" className="mt-2" />
        <p className="tabular-nums text-xs text-[var(--t3)]">
          {map.exams}회차 {map.items.toLocaleString()}문항을 센 결과
        </p>
      </header>

      <p className="mt-2 break-keep text-[13px] leading-relaxed text-[var(--t2)]">
        다음 시험을 맞히는 화면이 아니에요. <strong className="text-[var(--t1)]">최근 {recentN}개년에 몇 번
        나왔는지</strong>를 세어 묶은 것이고, 같은 숫자를{' '}
        <Link href="/admin/kice/map" className="inline-flex min-h-[44px] items-center underline underline-offset-2">
          지형
        </Link>
        에서 직접 확인할 수 있어요.
      </p>

      {map.error || !rows.length ? (
        <p className="mt-4 break-keep rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4 text-sm text-[var(--t2)]">
          지금은 사정권을 계산하지 못했어요.{' '}
          <Link href="/admin/kice" className="inline-flex min-h-[44px] items-center underline underline-offset-2">
            오답 분포부터 보기 →
          </Link>
        </p>
      ) : (
        <div className="mt-5">
          <PriorityClient
            rows={rows}
            bands={BANDS.map((b) => ({ band: b, label: BAND_LABEL[b], says: BAND_SAYS[b] }))}
            hardMark={AXIS.hard.mark}
            hardFg={AXIS.hard.fg}
            formatFg={AXIS.format.fg}
          />
        </div>
      )}
    </div>
  )
}
