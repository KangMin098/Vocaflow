'use client'

// apps/web/src/components/csat/session/SessionHome.tsx
//
// **홈 — 카드 한 장, 버튼 하나.**
//
//   ┌──────────────────────────────┐
//   │ 오늘                          │
//   │ 빈칸 1 + 순서 1 + 복습 1       │
//   │ 약 9분                        │
//   │ (PDF 가 없으면 받기/놓기 한 줄) │
//   │ [ 시작 ]                      │
//   └──────────────────────────────┘
//   3일째 · 기록 보기
//
// 무엇을 할지는 **시스템이 고른다**(지시문 A2) — 유형·회차·모드를 고르는 칸이 없다.
// 처음 온 사람에게는 그림 셋(풀고 → 이해하고 → 한 줄) 한 장을 한 번만 보여 준다.
//
// 기록은 기기(IndexedDB)에 있어 카드는 브라우저에서 짠다. 짜는 동안 카드 자리는 같은 크기로 비워 둔다
// (자리가 뛰면 [시작]을 누르려던 손가락이 엉뚱한 곳을 누른다).

import { ArrowRight, Lightbulb, PencilLine, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { track } from '@/lib/analytics/client'
import { REFLOW_VERSION } from '@/lib/csat/reflow/reflow'
import type { LearnerCatalog } from '@/lib/csat/session/catalog'
import {
  composeSession,
  planLabel,
  streak,
  type LearnerRecord,
  type SessionPlan,
} from '@/lib/csat/session/model'
import { cachedExamIds, loadRecord, saveRecord } from '@/lib/csat/session/store'
import { toItemSlug } from '@/lib/csat/item-slug'

import { PaperDrop } from './PaperDrop'

export const PRIMARY =
  'inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--t1)] bg-[var(--t1)] px-5 text-[17px] font-[600] text-[var(--bg)] transition-[opacity,background-color] duration-[var(--dur-normal)] ease-[var(--ease)] hover:opacity-90 active:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none'

/** 세션 주소 — 짠 문항을 그대로 싣는다(새로 고침해도 같은 세션) */
export function sessionHref(plan: SessionPlan): string {
  const set = plan.slots.map((s) => toItemSlug(s.item.id)).join(',')
  const kinds = plan.slots.map((s) => s.kind).join(',')
  return `/csat/session?set=${encodeURIComponent(set)}&k=${encodeURIComponent(kinds)}`
}

interface Ready {
  record: LearnerRecord
  plan: SessionPlan
  cached: string[]
}

export function SessionHome({ catalog }: { catalog: LearnerCatalog }) {
  const router = useRouter()
  const [state, setState] = useState<Ready | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const [record, cached] = await Promise.all([loadRecord(), cachedExamIds(REFLOW_VERSION)])
      if (!alive) return
      setState({ record, cached, plan: composeSession(catalog, record, new Date(), cached) })
    })()
    return () => {
      alive = false
    }
  }, [catalog])

  if (!state) {
    return (
      <div aria-busy="true" className="min-h-[260px] rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5">
        <p className="text-[15px] text-[var(--t3)]">오늘의 세션을 짜고 있어요…</p>
      </div>
    )
  }

  const { record, plan, cached } = state
  const needed = plan.exams.filter((e) => !cached.includes(e))
  const st = streak(record, new Date())
  const href = sessionHref(plan)

  const start = async () => {
    track({
      name: 'csat_session_started',
      props: {
        size: plan.slots.length,
        review: plan.slots.some((s) => s.kind === 'review'),
        needed: plan.exams.length,
        cached: plan.exams.length - needed.length,
      },
    })
    if (!record.onboarded) await saveRecord({ ...record, onboarded: true })
    router.push(href)
  }

  if (!record.onboarded) return <Onboarding onStart={start} />

  if (!plan.slots.length) {
    // 빈 상태 — 한 문장 + 버튼 하나(지시문 D5)
    return (
      <div className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5">
        <p className="break-keep text-[17px] text-[var(--t1)]">오늘 풀 문항을 아직 못 골랐어요.</p>
        <button type="button" className={`${PRIMARY} mt-4`} onClick={() => router.refresh()}>
          다시 짜기
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <section
        aria-labelledby="csat-today-h"
        className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5"
        data-testid="today-card"
        data-need={needed.join(',')}
      >
        {/* 제목이 곧 오늘 할 일이다 — 「오늘」 한 낱말만 제목으로 두면 스크린리더가 할 일을 못 읽는다.
            서체는 제목 기본값(세리프)을 그대로 둔다(v07 · `phase2-screens` 회귀). */}
        <h1 id="csat-today-h" className="text-[var(--t1)]">
          <span className="block text-[15px] font-[500] text-[var(--t3)]">오늘</span>
          <span className="mt-1 block break-keep text-[24px] font-[700] leading-snug" data-testid="today-plan">
            {planLabel(plan, catalog.types)}
          </span>
        </h1>
        <p className="mt-1 text-[16px] text-[var(--t2)]">
          약 <span className="font-mono tabular-nums">{plan.minutes}</span>분
        </p>

        {needed.length ? (
          <div className="mt-4 border-t border-[var(--bd)] pt-4">
            <PaperDrop
              catalog={catalog}
              needed={needed}
              onLoaded={(p) =>
                setState((s) =>
                  s ? { ...s, cached: [...new Set([...s.cached, p.exam_id])] } : s,
                )
              }
            />
          </div>
        ) : null}

        <button type="button" onClick={start} className={`${PRIMARY} mt-5`} data-testid="start">
          시작
          <ArrowRight aria-hidden className="h-5 w-5" />
        </button>
      </section>

      <p className="flex flex-wrap items-center justify-between gap-2 px-1 text-[15px] text-[var(--t2)]">
        <span data-testid="streak">
          {st.days > 0 ? (
            <>
              <span className="font-mono tabular-nums text-[var(--t1)]">{st.days}</span>일째
            </>
          ) : st.broken ? (
            <span className="font-editorial">오늘 다시 시작해요</span>
          ) : null /* Gate 4 — 「첫날이에요」를 뺐다. 아무 정보도 없는 위로였다 */}
        </span>
        <Link
          href="/csat/progress"
          className="inline-flex min-h-[44px] items-center text-[15px] text-[var(--t2)] underline decoration-[var(--bd)] underline-offset-4 transition-colors duration-[var(--dur-normal)] hover:text-[var(--t1)] hover:decoration-[var(--t2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)] motion-reduce:transition-none"
        >
          기록 보기
        </Link>
      </p>
    </div>
  )
}

