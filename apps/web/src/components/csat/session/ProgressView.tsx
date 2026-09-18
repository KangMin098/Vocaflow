'use client'

// apps/web/src/components/csat/session/ProgressView.tsx
//
// **기록 — 숫자 셋과 막대 한 열. 끝.** (지시문 B)
//
//   스트릭 · 이번 주 문항 · 복습 대기
//   유형별 정확도(푼 유형만 · 낮은 것부터)
//
// 표를 쓰지 않는다(A3). 막대의 길이가 정확도이고, 숫자(맞힌 수/푼 수)가 옆에 함께 있다 —
// 색만으로 말하지 않는다. 정확도가 낮아도 빨갛지 않다(철학 3).

import Link from 'next/link'
import { useEffect, useState } from 'react'

import type { LearnerCatalog } from '@/lib/csat/session/catalog'
import { dueReviews, streak, typeAccuracy, weekCount, type LearnerRecord } from '@/lib/csat/session/model'
import { loadRecord } from '@/lib/csat/session/store'

import { PRIMARY } from './SessionHome'

export function ProgressView({ types }: { types: LearnerCatalog['types'] }) {
  const [record, setRecord] = useState<LearnerRecord | null>(null)
  useEffect(() => {
    void loadRecord().then(setRecord)
  }, [])

  if (!record) return <p className="text-[15px] text-[var(--t3)]" aria-busy="true">기록을 여는 중…</p>

  const now = new Date()
  const st = streak(record, now)
  const numbers = [
    { label: '연속', value: st.days, unit: '일', id: 'streak' },
    { label: '이번 주', value: weekCount(record, now), unit: '문항', id: 'week' },
    { label: '복습 대기', value: dueReviews(record, now).length, unit: '문항', id: 'due' },
  ]
  const name = new Map(types.map((t) => [t.id, t.name]))
  const rows = [...typeAccuracy(record.attempts)]
    .map(([id, v]) => ({ id, name: name.get(id) ?? id, ...v }))
    .sort((a, b) => a.rate - b.rate || b.n - a.n)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-editorial text-[24px] font-[600] text-[var(--t1)]">기록</h1>

      <dl className="flex flex-col gap-2" data-testid="progress-numbers">
        {numbers.map((n) => (
          <div key={n.id} className="flex items-baseline justify-between gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-3" data-testid={`num-${n.id}`}>
            <dt className="text-[14px] text-[var(--t3)]">{n.label}</dt>
            <dd className="text-[var(--t1)]">
              <span className="font-mono text-[26px] tabular-nums leading-none">{n.value}</span>
              <span className="ml-0.5 text-[14px] text-[var(--t2)]">{n.unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="acc-h">
        <h2 id="acc-h" className="text-[15px] font-[600] text-[var(--t2)]">
          유형별 정확도
        </h2>
        {rows.length ? (
          <ul className="mt-3 flex flex-col gap-3" data-testid="accuracy">
            {rows.map((r) => (
              <li key={r.id}>
                <div className="flex items-baseline justify-between gap-2 text-[15px]">
                  <span className="min-w-0 break-keep text-[var(--t1)]">{r.name}</span>
                  <span className="shrink-0 font-mono tabular-nums text-[var(--t2)]">
                    {r.correct}/{r.n}
                  </span>
                </div>
                <div
                  className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--bg3)]"
                  role="img"
                  aria-label={`${r.name} ${r.n}문항 중 ${r.correct}문항 정답`}
                >
                  <div className="h-full rounded-full bg-[var(--t2)]" style={{ width: `${Math.round(r.rate * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          // 빈 상태 — 한 문장 + 버튼 하나(D5)
          <div className="mt-3 flex flex-col gap-3">
            <p className="break-keep text-[16px] text-[var(--t2)]">첫 세션을 마치면 여기에 유형별로 쌓여요.</p>
            <Link href="/csat" className={PRIMARY}>
              오늘의 세션으로
            </Link>
          </div>
        )}
      </section>

      {/* Gate 4 — 막대 아래 「오늘의 세션으로」 버튼을 뺐다. 지시문이 「숫자 셋과 막대 하나. 그 이상 없음」
          이고, 돌아가는 길은 셸(사이드바·탭바)에 있다. 기록이 **없을 때**의 버튼은 남긴다 — 빈 화면의 다음 한 걸음이다. */}
    </div>
  )
}