/** 처음 한 번 — 그림 셋 + [시작]. 다시 안 보인다(기록의 `onboarded`). */
function Onboarding({ onStart }: { onStart: () => void }) {
  const steps = [
    { Icon: PencilLine, title: '풀고', says: '평가원 기출 한 문항을 먼저 풀어요' },
    { Icon: Search, title: '이해하고', says: '근거 문장을 누르면 설명이 그 자리에 열려요' },
    { Icon: Lightbulb, title: '한 줄 남기기', says: '다음에 이 유형을 만나면 할 일 한 줄' },
  ]
  return (
    <section
      aria-labelledby="csat-onboard-h"
      className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5"
      data-testid="onboarding"
    >
      <h1 id="csat-onboard-h" className="font-editorial text-[22px] font-[600] text-[var(--t1)]">
        하루 세 문항, 10분
      </h1>
      <ol className="mt-5 grid grid-cols-1 gap-4">
        {steps.map(({ Icon, title, says }, i) => (
          <li key={title} className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--bd)] bg-[var(--bg2)] text-[var(--t1)]"
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[17px] font-[600] text-[var(--t1)]">
                <span className="mr-1.5 font-mono tabular-nums text-[var(--t3)]">{i + 1}</span>
                {title}
              </span>
              <span className="mt-0.5 block break-keep text-[15px] leading-relaxed text-[var(--t2)]">{says}</span>
            </span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onStart} className={`${PRIMARY} mt-6`} data-testid="start">
        시작
        <ArrowRight aria-hidden className="h-5 w-5" />
      </button>
    </section>
  )
}
